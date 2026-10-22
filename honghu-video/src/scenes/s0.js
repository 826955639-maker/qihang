// S0 序·发问（0–450）：校史馆桌面，三张纸片，小鸿鹄走入，点亮地图红点，问句逐字出现，推镜入红点
import { C, F, W, H } from '../theme.js';
import { piece, place, paperBG, tape, STATE, textStrip } from '../lib/paper.js';
import { drop, paperCue } from '../lib/kit.js';
import { two, clamp, easeInOut, easeOut, lerp } from '../lib/anim.js';
import { hero, heroSprite } from '../lib/hero.js';
import { mapArt, compass } from './common.js';

const MAP = { x: 770, y: 560, w: 780, h: 520, rot: -3 };
export const DOT = { x: 610, y: 700 };
const Q = '鸿鹄一飞，能飞多远？';
const Q0 = 170;

const mapSpr = () => piece({
  key: 's0map', w: MAP.w, h: MAP.h, color: C.newsprint, seed: 'oldmap', res: 2,
  draw: (x, w, h) => { mapArt(x, w, h, 'oldmap-art'); compass(x, w - 70, 80, 30); },
});
const ticketSpr = () => piece({
  key: 's0ticket', w: 400, h: 150, color: C.paper, seed: 'ticket', edge: 'cut',
  draw: (x, w, h) => {
    x.fillStyle = 'rgba(184,49,47,0.75)'; x.fillRect(0, 0, 22, h);
    x.strokeStyle = 'rgba(31,27,24,0.45)'; x.setLineDash([6, 5]); x.lineWidth = 1.5; x.strokeRect(36, 14, w - 120, h - 28);
    x.setLineDash([]);
    x.fillStyle = 'rgba(31,27,24,0.5)';
    for (let y = 8; y < h; y += 12) { x.beginPath(); x.arc(w - 66, y, 2.2, 0, 7); x.fill(); }
    x.strokeStyle = 'rgba(31,27,24,0.22)'; x.lineWidth = 2;
    for (let i = 0; i < 3; i++) { x.beginPath(); x.moveTo(56, 48 + i * 28); x.lineTo(56 + 150 - i * 30, 48 + i * 28); x.stroke(); }
    x.globalCompositeOperation = 'destination-out';
    x.beginPath(); x.arc(w - 66, -2, 12, 0, 7); x.arc(w - 66, h + 2, 12, 0, 7); x.fill();
  },
});
const frameSpr = () => piece({
  key: 's0frame', w: 330, h: 390, color: C.paper, seed: 'frame', edge: 'cut',
  draw: (x, w, h) => {
    x.fillStyle = '#DCD2C0'; x.fillRect(26, 26, w - 52, h - 92);
    x.strokeStyle = 'rgba(31,27,24,0.35)'; x.lineWidth = 1.5; x.strokeRect(26, 26, w - 52, h - 92);
    x.strokeStyle = 'rgba(31,27,24,0.18)';
    x.beginPath(); x.moveTo(60, h - 40); x.lineTo(w - 60, h - 40); x.stroke();
  },
});
const scrapSpr = (i) => piece({
  key: `s0scrap${i}`, w: [170, 120, 90][i], h: [70, 90, 60][i], color: [C.newsprint, C.kraft, C.paper][i], seed: `scrap${i}`,
  draw: (x, w, h) => {
    x.fillStyle = 'rgba(31,27,24,0.25)';
    for (let y = 12; y < h - 6; y += 9) x.fillRect(10, y, w - 20 - ((y * 7) % 30), 3);
  },
});
const questionStrip = () => piece({ key: 's0qstrip', w: 860, h: 130, color: C.paper, seed: 'qstrip' });

// camera: push in on the red dot (scale 1→2.4)
export function camera(f) {
  const p = easeInOut(clamp((two(f) - 360) / 90));
  const s = lerp(1, 2.4, p);
  const tx = lerp(DOT.x, W / 2, p), ty = lerp(DOT.y, H / 2, p);
  return { s, tx, ty };
}

