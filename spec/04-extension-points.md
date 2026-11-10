# 扩展点规格（Extension Points）

> 这份文档回答一个问题：**以后要加新东西，我该动哪些文件、不该动哪些文件？**
> 原则：只对「已知一定会扩」的方向做抽象，其余只留接缝，不提前设计。

## 0. 设计原则：只做一根柱子

按你的选择，未来明确会扩的只有**题型**（图片卡、判断题、代码填空）。
所以：

| 方向 | 处理 |
| --- | --- |
| 题型 | **做厚**：注册表 + 每题型独立目录 + 判分自带 |
| 学科包 | 配置驱动：只加 JSON，不改代码 |
| 题库规模 | 已由阶段 8 生产线解决，不需要新架构 |
| 云同步 / 多端 / 浅色主题 | **不做抽象**，只在文中标出「将来会卡在哪」 |

**为什么不全做**：每层抽象都有维护成本。DeepSeek 跑 Codex 时，多一层间接就多一处写错的机会。
你现在不需要云同步，加一层 SyncAdapter 只会让 `repository` 变难读。

---

## 1. 题型扩展（核心）

### 1.1 现状为什么卡住

> 下面这段是「不用注册表会怎样」的对照说明。如果你的项目从阶段 3 起就按本文实现，
> 可以只扫一眼——症状你已经避开了。

现在的三种题型，**同一个题型的三件事散落在三个文件里**：

| 事 | 现在在哪 |
| --- | --- |
| 数据结构（`options` / `answer` 长什么样） | `src/types.ts` 的可辨识联合 |
| 作答 UI（长什么样、怎么交互） | `app/study.tsx` 里的 if/else |
| 判分逻辑（对错、quality） | `src/srs/grading.ts` 里的 switch |

加第 4 种题型要改 3 个文件，而且 `study.tsx` 会越来越像一锅粥。
**注册表的作用是把这三件事打包成一个文件。**

### 1.2 新结构

```
src/cards/
├── registry.ts              # 注册表 + 查找 + 兜底
├── index.ts                 # 集中注册所有题型（import 即注册）
└── types/
    ├── single/
    │   ├── definition.ts    # CardDefinition 对象（元数据 + grade）
    │   ├── AnswerView.tsx   # 作答 UI
    │   └── schema.ts        # validate()（可选，简单题型写在一起也行）
    ├── multi/…
    ├── fill/…
    └── judge/…              # 阶段 10 新增，作为架构验证
```

**加一个新题型 = 新建一个目录 + 在 `index.ts` 加一行 import。**
不改 `study.tsx`、不改 `types.ts`、不改 `grading.ts`。

### 1.3 接口定义 `src/cards/registry.ts`

```ts
import type { ComponentType } from 'react';
import type { Card } from '@/types';

export type RawAnswer =
  | { kind: 'index'; value: number }          // 单选 / 判断
  | { kind: 'indices'; value: number[] }      // 多选
  | { kind: 'text'; value: string }           // 填空 / 代码填空
  | { kind: 'custom'; value: unknown };       // 新题型的逃生口

export type GradeResult = {
  isCorrect: boolean;
  quality: number;                 // 0~5，直接喂给 SM-2
  correctText: string;             // 展示用的标准答案
  matchedBy?: 'exact' | 'near' | 'partial';
  feedback?: string;               // 附加提示（如"基本正确，标准写法是…"）
};

export type AnswerViewProps<C extends Card = Card> = {
  card: C;
  phase: 'answering' | 'revealed';
  draft: unknown;                            // 组件自己管草稿结构
  onDraftChange: (d: unknown) => void;
  onSubmit: (raw: RawAnswer) => void;
  result: GradeResult | null;
};

export interface CardDefinition<C extends Card = Card> {
  /** 唯一 id，小写英文，与数据库 cards.type 一致 */
  type: string;
  /** 中文名，用于设置页筛选、错题本标签、统计 */
  label: string;
  /** 题型自身的 schema 版本，加字段时 +1，用于数据迁移判断 */
  schemaVersion: number;
  /** 结构校验：返回错误信息数组，空数组 = 通过 */
  validate(card: unknown): string[];
  /** 作答 UI。注册表只认这个契约，不关心内部怎么画 */
  AnswerView: ComponentType<AnswerViewProps<C>>;
  /** 判分 + quality。SM-2 只吃 quality，跟题型解耦 */
  grade(input: { card: C; raw: RawAnswer; elapsedMs: number }): GradeResult;
  /** 可选：列表/错题本里的单行摘要，没实现就用题干截断 */
  preview?(card: C): { title: string; subtitle?: string };
}

const registry = new Map<string, CardDefinition>();

export function registerCard(def: CardDefinition): void {
  if (registry.has(def.type)) {
    throw new Error(`Card type "${def.type}" 已注册，检查 src/cards/index.ts`);
  }
  registry.set(def.type, def as CardDefinition);
}

export function getCardDef(type: string): CardDefinition | undefined {
  return registry.get(type);
}

export function isSupportedType(type: string): boolean {
  return registry.has(type);
}

export function listCardDefs(): CardDefinition[] {
  return [...registry.values()];
}
```

