// 小鸿鹄：官方形象当作“一张贴纸”——白色 6px 描边 + 硬投影 + Jitter。
// 只使用等比缩放、平移、旋转，绝不做非等比变形，保证形象完整不走样。
import { createCanvas, loadImage, asset } from '../canvas.js';
import { cached, place } from './paper.js';
import { two } from './anim.js';

const IMG = {
  front: await loadImage(asset('xiaohonghu', 'front.png')),   // 正面（stand / happy / look）
  back: await loadImage(asset('xiaohonghu', 'back.png')),     // 背面（飞向远方）
};
const POSE = { stand: 'front', happy: 'front', look: 'front', fly: 'front', away: 'back' };

// high-quality progressive downscale, then a white die-cut border
export function heroSprite(pose = 'stand', h = 280) {
  const which = POSE[pose] || 'front';
  h = Math.round(h);
  return cached(`hero:${which}:${h}`, () => {
    const img = IMG[which];
    const scale = h / img.height, w = Math.round(img.width * scale);
    let src = img, sw = img.width, sh = img.height;
    while (sw / 2 > w * 1.4) {
      const tw = Math.round(sw / 2), th = Math.round(sh / 2), t = createCanvas(tw, th), tx = t.getContext('2d');
      tx.imageSmoothingEnabled = true; tx.imageSmoothingQuality = 'high';
      tx.drawImage(src, 0, 0, tw, th); src = t; sw = tw; sh = th;
    }
    const border = Math.max(4, Math.round(6 * Math.min(1.4, h / 360)));
    const pad = border + 4;
    const base = createCanvas(w, h), bx = base.getContext('2d');
    bx.imageSmoothingEnabled = true; bx.imageSmoothingQuality = 'high';
    bx.drawImage(src, 0, 0, w, h);
    // die-cut outline: dilate alpha in 32 directions, colour white
    const out = createCanvas(w + pad * 2, h + pad * 2), ox = out.getContext('2d');
    for (let i = 0; i < 32; i++) {
      const a = (i / 32) * Math.PI * 2;
      ox.drawImage(base, pad + Math.cos(a) * border, pad + Math.sin(a) * border);
    }
    ox.drawImage(base, pad, pad);   // fill interior holes of the silhouette
    ox.globalCompositeOperation = 'source-in';
    ox.fillStyle = '#FFFDF8'; ox.fillRect(0, 0, out.width, out.height);
    ox.globalCompositeOperation = 'source-over';
    ox.drawImage(base, pad, pad);
    return { c: out, pad, w, h };
  });
}

// draw hero with feet anchored at (x, y)
// res > 1 renders a sharper sprite for when the camera is pushed in
export function hero(x, f, px, py, { pose = 'stand', h = 280, rot = 0, s = 1, alpha = 1, id = 'hero', lift = 1, jamp = 0.45, res = 1 } = {}) {
  place(x, heroSprite(pose, h * s * res), px, py, { ax: 0.5, ay: 1, rot, alpha, jit: id, f, jamp, lift, s: 1 / res });
}

// 飞行：沿路径移动，身体上下浮动 ±12px（周期 20 帧）
export const bob = (f, amp = 12, period = 20) => Math.sin((two(f) / period) * Math.PI * 2) * amp;
