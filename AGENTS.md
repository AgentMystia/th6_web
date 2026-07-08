# AGENTS.md

Operating manual for AI agents and contributors. It encodes the working
rules, the verification loop, the file-format facts, and the orchestration
protocol that produced the current codebase. Follow it exactly; nearly
every rule in it was earned by a real defect.

## 1. Mission

Reimplement **Touhou Youyoumu ~ Perfect Cherry Blossom (TH07)** in
TypeScript for the browser, driven by the original game data. Stage 1 is
playable end-to-end (menus → difficulty select including Lunatic → stage →
Letty Whiterock); later stages are future scope.

**Default rule: reproduce the original game exactly.** Do not simplify,
rebalance, redesign, modernize, or approximate original behavior unless it
is explicitly approved here or requested by the user. The engine is
*data-driven*: original `.ecl/.std/.anm/.msg/.sht` binaries are embedded
(`src/data/th07-data.ts`) and executed by our parsers and VMs. Hand-written
behavior is a last resort and must carry a comment flagging it.

## 2. Authority order

When sources conflict, higher wins:

1. Current user instruction.
2. Approved modernizations (§3).
3. Original data and executable in `reference/`: readable disassemblies in
   `reference/ECL7|DSTD7|MSG7|ANM7`, raw unpacked files in
   `reference/th07-original/`, `reference/Th07.exe` (v1.00b) for Ghidra.
