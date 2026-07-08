import { Ecl, type EclInstr, type TimelineEvent } from '../formats/ecl';
import { Anm, AnmRunner } from '../formats/anm';
import { Std } from '../formats/std';
import { Msg } from '../formats/msg';
import { normalizeAngle, clamp, TAU } from '../core/util';
import type { GameHost, Enemy, EclState, EclContext, BulletProps, ItemType } from './types';

// TH07 ECL virtual machine. Opcode semantics were derived by aligning thtk's
// th07 signature table against the TH06 instruction set (implemented in the
// TH06 Web runtime this project is based on), then validated instruction by
// instruction against the thecl disassembly of the original stage scripts.
// Approximations and open questions are marked with `TH07-TODO`.

const ENEMY_BULLET_CAP = 640;

// Item ids as used by ECL drop fields. 0-5 match TH06; 6+ are PCB additions.
// TH07-TODO: ids 6/7 assumed cherry / big cherry pending in-game verification.
const ITEM_TABLE: (ItemType | null)[] = [
  'power', 'point', 'bigPower', 'bomb', 'fullPower', 'life', 'cherry', 'bigCherry'
];

const RANDOM_ITEMS: ItemType[] = [
  'power', 'power', 'point', 'power', 'point', 'power', 'power', 'point',
  'point', 'point', 'power', 'power', 'power', 'point', 'point', 'power',
  'point', 'power', 'point', 'power', 'point', 'power', 'point', 'power',
  'point', 'power', 'power', 'point', 'point', 'point', 'power', 'bigPower'
];

// Special variable ids (reads resolved from game state). Writable general
// variables live in EclState.vars. Locals (10000..10007) are saved/restored
// across sub calls, matching the TH06 call-frame behavior.
const VAR_BASE = 10000;


const warned = new Set<string>();
function warnOnce(key: string, message: string): void {
  if (warned.has(key)) return;
  warned.add(key);
  console.warn(`[eclvm] ${message}`);
}

export interface StageData {
  ecl: string;
  std: string;
  msg: string;
  enemyAnm: string;
  bgAnm: string;
  effectAnm: string;
  stdTxtAnm: string;
  faceAnm: string;
}

export class StageRuntime {
  readonly ecl: Ecl;
  readonly std: Std;
  readonly msg: Msg;
  readonly enemyAnm: Anm;
  readonly bulletAnm: Anm;
  readonly effectAnm: Anm;
  // TH07 runs several timelines in parallel (stage 1: main waves + ambience).
  timelineCursors: { index: number; frame: number }[] = [];
  // Trace of fired timeline spawn events (see update()); for timing audits.
  spawnLog: { t: number; time: number; sub: number }[] = [];
  private randomItemIndex = 0;
  private randomSpawnIndex = 0;
  bossSlots: (Enemy | null)[] = [];

  constructor(stage: StageData, anms: { etama: Anm; enemy: Anm; effect: Anm }) {
    this.ecl = new Ecl(stage.ecl);
    this.std = new Std(stage.std);
    this.msg = new Msg(stage.msg);
    this.enemyAnm = anms.enemy;
    this.bulletAnm = anms.etama;
    this.effectAnm = anms.effect;
  }

  reset(): void {
    this.timelineCursors = this.ecl.timelines.map(() => ({ index: 0, frame: 0 }));
    this.randomItemIndex = 0;
    this.randomSpawnIndex = 0;
    this.bossSlots = [];
    this.std.reset();
  }

  isTimelineComplete(): boolean {
    return this.timelineCursors.every((c, t) => c.index >= this.ecl.timelines[t].length);
  }

  get mainTimeline(): { index: number; frame: number } {
    return this.timelineCursors[0] ?? { index: 0, frame: 0 };
  }

  private isEnemyActive(game: GameHost, enemy: Enemy | null): boolean {
    return !!enemy && !enemy.dead && game.enemies.includes(enemy);
  }

  update(game: GameHost): void {
    if (!game.timeStopped) this.std.advance();
    if (this.timelineCursors.length === 0) this.reset();
    for (let t = 0; t < this.ecl.timelines.length; t++) {
      const timeline = this.ecl.timelines[t];
      const cursor = this.timelineCursors[t];
      let held = false;
      while (cursor.index < timeline.length && timeline[cursor.index].time <= cursor.frame) {
        const evt = timeline[cursor.index];
        // Negative-time events never fire in the original engine.
        if (evt.time < 0) {
          cursor.index++;
          continue;
        }
        const action = this.runTimelineEvent(game, evt);
        if (action === 'hold') {
          held = true;
          break;
        }
        // Timing-audit trace: which timeline fired which event at what
        // timeline-clock value (scripts/audit code reads this via the test
        // hook; unused and near-free in normal play).
        if ((evt.op & 1) === 0 && evt.op <= 6) {
          this.spawnLog.push({ t, time: evt.time, sub: evt.arg0 });
        }
        cursor.index++;
      }
      if (!held && !game.isDialogueBlocking?.()) cursor.frame++;
    }
  }

  private runTimelineEvent(game: GameHost, evt: TimelineEvent): 'hold' | null {
    switch (evt.op) {
      case 0:
      case 2:
      case 4:
      case 6: {
        // Spawn enemy. op bit 1 = mirrored (as in TH06's even/odd pairs).
        // TH07-TODO: semantics of bit 2 (ops 4/6) unverified; treated as plain.
        // No boss-active suppression here: the data's ins_12 holds are the
        // real coordination (timeline1 deliberately spawns its side fairies
        // while the timeline0 midboss is still on screen).
        let { x = 0, y = 0, z = 0 } = evt;
        if (x <= -990) x = game.rng.range(384);
        if (y <= -990) y = game.rng.range(448);
        if (z <= -990) z = game.rng.range(800);
        this.spawnEclEnemy(game, {
          subId: evt.arg0,
          x, y, z,
          life: evt.life ?? -1,
          item: evt.item ?? -1,
          score: evt.score ?? -1,
          mirrored: (evt.op & 2) !== 0
        });
        return null;
      }
      case 8:
        game.startDialogue?.(evt.arg0);
        return null;
      case 9:
        if (game.consumeDialogueResume?.()) return null;
        return game.isDialogueBlocking?.() ? 'hold' : null;
      case 10: {
        const boss = this.bossSlots[evt.i0 ?? 0];
        if (this.isEnemyActive(game, boss)) boss!.ecl.runInterrupt = evt.i1 ?? 0;
        return null;
      }
      case 12: {
        const boss = this.bossSlots[evt.arg0 ?? 0];
        return this.isEnemyActive(game, boss) ? 'hold' : null;
      }
      default:
        warnOnce(`tl${evt.op}`, `unhandled timeline op ${evt.op}`);
        return null;
    }
  }

