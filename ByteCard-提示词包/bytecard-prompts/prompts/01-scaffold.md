# 阶段 1 · 项目脚手架与导航骨架

> 用法：在**空的**项目根目录（已放好 `AGENTS.md` 和 `spec/`）里，启动 Codex，把下面横线之间的内容整段贴进去。

---

先读一遍仓库根目录的 `AGENTS.md`，以及 `spec/03-design-tokens.md`。
严格遵守里面的技术栈、目录结构和代码规范。这一阶段**只搭骨架，不写业务逻辑**。

## 任务

把仓库变成一个能在手机上跑起来的 Expo App 骨架。

### 1. 初始化

用 `npx create-expo-app@latest . --template blank-typescript` 初始化（当前目录）。
然后按需安装以下依赖，**装完把实际版本号告诉我不需要额外说明**：

```
npx expo install expo-router react-native-safe-area-context react-native-screens \
  expo-linking expo-constants expo-status-bar expo-sqlite expo-haptics expo-font \
  expo-splash-screen react-native-reanimated react-native-gesture-handler \
  react-native-svg @expo/vector-icons
npm install zustand
npx expo install @expo-google-fonts/inter @expo-google-fonts/jetbrains-mono
```

`package.json` 里加 `"main": "expo-router/entry"`。`app.json` 里补：

- `"userInterfaceStyle": "dark"`（强制深色，不做浅色主题）
- `"scheme": "bytecard"`
- `"plugins": ["expo-router"]`，以及 reanimated 需要的 babel 配置
  （`babel.config.js` 里 plugins 末尾加 `'react-native-reanimated/plugin'`）
- `splash.backgroundColor` 设为 `#0A0D13`
- Android 的 `edgeToEdgeEnabled: true`

同时更新 `tsconfig.json`：开启 `strict`、`noUncheckedIndexedAccess`，
加 `"paths": { "@/*": ["./src/*"] }` 路径别名（`babel.config.js` 也要配 module-resolver 或用
`expo` 内置的 tsconfig paths 支持——如果配不通就用相对路径，别卡在这里）。

### 2. 落地设计 token

把 `spec/03-design-tokens.md` 第 2~5 节的代码**原样**写成 `src/theme/tokens.ts`，
并写 `src/theme/index.ts` 统一再导出。这是后面所有页面的唯一颜色来源。

### 3. 路由骨架

按 `AGENTS.md` 的目录结构创建：

```
app/_layout.tsx            # 根 Stack + 字体加载 + 深色状态栏 + 安全区
app/(tabs)/_layout.tsx     # 底部 3 个 Tab：今日 / 统计 / 我的
app/(tabs)/index.tsx       # 今日
app/(tabs)/stats.tsx       # 统计
app/(tabs)/me.tsx          # 我的
app/study.tsx              # 刷卡页（Stack 推入，全屏，无 Tab）
```

要求：

- `_layout.tsx` 用 `useFonts` 加载 Inter 三档 + JetBrains Mono 两档；加载中返回一个
  `backgroundColor: colors.bg` 的空白 View（不要渲染导航）；用 `SplashScreen.preventAutoHideAsync()`
  + 字体就绪后 `hideAsync()`。加载失败要 `console.warn` 但依然放行（不能白屏卡死）。
- Tab 图标用 Ionicons：今日 `today-outline`、统计 `stats-chart-outline`、我的 `person-outline`；
  选中/未选中色按 `spec` 6.6 节。**隐藏 Tab 的文字默认样式里的大写转换**（`textTransform: 'none'`）。
- 三个 Tab 页先各放一个居中占位：页面标题（`type.title`）+ 一行 `textDim` 的说明文字，
  背景 `colors.bg`，内容套 `SafeAreaView`。
- `app/study.tsx` 先放一个「刷卡页施工中」占位 + 左上角返回按钮（`router.back()`）。

### 4. 一个能验证主题的最小部件

写 `src/components/Screen.tsx`：封装 `SafeAreaView` + `backgroundColor: colors.bg` + 可选水平 padding。
三个 Tab 页都用它包住——这样后面所有页面都自动带上正确的底色。

### 5. 跑通

- `npx tsc --noEmit` 必须零错误。
- `npx expo start` 能起来，手机 Expo Go 扫码能打开，三个 Tab 可切换，无红屏无警告刷屏。

## 不要做的事

- 不要写任何数据库、SM-2、题库相关内容（下一阶段）。
- 不要装 UI 组件库。
- 不要自定义页面切换动画。
- 不要写超过 250 行的文件。

## 交付时告诉我

1. 装了哪些包（版本号）。
2. 目录树（`app/` 和 `src/` 两层即可）。
3. 我该怎么在手机上验证（3 步以内）。
4. 有没有哪一步和我的要求不一致、你做了什么折中。

---
