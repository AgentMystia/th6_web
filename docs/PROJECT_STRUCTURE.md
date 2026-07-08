# Project Structure

The split exists so agents can instantly tell the runtime surface from
tooling and from the local-only reference corpus. Engineering rules live in
[../AGENTS.md](../AGENTS.md); this file is the map.

## Runtime surface (what the browser loads)

- `index.html` — static entry. Loads `dist/th07.js`; must keep working when
  opened directly from disk (no dev server required).
- `src/th07.css` — page shell and canvas scaling.
- `dist/th07.js` — esbuild IIFE bundle of `src/main.ts` (**generated** by
  `npm run build`; never hand-edited, never committed).
- `assets/th07-img/` — textures extracted from the original ANM files
  (`thanm -x7`) plus the JPEG backdrops shipped inside `Th07.dat`.
- `assets/audio/th07/` — BGM Oggs sliced sample-exactly from the original
  stream (`scripts/split-th07-bgm.mjs`).
- `assets/sfx/th07/` — original `se_*.wav` sound effects.

Browser code must not read from `reference/`, `tests/`, `scripts/`,
`docs/`, or `node_modules/`.

## Source tree (`src/`)

- `main.ts` — boot, scene switching (menu flow ↔ stage), and the
  `window.__TH07_TEST__` deterministic test hook (`?test=1`; `?menu=1`
  forces the menu flow under test; `?difficulty= ?shot= ?power=`).
- `core/` — `loop.ts` fixed-step 60 FPS loop, `input.ts` keyboard state
  with pressed-edge tracking, `rng.ts` the original 16-bit RNG port,
  `util.ts` math helpers.
- `formats/` — parsers for the original binary formats, one file each:
  `bin.ts` (reader), `anm.ts` (ANM v2 + `AnmRunner` script VM, entry-scoped
  script/sprite lookup), `ecl.ts` (subs + timelines), `std.ts` (stage
  geometry, camera/facing/fog keyframes, projection), `msg.ts` (dialogue),
  `sht.ts` (player shot data; layout documented in the header comment).
- `game/` — gameplay:
  - `eclvm.ts` — TH07 ECL VM (enemy behavior, bullets, bosses, spellcards,
    rank masks, register-window variables).
  - `stage-scene.ts` — the stage `GameHost`: update loop, collision/graze,
    items, scoring, and all stage rendering (3D STD background, sprites,
    HUD + screen frame). Largest file; background, HUD, and gameplay
    sections are deliberately grouped — coordinate file ownership when
    parallelizing work here.
  - `player.ts` — SHT-driven player (movement, fire tables, orbs, bombs,
    deathbomb), `cherry.ts` — Cherry/CherryMax/Cherry+ and the
    Supernatural Border state machine, `dialogue.ts` — MSG runner with
    portraits, `title-scene.ts` — title/difficulty/character menu flow from
    `title01.anm`, `assets.ts` — ANM/image/SHT registry, `types.ts` —
    shared entity types.
- `gfx/renderer.ts` — Canvas2D renderer: `drawSprite`/`drawAnmFrame`
  (**centered** anchor), textured-quad cells + fog for the background,
  tint cache, playfield clip. HUD blits convert to top-left anchoring at
  the call site.
- `audio/audio.ts` — Web Audio BGM with sample-loop points + pooled SFX.
- `data/th07-data.ts` — **generated** base64 bundle of the original
  binaries (ECL/STD/MSG/SHT + THTX-stripped ANMs) with the BGM loop table.
  Rebuild via `npm run generate-data`; never hand-edit.

The legacy TH06 app was removed from this branch (2026-07); it survives
in full on the `legacy-vanilla` branch.

## Tooling (`scripts/`)

- `dev-shot.mjs` — headless gameplay screenshot + state snapshot
  (`node scripts/dev-shot.mjs out.png 800 "difficulty=3" shoot`).
- `dev-menu.mjs` — edge-triggered menu navigation screenshots
  (`node scripts/dev-menu.mjs outdir "confirm@diff;2*down@lunatic"`).
- `audit-th07-player.mjs` — dumps every `.sht` shooter table through the
  real parser.
- `generate-th07-data.mjs` — rebuilds `src/data/th07-data.ts` from
  `reference/th07-original/` (strips ANM textures, verifies integrity).
- `split-th07-bgm.mjs` — decodes the BGM stream and slices per-track Oggs
  using the `thbgm.fmt` sample table.
- `pixel-report.mjs` — text-mode visual verification: samples named
  regions of a screenshot (640x480 game coordinates) and prints average
  color / brightness / texture % / distinct colors per region, so visual
  changes can be judged without viewing the image (baselines in
  AGENTS.md §5).
- `prepare-pages.mjs` — assembles the static-deploy tree in `dist/pages/`
  from runtime files only.

## Tests (`tests/`)

- `th07-cherry.test.mjs` — Cherry/Border state machine unit tests.
- `npm test` runs `node --test tests/*.test.mjs`; add new unit tests with
  that suffix. Browser-level verification lives in the `scripts/dev-*`
  tools rather than a test runner.

## Reference corpus (`reference/`, git-ignored, local-only)

- `th07-original/` — files unpacked from a legally owned TH07 copy
  (`thdat -x7 Th07.dat`); input for the generators.
- `ECL7/ DSTD7/ MSG7/ ANM7/` — readable disassemblies (`thecl -d7`,
  `thstd -d7`, `thmsg -d7`, `thanm -l7`); the ground truth for stage
  scripts, geometry, dialogue, and sprite/animation layout.
- `Th07.exe` — v1.00b executable for Ghidra constant recovery.
- TH06-era subdirectories may remain locally; only the `legacy-vanilla`
  branch uses them.

Tests and scripts may read `reference/` (and degrade gracefully without
it); browser code never does.
