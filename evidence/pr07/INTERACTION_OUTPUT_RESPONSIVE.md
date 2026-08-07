# PR-07 repaired acceptance

Date: 2026-08-07

Branch: `integration/community-first-v6-repaired`

## Scope

- V6-only operable editor shell and direct element projection.
- V6 element selection, transform, lock, duplicate/delete, copy, and opposite-finger mirror commands.
- Customer-ready 2D output with explicit output intent, ten-finger preview, PNG export, renderer fallback, and manufacturing-unverified disclosure.
- Responsive editor behavior at 390x844, 1280x720, and 1440x900.

## Browser walkthrough

The walkthrough used a blank V6 design on the local integration build.

### Interaction

- Added a structured brush element on R4 and selected it from the canvas hit target.
- Changed x/y to `24/-12`; lock disabled both numeric fields, both transform ranges, and duplicate/delete mutations.
- Saved and reloaded the design; R4 retained `24/-12`.
- Mirrored the active R4 layer to L4; after reload L4 retained one visible element in `手绘 · 镜像`.
- Store behavior tests additionally cover transform scale clamping, arrow-key nudge commands, read-only rejection, and mirrored x/rotation geometry.

The browser bridge did not expose a low-level pointer-drag primitive, so the drag gesture itself is covered by the shared transform command path and source contract rather than a recorded physical pointer trace.

### Customer output

- Switched output intent from design editing to customer presentation.
- Ten-finger preview rendered in `overview` mode with all ten finger labels.
- The UI displayed `Canonical 2D preview` and the manufacturing-unverified warning.
- PNG export produced the success toast `顾客预览 PNG 已导出。` with no error toast.
- Output intent persisted after save and reload.

### Responsive matrix

| Viewport | Result |
|---|---|
| 390x844 | No document horizontal overflow; Save and Confirm visible; four mobile tools visible; tool drawer opens; customer output scrolls into view; ten-finger preview and PNG export work. |
| 1280x720 | No document horizontal overflow; Save, Confirm, canvas, and customer output present. |
| 1440x900 | No document horizontal overflow; Save, Confirm, canvas, and customer output present. |

## Automated gates

- `git diff --check`
- `npm run typecheck`
- `npm run build:integration`
- `npm run test:pr07`
- `npm run test:editor-v6-runtime`
- `npm run test:store-v6`
- `npm run test:pr04-editor-entry`
- `npm run test:pr05`
- `npm run test:pr06`
- `npm run test:pr08`
- `npm run test:handdraw`
- `npm run validate-assets`
- `npm run validate-recipes`
- all six `test:community-*` gates

`npm run test:slots` remains the pre-existing baseline failure at the L3 rotation assertion (`5.81 > 5`). PR-07 does not modify Slot V2 data or calibration code.

## Evidence boundary

- Production-ready path: V6 state, permissions, interaction commands, renderer resolution/fallback, responsive shell, customer PNG.
- Simulated path: 3D adapter status and customer presentation rendering.
- Unverified path: manufacturing output and physical nail validation remain explicitly disabled/not claimed.
