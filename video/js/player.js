// 播放器：以音轨时间为准驱动画面和字幕；?render 模式下逐帧导出视频用
(function () {
  const { C, W, H, prog, pop } = D;
  const TL = window.TIMELINE;
  const STEPS = TL.scenes.filter(s => s.step);

  function sceneAt(T) {
    let i = TL.scenes.findIndex(s => T >= s.start && T < s.end);
    if (i < 0) i = T < 0 ? 0 : TL.scenes.length - 1;
    return i;
  }
  function info(sc) {
    return { d: sc.end - sc.start, L: sc.lines.map(l => l.start - sc.start), E: sc.lines.map(l => l.end - sc.start) };
  }

  // 顶部 12 步进度条
  function stepTrack(sc, t) {
    const cur = sc.step || 0;
    const show = cur ? 1 : (sc.id === 'gnd' ? 0.5 : 0);
    if (!show) return;
    D.alpha(show, () => {
      const x0 = 330, x1 = 1230, y = 40;
      D.rect(x0 - 24, y - 24, x1 - x0 + 48, 48, { fill: 'rgba(255,253,245,0.9)', r: 24, lw: 2.5 });
      STEPS.forEach((s, i) => {
        const x = x0 + (x1 - x0) * i / (STEPS.length - 1);
        const done = s.step < cur, on = s.step === cur;
        const r = on ? 17 + 2 * Math.sin(t * 5) : 12;
        D.circle(x, y, r, { fill: done || on ? C.mode[s.mode] : '#e0e0e0', lw: on ? 3.5 : 2 });
        D.text(String(s.step), x, y + 1, { size: on ? 20 : 15, color: done || on ? '#fff' : '#9e9e9e' });
      });
    });
    if (cur) {
      const s = pop(t, 0.05, 0.5);
      D.scaled(150, 46, s, () => {
        const col = C.mode[sc.mode];
        D.rect(24, 14, 262, 64, { fill: col, r: 18, lw: 3.5 });
        D.circle(62, 46, 24, { fill: '#fff', lw: 3 });
        D.text(String(sc.step), 62, 48, { size: 28, color: col });
        D.text(sc.name, 158, 47, { size: 30, color: '#fff' });
        D.rect(216, 82, 70, 30, { fill: '#fffdf5', r: 10, lw: 2.5 });
        D.text(D.MODE_NAME[sc.mode], 251, 98, { size: 20, color: col });
      });
    }
  }

  function subtitle(T) {
    let cur = null;
    for (const sc of TL.scenes) for (const l of sc.lines) if (T >= l.start - 0.05 && T <= l.end + 0.25) cur = l;
    if (!cur) return;
    const size = 38, w = D.measure(cur.text, size) + 60;
    const a = Math.min(prog(T, cur.start - 0.05, cur.start + 0.12), 1 - prog(T, cur.end + 0.1, cur.end + 0.25));
    D.alpha(a, () => {
      const c = D.ctx; c.fillStyle = 'rgba(30,30,45,0.72)';
      c.beginPath(); c.roundRect(W / 2 - w / 2, H - 82, w, 60, 30); c.fill();
      D.text(cur.text, W / 2, H - 51, { size, color: '#fff' });
    });
  }

  function render(ctx, T, opts = {}) {
    D.begin(ctx, T);
    const i = sceneAt(T), sc = TL.scenes[i], t = T - sc.start;
    ctx.save();
    SCENES[sc.id](t, info(sc));
    ctx.restore();
    stepTrack(sc, t);
    // 转场：纸张从左向右擦过
    if (i > 0 && t < 0.45) {
      const k = D.ease(prog(t, 0, 0.45));
      ctx.save(); ctx.fillStyle = C.paper;
      ctx.beginPath(); ctx.moveTo(W * k * 1.3, 0); ctx.lineTo(W + 200, 0); ctx.lineTo(W + 200, H); ctx.lineTo(W * k * 1.3 - 160, H); ctx.closePath(); ctx.fill();
      ctx.restore();
    }
    if (opts.subtitles !== false) subtitle(T);
  }

  function setupCanvas(canvas, scale) {
    canvas.width = W * scale; canvas.height = H * scale;
    const ctx = canvas.getContext('2d'); ctx.setTransform(scale, 0, 0, scale, 0, 0);
    return ctx;
  }

  const params = new URLSearchParams(location.search);
  const canvas = document.getElementById('stage');

  if (params.has('render')) {
    // 导出模式：外部脚本调用 renderFrame(t)
    const ctx = setupCanvas(canvas, 1);
    document.getElementById('overlay').style.display = 'none';
    window.renderFrame = T => { ctx.setTransform(1, 0, 0, 1, 0, 0); render(ctx, T); return true; };
    window.DURATION = TL.duration;
    document.fonts.load('32px KuaiLe').then(() => { window.READY = true; });
    return;
  }

  const ctx = setupCanvas(canvas, Math.min(2, window.devicePixelRatio || 1));
  const audio = document.getElementById('audio');
  const btn = document.getElementById('play'), seek = document.getElementById('seek'), time = document.getElementById('time');
  const subBtn = document.getElementById('subs'), overlay = document.getElementById('overlay');
  let subs = true, scrubbing = false;
  seek.max = TL.duration;
  const fmt = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

  function frame() {
    const T = audio.currentTime;
    const scale = canvas.width / W; ctx.setTransform(scale, 0, 0, scale, 0, 0);
    render(ctx, T, { subtitles: subs });
    if (!scrubbing) seek.value = T;
    time.textContent = `${fmt(T)} / ${fmt(TL.duration)}`;
    requestAnimationFrame(frame);
  }
  function toggle() {
    if (audio.paused) { audio.play(); overlay.classList.add('hide'); } else audio.pause();
  }
  audio.addEventListener('play', () => btn.textContent = '❚❚');
  audio.addEventListener('pause', () => btn.textContent = '▶');
  audio.addEventListener('ended', () => { overlay.classList.remove('hide'); });
  btn.onclick = toggle; overlay.onclick = toggle; canvas.onclick = toggle;
  seek.oninput = () => { scrubbing = true; audio.currentTime = +seek.value; };
  seek.onchange = () => { scrubbing = false; };
  subBtn.onclick = () => { subs = !subs; subBtn.classList.toggle('off', !subs); };
  document.addEventListener('keydown', e => {
    if (e.code === 'Space') { e.preventDefault(); toggle(); }
    if (e.code === 'ArrowRight') audio.currentTime = Math.min(TL.duration, audio.currentTime + 5);
    if (e.code === 'ArrowLeft') audio.currentTime = Math.max(0, audio.currentTime - 5);
  });
  document.fonts.load('32px KuaiLe').finally(() => requestAnimationFrame(frame));
})();
