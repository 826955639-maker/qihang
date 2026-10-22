// S3 实验室与车间（2100–2850）：靛蓝方格图纸，凌晨两点的窗、台灯、电路板、草稿、齿轮、方程式赛车，扳手拧齿轮
import { C, F, W, H } from '../theme.js';
import { piece, place, cutout, cached, tape, STATE } from '../lib/paper.js';
import { drop, paperCue } from '../lib/kit.js';
import { two, clamp, lerp, easeInOut, easeOut } from '../lib/anim.js';
import { gearPath, roundRect, silhouetteSprite } from '../lib/draw.js';
import { rand } from '../lib/rng.js';
import { hero } from '../lib/hero.js';
import { CARDS } from '../timeline.js';
import { drawCard } from './common.js';

const blueprint = () => piece({
  key: 's3bp', w: W + 80, h: H + 80, color: C.indigo, seed: 's3bp', tex: 0.28, rim: false,
  draw: (x, w, h) => {
    x.strokeStyle = 'rgba(246,242,234,0.10)'; x.lineWidth = 1;
    for (let gx = 0; gx < w; gx += 20) { x.beginPath(); x.moveTo(gx + 0.5, 0); x.lineTo(gx + 0.5, h); x.stroke(); }
    for (let gy = 0; gy < h; gy += 20) { x.beginPath(); x.moveTo(0, gy + 0.5); x.lineTo(w, gy + 0.5); x.stroke(); }
    x.strokeStyle = 'rgba(246,242,234,0.17)'; x.lineWidth = 1.5;
    for (let gx = 0; gx < w; gx += 100) { x.beginPath(); x.moveTo(gx + 0.5, 0); x.lineTo(gx + 0.5, h); x.stroke(); }
    for (let gy = 0; gy < h; gy += 100) { x.beginPath(); x.moveTo(0, gy + 0.5); x.lineTo(w, gy + 0.5); x.stroke(); }
    // faint drafting marks
    x.strokeStyle = 'rgba(246,242,234,0.16)'; x.lineWidth = 1.2;
    x.beginPath(); x.arc(1700, 760, 120, 0, 7); x.stroke();
    x.beginPath(); x.moveTo(1540, 760); x.lineTo(1860, 760); x.moveTo(1700, 600); x.lineTo(1700, 920); x.stroke();
    x.font = '22px SerifR'; x.fillStyle = 'rgba(246,242,234,0.22)'; x.fillText('Ø240', 1712, 630); x.fillText('A—A', 120, 90);
  },
});

const windowSpr = () => piece({
  key: 's3win', w: 500, h: 380, color: C.paper, seed: 's3win', edge: 'cut',
  draw: (x, w, h) => {
    x.fillStyle = C.night; x.fillRect(22, 22, w - 44, h - 44);
    const r = rand('s3stars'); x.fillStyle = 'rgba(246,242,234,0.9)';
    for (let i = 0; i < 30; i++) { x.beginPath(); x.arc(30 + r() * (w - 60), 30 + r() * (h - 60), 0.8 + r() * 1.6, 0, 7); x.fill(); }
    x.fillStyle = '#EFE6CF'; x.beginPath(); x.arc(w - 110, 90, 34, 0, 7); x.fill();
    x.fillStyle = C.night; x.beginPath(); x.arc(w - 96, 80, 31, 0, 7); x.fill();
    // far city: a few lit windows
    x.fillStyle = '#16202F'; x.fillRect(22, h - 120, w - 44, 98);
    for (let i = 0; i < 9; i++) { const bx = 30 + i * 50, bh = 40 + r() * 70; x.fillStyle = '#121A27'; x.fillRect(bx, h - 22 - bh, 42, bh); if (r() < 0.6) { x.fillStyle = C.gold; x.fillRect(bx + 14, h - 10 - bh, 8, 10); } }
    x.fillStyle = C.paper; x.fillRect(w / 2 - 7, 22, 14, h - 44); x.fillRect(22, h / 2 - 7, w - 44, 14);
  },
});

const desk = () => piece({
  key: 's3desk', w: W + 120, h: 330, color: '#8A6A47', seed: 's3desk', rimColor: '#C9AE86',
  draw: (x, w, h) => {
    const r = rand('wood'); x.strokeStyle = 'rgba(40,25,10,0.18)'; x.lineWidth = 1.4;
    for (let i = 0; i < 26; i++) { const y = r() * h; x.beginPath(); x.moveTo(0, y); for (let px = 0; px < w; px += 60) x.lineTo(px, y + Math.sin(px / 140 + i) * 4); x.stroke(); }
    x.fillStyle = 'rgba(255,240,210,0.12)'; x.fillRect(0, 0, w, 10);
  },
});

