import { Sht, type ShtShot } from '../formats/sht';
import { Anm, AnmRunner } from '../formats/anm';
import { TH07_DATA } from '../data/th07-data';
import { clamp } from '../core/util';
import type { InputFrame } from '../core/input';

// Player implementation driven by the original ply*.sht data files: movement
// speeds, hitbox, item radii, PoC line, and the per-power shooter tables all
// come from the game data. Bomb behavior is a functionally-accurate first
// pass (damage/duration/invulnerability), visuals to be refined.

export type CharacterId = 'reimuA' | 'reimuB' | 'marisaA' | 'marisaB' | 'sakuyaA' | 'sakuyaB';

export const CHARACTERS: Record<CharacterId, { family: 0 | 1 | 2; name: string; shtBase: string; anmKey: 'player00' | 'player01' | 'player02' }> = {
  // The deathbomb window (frames you may still bomb after being hit before
  // actually dying) is read from each character's .sht data (deathbombWindow,
  // int32 at header offset 8) rather than hardcoded here: it's 15 for Reimu,
  // 8 for Marisa, 6 for Sakuya, matching independently-documented PCB values.
  reimuA: { family: 0, name: 'Reimu A', shtBase: 'ply00a', anmKey: 'player00' },
  reimuB: { family: 0, name: 'Reimu B', shtBase: 'ply00b', anmKey: 'player00' },
  marisaA: { family: 1, name: 'Marisa A', shtBase: 'ply01a', anmKey: 'player01' },
  marisaB: { family: 1, name: 'Marisa B', shtBase: 'ply01b', anmKey: 'player01' },
  sakuyaA: { family: 2, name: 'Sakuya A', shtBase: 'ply02a', anmKey: 'player02' },
  sakuyaB: { family: 2, name: 'Sakuya B', shtBase: 'ply02b', anmKey: 'player02' }
};

// The game assigns the player ANM a sprite-id base of 1024; SHT sprite
// fields are global ids (1088+ = local sprite 64+).
export const PLAYER_SPRITE_BASE = 1024;

export interface PlayerBullet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  speed: number;
  damage: number;
  shotType: number;
  hitboxW: number;
  hitboxH: number;
  sfxId: number; // from ShtShot.sfxId; playback not wired up (stage-scene.ts uses a fixed fire sound instead)
  age: number;
  state: 'fired' | 'collided';
  hitAge: number;
  rect: { x: number; y: number; w: number; h: number; imageKey: string };
  dead?: boolean;
}

// Option (orb) offsets relative to the player; fire origins for orb shots.
//
// Th07.exe (v1.00b) Player::Update (fcn.0043be00 @ 0x43be00) drives a glide
// state machine at player+0x2410. Unfocused (settled) offsets are CONFIRMED
// exe-hardcoded immediates from that machine's terminal "case 3" state:
// orb 1 x=-32.0 @ 0x43cb30, y=8.0 @ 0x43cb29; orb 2 mirrors orb 1 across x
// (this codebase's existing left/right symmetry convention). Note the y
// sign: +8 (below the player), not -8 as previously guessed here.
//
// The exe's focused layout is NOT a static offset at all: options
// continuously orbit the player on a radius-24.0 circle (fmul by 0x48ec78
// = 24.0 @ 0x43ce2d and 0x43ce59, confirmed), phase-shifted by pi/2 (fadd
// 0x48eaec = 1.5708 @ 0x43ce16 and 0x43ce42, confirmed), driven by a
// per-frame angle (player+0xb7e58) whose increment site was not located
// within this function -- so the rotation rate and orb 2's phase offset
// are NOT confirmed. We keep a static focused approximation below pending
// that follow-up (see ghidra-re-notes.md, Target A).
const ORB_OFFSETS = {
  unfocused: { 1: { x: -32, y: 8 }, 2: { x: 32, y: 8 } },
  focused: { 1: { x: -16, y: -24 }, 2: { x: 16, y: -24 } }
} as const;

