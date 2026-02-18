# Chess AI Platform

基于 Stockfish 17.1 WebAssembly 的纯前端国际象棋对弈与分析平台。

**部署地址**: https://chess.wangjue.me

---

## 技术栈

- **框架**: Next.js 16 (App Router) + TypeScript
- **引擎**: Stockfish 17.1 WASM (多线程版本，内置 NNUE)
- **样式**: Tailwind CSS v4
- **部署**: Vercel + Cloudflare DNS

---

## 核心功能需求

### 1. 页面结构

采用**单页应用**设计，通过内部状态切换显示：
- **Setup 模式**: 游戏配置界面
- **Gaming 模式**: 对弈界面
- **Analysis 模式**: 分析功能（在 Gaming 模式下开启）

### 2. 双方配置

| 配置项 | 说明 |
|--------|------|
| 身份 | 每方可独立选择 `Player` 或 `Stockfish` |
| AI 深度 | 范围 1-25，双方各自独立配置 |
| Skill Level | 锁定为 20（最强） |
| 时间 | Setup 时统一设置初始时间，Gaming 中可独立编辑 |

**关键规则**:
- 游戏中可随时切换任意一方的身份（Player ↔ AI）
- 游戏中可随时调整 AI 深度，但当前正在思考的 AI 使用旧深度，下一步才用新深度
- 双方都可以设为 Stockfish 且 Depth 可以不同

### 3. Analysis 模式

| 特性 | 说明 |
|------|------|
| 触发条件 | **仅当轮到 Player 时才分析**；AI 轮次不分析 |
| 双 AI 时 | Analysis Mode 按钮 disabled，hover 提示 "需要 Player 参与" |
| 输出内容 | Top 5 最佳走法 + 胜率百分比（WDL） |
| 切换中断 | 若 Player 切换为 AI，立即中断分析，清除分析 UI |
| Undo 锁定 | Analysis 模式下禁用 Undo，点击时提示 "先退出分析模式" |

**技术实现**:
- 使用 `setoption name MultiPV value 5` 一次性获取前 5 个变着
- 使用 `setoption name UCI_ShowWDL value true` 获取胜率数据
- WDL 是千分比，除以 10 即为百分比

### 4. Customize Board（自定义棋盘）

| 特性 | 说明 |
|------|------|
| 入口 | Setup 和 Gaming 模式下均可进入 |
| 初始状态 | 首次进入为标准初始棋盘；之后保留上次自定义结果 |
| 限制条件 | 双方各必须有且仅有 1 个国王 |
| 先手选择 | 自定义时可指定 White/Black 先走 |
| 重置 | "Reset to classic board" 按钮恢复标准棋盘 |
| 持久化 | 自定义棋盘配置保存到 localStorage |

### 5. Time Control（时间控制）

| 特性 | 说明 |
|------|------|
| 类型 | 总时间制（用完判负） |
| 加时 | 暂不实现 increment |
| 初始值 | Setup 时统一设置 |
| 编辑 | Gaming 中可独立编辑双方剩余时间 |
| AI 时间 | AI 思考需要消耗计时器时间（具体逻辑待议） |

### 6. Undo（悔棋）

| 场景 | Undo 步数 |
|------|-----------|
| Player vs AI，AI 刚走完 | 2 步（AI 的 + Player 的） |
| Player vs AI，Player 刚走完 | 1 步 |
| Player vs Player | 1 步 |
| AI vs AI | 2 步 |

**规则**: Undo 逻辑只看当前双方身份，不看历史走棋是谁下的。

### 7. 游戏结束

| 触发条件 | 说明 |
|----------|------|
| 将死 | 自动判断 |
| 逼和 | 自动判断 |
| 三次重复 | 自动判断 |
| 50 步规则 | 自动判断 |
| 时间耗尽 | 判负 |

结算 UI 待议。

### 8. 其他功能

- **Flip Board**: 翻转棋盘视角
- **Show Legal Moves**: 显示/隐藏合法走法提示
- **Theme**: 棋盘配色切换

### 9. Move History（历史记录与预览）

#### 9.1 核心功能

| 特性 | 说明 |
|------|------|
| 点击预览 | 点击任意历史走法，棋盘显示该局面（只读预览，不可落子）|
| 分开点击 | 每一行有两步（白/黑），分别可点击，高亮当前预览的那一步 |
| 返回当前 | 点击 "Back to Current Board" 按钮退出预览，恢复当前实际局面 |
| 重置到此 | 点击 "Reset Here" 按钮，将游戏状态回退到该历史局面 |

