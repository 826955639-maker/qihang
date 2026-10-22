// S5 设计与创造（3600–4200）：彩色纸屑；草图纸上铅笔画出椅子线稿 → 彩色剪纸打样 → 为老人、孩子、轮椅使用者
import { C, F, W, H } from '../theme.js';
import { piece, place, paperBG, cutout, cached, tape } from '../lib/paper.js';
import { drop, paperCue } from '../lib/kit.js';
import { two, clamp, lerp, easeInOut, easeOut, spring } from '../lib/anim.js';
import { person, silhouetteSprite, measure, roundRect } from '../lib/draw.js';
import { rand, noise1 } from '../lib/rng.js';
import { hero } from '../lib/hero.js';
import { CARDS } from '../timeline.js';
import { drawCard } from './common.js';

const SK = { x: 560, y: 470, w: 680, h: 500, rot: -2 };
const sketchPaper = () => piece({
  key: 's5sketch', w: SK.w, h: SK.h, color: '#FBF9F3', seed: 's5sketch', edge: 'cut',
  draw: (x, w, h) => {
    x.strokeStyle = 'rgba(63,110,140,0.14)'; x.lineWidth = 1;
    for (let gx = 20; gx < w; gx += 20) { x.beginPath(); x.moveTo(gx, 0); x.lineTo(gx, h); x.stroke(); }
    for (let gy = 20; gy < h; gy += 20) { x.beginPath(); x.moveTo(0, gy); x.lineTo(w, gy); x.stroke(); }
    x.font = '20px SerifR'; x.fillStyle = 'rgba(31,27,24,0.45)'; x.fillText('适老 · 儿童 · 无障碍  座椅方案 03', 24, 34);
  },
});

// chair line art (paper-local coordinates), drawn stroke by stroke
const STROKES = [
  { pts: [[150, 420], [560, 420]], light: true },                                      // ground
  { pts: [[262, 110], [252, 160], [244, 210], [240, 262]] },                            // backrest
  { pts: [[240, 262], [300, 266], [370, 268], [440, 264]] },                            // seat
  { pts: [[240, 262], [236, 290], [446, 288], [440, 264]] },                            // seat thickness
  { pts: [[250, 290], [244, 350], [236, 418]] },                                        // back leg
  { pts: [[430, 290], [436, 350], [444, 418]] },                                        // front leg
  { pts: [[256, 200], [330, 204], [410, 206], [430, 214]] },                            // armrest
  { pts: [[410, 208], [416, 262]] },                                                    // arm support
  { pts: [[262, 96], [262, 70]], light: true }, { pts: [[446, 96], [446, 70]], light: true },
  { pts: [[262, 80], [446, 80]], light: true },                                          // dimension
  { pts: [[500, 430], [520, 400], [560, 360], [600, 330]], light: true },               // leader
];
const strokeLen = STROKES.map((s) => measure(s.pts).at(-1));
const TOTAL = strokeLen.reduce((a, b) => a + b, 0);

function lineArt(x, p, f) {
  let budget = p * TOTAL, head = null;
  x.save(); x.lineCap = 'round'; x.lineJoin = 'round';
  STROKES.forEach((s, i) => {
    if (budget <= 0) return;
    const L = measure(s.pts), use = Math.min(budget, L.at(-1)); budget -= L.at(-1);
    for (const pass of [0, 1]) {
      x.strokeStyle = s.light ? 'rgba(31,27,24,0.35)' : (pass ? 'rgba(31,27,24,0.35)' : 'rgba(31,27,24,0.9)');
      x.lineWidth = s.light ? 1.4 : pass ? 1.2 : 2.6;
      x.beginPath();
      let first = true;
      for (let k = 0; k < s.pts.length - 1; k++) {
        const a = s.pts[k], b = s.pts[k + 1], segL = L[k + 1] - L[k];
        const steps = Math.ceil(segL / 6);
        for (let j = 0; j <= steps; j++) {
          const d = L[k] + (segL * j) / steps;
          if (d > use) break;
          const t = j / steps, wob = noise1('st' + i + pass, d / 18) * (pass ? 1.6 : 0.8);
          const px = a[0] + (b[0] - a[0]) * t + wob, py = a[1] + (b[1] - a[1]) * t - wob;
          first ? x.moveTo(px, py) : x.lineTo(px, py); first = false; head = [px, py];
        }
      }
      x.stroke();
    }
  });
  if (p >= 1) {
    x.font = '22px SerifR'; x.fillStyle = 'rgba(31,27,24,0.7)';
    x.fillText('450', 336, 72); x.fillText('R120', 236, 134); x.fillText('防滑 / 可调高', 520, 318);
    x.strokeStyle = 'rgba(184,49,47,0.8)'; x.lineWidth = 2.5; x.beginPath(); x.arc(430, 262, 26, 0, 7); x.stroke();
  }
  x.restore();
  return head;
}

