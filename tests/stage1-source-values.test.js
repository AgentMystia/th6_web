import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const hasReferenceCorpus = existsSync(new URL('../reference/ECL/ecldata1.decl', import.meta.url))
  && existsSync(new URL('../reference/th06-master/src/Player.cpp', import.meta.url))
  && existsSync(new URL('../reference/th06-original/ecldata1.ecl', import.meta.url));

if (!hasReferenceCorpus) {
  test('source reference audit suite is skipped without local reference corpus', { skip: true }, () => {});
} else {
const stage1Decl = readFileSync(new URL('../reference/ECL/ecldata1.decl', import.meta.url), 'utf8');
const stage2Decl = readFileSync(new URL('../reference/ECL/ecldata2.decl', import.meta.url), 'utf8');
const stage3Decl = readFileSync(new URL('../reference/ECL/ecldata3.decl', import.meta.url), 'utf8');
const stage4Decl = readFileSync(new URL('../reference/ECL/ecldata4.decl', import.meta.url), 'utf8');
const stage5Decl = readFileSync(new URL('../reference/ECL/ecldata5.decl', import.meta.url), 'utf8');
const stage6Decl = readFileSync(new URL('../reference/ECL/ecldata6.decl', import.meta.url), 'utf8');
const runtime = readFileSync(new URL('../src/vanilla/th06-runtime.js', import.meta.url), 'utf8');
const main = readFileSync(new URL('../src/vanilla/main.js', import.meta.url), 'utf8');
const logic = readFileSync(new URL('../src/vanilla/th06-logic.js', import.meta.url), 'utf8');
const effectsData = readFileSync(new URL('../src/vanilla/th06-effects-data.js', import.meta.url), 'utf8');
const playerData = readFileSync(new URL('../src/vanilla/th06-player-data.js', import.meta.url), 'utf8');
const playerSource = readFileSync(new URL('../reference/th06-master/src/Player.cpp', import.meta.url), 'utf8');
const gameManagerSource = readFileSync(new URL('../reference/th06-master/src/GameManager.cpp', import.meta.url), 'utf8');
const enemyManagerSource = readFileSync(new URL('../reference/th06-master/src/EnemyManager.cpp', import.meta.url), 'utf8');
const eclManagerSource = readFileSync(new URL('../reference/th06-master/src/EclManager.cpp', import.meta.url), 'utf8');

test('Stage 1 Rumia phase values are taken from original ECL declarations', () => {
  assert.match(stage1Decl, /sub Sub11\(\)[\s\S]*?ins_111\(7000\);[\s\S]*?ins_113\(900\);[\s\S]*?ins_115\(2100\);/);
  assert.match(stage1Decl, /sub Sub16\(\)[\s\S]*?ins_111\(7500\);[\s\S]*?ins_113\(800\);[\s\S]*?ins_115\(1800\);/);
  assert.match(stage1Decl, /sub Sub9\(\)[\s\S]*?ins_93\(2,\s*0,[\s\S]*?ins_115\(1320\);/);
  assert.match(stage1Decl, /ins_93\(2,\s*1,[\s\S]*?ins_115\(1500\);/);
  assert.match(stage1Decl, /ins_93\(2,\s*2,[\s\S]*?ins_115\(1500\);/);
});

test('runtime applies original ECL boss life and timer opcodes directly', () => {
  assert.match(runtime, /op === 111\) e\.hp = e\.maxHp = v\.i32\(a\)/);
  assert.match(runtime, /op === 112\) s\.bossTimer = v\.i32\(a\)/);
  assert.match(runtime, /op === 113\) s\.lifeCallbackThreshold = v\.i32\(a\)/);
  assert.match(runtime, /op === 115\)[\s\S]*?s\.timerCallbackThreshold = v\.i32\(a\);[\s\S]*?s\.bossTimer = 0;/);
  assert.match(runtime, /op === 117\) s\.interactable = !!v\.i32\(a\)/);
  assert.match(runtime, /op === 126\)[\s\S]*?s\.bossLifeCount = v\.i32\(a\)/);
});

