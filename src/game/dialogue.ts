import { Msg, type MsgInstr } from '../formats/msg';
import type { Anm, AnmSprite } from '../formats/anm';

// Stage dialogue runner. Ops (validated against the msg1 disassembly):
// 0 end, 1 portrait enter (side, face), 2 set face (side, face), 3 text line
// (side, lineIndex, text), 4 wait N frames, 5 portrait state (side,
// 1 enter / 3 active / 4 inactive), 6 ECL resume ticket, 7 music change,
// 8 boss intro line, 9/10 stage flow, 11 hide portraits, 12 BGM fadeout,
// 13 skippability flag.

export interface PortraitState {
  visible: boolean;
  face: number;
  active: boolean;
  slideIn: number;
}

export class DialogueRunner {
  private instrs: MsgInstr[];
  private idx = 0;
  private time = 0;
  private waitTimer = 0;
  done = false;
  resumeTicket = false;
  lines: (string | null)[] = [null, null];
  speakerSide = 0;
  bossIntro: string[] = [];
  bossIntroTimer = 0;
  portraits: PortraitState[] = [
    { visible: false, face: 0, active: false, slideIn: 0 },
    { visible: false, face: 0, active: false, slideIn: 0 }
  ];
  skippable = true;

  constructor(
    msg: Msg,
    index: number,
    private hooks: { playBgm?(track: number): void; fadeBgm?(): void } = {}
  ) {
    this.instrs = msg.message(index) ?? [];
    if (!this.instrs.length) this.done = true;
  }

  update(confirmPressed: boolean): void {
    if (this.done) return;
    for (const p of this.portraits) {
      if (p.visible && p.slideIn < 1) p.slideIn = Math.min(1, p.slideIn + 0.1);
    }
    if (this.bossIntroTimer > 0) this.bossIntroTimer--;
    if (this.waitTimer > 0) {
      if (confirmPressed && this.skippable) {
        this.waitTimer = 0;
      } else {
        this.waitTimer--;
        return;
      }
    }
    for (let guard = 0; guard < 64 && !this.done; guard++) {
      const instr = this.instrs[this.idx];
      if (!instr) {
        this.done = true;
        return;
      }
      this.idx++;
      switch (instr.op) {
        case 0:
          this.done = true;
          return;
        case 1: {
          const side = instr.portrait ?? 0;
          const p = this.portraits[side];
          if (p) {
            p.visible = true;
            p.face = instr.script ?? 0;
            p.slideIn = 0;
          }
          break;
        }
        case 2: {
          const p = this.portraits[instr.portrait ?? 0];
          if (p) p.face = instr.script ?? 0;
          break;
        }
        case 3: {
          this.speakerSide = instr.color ?? 0;
          const lineIdx = (instr.line ?? 0) & 1;
          if (lineIdx === 0) this.lines = [instr.text ?? '', null];
          else this.lines[1] = instr.text ?? '';
          break;
        }
        case 4:
          this.waitTimer = instr.arg ?? 0;
          return;
        case 5: {
          const p = this.portraits[instr.portrait ?? 0];
          if (p) p.active = (instr.script ?? 0) !== 4;
          break;
        }
        case 6:
          this.resumeTicket = true;
          break;
        case 7:
          this.hooks.playBgm?.(instr.arg ?? 0);
          break;
        case 8:
          this.bossIntro.push(instr.text ?? '');
          this.bossIntroTimer = 180;
          break;
        case 11:
          for (const p of this.portraits) p.visible = false;
          break;
        case 12:
          this.hooks.fadeBgm?.();
          break;
        case 13:
          this.skippable = (instr.arg ?? 1) !== 0;
          break;
        case 9:
        case 10:
        default:
          break;
      }
    }
  }
}

// Portrait sprite for a side: side 0 = player (face_rm00/mr00/sk00 by
// family), side 1 = stage boss (face_XX_00).
export function portraitSprite(anm: Anm, face: number): AnmSprite | null {
  return anm.sprites.get(face) ?? anm.sprites.get(0) ?? null;
}
