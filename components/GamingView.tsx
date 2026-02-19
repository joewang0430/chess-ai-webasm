'use client';

import React, { useEffect, useCallback, useRef, useState, useMemo } from 'react';
import { Chess } from 'chess.js';
import { useGame } from '@/context/GameContext';
import { useStockfish } from '@/hooks/useStockfish';
import { PieceColor, PlayerType, MIN_DEPTH, MAX_DEPTH, MoveRecord, ANALYSIS_DEPTH, AI_MIN_MOVE_TIME, ANALYSIS_MULTI_PV } from '@/types/game';
import ChessBoard from './ChessBoard';

// ============================================
// 棋子 Emoji 映射
// ============================================
const PIECE_EMOJIS: Record<string, string> = {
  'P': '♙', 'N': '♘', 'B': '♗', 'R': '♖', 'Q': '♕', 'K': '♔',
  'p': '♟', 'n': '♞', 'b': '♝', 'r': '♜', 'q': '♛', 'k': '♚',
};

// 棋子分值
const PIECE_VALUES: Record<string, number> = {
  'p': 1, 'n': 3, 'b': 3, 'r': 5, 'q': 9,
  'P': 1, 'N': 3, 'B': 3, 'R': 5, 'Q': 9,
};

// 初始棋子数量
const STARTING_PIECES = {
  p: 8, n: 2, b: 2, r: 2, q: 1,
};

// ============================================
// 时间格式化
// ============================================
function formatTime(ms: number): string {
  // 0 表示不计时
  if (ms === 0) return '--:--';
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

// ============================================
// 玩家配置面板 (Gaming 版本)
// ============================================
interface PlayerPanelProps {
  color: PieceColor;
  label: string;
  isCurrentTurn: boolean;
}

// 时间解析：将 "MM:SS" 转换为毫秒
function parseTimeInput(input: string): number | null {
  const match = input.match(/^(\d{1,3}):(\d{2})$/);
  if (!match) return null;
  const minutes = parseInt(match[1]);
  const seconds = parseInt(match[2]);
  if (seconds >= 60) return null;
  return (minutes * 60 + seconds) * 1000;
}

function PlayerPanel({ color, label, isCurrentTurn }: PlayerPanelProps) {
  const { state, setPlayerType, setAIDepth, setTime } = useGame();
  const player = color === 'w' ? state.white : state.black;
  
  // 时间编辑状态
  const [isEditingTime, setIsEditingTime] = useState(false);
  const [timeInput, setTimeInput] = useState('');

  // 开始编辑时间
  const startEditTime = () => {
    setTimeInput(formatTime(player.timeRemaining));
    setIsEditingTime(true);
  };

  // 保存时间
  const saveTime = () => {
    // 空输入表示 "No Limit"
    if (timeInput.trim() === '') {
      setTime(color, 0);
      setIsEditingTime(false);
      return;
    }
    const ms = parseTimeInput(timeInput);
    if (ms !== null && ms > 0) {
      setTime(color, ms);
    }
    // 非法输入：不改变，直接关闭编辑
    setIsEditingTime(false);
  };

  // 按键处理
  const handleTimeKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      saveTime();
    } else if (e.key === 'Escape') {
      setIsEditingTime(false);
    }
  };

  return (
    <div className={`bg-[#2a2a2a] rounded-lg p-3 space-y-2 ${
      isCurrentTurn ? 'ring-2 ring-yellow-500' : ''
    }`}>
      {/* 标题行 */}
      <div className="flex items-center justify-between">
        {/* 颜色方块 */}
        <div className={`w-5 h-5 rounded-sm border border-gray-500 ${
          color === 'w' ? 'bg-white' : 'bg-black'
        }`} title={label} />
        
        {/* 类型选择 */}
        <select
          value={player.type}
          onChange={(e) => setPlayerType(color, e.target.value as PlayerType)}
          className="bg-[#3a3a3a] text-white text-sm px-2 py-1 rounded border border-gray-600 focus:outline-none focus:border-yellow-500 w-40"
        >
          <option value="player">Human</option>
          <option value="stockfish">Stockfish 17.1</option>
        </select>
        
        {/* 时间显示/编辑 */}
        <div className="flex items-center gap-1">
          {isEditingTime ? (
            <input
              type="text"
              value={timeInput}
              onChange={(e) => setTimeInput(e.target.value)}
              onKeyDown={handleTimeKeyDown}
              onBlur={saveTime}
              autoFocus
              className="w-20 text-lg font-mono bg-[#3a3a3a] text-white px-1 py-0 rounded border border-yellow-500 focus:outline-none text-center"
              placeholder="MM:SS"
            />
          ) : (
            <>
              <span className={`text-lg font-mono ${
                player.timeRemaining > 0 && player.timeRemaining < 60000 ? 'text-red-500' : ''
              }`}>
                {formatTime(player.timeRemaining)}
              </span>
              <button
                onClick={startEditTime}
                className="text-gray-500 hover:text-yellow-500 transition p-0.5"
                title="Edit time"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
              </button>
            </>
          )}
        </div>
      </div>

      {/* AI 深度调节 */}
      {player.type === 'stockfish' ? (
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-400 whitespace-nowrap">Level: {player.aiConfig.depth}</span>
          <input
            type="range"
            min={MIN_DEPTH}
            max={MAX_DEPTH}
            value={player.aiConfig.depth}
            onChange={(e) => setAIDepth(color, parseInt(e.target.value))}
            className="flex-1 h-2 bg-[#3a3a3a] rounded-lg appearance-none cursor-pointer accent-yellow-500"
          />
        </div>
      ) : (
        <div className="text-sm text-gray-500">Level: N/A</div>
      )}
    </div>
  );
}