function handledEclOpcodes() {
  const runEclStart = runtime.indexOf('    runEcl(game, e) {');
  const enterSubStart = runtime.indexOf('    enterSub(s, subId', runEclStart);
  assert.notEqual(runEclStart, -1);
  assert.notEqual(enterSubStart, -1);
  const eclInterpreterSource = runtime.slice(runEclStart, enterSubStart);
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

async function runtimeForStage(stage) {
  await import('../src/vanilla/th06-logic.js');
  await import('../src/vanilla/th06-data.js');
  await import('../src/vanilla/th06-effects-data.js');
  await import('../src/vanilla/th06-runtime.js');
  const data = globalThis.TH06_EMBEDDED_DATA.games.th06.stages[stage];
  return new globalThis.Th06StageRuntime(data);
}

function stageSubOpcodes(stageRuntime) {
  const used = new Set();
  const v = stageRuntime.ecl.view;
  for (const subOffset of stageRuntime.ecl.subOffsets) {
    let off = subOffset;
    const seen = new Set();
    for (let guard = 0; off && off + 8 <= v.bytes.length && guard < 8192; guard++) {
      assert.equal(seen.has(off), false);
      seen.add(off);
      const time = v.i32(off);
      const op = v.i16(off + 4);
      const size = v.i16(off + 6);
      if (time < 0 || op < 0) break;
      assert.ok(size > 0);
      used.add(op);
      off += size;
    }
  }
  return used;
}

test('runtime covers every Stage 1 ECL opcode used by embedded original subroutines', async () => {
  const used = [...stageSubOpcodes(await runtimeForStage(1))];
  const handled = handledEclOpcodes();
  const missing = [...new Set(used)].filter((op) => !handled.has(op)).sort((a, b) => a - b);
  assert.deepEqual(missing, []);
});

test('runtime covers every Stage 2 ECL opcode used by embedded original subroutines', async () => {
  const used = [...stageSubOpcodes(await runtimeForStage(2))];
  const handled = handledEclOpcodes();
  const missing = [...new Set(used)].filter((op) => !handled.has(op)).sort((a, b) => a - b);
  assert.deepEqual(missing, []);
});

test('runtime covers every Stage 3-6 ECL opcode used by embedded original subroutines', async () => {
  const handled = handledEclOpcodes();
  for (const stage of [3, 4, 5, 6]) {
    const used = [...stageSubOpcodes(await runtimeForStage(stage))];
    const missing = [...new Set(used)].filter((op) => !handled.has(op)).sort((a, b) => a - b);
    assert.deepEqual(missing, [], `Stage ${stage} has unhandled ECL opcodes`);
  }
});

test('embedded original data includes Stage 1-6 runtime bundles and localized MSG text', async () => {
  await import('../src/vanilla/th06-logic.js');
  await import('../src/vanilla/th06-data.js');
  await import('../src/vanilla/th06-effects-data.js');
  await import('../src/vanilla/th06-runtime.js');
  for (let stage = 1; stage <= 6; stage++) {
    const data = globalThis.TH06_EMBEDDED_DATA.games.th06.stages[stage];
    assert.equal(data.stageNumber, stage);
    assert.equal(data.assets.stageBgKey, `stg${stage}bg`);
    assert.equal(data.assets.enemyKey, `stg${stage}enm`);
    assert.ok(data.assets.effectKey);
    const runtime = new globalThis.Th06StageRuntime(data);
    assert.ok(runtime.ecl.timeline.length > 0, `Stage ${stage} timeline is empty`);
    assert.ok(runtime.std.objects.some((object) => object.quads.length > 0), `Stage ${stage} STD quads are empty`);
    const texts = [...new Set(runtime.msg.messages
      .filter(Array.isArray)
      .flatMap((message) => message.filter((instr) => instr.text).map((instr) => instr.text.trim()))
      .filter(Boolean))];
    const missing = texts.filter((text) => !globalThis.TH06Logic.DIALOGUE_ZH_CN.has(text));
    assert.deepEqual(missing, [], `Stage ${stage} has untranslated MSG text`);
  }
});

test('Patchouli mixed-element spell chain preserves original ECL context vars across calls', async () => {
  assert.match(enemyManagerSource, /CallEclSub\(&this->currentContext, this->lifeCallbackSub\)/);
  assert.match(runtime, /enterSub\(s, subId[\s\S]*?\.\.\.s\.ctx[\s\S]*?\.\.\.\(setArgs \? \{ var0, float0 \} : \{\}\)/);
  assert.match(runtime, /if \(!s\.disableCallStack\) s\.stack\.push\(\{ \.\.\.ctx, off: ctx\.off \+ v\.i16\(ctx\.off \+ 6\) \}\);[\s\S]*?this\.enterSub\(s, v\.i32\(a\), v\.i32\(a \+ 4\), v\.f32\(a \+ 8\)\)/);
  assert.doesNotMatch(runtime, /s\.ctx = this\.makeContext\(v\.i32\(a\), v\.i32\(a \+ 4\), v\.f32\(a \+ 8\)\)/);
  assert.match(stage4Decl, /ins_121\(3, 0\)[\s\S]*?ins_39\("Sub55", 0, 0\.0f, -10002, 0\)/);
  assert.match(stage4Decl, /sub Sub40\(\)[\s\S]*?ins_39\("Sub58", 0, 0\.0f, -10003, 3\)/);
});

test('Stage 6 Scarlet Meister SETINT stores player angle into float context vars', async () => {
  await import('../src/vanilla/th06-logic.js');
  await import('../src/vanilla/th06-data.js');
  await import('../src/vanilla/th06-effects-data.js');
  await import('../src/vanilla/th06-runtime.js');
  assert.match(eclManagerSource, /ECL_OPCODE_SETINT:[\s\S]*?ECL_OPCODE_SETFLOAT:[\s\S]*?EnemyEclInstr::SetVar/);
  assert.match(stage6Decl, /sub Sub39\(\)[\s\S]*?ins_4\(-10007, -10021\);[\s\S]*?ins_35\("Sub37", 0, 0\.0f\);/);

  const data = globalThis.TH06_EMBEDDED_DATA.games.th06.stages[6];
  const runtime = new globalThis.Th06StageRuntime(data);
  const game = {
    id: 1,
    rank: 16,
    enemies: [],
    enemyBullets: [],
    enemyLasers: [],
    items: [],
    rng: { range: (v) => v * 0.5 },
    player: { x: 192, y: 400 },
    setBossLives() {},
    setBossPresent() {},
    setBossLifeCount() {},
    startBossSpell() { return ''; },
    endBossSpell() {},
    spawnLaser(laser) { this.enemyLasers.push(laser); },
    spawnEffectParticles() {},
    spawnSpellEffect() {},
    requestDialogue() {},
    startDialogue() {},
    consumeDialogueResume() { return true; },
    isDialogueBlocking() { return false; },
    turnBulletsIntoPointItems() { this.enemyBullets = []; },
    text() {},
    audio: { sfx() {} }
  };
  const enemy = {
    id: 1,
    kind: 'boss',
    x: 192,
    y: 96,
    z: 0,
    hp: 999999,
    maxHp: 999999,
    score: 0,
    radius: 24,
    frame: 0,
    ecl: runtime.makeEnemyState(39, false, -1)
  };
  for (let frame = 0; frame < 260; frame++) {
    globalThis.__touhouGameRank = game.rank;
    globalThis.__touhouPlayerX = game.player.x;
    globalThis.__touhouPlayerY = game.player.y;
    globalThis.__touhouShotType = 0;
    enemy.frame++;
    runtime.updateEnemy(game, enemy);
  }

  const aimed = game.enemyBullets.find((bullet) => bullet.eclSprite === 9 && bullet.eclOffset === 0);
  assert.ok(aimed, 'Scarlet Meister should spawn its leading aimed red bullet');
  assert.ok(Math.abs(aimed.vx) < 0.2, `leading bullet should not fly sideways: ${JSON.stringify(aimed)}`);
  assert.ok(aimed.vy > 6, `leading bullet should be aimed down at the player: ${JSON.stringify(aimed)}`);
});

test('Stage 2 SETVARSELFX drives the original side-dependent fairy animation', async () => {
  assert.match(eclManagerSource, /ECL_OPCODE_SETVARSELFX:[\s\S]*?EnemyEclInstr::SetVar\(enemy, instruction->args\.alu\.res, &enemy->position\.x\);/);
  assert.match(stage2Decl, /sub Sub17\(\)[\s\S]*?ins_10\(-10005\);[\s\S]*?ins_28\(-10005\.0f, 192\.0f\);/);

  const stageRuntime = await runtimeForStage(2);
  const game = {
    id: 1,
    rank: 16,
    enemies: [],
    enemyBullets: [],
    enemyLasers: [],
    items: [],
    rng: { range: (v) => v * 0.5 },
    player: { x: 192, y: 400 },
    audio: { sfx() {} }
  };
  const makeEnemy = (x) => ({
    id: game.id++,
    kind: 'fairyRed',
    x,
    y: 96,
    z: 0,
    hp: 1000,
    maxHp: 1000,
    score: 0,
    radius: 14,
    frame: 0,
    ecl: stageRuntime.makeEnemyState(17, false, -1)
  });

  const rightSide = makeEnemy(288);
  stageRuntime.runEcl(game, rightSide);
  assert.equal(rightSide.ecl.currentAnm, 66);

  const leftSide = makeEnemy(96);
  stageRuntime.runEcl(game, leftSide);
  assert.equal(leftSide.ecl.currentAnm, 67);
});

test('release runtime does not keep the old hand-authored approximate Stage fallback', () => {
  assert.doesNotMatch(main, /ALLOW_APPROX_STAGE_FALLBACK/);
  assert.doesNotMatch(main, /const patterns =/);
  assert.doesNotMatch(main, /const events =/);
  assert.match(main, /this\.stages = window\.TH06_EMBEDDED_DATA\?\.games\?\.th06\?\.stages/);
  assert.match(main, /if \(!window\.Th06StageRuntime \|\| !this\.stages\?\.\[1\]\) throw new Error\('Original TH06 ECL\/STD runtime data is missing'\)/);
  assert.match(main, /this\.stageRuntime = new window\.Th06StageRuntime\(stageData\)/);
  assert.doesNotMatch(main, /Stage data missing/);
  assert.doesNotMatch(main, /TH06Logic\?\./);
  assert.match(main, /if \(!TH06_PLAYER_DATA\) throw new Error\('TH06PlayerData source tables must be loaded before main\.js'\)/);
  assert.doesNotMatch(main, /TH06_PLAYER_DATA\?\./);
  assert.doesNotMatch(main, /\|\| 'Rumia'/);
  assert.doesNotMatch(main, /REIMU_A_POWER\[REIMU_A_POWER\.length - 1\]/);
  assert.doesNotMatch(main, /table\[table\.length - 1\]/);
  assert.doesNotMatch(main, /clearAfterFrame \?\? Infinity/);
  assert.doesNotMatch(logic, /\|\| DIFFICULTY_INFO\.lunatic/);
  assert.doesNotMatch(logic, /\|\| POINT_SCORE_TABLE\.lunatic/);
  assert.doesNotMatch(logic, /STAGE1_META\.spells\[STAGE1_META\.spells\.length - 1\]/);
  assert.doesNotMatch(runtime, /color: '#ff4b67'/);
  assert.match(runtime, /if \(!rect\) throw new Error\(`Missing original bullet ANM frame for sprite \$\{p\.sprite\} offset \$\{p\.offset\}`\)/);
  assert.doesNotMatch(runtime, /this\.sprites\.get\(spriteId \+ offset\) \|\| this\.sprites\.get\(spriteId\)/);
  assert.doesNotMatch(runtime, /TH06Logic\?\./);
  assert.doesNotMatch(runtime, /ACTIVE_ECL_DIFFICULTY\s*=\s*3/);
  assert.doesNotMatch(runtime, /Math\.random/);
});

test('input path buffers keydown edges until the next fixed simulation frame', () => {
  assert.match(main, /this\.downEdges = new Set\(\)/);
  assert.match(main, /if \(!event\.repeat && !this\.held\.has\(button\)\) this\.downEdges\.add\(button\)/);
  assert.match(main, /const pressed = new Set\(this\.downEdges\);[\s\S]*?this\.downEdges\.clear\(\);[\s\S]*?const held = new Set\(this\.held\);[\s\S]*?return \{\s*held,\s*pressed,/);
  assert.match(main, /const shootHeld = input\.held\.has\('shoot'\) \|\| \(mobileMode && input\.mobileShootHeld\);[\s\S]*?if \(!shootHeld\) this\.player\.shotFrame = -1;/);
  assert.match(main, /if \(shootHeld && this\.player\.shotFrame >= 0\)/);
  assert.doesNotMatch(main, /this\.prev = new Set/);
});

test('mobile touch movement is uncapped while shot mode labels describe fire form', () => {
  assert.match(main, /this\.shotModeButton\.textContent = this\.shotFocus \? 'LASER' : 'SHOT'/);
  assert.match(main, /if \(mobileMode\) \{\s*const analog = input\.analogMove \|\| \{ x: 0, y: 0 \};\s*horizontalSpeed = analog\.x \|\| 0;\s*verticalSpeed = analog\.y \|\| 0;\s*\} else \{/);
  assert.doesNotMatch(main, /const scale = length > speed && length > 0 \? speed \/ length : 1/);
});

test('mobile playfield taps are accepted as dialogue skip input only after reaching gameplay', () => {
  assert.match(main, /const mobileTapSkip = !!input\.mobileMode && \(input\.mobileMenuTaps\?\.length \|\| 0\) > 0;/);
  assert.match(main, /const skip = input\.pressed\.has\('confirm'\) \|\| input\.pressed\.has\('shoot'\) \|\| mobileTapSkip;/);
  assert.match(main, /if \(this\.phase !== 'playing'\) return this\.updateMenu\(input\);[\s\S]*?this\.updateDialogue\(input\);/);
});

test('browser loop uses original-style processing drop instead of catch-up simulation bursts', () => {
  const gameWindowSource = readFileSync(new URL('../reference/th06-master/src/GameWindow.cpp', import.meta.url), 'utf8');
  assert.match(gameWindowSource, /#define FRAME_TIME \(1000\. \/ 60\.\)/);
  assert.match(gameWindowSource, /g_LastFrameTime \+= FRAME_TIME;[\s\S]*?if \(g_Supervisor\.cfg\.frameskipConfig < this->curFrame\)/);
  assert.match(main, /if \(acc \+ STEP_EPSILON_MS >= STEP_MS\) \{[\s\S]*?game\.update\(input\.frame\(\)\);/);
  assert.doesNotMatch(main, /if \(activity\) acc = Math\.max\(acc, STEP_MS\);/);
  assert.doesNotMatch(main, /while \(acc \+ STEP_EPSILON_MS >= STEP_MS\) \{/);
  assert.doesNotMatch(main, /MAX_SIMULATION_STEPS_PER_TICK/);
  assert.doesNotMatch(main, /splitRuntimeInput/);
  assert.match(main, /lastDroppedFrames/);
  assert.doesNotMatch(main, /const shouldDraw = true;/);
  assert.doesNotMatch(main, /renderSkipDebt/);
});

test('runtime implements Stage 1 presentation opcodes from EclManager source', () => {
  const eclSource = readFileSync(new URL('../reference/th06-master/src/EclManager.cpp', import.meta.url), 'utf8');
  assert.match(eclSource, /ECL_OPCODE_ANMSETPOSES[\s\S]*?anmExDefault[\s\S]*?anmExRight/);
  assert.match(eclSource, /ECL_OPCODE_SPELLCARDEFFECT[\s\S]*?SpawnParticles\(\s*0xd/);
  assert.match(eclSource, /ECL_OPCODE_EFFECTPARTICLE[\s\S]*?SpawnParticles\(instruction->args\.effectParticle\.effectId/);
  assert.match(runtime, /op === 98[\s\S]*?s\.anmExDefaults = v\.i16\(a\)/);
  assert.match(runtime, /op === 102[\s\S]*?game\.spawnSpellEffect/);
  assert.match(runtime, /op === 118[\s\S]*?game\.spawnEffectParticles/);
});

test('runtime decodes Stage 1 spellcard start args with original field widths', async () => {
  const eclHeader = readFileSync(new URL('../reference/th06-master/src/EclManager.hpp', import.meta.url), 'utf8');
  assert.match(eclHeader, /struct EclRawInstrSpellcardStartArgs[\s\S]*?i16 spellcardSprite;[\s\S]*?i16 spellcardId;[\s\S]*?char spellcardName\[1\];/);
  assert.match(runtime, /op === 93\)[\s\S]*?s\.spellcardSprite = v\.i16\(a\);[\s\S]*?const spellId = v\.i16\(a \+ 2\);[\s\S]*?s\.spellName = this\.readCString\(a \+ 4\);/);

  await import('../src/vanilla/th06-logic.js');
  await import('../src/vanilla/th06-data.js');
  await import('../src/vanilla/th06-effects-data.js');
  await import('../src/vanilla/th06-runtime.js');
  const data = globalThis.TH06_EMBEDDED_DATA.games.th06.stages[1];
  const stageRuntime = new globalThis.Th06StageRuntime(data);
  const spellIds = [];
  const spellSprites = [];
  const originalSpellNames = [];
  const game = {
    id: 1,
    rank: 16,
    difficulty: 'lunatic',
    player: { x: 192, y: 400 },
    enemyBullets: [{ x: 10, y: 10 }],
    enemyLasers: [],
    rng: { f: () => 0.5, range: (v) => v * 0.5 },
    audio: { sfx() {} },
    startBossSpell(id, sprite, originalName) {
      spellIds.push(id);
      spellSprites.push(sprite);
      originalSpellNames.push(originalName);
      return `spell-${id}`;
    },
    turnBulletsIntoPointItems() {
      this.enemyBullets = [];
      this.enemyLasers = [];
    }
  };

  for (const subId of [9, 22, 23]) {
    const enemy = {
      id: game.id++,
      x: 192,
      y: 96,
      z: 0,
      hp: 1000,
      maxHp: 1000,
      ecl: stageRuntime.makeEnemyState(subId, false, -1)
    };
    stageRuntime.runEcl(game, enemy);
    assert.equal(enemy.ecl.spellNameEnglish, `spell-${spellIds.at(-1)}`);
  }

  assert.deepEqual(spellIds, [0, 1, 2]);
  assert.deepEqual(spellSprites, [2, 2, 2]);
  assert.ok(originalSpellNames.every(Boolean));
  assert.match(runtime, /game\.startBossSpell\?\.\(spellId, s\.spellcardSprite, s\.spellName\)/);
});

test('Stage 1 STD projection keeps original camera handedness and tile scale', () => {
  const stageSource = readFileSync(new URL('../reference/th06-master/src/Stage.cpp', import.meta.url), 'utf8');
  const gameSource = readFileSync(new URL('../reference/th06-master/src/GameManager.cpp', import.meta.url), 'utf8');
  const anmManagerSource = readFileSync(new URL('../reference/th06-master/src/AnmManager.cpp', import.meta.url), 'utf8');
  assert.match(gameSource, /atVec\.y = -viewportMiddleHeight;/);
  assert.match(stageSource, /curQuadVm->pos\.x = curQuad->position\.x \+ instance->position\.x - this->position\.x;/);
  assert.match(stageSource, /curQuadVm->pos\.y = curQuad->position\.y \+ instance->position\.y - this->position\.y;/);
  assert.match(anmManagerSource, /worldTransformMatrix\.m\[3\]\[1\] = -vm->pos\.y;/);
  assert.match(stageSource, /if \(curQuad->size\.x != 0\.0f\)[\s\S]*?curQuadVm->scaleX = curQuad->size\.x \/ curQuadVm->sprite->widthPx;/);
  assert.match(anmManagerSource, /scaledXCenter = vm->sprite->widthPx \* vm->scaleX \/ 2\.0f;[\s\S]*?worldTransformMatrix\.m\[3\]\[0\] = fabsf\(scaledXCenter\) \+ vm->pos\.x;/);
  assert.match(gameSource, /atVecY = -viewportMiddleHeight \+ \(f32\)g_GameManager\.stageCameraFacingDir\.y;/);
  assert.match(runtime, /this\.facingEvents = \[\{ frame: 0, start: defaultFacing, target: defaultFacing, duration: 0 \}\];/);
  assert.match(runtime, /let pendingFacingDuration = 0;/);
  assert.match(runtime, /else if \(op === 3\) pendingFacingDuration = Math\.max\(0, key\.i0 \| 0\);/);
  assert.match(runtime, /facing\(frame\)[\s\S]*?event\.start\.x \+ \(event\.target\.x - event\.start\.x\) \* t/);
  assert.match(runtime, /project\(x, y, z, playfield\)[\s\S]*?const ny = \(\(-y \+ halfH\) \* yScale\) \/ viewZ;/);
  assert.match(main, /stageCameraBasis\(facing = \{ x: 0, y: 0, z: 1 \}\)[\s\S]*?const at = \{ x: halfW \+ \(facing\.x \?\? 0\), y: -halfH \+ \(facing\.y \?\? 0\), z: 0 \};/);
  assert.match(main, /stageProjectPoint\(x, y, z, camera\)[\s\S]*?const vz = dx \* camera\.forward\.x \+ dy \* camera\.forward\.y \+ dz \* camera\.forward\.z;/);
  assert.match(main, /const rawW = Math\.max\(0\.001, q\.w \|\| rect\.w \* Math\.abs\(rect\.scaleX \|\| 1\)\);/);
  assert.match(main, /const rawH = Math\.max\(0\.001, q\.h \|\| rect\.h \* Math\.abs\(rect\.scaleY \|\| 1\)\);/);
  assert.match(main, /const vmX = q\.x \+ inst\.x - cam\.x;[\s\S]*?const vmY = q\.y \+ inst\.y - cam\.y;[\s\S]*?const vmZ = q\.z \+ inst\.z - cam\.z;/);
  assert.match(main, /class StageWebGLRenderer/);
  assert.match(main, /stageDrawProjectedQuad\(img, rect, x, y, z, w, h, anchorTopLeft, camera, color, fog, transformedCorners = null\)/);
  assert.doesNotMatch(main, /obj\.x \+ inst\.x \+ q\.x - cam\.x/);
  assert.match(main, /const frame = std\.frame \?\? this\.game\.stageFrame;[\s\S]*?std\.anm\.scriptSprite\(q\.script, 0, frame, \{ keepExitSprite: true \}\)/);
  assert.match(main, /stageQuadCornersTransformed\(x, y, z, w, h, anchorTopLeft, camera, rect/);
  assert.match(main, /this\.stageWebgl\.render\(std, fog, img, projectQuad\)/);
  assert.match(main, /this\.stageWebgl\.fail\(error\);/);
  assert.match(anmManagerSource, /case AnmOpcode_Exit:[\s\S]*?vm->flags\.isVisible = 0;[\s\S]*?case AnmOpcode_ExitHide:[\s\S]*?vm->currentInstruction = NULL;/);
  assert.match(runtime, /if \(op === 0\) \{[\s\S]*?if \(!options\.keepExitSprite \|\| !vm\.rect\) vm\.visible = false;[\s\S]*?if \(op === 15\) \{[\s\S]*?vm\.done = time <= frame;[\s\S]*?break;/);
  assert.doesNotMatch(main, /rect\.w \* 2/);
  assert.doesNotMatch(main, /rect\.h \* 2/);
});

test('Stage 2 lake background uses original STD perspective tiles with source fog', () => {
  const stageSource = readFileSync(new URL('../reference/th06-master/src/Stage.cpp', import.meta.url), 'utf8');
  const stage2Std = readFileSync(new URL('../reference/DSTD/stage2.dstd', import.meta.url), 'utf8');
  assert.match(logic, /stageNumber:\s*2/);
  assert.match(stage2Std, /Position:\s+-192 -128 0[\s\S]*?Width:\s+640[\s\S]*?Height:\s+384/);
  assert.match(stage2Std, /QUAD:[\s\S]*?Script_index:\s+0[\s\S]*?Position:\s+-64 0 0[\s\S]*?Width:\s+256[\s\S]*?Height:\s+256/);
  assert.match(stageSource, /curQuadVm->pos\.x = curQuad->position\.x \+ instance->position\.x - this->position\.x;/);
  assert.match(stageSource, /curQuadVm->pos\.y = curQuad->position\.y \+ instance->position\.y - this->position\.y;/);
  assert.match(stageSource, /g_AnmManager->Draw3\(curQuadVm\);/);
  assert.doesNotMatch(main, /stageStdFlatLake/);
  assert.doesNotMatch(main, /stageStdPlanar/);
  assert.match(main, /if \(g\.stageRuntime\) \{\s*this\.stageStd\(g\.stageRuntime\.std, fog\);/);
  assert.match(main, /stageDrawProjectedStrip\(img, rect, top, bottom, sy0, sy1, fog\)/);
  assert.match(main, /appendStageQuad\(rect, corners, image\)/);
  assert.match(main, /const alpha = clamp\(\(depth - fog\.near\) \/ \(fog\.far - fog\.near\), 0, 1\);/);
  assert.match(main, /this\.stageDrawProjectedQuad\(img, rect, vmX, vmY, vmZ, rawW, rawH, rect\.anchorTopLeft, camera, color, fog, hasRotation \? corners : null\)/);
});

test('BGM transitions cut stale tracks before starting the next original cue', () => {
  assert.match(main, /playBgm\(id, options = \{\}\)[\s\S]*?if \(this\.active === id\) \{[\s\S]*?this\.stopTracksExcept\(id\);[\s\S]*?return;/);
  assert.match(main, /playBgm\(id, options = \{\}\)[\s\S]*?this\.stopTracksExcept\(id\);[\s\S]*?next\.volume = 0;/);
  assert.match(main, /stopTracksExcept\(activeId = null\)[\s\S]*?Object\.entries\(this\.tracks\)[\s\S]*?if \(trackId === activeId\) continue;[\s\S]*?audio\.pause\(\);[\s\S]*?audio\.volume = 0;/);
  assert.match(main, /fadeOutBgm\(seconds = 4\)[\s\S]*?const tracks = Object\.values\(this\.tracks\);[\s\S]*?for \(const audio of tracks\) audio\.pause\(\);/);
  assert.match(main, /sync\(id\) \{[\s\S]*?if \(id == null\) return;[\s\S]*?this\.playBgm\(id, \{ restart: false \}\);/);
});

test('runtime preserves source ENEMYKILLALL, STD unpause and ANM interrupt semantics', async () => {
  const eclSource = readFileSync(new URL('../reference/th06-master/src/EclManager.cpp', import.meta.url), 'utf8');
  const stageSource = readFileSync(new URL('../reference/th06-master/src/Stage.cpp', import.meta.url), 'utf8');
  assert.match(eclSource, /ECL_OPCODE_ENEMYKILLALL[\s\S]*?flags\.isBoss[\s\S]*?local_b4->life = 0/);
  assert.match(runtime, /op === 96\) this\.killNonBossEnemies\(game\)/);
  assert.doesNotMatch(runtime, /op === 96\) game\.enemies\.length = 0/);
  assert.match(runtime, /killNonBossEnemies\(game\)[\s\S]*?enemy\.ecl\?\.isBoss \|\| enemy\.kind === 'boss'[\s\S]*?enemy\.hp = 0/);

  assert.match(eclSource, /ECL_OPCODE_STDUNPAUSE[\s\S]*?g_Stage\.unpauseFlag = 1/);
  assert.match(stageSource, /STDOP_PAUSE[\s\S]*?stage->unpauseFlag/);
  assert.match(runtime, /pauseFrames = new Set\(\)/);
  assert.match(runtime, /op === 125\) this\.std\.unpause\(\)/);
  assert.match(main, /const std = g\.stageRuntime\?\.std;[\s\S]*?const fog = std\?\.fog\(std\.frame \?\? g\.stageFrame\)/);

  assert.match(eclSource, /ECL_OPCODE_ANMINTERRUPTMAIN[\s\S]*?pendingInterrupt/);
  assert.match(eclSource, /ECL_OPCODE_ANMINTERRUPTSLOT[\s\S]*?pendingInterrupt/);
  assert.match(enemyManagerSource, /for \(curEnemyVm = &curEnemy->vms\[0\][\s\S]*?curEnemyVmIdx < 4[\s\S]*?Draw2\(curEnemyVm\)[\s\S]*?Draw2\(&curEnemy->primaryVm\)[\s\S]*?curEnemyVmIdx < 8[\s\S]*?Draw2\(curEnemyVm\)/);
  assert.match(eclSource, /ECL_OPCODE_ANMFLAGROTATION[\s\S]*?enemy->flags\.unk13 = instruction->args\.setInt/);
  assert.match(runtime, /op === 128\) s\.anmInterrupt/);
  assert.match(runtime, /op === 129\)[\s\S]*?entry\.interrupt/);
  assert.match(runtime, /slot\.frame\+\+/);
  assert.match(runtime, /enemySlotRects\(e, start = 0, end = 8\)/);
  assert.match(main, /enemySlotRects\(e, 0, 4\)[\s\S]*?enemyRect\(e\)[\s\S]*?enemySlotRects\(e, 4, 8\)/);
  assert.match(main, /e\.ecl\.anmRotateWithAngle \|\| rect\.autoRotate \? e\.ecl\.angle : rect\.rotation/);
  assert.match(runtime, /options\.interrupt = interrupt\.value/);

  await import('../src/vanilla/th06-logic.js');
  await import('../src/vanilla/th06-data.js');
  await import('../src/vanilla/th06-effects-data.js');
  await import('../src/vanilla/th06-runtime.js');
  const data = globalThis.TH06_EMBEDDED_DATA.games.th06.stages[3];
  const stageRuntime = new globalThis.Th06StageRuntime(data);
  assert.ok(stageRuntime.std.pauseFrames.has(7870));
  for (let i = 0; i < 7900; i++) stageRuntime.std.advance();
  assert.equal(stageRuntime.std.frame, 7870);
  stageRuntime.std.unpause();
  stageRuntime.std.advance();
  assert.equal(stageRuntime.std.frame, 7871);

  const boss = { kind: 'boss', hp: 5, ecl: { isBoss: true } };
  const fairy = { kind: 'fairyRed', hp: 5, ecl: { isBoss: false } };
  const plain = { kind: 'fairyRed', hp: 5 };
  stageRuntime.killNonBossEnemies({ enemies: [boss, fairy, plain] });
  assert.equal(boss.hp, 5);
  assert.equal(fairy.hp, 0);
  assert.equal(plain.hp, 0);
  assert.equal(plain.dead, true);
});

test('enemy bullet collision uses Player.cpp graze and killbox AABBs', () => {
  assert.match(playerSource, /p->hitboxSize\.x = 1\.25;/);
  assert.match(playerSource, /p->hitboxSize\.y = 1\.25;/);
  assert.match(playerSource, /bulletTopLeft\.x = center->x - size->x \/ 2\.0f - 20\.0f;/);
  assert.match(playerSource, /bulletBottomRight\.y = center->y \+ size->y \/ 2\.0f \+ 20\.0f;/);
  assert.match(playerSource, /bulletLeft = bulletCenter->x - bulletSize->x \/ 2\.0f;/);
  assert.match(playerSource, /bulletBottom = bulletCenter->y \+ bulletSize->y \/ 2\.0f;/);
  assert.match(main, /const PLAYER_HITBOX_HALF = \{ x: 1\.25, y: 1\.25, z: 5 \};/);
  assert.match(main, /const PLAYER_GRAZE_PADDING = 20;/);
  assert.match(main, /enemyBulletHalfSize\(b\)[\s\S]*?return \{ x: b\.grazeSize\.x \/ 2, y: b\.grazeSize\.y \/ 2 \};/);
  assert.match(main, /playerOverlapsEnemyBullet\(b, padding = 0\)[\s\S]*?half\.x \+ padding \+ PLAYER_HITBOX_HALF\.x[\s\S]*?half\.y \+ padding \+ PLAYER_HITBOX_HALF\.y/);
  assert.match(main, /const grazeOverlap = Math\.abs\(px - b\.x\) <= halfX \+ PLAYER_GRAZE_PADDING \+ PLAYER_HITBOX_HALF\.x[\s\S]*?&& Math\.abs\(py - b\.y\) <= halfY \+ PLAYER_GRAZE_PADDING \+ PLAYER_HITBOX_HALF\.y;/);
  assert.match(main, /if \(!b\.grazed && grazeOverlap && playerCanGraze\)/);
  assert.match(main, /const hitOverlap = Math\.abs\(px - b\.x\) <= halfX \+ PLAYER_HITBOX_HALF\.x[\s\S]*?&& Math\.abs\(py - b\.y\) <= halfY \+ PLAYER_HITBOX_HALF\.y;/);
  assert.match(main, /if \(hitOverlap && playerState !== 'dead' && playerState !== 'spawning'\)/);
  assert.match(main, /if \(playerState === 'alive'\) \{[\s\S]*?this\.die\(\);/);
  assert.doesNotMatch(main, /dx <= hitR \+ PLAYER_GRAZE_PADDING/);
});

test('enemy bullet manager follows the original 640 bullet cap and Perfect Freeze ex-instruction', () => {
  const bulletHeader = readFileSync(new URL('../reference/th06-master/src/BulletManager.hpp', import.meta.url), 'utf8');
  const exSource = readFileSync(new URL('../reference/th06-master/src/EnemyEclInstr.cpp', import.meta.url), 'utf8');
  assert.match(bulletHeader, /Bullet bullets\[640\];/);
  assert.match(logic, /const ENEMY_BULLET_CAP = 640/);
  assert.match(logic, /ENEMY_BULLET_CAP,/);
  assert.match(runtime, /const ENEMY_BULLET_CAP = TH06_LOGIC\.ENEMY_BULLET_CAP \?\? 640;/);
  assert.match(runtime, /if \(\(game\.enemyBullets\?\.length \|\| 0\) >= ENEMY_BULLET_CAP\) return;/);
  assert.match(stage2Decl, /sub Sub31\(\)[\s\S]*?ins_121\(0, 0\);[\s\S]*?ins_121\(0, 1\);/);
  assert.match(exSource, /void ExInsCirnoRainbowBallJank[\s\S]*?currentBullet->spriteOffset = 15;[\s\S]*?case 0:[\s\S]*?currentBullet->speed = 0\.0;[\s\S]*?currentBullet->velocity = velocityVector;[\s\S]*?case 1:[\s\S]*?currentBullet->exFlags \|= 0x10;[\s\S]*?currentBullet->ex5Int0 = 220;[\s\S]*?accelerationMultiplier = 0\.01;/);
  assert.match(runtime, /runExInstruction\(game, e, index, param\)[\s\S]*?if \(index === 0\)[\s\S]*?bullet\.eclOffset = 15;[\s\S]*?if \(param === 0\)[\s\S]*?bullet\.vx = 0;[\s\S]*?bullet\.vy = 0;[\s\S]*?bullet\.speed = 0;[\s\S]*?else if \(param === 1\)[\s\S]*?bullet\.flags = \(bullet\.flags \|\| 0\) \| 0x10;[\s\S]*?bullet\.exInts = \[220,/);
});

test('Stage 2 Perfect Freeze freezes and releases bullets under the source bullet cap', async () => {
  await import('../src/vanilla/th06-logic.js');
  await import('../src/vanilla/th06-data.js');
  await import('../src/vanilla/th06-effects-data.js');
  await import('../src/vanilla/th06-runtime.js');
  const data = globalThis.TH06_EMBEDDED_DATA.games.th06.stages[2];
  const stageRuntime = new globalThis.Th06StageRuntime(data);
  const spellIds = [];
  let sawFrozen = false;
  let sawReleased = false;
  let perfectFreezeActive = false;
  let diamondStormStarted = false;
  let maxBullets = 0;
  const rng = { f: () => 0.5, range: (v) => v * 0.5, between: (a, b) => a + (b - a) * 0.5 };
  const game = {
    id: 1,
    rank: 16,
    difficulty: 'lunatic',
    stageFrame: 0,
    power: 128,
    score: 0,
    enemies: [],
    enemyBullets: [],
    enemyLasers: [],
    items: [],
    rng,
    player: { x: 192, y: 400 },
    stageMeta: {},
    addScore(points) { this.score += points || 0; },
    setBossLives() {},
    setBossPresent() {},
    setBossLifeCount() {},
    startBossSpell(id) {
      spellIds.push(id);
      if (id === 5) perfectFreezeActive = true;
      if (id === 6) diamondStormStarted = true;
      return `spell-${id}`;
    },
    endBossSpell() {},
    spawnLaser(laser) { this.enemyLasers.push(laser); },
    spawnEffectParticles() {},
    spawnSpellEffect() {},
    requestDialogue() {},
    startDialogue() {},
    consumeDialogueResume() { return true; },
    isDialogueBlocking() { return false; },
    text() {},
    audio: { sfx() {} },
    spawnItem(type, x, y, options = {}) {
      const item = { type, x, y, options };
      this.items.push(item);
      return item;
    },
    turnBulletsIntoPointItems() {
      this.enemyBullets = [];
      this.enemyLasers = [];
    }
  };

  for (let frame = 0; frame <= 15120; frame++) {
    game.stageFrame = frame;
    globalThis.__touhouGameRank = game.rank;
    globalThis.__touhouPlayerX = game.player.x;
    globalThis.__touhouPlayerY = game.player.y;
    stageRuntime.update(game);
    for (const enemy of [...game.enemies]) {
      enemy.frame = (enemy.frame || 0) + 1;
      if (enemy.ecl) stageRuntime.updateEnemy(game, enemy);
      if (enemy.hp <= 0) {
        const keep = stageRuntime.killEnemy(game, enemy);
        if (!keep) enemy.dead = true;
      }
    }
    game.enemies = game.enemies.filter((enemy) => !enemy.dead);
    maxBullets = Math.max(maxBullets, game.enemyBullets.length);
    if (perfectFreezeActive && !diamondStormStarted) {
      sawFrozen ||= game.enemyBullets.some((bullet) => bullet.eclOffset === 15 && bullet.speed === 0);
      sawReleased ||= game.enemyBullets.some((bullet) => (bullet.flags & 0x10) && bullet.exInts?.[0] === 220 && bullet.exFloats?.[0] === 0.01);
    }
  }

  assert.ok(spellIds.includes(5));
  assert.ok(spellIds.includes(6));
  assert.equal(sawFrozen, true);
  assert.equal(sawReleased, true);
  assert.ok(maxBullets <= globalThis.TH06Logic.ENEMY_BULLET_CAP);
});

test('Stage 2 Cirno final spells keep original aimed and full random angle behavior', async () => {
  assert.match(stage2Decl, /ins_75\(5, 6, -10001, 1, 2\.0f, 0\.4f, 3\.1415927f, -3\.1415927f, 5\);/);
  assert.match(runtime, /const ANGLE_EPSILON = 1e-6;/);
  assert.match(runtime, /if \(Math\.abs\(v - Math\.PI\) <= ANGLE_EPSILON\) return Math\.PI;/);

  await import('../src/vanilla/th06-logic.js');
  await import('../src/vanilla/th06-data.js');
  await import('../src/vanilla/th06-effects-data.js');
  await import('../src/vanilla/th06-runtime.js');
  const data = globalThis.TH06_EMBEDDED_DATA.games.th06.stages[2];
  const stageRuntime = new globalThis.Th06StageRuntime(data);
  const angleDiff = (a, b) => {
    let diff = a - b;
    while (diff < -Math.PI) diff += Math.PI * 2;
    while (diff > Math.PI) diff -= Math.PI * 2;
    return diff;
  };
  const makeGame = (playerX, rngValue = 0.5) => ({
    id: 1,
    rank: 16,
    difficulty: 'lunatic',
    stageFrame: 0,
    enemies: [],
    enemyBullets: [],
    enemyLasers: [],
    items: [],
    rng: { range: (v) => v * rngValue, f: () => rngValue, between: (a, b) => a + (b - a) * rngValue },
    player: { x: playerX, y: 400 },
    startBossSpell() { return ''; },
    endBossSpell() {},
    spawnEffectParticles() {},
    spawnSpellEffect() {},
    setBossPresent() {},
    setBossLifeCount() {},
    turnBulletsIntoPointItems() {
      this.enemyBullets = [];
      this.enemyLasers = [];
    },
    audio: { sfx() {} }
  });
  const firstPerfectFreezeAimedAngle = (playerX) => {
    const game = makeGame(playerX);
    const enemy = { id: game.id++, x: 192, y: 96, z: 0, hp: 999999, maxHp: 999999, kind: 'boss', ecl: stageRuntime.makeEnemyState(31, false, -1) };
    stageRuntime.runEcl(game, enemy);
    for (let frame = 0; frame < 520; frame++) {
      game.stageFrame = frame;
      globalThis.__touhouPlayerX = game.player.x;
      globalThis.__touhouPlayerY = game.player.y;
      const before = game.enemyBullets.length;
      stageRuntime.updateEnemy(game, enemy);
      if (frame < 420) continue;
      for (const bullet of game.enemyBullets.slice(before)) {
        const aim = Math.atan2(game.player.y - bullet.y, game.player.x - bullet.x);
        if (Math.abs(angleDiff(bullet.angle, aim)) < 1e-5) return bullet.angle;
      }
    }
    return null;
  };
  const leftAngle = firstPerfectFreezeAimedAngle(96);
  const rightAngle = firstPerfectFreezeAimedAngle(320);
  assert.equal(typeof leftAngle, 'number');
  assert.equal(typeof rightAngle, 'number');
  assert.notEqual(leftAngle, rightAngle);

  const game = makeGame(192, 0.25);
  const enemy = { id: game.id++, x: 192, y: 96, z: 0, hp: 999999, maxHp: 999999, kind: 'boss', ecl: stageRuntime.makeEnemyState(32, false, -1) };
  stageRuntime.runEcl(game, enemy);
  for (let frame = 0; frame < 260 && game.enemyBullets.length === 0; frame++) {
    game.stageFrame = frame;
    globalThis.__touhouPlayerX = game.player.x;
    globalThis.__touhouPlayerY = game.player.y;
    stageRuntime.updateEnemy(game, enemy);
  }
  assert.ok(game.enemyBullets.length > 0);
  assert.ok(game.enemyBullets.some((bullet) => Math.abs(bullet.vy) > 0.5));
  assert.ok(!game.enemyBullets.every((bullet) => bullet.vx < 0 && Math.abs(bullet.vy) < 0.001));
});

test('runtime keeps original Stage 1 item resource opcodes', () => {
  const eclSource = readFileSync(new URL('../reference/th06-master/src/EclManager.cpp', import.meta.url), 'utf8');
  assert.match(stage1Decl, /ins_119\(5\);/);
  assert.match(eclSource, /ECL_OPCODE_DROPITEMS[\s\S]*?local_8c == 0 \? ITEM_POWER_BIG : ITEM_POWER_SMALL/);
  assert.match(eclSource, /ECL_OPCODE_DROPITEMID[\s\S]*?instruction->args\.dropItem\.itemId/);
  assert.match(runtime, /op === 119\) this\.dropPowerItems\(game, e, v\.i32\(a\)\)/);
  assert.match(runtime, /op === 124\)[\s\S]*?this\.spawnSourceItem/);
  assert.match(runtime, /const type = game\.power < 128 \? \(i === 0 \? 'bigPower' : 'power'\) : 'point'/);
});

test('item attraction and bullet-cancel point items match source with modern focus border support', () => {
  const itemSource = readFileSync(new URL('../reference/th06-master/src/ItemManager.cpp', import.meta.url), 'utf8');
  const bulletSource = readFileSync(new URL('../reference/th06-master/src/BulletManager.cpp', import.meta.url), 'utf8');
  assert.match(itemSource, /curItem->state == 1 \|\| \(128 <= g_GameManager\.currentPower && g_Player\.positionCenter\.y < 128\.0f\)/);
  assert.match(itemSource, /sincosmul\(&curItem->startPosition, playerAngle, 8\.0f\)/);
  assert.match(itemSource, /curItem->startPosition\.y \+= .*0\.03f/);
  assert.match(bulletSource, /SpawnItem\(&bullet->pos, ITEM_POINT_BULLET, 1\)/);
  assert.doesNotMatch(main, /player\.y < 112/);
  assert.match(main, /itemGetBorderActive\(\)[\s\S]*?this\.player\.y < ITEM_GET_BORDER_Y && \(this\.power >= 128 \|\| this\.player\.focusCollect\)/);
  assert.doesNotMatch(main, /itemBorderFlash/);
  assert.match(logic, /presentation:\s*\{[\s\S]*?introFrames:\s*240,[\s\S]*?clearAfterFrame:\s*7600,[\s\S]*?itemBorderLine:\s*\{\s*start:\s*58,\s*end:\s*174\s*\}/);
  assert.match(main, /this\.stageIntro = this\.stageIntroTotalFrames\(\)/);
  assert.match(main, /this\.stageMeta\.presentation\.clearAfterFrame/);
  assert.match(main, /if \(g\.stageRuntime\) \{\s*this\.stageStd\(g\.stageRuntime\.std, fog\);[\s\S]*?else \{\s*this\.stageTextureBase\(stageBgKey, fog\);/);
  assert.match(main, /stageCameraBasis\(facing = \{ x: 0, y: 0, z: 1 \}\)[\s\S]*?const fov = 30 \* DEG/);
  assert.match(main, /const vmX = q\.x \+ inst\.x - cam\.x;[\s\S]*?const vmY = q\.y \+ inst\.y - cam\.y;[\s\S]*?const vmZ = q\.z \+ inst\.z - cam\.z;/);
  assert.doesNotMatch(main, /const w[xyz] = obj\.[xyz] \+ inst\.[xyz] \+ q\.[xyz] - cam\.[xyz]/);
  assert.match(main, /const color = \(rect\.color \?\? 0xffffffff\) >>> 0;[\s\S]*?this\.stageDrawProjectedQuad\(img, rect, vmX, vmY, vmZ, rawW, rawH, rect\.anchorTopLeft, camera, color, fog, hasRotation \? corners : null\)/);
  assert.match(main, /itemGetBorderLine\(\)[\s\S]*?const line = g\.stageMeta\.presentation\.itemBorderLine/);
  assert.match(main, /if \(elapsed < line\.start \|\| elapsed > line\.end\) return/);
  assert.match(main, /Item Get Border Line/);
  assert.match(logic, /primary:\s*'第一关'/);
  assert.match(logic, /original:\s*'STAGE 1'/);
  assert.match(main, /Math\.cos\(angle\) \* 8/);
  assert.match(main, /Math\.min\(3, item\.vy \+ 0\.03\)/);
  assert.match(main, /const ITEM_HITBOX_HALF = 8;/);
  assert.match(main, /PLAYER_ITEM_GRAB_HALF\.x \+ ITEM_HITBOX_HALF/);
  assert.match(main, /spawnItem\('pointBullet'[\s\S]*?\{ state: 1 \}/);
  assert.match(runtime, /op === 83\)[\s\S]*?this\.turnBulletsIntoPointItems\(game\)/);
  assert.match(runtime, /op === 93\)[\s\S]*?this\.turnBulletsIntoPointItems\(game\)/);
  assert.match(runtime, /op === 94\)[\s\S]*?this\.turnBulletsIntoPointItems\(game\)/);
  assert.match(main, /for \(let off = l\.startOffset; l\.endOffset > off; off \+= 32\)/);
});

test('right side HUD uses original front.png layout coordinates', () => {
  assert.match(main, /frontFrame\(\)[\s\S]*?frontSprite\('panelTile', 0, y\)[\s\S]*?frontSprite\('panelTile', x, y\)/);
  assert.match(main, /frontSprite\('hiScoreLabel', 432, 58\)/);
  assert.match(main, /frontSprite\('scoreLabel', 432, 82\)/);
  assert.match(main, /padStart\(9, '0'\), 496, 56/);
  assert.match(main, /padStart\(9, '0'\), 496, 80/);
  assert.match(main, /frontSprite\('playerLabel', 432, 122\)/);
  assert.match(main, /frontSprite\('bombLabel', 432, 146\)/);
  assert.match(main, /frontSprite\('powerLabel', 432, 186\)/);
  assert.match(main, /frontSprite\('grazeLabel', 432, 206\)/);
  assert.match(main, /frontSprite\('pointLabel', 432, 226\)/);
  assert.match(main, /frontLogo\(\)[\s\S]*?frontSprite\('logoCircle', 528, 376/);
  assert.doesNotMatch(main, /this\.fillText\('HiScore'/);
  assert.doesNotMatch(main, /this\.fillText\(this\.fpsText/);
});

test('Stage 2 boss names and dialogue trigger distinguish Daiyousei from Cirno', async () => {
  assert.match(logic, /midbossName:\s*'大妖精'/);
  assert.match(logic, /bossDisplayName:\s*'Cirno'/);
  assert.match(logic, /midbossDisplayName:\s*'Daiyousei'/);
  assert.match(main, /bossNameForEnemy\(enemy\)[\s\S]*?this\.currentStageNumber === 2 && enemy\?\.score === 100000[\s\S]*?midbossDisplayName/);
  assert.match(stage2Decl, /sub Sub20\(\)[\s\S]*?ins_111\(10000\);[\s\S]*?ins_126\(0\);/);
  assert.match(stage2Decl, /ins_0\("Sub20", 0\.0f, 0\.0f, 0\.0f, 10000, -2, 100000\);/);
  assert.match(stage2Decl, /ins_0\("Sub21", 0\.0f, 0\.0f, 0\.0f, 1, -2, 200000\);/);

  await import('../src/vanilla/th06-logic.js');
  await import('../src/vanilla/th06-data.js');
  await import('../src/vanilla/th06-effects-data.js');
  await import('../src/vanilla/th06-runtime.js');
  const data = globalThis.TH06_EMBEDDED_DATA.games.th06.stages[2];
  const runtime = new globalThis.Th06StageRuntime(data);
  const starts = [];
  const game = {
    id: 1,
    rank: 16,
    difficulty: 'lunatic',
    stageFrame: 0,
    enemies: [],
    enemyBullets: [],
    enemyLasers: [],
    items: [],
    rng: { f: () => 0.5, range: (v) => v * 0.5, between: (a, b) => a + (b - a) * 0.5 },
    player: { x: 192, y: 400 },
    spec() { return { family: 'reimu' }; },
    startDialogue(index, instrs) {
      starts.push({ index, text: instrs?.find((entry) => entry.text)?.text });
    },
    consumeDialogueResume() { return true; },
    isDialogueBlocking() { return false; },
    setBossPresent() {},
    setBossLifeCount() {},
    startBossSpell() { return ''; },
    endBossSpell() {},
    spawnEffectParticles() {},
    spawnSpellEffect() {},
    turnBulletsIntoPointItems() { this.enemyBullets = []; },
    text() {},
    audio: { sfx() {} }
  };
  for (let frame = 0; frame <= 5988; frame++) {
    game.stageFrame = frame;
    globalThis.__touhouGameRank = game.rank;
    globalThis.__touhouPlayerX = game.player.x;
    globalThis.__touhouPlayerY = game.player.y;
    runtime.update(game);
  }
  assert.deepEqual(starts.map((entry) => entry.index), [0]);
  assert.equal(starts[0].text, 'この湖こんなに広かったかしら？');
});

test('miss item compensation follows Player.cpp exactly', () => {
  assert.match(playerSource, /g_EnemyManager\.spellcardInfo\.isCapturing = 0;/);
  assert.match(playerSource, /SpawnItem\(&p->positionCenter, ITEM_POWER_BIG, 2\);[\s\S]*?ITEM_POWER_SMALL, 2\);[\s\S]*?ITEM_POWER_SMALL, 2\);[\s\S]*?ITEM_POWER_SMALL, 2\);[\s\S]*?ITEM_POWER_SMALL, 2\);[\s\S]*?ITEM_POWER_SMALL, 2\);/);
  assert.match(playerSource, /if \(g_GameManager\.currentPower <= 16\)[\s\S]*?currentPower = 0;[\s\S]*?currentPower -= 16;/);
  assert.match(playerSource, /SpawnItem\(&p->positionCenter, ITEM_FULL_POWER, 2\);[\s\S]*?ITEM_FULL_POWER, 2\);[\s\S]*?ITEM_FULL_POWER, 2\);[\s\S]*?ITEM_FULL_POWER, 2\);[\s\S]*?ITEM_FULL_POWER, 2\);/);
  assert.match(playerSource, /p->respawnTimer = 6;/);
  assert.match(playerSource, /p->bulletGracePeriod = 90;/);
  assert.match(playerSource, /p->playerState = PLAYER_STATE_SPAWNING;[\s\S]*?p->invulnerabilityTimer\.SetCurrent\(0\);/);
  assert.match(playerSource, /else if \(p->playerState == PLAYER_STATE_SPAWNING\)[\s\S]*?if \(30 <= p->invulnerabilityTimer\.AsFrames\(\)\)[\s\S]*?p->playerState = PLAYER_STATE_INVULNERABLE;[\s\S]*?p->invulnerabilityTimer\.SetCurrent\(240\);/);
  assert.match(playerSource, /p->invulnerabilityTimer\.SetCurrent\(240\);/);
  assert.match(main, /const PLAYER_DEATH_DROP_DELAY = 6;/);
  assert.match(main, /const PLAYER_BULLET_GRACE_FRAMES = 90;/);
  assert.match(main, /const PLAYER_SPAWN_ANIM_FRAMES = 30;/);
  assert.match(main, /const PLAYER_RESPAWN_INVULN = 240;/);
  assert.match(main, /this\.player\.state = 'dead'/);
  assert.match(main, /this\.player\.state = 'spawning';[\s\S]*?this\.player\.spawnFrame = 0;/);
  assert.match(main, /updatePlayerSpawning\(\)[\s\S]*?this\.player\.bulletGrace--;[\s\S]*?this\.enemyBullets = \[\];[\s\S]*?this\.player\.state = 'invuln';[\s\S]*?this\.player\.invuln = PLAYER_RESPAWN_INVULN;/);
  assert.match(main, /spawnMissPowerItems\(this\.lives\)/);
  assert.match(main, /spawnMissPowerItems\(0\)/);
  assert.match(main, /this\.power = this\.power <= 16 \? 0 : this\.power - 16/);
  assert.match(main, /this\.spellcardInfo\.isCapturing = false;/);
});

test('modern deathbomb window follows original Player.cpp respawnTimer bomb window', () => {
  assert.match(playerSource, /p->respawnTimer = 6;/);
  assert.match(playerSource, /p->respawnTimer != 0 && 0 < g_GameManager\.bombsRemaining &&\s*WAS_PRESSED\(TH_BUTTON_BOMB\)/);
  assert.match(playerSource, /if \(p->playerState == PLAYER_STATE_DEAD\)[\s\S]*?p->respawnTimer--;[\s\S]*?if \(p->respawnTimer == 0\)/);
  assert.match(main, /const PLAYER_DEATHBOMB_WINDOW_FRAMES = 6;/);
  assert.match(main, /if \(this\.player\.state === 'deathbomb'\)[\s\S]*?this\.updatePlayerDeathbomb\(input\);/);
  assert.match(main, /this\.player\.state = 'deathbomb';/);
  assert.match(main, /input\.pressed\.has\('bomb'\) && this\.bombs > 0 && this\.activeBombs\.length === 0[\s\S]*?this\.bomb\(\);/);
  assert.match(main, /this\.player\.deathbombTimer--;/);
  assert.match(main, /if \(this\.player\.deathbombTimer <= 0\) this\.commitMiss\(true\);/);
  assert.match(main, /commitMiss\(immediatePenalty = false\)/);
  assert.match(main, /this\.player\.deathFrame = immediatePenalty \? PLAYER_DEATH_DROP_DELAY : 0;/);
  assert.match(main, /if \(immediatePenalty\) \{[\s\S]*?this\.applyMissPenalty\(\);[\s\S]*?this\.player\.deathDropsDone = true;/);
  assert.match(main, /if \(this\.bombs > 0 && this\.activeBombs\.length === 0\)[\s\S]*?this\.startDeathbombWindow\(\);/);
  assert.match(main, /deathbombMarker\(PLAYFIELD\.x \+ g\.player\.x, PLAYFIELD\.y \+ g\.player\.y\)/);
});

test('spellcard capture bonus follows original score table and remaining-time formula', () => {
  const eclSource = readFileSync(new URL('../reference/th06-master/src/EclManager.cpp', import.meta.url), 'utf8');
  assert.match(eclSource, /g_SpellcardScore\) = \{[\s\S]*?200000, 200000, 200000/);
  assert.match(eclSource, /scoreIncrease =[\s\S]*?spellcardInfo\.captureScore \+[\s\S]*?spellcardInfo\.captureScore \* g_Gui\.SpellcardSecondsRemaining\(\) \/ 10/);
  assert.match(main, /TH06_LOGIC\.spellcardBonus\(this\.spellcardInfo\.idx \|\| 0, this\.bossUi\.timerSeconds\)/);
  assert.match(main, /this\.addScore\(bonus\)/);
  assert.match(main, /this\.showSpellcardBonus\(bonus\)/);
  assert.match(main, /spellcardBonusPopup = \{ bonus: Math\.max\(0, bonus \| 0\), timer: 280 \}/);
  assert.match(main, /this\.spellcardsCaptured\+\+/);
});

test('boss spell declaration follows original Gui ShowSpellcard surface', () => {
  const guiSource = readFileSync(new URL('../reference/th06-master/src/Gui.cpp', import.meta.url), 'utf8');
  assert.match(guiSource, /void Gui::ShowSpellcard\(i32 spellcardSprite, char \*spellcardName\)[\s\S]*?ANM_SCRIPT_FACE_ENEMY_SPELLCARD_PORTRAIT/);
  assert.match(guiSource, /SetActiveSprite\(&this->impl->enemySpellcardPortrait, ANM_SPRITE_FACE_STAGE_START \+ spellcardSprite\)/);
  assert.match(guiSource, /DrawStringFormat\(&this->impl->enemySpellcardName, 0xfff0f0, COLOR_RGB\(COLOR_BLACK\), spellcardName\)/);
  assert.match(guiSource, /blueSpellcardBarLength = strlen\(spellcardName\) \* 15 \/ 2\.0f \+ 16\.0f/);
  assert.match(guiSource, /g_SoundPlayer\.PlaySoundByIdx\(SOUND_BOMB, 0\)/);
  assert.match(main, /const ENEMY_SPELLCARD_DECLARATION_FRAMES = 130;/);
  assert.match(main, /const ENEMY_SPELLCARD_PORTRAIT_FRAMES = 120;/);
  assert.match(main, /showBossSpellDeclaration\(\{[\s\S]*?spellcardSprite,[\s\S]*?enemy: boss[\s\S]*?\}\);/);
  assert.match(main, /this\.audio\?\.sfx\(SOUND\.BOMB\);/);
  assert.match(main, /const x = 480 \+ \(320 - 480\) \* moveEase;/);
  assert.match(main, /const y = 312 \+ \(40 - 312\) \* moveEase;/);
  assert.match(main, /this\.sheetSprite\('front', 97, 224, 14, 16/);
});

test('score extends follow the original GameManager threshold table', () => {
  assert.match(gameManagerSource, /g_ExtraLivesScores\) = \{10000000, 20000000, 40000000, 60000000, 1900000000\}/);
  assert.match(gameManagerSource, /if \(gameManager->livesRemaining < MAX_LIVES\)[\s\S]*?SOUND_1UP[\s\S]*?gameManager->extraLives\+\+;[\s\S]*?IncreaseSubrank\(200\)/);
  assert.match(logic, /const EXTRA_LIFE_SCORES = \[10000000, 20000000, 40000000, 60000000, 1900000000\]/);
  assert.match(logic, /const MAX_SCORE = 999999999/);
  assert.match(main, /addScore\(points\)[\s\S]*?TH06_LOGIC\.MAX_SCORE - 9[\s\S]*?this\.checkScoreExtends\(\)/);
  assert.match(main, /TH06_LOGIC\.EXTRA_LIFE_SCORES\[this\.extraLifeIndex\] <= this\.score[\s\S]*?this\.lives\+\+;[\s\S]*?SOUND\.ONE_UP[\s\S]*?this\.extraLifeIndex\+\+;[\s\S]*?this\.increaseSubrank\(200\)/);
  assert.doesNotMatch(logic, /5000000/);
});

test('Stage 1 Lunatic all-kill resource totals contain no bomb or life drops', async () => {
  await import('../src/vanilla/th06-logic.js');
  await import('../src/vanilla/th06-data.js');
  await import('../src/vanilla/th06-effects-data.js');
  await import('../src/vanilla/th06-runtime.js');
  const data = globalThis.TH06_EMBEDDED_DATA.games.th06.stages[1];
  const runtime = new globalThis.Th06StageRuntime(data);
  const counts = {};
  const rng = { f: () => 0.5, range: (v) => v * 0.5, between: (a, b) => a + (b - a) * 0.5 };
  const game = {
    id: 1,
    rank: 16,
    stageFrame: 0,
    power: 0,
    score: 0,
    enemies: [],
    enemyBullets: [],
    enemyLasers: [],
    items: [],
    rng,
    player: { x: 192, y: 400 },
    stageMeta: {},
    addScore(points) { this.score += points; },
    setBossLives() {},
    setBossPresent() {},
    setBossLifeCount() {},
    startBossSpell() { return ''; },
    endBossSpell() {},
    spawnLaser(laser) { this.enemyLasers.push(laser); },
    spawnEffectParticles() {},
    spawnSpellEffect() {},
    requestDialogue() {},
    startDialogue() {},
    consumeDialogueResume() { return true; },
    isDialogueBlocking() { return false; },
    text() {},
    audio: { sfx() {} },
    spawnItem(type, x, y, options = {}) {
      counts[type] = (counts[type] || 0) + 1;
      this.items.push({ type, x, y, options });
      return this.items[this.items.length - 1];
    }
  };
  for (let frame = 0; frame < 8200; frame++) {
    game.stageFrame = frame;
    globalThis.__touhouGameRank = game.rank;
    globalThis.__touhouPlayerX = game.player.x;
    globalThis.__touhouPlayerY = game.player.y;
    runtime.update(game);
    for (const enemy of [...game.enemies]) {
      enemy.frame = (enemy.frame || 0) + 1;
      if (enemy.ecl) runtime.updateEnemy(game, enemy);
      if (enemy.ecl?.canTakeDamage !== false && enemy.hp > 0) enemy.hp = 0;
      if (enemy.hp <= 0) {
        const keep = runtime.killEnemy(game, enemy);
        if (!keep) enemy.dead = true;
      }
    }
    game.enemies = game.enemies.filter((enemy) => !enemy.dead);
  }
  assert.deepEqual(counts, { bigPower: 4, point: 32, power: 59 });
  assert.equal(game.items.length, 95);
});

test('Stage 2 Lunatic all-kill resource totals include Cirno bomb and no life drop', async () => {
  await import('../src/vanilla/th06-logic.js');
  await import('../src/vanilla/th06-data.js');
  await import('../src/vanilla/th06-effects-data.js');
  await import('../src/vanilla/th06-runtime.js');
  const data = globalThis.TH06_EMBEDDED_DATA.games.th06.stages[2];
  const runtime = new globalThis.Th06StageRuntime(data);
  const counts = {};
  const rng = { f: () => 0.5, range: (v) => v * 0.5, between: (a, b) => a + (b - a) * 0.5 };
  const game = {
    id: 1,
    rank: 16,
    stageFrame: 0,
    power: 0,
    score: 0,
    enemies: [],
    enemyBullets: [],
    enemyLasers: [],
    items: [],
    rng,
    player: { x: 192, y: 400 },
    stageMeta: {},
    addScore(points) { this.score += points; },
    setBossLives() {},
    setBossPresent() {},
    setBossLifeCount() {},
    startBossSpell() { return ''; },
    endBossSpell() {},
    spawnLaser(laser) { this.enemyLasers.push(laser); },
    spawnEffectParticles() {},
    spawnSpellEffect() {},
    requestDialogue() {},
    startDialogue() {},
    consumeDialogueResume() { return true; },
    isDialogueBlocking() { return false; },
    turnBulletsIntoPointItems() {
      this.enemyBullets = [];
      this.enemyLasers = [];
    },
    text() {},
    audio: { sfx() {} },
    spawnItem(type, x, y, options = {}) {
      counts[type] = (counts[type] || 0) + 1;
      this.items.push({ type, x, y, options });
      return this.items[this.items.length - 1];
    }
  };
  for (let frame = 0; frame < 9500; frame++) {
    game.stageFrame = frame;
    globalThis.__touhouGameRank = game.rank;
    globalThis.__touhouPlayerX = game.player.x;
    globalThis.__touhouPlayerY = game.player.y;
    runtime.update(game);
    for (const enemy of [...game.enemies]) {
      enemy.frame = (enemy.frame || 0) + 1;
      if (enemy.ecl) runtime.updateEnemy(game, enemy);
      if (enemy.ecl?.canTakeDamage !== false && enemy.hp > 0) enemy.hp = 0;
      if (enemy.hp <= 0) {
        const keep = runtime.killEnemy(game, enemy);
        if (!keep) enemy.dead = true;
      }
    }
    game.enemies = game.enemies.filter((enemy) => !enemy.dead);
  }
  assert.deepEqual(counts, { power: 102, point: 117, bomb: 1, bigPower: 4 });
  assert.equal(counts.life || 0, 0);
  assert.equal(game.items.length, 224);
});

test('runtime boss callbacks follow EnemyManager life/timer transition rules', () => {
  assert.match(readFileSync(new URL('../reference/th06-master/src/EnemyManager.cpp', import.meta.url), 'utf8'), /if \(this->life < this->lifeCallbackThreshold\)[\s\S]*?this->life = this->lifeCallbackThreshold;[\s\S]*?this->timerCallbackSub = this->deathCallbackSub;[\s\S]*?this->stackDepth = 0;/);
  assert.match(runtime, /e\.hp < s\.lifeCallbackThreshold[\s\S]*?e\.hp = s\.lifeCallbackThreshold;[\s\S]*?s\.timerCallbackSub = s\.deathCallbackSub;[\s\S]*?this\.resetCallbackRanks\(s\);/);
  assert.match(runtime, /s\.bossTimer >= s\.timerCallbackThreshold[\s\S]*?e\.hp = s\.lifeCallbackThreshold;[\s\S]*?s\.timerCallbackSub = s\.deathCallbackSub;[\s\S]*?s\.bossTimer = 0;/);
});

test('enemy interval shots use the current enemy position like EclManager', async () => {
  const eclSource = readFileSync(new URL('../reference/th06-master/src/EclManager.cpp', import.meta.url), 'utf8');
  assert.match(eclSource, /enemy->bulletProps\.position = enemy->position \+ enemy->shootOffset;[\s\S]*?g_BulletManager\.SpawnBulletPattern\(&enemy->bulletProps\);/);
  assert.match(runtime, /const shootX = origin\?\.x \?\? e\.x \+ e\.ecl\.shootOffset\.x;[\s\S]*?const shootY = origin\?\.y \?\? e\.y \+ e\.ecl\.shootOffset\.y;[\s\S]*?x: shootX,[\s\S]*?y: shootY,/);
  assert.doesNotMatch(runtime, /x: e\.x \+ e\.ecl\.shootOffset\.x,[\s\S]*?y: e\.y \+ e\.ecl\.shootOffset\.y/);

  await import('../src/vanilla/th06-logic.js');
  await import('../src/vanilla/th06-data.js');
  await import('../src/vanilla/th06-effects-data.js');
  await import('../src/vanilla/th06-runtime.js');
  const data = globalThis.TH06_EMBEDDED_DATA.games.th06.stages[1];
  const stageRuntime = new globalThis.Th06StageRuntime(data);
  const game = {
    id: 1,
    rank: 16,
    difficulty: 'lunatic',
    player: { x: 192, y: 400 },
    enemyBullets: [],
    enemyLasers: [],
    rng: { f: () => 0.5, range: (v) => v * 0.5 },
    audio: { sfx() {} }
  };
  const enemy = {
    id: game.id++,
    x: 60,
    y: -32,
    z: 0,
    hp: 300,
    maxHp: 300,
    ecl: stageRuntime.makeEnemyState(0, false, -1)
  };

  stageRuntime.runEcl(game, enemy);
  assert.equal(game.enemyBullets.length, 0);
  assert.ok(enemy.ecl.bulletProps);
  assert.ok(enemy.ecl.shootInterval > 0);

  enemy.x = 88;
  enemy.y = 96;
  enemy.ecl.shootTimer = enemy.ecl.shootInterval - 1;
  stageRuntime.updateAutoShoot(game, enemy);

  assert.equal(game.enemyBullets.length, 1);
  assert.equal(game.enemyBullets[0].x, 88);
  assert.equal(game.enemyBullets[0].y, 96);
});

test('runtime resolves float-encoded ECL variables like GetVarFloat', () => {
  assert.match(stage1Decl, /ins_67\(1,\s*5,\s*1,\s*3,\s*-10005\.0f,\s*0\.8f,\s*-10006\.0f/);
  assert.match(readFileSync(new URL('../reference/th06-master/src/EnemyEclInstr.cpp', import.meta.url), 'utf8'), /i32 varId = \*eclVarId;[\s\S]*?GetVar\(enemy, \(EclVarId \*\)&varId/);
  assert.match(runtime, /const floatVarId = Math\.trunc\(value\);[\s\S]*?this\.varValue\(e, floatVarId\)/);
  assert.match(runtime, /TH06_GLOBAL\.__touhouPlayerX \?\? 192/);
  assert.doesNotMatch(runtime, /__touhouPlayerX \|\| 192/);
});

test('ReimuA power table keeps BulletData.cpp rank thresholds and key damages', () => {
  for (const max of [8, 16, 32, 48, 64, 80, 96, 127, 999]) {
    assert.match(main, new RegExp(`\\{ max: ${max}, bullets:`));
  }
  assert.match(main, /reimuABullet\(5,\s*0,\s*0,\s*0,\s*-90,\s*12,\s*48,\s*0,\s*ANM_SCRIPT_PLAYER_BULLET,\s*SOUND\.SHOOT\)/);
  assert.match(main, /reimuABullet\(15,\s*0,\s*0,\s*0,\s*-120,\s*10,\s*12,\s*1,\s*ANM_SCRIPT_PLAYER_REIMU_A_ORB_BULLET\)/);
  assert.match(main, /reimuABullet\(16,\s*12,\s*0,\s*0,\s*-9\.9999979,\s*10,\s*10,\s*2,\s*ANM_SCRIPT_PLAYER_REIMU_A_ORB_BULLET\)/);
  assert.match(main, /const rank = REIMU_A_POWER\.find\(\(entry\) => power < entry\.max\)/);
  assert.match(main, /if \(!rank\) throw new Error\(`Missing original ReimuA BulletData power rank for \$\{power\}`\)/);
});

test('original enemy damage model caps total damage after summing per enemy frame', () => {
  assert.match(playerSource, /damage \+= bullet->damage;/);
  assert.match(playerSource, /damage \+= bullet->damage \/ 3 != 0 \? bullet->damage \/ 3 : 1;/);
  assert.match(playerSource, /damage \+= this->bombRegionDamages\[idx\];/);
  const enemyManagerSource = readFileSync(new URL('../reference/th06-master/src/EnemyManager.cpp', import.meta.url), 'utf8');
  assert.match(enemyManagerSource, /if \(70 <= damage\)[\s\S]*?damage = 70;/);
  assert.match(enemyManagerSource, /if \(mgr->spellcardInfo\.isActive != 0\)[\s\S]*?damage = damage \/ 7;[\s\S]*?damage = damage \/ 3;/);
  assert.match(main, /TH06_LOGIC\.spellcardDamageForEnemy\(capped, entry\.hitWithBombRegion, this\.spellcardInfo\.usedBomb\)/);
});

test('ReimuA Dream Seal bomb keeps BombData.cpp sound and collision timing', () => {
  const bombSource = readFileSync(new URL('../reference/th06-master/src/BombData.cpp', import.meta.url), 'utf8');
  assert.match(bombSource, /player->bombInfo\.duration = 300;/);
  assert.match(bombSource, /player->invulnerabilityTimer\.SetCurrent\(360\);/);
  assert.match(bombSource, /bombProjectiles\[8\]\.sizeX = 256\.0f;[\s\S]*?bombProjectiles\[8\]\.sizeY = 256\.0f;/);
  assert.match(bombSource, /timer\.AsFrames\(\) % 16 == 0 && \(i = \(player->bombInfo\.timer\.AsFrames\(\) - 60\) \/ 16\)/);
  assert.match(readFileSync(new URL('../reference/th06-master/src/Gui.cpp', import.meta.url), 'utf8'), /ShowBombNamePortrait[\s\S]*?PlaySoundByIdx\(SOUND_BOMB, 0\)/);
  assert.match(bombSource, /g_SoundPlayer\.PlaySoundByIdx\(SOUND_BOMB_REIMU_A, 0\);/);
  assert.match(bombSource, /bombRegionSizes\[i\]\.x = 48\.0f;[\s\S]*?bombRegionDamages\[i\] = 8;/);
  assert.match(bombSource, /bombRegionSizes\[i\]\.x = 256\.0f;[\s\S]*?bombRegionDamages\[i\] = 200;[\s\S]*?g_SoundPlayer\.PlaySoundByIdx\(SOUND_F, 0\);/);
  assert.match(logic, /duration:\s*300/);
  assert.match(logic, /invuln:\s*360/);
  assert.match(logic, /ctx\.onCancelBox\?\.\(ctx\.player\.x, ctx\.player\.y, 256, 256\)/);
  assert.match(logic, /ctx\.onSound\?\.\(14\)/);
  assert.match(logic, /if \(idx > 0 && idx < bomb\.projectiles\.length\)/);
  assert.match(logic, /ctx\.onSound\?\.\(13\)/);
  assert.match(logic, /ctx\.onDamageBox\?\.\(p\.x, p\.y, 48, 48, 8, 'bomb'\)/);
  assert.match(logic, /ctx\.onDamageBox\?\.\(p\.x, p\.y, 256, 256, 200, 'bombExplosion'\)/);
  assert.doesNotMatch(main, /spec\.id === 'reimuA' \? SOUND\.BOMB_REIMU_A/);
});

test('all four player shot types use source BulletData tables', () => {
  const bulletDataSource = readFileSync(new URL('../reference/th06-master/src/BulletData.cpp', import.meta.url), 'utf8');
  assert.match(main, /new Set\(\['reimuA', 'reimuB', 'marisaA', 'marisaB'\]\)/);
  assert.doesNotMatch(main, /function shotPieces/);
  assert.match(main, /sourcePowerData\(spec\.id, this\.power\)/);
  assert.match(main, /this\.player\.shotFrame >= 30\) this\.player\.shotFrame = -1/);
  assert.match(playerData, /reimuB: REIMU_B_POWER/);
  assert.match(playerData, /marisaA: MARISA_A_POWER/);
  assert.match(playerData, /marisaB: MARISA_B_POWER/);
  assert.match(bulletDataSource, /g_CharacterPowerDataReimuB/);
  assert.match(bulletDataSource, /g_CharacterPowerDataMarisaA/);
  assert.match(bulletDataSource, /g_CharacterPowerDataMarisaB/);
  assert.match(readFileSync(new URL('../reference/th06-master/src/Player.hpp', import.meta.url), 'utf8'), /PlayerBullet bullets\[80\];/);
  assert.match(main, /const PLAYER_BULLET_CAP = 80;/);
  assert.match(main, /if \(this\.playerBullets\.length >= PLAYER_BULLET_CAP\) return;/);
  assert.match(playerData, /\[3, 0, 12, -16, 12, 40, -90, 22, 10, 1, B0, REIMU_B_ORB, SHOOT\]/);
  assert.match(playerData, /\[10, 0, 0, 0, 12, 12, -98, 3, 14, 1, B2, MARISA_A_ORB_4\]/);
  assert.match(playerData, /\[330, 0, 0, 0, 20, 480, -90, 3, 6, 1, LASER, MARISA_B_LASER_3\]/);
  assert.match(main, /laserSlot = p\.frame \| 0;[\s\S]*?this\.player\.laserTimers\[laserSlot\] = p\.wait/);
  assert.match(main, /playerLaser\(b\) \{[\s\S]*?const frame = anm\.scriptFrame\(b\.script, 0, b\.age \|\| 0, interrupt\);[\s\S]*?this\.drawAnmFrame\('player01', frame/);
  assert.match(main, /scaleY: Math\.max\(0\.01, \(b\.sy \|\| 1\) \/ Math\.max\(1, frame\.h\)\)/);
  assert.doesNotMatch(main, /rgba\(120, 90, 255/);
});

test('player sprite and hit effects follow Player.cpp source behavior', () => {
  assert.match(playerSource, /ANM_SCRIPT_PLAYER_MOVING_LEFT/);
  assert.match(playerSource, /ANM_SCRIPT_PLAYER_STOPPING_LEFT/);
  assert.match(playerSource, /ANM_SCRIPT_PLAYER_MOVING_RIGHT/);
  assert.match(playerSource, /ANM_SCRIPT_PLAYER_STOPPING_RIGHT/);
  assert.match(playerSource, /else\s*\{[\s\S]*?this->unk_9e4\+\+;[\s\S]*?this->unk_9e4 % 8 == 0[\s\S]*?PARTICLE_EFFECT_UNK_5/);
  assert.match(playerSource, /bombRegionDamages\[idx\];[\s\S]*?this->unk_9e4\+\+;[\s\S]*?this->unk_9e4 % 4 == 0[\s\S]*?PARTICLE_EFFECT_UNK_3/);
  assert.match(main, /const ANM_SCRIPT_PLAYER_MOVING_LEFT = 1;/);
  assert.match(main, /if \(horizontalSpeed < 0 && prevX >= 0\) this\.setPlayerAnimScript\(ANM_SCRIPT_PLAYER_MOVING_LEFT\)/);
  assert.match(main, /else if \(horizontalSpeed === 0 && prevX < 0\) this\.setPlayerAnimScript\(ANM_SCRIPT_PLAYER_STOPPING_LEFT\)/);
  assert.match(main, /if \(horizontalSpeed > 0 && prevX <= 0\) this\.setPlayerAnimScript\(ANM_SCRIPT_PLAYER_MOVING_RIGHT\)/);
  assert.match(main, /else if \(horizontalSpeed === 0 && prevX > 0\) this\.setPlayerAnimScript\(ANM_SCRIPT_PLAYER_STOPPING_RIGHT\)/);
  assert.match(main, /g\.player\.animDrawFrame \?\? g\.stageFrame/);
  assert.match(main, /g\.player\.animScript \?\? ANM_SCRIPT_PLAYER_IDLE/);
  assert.match(main, /playerLaserHitEffect\(b, e\)/);
  assert.match(main, /this\.player\.hitEffectCounter % 8 !== 0/);
  assert.match(main, /this\.spawnEffectParticles\(5, b\.x, enemy\.y, 1, 0xffffffff\)/);
  assert.match(main, /this\.player\.hitEffectCounter % 4 !== 0/);
  assert.match(main, /this\.spawnEffectParticles\(3, enemy\.x, enemy\.y, 1, 0xffffffff\)/);
});

test('MarisaA missiles use original finite collided bullet animation', () => {
  assert.match(playerSource, /bullet->bulletType == BULLET_TYPE_2[\s\S]*?bullet->damage = bullet->damage \/ 4/);
  assert.match(playerSource, /g_AnmManager->SetAndExecuteScriptIdx\(&bullet->sprite, bullet->sprite\.anmFileIndex \+ 0x20\)/);
  assert.match(playerSource, /bullet->bulletState = BULLET_STATE_COLLIDED;[\s\S]*?bullet->velocity\.x \/= 8\.0f;[\s\S]*?bullet->velocity\.y \/= 8\.0f;/);
  assert.match(playerSource, /if \(g_AnmManager->ExecuteScript\(&bullet->sprite\)\)[\s\S]*?bullet->bulletState = BULLET_STATE_UNUSED;/);
  assert.match(main, /b\.bulletType === BULLET_TYPE_ACCEL && b\.state === 'collided'/);
  assert.match(main, /const hitScript = b\.script \+ 0x20;/);
  assert.match(main, /b\.hitLife = Math\.max\(1, anm\?\.scriptDuration\(hitScript\) \|\| 20\);/);
  assert.match(main, /if \(\(b\.hitAge \|\| 0\) >= \(b\.hitLife \|\| 20\)\) b\.dead = true;/);
  assert.match(main, /if \(b\.bulletType === BULLET_TYPE_ACCEL\) this\.applyMarisaAStarHit\(b\);/);
  assert.match(main, /this\.game\.refreshPlayerBulletRect\?\.\(b\) \|\| b\.rect/);
  assert.doesNotMatch(main, /collideMarisaAStar/);
});

test('remaining player bombs follow BombData.cpp collision cadence and sounds', () => {
  const bombSource = readFileSync(new URL('../reference/th06-master/src/BombData.cpp', import.meta.url), 'utf8');
  assert.match(bombSource, /BombReimuBCalc[\s\S]*?duration = 140;[\s\S]*?SetCurrent\(200\);[\s\S]*?SOUND_BOMB_REIMARI/);
  assert.match(bombSource, /BombMarisaACalc[\s\S]*?duration = 250;[\s\S]*?SetCurrent\(300\);[\s\S]*?sizeX = 128\.0f;[\s\S]*?bombRegionDamages\[i\] = 8;/);
  assert.match(bombSource, /BombMarisaBCalc[\s\S]*?duration = 300;[\s\S]*?SetCurrent\(360\);[\s\S]*?sizeX = 384\.0f;[\s\S]*?bombRegionDamages\[0\] = 12;/);
  assert.match(logic, /duration:\s*140,[\s\S]*?invuln:\s*200/);
  assert.match(logic, /duration:\s*250,[\s\S]*?invuln:\s*300/);
  assert.match(logic, /duration:\s*300,[\s\S]*?invuln:\s*360/);
  assert.match(logic, /ctx\.onCancelBox\?\.\(star\.x, star\.y, 128, 128\)/);
  assert.match(logic, /const frame = ctx\.onBombFrame\?\.\('reimuB', i, bomb\.frame\);/);
  assert.match(main, /onBombFrame: \(type, index, frame\) =>/);
  assert.match(logic, /ctx\.onDamageBox\?\.\(192, bomb\.y, 384, bomb\.h, 12, 'bombMarisaB'\)/);
  assert.match(main, /onText: \(label\) => this\.showPlayerBombDeclaration\(label\)/);
  assert.doesNotMatch(main, /SOUND\.BOMB_MARISA_B : spec\.family/);
});

test('player bomb rendering preserves original ANM tinting and does not fall back over source scripts', () => {
  const bombSource = readFileSync(new URL('../reference/th06-master/src/BombData.cpp', import.meta.url), 'utf8');
  assert.match(bombSource, /BombReimuBDraw[\s\S]*?g_AnmManager->Draw\(bombSprite\);/);
  assert.match(bombSource, /BombMarisaBDraw[\s\S]*?g_AnmManager->Draw\(bombSprite\);/);
  assert.match(main, /tctx\.globalCompositeOperation = 'multiply';[\s\S]*?tctx\.globalCompositeOperation = 'destination-in';/);
  assert.doesNotMatch(main, /tctx\.globalCompositeOperation = 'source-atop';/);
  assert.doesNotMatch(main, /this\.flash = spec\.id === 'reimuA'/);
  assert.match(main, /hasAnmScript\(anm, scriptId\)/);
  assert.match(main, /ANM_SCRIPT_PLAYER_REIMU_B_BOMB_ARRAY \+ i;[\s\S]*?if \(!this\.hasAnmScript\(anm, scriptId\)\) continue;[\s\S]*?this\.drawAnmFrame\('player00'/);
  assert.match(main, /ANM_SCRIPT_PLAYER_MARISA_B_MASTER_SPARK \+ i;[\s\S]*?if \(!this\.hasAnmScript\(anm, scriptId\)\) continue;[\s\S]*?this\.drawAnmFrame\('player01'/);
  assert.doesNotMatch(main, /fallbackAlpha/);
  assert.doesNotMatch(main, /createRadialGradient/);
  assert.doesNotMatch(main, /rgba\(255, 80, 120/);
});

test('runtime emits source-style enemy and spell effects, and clips bullets to the playfield', () => {
  const bulletSource = readFileSync(new URL('../reference/th06-master/src/BulletManager.cpp', import.meta.url), 'utf8');
  assert.match(bulletSource, /curBullet->unk_5c0\+\+;[\s\S]*?if \(curBullet->unk_5c0 >= 0x100\)/);
  assert.match(runtime, /game\.spawnEnemyDeathEffect\?\.\(e, s\)/);
  assert.match(runtime, /s\.isBoss && game\.spellcardInfo\?\.isActive\) game\.endBossSpell\?\.\(\{ fromBossDeath: true \}\);/);
  assert.match(runtime, /const EFFECT_SCRIPT_TABLE = \[/);
  assert.match(runtime, /effectSpec\(effectId\)/);
  assert.match(runtime, /effectFrame\(effectId, frame = 0, randomIndex = 0, color = 0xffffffff\)/);
  assert.match(effectsData, /"?etama4Anm"?:/);
  assert.match(effectsData, /"?eff01Anm"?:/);
  assert.match(runtime, /if \(!effectData\?\.etama4Anm \|\| !effectData\?\.eff01Anm\) throw new Error/);
  assert.match(main, /etama4: 'assets\/th06-img\/png\/etama4\.png'/);
  assert.match(main, /eff01: 'assets\/th06-img\/png\/eff01\.png'/);
  assert.match(main, /type: 'anmEffect'/);
  assert.match(main, /spawnEnemyDeathEffect\(enemy, state = enemy\.ecl \|\| \{\}\)/);
  assert.match(main, /spawnEffectParticles\(primary, x, y, primaryCount/);
  assert.match(main, /spawnBossBreakBurst\(enemy, false\)/);
  assert.match(main, /spawnBossBreakBurst\(enemy, true\)/);
  assert.match(main, /type: 'bossBreakRing'/);
  assert.match(main, /type: 'bossBreakSpark'/);
  assert.match(main, /spawnEffectParticles\(13, boss\.x, boss\.y, 1/);
  assert.match(main, /spellBackground\(\)/);
  assert.match(main, /this\.spellcardInfo\.frame = 0;/);
  assert.match(main, /this\.spellcardInfo\.frame = \(this\.spellcardInfo\.frame \|\| 0\) \+ 1;/);
  assert.match(main, /this\.ctx\.rect\(PLAYFIELD\.x, PLAYFIELD\.y, PLAYFIELD\.width, PLAYFIELD\.height\);[\s\S]*?this\.ctx\.clip\(\);/);
  assert.match(main, /ctx\.createPattern\(img, 'repeat'\)/);
  assert.match(main, /PLAYFIELD\.width \+ img\.width \* 2/);
  assert.match(main, /this\.inArcadeBounds\(b\.x, b\.y, w, h\)/);
  assert.match(main, /b\.outFrames = \(b\.outFrames \|\| 0\) \+ 1;[\s\S]*?keep = b\.outFrames < 0x100;/);
  assert.match(main, /enemyBullet\(x, y, b\) \{[\s\S]*?if \(!b\.rect\) return;[\s\S]*?this\.drawAnmFrame\(b\.rect\.imageKey \|\| 'etama3'/);
  assert.doesNotMatch(main, /BULLET_COLUMNS/);
  assert.doesNotMatch(main, /BULLET_ROWS/);
  assert.doesNotMatch(runtime, /scriptSprite\(sprite, 0, 0/);
  assert.doesNotMatch(runtime, /scriptSprite\(0, 0, 0/);
});

test('non-final stage clear flies into the next stage while the final stage keeps result UI', () => {
  assert.match(main, /const STAGE_TRANSITION_FRAMES = 240;/);
  assert.match(main, /const STAGE_TRANSITION_FLY_FRAMES = 120;/);
  assert.match(main, /const STAGE_ENTRY_FADE_FRAMES = 45;/);
  assert.match(main, /if \(this\.phase === 'stageTransition'\) return this\.updateStageTransition\(input\);/);
  assert.match(main, /updateStageTransition\(input\) \{[\s\S]*?this\.player\.y = tr\.startY \+ \(-58 - tr\.startY\) \* ease;[\s\S]*?if \(tr\.frame >= tr\.duration\) this\.startNextStage\(\);/);
  assert.match(main, /const hasNextStage = this\.hasNextStage\(\);[\s\S]*?this\.phase = hasNextStage \? 'stageTransition' : 'stageClear';/);
  assert.match(main, /this\.stageTransition = hasNextStage \? \{[\s\S]*?duration: STAGE_TRANSITION_FRAMES,[\s\S]*?toStage: this\.currentStageNumber \+ 1,[\s\S]*?startY: this\.player\.y[\s\S]*?\} : null;/);
  assert.match(main, /this\.stageEntryFade = STAGE_ENTRY_FADE_FRAMES;/);
  assert.match(main, /stageTransitionOverlay\(\) \{[\s\S]*?tr\.frame - STAGE_TRANSITION_FLY_FRAMES \* 0\.55[\s\S]*?g\.stageEntryFade \/ STAGE_ENTRY_FADE_FRAMES/);
  assert.match(main, /if \(hasNextStage\) \{[\s\S]*?this\.player\.state = 'invuln';[\s\S]*?this\.player\.invuln = PLAYER_RESPAWN_INVULN;/);
  assert.doesNotMatch(main, /this\.text\('Stage Clear'/);
  assert.match(main, /if \(g\.phase === 'stageClear'\) \{[\s\S]*?this\.stageClearOverlay\(\);/);
});

test('effect ANM runtime exposes Stage 1 etama4 and eff01 frames', async () => {
  await import('../src/vanilla/th06-logic.js');
  await import('../src/vanilla/th06-data.js');
  await import('../src/vanilla/th06-effects-data.js');
  await import('../src/vanilla/th06-runtime.js');
  const data = globalThis.TH06_EMBEDDED_DATA.games.th06.stages[1];
  const rt = new globalThis.Th06StageRuntime(data);
  const splash = rt.effectFrame(3, 0, 0, 0xffffffff);
  const spellBg = rt.effectFrame(16, 30, 0, 0xffffffff);
  const pellet = rt.bulletRect(0, 6);
  const ring = rt.bulletRect(1, 2);
  const rice = rt.bulletRect(2, 6);
  const rumiaIdle = rt.enemy2Anm.scriptSprite(128, 0, 60);
  const rumiaLeftEnd = rt.enemy2Anm.scriptSprite(129, 0, 60);
  const rumiaRightEnd = rt.enemy2Anm.scriptSprite(132, 0, 60);
  assert.equal(splash.imageKey, 'etama4');
  assert.equal(spellBg.imageKey, 'eff01');
  assert.equal(pellet.imageKey, 'etama3');
  assert.equal(ring.imageKey, 'etama3');
  assert.equal(rice.autoRotate, 1);
  assert.ok(rumiaIdle);
  assert.ok(rumiaIdle.w > 0 && rumiaLeftEnd.w > 0 && rumiaRightEnd.w > 0);
  assert.ok(splash.w > 0 && splash.h > 0);
  assert.ok(spellBg.w >= 384 && spellBg.h >= 448);
  assert.ok(pellet.w > 0 && ring.w > 0 && rice.w > 0);
});

test('player graze scoring follows Player::ScoreGraze semantics', () => {
  assert.match(playerSource, /void Player::ScoreGraze[\s\S]*?if \(g_Player\.bombInfo\.isInUse == 0\)[\s\S]*?g_GameManager\.grazeInStage\+\+/);
  assert.match(playerSource, /void Player::ScoreGraze[\s\S]*?g_GameManager\.AddScore\(500\);[\s\S]*?g_GameManager\.IncreaseSubrank\(6\);[\s\S]*?SOUND_GRAZE/);
  assert.match(main, /scoreGraze\(center\)[\s\S]*?if \(this\.activeBombs\.length === 0\) this\.graze\+\+;[\s\S]*?this\.addScore\(500\);[\s\S]*?this\.increaseSubrank\(6\);[\s\S]*?SOUND\.GRAZE/);
  assert.doesNotMatch(main, /this\.graze % 6/);
});

test('player sprite is rendered around original positionCenter using ANM sprite dimensions', () => {
  assert.match(playerSource, /playerSprite\.pos\.x = g_GameManager\.arcadeRegionTopLeftPos\.x \+ p->positionCenter\.x/);
  assert.match(playerSource, /playerSprite\.pos\.y = g_GameManager\.arcadeRegionTopLeftPos\.y \+ p->positionCenter\.y/);
  const anmManagerSource = readFileSync(new URL('../reference/th06-master/src/AnmManager.cpp', import.meta.url), 'utf8');
  assert.match(anmManagerSource, /fVar2 = \(vm->sprite->widthPx \* vm->scaleX\) \/ 2\.0f;/);
  assert.match(anmManagerSource, /fVar3 = \(vm->sprite->heightPx \* vm->scaleY\) \/ 2\.0f;/);
  assert.match(main, /const scriptFrame = scriptId === ANM_SCRIPT_PLAYER_IDLE \? frameSeed % 32 : frameSeed;/);
  assert.match(main, /scriptSprite\(scriptId, 0, scriptFrame\)/);
  assert.match(main, /this\.drawAnmFrame\(spec\.sheet, rect, x, y/);
  assert.match(main, /scaleX: \(rect\.scaleX \?\? 1\) \* scale/);
  assert.match(main, /scaleY: \(rect\.scaleY \?\? 1\) \* scaleY/);
  assert.doesNotMatch(main, /PLAYER_FRAME/);
});

test('every mapped original sound effect buffer points to an existing wav asset', () => {
  const match = main.match(/const SFX_FILES = \[([\s\S]*?)\];/);
  assert.ok(match);
  const files = [...match[1].matchAll(/'([^']+\.wav)'/g)].map((m) => m[1]);
  assert.equal(files.length, 26);
  assert.match(main, /const SFX_MAP = TH06_LOGIC\.SFX_BUFFER_IDX_VOLUME/);
  const soundMap = [...logic.matchAll(/\[(\d+),\s*-[0-9]+(?:,\s*[0-9]+)?\]/g)].map((m) => Number(m[1]));
  assert.ok(soundMap.length >= 32);
  for (const fileIndex of soundMap.slice(0, 32)) {
    assert.ok(files[fileIndex], `missing SFX_FILES entry for buffer ${fileIndex}`);
    assert.ok(existsSync(new URL(`../assets/sfx/${files[fileIndex]}`, import.meta.url)), files[fileIndex]);
  }
  assert.match(main, /if \(audio\.readyState < HTML_AUDIO_HAVE_CURRENT_DATA\) \{[\s\S]*?audio\.load\(\);[\s\S]*?return;[\s\S]*?\}/);
});

test('embedded Stage 1 ECL/STD runtime can step through the demo window', async () => {
  await import('../src/vanilla/th06-logic.js');
  await import('../src/vanilla/th06-data.js');
  await import('../src/vanilla/th06-effects-data.js');
  await import('../src/vanilla/th06-runtime.js');
  const data = globalThis.TH06_EMBEDDED_DATA.games.th06.stages[1];
  const runtime = new globalThis.Th06StageRuntime(data);
  const rng = { f: () => 0.5, range: (v) => v * 0.5, between: (a, b) => a + (b - a) * 0.5 };
  const game = {
    id: 1,
    rank: 16,
    difficulty: 'lunatic',
    stageFrame: 0,
    enemies: [],
    enemyBullets: [],
    enemyLasers: [],
    items: [],
    rng,
    player: { x: 192, y: 400 },
    stageMeta: {},
    setBossLives() {},
    startBossSpell() {},
    endBossSpell() {},
    spawnLaser(laser) { this.enemyLasers.push(laser); },
    spawnEffectParticles() {},
    spawnSpellEffect() {},
    requestDialogue() {},
    consumeDialogueResume() { return true; },
    text() {},
    audio: { sfx() {} }
  };
  const missingVisibleSprites = [];
  for (let frame = 0; frame < 3600; frame++) {
    game.stageFrame = frame;
    globalThis.__touhouGameRank = game.rank;
    globalThis.__touhouPlayerX = game.player.x;
    globalThis.__touhouPlayerY = game.player.y;
    runtime.update(game);
    for (const enemy of [...game.enemies]) {
      enemy.frame = (enemy.frame || 0) + 1;
      if (enemy.ecl) runtime.updateEnemy(game, enemy);
      const onScreen = enemy.x > -32 && enemy.x < 416 && enemy.y > -48 && enemy.y < 480;
      if (onScreen && enemy.ecl && !enemy.ecl.invisible && !runtime.enemyRect(enemy)) {
        missingVisibleSprites.push({ frame, script: enemy.ecl.currentAnm });
      }
      if (enemy.dead) game.enemies = game.enemies.filter((entry) => entry !== enemy);
    }
  }
  assert.ok(game.enemies.length > 0);
  assert.ok(game.enemyBullets.length > 0);
  assert.deepEqual(missingVisibleSprites, []);
});

test('embedded Stage 2 ECL/STD runtime can reach Cirno without missing visible sprites', async () => {
  await import('../src/vanilla/th06-logic.js');
  await import('../src/vanilla/th06-data.js');
  await import('../src/vanilla/th06-effects-data.js');
  await import('../src/vanilla/th06-runtime.js');
  const data = globalThis.TH06_EMBEDDED_DATA.games.th06.stages[2];
  const runtime = new globalThis.Th06StageRuntime(data);
  const rng = { f: () => 0.5, range: (v) => v * 0.5 };
  const game = {
    id: 1,
    rank: 16,
    stageFrame: 0,
    enemies: [],
    enemyBullets: [],
    enemyLasers: [],
    items: [],
    rng,
    player: { x: 192, y: 400 },
    setBossPresent() {},
    setBossLifeCount() {},
    startBossSpell(id) { return `spell-${id}`; },
    endBossSpell() {},
    spawnEffectParticles() {},
    spawnSpellEffect() {},
    consumeDialogueResume() { return true; },
    isDialogueBlocking() { return false; },
    startDialogue() {},
    turnBulletsIntoPointItems() {
      this.enemyBullets = [];
      this.enemyLasers = [];
    },
    spawnItem(type, x, y, options = {}) {
      this.items.push({ type, x, y, ...options });
    },
    text() {},
    audio: { sfx() {} }
  };
  const missingVisibleSprites = [];
  for (let frame = 0; frame < 7000; frame++) {
    game.stageFrame = frame;
    globalThis.__touhouGameRank = game.rank;
    globalThis.__touhouPlayerX = game.player.x;
    globalThis.__touhouPlayerY = game.player.y;
    runtime.update(game);
    for (const enemy of [...game.enemies]) {
      enemy.frame = (enemy.frame || 0) + 1;
      if (enemy.ecl) runtime.updateEnemy(game, enemy);
      const onScreen = enemy.x > -32 && enemy.x < 416 && enemy.y > -48 && enemy.y < 480;
      if (onScreen && enemy.ecl && !enemy.ecl.invisible && !runtime.enemyRect(enemy)) {
        missingVisibleSprites.push({ frame, script: enemy.ecl.currentAnm });
      }
    }
  }
  assert.equal(data.assets.stageBgKey, 'stg2bg');
  assert.ok(game.enemies.some((enemy) => enemy.ecl?.isBoss));
  assert.ok(game.enemyBullets.length > 0);
  assert.deepEqual(missingVisibleSprites, []);
});
}
