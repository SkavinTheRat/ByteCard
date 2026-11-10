# 阶段 12 · Android APK 打包与 ColorOS 适配

> 目标机型：OPPO 手机，ColorOS 最新版（15/16，Android 15/16 基线）。
>
> 阶段 7 只写了「怎么打包」，20 行，够跑通但不够「装上去好用」。
> 这个阶段补两件事：**一次配对打包配置** + **ColorOS 会真实破坏体验的 8 个地方**。
>
> ⚠️ 最重要的前提：**Expo Go 里测不出这个阶段 80% 的问题。**
> edge-to-edge、强制深色、字体缩放、后台被杀、通知权限——在 Expo Go 里全部正常，
> 打成 APK 装上才暴露。所以本阶段的验收**必须在真机 APK 上做**。

---

## Part A · 打包配置（一次配对，别反复试）

### A1 · `app.json` 的 android 段（照抄，再改成你的）

```jsonc
{
  "expo": {
    "name": "字节卡",
    "slug": "bytecard",
    "version": "1.0.0",
    "scheme": "bytecard",
    "userInterfaceStyle": "dark",
    "android": {
      "package": "com.yourname.bytecard",
      "versionCode": 1,
      "adaptiveIcon": {
        "foregroundImage": "./assets/adaptive-icon.png",
        "backgroundColor": "#0A0D13"
      },
      "edgeToEdgeEnabled": true,
      "softwareKeyboardLayoutMode": "resize",
      "permissions": [
        "android.permission.POST_NOTIFICATIONS",
        "android.permission.SCHEDULE_EXACT_ALARM",
        "android.permission.VIBRATE"
      ],
      "blockedPermissions": [
        "android.permission.CAMERA",
        "android.permission.RECORD_AUDIO",
        "android.permission.ACCESS_FINE_LOCATION",
        "android.permission.ACCESS_COARSE_LOCATION",
        "android.permission.READ_EXTERNAL_STORAGE",
        "android.permission.WRITE_EXTERNAL_STORAGE"
      ],
      "allowBackup": false
    }
  }
}
```

每一行为什么要这么写：

| 配置 | 原因 |
| --- | --- |
| `userInterfaceStyle: "dark"` | **不只是主题**。声明只支持深色后，系统（含 ColorOS 的强制深色）不会再去反转你的界面。这是防强制深色反转的第一道防线。 |
| `edgeToEdgeEnabled: true` | Android 15+ 本来就强制全屏布局，主动开启才能正确配合 SafeArea；关掉反而在 Android 16 上出兼容问题。 |
| `softwareKeyboardLayoutMode: "resize"` | 填空页键盘弹起时压缩可视区域（而不是平移整页）。`pan` 会把卡片推到看不见的地方。 |
| `permissions` 只列 3 个 | `POST_NOTIFICATIONS` 通知、`SCHEDULE_EXACT_ALARM` 精确提醒、`VIBRATE` 触感。**其余一个都别要。** |
| `blockedPermissions` | Expo 默认模板会带 CAMERA、RECORD_AUDIO、定位、存储这些**你根本不用**的权限。ColorOS 的「应用安全检测」会拿这个提示用户「疑似窃取隐私」，安装时弹警告。显式屏蔽掉。 |
| `allowBackup: false` | 关掉系统自动备份，避免「从旧手机恢复出一个半新半旧的数据库」这种难排查的状态。备份我们自己通过阶段 11 的导出做。 |

### A2 · 防强制深色（ColorOS 特有，必须做）

ColorOS 有「设置 → 显示与亮度 → 深色模式 → 强制深色第三方应用」。
如果某个 App 没声明自己的深色支持，系统会**自动反转它的颜色**。

我们的 UI 全是手工调的深色配色（`bg #0A0D13`、`primary #22D3EE`），被系统反转后会变成
「浅色底 + 脏青绿」，整套视觉直接毁掉。

`userInterfaceStyle: "dark"` 能挡掉大部分情况，但**不保证**。再补一道 `forceDarkAllowed`：

写一个本地 config plugin `plugins/withForceDarkDisabled.js`：

```js
const { withAndroidManifest } = require('expo/config-plugins');

module.exports = function withForceDarkDisabled(config) {
  return withAndroidManifest(config, (config) => {
    const app = config.modResults.manifest.application?.[0];
    if (app) {
      app.$['android:forceDarkAllowed'] = 'false';
    }
    return config;
  });
};
```

在 `app.json` 的 `plugins` 数组里加 `"./plugins/withForceDarkDisabled"`。

