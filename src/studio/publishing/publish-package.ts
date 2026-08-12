/**
 * Studio V7.1 · STUDIO-V7.1-03 PublishPackageV1 — deterministic generator.
 *
 * `buildPublishPackageV1` derives a publish-safe release package from an
 * immutable DesignVersionV1 plus its private DesignReleaseRecordV1. Generation
 * is pure: every renderer, SHA-256, content-addressed asset-id and geometry registry is an
 * injected dependency; the DesignVersion and the release record are never
 * mutated or rewritten, and a retry with the same dependencies reproduces the
 * same semantic package.
 *
 * Failure semantics are all-or-nothing for infrastructure dependencies
 * (SHA-256 and asset ids) and for the 2D fallback renderer; the only explicit
 * per-output fallback is the 2D path when 3D/WebGL/mesh is unavailable or the
 * primary renderer fails — the result stays an explainable package. Unresolved
 * geometry is recorded per finger and never fails the package. No EditorDoc,
 * customer, manufacturing, device or runtime state ever enters the package,
 * and no image bytes (marketing concept images included) are embedded.
 */

import { FINGER_CODES, type FingerCode } from '@/lib/types';
import { parseDesignVersionV1 } from '@/community/domain/v7_1/design-content-parse';
import { parseEditorDocV7 } from '@/studio/editor/v7/schema';
import type {
  EditorDocV7,
  NailDesignV7,
  SurfaceFinishTypeV7,
} from '@/studio/editor/v7/model';
import {
  buildDesignReleaseManifestV1,
  canonicalJsonV1,
  type DesignReleaseRecordV1,
} from '@/studio/versioning/design-release';
import {
  PUBLISH_COVER_SIZE,
  PUBLISH_DETAIL_SIZE,
  PUBLISH_PACKAGE_SCHEMA_VERSION,
  deriveStablePaletteV1,
  type GeometryResolutionV1,
  type NailDetailDescriptorV1,
  type PublishPackageDependenciesV1,
  type PublishPackageArtifactV1,
  type PublishFallbackReasonV1,
  type PublishPackageGeometryV1,
  type PublishPackageOutputV1,
  type PublishPackageResultV1,
  type PublishPackageV1,
  type PublishRenderRequestV1,
  type PublishRendererOutputV1,
} from './publish-package-model';
import {
  clonePublishPackageV1,
  normalizeGeometryResolution,
  parsePublishPackageV1,
} from './publish-package-parse';

const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function packageError(
  code: 'invalid_release_record' | 'dependency_unavailable' | 'renderer_failed' | 'output_contract_failed',
  message: string,
): PublishPackageResultV1 {
  return { ok: false, code, message };
}

function finishTypeOf(nail: NailDesignV7): SurfaceFinishTypeV7 | null {
  const finish = nail.steps.find((step) => step.kind === 'surface_finish');
  return finish && finish.kind === 'surface_finish' ? finish.finish.type : null;
}

function isValidRendererOutput(output: PublishRendererOutputV1): boolean {
  if (output === null || typeof output !== 'object') return false;
  if (!(output.bytes instanceof Uint8Array) || output.bytes.byteLength === 0) return false;
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(output.mimeType)) return false;
  if (!Number.isInteger(output.width) || output.width < 1) return false;
  if (!Number.isInteger(output.height) || output.height < 1) return false;
  if (output.colorSpace !== 'srgb' && output.colorSpace !== 'display-p3') return false;
  if (output.fidelity !== 'EXACT' && output.fidelity !== 'APPROXIMATE') return false;
  return true;
}

type RenderAttempt =
  | { failed: true; reason: Exclude<PublishFallbackReasonV1, 'PRIMARY_RENDERER_APPROXIMATE'> }
  | { failed: false; output: PublishRendererOutputV1; rendererId: string };

async function attemptRender(
  renderer: { rendererId: string; render(request: PublishRenderRequestV1): unknown } | null,
  request: PublishRenderRequestV1,
): Promise<RenderAttempt> {
  if (renderer === null) return { failed: true, reason: 'PRIMARY_RENDERER_UNAVAILABLE' };
  try {
    const result = await renderer.render(structuredClone(request));
    if (!isRecord(result)) return { failed: true, reason: 'PRIMARY_RENDERER_OUTPUT_INVALID' };
    if (result.ok !== true) {
      return { failed: true, reason: 'PRIMARY_RENDERER_REJECTED' };
    }
    const output = isRecord(result.output) ? (result.output as unknown as PublishRendererOutputV1) : null;
    if (output === null || !isValidRendererOutput(output)) {
      return { failed: true, reason: 'PRIMARY_RENDERER_OUTPUT_INVALID' };
    }
    return { failed: false, output, rendererId: renderer.rendererId };
  } catch {
    return { failed: true, reason: 'PRIMARY_RENDERER_EXCEPTION' };
  }
}

