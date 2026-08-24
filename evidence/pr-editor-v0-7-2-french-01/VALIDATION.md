# EDITOR-v0.7.2-FRENCH-01 Validation

Date: 2026-08-24
Branch: `codex/w34-studio-french-track`
Base: `main @ 3f0fb9bc1f39793d300bd4216c637584e23161c9`
Checkpoint: explicit legacy conversion + visible confirmation + recipe-managed projection (branch checkpoint)

## Scope verified

- Strict `FrenchRecipeSpecV1` still sits on the existing `RecipeInstanceV7.parameterValues` extension point. `EditorDocV7`, JSON Schema, and `schemaVersion: 7` are unchanged.
- Recipe identity remains `french-edge@1.0.0` because this branch has not merged or shipped. Exact keys are now `preset`, `variant`, `leftWingV`, `centerV`, `rightWingV`, `fillColor`, `fillOpacity`, `balanceLocked`, `outlineEnabled`, `outlineColor`, `outlineWidthMm`, `transitionMode`.
- Smile-line anchors are canonical canvas/viewBox-local `v` coordinates (`0` = canvas tip edge, `1` = canvas root edge). They are not contour-extrema renormalization. There is no persisted `tipWidth`; a future UI width control must atomically edit the three anchors.
- `outlineWidthMm` is millimetres for a future V7 `vector_shape.strokeWidthMm` (`0`–`2`). Disabled outlines require `0`; enabled outlines require at least `0.05`. Defaults remain outline disabled and width `0`.
- `FRENCH_RECIPE_PRESETS_V1` remains the five default IDs (`classic` / `micro` / `soft` / `deep` / `pointed`) for the 60 golden matrix. Parser accepts `preset='custom'` and round-trips it; `createDefaultFrenchRecipeParametersV1` does not. Commands must set `custom` after geometry edits. Compiler geometry is driven by `variant` and anchors, never by the preset label.
- Existing V7 `french_edge(widthRatio, curvature, color)` remains frozen and readable. The recipe is not written into the legacy element.
- V7 simple French and rich V3/V6 French are classified separately. Preview conversion does not infer preset, overall style, makeability, or manufacturing capability. Uncloneable input (`Symbol` / function / object with a non-cloneable value) returns `unavailable` with `source_not_cloneable` and does not throw or mutate.
- Rich or mixed legacy payloads stay in migration evidence and are not flattened. Simple French `NaN` / `Infinity` is rejected with `Number.isFinite` before V7 content is created, with evidence retained. Double-line French remains unavailable in V1.
- `convertLegacyFrenchEdgeToRecipeV1` requires an explicit, strictly parsed parameter object and exact signed geometry. It never infers preset or anchors from `widthRatio` / `curvature`.
- Successful conversion keeps the legacy element as `visible:false, locked:true` inert evidence, inserts one adjacent locked `flat_design` step, creates one `RecipeInstanceV7`, and materializes only locked compiler fill/outline vector projections. The recipe is the sole active authoring truth.
- `inspectFrenchRecipeProjectionV1` resolves the current document geometry tuple and recompiles from the recipe; an optional supplied geometry is only accepted when it matches that tuple. It rejects dangling references, ambiguous recipe ownership, hidden/unlocked/skipped managed steps, extra/unlocked elements, path/color/opacity/transform/stroke drift, and invalid geometry/parameters with visible diagnostics.
- Conversion geometry is rebound to the current document finger/asset/revision and canonical registry; foreign-finger, foreign-asset, revision-drift, generated, forged, and registry-SHA-mismatched geometry fail closed. IDs follow the EditorDoc schema (max 128, `:` allowed) and node/recipe cross-domain collisions are rejected.
- Store `confirmLegacyFrenchConversion` is spatial-gated and commits through the existing transaction path: read-only, busy, invalid geometry, invalid source, and compiler failures are writer-zero; success creates one revision/history entry and schedules the existing autosave.
- The selected legacy inspector now discloses `旧版近似法式`, shows the preserved width/curvature/color evidence, and requires an explicit choice among the five structured presets before confirmation. It does not derive anchors from the legacy width/curvature. Color and current opacity are shown before writing; outline remains disabled.
- Opening, configuring, cancelling, or pressing Escape is writer-zero. Confirmation hides/locks the legacy element, selects the new locked managed projection, and emits the existing success toast. Unsupported geometry keeps the action disabled and does not write.
- The shared Modal now sits above the compact Editor workspace overlay and captures Escape before the underlying sidebar. This closes only the top dialog and restores focus to the conversion trigger; the preset targets are 56 px and the trigger is 44 px.

