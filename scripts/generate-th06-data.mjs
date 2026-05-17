import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const source = join(root, 'reference/th06-original');
const outFile = join(root, 'src/vanilla/th06-data.js');

const common = {
  bulletAnm: 'etama3.anm',
  player0Anm: 'player00.anm',
  player1Anm: 'player01.anm'
};

const stages = [
  { stageNumber: 1, ecl: 'ecldata1.ecl', std: 'stage1.std', stageAnm: 'stg1bg.anm', enemyAnm: 'stg1enm.anm', enemy2Anm: 'stg1enm2.anm', msg: 'msg1.dat', bg: 'stg1bg', enemy: 'stg1enm', enemy2: 'stg1enm2', effect: 'eff01' },
  { stageNumber: 2, ecl: 'ecldata2.ecl', std: 'stage2.std', stageAnm: 'stg2bg.anm', enemyAnm: 'stg2enm.anm', enemy2Anm: 'stg2enm2.anm', msg: 'msg2.dat', bg: 'stg2bg', enemy: 'stg2enm', enemy2: 'stg2enm2', effect: 'eff02' },
  { stageNumber: 3, ecl: 'ecldata3.ecl', std: 'stage3.std', stageAnm: 'stg3bg.anm', enemyAnm: 'stg3enm.anm', msg: 'msg3.dat', bg: 'stg3bg', enemy: 'stg3enm', effect: 'eff03' },
  { stageNumber: 4, ecl: 'ecldata4.ecl', std: 'stage4.std', stageAnm: 'stg4bg.anm', enemyAnm: 'stg4enm.anm', msg: 'msg4.dat', bg: 'stg4bg', enemy: 'stg4enm', effect: 'eff04' },
  { stageNumber: 5, ecl: 'ecldata5.ecl', std: 'stage5.std', stageAnm: 'stg5bg.anm', enemyAnm: 'stg5enm.anm', enemy2Anm: 'stg5enm2.anm', msg: 'msg5.dat', bg: 'stg5bg', enemy: 'stg5enm', enemy2: 'stg5enm2', effect: 'eff05' },
  { stageNumber: 6, ecl: 'ecldata6.ecl', std: 'stage6.std', stageAnm: 'stg6bg.anm', enemyAnm: 'stg6enm.anm', enemy2Anm: 'stg6enm2.anm', msg: 'msg6.dat', bg: 'stg6bg', enemy: 'stg6enm', enemy2: 'stg6enm2', effect: 'eff05' }
];

function b64(name) {
  return readFileSync(join(source, name)).toString('base64');
}

const embeddedStages = Object.fromEntries(stages.map((stage) => {
  const payload = {
    stageNumber: stage.stageNumber,
    ecl: b64(stage.ecl),
    std: b64(stage.std),
    stageAnm: b64(stage.stageAnm),
    enemyAnm: b64(stage.enemyAnm),
    bulletAnm: b64(common.bulletAnm),
    player0Anm: b64(common.player0Anm),
    player1Anm: b64(common.player1Anm),
    msg: b64(stage.msg),
    assets: {
      stageBgKey: stage.bg,
      enemyKey: stage.enemy,
      effectKey: `${stage.effect}Anm`,
      effectImageKey: stage.effect
    }
  };
  if (stage.enemy2Anm) payload.enemy2Anm = b64(stage.enemy2Anm);
  if (stage.enemy2) payload.assets.enemy2Key = stage.enemy2;
  return [stage.stageNumber, payload];
}));

const data = {
  games: {
    th06: {
      stages: embeddedStages
    }
  }
};

writeFileSync(outFile, `globalThis.TH06_EMBEDDED_DATA = ${JSON.stringify(data, null, 2)};\n`);
