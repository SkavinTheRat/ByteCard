# 设计规格：深色极客风

> 这是**唯一**的视觉真相来源。实现时把下面 `tokens.ts` 原样落到 `src/theme/tokens.ts`，
> 业务代码只允许引用 token，不允许出现颜色字面量。

## 1. 设计概念

**「把知识装进终端里。」**

卡片的形态借用终端窗口：深色面板 + 1px 冷灰边框 + 顶部一条细标题栏（三个点 + 学科代号）。
答题是对这段「输出」的判断——答对时边框亮一下青色，答错时抖动并出现红叉。
用代码块字体（JetBrains Mono）呈现代码、公式、数字、计时，正文用 Inter。

关键词：**冷静、精确、低噪音**。不要卡通插画，不要大面积渐变，不要圆润可爱。

## 2. 色板

```ts
// src/theme/tokens.ts
export const colors = {
  // 背景层次（越靠前越亮）
  bg:            '#0A0D13',   // 页面底
  surface:       '#11151E',   // 面板 / 列表行
  surfaceAlt:    '#161B26',   // 卡片
  surfaceHigh:   '#1D2431',   // 悬浮 / 按下
  border:        '#232A38',   // 常规描边
  borderStrong:  '#313B4F',   // 强调描边（选中态）

  // 文字
  text:          '#E8EDF7',   // 主文字
  textDim:       '#9AA5BC',   // 次要文字
  textMute:      '#5D687D',   // 禁用 / 辅助

  // 主色与语义色
  primary:       '#22D3EE',   // 霓虹青：主按钮、进度、强调
  primaryDim:    '#0E7490',   // 主色暗部（渐变/描边）
  success:       '#34D399',   // 答对
  danger:        '#F87171',   // 答错
  warning:       '#FBBF24',   // 待复习 / 提醒
  info:          '#A78BFA',   // 辅助强调（AI 相关）

  // 学科主题色（与 decks.json 的 accent 一致）
  deck: {
    ds:    '#22D3EE',
    co:    '#A78BFA',
    os:    '#34D399',
    cn:    '#FBBF24',
    ai:    '#F472B6',
    agent: '#60A5FA',
  },

  // 半透明叠加（用于高亮背景，统一用 8 位 hex）
  primarySoft:   '#22D3EE1A',
  dangerSoft:    '#F871711A',
  successSoft:   '#34D3991A',
} as const;
```

## 3. 字体

```ts
export const fonts = {
  regular:  'Inter_400Regular',
  medium:   'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  mono:     'JetBrainsMono_400Regular',
  monoBold: 'JetBrainsMono_700Bold',
} as const;
```

加载方式（`app/_layout.tsx`）：

```ts
import { useFonts, Inter_400Regular, Inter_500Medium, Inter_600SemiBold } from '@expo-google-fonts/inter';
import { JetBrainsMono_400Regular, JetBrainsMono_700Bold } from '@expo-google-fonts/jetbrains-mono';
```

字体未加载完时**返回一个纯色 View 作为 splash**，不要渲染半成品布局（避免字体闪跳）。

## 4. 字号阶梯

```ts
export const type = {
  micro:  { fontSize: 11, fontFamily: 'mono',   lineHeight: 15, letterSpacing: 0.6 },  // 标签/计时
  caption:{ fontSize: 12, fontFamily: 'regular',lineHeight: 17 },
  small:  { fontSize: 13, fontFamily: 'regular',lineHeight: 19 },
  body:   { fontSize: 15, fontFamily: 'regular',lineHeight: 23 },  // 题干正文
  card:   { fontSize: 17, fontFamily: 'semibold',lineHeight: 26 }, // 题干标题
  title:  { fontSize: 20, fontFamily: 'semibold',lineHeight: 28 },
  display:{ fontSize: 28, fontFamily: 'monoBold',lineHeight: 34 }, // 大数字（进度/天数）
} as const;
```

## 5. 间距 / 圆角 / 描边

```ts
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32 } as const;

export const radius = { sm: 8, md: 12, lg: 16, xl: 22, pill: 999 } as const;

export const stroke = { hair: 1, thin: 1.5, thick: 2 } as const;
```

**深色界面不用阴影**（阴影在深色底上几乎看不见，反而脏）。一律用 `borderWidth: 1 + borderColor: colors.border`
表达层次；需要「浮起」的元素用更亮的 `surfaceHigh` + `borderStrong`。

## 6. 关键组件的视觉规格

### 6.1 知识卡（`components/KnowledgeCard.tsx`）

