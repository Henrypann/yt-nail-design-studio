# COMM-V7.1-04 · Use / Customize — Validation

Date: 2026-08-11

Branch: `codex/pr-comm-v7-1-04-use-customize`

Base: `df5d613` (`integration/community-v7-1` after STUDIO-V7.1-02)

Evidence tier: `architecture-golden` local integration. The canonical Petal
Veil fixture is a real strict `PublishedLookV1 → DesignVersionV1 → released
EditorDocV7` contract chain and uses deterministic vector content. It is not a
real creator publication, physical sample, manufacturing proof, device job or
backend/auth claim; it is excluded from production repository loading.

## Delivered behavior

- Canonical Look detail exposes a visually primary, versioned
  “Use in Studio” CTA; legacy partial content remains explicitly legacy and is
  never upgraded into a fake DesignVersion.
- CTA freezes exact `lookId`, `designVersionId`, source-asset revision set,
  lineage, Community return path and 30-minute expiry. CTA click alone records
  no conversion event.
- Wizard presents one explicit choice dialog. `current` preserves the existing
  Wizard/editor state, `cancel` returns to the exact Look, and `new` creates a
  separate editable EditorDocV7 plus a draft DesignSummary. None overwrites the
  current design and no path creates a new V6 document.
- Consumption rechecks canonical PUBLIC/PUBLISHED authority, release checksum,
  exact asset set and availability before writing. Final invalid states clear
  the exact intent; transient failures retain it.
- Remix nodes and recipe instances receive independent IDs. The imported doc
  has one Community source ref, no customer/communication/composition state,
  and does not live-link to the source.
- The successful `look_customize` event is emitted only after target creation,
  is idempotent by intent id, and is stored as local integration evidence.
  Durable analytics delivery remains COMM-V7.1-08 scope.
- Editor shows Remix/source-version disclosure and a safe return-to-source
  action. Mobile header, StageBar horizontal scrolling and inherited SPA scroll
  were corrected so the immersive workspace remains fully visible.

## Automated and browser acceptance

| Gate | Result |
|---|---|
| `npm run test:community-v7-1-use-customize` | PASS |
| `npm run test:studio-v7-1-versioned-import` | PASS |
| `npm run typecheck` | PASS |
| Five-viewport Chrome E2E (`390/768/1024/1280/1440`) | PASS |
| `current / new / cancel` browser paths | PASS |
| CTA-no-event / success-one-event | PASS |
| editable schema-7 target / exact lineage / independent IDs | PASS |
| no document or shell horizontal overflow; Shell `scrollLeft=0` | PASS |
| browser `console.error` / `pageerror` | 0 |
| `npm run build:integration` | PASS |
| Community V7.1 design/look/search/board/domain regressions | PASS |
| Editor V7 contract/runtime/workspace/IA/flat-vector/assets | PASS |
| `npm run test:handdraw` | PASS |
| `npm run validate-assets` / `validate-recipes` | PASS |
| `git diff --check` | PASS |
| `npm run test:slots` | Known base failure: middle L3 `rotationDeg=5.81`, unchanged by this PR |

Full regression/build results and Claude final-review disposition are appended
before commit. Machine report: `walkthrough-report.json`. Signed visual evidence:
`screenshots/{390,768,1024,1280,1440}-{look,choice,editor}.png`.

## External worker note

Hermes DSF was invoked first as requested for the prerequisite versioned-import
work, but its bounded sessions repeatedly exhausted turns in read-only
discovery and produced no files. Codex remained the only writer for this PR.

Claude Code performed the required final read-only cross-review with the
project-policy authorization basis. Verdict: `PASS`, P0=0, P1=0. Its P2 query
effect observation was adopted by deduplicating the handled versioned intent
and giving it explicit precedence over the legacy query path. The remaining
P2 suggestions were deliberately not adopted: corrupted intent tables stay
fail-closed; current `DesignSummary.customerId` is a required string; durable
analytics remains COMM-V7.1-08.