**替代方案**（不想写插件）：`npx expo prebuild -p android` 之后手改
`android/app/src/main/res/values/styles.xml`，在主题里加
`<item name="android:forceDarkAllowed">false</item>`。
缺点是下次 prebuild 会被覆盖，所以还是插件方案稳妥。

### A3 · `eas.json`

```jsonc
{
  "cli": { "version": ">= 5.0.0", "appVersionSource": "local" },
  "build": {
    "preview": {
      "distribution": "internal",
      "android": {
        "buildType": "apk",
        "image": "latest"
      }
    },
    "production": {
      "android": { "buildType": "app-bundle" }
    }
  }
}
```

- 自用装 APK → 用 `preview`（`buildType: apk`）。
- 想上架应用商店才用 `production`（`app-bundle`，AAB 格式，不能直接装）。
- `appVersionSource: "local"` 让我们自己控 `versionCode`，不用 EAS 自动递增。

构建命令：

```bash
npm i -g eas-cli
eas login                       # 需要 Expo 账号（免费）
eas build:configure             # 首次会生成 eas.json 并注册项目
eas build -p android --profile preview
```

- 首次构建 EAS 会自动生成并托管 keystore（签名证书），**一定要选「让 EAS 管理」**。
  自己生成的话丢了就再也无法覆盖安装（新签名 = 另一个 App）。
- 免费账号每月构建次数有限，所以**一次把配置配对**再提交，别拿云构建当调试工具。
- 如果 EAS 拉取或上传太慢：加 `--local` 在本机构建（需要 JDK 17 + Android SDK，
  通过 `npx expo prebuild -p android` 生成的工程构建），或者避开网络高峰。

### A4 · 体积与架构

- OPPO 主力机型都是 **arm64-v8a**。EAS 默认打 universal APK（含 arm64 + armeabi-v7a + x86_64），
  体积会大 30~40MB。自用可以在 `eas.json` 的 preview 里加：

```jsonc
"android": { "buildType": "apk", "buildArchs": ["arm64-v8a"] }
```

- 目标体积：**≤ 45MB**。超了先查是不是 `assets/images/` 里塞了大图（`spec/04` 定了 3MB 上限）。
- Hermes 默认开启，不要关（启动速度差一截）。
- 不要开 `enableProguardInReleaseBuilds` 之外的激进混淆，RN 应用混淆收益低、排查难。

---

## Part B · ColorOS 运行时适配（按破坏程度排序）

### B1 · 字体缩放让布局溢出（最常见）

ColorOS 有**两个独立**的缩放开关：

- 「设置 → 显示与亮度 → 字体大小」（影响 `fontScale`）
- 「设置 → 显示与亮度 → 显示大小」（影响 `density`）

用户调到最大时 `fontScale ≈ 1.3`，所有 `fontSize` 会被系统乘 1.3。
我们的选项按钮是**固定高度 52**，1.3 倍字体下文字会顶到边框甚至被裁掉。

**要求**：

- 选项按钮、列表行、Tab 栏的高度改成 `minHeight`，不要 `height`。
- 卡片内部不要写死行数，题干用 `numberOfLines` 限制，但**解析面板不限制**（完整显示，靠滚动）。
- 在 `app/_layout.tsx` 里读一次 `PixelRatio.getFontScale()` 并 `console.log`，
  在「我的 → 关于」里显示 `字体缩放 1.30`（`__DEV__` 才显示）。
- **测试方法**：把系统字体调到最大 → 刷 20 张卡 → 没有任何文字被裁、没有按钮重叠。

### B2 · 手势条遮挡底部主按钮（第二常见）

Android 15+ 强制 edge-to-edge，ColorOS 的手势条 / 三键导航栏高度与原生 Android 不同
（尤其 OPPO 的三键导航更矮但更靠下）。

**要求**：

- 所有页面底部元素的位置必须来自 `useSafeAreaInsets().bottom`，不许写死 `paddingBottom: 16`。
- 学习页底部「下一张」按钮：`marginBottom: insets.bottom + 16`。
- 全屏学习页如果用了 `StatusBar hidden`，顶部仍要留 `insets.top`（ColorOS 的挖孔/药丸位置不同）。
- **测试方法**：分别用「手势导航」和「虚拟按键」两种模式各刷 5 张，
  确认按钮完整可见、可点击、不被手势条压住。

### B3 · 后台被杀 → 每日提醒不响（最容易被当成 bug）

