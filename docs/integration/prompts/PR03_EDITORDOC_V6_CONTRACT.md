# Cursor prompt — PR-03 EditorDocV6 contract and migration

Implement PR-03 on branch `cursor/pr-03-editordoc-v6-contract`, cut from the accepted PR-02 integration head. This prompt replaces the legacy worktree/branch gate in `AGENTS.md` section 8.4; do not edit `AGENTS.md`.

Read the integration plan and common delivery standard first. Use only the model/migration portions of `369d516`, `11f5348`, `171d9e2`, and `9b748dd` as design evidence. Rewrite them around v6; do not expose a new `EditorDocV4` whose literal version is 5.

## Objective

Create one explicit, globally compatible `EditorDocV6` contract and a pure migration boundary for every stored editor document version currently observed.

## Required model

- `schemaVersion: 6` literal and `EditorDocV6` type name agree.
- Ten named fingers have independent ordered layer stacks, optional geometry overrides, stable layer/element IDs, and explicit visibility/lock/order semantics.
- Preserve document identity, customer/title, default geometry, length preset, appearance/finish, master finger, recipe instances, communication references, output intent, timestamps, and version/revision metadata needed by current consumers.
- Define which field is canonical and which fields are projections. Recipe/geometry/finish must not have two writable sources of truth.
- IDs must be collision-resistant across reload and rapid repeated operations. Do not use `Date.now()` alone.

## Required migration/repository contract

- Pure read adapters for v1, v2, v3, Cursor v4 fixture, Cursor v5 fixture, and v6.
- Deterministic v1-v5 → v6 migration with explicit defaults and preservation assertions.
- Reading/migrating performs no storage write. A write occurs only through explicit save/edit/create behavior.
- Unknown future schema returns `unsupported`; malformed input returns `invalid`; missing is distinct.
- Expose version-neutral repository results and `inspectEditorDoc`; public consumers must not call `getEditorDocV4`/`saveEditorDocV4`.
- Add checked-in legacy fixtures that represent real main and Cursor shapes without personal/customer data.

## Prohibited scope

- No v6 UI/store rollout, 3D runtime, taxonomy relabel, Wizard recommendation work, or broad visual changes.
- Do not delete legacy read support. Do not mutate storage during migration tests.

## Required tests

Add `test:editor-v6-contract` and `test:editor-v6-migrate`. Cover every version, idempotence, stable ordering/IDs, recipe/appearance/geometry preservation, missing optional fields, invalid JSON/object, future version, frozen input, no-write-on-read spy, and save rejection for non-v6 documents.

Run the common gate plus both v6 scripts.

## Acceptance

- The compatibility matrix v1-v6 is documented and executable.
- There is one new writable format and one version-neutral repository boundary.
- No public type/file/API mislabels schema 5 as V4.
- Unsupported data cannot be overwritten by save/create fallbacks.

Return the standard delivery report, including the exact migration defaults and any intentionally lossy legacy field.