/**
 * Validate the private release record before deriving anything from it.
 * Mirrors the invariants `parseDesignReleaseStoreV1` enforces so a corrupted
 * or mismatched record can never produce a package.
 */
function validateReleaseRecord(
  record: unknown,
): { ok: true; doc: EditorDocV7 } | { ok: false; message: string } {
  if (!isRecord(record) || record.schemaVersion !== 1) {
    return { ok: false, message: 'release record must be a schemaVersion 1 object' };
  }
  if (!Object.keys(record).every((key) => ['schemaVersion', 'designVersion', 'manifest', 'editorDocSnapshot'].includes(key))) {
    return { ok: false, message: 'release record contains unknown fields' };
  }
  if (!isRecord(record.designVersion) || !isRecord(record.manifest) || !isRecord(record.editorDocSnapshot)) {
    return { ok: false, message: 'release record is missing designVersion/manifest/editorDocSnapshot' };
  }
  const version = parseDesignVersionV1(record.designVersion);
  if (!version.ok) return { ok: false, message: `designVersion violates its public contract: ${version.reason}` };
  const doc = parseEditorDocV7(record.editorDocSnapshot);
  if (!doc.ok) return { ok: false, message: `editorDocSnapshot violates the V7 contract: ${doc.reason}` };
  if (version.value.designId !== doc.doc.designId || version.value.revision !== doc.doc.revision) {
    return { ok: false, message: 'release record designVersion refs do not match the snapshot' };
  }
  const derived = buildDesignReleaseManifestV1(doc.doc);
  if (!derived.ok) return { ok: false, message: `release manifest cannot be re-derived: ${derived.message}` };
  if (canonicalJsonV1(derived.manifest) !== canonicalJsonV1(record.manifest)) {
    return { ok: false, message: 'release manifest does not match the immutable snapshot' };
  }
  if (canonicalJsonV1(version.value.assetRevisionRefs) !== canonicalJsonV1(derived.manifest.assetRevisionRefs)) {
    return { ok: false, message: 'designVersion asset refs do not match the immutable release manifest' };
  }
  return { ok: true, doc: doc.doc };
}

function resolveGeometryEntry(
  finger: FingerCode,
  ref: { assetId: string; revision: string },
  dependencies: PublishPackageDependenciesV1,
): PublishPackageGeometryV1 {
  const base = { finger, assetId: ref.assetId, revision: ref.revision };
  let resolution: GeometryResolutionV1;
  try {
    resolution = dependencies.resolveGeometry({ assetId: ref.assetId, revision: ref.revision });
  } catch {
    return { ...base, status: 'unresolved', reason: 'geometry_resolver_error' };
  }
  const normalized = normalizeGeometryResolution(resolution);
  if (!normalized.ok) {
    return { ...base, status: 'unresolved', reason: 'invalid_geometry_resolution' };
  }
  if (normalized.status === 'resolved') {
    return { ...base, status: 'resolved', shapeId: normalized.shapeId, lengthId: normalized.lengthId };
  }
  return { ...base, status: 'unresolved', reason: normalized.reason };
}

async function renderOutput(
  request: PublishRenderRequestV1,
  dependencies: PublishPackageDependenciesV1,
  source: { designVersionId: string; version: number; revision: number; rendererRevision: string },
  assetIdOf: (kind: 'COVER' | 'DETAIL', finger: FingerCode | null, contentSha256: string) => string,
): Promise<
  | { ok: true; output: PublishPackageOutputV1; artifact: PublishPackageArtifactV1; fallbackUsed: boolean }
  | { ok: false; code: 'dependency_unavailable' | 'renderer_failed'; message: string }
