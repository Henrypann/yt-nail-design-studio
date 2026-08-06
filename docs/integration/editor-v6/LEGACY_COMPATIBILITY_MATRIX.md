# EditorDoc v1–v6 legacy compatibility matrix

Status: PR-03A evidence and interface-freeze input  
Scope: document/model/migration/repository contracts only  
Base inspected: `c4f13e7361cefedade4b98004acb1bdf69396402`

This document separates observed repository facts from proposed v6 semantics. “Target v6” rows are interface-freeze recommendations, not claims that v6 already exists.

## 1. Names that must not be conflated

| Name | Observed meaning | Version boundary |
|---|---|---|
| `EditorDoc` | Main/integration editor document in `model.ts`; shared base data plus sparse per-finger copies | Currently literal `schemaVersion: 3`; current migrator reads v1–v3 |
| `ProjectV4` | Canvas/work-key envelope payload in `src/lib/types.ts`; a lossy projection produced by `docToProjectV4` | Literal `schemaVersion: 4`; **not** an EditorDoc generation |
| observed Cursor `EditorDocV4` | Per-finger ordered layer-stack model introduced by `369d516` | Literal 4 at introduction |
| observed Cursor `EditorDocV4` after `9b748dd` | The same public type/file/API name after adding `stepId` | Literal **5**, creating the name/version discontinuity |
| target `EditorDocV6` | Proposed single writable editor document contract | Type name and literal must both be 6 |

Consequences:

- A stored `schemaVersion: 4` EditorDoc must be parsed by the observed-v4 adapter, not as `ProjectV4`.
- `ProjectV4` remains an output/canvas projection and must never be accepted as an EditorDoc solely because its version is 4.
- No target API or file should retain `V4` in its name while reading or writing schema 5 or 6.

## 2. Evidence ledger

### Current base evidence

- `model.ts`: `EditorDoc` is schema 3. It stores document geometry, appearance, shared `baseColor`/`pattern`/`attachments`, sparse `fingerLocks`, optional recipe, document-level relief, master finger, and `updatedAt`.
- `migrate.ts`: pure v1/v2/v3 normalization. It preserves recognized element payload through object spread, assigns normalized metadata/order, defaults missing v2/v3 additions, and does not write storage.
- `repo.ts`: raw documents are held in a map keyed by design ID. `getEditorDocResult` delegates to the pure migrator. `inspectEditorDoc` is version-neutral and body-free. `docToProjectV4` is explicitly a projection.
- `editor-doc-schema-version.ts`: versions 1–3 are supported; integers above 3 are unsupported; malformed/non-integer versions are unknown/invalid at the migration boundary.

### Historical model/migration evidence

- `f63de35`: observed v1 shape.
- `efc9d06`: v2 model and v1→v2 migration.
- `75ff716`: v3 recipe/relief model and v1/v2→v3 migration.
- `369d516`: observed Cursor schema 4 per-finger layer stacks and v3→v4 adapter.
- `11f5348`: optional communication references added without a schema bump.
- `171d9e2`: no model/migration delta in the inspected paths.
- `9b748dd`: `stepId` added and literal bumped 4→5, while the public type remained `EditorDocV4`; raw v4 was upgraded in memory to literal 5.

Only the model/migration portions of the four Cursor commits above are treated as v6 design evidence. Their UI/store/runtime changes are out of scope.

## 3. Field matrix

Legend: `—` absent; “shared+sparse” means one shared base plus entries only for unlocked fingers; “independent” means ten named finger records.

