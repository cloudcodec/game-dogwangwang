<script setup lang="ts">
import { onBeforeUnmount, onMounted, reactive, ref } from "vue";

/** 反应动作和它对应的动画时长 */
const REACTIONS = [
	{ type: "jump", ms: 560 },
	{ type: "spin", ms: 720 },
	{ type: "wiggle", ms: 520 },
	{ type: "bow", ms: 640 },
	{ type: "tilt", ms: 560 },
] as const;

const BUBBLES = ["汪!", "汪汪!", "嗷呜~", "汪汪汪!", "嗨!", "嗷~", "汪呜!"];
const SPRITES = ["🐾", "❤️", "🎵", "🦴", "✨", "💛"];

/** 狗叫录音：src/renderer/public/bark.mp3，构建后就在页面旁边 */
const bark = new Audio(new URL("bark.mp3", document.baseURI).href);
bark.preload = "auto";

/** 汪一声。level 越大叫得越响。 */
function playBark(level = 1): void {
	bark.volume = level;
	bark.currentTime = 0;
	void bark.play().catch(() => {
		// 自动播放策略拦下来就算了，不影响交互
	});
}

/** 每满这么多次汪汪，放一次烟花 */
const FIREWORK_EVERY = 10;
/** 烟花从地面升到炸点要多久，爆炸的延迟跟它对齐 */
const LAUNCH_MS = 900;
/** 爆炸闪光时长 */
const FLASH_MS = 1000;
/** 火星飞散时长，爆炸元素就是靠它延迟出场 */
const BURST_MS = 2400;
const SPARK_SLOTS = 16;

/** 天上的 ✨，启动时随机撒一次，之后靠 CSS 一直闪 */
const STARS = Array.from({ length: 18 }, (_, i) => ({
	id: i,
	x: 4 + Math.random() * 92,
	y: 6 + Math.random() * 46,
	size: 14 + Math.random() * 16,
	delay: (Math.random() * 4).toFixed(2),
	duration: (2.4 + Math.random() * 2.8).toFixed(2),
}));

type Particle = { id: number; x: number; y: number; text: string };
type Burst = { id: number; x: number; y: number; hue: number };

const dogEl = ref<HTMLElement | null>(null);
const barkCount = ref(0);
const lastInput = ref("");
const bubble = ref("");
const showBubble = ref(false);
const particles = reactive<Particle[]>([]);
const rings = reactive<{ id: number }[]>([]);
const bursts = reactive<Burst[]>([]);
const look = reactive({ x: 0, y: 0 });

let seq = 0;
let bubbleTimer = 0;
let reactionTimer = 0;
let reactionClass = "";

function pick<T>(list: readonly T[]): T {
	return list[Math.floor(Math.random() * list.length)] as T;
}

/** 往特效列表里加一项，播完动画就自己删掉 */
function spawn<T extends { id: number }>(
	list: T[],
	item: Omit<T, "id">,
	ms: number,
): void {
	const id = ++seq;
	list.push({ ...item, id } as T);
	window.setTimeout(() => {
		const idx = list.findIndex((it) => it.id === id);
		if (idx > -1) list.splice(idx, 1);
	}, ms);
}

/** 重新触发一次 CSS 动画：先移除 class，强制回流后再加上。 */
function replay(el: HTMLElement, cls: string, ms: number): void {
	if (reactionClass) el.classList.remove(reactionClass);
	// 强制回流，保证连续触发时动画能重新播放
	void el.offsetWidth;
	el.classList.add(cls);
	reactionClass = cls;
	window.clearTimeout(reactionTimer);
	reactionTimer = window.setTimeout(() => {
		el.classList.remove(cls);
		reactionClass = "";
	}, ms);
}

function react(label: string, level = 1): void {
	barkCount.value += 1;
	lastInput.value = label;
	bubble.value = pick(BUBBLES);
	showBubble.value = true;
	window.clearTimeout(bubbleTimer);
	bubbleTimer = window.setTimeout(() => (showBubble.value = false), 1100);

	playBark(level);

	const el = dogEl.value;
	if (el) {
		const reaction = pick(REACTIONS);
		replay(el, `is-${reaction.type}`, reaction.ms);
	}
	spawnRings();
	spawnParticles();
	if (barkCount.value % FIREWORK_EVERY === 0) {
		spawnFireworks();
	}
}

/** 放一发烟花：先从草地升空，到顶再炸开 */
function spawnFireworks(): void {
	spawn(
		bursts,
		{
			x: 24 + Math.random() * 52,
			y: 12 + Math.random() * 22,
			hue: Math.floor(Math.random() * 360),
		},
		// 升空 + 火星飞散都结束才回收
		LAUNCH_MS + BURST_MS + 200,
	);
}

