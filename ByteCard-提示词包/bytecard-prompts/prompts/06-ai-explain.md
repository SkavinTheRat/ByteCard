# 阶段 6 · AI 讲解（Mock 优先，真接口可插拔）

> 前置：阶段 5 已通过验收。
> 核心原则：**没有 API Key 时 App 必须完整可用**，AI 只是加分项，不是依赖。

---

读 `AGENTS.md`。这一阶段实现 `src/ai/` 三个文件，并把解析面板里那个置灰的
「换个说法」按钮接上，同时在「我的」页加 AI 设置。

## 任务

### 1. 接口定义 `src/ai/provider.ts`

```ts
export type AIRequest = {
  card: Card;
  userAnswer: string;      // 用户选/填的内容，用于针对性纠错
  kind: 'rephrase' | 'example' | 'quiz';
};

export type AIResponse = { text: string; source: 'mock' | 'deepseek' };

export interface AIProvider {
  readonly id: string;
  isConfigured(): Promise<boolean>;
  explain(req: AIRequest, signal?: AbortSignal): Promise<AIResponse>;
}

export async function getProvider(): Promise<AIProvider>;
// 读 settings.ai_api_key，为空返回 MockProvider，否则 DeepSeekProvider
```

### 2. Prompt 模板（写在 `src/ai/prompts.ts`）

系统提示词固定为：

```
你是一个计算机考研（408）与 AI 基础的助教。学生在做概念卡片练习时答错了题。
你的任务是针对性地补充讲解，不是重新讲一遍整个知识点。

硬性要求：
1. 用中文，160 字以内，不要客套话，不要"很好的问题"这类开场。
2. 纯文本，不要 Markdown 标题、不要代码块围栏、不要超过 3 个短句组成的列表。
3. 结构固定为三段：第一句点出他错在哪 / 第二句给出正确理解 / 第三句给一个能记住的类比或口诀。
4. 只讲这一张卡涉及的知识点，不要扩展到他没问的内容。
5. 如果卡片内容涉及你不确定的具体数值或公式，明确说"这条我记不准，以教材为准"。
```

用户消息按 `kind` 拼：

- `rephrase`：`卡片：${question}\n正确答案：${correctText}\n学生选择：${userAnswer}\n换个角度再讲一遍。`
- `example`：`...\n给一个具体的小例子（数字或代码都行），不要超过 3 行。`
- `quiz`：`...\n再出 1 道同知识点的单选题，只给题干和 4 个选项，不要给答案。`

参数：`temperature: 0.3`、`max_tokens: 400`。

### 3. Mock 实现 `src/ai/mock.ts`

不联网，从卡片自带数据派生，保证「离线也有反馈」：

- `rephrase` → `换个说法：${explain 的第一句}。\n记住这个点：${tags.join('、')}。`
- `example` → `这个知识点在 ${deckName} 里常以「${tags[0]}」的形式考，注意区分相邻概念。`
- `quiz` → 从同 deck 里随机挑一张其他卡，把它的题干和选项原样返回，前缀 `练一道：`。

Mock 的返回要有 `source: 'mock'`，UI 上在文字末尾显示一行 `micro` 灰字 `离线解析`。

### 4. DeepSeek 实现 `src/ai/deepseek.ts`

- 端点：`${baseUrl}/chat/completions`，`baseUrl` 默认 `https://api.deepseek.com`（读 `settings.ai_base_url`）。
- Header：`Authorization: Bearer ${key}`、`Content-Type: application/json`。
- Body：`{ model, messages, temperature: 0.3, max_tokens: 400, stream: false }`。
- **默认用非流式 + 前端模拟打字机**（每 18ms 追加一个字符）。
  原因：React Native 的 `fetch` 不支持增量读取 `response.body`，硬做流式要换 `expo/fetch`
  并处理 SSE 解析，稳定性差。如果你确信当前 Expo SDK 的 `expo/fetch` 支持，可以改流式，
  但要在交付说明里写清楚你怎么验证的。
- 超时 20s：用 `AbortController` + `setTimeout`。超时后 abort 并抛可读错误。
- 错误映射（不要直接把原始 JSON 甩给用户）：
  - 401 → `Key 无效，去设置里检查一下。`
  - 402/429 → `调用额度用完了，先看离线解析。`
  - 5xx → `服务暂时不可用。`
  - 网络错误 → `网络不通。`
  - 超时 → `响应太慢，已取消。`