### 1.4 调用点怎么改

**`app/study.tsx`**（原来是一堆 if/else）：

```tsx
const def = getCardDef(card.type);
if (!def) return <UnsupportedCard card={card} />;
const AnswerView = def.AnswerView;

<AnswerView
  card={card}
  phase={phase}
  draft={draft}
  onDraftChange={setDraft}
  onSubmit={handleSubmit}
  result={result}
/>
```

`handleSubmit(raw)` 只做三件事：调 `def.grade()` → 存 `result` → `repository.submitAnswer()`。

**判分下沉到各题型**。如果项目里还存在 `src/srs/grading.ts`（集中的 switch 实现），删掉它——
判分已经搬到 `definition.grade()` 里。SM-2 只接收 `quality` 数字，它不需要知道题目长什么样。
这是解耦的关键。

### 1.5 加一个题型的完整清单

照着做，全程不改既有文件（除了 `index.ts` 一行）：

- [ ] 建 `src/cards/types/<type>/definition.ts`，实现 `CardDefinition`
- [ ] 建 `AnswerView.tsx`，从 `spec/03` 取视觉规范
- [ ] 在 `src/cards/index.ts` 加 `import` 和数组项
- [ ] 在 `spec/02-deck-schema.md` 补该题型的 JSON 字段说明
- [ ] 在 `src/db/seed.ts` 的 `validateDecks()` 里让它走 `def.validate()`（不用写新逻辑）
- [ ] 在 `tools/gen-cards/prompt.ts` 补该题型的出题模板（如果要 AI 生成）
- [ ] 建一个只含 3 张该题型卡的 `assets/data/cards/_fixture.json`，写单测验证 `grade()` 的边界

### 1.6 未知题型的降级（必须有）

题库内置不代表不会出错：阶段 8 生产线可能生成了新题型，你装的却是旧包。

- `buildTodayQueue` 的 SQL 拿到结果后，**在 repository 层过滤**掉 `!isSupportedType(card.type)` 的卡。
- 统计页如果有被过滤的卡，显示一行：`有 8 张卡需要更新 App 才能学`（`warning` 色，不可点）。
- 学习页若万一走到未知题型（比如从错题本直接进的旧数据），`UnsupportedCard` 显示：
  `这张卡是新题型，当前版本看不了。` + 跳过按钮。
- **绝不崩溃，绝不白屏。**

---

## 2. Schema 演进规则

### 2.1 去掉 `type` 的 CHECK 约束

`spec/01` 原来的建表语句里有：

```sql
type TEXT NOT NULL CHECK (type IN ('single','multi','fill'))
```

这是硬编码瓶颈——加题型必须改 DDL、做表重建。**v3 迁移里去掉它**，
改成应用层校验（`def.validate()` + `isSupportedType()`）。

SQLite 不支持 `ALTER TABLE ... DROP CONSTRAINT`，需要重建表：

