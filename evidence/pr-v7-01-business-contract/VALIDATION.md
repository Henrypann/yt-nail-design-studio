# PR-V7-01 Validation

## Scope

- EditorDocV7 business types and five process-step discriminated unions.
- Stable process-step registry.
- Strict dependency-free runtime validation and machine-readable JSON Schema.
- Valid/invalid fixtures and contract test.
- Read-only public parse/validate API; no writer, migration, repository, store, UI, renderer, or feature flag.

## Contract decisions

- `steps[]` and `elements[]` array order are canonical; V7 exposes no `order` field.
- Every nail has one first background and one last visible, non-skipped surface finish.
- Background may be temporarily hidden; the finish does not lock editing.
- Geometry and content assets use stable versioned references only; embedded data URLs are rejected.
- Evidence tier: `architecture-golden`. This is not rendering or manufacturing proof.

## Independent review

- Initial Claude Opus 5 analysis was advisory because it could not read the external PRD.
- Product-conflicting suggestions (`order`, `customerId`, enum geometry, embedded data URI, public blank writer) were rejected.
- Final actual-diff review used the locally routed `claude-opus-4-7` model with read-only `Read/Glob/Grep` tools.
- Result: no P0/P1. Accepted P2 hardening: registry content-kind semantics, complete registry assertions, an explicit JSON Schema suffix limitation comment, and a positive hidden-background assertion.
- Codex additionally tightened timestamp validation so impossible calendar dates cannot pass through JavaScript date normalization.

## Validation results

| Check | Result |
|---|---|
| `npm run typecheck` | PASS |
| `npm run build:integration` | PASS |
| `npm run test:editor-v7-contract` | PASS — 2 valid and 34 invalid fixtures |
| `npm run test:editor-v6-contract` | PASS |
| `npm run test:editor-v6-migrate` | PASS |
| `npm run test:editor-v6-runtime` | PASS |
| `npm run test:store-v6` | PASS |
| `npm run test:handdraw` | PASS |
| `npm run validate-assets` | PASS |
| `npm run validate-recipes` | PASS |
| `git diff --check` | PASS |
| `npm run test:slots` | FAIL — unchanged main baseline: L3 `rotationDeg=5.81`, threshold `<5` |

The Slot failure reproduces from `main @ 8727d83`; this PR does not modify Slot V2 code or data and treats it as non-blocking baseline evidence.
