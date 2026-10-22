// S2 工大的远征（1350–2100）：安徽轮廓剪纸，红线连起 蚌埠黄庄 → 淮南洞山 → 合肥，弹出三张“老照片”，收拢成摞
import { C, F, W, H } from '../theme.js';
import { piece, place, paperBG, stampSprite, textStrip, cutout, cached, tape } from '../lib/paper.js';
import { drop, stamp, paperCue, stampCue } from '../lib/kit.js';
import { two, clamp, lerp, easeInOut } from '../lib/anim.js';
import { makeRoute, redLine, roundRect } from '../lib/draw.js';
import { rand } from '../lib/rng.js';
import { photo } from './common.js';

const LL = [[116.4, 34.65], [117.0, 34.45], [117.6, 34.3], [118.15, 33.85], [118.75, 33.65], [118.55, 33.15], [118.95, 32.75], [118.55, 32.35],
  [119.25, 32.1], [119.0, 31.75], [118.75, 31.45], [119.25, 31.15], [119.65, 30.95], [119.55, 30.45], [119.1, 30.05], [118.75, 29.8], [118.2, 29.45],
  [117.65, 29.55], [117.25, 29.85], [116.75, 29.85], [116.4, 30.1], [116.05, 30.0], [115.85, 30.4], [116.1, 30.85], [115.75, 31.2], [115.4, 31.55],
  [115.2, 31.85], [114.95, 32.2], [115.25, 32.5], [114.95, 32.75], [115.4, 32.95], [115.65, 33.35], [115.6, 33.85], [116.0, 33.95], [116.2, 34.3]];
const OX = 250, OY = 110;
const proj = ([lon, lat]) => [(lon - 114.9) * 128, (34.8 - lat) * 152];
const MAPW = 610, MAPH = 820;

const PTS = { bengbu: [640, 380], huainan: [505, 452], hefei: [600, 610] };   // 示意位置（相对地图左上）

const anhui = () => cutout({
  key: 'anhui', w: MAPW, h: MAPH, color: C.newsprint,
  path: (x) => { x.beginPath(); LL.map(proj).forEach(([a, b], i) => (i ? x.lineTo(a, b) : x.moveTo(a, b))); x.closePath(); },
  draw: (x) => {
    // 淮河 & 长江, hand-inked
    x.strokeStyle = 'rgba(63,110,140,0.6)'; x.lineWidth = 3; x.lineCap = 'round';
    const huai = [[115.0, 32.55], [115.8, 32.5], [116.5, 32.55], [117.1, 32.75], [117.6, 32.95], [118.2, 33.0], [118.7, 33.2]].map(proj);
    const yangtze = [[116.0, 29.9], [116.6, 30.3], [117.1, 30.6], [117.7, 30.9], [118.2, 31.3], [118.5, 31.7], [118.8, 32.1]].map(proj);
    for (const r of [huai, yangtze]) { x.beginPath(); r.forEach(([a, b], i) => (i ? x.lineTo(a, b) : x.moveTo(a, b))); x.stroke(); }
    x.font = F.serif(22); x.fillStyle = 'rgba(63,110,140,0.85)';
    x.fillText('淮河', proj([115.6, 32.85])[0], proj([115.6, 32.85])[1]);
    x.fillText('长江', proj([116.9, 30.25])[0], proj([116.9, 30.25])[1]);
    // hachured hills in the south
    x.strokeStyle = 'rgba(50,40,30,0.35)'; x.lineWidth = 1.2;
    const r = rand('ahhills');
    for (let i = 0; i < 14; i++) {
      const [a, b] = proj([116.2 + r() * 3, 29.9 + r() * 1.2]);
      x.beginPath(); x.moveTo(a - 9, b + 5); x.lineTo(a, b - 7); x.lineTo(a + 9, b + 5); x.stroke();
    }
  },
});

const route = () => cached('s2route', () => makeRoute(
  [PTS.bengbu, [600, 405], [555, 418], PTS.huainan, [520, 505], [568, 560], PTS.hefei].map(([a, b]) => [OX + a, OY + b]), 16, 'ahroute'));
function lineP(f) {
  f = two(f);
  if (f < 1410) return 0;
  if (f < 1560) return lerp(0, 0.45, (f - 1410) / 150);
  if (f < 1720) return lerp(0.45, 1, (f - 1560) / 160);
  return 1;
}

