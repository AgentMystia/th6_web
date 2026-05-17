import { copyFileSync, existsSync, mkdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const dist = join(root, 'dist');

const files = [
  'index.html',
  'manifest.webmanifest',
  'sw.js',
  'src/styles.css',
  'src/vanilla/th06-data.js',
  'src/vanilla/th06-logic.js',
  'src/vanilla/th06-effects-data.js',
  'src/vanilla/th06-runtime.js',
  'src/vanilla/th06-player-data.js',
  'src/vanilla/main.js',

  'assets/th06-img/jpg/title00.jpg',
  'assets/th06-img/jpg/select00.jpg',
  'assets/th06-img/png/stg1bg.png',
  'assets/th06-img/png/stg2bg.png',
  'assets/th06-img/png/stg3bg.png',
  'assets/th06-img/png/stg4bg.png',
  'assets/th06-img/png/stg5bg.png',
  'assets/th06-img/png/stg6bg.png',
  'assets/th06-img/png/front.png',
  'assets/th06-img/png/player00.png',
  'assets/th06-img/png/player01.png',
  'assets/th06-img/png/stg1enm.png',
  'assets/th06-img/png/stg1enm2.png',
  'assets/th06-img/png/stg2enm.png',
  'assets/th06-img/png/stg2enm2.png',
  'assets/th06-img/png/stg3enm.png',
  'assets/th06-img/png/stg4enm.png',
  'assets/th06-img/png/stg5enm.png',
  'assets/th06-img/png/stg5enm2.png',
  'assets/th06-img/png/stg6enm.png',
  'assets/th06-img/png/stg6enm2.png',
  'assets/th06-img/png/etama3.png',
  'assets/th06-img/png/etama4.png',
  'assets/th06-img/png/eff01.png',
  'assets/th06-img/png/eff02.png',
  'assets/th06-img/png/eff03.png',
  'assets/th06-img/png/eff04.png',
  'assets/th06-img/png/eff05.png',
  'assets/th06-img/png/face00a.png',
  'assets/th06-img/png/face00b.png',
  'assets/th06-img/png/face00c.png',
  'assets/th06-img/png/face01a.png',
  'assets/th06-img/png/face01b.png',
  'assets/th06-img/png/face01c.png',
  'assets/th06-img/png/face03a.png',
  'assets/th06-img/png/face03b.png',
  'assets/th06-img/png/face05a.png',
  'assets/th06-img/png/face06a.png',
  'assets/th06-img/png/face06b.png',
  'assets/th06-img/png/face08a.png',
  'assets/th06-img/png/face08b.png',
  'assets/th06-img/png/face09a.png',
  'assets/th06-img/png/face09b.png',
  'assets/th06-img/png/face10a.png',
  'assets/th06-img/png/face10b.png',

  'assets/audio/stage1.mp3',
  'assets/audio/boss1.mp3',
  'assets/audio/th06_04.mp3',
  'assets/audio/th06_05.mp3',
  'assets/audio/th06_06.mp3',
  'assets/audio/th06_07.mp3',
  'assets/audio/th06_08.mp3',
  'assets/audio/th06_09.mp3',
  'assets/audio/th06_10.mp3',
  'assets/audio/th06_11.mp3',
  'assets/audio/th06_12.mp3',
  'assets/audio/th06_13.mp3',

  'assets/sfx/plst00.wav',
  'assets/sfx/enep00.wav',
  'assets/sfx/pldead00.wav',
  'assets/sfx/power0.wav',
  'assets/sfx/power1.wav',
  'assets/sfx/tan00.wav',
  'assets/sfx/tan01.wav',
  'assets/sfx/tan02.wav',
  'assets/sfx/ok00.wav',
  'assets/sfx/cancel00.wav',
  'assets/sfx/select00.wav',
  'assets/sfx/gun00.wav',
  'assets/sfx/cat00.wav',
  'assets/sfx/lazer00.wav',
  'assets/sfx/lazer01.wav',
  'assets/sfx/enep01.wav',
  'assets/sfx/nep00.wav',
  'assets/sfx/damage00.wav',
  'assets/sfx/item00.wav',
  'assets/sfx/kira00.wav',
  'assets/sfx/kira01.wav',
  'assets/sfx/kira02.wav',
  'assets/sfx/extend.wav',
  'assets/sfx/timeout.wav',
  'assets/sfx/graze.wav',
  'assets/sfx/powerup.wav'
];

rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });

let totalBytes = 0;
for (const rel of files) {
  const from = join(root, rel);
  const to = join(dist, rel);
  if (!existsSync(from)) throw new Error(`Missing release file: ${rel}`);
  mkdirSync(dirname(to), { recursive: true });
  copyFileSync(from, to);
  totalBytes += statSync(to).size;
}

writeFileSync(join(dist, '.nojekyll'), '');

const mib = (totalBytes / 1024 / 1024).toFixed(2);
console.log(`Prepared GitHub Pages dist: ${files.length} files, ${mib} MiB`);
