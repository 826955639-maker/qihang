// S1 回望长征（450–1350）：放大的旧地图，红线自于都蜿蜒至会宁，沿途贴出五张剪纸小场景与数字印章
import { C, F, W, H } from '../theme.js';
import { piece, place, stampSprite, textStrip, cached, tape } from '../lib/paper.js';
import { drop, stamp, paperCue, stampCue } from '../lib/kit.js';
import { two, clamp, lerp, easeInOut } from '../lib/anim.js';
import { makeRoute, redLine, along, person, flame, waveStrip, starPath } from '../lib/draw.js';
import { rand } from '../lib/rng.js';
import { mapArt } from './common.js';

const ROUTE_PTS = [[230, 865], [400, 800], [540, 735], [700, 735], [850, 640], [990, 590], [1120, 500], [1260, 455], [1380, 360], [1520, 310], [1650, 215]];
export const route = () => cached('s1route', () => makeRoute(ROUTE_PTS, 18, 'longmarch'));
const END = { x: 1650, y: 215 };

// red line arrives at each vignette shortly after it is pasted
const KEYS = [[470, 0], [560, 0.08], [780, 0.3], [960, 0.48], [1120, 0.66], [1250, 0.84], [1290, 1]];
export function lineProgress(f) {
  f = two(f);
  if (f <= KEYS[0][0]) return 0;
  for (let i = 1; i < KEYS.length; i++) {
    if (f <= KEYS[i][0]) {
      const [fa, pa] = KEYS[i - 1], [fb, pb] = KEYS[i];
      return lerp(pa, pb, (f - fa) / (fb - fa));
    }
  }
  return 1;
}

const bg = () => piece({
  key: 's1bg', w: W + 120, h: H + 100, color: C.newsprint, seed: 's1bg', tex: 0.4,
  draw: (x, w, h) => mapArt(x, w, h, 'oldmap-art-big', 1.7),
});

// ---------------------------------------------------------------- vignettes
const CW = 480, CH = 310;

function nightCard() {
  return piece({
    key: 'v1night', w: CW, h: CH, color: '#33476A', seed: 'v1night', edge: 'torn',
    draw: (x, w, h) => {
      const r = rand('stars');
      x.fillStyle = 'rgba(246,242,234,0.85)';
      for (let i = 0; i < 26; i++) { x.beginPath(); x.arc(r() * w, r() * h * 0.5, 0.8 + r() * 1.4, 0, 7); x.fill(); }
      x.fillStyle = '#EFE8D6'; x.beginPath(); x.arc(w - 80, 64, 26, 0, 7); x.fill();
      x.fillStyle = '#33476A'; x.beginPath(); x.arc(w - 68, 56, 24, 0, 7); x.fill();
      x.save(); x.translate(0, 150); x.fillStyle = '#253350'; waveStrip(x, w, h, 6, 60, 'farbank', 3); x.fill(); x.restore();
      ['#4D7F9C', '#3F6E8C', '#335C77'].forEach((col, i) => {
        x.save(); x.translate(0, 205 + i * 34); x.fillStyle = col; waveStrip(x, w, 200, 5, 22 + i * 6, 'river' + i, 2.5); x.fill(); x.restore();
      });
      // pontoon bridge: boats + planks
      x.fillStyle = '#1F1B18';
      for (let bx = 18; bx < w; bx += 58) { x.beginPath(); x.ellipse(bx, 222, 22, 9, 0, 0, Math.PI); x.fill(); }
      x.fillStyle = '#B79A6E'; x.fillRect(-4, 206, w + 8, 9);
      x.fillStyle = 'rgba(31,27,24,0.4)'; for (let px = 0; px < w; px += 16) x.fillRect(px, 206, 2, 9);
    },
  });
}
function nightOverlay(f) {
  return (x, w) => {
    const t = two(f);
    for (let i = 0; i < 9; i++) {
      const px = ((i * 62 + t * 0.9) % (w + 80)) - 40;
      x.save(); x.translate(px, 206); person(x, { h: 46, phase: t * 0.32 + i * 1.7, pack: true, rifle: i % 3 === 1 }); x.restore();
    }
    for (let i = 0; i < 6; i++) flame(x, 40 + i * 80, 140 + (i % 2) * 8, 18, f, 'nf' + i);
  };
}

