// 角色和小道具：小克、火柴人，还有一堆手绘图标。全都由 engine.js 里的几个基本笔画拼出来。
(function () {
  const C = K.C;
  const SKIN = '#ffd9b3', ORANGE_D = '#d9703f';

  // ---------- 小克（Claude 的卡通替身）----------
  // o: t 时间, talk 是否在说话, mood: happy|surprised|wink, arm: wave|point|up|down|chin,
  //    pointAngle 指向角度, look [dx,dy], pencil, beret, camera, squash 压扁(+)/拉长(-)
  K.ke = (ctx, x, y, s, o = {}) => {
    const t = o.t || 0;
    const bob = o.bob === false ? 0 : Math.sin(t * 3.1) * s * 0.035;
    const sq = o.squash || 0;
    ctx.save();
    ctx.translate(x, y + bob + s);
    ctx.scale(1 + sq * 0.35, 1 - sq * 0.35);
    ctx.translate(0, -s);
    const W = s * 0.05;

    // 脚
    K.ellipse(ctx, -s * 0.4, s * 0.96, s * 0.25, s * 0.12, { fill: ORANGE_D, width: W, label: 'foot' });
    K.ellipse(ctx, s * 0.4, s * 0.96, s * 0.25, s * 0.12, { fill: ORANGE_D, width: W });
    // 头顶的小火花
    K.curve(ctx, [[0, -s * 0.96], [s * 0.05, -s * 1.12], [s * 0.14, -s * 1.24]], { width: W * 0.9 });
    K.sparkle(ctx, s * 0.16, -s * 1.32, s * 0.2, { width: W * 0.7, rot: Math.sin(t * 2) * 0.2 });
    if (o.beret) {
      K.ellipse(ctx, -s * 0.12, -s * 0.9, s * 0.62, s * 0.2, { fill: C.purple, width: W });
      K.circle(ctx, -s * 0.1, -s * 1.12, s * 0.07, { fill: C.purple, width: W * 0.8 });
    }
    // 身体
    K.circle(ctx, 0, 0, s, { fill: C.orange, width: W * 1.1, label: '小克.body' });
    K.ellipse(ctx, -s * 0.36, -s * 0.48, s * 0.2, s * 0.11, { fill: 'rgba(255,255,255,0.5)', stroke: null, noXray: true });

    // 眼睛
    const lx = o.look ? o.look[0] * s * 0.07 : 0, ly = o.look ? o.look[1] * s * 0.07 : 0;
    const blink = (t + (o.blinkOffset || 0)) % 3.9 < 0.13 ? 0.12 : 1;
    const big = o.mood === 'surprised' ? 1.35 : 1;
    for (const side of [-1, 1]) {
      const ex = side * s * 0.32 + lx, ey = -s * 0.12 + ly;
      if (o.mood === 'wink' && side === 1) {
        K.curve(ctx, [[ex - s * 0.1, ey], [ex, ey - s * 0.07], [ex + s * 0.1, ey]], { width: W });
        continue;
      }
      K.ellipse(ctx, ex, ey, s * 0.095 * big, s * 0.135 * big * blink, { fill: C.ink, stroke: null, label: 'eye' });
      if (blink > 0.5) K.circle(ctx, ex + s * 0.03, ey - s * 0.05, s * 0.035, { fill: '#fff', stroke: null, noXray: true, rough: 0.3 });
    }
    // 腮红
    K.ellipse(ctx, -s * 0.58, s * 0.14, s * 0.14, s * 0.075, { fill: C.pink, stroke: null, fillAlpha: 0.75, noXray: true });
    K.ellipse(ctx, s * 0.58, s * 0.14, s * 0.14, s * 0.075, { fill: C.pink, stroke: null, fillAlpha: 0.75, noXray: true });
    // 嘴巴
    if (o.talk || o.mood === 'surprised') {
      const open = o.mood === 'surprised' ? 1 : 0.25 + 0.75 * Math.abs(Math.sin(t * 13) * Math.sin(t * 7.3 + 1));
      K.ellipse(ctx, 0, s * 0.3, s * 0.15, s * 0.04 + s * 0.12 * open, { fill: '#8a3b33', width: W * 0.8, rough: 0.5, label: 'mouth' });
    } else {
      K.curve(ctx, [[-s * 0.2, s * 0.22], [0, s * 0.36], [s * 0.2, s * 0.22]], { width: W, label: 'smile' });
    }

    // 手臂
    const arm = (side, a, hand) => {
      const sx = side * s * 0.9, sy = s * 0.18, len = s * 0.62;
      const dx = side * Math.cos(a), dy = -Math.sin(a);
      const ex = sx + dx * len, ey = sy + dy * len;
      const mx = sx + dx * len * 0.5 - dy * side * s * 0.06, my = sy + dy * len * 0.5 + dx * side * s * 0.06;
      K.curve(ctx, [[sx, sy], [mx, my], [ex, ey]], { width: s * 0.075, label: 'arm' });
      K.circle(ctx, ex, ey, s * 0.1, { fill: C.orange, width: W * 0.8, noXray: true });
      if (hand) hand(ex, ey, a);
    };
    const leftA = o.arm === 'up' ? 1.15 + Math.sin(t * 6) * 0.15 : o.arm === 'chin' ? 0.2 : -0.95;
    let rightA = -0.95;
    if (o.arm === 'wave') rightA = 1.05 + Math.sin(t * 9) * 0.38;
    else if (o.arm === 'point') rightA = o.pointAngle == null ? 0.35 : o.pointAngle;
    else if (o.arm === 'up') rightA = 1.15 + Math.sin(t * 6 + 1) * 0.15;
    else if (o.pencil || o.camera) rightA = 0.25;
    if (o.arm === 'chin') {
      K.curve(ctx, [[-s * 0.9, s * 0.18], [-s * 0.7, s * 0.6], [-s * 0.25, s * 0.52]], { width: s * 0.075 });
      K.circle(ctx, -s * 0.22, s * 0.48, s * 0.1, { fill: C.orange, width: W * 0.8 });
    } else arm(-1, leftA);
    arm(1, rightA, (hx, hy) => {
      if (o.pencil) K.pencil(ctx, hx + s * 0.05, hy - s * 0.1, s * 0.9, -0.7);
      if (o.camera) K.camera(ctx, hx + s * 0.05, hy - s * 0.15, s * 0.5);
    });
    ctx.restore();
  };

  // ---------- 火柴人（翻页书里的主角）----------
  // phase 0..1 一次跳跃；(x,y) 是脚底
  K.stick = (ctx, x, y, s, phase, o = {}) => {
    const air = Math.sin(phase * Math.PI);
    const crouch = Math.max(0, Math.cos(phase * Math.PI * 2)) * 0.25;
    const hy = y - air * s * 0.9;
    const hip = [x, hy - s * (0.85 - crouch * 0.6)];
    const neck = [x, hip[1] - s * 0.75];
    const st = Object.assign({ width: s * 0.07 }, o);
    K.circle(ctx, x, neck[1] - s * 0.25, s * 0.22, Object.assign({ fill: C.cream }, st));
    K.line(ctx, neck[0], neck[1], hip[0], hip[1], st);
    const armUp = air;
    for (const side of [-1, 1]) {
      const ax = x + side * s * 0.45, ay = neck[1] + s * 0.25 - armUp * s * 0.65;
      K.line(ctx, neck[0], neck[1] + s * 0.1, ax, ay, st);
      const knee = [x + side * s * (0.2 + crouch * 0.4), hip[1] + s * 0.4 - crouch * s * 0.2];
      K.line(ctx, hip[0], hip[1], knee[0], knee[1], st);
      K.line(ctx, knee[0], knee[1], x + side * s * 0.22, hy, st);
    }
  };

  // ---------- 图标（中心在 x,y，大小约 2s） ----------
  K.icon = {
    picture(ctx, x, y, s) {
      K.rect(ctx, x - s, y - s * 0.75, s * 2, s * 1.5, { fill: C.sky, width: s * 0.06, label: '画面' });
      K.poly(ctx, [[x - s * 0.85, y + s * 0.6], [x - s * 0.25, y - s * 0.15], [x + s * 0.2, y + s * 0.35], [x + s * 0.45, y + s * 0.1], [x + s * 0.85, y + s * 0.6]], { fill: C.green, width: s * 0.05 });
      K.circle(ctx, x + s * 0.5, y - s * 0.35, s * 0.2, { fill: C.yellow, width: s * 0.05 });
    },
    film(ctx, x, y, s, t = 0) {
      K.rect(ctx, x - s, y - s * 0.7, s * 2, s * 1.4, { fill: '#58525e', width: s * 0.06, label: '动画' });
      for (let i = 0; i < 5; i++) {
        const hx = x - s * 0.85 + i * s * 0.4;
        K.rect(ctx, hx, y - s * 0.6, s * 0.2, s * 0.14, { fill: C.cream, stroke: null, noXray: true });
        K.rect(ctx, hx, y + s * 0.46, s * 0.2, s * 0.14, { fill: C.cream, stroke: null, noXray: true });
      }
      K.rect(ctx, x - s * 0.8, y - s * 0.36, s * 1.6, s * 0.72, { fill: C.sky, width: s * 0.04 });
      const bx = x - s * 0.5 + ((t * 0.8) % 1) * s;
      K.circle(ctx, bx, y + s * 0.15 - Math.abs(Math.sin(t * 5)) * s * 0.3, s * 0.14, { fill: C.orange, width: s * 0.04 });
    },
    mic(ctx, x, y, s) {
      K.rect(ctx, x - s * 0.32, y - s * 0.95, s * 0.64, s * 1.05, { radius: s * 0.32, fill: C.gray, width: s * 0.06, label: '配音' });
      K.curve(ctx, [[x - s * 0.55, y - s * 0.2], [x - s * 0.45, y + s * 0.3], [x, y + s * 0.42], [x + s * 0.45, y + s * 0.3], [x + s * 0.55, y - s * 0.2]], { width: s * 0.07 });
      K.line(ctx, x, y + s * 0.42, x, y + s * 0.85, { width: s * 0.07 });
      K.line(ctx, x - s * 0.35, y + s * 0.88, x + s * 0.35, y + s * 0.88, { width: s * 0.07 });
    },
    note(ctx, x, y, s, color = C.purple) {
      K.ellipse(ctx, x - s * 0.45, y + s * 0.55, s * 0.26, s * 0.19, { fill: color, width: s * 0.05, label: '♪' });
      K.ellipse(ctx, x + s * 0.5, y + s * 0.35, s * 0.26, s * 0.19, { fill: color, width: s * 0.05 });
      K.line(ctx, x - s * 0.22, y + s * 0.5, x - s * 0.22, y - s * 0.7, { width: s * 0.07 });
      K.line(ctx, x + s * 0.73, y + s * 0.3, x + s * 0.73, y - s * 0.9, { width: s * 0.07 });
      K.poly(ctx, [[x - s * 0.22, y - s * 0.7], [x + s * 0.73, y - s * 0.9], [x + s * 0.73, y - s * 0.65], [x - s * 0.22, y - s * 0.45]], { fill: C.ink, width: s * 0.04 });
    },
    hand(ctx, x, y, s) {
      for (let i = 0; i < 4; i++) K.rect(ctx, x - s * 0.5 + i * s * 0.27, y - s * 0.95 + Math.abs(i - 1.5) * s * 0.1, s * 0.22, s * 0.8, { radius: s * 0.11, fill: SKIN, width: s * 0.05 });
      K.rect(ctx, x + s * 0.35, y - s * 0.1, s * 0.55, s * 0.24, { radius: s * 0.12, fill: SKIN, width: s * 0.05 });
      K.rect(ctx, x - s * 0.55, y - s * 0.35, s * 1.0, s * 0.95, { radius: s * 0.3, fill: SKIN, width: s * 0.05, label: '手' });
    },
    eye(ctx, x, y, s) {
      K.shape(ctx, [[x - s, y], [x - s * 0.5, y - s * 0.5], [x + s * 0.5, y - s * 0.5], [x + s, y], [x + s * 0.5, y + s * 0.5], [x - s * 0.5, y + s * 0.5]], { closed: true, smooth: true, fill: '#fff', width: s * 0.06, label: '眼睛' });
      K.circle(ctx, x, y, s * 0.36, { fill: C.blue, width: s * 0.05 });
      K.circle(ctx, x, y, s * 0.16, { fill: C.ink, stroke: null });
      K.circle(ctx, x + s * 0.1, y - s * 0.1, s * 0.07, { fill: '#fff', stroke: null, noXray: true });
    },
    ear(ctx, x, y, s) {
      K.shape(ctx, [[x - s * 0.3, y - s * 0.6], [x + s * 0.2, y - s * 0.9], [x + s * 0.65, y - s * 0.4], [x + s * 0.5, y + s * 0.2], [x + s * 0.1, y + s * 0.45], [x, y + s * 0.9], [x - s * 0.4, y + s * 0.7], [x - s * 0.55, y]], { closed: true, smooth: true, fill: SKIN, width: s * 0.06, label: '耳朵' });
      K.curve(ctx, [[x - s * 0.15, y - s * 0.35], [x + s * 0.25, y - s * 0.45], [x + s * 0.3, y - s * 0.05], [x, y + s * 0.15]], { width: s * 0.05 });
    },
    scroll(ctx, x, y, s) {
      K.rect(ctx, x - s * 0.7, y - s * 0.85, s * 1.4, s * 1.7, { fill: C.cream, width: s * 0.06, label: '剧本' });
      for (let i = 0; i < 4; i++) K.line(ctx, x - s * 0.45, y - s * 0.45 + i * s * 0.3, x + s * (i === 3 ? 0.1 : 0.45), y - s * 0.45 + i * s * 0.3, { width: s * 0.05, stroke: C.gray });
      K.ellipse(ctx, x, y - s * 0.85, s * 0.8, s * 0.12, { fill: C.brown, width: s * 0.05 });
      K.ellipse(ctx, x, y + s * 0.85, s * 0.8, s * 0.12, { fill: C.brown, width: s * 0.05 });
    },
    brush(ctx, x, y, s) {
      K.line(ctx, x + s * 0.6, y - s * 0.7, x - s * 0.1, y + s * 0.15, { width: s * 0.16, stroke: C.brown, label: '画面' });
      K.shape(ctx, [[x - s * 0.1, y + s * 0.05], [x + s * 0.05, y + s * 0.25], [x - s * 0.35, y + s * 0.8], [x - s * 0.6, y + s * 0.7]], { closed: true, fill: C.blue, width: s * 0.05 });
    },
    ball(ctx, x, y, s, t = 0) {
      const b = Math.abs(Math.sin(t * 4)) * s * 0.35;
      K.circle(ctx, x, y - b, s * 0.55, { fill: C.orange, width: s * 0.06, label: '动画' });
      K.line(ctx, x - s * 0.9, y + s * 0.6, x + s * 0.9, y + s * 0.6, { width: s * 0.06 });
    },
    camera(ctx, x, y, s) { K.camera(ctx, x, y, s * 0.9); },
    speaker(ctx, x, y, s, t = 0) {
      K.poly(ctx, [[x - s * 0.7, y - s * 0.25], [x - s * 0.35, y - s * 0.25], [x, y - s * 0.6], [x, y + s * 0.6], [x - s * 0.35, y + s * 0.25], [x - s * 0.7, y + s * 0.25]], { fill: C.gray, width: s * 0.06, label: '喇叭' });
      for (let i = 0; i < 3; i++) {
        const r = s * (0.35 + i * 0.25), a = 0.25 + 0.75 * Math.abs(Math.sin(t * 4 - i));
        K.curve(ctx, [[x + r * 0.5, y - r * 0.85], [x + r, y], [x + r * 0.5, y + r * 0.85]], { width: s * 0.06, alpha: a });
      }
    },
    mouth(ctx, x, y, s, t = 0) {
      const o = 0.3 + 0.7 * Math.abs(Math.sin(t * 10));
      K.ellipse(ctx, x, y, s * 0.75, s * (0.15 + 0.4 * o), { fill: C.red, width: s * 0.07, label: '嘴巴' });
      K.ellipse(ctx, x, y + s * 0.05, s * 0.45, s * 0.2 * o, { fill: '#8a3b33', stroke: null, noXray: true });
    },
    magnifier(ctx, x, y, s) {
      K.line(ctx, x + s * 0.35, y + s * 0.35, x + s * 0.85, y + s * 0.85, { width: s * 0.18, stroke: C.brown });
      K.circle(ctx, x - s * 0.1, y - s * 0.1, s * 0.6, { fill: 'rgba(214,236,250,0.7)', width: s * 0.1, label: '检查' });
    }
  };

  K.camera = (ctx, x, y, s) => {
    K.rect(ctx, x - s * 0.15, y - s * 0.62, s * 0.4, s * 0.2, { fill: C.gray, width: s * 0.05 });
    K.rect(ctx, x - s * 0.8, y - s * 0.45, s * 1.6, s * 1.05, { radius: s * 0.15, fill: '#6b6f78', width: s * 0.06, label: 'camera' });
    K.circle(ctx, x, y + s * 0.07, s * 0.36, { fill: C.cream, width: s * 0.06 });
    K.circle(ctx, x, y + s * 0.07, s * 0.2, { fill: C.blue, width: s * 0.04 });
    K.rect(ctx, x + s * 0.45, y - s * 0.35, s * 0.2, s * 0.12, { fill: C.yellow, stroke: null });
  };
  K.pencil = (ctx, x, y, len, a) => {
    const c = Math.cos(a), sn = Math.sin(a), w = len * 0.09;
    const P = (u, v) => [x + c * u - sn * v, y + sn * u + c * v];
    K.poly(ctx, [P(-len * 0.1, -w), P(len * 0.7, -w), P(len * 0.7, w), P(-len * 0.1, w)], { fill: C.yellow, width: len * 0.025, label: 'pencil' });
    K.poly(ctx, [P(len * 0.7, -w), P(len * 0.9, 0), P(len * 0.7, w)], { fill: SKIN, width: len * 0.025 });
    K.poly(ctx, [P(-len * 0.1, -w), P(-len * 0.22, -w), P(-len * 0.22, w), P(-len * 0.1, w)], { fill: C.pink, width: len * 0.025 });
    return P(len * 0.9, 0);
  };
  K.gift = (ctx, x, y, s, open = 0) => {
    K.rect(ctx, x - s, y - s * 0.6, s * 2, s * 1.4, { fill: C.pink, width: s * 0.05, label: 'gift' });
    K.rect(ctx, x - s * 0.15, y - s * 0.6, s * 0.3, s * 1.4, { fill: C.yellow, width: s * 0.04 });
    K.at(ctx, x - s * 1.1, y - s * 0.6, 1, -open * 1.1, () => {
      K.rect(ctx, -s * 0.0, -s * 0.35 - open * s * 0.4, s * 2.2, s * 0.38, { fill: C.pink, width: s * 0.05 });
      K.rect(ctx, s * 0.95, -s * 0.35 - open * s * 0.4, s * 0.3, s * 0.38, { fill: C.yellow, width: s * 0.04 });
    });
  };
  K.clapper = (ctx, x, y, s, open = 0) => {
    K.rect(ctx, x - s, y - s * 0.3, s * 2, s * 1.2, { fill: '#45404b', width: s * 0.05, label: 'clapper' });
    K.at(ctx, x - s, y - s * 0.3, 1, -open * 0.5, () => {
      K.rect(ctx, 0, -s * 0.32, s * 2, s * 0.3, { fill: C.cream, width: s * 0.05 });
      for (let i = 0; i < 4; i++) K.poly(ctx, [[s * 0.1 + i * s * 0.5, -s * 0.32], [s * 0.35 + i * s * 0.5, -s * 0.32], [s * 0.2 + i * s * 0.5, -s * 0.02], [s * -0.05 + i * s * 0.5, -s * 0.02]], { fill: C.ink, stroke: null, noXray: true });
    });
  };
  // 对话气泡（尾巴指向 tx,ty）
  K.bubble = (ctx, x, y, w, h, tx, ty, o = {}) => {
    const r = Math.min(h / 2, 40);
    const pts = [];
    const corner = (cx, cy, a0) => { for (let i = 0; i <= 5; i++) { const a = a0 + (i / 5) * (Math.PI / 2); pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); } };
    corner(x + w - r, y + r, -Math.PI / 2); corner(x + w - r, y + h - r, 0);
    const bx = K.clamp(tx, x + r + 20, x + w - r - 40);
    pts.push([bx + 34, y + h], [tx, ty], [bx, y + h]);
    corner(x + r, y + h - r, Math.PI / 2); corner(x + r, y + r, Math.PI);
    K.shape(ctx, pts, Object.assign({ closed: true, fill: '#fff', width: 4, label: 'bubble' }, o));
  };
  // 拍立得照片：img 是一张离屏 canvas
  K.polaroid = (ctx, x, y, w, img, caption, rot = 0) => {
    const h = w * 0.62;
    K.at(ctx, x, y, 1, rot, () => {
      ctx.save(); ctx.fillStyle = 'rgba(0,0,0,0.12)'; ctx.fillRect(-w / 2 - 12, -h / 2 - 12, w + 34, h + 84); ctx.restore();
      K.rect(ctx, -w / 2 - 18, -h / 2 - 18, w + 36, h + 88, { fill: '#fff', width: 3, label: 'photo' });
      if (img) ctx.drawImage(img, -w / 2, -h / 2, w, h);
      K.rect(ctx, -w / 2, -h / 2, w, h, { width: 2, stroke: C.gray, noXray: true });
      if (caption) K.text(ctx, caption, 0, h / 2 + 36, { size: 30 });
      K.circle(ctx, 0, -h / 2 - 22, 12, { fill: C.red, width: 3, noXray: true });
    });
  };
  // 一小幅风景：太阳、房子、树（canvas 那一幕会一笔一笔画出来）
  K.landscape = (ctx, x, y, s, P = {}) => {
    const p = (k) => (P[k] == null ? 1 : P[k]);
    const col = p('color');
    if (p('grass') > 0) K.rect(ctx, x - s * 3.2, y + s * 0.95, s * 6.4, s * 0.5, { fill: C.green, hachure: true, gap: 14, width: 4, p: p('grass'), label: 'rect(草地)' });
    K.circle(ctx, x + s * 2.0, y - s * 1.55, s * 0.5, { fill: col > 0 ? C.yellow : null, fillAlpha: col, width: 5, p: p('sun'), label: 'circle(太阳)' });
    if (p('sun') >= 1) for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + 0.2, r1 = s * 0.68, r2 = s * 0.88;
      K.line(ctx, x + s * 2.0 + Math.cos(a) * r1, y - s * 1.55 + Math.sin(a) * r1, x + s * 2.0 + Math.cos(a) * r2, y - s * 1.55 + Math.sin(a) * r2, { width: 5, p: K.clamp(p('sun') * 1), noXray: true });
    }
    K.rect(ctx, x - s * 1.4, y - s * 0.2, s * 1.9, s * 1.2, { fill: col > 0 ? C.cream : null, fillAlpha: col, width: 5, p: p('house'), label: 'rect(房子)' });
    if (p('house') >= 1) {
      K.rect(ctx, x - s * 0.65, y + s * 0.3, s * 0.45, s * 0.7, { fill: col > 0 ? C.brown : null, fillAlpha: col, width: 4, label: 'rect(门)' });
      K.rect(ctx, x + s * 0.0, y + s * 0.05, s * 0.35, s * 0.35, { fill: col > 0 ? C.sky : null, fillAlpha: col, width: 4, noXray: true });
    }
    K.poly(ctx, [[x - s * 1.6, y - s * 0.2], [x - s * 0.45, y - s * 1.15], [x + s * 0.7, y - s * 0.2]], { fill: col > 0 ? C.red : null, fillAlpha: col, width: 5, p: p('roof'), label: 'triangle(屋顶)' });
    K.rect(ctx, x + s * 1.55, y + s * 0.15, s * 0.28, s * 0.85, { fill: col > 0 ? C.brown : null, fillAlpha: col, width: 4, p: p('tree'), label: 'rect(树干)' });
    K.circle(ctx, x + s * 1.69, y - s * 0.25, s * 0.55, { fill: col > 0 ? C.green : null, fillAlpha: col, width: 5, p: p('tree'), label: 'circle(树冠)' });
  };
})();
