# ByteCard 提示词包 · 使用说明

一套给 **Codex（接 DeepSeek V4.1 Flash）** 用的分阶段提示词，用来从零生成一个
「百词斩式」的计算机知识卡片 App。

已经按你的选择定好了方案：

| 决策项 | 结论 |
| --- | --- |
| 技术栈 | React Native + Expo（TypeScript） |
| 目标平台 | Android APK（OPPO / ColorOS 15/16 真机优先），不做 iOS |
| 功能 | 刷卡答题 + SM-2 间隔重复 + 打卡统计 + AI 讲解 |
| 存储 | 纯本地 SQLite，无账号无后端 |
| 内容 | 内置约 100 张卡（408 四科为主 + AI/Agent 拓展包） |
| 题型 | 单选 + 多选 + 填空 |
| AI | 默认 Mock，填 Key 后切 DeepSeek |
| 扩展性 | 题型注册表：加新题型 = 新建一个目录 + 一行注册，不动既有文件 |
| 题库更新 | 内置为主；可选远程热更新（启动 3s 后台检查，不阻塞）；AI 卡可导出回电脑 |
| 视觉 | 深色极客风（终端窗口隐喻） |

---

## 一、目录里有什么

```
bytecard-prompts/
├── README.md                      ← 你正在看的
├── AGENTS.md                      ← 项目宪法，Codex 每次自动读取
├── spec/
│   ├── 01-data-model.md           ← 数据库表结构 + repository 接口
│   ├── 02-deck-schema.md          ← 题库 JSON 格式 + 内容质量标准 + 100 张配额
│   ├── 03-design-tokens.md        ← 色板/字体/间距 + 关键组件视觉规格
│   └── 04-extension-points.md     ← ★ 扩展点：题型注册表、schema 演进、降级策略
└── prompts/
    ├── 01-scaffold.md             ← 脚手架与导航骨架
    ├── 02-data-layer.md           ← 数据库 + 内置题库
    ├── 03-study-flow.md           ← 刷卡答题核心体验
    ├── 04-srs-daily.md            ← SM-2 与每日队列
    ├── 05-stats-settings.md       ← 统计、打卡、设置
    ├── 06-ai-explain.md           ← AI 讲解（Mock + DeepSeek）
    ├── 07-polish-ship.md          ← 引导、提醒、打包装机
    ├── 08-content-pipeline.md     ← ★ 离线题库生产线（把 100 张扩到 350 张）
    ├── 09-ai-card-generator.md    ← ★ App 内 AI 出卡（先答再收，审核入库）
    ├── 10-extensibility.md        ← ★ 题型注册表 + 加第 4 种题型（判断题）
    ├── 11-deck-distribution.md    ← ★ 题库分发：导出闭环 + 远程热更新
    └── 12-android-coloros.md      ← ★ APK 打包 + ColorOS 适配（OPPO 真机）
```

**08~11 是可选阶段**，不受前面顺序约束：

- **08 可以最早做，甚至和第 4 阶段并行。** 它只产出 JSON 文件，不动 App 代码。
  如果你觉得 100 张太少（大概率会），跑完 08 再往下做体验会好很多。
- **09 必须等 06 做完**（依赖 `AIProvider`），且建议 08 至少跑过一轮
  （依赖裁剪出的 `assets/data/topics.json`）。
- **10 在阶段 3 之后随时可做。** 注意：阶段 3 的提示词已经要求按注册表写了，
  所以 10 大概率只需做「加 judge + 降级 + 文档」这几步，跳过重构部分
  （`10-extensibility.md` 开头有个 30 秒判断方法）。
- **11 要等 02 + 08 + 09 都完成。** 它的价值取决于你真的会「持续加卡」——
  如果只是一次性建好 350 张就不再动，可以不做。
- **12 建议紧接阶段 7 做，甚至提前。** 如果你只用 Expo Go 开发，安卓那堆问题
  （强制深色反转、字体缩放裁字、手势条遮挡）会一路潜伏到装机那天才集体爆发。
  越早装一次真机 APK，越早发现布局假设是错的。

