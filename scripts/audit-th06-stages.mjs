import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

await import('../src/vanilla/th06-logic.js');
await import('../src/vanilla/th06-data.js');
await import('../src/vanilla/th06-effects-data.js');
await import('../src/vanilla/th06-runtime.js');

const { TH06Logic, TH06_EMBEDDED_DATA, Th06StageRuntime } = globalThis;
const runtimeSource = readFileSync(new URL('../src/vanilla/th06-runtime.js', import.meta.url), 'utf8');
const mainSource = readFileSync(new URL('../src/vanilla/main.js', import.meta.url), 'utf8');
const logicSource = readFileSync(new URL('../src/vanilla/th06-logic.js', import.meta.url), 'utf8');
const MAIN_DIFFICULTIES = TH06Logic.DIFFICULTY_ORDER;
const hasReference = existsSync(new URL('../reference/ECL/ecldata1.decl', import.meta.url))
  && existsSync(new URL('../reference/th06-master/src/Player.cpp', import.meta.url));

class AuditRng {
  constructor(seed = 0x1527) {
    this.seed = seed & 0xffff;
  }
  u16() {
    const a = ((this.seed ^ 0x9630) - 0x6553) & 0xffff;
    this.seed = ((((a & 0xc000) >> 14) + a * 4) & 0xffff) >>> 0;
    return this.seed;
  }
  u32() {
    return (((this.u16() << 16) | this.u16()) >>> 0);
  }
  u16InRange(range) {
    return range ? this.u16() % range : 0;
  }
  u32InRange(range) {
    return range ? this.u32() % range : 0;
  }
  f() {
    return this.u32() / 0xffffffff;
  }
  range(v) {
    return this.f() * v;
  }
  between(a, b) {
    return a + (b - a) * this.f();
  }
}

function handledEclOpcodes() {
  const runEclStart = runtimeSource.indexOf('    runEcl(game, e) {');
  const enterSubStart = runtimeSource.indexOf('    enterSub(s, subId', runEclStart);
  assert.notEqual(runEclStart, -1, 'runtime ECL interpreter start not found');
  assert.notEqual(enterSubStart, -1, 'runtime ECL interpreter end not found');
  const eclInterpreterSource = runtimeSource.slice(runEclStart, enterSubStart);
  const handled = new Set([
    0,
    ...[...eclInterpreterSource.matchAll(/op === (\d+)/g)].map((m) => Number(m[1])),
    ...[...eclInterpreterSource.matchAll(/op >= (\d+) && op <= (\d+)/g)].flatMap((m) => {
      const out = [];
      for (let i = Number(m[1]); i <= Number(m[2]); i++) out.push(i);
      return out;
    })
  ]);
  return handled;
}

function eclSubOpcodes(runtime, stage) {
  const used = new Set();
  const v = runtime.ecl.view;
  for (let subId = 0; subId < runtime.ecl.subOffsets.length; subId++) {
    let off = runtime.ecl.subOffsets[subId];
    const seen = new Set();
    for (let guard = 0; off && off + 8 <= v.bytes.length && guard < 8192; guard++) {
      assert.equal(seen.has(off), false, `Stage ${stage} ECL sub ${subId} loops while scanning bytecode`);
      seen.add(off);
      const time = v.i32(off);
      const op = v.i16(off + 4);
      const size = v.i16(off + 6);
      if (time < 0 || op < 0) break;
      assert.ok(size > 0, `Stage ${stage} ECL sub ${subId} has invalid instruction size`);
      used.add(op);
      off += size;
    }
  }
  return used;
}

function assertFinite(label, value) {
  assert.equal(Number.isFinite(value), true, `${label} is not finite: ${value}`);
}