```sql
-- v3 迁移
CREATE TABLE cards_new (... type TEXT NOT NULL, payload TEXT NOT NULL DEFAULT '{}' ...);
INSERT INTO cards_new SELECT id, deck_id, type, question, code, options, answer, explain,
       tags, difficulty, ai_explain, sort_order, source, verified_at, '{}' FROM cards;
DROP TABLE cards;
ALTER TABLE cards_new RENAME TO cards;
-- 重建索引
```

> 注意：重建表时 `review_states` 的外键会受影响。迁移前 `PRAGMA foreign_keys = OFF`，
> 迁移后 `ON`，并在事务里做。

### 2.2 新增 `payload` 列

```sql
ALTER TABLE cards ADD COLUMN payload TEXT NOT NULL DEFAULT '{}';
```

用途：**新题型专属字段全放这里**，`options` / `answer` 两列保持不变以兼容已有 100 张卡。

| 题型 | 用什么字段 |
| --- | --- |
| `single` / `multi` / `fill`（旧） | 继续用 `options` + `answer` |
| `judge` | `answer`（`{ "value": true }`），`options` 为 `null` |
| `image` | `payload.image`（相对路径） + `options` + `answer` |
| `code` | `payload.code`（带 `___` 占位）+ `answer.accept` |

规则：**新题型不许往 `options` / `answer` 里塞自定义结构**，那是旧接口。
一旦往旧字段塞新东西，老版本 App 的 `JSON.parse` 就可能炸。

### 2.3 迁移纪律（写进 AGENTS.md 更保险）

1. 只**加**列、加表、加字段，**不删不改名**。要废弃就留着，代码里不再读。
2. 每次迁移一个 `if (userVersion < N)` 块，幂等（先查 `PRAGMA table_info`）。
3. 迁移必须在事务里，失败要能回滚。
4. 迁移完成后不清空 `review_states` / `review_logs`（用户的命）。
5. 版本号只能 +1，不能跳。

---

## 3. 学科包扩展（改成配置驱动）

现在的毛病：`tokens.deck` 里硬编码 6 个学科色，和 `decks.json` 的 `accent` 重复维护。

**改法**：

- `decks.json` 的 `accent` 是**唯一真相**。
- `tokens.deck` 改为兜底表，只在取不到 accent 时使用：

```ts
// src/theme/deckColor.ts
export function deckAccent(deck: { accent?: string; id: string }): string {
  return deck.accent ?? colors.deck[deck.id as keyof typeof colors.deck] ?? colors.primary;
}
```

- 所有用到学科色的组件（卡片顶栏、统计条、错题本标签）统一调 `deckAccent()`。
- 加第 7 个学科：只加一条 `decks.json` 记录 + 相应卡片，**代码零改动**。

---

## 4. 三种待加题型的规格

### 4.1 `judge`（判断题）—— 阶段 10 实现，用来验证架构

```jsonc
{
  "id": "ds-101", "deckId": "ds", "type": "judge",
  "question": "在单链表中，删除已知结点 p 的后继结点，时间复杂度是 O(1)。",
  "code": null, "options": null,
  "answer": { "value": true },
  "explain": "……", "tags": ["链表"], "difficulty": 2
}
```

- UI：不用四个小选项，而是**两个大按钮**（占满宽度，各高 88）：
  上行 `✓ 正确`（`success`），下行 `✗ 错误`（`danger`）。左侧还要一个 44×44 的竖滑手势区？
  **不要手势**，点按就行——手指在通勤时点不准。
- 提交后：选中的按钮填充色，未选中的降到 30% 不透明度；正确项加 2px 描边。
- `grade`：`raw.kind === 'index'`（0=正确，1=错误）与 `answer.value` 比对。
  quality 规则同单选（≤15s 得 5，否则 4，错 0）。
- **这个题型的价值不在「少点两下」，而在证明注册表能容纳完全不同的 UI。**
  如果你选择把它硬套成 `single` + `options:["正确","错误"]`，那注册表的第一个用例就消失了。

### 4.2 `image`（图片卡）—— 后续，成本最高

```jsonc
{ "type": "image", "options": [...], "answer": { "index": 1 },
  "payload": { "image": "ds/stack-push.svg", "caption": "入栈过程" } }
```

