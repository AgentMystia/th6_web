import { StageRuntime } from './eclvm';
import type { GameHost, Enemy, EnemyBullet, EnemyLaser, ItemEntity, ItemType, EffectParticle } from './types';
import { Rng } from '../core/rng';
import { normalizeAngle } from '../core/util';
import type { InputFrame } from '../core/input';
import { Renderer, PLAYFIELD } from '../gfx/renderer';
import type { GameAssets } from './assets';
import { AnmRunner } from '../formats/anm';
import { TH07_DATA } from '../data/th07-data';
import type { AudioBus } from '../audio/audio';

// Stage host. At the M3 milestone this runs the full stage 1 timeline with a
// movable player stub (no collision yet) so ECL patterns can be verified.

const ITEM_COLORS: Record<ItemType, string> = {
  power: '#e33',
  point: '#36c',
  bigPower: '#f44',
  bomb: '#3a3',
  fullPower: '#ff0',
  life: '#e5e',
  cherry: '#f9c',
  bigCherry: '#f6a',
  pointBullet: '#88f'
};

export class StageScene implements GameHost {
  rng = new Rng();
  difficulty = 1;
  rank = 16;
  frame = 0;
  id = 1;
  player = { x: 192, y: 384 };
  enemies: Enemy[] = [];
  enemyBullets: EnemyBullet[] = [];
  enemyLasers: EnemyLaser[] = [];
  items: ItemEntity[] = [];
  particles: EffectParticle[] = [];
  power = 0;
  score = 0;
  focusHeld = false;
  runtime: StageRuntime;
  private playerRunner: AnmRunner;
  dialogueActive = false;
  private dialogueTimer = 0;
  bossActive: Enemy | null = null;
  bossLifeCount = 0;
  spellName = '';

  constructor(private assets: GameAssets, private audio: AudioBus, difficulty = 1) {
    this.difficulty = difficulty;
    this.runtime = new StageRuntime(TH07_DATA.stages[1], {
      etama: assets.anms.etama,
      enemy: assets.anms.stg1enm,
      effect: assets.anms.eff01
    });
    this.playerRunner = new AnmRunner(assets.anms.player00, 0);
  }

  // -- GameHost --------------------------------------------------------------

  addScore(v: number): void {
    this.score += v;
  }

  spawnItem(type: ItemType, x: number, y: number, options: { state?: number; vx?: number; vy?: number } = {}): void {
    this.items.push({
      id: this.id++,
      x, y,
      vx: options.vx ?? 0,
      vy: options.vy ?? -2.2,
      type,
      age: 0,
      state: options.state ?? 0
    });
  }

  spawnEffectParticles(effectId: number, x: number, y: number, count: number, color: number): void {
    // Approximation of the original etama-based effect scripts (documented
    // deviation, to be refined): simple drifting/fading particles.
    const isSnow = effectId >= 18;
    for (let i = 0; i < Math.min(count, 64); i++) {
      const angle = this.rng.range(Math.PI * 2);
      const speed = isSnow ? 0.2 + this.rng.range(0.5) : 0.5 + this.rng.range(2);
      this.particles.push({
        id: this.id++,
        x: x + (isSnow ? this.rng.range(384) - 192 : 0),
        y: y + (isSnow ? this.rng.range(64) - 32 : 0),
        vx: isSnow ? -0.3 - this.rng.range(0.4) : Math.cos(angle) * speed,
        vy: isSnow ? 0.7 + this.rng.range(0.8) : Math.sin(angle) * speed,
        age: 0,
        life: isSnow ? 240 : 24 + this.rng.u32InRange(16),
        color,
        size: isSnow ? 2 + this.rng.range(2) : 3,
        kind: isSnow ? 'snow' : 'spark'
      });
    }
  }

  playSfx(id: number): void {
    // Original SE index mapping (TH07-TODO: verify full table). Index into
    // the se_* files by the original sound ids used in ECL data.
    const SFX_BY_INDEX = [
      'se_plst00', 'se_enep00', 'se_pldead00', 'se_power0', 'se_power1',
      'se_tan00', 'se_tan01', 'se_tan02', 'se_ok00', 'se_cancel00',
      'se_select00', 'se_gun00', 'se_cat00', 'se_lazer00', 'se_lazer01',
      'se_enep01', 'se_nep00', 'se_damage00', 'se_item00', 'se_kira00',
      'se_kira01', 'se_kira02', 'se_extend', 'se_timeout', 'se_graze',
      'se_powerup', 'se_pause', 'se_border', 'se_bonus', 'se_bonus2'
    ];
    const file = SFX_BY_INDEX[id];
    if (file) this.audio.sfx(file);
  }