`AGENTS.md` 和 `spec/` 是**长期上下文**，一次放进仓库就不用再管。
`prompts/` 里的 7 个文件是**按顺序一次喂一个**的任务书。

---

## 二、第 0 步：把 Codex 接到 DeepSeek

### 1. 装 Codex CLI

```bash
npm i -g @openai/codex
codex --version
```

（也可以在 VS Code 里装官方 Codex 扩展，配置共用同一个 `config.toml`。）

### 2. 拿 DeepSeek 的 Key

去 platform.deepseek.com 建一个 API Key，然后设成环境变量（Git Bash）：

```bash
echo 'export DEEPSEEK_API_KEY="sk-你的key"' >> ~/.bashrc
source ~/.bashrc
echo $DEEPSEEK_API_KEY          # 必须能打印出 key，不能为空
```

### 3. 写配置

编辑 `C:\Users\zhao2\.codex\config.toml`（目录不存在就建）：

```toml
model = "deepseek-chat"
model_provider = "deepseek"
model_reasoning_effort = "medium"
approval_policy = "on-request"
sandbox_mode = "workspace-write"

[model_providers.deepseek]
name = "DeepSeek"
base_url = "https://api.deepseek.com"
env_key = "DEEPSEEK_API_KEY"
wire_api = "responses"
```

**这里有三个必须注意的点，踩了会直接连不上：**

1. **`model` 要填真实模型 id。** 上面写的是通用值 `deepseek-chat`，
   V4.1 Flash 的实际 id 请以 DeepSeek 官方模型列表（或你的服务商控制台）为准。
   填错的表现是 `model not found`。
2. **`wire_api` 的取值随 Codex 版本变。** 2026 年之后的版本只支持 `"responses"`；
   早期版本用 `"chat"`。判断方法：
   - 报 `404 / unknown endpoint / 空流` → 说明你的版本只认 Responses API，
     而 DeepSeek 只提供 Chat Completions，两者对不上。
     解法：中间加一层 LiteLLM 把 Chat Completions 翻译成 Responses，`base_url` 指向本地 LiteLLM。
   - 报 `invalid wire_api` → 改成 `"chat"`。
3. **国内网络**：`base_url` 如果被墙可换成你的中转地址；不建议在 `config.toml` 里硬写 Key
   （用 `env_key` 从环境变量读，配置才不会泄到 git 里）。

### 4. 验证

在任意目录跑 `codex`，输入：

```
用三行话解释：为什么 React Native 的 fetch 不支持读取 response.body 流。
```

能正常回你就通了。

---

## 三、第 1 步：建仓库

```bash
mkdir -p /d/ProgramWorks/ByteCard && cd /d/ProgramWorks/ByteCard

# 把提示词包里的 AGENTS.md 和 spec/ 复制进来（prompts/ 不用进仓库，或者放 docs/ 也行）
cp -r /d/Agent/WBTemp/2026-11-10-10-29-04/bytecard-prompts/AGENTS.md .
cp -r /d/Agent/WBTemp/2026-11-10-10-29-04/bytecard-prompts/spec .

git init
```