  spawnEclEnemy(game: GameHost, opts: { subId: number; x: number; y: number; z?: number; life?: number; item?: number; score?: number; mirrored?: boolean; parent?: Enemy | null }): Enemy {
    const { subId, x, y, z = 0, life = -1, item = -1, score = -1, mirrored = false, parent = null } = opts;
    const hasLife = life >= 0;
    const hasScore = score >= 0;
    const e: Enemy = {
      id: game.id++,
      x, y, z,
      hp: hasLife ? life | 0 : 1,
      maxHp: hasLife ? life | 0 : 1,
      score: hasScore ? score | 0 : 100,
      frame: 0,
      ecl: this.makeEnemyState(subId, mirrored, item, parent)
    };
    game.enemies.push(e);
    this.runEcl(game, e);
    if (hasLife) e.hp = e.maxHp = life | 0;
    else e.maxHp = Math.max(1, e.hp);
    if (hasScore) e.score = score | 0;
    return e;
  }

  private makeEnemyState(subId: number, mirrored: boolean, itemDrop: number, parent: Enemy | null): EclState {
    return {
      ctx: { subId, index: 0, time: 0, windowBase: parent ? parent.ecl.ctx.windowBase : 0 },
      stack: [],
      subId,
      mirrored,
      itemDrop,
      vars: parent ? parent.ecl.vars.slice() : new Float64Array(160),
      axisSpeed: { x: 0, y: 0, z: 0 },
      angle: 0,
      angularVelocity: 0,
      speed: 0,
      acceleration: 0,
      shootOffset: { x: 0, y: 0, z: 0 },
      moveMode: 0,
      interpKind: 0,
      interp: null,
      bulletProps: null,
      bulletSfx: -1,
      bulletExInts: [0, 0, 0, 0, 0],
      bulletExFloats: [0, 0],
      shootDisabled: false,
      shootInterval: 0,
      shootTimer: 0,
      hitbox: { x: 28, y: 28, z: 32 },
      isBoss: false,
      bossSlot: null,
      canTakeDamage: true,
      collisionEnabled: true,
      interactable: true,
      hitSound: -1,
      deathSound: -1,
      deathMode: 0,
      deathCallbackSub: -1,
      lifeCallbackThreshold: -1,
      lifeCallbackSub: -1,
      timerCallbackThreshold: -1,
      timerCallbackSub: -1,
      scheduledTimerSubs: [],
      bossTimer: 0,
      currentAnm: -1,
      anmRunner: null,
      anmSlots: [],
      anmExDefaults: -1,
      anmExFarLeft: -1,
      anmExFarRight: -1,
      anmExLeft: -1,
      anmExRight: -1,
      anmExFlags: 0xff,
      deathAnm1: 0,
      deathAnm2: 0,
      deathAnm3: 0,
      frameVx: 0,
      frameVy: 0,
      anmRotateWithAngle: false,
      bossLifeCount: 0,
      lasers: [],
      laserStore: 0,
      interrupts: [],
      runInterrupt: -1,
      disableCallStack: false,
      invisible: false,
      spellTimeoutFlag: false,
      bulletRankSpeedLow: -0.5,
      bulletRankSpeedHigh: 0.5,
      bulletRankAmount1Low: 0,
      bulletRankAmount1High: 0,
      bulletRankAmount2Low: 0,
      bulletRankAmount2High: 0,
      lowerMoveLimit: { x: 0, y: 0 },
      upperMoveLimit: { x: 384, y: 448 },
      shouldClamp: false,
      spellName: '',
      seen: false,
      flag136: 0,
      flag137: 0,
      param142: 0
    };
  }



  // ---- variables -----------------------------------------------------------

  // Variable model derived from the stage data's dataflow: variables live in
  // a per-enemy array indexed through a register window that shifts by +8 on
  // every sub call (Sub48 writes 10041/10037 → called Sub49 reads them as
  // 10033/10029). Enemies spawned by another enemy inherit a copy of the
  // parent's array and window base, which is how bosses hand pattern
  // parameters (angle/rotation/speed) to child emitters. Engine-state
  // specials (10016-10027) resolve on the raw id regardless of the window.

  private varRead(game: GameHost, e: Enemy, id: number): number {
    const s = e.ecl;
    switch (id) {
      case 10016: return game.difficulty;
      case 10018: return game.player.x;
      case 10019: return game.player.y;
      case 10020: return 0; // player z
      case 10021: return e.x;
      case 10022: return e.y;
      case 10023: return e.z;
      case 10024: return Math.atan2(e.y - game.player.y, e.x - game.player.x);
      case 10025: return Math.hypot(game.player.x - e.x, game.player.y - e.y);
      case 10026: return s.bossTimer;
      case 10027: return e.hp;
    }
    const slot = s.ctx.windowBase + (id - VAR_BASE);
    if (slot >= 0 && slot < s.vars.length) return s.vars[slot];
    return id;
  }

  private varWrite(game: GameHost, e: Enemy, id: number, value: number): void {
    const s = e.ecl;
    switch (id) {
      case 10021: e.x = value; return;
      case 10022: e.y = value; return;
      case 10023: e.z = value; return;
      case 10026: s.bossTimer = value; return;
      case 10027: e.hp = value; return;
    }
    const slot = s.ctx.windowBase + (id - VAR_BASE);
    if (slot >= 0 && slot < s.vars.length) {
      s.vars[slot] = value;
      return;
    }
    warnOnce(`w${id}`, `write to out-of-range variable ${id} (base ${s.ctx.windowBase})`);
  }

