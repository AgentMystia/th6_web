const STEP_MS = 1000 / 60;
const MAX_FRAME_DELTA_MS = 250;

export interface LoopClient {
  update(): void;
  draw(): void;
}

// Fixed 60 FPS timestep: at most one simulation step per rAF tick, excess
// accumulated time is dropped (no catch-up spiral), draws are skipped on rAF
// ticks that ran no simulation step. Mirrors the TH06 Web loop behavior.
export class Loop {
  private last = 0;
  private acc = 0;
  private running = false;

  constructor(private client: LoopClient) {}

  start(): void {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    requestAnimationFrame((t) => this.tick(t));
  }

  private tick(now: number): void {
    if (!this.running) return;
    const delta = Math.min(MAX_FRAME_DELTA_MS, now - this.last);
    this.last = now;
    this.acc += delta;
    let stepped = false;
    if (this.acc >= STEP_MS) {
      this.client.update();
      stepped = true;
      this.acc -= STEP_MS;
      if (this.acc > STEP_MS) this.acc = STEP_MS; // drop excess frames
    }
    if (stepped) this.client.draw();
    requestAnimationFrame((t) => this.tick(t));
  }

  // Test hook: run n synchronous update steps (and one draw).
  advance(n: number): void {
    for (let i = 0; i < n; i++) this.client.update();
    this.client.draw();
  }
}
