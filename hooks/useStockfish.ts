import { useEffect, useRef, useState, useCallback } from 'react';
import { AnalysisMove, AnalysisData, ANALYSIS_MULTI_PV } from '@/types/game';

// ============================================
// 类型定义
// ============================================

interface StockfishOptions {
  /** 搜索深度 (1-25, 默认 15) */
  depth?: number;
  /** 思考时间限制 ms (默认 0 不限制) */
  moveTime?: number;
  /** 是否开启分析模式 (输出 Top N 走法) */
  analysisMode?: boolean;
  /** 分析模式下输出的走法数量 (默认 5) */
  multiPV?: number;
}

interface StockfishHook {
  /** AI 计算出的最佳走法 (UCI 格式, 如 "e2e4") */
  bestMove: string | null;
  /** 是否正在思考 */
  isSearching: boolean;
  /** 分析数据 (仅分析模式下有效) */
  analysisData: AnalysisData | null;
  /** 引擎是否已就绪 */
  isReady: boolean;
  /** 让 AI 分析指定局面 */
  evaluatePosition: (fen: string) => void;
  /** 停止当前搜索 */
  stopSearch: () => void;
  /** 重置引擎状态 */
  resetEngine: () => void;
  /** 动态更新搜索深度 */
  setDepth: (depth: number) => void;
  /** 动态切换分析模式 */
  setAnalysisMode: (enabled: boolean) => void;
}

// ============================================
// 解析工具函数
// ============================================

/**
 * 解析 Stockfish 的 info 行
 * 示例: "info depth 20 multipv 1 score cp 35 wdl 620 300 80 pv e2e4 e7e5 ..."
 */
function parseInfoLine(line: string): Partial<AnalysisMove> & { depth?: number; multipv?: number } | null {
  if (!line.startsWith('info') || !line.includes('score')) {
    return null;
  }

  const result: Partial<AnalysisMove> & { depth?: number; multipv?: number } = {};

  // 解析 depth
  const depthMatch = line.match(/depth (\d+)/);
  if (depthMatch) {
    result.depth = parseInt(depthMatch[1]);
  }

  // 解析 multipv (第几个变着, 1-based)
  const multipvMatch = line.match(/multipv (\d+)/);
  if (multipvMatch) {
    result.multipv = parseInt(multipvMatch[1]);
  }

  // 解析 score cp (厘兵评分)
  const scoreCpMatch = line.match(/score cp (-?\d+)/);
  if (scoreCpMatch) {
    result.score = parseInt(scoreCpMatch[1]);
    result.mate = null;
  }

  // 解析 score mate (将杀步数)
  const scoreMateMatch = line.match(/score mate (-?\d+)/);
  if (scoreMateMatch) {
    result.mate = parseInt(scoreMateMatch[1]);
    // 将杀评分：用很大的数表示
    result.score = result.mate > 0 ? 100000 - result.mate * 100 : -100000 - result.mate * 100;
  }

  // 解析 wdl (Win/Draw/Loss, 千分比)
  const wdlMatch = line.match(/wdl (\d+) (\d+) (\d+)/);
  if (wdlMatch) {
    result.winChance = parseInt(wdlMatch[1]) / 10;
    result.drawChance = parseInt(wdlMatch[2]) / 10;
    result.lossChance = parseInt(wdlMatch[3]) / 10;
  } else if (result.score !== undefined) {
    // 如果没有 WDL，用评分估算胜率 (Lichess 公式的简化版)
    const score = result.score;
    const winProb = 1 / (1 + Math.exp(-0.004 * score));
    result.winChance = Math.round(winProb * 100 * 10) / 10;
    result.lossChance = Math.round((1 - winProb) * 100 * 10) / 10;
    result.drawChance = 0;
  }

  // 解析 pv (主要变着)
  const pvMatch = line.match(/ pv (.+)$/);
  if (pvMatch) {
    result.pv = pvMatch[1].split(' ');
    result.move = result.pv[0]; // 第一个走法就是这个变着的起点
  }

  return result;
}

// ============================================
// Hook 主体
// ============================================

