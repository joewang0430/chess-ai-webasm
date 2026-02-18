'use client';

import React, { createContext, useContext, useReducer, ReactNode, useCallback } from 'react';
import {
  GameState,
  GameAction,
  GameSettings,
  PlayerConfig,
  MoveRecord,
  AnalysisData,
  GameResult,
  PieceColor,
  PlayerType,
  INITIAL_FEN,
  DEFAULT_TIME,
  DEFAULT_DEPTH,
} from '@/types/game';

// ============================================
// 初始状态
// ============================================

const initialPlayerConfig = (type: PlayerType = 'player'): PlayerConfig => ({
  type,
  aiConfig: { depth: DEFAULT_DEPTH },
  timeRemaining: DEFAULT_TIME,
});

const initialSettings: GameSettings = {
  theme: 'green',
  showLegalMoves: true,
  boardFlipped: false,
};

const initialState: GameState = {
  phase: 'setup',
  fen: INITIAL_FEN,
  turn: 'w',
  white: initialPlayerConfig('player'),
  black: initialPlayerConfig('stockfish'),
  moveHistory: [],
  settings: initialSettings,
  analysis: null,
  isAnalysisMode: false,
  isCustomizing: false,
  gameResult: null,
  isAIThinking: false,
};

// ============================================
// Reducer
// ============================================

function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'SET_PHASE':
      return { ...state, phase: action.phase };

    case 'SET_FEN':
      return { ...state, fen: action.fen };

    case 'SET_TURN':
      return { ...state, turn: action.turn };

    case 'SET_PLAYER_TYPE': {
      const playerKey = action.color === 'w' ? 'white' : 'black';
      return {
        ...state,
        [playerKey]: {
          ...state[playerKey],
          type: action.playerType,
        },
      };
    }

    case 'SET_AI_DEPTH': {
      const playerKey = action.color === 'w' ? 'white' : 'black';
      return {
        ...state,
        [playerKey]: {
          ...state[playerKey],
          aiConfig: { ...state[playerKey].aiConfig, depth: action.depth },
        },
      };
    }

    case 'SET_TIME': {
      const playerKey = action.color === 'w' ? 'white' : 'black';
      return {
        ...state,
        [playerKey]: {
          ...state[playerKey],
          timeRemaining: action.time,
        },
      };
    }

    case 'DECREMENT_TIME': {
      const playerKey = action.color === 'w' ? 'white' : 'black';
      const newTime = Math.max(0, state[playerKey].timeRemaining - action.delta);
      return {
        ...state,
        [playerKey]: {
          ...state[playerKey],
          timeRemaining: newTime,
        },
      };
    }

    case 'ADD_MOVE':
      return {
        ...state,
        moveHistory: [...state.moveHistory, action.move],
      };

    case 'UNDO_MOVES': {
      const newHistory = state.moveHistory.slice(0, -action.count);
      const lastMove = newHistory[newHistory.length - 1];
      const newFen = lastMove ? lastMove.fenAfter : INITIAL_FEN;
      // 根据 FEN 判断当前走棋方
      const turnFromFen = newFen.split(' ')[1] as PieceColor;
      return {
        ...state,
        moveHistory: newHistory,
        fen: newFen,
        turn: turnFromFen,
      };
    }

    case 'SET_SETTINGS':
      return {
        ...state,
        settings: { ...state.settings, ...action.settings },
      };

    case 'SET_ANALYSIS_MODE':
      return {
        ...state,
        isAnalysisMode: action.enabled,
        // 关闭分析模式时清除分析数据
        analysis: action.enabled ? state.analysis : null,
      };

    case 'SET_ANALYSIS_DATA':
      return { ...state, analysis: action.data };

    case 'SET_CUSTOMIZING':
      return { ...state, isCustomizing: action.enabled };

    case 'SET_GAME_RESULT':
      return { ...state, gameResult: action.result };

    case 'SET_AI_THINKING':
      return { ...state, isAIThinking: action.isThinking };

    case 'RESET_GAME':
      return {
        ...initialState,
        // 保留设置
        settings: state.settings,
        // 保留自定义棋盘（如果有）
        // 如果需要保留自定义 FEN，可以在这里处理
      };

    case 'START_GAME':
      return {
        ...state,
        phase: 'playing',
        gameResult: null,
        moveHistory: [],
        isAnalysisMode: false,
        analysis: null,
        isCustomizing: false,
      };

    default:
      return state;
  }
}

// ============================================
// Context 定义
// ============================================

interface GameContextType {
  state: GameState;
  dispatch: React.Dispatch<GameAction>;
  
  // 便捷方法
  startGame: () => void;
  resetGame: () => void;
  setPlayerType: (color: PieceColor, type: PlayerType) => void;
  setAIDepth: (color: PieceColor, depth: number) => void;
  setTime: (color: PieceColor, time: number) => void;
  decrementTime: (color: PieceColor, delta: number) => void;
  makeMove: (move: MoveRecord) => void;
  undoMove: () => void;
  toggleAnalysisMode: () => void;
  setAnalysisData: (data: AnalysisData | null) => void;
  toggleCustomizing: () => void;
  setFen: (fen: string) => void;
  setGameResult: (result: GameResult | null) => void;
  setAIThinking: (isThinking: boolean) => void;
  flipBoard: () => void;
  toggleLegalMoves: () => void;
  
  // 计算属性
  currentPlayer: PlayerConfig;
  isCurrentPlayerAI: boolean;
  canUndo: boolean;
  canAnalyze: boolean;
}