// Frames to glide between the unfocused/focused layouts on a focus-state
// change, and the interpolation formula, both CONFIRMED directly from the
// exe's tween state machine (fcn.0043be00 @ 0x43ca0b-0x43ca56): x eases
// LINEARLY in t while y eases QUADRATICALLY in t*t -- the two axes use
// different easing. t = frame / GLIDE_FRAMES, with an internal frame
// counter compared against 8 @ 0x43ca61 (fdiv by 0x48eacc = 8.0 @
// 0x43ca1d). The live instance decoded had fromY=24/toY=8, producing
// exactly y = 24 - 16*t*t (fmul 0x48ead4=32.0 @ 0x43ca2f, fadd
// 0x48ed44=-32.0 @ 0x43ca35 for x; fmul 0x48ed68=-16.0 @ 0x43ca4d, fadd
// 0x48ec78=24.0 @ 0x43ca50 for y) -- i.e. lerp(fromX,toX,t) and
// lerp(fromY,toY,t*t) in general.
const GLIDE_FRAMES = 8;

// PCB's shot cadence runs on a 60-frame cycle (Priw8's sht-webedit docs:
// "PCB - shooting uses a 60-frame timer. For bullets to fire consistently,
// choose a fire_rate that is a factor of 60"), not the 30-frame cycle used
// by the TH06 engine family. shot.interval/shot.delay are frame counts
// within that cycle.
const SHOT_CYCLE = 60;

export class Player {
  x = 192;
  y = 432;
  readonly character: CharacterId;
  readonly unfocused: Sht;
  readonly focused: Sht;
  readonly anm: Anm;
  focusHeld = false;
  // Frames elapsed since the last focus-state toggle, saturating at
  // GLIDE_FRAMES once the orb glide has settled; see orbOffset().
  private focusGlideFrame = GLIDE_FRAMES;
  shooting = false;
  // -1 while not shooting so that the first held frame lands on fireFrame 0
  // (see update()): a shot with delay 0 must fire on the very press frame,
  // not "interval" frames later.
  fireFrame = -1;
  bullets: PlayerBullet[] = [];
  lives = 2;
  bombs = 3;
  power = 0;
  invulnFrames = 0;
  deathTimer = -1; // counts down the deathbomb window when hit
  respawnTimer = 0;
  bombTimer = 0;
  bombInvuln = 0;
  runner: AnmRunner;
  private poseState: 'idle' | 'left' | 'right' = 'idle';

  constructor(character: CharacterId, anms: Record<string, Anm>) {
    this.character = character;
    const spec = CHARACTERS[character];
    const sht = TH07_DATA.sht as Record<string, string>;
    this.unfocused = new Sht(sht[spec.shtBase]);
    this.focused = new Sht(sht[`${spec.shtBase}s`]);
    this.anm = anms[spec.anmKey];
    this.bombs = Math.trunc(this.unfocused.bombs);
    this.runner = new AnmRunner(this.anm, 0);
  }

  get sht(): Sht {
    return this.focusHeld ? this.focused : this.unfocused;
  }

  get hitboxHalf(): number {
    return this.sht.hitbox;
  }

  get grazeboxHalf(): number {
    return this.sht.grazebox;
  }

  get alive(): boolean {
    return this.deathTimer < 0 && this.respawnTimer <= 0;
  }

  get controllable(): boolean {
    return this.deathTimer < 0;
  }

  update(input: InputFrame): void {
    const focused = input.held.has('focus');
    if (focused !== this.focusHeld) {
      this.focusHeld = focused;
      this.focusGlideFrame = 0;
    } else if (this.focusGlideFrame < GLIDE_FRAMES) {
      this.focusGlideFrame++;
    }
    if (this.invulnFrames > 0) this.invulnFrames--;
    if (this.bombInvuln > 0) this.bombInvuln--;
    if (this.bombTimer > 0) this.bombTimer--;
    if (this.respawnTimer > 0) {
      this.respawnTimer--;
      this.y = Math.min(432, this.y - 1.5); // fly in from the bottom
    }
    if (this.controllable && this.respawnTimer <= 0) this.move(input);
    this.shooting = input.held.has('shoot') && this.controllable;
    if (this.shooting) {
      this.fireFrame = (this.fireFrame + 1) % SHOT_CYCLE;
    } else {
      this.fireFrame = -1;
    }
    this.updatePose(input);
    this.runner.update();
  }

