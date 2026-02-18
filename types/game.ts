// ============================================
// Chess AI Platform - 类型定义
// ============================================

// --- 基础类型 ---

/** 棋子颜色 */
export type PieceColor = 'w' | 'b';

/** 玩家身份类型 */
export type PlayerType = 'player' | 'stockfish';

/** 游戏阶段 */
export type GamePhase = 'setup' | 'playing';

/** 游戏结束原因 */
export type GameOverReason = 
  | 'checkmate'      // 将死
  | 'stalemate'      // 逼和
  | 'threefold'      // 三次重复
  | 'fifty-move'     // 50步规则
  | 'timeout'        // 超时
  | 'resignation';   // 认输

// --- AI 配置 ---

export interface AIConfig {
  /** 搜索深度 (1-25) */
  depth: number;
}

// --- 玩家配置 ---

export interface PlayerConfig {
  /** 玩家类型 */
  type: PlayerType;
  /** AI 配置 (仅当 type 为 'stockfish' 时有效) */
  aiConfig: AIConfig;
  /** 剩余时间 (毫秒) */
  timeRemaining: number;
}

// --- 分析数据 ---

export interface AnalysisMove {
  /** 走法 (UCI 格式, 如 "e2e4") */
  move: string;
  /** 评分 (厘兵, 正数白方优) */
  score: number;
  /** 将杀步数 (如果是将杀局面) */
  mate: number | null;
  /** 胜率百分比 */
  winChance: number;
  /** 和棋率百分比 */
  drawChance: number;
  /** 负率百分比 */
  lossChance: number;
  /** 主要变着 */
  pv: string[];
}

export interface AnalysisData {
  /** 当前搜索深度 */
  depth: number;
  /** Top N 最佳走法 */
  topMoves: AnalysisMove[];
  /** 是否正在分析 */
  isAnalyzing: boolean;
}

// --- 走棋历史 ---

export interface MoveRecord {
  /** 走法 (SAN 格式, 如 "e4", "Nf3") */
  san: string;
  /** 走法 (UCI 格式, 如 "e2e4") */
  uci: string;
  /** 走棋方 */
  color: PieceColor;
  /** 走棋前的 FEN */
  fenBefore: string;
  /** 走棋后的 FEN */
  fenAfter: string;
  /** 走棋时的时间戳 */
  timestamp: number;
}

// --- 游戏设置 ---

export interface GameSettings {
  /** 棋盘主题 */
  theme: BoardTheme;
  /** 是否显示合法走法提示 */
  showLegalMoves: boolean;
  /** 是否翻转棋盘 */
  boardFlipped: boolean;
}

export type BoardTheme = 'green' | 'blue' | 'brown' | 'purple' | 'gray';

// --- 游戏结果 ---

export interface GameResult {
  /** 胜方 (null 表示和棋) */
  winner: PieceColor | null;
  /** 结束原因 */
  reason: GameOverReason;
}

// --- 主游戏状态 ---

export interface GameState {
  /** 游戏阶段 */
  phase: GamePhase;
  
  /** 当前棋盘 FEN */
  fen: string;
  
  /** 当前走棋方 */
  turn: PieceColor;
  
  /** 白方配置 */
  white: PlayerConfig;
  
  /** 黑方配置 */
  black: PlayerConfig;
  
  /** 走棋历史 */
  moveHistory: MoveRecord[];
  
  /** 游戏设置 */
  settings: GameSettings;
  
  /** 分析数据 (仅在分析模式下有效) */
  analysis: AnalysisData | null;
  
  /** 分析模式是否开启 */
  isAnalysisMode: boolean;
  
  /** 是否处于自定义棋盘模式 */
  isCustomizing: boolean;
  
  /** 游戏结果 (游戏结束时填充) */
  gameResult: GameResult | null;
  
  /** AI 是否正在思考 */
  isAIThinking: boolean;
  
  /** 正在预览的历史走法索引 (null = 当前实际棋局) */
  viewingMoveIndex: number | null;
}

// --- Action 类型 (用于 Reducer) ---

export type GameAction =
  | { type: 'SET_PHASE'; phase: GamePhase }
  | { type: 'SET_FEN'; fen: string }
  | { type: 'SET_TURN'; turn: PieceColor }
  | { type: 'SET_PLAYER_TYPE'; color: PieceColor; playerType: PlayerType }
  | { type: 'SET_AI_DEPTH'; color: PieceColor; depth: number }
  | { type: 'SET_TIME'; color: PieceColor; time: number }
  | { type: 'DECREMENT_TIME'; color: PieceColor; delta: number }
  | { type: 'ADD_MOVE'; move: MoveRecord }
  | { type: 'UNDO_MOVES'; count: number }
  | { type: 'SET_SETTINGS'; settings: Partial<GameSettings> }
  | { type: 'SET_ANALYSIS_MODE'; enabled: boolean }
  | { type: 'SET_ANALYSIS_DATA'; data: AnalysisData | null }
  | { type: 'SET_CUSTOMIZING'; enabled: boolean }
  | { type: 'SET_GAME_RESULT'; result: GameResult | null }
  | { type: 'SET_AI_THINKING'; isThinking: boolean }
  | { type: 'SET_VIEWING_MOVE_INDEX'; index: number | null }
  | { type: 'RESET_TO_MOVE'; index: number }
  | { type: 'RESET_GAME' }
  | { type: 'START_GAME' };

// --- 常量 ---

/** 标准国际象棋初始 FEN */
export const INITIAL_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

/** 默认游戏时间 (15 分钟, 毫秒) */
export const DEFAULT_TIME = 15 * 60 * 1000;

/** 默认 AI 深度 */
export const DEFAULT_DEPTH = 15;

/** 分析模式深度 */
export const ANALYSIS_DEPTH = 25;

/** 最大 AI 深度 */
export const MAX_DEPTH = 25;

/** 最小 AI 深度 */
export const MIN_DEPTH = 1;

/** 分析模式显示的走法数量 */
export const ANALYSIS_MULTI_PV = 5;

/** AI 最小走棋延迟 (毫秒) */
export const AI_MIN_MOVE_TIME = 200;
