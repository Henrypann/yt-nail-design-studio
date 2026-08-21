# EDITOR-v0.7.2-FRENCH-01 Validation

Date: 2026-08-21
Branch: `codex/w34-studio-french-track`
Base: `main @ 3f0fb9bc1f39793d300bd4216c637584e23161c9`
Checkpoint: FRENCH-01 contract/legacy-evidence foundation only (corrected parameter semantics)

## Scope verified

- Strict `FrenchRecipeSpecV1` still sits on the existing `RecipeInstanceV7.parameterValues` extension point. `EditorDocV7`, JSON Schema, and `schemaVersion: 7` are unchanged.
- Recipe identity remains `french-edge@1.0.0` because this branch has not merged or shipped. Exact keys are now `preset`, `variant`, `leftWingV`, `centerV`, `rightWingV`, `fillColor`, `fillOpacity`, `balanceLocked`, `outlineEnabled`, `outlineColor`, `outlineWidthMm`, `transitionMode`.
- Smile-line anchors are canonical canvas/viewBox-local `v` coordinates (`0` = canvas tip edge, `1` = canvas root edge). They are not contour-extrema renormalization. There is no persisted `tipWidth`; a future UI width control must atomically edit the three anchors.
- `outlineWidthMm` is millimetres for a future V7 `vector_shape.strokeWidthMm` (`0`–`2`). Disabled outlines require `0`; enabled outlines require at least `0.05`. Defaults remain outline disabled and width `0`.
- `FRENCH_RECIPE_PRESETS_V1` remains the five default IDs (`classic` / `micro` / `soft` / `deep` / `pointed`) for the 60 golden matrix. Parser accepts `preset='custom'` and round-trips it; `createDefaultFrenchRecipeParametersV1` does not. Commands must set `custom` after geometry edits. Compiler geometry is driven by `variant` and anchors, never by the preset label.
- Existing V7 `french_edge(widthRatio, curvature, color)` remains frozen and readable. The recipe is not written into the legacy element.
- V7 simple French and rich V3/V6 French are classified separately. Preview conversion does not infer preset, overall style, makeability, or manufacturing capability. Uncloneable input (`Symbol` / function / object with a non-cloneable value) returns `unavailable` with `source_not_cloneable` and does not throw or mutate.
- Rich or mixed legacy payloads stay in migration evidence and are not flattened. Simple French `NaN` / `Infinity` is rejected with `Number.isFinite` before V7 content is created, with evidence retained. Double-line French remains unavailable in V1.

## Automated gates

| Gate | Result |
|---|---|
| `npm run test:editor-v7-french-contract` | PASS — default presets, custom round-trip, exact-key canonicalization, outline/cross-field fail-closed, instance, serialization |
| `npm run test:editor-v7-french-migration` | PASS — V7 simple, V3/V6 arc/v/double, mixed, uncloneable preview, NaN/Infinity evidence, identity regression |
| `npm run test:editor-v7-contract` | PASS — 2 valid and 34 invalid fixtures |
| `npm run test:editor-v7-migrate` | PASS |
| `npm run test:handdraw` | PASS — existing French, mirror, migration, and recipe regressions |
| `npm run typecheck` | PASS |
| `npm run build` | PASS — existing >500 kB chunk warning only |
| `npm run build:integration` | PASS — existing >500 kB chunk warning only |
| `git diff --check` | PASS |

## Acceptance boundary

This is still a FRENCH-01 foundation checkpoint, not the whole FRENCH-01 PR. It corrects authoring-parameter semantics only. It does not provide a compiler, derived `vector_shape` projection, Editor UI, store commands, release/import/materialize/scope checks, undo/save/reopen behavior, or any preview integration. No visual, physical, fit, manufacturing, deployment, or production claim is made.

The five default preset identities are conservative contract defaults for the planned 60 golden matrix. Product, Design/Nail Expert, and visual sign-off are still required before FRENCH-02 can claim accepted golden defaults. Passing parser tests is not that sign-off.

The bounded Hermes/Claude rotation on 2026-08-21 produced no valid review because every configured model failed the required usage/model validation. This checkpoint is Codex-verified but not Claude-approved.

Evidence tier: local contract/prototype tests. FRENCH-01 stays `IN PROGRESS`.