  private move(input: InputFrame): void {
    const sht = this.sht;
    let dx = 0;
    let dy = 0;
    if (input.held.has('left')) dx -= 1;
    if (input.held.has('right')) dx += 1;
    if (input.held.has('up')) dy -= 1;
    if (input.held.has('down')) dy += 1;
    const diagonal = dx !== 0 && dy !== 0;
    const speed = diagonal
      ? (this.focusHeld ? sht.diagFocusedSpeed : sht.diagSpeed)
      : (this.focusHeld ? sht.focusedSpeed : sht.speed);
    this.x = clamp(this.x + dx * speed, 8, 376);
    this.y = clamp(this.y + dy * speed, 16, 432);
  }

  private updatePose(input: InputFrame): void {
    const movingLeft = input.held.has('left') && !input.held.has('right');
    const movingRight = input.held.has('right') && !input.held.has('left');
    const pose = movingLeft ? 'left' : movingRight ? 'right' : 'idle';
    if (pose === this.poseState) return;
    this.poseState = pose;
    // playerXX.anm scripts: 0 idle, 1 bank left, 2 bank right.
    const script = pose === 'left' ? 1 : pose === 'right' ? 2 : 0;
    if (this.anm.hasScript(script)) this.runner = new AnmRunner(this.anm, script);
  }

  // Fires shooter entries whose cadence matches this frame; called once per
  // frame while the shoot button is held.
  orbOffset(orb: 1 | 2): { x: number; y: number } {
    const to = ORB_OFFSETS[this.focusHeld ? 'focused' : 'unfocused'][orb];
    if (this.focusGlideFrame >= GLIDE_FRAMES) return to;
    const from = ORB_OFFSETS[this.focusHeld ? 'unfocused' : 'focused'][orb];
    const t = this.focusGlideFrame / GLIDE_FRAMES;
    return { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t * t };
  }

  fire(): PlayerBullet[] {
    if (!this.shooting || !this.alive) return [];
    const out: PlayerBullet[] = [];
    for (const shot of this.sht.shotsForPower(this.power)) {
      const interval = Math.max(1, shot.interval);
      if (this.fireFrame % interval !== shot.delay % interval) continue;
      const rect = this.anm.sprites.get(shot.sprite - PLAYER_SPRITE_BASE) ?? this.anm.sprites.get(64);
      if (!rect) continue;
      const source = shot.orb === 1 || shot.orb === 2 ? this.orbOffset(shot.orb) : { x: 0, y: 0 };
      out.push({
        x: this.x + source.x + shot.x,
        y: this.y + source.y + shot.y,
        vx: Math.cos(shot.angle) * shot.speed,
        vy: Math.sin(shot.angle) * shot.speed,
        angle: shot.angle,
        speed: shot.speed,
        damage: shot.damage,
        shotType: shot.shotType,
        hitboxW: shot.hitboxW,
        hitboxH: shot.hitboxH,
        sfxId: shot.sfxId,
        age: 0,
        state: 'fired',
        hitAge: 0,
        rect: { x: rect.x, y: rect.y, w: rect.w, h: rect.h, imageKey: rect.imageKey }
      });
    }
    return out;
  }

  hit(): 'deathbomb-window' | 'invulnerable' {
    if (this.invulnFrames > 0 || this.bombInvuln > 0 || this.deathTimer >= 0) return 'invulnerable';
    this.deathTimer = Math.trunc(this.unfocused.deathbombWindow);
    return 'deathbomb-window';
  }

  // Returns 'died' when the deathbomb window expires without a bomb.
  tickDeath(): 'died' | 'pending' | 'none' {
    if (this.deathTimer < 0) return 'none';
    this.deathTimer--;
    if (this.deathTimer < 0) return 'died';
    return 'pending';
  }

  tryBomb(): boolean {
    if (this.bombs <= 0 || this.bombTimer > 0) return false;
    this.bombs--;
    this.deathTimer = -1; // deathbomb rescue
    // Functional first pass: family-appropriate duration and invulnerability.
    const family = CHARACTERS[this.character].family;
    const duration = family === 1 ? 300 : 250;
    this.bombTimer = duration;
    this.bombInvuln = duration + 60;
    return true;
  }

  die(): void {
    this.deathTimer = -1;
    this.lives--;
    this.bombs = Math.trunc(this.unfocused.bombs);
    this.power = Math.max(0, this.power - 16);
    this.invulnFrames = 240;
    this.respawnTimer = 30;
    this.x = 192;
    this.y = 448 + 16;
    this.bullets.length = 0;
  }
}
