# ByteCard

ByteCard 是一个面向 408 与 AI/Agent 学习的移动端知识卡片 App。本仓库已完成提示词包阶段 00–07：Expo 脚手架、SQLite 数据层、100 张内置题库、三种题型、SM-2、统计、错题本、AI 讲解、引导、提醒与发布前配置。

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

题库总数、学科配额、答案索引、解析长度和难度分布由 `validateDecks()` 在 seed 前强制校验。首次启动日志会打印题库 seed 耗时。

## 当前范围

- 已完成：每日交错队列、SM-2、热力格与柱状图、学科正确率、错题回顾、设置、Mock/DeepSeek 讲解、缓存、引导和本地每日提醒。
- 尚未完成：EAS 云端登录与实际 APK 构建、ColorOS 专项真机验收。对应后续提示词阶段 08 之后。

## Android APK

```bash
npm i -g eas-cli
eas login
eas build:configure
eas build -p android --profile preview
```

`eas.json` 已配置 `preview` 为 APK。发布前检查见 `CHECKLIST.md`。
