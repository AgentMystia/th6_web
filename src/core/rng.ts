// The 16-bit PRNG used by the TH06/TH07-era engine (same generator family).
// Ported unchanged from the TH06 Web implementation, which derived it from the
// original game: seed' = ((a & 0xc000) >> 14) + a*4 with a = (seed^0x9630) - 0x6553.
export class Rng {
  seed: number;

  constructor(seed = 0x1527) {
    this.seed = seed & 0xffff;
  }

  u16(): number {
    const a = ((this.seed ^ 0x9630) - 0x6553) & 0xffff;
    this.seed = ((((a & 0xc000) >> 14) + a * 4) & 0xffff) >>> 0;
    return this.seed;
  }

  u32(): number {
    return ((this.u16() << 16) | this.u16()) >>> 0;
  }

  u16InRange(range: number): number {
    return range ? this.u16() % range : 0;
  }

  u32InRange(range: number): number {
    return range ? this.u32() % range : 0;
  }

  f(): number {
    return this.u32() / 0xffffffff;
  }

  range(v: number): number {
    return this.f() * v;
  }
}