ColorOS 的后台管理是国产 ROM 里最激进的之一。`expo-notifications` 的 DAILY 定时提醒
依赖系统调度，App 被「智能省电」限制后**提醒会静默不响**，而用户只会觉得
「这 App 的提醒功能是坏的」。

**要求**：

1. App 内在「我的 → 每日提醒」下方加一段可展开的引导（`caption` 字号，默认折叠）：

```
ColorOS 需要额外设置才能保证提醒准时：

1. 设置 → 电池 → 应用耗电管理 → 字节卡 → 允许后台运行
2. 关闭「智能省电限制」
3. 设置 → 应用管理 → 特殊权限 → 闹钟和提醒 → 允许

（不同 ColorOS 版本路径略有差异，找不到就在设置里搜"字节卡"）
```

2. 打开提醒开关时，**弹一次**（仅一次，用 `settings.reminder_tip_shown` 记）这个引导，
   而不是每次都弹。
3. 提醒时间**不要用精确到分钟的承诺**。文案写 `每晚 20:30 提醒` 而不是 `20:30 准时提醒`。
   因为 `expo-notifications` 的 DAILY trigger 用的是非精确闹钟（inexact），
   ColorOS 上可能延迟几分钟到半小时。要精确就得申请 `SCHEDULE_EXACT_ALARM` 并用
   `AndroidNotificationPriority` 配合，但代价是审核更严、更费电，**不值得**。
4. 在「我的」页显示提醒的真实状态：`已开启（下次约 20:30）` 或 `已开启（系统可能延迟）`。

### B4 · 通知权限是三层，不是一层

ColorOS 的通知设置拆成：**允许通知** / **横幅通知** / **锁屏通知**。
用户只开第一层时，提醒会进通知栏但不弹出来，很容易被忽略。

**要求**：

- 申请权限后，用 `getPermissionsAsync()` 检查 `status`，拒绝时给的是**去设置**的按钮
  （`Linking.openSettings()`），不是干巴巴的一句「被拒绝了」。
- 建通知渠道时（`setNotificationChannelAsync`）设 `importance: HIGH` + `vibrationPattern`，
  这样在 ColorOS 上至少会进「重要通知」分类。

### B5 · 输入法遮挡填空输入框

ColorOS 自带百度输入法定制版，候选栏比原生高。
填空题的输入框在页面中部时，键盘弹起 + 候选栏会把它挤到看不见。

**要求**：

- 填空页用 `KeyboardAvoidingView` + `behavior="padding"`，
  并且包在 `ScrollView` 里（`keyboardShouldPersistTaps="handled"`）。
- 输入框获得焦点时**主动滚动到可视区**：用 `ScrollView.scrollTo` 或 `react-native-keyboard-controller`
  （不用引库，手写 `scrollTo({ y: inputY - 120 })` 就够）。
- **测试方法**：输入法切到「中文 9 键」和「英文全键盘」各测一次，
  确认输入框、提示文字、提交按钮都在键盘上方可见。

### B6 · 小窗 / 分屏 / 悬浮窗

ColorOS 支持把 App 拉成小窗（高度可能只有 300dp 左右）。学习页在这么矮的空间里
如果内容不可滚动，用户会卡死（看不到选项也点不到按钮）。

**要求**：

- 学习页的整个内容区**必须可滚动**（`ScrollView` 包住卡片 + 解析），
  不要因为「手机屏幕够高」就省掉。
- 小窗里 `insets` 会变小甚至为 0，所有依赖 `insets.bottom` 的布局要能退化成 16。
- 不要在 `onLayout` 里假设最小高度。

### B7 · 应用分身（多实例）

ColorOS 的「应用分身」会创建第二个实例，两个实例有**各自的 SQLite 数据库**。
不会冲突，但用户会困惑「为什么分身里进度是空的」。

**要求**：

- 不做技术处理（成本不值得），只在「我的 → 关于」里加一行小字：
  `应用分身里的数据与主应用独立。`
- 不要试图共享数据库（跨实例文件访问在 Android 上不可靠）。

### B8 · 深色模式切换不闪白

用户从浅色系统切深色（或反之）时，`userInterfaceStyle: "dark"` 应该让 App 恒定深色。
但要确认：**切换瞬间不要闪一下白底**。

- `app.json` 的 `splash.backgroundColor` 和 `android.adaptiveIcon.backgroundColor` 都设成 `#0A0D13`。
- `app/_layout.tsx` 的根 View 永远 `backgroundColor: colors.bg`（不是透明）。
- **测试方法**：系统浅色 ↔ 深色来回切 3 次，观察有没有白闪。