> {
  const primary = await attemptRender(dependencies.renderer3d, request);
  const fallbackReason: PublishFallbackReasonV1 | undefined = primary.failed
    ? primary.reason
    : primary.output.fidelity === 'APPROXIMATE'
      ? 'PRIMARY_RENDERER_APPROXIMATE'
      : undefined;
  const chosen = primary.failed ? await attemptRender(dependencies.renderer2d, request) : primary;
  if (chosen.failed) {
    return {
      ok: false,
      code: 'renderer_failed',
      message: 'primary renderer and fallback 2D renderer could not produce a valid output',
    };
  }
  // The 2D fallback path is by definition an approximate representation.
  const output = primary.failed
    ? { ...chosen.output, fidelity: 'APPROXIMATE' as const }
    : chosen.output;

  let sha256: string;
  try {
    sha256 = await dependencies.sha256(output.bytes);
  } catch {
    return { ok: false, code: 'dependency_unavailable', message: 'SHA-256 unavailable' };
  }
  if (!/^[0-9a-f]{64}$/.test(sha256)) {
    return { ok: false, code: 'dependency_unavailable', message: 'SHA-256 provider returned an invalid digest' };
  }

  let assetId: string;
  try {
    const identitySha256 = await dependencies.sha256(new TextEncoder().encode(canonicalJsonV1({
      schemaVersion: PUBLISH_PACKAGE_SCHEMA_VERSION,
      kind: request.kind,
      finger: request.finger ?? null,
      bytesSha256: sha256,
      rendererId: chosen.rendererId,
      rendererRevision: source.rendererRevision,
    })));
    if (!/^[0-9a-f]{64}$/.test(identitySha256)) {
      return { ok: false, code: 'dependency_unavailable', message: 'derived identity hash is invalid' };
    }
    assetId = assetIdOf(request.kind, request.finger ?? null, identitySha256);
  } catch {
    return { ok: false, code: 'dependency_unavailable', message: 'asset id provider failed' };
  }
  if (!ID_PATTERN.test(assetId)) {
    return { ok: false, code: 'dependency_unavailable', message: `asset id provider returned an invalid id "${assetId}"` };
  }

  const descriptor: PublishPackageOutputV1 = {
    kind: request.kind,
    ...(request.finger !== undefined ? { finger: request.finger } : {}),
    assetId,
    revision: 1,
    sha256,
    mimeType: output.mimeType,
    width: output.width,
    height: output.height,
    colorSpace: output.colorSpace,
    fidelity: output.fidelity,
    ...(fallbackReason !== undefined ? { fallbackReason } : {}),
    rendererId: chosen.rendererId,
    rendererRevision: source.rendererRevision,
    sourceDesignVersionId: source.designVersionId,
    sourceVersion: source.version,
    sourceRevision: source.revision,
  };
  return {
    ok: true,
    fallbackUsed: primary.failed,
    output: descriptor,
    artifact: { output: structuredClone(descriptor), bytes: Uint8Array.from(output.bytes) },
  };
}

/**
 * Build a deterministic PublishPackageV1 from a private DesignReleaseRecordV1.
 * Never mutates the record or the DesignVersion; all dependencies are injected.
 */
