# 阶段 8 · 离线题库生产线（按知识点批量生成）

> 这是**开发期工具**，不进 App 安装包。目标：把题库从 100 张扩到 300+，且质量可控。
> 与阶段 2 的区别：阶段 2 是「让 Codex 在对话里手写 100 张」，
> 这是一套**你以后可以自己反复跑**的流水线，产出带校验的 JSON。

---

## 为什么必须按知识点生成，不能「帮我生成 20 张数据结构」

直接让模型生成一批题，会稳定地出现三个问题：

1. **扎堆**：20 张里有 8 张都在考「时间复杂度」，因为你没告诉它缺什么。
2. **趋同**：同一个知识点它每次都给最经典的问法，和第 1 批高度重复。
3. **逃避**：遇到需要算的题（Cache 命中率、子网划分、银行家算法），它会退化成概念题，
   导致题库「看着有 300 张，实际覆盖不到计算题」。

解法是先有一份**知识点清单**（syllabus），逐条生成、逐条校验、逐条记配额。
这也是本阶段的核心设计。

---

## 任务

### 1. 知识点清单 `tools/gen-cards/syllabus.json`

按 `spec/02-deck-schema.md` 的 6 个学科包，把考点拆到「一个知识点 = 1~3 张卡」的粒度。
结构：

```jsonc
{
  "decks": {
    "ds": {
      "name": "数据结构",
      "topics": [
        {
          "id": "ds-linear-list",
          "name": "顺序表与链表",
          "points": [
            "顺序表插入/删除的平均移动次数",
            "单链表与双链表的结构差异",
            "头结点与头指针的区别",
            "循环链表的判空条件"
          ],
          "target": 4,                       // 目标卡片数
          "types": ["single", "fill"],       // 允许的题型（计算类别用多选）
          "difficulty": [1, 2]               // 允许的难度
        }
      ]
    }
  }
}
```

要求：

- `ds` / `co` / `os` / `cn` 各拆 **12~15 个 topic**，`ai` / `agent` 各 **6~8 个**。
- `points` 里必须是**可单独成题的最小表述**，不能写「排序算法」这种大块。
- 计算类 topic（Cache 命中率、页面置换、子网划分、调度算法、哈夫曼编码）
  必须显式列出，且 `types` 限定 `["single", "fill"]`、`difficulty: [2, 3]`。
  在文件顶部用注释（`.json` 不支持注释就用 `"_note"` 字段）标出这批 topic，
  生成时**单独跑、单独抽查**——这是最容易出错的部分。
- 首版 `target` 总和控制在 **220~260 张**（加上已有的 100 张，总量 320~360）。
  一次别贪多，先跑一轮看质量。

### 2. 出题 Prompt 模板 `tools/gen-cards/prompt.ts`

这是整条流水线的质量核心。写成导出字符串的函数 `buildPrompt(topic, points, existingStems, examples)`。

**系统提示词：**

```
你是计算机考研 408 与 AI 基础的命题助教。你的任务是为指定的知识点出单选题/多选题/填空题，
用于一个记忆卡片 App。学生会在手机上快速作答，所以题干必须短而明确。

【输出格式】只输出一个 JSON 对象，不要任何解释文字，不要 Markdown 围栏：
{
  "skip": false,
  "type": "single",
  "question": "题干",
  "code": null,
  "options": ["A项", "B项", "C项", "D项"],
  "answer": { "index": 0 },
  "explain": "解析",
  "tags": ["标签1", "标签2"],
  "difficulty": 2,
  "confidence": 0.9,
  "sourcePoint": "对应 syllabus 里的哪个 point"
}

【硬性规则】
1. 题干自包含，不出现"上图""前文""如下所示"。可以写短代码/公式，放在 code 字段（单行≤40字符）。
2. 干扰项必须是同类知识的常见混淆点。严禁出现"以上都对""以上都不对""无法确定"这类废选项。
3. 正确选项的字符长度不得明显长于其他选项（避免长度暗示答案）。四项长度差控制在 1.5 倍以内。
4. explain 写三段（2~4 句，80~150 字）：①正确依据 ②其他项错在哪 ③一句口诀或考点提醒。
5. difficulty：1=概念记忆，2=需要推理，3=综合计算/易错陷阱。
6. 你的 confidence 表示本题知识点的确定性。**如果你对某个公式、数值、边界条件不确定，
   宁可 skip 也不许编。** skip 时返回 {"skip": true, "reason": "具体不确定什么"}。
7. 不要重复 existing 里已出现过的题干或同一考法。
8. 只考 sourcePoint 指定的内容，不要扩展到别的知识点。
```

