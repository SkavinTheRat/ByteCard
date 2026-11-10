# 阶段 2 · 数据层与内置题库

> 前置：阶段 1 已通过验收（三 Tab 能跑）。
> 这一阶段是整个 App 的地基，**做完要立刻 git commit**。

---

读 `AGENTS.md`、`spec/01-data-model.md`、`spec/02-deck-schema.md`。
这一阶段做三件事：建库、写题库、把首页接上真实数据。**先不做刷卡界面。**

## 任务

### 1. SQLite 建表与迁移

- `src/db/schema.ts`：把 `spec/01-data-model.md` 第 1 节的建表 SQL 原样实现，
  导出 `const SCHEMA_VERSION = 1` 和一组 `CREATE_*` 常量字符串。
- `src/db/migrate.ts`：`initDatabase()` 负责
  1. `SQLite.openDatabaseAsync('bytecard.db')`
  2. `PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;`
  3. 读 `PRAGMA user_version`，小于 `SCHEMA_VERSION` 就执行建表并写回版本号
  4. 调用 `seedIfNeeded()`
- 用 `openDatabaseAsync` / `execAsync` / `runAsync` / `getAllAsync` / `withTransactionAsync` 这组**异步 API**，
  不要用已废弃的同步 `openDatabase`。

### 2. 题库：拆成 6 个文件分批生成

**重要：不要一次输出 100 张卡片**（单次输出太长会截断或后半段质量崩掉）。
文件结构如下，每个 `cards` 数组单独一个文件：

```
assets/data/decks.json          # 只有 6 个 deck 的元数据（不含卡片）
assets/data/cards/ds.json       # { "cards": [ ... 20 张 ... ] }
assets/data/cards/co.json       # 18 张
assets/data/cards/os.json       # 18 张
assets/data/cards/cn.json       # 18 张
assets/data/cards/ai.json       # 14 张
assets/data/cards/agent.json    # 12 张
```

`src/db/seed.ts` 里静态 `require` 这 6 个文件，合并后统一入库。
（这一点覆盖 `spec/02` 里单文件的写法，以本 prompt 为准。）

**生成顺序与质量要求：**

先写 `decks.json` 和 `ds.json`，跑通入库后**停下来让我看一眼**，
我确认内容质量 OK，你再继续写 co / os / cn / ai / agent（可以分多次，每次 1~2 个文件）。

每张卡必须符合 `spec/02-deck-schema.md` 第 5 节「内容质量标准」：
题干自包含、干扰项像真错、解析三段式 80~150 字、难度分布 4:4:2。
**学科知识必须准确**——这是 408 考研内容，公式和复杂度不能错。
不确定的知识点宁可不写，也不要编。

### 3. seed 入库

**首次安装**（`settings.deck_version` 为空）：

- 用**单个事务**批量 `INSERT OR IGNORE`，不要 for 循环里逐条 await。
- 插入 cards 后，为每张卡创建 `review_states`（`due_at = now`, `status = 'new'`）。
  100 张卡也要在一个事务里完成。
- 完成后写 `settings.deck_version = <bundled.version>`（**不是** `onboarded`，
  那个只标记「走过引导」，两者混用会导致题库更新不生效）。`onboarded` 由阶段 7 的引导页负责。
- seed 结束打印一行耗时日志，我要确认在 2s 内。

**后续题库版本变化**（`settings.deck_version` < `bundled.version`）：**这一段现在就要写对**，
虽然首版用不到，但等你跑完阶段 8 就要用它更新题库，写错了会吞用户进度。

- 先 `DELETE FROM cards WHERE id IN (bundled.removed ?? [])`（墓碑列表）
- 再对 decks / cards 做 **UPSERT**（`ON CONFLICT(id) DO UPDATE SET ...`）
- **绝对不要用 `INSERT OR REPLACE`**——SQLite 的 REPLACE 是「先 DELETE 再 INSERT」，
  会顺着 `ON DELETE CASCADE` 把用户所有 `review_states` 和 `review_logs` 清空。
  完整 SQL 和三条铁律见 `spec/01-data-model.md` 第 4.1 节，照抄。
