// 截取若干时间点的画面: node tools/snap.mjs <输出目录> t1 t2 ...
(async () => {
const { chromium } = require('playwright');
const { mkdirSync } = require('fs');
const [out, ...times] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', e => console.error('PAGE ERROR', e.message));
await page.goto((process.env.URL || 'http://127.0.0.1:8765/') + 'index.html?render');
await page.waitForFunction(() => window.READY);
for (const t of times) {
  await page.evaluate(t => renderFrame(t), +t);
  await page.locator('#stage').screenshot({ path: `${out}/f_${String(t).padStart(6, '0')}.png` });
}
await browser.close();
})();
