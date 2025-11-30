import { useEffect, useRef, useState, useCallback } from 'react';

interface StockfishOptions {
  depth?: number;       // 思考深度 (默认 20)
  skillLevel?: number;  // 技能等级 0-22 (默认 20)
  moveTime?: number;    // 思考时间限制 ms (默认 0 不限制)
}

interface StockfishHook {
  bestMove: string | null;      // AI 计算出的最佳走法 (例如 "e2e4")
  isSearching: boolean;         // 是否正在思考
  evaluatePosition: (fen: string) => void; // 让 AI 分析某个局面
  resetGame: () => void;        // 重置 AI 内部状态
}

export function useStockfish({ 
  depth = 20, 
  skillLevel = 20, 
  moveTime = 0 
}: StockfishOptions = {}): StockfishHook {
  
  const workerRef = useRef<Worker | null>(null);
  const [bestMove, setBestMove] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  // 初始化 Worker
  useEffect(() => {
    // 确保路径正确，指向 public/engine 下的文件
    const worker = new Worker('/engine/stockfish-17.1-8e4d048.js');
    workerRef.current = worker;

    // 监听消息
    worker.onmessage = (event) => {
      const msg = event.data;
      
      // 简单的日志输出，方便调试 (生产环境可注释)
      // console.log('SF:', msg);

      // 解析 bestmove 指令
      if (typeof msg === 'string' && msg.startsWith('bestmove')) {
        const move = msg.split(' ')[1]; // "bestmove e2e4 ponder ..." -> "e2e4"
        if (move && move !== '(none)') {
          setBestMove(move);
        }
        setIsSearching(false);
      }
    };

    // 初始化流程
    worker.postMessage('uci');
    
    // 设置难度 (Skill Level)
    worker.postMessage(`setoption name Skill Level value ${skillLevel}`);
    
    // 开启内置 NNUE (最强配置)
    // 稍微延迟一点确保 uci 初始化完成
    setTimeout(() => {
      worker.postMessage('setoption name Use NNUE value true');
      worker.postMessage('isready');
    }, 200);

    return () => {
      worker.terminate();
    };
  }, [skillLevel]); // 如果 skillLevel 变了，重启 worker (简单粗暴但有效)

  // 核心函数：分析局面
  const evaluatePosition = useCallback((fen: string) => {
    if (!workerRef.current) return;

    setIsSearching(true);
    setBestMove(null); // 清除上一步的结果

    // 1. 设置局面
    workerRef.current.postMessage(`position fen ${fen}`);

    // 2. 构建思考指令
    let command = `go depth ${depth}`;
    if (moveTime > 0) {
      command += ` movetime ${moveTime}`;
    }

    // 3. 开始思考
    workerRef.current.postMessage(command);
  }, [depth, moveTime]);

  // 重置函数
  const resetGame = useCallback(() => {
    if (!workerRef.current) return;
    workerRef.current.postMessage('ucinewgame');
    workerRef.current.postMessage('isready');
    setBestMove(null);
    setIsSearching(false);
  }, []);

  return { bestMove, isSearching, evaluatePosition, resetGame };
}