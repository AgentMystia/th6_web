import { test, expect } from '@playwright/test';
import { pathToFileURL } from 'node:url';
const indexUrl = 'http://127.0.0.1:4174/index.html?test=1';
const mobileUrl = 'http://127.0.0.1:4174/index.html?test=1&mobile=1';
const desktopUrl = 'http://127.0.0.1:4174/index.html?test=1&mobile=0';
const canvasUrl = 'http://127.0.0.1:4174/index.html?test=1&renderer=canvas';
const webglUrl = 'http://127.0.0.1:4174/index.html?test=1&renderer=webgl';

const clearFrames = {
  1: 7600,
  2: 9000,
  3: 5920,
  4: 10700,
  5: 7710,
  6: 3180
};

async function ready(page, url = indexUrl) {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(url);
  await page.waitForFunction(() => window.__TH06_TEST_READY__ === true);
  return errors;
}

function assertFiniteSnapshot(snapshot) {
  for (const enemy of snapshot.enemies) {
    expect(Number.isFinite(enemy.x), `enemy x ${JSON.stringify(enemy)}`).toBeTruthy();
    expect(Number.isFinite(enemy.y), `enemy y ${JSON.stringify(enemy)}`).toBeTruthy();
    if (enemy.x > -32 && enemy.x < 416 && enemy.y > -48 && enemy.y < 480) {
      expect(enemy.spriteSheet, `visible enemy missing sprite ${JSON.stringify(enemy)}`).toBeTruthy();
    }
  }
  for (const bullet of snapshot.bullets) {
    expect(Number.isFinite(bullet.x), `bullet x ${JSON.stringify(bullet)}`).toBeTruthy();
    expect(Number.isFinite(bullet.y), `bullet y ${JSON.stringify(bullet)}`).toBeTruthy();
    expect(Number.isFinite(bullet.vx), `bullet vx ${JSON.stringify(bullet)}`).toBeTruthy();
    expect(Number.isFinite(bullet.vy), `bullet vy ${JSON.stringify(bullet)}`).toBeTruthy();
    expect(bullet.grazeSize?.x, `bullet graze x ${JSON.stringify(bullet)}`).toBeGreaterThan(0);
    expect(bullet.grazeSize?.y, `bullet graze y ${JSON.stringify(bullet)}`).toBeGreaterThan(0);
  }
}

async function tapGame(page, layout, x, y) {
  await page.mouse.click(
    layout.canvas.x + layout.canvas.w * x / 640,
    layout.canvas.y + layout.canvas.h * y / 480
  );
  return page.evaluate(() => window.__TH06_TEST__.consumeInputFrame());
}

function rectBottom(rect) {
  return rect.y + rect.h;
}

function rectRight(rect) {
  return rect.x + rect.w;
}

function rectsOverlap(a, b) {
  return a && b && a.w > 0 && a.h > 0 && b.w > 0 && b.h > 0
    && a.x < rectRight(b) && rectRight(a) > b.x
    && a.y < rectBottom(b) && rectBottom(a) > b.y;
}

test('test hook exposes original hitbox and bullet cap constants', async ({ page }) => {
  const errors = await ready(page);
  const constants = await page.evaluate(() => window.__TH06_TEST__.constants);
  expect(constants.playerHitboxHalf).toEqual({ x: 1.25, y: 1.25, z: 5 });
  expect(constants.playerGrazePadding).toBe(20);
  expect(constants.bulletCap).toBe(640);
  expect(constants.defaultDifficulty).toBe('normal');
  expect(constants.difficultyOrder).toEqual(['easy', 'normal', 'hard', 'lunatic']);
  expect(errors).toEqual([]);
});

test('Stage 1 boss BGM transition and Rumia defeat keep audio volumes in range', async ({ page }) => {
  const errors = await ready(page, canvasUrl);
  const snapshot = await page.evaluate(() => {
    window.__TH06_TEST__.setStage(1, {
      power: 128,
      alive: true,
      bulletGrace: 999999,
      autoplay: true,
      x: 192,
      y: 384
    });
    window.__TH06_TEST__.advance(5900, { x: 192, y: 384, invuln: true });
    window.__TH06_TEST__.killBosses();
    return window.__TH06_TEST__.advance(240, { x: 192, y: 384, invuln: true });
  });
  expect(snapshot.stage).toBe(1);
  expect(snapshot.boss.name).toBe('Rumia');
  expect(errors).toEqual([]);
});

test('difficulty menu exposes all main difficulties with Normal selected by default', async ({ page }) => {
  const errors = await ready(page);
  let snapshot = await page.evaluate(() => window.__TH06_TEST__.snapshot());
  expect(snapshot.difficulty).toBe('normal');

  snapshot = await page.evaluate(() => window.__TH06_TEST__.advance(1, { pressed: ['confirm'] }));
  expect(snapshot.phase).toBe('difficulty');
  expect(snapshot.difficulty).toBe('normal');

  snapshot = await page.evaluate(() => window.__TH06_TEST__.advance(1, { pressed: ['up'] }));
  expect(snapshot.difficulty).toBe('easy');
  snapshot = await page.evaluate(() => window.__TH06_TEST__.advance(1, { pressed: ['down'] }));
  expect(snapshot.difficulty).toBe('normal');
  snapshot = await page.evaluate(() => window.__TH06_TEST__.advance(1, { pressed: ['down'] }));
  expect(snapshot.difficulty).toBe('hard');
  snapshot = await page.evaluate(() => window.__TH06_TEST__.advance(1, { pressed: ['down'] }));
  expect(snapshot.difficulty).toBe('lunatic');

  snapshot = await page.evaluate(() => window.__TH06_TEST__.advance(1, { pressed: ['confirm'] }));
  expect(snapshot.phase).toBe('character');
  expect(snapshot.difficulty).toBe('lunatic');
  expect(errors).toEqual([]);
});

