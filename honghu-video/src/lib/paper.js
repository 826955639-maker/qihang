// 纸片系统：纸纹、撕边、剪刀边、胶带、印章、硬投影
import { createCanvas } from '../canvas.js';
import { C, W, H } from '../theme.js';
import { rand, hash } from './rng.js';
import { jitter } from './anim.js';

export const STATE = { cam: 1 };      // 当前镜头缩放（投影随之缩放）
const CACHE = new Map();
export function cached(key, make) {
  let v = CACHE.get(key);
  if (!v) { v = make(); CACHE.set(key, v); }
  return v;
}

// ---------------------------------------------------------------- colour utils
export function mix(a, b, t) {
  const pa = hex(a), pb = hex(b);
  return `rgb(${pa.map((v, i) => Math.round(v + (pb[i] - v) * t)).join(',')})`;
}
export function hex(c) {
  if (c.startsWith('rgb')) return c.match(/\d+/g).slice(0, 3).map(Number);
  const h = c.replace('#', '');
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
}
export const rgba = (c, a) => `rgba(${hex(c).join(',')},${a})`;

// ---------------------------------------------------------------- textures
// 纸纤维：细噪点 + 短纤维，可平铺
export function fiberTile() {
  return cached('tex:fiber', () => {
    const S = 512, c = createCanvas(S, S), x = c.getContext('2d');
    const id = x.createImageData(S, S), r = rand('fiber');
    // two-scale grain: per-pixel + 4px blotches
    const coarse = new Float32Array((S / 4) * (S / 4)).map(() => r());
    for (let y = 0; y < S; y++) for (let i = 0; i < S; i++) {
      const v = 214 + r() * 30 + coarse[(y >> 2) * (S / 4) + (i >> 2)] * 12;
      const o = (y * S + i) * 4;
      id.data[o] = v; id.data[o + 1] = v - 3; id.data[o + 2] = v - 8; id.data[o + 3] = 255;
    }
    x.putImageData(id, 0, 0);
    for (let k = 0; k < 1100; k++) {
      const px = r() * S, py = r() * S, len = 6 + r() * 34, a = r() * Math.PI * 2, bend = (r() - 0.5) * 14;
      const dark = r() < 0.7;
      x.strokeStyle = dark ? `rgba(90,70,45,${0.05 + r() * 0.12})` : `rgba(255,255,250,${0.2 + r() * 0.3})`;
      x.lineWidth = 0.4 + r() * 0.9;
      for (const ox of [-S, 0, S]) for (const oy of [-S, 0, S]) {
        x.beginPath();
        x.moveTo(px + ox, py + oy);
        x.quadraticCurveTo(px + ox + Math.cos(a) * len / 2 + bend, py + oy + Math.sin(a) * len / 2 - bend, px + ox + Math.cos(a) * len, py + oy + Math.sin(a) * len);
        x.stroke();
      }
    }
    for (let k = 0; k < 260; k++) { // specks
      x.fillStyle = `rgba(70,50,30,${0.08 + r() * 0.2})`;
      x.beginPath(); x.arc(r() * S, r() * S, 0.4 + r() * 1.1, 0, 7); x.fill();
    }
    return c;
  });
}

// low-frequency mottling (uneven tone of real paper)
export function mottle(w, h, seed, cell = 90) {
  return cached(`tex:mottle:${w}x${h}:${seed}:${cell}`, () => {
    const gw = Math.ceil(w / cell) + 2, gh = Math.ceil(h / cell) + 2, r = rand(seed);
    const small = createCanvas(gw, gh), sx = small.getContext('2d'), id = sx.createImageData(gw, gh);
    for (let i = 0; i < gw * gh; i++) { const v = 200 + r() * 55; id.data.set([v, v - 4, v - 12, 255], i * 4); }
    sx.putImageData(id, 0, 0);
    const c = createCanvas(w, h), x = c.getContext('2d');
    x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high';
    x.drawImage(small, -cell, -cell, gw * cell, gh * cell);
    return c;
  });
}

