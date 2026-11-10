# 数据模型规格（SQLite）

> 实现位置：`src/db/schema.ts` + `src/db/repository.ts`。
> **所有 SQL 只允许写在 `src/db/` 里**，其他层通过 repository 的纯函数调用。

## 0. 通用约定

- 数据库文件：`bytecard.db`，通过 `SQLite.openDatabaseAsync('bytecard.db')` 打开。
- 开启 WAL：`PRAGMA journal_mode = WAL;`
- 开启外键：`PRAGMA foreign_keys = ON;`
- 时间字段：
  - **日期**（用于按天统计/打卡）统一存本地日期字符串 `'YYYY-MM-DD'`，用 `src/utils/date.ts` 的 `todayKey()` 生成，**不要用 UTC**。
  - **时刻**（用于到期判断）存 ISO 8601 字符串（`new Date().toISOString()`）。
- 所有表 `created_at TEXT NOT NULL DEFAULT (datetime('now'))`。
- 迁移用 `PRAGMA user_version` 做版本号，`migrate.ts` 里按版本号顺序执行。

## 1. 建表 SQL

```sql
-- 学科包（408 四科 + AI + Agent）
CREATE TABLE IF NOT EXISTS decks (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  code        TEXT NOT NULL,            -- 如 '408-DS'
  description TEXT,
  accent      TEXT NOT NULL,            -- 该包的主题色，取自 tokens
  sort_order  INTEGER NOT NULL DEFAULT 0,
  enabled     INTEGER NOT NULL DEFAULT 1
);

-- 知识卡
CREATE TABLE IF NOT EXISTS cards (
  id          TEXT PRIMARY KEY,
  deck_id     TEXT NOT NULL REFERENCES decks(id) ON DELETE CASCADE,
  -- 题型：故意不设 CHECK 约束。可用题型由 src/cards 的注册表决定（见 spec/04 第 1 节），
  -- 写死 CHECK 会导致「加一个题型就要重建表」，这是明确要避免的瓶颈。
  type        TEXT NOT NULL,
  question    TEXT NOT NULL,            -- 题干（纯文本，可含换行）
  code        TEXT,                     -- 可选：代码/公式片段，等宽字体展示
  options     TEXT,                     -- JSON: string[]，fill/judge 型为 NULL
  answer      TEXT NOT NULL,            -- JSON，见 spec/02-deck-schema.md 的 answer 约定
  payload     TEXT NOT NULL DEFAULT '{}', -- JSON：新题型专属字段（image/code/lang…），见 spec/04 第 2 节
  explain     TEXT NOT NULL,            -- 标准解析（离线可用，不依赖 AI）
  tags        TEXT NOT NULL DEFAULT '[]',  -- JSON: string[]
  difficulty  INTEGER NOT NULL DEFAULT 2,  -- 1~3
  ai_explain  TEXT,                     -- AI 生成的补充讲解，缓存用
  source      TEXT NOT NULL DEFAULT 'seed', -- seed | ai
  verified_at TEXT,                     -- AI 卡的确认时间；seed 卡为 NULL
  sort_order  INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_cards_deck ON cards(deck_id);

-- 遗忘曲线状态（每张卡一行，懒创建）
CREATE TABLE IF NOT EXISTS review_states (
  card_id          TEXT PRIMARY KEY REFERENCES cards(id) ON DELETE CASCADE,
  ease             REAL NOT NULL DEFAULT 2.5,   -- SM-2 的 EF
  interval_days    INTEGER NOT NULL DEFAULT 0,
  reps             INTEGER NOT NULL DEFAULT 0,  -- 连续答对次数
  lapses           INTEGER NOT NULL DEFAULT 0,  -- 累计答错次数
  due_at           TEXT NOT NULL,               -- ISO；首次进入队列即设为 now
  last_quality     INTEGER,
  last_reviewed_at TEXT,
  status           TEXT NOT NULL DEFAULT 'new'  -- new | learning | review | lapsed
);
CREATE INDEX IF NOT EXISTS idx_states_due ON review_states(due_at);

-- 每一次作答的流水（统计的唯一真相来源）
CREATE TABLE IF NOT EXISTS review_logs (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  card_id      TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  deck_id      TEXT NOT NULL,
  quality      INTEGER NOT NULL,        -- 0~5，映射规则见 prompts/04
  is_correct   INTEGER NOT NULL,        -- 0/1，用于正确率
  elapsed_ms   INTEGER NOT NULL DEFAULT 0,
  answer_raw   TEXT,                    -- 用户原始作答，便于错题回看
  day          TEXT NOT NULL,           -- 'YYYY-MM-DD'
  answered_at  TEXT NOT NULL            -- ISO
);
CREATE INDEX IF NOT EXISTS idx_logs_day ON review_logs(day);
CREATE INDEX IF NOT EXISTS idx_logs_card ON review_logs(card_id);

-- 键值设置
CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
```