---

## Part C · 安装到 OPPO 手机上

### C1 · 装不上 / 被拦（ColorOS 的固定流程）

1. **「未知来源应用」没开**：设置 → 应用管理 → 特殊应用权限 → 安装未知应用 →
   选择你用来打开 APK 的应用（文件管理 / 浏览器 / 微信）→ 允许。
2. **「应用安全检测」拦你**：安装时弹「此应用存在风险」。
   这是 OPPO 的本地扫描，因为 APK 没在应用商店上架。
   选择「仍然安装」/「继续安装」；如果连按钮都没有，去
   「设置 → 安全 → 应用安全检测」临时关闭，装完再打开。
3. **「纯净模式」**：部分 ColorOS 版本默认开启，会拒绝安装非商店应用。
   设置 → 安全 → 纯净模式 → 关闭（装完可以再开）。
4. **「应用未安装」**：签名不一致。你之前装过用别的 keystore 打的包，
   必须先卸载旧版本（数据会丢）再装。

### C2 · 版本更新（覆盖安装）

- `versionCode` **必须严格递增**（1 → 2 → 3）。忘改的话 ColorOS 会拒绝覆盖安装，
  或者装上后仍是旧版本。
- 签名必须**同一个 keystore**。EAS 托管的不要删，也可以在
  `eas credentials` 里导出备份（**备份到 D 盘，不要只留云端**）。
- 覆盖安装保留数据；卸载重装清空数据。

### C3 · 和阶段 11 热更新的分工

| 改了什么 | 需要重新打包吗 |
| --- | --- |
| 题库内容（加卡/改题） | ❌ 不用。热更新或导出导入即可 |
| 题型、代码、UI | ✅ 要，`versionCode` +1 |
| App 图标 / 名称 | ✅ 要 |

**日常加卡不要重新打包**——这是阶段 11 存在的全部意义。

---

## Part D · ColorOS 专项测试清单

装好 APK 后逐条过，每一条都要在**真机**上做（Expo Go 不算）：

**布局与视觉**
- [ ] 系统字体调到最大 → 刷 20 张卡，无文字裁切、无按钮重叠
- [ ] 系统「显示大小」调到最大 → 三个 Tab 页不错位
- [ ] 手势导航模式下，学习页「下一张」按钮完整可见可点
- [ ] 三键导航模式下，同上
- [ ] 系统浅色 ↔ 深色来回切 3 次，无白闪
- [ ] 开启 ColorOS「强制深色第三方应用」后，App 配色**没有**被反转
- [ ] 小窗模式（拉到最小）→ 学习页仍可滚动到底部按钮

**功能**
- [ ] 首次启动 → 引导 → 选学科 → 学第一张，全程无卡顿
- [ ] 飞行模式下学完一整个队列（AI 走 Mock，不崩）
- [ ] 填空题：中文 9 键输入法下，输入框不被键盘/候选栏遮挡
- [ ] 每日提醒：设置后等一个周期，确认真的响了（不响就按 B3 引导用户设置）
- [ ] 杀掉 App 再打开，进度、连续天数、错题本都在
- [ ] 手机重启后，提醒仍然生效

**安装与更新**
- [ ] 首次安装时处理好「未知来源」+「安全检测」
- [ ] `versionCode` +1 后能覆盖安装，且数据保留
- [ ] 备份 keystore 到 D 盘

---

## 不要做的事

- ❌ 不要为了「兼容」去关 edge-to-edge（Android 16 上反而更糟）。
- ❌ 不要申请不需要的权限来「图省事」——ColorOS 的安全检测会因此警告用户。
- ❌ 不要用精确闹钟去保证提醒准点。代价（费电、审核、用户授权摩擦）远大于收益。
- ❌ 不要在小窗场景下写死布局高度。
- ❌ 不要把 keystore 只留在 EAS 云端。

## 交付时告诉我

1. `app.json` 的最终 android 段（脱敏 package 名）。
2. APK 的实际体积，以及在你自己 OPPO 手机上是否遇到了「应用安全检测」拦截，怎么过的。
3. **强制深色那个坑**：`forceDarkAllowed` 插件加上之后，ColorOS 的强制深色是否真的不生效了？
   如果还是被反转，说明什么？
4. 字体缩放 1.3 倍下，你被迫改动了哪几个组件的布局？列出来（这些是硬编码 `height` 的地方）。
5. 提醒在你的手机上实测验了几次、延迟多少分钟。

---
