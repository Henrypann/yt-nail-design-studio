# PR-V7-04 Layer Workspace Validation

## Scope

- Base: `4cc6fe3` (`codex/pr-v7-03-runtime-store`)
- Branch: `codex/pr-v7-04-layer-workspace`
- Evidence level: `integrated` for routing/workspace interactions; visual preview remains `prototype` and is not a canonical 2D/3D render.
- Delivered: schema-selected V7 writer, explicit `VITE_EDITOR_V7=1` edit gate, safe V7 read-only mode when disabled, canonical process-step workspace, registry-owned tool gates, pointer/keyboard controls, responsive shell, and a router-level dirty-exit save blocker.
- Excluded: V7 blank creation, V6→V7 conversion entry, actual brush/eraser/background authoring, geometry rendering, 3D preview, confirmation snapshot, scope/mirror, manufacturing claims.

## Agent record

- Luna was invoked in `write-isolated` mode, completed a code inventory, and stopped without editing. Codex implemented and verified the PR.
- Claude Code was not retried because the immediately preceding PR invocation proved the installed Hermes Claude binary non-executable; skill policy forbids chmod/chown or automatic retry.
- An independent read-only reviewer inspected the actual diff. Codex fixed both P1 findings: async document transitions now reject mutations, and Editor exits await a successful save before navigation. The selected-step deletion P2 was also repaired in the V7-03 dependency.

## Routing and product boundaries

- Writer choice is based on persisted `schemaVersion`, never on the feature flag.
- V1–V6 keep the existing V6 route, blank flow, and Wizard bridge.
- Existing schema 7 always uses the V7 reader/store. With the flag off it opens read-only and never reaches the V6 writer.
- Future/invalid documents show recovery copy and preserve raw storage.
- The flag does not expose V7 blank creation or automatic migration.

## Automated gates

| Command | Result |
|---|---|
| `npm run typecheck` | PASS |
| `npm run build:integration` | PASS |
| `npm run test:editor-v7-workspace` | PASS |
| `npm run test:editor-v7-runtime` | PASS |
| `npm run test:editor-v7-contract` | PASS |
| `npm run test:editor-v7-migrate` | PASS |
| `npm run test:editor-v6-runtime` | PASS |
| `npm run test:store-v6` | PASS |
| `npm run test:pr04-editor-entry` | PASS |
| `npm run test:handdraw` | PASS |
| `npm run validate-assets` | PASS |
| `npm run validate-recipes` | PASS |
| `git diff --check` | PASS |
| `npm run test:slots` | Known baseline failure: L3 `rotationDeg=5.81 > 5`; Slot V2 unchanged |

## Browser walkthrough

Temporary browser storage used `EDITOR_DOC_V7_FULL_FIXTURE`; no product seed or default writer was added.

| Scenario | Result |
|---|---|
| Editable flag-on deep link | PASS; schema 7 shell, title editable |
| Flag-off existing V7 deep link | PASS; schema 7 shell, read-only banner, title disabled, revision unchanged |
| 390 / 1280 / 1440 | PASS; `scrollWidth === clientWidth`, panel visible |
| Canonical order | PASS; background first, finish last |
| Document action | PASS; visibility action persisted revision `4 → 5` once |
| Keyboard collapse | PASS; focused control + Enter changed `aria-expanded` to `false` |
| Dirty exit guard | PASS; title edit was persisted before navigation to `/design` |
| Browser Back guard | PASS; SPA history Back persisted the dirty title before proceeding |
| Exit save failure | PASS; injected storage failure kept `/design/canvas` open and showed a visible retry message |
| Console / pageerror | PASS; zero errors in both flag modes |

Screenshots:

- `screenshots/editable-390.png`
- `screenshots/editable-1280.png`
- `screenshots/editable-1440.png`
- `screenshots/editable-L1-after-action.png`
- `screenshots/readonly-390.png`
- `screenshots/readonly-1280.png`
- `screenshots/readonly-1440.png`

The process preview is intentionally structural. It does not claim geometry fidelity, optical fidelity, customer output quality, or manufacturability.

Non-blocking architecture note: `createBrowserRouter` is constructed at module load because this is a Vite client-only application. A future SSR or pure-Node App import would need a router factory; that environment is outside the current product runtime.
