/**
 * Studio V7.1 · STUDIO-V7.1-03 Publish Package — public surface.
 *
 * A release package is a deterministic, publish-safe derivation from an
 * immutable DesignVersionV1 plus its private DesignReleaseRecordV1: ten-finger
 * cover, per-nail detail descriptors, stable palette, shape/length summaries,
 * per-output fidelity/fallback evidence and an immutable source manifest.
 * Generation is pure with injected renderer/SHA-256/content-addressed asset-id/geometry
 * dependencies; the DesignVersion is never mutated or rewritten.
 */

export {
  PUBLISH_COLOR_SPACES_V1,
  PUBLISH_COVER_SIZE,
  PUBLISH_DETAIL_SIZE,
  PUBLISH_FIDELITIES_V1,
  PUBLISH_FALLBACK_REASONS_V1,
  PUBLISH_OUTPUT_KINDS_V1,
  PUBLISH_OUTPUT_MIME_V1,
  PUBLISH_PACKAGE_SCHEMA_VERSION,
  createDeterministicPublishIdFactoryV1,
  deriveStablePaletteV1,
} from './publish-package-model';
export type {
  GeometryResolutionV1,
  NailDetailDescriptorV1,
  PublishColorSpaceV1,
  PublishFidelityV1,
  PublishFallbackReasonV1,
  PublishOutputKindV1,
  PublishOutputMimeV1,
  PublishPackageDependenciesV1,
  PublishPackageArtifactV1,
  PublishPackageErrorCodeV1,
  PublishPackageGeometryV1,
  PublishPackageManifestV1,
  PublishPackageOutputV1,
  PublishPackageResultV1,
  PublishPackageV1,
  PublishRenderRequestV1,
  PublishRenderResultV1,
  PublishRendererOutputV1,
  PublishRendererV1,
} from './publish-package-model';
export { buildPublishPackageV1 } from './publish-package';
export {
  clonePublishPackageV1,
  normalizeGeometryResolution,
  parsePublishPackageV1,
} from './publish-package-parse';
export type {
  PublishPackageIssue,
  PublishPackageIssueCode,
  PublishPackageParseResult,
} from './publish-package-parse';
