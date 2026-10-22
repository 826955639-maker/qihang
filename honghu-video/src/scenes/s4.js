// S4 田野与课堂（2850–3600）：纸天空 + 层叠田野，小路上的背包青年，红顶小教室（黑板火箭、举手的孩子），调研笔记，种子发芽
import { C, F, W, H } from '../theme.js';
import { piece, place, cutout, cached, tape, textStrip } from '../lib/paper.js';
import { drop, paperCue } from '../lib/kit.js';
import { two, clamp, lerp, easeInOut, easeOut } from '../lib/anim.js';
import { person, waveStrip, makeRoute, along, silhouetteSprite, roundRect } from '../lib/draw.js';
import { rand } from '../lib/rng.js';
import { hero, bob } from '../lib/hero.js';
import { CARDS } from '../timeline.js';
import { drawCard } from './common.js';

const sky = () => piece({ key: 's4sky', w: W + 80, h: 700, color: C.paper, seed: 's4sky', rim: false, tex: 0.3 });
const hills = () => cutout({
  key: 's4hills', w: W + 80, h: 200, color: C.indigo, tex: 0.25,
  path: (x, w, h) => { x.beginPath(); x.moveTo(0, h); x.lineTo(0, 120); x.quadraticCurveTo(260, 20, 520, 100); x.quadraticCurveTo(760, 160, 980, 70); x.quadraticCurveTo(1240, -10, 1500, 90); x.quadraticCurveTo(1760, 150, w, 60); x.lineTo(w, h); x.closePath(); },
});
const hills2 = () => cutout({
  key: 's4hills2', w: W + 80, h: 160, color: '#3B5577', tex: 0.25,
  path: (x, w, h) => { x.beginPath(); x.moveTo(0, h); x.lineTo(0, 90); x.quadraticCurveTo(380, 10, 700, 80); x.quadraticCurveTo(1100, 150, 1400, 60); x.quadraticCurveTo(1650, 0, w, 70); x.lineTo(w, h); x.closePath(); },
});
const FIELDS = [['#8C9653', 560], ['#7A8744', 640], ['#6E7B3B', 740], ['#5D6A31', 860], ['#4E5A28', 980]];
const field = (i) => cutout({
  key: 's4field' + i, w: W + 80, h: 560, color: FIELDS[i][0], tex: 0.3,
  path: (x, w, h) => waveStrip(x, w, h, 10 + i * 2, 90 + i * 30, 'fld' + i, 3),
  draw: (x, w, h) => {      // furrows
    x.strokeStyle = 'rgba(31,27,24,0.12)'; x.lineWidth = 2;
    for (let k = 0; k < 4; k++) { x.beginPath(); x.moveTo(0, 40 + k * 22); for (let px = 0; px < w; px += 40) x.lineTo(px, 40 + k * 22 + Math.sin(px / 200 + i) * 6); x.stroke(); }
  },
});

// winding dirt road from the foreground (left) to the horizon (right)
const ROAD = [[560, 1100], [640, 960], [780, 860], [900, 780], [1010, 700], [1110, 640], [1200, 596]];
const road = () => cutout({
  key: 's4road', w: W, h: H, color: '#C9A86A', tex: 0.35, pad: 0,
  path: (x) => {
    const R = makeRoute(ROAD, 12, 'road');
    const L = [], Rr = [];
    R.pts.forEach((p, i) => {
      const a = R.pts[Math.max(0, i - 1)], b = R.pts[Math.min(R.pts.length - 1, i + 1)];
      const dx = b[0] - a[0], dy = b[1] - a[1], d = Math.hypot(dx, dy) || 1;
      const wdt = lerp(150, 10, i / (R.pts.length - 1));
      L.push([p[0] - (dy / d) * wdt, p[1] + (dx / d) * wdt]); Rr.push([p[0] + (dy / d) * wdt, p[1] - (dx / d) * wdt]);
    });
    x.beginPath(); [...L, ...Rr.reverse()].forEach(([a, b], i) => (i ? x.lineTo(a, b) : x.moveTo(a, b))); x.closePath();
  },
});
const roadRoute = () => cached('s4rr', () => makeRoute(ROAD, 12, 'road'));