function makeGame(stage, runtime, options = {}) {
  const items = [];
  const spells = [];
  const spellEnds = [];
  const effects = [];
  const dialogues = [];
  const rng = new AuditRng(options.seed ?? (0x1527 + stage * 17));
  return {
    id: 1,
    rank: 16,
    difficulty: options.difficulty ?? TH06Logic.DEFAULT_DIFFICULTY,
    stageFrame: 0,
    power: options.power ?? 128,
    score: 0,
    enemies: [],
    enemyBullets: [],
    enemyLasers: [],
    items,
    effects,
    rng,
    player: { x: options.x ?? 192, y: options.y ?? 400 },
    stageMeta: TH06Logic.stageMeta(stage),
    spellcardInfo: { isActive: false, isCapturing: false, usedBomb: false },
    spec() { return { family: 'reimu', id: 'reimuA' }; },
    addScore(points) { this.score += Math.trunc(points || 0); },
    setBossLives() {},
    setBossPresent() {},
    setBossLifeCount() {},
    startBossSpell(id) {
      const name = TH06Logic.spellName(id);
      spells.push({ frame: this.stageFrame, id, name });
      this.spellcardInfo = { isActive: true, isCapturing: true, usedBomb: false, idx: id };
      return name;
    },
    endBossSpell() {
      spellEnds.push({ frame: this.stageFrame, idx: this.spellcardInfo?.idx ?? -1 });
      this.spellcardInfo = { isActive: false, isCapturing: false, usedBomb: false };
    },
    spawnLaser(laser) { this.enemyLasers.push(laser); },
    spawnEffectParticles(effectId, x, y, count = 1, color = 0xffffffff) {
      for (let i = 0; i < count; i++) effects.push({ effectId, x, y, color });
    },
    spawnSpellEffect(effectId, x, y, count = 1, color = 0xffffffff) {
      for (let i = 0; i < count; i++) effects.push({ effectId, x, y, color, spell: true });
    },
    requestDialogue(index) { dialogues.push({ frame: this.stageFrame, index }); },
    startDialogue(index, instrs) { dialogues.push({ frame: this.stageFrame, index, instrs: instrs?.length ?? 0 }); },
    consumeDialogueResume() { return true; },
    isDialogueBlocking() { return false; },
    turnBulletsIntoPointItems() {
      for (const bullet of this.enemyBullets) this.spawnItem('pointBullet', bullet.x, bullet.y, { state: 1 });
      this.enemyBullets = [];
      this.enemyLasers = [];
    },
    text() {},
    audio: { sfx() {} },
    spawnItem(type, x, y, options = {}) {
      const item = { type, x, y, state: options.state ?? 0 };
      this.items.push(item);
      return item;
    },
    audit: { items, spells, spellEnds, effects, dialogues, runtime }
  };
}

function stepStage(stage, options = {}) {
  const data = TH06_EMBEDDED_DATA.games.th06.stages[stage];
  const runtime = new Th06StageRuntime(data);
  const game = makeGame(stage, runtime, options);
  const maxFrame = options.frames ?? (TH06Logic.stageMeta(stage).presentation.clearAfterFrame + 7200);
  const visibleMissingSprites = [];
  let enemyCountMax = 0;
  let bulletCountMax = 0;
  let laserCountMax = 0;

  for (let frame = 0; frame <= maxFrame; frame++) {
    game.stageFrame = frame;
    globalThis.__touhouGameRank = game.rank;
    globalThis.__touhouPlayerX = game.player.x;
    globalThis.__touhouPlayerY = game.player.y;
    globalThis.__touhouShotType = 0;
    runtime.update(game);

    for (const enemy of [...game.enemies]) {
      enemy.frame = (enemy.frame || 0) + 1;
      if (enemy.ecl) runtime.updateEnemy(game, enemy);
      assertFinite(`stage ${stage} enemy x`, enemy.x);
      assertFinite(`stage ${stage} enemy y`, enemy.y);
      assertFinite(`stage ${stage} enemy z`, enemy.z);
      const onScreen = enemy.x > -32 && enemy.x < 416 && enemy.y > -48 && enemy.y < 480;
      if (onScreen && enemy.ecl && !enemy.ecl.invisible && !runtime.enemyRect(enemy)) {
        visibleMissingSprites.push({ frame, subId: enemy.ecl.subId, anm: enemy.ecl.currentAnm });
      }
      if (
        (options.killDamageable || (options.killNonBoss && !enemy.ecl?.isBoss)) &&
        enemy.ecl?.canTakeDamage !== false &&
        enemy.hp > 0
      ) {
        enemy.hp = 0;
      }
      if (
        options.killBossAfterFrames != null &&
        enemy.ecl?.isBoss &&
        enemy.ecl.canTakeDamage !== false &&
        enemy.ecl.interactable !== false &&
        enemy.ecl.bossTimer >= options.killBossAfterFrames &&
        enemy.hp > 0
      ) {
        const threshold = enemy.ecl.lifeCallbackThreshold;
        enemy.hp = threshold > 0 ? Math.min(enemy.hp, threshold - 1) : 0;
      }
      if (enemy.hp <= 0) {
        const keep = runtime.killEnemy(game, enemy);
        if (!keep) enemy.dead = true;
      }
    }
    game.enemies = game.enemies.filter((enemy) => !enemy.dead);

    for (const bullet of game.enemyBullets) {
      assertFinite(`stage ${stage} bullet x`, bullet.x);
      assertFinite(`stage ${stage} bullet y`, bullet.y);
      assertFinite(`stage ${stage} bullet vx`, bullet.vx);
      assertFinite(`stage ${stage} bullet vy`, bullet.vy);
      assert.ok(bullet.rect, `stage ${stage} bullet missing original ANM rect`);
      assert.ok(bullet.grazeSize?.x > 0 && bullet.grazeSize?.y > 0, `stage ${stage} bullet missing graze AABB`);
    }
    for (const laser of game.enemyLasers) {
      assertFinite(`stage ${stage} laser x`, laser.x);
      assertFinite(`stage ${stage} laser y`, laser.y);
      assertFinite(`stage ${stage} laser angle`, laser.angle);
    }

    enemyCountMax = Math.max(enemyCountMax, game.enemies.length);
    bulletCountMax = Math.max(bulletCountMax, game.enemyBullets.length);
    laserCountMax = Math.max(laserCountMax, game.enemyLasers.length);
    assert.ok(game.enemyBullets.length <= TH06Logic.ENEMY_BULLET_CAP, `stage ${stage} exceeds enemy bullet cap`);
  }

  const itemCounts = {};
  for (const item of game.audit.items) itemCounts[item.type] = (itemCounts[item.type] || 0) + 1;

  return {
    difficulty: game.difficulty,
    stage,
    frames: maxFrame,
    enemiesMax: enemyCountMax,
    bulletsMax: bulletCountMax,
    lasersMax: laserCountMax,
    spells: game.audit.spells,
    spellEnds: game.audit.spellEnds,
    effects: game.audit.effects,
    dialogues: game.audit.dialogues,
    items: itemCounts,
    missingSprites: visibleMissingSprites
  };
}

