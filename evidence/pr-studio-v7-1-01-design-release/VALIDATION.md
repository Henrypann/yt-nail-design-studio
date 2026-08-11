# STUDIO-V7.1-01 · Design Release — Validation

Date: 2026-08-11
Branch: `codex/pr-studio-v7-1-01-design-release`

Evidence level: production-ready local contract/repository core with injected
storage, source reader, identity, clock, ID and SHA-256. No backend durability,
auth, publishing UI, preview generation, approval or manufacturing claim.

## Contract boundary

- `DesignVersionV1` is public-safe immutable metadata: design/revision/checksum,
  identity/time, immutable hash-bearing asset refs and parent version only. It
  never embeds EditorDoc, nails, customer refs, runtime state, manufacturing or
  device data.
- The exact released EditorDocV7 snapshot is persisted separately inside a
  private Studio release record so STUDIO-02 can materialize it later. The
  snapshot is checksum-bound to the public `editorDocRef`.
- Release reads the persisted source itself and requires a `saved` runtime
  guard with no pending revision. It never accepts an arbitrary caller-provided
  EditorDoc payload.
- A legal blank V7 release has zero `assetRevisionRefs`; no fake preview or
  EditorDoc asset is invented. Geometry/material/recipe/source/composition refs
  present in the document are frozen in the private manifest. Renderer evidence
  is explicitly unavailable because EditorDocV7 has no renderer ref contract.
- Same design+revision+checksum is idempotent (zero ID/write); later revision is
  version+1 with parent; V1-V6 are explicitly read-only unsupported; future and
  invalid sources are rejected.

## Gates

- `npm run typecheck` — PASS
- `npm run build:integration` — PASS (existing chunk-size warning only)
- `npm run test:studio-v7-1-design-release` — PASS
- `npm run test:community-v7-1-design-content` — PASS
- `npm run test:editor-v7-contract` — PASS
- `npm run test:editor-v7-runtime` — PASS
- `npm run test:store-v6` — PASS
- `git diff --check` — PASS

Two DSF worker attempts completed read-only audits but exhausted their turn
budgets before writing; the primary reviewer implemented and independently
verified the scoped change. This PR has no UI, so no browser/visual acceptance
is claimed.
