# COMM-v0.7.2-TAX-02 Validation

Date: 2026-08-17
Branch: `codex/community-v0-7-2-tax-02-content-migration`
Base: `main @ 2925622ce641ed2bb8979ab84d116af770af738d` (`COMM-v0.7.2-TAX-01`)

## Scope verified

- Added a checked-in, strict migration manifest covering all 24 controlled source records: 18 legacy content-index entries, one canonical demo, four v0.7.2 Look sets, and one Creator V1 fixture.
- Projected the exact checked-in `discovery` / `curation` envelope into legacy, canonical, four-look, and Creator read models; no discovery fact is inferred from free tags, publisher, application level, verification level, or `sourceContent`.
- Migrated legacy `ST-02` only to `technique:french`; the four unconfirmed records retain empty `styleIds` and `NEEDS_STYLE_REVIEW`, and remain outside style channels.
- Applied fail-closed public governance: nine PENDING-rights records are public-blocked; all 24 records remain `CONCEPT_ONLY`; new/updated Creator PUBLIC content requires structured style, shape, rights, makeability, and the exact reviewed content revision.
- Added Creator publication Store V2 with pure V1 upcast. Reads do not overwrite localStorage; corrupt V1/V2 data is rejected; discovery changes bump `contentRevision`; publishing snapshots the exact discovery envelope.
- Revalidated stored Creator discovery and curation at public-read time. PENDING, missing-style/shape, and legacy-exception creator envelopes emit typed diagnostics and never surface.
- Added cross-source `lookId` collision protection. Aggregation keeps canonical → four-look → creator → legacy priority and emits `IDENTITY_COLLISION` for every dropped duplicate.
- Creator structured taxonomy controls use the strict taxonomy fixture and expose 44×44 CSS-pixel minimum pointer/touch targets.

## Migration report

The report generator was run twice with identical bytes.

| Artifact | SHA-256 |
|---|---|
| `migration-report.json` | `befa35bde69e8d3b6cfb6f7d69a34b2fd14c304c38b3e19d2d549270035b34c4` |
| `MIGRATION_REPORT.md` | `61c3d27d7410f9549f5a20c3739d0195fcbe71bcef25dcd35778906c085542ae` |

Summary: 24 entries; 11 MIGRATED / 4 MANUAL_REVIEW / 9 PUBLIC_BLOCKED; 15 ORIGINAL / 9 PENDING; 24 CONCEPT_ONLY; zero coverage-blocked entries.

## Codex independent verification

| Command | Result |
|---|---|
| `npm run test:community-taxonomy-v2` | PASS — 48 assertions |
| `npm run test:community-discovery-migration` | PASS — 18 assertions, all source IDs and deterministic projections covered |
| `npm run test:community-v7-1-look-adapter` | PASS — viewable 17, malformed 17, production 10, integration/development 17 |
| `npm run test:community-v7-1-publish-creator` | PASS — V1 workflow and Store V2 upcast/revision/envelope/read-gate cases |
| `npm run test:gen-v7-1-04-backend-ports` | PASS — includes Creator V2 no-overwrite behavior and cross-source identity collision |
| `npm run test:community-v7-1-explore-search` | PASS — integration/development 17, production 10 |
| `npm run generate:community-tax-02-migration-report` twice | PASS — both artifact hashes byte-stable |
| `npm run test:community-v7-1-publish-approval:e2e -- http://127.0.0.1:5242` | PASS — 1440×900 and 390×844; exact-revision clearance, revision invalidation, no page overflow, no console/page errors |
| `npm run typecheck` | BASELINE BLOCKED — exactly the five existing geometry diagnostics listed below; no TAX-02 diagnostic |
| `npm run build` | BASELINE BLOCKED by the same five geometry diagnostics |
| `npm run build:integration` | BASELINE BLOCKED by the same five geometry diagnostics |
| `git diff --check` | PASS |

E2E target measurements at both viewports:

- `style:minimal-clean`: 70×44
- `shape:almond`: 58×44
- `rights:original`: 46×44

The E2E Vite server used `/tmp` aliases for the two unavailable geometry-only packages so the Community route could start without changing repository files. The aliases throw if invoked; the Community flow did not invoke them. This is runtime UI evidence, not evidence that geometry dependencies or builds are healthy.

## Baseline build blockers

The same diagnostics reproduce on local `main @ 2925622`; the main checkout additionally reports `.tmp/*.tsbuildinfo` EPERM because it is read-only to the current sandbox.

1. `src/studio/geometry/v0-7-2/parity/current-kernel.ts`: missing `three-bvh-csg` declaration.
2. `src/studio/geometry/v0-7-2/parity/manifold-kernel.ts`: missing `manifold-3d` declaration.
3. `src/studio/geometry/v0-7-2/parity/manifold-kernel.ts`: related implicit-any callback.
4. `src/studio/geometry/v0-7-2/surface-boolean.ts`: missing `manifold-3d` declaration.
5. `src/studio/geometry/v0-7-2/surface-boolean.ts`: related implicit-any callback.

## Evidence boundaries

- `CONCEPT_ONLY` is not a manufacturing capability or physical validation claim.
- Migration assignments are controlled checked-in product data. Records marked PENDING or NEEDS_STYLE_REVIEW remain visibly unresolved and are not guessed at runtime.
- This PR does not implement URL/query semantics, the five-entry Community homepage, a recommendation model, a remote Creator backend, Community-to-Editor writes, or Studio French tooling.
- No remote push was performed.
