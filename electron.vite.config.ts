import { defineConfig } from "electron-vite";
import vue from "@vitejs/plugin-vue";

export default defineConfig({
	main: {
		build: {
			lib: {
				entry: "src/main/index.ts",
				formats: ["es"],
			},
		},
	},
	renderer: {
		// 生产环境是从 file:// 加载的，资源必须走相对路径
		base: "./",
		plugins: [vue()],
		server: {
			port: 5173,
			strictPort: true,
		},
	},
});
