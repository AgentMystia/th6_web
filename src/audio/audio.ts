import { TH07_DATA } from '../data/th07-data';

// Web Audio bus. BGM tracks loop gaplessly using loopStart/loopEnd sample
// positions taken from the original thbgm.fmt (embedded in TH07_DATA.bgm) —
// an intentional improvement over TH06 Web's whole-file HTMLAudio looping.

interface BgmTrackInfo {
  name: string;
  sampleRate: number;
  loopStartSample: number;
  totalSamples: number;
}

const BGM_VOLUME = 0.65;

export class AudioBus {
  private ctx: AudioContext | null = null;
  private bgmBuffers = new Map<string, AudioBuffer>();
  private bgmLoading = new Map<string, Promise<AudioBuffer | null>>();
  private sfxBuffers = new Map<string, AudioBuffer>();
  private sfxLoading = new Map<string, Promise<AudioBuffer | null>>();
  private bgmSource: AudioBufferSourceNode | null = null;
  private bgmGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  active: string | null = null;
  private pendingBgm: { name: string; fadeMs: number } | null = null;
  unlocked = false;
  muted = false;

  constructor() {
    const unlock = () => {
      this.unlock();
    };
    addEventListener('keydown', unlock, { once: false });
    addEventListener('pointerdown', unlock, { once: false });
  }

  private ensureCtx(): AudioContext | null {
    if (this.ctx) return this.ctx;
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    this.ctx = new Ctor();
    this.bgmGain = this.ctx.createGain();
    this.bgmGain.gain.value = 0;
    this.bgmGain.connect(this.ctx.destination);
    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.value = 1;
    this.sfxGain.connect(this.ctx.destination);
    return this.ctx;
  }

  unlock(): void {
    const ctx = this.ensureCtx();
    if (!ctx) return;
    if (ctx.state === 'suspended') void ctx.resume();
    if (!this.unlocked) {
      this.unlocked = true;
      if (this.pendingBgm) {
        const { name, fadeMs } = this.pendingBgm;
        this.pendingBgm = null;
        this.playBgm(name, { fadeMs });
      }
    }
  }

  private trackInfo(name: string): BgmTrackInfo | null {
    return (TH07_DATA.bgm as readonly BgmTrackInfo[]).find((t) => t.name === name) ?? null;
  }

  private loadBgm(name: string): Promise<AudioBuffer | null> {
    const cached = this.bgmBuffers.get(name);
    if (cached) return Promise.resolve(cached);
    let loading = this.bgmLoading.get(name);
    if (!loading) {
      loading = fetch(`assets/audio/th07/${name}.ogg`)
        .then((r) => r.arrayBuffer())
        .then((buf) => this.ensureCtx()?.decodeAudioData(buf) ?? null)
        .then((decoded) => {
          if (decoded) this.bgmBuffers.set(name, decoded);
          return decoded;
        })
        .catch(() => null);
      this.bgmLoading.set(name, loading);
    }
    return loading;
  }

  preloadBgm(names: string[]): void {
    for (const name of names) void this.loadBgm(name);
  }

  playBgm(name: string | null, options: { fadeMs?: number; restart?: boolean } = {}): void {
    if (name === this.active && this.bgmSource) return;
    if (!name) {
      this.stopBgm();
      return;
    }
    if (!this.unlocked) {
      this.pendingBgm = { name, fadeMs: options.fadeMs ?? 700 };
      this.active = name;
      void this.loadBgm(name);
      return;
    }
    this.active = name;
    void this.loadBgm(name).then((buffer) => {
      if (!buffer || this.active !== name) return;
      const ctx = this.ensureCtx();
      if (!ctx || !this.bgmGain) return;
      this.stopSourceOnly();
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      const info = this.trackInfo(name);
      if (info && info.totalSamples > 0) {
        src.loop = true;
        src.loopStart = info.loopStartSample / info.sampleRate;
        // The decoded buffer length may differ from the PCM table by a few
        // frames of codec padding; clamp to the actual buffer duration.
        src.loopEnd = Math.min(buffer.duration, info.totalSamples / info.sampleRate);
      } else {
        src.loop = true;
      }
      src.connect(this.bgmGain);
      src.start();
      this.bgmSource = src;
      const fadeS = Math.max(0.001, (options.fadeMs ?? 700) / 1000);
      const now = ctx.currentTime;
      this.bgmGain.gain.cancelScheduledValues(now);
      this.bgmGain.gain.setValueAtTime(0, now);
      this.bgmGain.gain.linearRampToValueAtTime(this.muted ? 0 : BGM_VOLUME, now + fadeS);
    });
  }

  private stopSourceOnly(): void {
    if (this.bgmSource) {
      try {
        this.bgmSource.stop();
      } catch {
        // already stopped
      }
      this.bgmSource.disconnect();
      this.bgmSource = null;
    }
  }

  stopBgm(): void {
    this.active = null;
    this.pendingBgm = null;
    this.stopSourceOnly();
  }

  fadeOutBgm(seconds = 4): void {
    const ctx = this.ctx;
    if (!ctx || !this.bgmGain) {
      this.stopBgm();
      return;
    }
    const now = ctx.currentTime;
    this.bgmGain.gain.cancelScheduledValues(now);
    this.bgmGain.gain.setValueAtTime(this.bgmGain.gain.value, now);
    this.bgmGain.gain.linearRampToValueAtTime(0, now + Math.max(0.001, seconds));
    const name = this.active;
    this.active = null;
    setTimeout(() => {
      if (this.active === null || this.active === name) this.stopSourceOnly();
    }, seconds * 1000 + 50);
  }

  private loadSfx(file: string): Promise<AudioBuffer | null> {
    const cached = this.sfxBuffers.get(file);
    if (cached) return Promise.resolve(cached);
    let loading = this.sfxLoading.get(file);
    if (!loading) {
      loading = fetch(`assets/sfx/th07/${file}.wav`)
        .then((r) => r.arrayBuffer())
        .then((buf) => this.ensureCtx()?.decodeAudioData(buf) ?? null)
        .then((decoded) => {
          if (decoded) this.sfxBuffers.set(file, decoded);
          return decoded;
        })
        .catch(() => null);
      this.sfxLoading.set(file, loading);
    }
    return loading;
  }

  preloadSfx(files: string[]): void {
    for (const file of files) void this.loadSfx(file);
  }

  // Plays an original SFX by file stem (e.g. "se_tan00" → assets/sfx/th07/se_tan00.wav).
  sfx(file: string, volume = 1): void {
    if (!this.unlocked || this.muted) {
      void this.loadSfx(file);
      return;
    }
    const buffer = this.sfxBuffers.get(file);
    if (!buffer) {
      void this.loadSfx(file);
      return;
    }
    const ctx = this.ensureCtx();
    if (!ctx || !this.sfxGain) return;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    if (volume >= 1) {
      src.connect(this.sfxGain);
    } else {
      const gain = ctx.createGain();
      gain.gain.value = Math.max(0, volume);
      src.connect(gain);
      gain.connect(this.sfxGain);
    }
    src.start();
  }
}
