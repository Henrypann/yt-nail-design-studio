# PR-04 V6 production entry migration

The `/design/canvas` route now loads, creates, edits and saves through
`EditorDocV6` only. `EditorPage` directly uses `useEditorV6Store`,
`createBlankEditorDesignV6` and `EditorShellV6`.

The V6 shell intentionally provides a bounded structural prototype: ten-finger
navigation, a silhouette/base-surface preview, geometry and finish controls,
V6 layer operations, history, save/retry and read-only states. It does not claim
the direct-manipulation, presentation/export or 3D parity owned by PR-07.

`test:pr04-editor-entry` recursively follows local TypeScript imports from the
production page and rejects any reachable legacy `store.ts` or
`useEditorStore` consumer. Runtime persistence failure/retry behavior remains
covered by `test:editor-v6-runtime`.

Known follow-up boundaries:

- PR-05 must replace the legacy Wizard bridge with the unique-ID V6 bridge.
- PR-07 must implement V6-native direct manipulation and customer-ready output.
- Legacy editor files remain in the repository as unreachable compatibility
  material until those follow-ups are accepted; they are not imported by the
  production V6 editor entry.

## Manual walkthrough

Local route: `http://127.0.0.1:5210/design/canvas?blank=1`.

- Created a blank V6 design, edited the R4 base color, added a hand-paint layer,
  switched R4/R5 and verified the per-finger layer stack changed.
- Renamed and saved the design, reloaded its deep link and verified title and
  saved state recovered from storage.
- At 1280×720 the canvas, inspector, layers, ten-finger strip and save actions
  were simultaneously reachable with no horizontal document overflow.
- At 390×844 the shell used a four-item horizontal tool switcher, remained
  vertically scrollable and had no horizontal document overflow.
- Product console errors: 0. Only the existing React Router v7 future-flag
  warnings were present.
- The exact temporary QA design `PR04 V6 QA` was deleted through the product UI
  after the walkthrough.