export function useStockfish({
  depth = 15,
  moveTime = 0,
  analysisMode = false,
  multiPV = ANALYSIS_MULTI_PV,
}: StockfishOptions = {}): StockfishHook {
  
  const workerRef = useRef<Worker | null>(null);
  
  // 状态
  const [bestMove, setBestMove] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [analysisData, setAnalysisData] = useState<AnalysisData | null>(null);
  
  // 配置 Refs (用于在回调中访问最新值)
  const depthRef = useRef(depth);
  const moveTimeRef = useRef(moveTime);
  const analysisModeRef = useRef(analysisMode);
  const multiPVRef = useRef(multiPV);
  
  // 临时存储分析结果 (每个深度的 Top N)
  const analysisBufferRef = useRef<Map<number, AnalysisMove>>(new Map());

  // 同步 Refs
  useEffect(() => { depthRef.current = depth; }, [depth]);
  useEffect(() => { moveTimeRef.current = moveTime; }, [moveTime]);
  useEffect(() => { analysisModeRef.current = analysisMode; }, [analysisMode]);
  useEffect(() => { multiPVRef.current = multiPV; }, [multiPV]);

  // ============================================
  // 初始化 Worker
  // ============================================
  
  useEffect(() => {
    const worker = new Worker('/engine/stockfish-17.1-8e4d048.js');
    workerRef.current = worker;

    worker.onmessage = (event) => {
      const msg = event.data;
      if (typeof msg !== 'string') return;

      // console.log('SF:', msg); // Debug

      // --- 解析 readyok ---
      if (msg === 'readyok') {
        setIsReady(true);
        return;
      }

      // --- 解析 info 行 ---
      const info = parseInfoLine(msg);
      if (info && info.move) {
        // 分析模式: 收集 Top N 走法
        if (analysisModeRef.current && info.multipv) {
          analysisBufferRef.current.set(info.multipv, {
            move: info.move,
            score: info.score ?? 0,
            mate: info.mate ?? null,
            winChance: info.winChance ?? 50,
            drawChance: info.drawChance ?? 0,
            lossChance: info.lossChance ?? 50,
            pv: info.pv ?? [],
          });

          // 当收到所有 multipv 后，更新状态
          if (info.multipv === multiPVRef.current || analysisBufferRef.current.size >= multiPVRef.current) {
            const topMoves: AnalysisMove[] = [];
            for (let i = 1; i <= multiPVRef.current; i++) {
              const move = analysisBufferRef.current.get(i);
              if (move) topMoves.push(move);
            }
            
            setAnalysisData({
              depth: info.depth ?? 0,
              topMoves,
              isAnalyzing: true,
            });
          }
        }
      }

      // --- 解析 bestmove ---
      if (msg.startsWith('bestmove')) {
        const move = msg.split(' ')[1];
        if (move && move !== '(none)') {
          setBestMove(move);
        }
        setIsSearching(false);
        
        // 分析完成
        if (analysisModeRef.current) {
          setAnalysisData(prev => prev ? { ...prev, isAnalyzing: false } : null);
        }
      }
    };

    // 初始化 UCI
    worker.postMessage('uci');
    
    // 配置引擎
    setTimeout(() => {
      worker.postMessage('setoption name Skill Level value 20'); // 固定最强
      worker.postMessage('setoption name Use NNUE value true');
      worker.postMessage('setoption name UCI_ShowWDL value true'); // 开启胜率
      worker.postMessage('isready');
    }, 100);

    return () => {
      worker.terminate();
    };
  }, []); // 只在挂载时初始化一次

  // ============================================
  // 核心方法
  // ============================================

  /** 分析指定局面 */
  const evaluatePosition = useCallback((fen: string) => {
    if (!workerRef.current || !isReady) return;

    // 清除之前的结果
    setBestMove(null);
    analysisBufferRef.current.clear();
    setIsSearching(true);

    if (analysisModeRef.current) {
      setAnalysisData({ depth: 0, topMoves: [], isAnalyzing: true });
    }

    // 设置 MultiPV
    const pvCount = analysisModeRef.current ? multiPVRef.current : 1;
    workerRef.current.postMessage(`setoption name MultiPV value ${pvCount}`);

    // 设置局面
    workerRef.current.postMessage(`position fen ${fen}`);

    // 构建 go 命令
    let command = `go depth ${depthRef.current}`;
    if (moveTimeRef.current > 0) {
      command += ` movetime ${moveTimeRef.current}`;
    }

    workerRef.current.postMessage(command);
  }, [isReady]);

  /** 停止搜索 */
  const stopSearch = useCallback(() => {
    if (!workerRef.current) return;
    workerRef.current.postMessage('stop');
    setIsSearching(false);
  }, []);

  /** 重置引擎 */
  const resetEngine = useCallback(() => {
    if (!workerRef.current) return;
    workerRef.current.postMessage('ucinewgame');
    workerRef.current.postMessage('isready');
    setBestMove(null);
    setAnalysisData(null);
    setIsSearching(false);
  }, []);

  /** 动态更新深度 */
  const setDepth = useCallback((newDepth: number) => {
    depthRef.current = newDepth;
  }, []);

  /** 动态切换分析模式 */
  const setAnalysisModeHook = useCallback((enabled: boolean) => {
    analysisModeRef.current = enabled;
    if (!enabled) {
      setAnalysisData(null);
      analysisBufferRef.current.clear();
    }
  }, []);

  return {
    bestMove,
    isSearching,
    analysisData,
    isReady,
    evaluatePosition,
    stopSearch,
    resetEngine,
    setDepth,
    setAnalysisMode: setAnalysisModeHook,
  };
}