# PR-V7-05 Background Basic Validation

## Scope

- Base: `19c7706ced3af718c6266d18be5f0552c8350ca8` (`codex/pr-v7-04-layer-workspace`)
- Branch: `codex/pr-v7-05-background-basic`
- Evidence level: `integrated` for single-finger Editor interactions and persistence; translucent and generic-geometry previews remain explicitly `approximate`.
- Delivered: canonical sRGB helpers, solid/translucent background commands, common opacity, material-library palette, direct color input, single-finger store actions, SVG nail-clipped background preview, advanced-mode representative conversion, fallback disclosure.
- Excluded: gradient/cat-eye/glitter authoring, inspiration palette, batch/sync/mirror, V7 blank creation, actual 3D/material transmittance, flat-design authoring, manufacturing claims, merge, and push.

## Agent record

- Hermes DSF Code Worker ran in the isolated V7-05 worktree with bounded allowed paths. It reached its iteration limit after producing a partial `background.ts` draft and one failure enum; it ran no tests. Codex fixed the type contract, completed store/UI/tests/evidence, and independently verified all results.
- Luna UI Reviewer returned `CONDITIONAL PASS`: its Chinese-label finding was fixed and the redundant touch/pointer commit path was removed while keyboard support was retained. Its live-opacity-preview and contrast suggestions remain non-blocking follow-ups; they do not justify a second temporary state truth in V7-05.
- Claude Code returned `PASS — 无 P0/P1`. Codex added its suggested background-specific `switching` write-guard assertion; the remaining P2 notes were unreachable-path or negligible memo observations.

## Product boundaries

- Every action updates the existing `steps[0]` background only; no command can create a second background.
- Color input materializes structured `{colorSpace:'srgb',r,g,b,a}`. Hex writes alpha `1`; `background.opacity` remains the separate overall-strength truth.
- Converting a deferred advanced mode is explicit and deterministic: gradient first stop, cat-eye color, or glitter first color becomes the basic-mode color. Undo retains the original payload in history.
- The UI does not use EyeDropper or sample rendered pixels. It does not sample 3D lights, highlights, or shadows.
- Translucent 2D and unresolved geometry are visibly labeled approximate/fallback and do not mutate material or geometry references.

## Automated gates

| Command | Result |
|---|---|
| `npm run typecheck` | PASS |
| `npm run build:integration` | PASS; existing chunk-size warning only |
| `npm run test:editor-v7-background` | PASS |
| `npm run test:editor-v7-runtime` | PASS |
| `npm run test:editor-v7-workspace` | PASS |
| `npm run test:editor-v7-contract` | PASS |
| `npm run test:editor-v7-migrate` | PASS |
| `npm run test:editor-v6-contract` | PASS |
| `npm run test:editor-v6-migrate` | PASS |
| `npm run test:editor-v6-runtime` | PASS |
| `npm run test:store-v6` | PASS |
| `npm run test:pr04-editor-entry` | PASS |
| `npm run test:handdraw` | PASS |
| `npm run validate-assets` | PASS |
| `npm run validate-recipes` | PASS |
| `npm run test:community-*` (6 scripts) | PASS |
| `git diff --check` | PASS |
| `npm run test:slots` | FAIL at the unchanged baseline assertion `abs(rotationDeg) < 5`; V7-05 changes no Slot file, so this is non-blocking |

## Browser walkthrough

Fixture storage is isolated to each Playwright browser context. No product seed or V7 blank writer was added.

| Scenario | Result |
|---|---|
| Editable flag-on | PASS; background panel and SVG authoring preview available |
| Flag-off existing V7 | PASS; title/mode/hex/opacity writers disabled |
| 390 / 1280 / 1440 | PASS; `scrollWidth === clientWidth`, canvas and panel visible |
| Single-finger isolation | PASS; L1 changed while L2 remained byte-equivalent |
| Solid → translucent | PASS; explicit approximate-fidelity copy shown |
| Hex + opacity | PASS; `#123456`, `45%`, revision `4 → 7`, one revision per action |
| Undo / redo | PASS; opacity `45 → 100 → 45` |
| Save / reload | PASS; mode, hex, and opacity restored |
| Advanced → solid | PASS; deterministic representative conversion, revision delta `1` |
| Console / pageerror | PASS; zero errors in editable and read-only modes |

Screenshots are stored under `screenshots/`, including editable/read-only 390/1280/1440, translucent, advanced warning, and advanced-converted states.

## Final acceptance

- Luna UI verdict: `CONDITIONAL PASS`; both requested pre-commit P1 cleanups were adjudicated and resolved.
- Claude Code verdict: `PASS — 无 P0/P1`.
- Codex verdict: `ACCEPTED`. Product-code boundaries remain limited to basic single-finger background authoring; no schema, migration, V6, 3D, or manufacturing behavior was introduced.
