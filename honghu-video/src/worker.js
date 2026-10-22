// 渲染一段帧区间，原始 RGBA 管道送入 ffmpeg 编码
import { spawn } from 'node:child_process';
import { renderFrame } from './frame.js';
import { W, H, FPS } from './theme.js';
const [a, b, out, crf = '18'] = process.argv.slice(2);
const ff = spawn('ffmpeg', ['-y', '-v', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${W}x${H}`, '-r', String(FPS), '-i', '-',
  '-c:v', 'libx264', '-preset', 'slow', '-crf', crf, '-tune', 'film', '-pix_fmt', 'yuv420p', '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', out], { stdio: ['pipe', 'inherit', 'inherit'] });
const write = (buf) => new Promise((res) => (ff.stdin.write(buf) ? res() : ff.stdin.once('drain', res)));
const t0 = Date.now();
for (let f = Number(a); f < Number(b); f++) {
  const c = renderFrame(f);
  await write(c.data());
  if ((f - a) % 100 === 0) process.stdout.write(`[${a}-${b}] f${f} ${((Date.now() - t0) / (f - a + 1)).toFixed(0)}ms/f\n`);
}
ff.stdin.end();
await new Promise((res) => ff.on('close', res));
console.log(`[${a}-${b}] done in ${((Date.now() - t0) / 1000).toFixed(0)}s`);
