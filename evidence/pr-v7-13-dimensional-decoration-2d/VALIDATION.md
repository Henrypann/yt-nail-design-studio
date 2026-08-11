# EDITOR-V7-13 validation

- Base: `7272d8621a4cb3c67fb446e233690acfdf2e4802`
- Branch: `codex/pr-editor-v7-13-dimensional-decoration-2d`
- Scope: structured relief/attachment presets, manifest-backed mesh refs, editable height/anchor/scale/rotation, deterministic 2.5D fallback renderer, responsive inspector and evidence
- EditorDoc: `schemaVersion: 7` and the existing `relief_2_5d | attachment_3d` union remain unchanged; `surface_finish` stays unique and last
- Asset authority: `assets/glb/manifest.v1.json` is imported and validated as the only mesh identity/SHA source; EditorDoc stores versioned refs, never paths or encoded blobs
- Failure boundary: missing, unknown, or SHA-mismatched mesh data yields `unavailable`, keeps the canonical asset ref, and preserves a visible dashed 2D fallback
- Evidence boundary: all height shadows and registered GLB assets are edit-preview simulations, not material, assembly, physical-fit, or manufacturing proof

## Automated gates

- `npm run build:integration`: pass
- `npm run typecheck`: pass after final changes
- V7 contract, migration, runtime, workspace, workspace IA, background, advanced background, flat vector, flat assets, ten-finger, customer preview, creation cutover, surface-effect, and dimensional-decoration suites: pass
- Studio V7.1 release/import and Community use/customize suites: pass
- V6 contract, migration, runtime, and store regression suites: pass
- `git diff --check`: pass

## Responsive walkthrough

- Viewports: 390, 768, 1024, 1280, 1440
- Added relief, droplet, and manifest-backed accessory through the visible UI
- Deliberately mismatched the in-memory mesh SHA, then verified `unavailable`, one preserved asset ref, and visible 2D fallback
- No document horizontal overflow; zero captured console errors and page errors
- Compact dialog initial focus, focus trap, and trigger focus restoration: pass
- Relevant compact controls: minimum 44 px height
- Canonical finish invariant checked from the live store at every viewport
- Report: `walkthrough-report.json`
- Screenshots: `390-decoration-inspector.png` plus one dimensional-decoration screenshot per viewport

## Claude advisory audit

- A/B/C/D bounded read-only advisory calls were attempted with `external-data-basis=explicit-skill` and Read/Glob/Grep only.
- The final changed-file review was also attempted before commit.
- Packy returned HTTP 400 because the configured token group did not cover the Anthropic fallback model. No Claude call was treated as approval, and this is not a model-quality result.
- Codex independently reviewed the actual files and found no remaining P0/P1 issue after correcting Mercury ribbon classification, using the full schema height range, and regenerating walkthrough evidence.

## Remaining risks

- The registered Mercury ribbon/droplet GLBs remain `SIMULATED` and `manufacturingValidated: false`; V7-13 intentionally renders the canonical editor fallback rather than asserting browser mesh acceptance.
- Generic attachment fallback communicates location/height and missing state, not the exact mesh silhouette.
- Claude provider routing remains unavailable in this environment and should be repaired independently from this product branch.
