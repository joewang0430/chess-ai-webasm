'use client';

import React, { useMemo, useState } from 'react';
import { Chess, Square, Move, PieceSymbol } from 'chess.js';
import { useGame } from '@/context/GameContext';
import { MoveRecord, PieceColor } from '@/types/game';

// ============================================
// 棋子 Unicode 映射
// ============================================
const PIECE_SYMBOLS: Record<string, string> = {
  wK: '♔', wQ: '♕', wR: '♖', wB: '♗', wN: '♘', wP: '♙',
  bK: '♚', bQ: '♛', bR: '♜', bB: '♝', bN: '♞', bP: '♟',
};

// ============================================
// 棋盘主题配色
// ============================================
const THEME_COLORS: Record<string, { light: string; dark: string; highlight: string; legal: string }> = {
  green: { light: '#eeeed2', dark: '#769656', highlight: '#f7f769', legal: '#00ff0040' },
  blue: { light: '#dee3e6', dark: '#8ca2ad', highlight: '#f7f769', legal: '#00ff0040' },
  brown: { light: '#f0d9b5', dark: '#b58863', highlight: '#f7f769', legal: '#00ff0040' },
  purple: { light: '#e8d0ff', dark: '#9070b0', highlight: '#f7f769', legal: '#00ff0040' },
  gray: { light: '#e0e0e0', dark: '#808080', highlight: '#f7f769', legal: '#00ff0040' },
};

// ============================================
// 格子坐标转换
// ============================================
function indexToSquare(row: number, col: number, flipped: boolean): Square {
  const actualRow = flipped ? row : 7 - row;
  const actualCol = flipped ? 7 - col : col;
  const file = 'abcdefgh'[actualCol];
  const rank = actualRow + 1;
  return `${file}${rank}` as Square;
}

// ============================================
// 升变选择弹窗
// ============================================
interface PromotionDialogProps {
  color: PieceColor;
  onSelect: (piece: PieceSymbol) => void;
  onCancel: () => void;
  theme: string;
}

function PromotionDialog({ color, onSelect, onCancel, theme }: PromotionDialogProps) {
  const pieces: PieceSymbol[] = ['q', 'r', 'b', 'n'];
  const colors = THEME_COLORS[theme] || THEME_COLORS.green;

  return (
    <div 
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={onCancel}
    >
      <div 
        className="bg-[#2a2a2a] rounded-lg p-4 flex gap-2"
        onClick={(e) => e.stopPropagation()}
      >
        <span className="text-gray-400 mr-2 self-center">Promote to:</span>
        {pieces.map((p) => (
          <button
            key={p}
            onClick={() => onSelect(p)}
            className="w-14 h-14 flex items-center justify-center text-4xl rounded hover:opacity-80 transition"
            style={{ background: colors.light }}
          >
            {PIECE_SYMBOLS[`${color}${p.toUpperCase()}`]}
          </button>
        ))}
      </div>
    </div>
  );
}