  startDialogue(index: number): void {
    // M3 stub: dialogue implemented in M6; auto-advance after a short pause.
    this.dialogueActive = true;
    this.dialogueTimer = 90;
  }

  isDialogueBlocking(): boolean {
    return this.dialogueActive;
  }

  consumeDialogueResume(): boolean {
    if (!this.dialogueActive && this.dialogueTimer === -1) {
      this.dialogueTimer = 0;
      return true;
    }
    return false;
  }

  startBossSpell(spellId: number, arg0: number, name: string): void {
    this.spellName = name;
  }

  endBossSpell(): void {
    this.spellName = '';
  }

  setBossPresent(present: boolean, enemy: Enemy | null): void {
    this.bossActive = present ? enemy : null;
  }

  setBossLifeCount(count: number): void {
    this.bossLifeCount = count;
  }

  dropCherryItems(e: Enemy, count: number): void {
    for (let i = 0; i < Math.max(0, count | 0); i++) {
      const x = e.x + this.rng.range(144) - 72;
      const y = e.y + this.rng.range(144) - 72;
      this.spawnItem('cherry', x, y);
    }
  }

  awardSpellValue(value: number): void {
    this.addScore(value);
  }

  spawnEnemyDeathEffect(e: Enemy): void {
    this.spawnEffectParticles(3, e.x, e.y, 12, 0xffffffff);
  }

  turnBulletsIntoPointItems(): void {
    for (const b of this.enemyBullets) {
      this.spawnItem('pointBullet', b.x, b.y, { state: 1 });
    }
    this.enemyBullets.length = 0;
  }

  unpauseStd(): void {
    this.runtime.std.unpause();
  }

  // -- update ----------------------------------------------------------------

  update(input: InputFrame): void {
    this.frame++;
    this.updatePlayerStub(input);
    if (this.dialogueActive) {
      this.dialogueTimer--;
      if (this.dialogueTimer <= 0) {
        this.dialogueActive = false;
        this.dialogueTimer = -1;
      }
    }
    this.runtime.update(this);
    this.updateEnemies();
    this.updateBullets();
    this.updateItems();
    this.updateParticles();
    this.playerRunner.update();
  }

  private updatePlayerStub(input: InputFrame): void {
    this.focusHeld = input.held.has('focus');
    // ReimuA movement values from the original ply00a/ply00as SHT data.
    const speed = this.focusHeld ? 1.6 : 4.0;
    const diag = this.focusHeld ? 1.1313709 : 2.8284273;
    let dx = 0;
    let dy = 0;
    if (input.held.has('left')) dx -= 1;
    if (input.held.has('right')) dx += 1;
    if (input.held.has('up')) dy -= 1;
    if (input.held.has('down')) dy += 1;
    const v = dx !== 0 && dy !== 0 ? diag : speed;
    this.player.x = Math.min(376, Math.max(8, this.player.x + dx * v));
    this.player.y = Math.min(432, Math.max(16, this.player.y + dy * v));
  }

  private updateEnemies(): void {
    for (const e of this.enemies) {
      e.frame++;
      this.runtime.updateEnemy(this, e);
    }
    for (const e of this.enemies) {
      if (e.dead) continue;
      const offscreen = e.x < -64 || e.x > 448 || e.y < -64 || e.y > 512;
      if (offscreen && e.ecl.seen) e.dead = true;
      if (!e.ecl.seen && !offscreen) e.ecl.seen = true;
      if (!e.dead && e.hp <= 0) {
        const keep = this.runtime.killEnemy(this, e);
        if (!keep) e.dead = true;
      }
    }
    let w = 0;
    for (const e of this.enemies) {
      if (!e.dead) this.enemies[w++] = e;
      else this.runtime.releaseEnemy(this, e);
    }
    this.enemies.length = w;
  }

  private updateBullets(): void {
    for (const b of this.enemyBullets) {
      this.updateBulletMotion(b);
      const exActive = (b.flags & (0x40 | 0x80 | 0x100 | 0x400 | 0x800)) !== 0;
      const margin = exActive ? 160 : 32;
      if (b.x < -margin || b.x > 384 + margin || b.y < -margin || b.y > 448 + margin) b.dead = true;
    }
    let w = 0;
    for (const b of this.enemyBullets) if (!b.dead) this.enemyBullets[w++] = b;
    this.enemyBullets.length = w;
  }

