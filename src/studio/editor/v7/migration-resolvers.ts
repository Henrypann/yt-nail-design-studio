import type { EditorDocV7MigrationResolvers } from './migrate';
import { createSurfaceFinishDefinitionV7 } from './finish';
import { resolveSignedProductGeometryRefV7 } from './geometry-registry';

/** Shared fail-closed resolvers used by the Editor and read-only preview. */
export const EDITOR_V7_PRODUCTION_MIGRATION_RESOLVERS: EditorDocV7MigrationResolvers = {
  resolveGeometry: ({ shape, length, finger }) => resolveSignedProductGeometryRefV7(shape, length, finger),
  resolveFinishPreset: ({ finishType }) => structuredClone(
    createSurfaceFinishDefinitionV7(finishType).finish.materialPresetRef,
  ),
};
