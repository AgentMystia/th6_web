import type { Rng } from '../core/rng';
import type { AnmRunner } from '../formats/anm';

export type ItemType =
  | 'power' | 'point' | 'bigPower' | 'bomb' | 'fullPower' | 'life'
  | 'cherry' | 'bigCherry' | 'pointBullet';

export interface EnemyBullet {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  speed: number;
  angle: number;
  age: number;
  flags: number;
  sprite: number;
  spriteOffset: number;
  rect: { x: number; y: number; w: number; h: number; imageKey: string };
  grazeW: number;
  grazeH: number;
  grazed: boolean;
  spawnDuration: number;
  spawnMoveScale: number;
  exInts: number[];
  exFloats: number[];
  dirTimes?: number;
  dead?: boolean;
}

export interface EnemyLaser {
  id: number;
  ownerId: number;
  inUse: boolean;
  sprite: number;
  color: number;
  x: number;
  y: number;
  angle: number;
  speed: number;
  startOffset: number;
  endOffset: number;
  startLength: number;
  width: number;
  startTime: number;
  duration: number;
  despawnDuration: number;
  hitboxStartTime: number;
  hitboxEndDelay: number;
  flags: number;
  state: number;
  timer: number;
}

export interface ItemEntity {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  type: ItemType;
  age: number;
  state: number;
  dead?: boolean;
}

export interface EffectParticle {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  life: number;
  color: number;
  size: number;
  kind: 'spark' | 'snow' | 'burst';
}

// Interface the ECL VM uses to talk to the game — mirrors the TH06 Web seam
// between Th06StageRuntime and Game.
export interface GameHost {
  rng: Rng;
  difficulty: number; // 0 E, 1 N, 2 H, 3 L
  rank: number;
  frame: number;
  id: number;
  player: { x: number; y: number };
  enemies: Enemy[];
  enemyBullets: EnemyBullet[];
  enemyLasers: EnemyLaser[];
  items: ItemEntity[];
  power: number;
  score: number;
  timeStopped?: boolean;
  addScore(v: number): void;
  spawnItem(type: ItemType, x: number, y: number, options?: { state?: number; vx?: number; vy?: number }): void;
  spawnEffectParticles(effectId: number, x: number, y: number, count: number, color: number): void;
  playSfx(id: number): void;
  startDialogue?(index: number): void;
  isDialogueBlocking?(): boolean;
  consumeDialogueResume?(): boolean;
  startBossSpell?(spellId: number, arg0: number, name: string): void;
  endBossSpell?(opts?: { fromBossDeath?: boolean }): void;
  voidSpellCapture?(): void;
  setBossPresent?(present: boolean, enemy: Enemy | null): void;
  setBossLifeCount?(count: number): void;
  dropCherryItems?(e: Enemy, count: number): void;
  awardSpellValue?(value: number): void;
  spawnEnemyDeathEffect?(e: Enemy): void;
  turnBulletsIntoPointItems(): void;
  configureAmbience?(op: number, args: number[]): void;
  unpauseStd(): void;
}

export interface EclContext {
  subId: number;
  index: number; // instruction index within sub
  time: number;
  windowBase: number; // register-window offset into EclState.vars
}

export interface EclState {
  ctx: EclContext;
  stack: EclContext[];
  subId: number;
  mirrored: boolean;
  itemDrop: number;
  vars: Float64Array;
  axisSpeed: { x: number; y: number; z: number };
  angle: number;
  angularVelocity: number;
  speed: number;
  acceleration: number;
  shootOffset: { x: number; y: number; z: number };
  moveMode: number;
  interpKind: number;
  interp: { start: { x: number; y: number; z: number }; delta: { x: number; y: number; z: number }; duration: number; left: number } | null;
  bulletProps: BulletProps | null;
  bulletSfx: number;
  bulletExInts: number[];
  bulletExFloats: number[];
  shootDisabled: boolean;
  shootInterval: number;
  shootTimer: number;
  hitbox: { x: number; y: number; z: number };
  isBoss: boolean;
  bossSlot: number | null;
  canTakeDamage: boolean;
  collisionEnabled: boolean;
  interactable: boolean;
  hitSound: number;
  deathSound: number;
  deathMode: number;
  deathCallbackSub: number;
  lifeCallbackThreshold: number;
  lifeCallbackSub: number;
  timerCallbackThreshold: number;
  timerCallbackSub: number;
  scheduledTimerSubs: { time: number; sub: number; fired: boolean }[];
  bossTimer: number;
  currentAnm: number;
  anmRunner: AnmRunner | null;
  anmSlots: ({ script: number; runner: AnmRunner | null } | null)[];
  anmExDefaults: number;
  anmExFarLeft: number;
  anmExFarRight: number;
  anmExLeft: number;
  anmExRight: number;
  anmExFlags: number;
  deathAnm1: number;
  deathAnm2: number;
  deathAnm3: number;
  frameVx: number;
  frameVy: number;
  anmRotateWithAngle: boolean;
  bossLifeCount: number;
  lasers: (EnemyLaser | null)[];
  laserStore: number;
  interrupts: number[];
  runInterrupt: number;
  disableCallStack: boolean;
  invisible: boolean;
  spellTimeoutFlag: boolean;
  bulletRankSpeedLow: number;
  bulletRankSpeedHigh: number;
  bulletRankAmount1Low: number;
  bulletRankAmount1High: number;
  bulletRankAmount2Low: number;
  bulletRankAmount2High: number;
  lowerMoveLimit: { x: number; y: number };
  upperMoveLimit: { x: number; y: number };
  shouldClamp: boolean;
  spellName: string;
  seen: boolean;
  flag136: number;
  flag137: number;
  param142: number;
}

export interface BulletProps {
  sprite: number;
  offset: number;
  count1: number;
  count2: number;
  speed1: number;
  speed2: number;
  angle1: number;
  angle2: number;
  flags: number;
  sfx: number;
  exInts: number[];
  exFloats: number[];
  aimMode: number;
}

export interface Enemy {
  id: number;
  x: number;
  y: number;
  z: number;
  hp: number;
  maxHp: number;
  score: number;
  frame: number;
  dead?: boolean;
  ecl: EclState;
}
