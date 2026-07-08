import { BinaryView } from './bin';
import { normalizeAngle } from '../core/util';
import type { Rng } from '../core/rng';

// TH07 ANM (version 2) parser and script runner.
//
// Entry header layout: anm_header06_t (64 bytes) — see thtk/extlib/thtypes.
// Sprite/script tables hold offsets relative to the entry start. Script
// instructions use the "new" encoding: {u16 type, u16 length (total incl.
// 8-byte header), i16 time, u16 paramMask, args...}.
// Opcode semantics follow the original game; cross-referenced with PyTouhou's
// anmrunner (v2 decorators) and thtk's formats_v2 signature table.

export interface AnmSprite {
  id: number;
  x: number;
  y: number;
  w: number;
  h: number;
  imageKey: string;
}

export interface AnmEntry {
  name: string;
  imageKey: string | null;
  width: number;
  height: number;
  format: number;
  spriteIds: number[];
  scriptIds: number[];
}

interface ScriptRef {
  id: number;
  start: number; // absolute file offset of the first instruction
  imageKey: string | null;
}

function imageKeyFromName(name: string): string | null {
  if (!name || name.startsWith('@')) return null;
  const base = name.split('/').pop() ?? name;
  return base.replace(/\.(png|jpg)$/i, '');
}

export class Anm {
  readonly view: BinaryView;
  readonly name: string;
  readonly entries: AnmEntry[] = [];
  readonly sprites = new Map<number, AnmSprite>();
  private scriptRefs = new Map<number, ScriptRef>();
  // Per-entry script tables, parallel to `entries` (index-matched). Some ANM
  // files (title01.anm is the prominent case: it bundles the title logo, the
  // 8 main-menu items, and several sub-screens' captions into one file) have
  // multiple entries that each independently reuse small/overlapping on-disk
  // script ids (id 0 alone appears in 5 different entries there) — the flat
  // `scriptRefs` map above silently lets the last-parsed entry win those ids,
  // shadowing every earlier entry's same-numbered script. `scriptRefInEntry`
  // below disambiguates by entry index for callers that need it (kept
  // additive/opt-in so every existing caller of scriptRef/hasScript, which
  // assume a single flat id space, is unaffected).
  private entryScripts: Map<number, ScriptRef>[] = [];

  constructor(source: string | Uint8Array, name = 'anm') {
    this.view = new BinaryView(source);
    this.name = name;
    this.parse();
  }

  private parse(): void {
    const v = this.view;
    let entryStart = 0;
    // Scripts reference sprites by a global id: each entry's embedded sprite
    // ids (which may be sparse, e.g. player00's 0-17/64-70/128-133) are
    // offset by a base that advances by (max embedded id + 1) per entry.
    let entryBase = 0;
    for (let guard = 0; guard < 64; guard++) {
      const spriteCount = v.u32(entryStart + 0);
      const scriptCount = v.u32(entryStart + 4);
      const width = v.u32(entryStart + 12);
      const height = v.u32(entryStart + 16);
      const format = v.u32(entryStart + 20);
      const nameOffset = v.u32(entryStart + 28);
      const version = v.u32(entryStart + 40);
      const nextOffset = v.u32(entryStart + 56);
      if (version !== 2) throw new Error(`${this.name}: ANM entry version ${version}, expected 2`);
      const name = v.cstring(entryStart + nameOffset);
      const imageKey = imageKeyFromName(name);
      const entry: AnmEntry = { name, imageKey, width, height, format, spriteIds: [], scriptIds: [] };

      let ptr = entryStart + 64;
      let maxEmbedded = -1;
      for (let i = 0; i < spriteCount; i++) {
        const off = entryStart + v.u32(ptr + i * 4);
        const embedded = v.u32(off);
        maxEmbedded = Math.max(maxEmbedded, embedded);
        const id = entryBase + embedded;
        const sprite: AnmSprite = {
          id,
          x: v.f32(off + 4),
          y: v.f32(off + 8),
          w: v.f32(off + 12),
          h: v.f32(off + 16),
          imageKey: imageKey ?? ''
        };
        this.sprites.set(id, sprite);
        entry.spriteIds.push(id);
      }
      entryBase += maxEmbedded + 1;
      ptr += spriteCount * 4;
      const entryScriptMap = new Map<number, ScriptRef>();
      for (let i = 0; i < scriptCount; i++) {
        const id = v.i32(ptr + i * 8);
        const start = entryStart + v.u32(ptr + i * 8 + 4);
        const ref: ScriptRef = { id, start, imageKey };
        this.scriptRefs.set(id, ref);
        entryScriptMap.set(id, ref);
        entry.scriptIds.push(id);
      }
      this.entryScripts.push(entryScriptMap);
      this.entries.push(entry);
      if (!nextOffset) break;
      entryStart += nextOffset;
    }
  }