export function draw(x, f) {
  const cam = camera(f);
  x.save();
  x.translate(cam.tx, cam.ty); x.scale(cam.s, cam.s); x.translate(-DOT.x, -DOT.y);
  STATE.cam = cam.s;
  place(x, paperBG(C.kraft, 'desk'), 0, 0, { ax: 0, ay: 0, shadow: 0 });

  // scraps on the desk (already there)
  place(x, scrapSpr(0), 210, 180, { rot: -12, jit: 'sc0', f });
  place(x, scrapSpr(1), 1760, 560, { rot: 9, jit: 'sc1', f });
  place(x, scrapSpr(2), 330, 930, { rot: 18, jit: 'sc2', f });

  drop(x, f, mapSpr(), MAP.x, MAP.y, 0, { rot: MAP.rot, id: 'map', jamp: 0.3 });
  drop(x, f, ticketSpr(), 1480, 290, 8, { rot: 7, id: 'ticket' });
  if (drop(x, f, frameSpr(), 1490, 770, 16, { rot: -7, id: 'frame' }) && f >= 28) {
    place(x, tape(110, 32, 'ft1'), 1360, 600, { rot: -38, shadow: 0.2, jit: 'ft1', f });
    place(x, tape(110, 32, 'ft2'), 1620, 570, { rot: 30, shadow: 0.2, jit: 'ft2', f });
  }

  // red dot: appears where the hand touches, then pulses (1→1.3, 20-frame period)
  if (f >= 128) {
    const t = two(f) - 128;
    const pop = t < 6 ? easeOut(t / 6) * 1.15 : 1;
    const pulse = 1 + 0.15 * (1 - Math.cos((t / 20) * Math.PI * 2));
    x.save(); x.translate(DOT.x, DOT.y); x.scale(pop * pulse, pop * pulse);
    x.fillStyle = 'rgba(184,49,47,0.25)'; x.beginPath(); x.arc(0, 0, 26, 0, 7); x.fill();
    x.fillStyle = C.red; x.beginPath(); x.arc(0, 0, 14, 0, 7); x.fill();
    x.restore();
  }

  // 小鸿鹄：40–90 走入（每 6 帧一步），100–160 俯身触碰地图
  if (f >= 40) {
    const steps = 8, x0 = -240, x1 = 380;
    const tf = clamp(two(f) - 40, 0, 50);
    const k = Math.min(steps, Math.floor(tf / 6)), q = tf >= 48 ? 1 : (tf % 6) / 6;
    const done = tf >= 48;
    const px = done ? x1 : x0 + (k + easeInOut(q)) * ((x1 - x0) / steps);
    const hop = done ? 0 : -Math.sin(Math.PI * q) * 16;
    let rot = done ? 0 : (k % 2 ? 3 : -3) * Math.sin(Math.PI * q);
    const lean = f < 100 ? 0 : f < 118 ? easeInOut((two(f) - 100) / 18) : f < 142 ? 1 : f < 160 ? 1 - easeInOut((two(f) - 142) / 18) : 0;
    rot += lean * 10;
    let look = 0;   // 张望：之后左右轻歪头
    if (f > 200) look = Math.sin(((two(f) - 200) / 60) * Math.PI) * 4;
    hero(x, f, px, 1000 + hop, { pose: 'stand', h: 520, rot: rot + look, id: 'hero0', res: cam.s > 1.05 ? 2 : 1 });
  }

  // 问句：每字间隔 6 帧，像打字机敲下
  if (f >= Q0 - 10) {
    drop(x, f, questionStrip(), 960, 150, Q0 - 12, { rot: -1.2, id: 'qs', drop: { dist: 40, rot: -4 } });
    x.save();
    x.translate(960, 150); x.rotate((-1.2 * Math.PI) / 180);
    x.font = F.title(72); x.textBaseline = 'middle'; x.textAlign = 'center';
    const total = x.measureText(Q).width;
    let cx = -total / 2;
    for (let i = 0; i < Q.length; i++) {
      const ch = Q[i], cw = x.measureText(ch).width;
      const t = f - (Q0 + i * 6);
      if (t >= 0) {
        const s = t < 4 ? 1.35 - 0.35 * (t / 4) : 1;
        x.save(); x.translate(cx + cw / 2, 4); x.scale(s, s);
        x.fillStyle = C.ink; x.fillText(ch, 0, 0);
        x.restore();
      }
      cx += cw;
    }
    x.restore();
  }
  x.restore();
  STATE.cam = 1;
}

export const cues = [
  paperCue(0), paperCue(8), paperCue(16),
  ...Array.from({ length: 8 }, (_, i) => ({ f: 40 + i * 6 + 5, sfx: 'step', gain: 0.2 })),
  { f: 128, sfx: 'pop', gain: 0.35 },
  paperCue(Q0 - 12, 0.25),
  ...Array.from({ length: Q.length }, (_, i) => ({ f: Q0 + i * 6, sfx: 'type', gain: 0.5 })),
  { f: 360, sfx: 'whoosh', gain: 0.25 },
];
