# PR-04 runtime repair evidence

Date: 2026-08-07

## Corrected runtime behavior

- Invalid or missing target loads leave the current dirty document and its autosave timer intact.
- Valid design switches flush the current dirty document first; a failed flush blocks the switch with `save_error` and remains retryable.
- Failed unloads retain the document and pending revision, including partial persistence where the V6 document write succeeds but the design-summary write fails.
- Autosave callbacks capture `designId`; a stale callback cannot save or cancel the next design's timer.
- Invalid schema and rejected storage writes report `error`, retain pending state, and never show a false `saved` state.
- Undo and redo create monotonically increasing persisted document revisions.
- Design summary `baseColor` follows `presentationMeta.masterFinger`.
- `reloadFromStorage()` clears the timer for the dirty state it explicitly discards.

## Behavior-test boundary

`tools/test-editor-v6-runtime.mjs` dynamically imports the real Zustand store, V6 model, and `repo-v6`. It uses an in-memory `localStorage`, deterministic fake timers, and injected write failures. It does not inspect source text.

## Verification

| Command | Result |
|---|---|
| `git diff --check` | PASS |
| `npm run typecheck` | PASS |
| `npm run test:store-v6` | PASS |
| `npm run test:editor-v6-runtime` | PASS (9 runtime scenarios) |
| `npm run test:editor-v6-contract` | PASS |
| `npm run test:editor-v6-migrate` | PASS |

No UI, EditorPage, Wizard, Community, or PR-05+ files were changed.