// 扇形灯光纸片：apex at the lamp shade, spreading onto the desk
const lampLight = () => cutout({
  key: 's3light', w: 420, h: 300, color: C.gold, tex: 0.25,
  path: (x, w) => { x.beginPath(); x.moveTo(w / 2, 0); x.arc(w / 2, 0, 330, Math.PI / 2 - 0.58, Math.PI / 2 + 0.58); x.closePath(); },
});
const lamp = () => silhouetteSprite('s3lamp', 220, 330, (x) => {
  x.fillStyle = '#2A2724'; x.strokeStyle = '#2A2724'; x.lineCap = 'round';
  x.beginPath(); x.ellipse(170, 322, 52, 10, 0, 0, 7); x.fill();
  x.lineWidth = 12; x.beginPath(); x.moveTo(170, 318); x.lineTo(120, 170); x.lineTo(170, 60); x.stroke();
  x.beginPath(); x.moveTo(110, 20); x.lineTo(196, 50); x.lineTo(170, 118); x.lineTo(40, 110); x.closePath(); x.fill();
  x.fillStyle = '#F6D58A'; x.beginPath(); x.ellipse(105, 114, 64, 10, 0.06, 0, 7); x.fill();
});

const circuit = () => piece({
  key: 's3pcb', w: 300, h: 200, color: '#2F5D46', seed: 's3pcb', edge: 'cut',
  draw: (x, w, h) => {
    const r = rand('pcb'); x.strokeStyle = '#D9B45A'; x.lineWidth = 3; x.lineCap = 'round';
    for (let i = 0; i < 14; i++) {
      let px = 10 + r() * (w - 20), py = 10 + r() * (h - 20); x.beginPath(); x.moveTo(px, py);
      for (let k = 0; k < 3; k++) { if (r() < 0.5) px += (r() - 0.5) * 140; else py += (r() - 0.5) * 100; x.lineTo(px, py); }
      x.stroke(); x.fillStyle = '#D9B45A'; x.beginPath(); x.arc(px, py, 5, 0, 7); x.fill();
    }
    x.fillStyle = C.ink; roundRect(x, 110, 60, 80, 70, 4); x.fill();
    x.fillStyle = '#D9B45A'; for (let i = 0; i < 6; i++) { x.fillRect(118 + i * 12, 52, 5, 8); x.fillRect(118 + i * 12, 130, 5, 8); }
    x.fillStyle = '#1A1A1A'; x.fillRect(30, 140, 40, 28); x.fillRect(220, 30, 50, 30);
  },
});
const draft = () => piece({
  key: 's3draft', w: 330, h: 240, color: '#F4F0E4', seed: 's3draft', edge: 'torn',
  draw: (x, w, h) => {
    x.strokeStyle = 'rgba(31,27,24,0.7)'; x.lineWidth = 2; x.lineCap = 'round';
    const r = rand('formula');
    for (let row = 0; row < 6; row++) {
      let px = 24 + (row % 2) * 18; const y = 34 + row * 34;
      while (px < w - 40) {
        const seg = 30 + r() * 60;
        x.beginPath(); x.moveTo(px, y);
        for (let k = 0; k <= seg; k += 4) x.lineTo(px + k, y + Math.sin(k / 3 + r()) * 4);
        x.stroke(); px += seg + 12 + r() * 10;
        if (r() < 0.25) { x.beginPath(); x.moveTo(px - 6, y - 6); x.lineTo(px + 2, y + 6); x.stroke(); }
      }
    }
    x.strokeStyle = C.red; x.lineWidth = 2.5; x.beginPath(); x.ellipse(250, 200, 56, 22, -0.1, 0, 7); x.stroke();
  },
});
const gearSpr = (R, teeth, key, color) => cutout({
  key, w: R * 2, h: R * 2, color, tex: 0.3, pad: 6,
  path: (x) => gearPath(x, R, R, R, teeth, 0.16, 0.22),
  draw: (x) => { x.strokeStyle = 'rgba(31,27,24,0.25)'; x.lineWidth = 2; x.beginPath(); x.arc(R, R, R * 0.6, 0, 7); x.stroke(); },
});
const car = () => silhouetteSprite('s3car', 420, 140, (x) => {
  x.fillStyle = C.red;
  x.beginPath(); x.moveTo(10, 96); x.lineTo(40, 70); x.lineTo(150, 62); x.lineTo(190, 34); x.lineTo(232, 32); x.lineTo(258, 60); x.lineTo(380, 70); x.lineTo(410, 96); x.lineTo(410, 108); x.lineTo(10, 108); x.closePath(); x.fill();
  x.fillRect(0, 50, 34, 14); x.fillRect(372, 40, 42, 12);   // wings
  x.fillStyle = C.ink; for (const cx of [86, 336]) { x.beginPath(); x.arc(cx, 104, 33, 0, 7); x.fill(); }
  x.fillStyle = '#9AA0A3'; for (const cx of [86, 336]) { x.beginPath(); x.arc(cx, 104, 12, 0, 7); x.fill(); }
  x.fillStyle = C.paper; x.beginPath(); x.arc(212, 40, 13, 0, 7); x.fill();
  x.fillStyle = C.paper; x.font = 'bold 30px SansB'; x.fillText('HFUT', 252, 92);
});
const clockSpr = () => cutout({
  key: 's3clock', w: 190, h: 190, color: C.paper, tex: 0.25,
  path: (x, w) => { x.beginPath(); x.arc(w / 2, w / 2, w / 2, 0, 7); },
  draw: (x, w) => {
    x.strokeStyle = C.ink; x.lineWidth = 6; x.beginPath(); x.arc(w / 2, w / 2, w / 2 - 6, 0, 7); x.stroke();
    for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; x.lineWidth = i % 3 ? 2 : 4; x.beginPath(); x.moveTo(w / 2 + Math.cos(a) * 72, w / 2 + Math.sin(a) * 72); x.lineTo(w / 2 + Math.cos(a) * 84, w / 2 + Math.sin(a) * 84); x.stroke(); }
  },
});
const wrench = () => silhouetteSprite('s3wrench', 260, 60, (x) => {
  x.fillStyle = '#8D969B';
  roundRect(x, 50, 20, 200, 20, 10); x.fill();
  x.beginPath(); x.arc(40, 30, 30, 0, 7); x.fill();
  x.globalCompositeOperation = 'destination-out'; x.beginPath(); x.rect(-4, 18, 34, 24); x.fill();
});
// forearm + fist gripping the wrench handle; fist at (0,0), arm reaching to the lower right
function hand(x, fx, fy) {
  x.save();
  x.shadowColor = C.shadow; x.shadowOffsetX = 6; x.shadowOffsetY = 8;
  const ex = fx + 520, ey = fy + 640;
  x.strokeStyle = '#C9D3DA'; x.lineCap = 'round'; x.lineWidth = 92;           // shirt sleeve
  x.beginPath(); x.moveTo(fx + 170, fy + 210); x.lineTo(ex, ey); x.stroke();
  x.shadowColor = 'transparent';
  x.strokeStyle = C.ink; x.lineWidth = 64;                                     // forearm
  x.beginPath(); x.moveTo(fx + 18, fy + 22); x.lineTo(fx + 190, fy + 236); x.stroke();
  x.fillStyle = C.ink;                                                          // fist + thumb
  x.beginPath(); x.ellipse(fx, fy, 44, 36, 0.9, 0, 7); x.fill();
  x.beginPath(); x.ellipse(fx - 20, fy - 30, 14, 26, 0.2, 0, 7); x.fill();
  x.strokeStyle = 'rgba(246,242,234,0.25)'; x.lineWidth = 2;
  for (let i = 0; i < 3; i++) { x.beginPath(); x.moveTo(fx + 8 + i * 12, fy - 18 + i * 10); x.lineTo(fx + 26 + i * 10, fy + 2 + i * 10); x.stroke(); }
  x.restore();
}

