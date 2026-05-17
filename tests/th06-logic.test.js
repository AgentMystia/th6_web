import assert from 'node:assert/strict';
import test from 'node:test';

await import('../src/vanilla/th06-logic.js');

const { TH06Logic } = globalThis;

test('main difficulty metadata follows original ECL enum order', () => {
  assert.equal(TH06Logic.DEFAULT_DIFFICULTY, 'normal');
  assert.deepEqual(TH06Logic.DIFFICULTY_ORDER, ['easy', 'normal', 'hard', 'lunatic']);
  assert.deepEqual(TH06Logic.MAIN_DIFFICULTIES.map((difficulty) => difficulty.eclIndex), [0, 1, 2, 3]);
  assert.equal(TH06Logic.difficultyIndex('easy'), 0);
  assert.equal(TH06Logic.difficultyIndex('normal'), 1);
  assert.equal(TH06Logic.difficultyIndex('hard'), 2);
  assert.equal(TH06Logic.difficultyIndex('lunatic'), 3);
});

test('ReimuA homing bullet steers toward the last enemy hit during the first 40 frames', () => {
  const bullet = { x: 0, y: 0, vx: 0, vy: -4, speed: 4, homingFrame: 0 };
  TH06Logic.updateHomingBullet(bullet, { x: 80, y: -80 });
  assert.equal(bullet.homingFrame, 1);
  assert.ok(bullet.vx > 0);
  assert.ok(bullet.vy < 0);
  assert.ok(bullet.speed >= 1);
  assert.ok(bullet.speed <= 10);
});

test('ReimuA homing bullet accelerates to 10 after homing expires or target is absent', () => {
  const bullet = { x: 0, y: 0, vx: 0, vy: -5, speed: 5, homingFrame: 40 };
  TH06Logic.updateHomingBullet(bullet, { x: -999, y: -999 });
  assert.equal(bullet.homingFrame, 41);
  assert.ok(bullet.speed > 5);
  assert.ok(bullet.speed <= 10);
  assert.equal(Math.sign(bullet.vy), -1);
});

test('ReimuA Dream Seal bomb keeps original source timing and projectile structure', () => {
  const bomb = TH06Logic.createReimuABomb({ x: 192, y: 384 }, () => 0.5);
  assert.equal(bomb.duration, 300);
  assert.equal(bomb.invuln, 360);
  assert.equal(bomb.projectiles.length, 8);

  const events = { sounds: [], text: 0, clears: 0, cancelBoxes: [], particles: [] };
  const ctx = {
    player: { x: 192, y: 384 },
    lastEnemyHit: { x: -999, y: -999 },
    onClearItems: () => events.clears++,
    onText: () => events.text++,
    onSound: (idx) => events.sounds.push(idx),
    onCancel: () => {},
    onCancelBox: (...args) => events.cancelBoxes.push(args),
    onParticles: (...args) => events.particles.push(args),
    onDamageBox: () => 0,
    onShake: () => {}
  };

  for (let i = 0; i < 80; i++) TH06Logic.updateReimuABomb(bomb, ctx);
  assert.equal(events.clears, 1);
  assert.equal(events.text, 1);
  assert.deepEqual(events.cancelBoxes[0], [192, 384, 256, 256]);
  assert.deepEqual(events.particles[0], [12, 192, 384, 1, 0xff40ffff]);
  assert.deepEqual(events.sounds, [14]);
  assert.equal(bomb.projectiles[0].state, 0);
  assert.equal(bomb.projectiles[1].state, 0);
  assert.ok(!events.sounds.includes(13));

  TH06Logic.updateReimuABomb(bomb, ctx);
  assert.equal(bomb.projectiles[0].state, 0);
  assert.equal(bomb.projectiles[1].state, 1);
  assert.deepEqual(events.sounds, [14, 13]);
});