| Concern | v1 | v2 | v3 | observed v4 | observed v5 | target v6 recommendation |
|---|---|---|---|---|---|---|
| Schema identity | `EditorDoc`, literal 1 | `EditorDoc`, literal 2 | `EditorDoc`, literal 3 | `EditorDocV4`, literal 4 | **`EditorDocV4`, literal 5** | `EditorDocV6`, literal 6 |
| Document identity | `designId` | same | same | same | same | Preserve as stable `designId`; map key must agree or fail validation |
| Customer/title | optional `customerId`; no title | same | same | optional `customerId`, required `title` | same | Preserve both; default title only when absent in v1–v3 |
| Default geometry | top-level `shape`, `length` | same | same | `defaultGeometry.shape/length` | same | Canonical `defaultGeometry`; no duplicate writable top-level shape/length |
| Per-finger geometry | — | — | — | optional `nails[f].geometryOverride` | same | Canonical optional override per named finger; resolved geometry is a projection |
| Length product preset | — | `lengthPreset` | same | same | same | Preserve; derive from legacy length only when absent |
| Finish/appearance | legacy `finish` | top-level `appearance` | same | top-level `appearance` **and** base-layer `surface.appearance` | same | One canonical default appearance plus explicit per-finger override, if supported; rendered/base-layer appearance is projection |
| Design intent | — | optional `intent` | same | same | same | Preserve as optional recommendation context; not a render/manufacturing truth source |
| Base color | top-level + sparse finger copy | same | same | base-layer `surface.baseColor` per finger | same | Canonical per-finger base-surface value; document summary color is projection |
| Finger model | shared+sparse `fingerLocks` | same | same | ten independent named `nails` | same | Ten required named fingers (`L1`–`L5`, `R1`–`R5`) |
| Pattern/art | shared+sparse arrays | same; adds metadata and `gradient` | same | partitioned into draw/art-2D layers per finger | same | Preserve element domain/kind/payload in per-finger layers |
| Attachments | shared+sparse arrays | same plus metadata/order | same | attachment layers per finger | same | Preserve in per-finger attachment layers |
| Relief | — | — | document-level `relief[]` | relief layer cloned into every finger | same | Per-finger relief layers are canonical; migration must record that v3 supplied one shared source |
| Recipe | — | — | optional document-level recipe instance | project-level `recipeInstances`, layers reference IDs | same | `recipeInstances` canonical; layer references contain IDs only |
| Layer type registry | — | — | — | document embeds `layerTypes` | same | Freeze whether registry is embedded or resolved by stable `typeId`; do not allow two writable definitions |
| Layer semantics | fixed conceptual partitions | element metadata only | same | explicit ID/name/type/visible/locked/order/role/process/validation/elements | adds optional `stepId` | Preserve explicit semantics; `stepId` remains optional metadata, not permission truth |
| Communication refs | — | — | — | — | optional `communicationRefs[]` | Preserve, default empty; explicitly excluded from manufacturing/customer output projections unless requested |
| Master finger | top-level `masterFinger` | same | same | `presentationMeta.masterFinger` | same | Preserve as presentation metadata, not design truth |
| Output intent | — | — | — | — in inspected model | — in inspected model | Required interface concern, but exact type/default remains an interface-freeze unknown |
| Time metadata | `updatedAt` only | same | same | same; recipe records have created/updated times | same | Preserve `updatedAt`; define `createdAt`/revision semantics before implementation |
| Revision/version lineage | — in EditorDoc | — | — | — | — | Required by downstream save/version flows; exact field names and ownership remain unknown |

## 4. Deterministic migration policy

### v1 → v6

| Source | Default/transform | Preservation | Intentional loss or caveat |
|---|---|---|---|
| `designId`, optional `customerId`, geometry, base data, finger copies, master finger, `updatedAt` | Preserve directly; default title to `未命名设计` | Values and recognized element payloads | No source title, creation time, revision, intent, recipe, relief, communication refs, or output intent exists |
| `finish` | `matte` → opaque/none/matte; `pearl` → opaque/pearl/gloss; otherwise opaque/none/gloss | Legacy visual finish meaning within the known enum | Unknown finish values currently collapse to gloss; adapter should report/default explicitly |
| missing `lengthPreset` | short→natural; medium→short-extension; long→medium; extra-long→long | Deterministic mapping already tested | Product preset was not independently authored in v1 |
| elements without metadata | `name` by kind; `visible=true`; `locked=false`; source-array index becomes `order` | Existing ID/kind/payload through normalization | Unknown element kinds are currently dropped; this must be surfaced in migration diagnostics, not silent |

### v2 → v6

| Source | Default/transform | Preservation | Intentional loss or caveat |
|---|---|---|---|
| v2 geometry, length preset, appearance, intent | Preserve recognized values | Existing authored product/appearance semantics | Current normalizer narrows unknown enum values to defaults |
| element metadata | Preserve name/visibility/lock; canonicalize order from array position | IDs and payloads | Stored numeric `order` is ignored in favor of array order |
| absent recipe/relief | empty recipe registry and relief layers | N/A | No recipe/relief source exists |

### v3 → v6

