// S7 尾·回答（5100–5400）：手账全景上，小鸿鹄落在青年肩头；问句重现并盖章回答；切到牛皮纸片尾
import { C, F, W, H } from '../theme.js';
import { piece, place, paperBG, textStrip, stampSprite, tape } from '../lib/paper.js';
import { drop, stamp, paperCue, stampCue } from '../lib/kit.js';
import { two, clamp, lerp, easeInOut, easeOut, spring } from '../lib/anim.js';
import { person, silhouetteSprite, roundRect } from '../lib/draw.js';
import { hero } from '../lib/hero.js';
import { narr } from '../timeline.js';
import { spread } from './s6.js';

const n16 = narr('n16');
const Q_AT = n16.chunks[0].a, A_AT = n16.chunks[1].a;
const CUT = Math.max(5250, n16.chunks[1].b + 8);

// 青年背影：背着书包望向晨光（剪影，脚底在 YOUTH）
const youth = () => silhouetteSprite('s7youth', 330, 660, (x) => {
  const cx = 165;
  x.fillStyle = C.ink; x.lineCap = 'round';
  // legs
  x.beginPath(); roundRect(x, cx - 62, 400, 56, 250, 24); x.fill();
  x.beginPath(); roundRect(x, cx + 6, 400, 56, 250, 24); x.fill();
  x.beginPath(); x.ellipse(cx - 40, 648, 40, 14, 0, 0, 7); x.ellipse(cx + 40, 648, 40, 14, 0, 0, 7); x.fill();
  // torso + shoulders
  x.beginPath(); x.moveTo(cx - 100, 190); x.quadraticCurveTo(cx, 160, cx + 100, 190); x.lineTo(cx + 84, 430); x.lineTo(cx - 84, 430); x.closePath(); x.fill();
  // arms
  x.beginPath(); roundRect(x, cx - 132, 196, 42, 230, 20); x.fill();
  x.beginPath(); roundRect(x, cx + 90, 196, 42, 230, 20); x.fill();
  // neck + head + hair
  x.beginPath(); roundRect(x, cx - 22, 120, 44, 70, 14); x.fill();
  x.beginPath(); x.ellipse(cx, 92, 50, 58, 0, 0, 7); x.fill();
  x.beginPath(); x.ellipse(cx, 66, 56, 40, 0, Math.PI, 0); x.fill();
  // backpack (paper red) with straps
  x.fillStyle = C.red; x.beginPath(); roundRect(x, cx - 72, 210, 144, 170, 26); x.fill();
  x.fillStyle = '#8E2321'; x.beginPath(); roundRect(x, cx - 52, 300, 104, 56, 14); x.fill();
  x.fillStyle = C.gold; x.beginPath(); x.arc(cx, 254, 14, 0, 7); x.fill();
});
const YOUTH = { x: 1520, y: 1440 };
const YS = 1.8;
const SHOULDER = { x: YOUTH.x - 190, y: YOUTH.y - (660 - 190) * YS };

const qaCard = () => piece({
  key: 's7qa', w: 1000, h: 330, color: '#FBF8F1', seed: 's7qa',
  draw: (x, w) => {
    x.font = '72px SerifB'; x.fillStyle = C.ink; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText('鸿鹄一飞，能飞多远？', w / 2, 100);
  },
});

export function draw(x, f) {
  if (f < CUT) {
    spread(x, f, 5099);
    drop(x, f, youth(), YOUTH.x, YOUTH.y, 5094, { ax: 0.5, ay: 1, s: YS, id: 's7y', jamp: 0.15 });
    drop(x, f, qaCard(), 690, 470, Q_AT - 2, { rot: -1.5, id: 's7q', jamp: 0.2, overlay: (cx, w) => {
      stamp(cx, f, stampSprite('跟着信仰，就能走得很远。', 60, { seed: 's7a', padX: 0.35 }), w / 2, 230, A_AT, { rot: -2.5, id: 's7a', shadow: 0 });
    } });
    if (f >= Q_AT + 10) place(x, tape(140, 38, 's7qt'), 230, 320, { rot: -30, shadow: 0.2, jit: 's7qt', f });
    // 小鸿鹄 drops onto the shoulder (DropIn with a short fall from above)
    const t = two(f) - 5104;
    if (t >= 0) {
      const s = spring(t * 0.8, 0.55, 0.55);
      hero(x, f, SHOULDER.x, lerp(SHOULDER.y - 260, SHOULDER.y, s) + 24, { pose: 'happy', h: 340, id: 's7hero', lift: 1 + 2 * (1 - Math.min(1, s)) });
    }
    return;
  }
  // 片尾：纯牛皮纸 + 三条纸条
  place(x, paperBG(C.kraft, 's7end'), 0, 0, { ax: 0, ay: 0, shadow: 0 });
  drop(x, f, textStrip('弘扬长征精神 · 走好新时代的长征路', { font: 'SerifB', px: 56, bg: C.paper, padX: 0.55 }), W / 2, 300, CUT + 2, { rot: -1, id: 'e1' });
  drop(x, f, textStrip('鸿鹄远征', { font: 'SerifH', px: 120, color: C.red, bg: '#FBF8F1', padX: 0.45, padY: 0.25 }), W / 2, 500, CUT + 14, { rot: 1.2, id: 'e2', drop: { dist: 80, rot: -6 } });
  drop(x, f, textStrip('合肥工业大学', { font: 'SerifB', px: 40, color: C.indigo, bg: C.paper, padX: 0.7 }), W / 2, 668, CUT + 28, { rot: -0.8, id: 'e3' });
  drop(x, f, textStrip('作者：温可掬 · 工业设计24-1班', { font: 'SerifR', px: 26, color: 'rgba(31,27,24,0.8)', bg: C.newsprint, padX: 0.6, edge: 'cut' }), W / 2, 745, CUT + 36, { rot: 0.6, id: 'e4' });
  if (f >= CUT + 20) place(x, tape(140, 38, 'e2t'), W / 2 - 300, 430, { rot: -32, shadow: 0.2, jit: 'e2t', f });
  const t = two(f) - (CUT + 40);
  if (t >= 0) {
    const s = spring(t, 0.55, 0.55);
    hero(x, f, 1510, lerp(420, 640, s), { pose: 'happy', h: 240, rot: 6, id: 's7hero2' });
  }
}

export const cues = [
  paperCue(5096, 0.25), { f: 5104, sfx: 'flap', gain: 0.35 }, { f: 5112, sfx: 'step', gain: 0.3 },
  paperCue(Q_AT, 0.3), stampCue(A_AT, 0.6),
  { f: CUT, sfx: 'whoosh', gain: 0.2 },
  paperCue(CUT + 2, 0.3), paperCue(CUT + 14, 0.35), paperCue(CUT + 28, 0.3), paperCue(CUT + 36, 0.2),
];
