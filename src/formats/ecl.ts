import { BinaryView } from './bin';

// TH07 ECL container. Header: {u16 subCount, u16 timelineCount,
// u32 offsets[16 timeline slots + subCount sub offsets]}. Sub instructions:
// {u32 time, u16 id, u16 size, u16 rankMask, u16 paramMask, args…} with
// sentinel time == 0xffffffff. Timeline instructions: {i16 time, i16 arg0,
// u16 id, i16 size} with sentinel time == -1 && arg0 == 4.
// (Struct layouts from thtk thecl/thecl06.c.)

export const TIMELINE_SLOTS = 16;

export interface EclInstr {
  time: number;
  id: number;
  size: number;
  rankMask: number; // upper byte of the raw field; bit per difficulty
  paramMask: number;
  args: number; // absolute offset of the argument block
  offset: number; // absolute offset of the instruction (for jumps)
}

export interface TimelineEvent {
  time: number;
  arg0: number;
  op: number;
  size: number;
  // Spawn events (ops 0/2/4/6): position + life/item/score as i32s.
  x?: number;
  y?: number;
  z?: number;
  life?: number;
  item?: number;
  score?: number;
  // Other events: two raw int args.
  i0?: number;
  i1?: number;
}

export class Ecl {
  readonly view: BinaryView;
  readonly subCount: number;
  readonly subOffsets: number[] = [];
  readonly timelines: TimelineEvent[][] = [];
  // Instruction streams decoded per sub, indexed by byte offset for jumps.
  private subInstrs: Map<number, EclInstr[]> = new Map();

  constructor(source: string | Uint8Array) {
    this.view = new BinaryView(source);
    const v = this.view;
    this.subCount = v.u16(0);
    const timelineCount = Math.max(1, v.u16(2));
    for (let i = 0; i < this.subCount; i++) {
      this.subOffsets.push(v.u32(4 + (TIMELINE_SLOTS + i) * 4));
    }
    for (let t = 0; t < Math.min(timelineCount, TIMELINE_SLOTS); t++) {
      const off = v.u32(4 + t * 4);
      if (!off || off >= v.length) break;
      this.timelines.push(this.parseTimeline(off));
    }
  }

  get timeline(): TimelineEvent[] {
    return this.timelines[0] ?? [];
  }

  private parseTimeline(start: number): TimelineEvent[] {
    const v = this.view;
    const out: TimelineEvent[] = [];
    for (let off = start, guard = 0; off + 8 <= v.length && guard < 4096; guard++) {
      const time = v.i16(off);
      const arg0 = v.i16(off + 2);
      const op = v.u16(off + 4);
      const size = v.i16(off + 6);
      if (time === -1 && arg0 === 4) break;
      if (size < 8) break;
      const evt: TimelineEvent = { time, arg0, op, size };
      if (size >= 32 && (op === 0 || op === 2 || op === 4 || op === 6)) {
        evt.x = v.f32(off + 8);
        evt.y = v.f32(off + 12);
        evt.z = v.f32(off + 16);
        evt.life = v.i32(off + 20);
        evt.item = v.i32(off + 24);
        evt.score = v.i32(off + 28);
      } else if (size >= 16) {
        evt.i0 = v.i32(off + 8);
        evt.i1 = v.i32(off + 12);
      } else if (size >= 12) {
        evt.i0 = v.i32(off + 8);
      }
      out.push(evt);
      off += size;
    }
    return out;
  }

  // Decode a sub's instruction stream (cached). Offsets are relative to the
  // sub start, matching ECL jump instruction semantics.
  sub(subId: number): EclInstr[] {
    const cached = this.subInstrs.get(subId);
    if (cached) return cached;
    const start = this.subOffsets[subId];
    if (start == null) throw new Error(`ECL sub ${subId} out of range (subCount=${this.subCount})`);
    const v = this.view;
    const out: EclInstr[] = [];
    for (let off = start, guard = 0; off + 12 <= v.length && guard < 8192; guard++) {
      const time = v.u32(off);
      if (time === 0xffffffff) break;
      const id = v.u16(off + 4);
      const size = v.u16(off + 6);
      if (size < 12) break;
      out.push({
        time,
        id,
        size,
        rankMask: (v.u16(off + 8) >> 8) & 0xff,
        paramMask: v.u16(off + 10),
        args: off + 12,
        offset: off - start
      });
      off += size;
    }
    this.subInstrs.set(subId, out);
    return out;
  }
}