| Source | Default/transform | Preservation | Intentional loss or caveat |
|---|---|---|---|
| shared base/pattern/attachments | Materialize into every finger without a lock entry | Shared design semantics | Shared aliasing is not preserved; v6 stores independent snapshots |
| sparse `fingerLocks[f]` | Use that finger’s base/pattern/attachments; other fingers use shared values | Unlocked-finger authored differences | The misleading “lock” name becomes no v6 permission state |
| optional recipe | Create one stable recipe-instance record and reference it from relevant layers | Recipe object/reference | Historical `recipe_${designId}` is deterministic but not collision-resistant for future creation |
| document-level relief | Materialize equivalent relief elements per finger | Visual/structural content | Shared-vs-per-finger authorship cannot be recovered; duplicated IDs would violate global uniqueness unless deterministically namespaced |

### observed v4 → v6

| Source | Default/transform | Preservation | Intentional loss or caveat |
|---|---|---|---|
| ten nails/layers/elements | Validate all ten named fingers; normalize order deterministically | Per-finger geometry, layers, IDs, payloads, recipe references | Missing finger data is invalid, not defaulted |
| no communication refs | `[]` | N/A | None |
| no `stepId` | `undefined` | N/A | None |
| top-level and base-layer appearance | Apply the frozen conflict rule before conversion | Both raw values should be available to diagnostics | Current evidence does not define precedence if they disagree |

### observed v5 → v6

| Source | Default/transform | Preservation | Intentional loss or caveat |
|---|---|---|---|
| observed v4 body plus communication refs and optional layer `stepId` | Preserve; absent refs→`[]`; invalid step IDs→diagnostic/default | All valid v5 additions | Historical parser silently discarded invalid `stepId`; v6 adapter should make this visible |
| public name `EditorDocV4`, literal 5 | Route by literal version, never by historical type/API name | Stored document body | The historical name is not carried into v6 public APIs |

### v6 → v6

- Validate and clone/normalize without changing IDs or semantic order.
- `migrated=false`; read is pure and performs no storage write.
- Unknown future integer versions return `unsupported`.
- Missing, malformed object/JSON, and unsupported are distinct results.
- Saving accepts only a valid schema-6 document and occurs only through explicit save/edit/create behavior.

## 5. IDs and order

| Area | Observed behavior | Target v6 freeze recommendation |
|---|---|---|
| v1–v3 element IDs | Existing IDs are required for recognized pattern/attachment entries and retained | Preserve valid IDs byte-for-byte when globally unique |
| Main new IDs | `genId` combines prefix, `Date.now()`, counter, and `Math.random()` | Replace for new v6 entities with collision-resistant IDs; do not use `Date.now()` alone |
| v3→observed-v4 layer IDs | Deterministic `layer_${kind}_${finger}` | Legacy migration IDs must be deterministic and namespaced by document/finger/domain; collision handling must be specified |
| v3→observed-v4 recipe ID | Deterministic `recipe_${designId}` | Preserve determinism for migration, but validate against existing IDs |
| Relief cloning | Historical adapter cloned the same relief element IDs into all fingers | v6 IDs must be globally unique within a document; derive stable per-finger IDs while retaining a legacy/source-ID trace if required |
| Layer order | Observed v4 creates base, draw, art-2D, relief, attachment, recipe and assigns contiguous order | Array position is canonical; normalize `order` to contiguous indices or remove redundant numeric order after interface freeze |
| Element order | v1–v3 migrator uses source-array index, ignoring stored `order` | Array position is canonical; preserve relative source order |
| Cross-partition order | v2/v3 explicitly prohibit ordering across manufacturing partitions | v6 layer stack defines the complete per-finger order; element order is local to its layer |

Stable migration IDs and new-edit IDs are different requirements: migration needs repeatability for the same frozen input; runtime creation needs collision resistance across reloads and rapid repeated operations.

## 6. Canonical fields and projections

The following are proposed v6 source-of-truth rules:

1. **Document:** schema-6 EditorDoc is the only writable editor format.
2. **Geometry:** `defaultGeometry` plus optional per-finger geometry overrides are canonical. Resolved finger geometry, design summaries, previews, and `ProjectV4` shape/length are projections.
3. **Appearance/finish:** one default appearance plus an explicitly named per-finger override is canonical. A base-layer render surface and legacy `finish` are projections; they are not separately writable.
4. **Recipe:** project-level `recipeInstances` are canonical. Layers carry only `recipeInstanceId`; rendered/material layers are projections.
5. **Layers:** each finger’s ordered layer stack is canonical for base color, art, relief, and attachments. Summary `baseColor`, thumbnails, export structures, and canvas envelopes are projections.
6. **Presentation:** master finger, communication refs, and guide `stepId` are metadata and do not alter manufacturing truth.
7. **ProjectV4:** generated from a committed v6 snapshot. It is never merged back as an authoritative EditorDoc.

