'use client';

import React, { useState, useEffect } from 'react';
import { Chess } from 'chess.js';
import { useStockfish } from '@/hooks/useStockfish';

// 棋子图片资源 (维基百科标准资源)
const PIECE_EMOJIS: Record<string, string> = {
  'P': '♙', 'N': '♘', 'B': '♗', 'R': '♖', 'Q': '♕', 'K': '♔', // 白棋
  'p': '♟', 'n': '♞', 'b': '♝', 'r': '♜', 'q': '♛', 'k': '♚', // 黑棋
};

export default function TestPage() {
  const [game, setGame] = useState(new Chess());
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [possibleMoves, setPossibleMoves] = useState<string[]>([]);
  
  // 引入 AI
  const { bestMove, isSearching, evaluatePosition, resetGame } = useStockfish({
    depth: 24,
    skillLevel: 20,
  });

  // 监听 AI 走棋
  useEffect(() => {
    if (bestMove) {
      const from = bestMove.substring(0, 2);
      const to = bestMove.substring(2, 4);
      safeMove({ from, to, promotion: 'q' });
    }
  }, [bestMove]);

  // 安全走棋函数
  const safeMove = (move: { from: string; to: string; promotion?: string }) => {
    try {
      const gameCopy = new Chess(game.fen());
      const result = gameCopy.move(move);
      if (result) {
        setGame(gameCopy);
        // 只有当是玩家走棋导致的变化时，才触发 AI
        if (gameCopy.turn() === 'b') { // 假设玩家执白
           setTimeout(() => evaluatePosition(gameCopy.fen()), 500);
        }
        return true;
      }
    } catch (e) { return false; }
    return false;
  };

  // 处理点击格子
  const handleSquareClick = (square: string) => {
    // 如果 AI 正在思考，禁止操作
    if (isSearching) return;

    // 1. 如果已经选中了一个格子，尝试移动到新点击的格子
    if (selectedSquare) {
      const moveSuccess = safeMove({
        from: selectedSquare,
        to: square,
        promotion: 'q'
      });

      if (moveSuccess) {
        setSelectedSquare(null);
        setPossibleMoves([]);
        return;
      }
    }

    // 2. 如果没移动成功（可能是点击了非法位置，或者是重新选择棋子）
    const piece = game.get(square as any);
    
    // 只有点击自己的棋子才算选中
    if (piece && piece.color === game.turn()) {
      setSelectedSquare(square);
      // 计算高亮提示
      const moves = game.moves({ square: square as any, verbose: true });
      setPossibleMoves(moves.map(m => m.to));
    } else {
      // 点击空白或对方棋子，取消选中
      setSelectedSquare(null);
      setPossibleMoves([]);
    }
  };

  // 渲染棋盘格
  const renderBoard = () => {
    const board = [];
    const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
    const ranks = ['8', '7', '6', '5', '4', '3', '2', '1'];

    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const square = `${files[c]}${ranks[r]}`;
        const isLight = (r + c) % 2 === 0;
        const piece = game.get(square as any);
        const isSelected = selectedSquare === square;
        const isPossibleMove = possibleMoves.includes(square);

        board.push(
          <div
            key={square}
            onClick={() => handleSquareClick(square)}
            className={`
              w-[50px] h-[50px] flex items-center justify-center cursor-pointer relative
              ${isLight ? 'bg-[#eeeed2]' : 'bg-[#769656]'}
              ${isSelected ? '!bg-yellow-200' : ''}
            `}
          >
            {/* 2. 修改这里：使用 Emoji 文字渲染 */}
            {piece && (
              <span 
                className={`
                  text-4xl select-none pointer-events-none
                  ${piece.color === 'w' ? 'text-black' : 'text-black'} 
                  /* 注意：虽然 Emoji 自带颜色，但有些系统可能需要微调颜色，通常默认黑色即可 */
                `}
                style={{
                    // 稍微调整一下 Emoji 的位置，因为它们通常基线对齐
                    lineHeight: '1',
                    // 如果觉得黑棋太黑看不清，可以给个阴影
                    filter: 'drop-shadow(0 1px 1px rgba(0,0,0,0.2))'
                }}
              >
                {PIECE_EMOJIS[piece.color === 'w' ? piece.type.toUpperCase() : piece.type]}
              </span>
            )}
            
            {/* 可走路径提示点 */}
            {isPossibleMove && (
              <div className={`absolute w-3 h-3 rounded-full ${piece ? 'bg-red-500' : 'bg-green-800 opacity-30'}`} />
            )}
            
            {/* ...existing code... */}
          </div>
        );
      }
    }
    return board;
  };

  return (
    <div className="flex flex-col items-center min-h-screen bg-gray-100 pt-10">
      <h1 className="text-2xl font-bold mb-4">Stockfish</h1>
      
      {/* 棋盘容器 */}
      <div className="w-[400px] h-[400px] grid grid-cols-8 border-4 border-gray-800 shadow-xl select-none">
        {renderBoard()}
      </div>

      {/* 状态栏 */}
      <div className="mt-6 flex flex-col items-center gap-2">
        <div className="h-6 font-bold text-blue-600">
          {isSearching ? 'AI is thinking...' : game.isGameOver() ? 'Game Over' : 'Your Turn'}
        </div>
        <div className="flex gap-4">
          <button onClick={() => { setGame(new Chess()); resetGame(); }} className="px-4 py-2 bg-blue-500 text-white rounded">New Game</button>
          <button onClick={() => { game.undo(); game.undo(); setGame(new Chess(game.fen())); }} className="px-4 py-2 bg-gray-500 text-white rounded">Undo</button>
        </div>
      </div>
    </div>
  );
}