test('Easy main game stops after Stage 5 while other main difficulties continue to Stage 6', async ({ page }) => {
  const errors = await ready(page);
  let snapshot = await page.evaluate(() => window.__TH06_TEST__.setStage(5, { difficulty: 'easy', power: 128, alive: true }));
  expect(snapshot.difficulty).toBe('easy');
  expect(snapshot.hasNextStage).toBe(false);

  for (const difficulty of ['normal', 'hard', 'lunatic']) {
    snapshot = await page.evaluate((selected) => window.__TH06_TEST__.setStage(5, {
      difficulty: selected,
      power: 128,
      alive: true
    }), difficulty);
    expect(snapshot.difficulty).toBe(difficulty);
    expect(snapshot.hasNextStage).toBe(true);
  }
  expect(errors).toEqual([]);
});

test('desktop mode keeps touch UI, service worker, and auto-fire disabled', async ({ page }) => {
  const errors = await ready(page, desktopUrl);
  const snapshot = await page.evaluate(() => window.__TH06_TEST__.snapshot());
  expect(snapshot.mobile.mode).toBe(false);
  await expect(page.locator('.mobile-controls')).toHaveCount(0);
  await expect(page.locator('.mobile-game-viewport')).toHaveCount(0);
  await expect(page.locator('.mobile-top-status-panel')).toHaveCount(0);
  await expect(page.locator('.mobile-status-panel')).toHaveCount(0);
  expect(snapshot.mobile.layout.viewport).toBeNull();
  expect(snapshot.mobile.layout.topStatus).toBeNull();
  expect(snapshot.mobile.layout.status).toBeNull();

  const playing = await page.evaluate(() => {
    window.__TH06_TEST__.setStage(1, { power: 128, alive: true, bulletGrace: 0, x: 192, y: 384 });
    return window.__TH06_TEST__.advance(12, { x: 192, y: 384 });
  });
  expect(playing.playerBullets).toBe(0);

  await page.waitForFunction(async () => {
    if (!('serviceWorker' in navigator)) return true;
    const registrations = await navigator.serviceWorker.getRegistrations();
    return !registrations.some((registration) => {
      const worker = registration.active || registration.waiting || registration.installing;
      return worker?.scriptURL?.endsWith('/sw.js');
    });
  });
  expect(errors).toEqual([]);
});

test('desktop web runtime caches audio and core assets before showing the game', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 960 });
  await page.goto('http://127.0.0.1:4174/index.html?mobile=0');
  await page.waitForFunction(async () => {
    if (!navigator.serviceWorker?.controller || typeof caches === 'undefined') return false;
    if (document.querySelector('.startup-cache-status')) return false;
    const cache = await caches.open('touhou-web-runtime-v11');
    return !!await cache.match('assets/audio/th06_13.ogg')
      && !!await cache.match('assets/sfx/plst00.wav')
      && !!await cache.match('assets/th06-img/png/stg6enm2.png')
      && !!await cache.match('src/vanilla/main.js')
      && !!await cache.match('manifest.webmanifest');
  }, null, { timeout: 60_000 });
  await expect(page.locator('.mobile-controls')).toHaveCount(0);
  await expect(page.locator('.startup-cache-status')).toHaveCount(0);
});