**用户消息模板：**

```
学科：{deckName}
知识点：{topic.name}
本题要求覆盖的考点：{point}
题型：{type}
难度：{difficulty}

已有题目（不要重复这些考法）：
{existingStems 逐条编号，最多 20 条，超出的截断}

风格示例（模仿这种密度和语气，不要抄内容）：
{examples：从已有题库里抽 2 张同 deck 的高质量卡，序列化后贴上}
```

参数：`temperature: 0.85`（需要多样性）、`max_tokens: 800`。
**每请求只生成 1 张卡。** 不要一次要 5 张——单张的质量远高于批量。

### 3. 生成脚本 `tools/gen-cards/generate.mjs`

纯 Node（≥20），零依赖，用原生 `fetch`。

```bash
node tools/gen-cards/generate.mjs --deck ds            # 跑整个学科
node tools/gen-cards/generate.mjs --topic ds-linear-list --count 4
node tools/gen-cards/generate.mjs --deck co --only-calc # 只跑计算类
```

行为：

- 读 `syllabus.json`，对每个 topic 循环请求 `target` 次。
- 每次请求前从 `out/` 里已生成的卡里取该 topic 的题干，作为 `existingStems` 传入。
- 结果写入 `tools/gen-cards/out/{deckId}/{topicId}-{n}.json`，**一卡一文件**
  （方便你单独删掉某张烂卡，也方便断点续跑）。
- 已有同名文件则跳过（幂等），加 `--force` 覆盖。
- 并发控制在 **3**（`Promise` 池），别把接口打爆。
- 每完成一个 topic 打印一行：`ds-linear-list  4/4  ok  (skip 0, lowConf 1)`。
- `skip: true` 或 `confidence < 0.7` 的结果写到 `out/{deckId}/_rejected/`，
  并在最后打印汇总，让你知道哪些知识点模型自己承认不会。
- 所有请求要 `AbortController` 超时 60s，失败重试 2 次（指数退避）。

### 4. 校验脚本 `tools/gen-cards/validate.mjs`

```bash
node tools/gen-cards/validate.mjs              # 校验 out/ 下全部
node tools/gen-cards/validate.mjs --deck ds    # 只校验一个学科
```

