// 联系表：node src/sheet.js name f1 f2 ... → out/stills/sheet_name.png（4 列缩略图）
import fs from 'node:fs';
import path from 'node:path';
import { createCanvas } from './canvas.js';
import { ROOT } from './canvas.js';
import { renderFrame } from './frame.js';
const [name, ...fs_] = process.argv.slice(2);
const frames = fs_.map(Number), cols = 4, tw = 640, th = 360;
const rows = Math.ceil(frames.length / cols);
const sheet = createCanvas(cols * tw, rows * th), x = sheet.getContext('2d');
x.font = '28px SansB';
frames.forEach((f, i) => {
  const c = renderFrame(f);
  x.drawImage(c, (i % cols) * tw, Math.floor(i / cols) * th, tw, th);
  x.fillStyle = 'rgba(0,0,0,0.6)'; x.fillRect((i % cols) * tw, Math.floor(i / cols) * th, 110, 38);
  x.fillStyle = '#fff'; x.fillText('f' + f, (i % cols) * tw + 8, Math.floor(i / cols) * th + 29);
});
const out = path.join(ROOT, 'out', 'stills', `sheet_${name}.png`);
fs.writeFileSync(out, sheet.toBuffer('image/png'));
console.log(out);