  private getInt(game: GameHost, e: Enemy, off: number): number {
    const raw = this.ecl.view.i32(off);
    if (raw >= VAR_BASE && raw < VAR_BASE + 100) return Math.trunc(this.varRead(game, e, raw));
    return raw;
  }

  private getShort(game: GameHost, e: Enemy, off: number): number {
    const raw = this.ecl.view.i16(off);
    if (raw >= VAR_BASE && raw < VAR_BASE + 100) return Math.trunc(this.varRead(game, e, raw));
    return raw;
  }

  private getFloat(game: GameHost, e: Enemy, off: number): number {
    const value = this.ecl.view.f32(off);
    const asInt = Math.trunc(value);
    if (Math.abs(value - asInt) < 0.00001 && asInt >= VAR_BASE && asInt < VAR_BASE + 100) {
      return Number(this.varRead(game, e, asInt));
    }
    return value;
  }

  // ---- per-frame enemy processing -----------------------------------------

  updateEnemy(game: GameHost, e: Enemy): void {
    const s = e.ecl;
    const prevX = e.x;
    const prevY = e.y;
    this.applyMovement(e);
    s.frameVx = e.x - prevX;
    s.frameVy = e.y - prevY;
    this.checkCallbacks(game, e);
    this.runEcl(game, e);
    this.updateAutoShoot(game, e);
    if (s.isBoss && !game.timeStopped) s.bossTimer++;
    this.updateAnmPose(e);
    s.anmRunner?.update();
    for (const slot of s.anmSlots) slot?.runner?.update();
  }

  private applyMovement(e: Enemy): void {
    const s = e.ecl;
    if (s.moveMode === 2 && s.interp) {
      const m = s.interp;
      const elapsed = m.duration - m.left;
      let t = clamp(elapsed / Math.max(1, m.duration), 0, 1);
      if (s.interpKind === 1) t = 1 - (1 - t) * (1 - t);
      else if (s.interpKind === 2) t = 1 - (1 - t) ** 4;
      else if (s.interpKind === 3) t = t * t;
      else if (s.interpKind === 4) t = t ** 4;
      e.x = m.start.x + m.delta.x * t;
      e.y = m.start.y + m.delta.y * t;
      e.z = m.start.z + m.delta.z * t;
      m.left--;
      if (m.left <= 0) {
        e.x = m.start.x + m.delta.x;
        e.y = m.start.y + m.delta.y;
        e.z = m.start.z + m.delta.z;
        s.moveMode = 0;
        s.interp = null;
      }
    } else if (s.moveMode === 1) {
      const vx = Math.cos(s.angle) * s.speed;
      const vy = Math.sin(s.angle) * s.speed;
      e.x += s.mirrored ? -vx : vx;
      e.y += vy;
      s.angle = normalizeAngle(s.angle + s.angularVelocity);
      s.speed += s.acceleration;
    } else {
      e.x += s.mirrored ? -s.axisSpeed.x : s.axisSpeed.x;
      e.y += s.axisSpeed.y;
      e.z += s.axisSpeed.z;
    }
    if (s.shouldClamp) {
      e.x = clamp(e.x, s.lowerMoveLimit.x, s.upperMoveLimit.x);
      e.y = clamp(e.y, s.lowerMoveLimit.y, s.upperMoveLimit.y);
    }
  }

  // Boss phase callbacks, matching the original engine's behavior: the timer
  // callback target is re-chained to the death callback whenever a callback
  // fires, life callbacks fire on hp < threshold (strict) and clamp hp up.
  private checkCallbacks(game: GameHost, e: Enemy): void {
    const s = e.ecl;
    if (s.lifeCallbackThreshold >= 0 && s.lifeCallbackSub >= 0 && e.hp < s.lifeCallbackThreshold) {
      const sub = s.lifeCallbackSub;
      e.hp = s.lifeCallbackThreshold;
      s.lifeCallbackThreshold = -1;
      s.timerCallbackSub = s.deathCallbackSub;
      this.phaseTransition(game, e, sub);
      return;
    }
    if (s.timerCallbackThreshold >= 0 && s.timerCallbackSub >= 0 && s.bossTimer >= s.timerCallbackThreshold) {
      const sub = s.timerCallbackSub;
      if (s.lifeCallbackThreshold > 0) {
        e.hp = s.lifeCallbackThreshold;
        s.lifeCallbackThreshold = -1;
      }
      s.timerCallbackThreshold = -1;
      s.timerCallbackSub = s.deathCallbackSub;
      s.bossTimer = 0;
      // Timing out voids the spell capture unless the ECL flagged otherwise.
      if (s.spellName && !s.spellTimeoutFlag) game.voidSpellCapture?.();
      this.phaseTransition(game, e, sub);
      return;
    }
    for (const sched of s.scheduledTimerSubs) {
      if (!sched.fired && s.bossTimer >= sched.time) {
        sched.fired = true;
        this.phaseTransition(game, e, sched.sub);
        return;
      }
    }
  }

  private phaseTransition(game: GameHost, e: Enemy, sub: number): void {
    const s = e.ecl;
    s.bulletRankSpeedLow = -0.5;
    s.bulletRankSpeedHigh = 0.5;
    s.bulletRankAmount1Low = 0;
    s.bulletRankAmount1High = 0;
    s.bulletRankAmount2Low = 0;
    s.bulletRankAmount2High = 0;
    s.stack.length = 0;
    s.scheduledTimerSubs.length = 0;
    s.ctx.windowBase = 0;
    if (s.isBoss) this.clearNonBossEnemies(game, e);
    this.enterSub(s, sub);
  }

  private enterSub(s: EclState, subId: number, windowShift = 0): void {
    s.ctx = { subId, index: 0, time: 0, windowBase: Math.max(0, s.ctx.windowBase + windowShift) };
  }

