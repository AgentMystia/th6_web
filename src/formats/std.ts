import { BinaryView } from './bin';
import { clamp, DEG } from '../core/util';

// TH07 STD stage-background format. Same layout family as TH06:
// header {u16 objectCount, u16 faceCount, u32 faceOffset, u32 scriptOffset,
// u32 zero} + stageName[128] + 4×songName[128] + 4×songPath[128], then the
// object offset table at 0x490. Script ops: 0 camera pos, 1 fog, 2 camera
// facing, 3 facing interp duration, 4 fog interp duration, 5 scroll pause.

export interface StdQuad {
  type: number;
  script: number;
  x: number;
  y: number;
  z: number;
  w: number;
  h: number;
}

export interface StdObject {
  id: number;
  zLevel: number;
  flags: number;
  x: number;
  y: number;
  z: number;
  w: number;
  h: number;
  d: number;
  quads: StdQuad[];
}

export interface StdInstance {
  id: number;
  x: number;
  y: number;
  z: number;
}

interface FogState {
  frame: number;
  r: number;
  g: number;
  b: number;
  near: number;
  far: number;
}

interface FacingState {
  frame: number;
  x: number;
  y: number;
  z: number;
}

const OBJECT_TABLE_OFFSET = 0x490;

export class Std {
  readonly view: BinaryView;
  readonly stageName: string;
  readonly songNames: string[] = [];
  readonly songPaths: string[] = [];
  readonly objects: StdObject[] = [];
  readonly instances: StdInstance[] = [];
  private cameraKeys: { frame: number; x: number; y: number; z: number }[] = [];
  private fogEvents: { frame: number; start: FogState; target: FogState; duration: number }[] = [];
  private facingEvents: { frame: number; start: FacingState; target: FacingState; duration: number }[] = [];
  private pauseFrames = new Set<number>();
  frame = 0;
  private unpauseRequested = false;

  constructor(source: string | Uint8Array) {
    this.view = new BinaryView(source);
    this.stageName = this.view.shiftJis(16, this.cstrEnd(16, 128));
    for (let i = 0; i < 4; i++) {
      const nameOff = 16 + 128 + i * 128;
      const pathOff = 16 + 128 + 4 * 128 + i * 128;
      this.songNames.push(this.view.shiftJis(nameOff, this.cstrEnd(nameOff, 128)));
      this.songPaths.push(this.view.shiftJis(pathOff, this.cstrEnd(pathOff, 128)));
    }
    this.parse();
  }

  private cstrEnd(off: number, max: number): number {
    let end = off;
    while (end < off + max && end < this.view.length && this.view.bytes[end] !== 0) end++;
    return end;
  }

  private parse(): void {
    const v = this.view;
    const objectCount = v.i16(0);
    const faceOffset = v.i32(4);
    const scriptOffset = v.i32(8);
    for (let i = 0; i < objectCount; i++) {
      this.objects.push(this.parseObject(v.i32(OBJECT_TABLE_OFFSET + i * 4)));
    }
    for (let off = faceOffset, guard = 0; off + 16 <= v.length && guard < 4096; off += 16, guard++) {
      const id = v.i16(off);
      if (id < 0) break;
      this.instances.push({ id, x: v.f32(off + 4), y: v.f32(off + 8), z: v.f32(off + 12) });
    }

    const defaultFog: FogState = { frame: 0, r: 16, g: 0, b: 32, near: 200, far: 500 };
    const defaultFacing: FacingState = { frame: 0, x: 0, y: 0, z: 1 };
    this.fogEvents.push({ frame: 0, start: defaultFog, target: defaultFog, duration: 0 });
    this.facingEvents.push({ frame: 0, start: defaultFacing, target: defaultFacing, duration: 0 });
    let currentFog = defaultFog;
    let currentFacing = defaultFacing;
    let pendingFogDuration = 0;
    let pendingFacingDuration = 0;
    for (let off = scriptOffset, guard = 0; off + 20 <= v.length && guard < 512; off += 20, guard++) {
      const frame = v.i32(off);
      const op = v.i16(off + 4);
      if (frame === -1 && op === -1) break;
      const x = v.f32(off + 8);
      const y = v.f32(off + 12);
      const z = v.f32(off + 16);
      const i0 = v.i32(off + 8);
      if (op === 0) {
        this.cameraKeys.push({ frame, x, y, z });
      } else if (op === 1) {
        const color = i0 >>> 0;
        const target: FogState = {
          frame: Math.max(0, frame),
          r: (color >> 16) & 0xff,
          g: (color >> 8) & 0xff,
          b: color & 0xff,
          near: y,
          far: z
        };
        this.fogEvents.push({ frame: Math.max(0, frame), start: currentFog, target, duration: Math.max(0, pendingFogDuration | 0) });
        currentFog = target;
        pendingFogDuration = 0;
      } else if (op === 2) {
        const target: FacingState = { frame: Math.max(0, frame), x, y, z };
        this.facingEvents.push({ frame: Math.max(0, frame), start: currentFacing, target, duration: Math.max(0, pendingFacingDuration | 0) });
        currentFacing = target;
        pendingFacingDuration = 0;
      } else if (op === 3) {
        pendingFacingDuration = Math.max(0, i0 | 0);
      } else if (op === 4) {
        pendingFogDuration = Math.max(0, i0 | 0);
      } else if (op === 5) {
        this.pauseFrames.add(Math.max(0, frame));
      }
    }
    this.cameraKeys.sort((a, b) => a.frame - b.frame);
    this.fogEvents.sort((a, b) => a.frame - b.frame);
    this.facingEvents.sort((a, b) => a.frame - b.frame);
  }

