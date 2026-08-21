# EDITOR-v0.7.2-FRENCH-02 Validation

Date: 2026-08-21
Branch: `codex/w34-studio-french-track`
Checkpoint: FRENCH-02 pure exact-geometry French path compiler
HEAD at start of this post-red-team P0 pass: `e8c602a`

Status: **READY(branch) / prototype**. All listed code gates passed after the registry-tuple binding, collision-free numeric cache identity, and strict SVG comma fixes. Product/Design/Nail Expert human sign-off has not happened. `visualSignoff` remains `false`. This checkpoint remains software geometry / prototype evidence only.

## Scope verified

- Strict exact geometry adapter `resolveExactFrenchGeometryInputV1(GeometryRefV7, FingerCode, expectedRegistrySha256)` calls the existing `resolveEditorGeometryV7` resolver. It accepts only `status=resolved`, `fidelity=exact`, `evidence=signed_off`, and a full 64-character product registry SHA that equals the returned digest.
- Generated, placeholder, fallback, unknown, 1-character revision drift, wrong finger, truncated SHA, and wrong SHA are `unavailable`. Shape and length are taken from the registry entry, never inferred from `assetId`.
- Registry silhouette `viewBox`/`path` convert to canonical canvas/viewBox-local `nail-local-v1` with `u=(x-vbX)/vbW` and `v=(y-vbY)/vbH`. Mapping is not renormalized to sampled contour extrema. The adapter accepts only finite absolute SVG `M/C/Q/L/Z` plus explicitly converted `H/V`; relative commands, `A/S/T`, malformed tokens, illegal commas, open/non-drawable paths, a second `M`, multiple subpaths, empty paths, incomplete numbers, and commands after `Z` fail closed. Canonical output reuses the V7-07 nail-local parser/serializer and must remain a single closed subpath.
- Pure `compileFrenchPathV1` is a runtime trust boundary, not TypeScript-only. Before compile it validates: the exact runtime key set of `FrenchExactGeometryV1` with no unknown keys, real `FINGER_CODE`, signed shape/length sets, `registryAssetSetSha256 === PRODUCT_GEOMETRY_ASSET_SET_SHA256_V7`, `contourIdentity === sha256Hex(contourPathData)`, finite positive viewBox with exact `x/y/width/height` keys, `canvasCenterU` finite in `[0, 1]` and equal to `(0 - viewBox.x) / viewBox.width` within `FRENCH_CANVAS_CENTER_U_TOLERANCE_V1=1e-9`, stable non-empty `assetId`/`revision` without control chars, reserved separators (`|@\\/:=#`), or `latest`, and a canonical single closed contour. It then rebinds `{assetId, revision, finger, registryAssetSetSha256}` through `rebindFrenchExactGeometryToCanonicalRegistryV1` (existing `resolveEditorGeometryV7` + `canonicalizeSilhouetteToNailLocalV1`) and compares the canonical registry geometry field-for-field with the supplied object: shape, length, contourPathData, contourIdentity, viewBox, canvasCenterU, fidelity, evidence, and manufacturing boundary. A forged almond tuple with another signed contour and a recomputed public SHA is `unavailable`. Forged exact objects fail closed with visible diagnostics.
- Source contour is the exact signed Bezier. Smile-line wings are analytic unit-interval intersections of that exact curve. The center horizontal section must intersect the contour, and `canvasCenterU` must lie inside that section. The derived tip cap is a deterministic adaptive de Casteljau flattening with `flatnessTolerance=1e-4`, `maxSubdivisionDepth=12`, `maxPoints=2048`, and fail-closed overflow. Wing-on-contour tolerance is `4e-4`. The entire generated smile boundary is sampled with a bounded `48` samples/segment walk and must stay inside or on the exact contour under `boundaryContainmentTolerance=5e-4`. A contract-valid custom recipe may still be contour-incompatible; coffin/short/L1 custom smooth `leftWingV=0.04 centerV=0.02 rightWingV=0.04` is rejected (`center_off_contour`, because `centerV=0.02` does not intersect that contour). This is software-geometry exactness only; it is not physical or manufacturing exactness.
- Derived fill and outline `vector_shape` payloads are `locked=true` and ID-free. Recipe parameters remain the only authoring truth. FRENCH-03 must replace those projections atomically via French-specific commands; generic vector editing is not authorized.
- Tests compare compiler wings, derived cap points, and smile-boundary containment to an independent 256-sample + bisection / even-odd oracle, not a copy of the compiler sampler or adaptive flattener.
- Cache/binding keys are SHA-256 of a length-prefixed canonical exact-key payload. Structured `cacheIdentity` exposes compiler revision, recipe id/revision, canonical parameters, asset id/revision, finger, full registry SHA, full contour SHA, canonical viewBox, and `canvasCenterU`. Both key preimages include all of those identities. Numeric fields use deterministic ECMAScript finite-number round-trip serialization (`Number.prototype.toString`) with deliberate `-0` normalization to `'-0'`. Distinct accepted IEEE-754 values do not collapse to the same string. Coherent viewBox/`canvasCenterU` drift fails registry binding; a pure key-helper fixture with ~`1e-13` viewBox.x drift produces different preimages and cache/binding keys. Same-key/different-identity and same-key/different-output are not allowed.
- 60 golden cases = signed shapes `almond/oval/coffin` × 4 lengths × 5 default presets, representative finger `L1`. 600 bindings = those 60 × all 10 `FINGER_CODES` resolved through `resolveSignedProductGeometryRefV7`. The 600 bindings are property evidence, not visually signed golden. Machine-readable `golden-manifest.json` is sorted; 60 SVG review images live under `svg/`. Default/`--check` compares independently computed current bytes with committed evidence and does not write. Only explicit `--update` may overwrite. Per-file `sha256`/`byteLength` plus a collection digest of those file records are stored; the digest does not recursively hash itself. No reviewer approval is stored.

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
| `canvasCenterU` was only range-checked in `[0, 1]`, so viewBox/center drift could keep the same cache key while changing compiled output | Require `canvasCenterU === (0 - viewBox.x) / viewBox.width` within `1e-9`; put canonical viewBox and `canvasCenterU` in structured cache identity and both key preimages; reject unknown geometry keys |
| Contract-valid custom recipes could still draw a smile that exits a specific contour | Require the center horizontal section to exist and contain `canvasCenterU`; bounded smile-boundary containment with `5e-4` tolerance; reject coffin/short/L1 `0.04/0.02/0.04` (this fixture currently fails closed at `center_off_contour` because `centerV=0.02` does not intersect that contour) |
| Derived `vector_shape` payloads were `locked=false`, which would authorize generic vector editing | Set fill and outline `locked=true`; no IDs; recipe remains authoring truth |
| Golden generator self-certified by always writing evidence | Default/`--check` is non-mutating and compares committed bytes; only `--update` writes; missing/extra/stale SVG and byte drift fail closed |
| Parser/test matrix was incomplete | Table-test accepted absolute `M/L/C/Q` plus `H/V` conversion; reject absolute `A/S/T`, every relative `m/l/c/q/h/v/z`, incomplete, empty/open, second `M`, two closed subpaths, and `Z` followed by commands |
| No schema compatibility evidence for locked ID-free projections | Test-only IDs materialize fill/optional outline into a blank EditorDocV7 `flat_design` step; `parseEditorDocV7` succeeds and `locked=true` survives. Compatibility evidence only, not store/history/UI integration |
| Compiler validated allowlists and self-consistent contour SHA, but still compiled a forged almond tuple that swapped in another signed contour and recomputed `sha256Hex` | `rebindFrenchExactGeometryToCanonicalRegistryV1` re-resolves `{assetId, revision, finger, registryAssetSetSha256}` through the static product registry and compares canonical geometry field-for-field; forged cross-contour objects and shape/length/viewBox/center/finger/revision/SHA drift fail closed. No fallback or generic/generated acceptance. |
| `canonicalFrenchNumberKeyV1` used `toFixed(12)`, so coherent `viewBox.x` / `canvasCenterU` drift smaller than `1e-12` collapsed to the same cache/binding key while raw identity differed | Replace with ECMAScript finite-number round-trip `toString` and explicit `-0` → `'-0'`. Distinct accepted IEEE-754 numbers keep distinct preimages. Coherent registry drift fails rebind; a ~`1e-13` key-helper fixture produces different cache/binding keys. |
| SVG tokenizer stripped commas before comparison, so leading/trailing/double/command-adjacent commas were silently accepted | Strict tokenizer: commas may only separate numeric pairs. Reject leading comma, trailing comma, repeated commas (including whitespace-separated), comma immediately after a command, and comma before a command. Valid `10,10` / `10, 10` pairs remain accepted. |

