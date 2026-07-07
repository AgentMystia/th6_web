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
import { Player, type CharacterId, type PlayerBullet } from './player';

// Stage host. At the M3 milestone this runs the full stage 1 timeline with a
// movable player stub (no collision yet) so ECL patterns can be verified.

// Item sprites live in etama entry1 (etama2.png); global sprite ids 64+.
const ITEM_SPRITES: Record<ItemType, number> = {
  power: 68,
  point: 69,
  bigPower: 70,
  bomb: 71,
  fullPower: 72,
  life: 73,
  cherry: 76, // pink petal
  bigCherry: 76,
  pointBullet: 77 // cancel-item triangle
};

// Per-frame damage cap for a single enemy, from the TH06 engine family; the
// ECL op 142 parameter appears related but is not yet confirmed (TH07-TODO).
const ENEMY_FRAME_DAMAGE_CAP = 70;

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
  playerObj: Player;
  playerBullets: PlayerBullet[] = [];
  graze = 0;
  pointItems = 0;
  private frameDamage = new Map<number, number>();
  gameOver = false;
  dialogueActive = false;
  private dialogueTimer = 0;
  bossActive: Enemy | null = null;
  bossLifeCount = 0;
  spellName = '';

  constructor(private assets: GameAssets, private audio: AudioBus, difficulty = 1, character: CharacterId = 'reimuA') {
    this.difficulty = difficulty;
    this.runtime = new StageRuntime(TH07_DATA.stages[1], {
      etama: assets.anms.etama,
      enemy: assets.anms.stg1enm,
      effect: assets.anms.eff01
    });
    this.playerObj = new Player(character, assets.anms);
    this.player = this.playerObj;
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
    const p = this.playerObj;
    this.frameDamage.clear();
    if (input.pressed.has('bomb') && p.controllable && !this.gameOver) {
      if (p.tryBomb()) this.onBombUsed();
    }
    p.update(input);
    this.focusHeld = p.focusHeld;
    const death = p.tickDeath();
    if (death === 'died') this.onPlayerDeath();
    if (!this.gameOver) {
      for (const b of p.fire()) {
        this.playerBullets.push(b);
      }
      if (p.shooting && this.frame % 8 === 0) this.playSfx(0);
    }
    if (this.dialogueActive) {
      this.dialogueTimer--;
      if (this.dialogueTimer <= 0) {
        this.dialogueActive = false;
        this.dialogueTimer = -1;
      }
    }
    this.runtime.update(this);
    this.updateEnemies();
    this.updatePlayerBullets();
    this.updateBullets();
    this.checkPlayerCollision();
    this.updateItems();
    this.updateParticles();
    if (p.bombTimer > 0) this.applyBombEffects();
  }

  private onBombUsed(): void {
    this.playSfx(12);
    this.spawnEffectParticles(3, this.playerObj.x, this.playerObj.y, 24, 0xffffffff);
  }

  private applyBombEffects(): void {
    for (const e of this.enemies) {
      if (e.ecl.canTakeDamage && e.ecl.interactable) this.damageEnemy(e, 6);
    }
    if (this.frame % 4 === 0) {
      for (const b of this.enemyBullets) {
        this.spawnItem('pointBullet', b.x, b.y, { state: 1 });
        b.dead = true;
      }
    }
  }

  private onPlayerDeath(): void {
    const p = this.playerObj;
    this.playSfx(2);
    this.spawnEffectParticles(3, p.x, p.y, 32, 0xffffffff);
    for (let i = 0; i < 5; i++) {
      this.spawnItem('power', p.x + this.rng.range(64) - 32, p.y - this.rng.range(32));
    }
    for (const b of this.enemyBullets) b.dead = true;
    p.die();
    if (p.lives < 0) this.gameOver = true;
  }

  damageEnemy(e: Enemy, damage: number): void {
    if (!e.ecl.canTakeDamage || !e.ecl.interactable || e.ecl.invisible) return;
    const done = this.frameDamage.get(e.id) ?? 0;
    const allowed = Math.max(0, ENEMY_FRAME_DAMAGE_CAP - done);
    const applied = Math.min(allowed, damage);
    if (applied <= 0) return;
    this.frameDamage.set(e.id, done + applied);
    e.hp -= applied;
    this.addScore(Math.trunc(applied / 5) * 10);
  }

  private updatePlayerBullets(): void {
    for (const b of this.playerBullets) {
      b.age++;
      if (b.state === 'fired') {
        if (b.shotType === 1) this.steerHomingBullet(b);
        else if (b.shotType === 3 && b.age > 8) {
          // Accelerating shots (MarisaA missiles).
          b.speed = Math.min(14, b.speed + 0.4);
          b.vx = Math.cos(b.angle) * b.speed;
          b.vy = Math.sin(b.angle) * b.speed;
        }
        b.x += b.vx;
        b.y += b.vy;
      } else {
        b.hitAge++;
        if (b.hitAge > 16) b.dead = true;
      }
      if (b.state !== 'fired') continue;
      for (const e of this.enemies) {
        if (!e.ecl.collisionEnabled || !e.ecl.interactable || e.ecl.invisible || e.dead) continue;
        const hw = (e.ecl.hitbox.x + b.hitboxW) / 2;
        const hh = (e.ecl.hitbox.y + b.hitboxH) / 2;
        if (Math.abs(b.x - e.x) <= hw && Math.abs(b.y - e.y) <= hh) {
          this.damageEnemy(e, b.damage);
          if (b.shotType === 4) {
            // Piercing shots (MarisaB laser) pass through.
            b.damage = Math.max(1, Math.trunc(b.damage / 2));
          } else {
            b.state = 'collided';
            b.vx /= 8;
            b.vy /= 8;
          }
          this.playSfx(17);
          break;
        }
      }
      if (b.y < -32 || b.x < -32 || b.x > 416) b.dead = true;
    }
    let w = 0;
    for (const b of this.playerBullets) if (!b.dead) this.playerBullets[w++] = b;
    this.playerBullets.length = w;
  }

  private steerHomingBullet(b: PlayerBullet): void {
    let best: Enemy | null = null;
    let bestDist = 1e9;
    for (const e of this.enemies) {
      if (!e.ecl.interactable || e.ecl.invisible || e.dead || !e.ecl.canTakeDamage) continue;
      const d = (e.x - b.x) ** 2 + (e.y - b.y) ** 2;
      if (d < bestDist) {
        bestDist = d;
        best = e;
      }
    }
    if (!best) return;
    const target = Math.atan2(best.y - b.y, best.x - b.x);
    let diff = target - b.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    const turn = 0.18;
    b.angle += Math.max(-turn, Math.min(turn, diff));
    b.vx = Math.cos(b.angle) * b.speed;
    b.vy = Math.sin(b.angle) * b.speed;
  }

  private checkPlayerCollision(): void {
    const p = this.playerObj;
    if (this.gameOver || !p.alive || p.invulnFrames > 0 || p.bombInvuln > 0) return;
    const px = p.x;
    const py = p.y;
    const hit = p.hitboxHalf;
    for (const b of this.enemyBullets) {
      if (b.dead || b.age < b.spawnDuration) continue;
      const dx = Math.abs(b.x - px);
      const dy = Math.abs(b.y - py);
      if (!b.grazed && dx <= b.grazeW + 16 && dy <= b.grazeH + 16) {
        b.grazed = true;
        this.graze++;
        this.addScore(500);
        this.playSfx(24);
      }
      if (dx <= b.grazeW / 2 + hit && dy <= b.grazeH / 2 + hit) {
        this.onPlayerHit();
        return;
      }
    }
    for (const e of this.enemies) {
      if (!e.ecl.collisionEnabled || !e.ecl.interactable || e.ecl.invisible || e.dead) continue;
      if (Math.abs(e.x - px) <= e.ecl.hitbox.x / 2 + hit && Math.abs(e.y - py) <= e.ecl.hitbox.y / 2 + hit) {
        this.onPlayerHit();
        return;
      }
    }
  }

  private onPlayerHit(): void {
    const result = this.playerObj.hit();
    if (result === 'deathbomb-window') this.playSfx(17);
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
    const p = this.playerObj;
    const sht = p.sht;
    const pocActive = p.alive && (p.power >= 128 && p.y <= sht.pocLineY);
    for (const it of this.items) {
      it.age++;
      if (p.alive && (it.state === 1 || pocActive)) {
        const angle = Math.atan2(p.y - it.y, p.x - it.x);
        it.x += Math.cos(angle) * sht.autocollectSpeed;
        it.y += Math.sin(angle) * sht.autocollectSpeed;
      } else {
        it.vy = Math.min(3, it.vy + 0.03);
        it.x += it.vx;
        it.y += it.vy;
      }
      if (p.alive && Math.abs(it.x - p.x) <= sht.itemRadius && Math.abs(it.y - p.y) <= sht.itemRadius) {
        this.collectItem(it);
      }
      if (it.y > 480) it.dead = true;
    }
    let w = 0;
    for (const it of this.items) if (!it.dead) this.items[w++] = it;
    this.items.length = w;
  }

  private collectItem(it: ItemEntity): void {
    const p = this.playerObj;
    it.dead = true;
    this.playSfx(18);
    switch (it.type) {
      case 'power':
        if (p.power < 128) {
          p.power = Math.min(128, p.power + 1);
          if (p.power === 128) this.turnBulletsIntoPointItems();
        } else {
          this.addScore(12800);
        }
        break;
      case 'bigPower':
        p.power = Math.min(128, p.power + 8);
        break;
      case 'fullPower':
        p.power = 128;
        break;
      case 'point': {
        const full = it.y <= p.sht.pocLineY || it.state === 1;
        this.pointItems++;
        this.addScore(full ? 100000 : Math.max(100, 100000 - Math.trunc(it.y) * 200));
        break;
      }
      case 'pointBullet':
        this.addScore(this.graze * 10 + 500);
        break;
      case 'bomb':
        p.bombs = Math.min(8, p.bombs + 1);
        break;
      case 'life':
        p.lives = Math.min(8, p.lives + 1);
        this.playSfx(22);
        break;
      case 'cherry':
      case 'bigCherry':
        this.addScore(it.type === 'cherry' ? 1000 : 5000);
        break;
    }
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
        const sprite = this.assets.anms.etama.sprites.get(ITEM_SPRITES[it.type]);
        if (sprite) {
          // Items falling above the top edge peek in as arrows (original UX).
          const drawY = Math.max(8, it.y);
          r.drawSprite(sprite.imageKey, sprite.x, sprite.y, sprite.w, sprite.h, ox + it.x, oy + drawY, {
            alpha: it.y < 0 ? 0.55 : 1
          });
        }
      }
      const p = this.playerObj;
      for (const b of this.playerBullets) {
        const fade = b.state === 'collided' ? 1 - b.hitAge / 16 : 0.9;
        r.drawSprite(b.rect.imageKey, b.rect.x, b.rect.y, b.rect.w, b.rect.h, ox + b.x, oy + b.y, {
          rotation: b.angle + Math.PI / 2,
          alpha: Math.max(0, fade),
          scaleMultiplier: b.state === 'collided' ? 1 + b.hitAge / 10 : 1
        });
      }
      // Option orbs (yin-yang, local sprite 128).
      if (p.alive && p.power >= 8) {
        const orbSprite = p.anm.sprites.get(128) ?? p.anm.sprites.get(66);
        if (orbSprite) {
          for (const orb of [1, 2] as const) {
            const off = p.orbOffset(orb);
            r.drawSprite(orbSprite.imageKey, orbSprite.x, orbSprite.y, orbSprite.w, orbSprite.h, ox + p.x + off.x, oy + p.y + off.y, {
              rotation: this.frame * 0.1,
              scaleMultiplier: 0.75
            });
          }
        }
      }
      if (p.alive || p.respawnTimer > 0) {
        const blink = p.invulnFrames > 0 && (this.frame & 2) === 0;
        const pf = p.runner.spriteFrame();
        if (!blink) r.drawAnmFrame(pf, ox + p.x, oy + p.y);
        if (this.focusHeld && p.alive) {
          r.ctx.fillStyle = '#fff';
          r.ctx.beginPath();
          r.ctx.arc(ox + p.x, oy + p.y, p.hitboxHalf + 1.5, 0, Math.PI * 2);
          r.ctx.fill();
          r.ctx.strokeStyle = '#f66';
          r.ctx.stroke();
        }
      }
    });
    // Dev HUD
    r.text(`score ${this.score}`, 432, 60, { size: 13 });
    r.text(`frame ${this.frame}  tl ${this.runtime.mainTimeline.index}/${this.runtime.ecl.timeline.length}`, 432, 80, { size: 11 });
    r.text(`enemies ${this.enemies.length}  bullets ${this.enemyBullets.length}`, 432, 96, { size: 11 });
    r.text(`items ${this.items.length}  difficulty ${['E', 'N', 'H', 'L'][this.difficulty]}`, 432, 112, { size: 11 });
    const p = this.playerObj;
    r.text(`player ${p.lives}  bomb ${p.bombs}  power ${p.power}`, 432, 144, { size: 12, color: '#fda' });
    r.text(`graze ${this.graze}  point ${this.pointItems}`, 432, 160, { size: 11 });
    if (this.gameOver) r.text('GAME OVER', PLAYFIELD.x + 140, PLAYFIELD.y + 200, { size: 20, color: '#f66' });
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