> 建议把项目放在 `D:\ProgramWorks\` 下（和你其他项目一起），不要放 C 盘。
> `prompts/` 可以留在 `docs/prompts/` 里当项目文档，也可以不放——它只是给你复制粘贴用的。

---

## 四、第 2 步：按阶段推进

在项目根目录启动 `codex`，然后**一次只贴一个 prompt 文件的内容**，等它做完、
你验收、`git commit`，再贴下一个。

| 阶段  | 文件                        | 做完你能看到什么                           | 大致工作量              |
| --- | ------------------------- | ---------------------------------- | ------------------ |
| 1   | `01-scaffold.md`          | 手机能打开，三个 Tab 可切换，深色主题正确            | 小                  |
| 2   | `02-data-layer.md`        | 首页显示「共 100 张卡」，题库已入库               | **大**（100 张卡是主要耗时） |
| 3   | `03-study-flow.md`        | 能真正刷卡答题了 ← **MVP 达成**              | **大**              |
| 4   | `04-srs-daily.md`         | 答错的卡会在该复习的那天回来                     | 中                  |
| 5   | `05-stats-settings.md`    | 统计页、热力图、学科开关、重置                    | 中                  |
| 6   | `06-ai-explain.md`        | 答错后能「换个说法」，填 Key 走真模型              | 中                  |
| 7   | `07-polish-ship.md`       | 引导页、每日提醒、能装到手机上                    | 中                  |
| 8   | `08-content-pipeline.md`  | 题库从 100 张扩到 350 张（命令行跑，不动 App）     | 中，但要人工抽查           |
| 9   | `09-ai-card-generator.md` | App 里能按薄弱点让 AI 补卡，先答再收             | 中                  |
| 10  | `10-extensibility.md`     | 加第 4 种题型（判断题）只需新建 1 个目录            | 小~中（取决于是否要重构）      |
| 11  | `11-deck-distribution.md` | AI 卡能导出回电脑；加卡不用重新打包                | 中                  |
| 12  | `12-android-coloros.md`   | APK 装到 OPPO 手机上，字体缩放/手势条/强制深色都不出问题 | 中                  |

**阶段 2 里有一个「停下来」的节点**：先只生成 `ds.json`（数据结构 20 张），
你人工看一遍题目质量，确认风格 OK 再让它继续生成剩下 5 个包。
这一步别省——AI 生成的 408 题目质量差异很大，越早校准越省事。

**阶段 3 结束就是可用的 MVP。** 如果后面没精力，做完阶段 3 + 4 就足够日常用了。

**阶段 8 建议提前做。** 它不改 App 代码，只是往 `assets/data/cards/` 里加 JSON。
你越早发现「100 张卡三天就刷完了」，越该早点跑它。

---

## 五、让 DeepSeek 跑 Codex 不翻车的 7 条实操经验

这一节比提示词本身更重要。Codex 的默认行为是按「GPT 级模型」调优的，
换成 DeepSeek 后有几个系统性差异，靠提示词和习惯规避：

**1. 一次只给一个阶段，别贪。**
「把阶段 3 到 5 一起做了」这种指令，在长上下文下后半段一定会开始偷懒——
生成 `// TODO: implement` 或者删掉前面写好的东西。

**2. 每阶段开头让它先复述计划。**
在 prompt 末尾加一句：

```
先不要写代码。用 10 行以内列出你打算改哪些文件、每个文件做什么，等我确认。
```

比它瞎写 20 个文件再返工便宜得多。

**3. 每阶段结束强制 commit。**
```bash
git add -A && git commit -m "stage 3: study flow"
```
出错时 `git checkout .` 一键回到干净状态，别让模型在你的半成品上继续修。

**4. 报错就贴原始报错，别让它「猜着重写」。**
错误示范：「刷卡页白屏了，你重新写一下 `study.tsx`」。
正确示范：把 Metro 的完整报错栈、或者红屏截图里的文字整段贴进去。

**5. 上下文快满时开新会话。**
Codex 感觉开始「忘记前面约定」时（比如突然用 Redux、突然加组件库），
直接退出重开。因为 `AGENTS.md` 会自动加载，新会话不会丢关键约束——
这也是为什么 `AGENTS.md` 要不厌其烦地写清禁止项。

**6. 单独校验「它说做完了」。**
模型经常声称「已完成」，实际漏了页面接线。验收方式：
让它执行 `npx tsc --noEmit` 并把**原始输出**贴出来，不是让它用嘴保证。

**7. 别让它自由发挥视觉。**
`spec/03-design-tokens.md` 存在的意义就是锁死配色。如果它开始自创颜色
（出现 `#333`、`#1a1a1a` 这种 token 里没有的值），直接说：
`颜色只能来自 src/theme/tokens.ts，把你新加的字面量改回去。`

