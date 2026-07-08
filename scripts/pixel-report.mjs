// Text-mode visual verification: samples regions of a dev-shot screenshot
// and prints per-region statistics so correctness can be judged without
// looking at the image. Regions are given in 640x480 GAME coordinates and
// scaled to the screenshot size automatically.
//
//   node scripts/pixel-report.mjs <shot.png> [x,y,w,h:label ...]
//
// With no region args, runs the standard probe suite (playfield sky/ground
// symmetry, frame tiles, HUD labels/digits, logo, Cherry+ banner, player
// spawn zone). Interpretation guide and expected values: AGENTS.md §5.
import { readFileSync } from 'node:fs';
import { PNG } from 'pngjs';

const [file, ...regionArgs] = process.argv.slice(2);
if (!file) {
  console.error('usage: node scripts/pixel-report.mjs <shot.png> [x,y,w,h:label ...]');
  process.exit(1);
}
const png = PNG.sync.read(readFileSync(file));
const scale = png.width / 640; // dev-shot renders the 640x480 canvas scaled

const STANDARD = [
  '200,30,80,40:sky',
  '48,300,60,60:ground-left',
  '180,300,80,60:ground-center',
  '320,300,60,60:ground-right',
  '4,200,24,60:frame-left',
  '612,200,24,60:frame-right',
  '432,48,64,144:hud-labels',
  '504,48,80,32:hud-digits',
  '480,240,128,96:logo',
  '32,448,96,16:cherry-banner',
  '176,400,32,40:player-zone'
];

const specs = regionArgs.length ? regionArgs : STANDARD;

function stats(gx, gy, gw, gh) {
  const x0 = Math.round(gx * scale);
  const y0 = Math.round(gy * scale);
  const x1 = Math.min(png.width, Math.round((gx + gw) * scale));
  const y1 = Math.min(png.height, Math.round((gy + gh) * scale));
  let n = 0, rs = 0, gs = 0, bs = 0;
  const seen = new Set();
  const px = [];
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const i = (y * png.width + x) * 4;
      const r = png.data[i], g = png.data[i + 1], b = png.data[i + 2];
      rs += r; gs += g; bs += b; n++;
      px.push(r, g, b);
      // Quantize to 4 bits/channel for a robust distinct-color estimate.
      seen.add(((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4));
    }
  }
  if (!n) return null;
  const ar = rs / n, ag = gs / n, ab = bs / n;
  let far = 0;
  for (let i = 0; i < px.length; i += 3) {
    if (Math.abs(px[i] - ar) + Math.abs(px[i + 1] - ag) + Math.abs(px[i + 2] - ab) > 48) far++;
  }
  const hex = (v) => Math.round(v).toString(16).padStart(2, '0');
  const cx = Math.round((x0 + x1) / 2), cy = Math.round((y0 + y1) / 2);
  const ci = (cy * png.width + cx) * 4;
  return {
    avg: `#${hex(ar)}${hex(ag)}${hex(ab)}`,
    brightness: Math.round((ar + ag + ab) / 3),
    texture: Math.round((far / n) * 100), // % of pixels far from the mean = detail present
    colors: seen.size,
    center: `#${hex(png.data[ci])}${hex(png.data[ci + 1])}${hex(png.data[ci + 2])}`
  };
}

console.log(`${file}  ${png.width}x${png.height}  scale=${scale}`);
for (const spec of specs) {
  const [coords, label = spec] = spec.split(':');
  const [x, y, w, h] = coords.split(',').map(Number);
  const s = stats(x, y, w, h);
  if (!s) { console.log(`${label.padEnd(14)} out of bounds`); continue; }
  console.log(
    `${label.padEnd(14)} avg=${s.avg} bright=${String(s.brightness).padStart(3)} texture=${String(s.texture).padStart(3)}% colors=${String(s.colors).padStart(4)} center=${s.center}`
  );
}
