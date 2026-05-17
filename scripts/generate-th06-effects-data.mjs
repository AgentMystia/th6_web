import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const source = join(root, 'reference/th06-original');
const outFile = join(root, 'src/vanilla/th06-effects-data.js');

function b64(name) {
  return readFileSync(join(source, name)).toString('base64');
}

const data = {
  etama4Anm: b64('etama4.anm'),
  eff01Anm: b64('eff01.anm'),
  eff02Anm: b64('eff02.anm'),
  eff03Anm: b64('eff03.anm'),
  eff04Anm: b64('eff04.anm'),
  eff05Anm: b64('eff05.anm')
};

writeFileSync(outFile, `(function () {
  const TH06_GLOBAL = typeof window !== 'undefined' ? window : globalThis;
  TH06_GLOBAL.TH06_EFFECT_DATA = ${JSON.stringify(data, null, 2)};
})();
`);
