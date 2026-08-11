# EDITOR-V7-14.2 Validation

## Scope

- Base: `main @ f460c4b`
- Branch: `codex/pr-editor-v7-14-2-guided-start`
- Deliverable: blank-canvas `0 -> 1` guidance, unified Stage / Rail / Canvas / Layer intent, explicit conflict recovery, and inactive-step authoring gates.
- Out of scope: EditorDocV7 schema changes, repository or storage-key migrations, rendering fidelity upgrades, and manufacturing/device proof.

`blank` means that the current nail has no `flat_design`, `surface_effect`, or `dimensional_decoration` step. Its canonical background and finish steps remain present and editable.

## Product and transaction contract

1. The blank workspace exposes three non-modal choices: flat design, surface effect, and dimensional decoration. The background canvas remains visible.
2. The first card activation creates only a UI intent. The explicit confirmation creates one canonical step in one store transaction: one revision, one history entry, and one autosave schedule.
3. The first-only command is idempotent per kind. A repeated or stale confirmation is rejected without allocating an ID or writing document/history/storage state.
4. Stage, Tool Rail, Canvas, Layer tree, and Inspector derive their state from the same current nail, selected step, and workspace registry. No guide state is persisted in EditorDocV7.
5. Tool conflicts use the stable priority `switching -> read_only -> missing_step -> locked -> skipped -> hidden -> ready`. Recovery is explicit and re-derived after every action; it cannot skip a conflict state.
6. Hidden or skipped steps reject content authoring at both UI and domain boundaries. Asset import/relink rejects before repository reads or writes.
7. `delete`, `move`, and `duplicate` remain explicit Layer-management operations for hidden/skipped steps. They are the deliberate structural-management exception to the content-authoring gate.
8. Background and `surface_finish` cardinality/order invariants remain unchanged. Users can preview finish without adding personalization, and can continue editing after finish selection.

## Automated gates

All commands passed on the final diff:

- `npm run typecheck`
- `npm run build:integration`
- `npm run test:editor-v7-guided-start`
- `npm run test:editor-v7-workspace`
- `npm run test:editor-v7-workspace-ia`
- `npm run test:editor-v7-runtime`
- `npm run test:editor-v7-background`
- `npm run test:editor-v7-background-advanced`
- `npm run test:editor-v7-flat-vector`
- `npm run test:editor-v7-flat-content-assets`
- `npm run test:editor-v7-surface-effect`
- `npm run test:editor-v7-dimensional-decoration`
- `npm run test:editor-v7-finish-composite`
- `npm run test:editor-v7-creation-cutover`
- `npm run test:editor-v7-guided-start:e2e`
- `git diff --check`

Additional compatibility/global regressions passed:

- `npm run test:editor-v6-contract`
- `npm run test:editor-v6-migrate`
- `npm run test:editor-v6-runtime`
- `npm run test:store-v6`
- `npm run test:handdraw`
- `npm run validate-assets`
- `npm run validate-recipes`

The only build notice is the existing Vite chunk-size warning; it is not a build failure.

`npm run test:slots` retains the signed baseline failure: `L3 rotationDeg = 5.81`, while the legacy assertion requires the middle-finger absolute rotation to be `< 5`. This PR does not change Slot V2 data or calibration logic.

## Browser walkthrough

Final Chromium walkthrough passed at 390, 768, 1024, 1280, and 1440 px.

- First intent is writer-zero; confirmation creates exactly one `flat_design` step on the current finger.
- Stage lane, ready Rail tool, selected Layer row, Inspector, and canvas remain synchronized.
- Locked -> skipped -> hidden -> ready recovery is sequential and visible.
- Busy intent state is re-derived in the browser rather than held as a stale snapshot; read-only re-derivation is covered by the contract/store test.
- Compact resource drawer traps focus, closes explicitly, and restores focus to the ready tool.
- Escape dismisses the transient conflict notice and restores its trigger without writing.
- Touch paths run at 390/768; visible compact tool targets are at least 44 px.
- No document horizontal overflow, console errors, or page errors.
- At 390 px the option cards scroll horizontally while 344.5 px of the canvas remains visible in the initial viewport.

Machine-readable report: `walkthrough-report.json`.

## Independent review and visual adjudication

- Internal read-only code/test review: `ACCEPT`, P0 = 0, P1 = 0.
- Claude Code final read-only review was attempted once with the authorized project scope. Packy returned HTTP 400 because the active token group did not cover Anthropic/Opus 4.6. No Claude result was available, and the failed call was not treated as approval.
- Hermes Luna UI review: initial `PASS-WITH-RISKS`.
  - Accepted and fixed: decorative outer card weakened the design-tool workspace; mobile stacked cards pushed the canvas below the fold.
  - Accepted and fixed: Stage microcopy was too small and the English `Blank canvas` label was inconsistent.
  - Rejected: Escape does not directly dismiss the persistent inline guide. The guide is ordinary page content rather than an overlay; keyboard users have a visible 44 px `暂不添加，先预览封层` action. Escape is reserved for transient notices, drawers, and drafts.
- Final five-viewport screenshots were regenerated after these fixes.

## Evidence classification and rollback

- Contract/store tests: `architecture-golden`
- Browser interaction and responsive screenshots: `UI-E2E`
- Surface/decorative/finish rendering: simulated preview only
- Physical material, curing, fit, device protocol, and manufacturing output: unverified

No schema, repository format, or persistence-key migration is introduced. Rollback is one commit and leaves existing EditorDocV7 data intact.