  // Bullet ex-behaviors, ported from the TH06 Web implementation with TH07's
  // op-79 field layout: exInts = [?, interval, ?, ?, times], exFloats =
  // [rotation/accel, speed (-999 keeps current)].
  private updateBulletMotion(b: EnemyBullet): void {
    if (b.age < b.spawnDuration) {
      b.x += b.vx * b.spawnMoveScale;
      b.y += b.vy * b.spawnMoveScale;
      b.age++;
      return;
    }
    const age = b.age - b.spawnDuration;
    if (b.flags & 1) {
      if (age <= 16) {
        const extra = 5 - (age * 5) / 16;
        b.vx = Math.cos(b.angle) * (b.speed + extra);
        b.vy = Math.sin(b.angle) * (b.speed + extra);
      } else {
        b.flags ^= 1;
        b.vx = Math.cos(b.angle) * b.speed;
        b.vy = Math.sin(b.angle) * b.speed;
      }
    } else if (b.flags & 0x10) {
      const limit = b.exInts[0] > 0 ? b.exInts[0] : 99999;
      if (age >= limit) b.flags &= ~0x10;
      else {
        const angle = b.exFloats[1] <= -999 ? b.angle : b.exFloats[1];
        const accel = b.exFloats[0] || 0;
        b.vx += Math.cos(angle) * accel;
        b.vy += Math.sin(angle) * accel;
        b.angle = Math.atan2(b.vy, b.vx);
        b.speed = Math.hypot(b.vx, b.vy);
      }
    } else if (b.flags & 0x20) {
      const limit = b.exInts[0] || 0;
      if (age >= limit) b.flags &= ~0x20;
      else {
        b.angle = normalizeAngle(b.angle + (b.exFloats[1] || 0));
        b.speed += b.exFloats[0] || 0;
        b.vx = Math.cos(b.angle) * b.speed;
        b.vy = Math.sin(b.angle) * b.speed;
      }
    }
    if (b.flags & 0x40) this.dirChangeBullet(b, age, 'relative');
    else if (b.flags & 0x100) this.dirChangeBullet(b, age, 'absolute');
    else if (b.flags & 0x80) this.dirChangeBullet(b, age, 'aimed');
    else if (b.flags & 0x400) this.bounceBullet(b, true);
    else if (b.flags & 0x800) this.bounceBullet(b, false);
    b.x += b.vx;
    b.y += b.vy;
    b.age++;
  }

  private dirChangeBullet(b: EnemyBullet, age: number, mode: 'relative' | 'absolute' | 'aimed'): void {
    const interval = Math.max(1, b.exInts[1] | 0);
    const maxTimes = Math.max(1, b.exInts[4] | 0);
    const times = b.dirTimes ?? 0;
    const dirSpeed = b.exFloats[1] >= 0 ? b.exFloats[1] : b.speed;
    let speed: number;
    if (age >= interval * (times + 1)) {
      b.dirTimes = times + 1;
      if (b.dirTimes >= maxTimes) {
        b.flags &= mode === 'relative' ? ~0x40 : mode === 'absolute' ? ~0x100 : ~0x80;
      }
      if (mode === 'relative') b.angle = normalizeAngle(b.angle + b.exFloats[0]);
      else if (mode === 'absolute') b.angle = b.exFloats[0];
      else b.angle = Math.atan2(this.player.y - b.y, this.player.x - b.x) + b.exFloats[0];
      b.speed = dirSpeed;
      speed = b.speed;
    } else {
      speed = b.speed - ((age - interval * times) * b.speed) / interval;
    }
    b.vx = Math.cos(b.angle) * speed;
    b.vy = Math.sin(b.angle) * speed;
  }

  private bounceBullet(b: EnemyBullet, includeBottom: boolean): void {
    if (b.x >= 0 && b.x < 384 && b.y >= 0 && (includeBottom ? b.y < 448 : true)) return;
    const maxTimes = Math.max(1, b.exInts[4] | 0);
    if (b.x < 0 || b.x >= 384) b.angle = normalizeAngle(-b.angle - Math.PI);
    if (b.y < 0 || (includeBottom && b.y >= 448)) b.angle = -b.angle;
    b.speed = b.exFloats[1] >= 0 ? b.exFloats[1] : b.speed;
    b.vx = Math.cos(b.angle) * b.speed;
    b.vy = Math.sin(b.angle) * b.speed;
    b.dirTimes = (b.dirTimes ?? 0) + 1;
    if (b.dirTimes >= maxTimes) b.flags &= includeBottom ? ~0x400 : ~0x800;
  }

  private updateItems(): void {
    for (const it of this.items) {
      it.age++;
      it.vy = Math.min(3, it.vy + 0.03);
      it.x += it.vx;
      it.y += it.vy;
      if (it.y > 480) it.dead = true;
    }
    let w = 0;
    for (const it of this.items) if (!it.dead) this.items[w++] = it;
    this.items.length = w;
  }