  private updateAutoShoot(game: GameHost, e: Enemy): void {
    const s = e.ecl;
    if (!s.shootInterval || s.shootDisabled || !s.bulletProps) return;
    s.shootTimer++;
    if (s.shootTimer >= s.shootInterval) {
      s.shootTimer = 0;
      this.spawnBullets(game, e, s.bulletProps);
    }
  }

  setCurrentAnm(e: Enemy, script: number): void {
    const s = e.ecl;
    if (script < 0 || s.currentAnm === script) return;
    s.currentAnm = script;
    s.anmRunner = this.enemyAnm.hasScript(script) ? new AnmRunner(this.enemyAnm, script) : null;
  }

  private updateAnmPose(e: Enemy): void {
    const s = e.ecl;
    if (s.anmExLeft < 0) return;
    const vx = Math.abs(s.frameVx) < 0.0001 ? 0 : s.frameVx;
    const pose = vx < 0 ? 1 : vx > 0 ? 2 : 0;
    if (s.anmExFlags === pose) return;
    if (pose === 0) {
      if (s.anmExFlags === 0xff) this.setCurrentAnm(e, s.anmExDefaults);
      else if (s.anmExFlags === 1) this.setCurrentAnm(e, s.anmExFarLeft);
      else this.setCurrentAnm(e, s.anmExFarRight);
    } else if (pose === 1) this.setCurrentAnm(e, s.anmExLeft);
    else this.setCurrentAnm(e, s.anmExRight);
    s.anmExFlags = pose;
  }

  // ---- the interpreter -----------------------------------------------------

  private runEcl(game: GameHost, e: Enemy): void {
    const s = e.ecl;
    for (let guard = 0; guard < 512; guard++) {
      if (s.runInterrupt >= 0) {
        const sub = s.interrupts[s.runInterrupt];
        s.runInterrupt = -1;
        if (sub != null && sub >= 0) {
          const instrs = this.ecl.sub(s.ctx.subId);
          const next = instrs[s.ctx.index];
          if (!s.disableCallStack && next) {
            s.stack.push({ ...s.ctx });
          }
          this.enterSub(s, sub);
        }
      }
      const ctx = s.ctx;
      const instrs = this.ecl.sub(ctx.subId);
      const instr = instrs[ctx.index];
      if (!instr) return;
      if (ctx.time !== instr.time) break;
      if (instr.rankMask & (1 << game.difficulty)) {
        const prevExecuting = this.executingEnemy;
        this.executingEnemy = e;
        const action = this.execute(game, e, instr);
        this.executingEnemy = prevExecuting;
        if (action === 'delete') {
          e.dead = true;
          return;
        }
        if (action === 'flow') continue;
      }
      ctx.index++;
    }
    s.ctx.time++;
  }

  private jumpTo(s: EclState, targetOffset: number, newTime: number): void {
    const instrs = this.ecl.sub(s.ctx.subId);
    // Binary offsets are relative to the current instruction.
    const absolute = instrs[s.ctx.index].offset + targetOffset;
    const idx = instrs.findIndex((i) => i.offset === absolute);
    if (idx < 0) throw new Error(`ECL jump to unknown offset ${absolute} in sub ${s.ctx.subId}`);
    s.ctx.index = idx;
    s.ctx.time = newTime;
  }

