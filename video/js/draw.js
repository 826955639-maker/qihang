// 手绘风格绘图工具：所有线条都带轻微抖动，并按 6 帧/秒"沸腾"，模拟逐帧手绘的感觉
(function () {
  const W = 1280, H = 720;
  const C = {
    ink: '#2b2b3a', paper: '#fdf6e3', sky: '#bfe6f5', sky2: '#eaf8fb',
    sea: '#52b6dc', sea2: '#2f8fbf', foam: '#ffffff', sand: '#f6d58e',
    green: '#6cbf6a', green2: '#4a9e52', trunk: '#b07a45',
    body: '#ffffff', stripe: '#ff7a59', wing: '#ffc845', glass: '#cdeefc',
    red: '#ef5350', ok: '#43a047', road: '#8d8f99', ground: '#e8c48a',
    mode: { land: '#c98b4b', trans: '#9b7be0', float: '#3aa0d8', foil: '#2dbfa0', fly: '#ff8a3d', loop: '#e85d9a' },
  };
  const MODE_NAME = { land: '陆行', trans: '过渡', float: '浮航', foil: '水翼', fly: '掠飞', loop: '循环' };

  let ctx = null, boil = 0, shapeN = 0;
  function begin(c, T) { ctx = c; boil = Math.floor(T * 6); shapeN = 0; }

  function hash(n) { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); }
  function jit(i, amp) { return (hash(shapeN * 31.7 + i * 1.91 + boil * 7.3) - 0.5) * 2 * amp; }

  const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
  const lerp = (a, b, k) => a + (b - a) * k;
  const prog = (t, a, b) => clamp((t - a) / (b - a));
  const ease = k => k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
  const easeOut = k => 1 - Math.pow(1 - k, 3);
  const backOut = k => { const c1 = 1.9, c3 = c1 + 1; return k <= 0 ? 0 : 1 + c3 * Math.pow(k - 1, 3) + c1 * Math.pow(k - 1, 2); };
  const pop = (t, at, d = 0.4) => backOut(prog(t, at, at + d));

  // 把点列描成平滑的抖动曲线
  function tracePts(pts, closed, amp) {
    const p = pts.map((q, i) => [q[0] + jit(i * 2, amp), q[1] + jit(i * 2 + 1, amp)]);
    ctx.beginPath();
    if (p.length < 3) { ctx.moveTo(p[0][0], p[0][1]); for (let i = 1; i < p.length; i++) ctx.lineTo(p[i][0], p[i][1]); return; }
    if (closed) {
      const m = [(p[0][0] + p[p.length - 1][0]) / 2, (p[0][1] + p[p.length - 1][1]) / 2];
      ctx.moveTo(m[0], m[1]);
      for (let i = 0; i < p.length; i++) {
        const a = p[i], b = p[(i + 1) % p.length];
        ctx.quadraticCurveTo(a[0], a[1], (a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
      }
      ctx.closePath();
    } else {
      ctx.moveTo(p[0][0], p[0][1]);
      for (let i = 1; i < p.length - 1; i++) {
        const a = p[i], b = p[i + 1];
        ctx.quadraticCurveTo(a[0], a[1], (a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
      }
      ctx.lineTo(p[p.length - 1][0], p[p.length - 1][1]);
    }
  }

  // o: {fill, stroke, lw, amp, closed, double, alpha}
  function shape(pts, o = {}) {
    shapeN++;
    const amp = o.amp ?? 1.3, closed = o.closed ?? true;
    ctx.save();
    if (o.alpha != null) ctx.globalAlpha *= o.alpha;
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    if (o.fill) { tracePts(pts, closed, amp * 0.5); ctx.fillStyle = o.fill; ctx.fill(); }
    if (o.stroke !== null) {
      ctx.strokeStyle = o.stroke || C.ink; ctx.lineWidth = o.lw ?? 3;
      tracePts(pts, closed, amp); ctx.stroke();
      if (o.double) { shapeN += 0.5; ctx.globalAlpha *= 0.45; ctx.lineWidth *= 0.6; tracePts(pts, closed, amp * 1.4); ctx.stroke(); }
    }
    ctx.restore();
  }

  function subdiv(pts, closed, step = 28) {
    const out = [];
    const n = closed ? pts.length : pts.length - 1;
    for (let i = 0; i < n; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length];
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const k = Math.max(1, Math.round(len / step));
      for (let j = 0; j < k; j++) out.push([lerp(a[0], b[0], j / k), lerp(a[1], b[1], j / k)]);
    }
    if (!closed) out.push(pts[pts.length - 1]);
    return out;
  }
  // 多边形：拐角保持尖锐（每条边细分、角点重复）
  function poly(pts, o = {}) {
    const closed = o.closed ?? true;
    const out = [];
    const n = closed ? pts.length : pts.length - 1;
    for (let i = 0; i < n; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length];
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const k = Math.max(1, Math.round(len / 30));
      out.push(a, a);
      for (let j = 1; j < k; j++) out.push([lerp(a[0], b[0], j / k), lerp(a[1], b[1], j / k)]);
    }
    if (!closed) out.push(pts[pts.length - 1], pts[pts.length - 1]);
    shape(out, o);
  }
  function smooth(pts, o = {}) { shape(subdiv(pts, o.closed ?? true, o.step ?? 26), o); }
  function rect(x, y, w, h, o = {}) {
    const r = Math.min(o.r ?? 10, w / 2, h / 2);
    if (r < 2) return poly([[x, y], [x + w, y], [x + w, y + h], [x, y + h]], o);
    const pts = [];
    const corner = (cx, cy, a0) => { for (let i = 0; i <= 3; i++) { const a = a0 + i / 3 * Math.PI / 2; pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); } };
    corner(x + w - r, y + r, -Math.PI / 2); corner(x + w - r, y + h - r, 0);
    corner(x + r, y + h - r, Math.PI / 2); corner(x + r, y + r, Math.PI);
    shape(subdiv(pts, true, 30), o);
  }
  function ellipse(cx, cy, rx, ry, o = {}) {
    const n = Math.max(10, Math.min(40, Math.round((rx + ry) / 5)));
    const a0 = o.a0 ?? 0, a1 = o.a1 ?? Math.PI * 2, closed = o.closed ?? (a1 - a0 >= Math.PI * 2 - 1e-6);
    const pts = [];
    for (let i = 0; i < (closed ? n : n + 1); i++) { const a = a0 + (a1 - a0) * i / n; pts.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]); }
    shape(pts, { ...o, closed });
  }
  const circle = (cx, cy, r, o) => ellipse(cx, cy, r, r, o);
  function line(x1, y1, x2, y2, o = {}) { shape(subdiv([[x1, y1], [x2, y2]], false, 30), { ...o, closed: false, fill: null }); }
  function curve(pts, o = {}) { shape(subdiv(pts, false, 24), { ...o, closed: false, fill: null }); }

  function arrow(x1, y1, x2, y2, o = {}) {
    line(x1, y1, x2, y2, o);
    const a = Math.atan2(y2 - y1, x2 - x1), s = o.head ?? 14;
    poly([[x2 - Math.cos(a - 0.5) * s, y2 - Math.sin(a - 0.5) * s], [x2, y2], [x2 - Math.cos(a + 0.5) * s, y2 - Math.sin(a + 0.5) * s]],
      { ...o, closed: false, fill: null });
  }
  function dblArrow(x1, y1, x2, y2, o = {}) { arrow(x1, y1, x2, y2, o); arrow(x2, y2, x1, y1, o); }

  function text(str, x, y, o = {}) {
    ctx.save();
    ctx.font = `${o.size ?? 32}px KuaiLe, "WenQuanYi Zen Hei", sans-serif`;
    ctx.textAlign = o.align ?? 'center'; ctx.textBaseline = o.base ?? 'middle';
    if (o.alpha != null) ctx.globalAlpha *= o.alpha;
    if (o.outline) { ctx.lineJoin = 'round'; ctx.strokeStyle = o.outline; ctx.lineWidth = o.olw ?? 8; ctx.strokeText(str, x, y); }
    ctx.fillStyle = o.color ?? C.ink;
    ctx.fillText(str, x, y);
    ctx.restore();
  }
  function measure(str, size) {
    ctx.save(); ctx.font = `${size}px KuaiLe, "WenQuanYi Zen Hei", sans-serif`;
    const w = ctx.measureText(str).width; ctx.restore(); return w;
  }

  function check(x, y, s = 1, color = C.ok) { poly([[x - 16 * s, y], [x - 4 * s, y + 12 * s], [x + 18 * s, y - 14 * s]], { closed: false, stroke: color, lw: 7 * s }); }
  function cross(x, y, s = 1, color = C.red) {
    line(x - 15 * s, y - 15 * s, x + 15 * s, y + 15 * s, { stroke: color, lw: 7 * s });
    line(x + 15 * s, y - 15 * s, x - 15 * s, y + 15 * s, { stroke: color, lw: 7 * s });
  }
  function star(x, y, r, o = {}) {
    const pts = [];
    for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r; pts.push([x + Math.cos(a) * rr, y + Math.sin(a) * rr]); }
    poly(pts, { fill: C.wing, ...o });
  }

  // 便签卡片
  function card(x, y, w, h, o = {}) {
    ctx.save();
    ctx.fillStyle = 'rgba(43,43,58,0.18)';
    ctx.beginPath(); ctx.roundRect(x + 6, y + 8, w, h, 16); ctx.fill();
    ctx.restore();
    rect(x, y, w, h, { fill: o.fill ?? '#fffdf5', r: 16, lw: o.lw ?? 3.5, stroke: o.stroke });
  }

  // 以 (cx,cy) 为中心缩放
  function scaled(cx, cy, s, fn) {
    if (s <= 0.001) return;
    ctx.save(); ctx.translate(cx, cy); ctx.scale(s, s); ctx.translate(-cx, -cy); fn(); ctx.restore();
  }
  function alpha(a, fn) { if (a <= 0.001) return; ctx.save(); ctx.globalAlpha *= a; fn(); ctx.restore(); }

  let paperTex = null;
  function paper() {
    if (!paperTex) {
      paperTex = document.createElement('canvas'); paperTex.width = W; paperTex.height = H;
      const p = paperTex.getContext('2d');
      p.fillStyle = C.paper; p.fillRect(0, 0, W, H);
      for (let i = 0; i < 9000; i++) {
        const x = hash(i * 3.1) * W, y = hash(i * 7.7 + 1) * H, a = hash(i * 1.3 + 2) * 0.06;
        p.fillStyle = `rgba(120,90,40,${a})`; p.fillRect(x, y, 1.6, 1.6);
      }
    }
    ctx.drawImage(paperTex, 0, 0);
  }

  window.D = {
    W, H, C, MODE_NAME, begin, hash, clamp, lerp, prog, ease, easeOut, backOut, pop,
    shape, poly, smooth, rect, ellipse, circle, line, curve, arrow, dblArrow, text, measure,
    check, cross, star, card, scaled, alpha, paper, get ctx() { return ctx; },
  };
})();