  private updateParticles(): void {
    for (const p of this.particles) {
      p.age++;
      p.x += p.vx;
      p.y += p.vy;
      if (p.age >= p.life || p.y > 470) p.age = p.life;
    }
    let w = 0;
    for (const p of this.particles) if (p.age < p.life) this.particles[w++] = p;
    this.particles.length = w;
  }

  // -- draw ------------------------------------------------------------------

  draw(r: Renderer): void {
    r.clear('#101018');
    r.ctx.fillStyle = '#04040c';
    r.ctx.fillRect(PLAYFIELD.x, PLAYFIELD.y, PLAYFIELD.width, PLAYFIELD.height);
    r.clipPlayfield(() => {
      const ox = PLAYFIELD.x;
      const oy = PLAYFIELD.y;
      for (const p of this.particles) {
        const alpha = 1 - p.age / p.life;
        r.ctx.globalAlpha = alpha * 0.8;
        r.ctx.fillStyle = p.kind === 'snow' ? '#cde' : '#fff';
        r.ctx.fillRect(ox + p.x - p.size / 2, oy + p.y - p.size / 2, p.size, p.size);
        r.ctx.globalAlpha = 1;
      }
      for (const e of this.enemies) {
        if (e.ecl.invisible) continue;
        for (const slot of e.ecl.anmSlots) {
          if (slot?.runner) r.drawAnmFrame(slot.runner.spriteFrame(), ox + e.x, oy + e.y);
        }
        const frame = e.ecl.anmRunner?.spriteFrame() ?? null;
        const rotation = e.ecl.anmRotateWithAngle ? e.ecl.angle : undefined;
        r.drawAnmFrame(frame, ox + e.x, oy + e.y, rotation != null ? { rotation } : {});
      }
      for (const b of this.enemyBullets) {
        const spawning = b.age < b.spawnDuration;
        r.drawSprite(b.rect.imageKey, b.rect.x, b.rect.y, b.rect.w, b.rect.h, ox + b.x, oy + b.y, {
          rotation: b.angle + Math.PI / 2,
          scaleMultiplier: spawning ? 1.6 - 0.6 * (b.age / Math.max(1, b.spawnDuration)) : 1,
          alpha: spawning ? 0.6 + 0.4 * (b.age / Math.max(1, b.spawnDuration)) : 1,
          blend: spawning ? 'lighter' : 'source-over'
        });
      }
      for (const it of this.items) {
        r.ctx.fillStyle = ITEM_COLORS[it.type];
        r.ctx.fillRect(ox + it.x - 5, oy + it.y - 5, 10, 10);
        r.ctx.fillStyle = '#fff';
        r.ctx.fillRect(ox + it.x - 5, oy + it.y - 5, 10, 2);
      }
      const pf = this.playerRunner.spriteFrame();
      r.drawAnmFrame(pf, ox + this.player.x, oy + this.player.y);
      if (this.focusHeld) {
        r.ctx.fillStyle = '#fff';
        r.ctx.beginPath();
        r.ctx.arc(ox + this.player.x, oy + this.player.y, 3, 0, Math.PI * 2);
        r.ctx.fill();
        r.ctx.strokeStyle = '#f66';
        r.ctx.stroke();
      }
    });
    // Dev HUD
    r.text(`score ${this.score}`, 432, 60, { size: 13 });
    r.text(`frame ${this.frame}  tl ${this.runtime.mainTimeline.index}/${this.runtime.ecl.timeline.length}`, 432, 80, { size: 11 });
    r.text(`enemies ${this.enemies.length}  bullets ${this.enemyBullets.length}`, 432, 96, { size: 11 });
    r.text(`items ${this.items.length}  difficulty ${['E', 'N', 'H', 'L'][this.difficulty]}`, 432, 112, { size: 11 });
    if (this.bossActive) {
      const hp = this.bossActive.hp;
      const max = Math.max(1, this.bossActive.maxHp);
      r.ctx.fillStyle = '#311';
      r.ctx.fillRect(PLAYFIELD.x + 8, PLAYFIELD.y + 6, PLAYFIELD.width - 16, 6);
      r.ctx.fillStyle = '#e55';
      r.ctx.fillRect(PLAYFIELD.x + 8, PLAYFIELD.y + 6, (PLAYFIELD.width - 16) * Math.max(0, hp / max), 6);
      r.text(`boss hp ${hp}  timer ${Math.trunc(this.bossActive.ecl.bossTimer / 60)}`, 432, 128, { size: 11 });
    }
    if (this.spellName) r.text(this.spellName, PLAYFIELD.x + 8, PLAYFIELD.y + 16, { size: 12, color: '#fca' });
    if (this.dialogueActive) r.text('...dialogue...', PLAYFIELD.x + 120, PLAYFIELD.y + 300, { size: 14, color: '#ada' });
  }
}