test('mobile portrait gameplay stretches playfield between arcade HUD strips', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const errors = await ready(page, mobileUrl);
  await expect(page.locator('.mobile-orientation-hint')).toHaveCount(0);

  let snapshot = await page.evaluate(() => window.__TH06_TEST__.snapshot());
  expect(snapshot.mobile.mode).toBe(true);
  expect(snapshot.mobile.layout.enabled).toBe(true);
  expect(snapshot.mobile.layout.portraitGameplay).toBe(false);
  expect(snapshot.mobile.layout.viewport.w / snapshot.mobile.layout.viewport.h).toBeCloseTo(4 / 3, 1);
  expect(snapshot.mobile.layout.topStatus.w).toBe(0);
  expect(snapshot.mobile.layout.topStatus.h).toBe(0);
  expect(snapshot.mobile.layout.status.w).toBe(0);
  expect(snapshot.mobile.layout.status.h).toBe(0);

  snapshot = await page.evaluate(() => window.__TH06_TEST__.setStage(1, {
    power: 64,
    lives: 4,
    bombs: 2,
    score: 113204,
    graze: 17,
    pointItems: 5,
    alive: true,
    bulletGrace: 0,
    x: 192,
    y: 384
  }));
  const layout = snapshot.mobile.layout;
  expect(layout.portraitGameplay).toBe(true);
  expect(Math.abs(layout.viewport.w / layout.viewport.h - 384 / 448)).toBeGreaterThan(0.2);
  expect(layout.viewport.w).toBeGreaterThanOrEqual(370);
  expect(layout.viewport.h).toBeGreaterThan(700);
  expect(layout.topStatus.w).toBeCloseTo(layout.viewport.w, 0);
  expect(layout.status.w).toBeCloseTo(layout.viewport.w, 0);
  expect(layout.viewport.y).toBeGreaterThanOrEqual(rectBottom(layout.topStatus) - 0.5);
  expect(layout.status.y).toBeGreaterThanOrEqual(rectBottom(layout.viewport) - 0.5);
  expect(rectsOverlap(layout.topStatus, layout.viewport)).toBe(false);
  expect(rectsOverlap(layout.topStatus, layout.status)).toBe(false);
  expect(rectsOverlap(layout.viewport, layout.status)).toBe(false);
  expect(rectsOverlap(layout.controls, layout.status)).toBe(false);
  expect(layout.controls.x).toBeGreaterThanOrEqual(layout.viewport.x - 1);
  expect(rectRight(layout.controls)).toBeLessThanOrEqual(layout.viewport.x + 72);
  expect(layout.controls.y).toBeGreaterThan(layout.viewport.y + layout.viewport.h * 0.35);
  expect(rectBottom(layout.controls)).toBeLessThanOrEqual(rectBottom(layout.viewport) + 1);

  await expect(page.locator('[data-mobile-status="score"]')).toHaveText('000113204');
  await expect(page.locator('[data-mobile-stars="lives"] .mobile-life-star')).toHaveCount(4);
  await expect(page.locator('[data-mobile-stars="bombs"] .mobile-bomb-star')).toHaveCount(2);
  await expect(page.locator('[data-mobile-status="power"]')).toHaveText('64/128');
  await expect(page.locator('[data-mobile-status="power-fill"]')).toHaveAttribute('data-power', '64');

  await page.mouse.click(layout.status.x + layout.status.w / 2, layout.status.y + layout.status.h / 2);
  let inputResult = await page.evaluate(() => window.__TH06_TEST__.consumeInputFrame());
  expect(inputResult.input.pressed).not.toContain('bomb');

  await page.evaluate(() => window.__TH06_TEST__.setStage(1, {
    power: 64,
    lives: 4,
    bombs: 3,
    alive: true,
    bulletGrace: 0,
    x: 192,
    y: 384
  }));
  await page.locator('.mobile-bomb').click();
  inputResult = await page.evaluate(() => window.__TH06_TEST__.consumeInputFrame());
  expect(inputResult.input.pressed).toContain('bomb');
  expect(inputResult.snapshot.bombs).toBe(2);

  inputResult = await tapGame(page, layout, 224, 240);
  expect(inputResult.input.mobileMenuTaps.length).toBe(1);
  expect(errors).toEqual([]);
});

test('mobile horizontal viewport keeps portrait-first layout without a landscape rail', async ({ page }) => {
  await page.setViewportSize({ width: 932, height: 430 });
  const errors = await ready(page, mobileUrl);
  let snapshot = await page.evaluate(() => window.__TH06_TEST__.snapshot());
  expect(snapshot.mobile.mode).toBe(true);
  expect(snapshot.mobile.layout.enabled).toBe(true);
  expect(snapshot.mobile.layout.controls.w).toBeLessThanOrEqual(70);
  expect(snapshot.mobile.layout.viewport.w / snapshot.mobile.layout.viewport.h).toBeCloseTo(4 / 3, 1);
  expect(snapshot.mobile.layout.status.w).toBe(0);
  expect(snapshot.mobile.layout.status.h).toBe(0);
  await expect(page.locator('.mobile-control')).toHaveText(['BOMB', 'SHOT']);
  await expect(page.locator('.mobile-orientation-hint')).toHaveCount(0);

  snapshot = await page.evaluate(() => window.__TH06_TEST__.setStage(1, {
    power: 128,
    alive: true,
    bulletGrace: 0,
    x: 192,
    y: 384
  }));
  const layout = snapshot.mobile.layout;
  expect(layout.portraitGameplay).toBe(true);
  expect(layout.viewport.w).toBeGreaterThan(layout.controls.w * 4);
  expect(layout.topStatus.w).toBeCloseTo(layout.viewport.w, 0);
  expect(layout.status.w).toBeCloseTo(layout.viewport.w, 0);
  expect(layout.status.y).toBeGreaterThanOrEqual(rectBottom(layout.viewport) - 0.5);
  expect(rectsOverlap(layout.topStatus, layout.viewport)).toBe(false);
  expect(rectsOverlap(layout.viewport, layout.status)).toBe(false);
  expect(rectsOverlap(layout.controls, layout.status)).toBe(false);
  expect(errors).toEqual([]);
});