`--fix` 能自动修的自动修（比如去掉 ``` 围栏、补全 tags），修不了的报错。

**校验规则（每条都要实现）：**

| 类别 | 规则 | 处理 |
| --- | --- | --- |
| 结构 | `type` 合法；`single` 的 `index` 在范围内；`multi` 的 `indices` ≥2 且不重复；`fill` 必须 `options: null` 且 `accept` 非空 | 报错 |
| 长度 | 题干 8~120 字（含 code 可放宽到 200）；`explain` 40~200 字 | 警告 |
| 废选项 | `options` 命中黑名单：`以上都`、`都不对`、`都不正确`、`无法确定`、`全部正确`、`均正确` | 报错 |
| 长度泄露 | 正确项长度 > 其他项平均长度 × 1.5 | 警告（人工看） |
| 选项重复 | 同一卡内两个选项归一化后相同 | 报错 |
| 选项数量 | `single` 必须 4 项；`multi` 3~5 项 | 警告 |
| 解析质量 | `explain` 里不含"正确答案是""选A"以外的空话；不以"这道题"开头 | 警告 |
| **题内去重** | 与同 deck 已有卡做字符 3-gram Jaccard 相似度 > 0.75 | 报错（重复） |
| **跨批去重** | 与 `assets/data/cards/*.json` 里已有卡同样算法 > 0.75 | 报错（重复） |
| 难度分布 | 每个 topic 内 1/2/3 的比例偏离 4:4:2 超过一档 | 警告 |
| 配额 | 每个 topic 实际通过数 < `target` | 警告（提示补跑） |
| 标签 | 标签数 1~3；与全局已有标签做同义检查（`复杂度` vs `时间复杂度`） | 警告 |

相似度函数写 `tools/gen-cards/similarity.mjs`（字符 3-gram + Jaccard），
**不要引入 embedding 或第三方 NLP 库**——题干都短，这个够用且零依赖。

`validate.mjs` 最后输出一份 `out/report.md`：
每个 deck 通过/拒绝数、被拒原因分布、需要人工看的警告清单。

### 5. 合并入库 `tools/gen-cards/merge.mjs`

```bash
node tools/gen-cards/merge.mjs --deck ds --dry-run   # 只看会加哪些
node tools/gen-cards/merge.mjs --deck ds             # 真的写入
```

- 只合并通过校验的卡。
- **新增卡**分配 id：`{deckId}-{下一个可用序号}`（读现有最大值 +1，三位补零）。
  **已有卡的 id 一律不动**——重编号等于把用户所有复习进度清零。
- 写入 `assets/data/cards/{deckId}.json`，**按 `id` 排序**，格式化成 2 空格缩进
  （保持 diff 可读）。
- 把 `decks.json` 的 `version` +1。
- 新增 `--remove <id...>` 参数：把指定 id 从 cards json 里移出，同时写进 `decks.json`
  顶层的 `removed` 数组（墓碑列表）。**没有墓碑机制，被删的卡在老设备上会一直存在**，
  因为 App 端只会 INSERT/UPDATE，从不 DELETE。App 端逻辑见 `spec/01` 4.1 节第 ② 条。
- `--dry-run` 打印 `将新增 18 张，跳过 3 张重复，移除 1 张`。
- ⚠️ 不要在输出里生成任何 `INSERT OR REPLACE` 的示例或注释。App 端必须用 UPSERT，
  原因见 `spec/01` 4.1 节第 ① 条（REPLACE 会顺着级联删掉用户进度）。

### 6. 人工抽查流程（写 `tools/gen-cards/REVIEW.md`）

机械校验只能挡住明显垃圾，**知识错误必须人来抓**。

抽查规则写进 REVIEW.md：

- 每个 topic 抽 **1 张**（不是每个 deck，是每个 topic）。
- 计算类 topic **全查**（数量不多，但错了最致命）。
- 抽查时只回答一个问题：**「这条知识我敢拿它去考试吗？」**
  不敢 → 删掉该卡文件，`--force` 重跑这个 topic。
- 记录每批的通过率在 REVIEW.md 末尾，连续 3 批通过率 > 90% 才可以把抽查比例降到 1/3。

review 表格式：

```
| 批次 | 日期 | deck | 生成数 | 校验通过 | 抽查数 | 抽查发现错误 | 处理 |
```

**给 Codex 的提示**：这一步是给人做的，脚本只需要把待查的卡片按
`out/review-queue.md` 列出来（题干 + 答案 + 解析，一屏一张），方便你扫。

---

## 不要做的事

- 不要把 `tools/` 打进 App 包（确认 `tsconfig.json` 的 `include` 不含它，
  或者放 `tools/` 并加进 `.gitignore` 之外的排除项）。
- 不要一次生成整个题库（200+ 次请求）。**先跑 `ds` 一个学科，看质量再继续。**
- 不要用 embedding 做去重。
- 不要相信模型的 `confidence` 就等于正确率——它只是「自我感觉」，
  但能有效过滤掉它自己都在硬编的题。

## 验收

- [ ] `node tools/gen-cards/generate.mjs --deck ds` 能跑完，产出 20~25 个文件
- [ ] `validate.mjs` 能正确拒绝：重复题干、含"以上都对"的选项、`fill` 带 options 的卡
- [ ] 故意手改一张卡把答案 index 改到 9，`validate.mjs` 报错
- [ ] `merge.mjs --dry-run` 的数字和实际写入一致
- [ ] 合并后重启 App，首页卡片总数变成新的数字，**已有的复习进度没丢**
- [ ] `out/report.md` 能看出「哪些知识点生成失败、为什么」

## 交付时告诉我

1. `syllabus.json` 的 topic 数量、`target` 总和。
2. 跑 `ds` 的实际耗时、请求次数、通过率。
3. 被 `validate` 拒掉最多的三个原因。
4. **你自己认为生成质量最差的三个 topic**（我要重点抽查这些）。

---