  hasScript(id: number): boolean {
    return this.scriptRefs.has(id);
  }

  scriptRef(id: number): ScriptRef {
    const ref = this.scriptRefs.get(id);
    if (!ref) throw new Error(`${this.name}: missing ANM script ${id}`);
    return ref;
  }

  // Entry-scoped variants of hasScript/scriptRef — see the `entryScripts`
  // comment above. `entryIndex` matches the position of the entry in
  // `this.entries` (0-based, file order).
  hasScriptInEntry(entryIndex: number, id: number): boolean {
    return this.entryScripts[entryIndex]?.has(id) ?? false;
  }

  scriptRefInEntry(entryIndex: number, id: number): ScriptRef {
    const ref = this.entryScripts[entryIndex]?.get(id);
    if (!ref) throw new Error(`${this.name}: missing ANM script ${id} in entry ${entryIndex}`);
    return ref;
  }

  get scriptIds(): number[] {
    return [...this.scriptRefs.keys()];
  }
}

type Interp = {
  start: number;
  duration: number;
  formula: number;
  from: number[];
  to: number[];
};

// Exported for reuse by other script interpreters that share this easing
// table (e.g. formats/std.ts's camera/facing keyframe interpolation).
export function applyFormula(t: number, formula: number): number {
  switch (formula) {
    case 1: return t * t;
    case 2: return t * t * t;
    case 3: return t * t * t * t;
    case 4: return 2 * t - t * t;
    case 5: return 2 * t - t * t * t;
    case 6: return 2 * t - t * t * t * t;
    default: return t;
  }
}

function interpValue(interp: Interp, frame: number, index: number): number {
  const raw = interp.duration > 0 ? (frame - interp.start) / interp.duration : 1;
  const t = applyFormula(Math.min(1, Math.max(0, raw)), interp.formula);
  return interp.from[index] + (interp.to[index] - interp.from[index]) * t;
}

// Drawable state produced each frame; consumed by Renderer.drawAnmFrame.
export interface AnmFrame {
  x: number;
  y: number;
  w: number;
  h: number;
  imageKey: string;
  scaleX: number;
  scaleY: number;
  rotation: number;
  color: number;
  alpha: number;
  blendAdd: boolean;
  anchorTopLeft: boolean;
  autoRotate: boolean;
  vmX: number;
  vmY: number;
  posOffsetX: number;
  posOffsetY: number;
  flipX: boolean;
  flipY: boolean;
}

const ANM_VAR_BASE = 10000;
const ANM_VAR_COUNT = 12;

export interface AnmRunnerOptions {
  spriteIndexOffset?: number;
  rng?: Rng;
  color?: number;
  // Disambiguates `scriptId` when the ANM file has multiple entries that
  // reuse overlapping on-disk ids (see Anm.scriptRefInEntry). Index matches
  // Anm.entries (0-based, file order). Omit for the plain flat lookup used
  // by every other (single-entry, or non-colliding) caller.
  entryIndex?: number;
}

