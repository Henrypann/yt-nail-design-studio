# EDITOR-v0.7.2-FRENCH-02 Validation

Date: 2026-08-21
Branch: `codex/w34-studio-french-track`
Checkpoint: FRENCH-02 pure exact-geometry French path compiler

## Scope verified

- Strict exact geometry adapter `resolveExactFrenchGeometryInputV1(GeometryRefV7, FingerCode, expectedRegistrySha256)` calls the existing `resolveEditorGeometryV7` resolver. It accepts only `status=resolved`, `fidelity=exact`, `evidence=signed_off`, and a full 64-character product registry SHA that equals the returned digest.
- Generated, placeholder, fallback, unknown, 1-character revision drift, wrong finger, truncated SHA, and wrong SHA are `unavailable`. Shape and length are taken from the registry entry, never inferred from `assetId`.
- Registry silhouette `viewBox`/`path` convert to canonical canvas/viewBox-local `nail-local-v1` with `u=(x-vbX)/vbW` and `v=(y-vbY)/vbH`. Mapping is not renormalized to sampled contour extrema. The adapter accepts only finite absolute SVG `M/C/Q/L/Z` plus explicitly converted `H/V`; relative commands, `A/S/T`, malformed tokens, and open/non-drawable paths fail closed. Canonical output reuses the V7-07 nail-local parser/serializer.
- Pure `compileFrenchPathV1` consumes only that exact geometry plus parsed/canonical `FrenchRecipeParametersV1`. It returns a deterministic stroke-only boundary, a closed fill path, an ID-free vector projection, full cache identity, diagnostics, `fidelity=exact|unavailable`, and `manufacturingValidated:false`. It does not read or write EditorDoc/store/history, generate IDs, or mutate inputs. Outline is a separate stroke-only smile-line; the closed fill path is never stroked.
- Cache identity includes compiler revision `french-path-v1`, recipe id/revision, canonical parameter serialization, `assetId@revision`, finger, full registry SHA, and full contour SHA. There is no `latest` and no truncated SHA. Cross-finger paths may match; binding and cache identity still differ.
- 60 golden cases = signed shapes `almond/oval/coffin` × 4 lengths × 5 default presets, representative finger `L1`. 600 bindings = those 60 × all 10 `FINGER_CODES` resolved through `resolveSignedProductGeometryRefV7`. Machine-readable `golden-manifest.json` is sorted; 60 SVG review images live under `svg/`.

## Automated gates

| Gate | Result |
|---|---|
| `npm run test:editor-v7-french-compiler` | PASS — 60 golden exact, 600 unique bindings, H/V convert, fail-closed negatives, deterministic bytes, separate outline stroke |
| `npm run test:editor-v7-french-contract` | PASS |
| `npm run test:editor-v7-french-migration` | PASS |
| `npm run typecheck` | PASS |
| `git diff --check` | PASS |
| `npm run generate:editor-v7-french-golden` (twice, byte-stable) | PASS — 60 SVG + sorted `golden-manifest.json`; second run identical SHA-256 |

## Exact compiler gates

- 60/60 golden compiles are `fidelity=exact` and `manufacturingValidated=false`.
- 600/600 bindings are exact, with 600 unique binding keys and 600 unique cache keys.
- Same input yields identical bytes; compiler does not mutate geometry or parameters.
- All compiled coordinates are finite and inside `[0, 1]`.
- Fill path is closed and drawable; boundary path is drawable and not closed.
- Wings lie on the signed contour. Smooth centers are closer to the canvas tip edge than both wings; pointed centers are closer to the canvas root edge than both wings.
- Negative cases fail closed: wrong finger, 1-character revision drift, truncated/wrong SHA, unknown asset, generated square, malformed path, relative path.

## Acceptance limits

This checkpoint is software geometry / prototype evidence only. It is not visual sign-off, physical fit, manufacturing, or production proof.

- EditorDocV7 / `schemaVersion: 7` remains frozen. The corrected `FrenchRecipeSpecV1` at `1c97f04` remains the sole parameter truth.
- No Editor UI, store command, history, preview, PBR, material projection, release, import, use, or approval integration is included.
- 60 SVG review images are deterministic algorithm dumps for later Product/Design/Nail Expert sign-off. Passing compiler tests is not that sign-off.
- `manufacturingValidated` is always `false`. SVG, path bytes, and cache hashes are derived views, not manufacturing artifacts.

Evidence tier: local compiler/prototype tests. FRENCH-02 stays `IN PROGRESS` until the 60/60 visual matrix is independently signed off.