### 版本说明（重要）

上面的建表语句是**最终形态**（含 `payload` / `source` / `verified_at`，且 `type` 无 CHECK）。

- **全新项目**：直接用上面的语句建表，**不需要**任何 `ALTER TABLE` 迁移。
  `prompts/09` 和 `prompts/10` 里提到的 v2 / v3 迁移可以整体跳过——
  执行前先用 `PRAGMA table_info(cards)` 确认列已存在即可。
- **已经按旧版 spec 建过库**（`cards` 里没有 `payload` 列，或 `type` 带 CHECK）：
  按 `spec/04` 第 2 节执行表重建迁移，务必在一个事务里做并保留 `review_states`。

判断当前库属于哪种：

```sql
SELECT sql FROM sqlite_master WHERE name = 'cards';   -- 看有没有 CHECK
PRAGMA table_info(cards);                             -- 看有没有 payload / source / verified_at
```

> `daily_stats` **不建表**，由 `review_logs` 按 `day` 聚合实时算出——避免两套真相不一致。

## 2. settings 约定键

| key | 默认值 | 含义 |
| --- | --- | --- |
| `daily_new_limit` | `'15'` | 每日新卡上限 |
| `daily_review_limit` | `'80'` | 每日复习上限 |
| `enabled_decks` | `'["ds","co","os","cn","ai","agent"]'` | 启用的学科包 JSON 数组 |
| `ai_api_key` | `''` | DeepSeek Key（空则走 Mock） |
| `ai_base_url` | `'https://api.deepseek.com'` | 可改 |
| `ai_model` | `'deepseek-chat'` | 以 DeepSeek 官方模型列表为准 |
| `reminder_enabled` | `'false'` | 每日提醒开关 |
| `reminder_time` | `'20:30'` | 提醒时刻 |
| `onboarded` | `'false'` | 是否完成首次引导 |

## 3. repository 必须暴露的接口

```ts
// 初始化
initDatabase(): Promise<void>            // 建表 + 迁移 + 首次 seed
resetProgress(): Promise<void>           // 清空 review_states / review_logs（保留卡片）

// 卡片与学科包
listDecks(): Promise<Deck[]>
getDeckProgress(deckId: string): Promise<{ total: number; learned: number; due: number }>
listCardsByDeck(deckId: string): Promise<Card[]>

// 今日队列（核心）
buildTodayQueue(opts: { newLimit: number; reviewLimit: number }): Promise<Card[]>
// 规则：先取 due_at <= now 的复习卡（按 due_at 升序），再按 sort_order 补齐新卡，
// 总数不超过 newLimit + reviewLimit；确保同一次会话内不重复。
// 返回前必须再过滤两道（在 repository 层做，不要留给 UI）：
//   1. 未注册的题型：!isSupportedType(card.type) → 剔除（见 spec/04 1.6）
//   2. 未确认的 AI 卡：source = 'ai' AND verified_at IS NULL → 剔除

// 作答落库（一次事务里做三件事）
submitAnswer(input: {
  cardId: string; deckId: string; quality: number; isCorrect: boolean;
  elapsedMs: number; answerRaw?: string;
}): Promise<{ nextDueAt: string; intervalDays: number; ease: number; status: string }>
// 事务内容：更新 review_states（调 sm2）+ 插入 review_logs + 返回新状态

// 统计
getTodayStats(): Promise<{ done: number; correct: number; goal: number }>
getStreak(): Promise<number>                      // 连续打卡天数
getDailySeries(days: 7 | 30): Promise<Array<{ day: string; done: number; correct: number }>>
getDeckAccuracy(): Promise<Array<{ deckId: string; name: string; accuracy: number; done: number }>>
getWrongCards(limit: number): Promise<Card[]>     // lapses > 0，按最近答错排序

// 设置
getSetting(key: string): Promise<string | null>
setSetting(key: string, value: string): Promise<void>
```