export class AnmRunner {
  private anm: Anm;
  private scriptStart: number;
  private ip: number;
  private imageKey: string | null;
  readonly scriptId: number;

  frame = 0;
  waiting = false;
  private waitTimeout = -1;
  removed = false;
  stopped = false;
  visible = false;
  private spriteIndexOffset: number;
  private rng: Rng | undefined;
  private vars = new Array<number>(ANM_VAR_COUNT).fill(0);

  private rect: AnmSprite | null = null;
  private x = 0;
  private y = 0;
  private offX = 0;
  private offY = 0;
  private useOffset = false;
  private scaleX = 1;
  private scaleY = 1;
  private scaleSpeedX = 0;
  private scaleSpeedY = 0;
  private rotX = 0;
  private rotY = 0;
  private rotZ = 0;
  private rotSpeedX = 0;
  private rotSpeedY = 0;
  private rotSpeedZ = 0;
  private alpha = 255;
  private colorRgb = 0xffffff;
  private blendAdd = false;
  private mirrored = false;
  private flipY = false;
  private cornerRelative = false;
  private autoOrient = false;
  private fadeInterp: Interp | null = null;
  private moveInterp: Interp | null = null;
  private scaleInterp: Interp | null = null;
  private rotInterp: Interp | null = null;
  private colorInterp: Interp | null = null;

  constructor(anm: Anm, scriptId: number, options: AnmRunnerOptions = {}) {
    this.anm = anm;
    this.scriptId = scriptId;
    const ref = options.entryIndex != null ? anm.scriptRefInEntry(options.entryIndex, scriptId) : anm.scriptRef(scriptId);
    this.scriptStart = ref.start;
    this.imageKey = ref.imageKey;
    this.ip = ref.start;
    this.spriteIndexOffset = options.spriteIndexOffset ?? 0;
    this.rng = options.rng;
    if (options.color != null) {
      this.alpha = (options.color >>> 24) & 0xff;
      this.colorRgb = options.color & 0xffffff;
    }
    this.runFrame(); // execute time-0 instructions immediately
  }

  private getVal(raw: number): number {
    const idx = Math.round(raw) - ANM_VAR_BASE;
    if (idx >= 0 && idx < ANM_VAR_COUNT) return this.vars[idx];
    return raw;
  }

  private setVal(rawId: number, value: number): void {
    const idx = Math.round(rawId) - ANM_VAR_BASE;
    if (idx >= 0 && idx < ANM_VAR_COUNT) this.vars[idx] = value;
  }

  interrupt(label: number): boolean {
    const v = this.anm.view;
    let off = this.scriptStart;
    for (let guard = 0; guard < 512 && off + 8 <= v.length; guard++) {
      const type = v.u16(off);
      const length = v.u16(off + 2);
      if (type === 0xffff || length < 8) break;
      if (type === 21 && v.i32(off + 8) === label) {
        this.ip = off + length;
        this.frame = v.i16(off + 4);
        this.waiting = false;
        this.waitTimeout = -1;
        this.visible = true;
        this.removed = false;
        this.stopped = false;
        return true;
      }
      off += length;
    }
    return false;
  }

  update(): void {
    if (this.removed) return;
    this.runFrame();
    // Per-frame continuous updates.
    this.scaleX += this.scaleSpeedX;
    this.scaleY += this.scaleSpeedY;
    if (this.rotSpeedX) this.rotX = normalizeAngle(this.rotX + this.rotSpeedX);
    if (this.rotSpeedY) this.rotY = normalizeAngle(this.rotY + this.rotSpeedY);
    if (this.rotSpeedZ) this.rotZ = normalizeAngle(this.rotZ + this.rotSpeedZ);
    this.applyInterps();
    this.frame++;
  }

