# 阶段 3 · 刷卡答题界面（核心体验）

> 前置：阶段 2 已通过验收，库里已有 100 张卡。
> 这一阶段做完，App 就「能用」了。做完立即 commit。

---

读 `AGENTS.md`、`spec/03-design-tokens.md`（重点 6.1 / 6.2 / 6.3 / 7 节）、
`spec/04-extension-points.md`（重点 1.2 / 1.3 / 1.4 节——卡片渲染的架构）。
把 `app/study.tsx` 从占位变成完整的刷卡答题流程。**不涉及 SM-2 计算**，
但每次作答必须调用 `repository.submitAnswer()` 落库（`quality` 先按下面第 4 节算好）。

## 任务

### 1. 会话状态（`src/store/sessionStore.ts`）

```ts
type SessionState = {
  queue: Card[];
  index: number;                 // 当前第几张
  startedAt: number;             // 本张卡进入时间戳
  phase: 'answering' | 'revealed';
  draft: number[] | null;        // 多选：已选 index 数组
  draftText: string;             // 填空：输入内容
  result: AnswerResult | null;   // 提交后的判定结果
  doneCount: number;
  correctCount: number;
  start(queue: Card[]): void;
  selectOption(i: number): void;   // single 直接提交；multi 只切换选中
  setDraftText(t: string): void;
  submit(): Promise<void>;
  next(): void;                    // 进入下一张，队列空则结束
  end(): void;
};

type AnswerResult = {
  isCorrect: boolean;
  quality: number;                 // 0~5
  correctText: string;             // 用于展示的标准答案文本
  matchedBy?: 'exact' | 'near';    // 填空命中方式
};
```

页面进入时：`buildTodayQueue({newLimit: 15, reviewLimit: 80})` → `start(queue)`。
（这一阶段队列来源仍是阶段 2 的简化版，阶段 4 会换成真正按到期时间排序。）

### 2. 三种题型的交互（**要严格照着做，这是核心手感**）

> **实现位置很重要，先看这条**：每种题型的「作答 UI + 判分」写在各自目录里
> `src/cards/types/{single|multi|fill}/AnswerView.tsx` 和 `definition.ts`，
> 通过 `CardDefinition` 注册（接口见 `spec/04-extension-points.md` 1.2/1.3 节）。
> `app/study.tsx` **只做一件事**：`getCardDef(card.type)` 查表，然后渲染 `def.AnswerView`。
>
> **严禁**在 `study.tsx` 里写 `if (card.type === 'single') {...}` 这种分支——
> 那会让第 4 种题型加不进来。这一条是 `AGENTS.md` 的硬性约束。

**`single` 单选：点一下选项就提交，不要「确认」按钮。**
百词斩的手感就是零摩擦：手指落点即答案。

- 提交瞬间：选中项变 `dangerSoft/danger`（若错）或 `successSoft/success`（若对）；
  同时把正确项也标成 `success` 状态（让用户知道答案是什么）。
- 其余选项降到 40% 不透明度。

**`multi` 多选：点选项只切换选中态，底部按钮「确认」才提交。**

- 选中态用 `primarySoft/primary` + 方框打勾。
- 按钮文案随状态变：未选任何项 → `请选择`（禁用灰）；已选 ≥1 → `确认`（主色）。
- 提交后逐项标注：选对的打 `✓` 绿；漏选的正确答案用绿描边 + 空心勾；选错的打 `✕` 红。

**`fill` 填空：中间给一个 TextInput，底部「提交」。**

- TextInput：`fontFamily: mono`，`bg surface`，`border border`，`radius.md`，高 52，
  光标色 `primary`，`autoCapitalize="none"`，`autoCorrect={false}`。
- 有 `answer.hint` 时在输入框下方显示 `提示：xxx`（`caption`，`textMute`）。
- 提交后输入框冻结（`editable={false}`），并显示匹配结果：
  - 精确命中 → `✓ 正确`
  - 近似命中（编辑距离 ≤1）→ `≈ 基本正确，标准写法：<标准答案>`（用 `warning` 色）
  - 错 → `✕ 正确答案：<第一个 accept 项>`
- 判断键盘遮挡：输入框聚焦时整个内容区上移（用 `KeyboardAvoidingView` 或
  `react-native-keyboard-controller` 都不用，就用 `KeyboardAvoidingView` + `behavior="padding"`，
  iOS/Android 都测一下）。

### 3. 提交后的解析面板（`src/components/AnswerPanel.tsx`）

提交后**不跳页**，在卡片下方展开一块面板（200ms 高度动画 + 淡入）：

```
┌ ✓ 正确 · 用时 8s ─────────────────────┐   ← 结论行：对=success 色，错=danger 色
│                                       │
│ 删除第 i 个元素要把它后面的 n-i 个元素 │   ← explain 正文，type.small，text 色
│ 前移；对所有 i 求和取平均得 (n-1)/2。  │
│                                       │
│ [线性表] [时间复杂度]                  │   ← tags，micro 字号，border 描边小胶囊
└───────────────────────────────────────┘
```

