# GEN-V7.1-01 · Identity, Visibility, Privacy & Permission Contracts — Validation

Date: 2026-08-11
Base: `e50704b` (merge: Wizard V7 creation flow and Mercury assets)
Branch: `codex/pr-gen-v7-1-01-identity-visibility`
Evidence level: **architecture-golden** — strict domain contracts with golden
fixtures and schema-agreement tests. No backend, storage, or UI integration;
not production-ready.

## Scope

Community is the Inspiration & Distribution Layer. One identity may hold
Consumer, Creator, Salon Membership, and Operator roles. Nail Profile is
private by default. Public content must never leak customer primary keys, raw
nail geometry, allergy/service notes, email, phone, or credentials. V7.1 is the
architecture baseline; every new contract carries its own `schemaVersion: 1`.

This PR adds the contract layer only:

- `src/community/domain/v7_1/model.ts` — strict TypeScript types: `IdentityV1`
  (multi-role), `ConsumerProfileV1`, `CreatorProfileV1`, `SalonMembershipV1`,
  `NailProfileV1`, `IdentityBundleV1`, `PublicCreatorProfileProjectionV1`,
  `PublicTransitionPrerequisitesV1`; visibility/role/verification literal unions.
- `src/community/domain/v7_1/contract.ts` — runtime contract constants
  (required/allowed keys per contract, `FORBIDDEN_PRIVATE_KEYS`, `MAX_ISSUES`).
- `src/community/domain/v7_1/parse.ts` — strict dependency-free parsers and
  validators; never throw; never mutate input; bounded issues with stable
  `code` + `path`.
- `src/community/domain/v7_1/privacy.ts` — deep cycle-safe private-key scan and
  `projectPublicCreatorProfile` (the only sanctioned public projection).
- `src/community/domain/v7_1/visibility.ts` — `PRIVATE | UNLISTED | PUBLIC`
  transitions, publish permission + prerequisites, share-link access.
- `src/community/domain/v7_1/identity-v1.schema.json` — machine-readable
  JSON Schema artifact (`additionalProperties: false` everywhere).
- `src/community/domain/v7_1/fixtures/identity-v1-valid.ts` /
  `identity-v1-invalid.ts` — deterministic golden fixtures (8 valid, 46 invalid).
- `tools/test-community-v7-1-identity.mjs` + package script
  `test:community-v7-1-identity`.

No UI, repository, storage, analytics, DesignVersion, PublishedLook, Board,
Approval, RealResult, backend, or dependency changes. Existing
`CommunityContentV1` and all current community routes/tests are untouched.

## Acceptance mapping

1. Multi-role identity: `IdentityV1.roles` is a unique, non-empty set of
   `CONSUMER | CREATOR | SALON_MEMBER | OPERATOR`; the full fixture holds all
   four. Consumer/Creator/SalonMembership/Nail profiles are separately typed
   and each `schemaVersion: 1`; one identity can carry multiple independent
   salon memberships.
2. Visibility is exactly `PRIVATE | UNLISTED | PUBLIC`; `defaultVisibility()`
   always returns `PRIVATE`; transition to `PUBLIC` requires the OWNER actor
   plus `copyrightDeclared && sourceDeclared && moderationCleared`.
3. `shareLinkAccess('UNLISTED')` grants a read-only view; the profile's
   visibility is never mutated and never promoted to PUBLIC.
4. Validators reject unknown keys, malformed ids/timestamps/roles, duplicate
   roles, cross-identity profile mismatch, non-private NailProfile, leaked
   forbidden private keys (deep scan), and extra fields on the public
   projection; every issue has a stable code and `$.path`, capped at
   `MAX_ISSUES = 200`.
5. Parsers never throw (null, primitives, arrays, symbols, bigints, cyclic
   objects tested) and never mutate inputs (snapshot + frozen-input tests).
6. JSON Schema has an executable root `oneOf`; its `$defs` agree with runtime
   contract constants on required fields, allowed keys,
   `additionalProperties: false`, conditional `publicSince`, and enum values;
   fixtures parse cleanly under the same runtime rules.
7. Only `package.json` script added outside the new module.

## Automated gates

- `npm run typecheck` — PASS
- `npm run test:community-v7-1-identity` — PASS
  (valid=8, invalid=46, schemaDefs=15, maxIssues=200)
- `npm run test:community-domain` — PASS (existing V1 contracts unaffected)
- `git diff --check` — PASS

## Known limits

- Contracts are domain-layer only (architecture-golden): no storage, repository,
  API, or UI wiring; identity resolution, token/session handling, and
  moderation workflow are out of scope.
- The JSON Schema artifact is validated for agreement with runtime constants by
  the test tool; no third-party schema validator (e.g. ajv) is wired in.
- Share-link semantics are domain-level (grant/deny, read-only); URL format,
  expiry, and revocation are not modeled.
- `scanForbiddenPrivateKeys` reports a forbidden key once at its outermost
  occurrence (it does not re-walk a condemned subtree).
- Privacy detection targets raw/private fields rather than generic design
  words: safe `geometryRef`, `mesh`, `scanStatus`, and `token` keys remain
  available to later PublishedLook/asset contracts.
- The public projection currently covers the creator profile; consumer, salon,
  and nail profiles are private by design and never projected.

## Worktree

Working tree contains only the intended changes: `package.json` (script) plus
new files under `src/community/domain/v7_1/`, `tools/`, and this evidence
directory. Nothing committed, pushed, or merged.