test('ReimuA Dream Seal explosion applies source damage on the transition frame', () => {
  const bomb = TH06Logic.createReimuABomb({ x: 192, y: 384 }, () => 0.5);
  const events = { sounds: [], damage: [], cancelBoxes: [], particles: [], shake: [] };
  const ctx = {
    player: { x: 192, y: 384 },
    lastEnemyHit: { x: -999, y: -999 },
    onClearItems: () => {},
    onText: () => {},
    onSound: (idx) => events.sounds.push(idx),
    onCancelBox: (...args) => events.cancelBoxes.push(args),
    onParticles: (...args) => events.particles.push(args),
    onDamageBox: (...args) => {
      events.damage.push(args);
      return args[5] === 'bomb' ? 100 : 0;
    },
    onShake: (...args) => events.shake.push(args)
  };

  for (let i = 0; i < 81; i++) TH06Logic.updateReimuABomb(bomb, ctx);
  assert.equal(bomb.projectiles[1].state, 2);
  assert.equal(bomb.projectiles[1].stateFrame, 0);
  assert.deepEqual(events.damage.map((args) => args.slice(2, 6)), [
    [48, 48, 8, 'bomb'],
    [256, 256, 200, 'bombExplosion']
  ]);
  assert.deepEqual(events.cancelBoxes.at(-1), [192, 384, 256, 256]);
  assert.deepEqual(events.sounds, [14, 13, 15]);
  assert.deepEqual(events.shake, [[16, 8]]);
  assert.ok(events.particles.some((args) => args[0] === 6 && args[3] === 8));
});

test('ReimuA Dream Seal projectile steers toward the previous frame enemy hit', () => {
  const bomb = TH06Logic.createReimuABomb({ x: 192, y: 384 }, () => 0.5);
  const ctx = {
    player: { x: 192, y: 384 },
    lastEnemyHit: { x: 320, y: 320 },
    onClearItems: () => {},
    onText: () => {},
    onSound: () => {},
    onCancel: () => {},
    onCancelBox: () => {},
    onDamageBox: () => 0,
    onShake: () => {}
  };

  for (let i = 0; i <= 80; i++) TH06Logic.updateReimuABomb(bomb, ctx);
  const projectile = bomb.projectiles[1];
  assert.equal(projectile.state, 1);
  assert.ok(projectile.vx > 0);
  assert.ok(projectile.vy < 0);
  assert.ok(projectile.x > 192);
  assert.ok(projectile.y < 384);
});

test('other player bombs use source durations, invulnerability and damage cadence', () => {
  const player = { x: 192, y: 384 };
  const reimuB = TH06Logic.createReimuBBomb(player);
  const marisaA = TH06Logic.createMarisaABomb(player);
  const marisaB = TH06Logic.createMarisaBBomb(player);
  assert.deepEqual([reimuB.duration, reimuB.invuln], [140, 200]);
  assert.deepEqual([marisaA.duration, marisaA.invuln], [250, 300]);
  assert.deepEqual([marisaB.duration, marisaB.invuln], [300, 360]);

  const events = { damage: [], cancelBox: 0, sound: [] };
  const ctx = {
    player,
    onClearItems: () => {},
    onText: () => {},
    onSound: (idx) => events.sound.push(idx),
    onShake: () => {},
    onCancel: () => {},
    onCancelBox: () => events.cancelBox++,
    onDamageBox: (...args) => events.damage.push(args)
  };
  TH06Logic.updateReimuBBomb(reimuB, ctx);
  assert.deepEqual(events.sound, [14, 6]);
  assert.equal(events.damage.length, 0);
  TH06Logic.updateReimuBBomb(reimuB, ctx);
  assert.equal(events.damage.length, 4);
  assert.equal(events.damage[0][4], 8);

  events.damage.length = 0;
  TH06Logic.updateMarisaABomb(marisaA, ctx);
  TH06Logic.updateMarisaABomb(marisaA, ctx);
  assert.equal(events.damage.length, 8);
  assert.equal(events.damage[0][2], 128);
  assert.equal(events.damage[0][4], 8);

  events.damage.length = 0;
  TH06Logic.updateMarisaBBomb(marisaB, ctx);
  TH06Logic.updateMarisaBBomb(marisaB, ctx);
  assert.equal(events.damage.length, 1);
  assert.deepEqual(events.damage[0].slice(0, 5), [192, 192, 384, 384, 12]);
});

