// 把网页里的动画逐帧"拍"下来，配上音轨，导出成 MP4。
//   node tools/render.mjs [宽度=1280] [帧率=30]   →   out/xiaoke.mp4
// 需要：npm i playwright（用自带的 Chromium）和 ffmpeg
import { chromium } from 'playwright';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const W = +(process.argv[2] || 1280), FPS = +(process.argv[3] || 30);
fs.mkdirSync(path.join(ROOT, 'out'), { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
await page.goto('file://' + path.join(ROOT, 'index.html') + `?render=1&w=${W}`);
const total = await page.evaluate(() => window.renderReady);
const frames = Math.ceil(total * FPS);
const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
  '-i', path.join(ROOT, 'audio', 'soundtrack.wav'), '-c:v', 'libx264', '-preset', 'medium', '-crf', '23', '-pix_fmt', 'yuv420p',
  '-c:a', 'aac', '-b:a', '160k', '-shortest', '-movflags', '+faststart', path.join(ROOT, 'out', 'xiaoke.mp4')], { stdio: ['pipe', 'inherit', 'inherit'] });
const t0 = Date.now();
for (let f = 0; f < frames; f++) {
  const b64 = await page.evaluate((t) => { renderFrame(t); return document.getElementById('cv').toDataURL('image/jpeg', 0.92).split(',')[1]; }, f / FPS);
  if (!ff.stdin.write(Buffer.from(b64, 'base64'))) await new Promise((r) => ff.stdin.once('drain', r));
  if (f % 300 === 0) console.log(`第 ${f}/${frames} 帧，${((Date.now() - t0) / 1000).toFixed(0)} 秒`);
}
ff.stdin.end();
await new Promise((r) => ff.on('close', r));
await browser.close();
console.log('完成：out/xiaoke.mp4');