## Automated gates

| Gate | Result |
|---|---|
| `npm run test:editor-v7-french-contract` | PASS — default presets, custom round-trip, exact-key canonicalization, outline/cross-field fail-closed, instance, serialization |
| `npm run test:editor-v7-french-migration` | PASS — V7 simple, V3/V6 arc/v/double, mixed, uncloneable preview, NaN/Infinity evidence, identity regression |
| `npm run test:editor-v7-french-conversion` | PASS — pure no-mutation conversion, outline on/off, geometry/source/ID fail-closed matrix, full inspector tamper matrix, store writer-zero/undo/redo/save/reload, materialize/remix/scope no-dangling, release snapshot/manifest |
| `npm run test:editor-v7-french-conversion:e2e` | PASS — 390×844 and 1280×900; intent/cancel/Escape writer-zero, focus restoration, 5 explicit presets, 44/56 px targets, one-revision confirmation, other-finger unchanged, locked valid projection, no horizontal overflow or runtime errors |
| `npm run test:editor-v7-contract` | PASS — 2 valid and 34 invalid fixtures |
| `npm run test:editor-v7-migrate` | PASS |
| `npm run test:handdraw` | PASS — existing French, mirror, migration, and recipe regressions |
| `npm run typecheck` | PASS |
| `npm run build -- --outDir /tmp/nextgen-french-ui-build --emptyOutDir` | PASS — explicit temporary output avoids Desktop sync overhead; existing >500 kB chunk warning only |
| `npm run build:integration` | PASS — existing >500 kB chunk warning only |
| `git diff --check` | PASS |

## Acceptance boundary

This remains a FRENCH-01 branch checkpoint, not a merged release. The dedicated tests now prove release snapshot/manifest preservation, independent/remix recipe remapping, generic whole-nail copy-detached no-dangling behavior, and the bounded legacy conversion confirmation UI. It does not provide three-anchor editing, preset re-editing, FRENCH-specific copy-detached recompilation, multi-finger French scope commands, or other FRENCH-03 editing commands; those remain FRENCH-03 scope. No physical, fit, manufacturing, deployment, or production claim is made.

Codex inspected the generated 390 px and 1280 px before/after screenshots. The disclosure, preset layout, color confirmation, mobile overlay order, and converted locked step are visible without full-page horizontal overflow. This is local visual QA, not Product/Design/Nail Expert sign-off. Evidence is stored in `screenshots/` and `legacy-conversion-walkthrough-report.json`.

The five default preset identities are conservative contract defaults for the planned 60 golden matrix. Product, Design/Nail Expert, and visual sign-off are still required before FRENCH-02 can claim accepted golden defaults. Passing parser tests is not that sign-off.

The bounded Hermes/Claude rotation on 2026-08-21 produced no valid review because every configured model failed the required usage/model validation. This checkpoint is Codex-verified but not Claude-approved.

Evidence tier: local contract/prototype tests + bounded browser E2E/visual QA. The original owner gate was closed by the explicit 2026-08-24 software-prototype integration authorization recorded below; manufacturing evidence remains false.

## Product quick sign-off · 2026-08-24

用户明确回复“1-6通过”。其中 FRENCH-01 对应 `1280-legacy-conversion-prompt.png` 与 `1280-legacy-converted.png`，因此旧版证据披露、五预设转换提示和转换后 locked structured projection 的 Product 快速方向签收已通过。

本签收不覆盖 FRENCH-02 的 60/60 golden，也不代替 Design / Nail Expert 对预设默认值、真实美甲语义或全量视觉的签收；branch、main 与制造证据状态不变。

## Professional prototype gate · 2026-08-24

用户在 A+B 联合回归通过后明确要求关闭 French 专业门并进入 INT-FRENCH-01A/01B。本 checkpoint 的软件原型集成门因此关闭；详细范围见 `../pr-int-v0-7-2-french-professional-gate/VALIDATION.md`。该授权不升级为独立 Nail Expert、实体或制造签收。