test('homing target follows the bottom-most damageable enemy like EnemyManager', () => {
  const target = TH06Logic.chooseHomingTarget([
    { x: 40, y: 120, hp: 10 },
    { x: 140, y: 260, hp: 0 },
    { x: 200, y: 180, hp: 20, ecl: { canTakeDamage: false } },
    { x: 260, y: 320, hp: 20, ecl: { seen: false, canTakeDamage: true } },
    { x: 280, y: 300, hp: 20, ecl: { seen: true, canTakeDamage: true, interactable: false } },
    { x: 300, y: 240, hp: 20, ecl: { seen: true, canTakeDamage: true } }
  ]);
  assert.deepEqual(target, { x: 300, y: 240 });
});

test('enemy damage uses original per-enemy frame cap and bomb shot reduction', () => {
  assert.equal(TH06Logic.capEnemyFrameDamage(69), 69);
  assert.equal(TH06Logic.capEnemyFrameDamage(71), 70);
  assert.equal(TH06Logic.playerShotDamageForEnemy(48, false), 48);
  assert.equal(TH06Logic.playerShotDamageForEnemy(48, true), 16);
  assert.equal(TH06Logic.playerShotDamageForEnemy(1, true), 1);
});

test('spellcard damage reduction is applied after the original frame cap', () => {
  assert.equal(TH06Logic.spellcardDamageForEnemy(70, false, false), 10);
  assert.equal(TH06Logic.spellcardDamageForEnemy(7, false, false), 1);
  assert.equal(TH06Logic.spellcardDamageForEnemy(70, true, true), 23);
  assert.equal(TH06Logic.spellcardDamageForEnemy(3, true, true), 1);
  assert.equal(TH06Logic.spellcardDamageForEnemy(70, true, false), 0);
});

test('original sound effect duplicate table exposes all 32 sound ids', () => {
  assert.equal(TH06Logic.SFX_BUFFER_IDX_VOLUME.length, 32);
  assert.deepEqual(TH06Logic.SFX_BUFFER_IDX_VOLUME[13].slice(0, 2), [11, -1200]);
  assert.deepEqual(TH06Logic.SFX_BUFFER_IDX_VOLUME[29].slice(0, 2), [23, -500]);
});

test('player base system constants match EOSD source values', () => {
  assert.deepEqual(TH06Logic.PLAYER_SYSTEM.hitboxHalf, { x: 1.25, y: 1.25, z: 5 });
  assert.equal(TH06Logic.PLAYER_SYSTEM.grazePadding, 20);
  assert.equal(TH06Logic.ENEMY_BULLET_CAP, 640);
  assert.deepEqual(TH06Logic.PLAYER_SYSTEM.movementArea, { x: 8, y: 16, width: 368, height: 416 });
  assert.deepEqual(TH06Logic.PLAYER_SYSTEM.speeds.reimu, { normal: 4, focus: 2 });
  assert.deepEqual(TH06Logic.PLAYER_SYSTEM.speeds.marisa, { normal: 5, focus: 2.5 });
});

test('item power and point scoring follows ItemManager source values', () => {
  const small = TH06Logic.collectPowerItem(7, 0, 1);
  assert.equal(small.power, 8);
  assert.equal(small.score, 10);
  assert.equal(small.powerUp, true);

  const big = TH06Logic.collectPowerItem(72, 0, 8);
  assert.equal(big.power, 80);
  assert.equal(big.score, 10);
  assert.equal(big.powerUp, true);

  const maxed = TH06Logic.collectPowerItem(128, 0, 8);
  assert.equal(maxed.power, 128);
  assert.equal(maxed.powerItemCountForScore, 8);
  assert.equal(maxed.score, TH06Logic.POWER_ITEM_SCORE[8]);

  assert.equal(TH06Logic.pointItemScore(100, 'lunatic'), 200000);
  assert.equal(TH06Logic.pointItemScore(128, 'lunatic'), 150000);
  assert.equal(TH06Logic.pointItemScore(448, 'lunatic'), 63600);
  assert.equal(TH06Logic.pointBulletScore(188, false), 1120);
  assert.equal(TH06Logic.pointBulletScore(188, true), 100);
});

test('miss compensation item list matches Player.cpp death handling', () => {
  assert.deepEqual(TH06Logic.missPowerDrops(2), ['bigPower', 'power', 'power', 'power', 'power', 'power']);
  assert.deepEqual(TH06Logic.missPowerDrops(0), ['fullPower', 'fullPower', 'fullPower', 'fullPower', 'fullPower']);
});