4. Existing project implementation.
5. External docs (thtk source, PyTouhou, priw8's sht-webedit docs, wikis) —
   cross-validation only, never sole authority. TH06 semantics are NOT
   TH07 semantics; several opcode tables differ (§6).

`reference/` is git-ignored, local-only, read-only. Never commit, ship, or
serve it. Browser runtime code must never read from it.

**Current implementation is not proof of correctness.** If the data says
otherwise, the implementation is wrong.

## 3. Approved modernizations

- Focus hitbox dot rendering while focused (collision identical).
- Dev/debug tooling (`?test=1` hook, `dev-shot`/`dev-menu` scripts) — must
  not change shipped gameplay behavior.
- Web Audio BGM looping via `loopStart/loopEnd` sample frames from
  `thbgm.fmt` instead of whole-file loops.
- Plain-text control hints on menu screens.

Nothing else. In particular: **no invented visual content**. If the data
has no moon, there is no moon. Absence of data gets a flagged fallback and
a report, not fabrication.

## 4. Non-negotiable invariants

Every commit must satisfy ALL of:

1. `npm run check` — zero TypeScript errors.
2. `npm run build` — clean esbuild bundle.
3. `npm test` — all unit tests pass.
4. Clean headless boot: `node scripts/dev-shot.mjs /tmp/s.png 300` prints a
   snapshot with enemies spawning and **no `PAGE ERRORS` line**.
5. No isolation hacks in the tree: no debugging early-`return`, no
   commented-out subsystems, no hardcoded test state. A crashed agent once
   left `return;` at the top of `drawBackground()` — it made all code after
   it unreachable, which disables TypeScript control-flow narrowing and
   produced seven phantom "possibly null" errors. Treat unreachable code as
   a build breaker.
6. Nothing from `reference/` committed — no bytes, no long decompiled
   listings. Recovered *constants* with a provenance comment
   (`// Th07.exe (v1.00b) @ 0x43cb30`) are fine and encouraged.
7. `index.html` keeps working as a static page (esbuild IIFE bundle, no
   ESM imports at runtime, no dev-server-only paths).

## 5. The verification loop (how quality actually happens)

Code that typechecks is not done. **Done means observed working.**

For any gameplay or visual change:

1. `npm run check && npm run build && npm test`.
2. Screenshot the affected states with the headless tools and **look at
   every screenshot yourself** (Read tool renders PNGs). Judge against the
   acceptance criteria before reporting anything.
3. Iterate until the screenshots match the criteria. A change nobody looked
   at is assumed broken — this project's worst regressions all shipped in
   changes that "compiled fine".

Tools (they serve the repo over a local static server and drive headless
Chromium at `/opt/pw-browsers/chromium-*/chrome-linux/chrome`; run
`npm run build` first — they load `dist/th07.js`):

- `node scripts/dev-shot.mjs <out.png> [frames] [query] [heldKeys]`
  Boots `index.html?test=1&<query>`, advances N frames (keys held per
  30-frame batch), screenshots 1280×960, prints a JSON snapshot (enemies,
  bullets, playerBullets + dump, boss, spellName, cherry, player) plus any
  page errors. Useful query params: `difficulty=0..3`, `shot=reimuA|…`,
  `power=0..128`, `menu=1`.
- `node scripts/dev-menu.mjs <outdir> "<step>;<step>;…"`
  Edge-triggered menu navigation (holding a key ≠ pressing it; menus need
  press edges). Step = `key@shotName` or `N*key@shotName`; keys:
  `up down left right confirm back`, plus `wait`. Screenshots and snapshot
  JSON per named step.
- `node scripts/audit-th07-player.mjs`
  Dumps all 12 `.sht` files through the real parser (header + every
  shooter record per power bracket) for regression diffing.

Standard stage checkpoints (frame → what must hold):

| frame | check |
|---|---|
| 120 | intro camera sweep; HUD labels cascaded in |
| 800 | cruise: full-width road, trees both sides, smooth fog horizon |
| 2500 | waves + item drops; Cherry+ readout counting |
| 3400 | dark-purple fog section (visibly darker than 800) |
| 5600–6200 | Letty: HP bar, spell banner, timer digits; boss-loop background with no fog-colored void anywhere |

Menus: title (frame ~130), difficulty with Lunatic highlighted, character
and shot-type steps, then confirm into the stage and verify the snapshot
shows `scene:"stage"` with the chosen difficulty/character.

## 6. Format facts (do not re-derive; do not assume TH06)

Established by disassembly of this game's own data and, where noted, the
executable. If an implementation fights these facts, the implementation is
wrong.

**Geometry.** Screen 640×480; playfield rect (32,16,384×448). Sprite ids in
multi-entry ANM files are entry-scoped on disk and offset by an entry base
at parse time.

**ANM v2** (`src/formats/anm.ts`): 64-byte entry headers; instruction
encoding `{u16 op, u16 totalLen, i16 time, u16 paramMask}`. Key ops: 3 set
sprite, 6 set position, **22 corner-relative anchor (top-left)**, 8/15
alpha/fade, 9 color, 16 blend, 17/18/19 interp moves, 20 wait-forever,
21 interrupt label (−1 = fallback), 23 hide+wait, 26/27 UV scroll,
30/31 render flags (safe no-ops), 32–36 formula interps (formula 0/7/255
linear, 1=x², 2=x³, 3=x⁴, 4=2x−x², 5=2x−x³, 6=2x−x⁴). `interrupt(id)`
jumps past the matching `ins_21(id)` and forces visible. **Multi-entry
files reuse on-disk script ids across entries** (title01.anm has five
different scripts named id 0) — always resolve scripts and sprites through
an entry-scoped lookup, never a flat id map.

**Anchors.** `Renderer#drawSprite`/`drawAnmFrame` center on (x,y) — entity
semantics. HUD/menu layout coordinates from ANM scripts are top-left
(`ins_22`). Convert at the call site (see `StageScene#blit`). Two separate
HUD reworks shipped half-a-sprite off before this was written down.

**STD** (`src/formats/std.ts`): world axes x lateral, y forward depth,
z height with **negative z = up**. **Quads extend from their position
corner by width/height** — position is NOT a center. (Center semantics
leaves the road's right half ungeometried wherever rows have single
instances — most of the stage and the whole boss loop.) Script ops:
5 camera-position keyframe (args are float bit-patterns even when the
disassembly prints ints), 6 interpolate camera to next keyframe
(duration, easing mode — same formula table as ANM), 7 facing as a
camera-relative direction vector, 8 facing interp, 1 fog (packed ARGB int,
near, far), 2 fog interp duration, 4 jump (loops the script clock;
stage 1 loops frames 5510→6022, a one-tile-exact seamless dolly),
11 FOV (30°). The sky IS the current fog color; cells ≥98% fogged are
skipped (the slack-expanded texture edges otherwise peek past the fog
overlay as streaks). Trees are ZUN sprite-stacking: flat stacked layers,
never billboards.

**ECL** (`src/game/eclvm.ts`, `src/formats/ecl.ts`): header
`{u16 subCount, u16 timelineCount, u32 offsets[16+subs]}`; sub instruction
`{u32 time, u16 id, u16 size, u16 rankMask, u16 paramMask}`. Variables use
a **register window**: locals 10000–10007, each sub call shifts the window
+8, children share the parent's array. Rank masks gate spawns by
difficulty — verify changes on Lunatic (`difficulty=3`), which exercises
paths lower ranks never touch. Spell names (op 90) are XOR-0xAA-obscured
Shift-JIS, terminated by a 0xAA byte.

**MSG** (`src/game/dialogue.ts`): ops 0 end, 1 portrait enter, 2 face,
3 text line, 4 wait, 5 portrait state, 6 ECL resume ticket, 7 BGM, 8 boss
intro, 11 hide portraits, 12 BGM fade, 13 skippability.

**SHT** (`src/formats/sht.ts`) — layout verified against priw8's
sht-webedit struct_07 and all 12 real files: 52-byte header
`{i16 ?, i16 levelCount, f32 bombsPerLife, i32 deathbombWindow(15/8/6 for
Reimu/Marisa/Sakuya), f32×8 hitbox/graze/autocollect/itemRadius/cherryLoss/
pocLine/speed/focusedSpeed/diag×2}` then `{u32 offset, u32 powerThreshold}`
pairs (brackets 8/16/32/48/64/80/96/128/999). Shooter record 52 bytes:
`{u16 interval, u16 delay, f32 x,y,hitboxW,hitboxH,angle,speed, i16 damage,
u8 orb, u8 shotType, i16 sprite, i16 sfxId, i32×4 funcs}`. **PCB's shot
timer runs a 60-frame cycle** (not TH06's 30); a delay-0 shooter fires on
the press frame itself. Player sprite ids are SHT sprite + 1024 base.
Bullet hitboxW/H are full widths; enemy-vs-player-bullet AABB is
`(enemyW + bulletW)/2`.

**Exe-recovered constants** (Ghidra, Th07.exe v1.00b — keep provenance
comments): unfocused orb offsets (±32, +8); focused options *orbit* at
radius 24 phase-shifted π/2 (rate unconfirmed — static approximation in
place, flagged); focus-toggle glide is 8 frames (x lerp, y eased); cherry
border trigger 50000 (0xC350), border duration 540 frames (0x21C) with
30-frame fades; point-item value `50000 − 100·|y − pocLine|` floored to
tens, min 100.

**HUD layout**: front.png sprite rects and resting coordinates are decoded
in `src/game/stage-scene.ts` (`FRONT`, `drawSidebar`, `drawFrame`) — labels
column x=432, digit font = ascii.png 8×12 glyphs at texture y=208 (digit d
at x=8d, pitch 8, no comma glyph), 東方妖々夢 logo at (480,208), caption at
(448,336), frame tiled from the 32×32 maroon tile + 128×16 strip (exact
integer fit), boss nameplates are ename.png rows (row 0 Cirno, row 1 Letty)
composited at (32,26), Cherry+ banner at (32,448) with the value
right-aligned into the blank slot ending at in-sprite x≈84 and the 50000
cap after the slash.

## 7. Approximations registry (known, flagged, improvable)

Each also has an inline comment at its code site. Do not silently "fix"
gameplay to taste — improve these only with better evidence (Ghidra, frame
comparisons against real play).

- Focused option *orbit rate* and orb-2 phase (exe shows orbit, rate
  unconfirmed) — static offsets used.
- STD easing-mode formulas for modes beyond those observed (0/1/4).
- Frame tiling positions (exact-fit math, engine placement not literal).
- HUD star icon x positions; spell-timer and fps exact placement.
- Cherry+ banner interrupt→state mapping (dim=charging, bright=border).
- Bombs are functionally accurate first-pass; per-type visuals and exact
  damage/cancel cadence not yet exe-verified.
- ECL per-frame damage cap 70 inherited from the TH06 family (op 142
  parameter suspected related, unconfirmed).
- `ins_30/31` render flags unknown (no-op everywhere, matches PyTouhou).

## 8. Pitfall catalog (check these FIRST when something looks wrong)

- **Half the geometry missing / one-sided rendering** → anchor or extent
  convention (corner vs center). §6 Anchors/STD.
- **HUD/menu elements uniformly shifted** → top-left vs centered blit.
- **Streaks or blocks near the horizon** → fog metric or fully-fogged
  cells being drawn; sky must equal fog color.
- **Everything animates from wrong positions after a script change** →
  entry-scoped script/sprite id collision (multi-entry ANM).
- **Phantom TypeScript null errors in one function** → unreachable code
  above (leftover debug `return`), which kills narrowing.
- **Shots fire late / wrong cadence** → 60-frame cycle, delay-0 fires on
  press frame, focused/unfocused table switch.
- **Boss fight background/state weirdness** → the STD clock *loops* via
  op 4; anything keyed to raw stage frame instead of the STD clock drifts.
- **Menu navigation skipping steps** → held-vs-pressed key edges; menus
  are edge-triggered with 20-frame delay/6-frame repeat.
- **A magic constant "fixes" positioning** → your decode is wrong. Delete
  the constant, re-read the disassembly. Every compensating hack we ever
  added (scroll speed, camera lift, ground mirroring, procedural moon) was
  masking a misread and got replaced by the real semantics.
- **`node --test tests/` fails but files pass individually** → it recurses
  into `tests/e2e/` (Playwright spec). Use `npm test`.

## 9. Orchestration protocol (multi-agent work)

The pattern that works: a **strong orchestrator** (planning, review,
integration) drives **executor agents** (Sonnet-class) with precise briefs.
Executors are excellent when the brief removes ambiguity and mandates the
verification loop; they fail when asked to "make it good" without
acceptance criteria, or when two of them share a file.

### Brief template (give every executor ALL of this)

1. **Context**: repo path, branch (never switch), build/test commands, and
   the §6 facts relevant to the task — paste them, don't cite them.
2. **File ownership**: exact list of files the agent may modify. Everything
   else is read-only. Two agents must never own the same file
   concurrently; sequence them instead. (`stage-scene.ts` is the usual
   contention point — background, HUD, and gameplay all live there.)
3. **Steps**: concrete, ordered, with tool paths (thanm/thstd/thecl if
   needed) and disassembly locations.
4. **Acceptance criteria**: the exact dev-shot/dev-menu invocations, the
   checkpoint frames, and what each screenshot must show. Require the agent
   to view its own screenshots and iterate — "visual quality is the
   deliverable".
5. **Constraints**: no new dependencies, no commits (orchestrator commits),
   match code style, comment only approximations/provenance, keep the tree
   compiling at every stop point.
6. **Report format**: what changed (file:line), what was verified and how,
   approximations made, anything unresolved. Findings the orchestrator
   must act on go at the top.

### Orchestrator duties

- Gather the decisive facts *before* delegating (read the disassembly
  yourself; a mis-briefed executor produces confident garbage — the
  "camera never moves" hack chain came from briefing TH06 op semantics
  for TH07 data).
- Review by looking at the executor's screenshots yourself. Never accept a
  textual "it looks right".
- Commit in reviewed checkpoints, one concern per commit, so a crashed or
  runaway agent can be rolled back cleanly.
- Assume agents can die mid-edit (session limits). After any crash:
  `git status` + `npm run check` before anything else; hunt for leftover
  isolation hacks (§4.5); decide keep/revert per file.
- Have executors write large findings to files (specs, dumps) rather than
  only their final message — a crashed agent's message is lost, its files
  survive.
- RE analysis agents (Ghidra, format decoding) should be read-only on
  `src/` where possible: deliver a spec file; a separate implementation
  pass applies it. The hud-spec.md → HUD rebuild flow worked exactly this
  way.

### Ghidra RE workflow (repeatable)

1. `reference/Th07.exe` (PE32, v1.00b). Install headless Ghidra (JDK 17+,
   `analyzeHeadless <proj> th07 -import Th07.exe`), or radare2 as
   fallback.
2. Anchor by immediates (e.g. 0xC350=50000, 0x21C=540) or IEEE-754 float
   bit patterns in `.data`/`.rdata` for coordinate tables; xref into
   functions; decompile; record address + one-line pseudo-C + constant +
   confidence (confirmed/probable/weak) in a scratch notes file.
3. Only **confirmed** values land in code, each with an address comment.
   Probable/weak go to §7 as flagged approximations.

## 10. Repo hygiene

- Runtime surface: `index.html`, `dist/` (generated — never hand-edit),
  `src/`, `assets/th07-img|audio/th07|sfx/th07`. Browser code must not
  read `reference/`, `tests/`, `scripts/`, `docs/`, `node_modules/`.
- Never commit: `reference/`, secrets, screenshots, logs, scratch scripts,
  `test-results/`, `dist/`.
- Keep diffs focused; no drive-by refactors. New scripts/tests only as
  intentional project files.
- Legacy TH06 app (`src/vanilla/`, `src/styles.css`, TH06 assets, TH06
  tests/scripts) is frozen — preserved on branch `legacy-vanilla`,
  scheduled for removal here. Don't invest in it; don't silently break
  `npm test` while it still covers both.
- Commit messages: what + why, present tense; mention the evidence
  (disassembly, exe address, screenshot checkpoint) that justified the
  change.

## 11. Handoff format

Every task ends with: what changed (files), evidence basis (data/exe/doc),
exact-or-approximate status per §7, verification actually run (commands +
checkpoints + whether screenshots were reviewed), and remaining gaps. If
validation was skipped anywhere, say so explicitly — an unverified change
is reported as unverified, never as done.
