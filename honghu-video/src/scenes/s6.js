// S6 接力（4200–5100）：靛蓝→晨光金的分层撕纸天空，校园剪影逐层贴入，旭日升起；
// 小鸿鹄拖着与长征同一支笔触的红线飞向右上；青年奔跑接力；最后拉远成一本摊开的手账
import { createCanvas } from '../canvas.js';
import { C, F, W, H } from '../theme.js';
import { piece, place, cutout, cached, tape, edgePoly, polyPath, STATE } from '../lib/paper.js';
import { drop, paperCue } from '../lib/kit.js';
import { two, clamp, lerp, easeInOut, easeOut } from '../lib/anim.js';
import { person, silhouetteSprite, makeRoute, redLine, along, waveStrip, roundRect } from '../lib/draw.js';
import { rand } from '../lib/rng.js';
import { hero, bob } from '../lib/hero.js';
import { snowCard } from './s1.js';
import { firstPhoto } from './s2.js';
import { bigGear } from './s3.js';
import { drawSchool } from './s4.js';
import { drawSketch } from './s5.js';

const SKY = [['#1E3A5F', 0, 330], ['#35507A', 250, 250], ['#6E6A8A', 430, 220], ['#C98A62', 580, 200], ['#E6A93A', 700, 260]];
const skyStrip = (i) => piece({ key: 's6sky' + i, w: W + 100, h: SKY[i][2], color: SKY[i][0], seed: 's6sky' + i, tex: 0.25, mot: 0.1, rimColor: i < 3 ? '#6A7FA0' : '#F3DDB0' });
const sun = () => cutout({ key: 's6sun', w: 250, h: 250, color: '#F6D58A', tex: 0.2, path: (x, w) => { x.beginPath(); x.arc(w / 2, w / 2, w / 2, 0, 7); } });

const lake = () => piece({
  key: 's6lake', w: W + 100, h: 190, color: C.river, seed: 's6lake', rimColor: '#9FC0D4',
  draw: (x, w, h) => {
    x.strokeStyle = 'rgba(246,242,234,0.35)'; x.lineWidth = 3; x.lineCap = 'round';
    const r = rand('ripples');
    for (let i = 0; i < 22; i++) { const px = r() * w, py = 30 + r() * (h - 40), l = 30 + r() * 70; x.beginPath(); x.moveTo(px, py); x.quadraticCurveTo(px + l / 2, py - 5, px + l, py); x.stroke(); }
    x.fillStyle = 'rgba(246,213,138,0.55)';
    for (let i = 0; i < 6; i++) x.fillRect(1100 + (r() - 0.5) * 60, 24 + i * 22, 60 - i * 7, 6);   // sun glitter
  },
});
const ground = () => cutout({ key: 's6ground', w: W + 100, h: 120, color: '#18304F', tex: 0.2, path: (x, w, h) => waveStrip(x, w, h, 6, 120, 's6g', 2) });