- 最后写回新的 `deck_version`

### 4. repository

按 `spec/01-data-model.md` 第 3 节实现全部接口，放在 `src/db/repository.ts`。
这个阶段先实现这些（其余接口留空壳 `throw new Error('not implemented')` 也可，但要在注释里标 `// stage 4`）：

- `initDatabase` / `listDecks` / `getDeckProgress` / `listCardsByDeck`
- `buildTodayQueue`（先做简化版：所有 `status='new'` 的卡按 `sort_order` 取前 N 张，
  到期复习逻辑下一阶段补）
- `getSetting` / `setSetting` / `getTodayStats`（先返回 0 也可以）

所有行数据要**映射成带类型的 TS 对象**（`textarea`/`options` 这类 JSON 字段在 repository 里 `JSON.parse`，
上层拿到的就是结构化对象，不允许上层再 parse）。

### 5. 类型定义

`src/types.ts` 定义 `Deck`、`Card`、`CardType`、`ReviewState`、`ReviewLog`、`DailyStat`。
`Card` 用**可辨识联合**：

```ts
type CardBase = { id: string; deckId: string; question: string; code?: string;
                  explain: string; tags: string[]; difficulty: 1 | 2 | 3 };
type SingleCard = CardBase & { type: 'single'; options: string[]; answer: { index: number } };
type MultiCard  = CardBase & { type: 'multi';  options: string[]; answer: { indices: number[] } };
type FillCard   = CardBase & { type: 'fill';   options: null;     answer: { accept: string[]; hint?: string } };
export type Card = SingleCard | MultiCard | FillCard;
```

### 6. 首页接真实数据

`app/(tabs)/index.tsx` 改成：

- 顶部：`ByteCard` 标题（mono，letterSpacing 2）+ 今日日期（`textDim`）
- 中间：进度环（先用静态 0/15 的占位实现，SVG 画好；下一阶段接真数据）
- 一个「开始学习」主按钮，点击 `router.push('/study')`
- 底部一行小字：`共 100 张卡 · 6 个学科包`（从 repository 真实读取）
- 加载中显示骨架（不要转圈 spinner，用 `surfaceAlt` 色块占位）

初始化时机：在 `app/_layout.tsx` 里 `useEffect` 调一次 `initDatabase()`，
用 Zustand 存一个 `ready` 标志，未 ready 时首页显示骨架。

### 7. 测试

`npm test` 里至少覆盖：

- `src/db/seed.ts` 的数据校验函数（把 `spec/02` 第 7 节的自检项写成一个纯函数 `validateDecks(json)`，
  测试它对正确的数据返回空数组、对缺字段/重复 id/越界 index 的数据返回对应错误）。
- `src/utils/fill.ts` 的答案归一化（写 `normalizeAnswer`，覆盖全角、空格、大小写、编辑距离几种场景）。

DB 层不做单测（expo-sqlite 在 Node 环境麻烦），靠真机验证。

## 验收（你要自己确认后再交付）

- [ ] App 启动一次后，首页显示 `共 100 张卡 · 6 个学科包`
- [ ] 杀掉 App 重开，seed **不会**重复插入（数量仍是 100）
- [ ] `npx tsc --noEmit` 零错误
- [ ] `npm test` 全绿
- [ ] `validateDecks` 对内置题库返回空数组
- [ ] 没有任何 SQL 出现在 `src/db/` 之外的目录

## 交付时告诉我

1. 实际生成的卡片数量（每个 deck 各多少）。
2. seed 耗时。
3. 你在生成题目时**拿不准而主动跳过**的知识点有哪些（如果有）。
4. 我该怎么确认数据真的进库了（给我一条可以在「我的」页临时显示的调试命令，或者告诉我用哪个
   Expo 的调试手段看）。

---