test('mobile analog movement follows touch delta without a speed cap in SHOT and LASER', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const errors = await ready(page, mobileUrl);
  await page.evaluate(() => window.__TH06_TEST__.setStage(1, { power: 128, alive: true, bulletGrace: 0, x: 192, y: 384 }));
  let snapshot = await page.evaluate(() => window.__TH06_TEST__.advance(1, { analogMove: { x: 0.5, y: -0.25 } }));
  expect(snapshot.player.x).toBe(192.5);
  expect(snapshot.player.y).toBe(383.75);

  await page.evaluate(() => window.__TH06_TEST__.setStage(1, { power: 128, alive: true, bulletGrace: 0, x: 192, y: 384 }));
  snapshot = await page.evaluate(() => window.__TH06_TEST__.advance(1, { analogMove: { x: 20, y: 0 } }));
  expect(snapshot.player.x).toBe(212);
  expect(snapshot.player.y).toBe(384);
  expect(snapshot.player.focus).toBe(false);

  await page.evaluate(() => {
    window.__TH06_TEST__.setMobileShotFocus(true);
    window.__TH06_TEST__.setStage(1, { power: 128, alive: true, bulletGrace: 0, x: 192, y: 384 });
  });
  snapshot = await page.evaluate(() => window.__TH06_TEST__.advance(1, { analogMove: { x: 20, y: 0 } }));
  expect(snapshot.player.x).toBe(212);
  expect(snapshot.player.y).toBe(384);
  expect(snapshot.player.focus).toBe(true);
  expect(snapshot.player.focusCollect).toBe(false);
  expect(snapshot.mobile.hitboxVisible).toBe(true);
  expect(errors).toEqual([]);
});

test('mobile auto-fire, LASER shot form, and bomb/deathbomb inputs are gameplay-only state', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const errors = await ready(page, mobileUrl);
  let snapshot = await page.evaluate(() => {
    window.__TH06_TEST__.setStage(1, { power: 128, bombs: 3, alive: true, bulletGrace: 0, x: 192, y: 384 });
    return window.__TH06_TEST__.advance(1);
  });
  expect(snapshot.playerBullets).toBeGreaterThan(0);
  expect(snapshot.player.focus).toBe(false);

  snapshot = await page.evaluate(() => {
    window.__TH06_TEST__.setMobileShotFocus(true);
    window.__TH06_TEST__.setStage(1, { power: 128, bombs: 3, alive: true, bulletGrace: 0, x: 192, y: 384 });
    return window.__TH06_TEST__.advance(1);
  });
  expect(snapshot.player.focus).toBe(true);
  expect(snapshot.player.focusCollect).toBe(false);
  expect(snapshot.playerBullets).toBeGreaterThan(0);

  snapshot = await page.evaluate(() => {
    window.__TH06_TEST__.setStage(1, { power: 64, bombs: 3, alive: true, bulletGrace: 0, x: 192, y: 384 });
    return window.__TH06_TEST__.advance(1, { pressed: ['bomb'] });
  });
  expect(snapshot.bombs).toBe(2);
  expect(snapshot.playerBombDeclaration?.spellName).toBe('Spirit Sign "Dream Seal"');

  snapshot = await page.evaluate(() => {
    window.__TH06_TEST__.setStage(1, { power: 64, bombs: 3, alive: true, bulletGrace: 0, x: 192, y: 384 });
    window.__TH06_TEST__.spawnEnemyBullet({ x: 192, y: 384, vx: 0, vy: 0 });
    return window.__TH06_TEST__.advance(1);
  });
  expect(snapshot.player.state).toBe('deathbomb');
  snapshot = await page.evaluate(() => window.__TH06_TEST__.advance(1, { pressed: ['bomb'] }));
  expect(snapshot.bombs).toBe(2);
  expect(snapshot.player.state).toBe('invuln');
  expect(snapshot.playerBombDeclaration?.spellName).toBe('Spirit Sign "Dream Seal"');
  expect(errors).toEqual([]);
});

test('mobile playfield taps skip active dialogue like confirm input', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const errors = await ready(page, mobileUrl);
  const layout = await page.evaluate(() => {
    window.__TH06_TEST__.setStage(1, { power: 128, alive: true, bulletGrace: 0, x: 192, y: 384 });
    window.__TH06_TEST__.startTestDialogue(999999);
    window.__TH06_TEST__.advance(10);
    return window.__TH06_TEST__.snapshot().mobile.layout;
  });
  let snapshot = await page.evaluate(() => window.__TH06_TEST__.snapshot());
  expect(snapshot.dialogue?.waiting).toBe(true);
  expect(snapshot.dialogue?.waitFrame).toBeGreaterThanOrEqual(8);

  const inputResult = await tapGame(page, layout, 320, 300);
  expect(inputResult.input.mobileMenuTaps.length).toBe(1);
  expect(inputResult.snapshot.dialogue).toBeNull();
  expect(inputResult.snapshot.phase).toBe('playing');
  expect(errors).toEqual([]);
});

