# EDITOR-V7-14.1 Validation

## Scope

- Base: `main @ f11e858da033c018ca5a263b1bb714da64a8a530`
- Branch: `codex/pr-editor-v7-14-1-onboarding-state`
- Evidence class: `architecture-golden`
- No EditorDocV7 schema, repository, renderer, migration, or persistence key changes.

## Accepted behavior

- The top-level personalization stage remains one product stage while exposing three factual lanes: flat, surface effects, and dimensional decorations.
- Lane state and counts are derived only from canonical process steps; no progress state is persisted.
- Surface-effect and dimensional-decoration tools are available when their delivered V7 steps exist. The stale V7-12/V7-13 future gate is removed.
- Repeated step kinds target the currently selected compatible step before another ready compatible step; an earlier locked sibling cannot mask a later editable step.
- Mixed hidden/skipped lanes and the aggregate personalization stage are marked `attention`, never falsely `configured`.
- Tool intent has a stable priority: `switching → read_only → missing_step → locked → skipped → hidden → ready`.
- Command, undo, redo, and delete paths repair dangling step/element selection without writing extra document revisions.
- Commands targeting a non-current finger preserve the current finger's step and element selection.
- Deleting the selected middle step selects the nearest surviving sibling instead of always returning to background.

## Automated validation

| Check | Result |
|---|---|
| `npm run build:integration` | PASS |
| `npm run test:editor-v7-workspace` | PASS |
| `npm run test:editor-v7-workspace-ia` | PASS |
| `npm run test:editor-v7-runtime` | PASS |
| `npm run test:editor-v7-flat-content-assets` | PASS |
| `npm run test:editor-v7-surface-effect` | PASS |
| `npm run test:editor-v7-dimensional-decoration` | PASS |
| `npm run test:editor-v7-finish-composite` | PASS |
| `npm run test:editor-v7-creation-cutover` | PASS |
| `git diff --check` | PASS |

The existing Vite chunk-size warning remains informational. Five-viewport guided-start and conflict-feedback walkthroughs belong to EDITOR-V7-14.2, where those interactive surfaces are introduced.

## Explicitly deferred

- Focusable conflict feedback and recovery actions for missing, locked, skipped, hidden, read-only, and switching states.
- Blank-canvas guided first-step creation.
- Blocking authoring into hidden or skipped steps.
- Cross-finger preservation of the selected step kind and relative repeated-step position.
- Geometry and customer-stage explanatory navigation.
