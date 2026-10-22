// 渲染静帧检查：node src/still.js 120 300 ...  → out/stills/fXXXX.png
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './canvas.js';
import { renderFrame } from './frame.js';
const dir = path.join(ROOT, 'out', 'stills');
fs.mkdirSync(dir, { recursive: true });
for (const a of process.argv.slice(2)) {
  const f = Number(a), t = Date.now();
  const c = renderFrame(f);
  const file = path.join(dir, `f${String(f).padStart(4, '0')}.png`);
  fs.writeFileSync(file, c.toBuffer('image/png'));
  console.log(file, Date.now() - t, 'ms');
}
