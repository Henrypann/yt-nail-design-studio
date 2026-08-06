# Cursor prompt — PR-04 EditorDocV6 runtime and persistence

Implement PR-04 on branch `cursor/pr-04-editordoc-v6-runtime`, cut from the accepted PR-03 integration head. This prompt replaces the legacy worktree/branch gate in `AGENTS.md` section 8.4; do not edit `AGENTS.md`.

Read the integration plan and common delivery standard. Reuse only compatible store/history/autosave ideas from `369d516`, `11f5348`, `171d9e2`, and `9b748dd`.

## Objective

Move every editor runtime and persistence consumer behind the v6 contract without preserving parallel writable v3/v5 stores.

## Required implementation

- Provide one v6 store/runtime for load, edit, history, undo/redo, autosave, manual save/retry, dirty state, error state, and refresh recovery.
- Legacy documents load in memory as v6 and are persisted as v6 only after an explicit user edit/save. Preserve the original record until the first successful v6 save.
- Migrate EditorPage/editor shell, design list reads, duplicate/delete, confirmation/read-only, new-version creation, Community conflict probe, export, and Wizard bridge APIs to the version-neutral repository.
- Ensure title, master finger, communication refs, geometry, finish/appearance, layers, recipe instances, output intent, and timestamps participate in correct history/save semantics.
- Derive and save summary, thumbnail, and canvas/output projections from the same committed v6 snapshot. Projection failure must not silently corrupt the document.
- Enforce read-only state across keyboard shortcuts, tools, autosave, and indirect mutations.

## Prohibited scope

- No final editor visual redesign or HQ renderer integration.
- No compatibility alias that lets new code keep writing schema 3/5.
- No autosave loop or save-on-load migration.

## Required tests

Add `test:editor-v6-runtime` and a recovery/dogfood script. Cover new blank creation, v3/v4/v5 open, first edit/save conversion, rapid layer creation with unique IDs, undo/redo for all document fields, autosave debounce/revision, save failure/retry, reload, duplicate, delete, confirm/read-only, create-new-version, projection success/failure, and unsupported future documents.

Run the common gate and new runtime scripts. Manually verify reload and state transitions at desktop and mobile widths.

## Acceptance

- Search proves no production consumer imports the legacy writable store or V4/V5 public APIs.
- A legacy document is not rewritten merely by opening it.
- Successful explicit save produces schema 6 plus internally consistent projections.
- Read-only and unsupported documents cannot be mutated through any known path.

Return the standard delivery report with storage keys touched and rollback behavior.
