# ARCH-v0.7.2-3D-01 Validation

## Scope

- Machine contracts for NailSurfaceDefinitionV1, CanonicalGeometrySnapshotV1, GeometryOperationGraphV1, GeometryKernelPortV1 and GeometryEvaluationRecordV1.
- Strict runtime parsing and a deep `additionalProperties:false` JSON Schema envelope.
- Architecture Golden Fixtures for a reference almond shell, relief, attachment, union/subtract/intersection graph and evaluation record.
- Negative matrix for unknown keys, coordinate drift, station ordering, topology inconsistency, component policy, dangling output and incomplete success records.

## Boundaries

- Evidence level: `architecture-golden`.
- The almond values are deterministic reference inputs, not a fitted, physically validated or manufacturing-ready shell.
- No EditorDoc schema/storage/writer, product route, PBR UI, manufacturing compiler or device path is changed.
- Manifold remains a candidate adapter. This PR defines the port and acceptance surface; parity is GEO-v0.7.2-01.

## Gates

- `npm run test:geometry-v0-7-2-contract` — PASS.
- `npm run typecheck` — PASS.
- `npm run build:integration` — PASS; existing chunk-size warning only.
- `npm run test:editor-v7-contract` — PASS.
- `git diff --check` — PASS.

Baseline observation: `npm run test:editor-v7-inspiration-geometry` fails at the unchanged line 228 assertion for `setProductGeometry('oval', 'long')`. The same command fails identically in the clean GEN-V7.1-04 parent worktree at `4d38821`; ARCH-v0.7.2-3D-01 does not touch Editor geometry commands or assets.