test('spellcard bonus table and formula follow EclManager source values', () => {
  assert.equal(TH06Logic.SPELLCARD_SCORE.length, 64);
  assert.equal(TH06Logic.SPELLCARD_SCORE[0], 200000);
  assert.equal(TH06Logic.SPELLCARD_SCORE[32], 400000);
  assert.equal(TH06Logic.spellcardBonus(0, 19), 580000);
});

test('score extend thresholds expose the original EOSD non-Extra table', () => {
  assert.deepEqual(TH06Logic.EXTRA_LIFE_SCORES, [10000000, 20000000, 40000000, 60000000, 1900000000]);
  assert.equal(TH06Logic.MAX_SCORE, 999999999);
  assert.equal(TH06Logic.MAX_LIVES, 8);
});

test('stage clear bonus follows Gui stage result formula', () => {
  assert.equal(TH06Logic.pointItemScore(128, 'easy'), 60000);
  assert.equal(TH06Logic.pointItemScore(128, 'normal'), 60000);
  assert.equal(TH06Logic.pointItemScore(128, 'hard'), 100000);
  assert.equal(TH06Logic.pointItemScore(128, 'lunatic'), 150000);
  assert.equal(TH06Logic.stageClearBonus({
    stageNumber: 2,
    power: 64,
    graze: 30,
    pointItems: 12,
    difficulty: 'easy'
  }), 52200);
  assert.equal(TH06Logic.stageClearBonus({
    stageNumber: 2,
    power: 64,
    graze: 30,
    pointItems: 12,
    difficulty: 'normal'
  }), 104400);
  assert.equal(TH06Logic.stageClearBonus({
    stageNumber: 2,
    power: 64,
    graze: 30,
    pointItems: 12,
    difficulty: 'hard'
  }), 125280);
  assert.equal(TH06Logic.stageClearBonus({
    stageNumber: 2,
    power: 64,
    graze: 30,
    pointItems: 12,
    difficulty: 'lunatic'
  }), 156600);
  assert.equal(TH06Logic.spellName(5), '冻符「完美冻结」');
  assert.equal(TH06Logic.stageMeta(2).bossName, '琪露诺');
  assert.equal(TH06Logic.stageMeta(2).bossDisplayName, 'Cirno');
  assert.equal(TH06Logic.stageMeta(2).midbossName, '大妖精');
  assert.equal(TH06Logic.stageMeta(2).midbossDisplayName, 'Daiyousei');
  assert.equal(TH06Logic.stageMeta(2).title.primary, '第二关');
  assert.equal(TH06Logic.localizeDialogueText('チルノ'), '琪露诺');
  assert.equal(TH06Logic.localizeDialogueText('この湖こんなに広かったかしら？'), '这湖有这么宽吗？');
});

test('rank and shoot interval helpers match GameManager and Enemy source formulas', () => {
  assert.deepEqual(TH06Logic.adjustRankState(16, 96, 6, 'lunatic'), { rank: 17, subRank: 2 });
  assert.deepEqual(TH06Logic.adjustRankState(16, 0, -200, 'lunatic'), { rank: 14, subRank: 0 });
  assert.equal(TH06Logic.shootIntervalForRank(120, 16), 120);
  assert.equal(TH06Logic.shootIntervalForRank(120, 32), 96);
  assert.equal(TH06Logic.shootIntervalForRank(120, 10), 129);
});

test('enemy bullet graze size table follows EOSD BulletManager rules', () => {
  assert.deepEqual(TH06Logic.bulletGrazeSize(2, 16), { x: 4, y: 4 });
  assert.deepEqual(TH06Logic.bulletGrazeSize(4, 16), { x: 5, y: 5 });
  assert.deepEqual(TH06Logic.bulletGrazeSize(3, 16), { x: 6, y: 6 });
  assert.deepEqual(TH06Logic.bulletGrazeSize(7, 32), { x: 11, y: 11 });
  assert.deepEqual(TH06Logic.bulletGrazeSize(8, 32), { x: 9, y: 9 });
});
