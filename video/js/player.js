// 播放器：以音轨为时钟，每一帧算出"现在第几秒"，再交给对应的分镜去画。
(function () {
  const SCN = SCRIPT.scenes, TM = TIMING.scenes, TOTAL = TIMING.total;
  window.SCORE = MUSIC.buildScore(TIMING);

  window.makeS = (id, rel) => {
    const i = TM.findIndex((s) => s.id === id), tm = TM[i], sc = SCN[i];
    const L = tm.lines.map((l) => l.t), D = tm.lines.map((l) => l.d);
    return {
      id, L, D, dur: tm.dur, abs: tm.start + rel,
      at: (li, when = 0) => L[li] + cueTime(sc.lines[li].text, D[li], when),
      talking: tm.lines.some((l) => rel >= l.t && rel <= l.t + l.d)
    };
  };
  const sceneAt = (T) => { let i = TM.length - 1; while (i > 0 && T < TM[i].start) i--; return i; };

  const state = { xray: false, subs: true, hoverBtn: false };
  const BTN = { x: 1712, y: 982, w: 176, h: 72 };

  function forcedXray(T) {
    const i = TM.findIndex((s) => s.id === 'surprise'), tm = TM[i];
    if (T < tm.start) return false;
    const S = makeS('surprise', T - tm.start);
    return T - tm.start > S.at(1, '透视') - 0.2 && T - tm.start < S.at(2) - 0.2;
  }

  function subtitle(ctx, i, rel) {
    const tm = TM[i];
    const k = tm.lines.findIndex((l) => rel >= l.t - 0.1 && rel <= l.t + l.d + 0.3);
    if (k < 0) return;
    let text = SCN[i].lines[k].text;
    const size = 44, maxW = 1380;
    let rows = [text];
    if (K.measure(ctx, text, size) > maxW) {
      const mid = text.length / 2;
      let best = -1;
      for (let j = 1; j < text.length - 1; j++) if (/[，。？！：；、]/.test(text[j]) && (best < 0 || Math.abs(j - mid) < Math.abs(best - mid))) best = j;
      if (best < 0) best = Math.floor(mid);
      rows = [text.slice(0, best + 1), text.slice(best + 1)];
    }
    const w = Math.max(...rows.map((r) => K.measure(ctx, r, size))) + 70, h = rows.length * 58 + 26;
    const y0 = 1050 - h;
    const xr = K.xray; K.xray = false;
    K.rect(ctx, 960 - w / 2, y0, w, h, { radius: 22, fill: 'rgba(255,255,255,0.93)', width: 3.5, stroke: '#3d3946', seed: 9000 + k, still: true });
    rows.forEach((r, j) => K.text(ctx, r, 960, y0 + 42 + j * 58, { size, jitter: 0.4, still: true, seed: 9100 + j }));
    K.xray = xr;
  }

  function xrayButton(ctx, T, on, pulse) {
    const { x, y, w, h } = BTN, xr = K.xray;
    K.xray = false;
    if (pulse) {
      const a = 0.5 + 0.5 * Math.sin(T * 9);
      K.rect(ctx, x - 12, y - 12, w + 24, h + 24, { radius: 30, stroke: K.C.red, width: 6, alpha: a, still: true, seed: 9201 });
    }
    K.rect(ctx, x, y, w, h, { radius: 24, fill: on ? K.C.xray : state.hoverBtn ? '#fff7d6' : '#fff', width: 4, still: true, seed: 9200 });
    K.circle(ctx, x + 38, y + 36, 15, { width: 4, still: true, seed: 9202, fill: on ? '#dffcff' : null });
    K.circle(ctx, x + 74, y + 36, 15, { width: 4, still: true, seed: 9203, fill: on ? '#dffcff' : null });
    K.line(ctx, x + 53, y + 34, x + 59, y + 34, { width: 4, still: true, seed: 9204, double: false });
    K.text(ctx, '透视', x + 132, y + 37, { size: 38, still: true, jitter: 0.3, color: on ? '#063a40' : K.C.ink });
    K.xray = xr;
  }

  // 画出第 T 秒的整帧画面
  function drawFrame(ctx, T, opt = {}) {
    T = K.clamp(T, 0, TOTAL - 0.001);
    K.beginFrame(opt.boilT != null ? opt.boilT : T);
    const i = sceneAt(T), tm = TM[i], rel = T - tm.start;
    const forced = forcedXray(T);
    K.xray = state.xray || forced;
    K.paper(ctx);
    const TR = 0.75;
    if (i > 0 && rel < TR) {
      const prev = TM[i - 1];
      SCENES[prev.id](ctx, prev.dur - 0.01, makeS(prev.id, prev.dur - 0.01));
      const u = K.ease.inOut(rel / TR), r = 30 + u * 1150;
      ctx.save(); ctx.beginPath(); ctx.arc(960, 540, r, 0, Math.PI * 2); ctx.clip();
      K.paper(ctx);
      SCENES[tm.id](ctx, rel, makeS(tm.id, rel));
      ctx.restore();
      K.circle(ctx, 960, 540, r, { width: 10, stroke: K.C.orange, seed: 9300, noXray: true });
    } else {
      SCENES[tm.id](ctx, rel, makeS(tm.id, rel));
    }
    if (state.subs && !opt.noSubs) subtitle(ctx, i, rel);
    if (!opt.noButton) xrayButton(ctx, T, K.xray, forced);
  }
  window.drawFrame = drawFrame;

  // ---------- 页面 ----------
  const cv = document.getElementById('cv'), ctx = cv.getContext('2d');
  const au = document.getElementById('au');
  const $ = (id) => document.getElementById(id);
  const params = new URLSearchParams(location.search);
  const renderMode = params.has('render');
  let scale = 1;

  function resize() {
    const r = cv.getBoundingClientRect();
    const px = renderMode ? +(params.get('w') || 1920) : Math.min(1920, Math.round(r.width * (window.devicePixelRatio || 1)));
    if (cv.width !== px) { cv.width = px; cv.height = Math.round(px * 9 / 16); }
    scale = cv.width / 1920;
  }
  const paint = (fn) => { ctx.setTransform(scale, 0, 0, scale, 0, 0); fn(); };

  const fontReady = Promise.race([
    document.fonts.load('48px KuaiLe', '小克视频').catch(() => {}),
    new Promise((r) => setTimeout(r, 4000))
  ]);

  if (renderMode) {
    document.body.classList.add('render');
    window.renderReady = fontReady.then(() => { resize(); return TOTAL; });
    window.renderFrame = (T) => { paint(() => drawFrame(ctx, T)); };
    return;
  }

  // 时钟：优先跟着音轨走；没有声音时用系统时钟
  let mode = 'poster', clock0 = 0, perf0 = 0, playing = false, audioOK = true, cert = null;
  au.addEventListener('error', () => { audioOK = false; });
  const now = () => {
    if (!playing) return clock0;
    if (audioOK && !au.paused && au.readyState >= 2) return au.currentTime;
    return clock0 + (performance.now() - perf0) / 1000;
  };
  function play() {
    if (mode === 'end' || mode === 'cert') { seek(0); }
    mode = 'video'; playing = true;
    perf0 = performance.now();
    $('start').classList.add('hidden'); $('end').classList.add('hidden');
    if (audioOK) { au.currentTime = clock0; au.play().catch(() => { audioOK = false; }); }
    $('play').textContent = '❚❚';
  }
  function pause() {
    clock0 = now(); playing = false; au.pause();
    $('play').textContent = '▶';
  }
  function seek(T) {
    clock0 = K.clamp(T, 0, TOTAL - 0.05); perf0 = performance.now();
    if (audioOK) try { au.currentTime = clock0; } catch (e) {}
    if (mode !== 'video') { mode = 'video'; $('start').classList.add('hidden'); $('end').classList.add('hidden'); }
  }
  const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  const posterT = TM[0].start + TM[0].lines[4].t + 4.2;

  function frame() {
    resize();
    let T = now();
    if (mode === 'video' && playing && T >= TOTAL - 0.05) { pause(); clock0 = TOTAL - 0.05; mode = 'end'; $('end').classList.remove('hidden'); $('name').focus(); }
    if (mode === 'cert') {
      const dt = (performance.now() - cert.t0) / 1000;
      paint(() => {
        K.beginFrame(dt); K.xray = state.xray; K.paper(ctx);
        K.at(ctx, 960, 500, K.ease.back(K.clamp(dt / 0.7)) * 0.98, 0, () => K.certificate(ctx, cert.name, dt));
        K.confetti(ctx, dt - 0.3);
      });
    } else {
      const poster = mode === 'poster';
      paint(() => drawFrame(ctx, poster ? posterT : T, poster ? { noSubs: true, boilT: performance.now() / 1000 } : {}));
    }
    $('time').textContent = `${fmt(Math.min(T, TOTAL))} / ${fmt(TOTAL)}`;
    if (!dragging) $('seek').value = (Math.min(T, TOTAL) / TOTAL) * 1000;
    requestAnimationFrame(frame);
  }

  let dragging = false;
  $('seek').addEventListener('input', (e) => { dragging = true; seek((e.target.value / 1000) * TOTAL); });
  $('seek').addEventListener('change', () => { dragging = false; });
  $('play').onclick = () => (playing ? pause() : play());
  $('bigplay').onclick = play;
  $('subs').onclick = () => { state.subs = !state.subs; $('subs').classList.toggle('on', state.subs); };
  $('xray').onclick = () => toggleXray();
  $('fs').onclick = () => { const st = $('wrap'); document.fullscreenElement ? document.exitFullscreen() : (st.requestFullscreen || st.webkitRequestFullscreen || (() => {})).call(st); };
  function toggleXray() { state.xray = !state.xray; $('xray').classList.toggle('on', state.xray); }

  const toLogical = (e) => { const r = cv.getBoundingClientRect(); return [((e.clientX - r.left) / r.width) * 1920, ((e.clientY - r.top) / r.height) * 1080]; };
  const onBtn = ([x, y]) => x > BTN.x && x < BTN.x + BTN.w && y > BTN.y && y < BTN.y + BTN.h;
  cv.addEventListener('mousemove', (e) => { state.hoverBtn = onBtn(toLogical(e)); cv.style.cursor = state.hoverBtn ? 'pointer' : 'default'; });
  cv.addEventListener('click', (e) => {
    if (onBtn(toLogical(e)) && mode !== 'cert') return toggleXray();
    if (mode === 'video') playing ? pause() : play();
  });
  document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' && e.target.type === 'text') { if (e.key === 'Enter') $('getcert').click(); return; }
    if (e.key === ' ') { e.preventDefault(); mode === 'poster' ? play() : playing ? pause() : play(); }
    else if (e.key === 'ArrowRight') seek(now() + 5);
    else if (e.key === 'ArrowLeft') seek(now() - 5);
    else if (e.key === 'x' || e.key === 'X') toggleXray();
    else if (e.key === 'c' || e.key === 'C') $('subs').click();
    else if (e.key === 'f' || e.key === 'F') $('fs').click();
  });

  $('getcert').onclick = () => {
    const name = $('name').value.trim() || '认真看完的你';
    cert = { name, t0: performance.now() };
    mode = 'cert';
    $('end').classList.add('hidden'); $('certbar').classList.remove('hidden');
  };
  $('save').onclick = () => {
    const c = document.createElement('canvas'); c.width = 1920; c.height = 1080;
    const g = c.getContext('2d');
    K.beginFrame(0); const xr = K.xray; K.xray = false;
    K.paper(g); K.at(g, 960, 540, 1.1, 0, () => K.certificate(g, cert.name, 0));
    K.xray = xr;
    const url = c.toDataURL('image/png');
    // 有些环境不允许网页直接下载，所以同时把图片摆出来，右键/长按就能存
    $('certpng').src = url; $('certimg').classList.remove('hidden');
    try { const a = document.createElement('a'); a.download = `小克毕业证书-${cert.name}.png`; a.href = url; a.click(); } catch (e) {}
  };
  $('closeimg').onclick = () => $('certimg').classList.add('hidden');
  $('replay').onclick = () => { seek(0); play(); };
  $('again').onclick = () => { $('certbar').classList.add('hidden'); seek(0); play(); };

  fontReady.then(() => {
    $('loading').classList.add('hidden');
    requestAnimationFrame(frame);
  });
})();