export async function buildPublishPackageV1(
  record: DesignReleaseRecordV1,
  dependencies: PublishPackageDependenciesV1,
): Promise<PublishPackageResultV1> {
  const validated = validateReleaseRecord(record);
  if (!validated.ok) return packageError('invalid_release_record', validated.message);
  const doc = structuredClone(validated.doc);
  const designVersion = structuredClone(record.designVersion);

  try {
    const snapshotHash = await dependencies.sha256(new TextEncoder().encode(canonicalJsonV1(doc)));
    if (snapshotHash !== designVersion.editorDocRef.sha256) {
      return packageError('invalid_release_record', 'designVersion editorDoc hash does not match the immutable snapshot');
    }
  } catch {
    return packageError('dependency_unavailable', 'SHA-256 unavailable while validating the immutable snapshot');
  }

  if (typeof dependencies.rendererRevision !== 'string' || dependencies.rendererRevision.length === 0) {
    return packageError('dependency_unavailable', 'a fixed rendererRevision is required');
  }
  if (dependencies.renderer2d === null || typeof dependencies.renderer2d !== 'object' || typeof dependencies.renderer2d.rendererId !== 'string') {
    return packageError('dependency_unavailable', 'an always-available 2D fallback renderer is required');
  }

  const generatedAt = designVersion.releasedAt;

  const palette = deriveStablePaletteV1(doc);
  if (palette.length === 0) {
    return packageError('invalid_release_record', 'design content produced an empty palette');
  }

  const geometry: PublishPackageGeometryV1[] = [];
  const shapeIds = new Set<string>();
  const lengthIds = new Set<string>();
  for (const finger of FINGER_CODES) {
    const nail = doc.nails[finger];
    const entry = resolveGeometryEntry(finger, nail.geometryRef, dependencies);
    geometry.push(entry);
    if (entry.status === 'resolved' && entry.shapeId !== undefined && entry.lengthId !== undefined) {
      shapeIds.add(entry.shapeId);
      lengthIds.add(entry.lengthId);
    }
  }

  const source = {
    designVersionId: designVersion.designVersionId,
    version: designVersion.version,
    revision: designVersion.revision,
    rendererRevision: dependencies.rendererRevision,
  };

  const coverRequest: PublishRenderRequestV1 = {
    kind: 'COVER',
    designVersion,
    doc,
    palette,
    ...PUBLISH_COVER_SIZE,
  };
  const coverResult = await renderOutput(
    coverRequest,
    dependencies,
    source,
    (kind, finger, contentSha256) => dependencies.nextAssetId(kind, finger, contentSha256),
  );
  if (!coverResult.ok) return coverResult;

  const details: PublishPackageOutputV1[] = [];
  const artifacts: PublishPackageArtifactV1[] = [coverResult.artifact];
  const nailDescriptors: NailDetailDescriptorV1[] = [];
  let fallbackUsed = coverResult.fallbackUsed;
  for (const finger of FINGER_CODES) {
    const nail = doc.nails[finger];
    if (!nail) {
      return packageError('invalid_release_record', `finger ${finger} is missing from the snapshot`);
    }
    const finishType = finishTypeOf(nail);
    if (finishType === null) {
      return packageError('invalid_release_record', `finger ${finger} has no surface_finish step`);
    }
    const detailRequest: PublishRenderRequestV1 = {
      kind: 'DETAIL',
      finger,
      designVersion,
      doc,
      nail,
      palette,
      ...PUBLISH_DETAIL_SIZE,
    };
    const detailResult = await renderOutput(
      detailRequest,
      dependencies,
      source,
      (kind, fingerCode, contentSha256) => dependencies.nextAssetId(kind, fingerCode, contentSha256),
    );
    if (!detailResult.ok) return detailResult;
    fallbackUsed = fallbackUsed || detailResult.fallbackUsed;
    details.push(detailResult.output);
    artifacts.push(detailResult.artifact);
    nailDescriptors.push({
      finger,
      finishType,
      detailAssetId: detailResult.output.assetId,
      fidelity: detailResult.output.fidelity,
    });
  }

  const allExact = [coverResult.output, ...details].every((output) => output.fidelity === 'EXACT');
  const packageIdentity = {
    schemaVersion: PUBLISH_PACKAGE_SCHEMA_VERSION,
    designVersionId: designVersion.designVersionId,
    designId: designVersion.designId,
    version: designVersion.version,
    revision: designVersion.revision,
    rendererRevision: dependencies.rendererRevision,
    cover: coverResult.output,
    details,
    nailDescriptors,
    palette,
    shapeIds: [...shapeIds].sort(),
    lengthIds: [...lengthIds].sort(),
    geometry,
    assetManifest: record.manifest,
  };
  let packageContentSha256: string;
  let packageId: string;
  try {
    packageContentSha256 = await dependencies.sha256(new TextEncoder().encode(canonicalJsonV1(packageIdentity)));
    packageId = dependencies.nextAssetId('PACKAGE', null, packageContentSha256);
  } catch {
    return packageError('dependency_unavailable', 'package identity provider failed');
  }
  if (!/^[0-9a-f]{64}$/.test(packageContentSha256) || !ID_PATTERN.test(packageId)) {
    return packageError('dependency_unavailable', 'package identity provider returned an invalid content address');
  }

  const pkg: PublishPackageV1 = {
    schemaVersion: PUBLISH_PACKAGE_SCHEMA_VERSION,
    packageId,
    designVersionId: designVersion.designVersionId,
    designId: designVersion.designId,
    version: designVersion.version,
    revision: designVersion.revision,
    rendererRevision: dependencies.rendererRevision,
    generatedAt,
    fidelity: allExact ? 'EXACT' : 'APPROXIMATE',
    cover: coverResult.output,
    details,
    nailDescriptors,
    palette,
    shapeIds: packageIdentity.shapeIds,
    lengthIds: packageIdentity.lengthIds,
    geometry,
    assetManifest: clonePublishPackageV1(record.manifest),
  };

  // Self-consistency: a generated package must always satisfy its own parser.
  const parsed = parsePublishPackageV1(pkg);
  if (!parsed.ok) {
    const issueSummary = parsed.issues.map((issue) => `${issue.path}:${issue.code}`).join(', ');
    return packageError('output_contract_failed', `generated package failed its own contract: ${parsed.reason}; ${issueSummary}`);
  }
  return {
    ok: true,
    package: clonePublishPackageV1(pkg),
    artifacts: artifacts.map((artifact) => ({ output: clonePublishPackageV1(artifact.output), bytes: Uint8Array.from(artifact.bytes) })),
    fallbackUsed,
  };
}
