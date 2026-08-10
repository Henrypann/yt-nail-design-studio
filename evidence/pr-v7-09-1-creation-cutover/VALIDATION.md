# PR-V7-09.1 Validation — Creation Cutover & Geometry Binding

Date: 2026-08-10
Branch: `codex/pr-v7-09-1-creation-cutover`
Base: `f82f2afe217dd477b25bafd9ae15d223dadf9319`

## Accepted scope

- With `VITE_EDITOR_V7=1`, blank creation writes a canonical `EditorDocV7` and opens the V7 writer.
- Representable Wizard/Community summaries write V7 exactly once. Existing schema 1–7 documents are opened by their exact writer and never rebuilt from the summary.
- Wizard recipe, dimensional-decoration and pearl-finish content remains on the V6 compatibility writer until its V7 adapters exist; the bridge warning states this explicitly.
- Every created nail binds `geometry.<shape>.<length>.<finger>` at `shape-params-v3`; the UI derives a signed product silhouette and human-readable label.
- Official Wizard template patterns materialize as checksum-verified `image_2d` asset refs. The new adapter only renders matching bundled SVGs and does not create a second asset truth.
- With `VITE_EDITOR_V7=0`, blank and Wizard creation remain V6.

## Compatibility boundaries

- `EDITOR_DOC_MIGRATABLE_MAX_VERSION` remains 6; `EDITOR_DOC_KNOWN_MAX_VERSION` is 7.
- Future/invalid documents fail closed. The create-only V7 repository rejects overwrite and a raced existing document is re-probed before navigation.
- Generic, imported `image_2d` content remains deferred to V7-10; this PR renders only registry-identified official template SVGs.
- Full recipe, surface-effect and dimensional-decoration materialization remains V7-12/V7-13 scope.

## Independent review

Claude Code was invoked twice in read-only mode: once for pre-implementation compatibility review and once against the real diff. Both calls stopped at the fixed `$0.75` budget with no usable findings and made no Git changes. They are recorded as unavailable review evidence, not as an approval.

## Automated verification

PASS:

- `npm run typecheck`
- `npm run build:integration`
- `npm run test:editor-v7-contract`
- `npm run test:editor-v7-migrate`
- `npm run test:editor-v7-runtime`
- `npm run test:editor-v7-workspace`
- `npm run test:editor-v7-workspace-ia`
- `npm run test:editor-v7-customer-preview`
- `npm run test:editor-v7-background`
- `npm run test:editor-v7-background-advanced`
- `npm run test:editor-v7-flat-vector`
- `npm run test:editor-v7-creation-cutover`
- `npm run test:editor-v6-contract`
- `npm run test:editor-v6-migrate`
- `npm run test:editor-v6-runtime`
- `npm run test:store-v6`
- `npm run test:pr05-v6-bridge`
- `npm run test:handdraw`
- `npm run validate-assets`
- `npm run validate-recipes`
- all six `test:community-*` gates
- `git diff --check`

`npm run test:slots` still fails at the pre-existing `abs(rotationDeg) < 5` assertion. The same command fails on unchanged `main @ f82f2af`; this PR does not modify slot calibration.

## Real-browser walkthrough

Browser UI was exercised against both feature states without reading browser storage.

1. `VITE_EDITOR_V7=1`, `/design/canvas?blank=1`: blank creation opened `Editor V7`; StageBar reported `almond / medium 产品轮廓`; R4 displayed `geometry.almond.medium.R4`.
2. Wizard customer → Almond/Medium → `Liquid Velvet Cat-eye` → free canvas: bridge warning included the V6 loss-prevention boundary, then opened `Editor V7` with one `Wizard 模板` flat step.
3. The live flat canvas exposed `data-v7-official-template="t_liquid_velvet_cat_eye"` and `data-silhouette-source="product"`.
4. After a full page reload the page remained V7, the same official template element was rendered once, and geometry source remained `product`.
5. `VITE_EDITOR_V7=0`, `/design/canvas?blank=1`: blank creation opened the existing `V6 direct manipulation canvas`.

No product claim is made for manufacturing accuracy. Evidence level: `runtime-golden` for writer selection, persistence and registry binding; SVG rendering remains a 2D application preview.
