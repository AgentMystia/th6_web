import { Loop } from './core/loop';
import { Input } from './core/input';
import { Rng } from './core/rng';
import { Renderer, PLAYFIELD } from './gfx/renderer';
import { AudioBus } from './audio/audio';
import { loadAssets, type GameAssets } from './game/assets';
import { AnmRunner } from './formats/anm';
import { Ecl } from './formats/ecl';
import { Std } from './formats/std';
import { Msg } from './formats/msg';
import { TH07_DATA } from './data/th07-data';

// M2 smoke scene: verifies ANM v2 parsing/execution, sprite rendering, the
// ECL/STD/MSG parsers, and audio wiring. Replaced by the real game scenes in
// later milestones.

interface TestHook {
  ready: boolean;
  advance(n: number): void;
  snapshot(): Record<string, unknown>;
  pixelAt(x: number, y: number): number[];
}

declare global {
  interface Window {
    __TH07_TEST__?: TestHook;
  }
}

class SmokeScene {
  frame = 0;
  runners: { runner: AnmRunner; x: number; y: number }[] = [];
  ecl: Ecl;
  std: Std;
  msg: Msg;

  constructor(private assets: GameAssets, private rng: Rng) {
    this.ecl = new Ecl(TH07_DATA.stages[1].ecl);
    this.std = new Std(TH07_DATA.stages[1].std);
    this.msg = new Msg(TH07_DATA.stages[1].msg);
    // A row of bullet scripts from etama, a fairy from stg1enm, player idle.
    const etama = assets.anms.etama;
    for (let i = 0; i < 12; i++) {
      if (!etama.hasScript(i)) continue;
      this.runners.push({
        runner: new AnmRunner(etama, i, { rng }),
        x: PLAYFIELD.x + 32 + i * 28,
        y: PLAYFIELD.y + 120
      });
    }
    const enm = assets.anms.stg1enm;
    const enmIds = enm.scriptIds.slice(0, 8);
    enmIds.forEach((id, i) => {
      this.runners.push({
        runner: new AnmRunner(enm, id, { rng }),
        x: PLAYFIELD.x + 48 + i * 44,
        y: PLAYFIELD.y + 200
      });
    });
    const player = assets.anms.player00;
    if (player.hasScript(0)) {
      this.runners.push({ runner: new AnmRunner(player, 0, { rng }), x: PLAYFIELD.x + 192, y: PLAYFIELD.y + 400 });
    }
  }

  update(): void {
    this.frame++;
    for (const r of this.runners) r.runner.update();
  }

  draw(renderer: Renderer): void {
    renderer.clear('#101018');
    renderer.ctx.fillStyle = '#000';
    renderer.ctx.fillRect(PLAYFIELD.x, PLAYFIELD.y, PLAYFIELD.width, PLAYFIELD.height);
    renderer.drawImage('title00', 448, 16, 176, 132);
    for (const r of this.runners) {
      renderer.drawAnmFrame(r.runner.spriteFrame(), r.x, r.y);
    }
    renderer.text('TH07 WEB — M2 smoke scene', 40, 24, { size: 16 });
    renderer.text(`ECL subs: ${this.ecl.subCount}  timeline events: ${this.ecl.timeline.length}`, 40, 46, { size: 12 });
    renderer.text(`STD objects: ${this.std.objects.length}  instances: ${this.std.instances.length}`, 40, 62, { size: 12 });
    renderer.text(`MSG messages: ${this.msg.messages.length}`, 40, 78, { size: 12 });
    renderer.text(`frame ${this.frame}`, 40, 94, { size: 12 });
  }
}

async function boot(): Promise<void> {
  const canvas = document.getElementById('game') as HTMLCanvasElement | null;
  if (!canvas) throw new Error('missing #game canvas');
  const renderer = new Renderer(canvas);
  renderer.clear('#000');
  renderer.text('Now Loading...', 270, 230, { size: 16 });

  const assets = await loadAssets();
  renderer.assets = assets.images;
  const rng = new Rng();
  const input = new Input();
  const audio = new AudioBus();
  audio.preloadBgm(['th07_01']);

  const scene = new SmokeScene(assets, rng);
  const loop = new Loop({
    update: () => {
      input.frame();
      scene.update();
    },
    draw: () => scene.draw(renderer)
  });

  const params = new URLSearchParams(location.search);
  if (params.get('test') === '1') {
    window.__TH07_TEST__ = {
      ready: true,
      advance: (n: number) => loop.advance(n),
      snapshot: () => ({
        frame: scene.frame,
        runners: scene.runners.length,
        visibleSprites: scene.runners.filter((r) => r.runner.spriteFrame() !== null).length,
        eclSubs: scene.ecl.subCount,
        timelineEvents: scene.ecl.timeline.length,
        stdObjects: scene.std.objects.length,
        msgCount: scene.msg.messages.length,
        stageName: scene.std.stageName,
        rngSeed: rng.seed
      }),
      pixelAt: (x: number, y: number) => Array.from(renderer.ctx.getImageData(x, y, 1, 1).data)
    };
  }
  loop.start();
}

void boot().catch((err) => {
  console.error(err);
  const el = document.createElement('pre');
  el.style.color = '#f66';
  el.textContent = String(err?.stack ?? err);
  document.body.appendChild(el);
});