  private parseObject(off: number): StdObject {
    const v = this.view;
    const obj: StdObject = {
      id: v.i16(off),
      zLevel: v.i8(off + 2),
      flags: v.i8(off + 3),
      x: v.f32(off + 4),
      y: v.f32(off + 8),
      z: v.f32(off + 12),
      w: v.f32(off + 16),
      h: v.f32(off + 20),
      d: v.f32(off + 24),
      quads: []
    };
    let q = off + 28;
    for (let guard = 0; q + 28 <= v.length && guard < 256; guard++) {
      const type = v.i16(q);
      if (type < 0) break;
      const size = v.i16(q + 2);
      obj.quads.push({
        type,
        script: v.i16(q + 4),
        x: v.f32(q + 8),
        y: v.f32(q + 12),
        z: v.f32(q + 16),
        w: v.f32(q + 20),
        h: v.f32(q + 24)
      });
      if (size <= 0) break;
      q += size;
    }
    return obj;
  }

  reset(): void {
    this.frame = 0;
    this.unpauseRequested = false;
  }

  unpause(): void {
    this.unpauseRequested = true;
  }

  advance(): void {
    if (this.pauseFrames.has(this.frame) && !this.unpauseRequested) return;
    this.unpauseRequested = false;
    this.frame++;
  }

  camera(frame: number): { x: number; y: number; z: number } {
    let prev = this.cameraKeys[0] ?? { frame: 0, x: 0, y: 0, z: 0 };
    let next: typeof prev | null = null;
    for (const key of this.cameraKeys) {
      if (key.frame >= 0 && key.frame <= frame) prev = key;
      if (key.frame > frame) {
        next = key;
        break;
      }
    }
    if (!next || next.frame <= prev.frame) return prev;
    const t = clamp((frame - prev.frame) / (next.frame - prev.frame), 0, 1);
    return {
      x: prev.x + (next.x - prev.x) * t,
      y: prev.y + (next.y - prev.y) * t,
      z: prev.z + (next.z - prev.z) * t
    };
  }

  fog(frame: number): { r: number; g: number; b: number; near: number; far: number; css: string } {
    let event = this.fogEvents[0];
    for (const key of this.fogEvents) {
      if (key.frame >= 0 && key.frame <= frame) event = key;
      else if (key.frame > frame) break;
    }
    const t = event.duration > 0 ? clamp((frame - event.frame) / event.duration, 0, 1) : 1;
    const mix = (a: number, b: number) => a + (b - a) * t;
    const r = Math.round(mix(event.start.r, event.target.r));
    const g = Math.round(mix(event.start.g, event.target.g));
    const b = Math.round(mix(event.start.b, event.target.b));
    return { r, g, b, near: mix(event.start.near, event.target.near), far: mix(event.start.far, event.target.far), css: `rgb(${r}, ${g}, ${b})` };
  }

  facing(frame: number): { x: number; y: number; z: number } {
    let event = this.facingEvents[0];
    for (const key of this.facingEvents) {
      if (key.frame >= 0 && key.frame <= frame) event = key;
      else if (key.frame > frame) break;
    }
    const t = event.duration > 0 ? clamp((frame - event.frame) / event.duration, 0, 1) : 1;
    return {
      x: event.start.x + (event.target.x - event.start.x) * t,
      y: event.start.y + (event.target.y - event.start.y) * t,
      z: event.start.z + (event.target.z - event.start.z) * t
    };
  }

  // 30° vertical FOV perspective projection into playfield coordinates.
  project(x: number, y: number, z: number, playfield: { x: number; y: number; width: number; height: number }): { x: number; y: number; scale: number } | null {
    const fov = 30 * DEG;
    const halfW = playfield.width / 2;
    const halfH = playfield.height / 2;
    const dist = halfH / Math.tan(fov / 2);
    const viewZ = z + dist;
    if (viewZ <= 100) return null;
    const aspect = playfield.width / playfield.height;
    const yScale = 1 / Math.tan(fov / 2);
    const xScale = yScale / aspect;
    const nx = ((x - halfW) * xScale) / viewZ;
    const ny = ((-y + halfH) * yScale) / viewZ;
    return {
      x: playfield.x + playfield.width * (0.5 + nx * 0.5),
      y: playfield.y + playfield.height * (0.5 - ny * 0.5),
      scale: dist / viewZ
    };
  }
}
