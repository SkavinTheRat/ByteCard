# ByteCard

ByteCard 是一个面向 408 与 AI/Agent 学习的移动端知识卡片 App。本仓库已完成阶段 00–10，并实现阶段 11 的题库快照合并、热更新与电脑端导入导出、阶段 12 的 Android/ColorOS 配置。

当前源码版本：**v1.1.0**。

## 下载与安装

### 直接安装 Android APK

仓库源码本身不包含 APK，点击 GitHub 的 **Code → Download ZIP** 只能得到源代码，不能直接安装。

当前可用的 EAS 预览 APK：

- [下载 ByteCard v1.0.0 预览 APK](https://expo.dev/artifacts/eas/ZOchVjpXkeOWbGos_AnnMLE70LiEJXeoCARWXFpRYXU.apk)
- 文件约 108MB，适用于 Android 手机。
- 该 EAS 产物链接有效至 **2026-11-24 18:35（北京时间）**。
- 下载后在文件管理器中打开 APK；ColorOS 若提示“未知来源”或“应用安全检测”，按系统提示允许当前文件管理器安装，再选择继续安装。
- 仓库维护者后续可将 APK 上传到 [GitHub Releases](https://github.com/SkavinTheRat/ByteCard/releases)，方便长期下载。

### 下载源代码

不需要安装 Git，也不需要 GitHub 账号：

1. 打开 [ByteCard 仓库](https://github.com/SkavinTheRat/ByteCard)。
2. 点击绿色 **Code** 按钮。
3. 选择 **Download ZIP**，解压后即可查看源码。

使用 Git 下载：

```bash
git clone https://github.com/SkavinTheRat/ByteCard.git
cd ByteCard
```

在 Expo Go 中运行源码：

```bash
npm ci
npx expo start
```

## 运行

```bash
npm ci
npx expo start
```

手机与电脑在同一局域网时，用 Expo Go 扫描终端二维码。Android 生产 bundle 可用：

```bash
npx expo export --platform android
```

## 校验

```bash
npx tsc --noEmit
npm test
```

题库总数、学科配额、答案索引、解析长度和难度分布由 `validateDecks()` 在 seed 前校验。首次启动日志会打印题库 seed 耗时。

内容流水线：

```bash
npm run cards:topics
npm run cards:expansion:generate
npm run cards:expansion:report
node tools/gen-cards/generate.mjs --deck ds --only-calc
npm run cards:validate
node tools/gen-cards/merge.mjs --deck ds --dry-run
npm run cards:publish
```

## 当前范围

- 已完成：内容生产线、AI 出卡审核、题型注册表与判断题、题库热更新、电脑端导出导入工具、深色/安全区/键盘适配。
- App 内文件分享导出使用 `expo-file-system`、`expo-sharing`、`expo-clipboard`。
- 实际批量 AI 出题需要 DeepSeek API Key；ColorOS 通知和后台行为仍需 OPPO 真机验收。

## Android APK

```bash
npx eas-cli@latest login
npx eas-cli@latest build -p android --profile preview
```

`eas.json` 已配置 `preview` 为通用 APK，`production` 为 AAB。`plugins/withForceDarkDisabled.js`
会在 prebuild 时写入 `android:forceDarkAllowed="false"`。发布前检查见 `CHECKLIST.md`。
