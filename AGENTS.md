# AGENTS.md

This file defines the working rules for agents and contributors in this repository.

## Project Goal

- Recreate *Touhou 6: Embodiment of Scarlet Devil* in the browser with high fidelity.
- Treat the original game data, extracted resources, and local source references as the primary source of truth.
- Keep modern quality-of-life additions explicit and limited. Current accepted exceptions include focus hitbox display and non-original convenience/debug tooling.

## Runtime Boundary

- Runtime files must stay limited to what the browser game needs:
  - `index.html`
  - `src/`
  - `assets/th06-img/`
  - `assets/audio/`
  - `assets/sfx/`
  - other files explicitly required by the deployed page
- Browser code must not read from `reference/`, `tests/`, `scripts/`, `docs/`, or `node_modules/`.
- `dist/` is generated output. Do not edit it by hand.
- `reference/` is local-only material for audits, extraction, and parity checks.

## Development Standard

- Prefer source-derived behavior over approximate hand-written behavior.
- Before changing stage logic, bullets, drops, hitboxes, scoring, spell behavior, backgrounds, or dialogue, check the relevant original reference in `reference/`.
- Do not regress Stage 1 or Stage 2 while implementing later stages unless the change is confirmed against original behavior.
- Preserve static deployment: `index.html` must continue to work when opened directly from `file://`.
- Keep rendering, timing, collision, RNG, and resource-drop changes scoped and testable.
- Keep UI text and dialogue in Chinese for the game surface unless a specific feature requires otherwise.
- Do not add large new assets unless they are required at runtime and are included intentionally.
- Do not commit secrets, tokens, local credentials, browser profiles, test artifacts, or original reference corpora.

## Testing Standard

Run the strongest practical validation before publishing or syncing meaningful gameplay changes:

```sh
npm run check
npm test
node scripts/audit-th06-stages.mjs
npx playwright test -c playwright.config.mjs --reporter=line
npm run prepare-pages
```

For small documentation-only changes, at minimum run:

```sh
npm run check
```

If any validation cannot be run, record that clearly in the final handoff.

## Git And Sync Standard

- The local workspace is the development source. GitHub is the publish/sync remote.
- Work on `main` unless the user asks for a branch.
- Before editing, check the worktree:

```sh
git status -sb
```

- Never revert user changes or unrelated local changes without explicit permission.
- After completing a coherent change:
  - inspect the diff;
  - run the relevant validation;
  - commit with a clear, scoped message;
  - push to `origin/main`.
- Use the standard GitHub CLI/authenticated git flow already configured in the environment.
- Keep commits focused. Do not mix runtime fixes, asset replacement, and documentation churn unless they are part of the same requested change.
- Remote sync must not include files that are not needed for the published game.

## Publish Standard

- Build Pages output with:

```sh
npm run prepare-pages
```

- Confirm that the generated package contains runtime files only.
- Do not deploy or commit:
  - `reference/`
  - `tests/`
  - `scripts/` unless explicitly required by the runtime or release process
  - `docs/`
  - `node_modules/`
  - `test-results/`
  - local caches or credentials

## Handoff Standard

- Summaries should be concise and concrete.
- Always mention validation that was run.
- If a change affects gameplay fidelity, identify the original-reference basis or the remaining uncertainty.
- If a task is not fully complete, state the remaining gap directly.
