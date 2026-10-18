// 每个场景一个函数：(t 场景内时间, S 时间信息) → 画一帧
// S.L[i] / S.E[i] 是第 i 句配音在场景内的开始 / 结束时间，S.d 是场景时长
(function () {
  const { C, W, H, prog, ease, easeOut, pop, lerp, clamp, hash } = D;
  const SEA_Y = 470;

  // 档位面板：浮航 / 水翼 / 掠飞
  function gearPanel(x, y, level, o = {}) {
    D.card(x, y, 250, 150);
    D.text('航行档位', x + 125, y + 26, { size: 24 });
    const names = ['浮航', '水翼', '掠飞'], cols = [C.mode.float, C.mode.foil, C.mode.fly];
    names.forEach((n, i) => {
      const cx = x + 45 + i * 80, on = Math.round(level) === i;
      D.rect(cx - 32, y + 52, 64, 76, { fill: on ? cols[i] : '#eeeeee', r: 12, lw: on ? 4 : 2.5 });
      D.text(n, cx, y + 90, { size: 24, color: on ? '#fff' : '#9e9e9e' });
    });
    if (o.lock) {
      const lx = x + 45, ly = y + 140;
      D.rect(lx - 14, ly - 6, 28, 22, { fill: '#ffca28', r: 4, lw: 2.5 });
      D.ellipse(lx, ly - 6, 9, 11, { a0: Math.PI, a1: Math.PI * 2, lw: 3 });
    }
  }
  // 圆角气泡
  function bubble(x, y, w, h, tx, ty) {
    D.poly([[x + w * 0.3, y + h - 4], [tx, ty], [x + w * 0.45, y + h - 4]], { fill: '#fffdf5', lw: 3 });
    D.rect(x, y, w, h, { fill: '#fffdf5', r: 20, lw: 3.5 });
  }
  function label(str, x, y, size = 30, color = C.ink, bg = '#fffdf5') {
    const w = D.measure(str, size) + 34;
    D.rect(x - w / 2, y - size * 0.8, w, size * 1.6, { fill: bg, r: size * 0.7, lw: 3 });
    D.text(str, x, y + 1, { size, color });
  }
  function clock(x, y, r, hh, mm, s = 1) {
    D.scaled(x, y, s, () => {
      D.circle(x, y, r, { fill: '#fff', lw: 4 });
      for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; D.line(x + Math.cos(a) * r * 0.82, y + Math.sin(a) * r * 0.82, x + Math.cos(a) * r * 0.92, y + Math.sin(a) * r * 0.92, { lw: 3 }); }
      const am = mm / 60 * Math.PI * 2 - Math.PI / 2, ah = (hh % 12 + mm / 60) / 12 * Math.PI * 2 - Math.PI / 2;
      D.line(x, y, x + Math.cos(ah) * r * 0.5, y + Math.sin(ah) * r * 0.5, { lw: 6 });
      D.line(x, y, x + Math.cos(am) * r * 0.75, y + Math.sin(am) * r * 0.75, { lw: 4, stroke: C.stripe });
      D.text(`${hh}:${String(mm).padStart(2, '0')}`, x, y + r + 34, { size: 36, outline: '#fff' });
    });
  }
  function road(y, x0 = -20, x1 = W + 20, scroll = 0) {
    D.rect(x0, y, x1 - x0, 90, { fill: C.road, r: 2, lw: 3 });
    for (let x = x0 - ((scroll % 120) + 120) % 120; x < x1; x += 120) D.rect(x + 20, y + 40, 60, 8, { fill: '#fff', stroke: null, r: 3 });
  }
  function ground(y, x0, x1, color = C.ground) { D.rect(x0, y, x1 - x0, H - y + 30, { fill: color, r: 2, lw: 3 }); }

  // 斜坡：从 (x0,y0) 平台边缘下到 (x1,y1)
  function ramp(x0, y0, x1, y1) {
    D.poly([[x0 - 400, y0], [x0, y0], [x1, y1], [x1, H + 30], [x0 - 400, H + 30]], { fill: '#bcaaa4', lw: 3.5 });
    for (let i = 1; i < 6; i++) { const k = i / 6; D.line(lerp(x0, x1, k) - 10, lerp(y0, y1, k) + 6, lerp(x0, x1, k) + 10, lerp(y0, y1, k) + 6, { stroke: '#8d6e63', lw: 3 }); }
  }

  // ---------------- 片头 ----------------
  function hook(t, S) {
    const [L0, L1, L2, L3, L4] = S.L;
    if (t < L1) {
      Wd.sky(); Wd.sun(1120, 110, 44, t); Wd.clouds(t);
      ground(560, -20, W + 20, '#d7ccc8'); road(560);
      Wd.hotel(150, 560, 1.1);
      Wd.palm(80, 560, 1.1, t); Wd.palm(480, 560, 0.9, t);
      const walk = prog(t, 0.3, L0 + 1.8);
      if (walk < 1) Wd.person(lerp(330, 640, walk), 590, 1, { walk: t * 10, shirt: '#ab47bc' });
      Wd.craftFront(760, 618, 1.0, { wing: 0 });
      clock(1020, 300, 70, 9, 0, pop(t, 0.2));
    } else if (t < L1 + 1.8) {
      const k = prog(t, L1, L1 + 1.8);
      Wd.sky(); Wd.clouds(t, 60);
      Wd.sea(SEA_Y, t * 700, { amp: 4 });
      Wd.island(lerp(1500, -300, k), SEA_Y, 500, 90, { hill: true, palms: [[-0.3, 0.9], [0.4, 1]], t });
      Wd.speedLines(t, 1);
      Wd.spray(560, SEA_Y + 10, t, 1);
      Wd.craft(640, SEA_Y - 30 + Math.sin(t * 6) * 3, 1.15, { wing: 1, spin: 1, wow: true });
      Wd.waterOverlay(SEA_Y, t * 700, { amp: 4 });
      clock(1080, 160, 54, 9, Math.round(lerp(0, 20, k)));
    } else if (t < L2) {
      Wd.sky('#9fdcf5'); Wd.sun(1120, 110, 44, t); Wd.clouds(t);
      Wd.sea(520, t * 30);
      D.ellipse(500, 540, 760, 150, { a0: Math.PI, a1: Math.PI * 2, fill: C.sand, lw: 3.5, closed: true });
      Wd.palm(160, 450, 1.3, t); Wd.palm(860, 470, 1.1, t);
      Wd.person(470, 500, 1.2, { shirt: '#ab47bc', wave: t });
      Wd.person(560, 505, 1.2, { kid: true, shirt: '#ffb74d', cap: '#ff7043', wave: t + 0.3 });
      Wd.craft(980, 520, 0.8, { wing: 0, wheels: 1 });
      clock(1080, 220, 64, 9, 20, pop(t, L1 + 1.8));
    } else {
      D.paper();
      if (t < L3) {
        const items = [['换船', 'swap'], ['晕船', 'sick'], ['排队', 'queue']];
        items.forEach(([n, kind], i) => {
          const s = pop(t, L2 + 0.4 + i, 0.45), cx = 240 + i * 400, cy = 320;
          D.scaled(cx, cy, s, () => {
            D.card(cx - 160, cy - 170, 320, 340);
            if (kind === 'swap') {
              D.poly([[cx - 120, cy - 30], [cx - 30, cy - 30], [cx - 45, cy], [cx - 105, cy]], { fill: '#90caf9', lw: 3 });
              D.poly([[cx + 30, cy - 30], [cx + 120, cy - 30], [cx + 105, cy], [cx + 45, cy]], { fill: '#a5d6a7', lw: 3 });
              D.arrow(cx - 30, cy - 70, cx + 40, cy - 70, { lw: 4 });
              Wd.person(cx - 75, cy - 30, 0.6, { shirt: '#ab47bc' });
            } else if (kind === 'sick') {
              Wd.face(cx, cy - 30, 70, { sick: true, look: 0 });
              D.circle(cx, cy - 30, 70, { fill: 'rgba(130,200,90,0.35)', stroke: null });
            } else {
              for (let k = 0; k < 5; k++) Wd.person(cx - 110 + k * 50, cy + 10, 0.6, { shirt: ['#ef9a9a', '#90caf9', '#ffe082', '#a5d6a7', '#ce93d8'][k] });
              D.text('...', cx + 130, cy - 20, { size: 40 });
            }
            D.text(n, cx, cy + 110, { size: 44 });
            D.cross(cx + 110, cy - 130, 1.6);
          });
        });
      } else if (t < L4) {
        const bob = Math.sin(t * 3) * 6;
        Wd.craft(640, 470 + bob, 1.45, { wing: 1, spin: 1, wheels: 0.3 });
        const badges = [['会跑', C.mode.land, 230, 230], ['会游', C.mode.float, 640, 140], ['会飞', C.mode.fly, 1050, 230]];
        badges.forEach(([n, col, x, y], i) => {
          const s = pop(t, L3 + [1.0, 1.8, 2.8][i], 0.45);
          D.scaled(x, y, s, () => { D.circle(x, y, 78, { fill: col, lw: 4, double: true }); D.text(n, x, y + 2, { size: 46, color: '#fff' }); });
        });
      } else {
        const s = pop(t, L4, 0.6);
        Wd.sky('#ffe0b2', '#fff3e0', 470); Wd.sun(640, 300, 90, t, '#ffb74d');
        Wd.sea(470, t * 300, { amp: 4 });
        const k = prog(t, L4, S.d);
        Wd.spray(lerp(-100, 1400, k) - 90, 485, t, 0.8);
        Wd.craft(lerp(-100, 1400, k), 450, 0.7, { wing: 1, spin: 1 });
        Wd.waterOverlay(470, t * 300, { amp: 4 });
        D.scaled(640, 200, s, () => {
          D.text('坐一次会飞的车', 640, 150, { size: 84, color: C.stripe, outline: '#fff', olw: 14 });
          D.text('去跳岛！', 640, 250, { size: 84, color: '#1e88e5', outline: '#fff', olw: 14 });
        });
        D.alpha(prog(t, L4 + 1.2, L4 + 1.8), () => label('12 步  走完全程', 640, 360, 34, '#fff', C.ink));
      }
    }
  }

  // ---------------- 一句话规则 ----------------
  function rule(t, S) {
    const [L0, L1, L2, L3, L4] = S.L;
    D.paper();
    if (t < L1) {
      const s = pop(t, 0.1, 0.5);
      D.scaled(640, 330, s, () => {
        D.card(340, 200, 600, 260, { fill: '#fff8e1' });
        D.text('出发前', 640, 270, { size: 48 });
        D.text('先记住一句话', 640, 370, { size: 64, color: C.stripe });
      });
      return;
    }
    const s = pop(t, L1, 0.5);
    D.scaled(640, 90, s, () => {
      D.text('水上起飞', 400, 90, { size: 60, color: C.mode.float, outline: '#fff' });
      D.text('·', 640, 90, { size: 60 });
      D.text('陆上只接驳', 880, 90, { size: 60, color: C.mode.land, outline: '#fff' });
    });
    // 左：水上
    const hiR = t > L3 ? 1 : 0;
    D.card(70, 160, 540, 400, { stroke: hiR ? '#bbb' : C.ink });
    D.ctx.save(); D.ctx.beginPath(); D.ctx.rect(74, 164, 532, 392); D.ctx.clip();
    Wd.sky(C.sky, C.sky2, 560);
    const slide = t > L2 ? easeOut(prog(t, L2 + 0.4, L2 + 3.5)) : 0;
    Wd.sea(420, t * (60 + slide * 500), { amp: 4 });
    const cx = lerp(200, 430, slide), cy = 436 - slide * 10;
    Wd.spray(cx - 90, 425, t, slide);
    Wd.craft(cx, cy, 0.8, { wing: 1, spin: 0.3 + slide, tilt: -slide * 0.05 });
    Wd.waterOverlay(420, t * (60 + slide * 500), { amp: 4 });
    if (t > L2) {
      D.alpha(prog(t, L2 + 0.3, L2 + 0.8), () => {
        D.arrow(cx + 120, 300, cx + 200, 300, { lw: 5, stroke: C.stripe });
        D.arrow(cx + 110, 270, cx + 190, 270, { lw: 4, stroke: C.stripe });
        label('船身滑行加速', 340, 220, 28);
      });
    }
    D.ctx.restore();
    D.scaled(560, 200, pop(t, L1 + 0.3), () => { D.circle(560, 200, 34, { fill: '#e8f5e9', lw: 3 }); D.check(560, 202, 1.1); });
    D.text('起飞', 340, 520, { size: 40, color: C.mode.float, outline: '#fff' });

    // 右：陆上
    D.card(670, 160, 540, 400);
    D.ctx.save(); D.ctx.beginPath(); D.ctx.rect(674, 164, 532, 392); D.ctx.clip();
    Wd.sky(C.sky, C.sky2, 560);
    D.rect(700, 300, 70, 140, { fill: '#ffccbc', r: 4, lw: 3 }); D.rect(1100, 270, 90, 170, { fill: '#c5cae9', r: 4, lw: 3 });
    road(440, 674, 1210, t * (t > L4 ? 120 : 0));
    const drive = t > L4 ? Math.sin(t * 5) * 2 : 0;
    Wd.craft(930, 445 + drive, 0.7, { wing: 0, wheels: 1, roll: t * (t > L4 ? 8 : 0) });
    D.ctx.restore();
    D.scaled(1160, 200, pop(t, L1 + 1.2), () => { D.circle(1160, 200, 34, { fill: '#ffebee', lw: 3 }); D.cross(1160, 200, 0.9); });
    D.text('不起飞', 940, 520, { size: 40, color: C.mode.land, outline: '#fff' });
    if (t > L3 && t < L4) {
      D.alpha(prog(t, L3, L3 + 0.4), () => {
        label('没有跑道', 830, 230, 28, C.red);
        label('没有水托着', 1050, 300, 28, C.red);
      });
    }
    if (t > L4) D.scaled(940, 230, pop(t, L4 + 0.3), () => label('就当一辆车', 940, 230, 32, '#fff', C.mode.land));
  }

  // ---------------- 1 上车 ----------------
  function s1(t, S) {
    const [L0, L1, L2] = S.L;
    Wd.sky(); Wd.sun(1150, 100, 40, t); Wd.clouds(t);
    ground(540, -20, W + 20, '#d7ccc8'); road(560);
    Wd.hotel(60, 560, 1.05);
    D.line(470, 560, 470, 430, { lw: 5 });
    D.rect(410, 390, 120, 50, { fill: '#fff59d', r: 10, lw: 3 }); D.text('接驳点', 470, 416, { size: 28 });
    const walkers = [[0.2, '#ab47bc', false], [0.8, '#ffb74d', true]];
    walkers.forEach(([d, col, kid]) => {
      const k = prog(t, d, d + 3.2);
      if (k < 1) Wd.person(lerp(380, 700, k), 600, 1, { walk: t * 10, shirt: col, kid, cap: kid ? '#ff7043' : null });
    });
    Wd.craftFront(820, 618, 1.0, { wing: 0, wow: t > L1 });
    if (t > L1 && t < L2 + 0.2) {
      D.alpha(prog(t, L1 + 0.5, L1 + 1), () => {
        D.arrow(1010, 320, 920, 360, { lw: 4 });
        label('翅膀折起来', 1080, 300, 30);
      });
    }
    if (t > L2) {
      const a = prog(t, L2, L2 + 0.5);
      D.alpha(a, () => {
        D.line(670, 625, 670, 470, { stroke: '#fff', lw: 6 }); D.line(970, 625, 970, 470, { stroke: '#fff', lw: 6 });
        D.dblArrow(680, 460, 960, 460, { lw: 4, stroke: '#1565c0' });
        label('和普通车一样窄', 820, 410, 30, '#fff', '#1565c0');
      });
      D.scaled(1080, 520, pop(t, L2 + 0.5), () => { D.circle(1080, 520, 34, { fill: '#e8f5e9', lw: 3 }); D.check(1080, 522, 1.1); });
    }
  }

  // ---------------- 2 驶向下水点 ----------------
  function s2(t, S) {
    const [L0, L1, L2] = S.L;
    Wd.sky(); Wd.clouds(t);
    Wd.sea(560, t * 20);
    ramp(1000, 560, 1260, 700);
    ground(560, -20, 1000);
    road(560, -20, 1000);
    D.rect(1000, 520, 24, 40, { fill: '#ffeb3b', r: 4, lw: 3 }); D.text('下水点', 1010, 494, { size: 26, outline: '#fff' });
    Wd.palm(100, 560, 1, t);
    const k = ease(prog(t, 0.2, L2 + 0.4));
    const x = lerp(140, 820, k);
    const blue = prog(t, L2 + 0.4, L2 + 1.0);
    const light = blue > 0 ? `rgb(${lerp(205, 120, blue)},${lerp(238, 190, blue)},${lerp(252, 255, blue)})` : C.glass;
    Wd.craft(x, 532, 0.9, { wing: 0, wheels: 1, roll: x / 18, light });
    if (t < L2) D.alpha(prog(t, L1, L1 + 0.5), () => label('慢慢开', x, 330, 30));
    if (t > L2) {
      const s = pop(t, L2 + 0.3, 0.5);
      D.scaled(860, 200, s, () => {
        bubble(620, 70, 480, 220, x + 20, 430);
        D.rect(650, 100, 140, 40, { fill: lerp(0, 1, blue) > 0.5 ? '#4fc3f7' : '#fff9c4', r: 20, lw: 3 });
        D.text('座舱灯', 720, 160, { size: 24 });
        D.text('即将下水', 940, 130, { size: 40, color: '#1565c0' });
        D.text('请系好安全带', 940, 190, { size: 32 });
        D.rect(660, 200, 120, 60, { fill: '#eceff1', r: 10, lw: 3 });
        D.line(670, 205, 770, 255, { stroke: '#ef6c00', lw: 7 });
      });
    }
  }

  // ---------------- 3 展翼检查 ----------------
  function s3(t, S) {
    const [L0, L1, L2, L3] = S.L;
    Wd.sky(C.sky, C.sky2); Wd.clouds(t);
    Wd.sea(560, t * 20);
    ground(600, -20, W + 20, '#bcaaa4');
    const k = prog(t, L1 + 0.5, L1 + 2.6);
    const glow = t > L3 ? 0.5 + 0.5 * Math.sin(t * 4) : 0;
    if (glow) D.circle(640, 470, 330, { fill: `rgba(255,236,150,${0.25 + glow * 0.2})`, stroke: null });
    Wd.craftFront(640, 640, 1.05, { wing: k, lock: true, wow: t > L1 + 2.6 });
    if (t > L1 + 2.6 && t < L2 + 0.5) {
      const a = 1 - prog(t, L1 + 3.6, L2 + 0.5);
      D.alpha(a, () => {
        label('咔哒！', 330, 420, 40, '#fff', '#43a047');
        label('咔哒！', 950, 420, 40, '#fff', '#43a047');
      });
    }
    if (k >= 1) {
      D.alpha(prog(t, L1 + 3.0, L1 + 3.6), () => {
        D.dblArrow(400, 690, 880, 690, { lw: 4, stroke: '#1565c0' });
        D.text('翅膀展开', 640, 668, { size: 26, color: '#1565c0', outline: '#fff' });
      });
    }
    if (t > L2) {
      const s = pop(t, L2 + 0.4, 0.5);
      D.scaled(1060, 200, s, () => {
        D.card(920, 70, 300, 240);
        D.text('今日海况', 1070, 105, { size: 30 });
        const lv = ['平静', '小浪', '浪大'], cols = ['#66bb6a', '#ffca28', '#ef5350'];
        lv.forEach((n, i) => {
          D.rect(945 + i * 88, 140, 74, 90, { fill: i === 0 ? cols[i] : '#eee', r: 12, lw: i === 0 ? 4 : 2.5 });
          for (let w = 0; w <= i; w++) D.curve([[960 + i * 88, 165 + w * 14], [972 + i * 88, 158 + w * 14], [982 + i * 88, 165 + w * 14], [994 + i * 88, 158 + w * 14], [1006 + i * 88, 165 + w * 14]], { lw: 2.5 });
          D.text(n, 982 + i * 88, 210, { size: 22, color: i === 0 ? '#fff' : '#999' });
        });
        D.check(1010, 275, 1.0); D.text('可以出发', 1090, 276, { size: 28, color: C.ok });
      });
    }
    if (t > L3) {
      for (let i = 0; i < 14; i++) {
        const ph = (t * 0.5 + hash(i)) % 1, a = hash(i * 3) * Math.PI * 2, r = 120 + ph * 300;
        D.alpha(1 - ph, () => D.star(640 + Math.cos(a) * r, 430 + Math.sin(a) * r * 0.7, 10 + hash(i * 5) * 10));
      }
      D.scaled(340, 200, pop(t, L3 + 0.2), () => label('最有仪式感的一刻', 340, 200, 36, '#fff', C.mode.trans));
    }
  }

  // ---------------- 4 入水 ----------------
  function s4(t, S) {
    const [L0, L1, L2] = S.L;
    Wd.sky(); Wd.clouds(t); Wd.island(1150, SEA_Y + 2, 300, 50, { palms: [[0, 0.7]], t });
    const sy = 480;
    Wd.sea(sy, t * 25);
    ground(400, -20, 380, '#bcaaa4');
    ramp(380, 400, 800, 600);
    // 沿地面行驶：车轮贴着平台和斜坡，入水后浮起
    const surf = xx => xx < 380 ? 400 : 400 + (Math.min(xx, 800) - 380) / 420 * 200;
    const floatY = sy + 22 + Math.sin(t * 2.5) * 3 * prog(t, L1 + 2.2, L1 + 3);
    const yAt = xx => Math.min(surf(xx) - 17, floatY);
    const x = lerp(160, 840, ease(prog(t, L1, L1 + 2.8)));
    const y = yAt(x), tilt = 0.8 * Math.atan2(yAt(x + 40) - yAt(x - 40), 80);
    const wheels = 1 - prog(t, L1 + 2.2, L1 + 3.2);
    Wd.craft(x, y, 0.85, { wing: 1, wheels, tilt, roll: x / 16 });
    Wd.waterOverlay(sy, t * 25);
    // 入水水花
    const sp = prog(t, L1 + 1.75, L1 + 2.9);
    if (sp > 0 && sp < 1) for (let i = 0; i < 16; i++) {
      const a = -Math.PI * (0.15 + 0.7 * hash(i)), r = sp * (80 + hash(i * 2) * 90);
      D.circle(650 + Math.cos(a) * r, sy + Math.sin(a) * r + sp * sp * 80, 8 * (1 - sp) + 3, { fill: '#fff', stroke: '#7cc4e4', lw: 1.5 });
    }
    if (t > L1 + 2.2 && t < L2) D.alpha(prog(t, L1 + 2.2, L1 + 2.6), () => label('轮子收起', 840, 320, 30));
    if (t > L2) {
      D.alpha(prog(t, L2, L2 + 0.5), () => {
        D.arrow(1060, 570, 920, 518, { lw: 4, stroke: '#fff' });
        label('船形的肚子', 1110, 590, 32, '#fff', '#1565c0');
      });
      D.scaled(1100, 330, pop(t, L2 + 0.8), () => { label('稳稳浮在水上', 1080, 330, 32); });
    }
  }

  // ---------------- 5 低速浮航 ----------------
  function s5(t, S) {
    const [L0, L1, L2, L3] = S.L;
    const rough = ease(prog(t, L2 + 0.2, L2 + 1.4));
    Wd.sky(rough > 0.5 ? '#b0c4d4' : C.sky, C.sky2); Wd.clouds(t);
    const amp = lerp(4, 18, rough);
    Wd.sea(SEA_Y, t * 40, { amp, wl: lerp(70, 110, rough) });
    // 码头与小船
    D.rect(-20, SEA_Y - 30, 200, 26, { fill: '#a1887f', r: 3, lw: 3 });
    for (let i = 0; i < 4; i++) D.rect(10 + i * 50, SEA_Y - 8, 10, 60, { fill: '#795548', r: 2, lw: 2.5 });
    const boat = (bx, by, col) => {
      D.poly([[bx - 50, by - 16], [bx + 50, by - 16], [bx + 34, by + 6], [bx - 34, by + 6]], { fill: col, lw: 3 });
      D.line(bx, by - 16, bx, by - 90, { lw: 3 });
      D.poly([[bx + 4, by - 86], [bx + 44, by - 26], [bx + 4, by - 26]], { fill: '#fff', lw: 2.5 });
    };
    const bob = Math.sin(t * 2) * (2 + amp * 0.3);
    boat(1060, SEA_Y + 6 + bob, '#ef9a9a'); boat(760 + Math.sin(t * 0.3) * 10, SEA_Y + 10 - bob, '#ce93d8');
    [[520, '#ef5350'], [960, '#ffffff']].forEach(([bx, col], i) => { D.ellipse(bx, SEA_Y + 4 + (i ? -bob : bob), 12, 18, { fill: col, lw: 2.5 }); });
    const k = prog(t, 0.2, S.d);
    const x = lerp(340, 660, ease(k)) + Math.sin(k * Math.PI * 2) * 30;
    Wd.wake(x - 110, SEA_Y + 8, t, 0.8, 220);
    Wd.craft(x, SEA_Y + 22 + Math.sin(t * 2.2) * (2 + amp * 0.4), 0.8, { wing: 1, spin: 0.3, prop: t * 6, tilt: Math.sin(t * 2.2) * rough * 0.05 });
    Wd.waterOverlay(SEA_Y, t * 40, { amp, wl: lerp(70, 110, rough) });
    if (t < L2) D.alpha(prog(t, L1, L1 + 0.5), () => label('低速 · 像船一样', x, 320, 30));
    if (t > L0) D.alpha(prog(t, L0, L0 + 0.5), () => gearPanel(980, 110, 0, { lock: t > L2 + 1.4 }));
    if (t > L2 + 1.4 && t < L3) D.alpha(prog(t, L2 + 1.4, L2 + 1.8), () => label('浪太高 → 停在这一档', 640, 160, 32, '#fff', C.red));
    if (t > L3) {
      D.scaled(560, 190, pop(t, L3 + 0.2), () => {
        D.poly([[560, 90], [640, 120], [630, 220], [560, 270], [490, 220], [480, 120]], { fill: '#66bb6a', lw: 4 });
        D.check(560, 180, 1.4, '#fff');
        D.text('安全第一', 560, 310, { size: 40, outline: '#fff' });
      });
    }
  }

  // ---------------- 6 加速上台阶 ----------------
  function s6(t, S) {
    const [L0, L1, L2] = S.L;
    const acc = ease(prog(t, L1, S.d));
    const scroll = t * 80 + acc * acc * t * 600;
    Wd.sky(); Wd.clouds(t, 10 + acc * 60);
    Wd.sea(SEA_Y, scroll, { amp: 5 });
    Wd.speedLines(t, acc);
    const foil = prog(t, L1 + 0.5, L1 + 1.6);
    const lift = ease(prog(t, L2, L2 + 2.6)) * 30;
    const x = 600, y = SEA_Y + 22 - lift + Math.sin(t * 9) * acc * 2;
    Wd.spray(x - 130, SEA_Y + 6, t, acc, 160 + acc * 140);
    Wd.craft(x, y, 0.95, { wing: 1, spin: acc, prop: t * 20, foil, tilt: -0.04 * acc + lift * 0.0015 });
    Wd.waterOverlay(SEA_Y, scroll, { amp: 5 });
    Wd.spray(x + 40, SEA_Y + 4, t + 0.5, acc * 0.6, 80);
    // 推进力度表
    D.alpha(prog(t, L1, L1 + 0.4), () => {
      D.card(70, 110, 260, 120);
      D.text('推进', 120, 150, { size: 30 });
      D.rect(170, 136, 140, 28, { fill: '#eee', r: 14, lw: 3 });
      const p = ease(prog(t, L1 + 0.3, L1 + 1.5));
      if (p > 0.05) D.rect(172, 138, 136 * p, 24, { fill: p > 0.95 ? C.red : C.mode.foil, r: 12, stroke: null });
      if (p > 0.95) D.text('MAX', 240, 200, { size: 34, color: C.red });
    });
    gearPanel(980, 110, t > L1 ? 1 : 0);
    if (t > L1 + 1.6 && t < L2) label('水翼伸出来', x - 40, SEA_Y + 120, 28, '#fff', '#00897b');
    if (t > L2) {
      const s = pop(t, L2 + 1.5, 0.5);
      D.scaled(250, 380, s, () => {
        D.card(140, 290, 220, 190);
        // 踮脚冲刺的小人
        const ph = t * 12;
        D.circle(250, 330, 16, { fill: '#ffd9b3', lw: 3 });
        D.line(250, 346, 242, 400, { lw: 5 });
        D.line(242, 400, 242 + Math.sin(ph) * 22, 440, { lw: 5 }); D.line(242, 400, 242 - Math.sin(ph) * 22, 440, { lw: 5 });
        D.line(248, 360, 280, 375 + Math.sin(ph) * 10, { lw: 5 }); D.line(248, 360, 218, 380 - Math.sin(ph) * 10, { lw: 5 });
        D.text('踮起脚尖冲', 250, 462, { size: 26 });
      });
      D.alpha(prog(t, L2 + 0.4, L2 + 1), () => label('船身抬出水面', 900, 300, 30));
    }
  }

  // ---------------- 7 离水掠飞 ----------------
  function s7(t, S) {
    const [L0, L1, L2] = S.L;
    const scroll = t * 700;
    Wd.sky(); Wd.clouds(t, 70);
    Wd.sea(SEA_Y, scroll, { amp: 5 });
    Wd.speedLines(t, 1);
    const up = ease(prog(t, L0 + 0.3, L1 + 1.6));
    const x = 600, y = SEA_Y - 8 - up * 46 + Math.sin(t * 3) * 2;
    Wd.spray(x - 130, SEA_Y + 6, t, 1 - up * 0.8, 260);
    // 水面上的影子
    D.ellipse(x - 10, SEA_Y + 12, 150, 10, { fill: 'rgba(20,60,100,0.25)', stroke: null });
    Wd.craft(x, y, 0.95, { wing: 1, spin: 1, prop: t * 20, foil: 1 - up, tilt: -0.03 });
    Wd.waterOverlay(SEA_Y, scroll, { amp: 5 });
    gearPanel(980, 110, up > 0.5 ? 2 : 1);
    if (t > L1 + 0.8) {
      const a = prog(t, L1 + 0.8, L1 + 1.4);
      D.alpha(a, () => {
        for (let i = 0; i < 3; i++) D.arrow(x - 110 + i * 40, y + 40, x - 110 + i * 40, y - 30 - Math.sin(t * 5 + i) * 6, { lw: 6, stroke: C.mode.fly, head: 18 });
      });
      if (t > L1 + 2.2) D.scaled(x - 250, y + 10, pop(t, L1 + 2.2), () => label('升力', x - 250, y + 10, 34, '#fff', C.mode.fly));
    }
    if (t > L2) {
      D.alpha(prog(t, L2, L2 + 0.5), () => {
        D.ctx.setLineDash([16, 12]); D.line(40, 210, 860, 210, { lw: 3, stroke: '#90a4ae' }); D.ctx.setLineDash([]);
        D.text('不往高处飞', 200, 180, { size: 30, color: '#78909c' });
        D.cross(380, 180, 0.8);
        D.dblArrow(820, SEA_Y + 2, 820, y + 4, { lw: 3.5, stroke: '#1565c0', head: 10 });
        label('只离水一小段', 960, SEA_Y - 50, 28, '#fff', '#1565c0');
      });
    }
  }

  // ---------------- 小知识：为什么要贴着水 ----------------
  function airfoil(x, y, s) {
    D.smooth([[x + 120 * s, y], [x + 100 * s, y - 22 * s], [x + 40 * s, y - 36 * s], [x - 40 * s, y - 26 * s], [x - 130 * s, y - 2 * s], [x - 40 * s, y + 8 * s], [x + 60 * s, y + 12 * s], [x + 110 * s, y + 8 * s]], { fill: C.wing, lw: 4, step: 20 });
  }
  function gnd(t, S) {
    const [L0, L1, L2, L3, L4, L5] = S.L;
    D.paper();
    if (t < L1) {
      D.scaled(640, 300, pop(t, 0.1, 0.5), () => {
        D.text('小知识', 640, 170, { size: 40, color: C.mode.trans });
        D.text('为什么非要贴着水面飞？', 640, 270, { size: 60, outline: '#fff' });
        Wd.craft(640, 470, 0.8, { wing: 1, spin: 1, prop: t * 20 });
        D.text('?', 820, 360, { size: 90, color: C.stripe });
      });
      return;
    }
    if (t < L5) {
      const wy = lerp(220, 430, ease(prog(t, L1 + 0.3, L2 + 0.3)));
      D.rect(-20, 500, W + 40, 240, { fill: C.sea, lw: 3.5, r: 0 });
      for (let i = 0; i < 8; i++) D.curve([[i * 170 + 40, 540], [i * 170 + 60, 548], [i * 170 + 80, 540], [i * 170 + 100, 548]], { stroke: '#fff', lw: 3 });
      // 气流：翅膀高的时候从下面溜走，低的时候被挤住
      const squeeze = prog(wy, 300, 430);
      for (let i = 0; i < 9; i++) {
        const ph = (t * 0.6 + i / 9) % 1, ax = lerp(960, 300, ph);
        const ay = wy + 30 + (i % 3) * 18 * (1 - squeeze * 0.6);
        const escape = (1 - squeeze) * Math.max(0, (ph - 0.5)) * 160;
        D.alpha(Math.sin(ph * Math.PI), () => D.arrow(ax + 40, ay + escape * 0.2, ax, ay + escape, { lw: 3, stroke: '#5c9ccf', head: 9 }));
      }
      airfoil(640, wy, 2.2);
      if (t < L2 + 0.3) D.alpha(prog(t, L1, L1 + 0.5), () => label(squeeze > 0.8 ? '离水很近' : '翅膀', 640, wy - 110, 30));
      if (t > L2) {
        const c = pop(t, L2 + 1.5, 0.6);
        D.scaled(640, 470, c, () => {
          D.smooth([[380, 470], [430, 448], [520, 452], [640, 446], [760, 452], [860, 448], [910, 470], [860, 494], [640, 498], [420, 494]], { fill: 'rgba(255,255,255,0.85)', stroke: '#5c9ccf', lw: 3.5, step: 30 });
          Wd.face(640, 472, 16, { look: 0 });
          if (t < L3) label('气垫', 980, 440, 34, '#fff', '#5c9ccf');
        });
      }
      if (t > L3) {
        const hy = 640 - ease(prog(t, L3 + 0.3, L3 + 1.2)) * 80;
        D.alpha(0.85, () => {
          D.rect(560, hy, 160, 110, { fill: '#ffe0c2', r: 40, lw: 3.5 });
          for (let f = 0; f < 4; f++) D.rect(566 + f * 38, hy - 50, 32, 70, { fill: '#ffe0c2', r: 16, lw: 3 });
          D.rect(500, hy + 40, 80, 32, { fill: '#ffe0c2', r: 16, lw: 3 });
        });
        if (t < L4) D.scaled(1020, 300, pop(t, L3 + 0.5), () => label('看不见的手，托着你', 1000, 300, 30));
      }
      if (t > L4) {
        D.scaled(220, 260, pop(t, L4 + 0.2), () => { D.circle(220, 260, 74, { fill: C.mode.foil, lw: 4 }); D.text('省力', 220, 262, { size: 42, color: '#fff' }); });
        D.scaled(1060, 260, pop(t, L4 + 1.2), () => { D.circle(1060, 260, 74, { fill: C.mode.float, lw: 4 }); D.text('更稳', 1060, 262, { size: 42, color: '#fff' }); });
      }
      return;
    }
    // 高度规则：正视图
    D.rect(-20, 560, W + 40, 200, { fill: C.sea, lw: 3.5, r: 0 });
    const s = 1.0, cy = 470;
    Wd.craftFront(640, cy, s, { wing: 1 });
    const span = 290 * s;
    D.alpha(prog(t, L5 + 0.2, L5 + 0.6), () => {
      D.dblArrow(640 - span, 230, 640 + span, 230, { lw: 4, stroke: '#1565c0' });
      D.text('翼展', 640, 200, { size: 32, color: '#1565c0', outline: '#fff' });
    });
    D.alpha(prog(t, L5 + 0.8, L5 + 1.3), () => {
      D.dblArrow(980, 560, 980, cy - 62, { lw: 4, stroke: C.stripe, head: 12 });
      D.text('离水高度', 1080, 510, { size: 30, color: C.stripe, outline: '#fff' });
    });
    D.scaled(640, 110, pop(t, L5 + 1.6), () => label('离水高度  ≤  翼展的一半', 640, 110, 38, '#fff', C.ink));
  }

  // ---------------- 8 掠飞巡航 ----------------
  function hmi(x, y, t, S, hi) {
    D.card(x, y, 560, 300, { fill: '#263238', stroke: '#111' });
    D.rect(x + 16, y + 16, 528, 268, { fill: '#37474f', r: 12, lw: 2, stroke: '#90a4ae' });
    // 航线
    const mx = x + 30, my = y + 40;
    D.rect(mx, my, 300, 220, { fill: hi === 0 ? '#2b4b5c' : '#33505e', r: 10, lw: hi === 0 ? 4 : 2, stroke: hi === 0 ? '#ffd54f' : '#78909c' });
    D.ellipse(mx + 60, my + 160, 34, 22, { fill: C.sand, lw: 2 }); D.text('A', mx + 60, my + 160, { size: 22 });
    D.ellipse(mx + 240, my + 60, 34, 22, { fill: C.sand, lw: 2 }); D.text('B', mx + 240, my + 60, { size: 22 });
    D.ctx.setLineDash([10, 8]); D.curve([[mx + 85, my + 145], [mx + 150, my + 120], [mx + 215, my + 75]], { stroke: '#4fc3f7', lw: 3 }); D.ctx.setLineDash([]);
    const k = (t * 0.08) % 1;
    D.circle(lerp(mx + 85, mx + 215, k), lerp(my + 145, my + 75, k), 8, { fill: '#ff8a3d', stroke: '#fff', lw: 2 });
    D.text('航线', mx + 150, my + 200, { size: 24, color: '#fff' });
    // 海况
    const rx = x + 350;
    D.rect(rx, my, 175, 100, { fill: '#33505e', r: 10, lw: hi === 1 ? 4 : 2, stroke: hi === 1 ? '#ffd54f' : '#78909c' });
    D.curve([[rx + 20, my + 40], [rx + 40, my + 30], [rx + 60, my + 40], [rx + 80, my + 30], [rx + 100, my + 40]], { stroke: '#4fc3f7', lw: 3 });
    D.text('1 级', rx + 140, my + 36, { size: 26, color: '#a5d6a7' });
    D.text('海况档位', rx + 88, my + 76, { size: 22, color: '#fff' });
    // 离水高度
    D.rect(rx, my + 120, 175, 100, { fill: '#33505e', r: 10, lw: hi === 2 ? 4 : 2, stroke: hi === 2 ? '#ffd54f' : '#78909c' });
    D.text('1.5 米', rx + 88, my + 156, { size: 30, color: '#ffcc80' });
    D.text('离水高度', rx + 88, my + 196, { size: 22, color: '#fff' });
  }
  function s8(t, S) {
    const [L0, L1, L2, L3, L4] = S.L;
    const scroll = t * 700;
    Wd.sky(); Wd.sun(1150, 100, 40, t); Wd.clouds(t, 70);
    const ik = prog(t, 0, S.d);
    Wd.island(lerp(1500, 1000, ik), SEA_Y + 2, lerp(200, 520, ik), lerp(40, 100, ik), { hill: true, palms: [[-0.4, lerp(0.5, 1, ik)], [0.3, lerp(0.5, 1.1, ik)]], t });
    Wd.sea(SEA_Y, scroll, { amp: 5 });
    Wd.speedLines(t, 0.8);
    for (let i = 0; i < 3; i++) Wd.bird(300 + i * 40 + Math.sin(t + i) * 10, 180 + i * 16, 1, t);
    const y = SEA_Y - 54 + Math.sin(t * 2) * 4;
    D.ellipse(390, SEA_Y + 12, 150, 10, { fill: 'rgba(20,60,100,0.25)', stroke: null });
    Wd.craft(400, y, 0.95, { wing: 1, spin: 1, prop: t * 20, tilt: -0.02 });
    Wd.waterOverlay(SEA_Y, scroll, { amp: 5 });
    if (t < L2) D.alpha(prog(t, L1, L1 + 0.5), () => label('下一座岛', 1060, 300, 30));
    if (t > L2) {
      const hi = t < L3 ? -1 : t < L3 + 0.9 ? 0 : t < L3 + 2.0 ? 1 : t < L4 ? 2 : -1;
      D.scaled(860, 360, pop(t, L2 + 0.2, 0.5), () => hmi(580, 130, t, S, hi));
      if (t > L4) D.scaled(1100, 520, pop(t, L4 + 0.2), () => label('一眼看懂', 1100, 520, 36, '#fff', C.ok));
    }
  }

  // ---------------- 9 减速落水 ----------------
  function s9(t, S) {
    const [L0, L1, L2] = S.L;
    const slow = ease(prog(t, L1, L1 + 3));
    const speed = lerp(700, 60, slow);
    const scroll = t * 700 - (700 - speed) * Math.max(0, t - L1) * 0.5;
    Wd.sky(); Wd.clouds(t, lerp(70, 10, slow));
    Wd.sea(SEA_Y, scroll, { amp: 5 });
    Wd.speedLines(t, 1 - slow);
    const down = ease(prog(t, L1 + 0.6, L1 + 2.4));
    const y = lerp(SEA_Y - 54, SEA_Y + 22, down) + (down >= 1 ? Math.sin(t * 2) * 2 : 0);
    D.ellipse(710, SEA_Y + 12, 150, 10, { fill: 'rgba(20,60,100,0.25)', stroke: null, alpha: 1 - down });
    Wd.spray(590, SEA_Y + 6, t, down > 0.9 ? (1 - slow) * 1.2 : 0, 200);
    Wd.craft(720, y, 0.95, { wing: 1, spin: 1 - slow * 0.7, prop: t * lerp(20, 5, slow), tilt: lerp(-0.02, 0.02, down) });
    Wd.waterOverlay(SEA_Y, scroll, { amp: 5 });
    gearPanel(980, 110, down < 0.5 ? 2 : 0);
    if (t > L2) {
      D.scaled(260, 260, pop(t, L2 + 0.3, 0.5), () => {
        D.card(40, 140, 440, 240);
        Wd.face(170, 250, 46, { cap: '#ff7043', look: 0.2 });
        D.rect(260, 210, 60, 90, { fill: 'rgba(205,238,252,0.7)', r: 6, lw: 3 });
        D.rect(264, 240 + Math.sin(t * 3) * 1.5, 52, 56, { fill: '#ffb74d', r: 4, stroke: null });
        D.text('一滴都不洒', 350, 340, { size: 26 });
        if (t > L2 + 1.6) { D.circle(410, 200, 34, { fill: '#e8f5e9', lw: 3 }); D.check(410, 202, 1.1); }
      });
    }
  }

  // ---------------- 10 靠岛 ----------------
  function s10(t, S) {
    const [L0, L1] = S.L;
    Wd.sky(); Wd.sun(1150, 100, 40, t); Wd.clouds(t);
    Wd.island(1180, SEA_Y + 2, 500, 120, { hill: true, palms: [[0.2, 1.1]], t });
    Wd.sea(SEA_Y, t * 30);
    // 码头
    D.rect(800, SEA_Y - 40, 500, 26, { fill: '#a1887f', r: 3, lw: 3 });
    for (let i = 0; i < 6; i++) D.rect(820 + i * 80, SEA_Y - 16, 12, 80, { fill: '#795548', r: 2, lw: 2.5 });
    const bx = 860, by = SEA_Y - 40;
    D.rect(bx - 12, by - 26, 24, 26, { fill: '#455a64', r: 6, lw: 3 }); D.ellipse(bx, by - 26, 18, 7, { fill: '#607d8b', lw: 2.5 });
    const k = easeOut(prog(t, 0.1, L1 + 1.8));
    const x = lerp(-150, 640, k);
    Wd.wake(x - 110, SEA_Y + 8, t, 1 - k, 220);
    Wd.craft(x, SEA_Y + 22 + Math.sin(t * 2.2) * 2, 0.85, { wing: 1, spin: 0.3 * (1 - k), prop: t * 6 * (1 - k) });
    Wd.waterOverlay(SEA_Y, t * 30);
    if (t > L1 + 2.0) {
      const r = prog(t, L1 + 2.0, L1 + 2.6);
      D.curve([[x + 110, SEA_Y - 60], [lerp(x + 110, bx, 0.5), SEA_Y - 40 + 18 * r], [lerp(x + 110, bx, r), lerp(SEA_Y - 60, by - 20, r)]], { stroke: '#8d6e63', lw: 5 });
      if (r >= 1 && t < L1 + 3) label('系缆绳', bx, by - 90, 28);
    }
    if (t > L1 + 3.0) {
      const w = prog(t, L1 + 3.0, S.d);
      Wd.person(lerp(820, 1120, w), by, 0.9, { walk: t * 10, shirt: '#ab47bc' });
      Wd.person(lerp(760, 1040, w), by, 0.9, { walk: t * 10 + 1, kid: true, shirt: '#ffb74d', cap: '#ff7043' });
      D.alpha(prog(t, L1 + 3, L1 + 3.4), () => label('上下客', 1060, 250, 30));
    }
  }

  // ---------------- 11 上岸 ----------------
  function s11(t, S) {
    const [L0, L1, L2] = S.L;
    Wd.sky(); Wd.clouds(t);
    Wd.sea(SEA_Y, t * 25);
    // 斜坡向上到右边陆地
    const rx0 = 560, ry0 = 620, rx1 = 1000, ry1 = 420;
    D.poly([[rx0, ry0 + 10], [rx1, ry1], [W + 30, ry1], [W + 30, H + 30], [rx0, H + 30]], { fill: '#bcaaa4', lw: 3.5 });
    // 景区大门
    D.rect(1100, 270, 18, 150, { fill: '#8d6e63', r: 3, lw: 3 }); D.rect(1240, 270, 18, 150, { fill: '#8d6e63', r: 3, lw: 3 });
    D.rect(1080, 240, 200, 50, { fill: '#ffcc80', r: 10, lw: 3 }); D.text('景区', 1180, 266, { size: 30 });
    Wd.palm(1050, 420, 0.9, t);
    const k1 = prog(t, 0.2, L1 + 0.6);           // 浮航到坡底
    const k2 = ease(prog(t, L1 + 0.6, L2 + 0.4)); // 爬坡
    const k3 = ease(prog(t, L2 + 1.4, S.d - 0.3)); // 开进景区
    const surf = xx => xx < rx0 ? 9999 : xx > rx1 ? ry1 : lerp(ry0, ry1, (xx - rx0) / (rx1 - rx0));
    const floatY = SEA_Y + 22 + Math.sin(t * 2.2) * 2;
    const yAt = xx => Math.min(surf(xx) - 16, floatY);
    let x = k3 > 0 ? lerp(rx1 + 40, 1500, k3) : k2 > 0 ? lerp(600, rx1 + 40, k2) : lerp(200, 600, easeOut(k1));
    const y = yAt(x), tilt = 0.8 * Math.atan2(yAt(x + 40) - yAt(x - 40), 80);
    const wheels = prog(t, L1, L1 + 0.6);
    const wing = 1 - prog(t, L2 + 0.2, L2 + 1.0);
    Wd.craft(x, y, 0.8, { wing, wheels, tilt, roll: x / 16 });
    Wd.waterOverlay(SEA_Y, t * 25);
    if (t > L1 && t < L2) D.alpha(prog(t, L1, L1 + 0.4), () => label('轮子放下', 400, 300, 30));
    if (t > L2 + 0.9) D.scaled(760, 220, pop(t, L2 + 0.9), () => label('又变回一辆车', 700, 220, 32, '#fff', C.mode.land));
  }

  // ---------------- 12 再出发 ----------------
  function s12(t, S) {
    const [L0, L1] = S.L;
    D.ctx.fillStyle = '#7fcbe8'; D.ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < 26; i++) {
      const x = hash(i) * W, y = hash(i * 3) * H;
      D.curve([[x, y], [x + 10, y + 5], [x + 20, y], [x + 30, y + 5]], { stroke: 'rgba(255,255,255,0.6)', lw: 2.5 });
    }
    const isl = [[170, 470, '出发岛'], [430, 230, '海龟岛'], [680, 440, '珊瑚岛'], [980, 210, '日落岛']];
    // 航线
    const path = [];
    for (let i = 0; i < 3; i++) { const a = isl[i], b = isl[i + 1]; for (let k = 0; k <= 20; k++) { const q = k / 20; path.push([lerp(a[0], b[0], q), lerp(a[1], b[1], q) - Math.sin(q * Math.PI) * 60]); } }
    D.ctx.setLineDash([14, 10]); D.curve(path, { stroke: '#fff', lw: 4 }); D.ctx.setLineDash([]);
    isl.forEach(([x, y, n], i) => {
      D.smooth([[x - 80, y], [x - 50, y - 40], [x + 10, y - 50], [x + 70, y - 25], [x + 80, y + 15], [x + 20, y + 40], [x - 60, y + 30]], { fill: C.sand, lw: 3.5 });
      D.smooth([[x - 40, y - 5], [x - 20, y - 30], [x + 20, y - 30], [x + 40, y], [x, y + 15]], { fill: C.green, stroke: C.green2, lw: 3 });
      D.text(n, x, y + 70, { size: 28, outline: '#fff' });
    });
    const k = prog(t, 0.5, S.d - 0.5);
    const idx = Math.min(path.length - 1, Math.floor(k * (path.length - 1)));
    const p = path[idx], q = path[Math.min(path.length - 1, idx + 1)];
    D.ctx.save(); D.ctx.translate(p[0], p[1]); D.ctx.rotate(Math.atan2(q[1] - p[1], q[0] - p[0]) * 0.3);
    Wd.craft(0, 0, 0.35, { wing: 1, spin: 1 }); D.ctx.restore();
    // 循环示意
    if (t > L1 + 0.5) {
      D.scaled(1030, 525, pop(t, L1 + 0.5, 0.5), () => {
        D.card(790, 420, 470, 200);
        const steps = ['入水', '浮航', '上台阶', '掠飞', '落水', '靠岛'];
        const cols = [C.mode.float, C.mode.float, C.mode.foil, C.mode.fly, C.mode.float, C.mode.float];
        const ox = 960, oy = 520;
        D.ellipse(ox, oy, 100, 52, { lw: 3, stroke: '#90a4ae' });
        steps.forEach((n, i) => {
          const a = -Math.PI / 2 + i / steps.length * Math.PI * 2;
          const cx = ox + Math.cos(a) * 120, cy = oy + Math.sin(a) * 66;
          const on = Math.floor(t * 2) % steps.length === i;
          label(n, cx, cy, on ? 24 : 20, on ? '#fff' : cols[i], on ? cols[i] : '#fffdf5');
        });
        D.text('× N', 1180, 500, { size: 48, color: C.stripe });
        D.text('座岛', 1180, 552, { size: 26 });
      });
    }
  }

  // ---------------- 总结 ----------------
  function recap(t, S) {
    const [L0, L1, L2, L3, L4] = S.L;
    if (t < L4) {
      D.paper();
      D.text('一句话总结', 640, 80, { size: 46 });
      const panels = [
        ['陆上', '是车', C.mode.land, L1, (x, y) => { road(y + 10, x - 160, x + 160); Wd.craft(x, y + 12, 0.7, { wing: 0, wheels: 1 }); }],
        ['水里', '是船', C.mode.float, L1 + 1.6, (x, y) => { D.rect(x - 175, y - 10, 350, 120, { fill: C.sea, stroke: null, r: 0 }); Wd.craft(x, y + 18, 0.7, { wing: 1 }); D.rect(x - 175, y - 6, 350, 120, { fill: 'rgba(60,160,210,0.5)', stroke: null, r: 0 }); }],
        ['海面上', '是贴水飞机', C.mode.fly, L2 + 0.3, (x, y) => { D.rect(x - 175, y - 10, 350, 120, { fill: C.sea, stroke: null, r: 0 }); Wd.spray(x - 110, y - 6, t, 0.5, 100); Wd.craft(x, y - 40 + Math.sin(t * 3) * 3, 0.7, { wing: 1, spin: 1, prop: t * 20 }); }],
      ];
      panels.forEach(([a, b, col, at, art], i) => {
        const cx = 230 + i * 410;
        D.scaled(cx, 340, pop(t, at, 0.5), () => {
          D.card(cx - 180, 140, 360, 400);
          D.ctx.save(); D.ctx.beginPath(); D.ctx.rect(cx - 176, 144, 352, 270); D.ctx.clip();
          Wd.sky(C.sky, C.sky2, 420); art(cx, 340);
          D.ctx.restore();
          D.text(a, cx, 455, { size: 32, color: '#777' });
          D.text(b, cx, 505, { size: 44, color: col });
        });
      });
      if (t > L3) D.scaled(640, 590, pop(t, L3 + 0.1), () => label('一趟旅程，三种身份', 640, 590, 40, '#fff', C.stripe));
      return;
    }
    // 片尾：日落
    Wd.sky('#ff9e80', '#ffe0b2', 470); Wd.sun(640, 380, 110, t, '#ffb74d');
    Wd.sea(470, t * 300, { amp: 4, color: '#ff8a65', color2: '#5c6bc0' });
    Wd.island(200, 472, 300, 60, { palms: [[0, 1]], t });
    const k = prog(t, L4, S.d);
    Wd.spray(lerp(-100, 1500, k) - 90, 485, t, 0.8);
    Wd.craft(lerp(-100, 1500, k), 448, 0.6, { wing: 1, spin: 1 });
    Wd.waterOverlay(470, t * 300, { amp: 4 });
    D.scaled(640, 170, pop(t, L4 + 0.3, 0.6), () => {
      D.text('下次去海岛', 640, 130, { size: 70, color: '#fff', outline: C.ink, olw: 10 });
      D.text('说不定就能坐上它！', 640, 220, { size: 60, color: '#fff59d', outline: C.ink, olw: 10 });
    });
    D.alpha(prog(t, S.d - 2.5, S.d - 1), () => {
      D.ctx.fillStyle = 'rgba(253,246,227,0.92)'; D.ctx.fillRect(0, 0, W, H);
      D.text('坐一次会飞的车去跳岛', 640, 320, { size: 64, color: C.stripe });
      D.text('陆上是车 · 水里是船 · 海面上贴水飞', 640, 410, { size: 34 });
    });
  }

  window.SCENES = { hook, rule, s1, s2, s3, s4, s5, s6, s7, gnd, s8, s9, s10, s11, s12, recap };
})();
