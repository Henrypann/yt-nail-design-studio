# GEN-V7.1-02 · DesignVersionV1, PublishedLookV1, RemixRelationV1 Contracts — Validation

Date: 2026-08-11
Base: `7aebc51` (merge: GEN-V7.1-01 identity and visibility contracts)
Branch: `codex/pr-gen-v7-1-02-design-look-lineage`
Evidence level: **architecture-golden** — strict domain contracts with golden
fixtures and schema-agreement tests. No backend, storage, or UI integration;
not production-ready.

## Scope

EditorDocV7 is the mutable authoring truth. `DesignVersionV1` is an immutable
released revision reference used by publishing, share, approval and lineage —
it references the EditorDoc by `designId` + SHA-256 (schema stays 7) and never
embeds the document. `PublishedLookV1` references a DesignVersion plus derived
previews and metadata and must never embed EditorDoc, customer/private
NailProfile data, manufacturing definitions, device parameters, or mutable
store state. `RemixRelationV1` records exact source Look/DesignVersion and
target DesignVersion without live linkage. All contracts carry
`schemaVersion: 1`; visibility reuses the GEN-01 contract
(`PRIVATE | UNLISTED | PUBLIC`, default PRIVATE).

This PR adds the contract layer only:

- `src/community/domain/v7_1/design-content-model.ts` — strict TypeScript
  types: `DesignVersionV1`, `EditorDocV7RefV1`, `ImmutableAssetRevisionRefV1`,
  `PublishedLookV1`, `PublishedPreviewAssetRefV1`, `PublishedLookSummaryV1`,
  `RemixRelationV1`; status/kind/mime/fidelity literal unions; GEN-01
  `VisibilityV1` / `PublicTransitionPrerequisitesV1` reused by import.
- `src/community/domain/v7_1/design-content-contract.ts` — runtime contract
  constants (required/allowed keys per contract, `FORBIDDEN_DEVICE_
  MANUFACTURING_KEYS`); re-exports the shared `MAX_ISSUES = 200` from GEN-01.
- `src/community/domain/v7_1/design-content-parse.ts` — strict dependency-free
  parsers and validators; never throw; never mutate input; bounded issues with
  stable `code` + `path`; deep cycle-safe device/manufacturing scan; GEN-01
  privacy scanner and `parsePublicTransitionPrerequisitesV1` reused by import.
- `src/community/domain/v7_1/design-content-v1.schema.json` — machine-readable
  JSON Schema artifact with executable root `oneOf` and
  `additionalProperties: false` everywhere, including `publishedAt` and
  status/visibility conditionals.
- `src/community/domain/v7_1/fixtures/design-content-v1-valid.ts` /
  `design-content-v1-invalid.ts` — deterministic golden fixtures (5 valid +
  lineage chain, 69 invalid) with no shared mutable references.
- `tools/test-community-v7-1-design-content.mjs` + package script
  `test:community-v7-1-design-content`.

No UI, repository, storage, analytics, CommunityContent adapter (COMM-01),
Board, Approval, backend, or dependency changes. Existing `CommunityContentV1`
and all GEN-01 files are untouched.

## Acceptance mapping

1. `DesignVersionV1` holds stable ids (`designVersionId`, `designId`), positive
   `version`/`revision` (reject 0, −1, 1.5, strings), an `editorDocRef` with
   `schemaVersion: 7` + SHA-256 (never an embedded doc: top-level `editorDoc`
   and doc-carrying keys inside the ref like `nails`/`outputIntent`/`steps`
   are rejected), release actor/time, immutable `assetRevisionRefs`, and an
   optional `parentVersionId` that must not reference the version itself.
2. `PublishedLookV1` holds stable `lookId`/`designVersionId`/
   `creatorProfileId` refs, title/metadata/tags, GEN-01 visibility with
   PRIVATE default semantics, derived cover/detail preview asset refs
   (revision/sha256/mime/dimensions/fidelity), multi-shape/multi-length/palette summaries,
   publication gate metadata (the GEN-01 prerequisites contract), status
   `DRAFT | PUBLISHED | HIDDEN | REMOVED`, and an optional `remixRelationId`.
