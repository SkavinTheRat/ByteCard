# AGENTS.md — ByteCard（字节卡）项目宪法

> 本文件放在仓库根目录。Codex 每次会话会自动读取它，因此这里只写**长期有效的约束**，
> 不写具体任务；具体任务在 `prompts/` 里逐阶段下达。

## 1. 项目是什么

**ByteCard（字节卡）** —— 一个模仿「百词斩」交互的**移动端碎片化学习 App**，用来记忆计算机知识。
核心体验：打开就学，一次 3~10 分钟，刷卡 → 作答 → 看解析 → 按遗忘曲线复习。

目标用户：备考 408（数据结构 / 计算机组成原理 / 操作系统 / 计算机网络）的本科生，
以及想补齐 AI / Agent 常识的开发者。中文界面。

## 2. 技术栈（已锁定，不得擅自替换）

| 关注点 | 选型 | 说明 |
| --- | --- | --- |
| 框架 | React Native + **Expo**（最新稳定 SDK） | 用 `npx create-expo-app` 生成，不要手搭 RN CLI |
| 语言 | **TypeScript**，`strict: true` | 禁止 `any`；确需逃逸用 `unknown` + 类型守卫 |
| 路由 | **expo-router**（file-based） | 页面放 `app/`，不要引入 react-navigation 手写配置 |
| 状态 | **Zustand** | 禁止 Redux、MobX、Context 全局 store |
| 存储 | **expo-sqlite**（异步 API） | 结构化数据全走 SQLite，不用 AsyncStorage 存业务数据 |
| 动画 | **react-native-reanimated** + **react-native-gesture-handler** | 卡片滑动/翻面/答对答错反馈 |
| SVG / 图表 | **react-native-svg** | 统计图表自己画小组件，不引图表库 |
| 图标 | `@expo/vector-icons`（Ionicons 为主） | |
| 字体 | `expo-font` + `@expo-google-fonts/jetbrains-mono`、`@expo-google-fonts/inter` | 等宽字体用于代码/数字，Inter 用于正文 |
| 触感 | `expo-haptics` | 答对/答错短震动 |
| 其他 | `react-native-safe-area-context`、`expo-haptics`、`expo-clipboard` | |

**任何新增依赖都必须：先说明理由 → 等用户确认 → 再 `npm install`。** 不允许静默装包。

包管理器统一用 **npm**，不要混用 yarn / pnpm / bun。

## 3. 目录结构（改动前先看这里）

```
bytecard/
├── app/                        # expo-router 路由（页面 = 文件）
│   ├── _layout.tsx             # 根布局：字体加载、DB 初始化、主题 Provider
│   ├── (tabs)/                 # 底部 4 个 Tab
│   │   ├── _layout.tsx
│   │   ├── index.tsx           # 今日（首页：进度环 + 开始学习）
│   │   ├── study.tsx           # 刷卡学习（核心页，全屏无 Tab 也可）
│   │   ├── stats.tsx           # 统计 / 打卡
│   │   └── me.tsx              # 我的：设置、AI Key、题库管理、关于
│   └── card/[id].tsx           # 单卡详情（可选：错题回看）
├── src/
│   ├── theme/
│   │   ├── tokens.ts           # 唯一色板/字号/间距来源（见 spec/03-design-tokens.md）
│   │   └── index.ts
│   ├── db/
│   │   ├── schema.ts           # 建表 SQL + 版本号
│   │   ├── migrate.ts          # 迁移执行器
│   │   ├── seed.ts             # 内置题库种子数据装载
│   │   └── repository.ts       # 所有 SQL 只出现在这里，对外暴露纯函数接口
│   ├── srs/
│   │   ├── sm2.ts              # 间隔重复算法（纯函数，可单测）
│   │   └── queue.ts            # 今日队列生成（新卡 + 到期复习）
│   ├── ai/
│   │   ├── provider.ts         # AIProvider 接口 + 工厂
│   │   ├── mock.ts             # 离线假实现
│   │   └── deepseek.ts         # 真实现（OpenAI 兼容 /chat/completions）
│   ├── store/                  # Zustand stores
│   │   ├── sessionStore.ts     # 当前刷卡会话
│   │   └── settingsStore.ts
│   ├── cards/                  # ★ 题型注册表（唯一允许扩展题型的地方）
│   │   ├── registry.ts         # CardDefinition 接口 + Map 注册表 + 查表
│   │   ├── index.ts            # 集中注册（加题型只在这里加一行 import）
│   │   └── types/
│   │       ├── single/         # definition.ts（含 grade）+ AnswerView.tsx
│   │       ├── multi/
│   │       ├── fill/
│   │       └── judge/          # 阶段 10 新增
│   ├── components/             # 可复用 UI（Card、OptionButton、ProgressRing…）
│   ├── i18n/zh.ts              # 所有用户可见中文文案集中在这里
│   └── utils/                  # 日期、格式化、随机抽样
├── assets/
│   └── data/decks.json         # 内置题库（见 spec/02-deck-schema.md）
└── __tests__/                  # Jest：sm2、queue、repository 的纯逻辑单测
```

**开发期工具（不进 App 安装包，也不参与 `tsc --noEmit` 的产物）：**

```
tools/gen-cards/                # 阶段 8：离线题库生产线
├── syllabus.json               # 知识点清单（唯一内容真相来源）
├── prompt.ts                   # 出题 prompt 模板（与 src/ai/prompts.ts 共用）
├── generate.mjs                # 批量生成 → out/
├── validate.mjs                # 校验（结构/去重/废选项/难度分布）
├── merge.mjs                   # 合并进 assets/data/cards/
└── REVIEW.md                   # 人工抽查流程与记录
```

