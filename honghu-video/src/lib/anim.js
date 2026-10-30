import { rand, hash } from './rng.js';

export const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const two = (f) => Math.floor(f / 2) * 2;              // OnTwos：动画按两帧取整
export const prog = (f, a, b) => clamp((two(f) - a) / (b - a));
export const easeOut = (t) => 1 - Math.pow(1 - t, 3);
export const easeIn = (t) => t * t * t;
export const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export const easeOutBack = (t, s = 1.4) => 1 + (s + 1) * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2);

// damped spring 0→1 (frames since start)
export function spring(t, zeta = 0.6, w = 0.5) {
  if (t <= 0) return 0;
  const wd = w * Math.sqrt(1 - zeta * zeta);
  return 1 - Math.exp(-zeta * w * t) * (Math.cos(wd * t) + (zeta * w / wd) * Math.sin(wd * t));
}

// DropIn: 自上方 60px、−8° 落下，12 帧到位，末尾轻微回弹
export function dropIn(f, start, { dist = 60, rot = -8, dur = 12 } = {}) {
  const t = two(f) - start;
  if (t < 0) return null;
  const k = 12 / dur;
  const s = spring(t * k);
  return { dy: -dist * (1 - s), rot: rot * (1 - s), lift: 1 + 2.2 * Math.max(0, 1 - s), s: 1 + 0.06 * Math.max(0, 1 - s), alpha: clamp(t / 3 + 0.35) };
}

// PeelOut: 向右上翻起并移出，10 帧
export function peelOut(f, start, dur = 10) {
  const t = clamp((two(f) - start) / dur);
  if (t <= 0) return { dx: 0, dy: 0, rot: 0, alpha: 1, lift: 1, gone: false };
  const e = t * t;
  return { dx: 420 * e, dy: -520 * e, rot: 28 * e, alpha: 1 - clamp((t - 0.6) / 0.4), lift: 1 + 3 * t, gone: t >= 1 };
}

// Jitter: 每 2 帧随机一次 rotate ±1.5°、translate ±1.5px
// 稳定版：每 16 帧取一个新的随机姿态，期间平滑过渡（仍按两帧取整），幅度为原来的 40%
const JIT_PERIOD = 16, JIT_SCALE = 0.4;
function jitKey(id, k) {
  const r = rand(hash(id) + k * 7919);
  return [r() * 2 - 1, r() * 2 - 1, r() * 2 - 1];
}
export function jitter(id, f, amp = 1) {
  const t = two(f) / JIT_PERIOD, k = Math.floor(t), u = t - k, s = u * u * (3 - 2 * u);
  const a = jitKey(id, k), b = jitKey(id, k + 1);
  const m = 1.5 * amp * JIT_SCALE;
  const v = a.map((p, i) => p + (b[i] - p) * s);
  return { dx: v[0] * m, dy: v[1] * m, rot: (v[2] * m * Math.PI) / 180 };
}

// stamp: scale 1.4→1 in 6 frames
export function stampIn(f, start) {
  const t = f - start;
  if (t < 0) return null;
  const p = clamp(t / 6);
  return { s: 1.4 - 0.4 * easeIn(p), alpha: clamp(t / 2 + 0.2), lift: 1 + 2 * (1 - p) };
}
