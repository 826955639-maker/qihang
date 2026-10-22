// Canvas backend (Skia via @napi-rs/canvas) + font registration.
import { createCanvas, GlobalFonts, loadImage, Path2D } from '@napi-rs/canvas';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const asset = (...p) => path.join(ROOT, 'assets', ...p);

const FONTS = {
  SerifB: 'NotoSerifSC-Bold.otf',
  SerifR: 'NotoSerifSC-Regular.otf',
  SerifH: 'NotoSerifSC-Black.otf',
  SansM: 'NotoSansSC-Medium.otf',
  SansB: 'NotoSansSC-Bold.otf',
  MaShan: 'MaShanZheng-Regular.ttf',
};
for (const [family, file] of Object.entries(FONTS)) GlobalFonts.registerFromPath(asset('fonts', file), family);

export { createCanvas, loadImage, Path2D };
