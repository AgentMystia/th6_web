# Project Structure

This repository is split so agents can quickly tell runtime files from reference material.

## Runtime Surface

- `index.html`: static browser entry. It must keep working from `file://`.
- `src/styles.css`: page shell and canvas scaling.
- `src/vanilla/th06-data.js`: embedded Stage 1-6 binary data packages generated from `reference/th06-original/`.
- `src/vanilla/th06-runtime.js`: ECL/STD/ANM/MSG runtime parser and executor.
- `src/vanilla/th06-logic.js`: source-derived rules and data helpers.
- `src/vanilla/main.js`: input, fixed-step game loop, Canvas rendering, audio, HUD.
- `assets/th06-img/`: images loaded directly by the browser.
- `assets/audio/`: browser-loaded BGM files.
- `assets/sfx/`: WAV sound effects loaded directly by the browser.
- `scripts/generate-th06-data.mjs` and `scripts/generate-th06-effects-data.mjs`: rebuild embedded original-data bundles.
- `scripts/prepare-pages.mjs`: builds the Pages-ready `dist/` tree from the runtime files only.

Keep new files needed by the browser under `assets/` or `src/`. Avoid runtime reads from `reference/`.

## Reference Surface

- `reference/th06-master/`: decompiled/source reference used for code audits and tests.
- `reference/th06-original/`: full original extracted TH06 resource set for future data extraction.
- `reference/ECL/`: decompiled `.decl` scripts for readable ECL review.
- `reference/DSTD/`: decompiled `.dstd` scripts for readable STD/stage review.
- `reference/legacy-generated-assets/`: older generated/unused visual assets kept only for provenance.

Tests may read `reference/` to prove that runtime behavior still matches source. Browser code should not.

## Testing

- `npm run check`: JavaScript syntax checks.
- `npm test`: source-value tests plus runtime smoke, opcode coverage, score extend checks, and resource-drop totals.
- `npm run prepare-pages`: copies only browser runtime files into `dist/`; do not deploy `reference/`, `tests/`, or `docs/`.
