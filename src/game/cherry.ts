// PCB's signature Cherry Point (桜点) system and the Supernatural Border
// (森羅結界). Rules encoded from en.touhouwiki.net/wiki/Perfect_Cherry_Blossom
// /Gameplay and maribelhearn.com/faq/scoring; values that are not documented
// numerically are marked TH07-TODO with the chosen approximation.
//
// - Cherry rises from shooting enemies (per-character rate, ~90% lower while
//   focused), cherry items, and star (cancel) items; it never exceeds
//   CherryMax. It drops on death (ratio from the character's SHT data), on
//   bombing (scaled by difficulty: full on Easy/Normal, 50% on Hard, 25% on
//   Lunatic), and on boss timeouts.
// - Cherry+ rises with Cherry; at 50,000 the Supernatural Border activates:
//   540 frames of invincibility with full-value auto-collection everywhere.
//   Grazing during the border adds +30 (focused) / +80 (unfocused) to
//   CherryMax. Surviving the full border awards CherryMax +10,000 and a
//   score bonus of Cherry × 10; getting hit or bombing breaks it (the hit is
//   absorbed, no bonus).
// - Point items collected above the PoC line are worth the current Cherry
//   value; below it their value decays with height.
// - Cherry items are worth 0 score unless Cherry == CherryMax, then 50,000
//   above the PoC (decaying below); they always add 1000 + 100 × (captured
//   spell cards) to Cherry and Cherry+.

// Th07.exe (v1.00b): the 50000 border-trigger threshold (0xC350) and the
// 540-frame border duration (0x21C) are both CONFIRMED directly in the exe.
// 50000: e.g. the CherryPlus-vs-max compares @ 0x4313fb/0x43142c ("cmp eax,
// 0xc350") in fcn.00430c10, and the flat cherry-item-at-max score (see
// cherryItemScore below). 540: the border end-of-life fade computes
// "540 - elapsed" @ 0x43e55d ("mov eax, 0x21c; sub eax, elapsed"),
// producing a 30-frame fade transition at both ends of the border.
export const CHERRY_PLUS_MAX = 50000;
export const BORDER_DURATION = 540;
export const INITIAL_CHERRY_MAX = 50000;

export type BorderEnd = 'none' | 'survived' | 'broken';

export interface CherryEvents {
  onBorderStart?(): void;
  onBorderEnd?(result: 'survived' | 'broken', bonus: number): void;
}

export class CherrySystem {
  cherry = 0;
  cherryMax = INITIAL_CHERRY_MAX;
  cherryPlus = 0;
  borderTimer = 0; // frames remaining while the border is active
  spellsCaptured = 0;

  constructor(private events: CherryEvents = {}) {}

  get borderActive(): boolean {
    return this.borderTimer > 0;
  }

  private gain(amount: number): void {
    if (amount <= 0) return;
    this.cherry = Math.min(this.cherryMax, this.cherry + amount);
    if (!this.borderActive) {
      this.cherryPlus = Math.min(CHERRY_PLUS_MAX, this.cherryPlus + amount);
      if (this.cherryPlus >= CHERRY_PLUS_MAX) this.startBorder();
    }
  }

  private startBorder(): void {
    this.borderTimer = BORDER_DURATION;
    this.cherryPlus = 0;
    this.events.onBorderStart?.();
  }

  // Advances the border timer; returns the score bonus when it completes.
  tick(): number {
    if (!this.borderActive) return 0;
    this.borderTimer--;
    if (this.borderTimer === 0) {
      this.cherryMax += 10000;
      const bonus = this.cherry * 10;
      this.events.onBorderEnd?.('survived', bonus);
      return bonus;
    }
    return 0;
  }

  // Breaks the border (player hit or bomb). Returns true if a hit was
  // absorbed by the border.
  breakBorder(): boolean {
    if (!this.borderActive) return false;
    this.borderTimer = 0;
    this.cherryPlus = 0;
    this.events.onBorderEnd?.('broken', 0);
    return true;
  }

  // TH07-TODO: exact per-character shot-hit cherry rates are undocumented;
  // +2 unfocused / +0.2 focused approximates the "~90% lower when focused"
  // rule. Fractions accumulate before truncation.
  private shotRemainder = 0;
  onShotHit(focused: boolean): void {
    this.shotRemainder += focused ? 0.2 : 2;
    const whole = Math.floor(this.shotRemainder);
    if (whole > 0) {
      this.shotRemainder -= whole;
      this.gain(whole);
    }
  }

  cherryItemGain(): number {
    return 1000 + 100 * this.spellsCaptured;
  }

  onCherryItem(): void {
    this.gain(this.cherryItemGain());
  }

  // Star / cancel items also raise cherry. TH07-TODO: exact value; using 10.
  onStarItem(): void {
    this.gain(10);
  }

  onGraze(focused: boolean): void {
    if (this.borderActive) {
      this.cherryMax += focused ? 30 : 80;
    } else {
      // TH07-TODO: out-of-border graze cherry gain is undocumented; using +5.
      this.gain(5);
    }
  }

  onSpellCapture(): void {
    this.spellsCaptured++;
  }

  onBomb(difficulty: number): void {
    this.breakBorder();
    // TH07-TODO: exact per-character bomb penalty; base 12000, halved on
    // Hard, quartered on Lunatic (documented difficulty scaling).
    const scale = difficulty === 2 ? 0.5 : difficulty === 3 ? 0.25 : 1;
    this.cherry = Math.max(0, this.cherry - Math.trunc(12000 * scale));
    this.cherryPlus = 0;
  }

  onDeath(lossRatio: number): void {
    this.cherry = Math.max(0, Math.trunc(this.cherry * (1 - lossRatio)));
    this.cherryPlus = 0;
  }

  onBossTimeout(): void {
    // TH07-TODO: exact timeout penalty; halving cherry.
    this.cherry = Math.trunc(this.cherry / 2);
  }

  // Score for a point item collected at height y (PoC line from SHT data).
  pointItemValue(y: number, pocLineY: number, autoCollected: boolean): number {
    if (autoCollected || y <= pocLineY) return Math.max(10, this.cherry);
    const t = Math.min(1, Math.max(0, (y - pocLineY) / (448 - pocLineY)));
    return Math.max(10, Math.trunc(this.cherry * (1 - t * 0.8) / 10) * 10);
  }

  // Th07.exe (v1.00b) fcn.00430c10 @ 0x431358 ("case 1" of an item-value
  // switch reached via the 50000/0xC350 anchor): CONFIRMED the decay below
  // the PoC line is a flat -100 score per pixel of |y - pocLineY| (imul by
  // 100 @ 0x4313b2), not proportional to remaining playfield height as
  // previously approximated here. The final value still floors to the
  // nearest 10 (cdq/idiv 10, subtract remainder @ 0x431458-0x431468,
  // matching the trunc-to-10 already used below). A further "excess
  // CherryMax headroom" bonus term was observed in the same function
  // (@ 0x4313e1-0x431455) but its struct-field semantics were not pinned
  // down with enough confidence to encode here -- see ghidra-re-notes.md,
  // Target B.
  cherryItemScore(y: number, pocLineY: number, autoCollected: boolean): number {
    if (this.cherry < this.cherryMax) return 0;
    if (autoCollected || y <= pocLineY) return 50000;
    const raw = 50000 - 100 * Math.abs(y - pocLineY);
    return Math.max(0, Math.trunc(raw / 10) * 10);
  }
}