```
┌──────────────────────────────────┐  ← radius.lg(16), bg surfaceAlt, border border
│ ● ● ●   408-DS        03 / 20    │  ← 高 34，上下 padding sm，底部 1px border
├──────────────────────────────────┤
│                                  │
│  在长度为 n 的顺序表中删除第 i    │  ← type.card, text, lineHeight 26
│  个元素，平均需要移动多少个元素？ │
│                                  │
│  ┌────────────────────────────┐  │  ← 可选 code 块：bg #0A0D13, radius.sm, padding md
│  │ O(n)  vs  O(n²)            │  │     fontFamily mono, color textDim, 左侧 2px primary 竖条
│  └────────────────────────────┘  │
└──────────────────────────────────┘
```

- 顶部三点：直径 6，间距 5，颜色 `textMute`；学科代号 `type.micro` + 该 deck 的 accent 色。
- 进度 `03 / 20` 用 `type.micro`，`textMute`，右对齐。
- 卡片水平 padding `lg`，垂直 `xl`。

### 6.2 选项按钮（`components/OptionButton.tsx`）

四种状态，全部靠 `borderColor` + `bg` 变化，不加缩放以外的装饰：

| 状态 | bg | border | 文字 |
| --- | --- | --- | --- |
| 默认 | `surface` | `border` | `text` |
| 按下 | `surfaceHigh` | `borderStrong` | `text` |
| 选中（多选未提交） | `primarySoft` | `primary` | `text` |
| 正确（提交后） | `successSoft` | `success` | `text` |
| 错误（提交后） | `dangerSoft` | `danger` | `text` |

- 高 52，radius.md，水平 padding lg。
- 左侧一个 22×22 的字母标（A/B/C/D）：`mono` 11px，圆形描边 `border`；正确态换成 `✓`、错误态换成 `✕`。
- 多选态字母标换成方框（radius 5），选中时填充 `primary`。

### 6.3 底部主按钮

- 高 54，radius.md，bg `primary`，文字 `#0A0D13`（深底反白，**不要用白色字**），`type.small` + 600。
- 禁用态：`bg: colors.surfaceHigh`，文字 `textMute`。
- 位置：固定在 SafeArea 底部上方 16。

### 6.4 今日进度环（`components/ProgressRing.tsx`）

- `react-native-svg` 的 Circle，`strokeLinecap="round"`，起始角 -90°。
- 轨道 `stroke: colors.border`，宽度 8；进度 `stroke: colors.primary`，宽度 8。
- 中心显示 `done/target`：分子 `display` 字号 monoBold primary，分母 `caption` textMute。

### 6.5 统计柱状图（`components/BarChart.tsx`）

- 只画柱 + 基线，不画网格背景。
- 柱宽 = `(width - gap*(n-1)) / n`，`gap = 4`，顶部圆角 3。
- 达标日（`done >= goal`）用 `primary`，未达标用 `borderStrong`，今天用 `warning` 描边。
- X 轴只标首尾和今天，`micro` 字号 `textMute`。

### 6.6 底部 Tab

- 无边框线，bg `bg`，高度 56 + safe area。
- 图标 `Ionicons`，未选中 `textMute`，选中 `primary`；标签 `micro` 字号。
- Tab 名字：`今日` / `统计` / `我的`（学习页是全屏推入，不占 Tab）。

## 7. 动效规范（reanimated）

| 场景 | 效果 | 参数 |
| --- | --- | --- |
| 卡片进入 | 淡入 + 上移 12 | 220ms, `Easing.out(Easing.cubic)` |
| 答对 | 卡片轻微上滑淡出，边框闪一次 `success` | 260ms |
| 答错 | 水平抖动 ±8px × 3，边框闪 `danger` | 320ms |
| 选项选中 | `scale` 0.98 → 1 | 120ms |
| 进度环 | `strokeDashoffset` 动画补间 | 500ms |
| 页面切换 | 默认 stack 动画即可，不自定义 | — |

**约束**：所有动画必须在 `300ms` 上下，学习场景里慢动画 = 烦。禁止弹跳（`withSpring` 除非必要）。

## 8. 空状态与错误文案风格

语气像队友，不像客服：

- 今日已学完 → `今天的卡片清空了。` + 副标题 `明天到期 12 张，先歇会儿。`
- 无错题 → `暂时没有错题，保持住。`
- AI 未配置 → `还没填 API Key，先看离线解析。`（配一个「去填」按钮）
- 加载失败 → `读取题库失败，下拉重试。`

不要用「哎呀」「哦豁」「~」这类卖萌语气，不要感叹号堆叠。
