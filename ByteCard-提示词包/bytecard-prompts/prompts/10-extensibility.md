# 阶段 10 · 题型注册表重构 + 第一个新题型

> 前置：阶段 3、4 已通过验收（三种题型能刷、SM-2 在跑）。
> **这是重构任务，不是新功能任务。** 铁律：重构过程中 UI 和行为**一个像素都不许变**。
>
> 读 `spec/04-extension-points.md`，那是本阶段的全部设计依据。

---

## 先判断你在哪条路上（30 秒）

```bash
grep -n "card.type" app/study.tsx
```

- **只看到 `getCardDef(card.type)`** → **路径 A**：阶段 3 已经按注册表实现。
  **跳过 Step 1~4，直接从 Step 5 开始。** 这是推荐情况，说明一次就写对了。
- **看到 `card.type === 'single'` 这类判断，或者一个 `switch`** → **路径 B**：
  阶段 3 写成了 if/else 分发，需要按 Step 1~4 重构成注册表。

两条路的终点一样，只是路径 B 多了重构成木。**重构铁律：一个像素都不许变。**

---

## 为什么要做这一步

不加注册表的话，第 4 种题型要改 3 个文件（`types.ts` 联合类型、`study.tsx` 的 if/else、
集中的判分函数），而且 `study.tsx` 会越来越像一锅粥。
这阶段把「数据结构 + 作答 UI + 判分」打包成可注册单元，然后用 `judge` 验证架构真能用。

**按顺序一步一步做，每步结束 commit。** 不要一次性动 8 个文件——
出问题你无法定位是哪一步引入的。

---

## Step 1 · 建注册表骨架（不动任何现有逻辑）

新建：

- `src/cards/registry.ts` —— 照抄 `spec/04` 1.3 节的完整代码
- `src/cards/index.ts` —— 先空着（只 `export *`）
- `src/cards/types/` 目录

这一步不改任何调用点。跑 `npx tsc --noEmit` 应该零错误（新文件未被引用也不要紧）。

**commit: `stage10 step1: registry skeleton`**

## Step 2 · 迁移 `single`（只迁一个，验证思路）

- `src/cards/types/single/definition.ts`：实现 `CardDefinition`，
  `grade()` 的逻辑**从 `src/srs/grading.ts` 原样搬过来**（包含 15s 阈值那套）。
- `src/cards/types/single/AnswerView.tsx`：UI 从 `app/study.tsx` 里**整段剪出来**，
  改成通过 props 接收 `card / phase / draft / onDraftChange / onSubmit / result`。
  **不要重新设计样式**，只做数据传递的改造。
- `src/cards/index.ts` 注册 `singleDef`。
- **暂时不改 `app/study.tsx`**（它还在用旧分支），先让两者并存。

验证：`tsc` 通过、App 还能正常刷单选题（走旧路径）。

**commit: `stage10 step2: extract single into definition`**

## Step 3 · 切换调用点到注册表

改 `app/study.tsx`：

```tsx
const def = getCardDef(card.type);
if (!def) return <UnsupportedCard card={card} onSkip={next} />;
const AnswerView = def.AnswerView;
```

- 删除原 `single` 分支的代码（已经搬到 `types/single/` 了）。
- **此时题库里还有 `multi` / `fill`，它们会走到 `UnsupportedCard`** —— 这是预期的，
  下一步就补上。所以这一步只验证单选题能跑通。

验证：只刷单选题（临时把 `daily_new_limit` 调小，或手改队列取单一 deck）→ 行为与重构前完全一致。

**commit: `stage10 step3: study.tsx dispatch through registry`**

## Step 4 · 迁移 `multi` 和 `fill`

同 Step 2 的做法，各自一个目录。两个做完一起验证。

验证重点（这三条最容易迁错）：

- [ ] 多选：未选时按钮禁用、选中切换、部分对的标注（绿勾 / 红叉 / 空心绿勾）三种状态都对
- [ ] 填空：`normalizeAnswer` 归一化、编辑距离 ≤1 的「基本正确」提示、冻结输入框
- [ ] 三者的 `quality` 与原 `grading.ts` **完全一致**（拿 10 张卡对比改造前后写入 `review_logs` 的 quality）

验证通过后，**删除 `src/srs/grading.ts`**（判分已全部下沉）。

**commit: `stage10 step4: migrate multi & fill, drop grading.ts`**

## Step 5 · 数据库 v3（去掉 CHECK、补 payload）

**先判断要不要做**：

```sql
SELECT sql FROM sqlite_master WHERE name = 'cards';   -- 有没有 "CHECK (type IN ...)"
PRAGMA table_info(cards);                             -- 有没有 payload 列
```

- 用最新 `spec/01-data-model.md` 建的库 → **两项都满足，本步直接跳过**（标记 user_version = 3 即可，
  下次迁移有依据）。这是路径 A 的正常情况。
- 老库（带 CHECK 或没有 payload）→ 执行重建：

1. `PRAGMA foreign_keys = OFF`
2. 在事务里重建 `cards` 表：去掉 `type` 的 CHECK，补齐 `payload` / `source` / `verified_at`
3. 搬数据（`payload` 填 `'{}'`，`source` 填 `'seed'`）
4. 重建 `idx_cards_deck`
5. `PRAGMA foreign_keys = ON`，`PRAGMA user_version = 3`

注意：

- 重建表会让 `review_states` / `review_logs` 的外键短暂失效，**必须在一个事务里完成**，
  任何一步失败就回滚并保留原数据。
