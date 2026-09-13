/**
 * 用 Web Audio 合成狗叫声，无需任何音频文件。
 * 「汪」= 极短的爆发：爆破起音（噪声）+ 快速下坠的基频 + 元音共振峰 + 声带抖动。
 * 关键是把时长压到 110ms 左右并拉高起音，拖长、低频缓降会变成「呜」。
 */

/** 调音台：想改叫声先动这里 */
const BARK_MS = 0.11; // 单声时长，再长就会拖成「呜」
const F0 = 540; // 起音基频（小狗偏高）
const F0_DROP = 0.62; // 收尾时基频掉到起音的多少倍，越小越像叹气
const F1 = 850; // 第一共振峰：元音落在「啊」
const F2 = 1550; // 第二共振峰：加一点「嗷」的开口感
const ROUGH_HZ = 46; // 声带抖动频率，负责那股粗糙的犬吠感
const ROUGH_DEPTH = 0.18; // 抖动深度
const NOISE_MS = 0.016; // 起音那一下气流的长度
const NOISE_LEVEL = 0.5; // 气流占比，太低会变成电子音

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let noiseBuffer: AudioBuffer | null = null;

/** lazily 建好音频上下文，返回上下文和主输出节点 */
function audio(): { c: AudioContext; out: GainNode } {
	if (!ctx || !master) {
		ctx = new AudioContext();
		master = ctx.createGain();
		master.gain.value = 0.9;
		master.connect(ctx.destination);
	}
	if (ctx.state === "suspended") void ctx.resume();
	return { c: ctx, out: master };
}

function noise(c: AudioContext): AudioBuffer {
	if (noiseBuffer) return noiseBuffer;
	const length = Math.floor(c.sampleRate * 0.5);
	noiseBuffer = c.createBuffer(1, length, c.sampleRate);
	const data = noiseBuffer.getChannelData(0);
	for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
	return noiseBuffer;
}

/** 随机系数，让每声都不完全一样 */
function jitter(amount: number): number {
	return 1 + (Math.random() * 2 - 1) * amount;
}

function scheduleBark(
	c: AudioContext,
	out: GainNode,
	at: number,
	level: number,
): void {
	const end = at + BARK_MS;
	const f0 = F0 * jitter(0.08);

	// 声源：锯齿波给谐波，低八度的三角波垫出胸腔的厚度
	const osc = c.createOscillator();
	osc.type = "sawtooth";
	osc.frequency.setValueAtTime(f0, at);
	osc.frequency.exponentialRampToValueAtTime(f0 * F0_DROP, end);

	const sub = c.createOscillator();
	sub.type = "triangle";
	sub.frequency.setValueAtTime(f0 / 2, at);
	sub.frequency.exponentialRampToValueAtTime((f0 * F0_DROP) / 2, end);
	const subGain = c.createGain();
	subGain.gain.value = 0.55;
	sub.connect(subGain);

	const source = c.createGain();
	osc.connect(source);
	subGain.connect(source);

	// 声带抖动：给发声段叠一层 ~46Hz 的振幅调制，去掉就变成纯电子音
	const am = c.createGain();
	am.gain.value = 1;
	const rough = c.createOscillator();
	rough.type = "sine";
	rough.frequency.value = ROUGH_HZ * jitter(0.15);
	const roughDepth = c.createGain();
	roughDepth.gain.value = ROUGH_DEPTH;
	rough.connect(roughDepth).connect(am.gain);
	source.connect(am);

	// 共振峰：两个 peaking 串起来，把音色钉在「啊/嗷」上；再切掉低频避免糊
	const f1 = c.createBiquadFilter();
	f1.type = "peaking";
	f1.frequency.value = F1 * jitter(0.06);
	f1.Q.value = 5;
	f1.gain.value = 14;
	const f2 = c.createBiquadFilter();
	f2.type = "peaking";
	f2.frequency.value = F2 * jitter(0.06);
	f2.Q.value = 4;
	f2.gain.value = 9;
	const hp = c.createBiquadFilter();
	hp.type = "highpass";
	hp.frequency.value = 220;

	// 3ms 起音 + 极短的饱满段 + 快速收尾，听感才是「汪」
	const env = c.createGain();
	env.gain.setValueAtTime(0.0001, at);
	env.gain.linearRampToValueAtTime(0.6 * level, at + 0.003);
	env.gain.setValueAtTime(0.6 * level, at + 0.025);
	env.gain.exponentialRampToValueAtTime(0.0001, end);

	am.connect(f1).connect(f2).connect(hp).connect(env).connect(out);
	osc.start(at);
	sub.start(at);
	rough.start(at);
	osc.stop(end + 0.02);
	sub.stop(end + 0.02);
	rough.stop(end + 0.02);

	// 爆破感来自起音这一下气流：宽频噪声，比发声段收得更快
	const src = c.createBufferSource();
	src.buffer = noise(c);
	src.playbackRate.value = jitter(0.2);
	const bp = c.createBiquadFilter();
	bp.type = "bandpass";
	bp.Q.value = 0.8;
	bp.frequency.setValueAtTime(2400, at);
	bp.frequency.exponentialRampToValueAtTime(900, at + NOISE_MS * 6);
	const noiseGain = c.createGain();
	noiseGain.gain.setValueAtTime(0.0001, at);
	noiseGain.gain.linearRampToValueAtTime(NOISE_LEVEL * level, at + 0.002);
	noiseGain.gain.exponentialRampToValueAtTime(0.0001, at + NOISE_MS * 7);
	src.connect(bp).connect(noiseGain).connect(out);
	src.start(at);
	src.stop(at + NOISE_MS * 7 + 0.02);
}

/** 播放一次狗叫，随机决定单声或双声。level 越大叫得越响。 */
export function playBark(level = 1): void {
	try {
		const { c, out } = audio();
		const now = c.currentTime + 0.01;
		const times = Math.random() < 0.45 ? 2 : 1;
		for (let i = 0; i < times; i++) {
			scheduleBark(
				c,
				out,
				now + i * (0.14 + Math.random() * 0.06),
				level * (i === 0 ? 1 : 0.8),
			);
		}
	} catch {
		// 音频不可用时静默降级，不影响交互
	}
}
