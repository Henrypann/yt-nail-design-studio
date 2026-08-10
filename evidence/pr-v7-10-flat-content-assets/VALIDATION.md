# PR-V7-10 Flat Content Assets — Validation

## Scope and baseline

- Branch: `codex/pr-v7-10-flat-content-assets`
- Base: `28e3880b88076b6957386ae44a7f328d1c5684e1`
- Core checkpoint: `7b40710ff136c8f56d04dcff30cf600072513908`
- Scope: V7 flat-design text, bundled sticker/stamp, safe PNG/SVG import, relink, shared editor/customer-preview reader, resource/inspector UI, storage limits and validation.
- Explicitly out of scope: EditorDoc schema bump, 3D/manufacturing truth, Community asset sync, arbitrary remote assets, rich text layout, production print compilation.

## Implementation and independent review trace

- Hermes DSF Code Worker was the first implementation writer for the bounded core and initial UI wiring.
- Codex reviewed and completed the shared reader, import/relink flow, inspector, customer-preview parity, deterministic default placement, tests and browser acceptance.
- Hermes Luna UI Reviewer returned `pass-with-risks`. Its in-scope P1 (developer-facing asset metadata) was fixed by promoting operator-facing type/status/dimensions and moving checksum/revision/MIME details into a collapsed technical section. Its mobile P0 candidate was closed by live DOM verification and a regenerated full 390×844 screenshot; its existing V7-07 canvas-note critique and text live-preview suggestion are follow-up UX work, not V7-10 correctness blockers.
- Claude Code returned `PASS` with no P0/P1. Codex independently verified its repository-boundary uncertainty and fixed its useful P2 observation: SVG imports with a UTF-8 BOM now hash the exact persisted payload, with a prepare → repository put/get regression test.

## Product behavior verified

- Text, sticker, stamp and local PNG/SVG imports create canonical V7 `flat_design` elements only on the selected finger.
- Canonical documents contain stable references and metadata, never image bytes, base64, data URLs or raw imported SVG.
- Imported bytes live in the separate local repository `nail-studio:editor.v7.flat-assets`, with 2 MiB per-asset and 8 MiB total limits.
- SVG input is sanitized to a conservative local geometry subset; PNG structure, dimensions, CRC and color/alpha metadata are validated.
- Relink replaces only the selected imported asset reference while preserving element transform, opacity, visibility and lock state.
- Missing/corrupt assets preserve the canonical element and render an explicit placeholder.
- Editor canvas and customer preview use the same artwork reader. Customer preview remains read-only and does not write the source document.
- Bundled sticker/stamp defaults use deterministic scale and stamp offsets so repeated assets remain operable instead of stacking exactly.

## Browser walkthrough

Local server: `http://127.0.0.1:5213` with `VITE_EDITOR_V7=1`.

Verified flow:

1. Created a blank V7 design and selected a product geometry.
2. Added a flat-design step on one finger.
3. Added and edited text, then added bundled sticker and stamp assets.
4. Imported a safe SVG, saved, reloaded and relinked it to another safe SVG.
5. Opened customer preview and verified text, bundled assets and imported SVG use the shared reader.
6. Changed an ephemeral customer-preview background/finish scenario and returned to the editor; the source revision remained saved and unchanged.

Responsive DOM assertions:

| Viewport | Layout | Canvas region | Overlay | Document overflow |
|---|---:|---:|---:|---:|
| 1440 | wide | 804 px | none | none |
| 1280 | wide | 644 px | none | none |
| 1024 | compact | 960 px | one mutually exclusive overlay | none |
| 768 | tablet | 768 px | one mutually exclusive sheet | none |
| 390 | mobile | 390 px | one mutually exclusive sheet | none |

The mobile evidence is a direct 390×844 viewport capture and is paired with live DOM assertions (`innerWidth=390`, `innerHeight=844`, `scrollWidth=390`). No persistent console errors or unhandled rejections were observed. The only console item was the existing React Router future-flag warning.

Screenshots:

- `screenshots/1440-flat-content.png`
- `screenshots/1280-flat-content.png`
- `screenshots/1024-flat-content.png`
- `screenshots/768-flat-content.png`
- `screenshots/390-flat-content.png`

## Automated gates

Passed:

- `npm run typecheck`
- `npm run build:integration`
- `npm run test:editor-v7-flat-content-assets`
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
- `npm run test:handdraw`
- `npm run validate-assets`
- `npm run validate-recipes`
- all six `test:community-*` gates
- `git diff --check`

Known non-blocking baseline:

- `npm run test:slots` still fails the unchanged legacy `abs(rotationDeg) < 5` assertion. The same failure is reproducible on local `main @ f82f2af`; V7-10 does not modify Slot V2 data or math.

## Storage, migration and rollback

- No EditorDocV7 schema migration is introduced.
- Asset repository writes are separately validated and fail atomically before a canonical element is committed.
- Rollback is the two V7-10 commits. Existing V7 documents remain readable; the separate local asset repository can be retained without affecting earlier readers.

## Evidence classification

| Level | Evidence |
|---|---|
| production-ready code path | V7 contract-safe creation, storage validation, shared 2D reader, import/relink, editor and customer preview UI |
| fixture-only | Four bundled sticker/stamp SVG assets and their checksum registry |
| simulated | 2D on-nail preview, text/font fallback and responsive browser walkthrough |
| unverified | Color/material accuracy, print output, 3D appearance, physical manufacturing and device delivery |
