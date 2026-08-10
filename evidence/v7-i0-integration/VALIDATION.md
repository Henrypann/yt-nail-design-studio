# V7-I0 Integration Gate Validation

## Scope

- Base: `24a6561c0562999f8a2f5a655b7e62e4555b231e` (`codex/pr-v7-05-background-basic`).
- Branch: `integration/editor-v7-authoring`.
- Assembly order: V7-06 `7105f17` then V7-07 `d450380`.
- Integrated commits before gate fix: `9434938` and `5a88a06`.
- Evidence level: `integrated` for combined V7 background and flat-vector authoring. Cat-eye, glitter and geometry fallback remain explicitly approximate; no manufacturing proof is claimed.

## Conflict resolution

- `package.json` keeps both `test:editor-v7-background-advanced` and `test:editor-v7-flat-vector`.
- `EditorShellV7` keeps one shared canvas/selection truth and reports both delivered capabilities.
- `store-v7.ts` and `index.ts` merged without manual conflict and passed both behavior suites.
- No V7-06 or V7-07 source branch was rewritten.

## Runtime finding and fix

The first real route mount exposed a P0 that source-only tests missed: `EditorShellV7` returned the result of `scrollTo()` from a concise `useEffect`, which React interpreted as an effect cleanup in the browser and raised `destroy is not a function` under StrictMode.

Both UI-only synchronization effects now use block bodies and return nothing. A fresh browser tab subsequently loaded `design.v7.full` with zero console errors.

## Combined browser walkthrough

The signed full V7 fixture was loaded through a temporary local-only QA seed page. That page was deleted before the final diff and is not a product writer.

| Scenario | Result |
|---|---|
| Load V7 route with feature flag | PASS; editable V7 writer selected |
| Advanced background and flat vector in one design | PASS |
| Flat element add | PASS; `7 → 8` |
| Undo / redo | PASS; `8 → 7 → 8` |
| Background mode | PASS; R4 glitter → gradient |
| Explicit save and reload | PASS; L1 elements=8, R4=gradient, status=saved |
| Fresh-tab console errors | PASS; 0 |
| 390 / 1280 / 1440 | PASS; canvas and process panel visible, no document horizontal overflow |

Responsive metrics:

| Viewport | clientWidth | scrollWidth | Canvas | Process panel |
|---|---:|---:|---:|---:|
| 390 | 375 | 375 | visible, 209px | visible, 293px |
| 1280 | 1265 | 1265 | visible, 227px | visible, 319px |
| 1440 | 1425 | 1425 | visible, 234px | visible, 319px |

Screenshots are stored in `screenshots/integration-390.png`, `integration-1280.png` and `integration-1440.png`.

## Automated validation

| Command | Result |
|---|---|
| `npm run typecheck` | PASS |
| `npm run build:integration` | PASS; pre-existing chunk-size warning only |
| `npm run test:editor-v7-contract` | PASS |
| `npm run test:editor-v7-migrate` | PASS |
| `npm run test:editor-v7-runtime` | PASS |
| `npm run test:editor-v7-workspace` | PASS |
| `npm run test:editor-v7-background` | PASS |
| `npm run test:editor-v7-background-advanced` | PASS |
| `npm run test:editor-v7-flat-vector` | PASS |
| V6 contract/migrate/runtime/store | PASS |
| Community content/taxonomy/official/domain/intent/studio-flow | PASS |
| `npm run test:handdraw` | PASS |
| `npm run validate-assets` | PASS |
| `npm run validate-recipes` | PASS |
| `git diff --check` | PASS |
| `npm run test:slots` | Known main baseline failure at `abs(rotationDeg) < 5`; no Slot file differs from main |

## Gate decision

V7-I0 is accepted for use as the V7-08 branch base after the runtime fix is committed. V7-08 must improve the professional workspace information architecture; it must not change EditorDocV7 payloads or reintroduce a second process-state truth.