#### 9.2 状态变量

- `viewingMoveIndex: number | null`
  - `null` = 当前实际棋局（正常模式）
  - 数字 = 正在预览第 N 步后的局面（0 = 初始局面，1 = 第一步后，...）

#### 9.3 按钮逻辑

| 按钮 | 显示条件 | 行为 |
|------|----------|------|
| Back to Current Board | `viewingMoveIndex !== null` | 退出预览，`viewingMoveIndex = null` |
| Undo | `viewingMoveIndex === null` | 执行现有的悔棋逻辑 |
| Reset Here | `viewingMoveIndex !== null` | 将游戏回退到预览的历史局面，清除后续着法，若轮到 AI 则自动触发 AI 思考 |

**注意**: Undo 和 Reset Here 互斥显示，共用同一个按钮位置。

#### 9.4 Analysis Mode 与预览模式的关系

- 进入历史预览模式时，Analysis Mode **继续分析当前实际棋局**（当前轮到的一方）
- Analysis Mode 的 UI 显示不受历史预览影响
- 只有当 "Reset Here" 真正回退局面后，Analysis Mode 才会更新分析新的当前局面

#### 9.5 底部工具栏布局

工具栏按三段对齐不同面板：

| 对齐区域 | 按钮 |
|----------|------|
| Move History 面板 | Theme 选择器 |
| 棋盘区域 | [Back to Current Board] [Undo/Reset Here] [Show Legal Moves] [Flip Board] |
| Player Info 面板 | [Reset Game] [Analysis Opened/Closed] |

**布局规则**:
- 每个区域内的按钮居中对齐
- "Back to Current Board" 仅在预览模式下显示
- "Reset Game" 替代原来的 "Back to Setup"

---

## 技术约束

### CORS Headers（必须）

多线程 WASM 需要以下响应头（已在 `next.config.ts` 配置）：
```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

### Stockfish 配置

| 参数 | 值 |
|------|-----|
| Skill Level | 固定 20 |
| Depth | 用户可调 1-25 |
| NNUE | 启用内置版本 |
| MultiPV | 分析模式下设为 5 |
| UCI_ShowWDL | 分析模式下启用 |

---

## 项目结构

```
chess-ai-webasm/
├── app/                    # Next.js App Router
│   ├── page.tsx            # 主页面（单页应用）
│   └── layout.tsx          # 根布局
├── components/             # UI 组件
├── hooks/
│   └── useStockfish.ts     # Stockfish 通信 Hook
├── context/
│   └── GameContext.tsx     # 全局状态管理（待创建）
├── types/
│   └── game.ts             # TypeScript 类型定义（待创建）
├── public/engine/          # Stockfish WASM 文件
│   ├── stockfish-17.1-8e4d048.js
│   ├── stockfish-worker.js
│   └── stockfish-17.1-8e4d048-part-[0-5].wasm
└── next.config.ts          # CORS 配置
```

---

## 不做的事情

- ❌ 用户登录/注册
- ❌ 后端服务
- ❌ 时间加时（increment）
- ❌ 游戏进度刷新后恢复（仅保存自定义棋盘配置）
- ❌ 棋子拖拽（当前使用点击移动）

---

## 开发备忘

### 已知问题

- `react-chessboard` 与 React 19 不兼容，当前使用自绘 Emoji 棋盘
- 棋子 UI 后续可升级为 SVG 图片

### 待议事项

- AI 剩余时间少时的每步时间限制逻辑
- 游戏结束弹窗 UI
- Customize Board 的具体交互方式
- 移动端适配

### 待办事项

- ~~Analysis 模式按钮点击之后，有的时候过了一会才有出现~~ ✅ 已修复（流式显示渐进深度）
- ~~Undo 逻辑：在analysis模式下可行~~ ✅ 已实现
- ~~历史棋盘点击 & 左右箭头重做~~ ✅ 需求已整理到 9. Move History 章节
- 修改低于 level 20 的AI，目前都太强了
- UI: 游戏结束弹窗 
- UI: 按钮和整体布局 - 考虑添加 恢复到默认配置 按钮
- Customize Board 的具体交互方式
- 移动端适配

