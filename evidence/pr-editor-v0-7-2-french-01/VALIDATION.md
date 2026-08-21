# EDITOR-v0.7.2-FRENCH-01 Validation

Date: 2026-08-21
Branch: `codex/w34-studio-french-track`
Base: `main @ 3f0fb9bc1f39793d300bd4216c637584e23161c9`
Checkpoint: contract and legacy-evidence foundation only

## Scope verified

- Added a strict `FrenchRecipeSpecV1` over the existing `RecipeInstanceV7.parameterValues` extension point without changing `EditorDocV7`, its JSON Schema, or `schemaVersion: 7`.
- Recipe parameters are exact-key, finite, range-checked, cross-field validated, normalized to six decimal places, and deterministically serialized for later compiler fingerprints.
- Existing V7 `french_edge(widthRatio, curvature, color)` remains frozen and readable. The new recipe is not written into the legacy element.
- V7 simple French and rich V3/V6 French are classified separately. Preview conversion does not infer preset, overall style, makeability, or manufacturing capability.
- Rich or mixed legacy payloads are retained as migration evidence and are not silently flattened into the three-field V7 element. Double-line French remains unavailable in V1.

## Automated gates

| Gate | Result |
|---|---|
| `npm run test:editor-v7-french-contract` | PASS — five preset/strict parser/canonicalization/instance/serialization groups |
| `npm run test:editor-v7-french-migration` | PASS — V7 simple, V3/V6 arc/v/double, mixed, evidence, identity regression groups |
| `npm run test:editor-v7-contract` | PASS — 2 valid and 34 invalid fixtures |
| `npm run test:editor-v7-migrate` | PASS |
| `npm run test:handdraw` | PASS — existing French, mirror, migration, recipe regressions |
| `npm run typecheck` | PASS |
| `npm run build` | PASS; existing >500 kB chunk warning only |
| `npm run build:integration` | PASS; existing >500 kB chunk warning only |
| `git diff --check` | PASS |

## Acceptance boundary

This checkpoint is not the whole FRENCH-01 PR. It does not yet provide the explicit conversion command, derived `vector_shape` projection, release/import/materialize/scope reference checks, undo/save/reopen behavior, compiler, Editor UI, or any preview integration. FRENCH-01 stays `IN PROGRESS` until those gates pass.

The five preset identities and conservative defaults implement the v2 plan's recommended contract surface. Product, Design/Nail Expert, and visual sign-off are still required before FRENCH-02 can claim accepted golden defaults. Passing parser tests is not that sign-off.

The bounded Hermes/Claude rotation on 2026-08-21 produced no valid review because every configured model failed the required usage/model validation. This checkpoint is Codex-verified but not Claude-approved.

Evidence tier: local contract/prototype tests. No visual, physical, fit, manufacturing, deployment, or production claim is made.
