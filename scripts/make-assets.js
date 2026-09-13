import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");

function run(cmd, cwd = root) {
	const [file, ...args] = cmd;
	const proc = spawnSync(String(file), args, { cwd, encoding: "utf8" });
	if (proc.error) {
		throw new Error(`命令无法执行: ${cmd.join(" ")}\n${proc.error.message}`);
	}
	if (proc.status !== 0) {
		throw new Error(`命令失败: ${cmd.join(" ")}\n${proc.stderr ?? ""}`);
	}
	return (proc.stdout ?? "").trim();
}

const buildDir = path.join(root, "build");
const renderIcon = path.join(root, "scripts", "render-icon.swift");

if (process.platform !== "darwin") {
	console.log("[make-assets] macOS 素材生成仅在 darwin 平台运行");
	process.exit(0);
}

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "game-dogwangwang-assets-"));
const masterPng = path.join(tmpDir, "master.png");

console.log("[make-assets] 渲染 1024x1024 主图标...");
run(["swift", renderIcon, masterPng]);

const iconsetPath = path.join(tmpDir, "icon.iconset");
fs.mkdirSync(iconsetPath, { recursive: true });

const sizes = [
	[16, 16],
	[32, 16],
	[32, 32],
	[64, 32],
	[128, 128],
	[256, 128],
	[256, 256],
	[512, 256],
	[512, 512],
	[1024, 512],
];

for (const [px, base] of sizes) {
	const suffix = px === base ? "" : "@2x";
	const outName = `icon_${base}x${base}${suffix}.png`;
	console.log(`[make-assets] 生成 ${outName} (${px}x${px})...`);
	run([
		"sips",
		"-z",
		String(px),
		String(px),
		masterPng,
		"--out",
		path.join(iconsetPath, outName),
	]);
}

fs.mkdirSync(buildDir, { recursive: true });

const icnsPath = path.join(buildDir, "icon.icns");
fs.rmSync(icnsPath, { force: true });
console.log("[make-assets] 合成 build/icon.icns ...");
run(["iconutil", "-c", "icns", iconsetPath, "-o", icnsPath]);

fs.rmSync(tmpDir, { recursive: true, force: true });

console.log("[make-assets] 完成");
