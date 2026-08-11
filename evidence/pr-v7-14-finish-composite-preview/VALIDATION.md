# EDITOR-V7-14 validation

- Base: `1f0cae0eb1af5ce484ed136d48180c058d31e1f7`
- Branch: `codex/pr-editor-v7-14-finish-composite-preview`
- Scope: canonical gloss/matte/frosted finish definitions, UI-only finish comparison, explicit one-transaction apply, canonical-order SVG 2.5D composite, responsive inspector and evidence
- EditorDoc: `schemaVersion: 7` remains unchanged; `surface_finish` stays unique, visible, unskipped and last
- Write boundary: selecting a finish preview changes only `previewFinishType`; applying changes the canonical finish payload and its material reference together, without locking later edits
- Composition boundary: the renderer reads background, visible/unskipped middle steps, and finish in canonical order; it does not create a second document or persist derived preview state
- Evidence boundary: the composite is explicitly labelled WebGL-free simulated 3D / SVG 2.5D. It is not real-material, UV/LED-cure, physical-fit, or manufacturing proof

## Automated gates

- `npm run build:integration`: pass; the existing >500 kB chunk-size warning remains non-blocking
- `npm run typecheck`: pass after final changes
- V7 contract, migration, runtime, workspace, workspace IA, background, advanced background, flat vector, flat assets, ten-finger, customer preview, creation cutover, surface-effect, dimensional-decoration, and finish-composite suites: pass
- Studio V7.1 release/import and Community use/customize suites: pass
- V6 contract, migration, runtime, and store regression suites: pass
- `git diff --check`: pass

## Finish and persistence checks

- Preview matte from canonical gloss: document JSON, revision, history, pending revision, and autosave scheduling remain unchanged
- Read-only users can compare finish previews but cannot apply them; switching state ignores preview changes
- Apply matte: one canonical transaction, one finish, finish remains last, and material identity stays synchronized
- A subsequent background edit succeeds and keeps matte, proving that applying finish does not freeze continued editing
- Undo, redo, autosave, save, and storage reload preserve the applied finish

## Responsive walkthrough

- Viewports: 390, 768, 1024, 1280, 1440
- Live pipeline: background, flat design, surface effect, dimensional decoration, surface finish
- Deliberately mismatched the in-memory attachment mesh SHA, then verified `unavailable`, preserved canonical data, and visible 2D fallback
- Preview selection was verified as zero-write before applying; a background edit was verified after applying
- No document horizontal overflow; zero captured console errors and page errors
- Compact dialog initial focus, focus trap, and trigger focus restoration: pass
- Relevant compact controls: minimum 44 px height
- Report: `walkthrough-report.json`
- Screenshots: `390-finish-inspector.png` plus one finish-composite screenshot per viewport

## Claude advisory audit

- A/B/C/D bounded read-only advisory calls were attempted with `external-data-basis=explicit-skill` and Read/Glob/Grep only.
- The cross-session advisory workflow and final actual changed-file review were also attempted before commit.
- Packy returned HTTP 400 because the configured token group did not cover the Anthropic fallback model. No Claude call was treated as approval, and this is not a model-quality result.
- Codex independently reviewed the actual files and found no remaining P0/P1 issue after explicitly marking 2D eraser/region-mask participation as approximate.

## Remaining risks

- SVG 2.5D finish lighting and decoration shadows are deterministic edit-preview approximations, not WebGL material rendering.
- The composite preserves structured 2D eraser/region-mask data but does not fully execute those mask semantics; the UI now calls this out as approximate.
- Claude provider routing remains unavailable in this environment and should be repaired independently from this product branch.
