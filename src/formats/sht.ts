import { BinaryView } from './bin';

// TH07 SHT player-data format (one file per character/type/focus-state).
// Layout cross-referenced with PyTouhou's reader and the raw ply*.sht bytes:
// 52-byte header {i16, i16 levelCount, f32 bombs, u32, then 10 floats:
// hitbox, grazebox, autocollectSpeed, itemRadius, cherryLossOnDeath,
// pocLineY, speed, focusedSpeed, diagSpeed, diagFocusedSpeed}, then
// levelCount × {u32 offset, u32 powerThreshold}, each pointing at shooter
// records {u16 interval, u16 delay, 6×f32 (x, y, hitboxW, hitboxH, angle,
// speed), u16 damage, u8 orb, u8 shotType, i16 sprite, i16, 4×u32} until an
// interval/delay sentinel of 0xffff.

export interface ShtShot {
  interval: number;
  delay: number;
  x: number;
  y: number;
  hitboxW: number;
  hitboxH: number;
  angle: number;
  speed: number;
  damage: number;
  orb: number; // 0 = player, 1 = left option, 2 = right option
  shotType: number;
  sprite: number; // ANM script id in the character's playerXX.anm
}

export interface ShtLevel {
  power: number; // inclusive upper power bound for this table
  shots: ShtShot[];
}

export class Sht {
  readonly bombs: number;
  readonly hitbox: number;
  readonly grazebox: number;
  readonly autocollectSpeed: number;
  readonly itemRadius: number;
  readonly cherryLossOnDeath: number;
  readonly pocLineY: number;
  readonly speed: number;
  readonly focusedSpeed: number;
  readonly diagSpeed: number;
  readonly diagFocusedSpeed: number;
  readonly levels: ShtLevel[] = [];

  constructor(source: string | Uint8Array) {
    const v = new BinaryView(source);
    const levelCount = v.i16(2);
    this.bombs = v.f32(4);
    this.hitbox = v.f32(12);
    this.grazebox = v.f32(16);
    this.autocollectSpeed = v.f32(20);
    this.itemRadius = v.f32(24);
    this.cherryLossOnDeath = v.f32(28);
    this.pocLineY = v.f32(32);
    this.speed = v.f32(36);
    this.focusedSpeed = v.f32(40);
    this.diagSpeed = v.f32(44);
    this.diagFocusedSpeed = v.f32(48);
    for (let i = 0; i < levelCount; i++) {
      const offset = v.u32(52 + i * 8);
      const power = v.u32(52 + i * 8 + 4);
      const shots: ShtShot[] = [];
      for (let o = offset; o + 4 <= v.length;) {
        const interval = v.u16(o);
        const delay = v.u16(o + 2);
        if (interval === 0xffff && delay === 0xffff) break;
        shots.push({
          interval,
          delay,
          x: v.f32(o + 4),
          y: v.f32(o + 8),
          hitboxW: v.f32(o + 12),
          hitboxH: v.f32(o + 16),
          angle: v.f32(o + 20),
          speed: v.f32(o + 24),
          damage: v.u16(o + 28),
          orb: v.u8(o + 30),
          shotType: v.u8(o + 31),
          sprite: v.i16(o + 32)
        });
        o += 52;
      }
      this.levels.push({ power, shots });
    }
  }

  // The shooter table active at a given power (0-128).
  shotsForPower(power: number): ShtShot[] {
    for (const level of this.levels) {
      if (power <= level.power) return level.shots;
    }
    return this.levels.length ? this.levels[this.levels.length - 1].shots : [];
  }
}