- 图片放 `assets/images/cards/{deckId}/`，`payload.image` 只存**相对路径**，不存 URL
  （题库内置、离线优先，绝不依赖网络图片）。
- **体积红线**：全部图片合计 ≤ 3MB。优先 SVG（`react-native-svg` 已装），
  位图必须压缩到 ≤ 100KB/张、宽度 ≤ 720px。
- 布局：图片在上（`aspectRatio: 4/3`，`resizeMode: 'contain'`），题干在下，选项在最下。
- 图片加载失败（路径写错）：显示一个 `surfaceAlt` 占位块 + `图片缺失` 灰字，**不要留白**。
- 这题型的真正成本不是代码，是**画图**。30 张卡 × 1 张图 ≈ 半天的设计工作。
  在没解决图源之前不要开工。

### 4.3 `code`（代码填空）—— 后续，性价比中等

```jsonc
{ "type": "code", "question": "补全快速排序的划分函数：",
  "payload": { "code": "int part(int a[],int l,int r){\n  int p=a[l], i=l;\n  for(int j=l+1;j<=r;j++)\n    if(a[j]<p) swap(a[++i],a[j]);\n  ___(1)___;\n  return i;\n}", "lang": "c" },
  "answer": { "accept": ["swap(a[l],a[i])", "swap(a[i],a[l])"] } }
```

- `payload.code` 里的 `___(1)___` 是占位符，UI 把它替换成一个内联输入框
  （`bg surface`、`border primary`、宽度按字符估算 8px/字符 + 24）。
- 渲染：整块 `fontFamily: mono`、`fontSize: 12`、`bg #0A0D13`、横向可滚动（`ScrollView horizontal`
  + `scrollEnabled` 到内容宽度），避免长行折行破坏缩进。
- 判分：复用 `normalizeAnswer()` + `accept` 数组 + 编辑距离 ≤1 判"近似"。
- 风险：**键盘遮挡 + 代码里的中英文标点输入**是最大的体验坑。先用 3 张卡试，
  别一次性做 50 张。

---

## 5. 不做抽象的方向（以及将来会卡在哪）

写在这里是为了避免以后误以为「当初没想到」——是**想到了，主动放弃**。

| 方向 | 现在会卡在哪 | 将来要做的话，第一步改哪 |
| --- | --- | --- |
| 云同步 | `repository` 的接口是 SQLite 语义（`buildTodayQueue` 直接吐排好序的数组），没法换实现 | 把 `repository` 拆成「纯计算（queue/srs）+ 存取（store 接口）」，先拆再看同步 |
| 多端（平板/Web） | 布局写死手机单列，`SafeAreaView` + 固定高度 | 引入 `useBreakpoint()`，把三个主页面改成两栏，工作量在布局不在逻辑 |
| 浅色主题 | `tokens` 是常量导出，不是 context | 把 `colors` 改成 `useTheme()` 返回，所有组件改引用方式——**这是全局改动，越晚做越贵** |
| 题库热更新 | `require` 静态引入，`assets` 打进包 | 加 `remoteSource` + 签名校验 + 本地缓存目录，涉及 `expo-file-system` |
| 多语言 | `i18n/zh.ts` 只是文案常量，没有 plural / 插值 / 切换 | 换 `i18n-js` 或自写 `t(key, params)`，文案文件拆 `zh.ts` / `en.ts` |
| 社交 / 排行榜 | 无账号无后端 | 等于从零加一个后端，不在当前架构讨论范围 |

---

## 6. 扩展性自检清单

每次加完新东西，问自己这 6 个问题：

- [ ] 我加这一样，改了几个**已有**文件？（理想 ≤ 2，超过说明抽象不够）
- [ ] 旧数据（已有的 100 张卡和用户进度）会不会坏？
- [ ] 旧版本 App 遇到新数据会怎样？（崩溃 / 降级 / 忽略，必须是后两个）
- [ ] 新代码有没有把「题型/学科/文案」写死在 `if` 里？
- [ ] 删掉这个功能，能干净删掉吗？（还是散在 8 个文件里）
- [ ] 三个月后的我看得懂吗？（注释里有没有写清「为什么这么设计」）
