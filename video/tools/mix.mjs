// 混音台：用纯 JavaScript 把背景音乐"弹"出来，加上音效，再和配音混在一起。
//   node tools/mix.mjs   →   audio/soundtrack.wav + audio/soundtrack.mp3 + js/stats.js
// 乐器全是数学：拨弦 = Karplus-Strong 算法，铃声 = 几个正弦波相加，混响 = 一组反馈延迟。
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const SR = 44100;
const env = { console };
env.window = env;
vm.createContext(env);
for (const f of ['script.js', 'timing.js', 'cue.js', 'music.js']) vm.runInContext(fs.readFileSync(path.join(ROOT, 'js', f), 'utf8'), env);
const { SCRIPT, TIMING, MUSIC, cueTime } = env;
const score = MUSIC.buildScore(TIMING);
const LEN = Math.ceil(Math.max(score.end, TIMING.total + 1) * SR);

const voice = new Float32Array(LEN);
const musL = new Float32Array(LEN), musR = new Float32Array(LEN), send = new Float32Array(LEN);
const fxL = new Float32Array(LEN), fxR = new Float32Array(LEN);

// ---------- 小工具 ----------
let seed = 12345;
const rand = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296) * 2 - 1;
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
function add(L, R, buf, t, gain, pan = 0, rev = 0) {
  const s0 = Math.round(t * SR), gl = gain * Math.cos((pan + 1) * Math.PI / 4) * 1.414, gr = gain * Math.sin((pan + 1) * Math.PI / 4) * 1.414;
  for (let i = 0; i < buf.length; i++) {
    const k = s0 + i;
    if (k < 0 || k >= LEN) continue;
    L[k] += buf[i] * gl; R[k] += buf[i] * gr;
    if (rev) send[k] += buf[i] * gain * rev;
  }
}
function biquad(type, f, q) {
  const w = 2 * Math.PI * f / SR, a = Math.sin(w) / (2 * q), c = Math.cos(w);
  let b0, b1, b2, a0 = 1 + a, a1 = -2 * c, a2 = 1 - a;
  if (type === 'bp') { b0 = a; b1 = 0; b2 = -a; }
  else if (type === 'hp') { b0 = (1 + c) / 2; b1 = -(1 + c); b2 = (1 + c) / 2; }
  else { b0 = (1 - c) / 2; b1 = 1 - c; b2 = (1 - c) / 2; }
  return [b0 / a0, b1 / a0, b2 / a0, a1 / a0, a2 / a0];
}
function filt(buf, coefFn, every = 64) {
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0, co = coefFn(0);
  for (let i = 0; i < buf.length; i++) {
    if (i % every === 0) co = coefFn(i / SR);
    const x = buf[i], y = co[0] * x + co[1] * x1 + co[2] * x2 - co[3] * y1 - co[4] * y2;
    x2 = x1; x1 = x; y2 = y1; y1 = y; buf[i] = y;
  }
  return buf;
}
const noise = (sec) => Float32Array.from({ length: Math.ceil(sec * SR) }, () => rand());
function envelope(buf, a, d) { // 线性起音 a 秒，指数衰减时间常数 d 秒
  for (let i = 0; i < buf.length; i++) { const t = i / SR; buf[i] *= Math.min(1, t / a) * Math.exp(-t / d); }
  return buf;
}