const SCHOOL = { x: 1430, y: 560 };
const school = () => piece({
  key: 's4school', w: 560, h: 330, color: C.paper, seed: 's4school', edge: 'cut',
  draw: (x, w, h) => {
    x.fillStyle = 'rgba(31,27,24,0.08)'; x.fillRect(0, h - 18, w, 18);
    // 黑板报 on the wall
    x.fillStyle = '#28332B'; x.fillRect(28, 70, 210, 150);
    x.strokeStyle = '#8A6A47'; x.lineWidth = 8; x.strokeRect(24, 66, 218, 158);
    // window with kids behind (kids drawn as overlay)
    x.fillStyle = '#E9E2CF'; x.fillRect(282, 70, 250, 140);
    x.strokeStyle = '#8A6A47'; x.lineWidth = 7; x.strokeRect(282, 70, 250, 140);
    // door
    x.fillStyle = '#8A6A47'; x.fillRect(250, 236, 60, 94);
    x.fillStyle = C.red; x.font = '22px SerifB'; x.fillText('希望小学', 360, 260);
  },
});
const roof = () => cutout({
  key: 's4roof', w: 640, h: 150, color: C.red, tex: 0.3,
  path: (x, w, h) => { x.beginPath(); x.moveTo(0, h); x.lineTo(60, 0); x.lineTo(w - 60, 0); x.lineTo(w, h); x.closePath(); },
  draw: (x, w, h) => { x.strokeStyle = 'rgba(31,27,24,0.18)'; x.lineWidth = 3; for (let k = 1; k < 5; k++) { x.beginPath(); x.moveTo(60 - k * 12, k * 30); x.lineTo(w - 60 + k * 12, k * 30); x.stroke(); } },
});

// chalk rocket drawn on the blackboard (local coords of the school piece)
function chalkRocket(x, p) {
  const segs = [
    [[130, 90], [160, 130], [160, 185], [100, 185], [100, 130], [130, 90]],
    [[100, 165], [80, 195], [100, 190]], [[160, 165], [180, 195], [160, 190]],
    [[115, 190], [130, 215], [145, 190]],
  ];
  const total = segs.reduce((a, s) => a + s.length - 1, 0);
  let budget = p * total;
  x.save(); x.strokeStyle = 'rgba(246,242,234,0.9)'; x.lineWidth = 3.5; x.lineCap = 'round'; x.lineJoin = 'round';
  x.setLineDash([9, 2, 4, 2]);
  for (const s of segs) {
    if (budget <= 0) break;
    x.beginPath(); x.moveTo(...s[0]);
    for (let i = 1; i < s.length && budget > 0; i++) {
      const k = Math.min(1, budget); budget -= 1;
      x.lineTo(s[i - 1][0] + (s[i][0] - s[i - 1][0]) * k, s[i - 1][1] + (s[i][1] - s[i - 1][1]) * k);
    }
    x.stroke();
  }
  if (p >= 1) { x.setLineDash([]); x.beginPath(); x.arc(130, 140, 9, 0, 7); x.stroke(); }
  x.restore();
}

function kids(x, f) {
  const order = [1, 4, 2];
  for (let i = 0; i < 6; i++) {
    const cx = 300 + i * 40, cy = 208;
    const k = order.indexOf(i);
    const raise = k >= 0 ? easeOut(clamp((two(f) - (3150 + k * 50)) / 8)) : 0;
    x.save(); x.fillStyle = C.ink;
    x.beginPath(); x.arc(cx, cy - 46, 13, 0, 7); x.fill();
    x.beginPath(); x.ellipse(cx, cy - 6, 18, 24, 0, Math.PI, 0); x.fill();
    if (raise > 0) {
      const th = ((70 - 150 * raise) * Math.PI) / 180;   // arm swings from down to up
      x.lineWidth = 8; x.lineCap = 'round'; x.strokeStyle = C.ink;
      x.beginPath(); x.moveTo(cx + 12, cy - 22); x.lineTo(cx + 12 + Math.cos(th) * 36, cy - 22 + Math.sin(th) * 36); x.stroke();
      x.beginPath(); x.arc(cx + 12 + Math.cos(th) * 38, cy - 22 + Math.sin(th) * 38, 6, 0, 7); x.fill();
    }
    x.restore();
  }
}

