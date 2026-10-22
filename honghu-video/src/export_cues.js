// 导出音频时间线（旁白 / 口述 / 音效）给 tools/mix.py
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './canvas.js';
import { NARRATION, CARDS } from './timeline.js';
import { allCues } from './frame.js';
import { TOTAL, FPS } from './theme.js';
const out = {
  fps: FPS, total: TOTAL,
  voice: [
    ...NARRATION.filter((n) => n.file).map((n) => ({ id: n.id, f: n.start, file: n.file, end: n.end })),
    ...Object.entries(CARDS).filter(([, c]) => c.file).map(([id, c]) => ({ id, f: c.voiceAt, file: c.file, end: c.voiceEnd })),
  ],
  sfx: allCues(),
};
fs.mkdirSync(path.join(ROOT, 'out'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'out', 'cues.json'), JSON.stringify(out, null, 1));
console.log('voice clips', out.voice.length, 'sfx cues', out.sfx.length);
