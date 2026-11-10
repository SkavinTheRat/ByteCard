# ByteCard

ByteCard 是一个面向 408 与 AI/Agent 学习的移动端知识卡片 App。本仓库已完成阶段 00–10，并实现阶段 11 的题库快照合并、热更新与电脑端导入导出、阶段 12 的 Android/ColorOS 配置。

## 运行

```bash
npm install
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
node tools/gen-cards/generate.mjs --deck ds --only-calc
npm run cards:validate
node tools/gen-cards/merge.mjs --deck ds --dry-run
npm run cards:publish
```

## 当前范围

- 已完成：内容生产线、AI 出卡审核、题型注册表与判断题、题库热更新、电脑端导出导入工具、深色/安全区/键盘适配。
- 待确认依赖：App 内文件分享导出需要 `expo-file-system`、`expo-sharing`、`expo-clipboard`。
- 需要外部条件：DeepSeek Key 才能实际批量生成；Expo 账号与 OPPO 真机才能完成 EAS APK 和 ColorOS 通知验收。

## Android APK

```bash
npm i -g eas-cli
eas login
eas build:configure
eas build -p android --profile preview
```

`eas.json` 已配置 `preview` 为 arm64 APK，`production` 为 AAB。`plugins/withForceDarkDisabled.js`
会在 prebuild 时写入 `android:forceDarkAllowed="false"`。发布前检查见 `CHECKLIST.md`。