const pencil = () => silhouetteSprite('s5pencil', 300, 34, (x) => {
  x.fillStyle = '#E6B640'; x.fillRect(40, 4, 220, 26);
  x.fillStyle = '#D9A12C'; x.fillRect(40, 17, 220, 13);
  x.fillStyle = '#E8A0A0'; x.fillRect(262, 4, 34, 26);
  x.fillStyle = '#B9BDB8'; x.fillRect(252, 4, 12, 26);
  x.fillStyle = '#E9D2A8'; x.beginPath(); x.moveTo(40, 4); x.lineTo(0, 17); x.lineTo(40, 30); x.closePath(); x.fill();
  x.fillStyle = C.ink; x.beginPath(); x.moveTo(12, 13.5); x.lineTo(0, 17); x.lineTo(12, 20.5); x.closePath(); x.fill();
});

// colour paper prototype of the same chair, assembled piece by piece
const CH = { x: 1330, y: 400, s: 0.95 };
const chairParts = [
  { key: 'legs', at: 3720, color: '#8A6A47', path: (x) => { x.beginPath(); x.moveTo(60, 190); x.lineTo(40, 330); x.lineTo(58, 330); x.lineTo(82, 190); x.closePath(); x.moveTo(250, 190); x.lineTo(270, 330); x.lineTo(288, 330); x.lineTo(272, 190); x.closePath(); } },
  { key: 'seat', at: 3732, color: C.red, path: (x) => { x.beginPath(); roundRect(x, 30, 160, 270, 44, 18); } },
  { key: 'back', at: 3744, color: C.indigo, path: (x) => { x.beginPath(); x.moveTo(36, 170); x.quadraticCurveTo(30, 60, 60, 0); x.lineTo(104, 6); x.quadraticCurveTo(80, 70, 86, 170); x.closePath(); } },
  { key: 'arm', at: 3756, color: '#B48A5A', path: (x) => { x.beginPath(); roundRect(x, 60, 98, 210, 18, 9); x.rect(236, 100, 16, 70); } },
];
const partSpr = (p) => cutout({ key: 's5' + p.key, w: 330, h: 340, color: p.color, path: p.path, tex: 0.3 });

const heartSpr = () => cutout({
  key: 's5heart', w: 60, h: 54, color: C.red, tex: 0.25,
  path: (x, w, h) => { x.beginPath(); x.moveTo(w / 2, h); x.bezierCurveTo(-8, h * 0.55, 4, -4, w / 2, h * 0.24); x.bezierCurveTo(w - 4, -4, w + 8, h * 0.55, w / 2, h); x.closePath(); },
});

const elder = () => silhouetteSprite('s5elder', 140, 240, (x) => {
  x.translate(70, 236); person(x, { h: 230, phase: 0.4, pack: false, cap: false, lean: 14 });
  x.strokeStyle = C.ink; x.lineWidth = 6; x.lineCap = 'round'; x.beginPath(); x.moveTo(52, -96); x.lineTo(64, 0); x.stroke();
  x.beginPath(); x.moveTo(52, -96); x.quadraticCurveTo(50, -110, 38, -106); x.stroke();
});
const child = () => silhouetteSprite('s5child', 100, 160, (x) => {
  x.translate(50, 156); person(x, { h: 150, phase: 1.2, pack: true, cap: false, hair: true, armUp: true });
});
const wheel = () => silhouetteSprite('s5wheel', 200, 220, (x) => {
  x.fillStyle = C.ink; x.strokeStyle = C.ink; x.lineCap = 'round';
  x.lineWidth = 9; x.beginPath(); x.arc(84, 160, 52, 0, 7); x.stroke();
  x.lineWidth = 3; for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI; x.beginPath(); x.moveTo(84 + Math.cos(a) * 50, 160 + Math.sin(a) * 50); x.lineTo(84 - Math.cos(a) * 50, 160 - Math.sin(a) * 50); x.stroke(); }
  x.beginPath(); x.arc(170, 200, 14, 0, 7); x.lineWidth = 6; x.stroke();
  x.lineWidth = 8; x.beginPath(); x.moveTo(40, 60); x.lineTo(56, 120); x.lineTo(150, 120); x.lineTo(170, 186); x.stroke();
  // seated person
  x.beginPath(); x.arc(76, 22, 18, 0, 7); x.fill();
  x.beginPath(); x.moveTo(60, 44); x.lineTo(96, 44); x.lineTo(104, 112); x.lineTo(64, 116); x.closePath(); x.fill();
  x.lineWidth = 17; x.beginPath(); x.moveTo(80, 110); x.lineTo(146, 112); x.lineTo(152, 176); x.stroke();
  x.lineWidth = 12; x.beginPath(); x.moveTo(90, 58); x.lineTo(118, 92); x.lineTo(140, 86); x.stroke();
});
const PEOPLE = [
  { spr: elder, at: 3800, x: 1060, y: 885 },
  { spr: child, at: 3815, x: 1290, y: 885 },
  { spr: wheel, at: 3830, x: 1530, y: 885 },
];

