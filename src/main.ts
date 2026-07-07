import { Loop } from './core/loop';
import { Input } from './core/input';
import { Renderer } from './gfx/renderer';
import { AudioBus } from './audio/audio';
import { loadAssets } from './game/assets';
import { StageScene } from './game/stage-scene';

interface TestHook {
  ready: boolean;
  advance(n: number): void;
  snapshot(): Record<string, unknown>;
  pixelAt(x: number, y: number): number[];
  setPlayer(x: number, y: number): void;
  damageBoss(n: number): void;
}

declare global {
  interface Window {
    __TH07_TEST__?: TestHook;
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
  const input = new Input();
  const audio = new AudioBus();
  const params = new URLSearchParams(location.search);
  const difficulty = Math.min(3, Math.max(0, Number(params.get('difficulty') ?? 1)));

  const scene = new StageScene(assets, audio, difficulty);
  audio.preloadBgm(['th07_02', 'th07_03']);
  audio.playBgm('th07_02');

  const loop = new Loop({
    update: () => {
      const frame = input.frame();
      scene.update(frame);
    },
    draw: () => scene.draw(renderer)
  });

  if (params.get('test') === '1') {
    window.__TH07_TEST__ = {
      ready: true,
      advance: (n: number) => loop.advance(n),
      snapshot: () => ({
        frame: scene.frame,
        score: scene.score,
        enemies: scene.enemies.length,
        bullets: scene.enemyBullets.length,
        items: scene.items.length,
        timelines: scene.runtime.timelineCursors.map((c) => ({ ...c })),
        bossActive: !!scene.bossActive,
        bossHp: scene.bossActive?.hp ?? null,
        spellName: scene.spellName,
        rngSeed: scene.rng.seed,
        player: { ...scene.player },
        bulletDump: scene.enemyBullets.slice(0, 5).map((b) => ({
          x: Math.round(b.x),
          y: Math.round(b.y),
          sprite: b.sprite,
          off: b.spriteOffset,
          rect: [b.rect.x, b.rect.y, b.rect.w, b.rect.h],
          img: b.rect.imageKey,
          vx: Number(b.vx.toFixed(2)),
          vy: Number(b.vy.toFixed(2))
        })),
        enemyDump: scene.enemies.slice(0, 8).map((e) => ({
          sub: e.ecl.subId,
          ctxSub: e.ecl.ctx.subId,
          x: Math.round(e.x),
          y: Math.round(e.y),
          hp: e.hp,
          boss: e.ecl.isBoss,
          timer: e.ecl.bossTimer
        }))
      }),
      pixelAt: (x: number, y: number) => Array.from(renderer.ctx.getImageData(x, y, 1, 1).data),
      setPlayer: (x: number, y: number) => {
        scene.player.x = x;
        scene.player.y = y;
      },
      damageBoss: (n: number) => {
        if (scene.bossActive) scene.bossActive.hp -= n;
      }
    };
  }
  loop.start();
}

void boot().catch((err) => {
  console.error(err);
  const el = document.createElement('pre');
  el.style.color = '#f66';
  el.textContent = String((err as Error)?.stack ?? err);
  document.body.appendChild(el);
});
