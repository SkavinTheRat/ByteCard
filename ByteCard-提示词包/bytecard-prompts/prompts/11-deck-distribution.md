# 阶段 11 · 题库分发（导出闭环 + 远程热更新）

> 前置：阶段 2（seed 能跑）、阶段 8（有 merge 工具）、阶段 9（有 AI 生成卡）都完成。
> 这两件事看起来无关，**但共用同一条合并逻辑**，所以放一个阶段做——
> 否则你会写出两套 UPSERT、两套墓碑处理，早晚不一致。

---

## 先说结论：把「来源」和「合并」拆开

现在的 seed 逻辑假设「题库来自 `assets/`」，热更新要让题库来自「下载的文件」。
如果照着写，会变成两个几乎一样的函数。

正确做法是先抽一个**与来源无关**的合并函数：

```ts
// src/db/applyBundle.ts
export type DeckBundle = {
  version: number;
  removed?: string[];
  minAppVersion?: string;
  decks: Deck[];
  cards: CardInput[];
};

/** 把一份题库快照合并进本地库。幂等、可重复调用。 */
export async function applyDeckBundle(
  bundle: DeckBundle,
  opts: { source: 'bundled' | 'remote' }
): Promise<{ added: number; updated: number; removed: number }>;
```

内部顺序固定（照 `spec/01` 4.1 / 4.2 节）：

1. `version <= settings.deck_version` → 直接返回（幂等，不重复干）
2. `DELETE FROM cards WHERE id IN (bundle.removed ?? [])`
3. UPSERT decks
4. UPSERT cards（**绝不 `INSERT OR REPLACE`**）
5. 为新卡补 `review_states`（`due_at = now`, `status = 'new'`）
6. `settings.deck_version = bundle.version`
7. 整个流程在一个事务里

`opts.source` 只用于日志和「我的」页显示来源，不改变行为。

写完之后：`seedIfNeeded()` 改成 `applyDeckBundle(BUNDLED, { source: 'bundled' })`
（首次安装和版本升级都走它），热更新也调它。

---

## Part A · 导出闭环（先做，不依赖网络）

### 问题

阶段 9 在手机上攒了 20 张 AI 生成的好卡。它们只在本地 SQLite 里：
换手机没了、清数据没了、想让同学也用上做不到。

### A1 · App 内导出

**入口**：「我的」→ `AI 补卡` 页底部 → `导出为文件`（原来 `导出学习记录` 那个 disabled 占位可以删了，
两者不要混在一起）。

**行为**：

1. 查 `SELECT * FROM cards WHERE source = 'ai' AND verified_at IS NOT NULL`
2. 没有数据 → `还没有收进来的 AI 卡。`（空状态，不弹 toast）
3. 有数据 → 生成 JSON 写到 `FileSystem.cacheDirectory`：

```jsonc
{
  "kind": "bytecard-export",
  "exportedAt": "2026-11-10T03:20:00.000Z",
  "appVersion": "1.0.0",
  "cards": [
    { "id": "ai-m3k9x", "deckId": "ds", "type": "single",
      "question": "...", "options": [...], "answer": {...},
      "explain": "...", "tags": [...], "difficulty": 2, "payload": {} }
  ]
}
```

4. 用 `expo-sharing` 唤起系统分享（存到文件 / 发微信 / 发给自己）
5. 同时提供 `复制到剪贴板`（卡少于 20 张时更方便，直接用 `expo-clipboard`）

**依赖**：`expo-file-system`、`expo-sharing`、`expo-clipboard`（后两个可能已装或需要装）。

> ⚠️ Expo SDK 新版的 `expo-file-system` 换了 API（`File` / `Directory` 类），
> 老的 `writeAsStringAsync` 被移到了 `expo-file-system/legacy`。
> 按你装的 SDK 版本选对写法，**不要混用两套**。如果编译报「方法不存在」，就是这个问题。

**注意**：导出文件里**不要**带 `aiExplain`（那是本机的 AI 缓存，体积大且没价值）、
不要带 `sortOrder`（导入时会重排）。

### A2 · 电脑端导入 `tools/gen-cards/import.mjs`

```bash
node tools/gen-cards/import.mjs ~/Downloads/bytecard-export.json --deck ds --dry-run
node tools/gen-cards/import.mjs ~/Downloads/bytecard-export.json --deck ds
```

- 校验：`kind === 'bytecard-export'`、每张卡走 `validate.mjs` 的同一套规则
  （结构 / 废选项 / 长度 / 解析质量）
