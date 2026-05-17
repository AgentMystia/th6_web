import { spawn } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';

const port = Number(process.env.PORT || 4174);
const httpRoot = `http://127.0.0.1:${port}`;
const scenes = [
  { id: 'stage1-smoke', stage: 1, warmup: 0, frames: 600 },
  { id: 'stage4-density', stage: 4, warmup: 4100, frames: 600 },
  { id: 'stage6-effects', stage: 6, warmup: 2500, frames: 600 }
];
const modes = [
  { id: 'desktop-auto', url: `${httpRoot}/index.html?test=1&mobile=0&renderer=auto`, viewport: { width: 1280, height: 960 } },
  { id: 'desktop-canvas', url: `${httpRoot}/index.html?test=1&mobile=0&renderer=canvas`, viewport: { width: 1280, height: 960 } },
  { id: 'mobile-auto', url: `${httpRoot}/index.html?test=1&mobile=1&renderer=auto`, viewport: { width: 932, height: 430 } },
  { id: 'file-canvas', url: `${pathToFileURL(`${process.cwd()}/index.html`).href}?test=1&mobile=0`, viewport: { width: 1280, height: 960 }, noServer: true }
];

const outArg = process.argv.find((arg) => arg.startsWith('--out='));
const outPath = outArg ? outArg.slice('--out='.length) : '';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function serverReady() {
  try {
    const res = await fetch(httpRoot);
    return res.ok;
  } catch {
    return false;
  }
}

async function ensureServer() {
  if (await serverReady()) return null;
  const child = spawn(process.execPath, ['tests/e2e/static-server.mjs'], {
    cwd: process.cwd(),
    env: { ...process.env, PORT: String(port) },
    stdio: 'ignore'
  });
  for (let i = 0; i < 80; i++) {
    if (await serverReady()) return child;
    await sleep(100);
  }
  child.kill();
  throw new Error(`Timed out waiting for ${httpRoot}`);
}

function roundStats(summary) {
  const round = (value) => Math.round(value * 1000) / 1000;
  const map = (stats) => ({ avg: round(stats.avg), p95: round(stats.p95), max: round(stats.max), count: stats.count });
  return {
    update: map(summary.update),
    draw: map(summary.draw),
    frame: map(summary.frame),
    input: map(summary.input),
    droppedFrames: summary.droppedFrames,
    rendererMode: summary.rendererMode,
    fallbackReason: summary.fallbackReason
  };
}

function digestSummary(digest) {
  return {
    phase: digest.phase,
    stage: digest.stage,
    frame: digest.frame,
    rng: digest.rng,
    score: digest.score,
    graze: digest.graze,
    enemies: digest.enemies.length,
    bullets: digest.bullets.length,
    lasers: digest.lasers.length,
    items: digest.items.length,
    effects: digest.effects.length
  };
}

async function runMode(browser, mode) {
  const page = await browser.newPage({ viewport: mode.viewport });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(mode.url);
  await page.waitForFunction(() => window.__TH06_TEST_READY__ === true);
  const results = [];
  for (const scene of scenes) {
    const result = await page.evaluate(({ scene }) => {
      window.__TH06_TEST__.setStage(scene.stage, { power: 128, alive: true, bulletGrace: 0, x: 192, y: 384 });
      if (scene.warmup) window.__TH06_TEST__.advance(scene.warmup, { x: 192, y: 384, invuln: true });
      return window.__TH06_TEST__.measureFrames(scene.frames, { x: 192, y: 384, invuln: true });
    }, { scene });
    results.push({
      id: scene.id,
      stage: scene.stage,
      warmup: scene.warmup,
      frames: scene.frames,
      summary: roundStats(result.summary),
      digest: digestSummary(result.digest)
    });
  }
  await page.close();
  return { id: mode.id, viewport: mode.viewport, url: mode.url, errors, results };
}

const server = await ensureServer();
const browser = await chromium.launch({ headless: true });
try {
  const report = {
    generatedAt: new Date().toISOString(),
    modes: []
  };
  for (const mode of modes) {
    report.modes.push(await runMode(browser, mode));
  }
  const json = JSON.stringify(report, null, 2);
  if (outPath) await writeFile(outPath, `${json}\n`);
  console.log(json);
} finally {
  await browser.close();
  if (server) server.kill();
}