test('mobile fixed simulation never exceeds 60Hz and drops processing when rAF is slow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const errors = await ready(page, mobileUrl);
  const fast = await page.evaluate(() => {
    window.__TH06_TEST__.setStage(1, { power: 128, alive: true, bulletGrace: 0, x: 192, y: 384 });
    return window.__TH06_TEST__.simulateFrameLoop(Array.from({ length: 120 }, () => 1000 / 120), { mobileMode: true, mobileShootHeld: true });
  });
  expect(fast.steps).toBe(60);
  expect(fast.droppedFrames).toBe(0);
  expect(fast.draws).toBe(60);
  expect(fast.renderSkips).toBe(60);
  expect(fast.snapshot.frame).toBe(60);

  const slow = await page.evaluate(() => {
    window.__TH06_TEST__.setStage(1, { power: 128, alive: true, bulletGrace: 0, x: 192, y: 384 });
    return window.__TH06_TEST__.simulateFrameLoop(Array.from({ length: 30 }, () => 1000 / 30), { mobileMode: true, mobileShootHeld: true });
  });
  expect(slow.steps).toBe(30);
  expect(slow.droppedFrames).toBe(30);
  expect(slow.draws).toBe(30);
  expect(slow.renderSkips).toBe(0);
  expect(slow.snapshot.frame).toBe(30);
  expect(errors).toEqual([]);
});

test('desktop high refresh input skips stale draws until the keyboard event is simulated', async ({ page }) => {
  const errors = await ready(page, desktopUrl);
  const result = await page.evaluate(() => {
    window.__TH06_TEST__.setStage(1, { power: 128, alive: true, bulletGrace: 0, x: 192, y: 384 });
    return window.__TH06_TEST__.simulateDesktopInputLoop(Array.from({ length: 3 }, () => 1000 / 120), {
      inputFrame: 0,
      button: 'right'
    });
  });
  expect(result.steps).toBe(1);
  expect(result.draws).toBe(1);
  expect(result.renderSkips).toBe(2);
  expect(result.skippedDrawsBeforeInputUpdate).toBe(1);
  expect(result.staleDrawsAfterInput).toBe(0);
  expect(result.firstDrawAfterInput).toMatchObject({ frameIndex: 1, afterUpdate: true });
  expect(result.firstDrawAfterInput.playerX).toBeGreaterThan(result.startX);
  expect(result.perf.inputUpdate.count).toBe(1);
  expect(result.perf.inputDraw.count).toBe(1);
  expect(errors).toEqual([]);
});

test('mobile PWA manifest and service worker are available outside test mode', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('http://127.0.0.1:4174/index.html?mobile=1');
  await page.waitForSelector('.mobile-controls');
  const manifestHref = await page.getAttribute('link[rel="manifest"]', 'href');
  expect(manifestHref).toBe('manifest.webmanifest');
  const manifest = await page.evaluate(async (href) => fetch(href).then((response) => response.json()), manifestHref);
  expect(manifest.orientation).toBe('portrait');
  const serviceWorkerUrl = await page.evaluate(async () => {
    if (!('serviceWorker' in navigator)) return null;
    const registration = await navigator.serviceWorker.ready;
    const worker = registration.active || registration.waiting || registration.installing;
    return worker?.scriptURL || null;
  });
  expect(serviceWorkerUrl).toMatch(/\/sw\.js$/);
});

test('Canvas and WebGL renderers keep deterministic gameplay state identical', async ({ page }) => {
  const run = async (url) => {
    const errors = await ready(page, url);
    const digest = await page.evaluate(() => {
      window.__TH06_TEST__.setStage(4, { power: 128, alive: true, bulletGrace: 0, x: 192, y: 384 });
      window.__TH06_TEST__.advance(720, { x: 192, y: 384, invuln: true });
      return window.__TH06_TEST__.stateDigest();
    });
    expect(errors).toEqual([]);
    return digest;
  };
  const canvasDigest = await run(canvasUrl);
  const webglDigest = await run(webglUrl);
  expect(webglDigest).toEqual(canvasDigest);
});

test('direct file launch stays on Canvas fallback and reaches playable Stage 1', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const url = `${pathToFileURL(`${process.cwd()}/index.html`).href}?test=1&mobile=0`;
  await page.goto(url);
  await page.waitForFunction(() => window.__TH06_TEST_READY__ === true);
  const result = await page.evaluate(() => {
    window.__TH06_TEST__.setStage(1, { power: 128, alive: true, bulletGrace: 0, x: 192, y: 384 });
    const snapshot = window.__TH06_TEST__.advance(12, { held: ['shoot'], x: 192, y: 384, invuln: true });
    return {
      phase: snapshot.phase,
      stage: snapshot.stage,
      playerBullets: snapshot.playerBullets,
      constants: window.__TH06_TEST__.constants,
      rendererMode: window.__TH06_TEST__.rendererMode(),
      drawError: snapshot.perf.lastDrawError
    };
  });
  expect(result.phase).toBe('playing');
  expect(result.stage).toBe(1);
  expect(result.playerBullets).toBeGreaterThan(0);
  expect(result.constants.stageWebglEnabled).toBe(false);
  expect(result.rendererMode).toBe('canvas');
  expect(result.drawError).toBe('');
  expect(errors).toEqual([]);
});

test('forced WebGL renderer failure falls back without stopping gameplay input', async ({ page }) => {
  const errors = await ready(page, webglUrl);
  const result = await page.evaluate(() => {
    window.__TH06_TEST__.setStage(1, { power: 128, alive: true, bulletGrace: 0, x: 192, y: 384 });
    window.__TH06_TEST__.forceRendererFailure();
    const snapshot = window.__TH06_TEST__.advance(12, { held: ['shoot'], x: 192, y: 384, invuln: true });
    return {
      rendererMode: window.__TH06_TEST__.rendererMode(),
      phase: snapshot.phase,
      playerBullets: snapshot.playerBullets,
      drawError: snapshot.perf.lastDrawError
    };
  });
  expect(result.rendererMode).toBe('fallback-canvas');
  expect(result.phase).toBe('playing');
  expect(result.playerBullets).toBeGreaterThan(0);
  expect(result.drawError).toBe('');
  expect(errors).toEqual([]);
});

