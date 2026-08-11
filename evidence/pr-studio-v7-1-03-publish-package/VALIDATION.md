# STUDIO-V7.1-03 Publish Package validation

## Scope

- Adds a strict `PublishPackageV1` contract and runtime parser.
- Derives one ten-finger cover, ten ordered nail details, stable palette, registry-resolved shape/length summaries, fidelity/fallback evidence and an immutable source manifest from a released `DesignVersionV1`.
- Rendering, SHA-256, content-addressed immutable asset IDs and registry lookup are injected. Generation never writes or mutates the `DesignVersion` or its private release snapshot; `generatedAt` is pinned to the immutable release timestamp so retries do not drift.
- The package never embeds EditorDocV7, customer/private nail data, manufacturing definitions, device parameters, image bytes or marketing concept art.

## Acceptance boundary

- 3D success can remain `EXACT` only as renderer fidelity evidence; it is not physical or manufacturing validation.
- Missing/failed 3D explicitly falls back per output to `APPROXIMATE` 2D with a reason and renderer identity.
- Geometry shape/length comes only from the injected product registry. Missing registry data stays `unresolved`; IDs are never parsed for product truth.
- Output fixtures use deterministic renderer stubs. Evidence level is `architecture-golden / simulated`, not production rendering or manufacturability.

## Validation

Codex independently reran the following gates on 2026-08-11:

| Command | Result |
|---|---|
| `npm run test:studio-v7-1-publish-package` | PASS |
| `npm run test:studio-v7-1-design-release` | PASS |
| `npm run test:community-v7-1-design-content` | PASS |
| `npm run test:editor-v7-contract` | PASS |
| `npm run test:editor-v7-runtime` | PASS |
| `npm run typecheck` | PASS |
| `npm run build:integration` | PASS; existing large-chunk warning only |
| `git diff --check` | PASS |

Independent final read-only review: `ACCEPT`, P0 = 0, P1 = 0. The review specifically verified content-addressed output/package identity, renderer-revision separation, stable fallback codes, required reasons for approximate fidelity, renderer input isolation and strict release-record validation.

No browser UI is added by this PR; responsive walkthrough is therefore not applicable.