function windows(x, ox, oy, cols, rows, cw, ch, gx, gy, seed) {
  const r = rand(seed);
  for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
    x.fillStyle = r() < 0.3 ? C.gold : C.paper;
    x.fillRect(ox + i * (cw + gx), oy + j * (ch + gy), cw, ch);
  }
}
const library = () => cutout({
  key: 's6lib', w: 560, h: 300, color: C.indigo, tex: 0.25,
  path: (x, w, h) => { x.beginPath(); x.moveTo(0, h); x.lineTo(0, 110); x.lineTo(w / 2, 20); x.lineTo(w, 110); x.lineTo(w, h); x.closePath(); x.rect(w / 2 - 70, 0, 140, 40); },
  draw: (x, w, h) => {
    for (let i = 0; i < 8; i++) { x.fillStyle = 'rgba(246,242,234,0.85)'; x.fillRect(46 + i * 64, 140, 14, 140); }
    windows(x, 70, 120, 7, 1, 30, 14, 34, 0, 'libw');
    x.fillStyle = C.gold; x.fillRect(w / 2 - 34, 220, 68, 80);
  },
});
const tower = () => cutout({
  key: 's6tower', w: 330, h: 470, color: '#21436C', tex: 0.25,
  path: (x, w, h) => { x.beginPath(); x.rect(0, 70, w, h - 70); x.rect(w / 2 - 50, 0, 100, 80); },
  draw: (x, w, h) => {
    windows(x, 26, 110, 6, 9, 26, 22, 22, 18, 'towerw');
    x.fillStyle = C.paper; x.beginPath(); x.arc(w / 2, 38, 22, 0, 7); x.fill();
    x.strokeStyle = C.indigo; x.lineWidth = 3; x.beginPath(); x.moveTo(w / 2, 38); x.lineTo(w / 2, 24); x.moveTo(w / 2, 38); x.lineTo(w / 2 + 12, 42); x.stroke();
  },
});
const blockWin = () => cutout({
  key: 's6blockw', w: 380, h: 260, color: '#1A3558', tex: 0.25,
  path: (x, w, h) => { x.beginPath(); x.rect(0, 0, w, h); },
  draw: (x) => windows(x, 22, 26, 8, 6, 26, 18, 20, 18, 'blockw'),
});
const tree = (i) => cutout({
  key: 's6tree' + i, w: 160, h: 230, color: '#17304D', tex: 0.25,
  path: (x, w, h) => { x.beginPath(); x.arc(w / 2, 70, 64, 0, 7); x.arc(w / 2 - 34, 110, 46, 0, 7); x.arc(w / 2 + 36, 112, 46, 0, 7); x.rect(w / 2 - 9, 120, 18, h - 120); },
});

const FLIGHT = () => cached('s6flight', () => makeRoute([[-80, 980], [260, 860], [620, 700], [980, 560], [1300, 400], [1560, 290], [1760, 190], [2000, 110]], 18, 'relay'));
const flightP = (f) => easeInOut(clamp((two(f) - 4450) / 300));