function spawnRings(): void {
	for (let i = 0; i < 2; i++) {
		spawn(rings, {}, 700 + i * 120);
	}
}

function spawnParticles(): void {
	const n = 3 + Math.floor(Math.random() * 3);
	for (let i = 0; i < n; i++) {
		spawn(
			particles,
			{
				x: 50 + (Math.random() * 34 - 17),
				y: 42 + Math.random() * 12,
				text: pick(SPRITES),
			},
			1400,
		);
	}
}

const KEY_LABELS: Record<string, string> = {
	" ": "空格",
	Enter: "回车",
	Escape: "Esc",
	Tab: "Tab",
	Backspace: "退格",
	Delete: "Delete",
	ArrowUp: "↑",
	ArrowDown: "↓",
	ArrowLeft: "←",
	ArrowRight: "→",
	Shift: "Shift",
	Control: "Ctrl",
	Alt: "Alt",
	Meta: "Command",
	CapsLock: "Caps",
};

function keyLabel(e: KeyboardEvent): string {
	return (
		KEY_LABELS[e.key] ?? (e.key.length === 1 ? e.key.toUpperCase() : e.key)
	);
}

function onKeyDown(e: KeyboardEvent): void {
	react(keyLabel(e), e.repeat ? 0.6 : 1);
}

function onPointerDown(e: PointerEvent): void {
	trackLook(e);
	const where = e.pointerType === "touch" ? "触摸" : "点击";
	react(where, 1);
}

function onPointerMove(e: PointerEvent): void {
	trackLook(e);
}

/** 让小狗的目光跟着指针走 */
function trackLook(e: PointerEvent): void {
	const el = dogEl.value;
	if (!el) return;
	const clamp = (v: number) => Math.max(-1, Math.min(1, v));
	const box = el.getBoundingClientRect();
	const cx = box.left + box.width / 2;
	const cy = box.top + box.height * 0.32;
	look.x = clamp((e.clientX - cx) / (box.width * 0.9));
	look.y = clamp((e.clientY - cy) / (box.height * 0.9));
}

onMounted(() => {
	window.addEventListener("keydown", onKeyDown);
	window.addEventListener("pointerdown", onPointerDown);
	window.addEventListener("pointermove", onPointerMove);
});

onBeforeUnmount(() => {
	window.removeEventListener("keydown", onKeyDown);
	window.removeEventListener("pointerdown", onPointerDown);
	window.removeEventListener("pointermove", onPointerMove);
	window.clearTimeout(bubbleTimer);
	window.clearTimeout(reactionTimer);
});
</script>

<template>
	<main
		class="stage"
		:style="{ '--look-x': look.x, '--look-y': look.y }"
	>
		<div class="sun" />
		<div class="stars">
			<span
				v-for="star in STARS"
				:key="star.id"
				class="star"
				:style="{
					left: `${star.x}%`,
					top: `${star.y}%`,
					'font-size': `${star.size}px`,
					'--delay': `${star.delay}s`,
					'--duration': `${star.duration}s`,
				}"
				>✨</span
			>
		</div>
		<div class="cloud cloud-a" />
		<div class="cloud cloud-b" />
		<div class="hills" />
		<div class="grass" />

		<div class="fireworks">
			<div
				v-for="b in bursts"
				:key="b.id"
				class="burst"
				:style="{
					'--hue': b.hue,
					'--launch': `${LAUNCH_MS}ms`,
					'--flash': `${FLASH_MS}ms`,
					'--burst': `${BURST_MS}ms`,
				}"
			>
				<span
					class="rocket"
					:style="{
						left: `${b.x}%`,
						'--rise': `calc(${100 - b.y}vh - 100px)`,
					}"
				/>
				<div class="boom" :style="{ left: `${b.x}%`, top: `${b.y}%` }">
					<span class="flash" />
					<span
						v-for="s in SPARK_SLOTS"
						:key="s"
						class="spark"
						:style="{
							'--angle': `${(s - 1) * (360 / SPARK_SLOTS)}deg`,
							'--dist': `${s % 2 ? 240 : 160}px`,
						}"
					/>
				</div>
			</div>
		</div>

		<div class="dog" ref="dogEl">
			<div class="shadow" />
			<div class="rings">
				<span v-for="ring in rings" :key="ring.id" class="ring" />
			</div>
			<div class="dog-jump">
				<div class="dog-face">
					<span class="dog-emoji">🐶</span>
				</div>
			</div>

			<Transition name="pop">
				<div v-if="showBubble" class="bubble">{{ bubble }}</div>
			</Transition>

			<div class="sprites">
				<span
					v-for="p in particles"
					:key="p.id"
					class="sprite"
					:style="{ left: `${p.x}%`, top: `${p.y}%` }"
					>{{ p.text }}</span
				>
			</div>
		</div>

		<footer class="status">
			<div class="chip">
				<span class="chip-label">汪汪次数</span>
				<span class="chip-value">{{ barkCount }}</span>
			</div>
			<div class="chip">
				<span class="chip-label">最后一次</span>
				<span class="chip-value">{{ lastInput || "还没有哦" }}</span>
			</div>
		</footer>
	</main>
