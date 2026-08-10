# PR-V7-06 Advanced Background Validation

## Scope

- Base: `24a6561c0562999f8a2f5a655b7e62e4555b231e` (`codex/pr-v7-05-background-basic`).
- Branch: `codex/pr-v7-06-background-advanced`.
- Evidence level: `integrated` for single-finger advanced background authoring, history, persistence and deterministic SVG preview. Cat-eye, glitter and translucent visuals remain explicitly `approximate`.
- Delivered: 2–8-stop gradient authoring and direction; whole-nail cat-eye color/direction/intensity/band width; whole-nail glitter colors/density/particle size/saved deterministic seed; material-library palette theme materialization; reversible basic/advanced conversion.
- Excluded: local cat-eye/glitter (`surface_effect` remains unchanged), multi-finger scope/sync, InspirationPack/source provenance, schema/migration changes, flat/vector tools, 3D, manufacturing and V7 blank creation.

## Canonical and rendering boundaries

- Every command replaces only the existing `steps[0].background`; no command creates, moves or duplicates a background step.
- Gradient `stops[]` is the only ordering truth. Commands sort by numeric offset, reject duplicates and preserve the schema's 2–8 / strictly-increasing invariant. No `order` field was added.
- Nail-local direction is frozen as `0° = left→right (+u)`, with positive rotation clockwise toward the root (`+v`). Finite inputs normalize to `[0, 360)` before validation and persistence.
- Cat-eye uses an analytic SVG band; it has no random input. Glitter preview uses a saved string seed and deterministic FNV-1a/LCG projection, so the same document renders the same particles after refresh.
- Theme colors come from `material-library/colors/palette.json`. The explicit “确认应用” action materializes canonical RGBA gradient stops. No live linkage or copied operations taxonomy is retained. A background-level source provenance field is intentionally deferred to V7-13 because the frozen V7 schema has no such field.
- SVG is a derived view. Cat-eye/glitter are visibly `approximate`; no preview parameter is treated as material response, device data or manufacturability proof.

## Automated validation

| Command | Result |
|---|---|
| `npm run typecheck` | PASS |
| `npm run build:integration` | PASS; pre-existing chunk-size warning only |
| `npm run test:editor-v7-background-advanced` | PASS |
| `npm run test:editor-v7-background` | PASS |
| `npm run test:editor-v7-contract` | PASS |
| `npm run test:editor-v7-runtime` | PASS |
| `npm run test:editor-v7-workspace` | PASS |
| `npm run test:editor-v7-migrate` | PASS |
| `git diff --check` | PASS |
| `npm run test:slots` | FAIL at unchanged baseline `abs(rotationDeg) < 5`; this PR changes no Slot file, non-blocking |

The advanced suite covers direction normalization, stable stop sorting/add/remove/8-stop boundaries, cat-eye whole-background/local-effect separation, deterministic glitter refresh including density zero, theme materialization without dual linkage, one revision/history/real autosave transaction per accepted store action, undo/redo, save/reload, single-finger isolation, RGBA alpha composition, fidelity `exact/approximate/unavailable`, and read-only/switching/locked rejection.

## Review and fixes

- The implementation subagent stopped before review; Codex retained sole write ownership afterward.
- Independent internal review initially requested changes for fidelity passthrough, advanced RGBA alpha, rejected range-draft recovery, stable palette IDs, missing stop/autosave tests, and panel/canvas fidelity copy. All P1 findings were fixed and re-tested.
- Claude Code read-only review confirmed those fixes and identified native color-picker transaction churn. All native color inputs now use a local draft with a 350 ms converged commit, canonical rollback on rejection, and component remount cleanup across finger/mode changes.
- Final source truth distinguishes `exact`, `approximate`, and `unavailable` in both panel and canvas; unavailable effects preserve data and geometry boundary without drawing a fabricated effect.
- Final internal reviewer verdict: `PASS`, no remaining P0/P1. Final Playwright rerun after fixes passed 390/1280/1440, advanced mode transitions, theme materialization, single-finger isolation, save/reload and zero console/page errors.

## Browser walkthrough

Local Playwright used the signed V7 full fixture in isolated browser storage; no product seed/writer was added.

| Scenario | Result |
|---|---|
| 390 / 1280 / 1440 | PASS; `scrollWidth === clientWidth`, background panel and canvas visible |
| Solid → gradient | PASS; default 2 stops, add stop, direction `123°`, persisted |
| Gradient → cat-eye | PASS; analytic approximate band and editable intensity |
| Cat-eye → glitter | PASS; editable parameters and seed `background-L1-glitter-v1 → glitter-81998acf` |
| Theme confirmation | PASS; materialized three canonical stops and retained no theme/source linkage |
| Save / refresh | PASS; restored gradient with 3 stops |
| Single-finger boundary | PASS; L2 remained byte-equivalent |
| Console / pageerror | PASS; zero errors |

Screenshots are in `screenshots/`: responsive states plus edited gradient, cat-eye, glitter and materialized theme.

## Known limitations

- Palette theme grouping is a V7-06 UI preset over the current structured material palette, not an `InspirationPackV1`. Full content provenance, Community adapter and ten-finger composition remain V7-13.
- Cat-eye/glitter previews demonstrate deterministic authoring semantics only. They are not signed physical material simulations.
- Multi-finger operations remain V7-09; this PR intentionally closes only the current-finger loop.
