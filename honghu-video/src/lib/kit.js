// 场景常用动作：落下(DropIn)、盖章(StampText)、翻走(PeelOut)
import { place } from './paper.js';
import { dropIn, stampIn, peelOut } from './anim.js';

export function drop(x, f, spr, px, py, start, o = {}) {
  const d = dropIn(f, start, o.drop);
  if (!d) return false;
  let dx = 0, dy = 0, rot = 0, alpha = 1, lift = d.lift;
  if (o.out != null && f >= o.out) {
    const p = peelOut(f, o.out);
    if (p.gone) return false;
    dx = p.dx; dy = p.dy; rot = p.rot; alpha = p.alpha; lift = p.lift;
  }
  place(x, spr, px + dx, py + d.dy + dy, {
    ...o, rot: (o.rot || 0) + d.rot + rot, s: (o.s ?? 1) * d.s, lift, alpha: (o.alpha ?? 1) * d.alpha * alpha, jit: o.id || null, f,
  });
  return true;
}

export function stamp(x, f, spr, px, py, start, o = {}) {
  const st = stampIn(f, start);
  if (!st) return false;
  place(x, spr, px, py, { ...o, s: (o.s ?? 1) * st.s, alpha: st.alpha * (o.alpha ?? 1), lift: st.lift, jit: o.id || null, f, shadow: o.shadow ?? 0.5 });
  return true;
}

// cue helpers: sound lands when the paper touches down
export const paperCue = (f, gain = 0.3) => ({ f: f + 7, sfx: 'paper', gain });
export const stampCue = (f, gain = 0.55) => ({ f: f + 5, sfx: 'stamp', gain });