  private applyInterps(): void {
    if (this.fadeInterp) {
      this.alpha = Math.round(interpValue(this.fadeInterp, this.frame, 0)) & 0xff;
      if (this.frame >= this.fadeInterp.start + this.fadeInterp.duration) this.fadeInterp = null;
    }
    if (this.moveInterp) {
      const x = interpValue(this.moveInterp, this.frame, 0);
      const y = interpValue(this.moveInterp, this.frame, 1);
      if (this.useOffset) {
        this.offX = x;
        this.offY = y;
      } else {
        this.x = x;
        this.y = y;
      }
      if (this.frame >= this.moveInterp.start + this.moveInterp.duration) this.moveInterp = null;
    }
    if (this.scaleInterp) {
      this.scaleX = interpValue(this.scaleInterp, this.frame, 0);
      this.scaleY = interpValue(this.scaleInterp, this.frame, 1);
      if (this.frame >= this.scaleInterp.start + this.scaleInterp.duration) this.scaleInterp = null;
    }
    if (this.rotInterp) {
      this.rotX = interpValue(this.rotInterp, this.frame, 0);
      this.rotY = interpValue(this.rotInterp, this.frame, 1);
      this.rotZ = interpValue(this.rotInterp, this.frame, 2);
      if (this.frame >= this.rotInterp.start + this.rotInterp.duration) this.rotInterp = null;
    }
    if (this.colorInterp) {
      const r = Math.round(interpValue(this.colorInterp, this.frame, 0)) & 0xff;
      const g = Math.round(interpValue(this.colorInterp, this.frame, 1)) & 0xff;
      const b = Math.round(interpValue(this.colorInterp, this.frame, 2)) & 0xff;
      this.colorRgb = (r << 16) | (g << 8) | b;
      if (this.frame >= this.colorInterp.start + this.colorInterp.duration) this.colorInterp = null;
    }
  }

  private runFrame(): void {
    if (this.stopped || this.removed) return;
    if (this.waiting) {
      if (this.waitTimeout >= 0 && this.frame >= this.waitTimeout) {
        this.waiting = false;
        this.waitTimeout = -1;
      } else {
        return;
      }
    }
    const v = this.anm.view;
    for (let guard = 0; guard < 512; guard++) {
      if (this.ip + 8 > v.length) {
        this.stopped = true;
        return;
      }
      const type = v.u16(this.ip);
      const length = v.u16(this.ip + 2);
      const time = v.i16(this.ip + 4);
      if (type === 0xffff || length < 8) {
        this.stopped = true;
        return;
      }
      if (time > this.frame) return;
      const a = this.ip + 8;
      this.ip += length;
      this.execute(type, a, time);
      if (this.stopped || this.removed || this.waiting) return;
    }
    throw new Error(`${this.anm.name}: ANM script ${this.scriptId} exceeded instruction guard`);
  }

