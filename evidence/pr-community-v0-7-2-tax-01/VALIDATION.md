# COMM-v0.7.2-TAX-01 Validation

Date: 2026-08-17
Branch: `codex/community-v0-7-2-tax-01-contract`
Base: `main @ 356cf939fbc8cfffe388dc9ac53c80f8ed904f25`

## Scope verified

- Added the versioned Community taxonomy, discovery metadata, curation metadata, strict parsers, deterministic alias resolver, and governance predicates.
- Added all 89 PRD vocabulary entries across eight dimensions, five primary browse entries, and nine recommendation channel definitions.
- Preserved the schemaVersion 1 taxonomy, current Community UI/query behavior, `PublishedLookV1`, `DesignVersionV1`, and `EditorDoc schemaVersion: 7`.
- `ST-02` and the declared French aliases resolve only to `technique:french`; no overall style is inferred.
- Current-makeable remains fail-closed and is not evidence of physical manufacturability.

## Codex independent verification

| Command | Result |
|---|---|
| `npm run test:community-taxonomy-v2` | PASS — 48 assertions |
| `npm run typecheck` | BASELINE BLOCKED — missing `three-bvh-csg` / `manifold-3d` declarations and two related implicit-any errors under `src/studio/geometry/v0-7-2`; the same failures reproduce on untouched `main @ 356cf939` |
| `npm run build` | BASELINE BLOCKED by the same five geometry/type-declaration errors |
| `npm run build:integration` | BASELINE BLOCKED by the same five geometry/type-declaration errors |

The Community taxonomy files introduce no additional typecheck diagnostics. The baseline comparison in the main checkout also reports `.tmp/*.tsbuildinfo` EPERM because that checkout is read-only to the current sandbox; this is separate from the five shared geometry diagnostics.

## Evidence boundaries

- Evidence tier: contract, fixture, parser/resolver/governance unit tests.
- English labels are product translations pending future content-language review; Chinese labels follow the approved PRD vocabulary.
- Capability, asset, and evidence references are format-validated here. Registry resolution belongs to the later query/runtime integration.
- No recommendation model, creator backend, manufacturing validation, physical sample, production dispatch, or Community-to-Editor write path is claimed.
