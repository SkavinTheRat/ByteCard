# 阶段 9 · App 内 AI 出卡（先答再收，审核入库）

> 前置：阶段 6 已完成（`AIProvider` 能用），阶段 8 至少跑过一轮（有 `topics.json`）。
> 核心设计：**生成的卡不是直接进题库，而是先让用户答一遍，再决定收不收。**
> 这个设计把「审核」这件苦差事藏进了学习动作里——用户本来就要做题。

---

## 为什么不做一个「AI 出卡」独立页面

如果做成「点按钮 → 生成 10 张 → 进题库」，必然的结果是：生成 100 张，用户看了 3 张，
剩下 97 张里混着错误知识，永远躺在库里污染复习队列。

所以流程必须是：**生成 1 张 → 当场作答 → 用户表态 → 才入库**。
每张卡都有一次「人过目」，成本接近零，但垃圾进不来。

---

## 任务

### 1. 数据库迁移到 v2

`src/db/migrate.ts` 加一段 `if (userVersion < 2)` 的迁移：

```sql
ALTER TABLE cards ADD COLUMN source TEXT NOT NULL DEFAULT 'seed';   -- seed | ai
ALTER TABLE cards ADD COLUMN verified_at TEXT;                      -- AI 卡的确认时间，seed 卡为 NULL
```

`PRAGMA user_version = 2`。

- `source = 'ai'` 且 `verified_at IS NULL` 的卡**不参与每日队列**
  （`buildTodayQueue` 的 WHERE 条件里加 `AND (c.source = 'seed' OR c.verified_at IS NOT NULL)`）。
- 迁移必须幂等：先查 `PRAGMA table_info(cards)` 判断列是否存在，再 ALTER。

`src/types.ts` 的 `CardBase` 加 `source: 'seed' | 'ai'`、`verifiedAt?: string`。

### 2. 知识点清单进包 `assets/data/topics.json`

从阶段 8 的 `tools/gen-cards/syllabus.json` **裁剪**出一份轻量版（只留 id / name / deckId / points，
去掉 target / types / difficulty），体积控制在 30KB 内。

```jsonc
{ "version": 1, "topics": [
  { "id": "ds-linear-list", "deckId": "ds", "name": "顺序表与链表",
    "points": ["顺序表插入删除的平均移动次数", "头结点与头指针的区别"] }
]}
```

seed 时一并入库（新建表 `topics`，或直接读 JSON 不建表——**建议不建表**，
这个数据只读，从 JSON 读进内存就行，省一次迁移）。

### 3. 生成服务 `src/ai/generateCard.ts`

```ts
export type GenerateResult =
  | { ok: true; card: DraftCard }
  | { ok: false; reason: 'skipped' | 'low_confidence' | 'invalid' | 'network'; message: string };

export async function generateCard(input: {
  deckId: string;
  topicId?: string;
  point?: string;
  existingStems: string[];      // 该 deck 已有题干的摘要（最多 20 条，取前 40 字）
  signal?: AbortSignal;
}): Promise<GenerateResult>;
```

- **复用阶段 8 的 prompt 模板**：把 `buildPrompt` 逻辑抽到 `src/ai/prompts.ts` 里
  （`tools/gen-cards/prompt.ts` 改为从 `src/ai/prompts.ts` 导入，保证两边同一套 prompt）。
  这一点很重要——线上/离线出题风格不一致会让题库变得很杂。
- `temperature: 0.9`（要多样性）、`max_tokens: 800`、要求严格 JSON 输出。
- 拿到结果后**立刻本地校验**（复用 `src/utils/cardValidate.ts`，逻辑同阶段 8 的 validate，
  但只做结构校验，不做相似度）：
  - JSON 解析失败 → `invalid`
  - 缺字段 / index 越界 → `invalid`
  - `confidence < 0.7` → `low_confidence`
- `DraftCard` 是 `Card` 去掉 `id` / `sortOrder`，加 `aiConfidence`、`sourcePoint`。

### 4. 去重 `src/utils/similarity.ts`

照阶段 8 的字符 3-gram + Jaccard 实现（`normalizeQuestion` 先去掉标点空白）。

入库前检查：与该 deck 全部已有题干相似度 > 0.75 → 拒绝，提示
`题库里已有类似的卡：<已有题干前 20 字>` + 「去重」按钮（重新生成）。
相似度检查对 100~400 张卡的规模，本地同步算就行（< 50ms），不要放 worker。

### 5. 交互流程（核心，严格照做）

**入口三处：**

| 位置 | 文案 | 预填参数 |
| --- | --- | --- |
| 统计页「分学科正确率」每行右侧 | 一个 `+` 图标按钮 | 该 deck，正确率最低的 topic |
| 错题本单卡回顾页底部 | `针对这个考点再出一题` | 该卡的 `tags[0]` 对应的 topic |
| 我的 → `AI 补卡` | 列表行，显示今日已生成次数 | 用户自己选学科 |