  private execute(game: GameHost, e: Enemy, instr: EclInstr): 'delete' | 'flow' | null {
    const s = e.ecl;
    const ctx = s.ctx;
    const v = this.ecl.view;
    const a = instr.args;
    const op = instr.id;
    const gi = (o: number) => this.getInt(game, e, a + o);
    const gf = (o: number) => this.getFloat(game, e, a + o);
    const gs = (o: number) => this.getShort(game, e, a + o);
    const setVar = (id: number, val: number) => this.varWrite(game, e, id, val);

    switch (op) {
      case 0: return null; // nop
      case 1: return 'delete';
      case 2: { // jump(time, offset)
        this.jumpTo(s, v.i32(a + 4), v.i32(a));
        return 'flow';
      }
      case 3: { // loop: decrement var, jump while > 0
        const varId = v.i32(a + 8);
        const left = Math.trunc(this.varRead(game, e, varId)) - 1;
        setVar(varId, left);
        if (left <= 0) return null;
        this.jumpTo(s, v.i32(a + 4), v.i32(a));
        return 'flow';
      }
      case 4: setVar(v.i32(a), gi(4)); return null;
      case 5: setVar(Math.trunc(v.f32(a)), gf(4)); return null;
      case 6: setVar(v.i32(a), game.rng.u32InRange(Math.max(1, gi(4)))); return null;
      case 7: setVar(v.i32(a), game.rng.u32InRange(Math.max(1, gi(4))) + gi(8)); return null;
      case 8: setVar(Math.trunc(v.f32(a)), game.rng.range(gf(4))); return null;
      case 9: setVar(Math.trunc(v.f32(a)), game.rng.range(gf(4)) + gf(8)); return null;
      case 11: // TH07-TODO: single use in stage 1; treated as float assignment
        setVar(Math.trunc(v.f32(a)), gf(4));
        return null;
      case 12: case 13: case 14: case 15: case 16: { // int math
        const lhs = gi(4);
        const rhs = gi(8);
        const r = op === 12 ? lhs + rhs : op === 13 ? lhs - rhs : op === 14 ? lhs * rhs
          : op === 15 ? (rhs ? lhs / rhs : 0) : (rhs ? lhs % rhs : 0);
        setVar(v.i32(a), Math.trunc(r));
        return null;
      }
      case 17: setVar(v.i32(a), Math.trunc(this.varRead(game, e, v.i32(a))) + 1); return null;
      case 18: setVar(v.i32(a), Math.trunc(this.varRead(game, e, v.i32(a))) - 1); return null;
      case 19: case 20: case 21: case 22: case 23: { // float math
        const lhs = gf(4);
        const rhs = gf(8);
        const r = op === 19 ? lhs + rhs : op === 20 ? lhs - rhs : op === 21 ? lhs * rhs
          : op === 22 ? (rhs ? lhs / rhs : 0) : (rhs ? lhs % rhs : 0);
        setVar(Math.trunc(v.f32(a)), r);
        return null;
      }
      case 24: setVar(Math.trunc(v.f32(a)), Math.sin(gf(4))); return null;
      case 25: setVar(Math.trunc(v.f32(a)), Math.cos(gf(4))); return null;
      case 26: setVar(Math.trunc(v.f32(a)), Math.atan2(gf(16) - gf(8), gf(12) - gf(4))); return null;
      case 28: case 29: case 30: case 31: case 32: case 33:
      case 34: case 35: case 36: case 37: case 38: case 39: { // compare-and-jump
        const isFloat = (op & 1) === 1;
        const lhs = isFloat ? gf(0) : gi(0);
        const rhs = isFloat ? gf(4) : gi(4);
        const mode = (op - 28) >> 1; // 0 ==, 1 !=, 2 <, 3 <=, 4 >, 5 >=
        const pass = mode === 0 ? lhs === rhs : mode === 1 ? lhs !== rhs
          : mode === 2 ? lhs < rhs : mode === 3 ? lhs <= rhs
            : mode === 4 ? lhs > rhs : lhs >= rhs;
        if (pass) {
          this.jumpTo(s, v.i32(a + 12), v.i32(a + 8));
          return 'flow';
        }
        return null;
      }
      case 40: s.angle = gf(0); s.moveMode = 1; return null;
      case 41: { // call sub (register window shifts by +8)
        if (!s.disableCallStack) s.stack.push({ ...ctx, index: ctx.index + 1 });
        this.enterSub(s, v.i32(a), 8);
        return 'flow';
      }
      case 42: { // return
        const ret = s.stack.pop();
        if (ret) s.ctx = ret;
        return 'flow';
      }
      case 45: // TH07-TODO: unknown (2 uses); observed with int var argument
        warnOnce('op45', 'op 45 stubbed');
        return null;
      case 46: e.x = gf(0); e.y = gf(4); e.z = gf(8); return null;
      case 47: { // velocity by angle/speed (+ z speed)
        const angle = gf(0);
        const speed = gf(4);
        s.axisSpeed = { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed, z: gf(8) };
        s.moveMode = 0;
        return null;
      }
      case 48: s.angularVelocity = gf(0); s.moveMode = 1; return null;
      case 49: s.speed = gf(0); s.moveMode = 1; return null;
      case 50: s.acceleration = gf(0); s.moveMode = 1; return null;
      case 52: { // random float in [min, max) into var
        const min = gf(4);
        const max = gf(8);
        setVar(Math.trunc(v.f32(a)), game.rng.range(max - min) + min);
        return null;
      }
      case 54: { // timed move by angle/speed: (duration, mode, angle, speed)
        const duration = v.i32(a);
        const mode = v.i32(a + 4);
        const angle = gf(8);
        const speed = gf(12);
        if (duration <= 0) {
          s.angle = angle;
          s.speed = speed;
          s.acceleration = 0;
          s.angularVelocity = 0;
          s.moveMode = 1;
        } else {
          s.interp = {
            start: { x: e.x, y: e.y, z: e.z },
            delta: { x: Math.cos(angle) * speed * duration / 2, y: Math.sin(angle) * speed * duration / 2, z: 0 },
            duration,
            left: duration
          };
          s.interpKind = mode;
          s.moveMode = 2;
          s.axisSpeed = { x: 0, y: 0, z: 0 };
        }
        return null;
      }
      case 55: { // timed move to position: (duration, mode, x, y, z)
        const duration = v.i32(a);
        const mode = v.i32(a + 4);
        const tx = gf(8);
        const ty = gf(12);
        const tz = gf(16);
        if (duration <= 0) {
          e.x = tx;
          e.y = ty;
          e.z = tz;
        } else {
          s.interp = {
            start: { x: e.x, y: e.y, z: e.z },
            delta: { x: tx - e.x, y: ty - e.y, z: tz - e.z },
            duration,
            left: duration
          };
          s.interpKind = mode;
          s.moveMode = 2;
          s.axisSpeed = { x: 0, y: 0, z: 0 };
        }
        return null;
      }
      case 56: { // TH07-TODO: 8-arg timed move; approximated as linear move-to
        const duration = Math.max(1, v.i32(a));
        s.interp = {
          start: { x: e.x, y: e.y, z: e.z },
          delta: { x: gf(4) - e.x, y: gf(8) - e.y, z: gf(12) - e.z },
          duration,
          left: duration
        };
        s.interpKind = 0;
        s.moveMode = 2;
        return null;
      }
      case 62: {
        s.lowerMoveLimit = { x: gf(0), y: gf(4) };
        s.upperMoveLimit = { x: gf(8), y: gf(12) };
        s.shouldClamp = true;
        return null;
      }
      case 63: s.shouldClamp = false; return null;
      case 64: case 65: case 66: case 67: case 68:
      case 69: case 70: case 71: case 72: { // fire bullets, aim modes 0-8
        const props = this.readBulletProps(game, e, op - 64, a);
        s.bulletProps = props;
        if (!s.shootDisabled) this.spawnBullets(game, e, props);
        return null;
      }
      case 73: case 74: { // auto-fire interval (74 randomizes phase)
        s.shootInterval = gi(0);
        s.shootTimer = op === 74 && s.shootInterval > 0 ? game.rng.u32InRange(s.shootInterval) : 0;
        return null;
      }
      case 75: s.shootDisabled = true; return null;
      case 76: s.shootDisabled = false; return null;
      case 78: s.shootOffset = { x: gf(0), y: gf(4), z: gf(8) }; return null;
      case 79: { // bullet ex-properties (5 ints, 2 floats)
        s.bulletExInts = [gi(0), gi(4), gi(8), gi(12), gi(16)];
        s.bulletExFloats = [gf(20), gf(24)];
        if (s.bulletProps) {
          s.bulletProps.exInts = [...s.bulletExInts];
          s.bulletProps.exFloats = [...s.bulletExFloats];
        }
        return null;
      }
      case 80: if (s.bulletProps) this.spawnBullets(game, e, s.bulletProps); return null;
      case 81: { // bullet fire SFX (id, unknown)
        const sfx = v.i32(a);
        s.bulletSfx = sfx;
        if (s.bulletProps) {
          s.bulletProps.sfx = sfx;
          if (sfx >= 0) s.bulletProps.flags |= 0x200;
          else s.bulletProps.flags &= ~0x200;
        }
        return null;
      }
      case 90: { // spell card start: (variant s16, spellId u16, XOR-0xAA shift-jis name)
        const spellId = v.u16(a + 2);
        const bytes = v.bytes;
        const start = a + 4;
        let end = start;
        while (end < bytes.length && bytes[end] !== 0xaa && end - start < 64) end++;
        const decoded = new Uint8Array(end - start);
        for (let i = 0; i < decoded.length; i++) decoded[i] = bytes[start + i] ^ 0xaa;
        s.spellName = new TextDecoder('shift_jis').decode(decoded);
        game.startBossSpell?.(spellId, v.i16(a), s.spellName);
        this.turnBulletsIntoPointItems(game);
        return null;
      }
      case 91:
        s.spellName = '';
        game.endBossSpell?.();
        this.turnBulletsIntoPointItems(game);
        // Ending a spell also shatters the spell's helper enemies (Letty's
        // ice orbs, snowflake spinners). Evidence in ecldata1: hp-interrupt
        // transitions clean helpers with an explicit ins_94 at the next
        // phase's start (Sub42/48/52/55), but end-of-life callbacks rely on
        // ins_91 itself — Letty's death sub (Sub51) has no ins_94, yet her
        // Sub50 orbs die with the boss in the original. Cirno's Sub27 pairs
        // ins_91 with a redundant ins_94, so this stays a no-op there.
        this.killNonBossEnemies(game);
        return null;
      case 92: case 93: { // spawn child enemy: (sub, x, y, z, life, item, score)
        this.spawnEclEnemy(game, {
          subId: v.i32(a),
          x: e.x + gf(4), y: e.y + gf(8), z: e.z + gf(12),
          life: v.i32(a + 16),
          item: v.i32(a + 20),
          score: v.i32(a + 24),
          mirrored: false,
          parent: e
        });
        return null;
      }
      case 94: this.killNonBossEnemies(game); return null;
      case 95: this.setCurrentAnm(e, v.i32(a)); return null;
      case 96: { // directional pose scripts
        s.anmExDefaults = v.i16(a);
        s.anmExFarLeft = v.i16(a + 2);
        s.anmExFarRight = v.i16(a + 4);
        s.anmExLeft = v.i16(a + 6);
        s.anmExRight = v.i16(a + 8);
        s.anmExFlags = 0xff;
        return null;
      }
      case 97: { // aux ANM slot
        const slot = v.i32(a) | 0;
        if (slot >= 0 && slot < 8) {
          const script = v.i32(a + 4);
          s.anmSlots[slot] = {
            script,
            runner: this.enemyAnm.hasScript(script) ? new AnmRunner(this.enemyAnm, script) : null
          };
        }
        return null;
      }
      case 98:
        s.deathAnm1 = v.i8(a);
        s.deathAnm2 = v.i8(a + 1);
        s.deathAnm3 = v.i8(a + 2);
        return null;
      case 99: { // boss slot registration
        const slot = v.i32(a) | 0;
        if (s.bossSlot != null && this.bossSlots[s.bossSlot] === e) this.bossSlots[s.bossSlot] = null;
        s.bossSlot = slot >= 0 ? slot : null;
        s.isBoss = slot >= 0;
        if (s.isBoss) this.bossSlots[slot] = e;
        game.setBossPresent?.(s.isBoss, s.isBoss ? e : null);
        return null;
      }
      case 100: // boss aura effect: (colorId, x, y, z, distance) — approximated
        game.spawnEffectParticles(16, e.x + gf(4), e.y + gf(8), 1, 0xffffffff);
        return null;
      case 101: s.hitbox = { x: gf(0), y: gf(4), z: gf(8) }; return null;
      case 102: s.collisionEnabled = !!v.i32(a); return null;
      case 103: s.canTakeDamage = !!v.i32(a); return null;
      case 104: s.hitSound = v.i32(a); return null; // TH07-TODO verify
      case 105: s.deathSound = v.i32(a); return null; // TH07-TODO verify
      case 106: s.deathMode = v.i32(a); return null; // TH07-TODO verify
      case 107: s.deathCallbackSub = v.i32(a); return null;
      case 108: s.interrupts[v.i32(a + 4)] = v.i32(a); return null;
      case 109: s.runInterrupt = v.i32(a); return null;
      case 110: e.hp = e.maxHp = v.i32(a); return null;
      case 111: s.bossTimer = v.i32(a); return null;
      case 112: s.lifeCallbackThreshold = v.i32(a); return null;
      case 113: s.lifeCallbackSub = v.i32(a); return null;
      case 114: s.timerCallbackThreshold = v.i32(a); return null;
      case 115: s.timerCallbackSub = v.i32(a); return null;
      case 116: s.interactable = !!v.i32(a); return null;
      case 117: game.spawnEffectParticles(v.i32(a), e.x, e.y, v.i32(a + 4), v.u32(a + 8) >>> 0); return null;
      case 118: game.spawnEffectParticles(v.i32(a), e.x + gf(12), e.y + gf(16), v.i32(a + 4), v.u32(a + 8) >>> 0); return null;
      case 119: this.dropPowerItems(game, e, Math.trunc(this.varRead(game, e, v.i32(a)))); return null;
      case 120: s.anmRotateWithAngle = !!v.i32(a); return null;
      case 123: ctx.time += gi(0); return null;
      case 124: {
        const type = ITEM_TABLE[v.i32(a)];
        if (type) game.spawnItem(type, e.x, e.y);
        return null;
      }
      case 125: game.unpauseStd(); return null;
      case 126:
        s.bossLifeCount = v.i32(a);
        game.setBossLifeCount?.(s.bossLifeCount);
        return null;
      case 127: return null;
      case 128: s.anmRunner?.interrupt(v.i32(a)); return null;
      case 129: {
        const slot = v.i32(a) | 0;
        s.anmSlots[slot]?.runner?.interrupt(v.i32(a + 4));
        return null;
      }
      case 130: s.disableCallStack = !!v.i32(a); return null;
      case 131:
        s.bulletRankSpeedLow = v.f32(a);
        s.bulletRankSpeedHigh = v.f32(a + 4);
        s.bulletRankAmount1Low = v.i32(a + 8);
        s.bulletRankAmount1High = v.i32(a + 12);
        s.bulletRankAmount2Low = v.i32(a + 16);
        s.bulletRankAmount2High = v.i32(a + 20);
        return null;
      case 132: s.invisible = !!v.i32(a); return null;
      case 133:
        s.timerCallbackSub = s.deathCallbackSub;
        s.bossTimer = 0;
        return null;
      case 134:
        for (const laser of game.enemyLasers) laser.inUse = false;
        game.enemyLasers.length = 0;
        return null;
      case 135: s.spellTimeoutFlag = !!v.i32(a); return null;
      case 136: s.flag136 = v.i32(a); return null; // TH07-TODO: unknown flag
      case 137: s.flag137 = v.i32(a); return null; // TH07-TODO: unknown flag
      case 138: case 139: case 140: case 141:
        game.configureAmbience?.(op, [v.i32(a), v.i32(a + 4), v.i32(a + 8), v.i32(a + 12)]);
        return null;
      case 142: s.param142 = v.i32(a); return null; // TH07-TODO: unknown phase parameter
      case 148: { // schedule sub at boss timer: (slot?, frames, sub)
        s.scheduledTimerSubs.push({ time: v.i32(a + 4), sub: v.i32(a + 8), fired: false });
        return null;
      }
      case 154: game.dropCherryItems?.(e, Math.trunc(this.varRead(game, e, v.i32(a)))); return null;
      case 160: game.awardSpellValue?.(v.i32(a)); return null; // TH07-TODO verify
      default:
        warnOnce(`op${op}`, `unhandled ECL op ${op} (sub ${ctx.subId})`);
        return null;
    }
  }