function torchCard() {
  return piece({
    key: 'v2torch', w: 500, h: 290, color: '#3A4A66', seed: 'v2torch',
    draw: (x, w, h) => {
      x.save(); x.translate(0, 120); x.fillStyle = '#2B3650'; waveStrip(x, w, h, 18, 70, 'ridge', 5); x.fill(); x.restore();
      x.save(); x.translate(0, 186); x.fillStyle = '#D9A55A'; waveStrip(x, w, h, 6, 50, 'glow', 3); x.fill(); x.restore();
      x.save(); x.translate(0, 236); x.fillStyle = '#6B5A45'; waveStrip(x, w, h, 4, 40, 'ground', 2); x.fill(); x.restore();
    },
  });
}
function torchOverlay(f) {
  return (x, w) => {
    const t = two(f) - 700;
    for (let i = 0; i < 20; i++) {
      const px = -30 + i * 29 + Math.max(0, t) * 0.7;
      const xx = ((px + 40) % (w + 80)) - 40;
      x.save(); x.translate(xx, 242); person(x, { h: 40, phase: t * 0.3 + i * 0.9, pack: true, torch: true }); x.restore();
      flame(x, xx + 8, 242 - 40 * 1.16, 10, f, 'tf' + i);
    }
  };
}

function riverCard() {
  return piece({
    key: 'v3river', w: 460, h: 300, color: '#E8E2D2', seed: 'v3river',
    draw: (x, w, h) => {
      const cols = ['#7FA3B8', '#5E8AA4', '#3F6E8C', '#335C77', '#4D7F9C', '#2E546D'];
      cols.forEach((c, i) => {
        x.save(); x.translate(0, 30 + i * 44); x.rotate((-3 + i * 1.3) * Math.PI / 180);
        x.fillStyle = c; waveStrip(x, w + 40, 70, 7, 26 + i * 4, 'rv' + i, 3); x.fill(); x.restore();
      });
    },
  });
}

export function snowCard() {
  return piece({
    key: 'v4snow', w: 490, h: 330, color: '#C9D3D6', seed: 'v4snow',
    draw: (x, w, h) => {
      const peaks = [[-20, 330, 120, 120, 270, 330], [140, 330, 300, 60, 460, 330], [320, 330, 440, 140, 560, 330]];
      peaks.forEach(([a, b, c, d, e, g], i) => {
        x.fillStyle = '#F6F2EA'; x.beginPath(); x.moveTo(a, b); x.lineTo(c, d); x.lineTo(e, g); x.closePath(); x.fill();
        x.fillStyle = 'rgba(120,135,150,0.45)'; x.beginPath(); x.moveTo(c, d); x.lineTo(e, g); x.lineTo(c + 20, g); x.closePath(); x.fill();
      });
      x.translate(0, 290); x.fillStyle = '#E7E9E6'; waveStrip(x, w, h, 5, 40, 'snowfield', 2); x.fill();
    },
  });
}
function snowOverlay(f) {
  return (x) => {
    const t = Math.max(0, two(f) - 1050);
    for (let i = 0; i < 8; i++) {
      const u = ((i * 0.11 + t * 0.0016) % 0.9);
      const px = 160 + u * 150, py = 300 - u * 230;     // climbing the ridge of the middle peak
      x.save(); x.translate(px, py); x.rotate(-0.1); person(x, { h: 30, phase: t * 0.3 + i, pack: true, lean: 14 }); x.restore();
    }
  };
}

function grassCard() {
  return piece({
    key: 'v5grass', w: 480, h: 300, color: '#D6CFAF', seed: 'v5grass',
    draw: (x, w, h) => {
      ['#8C9653', '#7A8744', '#6E7B3B', '#5D6A31', '#4E5A28'].forEach((c, i) => {
        x.save(); x.translate(0, 120 + i * 36); x.fillStyle = c;
        const r = rand('saw' + i);
        x.beginPath(); x.moveTo(-5, 200);
        for (let px = -5; px <= w + 10; px += 9) { x.lineTo(px, 4 + r() * 4); x.lineTo(px + 4.5, -10 - r() * 10); }
        x.lineTo(w + 10, 200); x.closePath(); x.fill(); x.restore();
      });
    },
  });
}
function grassOverlay(f) {
  return (x) => {
    const t = Math.max(0, two(f) - 1200);
    const base = 120 + t * 0.35;
    // two figures leaning on each other — one helps the other
    x.save(); x.translate(base, 238); person(x, { h: 60, phase: t * 0.22, lean: 10, pack: true }); x.restore();
    x.save(); x.translate(base + 26, 238); person(x, { h: 64, phase: t * 0.22 + 2, lean: -9, pack: true, rifle: true }); x.restore();
    for (let i = 0; i < 3; i++) { x.save(); x.translate(base - 90 - i * 48, 236); person(x, { h: 52, phase: t * 0.25 + i * 2, pack: true }); x.restore(); }
    for (let i = 0; i < 2; i++) { x.save(); x.translate(base + 110 + i * 46, 236); person(x, { h: 52, phase: t * 0.25 + i * 3, pack: true }); x.restore(); }
  };
}

