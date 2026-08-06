# Editor document compatibility fixtures

These fixtures are anonymous executable JavaScript objects. They contain no
real customer names, identifiers, images, or design payloads.

## Evidence and compatibility matrix

| Fixture | Observed source | Shape that must remain readable |
| --- | --- | --- |
| v1 | `f63de35` mainline `model.ts` | shared base/pattern/attachments, `finish`, per-finger lock copies |
| v2 | `efc9d06` mainline `model.ts` | v1 plus `lengthPreset`, `appearance`, intent and layer metadata |
| v3 | `75ff716` and current mainline | v2 plus canonical recipe instance and custom relief |
| v4 | `369d516`, `11f5348` Cursor `model-v4.ts` | ten independent nail layer stacks, geometry overrides, recipe references and communication references |
| v5 | `171d9e2`, `9b748dd` Cursor `model-v4.ts` | v4 storage shape with literal version 5 and optional layer `stepId` |
| v6 | PR-03 target contract fixture | single writable format with literal version 6 |

The historical v5 type was still named `EditorDocV4`; that mismatch is
deliberately represented by the fixture but must not be repeated by a public
v6 product type.

## Canonical v6 fields

- `defaultGeometry`, with optional per-nail `geometryOverride`, is the geometry
  source of truth.
- Top-level `appearance` is the finish source of truth. Base layers only carry
  per-finger color, not a second writable appearance.
- `recipeInstances` is the recipe source of truth. Layers only reference an
  instance ID; derived recipe payloads are not duplicated in layers.
- `nails[*].layers` is the ordered layer source of truth. Every layer and
  element has a stable ID plus explicit `visible`, `locked`, and `order`.

## Required deterministic migration defaults

- absent title: `未命名设计`
- absent customer, intent, geometry override, or communication references:
  omitted/empty without fabricating identity
- v1 finish: `matte` maps to opaque/none/matte, `pearl` maps to
  opaque/pearl/gloss, all other accepted legacy finishes map to
  opaque/none/gloss
- absent length preset: short → natural, medium → short-extension,
  long → medium, extra-long → long
- absent master finger: `R4`
- absent visibility/lock/order: `true` / `false` / stable source index
- v1-v3 shared data expands deterministically to all ten named fingers;
  `fingerLocks` entries override the corresponding expanded finger
- absent communication references: empty array
- absent revision: `1`; absent `createdAt`: legacy `updatedAt`

Stable migration IDs must derive from immutable source identity, finger,
semantic role, source ID/index, and collision disambiguation. They must not use
`Date.now()` alone. Re-migrating identical input must produce byte-equivalent
IDs and ordering.

## Intentional legacy loss

Cursor v5 `stepId` is analytics/guide metadata and is not required as a
canonical v6 editing field. Persisted `layerTypes` registries are projections
of built-in definitions and may be discarded. Invalid legacy elements may not
be silently retained; the migration result must be `invalid` rather than
dropping user data.