- **相似度查重**：和 `assets/data/cards/*.json` 已有卡做 3-gram Jaccard > 0.75 → 跳过并报告
- **重新分配 id**：`ai-xxx` → `{deckId}-{下一个可用序号}`。
  原因：`ai-` 前缀是「设备本地生成」的语义，进 assets 就是正式题库了，
  而且 `ai-` 用的是 timestamp36，跨设备会撞。
- `source` 一律置 `'seed'`、`verified_at` 置 `null`（进了 assets 就是内置卡，
  不再是「待确认的 AI 卡」）
- 写入后 `decks.json` 的 `version` +1（复用 `merge.mjs` 的同一段代码，抽成共享函数）
- 输出报告：`导入 15 张，跳过 2 张（重复），3 张校验失败（附原因）`

**导入后必须做的**：跑一次 `validate.mjs` 全量校验，再 `git diff` 看一遍——
这些卡是 AI 在手机上生成的，你当时只「答了一遍」就算通过了，质量没经过 08 那套抽检。

---

## Part B · 远程热更新

### B0 · 什么时候检查

**绝对不要在冷启动时同步等网络。** 顺序：

1. App 启动 → 用内置题库正常进入首页（不显示任何 loading）
2. 首页渲染完成后，`setTimeout` 延迟 3s，后台静默检查
3. 有新版本 → 下载 + 校验 + 合并（整个过程静默，不打断用户）
4. 合并完成后在首页顶部显示一条可关闭的提示条：
   `题库已更新：新增 42 张`（点一下进「题库更新」页看详情）
5. 失败 → **什么都不显示**，记一条 `console.warn`，下次启动再试

用户手动触发：我的 → `题库更新` → `检查更新`（显示转圈 + 结果）。

### B1 · manifest 协议

放静态文件的地方（GitHub Raw、对象存储、自己服务器都行），**两个文件**：

`manifest.json`（小，几百字节）：

```jsonc
{
  "version": 5,
  "bundleUrl": "https://example.com/bytecard/decks-v5.json",
  "sha256": "9f2c...",          // bundle 文件的 sha256（hex）
  "size": 184320,               // 字节数，用于提前拒绝异常大的文件
  "publishedAt": "2026-11-10T02:00:00Z",
  "notes": "新增数据结构 20 张，修正 2 处错误答案"
}
```

`decks-v5.json`（完整题库快照，格式同 `assets/data/decks.json`，含 `removed`）。

**为什么 manifest 单独一个文件**：每次启动只需拉几百字节判断「要不要更新」，
而不是拉几百 KB 的完整题库。这是省流量和省时间的关键。

### B2 · 安全校验（5 条，一条都不能省）

1. **只允许 https**。URL 不是 `https://` 开头 → 直接拒绝，不给「用户确认后继续」的选项。
2. **大小上限**：`manifest.size` 与实际响应体都不得超过 **5MB**，超过立刻中断
   （防止有人在你的服务器上放个大文件把你 App 的存储撑爆）。
3. **sha256 必须匹配**。下载完先算 hash 再 `JSON.parse`——顺序反了就等于没校验。
4. **version 必须严格大于本地**。等于或小于 → 忽略。防止降级攻击
   （攻击者回滚到一个答案错误的旧版本）。
5. **逐卡结构校验**：合并前对每张卡调 `getCardDef(type)?.validate(card)`，
   任何一张不通过 → **整包拒绝**（不做「部分导入」，那会让题库处于半新半旧的状态）。

签名（可选，做不做看你）：

- 想防「有人篡改你服务器上的 JSON」→ 加 HMAC-SHA256，密钥内置在 App 里。
  缺点：反编译能拿到密钥，防不了有心人，只能防「传输途中被换」。
- 想真正防篡改 → 用非对称签名（Ed25519），私钥在电脑、公钥在 App。
  `expo-crypto` 不一定支持验签，可能要引 `@noble/ed25519`（纯 JS，体积小）。
- **对个人项目，第 3 条的 sha256 已经能覆盖 99% 的场景**（防传输损坏、防 CDN 缓存旧文件）。
  签名要不要做，等你真的要把 App 分发给别人再说。

### B3 · 下载与合并流程