// ============================================
// 分析面板
// ============================================
function AnalysisPanel() {
  const { state, isCurrentPlayerAI } = useGame();
  const analysis = state.analysis;

  // AI 思考时不显示过时的分析结果
  if (!state.isAnalysisMode || !analysis || isCurrentPlayerAI || state.isAIThinking) {
    return null;
  }

  // 固定行数，避免深度切换时因行数变化导致容器高度抖动
  const rows = Array.from({ length: ANALYSIS_MULTI_PV }, (_, i) => analysis.topMoves[i]);

  return (
    <div className="bg-[#2a2a2a] rounded-lg p-4 space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-gray-400">Analysis (Depth: {analysis.depth})</h3>
        {analysis.isAnalyzing && (
          <span className="text-yellow-500 text-sm animate-pulse">Analyzing...</span>
        )}
      </div>

      <div className="space-y-1">
        {rows.map((move, i) => (
          <div key={i} className="flex items-center justify-between text-sm bg-[#3a3a3a] rounded px-2 py-1 min-h-[32px]">
            <span className="font-mono">
              {i + 1}. {move ? move.move : '…'}
            </span>
            <div className="flex items-center gap-3">
              {move ? (
                <span className={move.score >= 0 ? 'text-green-400' : 'text-red-400'}>
                  {move.mate ? `M${move.mate}` : `${(move.score / 100).toFixed(2)}`}
                </span>
              ) : (
                <span className="text-gray-500">—</span>
              )}
              <span className="text-gray-400">
                {move ? `${move.winChance.toFixed(1)}%` : ''}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================
// EvalBar 组件 - 棋盘右侧的评估条
// ============================================
function EvalBar({ score, isFlipped }: { score?: number; isFlipped?: boolean }) {
  // score: centipawns（正数白方优势，负数黑方优势）
  // 转换为白方占比 (0-100)
  const whitePercent = useMemo(() => {
    if (score === undefined) return 50;
    // 使用 sigmoid 函数平滑转换，避免极端值
    // 大约：+200cp ≈ 65%, +500cp ≈ 85%, +1000cp ≈ 95%
    const normalized = score / 100; // 转为 pawns
    const sigmoid = 1 / (1 + Math.exp(-normalized * 0.5));
    return sigmoid * 100;
  }, [score]);

  // 格式化显示的数值
  const displayScore = useMemo(() => {
    if (score === undefined) return null;
    const pawns = Math.abs(score) / 100;
    // 十位数及以上四舍五入取整，避免溢出
    return pawns >= 10 ? Math.round(pawns).toString() : pawns.toFixed(1);
  }, [score]);

  // 白方是否占优
  const whiteAdvantage = (score ?? 0) >= 0;

  // 默认：黑在上，白在下
  // Flip：白在上，黑在下
  return (
    <div 
      className={`w-5 rounded-sm overflow-hidden flex ml-1 relative ${isFlipped ? 'flex-col-reverse' : 'flex-col'}`} 
      style={{ height: 500 }}
    >
      {/* 黑色区域 */}
      <div 
        className="bg-zinc-700 transition-all duration-500 ease-out relative"
        style={{ height: `${100 - whitePercent}%` }}
      >
        {/* 黑方优势时显示数值：固定在最远离交界处（不翻转时最顶部，翻转时最底部） */}
        {displayScore && !whiteAdvantage && (
          <span className={`absolute left-1/2 -translate-x-1/2 text-[10px] font-medium text-zinc-200 ${isFlipped ? 'bottom-1' : 'top-1'}`}>
            {displayScore}
          </span>
        )}
      </div>
      {/* 白色区域 */}
      <div 
        className="bg-zinc-200 transition-all duration-500 ease-out relative"
        style={{ height: `${whitePercent}%` }}
      >
        {/* 白方优势时显示数值：固定在最远离交界处（不翻转时最底部，翻转时最顶部） */}
        {displayScore && whiteAdvantage && (
          <span className={`absolute left-1/2 -translate-x-1/2 text-[10px] font-medium text-zinc-700 ${isFlipped ? 'top-1' : 'bottom-1'}`}>
            {displayScore}
          </span>
        )}
      </div>
    </div>
  );
}

// ============================================
// 主组件: GamingView
// ============================================

// Unicode 棋子符号
const PIECE_UNICODE: Record<string, { w: string; b: string }> = {
  'p': { w: '♙', b: '♟' },
  'n': { w: '♘', b: '♞' },
  'b': { w: '♗', b: '♝' },
  'r': { w: '♖', b: '♜' },
  'q': { w: '♕', b: '♛' },
};

// ============================================
// CapturedPiecesPanel 组件
// ============================================
function CapturedPiecesPanel() {
  const { state } = useGame();
  
  // 计算被吃的棋子
  const captured = useMemo(() => {
    // 当前棋盘上的棋子
    const currentPieces = { w: { p: 0, n: 0, b: 0, r: 0, q: 0 }, b: { p: 0, n: 0, b: 0, r: 0, q: 0 } };
    
    // 解析 FEN 获取当前棋盘棋子
    const fenBoard = state.fen.split(' ')[0];
    for (const char of fenBoard) {
      if (char === '/' || /\d/.test(char)) continue;
      const isWhite = char === char.toUpperCase();
      const pieceType = char.toLowerCase() as 'p' | 'n' | 'b' | 'r' | 'q' | 'k';
      if (pieceType !== 'k') {
        currentPieces[isWhite ? 'w' : 'b'][pieceType]++;
      }
    }
    
    // 计算被吃的棋子（白方被吃 = 初始 - 当前）
    const whiteCaptured: string[] = [];
    const blackCaptured: string[] = [];
    let whiteMaterial = 0;
    let blackMaterial = 0;
    
    // 白方被吃的棋子（显示在黑方那边）
    for (const [piece, startCount] of Object.entries(STARTING_PIECES)) {
      const captured = startCount - currentPieces.w[piece as keyof typeof STARTING_PIECES];
      for (let i = 0; i < captured; i++) {
        whiteCaptured.push(piece);
        blackMaterial += PIECE_VALUES[piece];
      }
    }
    
    // 黑方被吃的棋子（显示在白方那边）
    for (const [piece, startCount] of Object.entries(STARTING_PIECES)) {
      const captured = startCount - currentPieces.b[piece as keyof typeof STARTING_PIECES];
      for (let i = 0; i < captured; i++) {
        blackCaptured.push(piece);
        whiteMaterial += PIECE_VALUES[piece];
      }
    }
    
    // 计算分差
    const materialDiff = whiteMaterial - blackMaterial;
    
    return {
      whiteCaptured, // 白方被吃的棋子
      blackCaptured, // 黑方被吃的棋子
      whiteMaterial,
      blackMaterial,
      materialDiff,
    };
  }, [state.fen]);
  
  // 按价值排序（后 -> 车 -> 象 -> 马 -> 兵）
  const sortPieces = (pieces: string[]) => {
    const order = ['q', 'r', 'b', 'n', 'p'];
    return [...pieces].sort((a, b) => order.indexOf(a.toLowerCase()) - order.indexOf(b.toLowerCase()));
  };
  
  // 渲染重叠的棋子 (chess.com style)
  const renderOverlappingPieces = (pieces: string[], color: 'w' | 'b') => {
    const sorted = sortPieces(pieces);
    if (sorted.length === 0) return null;
    
    return (
      <div className="flex items-center">
        {sorted.map((piece, i) => (
          <span 
            key={i} 
            className="text-xl leading-none"
            style={{ 
              marginLeft: i === 0 ? 0 : -4,
              textShadow: color === 'w' ? '0 0 2px #000, 0 0 2px #000' : '0 0 2px #fff, 0 0 2px #fff',
            }}
          >
            {PIECE_UNICODE[piece]?.[color]}
          </span>
        ))}
      </div>
    );
  };
  
  return (
    <div className="space-y-1 mb-2">
      {/* 黑方捕获区 (显示白方被吃的棋子) */}
      <div className="bg-[#2a2a2a] rounded-t-lg px-3 py-2 flex items-center justify-between min-h-[32px]">
        {renderOverlappingPieces(captured.whiteCaptured, 'w')}
        {captured.materialDiff < 0 && (
          <span className="text-sm font-medium text-gray-300">+{Math.abs(captured.materialDiff)}</span>
        )}
      </div>
      
      {/* 白方捕获区 (显示黑方被吃的棋子) */}
      <div className="bg-[#2a2a2a] rounded-b-lg px-3 py-2 flex items-center justify-between min-h-[32px]">
        {renderOverlappingPieces(captured.blackCaptured, 'b')}
        {captured.materialDiff > 0 && (
          <span className="text-sm font-medium text-gray-300">+{captured.materialDiff}</span>
        )}
      </div>
    </div>
  );
}

// ============================================
// MoveHistoryPanel 组件
// ============================================
function MoveHistoryPanel() {
  const { state, setViewingMoveIndex } = useGame();
  const viewingIndex = state.viewingMoveIndex;
  const scrollRef = useRef<HTMLDivElement>(null);
  
  // 当 moveHistory 变化时自动滚动到底部
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [state.moveHistory.length]);
  
  // 点击走法预览
  const handleMoveClick = (moveIndex: number) => {
    // 如果点击的是当前预览的走法，取消预览返回当前局面
    if (viewingIndex === moveIndex) {
      setViewingMoveIndex(null);
    } else {
      setViewingMoveIndex(moveIndex);
    }
  };

  return (
    <div className="bg-[#2a2a2a] rounded-lg flex-1 flex flex-col overflow-hidden">
      <h3 className="text-gray-400 text-sm text-center py-2 shrink-0">Move History</h3>
      <div ref={scrollRef} className="text-sm space-y-1 px-4 pb-4 flex-1 overflow-y-auto">
        {state.moveHistory.length > 0 && (
          // 按回合分组：每两步为一回合
          Array.from({ length: Math.ceil(state.moveHistory.length / 2) }, (_, i) => {
            const whiteMoveIndex = i * 2;
            const blackMoveIndex = i * 2 + 1;
            const whiteMove = state.moveHistory[whiteMoveIndex];
            const blackMove = state.moveHistory[blackMoveIndex];
            
            return (
              <div key={i} className="flex gap-2">
                <span className="text-gray-500 w-6">{i + 1}.</span>
                {/* 白方走法 */}
                <button
                  onClick={() => handleMoveClick(whiteMoveIndex)}
                  className={`w-14 text-left rounded-sm px-1 transition ${
                    viewingIndex === whiteMoveIndex
                      ? 'bg-yellow-500 text-black'
                      : 'text-white hover:bg-[#3a3a3a]'
                  }`}
                >
                  {whiteMove?.san || ''}
                </button>
                {/* 黑方走法 */}
                {blackMove && (
                  <button
                    onClick={() => handleMoveClick(blackMoveIndex)}
                    className={`w-14 text-left rounded-sm px-1 transition ${
                      viewingIndex === blackMoveIndex
                        ? 'bg-yellow-500 text-black'
                        : 'text-white hover:bg-[#3a3a3a]'
                    }`}
                  >
                    {blackMove.san}
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

export default function GamingView() {
  const { 
    state, 
    dispatch,
    isHydrated,
    makeMove, 
    undoMove, 
    setViewingMoveIndex,
    resetToMove,
    toggleAnalysisMode,
    setAnalysisData,
    setAIThinking,
    setGameResult,
    decrementTime,
    canUndo, 
    canAnalyze,
    isCurrentPlayerAI,
    resetGame,
  } = useGame();

  // 是否处于历史预览模式
  const isPreviewMode = state.viewingMoveIndex !== null;

  // 获取当前 AI 的深度配置
  const currentAIDepth = state.turn === 'w' 
    ? state.white.aiConfig.depth 
    : state.black.aiConfig.depth;

  // Stockfish Hook
  const { 
    bestMove, 
    pvBestMove,
    isSearching, 
    analysisData,
    currentEval,
    isReady,
    evaluatePosition, 
    stopSearch,
    setDepth,
    setAnalysisMode,
    clearCurrentEval,
  } = useStockfish({
    depth: currentAIDepth,
    analysisMode: state.isAnalysisMode,
  });

  // 右侧玩家面板位置：与棋盘齐平（根据是否翻转）
  const topColor: PieceColor = state.settings.boardFlipped ? 'w' : 'b';
  const bottomColor: PieceColor = state.settings.boardFlipped ? 'b' : 'w';

  // AI 走棋开始时间 (用于最小等待时间)
  const aiThinkStartRef = useRef<number>(0);
  
  // 缓存已完成的分析结果 (方案2: 只缓存深度25完成的结果)
  const analysisCacheRef = useRef<{ fen: string; data: typeof analysisData } | null>(null);

  // ============================================
  // 同步分析数据到全局状态 & 缓存已完成结果
  // ============================================
  useEffect(() => {
    if (state.isAnalysisMode && analysisData) {
      setAnalysisData(analysisData);
      // 分析完成时缓存结果
      if (!analysisData.isAnalyzing) {
        analysisCacheRef.current = { fen: state.fen, data: analysisData };
      }
    }
  }, [analysisData, state.isAnalysisMode, setAnalysisData, state.fen]);

  // 在走棋方切换时，立即停止旧的分析并清空数据，避免滞后显示
  // 同时清除缓存（因为FEN已变化）
  useEffect(() => {
    // 清除缓存
    analysisCacheRef.current = null;
    if (state.isAnalysisMode) {
      stopSearch();
      setAnalysisData(null);
      // 分析模式下不涉及对弈，确保不被 AI 思考标记隐藏面板
      setAIThinking(false);
    }
  }, [state.turn]);

  // ============================================
  // AI 走棋逻辑
  // ============================================
  useEffect(() => {
    // 如果游戏结束或不是 AI 的回合，不触发
    if (state.gameResult || !isCurrentPlayerAI || !isReady) return;

    // 更新深度
    setDepth(currentAIDepth);
    
    // 关闭分析模式（AI 回合不分析）
    setAnalysisMode(false);
    
    // 记录 AI 开始思考的时间
    aiThinkStartRef.current = Date.now();
    
    // 触发 AI 思考
    setAIThinking(true);
    evaluatePosition(state.fen);
  }, [state.turn, isCurrentPlayerAI, state.fen, isReady, state.gameResult, currentAIDepth]);

  // ============================================
  // 处理 AI 返回的走法
  // ============================================
  useEffect(() => {
    const chosen = bestMove;
    if (!chosen || !isCurrentPlayerAI) return;

    // 计算已经等待的时间
    const elapsed = Date.now() - aiThinkStartRef.current;
    const remainingWait = Math.max(0, AI_MIN_MOVE_TIME - elapsed);

    // 执行 AI 的走法 (确保至少等待 200ms)
    const executeMove = () => {
      try {
        const chess = new Chess(state.fen);
        const from = chosen.substring(0, 2);
        const to = chosen.substring(2, 4);
        const promotion = chosen.length > 4 ? chosen[4] : undefined;

        const result = chess.move({ from, to, promotion });
        
        if (result) {
          const moveRecord: MoveRecord = {
            san: result.san,
            uci: chosen,
            color: state.turn,
            fenBefore: state.fen,
            fenAfter: chess.fen(),
            timestamp: Date.now(),
          };

          makeMove(moveRecord);
          setAIThinking(false);
          clearCurrentEval(); // AI 走完后清除实时评估

          // 检查游戏是否结束
          checkGameOver(chess);
        }
      } catch (e) {
        console.error('AI move error:', e);
        setAIThinking(false);
        clearCurrentEval();
      }
    };

    if (remainingWait > 0) {
      const timer = setTimeout(executeMove, remainingWait);
      return () => clearTimeout(timer);
    } else {
      executeMove();
    }
  }, [bestMove]);

  // ============================================
  // 分析模式触发
  // ============================================
  useEffect(() => {
    if (state.isAnalysisMode && !isCurrentPlayerAI && isReady) {
      // 进入分析模式时清理 AI 思考标记，避免面板因 isAIThinking 被隐藏
      setAIThinking(false);
      
      // 检查缓存：如果有匹配当前FEN的已完成分析，直接使用
      const cache = analysisCacheRef.current;
      if (cache && cache.fen === state.fen && cache.data && !cache.data.isAnalyzing) {
        setAnalysisData(cache.data);
        setAnalysisMode(true);
        return;
      }
      
      // 否则发起新搜索
      stopSearch();
      setAnalysisData(null);
      setDepth(ANALYSIS_DEPTH);
      setAnalysisMode(true);
      evaluatePosition(state.fen);
    } else {
      // 非分析模式：不要中断 AI 的搜索，仅清理分析 UI 状态
      if (!isCurrentPlayerAI) {
        stopSearch();
        // 非 AI 回合时确保关闭 AI 思考标记
        setAIThinking(false);
      }
      setAnalysisMode(false);
      setAnalysisData(null);
    }
  }, [state.isAnalysisMode, state.fen, isCurrentPlayerAI, isReady]);

  // ============================================
  // 计时器逻辑
  // ============================================
  useEffect(() => {
    // 游戏未开始或已结束时不计时
    if (state.phase !== 'playing' || state.gameResult) return;

    const currentTime = state.turn === 'w' 
      ? state.white.timeRemaining 
      : state.black.timeRemaining;
    
    // 0 表示不计时，跳过倒计时逻辑
    if (currentTime === 0) return;

    const interval = setInterval(() => {
      const time = state.turn === 'w' 
        ? state.white.timeRemaining 
        : state.black.timeRemaining;
      
      // 0 表示不计时，不扣减
      if (time === 0) return;
      
      // 扣减 100ms
      decrementTime(state.turn, 100);
      
      // 检查是否超时（在下一个 tick 会自动判负）
      if (time <= 100) {
        setGameResult({
          winner: state.turn === 'w' ? 'b' : 'w',
          reason: 'timeout',
        });
      }
    }, 100);

    return () => clearInterval(interval);
  }, [state.phase, state.gameResult, state.turn, state.white.timeRemaining, state.black.timeRemaining, decrementTime, setGameResult]);

  // ============================================
  // 检查游戏结束
  // ============================================
  const checkGameOver = useCallback((chess: Chess) => {
    if (chess.isCheckmate()) {
      setGameResult({
        winner: chess.turn() === 'w' ? 'b' : 'w',
        reason: 'checkmate',
      });
    } else if (chess.isStalemate()) {
      setGameResult({ winner: null, reason: 'stalemate' });
    } else if (chess.isThreefoldRepetition()) {
      setGameResult({ winner: null, reason: 'threefold' });
    } else if (chess.isDraw()) {
      setGameResult({ winner: null, reason: 'fifty-move' });
    }
  }, [setGameResult]);

  // ============================================
  // 处理返回 Setup
  // ============================================
  const handleBackToSetup = () => {
    stopSearch();
    dispatch({ type: 'SET_PHASE', phase: 'setup' });
    dispatch({ type: 'RESET_GAME' });
  };

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-6xl mx-auto">
        {/* 标题 */}
        <h1 className="text-2xl font-bold mb-6 text-gray-400">
          Gaming {state.isAnalysisMode && '-- Analysis Mode'}
        </h1>

        {/* 游戏结束提示 */}
        {state.gameResult && (
          <div className="mb-4 p-4 bg-yellow-500 text-black rounded-lg text-center">
            <span className="font-bold text-lg">
              {state.gameResult.winner 
                ? `${state.gameResult.winner === 'w' ? 'White' : 'Black'} wins by ${state.gameResult.reason}!`
                : `Draw by ${state.gameResult.reason}!`
              }
            </span>
          </div>
        )}

        {/* 主布局 - 使用 Grid 确保上下列对齐 */}
        <div className="grid grid-cols-[192px_524px_320px] gap-6">
          {/* ========== Row 1: 主要内容 ========== */}
          
          {/* 左列: 捕获棋子 + 走棋历史 */}
          <div className="flex flex-col h-[500px]">
            <CapturedPiecesPanel />
            <MoveHistoryPanel />
          </div>

          {/* 中列: 棋盘 + Eval Bar 区域 (始终预留空间) */}
          <div className="flex">
            <ChessBoard />
            {/* Bar 区域：始终占 24px，保持右侧面板位置稳定 */}
            <div className="w-6 flex-shrink-0">
              {/* EvalBar: 仅在分析模式下显示 */}
              {state.isAnalysisMode && (
                <EvalBar 
                  score={(() => {
                    // 获取原始评分（当前走棋方视角）
                    const rawScore = state.isAIThinking && currentEval !== null
                      ? currentEval
                      : state.analysis?.topMoves[0]?.score;
                    if (rawScore === undefined) return undefined;
                    // 统一转换为白方视角
                    return state.turn === 'w' ? rawScore : -rawScore;
                  })()} 
                  isFlipped={state.settings.boardFlipped} 
                />
              )}
            </div>
          </div>

          {/* 右列: 配置面板 */}
          <div className="h-[500px] flex flex-col justify-between">
            {/* 顶部：根据是否翻转决定谁在上 */}
            <div>
              <PlayerPanel 
                color={topColor} 
                label={topColor === 'b' ? 'Black' : 'White'} 
                isCurrentTurn={state.turn === topColor} 
              />
            </div>

            {/* 中间：分析面板 */}
            <div className="my-3">
              <AnalysisPanel />
            </div>

            {/* 底部：另一方 */}
            <div>
              <PlayerPanel 
                color={bottomColor} 
                label={bottomColor === 'b' ? 'Black' : 'White'} 
                isCurrentTurn={state.turn === bottomColor} 
              />
            </div>
          </div>

          {/* ========== Row 2: 工具栏 ========== */}
          
          {/* 左列: Theme 选择器 */}
          <div className="flex items-center justify-center gap-2 pt-4">
            <span className="text-gray-400 text-sm">Theme</span>
            <div className="flex gap-1">
              {['green', 'blue', 'brown', 'purple', 'gray'].map((theme) => (
                <button
                  key={theme}
                  onClick={() => dispatch({ type: 'SET_SETTINGS', settings: { theme: theme as any } })}
                  className={`w-6 h-6 rounded border-2 ${
                    state.settings.theme === theme ? 'border-white' : 'border-transparent'
                  }`}
                  style={{
                    background: theme === 'green' ? 'linear-gradient(135deg, #eeeed2 50%, #769656 50%)'
                      : theme === 'blue' ? 'linear-gradient(135deg, #dee3e6 50%, #8ca2ad 50%)'
                      : theme === 'brown' ? 'linear-gradient(135deg, #f0d9b5 50%, #b58863 50%)'
                      : theme === 'purple' ? 'linear-gradient(135deg, #e8d0ff 50%, #9070b0 50%)'
                      : 'linear-gradient(135deg, #e0e0e0 50%, #808080 50%)'
                  }}
                />
              ))}
            </div>
          </div>

          {/* 中列: 棋盘操作按钮 - 固定 500px 只和棋盘对齐 */}
          <div className="pt-4">
            <div className="w-[500px] flex items-center justify-between">
              {/* Back to Now - 始终显示，非预览模式下 disabled */}
              <button
                onClick={() => setViewingMoveIndex(null)}
                disabled={!isPreviewMode}
                className={`flex-1 px-2 py-2 rounded border transition whitespace-nowrap ${
                  isPreviewMode
                    ? 'border-gray-600 hover:border-gray-400'
                    : 'border-gray-700 text-gray-600 cursor-not-allowed'
                }`}
              >
                Back to Now
              </button>
              
              {/* Undo / Play from Here - 互斥显示 */}
              {isPreviewMode ? (
                <button
                  onClick={() => {
                    resetToMove(state.viewingMoveIndex!);
                  }}
                  className="flex-1 mx-2 px-2 py-2 rounded border border-gray-600 hover:border-gray-400 transition whitespace-nowrap"
                >
                  Play from Here
                </button>
              ) : (
                <button
                  onClick={undoMove}
                  disabled={!canUndo}
                  className={`flex-1 mx-2 px-2 py-2 rounded border transition whitespace-nowrap ${
                    canUndo 
                      ? 'border-gray-600 hover:border-gray-400' 
                      : 'border-gray-700 text-gray-600 cursor-not-allowed'
                  }`}
                >
                  Undo
                </button>
              )}
              
              <button
                onClick={() => dispatch({ type: 'SET_SETTINGS', settings: { showLegalMoves: !state.settings.showLegalMoves } })}
                className={`flex-1 px-2 py-2 rounded border transition whitespace-nowrap ${
                  isHydrated && state.settings.showLegalMoves 
                    ? 'border-yellow-500 text-yellow-500' 
                    : 'border-gray-600 hover:border-gray-400'
                }`}
              >
                {state.settings.showLegalMoves ? 'Hide Legal' : 'Show Legal'}
              </button>
              <button
                onClick={() => dispatch({ type: 'SET_SETTINGS', settings: { boardFlipped: !state.settings.boardFlipped } })}
                className="flex-1 ml-2 px-2 py-2 rounded border border-gray-600 hover:border-gray-400 transition whitespace-nowrap"
              >
                Flip
              </button>
            </div>
          </div>

          {/* 右列: 游戏控制按钮 */}
          <div className="flex items-center gap-2 pt-4">
            <button
              onClick={handleBackToSetup}
              className="flex-1 py-2 rounded border border-gray-600 hover:border-gray-400 transition whitespace-nowrap"
            >
              New Game
            </button>
            <button
              onClick={toggleAnalysisMode}
              disabled={!canAnalyze && !state.isAnalysisMode}
              className={`flex-1 py-2 rounded border transition whitespace-nowrap ${
                isHydrated && state.isAnalysisMode
                  ? 'border-yellow-500 text-yellow-500'
                  : canAnalyze
                    ? 'border-gray-600 hover:border-gray-400'
                    : 'border-gray-700 text-gray-600 cursor-not-allowed'
              }`}
              title={!canAnalyze && !state.isAnalysisMode ? "Need a Player's turn to analyze" : ""}
            >
              {state.isAnalysisMode ? 'Close Analysis' : 'Open Analysis'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