3. Lifecycle rules: `PUBLIC` requires copyright+source+moderation clearance;
   `PUBLISHED` requires `publishedAt` but may remain `PRIVATE` by default;
   `DRAFT` must not carry `publishedAt`; `HIDDEN`/`REMOVED` may retain the
   original publication timestamp. `PUBLIC + DRAFT` is rejected.
4. `RemixRelationV1` records exact `sourceLookId` /
   `sourceDesignVersionId` / `sourceCreatorProfileId` → `targetDesignVersionId`
   with no live linkage; source == target is rejected.
5. Rejections: unknown keys, malformed ids/hash/timestamps/versions, duplicate
   asset refs (version asset revisions, cover↔detail, detail↔detail),
   duplicate tags/palette entries, embedded EditorDoc, self parent, remix
   source==target, dangling/inconsistent internal refs (editorDocRef vs
   designId/revision, designVersionId/remixRelationId colliding with lookId),
   forbidden private keys (GEN-01 deep scan) and device/manufacturing fields
   (bounded deny-list scan). Every issue has a stable code and `$.path`,
   capped at `MAX_ISSUES = 200`.
6. Parsers never throw (null, primitives, arrays, symbols, bigints, cyclic
   objects tested) and never mutate inputs (snapshot + frozen-input tests).
7. JSON Schema has an executable root `oneOf`; its `$defs` agree with runtime
   contract constants on required fields, allowed keys,
   `additionalProperties: false`, enums, `const 7` EditorDoc ref schema,
   `positiveInt` (`integer`, `minimum: 1`), `sha256` pattern and conditional
   `publishedAt`; fixtures parse cleanly under the same runtime rules.
8. Source lineage traceability is demonstrated: root version → child version
   (parent ref) → published look (designVersion ref) → remix relation (exact
   source/target) walks to the root with consistent `designId`/`revision` and
   a cover preview derived from the referenced version's immutable assets.
   Golden fixtures share no mutable object references (WeakSet walk).
9. Only `package.json` script added outside the new module.

## Automated gates

- `npm run typecheck` — PASS
- `npm run test:community-v7-1-design-content` — PASS
  (valid=7, invalid=71, schemaDefs=17, maxIssues=200)
- `npm run test:community-v7-1-identity` — PASS (GEN-01 unaffected:
  valid=8, invalid=46, schemaDefs=15, maxIssues=200)
- `npm run test:community-domain` — PASS (existing V1 contracts unaffected)
- `git diff --check` — PASS

## Known limits

- Contracts are domain-layer only (architecture-golden): no storage,
  repository, API, or UI wiring; no legacy `CommunityContentV1` adapter yet
  (COMM-01); no Board/Approval/RealResult/analytics.
- The JSON Schema artifact is validated for agreement with runtime constants
  by the test tool; no third-party schema validator (e.g. ajv) is wired in.
- `parentVersionId`, `designVersionId`, `creatorProfileId`, `remixRelationId`
  and `sourceLookId` are id references; existence/dangling checks across
  documents require a repository and are out of scope here. Within-document
  consistency (self refs, ref↔field mismatches) is enforced.
- `scanForbiddenDeviceManufacturingKeys` reports a forbidden key once at its
  outermost occurrence (it does not re-walk a condemned subtree), mirroring
  the GEN-01 privacy scan.
- Device/manufacturing detection targets explicit device/manufacturing terms;
  deeper semantic leak detection (e.g. embedded manufacturing JSON under
  generic keys) is a repository-layer concern.
- EditorDoc payload hashing (SHA-256 of the released document) is defined by
  the contract but the hashing pipeline itself is out of scope.

## Worktree

Working tree contains only the intended changes: `package.json` (one script)
plus new files under `src/community/domain/v7_1/`, `tools/`, and this evidence
directory. Nothing committed, pushed, or merged.
