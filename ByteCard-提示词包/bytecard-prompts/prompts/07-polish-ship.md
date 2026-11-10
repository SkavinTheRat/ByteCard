# 阶段 7 · 首次引导、每日提醒、打磨与装机

> 前置：阶段 6 已通过验收，功能闭环。
> 这一阶段让它从「能跑」变成「像个产品」。

---

读 `AGENTS.md`、`spec/03-design-tokens.md` 第 8 节。
按下面顺序做，每完成一块自己验证一块。

## 任务

### 1. 首次引导（`app/onboarding.tsx`）

只在 `settings.onboarded === 'false'` 时显示，用 `router.replace` 拦截。

三屏横向滑动（`FlatList` + `pagingEnabled`，不引入轮播库），底部圆点指示器：

1. **这是什么** —— 大字 `碎片时间，记点硬知识。` + 一句 `每天 5 分钟，卡片式过一遍 408 与 AI 的核心概念。`
2. **怎么用** —— 三行说明（刷卡 → 作答 → 按遗忘曲线复习），每行左侧一个 Ionicons 小图标。
3. **选学科** —— 6 个学科包的可多选卡片（选中 `primarySoft + primary` 描边），至少选 1 个才能「开始」。

第三屏按钮：`开始`。点击后：写 `enabled_decks`、写 `onboarded = 'true'`，`router.replace('/(tabs)')`。

视觉：全屏 `colors.bg`，不要插画图，用大字号排版 + 等宽字体的编号（`01 / 02 / 03`）做视觉重心。

### 2. 每日提醒（`expo-notifications`）

- 装 `expo-notifications`，在 `app.json` 里加 plugin 配置。
- 「我的」页的提醒开关启用。打开时：
  1. 请求权限（`requestPermissionsAsync`），被拒就开关弹回并提示
     `需要在系统设置里允许通知。`（配一个「去设置」按钮，`Linking.openSettings()`）
  2. 用 `scheduleNotificationAsync` 注册一个 **DAILY** 触发器，时间取 `reminder_time`
  3. 通知标题 `今天的卡片还等着。`，正文 `12 张待复习，5 分钟就够。`（数量用当日真实队列长度）
- 每次进入前台（`AppState` 变 active）时用 `setNotificationHandler` 保证前台也能看到提醒，
  并重算一次通知内容（数量会变）。
- 关闭时：`cancelAllScheduledNotificationsAsync()`。
- Android 要建通知渠道（`setNotificationChannelAsync`，importance DEFAULT，`vibrationPattern` 短震动）。
- **注意时区**：DAILY 触发器用本地时间 `{ hour, minute, repeats: true }`，不要用 UTC 换算。

### 3. 图标与启动屏

- 生成一个占位图标（我可以用设计工具自己做，你先给我 `assets/` 下的规格：
  `icon.png 1024×1024`、`adaptive-icon.png 1024×1024`（前景留 33% 安全边距）、
  `splash-icon.png 512×512`、`favicon.png 48×48`）。
- 如果 `assets/` 下没有图，就用一个纯色 + 文字的临时占位（可以用 `react-native-svg` 生成
  一张 PNG 存进去，或者告诉我需要我提供）。
- 启动屏背景 `#0A0D13`，`resizeMode: 'contain'`。
- 图标设计方向：深色底 + 青色 `</>` 或等宽字母 `B` 的极简几何构成，不要渐变阴影。

### 4. 健壮性

- `app/_layout.tsx` 外层包一个 `ErrorBoundary`（class 组件，这是唯一允许用 class 的地方）：
  捕获后显示 `出了点问题。` + 错误信息（`textMute`，`micro`）+ `重启 App` 按钮（`Updates.reloadAsync()`
  或提示用户手动重启）。