function spellSubroutines(runtime) {
  const out = [];
  const v = runtime.ecl.view;
  for (let subId = 0; subId < runtime.ecl.subOffsets.length; subId++) {
    let off = runtime.ecl.subOffsets[subId];
    const seen = new Set();
    for (let guard = 0; off && off + 12 <= v.bytes.length && guard < 1024; guard++) {
      if (seen.has(off)) break;
      seen.add(off);
      const time = v.i32(off);
      const op = v.i16(off + 4);
      const size = v.i16(off + 6);
      if (time < 0 || op < 0 || size <= 0) break;
      if (op === 93) {
        out.push({ subId, spellId: v.i16(off + 14) });
        break;
      }
      off += size;
    }
  }
  return out;
}

function auditDirectSpellSubroutines() {
  const report = [];
  for (const difficulty of MAIN_DIFFICULTIES) {
    const maxStage = difficulty === 'easy' ? 5 : 6;
    for (let stage = 1; stage <= maxStage; stage++) {
    const data = TH06_EMBEDDED_DATA.games.th06.stages[stage];
    const runtime = new Th06StageRuntime(data);
    const spells = spellSubroutines(runtime);
    assert.ok(spells.length > 0, `Stage ${stage} exposes no spell subroutines`);
    const covered = new Set();
    for (const spell of spells) {
      for (const shotType of [0, 1, 2, 3]) {
        const game = makeGame(stage, runtime, { difficulty, seed: 0x3000 + stage * 113 + spell.subId + shotType * 409 });
        const enemy = {
          id: game.id++,
          kind: 'boss',
          x: 192,
          y: 96,
          z: 0,
          hp: 999999,
          maxHp: 999999,
          score: 0,
          radius: 24,
          frame: 0,
          ecl: runtime.makeEnemyState(spell.subId, false, -1)
        };
        game.enemies.push(enemy);
        for (let frame = 0; frame < 2400; frame++) {
          game.stageFrame = frame;
          globalThis.__touhouGameRank = game.rank;
          globalThis.__touhouPlayerX = game.player.x;
          globalThis.__touhouPlayerY = game.player.y;
          globalThis.__touhouShotType = shotType;
          enemy.frame++;
          runtime.updateEnemy(game, enemy);
        }
        const activeSpellIds = game.audit.spells.map((entry) => entry.id);
        if (activeSpellIds.length === 0) continue;
        assert.ok(game.enemyBullets.length <= TH06Logic.ENEMY_BULLET_CAP, `${difficulty} Stage ${stage} spell ${spell.spellId} exceeds bullet cap`);
        for (const bullet of game.enemyBullets) {
          assertFinite(`${difficulty} stage ${stage} spell ${spell.spellId} bullet vx`, bullet.vx);
          assertFinite(`${difficulty} stage ${stage} spell ${spell.spellId} bullet vy`, bullet.vy);
          assert.ok(bullet.rect, `${difficulty} stage ${stage} spell ${spell.spellId} bullet missing rect`);
          assert.ok(bullet.grazeSize?.x > 0 && bullet.grazeSize?.y > 0, `${difficulty} stage ${stage} spell ${spell.spellId} bullet missing graze size`);
        }
        for (const id of activeSpellIds) covered.add(id);
      }
    }
    assert.ok(covered.size > 0, `${difficulty} Stage ${stage} direct spell execution covered no active spell`);
    report.push({
      difficulty,
      stage,
      subroutines: spells.length,
      spellIds: [...covered].sort((a, b) => a - b)
    });
  }
  }
  return report;
}

