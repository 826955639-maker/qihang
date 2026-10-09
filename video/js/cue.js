// 估算"某个词在这句话里大约第几秒被读到"。
// 配音模型不告诉我每个字的时间，所以按字数加权估算：汉字算 1，标点算停顿，字母算半个。
// 画面（浏览器）和混音（Node）共用这一份，保证动作和音效对得上。
(function (root) {
  function weight(ch) {
    if (/[，。？！：；、—…“”]/.test(ch)) return 1.4;
    if (/[A-Za-z0-9.]/.test(ch)) return 0.55;
    if (/\s/.test(ch)) return 0.2;
    return 1;
  }
  // when: 数字 = 该句开始后的秒数；"@0.3" = 该句时长的 30% 处；其他字符串 = 这个词被读到的时刻
  function cueTime(text, dur, when) {
    if (typeof when === 'number') return when;
    if (when[0] === '@') return dur * parseFloat(when.slice(1));
    const idx = text.indexOf(when);
    if (idx < 0) throw new Error('台词里找不到 “' + when + '”：' + text);
    let before = 0, total = 0;
    for (let i = 0; i < text.length; i++) {
      const w = weight(text[i]);
      if (i < idx) before += w;
      total += w;
    }
    return dur * before / total;
  }
  root.cueTime = cueTime;
})(typeof window !== 'undefined' ? window : globalThis);
