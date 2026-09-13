# 小狗汪汪 🐶

给小朋友玩的桌面小游戏：按任意键，或者用鼠标 / 触摸板点一下屏幕，小狗就会「汪」一声并做个动作。

- **技术栈**：Electron（桌面壳）+ Vue 3 + Vite + TypeScript
- **构建**：`electron-vite`（开发 + 构建）+ `electron-builder`（打 dmg），统一走 npm scripts

## 快速开始

```bash
npm install      # 安装依赖
npm run dev      # 开发版，渲染进程 HMR（改 .vue 即时生效，推荐边调 UI 边用）
npm run start    # 用 out/ 里的构建产物启动
npm run build    # 打 dmg 到 dist/
npm run build:dir  # 只打包 .app，不制 dmg（快）
```

## 目录结构

```
src/
  main/index.ts       Electron 主进程：全屏窗口 + 中文菜单（⌘Q）
  renderer/
    index.html        渲染进程入口
    main.ts           挂载 Vue 应用
    App.vue           全部界面：场景、小狗、动画、交互
    bark.ts           Web Audio 合成狗叫（无音频文件）
    app.css           全局基础样式
electron.vite.config.ts  构建配置（main / renderer 两套，renderer 的 base 是 "./"）
scripts/                 macOS 图标渲染脚本（swift，现场生成，不进仓库）
```

dev 下 electron-vite 会注入 `ELECTRON_RENDERER_URL`，主进程用它走 dev server；没这个变量（生产）就 `loadFile` 读 `out/renderer/index.html`。

## 交互与特效

| 输入 | 反馈 |
| --- | --- |
| 任意按键 | 汪一声 + 随机动作 + 气泡台词 |
| 点击 / 触摸 | 同上 |
| 移动指针 | 小狗目光（整体轻微偏移）跟随指针 |

随机动作有 5 种：`jump` / `spin` / `wiggle` / `bow` / `tilt`，由 `App.vue` 里的 `REACTIONS` 定义。

## 声音是怎么来的

`src/renderer/bark.ts` 用 Web Audio 实时合成，项目里没有任何音频文件。文件顶部是一组调音台常量，改叫声先动它们：

- 声源：锯齿波（谐波）+ 低八度三角波（胸腔厚度），基频 ~540Hz，110ms 内下坠到 0.62 倍
- 声带抖动：~46Hz 的振幅调制（深度 0.18），负责犬吠那股粗糙感，去掉就变电子音
- 共振峰：两个 peaking 滤波器串起来（850Hz / 1550Hz），把音色钉在「啊/嗷」上；再高通切掉 220Hz 以下的糊音
- 起音气流：16ms 的宽频噪声（2.4kHz → 900Hz），「汪」的爆破感来自这里
- 包络：3ms 起音 + 25ms 饱满段 + 指数收尾；另有约 45% 概率连叫两声

调参要点：**时长和收尾是「汪」和「呜」的分界线**。`BARK_MS` 超过 ~0.2s、`F0_DROP` 掉得太低（缓降）、或 `NOISE_LEVEL` 太小（没有爆破），都会从「汪」变「呜」。

## 打包

`npm run build` 依次做：

1. `npm run assets` — `scripts/make-assets.js` 用 swift 渲染主图标，sips 缩放 + `iconutil` 合成 `build/icon.icns`
2. `npm run typecheck` — `vue-tsc --noEmit`
3. `electron-vite build` — 输出到 `out/`
4. `electron-builder --mac` — 打 dmg 到 `dist/`

dmg 里图标和 Applications 的位置写在 `package.json` 的 `build.dmg.contents` 里（用的是 electron-builder 默认窗口 540×380，没有自定义背景图）。

## 发布

在 GitHub 上发一个 release（网页点 Publish，或 `gh release create v1.0.0`），`.github/workflows/release.yml` 会自动打包并上传到该 release：

| 产物 | 平台 |
| --- | --- |
| `...-mac-arm64.dmg` | macOS Apple Silicon |
| `...-mac-x64.dmg` | macOS Intel |

产物名由 `package.json` 的 `build.artifactName` 决定（`${name}-${version}-${os}-${arch}.${ext}`）。

### macOS 安装说明

应用未经代码签名，首次打开时 macOS 可能会提示"已损坏，无法打开"。解决方法有两种：

#### 方法 1：命令行解除隔离属性（推荐）

打开终端，执行以下命令：

```bash
sudo xattr -rd com.apple.quarantine /Applications/game-dogwangwang.app
```

然后就可以正常打开应用。

#### 方法 2：使用右键菜单

1. 打开 Finder，找到应用
2. 右键选择"打开"
3. 在弹出窗口中点击"打开"确认

之后就不会再提示。

## 产物与临时文件

- `out/` — electron-vite 构建输出（`out/main`、`out/renderer`）
- `dist/` — electron-builder 产出（.app 与 dmg）
- `build/` — buildResources，放生成的 `icon.icns` / `background.png`

以上都在 `.gitignore` 里，不要提交。