export function texturize(x, w, h, seed, amount = 0.35, mot = 0.25, op = 'multiply') {
  const r = rand(seed + ':tx');
  x.save();
  x.globalCompositeOperation = op;
  x.globalAlpha = amount;
  const pat = x.createPattern(fiberTile(), 'repeat');
  x.translate(-r() * 512, -r() * 512);
  x.fillStyle = pat; x.fillRect(0, 0, w + 1024, h + 1024);
  x.restore();
  if (mot > 0 && w * h > 20000) {
    x.save(); x.globalCompositeOperation = 'multiply'; x.globalAlpha = mot;
    x.drawImage(mottle(Math.ceil(w), Math.ceil(h), hash(seed) % 7, Math.max(40, Math.min(w, h) / 4)), 0, 0);
    x.restore();
  }
}

// ---------------------------------------------------------------- edges
// 撕边：每 8–12px 一个顶点，向内外随机偏移 2–5px；剪刀边：直线 + 轻微角度
export function edgePoly(w, h, seed, edge = 'torn', amp = 1) {
  const r = rand(seed);
  const cj = edge === 'cut' ? 5 : 3;
  const corners = [[0, 0], [w, 0], [w, h], [0, h]].map(([x, y]) => [x + (r() - 0.5) * cj, y + (r() - 0.5) * cj]);
  const pts = [];
  for (let s = 0; s < 4; s++) {
    const a = corners[s], b = corners[(s + 1) % 4];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const ux = (b[0] - a[0]) / len, uy = (b[1] - a[1]) / len, nx = uy, ny = -ux;
    pts.push(a);
    if (edge === 'cut') {
      // scissors: one or two tiny direction changes per side
      const kinks = len > 160 ? 1 + Math.floor(r() * 2) : 0;
      for (let k = 1; k <= kinks; k++) {
        const t = k / (kinks + 1) + (r() - 0.5) * 0.1, o = (r() - 0.5) * 2.2;
        pts.push([a[0] + ux * len * t + nx * o, a[1] + uy * len * t + ny * o]);
      }
      continue;
    }
    const p1 = r() * 6.28, p2 = r() * 6.28;
    let d = 8 + r() * 4;
    while (d < len - 6) {
      const wander = 2.6 * Math.sin(d / 41 + p1) + 1.6 * Math.sin(d / 15 + p2);
      const jag = (r() < 0.5 ? -1 : 1) * (2 + r() * 3) * 0.75;
      const o = (wander + jag) * amp;
      pts.push([a[0] + ux * d + nx * o, a[1] + uy * d + ny * o]);
      d += 8 + r() * 4;
    }
  }
  return pts;
}

export function polyPath(x, pts) {
  x.beginPath();
  x.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) x.lineTo(pts[i][0], pts[i][1]);
  x.closePath();
}

// ---------------------------------------------------------------- sprites
// A sprite = { c: canvas, pad, w, h }  (content box w×h, canvas has `pad` margin all round)
export function piece({ key, w, h, color = C.paper, seed = key, edge = 'torn', tex = 0.32, mot = 0.22, rim = true, draw = null, pad = 14, rimColor = null, res = 1 }) {
  return cached(`piece:${key}`, () => {
    w = Math.round(w); h = Math.round(h);
    const c = createCanvas(Math.round((w + pad * 2) * res), Math.round((h + pad * 2) * res)), x = c.getContext('2d');
    x.scale(res, res);
    x.translate(pad, pad);
    const inner = edgePoly(w, h, seed, edge);
    if (edge === 'torn' && rim) {
      // the white fibrous core that shows along a tear
      const outer = edgePoly(w, h, seed + ':rim', 'torn', 1.25).map(([px, py]) => [
        px + (px < w / 2 ? -2.2 : 2.2), py + (py < h / 2 ? -2.2 : 2.2)]);
      x.fillStyle = rimColor || mix(color, '#FBF8F1', 0.78);
      polyPath(x, outer); x.fill();
      x.save(); polyPath(x, outer); x.clip(); texturize(x, w, h, seed + 'r', 0.18, 0); x.restore();
    }
    x.save();
    polyPath(x, inner); x.clip();
    x.fillStyle = color; x.fillRect(-pad, -pad, w + pad * 2, h + pad * 2);
    texturize(x, w, h, seed, tex, mot);
    if (draw) { x.save(); draw(x, w, h); x.restore(); }
    x.restore();
    return { c, pad, w, h, res };
  });
}