- 结论行左侧图标：对 `checkmark-circle`，错 `close-circle`，近似 `alert-circle`（`warning`）。
- 解析面板 `bg: colors.surface`，`border`，`radius.md`，padding `lg`，与卡片间距 `md`。
- 有一个「换个说法」文字按钮（`type.micro`，`primary` 色）——**这一阶段先禁用并置灰**，
  阶段 6 接 AI 时启用。
- 面板出现后底部按钮变 `下一张`（最后一张变 `完成`），点击时：
  答对轻微上滑淡出、答错先抖动再滑出。
- 解析面板出现时**自动滚动到底部**（`ScrollView.scrollToEnd`），否则小屏看不到解析。

### 4. quality 打分（**下沉到每个题型的 `definition.grade()`**）

每个 `CardDefinition` 自己实现 `grade()`，返回 `GradeResult`（含 `quality`）。
**不要建一个集中的 `grading.ts`**——那是上一个版本的写法，加题型就要改它。

打分规则表（各题型都按这个来，差异只在「什么算对」）：

| 情况 | quality |
| --- | --- |
| 单选 / 多选全对 / 填空精确，且用时 ≤ 15s | 5 |
| 上述情况但用时 > 15s | 4 |
| 多选部分正确（选对但不全，或含错项但过半正确） | 3 |
| 填空近似命中 | 3 |
| 完全错误 | 0 |

`study.tsx` 拿到 `GradeResult` 后调用
`repository.submitAnswer({ cardId, deckId, quality, isCorrect, elapsedMs, answerRaw })`，
**必须 await 并 try/catch**——写库失败时不要阻塞用户继续答题，但要 `console.warn`，
并在会话结束页显示「有 N 次记录未保存」。

### 5. 顶部进度

- 一行：左侧 `decks[deckId].code`（mono，该 deck 的 accent 色）+ 学科名；
  右侧 `3 / 20`（mono，`textDim`）。
- 下方一条 2px 全宽进度条：轨道 `border`，已完成 `primary`，宽度按 `index/queue.length` 动画。
- 顶部要留 SafeArea，右上角一个 `close` 图标（不是返回箭头），点击时若已答题数 > 0
  弹自定义底部确认（`本次学了 N 张，结束？` / `继续学习` / `结束`），**不要用系统 Alert**。

### 6. 结束页

队列答完或用户主动结束后，`router.replace` 到一个结束页（可以是 `app/study.tsx` 内部切换的
`finished` 视图，不必新建路由）：

- 大数字：本次答对 / 总数（`display` 字号）
- 一句评价：正确率 ≥80% `状态不错。`；60~80% `有几个点还不稳。`；<60% `这批卡需要再来一遍。`
- 两个按钮：`再来一组`（重新拉队列）、`回首页`

### 7. 无障碍与细节

- 每个选项加 `accessibilityRole="button"` 和 `accessibilityLabel`（含选项文本）。
- 所有可点元素 `hitSlop` 至少 8。
- 答题过程中禁止下拉刷新 / 横滑返回（`gestureEnabled: false` 在 `study` 路由上，
  但保留 close 按钮）——防止手滑丢进度。
- 深色键盘：`keyboardAppearance="dark"`。

## 不要做的事

- 不要在这里实现 SM-2 计算，也不要改 `buildTodayQueue` 的排序逻辑（阶段 4）。
- 不要做卡片左右滑动切题（斜滑容易和滚动冲突，这一版只用按钮）。
- 不要做音效。
- 不要用系统 Alert / Toast 库。
- **不要在 `study.tsx` 里写 `card.type` 的分支或 `switch`**。三种题型各自注册，
  页面只查表分发。如果你觉得「就三行 if 而已，何必这么绕」，请想一下第 5 种题型加进来那天。

## 验收（真机上逐条过）

- [ ] 单选题点一下即判定，正确项和错误项颜色都对
- [ ] 多选题不点确认不判定；部分对时标注准确
- [ ] 填空题：`O(logn)` 和 `O(log n)` 都判对；差一个字符时提示「基本正确」
- [ ] 解析面板在任何屏幕尺寸下都能完整看到（小屏自动滚动）
- [ ] 连答 20 张不卡顿、不重复出同一张
- [ ] 中途关闭 App 再进来，`review_logs` 里能看到之前的记录
- [ ] 结束页数字和实际答题数一致
- [ ] `app/study.tsx` 里**没有** `card.type ===` 这种判断（用 `grep card.type app/study.tsx` 自查）
- [ ] `src/cards/index.ts` 里能看到三种题型的注册，各占一行
- [ ] `npx tsc --noEmit` 零错误

## 交付时告诉我

1. 组件拆分结果（每个文件职责一句话）。
2. `quality` 打分的实际实现和上表的差异（如果有）。
3. 你认为手感上最需要真人试一下才能定的一处。

---
