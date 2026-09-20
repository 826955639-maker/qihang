/* =========================================================================
 *  少林功夫娘 — game.js
 *  横版动作闯关：物理、战斗、AI、关卡、输入、音效与主循环。
 * ========================================================================= */
(function () {
  "use strict";

  const W = 960, H = 540, GROUND_Y = 470;
  const GRAV = 0.72;

  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");

  /* ------------------------------------------------------------------ *
   *  输入
   * ------------------------------------------------------------------ */
  const keys = {
    left: false, right: false, jump: false,
    punch: false, kick: false, special: false,
  };
  // 边沿触发（按下瞬间）
  const pressed = { jump: false, punch: false, kick: false, special: false };

  const KEYMAP = {
    ArrowLeft: "left", KeyA: "left",
    ArrowRight: "right", KeyD: "right",
    ArrowUp: "jump", KeyW: "jump", Space: "jump",
    KeyJ: "punch", KeyK: "kick", KeyL: "special",
  };

  addEventListener("keydown", (e) => {
    if (e.code === "KeyP") { togglePause(); return; }
    const k = KEYMAP[e.code];
    if (!k) return;
    e.preventDefault();
    if (!keys[k]) pressed[k] = true;  // 首次按下
    keys[k] = true;
  });
  addEventListener("keyup", (e) => {
    const k = KEYMAP[e.code];
    if (!k) return;
    e.preventDefault();
    keys[k] = false;
  });

  // 触屏按钮
  function bindTouch() {
    document.querySelectorAll("#touch-controls .tbtn").forEach((btn) => {
      const key = btn.dataset.key;
      const on = (e) => { e.preventDefault(); if (!keys[key]) pressed[key] = true; keys[key] = true; };
      const off = (e) => { e.preventDefault(); keys[key] = false; };
      btn.addEventListener("touchstart", on, { passive: false });
      btn.addEventListener("touchend", off, { passive: false });
      btn.addEventListener("touchcancel", off, { passive: false });
      btn.addEventListener("mousedown", on);
      btn.addEventListener("mouseup", off);
      btn.addEventListener("mouseleave", off);
    });
  }

  function consumePress(name) {
    if (pressed[name]) { pressed[name] = false; return true; }
    return false;
  }

  /* ------------------------------------------------------------------ *
   *  音效（WebAudio，用户手势后初始化）
   * ------------------------------------------------------------------ */
  let audioCtx = null;
  function initAudio() {
    if (audioCtx) return;
    try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {}
  }
  function beep(freq, dur, type, vol, slideTo) {
    if (!audioCtx) return;
    const t0 = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    osc.type = type || "square";
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    g.gain.setValueAtTime(vol || 0.12, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(g); g.connect(audioCtx.destination);
    osc.start(t0); osc.stop(t0 + dur);
  }
  const SFX = {
    punch: () => beep(220, 0.08, "square", 0.10, 120),
    kick:  () => beep(160, 0.12, "sawtooth", 0.12, 80),
    special:() => beep(520, 0.30, "sine", 0.14, 180),
    hit:   () => beep(320, 0.06, "square", 0.10, 90),
    hurt:  () => beep(200, 0.16, "sawtooth", 0.14, 70),
    jump:  () => beep(420, 0.10, "sine", 0.10, 660),
    coin:  () => beep(880, 0.08, "triangle", 0.10, 1320),
    heal:  () => beep(660, 0.16, "sine", 0.12, 990),
    clear: () => { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => beep(f, 0.22, "triangle", 0.14), i * 130)); },
    lose:  () => { [400, 320, 240, 160].forEach((f, i) => setTimeout(() => beep(f, 0.26, "sawtooth", 0.14), i * 150)); },
    win:   () => { [523, 659, 784, 1046, 1318].forEach((f, i) => setTimeout(() => beep(f, 0.26, "triangle", 0.14), i * 160)); },
  };

  /* ------------------------------------------------------------------ *
   *  关卡数据
   * ------------------------------------------------------------------ */
  const LEVELS = [
    {
      theme: 0, length: 2600,
      platforms: [{ x: 900, y: 360, w: 150 }, { x: 1500, y: 320, w: 150 }],
      spawns: [
        { type: "dummy", x: 650 }, { type: "dummy", x: 1100 },
        { type: "thief", x: 1550 }, { type: "dummy", x: 1900 },
        { type: "thief", x: 2200 },
      ],
      items: [
        { type: "coin", x: 500 }, { type: "coin", x: 560 }, { type: "coin", x: 620 },
        { type: "coin", x: 940, y: 320 }, { type: "coin", x: 1000, y: 320 },
        { type: "bun", x: 1300 }, { type: "gourd", x: 1750 },
        { type: "coin", x: 2000 }, { type: "coin", x: 2060 },
      ],
    },
    {
      theme: 1, length: 3000,
      platforms: [{ x: 800, y: 360, w: 140 }, { x: 1250, y: 300, w: 140 }, { x: 1900, y: 340, w: 160 }],
      spawns: [
        { type: "thief", x: 620 }, { type: "thief", x: 1000 },
        { type: "brute", x: 1400 }, { type: "thief", x: 1750 },
        { type: "thief", x: 2100 }, { type: "brute", x: 2500 },
      ],
      items: [
        { type: "coin", x: 800, y: 320 }, { type: "coin", x: 1250, y: 260 },
        { type: "bun", x: 1450 }, { type: "gourd", x: 1600 },
        { type: "coin", x: 1900, y: 300 }, { type: "coin", x: 1960, y: 300 },
        { type: "bun", x: 2350 }, { type: "coin", x: 2650 },
      ],
    },
    {
      theme: 2, length: 3200,
      platforms: [
        { x: 700, y: 350, w: 120 }, { x: 1050, y: 290, w: 120 },
        { x: 1400, y: 350, w: 120 }, { x: 2000, y: 300, w: 140 }, { x: 2450, y: 350, w: 140 },
      ],
      spawns: [
        { type: "brute", x: 600 }, { type: "thief", x: 950 },
        { type: "thief", x: 1300 }, { type: "brute", x: 1700 },
        { type: "thief", x: 2050 }, { type: "brute", x: 2400 }, { type: "thief", x: 2750 },
      ],
      items: [
        { type: "coin", x: 700, y: 310 }, { type: "coin", x: 1050, y: 250 },
        { type: "gourd", x: 1400, y: 310 }, { type: "bun", x: 1750 },
        { type: "coin", x: 2000, y: 260 }, { type: "coin", x: 2060, y: 260 },
        { type: "bun", x: 2500 }, { type: "gourd", x: 2850 },
      ],
    },
    {
      theme: 3, length: 3400,
      platforms: [
        { x: 650, y: 350, w: 120 }, { x: 1000, y: 300, w: 120 }, { x: 1350, y: 250, w: 120 },
        { x: 1750, y: 320, w: 140 }, { x: 2200, y: 280, w: 140 }, { x: 2700, y: 340, w: 140 },
      ],
      spawns: [
        { type: "thief", x: 600 }, { type: "brute", x: 950 },
        { type: "thief", x: 1300 }, { type: "thief", x: 1450 },
        { type: "brute", x: 1900 }, { type: "brute", x: 2300 },
        { type: "thief", x: 2600 }, { type: "brute", x: 2950 },
      ],
      items: [
        { type: "coin", x: 650, y: 310 }, { type: "coin", x: 1000, y: 260 }, { type: "coin", x: 1350, y: 210 },
        { type: "bun", x: 1600 }, { type: "gourd", x: 1750, y: 280 },
        { type: "bun", x: 2200, y: 240 }, { type: "gourd", x: 2650 }, { type: "coin", x: 3000 },
      ],
    },
    {
      theme: 4, length: 1900, boss: true,
      platforms: [{ x: 500, y: 340, w: 130 }, { x: 1400, y: 340, w: 130 }],
      spawns: [{ type: "boss", x: 1300 }],
      items: [
        { type: "bun", x: 400 }, { type: "gourd", x: 600 },
        { type: "bun", x: 900 }, { type: "gourd", x: 1000 },
      ],
    },
  ];

  const ENEMY_STATS = {
    dummy: { hp: 22, speed: 0.55, dmg: 6, aggro: 260, range: 38, w: 26, h: 42, score: 100, atkCd: 90 },
    thief: { hp: 30, speed: 1.7, dmg: 8, aggro: 420, range: 34, w: 26, h: 50, score: 150, atkCd: 65 },
    brute: { hp: 64, speed: 0.85, dmg: 16, aggro: 360, range: 46, w: 42, h: 58, score: 260, atkCd: 80 },
    boss:  { hp: 340, speed: 1.05, dmg: 20, aggro: 2000, range: 64, w: 64, h: 92, score: 2000, atkCd: 70 },
  };

  /* ------------------------------------------------------------------ *
   *  游戏状态
   * ------------------------------------------------------------------ */
  const G = {
    mode: "title",           // title | playing | paused | clear | end
    levelIndex: 0,
    camX: 0,
    time: 0,                 // 全局计时（帧相位用）
    player: null,
    enemies: [],
    items: [],
    projectiles: [],
    particles: [],
    platforms: [],
    level: null,
    goalX: 0,
    gateOpen: false,
    bannerT: 0,
    score: 0,
    coins: 0,
    combo: 0,
    comboT: 0,
    shake: 0,
    ending: false,
  };

  /* ------------------------------------------------------------------ *
   *  实体构造
   * ------------------------------------------------------------------ */
  function makePlayer() {
    return {
      x: 80, y: GROUND_Y, vx: 0, vy: 0, w: 28, h: 60,
      facing: 1, onGround: true, jumps: 0,
      maxHp: 100, hp: 100, maxChi: 100, chi: 50,
      state: "idle", animT: 0,
      attack: null,           // {name, timer, dur, active:[a,b], hitSet:Set}
      invuln: 0, blinkT: 0, hurt: 0,
    };
  }

  function makeEnemy(type, x) {
    const s = ENEMY_STATS[type];
    return {
      type, x, y: GROUND_Y, vx: 0, vy: 0, w: s.w, h: s.h,
      hp: s.hp, maxHp: s.hp, facing: -1, onGround: true,
      animT: Math.random(), hurtFlash: 0, atkCd: 0, stun: 0,
      // boss 专用
      bossState: "idle", bossTimer: 90, dead: false,
    };
  }

  function makeItem(type, x, y) {
    return { type, x, y: y != null ? y : GROUND_Y - 14, t: Math.random(), taken: false };
  }

  /* ------------------------------------------------------------------ *
   *  关卡装载
   * ------------------------------------------------------------------ */
  function loadLevel(i) {
    const lv = LEVELS[i];
    G.level = lv;
    G.levelIndex = i;
    G.platforms = lv.platforms.map((p) => ({ ...p }));
    G.enemies = lv.spawns.map((s) => makeEnemy(s.type, s.x));
    G.items = lv.items.map((it) => makeItem(it.type, it.x, it.y));
    G.projectiles = [];
    G.particles = [];
    G.goalX = lv.length - 90;
    G.gateOpen = false;
    G.camX = 0;
    G.bannerT = 2.2;

    if (!G.player) G.player = makePlayer();
    G.player.x = 80; G.player.y = GROUND_Y; G.player.vx = 0; G.player.vy = 0;
    G.player.state = "idle"; G.player.attack = null; G.player.invuln = 60;

    showBanner(`第 ${i + 1} 关　${Sprites.themeName(lv.theme)}`);
  }

  /* ------------------------------------------------------------------ *
   *  物理辅助
   * ------------------------------------------------------------------ */
  function aabb(a, b) {
    return (
      a.x - a.w / 2 < b.x + b.w / 2 &&
      a.x + a.w / 2 > b.x - b.w / 2 &&
      a.y - a.h < b.y &&
      a.y > b.y - b.h
    );
  }

  // 处理与地面/平台的竖直碰撞，返回是否落地
  function resolveVertical(e) {
    e.y += e.vy;
    let landed = false;
    // 地面
    if (e.y >= GROUND_Y) { e.y = GROUND_Y; e.vy = 0; landed = true; }
    // 平台（仅下落时从上方着陆）
    if (e.vy >= 0) {
      for (const p of G.platforms) {
        const prevFeet = e.y - e.vy;
        if (
          e.x > p.x - p.w / 2 - 4 && e.x < p.x + p.w / 2 + 4 &&
          prevFeet <= p.y + 6 && e.y >= p.y && e.y <= p.y + 24
        ) {
          e.y = p.y; e.vy = 0; landed = true;
        }
      }
    }
    return landed;
  }

  /* ------------------------------------------------------------------ *
   *  玩家更新
   * ------------------------------------------------------------------ */
  const ATTACKS = {
    punch:   { dur: 14, active: [4, 9], dmg: 12, range: 34, kb: 4, lunge: 0, cost: 0 },
    kick:    { dur: 20, active: [6, 14], dmg: 18, range: 42, kb: 8, lunge: 2.4, cost: 0, launch: -6 },
    special: { dur: 26, active: [12, 13], dmg: 26, range: 0, kb: 10, lunge: 0, cost: 30 },
  };

  function updatePlayer(p) {
    p.animT = (p.animT + 0.02) % 1;
    if (p.invuln > 0) { p.invuln--; p.blinkT += 0.016; }
    if (p.hurt > 0) p.hurt--;

    // 起手攻击
    if (!p.attack) {
      if (consumePress("punch")) startAttack(p, "punch");
      else if (consumePress("kick")) startAttack(p, "kick");
      else if (consumePress("special") && p.chi >= ATTACKS.special.cost) startAttack(p, "special");
    }

    const attacking = !!p.attack;
    const moveLock = attacking ? 0.35 : 1;

    // 水平移动
    let ax = 0;
    if (keys.left) ax -= 1;
    if (keys.right) ax += 1;
    if (ax !== 0 && !attacking) p.facing = ax > 0 ? 1 : -1;
    const targetVx = ax * 3.1 * moveLock;
    p.vx += (targetVx - p.vx) * 0.4;
    if (Math.abs(p.vx) < 0.05) p.vx = 0;

    // 跳跃 / 二段跳
    if (consumePress("jump") && p.jumps < 2 && !attacking) {
      p.vy = -12.6;
      p.jumps++;
      p.onGround = false;
      SFX.jump();
      spawnDust(p.x, p.y, 6);
    }

    // 攻击位移（踢击前冲）
    if (attacking && p.attack.name === "kick" && p.attack.timer < 12) {
      p.x += p.facing * ATTACKS.kick.lunge;
    }

    p.x += p.vx;
    // 关卡边界
    p.x = Math.max(20, Math.min(p.x, G.level.length - 20));
    // 未过关时被关门拦住
    if (!G.gateOpen && !G.level.boss && p.x > G.goalX - 10) p.x = G.goalX - 10;

    // 重力
    p.vy += GRAV;
    p.onGround = resolveVertical(p);
    if (p.onGround) p.jumps = 0;

    // 攻击推进
    if (p.attack) {
      const a = p.attack;
      a.timer++;
      const def = ATTACKS[a.name];
      // 命中判定窗口
      if (a.timer >= def.active[0] && a.timer <= def.active[1]) {
        if (a.name === "special") {
          if (!a.fired) { fireQigong(p); a.fired = true; }
        } else {
          doMeleeHit(p, def, a);
        }
      }
      if (a.timer >= def.dur) p.attack = null;
    }

    // 状态机（用于绘制）
    if (p.attack) p.state = p.attack.name;
    else if (!p.onGround) p.state = "jump";
    else if (Math.abs(p.vx) > 0.4) p.state = "walk";
    else p.state = "idle";

    // 内力缓慢回复
    if (p.chi < p.maxChi) p.chi = Math.min(p.maxChi, p.chi + 0.06);
  }

  function startAttack(p, name) {
    const def = ATTACKS[name];
    p.attack = { name, timer: 0, hitSet: new Set(), fired: false };
    if (name === "special") p.chi -= def.cost;
    if (name === "kick" && p.onGround) { /* 前冲在 update 中处理 */ }
    if (name === "punch") SFX.punch();
    else if (name === "kick") SFX.kick();
    else SFX.special();
  }

  function doMeleeHit(p, def, a) {
    const hb = {
      x: p.x + p.facing * (def.range / 2 + 6),
      y: p.y - 30,
      w: def.range, h: 46,
    };
    for (const e of G.enemies) {
      if (e.dead || a.hitSet.has(e)) continue;
      const eb = { x: e.x, y: e.y, w: e.w, h: e.h };
      if (rectOverlap(hb, eb)) {
        a.hitSet.add(e);
        damageEnemy(e, def.dmg, p.facing, def.kb, def.launch || 0);
      }
    }
  }

  function rectOverlap(a, b) {
    return (
      a.x - a.w / 2 < b.x + b.w / 2 &&
      a.x + a.w / 2 > b.x - b.w / 2 &&
      a.y - a.h / 2 < b.y &&
      a.y + a.h / 2 > b.y - b.h
    );
  }

  function fireQigong(p) {
    G.projectiles.push({
      x: p.x + p.facing * 24, y: p.y - 30,
      vx: p.facing * 8.5, vy: 0, w: 26, h: 26,
      dmg: ATTACKS.special.dmg, facing: p.facing, from: "player",
      life: 90, t: 0,
    });
    G.shake = Math.max(G.shake, 5);
  }

  /* ------------------------------------------------------------------ *
   *  敌人更新
   * ------------------------------------------------------------------ */
  function updateEnemy(e) {
    if (e.dead) return;
    const p = G.player;
    e.animT = (e.animT + 0.02) % 1;
    if (e.hurtFlash > 0) e.hurtFlash -= 0.08;
    if (e.stun > 0) { e.stun--; }
    if (e.atkCd > 0) e.atkCd--;

    if (e.type === "boss") { updateBoss(e); return; }

    const s = ENEMY_STATS[e.type];
    const dx = p.x - e.x;
    const dist = Math.abs(dx);

    if (e.stun <= 0) {
      if (dist < s.aggro && dist > s.range * 0.8) {
        e.facing = dx > 0 ? 1 : -1;
        e.vx = e.facing * s.speed;
      } else {
        e.vx *= 0.7;
      }
      // 近身攻击
      if (dist < s.range && e.atkCd <= 0 && Math.abs(p.y - e.y) < 50) {
        e.atkCd = s.atkCd;
        hurtPlayer(s.dmg, e.facing);
      }
    } else {
      e.vx *= 0.85;
    }

    e.x += e.vx;
    e.x = Math.max(20, Math.min(e.x, G.level.length - 20));
    e.vy += GRAV;
    e.onGround = resolveVertical(e);
  }

  function updateBoss(e) {
    const p = G.player;
    const s = ENEMY_STATS.boss;
    const dx = p.x - e.x;
    const dist = Math.abs(dx);
    e.facing = dx > 0 ? 1 : -1;

    e.bossTimer--;
    if (e.stun > 0) { e.vx *= 0.8; }
    else {
      switch (e.bossState) {
        case "idle":
          e.vx += ((Math.sign(dx) * s.speed) - e.vx) * 0.1;
          // 近身接触伤害
          if (dist < s.range && e.atkCd <= 0) {
            e.atkCd = s.atkCd; hurtPlayer(s.dmg, e.facing);
          }
          if (e.bossTimer <= 0) {
            // 选择技能
            if (dist > 300) { e.bossState = "cast"; e.bossTimer = 40; }
            else { e.bossState = "leap"; e.bossTimer = 34; e.vy = -15; e.onGround = false; e.vx = e.facing * 5; }
          }
          break;
        case "cast":
          e.vx *= 0.8;
          if (e.bossTimer === 20) {
            // 双向散射三道魔焰
            for (const off of [-14, 0, 14]) {
              G.projectiles.push({
                x: e.x + e.facing * 30, y: e.y - 50 + off,
                vx: e.facing * 6.2, vy: off * 0.06, w: 24, h: 24,
                dmg: 14, facing: e.facing, from: "boss", life: 150, t: 0,
              });
            }
            SFX.special();
          }
          if (e.bossTimer <= 0) { e.bossState = "idle"; e.bossTimer = 110; }
          break;
        case "leap":
          // 跳劈：落地产生冲击波
          if (e.onGround && e.bossTimer < 30) {
            G.shake = 10;
            spawnDust(e.x, e.y, 20);
            // 落地冲击
            if (dist < 130 && Math.abs(p.y - e.y) < 60) hurtPlayer(s.dmg + 4, e.facing);
            e.bossState = "idle"; e.bossTimer = 90; e.vx = 0;
          }
          break;
      }
    }

    e.x += e.vx;
    e.x = Math.max(40, Math.min(e.x, G.level.length - 40));
    e.vy += GRAV;
    e.onGround = resolveVertical(e);
    if (e.bossTimer <= -600) e.bossState = "idle"; // 安全阀
  }

  /* ------------------------------------------------------------------ *
   *  伤害结算
   * ------------------------------------------------------------------ */
  function damageEnemy(e, dmg, dir, kb, launch) {
    e.hp -= dmg;
    e.hurtFlash = 1;
    e.stun = e.type === "boss" ? 8 : 16;
    e.vx = dir * kb;
    if (launch && e.type !== "boss") { e.vy = launch; e.onGround = false; }
    SFX.hit();
    spawnHitSpark(e.x + dir * 6, e.y - e.h * 0.6);
    G.shake = Math.max(G.shake, 4);

    if (e.hp <= 0) killEnemy(e);
  }

  function killEnemy(e) {
    if (e.dead) return;
    e.dead = true;
    const s = ENEMY_STATS[e.type];
    // 连击
    G.combo++;
    G.comboT = 150;
    const mult = 1 + Math.min(G.combo - 1, 9) * 0.1;
    G.score += Math.round(s.score * mult);
    // 掉落粒子 + 铜钱
    spawnBurst(e.x, e.y - e.h / 2, e.type === "boss" ? 40 : 12);
    if (e.type !== "boss" && Math.random() < 0.5) {
      G.items.push(makeItem("coin", e.x, e.y - 20));
    }
    if (e.type === "brute" && Math.random() < 0.5) {
      G.items.push(makeItem(Math.random() < 0.5 ? "bun" : "gourd", e.x, e.y - 20));
    }

    if (e.type === "boss") {
      // 掉落真经 + 触发胜利
      G.items.push(makeItem("scroll", e.x, e.y - 40));
      G.shake = 16;
      setTimeout(() => triggerWin(), 900);
    }
  }

  function hurtPlayer(dmg, dir) {
    const p = G.player;
    if (p.invuln > 0) return;
    p.hp -= dmg;
    p.hurt = 30;
    p.invuln = 70;
    p.blinkT = 0;
    p.vx = dir * 5;
    p.vy = -5;
    p.onGround = false;
    G.combo = 0;
    SFX.hurt();
    G.shake = Math.max(G.shake, 7);
    spawnHitSpark(p.x - dir * 6, p.y - 34, "#ff6a5c");
    if (p.hp <= 0) { p.hp = 0; triggerLose(); }
  }

  /* ------------------------------------------------------------------ *
   *  抛射物
   * ------------------------------------------------------------------ */
  function updateProjectiles() {
    const p = G.player;
    for (const pr of G.projectiles) {
      pr.t += 0.05;
      pr.x += pr.vx;
      pr.y += pr.vy;
      pr.life--;
      if (pr.from === "player") {
        for (const e of G.enemies) {
          if (e.dead) continue;
          if (rectOverlap({ x: pr.x, y: pr.y + pr.h / 2, w: pr.w, h: pr.h },
                          { x: e.x, y: e.y, w: e.w, h: e.h })) {
            damageEnemy(e, pr.dmg, pr.facing, 8, 0);
            pr.life = 0;
            break;
          }
        }
      } else {
        if (aabbPoint(pr, p)) { hurtPlayer(pr.dmg, pr.facing); pr.life = 0; }
      }
    }
    G.projectiles = G.projectiles.filter((pr) => pr.life > 0 && pr.x > -40 && pr.x < G.level.length + 40);
  }
  function aabbPoint(pr, p) {
    return rectOverlap({ x: pr.x, y: pr.y + pr.h / 2, w: pr.w, h: pr.h },
                       { x: p.x, y: p.y, w: p.w, h: p.h });
  }

  /* ------------------------------------------------------------------ *
   *  道具
   * ------------------------------------------------------------------ */
  function updateItems() {
    const p = G.player;
    for (const it of G.items) {
      if (it.taken) continue;
      it.t = (it.t + 0.02) % 1;
      const dx = Math.abs(it.x - p.x);
      const dy = Math.abs((it.y) - (p.y - p.h / 2));
      if (dx < 26 && dy < 40) {
        it.taken = true;
        collectItem(it);
      }
    }
    G.items = G.items.filter((it) => !it.taken);
  }

  function collectItem(it) {
    const p = G.player;
    if (it.type === "coin") { G.coins++; G.score += 20; SFX.coin(); }
    else if (it.type === "bun") { p.hp = Math.min(p.maxHp, p.hp + 30); SFX.heal(); spawnHeal(p.x, p.y - 34, "#ff6a5c"); }
    else if (it.type === "gourd") { p.chi = Math.min(p.maxChi, p.chi + 40); SFX.heal(); spawnHeal(p.x, p.y - 34, "#8fd6ff"); }
    else if (it.type === "scroll") { G.score += 1000; SFX.coin(); }
    spawnBurst(it.x, it.y, 8, it.type === "coin" ? "#f4d67e" : "#fff");
  }

  /* ------------------------------------------------------------------ *
   *  粒子
   * ------------------------------------------------------------------ */
  function spawnHitSpark(x, y, color) {
    for (let i = 0; i < 8; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 2 + Math.random() * 4;
      G.particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        life: 18, max: 18, size: 2 + Math.random() * 3, color: color || "#ffd27a", grav: 0.1 });
    }
  }
  function spawnBurst(x, y, n, color) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 1 + Math.random() * 5;
      G.particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 2,
        life: 30, max: 30, size: 2 + Math.random() * 3, color: color || "#ffcf5a", grav: 0.18 });
    }
  }
  function spawnDust(x, y, n) {
    for (let i = 0; i < n; i++) {
      G.particles.push({ x: x + (Math.random() - 0.5) * 14, y: y - 2,
        vx: (Math.random() - 0.5) * 2, vy: -Math.random() * 1.5,
        life: 20, max: 20, size: 2 + Math.random() * 2, color: "rgba(210,190,150,0.8)", grav: 0.02 });
    }
  }
  function spawnHeal(x, y, color) {
    for (let i = 0; i < 12; i++) {
      G.particles.push({ x: x + (Math.random() - 0.5) * 20, y,
        vx: (Math.random() - 0.5) * 1.2, vy: -1 - Math.random() * 2,
        life: 34, max: 34, size: 2 + Math.random() * 2, color, grav: -0.02 });
    }
  }
  function updateParticles() {
    for (const pt of G.particles) {
      pt.x += pt.vx; pt.y += pt.vy; pt.vy += pt.grav; pt.life--;
    }
    G.particles = G.particles.filter((pt) => pt.life > 0);
  }

  /* ------------------------------------------------------------------ *
   *  过关判定
   * ------------------------------------------------------------------ */
  function checkProgress() {
    const alive = G.enemies.some((e) => !e.dead && e.type !== "boss");
    const bossAlive = G.enemies.some((e) => !e.dead && e.type === "boss");
    if (!G.level.boss) {
      G.gateOpen = !alive;
      if (G.gateOpen && G.player.x >= G.goalX) triggerClear();
    }
    // boss 关由 killEnemy 触发胜利
  }

  /* ------------------------------------------------------------------ *
   *  流程控制
   * ------------------------------------------------------------------ */
  function triggerClear() {
    if (G.mode !== "playing") return;
    G.mode = "clear";
    SFX.clear();
    const bonus = Math.round(G.player.hp * 5);
    G.score += bonus;
    const el = document.getElementById("clear-detail");
    el.innerHTML =
      `<p>第 ${G.levelIndex + 1} 关 · <b>${Sprites.themeName(G.level.theme)}</b> 已破！</p>` +
      `<p>残余气血奖励　<b>+${bonus}</b></p>` +
      `<p>当前得分　<b>${G.score}</b>　｜　铜钱　<b>${G.coins}</b></p>`;
    document.getElementById("clear-title").textContent = "过 关 ！";
    show("clear-screen");
  }

  function triggerWin() {
    if (G.mode === "end") return;
    G.mode = "end";
    G.ending = true;
    SFX.win();
    document.getElementById("end-title").textContent = "真经归位 · 通关！";
    document.getElementById("end-detail").innerHTML =
      `<p>🎉 小嵩连破五关，讨回少林真经，天下太平！</p>` +
      `<p>最终得分　<b>${G.score}</b></p>` +
      `<p>铜钱　<b>${G.coins}</b>　｜　残余气血　<b>${Math.round(G.player.hp)}</b></p>`;
    document.getElementById("btn-retry").textContent = "重新闯关";
    show("end-screen");
  }

  function triggerLose() {
    if (G.mode === "end") return;
    G.mode = "end";
    SFX.lose();
    document.getElementById("end-title").textContent = "败 下 阵 来";
    document.getElementById("end-detail").innerHTML =
      `<p>小嵩力竭倒地……但功夫娘从不言弃！</p>` +
      `<p>抵达　第 <b>${G.levelIndex + 1}</b> 关 · ${Sprites.themeName(G.level.theme)}</p>` +
      `<p>得分　<b>${G.score}</b>　｜　铜钱　<b>${G.coins}</b></p>`;
    document.getElementById("btn-retry").textContent = "再战一局";
    show("end-screen");
  }

  function nextLevel() {
    if (G.levelIndex + 1 >= LEVELS.length) { triggerWin(); return; }
    loadLevel(G.levelIndex + 1);
    G.mode = "playing";
    hideAllOverlays();
  }

  function startGame() {
    initAudio();
    G.score = 0; G.coins = 0; G.combo = 0;
    G.player = makePlayer();
    G.ending = false;
    loadLevel(0);
    G.mode = "playing";
    hideAllOverlays();
    document.getElementById("hud").classList.remove("hidden");
    if (isTouch()) document.getElementById("touch-controls").classList.remove("hidden");
  }

  function togglePause() {
    if (G.mode === "playing") { G.mode = "paused"; show("pause-screen"); }
    else if (G.mode === "paused") { G.mode = "playing"; hideAllOverlays(); }
  }

  /* ------------------------------------------------------------------ *
   *  绘制
   * ------------------------------------------------------------------ */
  function render() {
    ctx.clearRect(0, 0, W, H);
    ctx.save();

    // 屏幕震动
    if (G.shake > 0) {
      ctx.translate((Math.random() - 0.5) * G.shake, (Math.random() - 0.5) * G.shake);
      G.shake *= 0.86;
      if (G.shake < 0.3) G.shake = 0;
    }

    Sprites.drawBackground(ctx, G.level.theme, G.camX, W, H, GROUND_Y);

    ctx.save();
    ctx.translate(-G.camX, 0);

    // 平台
    for (const p of G.platforms) drawPlatform(p);

    // 关门（非 boss 关）
    if (!G.level.boss) {
      ctx.save();
      ctx.translate(G.goalX + 40, 0);
      Sprites.drawGoalGate(ctx, GROUND_Y, G.time);
      if (!G.gateOpen) {
        // 封印光障
        ctx.save();
        ctx.globalAlpha = 0.25 + Math.sin(G.time * Math.PI * 3) * 0.1;
        ctx.fillStyle = "#c8261d";
        ctx.fillRect(-16, GROUND_Y - 150, 32, 150);
        ctx.restore();
      }
      ctx.restore();
    }

    // 道具
    for (const it of G.items) {
      ctx.save(); ctx.translate(it.x, it.y);
      Sprites.drawItem(ctx, it.type, it.t);
      ctx.restore();
    }

    // 敌人
    for (const e of G.enemies) {
      if (e.dead) continue;
      ctx.save(); ctx.translate(e.x, e.y);
      Sprites.drawEnemy(ctx, { type: e.type, facing: e.facing, frame: e.animT, hurtFlash: Math.max(0, e.hurtFlash) });
      ctx.restore();
      drawEnemyHp(e);
    }

    // 抛射物
    for (const pr of G.projectiles) drawProjectile(pr);

    // 玩家
    const p = G.player;
    ctx.save(); ctx.translate(p.x, p.y);
    Sprites.drawHeroine(ctx, {
      state: p.state, frame: p.animT, facing: p.facing,
      hurt: p.hurt > 0, invuln: p.invuln > 0, blinkT: p.blinkT,
    });
    ctx.restore();

    // 粒子
    for (const pt of G.particles) {
      ctx.globalAlpha = Math.max(0, pt.life / pt.max);
      ctx.fillStyle = pt.color;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    ctx.restore(); // camera

    // 连击提示（屏幕空间）
    if (G.combo > 1 && G.comboT > 0) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, G.comboT / 40);
      ctx.fillStyle = "#e8b23a";
      ctx.strokeStyle = "#8f1710";
      ctx.lineWidth = 4;
      ctx.font = "bold 40px sans-serif";
      ctx.textAlign = "center";
      const s = `连击 ${G.combo}`;
      ctx.strokeText(s, W / 2, 120);
      ctx.fillText(s, W / 2, 120);
      ctx.restore();
    }

    ctx.restore(); // shake
  }

  function drawPlatform(p) {
    ctx.fillStyle = "#7a5638";
    rrCtx(p.x - p.w / 2, p.y, p.w, 16, 5);
    ctx.fill();
    ctx.fillStyle = "#5a3f28";
    rrCtx(p.x - p.w / 2, p.y + 10, p.w, 8, 3);
    ctx.fill();
    ctx.fillStyle = "rgba(255,220,150,.25)";
    rrCtx(p.x - p.w / 2, p.y, p.w, 3, 2);
    ctx.fill();
    // 檐口装饰
    ctx.fillStyle = "#c8261d";
    ctx.fillRect(p.x - p.w / 2, p.y + 16, p.w, 3);
  }

  function rrCtx(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function drawEnemyHp(e) {
    if (e.type === "boss") return; // boss 用顶部血条
    if (e.hp >= e.maxHp) return;
    const w = e.w + 6;
    const x = e.x - w / 2;
    const y = e.y - e.h - 10;
    ctx.fillStyle = "rgba(0,0,0,.55)";
    ctx.fillRect(x, y, w, 4);
    ctx.fillStyle = "#ff6a5c";
    ctx.fillRect(x, y, w * Math.max(0, e.hp / e.maxHp), 4);
  }

  function drawProjectile(pr) {
    ctx.save();
    ctx.translate(pr.x, pr.y);
    const isBoss = pr.from === "boss";
    const r = 13 + Math.sin(pr.t * 8) * 2;
    const g = ctx.createRadialGradient(0, 0, 2, 0, 0, r);
    if (isBoss) { g.addColorStop(0, "#fff2b0"); g.addColorStop(.5, "#ff6a2a"); g.addColorStop(1, "rgba(180,20,10,0)"); }
    else { g.addColorStop(0, "#ffffff"); g.addColorStop(.4, "#8fd6ff"); g.addColorStop(1, "rgba(47,143,214,0)"); }
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
    // 拖尾
    ctx.globalAlpha = 0.5;
    ctx.beginPath(); ctx.arc(-pr.facing * 10, 0, r * 0.6, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  /* ------------------------------------------------------------------ *
   *  HUD
   * ------------------------------------------------------------------ */
  const hpFill = document.getElementById("hp-fill");
  const chiFill = document.getElementById("chi-fill");
  function updateHUD() {
    const p = G.player;
    hpFill.style.width = Math.max(0, (p.hp / p.maxHp) * 100) + "%";
    chiFill.style.width = Math.max(0, (p.chi / p.maxChi) * 100) + "%";
    document.getElementById("stage-num").textContent = G.levelIndex + 1;
    document.getElementById("coins").textContent = G.coins;
    document.getElementById("score").textContent = G.score;
    // boss 血条画在 canvas
  }

  function drawBossBar() {
    const boss = G.enemies.find((e) => e.type === "boss" && !e.dead);
    if (!boss) return;
    const bw = W * 0.6, bx = (W - bw) / 2, by = 70;
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,.5)";
    ctx.fillRect(bx - 3, by - 3, bw + 6, 20);
    ctx.fillStyle = "#3a0d0a";
    ctx.fillRect(bx, by, bw, 14);
    ctx.fillStyle = "#c8261d";
    ctx.fillRect(bx, by, bw * Math.max(0, boss.hp / boss.maxHp), 14);
    ctx.fillStyle = "#f4d67e";
    ctx.font = "bold 16px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("黑风魔头", W / 2, by - 8);
    ctx.restore();
  }

  /* ------------------------------------------------------------------ *
   *  主循环（固定步长）
   * ------------------------------------------------------------------ */
  let last = performance.now();
  let acc = 0;
  const STEP = 1000 / 60;

  function loop(now) {
    requestAnimationFrame(loop);
    let dt = now - last; last = now;
    if (dt > 100) dt = 100;
    acc += dt;
    let steps = 0;
    while (acc >= STEP && steps < 5) {
      if (G.mode === "playing") update();
      acc -= STEP; steps++;
    }
    if (G.level && G.player) {
      render();
      if (G.level.boss) drawBossBar();
    }
    if (G.mode === "playing") updateHUD();
  }

  function update() {
    G.time += 1 / 60;
    if (G.bannerT > 0) {
      G.bannerT -= 1 / 60;
      if (G.bannerT <= 0) hideBanner();
    }
    if (G.comboT > 0) { G.comboT--; if (G.comboT === 0) G.combo = 0; }

    updatePlayer(G.player);
    for (const e of G.enemies) updateEnemy(e);
    updateProjectiles();
    updateItems();
    updateParticles();

    // 相机
    const target = Math.max(0, Math.min(G.player.x - W * 0.4, G.level.length - W));
    G.camX += (target - G.camX) * 0.12;

    checkProgress();
  }

  /* ------------------------------------------------------------------ *
   *  界面辅助
   * ------------------------------------------------------------------ */
  const OVERLAYS = ["title-screen", "help-screen", "clear-screen", "end-screen", "pause-screen"];
  function hideAllOverlays() { OVERLAYS.forEach((id) => document.getElementById(id).classList.add("hidden")); }
  function show(id) { hideAllOverlays(); document.getElementById(id).classList.remove("hidden"); }

  function showBanner(text) {
    const b = document.getElementById("stage-banner");
    document.getElementById("stage-banner-text").textContent = text;
    b.classList.remove("hidden");
  }
  function hideBanner() { document.getElementById("stage-banner").classList.add("hidden"); }

  function isTouch() {
    return ("ontouchstart" in window) || navigator.maxTouchPoints > 0;
  }

  /* ------------------------------------------------------------------ *
   *  按钮绑定
   * ------------------------------------------------------------------ */
  document.getElementById("btn-start").addEventListener("click", startGame);
  document.getElementById("btn-help").addEventListener("click", () => show("help-screen"));
  document.getElementById("btn-help-back").addEventListener("click", () => show("title-screen"));
  document.getElementById("btn-next").addEventListener("click", nextLevel);
  document.getElementById("btn-resume").addEventListener("click", togglePause);
  document.getElementById("btn-quit").addEventListener("click", () => {
    G.mode = "title";
    document.getElementById("hud").classList.add("hidden");
    document.getElementById("touch-controls").classList.add("hidden");
    hideBanner();
    show("title-screen");
  });
  document.getElementById("btn-retry").addEventListener("click", startGame);

  bindTouch();

  // 首次任意键/触摸解锁音频
  addEventListener("keydown", initAudio, { once: true });
  addEventListener("touchstart", initAudio, { once: true });
  addEventListener("mousedown", initAudio, { once: true });

  // 调试钩子（供自动化冒烟测试读取内部状态）
  window.__mode = () => G.mode;
  if (location.search.indexOf("debug") >= 0 || location.hash.indexOf("debug") >= 0) {
    window.__test = {
      killAll: () => G.enemies.forEach((e) => { if (!e.dead) killEnemy(e); }),
      tpGate: () => { if (G.player) G.player.x = G.goalX; },
      tp: (x) => { if (G.player) G.player.x = x; },
      gotoLevel: (i) => { loadLevel(i); G.mode = "playing"; hideAllOverlays(); },
    };
  }
  window.__debug = () => ({
    mode: G.mode, level: G.levelIndex,
    hp: Math.round(G.player ? G.player.hp : -1),
    chi: Math.round(G.player ? G.player.chi : -1),
    px: Math.round(G.player ? G.player.x : -1),
    enemiesAlive: G.enemies.filter((e) => !e.dead).length,
    score: G.score, coins: G.coins,
    particles: G.particles.length,
  });

  // 启动渲染循环（标题界面时也需绘制 canvas 以免黑屏——加载首关背景占位）
  G.level = LEVELS[0];
  requestAnimationFrame(loop);
})();
