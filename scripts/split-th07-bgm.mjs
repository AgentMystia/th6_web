// Produces per-track BGM files under assets/audio/th07/ from
// reference/th07-original/thbgmogg.dat — a single continuous Ogg Vorbis
// encode of the original thbgm PCM timeline. Track boundaries and loop
// points come from thbgm.fmt (byte positions in 44.1kHz 16-bit stereo PCM,
// i.e. sample = byte / 4). Requires ffmpeg (dev tool only).
import { readFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const root = fileURLToPath(new URL('../', import.meta.url));
const source = join(root, 'reference/th07-original');
const outDir = join(root, 'assets/audio/th07');

// Tracks required by the current game scope (title, stage 1, stage 1 boss).
const TRACK_WHITELIST = new Set(['th07_01', 'th07_02', 'th07_03']);

export function parseThbgmFmt(buf) {
  const tracks = [];
  for (let o = 0; o + 52 <= buf.length; o += 52) {
    if (buf[o] === 0) break;
    const name = buf.toString('latin1', o, o + 16).replace(/\0.*$/, '');
    tracks.push({
      name: name.replace(/\.wav$/i, ''),
      start: buf.readUInt32LE(o + 16),
      checksum: buf.readUInt32LE(o + 20),
      loopStartBytes: buf.readUInt32LE(o + 24),
      lengthBytes: buf.readUInt32LE(o + 28),
      wFormatTag: buf.readUInt16LE(o + 32),
      channels: buf.readUInt16LE(o + 34),
      sampleRate: buf.readUInt32LE(o + 36),
      avgBytesPerSec: buf.readUInt32LE(o + 40),
      blockAlign: buf.readUInt16LE(o + 44),
      bitsPerSample: buf.readUInt16LE(o + 46)
    });
  }
  return tracks;
}

function main() {
  const fmt = parseThbgmFmt(readFileSync(join(source, 'thbgm.fmt')));
  mkdirSync(outDir, { recursive: true });
  const wav = join(tmpdir(), 'th07-thbgm-full.wav');
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', join(source, 'thbgmogg.dat'), wav]);
  for (const t of fmt) {
    if (!TRACK_WHITELIST.has(t.name)) continue;
    const startSample = Math.floor(t.start / 4);
    const endSample = Math.floor((t.start + t.lengthBytes) / 4);
    const out = join(outDir, `${t.name}.ogg`);
    execFileSync('ffmpeg', [
      '-y', '-loglevel', 'error', '-i', wav,
      '-af', `atrim=start_sample=${startSample}:end_sample=${endSample}`,
      '-c:a', 'libvorbis', '-q:a', '6', out
    ]);
    console.log(`${t.name}.ogg  samples=${endSample - startSample}  loopStart=${Math.floor(t.loopStartBytes / 4)}`);
  }
  rmSync(wav, { force: true });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