  // ---- bullets, items, misc -----------------------------------------------

  private readBulletProps(game: GameHost, e: Enemy, aimMode: number, a: number): BulletProps {
    const s = e.ecl;
    const rankSpeed = game.rank * (s.bulletRankSpeedHigh - s.bulletRankSpeedLow) / 32 + s.bulletRankSpeedLow;
    const add1 = Math.trunc(game.rank * (s.bulletRankAmount1High - s.bulletRankAmount1Low) / 32 + s.bulletRankAmount1Low);
    const add2 = Math.trunc(game.rank * (s.bulletRankAmount2High - s.bulletRankAmount2Low) / 32 + s.bulletRankAmount2Low);
    const speed1 = this.getFloat(game, e, a + 12);
    const speed2 = this.getFloat(game, e, a + 16);
    return {
      sprite: this.getShort(game, e, a),
      offset: this.getShort(game, e, a + 2),
      count1: Math.max(1, this.getInt(game, e, a + 4) + add1),
      count2: Math.max(1, this.getInt(game, e, a + 8) + add2),
      speed1: speed1 ? Math.max(0.3, speed1 + rankSpeed) : 0,
      speed2: Math.max(0.3, speed2 + rankSpeed / 2),
      angle1: normalizeAngle(this.getFloat(game, e, a + 20)),
      angle2: this.getFloat(game, e, a + 24),
      flags: this.ecl.view.i32(a + 28) | (s.bulletSfx >= 0 ? 0x200 : 0),
      sfx: s.bulletSfx,
      exInts: [...s.bulletExInts],
      exFloats: [...s.bulletExFloats],
      aimMode
    };
  }

