# AGENTS.md

给 AI / 新协作者的工程约定。改代码前先扫一遍，能少走弯路。

## 常用命令

```bash
npm run dev         # 启动开发版（渲染进程 HMR，改 .vue 即时生效）
npm run start       # 用 out/ 里的构建产物启动
npm run build       # 图标素材 + 类型检查 + 构建 + 打 dmg
npm run build:dir   # 只打包出 .app，不制 dmg（快，用来验证打包）
npx electron-vite build  # 只构建到 out/，验证改动最快
npx vue-tsc --noEmit     # 类型检查
```

前端改动的最小验证闭环：`npx electron-vite build` 通过 → `npm run dev` 启动无报错。

## 代码风格

- 缩进用 **tab**，字符串用 **双引号**，语句带分号
- Vue 用 `<script setup lang="ts">`，SFC 顺序：script → template → style
- 组件样式一律 `<style scoped>`；动画用 CSS `@keyframes`，通过加/摘 class 触发
- 注释和 UI 文案用中文

## 各文件要点

- `src/renderer/App.vue` — 界面、状态、动画都在这里。小狗是 emoji `🐶`（`.dog-emoji`），不是 SVG。
  - 重播 CSS 动画要先移除 class、强制回流（`replay()`），否则连续触发不会重新播放
  - 反应状态挂在 `.dog` 上的 `is-jump` / `is-spin` / ... class，CSS 用 `.dog[class*="is-"]` 匹配
  - 指针跟随通过 `--look-x` / `--look-y` 两个 CSS 变量传递
- 狗叫是**直接播录音**不是合成的：`App.vue` 里一个 `Audio` 元素 `play()` 就完事，素材是 `src/renderer/public/bark.mp3`（项目里唯一的音频资源）
- `src/renderer/public/` — 会原样拷进 `out/renderer/`，放不需要打包处理的静态素材。引用它时路径要写成 `new URL("xxx", document.baseURI)`，否则生产环境（`file://`）会指向错地方。
- `src/main/index.ts` — Electron 主进程：全屏窗口 + 中文菜单（⌘Q）。dev 下用 `ELECTRON_RENDERER_URL`（electron-vite 注入）走 dev server，否则 `loadFile` 读 `out/renderer/index.html`。
- `electron.vite.config.ts` — 构建配置。renderer 的 `base` 必须是 `"./"`，否则 `file://` 加载时资源路径是绝对的会白屏。

## 已知问题

- 主进程是 ESM（package.json 有 `"type": "module"`），**不要在主进程用顶层 `await app.whenReady()`**：ready 永远不会触发，窗口也就建不出来。用 `app.whenReady().then(createWindow)`。
- 如果终端里设了 `http_proxy` 代理，Electron 会因此 `Network service crashed` 直接退出。从这种环境启动时要 `env -u http_proxy -u https_proxy -u HTTP_PROXY -u HTTPS_PROXY npm run dev`，或者加 `--no-proxy-server`。普通终端一般没这问题。
- 项目启用 `noUnusedLocals` / `noUnusedParameters`，声明了不用的变量会直接报错。

## 不要做

- 不要提交 `out/`、`dist/`、`build/`（已在 `.gitignore`）
- 不要因为改 UI 就引入 UI 库或额外依赖，这个项目的卖点就是零依赖的手写 CSS 动画
- 不要往仓库里塞额外的音频 / 图片素材：声音只有 `src/renderer/public/bark.mp3` 这一个（录音，非合成），图形是纯 CSS + emoji；`build/icon.icns` 由 `npm run assets` 用 swift 现场渲染