function auditTimelineSpawnData() {
  const allowedItemDrops = new Set([0, 1, 2, 3, 4, 5, 6, -1, -2]);
  const report = [];
  for (let stage = 1; stage <= 6; stage++) {
    const data = TH06_EMBEDDED_DATA.games.th06.stages[stage];
    const runtime = new Th06StageRuntime(data);
    const spawns = runtime.ecl.timeline.filter((evt) => evt.op >= 0 && evt.op <= 7);
    assert.ok(spawns.length > 0, `Stage ${stage} has no timeline enemy spawns`);
    let bossLike = 0;
    let totalHp = 0;
    for (const evt of spawns) {
      assert.ok(runtime.ecl.subOffsets[evt.arg0] != null, `Stage ${stage} spawn references missing ECL sub ${evt.arg0}`);
      assert.ok((evt.life | 0) > 0 || [1, 3, 5, 7].includes(evt.op), `Stage ${stage} spawn ${evt.arg0} has non-positive HP`);
      assert.ok((evt.score | 0) >= 0 || [1, 3, 5, 7].includes(evt.op), `Stage ${stage} spawn ${evt.arg0} has negative score`);
      assert.ok(allowedItemDrops.has(evt.item), `Stage ${stage} spawn ${evt.arg0} has unknown item drop ${evt.item}`);
      totalHp += evt.life >= 0 ? evt.life | 0 : 1;
      if (evt.arg0 >= 8) bossLike++;
    }
    const bossWaits = runtime.ecl.timeline.filter((evt) => evt.op === 12).length;
    assert.ok(bossWaits > 0, `Stage ${stage} has no original boss wait timeline opcode`);
    report.push({ stage, spawns: spawns.length, bossLike, bossWaits, totalHp });
  }
  return report;
}

function auditGameplayRuleSources() {
  if (!hasReference) return { skipped: true };
  const itemSource = readFileSync(new URL('../reference/th06-master/src/ItemManager.cpp', import.meta.url), 'utf8');
  const bulletSource = readFileSync(new URL('../reference/th06-master/src/BulletManager.cpp', import.meta.url), 'utf8');
  const guiSource = readFileSync(new URL('../reference/th06-master/src/Gui.cpp', import.meta.url), 'utf8');
  assert.match(itemSource, /void ItemManager::RemoveAllItems\(\)[\s\S]*?cursor->state = 1;/);
  assert.match(itemSource, /g_BulletManager\.TurnAllBulletsIntoPoints\(\);[\s\S]*?g_Gui\.ShowFullPowerMode\(0\);/);
  assert.match(bulletSource, /void BulletManager::TurnAllBulletsIntoPoints\(\)[\s\S]*?RemoveAllBullets\(true\);/);
  assert.match(guiSource, /Full Power Mode!!/);
  assert.match(mainSource, /onClearItems: \(\) => this\.attractAllItems\(\)/);
  assert.match(mainSource, /showFullPowerMode\(\)/);
  assert.match(mainSource, /turnBulletsIntoPointItems\(\);[\s\S]*?this\.showFullPowerMode\(\);/);
  assert.match(runtimeSource, /isTimelineComplete\(\)/);
  assert.match(mainSource, /timelineComplete && !boss && this\.enemies\.length === 0/);
  return { skipped: false };
}

