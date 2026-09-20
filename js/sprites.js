/* =========================================================================
 *  少林功夫娘 — sprites.js
 *  纯 Canvas 绘制的角色、敌人、道具与场景（无外部素材，可离线运行）。
 *  所有角色以「脚底中心」为原点 (0,0)，向上为负 y。
 * ========================================================================= */
(function (global) {
  "use strict";

  const Sprites = {};

  /* ---------- 小工具 ---------- */
  function rr(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  function circle(ctx, x, y, r) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.closePath();
  }

  /* =======================================================================
   *  女主角 · 功夫娘「小嵩」
   *  opts: { state, frame(0..1循环), facing(1/-1), hurt(bool), invuln(bool) }
   * ===================================================================== */
  Sprites.drawHeroine = function (ctx, opts) {
    const state = opts.state || "idle";
    const t = opts.frame || 0;               // 0..1 动画相位
    const facing = opts.facing || 1;
    const hurt = !!opts.hurt;

    ctx.save();
    ctx.scale(facing, 1);                     // 朝向翻转（原点为脚底中心）

    // 受击/无敌闪烁
    if (opts.invuln && Math.floor(opts.blinkT * 20) % 2 === 0) ctx.globalAlpha = 0.35;

    // 落地阴影
    ctx.save();
    ctx.globalAlpha *= 0.28;
    ctx.fillStyle = "#000";
    ctx.beginPath();
    ctx.ellipse(0, 1, 17, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // 动画驱动量
    const bob = state === "idle" ? Math.sin(t * Math.PI * 2) * 1.2 : 0;
    const walk = state === "walk" ? Math.sin(t * Math.PI * 2) : 0;
    let bodyLean = 0;
    if (hurt) bodyLean = -8;
    if (state === "punch") bodyLean = 4;
    if (state === "special") bodyLean = 6;

    ctx.translate(0, bob);
    ctx.save();
    ctx.translate(0, -30);
    ctx.rotate((bodyLean * Math.PI) / 180);
    ctx.translate(0, 30);

    /* ---- 腿 ---- */
    drawLegs(ctx, state, walk, t);

    /* ---- 身体（红金对襟袄）---- */
    // 裙摆/下摆
    ctx.fillStyle = "#c8261d";
    rr(ctx, -12, -30, 24, 18, 6);
    ctx.fill();
    ctx.fillStyle = "#e8b23a";                // 金色下摆边
    rr(ctx, -12, -16, 24, 4, 2);
    ctx.fill();

    // 上衣主体
    ctx.fillStyle = "#d62f24";
    rr(ctx, -11, -42, 22, 16, 7);
    ctx.fill();
    // 对襟白色衣襟
    ctx.fillStyle = "#f6ead0";
    ctx.beginPath();
    ctx.moveTo(0, -42);
    ctx.lineTo(6, -40);
    ctx.lineTo(2, -27);
    ctx.lineTo(0, -27);
    ctx.closePath();
    ctx.fill();
    // 腰带
    ctx.fillStyle = "#e8b23a";
    rr(ctx, -11, -30, 22, 4, 2);
    ctx.fill();
    ctx.fillStyle = "#8f1710";
    rr(ctx, -3, -30, 6, 8, 2);               // 腰带结
    ctx.fill();
    // 盘扣
    ctx.fillStyle = "#f4d67e";
    circle(ctx, 3, -38, 1.3); ctx.fill();
    circle(ctx, 3, -34, 1.3); ctx.fill();

    /* ---- 手臂 ---- */
    drawArms(ctx, state, walk, t, opts);

    /* ---- 头 ---- */
    drawHead(ctx, state, hurt, t);

    ctx.restore(); // bodyLean
    ctx.restore(); // facing

    // 气功波蓄力光（不翻转，画在身前）
    if (state === "special") {
      ctx.save();
      ctx.translate(facing * 16, -28);
      const g = ctx.createRadialGradient(0, 0, 1, 0, 0, 13);
      g.addColorStop(0, "rgba(150,220,255,.95)");
      g.addColorStop(1, "rgba(47,143,214,0)");
      ctx.fillStyle = g;
      circle(ctx, 0, 0, 13); ctx.fill();
      ctx.restore();
    }
  };

  function drawLegs(ctx, state, walk, t) {
    ctx.strokeStyle = "#2b2b33";
    ctx.lineWidth = 6;
    ctx.lineCap = "round";
    ctx.fillStyle = "#2b2b33";

    let frontAng = 0, backAng = 0;
    if (state === "walk") { frontAng = walk * 16; backAng = -walk * 16; }
    if (state === "jump") { frontAng = 22; backAng = -14; }
    if (state === "kick") { frontAng = 4; backAng = -4; }

    for (const [ang, dir] of [[backAng, -1], [frontAng, 1]]) {
      ctx.save();
      ctx.translate(dir * 4, -16);
      ctx.rotate((ang * Math.PI) / 180);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(0, 14);
      ctx.stroke();
      // 布鞋
      ctx.fillStyle = "#111";
      rr(ctx, -4, 12, 9, 5, 2);
      ctx.fill();
      ctx.fillStyle = "#e8b23a";
      rr(ctx, -4, 15, 9, 2, 1);
      ctx.fill();
      ctx.restore();
    }
  }

  function drawArms(ctx, state, walk, t, opts) {
    const skin = "#ffd9b8";
    const sleeve = "#d62f24";
    const cuff = "#e8b23a";

    // 后臂（远端，先画）
    drawArm(ctx, -8, -40, backArmAngle(state, walk), sleeve, cuff, skin, false, state);
    // 前臂
    drawArm(ctx, 8, -40, frontArmAngle(state, walk, t), sleeve, cuff, skin, true, state);
  }

  function frontArmAngle(state, walk, t) {
    switch (state) {
      case "punch": return 92;   // 向前平伸
      case "special": return 78;
      case "kick": return 40;
      case "jump": return -30;
      case "walk": return 60 + walk * 22;
      default: return 60 + Math.sin(t * Math.PI * 2) * 4;
    }
  }
  function backArmAngle(state, walk) {
    switch (state) {
      case "punch": return 45;
      case "special": return 72;
      case "kick": return -20;
      case "jump": return 30;
      case "walk": return 60 - walk * 22;
      default: return 62;
    }
  }

  function drawArm(ctx, sx, sy, ang, sleeve, cuff, skin, isFront, state) {
    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate((ang * Math.PI) / 180);
    // 广袖
    ctx.fillStyle = sleeve;
    rr(ctx, -3.5, 0, 7, 12, 3);
    ctx.fill();
    ctx.fillStyle = cuff;
    rr(ctx, -3.5, 10, 7, 3, 1.5);
    ctx.fill();
    // 前臂 + 拳
    ctx.strokeStyle = skin;
    ctx.lineWidth = 4.5;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(0, 12);
    ctx.lineTo(0, 18);
    ctx.stroke();
    ctx.fillStyle = skin;
    circle(ctx, 0, 19, 3); ctx.fill();
    // 出拳/气功时前手发光
    if (isFront && (state === "punch" || state === "special")) {
      ctx.fillStyle = state === "special" ? "rgba(150,220,255,.8)" : "rgba(255,220,120,.7)";
      circle(ctx, 0, 19, 5.5); ctx.fill();
    }
    ctx.restore();
  }

  function drawHead(ctx, state, hurt, t) {
    const skin = "#ffe0c2";
    const hair = "#241a14";
    const cy = -50;

    // 后发
    ctx.fillStyle = hair;
    circle(ctx, 0, cy + 1, 12); ctx.fill();

    // 两个丸子头 + 红花
    for (const dx of [-11, 11]) {
      ctx.fillStyle = hair;
      circle(ctx, dx, cy - 9, 6); ctx.fill();
      ctx.fillStyle = "#c8261d";               // 红头绳花
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        circle(ctx, dx + Math.cos(a) * 3.4, cy - 9 + Math.sin(a) * 3.4, 2);
        ctx.fill();
      }
      ctx.fillStyle = "#f4d67e";
      circle(ctx, dx, cy - 9, 1.8); ctx.fill();
    }

    // 脸
    ctx.fillStyle = skin;
    circle(ctx, 0, cy, 11); ctx.fill();

    // 刘海
    ctx.fillStyle = hair;
    ctx.beginPath();
    ctx.arc(0, cy, 11, Math.PI, 0);
    ctx.lineTo(11, cy - 2);
    ctx.quadraticCurveTo(6, cy + 4, 3, cy - 1);
    ctx.quadraticCurveTo(0, cy + 5, -3, cy - 1);
    ctx.quadraticCurveTo(-6, cy + 4, -11, cy - 2);
    ctx.closePath();
    ctx.fill();
    // 眉心朱砂痣
    ctx.fillStyle = "#c8261d";
    circle(ctx, 0, cy - 1, 1.3); ctx.fill();

    // 眼睛
    const eyeY = cy + 3;
    if (hurt) {
      ctx.strokeStyle = "#3a2b22";
      ctx.lineWidth = 1.6;
      for (const dx of [-4.5, 4.5]) {
        ctx.beginPath();
        ctx.moveTo(dx - 2, eyeY - 1.5);
        ctx.lineTo(dx + 2, eyeY + 1.5);
        ctx.moveTo(dx + 2, eyeY - 1.5);
        ctx.lineTo(dx - 2, eyeY + 1.5);
        ctx.stroke();
      }
    } else {
      for (const dx of [-4.5, 4.5]) {
        ctx.fillStyle = "#2b1a12";
        rr(ctx, dx - 2.2, eyeY - 2.6, 4.4, 5.2, 2.2);
        ctx.fill();
        ctx.fillStyle = "#fff";                // 高光
        circle(ctx, dx - 0.6, eyeY - 1.2, 1.1); ctx.fill();
        circle(ctx, dx + 1, eyeY + 1.2, 0.6); ctx.fill();
      }
    }
    // 腮红
    ctx.fillStyle = "rgba(255,120,110,.45)";
    circle(ctx, -6.5, cy + 5, 2.2); ctx.fill();
    circle(ctx, 6.5, cy + 5, 2.2); ctx.fill();
    // 嘴
    ctx.strokeStyle = "#a8322a";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    if (state === "punch" || state === "kick" || state === "special") {
      ctx.arc(0, cy + 6, 2.4, 0.15 * Math.PI, 0.85 * Math.PI); // 张口喝
    } else {
      ctx.arc(0, cy + 5.5, 2, 0.1 * Math.PI, 0.9 * Math.PI);
    }
    ctx.stroke();
  }

  /* =======================================================================
   *  敌人
   *  opts: { type, frame, facing, hurtFlash(0..1), hpRatio }
   * ===================================================================== */
  Sprites.drawEnemy = function (ctx, opts) {
    const type = opts.type;
    const facing = opts.facing || 1;
    ctx.save();
    ctx.scale(facing, 1);

    // 阴影
    ctx.save();
    ctx.globalAlpha = 0.26;
    ctx.fillStyle = "#000";
    ctx.beginPath();
    ctx.ellipse(0, 1, type === "boss" ? 30 : 15, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    if (type === "dummy") drawDummy(ctx, opts);
    else if (type === "thief") drawThief(ctx, opts);
    else if (type === "brute") drawBrute(ctx, opts);
    else if (type === "boss") drawBoss(ctx, opts);

    ctx.restore();

    // 受击白光
    if (opts.hurtFlash > 0) {
      ctx.save();
      ctx.globalAlpha = opts.hurtFlash * 0.7;
      ctx.globalCompositeOperation = "lighter";
      ctx.fillStyle = "#fff";
      const h = type === "boss" ? 84 : 46;
      const w = type === "boss" ? 54 : 26;
      rr(ctx, -w / 2, -h, w, h, 8);
      ctx.fill();
      ctx.restore();
    }
  };

  function drawDummy(ctx, opts) {
    const bob = Math.sin((opts.frame || 0) * Math.PI * 2) * 1.5;
    ctx.translate(0, bob);
    // 木桩身
    ctx.fillStyle = "#a9713c";
    rr(ctx, -9, -40, 18, 40, 7);
    ctx.fill();
    ctx.fillStyle = "#8a5a2c";
    rr(ctx, -9, -40, 6, 40, 7);              // 侧阴影
    ctx.fill();
    // 木钉手臂
    ctx.fillStyle = "#c88a4a";
    rr(ctx, 5, -34, 12, 4, 2); ctx.fill();
    rr(ctx, 5, -24, 12, 4, 2); ctx.fill();
    rr(ctx, -17, -30, 12, 4, 2); ctx.fill();
    // 木纹
    ctx.strokeStyle = "rgba(90,55,25,.5)";
    ctx.lineWidth = 1;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(-6 + i * 5, -38);
      ctx.lineTo(-6 + i * 5, -4);
      ctx.stroke();
    }
    // 凶脸
    ctx.fillStyle = "#3a2412";
    circle(ctx, -3, -32, 1.6); ctx.fill();
    circle(ctx, 3, -32, 1.6); ctx.fill();
    ctx.strokeStyle = "#3a2412";
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(-4, -25); ctx.lineTo(4, -25); ctx.stroke();
  }

  function drawThief(ctx, opts) {
    const walk = Math.sin((opts.frame || 0) * Math.PI * 2);
    // 腿
    ctx.strokeStyle = "#20242e";
    ctx.lineWidth = 5;
    ctx.lineCap = "round";
    for (const [d, s] of [[-3, -1], [3, 1]]) {
      ctx.save();
      ctx.translate(d, -15);
      ctx.rotate((walk * s * 14 * Math.PI) / 180);
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, 15); ctx.stroke();
      ctx.restore();
    }
    // 身（夜行装）
    ctx.fillStyle = "#2f3a52";
    rr(ctx, -9, -38, 18, 24, 5); ctx.fill();
    ctx.fillStyle = "#1f2636";
    rr(ctx, -9, -30, 18, 3, 1); ctx.fill();  // 腰带
    // 手臂
    ctx.strokeStyle = "#2f3a52";
    ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(7, -35); ctx.lineTo(12, -22); ctx.stroke();
    ctx.strokeStyle = "#ffd9b8";
    ctx.beginPath(); ctx.moveTo(12, -22); ctx.lineTo(15, -18); ctx.stroke();
    // 头 + 蒙面
    ctx.fillStyle = "#ffd9b8";
    circle(ctx, 0, -44, 9); ctx.fill();
    ctx.fillStyle = "#2f3a52";               // 头巾
    ctx.beginPath(); ctx.arc(0, -44, 9, Math.PI, 0); ctx.fill();
    rr(ctx, -9, -46, 18, 3, 1); ctx.fill();
    ctx.fillStyle = "#2f3a52";               // 面罩
    rr(ctx, -9, -42, 18, 6, 2); ctx.fill();
    // 眼
    ctx.fillStyle = "#ffcf3f";
    circle(ctx, -3.5, -44, 1.6); ctx.fill();
    circle(ctx, 3.5, -44, 1.6); ctx.fill();
  }

  function drawBrute(ctx, opts) {
    const bob = Math.sin((opts.frame || 0) * Math.PI * 2) * 1.2;
    ctx.translate(0, bob);
    // 腿
    ctx.fillStyle = "#5a3d2a";
    rr(ctx, -12, -20, 10, 20, 4); ctx.fill();
    rr(ctx, 2, -20, 10, 20, 4); ctx.fill();
    // 大肚
    ctx.fillStyle = "#e0a878";
    circle(ctx, 0, -30, 17); ctx.fill();
    ctx.fillStyle = "#caa070";
    rr(ctx, -14, -30, 28, 5, 2); ctx.fill(); // 布带
    // 手臂（粗）
    ctx.fillStyle = "#e0a878";
    rr(ctx, 10, -46, 9, 24, 4); ctx.fill();
    rr(ctx, -19, -46, 9, 24, 4); ctx.fill();
    circle(ctx, 14, -22, 5); ctx.fill();
    circle(ctx, -14, -22, 5); ctx.fill();
    // 头（光头）
    ctx.fillStyle = "#e8b48a";
    circle(ctx, 0, -52, 11); ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,.35)";
    circle(ctx, -3, -56, 3); ctx.fill();     // 头顶反光
    // 怒眉与眼
    ctx.strokeStyle = "#3a2412"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-7, -55); ctx.lineTo(-2, -53); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(7, -55); ctx.lineTo(2, -53); ctx.stroke();
    ctx.fillStyle = "#2b1a12";
    circle(ctx, -4, -51, 1.7); ctx.fill();
    circle(ctx, 4, -51, 1.7); ctx.fill();
    ctx.strokeStyle = "#7a2f28"; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.arc(0, -46, 3, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();
  }

  function drawBoss(ctx, opts) {
    const t = opts.frame || 0;
    const bob = Math.sin(t * Math.PI * 2) * 2;
    ctx.translate(0, bob);
    const capeSwing = Math.sin(t * Math.PI * 2) * 6;

    // 披风
    ctx.fillStyle = "#3a0d0a";
    ctx.beginPath();
    ctx.moveTo(-20, -70);
    ctx.quadraticCurveTo(-40 + capeSwing, -30, -26, -2);
    ctx.lineTo(26, -2);
    ctx.quadraticCurveTo(40 - capeSwing, -30, 20, -70);
    ctx.closePath();
    ctx.fill();

    // 腿
    ctx.fillStyle = "#20140e";
    rr(ctx, -16, -34, 13, 34, 5); ctx.fill();
    rr(ctx, 3, -34, 13, 34, 5); ctx.fill();
    // 躯干（黑金魔铠）
    ctx.fillStyle = "#241a2e";
    rr(ctx, -22, -74, 44, 46, 10); ctx.fill();
    ctx.fillStyle = "#4a2a1a";
    rr(ctx, -22, -50, 44, 8, 3); ctx.fill();  // 腰甲
    ctx.fillStyle = "#e8b23a";
    circle(ctx, 0, -56, 5); ctx.fill();       // 胸口宝珠
    ctx.fillStyle = "#c8261d";
    circle(ctx, 0, -56, 2.4); ctx.fill();
    // 肩甲
    ctx.fillStyle = "#3a2a1a";
    circle(ctx, -22, -70, 10); ctx.fill();
    circle(ctx, 22, -70, 10); ctx.fill();
    ctx.fillStyle = "#e8b23a";
    for (const sx of [-22, 22]) { circle(ctx, sx, -74, 3); ctx.fill(); }
    // 手臂
    ctx.fillStyle = "#241a2e";
    rr(ctx, 20, -70, 12, 34, 5); ctx.fill();
    rr(ctx, -32, -70, 12, 34, 5); ctx.fill();
    ctx.fillStyle = "#e0a878";
    circle(ctx, 26, -34, 6); ctx.fill();
    circle(ctx, -26, -34, 6); ctx.fill();
    // 头（狰狞）
    ctx.fillStyle = "#c89a72";
    circle(ctx, 0, -86, 13); ctx.fill();
    // 长发/鬓
    ctx.fillStyle = "#151018";
    ctx.beginPath(); ctx.arc(0, -88, 13, Math.PI, 0); ctx.fill();
    rr(ctx, -15, -90, 6, 22, 3); ctx.fill();
    rr(ctx, 9, -90, 6, 22, 3); ctx.fill();
    // 怒眉
    ctx.strokeStyle = "#151018"; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(-9, -89); ctx.lineTo(-2, -85); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(9, -89); ctx.lineTo(2, -85); ctx.stroke();
    // 赤色魔眼
    ctx.fillStyle = "#ff3b2f";
    circle(ctx, -5, -84, 2.4); ctx.fill();
    circle(ctx, 5, -84, 2.4); ctx.fill();
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = "rgba(255,59,47,.5)";
    circle(ctx, -5, -84, 4.5); ctx.fill();
    circle(ctx, 5, -84, 4.5); ctx.fill();
    ctx.restore();
    // 獠牙
    ctx.fillStyle = "#fff";
    ctx.beginPath(); ctx.moveTo(-4, -78); ctx.lineTo(-2, -74); ctx.lineTo(-6, -76); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(4, -78); ctx.lineTo(2, -74); ctx.lineTo(6, -76); ctx.closePath(); ctx.fill();
  }

  /* =======================================================================
   *  道具
   * ===================================================================== */
  Sprites.drawItem = function (ctx, type, t) {
    const bob = Math.sin(t * Math.PI * 2) * 3;
    ctx.save();
    ctx.translate(0, bob);
    if (type === "bun") {
      ctx.fillStyle = "#f3e8d0";
      circle(ctx, 0, 0, 9); ctx.fill();
      ctx.strokeStyle = "#d9c39a"; ctx.lineWidth = 1.2;
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        ctx.beginPath(); ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(a) * 9, Math.sin(a) * 9); ctx.stroke();
      }
      ctx.fillStyle = "#c8261d";
      circle(ctx, 0, -0.5, 1.6); ctx.fill();  // 红点
    } else if (type === "gourd") {
      ctx.fillStyle = "#3f9d5a";
      circle(ctx, 0, 3, 6.5); ctx.fill();
      circle(ctx, 0, -4, 4.5); ctx.fill();
      ctx.fillStyle = "#2f7d46";
      rr(ctx, -2, -10, 4, 3, 1); ctx.fill();  // 塞
      ctx.fillStyle = "rgba(255,255,255,.4)";
      circle(ctx, -2.2, 2, 1.6); ctx.fill();
    } else if (type === "coin") {
      ctx.fillStyle = "#e8b23a";
      circle(ctx, 0, 0, 8); ctx.fill();
      ctx.fillStyle = "#c8901e";
      circle(ctx, 0, 0, 8); ctx.save(); ctx.clip();
      ctx.fillStyle = "#f4d67e"; rr(ctx, -8, -8, 10, 16, 0); ctx.fill(); ctx.restore();
      ctx.fillStyle = "#8a5a12";
      rr(ctx, -2.4, -2.4, 4.8, 4.8, 0.6); ctx.fill(); // 方孔
    } else if (type === "scroll") {
      ctx.fillStyle = "#e8b23a";
      rr(ctx, -10, -12, 20, 24, 3); ctx.fill();
      ctx.fillStyle = "#f6ead0";
      rr(ctx, -8, -10, 16, 20, 2); ctx.fill();
      ctx.fillStyle = "#c8261d";
      ctx.font = "bold 11px serif";
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText("經", 0, 1);
    }
    // 闪光
    ctx.save();
    ctx.globalAlpha = 0.5 + Math.sin(t * Math.PI * 4) * 0.3;
    ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = type === "coin" ? "rgba(255,220,120,.6)" : "rgba(255,255,255,.4)";
    circle(ctx, 0, 0, 12); ctx.fill();
    ctx.restore();
    ctx.restore();
  };

  /* =======================================================================
   *  场景背景（含视差）
   *  theme: 0..4 对应五关
   * ===================================================================== */
  const THEMES = [
    { name: "少林山门", sky: ["#ffdca8", "#ffb27a"], hill: "#b5764a", far: "#7a4b2c" },
    { name: "练武场",  sky: ["#bfe3ff", "#7fb6e6"], hill: "#6f9b6a", far: "#4c7a52" },
    { name: "塔林",    sky: ["#f5c98a", "#e08a5a"], hill: "#8a5a3c", far: "#5c3a26" },
    { name: "藏经阁",  sky: ["#c9b6e6", "#8f6fb0"], hill: "#6a5488", far: "#463560" },
    { name: "大雄宝殿", sky: ["#3a2340", "#1a1020"], hill: "#4a2030", far: "#2a1018" },
  ];
  Sprites.themeName = (i) => THEMES[i].name;

  Sprites.drawBackground = function (ctx, theme, camX, W, H, groundY) {
    const th = THEMES[theme] || THEMES[0];
    // 天空
    const sky = ctx.createLinearGradient(0, 0, 0, groundY);
    sky.addColorStop(0, th.sky[0]);
    sky.addColorStop(1, th.sky[1]);
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, groundY);

    // 太阳/月
    ctx.save();
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = theme === 4 ? "#e8e0ff" : "#fff4d0";
    circle(ctx, W * 0.78, H * 0.24, theme === 4 ? 26 : 34); ctx.fill();
    ctx.restore();

    // 远山（嵩山）视差 0.2
    drawHills(ctx, th.far, camX * 0.2, W, groundY, 0.62, 120);
    // 近山 视差 0.45
    drawHills(ctx, th.hill, camX * 0.45, W, groundY, 0.78, 80);

    // 主题剪影（塔/殿）视差 0.6
    ctx.save();
    ctx.translate(-((camX * 0.6) % 480), 0);
    for (let i = -1; i < Math.ceil(W / 480) + 1; i++) {
      drawThemeSilhouette(ctx, theme, i * 480, groundY, th);
    }
    ctx.restore();

    // 地面
    const grd = ctx.createLinearGradient(0, groundY, 0, H);
    if (theme === 4) { grd.addColorStop(0, "#3a2418"); grd.addColorStop(1, "#1a0f0a"); }
    else { grd.addColorStop(0, "#7a5638"); grd.addColorStop(1, "#4a3320"); }
    ctx.fillStyle = grd;
    ctx.fillRect(0, groundY, W, H - groundY);
    // 地面砖纹（随相机滚动）
    ctx.strokeStyle = "rgba(0,0,0,.18)";
    ctx.lineWidth = 2;
    const tile = 56;
    const off = -(camX % tile);
    for (let x = off; x < W; x += tile) {
      ctx.beginPath(); ctx.moveTo(x, groundY); ctx.lineTo(x, H); ctx.stroke();
    }
    ctx.beginPath(); ctx.moveTo(0, groundY + 10); ctx.lineTo(W, groundY + 10); ctx.stroke();
    // 地表高光线
    ctx.strokeStyle = "rgba(255,220,150,.25)";
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(0, groundY + 1.5); ctx.lineTo(W, groundY + 1.5); ctx.stroke();
  };

  function drawHills(ctx, color, off, W, groundY, heightFrac, span) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(-100, groundY);
    const baseY = groundY;
    const peakY = groundY * heightFrac;
    let x = -100 - (off % (span * 2));
    let up = true;
    ctx.lineTo(x, baseY);
    while (x < W + 100) {
      x += span;
      ctx.quadraticCurveTo(x - span / 2, up ? peakY : baseY - 20, x, up ? peakY : baseY);
      up = !up;
    }
    ctx.lineTo(W + 100, baseY);
    ctx.closePath();
    ctx.fill();
  }

  // 主题建筑剪影
  function drawThemeSilhouette(ctx, theme, x, groundY, th) {
    ctx.save();
    ctx.globalAlpha = 0.9;
    if (theme === 0) {          // 山门牌坊
      drawGate(ctx, x + 120, groundY, "#5a2f1e");
    } else if (theme === 1) {   // 练武场：旗杆与院墙
      ctx.fillStyle = "#5f4a34";
      ctx.fillRect(x + 60, groundY - 70, 6, 70);
      ctx.fillStyle = "#c8261d";
      ctx.beginPath();
      ctx.moveTo(x + 66, groundY - 70);
      ctx.lineTo(x + 100, groundY - 60);
      ctx.lineTo(x + 66, groundY - 50);
      ctx.closePath(); ctx.fill();
      drawWall(ctx, x + 180, groundY, 200, "#7a5a3c");
    } else if (theme === 2) {   // 塔林
      drawPagoda(ctx, x + 90, groundY, 5, "#6a4a30");
      drawPagoda(ctx, x + 260, groundY, 4, "#7a5638");
      drawPagoda(ctx, x + 400, groundY, 6, "#5c3f28");
    } else if (theme === 3) {   // 藏经阁（多层楼阁）
      drawPavilion(ctx, x + 180, groundY, "#5a4570");
    } else {                    // 大雄宝殿
      drawHall(ctx, x + 200, groundY, "#3a1a24");
    }
    ctx.restore();
  }

  function drawGate(ctx, x, gy, color) {
    ctx.fillStyle = color;
    ctx.fillRect(x - 60, gy - 120, 12, 120);
    ctx.fillRect(x + 48, gy - 120, 12, 120);
    ctx.fillRect(x - 70, gy - 130, 130, 12);
    // 檐顶
    ctx.fillStyle = "#7a3a24";
    ctx.beginPath();
    ctx.moveTo(x - 84, gy - 130);
    ctx.lineTo(x + 74, gy - 130);
    ctx.lineTo(x + 54, gy - 150);
    ctx.lineTo(x - 64, gy - 150);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#c8261d";
    ctx.fillRect(x - 18, gy - 118, 36, 22);   // 匾
  }
  function drawWall(ctx, x, gy, w, color) {
    ctx.fillStyle = color;
    ctx.fillRect(x, gy - 60, w, 60);
    ctx.fillStyle = "#5c3f28";
    for (let i = 0; i < w; i += 24) {
      ctx.fillRect(x + i, gy - 70, 16, 10);   // 墙垛
    }
  }
  function drawPagoda(ctx, x, gy, tiers, color) {
    let w = 60, y = gy;
    for (let i = 0; i < tiers; i++) {
      ctx.fillStyle = color;
      ctx.fillRect(x - w / 2, y - 26, w, 26);
      ctx.fillStyle = "#3a2818";               // 檐
      ctx.beginPath();
      ctx.moveTo(x - w / 2 - 8, y - 26);
      ctx.lineTo(x + w / 2 + 8, y - 26);
      ctx.lineTo(x + w / 2 - 4, y - 34);
      ctx.lineTo(x - w / 2 + 4, y - 34);
      ctx.closePath(); ctx.fill();
      y -= 34; w *= 0.82;
    }
    ctx.fillStyle = "#e8b23a";
    circle(ctx, x, y - 6, 5); ctx.fill();
  }
  function drawPavilion(ctx, x, gy, color) {
    for (let f = 0; f < 3; f++) {
      const y = gy - f * 54;
      const w = 200 - f * 30;
      ctx.fillStyle = color;
      ctx.fillRect(x - w / 2, y - 44, w, 44);
      // 檐
      ctx.fillStyle = "#2f2440";
      ctx.beginPath();
      ctx.moveTo(x - w / 2 - 16, y - 44);
      ctx.lineTo(x + w / 2 + 16, y - 44);
      ctx.lineTo(x + w / 2 - 6, y - 58);
      ctx.lineTo(x - w / 2 + 6, y - 58);
      ctx.closePath(); ctx.fill();
      // 窗
      ctx.fillStyle = "#e8b23a";
      for (let i = -w / 2 + 20; i < w / 2 - 10; i += 34) {
        ctx.fillRect(x + i, y - 34, 18, 22);
      }
    }
  }
  function drawHall(ctx, x, gy, color) {
    ctx.fillStyle = color;
    ctx.fillRect(x - 160, gy - 120, 320, 120);
    // 柱
    ctx.fillStyle = "#5c1f1a";
    for (let i = -140; i <= 140; i += 56) ctx.fillRect(x + i, gy - 120, 12, 120);
    // 大屋顶
    ctx.fillStyle = "#241016";
    ctx.beginPath();
    ctx.moveTo(x - 200, gy - 120);
    ctx.lineTo(x + 200, gy - 120);
    ctx.lineTo(x + 120, gy - 180);
    ctx.lineTo(x - 120, gy - 180);
    ctx.closePath(); ctx.fill();
    // 匾
    ctx.fillStyle = "#c8261d";
    ctx.fillRect(x - 40, gy - 112, 80, 26);
    ctx.fillStyle = "#e8b23a";
    ctx.font = "bold 16px serif";
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText("大雄", x, gy - 99);
  }

  /* 关门（终点）图形，供 game.js 调用 */
  Sprites.drawGoalGate = function (ctx, groundY, t) {
    ctx.save();
    // 立柱
    ctx.fillStyle = "#7a3a24";
    ctx.fillRect(-34, groundY - 150, 16, 150);
    ctx.fillRect(18, groundY - 150, 16, 150);
    // 横梁 + 檐
    ctx.fillStyle = "#8a4428";
    ctx.fillRect(-46, groundY - 168, 92, 20);
    ctx.beginPath();
    ctx.moveTo(-58, groundY - 168);
    ctx.lineTo(58, groundY - 168);
    ctx.lineTo(40, groundY - 190);
    ctx.lineTo(-40, groundY - 190);
    ctx.closePath();
    ctx.fillStyle = "#5a2f1e"; ctx.fill();
    // 匾额「关」
    ctx.fillStyle = "#c8261d";
    ctx.fillRect(-20, groundY - 160, 40, 26);
    ctx.fillStyle = "#f4d67e";
    ctx.font = "bold 20px serif";
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText("關", 0, groundY - 146);
    // 光门
    ctx.save();
    ctx.globalAlpha = 0.35 + Math.sin(t * Math.PI * 2) * 0.15;
    const g = ctx.createLinearGradient(0, groundY, 0, groundY - 150);
    g.addColorStop(0, "rgba(255,220,120,0)");
    g.addColorStop(1, "rgba(255,220,120,.8)");
    ctx.fillStyle = g;
    ctx.fillRect(-18, groundY - 148, 36, 148);
    ctx.restore();
    ctx.restore();
  };

  global.Sprites = Sprites;
})(window);
