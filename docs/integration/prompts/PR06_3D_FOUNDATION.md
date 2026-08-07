# Cursor prompt — PR-06 3D asset and renderer foundation

Implement PR-06 on branch `cursor/pr-06-3d-foundation`, cut from the accepted PR-05 integration head. This prompt replaces the legacy worktree/branch gate in `AGENTS.md` section 8.4; do not edit `AGENTS.md`.

Read the integration plan and delivery standard. Use `3965f41`, `0895587`, and renderer/geometry ideas from `9b748dd` as reference material. Transplant only assets and code that pass the contracts below.

## Objective

Create a vendor-neutral, validated 3D asset pipeline and lazy renderer-adapter boundary that v6 can consume without making manufacturing claims.

## Required implementation

- Define web asset manifests for nail shells and components, including coordinate system, units, dimensions/bounds, version/hash, LOD, and render suitability.
- Keep raw/internal build artifacts out of the production web bundle unless a documented runtime use requires them.
- Move reusable generation/validation logic into project tooling; do not make product correctness depend on a personal Cursor skill directory.
- Provide a generic renderer adapter selected from v6 recipe/asset references. Mercury Dew and Starfish Bloom may be adapters, not hard-coded application branches.
- Lazy-load Three.js and design-specific renderers. Community and non-3D routes must not eagerly fetch them.
- Missing, incompatible, corrupt, or unsupported assets render a clear 2D/fallback state and an honest status.
- Use terms such as simulated preview or render-ready only when supported. Do not label browser output as physical fit, print-ready, or manufactured proof.

## Prohibited scope

- No broad Editor UI rollout, vendor-specific production compiler, physical validation claim, automatic asset generation during app startup, or product-wide package upgrade.
- Do not treat generated cover images as canonical geometry/recipe assets.

## Required tests

Add stable manifest/GLB and renderer-adapter validation scripts. Cover duplicate/missing manifest IDs, hashes/paths, bounds/units, LOD choice, corrupt/missing GLB, unsupported recipe, fallback behavior, lazy chunk loading, and both reference designs.

Run the common gate plus asset/renderer scripts. Record bundle/chunk impact and verify non-3D routes do not load the renderer chunk.

## Acceptance

- Assets and adapters are data-driven and versioned.
- Failure degrades locally; it does not blank Wizard/Editor/Community.
- Browser evidence is clearly classified as simulated.
- No raw or internal-only asset is unintentionally shipped.

Return the standard delivery report with asset provenance and evidence level.