  bulletRect(sprite: number, offset: number): { x: number; y: number; w: number; h: number; imageKey: string } {
    const ref = this.bulletAnm.scriptRef(sprite);
    const runner = new AnmRunner(this.bulletAnm, sprite, { spriteIndexOffset: offset });
    const frame = runner.spriteFrame();
    if (!frame) throw new Error(`missing bullet ANM frame for script ${sprite} offset ${offset}`);
    return { x: frame.x, y: frame.y, w: frame.w, h: frame.h, imageKey: frame.imageKey || ref.imageKey || 'etama' };
  }

  spawnBullets(game: GameHost, e: Enemy, p: BulletProps, origin: { x: number; y: number } | null = null): void {
    const shootX = origin?.x ?? e.x + e.ecl.shootOffset.x;
    const shootY = origin?.y ?? e.y + e.ecl.shootOffset.y;
    const aim = Math.atan2(game.player.y - shootY, game.player.x - shootX);
    for (let j = 0; j < p.count2; j++) {
      const speed = p.speed1 - (p.speed1 - p.speed2) * j / p.count2;
      for (let i = 0; i < p.count1; i++) {
        if (game.enemyBullets.length >= ENEMY_BULLET_CAP) return;
        let angle = 0;
        if (p.aimMode <= 1) {
          angle = ((p.count1 & 1) ? Math.floor((i + 1) / 2) : Math.floor(i / 2) + 0.5) * p.angle2;
          if (i & 1) angle *= -1;
          if (p.aimMode === 0) angle += aim;
          angle += p.angle1;
        } else if (p.aimMode === 2 || p.aimMode === 3) {
          if (p.aimMode === 2) angle += aim;
          angle += i * TAU / p.count1 + j * p.angle2 + p.angle1;
        } else if (p.aimMode === 4 || p.aimMode === 5) {
          if (p.aimMode === 4) angle += aim;
          angle += Math.PI / p.count1 + i * TAU / p.count1 + p.angle1;
        } else if (p.aimMode === 6) {
          angle = game.rng.range(p.angle1 - p.angle2) + p.angle2;
        } else if (p.aimMode === 7) {
          angle = i * TAU / p.count1 + j * p.angle2 + p.angle1;
        } else {
          angle = game.rng.range(p.angle1 - p.angle2) + p.angle2;
        }
        angle = normalizeAngle(angle);
        const spd = p.aimMode === 7 || p.aimMode === 8 ? game.rng.range(p.speed1 - p.speed2) + p.speed2 : speed;
        const rect = this.bulletRect(p.sprite, p.offset);
        const flags = p.flags | 0;
        // Spawn-in effect: bullets ease in at reduced speed while flashing.
        const spawnDuration = flags & 2 ? 8 : flags & 4 ? 11 : flags & 8 ? 14 : 0;
        const spawnMoveScale = flags & 2 ? 1 / 2 : flags & 4 ? 1 / 2.5 : flags & 8 ? 1 / 3 : 1;
        game.enemyBullets.push({
          id: game.id++,
          x: shootX,
          y: shootY,
          vx: Math.cos(angle) * spd,
          vy: Math.sin(angle) * spd,
          speed: spd,
          angle,
          age: 0,
          flags,
          sprite: p.sprite,
          spriteOffset: p.offset,
          rect,
          grazeW: Math.max(3, rect.w * 0.4),
          grazeH: Math.max(3, rect.h * 0.4),
          grazed: false,
          spawnDuration,
          spawnMoveScale,
          exInts: p.exInts,
          exFloats: p.exFloats
        });
      }
    }
    if (p.flags & 0x200 && p.sfx >= 0) game.playSfx(p.sfx);
  }

