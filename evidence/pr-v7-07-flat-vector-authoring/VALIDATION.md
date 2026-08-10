# PR-V7-07 Validation｜Flat Vector Authoring

Date: 2026-08-10

Branch: `codex/pr-v7-07-flat-vector-authoring`

Base / merge-base: `24a6561c0562999f8a2f5a655b7e62e4555b231e` (`codex/pr-v7-05-background-basic`)

Evidence level: `integrated` for the internal V7 editor path; rendering is a deterministic 2D SVG preview, not manufacturing proof.

## Delivered scope

- Single-finger flat-design authoring for brush, non-destructive eraser, line, rectangle, circle, star, French edge and region mask.
- Strict absolute nail-local `M/L/Q/C/Z` path parser; finite `0..1` coordinates; degenerate stroke/area rejection.
- Geometry-clipped SVG composition with a shared `100 × 160` canvas mapping and explicit `mm → preview units` conversion.
- Pointer capture plus `getScreenCTM().inverse()` coordinate conversion; transformed anchors include quadratic/cubic control points.
- Element selection/move, opacity, typed path editing, ordered masks, undo/redo, autosave, save/reload and read-only/lock/switch gates.
- Canonical arrays and V7 payloads remain the only persisted truth; drawing drafts, selection and active tools stay UI-only.

## Explicitly excluded

- Text, sticker, stamp, image/RGBA import (`V7-08`).
- Ten-finger copy/sync/mirror (`V7-09`).
- Surface effects, dimensional decoration, 3D/final render and manufacturing semantics.
- New schema fields, migration changes, V7 blank writer, merge, rebase, cherry-pick or push.

## Independent review and fixes

The first read-only review returned `BLOCK` with two P0 and three P1 groups. Codex reproduced and closed them before acceptance:

| Finding | Resolution / evidence |
|---|---|
| Drawing over an existing shape was intercepted by element selection | Element pointer handling now consumes events only in select mode. Browser evidence: `eraserAddedFromExisting=true`. |
| Brush/line/eraser were effectively sub-pixel | All paths and polylines are mapped into one canvas space; `0.45 mm` renders as `3.6` preview units. |
| Bounding-box pointer math and transformed anchors drifted | Pointer uses SVG CTM inversion; anchor display/write-back uses forward/inverse element transforms; Q/C control pairs are editable. |
| Zero-length/zero-area paths and masks were accepted | Stroke requires distinct points; area requires a closed, non-collinear span above the minimum threshold. |
| No-op history and dangling selection | Empty moves and unchanged replacement are rejected; sliders commit once; failed path edits restore canonical data; successful deletion clears selection. |
| Mask opacity control did not affect rendering | Mask opacity now means effect intensity: 0% is non-affecting, 50% partial, 100% complete for eraser and normal/inverted region masks. |

## Automated validation

Passed:

- `npm run typecheck`
- `npm run build:integration`
- `npm run test:editor-v7-flat-vector`
- `npm run test:editor-v7-contract`
- `npm run test:editor-v7-migrate`
- `npm run test:editor-v7-runtime`
- `npm run test:editor-v7-workspace`
- `npm run test:editor-v6-contract`
- `npm run test:editor-v6-migrate`
- `npm run test:editor-v6-runtime`
- `npm run test:store-v6`
- `npm run test:handdraw`
- `npm run validate-assets`
- `npm run validate-recipes`
- six `test:community-*` checks
- `git diff --check`

Known baseline only:

- `npm run test:slots` still fails the unchanged `Math.abs(slot.rotationDeg) < 5` assertion for L3 (`5.81°` on the established baseline). V7-07 changes no Slot V2 data or math.

## Browser acceptance

Fresh server: `VITE_EDITOR_V7=1`, port `5235`.

| Gate | Result |
|---|---|
| 390 / 1280 / 1440 | PASS; `noHorizontalOverflow=true` at all three sizes |
| Console / page error | PASS; zero errors at all three sizes |
| Real authored elements | PASS; brush, line, rectangle, eraser, region mask and French persisted |
| Draw eraser from existing rectangle | PASS; element count increased by one |
| Stroke visibility | PASS; visible brush/line, `renderedStrokeWidth=3.6` |
| Geometry clip / masks | PASS; all derived content stays under the product silhouette clip; originals remain canonical |
| Move then anchor display | PASS; transformed first anchor moved to `cx≈27`, not its untransformed `cx≈20` |
| Undo / redo | PASS; `6 → 5 → 6` elements |
| Mask intensity | PASS; eraser 0/50% rendered as stroke opacity 0/0.5; normal region 0/50% rendered with base opacity 1/0.5; both persisted at 0.5 |
| Save / reload | PASS; six typed elements reload at revision 14 |
| Single-finger isolation | PASS; all pointer paths remained nail-local; non-current nails were not changed |

Evidence:

- `screenshots/390-flat-empty.png`
- `screenshots/1280-flat-empty.png`
- `screenshots/1280-flat-authored.png`
- `screenshots/1440-flat-empty.png`
- `screenshots/walkthrough-report.json`

## Integration note

V7-06 and V7-07 were intentionally developed as sibling branches from V7-05 to permit parallel validation. V7-07 does not contain V7-06. Their shared files (`EditorShellV7`, `LayerPanelV7`, `store-v7`, `index.ts`, `package.json`) require an explicit ordered integration decision; this PR performs no merge or history rewrite.

## Recommendation

`ACCEPTED`. Final independent read-only review: `PASS`, P0 = 0, P1 = 0. The branch is suitable for ordered integration after V7-06, with shared-file conflicts resolved deliberately and the full combined UI retested.