const GameContext = createContext<GameContextType | null>(null);

// ============================================
// Provider 组件
// ============================================

export function GameProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(gameReducer, initialState);

  // --- 便捷方法 ---

  const startGame = useCallback(() => {
    dispatch({ type: 'START_GAME' });
  }, []);

  const resetGame = useCallback(() => {
    dispatch({ type: 'RESET_GAME' });
  }, []);

  const setPlayerType = useCallback((color: PieceColor, type: PlayerType) => {
    dispatch({ type: 'SET_PLAYER_TYPE', color, playerType: type });
  }, []);

  const setAIDepth = useCallback((color: PieceColor, depth: number) => {
    dispatch({ type: 'SET_AI_DEPTH', color, depth });
  }, []);

  const setTime = useCallback((color: PieceColor, time: number) => {
    dispatch({ type: 'SET_TIME', color, time });
  }, []);

  const decrementTime = useCallback((color: PieceColor, delta: number) => {
    dispatch({ type: 'DECREMENT_TIME', color, delta });
  }, []);

  const makeMove = useCallback((move: MoveRecord) => {
    dispatch({ type: 'ADD_MOVE', move });
    dispatch({ type: 'SET_FEN', fen: move.fenAfter });
    // 根据新 FEN 更新走棋方
    const newTurn = move.fenAfter.split(' ')[1] as PieceColor;
    dispatch({ type: 'SET_TURN', turn: newTurn });
  }, []);

  const undoMove = useCallback(() => {
    // 计算需要撤销的步数
    const whiteType = state.white.type;
    const blackType = state.black.type;
    
    let undoCount = 1;
    
    if (whiteType === 'stockfish' && blackType === 'stockfish') {
      // AI vs AI: 撤销 2 步
      undoCount = 2;
    } else if (whiteType === 'player' && blackType === 'player') {
      // Player vs Player: 撤销 1 步
      undoCount = 1;
    } else {
      // Player vs AI
      const currentPlayerIsAI = state.turn === 'w' 
        ? whiteType === 'stockfish' 
        : blackType === 'stockfish';
      
      // 当前是 AI 的回合，说明上一步是 AI 走的，撤销 2 步
      // 当前是 Player 的回合，说明上一步是 Player 走的，撤销 1 步
      undoCount = currentPlayerIsAI ? 1 : 2;
    }
    
    // 确保不会撤销超过历史长度
    undoCount = Math.min(undoCount, state.moveHistory.length);
    
    if (undoCount > 0) {
      dispatch({ type: 'UNDO_MOVES', count: undoCount });
    }
  }, [state.white.type, state.black.type, state.turn, state.moveHistory.length]);

  const toggleAnalysisMode = useCallback(() => {
    dispatch({ type: 'SET_ANALYSIS_MODE', enabled: !state.isAnalysisMode });
  }, [state.isAnalysisMode]);

  const setAnalysisData = useCallback((data: AnalysisData | null) => {
    dispatch({ type: 'SET_ANALYSIS_DATA', data });
  }, []);

  const toggleCustomizing = useCallback(() => {
    dispatch({ type: 'SET_CUSTOMIZING', enabled: !state.isCustomizing });
  }, [state.isCustomizing]);

  const setFen = useCallback((fen: string) => {
    dispatch({ type: 'SET_FEN', fen });
    // 同步更新走棋方
    const turn = fen.split(' ')[1] as PieceColor;
    dispatch({ type: 'SET_TURN', turn });
  }, []);

  const setGameResult = useCallback((result: GameResult | null) => {
    dispatch({ type: 'SET_GAME_RESULT', result });
  }, []);

  const setAIThinking = useCallback((isThinking: boolean) => {
    dispatch({ type: 'SET_AI_THINKING', isThinking });
  }, []);

  const flipBoard = useCallback(() => {
    dispatch({ type: 'SET_SETTINGS', settings: { boardFlipped: !state.settings.boardFlipped } });
  }, [state.settings.boardFlipped]);

  const toggleLegalMoves = useCallback(() => {
    dispatch({ type: 'SET_SETTINGS', settings: { showLegalMoves: !state.settings.showLegalMoves } });
  }, [state.settings.showLegalMoves]);

  // --- 计算属性 ---

  const currentPlayer = state.turn === 'w' ? state.white : state.black;
  const isCurrentPlayerAI = currentPlayer.type === 'stockfish';
  const canUndo = state.moveHistory.length > 0 && !state.isAnalysisMode && !state.isAIThinking && !state.gameResult;
  
  // 只有当前玩家是 Player 时才能分析
  // 如果双方都是 AI，不能分析
  const canAnalyze = state.phase === 'playing' && !state.gameResult;

  const contextValue: GameContextType = {
    state,
    dispatch,
    startGame,
    resetGame,
    setPlayerType,
    setAIDepth,
    setTime,
    decrementTime,
    makeMove,
    undoMove,
    toggleAnalysisMode,
    setAnalysisData,
    toggleCustomizing,
    setFen,
    setGameResult,
    setAIThinking,
    flipBoard,
    toggleLegalMoves,
    currentPlayer,
    isCurrentPlayerAI,
    canUndo,
    canAnalyze,
  };

  return (
    <GameContext.Provider value={contextValue}>
      {children}
    </GameContext.Provider>
  );
}

// ============================================
// Hook
// ============================================

export function useGame() {
  const context = useContext(GameContext);
  if (!context) {
    throw new Error('useGame must be used within a GameProvider');
  }
  return context;
}