// ---------- 乐器 ----------
function pluck(f, dur, v) { // Karplus-Strong：一段噪声在环形缓冲里来回平均，就成了琴弦声
  const N = Math.max(2, Math.round(SR / f)), len = Math.ceil((dur + 0.6) * SR);
  const ring = new Float32Array(N), out = new Float32Array(len);
  let lp = 0;
  for (let i = 0; i < N; i++) { lp += (rand() - lp) * (0.35 + v * 0.4); ring[i] = lp; }
  let idx = 0;
  const decay = 0.9965 - (f > 500 ? 0.0015 : 0);
  for (let i = 0; i < len; i++) {
    const nx = (idx + 1) % N;
    const y = ring[idx];
    ring[idx] = (ring[idx] + ring[nx]) * 0.5 * decay;
    out[i] = y;
    idx = nx;
    if (i > dur * SR) out[i] *= Math.max(0, 1 - (i - dur * SR) / (0.6 * SR));
  }
  return out;
}
function partials(f, dur, list, attack = 0.002) {
  const len = Math.ceil(dur * SR), out = new Float32Array(len);
  for (const [ratio, amp, dec] of list) {
    const w = 2 * Math.PI * f * ratio / SR;
    if (f * ratio > SR / 2.2) continue;
    for (let i = 0; i < len; i++) out[i] += amp * Math.sin(w * i) * Math.exp(-i / SR / dec);
  }
  for (let i = 0; i < Math.min(len, attack * SR); i++) out[i] *= i / (attack * SR);
  for (let i = Math.max(0, len - 0.05 * SR); i < len; i++) out[i] *= (len - i) / (0.05 * SR);
  return out;
}
const bell = (f, d) => partials(f, d + 1.2, [[1, 1, 1.1], [2.76, 0.32, 0.4], [5.4, 0.12, 0.18], [8.93, 0.05, 0.1]]);
function marimba(f, d) {
  const b = partials(f, d + 0.9, [[1, 1, 0.55], [3.9, 0.22, 0.15], [9.2, 0.06, 0.05]]);
  const w = 2 * Math.PI * f / SR;
  for (let i = 0; i < b.length; i++) { const t = i / SR; b[i] += 0.28 * Math.sin(w * i) * Math.min(1, t / 0.04) * (t < d ? 1 : Math.exp(-(t - d) / 0.15)); }
  return b;
}
function bass(f, d) {
  const len = Math.ceil((d + 0.3) * SR), out = new Float32Array(len), w = 2 * Math.PI * f / SR;
  for (let i = 0; i < len; i++) {
    const t = i / SR, e = Math.min(1, t / 0.006) * Math.exp(-t / (d * 0.9)) * (t < d ? 1 : Math.exp(-(t - d) / 0.06));
    out[i] = e * (Math.sin(w * i) + 0.25 * Math.sin(2 * w * i) + 0.08 * Math.sin(3 * w * i));
  }
  return out;
}
function pad(f, d) {
  const len = Math.ceil((d + 0.8) * SR), out = new Float32Array(len);
  for (const det of [-0.004, 0, 0.005]) {
    const w = 2 * Math.PI * f * (1 + det) / SR;
    for (let i = 0; i < len; i++) out[i] += Math.sin(w * i) + Math.sin(3 * w * i) / 9;
  }
  for (let i = 0; i < len; i++) { const t = i / SR; out[i] *= Math.min(1, t / 0.9) * (t < d ? 1 : Math.max(0, 1 - (t - d) / 0.8)) / 3; }
  return out;
}
function shaker() {
  const b = filt(noise(0.08), () => biquad('hp', 6000, 0.7));
  return envelope(b, 0.004, 0.025);
}

// ---------- 音效 ----------
function sine(fFn, dur, ampFn) {
  const len = Math.ceil(dur * SR), out = new Float32Array(len);
  let ph = 0;
  for (let i = 0; i < len; i++) { const t = i / SR; ph += 2 * Math.PI * fFn(t) / SR; out[i] = Math.sin(ph) * ampFn(t); }
  return out;
}
const SFX = {
  pop: () => [[sine((t) => 380 + 900 * Math.min(1, t / 0.05), 0.16, (t) => Math.min(1, t / 0.003) * Math.exp(-t / 0.045)), 0, 0.9]],
  boing: () => [[sine((t) => 170 + 260 * (1 - Math.exp(-t * 9)) + 35 * Math.sin(t * 2 * Math.PI * 22), 0.55, (t) => Math.min(1, t / 0.005) * Math.exp(-t / 0.18)), 0, 0.8]],
  sparkle: () => [2093, 2637, 3136, 3951, 4186, 3136].map((f, k) => [partials(f, 0.5, [[1, 1, 0.12], [2.76, 0.2, 0.05]]), k * 0.055, 0.32, k % 2 ? 0.5 : -0.5]),
  whoosh: () => {
    const b = filt(noise(0.7), (t) => biquad('bp', 300 + 2600 * Math.sin(Math.PI * Math.min(1, t / 0.7)), 1.2));
    for (let i = 0; i < b.length; i++) b[i] *= Math.sin(Math.PI * i / b.length) ** 2;
    return [[b, 0, 1.5]];
  },
  flip: () => Array.from({ length: 14 }, (_, k) => [envelope(filt(noise(0.05), () => biquad('bp', 1800 + k * 40, 1.5)), 0.002, 0.012), k * 0.075, 0.9, (k % 2 ? 0.3 : -0.3)]),
  tick: () => Array.from({ length: 16 }, (_, k) => [partials(2400, 0.05, [[1, 1, 0.01]]), 1.5 * (1 - Math.pow(1 - k / 16, 1.6)), 0.4]),
  typing: () => {
    const out = []; let t = 0;
    for (let k = 0; k < 13; k++) {
      const c = envelope(filt(noise(0.04), () => biquad('bp', 2500 + rand() * 900, 2)), 0.001, 0.008);
      const th = sine(() => 140, 0.04, (u) => Math.exp(-u / 0.01));
      out.push([c, t, 0.9, rand() * 0.4], [th, t, 0.5]);
      t += 0.08 + Math.abs(rand()) * 0.07;
    }
    return out;
  },
  ding: () => [[partials(1568, 1.6, [[1, 1, 0.6], [2.0, 0.25, 0.3], [3.0, 0.1, 0.15], [4.2, 0.05, 0.1]]), 0, 0.45]],
  tone440: () => [[sine(() => 440, 2.6, (t) => Math.min(1, t / 0.15) * Math.min(1, (2.6 - t) / 0.4)), 0, 0.33]],
  shutter: () => [
    [envelope(filt(noise(0.05), () => biquad('bp', 3200, 1)), 0.001, 0.01), 0, 1.0],
    [envelope(filt(noise(0.07), () => biquad('bp', 1800, 1)), 0.001, 0.02), 0.07, 0.9],
    [sine(() => 90, 0.08, (t) => Math.exp(-t / 0.02)), 0.07, 0.4]
  ],
  fanfare: () => [523.25, 659.25, 783.99, 1046.5, 1318.5].map((f, k) => [bell(f, 0.6 + k * 0.2), k * 0.11, 0.3, (k - 2) * 0.2]).concat(SFX.sparkle().map(([b, t, g, p]) => [b, t + 0.6, g, p]))
};