  private execute(type: number, a: number, time: number): void {
    const v = this.anm.view;
    switch (type) {
      case 0: // noop
        break;
      case 1: // remove
        this.removed = true;
        this.visible = false;
        break;
      case 2: // static: freeze the sprite as-is
        this.stopped = true;
        break;
      case 3: { // set sprite
        const rect = this.anm.sprites.get(v.i32(a) + this.spriteIndexOffset);
        if (!rect) throw new Error(`${this.anm.name}: script ${this.scriptId} references missing sprite ${v.i32(a) + this.spriteIndexOffset}`);
        this.rect = rect;
        this.visible = true;
        break;
      }
      case 4: { // jump(byteOffset, frame)
        this.ip = this.scriptStart + v.i32(a);
        this.frame = v.i32(a + 4);
        break;
      }
      case 5: { // loop jump: decrement var, jump while non-zero
        const varId = v.i32(a);
        const left = this.getVal(varId) - 1;
        this.setVal(varId, left);
        if (left > 0) {
          this.ip = this.scriptStart + v.i32(a + 4);
          this.frame = v.i32(a + 8);
        }
        break;
      }
      case 6: { // position
        const x = this.getVal(v.f32(a));
        const y = this.getVal(v.f32(a + 4));
        if (this.useOffset) {
          this.offX = x;
          this.offY = y;
        } else {
          this.x = x;
          this.y = y;
        }
        break;
      }
      case 7: // scale
        this.scaleX = this.getVal(v.f32(a));
        this.scaleY = this.getVal(v.f32(a + 4));
        this.scaleInterp = null;
        break;
      case 8: // alpha
        this.alpha = v.i32(a) & 0xff;
        this.fadeInterp = null;
        break;
      case 9: { // color, packed bytes b,g,r
        const packed = v.u32(a);
        const b = packed & 0xff;
        const g = (packed >> 8) & 0xff;
        const r = (packed >> 16) & 0xff;
        this.colorRgb = (r << 16) | (g << 8) | b;
        break;
      }
      case 10: // toggle horizontal mirroring
        this.mirrored = !this.mirrored;
        break;
      case 12: // rotation
        this.rotX = v.f32(a);
        this.rotY = v.f32(a + 4);
        this.rotZ = v.f32(a + 8);
        break;
      case 13: // rotation speed
        this.rotSpeedX = v.f32(a);
        this.rotSpeedY = v.f32(a + 4);
        this.rotSpeedZ = v.f32(a + 8);
        break;
      case 14: // scale speed
        this.scaleSpeedX = v.f32(a);
        this.scaleSpeedY = v.f32(a + 4);
        break;
      case 15: // fade to alpha over duration
        this.fadeInterp = { start: time, duration: Math.max(1, v.i32(a + 4)), formula: 0, from: [this.alpha], to: [v.i32(a) & 0xff] };
        break;
      case 16: // blend mode (bit 0 = additive)
        this.blendAdd = (v.i32(a) & 1) !== 0;
        break;
      case 17:
      case 18:
      case 19: { // move linear / decel(2x-x²) / accel(x²)
        const formula = type === 18 ? 4 : type === 19 ? 1 : 0;
        const fromX = this.useOffset ? this.offX : this.x;
        const fromY = this.useOffset ? this.offY : this.y;
        this.moveInterp = {
          start: time,
          duration: Math.max(1, v.i32(a + 12)),
          formula,
          from: [fromX, fromY],
          to: [v.f32(a), v.f32(a + 4)]
        };
        break;
      }
      case 20: // wait for interrupt
        this.waiting = true;
        break;
      case 21: // interrupt label (no-op during linear execution)
        break;
      case 22: // corner-relative placement (anchor top-left)
        this.cornerRelative = true;
        break;
      case 23: // hide and wait for interrupt
        this.visible = false;
        this.waiting = true;
        break;
      case 24: // toggle dest-offset mode
        this.useOffset = !!v.i32(a);
        break;
      case 25: // automatic orientation to motion angle
        this.autoOrient = !!v.i32(a);
        break;
      case 26: // shift texture u — not reproducible with plain Canvas drawImage
      case 27: // shift texture v
        break;
      case 28: // visibility
        this.visible = !!v.i32(a);
        break;
      case 29: // scale over duration (linear)
        this.scaleInterp = { start: time, duration: Math.max(1, v.i32(a + 8)), formula: 0, from: [this.scaleX, this.scaleY], to: [v.f32(a), v.f32(a + 4)] };
        break;
      case 30: // render-state flag (z-buffer related); no effect in Canvas renderer
      case 31: // render-state flag; no effect in Canvas renderer
        break;
      case 32: // move with formula
        this.moveInterp = {
          start: time,
          duration: Math.max(1, v.i32(a)),
          formula: v.i32(a + 4),
          from: [this.useOffset ? this.offX : this.x, this.useOffset ? this.offY : this.y],
          to: [v.f32(a + 8), v.f32(a + 12)]
        };
        break;
      case 33: { // color transition with formula
        const packed = v.u32(a + 8);
        this.colorInterp = {
          start: time,
          duration: Math.max(1, v.i32(a)),
          formula: v.i32(a + 4),
          from: [(this.colorRgb >> 16) & 0xff, (this.colorRgb >> 8) & 0xff, this.colorRgb & 0xff],
          to: [(packed >> 16) & 0xff, (packed >> 8) & 0xff, packed & 0xff]
        };
        break;
      }
      case 34: // fade with formula
        this.fadeInterp = { start: time, duration: Math.max(1, v.i32(a)), formula: v.i32(a + 4), from: [this.alpha], to: [v.i32(a + 8) & 0xff] };
        break;
      case 35: // rotate with formula
        this.rotInterp = {
          start: time,
          duration: Math.max(1, v.i32(a)),
          formula: v.i32(a + 4),
          from: [this.rotX, this.rotY, this.rotZ],
          to: [v.f32(a + 8), v.f32(a + 12), v.f32(a + 16)]
        };
        break;
      case 36: // scale with formula
        this.scaleInterp = {
          start: time,
          duration: Math.max(1, v.i32(a)),
          formula: v.i32(a + 4),
          from: [this.scaleX, this.scaleY],
          to: [v.f32(a + 8), v.f32(a + 12)]
        };
        break;
      case 37: // set int variable
        this.setVal(v.i32(a), this.getVal(v.i32(a + 4)));
        break;
      case 38: // set float variable
        this.setVal(v.f32(a), this.getVal(v.f32(a + 4)));
        break;
      case 42: // decrement variable
        this.setVal(v.f32(a), this.getVal(v.f32(a)) - this.getVal(v.f32(a + 4)));
        break;
      case 50: // add
        this.setVal(v.f32(a), this.getVal(v.f32(a + 4)) + this.getVal(v.f32(a + 8)));
        break;
      case 52: // subtract
        this.setVal(v.f32(a), this.getVal(v.f32(a + 4)) - this.getVal(v.f32(a + 8)));
        break;
      case 55: // integer divide
        this.setVal(v.i32(a), Math.trunc(this.getVal(v.i32(a + 4)) / this.getVal(v.i32(a + 8))));
        break;
      case 59: // random int in [0, amp)
        this.setVal(v.i32(a), this.rng ? this.rng.u32InRange(Math.max(1, v.i32(a + 4))) : 0);
        break;
      case 60: // random float in [0, amp)
        this.setVal(v.f32(a), this.rng ? this.rng.range(v.f32(a + 4)) : 0);
        break;
      case 69: { // branch if variable != value
        if (this.getVal(v.i32(a)) !== this.getVal(v.i32(a + 4))) {
          this.ip = this.scriptStart + v.i32(a + 8);
          this.frame = v.i32(a + 12);
        }
        break;
      }
      case 79: // wait a fixed number of frames
        this.waiting = true;
        this.waitTimeout = this.frame + v.i32(a);
        break;
      default:
        throw new Error(`${this.anm.name}: unhandled ANM v2 opcode ${type} in script ${this.scriptId}`);
    }
  }

  spriteFrame(): AnmFrame | null {
    if (!this.rect || !this.visible || this.removed) return null;
    return {
      x: this.rect.x,
      y: this.rect.y,
      w: this.rect.w,
      h: this.rect.h,
      // Sprites can live in a different texture entry than the script that
      // uses them (etama's four sheets share one script table).
      imageKey: this.rect.imageKey || this.imageKey || '',
      scaleX: this.mirrored ? -this.scaleX : this.scaleX,
      scaleY: this.flipY ? -this.scaleY : this.scaleY,
      rotation: this.rotZ,
      color: (((this.alpha & 0xff) << 24) | this.colorRgb) >>> 0,
      alpha: this.alpha,
      blendAdd: this.blendAdd,
      anchorTopLeft: this.cornerRelative,
      autoRotate: this.autoOrient,
      vmX: this.x,
      vmY: this.y,
      posOffsetX: this.offX,
      posOffsetY: this.offY,
      flipX: false,
      flipY: false
    };
  }
}
