'use client';

import React, { useEffect, useCallback, useRef, useState } from 'react';
import { Chess } from 'chess.js';
import { useGame } from '@/context/GameContext';
import { useStockfish } from '@/hooks/useStockfish';
import { PieceColor, PlayerType, MIN_DEPTH, MAX_DEPTH, MoveRecord, ANALYSIS_DEPTH, AI_MIN_MOVE_TIME, ANALYSIS_MULTI_PV } from '@/types/game';
import ChessBoard from './ChessBoard';

// ============================================
// 时间格式化
// ============================================
function formatTime(ms: number): string {
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
    const ms = parseTimeInput(timeInput);
    if (ms !== null && ms > 0) {
      setTime(color, ms);
    }
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
          className="bg-[#3a3a3a] text-white text-sm px-2 py-1 rounded border border-gray-600 focus:outline-none focus:border-yellow-500"
        >
          <option value="player">Player</option>
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
                player.timeRemaining < 60000 ? 'text-red-500' : ''
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
// 主组件: GamingView
// ============================================

// ============================================
// MoveHistoryPanel 组件
// ============================================
function MoveHistoryPanel() {
  const { state, setViewingMoveIndex } = useGame();
  const viewingIndex = state.viewingMoveIndex;
  
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
    <div className="bg-[#2a2a2a] rounded-lg p-4 max-h-[500px] overflow-y-auto">
      <h3 className="text-gray-400 mb-4">Move History</h3>
      <div className="text-sm space-y-1">
        {state.moveHistory.length === 0 ? (
          <span className="text-gray-500">No moves yet</span>
        ) : (
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
                  className={`w-14 text-left rounded px-1 transition ${
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
                    className={`w-14 text-left rounded px-1 transition ${
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
    isReady,
    evaluatePosition, 
    stopSearch,
    setDepth,
    setAnalysisMode,
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

          // 检查游戏是否结束
          checkGameOver(chess);
        }
      } catch (e) {
        console.error('AI move error:', e);
        setAIThinking(false);
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

    const interval = setInterval(() => {
      const currentTime = state.turn === 'w' 
        ? state.white.timeRemaining 
        : state.black.timeRemaining;
      
      // 扣减 100ms
      decrementTime(state.turn, 100);
      
      // 检查是否超时（在下一个 tick 会自动判负）
      if (currentTime <= 100) {
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
        <div className="grid grid-cols-[192px_1fr_320px] gap-6">
          {/* ========== Row 1: 主要内容 ========== */}
          
          {/* 左列: 走棋历史 */}
          <MoveHistoryPanel />

          {/* 中列: 棋盘 */}
          <div className="flex justify-center">
            <ChessBoard />
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

          {/* 中列: 棋盘操作按钮 */}
          <div className="flex items-center justify-center pt-4">
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
                  state.settings.showLegalMoves 
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
                state.isAnalysisMode
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