---

## 六、常见翻车与应对

| 现象 | 原因 | 处理 |
| --- | --- | --- |
| `Unable to resolve module` | 装了包没重启 Metro | `npx expo start -c` 清缓存重启 |
| 手机扫码打不开 | 手机和电脑不在同一 WiFi | 用 `npx expo start --tunnel` |
| reanimated 报 `worklet` 错误 | babel 插件没配或顺序不对 | 确认 `react-native-reanimated/plugin` 在 plugins **最后** |
| 题库重复插入 | seed 幂等没做好 | 检查是否用 `INSERT OR IGNORE` + `onboarded` 标记 |
| 连续天数总是 1 | 用了 UTC 日期 | 全部改成 `todayKey()` 本地日期 |
| 填空判错太多 | 没做归一化 | 检查 `normalizeAnswer` 是否处理全角/空格/大小写 |
| AI 一直 404 | `wire_api` / `base_url` 不匹配 | 见第二节第 3 点 |
| 打包 APK 失败 | 没配 `android.package` | 在 `app.json` 补反域名 |

---

## 七、这份方案里我替你做的取舍（你可以推翻）

1. **不做左右滑卡切题。** 百词斩式的手感靠「零摩擦点选」实现，不靠滑动手势；
   滑动在长题干 + 滚动解析的场景里很容易误触。按钮更稳。
2. **AI 是可选加速器，不是核心。** 每张卡都预置了离线解析（`explain` 字段），
   AI 只在用户主动点击「换个说法」时调用。这样没网、没 Key、Key 欠费都能正常用。
3. **先复习后学新。** 每日队列把到期复习卡排在前面，新卡补充在后。
   比混着来更符合记忆规律，代价是「刚开始学」的爽感稍弱。
4. **统计不建日表。** 全部从 `review_logs` 实时聚合。100 张卡的数据量下性能完全够，
   换来的好处是永远不会出现「统计和明细对不上」。
5. **题库拆 6 个文件分批生成。** 一次让模型吐 100 张卡，后半段质量会断崖式下跌
   （题干变短、解析变水、选项变敷衍）。
6. **AI 出卡必须先答再收，不做「一键生成 10 张」。** 生成一张 → 当场作答 → 用户表态
   → 才入库。把审核藏进学习动作里，成本接近零，但错误知识进不来。
   如果你要改成批量生成，请先想清楚谁来做那 10 张的审核——大概率没人做。
7. **离线生产线按知识点生成，不按学科批量生成。** syllabus 里每个 topic 拆到
   「1~3 张卡」的粒度，逐个生成、逐个校验、逐个记配额。这样才不会出现
   「300 张卡里有 80 张都在考时间复杂度」。
8. **只给「题型」这一根柱子做抽象，其他方向只留接缝。** 你明确会扩的只有题型
   （图片 / 判断 / 代码填空），所以把「数据结构 + 作答 UI + 判分」打包成
   `CardDefinition` 注册表，加题型 = 新建一个目录 + 一行注册。
   云同步、多端、浅色主题**故意没做抽象**——`spec/04` 第 5 节写清了将来会卡在哪、
   第一步该改哪，不是没想到，是主动放弃。多加一层间接，DeepSeek 跑 Codex 时就多一处写错的机会。
9. **热更新不在冷启动时等网络。** 题库更新是「启动 3 秒后的后台动作」，
   有新版本才提示，失败什么都不显示。绝不把「打开就学」变成「打开等网络」——
   这个 App 的全部价值就是那 5 分钟，不该耗在进度条上。
10. **题库只有一个合并入口 `applyDeckBundle()`。** 内置 seed 和远程下载共用它，
   顺序固定（删墓碑 → UPSERT → 补状态 → 写版本）。两份实现早晚会不一致，
   而不一致的那一次，用户进度就没了。
