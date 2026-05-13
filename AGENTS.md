# AGENTS.md

Rules for AI agents and contributors working on this repository.

## Mission

Recreate Touhou Koumakyou ~ The Embodiment of Scarlet Devil / TH06 on the Web.

Default rule: reproduce the original game exactly.

Approved modernizations are the only intentional deviations. Do not simplify, rebalance, redesign, reinterpret, modernize, or approximate original behavior unless it is explicitly allowed here or requested by the user.

## Authority Order

When sources conflict, use this priority order:

1. Current user instruction.
2. Approved Modernizations in this file.
3. Original TH06 reference corpus in `reference/`: original code, decompiled code, extracted data, unpacked files, assets, replay/golden evidence, and related local reference material.
4. Existing project implementation.
5. Internet or external documentation, for cross-validation only.

`reference/` is read-only and local-only. Do not modify, commit, ship, or expose it unless the user explicitly asks.

## Approved Modernizations

Only these intentional differences from the original game are currently approved:

- Player hitbox display: the player hitbox may be shown visually. The indicator must follow the real collision hitbox exactly and must not change collision behavior.
- Non-full-power Point of Collection: PoC may work below full power. Only this availability condition changes. Item value, item movement, scoring, drops, collection behavior, and surrounding systems must remain original unless explicitly changed by the user.
- Dev/debug tooling: allowed only as tooling. It must not change shipped gameplay behavior.

No other modernization is approved by default.

## Fidelity Rules

For gameplay, stages, UI, visuals, and audio, match the original for:

- frame timing, RNG, coordinates, angles, speed, acceleration
- spawn/despawn timing, movement, collision, hitboxes, damage
- enemy scripts, boss phases, spell behavior, drops, items, scoring
- player movement, shots, bombs, death, invulnerability, resources
- dialogue, UI, effects, animation, layering, blending, sound timing

Approximation is allowed only when exact reproduction is impossible because the reference is missing, contradictory, or the Web runtime cannot reproduce the original behavior. When approximating, document the mismatch, cause, chosen approximation, and future path to improve it.

Current implementation is not proof of correctness. The original reference wins unless an approved modernization applies.

## Work Process

Before editing:

- Inspect the relevant current code.
- Inspect the matching original reference.
- Identify constants, formulas, state transitions, assets, and frame timing.
- Plan the smallest change that improves fidelity.

While editing:

- Prefer original data/parsers over hand-written approximate scripts.
- Keep changes minimal, scoped, and reviewable.
- Do not perform unrelated refactors.
- Do not change public APIs, file layout, asset formats, or stage scope unless required for fidelity.
- Do not regress earlier verified stages.

After editing:

- Compare against `reference/` or available golden evidence.
- Run the strongest relevant validation available.
- Remove temporary logs, debug UI, generated artifacts, and throwaway files.

## Runtime Boundary

The shipped browser game may depend only on runtime files such as:

- `index.html`
- `src/`
- `assets/th06-img/`
- `assets/audio/`
- `assets/sfx/`
- other files explicitly required by the deployed page

Browser/runtime code must not read from `reference/`, `tests/`, `scripts/`, `docs/`, or `node_modules/`.

`dist/` is generated output. Do not edit it manually.

Keep static deployment working: `index.html` should still run when opened directly.

## Validation

Use the strongest practical subset available for the change:

- `npm run check`
- `npm test`
- `node scripts/audit-th06-stages.mjs`
- `npx playwright test -c playwright.config.mjs --reporter=line`
- `npm run prepare-pages`

If a command is unavailable, irrelevant, or fails for reasons unrelated to the task, state that clearly in the handoff.

For documentation-only changes, minimal validation is acceptable.

## Repo Hygiene

Never commit or ship:

- `reference/`
- secrets, tokens, credentials, browser profiles
- caches, generated logs, screenshots, `test-results/`
- throwaway debug scripts or temporary development artifacts

New tests, replay tools, audit tools, or golden comparison tools may be added only when they are intentional project files, not temporary artifacts.

Never revert user changes or unrelated local changes.

Keep diffs focused. Commit or push only when the task or user explicitly asks for sync/publish.

## Handoff

Final handoff must state:

- what changed
- which files changed
- original-reference basis or remaining uncertainty
- whether the result is exact or approximate
- validation run, or why validation was not run
- remaining bugs or fidelity gaps
