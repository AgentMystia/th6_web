// Menu navigation screenshot helper. Drives edge-triggered key presses through
// the menu flow, screenshotting at each labelled step.
// Usage: node scripts/dev-menu.mjs <outdir> "<step1>;<step2>;..."
// Each step is "key@shotName" e.g. "confirm@title" presses confirm then shoots
// a PNG named <shotName>.png. "wait@x" advances without a press. Keys:
// up/down/left/right/confirm/back. A leading "N*" repeats the key N times.
import { chromium } from '@playwright/test';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { extname, join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const [outdir = '/tmp/menu', script = 'shot@title'] = process.argv.slice(2);
await mkdir(outdir, { recursive: true });
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav', '.map': 'application/json' };
const server = createServer(async (req, res) => {
  try {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (p === '/') p = '/index.html';
    const data = await readFile(join(root, p));
    res.writeHead(200, { 'content-type': MIME[extname(p)] ?? 'application/octet-stream' });
    res.end(data);
  } catch {
    res.writeHead(404);
    res.end();
  }
});
await new Promise((r) => server.listen(0, r));
const port = server.address().port;
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const page = await browser.newPage({ viewport: { width: 1280, height: 960 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)); });
await page.goto(`http://127.0.0.1:${port}/index.html?test=1&menu=1`);
await page.waitForFunction(() => window.__TH07_TEST__?.ready, null, { timeout: 20000 });

// Edge-triggered press: inject as `pressed` for one sim frame, then clear.
async function press(key) {
  await page.evaluate((k) => {
    window.__TH07_TEST__.inject([], [k]);
    window.__TH07_TEST__.advance(1);
    window.__TH07_TEST__.inject([], []);
    window.__TH07_TEST__.advance(1);
  }, key);
}
async function settle(n = 40) {
  await page.evaluate((f) => window.__TH07_TEST__.advance(f), n);
}

await settle(130); // intro animations
for (const raw of script.split(';')) {
  const [action, name] = raw.split('@');
  let key = action, times = 1;
  const m = action.match(/^(\d+)\*(.+)$/);
  if (m) { times = Number(m[1]); key = m[2]; }
  if (key !== 'wait') {
    for (let i = 0; i < times; i++) { await press(key); await settle(10); }
  }
  await settle(40);
  const snap = await page.evaluate(() => window.__TH07_TEST__.snapshot());
  if (name) {
    await page.screenshot({ path: join(outdir, `${name}.png`) });
    console.log(`${name}:`, JSON.stringify(snap));
  }
}
if (errors.length) console.log('PAGE ERRORS:', JSON.stringify([...new Set(errors)].slice(0, 5)));
await browser.close();
server.close();
