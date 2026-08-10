# PR-V7-03 Runtime Store Validation

## Scope

- Base: `84bb6e41f20ec93b0bd0dcc3f16b4cd7b0ba2d05`
- Branch: `codex/pr-v7-03-runtime-store`
- Evidence level: `architecture-golden`
- Delivered: strict V7 repository writer, source CAS, serialized map persistence, runtime store, autosave/retry, monotonic history, permission gates, and typed step/element commands.
- Excluded: routes, feature flags, UI, renderers, blank V7 creation, default geometry/finish resolvers, scope/mirror operations, merge, and push.

## Agent record

- Luna was invoked in `write-isolated` mode. It completed repository/store analysis and two small foundation files, then reached its turn limit. Codex reviewed and completed the implementation.
- Claude Code was invoked for read-only diff review but did not enter the model: the installed Hermes Claude binary returned `Permission denied`. Per skill policy, no chmod/chown or retry was attempted.
- Separate read-only reviews found concurrency/autosave issues. Codex fixed them with serialized repository writes, loaded-source CAS, persisted-revision CAS, follow-up autosave scheduling, and an exclusive async document-switch gate. Follow-up review is recorded in the final delivery report.

## Behavioral evidence

`npm run test:editor-v7-runtime` covers:

- V7/missing/invalid/future load and zero-write reads;
- V6 in-memory migration, followed by explicit edit/save replacement only;
- one command = one revision/history/autosave intent;
- atomic rejection, global IDs, nested IDs, incompatible element kinds, and locked entities;
- background/finish invariants and independent `visible`/`skipped` flags;
- read-only document commands versus local selection state;
- monotonic undo/redo and redo-branch clearing;
- failure/retry, in-flight reload rejection, cross-design timer, exclusive async switching, selection repair after deletion, and in-flight edit follow-up autosave;
- serialized whole-map writes and source/revision compare-and-swap guards.

## Automated gates

| Command | Result |
|---|---|
| `npm run typecheck` | PASS |
| `npm run build:integration` | PASS |
| `npm run test:editor-v7-contract` | PASS |
| `npm run test:editor-v7-migrate` | PASS |
| `npm run test:editor-v7-runtime` | PASS |
| `npm run test:editor-v6-contract` | PASS |
| `npm run test:editor-v6-migrate` | PASS |
| `npm run test:editor-v6-runtime` | PASS |
| `npm run test:store-v6` | PASS |
| `npm run test:handdraw` | PASS |
| `npm run validate-assets` | PASS |
| `npm run validate-recipes` | PASS |
| `git diff --check` | PASS |
| `npm run test:slots` | Known baseline failure: L3 `rotationDeg=5.81 > 5`; Slot V2 unchanged |

## Manual walkthrough

N/A. PR-V7-03 has no route or UI. UI, responsive, keyboard, pointer, console, and deep-link acceptance begins in PR-V7-04.