## Numeric tolerances

| Name | Value | Role |
|---|---|---|
| `FRENCH_CONTOUR_FLATNESS_TOLERANCE_V1` | `1e-4` | Adaptive cap flattening chord-to-curve bound |
| `FRENCH_CONTOUR_MAX_SUBDIVISION_DEPTH_V1` | `12` | de Casteljau split budget; overflow fails closed |
| `FRENCH_CONTOUR_MAX_POINTS_V1` | `2048` | Flattened vertex cap; overflow fails closed |
| `FRENCH_WING_ON_CONTOUR_TOLERANCE_V1` | `4e-4` | Analytic wing insertion / on-contour check |
| `FRENCH_ANALYTIC_ROOT_TOLERANCE_V1` | `1e-12` | Unit-interval Bezier × horizontal-line roots |
| `FRENCH_CANVAS_CENTER_U_TOLERANCE_V1` | `1e-9` | `canvasCenterU` vs `(0 - viewBox.x) / viewBox.width` |
| `FRENCH_BOUNDARY_CONTAINMENT_TOLERANCE_V1` | `5e-4` | Smile-boundary inside-or-on exact contour |
| `FRENCH_BOUNDARY_CONTAINMENT_SAMPLES_V1` | `48` | Bounded samples per smile-boundary segment |
| Independent oracle match bound | `5e-4` | 256-sample + bisection test oracle; not a copy of the compiler |