// ============================================
// 主组件: ChessBoard
// ============================================
export default function ChessBoard() {
  const { state, makeMove, isCurrentPlayerAI } = useGame();
  const theme = state.settings.theme;
  const flipped = state.settings.boardFlipped;
  const showLegalMoves = state.settings.showLegalMoves;
  const colors = THEME_COLORS[theme] || THEME_COLORS.green;

  // 预览模式: 如果 viewingMoveIndex 不为 null，显示历史局面
  const isPreviewMode = state.viewingMoveIndex !== null;
  
  // 计算要显示的 FEN
  const displayFen = useMemo(() => {
    if (state.viewingMoveIndex === null) {
      return state.fen; // 当前实际局面
    }
    // 预览历史局面
    const targetMove = state.moveHistory[state.viewingMoveIndex];
    return targetMove ? targetMove.fenAfter : state.fen;
  }, [state.viewingMoveIndex, state.moveHistory, state.fen]);

  // 选中的格子
  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);
  
  // 升变状态
  const [promotionMove, setPromotionMove] = useState<{ from: Square; to: Square } | null>(null);

  // 解析显示的棋局 (预览或当前)
  const chess = useMemo(() => new Chess(displayFen), [displayFen]);

  // 获取合法走法 (仅在非预览模式下有效)
  const legalMoves = useMemo(() => {
    if (!selectedSquare || isPreviewMode) return [];
    return chess.moves({ square: selectedSquare, verbose: true });
  }, [chess, selectedSquare, isPreviewMode]);

  // 合法目标格集合
  const legalTargets = useMemo(() => {
    return new Set(legalMoves.map((m) => m.to));
  }, [legalMoves]);

  // 进入/离开预览模式时清除选中
  React.useEffect(() => {
    setSelectedSquare(null);
    setPromotionMove(null);
  }, [isPreviewMode]);

  // ============================================
  // 处理格子点击
  // ============================================
  const handleSquareClick = (square: Square) => {
    // 如果是预览模式、游戏结束或是 AI 回合，不响应
    if (isPreviewMode || state.gameResult || isCurrentPlayerAI) return;

    const piece = chess.get(square);

    // 如果已选中一个棋子
    if (selectedSquare) {
      // 点击了相同格子，取消选中
      if (square === selectedSquare) {
        setSelectedSquare(null);
        return;
      }

      // 点击了合法目标
      if (legalTargets.has(square)) {
        // 检查是否是兵升变
        const movingPiece = chess.get(selectedSquare);
        if (movingPiece?.type === 'p') {
          const targetRank = parseInt(square[1]);
          if ((movingPiece.color === 'w' && targetRank === 8) ||
              (movingPiece.color === 'b' && targetRank === 1)) {
            setPromotionMove({ from: selectedSquare, to: square });
            return;
          }
        }

        // 执行走法
        executeMove(selectedSquare, square);
        return;
      }

      // 点击了自己的其他棋子，切换选中
      if (piece && piece.color === chess.turn()) {
        setSelectedSquare(square);
        return;
      }

      // 点击了空格或对方棋子但不是合法走法，取消选中
      setSelectedSquare(null);
      return;
    }

    // 未选中状态：点击了自己的棋子
    if (piece && piece.color === chess.turn()) {
      setSelectedSquare(square);
    }
  };

  // ============================================
  // 执行走法
  // ============================================
  const executeMove = (from: Square, to: Square, promotion?: PieceSymbol) => {
    try {
      const testChess = new Chess(state.fen);
      const result = testChess.move({ from, to, promotion });

      if (result) {
        const moveRecord: MoveRecord = {
          san: result.san,
          uci: from + to + (promotion || ''),
          color: result.color as PieceColor,
          fenBefore: state.fen,
          fenAfter: testChess.fen(),
          timestamp: Date.now(),
        };

        makeMove(moveRecord);
        setSelectedSquare(null);
        setPromotionMove(null);
      }
    } catch (e) {
      console.error('Move error:', e);
      setSelectedSquare(null);
      setPromotionMove(null);
    }
  };

  // ============================================
  // 处理升变选择
  // ============================================
  const handlePromotion = (piece: PieceSymbol) => {
    if (promotionMove) {
      executeMove(promotionMove.from, promotionMove.to, piece);
    }
  };

  // ============================================
  // 渲染格子
  // ============================================
  const renderSquare = (row: number, col: number) => {
    const square = indexToSquare(row, col, flipped);
    const isLight = (row + col) % 2 === 1;
    const piece = chess.get(square);
    
    const isSelected = square === selectedSquare;
    const isLegalTarget = showLegalMoves && legalTargets.has(square);
    
    // 计算上一步高亮：预览模式取对应历史走法，否则取最新走法
    const lastMoveIndex = state.viewingMoveIndex !== null 
      ? state.viewingMoveIndex 
      : state.moveHistory.length - 1;
    const lastMove = lastMoveIndex >= 0 ? state.moveHistory[lastMoveIndex] : null;
    const isLastMove = lastMove && (
      lastMove.uci.startsWith(square) ||
      lastMove.uci.substring(2, 4) === square
    );

    // 背景色
    let bgColor = isLight ? colors.light : colors.dark;
    if (isSelected || isLastMove) {
      bgColor = colors.highlight;
    }

    return (
      <div
        key={`${row}-${col}`}
        className="relative flex items-center justify-center cursor-pointer"
        style={{ 
          width: '100%', 
          paddingBottom: '100%',
          background: bgColor,
        }}
        onClick={() => handleSquareClick(square)}
      >
        {/* 合法走法提示 */}
        {isLegalTarget && (
          <div 
            className="absolute inset-0 flex items-center justify-center pointer-events-none"
          >
            {piece ? (
              // 可吃子：显示边框
              <div 
                className="absolute inset-0 border-4 rounded-full opacity-60"
                style={{ borderColor: '#ff0000' }}
              />
            ) : (
              // 空格：显示圆点
              <div 
                className="w-1/3 h-1/3 rounded-full opacity-60"
                style={{ background: '#666' }}
              />
            )}
          </div>
        )}

        {/* 棋子 */}
        {piece && (
          <span 
            className="absolute inset-0 flex items-center justify-center text-[4.5rem] select-none"
            style={{
              textShadow: piece.color === 'w' 
                ? '0 1px 2px rgba(0,0,0,0.5)' 
                : '0 1px 1px rgba(255,255,255,0.3)',
            }}
          >
            {PIECE_SYMBOLS[`${piece.color}${piece.type.toUpperCase()}`]}
          </span>
        )}

        {/* 坐标标注 */}
        {col === 0 && (
          <span 
            className="absolute top-1 left-1 text-xs font-bold pointer-events-none"
            style={{ color: isLight ? colors.dark : colors.light }}
          >
            {flipped ? row + 1 : 8 - row}
          </span>
        )}
        {row === 7 && (
          <span 
            className="absolute bottom-1 right-1 text-xs font-bold pointer-events-none"
            style={{ color: isLight ? colors.dark : colors.light }}
          >
            {flipped ? 'hgfedcba'[col] : 'abcdefgh'[col]}
          </span>
        )}
      </div>
    );
  };

  return (
    <>
      <div 
        className="grid grid-cols-8 rounded-lg overflow-hidden shadow-2xl"
        style={{ width: '500px', height: '500px' }}
      >
        {Array.from({ length: 8 }, (_, row) =>
          Array.from({ length: 8 }, (_, col) => renderSquare(row, col))
        )}
      </div>

      {/* 升变对话框 */}
      {promotionMove && (
        <PromotionDialog
          color={chess.turn() as PieceColor}
          onSelect={handlePromotion}
          onCancel={() => setPromotionMove(null)}
          theme={theme}
        />
      )}
    </>
  );
}
