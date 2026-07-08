import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';

mkdirSync('tests/.build', { recursive: true });
execSync('npx esbuild src/game/cherry.ts --bundle --format=esm --outfile=tests/.build/cherry.mjs --log-level=silent');
const { CherrySystem, BORDER_DURATION, CHERRY_PLUS_MAX } = await import('../tests/.build/cherry.mjs');

test('border triggers at 50000 cherry+ and survives with bonus', () => {
  const events = [];
  const c = new CherrySystem({
    onBorderStart: () => events.push('start'),
    onBorderEnd: (r) => events.push(r)
  });
  for (let i = 0; i < CHERRY_PLUS_MAX / 2; i++) c.onShotHit(false);
  assert.equal(c.borderActive, true);
  assert.equal(c.cherryPlus, 0);
  assert.equal(c.cherry, 50000);
  let bonus = 0;
  for (let i = 0; i < BORDER_DURATION; i++) bonus += c.tick();
  assert.equal(c.borderActive, false);
  assert.equal(c.cherryMax, 60000);
  assert.equal(bonus, 500000);
  assert.deepEqual(events, ['start', 'survived']);
});

test('border break absorbs hit, no bonus, cherry+ resets', () => {
  const c = new CherrySystem();
  for (let i = 0; i < CHERRY_PLUS_MAX / 2; i++) c.onShotHit(false);
  assert.equal(c.borderActive, true);
  assert.equal(c.breakBorder(), true);
  assert.equal(c.borderActive, false);
  assert.equal(c.cherryMax, 50000);
  assert.equal(c.cherryPlus, 0);
  assert.equal(c.breakBorder(), false);
});

test('border grazes raise cherry max by 30/80', () => {
  const c = new CherrySystem();
  for (let i = 0; i < CHERRY_PLUS_MAX / 2; i++) c.onShotHit(false);
  c.onGraze(true);
  c.onGraze(false);
  assert.equal(c.cherryMax, 50110);
});

test('cherry item gain scales with captured spells; score gated on max', () => {
  const c = new CherrySystem();
  assert.equal(c.cherryItemGain(), 1000);
  c.onSpellCapture();
  c.onSpellCapture();
  assert.equal(c.cherryItemGain(), 1200);
  assert.equal(c.cherryItemScore(100, 128, false), 0); // not at max
  c.cherry = c.cherryMax;
  assert.equal(c.cherryItemScore(100, 128, false), 50000);
});

// Th07.exe (v1.00b) fcn.00430c10 @ 0x431358: below the PoC line, a cherry
// item at CherryMax decays by a flat -100 score per pixel of distance from
// the PoC line (not proportional to remaining playfield height), floored
// to the nearest 10.
test('cherry item score below the PoC line decays 100/px, floored to 10 (exe @ 0x431358)', () => {
  const c = new CherrySystem();
  c.cherry = c.cherryMax;
  assert.equal(c.cherryItemScore(228, 128, false), 40000); // 50000 - 100*100
  assert.equal(c.cherryItemScore(130, 128, false), 49800); // 50000 - 100*2
  assert.equal(c.cherryItemScore(133, 128, false), 49500); // 50000 - 100*5
  assert.equal(c.cherryItemScore(128, 128, false), 50000); // at the line: flat
  assert.equal(c.cherryItemScore(400, 128, false), 22800); // 50000 - 100*272
});

test('death loses the SHT ratio; cherry never exceeds max', () => {
  const c = new CherrySystem();
  for (let i = 0; i < 30000; i++) c.onShotHit(false);
  assert.equal(c.cherry, 50000); // capped at max
  c.onDeath(0.5);
  assert.equal(c.cherry, 25000);
  assert.equal(c.cherryPlus, 0);
});

test('point item value equals cherry above the PoC line', () => {
  const c = new CherrySystem();
  c.cherry = 34560;
  assert.equal(c.pointItemValue(100, 128, false), 34560);
  assert.ok(c.pointItemValue(400, 128, false) < 34560);
});
