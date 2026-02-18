'use client';

import React from 'react';
import { Chess } from 'chess.js';
import { useGame } from '@/context/GameContext';
import { PieceColor, PlayerType, DEFAULT_TIME, MIN_DEPTH, MAX_DEPTH } from '@/types/game';
import ChessBoard from './ChessBoard';

// ============================================
// 棋子 Emoji 映射
// ============================================
const PIECE_EMOJIS: Record<string, string> = {
  'P': '♙', 'N': '♘', 'B': '♗', 'R': '♖', 'Q': '♕', 'K': '♔',
  'p': '♟', 'n': '♞', 'b': '♝', 'r': '♜', 'q': '♛', 'k': '♚',
};

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
// 玩家配置面板
// ============================================
interface PlayerPanelProps {
  color: PieceColor;
  label: string;
}

function PlayerPanel({ color, label }: PlayerPanelProps) {
  const { state, setPlayerType, setAIDepth, setTime } = useGame();
  const player = color === 'w' ? state.white : state.black;

  return (
    <div className="bg-[#2a2a2a] rounded-lg p-4 space-y-4">
      {/* 标题行 */}
      <div className="flex items-center justify-between">
        <span className="text-lg font-semibold">{label}</span>
        
        {/* 类型选择 */}
        <select
          value={player.type}
          onChange={(e) => setPlayerType(color, e.target.value as PlayerType)}
          className="bg-[#3a3a3a] text-white px-3 py-1.5 rounded border border-gray-600 focus:outline-none focus:border-yellow-500"
        >
          <option value="player">Player</option>
          <option value="stockfish">Stockfish 17.1</option>
        </select>
        
        {/* 时间显示 */}
        <span className="text-xl font-mono">{formatTime(player.timeRemaining)}</span>
      </div>

      {/* AI 深度调节 (仅当选择 Stockfish 时显示) */}
      {player.type === 'stockfish' && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-400">Level: {player.aiConfig.depth}</span>
          </div>
          <input
            type="range"
            min={MIN_DEPTH}
            max={MAX_DEPTH}
            value={player.aiConfig.depth}
            onChange={(e) => setAIDepth(color, parseInt(e.target.value))}
            className="w-full h-2 bg-[#3a3a3a] rounded-lg appearance-none cursor-pointer accent-yellow-500"
          />
        </div>
      )}

      {/* Player 时显示 Level: N/A */}
      {player.type === 'player' && (
        <div className="text-sm text-gray-500">
          Level: N/A
        </div>
      )}
    </div>
  );
}

// ============================================
// 主组件: SetupView
// ============================================
export default function SetupView() {
  const { state, startGame, setFen, toggleCustomizing, canAnalyze, toggleAnalysisMode, dispatch } = useGame();

  // 时间选项 (分钟)
  const timeOptions = [1, 3, 5, 10, 15, 30, 60];

  const handleTimeChange = (minutes: number) => {
    const ms = minutes * 60 * 1000;
    dispatch({ type: 'SET_TIME', color: 'w', time: ms });
    dispatch({ type: 'SET_TIME', color: 'b', time: ms });
  };

  const handleResetBoard = () => {
    setFen('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
  };

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-6xl mx-auto">
        {/* 标题 */}
        <h1 className="text-2xl font-bold mb-6 text-gray-400">
          Setup Page {state.isCustomizing && '-- customized'}
        </h1>

        {/* 主布局 */}
        <div className="flex gap-6">
          {/* 左侧: 走棋历史 */}
          <div className="w-48 bg-[#2a2a2a] rounded-lg p-4">
            <h3 className="text-gray-400 mb-4">Move History</h3>
            <div className="text-sm text-gray-500">
              {state.moveHistory.length === 0 ? (
                <span>No moves yet</span>
              ) : (
                state.moveHistory.map((move, i) => (
                  <div key={i}>{i + 1}. {move.san}</div>
                ))
              )}
            </div>
          </div>

          {/* 中间: 棋盘 */}
          <div className="flex-1 flex justify-center">
            <ChessBoard />
          </div>

          {/* 右侧: 配置面板 */}
          <div className="w-80 space-y-4">
            {/* 黑方配置 */}
            <PlayerPanel color="b" label="Black" />

            {/* 时间设置 */}
            <div className="bg-[#2a2a2a] rounded-lg p-4 space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-gray-400">Time Limit:</span>
                <select
                  value={Math.floor(state.white.timeRemaining / 60000)}
                  onChange={(e) => handleTimeChange(parseInt(e.target.value))}
                  className="bg-[#3a3a3a] text-white px-3 py-1.5 rounded border border-gray-600 focus:outline-none focus:border-yellow-500"
                >
                  {timeOptions.map((t) => (
                    <option key={t} value={t}>{t}:00</option>
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

            {/* 白方配置 */}
            <PlayerPanel color="w" label="White" />
          </div>
        </div>

        {/* 底部工具栏 */}
        <div className="mt-6 flex items-center justify-between">
          {/* 左侧: 主题选择 */}
          <div className="flex items-center gap-2">
            <span className="text-gray-400">Theme</span>
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

          {/* 中间: 功能按钮 */}
          <div className="flex gap-2">
            <button
              onClick={toggleCustomizing}
              className={`px-4 py-2 rounded border transition ${
                state.isCustomizing 
                  ? 'bg-yellow-500 text-black border-yellow-500' 
                  : 'border-gray-600 hover:border-gray-400'
              }`}
            >
              Customize Board
            </button>
            <button
              onClick={() => dispatch({ type: 'SET_SETTINGS', settings: { showLegalMoves: !state.settings.showLegalMoves } })}
              className={`px-4 py-2 rounded border transition ${
                state.settings.showLegalMoves 
                  ? 'bg-yellow-500 text-black border-yellow-500' 
                  : 'border-gray-600 hover:border-gray-400'
              }`}
            >
              Show Legal Moves
            </button>
            <button
              onClick={() => dispatch({ type: 'SET_SETTINGS', settings: { boardFlipped: !state.settings.boardFlipped } })}
              className="px-4 py-2 rounded border border-gray-600 hover:border-gray-400 transition"
            >
              Flip Board
            </button>
          </div>

          {/* 右侧: 开始游戏按钮 */}
          <div className="flex gap-2">
            <button
              onClick={startGame}
              className="px-6 py-2 bg-yellow-500 text-black font-semibold rounded hover:bg-yellow-400 transition"
            >
              Start Game →
            </button>
            <button
              onClick={toggleAnalysisMode}
              className={`px-4 py-2 rounded border transition ${
                state.isAnalysisMode
                  ? 'bg-yellow-500 text-black border-yellow-500'
                  : 'border-gray-600 hover:border-gray-400'
              }`}
              title={state.isAnalysisMode ? 'Analysis Opened' : 'Analysis Closed'}
            >
              {state.isAnalysisMode ? 'Analysis Opened' : 'Analysis Closed'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
