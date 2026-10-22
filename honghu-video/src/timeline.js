// 分场时间线（§6）+ 旁白/字幕对齐（§7）。旁白起点取计划帧，若前一句未结束则顺延；
// 字幕直接取自每条音频的真实时长（tts_build.py 写出的 manifest），持续到音频结束 + 6 帧。
import fs from 'node:fs';
import { asset, ROOT } from './canvas.js';
import path from 'node:path';

export const SCENES = [
  { id: 'S0', a: 0, b: 450 },
  { id: 'S1', a: 450, b: 1350 },
  { id: 'S2', a: 1350, b: 2100 },
  { id: 'S3', a: 2100, b: 2850 },
  { id: 'S4', a: 2850, b: 3600 },
  { id: 'S5', a: 3600, b: 4200 },
  { id: 'S6', a: 4200, b: 5100 },
  { id: 'S7', a: 5100, b: 5400 },
];
// 小鸿鹄翻页转场：落在交界处前 10 帧 + 后 10 帧
export const WIPES = [450, 1350, 2100, 2850, 3600, 4200];

const script = JSON.parse(fs.readFileSync(path.join(ROOT, 'script', 'narration.json'), 'utf8'));
const manPath = asset('audio', 'voice', 'manifest.json');
const manifest = fs.existsSync(manPath) ? JSON.parse(fs.readFileSync(manPath, 'utf8')) : {};
const fr = (s) => Math.round(s * 30);

export const NARRATION = [];
let prevEnd = 0;
for (const n of script.narration) {
  const m = manifest[n.id];
  const start = Math.max(n.start, prevEnd + 12);
  const dur = m ? fr(m.duration) : Math.round(n.chunks.reduce((a, c) => a + c.text.length, 0) * 30 / 4.2);
  const chunks = m ? m.chunks.map((c) => ({ text: c.text, a: start + fr(c.start), b: start + fr(c.end) }))
    : [{ text: n.chunks.map((c) => c.text).join(''), a: start, b: start + dur }];
  NARRATION.push({ id: n.id, scene: n.scene, start, end: start + dur, chunks, file: m ? `voice/${n.id}.wav` : null });
  prevEnd = start + dur;
}
export const narr = (id) => NARRATION.find((n) => n.id === id);

// 口述卡片：不与旁白重叠；卡片出现后 8 帧开始播放同学录音
const CARD_PLAN = { v1: [2600, 2820, 'n10'], v2: [3350, 3570, 'n12'], v3: [3950, 4170, 'n13'] };
export const CARDS = {};
for (const v of script.voices) {
  const [a0, b0, after] = CARD_PLAN[v.id];
  const m = manifest[v.id];
  const a = Math.max(a0, narr(after).end + 10);
  const vdur = m ? fr(m.duration) : 120;
  CARDS[v.id] = { text: v.text, a, b: Math.max(b0, a + 8 + vdur + 30), voiceAt: a + 8, voiceEnd: a + 8 + vdur, file: m ? `voice/${v.id}.wav` : null };
}

// 字幕：S7 前两句与画面大字重复，不再出底部字幕
export const SUBTITLES = [];
for (const n of NARRATION) {
  n.chunks.forEach((c, i) => {
    if (n.id === 'n16' && i < 2) return;
    SUBTITLES.push({ text: c.text, a: c.a, b: c.b + 6, id: `${n.id}.${i}` });
  });
}
for (let i = 0; i < SUBTITLES.length - 1; i++) SUBTITLES[i].b = Math.min(SUBTITLES[i].b, SUBTITLES[i + 1].a);

export const sceneAt = (f) => SCENES.find((s) => f >= s.a && f < s.b) || SCENES[SCENES.length - 1];

// history filter strength (S1、S2 偏旧；S3 开始 2 秒内过渡回正常)
export function historyAmount(f) {
  if (f < 440) return 0;
  if (f < 470) return (f - 440) / 30;
  if (f < 2040) return 1;
  if (f < 2160) return 1 - (f - 2040) / 120;
  return 0;
}