const notebook = () => piece({
  key: 's4note', w: 360, h: 230, color: '#F4F0E4', seed: 's4note', edge: 'cut',
  draw: (x, w, h) => {
    x.fillStyle = 'rgba(31,27,24,0.12)'; x.fillRect(w / 2 - 3, 0, 6, h);
    x.strokeStyle = 'rgba(63,110,140,0.25)'; x.lineWidth = 1;
    for (let y = 70; y < h - 10; y += 24) { x.beginPath(); x.moveTo(14, y); x.lineTo(w / 2 - 14, y); x.moveTo(w / 2 + 14, y); x.lineTo(w - 14, y); x.stroke(); }
    x.font = F.hand(38); x.fillStyle = C.ink; x.fillText('调研笔记', 22, 52);
    x.strokeStyle = 'rgba(31,27,24,0.6)'; x.lineWidth = 2;
    for (let i = 0; i < 4; i++) { x.beginPath(); x.moveTo(22, 88 + i * 24); for (let k = 0; k < 120 - i * 16; k += 4) x.lineTo(22 + k, 88 + i * 24 + Math.sin(k / 3) * 3); x.stroke(); }
    // sketch of a seedling + a little bar chart
    x.strokeStyle = C.grass; x.lineWidth = 3; x.beginPath(); x.moveTo(250, 200); x.quadraticCurveTo(246, 150, 256, 110); x.stroke();
    x.fillStyle = C.grass; x.beginPath(); x.ellipse(236, 126, 20, 9, 0.5, 0, 7); x.ellipse(274, 112, 20, 9, -0.5, 0, 7); x.fill();
    x.fillStyle = C.red; [30, 52, 40, 64].forEach((bh, i) => x.fillRect(300 + i * 12, 200 - bh, 8, bh));
  },
});

const seed = () => cutout({ key: 's4seed', w: 26, h: 18, color: '#7A5532', tex: 0.2, path: (x, w, h) => { x.beginPath(); x.ellipse(w / 2, h / 2, w / 2, h / 2, 0.3, 0, 7); } });
function sprout(x, px, py, k) {
  if (k <= 0) return;
  x.save(); x.translate(px, py); x.scale(1, k);
  x.shadowColor = 'rgba(31,27,24,0.25)'; x.shadowOffsetX = 4; x.shadowOffsetY = 5;
  x.strokeStyle = '#8DB04A'; x.lineWidth = 7; x.lineCap = 'round';
  x.beginPath(); x.moveTo(0, 0); x.quadraticCurveTo(-6, -50, 4, -96); x.stroke();
  x.fillStyle = '#9CC152';
  x.beginPath(); x.ellipse(-26, -78, 30, 13, 0.55, 0, 7); x.fill();
  x.beginPath(); x.ellipse(30, -96, 30, 13, -0.55, 0, 7); x.fill();
  x.restore();
}

function walkers(x, f) {
  const R = roadRoute();
  const t = Math.max(0, two(f) - 2880);
  for (let i = 0; i < 3; i++) {
    const u = clamp(0.06 + t * 0.0011 - i * 0.07, 0, 0.98);
    const pt = along(R, u * R.total);
    const sc = lerp(1, 0.32, Math.pow(u, 0.8));
    x.save(); x.translate(pt.x, pt.y + 6); x.scale(sc, sc);
    x.shadowColor = 'rgba(31,27,24,0.25)'; x.shadowOffsetX = 5 * sc; x.shadowOffsetY = 5 * sc;
    person(x, { h: 150, phase: t * 0.28 + i * 2, pack: true, cap: false, hair: true });
    x.restore();
  }
}

export function drawSchool(x, f, px, py, o = {}) {
  place(x, school(), px, py + 100 * (o.s ?? 1), { ...o, overlay: (cx) => { chalkRocket(cx, 1); } });
  place(x, roof(), px, py - 120 * (o.s ?? 1), o);
}

