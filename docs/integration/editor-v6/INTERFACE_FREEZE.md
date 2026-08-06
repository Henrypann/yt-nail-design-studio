# EditorDocV6 interface freeze

Status: frozen for PR-03 implementation  
Base: `c4f13e7` + accepted compatibility matrix  
Evidence: `LEGACY_COMPATIBILITY_MATRIX.md`, Cursor model/migration commits `369d516` / `11f5348` / `9b748dd`, PR-03B fixtures

This document resolves matrix §9 unknowns. Implementation must match these decisions.

## 1. Identity

| Field | Rule |
|---|---|
| Public type | `EditorDocV6` only |
| Literal | `schemaVersion: 6` only |
| Naming | No new public `V4`/`V5` API; observed Cursor `EditorDocV4`+literal 5 is a read adapter input only |
| `ProjectV4` | Canvas projection; never an EditorDoc adapter input |

## 2. Canonical vs projection

| Concern | Canonical writable | Projection / non-writable |
|---|---|---|
| Geometry | `defaultGeometry` + optional `nails[f].geometryOverride` | Resolved finger geometry, design summary shape/length, `ProjectV4` |
| Appearance | Document `appearance` only | Base-layer `surface.appearance`, legacy `finish` |
| Base color | Base-layer `surface.baseColor` per finger | Document-level summary color |
| Recipe | `recipeInstances` | Layer `recipeInstanceId` references; derived render layers |
| Layers | `nails[f].layers` array order | Thumbnails, export envelopes, canvas layers |
| Layer types | Stable `typeId` resolved from code registry | Embedded `layerTypes` maps (discarded on migrate) |
| Presentation | `presentationMeta.masterFinger`, `communicationRefs`, optional layer `stepId` | Must not change manufacturing truth |
| Output | `outputIntent` | Manufacturing/customer export filters may read it |

## 3. Document shape (required)

- Ten named fingers: `L1`–`L5`, `R1`–`R5`
- Each finger: ordered `layers[]` with stable `id`, `name`, `typeId`, `visible`, `locked`, contiguous `order`
- Elements: flat records with `id`, `domain`, `kind`, `visible`, `locked`, contiguous `order`, plus domain payload
- Optional: `customerId`, `intent`, geometry overrides, `surface`, `recipeInstanceId`, `stepId`
- Required meta: `designId`, `title`, `defaultGeometry`, `lengthPreset`, `appearance`, `presentationMeta`, `nails`, `recipeInstances`, `communicationRefs`, `outputIntent`, `revision`, `createdAt`, `updatedAt`

## 4. Resolved freeze unknowns (matrix §9)

1. **`outputIntent`**: `'design' | 'customer' | 'manufacturing'`. Migrated legacy docs default to `'design'`.
2. **Revision/lineage**: required `revision: number` (migrate → `1`). Optional future lineage fields are out of PR-03; do not invent `parentDesignId` yet.
3. **Layer-type registry**: code-resolved via `typeId` only. Discard embedded `layerTypes` on migrate.
4. **Appearance conflict**: document `appearance` wins. Base-layer `surface.appearance` is ignored for canonical value; migration diagnostics may note disagreement.
5. **Order**: array position is canonical. Persist contiguous `0..n-1` `order` matching array index. Ignore stale stored numeric order when arrays disagree.
6. **IDs**:
- Preserve valid source element IDs by namespacing per finger as `${sourceId}__${finger}` when materializing shared v1–v3 stacks (required for global uniqueness).
- Migration-generated layer IDs are deterministic from `(designId, finger, role)`.
- v3 relief cloned per finger uses `${sourceId}__${finger}`.
- Duplicate IDs after migrate → `invalid`.
- New edit IDs use collision-resistant generator (not `Date.now()` alone).
7. **`communicationRefs.dataUrl`**: preserve embedded value as observed.
8. **`locked`**: persisted editable document state (boolean), not policy-derived-only.
9. **Unknown element kinds / invalid enums**: document `invalid` (no silent drop of recognized user content that fails domain rules). Soft-normalize only the documented legacy finish/lengthPreset defaults.
10. **`createdAt`**: migrated docs set `createdAt = source.updatedAt` (never migration wall-clock). New docs set both timestamps at create time.

## 5. Migration / repository contract

| Result | Meaning |
|---|---|
| `ok` | Valid `EditorDocV6`; `migrated` true iff source literal ≠ 6 |
| `missing` | No raw document |
| `invalid` | Malformed JSON/object/fields/duplicate IDs/unknown element kinds |
| `unsupported` | Integer schemaVersion > 6 |

Rules:

- Pure read/migrate: no storage write.
- Save/edit/create write only explicit schema-6 documents.
- Adapters selected by raw literal: 1, 2, 3, 4, 5, 6.
- Legacy v3 runtime path may remain until PR-04 UI rollout; it must not invent a mislabeled V4/V5 writable API.
- Defaults: title `未命名设计`; masterFinger `R4`; missing communicationRefs `[]`; missing visibility/lock `true`/`false`; lengthPreset from geometry map; v1 finish via `appearanceFromLegacyFinish`.

## 6. Intentional legacy loss

- Shared-vs-copied authorship becomes ten independent stacks.
- Embedded `layerTypes` discarded.
- Base-layer appearance discarded when it conflicts with document appearance.
- `stepId` preserved when valid, optional only.
- Creation/revision lineage beyond `revision=1` / `createdAt←updatedAt` cannot be reconstructed.
- `ProjectV4` remains lossy and is not a migration source.