// ---------- 1. 配音 ----------
function readWav(file) {
  const b = fs.readFileSync(file);
  let p = 12, fmt = null;
  while (p < b.length) {
    const id = b.toString('ascii', p, p + 4), size = b.readUInt32LE(p + 4);
    if (id === 'fmt ') fmt = { ch: b.readUInt16LE(p + 10), sr: b.readUInt32LE(p + 12), bits: b.readUInt16LE(p + 22) };
    if (id === 'data') {
      if (fmt.bits !== 16 || fmt.sr !== SR) throw new Error('需要 16 位 44.1kHz 的 wav：' + file);
      const n = size / 2 / fmt.ch, out = new Float32Array(n);
      for (let i = 0; i < n; i++) out[i] = b.readInt16LE(p + 8 + i * 2 * fmt.ch) / 32768;
      return out;
    }
    p += 8 + size + (size % 2);
  }
  throw new Error('wav 里没有数据：' + file);
}
for (const sc of TIMING.scenes) for (const ln of sc.lines) {
  const w = readWav(path.join(ROOT, 'audio', 'lines', ln.file)), s0 = Math.round((sc.start + ln.t) * SR);
  for (let i = 0; i < w.length && s0 + i < LEN; i++) voice[s0 + i] += w[i];
}
let vpk = 0; for (const x of voice) vpk = Math.max(vpk, Math.abs(x));
for (let i = 0; i < LEN; i++) voice[i] *= 0.8 / vpk;

// ---------- 2. 背景音乐 ----------
const cache = new Map();
const memo = (key, fn) => { if (!cache.has(key)) cache.set(key, fn()); return cache.get(key); };
for (const e of score.events) {
  const f = mtof(e.m);
  if (e.i === 'pluck') add(musL, musR, pluck(f, e.d, e.v), e.t, 0.32 * e.v, -0.35, 0.25);
  else if (e.i === 'bass') add(musL, musR, memo('b' + e.m + e.d, () => bass(f, e.d)), e.t, 0.42 * e.v, 0, 0.05);
  else if (e.i === 'mel') add(musL, musR, memo('m' + e.m + e.d, () => marimba(f, e.d)), e.t, 0.36 * e.v, 0.3, 0.35);
  else if (e.i === 'bell') add(musL, musR, memo('l' + e.m + e.d, () => bell(f, e.d)), e.t, 0.2 * e.v, 0.4, 0.6);
  else if (e.i === 'pad') add(musL, musR, memo('p' + e.m + e.d, () => pad(f, e.d)), e.t, 0.14 * e.v, 0, 0.5);
  else if (e.i === 'shaker') add(musL, musR, shaker(), e.t, 0.1 * e.v, 0.5, 0);
}
// 混响：4 个梳状滤波 + 2 个全通滤波（简化版 Freeverb）
(function reverb() {
  const combs = [1557, 1617, 1491, 1422].map((n) => ({ buf: new Float32Array(n), i: 0, lp: 0 }));
  const aps = [556, 441].map((n) => ({ buf: new Float32Array(n), i: 0 }));
  for (let k = 0; k < LEN; k++) {
    const x = send[k] * 0.3;
    let y = 0;
    for (const c of combs) { const o = c.buf[c.i]; c.lp = o * 0.7 + c.lp * 0.3; c.buf[c.i] = x + c.lp * 0.82; c.i = (c.i + 1) % c.buf.length; y += o; }
    for (const a of aps) { const o = a.buf[a.i]; const v = y + o * 0.5; a.buf[a.i] = v; a.i = (a.i + 1) % a.buf.length; y = o - v * 0.5; }
    musL[k] += y * 0.9; musR[k] += y * 0.85;
  }
})();