export function draw(x, f) {
  place(x, sky(), W / 2, 340, { shadow: 0, jit: 's4sky', f, jamp: 0.05 });
  // a paper sun & two clouds
  place(x, cached('s4sun', () => cutout({ key: 's4sunc', w: 130, h: 130, color: C.gold, path: (c, w) => { c.beginPath(); c.arc(w / 2, w / 2, w / 2, 0, 7); } })), 330, 170, { jit: 's4sun', f });
  for (const [cx, cy, i] of [[760, 150, 0], [1640, 210, 1]]) {
    place(x, piece({ key: 's4cloud' + i, w: 220, h: 70, color: '#FFFFFF', seed: 'cl' + i, tex: 0.15 }), cx + Math.sin(two(f) / 90 + i) * 6, cy, { rot: i ? 3 : -2, jit: 's4cl' + i, f, shadow: 0.5 });
  }
  place(x, hills2(), W / 2, 520, { ay: 0.5, shadow: 0.4, jit: 's4h2', f, jamp: 0.05 });
  place(x, hills(), W / 2, 560, { ay: 0.5, shadow: 0.5, jit: 's4h', f, jamp: 0.05 });
  FIELDS.forEach(([, y], i) => {
    place(x, field(i), W / 2, y + 280, { shadow: 0.7, jit: 's4f' + i, f, jamp: 0.04 });
  });
  drop(x, f, road(), W / 2, H / 2, 2872, { shadow: 0.4, id: 's4road', jamp: 0.04, drop: { dist: 30, rot: 0 } });
  if (f >= 2880) walkers(x, f);

  // classroom
  drop(x, f, school(), SCHOOL.x, SCHOOL.y + 100, 3050, { id: 's4school', overlay: (cx) => {
    chalkRocket(cx, clamp((two(f) - 3064) / 60));
    kids(cx, f);
  } });
  drop(x, f, roof(), SCHOOL.x, SCHOOL.y - 120, 3062, { id: 's4roof' });

  // seed falls and sprouts — “把种子撒在沿途的土地上”
  const SEED = { x: 400, y: 1000 };
  if (f >= 3100 && f < 3134) {
    const q = easeInOut(clamp((two(f) - 3100) / 30));
    place(x, seed(), SEED.x + Math.sin(q * 6) * 30, lerp(-40, SEED.y, q), { rot: q * 360, jit: 's4seed', f });
  }
  sprout(x, SEED.x, SEED.y + 6, easeOut(clamp((two(f) - 3136) / 30)));

  drop(x, f, notebook(), 290, 790, 3200, { rot: -8, id: 's4note' });
  if (f >= 3212) place(x, tape(110, 30, 's4nt'), 170, 680, { rot: -40, shadow: 0.2, jit: 's4nt', f });

  // 小鸿鹄 hops in and watches the class
  if (f >= 2960) {
    const t = two(f) - 2960, hop = t < 14 ? -Math.sin((t / 14) * Math.PI) * 60 : 0;
    const look = Math.sin(Math.max(0, two(f) - 3150) / 50 * Math.PI) * 5;
    hero(x, f, 1780 + Math.max(0, 14 - t) * 6, 1010 + hop, { pose: 'look', h: 280, rot: look, id: 's4hero' });
  }

  drawCard(x, f, CARDS.v2, 'v2', 700, 300, 2);
}

export const cues = [
  paperCue(2872, 0.2), { f: 2885, sfx: 'steps', gain: 0.14, until: 3040 },
  paperCue(3050, 0.35), paperCue(3062, 0.3),
  { f: 3066, sfx: 'pencil', gain: 0.12, until: 3124 },
  { f: 3150, sfx: 'chime', gain: 0.15 }, { f: 3200, sfx: 'chime', gain: 0.13 }, { f: 3250, sfx: 'chime', gain: 0.15 },
  { f: 3132, sfx: 'pop', gain: 0.25 },
  paperCue(3200, 0.3), { f: 2972, sfx: 'step', gain: 0.25 },
  paperCue(CARDS.v2.a, 0.35),
];
