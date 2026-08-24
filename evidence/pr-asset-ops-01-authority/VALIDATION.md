# ASSET-OPS-01 Validation

Date: 2026-08-21
Branch: `codex/w34-asset-ops-track`
Base: `main @ 3f0fb9bc1f39793d300bd4216c637584e23161c9`

## Scope verified

- Added the strict `GeneratedAssetCandidateV1` contract without changing `EditorDocV7`, `DesignVersionV1`, or the existing immutable asset reference contract.
- A candidate freezes the asset revision and SHA-256 through `ImmutableAssetObjectRefV1`, and records generation method, tool revision, prompt/spec references, rights evidence, editorial QA, product eligibility, structured asset references, preflight evidence, limitations, and rollback reference.
- Generated raster evidence cannot by itself make a product `VERSIONED_READY`. Rights clearance, editorial review, no text/logo/watermark, matching visible nail count when declared, structured assets, and preflight evidence are all required.
- Customer data and brand marks are rejected at parse time. Unknown keys, malformed identifiers, duplicate references, invalid immutable asset references, and incomplete ready claims fail closed.
- The contract keeps `CONCEPT` and `SIMULATED` distinct from physical validation, manufacturing readiness, deployment, and production.

## Automated gates

| Gate | Result |
|---|---|
| `npm run test:asset-ops-contract` | PASS |
| `npm run test:gen-v7-1-backend-ports` | PASS |
| `npm run validate-assets` | PASS — 15 product shapes, 11 formal templates × 7 ready shapes, 7 Concept + 3 Simulated templates |
| `npm run typecheck` | PASS |
| `npm run build` | PASS; existing >500 kB chunk warning only |
| `npm run build:integration` | PASS; existing >500 kB chunk warning only |
| `git diff --check` | PASS |

## Review boundary

The bounded Hermes/Claude rotation on 2026-08-21 produced no valid review because every configured model failed the required usage/model validation. This checkpoint is therefore Codex-verified but remains `pending external review`; it must not be described as Claude-approved.

## Explicit remaining work

- This checkpoint defines authority and promotion gates only. It does not generate or promote any new asset.
- Inventory gap reporting, deterministic generators, image-generation candidates, official shelf integration, Community lineage/merchandising, visual QA, and combined E2E belong to later checkpoints.
- Existing templates that lack an `asset_status` field are metadata review items, not proof that the referenced files are missing.