for (const stage of [1, 2, 3, 4, 5, 6]) {
  test(`Stage ${stage} browser smoke renders source sprites and bounded enemy fire`, async ({ page }) => {
    const errors = await ready(page);
    let snapshot = await page.evaluate((stageNumber) => window.__TH06_TEST__.setStage(stageNumber, {
      power: 128,
      bulletGrace: 0,
      alive: false,
      x: 192,
      y: 384
    }), stage);
    expect(snapshot.stage).toBe(stage);
    expect(snapshot.runtime.stageBg).toBe(`stg${stage}bg`);
    expect(snapshot.runtime.effect).toMatch(/^eff0[1-5]$/);

    const checkpoints = [240, 900, Math.min(clearFrames[stage] - 1, 2400)];
    for (const target of checkpoints) {
      const delta = Math.max(0, target - snapshot.frame);
      snapshot = await page.evaluate((frames) => window.__TH06_TEST__.advance(frames, { x: 192, y: 384, invuln: true }), delta);
      assertFiniteSnapshot(snapshot);
      expect(snapshot.bullets.length).toBeLessThanOrEqual(640);
    }

    const stats = await page.evaluate(() => window.__TH06_TEST__.canvasStats());
    expect(stats.nonBlack).toBeGreaterThan(12000);
    expect(errors).toEqual([]);
  });
}

test('Stage 6 Sakuya midboss uses the correct source spritesheet', async ({ page }) => {
  const errors = await ready(page);
  await page.evaluate(() => window.__TH06_TEST__.setStage(6, { power: 128, bulletGrace: 0, x: 192, y: 384 }));
  const snapshot = await page.evaluate(() => window.__TH06_TEST__.advance(2570, { x: 192, y: 384, invuln: true }));
  const sakuyaFrames = snapshot.enemies.filter((enemy) => enemy.subId === 8 && enemy.anm >= 128 && enemy.anm <= 130);
  expect(sakuyaFrames.length).toBeGreaterThan(0);
  for (const enemy of sakuyaFrames) expect(enemy.spriteSheet).toBe('enemy');
  const strayPowerDrops = snapshot.items.filter((item) => item.type === 'power' || item.type === 'bigPower');
  expect(strayPowerDrops).toEqual([]);
  expect(errors).toEqual([]);
});

test('Stage 5/6 non-interactable child enemies do not absorb player shots or op96 drops', async ({ page }) => {
  const errors = await ready(page);
  await page.evaluate(() => window.__TH06_TEST__.setStage(5, { power: 128, alive: true, bulletGrace: 0, x: 192, y: 384 }));
  await page.evaluate(() => window.__TH06_TEST__.spawnTestEnemy({
    subId: 25,
    x: 192,
    y: 306,
    hp: 100,
    itemDrop: 2,
    interactable: false,
    canTakeDamage: true,
    hitbox: { x: 96, y: 96, z: 32 }
  }));
  await page.evaluate(() => window.__TH06_TEST__.spawnTestEnemy({
    subId: 8,
    x: 192,
    y: 246,
    hp: 1200,
    itemDrop: -2,
    interactable: true,
    canTakeDamage: true,
    hitbox: { x: 72, y: 72, z: 32 }
  }));
  const shotSnapshot = await page.evaluate(() => window.__TH06_TEST__.advance(24, {
    held: ['shoot'],
    x: 192,
    y: 384,
    invuln: true
  }));
  const helper = shotSnapshot.enemies.find((enemy) => enemy.subId === 25);
  const target = shotSnapshot.enemies.find((enemy) => enemy.subId === 8);
  expect(helper?.hp).toBe(100);
  expect(target?.hp).toBeLessThan(1200);

  await page.evaluate(() => window.__TH06_TEST__.setStage(6, { power: 0, alive: true, bulletGrace: 0, x: 192, y: 384 }));
  await page.evaluate(() => window.__TH06_TEST__.spawnTestEnemy({
    subId: 29,
    x: 192,
    y: 306,
    hp: 10,
    itemDrop: 3,
    interactable: false,
    canTakeDamage: true
  }));
  const killedSnapshot = await page.evaluate(() => window.__TH06_TEST__.killNonBosses());
  const drops = killedSnapshot.items.filter((item) => item.type === 'power' || item.type === 'bigPower');
  expect(drops).toEqual([]);
  expect(killedSnapshot.enemies.some((enemy) => enemy.subId === 29)).toBeFalsy();
  expect(errors).toEqual([]);
});

