# 阶段 4 · 间隔重复（SM-2）与每日队列

> 前置：阶段 3 已通过验收，能连续刷卡并落库。
> 这是「记住」和「刷过」的分界线。做完 commit。

---

读 `AGENTS.md`、`spec/01-data-model.md`（review_states 部分）。
实现遗忘曲线调度，并把今日队列换成真正按到期时间生成的版本。

## 任务

### 1. `src/srs/sm2.ts` —— 纯函数，无 IO

严格实现经典 SM-2，**不要自创变体**：

```ts
export type SM2State = {
  ease: number;          // EF，初始 2.5，下限 1.3
  intervalDays: number;  // 初始 0
  reps: number;          // 连续答对次数，初始 0
  lapses: number;        // 累计答错次数
};

export type SM2Result = SM2State & {
  status: 'learning' | 'review' | 'lapsed';
  nextDueAt: Date;
};

export function schedule(state: SM2State, quality: number, now: Date = new Date()): SM2Result;
```

算法（照抄，不要改）：

```
q = clamp(round(quality), 0, 5)

// 1) 先更新 EF
ease = state.ease + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))
ease = max(1.3, ease)

// 2) 再按 q 决定间隔
if (q < 3) {
  reps      = 0
  interval  = 1              // 明天再来
  lapses    = state.lapses + 1
  status    = 'lapsed'
} else {
  if (state.reps === 0)      interval = 1
  else if (state.reps === 1) interval = 6
  else                       interval = round(state.intervalDays * ease)
  reps   = state.reps + 1
  lapses = state.lapses
  status = state.reps === 0 ? 'learning' : 'review'
}

nextDueAt = new Date(now.getTime() + interval * 86400_000)
```

注意两个易错点，实现完自己核对：

1. **EF 用更新后的值**去乘（先算 ease，再算 interval），顺序不能反。
2. `interval` 在 `reps >= 2` 时是 `round(旧interval * 新ease)`，不是 `round(旧interval * 旧ease)`。

同时导出 `describeInterval(days: number): string` 用于 UI 展示：
`0 → '今天'`、`1 → '明天'`、`2~29 → '${n} 天后'`、`>=30 → '${Math.round(n/30)} 个月后'`。

### 2. `src/srs/queue.ts` —— 每日队列生成

```ts
export function buildQueue(input: {
  dueCards: Card[];      // due_at <= now，且 status != 'new'
  newCards: Card[];      // status = 'new'
  newLimit: number;
  reviewLimit: number;
}): Card[];
```

规则：

1. 取 `dueCards` 前 `reviewLimit` 张（已按 `due_at ASC` 排好）。
2. **交错排列**：把 due 卡按 `deckId` 分组，然后轮流从各组取一张（round-robin），
   避免连续 5 张都是数据结构。组内保持原有顺序。
3. 再取 `newCards` 前 `newLimit` 张，同样交错后**追加在 due 队列之后**
   （先巩固旧的，再学新的——这是有意的顺序，不要混在一起）。
4. 总数 = `min(due, reviewLimit) + min(new, newLimit)`，且去重。

交错实现要稳定可预测（同一个输入两次调用得到同样顺序），不要引入随机。

### 3. 改造 `repository.buildTodayQueue`

- 读 `settings.daily_new_limit` / `daily_review_limit` / `enabled_decks`。
- 用一条 SQL 拿 due 卡：

```sql
SELECT c.*, s.due_at FROM cards c
JOIN review_states s ON s.card_id = c.id
JOIN decks d ON d.id = c.deck_id
WHERE s.due_at <= ? AND s.status != 'new' AND d.enabled = 1
ORDER BY s.due_at ASC LIMIT ?;
```

- 新卡：`review_states.status = 'new'`，按 deck 的 `sort_order`、卡的 `sort_order` 排序。
- `enabled_decks` 里未启用的学科包整体排除（这个设置阶段 5 会做 UI，现在先支持读）。

### 4. 改造 `repository.submitAnswer`（一次事务）

```
BEGIN
  读 review_states（不存在则按默认值建）
  schedule(state, quality)  → 新状态
  UPDATE review_states SET ease, interval_days, reps, lapses, due_at, last_quality,
                            last_reviewed_at, status
  INSERT INTO review_logs (card_id, deck_id, quality, is_correct, elapsed_ms, answer_raw, day, answered_at)
COMMIT
返回新状态
```

`day` 用 `todayKey()`（本地日期，`YYYY-MM-DD`），**不要用 `toISOString().slice(0,10)`**——
那是 UTC，晚上 8 点后打卡会算到第二天，连续天数会错。

### 5. 首页与结束页联动真实数据

- 首页进度环：分子 = 今日已完成（`review_logs` 中 `day = today` 的去重卡片数），
  分母 = 今日目标（`min(due + newLimit, 15)` 或直接读 `daily_new_limit + min(due, 30)`；
  简单点：目标 = 今日队列长度，队列为空时显示「今天清空了」）。
- 首页加一行状态条：`待复习 12 · 新卡 15`（`micro` 字号，`textDim`）。
- 结束页显示「下次复习：明天 12 张」（用 `getNextDueSummary()` 新增接口，
  返回未来 1/3/7 天内到期的卡片数）。

### 6. 时间跳变测试

写一个开发用开关（放在「我的」页最下方 `开发工具` 分组里，`__DEV__` 才显示）：
`把到期时间往前拨 1 天` —— 把所有 `review_states.due_at` 减 1 天，
然后点「重新生成队列」验证答错的卡确实回来了。

这个开关不要出现在生产包（用 `__DEV__` 判断，release 构建自动消失）。

## 不要做的事

- 不要引入 FSRS 或其他新的记忆算法（SM-2 就够，且我能自己核对）。
- 不要在 SM-2 里加入「用户自评 1-5 星」的 UI（本 App 用答题结果代替自评）。
- 不要把 `interval` 上限设死（SM-2 会长到几百天，这很正常；但可加一个 `365` 天的软上限）。

## 验收

- [ ] `sm2.test.ts` 覆盖 6 个 case 全绿：
  首次答对(q=5) → interval 1；第二次(q=5) → 6；第三次(q=5) → round(6×2.6)=16；
  答错(q=0) → interval 1 且 reps 归零、lapses+1；q=3 时 ease 下降；ease 不低于 1.3
- [ ] 连续答对 3 次的卡，`due_at` 确实是 16 天后（用开发开关验证）
- [ ] 交错生效：一次队列里不会连续出现 3 张以上同一学科
- [ ] 学完今日队列后，首页显示「今天清空了」
- [ ] 次日（或拨时钟后）打开，答错过的卡排在队列前面
- [ ] 跨零点打卡：把系统时间调到 23:59 学一张，再调到次日 00:01 学一张，连续天数 = 2
- [ ] `npx tsc --noEmit`、`npm test` 全绿

## 交付时告诉我

1. `sm2.ts` 的完整实现（贴代码，我要自己核一遍公式）。
2. 交错算法的实现方式，以及它对「新卡」是否也生效。
3. 今日目标是「队列长度」还是「固定 15」，你选了哪个、为什么。

---
