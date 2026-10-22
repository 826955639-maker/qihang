// 单帧合成：场景 → 翻页转场 → 历史滤镜 → 字幕 → 暗角 + 胶片颗粒
import { createCanvas } from './canvas.js';
import { W, H, C, F, TOTAL } from './theme.js';
import { SCENES, WIPES, SUBTITLES, historyAmount, sceneAt } from './timeline.js';
import { rand } from './lib/rng.js';
import { cached, place, piece, textStrip, edgePoly, polyPath, STATE } from './lib/paper.js';
import { two, clamp, easeInOut, dropIn } from './lib/anim.js';
import { hero, bob } from './lib/hero.js';
import * as s0 from './scenes/s0.js';
import * as s1 from './scenes/s1.js';
import * as s2 from './scenes/s2.js';
import * as s3 from './scenes/s3.js';
import * as s4 from './scenes/s4.js';
import * as s5 from './scenes/s5.js';
import * as s6 from './scenes/s6.js';
import * as s7 from './scenes/s7.js';

export const MODULES = { S0: s0, S1: s1, S2: s2, S3: s3, S4: s4, S5: s5, S6: s6, S7: s7 };

const main = createCanvas(W, H), mx = main.getContext('2d');
const buf = createCanvas(W, H), bx = buf.getContext('2d');
const tmp = createCanvas(W, H), tx = tmp.getContext('2d');
for (const c of [mx, bx, tx]) { c.imageSmoothingEnabled = true; c.imageSmoothingQuality = 'high'; }

function drawScene(x, id, f) {
  x.save();
  MODULES[id].draw(x, f);
  x.restore();
  STATE.cam = 1;
}

// ---------------------------------------------------------------- wipe: new page sweeps in from the right
const WIPE_EDGE = cached('wipeEdge', () => {
  const r = rand('wipe'), pts = [];
  for (let y = -40; y <= H + 40; y += 9) pts.push([(r() - 0.5) * 9 + Math.sin(y / 53) * 10 + Math.sin(y / 17) * 3, y]);
  return pts;
});

function wipePath(x, ex, k = 0) {
  x.beginPath();
  x.moveTo(W + 400, -40);
  for (const [px, py] of WIPE_EDGE) x.lineTo(ex + px - k, py);
  x.lineTo(W + 400, H + 40);
  x.closePath();
}

function drawWipe(x, f, b) {
  const prev = sceneAt(b - 1).id, next = sceneAt(b).id;
  const p = easeInOut(clamp((two(f) - (b - 10)) / 20));
  const ex = W + 140 - p * (W + 340);
  drawScene(x, prev, f);
  drawScene(bx, next, f);
  // shadow cast by the incoming page onto the old one
  x.save(); x.fillStyle = 'rgba(31,27,24,0.28)'; wipePath(x, ex - 10); x.fill(); x.restore();
  // white torn fibre along the edge
  x.save(); x.fillStyle = '#FBF8F1'; wipePath(x, ex - 4); x.fill(); x.restore();
  x.save(); wipePath(x, ex); x.clip(); x.drawImage(buf, 0, 0); x.restore();
  // 小鸿鹄 flies right→left just ahead of the edge
  const hx = ex - 120, hy = 500 + bob(f, 16, 20) + Math.sin(p * Math.PI) * -60;
  hero(x, f, hx, hy + 170, { pose: 'fly', h: 300, rot: -14, id: 'herowipe' });
}

// ---------------------------------------------------------------- overlays
function subtitle(x, f) {
  const s = SUBTITLES.find((q) => f >= q.a && f < q.b);
  if (!s) return;
  const spr = textStrip(s.text, { font: 'SansM', px: 44, bg: C.newsprint, padX: 0.75, padY: 0.38, seed: s.id });
  const d = dropIn(f, s.a, { dist: 24, rot: -2, dur: 6 });
  if (!d) return;
  const y = H - 72 - spr.h / 2;
  place(x, spr, W / 2, y + d.dy, { rot: d.rot - 0.4, alpha: d.alpha, jit: 'sub' + s.id, f, jamp: 0.12, lift: d.lift });
}

const VIGNETTE = cached('vignette', () => {
  const c = createCanvas(W, H), x = c.getContext('2d');
  const g = x.createRadialGradient(W / 2, H / 2, H * 0.42, W / 2, H / 2, H * 1.05);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(150,135,115,1)');
  x.fillStyle = g; x.fillRect(0, 0, W, H);
  return c;
});

const GRAIN = cached('grain', () => {
  const tiles = [];
  for (let k = 0; k < 6; k++) {
    const gw = W / 2, gh = H / 2, c = createCanvas(gw, gh), x = c.getContext('2d'), id = x.createImageData(gw, gh), r = rand('grain' + k);
    for (let i = 0; i < gw * gh; i++) { const v = 255 - Math.pow(r(), 2.2) * 255; id.data[i * 4] = v; id.data[i * 4 + 1] = v; id.data[i * 4 + 2] = v; id.data[i * 4 + 3] = 255; }
    x.putImageData(id, 0, 0); tiles.push(c);
  }
  return tiles;
});

export function renderFrame(f) {
  const x = mx;
  x.save();
  x.fillStyle = C.kraft; x.fillRect(0, 0, W, H);
  const b = WIPES.find((w) => f >= w - 10 && f < w + 10);
  if (b != null) drawWipe(x, f, b);
  else drawScene(x, sceneAt(f).id, f);
  x.restore();

  // 历史段滤镜：saturate(0.7) sepia(0.25)
  const h = historyAmount(f);
  if (h > 0.001) {
    tx.clearRect(0, 0, W, H);
    tx.filter = `saturate(${1 - 0.3 * h}) sepia(${0.25 * h})`;
    tx.drawImage(main, 0, 0);
    tx.filter = 'none';
    x.drawImage(tmp, 0, 0);
  }

  subtitle(x, f);

  // vignette (multiply ~30% at corners) + film grain (multiply 8%), grain on twos like the animation
  x.save();
  x.globalCompositeOperation = 'multiply';
  x.globalAlpha = 0.55; x.drawImage(VIGNETTE, 0, 0);
  x.globalAlpha = 0.08; x.drawImage(GRAIN[Math.floor(f / 2) % GRAIN.length], 0, 0, W, H);
  x.restore();

  // 最后 30 帧淡出到墨黑
  if (f >= TOTAL - 30) {
    x.fillStyle = C.ink; x.globalAlpha = clamp((f - (TOTAL - 30)) / 28); x.fillRect(0, 0, W, H); x.globalAlpha = 1;
  }
  return main;
}

export function allCues() {
  return Object.values(MODULES).flatMap((m) => m.cues || []).concat(
    WIPES.flatMap((b) => [{ f: b - 12, sfx: 'whoosh', gain: 0.35 }, { f: b - 8, sfx: 'flap', gain: 0.4 }]),
  ).sort((a, b) => a.f - b.f);
}
