# ByteCard 扩展手册

## 加一种新题型

1. 新建 `src/cards/types/<type>/definition.ts`，实现 `CardDefinition`，判分逻辑写在 `grade()`。
2. 新建同目录 `AnswerView.tsx`，只通过 `AnswerViewProps` 接收状态，不读全局 store。
3. 用 `definition.validate()` 校验 `type` 专属结构，错误的 JSON 必须返回中文错误。
4. 在 `src/cards/index.ts` 增加 `import` 和一行 `registerCard()`。
5. 在 `spec/02-deck-schema.md` 写明字段；需要 AI 生成时再扩展共享 prompt。
6. 增加 3 张 fixture 或真实卡，测试 `grade()` 的对、错和边界。

## 当前题型

| type | schemaVersion | 字段位置 | 说明 |
| --- | ---: | --- | --- |
| `single` | 1 | `options` + `answer.index` | 四选一 |
| `multi` | 1 | `options` + `answer.indices` | 多选 |
| `fill` | 1 | `options: null` + `answer.accept` | 文本填空 |
| `judge` | 1 | `options: null` + `answer.value` | 判断正误 |

新增题型的专属字段放 `payload`。`options` 和 `answer` 只保持既有含义，避免旧版本
`JSON.parse` 后拿到不兼容结构。

## 三个反例

- 不要在 `study.tsx` 写 `if (card.type === 'xxx')`，所有题型都通过注册表取 `AnswerView`。
- 不要把图片路径、代码语言等新结构塞进 `options` / `answer`，它们属于 `payload`。
- 不要为了新题型顺手改通用 `tokens` 或现有题型组件，否则三种旧题型会一起变样。

## 加一个学科

在 `assets/data/decks.json` 增加一条 deck，在 `assets/data/cards/<id>.json` 增加卡片文件，
再把文件加入 `src/db/seed.ts` 的静态导入。颜色只以该 deck 的 `accent` 为准，代码通过
`deckAccent()` 读取，不新增 `colors.deck.<id>` 硬编码。

## 数据库迁移纪律

1. 只加表、加列、加字段；废弃字段保留但停止读取，不删除、不改名。
2. 每个版本独立 `if (userVersion < N)`，每步先查 `PRAGMA table_info`，保证幂等。
3. 每个迁移在事务内完成，失败回滚，不留下半迁移状态。
4. 迁移绝不清理 `review_states` 或 `review_logs`，用户进度是最高优先级数据。
5. 版本号只加不减；新版本 App 遇到更高数据库版本时降级为只读告警，不尝试回退。