```ts
async function checkRemoteDeckUpdate(): Promise<UpdateResult> {
  const url = await getSetting('deck_remote_url');   // 空 = 功能关闭
  if (!url) return { status: 'disabled' };
  const local = Number(await getSetting('deck_version') ?? 0);

  // 1. 拉 manifest（8s 超时，失败静默）
  const manifest = await fetchJson(url, { timeout: 8000 });
  if (manifest.version <= local) return { status: 'up-to-date' };

  // 2. 校验 URL 与大小
  if (!manifest.bundleUrl.startsWith('https://')) throw new Error('insecure');
  if (manifest.size > 5 * 1024 * 1024) throw new Error('too-large');

  // 3. 下载到临时文件（不要直接塞内存再 parse，几百 KB 也还好但保险起见落盘）
  const tmp = await download(manifest.bundleUrl);
  const actualSha = await sha256OfFile(tmp);
  if (actualSha !== manifest.sha256) throw new Error('checksum');   // 先校验再 parse！

  // 4. 逐卡校验
  const bundle = JSON.parse(await readFile(tmp));
  if (!validateBundle(bundle)) throw new Error('invalid-bundle');

  // 5. 合并
  const result = await applyDeckBundle(bundle, { source: 'remote' });
  await setSetting('deck_checked_at', new Date().toISOString());
  return { status: 'updated', ...result, notes: manifest.notes };
}
```

**注意**：`applyDeckBundle` 里必须自己起事务，不要在 `checkRemoteDeckUpdate`
里包一层 `withTransactionAsync`（嵌套事务在 expo-sqlite 里行为不确定）。

### B4 · UI（我的 → 题库更新）

一行组：

```
当前题库        v5 · 342 张
上次检查        2 小时前
[ 检查更新 ]
服务器地址      https://...      ← 可编辑，留空即关闭热更新
```

- 服务器地址用 `TextInput`，失焦才写库。
- 检查中：按钮变 `检查中…` 并禁用，超时 15s。
- 结果文案：`已是最新（v5）` / `更新完成：新增 42 张，移除 2 张` / `校验失败，未应用`
  / `地址不可达`。
- 底部一行 `caption`：`热更新只替换题库内容，不会影响你的学习进度。`

### B5 · 你自己的发布流程（写进 `tools/gen-cards/REVIEW.md`）

跑完 08 的 merge 之后：

```bash
# 1. 生成 bundle + manifest
node tools/gen-cards/publish.mjs --out dist/
#    → dist/decks-v6.json
#    → dist/manifest.json（自动算 sha256 和 size）

# 2. 上传到你的静态托管（GitHub Raw / 对象存储 / 自己的服务器）
# 3. 在 App 里点「检查更新」验证
```

`publish.mjs` 要做的：读 `assets/data/decks.json` + 6 个 cards 文件 → 合并成单文件
→ 算 sha256 → 写 manifest。**只做这三件事，不要顺手发布**（上传让人来做，
避免脚本里有你的 token）。

---

## 不要做的事

- ❌ 不要在 App 冷启动时同步等热更新（会让「打开就学」变成「打开等网络」）。
- ❌ 不要做「部分导入」——一张卡校验失败就整包拒绝。半新半旧的题库比旧题库更难排查。
- ❌ 不要让热更新影响 `review_states`（除了墓碑删除的卡）。它只该改「题库内容」。
- ❌ 不要用 `INSERT OR REPLACE`（老规矩，见 `AGENTS.md` 第 8 节第 7 条）。
- ❌ 不要从 http 或 IP 地址拉题库。
- ❌ 不要做「自动合并冲突」之类的花活——你的题库是全量快照，不存在冲突。

## 验收

- [ ] 导出：手机上有 5 张 AI 卡 → 导出 → 文件能在电脑上打开且 JSON 合法
- [ ] 导入：`import.mjs --dry-run` 的计数与实际写入一致
- [ ] 导入后 `id` 是 `ds-xxx` 格式，不是 `ai-xxx`
- [ ] 导入后跑 `validate.mjs` 全量无错
- [ ] 热更新：把 manifest 的 version 改大 → App 下次启动 3s 后提示「题库已更新」
- [ ] 故意改坏 sha256 → 拒绝应用，App 正常使用旧题库
- [ ] 故意把 bundle 里一张卡的 `answer.index` 改成 99 → 整包拒绝
- [ ] 断网启动 → 无任何报错，3s 后静默失败，正常刷旧卡
- [ ] 热更新后，用户的复习进度、连续天数、错题本全部完好
- [ ] `remove` 一张卡后更新 → 该卡从库中消失，`review_states` 同步清除
- [ ] `npx tsc --noEmit`、`npm test` 全绿

## 交付时告诉我

1. `applyDeckBundle` 的完整实现（我要核事务边界和幂等判断）。
2. 你选了 sha256 单校验还是加了签名，理由。
3. 热更新一次的实际耗时（manifest + bundle 下载 + 合并，分三段报）。
4. 如果用户正在答题过程中触发热更新（首屏延迟 3s 可能撞上），你的处理是什么？
   ——这是最容易出并发问题的地方，我要看你怎么保证「当前会话的队列不被中途换掉」。

---
