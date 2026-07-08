// Assembles the static-deploy tree in dist/pages/ from the TH07 runtime
// surface only: entry page, stylesheet, the built bundle, and the asset
// subset the browser actually loads. reference/, tests/, scripts/, and
// docs/ never ship.
import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const out = join(root, 'dist', 'pages');

const files = ['index.html', 'src/th07.css', 'dist/th07.js'];
const dirs = ['assets/th07-img', 'assets/audio/th07', 'assets/sfx/th07'];

if (!existsSync(join(root, 'dist/th07.js'))) {
  console.error('dist/th07.js missing — run `npm run build` first.');
  process.exit(1);
}

rmSync(out, { recursive: true, force: true });

let totalBytes = 0;
let count = 0;

function copyFile(rel) {
  const from = join(root, rel);
  const to = join(out, rel);
  if (!existsSync(from)) throw new Error(`Missing release file: ${rel}`);
  mkdirSync(dirname(to), { recursive: true });
  copyFileSync(from, to);
  totalBytes += statSync(to).size;
  count++;
}

function copyDir(rel) {
  for (const name of readdirSync(join(root, rel))) {
    const relPath = join(rel, name);
    if (statSync(join(root, relPath)).isDirectory()) copyDir(relPath);
    else copyFile(relPath);
  }
}

for (const f of files) copyFile(f);
for (const d of dirs) copyDir(d);
writeFileSync(join(out, '.nojekyll'), '');

const mib = (totalBytes / 1024 / 1024).toFixed(2);
console.log(`Prepared Pages tree at dist/pages: ${count} files, ${mib} MiB`);
