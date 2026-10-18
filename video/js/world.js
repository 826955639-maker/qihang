// 场景元素：天空、大海、小岛、酒店、人物，以及主角"飞行汽车"
(function () {
  const { C, W, H, hash, lerp, clamp } = D;

  function sky(top = C.sky, bottom = C.sky2, y1 = H) {
    const c = D.ctx, g = c.createLinearGradient(0, 0, 0, y1);
    g.addColorStop(0, top); g.addColorStop(1, bottom);
    c.fillStyle = g; c.fillRect(0, 0, W, y1);
  }
  function sun(x, y, r, t = 0, color = '#ffd54f') {
    const c = D.ctx; c.save(); c.translate(x, y); c.rotate(t * 0.3);
    for (let i = 0; i < 10; i++) {
      const a = i / 10 * Math.PI * 2;
      D.line(Math.cos(a) * (r + 10), Math.sin(a) * (r + 10), Math.cos(a) * (r + 26), Math.sin(a) * (r + 26), { stroke: '#f5a623', lw: 4 });
    }
    c.restore();
    D.circle(x, y, r, { fill: color, stroke: '#f5a623', lw: 3.5 });
  }
  function cloud(x, y, s = 1, alpha = 1) {
    const pts = [];
    const bumps = [[-50, 0, 26], [-22, -18, 30], [14, -22, 34], [46, -6, 26], [30, 12, 20], [-10, 14, 22], [-40, 12, 18]];
    bumps.forEach(([bx, by, r], i) => {
      for (let k = 0; k < 5; k++) {
        const a = Math.atan2(by, bx) - 1.0 + k * 0.5;
        pts.push([x + (bx + Math.cos(a) * r) * s, y + (by + Math.sin(a) * r) * s]);
      }
    });
    pts.sort((p, q) => Math.atan2(p[1] - y, p[0] - x) - Math.atan2(q[1] - y, q[0] - x));
    D.shape(pts, { fill: '#ffffff', stroke: '#9fb8c8', lw: 2.5, alpha });
  }
  function clouds(t, speed = 8, list = [[160, 110, 1], [560, 70, 0.8], [960, 130, 1.1], [1260, 80, 0.7]]) {
    list.forEach(([x, y, s]) => {
      const xx = ((x - t * speed * s) % (W + 300) + W + 300) % (W + 300) - 150;
      cloud(xx, y, s);
    });
  }
  function bird(x, y, s, t) {
    const f = Math.sin(t * 9 + x) * 6 * s;
    D.curve([[x - 14 * s, y - f], [x - 6 * s, y - 4 * s], [x, y], [x + 6 * s, y - 4 * s], [x + 14 * s, y - f]], { lw: 2.5 });
  }

  // 大海。y0 = 水平面，scroll = 滚动距离（像素），amp = 浪高
  function sea(y0, scroll = 0, o = {}) {
    const amp = o.amp ?? 5, wl = o.wl ?? 70;
    const pts = [[W + 40, H + 40], [-40, H + 40]];
    for (let x = -40; x <= W + 40; x += 20) pts.push([x, y0 + Math.sin((x + scroll) / wl * Math.PI * 2 * 0.5) * amp]);
    const c = D.ctx, g = c.createLinearGradient(0, y0, 0, H);
    g.addColorStop(0, o.color ?? C.sea); g.addColorStop(1, o.color2 ?? C.sea2);
    D.shape(pts.slice(2).concat([[W + 40, H + 40], [-40, H + 40]]), { fill: g, stroke: '#2a7fae', lw: 3, amp: 1 });
    // 浪花小弧线，越近越快
    for (let row = 0; row < 5; row++) {
      const yy = y0 + 26 + row * row * 14 + row * 18;
      if (yy > H + 20) break;
      const par = 0.4 + row * 0.35, gap = 170 - row * 12;
      for (let k = -1; k < W / gap + 2; k++) {
        const xx = ((k * gap + hash(row * 9 + k) * 60 - scroll * par) % (W + gap * 2) + W + gap * 2) % (W + gap * 2) - gap;
        const w = 14 + row * 5;
        D.curve([[xx - w, yy], [xx - w / 2, yy + 5], [xx, yy], [xx + w / 2, yy + 5], [xx + w, yy]], { stroke: 'rgba(255,255,255,0.75)', lw: 2.5 });
      }
    }
  }
  // 画在主体之后：水面以下半透明，表示"泡在水里"
  function waterOverlay(y0, scroll = 0, o = {}) {
    const amp = o.amp ?? 5, wl = o.wl ?? 70;
    const pts = [];
    for (let x = -40; x <= W + 40; x += 20) pts.push([x, y0 + Math.sin((x + scroll) / wl * Math.PI * 2 * 0.5) * amp]);
    D.shape(pts.concat([[W + 40, H + 40], [-40, H + 40]]), { fill: 'rgba(60,160,210,0.42)', stroke: null, amp: 0.8 });
    D.shape(pts, { closed: false, stroke: '#ffffff', lw: 3, amp: 1 });
  }

  function palm(x, y, s = 1, t = 0) {
    const sway = Math.sin(t * 1.6 + x) * 4 * s;
    D.curve([[x, y], [x + 4 * s, y - 40 * s], [x + 10 * s + sway, y - 80 * s]], { stroke: C.trunk, lw: 8 * s });
    const tx = x + 10 * s + sway, ty = y - 82 * s;
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI + i * Math.PI / 4 + Math.sin(t * 2 + i) * 0.05;
      const ex = tx + Math.cos(a) * 46 * s, ey = ty + Math.sin(a) * 30 * s + 18 * s;
      D.smooth([[tx, ty], [lerp(tx, ex, 0.5), ty + (ey - ty) * 0.2 - 12 * s], [ex, ey], [lerp(tx, ex, 0.5), ty + (ey - ty) * 0.5]], { fill: C.green, stroke: C.green2, lw: 2.5, step: 14 });
    }
    D.circle(tx, ty + 4 * s, 5 * s, { fill: '#8d5a2b', lw: 2 });
  }
  function island(x, y, w, h, o = {}) {
    D.ellipse(x, y, w / 2, h, { a0: Math.PI, a1: Math.PI * 2, fill: C.sand, lw: 3, closed: true });
    if (o.hill) D.ellipse(x + w * 0.12, y - h * 0.55, w * 0.3, h * 0.9, { a0: Math.PI, a1: Math.PI * 2, fill: C.green, stroke: C.green2, lw: 3, closed: true });
    (o.palms ?? []).forEach(([px, ps]) => palm(x + px * w / 2, y - h * 0.6, ps, o.t ?? 0));
  }

  function hotel(x, y, s = 1) {
    D.rect(x, y - 260 * s, 260 * s, 260 * s, { fill: '#ffe9c7', r: 6, lw: 3.5 });
    D.poly([[x - 16 * s, y - 260 * s], [x + 130 * s, y - 320 * s], [x + 276 * s, y - 260 * s]], { fill: '#ff8a65', lw: 3.5 });
    for (let r = 0; r < 3; r++) for (let k = 0; k < 4; k++)
      D.rect(x + (24 + k * 58) * s, y - (230 - r * 56) * s, 36 * s, 34 * s, { fill: C.glass, r: 4, lw: 2.5 });
    D.rect(x + 100 * s, y - 70 * s, 60 * s, 70 * s, { fill: '#a1887f', r: 4, lw: 3 });
    D.rect(x + 70 * s, y - 300 * s, 120 * s, 34 * s, { fill: '#fff', r: 8, lw: 2.5 });
    D.text('海景酒店', x + 130 * s, y - 283 * s, { size: 22 * s });
  }

  function person(x, y, s = 1, o = {}) {
    const ph = o.walk ?? 0, sw = Math.sin(ph) * 9 * s;
    const kid = o.kid, hh = kid ? 0.75 : 1;
    s *= hh;
    D.line(x, y - 30 * s, x - sw, y, { lw: 4 * s });
    D.line(x, y - 30 * s, x + sw, y, { lw: 4 * s });
    D.rect(x - 13 * s, y - 70 * s, 26 * s, 44 * s, { fill: o.shirt ?? '#4fc3f7', r: 10 * s, lw: 3 });
    const wave = o.wave ? Math.sin(o.wave * 8) * 0.4 : 0;
    D.line(x + 10 * s, y - 60 * s, x + 26 * s, y - (o.wave ? 88 : 40) * s + wave * 20, { lw: 4 * s });
    D.line(x - 10 * s, y - 60 * s, x - 22 * s, y - 38 * s, { lw: 4 * s });
    face(x, y - 86 * s, 16 * s, o);
  }
  function face(x, y, r, o = {}) {
    D.circle(x, y, r, { fill: '#ffd9b3', lw: 3 });
    if (o.cap) D.ellipse(x, y - r * 0.5, r * 1.05, r * 0.6, { a0: Math.PI, a1: Math.PI * 2, closed: true, fill: o.cap, lw: 2.5 });
    if (o.hair) D.ellipse(x, y - r * 0.55, r * 1.0, r * 0.55, { a0: Math.PI, a1: Math.PI * 2, closed: true, fill: o.hair, lw: 2.5 });
    const c = D.ctx; c.fillStyle = C.ink;
    const dx = o.look ?? 0.25;
    if (o.sick) {
      D.line(x - r * 0.5 + dx * r, y - r * 0.15, x - r * 0.2 + dx * r, y - r * 0.05, { lw: 2.5 });
      D.line(x + r * 0.15 + dx * r, y - r * 0.05, x + r * 0.45 + dx * r, y - r * 0.15, { lw: 2.5 });
      D.curve([[x - r * 0.4, y + r * 0.5], [x - r * 0.15, y + r * 0.35], [x + r * 0.1, y + r * 0.5], [x + r * 0.35, y + r * 0.35]], { lw: 2.5 });
      return;
    }
    c.beginPath(); c.arc(x - r * 0.35 + dx * r, y - r * 0.1, r * 0.12, 0, 7); c.arc(x + r * 0.3 + dx * r, y - r * 0.1, r * 0.12, 0, 7); c.fill();
    if (o.wow) D.circle(x + dx * r, y + r * 0.45, r * 0.18, { fill: '#c0392b', lw: 2 });
    else D.ellipse(x + dx * r * 0.6, y + r * 0.3, r * 0.4, r * 0.28, { a0: 0.2, a1: Math.PI - 0.2, lw: 2.5 });
    c.fillStyle = 'rgba(255,120,120,0.35)';
    c.beginPath(); c.arc(x - r * 0.6 + dx * r, y + r * 0.25, r * 0.18, 0, 7); c.arc(x + r * 0.6 + dx * r, y + r * 0.25, r * 0.18, 0, 7); c.fill();
  }

  // ---------------- 主角：侧视图 ----------------
  // 原点在船底龙骨中点，朝右。st: wing 0折叠→1展开, wheels 1放下→0收起, foil 0→1 水翼伸出,
  // prop 螺旋桨角度, spin 0→1 转速模糊, light 舱内灯颜色, wow 乘客表情
  function craft(x, y, s = 1, st = {}) {
    const c = D.ctx; c.save(); c.translate(x, y); c.rotate(st.tilt ?? 0); c.scale(s, s);
    const wing = st.wing ?? 1, wheels = st.wheels ?? 0, foil = st.foil ?? 0;

    // 水翼支柱
    if (foil > 0.01) [-62, 64].forEach(fx => {
      D.line(fx, -6, fx - 4, 36 * foil, { lw: 5, stroke: '#546e7a' });
      D.rect(fx - 28, 32 * foil, 50, 8, { fill: '#78909c', r: 4, lw: 2.5 });
    });
    // 轮子
    if (wheels > 0.01) [-82, 82].forEach(wx => {
      const wy = lerp(-26, 2, wheels);
      D.circle(wx, wy, 18, { fill: '#424242', lw: 3 });
      D.circle(wx, wy, 7, { fill: '#bdbdbd', lw: 2 });
      const a = st.roll ?? 0;
      D.line(wx + Math.cos(a) * 7, wy + Math.sin(a) * 7, wx + Math.cos(a) * 15, wy + Math.sin(a) * 15, { stroke: '#bdbdbd', lw: 2.5 });
    });
    // 尾翼
    D.poly([[-112, -96], [-138, -160], [-116, -162], [-84, -102]], { fill: C.stripe, lw: 3 });
    D.rect(-160, -170, 66, 12, { fill: C.wing, r: 6, lw: 3 });
    // 推进螺旋桨 (尾部)
    const spin = st.spin ?? 0, pa = st.prop ?? 0;
    D.rect(-142, -74, 20, 16, { fill: '#90a4ae', r: 5, lw: 2.5 });
    if (spin > 0.4) D.ellipse(-146, -66, 6, 40, { fill: 'rgba(180,200,215,0.55)', stroke: 'rgba(43,43,58,0.5)', lw: 2 });
    if (spin < 0.9) {
      const L = 38 * Math.cos(pa), L2 = 38 * Math.cos(pa + Math.PI / 2);
      c.save(); c.globalAlpha *= 1 - clamp((spin - 0.4) / 0.5);
      D.line(-146, -66, -146, -66 - L, { lw: 7, stroke: '#455a64' }); D.line(-146, -66, -146, -66 + L, { lw: 7, stroke: '#455a64' });
      D.line(-146, -66, -146, -66 - L2, { lw: 7, stroke: '#455a64' }); D.line(-146, -66, -146, -66 + L2, { lw: 7, stroke: '#455a64' });
      c.restore();
    }
    // 座舱
    D.smooth([[-126, -42], [-126, -92], [-106, -106], [30, -106], [64, -98], [100, -72], [134, -44]], { fill: C.body, lw: 3.5, step: 24 });
    // 船身
    D.poly([[-130, -42], [-120, -14], [-60, 0], [76, 0], [120, -18], [142, -44]], { fill: C.body, lw: 3.5 });
    D.poly([[-123, -22], [-120, -14], [-60, 0], [76, 0], [120, -18], [126, -24]], { fill: '#9fd3ea', lw: 2.5 });
    D.poly([[-128, -38], [138, -38], [133, -29], [-125, -29]], { fill: C.stripe, stroke: null });
    // 车窗与乘客
    const light = st.light ?? C.glass;
    D.poly([[42, -96], [66, -90], [102, -60], [60, -56]], { fill: light, lw: 3 });
    face(66, -72, 11, { hair: '#5d4037', look: 0.4 });
    D.rect(-8, -94, 58, 36, { fill: light, r: 9, lw: 3 });
    face(22, -74, 10, { cap: '#ff7043', look: 0.4, wow: st.wow });
    D.circle(132, -50, 5, { fill: '#fff59d', lw: 2 });
    // 近侧机翼：0 折起贴在车身侧面，1 展开
    const k = D.ease(wing);
    const ang = lerp(-1.47, -3.66, k), len = lerp(64, 70, k);
    const dx = Math.cos(ang) * len, dy = Math.sin(ang) * len;
    const r1 = [-22, -40], r2 = [-104, -40];
    D.poly([r1, [r1[0] + dx - lerp(4, 10, k), r1[1] + dy], [r2[0] + dx + lerp(4, 14, k), r2[1] + dy], r2], { fill: C.wing, lw: 3.5 });
    D.line(lerp(r1[0], r2[0], 0.5), -40, lerp(r1[0], r2[0], 0.5) + dx, -40 + dy, { stroke: '#e0a800', lw: 2.5 });
    if (k > 0.7) D.ellipse(-62 + dx, -40 + dy + 8, 30, 7, { fill: '#ffffff', lw: 2.5, alpha: (k - 0.7) / 0.3 });
    c.restore();
  }

  // ---------------- 主角：正视图 ----------------
  // 原点在地面中点。wing 0 竖起折叠 → 1 水平展开
  function craftFront(x, y, s = 1, st = {}) {
    const c = D.ctx; c.save(); c.translate(x, y); c.scale(s, s);
    const k = D.ease(st.wing ?? 0);
    // 尾翼 (在车顶后方露出来)
    D.poly([[-7, -150], [0, -205], [7, -150]], { fill: C.stripe, lw: 3 });
    D.rect(-40, -212, 80, 12, { fill: C.wing, r: 6, lw: 3 });
    // 机翼
    [-1, 1].forEach(side => {
      c.save(); c.translate(side * 68, -62);
      const a = lerp(-Math.PI / 2 + 0.06, 0.04, k) * side;
      c.rotate(a);
      if (side < 0) c.scale(-1, 1);
      D.poly([[0, -9], [214, -6], [222, 0], [214, 6], [0, 9]], { fill: C.wing, lw: 3.5 });
      D.line(60, 0, 200, 0, { stroke: '#e0a800', lw: 2 });
      if (k > 0.6) D.ellipse(206, 18, 16, 10, { fill: '#fff', lw: 2.5, alpha: (k - 0.6) / 0.4 });
      c.restore();
      if (st.lock && k > 0.98) D.circle(side * 68, -62, 9, { fill: '#66bb6a', lw: 2.5 });
    });
    // 轮子
    if ((st.wheels ?? 1) > 0.01) [-48, 48].forEach(wx => D.rect(wx - 12, -34, 24, 34, { fill: '#424242', r: 6, lw: 3 }));
    // 车身
    D.smooth([[-72, -36], [-72, -130], [-56, -152], [56, -152], [72, -130], [72, -36]], { fill: C.body, lw: 3.5, step: 24 });
    D.poly([[-74, -44], [74, -44], [36, -14], [0, -8], [-36, -14]], { fill: '#9fd3ea', lw: 3 });
    D.rect(-70, -66, 140, 9, { fill: C.stripe, stroke: null, r: 2 });
    const light = st.light ?? C.glass;
    D.rect(-54, -142, 108, 50, { fill: light, r: 12, lw: 3 });
    face(-20, -112, 13, { hair: '#5d4037', look: 0 });
    face(22, -110, 11, { cap: '#ff7043', look: 0, wow: st.wow });
    D.circle(-50, -78, 8, { fill: '#fff59d', lw: 2.5 }); D.circle(50, -78, 8, { fill: '#fff59d', lw: 2.5 });
    c.restore();
  }

  // 尾部水花：粒子由时间推出，保证每一帧可复现
  function spray(x, y, t, amount = 1, len = 140) {
    if (amount <= 0.01) return;
    const n = Math.round(18 * amount);
    for (let i = 0; i < n; i++) {
      const ph = (t * 1.8 + hash(i * 3.3)) % 1;
      const px = x - ph * len * (0.7 + hash(i) * 0.6);
      const py = y - Math.sin(ph * Math.PI) * (20 + hash(i * 5) * 34) * amount;
      const r = (3 + hash(i * 7) * 7) * (1 - ph * 0.6) * (0.6 + amount * 0.4);
      D.circle(px, py, r, { fill: '#ffffff', stroke: '#7cc4e4', lw: 1.5, amp: 0.6 });
    }
  }
  function wake(x, y, t, amount = 1, len = 300) {
    if (amount <= 0.01) return;
    for (let i = 0; i < 4; i++) {
      const xx = x - i * len / 4 - (t * 60 % (len / 4));
      D.curve([[xx, y + 2], [xx - 30, y + 8 + i * 2], [xx - 60, y + 4]], { stroke: `rgba(255,255,255,${0.9 * amount})`, lw: 3 });
    }
  }
  function speedLines(t, amount, y0 = 120, y1 = 600) {
    if (amount <= 0.01) return;
    for (let i = 0; i < 12; i++) {
      const yy = lerp(y0, y1, hash(i * 2.7));
      const xx = W + 200 - ((t * 900 + hash(i) * W * 1.5) % (W + 400));
      D.line(xx, yy, xx + 60 + hash(i * 3) * 80, yy, { stroke: `rgba(255,255,255,${0.8 * amount})`, lw: 3 });
    }
  }

  window.Wd = { sky, sun, cloud, clouds, bird, sea, waterOverlay, palm, island, hotel, person, face, craft, craftFront, spray, wake, speedLines };
})();