test('ins_105 disables HP loss only, so interactable targets still catch shots', async ({ page }) => {
  const errors = await ready(page);
  await page.evaluate(() => window.__TH06_TEST__.setStage(6, { power: 128, alive: true, bulletGrace: 0, x: 192, y: 384 }));
  await page.evaluate(() => window.__TH06_TEST__.spawnTestEnemy({
    subId: 8,
    x: 192,
    y: 270,
    hp: 300,
    interactable: true,
    canTakeDamage: false,
    hitbox: { x: 86, y: 86, z: 32 }
  }));
  const snapshot = await page.evaluate(() => window.__TH06_TEST__.advance(18, {
    held: ['shoot'],
    x: 192,
    y: 384,
    invuln: true
  }));
  const target = snapshot.enemies.find((enemy) => enemy.subId === 8);
  expect(target?.hp).toBe(300);
  expect(snapshot.playerBulletDetails.some((bullet) => bullet.state === 'collided')).toBeTruthy();
  expect(errors).toEqual([]);
});

test('Remilia bat helper subentities pass player shots while original ins_117 keeps them non-interactable', async ({ page }) => {
  const errors = await ready(page);
  await page.evaluate(() => window.__TH06_TEST__.setStage(6, { power: 128, alive: true, bulletGrace: 0, x: 192, y: 384 }));
  await page.evaluate(() => window.__TH06_TEST__.spawnTestEnemy({
    subId: 29,
    x: 192,
    y: 306,
    hp: 100,
    itemDrop: 3,
    interactable: false,
    canTakeDamage: true,
    hitbox: { x: 72, y: 72, z: 32 }
  }));
  await page.evaluate(() => window.__TH06_TEST__.spawnTestEnemy({
    subId: 8,
    x: 192,
    y: 246,
    hp: 1200,
    itemDrop: -2,
    interactable: true,
    canTakeDamage: true,
    hitbox: { x: 72, y: 72, z: 32 }
  }));
  const snapshot = await page.evaluate(() => window.__TH06_TEST__.advance(24, {
    held: ['shoot'],
    x: 192,
    y: 384,
    invuln: true
  }));
  const bat = snapshot.enemies.find((enemy) => enemy.subId === 29);
  const target = snapshot.enemies.find((enemy) => enemy.subId === 8);
  expect(bat?.interactable).toBe(false);
  expect(bat?.hp).toBe(100);
  expect(target?.hp).toBeLessThan(1200);
  expect(errors).toEqual([]);
});

test('render order keeps enemy bullets above player sprite but hitbox marker above bullets', async ({ page }) => {
  const errors = await ready(page);
  const setup = await page.evaluate(() => {
    const snapshot = window.__TH06_TEST__.setStage(1, { power: 0, alive: true, bulletGrace: 0, x: 192, y: 384 });
    const playfield = window.__TH06_TEST__.constants.playfield;
    const sample = { x: playfield.x + 192, y: playfield.y + 384 };
    return { snapshot, sample, playerPixel: window.__TH06_TEST__.pixelAt(sample.x, sample.y) };
  });
  const bulletPixel = await page.evaluate(({ x, y }) => {
    window.__TH06_TEST__.spawnEnemyBullet({ x: 192, y: 384, sprite: 0, offset: 0, vx: 0, vy: 0 });
    return window.__TH06_TEST__.pixelAt(x, y);
  }, setup.sample);
  const playerDelta = bulletPixel.reduce((sum, channel, index) => sum + Math.abs(channel - setup.playerPixel[index]), 0);
  expect(playerDelta).toBeGreaterThan(20);

  const hitboxPixel = await page.evaluate(({ x, y }) => {
    window.__TH06_TEST__.advance(1, { held: ['focus'], x: 192, y: 384, invuln: true });
    return window.__TH06_TEST__.pixelAt(x, y);
  }, setup.sample);
  expect(hitboxPixel[0]).toBeGreaterThan(180);
  expect(hitboxPixel[1]).toBeLessThan(90);
  expect(hitboxPixel[2]).toBeLessThan(130);
  expect(errors).toEqual([]);
});

test('Stage 3 midboss defeat cannot skip the remaining ECL timeline', async ({ page }) => {
  const errors = await ready(page);
  await page.evaluate(() => window.__TH06_TEST__.setStage(3, { power: 0, bulletGrace: 0, x: 192, y: 384 }));
  let snapshot = await page.evaluate(() => window.__TH06_TEST__.advance(3820, { x: 192, y: 384, invuln: true }));
  expect(snapshot.stage).toBe(3);
  expect(snapshot.runtime.timelineComplete).toBe(false);
  expect(snapshot.enemies.some((enemy) => enemy.boss)).toBeTruthy();

  snapshot = await page.evaluate(() => window.__TH06_TEST__.setStageFrame(5921));
  expect(snapshot.stage).toBe(3);
  expect(snapshot.runtime.timelineComplete).toBe(false);
  expect(snapshot.enemies.some((enemy) => enemy.boss)).toBeTruthy();

  snapshot = await page.evaluate(() => window.__TH06_TEST__.killBosses());
  expect(snapshot.stage).toBe(3);
  expect(snapshot.phase).toBe('playing');
  expect(snapshot.runtime.timelineComplete).toBe(false);

  snapshot = await page.evaluate(() => window.__TH06_TEST__.advance(12, { x: 192, y: 384, invuln: true }));
  expect(snapshot.stage).toBe(3);
  expect(snapshot.phase).toBe('playing');
  expect(snapshot.enemies.length).toBeGreaterThan(0);
  expect(errors).toEqual([]);
});

