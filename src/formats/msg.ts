import { BinaryView } from './bin';

// TH07 MSG dialogue format: u32 message count, u32 offsets[count], then per
// message a stream of {u16 time, u8 op, u8 argLength, args…} until op 0.
// Ops used by TH07 stage dialogue: 0 end, 1/2 portrait enter (side, anm
// script), 3 text line (color?, lineIndex, shift-jis text), 4 wait, 5 face
// expression (side, variant), 6 ecl-resume ticket, 7 music change, 8 boss
// intro line, 9 stage result, 10 wait forever, 11 hide portraits, 12 bgm
// fadeout, 13 text-skippability flag.

export interface MsgInstr {
  time: number;
  op: number;
  size: number;
  portrait?: number;
  script?: number;
  color?: number;
  line?: number;
  text?: string;
  arg?: number;
  arg2?: number;
}

export class Msg {
  readonly view: BinaryView;
  readonly messages: MsgInstr[][] = [];

  constructor(source: string | Uint8Array) {
    this.view = new BinaryView(source);
    const count = this.view.i32(0);
    for (let i = 0; i < count; i++) {
      this.messages.push(this.parseMessage(this.view.u32(4 + i * 4)));
    }
  }

  private parseMessage(off: number): MsgInstr[] {
    const v = this.view;
    const out: MsgInstr[] = [];
    for (let guard = 0; guard < 512 && off + 4 <= v.length; guard++) {
      const instr: MsgInstr = { time: v.u16(off), op: v.u8(off + 2), size: v.u8(off + 3) };
      const a = off + 4;
      if (instr.op === 1 || instr.op === 2 || instr.op === 5) {
        instr.portrait = v.i16(a);
        instr.script = v.i16(a + 2);
      } else if (instr.op === 3 || instr.op === 8) {
        instr.color = v.i16(a);
        instr.line = v.i16(a + 2);
        let end = a + 4;
        while (end < v.length && v.bytes[end]) end++;
        instr.text = v.shiftJis(a + 4, end);
      } else if (instr.size >= 8) {
        instr.arg = v.i32(a);
        instr.arg2 = v.i32(a + 4);
      } else if (instr.size >= 4) {
        instr.arg = v.i32(a);
      }
      out.push(instr);
      off += 4 + instr.size;
      if (instr.op === 0) break;
    }
    return out;
  }

  message(idx: number): MsgInstr[] | null {
    return this.messages[idx] ?? null;
  }
}