## 4. seed 逻辑

- `decks.json` 放在 `assets/data/`，用 `require('../../assets/data/decks.json')` 静态引入（不要走网络）。
- 首次启动（`settings.onboarded` 为空）时执行 seed：`INSERT OR IGNORE` 插入 decks 和 cards。
- seed 必须在 `< 2s` 内完成（约 100 张卡），不要逐条 await 循环——用单事务批量插入。

### 4.1 更新题库（`version` 变大时）三条铁律

**① 绝对不要用 `INSERT OR REPLACE`。**

SQLite 的 `REPLACE` 冲突处理是「**DELETE 旧行 + INSERT 新行**」，而 `review_states` /
`review_logs` 的外键是 `ON DELETE CASCADE` —— 一次题库更新会把用户所有复习进度、
打卡记录、错题本**静默清空**。这个 bug 在开发期完全不会暴露（没有旧数据），
上线后第一次更新题库才炸，而且用户只会觉得「我的进度莫名没了」。

必须用 UPSERT：

```sql
INSERT INTO cards (id, deck_id, type, question, code, options, answer, payload,
                   explain, tags, difficulty, sort_order, source, verified_at)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'seed', NULL)
ON CONFLICT(id) DO UPDATE SET
  deck_id    = excluded.deck_id,
  type       = excluded.type,
  question   = excluded.question,
  code       = excluded.code,
  options    = excluded.options,
  answer     = excluded.answer,
  payload    = excluded.payload,
  explain    = excluded.explain,
  tags       = excluded.tags,
  difficulty = excluded.difficulty,
  sort_order = excluded.sort_order;
-- 注意：故意不更新 ai_explain（那是用户设备上的 AI 缓存，与题库版本无关）
-- 注意：绝不 UPDATE source / verified_at（AI 卡的标记不能因为题库更新被重置）
```

**② 删除卡片必须走墓碑列表，不能「删掉 JSON 里那一行」就当完事。**

`INSERT` 不会删数据。老设备上的卡会一直留着。所以 `decks.json` 顶层要带墓碑：

```jsonc
{
  "version": 3,
  "removed": ["ds-012", "co-007"],
  "decks": [...], "cards": [...]
}
```

seed 时（在 UPSERT 之前）先执行：

```sql
DELETE FROM cards WHERE id IN (<removed 列表>);
```

`review_states` 会因为 `ON DELETE CASCADE` 一起清掉——这是**正确**的，
卡都不存在了，进度留着没意义。但要在「我的」页给用户一个提示：
`本次题库更新移除了 2 张有问题的卡`，别让他们以为数据丢了。

**③ id 一旦发布就不可变。**

- 改题干、改解析、改选项：**保持 id 不变**，只改内容 → UPSERT 生效，用户进度保留。
- 修正一道错题的错误答案：同理，只改 `answer` 字段。
- 想彻底重做一张卡（连考点都换了）：用墓碑删掉旧 id + 新增一个新 id，不要复用旧 id。
- **不要**批量重编号 id。那等于把所有用户的进度清零。

### 4.2 幂等判断与统一入口

**题库有两个来源：内置 `assets` 和远程下载，但只有一条合并逻辑。**
实现成 `src/db/applyBundle.ts` 的 `applyDeckBundle(bundle, { source })`，
`seedIfNeeded()` 和阶段 11 的热更新都调它（详见 `prompts/11-deck-distribution.md`）。

```ts
const appliedVersion = Number(await getSetting('deck_version') ?? 0);
if (bundle.version <= appliedVersion) return;      // 幂等：版本不升就什么都不干
await withTransactionAsync(async () => {
  await deleteRemoved(bundle.removed ?? []);       // ① 先删墓碑
  await upsertDecks(bundle.decks);                 // ② UPSERT（不是 REPLACE）
  await upsertCards(bundle.cards);                 // ③ UPSERT
  await ensureReviewStates();                      // ④ 给新卡补 review_states
  await setSetting('deck_version', String(bundle.version));  // ⑤
});
```

**注意用 `deck_version` 而不是 `onboarded` 做判断**：`onboarded` 只管首次引导，
`deck_version` 才管题库版本。两者混用会导致「更新了题库但用户已经 onboarded，所以没生效」。