// finished sketch, reused in the S6 journal spread
export function drawSketch(x, f, px, py, o = {}) {
  place(x, sketchPaper(), px, py, { ...o, overlay: (cx) => lineArt(cx, 1, f) });
}

export function draw(x, f) {
  place(x, paperBG(C.kraft, 's5bg'), 0, 0, { ax: 0, ay: 0, shadow: 0 });
  // confetti
  const r = rand('confetti');
  const cols = [C.red, C.gold, C.indigo, C.grass];
  for (let i = 0; i < 18; i++) {
    const cx = r() * W, cy = r() * H, sz = 18 + r() * 22, col = cols[i % 4], rot = r() * 360;
    const spr = cutout({ key: 's5cf' + i, w: sz, h: sz, color: col, tex: 0.2, pad: 4, path: (q, w, h) => { q.beginPath(); q.moveTo(0, h); q.lineTo(w * 0.5, 0); q.lineTo(w, h * 0.8); q.closePath(); } });
    place(x, spr, cx, cy, { rot, jit: 'cf' + i, f });
  }

  // sketch + pencil
  drop(x, f, sketchPaper(), SK.x, SK.y, 3608, { rot: SK.rot, id: 's5sk', jamp: 0.25, overlay: (cx) => {
    const p = clamp((two(f) - 3630) / 90);
    const head = lineArt(cx, p, f);
    if (p > 0 && p < 1 && head) {
      cx.save(); cx.shadowColor = C.shadow; cx.shadowOffsetX = 6; cx.shadowOffsetY = 8;
      cx.translate(head[0], head[1]); cx.rotate(-0.55);
      cx.drawImage(pencil().c, -pencil().pad, -pencil().pad - 17);
      cx.restore();
    }
  } });
  if (f >= 3620) place(x, tape(130, 34, 's5t1'), SK.x - SK.w / 2 + 30, SK.y - SK.h / 2 + 10, { rot: -35, shadow: 0.2, jit: 's5t1', f });

  // arrow from sketch to prototype
  if (f >= 3716) {
    const q = easeOut(clamp((two(f) - 3716) / 14));
    x.save(); x.strokeStyle = C.red; x.lineWidth = 6; x.lineCap = 'round';
    x.beginPath(); x.moveTo(930, 300); x.quadraticCurveTo(1010, 240, lerp(930, 1090, q), lerp(300, 290, q)); x.stroke();
    if (q >= 1) { x.beginPath(); x.moveTo(1090, 290); x.lineTo(1066, 274); x.moveTo(1090, 290); x.lineTo(1070, 310); x.stroke(); }
    x.restore();
  }
  for (const p of chairParts) drop(x, f, partSpr(p), CH.x, CH.y, p.at, { s: CH.s, id: 's5' + p.key, jamp: 0.35 });

  PEOPLE.forEach((pp, i) => {
    drop(x, f, pp.spr(), pp.x, pp.y, pp.at, { ax: 0.5, ay: 1, id: 's5p' + i, jamp: 0.4 });
    const t = two(f) - (pp.at + 12);
    if (t >= 0) {
      const sc = spring(t, 0.45, 0.6);
      const bobY = Math.sin(two(f) / 14 + i) * 4;
      place(x, heartSpr(), pp.x + 20, pp.y - pp.spr().h - 40 + bobY, { s: sc, rot: -8 + i * 8, jit: 's5h' + i, f });
    }
  });

  // 小鸿鹄: happy hop when the hearts pop
  let hop = 0;
  for (const t0 of [3812, 3827, 3842]) { const q = clamp((two(f) - t0) / 12); hop += -Math.sin(q * Math.PI) * 26; }
  hero(x, f, 1780, 1010 + hop, { pose: 'happy', h: 280, id: 's5hero' });

  drawCard(x, f, CARDS.v3, 'v3', 1250, 330, -1.5);
}

export const cues = [
  paperCue(3608, 0.35), { f: 3632, sfx: 'pencil', gain: 0.22, until: 3720 },
  ...chairParts.map((p) => paperCue(p.at, 0.25)),
  ...PEOPLE.map((p) => paperCue(p.at, 0.25)),
  ...PEOPLE.map((p) => ({ f: p.at + 12, sfx: 'pop', gain: 0.35 })),
  paperCue(CARDS.v3.a, 0.35),
];
