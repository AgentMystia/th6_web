const GAME_WIDTH = 640;
const TH06_GLOBAL = typeof window !== 'undefined' ? window : globalThis;
const GAME_HEIGHT = 480;
const PLAYFIELD = { x: 32, y: 16, width: 384, height: 448, right: 416, bottom: 464 };
const MOVE_AREA = { x: 8, y: 16, right: 376, bottom: 432 };
const STEP_MS = 1000 / 60;
const TAU = Math.PI * 2;
const DEG = Math.PI / 180;
const TH06_LOGIC = TH06_GLOBAL.TH06Logic;
const TH06_PLAYER_DATA = TH06_GLOBAL.TH06PlayerData;
if (!TH06_LOGIC) throw new Error('TH06Logic source tables must be loaded before main.js');
if (!TH06_PLAYER_DATA) throw new Error('TH06PlayerData source tables must be loaded before main.js');
const PLAYER_HITBOX_HALF = { x: 1.25, y: 1.25, z: 5 };
const PLAYER_GRAZE_PADDING = 20;
const PLAYER_ITEM_GRAB_HALF = { x: 12, y: 12, z: 5 };
const ITEM_HITBOX_HALF = 8;
const PLAYER_INITIAL_INVULN = 240;
const PLAYER_RESPAWN_INVULN = 240;
const PLAYER_BULLET_GRACE_FRAMES = 90;
const PLAYER_DEATH_DROP_DELAY = 6;
const PLAYER_DEATH_ANIM_FRAMES = 30;
const PLAYER_SPAWN_ANIM_FRAMES = 30;
const PLAYER_DEATHBOMB_WINDOW_FRAMES = 6;
const ITEM_GET_BORDER_Y = 128;
const ANM_SCRIPT_PLAYER_BULLET = 64;
const ANM_SCRIPT_PLAYER_REIMU_A_ORB_BULLET = 65;
const ANM_SCRIPT_PLAYER_MARISA_A_ORB_BULLET_1 = 65;
const ANM_SCRIPT_PLAYER_MARISA_A_ORB_BULLET_2 = 66;
const ANM_SCRIPT_PLAYER_MARISA_A_ORB_BULLET_3 = 67;
const ANM_SCRIPT_PLAYER_MARISA_A_ORB_BULLET_4 = 68;
const ANM_SCRIPT_PLAYER_MARISA_A_BLUE_STAR = 5;
const ANM_SCRIPT_PLAYER_MARISA_B_MASTER_SPARK = 8;
const ANM_SCRIPT_PLAYER_REIMU_A_BOMB_ARRAY = 133;
const ANM_SCRIPT_PLAYER_REIMU_B_BOMB_ARRAY = 137;
const BULLET_TYPE_HOMING = 1;
const BULLET_TYPE_ACCEL = 2;
const BULLET_TYPE_LASER = 3;
const ITEM_FRAMES = {
  power: { x: 0, y: 0 },
  point: { x: 16, y: 0 },
  bigPower: { x: 32, y: 0 },
  bomb: { x: 48, y: 0 },
  fullPower: { x: 64, y: 0 },
  life: { x: 80, y: 0 },
  pointBullet: { x: 96, y: 0 }
};
const HUD_STARS = {
  player: { x: 29, y: 239 },
  bomb: { x: 48, y: 239 }
};
const LASER_COLORS = [
  '#f8f8f8', '#ff3030', '#ff40ff', '#4058ff', '#40ffff', '#38ff38', '#ffff38',
  '#f8f8f8'
];

const images = {
  titleBg: 'assets/th06-img/jpg/title00.jpg',
  selectBg: 'assets/th06-img/jpg/select00.jpg',
  stageBg: 'assets/th06-img/png/stg1bg.png',
  front: 'assets/th06-img/png/front.png',
  player00: 'assets/th06-img/png/player00.png',
  player01: 'assets/th06-img/png/player01.png',
  stg1enm: 'assets/th06-img/png/stg1enm.png',
  stg1enm2: 'assets/th06-img/png/stg1enm2.png',
  etama3: 'assets/th06-img/png/etama3.png',
  etama4: 'assets/th06-img/png/etama4.png',
  eff01: 'assets/th06-img/png/eff01.png',
  face00a: 'assets/th06-img/png/face00a.png',
  face00b: 'assets/th06-img/png/face00b.png',
  face00c: 'assets/th06-img/png/face00c.png',
  face01a: 'assets/th06-img/png/face01a.png',
  face01b: 'assets/th06-img/png/face01b.png',
  face01c: 'assets/th06-img/png/face01c.png',
  face03a: 'assets/th06-img/png/face03a.png',
  face03b: 'assets/th06-img/png/face03b.png'
};

const chars = [
  { id: 'reimuA', family: 'reimu', label: 'Reimu A', sheet: 'player00', speed: 4, focus: 2, color: '#ff5b75' },
  { id: 'reimuB', family: 'reimu', label: 'Reimu B', sheet: 'player00', speed: 4, focus: 2, color: '#64d6ff' },
  { id: 'marisaA', family: 'marisa', label: 'Marisa A', sheet: 'player01', speed: 5, focus: 2.5, color: '#ffdf5d' },
  { id: 'marisaB', family: 'marisa', label: 'Marisa B', sheet: 'player01', speed: 5, focus: 2.5, color: '#c77dff' }
];
const DEMO_ENABLED_CHAR_IDS = new Set(['reimuA', 'reimuB', 'marisaA', 'marisaB']);

const keyMap = new Map([
  ['ArrowUp', ['up']],
  ['ArrowDown', ['down']],
  ['ArrowLeft', ['left']],
  ['ArrowRight', ['right']],
  ['ShiftLeft', ['focus']],
  ['ShiftRight', ['focus']],
  ['Shift', ['focus']],
  ['KeyZ', ['shoot', 'confirm']],
  ['Enter', ['shoot', 'confirm']],
  ['KeyX', ['bomb', 'back']],
  ['Escape', ['menu', 'back']]
]);

const SOUND = {
  SHOOT: 0,
  ENEMY_DEAD: 2,
  PICHUN: 4,
  BOMB_REIMARI: 6,
  SELECT: 10,
  BACK: 11,
  MOVE_MENU: 12,
  BOMB_REIMU_A: 13,
  BOMB: 14,
  BOMB_EXPLODE: 15,
  BOMB_MARISA_B: 19,
  BOSS_DEAD: 20,
  ITEM: 21,
  ONE_UP: 28,
  TIMER: 29,
  GRAZE: 30,
  POWERUP: 31
};

const SFX_FILES = [
  'plst00.wav', 'enep00.wav', 'pldead00.wav', 'power0.wav', 'power1.wav',
  'tan00.wav', 'tan01.wav', 'tan02.wav', 'ok00.wav', 'cancel00.wav',
  'select00.wav', 'gun00.wav', 'cat00.wav', 'lazer00.wav', 'lazer01.wav',
  'enep01.wav', 'nep00.wav', 'damage00.wav', 'item00.wav', 'kira00.wav',
  'kira01.wav', 'kira02.wav', 'extend.wav', 'timeout.wav', 'graze.wav', 'powerup.wav'
];

const SFX_MAP = TH06_LOGIC.SFX_BUFFER_IDX_VOLUME
  .map(([file, db]) => ({ file, volume: clamp(Math.pow(10, db / 2000), 0.06, 0.82) }));

class Rng {
  constructor(seed = 0x1527) {
    this.seed = seed & 0xffff;
  }
  u16() {
    const a = ((this.seed ^ 0x9630) - 0x6553) & 0xffff;
    this.seed = ((((a & 0xc000) >> 14) + a * 4) & 0xffff) >>> 0;
    return this.seed;
  }
  f() {
    return (((this.u16() << 16) | this.u16()) >>> 0) / 0xffffffff;
  }
  range(v) {
    return this.f() * v;
  }
}

class Input {
  constructor() {
    this.held = new Set();
    this.codes = new Set();
    this.downEdges = new Set();
    addEventListener('keydown', (event) => this.down(event), { passive: false });
    addEventListener('keyup', (event) => this.up(event), { passive: false });
    addEventListener('blur', () => {
      this.held.clear();
      this.codes.clear();
      this.downEdges.clear();
    });
  }
  down(event) {
    const buttons = keyMap.get(event.code) || keyMap.get(event.key);
    if (!buttons) return;
    event.preventDefault();
    this.codes.add(event.code);
    for (const button of buttons) {
      if (!event.repeat && !this.held.has(button)) this.downEdges.add(button);
      this.held.add(button);
    }
  }
  up(event) {
    const buttons = keyMap.get(event.code) || keyMap.get(event.key);
    if (!buttons) return;
    event.preventDefault();
    this.codes.delete(event.code);
    this.held.clear();
    for (const code of this.codes) {
      for (const button of keyMap.get(code) || []) this.held.add(button);
    }
  }
  frame() {
    const pressed = new Set(this.downEdges);
    this.downEdges.clear();
    return { held: new Set(this.held), pressed };
  }
}

class AudioBus {
  constructor() {
    this.tracks = {
      stage1: new Audio('assets/audio/stage1.mp3'),
      boss1: new Audio('assets/audio/boss1.mp3')
    };
    for (const audio of Object.values(this.tracks)) {
      audio.loop = true;
      audio.volume = 0;
      audio.preload = 'auto';
    }
    this.sfxBuffers = SFX_FILES.map((file) => Array.from({ length: 5 }, () => {
      const audio = new Audio(`assets/sfx/${file}`);
      audio.preload = 'auto';
      return audio;
    }));
    this.sfxCursor = SFX_FILES.map(() => 0);
    this.active = null;
    this.fadeToken = 0;
    this.pendingLabel = '';
    this.unlocked = false;
    const unlock = () => this.unlock();
    addEventListener('keydown', unlock, { once: true });
    addEventListener('pointerdown', unlock, { once: true });
  }
  async unlock() {
    this.unlocked = true;
    for (const audio of Object.values(this.tracks)) {
      try {
        audio.muted = true;
        await audio.play();
        audio.pause();
        audio.currentTime = 0;
        audio.muted = false;
      } catch {}
    }
    for (const pool of this.sfxBuffers) {
      for (const audio of pool) audio.load();
    }
    if (this.active) {
      const audio = this.tracks[this.active];
      if (audio) audio.play().catch(() => {});
    }
  }
  sfx(soundIdx) {
    if (!this.unlocked || soundIdx == null || soundIdx < 0) return;
    const spec = SFX_MAP[soundIdx];
    if (!spec) return;
    const pool = this.sfxBuffers[spec.file];
    if (!pool) return;
    const idx = this.sfxCursor[spec.file]++ % pool.length;
    const audio = pool[idx];
    try {
      audio.pause();
      audio.currentTime = 0;
      audio.volume = spec.volume;
      audio.play().catch(() => {});
    } catch {}
  }
  playBgm(id, options = {}) {
    if (this.active === id) return;
    const previous = this.active ? this.tracks[this.active] : null;
    const next = id ? this.tracks[id] : null;
    this.active = id;
    this.pendingLabel = options.label || '';
    if (next) {
      next.currentTime = options.restart === false ? next.currentTime : 0;
      if (this.unlocked) next.play().catch(() => {});
    }
    const token = ++this.fadeToken;
    const start = performance.now();
    const duration = Math.max(1, options.fadeMs ?? 700);
    const fade = (now) => {
      if (token !== this.fadeToken) return;
      const t = Math.min(1, (now - start) / duration);
      if (previous) {
        previous.volume = 0.65 * (1 - t);
        if (t === 1) previous.pause();
      }
      if (next) next.volume = 0.65 * t;
      if (t < 1) requestAnimationFrame(fade);
    };
    requestAnimationFrame(fade);
  }
  fadeOutBgm(seconds = 4) {
    const previous = this.active ? this.tracks[this.active] : null;
    this.active = null;
    const token = ++this.fadeToken;
    const start = performance.now();
    const duration = Math.max(1, seconds * 1000);
    const startVolume = previous?.volume ?? 0;
    const fade = (now) => {
      if (token !== this.fadeToken || !previous) return;
      const t = Math.min(1, (now - start) / duration);
      previous.volume = startVolume * (1 - t);
      if (t === 1) previous.pause();
      else requestAnimationFrame(fade);
    };
    requestAnimationFrame(fade);
  }
  sync(id) {
    this.playBgm(id);
  }
}

function clamp(v, min, max) {
  return Math.min(max, Math.max(min, v));
}

