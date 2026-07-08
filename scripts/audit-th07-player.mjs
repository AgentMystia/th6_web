// Audit tool: dumps every field the project's real .sht parser (src/formats/sht.ts)
// extracts from all 12 original ply*.sht player-data files, for field-by-field
// cross-checking against the documented TH07 format and known PCB character facts.
//
// Usage: node scripts/audit-th07-player.mjs [outfile]
//   outfile defaults to stdout only; if given, the dump is written there too.
//
// This bundles the actual src/formats/sht.ts with esbuild (same approach as
// tests/th07-cherry.test.mjs) so the audit exercises the real parser, not a
// reimplementation of it.
import { execSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

mkdirSync('tests/.build', { recursive: true });
execSync('npx esbuild src/formats/sht.ts --bundle --format=esm --outfile=tests/.build/sht.mjs --log-level=silent');
const { Sht } = await import('../tests/.build/sht.mjs');

const DIR = new URL('../reference/th07-original/', import.meta.url);
const FILES = [
  'ply00a.sht', 'ply00as.sht', 'ply00b.sht', 'ply00bs.sht',
  'ply01a.sht', 'ply01as.sht', 'ply01b.sht', 'ply01bs.sht',
  'ply02a.sht', 'ply02as.sht', 'ply02b.sht', 'ply02bs.sht'
];

const lines = [];
const out = (s = '') => lines.push(s);

function fmtNum(n) {
  return Number.isInteger(n) ? String(n) : n.toFixed(4);
}

for (const name of FILES) {
  const bytes = readFileSync(new URL(name, DIR));
  const sht = new Sht(bytes);
  out('='.repeat(78));
  out(`${name}  (${bytes.length} bytes)`);
  out('-'.repeat(78));
  out('header:');
  out(`  bombs (bomb_per_life)     = ${fmtNum(sht.bombs)}`);
  out(`  deathbombWindow (frames)  = ${fmtNum(sht.deathbombWindow)}`);
  out(`  hitbox (half-width)       = ${fmtNum(sht.hitbox)}`);
  out(`  grazebox (half-width)     = ${fmtNum(sht.grazebox)}`);
  out(`  autocollectSpeed          = ${fmtNum(sht.autocollectSpeed)}`);
  out(`  itemRadius                = ${fmtNum(sht.itemRadius)}`);
  out(`  cherryLossOnDeath         = ${fmtNum(sht.cherryLossOnDeath)}`);
  out(`  pocLineY                  = ${fmtNum(sht.pocLineY)}`);
  out(`  speed (unfocused straight)= ${fmtNum(sht.speed)}`);
  out(`  focusedSpeed              = ${fmtNum(sht.focusedSpeed)}`);
  out(`  diagSpeed                 = ${fmtNum(sht.diagSpeed)}`);
  out(`  diagFocusedSpeed          = ${fmtNum(sht.diagFocusedSpeed)}`);
  out(`  levels (power brackets)   = ${sht.levels.length}`);
  out('');
  for (const level of sht.levels) {
    out(`  -- power <= ${level.power}  (${level.shots.length} shooters)`);
    for (const s of level.shots) {
      out(
        `     interval=${String(s.interval).padStart(3)} delay=${String(s.delay).padStart(3)} ` +
        `pos=(${fmtNum(s.x)},${fmtNum(s.y)}) hitbox=(${fmtNum(s.hitboxW)},${fmtNum(s.hitboxH)}) ` +
        `angle=${s.angle.toFixed(4)} speed=${fmtNum(s.speed)} dmg=${s.damage} ` +
        `orb=${s.orb} shotType=${s.shotType} sprite=${s.sprite} sfxId=${s.sfxId}`
      );
    }
  }
  out('');
}

const text = lines.join('\n') + '\n';
process.stdout.write(text);

const outfile = process.argv[2];
if (outfile) {
  writeFileSync(outfile, text);
  console.error(`\nwrote ${outfile}`);
}