## Automated gates

| Gate | Result |
|---|---|
| `npm run test:editor-v7-french-compiler` | PASS — 60 golden exact, 600 unique hashed bindings, parser matrix including illegal commas, registry-tuple rebind, forged almond+oval contour + recomputed SHA, precision collision keys, locked projections, coffin/short custom reject, custom/asymmetric/range-edge across 3×4, schema parity, independent containment oracle |
| `npm run test:editor-v7-french-contract` | PASS |
| `npm run test:editor-v7-french-migration` | PASS |
| `npm run test:editor-v7-contract` | PASS |
| `npm run test:handdraw` | PASS — legacy French/mirror/migration/recipe selftests unchanged |
| `npm run typecheck` | PASS |
| `npm run update:editor-v7-french-golden` then `npm run check:editor-v7-french-golden` twice | PASS — cache/binding keys regenerated after number-key serialization change; 60 SVG review bytes unchanged; collection digest `71883b7f45415ff05473a07dc8ec09f98c1209522d0aa0d27c9d72f78224efc8` stable across update and two subsequent checks |
| `npm run check:editor-v7-french-golden` / `generate:editor-v7-french-golden` independent rerun | PASS — full working diff SHA remained `22b0ea1a7bab1673af1d0f44567dfffcc9ed31986fc2f244c4f1dc914730b3c5`, confirming check mode is non-mutating |
| `npm run build` | PASS — existing Vite chunk-size warning only |
| `npm run build:integration` | PASS — existing Vite chunk-size warning only |
| `git diff --check` | PASS |

`npm run generate:editor-v7-french-golden` is an alias of the non-mutating check. It does not write evidence. Default/`--check` remains non-mutating; only explicit `--update` may overwrite.

## Exact compiler gates

- 60/60 golden compiles are `fidelity=exact` and `manufacturingValidated=false`.
- 600/600 bindings are exact, with 600 unique binding keys and 600 unique cache keys. They are property evidence, not visually signed golden.
- Same input yields identical bytes; compiler does not mutate geometry or parameters.
- All compiled coordinates are finite and inside `[0, 1]`.
- Fill path is closed and drawable; boundary path is drawable and not closed.
- Fill and outline projections are `locked=true` and contain no IDs.
- Analytic wings match an independent higher-precision reference within `5e-4`. Derived cap vertices stay within that bound of the exact source contour. Smooth centers are closer to the canvas tip edge than both wings, with G1 tangent continuity at center. Pointed centers are closer to the canvas root edge than both wings, and pointed output contains only `M/L` commands.
- Valid custom/asymmetric/`balanceLocked=false` and range-edge recipes compile across all 3 signed shapes and 4 lengths.
- Negative cases fail closed: wrong finger, 1-character revision drift, truncated/wrong SHA, unknown asset, generated square, malformed path, relative path, second `M`, illegal commas, forged exact objects including almond tuple + oval contour + recomputed contour SHA, reserved-delimiter identity injection, contour/registry SHA drift, unknown geometry keys, incoherent `canvasCenterU`/viewBox, coherent viewBox/center drift that does not match the registry tuple, and contour-incompatible custom recipes including coffin/short/L1 `0.04/0.02/0.04`.

## Acceptance limits

This checkpoint is software geometry / prototype evidence only. It is not visual sign-off, physical fit, manufacturing, or production proof.

- EditorDocV7 / `schemaVersion: 7` remains frozen. The corrected `FrenchRecipeSpecV1` at `1c97f04` remains the sole parameter truth.
- No Editor UI, store command, history, preview, PBR, material projection, release, import, use, or approval integration is included.
- Schema parity materialization is compatibility evidence only. It does not authorize generic vector editing or FRENCH-03 integration.
- 60 SVG review images are deterministic algorithm dumps. Codex rendered all 60 into three shape contact sheets and checked preset ordering, contour containment, clipping, symmetry/wing continuity, and pointed-versus-smooth form; 60/60 passed this software visual review. This is not Product/Design/Nail Expert human sign-off, and `golden-manifest.json` correctly keeps `visualSignoff: false`.
- `manufacturingValidated` is always `false`. SVG, path bytes, and cache hashes are derived views, not manufacturing artifacts.
- Exact source Bezier plus a deterministically flattened cap does not imply physical or manufacturing exactness.

Evidence tier: local compiler/prototype tests plus prior Codex software visual review of unchanged SVG bytes. FRENCH-02 is `READY(branch)` for this software checkpoint only; owner human visual sign-off remains a pre-merge/product-acceptance gate.
