# STUDIO-V7.1-02 · Versioned Import & Remix — Validation

Date: 2026-08-11
Branch: `codex/pr-studio-v7-1-02-versioned-import`

Evidence level: production-ready local port/materialization core. UI wiring is
deliberately deferred to COMM-V7.1-04; no backend/auth/analytics persistence or
manufacturing claim.

- V2 intent carries exact Look, DesignVersion and immutable asset revisions;
  legacy content cannot enter this path.
- Consumption rechecks TTL, PUBLIC/PUBLISHED state, permission, exact released
  snapshot and every asset before IDs or target writer.
- `current` keeps the current design unchanged; `cancel` returns; `new` creates
  one independent EditorDocV7. No mode overwrites an existing design.
- New documents have fresh design/node/recipe IDs, no customer/communication or
  composition state, and one explicit Community source lineage ref. No V6 path.
- `look_customize` is returned only after the target writer succeeds; later
  analytics persistence belongs to COMM-08.

## Automated validation

| Gate | Result |
|---|---|
| `npm run test:studio-v7-1-versioned-import` | PASS |
| `npm run typecheck` | PASS |
| `npm run build:integration` | PASS |
| `npm run test:studio-v7-1-design-release` | PASS |
| `npm run test:community-v7-1-design-content` | PASS |
| `npm run test:editor-v7-contract` | PASS |
| `npm run test:editor-v7-runtime` | PASS |
| `npm run test:community-intent` | PASS |
| `npm run test:community-studio-flow` | PASS |
| `git diff --check` | PASS |

The behavior suite also proves dependency exceptions are contained and that a
target created before intent-cleanup failure is recovered idempotently on retry.
This PR has no UI and claims no browser acceptance.

DSF worker was invoked first as requested (sessions
`20260811_141436_910b09` and earlier prerequisite attempts) but exhausted its
bounded turns in repeated read-only discovery without writing files. Codex was
the sole writer and independently reviewed every changed path.
