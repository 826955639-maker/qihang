// 手绘要素：红线（马克笔）、剪影小人、通用小图形
import { createCanvas } from '../canvas.js';
import { C } from '../theme.js';
import { rand, noise1 } from './rng.js';
import { cached, texturize } from './paper.js';

// ---------------------------------------------------------------- polylines
export function catmull(points, seg = 14) {
  const out = [];
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)], p1 = points[i], p2 = points[i + 1], p3 = points[Math.min(points.length - 1, i + 2)];
    for (let k = 0; k < seg; k++) {
      const t = k / seg, t2 = t * t, t3 = t2 * t;
      out.push([0, 1].map((d) => 0.5 * (2 * p1[d] + (-p0[d] + p2[d]) * t + (2 * p0[d] - 5 * p1[d] + 4 * p2[d] - p3[d]) * t2 + (-p0[d] + 3 * p1[d] - 3 * p2[d] + p3[d]) * t3)));
    }
  }
  out.push(points[points.length - 1].slice());
  return out;
}

export function measure(pts) {
  const L = [0];
  for (let i = 1; i < pts.length; i++) L.push(L[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  return L;
}

// point & tangent at arc length s
export function along(route, s) {
  const { pts, L } = route;
  s = Math.max(0, Math.min(L[L.length - 1], s));
  let i = 1;
  while (i < L.length - 1 && L[i] < s) i++;
  const t = (s - L[i - 1]) / Math.max(1e-6, L[i] - L[i - 1]);
  const a = pts[i - 1], b = pts[i];
  return { x: a[0] + (b[0] - a[0]) * t, y: a[1] + (b[1] - a[1]) * t, ang: Math.atan2(b[1] - a[1], b[0] - a[0]) };
}

export function makeRoute(points, seg = 16, seed = 'route') {
  const pts = catmull(points, seg);
  // hand-drawn wobble: ±1px along the normal, fixed per route
  const L0 = measure(pts);
  const w = pts.map((p, i) => {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
    const dx = b[0] - a[0], dy = b[1] - a[1], d = Math.hypot(dx, dy) || 1;
    const o = noise1(seed, L0[i] / 23) * 1.1;
    return [p[0] - (dy / d) * o, p[1] + (dx / d) * o];
  });
  return { pts: w, L: measure(w), total: measure(w).at(-1) };
}

// RedLine：stroke=red，宽 10px，按进度画出；马克笔笔触（两层 + 断续高光）
export function redLine(x, route, p, { width = 10, color = C.red, head = true } = {}) {
  if (p <= 0) return;
  const { pts, L } = route;
  const target = route.total * Math.min(1, p);
  const path = [];
  for (let i = 0; i < pts.length && L[i] <= target; i++) path.push(pts[i]);
  const end = along(route, target);
  path.push([end.x, end.y]);
  if (path.length < 2) return;
  x.save();
  x.lineCap = 'round'; x.lineJoin = 'round';
  // under-stroke (ink bleeding into paper)
  x.strokeStyle = 'rgba(120,20,20,0.35)'; x.lineWidth = width + 2.5;
  stroke(x, path, 0.8, 0.6);
  x.strokeStyle = color; x.lineWidth = width;
  stroke(x, path, 0, 0);
  // marker streaks: lighter line slightly offset, broken
  x.strokeStyle = 'rgba(255,200,190,0.22)'; x.lineWidth = width * 0.28;
  stroke(x, path, -width * 0.18, -width * 0.12, true);
  x.strokeStyle = 'rgba(80,10,10,0.25)'; x.lineWidth = width * 0.2;
  stroke(x, path, width * 0.25, width * 0.2, true);
  if (head && p < 1) {
    x.fillStyle = color; x.beginPath(); x.arc(end.x, end.y, width * 0.62, 0, 7); x.fill();
  }
  x.restore();
}

function stroke(x, path, ox, oy, broken = false) {
  x.beginPath();
  let pen = false;
  for (let i = 0; i < path.length; i++) {
    const [a, b] = path[i];
    if (broken && Math.floor(i / 7) % 3 === 2) { pen = false; continue; }
    if (!pen) { x.moveTo(a + ox, b + oy); pen = true; } else x.lineTo(a + ox, b + oy);
  }
  x.stroke();
}

// ---------------------------------------------------------------- silhouettes
// 剪影小人：脚底在 (0,0)，朝右。phase 控制步态
function limb(x, a, b, w0, w1) {
  const dx = b[0] - a[0], dy = b[1] - a[1], d = Math.hypot(dx, dy) || 1, nx = -dy / d, ny = dx / d;
  x.beginPath();
  x.moveTo(a[0] + nx * w0 / 2, a[1] + ny * w0 / 2); x.lineTo(b[0] + nx * w1 / 2, b[1] + ny * w1 / 2);
  x.arc(b[0], b[1], w1 / 2, Math.atan2(ny, nx), Math.atan2(ny, nx) + Math.PI);
  x.lineTo(a[0] - nx * w0 / 2, a[1] - ny * w0 / 2);
  x.arc(a[0], a[1], w0 / 2, Math.atan2(-ny, -nx), Math.atan2(-ny, -nx) + Math.PI);
  x.fill();
}
const P = (o, ang, len) => [o[0] + Math.sin(ang) * len, o[1] + Math.cos(ang) * len];

export function person(x, { h = 60, phase = 0, pack = true, rifle = false, cap = true, torch = false, lean = 0, color = C.ink, hair = false, run = false, armUp = false } = {}) {
  const s1 = Math.sin(phase), s2 = Math.sin(phase + Math.PI);
  x.save();
  x.rotate((lean * Math.PI) / 180);
  x.fillStyle = color; x.strokeStyle = color; x.lineCap = 'round'; x.lineJoin = 'round';
  const hip = [0, -0.48 * h], sh = [0.03 * h, -0.8 * h];
  const thighSwing = run ? 0.75 : 0.36, bendK = run ? 1.5 : 0.55;
  // legs (far leg first)
  for (const s of [s2, s1]) {
    const ta = s * thighSwing;
    const knee = P(hip, ta, 0.25 * h);
    const shin = ta - (s < 0 ? -s * bendK : 0.08);
    const foot = P(knee, shin, 0.25 * h);
    limb(x, hip, knee, 0.11 * h, 0.08 * h);
    limb(x, knee, foot, 0.08 * h, 0.06 * h);
    x.beginPath(); x.ellipse(foot[0] + 0.035 * h, foot[1] + 0.005 * h, 0.065 * h, 0.03 * h, Math.min(0.4, shin * 0.5), 0, 7); x.fill();
  }
  // torso
  x.beginPath();
  x.moveTo(-0.085 * h, -0.45 * h); x.quadraticCurveTo(0, -0.43 * h, 0.085 * h, -0.46 * h);
  x.lineTo(0.105 * h, -0.79 * h); x.quadraticCurveTo(0.03 * h, -0.85 * h, -0.075 * h, -0.81 * h); x.closePath(); x.fill();
  if (pack) {
    x.beginPath(); roundRect(x, -0.215 * h, -0.8 * h, 0.16 * h, 0.27 * h, 0.035 * h); x.fill();
    if (!hair) { x.beginPath(); x.ellipse(-0.135 * h, -0.83 * h, 0.1 * h, 0.038 * h, 0, 0, 7); x.fill(); }
  }
  if (rifle) { x.lineWidth = 0.025 * h; x.beginPath(); x.moveTo(-0.15 * h, -0.52 * h); x.lineTo(0.12 * h, -1.08 * h); x.stroke(); }
  // arms: upper arm + forearm (bent forward when running)
  const arm = (s, front) => {
    if (front && (torch || armUp)) {
      const el = [sh[0] + 0.12 * h, sh[1] - 0.1 * h], hand = [sh[0] + 0.17 * h, sh[1] - (armUp ? 0.32 : 0.2) * h];
      limb(x, sh, el, 0.07 * h, 0.06 * h); limb(x, el, hand, 0.06 * h, 0.05 * h);
      if (torch) { x.lineWidth = 0.03 * h; x.beginPath(); x.moveTo(hand[0], hand[1] + 0.02 * h); x.lineTo(hand[0] + 0.02 * h, hand[1] - 0.18 * h); x.stroke(); }
      return;
    }
    const ua = -s * (run ? 0.9 : 0.42);
    const el = P(sh, ua, 0.17 * h);
    const fa = ua + (run ? 1.5 : 0.25);
    const hand = P(el, fa, 0.16 * h);
    limb(x, sh, el, 0.07 * h, 0.06 * h); limb(x, el, hand, 0.06 * h, 0.05 * h);
  };
  arm(s1, false); arm(s2, true);
  // neck + head
  limb(x, [0.02 * h, -0.8 * h], [0.035 * h, -0.86 * h], 0.05 * h, 0.05 * h);
  x.beginPath(); x.arc(0.045 * h, -0.925 * h, 0.072 * h, 0, 7); x.fill();
  if (cap) {
    x.beginPath(); x.moveTo(-0.035 * h, -0.93 * h); x.quadraticCurveTo(-0.02 * h, -1.04 * h, 0.075 * h, -1.02 * h);
    x.lineTo(0.145 * h, -0.955 * h); x.lineTo(0.05 * h, -0.95 * h); x.closePath(); x.fill();
  }
  if (hair) { x.beginPath(); x.ellipse(0.025 * h, -0.965 * h, 0.082 * h, 0.05 * h, -0.35, 0, 7); x.fill(); }
  x.restore();
}

export function roundRect(x, a, b, w, h, r) {
  x.moveTo(a + r, b); x.lineTo(a + w - r, b); x.quadraticCurveTo(a + w, b, a + w, b + r); x.lineTo(a + w, b + h - r);
  x.quadraticCurveTo(a + w, b + h, a + w - r, b + h); x.lineTo(a + r, b + h); x.quadraticCurveTo(a, b + h, a, b + h - r);
  x.lineTo(a, b + r); x.quadraticCurveTo(a, b, a + r, b); x.closePath();
}

// gold triangular flame (火苗)
export function flame(x, cx, cy, size, f, id) {
  const r = rand(`${id}:${Math.floor(f / 3)}`);
  const s = 0.9 + r() * 0.2;    // 每 3 帧随机缩放 0.9–1.1
  x.save(); x.translate(cx, cy); x.scale(s, s);
  x.fillStyle = C.gold;
  x.beginPath(); x.moveTo(-size * 0.42, 0); x.lineTo(size * 0.06 * (r() - 0.5), -size * 1.2); x.lineTo(size * 0.42, 0); x.closePath(); x.fill();
  x.fillStyle = '#F6D27A';
  x.beginPath(); x.moveTo(-size * 0.18, 0); x.lineTo(0, -size * 0.6); x.lineTo(size * 0.18, 0); x.closePath(); x.fill();
  x.restore();
}

// five-point star path
export function starPath(x, cx, cy, R, r = R * 0.42, rot = -Math.PI / 2) {
  x.beginPath();
  for (let i = 0; i < 10; i++) {
    const rad = i % 2 ? r : R, a = rot + (i * Math.PI) / 5;
    x[i ? 'lineTo' : 'moveTo'](cx + Math.cos(a) * rad, cy + Math.sin(a) * rad);
  }
  x.closePath();
}

// wavy torn strip (rivers, grass rows): top edge wave, fills down to h
export function waveStrip(x, w, h, amp, freq, seed, jag = 2) {
  const r = rand(seed);
  x.beginPath(); x.moveTo(-4, h);
  for (let px = -4; px <= w + 4; px += 6) {
    x.lineTo(px, amp + Math.sin(px / freq + r() * 0.2 + 1.3) * amp + (r() - 0.5) * jag * 2);
  }
  x.lineTo(w + 4, h); x.closePath();
}

// gear outline
export function gearPath(x, cx, cy, R, teeth = 12, depth = 0.18, hole = 0.35) {
  x.beginPath();
  const n = teeth * 4;
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2, k = i % 4;
    const rad = k === 1 || k === 2 ? R : R * (1 - depth);
    x[i ? 'lineTo' : 'moveTo'](cx + Math.cos(a) * rad, cy + Math.sin(a) * rad);
  }
  x.closePath();
  x.moveTo(cx + R * hole, cy); x.arc(cx, cy, R * hole, 0, Math.PI * 2, true);
}

// off-screen sprite of a silhouette (so it can carry one clean hard shadow)
export function silhouetteSprite(key, w, h, drawFn) {
  return cached(`sil:${key}`, () => {
    const pad = 12, c = createCanvas(Math.round(w + pad * 2), Math.round(h + pad * 2)), x = c.getContext('2d');
    x.translate(pad, pad); drawFn(x, w, h);
    texturize(x, w, h, key, 0.12, 0, 'source-atop');
    return { c, pad, w, h };
  });
}