// ---------------------------------------------------------------- old photos
const SKY = '#D9D0BA';
const photos = [
  {
    key: 'p1', at: 1400, pt: 'bengbu', cap: '1945 · 蚌埠黄庄', pos: [1080, 300], rot: -5,
    scene: (x, w, h) => {
      x.fillStyle = SKY; x.fillRect(0, 0, w, h);
      x.fillStyle = '#A08D69'; x.fillRect(0, h * 0.72, w, h);
      for (const [hx, hw] of [[40, 150], [205, 120]]) {
        x.fillStyle = '#CDB993'; x.fillRect(hx, h * 0.5, hw, h * 0.24);
        x.fillStyle = '#4E4033'; x.beginPath(); x.moveTo(hx - 12, h * 0.52); x.lineTo(hx + hw * 0.18, h * 0.36); x.lineTo(hx + hw * 0.82, h * 0.36); x.lineTo(hx + hw + 12, h * 0.52); x.closePath(); x.fill();
        x.fillStyle = '#3C3128'; x.fillRect(hx + hw * 0.42, h * 0.6, hw * 0.16, h * 0.14);
        x.fillRect(hx + hw * 0.12, h * 0.58, hw * 0.14, h * 0.07); x.fillRect(hx + hw * 0.74, h * 0.58, hw * 0.14, h * 0.07);
      }
      x.fillStyle = '#3C3128'; x.fillRect(w - 52, h * 0.16, 4, h * 0.58);
      x.fillStyle = C.red; x.beginPath(); x.moveTo(w - 48, h * 0.17); x.quadraticCurveTo(w - 20, h * 0.13, w - 6, h * 0.2); x.lineTo(w - 10, h * 0.31); x.quadraticCurveTo(w - 26, h * 0.25, w - 48, h * 0.3); x.closePath(); x.fill();
    },
  },
  {
    key: 'p2', at: 1560, pt: 'huainan', cap: '淮南洞山', pos: [1520, 340], rot: 4,
    scene: (x, w, h) => {
      x.fillStyle = SKY; x.fillRect(0, 0, w, h);
      x.fillStyle = '#8E9270'; x.beginPath(); x.moveTo(-10, h); x.quadraticCurveTo(w * 0.35, h * 0.12, w * 0.8, h * 0.62); x.lineTo(w + 10, h); x.closePath(); x.fill();
      x.fillStyle = '#6F7656'; x.beginPath(); x.moveTo(w * 0.3, h); x.quadraticCurveTo(w * 0.75, h * 0.35, w + 10, h * 0.55); x.lineTo(w + 10, h); x.closePath(); x.fill();
      for (const [hx, hy, s] of [[70, 0.5, 1], [130, 0.4, 0.85], [250, 0.62, 1.1]]) {
        x.fillStyle = '#D5C4A0'; x.fillRect(hx, h * hy, 46 * s, 30 * s);
        x.fillStyle = '#4E4033'; x.beginPath(); x.moveTo(hx - 6, h * hy + 2); x.lineTo(hx + 23 * s, h * hy - 18 * s); x.lineTo(hx + 46 * s + 6, h * hy + 2); x.closePath(); x.fill();
        x.fillStyle = '#3C3128'; x.fillRect(hx + 17 * s, h * hy + 12 * s, 11 * s, 18 * s);
      }
    },
  },
  {
    key: 'p3', at: 1720, pt: 'hefei', cap: '合肥', pos: [1270, 690], rot: -3,
    scene: (x, w, h) => {
      x.fillStyle = '#DAD6C8'; x.fillRect(0, 0, w, h);
      const r = rand('skyline');
      let px = -6;
      while (px < w) {
        const bw = 34 + r() * 46, bh = h * (0.3 + r() * 0.5);
        x.fillStyle = r() < 0.5 ? C.indigo : '#2A4A72'; x.fillRect(px, h - bh, bw, bh);
        x.fillStyle = 'rgba(246,242,234,0.8)';
        for (let wy = h - bh + 10; wy < h - 14; wy += 16) for (let wx = px + 7; wx < px + bw - 9; wx += 12) if (r() < 0.7) x.fillRect(wx, wy, 5, 7);
        px += bw + 3;
      }
    },
  },
];
const photoSpr = (p) => photo(p.key, 340, 230, p.scene);
export const firstPhoto = () => photoSpr(photos[0]);

