'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Chess } from 'chess.js';
import { useGame } from '@/context/GameContext';
import { PieceColor, PlayerType, DEFAULT_TIME, MIN_DEPTH, MAX_DEPTH, ANALYSIS_DEPTH, ANALYSIS_MULTI_PV } from '@/types/game';
import { useStockfish } from '@/hooks/useStockfish';
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

// 时间解析：将 "MM:SS" 转换为毫秒
function parseTimeInput(input: string): number | null {
  const match = input.match(/^(\d{1,3}):(\d{2})$/);
  if (!match) return null;
  const minutes = parseInt(match[1]);
  const seconds = parseInt(match[2]);
  if (seconds >= 60) return null;
  return (minutes * 60 + seconds) * 1000;
}

// ============================================
// 玩家配置面板
// ============================================
interface PlayerPanelProps {
  color: PieceColor;
  label: string;
}

function PlayerPanel({ color, label }: PlayerPanelProps) {
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
    <div className="bg-[#2a2a2a] rounded-lg p-3 space-y-2">
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
          className="bg-[#3a3a3a] text-white text-sm px-2 py-1 rounded border border-gray-600 focus:outline-none focus:border-yellow-500"
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
              <span className="text-lg font-mono">
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

      {/* AI 深度调节 (仅当选择 Stockfish 时显示) */}
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
// Setup 分析面板
// ============================================
function SetupAnalysisPanel() {
  const { state } = useGame();
  const analysis = state.analysis;

  if (!state.isAnalysisMode) {
    return null;
  }

  if (!analysis || state.isAIThinking) {
    return (
      <div className="bg-[#2a2a2a] rounded-lg p-4 min-h-[214px] flex items-center justify-center">
        <div className="h-6 w-6 rounded-full border-2 border-zinc-600 border-t-zinc-400 animate-spin" />
      </div>
    );
  }

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
// Setup 评估条
// ============================================
function SetupEvalBar({ score, isFlipped }: { score?: number; isFlipped?: boolean }) {
  const lastValidRef = useRef<{ whitePercent: number; score: number } | null>(null);
  const isStalled = score === undefined;

  let whitePercent: number;
  let effectiveScore: number;

  if (score !== undefined) {
    const normalized = score / 100;
    const sigmoid = 1 / (1 + Math.exp(-normalized * 0.5));
    whitePercent = sigmoid * 100;
    effectiveScore = score;
    lastValidRef.current = { whitePercent, score };
  } else if (lastValidRef.current !== null) {
    whitePercent = lastValidRef.current.whitePercent;
    effectiveScore = lastValidRef.current.score;
  } else {
    whitePercent = 50;
    effectiveScore = 0;
  }

  const displayScore = useMemo(() => {
    const pawns = Math.abs(effectiveScore) / 100;
    return pawns >= 10 ? Math.round(pawns).toString() : pawns.toFixed(1);
  }, [effectiveScore]);

  const whiteAdvantage = effectiveScore >= 0;

  return (
    <div
      className={`w-5 rounded-sm overflow-hidden flex ml-1 relative ${isFlipped ? 'flex-col-reverse' : 'flex-col'}`}
      style={{ height: 500 }}
    >
      <div
        className={`bg-zinc-700 transition-all duration-500 ease-out relative ${isStalled ? 'animate-pulse' : ''}`}
        style={{ height: `${100 - whitePercent}%` }}
      >
        {displayScore && !whiteAdvantage && (
          <span className={`absolute left-1/2 -translate-x-1/2 text-[10px] font-medium text-zinc-200 ${isFlipped ? 'bottom-1' : 'top-1'}`}>
            {displayScore}
          </span>
        )}
      </div>
      <div
        className={`bg-zinc-200 transition-all duration-500 ease-out relative ${isStalled ? 'animate-pulse' : ''}`}
        style={{ height: `${whitePercent}%` }}
      >
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
// 主组件: SetupView
// ============================================
export default function SetupView() {
  const { state, startGame, setFen, toggleCustomizing, toggleAnalysisMode, dispatch, isHydrated, setAnalysisData } = useGame();

  const displayedTurn = useMemo(() => state.fen.split(' ')[1] as PieceColor, [state.fen]);

  const {
    analysisData,
    isReady,
    evaluatePosition,
    stopSearch,
    setDepth,
    setAnalysisMode,
  } = useStockfish({
    depth: ANALYSIS_DEPTH,
    analysisMode: state.isAnalysisMode,
  });

  useEffect(() => {
    if (state.isAnalysisMode && analysisData) {
      setAnalysisData(analysisData);
    }
  }, [analysisData, state.isAnalysisMode, setAnalysisData]);

  useEffect(() => {
    if (state.isAnalysisMode && isReady) {
      const targetFen = state.fen;
      stopSearch();
      setAnalysisData(null);
      setDepth(ANALYSIS_DEPTH);
      setAnalysisMode(true);
      evaluatePosition(targetFen);
    } else {
      stopSearch();
      setAnalysisMode(false);
      setAnalysisData(null);
    }
  }, [state.isAnalysisMode, state.fen, isReady, stopSearch, setAnalysisData, setDepth, setAnalysisMode, evaluatePosition]);

  // 时间选项 (分钟, 0 表示不计时)
  const timeOptions = [1, 3, 5, 10, 15, 30, 60, 120, 0];

  const handleTimeChange = (minutes: number) => {
    // 0 表示不计时
    const ms = minutes === 0 ? 0 : minutes * 60 * 1000;
    dispatch({ type: 'SET_TIME', color: 'w', time: ms });
    dispatch({ type: 'SET_TIME', color: 'b', time: ms });
    // 保存到 localStorage
    try {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('timeLimit', String(ms));
      }
    } catch {}
  };

  // 获取当前选中的时间值（用于 select）
  const getCurrentTimeValue = () => {
    const ms = state.white.timeRemaining;
    if (ms === 0) return 0;
    return Math.floor(ms / 60000);
  };

  const handleResetBoard = () => {
    setFen('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
  };

  // 右侧玩家面板位置：根据是否翻转
  const topColor: PieceColor = state.settings.boardFlipped ? 'w' : 'b';
  const bottomColor: PieceColor = state.settings.boardFlipped ? 'b' : 'w';

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-6xl mx-auto">
        {/* 标题 */}
        <h1 className="text-2xl font-bold mb-6 text-gray-400">
          Setup Page {state.isCustomizing && '-- customized'}
        </h1>

        {/* 主布局 - 使用 Grid 确保上下列对齐 */}
        <div className="grid grid-cols-[192px_524px_320px] gap-6">
          {/* ========== Row 1: 主要内容 ========== */}
          
          {/* 左列: 捕获棋子 + 走棋历史 */}
          <div className="flex flex-col h-[500px]">
            <CapturedPiecesPanel />
            <div className="bg-[#2a2a2a] rounded-lg flex-1 flex flex-col overflow-hidden">
              <h3 className="text-gray-400 text-sm text-center py-2 shrink-0">Move History</h3>
              <div className="text-sm text-gray-500 px-4 pb-4 flex-1 overflow-y-auto">
                {state.moveHistory.map((move, i) => (
                  <div key={i}>{i + 1}. {move.san}</div>
                ))}
              </div>
            </div>
          </div>

          {/* 中列: 棋盘 + EvalBar 空间（与 Gaming 一致） */}
          <div className="flex">
            <ChessBoard />
            <div className="w-6 flex-shrink-0">
              {state.isAnalysisMode && (
                <SetupEvalBar
                  score={(() => {
                    const rawScore = state.analysis?.topMoves[0]?.score;
                    if (rawScore === undefined) return undefined;
                    return displayedTurn === 'w' ? rawScore : -rawScore;
                  })()}
                  isFlipped={state.settings.boardFlipped}
                />
              )}
            </div>
          </div>

          {/* 右列: 配置面板（与棋盘上下齐平） */}
          <div className="h-[500px] flex flex-col justify-between">
            {/* 顶部 */}
            <div>
              <PlayerPanel color={topColor} label={topColor === 'b' ? 'Black' : 'White'} />
            </div>

            {/* 中间：分析面板 / 时间设置（Analysis 开启时用分析替换时间设置） */}
            <div className="my-3">
              {state.isAnalysisMode ? (
                <SetupAnalysisPanel />
              ) : (
                <div className="bg-[#2a2a2a] rounded-lg p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="text-gray-400">Time Limit:</span>
                    <select
                      value={getCurrentTimeValue()}
                      onChange={(e) => handleTimeChange(parseInt(e.target.value))}
                      className="bg-[#3a3a3a] text-white px-3 py-1.5 rounded border border-gray-600 focus:outline-none focus:border-yellow-500"
                    >
                      {timeOptions.map((t) => (
                        <option key={t} value={t}>{t === 0 ? 'No Limit' : `${t}:00`}</option>
                      ))}
                    </select>
                  </div>

                  {/* 自定义棋盘时的先手选择 */}
                  {state.isCustomizing && (
                    <>
                      <div className="flex items-center gap-2">
                        <span className="text-gray-400">Board is customized:</span>
                        <select
                          value={state.turn}
                          onChange={(e) => {
                            const newFen = state.fen.replace(
                              / [wb] /,
                              ` ${e.target.value} `
                            );
                            setFen(newFen);
                          }}
                          className="bg-[#3a3a3a] text-white px-3 py-1.5 rounded border border-gray-600 focus:outline-none focus:border-yellow-500"
                        >
                          <option value="w">White</option>
                          <option value="b">Black</option>
                        </select>
                        <span className="text-gray-400">plays first.</span>
                      </div>

                      <button
                        onClick={handleResetBoard}
                        className="text-gray-400 underline hover:text-white transition"
                      >
                        Reset to classic board
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* 底部 */}
            <div>
              <PlayerPanel color={bottomColor} label={bottomColor === 'b' ? 'Black' : 'White'} />
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
                  className={`w-6 h-6 rounded-md border-2 ${
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

          {/* 中列: 棋盘操作按钮 */}
          <div className="pt-4">
            <div className="w-[500px] flex items-center gap-3">
              <button
                onClick={toggleCustomizing}
                className={`flex-1 px-2 py-2 rounded-lg border transition whitespace-nowrap ${
                  state.isCustomizing 
                    ? 'border-yellow-500 text-yellow-500 hover:border-yellow-400 hover:text-yellow-400' 
                    : 'border-gray-600 text-gray-300 hover:text-white hover:border-gray-400'
                }`}
              >
                Setup Board
              </button>
              <button
                onClick={() => dispatch({ type: 'SET_SETTINGS', settings: { showLegalMoves: !state.settings.showLegalMoves } })}
                className={`flex-1 px-2 py-2 rounded-lg border transition whitespace-nowrap ${
                  isHydrated && state.settings.showLegalMoves 
                    ? 'border-yellow-500 text-yellow-500 hover:border-yellow-400 hover:text-yellow-400' 
                    : 'border-gray-600 text-gray-300 hover:text-white hover:border-gray-400'
                }`}
              >
                {state.settings.showLegalMoves ? 'Hide Legal' : 'Show Legal'}
              </button>
              <button
                onClick={() => dispatch({ type: 'SET_SETTINGS', settings: { boardFlipped: !state.settings.boardFlipped } })}
                className="flex-1 px-2 py-2 rounded-lg border border-gray-600 text-gray-300 hover:text-white hover:border-gray-400 transition whitespace-nowrap"
              >
                Flip
              </button>
            </div>
          </div>

          {/* 右列: 开始游戏按钮 */}
          <div className="flex items-center gap-3 pt-4">
            <button
              onClick={startGame}
              className="flex-1 py-2 bg-yellow-500 text-black font-semibold rounded-lg hover:bg-yellow-400 hover:-translate-y-0.5 transform-gpu transition whitespace-nowrap"
            >
              Start Game
            </button>
            <button
              onClick={toggleAnalysisMode}
              className={`flex-1 py-2 rounded-lg border transition whitespace-nowrap ${
                isHydrated && state.isAnalysisMode
                  ? 'border-yellow-500 text-yellow-500 hover:border-yellow-400 hover:text-yellow-400'
                  : 'border-gray-600 text-gray-300 hover:text-white hover:border-gray-400'
              }`}
              title={state.isAnalysisMode ? 'Close Analysis' : 'Open Analysis'}
            >
              {state.isAnalysisMode ? 'Close Analysis' : 'Open Analysis'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