// ---------- 3. 音效 ----------
const cues = [];
SCRIPT.scenes.forEach((sc, si) => {
  const tm = TIMING.scenes[si];
  for (const [li, when, name, extra] of sc.sfx || []) {
    const ln = tm.lines[li];
    const t = tm.start + ln.t + cueTime(sc.lines[li].text, ln.d, when) + (extra || 0);
    cues.push({ t: +t.toFixed(3), name, scene: sc.id });
    for (const [buf, off, g, pan] of SFX[name]()) add(fxL, fxR, buf, t + off, g, pan || 0, 0);
  }
});

// ---------- 4. 混音：说话时音乐自动让路（ducking） ----------
const out = Buffer.alloc(LEN * 4);
const tone = cues.find((c) => c.name === 'tone440');
let duck = 0, lvl = 0, peak = 0;
const lv = [0, 0], lm = [0, 0], ln = [0, 0];
const mix = new Float32Array(LEN * 2);
for (let k = 0; k < LEN; k++) {
  const t = k / SR;
  lvl = Math.max(Math.abs(voice[k]), lvl * 0.9995);
  const target = lvl > 0.02 ? 1 : 0;
  duck += (target - duck) * (target > duck ? 0.0006 : 0.00006);
  const showOff = t >= score.showOff[0] && t < score.showOff[1];
  let g = (showOff ? 1.1 : 0.55) * (1 - (showOff ? 0.4 : 0.7) * duck);
  if (tone && t > tone.t - 0.3 && t < tone.t + 2.8) g *= 0.35;
  if (t > score.end - 2.5) g *= Math.max(0, (score.end - t) / 2.5);
  if (t < 0.5) g *= t / 0.5;
  const L = voice[k] + musL[k] * g + fxL[k] * 0.55, R = voice[k] + musR[k] * g + fxR[k] * 0.55;
  mix[2 * k] = L; mix[2 * k + 1] = R;
  const mu = musL[k] * g, bin = target ? 0 : 1;
  lv[bin] += voice[k] * voice[k]; lm[bin] += mu * mu; ln[bin]++;
  peak = Math.max(peak, Math.abs(L), Math.abs(R));
}
const norm = Math.min(1, 0.95 / peak);
const db = (x, n) => (10 * Math.log10(x / n)).toFixed(1);
console.log(`电平：说话时 人声 ${db(lv[0], ln[0])} dB / 音乐 ${db(lm[0], ln[0])} dB；不说话时 音乐 ${db(lm[1], ln[1])} dB`);
for (let i = 0; i < mix.length; i++) out.writeInt16LE(Math.round(Math.tanh(mix[i] * norm * 1.05) * 32000), i * 2);

const hdr = Buffer.alloc(44);
hdr.write('RIFF', 0); hdr.writeUInt32LE(36 + out.length, 4); hdr.write('WAVE', 8);
hdr.write('fmt ', 12); hdr.writeUInt32LE(16, 16); hdr.writeUInt16LE(1, 20); hdr.writeUInt16LE(2, 22);
hdr.writeUInt32LE(SR, 24); hdr.writeUInt32LE(SR * 4, 28); hdr.writeUInt16LE(4, 32); hdr.writeUInt16LE(16, 34);
hdr.write('data', 36); hdr.writeUInt32LE(out.length, 40);
const wav = path.join(ROOT, 'audio', 'soundtrack.wav');
fs.writeFileSync(wav, Buffer.concat([hdr, out]));
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', wav, '-codec:a', 'libmp3lame', '-b:a', '160k', path.join(ROOT, 'audio', 'soundtrack.mp3')]);

// ---------- 5. 统计"整个视频的代码有多大"（彩蛋里要用） ----------
const codeFiles = ['index.html', 'js/engine.js', 'js/characters.js', 'js/scenes.js', 'js/player.js', 'js/music.js', 'js/cue.js', 'js/script.js', 'js/timing.js'];
const bytes = codeFiles.reduce((n, f) => n + fs.statSync(path.join(ROOT, f)).size, 0);
fs.writeFileSync(path.join(ROOT, 'js', 'stats.js'), `// 自动生成：tools/mix.mjs\nwindow.STATS = ${JSON.stringify({ codeBytes: bytes, notes: score.events.filter((e) => e.i !== 'shaker').length, sfx: cues.length })};\n`);
console.log(`音轨 ${(LEN / SR).toFixed(1)} 秒，${score.events.length} 个音符，${cues.length} 个音效；代码共 ${(bytes / 1024).toFixed(1)} KB`);