**分层铁律**：`组件 → store/hooks → repository → SQLite`。
组件里**不允许**出现 `db.execAsync` / `SELECT` 字样；SQL 只允许出现在 `src/db/`。

## 4. 代码规范

- 函数组件 + Hooks，**禁止 class 组件**（错误边界除外，用 `ErrorBoundary` 也行）。
- 样式用 `StyleSheet.create`；**颜色、字号、间距、圆角一律取自 `src/theme/tokens.ts`**，
  业务代码里出现 `#RRGGBB` 字面量视为错误。
- 单个文件不超过 250 行，超了就拆组件。
- 所有用户可见字符串走 `src/i18n/zh.ts`，先单语言但集中管理（便于以后加英文）。
- 异步函数必须处理失败分支；catch 里不要静默 `console.log` 完事，要给出用户可见的降级提示。
- 注释只写「为什么」，不写「是什么」。中文注释可以。
- 导出统一用命名导出（`export function` / `export const`），组件文件可 `export default`。

## 5. 设计风格（硬性）

**深色极客风。** 深色底 + 霓虹青绿点缀 + 等宽字体呈现代码与数字。
完整 token 见 `spec/03-design-tokens.md`，实现时必须逐项对齐，不要自行发挥配色。

要点：卡片是「终端窗口」的隐喻——深灰底、细边框、顶部一条标题栏带三个点。

**两条来自真机的硬约束（Android / ColorOS 上必然踩到）：**

- 凡是容纳文字的行（选项按钮、列表行、Tab、底部主按钮）用 **`minHeight`**，
  **禁止 `height`**。用户在系统里可能把字体缩放到 1.3 倍（ColorOS 尤其常见，
  且有「字体大小」和「显示大小」两个独立开关），固定高度会裁字。
- 底部元素的位置必须来自 **`useSafeAreaInsets().bottom`**，禁止写死 `paddingBottom`。
  Android 15+ 强制 edge-to-edge，ColorOS 的手势条/三键导航高度与原生不同，
  写死就会挡住「下一张」按钮。

完整的安卓适配清单见 `prompts/12-android-coloros.md`。

## 6. 命令

```bash
npm install                 # 安装依赖
npx expo start              # 启动开发服务器（手机 Expo Go 扫码）
npx tsc --noEmit            # 类型检查（每次改完必须跑）
npm test                    # 单元测试
```

## 7. 每次交付前自检（必须做，做不到就说明原因）

1. `npx tsc --noEmit` 零错误。
2. 没有引入 `package.json` 之外的新包。
3. 所有新颜色都来自 `tokens.ts`。
4. 没有在组件层写 SQL。
5. 回答里给出：改了哪些文件 + 关键设计取舍 + 我该怎么手动验证（3 步以内）。

## 8. 扩展性铁律（题型是开放集合）

本项目明确会对「题型」这一个方向持续扩展（图片卡、判断题、代码填空…）。
下面几条是硬约束，违反即算 bug。完整设计见 `spec/04-extension-points.md`。

1. **新增题型只能通过 `src/cards/types/<type>/` + `index.ts` 一行注册完成。**
   不许在 `app/study.tsx`、`src/types.ts`、`repository` 里加 `if (type === ...)`。
2. **判分属于题型，不属于 SRS。** `src/srs/` 只认 `quality: number`，不认 `Card`。
   **不许恢复集中的 `grading.ts`。**
3. **新题型专属字段一律放 `cards.payload`（JSON）**，不许塞进 `options` / `answer`——
   老版本 App 会对这两个字段直接 `JSON.parse`，格式一变就崩。
4. **数据库迁移只加不删不改名**；每次迁移独立 `if (userVersion < N)` + 事务 + 幂等；
   迁移绝不触碰 `review_states` / `review_logs`。
5. **未知 `type` 必须降级**（`UnsupportedCard` + 队列过滤），不许崩溃、不许白屏。
6. **学科主题色以 `decks.json` 的 `accent` 为唯一真相**，代码里用 `deckAccent()` 取，
   不许新增 `colors.deck.xxx` 硬编码。
7. **题库更新用 UPSERT，禁止 `INSERT OR REPLACE`。** 后者的实际行为是「先 DELETE 再 INSERT」，
   会顺着 `review_states` / `review_logs` 的 `ON DELETE CASCADE` **静默清空用户全部复习进度**。
   删除卡片必须走 `decks.json` 的 `removed` 墓碑列表（见 `spec/01` 4.1 节）。
   这条在开发期不会暴露，上线更新题库时才炸，所以没有例外。

每次交付前问自己一句：**「我这次改动，有没有让加第 5 种题型变得更难？」**

## 9. 明确禁止

- ❌ 一次跨 6 个以上文件的大重构。要重构先说方案。
- ❌ 删除或改写已有测试 / 已有功能来「让编译通过」。
- ❌ 把 API Key 写进代码或提交到 git。
- ❌ 引入 UI 组件库（NativeBase / RNE / Tamagui 等）——所有 UI 手写。
- ❌ 生成占位版的「TODO 稍后实现」就交差。要么写完，要么明确说没做。
- ❌ 让 AI 生成的卡跳过「用户作答 + 表态」直接进题库。
  `source = 'ai'` 且 `verified_at IS NULL` 的卡**不得**出现在每日队列里。
- ❌ 把 `tools/` 下的脚本打进 App 包，或在 App 运行时 `require` `tools/` 里的文件。
  `syllabus.json` 要进包，必须先用 `merge`/裁剪生成 `assets/data/topics.json` 的轻量版。