// free-form cut-paper shape: draw(x) builds a path in a w×h box; filled with colour + texture
export function cutout({ key, w, h, color, path, tex = 0.3, draw = null, pad = 10, stroke = null }) {
  return cached(`cut:${key}`, () => {
    w = Math.round(w); h = Math.round(h);
    const c = createCanvas(w + pad * 2, h + pad * 2), x = c.getContext('2d');
    x.translate(pad, pad);
    x.save();
    path(x, w, h); x.clip();
    x.fillStyle = color; x.fillRect(-pad, -pad, w + 2 * pad, h + 2 * pad);
    texturize(x, w, h, key, tex, 0.15);
    if (draw) draw(x, w, h);
    x.restore();
    if (stroke) { path(x, w, h); x.strokeStyle = stroke[0]; x.lineWidth = stroke[1]; x.stroke(); }
    return { c, pad, w, h };
  });
}

// 半透明胶带：#F3E3A0 60%，两端锯齿撕边
export function tape(w = 120, h = 34, seed = 't') {
  return cached(`tape:${w}:${h}:${seed}`, () => {
    const pad = 4, c = createCanvas(w + pad * 2, h + pad * 2), x = c.getContext('2d'), r = rand(seed);
    x.translate(pad, pad);
    const pts = [];
    for (let y = 0; y <= h; y += 4) pts.push([(r() - 0.2) * 4, y]);
    for (let y = h; y >= 0; y -= 4) pts.push([w - (r() - 0.2) * 4, y]);
    x.globalAlpha = 0.62;
    x.fillStyle = C.tape;
    x.beginPath(); pts.forEach(([a, b], i) => (i ? x.lineTo(a, b) : x.moveTo(a, b))); x.closePath(); x.fill();
    x.save(); x.clip();
    x.globalAlpha = 0.18; x.fillStyle = '#fff'; x.fillRect(0, 3, w, 3);
    x.globalAlpha = 0.08; x.fillStyle = '#8a7a40'; x.fillRect(0, h - 4, w, 4);
    x.restore();
    return { c, pad, w, h };
  });
}

// 印章字：red 思源宋体 + 4px 不规则方框 + 缺墨
export function stampSprite(text, px = 96, { seed = text, color = C.red, box = true, font = 'SerifB', padX = 0.32, padY = 0.2, lines = null } = {}) {
  return cached(`stamp:${text}:${px}:${color}:${box}:${font}`, () => {
    const meas = createCanvas(10, 10).getContext('2d');
    meas.font = `${px}px ${font}`;
    const rows = lines || [text];
    const tw = Math.max(...rows.map((t) => meas.measureText(t).width));
    const lh = px * 1.15;
    const w = Math.round(tw + px * padX * 2), h = Math.round(lh * rows.length + px * padY * 2 - (lh - px) );
    const pad = 12, c = createCanvas(w + pad * 2, h + pad * 2), x = c.getContext('2d'), r = rand(seed);
    x.translate(pad, pad);
    x.fillStyle = color; x.strokeStyle = color;
    x.font = `${px}px ${font}`; x.textBaseline = 'middle'; x.textAlign = 'center';
    rows.forEach((t, i) => x.fillText(t, w / 2, px * padY + px / 2 + i * lh + px * 0.04));
    if (box) {
      for (let pass = 0; pass < 2; pass++) {
        x.lineWidth = pass ? 1.6 : 4.2;
        const q = [[3, 3], [w - 3, 3], [w - 3, h - 3], [3, h - 3]].map(([a, b]) => [a + (r() - 0.5) * 4, b + (r() - 0.5) * 4]);
        x.beginPath();
        for (let s = 0; s < 4; s++) {
          const a = q[s], b = q[(s + 1) % 4];
          if (!s) x.moveTo(a[0], a[1]);
          const mx = (a[0] + b[0]) / 2 + (r() - 0.5) * 3, my = (a[1] + b[1]) / 2 + (r() - 0.5) * 3;
          x.quadraticCurveTo(mx, my, b[0], b[1]);
        }
        x.closePath(); x.stroke();
      }
    }
    // worn ink: knock out specks and a few dry streaks
    x.globalCompositeOperation = 'destination-out';
    const n = Math.round((w * h) / 90);
    for (let i = 0; i < n; i++) {
      x.globalAlpha = 0.25 + r() * 0.75;
      x.beginPath(); x.arc(r() * w, r() * h, 0.4 + r() * 1.6, 0, 7); x.fill();
    }
    for (let i = 0; i < 5; i++) {
      x.globalAlpha = 0.18 + r() * 0.2; x.lineWidth = 1 + r() * 2.5;
      const y0 = r() * h; x.beginPath(); x.moveTo(r() * w * 0.3, y0); x.lineTo(w * (0.5 + r() * 0.5), y0 + (r() - 0.5) * 10); x.stroke();
    }
    x.globalAlpha = 1; x.globalCompositeOperation = 'source-over';
    texturize(x, w, h, seed, 0.2, 0, 'source-atop');
    return { c, pad, w, h };
  });
}

