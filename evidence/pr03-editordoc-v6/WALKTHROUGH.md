# PR-03 Walkthrough — EditorDocV6 contract & migration

## Scope verified

- Compatibility matrix + interface freeze documented
- Pure `migrateEditorDocV6` for literals 1–6
- Schema validator, collision-resistant IDs, repository save rejection for non-v6
- Fixtures under `src/studio/editor/fixtures/`
- Probe classification: versions 1–6 = supported known family; `>6` = unsupported
- Legacy v3 runtime still cannot open v4–v6 as schema-3 (`migrateEditorDoc` → `unsupported`)

## Automated evidence

```bash
npm run test:editor-v6-contract   # PASS
npm run test:editor-v6-migrate    # PASS
npm run test:community-studio-flow # PASS (probe kinds updated for v4/v5)
npm run typecheck                 # PASS
npm run build                     # PASS
npm run build:integration         # PASS
npm run test:handdraw             # PASS
npm run validate-assets           # PASS
npm run validate-recipes          # PASS
```

## Known baseline (not introduced by PR-03)

- `npm run test:slots` fails on existing Slot V2 rotation assertion (`Math.abs(slot.rotationDeg) < 5`). Per delivery standard, Slot V2 data was not modified.

## Manual / runtime note

PR-03 does not ship Editor UI/store rollout (PR-04). Runtime smoke is limited to production/integration builds succeeding and contract/migrate gates. No new interactive surfaces were added.

## Migration defaults (exact)

| Case | Default |
|---|---|
| missing title | `未命名设计` |
| missing masterFinger | `R4` |
| missing communicationRefs | `[]` |
| outputIntent | `design` |
| revision | `1` |
| createdAt | source `updatedAt` |
| v1 finish pearl/matte/other | opaque/pearl/gloss · opaque/none/matte · opaque/none/gloss |
| lengthPreset from length | short→natural, medium→short-extension, long→medium, extra-long→long |
| shared element IDs | `${sourceId}__${finger}` |
| relief clone IDs | `${sourceId}__${finger}` |
| embedded layerTypes | discarded |
| base-layer appearance | ignored; document appearance wins |
