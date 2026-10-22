export function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function hash(s) {
  s = String(s);
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
export const rand = (seed) => mulberry32(typeof seed === 'number' ? seed : hash(seed));
// smooth 1D value noise in [-1,1]
export function noise1(seed, x) {
  const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f);
  const a = rand(hash(seed) + i * 374761393)() * 2 - 1;
  const b = rand(hash(seed) + (i + 1) * 374761393)() * 2 - 1;
  return a + (b - a) * u;
}