const VIGNETTES = [
  { id: 'v1', at: 470, s: 0.08, make: nightCard, overlay: nightOverlay, big: [560, 520], small: [255, 600], rot: -3 },
  { id: 'v2', at: 700, s: 0.3, make: torchCard, overlay: torchOverlay, big: [960, 740], small: [990, 805], rot: 2.5 },
  { id: 'v3', at: 900, s: 0.48, make: riverCard, overlay: null, big: [650, 420], small: [640, 395], rot: -2 },
  { id: 'v4', at: 1050, s: 0.66, make: snowCard, overlay: snowOverlay, big: [1380, 690], small: [1430, 690], rot: 3 },
  { id: 'v5', at: 1200, s: 0.84, make: grassCard, overlay: grassOverlay, big: [1060, 300], small: [1080, 250], rot: -2.5 },
];
const passFrame = (v) => KEYS.find((k) => k[1] === v.s)[0];

const STAMPS = [
  { f: 520, text: '1934', px: 88, at: [200, 230], rot: -7 },
  { f: 600, text: '86000+', px: 80, at: [470, 150], rot: 4 },
  { f: 800, text: '600余次战斗', px: 58, at: [1660, 870], rot: -4 },
  { f: 1000, text: '40余座高山', px: 58, at: [1700, 470], rot: 5 },
  { f: 1290, text: '1936 · 会师', px: 64, at: [1420, 100], rot: -3 },
];

export function draw(x, f) {
  place(x, bg(), W / 2, H / 2, { shadow: 0, jit: 's1bg', f, jamp: 0.08 });
  const R = route();
  const p = lineProgress(f);

  // place tags
  drop(x, f, textStrip('于都', { font: 'SerifR', px: 36, bg: C.paper, edge: 'cut' }), 170, 930, 462, { rot: -4, id: 'tagYD' });
  drop(x, f, textStrip('路线示意', { font: 'SerifR', px: 24, bg: C.paper, edge: 'cut', color: 'rgba(31,27,24,0.75)' }), 120, 1035, 470, { rot: 2, id: 'tagLX', jamp: 0.4 });

  redLine(x, R, p);

  // vignettes: big when pasted, shrink to 60% at the roadside once the line has passed
  for (const v of VIGNETTES) {
    const pf = passFrame(v) + 6;
    const k = easeInOut(clamp((two(f) - pf) / 16));
    const s = lerp(1, 0.6, k);
    const px = lerp(v.big[0], v.small[0], k), py = lerp(v.big[1], v.small[1], k);
    drop(x, f, v.make(), px, py, v.at, { rot: v.rot, s, id: 'card' + v.id, overlay: v.overlay ? v.overlay(f) : null });
    if (v.id === 'v3' && f >= v.at + 16) {
      // stamp “近百条江河” on the river vignette
      stamp(x, f, stampSprite('近百条江河', 46, { seed: 'jbtjh' }), px, py + 4 * s, v.at + 16, { rot: -6, s, id: 'st-jbt' });
    }
  }

  // 会师：三条短红线从三个方向汇聚
  if (f >= 1270) {
    const q = clamp((two(f) - 1270) / 22);
    for (const [ax, ay] of [[END.x + 150, END.y - 30], [END.x + 40, END.y + 150]]) {
      const r2 = cached(`conv:${ax}`, () => makeRoute([[ax, ay], [(ax + END.x) / 2 + 8, (ay + END.y) / 2 - 6], [END.x, END.y]], 10, 'conv' + ax));
      redLine(x, r2, q);
    }
  }
  if (f >= 1296) stamp(x, f, cached('star', () => starStamp()), END.x, END.y, 1296, { id: 'star', rot: 8 });
  drop(x, f, textStrip('会宁', { font: 'SerifR', px: 36, bg: C.paper, edge: 'cut' }), END.x + 120, END.y + 70, 1284, { rot: 3, id: 'tagHN' });

  for (const st of STAMPS) stamp(x, f, stampSprite(st.text, st.px), st.at[0], st.at[1], st.f, { rot: st.rot, id: 'st' + st.text });
}

function starStamp() {
  const spr = stampSprite('　', 70, { seed: 'starbox', box: false });
  const c = spr.c, x = c.getContext('2d');
  x.save(); x.globalCompositeOperation = 'source-over';
  x.fillStyle = C.red; starPath(x, c.width / 2, c.height / 2, 34); x.fill();
  x.strokeStyle = C.red; x.lineWidth = 4; x.beginPath(); x.arc(c.width / 2, c.height / 2, 44, 0, 7); x.stroke();
  x.restore();
  return spr;
}

export const cues = [
  paperCue(462, 0.2),
  { f: 470, sfx: 'water', gain: 0.2, until: 640 },
  { f: 700, sfx: 'steps', gain: 0.22, until: 860 },
  ...VIGNETTES.map((v) => paperCue(v.at, 0.3)),
  ...STAMPS.map((s) => stampCue(s.f)),
  stampCue(916, 0.45), stampCue(1296, 0.6), paperCue(1284, 0.2),
];
