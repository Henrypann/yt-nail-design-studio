# GEN-V7.1-04 validation

## Scope and authority

- Base: `main @ e717097c703b0b80ceca24c433d36bc89e5a619a`.
- Branch: `codex/gen-v7-1-04-backend-ports`.
- Delivery sequence: backend contract → guarded local adapters → publish artifact/reference authority → application-service/UI cutover.
- Evidence tier: `LOCAL_PROTOTYPE`. This PR does not claim a deployed backend, real authentication, production authorization, remote durability, manufacturing readiness, 3D output, STL or GLB support.

## Accepted behavior

- UI no longer supplies permissions or clocks. `IdentityAccessPortV1` issues validated contexts; public errors are strict and secret-free.
- Repository reads return `{value, etag}`. Replacements require `expectedEtag` and idempotency; authoritative value plus ledger are committed in one local-storage envelope. Corrupted stores fail closed.
- Asset upload accepts real bytes and verifies length, SHA-256, MIME signature, dimensions and metadata before `READY`. Public callers cannot mark an asset available. Publish preview purposes remain image-only; STL/GLB are excluded.
- `PublishPackageResultV1` retains all 11 nonserialized byte artifacts. A package authority record is written only after all 11 assets are `READY`.
- Package authority freezes the registering actor as `ownerRef`; draft/share/preview/approval paths bind package and artifact ownership to that actor and reject cross-creator access. This is not proof that the actor owns the source DesignRelease.
- DesignRelease now resolves bundled/backend asset references before writing. The private record freezes source revision → numeric canonical reference mappings; later parse, package generation and round-trip validation use that saved mapping and never call a mutable resolver. Unknown `flat-assets-v1` aliases are writer-zero.
- Creator draft/review/publish/hide/share, Governance operations and Client Share approval now use async application services. Exact package/design-version authority is reused; the share path does not regenerate a demo package.
- A PUBLIC creator Look enters Explore only with an authoritative package, but is honestly projected as `INSPIRATION_ONLY` until a real DesignRelease materialization path exists. Use/Remix is disabled and writer-zero.
- Versioned-use target/event persistence is an async, permission-guarded `VersionedUsePersistencePortV1`. Target → event → intent-clear is ordered; retries use the intent timestamp and compare the complete document. Only the same-origin trusted-click intent handoff stays synchronous so `_blank` is not popup-blocked; it is explicitly `LOCAL_PROTOTYPE` and is not a remote backend claim.
- Legacy numeric-only DesignRelease records without `assetReferenceMappings` remain readable and rebuild the same package; nonnumeric aliases still require frozen mappings.

## Automated gates

| Gate | Result |
|---|---|
| `npm run typecheck` | PASS |
| `npm run build:integration` | PASS; existing >500 kB chunk warning only |
| `npm run test:gen-v7-1-backend-ports` | PASS |
| `npm run test:studio-v7-1-design-release` | PASS, including real bundled flat asset, unknown alias writer-zero and stored mapping round-trip |
| `npm run test:studio-v7-1-publish-package` | PASS |
| `npm run test:studio-v7-1-versioned-import` | PASS |
| `npm run test:community-v7-1-use-customize` | PASS, including missing release writer-zero |
| `npm run test:community-v7-1-publish-creator` | PASS |
| `npm run test:community-v7-1-governance` | PASS |
| `npm run test:studio-v7-1-client-approval` | PASS |
| `npm run test:community-v7-1-explore-search` | PASS (`devLooks=17`, `prodLooks=10`) |
| `npm run test:community-v7-1-design-content` | PASS |
| `npm run test:community-v7-1-trust-contracts` | PASS |
| `npm run test:community-v7-1-nail-board` | PASS |
| `npm run test:community-domain` / `test:community-content` | PASS |
| `npm run test:editor-v7-contract` / `test:editor-v6-runtime` | PASS |
| `npm run validate-assets` / `validate-recipes` / `test:handdraw` | PASS |
| `git diff --check` | PASS |

`npm run test:community-v7-1-look-adapter` has a pre-existing fixture assertion drift: the unchanged production adapter/content fixture now yields 10 official Published Looks, while that older test still asserts 9. The current `test:community-v7-1-explore-search` and `test:community-content` both confirm 10. No GEN-V7.1-04 source changed that pure adapter or fixture, so this PR does not silently rewrite the historical assertion.

## Browser walkthrough

`npm run test:community-v7-1-publish-approval:e2e -- http://127.0.0.1:5238` passed at 1440×900 and 390×844:

- real Canvas PNG Publish Package generation and registration of all 11 artifacts with their byte payloads;
- exact-revision PUBLIC review submission and Governance clearance;
- metadata edit invalidates the earlier clearance;
- no horizontal overflow, console errors or page errors.

## Explicit remaining boundary

Nail Boards are not part of this cutover. `CommunityBoardsPage`, `CommunityBoardPage`, `CommunityBoardSharePage` and `NailBoardSaveDialog` still consume `createBrowserBoardRepository()` directly. They are listed in `HANDOFF.md` as a separate follow-up; this delivery does not claim that every Community UI has moved to backend-neutral services.

Application services currently generate their own command contexts. Repository and asset adapters can replay an identical supplied key, and UI action locks prevent duplicate clicks, but a caller cannot yet supply a stable command identity across a lost-response transport retry. This delivery therefore does not claim end-to-end exactly-once semantics.