- 所有 `await repository.*` 的调用点检查是否有 try/catch（用全局搜索过一遍，列出来）。
- 数据库初始化失败时（比如磁盘满）：首页显示 `读取题库失败，下拉重试。` 而不是白屏。
- 加一个全局的 `Toast`（自绘，绝对定位在 SafeArea 顶部，2 秒淡出），替代临时 `console.log`
  给用户的反馈。不要引入第三方 Toast 库。

### 5. 性能

- 刷卡页的 `KnowledgeCard` 和 `OptionButton` 用 `React.memo` 包一层，
  确认切换选项时没有整页重渲染（可以用 `React DevTools` 或加 `onRender` 日志验证）。
- 首页 `buildTodayQueue` 不要在每次渲染时调用，用 `useEffect` + 依赖数组控制。
- 统计页的聚合查询如果 > 50ms，加索引（`review_logs(day)` 已有）或做一次内存缓存（
  用 `useRef` 存最近一次结果 + 时间戳，60s 内复用）。

### 6. 装机（Android APK）

**这一节只求「能装上」，完整适配见 `prompts/12-android-coloros.md`。**

按这个顺序试，成功一步就停：

1. `npx expo start` + Expo Go —— 日常开发用，不需要打包。
   ⚠️ 但 Expo Go **测不出** edge-to-edge 遮挡、强制深色反转、字体缩放溢出、后台被杀、
   通知权限这些安卓问题——本阶段的验收可以在 Expo Go 做，装机后的验收必须去阶段 12。
2. **要装到自己手机上**：
   ```bash
   npm i -g eas-cli
   eas login
   eas build:configure
   eas build -p android --profile preview
   ```
   在 `eas.json` 的 `preview` profile 里加 `"android": { "buildType": "apk" }`，
   然后从构建产物链接下载 APK 安装。
3. 想完全本地不出网：`npx expo prebuild -p android` + `cd android && ./gradlew assembleRelease`
   （需要本地 JDK 17 + Android SDK，配置麻烦，不推荐先走这条）。

`app.json` 里必须设好（**完整版见阶段 12 的 A1 节，别在这里抄一半**）：

- `android.package`：`com.yourname.bytecard`（用你自己的反域名）
- `version: "1.0.0"`、`android.versionCode: 1`
- `userInterfaceStyle: "dark"`、`edgeToEdgeEnabled: true`
- `blockedPermissions` 屏蔽掉 Expo 默认带的相机/录音/定位（否则 ColorOS 安装时会警告）

### 7. 发布前检查（写成 `CHECKLIST.md` 放在仓库根目录）

逐项打勾，每项写清楚「怎么验证」：

- [ ] 全新安装（清数据）→ 引导 → 选学科 → 学第一张卡，全流程无卡顿
- [ ] 飞行模式下能学完一整个队列（AI 走 Mock，不崩）
- [ ] 有 Key 时 AI 能出结果；断网点按钮只提示错误
- [ ] 从后台杀掉再打开，进度和连续天数都正确
- [ ] 跨零点学习，打卡日期正确
- [ ] 提醒在设定时间真的响了（真机，等一天）
- [ ] 6 个学科包全部能单独开关，关掉后队列里确实没有了
- [ ] 重置进度后卡片仍在、统计清零
- [ ] 深色模式下没有一处白色闪屏（启动、页面切换、键盘弹起）
- [ ] 小屏（SE）和大屏（Pro Max / 平板）都不错位
- [ ] `npx tsc --noEmit` 零错误、`npm test` 全绿

## 不要做的事

- 不要做浅色主题。
- 不要做账号/login/云同步（下一版）。
- 不要做分享/排行榜。
- 不要为了让 UI 更好看而引入组件库。

## 交付时告诉我

1. 打包用的完整命令序列（从零到手机上能点开图标）。
2. `CHECKLIST.md` 里你**没法自己验证**的有哪几项（比如提醒、真机手感）。
3. 整个项目最终的文件数量和代码行数（`git ls-files | wc -l`、`cloc .` 或类似）。
4. 这个版本最明显的一个短板是什么（我要听真话）。

---