function dist2(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

function normalizeLocalAngle(v) {
  while (v <= -Math.PI) v += TAU;
  while (v > Math.PI) v -= TAU;
  return v;
}

function colorParts(color) {
  const value = color >>> 0;
  return {
    a: ((value >>> 24) & 0xff) / 255,
    r: (value >>> 16) & 0xff,
    g: (value >>> 8) & 0xff,
    b: value & 0xff
  };
}

function colorCss(color, alpha = 1) {
  const c = colorParts(color);
  return `rgba(${c.r}, ${c.g}, ${c.b}, ${clamp(c.a * alpha, 0, 1).toFixed(3)})`;
}

function reimuABullet(wait, frame, ox, oy, angle, speed, damage, source, script, sound = -1) {
  return { wait, frame, ox, oy, sx: 12, sy: 12, angle: angle * DEG, speed, damage, source, script, sound, bulletType: script === ANM_SCRIPT_PLAYER_REIMU_A_ORB_BULLET ? 1 : 0 };
}

const REIMU_A_POWER = [
  { max: 8, bullets: [
    reimuABullet(5, 0, 0, 0, -90, 12, 48, 0, ANM_SCRIPT_PLAYER_BULLET, SOUND.SHOOT)
  ] },
  { max: 16, bullets: [
    reimuABullet(5, 0, 0, 0, -90, 12, 48, 0, ANM_SCRIPT_PLAYER_BULLET, SOUND.SHOOT),
    reimuABullet(30, 0, 0, 0, -120, 10, 14, 1, ANM_SCRIPT_PLAYER_REIMU_A_ORB_BULLET),
    reimuABullet(30, 0, 0, 0, -60, 10, 14, 2, ANM_SCRIPT_PLAYER_REIMU_A_ORB_BULLET)
  ] },
  { max: 32, bullets: [
    reimuABullet(5, 0, -4, 0, -91, 12, 30, 0, ANM_SCRIPT_PLAYER_BULLET),
    reimuABullet(5, 0, 4, 0, -89, 12, 30, 0, ANM_SCRIPT_PLAYER_BULLET),
    reimuABullet(30, 0, 0, 0, -120, 10, 14, 1, ANM_SCRIPT_PLAYER_REIMU_A_ORB_BULLET),
    reimuABullet(30, 0, 0, 0, -60, 10, 14, 2, ANM_SCRIPT_PLAYER_REIMU_A_ORB_BULLET)
  ] },
  { max: 48, bullets: [
    reimuABullet(5, 0, 0, 0, -96, 12, 24, 0, ANM_SCRIPT_PLAYER_BULLET, SOUND.SHOOT),
    reimuABullet(5, 0, 0, 0, -90, 12, 30, 0, ANM_SCRIPT_PLAYER_BULLET),
    reimuABullet(5, 0, 0, 0, -84, 12, 24, 0, ANM_SCRIPT_PLAYER_BULLET),
    reimuABullet(30, 0, 0, 0, -120, 10, 14, 1, ANM_SCRIPT_PLAYER_REIMU_A_ORB_BULLET),
    reimuABullet(30, 0, 0, 0, -60, 10, 14, 2, ANM_SCRIPT_PLAYER_REIMU_A_ORB_BULLET)
  ] },
  { max: 64, bullets: [
    reimuABullet(5, 0, 0, 0, -97, 12, 24, 0, ANM_SCRIPT_PLAYER_BULLET, SOUND.SHOOT),
    reimuABullet(5, 0, 0, 0, -90, 12, 30, 0, ANM_SCRIPT_PLAYER_BULLET),
    reimuABullet(5, 0, 0, 0, -83, 12, 24, 0, ANM_SCRIPT_PLAYER_BULLET),
    reimuABullet(15, 0, 0, 0, -120, 10, 12, 1, ANM_SCRIPT_PLAYER_REIMU_A_ORB_BULLET),
    reimuABullet(15, 0, 0, 0, -60, 10, 12, 2, ANM_SCRIPT_PLAYER_REIMU_A_ORB_BULLET)
  ] },
  { max: 80, bullets: [
    reimuABullet(5, 0, 0, 0, -97, 12, 24, 0, ANM_SCRIPT_PLAYER_BULLET, SOUND.SHOOT),
    reimuABullet(5, 0, 0, 0, -90, 12, 29, 0, ANM_SCRIPT_PLAYER_BULLET),
    reimuABullet(5, 0, 0, 0, -83, 12, 24, 0, ANM_SCRIPT_PLAYER_BULLET),
    reimuABullet(15, 0, 0, 0, -120, 10, 9, 1, ANM_SCRIPT_PLAYER_REIMU_A_ORB_BULLET),
    reimuABullet(15, 0, 0, 0, -60, 10, 9, 2, ANM_SCRIPT_PLAYER_REIMU_A_ORB_BULLET),
    reimuABullet(30, 0, 0, 0, -150, 10, 12, 1, ANM_SCRIPT_PLAYER_REIMU_A_ORB_BULLET),
    reimuABullet(30, 0, 0, 0, -30, 10, 12, 2, ANM_SCRIPT_PLAYER_REIMU_A_ORB_BULLET)
  ] },
  { max: 96, bullets: [
    reimuABullet(5, 0, 0, 0, -97, 12, 24, 0, ANM_SCRIPT_PLAYER_BULLET, SOUND.SHOOT),
    reimuABullet(5, 0, 0, 0, -90, 12, 28, 0, ANM_SCRIPT_PLAYER_BULLET),
    reimuABullet(5, 0, 0, 0, -83, 12, 24, 0, ANM_SCRIPT_PLAYER_BULLET),
    reimuABullet(30, 0, 0, 0, -110, 10, 10, 1, ANM_SCRIPT_PLAYER_REIMU_A_ORB_BULLET),
    reimuABullet(30, 0, 0, 0, -70, 10, 10, 2, ANM_SCRIPT_PLAYER_REIMU_A_ORB_BULLET),
    reimuABullet(30, 10, 0, 0, -130, 10, 9, 1, ANM_SCRIPT_PLAYER_REIMU_A_ORB_BULLET),
    reimuABullet(30, 10, 0, 0, -50, 10, 9, 2, ANM_SCRIPT_PLAYER_REIMU_A_ORB_BULLET),
    reimuABullet(30, 20, 0, 0, -150, 10, 11, 1, ANM_SCRIPT_PLAYER_REIMU_A_ORB_BULLET),
    reimuABullet(30, 20, 0, 0, -30, 10, 11, 2, ANM_SCRIPT_PLAYER_REIMU_A_ORB_BULLET)
  ] },
  { max: 127, bullets: [
    reimuABullet(5, 0, 0, 0, -97, 12, 24, 0, ANM_SCRIPT_PLAYER_BULLET, SOUND.SHOOT),
    reimuABullet(5, 0, 0, 0, -90, 12, 28, 0, ANM_SCRIPT_PLAYER_BULLET),
    reimuABullet(5, 0, 0, 0, -83, 12, 24, 0, ANM_SCRIPT_PLAYER_BULLET),
    reimuABullet(15, 0, 0, 0, -110, 10, 8, 1, ANM_SCRIPT_PLAYER_REIMU_A_ORB_BULLET),
    reimuABullet(15, 0, 0, 0, -70, 10, 8, 2, ANM_SCRIPT_PLAYER_REIMU_A_ORB_BULLET),
    reimuABullet(15, 5, 0, 0, -130, 10, 8, 1, ANM_SCRIPT_PLAYER_REIMU_A_ORB_BULLET),
    reimuABullet(15, 5, 0, 0, -50, 10, 8, 2, ANM_SCRIPT_PLAYER_REIMU_A_ORB_BULLET),
    reimuABullet(15, 10, 0, 0, -150, 10, 8, 1, ANM_SCRIPT_PLAYER_REIMU_A_ORB_BULLET),
    reimuABullet(15, 10, 0, 0, -30, 10, 8, 2, ANM_SCRIPT_PLAYER_REIMU_A_ORB_BULLET)
  ] },
  { max: 999, bullets: [
    reimuABullet(5, 0, -8, 0, -97, 12, 23, 0, ANM_SCRIPT_PLAYER_BULLET, SOUND.SHOOT),
    reimuABullet(5, 0, -8, 0, -90, 12, 24, 0, ANM_SCRIPT_PLAYER_BULLET),
    reimuABullet(5, 0, 8, 0, -90, 12, 24, 0, ANM_SCRIPT_PLAYER_BULLET),
    reimuABullet(5, 0, 8, 0, -83, 12, 23, 0, ANM_SCRIPT_PLAYER_BULLET),
    reimuABullet(16, 0, 0, 0, -110, 10, 10, 1, ANM_SCRIPT_PLAYER_REIMU_A_ORB_BULLET),
    reimuABullet(16, 0, 0, 0, -70, 10, 10, 2, ANM_SCRIPT_PLAYER_REIMU_A_ORB_BULLET),
    reimuABullet(16, 4, 0, 0, -130, 10, 8, 1, ANM_SCRIPT_PLAYER_REIMU_A_ORB_BULLET),
    reimuABullet(16, 4, 0, 0, -50, 10, 8, 2, ANM_SCRIPT_PLAYER_REIMU_A_ORB_BULLET),
    reimuABullet(16, 8, 0, 0, -150, 10, 7, 1, ANM_SCRIPT_PLAYER_REIMU_A_ORB_BULLET),
    reimuABullet(16, 8, 0, 0, -30, 10, 7, 2, ANM_SCRIPT_PLAYER_REIMU_A_ORB_BULLET),
    reimuABullet(16, 12, 0, 0, -170, 10, 10, 1, ANM_SCRIPT_PLAYER_REIMU_A_ORB_BULLET),
    reimuABullet(16, 12, 0, 0, -9.9999979, 10, 10, 2, ANM_SCRIPT_PLAYER_REIMU_A_ORB_BULLET)
  ] }
];

function reimuAPowerData(power) {
  const rank = REIMU_A_POWER.find((entry) => power < entry.max);
  if (!rank) throw new Error(`Missing original ReimuA BulletData power rank for ${power}`);
  return rank;
}

function sourcePowerData(shotId, power) {
  if (shotId === 'reimuA') return reimuAPowerData(power);
  const table = TH06_PLAYER_DATA.powerTables[shotId];
  if (!table) throw new Error(`Missing original BulletData table for ${shotId}`);
  const rank = table.find((entry) => power < entry.max);
  if (!rank) throw new Error(`Missing original BulletData power rank for ${shotId}:${power}`);
  return rank;
}

class Game {
  constructor() {
    this.rng = new Rng();
    this.phase = 'title';
    this.selected = 0;
    this.track = null;
    this.audio = null;
    const stageData = window.TH06_EMBEDDED_DATA?.games?.th06?.stages?.[1];
    if (!window.Th06StageRuntime || !stageData) throw new Error('Original Stage 1 ECL/STD runtime data is missing');
    this.stageRuntime = new window.Th06StageRuntime(stageData);
    this.stageMeta = TH06_LOGIC.STAGE1_META;
    this.reset();
  }
  reset() {
    this.score = 0;
    this.hiScore = 100000;
    this.power = 0;
    this.lives = 2;
    this.bombs = 3;
    this.graze = 0;
    this.pointItemsCollectedInStage = 0;
    this.powerItemCountForScore = 0;
    this.spellcardsCaptured = 0;
    this.difficulty = 'lunatic';
    this.rank = 16;
    this.subRank = 0;
    this.stageFrame = 0;
    this.id = 1;
    this.player = {
      x: 192,
      y: 384,
      state: 'invuln',
      invuln: PLAYER_INITIAL_INVULN,
      bulletGrace: PLAYER_BULLET_GRACE_FRAMES,
      deathFrame: 0,
      spawnFrame: PLAYER_SPAWN_ANIM_FRAMES,
      deathbombTimer: 0,
      deathbombFrame: 0,
      deathDropsDone: false,
      focus: false,
      focusT: 0,
      shotFrame: -1,
      laserTimers: [0, 0]
    };
    this.playerBullets = [];
    this.enemyBullets = [];
    if (Array.isArray(this.enemyLasers)) {
      for (const l of this.enemyLasers) l.inUse = false;
    }
    this.enemyLasers = [];
    this.enemies = [];
    this.items = [];
    this.texts = [];
    this.effects = [];
    this.activeBombs = [];
    this.pendingEnemyDamage = new Map();
    this.spellcardInfo = { isActive: false, isCapturing: false, usedBomb: false };
    this.dialogue = null;
    this.lastEnemyHit = { x: -999, y: -999 };
    this.frameHomingTarget = null;
    this.bossUi = this.createBossUi();
    this.shakeFrames = 0;
    this.shakeAmp = 0;
    this.bgmBanner = 0;
    this.bgmLabel = '';
    this.flash = 0;
    this.banner = 0;
    this.stageIntro = this.stageIntroTotalFrames();
    this.stageRuntime.reset();
  }
  createBossUi() {
    return {
      present: false,
      state: 0,
      opacity: 0,
      barActual: 0,
      barDisplay: 0,
      lives: 0,
      timerSeconds: 0,
      lastTimerSeconds: null,
      bossName: this.stageMeta.bossName,
      spellName: '',
      spellIndex: -1
    };
  }
  start() {
    this.reset();
    this.phase = 'playing';
    this.track = 'stage1';
    this.requestBgm('stage1', { fadeMs: 400, label: this.stageMeta.musicLabels[0] });
  }
  requestBgm(id, options = {}) {
    this.track = id;
    this.bgmLabel = options.label || '';
    this.bgmBanner = this.bgmLabel ? 180 : 0;
    this.audio?.playBgm(id, options);
  }
  fadeOutBgm(seconds = 4) {
    this.track = null;
    this.audio?.fadeOutBgm(seconds);
  }
  increaseSubrank(amount) {
    const next = TH06_LOGIC.adjustRankState(this.rank, this.subRank, amount, this.difficulty);
    this.rank = next.rank;
    this.subRank = next.subRank;
  }
  decreaseSubrank(amount) {
    this.increaseSubrank(-amount);
  }
  itemGetBorderActive() {
    return this.player.y < ITEM_GET_BORDER_Y && (this.power >= 128 || this.player.focus);
  }
  stageIntroTotalFrames() {
    return this.stageMeta.presentation.introFrames;
  }
  spawnItem(type, x, y, options = {}) {
    const state = options.state ?? 0;
    const item = {
      id: this.id++,
      x,
      y,
      type,
      age: 0,
      state,
      vx: options.vx ?? 0,
      vy: options.vy ?? -2.2
    };
    if (state === 2) {
      item.startX = x;
      item.startY = y;
      item.targetX = options.targetX ?? this.rng.range(288) + 48;
      item.targetY = options.targetY ?? this.rng.range(192) - 64;
      item.vx = 0;
      item.vy = 0;
    }
    this.items.push(item);
    return item;
  }
  spawnMissPowerItems(livesRemaining) {
    const drops = TH06_LOGIC.missPowerDrops(livesRemaining);
    for (const drop of drops) this.spawnItem(drop, this.player.x, this.player.y, { state: 2 });
  }
  update(input) {
    if (this.phase !== 'playing') return this.updateMenu(input);
    if (input.pressed.has('menu')) {
      this.phase = 'paused';
      return;
    }
    this.stageFrame++;
    window.__touhouGameRank = this.rank;
    window.__touhouPlayerX = this.player.x;
    window.__touhouPlayerY = this.player.y;
    window.__touhouShotType = this.selected;
    this.flash = Math.max(0, this.flash - 1);
    this.banner = Math.max(0, this.banner - 1);
    this.stageIntro = Math.max(0, this.stageIntro - 1);
    this.stageRuntime.update(this);
    this.updateDialogue(input);
    if (this.spellcardInfo?.isActive) this.spellcardInfo.frame = (this.spellcardInfo.frame || 0) + 1;
    this.updatePlayer(input);
    this.updateEnemies();
    this.frameHomingTarget = this.lastEnemyHit;
    this.lastEnemyHit = { x: -999, y: -999 };
    this.pendingEnemyDamage.clear();
    this.updateBombs();
    this.updatePlayerBullets();
    this.flushEnemyDamage();
    this.frameHomingTarget = null;
    this.updateEnemyBullets();
    this.updateEnemyLasers();
    this.refreshHomingTargetFromEnemies();
    this.updateItems();
    this.updateTexts();
    this.updateEffects();
    this.updateBossUi();
    this.shakeFrames = Math.max(0, this.shakeFrames - 1);
    this.bgmBanner = Math.max(0, this.bgmBanner - 1);
    const boss = this.enemies.find((e) => e.kind === 'boss' || e.ecl?.isBoss);
    const clearFrame = this.stageMeta.presentation.clearAfterFrame;
    if (clearFrame == null) throw new Error('Missing original Stage 1 clear frame metadata');
    if (this.stageFrame > clearFrame && !boss && this.enemies.length === 0) this.clear();
  }
  updateMenu(input) {
    const confirm = input.pressed.has('confirm') || input.pressed.has('shoot');
    const back = input.pressed.has('back') || input.pressed.has('menu');
    const move = input.pressed.has('left') || input.pressed.has('right') || input.pressed.has('up') || input.pressed.has('down');
    if (this.phase === 'title' && confirm) {
      this.audio?.sfx(SOUND.SELECT);
      this.phase = 'difficulty';
    }
    else if (this.phase === 'difficulty') {
      if (back) {
        this.audio?.sfx(SOUND.BACK);
        this.phase = 'title';
      }
      else if (confirm) {
        this.audio?.sfx(SOUND.SELECT);
        this.phase = 'character';
      }
    } else if (this.phase === 'character') {
      if (input.pressed.has('left') || input.pressed.has('up')) {
        this.moveCharacterSelection(-1);
        this.audio?.sfx(SOUND.MOVE_MENU);
      }
      if (input.pressed.has('right') || input.pressed.has('down')) {
        this.moveCharacterSelection(1);
        this.audio?.sfx(SOUND.MOVE_MENU);
      }
      if (back) {
        this.audio?.sfx(SOUND.BACK);
        this.phase = 'difficulty';
      }
      else if (confirm && this.isCharacterEnabled()) {
        this.audio?.sfx(SOUND.SELECT);
        this.start();
      }
    } else if (this.phase === 'paused') {
      if (back || confirm) {
        this.audio?.sfx(SOUND.SELECT);
        this.phase = 'playing';
      }
    } else if ((this.phase === 'stageClear' || this.phase === 'gameOver') && confirm) {
      this.audio?.sfx(SOUND.SELECT);
      this.phase = 'title';
      this.track = null;
    }
    if (move && this.phase === 'difficulty') this.audio?.sfx(SOUND.MOVE_MENU);
  }
  spec() {
    return chars[this.selected];
  }
  isCharacterEnabled(index = this.selected) {
    return DEMO_ENABLED_CHAR_IDS.has(chars[index]?.id);
  }
  moveCharacterSelection(dir) {
    for (let i = 0; i < chars.length; i++) {
      this.selected = (this.selected + dir + chars.length) % chars.length;
      if (this.isCharacterEnabled()) return;
    }
    this.selected = 0;
  }
  orbs() {
    if (this.power < 8) return null;
    const t = this.player.focusT / 8;
    const h = 24 - 16 * t * t;
    const y = -32 * t;
    return { left: { x: this.player.x - h, y: this.player.y + y }, right: { x: this.player.x + h, y: this.player.y + y } };
  }
  startDialogue(index, instrs) {
    if (!instrs) return;
    this.dialogue = {
      active: true,
      index,
      instrs,
      ptr: 0,
      timer: 0,
      waiting: false,
      waitFrame: 0,
      waitLimit: 0,
      resumeTickets: 0,
      lines: ['', ''],
      intro: ['', ''],
      colors: [0, 0],
      portraits: [0, 0],
      portraitActive: [false, false]
    };
  }
  localizeText(text) {
    return TH06_LOGIC.localizeDialogueText(text) || text || '';
  }
  spellNameFor(index) {
    return this.stageMeta.spells[index] ?? TH06_LOGIC.stage1SpellName(index);
  }
  setBossPresent(present, enemy = null) {
    const ui = this.bossUi;
    ui.present = !!present;
    ui.bossName = this.stageMeta.bossName;
    if (present && ui.state === 0) {
      ui.state = 1;
      ui.opacity = 0;
      ui.barActual = enemy ? Math.max(0, enemy.hp / Math.max(1, enemy.maxHp)) : 1;
      ui.barDisplay = ui.barActual;
    }
  }
  setBossLifeCount(count) {
    this.bossUi.lives = Math.max(0, count | 0);
  }
  startBossSpell(index) {
    const name = this.spellNameFor(index);
    this.bossUi.spellIndex = index;
    this.bossUi.spellName = name;
    this.spellcardInfo.isActive = true;
    this.spellcardInfo.isCapturing = true;
    this.spellcardInfo.usedBomb = false;
    this.spellcardInfo.idx = index;
    this.spellcardInfo.frame = 0;
    this.spellcardInfo.captureScore = TH06_LOGIC.SPELLCARD_SCORE[index];
    this.banner = 150;
    const boss = this.enemies.find((e) => e.kind === 'boss' || e.ecl?.isBoss);
    if (boss) {
      this.spawnEffectParticles(13, boss.x, boss.y, 1, 0xffffffff);
      this.spawnEffectParticles(12, boss.x, boss.y, 2, 0xff8080ff);
    }
    if (name) this.text(name, 58, 76, 150, '#dce3ff');
    return name;
  }
  endBossSpell() {
    const boss = this.enemies.find((e) => e.kind === 'boss' || e.ecl?.isBoss);
    if (boss) this.spellBreakEffect(boss);
    this.effects = this.effects.filter((effect) => !effect.spellEffect);
    if (this.spellcardInfo.isActive && this.spellcardInfo.isCapturing) {
      const bonus = TH06_LOGIC.spellcardBonus(this.spellcardInfo.idx || 0, this.bossUi.timerSeconds);
      this.score += bonus;
      this.spellcardsCaptured++;
      this.text('Spell Card Bonus!', 116, 98, 150, '#fff0a8');
      this.text(String(bonus), 154, 118, 150, '#fff0a8');
    }
    this.bossUi.spellName = '';
    this.bossUi.spellIndex = -1;
    this.spellcardInfo.isActive = false;
    this.spellcardInfo.isCapturing = false;
    this.spellcardInfo.usedBomb = false;
    this.spellcardInfo.frame = 0;
  }
  spellBreakEffect(enemy) {
    this.spawnEffectParticles(enemy.ecl?.deathAnm1 ?? 0, enemy.x, enemy.y, 3, 0xffffffff);
    this.spawnEffectParticles((enemy.ecl?.deathAnm2 ?? 0) + 4, enemy.x, enemy.y, 8, 0xffffffff);
    this.spawnEffectParticles(12, enemy.x, enemy.y, 2, 0xff40ffff);
    this.shakeFrames = Math.max(this.shakeFrames, 14);
    this.shakeAmp = Math.max(this.shakeAmp, 6);
  }
  isDialogueBlocking() {
    return !!this.dialogue?.active;
  }
  consumeDialogueResume() {
    const d = this.dialogue;
    if (!d?.active || !d.resumeTickets) return false;
    d.resumeTickets--;
    return true;
  }
  updateDialogue(input) {
    const d = this.dialogue;
    if (!d?.active) return;
    const skip = input.pressed.has('confirm') || input.pressed.has('shoot');
    if (d.waiting) {
      d.waitFrame++;
      if ((skip && d.waitFrame >= 8) || d.waitFrame >= d.waitLimit) d.waiting = false;
      else return;
    }
    while (d.ptr < d.instrs.length) {
      const instr = d.instrs[d.ptr];
      if (d.timer < instr.time) break;
      d.ptr++;
      if (instr.op === 0 || instr.op === 11) {
        d.active = false;
        break;
      } else if (instr.op === 1 || instr.op === 2) {
        d.portraits[instr.portrait] = instr.script || 0;
        d.portraitActive[instr.portrait] = true;
      } else if (instr.op === 3) {
        d.lines[instr.line] = this.localizeText(instr.text);
        d.colors[instr.line] = instr.color || 0;
        if (instr.line === 0) d.lines[1] = '';
      } else if (instr.op === 4) {
        d.waiting = true;
        d.waitFrame = 0;
        d.waitLimit = Math.max(1, instr.arg || 1);
        break;
      } else if (instr.op === 6) {
        d.resumeTickets++;
      } else if (instr.op === 7) {
        const id = this.stageMeta.music[instr.arg];
        if (!id) throw new Error(`Missing original Stage 1 music slot ${instr.arg}`);
        this.requestBgm(id, { fadeMs: 900, label: this.stageMeta.musicLabels[instr.arg] });
      } else if (instr.op === 8) {
        d.intro[instr.line] = this.localizeText(instr.text);
      } else if (instr.op === 12) {
        this.fadeOutBgm(4);
      }
    }
    d.timer++;
  }
  updatePlayer(input) {
    const spec = this.spec();
    if (this.player.state === 'dead') {
      this.updatePlayerDeath();
      return;
    }
    if (this.player.state === 'spawning') {
      this.updatePlayerSpawning();
      return;
    }
    if (this.player.state === 'deathbomb') {
      this.updatePlayerDeathbomb(input);
      return;
    }
    if (this.player.bulletGrace > 0) {
      this.player.bulletGrace--;
      this.enemyBullets = [];
    }
    if (this.player.state === 'invuln') {
      this.player.invuln--;
      if (this.player.invuln <= 0) this.player.state = 'alive';
    }
    this.player.focus = input.held.has('focus');
    this.player.focusT = clamp(this.player.focusT + (this.player.focus ? 1 : -1), 0, 8);
    const dx = Number(input.held.has('right')) - Number(input.held.has('left'));
    const dy = Number(input.held.has('down')) - Number(input.held.has('up'));
    let speed = this.player.focus ? spec.focus : spec.speed;
    if (this.activeBombs.some((bomb) => bomb.type === 'marisaB')) speed *= 0.3;
    speed /= dx && dy ? Math.sqrt(2) : 1;
    this.player.x = clamp(this.player.x + dx * speed, MOVE_AREA.x, MOVE_AREA.right);
    this.player.y = clamp(this.player.y + dy * speed, MOVE_AREA.y, MOVE_AREA.bottom);
    if (input.pressed.has('bomb') && this.bombs > 0 && this.activeBombs.length === 0) this.bomb();
    const shootHeld = input.held.has('shoot');
    if (!shootHeld) this.player.shotFrame = -1;
    else if (this.player.shotFrame < 0) this.player.shotFrame = 0;
    if (shootHeld && this.player.shotFrame >= 0) {
      if (!this.activeBombs.some((bomb) => bomb.type === 'marisaB')) this.shoot();
      this.player.shotFrame++;
      if (this.player.shotFrame >= 30) this.player.shotFrame = -1;
    }
  }
  updatePlayerDeathbomb(input) {
    this.player.deathbombFrame++;
    if (input.pressed.has('bomb') && this.bombs > 0 && this.activeBombs.length === 0) {
      this.player.deathbombTimer = 0;
      this.player.deathbombFrame = 0;
      this.player.deathFrame = 0;
      this.player.deathDropsDone = false;
      this.text('Deathbomb!', this.player.x - 34, this.player.y - 42, 72, '#ffe6a8');
      this.bomb();
      return;
    }
    this.player.deathbombTimer--;
    if (this.player.deathbombTimer <= 0) this.commitMiss(true);
  }
  updatePlayerDeath() {
    this.player.deathFrame++;
    if (!this.player.deathDropsDone && this.player.deathFrame >= PLAYER_DEATH_DROP_DELAY) {
      this.applyMissPenalty();
      this.player.deathDropsDone = true;
    }
    if (this.player.deathFrame < PLAYER_DEATH_ANIM_FRAMES) return;
    if (this.lives <= 0) {
      this.phase = 'gameOver';
      this.track = null;
      this.activeBombs = [];
      this.enemyBullets = [];
      for (const l of this.enemyLasers) l.inUse = false;
      this.enemyLasers = [];
      return;
    }
    this.lives--;
    this.bombs = 3;
    this.player.x = 192;
    this.player.y = 384;
    this.player.state = 'spawning';
    this.player.invuln = 0;
    this.player.bulletGrace = PLAYER_BULLET_GRACE_FRAMES;
    this.player.deathFrame = 0;
    this.player.spawnFrame = 0;
    this.player.deathbombTimer = 0;
    this.player.deathbombFrame = 0;
    this.player.deathDropsDone = false;
    this.player.shotFrame = -1;
    this.enemyBullets = [];
    for (const l of this.enemyLasers) l.inUse = false;
    this.enemyLasers = [];
  }
  updatePlayerSpawning() {
    if (this.player.bulletGrace > 0) {
      this.player.bulletGrace--;
      this.enemyBullets = [];
    }
    this.player.spawnFrame++;
    this.player.focus = false;
    this.player.focusT = clamp(this.player.focusT - 1, 0, 8);
    this.player.shotFrame = -1;
    if (this.player.spawnFrame >= PLAYER_SPAWN_ANIM_FRAMES) {
      this.player.state = 'invuln';
      this.player.invuln = PLAYER_RESPAWN_INVULN;
      this.player.spawnFrame = PLAYER_SPAWN_ANIM_FRAMES;
      this.player.deathbombTimer = PLAYER_DEATHBOMB_WINDOW_FRAMES;
    }
  }
  applyMissPenalty() {
    this.powerItemCountForScore = 0;
    if (this.lives > 0) {
      this.spawnMissPowerItems(this.lives);
      this.power = this.power <= 16 ? 0 : this.power - 16;
    } else {
      this.spawnMissPowerItems(0);
      this.power = 0;
    }
    this.decreaseSubrank(1600);
  }
  shoot() {
    const spec = this.spec();
    const data = sourcePowerData(spec.id, this.power);
    const frame = this.player.shotFrame % 30;
    const orbs = this.orbs();
    for (const p of data.bullets) {
      let laserSlot = -1;
      if (p.bulletType === BULLET_TYPE_LASER) {
        laserSlot = p.frame | 0;
        if ((this.player.laserTimers[laserSlot] || 0) > 0) continue;
        this.player.laserTimers[laserSlot] = p.wait;
      } else if (frame % p.wait !== p.frame) continue;
      const src = p.source === 1 && orbs ? orbs.left : p.source === 2 && orbs ? orbs.right : this.player;
      if (p.sound >= 0) this.audio?.sfx(p.sound);
      const anmIndex = spec.family === 'marisa' ? 1 : 0;
      const rect = this.stageRuntime?.playerAnm?.[anmIndex]?.scriptSprite(p.script);
      const vx = Math.cos(p.angle) * p.speed;
      const vy = Math.sin(p.angle) * p.speed;
      const x = src.x + p.ox;
      const y = p.bulletType === BULLET_TYPE_LASER ? src.y / 2 + vy : src.y + p.oy;
      this.playerBullets.push({
        id: this.id++,
        x,
        y,
        vx,
        vy,
        r: Math.max(3, Math.min(p.sx, p.sy) * 0.35),
        sx: p.sx,
        sy: p.bulletType === BULLET_TYPE_LASER ? src.y : p.sy,
        speed: p.speed,
        baseAngle: p.angle,
        bulletType: p.bulletType,
        homingFrame: 0,
        damage: p.damage,
        color: spec.color,
        family: spec.family,
        shotId: spec.id,
        source: p.source,
        laserSlot,
        script: p.script,
        sheet: spec.sheet,
        rect,
        autoRotate: !!rect?.autoRotate,
        age: 0,
        life: p.bulletType === BULLET_TYPE_LASER ? p.wait : Infinity,
        state: 'fired',
        sourceOffsetX: p.ox
      });
    }
  }
  bomb() {
    const spec = this.spec();
    this.bombs--;
    this.decreaseSubrank(200);
    this.player.state = 'invuln';
    this.player.invuln = Math.max(this.player.invuln, spec.id === 'reimuA' || spec.id === 'marisaB' ? 360 : spec.id === 'marisaA' ? 300 : 200);
    if (this.spellcardInfo?.isActive) {
      this.spellcardInfo.isCapturing = false;
      this.spellcardInfo.usedBomb = true;
    }
    for (const e of this.enemies) e.bombed = true;
    if (spec.id === 'reimuA') {
      this.activeBombs.push(TH06_LOGIC.createReimuABomb(this.player, () => this.rng.f()));
    } else if (spec.id === 'reimuB') this.activeBombs.push(TH06_LOGIC.createReimuBBomb(this.player));
    else if (spec.id === 'marisaA') this.activeBombs.push(TH06_LOGIC.createMarisaABomb(this.player));
    else this.activeBombs.push(TH06_LOGIC.createMarisaBBomb(this.player));
  }
  updateBombs() {
    for (const bomb of this.activeBombs) {
      const ctx = this.bombContext();
      if (bomb.type === 'reimuA') bomb.keep = TH06_LOGIC.updateReimuABomb(bomb, ctx);
      else if (bomb.type === 'reimuB') bomb.keep = TH06_LOGIC.updateReimuBBomb(bomb, ctx);
      else if (bomb.type === 'marisaA') bomb.keep = TH06_LOGIC.updateMarisaABomb(bomb, ctx);
      else if (bomb.type === 'marisaB') bomb.keep = TH06_LOGIC.updateMarisaBBomb(bomb, ctx);
      else bomb.keep = false;
    }
    this.activeBombs = this.activeBombs.filter((bomb) => bomb.keep !== false);
  }
  bombContext() {
    return {
      player: this.player,
      lastEnemyHit: this.frameHomingTarget,
      onClearItems: () => { this.items = []; },
      onText: (label) => this.text(label, this.player.x - 24, this.player.y - 48, 90, '#ffd6e4'),
      onSound: (idx) => this.audio?.sfx(idx),
      onParticles: (effectId, x, y, count, color) => this.spawnEffectParticles(effectId, x, y, count, color),
      onShake: (frames, amp) => {
        this.shakeFrames = Math.max(this.shakeFrames, frames);
        this.shakeAmp = amp;
      },
      onCancel: (x, y, radius) => this.cancelBulletsNear(x, y, radius),
      onCancelBox: (x, y, w, h) => this.cancelBulletsInBox(x, y, w, h),
      onDamageBox: (x, y, w, h, damage, source) => this.damageEnemiesInBox(x, y, w, h, damage, source),
      onBombFrame: (type, index, frame) => {
        if (type === 'reimuB') {
          return this.stageRuntime?.playerAnm?.[0]?.scriptFrame(ANM_SCRIPT_PLAYER_REIMU_B_BOMB_ARRAY + index, 0, frame);
        }
        if (type === 'marisaB') {
          return this.stageRuntime?.playerAnm?.[1]?.scriptFrame(ANM_SCRIPT_PLAYER_MARISA_B_MASTER_SPARK + index, 0, frame);
        }
        return null;
      }
    };
  }
  enemyBox(e) {
    if (e.ecl?.hitbox) return { w: Math.max(1, e.ecl.hitbox.x), h: Math.max(1, e.ecl.hitbox.y) };
    return { w: Math.max(1, e.radius * 2), h: Math.max(1, e.radius * 2) };
  }
  overlapsBox(cx, cy, w, h, e) {
    const box = this.enemyBox(e);
    return Math.abs(cx - e.x) <= (w + box.w) / 2 && Math.abs(cy - e.y) <= (h + box.h) / 2;
  }
  damageEnemy(e, damage, source = 'shot') {
    if (e.ecl && (!e.ecl.canTakeDamage || !e.ecl.interactable)) return 0;
    const raw = source === 'shot'
      ? TH06_LOGIC.playerShotDamageForEnemy(damage, this.activeBombs.length > 0)
      : Math.trunc(damage);
    if (raw <= 0) return 0;
    const current = this.pendingEnemyDamage.get(e) || { total: 0, bombed: false, hitWithBombRegion: false };
    current.total += raw;
    current.bombed ||= source.startsWith('bomb');
    current.hitWithBombRegion ||= source.startsWith('bomb');
    this.pendingEnemyDamage.set(e, current);
    if (this.lastEnemyHit.y < e.y) this.lastEnemyHit = { x: e.x, y: e.y };
    return raw;
  }
  flushEnemyDamage() {
    for (const [e, entry] of this.pendingEnemyDamage) {
      if (!this.enemies.includes(e) || (e.ecl && (!e.ecl.canTakeDamage || !e.ecl.interactable))) continue;
      const capped = TH06_LOGIC.capEnemyFrameDamage(entry.total);
      let applied = capped;
      if (this.spellcardInfo?.isActive) {
        applied = TH06_LOGIC.spellcardDamageForEnemy(capped, entry.hitWithBombRegion, this.spellcardInfo.usedBomb);
      }
      this.score += Math.floor(capped / 5) * 10;
      if (entry.bombed) e.bombed = true;
      if (applied <= 0) continue;
      e.hp -= applied;
    }
    this.pendingEnemyDamage.clear();
  }
  damageEnemiesInBox(x, y, w, h, damage, source = 'bomb') {
    let total = 0;
    for (const e of this.enemies) {
      if (this.overlapsBox(x, y, w, h, e)) total += this.damageEnemy(e, damage, source);
    }
    return total;
  }
  refreshHomingTargetFromEnemies() {
    this.lastEnemyHit = TH06_LOGIC.chooseHomingTarget(this.enemies);
  }
  cancelBulletsNear(x, y, radius) {
    const radiusSq = radius * radius;
    this.enemyBullets = this.enemyBullets.filter((b) => {
      const hitR = b.hitR ?? b.r ?? 0;
      if (dist2({ x, y }, b) > (radius + hitR) ** 2) return true;
      this.spawnItem('pointBullet', b.x, b.y, { state: 1 });
      return false;
    });
  }
  cancelBulletsInBox(x, y, w, h) {
    this.enemyBullets = this.enemyBullets.filter((b) => {
      const hitR = b.hitR ?? b.r ?? 0;
      if (Math.abs(b.x - x) > w / 2 + hitR || Math.abs(b.y - y) > h / 2 + hitR) return true;
      this.spawnItem('pointBullet', b.x, b.y, { state: 1 });
      return false;
    });
  }
  updateEnemies() {
    for (const e of this.enemies) {
      e.frame++;
      if (e.ecl) this.stageRuntime.updateEnemy(this, e);
      else e.dead = true;
    }
    for (const e of this.enemies.filter((e) => e.hp <= 0 || this.out(e))) {
      if (e.hp <= 0) {
        if (e.ecl) {
          const keep = this.stageRuntime.killEnemy(this, e);
          if (keep) {
            this.audio?.sfx(e.ecl.isBoss ? SOUND.BOSS_DEAD : SOUND.ENEMY_DEAD);
            continue;
          }
          this.audio?.sfx(e.ecl.isBoss ? SOUND.BOSS_DEAD : SOUND.ENEMY_DEAD);
        }
      }
      e.dead = true;
    }
    this.enemies = this.enemies.filter((e) => e.hp > 0 && !e.dead && !this.out(e));
  }
  updatePlayerBullets() {
    for (let i = 0; i < this.player.laserTimers.length; i++) {
      if (this.player.laserTimers[i] > 0) this.player.laserTimers[i]--;
    }
    const homingTarget = this.frameHomingTarget || { x: -999, y: -999 };
    for (const b of this.playerBullets) {
      if (b.bulletType === BULLET_TYPE_HOMING && b.state === 'fired') TH06_LOGIC.updateHomingBullet(b, homingTarget);
      else if (b.bulletType === BULLET_TYPE_ACCEL && b.state === 'fired') b.vy -= 0.3;
      else if (b.bulletType === BULLET_TYPE_LASER) this.updatePlayerLaserBullet(b);
      if (b.bulletType !== BULLET_TYPE_LASER) {
        b.x += b.vx;
        b.y += b.vy;
      }
      b.age = (b.age || 0) + 1;
      for (const e of this.enemies) {
        const bw = b.sx || b.r * 2;
        const bh = b.sy || b.r * 2;
        const hit = b.sx || e.ecl ? this.overlapsBox(b.x, b.y, bw, bh, e) : dist2(b, e) <= (b.r + e.radius) ** 2;
        if (hit) {
          this.damageEnemy(e, b.damage, 'shot');
          if (b.bulletType === BULLET_TYPE_ACCEL) this.collideMarisaAStar(b);
          else if (b.bulletType !== BULLET_TYPE_LASER) {
            b.dead = true;
            break;
          }
        }
      }
    }
    this.playerBullets = this.playerBullets.filter((b) => !b.dead && b.age < b.life && (b.bulletType === BULLET_TYPE_LASER || this.inArcadeBounds(b.x, b.y, b.rect?.w || b.sx || b.r * 2, b.rect?.h || b.sy || b.r * 2)));
  }
  updatePlayerLaserBullet(b) {
    const orbs = this.orbs();
    const src = b.source === 1 && orbs ? orbs.left : b.source === 2 && orbs ? orbs.right : this.player;
    b.x = src.x + (b.sourceOffsetX || 0);
    b.y = src.y / 2 + b.vy;
    b.sy = Math.max(1, src.y);
  }
  collideMarisaAStar(b) {
    if (b.state === 'fired') {
      b.state = 'collided';
      b.vx /= 8;
      b.vy /= 8;
      this.spawnEffectParticles(5, b.x, b.y, 1, 0xffffffff);
    }
    b.damage = Math.max(1, Math.trunc(b.damage / 4));
    const size = b.script === ANM_SCRIPT_PLAYER_MARISA_A_ORB_BULLET_1 ? 32
      : b.script === ANM_SCRIPT_PLAYER_MARISA_A_ORB_BULLET_2 ? 42
        : b.script === ANM_SCRIPT_PLAYER_MARISA_A_ORB_BULLET_3 || b.script === ANM_SCRIPT_PLAYER_MARISA_A_ORB_BULLET_4 ? 48
          : Math.max(b.sx || 12, b.sy || 12);
    b.sx = size;
    b.sy = size;
  }
  inArcadeBounds(x, y, w, h) {
    return x + w / 2 >= 0 && x - w / 2 <= PLAYFIELD.width && y + h / 2 >= 0 && y - h / 2 <= PLAYFIELD.height;
  }
  scoreGraze(center) {
    if (this.activeBombs.length === 0) this.graze++;
    this.score += 500;
    this.increaseSubrank(6);
    const px = center ? (this.player.x + center.x) / 2 : this.player.x;
    const py = center ? (this.player.y + center.y) / 2 : this.player.y;
    this.spawnEffectParticles(8, px, py, 1, 0xffffffff);
    this.audio?.sfx(SOUND.GRAZE);
  }
  updateEnemyBullets() {
    for (const b of this.enemyBullets) {
      this.updateEnemyBulletMotion(b);
      b.x += b.vx;
      b.y += b.vy;
      const dx = Math.abs(this.player.x - b.x);
      const dy = Math.abs(this.player.y - b.y);
      const hitR = b.hitR ?? b.r;
      const playerCanGraze = this.player.state === 'alive' || this.player.state === 'invuln';
      if (!b.grazed && dx <= hitR + PLAYER_GRAZE_PADDING + PLAYER_HITBOX_HALF.x && dy <= hitR + PLAYER_GRAZE_PADDING + PLAYER_HITBOX_HALF.y && playerCanGraze) {
        b.grazed = true;
        this.scoreGraze(b);
      }
      if (dx <= hitR + PLAYER_HITBOX_HALF.x && dy <= hitR + PLAYER_HITBOX_HALF.y && this.player.state === 'alive') {
        this.die();
        b.y = 9999;
      }
    }
    this.enemyBullets = this.enemyBullets.filter((b) => {
      const w = b.rect?.w || (b.r || b.hitR || 8) * 2;
      const h = b.rect?.h || (b.r || b.hitR || 8) * 2;
      if (this.inArcadeBounds(b.x, b.y, w, h)) {
        b.outFrames = 0;
        return true;
      }
      if (!(b.flags & (0x40 | 0x80 | 0x100 | 0x400 | 0x800)) && !b.outFrames) return false;
      b.outFrames = (b.outFrames || 0) + 1;
      return b.outFrames < 0x100;
    });
  }
  updateEnemyLasers() {
    for (const l of this.enemyLasers) {
      if (!l.inUse) continue;
      l.endOffset += l.speed || 0;
      if (l.startLength < l.endOffset - l.startOffset) l.startOffset = l.endOffset - l.startLength;
      if (l.startOffset < 0) l.startOffset = 0;

      const length = Math.max(0, l.endOffset - l.startOffset);
      l.hitboxLength = length;
      l.visualWidth = l.width;
      l.canHit = false;
      l.canGraze = false;

      if (l.state === 0) {
        if (l.flags & 1) {
          l.alpha = clamp(l.timer / Math.max(1, l.startTime), 0, 1);
        } else {
          const rampFrames = Math.min(l.startTime, 30);
          const thin = l.startTime - rampFrames < l.timer ? l.timer * l.width / Math.max(1, l.startTime) : 1.2;
          l.visualWidth = thin;
          l.hitboxLength = thin / 2;
          l.alpha = 0.55;
        }
        if (l.timer >= l.hitboxStartTime) {
          l.canHit = true;
          l.canGraze = l.timer % 12 === 0;
        }
        if (l.timer >= l.startTime) {
          l.state = 1;
          l.timer = 0;
          l.alpha = 1;
          l.visualWidth = l.width;
          l.hitboxLength = length;
          l.canHit = true;
          l.canGraze = true;
        }
      } else if (l.state === 1) {
        l.alpha = 1;
        l.canHit = true;
        l.canGraze = l.timer % 12 === 0;
        if (l.timer >= l.duration) {
          l.state = 2;
          l.timer = 0;
          if (l.despawnDuration <= 0) {
            l.inUse = false;
            continue;
          }
        }
      } else if (l.state === 2) {
        const left = Math.max(0, l.despawnDuration - l.timer);
        l.alpha = clamp(left / Math.max(1, l.despawnDuration), 0, 1);
        l.visualWidth = l.despawnDuration > 0 ? l.width * left / l.despawnDuration : 0;
        l.hitboxLength = l.visualWidth / 2;
        l.canHit = l.timer < l.hitboxEndDelay;
        l.canGraze = l.canHit && l.timer % 12 === 0;
        if (l.timer >= l.despawnDuration) {
          l.inUse = false;
          continue;
        }
      }

      this.checkLaserCollision(l);
      if (l.startOffset >= 640) l.inUse = false;
      l.timer++;
    }
    this.enemyLasers = this.enemyLasers.filter((l) => l.inUse);
  }
  laserLocal(l, point) {
    const dx = point.x - l.x;
    const dy = point.y - l.y;
    const c = Math.cos(l.angle);
    const s = Math.sin(l.angle);
    return {
      along: c * dx + s * dy,
      perp: -s * dx + c * dy
    };
  }
  checkLaserCollision(l) {
    if (!l.canHit) return;
    const local = this.laserLocal(l, this.player);
    const center = l.startOffset + Math.max(0, l.endOffset - l.startOffset) / 2;
    const halfLen = Math.max(0, l.hitboxLength || 0) / 2;
    const halfWidth = Math.max(0.5, (l.width || 0) / 4);
    const hit = Math.abs(local.along - center) <= halfLen + PLAYER_HITBOX_HALF.x && Math.abs(local.perp) <= halfWidth + PLAYER_HITBOX_HALF.y;
    if (hit && this.player.state === 'alive') {
      this.die();
      return;
    }
    if (!l.canGraze || (this.player.state !== 'alive' && this.player.state !== 'invuln')) return;
    const graze = Math.abs(local.along - center) <= halfLen + 48 + PLAYER_HITBOX_HALF.x && Math.abs(local.perp) <= halfWidth + 48 + PLAYER_HITBOX_HALF.y;
    if (graze) {
      const c = Math.cos(l.angle);
      const s = Math.sin(l.angle);
      this.scoreGraze({ x: l.x + c * center - s * local.perp, y: l.y + s * center + c * local.perp });
    }
  }
  updateEnemyBulletMotion(b) {
    if (!b.flags) return;
    b.age = (b.age || 0) + 1;
    if (b.flags & 0x10) {
      const limit = b.exInts?.[0] > 0 ? b.exInts[0] : 99999;
      if (b.age >= limit) b.flags &= ~0x10;
      else {
        const angle = (b.exFloats?.[1] ?? -1000) <= -999 ? b.angle : b.exFloats[1];
        const accel = b.exFloats?.[0] || 0;
        b.vx += Math.cos(angle) * accel;
        b.vy += Math.sin(angle) * accel;
        b.angle = Math.atan2(b.vy, b.vx);
        b.speed = Math.hypot(b.vx, b.vy);
      }
    } else if (b.flags & 0x20) {
      const limit = b.exInts?.[0] || 0;
      if (b.age >= limit) b.flags &= ~0x20;
      else {
        b.angle = normalizeLocalAngle(b.angle + (b.exFloats?.[1] || 0));
        b.speed += b.exFloats?.[0] || 0;
        b.vx = Math.cos(b.angle) * b.speed;
        b.vy = Math.sin(b.angle) * b.speed;
      }
    }
    if (b.flags & 0x40) this.dirChangeBullet(b, 'relative');
    else if (b.flags & 0x100) this.dirChangeBullet(b, 'absolute');
    else if (b.flags & 0x80) this.dirChangeBullet(b, 'aimed');
    else if (b.flags & 0x400) this.bounceBullet(b, true);
    else if (b.flags & 0x800) this.bounceBullet(b, false);
  }
  dirChangeBullet(b, mode) {
    const next = b.dirInterval * (b.dirTimes + 1);
    let speed = b.speed;
    if (b.age >= next) {
      b.dirTimes++;
      if (b.dirTimes >= b.dirMax) b.flags &= mode === 'relative' ? ~0x40 : mode === 'absolute' ? ~0x100 : ~0x80;
      if (mode === 'relative') b.angle = normalizeLocalAngle(b.angle + b.dirRotation);
      else if (mode === 'absolute') b.angle = b.dirRotation;
      else b.angle = Math.atan2(this.player.y - b.y, this.player.x - b.x) + b.dirRotation;
      b.speed = b.dirSpeed;
      speed = b.speed;
    } else {
      speed = b.speed - ((b.age - b.dirInterval * b.dirTimes) * b.speed) / b.dirInterval;
    }
    b.vx = Math.cos(b.angle) * speed;
    b.vy = Math.sin(b.angle) * speed;
  }
  bounceBullet(b, includeBottom) {
    if (b.x >= 0 && b.x < PLAYFIELD.width && b.y >= 0 && (includeBottom ? b.y < PLAYFIELD.height : true)) return;
    if (b.x < 0 || b.x >= PLAYFIELD.width) b.angle = normalizeLocalAngle(-b.angle - Math.PI);
    if (b.y < 0 || (includeBottom && b.y >= PLAYFIELD.height)) b.angle = -b.angle;
    b.speed = b.dirSpeed;
    b.vx = Math.cos(b.angle) * b.speed;
    b.vy = Math.sin(b.angle) * b.speed;
    b.dirTimes++;
    if (b.dirTimes >= b.dirMax) b.flags &= includeBottom ? ~0x400 : ~0x800;
  }
  updateItems() {
    for (const item of this.items) {
      item.age++;
      if (item.state === 2 && item.age <= 60) {
        const t = (item.age - 1) / 60;
        item.x = item.startX * (1 - t) + item.targetX * t;
        item.y = item.startY * (1 - t) + item.targetY * t;
      } else if (item.state === 1 || this.itemGetBorderActive()) {
        const angle = Math.atan2(this.player.y - item.y, this.player.x - item.x);
        item.vx = Math.cos(angle) * 8;
        item.vy = Math.sin(angle) * 8;
        item.state = 1;
      } else {
        if (item.state === 2) {
          item.state = 0;
          item.vx = 0;
          item.vy = 0;
        }
        item.vy = Math.min(3, item.vy + 0.03);
      }
      item.x += item.vx;
      item.y += item.vy;
      const canCollect = this.player.state === 'alive' || this.player.state === 'invuln';
      if (canCollect && Math.abs(item.x - this.player.x) <= PLAYER_ITEM_GRAB_HALF.x + ITEM_HITBOX_HALF && Math.abs(item.y - this.player.y) <= PLAYER_ITEM_GRAB_HALF.y + ITEM_HITBOX_HALF) {
        this.collect(item);
        item.y = 9999;
      }
    }
    for (const item of this.items) {
      if (!item.missed && item.y >= PLAYFIELD.height + 16) {
        item.missed = true;
        this.decreaseSubrank(3);
      }
    }
    this.items = this.items.filter((i) => i.y < 512);
  }
  turnBulletsIntoPointItems() {
    for (const b of this.enemyBullets) {
      this.spawnItem('pointBullet', b.x, b.y, { state: 1 });
    }
    this.enemyBullets = [];
    for (const l of this.enemyLasers) {
      if (!l.inUse || l.state >= 2) continue;
      for (let off = l.startOffset; l.endOffset > off; off += 32) {
        this.spawnItem('pointBullet', l.x + Math.cos(l.angle) * off, l.y + Math.sin(l.angle) * off, { state: 1 });
      }
      l.state = 2;
      l.timer = 0;
      l.hitboxEndDelay = 0;
    }
  }
  collect(item) {
    this.audio?.sfx(SOUND.ITEM);
    if (item.type === 'power' || item.type === 'bigPower') {
      const result = TH06_LOGIC.collectPowerItem(this.power, this.powerItemCountForScore, item.type === 'bigPower' ? 8 : 1);
      const reachedFullPower = this.power < 128 && result.fullPower;
      this.power = result.power;
      this.powerItemCountForScore = result.powerItemCountForScore;
      this.score += result.score;
      if (reachedFullPower) this.turnBulletsIntoPointItems();
      if (result.powerUp) this.audio?.sfx(SOUND.POWERUP);
      if (item.type === 'power') this.increaseSubrank(1);
    } else if (item.type === 'point') {
      this.score += TH06_LOGIC.pointItemScore(item.y, this.difficulty);
      this.pointItemsCollectedInStage++;
      this.increaseSubrank(item.y < 128 ? 30 : 3);
    } else if (item.type === 'pointBullet') {
      this.score += TH06_LOGIC.pointBulletScore(this.graze, this.activeBombs.length > 0);
    } else if (item.type === 'bomb') {
      this.bombs = clamp(this.bombs + 1, 0, 8);
      this.increaseSubrank(5);
    } else if (item.type === 'fullPower') {
      if (this.power < 128) this.turnBulletsIntoPointItems();
      this.power = 128;
      this.score += 1000;
      this.audio?.sfx(SOUND.POWERUP);
    } else if (item.type === 'life') {
      this.lives = clamp(this.lives + 1, 0, 8);
      this.increaseSubrank(200);
      this.audio?.sfx(SOUND.ONE_UP);
    }
  }
  die() {
    if (this.player.state !== 'alive') return;
    if (this.bombs > 0 && this.activeBombs.length === 0) {
      this.startDeathbombWindow();
      return;
    }
    this.commitMiss();
  }
  startDeathbombWindow() {
    this.spellcardInfo.isCapturing = false;
    this.player.state = 'deathbomb';
    this.player.deathbombTimer = PLAYER_DEATHBOMB_WINDOW_FRAMES;
    this.player.deathbombFrame = 0;
    this.player.deathFrame = 0;
    this.player.deathDropsDone = false;
    this.player.shotFrame = -1;
    this.flash = Math.max(this.flash, 8);
    this.spawnEffectParticles(8, this.player.x, this.player.y, 1, 0xffff80ff);
  }
  commitMiss(immediatePenalty = false) {
    if (this.player.state === 'dead') return;
    this.audio?.sfx(SOUND.PICHUN);
    this.spellcardInfo.isCapturing = false;
    this.spawnEffectParticles(12, this.player.x, this.player.y, 1, 0xff40ffff);
    this.spawnEffectParticles(6, this.player.x, this.player.y, 16, 0xffffffff);
    this.player.state = 'dead';
    this.player.deathFrame = immediatePenalty ? PLAYER_DEATH_DROP_DELAY : 0;
    this.player.deathbombTimer = 0;
    this.player.deathbombFrame = 0;
    this.player.deathDropsDone = false;
    this.player.shotFrame = -1;
    this.activeBombs = [];
    if (immediatePenalty) {
      this.applyMissPenalty();
      this.player.deathDropsDone = true;
    }
  }
  clear() {
    if (this.phase !== 'playing') return;
    this.phase = 'stageClear';
    this.track = null;
    this.setBossPresent(false);
    this.enemyBullets = [];
    for (const l of this.enemyLasers) l.inUse = false;
    this.enemyLasers = [];
    this.playerBullets = [];
    this.activeBombs = [];
  }
  out(e) {
    if (e.ecl) {
      if (e.ecl.isBoss || !e.ecl.seen) return false;
      return e.x < -80 || e.x > 464 || e.y < -96 || e.y > 544;
    }
    if (e.kind === 'boss' || e.kind === 'midboss') return e.y < -96 || e.y > 544;
    return e.x < -80 || e.x > 464 || e.y > 528;
  }
  text(text, x, y, life, color) {
    this.texts.push({ id: this.id++, text, x, y, life, age: 0, color });
  }
  updateTexts() {
    for (const t of this.texts) {
      t.age++;
      t.y -= 0.25;
    }
    this.texts = this.texts.filter((t) => t.age < t.life);
  }
  spawnEffectParticles(effectId, x, y, count = 1, color = 0xffffffff) {
    const spawned = [];
    const spec = this.stageRuntime.effectSpec(effectId);
    for (let i = 0; i < Math.max(1, count | 0); i++) {
      const angle = this.rng.f() * TAU - Math.PI;
      const randomIndex = Math.floor(this.rng.range(4));
      const effect = {
        type: 'anmEffect',
        effectId,
        x,
        y,
        originX: x,
        originY: y,
        vx: 0,
        vy: 0,
        ax: 0,
        ay: 0,
        dirX: Math.cos(angle),
        dirY: Math.sin(angle),
        angleRelated: 0,
        radius: 0,
        distance: 0,
        pos2: { x: 0, y: 0, z: 1 },
        callback: spec.callback,
        randomIndex,
        color: color >>> 0,
        age: 0,
        life: spec.life || 32
      };
      if (spec.callback === 'randomSplash' || spec.callback === 'randomSplashBig') {
        const scale = spec.callback === 'randomSplashBig' ? 4 / 33 : 1 / 12;
        effect.vx = (this.rng.f() * 256 - 128) * scale;
        effect.vy = (this.rng.f() * 256 - 128) * scale;
        const damp = spec.callback === 'randomSplashBig' ? 20 : 19;
        effect.ax = -effect.vx / damp;
        effect.ay = -effect.vy / damp;
      }
      this.effects.push(effect);
      spawned.push(effect);
    }
    return spawned;
  }
  spawnEnemyDeathEffect(enemy, state = enemy.ecl || {}) {
    const x = enemy.x;
    const y = enemy.y;
    const primary = state.deathAnm1 ?? 0;
    const burst = (state.deathAnm2 ?? 0) + 4;
    const boss = state.isBoss || enemy.kind === 'boss';
    const primaryCount = boss || state.deathMode === 3 ? 3 : 1;
    this.spawnEffectParticles(primary, x, y, primaryCount, 0xffffffff);
    this.spawnEffectParticles(burst, x, y, boss ? 8 : 4, 0xffffffff);
    if (boss) {
      this.spawnEffectParticles(12, x, y, 2, 0xff40ffff);
      this.shakeFrames = Math.max(this.shakeFrames, 18);
      this.shakeAmp = Math.max(this.shakeAmp, 7);
    }
  }
  spawnSpellEffect(enemy, colorId, axis, distance) {
    const color = TH06_LOGIC.effectColorById(colorId);
    const spawned = this.spawnEffectParticles(13, enemy.x, enemy.y, 1, color);
    const effect = spawned[0];
    if (!effect) return;
    effect.enemyId = enemy.id;
    effect.spellEffect = true;
    effect.pos2 = axis || { x: 0, y: 0, z: 1 };
    effect.distance = distance || 96;
    effect.life = 3600;
  }
  updateEffects() {
    for (const effect of this.effects) {
      effect.age++;
      if (effect.type === 'anmEffect' && (effect.callback === 'randomSplash' || effect.callback === 'randomSplashBig' || effect.callback === 'still')) {
        effect.x += effect.vx;
        effect.y += effect.vy;
        effect.vx += effect.ax;
        effect.vy += effect.ay;
      } else if (effect.type === 'anmEffect' && (effect.callback === 'attract' || effect.callback === 'attractSlow')) {
        const duration = effect.callback === 'attractSlow' ? 240 : 60;
        const radius = Math.max(0, 256 - effect.age * 256 / duration);
        effect.x = effect.originX + effect.dirX * radius;
        effect.y = effect.originY + effect.dirY * radius;
      } else if (effect.type === 'anmEffect' && effect.callback === 'orbit') {
        const owner = this.enemies.find((e) => e.id === effect.enemyId);
        if (owner) {
          effect.originX = owner.x;
          effect.originY = owner.y;
        }
        if (effect.radius < effect.distance) effect.radius += 0.3;
        effect.angleRelated = normalizeLocalAngle(effect.angleRelated + Math.PI / 100);
        const axis = Math.atan2(effect.pos2?.y || 0, effect.pos2?.x || 1);
        effect.x = effect.originX + Math.cos(effect.angleRelated + axis) * effect.radius;
        effect.y = effect.originY + Math.sin(effect.angleRelated + axis) * effect.radius * 0.65;
      }
    }
    this.effects = this.effects.filter((effect) => {
      if (effect.spellEffect && !this.enemies.some((e) => e.id === effect.enemyId)) return false;
      return effect.age < effect.life;
    });
  }
  updateBossUi() {
    const ui = this.bossUi;
    const boss = this.enemies.find((e) => e.kind === 'boss' || e.ecl?.isBoss);
    if (boss?.ecl?.isBoss) ui.present = true;
    else if (!boss) ui.present = false;

    if (boss) {
      ui.bossName = this.stageMeta.bossName;
      ui.barActual = clamp(boss.hp / Math.max(1, boss.maxHp), 0, 1);
      if (boss.ecl) {
        ui.lives = boss.ecl.bossLifeCount ?? ui.lives;
        if (boss.ecl.spellNameEnglish) ui.spellName = boss.ecl.spellNameEnglish;
        if (boss.ecl.timerCallbackThreshold >= 0) {
          ui.timerSeconds = Math.max(0, Math.trunc((boss.ecl.timerCallbackThreshold - boss.ecl.bossTimer) / 60));
        }
      }
    } else {
      ui.barActual = 0;
    }

    if (ui.present) {
      if (ui.state === 0) ui.state = 1;
      ui.opacity = Math.min(255, ui.opacity + 4);
      if (ui.state === 1 && ui.opacity >= 255) ui.state = 2;
    } else if (ui.state !== 0) {
      ui.state = 3;
      ui.opacity = Math.max(0, ui.opacity - 4);
      if (ui.opacity === 0) {
        ui.state = 0;
        ui.barDisplay = 0;
        ui.spellName = '';
      }
    }

    if (ui.state >= 2 || ui.present) {
      if (ui.barActual > ui.barDisplay) ui.barDisplay = Math.min(ui.barActual, ui.barDisplay + 0.01);
      else if (ui.barActual < ui.barDisplay) ui.barDisplay = Math.max(ui.barActual, ui.barDisplay - 0.02);
    }
    if (ui.present && ui.timerSeconds < 10 && ui.timerSeconds !== ui.lastTimerSeconds) {
      this.audio?.sfx(SOUND.TIMER);
    }
    ui.lastTimerSeconds = ui.timerSeconds;
  }
}

class Renderer {
  constructor(canvas, assets, game) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.ctx.imageSmoothingEnabled = false;
    this.assets = assets;
    this.game = game;
    this.tintCanvas = document.createElement('canvas');
    this.tintCtx = this.tintCanvas.getContext('2d');
  }
  draw() {
    const g = this.game;
    this.ctx.clearRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    if (['title', 'difficulty', 'character'].includes(g.phase)) return this.menu();
    const shake = this.shakeOffset();
    this.ctx.save();
    this.ctx.translate(shake.x, shake.y);
    this.stage();
    this.entities();
    this.ctx.restore();
    this.hud();
    this.overlay();
  }
  shakeOffset() {
    const g = this.game;
    if (!g.shakeFrames) return { x: 0, y: 0 };
    const amp = Math.max(0, g.shakeAmp || 0) * Math.min(1, g.shakeFrames / 12);
    return {
      x: Math.round(Math.sin(g.stageFrame * 2.31) * amp),
      y: Math.round(Math.cos(g.stageFrame * 1.73) * amp * 0.5)
    };
  }
  image(key, x, y, w, h, alpha = 1) {
    const img = this.assets[key];
    this.ctx.save();
    this.ctx.globalAlpha = alpha;
    this.ctx.drawImage(img, x - w / 2, y - h / 2, w, h);
    this.ctx.restore();
  }
  sheetSprite(key, sx, sy, sw, sh, x, y, w = sw, h = sh, anchorX = sw / 2, anchorY = sh / 2, alpha = 1) {
    const img = this.assets[key];
    this.ctx.save();
    this.ctx.globalAlpha = alpha;
    this.ctx.drawImage(img, sx, sy, sw, sh, x - w * anchorX / sw, y - h * anchorY / sh, w, h);
    this.ctx.restore();
  }
  rotatedSheetSprite(key, sx, sy, sw, sh, x, y, w, h, rotation = 0, alpha = 1) {
    const img = this.assets[key];
    const ctx = this.ctx;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(x, y);
    ctx.rotate(rotation);
    ctx.drawImage(img, sx, sy, sw, sh, -w / 2, -h / 2, w, h);
    ctx.restore();
  }
  drawAnmFrame(key, frame, x, y, options = {}) {
    if (!frame) return false;
    const img = this.assets[key || frame.imageKey];
    if (!img) return false;
    const ctx = this.ctx;
    const sx = frame.x;
    const sy = frame.y;
    const sw = frame.w;
    const sh = frame.h;
    const scaleMul = options.scaleMultiplier ?? 1;
    const scaleX = (options.scaleX ?? frame.scaleX ?? 1) * scaleMul;
    const scaleY = (options.scaleY ?? frame.scaleY ?? 1) * scaleMul;
    const w = Math.max(0.001, Math.abs(sw * scaleX));
    const h = Math.max(0.001, Math.abs(sh * scaleY));
    const drawX = x + (frame.vmX || 0) + (frame.posOffsetX || 0) + (options.offsetX || 0);
    const drawY = y + (frame.vmY || 0) + (frame.posOffsetY || 0) + (options.offsetY || 0);
    const anchorX = frame.anchorTopLeft ? 0 : w / 2;
    const anchorY = frame.anchorTopLeft ? 0 : h / 2;
    const alpha = (options.alpha ?? 1) * ((frame.alpha ?? 255) / 255);
    if (alpha <= 0) return false;
    const color = (options.color ?? frame.color ?? 0xffffffff) >>> 0;
    const tint = (color & 0x00ffffff) !== 0x00ffffff;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.globalCompositeOperation = options.blend ?? (frame.blendAdd ? 'lighter' : 'source-over');
    ctx.translate(drawX, drawY);
    ctx.rotate(options.rotation ?? frame.rotation ?? 0);
    if (scaleX < 0 || frame.flipX) ctx.scale(-1, 1);
    if (scaleY < 0 || frame.flipY) ctx.scale(1, -1);
    if (tint) this.tintedSprite(img, sx, sy, sw, sh, -anchorX, -anchorY, w, h, color);
    else ctx.drawImage(img, sx, sy, sw, sh, -anchorX, -anchorY, w, h);
    ctx.restore();
    return true;
  }
  hasAnmScript(anm, scriptId) {
    return !!anm?.scripts?.has?.(scriptId);
  }
  tintedSprite(img, sx, sy, sw, sh, dx, dy, dw, dh, color) {
    const c = colorParts(color);
    this.tintCanvas.width = Math.max(1, Math.ceil(sw));
    this.tintCanvas.height = Math.max(1, Math.ceil(sh));
    const tctx = this.tintCtx;
    tctx.clearRect(0, 0, this.tintCanvas.width, this.tintCanvas.height);
    tctx.globalCompositeOperation = 'source-over';
    tctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
    tctx.globalCompositeOperation = 'multiply';
    tctx.fillStyle = `rgb(${c.r}, ${c.g}, ${c.b})`;
    tctx.fillRect(0, 0, sw, sh);
    tctx.globalCompositeOperation = 'destination-in';
    tctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
    tctx.globalCompositeOperation = 'source-over';
    this.ctx.drawImage(this.tintCanvas, 0, 0, sw, sh, dx, dy, dw, dh);
  }
  playerSprite(spec, x, y, scale = 1, alpha = 1, frameSeed = this.game.stageFrame, scaleY = scale) {
    const anmIndex = spec.sheet === 'player01' ? 1 : 0;
    const rect = this.game.stageRuntime.playerAnm[anmIndex].scriptSprite(0, 0, frameSeed % 32);
    if (!rect) return;
    this.sheetSprite(
      spec.sheet,
      rect.x,
      rect.y,
      rect.w,
      rect.h,
      x,
      y,
      rect.w * scale,
      rect.h * scaleY,
      rect.w / 2,
      rect.h / 2,
      alpha
    );
  }
  fillText(text, x, y, size = 16, color = '#fff', align = 'left') {
    const ctx = this.ctx;
    ctx.save();
    ctx.font = `${size}px "MS Gothic", "Yu Gothic", monospace`;
    ctx.textAlign = align;
    ctx.textBaseline = 'top';
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#120711';
    ctx.fillStyle = color;
    ctx.strokeText(text, x, y);
    ctx.fillText(text, x, y);
    ctx.restore();
  }
  rect(x, y, w, h, color, alpha = 1, stroke = null) {
    const ctx = this.ctx;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
    if (stroke) {
      ctx.globalAlpha = 1;
      ctx.strokeStyle = stroke;
      ctx.strokeRect(x, y, w, h);
    }
    ctx.restore();
  }
  menu() {
    const g = this.game;
    this.image(g.phase === 'title' ? 'titleBg' : 'selectBg', 320, 240, 640, 480);
    this.rect(0, 0, 640, 480, '#050509', 0.28);
    if (g.phase === 'title') {
      this.item('Start', 76, 220, true);
      this.item('Replay', 76, 248, false);
      this.item('Music Room', 76, 276, false);
      this.item('Quit', 76, 304, false);
    } else if (g.phase === 'difficulty') {
      this.fillText('Difficulty Select', 72, 186, 18);
      this.item('Lunatic', 84, 232, true);
    } else {
      this.fillText('Player Select', 72, 168, 18);
      chars.forEach((c, i) => {
        const x = 96 + i * 118;
        const enabled = g.isCharacterEnabled(i);
        if (i === g.selected && enabled) this.rect(x - 37, 205, 74, 98, 'rgba(255,255,255,0.1)', 1, '#ffd36a');
        this.playerSprite(c, x, 266, 1.55, enabled ? (i === g.selected ? 1 : 0.42) : 0.16, i * 13);
        this.fillText(c.label, x - 36, 300, 13, enabled ? (i === g.selected ? '#ffe6a8' : '#9aa0b8') : 'rgba(120,128,150,0.38)');
      });
    }
  }
  item(label, x, y, active) {
    this.fillText(active ? '>' : ' ', x, y, 18, active ? '#ffe6a8' : '#96a2c0');
    this.fillText(label, x + 24, y, 18, active ? '#fff' : 'rgba(150,162,192,0.45)');
  }
  stage() {
    const g = this.game;
    const fog = g.stageRuntime?.std?.fog(g.stageFrame);
    this.rect(0, 0, 640, 480, '#050509');
    this.rect(PLAYFIELD.x, PLAYFIELD.y, PLAYFIELD.width, PLAYFIELD.height, fog?.css || '#090b18');
    if (g.stageRuntime) this.stageStd(g.stageRuntime.std);
    else {
      const scroll = (g.stageFrame * 0.7) % 256;
      for (let y = -256 + scroll; y < PLAYFIELD.height + 256; y += 256) {
        for (let x = 0; x < PLAYFIELD.width; x += 256) {
          this.ctx.drawImage(this.assets.stageBg, PLAYFIELD.x + x, PLAYFIELD.y + y, 256, 256);
        }
      }
    }
    this.rect(PLAYFIELD.x, PLAYFIELD.y, PLAYFIELD.width, PLAYFIELD.height, fog?.css || '#05020a', fog ? 0.18 : 0.24);
    if (g.spellcardInfo?.isActive) this.spellBackground();
    this.ctx.strokeStyle = '#ffd6e4';
    this.ctx.strokeRect(PLAYFIELD.x - 2, PLAYFIELD.y - 2, PLAYFIELD.width + 4, PLAYFIELD.height + 4);
  }
  spellBackground() {
    const ctx = this.ctx;
    const g = this.game;
    const t = g.spellcardInfo?.frame ?? g.stageFrame;
    const anmFrame = g.stageRuntime?.effectFrame?.(16, t, 0, 0xffffffff);
    if (anmFrame && this.assets.eff01) {
      const img = this.assets.eff01;
      ctx.save();
      ctx.beginPath();
      ctx.rect(PLAYFIELD.x, PLAYFIELD.y, PLAYFIELD.width, PLAYFIELD.height);
      ctx.clip();
      if (anmFrame.w > img.width || anmFrame.h > img.height) {
        const pattern = ctx.createPattern(img, 'repeat');
        if (pattern) {
          const ox = ((-t * 0.38) % img.width) - img.width;
          const oy = ((t * 0.18) % img.height) - img.height;
          ctx.globalAlpha = 0.72 * ((anmFrame.alpha ?? 255) / 255);
          ctx.globalCompositeOperation = 'source-over';
          ctx.translate(PLAYFIELD.x + ox, PLAYFIELD.y + oy);
          ctx.fillStyle = pattern;
          ctx.fillRect(0, 0, PLAYFIELD.width + img.width * 2, PLAYFIELD.height + img.height * 2);
        }
      } else {
        this.drawAnmFrame('eff01', anmFrame, PLAYFIELD.x, PLAYFIELD.y, { alpha: 0.72, blend: 'source-over' });
      }
      ctx.restore();
      return;
    }
  }
  stageStd(std) {
    const ctx = this.ctx;
    const cam = std.camera(this.game.stageFrame);
    ctx.save();
    ctx.beginPath();
    ctx.rect(PLAYFIELD.x, PLAYFIELD.y, PLAYFIELD.width, PLAYFIELD.height);
    ctx.clip();
    for (let zLevel = 0; zLevel < 4; zLevel++) {
      for (const inst of std.instances) {
        const obj = std.objects[inst.id];
        if (!obj || obj.zLevel !== zLevel) continue;
        for (const q of obj.quads) {
          const rect = std.anm.scriptSprite(q.script, 0, this.game.stageFrame, { keepExitSprite: true });
          if (!rect) continue;
          const wx = obj.x + inst.x + q.x - cam.x;
          const wy = obj.y + inst.y + q.y - cam.y;
          const wz = obj.z + inst.z + q.z - cam.z;
          const p = std.project(wx, wy, wz, PLAYFIELD);
          const rawW = q.w || rect.w * Math.abs(rect.scaleX || 1);
          const rawH = q.h || rect.h * Math.abs(rect.scaleY || 1);
          const w = rawW * p.scale;
          const h = rawH * p.scale;
          const anchorX = rect.anchorTopLeft ? 0 : w / 2;
          const anchorY = rect.anchorTopLeft ? 0 : h / 2;
          if (p.x + w - anchorX < PLAYFIELD.x - 32 || p.x - anchorX > PLAYFIELD.right + 32 || p.y + h - anchorY < PLAYFIELD.y - 32 || p.y - anchorY > PLAYFIELD.bottom + 32) continue;
          ctx.save();
          ctx.globalAlpha = (rect.alpha ?? 255) / 255;
          ctx.globalCompositeOperation = rect.blendAdd ? 'lighter' : 'source-over';
          ctx.translate(p.x, p.y);
          ctx.rotate(rect.rotation || 0);
          if (rect.flipX) ctx.scale(-1, 1);
          if (rect.flipY) ctx.scale(1, -1);
          ctx.drawImage(this.assets.stageBg, rect.x, rect.y, rect.w, rect.h, -anchorX, -anchorY, w, h);
          ctx.restore();
        }
      }
    }
    ctx.restore();
  }
  entities() {
    const g = this.game;
    this.ctx.save();
    this.ctx.beginPath();
    this.ctx.rect(PLAYFIELD.x, PLAYFIELD.y, PLAYFIELD.width, PLAYFIELD.height);
    this.ctx.clip();
    for (const item of g.items) this.itemSprite(item);
    for (const e of g.enemies) this.enemySprite(e);
    for (const effect of g.effects) this.effectSprite(effect);
    for (const b of g.playerBullets) this.playerBullet(b);
    for (const l of g.enemyLasers) this.enemyLaser(l);
    for (const b of g.enemyBullets) this.enemyBullet(PLAYFIELD.x + b.x, PLAYFIELD.y + b.y, b);
    for (const bomb of g.activeBombs) this.bombEffect(bomb);
    const spec = g.spec();
    if (g.player.state !== 'dead') {
      const orbs = g.orbs();
      if (orbs) {
        this.optionOrb(spec, PLAYFIELD.x + orbs.left.x, PLAYFIELD.y + orbs.left.y, 0);
        this.optionOrb(spec, PLAYFIELD.x + orbs.right.x, PLAYFIELD.y + orbs.right.y, 1);
      }
      let alpha = g.player.state === 'invuln' && g.stageFrame % 8 < 4 ? 0.35 : 1;
      let scaleX = 1;
      let scaleY = 1;
      if (g.player.state === 'spawning') {
        const t = clamp(g.player.spawnFrame / PLAYER_SPAWN_ANIM_FRAMES, 0, 1);
        alpha = t;
        scaleX = Math.max(0.001, t);
        scaleY = 1 + 2 * (1 - t);
      }
      this.playerSprite(spec, PLAYFIELD.x + g.player.x, PLAYFIELD.y + g.player.y, scaleX, alpha, g.stageFrame, scaleY);
      if (g.player.state === 'deathbomb') this.deathbombMarker(PLAYFIELD.x + g.player.x, PLAYFIELD.y + g.player.y);
      if (g.player.focus && (g.player.state === 'alive' || g.player.state === 'invuln')) this.hitPoint(PLAYFIELD.x + g.player.x, PLAYFIELD.y + g.player.y);
    }
    if (g.flash > 0) this.rect(PLAYFIELD.x, PLAYFIELD.y, PLAYFIELD.width, PLAYFIELD.height, '#fff', g.flash / 90);
    for (const t of g.texts) {
      this.ctx.globalAlpha = Math.max(0, 1 - t.age / t.life);
      this.fillText(t.text, PLAYFIELD.x + t.x - t.text.length * 4, PLAYFIELD.y + t.y, 14, t.color);
      this.ctx.globalAlpha = 1;
    }
    this.ctx.restore();
  }
  itemSprite(item) {
    const f = ITEM_FRAMES[item.type];
    if (!f) throw new Error(`Unknown TH06 item type: ${item.type}`);
    this.sheetSprite('etama3', f.x, f.y, 16, 16, PLAYFIELD.x + item.x, PLAYFIELD.y + item.y, 18, 18, 8, 8);
  }
  enemySprite(e) {
    const x = PLAYFIELD.x + e.x;
    const y = PLAYFIELD.y + e.y;
    if (e.ecl) {
      const rect = this.game.stageRuntime.enemyRect(e);
      if (rect) {
        const sheet = e.ecl.currentAnm >= 128 ? 'stg1enm2' : 'stg1enm';
        const scale = e.ecl.isBoss ? 1.08 : 1;
        this.sheetSprite(sheet, rect.x, rect.y, rect.w, rect.h, x, y, rect.w * scale, rect.h * scale, rect.w / 2, rect.h / 2);
        return;
      }
    }
  }
  optionOrb(spec, x, y, side) {
    const anm = this.game.stageRuntime.playerAnm[spec.family === 'reimu' ? 0 : 1];
    const rect = anm?.scriptSprite(side ? 129 : 128, 0, this.game.stageFrame);
    if (rect) {
      this.sheetSprite(spec.sheet, rect.x, rect.y, rect.w, rect.h, x, y, rect.w, rect.h, rect.w / 2, rect.h / 2);
    }
  }
  playerBullet(b) {
    const x = PLAYFIELD.x + b.x;
    const y = PLAYFIELD.y + b.y;
    const baseAngle = b.baseAngle ?? Math.atan2(b.vy, b.vx);
    const rotation = b.rect ? (b.autoRotate ? Math.PI / 2 - normalizeLocalAngle(baseAngle + Math.PI) : 0) : Math.atan2(b.vy, b.vx) - Math.PI / 2;
    if (b.bulletType === BULLET_TYPE_LASER) {
      this.playerLaser(b);
      return;
    }
    if (b.rect) {
      this.rotatedSheetSprite(b.sheet || 'player00', b.rect.x, b.rect.y, b.rect.w, b.rect.h, x, y, b.rect.w, b.rect.h, rotation);
    }
  }
  playerLaser(b) {
    const x = PLAYFIELD.x + b.x;
    const y = PLAYFIELD.y + b.y;
    const anm = this.game.stageRuntime.playerAnm[1];
    const timer = this.game.player.laserTimers[b.laserSlot] || 0;
    const interrupt = timer === 70 || timer === 1 ? { interrupt: 1 } : {};
    const frame = anm.scriptFrame(b.script, 0, b.age || 0, interrupt);
    if (!frame) return;
    this.drawAnmFrame('player01', frame, x, y, {
      rotation: b.baseAngle + Math.PI / 2,
      scaleY: Math.max(0.01, (b.sy || 1) / Math.max(1, frame.h))
    });
  }
  enemyBullet(x, y, b) {
    if (!b.rect) return;
    const rotation = b.rect.autoRotate ? b.angle - Math.PI / 2 : 0;
    this.drawAnmFrame(b.rect.imageKey || 'etama3', b.rect, x, y, { rotation });
  }
  enemyLaser(l) {
    if (!l.inUse) return;
    const length = Math.max(0, l.endOffset - l.startOffset);
    if (length <= 0) return;
    const color = LASER_COLORS[((l.color % LASER_COLORS.length) + LASER_COLORS.length) % LASER_COLORS.length] || '#ffffff';
    const center = l.startOffset + length / 2;
    const x = PLAYFIELD.x + l.x + Math.cos(l.angle) * center;
    const y = PLAYFIELD.y + l.y + Math.sin(l.angle) * center;
    const width = Math.max(1, l.visualWidth || (l.state === 0 ? 1.2 : l.width));
    const alpha = l.state === 0 ? Math.max(0.28, l.alpha ?? 0.55) : Math.max(0, l.alpha ?? 1);
    const ctx = this.ctx;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = alpha;
    ctx.translate(x, y);
    ctx.rotate(l.angle);
    ctx.lineCap = 'round';
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(-length / 2, 0);
    ctx.lineTo(length / 2, 0);
    ctx.stroke();
    ctx.globalAlpha = alpha * (l.state === 0 ? 0.7 : 0.95);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = Math.max(1, width * (l.state === 0 ? 0.32 : 0.42));
    ctx.beginPath();
    ctx.moveTo(-length / 2, 0);
    ctx.lineTo(length / 2, 0);
    ctx.stroke();
    ctx.restore();
  }
  effectSprite(effect) {
    const x = PLAYFIELD.x + effect.x;
    const y = PLAYFIELD.y + effect.y;
    const t = effect.age / Math.max(1, effect.life);
    if (effect.type === 'anmEffect') {
      const frame = this.game.stageRuntime?.effectFrame?.(effect.effectId, effect.age, effect.randomIndex || 0, effect.color);
      if (frame && this.drawAnmFrame(frame.imageKey, frame, x, y, { color: effect.color, alpha: Math.max(0, 1 - Math.max(0, t - 0.92) / 0.08) })) return;
    }
  }
  bombEffect(bomb) {
    this.bombDarken(bomb);
    if (bomb.type === 'reimuA') this.dreamSealEffect(bomb);
    else if (bomb.type === 'reimuB') this.reimuBEffect(bomb);
    else if (bomb.type === 'marisaA') this.marisaAEffect(bomb);
    else if (bomb.type === 'marisaB') this.masterSparkEffect(bomb);
  }
  bombDarken(bomb) {
    const ramp = Math.min(1, bomb.frame / 60, (bomb.duration - bomb.frame) / 60);
    this.rect(PLAYFIELD.x, PLAYFIELD.y, PLAYFIELD.width, PLAYFIELD.height, '#000000', Math.max(0, ramp) * 176 / 255);
  }
  dreamSealEffect(bomb) {
    const seals = bomb.type === 'reimuA'
      ? bomb.projectiles.filter((p) => p.state).map((p, i) => ({ ...p, angle: i * TAU / 8, exploding: p.state === 2 }))
      : bomb.seals;
    const anm = this.game.stageRuntime?.playerAnm?.[0];
    if (!anm) return;
    for (const seal of seals) {
      for (let i = 0; i < 4; i++) {
        const scriptId = ANM_SCRIPT_PLAYER_REIMU_A_BOMB_ARRAY + i;
        if (!this.hasAnmScript(anm, scriptId)) continue;
        const frame = anm.scriptFrame(scriptId, 0, seal.age || bomb.frame, seal.exploding ? { interrupt: 1, interruptFrame: seal.stateFrame || 0 } : {});
        this.drawAnmFrame('player00', frame, PLAYFIELD.x + seal.x, PLAYFIELD.y + seal.y);
      }
    }
  }
  reimuBEffect(bomb) {
    const anm = this.game.stageRuntime?.playerAnm?.[0];
    if (!anm) return;
    for (let i = 0; i < bomb.beams.length; i++) {
      const beam = bomb.beams[i];
      const scriptId = ANM_SCRIPT_PLAYER_REIMU_B_BOMB_ARRAY + i;
      if (!this.hasAnmScript(anm, scriptId)) continue;
      const frame = anm.scriptFrame(scriptId, 0, bomb.frame);
      this.drawAnmFrame('player00', frame, PLAYFIELD.x + beam.x, PLAYFIELD.y + beam.y);
    }
  }
  marisaAEffect(bomb) {
    const anm = this.game.stageRuntime?.playerAnm?.[1];
    if (!anm) return;
    for (let i = 0; i < bomb.stars.length; i++) {
      const star = bomb.stars[i];
      const scriptId = ANM_SCRIPT_PLAYER_MARISA_A_BLUE_STAR + (i % 3);
      if (!this.hasAnmScript(anm, scriptId)) continue;
      const frame = anm.scriptFrame(scriptId, 0, bomb.frame);
      if (!frame) continue;
      this.drawAnmFrame('player01', frame, PLAYFIELD.x + star.x, PLAYFIELD.y + star.y, { scaleMultiplier: 3.2 });
      this.drawAnmFrame('player01', frame, PLAYFIELD.x + star.x - star.vx * 6 - 32, PLAYFIELD.y + star.y - star.vy * 6 - 32, { scaleMultiplier: 2.2 });
      this.drawAnmFrame('player01', frame, PLAYFIELD.x + star.x - star.vx * 10, PLAYFIELD.y + star.y - star.vy * 10, { scaleMultiplier: 1 });
    }
  }
  masterSparkEffect(bomb) {
    const anm = this.game.stageRuntime?.playerAnm?.[1];
    if (!anm) return;
    for (let i = 0; i < 4; i++) {
      const scriptId = ANM_SCRIPT_PLAYER_MARISA_B_MASTER_SPARK + i;
      if (!this.hasAnmScript(anm, scriptId)) continue;
      const frame = anm.scriptFrame(scriptId, 0, bomb.frame);
      if (!frame) continue;
      const spriteAngle = (((Math.PI / 5) * i) / 3 - Math.PI) + ((2 * Math.PI) / 5);
      const scaleY = Math.abs(frame.scaleY || 1);
      const px = this.game.player.x + Math.cos(spriteAngle) * frame.h * scaleY / 2;
      const py = this.game.player.y + Math.sin(spriteAngle) * frame.h * scaleY / 2;
      const rotation = normalizeLocalAngle((Math.PI / 2) - spriteAngle + Math.PI);
      this.drawAnmFrame('player01', frame, PLAYFIELD.x + px, PLAYFIELD.y + py, { rotation });
    }
  }
  deathbombMarker(x, y) {
    const p = this.game.player;
    const left = Math.max(0, p.deathbombTimer || 0) / PLAYER_DEATHBOMB_WINDOW_FRAMES;
    const pulse = 1 + Math.sin((p.deathbombFrame || 0) * 1.7) * 0.08;
    this.ctx.save();
    this.ctx.globalCompositeOperation = 'lighter';
    this.ctx.globalAlpha = 0.72;
    this.ctx.strokeStyle = '#fff0a8';
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();
    this.ctx.arc(x, y, 18 * pulse, -Math.PI / 2, -Math.PI / 2 + TAU * left);
    this.ctx.stroke();
    this.ctx.globalAlpha = 0.32;
    this.ctx.strokeStyle = '#ff4b67';
    this.ctx.beginPath();
    this.ctx.arc(x, y, 24 * pulse, 0, TAU);
    this.ctx.stroke();
    this.ctx.restore();
  }
  hitPoint(x, y) {
    const ctx = this.ctx;
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.globalCompositeOperation = 'source-over';
    ctx.translate(x, y);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.58)';
    ctx.beginPath();
    ctx.arc(0, 0, 6.5, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 0.9;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.25;
    ctx.beginPath();
    ctx.arc(0, 0, 4.5, 0, TAU);
    ctx.stroke();
    ctx.globalAlpha = 0.78;
    ctx.strokeStyle = '#ff8aa4';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(0, 0, 3, 0, TAU);
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#ff1f4b';
    ctx.fillRect(-PLAYER_HITBOX_HALF.x, -PLAYER_HITBOX_HALF.y, PLAYER_HITBOX_HALF.x * 2, PLAYER_HITBOX_HALF.y * 2);
    ctx.restore();
  }
  hud() {
    const g = this.game;
    const x = 448;
    this.rect(416, 0, 224, 480, '#0b111d', 0.96);
    this.ctx.save();
    this.ctx.globalAlpha = 0.22;
    this.ctx.strokeStyle = '#263247';
    for (let yy = 0; yy < 480; yy += 5) {
      this.ctx.beginPath();
      this.ctx.moveTo(416, yy);
      this.ctx.lineTo(640, yy + 24);
      this.ctx.stroke();
    }
    this.ctx.restore();
    this.fillText('HiScore', x, 34, 13, '#fff');
    this.fillText(String(Math.max(g.hiScore || 0, g.score || 0)).padStart(10, '0'), x + 78, 34, 13, '#fff');
    this.fillText('Score', x, 54, 13, '#fff');
    this.fillText(String(g.score).padStart(10, '0'), x + 78, 54, 13, '#fff');
    this.fillText('Player', x, 96, 14, '#fff');
    for (let i = 0; i < g.lives; i++) this.hudStar('player', x + 82 + i * 16, 101);
    this.fillText('Bomb', x, 126, 14, '#fff');
    for (let i = 0; i < g.bombs; i++) this.hudStar('bomb', x + 82 + i * 16, 131);
    this.fillText('Power', x, 168, 14, '#fff');
    if (g.power >= 128) this.fillText('MAX', x + 78, 167, 16, '#ff335f');
    else {
      this.rect(x + 78, 172, 96, 10, '#d9dde8', 1);
      this.rect(x + 78, 172, 96 * g.power / 128, 10, '#ff335f');
      this.fillText(String(g.power).padStart(3, ' '), x + 78, 188, 13, '#fff');
    }
    this.fillText('Graze', x, 196, 14, '#fff');
    this.fillText(String(g.graze), x + 78, 196, 14, '#fff');
    this.fillText('点', x, 224, 14, '#78d9ff');
    this.fillText(String(g.pointItemsCollectedInStage || 0), x + 78, 224, 14, '#fff');
    this.fillText(g.difficulty === 'lunatic' ? 'Lunatic' : g.difficulty, x, 286, 14, '#bdd8ff');
    this.fillText(g.bossUi.bossName || g.stageMeta.bossName, x, 316, 14, '#dce3ff');
    this.fillText(this.fpsText || '60.00FPS', x + 38, 448, 14, '#fff');
    this.bossHud();
  }
  bossHud() {
    const ui = this.game.bossUi;
    if (!ui || ui.state === 0) return;
    const alpha = ui.opacity / 255;
    const ctx = this.ctx;
    ctx.save();
    ctx.globalAlpha = alpha;
    this.fillText('Enemy', PLAYFIELD.x + 4, PLAYFIELD.y + 3, 13, '#fff37d');
    this.fillText(String(ui.lives), PLAYFIELD.x + 64, PLAYFIELD.y + 2, 16, '#fff37d');
    this.rect(PLAYFIELD.x + 92, PLAYFIELD.y + 8, 288, 5, '#181824', 0.95);
    this.rect(PLAYFIELD.x + 92, PLAYFIELD.y + 8, 288 * ui.barDisplay, 5, '#3d57ff', 0.9);
    this.fillText(String(Math.min(99, Math.max(0, ui.timerSeconds))).padStart(2, '0'), PLAYFIELD.x + 356, PLAYFIELD.y + 0, 20, ui.timerSeconds < 10 ? '#ff8080' : '#c7b5ff');
    const title = ui.spellName || ui.bossName;
    if (title) this.fillText(title, PLAYFIELD.x + 174 - title.length * 3.4, PLAYFIELD.y + 16, 14, '#dce3ff');
    ctx.restore();
  }
  hudStar(type, x, y) {
    const f = HUD_STARS[type] || HUD_STARS.player;
    this.sheetSprite('front', f.x, f.y, 16, 16, x, y, 16, 16, 8, 8);
  }
  overlay() {
    const g = this.game;
    this.stageIntroOverlay();
    this.itemGetBorderLine();
    if (g.dialogue?.active) this.dialogue(g.dialogue);
    if (g.phase === 'paused') {
      this.rect(PLAYFIELD.x, PLAYFIELD.y, PLAYFIELD.width, PLAYFIELD.height, '#000', 0.52);
      this.fillText('Pause', PLAYFIELD.x + 164, PLAYFIELD.y + 200, 24);
    }
    if (g.phase === 'stageClear' || g.phase === 'gameOver') {
      this.rect(PLAYFIELD.x, PLAYFIELD.y, PLAYFIELD.width, PLAYFIELD.height, '#000', 0.42);
      this.fillText(g.phase === 'stageClear' ? 'Stage Clear' : 'Game Over', PLAYFIELD.x + 122, PLAYFIELD.y + 192, 26, g.phase === 'stageClear' ? '#ffe6a8' : '#ff6b84');
    }
    if (g.banner > 0) {
      const name = g.bossUi?.spellName || '';
      if (name) {
        this.ctx.globalAlpha = Math.min(1, g.banner / 60);
        this.fillText(name, PLAYFIELD.x + 40, PLAYFIELD.y + 76, 18, '#dce3ff');
        this.ctx.globalAlpha = 1;
      }
    }
    if (g.bgmBanner > 0 && g.bgmLabel) {
      this.ctx.globalAlpha = Math.min(1, g.bgmBanner / 50);
      this.fillText(`BGM ${g.bgmLabel}`, PLAYFIELD.x + 18, PLAYFIELD.y + 398, 13, '#bff8ff');
      this.ctx.globalAlpha = 1;
    }
  }
  stageIntroOverlay() {
    const g = this.game;
    if (g.phase !== 'playing' || g.stageIntro <= 0) return;
    const ctx = this.ctx;
    const title = g.stageMeta.title || {};
    const total = g.stageIntroTotalFrames();
    const elapsed = total - g.stageIntro;
    const primary = title.primary || `STAGE ${g.stageMeta.stageNumber}`;
    const japanese = title.japanese || '';
    const english = title.english || '';
    const fadeIn = Math.min(1, elapsed / 40);
    const fadeOut = Math.min(1, g.stageIntro / 50);
    const alpha = Math.min(fadeIn, fadeOut);
    const centerX = PLAYFIELD.x + PLAYFIELD.width / 2;
    ctx.save();
    ctx.globalAlpha = alpha;
    this.fillText(primary, centerX, PLAYFIELD.y + 126, 24, '#ffffff', 'center');
    if (japanese) this.fillText(japanese, centerX, PLAYFIELD.y + 158, 20, '#ffd7df', 'center');
    if (english) this.fillText(english, centerX, PLAYFIELD.y + 184, 16, '#cfe7ff', 'center');
    ctx.restore();
  }
  itemGetBorderLine() {
    const g = this.game;
    const line = g.stageMeta.presentation.itemBorderLine;
    if (g.phase !== 'playing' || g.stageIntro <= 0 || !line) return;
    const total = g.stageIntroTotalFrames();
    const elapsed = total - g.stageIntro;
    if (elapsed < line.start || elapsed > line.end) return;
    const ctx = this.ctx;
    const y = PLAYFIELD.y + ITEM_GET_BORDER_Y;
    const alpha = Math.min(0.9, (elapsed - line.start) / 16, (line.end - elapsed) / 20);
    if (alpha <= 0) return;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = '#ffe78a';
    ctx.lineWidth = 1;
    ctx.setLineDash([8, 4]);
    ctx.beginPath();
    ctx.moveTo(PLAYFIELD.x, y);
    ctx.lineTo(PLAYFIELD.right, y);
    ctx.stroke();
    ctx.setLineDash([]);
    this.fillText('Item Get Border Line', PLAYFIELD.x + PLAYFIELD.width / 2, y - 6, 12, '#fff3a6', 'center');
    ctx.restore();
  }
  dialogue(d) {
    const ctx = this.ctx;
    ctx.save();
    ctx.beginPath();
    ctx.rect(PLAYFIELD.x, PLAYFIELD.y, PLAYFIELD.width, PLAYFIELD.height);
    ctx.clip();
    if (d.portraitActive[0]) this.dialoguePortrait(0, d.portraits[0], PLAYFIELD.x + 80, PLAYFIELD.y + 252, false);
    if (d.portraitActive[1]) this.dialoguePortrait(1, d.portraits[1], PLAYFIELD.x + PLAYFIELD.width - 80, PLAYFIELD.y + 252, true);
    const boxH = Math.min(48, d.timer * 48 / 60);
    const x = PLAYFIELD.x + (PLAYFIELD.width - 288) / 2;
    const y = PLAYFIELD.y + 384;
    const grad = ctx.createLinearGradient(0, y, 0, y + boxH);
    grad.addColorStop(0, 'rgba(0,0,0,0.82)');
    grad.addColorStop(1, 'rgba(0,0,0,0.58)');
    ctx.fillStyle = grad;
    ctx.fillRect(x - 16, y, 320, boxH);
    ctx.strokeStyle = 'rgba(255,255,255,0.32)';
    ctx.strokeRect(x - 16, y, 320, boxH);
    if (boxH >= 44) {
      this.fillText(d.lines[0] || '', x, y + 8, 14, d.colors[0] ? '#ffc8df' : '#fff');
      this.fillText(d.lines[1] || '', x, y + 27, 14, d.colors[1] ? '#ffc8df' : '#fff');
      if (d.intro[0] || d.intro[1]) {
        this.fillText(d.intro[0] || '', PLAYFIELD.x + 132, PLAYFIELD.y + 72, 15, '#ffd7df');
        this.fillText(d.intro[1] || '', PLAYFIELD.x + 132, PLAYFIELD.y + 92, 15, '#ffd7df');
      }
    }
    ctx.restore();
  }
  dialoguePortrait(side, script, x, y, flip) {
    const family = this.game.spec().family;
    const playerFaces = family === 'marisa' ? ['face01a', 'face01a', 'face01b', 'face01b', 'face01c', 'face01c'] : ['face00a', 'face00a', 'face00b', 'face00b', 'face00c', 'face00c'];
    const bossFaces = ['face03a', 'face03a', 'face03b', 'face03b'];
    const key = side === 0 ? playerFaces[script] || playerFaces[0] : bossFaces[script] || bossFaces[0];
    const sx = script % 2 ? 128 : 0;
    const ctx = this.ctx;
    ctx.save();
    ctx.globalAlpha = 0.86;
    ctx.translate(x, y);
    if (flip) ctx.scale(-1, 1);
    ctx.drawImage(this.assets[key], sx, 0, 128, 256, -64, -128, 128, 256);
    ctx.restore();
  }
}

