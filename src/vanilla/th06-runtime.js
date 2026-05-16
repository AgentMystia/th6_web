(function () {
  const TH06_GLOBAL = typeof window !== 'undefined' ? window : globalThis;
  const TH06_LOGIC = TH06_GLOBAL.TH06Logic;
  if (!TH06_LOGIC) throw new Error('TH06Logic source tables must be loaded before th06-runtime.js');
  const TAU = Math.PI * 2;
  const DEG = Math.PI / 180;
  const ANGLE_EPSILON = 1e-6;
  const ENEMY_BULLET_CAP = TH06_LOGIC.ENEMY_BULLET_CAP ?? 640;
  const ITEM_TABLE = ['power', 'point', 'bigPower', 'bomb', 'fullPower', 'life', 'point'];
  const RANDOM_ITEMS = [
    'power', 'power', 'point', 'power', 'point', 'power', 'power', 'point',
    'point', 'point', 'power', 'power', 'power', 'point', 'point', 'power',
    'point', 'power', 'point', 'power', 'point', 'power', 'point', 'power',
    'point', 'power', 'power', 'point', 'point', 'point', 'power', 'bigPower'
  ];
  const EFFECT_SCRIPT_TABLE = [
    3, 4, 5, 6, 9, 10, 11, 12, 13, 14,
    15, 16, 17, 18, 18, 18, 0, 7, 8, 19
  ];
  const EFFECT_CALLBACK_TABLE = [
    'none', 'none', 'none', 'randomSplashBig', 'randomSplash', 'randomSplash',
    'randomSplash', 'randomSplash', 'randomSplash', 'randomSplash', 'randomSplash',
    'randomSplash', 'none', 'orbit', 'orbit', 'orbit', 'none', 'attract',
    'attractSlow', 'still'
  ];
  const EFFECT_LIFE_TABLE = [
    22, 18, 26, 24, 32, 32, 32, 32, 32, 32,
    32, 32, 44, 3600, 3600, 3600, 3600, 64, 244, 124
  ];
  const BULLET_SPAWN_EFFECTS = [
    { fast: 14, normal: 15, slow: 16, imageKey: 'etama3' },
    { fast: 17, normal: 18, slow: 19, imageKey: 'etama3' },
    { fast: 17, normal: 18, slow: 19, imageKey: 'etama3' },
    { fast: 17, normal: 18, slow: 19, imageKey: 'etama3' },
    { fast: 17, normal: 18, slow: 19, imageKey: 'etama3' },
    { fast: 17, normal: 18, slow: 19, imageKey: 'etama3' },
    { fast: 20, normal: 20, slow: 20, imageKey: 'etama3' },
    { fast: 20, normal: 20, slow: 20, imageKey: 'etama3' },
    { fast: 20, normal: 20, slow: 20, imageKey: 'etama3' },
    { fast: 2, normal: 2, slow: 2, imageKey: 'etama4' }
  ];

  function clamp(v, min, max) {
    return Math.min(max, Math.max(min, v));
  }

  function normalizeAngle(v) {
    if (Math.abs(v - Math.PI) <= ANGLE_EPSILON) return Math.PI;
    if (Math.abs(v + Math.PI) <= ANGLE_EPSILON) return -Math.PI;
    while (v < -Math.PI) v += TAU;
    while (v > Math.PI) v -= TAU;
    return v;
  }

  function rngU16InRange(rng, range) {
    const span = Math.max(0, range | 0);
    if (!span) return 0;
    if (typeof rng.u16InRange === 'function') return rng.u16InRange(span);
    if (typeof rng.u16 === 'function') return rng.u16() % span;
    return Math.trunc(rng.range(span));
  }

  function rngU32InRange(rng, range) {
    const span = Math.max(0, range | 0);
    if (!span) return 0;
    if (typeof rng.u32InRange === 'function') return rng.u32InRange(span);
    if (typeof rng.u32 === 'function') return rng.u32() % span;
    return Math.trunc(rng.range(span));
  }

  function eclDifficultyIndex(game) {
    return TH06_LOGIC.difficultyIndex(game?.difficulty ?? TH06_LOGIC.DEFAULT_DIFFICULTY);
  }

  function bytesFromBase64(b64) {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  }

  class BinaryView {
    constructor(b64) {
      this.bytes = typeof b64 === 'string' ? bytesFromBase64(b64) : b64;
      this.dv = new DataView(this.bytes.buffer, this.bytes.byteOffset, this.bytes.byteLength);
    }
    i8(o) { return this.dv.getInt8(o); }
    u8(o) { return this.dv.getUint8(o); }
    i16(o) { return this.dv.getInt16(o, true); }
    u16(o) { return this.dv.getUint16(o, true); }
    i32(o) { return this.dv.getInt32(o, true); }
    u32(o) { return this.dv.getUint32(o, true); }
    f32(o) { return this.dv.getFloat32(o, true); }
  }

  class Th06Anm {
    constructor(b64) {
      this.view = new BinaryView(b64);
      this.sprites = new Map();
      this.scripts = new Map();
      this.parse();
    }
    parse() {
      const v = this.view;
      const spriteCount = v.i32(0);
      const scriptCount = v.i32(4);
      let ptr = 64;
      for (let i = 0; i < spriteCount; i++) {
        const off = v.u32(ptr + i * 4);
        const id = v.u32(off);
        this.sprites.set(id, {
          id,
          x: v.f32(off + 4),
          y: v.f32(off + 8),
          w: v.f32(off + 12),
          h: v.f32(off + 16)
        });
      }
      ptr += spriteCount * 4;
      for (let i = 0; i < scriptCount; i++) {
        this.scripts.set(v.u32(ptr + i * 8), v.u32(ptr + i * 8 + 4));
      }
    }
    scriptFrame(scriptId, offset = 0, frame = 0, options = {}) {
      let off = this.scripts.get(scriptId);
      if (off == null) return null;
      const scriptStart = off;
      let interruptLabelOff = null;
      if (options.interrupt != null) {
        const label = this.interruptLabel(scriptId, options.interrupt);
        if (label) {
          interruptLabelOff = label.off;
          frame = label.time + (options.interruptFrame ?? 0);
        }
      }
      const vm = {
        frame,
        visible: false,
        flipX: false,
        flipY: false,
        anchorTopLeft: false,
        usePosOffset: false,
        autoRotate: false,
        blendAdd: false,
        x: 0,
        y: 0,
        posOffsetX: 0,
        posOffsetY: 0,
        scaleX: 1,
        scaleY: 1,
        scaleSpeedX: 0,
        scaleSpeedY: 0,
        rotationX: 0,
        rotationY: 0,
        rotationZ: 0,
        angleVelX: 0,
        angleVelY: 0,
        angleVelZ: 0,
        lastAdvanceTime: 0,
        alpha: ((options.color ?? 0xffffffff) >>> 24) & 0xff,
        color: options.color ?? 0xffffffff,
        fade: null,
        posInterp: null,
        scaleInterp: null,
        rect: null,
        done: false
      };
      const advanceLinear = (targetTime) => {
        const dt = targetTime - vm.lastAdvanceTime;
        if (dt <= 0) return;
        if (!vm.scaleInterp) {
          vm.scaleX += vm.scaleSpeedX * dt;
          vm.scaleY += vm.scaleSpeedY * dt;
        }
        if (vm.angleVelX) vm.rotationX = normalizeAngle(vm.rotationX + vm.angleVelX * dt);
        if (vm.angleVelY) vm.rotationY = normalizeAngle(vm.rotationY + vm.angleVelY * dt);
        if (vm.angleVelZ) vm.rotationZ = normalizeAngle(vm.rotationZ + vm.angleVelZ * dt);
        vm.lastAdvanceTime = targetTime;
      };
      let autoRotate = false;
      for (let guard = 0; guard < 160 && off + 4 < this.view.bytes.length; guard++) {
        const time = this.view.i16(off);
        const op = this.view.u8(off + 2);
        const argsCount = this.view.u8(off + 3);
        if (time > frame && vm.rect) break;
        if (op === 0) {
          vm.done = time <= frame;
          if (!options.keepExitSprite || !vm.rect) vm.visible = false;
          break;
        }
        if (op === 15) {
          vm.done = time <= frame;
          break;
        }
        const arg = off + 4;
        advanceLinear(time);
        if (op === 1 || op === 16) {
          let spriteId = this.view.i32(arg);
          if (op === 16) {
            const range = Math.max(1, this.view.i32(arg + 4));
            spriteId += (options.randomIndex ?? 0) % range;
          }
          const rect = this.sprites.get(spriteId + offset);
          if (rect) {
            vm.rect = rect;
            vm.visible = true;
          }
        }
        else if (op === 2) {
          vm.scaleX = this.view.f32(arg);
          vm.scaleY = this.view.f32(arg + 4);
          vm.scaleSpeedX = 0;
          vm.scaleSpeedY = 0;
        } else if (op === 3) {
          vm.alpha = this.view.i32(arg) & 0xff;
          vm.color = (vm.color & 0x00ffffff) | (vm.alpha << 24);
        } else if (op === 4) {
          vm.color = (vm.color & 0xff000000) | (this.view.u32(arg) & 0x00ffffff);
        } else if (op === 5) {
          const jumpOff = scriptStart + this.view.i32(arg);
          if (jumpOff < off) {
            if (interruptLabelOff == null || off >= interruptLabelOff) break;
          } else {
            off = jumpOff;
            continue;
          }
        } else if (op === 7) {
          vm.flipX = !vm.flipX;
          vm.scaleX *= -1;
        } else if (op === 8) {
          vm.flipY = !vm.flipY;
          vm.scaleY *= -1;
        } else if (op === 9) {
          vm.rotationX = this.view.f32(arg);
          vm.rotationY = this.view.f32(arg + 4);
          vm.rotationZ = this.view.f32(arg + 8);
        } else if (op === 10) {
          vm.angleVelX = this.view.f32(arg);
          vm.angleVelY = this.view.f32(arg + 4);
          vm.angleVelZ = this.view.f32(arg + 8);
        } else if (op === 11) {
          vm.scaleSpeedX = this.view.f32(arg);
          vm.scaleSpeedY = this.view.f32(arg + 4);
          vm.scaleInterp = null;
        } else if (op === 12) {
          vm.fade = {
            from: vm.alpha,
            to: this.view.i32(arg) & 0xff,
            duration: Math.max(1, this.view.i32(arg + 4)),
            start: time
          };
        } else if (op === 13) {
          vm.blendAdd = true;
        } else if (op === 14) {
          vm.blendAdd = false;
        } else if (op === 17) {
          if (vm.usePosOffset) {
            vm.posOffsetX = this.view.f32(arg);
            vm.posOffsetY = this.view.f32(arg + 4);
          } else {
            vm.x = this.view.f32(arg);
            vm.y = this.view.f32(arg + 4);
          }
        } else if (op >= 18 && op <= 20) {
          const initial = vm.usePosOffset ? { x: vm.posOffsetX, y: vm.posOffsetY } : { x: vm.x, y: vm.y };
          vm.posInterp = {
            useOffset: vm.usePosOffset,
            mode: op,
            start: time,
            duration: Math.max(1, this.view.i32(arg + 12)),
            fromX: initial.x,
            fromY: initial.y,
            toX: this.view.f32(arg),
            toY: this.view.f32(arg + 4)
          };
        } else if (op === 21 || op === 24) {
          if (op === 24) vm.visible = false;
          break;
        } else if (op === 23) {
          vm.anchorTopLeft = true;
        } else if (op === 25) {
          vm.usePosOffset = !!this.view.i32(arg);
        } else if (op === 26) {
          autoRotate = this.view.i32(arg);
          vm.autoRotate = autoRotate;
        } else if (op === 29) {
          vm.visible = !!this.view.i32(arg);
        } else if (op === 30) {
          vm.scaleInterp = {
            start: time,
            duration: Math.max(1, this.view.u16(arg + 8)),
            fromX: vm.scaleX,
            fromY: vm.scaleY,
            toX: this.view.f32(arg),
            toY: this.view.f32(arg + 4)
          };
        }
        off += 4 + argsCount;
      }
      if (!vm.rect || !vm.visible) return null;
      advanceLinear(frame);
      if (vm.fade) {
        const t = clamp((frame - vm.fade.start) / vm.fade.duration, 0, 1);
        vm.alpha = Math.round(vm.fade.from + (vm.fade.to - vm.fade.from) * t);
        vm.color = (vm.color & 0x00ffffff) | (vm.alpha << 24);
      }
      if (vm.scaleInterp) {
        const t = clamp((frame - vm.scaleInterp.start) / vm.scaleInterp.duration, 0, 1);
        vm.scaleX = vm.scaleInterp.fromX + (vm.scaleInterp.toX - vm.scaleInterp.fromX) * t;
        vm.scaleY = vm.scaleInterp.fromY + (vm.scaleInterp.toY - vm.scaleInterp.fromY) * t;
      }
      if (vm.posInterp) {
        let t = clamp((frame - vm.posInterp.start) / vm.posInterp.duration, 0, 1);
        if (vm.posInterp.mode === 19) t = 1 - (1 - t) * (1 - t);
        else if (vm.posInterp.mode === 20) t = 1 - Math.pow(1 - t, 4);
        const x = vm.posInterp.fromX + (vm.posInterp.toX - vm.posInterp.fromX) * t;
        const y = vm.posInterp.fromY + (vm.posInterp.toY - vm.posInterp.fromY) * t;
        if (vm.posInterp.useOffset) {
          vm.posOffsetX = x;
          vm.posOffsetY = y;
        } else {
          vm.x = x;
          vm.y = y;
        }
      }
      return {
        ...vm.rect,
        flipX: vm.flipX,
        flipY: vm.flipY,
        autoRotate,
        anchorTopLeft: vm.anchorTopLeft,
        blendAdd: vm.blendAdd,
        scaleX: vm.scaleX,
        scaleY: vm.scaleY,
        rotation: vm.rotationZ,
        rotationX: vm.rotationX,
        rotationY: vm.rotationY,
        rotationZ: vm.rotationZ,
        color: vm.color >>> 0,
        alpha: vm.alpha,
        vmX: vm.x,
        vmY: vm.y,
        posOffsetX: vm.posOffsetX,
        posOffsetY: vm.posOffsetY,
        done: vm.done
      };
    }
    scriptSprite(scriptId, offset = 0, frame = 0, options = {}) {
      return this.scriptFrame(scriptId, offset, frame, options);
    }
    scriptDuration(scriptId) {
      let off = this.scripts.get(scriptId);
      if (off == null) return 0;
      const scriptStart = off;
      let lastTime = 0;
      const seen = new Set();
      for (let guard = 0; guard < 220 && off + 4 < this.view.bytes.length; guard++) {
        if (seen.has(off)) break;
        seen.add(off);
        const time = this.view.i16(off);
        const op = this.view.u8(off + 2);
        const argsCount = this.view.u8(off + 3);
        lastTime = Math.max(lastTime, time);
        if (op === 0 || op === 15 || op === 21 || op === 24) return Math.max(0, time);
        if (op === 5) {
          const jumpOff = scriptStart + this.view.i32(off + 4);
          if (jumpOff > off) {
            off = jumpOff;
            continue;
          }
          break;
        }
        off += 4 + argsCount;
      }
      return Math.max(0, lastTime);
    }
    interruptOffset(scriptId, interrupt) {
      const label = this.interruptLabel(scriptId, interrupt);
      if (!label) return null;
      return label.off + 4 + label.argsCount;
    }
    interruptLabel(scriptId, interrupt) {
      let off = this.scripts.get(scriptId);
      if (off == null) return null;
      for (let guard = 0; guard < 180 && off + 4 < this.view.bytes.length; guard++) {
        const op = this.view.u8(off + 2);
        const argsCount = this.view.u8(off + 3);
        if (op === 22 && this.view.i32(off + 4) === interrupt) {
          return { off, argsCount, time: this.view.i16(off) };
        }
        if (op === 0 || op === 15) break;
        off += 4 + argsCount;
      }
      return null;
    }
  }

  class Th06Std {
    constructor(stdB64, anmB64) {
      this.view = new BinaryView(stdB64);
      this.anm = new Th06Anm(anmB64);
      this.objects = [];
      this.instances = [];
      this.cameraKeys = [];
      this.pauseFrames = new Set();
      this.frame = 0;
      this.unpauseRequested = false;
      const defaultFog = { frame: 0, color: 0xff100020, r: 16, g: 0, b: 32, near: 200, far: 500 };
      const defaultFacing = { frame: 0, x: 0, y: 0, z: 1 };
      this.fogKeys = [defaultFog];
      this.fogEvents = [{ frame: 0, start: defaultFog, target: defaultFog, duration: 0 }];
      this.facingKeys = [defaultFacing];
      this.facingEvents = [{ frame: 0, start: defaultFacing, target: defaultFacing, duration: 0 }];
      this.parse();
    }
    parse() {
      const v = this.view;
      this.objectCount = v.i16(0);
      this.faceOffset = v.i32(4);
      this.scriptOffset = v.i32(8);
      for (let i = 0; i < this.objectCount; i++) this.objects.push(this.parseObject(v.i32(0x490 + i * 4)));
      for (let off = this.faceOffset, guard = 0; off + 16 <= v.bytes.length && guard < 2048; off += 16, guard++) {
        const id = v.i16(off);
        if (id < 0) break;
        this.instances.push({
          id,
          x: v.f32(off + 4),
          y: v.f32(off + 8),
          z: v.f32(off + 12)
        });
      }
      let currentFog = this.fogEvents[0].target;
      let currentFacing = this.facingEvents[0].target;
      let pendingFogDuration = 0;
      let pendingFacingDuration = 0;
      for (let off = this.scriptOffset, guard = 0; off + 20 <= v.bytes.length && guard < 256; off += 20, guard++) {
        const frame = v.i32(off);
        const op = v.i16(off + 4);
        if (frame === -1 && op === -1) break;
        const key = { frame, op, x: v.f32(off + 8), y: v.f32(off + 12), z: v.f32(off + 16), i0: v.i32(off + 8) };
        if (op === 0) this.cameraKeys.push(key);
        else if (op === 1) {
          const color = key.i0 >>> 0;
          const target = {
            frame: Math.max(0, frame),
            color,
            r: (color >> 16) & 0xff,
            g: (color >> 8) & 0xff,
            b: color & 0xff,
            near: key.y,
            far: key.z
          };
          this.fogKeys.push(target);
          this.fogEvents.push({
            frame: Math.max(0, frame),
            start: currentFog,
            target,
            duration: Math.max(0, pendingFogDuration | 0)
          });
          currentFog = target;
          pendingFogDuration = 0;
        }
        else if (op === 2) {
          const target = { frame: Math.max(0, frame), x: key.x, y: key.y, z: key.z };
          this.facingKeys.push(target);
          this.facingEvents.push({
            frame: Math.max(0, frame),
            start: currentFacing,
            target,
            duration: Math.max(0, pendingFacingDuration | 0)
          });
          currentFacing = target;
          pendingFacingDuration = 0;
        }
        else if (op === 3) pendingFacingDuration = Math.max(0, key.i0 | 0);
        else if (op === 4) pendingFogDuration = Math.max(0, key.i0 | 0);
        else if (op === 5) this.pauseFrames.add(Math.max(0, frame));
      }
      this.cameraKeys.sort((a, b) => a.frame - b.frame);
      this.fogKeys.sort((a, b) => a.frame - b.frame);
      this.fogEvents.sort((a, b) => a.frame - b.frame);
      this.facingEvents.sort((a, b) => a.frame - b.frame);
    }
    reset() {
      this.frame = 0;
      this.unpauseRequested = false;
    }
    unpause() {
      this.unpauseRequested = true;
    }
    advance() {
      if (this.pauseFrames.has(this.frame) && !this.unpauseRequested) return;
      this.unpauseRequested = false;
      this.frame++;
    }
    parseObject(off) {
      const v = this.view;
      const obj = {
        id: v.i16(off),
        zLevel: v.i8(off + 2),
        flags: v.i8(off + 3),
        x: v.f32(off + 4),
        y: v.f32(off + 8),
        z: v.f32(off + 12),
        w: v.f32(off + 16),
        h: v.f32(off + 20),
        d: v.f32(off + 24),
        quads: []
      };
      let q = off + 28;
      for (let guard = 0; q + 28 <= v.bytes.length && guard < 256; guard++) {
        const type = v.i16(q);
        if (type < 0) break;
        const size = v.i16(q + 2);
        obj.quads.push({
          type,
          script: v.i16(q + 4),
          x: v.f32(q + 8),
          y: v.f32(q + 12),
          z: v.f32(q + 16),
          w: v.f32(q + 20),
          h: v.f32(q + 24)
        });
        if (size <= 0) break;
        q += size;
      }
      return obj;
    }
    camera(frame) {
      let prev = this.cameraKeys[0] || { frame: 0, x: 0, y: 0, z: 0 };
      let next = null;
      for (const key of this.cameraKeys) {
        if (key.frame >= 0 && key.frame <= frame) prev = key;
        if (key.frame > frame) {
          next = key;
          break;
        }
      }
      if (!next || prev.frame < 0 || next.frame <= prev.frame) return prev;
      const t = clamp((frame - prev.frame) / (next.frame - prev.frame), 0, 1);
      return {
        x: prev.x + (next.x - prev.x) * t,
        y: prev.y + (next.y - prev.y) * t,
        z: prev.z + (next.z - prev.z) * t
      };
    }
    fog(frame) {
      let event = this.fogEvents[0];
      for (const key of this.fogEvents) {
        if (key.frame >= 0 && key.frame <= frame) event = key;
        else if (key.frame > frame) break;
      }
      const t = event.duration > 0 ? clamp((frame - event.frame) / event.duration, 0, 1) : 1;
      const mix = (a, b) => a + (b - a) * t;
      const r = Math.round(mix(event.start.r, event.target.r));
      const g = Math.round(mix(event.start.g, event.target.g));
      const b = Math.round(mix(event.start.b, event.target.b));
      const prev = {
        frame: event.frame,
        color: (0xff000000 | (r << 16) | (g << 8) | b) >>> 0,
        r,
        g,
        b,
        near: mix(event.start.near, event.target.near),
        far: mix(event.start.far, event.target.far)
      };
      return {
        ...prev,
        css: `rgb(${prev.r}, ${prev.g}, ${prev.b})`
      };
    }
    facing(frame) {
      let event = this.facingEvents[0];
      for (const key of this.facingEvents) {
        if (key.frame >= 0 && key.frame <= frame) event = key;
        else if (key.frame > frame) break;
      }
      const t = event.duration > 0 ? clamp((frame - event.frame) / event.duration, 0, 1) : 1;
      return {
        frame: event.frame,
        x: event.start.x + (event.target.x - event.start.x) * t,
        y: event.start.y + (event.target.y - event.start.y) * t,
        z: event.start.z + (event.target.z - event.start.z) * t
      };
    }
    project(x, y, z, playfield) {
      const fov = 30 * DEG;
      const halfW = playfield.width / 2;
      const halfH = playfield.height / 2;
      const dist = halfH / Math.tan(fov / 2);
      const viewZ = z + dist;
      if (viewZ <= 100) return null;
      const aspect = playfield.width / playfield.height;
      const yScale = 1 / Math.tan(fov / 2);
      const xScale = yScale / aspect;
      const nx = ((x - halfW) * xScale) / viewZ;
      const ny = ((-y + halfH) * yScale) / viewZ;
      return {
        x: playfield.x + playfield.width * (0.5 + nx * 0.5),
        y: playfield.y + playfield.height * (0.5 - ny * 0.5),
        scale: dist / viewZ
      };
    }
  }

  class Th06Ecl {
    constructor(b64) {
      this.view = new BinaryView(b64);
      this.subOffsets = [];
      this.timeline = [];
      this.parse();
    }
    parse() {
      const v = this.view;
      const subCount = v.i16(0);
      const timelineOffset = v.u32(4);
      for (let i = 0; i < subCount; i++) this.subOffsets.push(v.u32(16 + i * 4));
      for (let off = timelineOffset, guard = 0; off + 8 <= v.bytes.length && guard < 2048; guard++) {
        const time = v.i16(off);
        const arg0 = v.i16(off + 2);
        const op = v.i16(off + 4);
        const size = v.i16(off + 6);
        if (time < 0 || size <= 0) break;
        const evt = { time, arg0, op, size, off };
        if (size >= 28) {
          evt.x = v.f32(off + 8);
          evt.y = v.f32(off + 12);
          evt.z = v.f32(off + 16);
          evt.life = v.i16(off + 20);
          evt.item = v.i16(off + 22);
          evt.score = v.i32(off + 24);
        } else if (size >= 16) {
          evt.i0 = v.i32(off + 8);
          evt.i1 = v.i32(off + 12);
        }
        this.timeline.push(evt);
        off += size;
      }
    }
  }

  class Th06Msg {
    constructor(b64) {
      this.view = new BinaryView(b64);
      this.decoder = new TextDecoder('shift_jis');
      this.messages = [];
      this.parse();
    }
    parse() {
      const v = this.view;
      const count = v.i32(0);
      for (let idx = 0; idx < count; idx++) this.messages.push(this.parseMessage(v.u32(4 + idx * 4)));
    }
    parseMessage(off) {
      const v = this.view;
      const out = [];
      for (let guard = 0; guard < 256 && off + 4 <= v.bytes.length; guard++) {
        const instr = { time: v.u16(off), op: v.u8(off + 2), size: v.u8(off + 3) };
        const a = off + 4;
        if (instr.op === 1 || instr.op === 2) {
          instr.portrait = v.i16(a);
          instr.script = v.i16(a + 2);
        } else if (instr.op === 3 || instr.op === 8) {
          instr.color = v.i16(a);
          instr.line = v.i16(a + 2);
          let end = a + 4;
          while (end < v.bytes.length && v.bytes[end]) end++;
          instr.text = this.decoder.decode(v.bytes.subarray(a + 4, end));
        } else if (instr.size >= 4) {
          instr.arg = v.i32(a);
        }
        out.push(instr);
        off += 4 + instr.size;
        if (instr.op === 0) break;
      }
      return out;
    }
    message(idx) {
      return this.messages[idx] || null;
    }
  }

  class Th06StageRuntime {
    constructor(stageData) {
      this.stageNumber = stageData.stageNumber;
      this.ecl = new Th06Ecl(stageData.ecl);
      this.std = new Th06Std(stageData.std, stageData.stageAnm);
      this.enemyAnm = new Th06Anm(stageData.enemyAnm);
      this.enemy2Anm = stageData.enemy2Anm ? new Th06Anm(stageData.enemy2Anm) : this.enemyAnm;
      this.bulletAnm = new Th06Anm(stageData.bulletAnm);
      this.playerAnm = [new Th06Anm(stageData.player0Anm), new Th06Anm(stageData.player1Anm)];
      const effectData = TH06_GLOBAL.TH06_EFFECT_DATA;
      if (!effectData?.etama4Anm || !effectData?.eff01Anm) throw new Error('Original effect ANM data is missing');
      const stageEffectKey = stageData.assets?.effectKey || 'eff01Anm';
      this.effectParticleAnm = new Th06Anm(effectData.etama4Anm);
      this.effectStageAnm = new Th06Anm(effectData[stageEffectKey] || effectData.eff01Anm);
      this.effectStageImageKey = stageData.assets?.effectImageKey || 'eff01';
      this.msg = stageData.msg ? new Th06Msg(stageData.msg) : null;
      this.randomItemIndex = 0;
      this.randomSpawnIndex = 0;
      this.bossSlots = [];
      this.reset();
    }
    reset() {
      this.timelineIndex = 0;
      this.timelineFrame = 0;
      this.randomItemIndex = 0;
      this.randomSpawnIndex = 0;
      this.bossSlots = [];
      this.std.reset();
    }
    isTimelineComplete() {
      return this.timelineIndex >= this.ecl.timeline.length;
    }
    isEnemyActive(game, enemy) {
      return !!enemy && !enemy.dead && (!game.enemies || game.enemies.includes(enemy));
    }
    update(game) {
      if (!game.timeStopped) this.std.advance();
      let held = false;
      while (this.timelineIndex < this.ecl.timeline.length && this.ecl.timeline[this.timelineIndex].time <= this.timelineFrame) {
        const action = this.spawnTimeline(game, this.ecl.timeline[this.timelineIndex]);
        if (action === 'hold') {
          held = true;
          break;
        }
        this.timelineIndex++;
      }
      if (!held && !game.isDialogueBlocking?.()) this.timelineFrame++;
    }
    spawnTimeline(game, evt) {
      if (evt.op === 8) {
        const familyOffset = game.spec?.().family === 'marisa' ? 10 : 0;
        const dialogueIndex = this.stageNumber === 5 && eclDifficultyIndex(game) === 0 && evt.arg0 === 1
          ? familyOffset + 3
          : evt.arg0 + familyOffset;
        game.startDialogue?.(dialogueIndex, this.msg?.message(dialogueIndex));
        return null;
      }
      if (evt.op === 9) {
        if (game.consumeDialogueResume?.()) return null;
        return game.isDialogueBlocking?.() ? 'hold' : null;
      }
      if (evt.op === 10) {
        const boss = this.bossSlots[evt.i0 || 0];
        if (this.isEnemyActive(game, boss)) boss.ecl.runInterrupt = evt.i1 || 0;
        return null;
      }
      if (evt.op === 11) {
        game.power = clamp(evt.arg0, 0, 128);
        return null;
      }
      if (evt.op === 12) {
        const boss = this.bossSlots[evt.arg0 || 0];
        return this.isEnemyActive(game, boss) ? 'hold' : null;
      }
      if (![0, 1, 2, 3, 4, 5, 6, 7].includes(evt.op)) return;
      if (game.enemies.some((enemy) => enemy.ecl?.isBoss)) return null;
      let x = evt.x ?? 0;
      let y = evt.y ?? 0;
      let z = evt.z ?? 0;
      if (x <= -990) x = game.rng.range(384);
      if (y <= -990) y = game.rng.range(448);
      if (z <= -990) z = game.rng.range(800);
      this.spawnEclEnemy(game, {
        subId: evt.arg0,
        x,
        y,
        z,
        life: evt.op === 1 || evt.op === 3 || evt.op === 5 || evt.op === 7 ? -1 : evt.life,
        item: evt.op === 1 || evt.op === 3 || evt.op === 5 || evt.op === 7 ? -2 : evt.item,
        score: evt.op === 1 || evt.op === 3 || evt.op === 5 || evt.op === 7 ? -1 : evt.score,
        mirrored: evt.op === 2 || evt.op === 3 || evt.op === 6 || evt.op === 7
      });
    }
    spawnEclEnemy(game, { subId, x, y, z = 0, life = -1, item = -1, score = -1, mirrored = false }) {
      const hasTimelineLife = life >= 0;
      const hasTimelineScore = score >= 0;
      const initialHp = hasTimelineLife ? life | 0 : 1;
      const initialScore = hasTimelineScore ? Math.max(0, score | 0) : 100;
      const e = {
        id: game.id++,
        kind: subId >= 8 ? 'midboss' : 'fairyRed',
        x, y, z,
        ix: x, iy: y,
        hp: initialHp,
        maxHp: initialHp,
        radius: 14,
        score: initialScore,
        frame: 0,
        move: { type: 'ecl' },
        patterns: [],
        drops: [],
        phaseFrame: 0,
        bombed: false,
        ecl: this.makeEnemyState(subId, mirrored, item)
      };
      game.enemies.push(e);
      this.runEcl(game, e);
      if (hasTimelineLife) e.hp = e.maxHp = initialHp;
      else e.maxHp = Math.max(1, e.hp);
      if (hasTimelineScore) e.score = initialScore;
      e.kind = e.ecl.isBoss ? 'boss' : this.enemyKindFromAnm(e.ecl.currentAnm);
      return e;
    }
    makeEnemyState(subId, mirrored, itemDrop) {
      return {
        ctx: this.makeContext(subId, 0, 0),
        stack: [],
        subId,
        mirrored,
        itemDrop,
        axisSpeed: { x: 0, y: 0, z: 0 },
        angle: 0,
        angularVelocity: 0,
        speed: 0,
        acceleration: 0,
        shootOffset: { x: 0, y: 0, z: 0 },
        moveMode: 0,
        interpKind: 0,
        interp: null,
        bulletProps: null,
        bulletSfx: -1,
        bulletExInts: [0, 0, 0, 0],
        bulletExFloats: [0, 0, 0, 0],
        shootDisabled: false,
        shootInterval: 0,
        shootIntervalBase: 0,
        shootTimer: 0,
        hitbox: { x: 28, y: 28, z: 32 },
        seen: false,
        isBoss: false,
        canTakeDamage: true,
        collisionEnabled: true,
        interactable: true,
        deathMode: 0,
        deathCallbackSub: -1,
        lifeCallbackThreshold: -1,
        lifeCallbackSub: -1,
        timerCallbackThreshold: -1,
        timerCallbackSub: -1,
        bossTimer: 0,
        currentAnm: 0,
        anmFrame: 0,
        anmSlots: [],
        anmInterrupt: null,
        anmExDefaults: -1,
        anmExFarLeft: -1,
        anmExFarRight: -1,
        anmExLeft: -1,
        anmExRight: -1,
        anmExFlags: 0xff,
        frameVx: 0,
        frameVy: 0,
        anmRotateWithAngle: false,
        bossLifeCount: 0,
        lasers: [],
        laserStore: 0,
        interrupts: [],
        runInterrupt: -1,
        disableCallStack: false,
        invisible: false,
        spellTimeoutFlag: false,
        exRepeatIndex: -1,
        exRepeatParam: 0,
        exFunc6Angle: 0,
        exFunc6Timer: 0,
        exFunc10Timer: 0,
        bulletRankSpeedLow: -0.5,
        bulletRankSpeedHigh: 0.5,
        bulletRankAmount1Low: 0,
        bulletRankAmount1High: 0,
        bulletRankAmount2Low: 0,
        bulletRankAmount2High: 0,
        lowerMoveLimit: { x: 0, y: 0 },
        upperMoveLimit: { x: 384, y: 448 },
        shouldClamp: false,
        spellName: ''
      };
    }
    makeContext(subId, var0, float0) {
      return {
        subId,
        off: this.ecl.subOffsets[subId] ?? 0,
        time: 0,
        var0,
        var1: 0,
        var2: 0,
        var3: 0,
        var4: 0,
        var5: 0,
        var6: 0,
        var7: 0,
        float0,
        float1: 0,
        float2: 0,
        float3: 0,
        cmp: 0
      };
    }
    updateEnemy(game, e) {
      const prevX = e.x;
      const prevY = e.y;
      e.ecl.difficultyIndex = eclDifficultyIndex(game);
      this.applyMovement(e);
      e.ecl.frameVx = e.x - prevX;
      e.ecl.frameVy = e.y - prevY;
      this.checkCallbacks(game, e);
      if (e.ecl.exRepeatIndex >= 0) this.runExInstruction(game, e, e.ecl.exRepeatIndex, e.ecl.exRepeatParam, true);
      this.runEcl(game, e);
      this.updateAutoShoot(game, e);
      if (e.ecl.isBoss && !game.timeStopped) e.ecl.bossTimer++;
      this.updateAnmPose(e);
      e.ecl.anmFrame++;
      if (e.ecl.anmInterrupt?.slot === -1) e.ecl.anmInterrupt.frame++;
      for (const slot of e.ecl.anmSlots) {
        if (!slot) continue;
        slot.frame++;
        if (slot.interrupt) slot.interrupt.frame++;
      }
      const rect = this.enemyRect(e);
      const w = rect?.w || e.ecl.hitbox.x || e.radius * 2 || 16;
      const h = rect?.h || e.ecl.hitbox.y || e.radius * 2 || 16;
      const on = typeof game.enemyInArcadeBounds === 'function'
        ? game.enemyInArcadeBounds(e)
        : e.x + w / 2 >= 0 && e.x - w / 2 <= 384 && e.y + h / 2 >= 0 && e.y - h / 2 <= 448;
      e.ecl.seen = e.ecl.seen || on;
      e.kind = e.ecl.isBoss ? 'boss' : this.enemyKindFromAnm(e.ecl.currentAnm);
      e.radius = Math.max(8, Math.max(e.ecl.hitbox.x, e.ecl.hitbox.y) * 0.5);
    }
    setCurrentAnm(e, script) {
      const s = e.ecl;
      if (script < 0 || s.currentAnm === script) return;
      s.currentAnm = script;
      s.anmFrame = 0;
      s.anmInterrupt = null;
    }
    updateAnmPose(e) {
      const s = e.ecl;
      if (s.anmExLeft < 0) return;
      const vx = Math.abs(s.frameVx) < 0.0001 ? 0 : s.frameVx;
      const pose = vx < 0 ? 1 : vx > 0 ? 2 : 0;
      if (s.anmExFlags === pose) return;
      if (pose === 0) {
        if (s.anmExFlags === 0xff) this.setCurrentAnm(e, s.anmExDefaults);
        else if (s.anmExFlags === 1) this.setCurrentAnm(e, s.anmExFarLeft);
        else this.setCurrentAnm(e, s.anmExFarRight);
      } else if (pose === 1) this.setCurrentAnm(e, s.anmExLeft);
      else this.setCurrentAnm(e, s.anmExRight);
      s.anmExFlags = pose;
    }
    applyMovement(e) {
      const s = e.ecl;
      if (s.moveMode === 2 && s.interp) {
        const m = s.interp;
        const elapsed = m.duration - m.left;
        let t = clamp(elapsed / Math.max(1, m.duration), 0, 1);
        if (s.interpKind === 1) t = 1 - (1 - t) * (1 - t);
        else if (s.interpKind === 2) t = 1 - (1 - t) ** 4;
        else if (s.interpKind === 3) t = t * t;
        else if (s.interpKind === 4) t = t ** 4;
        e.x = m.start.x + m.delta.x * t;
        e.y = m.start.y + m.delta.y * t;
        e.z = m.start.z + m.delta.z * t;
        m.left--;
        if (m.left <= 0) {
          e.x = m.start.x + m.delta.x;
          e.y = m.start.y + m.delta.y;
          e.z = m.start.z + m.delta.z;
          s.moveMode = 0;
          s.interp = null;
        }
      } else if (s.moveMode === 1) {
        const vx = Math.cos(s.angle) * s.speed;
        const vy = Math.sin(s.angle) * s.speed;
        e.x += s.mirrored ? -vx : vx;
        e.y += vy;
        s.angle = normalizeAngle(s.angle + s.angularVelocity);
        s.speed += s.acceleration;
      } else {
        e.x += (s.mirrored ? -s.axisSpeed.x : s.axisSpeed.x);
        e.y += s.axisSpeed.y;
        e.z += s.axisSpeed.z;
      }
      if (s.shouldClamp) {
        e.x = clamp(e.x, s.lowerMoveLimit.x, s.upperMoveLimit.x);
        e.y = clamp(e.y, s.lowerMoveLimit.y, s.upperMoveLimit.y);
      }
    }
    updateAutoShoot(game, e) {
      const s = e.ecl;
      if (!s.shootInterval || s.shootDisabled || !s.bulletProps) return;
      s.shootTimer++;
      if (s.shootTimer >= s.shootInterval) {
        s.shootTimer = 0;
        this.spawnBullets(game, e, s.bulletProps);
      }
    }
    runEcl(game, e) {
      const s = e.ecl;
      const v = this.ecl.view;
      const difficulty = eclDifficultyIndex(game);
      s.difficultyIndex = difficulty;
      for (let guard = 0; guard < 512; guard++) {
        if (s.runInterrupt >= 0) {
          const sub = s.interrupts[s.runInterrupt];
          s.runInterrupt = -1;
          if (sub != null && sub >= 0) {
            const next = v.i16(s.ctx.off + 6);
            if (!s.disableCallStack && next > 0) s.stack.push({ ...s.ctx, off: s.ctx.off + next });
            this.enterSub(s, sub, 0, 0, false);
          }
        }
        const ctx = s.ctx;
        if (!ctx.off || ctx.off + 12 > v.bytes.length) return;
        const time = v.i32(ctx.off);
        const op = v.i16(ctx.off + 4);
        const next = v.i16(ctx.off + 6);
        const skip = v.u8(ctx.off + 9);
        if (time < 0 || op < 0) return;
        if (ctx.time !== time) break;
        if (skip & (1 << difficulty)) {
          const previousExecutingEnemy = this.executingEnemy || null;
          this.executingEnemy = e;
          const action = this.execute(game, e, ctx, op);
          this.executingEnemy = previousExecutingEnemy;
          if (action === 'delete') {
            e.dead = true;
            return;
          }
          if (action === 'jump' || action === 'call' || action === 'ret') continue;
        }
        if (next <= 0) return;
        ctx.off += next;
      }
      s.ctx.time++;
    }
    execute(game, e, ctx, op) {
      const s = e.ecl;
      const v = this.ecl.view;
      const a = ctx.off + 12;
      const nextSize = v.i16(ctx.off + 6);
      if (op === 1) return 'delete';
      if (op === 2 || op === 3) {
        if (op === 3) {
          const value = this.getInt(e, a + 8) - 1;
          this.setInt(e, v.i32(a + 8), value);
          if (value <= 0) return null;
        }
        ctx.time = v.i32(a);
        ctx.off += v.i32(a + 4);
        return 'jump';
      }
      if (op === 4 || op === 5) this.setVar(e, v.i32(a), this.getSetValue(e, a + 4, op === 5));
      else if (op === 6 || op === 7) {
        const span = Math.max(1, this.getInt(e, a + 4));
        const base = op === 7 ? this.getInt(e, a + 8) : 0;
        this.setInt(e, v.i32(a), rngU32InRange(game.rng, span) + base);
      } else if (op === 8 || op === 9) {
        const span = this.getFloat(e, a + 4);
        const base = this.getFloat(e, a + 8);
        this.setFloat(e, v.i32(a), game.rng.range(span) + (op === 9 ? base : 0));
      } else if (op === 10 || op === 11 || op === 12) {
        const value = op === 10 ? e.x : op === 11 ? e.y : e.z;
        this.setVar(e, v.i32(a), value);
      } else if (op >= 13 && op <= 24) this.math(e, op, a);
      else if (op === 25) this.setFloat(e, v.i32(a), Math.atan2(this.getFloat(e, a + 16) - this.getFloat(e, a + 8), this.getFloat(e, a + 12) - this.getFloat(e, a + 4)));
      else if (op === 26) this.setFloat(e, v.i32(a), normalizeAngle(this.getFloat(e, a)));
      else if (op === 27 || op === 28) {
        const lhs = op === 27 ? this.getInt(e, a) : this.getFloat(e, a);
        const rhs = op === 27 ? this.getInt(e, a + 4) : this.getFloat(e, a + 4);
        ctx.cmp = lhs < rhs ? -1 : lhs > rhs ? 1 : 0;
      } else if (op >= 29 && op <= 34) {
        if (this.comparePass(ctx.cmp, op - 29)) {
          ctx.time = v.i32(a);
          ctx.off += v.i32(a + 4);
          return 'jump';
        }
      } else if (op === 35 || (op >= 37 && op <= 42)) {
        if (op === 35 || this.comparePass(this.getInt(e, a + 12) - v.i32(a + 16), op - 37)) {
          if (!s.disableCallStack) s.stack.push({ ...ctx, off: ctx.off + v.i16(ctx.off + 6) });
          this.enterSub(s, v.i32(a), v.i32(a + 4), v.f32(a + 8));
          return 'call';
        }
      } else if (op === 36) {
        const ret = s.stack.pop();
        if (ret) s.ctx = ret;
        return 'ret';
      } else if (op === 43) {
        e.x = this.getFloat(e, a);
        e.y = this.getFloat(e, a + 4);
        e.z = this.getFloat(e, a + 8);
      } else if (op === 44) {
        const angle = this.getFloat(e, a);
        const speed = nextSize >= 20 ? this.getFloat(e, a + 4) : s.speed;
        s.axisSpeed = { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed, z: nextSize >= 24 ? this.getFloat(e, a + 8) : 0 };
        s.moveMode = 0;
      } else if (op === 45) {
        s.angle = this.getFloat(e, a);
        if (nextSize >= 20) s.speed = this.getFloat(e, a + 4);
        s.moveMode = 1;
      } else if (op === 46) {
        s.angularVelocity = this.getFloat(e, a);
        s.moveMode = 1;
      } else if (op === 47) {
        s.speed = this.getFloat(e, a);
        s.moveMode = 1;
      } else if (op === 48) {
        s.acceleration = this.getFloat(e, a);
        s.moveMode = 1;
      } else if (op === 49 || op === 50) {
        s.angle = game.rng.range(this.getFloat(e, a + 4) - this.getFloat(e, a)) + this.getFloat(e, a);
        if (op === 50) this.keepRandomMoveInBounds(e);
        s.moveMode = 1;
      } else if (op === 51) {
        s.angle = Math.atan2(game.player.y - e.y, game.player.x - e.x) + this.getFloat(e, a);
        s.speed = this.getFloat(e, a + 4);
        s.moveMode = 1;
      } else if (op >= 52 && op <= 64) this.moveTimed(e, op, a);
      else if (op === 65) {
        s.lowerMoveLimit = { x: this.getFloat(e, a), y: this.getFloat(e, a + 4) };
        s.upperMoveLimit = { x: this.getFloat(e, a + 8), y: this.getFloat(e, a + 12) };
        s.shouldClamp = true;
      } else if (op === 66) s.shouldClamp = false;
      else if (op >= 67 && op <= 75) {
        const props = this.readBulletProps(game, e, op, a);
        s.bulletProps = props;
        if (!s.shootDisabled) this.spawnBullets(game, e, props);
      } else if (op === 76 || op === 77) {
        s.shootIntervalBase = v.i32(a);
        s.shootInterval = TH06_LOGIC.shootIntervalForRank(s.shootIntervalBase, game.rank);
        s.shootTimer = op === 77 && s.shootInterval > 0 ? rngU32InRange(game.rng, s.shootInterval) : 0;
      } else if (op === 78) s.shootDisabled = true;
      else if (op === 79) s.shootDisabled = false;
      else if (op === 80 && s.bulletProps) this.spawnBullets(game, e, s.bulletProps);
      else if (op === 81) s.shootOffset = { x: this.getFloat(e, a), y: this.getFloat(e, a + 4), z: this.getFloat(e, a + 8) };
      else if (op === 82) {
        s.bulletExInts = [
          this.getInt(e, a),
          this.getInt(e, a + 4),
          this.getInt(e, a + 8),
          this.getInt(e, a + 12)
        ];
        s.bulletExFloats = [
          this.getFloat(e, a + 16),
          this.getFloat(e, a + 20),
          this.getFloat(e, a + 24),
          this.getFloat(e, a + 28)
        ];
        if (s.bulletProps) {
          s.bulletProps.exInts = [...s.bulletExInts];
          s.bulletProps.exFloats = [...s.bulletExFloats];
        }
      }
      else if (op === 83) {
        this.turnBulletsIntoPointItems(game);
      }
      else if (op === 84) {
        const sfx = v.i32(a);
        s.bulletSfx = sfx;
        if (s.bulletProps) {
          s.bulletProps.sfx = sfx;
          if (sfx >= 0) s.bulletProps.flags |= 0x200;
          else s.bulletProps.flags &= ~0x200;
        }
      }
      else if (op === 85 || op === 86) this.spawnLaser(game, e, op, a);
      else if (op === 87) s.laserStore = this.getInt(e, a);
      else if (op === 88) {
        const laser = s.lasers[v.i32(a)];
        if (laser?.inUse) laser.angle = normalizeAngle(laser.angle + this.getFloat(e, a + 4));
      } else if (op === 89) {
        const laser = s.lasers[v.i32(a)];
        if (laser?.inUse) laser.angle = normalizeAngle(Math.atan2(game.player.y - laser.y, game.player.x - laser.x) + this.getFloat(e, a + 4));
      } else if (op === 90) {
        const laser = s.lasers[v.i32(a)];
        if (laser?.inUse) {
          laser.x = e.x + this.getFloat(e, a + 4);
          laser.y = e.y + this.getFloat(e, a + 8);
        }
      } else if (op === 91) {
        const laser = s.lasers[v.i32(a)];
        ctx.cmp = laser?.inUse ? 0 : 1;
      } else if (op === 92) {
        const laser = s.lasers[v.i32(a)];
        if (laser?.inUse && laser.state < 2) {
          laser.state = 2;
          laser.timer = 0;
        }
      }
      else if (op === 93) {
        s.spellcardSprite = v.i16(a);
        const spellId = v.i16(a + 2);
        s.spellName = this.readCString(a + 4);
        s.spellNameEnglish = game.startBossSpell?.(spellId, s.spellcardSprite, s.spellName) || '';
        this.turnBulletsIntoPointItems(game);
        this.resetBulletRankInfluence(s);
        game.banner = 150;
      } else if (op === 94) {
        s.spellName = '';
        s.spellNameEnglish = '';
        game.endBossSpell?.();
        this.turnBulletsIntoPointItems(game);
      } else if (op === 95) this.spawnChildEnemy(game, e, a);
      else if (op === 96) this.killNonBossEnemies(game);
      else if (op === 97) {
        const currentAnm = v.i32(a);
        this.setCurrentAnm(e, currentAnm);
      }
      else if (op === 99) {
        const slot = v.i32(a) | 0;
        if (slot >= 0 && slot < 8) {
          const script = v.i32(a + 4);
          s.anmSlots[slot] = { script, frame: 0 };
        }
      }
      else if (op === 98) {
        s.anmExDefaults = v.i16(a);
        s.anmExFarLeft = v.i16(a + 2);
        s.anmExFarRight = v.i16(a + 4);
        s.anmExLeft = v.i16(a + 6);
        s.anmExRight = v.i16(a + 8);
        s.anmExFlags = 0xff;
      }
      else if (op === 100) {
        s.deathAnm1 = v.i8(a);
        s.deathAnm2 = v.i8(a + 1);
        s.deathAnm3 = v.i8(a + 2);
      } else if (op === 101) {
        const bossSlot = v.i32(a);
        if (s.bossSlot != null && this.bossSlots[s.bossSlot] === e) this.bossSlots[s.bossSlot] = null;
        s.bossSlot = bossSlot >= 0 ? bossSlot : null;
        s.isBoss = bossSlot >= 0;
        if (s.isBoss) this.bossSlots[bossSlot] = e;
        e.kind = s.isBoss ? 'boss' : e.kind;
        game.setBossPresent?.(s.isBoss, e);
      } else if (op === 102) {
        const colorId = v.i32(a);
        const pos = { x: v.f32(a + 4), y: v.f32(a + 8), z: v.f32(a + 12) };
        const distance = v.f32(a + 16);
        game.spawnSpellEffect?.(e, colorId, pos, distance);
      } else if (op === 103) {
        s.hitbox = { x: this.getFloat(e, a), y: this.getFloat(e, a + 4), z: this.getFloat(e, a + 8) };
      } else if (op === 104) s.collisionEnabled = !!v.i32(a);
      else if (op === 105) s.canTakeDamage = !!v.i32(a);
      else if (op === 106) game.audio?.sfx(v.i32(a));
      else if (op === 107) s.deathMode = v.i32(a);
      else if (op === 108) s.deathCallbackSub = v.i32(a);
      else if (op === 109) s.interrupts[v.i32(a + 4)] = v.i32(a);
      else if (op === 110) s.runInterrupt = v.i32(a);
      else if (op === 111) e.hp = e.maxHp = v.i32(a);
      else if (op === 112) s.bossTimer = v.i32(a);
      else if (op === 113) s.lifeCallbackThreshold = v.i32(a);
      else if (op === 114) s.lifeCallbackSub = v.i32(a);
      else if (op === 115) {
        s.timerCallbackThreshold = v.i32(a);
        s.bossTimer = 0;
      }
      else if (op === 116) s.timerCallbackSub = v.i32(a);
      else if (op === 117) s.interactable = !!v.i32(a);
      else if (op === 118) {
        game.spawnEffectParticles?.(v.i32(a), e.x, e.y, v.i32(a + 4), v.u32(a + 8));
      }
      else if (op === 119) this.dropPowerItems(game, e, v.i32(a));
      else if (op === 120) s.anmRotateWithAngle = !!v.i32(a);
      else if (op === 121) this.runExInstruction(game, e, v.i32(a), v.i32(a + 4));
      else if (op === 122) {
        s.exRepeatIndex = v.i32(a);
        s.exRepeatParam = s.exRepeatIndex >= 0 ? v.i32(a + 4) : 0;
      }
      else if (op === 123) ctx.time += this.getInt(e, a);
      else if (op === 124) {
        const type = ITEM_TABLE[v.i32(a)];
        if (type) this.spawnSourceItem(game, type, e.x, e.y);
      }
      else if (op === 125) this.std.unpause();
      else if (op === 126) {
        s.bossLifeCount = v.i32(a);
        game.setBossLifeCount?.(s.bossLifeCount);
      }
      else if (op === 127) {}
      else if (op === 128) s.anmInterrupt = { slot: -1, value: v.i32(a), frame: 0 };
      else if (op === 129) {
        const slot = v.i32(a) | 0;
        const entry = s.anmSlots[slot];
        if (slot >= 0 && slot < 8 && entry) entry.interrupt = { slot, value: v.i32(a + 4), frame: 0 };
      }
      else if (op === 131) {
        s.bulletRankSpeedLow = v.f32(a);
        s.bulletRankSpeedHigh = v.f32(a + 4);
        s.bulletRankAmount1Low = v.i32(a + 8);
        s.bulletRankAmount1High = v.i32(a + 12);
        s.bulletRankAmount2Low = v.i32(a + 16);
        s.bulletRankAmount2High = v.i32(a + 20);
      }
      else if (op === 130) s.disableCallStack = !!v.i32(a);
      else if (op === 132) s.invisible = !!v.i32(a);
      else if (op === 133) {
        s.timerCallbackSub = s.deathCallbackSub;
        s.bossTimer = 0;
      }
      else if (op === 134) {
        for (const laser of game.enemyLasers || []) laser.inUse = false;
        game.enemyLasers = [];
      }
      else if (op === 135) s.spellTimeoutFlag = !!v.i32(a);
      return null;
    }
    enterSub(s, subId, var0 = 0, float0 = 0, setArgs = true) {
      s.ctx = {
        ...s.ctx,
        subId,
        off: this.ecl.subOffsets[subId] ?? 0,
        time: 0,
        ...(setArgs ? { var0, float0 } : {})
      };
    }
    callCallbackSub(s, subId) {
      this.enterSub(s, subId, 0, 0, false);
    }
    resetBulletRankInfluence(s) {
      s.bulletRankSpeedLow = -0.5;
      s.bulletRankSpeedHigh = 0.5;
      s.bulletRankAmount1Low = 0;
      s.bulletRankAmount1High = 0;
      s.bulletRankAmount2Low = 0;
      s.bulletRankAmount2High = 0;
    }
    resetCallbackRanks(s) {
      this.resetBulletRankInfluence(s);
      s.stack.length = 0;
    }
    enemyUsesNormalDeath(enemy) {
      const s = enemy.ecl;
      return !!s && s.interactable && !s.invisible;
    }
    clearNonBossEnemy(enemy) {
      enemy.hp = 0;
      if (!enemy.ecl) {
        enemy.dead = true;
        return;
      }
      const s = enemy.ecl;
      if (!this.enemyUsesNormalDeath(enemy)) {
        if (s.deathCallbackSub >= 0) {
          const sub = s.deathCallbackSub;
          s.deathCallbackSub = -1;
          this.callCallbackSub(s, sub);
        } else {
          enemy.dead = true;
        }
      }
    }
    clearNonBossEnemiesForCallback(game, owner) {
      for (const enemy of game.enemies) {
        if (enemy === owner || enemy.ecl?.isBoss) continue;
        this.clearNonBossEnemy(enemy);
      }
    }
    killNonBossEnemies(game) {
      const owner = this.executingEnemy || null;
      for (const enemy of game.enemies) {
        if (enemy === owner) continue;
        if (enemy.ecl?.isBoss || enemy.kind === 'boss') continue;
        enemy.hp = 0;
        this.clearNonBossEnemy(enemy);
      }
    }
    checkCallbacks(game, e) {
      const s = e.ecl;
      if (s.lifeCallbackThreshold >= 0 && s.lifeCallbackSub >= 0 && e.hp < s.lifeCallbackThreshold) {
        const sub = s.lifeCallbackSub;
        e.hp = s.lifeCallbackThreshold;
        s.lifeCallbackThreshold = -1;
        s.timerCallbackSub = s.deathCallbackSub;
        this.resetCallbackRanks(s);
        this.clearNonBossEnemiesForCallback(game, e);
        this.callCallbackSub(s, sub);
      } else if (s.timerCallbackThreshold >= 0 && s.timerCallbackSub >= 0 && s.bossTimer >= s.timerCallbackThreshold) {
        const sub = s.timerCallbackSub;
        if (s.lifeCallbackThreshold > 0) {
          e.hp = s.lifeCallbackThreshold;
          s.lifeCallbackThreshold = -1;
        }
        s.timerCallbackThreshold = -1;
        s.timerCallbackSub = s.deathCallbackSub;
        s.bossTimer = 0;
        if (!s.spellTimeoutFlag && game.spellcardInfo?.isActive) {
          game.spellcardInfo.isCapturing = false;
        }
        this.resetCallbackRanks(s);
        this.clearNonBossEnemiesForCallback(game, e);
        this.callCallbackSub(s, sub);
      }
    }
    moveTimed(e, op, a) {
      const s = e.ecl;
      const duration = Math.max(1, this.ecl.view.i32(a));
      let delta = { x: 0, y: 0, z: 0 };
      if (op >= 56 && op <= 60) {
        delta = {
          x: this.getFloat(e, a + 4) - e.x,
          y: this.getFloat(e, a + 8) - e.y,
          z: this.getFloat(e, a + 12) - e.z
        };
      } else {
        const angle = op >= 52 && op <= 55 ? this.getFloat(e, a + 4) : s.angle;
        const speed = op >= 52 && op <= 55 ? this.getFloat(e, a + 8) : s.speed;
        delta = { x: Math.cos(angle) * speed * duration / 2, y: Math.sin(angle) * speed * duration / 2, z: 0 };
      }
      s.interp = { start: { x: e.x, y: e.y, z: e.z }, delta, duration, left: duration };
      s.moveMode = 2;
      s.axisSpeed = { x: 0, y: 0, z: 0 };
      if (op >= 56 && op <= 60) s.interpKind = op - 56;
      else if (op >= 61) s.interpKind = op - 60;
      else s.interpKind = op - 51;
    }
    keepRandomMoveInBounds(e) {
      const s = e.ecl;
      if (e.x < s.lowerMoveLimit.x + 96) {
        if (s.angle > Math.PI / 2) s.angle = Math.PI - s.angle;
        else if (s.angle < -Math.PI / 2) s.angle = -Math.PI - s.angle;
      }
      if (e.x > s.upperMoveLimit.x - 96) {
        if (s.angle < Math.PI / 2 && s.angle >= 0) s.angle = Math.PI - s.angle;
        else if (s.angle > -Math.PI / 2 && s.angle <= 0) s.angle = -Math.PI - s.angle;
      }
      if (e.y < s.lowerMoveLimit.y + 48 && s.angle < 0) s.angle = -s.angle;
      if (e.y > s.upperMoveLimit.y - 48 && s.angle > 0) s.angle = -s.angle;
      s.angle = normalizeAngle(s.angle);
    }
    readBulletProps(game, e, op, a) {
      const rankSpeed = game.rank * (e.ecl.bulletRankSpeedHigh - e.ecl.bulletRankSpeedLow) / 32 + e.ecl.bulletRankSpeedLow;
      const add1 = Math.trunc(game.rank * (e.ecl.bulletRankAmount1High - e.ecl.bulletRankAmount1Low) / 32 + e.ecl.bulletRankAmount1Low);
      const add2 = Math.trunc(game.rank * (e.ecl.bulletRankAmount2High - e.ecl.bulletRankAmount2Low) / 32 + e.ecl.bulletRankAmount2Low);
      const speed1 = this.getFloat(e, a + 12);
      const speed2 = this.getFloat(e, a + 16);
      return {
        sprite: this.getShort(e, a),
        offset: this.getShort(e, a + 2),
        count1: Math.max(1, this.getInt(e, a + 4) + add1),
        count2: Math.max(1, this.getInt(e, a + 8) + add2),
        speed1: speed1 ? Math.max(0.3, speed1 + rankSpeed) : 0,
        speed2: Math.max(0.3, speed2 + rankSpeed / 2),
        angle1: normalizeAngle(this.getFloat(e, a + 20)),
        angle2: this.getFloat(e, a + 24),
        flags: this.ecl.view.i32(a + 28) | (e.ecl.bulletSfx >= 0 ? 0x200 : 0),
        sfx: e.ecl.bulletSfx,
        exInts: [...e.ecl.bulletExInts],
        exFloats: [...e.ecl.bulletExFloats],
        aimMode: op - 67
      };
    }
    spawnBullets(game, e, p, origin = null) {
      const shootX = origin?.x ?? e.x + e.ecl.shootOffset.x;
      const shootY = origin?.y ?? e.y + e.ecl.shootOffset.y;
      const aim = Math.atan2(game.player.y - shootY, game.player.x - shootX);
      for (let j = 0; j < p.count2; j++) {
        const speed = p.speed1 - (p.speed1 - p.speed2) * j / p.count2;
        for (let i = 0; i < p.count1; i++) {
          if ((game.enemyBullets?.length || 0) >= ENEMY_BULLET_CAP) return;
          let angle = 0;
          if (p.aimMode <= 1) {
            angle = ((p.count1 & 1) ? Math.floor((i + 1) / 2) : Math.floor(i / 2) + 0.5) * p.angle2;
            if (i & 1) angle *= -1;
            if (p.aimMode === 0) angle += aim;
            angle += p.angle1;
          } else if (p.aimMode === 2 || p.aimMode === 3) {
            if (p.aimMode === 2) angle += aim;
            angle += i * TAU / p.count1 + j * p.angle2 + p.angle1;
          } else if (p.aimMode === 4 || p.aimMode === 5) {
            if (p.aimMode === 4) angle += aim;
            angle += Math.PI / p.count1 + i * TAU / p.count1 + p.angle1;
          } else if (p.aimMode === 6) {
            angle = game.rng.range(p.angle1 - p.angle2) + p.angle2;
          } else if (p.aimMode === 7) {
            angle = i * TAU / p.count1 + j * p.angle2 + p.angle1;
          } else {
            angle = game.rng.range(p.angle1 - p.angle2) + p.angle2;
          }
          angle = normalizeAngle(angle);
          const spd = p.aimMode === 7 || p.aimMode === 8 ? game.rng.range(p.speed1 - p.speed2) + p.speed2 : speed;
          const rect = this.bulletRect(p.sprite, p.offset);
          if (!rect) throw new Error(`Missing original bullet ANM frame for sprite ${p.sprite} offset ${p.offset}`);
          const visual = Math.max(rect.w, rect.h);
          const grazeSize = TH06_LOGIC.bulletGrazeSize(p.sprite, rect.h);
          const flags = p.flags || 0;
          const spawnEffect = this.bulletSpawnEffect(p.sprite, flags);
          game.enemyBullets.push({
            id: game.id++,
            x: shootX,
            y: shootY,
            vx: Math.cos(angle) * spd,
            vy: Math.sin(angle) * spd,
            speed: spd,
            r: visual / 2,
            hitR: Math.max(grazeSize.x, grazeSize.y) / 2,
            grazeSize,
            angle,
            age: 0,
            flags,
            exInts: p.exInts,
            exFloats: p.exFloats,
            dirRotation: p.exFloats?.[0] || 0,
            dirSpeed: (p.exFloats?.[1] ?? -1) >= 0 ? p.exFloats[1] : spd,
            dirInterval: Math.max(1, p.exInts?.[0] || 1),
            dirMax: Math.max(1, p.exInts?.[1] || 1),
            dirTimes: 0,
            spawnState: spawnEffect.state,
            spawnAge: 0,
            spawnDuration: spawnEffect.duration,
            spawnMoveScale: spawnEffect.moveScale,
            spawnEffectScript: spawnEffect.script,
            spawnEffectImageKey: spawnEffect.imageKey,
            grazed: false,
            eclSprite: p.sprite,
            eclOffset: p.offset,
            rect,
            kind: 'ecl'
          });
        }
      }
      if (p.flags & 0x200) game.audio?.sfx(p.sfx);
    }
    bulletIsLarge(b) {
      return (b.rect?.h ?? 0) >= 30;
    }
    setBulletOffset(b, offset) {
      const rect = this.bulletRect(b.eclSprite ?? 0, offset);
      if (!rect) return false;
      b.eclOffset = offset;
      b.rect = rect;
      b.r = Math.max(rect.w, rect.h) / 2;
      const grazeSize = TH06_LOGIC.bulletGrazeSize(b.eclSprite ?? 0, rect.h);
      b.grazeSize = grazeSize;
      b.hitR = Math.max(grazeSize.x, grazeSize.y) / 2;
      return true;
    }
    setBulletVelocity(b, angle, speed = b.speed || 0) {
      b.angle = normalizeAngle(angle);
      b.speed = speed;
      b.vx = Math.cos(b.angle) * speed;
      b.vy = Math.sin(b.angle) * speed;
    }
    spawnLaserPattern(game, e, position, angle, options = {}) {
      const laser = {
        id: game.id++,
        ownerId: e.id,
        inUse: true,
        sprite: options.sprite ?? 1,
        color: options.color ?? 8,
        x: position.x,
        y: position.y,
        angle: normalizeAngle(angle),
        speed: options.speed ?? 0,
        startOffset: options.startOffset ?? 0,
        endOffset: options.endOffset ?? 440,
        startLength: options.startLength ?? 440,
        width: options.width ?? 20,
        startTime: options.startTime ?? 60,
        duration: options.duration ?? 90,
        despawnDuration: options.despawnDuration ?? 16,
        hitboxStartTime: options.hitboxStartTime ?? 50,
        hitboxEndDelay: options.hitboxEndDelay ?? 16,
        flags: options.flags ?? 2,
        state: 0,
        timer: 0,
        visualWidth: 1.2,
        hitboxLength: 0
      };
      e.ecl.lasers.push(laser);
      game.enemyLasers.push(laser);
    }
    spawnStoredPatternAt(game, e, x, y, overrides = {}) {
      if (!e.ecl.bulletProps) return;
      this.spawnBullets(game, e, { ...e.ecl.bulletProps, ...overrides }, { x, y });
    }
    runStage3StarPattern(game, e) {
      const c = e.ecl.ctx;
      if (c.var2 >= c.var3) {
        e.ecl.exRepeatIndex = -1;
        return;
      }
      if (!e.ecl.starPattern || c.var2 === 0) {
        const a0 = game.rng.range(TAU) - Math.PI;
        e.ecl.starPattern = {
          enemy: { x: e.x, y: e.y },
          player: { x: game.player.x, y: game.player.y },
          angles: [a0, normalizeAngle(a0 + 4 * Math.PI / 5), 0, 0, 0, 0]
        };
      }
      const st = e.ecl.starPattern;
      if (c.var2 % 30 === 0) {
        st.angles[0] = st.angles[1];
        for (let i = 1; i < 6; i++) st.angles[i] = normalizeAngle(st.angles[i - 1] + 4 * Math.PI / 5);
      }
      if (c.var2 % 6 === 0 && e.ecl.bulletProps) {
        let pos = c.var2 / Math.max(1, c.var3);
        const targetScale = pos * 0.1;
        const base = {
          x: st.enemy.x + (st.player.x - st.enemy.x) * targetScale,
          y: st.enemy.y + (st.player.y - st.enemy.y) * targetScale
        };
        pos += 0.5;
        let angle1 = (Math.PI / 3) * pos;
        for (let i = 0; i < 5; i++) {
          const t = (c.var2 % 30) / 30;
          const p0 = {
            x: Math.cos(st.angles[i]) * c.float3,
            y: Math.sin(st.angles[i]) * c.float3
          };
          const p1 = {
            x: Math.cos(st.angles[i + 1]) * c.float3,
            y: Math.sin(st.angles[i + 1]) * c.float3
          };
          const origin = {
            x: base.x + p0.x + (p1.x - p0.x) * t,
            y: base.y + p0.y + (p1.y - p0.y) * t
          };
          this.spawnBullets(game, e, {
            ...e.ecl.bulletProps,
            angle1,
            speed1: e.ecl.bulletProps.speed1 + game.rng.range(e.ecl.bulletProps.speed2)
          }, origin);
          angle1 -= (Math.PI / 6) * pos;
        }
        game.audio?.sfx(16);
      }
      c.var2++;
    }
    setPatchouliShotVars(game, e) {
      const table = [
        [[0, 3, 1], [2, 3, 4]],
        [[1, 4, 0], [4, 2, 3]]
      ];
      const selected = Math.max(0, game.selected | 0);
      const character = selected >= 2 ? 1 : 0;
      const shot = selected & 1;
      const vars = table[character][shot];
      e.ecl.ctx.var1 = vars[0];
      e.ecl.ctx.var2 = vars[1];
      e.ecl.ctx.var3 = vars[2];
    }
    rotateStage5(v, angle) {
      const c = Math.cos(angle);
      const s = Math.sin(angle);
      return { x: v.x * c + v.y * s, y: -v.x * s + v.y * c };
    }
    runStage5Func5(game, e) {
      const c = e.ecl.ctx;
      const easyOrNormal = eclDifficultyIndex(game) <= 1;
      if (c.var2 % 9 === 0) {
        const pattern = Math.trunc(c.var2 / 9);
        const toPlayer = { x: game.player.x - e.x, y: game.player.y - e.y };
        const len = Math.hypot(toPlayer.x, toPlayer.y) || 1;
        const dir = { x: toPlayer.x / len, y: toPlayer.y / len };
        const side = (pattern & 1) ? -256 : 256;
        let matrixIn = { x: -dir.x * side, y: -dir.y * side };
        const baseOffset = {
          x: toPlayer.x * (0.5 - pattern * 0.5 / 9) + dir.x * side,
          y: toPlayer.y * (0.5 - pattern * 0.5 / 9) + dir.y * side
        };
        matrixIn = this.rotateStage5(matrixIn, Math.PI / 4);
        let bulletAngle = -Math.PI / 4;
        const props = {
          sprite: 8,
          offset: 3,
          count1: easyOrNormal ? 1 : 3,
          count2: 1,
          speed1: 2,
          speed2: 0.3,
          angle1: 0,
          angle2: Math.PI / 6,
          flags: 0,
          exInts: [0, 0, 0, 0],
          exFloats: [0, 0, 0, 0],
          aimMode: 0
        };
        for (let i = 0; i < 9; i++, bulletAngle += Math.PI / 18) {
          matrixIn = this.rotateStage5(matrixIn, -Math.PI / 18);
          const angle1 = (pattern & 1) && easyOrNormal ? bulletAngle : props.angle1;
          this.spawnBullets(game, e, { ...props, angle1 }, {
            x: e.x + baseOffset.x + matrixIn.x,
            y: e.y + baseOffset.y + matrixIn.y
          });
        }
        game.audio?.sfx(7);
      }
      c.var2++;
    }
    runStage6EffectCloud(game, e, repeated) {
      e.ecl.exFunc6Angle = normalizeAngle((e.ecl.exFunc6Angle || 0) + DEG);
      if (e.ecl.exFunc6Angle >= Math.PI / 4) e.ecl.exFunc6Angle = normalizeAngle(e.ecl.exFunc6Angle - Math.PI / 2);
      const t = e.ecl.exFunc6Timer++;
      if (!repeated || t > 120 || (t > 60 && t % 2 === 0) || (t > 30 && t % 4 === 0) || t % 8 === 0) {
        const half = Math.trunc((t % 16) / 2);
        const seed = rngU16InRange(game.rng, half) + half;
        const distance = seed * 10 + 32;
        const angle = normalizeAngle(e.ecl.exFunc6Angle - seed * Math.PI / 40);
        for (const side of [-1, 1]) {
          const vx = (game.rng.f() * 40 - 20) / 60;
          const vy = (8 * seed) / 60 - 4 / 15;
          game.spawnEffectParticles?.(
            19,
            e.x + Math.cos(angle) * distance * side,
            e.y + Math.sin(angle) * distance,
            1,
            0xff2020ff,
            {
              randomIndex: 0,
              angle: 0,
              vx,
              vy,
              ax: -vx / 120,
              ay: -vy / 120
            }
          );
        }
      }
    }
    runStage6BombShield(game, e, repeated) {
      if (e.hp <= 0) return;
      this.runStage6EffectCloud(game, e, repeated);
      if ((game.activeBombs?.length || 0) > 0) {
        e.ecl.interactable = false;
        e.ecl.exFunc10Timer = 60;
      } else if (e.ecl.exFunc10Timer > 0) {
        e.ecl.exFunc10Timer--;
        if (e.ecl.exFunc10Timer <= 0) e.ecl.interactable = true;
      }
    }
    runStageXFunc13(game, e, param) {
      if (!e.ecl.bulletProps) return;
      const c = e.ecl.ctx;
      const count = param | 0;
      let angle = c.float2;
      if (c.var3 % 6 === 0) {
        for (let i = 0; i < count; i++, angle += TAU / count) {
          this.spawnBullets(game, e, {
            ...e.ecl.bulletProps,
            angle1: angle + c.float1
          }, {
            x: 192 + Math.cos(angle) * c.float3,
            y: 224 + Math.sin(angle) * c.float3
          });
        }
      }
      c.var3++;
    }
    runStageXFunc14(game, e) {
      const c = e.ecl.ctx;
      c.var3 = 0;
      if (!e.ecl.bulletProps) return;
      for (const laser of e.ecl.lasers || []) {
        if (!laser?.inUse) continue;
        let offset = laser.startOffset;
        while (laser.endOffset > offset) {
          this.spawnBullets(game, e, e.ecl.bulletProps, {
            x: laser.x + Math.cos(laser.angle) * offset,
            y: laser.y + Math.sin(laser.angle) * offset
          });
          offset += 48;
        }
        c.var3++;
      }
    }
    runStageXFunc15(game, e, repeated) {
      const c = e.ecl.ctx;
      let total = 0;
      const bullets = game.enemyBullets || [];
      for (const large of bullets) {
        if (!this.bulletIsLarge(large)) continue;
        total++;
        const largeAngle = Math.atan2(large.y - e.y, large.x - e.x);
        for (const bullet of bullets) {
          if (this.bulletIsLarge(bullet) || Math.abs(bullet.speed || 0) > 0.0001) continue;
          if (Math.hypot(bullet.x - large.x, bullet.y - large.y) >= 64) continue;
          const bulletAngle = Math.atan2(bullet.y - e.y, bullet.x - e.x);
          const angle = (bulletAngle - largeAngle) * 2.2 + largeAngle;
          const nextOffset = (bullet.eclOffset ?? 0) + 1;
          this.setBulletOffset(bullet, nextOffset);
          bullet.flags = (bullet.flags || 0) | 0x10;
          bullet.exInts = [120, ...(bullet.exInts || []).slice(1)];
          bullet.exFloats = [0.01, angle, -1, -1];
          bullet.angle = normalizeAngle(angle);
          bullet.speed = 0.01;
          bullet.age = 0;
        }
      }
      this.runStage6BombShield(game, e, repeated);
      c.var3 = total;
    }
    runStageXFunc16(game, e, param) {
      const c = e.ecl.ctx;
      const remainingLife = e.ecl.bossTimer >= 7200 ? 0 : Math.max(0, e.hp | 0);
      if ((param | 0) === 0) {
        c.float3 = 2 - remainingLife / 6000;
        c.var5 = Math.trunc(remainingLife * 240 / 6000 + 40);
      } else {
        let range = 320 - remainingLife * 160 / 6000;
        c.float2 = game.rng.range(range) + (192 - range / 2);
        range = 128 - remainingLife * 64 / 6000;
        c.float3 = game.rng.range(range) + (96 - range / 2);
      }
    }
    runExInstruction(game, e, index, param) {
      const repeated = arguments[4] === true;
      if (index === 0) {
        game.spawnEffectParticles?.(12, e.x, e.y, 1, 0xffffffff);
        for (const bullet of game.enemyBullets || []) {
          const rect = this.bulletRect(bullet.eclSprite ?? 0, 15);
          if (rect) {
            bullet.eclOffset = 15;
            bullet.rect = rect;
            bullet.r = Math.max(rect.w, rect.h) / 2;
            const grazeSize = TH06_LOGIC.bulletGrazeSize(bullet.eclSprite ?? 0, rect.h);
            bullet.grazeSize = grazeSize;
            bullet.hitR = Math.max(grazeSize.x, grazeSize.y) / 2;
          }
          if (param === 0) {
            bullet.vx = 0;
            bullet.vy = 0;
            bullet.speed = 0;
          } else if (param === 1) {
            bullet.flags = (bullet.flags || 0) | 0x10;
            bullet.exInts = [220, ...(bullet.exInts || []).slice(1)];
            bullet.exFloats = [0.01, game.rng.range(TAU) - Math.PI, -1, -1];
            bullet.age = 0;
          }
        }
      } else if (index === 1 && e.ecl.bulletProps) {
        const range = Math.max(0, param | 0);
        const origin = {
          x: e.x + game.rng.range(range) - range / 2,
          y: e.y + game.rng.range(range * 0.75) - range * 0.375
        };
        this.spawnBullets(game, e, e.ecl.bulletProps, origin);
      } else if (index === 2) {
        this.runStage3StarPattern(game, e);
      } else if (index === 3) {
        this.setPatchouliShotVars(game, e);
      } else if (index === 4) {
        if ((param | 0) < 2) {
          game.spawnEffectParticles?.(12, e.x, e.y, 1, 0xffffffff);
          game.timeStopped = !!(param & 0xff);
        } else {
          const easyOrNormal = eclDifficultyIndex(game) <= 1;
          let changed = easyOrNormal ? 14 : 52;
          for (const bullet of game.enemyBullets || []) {
            if (changed <= 0) break;
            if (!this.bulletIsLarge(bullet) || bullet.eclOffset === 5 || rngU16InRange(game.rng, 4) !== 0) continue;
            this.setBulletOffset(bullet, 5);
            const dist = Math.hypot(bullet.x - game.player.x, bullet.y - game.player.y);
            const angle = dist > 128
              ? (easyOrNormal ? game.rng.range(Math.PI * 0.75) + Math.PI / 4 : game.rng.range(TAU) - Math.PI)
              : Math.atan2(bullet.y - game.player.y, bullet.x - game.player.x) + Math.PI / 2 + game.rng.range(TAU) - Math.PI;
            this.setBulletVelocity(bullet, angle, bullet.speed || 1);
            changed--;
          }
        }
        e.ecl.ctx.var2 = 0;
      } else if (index === 5) {
        this.runStage5Func5(game, e);
      } else if (index === 6) {
        this.runStage6EffectCloud(game, e, repeated);
      } else if (index === 10) {
        this.runStage6BombShield(game, e, repeated);
      } else if (index === 7) {
        const easyOrNormal = eclDifficultyIndex(game) <= 1;
        const randomAngle = game.rng.range(TAU) - Math.PI;
        for (let ring = 0; ring < 2; ring++) {
          let laserAngle = (ring === 0 ? -Math.PI : -Math.PI * 7 / 8) + randomAngle;
          const angleDiff = ring === 0 ? Math.PI / 4 : -Math.PI / 4;
          const bases = [];
          for (let i = 0; i < 8; i++, laserAngle += Math.PI / 4) {
            bases.push({ x: e.x + Math.cos(laserAngle) * 32, y: e.y + Math.sin(laserAngle) * 32 });
          }
          laserAngle = (ring === 0 ? -Math.PI : -Math.PI * 7 / 8) + randomAngle;
          for (let pass = 0; pass < 3; pass++) {
            const length = pass < 2 ? 112 : 480;
            for (let i = 0; i < 8; i++) {
              const pos = bases[i];
              if ((param | 0) === 0) {
                this.spawnLaserPattern(game, e, pos, laserAngle, {
                  color: easyOrNormal ? 2 : 8,
                  endOffset: easyOrNormal ? length : 440,
                  startLength: easyOrNormal ? length : 440,
                  width: easyOrNormal ? 28 : 20,
                  startTime: pass * 16 + 60,
                  duration: 90 - pass * 16
                });
              } else {
                this.spawnStoredPatternAt(game, e, pos.x, pos.y);
              }
              pos.x += Math.cos(laserAngle) * length;
              pos.y += Math.sin(laserAngle) * length;
              laserAngle += Math.PI / 4;
            }
            laserAngle += angleDiff - TAU;
          }
        }
      } else if (index === 8) {
        let changed = 0;
        const large = [...(game.enemyBullets || [])].filter((bullet) => this.bulletIsLarge(bullet));
        for (const bullet of large) {
          this.spawnStoredPatternAt(game, e, bullet.x, bullet.y, {
            sprite: 3,
            offset: 1,
            count1: 1,
            count2: 1,
            speed1: 0,
            speed2: 0,
            angle1: game.rng.range(TAU) - Math.PI,
            angle2: 0,
            flags: 8,
            aimMode: 1
          });
          changed++;
        }
        e.ecl.ctx.var3 = changed;
      } else if (index === 9 || index === 11) {
        const randomAngle = game.rng.range(TAU) - Math.PI;
        game.spawnEffectParticles?.(12, e.x, e.y, 1, 0xffffffff);
        for (const bullet of game.enemyBullets || []) {
          if (this.bulletIsLarge(bullet) || Math.abs(bullet.speed || 0) > 0.0001) continue;
          this.setBulletOffset(bullet, 2);
          bullet.flags = (bullet.flags || 0) | 0x10;
          bullet.exInts = [120, ...(bullet.exInts || []).slice(1)];
          const dist = Math.hypot(e.x - bullet.x, e.y - bullet.y);
          const angle = index === 9 ? dist * Math.PI / 256 + randomAngle : game.rng.range(TAU) - Math.PI;
          bullet.exFloats = [0.01, angle, -1, -1];
          bullet.speed = 0.01;
          bullet.age = 0;
        }
      } else if (index === 12) {
        for (const laser of e.ecl.lasers || []) {
          if (!laser?.inUse) continue;
          this.spawnStoredPatternAt(game, e, e.x + Math.cos(laser.angle) * 64, e.y + Math.sin(laser.angle) * 64);
        }
      } else if (index === 13) {
        this.runStageXFunc13(game, e, param);
      } else if (index === 14) {
        this.runStageXFunc14(game, e);
      } else if (index === 15) {
        this.runStageXFunc15(game, e, repeated);
      } else if (index === 16) {
        this.runStageXFunc16(game, e, param);
      }
    }
    spawnLaser(game, e, op, a) {
      const x = e.x + e.ecl.shootOffset.x;
      const y = e.y + e.ecl.shootOffset.y;
      let angle = this.getFloat(e, a + 4);
      if (op === 86) angle += Math.atan2(game.player.y - y, game.player.x - x);
      const laser = {
        id: game.id++,
        ownerId: e.id,
        inUse: true,
        sprite: this.getShort(e, a),
        color: this.getShort(e, a + 2),
        x,
        y,
        angle: normalizeAngle(angle),
        speed: this.getFloat(e, a + 8),
        startOffset: this.getFloat(e, a + 12),
        endOffset: this.getFloat(e, a + 16),
        startLength: this.getFloat(e, a + 20),
        width: this.getFloat(e, a + 24),
        startTime: this.ecl.view.i32(a + 28),
        duration: this.ecl.view.i32(a + 32),
        despawnDuration: this.ecl.view.i32(a + 36),
        hitboxStartTime: this.ecl.view.i32(a + 40),
        hitboxEndDelay: this.ecl.view.i32(a + 44),
        flags: this.ecl.view.i32(a + 48),
        state: this.ecl.view.i32(a + 28) === 0 ? 1 : 0,
        timer: 0,
        visualWidth: 1.2,
        hitboxLength: 0
      };
      e.ecl.lasers[e.ecl.laserStore] = laser;
      game.enemyLasers.push(laser);
    }
    spawnChildEnemy(game, parent, a) {
      const subId = this.ecl.view.i32(a);
      this.spawnEclEnemy(game, {
        subId,
        x: this.getFloat(parent, a + 4),
        y: this.getFloat(parent, a + 8),
        z: this.getFloat(parent, a + 12),
        life: this.ecl.view.i16(a + 16),
        item: this.ecl.view.i16(a + 18),
        score: this.ecl.view.i32(a + 20),
        mirrored: false
      });
    }
    killEnemy(game, e) {
      const s = e.ecl;
      if (!this.enemyUsesNormalDeath(e)) {
        if (s.deathCallbackSub >= 0) {
          const sub = s.deathCallbackSub;
          s.deathCallbackSub = -1;
          this.callCallbackSub(s, sub);
          return true;
        }
        return false;
      }
      if (s.deathCallbackSub >= 0) {
        game.spawnEnemyDeathEffect?.(e, s);
        e.hp = 1;
        s.lifeCallbackThreshold = -1;
        s.timerCallbackThreshold = -1;
        this.resetCallbackRanks(s);
        this.callCallbackSub(s, s.deathCallbackSub);
        s.stack.length = 0;
        s.deathCallbackSub = -1;
        return true;
      }
      if (game.addScore) game.addScore(e.score || 0);
      else game.score += e.score || 0;
      if (s.isBoss && game.spellcardInfo?.isActive) game.endBossSpell?.({ fromBossDeath: true });
      if (s.isBoss && s.bossSlot != null && this.bossSlots[s.bossSlot] === e) this.bossSlots[s.bossSlot] = null;
      if (s.isBoss) game.setBossPresent?.(false, e);
      game.spawnEnemyDeathEffect?.(e, s);
      const drops = this.dropTypes(s.itemDrop);
      for (const drop of drops) {
        this.spawnSourceItem(game, drop, e.x, e.y);
      }
      if (s.isBoss) game.enemyBullets = [];
      return false;
    }
    spawnSourceItem(game, type, x, y, options = {}) {
      if (game.spawnItem) return game.spawnItem(type, x, y, options);
      const item = {
        id: game.id++,
        x,
        y,
        vx: options.vx ?? 0,
        vy: options.vy ?? -2.2,
        type,
        age: 0,
        state: options.state ?? 0
      };
      game.items?.push(item);
      return item;
    }
    turnBulletsIntoPointItems(game) {
      if (game.turnBulletsIntoPointItems) {
        game.turnBulletsIntoPointItems();
        return;
      }
      for (const b of game.enemyBullets || []) this.spawnSourceItem(game, 'pointBullet', b.x, b.y, { state: 1 });
      game.enemyBullets = [];
      for (const l of game.enemyLasers || []) {
        if (!l.inUse || l.state >= 2) continue;
        for (let off = l.startOffset || 0; (l.endOffset || 0) > off; off += 32) {
          this.spawnSourceItem(game, 'pointBullet', l.x + Math.cos(l.angle || 0) * off, l.y + Math.sin(l.angle || 0) * off, { state: 1 });
        }
        l.state = 2;
        l.timer = 0;
        l.hitboxEndDelay = 0;
      }
    }
    dropPowerItems(game, e, count) {
      const total = Math.max(0, count | 0);
      for (let i = 0; i < total; i++) {
        const x = e.x + game.rng.range(144) - 72;
        const y = e.y + game.rng.range(144) - 72;
        const type = game.power < 128 ? (i === 0 ? 'bigPower' : 'power') : 'point';
        this.spawnSourceItem(game, type, x, y);
      }
    }
    dropTypes(itemDrop) {
      if (itemDrop === -1 || itemDrop === 0xffff) {
        const out = [];
        if (this.randomSpawnIndex++ % 3 === 0) out.push(RANDOM_ITEMS[this.randomItemIndex++ % RANDOM_ITEMS.length]);
        return out;
      }
      if (itemDrop === -2 || itemDrop === 0xfffe) return [];
      const type = ITEM_TABLE[itemDrop];
      return type ? [type] : [];
    }
    bulletRect(sprite, offset) {
      if (sprite === 9) {
        const rect = this.effectParticleAnm.scriptSprite(0, offset, 0, { keepExitSprite: true });
        return rect ? { ...rect, imageKey: 'etama4' } : null;
      }
      const rect = this.bulletAnm.scriptSprite(sprite, offset, 0, { keepExitSprite: true });
      return rect ? { ...rect, imageKey: 'etama3' } : null;
    }
    bulletSpawnEffect(sprite, flags) {
      let kind = null;
      let state = 1;
      let moveScale = 1;
      if (flags & 2) {
        kind = 'fast';
        state = 2;
        moveScale = 1 / 2;
      } else if (flags & 4) {
        kind = 'normal';
        state = 3;
        moveScale = 1 / 2.5;
      } else if (flags & 8) {
        kind = 'slow';
        state = 4;
        moveScale = 1 / 3;
      }
      if (!kind) return { state, duration: 0, moveScale, script: -1, imageKey: null };
      const spec = BULLET_SPAWN_EFFECTS[clamp(sprite | 0, 0, BULLET_SPAWN_EFFECTS.length - 1)];
      const anm = spec.imageKey === 'etama4' ? this.effectParticleAnm : this.bulletAnm;
      const script = spec[kind];
      return {
        state,
        duration: Math.max(1, anm.scriptDuration(script)),
        moveScale,
        script,
        imageKey: spec.imageKey
      };
    }
    enemyScriptRect(script, frame, interrupt = null, keepExitSprite = true) {
      const options = { keepExitSprite };
      if (interrupt) {
        options.interrupt = interrupt.value;
        options.interruptFrame = interrupt.frame || 0;
      }
      const primary = script >= 128 ? this.enemy2Anm : this.enemyAnm;
      const primaryKey = script >= 128 ? 'enemy2' : 'enemy';
      const fallback = script >= 128 ? this.enemyAnm : this.enemy2Anm;
      const fallbackKey = script >= 128 ? 'enemy' : 'enemy2';
      const rect = primary.scriptSprite(script, 0, frame, options);
      if (rect) return { ...rect, imageKey: primaryKey };
      const fallbackRect = fallback.scriptSprite(script, 0, frame, options);
      return fallbackRect ? { ...fallbackRect, imageKey: fallbackKey } : null;
    }
    enemyRect(e) {
      const script = e.ecl?.currentAnm ?? 0;
      const frame = e.ecl?.anmFrame || e.frame || 0;
      const interrupt = e.ecl?.anmInterrupt;
      return this.enemyScriptRect(script, frame, interrupt?.slot === -1 ? interrupt : null, true);
    }
    enemySlotRects(e, start = 0, end = 8) {
      const slots = e.ecl?.anmSlots || [];
      const rects = [];
      for (let slot = Math.max(0, start | 0); slot < Math.min(8, end | 0); slot++) {
        const entry = slots[slot];
        if (!entry) continue;
        const rect = this.enemyScriptRect(entry.script, entry.frame || 0, entry.interrupt || null, false);
        if (rect) rects.push(rect);
      }
      return rects;
    }
    effectSpec(effectId) {
      const id = clamp(effectId | 0, 0, EFFECT_SCRIPT_TABLE.length - 1);
      return {
        id,
        script: EFFECT_SCRIPT_TABLE[id],
        callback: EFFECT_CALLBACK_TABLE[id],
        life: EFFECT_LIFE_TABLE[id],
        anm: id === 16 ? this.effectStageAnm : this.effectParticleAnm,
        imageKey: id === 16 ? this.effectStageImageKey : 'etama4'
      };
    }
    effectFrame(effectId, frame = 0, randomIndex = 0, color = 0xffffffff) {
      const spec = this.effectSpec(effectId);
      const rect = spec.anm?.scriptFrame(spec.script, 0, frame, { randomIndex, color });
      return rect ? { ...rect, imageKey: spec.imageKey, callback: spec.callback, life: spec.life } : null;
    }
    enemyKindFromAnm(script) {
      if (script >= 128) return 'midboss';
      if (script === 3 || script === 5 || script === 6 || script === 7) return 'fairyGreen';
      if (script === 1 || script === 2) return 'fairyBlue';
      return 'fairyRed';
    }
    comparePass(cmp, mode) {
      return mode === 0 ? cmp < 0 : mode === 1 ? cmp <= 0 : mode === 2 ? cmp === 0 : mode === 3 ? cmp > 0 : mode === 4 ? cmp >= 0 : cmp !== 0;
    }
    math(e, op, a) {
      const out = this.ecl.view.i32(a);
      const isFloat = op >= 20;
      const lhs = isFloat ? this.getFloat(e, a + 4) : this.getInt(e, a + 4);
      const rhs = isFloat ? this.getFloat(e, a + 8) : this.getInt(e, a + 8);
      let res = lhs;
      if (op === 13 || op === 20) res = lhs + rhs;
      else if (op === 14 || op === 21) res = lhs - rhs;
      else if (op === 15 || op === 22) res = lhs * rhs;
      else if (op === 16 || op === 23) res = rhs ? lhs / rhs : 0;
      else if (op === 17 || op === 24) res = rhs ? lhs % rhs : 0;
      else if (op === 18) res = this.getInt(e, a) + 1;
      else if (op === 19) res = this.getInt(e, a) - 1;
      if (isFloat) this.setFloat(e, out, res);
      else this.setInt(e, out, Math.trunc(res));
    }
    getInt(e, off) {
      const raw = this.ecl.view.i32(off);
      if (raw <= -10001 && raw >= -10025) return Math.trunc(this.varValue(e, raw));
      return raw;
    }
    getShort(e, off) {
      const raw = this.ecl.view.i16(off);
      if (raw <= -10001 && raw >= -10025) return Math.trunc(this.varValue(e, raw));
      return raw;
    }
    getFloat(e, off) {
      const raw = this.ecl.view.i32(off);
      if (raw <= -10001 && raw >= -10025) return Number(this.varValue(e, raw));
      const value = this.ecl.view.f32(off);
      const floatVarId = Math.trunc(value);
      if (Math.abs(value - floatVarId) < 0.00001 && floatVarId <= -10001 && floatVarId >= -10025) {
        return Number(this.varValue(e, floatVarId));
      }
      return value;
    }
    getSetValue(e, off, isFloatOpcode) {
      const raw = this.ecl.view.i32(off);
      if (raw <= -10001 && raw >= -10025) return this.varValue(e, raw);
      return isFloatOpcode ? this.ecl.view.f32(off) : raw;
    }
    varValue(e, id) {
      const c = e.ecl.ctx;
      if (id === -10001) return c.var0;
      if (id === -10002) return c.var1;
      if (id === -10003) return c.var2;
      if (id === -10004) return c.var3;
      if (id === -10005) return c.float0;
      if (id === -10006) return c.float1;
      if (id === -10007) return c.float2;
      if (id === -10008) return c.float3;
      if (id === -10009) return c.var4;
      if (id === -10010) return c.var5;
      if (id === -10011) return c.var6;
      if (id === -10012) return c.var7;
      if (id === -10013) return e.ecl.difficultyIndex ?? TH06_LOGIC.difficultyIndex();
      if (id === -10014) return TH06_GLOBAL.__touhouGameRank ?? 16;
      if (id === -10015) return e.x;
      if (id === -10016) return e.y;
      if (id === -10017) return e.z ?? 0;
      if (id === -10018) return TH06_GLOBAL.__touhouPlayerX ?? 192;
      if (id === -10019) return TH06_GLOBAL.__touhouPlayerY ?? 384;
      if (id === -10021) return Math.atan2((TH06_GLOBAL.__touhouPlayerY ?? 384) - e.y, (TH06_GLOBAL.__touhouPlayerX ?? 192) - e.x);
      if (id === -10022) return e.ecl.bossTimer;
      if (id === -10023) return Math.hypot((TH06_GLOBAL.__touhouPlayerX ?? 192) - e.x, (TH06_GLOBAL.__touhouPlayerY ?? 384) - e.y);
      if (id === -10024) return e.hp;
      if (id === -10025) return TH06_GLOBAL.__touhouShotType ?? 0;
      return id;
    }
    setInt(e, id, value) {
      const c = e.ecl.ctx;
      if (id === -10001) c.var0 = value;
      else if (id === -10002) c.var1 = value;
      else if (id === -10003) c.var2 = value;
      else if (id === -10004) c.var3 = value;
      else if (id === -10009) c.var4 = value;
      else if (id === -10010) c.var5 = value;
      else if (id === -10011) c.var6 = value;
      else if (id === -10012) c.var7 = value;
      else if (id === -10022) e.ecl.bossTimer = value;
      else if (id === -10024) e.hp = value;
    }
    setFloat(e, id, value) {
      const c = e.ecl.ctx;
      if (id === -10005) c.float0 = value;
      else if (id === -10006) c.float1 = value;
      else if (id === -10007) c.float2 = value;
      else if (id === -10008) c.float3 = value;
      else if (id === -10015) e.x = value;
      else if (id === -10016) e.y = value;
      else if (id === -10017) e.z = value;
    }
    setVar(e, id, value) {
      if ((id >= -10008 && id <= -10005) || (id >= -10017 && id <= -10015)) this.setFloat(e, id, Number(value));
      else this.setInt(e, id, Math.trunc(value));
    }
    readCString(off) {
      const bytes = this.ecl.view.bytes;
      let out = '';
      for (let i = off; i < bytes.length && bytes[i] && out.length < 96; i++) out += String.fromCharCode(bytes[i]);
      return out.replace(/[^\x20-\x7e]/g, '');
    }
  }

  TH06_GLOBAL.Th06Anm = Th06Anm;
  TH06_GLOBAL.Th06StageRuntime = Th06StageRuntime;
})();