function runnerSpr(phase, i) {
  const q = Math.round(((phase % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2) / (Math.PI / 4)) % 8;
  return silhouetteSprite(`s6run${i % 2}:${q}`, 120, 190, (x) => {
    x.translate(60, 186);
    person(x, { h: 172, phase: q * (Math.PI / 4), run: true, pack: i % 2 === 0, cap: false, hair: true, lean: 10 });
  });
}

function campus(x, f) {
  for (let i = 0; i < 4; i++) place(x, skyStrip(i), W / 2, SKY[i][1] + SKY[i][2] / 2, { shadow: 0.5, jit: 's6s' + i, f, jamp: 0.04 });
  const sp = easeOut(clamp((two(f) - 4300) / 120));
  place(x, sun(), 1150, lerp(880, 640, sp), { shadow: 0, jit: 's6sun', f, jamp: 0.2 });
  place(x, skyStrip(4), W / 2, SKY[4][1] + SKY[4][2] / 2, { shadow: 0.5, jit: 's6s4', f, jamp: 0.04 });

  // campus layers pasted from the bottom up
  drop(x, f, blockWin(), 1000, 790, 4240, { ay: 1, id: 's6bw', jamp: 0.15 });
  drop(x, f, library(), 560, 880, 4270, { ay: 1, id: 's6lib', jamp: 0.15 });
  drop(x, f, tower(), 1430, 880, 4300, { ay: 1, id: 's6tw', jamp: 0.15 });
  [[230, 4330], [880, 4350], [1730, 4370]].forEach(([tx, at], i) => drop(x, f, tree(i), tx, 900, at, { ay: 1, id: 's6t' + i, jamp: 0.3 }));
  drop(x, f, ground(), W / 2, 930, 4210, { id: 's6gr', jamp: 0.04, shadow: 0.3 });
  drop(x, f, lake(), W / 2, 1000, 4210, { id: 's6lake', jamp: 0.04 });

  // relay red line: same component & stroke as the Long March line
  const p = flightP(f);
  if (f >= 4450) {
    const R = FLIGHT();
    redLine(x, R, p, { head: false });
    if (p < 1) {
      const pt = along(R, R.total * p);
      const s = lerp(1, 0.7, p);
      hero(x, f, pt.x, pt.y + 120 * s + bob(f, 12, 20), { pose: 'away', h: 260 * s, rot: 14, id: 's6hero' });
    }
  }
  // youths running left → right; one looks back
  if (f >= 4600 && f < 4960) {
    const t = two(f) - 4600;
    for (let i = 0; i < 5; i++) {
      const px = -140 - i * 150 + t * 8.2;
      if (px < -200 || px > W + 200) continue;
      const phase = t * 0.42 + i * 1.3;
      const back = i === 2 && f >= 4740 && f < 4776;
      place(x, runnerSpr(phase, i), px, 935, { ax: 0.5, ay: 1, flip: back, jit: 's6r' + i, f, jamp: 0.35 });
    }
  }
}

// journal spread: the campus page shrinks to 85% and earlier scenes gather round it
const page = createCanvas(W, H), px = page.getContext('2d');
const BORDER = cached('s6border', () => edgePoly(W, H, 's6page', 'torn', 2.2));
export function spread(x, f, freezeAt = null) {
  const k = easeInOut(clamp((two(f) - 4900) / 60));
  const s = lerp(1, 0.85, k);
  if (k <= 0) { campus(x, f); return; }
  px.save(); px.clearRect(0, 0, W, H); campus(px, freezeAt ?? f); px.restore();
  x.fillStyle = C.kraft; x.fillRect(0, 0, W, H);
  x.save();
  x.translate(W / 2, H / 2); x.scale(s, s); x.translate(-W / 2, -H / 2);
  x.shadowColor = C.shadow; x.shadowOffsetX = 8; x.shadowOffsetY = 10;
  x.fillStyle = '#FBF8F1'; polyPath(x, BORDER); x.fill();
  x.shadowColor = 'transparent';
  x.save(); polyPath(x, BORDER.map(([a, b]) => [lerp(W / 2, a, 0.994), lerp(H / 2, b, 0.99)])); x.clip(); x.drawImage(page, 0, 0); x.restore();
  x.restore();
  const g = (at) => at;   // drop times
  drop(x, f, snowCard(), 205, 210, g(4930), { s: 0.55, rot: -8, id: 'sp1' });
  drop(x, f, firstPhoto(), 1715, 190, g(4950), { s: 0.62, rot: 7, id: 'sp2' });
  drop(x, f, bigGear(), 1790, 640, g(4970), { s: 0.8, rot: two(f) * 0.3, id: 'sp3' });
  if (f >= 4990) drawSchool(x, f, 170, 790, { s: 0.42, rot: 5, jit: 'sp4', f });
  if (f >= 5010) drawSketch(x, f, 1640, 940, { s: 0.36, rot: -6, jit: 'sp5', f });
  if (f >= 4944) place(x, tape(120, 34, 'spt1'), 330, 120, { rot: 30, shadow: 0.2, jit: 'spt1', f });
  if (f >= 4964) place(x, tape(120, 34, 'spt2'), 1600, 96, { rot: -24, shadow: 0.2, jit: 'spt2', f });
}

export function draw(x, f) {
  spread(x, f);
}

export const cues = [
  paperCue(4240, 0.3), paperCue(4270, 0.3), paperCue(4300, 0.3), paperCue(4330, 0.2), paperCue(4350, 0.2), paperCue(4370, 0.2),
  { f: 4450, sfx: 'flap', gain: 0.45 }, { f: 4560, sfx: 'flap', gain: 0.3 }, { f: 4670, sfx: 'flap', gain: 0.2 },
  { f: 4600, sfx: 'steps', gain: 0.2, until: 4900, rate: 1.6 },
  { f: 4900, sfx: 'whoosh', gain: 0.25 },
  paperCue(4930, 0.25), paperCue(4950, 0.25), paperCue(4970, 0.25), paperCue(4990, 0.25), paperCue(5010, 0.25),
];