const GEAR = { x: 1290, y: 560, R: 120 };
export const bigGear = () => gearSpr(GEAR.R, 12, 's3g1', '#D5CFC0');
function gearAngle(f) {
  const base = two(f) * 0.006;
  const w = clamp((two(f) - 2400) / 120);
  const turns = Math.min(3, Math.floor(w * 3)) * 0.7 + easeInOut((w * 3) % 1) * (w < 1 ? 0.7 : 0);
  return base + turns;
}

export function draw(x, f) {
  place(x, blueprint(), W / 2, H / 2, { shadow: 0, jit: 's3bp', f, jamp: 0.06 });
  place(x, windowSpr(), 640, 330, { rot: -1.5, jit: 's3win', f });
  // clock: hands at 2:00, red second hand jumps every 30 frames
  place(x, clockSpr(), 1720, 170, { jit: 's3clk', f, overlay: (cx, w) => {
    const c = w / 2; cx.strokeStyle = C.ink; cx.lineCap = 'round';
    cx.lineWidth = 9; cx.beginPath(); cx.moveTo(c, c); cx.lineTo(c + Math.cos(-Math.PI / 2 + Math.PI / 3) * 46, c + Math.sin(-Math.PI / 2 + Math.PI / 3) * 46); cx.stroke();
    cx.lineWidth = 6; cx.beginPath(); cx.moveTo(c, c); cx.lineTo(c, c - 70); cx.stroke();
    const sec = Math.floor((f - 2100) / 30) * (Math.PI / 30);
    cx.strokeStyle = C.red; cx.lineWidth = 3; cx.beginPath(); cx.moveTo(c - Math.cos(-Math.PI / 2 + sec) * 16, c - Math.sin(-Math.PI / 2 + sec) * 16); cx.lineTo(c + Math.cos(-Math.PI / 2 + sec) * 78, c + Math.sin(-Math.PI / 2 + sec) * 78); cx.stroke();
    cx.fillStyle = C.ink; cx.beginPath(); cx.arc(c, c, 8, 0, 7); cx.fill();
  } });

  place(x, desk(), W / 2, 930, { shadow: 0.6, jit: 's3desk', f, jamp: 0.05 });
  place(x, lampLight(), 1114, 540, { ax: 0.5, ay: 0, shadow: 0, alpha: 0.78, jit: 's3lt', f, jamp: 0.1 });
  place(x, lamp(), 1120, 806, { ax: 0.5, ay: 1, s: 1.25, jit: 's3lamp', f, jamp: 0.2 });

  drop(x, f, circuit(), 470, 880, 2180, { rot: -6, id: 's3pcb' });
  drop(x, f, draft(), 860, 900, 2200, { rot: 4, id: 's3draft' });
  // gears (big + small meshing), rotate on twos
  const ga = gearAngle(f);
  drop(x, f, gearSpr(70, 9, 's3g2', '#B9BDB8'), GEAR.x + 172, GEAR.y + 100, 2226, { rot: (-ga * 180 / Math.PI) * (12 / 9) + 12, id: 's3g2', jamp: 0.2 });
  drop(x, f, gearSpr(GEAR.R, 12, 's3g1', '#D5CFC0'), GEAR.x, GEAR.y, 2220, { rot: ga * 180 / Math.PI, id: 's3g1', jamp: 0.2 });
  drop(x, f, car(), 1560, 900, 2240, { rot: -2, id: 's3car' });
  if (f >= 2240) place(x, tape(110, 30, 's3cart'), 1450, 840, { rot: -30, shadow: 0.2, jit: 's3ct', f });

  // the hand with a wrench, ratcheting three times
  if (f >= 2380 && f < 2580) {
    const inP = easeOut(clamp((two(f) - 2380) / 20)), outP = easeInOut(clamp((two(f) - 2540) / 30));
    const w = clamp((two(f) - 2400) / 120);
    const swing = Math.sin(w * Math.PI * 6) * 22;                         // 3 strokes
    const ang = (48 + swing) * Math.PI / 180;
    const off = (1 - inP + outP) * 520;
    const L = 210, hx = GEAR.x + Math.cos(ang) * L + off * 0.6, hy = GEAR.y + Math.sin(ang) * L + off;
    x.save();
    x.translate(GEAR.x + off * 0.6, GEAR.y + off); x.rotate(ang);
    place(x, wrench(), 0, 0, { ax: 40 / 260, ay: 0.5, jit: 's3wr', f, jamp: 0.2 });
    x.restore();
    hand(x, hx, hy);
  }

  // 小鸿鹄 on the desk edge, tilting its head twice with the gear
  let tilt = 0;
  for (const t0 of [2300, 2460]) { const q = clamp((two(f) - t0) / 40); tilt += Math.sin(q * Math.PI) * 9; }
  hero(x, f, 210, 830, { pose: 'stand', h: 280, rot: tilt, id: 's3hero' });

  drawCard(x, f, CARDS.v1, 'v1', 1180, 400, -2);
}

export const cues = [
  paperCue(2180), paperCue(2200), paperCue(2220), paperCue(2240),
  ...Array.from({ length: 25 }, (_, i) => ({ f: 2130 + i * 30, sfx: 'clock', gain: 0.12 })),
  ...[0, 1, 2].map((i) => ({ f: 2410 + i * 40, sfx: 'wrench', gain: 0.35 })),
  paperCue(CARDS.v1.a, 0.35),
];
