import type { AnmFrame } from '../formats/anm';

export const SCREEN_W = 640;
export const SCREEN_H = 480;
// Playfield rectangle inside the 640×480 frame (same as the original layout).
export const PLAYFIELD = { x: 32, y: 16, width: 384, height: 448 } as const;

export interface DrawOptions {
  scaleMultiplier?: number;
  scaleX?: number;
  scaleY?: number;
  offsetX?: number;
  offsetY?: number;
  alpha?: number;
  color?: number;
  rotation?: number;
  blend?: GlobalCompositeOperation;
}

function colorParts(color: number): { r: number; g: number; b: number } {
  return { r: (color >> 16) & 0xff, g: (color >> 8) & 0xff, b: color & 0xff };
}

export class Renderer {
  readonly canvas: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;
  assets: Record<string, HTMLImageElement> = {};
  private tintCache = new Map<string, HTMLCanvasElement>();
  private tintCacheOrder: string[] = [];
  private tintImageIds = new WeakMap<HTMLImageElement, number>();
  private tintNextImageId = 1;
  private readonly tintCacheLimit = 384;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D context unavailable');
    this.ctx = ctx;
    ctx.imageSmoothingEnabled = false;
  }

  clear(color = '#000'): void {
    this.ctx.fillStyle = color;
    this.ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);
  }

  image(key: string): HTMLImageElement | null {
    return this.assets[key] ?? null;
  }

  drawImage(key: string, x: number, y: number, w?: number, h?: number): void {
    const img = this.assets[key];
    if (!img) return;
    this.ctx.drawImage(img, x, y, w ?? img.width, h ?? img.height);
  }

  // Draws an AnmFrame produced by AnmRunner.spriteFrame() at (x, y).
  drawAnmFrame(frame: AnmFrame | null, x: number, y: number, options: DrawOptions = {}): boolean {
    if (!frame) return false;
    const img = this.assets[frame.imageKey];
    if (!img) return false;
    const ctx = this.ctx;
    const scaleMul = options.scaleMultiplier ?? 1;
    const scaleX = (options.scaleX ?? frame.scaleX) * scaleMul;
    const scaleY = (options.scaleY ?? frame.scaleY) * scaleMul;
    const w = Math.max(0.001, Math.abs(frame.w * scaleX));
    const h = Math.max(0.001, Math.abs(frame.h * scaleY));
    const drawX = x + frame.vmX + frame.posOffsetX + (options.offsetX ?? 0);
    const drawY = y + frame.vmY + frame.posOffsetY + (options.offsetY ?? 0);
    const anchorX = frame.anchorTopLeft ? 0 : w / 2;
    const anchorY = frame.anchorTopLeft ? 0 : h / 2;
    const alpha = (options.alpha ?? 1) * (frame.alpha / 255);
    if (alpha <= 0) return false;
    const color = (options.color ?? frame.color) >>> 0;
    const tint = (color & 0x00ffffff) !== 0x00ffffff;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.globalCompositeOperation = options.blend ?? (frame.blendAdd ? 'lighter' : 'source-over');
    ctx.translate(drawX, drawY);
    ctx.rotate(options.rotation ?? frame.rotation);
    if (scaleX < 0 || frame.flipX) ctx.scale(-1, 1);
    if (scaleY < 0 || frame.flipY) ctx.scale(1, -1);
    if (tint) this.tintedSprite(img, frame.x, frame.y, frame.w, frame.h, -anchorX, -anchorY, w, h, color);
    else ctx.drawImage(img, frame.x, frame.y, frame.w, frame.h, -anchorX, -anchorY, w, h);
    ctx.restore();
    return true;
  }

  // Draws a raw sprite rect (for cases not driven by a script runner).
  drawSprite(imageKey: string, sx: number, sy: number, sw: number, sh: number, x: number, y: number, options: DrawOptions = {}): void {
    const img = this.assets[imageKey];
    if (!img) return;
    const ctx = this.ctx;
    const scaleX = (options.scaleX ?? 1) * (options.scaleMultiplier ?? 1);
    const scaleY = (options.scaleY ?? 1) * (options.scaleMultiplier ?? 1);
    const w = Math.abs(sw * scaleX);
    const h = Math.abs(sh * scaleY);
    ctx.save();
    ctx.globalAlpha = options.alpha ?? 1;
    ctx.globalCompositeOperation = options.blend ?? 'source-over';
    ctx.translate(x, y);
    if (options.rotation) ctx.rotate(options.rotation);
    if (scaleX < 0) ctx.scale(-1, 1);
    if (scaleY < 0) ctx.scale(1, -1);
    ctx.drawImage(img, sx, sy, sw, sh, -w / 2, -h / 2, w, h);
    ctx.restore();
  }

  private tintedSprite(img: HTMLImageElement, sx: number, sy: number, sw: number, sh: number, dx: number, dy: number, dw: number, dh: number, color: number): void {
    const cached = this.tintedSpriteCanvas(img, sx, sy, sw, sh, color);
    if (cached) this.ctx.drawImage(cached, 0, 0, cached.width, cached.height, dx, dy, dw, dh);
  }

  private tintedSpriteCanvas(img: HTMLImageElement, sx: number, sy: number, sw: number, sh: number, color: number): HTMLCanvasElement | null {
    let imageId = this.tintImageIds.get(img);
    if (!imageId) {
      imageId = this.tintNextImageId++;
      this.tintImageIds.set(img, imageId);
    }
    const width = Math.max(1, Math.ceil(sw));
    const height = Math.max(1, Math.ceil(sh));
    const key = `${imageId}:${sx}:${sy}:${sw}:${sh}:${color >>> 0}`;
    const hit = this.tintCache.get(key);
    if (hit) return hit;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    const c = colorParts(color);
    ctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, width, height);
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = `rgb(${c.r}, ${c.g}, ${c.b})`;
    ctx.fillRect(0, 0, width, height);
    ctx.globalCompositeOperation = 'destination-in';
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, width, height);
    ctx.globalCompositeOperation = 'source-over';
    this.tintCache.set(key, canvas);
    this.tintCacheOrder.push(key);
    while (this.tintCacheOrder.length > this.tintCacheLimit) {
      const oldKey = this.tintCacheOrder.shift();
      if (oldKey) this.tintCache.delete(oldKey);
    }
    return canvas;
  }

  text(str: string, x: number, y: number, options: { size?: number; color?: string; align?: CanvasTextAlign; stroke?: boolean; font?: string } = {}): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.font = `${options.size ?? 14}px ${options.font ?? '"MS Gothic", "Yu Gothic", monospace'}`;
    ctx.textAlign = options.align ?? 'left';
    ctx.textBaseline = 'top';
    if (options.stroke !== false) {
      ctx.strokeStyle = 'rgba(0, 0, 20, 0.9)';
      ctx.lineWidth = 3;
      ctx.strokeText(str, x, y);
    }
    ctx.fillStyle = options.color ?? '#fff';
    ctx.fillText(str, x, y);
    ctx.restore();
  }

  // Draws one texture-mapped triangle by solving the general 3-point affine
  // fit (source (u,v) -> destination (x,y)) and using it as the canvas
  // transform for an unclipped `drawImage(img, 0, 0)`, clipped to the
  // triangle path. Works for any non-degenerate triangle, not just ones
  // axis-aligned in UV space.
  private drawAffineTriangle(
    img: CanvasImageSource,
    u0: number, v0: number, x0: number, y0: number,
    u1: number, v1: number, x1: number, y1: number,
    u2: number, v2: number, x2: number, y2: number
  ): void {
    const denom = (u1 - u0) * (v2 - v0) - (u2 - u0) * (v1 - v0);
    if (!Number.isFinite(denom) || Math.abs(denom) < 1e-6) return;
    const a = ((x1 - x0) * (v2 - v0) - (x2 - x0) * (v1 - v0)) / denom;
    const b = ((y1 - y0) * (v2 - v0) - (y2 - y0) * (v1 - v0)) / denom;
    const c = ((u1 - u0) * (x2 - x0) - (u2 - u0) * (x1 - x0)) / denom;
    const d = ((u1 - u0) * (y2 - y0) - (u2 - u0) * (y1 - y0)) / denom;
    const e = x0 - a * u0 - c * v0;
    const f = y0 - b * u0 - d * v0;
    if (![a, b, c, d, e, f].every(Number.isFinite)) return;
    const ctx = this.ctx;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.closePath();
    ctx.clip();
    ctx.transform(a, b, c, d, e, f);
    ctx.drawImage(img, 0, 0);
    ctx.restore();
  }

  // Returns a tinted copy of an atlas sub-rect (cached), for use as the
  // source image of a textured-quad draw. Public wrapper around the same
  // tint cache drawAnmFrame uses.
  tintedRect(imageKey: string, sx: number, sy: number, sw: number, sh: number, color: number): HTMLCanvasElement | null {
    const img = this.assets[imageKey];
    if (!img) return null;
    return this.tintedSpriteCanvas(img, sx, sy, sw, sh, color);
  }

  // Perspective-correct-enough textured quad: two affine triangles sharing
  // the tl/br diagonal. `corners` and `src` must already be in the same
  // coordinate space (src in atlas pixels if `img` is the full atlas, or in
  // 0..w/0..h local pixels if `img` is a pre-tinted sub-canvas).
  drawTexturedQuadCell(
    img: CanvasImageSource,
    src: { u0: number; v0: number; u1: number; v1: number },
    corners: { tl: { x: number; y: number }; tr: { x: number; y: number }; bl: { x: number; y: number }; br: { x: number; y: number } }
  ): void {
    this.drawAffineTriangle(
      img,
      src.u0, src.v0, corners.tl.x, corners.tl.y,
      src.u1, src.v0, corners.tr.x, corners.tr.y,
      src.u0, src.v1, corners.bl.x, corners.bl.y
    );
    this.drawAffineTriangle(
      img,
      src.u1, src.v0, corners.tr.x, corners.tr.y,
      src.u1, src.v1, corners.br.x, corners.br.y,
      src.u0, src.v1, corners.bl.x, corners.bl.y
    );
  }

  // Flat-fills a projected quad with a translucent fog color (distance fog).
  fillFogQuad(
    corners: { tl: { x: number; y: number }; tr: { x: number; y: number }; bl: { x: number; y: number }; br: { x: number; y: number } },
    color: string,
    alpha: number
  ): void {
    if (alpha <= 0.003) return;
    const ctx = this.ctx;
    ctx.save();
    ctx.globalAlpha = Math.min(1, alpha);
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(corners.tl.x, corners.tl.y);
    ctx.lineTo(corners.tr.x, corners.tr.y);
    ctx.lineTo(corners.br.x, corners.br.y);
    ctx.lineTo(corners.bl.x, corners.bl.y);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  clipPlayfield(fn: () => void): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.beginPath();
    ctx.rect(PLAYFIELD.x, PLAYFIELD.y, PLAYFIELD.width, PLAYFIELD.height);
    ctx.clip();
    fn();
    ctx.restore();
  }
}
