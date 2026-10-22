// 全片渲染：node src/render.js [from] [to] [jobs]  → out/video_nosound.mp4
import { spawn, execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { ROOT } from './canvas.js';
import { TOTAL } from './theme.js';
const from = Number(process.argv[2] ?? 0), to = Number(process.argv[3] ?? TOTAL);
const jobs = Number(process.argv[4] ?? os.cpus().length);
const crf = process.env.CRF || '18';
const dir = path.join(ROOT, 'out', 'seg'); fs.mkdirSync(dir, { recursive: true });
const chunk = 150;   // 5-second segments, handed out to workers as they free up
const segs = [];
for (let a = from; a < to; a += chunk) segs.push([a, Math.min(to, a + chunk), path.join(dir, `s${String(a).padStart(5, '0')}.mp4`)]);
let next = 0;
async function runWorker() {
  while (next < segs.length) {
    const [a, b, out] = segs[next++];
    await new Promise((res, rej) => {
      const p = spawn(process.execPath, [path.join(ROOT, 'src', 'worker.js'), String(a), String(b), out, crf], { stdio: 'inherit' });
      p.on('close', (c) => (c === 0 ? res() : rej(new Error(`worker ${a}-${b} exit ${c}`))));
    });
  }
}
const t0 = Date.now();
await Promise.all(Array.from({ length: jobs }, runWorker));
const list = path.join(dir, 'list.txt');
fs.writeFileSync(list, segs.map(([, , o]) => `file '${o}'`).join('\n'));
const out = path.join(ROOT, 'out', from === 0 && to === TOTAL ? 'video_nosound.mp4' : `video_${from}_${to}.mp4`);
execFileSync('ffmpeg', ['-y', '-v', 'error', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', out]);
console.log('wrote', out, 'in', ((Date.now() - t0) / 60000).toFixed(1), 'min');