  // Clears trash mobs; each cleared enemy still runs its death callback (so
  // item-drop subs execute), matching the original.
  private clearNonBossEnemy(enemy: Enemy): void {
    enemy.hp = 0;
    const s = enemy.ecl;
    if (s.deathCallbackSub >= 0) {
      const sub = s.deathCallbackSub;
      s.deathCallbackSub = -1;
      s.stack.length = 0;
      s.ctx.windowBase = 0;
      this.enterSub(s, sub);
    } else {
      enemy.dead = true;
    }
  }

  killNonBossEnemies(game: GameHost, owner: Enemy | null = this.executingEnemy): void {
    for (const enemy of game.enemies) {
      if (enemy === owner || enemy.ecl.isBoss) continue;
      this.clearNonBossEnemy(enemy);
    }
  }

  private clearNonBossEnemies(game: GameHost, owner: Enemy): void {
    for (const enemy of game.enemies) {
      if (enemy === owner || enemy.ecl.isBoss) continue;
      this.clearNonBossEnemy(enemy);
    }
  }

  private executingEnemy: Enemy | null = null;

  // Must be called whenever an enemy is removed from the game for any reason,
  // so boss slots and presence flags don't go stale.
  releaseEnemy(game: GameHost, e: Enemy): void {
    const s = e.ecl;
    if (s.bossSlot != null && this.bossSlots[s.bossSlot] === e) {
      this.bossSlots[s.bossSlot] = null;
      game.setBossPresent?.(false, null);
    }
  }

  killEnemy(game: GameHost, e: Enemy): boolean {
    const s = e.ecl;
    const usesNormalDeath = s.interactable && !s.invisible;
    if (!usesNormalDeath) {
      if (s.deathCallbackSub >= 0) {
        const sub = s.deathCallbackSub;
        s.deathCallbackSub = -1;
        s.stack.length = 0;
        s.ctx.windowBase = 0;
        this.enterSub(s, sub);
        return true;
      }
      return false;
    }
    if (s.deathCallbackSub >= 0) {
      game.spawnEnemyDeathEffect?.(e);
      e.hp = 1;
      // Damage off the instant the death callback starts, or shots landing
      // during the transition/death animation would re-trigger death with no
      // callback left and hard-remove the enemy mid-sequence (Letty's Sub51
      // would lose its ins_91 wipe). Matches the original: bosses are
      // invulnerable between phases, and every live phase re-arms damage
      // itself via ins_103(1) (Sub38/39/42/48...).
      s.canTakeDamage = false;
      s.lifeCallbackThreshold = -1;
      s.timerCallbackThreshold = -1;
      s.scheduledTimerSubs.length = 0;
      s.stack.length = 0;
      s.ctx.windowBase = 0;
      const sub = s.deathCallbackSub;
      s.deathCallbackSub = -1;
      this.enterSub(s, sub);
      return true;
    }
    game.addScore(e.score || 0);
    if (s.isBoss && s.bossSlot != null && this.bossSlots[s.bossSlot] === e) this.bossSlots[s.bossSlot] = null;
    if (s.isBoss) game.setBossPresent?.(false, null);
    game.spawnEnemyDeathEffect?.(e);
    for (const drop of this.dropTypes(s.itemDrop)) {
      game.spawnItem(drop, e.x, e.y);
    }
    if (s.isBoss) game.enemyBullets.length = 0;
    return false;
  }

  private dropPowerItems(game: GameHost, e: Enemy, count: number): void {
    const total = Math.max(0, count | 0);
    for (let i = 0; i < total; i++) {
      const x = e.x + game.rng.range(144) - 72;
      const y = e.y + game.rng.range(144) - 72;
      const type: ItemType = game.power < 128 ? (i === 0 ? 'bigPower' : 'power') : 'point';
      game.spawnItem(type, x, y);
    }
  }

  private dropTypes(itemDrop: number): ItemType[] {
    if (itemDrop === -1 || itemDrop === 0xffff) {
      const out: ItemType[] = [];
      if (this.randomSpawnIndex++ % 3 === 0) out.push(RANDOM_ITEMS[this.randomItemIndex++ % RANDOM_ITEMS.length]);
      return out;
    }
    if (itemDrop === -2 || itemDrop === 0xfffe) return [];
    const type = ITEM_TABLE[itemDrop];
    return type ? [type] : [];
  }

  turnBulletsIntoPointItems(game: GameHost): void {
    game.turnBulletsIntoPointItems();
  }
}