**流程（用 `app/ai-card.tsx` 一个路由完成，不拆多页）：**

1. **加载态**：整页居中显示 `正在出题…` + 3 点动画 + 下方 `micro` 灰字 `这会影响你的复习队列，稍等`。
   超过 8s 显示 `模型想得有点久…`，20s 走超时提示。
2. **出题成功**：以**正常卡片的样子**展示（复用 `KnowledgeCard`），但左上角加一个
   `micro` 标签 `AI 生成 · 待确认`（`warning` 色描边胶囊）。
   答题交互完全复用阶段 3 的逻辑——**这一步不能简化**，用户要真实作答才能判断题目好坏。
3. **提交后**：显示解析面板（`explain` 用 AI 生成的那份）+ 下方一块「确认区」：

```
┌─────────────────────────────────────┐
│ 这张卡值得收进题库吗？               │
│                                     │
│  [ 收进题库 ]      [ 扔掉 ]          │
│                                     │
│  · 收进来会出现在你以后的复习队列里   │
│  · 扔掉就删掉，不会再出现             │
└─────────────────────────────────────┘
```

- `收进题库` 是主按钮（`primary` 填充）。
- `扔掉` 是次要按钮（`surface` + `border`，`textDim` 文字）。
- 两个都**必须**点，不给「返回」直接跳过的机会（返回手势禁用，只留 close；
  close 时提示 `这张卡没保存，要收进题库再走吗？`）。

4. **入库动作**：
   - 分配 id：`ai-{timestamp36}`（前缀区分，方便以后批量清理）
   - `INSERT INTO cards (... source='ai', verified_at=now)`
   - 同时创建 `review_states`（`status='new'`，`due_at=now`）
   - 完成后 `router.back()`，回到来的页面，顶部短暂显示 `已收进题库，共 321 张`
5. **失败态**：
   - `skipped` / `low_confidence` → `这个知识点模型自己也不确定，换一个试试。` + `换一题` 按钮
   - `invalid` → `生成的题目格式不对，重试一次？` + `重试`
   - `network` → 复用阶段 6 的错误文案
   - 所有失败态都要有一个「直接返回」的出口，不能把用户困在这一页。

### 6. 成本与防滥用

- `settings.ai_gen_limit` 默认 `'10'`（每天最多生成 10 张）。
- 计数存 `settings.ai_gen_count_{YYYY-MM-DD}`，跨天自动归零（读的时候判断日期）。
- 达到上限：入口按钮置灰 + `今天已经出 10 张了，明天再来。`
- 生成成功后显示一行 `micro`：`本次消耗约 900 tokens`（按实际 usage 字段填，
  没有 usage 就用字数估算，标明是估算）。

### 7. 管理 AI 补充的卡

我的 → `AI 补卡` 页下半部分：

- 一行统计：`已收进题库 12 张（占 4%）`
- `查看全部` → 列表（题干前 30 字 + 学科 + 加入时间），支持长按删除（二次确认）
- `批量清空 AI 补充卡` → 二次确认，文案要写明后果：
  `会删除 12 张 AI 生成的卡和它们的复习记录，你自己抽认的进度不受影响。`

## 不要做的事

- 不要让 AI 生成的卡**跳过作答**直接入库。
- 不要做「一次生成 10 张」（一张一张来，用户才有耐心审）。
- 不要在没有网络的降级路径里用 Mock 生成假卡（Mock 只适用于讲解，不适用于出题）。
- 不要用 `Alert`。

## 验收

- [ ] 从统计页点 `+`，能走到「收进题库」，入库后首页卡片数 +1
- [ ] 收进来的卡当天就出现在复习队列里（因为 `due_at = now`）
- [ ] 点「扔掉」后，`cards` 表和 `review_states` 里都没有残留
- [ ] 生成一张和已有卡高度相似的题（可以临时把 prompt 的 existing 清空来触发），
      会被去重拦住并提示
- [ ] 生成过程中按 close 退出，不产生任何入库
- [ ] 每天生成第 11 张时被拦住
- [ ] 旧版本升级到 v2 后，原有 100 张卡的复习进度完好
- [ ] `buildTodayQueue` 里确实排除了 `unverified` 的卡
- [ ] `npx tsc --noEmit`、`npm test` 全绿

## 交付时告诉我

1. 你最终选的 prompt `temperature` 和实际观察到的题目多样性。
2. 生成 5 次里，`skip` / `low_confidence` / `invalid` 各出现几次。
3. 一次生成的实际 token 消耗（input + output）。
4. 如果用户答错了这张 AI 卡，你怎么处理「卡本身没问题，是用户不会」和
   「卡本身有问题，用户才答错」这两种情况的区分——说清你的判断逻辑。

---
