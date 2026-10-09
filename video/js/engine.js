// 手绘引擎：把"完美"的几何图形变成手画的样子。
// 每一笔都按种子抖动；种子每秒换 8 次 → "线条沸腾"（boiling lines）。
// 打开 K.xray（透视）时，每一笔都会露出它的控制点和"源代码"。
(function () {
  const K = (window.K = {});
  const TAU = Math.PI * 2;
  const W = (K.W = 1920), H = (K.H = 1080);

  K.C = {
    ink: '#2d2a32', paper: '#fbf5e6', orange: '#f0885a', yellow: '#f6c945', blue: '#5aa9e6',
    green: '#7bc96f', pink: '#f49ac1', red: '#e5534b', purple: '#9b7fe0', gray: '#a7a9ac',
    cream: '#fffaf0', brown: '#a8754f', sky: '#d6ecfa', xray: '#18c8d8'
  };
  K.FONT = '"KuaiLe", "PingFang SC", "Microsoft YaHei", "WenQuanYi Zen Hei", sans-serif';
  K.MONO = '"SFMono-Regular", Menlo, Consolas, "DejaVu Sans Mono", monospace';

  // ---------- 小工具 ----------
  K.clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
  K.lerp = (a, b, u) => a + (b - a) * u;
  K.prog = (t, start, dur) => K.clamp((t - start) / dur);
  K.ease = {
    out: (u) => 1 - Math.pow(1 - u, 3),
    in: (u) => u * u * u,
    inOut: (u) => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2),
    back: (u) => { const c = 1.9; return 1 + (c + 1) * Math.pow(u - 1, 3) + c * Math.pow(u - 1, 2); },
    elastic: (u) => (u === 0 || u === 1 ? u : Math.pow(2, -10 * u) * Math.sin((u * 10 - 0.75) * (TAU / 3)) + 1)
  };
  // 弹出：0 → 1，带一点回弹
  K.pop = (t, start, dur = 0.5) => K.ease.back(K.prog(t, start, dur));

  // ---------- 随机数（可复现） ----------
  function hash(n) {
    n = (n ^ 61) ^ (n >>> 16); n = (n + (n << 3)) | 0; n ^= n >>> 4;
    n = Math.imul(n, 0x27d4eb2d); n ^= n >>> 15; return n >>> 0;
  }
  function rng(seed) {
    let s = hash(seed | 0) || 1;
    return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
  }
  K.rng = rng;

  let boil = 0, counter = 0, labels = 0;
  K.xray = false;
  K.boilOn = true;
  K.beginFrame = (t) => { boil = Math.floor(t * 8); counter = 0; labels = 0; };
  K.boilIndex = () => boil;
  K.seed = (n) => { counter = n * 1000; };
  function shapeRng(o) {
    const id = o.seed != null ? o.seed : ++counter;
    const b = o.still || !K.boilOn ? 0 : boil;
    return rng(id * 7919 + b * 104729 + 17);
  }

  // ---------- 生成"手抖"的点 ----------
  function linePts(x1, y1, x2, y2, r, R) {
    const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len, ny = dx / len;
    const j = () => (R() - 0.5) * 3 * r;
    const bow = (R() - 0.5) * Math.min(len * 0.05, 14) * r;
    const over = (R() * 0.04 + 0.01) * r;
    const sx = x1 - dx * over + j(), sy = y1 - dy * over + j();
    const ex = x2 + dx * over * 0.5 + j(), ey = y2 + dy * over * 0.5 + j();
    const n = Math.max(3, Math.ceil(len / 24)), pts = [];
    for (let i = 0; i <= n; i++) {
      const u = i / n, b = bow * 4 * u * (1 - u);
      pts.push([K.lerp(sx, ex, u) + nx * b, K.lerp(sy, ey, u) + ny * b]);
    }
    return pts;
  }
  function ellPts(cx, cy, rx, ry, r, R, closed) {
    const n = Math.max(16, Math.ceil((rx + ry) * 0.22));
    const a0 = R() * TAU, over = closed ? 0 : 0.18 + R() * 0.25;
    const k1 = (R() - 0.5) * 0.07 * r, k2 = (R() - 0.5) * 0.04 * r, p1 = R() * TAU, p2 = R() * TAU;
    const pts = [];
    for (let i = 0; i <= n; i++) {
      const a = a0 + ((TAU + over) * i) / n;
      const m = 1 + k1 * Math.sin(a * 2 + p1) + k2 * Math.sin(a * 3 + p2) + (closed ? 0 : (i / n) * 0.03 * r);
      pts.push([cx + Math.cos(a) * rx * m, cy + Math.sin(a) * ry * m]);
    }
    return pts;
  }
  // 任意点列加低频抖动
  function wobble(pts, r, R, closed) {
    const p1 = R() * TAU, p2 = R() * TAU, a1 = (R() - 0.5) * 5 * r, a2 = (R() - 0.5) * 3 * r;
    const out = [];
    let L = 0;
    for (let i = 0; i < pts.length; i++) {
      if (i) L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
      const d1 = a1 * Math.sin(L / 90 + p1), d2 = a2 * Math.cos(L / 55 + p2);
      out.push([pts[i][0] + d1, pts[i][1] + d2]);
    }
    if (closed && out.length) out.push(out[0].slice());
    return out;
  }
  // Catmull-Rom 平滑曲线
  function spline(pts, seg = 8) {
    if (pts.length < 3) return pts;
    const out = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
      for (let s = 0; s < seg; s++) {
        const u = s / seg, u2 = u * u, u3 = u2 * u;
        out.push([0, 1].map((k) => 0.5 * (2 * p1[k] + (-p0[k] + p2[k]) * u + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * u2 + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * u3)));
      }
    }
    out.push(pts[pts.length - 1]);
    return out;
  }
  K.spline = spline;

  // ---------- 画笔 ----------
  function trace(ctx, pts) {
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length - 1; i++) {
      const mx = (pts[i][0] + pts[i + 1][0]) / 2, my = (pts[i][1] + pts[i + 1][1]) / 2;
      ctx.quadraticCurveTo(pts[i][0], pts[i][1], mx, my);
    }
    const l = pts[pts.length - 1];
    ctx.lineTo(l[0], l[1]);
  }
  function cut(strokes, p) {
    if (p >= 1) return strokes;
    let total = 0;
    const lens = strokes.map((s) => { let l = 0; for (let i = 1; i < s.length; i++) l += Math.hypot(s[i][0] - s[i - 1][0], s[i][1] - s[i - 1][1]); total += l; return l; });
    let left = total * p;
    const out = [];
    for (let k = 0; k < strokes.length && left > 0; k++) {
      const s = strokes[k];
      if (lens[k] <= left) { out.push(s); left -= lens[k]; continue; }
      const part = [s[0]];
      for (let i = 1; i < s.length && left > 0; i++) {
        const d = Math.hypot(s[i][0] - s[i - 1][0], s[i][1] - s[i - 1][1]);
        if (d <= left) { part.push(s[i]); left -= d; }
        else { const u = left / d; part.push([K.lerp(s[i - 1][0], s[i][0], u), K.lerp(s[i - 1][1], s[i][1], u)]); left = 0; }
      }
      if (part.length > 1) out.push(part);
    }
    return out;
  }
  function bbox(strokes) {
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const s of strokes) for (const [x, y] of s) { if (x < x0) x0 = x; if (y < y0) y0 = y; if (x > x1) x1 = x; if (y > y1) y1 = y; }
    return [x0, y0, x1, y1];
  }

  // 统一的绘制出口：填充 → 描边 → （透视）控制点和标签
  function render(ctx, strokes, fillPts, o, R, label) {
    const p = o.p == null ? 1 : o.p;
    if (p <= 0) return;
    ctx.save();
    if (o.alpha != null) ctx.globalAlpha *= o.alpha;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    if (o.fill && fillPts && p > 0.02) {
      ctx.save();
      ctx.globalAlpha *= K.clamp(p * 1.6) * (o.fillAlpha == null ? 1 : o.fillAlpha);
      if (o.hachure) {
        ctx.beginPath(); trace(ctx, fillPts); ctx.closePath(); ctx.clip();
        const [x0, y0, x1, y1] = bbox([fillPts]);
        const gap = o.gap || 12, h = y1 - y0;
        ctx.strokeStyle = o.fill; ctx.lineWidth = o.hachureWidth || 3;
        ctx.beginPath();
        for (let x = x0 - h; x < x1 + gap; x += gap) {
          const a = linePts(x, y1 + 4, x + h, y0 - 4, 0.6, R);
          trace(ctx, a);
        }
        ctx.stroke();
      } else {
        ctx.fillStyle = o.fill;
        ctx.beginPath(); trace(ctx, fillPts); ctx.closePath(); ctx.fill();
      }
      ctx.restore();
    }
    const drawn = cut(strokes, p);
    if (o.stroke !== null && o.width !== 0) {
      ctx.strokeStyle = o.stroke || K.C.ink;
      ctx.lineWidth = o.width || 4;
      ctx.beginPath();
      for (const s of drawn) if (s.length > 1) trace(ctx, s);
      ctx.stroke();
    }
    ctx.restore();
    if (K.xray && !o.noXray) xrayMark(ctx, drawn, label || o.label);
  }

  function xrayMark(ctx, strokes, label) {
    ctx.save();
    ctx.globalAlpha = 0.9;
    ctx.strokeStyle = K.C.xray; ctx.fillStyle = K.C.xray; ctx.lineWidth = 1.2;
    ctx.beginPath();
    for (const s of strokes) { ctx.moveTo(s[0][0], s[0][1]); for (const q of s) ctx.lineTo(q[0], q[1]); }
    ctx.stroke();
    for (const s of strokes) for (let i = 0; i < s.length; i += 2) { ctx.beginPath(); ctx.arc(s[i][0], s[i][1], 3, 0, TAU); ctx.fill(); }
    const [x0, y0, x1, y1] = bbox(strokes);
    if (label && labels < 28 && (x1 - x0 > 50 || y1 - y0 > 50)) {
      labels++;
      ctx.font = '600 17px ' + K.MONO;
      const w = ctx.measureText(label).width + 12;
      ctx.fillStyle = 'rgba(10,40,60,0.82)';
      ctx.fillRect(x0, y0 - 26, w, 24);
      ctx.fillStyle = '#9ff4ff';
      ctx.fillText(label, x0 + 6, y0 - 8);
    }
    ctx.restore();
  }

  const r0 = (o) => (o.rough == null ? 1 : o.rough);
  const f0 = (n) => Math.round(n);

  K.line = (ctx, x1, y1, x2, y2, o = {}) => {
    const R = shapeRng(o), r = r0(o);
    const s = [linePts(x1, y1, x2, y2, r, R)];
    if (o.double !== false) s.push(linePts(x1, y1, x2, y2, r * 0.8, R));
    render(ctx, s, null, o, R, `line(${f0(x1)}, ${f0(y1)} → ${f0(x2)}, ${f0(y2)})`);
  };
  K.ellipse = (ctx, cx, cy, rx, ry, o = {}) => {
    const R = shapeRng(o), r = r0(o);
    const fill = o.fill ? ellPts(cx + (R() - 0.5) * 4 * r, cy + (R() - 0.5) * 4 * r, rx, ry, r * 0.7, R, true) : null;
    const s = [ellPts(cx, cy, rx, ry, r, R, false)];
    render(ctx, s, fill, o, R, rx === ry ? `circle(${f0(cx)}, ${f0(cy)}, r=${f0(rx)})` : `ellipse(${f0(cx)}, ${f0(cy)}, ${f0(rx)}×${f0(ry)})`);
  };
  K.circle = (ctx, cx, cy, rad, o = {}) => K.ellipse(ctx, cx, cy, rad, rad, o);
  K.poly = (ctx, pts, o = {}) => {
    const R = shapeRng(o), r = r0(o), s = [];
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length];
      s.push(linePts(a[0], a[1], b[0], b[1], r, R));
    }
    let fill = null;
    if (o.fill) { // 先加密采样，否则平滑后角会被磨圆
      const dense = [];
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i], b = pts[(i + 1) % pts.length], n = Math.max(2, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 25));
        for (let k = 0; k < n; k++) dense.push([K.lerp(a[0], b[0], k / n), K.lerp(a[1], b[1], k / n)]);
        dense.push(b.slice()); dense.push(b.slice());
      }
      fill = wobble(dense, r * 0.4, R, false);
    }
    render(ctx, s, fill, o, R, o.label || `polygon(${pts.length} 个点)`);
  };
  K.rect = (ctx, x, y, w, h, o = {}) => {
    if (o.radius) {
      const rr = Math.min(o.radius, w / 2, h / 2), pts = [];
      const corner = (cx, cy, a0) => { for (let i = 0; i <= 6; i++) { const a = a0 + (i / 6) * (Math.PI / 2); pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]); } };
      corner(x + w - rr, y + rr, -Math.PI / 2); corner(x + w - rr, y + h - rr, 0);
      corner(x + rr, y + h - rr, Math.PI / 2); corner(x + rr, y + rr, Math.PI);
      return K.shape(ctx, pts, Object.assign({ closed: true, label: `roundRect(${f0(x)}, ${f0(y)}, ${f0(w)}×${f0(h)})` }, o));
    }
    K.poly(ctx, [[x, y], [x + w, y], [x + w, y + h], [x, y + h]], Object.assign({ label: `rect(${f0(x)}, ${f0(y)}, ${f0(w)}×${f0(h)})` }, o));
  };
  // 任意形状（点列），closed 时闭合；smooth 时先过一遍样条
  K.shape = (ctx, pts, o = {}) => {
    const R = shapeRng(o), r = r0(o);
    let base = o.smooth ? spline(o.closed ? pts.concat([pts[0]]) : pts) : o.closed ? pts.concat([pts[0]]) : pts;
    // 加密采样，抖动才自然
    const dense = [base[0]];
    for (let i = 1; i < base.length; i++) {
      const a = base[i - 1], b = base[i], n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 20));
      for (let k = 1; k <= n; k++) dense.push([K.lerp(a[0], b[0], k / n), K.lerp(a[1], b[1], k / n)]);
    }
    const s = [wobble(dense, r, R, false)];
    if (o.double) s.push(wobble(dense, r * 0.8, R, false));
    const fill = o.fill ? wobble(dense, r * 0.5, R, false) : null;
    render(ctx, s, fill, o, R, o.label || `curve(${pts.length} 个点)`);
  };
  K.curve = (ctx, pts, o = {}) => K.shape(ctx, pts, Object.assign({ smooth: true }, o));
  K.arrow = (ctx, x1, y1, x2, y2, o = {}) => {
    const p = o.p == null ? 1 : o.p;
    const ex = K.lerp(x1, x2, p), ey = K.lerp(y1, y2, p);
    if (p <= 0) return;
    K.line(ctx, x1, y1, ex, ey, Object.assign({}, o, { p: 1, label: o.label || `arrow(→)` }));
    const a = Math.atan2(y2 - y1, x2 - x1), hl = o.head || 26;
    K.line(ctx, ex, ey, ex - Math.cos(a - 0.45) * hl, ey - Math.sin(a - 0.45) * hl, Object.assign({}, o, { p: 1, noXray: true }));
    K.line(ctx, ex, ey, ex - Math.cos(a + 0.45) * hl, ey - Math.sin(a + 0.45) * hl, Object.assign({}, o, { p: 1, noXray: true }));
  };
  // 五角星 / 闪光
  K.star = (ctx, cx, cy, rad, o = {}) => {
    const n = o.points || 5, inner = o.inner || 0.45, pts = [];
    for (let i = 0; i < n * 2; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / n + (o.rot || 0), rr = i % 2 ? rad * inner : rad;
      pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]);
    }
    K.poly(ctx, pts, Object.assign({ label: `star(${f0(cx)}, ${f0(cy)})` }, o));
  };
  K.sparkle = (ctx, cx, cy, rad, o = {}) => K.star(ctx, cx, cy, rad, Object.assign({ points: 4, inner: 0.28, fill: K.C.yellow, width: 3 }, o));

  // 打勾 / 打叉
  K.check = (ctx, x, y, s, o = {}) => {
    K.shape(ctx, [[x - s * 0.5, y], [x - s * 0.12, y + s * 0.4], [x + s * 0.55, y - s * 0.45]], Object.assign({ stroke: K.C.green, width: s * 0.16, label: 'check ✓' }, o));
  };
  K.cross = (ctx, x, y, s, o = {}) => {
    const p = o.p == null ? 1 : o.p;
    K.line(ctx, x - s, y - s, x + s, y + s, Object.assign({ stroke: K.C.red, width: s * 0.22 }, o, { p: K.clamp(p * 2) }));
    K.line(ctx, x + s, y - s, x - s, y + s, Object.assign({ stroke: K.C.red, width: s * 0.22 }, o, { p: K.clamp(p * 2 - 1) }));
  };

  // ---------- 文字 ----------
  // 逐字绘制：每个字都带一点随机旋转和上下浮动；p 控制"写出来"的进度
  const widthCache = new Map();
  function charW(ctx, ch, size) {
    const key = ctx.font + ch;
    let w = widthCache.get(key);
    if (w == null) { w = ctx.measureText(ch).width; widthCache.set(key, w); }
    return w;
  }
  K.text = (ctx, str, x, y, o = {}) => {
    const size = o.size || 48, chars = Array.from(str);
    const p = o.p == null ? 1 : o.p;
    const shown = p >= 1 ? chars.length : Math.floor(chars.length * p + 1e-6);
    if (shown <= 0) return;
    ctx.save();
    ctx.font = `${o.weight || ''} ${size}px ${o.font || K.FONT}`;
    ctx.textBaseline = 'middle';
    const ws = chars.map((c) => charW(ctx, c, size) + (o.spacing || 0));
    const total = ws.reduce((a, b) => a + b, 0);
    let cx = o.align === 'left' ? x : o.align === 'right' ? x - total : x - total / 2;
    const R = shapeRng({ seed: o.seed, still: o.still });
    const jit = o.jitter == null ? 1 : o.jitter;
    if (o.alpha != null) ctx.globalAlpha *= o.alpha;
    for (let i = 0; i < shown; i++) {
      const rot = (R() - 0.5) * 0.09 * jit, dy = (R() - 0.5) * size * 0.06 * jit;
      const fresh = p < 1 && i === shown - 1 ? 1.25 : 1;
      ctx.save();
      ctx.translate(cx + ws[i] / 2, y + dy);
      ctx.rotate(rot); ctx.scale(fresh, fresh);
      if (o.outline) { ctx.lineWidth = o.outlineWidth || size * 0.16; ctx.strokeStyle = o.outline; ctx.lineJoin = 'round'; ctx.strokeText(chars[i], -ws[i] / 2 + (o.spacing || 0) / 2, 0); }
      ctx.fillStyle = (o.colors && o.colors[i]) || o.color || K.C.ink;
      ctx.fillText(chars[i], -ws[i] / 2 + (o.spacing || 0) / 2, 0);
      ctx.restore();
      cx += ws[i];
    }
    ctx.restore();
    if (K.xray && !o.noXray && size >= 40 && labels < 28) {
      const x0 = o.align === 'left' ? x : o.align === 'right' ? x - total : x - total / 2;
      ctx.save();
      ctx.strokeStyle = K.C.xray; ctx.setLineDash([6, 5]); ctx.lineWidth = 1.5;
      ctx.strokeRect(x0, y - size * 0.6, total, size * 1.2);
      ctx.restore();
      const short = str.length > 8 ? str.slice(0, 8) + '…' : str;
      xrayMark(ctx, [[[x0, y + size * 0.6], [x0 + total, y + size * 0.6]]], `text("${short}", ${size}px)`);
    }
    return total;
  };
  K.measure = (ctx, str, size, font) => {
    ctx.save(); ctx.font = `${size}px ${font || K.FONT}`;
    let w = 0; for (const c of str) w += charW(ctx, c, size);
    ctx.restore(); return w;
  };
  // 自动换行排版，返回每个字的位置（用于荧光笔高亮）
  K.layout = (ctx, str, x, y, maxW, size, lineH) => {
    ctx.save(); ctx.font = `${size}px ${K.FONT}`;
    const out = []; let cx = x, cy = y;
    for (const ch of str) {
      const w = charW(ctx, ch, size);
      if (cx + w > x + maxW && !/[，。！？、]/.test(ch)) { cx = x; cy += lineH; }
      out.push({ ch, x: cx, y: cy, w });
      cx += w;
    }
    ctx.restore();
    return out;
  };

  // ---------- 纸张背景 ----------
  let paper = null;
  K.paper = (ctx) => {
    if (!paper) {
      paper = document.createElement('canvas');
      paper.width = W; paper.height = H;
      const g = paper.getContext('2d'), R = rng(7);
      g.fillStyle = K.C.paper; g.fillRect(0, 0, W, H);
      for (let i = 0; i < 9000; i++) {
        g.fillStyle = R() < 0.5 ? 'rgba(120,90,40,0.05)' : 'rgba(255,255,255,0.35)';
        g.fillRect(R() * W, R() * H, 1 + R() * 2, 1 + R() * 2);
      }
      const vg = g.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 1.05);
      vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(110,80,30,0.16)');
      g.fillStyle = vg; g.fillRect(0, 0, W, H);
    }
    ctx.drawImage(paper, 0, 0);
    if (K.xray) {
      ctx.save();
      ctx.fillStyle = 'rgba(12,50,80,0.10)'; ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = 'rgba(24,200,216,0.18)'; ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = 0; x <= W; x += 60) { ctx.moveTo(x, 0); ctx.lineTo(x, H); }
      for (let y = 0; y <= H; y += 60) { ctx.moveTo(0, y); ctx.lineTo(W, y); }
      ctx.stroke();
      ctx.restore();
    }
  };

  // 以 (x,y) 为中心缩放/旋转后画 fn
  K.at = (ctx, x, y, s, rot, fn) => {
    if (s <= 0.001) return;
    ctx.save(); ctx.translate(x, y); if (rot) ctx.rotate(rot); ctx.scale(s, s); fn(); ctx.restore();
  };
  K.fade = (ctx, a, fn) => {
    if (a <= 0.001) return;
    ctx.save(); ctx.globalAlpha *= K.clamp(a); fn(); ctx.restore();
  };
})();
