// 背景音乐的"乐谱"：一串音符事件 {t 开始秒, m 音高(MIDI), d 时长, i 乐器, v 力度}。
// Node 里的 tools/mix.mjs 用它合成声音；浏览器用它在钢琴上点亮正在响的琴键。
(function (root) {
  const BPM = 96, BEAT = 60 / BPM, BAR = BEAT * 4;
  // C - Am - F - G（流行歌里最常见的"万能和弦"）
  const CHORDS = [
    { name: 'C', bass: 36, uke: [67, 60, 64, 72] },
    { name: 'Am', bass: 45, uke: [69, 60, 64, 69] },
    { name: 'F', bass: 41, uke: [69, 60, 65, 69] },
    { name: 'G', bass: 43, uke: [67, 62, 67, 71] }
  ];
  // 8 小节旋律：[拍, 音高, 拍数]
  const MELODY = [
    [[0, 76, 1], [1, 79, 1], [2, 84, 1.5], [3.5, 83, 0.5]],
    [[0, 81, 1], [1, 79, 1], [2, 76, 2]],
    [[0, 77, 1], [1, 81, 1], [2, 84, 1], [3, 81, 1]],
    [[0, 79, 2], [2, 74, 1], [3, 76, 1]],
    [[0, 72, 1], [1, 76, 1], [2, 79, 1], [3, 84, 1]],
    [[0, 83, 1], [1, 81, 1], [2, 76, 1.5], [3.5, 79, 0.5]],
    [[0, 77, 0.5], [0.5, 76, 0.5], [1, 77, 1], [2, 81, 1], [3, 79, 1]],
    [[0, 79, 1], [1, 74, 1], [2, 71, 1], [3, 74, 1]]
  ];
  // 扫弦节奏：[拍, 下扫(1)/上扫(-1), 力度]
  const STRUM = [[0, 1, 0.9], [1, 1, 0.7], [1.5, -1, 0.5], [2.5, -1, 0.5], [3, 1, 0.75], [3.5, -1, 0.5]];

  function buildScore(T) {
    const ev = [];
    const sc = (id) => T.scenes.find((s) => s.id === id);
    const hook = sc('hook');
    const g0 = hook.start + hook.lines[4].t; // 标题出现时，乐队进场
    const music = sc('music');
    const showOff = [music.start + music.lines[2].t, music.start + music.dur];

    // 开头：神秘的长音 + 零星铃声
    for (let t = 0; t < g0 - 0.2; t += BAR) {
      const ch = Math.floor(t / BAR) % 2 ? [53, 57, 60, 64] : [57, 60, 64, 67];
      ch.forEach((m) => ev.push({ t, m, d: BAR + 0.4, i: 'pad', v: 0.5 }));
      [[0.5, 88], [1.5, 84], [2.5, 81], [3.25, 76]].forEach(([b, m], k) => {
        if ((k + Math.floor(t / BAR)) % 2 === 0) ev.push({ t: t + b * BEAT, m, d: 1.2, i: 'bell', v: 0.35 });
      });
    }
    // 乐队部分
    const end = T.total - 1.0;
    let bar = 0, t = g0;
    for (; t + BAR <= end; t += BAR, bar++) {
      const ch = CHORDS[bar % 4];
      const intro = bar < 2;
      STRUM.forEach(([b, dir, v]) => {
        if (intro && b > 0) return;
        const notes = dir > 0 ? ch.uke : ch.uke.slice().reverse();
        notes.forEach((m, k) => ev.push({ t: t + b * BEAT + k * 0.014, m, d: 1.4, i: 'pluck', v: v * (intro ? 1 : 0.85) }));
      });
      ev.push({ t, m: ch.bass, d: BEAT * 1.8, i: 'bass', v: 0.9 });
      ev.push({ t: t + 2 * BEAT, m: ch.bass + 7, d: BEAT * 1.3, i: 'bass', v: 0.7 });
      if (!intro) for (let k = 0; k < 8; k++) ev.push({ t: t + k * BEAT * 0.5, m: 0, d: 0.06, i: 'shaker', v: k % 2 ? 0.8 : 0.4 });
      const loud = t >= showOff[0] - 0.1 && t < showOff[1];
      MELODY[bar % 8].forEach(([b, m, d]) => ev.push({ t: t + b * BEAT, m, d: d * BEAT, i: 'mel', v: loud ? 1 : 0.42 }));
    }
    // 结尾：落在 C 和弦上
    CHORDS[0].uke.forEach((m, k) => ev.push({ t: t + k * 0.03, m, d: 3, i: 'pluck', v: 0.9 }));
    ev.push({ t, m: 36, d: 3, i: 'bass', v: 0.9 });
    ev.push({ t, m: 84, d: 3, i: 'bell', v: 0.6 });
    ev.sort((a, b) => a.t - b.t);
    return { events: ev, g0, bar: BAR, beat: BEAT, chords: CHORDS, end: t + 3.5, showOff };
  }
  root.MUSIC = { buildScore, BPM };
})(typeof window !== 'undefined' ? window : globalThis);