// 文字纸条（撕边或剪刀边）
export function textStrip(text, { font, px, color = C.ink, bg = C.paper, padX = 0.6, padY = 0.32, edge = 'torn', seed = text, minW = 0, align = 'center', lines = null, lineH = 1.3 } = {}) {
  return cached(`strip:${text}:${font}:${px}:${color}:${bg}:${edge}:${minW}`, () => {
    const meas = createCanvas(10, 10).getContext('2d');
    meas.font = `${px}px ${font}`;
    const rows = lines || [text];
    const tw = Math.max(...rows.map((t) => meas.measureText(t).width));
    const w = Math.max(minW, tw + px * padX * 2), h = px * lineH * rows.length + px * padY * 2 - px * (lineH - 1);
    return piece({
      key: `strip:${text}:${font}:${px}:${bg}:${edge}:${minW}`, w, h, color: bg, edge, seed,
      draw: (x) => {
        x.font = `${px}px ${font}`; x.fillStyle = color; x.textBaseline = 'middle';
        x.textAlign = align;
        const ax = align === 'center' ? w / 2 : px * padX;
        rows.forEach((t, i) => x.fillText(t, ax, px * padY + px / 2 + i * px * lineH + px * 0.05));
      },
    });
  });
}

// ---------------------------------------------------------------- placement
function autoAmp(spr) {
  const m = Math.max(spr.w, spr.h);
  return Math.min(1, 240 / m);
}

// place a sprite: anchor (ax, ay) in content box, rotation in degrees, hard shadow 6/8px
export function place(x, spr, px, py, o = {}) {
  const { rot = 0, s = 1, alpha = 1, ax = 0.5, ay = 0.5, shadow = 1, jit = null, f = 0, flip = false, lift = 1 } = o;
  if (alpha <= 0 || s <= 0) return;
  x.save();
  let dx = 0, dy = 0, dr = 0;
  if (jit) { const j = jitter(jit, f, o.jamp ?? autoAmp(spr) * s); dx = j.dx; dy = j.dy; dr = j.rot; }
  x.translate(px + dx, py + dy);
  x.rotate((rot * Math.PI) / 180 + dr);
  x.scale(flip ? -s : s, s);
  if (alpha < 1) x.globalAlpha = alpha;
  if (shadow) {
    const k = shadow * lift * STATE.cam;
    x.shadowColor = o.shadowColor || C.shadow; x.shadowOffsetX = 6 * k; x.shadowOffsetY = 8 * k; x.shadowBlur = 0;
  }
  const res = spr.res || 1;
  if (res === 1) x.drawImage(spr.c, -spr.pad - ax * spr.w, -spr.pad - ay * spr.h);
  else x.drawImage(spr.c, -spr.pad - ax * spr.w, -spr.pad - ay * spr.h, spr.c.width / res, spr.c.height / res);
  if (o.overlay) {
    // animated content living on the paper (same transform + jitter as the sprite)
    x.shadowColor = 'transparent';
    x.translate(-ax * spr.w, -ay * spr.h);
    x.beginPath(); x.rect(5, 5, spr.w - 10, spr.h - 10); x.clip();
    o.overlay(x, spr.w, spr.h);
  }
  x.restore();
}

// full-frame paper background (PaperBG)
export function paperBG(color = C.kraft, seed = 'bg', tex = 0.42, w = W, h = H) {
  return cached(`bg:${color}:${seed}:${w}x${h}`, () => {
    const c = createCanvas(w, h), x = c.getContext('2d');
    x.fillStyle = color; x.fillRect(0, 0, w, h);
    texturize(x, w, h, seed, tex, 0.0);
    x.save(); x.globalCompositeOperation = 'multiply'; x.globalAlpha = 0.3;
    x.drawImage(mottle(w, h, hash(seed) % 11, 160), 0, 0); x.restore();
    return { c, pad: 0, w, h };
  });
}