</template>

<style scoped>
.stage {
	position: relative;
	width: 100%;
	height: 100vh;
	overflow: hidden;
	background: linear-gradient(#8fd8ff 0%, #c8ecff 55%, #eaf9ff 100%);
	user-select: none;
	touch-action: none;
	cursor: pointer;
}

.sun {
	position: absolute;
	top: 54px;
	right: 82px;
	width: 92px;
	height: 92px;
	border-radius: 50%;
	background: radial-gradient(circle, #fff3b0 0%, #ffd85e 70%, #ffc93c 100%);
	box-shadow: 0 0 60px rgba(255, 208, 80, 0.75);
	animation: float 6s ease-in-out infinite;
}

.stars {
	position: absolute;
	inset: 0;
	pointer-events: none;
}

.star {
	position: absolute;
	line-height: 1;
	opacity: 0.2;
	animation: twinkle var(--duration) ease-in-out var(--delay) infinite;
}

.fireworks {
	position: absolute;
	inset: 0;
	pointer-events: none;
}

.burst {
	position: absolute;
	inset: 0;
}

/* 升空的小火球：从草地一路飞到炸点 */
.rocket {
	position: absolute;
	bottom: 100px;
	width: 17px;
	height: 17px;
	margin-left: -8px;
	border-radius: 50%;
	background: radial-gradient(
		circle,
		#fff 0%,
		#fff6c9 52%,
		hsl(var(--hue) 95% 64%) 100%
	);
	box-shadow: 0 0 26px 7px hsl(var(--hue) 95% 62%);
	animation:
		rise var(--launch) cubic-bezier(0.35, 0, 0.55, 1) both,
		flicker 0.16s steps(2, end) infinite;
}
/* 拖在火球后面的尾焰，让上升轨迹看得见 */
.rocket::after {
	content: "";
	position: absolute;
	left: 50%;
	top: 100%;
	width: 7px;
	height: 78px;
	margin-left: -3.5px;
	border-radius: 999px;
	background: linear-gradient(
		hsl(var(--hue) 95% 72%),
		rgba(255, 190, 70, 0)
	);
	filter: blur(1px);
	transform-origin: 50% 0;
	animation: tail 0.22s ease-in-out infinite alternate;
}

.boom {
	position: absolute;
	width: 0;
	height: 0;
}

.flash {
	position: absolute;
	left: 0;
	top: 0;
	width: 0;
	height: 0;
	border-radius: 50%;
	background: radial-gradient(
		circle,
		#fff 0%,
		hsl(var(--hue) 95% 72%) 42%,
		transparent 70%
	);
	transform: translate(-50%, -50%);
	animation: flash var(--flash) ease-out var(--launch) both;
}

.spark {
	position: absolute;
	left: -8px;
	top: -8px;
	width: 16px;
	height: 16px;
	border-radius: 50%;
	background: hsl(var(--hue) 95% 62%);
	box-shadow: 0 0 20px hsl(var(--hue) 95% 58%);
	animation: spark-fly var(--burst) cubic-bezier(0.15, 0.7, 0.3, 1)
		var(--launch) both;
}

.cloud {
	position: absolute;
	height: 34px;
	border-radius: 999px;
	background: rgba(255, 255, 255, 0.92);
	box-shadow: 0 8px 20px rgba(90, 160, 210, 0.18);
}
.cloud::before,
.cloud::after {
	content: "";
	position: absolute;
	background: inherit;
	border-radius: 50%;
}
.cloud-a {
	top: 84px;
	left: 92px;
	width: 128px;
	animation: drift 26s linear infinite;
}
.cloud-a::before {
	width: 54px;
	height: 54px;
	top: -26px;
	left: 22px;
}
.cloud-a::after {
	width: 38px;
	height: 38px;
	top: -16px;
	left: 68px;
}
.cloud-b {
	top: 158px;
	right: 220px;
	width: 96px;
	opacity: 0.85;
	animation: drift 34s linear infinite reverse;
}
.cloud-b::before {
	width: 44px;
	height: 44px;
	top: -20px;
	left: 18px;
}

.hills {
	position: absolute;
	left: -6%;
	right: -6%;
	bottom: 96px;
	height: 190px;
	background: radial-gradient(120% 100% at 20% 100%, #9fd97f 0 60%, transparent 61%),
		radial-gradient(120% 100% at 74% 100%, #8ed06c 0 60%, transparent 61%);
}

.grass {
	position: absolute;
	left: 0;
	right: 0;
	bottom: 0;
	height: 130px;
	background: linear-gradient(#7dc95f 0%, #5fb243 100%);
	border-top: 6px solid #95dc78;
}

.status {
	position: absolute;
	bottom: 26px;
	left: 50%;
	transform: translateX(-50%);
	display: flex;
	gap: 14px;
}

.chip {
	display: flex;
	align-items: center;
	gap: 10px;
	background: rgba(255, 255, 255, 0.86);
	border-radius: 999px;
	padding: 10px 20px;
	box-shadow: 0 8px 20px rgba(40, 90, 130, 0.16);
}

.chip-label {
	font-size: 13px;
	color: #7b8b96;
}

.chip-value {
	font-size: 17px;
	font-weight: 700;
	color: #f08a24;
}

/* ---------- 小狗 ---------- */
.dog {
	position: absolute;
	left: 50%;
	bottom: 96px;
	width: 420px;
	margin-left: -210px;
	height: 380px;
	pointer-events: none;
}

.dog-jump {
	width: 100%;
	height: 100%;
	transform-origin: 50% 88%;
	animation: breathe 3.4s ease-in-out infinite;
}

.dog-face {
	position: absolute;
	inset: 0;
	display: flex;
	align-items: center;
	justify-content: center;
	transform: translate(
		calc(var(--look-x) * 10px),
		calc(var(--look-y) * 10px)
	);
	transition: transform 0.18s ease-out;
}

.dog-emoji {
	font-family: "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif;
	font-size: 250px;
	line-height: 1;
	filter: drop-shadow(0 16px 16px rgba(120, 70, 20, 0.26));
}

.shadow {
	position: absolute;
	left: 50%;
	bottom: 8px;
	width: 240px;
	height: 42px;
	margin-left: -120px;
	border-radius: 50%;
	background: rgba(40, 80, 30, 0.24);
	filter: blur(6px);
}

/* 反应状态：弹一下 + 停止呼吸动画 */
.dog[class*="is-"] .dog-jump {
	animation: none;
}
.dog[class*="is-"] .dog-emoji {
	animation: face-pop 0.34s ease-out;
}

.dog.is-jump .dog-jump {
	animation: jump 0.56s cubic-bezier(0.3, 0, 0.2, 1);
}
.dog.is-jump .shadow {
	animation: shrink 0.56s cubic-bezier(0.3, 0, 0.2, 1);
}
.dog.is-spin .dog-jump {
	animation: spin 0.72s ease-in-out;
}
.dog.is-wiggle .dog-jump {
	animation: wiggle 0.52s ease-in-out;
}
.dog.is-bow .dog-jump {
	animation: bow 0.64s ease-in-out;
}
.dog.is-tilt .dog-jump {
	animation: tilt 0.56s ease-in-out;
}

/* ---------- 气泡 / 特效 ---------- */
.bubble {
	position: absolute;
	left: 50%;
	top: -6px;
	transform: translateX(-50%);
	padding: 10px 22px;
	font-size: 28px;
	font-weight: 800;
	color: #3b2b16;
	background: #fff;
	border: 4px solid #ffd166;
	border-radius: 999px;
	box-shadow: 0 12px 24px rgba(40, 90, 130, 0.22);
	white-space: nowrap;
}
.bubble::after {
	content: "";
	position: absolute;
	left: 50%;
	bottom: -14px;
	width: 18px;
	height: 18px;
	margin-left: -9px;
	background: #fff;
	border-right: 4px solid #ffd166;
	border-bottom: 4px solid #ffd166;
	transform: rotate(45deg);
}

.pop-enter-active {
	animation: pop-in 0.22s cubic-bezier(0.2, 1.5, 0.4, 1);
}
.pop-leave-active {
	animation: pop-in 0.18s ease-in reverse;
}

.rings {
	position: absolute;
	left: 50%;
	top: 34%;
	width: 0;
	height: 0;
}

.ring {
	position: absolute;
	left: -70px;
	top: -70px;
	width: 140px;
	height: 140px;
	border: 6px solid rgba(255, 255, 255, 0.9);
	border-radius: 50%;
	animation: ripple 0.7s ease-out forwards;
}

.sprites {
	position: absolute;
	inset: 0;
}

.sprite {
	position: absolute;
	font-size: 26px;
	animation: float-up 1.4s ease-out forwards;
}

/* ---------- 关键帧 ---------- */
@keyframes breathe {
	0%,
	100% {
		transform: scale(1);
	}
	50% {
		transform: scale(1.015) translateY(-3px);
	}
}

@keyframes face-pop {
	0% {
		transform: scale(1);
	}
	35% {
		transform: scale(1.14);
	}
	70% {
		transform: scale(0.97);
	}
	100% {
		transform: scale(1);
	}
}

@keyframes jump {
	0% {
		transform: translateY(0) scale(1.06, 0.92);
	}
	18% {
		transform: translateY(-6px) scale(0.94, 1.08);
	}
	50% {
		transform: translateY(-96px) scale(1, 1);
	}
	82% {
		transform: translateY(0) scale(1.08, 0.9);
	}
	100% {
		transform: translateY(0) scale(1, 1);
	}
}

@keyframes shrink {
	0%,
	100% {
		transform: scale(1);
		opacity: 1;
	}
	50% {
		transform: scale(0.6);
		opacity: 0.4;
	}
}

@keyframes spin {
	0% {
		transform: rotate(0deg) translateY(0);
	}
	50% {
		transform: rotate(180deg) translateY(-54px);
	}
	100% {
		transform: rotate(360deg) translateY(0);
	}
}

@keyframes wiggle {
	0%,
	100% {
		transform: rotate(0deg);
	}
	25% {
		transform: rotate(-9deg) translateY(-16px);
	}
	75% {
		transform: rotate(9deg) translateY(-16px);
	}
}

@keyframes bow {
	0%,
	100% {
		transform: rotate(0deg);
	}
	45% {
		transform: rotate(13deg) translateY(8px);
	}
	70% {
		transform: rotate(-5deg) translateY(-10px);
	}
}

@keyframes tilt {
	0%,
	100% {
		transform: rotate(0deg);
	}
	30% {
		transform: rotate(-12deg) translateY(-14px);
	}
	65% {
		transform: rotate(7deg) translateY(-6px);
	}
}

@keyframes ripple {
	0% {
		transform: scale(0.35);
		opacity: 0.85;
	}
	100% {
		transform: scale(2.1);
		opacity: 0;
	}
}

@keyframes float-up {
	0% {
		transform: translateY(0) scale(0.6);
		opacity: 0;
	}
	25% {
		transform: translateY(-24px) scale(1.1);
		opacity: 1;
	}
	100% {
		transform: translateY(-130px) scale(0.8);
		opacity: 0;
	}
}

@keyframes pop-in {
	0% {
		transform: translateX(-50%) scale(0.4);
		opacity: 0;
	}
	100% {
		transform: translateX(-50%) scale(1);
		opacity: 1;
	}
}

@keyframes float {
	0%,
	100% {
		transform: translateY(0);
	}
	50% {
		transform: translateY(-12px);
	}
}

@keyframes twinkle {
	0%,
	100% {
		opacity: 0.15;
		transform: scale(0.7) rotate(-14deg);
	}
	50% {
		opacity: 1;
		transform: scale(1.15) rotate(14deg);
	}
}

@keyframes rise {
	0% {
		transform: translateY(0) scale(0.8);
		opacity: 1;
	}
	88% {
		opacity: 1;
	}
	100% {
		transform: translateY(calc(var(--rise) * -1)) scale(0.45);
		opacity: 0;
	}
}

@keyframes flash {
	0% {
		width: 0;
		height: 0;
		opacity: 0;
	}
	25% {
		width: 340px;
		height: 340px;
		opacity: 0.95;
	}
	100% {
		width: 520px;
		height: 520px;
		opacity: 0;
	}
}

@keyframes spark-fly {
	0% {
		transform: rotate(var(--angle)) translateX(0) scale(0.25);
		opacity: 0;
	}
	7% {
		opacity: 1;
	}
	100% {
		transform: rotate(var(--angle)) translateX(var(--dist)) scale(1);
		opacity: 0;
	}
}

@keyframes flicker {
	0% {
		filter: brightness(1);
	}
	100% {
		filter: brightness(1.5);
	}
}

@keyframes tail {
	0% {
		transform: scaleY(0.8);
		opacity: 0.7;
	}
	100% {
		transform: scaleY(1.25);
		opacity: 1;
	}
}

@keyframes drift {
	0% {
		transform: translateX(0);
	}
	50% {
		transform: translateX(60px);
	}
	100% {
		transform: translateX(0);
	}
}
</style>