- 迁移前先 `PRAGMA table_info(cards)` 检查列是否已存在，保证幂等。
- 迁移完立刻自检：`SELECT COUNT(*) FROM cards` 与 `review_states` 数量都不变。

验证：**旧库 → 升级 → 进度、连续天数、错题本全部完好。**

**commit: `stage10 step5: db migration v3 (drop type check, add payload)`**

## Step 6 · 学科色配置驱动

- 新建 `src/theme/deckColor.ts`，实现 `deckAccent()`（见 `spec/04` 第 3 节）
- 全局搜索 `colors.deck.`，把直接引用改成 `deckAccent(deck)`
- `tokens.deck` 保留作为兜底，注释里写明「仅兜底，真相在 decks.json」

验证：临时把 `decks.json` 里 `ds` 的 `accent` 改成 `#FF0000`，重启 App →
数据结构那张卡的顶栏和统计条都变红。改回来。

**commit: `stage10 step6: deck accent from config`**

## Step 7 · 加入 `judge` 题型（架构验收）

这是本阶段的核心验收：**新增一个题型，只加了 1 个目录 + 1 行注册，没改任何既有文件。**

- `src/cards/types/judge/definition.ts` + `AnswerView.tsx`
- 规格严格按 `spec/04` 4.1 节：两个大按钮、不用四选一布局
- `grade`：`raw.value`（0=正确/1=错误）与 `answer.value` 比对，quality 规则同单选
- `validate`：检查 `answer.value` 是 boolean、`options === null`
- 在 `src/cards/index.ts` 加一行
- 在 `assets/data/cards/ds.json` 手写 **3 张**判断题（内容要准确，不要凑数）

验证：

- [ ] 3 张判断题能刷出来、能判对错、解析正常
- [ ] `git diff --stat` 显示：只新增 `src/cards/types/judge/**` + `index.ts` 一行 + `ds.json` 三张
- [ ] **这条 git diff 就是「架构可用」的证据**，交付时贴给我

**commit: `stage10 step7: add judge card type via registry`**

## Step 8 · 未知题型降级

- `repository.buildTodayQueue` 在返回前过滤 `!isSupportedType(card.type)`
- 新建 `src/components/UnsupportedCard.tsx`：`这张卡是新题型，当前版本看不了。` + 跳过按钮
- 统计页底部加一行（有被过滤的卡时才显示）：`有 N 张卡需要更新 App 才能学`

验证：临时在 `decks.json` 插一张 `type: "unknown"` 的卡 → 它不出现在队列里，
统计页出现提示，App 不崩。验证完删掉。

**commit: `stage10 step8: graceful degradation for unknown types`**

## Step 9 · 写给三个月后的自己 `docs/EXTENDING.md`

这不是注释，是**操作手册**。必须包含：

1. **加一个新题型的 6 步清单**（抄 `spec/04` 1.5 节，但换成你项目里的真实路径）
2. **一张现状表**：当前支持哪些题型、各自的 `schemaVersion`、哪些字段放 `payload`
3. **三个反例**：
   - ❌ 在 `study.tsx` 里加 `if (card.type === 'xxx')`（这是注册表存在的唯一理由，别再走回头路）
   - ❌ 往 `options` / `answer` 里塞新结构（老版本 App 会 `JSON.parse` 炸）
   - ❌ 新建题型时顺便改 `theme` 的通用视觉（会让三种旧题型一起变样）
4. **加一个学科的步骤**（只改 `decks.json`）
5. **迁移纪律 5 条**（抄 `spec/04` 2.3）

**commit: `stage10 step9: extension handbook`**

---

## 明确禁止

- ❌ **不要在这个阶段改任何 UI 的视觉**。「顺手优化一下按钮圆角」会让 Step 3/4 的对比验证失效。
- ❌ 不要一次性迁移三种题型。一种一种来，每步可回滚。
- ❌ 不要改 `sm2.ts`（它跟题型无关，`quality` 契约没变）。
- ❌ 不要引入依赖注入框架、不要引入 `typedi` / `inversify` 这类东西——一个 `Map` 就够了。
- ❌ 不要为了「更优雅」把注册表改成动态 `import()` 懒加载。题型只有个位数，全量注册即可。

## 验收（整体）

- [ ] **路径 B 才有**：重构前后，同一批卡片的作答行为、颜色、动画、`quality` 数值完全一致
- [ ] `git log --oneline` 能看到干净的逐步 commit（路径 A 约 5 个，路径 B 约 9 个）
- [ ] Step 7 的 `git diff --stat` 证明「加题型没改既有文件」
- [ ] 老库升级后，用户进度零丢失（路径 A 若一开始就是新结构，这条标 N/A 即可）
- [ ] `unknown` 题型不崩溃、不占队列、有提示
- [ ] `docs/EXTENDING.md` 让一个没参与开发的人也能照着加题型
- [ ] `spec/04` 第 6 节的扩展性 6 问，逐条能答「是」
- [ ] `npx tsc --noEmit`、`npm test` 全绿

## 交付时告诉我

1. **Step 7 的 `git diff --stat` 原文**（这是架构是否真的解耦的唯一证据）。
2. 你走的是路径 A 还是路径 B；如果是 B，迁移前后同一张卡的 `quality` 是否一致。
3. 做这一步时你发现的、原设计里**没预料到**的耦合点（这最值钱，我要知道）。
4. 如果让你现在再加第 5 种题型（比如拖拽排序），你觉得还需要改哪些文件？如果答案里有 `study.tsx`，
   说明这轮架构没做透，告诉我为什么。

---
