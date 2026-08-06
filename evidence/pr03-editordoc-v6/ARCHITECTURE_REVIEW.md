# PR-03 Architecture Review — EditorDocV6 contract

Status: Main Agent freeze + implementation gate input  
Base: `c4f13e7`  
Scope: model / migration / repository boundary only (no UI/store rollout)

## Verdict

**PASS after P1 closure.** Dual-write legacy top-level keys are rejected by `parseEditorDocV6`; saves persist only the canonical allowlist. Proceed with scoped commit.

## P0 — must hold

1. Public writable type/literal are exactly `EditorDocV6` / `schemaVersion: 6`.
2. Reads/migrations are pure; storage writes only through explicit schema-6 save/edit/create.
3. `ProjectV4` is never accepted as an EditorDoc adapter input.
4. Duplicate IDs after migration are `invalid`, not silently rewritten.
5. Unknown future schema (`>6`) is `unsupported` and cannot be overwritten by blank create fallbacks.
6. Legacy v3 runtime path must not pretend v4–v6 documents are openable as schema-3 EditorDoc.

## P1 — freeze decisions applied

| Topic | Decision |
|---|---|
| OutputIntent | `design \| customer \| manufacturing`; migrate default `design` |
| Revision | `revision: 1` on migrate; no fabricated lineage |
| Layer types | code-resolved `typeId`; discard embedded registries |
| Appearance conflict | document `appearance` wins |
| Order | array index canonical; persist contiguous `order` |
| createdAt | migrate from source `updatedAt` |
| Unknown kinds | `invalid` (no silent drop) |
| Relief clone IDs | `${sourceId}__${finger}` |

## P2 — deferred to PR-04+

- Full editor store/UI consuming EditorDocV6
- Capability/permission derivation from layer type registry
- Rich revision lineage / parent design links
- Asset-ref migration for communication `dataUrl`
- Replacing legacy `saveEditorDoc(EditorDoc v3)` callers

## Silent-loss sites (must stay explicit)

- v1–v3 shared authorship → ten independent stacks
- Embedded `layerTypes` discarded
- Base-layer `surface.appearance` discarded when present
- `ProjectV4` projection remains lossy and is not a migration source
- Historical Cursor type name `EditorDocV4` with literal 5 is adapter-only history

## Must-freeze interfaces (confirmed)

- `migrateEditorDocV6(raw)`
- `parseEditorDocV6` / `validateEditorDocV6`
- `generateEditorId` / deterministic migration IDs
- `getEditorDocV6Result` / `saveEditorDocV6ToMap`
- Version-neutral inspect classification for literals 1–6 as supported known family

## Concise freeze conclusion

Freeze and implement the v6 contract now. Keep legacy v3 open path until PR-04, but classify 1–6 as known schemas for probes and require all new writes to be schema 6 through the v6 repository boundary.
