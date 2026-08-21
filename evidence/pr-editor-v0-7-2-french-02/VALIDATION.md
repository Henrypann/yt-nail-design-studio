# EDITOR-v0.7.2-FRENCH-02 Validation

Date: 2026-08-21
Branch: `codex/w34-studio-french-track`
Checkpoint: FRENCH-02 pure exact-geometry French path compiler
HEAD at start of this hardening pass: `040fad3`

## Scope verified

- Strict exact geometry adapter `resolveExactFrenchGeometryInputV1(GeometryRefV7, FingerCode, expectedRegistrySha256)` calls the existing `resolveEditorGeometryV7` resolver. It accepts only `status=resolved`, `fidelity=exact`, `evidence=signed_off`, and a full 64-character product registry SHA that equals the returned digest.
- Generated, placeholder, fallback, unknown, 1-character revision drift, wrong finger, truncated SHA, and wrong SHA are `unavailable`. Shape and length are taken from the registry entry, never inferred from `assetId`.
- Registry silhouette `viewBox`/`path` convert to canonical canvas/viewBox-local `nail-local-v1` with `u=(x-vbX)/vbW` and `v=(y-vbY)/vbH`. Mapping is not renormalized to sampled contour extrema. The adapter accepts only finite absolute SVG `M/C/Q/L/Z` plus explicitly converted `H/V`; relative commands, `A/S/T`, malformed tokens, open/non-drawable paths, a second `M`, and multiple subpaths fail closed. Canonical output reuses the V7-07 nail-local parser/serializer and must remain a single closed subpath.
- Pure `compileFrenchPathV1` is a runtime trust boundary, not TypeScript-only. Before compile it validates: real `FINGER_CODE`, signed shape/length sets, `registryAssetSetSha256 === PRODUCT_GEOMETRY_ASSET_SET_SHA256_V7`, `contourIdentity === sha256Hex(contourPathData)`, finite `canvasCenterU` in `[0, 1]`, finite positive viewBox, stable non-empty `assetId`/`revision` without control chars, reserved separators (`|@\\/:=#`), or `latest`, and a canonical single closed contour. Forged exact objects fail closed with visible diagnostics.
- Source contour is the exact signed Bezier. Smile-line wings are analytic unit-interval intersections of that exact curve. The derived tip cap is a deterministic adaptive de Casteljau flattening with `flatnessTolerance=1e-4`, `maxSubdivisionDepth=12`, `maxPoints=2048`, and fail-closed overflow. Wing-on-contour tolerance is `4e-4`. This is software-geometry exactness only; it is not physical or manufacturing exactness.
- Tests compare compiler wings and derived cap points to an independent 256-sample + bisection reference, not a copy of the compiler sampler.
- Cache/binding keys are SHA-256 of a length-prefixed canonical exact-key payload. Structured `cacheIdentity` still exposes compiler revision, recipe id/revision, canonical parameters, asset id/revision, finger, full registry SHA, and full contour SHA. Both key preimages include all of those identities. Raw pipe-delimited keys are gone. Cross-finger keys remain distinct. Reserved-delimiter injection and contour/registry SHA drift fail closed.
- 60 golden cases = signed shapes `almond/oval/coffin` × 4 lengths × 5 default presets, representative finger `L1`. 600 bindings = those 60 × all 10 `FINGER_CODES` resolved through `resolveSignedProductGeometryRefV7`. Machine-readable `golden-manifest.json` is sorted; 60 SVG review images live under `svg/`.

## Codex-discovered defects and fixes

| Defect | Fix |
|---|---|
| Fixed 24-sample-per-curve contour sampler repeated a known legacy weakness and was treated as canonical compiler truth | Replaced with analytic Bezier × horizontal-line intersections plus bounded adaptive flattening of the derived cap; overflow fails closed |
| Wing/cap tests copied the compiler's 24-sample sampler | Independent 256-sample + bisection oracle; match bound `5e-4` documents flattening + 5-decimal serialization slack |
| `compileFrenchPathV1` trusted TypeScript `FrenchExactGeometryV1` and would compile forged exact objects | Runtime trust-boundary validation with visible diagnostics before compile |
| `canonicalizeSilhouetteToNailLocalV1` accepted a second `M` / multiple subpaths | Reject; contract is a single closed contour |
| Raw pipe-delimited `cacheKey`/`bindingKey` were ambiguous (`params` serialization already contains `\|`) and injectable | Length-prefixed canonical payload hashed with SHA-256; both keys include revision/SHA/contour/finger identities |
| Test asserted `assetId` contains `shape`, mixing registry truth with filename-like ids | Removed; shape/length are trusted only from registry output |
| Missing forged-geometry coverage | Negative tests for invalid finger, mismatched shape/length, wrong product registry SHA, contourIdentity mismatch, invalid viewBox/center, multiple subpaths, noncanonical path, unsafe asset/revision, reserved delimiters, and SHA drift |

## Automated gates

| Gate | Result |
|---|---|
| `npm run test:editor-v7-french-compiler` | PASS — 60 golden exact, 600 unique hashed bindings, H/V convert, second-M reject, fail-closed forgeries, independent contour oracle, deterministic bytes, separate outline stroke |
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
- Analytic wings match an independent higher-precision reference within `5e-4`. Derived cap vertices stay within that bound of the exact source contour. Smooth centers are closer to the canvas tip edge than both wings; pointed centers are closer to the canvas root edge than both wings.
- Negative cases fail closed: wrong finger, 1-character revision drift, truncated/wrong SHA, unknown asset, generated square, malformed path, relative path, second `M`, forged exact objects, reserved-delimiter identity injection, and contour/registry SHA drift.

## Acceptance limits

This checkpoint is software geometry / prototype evidence only. It is not visual sign-off, physical fit, manufacturing, or production proof.

- EditorDocV7 / `schemaVersion: 7` remains frozen. The corrected `FrenchRecipeSpecV1` at `1c97f04` remains the sole parameter truth.
- No Editor UI, store command, history, preview, PBR, material projection, release, import, use, or approval integration is included.
- 60 SVG review images are deterministic algorithm dumps for later Product/Design/Nail Expert sign-off. Passing compiler tests is not that sign-off.
- `manufacturingValidated` is always `false`. SVG, path bytes, and cache hashes are derived views, not manufacturing artifacts.
- Exact source Bezier plus a deterministically flattened cap does not imply physical or manufacturing exactness.

Evidence tier: local compiler/prototype tests. FRENCH-02 stays `IN PROGRESS` until the 60/60 visual matrix is independently signed off.
