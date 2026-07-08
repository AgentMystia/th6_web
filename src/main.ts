import { Loop } from './core/loop';
import { Input } from './core/input';
import { Renderer } from './gfx/renderer';
import { AudioBus } from './audio/audio';
import { loadAssets } from './game/assets';
import { StageScene } from './game/stage-scene';
import { MenuFlow } from './game/title-scene';
import type { CharacterId } from './game/player';

interface TestHook {
  ready: boolean;
  advance(n: number): void;
  snapshot(): Record<string, unknown>;
  pixelAt(x: number, y: number): number[];
  setPlayer(x: number, y: number): void;
  setPower(v: number): void;
  inject(held: string[], pressed: string[]): void;
  damageBoss(n: number): void;
  addCherry(n: number): void;
  spawnLog(): { t: number; time: number; sub: number }[];
}

declare global {
  interface Window {
    __TH07_TEST__?: TestHook;
  }
}

// Unchanged from before the title/menu flow was added (see scripts/dev-shot.mjs
// and the test suite, which depend on this exact shape), plus a `scene:
// 'stage'` tag so the unified test hook below can report which kind of
// screen is active without special-casing either side.
function stageSnapshot(scene: StageScene): Record<string, unknown> {
  return {
    scene: 'stage',
    frame: scene.frame,
    difficulty: scene.difficulty,
    character: scene.playerObj.character,
    score: scene.score,
    enemies: scene.enemies.length,
    bullets: scene.enemyBullets.length,
    items: scene.items.length,
    timelines: scene.runtime.timelineCursors.map((c) => ({ ...c })),
    bossActive: !!scene.bossActive,
    bossHp: scene.bossActive?.hp ?? null,
    stageClear: scene.stageClear,
    gameOver: scene.gameOver,
    continueActive: !!scene.continueScreen,
    spellName: scene.spellName,
    rngSeed: scene.rng.seed,
    player: { x: scene.playerObj.x, y: scene.playerObj.y, lives: scene.playerObj.lives, bombs: scene.playerObj.bombs, power: scene.playerObj.power },
    graze: scene.graze,
    playerBullets: scene.playerBullets.length,
    playerBulletDump: scene.playerBullets.slice(0, 8).map((b) => ({
      x: Math.round(b.x),
      y: Math.round(b.y),
      shotType: b.shotType,
      rect: [b.rect.x, b.rect.y, b.rect.w, b.rect.h],
      img: b.rect.imageKey,
      vx: Number(b.vx.toFixed(2)),
      vy: Number(b.vy.toFixed(2))
    })),
    cherry: { c: scene.cherry.cherry, max: scene.cherry.cherryMax, plus: scene.cherry.cherryPlus, border: scene.cherry.borderTimer },
    bulletDump: scene.enemyBullets.slice(0, 64).map((b) => ({
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
  };
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

  // ?test=1 alone must still boot directly into the stage exactly as before
  // the menu flow existed (scripts/dev-shot.mjs and other automated tooling
  // depend on this). Add ?menu=1 alongside ?test=1 to make the menu flow
  // itself screenshot-testable; without ?test=1 (i.e. a real player), the
  // menu flow is always used.
  const isTest = params.get('test') === '1';
  const useMenu = !isTest || params.get('menu') === '1';

  let stage: StageScene | null = null;
  let menu: MenuFlow | null = null;
  // Hi-score carried across stage runs within this browser session.
  let sessionHiScore = 100000;

  // Shared by both the menu's "confirm" callback and the direct (?test=1,
  // no ?menu=1) boot path below, so BGM/preload behavior is identical either
  // way. Track 1 (th07_01) is the title theme, per musiccmt.txt; the stage
  // tracks were already wired up as-is.
  function startStage(difficulty: number, character: CharacterId): StageScene {
    const s = new StageScene(assets, audio, difficulty, character);
    // Headless probes (?test=1 without ?menu=1) keep the scene alive forever;
    // real play gets the arcade flow: continue screen + return to title.
    s.mode = useMenu ? 'arcade' : 'test';
    s.hiScore = Math.max(s.hiScore, sessionHiScore);
    s.onExitToTitle = () => {
      sessionHiScore = Math.max(sessionHiScore, s.hiScore);
      stage = null;
      menu = new MenuFlow(assets, audio, startStage);
      audio.preloadBgm(['th07_01']);
      audio.playBgm('th07_01');
    };
    stage = s;
    menu = null;
    audio.preloadBgm(['th07_02', 'th07_03']);
    audio.playBgm('th07_02');
    return s;
  }

  if (useMenu) {
    menu = new MenuFlow(assets, audio, startStage);
    audio.preloadBgm(['th07_01']);
    audio.playBgm('th07_01');
  } else {
    const difficulty = Math.min(3, Math.max(0, Number(params.get('difficulty') ?? 1)));
    const character = (params.get('shot') ?? 'reimuA') as CharacterId;
    const s = startStage(difficulty, character);
    // Test-only override so scripts/dev-shot.mjs can snapshot a shot pattern
    // at an arbitrary power bracket without needing to grind for it in-game.
    if (params.has('power')) s.playerObj.power = Number(params.get('power'));
  }

  const loop = new Loop({
    update: () => {
      const frame = input.frame();
      if (menu) menu.update(frame);
      else if (stage) stage.update(frame);
    },
    draw: () => {
      if (menu) menu.draw(renderer);
      else if (stage) stage.draw(renderer);
    }
  });

  if (isTest) {
    window.__TH07_TEST__ = {
      ready: true,
      advance: (n: number) => loop.advance(n),
      snapshot: () => (menu ? menu.snapshot() : stageSnapshot(stage!)),
      pixelAt: (x: number, y: number) => Array.from(renderer.ctx.getImageData(x, y, 1, 1).data),
      setPlayer: (x: number, y: number) => {
        if (!stage) return;
        stage.playerObj.x = x;
        stage.playerObj.y = y;
      },
      setPower: (v: number) => {
        if (stage) stage.playerObj.power = v;
      },
      inject: (held: string[], pressed: string[]) => {
        input.inject(held as never, pressed as never);
      },
      spawnLog: () => stage?.runtime.spawnLog ?? [],
      damageBoss: (n: number) => {
        // Same gate as player damage, so probes can't hit a boss that is
        // invulnerable during phase transitions / the death animation.
        const b = stage?.bossActive;
        if (b && b.ecl.canTakeDamage && b.ecl.interactable) b.hp -= n;
      },
      addCherry: (n: number) => {
        if (!stage) return;
        for (let i = 0; i < n / 2; i++) stage.cherry.onShotHit(false);
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