const STACK = [1240, 420];

export function draw(x, f) {
  place(x, paperBG(C.kraft, 's2bg'), 0, 0, { ax: 0, ay: 0, shadow: 0 });
  drop(x, f, anhui(), OX + MAPW / 2, OY + MAPH / 2, 1356, { id: 'anhui', jamp: 0.15 });
  drop(x, f, textStrip('安徽', { font: 'SerifB', px: 52, bg: C.paper }), 190, 130, 1366, { rot: -5, id: 'lblAH' });

  redLine(x, route(), lineP(f));
  for (const p of photos) {
    const [a, b] = PTS[p.pt];
    if (f >= p.at) stamp(x, f, cached('dotstamp', () => dotStamp()), OX + a, OY + b, p.at, { id: 'ds' + p.key, shadow: 0 });
  }

  // photos: pop next to their point, then gather into a stack (1850+)
  photos.forEach((p, i) => {
    if (f < p.at + 4) return;
    const g = easeInOut(clamp((two(f) - (1850 + i * 8)) / 26));
    const tx = STACK[0] + (i - 1) * 26, ty = STACK[1] + (i - 1) * -12;
    const px = lerp(p.pos[0], tx, g), py = lerp(p.pos[1], ty, g), rot = lerp(p.rot, [-7, 3, -2][i], g);
    // string from map point to photo
    if (g < 0.5) {
      const [a, b] = PTS[p.pt];
      x.save(); x.globalAlpha = 1 - g * 2; x.strokeStyle = 'rgba(31,27,24,0.55)'; x.lineWidth = 2; x.setLineDash([7, 6]);
      x.beginPath(); x.moveTo(OX + a, OY + b); x.lineTo(px, py); x.stroke(); x.restore();
    }
    const spr = photoSpr(p);
    drop(x, f, spr, px, py, p.at + 4, { rot, id: 'ph' + p.key, jamp: 0.35 });
    if (f >= p.at + 16) {
      place(x, tape(120, 34, 'pt' + p.key), px, py - spr.h / 2 + 4, { rot: rot + (i % 2 ? 6 : -8), shadow: 0.2, jit: 'ptt' + p.key, f });
      // caption stamped onto the white border
      const cap = stampSprite(p.cap, 30, { seed: 'cap' + p.key, padX: 0.4, padY: 0.25 });
      x.save(); x.translate(px, py); x.rotate((rot * Math.PI) / 180);
      stamp(x, f, cap, 0, spr.h / 2 - 26, p.at + 16, { id: 'cap' + p.key, rot: -2, shadow: 0 });
      x.restore();
    }
  });

  drop(x, f, textStrip('工业报国', { font: 'SerifB', px: 88, bg: C.paper, padX: 0.55 }), STACK[0], 700, 1886, { rot: -2, id: 'gybg' });
  drop(x, f, textStrip('艰苦奋斗 · 自强不息', { font: 'SerifB', px: 46, bg: C.red, color: C.paper, padX: 0.6 }), STACK[0] + 20, 812, 1918, { rot: 1.5, id: 'jkfd' });
}

function dotStamp() {
  const spr = stampSprite('　', 20, { seed: 'dot', box: false });
  const x = spr.c.getContext('2d');
  x.fillStyle = C.red; x.beginPath(); x.arc(spr.c.width / 2, spr.c.height / 2, 13, 0, 7); x.fill();
  x.strokeStyle = C.red; x.lineWidth = 3; x.beginPath(); x.arc(spr.c.width / 2, spr.c.height / 2, 21, 0, 7); x.stroke();
  return spr;
}

export const cues = [
  paperCue(1356, 0.3), paperCue(1366, 0.2),
  ...photos.flatMap((p) => [stampCue(p.at, 0.5), paperCue(p.at + 4, 0.3), stampCue(p.at + 16, 0.35)]),
  { f: 1852, sfx: 'paper', gain: 0.25 }, { f: 1866, sfx: 'paper', gain: 0.22 },
  paperCue(1886, 0.35), paperCue(1918, 0.3),
];
