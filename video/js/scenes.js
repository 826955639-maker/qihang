// 分镜：12 幕，每一幕是一个函数 (ctx, t, S)。
// t = 这一幕开始后的秒数；S.at(第几句, 某个词) = 那个词被读到的时刻，画面就靠它和配音对齐。
(function () {
  const C = K.C, E = K.ease;
  const SC = (window.SCENES = {});
  const ke = (ctx, S, x, y, s, o = {}) => K.ke(ctx, x, y, s, Object.assign({ t: S.abs, talk: S.talking }, o));
  const title = (ctx, str, y, a = 1, size = 76) => K.fade(ctx, a, () => K.text(ctx, str, 960, y, { size, color: C.ink }));
  // 某个时刻之后弹出、之后再收起
  const life = (t, a, b, fin = 0.45, fout = 0.35) => K.pop(t, a, fin) * (b == null ? 1 : 1 - E.in(K.prog(t, b, fout)));

  // ① 开场：一个只会打字的作者
  SC.hook = (ctx, t, S) => {
    const a1 = S.at(1), a2 = S.at(2), a3 = S.at(3), a4 = S.at(4);
    const q = K.pop(t, S.at(0), 0.6) * (1 - E.in(K.prog(t, a1, 0.5)));
    K.at(ctx, 960, 470, q, Math.sin(S.abs * 2.2) * 0.08, () => K.text(ctx, '？', 0, 0, { size: 440, color: C.orange, outline: C.ink, outlineWidth: 20, seed: 3 }));

    const icons = [['picture', '画面'], ['film', '动画'], ['mic', '配音'], ['note', '音乐']];
    icons.forEach(([ic, label], i) => {
      const s = life(t, S.at(1, label), a2);
      const x = 420 + i * 360;
      K.at(ctx, x, 450, s, 0, () => {
        K.icon[ic](ctx, 0, 0, 105, S.abs);
        K.text(ctx, label, 0, 185, { size: 60 });
      });
    });

    const who = life(t, a2, a3);
    K.at(ctx, 470, 470, who, 0, () => {
      K.circle(ctx, 0, 0, 150, { fill: '#5b5562', width: 7, label: '作者？' });
      K.text(ctx, '?', 0, 0, { size: 150, color: '#fff' });
      K.text(ctx, '神秘作者', 0, 220, { size: 54 });
    });
    [['hand', '没有手'], ['eye', '没有眼睛'], ['ear', '也没有耳朵']].forEach(([ic, w], i) => {
      const at = S.at(2, w), s = life(t, at, a3);
      K.at(ctx, 930 + i * 330, 470, s, 0, () => {
        K.icon[ic](ctx, 0, 0, 105);
        K.cross(ctx, 0, 0, 105, { p: K.prog(t, at + 0.35, 0.35), width: 22 });
      });
    });

    const kb = life(t, a3, a4);
    if (kb > 0) {
      const t0 = S.at(3, '打字') - 0.1;
      K.at(ctx, 960, 560, kb, 0, () => {
        K.rect(ctx, -420, -400, 840, 220, { fill: '#fff', width: 5, label: 'paper' });
        const msg = '你好，我只会打字……';
        const p = K.prog(t, t0, 1.6);
        const w = K.text(ctx, msg, -370, -290, { size: 64, align: 'left', p, seed: 9 }) || 0;
        if (Math.floor(S.abs * 2.5) % 2 === 0) K.line(ctx, -360 + w + 10, -325, -360 + w + 10, -255, { width: 5, stroke: C.blue, noXray: true });
        K.rect(ctx, -500, -120, 1000, 340, { radius: 30, fill: '#e4dccb', width: 6, label: 'keyboard' });
        const R = K.rng(Math.floor(S.abs * 12));
        const hot = p > 0 && p < 1 ? Math.floor(R() * 30) : -1;
        for (let r = 0; r < 3; r++) for (let c = 0; c < 10; c++) {
          const k = r * 10 + c;
          K.rect(ctx, -455 + c * 90 + r * 20, -90 + r * 90, 74, 70, { radius: 12, fill: k === hot ? C.yellow : '#fffaf0', width: 3.5, seed: 500 + k, noXray: k % 7 !== 0 });
        }
        K.rect(ctx, -250, 180, 500, 26, { radius: 10, fill: '#fffaf0', width: 3.5, noXray: true });
      });
    }

    const ttl = K.prog(t, a4, 0.4);
    if (ttl > 0) {
      K.text(ctx, '一个只会打字的 AI，', 960, 360, { size: 120, p: K.prog(t, a4 + 0.1, 1.0), seed: 21 });
      K.text(ctx, '怎么做出一个视频？', 960, 540, { size: 140, color: C.orange, outline: C.ink, outlineWidth: 14, p: K.prog(t, a4 + 1.2, 1.0), seed: 22 });
      K.curve(ctx, [[420, 650], [800, 630], [1200, 660], [1520, 635]], { width: 9, stroke: C.blue, p: K.prog(t, a4 + 2.2, 0.6) });
      for (let i = 0; i < 4; i++) {
        const s = K.pop(t, a4 + 2.4 + i * 0.15, 0.4);
        K.at(ctx, [330, 1600, 1560, 380][i], [280, 300, 600, 620][i], s, S.abs, () => K.sparkle(ctx, 0, 0, 40 + (i % 2) * 15));
      }
      const peek = E.out(K.prog(t, a4 + 3.0, 0.8));
      ke(ctx, S, K.lerp(2150, 1740, peek), 820, 130, { mood: 'surprised', look: [-1, -0.3], talk: false });
    }
  };

  // ② 我是小克
  SC.intro = (ctx, t, S) => {
    const land = S.at(0);
    const fall = K.prog(t, land - 0.45, 0.45);
    const y = 560 - (1 - E.in(fall)) * 1100;
    const sq = t > land ? Math.sin((t - land) * 22) * Math.exp(-(t - land) * 6) : -0.3 * fall;
    const writing = t > S.at(1, '写出来') - 0.2;
    ke(ctx, S, 560, y, 190, { squash: sq, arm: writing ? null : 'wave', pencil: writing, bob: t > land + 0.5 });
    K.text(ctx, '我是 小克', 1280, 300, { size: 140, p: K.prog(t, S.at(0, '小克') - 0.3, 0.6), colors: [C.ink, C.ink, C.ink, C.orange, C.orange] });
    K.text(ctx, 'Claude Opus 5.5 的卡通替身', 1280, 440, { size: 58, color: '#555', p: K.prog(t, S.at(0, 'Claude'), 1.0) });
    const items = [['scroll', '剧本', C.cream], ['picture', '画面', C.sky], ['film', '动画', '#ddd'], ['mic', '配音', C.yellow], ['note', '音乐', C.pink]];
    items.forEach(([ic, label, col], i) => {
      const s = K.pop(t, S.at(1, label) - 0.1, 0.5);
      const x = 900 + i * 190, yy = 650 + Math.sin(S.abs * 2 + i) * 8;
      K.at(ctx, x, yy, s, 0, () => {
        K.circle(ctx, 0, 0, 82, { fill: col, width: 5 });
        K.at(ctx, 0, 0, 0.42, 0, () => K.icon[ic](ctx, 0, 0, 105, S.abs));
        K.text(ctx, label, 0, 125, { size: 44 });
      });
    });
    const sp = K.prog(t, S.at(1, '写出来'), 1.2);
    if (sp > 0 && sp < 1) for (let i = 0; i < 6; i++) {
      const a = i * 1.05 + sp * 2, r = 230 + sp * 120;
      K.fade(ctx, 1 - sp, () => K.sparkle(ctx, 560 + Math.cos(a) * r, 560 + Math.sin(a) * r * 0.8, 30));
    }
  };

  // ③ 秘密：视频 = 很多张图在快速翻页
  SC.flipbook = (ctx, t, S) => {
    const a0 = S.at(0, '一张一张'), merge = S.at(0, '快速'), a2 = S.at(2);
    ke(ctx, S, 230, 640, 115, { arm: 'point', pointAngle: 0.3, look: [1, 0] });
    const phases = [0.02, 0.25, 0.5, 0.75];
    const stackX = 1100, stackY = 430;
    const m = E.inOut(K.prog(t, merge, 0.7));
    const fade2 = 1 - K.prog(t, a2 - 0.2, 0.4);
    if (m < 1) phases.forEach((ph, i) => {
      const s = K.pop(t, a0 + i * 0.25, 0.45);
      const x = K.lerp(600 + i * 320, stackX, m), y = K.lerp(430, stackY, m);
      K.at(ctx, x, y, s, K.lerp((i - 1.5) * 0.04, 0, m), () => {
        K.rect(ctx, -125, -150, 250, 300, { fill: '#fff', width: 5, seed: 40 + i });
        K.stick(ctx, 0, 125, 85, ph, { seed: 60 + i * 20 });
        K.fade(ctx, 1 - m, () => K.text(ctx, `第 ${i + 1} 张`, 0, 200, { size: 44 }));
      });
    });
    if (m >= 1) K.fade(ctx, fade2, () => {
      for (let k = 4; k >= 1; k--) K.rect(ctx, stackX - 150 + k * 9, stackY - 175 + k * 9, 300, 350, { fill: '#fff', width: 4, seed: 70 + k, noXray: true });
      K.rect(ctx, stackX - 150, stackY - 175, 300, 350, { fill: '#fff', width: 5, seed: 75, label: 'flipbook' });
      const flipping = t > S.at(1);
      const fps = 12, fi = flipping ? Math.floor(S.abs * fps) : 0;
      K.stick(ctx, stackX, stackY + 150, 95, flipping ? (fi % 10) / 10 : 0.02, { seed: 80 });
      if (flipping) {
        const u = (S.abs * fps) % 1;
        K.poly(ctx, [[stackX + 150, stackY + 175 - 120 * (1 - u)], [stackX + 150 - 120 * (1 - u), stackY + 175], [stackX + 150 - 60 * (1 - u), stackY + 175 - 60 * (1 - u)]], { fill: '#f1ece0', width: 3, seed: 90, noXray: true });
      }
      K.text(ctx, '每秒翻 30 张', stackX, 720, { size: 66, p: K.prog(t, S.at(1, '每秒'), 0.6), color: C.orange, outline: C.ink, outlineWidth: 8 });
      const e = K.pop(t, S.at(1, '骗') - 0.2, 0.5);
      K.at(ctx, 1580, 360, e, 0, () => {
        K.icon.eye(ctx, 0, 0, 95);
        K.text(ctx, '被骗啦！', 0, 150, { size: 56, color: C.red });
      });
    });
    const c = K.prog(t, a2 - 0.1, 0.4);
    if (c > 0) {
      const total = Math.round(window.TIMING.total * 30);
      const n = Math.round(total * E.out(K.prog(t, S.at(2, '几千张'), 1.5)));
      K.fade(ctx, c, () => {
        K.text(ctx, '这个视频，我一共要画', 1110, 290, { size: 68 });
        K.text(ctx, n.toLocaleString('en-US'), 1110, 480, { size: 230, color: C.orange, outline: C.ink, outlineWidth: 16, jitter: 0.6 });
        K.text(ctx, '张图', 1110, 670, { size: 80 });
      });
    }
  };

  // ④ 画布：说一句，画一笔
  SC.canvas = (ctx, t, S) => {
    const pad = K.pop(t, S.at(0) + 0.2, 0.5);
    K.at(ctx, 480, 500, pad, 0, () => {
      K.rect(ctx, -360, -350, 720, 700, { fill: '#fff', width: 5, label: 'notepad' });
      for (let i = 0; i < 6; i++) K.line(ctx, -330, -190 + i * 110, 330, -190 + i * 110, { stroke: '#bcd8f0', width: 2.5, noXray: true });
      K.line(ctx, -280, -340, -280, 340, { stroke: '#f2a3a3', width: 3, noXray: true });
      K.text(ctx, '我写的字', 0, -290, { size: 50, color: C.blue });
    });
    const board = K.pop(t, S.at(0, '画布'), 0.5);
    K.at(ctx, 1360, 470, board, 0, () => {
      K.line(ctx, -300, 300, -380, 420, { width: 9, stroke: C.brown, noXray: true });
      K.line(ctx, 300, 300, 380, 420, { width: 9, stroke: C.brown, noXray: true });
      K.rect(ctx, -440, -320, 880, 640, { fill: '#fffdf7', width: 7, label: 'canvas 画布' });
      K.text(ctx, '画布 Canvas', 0, 375, { size: 52, color: C.brown });
    });
    const D2 = S.D[2];
    const cmds = [
      ['画一个圆', 'ctx.arc(x, y, 半径)', S.at(1, '画一个圆') - 0.4, S.at(1, '画了出来') - 0.5, 'sun'],
      ['画一个方块', 'ctx.rect(x, y, 宽, 高)', S.at(2) + D2 * 0.12 - 0.5, S.at(2) + D2 * 0.12, 'house'],
      ['画一个三角', 'ctx.lineTo(…) ×3', S.at(2) + D2 * 0.3 - 0.5, S.at(2) + D2 * 0.3, 'roof'],
      ['画一棵树', 'ctx.arc(…) + rect(…)', S.at(2) + D2 * 0.48 - 0.5, S.at(2) + D2 * 0.48, 'tree'],
      ['涂上颜色', 'ctx.fill()', S.at(2) + D2 * 0.66 - 0.5, S.at(2) + D2 * 0.66, 'color']
    ];
    const P = {};
    cmds.forEach(([zh, code, ty, draw, part], i) => {
      const y = 330 + i * 110;
      K.text(ctx, zh, 230, y - 18, { size: 50, align: 'left', p: K.prog(t, ty, 0.5), seed: 300 + i });
      K.text(ctx, code, 232, y + 28, { size: 25, align: 'left', font: K.MONO, color: '#888', p: K.prog(t, ty + 0.3, 0.4), jitter: 0, seed: 320 + i, noXray: true });
      P[part] = K.prog(t, draw, part === 'color' ? 0.6 : 0.8);
      if (t > ty && t < draw + 0.8) K.arrow(ctx, 760, y, 860, K.lerp(y, 470, 0.3), { width: 5, stroke: C.orange, p: K.prog(t, ty + 0.2, 0.3), noXray: true });
    });
    P.grass = P.color;
    if (board > 0.5) K.landscape(ctx, 1330, 500, 105, P);
    if (P.color > 0.9) K.text(ctx, '完成！', 1630, 230, { size: 60, color: C.red, p: 1 });
  };

  // ⑤ 手绘感的秘密：故意抖一抖
  SC.rough = (ctx, t, S) => {
    K.line(ctx, 960, 130, 960, 830, { stroke: C.gray, width: 3, noXray: true, seed: 5 });
    K.text(ctx, '电脑画的', 480, 190, { size: 66 });
    // 完美版：直接用 Canvas 原生画，没有任何抖动
    ctx.save();
    ctx.lineWidth = 8; ctx.strokeStyle = '#555'; ctx.fillStyle = '#e6e6e6';
    ctx.beginPath(); ctx.arc(480, 470, 160, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#555';
    ctx.beginPath(); ctx.arc(425, 430, 16, 0, Math.PI * 2); ctx.arc(535, 430, 16, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.moveTo(410, 535); ctx.lineTo(550, 535); ctx.stroke();
    ctx.restore();
    K.text(ctx, '太完美，冷冰冰', 480, 720, { size: 50, color: '#777', jitter: 0 });

    const show = S.at(1, '抖一点点') - 0.6, boiling = t > S.at(2) - 0.1;
    K.text(ctx, '小克画的', 1440, 190, { size: 66, p: K.prog(t, show, 0.4), color: C.orange });
    if (t > show) {
      const p = K.prog(t, show, 1.4), still = !boiling;
      K.circle(ctx, 1440, 470, 160, { fill: C.yellow, width: 8, p, still, seed: 11 });
      K.circle(ctx, 1385, 430, 16, { fill: C.ink, stroke: null, p: K.prog(t, show + 0.8, 0.2), still, seed: 12 });
      K.circle(ctx, 1495, 430, 16, { fill: C.ink, stroke: null, p: K.prog(t, show + 0.9, 0.2), still, seed: 13 });
      K.curve(ctx, [[1370, 520], [1440, 570], [1510, 520]], { width: 8, p: K.prog(t, show + 1.0, 0.4), still, seed: 14 });
      K.ellipse(ctx, 1340, 500, 26, 14, { fill: C.pink, stroke: null, fillAlpha: 0.8, still, seed: 15 });
      K.ellipse(ctx, 1540, 500, 26, 14, { fill: C.pink, stroke: null, fillAlpha: 0.8, still, seed: 16 });
      K.text(ctx, '有手感，暖乎乎', 1440, 720, { size: 50, p: K.prog(t, show + 1.3, 0.6), still });
    }
    if (boiling) {
      const s = K.pop(t, S.at(2, '线条沸腾') - 0.3, 0.5);
      K.at(ctx, 1730, 330, s, 0, () => {
        ctx.save();
        ctx.beginPath(); ctx.arc(0, 0, 120, 0, Math.PI * 2); ctx.clip();
        ctx.fillStyle = C.paper; ctx.fillRect(-130, -130, 260, 260);
        // 放大笑脸右上方的一段轮廓：同一个种子，所以和主图抖得一模一样
        ctx.scale(3, 3); ctx.translate(-1572, -380);
        K.circle(ctx, 1440, 470, 160, { fill: C.yellow, width: 8, seed: 11, noXray: true });
        ctx.restore();
        K.circle(ctx, 0, 0, 120, { width: 8, stroke: C.brown, seed: 17, noXray: true });
        K.line(ctx, 85, 85, 160, 160, { width: 18, stroke: C.brown, seed: 18, noXray: true });
      });
      const b = K.boilIndex() % 8;
      K.fade(ctx, K.prog(t, S.at(2, '每秒'), 0.4), () => {
        K.text(ctx, '每秒换 8 次', 1440, 810, { size: 44, color: '#555' });
        for (let i = 0; i < 8; i++) K.text(ctx, String(i + 1), 1230 + i * 60, 870, { size: i === b ? 58 : 38, color: i === b ? C.orange : C.gray, still: true, jitter: 0, noXray: true });
      });
    }
    const wink = life(t, S.at(1, '小心机') - 0.3, S.at(2) + 0.5);
    K.at(ctx, 960, 880, wink, 0, () => ke(ctx, S, 0, 0, 70, { mood: 'wink', talk: false }));
  };

  // ⑥ 动起来：匀速 vs 缓动，压扁和拉长
  SC.easing = (ctx, t, S) => {
    const a1 = S.at(1), a2 = S.at(2);
    const tracks = K.prog(t, 0, 0.4) * (1 - K.prog(t, a2 - 0.2, 0.4));
    const loop = (u0) => K.clamp(((S.abs - u0) % 2.6) / 2.1);
    K.fade(ctx, tracks, () => {
      title(ctx, t < a1 ? '每一张图，挪一点点' : '匀速  vs  缓动', 140, 1, 68);
      const rows = [{ y: 380, ease: (u) => u, label: '匀速：像机器人', col: C.gray, robot: true }];
      if (t > a1 - 0.2) rows.push({ y: 680, ease: E.inOut, label: '缓动：先加速、再减速', col: C.orange });
      rows.forEach((r, ri) => {
        const a = ri ? K.prog(t, S.at(1, '真实世界'), 0.5) : 1;
        K.fade(ctx, a, () => {
          K.text(ctx, r.label, 230, r.y - 105, { size: 46, align: 'left', color: ri ? C.orange : '#666' });
          K.line(ctx, 230, r.y + 55, 1690, r.y + 55, { width: 4, seed: 200 + ri, noXray: true });
          for (let k = 0; k <= 12; k++) {
            const x = K.lerp(300, 1620, r.ease(k / 12));
            K.circle(ctx, x, r.y, 45, { stroke: r.col, width: 2.5, alpha: 0.4, seed: 210 + ri * 20 + k, noXray: k % 4 !== 0, label: `第${k + 1}张` });
          }
          const x = K.lerp(300, 1620, r.ease(loop(0)));
          K.circle(ctx, x, r.y, 45, { fill: r.col, width: 5, seed: 260 + ri });
          if (r.robot) { K.rect(ctx, x - 22, r.y - 14, 12, 12, { fill: C.ink, stroke: null, noXray: true }); K.rect(ctx, x + 10, r.y - 14, 12, 12, { fill: C.ink, stroke: null, noXray: true }); K.line(ctx, x - 16, r.y + 16, x + 16, r.y + 16, { width: 4, noXray: true }); }
          else { K.circle(ctx, x - 14, r.y - 8, 6, { fill: C.ink, stroke: null, noXray: true }); K.circle(ctx, x + 14, r.y - 8, 6, { fill: C.ink, stroke: null, noXray: true }); K.curve(ctx, [[x - 16, r.y + 10], [x, r.y + 22], [x + 16, r.y + 10]], { width: 4, noXray: true }); }
        });
      });
    });
    const b = K.prog(t, a2 - 0.2, 0.4);
    if (b > 0) K.fade(ctx, b, () => {
      title(ctx, '缓动 + 压扁 + 拉长 = 弹性！', 150, 1, 70);
      const T0 = S.at(2, '压扁'), P = 1.0, G = 790, Hmax = 480;
      K.line(ctx, 520, G, 1400, G, { width: 6, seed: 280 });
      // 落地时刻 T0, T0+P, T0+2P, T0+3P（和"咚"的音效同一时间）；每次弹起矮一点
      let h, v, sx = 1, sy = 1;
      const k = Math.floor((t - T0) / P);
      if (t < T0 - P / 2) { h = Hmax; v = 0; }
      else if (t < T0) { const u = (t - (T0 - P / 2)) / (P / 2); h = Hmax * (1 - u * u); v = u; }
      else if (k < 3) { const u = (t - T0) / P - k; h = 4 * Hmax * Math.pow(0.72, k + 1) * u * (1 - u); v = Math.abs(1 - 2 * u) * Math.pow(0.85, k); }
      else { h = 0; v = 0; }
      let near = 1e9;
      for (let i = 0; i < 4; i++) near = Math.min(near, Math.abs(t - (T0 + i * P)));
      const sqz = near < 0.08 ? 1 - near / 0.08 : 0;
      const settle = t > T0 + 3 * P ? Math.exp(-(t - T0 - 3 * P) * 5) * Math.cos((t - T0 - 3 * P) * 18) * 0.5 : 0;
      if (sqz > 0 || settle) { const a = sqz > 0 ? sqz : settle; sx = 1 + 0.42 * a; sy = 1 - 0.42 * a; }
      else { const st = v * 0.28; sx = 1 - st * 0.5; sy = 1 + st; }
      const r = 75, y = G - h - r * sy;
      ctx.save(); ctx.translate(960, y + r * sy); ctx.scale(sx, sy); ctx.translate(0, -r);
      K.circle(ctx, 0, 0, r, { fill: C.orange, width: 6, seed: 290, label: 'ball' });
      K.circle(ctx, -22, -14, 9, { fill: C.ink, stroke: null, seed: 291, noXray: true });
      K.circle(ctx, 22, -14, 9, { fill: C.ink, stroke: null, seed: 292, noXray: true });
      K.curve(ctx, [[-22, 16], [0, 30], [22, 16]], { width: 5, seed: 293, noXray: true });
      ctx.restore();
      for (let i = 0; i < 4; i++) {
        const at = T0 + i * P, a = K.pop(t, at - 0.05, 0.3) * (1 - K.prog(t, at + 0.5, 0.3));
        K.at(ctx, 1160, G - 40, a, 0, () => K.text(ctx, '压扁！', 0, 0, { size: 56, color: C.red }));
        const m = at + P * 0.25, a2b = i < 3 ? K.pop(t, m - 0.05, 0.3) * (1 - K.prog(t, m + 0.4, 0.3)) : 0;
        K.at(ctx, 760, G - 330, a2b, 0, () => K.text(ctx, '拉长～', 0, 0, { size: 56, color: C.blue }));
      }
    });
    ke(ctx, S, 1790, 175, 70, { look: [-1, 0.5], talk: false });
  };

  // ⑦ 配音：语音合成 + 语音识别"耳朵"
  SC.voice = (ctx, t, S) => {
    const a1 = S.at(1), a2 = S.at(2);
    const wave = (x0, x1, y, amp, seed) => {
      for (let i = 0; i < 18; i++) {
        const x = K.lerp(x0, x1, i / 17), h = amp * (0.3 + 0.7 * Math.abs(Math.sin(S.abs * 7 + i * 1.7) * Math.sin(i * 0.9 + 1)));
        K.line(ctx, x, y - h, x, y + h, { width: 9, stroke: C.blue, seed: seed + i, noXray: i % 6 !== 0, label: 'sound wave' });
      }
    };
    const card = (x, y, txt, label, s) => K.at(ctx, x, y, s, 0, () => {
      K.text(ctx, label, 0, -100, { size: 36, color: '#777' });
      K.rect(ctx, -150, -65, 300, 130, { fill: '#fff', width: 5 });
      K.text(ctx, txt, 0, 0, { size: 56 });
    });
    const box = (x, y, txt, icon, col, s) => K.at(ctx, x, y, s, 0, () => {
      K.rect(ctx, -160, -95, 320, 190, { radius: 26, fill: col, width: 6, label: txt });
      K.at(ctx, -80, 0, 0.55, 0, () => K.icon[icon](ctx, 0, 0, 105, S.abs));
      K.text(ctx, txt.slice(0, 2), 55, -30, { size: 50 });
      K.text(ctx, txt.slice(2), 55, 32, { size: 50 });
    });
    const Y1 = 290, Y2 = 640;
    card(330, Y1, '你好呀！', '原稿', K.pop(t, S.at(0), 0.5));
    K.arrow(ctx, 500, Y1, 620, Y1, { width: 6, p: K.prog(t, S.at(0, '语音合成') - 0.3, 0.3) });
    box(800, Y1, '语音合成', 'mouth', C.yellow, K.pop(t, S.at(0, '语音合成'), 0.5));
    K.arrow(ctx, 980, Y1, 1100, Y1, { width: 6, p: K.prog(t, S.at(0, '读成声音') - 0.2, 0.3) });
    const w1 = K.prog(t, S.at(0, '读成声音'), 0.5);
    if (w1 > 0) K.fade(ctx, w1, () => { wave(1150, 1520, Y1, 60, 600); K.icon.speaker(ctx, 1660, Y1, 75, S.abs); });

    const m = life(t, a1 - 0.1, a2 - 0.2);
    K.at(ctx, 700, 660, m, 0, () => {
      ke(ctx, S, 0, 0, 125, { mood: 'surprised' });
      K.at(ctx, 0, 0, K.pop(t, S.at(1, '听不见') - 0.2, 0.4), 0, () => {
        K.bubble(ctx, 190, -150, 470, 130, 120, -30);
        K.text(ctx, '我听不见呀！', 425, -85, { size: 56, color: C.red });
      });
    });
    if (t > a2 - 0.2) {
      const p = (w, d = 0) => K.prog(t, S.at(2, w) + d, 0.4);
      K.fade(ctx, p('语音识别', -0.6), () => wave(1150, 1520, Y2, 45, 650));
      K.arrow(ctx, 1110, Y2, 990, Y2, { width: 6, p: p('语音识别', -0.3) });
      box(800, Y2, '语音识别', 'ear', '#c9f0c4', K.pop(t, S.at(2, '语音识别'), 0.5));
      K.arrow(ctx, 620, Y2, 500, Y2, { width: 6, p: p('听写成文字', -0.1) });
      card(330, Y2, '你好呀！', '听写结果', K.pop(t, S.at(2, '听写成文字') + 0.3, 0.5));
      const ok = K.pop(t, S.at(2, '对上了') - 0.1, 0.5);
      K.at(ctx, 330, (Y1 + Y2) / 2 + 10, ok, 0, () => { K.text(ctx, '=', -70, 0, { size: 90, color: C.green }); K.check(ctx, 60, 0, 90); });
      const A = window.TIMING.asr || { lines: 0, mean: 1 };
      K.text(ctx, `全部 ${A.lines} 句逐句听写比对，平均吻合 ${Math.round(A.mean * 100)}%`, 1130, 830, { size: 46, p: K.prog(t, S.at(2, '才算过关') - 0.2, 1.0), color: '#2e7d32' });
    }
  };

  // ⑧ 音乐 = 数学
  SC.music = (ctx, t, S) => {
    const a1 = S.at(1), a2 = S.at(2);
    const top = K.prog(t, a1, 0.6);
    K.text(ctx, '音乐 = 数学', 960, K.lerp(360, 150, E.inOut(top)), { size: K.lerp(140, 72, E.inOut(top)), p: K.prog(t, S.at(0, '音乐'), 0.8), colors: [C.purple, C.purple, C.ink, C.blue, C.blue] });
    if (top < 1) K.fade(ctx, 1 - top, () => {
      K.at(ctx, 420, 620, K.pop(t, S.at(0, '数学') - 0.2, 0.5), Math.sin(S.abs * 2) * 0.1, () => K.icon.note(ctx, 0, 0, 110));
      K.at(ctx, 1500, 620, K.pop(t, S.at(0, '数学'), 0.5), 0, () => K.text(ctx, '440 × 2 = 880', 0, 0, { size: 70, font: K.MONO, color: C.blue }));
    });
    const wv = K.prog(t, a1 - 0.2, 0.5) * (1 - K.prog(t, a2 - 0.2, 0.4));
    if (wv > 0) K.fade(ctx, wv, () => {
      const tone = S.at(1, '四百四十') - 0.4, on = K.prog(t, tone, 0.2) * (1 - K.prog(t, tone + 2.2, 0.4));
      const amp = 20 + 130 * on, pts = [];
      for (let i = 0; i <= 140; i++) { const x = K.lerp(220, 1700, i / 140); pts.push([x, 500 + Math.sin(i / 140 * Math.PI * 2 * 9 - S.abs * 14 * (0.3 + on)) * amp]); }
      K.shape(ctx, pts, { width: 7, stroke: C.purple, rough: 0.35, label: 'sin(2π × 440 × t)' });
      K.text(ctx, '啦（A）', 250, 300, { size: 60, align: 'left', p: K.prog(t, S.at(1, '啦') - 0.2, 0.4), color: C.purple });
      K.text(ctx, '每秒振动 440 次', 960, 760, { size: 76, color: C.orange, outline: C.ink, outlineWidth: 9, p: K.prog(t, tone + 0.2, 0.8) });
    });
    const pk = K.prog(t, a2 - 0.2, 0.5);
    if (pk > 0) K.fade(ctx, pk, () => {
      const M = window.SCORE, now = S.abs;
      const bar = Math.floor((now - M.g0) / M.bar);
      M.chords.forEach((c, i) => {
        const cur = bar >= 0 && bar % 4 === i;
        K.text(ctx, c.name, 660 + i * 200, 300, { size: cur ? 100 : 64, color: cur ? C.orange : C.gray, still: !cur });
      });
      K.text(ctx, '和弦', 380, 300, { size: 48, color: '#777' });
      const white = [], black = [];
      for (let m = 60, wi = 0; m <= 84; m++) {
        const isB = [1, 3, 6, 8, 10].includes(m % 12);
        if (isB) black.push({ m, x: 285 + wi * 90 - 27 }); else white.push({ m, x: 285 + wi++ * 90 });
      }
      const lit = new Map();
      for (const e of M.events) {
        if (e.t > now) break;
        if ((e.i === 'mel' || e.i === 'pluck') && now < e.t + Math.min(e.d, 0.3)) lit.set(e.m, e.i);
      }
      white.forEach((k, i) => K.rect(ctx, k.x, 480, 90, 330, { fill: lit.get(k.m) === 'mel' ? C.orange : lit.get(k.m) ? '#bfe1fb' : '#fff', width: 4, seed: 700 + i, noXray: i % 4 !== 0, label: `key ${k.m}` }));
      black.forEach((k, i) => K.rect(ctx, k.x, 480, 54, 200, { fill: lit.get(k.m) === 'mel' ? C.orange : C.ink, width: 3, seed: 740 + i, noXray: true }));
      for (const e of M.events) {
        if (e.i !== 'mel' || e.t > now || now - e.t > 2.2) continue;
        const k = white.find((w) => w.m === e.m) || black.find((b) => b.m === e.m);
        if (!k) continue;
        const age = now - e.t;
        K.fade(ctx, 1 - age / 2.2, () => K.at(ctx, k.x + 45, 450 - age * 140, 0.32, Math.sin(age * 4) * 0.3, () => K.icon.note(ctx, 0, 0, 100, [C.purple, C.pink, C.blue][e.m % 3])));
      }
    });
  };

  // ⑨ 检查：给自己拍照
  const thumbs = {};
  function thumb(key, sceneId, rel, extra) {
    if (thumbs[key]) return thumbs[key];
    const c = document.createElement('canvas'); c.width = 480; c.height = 270;
    const g = c.getContext('2d');
    const xr = K.xray, bo = K.boilOn; K.xray = false; K.boilOn = false;
    g.scale(0.25, 0.25); K.paper(g);
    const S = window.makeS(sceneId, rel);
    window.SCENES[sceneId](g, rel, S);
    if (extra) extra(g);
    K.xray = xr; K.boilOn = bo;
    return (thumbs[key] = c);
  }
  SC.check = (ctx, t, S) => {
    K.rect(ctx, 760, 110, 1080, 720, { fill: '#d8b384', width: 7, seed: 800, label: 'cork board' });
    const s1 = S.at(0, '拍照'), s2 = s1 + 1.0, s3 = S.at(1, '改完再拍');
    ke(ctx, S, 360, 560, 150, { camera: true });
    const tCanvas = window.TIMING.scenes.find((s) => s.id === 'canvas');
    const tIntro = window.TIMING.scenes.find((s) => s.id === 'intro');
    const img1 = thumb('a', 'canvas', tCanvas.dur - 0.5);
    const img2 = thumb('b', 'intro', tIntro.lines[1].t - 0.3, (g) => { K.rect(g, 980, 180, 620, 300, { fill: '#9b8f85', width: 6, still: true }); K.text(g, '贴纸', 1290, 330, { size: 90, color: '#fff', still: true }); });
    const img3 = thumb('c', 'intro', tIntro.lines[1].t - 0.3);
    const fly = (img, at, x, y, rot, cap) => {
      if (t < at) return;
      const u = E.out(K.prog(t, at, 0.7));
      K.at(ctx, K.lerp(470, x, u), K.lerp(520, y, u), K.lerp(0.3, 1, u), K.lerp(0.6, rot, u), () => K.polaroid(ctx, 0, 0, 340, img, cap, 0));
    };
    fly(img1, s1, 1030, 300, -0.05, '风景');
    fly(img2, s2, 1530, 310, 0.06, '自我介绍');
    const bad = K.prog(t, S.at(1, '挡住') - 0.3, 0.5);
    if (bad > 0 && t < s3 + 0.5) {
      K.circle(ctx, 1590, 280, 110, { stroke: C.red, width: 8, p: bad, seed: 820 });
      K.at(ctx, 1600, 160, K.pop(t, S.at(1, '挡住') - 0.1, 0.4), 0, () => K.text(ctx, '字被挡住了！', 0, 0, { size: 48, color: C.red, outline: '#fff', outlineWidth: 10 }));
    }
    fly(img3, s3, 1530, 310, 0.02, '改好了');
    K.at(ctx, 1690, 430, K.pop(t, S.at(1, '满意') - 0.2, 0.5), -0.2, () => {
      K.circle(ctx, 0, 0, 70, { stroke: C.green, width: 8, seed: 830 });
      K.text(ctx, '满意', 0, 0, { size: 46, color: C.green });
    });
    // 检查清单
    K.rect(ctx, 880, 560, 640, 240, { fill: '#fff59d', width: 4, seed: 840, label: 'checklist' });
    const items = [['字有没有被挡住？', '挡住'], ['颜色好不好看？', '颜色'], ['声音和画面对齐了吗？', '满意']];
    items.forEach(([txt, w], i) => {
      const y = 610 + i * 70;
      K.rect(ctx, 910, y - 20, 40, 40, { width: 4, seed: 850 + i, noXray: true });
      K.text(ctx, txt, 975, y, { size: 40, align: 'left', seed: 860 + i });
      const at = S.at(1, w) + 0.6;
      if (t > at) K.check(ctx, 932, y - 4, 46, { p: K.prog(t, at, 0.3), seed: 870 + i, noXray: true });
    });
    // 闪光灯
    for (const at of [s1, s2, s3]) {
      const f = t >= at ? Math.exp(-(t - at) * 10) : 0;
      if (f > 0.01) { ctx.save(); ctx.fillStyle = `rgba(255,255,255,${0.85 * f})`; ctx.fillRect(0, 0, K.W, K.H); ctx.restore(); }
    }
  };

  // ⑩ 总结：六步
  SC.recap = (ctx, t, S) => {
    const pts = [[190, 640], [500, 520], [800, 660], [1110, 500], [1410, 650], [1720, 510]];
    K.curve(ctx, pts, { width: 26, stroke: '#e3d5b8', p: K.prog(t, 0.1, 1.2), seed: 900, rough: 0.6 });
    K.curve(ctx, pts, { width: 4, stroke: C.brown, p: K.prog(t, 0.1, 1.2), seed: 901, label: '小克的做视频路线' });
    const steps = [['scroll', '写剧本', C.cream], ['brush', '画画面', C.sky], ['ball', '动起来', '#ffe2cc'], ['mic', '配声音', C.yellow], ['note', '配音乐', C.pink], ['magnifier', '检查', '#c9f0c4']];
    steps.forEach(([ic, w, col], i) => {
      const s = K.pop(t, S.at(0, w) - 0.15, 0.5);
      K.at(ctx, pts[i][0], pts[i][1], s, 0, () => {
        K.circle(ctx, 0, 0, 92, { fill: col, width: 6, seed: 910 + i });
        K.at(ctx, 0, 0, 0.5, 0, () => K.icon[ic](ctx, 0, 0, 105, S.abs));
        K.circle(ctx, -70, -70, 28, { fill: C.orange, width: 4, seed: 920 + i, noXray: true });
        K.text(ctx, String(i + 1), -70, -70, { size: 36, color: '#fff' });
        K.text(ctx, w, 0, 140, { size: 50 });
      });
    });
    const a1 = S.at(1);
    K.fade(ctx, 1 - K.prog(t, a1 - 0.3, 0.3), () => title(ctx, '小克做视频的 6 步', 190, K.prog(t, 0, 0.5), 80));
    const d = K.pop(t, a1 - 0.1, 0.6);
    K.at(ctx, 960, 230, d, 0, () => {
      ke(ctx, S, -330, 0, 105, { beret: true, arm: 'up' });
      K.clapper(ctx, 140, -10, 150, Math.max(0, Math.sin((t - a1) * 9)) * (t < a1 + 0.7 ? 1 : 0));
      K.text(ctx, '导演：小克', 140, 60, { size: 54, color: '#fff' });
    });
  };

  // ⑪ 你学到什么：对象 + 风格 + 目标
  const PROMPT = '帮我做一个教学视频，讲 Claude Opus 5.5 是怎么做出视频的，给普通人看。使用 JS + Canvas 绘制，手绘卡通风格，有动效，带配音和背景音乐。要通俗易懂，开头要吸引人，看完有收获，给我一个惊喜。';
  const MARKS = [['给普通人看', C.yellow, '对象', '给谁看', '给谁看'], ['手绘卡通风格', '#a9d6f5', '风格', '什么样子', '什么风格'], ['开头要吸引人，看完有收获，给我一个惊喜', C.pink, '目标', '想要什么效果', '什么效果']];
  SC.lesson = (ctx, t, S) => {
    const a1 = S.at(1), a3 = S.at(3), a4 = S.at(4);
    const think = life(t, S.at(0), a1 - 0.1);
    K.at(ctx, 960, 520, think, 0, () => {
      K.text(ctx, '对你有什么用？', 0, -320, { size: 96 });
      ke(ctx, S, 0, 20, 150, { arm: 'chin', look: [0.6, -0.8] });
      K.text(ctx, '？', 230 + Math.sin(S.abs * 3) * 6, -150, { size: 120, color: C.orange });
    });
    const chat = K.pop(t, a1, 0.5) * (1 - K.prog(t, S.at(3, '对象') - 0.6, 0.4));
    K.at(ctx, 960, 470, chat, 0, () => {
      ctx.translate(-960, -470);
      K.rect(ctx, 150, 110, 1240, 640, { radius: 34, fill: '#fff', width: 6, seed: 1000, label: '对话框' });
      K.text(ctx, '当初的需求', 770, 165, { size: 40, color: '#888' });
      K.line(ctx, 170, 205, 1370, 205, { width: 3, stroke: C.gray, noXray: true, seed: 1001 });
      K.circle(ctx, 240, 290, 50, { fill: C.blue, width: 5, seed: 1002 });
      K.text(ctx, '你', 240, 290, { size: 50, color: '#fff' });
      const L = K.layout(ctx, PROMPT, 330, 280, 1010, 46, 78);
      const shown = Math.floor(L.length * K.prog(t, a1 + 0.3, 2.2));
      MARKS.forEach(([str, col, , , cue], mi) => {
        const i0 = PROMPT.indexOf(str), at = S.at(2, cue);
        const p = K.prog(t, at - 0.2, 0.7);
        if (p <= 0) return;
        const end = i0 + Math.ceil(str.length * p);
        let rowStart = i0;
        for (let i = i0; i < end; i++) {
          if (i === end - 1 || L[i + 1].y !== L[i].y) {
            const a = L[rowStart], b = L[i];
            K.rect(ctx, a.x - 4, a.y - 30, b.x + b.w - a.x + 8, 60, { fill: col, stroke: null, fillAlpha: 0.8, seed: 1010 + mi * 10 + i, noXray: true });
            rowStart = i + 1;
          }
        }
      });
      ctx.save(); ctx.font = `46px ${K.FONT}`; ctx.textBaseline = 'middle'; ctx.fillStyle = C.ink;
      for (let i = 0; i < shown; i++) ctx.fillText(L[i].ch, L[i].x, L[i].y);
      ctx.restore();
      MARKS.forEach(([, col, tag, q, cue], mi) => {
        const s = K.pop(t, S.at(2, cue) - 0.1, 0.5);
        K.at(ctx, 1640, 250 + mi * 180, s, 0, () => {
          K.rect(ctx, -170, -70, 340, 140, { radius: 24, fill: col, width: 5, seed: 1050 + mi });
          K.text(ctx, tag, 0, -20, { size: 58 });
          K.text(ctx, q, 0, 38, { size: 32, color: '#555' });
        });
      });
    });
    if (t > S.at(3, '对象') - 0.4) {
      const exA = 1 - K.prog(t, a4 - 0.2, 0.4);
      MARKS.forEach(([, col, tag, q], i) => {
        const s = K.pop(t, S.at(3, ['对象', '加风格', '加目标'][i]) - 0.15, 0.5);
        K.at(ctx, 520 + i * 440, 260, s, (i - 1) * 0.03, () => {
          K.rect(ctx, -160, -80, 320, 160, { radius: 26, fill: col, width: 6, seed: 1100 + i });
          K.text(ctx, tag, 0, -18, { size: 70 });
          K.text(ctx, q, 0, 46, { size: 32, color: '#555' });
        });
        if (i < 2) K.at(ctx, 740 + i * 440, 260, K.pop(t, S.at(3, ['加风格', '加目标'][i]) - 0.3, 0.4), 0, () => K.text(ctx, '+', 0, 0, { size: 100, color: C.orange }));
      });
      K.fade(ctx, exA, () => {
        const bad = K.prog(t, S.at(3, '写文案'), 0.5);
        K.text(ctx, '帮我写个文案。', 330, 500, { size: 54, align: 'left', color: '#888', p: bad });
        if (bad > 0) K.cross(ctx, 250, 500, 30, { p: K.prog(t, S.at(3, '写文案') + 0.5, 0.4), seed: 1130 });
        const g = K.prog(t, S.at(3, '加目标') + 0.4, 1.4);
        if (g > 0) {
          const segs = [['给我爸妈看', C.yellow], ['，用大白话', '#a9d6f5'], ['，提醒他们别被骗子骗', C.pink], ['。', null]];
          let x = 330;
          const all = segs.map((s) => s[0]).join(''), n = Math.floor(Array.from(all).length * g);
          let used = 0;
          for (const [str, col] of segs) {
            const w = K.measure(ctx, str, 54), take = Math.max(0, Math.min(str.length, n - used));
            if (col && take > 0) K.rect(ctx, x + (str[0] === '，' ? 50 : 0), 645, (w - (str[0] === '，' ? 50 : 0)) * (take / str.length), 66, { fill: col, stroke: null, fillAlpha: 0.75, seed: 1140 + used, noXray: true });
            K.text(ctx, str, x, 680, { size: 54, align: 'left', p: take / str.length, seed: 1150 + used });
            x += w; used += str.length;
          }
          K.check(ctx, 255, 680, 56, { p: K.prog(t, S.at(3, '加目标') + 0.6, 0.3), seed: 1160 });
        }
      });
      const fin = K.pop(t, a4 + 0.25, 0.6);
      K.at(ctx, 960, 610, fin, Math.sin(S.abs * 2) * 0.02, () => {
        K.text(ctx, '说得越清楚，做得越好！', 0, 0, { size: 104, color: C.orange, outline: C.ink, outlineWidth: 12 });
        for (let i = 0; i < 5; i++) K.sparkle(ctx, -620 + i * 310, 120 + (i % 2) * 30, 26 + (i % 2) * 10, { rot: S.abs + i });
      });
      if (fin > 0) ke(ctx, S, 1740, 760, 95, { arm: 'up', mood: 'wink', talk: false });
    }
  };

  // ⑫ 彩蛋：透视 + 毕业证书
  SC.surprise = (ctx, t, S) => {
    const a1 = S.at(1), a2 = S.at(2), a3 = S.at(3), a4 = S.at(4);
    const open = E.out(K.prog(t, S.at(0) + S.D[0] * 0.9, 0.5));
    const giftA = 1 - K.prog(t, a2 - 0.3, 0.4);
    K.fade(ctx, giftA, () => {
      if (open > 0) for (let i = 0; i < 12; i++) {
        const a = -Math.PI / 2 + (i - 5.5) * 0.18 + Math.sin(S.abs + i) * 0.03;
        K.line(ctx, 960, 520, 960 + Math.cos(a) * 520 * open, 520 + Math.sin(a) * 520 * open, { stroke: C.yellow, width: 10, alpha: 0.7, seed: 1200 + i, noXray: true });
      }
      const jump = E.back(K.prog(t, a1 - 0.2, 0.6));
      if (jump > 0) ke(ctx, S, 960, K.lerp(560, 330, jump), 130, { arm: 'wave' });
      K.at(ctx, 960, 620, K.pop(t, S.at(0, '彩蛋') - 0.3, 0.6), 0, () => K.gift(ctx, 0, 0, 170, open));
    });
    const xr = K.prog(t, S.at(1, '透视') - 0.2, 0.3) * (1 - K.prog(t, a2 - 0.2, 0.2));
    if (xr > 0) {
      const pulse = 0.6 + 0.4 * Math.sin(S.abs * 8);
      K.arrow(ctx, 1430, 760, 1700, 960, { width: 8, stroke: C.red, alpha: pulse, p: K.clamp(xr * 1.5), seed: 1230 });
      K.text(ctx, '点这里！', 1360, 720, { size: 58, color: C.red, alpha: pulse });
    }
    const bars = K.prog(t, a2 - 0.2, 0.4) * (1 - K.prog(t, a3 - 0.3, 0.4));
    if (bars > 0) K.fade(ctx, bars, () => {
      const kb = Math.round(window.STATS.codeBytes / 1024);
      K.text(ctx, `整个视频 = ${kb} KB 的文字`, 960, 170, { size: 84, color: C.orange, outline: C.ink, outlineWidth: 10, p: K.prog(t, S.at(2, '一百') - 0.3, 0.8) });
      const G = 800, g = E.out(K.prog(t, a2 + 0.2, 1.5));
      const hp = 400 * g, hc = Math.max(4, 400 * (kb / 3072)) * g;
      K.line(ctx, 360, G, 1560, G, { width: 5, seed: 1240 });
      K.rect(ctx, 560, G - hc, 220, hc, { fill: C.orange, width: 5, seed: 1241, label: `${kb} KB` });
      K.rect(ctx, 1140, G - hp, 220, hp, { fill: C.blue, width: 5, seed: 1242, label: '3 MB' });
      K.text(ctx, `小克的代码 ${kb} KB`, 670, G - hc - 60, { size: 46 });
      K.at(ctx, 1250, G - hp - 75, 0.45 * g, 0, () => K.icon.picture(ctx, 0, 0, 105));
      K.text(ctx, '一张手机照片 ≈ 3 MB', 1250, G + 50, { size: 42, color: '#555' });
      K.text(ctx, `≈ 1/${Math.round(3072 / kb)}`, 670, G + 50, { size: 42, color: '#555' });
    });
    const wr = K.prog(t, a3 - 0.3, 0.4) * (1 - K.prog(t, a4 - 0.2, 0.4));
    if (wr > 0) K.fade(ctx, wr, () => {
      ke(ctx, S, 420, 520, 140, { pencil: true });
      K.text(ctx, '文字 = 画笔', 1180, 380, { size: 110, p: K.prog(t, S.at(3, '文字'), 0.8) });
      K.text(ctx, '你的文字 = 魔法', 1180, 580, { size: 110, color: C.purple, outline: C.ink, outlineWidth: 10, p: K.prog(t, S.at(3, '你的文字') - 0.2, 0.9) });
      const sp = K.pop(t, S.at(3, '魔法'), 0.5);
      for (let i = 0; i < 6; i++) K.at(ctx, 1180 + Math.cos(i) * 520, 580 + Math.sin(i * 1.7) * 110, sp, S.abs + i, () => K.sparkle(ctx, 0, 0, 30));
    });
    const cert = K.pop(t, a4 + 0.15, 0.7);
    if (cert > 0) {
      K.at(ctx, 960, 470, cert * 0.6, -0.03, () => K.certificate(ctx, '（你的名字）', S.abs));
      K.confetti(ctx, t - (S.at(4, '毕业证书') + 0.5));
    }
  };

  // ---------- 毕业证书 & 彩纸 ----------
  K.certificate = (ctx, name, now) => {
    K.rect(ctx, -700, -450, 1400, 900, { fill: '#fffdf4', width: 8, seed: 1300, label: 'certificate' });
    K.rect(ctx, -660, -410, 1320, 820, { width: 3, stroke: C.orange, seed: 1301, noXray: true });
    for (const [x, y] of [[-620, -370], [620, -370], [-620, 370], [620, 370]]) K.sparkle(ctx, x, y, 34, { seed: 1310 + x + y, noXray: true });
    K.text(ctx, 'AI 沟通毕业证书', 0, -320, { size: 96, color: C.orange, outline: C.ink, outlineWidth: 8, seed: 1320 });
    K.text(ctx, '兹证明', 0, -205, { size: 44, color: '#666', seed: 1321 });
    const nm = name.length > 10 ? name.slice(0, 10) + '…' : name;
    K.text(ctx, nm, 0, -100, { size: 110, color: C.ink, seed: 1322 });
    K.curve(ctx, [[-360, -25], [0, -35], [360, -22]], { width: 6, stroke: C.blue, seed: 1323 });
    K.text(ctx, '已看完《AI 是怎么做出视频的》，', 0, 60, { size: 46, seed: 1324 });
    K.text(ctx, '掌握跟 AI 说话的秘诀：对象 + 风格 + 目标。', 0, 135, { size: 46, seed: 1325 });
    const d = new Date();
    K.text(ctx, `颁发人：小克（Claude Opus 5.5）   ${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()}`, -90, 275, { size: 34, color: '#555', seed: 1326 });
    K.ke(ctx, -560, 270, 55, { t: now, arm: 'wave', bob: true });
    K.at(ctx, 470, 230, 1, -0.25, () => {
      K.circle(ctx, 0, 0, 110, { stroke: C.red, width: 9, seed: 1330 });
      K.circle(ctx, 0, 0, 88, { stroke: C.red, width: 3, seed: 1331, noXray: true });
      K.text(ctx, '小克', 0, -22, { size: 54, color: C.red, seed: 1332 });
      K.text(ctx, '认证', 0, 36, { size: 54, color: C.red, seed: 1333 });
    });
  };
  K.confetti = (ctx, dt) => {
    if (dt <= 0) return;
    const R = K.rng(4242), cols = [C.orange, C.yellow, C.blue, C.green, C.pink, C.purple];
    ctx.save();
    for (let i = 0; i < 140; i++) {
      const x0 = R() * K.W, delay = R() * 1.5, sp = 220 + R() * 260, sw = R() * 6, rot = R() * 6, col = cols[i % 6], w = 14 + R() * 14;
      const tt = dt - delay;
      if (tt < 0) continue;
      const y = -40 + tt * sp, x = x0 + Math.sin(tt * 2 + sw) * 60;
      if (y > K.H + 40) continue;
      ctx.save(); ctx.translate(x, y); ctx.rotate(rot + tt * 4); ctx.scale(1, Math.abs(Math.cos(tt * 5 + sw)));
      ctx.fillStyle = col; ctx.fillRect(-w / 2, -w / 4, w, w / 2); ctx.restore();
    }
    ctx.restore();
  };
})();