- 返回内容做后处理：去掉首尾空白、去掉可能出现的 ``` 围栏、把连续的 `\n\n\n` 压成一个。

### 5. 缓存（省钱 + 秒开）

- 成功拿到 AI 结果后，写回 `cards.ai_explain`（同 `kind` 只缓存 `rephrase`），
  并在 `settings` 里记 `ai_generated_at`。
- 再次打开同一张卡：直接读 `ai_explain`，不走网络；末尾显示 `已缓存` 而不是 `离线解析`。
- 「我的」页加一个 `清除 AI 讲解缓存`（二级菜单里），把 `cards.ai_explain` 全部置 NULL。

### 6. UI 接入

**解析面板**（`AnswerPanel`）：

- 原有的「换个说法」按钮启用。旁边加「举个例子」。
- 点击后：按钮变 `思考中…`（带 3 点循环动画，禁用重复点击），
  下方出现一个 `bg: surfaceAlt` 的小区块（`radius.md`，`border`，左侧 2px `info` 竖条）流式显示结果。
- 结果区上方一行 `micro` + `info` 色：`AI 补充` + 右侧来源标记（`离线解析` / `已缓存` / `DeepSeek`）。
- 失败时：区块显示错误文案 + `重试` 文字按钮，不弹任何对话框，不影响用户「下一张」。
- **只在用户主动点击时请求**。绝不在卡片加载时自动请求（那是烧钱 + 拖慢体验）。

**「我的」页 → AI 设置**（新子页 `app/ai-settings.tsx`）：

- `API Key`：`TextInput`（`secureTextEntry`，右侧一个眼睛图标切换明文），
  placeholder `sk-...`，`fontFamily: mono`。**输入框失焦时才写库**，不要每次按键都写。
- `模型`：文本输入，默认 `deepseek-chat`，下方 `micro` 说明 `以 DeepSeek 官方模型列表为准`。
- `接口地址`：默认 `https://api.deepseek.com`。
- `测试连接` 按钮：发一个 `max_tokens: 8` 的 `ping` 请求，成功显示 `✓ 可用`（success 色），
  失败显示具体错误（danger 色）。测试期间按钮禁用并显示 `测试中…`。
- 底部一段 `caption` + `textMute` 的安全说明：
  `Key 只用本机数据库保存，不会上传到任何服务器。但设备被 root / 越狱后仍可被读取，请知悉。`
- 保存成功后在页面顶部短暂显示 `已保存`。

### 7. 成本护栏

- 单次会话最多 30 次 AI 请求（超过后按钮置灰并提示 `本次学习已达 AI 次数上限`，会话结束重置）。
- 同一张卡的同一 `kind` 6 小时内不重复请求（用缓存时间戳判断）。

## 不要做的事

- 不要把 Key 写进代码、`.env` 或 `app.json`。
- 不要为了 AI 引入状态管理库、请求库（`axios` / `react-query`），用原生 `fetch`。
- 不要在 AI 失败时阻塞答题流程。
- 不要做「AI 自动生成整张卡」的功能（内容质量不可控，这一版不做）。

## 验收

- [ ] 无 Key 时点击「换个说法」有 Mock 结果，末尾显示「离线解析」，全流程不报错
- [ ] 填入真实 Key 后点「测试连接」显示可用的绿色提示
- [ ] 有 Key 时点击按钮，结果以打字机方式出现，末尾显示「DeepSeek」
- [ ] 同一张卡再次打开，直接显示缓存内容，不发请求（看网络面板或加日志确认）
- [ ] 恶意断网情况下点按钮：显示「网络不通。」+ 重试，不崩溃
- [ ] 请求过程中返回上一页，请求被 abort（不能有 `setState on unmounted` 警告）
- [ ] 连续点 30 次后按钮禁用
- [ ] `npx tsc --noEmit` 零错误

## 交付时告诉我

1. 你最终选了非流式还是流式，怎么验证的。
2. 实际请求的 JSON body（脱敏后贴出来，我要核对字段）。
3. 一次 `rephrase` 请求的大致 token 消耗（按提示词字数估算）。
4. 如果 DeepSeek 返回的格式不符合三段式要求，你做了什么容错。

---
