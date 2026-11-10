# ByteCard

ByteCard 是一个面向 408 与 AI/Agent 学习的移动端知识卡片 App。本仓库已完成提示词包阶段 00–03：Expo 脚手架、SQLite 数据层、100 张内置题库，以及单选、多选、填空三种题型的刷卡答题 MVP。

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

- 已完成：深色主题骨架、今日/统计/我的 Tab、SQLite 迁移与幂等 seed、UPSERT 题库更新、三题型注册表、作答落库、解析面板、会话结束页。
- 尚未实现：SM-2、完整统计、AI 讲解、提醒、APK 签名与 ColorOS 真机专项适配，对应提示词阶段 04 之后。