function auditReferences() {
  if (!hasReference) return { skipped: true };
  const handled = handledEclOpcodes();
  const allowedTimelineOpcodes = new Set([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  const stageReports = [];
  for (let stage = 1; stage <= 6; stage++) {
    const data = TH06_EMBEDDED_DATA.games.th06.stages[stage];
    const runtime = new Th06StageRuntime(data);
    const eclOpcodes = [...eclSubOpcodes(runtime, stage)].sort((a, b) => a - b);
    const missing = eclOpcodes.filter((op) => !handled.has(op));
    assert.deepEqual(missing, [], `Stage ${stage} has unhandled original ECL opcodes`);
    const timelineOpcodes = [...new Set(runtime.ecl.timeline.map((evt) => evt.op))].sort((a, b) => a - b);
    const unknownTimelineOpcodes = timelineOpcodes.filter((op) => !allowedTimelineOpcodes.has(op));
    assert.deepEqual(unknownTimelineOpcodes, [], `Stage ${stage} has unhandled original ECL timeline opcodes`);
    stageReports.push({ stage, eclOpcodes, timelineOpcodes });
  }

  const playerSource = readFileSync(new URL('../reference/th06-master/src/Player.cpp', import.meta.url), 'utf8');
  const bulletHeader = readFileSync(new URL('../reference/th06-master/src/BulletManager.hpp', import.meta.url), 'utf8');
  assert.match(playerSource, /p->hitboxSize\.x = 1\.25;/);
  assert.match(playerSource, /p->hitboxSize\.y = 1\.25;/);
  assert.match(playerSource, /bulletTopLeft\.x = center->x - size->x \/ 2\.0f - 20\.0f;/);
  assert.match(bulletHeader, /Bullet bullets\[640\];/);
  assert.match(mainSource, /const PLAYER_HITBOX_HALF = \{ x: 1\.25, y: 1\.25, z: 5 \};/);
  assert.match(mainSource, /const PLAYER_GRAZE_PADDING = 20;/);
  assert.match(logicSource, /const ENEMY_BULLET_CAP = 640;/);
  return { skipped: false, stages: stageReports };
}

function auditEmbeddedData() {
  for (let stage = 1; stage <= 6; stage++) {
    const data = TH06_EMBEDDED_DATA.games.th06.stages[stage];
    assert.equal(data.stageNumber, stage);
    assert.equal(data.assets.stageBgKey, `stg${stage}bg`);
    assert.equal(data.assets.enemyKey, `stg${stage}enm`);
    assert.ok(data.assets.effectKey);
    const runtime = new Th06StageRuntime(data);
    assert.ok(runtime.ecl.timeline.length > 0, `Stage ${stage} timeline is empty`);
    assert.ok(runtime.std.objects.some((object) => object.quads.length > 0), `Stage ${stage} STD quads are empty`);
    const effect = runtime.effectFrame(16, 30, 0, 0xffffffff);
    assert.equal(effect.imageKey, data.assets.effectImageKey);
  }
}

function auditFullStages() {
  const natural = [];
  const phaseRuns = [];
  const allKill = [];
  for (const difficulty of MAIN_DIFFICULTIES) {
    const maxStage = difficulty === 'easy' ? 5 : 6;
    for (let stage = 1; stage <= maxStage; stage++) {
    const stageResult = stepStage(stage, { difficulty });
    assert.deepEqual(stageResult.missingSprites, [], `${difficulty} Stage ${stage} has visible enemies without source sprite`);
    assert.ok(stageResult.enemiesMax > 0, `${difficulty} Stage ${stage} spawned no enemies`);
    assert.ok(stageResult.bulletsMax + stageResult.lasersMax > 0, `${difficulty} Stage ${stage} spawned no enemy fire`);
    assert.ok(stageResult.effects.length > 0, `${difficulty} Stage ${stage} spawned no effects`);

    const phaseResult = stepStage(stage, {
      difficulty,
      killNonBoss: true,
      killBossAfterFrames: 540,
      frames: TH06Logic.stageMeta(stage).presentation.clearAfterFrame + 9000
    });
    const uniqueSpells = [...new Set(phaseResult.spells.map((entry) => entry.id))];
    natural.push(stageResult);
    phaseRuns.push({ ...phaseResult, spells: uniqueSpells });

    const killResult = stepStage(stage, { difficulty, killDamageable: true, power: 0, frames: TH06Logic.stageMeta(stage).presentation.clearAfterFrame + 900 });
    assert.deepEqual(killResult.missingSprites, [], `${difficulty} Stage ${stage} all-kill has visible enemies without source sprite`);
    allKill.push(killResult);
  }
  }

  const sourceDropsOnly = (items) => Object.fromEntries(Object.entries(items).filter(([type]) => type !== 'pointBullet'));
  const lunaticStage1 = allKill.find((stage) => stage.difficulty === 'lunatic' && stage.stage === 1);
  const lunaticStage2 = allKill.find((stage) => stage.difficulty === 'lunatic' && stage.stage === 2);
  assert.deepEqual(sourceDropsOnly(lunaticStage1.items), { bigPower: 4, point: 32, power: 59 });
  assert.equal(sourceDropsOnly(lunaticStage2.items).bomb, 1);
  assert.equal(sourceDropsOnly(lunaticStage2.items).life || 0, 0);

  const stage5Spells = phaseRuns.filter((stage) => stage.stage === 5);
  for (const difficulty of ['easy', 'normal']) {
    const run = stage5Spells.find((stage) => stage.difficulty === difficulty);
    assert.ok(run.spells.includes(32), `${difficulty} Stage 5 should use Misdirection`);
    assert.ok(run.spells.includes(36), `${difficulty} Stage 5 should use Manipulating Doll`);
    assert.equal(run.spells.includes(33), false, `${difficulty} Stage 5 should not use Illusion Misdirection`);
    assert.equal(run.spells.includes(39), false, `${difficulty} Stage 5 should not use Killing Doll`);
  }
  for (const difficulty of ['hard', 'lunatic']) {
    const run = stage5Spells.find((stage) => stage.difficulty === difficulty);
    assert.ok(run.spells.includes(33), `${difficulty} Stage 5 should use Illusion Misdirection`);
    assert.ok(run.spells.includes(39), `${difficulty} Stage 5 should use Killing Doll`);
    assert.equal(run.spells.includes(32), false, `${difficulty} Stage 5 should not use Misdirection`);
    assert.equal(run.spells.includes(36), false, `${difficulty} Stage 5 should not use Manipulating Doll`);
  }

  return { natural, phaseRuns, allKill };
}

function main() {
  const reference = auditReferences();
  const gameplayRules = auditGameplayRuleSources();
  auditEmbeddedData();
  const directSpells = auditDirectSpellSubroutines();
  const timelineSpawns = auditTimelineSpawnData();
  const stages = auditFullStages();
  const report = {
    reference,
    gameplayRules,
    hitbox: {
      playerHalf: TH06Logic.PLAYER_SYSTEM.hitboxHalf,
      grazePadding: TH06Logic.PLAYER_SYSTEM.grazePadding,
      bulletCap: TH06Logic.ENEMY_BULLET_CAP
    },
    directSpells,
    timelineSpawns,
    natural: stages.natural.map((stage) => ({
      difficulty: stage.difficulty,
      stage: stage.stage,
      frames: stage.frames,
      enemiesMax: stage.enemiesMax,
      bulletsMax: stage.bulletsMax,
      lasersMax: stage.lasersMax,
      effects: stage.effects.length,
      dialogues: stage.dialogues.length
    })),
    phaseRuns: stages.phaseRuns.map((stage) => ({
      difficulty: stage.difficulty,
      stage: stage.stage,
      frames: stage.frames,
      enemiesMax: stage.enemiesMax,
      bulletsMax: stage.bulletsMax,
      lasersMax: stage.lasersMax,
      spellIds: stage.spells,
      effects: stage.effects.length,
      dialogues: stage.dialogues.length
    })),
    allKillDrops: stages.allKill.map((stage) => ({
      difficulty: stage.difficulty,
      stage: stage.stage,
      enemiesMax: stage.enemiesMax,
      bulletsMax: stage.bulletsMax,
      lasersMax: stage.lasersMax,
      items: stage.items
    }))
  };
  console.log(JSON.stringify(report, null, 2));
}

main();
