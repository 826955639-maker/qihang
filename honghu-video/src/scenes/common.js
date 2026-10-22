// 跨场景复用的纸面绘制：旧地图纹样、老照片框、口述卡片
import { C, F } from '../theme.js';
import { rand } from '../lib/rng.js';
import { piece, tape, place, cached, mix } from '../lib/paper.js';
import { createCanvas } from '../canvas.js';
import { drop } from '../lib/kit.js';
import { clamp } from '../lib/anim.js';

// faint hand-drawn geography: graticule, rivers, mountain hachures, coffee ring, folds
export function mapArt(x, w, h, seed, k = 1) {
  const r = rand(seed);
  x.save();
  // graticule
  x.strokeStyle = 'rgba(60,50,40,0.13)'; x.lineWidth = 1 * k;
  for (let gx = 60 * k; gx < w; gx += 120 * k) { x.beginPath(); x.moveTo(gx, 0); x.lineTo(gx + 8 * k, h); x.stroke(); }
  for (let gy = 50 * k; gy < h; gy += 110 * k) { x.beginPath(); x.moveTo(0, gy); x.lineTo(w, gy - 6 * k); x.stroke(); }
  // rivers
  for (let i = 0; i < 5; i++) {
    x.strokeStyle = `rgba(63,110,140,${0.35 + r() * 0.2})`; x.lineWidth = (1.2 + r() * 1.4) * k;
    let px = r() * w, py = -10, a = Math.PI / 2 + (r() - 0.5);
    x.beginPath(); x.moveTo(px, py);
    while (py < h + 10 && px > -10 && px < w + 10) {
      a += (r() - 0.5) * 0.7; a = clamp(a, 0.3, 2.8);
      px += Math.cos(a) * 14 * k; py += Math.sin(a) * 14 * k; x.lineTo(px, py);
    }
    x.stroke();
  }
  // mountain hachures (little ^ clusters)
  x.strokeStyle = 'rgba(50,40,30,0.38)'; x.lineWidth = 1.1 * k;
  for (let i = 0; i < 26; i++) {
    const cx = r() * w, cy = r() * h, n = 2 + Math.floor(r() * 4), s = (7 + r() * 9) * k;
    for (let j = 0; j < n; j++) {
      const ox = cx + j * s * 1.1, oy = cy + (r() - 0.5) * s * 0.6;
      x.beginPath(); x.moveTo(ox - s, oy + s * 0.5); x.lineTo(ox, oy - s * 0.6); x.lineTo(ox + s, oy + s * 0.5); x.stroke();
      for (let t = 1; t < 3; t++) { x.beginPath(); x.moveTo(ox + s * 0.2 * t, oy - s * 0.4 + s * 0.3 * t); x.lineTo(ox + s * 0.35 * t, oy + s * 0.3); x.stroke(); }
    }
  }
  // dotted border lines
  x.setLineDash([3 * k, 6 * k]); x.strokeStyle = 'rgba(60,40,30,0.28)'; x.lineWidth = 1.4 * k;
  for (let i = 0; i < 3; i++) {
    x.beginPath(); let px = r() * w, py = r() * h; x.moveTo(px, py);
    for (let j = 0; j < 9; j++) { px += (r() - 0.3) * 90 * k; py += (r() - 0.5) * 70 * k; x.lineTo(px, py); }
    x.stroke();
  }
  x.setLineDash([]);
  // coffee ring
  x.strokeStyle = 'rgba(120,80,40,0.10)'; x.lineWidth = 6 * k;
  const rx = w * (0.7 + r() * 0.2), ry = h * (0.15 + r() * 0.2);
  x.beginPath(); x.arc(rx, ry, 46 * k, 0.3, 5.6); x.stroke();
  // folds
  x.strokeStyle = 'rgba(255,255,255,0.35)'; x.lineWidth = 2 * k;
  x.beginPath(); x.moveTo(w / 2 + 3 * k, 0); x.lineTo(w / 2 - 2 * k, h); x.stroke();
  x.strokeStyle = 'rgba(80,60,40,0.14)'; x.lineWidth = 1.5 * k;
  x.beginPath(); x.moveTo(w / 2, 0); x.lineTo(w / 2 - 5 * k, h); x.stroke();
  x.beginPath(); x.moveTo(0, h / 2); x.lineTo(w, h / 2 + 4 * k); x.stroke();
  x.restore();
}