Projection gaps in the current `docToProjectV4` evidence:

- It omits title, appearance, intent, master finger, communication refs, and element-specific payload beyond generic metadata.
- It reduces finger-lock data to booleans and does not carry independent finger content.
- It emits only base/pattern/decoration layers despite `ProjectV4` allowing five layer types.
- Therefore it is intentionally lossy and unsuitable as a migration source unless a separate, explicit adapter is specified.

## 7. Preservation and loss register

Must preserve when present and valid:

- document/design identity, optional customer association, title;
- default and per-finger geometry;
- length preset and appearance/finish meaning;
- intent context;
- all ten finger stacks, layer and element IDs, relative order, visibility and lock state;
- valid element payload, transforms, attachment height, relief data;
- recipe instances and layer references;
- communication refs, master finger, guide step metadata;
- timestamps and agreed revision/version metadata.

Known or unavoidable legacy losses/ambiguities:

- v1 has no title, created time, revision, recipe, relief, communication refs, output intent, or per-finger geometry.
- v1 legacy finish cannot express translucent, cat-eye, aurora, or silk appearance.
- v1–v3 shared-vs-copied authorship disappears when materialized as ten independent stacks.
- v3 relief is document-wide; target per-finger ownership cannot be inferred.
- unknown legacy element kinds are dropped by the current migrator.
- malformed finger-lock entries are dropped by the current migrator.
- observed v4/v5 can contain conflicting top-level and base-layer appearance.
- historical layer IDs and cloned relief IDs are not guaranteed globally collision-resistant.
- creation time and document revision cannot be reconstructed from `updatedAt`.

No migration should describe these as lossless without diagnostics or explicit defaults.

## 8. Interface-freeze decisions

Decisions supported strongly enough to freeze:

1. Public type and literal are exactly `EditorDocV6` / `schemaVersion: 6`.
2. v1, v2, v3, observed Cursor v4, observed Cursor v5, and v6 have distinct read adapters selected by the raw literal version.
3. `ProjectV4` is a projection, not a legacy EditorDoc adapter input.
4. Reads/migrations are pure; only explicit save/edit/create writes schema 6.
5. Repository results distinguish `ok`, `missing`, `invalid`, and `unsupported`.
6. Ten named fingers and ordered layer stacks are required in v6.
7. Existing valid IDs and relative order are preserved; generated migration IDs are deterministic; newly created IDs are collision-resistant.
8. Geometry, appearance, recipe, and layer content each have one canonical writable path; summaries/canvas/export are projections.
9. Future versions and malformed records cannot fall through to blank creation or overwrite.
10. No new public API uses `V4`/`V5` naming.

## 9. Interface-freeze unknowns requiring an explicit PR-03 decision

1. Exact `OutputIntent` shape, allowed values, and legacy default.
2. Exact revision/version/lineage fields: document revision counter, design version, parent/source design ID, and which subsystem owns increments.
3. Whether v6 stores an embedded layer-type registry or only stable `typeId` values resolved from code.
4. Exact appearance override shape and precedence when observed top-level and base-layer appearance disagree.
5. Whether `order` remains persisted alongside arrays; if retained, array order versus numeric order precedence must be fixed.
6. Deterministic ID algorithm and collision policy for legacy-generated layers, cloned per-finger relief, and malformed duplicate IDs.
7. Whether communication-ref `dataUrl` remains embedded or becomes an asset reference; migration must preserve the observed value either way.
8. Whether layer `locked` is editable document state, policy-derived state, or both; permission checks need one canonical source.
9. Allowed strategy for unknown element kinds and invalid enum values: fail the document, preserve as opaque legacy payload, or migrate with diagnostics.
10. Whether `createdAt` is optional for migrated documents or deterministically set from another source; it must not be fabricated from migration time if idempotence is required.

## 10. Concise freeze conclusion

Freeze the version boundary, pure repository result model, ten-finger ordered-stack shape, ID/order guarantees, and canonical-vs-projection rules now. Do **not** freeze the final v6 interface until output intent, revision/lineage, appearance conflict precedence, layer-registry ownership, and duplicate/unknown-data policy are decided explicitly.