async function loadImages() {
  const out = {};
  await Promise.all(Object.entries(images).map(([key, src]) => new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      out[key] = image;
      resolve();
    };
    image.onerror = reject;
    image.src = src;
  })));
  return out;
}

async function main() {
  const host = document.querySelector('#app');
  const canvas = document.createElement('canvas');
  canvas.width = GAME_WIDTH;
  canvas.height = GAME_HEIGHT;
  host.appendChild(canvas);
  const assets = await loadImages();
  const input = new Input();
  const game = new Game();
  const audio = new AudioBus();
  game.audio = audio;
  const renderer = new Renderer(canvas, assets, game);
  let last = performance.now();
  let acc = 0;
  let fpsFrames = 0;
  let fpsStamp = last;
  const tick = (now) => {
    acc += Math.min(250, now - last);
    last = now;
    while (acc >= STEP_MS) {
      game.update(input.frame());
      audio.sync(game.track);
      acc -= STEP_MS;
    }
    fpsFrames++;
    if (now - fpsStamp >= 500) {
      renderer.fpsText = `${(fpsFrames * 1000 / (now - fpsStamp)).toFixed(2)}FPS`;
      fpsFrames = 0;
      fpsStamp = now;
    }
    renderer.draw();
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

if (typeof document !== 'undefined') {
  main().catch((error) => {
    document.body.textContent = String(error?.stack || error);
  });
}