test('Stage 4 Koakuma survives her original ECL clear-screen initialization', async ({ page }) => {
  const errors = await ready(page);
  await page.evaluate(() => window.__TH06_TEST__.setStage(4, { power: 128, bulletGrace: 0, x: 192, y: 384 }));
  const snapshot = await page.evaluate(() => window.__TH06_TEST__.advance(4140, { x: 192, y: 384, invuln: true }));
  const koakuma = snapshot.enemies.find((enemy) => enemy.subId === 21);
  expect(koakuma).toBeTruthy();
  expect(koakuma.boss).toBeTruthy();
  expect(koakuma.hp).toBe(7000);
  expect(snapshot.boss.name).toBe('Koakuma');
  expect(errors).toEqual([]);
});

test('Bomb starts original-style item auto-collection instead of deleting items', async ({ page }) => {
  const errors = await ready(page);
  await page.evaluate(() => window.__TH06_TEST__.setStage(1, { power: 64, bombs: 3, alive: true, bulletGrace: 0, x: 192, y: 384 }));
  await page.evaluate(() => window.__TH06_TEST__.spawnItem('point', 72, 72));
  const snapshot = await page.evaluate(() => window.__TH06_TEST__.advance(1, { pressed: ['bomb'], x: 192, y: 384 }));
  expect(snapshot.bombs).toBe(2);
  expect(snapshot.playerBombDeclaration?.spellName).toBe('Spirit Sign "Dream Seal"');
  expect(snapshot.playerBombDeclaration?.faceKey).toBe('face00a');
  expect(snapshot.items.some((item) => item.type === 'point' && item.state === 1)).toBeTruthy();
  expect(errors).toEqual([]);
});

test('items despawn at the original bottom boundary before late collection', async ({ page }) => {
  const errors = await ready(page);
  await page.evaluate(() => window.__TH06_TEST__.setStage(1, { power: 0, alive: true, bulletGrace: 0, x: 192, y: 432 }));
  await page.evaluate(() => window.__TH06_TEST__.spawnItem('point', 192, 467));
  const snapshot = await page.evaluate(() => window.__TH06_TEST__.advance(1, { x: 192, y: 432 }));
  expect(snapshot.items.some((item) => item.type === 'point')).toBeFalsy();
  expect(snapshot.score).toBe(0);
  expect(errors).toEqual([]);
});

test('Full power collection cancels bullets into point items and shows the full power banner', async ({ page }) => {
  const errors = await ready(page);
  await page.evaluate(() => window.__TH06_TEST__.setStage(1, { power: 127, bombs: 3, alive: true, bulletGrace: 0, x: 192, y: 384 }));
  await page.evaluate(() => window.__TH06_TEST__.spawnEnemyBullet({ x: 192, y: 160, vx: 0, vy: 0 }));
  await page.evaluate(() => window.__TH06_TEST__.spawnItem('power', 192, 384));
  const snapshot = await page.evaluate(() => window.__TH06_TEST__.advance(1, { x: 192, y: 384 }));
  expect(snapshot.power).toBe(128);
  expect(snapshot.bullets.length).toBe(0);
  expect(snapshot.items.some((item) => item.type === 'pointBullet' && item.state === 1)).toBeTruthy();
  expect(snapshot.fullPowerMode).toBeGreaterThan(0);
  expect(errors).toEqual([]);
});

test('enemy bullets preserve original spawn-effect and burst-speed flags', async ({ page }) => {
  const errors = await ready(page);
  const evidence = await page.evaluate(() => {
    const result = { spawn: null, burst: null };
    window.__TH06_TEST__.setStage(1, { power: 128, bulletGrace: 0, x: 192, y: 384 });
    for (let frame = 0; frame < 3600 && (!result.spawn || !result.burst); frame++) {
      const snapshot = window.__TH06_TEST__.advance(1, { x: 192, y: 384, invuln: true });
      for (const bullet of snapshot.bullets) {
        if (!result.spawn && (bullet.flags & 0x0e)) {
          result.spawn = {
            flags: bullet.flags,
            spawnState: bullet.spawnState,
            spawnDuration: bullet.spawnDuration,
            spawnMoveScale: bullet.spawnMoveScale,
            collisionActive: bullet.collisionActive
          };
        }
        const velocity = Math.hypot(bullet.vx, bullet.vy);
        if (!result.burst && (bullet.flags & 1) && bullet.spawnState === 1 && bullet.age <= 16 && velocity > bullet.speed + 0.25) {
          result.burst = {
            flags: bullet.flags,
            age: bullet.age,
            speed: bullet.speed,
            velocity
          };
        }
      }
    }
    return result;
  });

  expect(evidence.spawn, 'stage 1 should produce spawn-effect flagged bullets').toBeTruthy();
  expect(evidence.spawn.spawnDuration).toBeGreaterThan(0);
  expect(evidence.spawn.spawnMoveScale).toBeLessThan(1);
  expect(evidence.spawn.collisionActive).toBe(false);
  expect(evidence.burst, 'stage 1 should produce original flag-1 burst-speed bullets').toBeTruthy();
  expect(evidence.burst.velocity).toBeGreaterThan(evidence.burst.speed);
  expect(errors).toEqual([]);
});
