import { BinaryView } from './bin';
import { clamp, DEG, lerp } from '../core/util';
import { applyFormula } from './anm';

// TH07 STD stage-background format. Same layout family as TH06:
// header {u16 objectCount, u16 faceCount, u32 faceOffset, u32 scriptOffset,
// u32 zero} + stageName[128] + 4×songName[128] + 4×songPath[128], then the
// object offset table at 0x490, a FACE (instance) array
// {u16 objectId, u16 unknown, f32 x, f32 y, f32 z}, then a fixed-width (20
// byte) script: {i32 frame, i16 op, i16 unused, f32 arg0, f32 arg1, f32 arg2}.
//
// Op numbers and argument meaning below are taken from thtk's thstd
// (formats_v0 — TH06/07/08/09/09.5 all share this table) and verified
// against reference/DSTD7/stage1.dstd's disassembly:
//   ins_0(0,0,0)               no-op (also used as a padding/terminator entry)
//   ins_1(argb, near, far)     fog keyframe (near/far are fog distances)
//   ins_2(duration, 0, 0)      fog interpolation duration (always linear)
//   ins_4(a, frameBits, 0)     jump: redirect the script clock to the frame
//                              encoded in frameBits' raw bit pattern (not its
//                              float *value* — thstd's formatter prints it as
//                              a tiny denormal float, but it's really an
//                              int32 stored in a float-tagged slot)
//   ins_5(x, y, z)             camera position keyframe (x is likewise a
//                              float stored in an int-tagged slot; e.g.
//                              -1018691584 raw-decodes to -200.0)
//   ins_6(duration, mode, 0)   interpolate camera position to the *next*
//                              ins_5 over `duration` frames, easing `mode`
//   ins_7(x, y, z)             camera facing: a camera-relative look
//                              direction vector (not an absolute point)
//   ins_8(duration, mode)      interpolate facing to the next ins_7
//   ins_9(0, 1.0, 0.0)         no-op (undocumented; not needed for stage 1)
//   ins_11(fovRadians, 0, 0)   vertical field of view
// World axes throughout: x = lateral, y = forward depth, z = height with
// *negative* z up (camera z ≈ -400 sits ~400 units above the ground at -12).

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

// FACE/instance byte layout, cross-checked against thstd's std_object_instance_t
// (uint16 object_id, uint16 unknown1, float x, float y, float z) and its dump
// code (`fprintf("FACE: %i %g %g %g", unknown1, x, y, z)`, object_id itself
// coming from the enclosing ENTRY grouping, not printed per-line): our object
// id + x/y/z reads line up 1:1 with that struct; only the unused `unknown1`
// column (always 256 in stage1.std) is skipped.
export interface StdInstance {
  id: number;
  x: number;
  y: number;
  z: number;
}

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

interface FogState {
  r: number;
  g: number;
  b: number;
  near: number;
  far: number;
}

// Shared shape for the three script-driven "ease from A to B over `duration`
// frames starting at `frame`, using easing `mode`" tracks (camera position,
// facing, fog). Fog has no easing-mode argument in the format table, so its
// events always carry mode 0 (linear).
interface EaseEvent<T> {
  frame: number;
  start: T;
  target: T;
  duration: number;
  mode: number;
}

// Camera position + orientation basis for one frame, precomputed once so
// project() can be called many times per frame with only dot products.
export interface CameraFrame {
  x: number;
  y: number;
  z: number;
  rightX: number; rightY: number; rightZ: number;
  upX: number; upY: number; upZ: number;
  fwdX: number; fwdY: number; fwdZ: number;
  fov: number;
}

const OBJECT_TABLE_OFFSET = 0x490;

export class Std {
  readonly view: BinaryView;
  readonly stageName: string;
  readonly songNames: string[] = [];
  readonly songPaths: string[] = [];
  readonly objects: StdObject[] = [];
  readonly instances: StdInstance[] = [];
  private cameraEvents: EaseEvent<Vec3>[] = [];
  private facingEvents: EaseEvent<Vec3>[] = [];
  private fogEvents: EaseEvent<FogState>[] = [];
  // Script-authored jumps (ins_4): scriptFrame -> targetFrame. Stage 1 uses
  // exactly one, to loop the boss-fight dolly, but this is handled generically.
  private jumps = new Map<number, number>();
  fov = 30 * DEG;
  frame = 0;

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

