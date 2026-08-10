# PR-V7-09 Validation — Customer Preview Foundation

## Scope

V7-09 adds a read-only customer preview route for a saved `EditorDocV7`. It provides ten-finger and single-finger 2D views plus temporary per-finger color and global finish comparisons. Temporary comparisons exist only in React memory and do not modify the Editor document, revision, history, autosave, or repository.

This PR does not implement Customer Confirmation Snapshot, final combined 3D, surface-effect rendering, dimensional-decoration rendering, manufacturing validation, or design write-back.

## Product and data boundaries

- Entry is enabled only when the Editor reports `saveState === 'saved'`.
- Route entry captures a defensive in-memory clone; refresh/direct link uses a read-only, fail-closed repository reader.
- Preview modules do not import V7 store/commands or persistence writers.
- Unsupported text/image, surface-effect, and decoration content remains in the document and is reported honestly instead of being faked or discarded.
- Gloss, matte, and frosted are explicitly labeled deterministic 2D approximations until V7-14.
- Customer confirmation remains disabled until V7-16.

## Automated acceptance

All of the following passed on 2026-08-10:

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
- `npm run test:editor-v6-contract`
- `npm run test:editor-v6-migrate`
- `npm run test:editor-v6-runtime`
- `npm run test:store-v6`
- all six `test:community-*` scripts
- `npm run test:handdraw`
- `npm run validate-assets`
- `npm run validate-recipes`
- `git diff --check`

`npm run test:slots` still fails at the pre-existing L3 rotation threshold (`5.81 > 5`). V7-09 does not change `tools/slot-calibrator` or any Slot V2 data path, so this remains a non-blocking baseline failure.

## Browser acceptance

Real browser walkthrough covered 1440×900, 1280×900, 1024×800, 768×900, and 390×844. Evidence is recorded in `walkthrough-report.json` and `screenshots/`.

- Ten-finger overview and single-finger focus render from the saved V7 document.
- Temporary background and finish comparisons leave revision 38 unchanged.
- Desktop scenario panel is visible by default and can be collapsed to maximize the canvas.
- At 768 and 390, the scenario panel is hidden by default and opens as one modal bottom sheet.
- Mobile Escape/close restores focus to the scenario trigger; enabled controls are at least 44px; no horizontal document overflow was observed.
- Refresh/direct route uses the read-only repository fallback; returning to Editor preserves schema 7 and saved state.
- No page error or unhandled rejection was observed during the final walkthrough.

## Independent review

- Hermes Luna UI Reviewer: `pass-with-risks` before correction. Its only P1 was the permanently docked desktop scenario panel; V7-09 now provides an explicit desktop collapse control and the fix was re-verified in the browser. The reported aria-live and reset-label P2 items were also closed.
- Claude Code read-only review: unavailable because the configured gateway returned HTTP 400 stating that the active token did not cover `claude-opus-4-7`. No fallback model or automatic retry was used.
- Codex final review: no remaining P0/P1 after source, behavior, responsive, and regression checks.

## Evidence tier

`product-prototype-accepted`: production-path read-only UI and runtime behavior are verified locally. 2D fidelity is an explicit communication aid and is not physical, 3D, manufacturing, or device-output proof.
