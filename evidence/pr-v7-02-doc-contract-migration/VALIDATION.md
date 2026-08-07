# PR-V7-02 Validation

## Scope

- Pure EditorDoc V1–V7 read/migration boundary.
- Injected geometry, asset, and recipe resolution.
- Result-side diagnostics and preserved legacy evidence.
- Pure in-memory repository read result; no V7 writer or storage mutation.
- V1–V7/future/invalid/missing executable fixture matrix.

## Boundaries

- No repository persistence, store, autosave, UI, renderer, or feature flag.
- No guessed geometry, typical-nail coordinate conversion, embedded data URL, placeholder asset, or fabricated hash.
- Evidence tier: `architecture-golden`.

## Agent record

- Luna isolated implementation call timed out after 900 seconds and left the worktree unchanged. Its prohibited placeholder/geometry-inference proposals were not adopted.
- Claude `claude-opus-4-7` actual-diff review found no P0 and three candidate P1 items.
- Codex accepted resolver-backed finish presets and repository mismatch diagnostics, and proved the alleged dangling-recipe path is rejected by the V6 bridge and V7 validator.
- Claude follow-up review result: `无 P0/P1`.
- Codex made the final scope and acceptance decision.

## Validation results

| Check | Result |
|---|---|
| `npm run typecheck` | PASS |
| `npm run build:integration` | PASS |
| `npm run test:editor-v7-contract` | PASS — 2 valid / 34 invalid fixtures |
| `npm run test:editor-v7-migrate` | PASS — V1–V7/future/invalid/missing matrix |
| `npm run test:editor-v6-contract` | PASS |
| `npm run test:editor-v6-migrate` | PASS |
| `npm run test:editor-v6-runtime` | PASS |
| `npm run test:store-v6` | PASS |
| `npm run test:handdraw` | PASS |
| `npm run validate-assets` | PASS |
| `npm run validate-recipes` | PASS |
| `git diff --check` | PASS |
| `npm run test:slots` | FAIL — unchanged baseline: L3 `rotationDeg=5.81`, threshold `<5` |

## Acceptance notes

- Frozen inputs and in-memory document maps remain unchanged; every non-missing result carries an independent deep-cloned original.
- Geometry and finish presets require injected resolvers. Missing resolution returns `unsupported`; no default geometry or invented preset reference is written.
- Inline data URLs, unresolved assets, opaque recipe bodies, unknown layers, and unsafe legacy coordinates remain in capped result-side evidence with explicit diagnostics, not in canonical V7.
- V7 repository contract exposes read result only; no save/write/create entry exists.
- Human UI/responsive walkthrough: N/A because this PR has no UI or production runtime path.
- Evidence tier: `architecture-golden`.