    const defaultCamera: Vec3 = { x: 0, y: 0, z: 0 };
    // No yaw/tilt (facing straight down +y) until the first ins_7 fires.
    const defaultFacing: Vec3 = { x: 0, y: 1, z: 0 };
    const defaultFog: FogState = { r: 16, g: 0, b: 32, near: 200, far: 500 };
    this.cameraEvents.push({ frame: 0, start: defaultCamera, target: defaultCamera, duration: 0, mode: 0 });
    this.facingEvents.push({ frame: 0, start: defaultFacing, target: defaultFacing, duration: 0, mode: 0 });
    this.fogEvents.push({ frame: 0, start: defaultFog, target: defaultFog, duration: 0, mode: 0 });

    let currentCamera = defaultCamera;
    let currentFacing = defaultFacing;
    let currentFog = defaultFog;
    let pendingCameraDuration = 0;
    let pendingCameraMode = 0;
    let pendingFacingDuration = 0;
    let pendingFacingMode = 0;
    let pendingFogDuration = 0;

    for (let off = scriptOffset, guard = 0; off + 20 <= v.length && guard < 512; off += 20, guard++) {
      const rawFrame = v.i32(off);
      const op = v.i16(off + 4);
      if (rawFrame === -1 && op === -1) break;
      const frame = Math.max(0, rawFrame);
      // Every arg slot is 4 raw bytes; which reinterpretation (int vs float)
      // is correct depends on the op (see the format table in the header
      // comment) — e.g. ins_5's x is format-tagged as an int but is really a
      // float's bit pattern (confirmed: -1018691584 raw-decodes to -200.0).
      const x = v.f32(off + 8);
      const y = v.f32(off + 12);
      const z = v.f32(off + 16);
      const i0 = v.i32(off + 8);
      const i1 = v.i32(off + 12);

      switch (op) {
        case 5: { // camera position keyframe
          const target: Vec3 = { x, y, z };
          this.cameraEvents.push({ frame, start: currentCamera, target, duration: pendingCameraDuration, mode: pendingCameraMode });
          currentCamera = target;
          pendingCameraDuration = 0;
          pendingCameraMode = 0;
          break;
        }
        case 6: // camera position interpolation duration + easing mode
          pendingCameraDuration = Math.max(0, i0);
          pendingCameraMode = i1;
          break;
        case 7: { // camera facing keyframe (camera-relative look direction)
          const target: Vec3 = { x, y, z };
          this.facingEvents.push({ frame, start: currentFacing, target, duration: pendingFacingDuration, mode: pendingFacingMode });
          currentFacing = target;
          pendingFacingDuration = 0;
          pendingFacingMode = 0;
          break;
        }
        case 8: // facing interpolation duration + easing mode
          pendingFacingDuration = Math.max(0, i0);
          pendingFacingMode = i1;
          break;
        case 1: { // fog keyframe: ARGB color + near/far fog distances
          const color = i0 >>> 0;
          const target: FogState = {
            r: (color >> 16) & 0xff,
            g: (color >> 8) & 0xff,
            b: color & 0xff,
            near: y,
            far: z
          };
          this.fogEvents.push({ frame, start: currentFog, target, duration: pendingFogDuration, mode: 0 });
          currentFog = target;
          pendingFogDuration = 0;
          break;
        }
        case 2: // fog interpolation duration (no easing-mode argument: linear)
          pendingFogDuration = Math.max(0, i0);
          break;
        case 4: // jump: target frame is the raw int bits of the 2nd slot
          this.jumps.set(frame, i1);
          break;
        case 11: // vertical field of view, radians
          this.fov = x;
          break;
        default:
          // ins_0 / ins_9 and anything else observed in stage 1's script are
          // documented no-ops for our purposes.
          break;
      }
    }
    this.cameraEvents.sort((a, b) => a.frame - b.frame);
    this.facingEvents.sort((a, b) => a.frame - b.frame);
    this.fogEvents.sort((a, b) => a.frame - b.frame);
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
  }

  // The STD script clock simply free-runs, one frame per call; the only
  // redirection is a script-authored jump (ins_4), handled generically here
  // (stage 1 uses this to loop the boss-fight camera dolly forever).
  advance(): void {
    this.frame++;
    for (let guard = 0; guard < 8; guard++) {
      const target = this.jumps.get(this.frame);
      if (target == null) break;
      this.frame = target;
    }
  }

  private static pick<T extends { frame: number }>(events: T[], frame: number): T {
    let event = events[0];
    for (const e of events) {
      if (e.frame <= frame) event = e;
      else break;
    }
    return event;
  }

  private static easeVec3(event: EaseEvent<Vec3>, frame: number): Vec3 {
    const t = event.duration > 0 ? applyFormula(clamp((frame - event.frame) / event.duration, 0, 1), event.mode) : 1;
    return {
      x: lerp(event.start.x, event.target.x, t),
      y: lerp(event.start.y, event.target.y, t),
      z: lerp(event.start.z, event.target.z, t)
    };
  }

  camera(frame: number): Vec3 {
    return Std.easeVec3(Std.pick(this.cameraEvents, frame), frame);
  }

  facing(frame: number): Vec3 {
    return Std.easeVec3(Std.pick(this.facingEvents, frame), frame);
  }

  fog(frame: number): { r: number; g: number; b: number; near: number; far: number; css: string } {
    const event = Std.pick(this.fogEvents, frame);
    // ins_2 carries no easing-mode argument: fog always interpolates linearly.
    const t = event.duration > 0 ? clamp((frame - event.frame) / event.duration, 0, 1) : 1;
    const r = Math.round(lerp(event.start.r, event.target.r, t));
    const g = Math.round(lerp(event.start.g, event.target.g, t));
    const b = Math.round(lerp(event.start.b, event.target.b, t));
    return { r, g, b, near: lerp(event.start.near, event.target.near, t), far: lerp(event.start.far, event.target.far, t), css: `rgb(${r}, ${g}, ${b})` };
  }

  // Camera position + orthonormal (right, up, forward) basis for `frame`,
  // built from the facing vector with no roll (world "up" = -z). Cheap
  // enough (a couple of cross products) to call once per rendered frame and
  // reuse for every project() call that frame.
  cameraFrame(frame: number): CameraFrame {
    const pos = this.camera(frame);
    const face = this.facing(frame);
    const flen = Math.hypot(face.x, face.y, face.z) || 1;
    const fx = face.x / flen;
    const fy = face.y / flen;
    const fz = face.z / flen;
    // right = normalize(worldUp × forward), worldUp = (0,0,-1).
    let rx = fy;
    let ry = -fx;
    let rz = 0;
    let rlen = Math.hypot(rx, ry, rz);
    if (rlen < 1e-6) {
      // Degenerate only if forward is ~vertical (never happens in stage 1's
      // data); fall back to a level right vector.
      rx = 1; ry = 0; rz = 0; rlen = 1;
    }
    rx /= rlen; ry /= rlen; rz /= rlen;
    // up = forward × right completes the right-handed basis.
    const ux = fy * rz - fz * ry;
    const uy = fz * rx - fx * rz;
    const uz = fx * ry - fy * rx;
    return {
      x: pos.x, y: pos.y, z: pos.z,
      rightX: rx, rightY: ry, rightZ: rz,
      upX: ux, upY: uy, upZ: uz,
      fwdX: fx, fwdY: fy, fwdZ: fz,
      fov: this.fov
    };
  }

  // Perspective projection of a world-space point into playfield coordinates,
  // using the full camera position + orientation (see cameraFrame). World
  // axes: x lateral, y forward depth, z height (negative = up); the camera's
  // own facing vector lives in the same axes and may carry a downward tilt
  // (stage 1 settles at atan(400/500) ≈ 38.7° once the intro pan finishes),
  // so the view-space depth/vertical used here are proper rotated
  // projections, not the raw world y/z.
  project(x: number, y: number, z: number, cam: CameraFrame, playfield: { x: number; y: number; width: number; height: number }): { x: number; y: number; scale: number } | null {
    const relX = x - cam.x;
    const relY = y - cam.y;
    const relZ = z - cam.z;
    const viewX = relX * cam.rightX + relY * cam.rightY + relZ * cam.rightZ;
    const viewY = relX * cam.upX + relY * cam.upY + relZ * cam.upZ;
    const viewZ = relX * cam.fwdX + relY * cam.fwdY + relZ * cam.fwdZ;
    if (viewZ <= 40) return null;
    const halfH = playfield.height / 2;
    const aspect = playfield.width / playfield.height;
    const yScale = 1 / Math.tan(cam.fov / 2);
    const xScale = yScale / aspect;
    const nx = (viewX * xScale) / viewZ;
    const ny = (viewY * yScale) / viewZ;
    return {
      x: playfield.x + playfield.width * (0.5 + nx * 0.5),
      y: playfield.y + playfield.height * (0.5 - ny * 0.5),
      scale: (halfH * yScale) / viewZ
    };
  }
}
