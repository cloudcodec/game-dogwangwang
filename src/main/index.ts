import { BrowserWindow, Menu, app } from "electron";
import { join } from "node:path";

/** dev 下由 electron-vite 注入，生产环境没有这个变量 */
const DEV_SERVER_URL = process.env["ELECTRON_RENDERER_URL"];

function createWindow(): void {
	const win = new BrowserWindow({
		title: "小狗汪汪",
		width: 960,
		height: 720,
		x: 200,
		y: 200,
	});

	win.setFullScreen(true);

	if (DEV_SERVER_URL) {
		win.loadURL(DEV_SERVER_URL);
	} else {
		win.loadFile(join(import.meta.dirname, "../renderer/index.html"));
	}
}

// 没有菜单就没有 ⌘Q，全屏下就退不出去
Menu.setApplicationMenu(
	Menu.buildFromTemplate([
		{
			label: "小狗汪汪",
			submenu: [{ label: "退出小狗汪汪", role: "quit" }],
		},
	]),
);

// 主进程是 ESM，顶层 await 会把 ready 卡住，所以这里用回调而不是 await
app.whenReady().then(createWindow);

app.on("activate", () => {
	if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

app.on("window-all-closed", () => {
	if (process.platform !== "darwin") app.quit();
});