// compass rose
export function compass(x, cx, cy, R) {
  x.save(); x.translate(cx, cy);
  x.strokeStyle = 'rgba(40,30,25,0.55)'; x.fillStyle = 'rgba(40,30,25,0.55)'; x.lineWidth = 1.2;
  x.beginPath(); x.arc(0, 0, R, 0, 7); x.stroke();
  for (let i = 0; i < 4; i++) {
    x.rotate(Math.PI / 2);
    x.beginPath(); x.moveTo(0, -R * 1.25); x.lineTo(R * 0.18, 0); x.lineTo(-R * 0.18, 0); x.closePath();
    i % 2 ? x.stroke() : x.fill();
  }
  x.font = `${Math.round(R * 0.55)}px SerifB`; x.textAlign = 'center'; x.fillText('北', 0, -R * 1.35);
  x.restore();
}

// 老照片：白边 + 画面 + 胶带
export function photo(key, w, h, scene, { border = 16, bottom = 46, tint = 0 } = {}) {
  return piece({
    key: `photo:${key}`, w: w + border * 2, h: h + border + bottom, color: '#F1EADB', edge: 'cut', seed: key,
    draw: (x) => {
      x.save(); x.beginPath(); x.rect(border, border, w, h); x.clip();
      x.translate(border, border); scene(x, w, h);
      // age: warm wash + scratches
      x.globalCompositeOperation = 'multiply'; x.fillStyle = `rgba(214,190,150,${0.35 + tint})`; x.fillRect(0, 0, w, h);
      x.globalCompositeOperation = 'source-over';
      const r = rand(key + 'scr'); x.strokeStyle = 'rgba(255,250,235,0.35)'; x.lineWidth = 0.8;
      for (let i = 0; i < 7; i++) { const a = r() * w; x.beginPath(); x.moveTo(a, 0); x.lineTo(a + (r() - 0.5) * 30, h); x.stroke(); }
      x.restore();
      x.strokeStyle = 'rgba(60,40,20,0.25)'; x.lineWidth = 1; x.strokeRect(border, border, w, h);
    },
  });
}

// 口述卡片：白色撕纸 + 胶带 + 马善政 64px
export function quoteCard(id, text) {
  const [a, b] = text.split('，');
  const lines = [a + '，', b];
  return cached(`card:${id}`, () => {
    const m = createCanvas(10, 10).getContext('2d'); m.font = F.hand(64);
    const tw = Math.max(...lines.map((t) => m.measureText(t).width));
    const w = Math.round(tw + 120), h = 64 * 1.45 * 2 + 150;
    return piece({
      key: `card:${id}`, w, h, color: '#FBF8F2', seed: id,
      draw: (x) => {
        // faint ruled lines like a notebook leaf
        x.strokeStyle = 'rgba(63,110,140,0.16)'; x.lineWidth = 1.2;
        for (let y = 62; y < h - 20; y += 64 * 1.45) { x.beginPath(); x.moveTo(30, y + 52); x.lineTo(w - 30, y + 52); x.stroke(); }
        x.font = F.hand(64); x.fillStyle = C.ink; x.textBaseline = 'alphabetic';
        x.fillText(lines[0], 56, 104);
        x.fillText(lines[1], 56 + 64, 104 + 64 * 1.45);
        x.font = F.serif(26); x.fillStyle = 'rgba(31,27,24,0.7)'; x.textAlign = 'right';
        x.fillText('—— 一位工大学子', w - 50, h - 34);
      },
    });
  });
}

export function drawCard(x, f, card, id, px, py, rot = -2) {
  if (f < card.a || f > card.b + 12) return;
  const spr = quoteCard(id, card.text);
  drop(x, f, spr, px, py, card.a, { id: `card${id}`, rot, out: card.b, jamp: 0.25 });
  if (f < card.b) {
    // tape follows the card
    const t = tape(150, 36, id + 't');
    const d = Math.min(1, (f - card.a) / 12);
    if (d >= 1) {
      place(x, t, px - spr.w / 2 + 40, py - spr.h / 2 + 6, { rot: rot - 28, shadow: 0.25, jit: `tp${id}`, f });
      place(x, t, px + spr.w / 2 - 40, py - spr.h / 2 + 6, { rot: rot + 24, shadow: 0.25, jit: `tq${id}`, f });
    }
  }
}

export { mix };
