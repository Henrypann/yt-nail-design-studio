import type { PublishedLookV1 } from '@/community/domain/v7_1/design-content-model';
import type { VersionedIntentPortV2, VersionedStudioImportIntentV2 } from '@/community/domain/v7_1/versioned-studio-intent';
import { sameVersionedIntentAssetsV2 } from '@/community/domain/v7_1/versioned-studio-intent';
import { FINGER_CODES } from '@/lib/types';
import type { EditorDocV7 } from '@/studio/editor/v7/model';
import { resolveEditorGeometryV7 } from '@/studio/editor/v7/geometry-registry';
import { materializeIndependentEditorDocV7 } from '@/studio/editor/v7/materialize';
import { parseEditorDocV7 } from '@/studio/editor/v7/schema';
import {
  canonicalJsonV1,
  parseDesignReleaseStoreV1,
  type DesignReleaseRecordV1,
} from './design-release';

export type VersionedImportModeV2 = 'current' | 'new' | 'cancel';
export interface LookCustomizeEventV1 {
  event: 'look_customize';
  eventId: string;
  lookId: string;
  designVersionId: string;
  targetDesignId: string;
  occurredAt: string;
}

export interface VersionedImportDependenciesV2 {
  intents: VersionedIntentPortV2;
  getLook(lookId: string): Promise<PublishedLookV1 | null>;
  getRelease(designVersionId: string): Promise<DesignReleaseRecordV1 | null>;
  sha256(value: string): Promise<string>;
  canReadLook(look: PublishedLookV1): Promise<boolean>;
  assetAvailable(asset: { assetId: string; revision: number; sha256: string; mimeType?: string }): Promise<boolean>;
  /** Must be idempotent by intentId and return the persisted document. */
  createTarget(input: { intentId: string; doc: EditorDocV7 }): Promise<
    { ok: true; created: boolean; doc: EditorDocV7 } | { ok: false; message: string }
  >;
  nextId(scope: 'design'|'node'): string;
  now(): string;
}

export type VersionedImportResultV2 =
  | { ok: true; mode: 'current'|'cancel'; created: false; returnTo: string }
  | { ok: true; mode: 'new'; created: true; doc: EditorDocV7; event: LookCustomizeEventV1; returnTo: string }
  | { ok: false; reason: 'missing_or_expired'|'permission'|'look_unavailable'|'version_mismatch'|'release_unavailable'|'asset_mismatch'|'asset_unavailable'|'geometry_unavailable'|'invalid_release'|'id_collision'|'write_failed'|'dependency'; retryable: boolean; message: string };

export function materializeVersionedRemixV2(
  source: EditorDocV7,
  intent: VersionedStudioImportIntentV2,
  deps: Pick<VersionedImportDependenciesV2,'nextId'|'now'>,
): { ok: true; doc: EditorDocV7 } | { ok: false; reason: 'id_collision'|'dependency' } {
  let now: string;
  try { now = deps.now(); }
  catch { return { ok: false, reason: 'dependency' }; }
  const materialized = materializeIndependentEditorDocV7(source, {
    sourceRef: { domain: 'community', sourceId: intent.lookId, revision: intent.designVersionId },
    title: `${source.title} Remix`,
    now,
  }, { nextId: deps.nextId });
  if (materialized.ok) return materialized;
  return materialized.reason === 'id_collision'
    ? { ok: false, reason: 'id_collision' }
    : { ok: false, reason: 'dependency' };
}

export async function consumeVersionedStudioImportV2(intentId: string, mode: VersionedImportModeV2, deps: VersionedImportDependenciesV2): Promise<VersionedImportResultV2> {
  let intent: VersionedStudioImportIntentV2 | null;
  try { intent = deps.intents.peek(intentId); }
  catch { return { ok: false, reason: 'dependency', retryable: true, message: 'intent storage unavailable' }; }
  if (!intent) return { ok: false, reason: 'missing_or_expired', retryable: false, message: 'intent missing or expired' };
  const rejectFinal = (
    reason: Extract<VersionedImportResultV2, { ok: false }>['reason'],
    message: string,
  ): VersionedImportResultV2 => {
    try { deps.intents.clear(intentId); }
    catch { return { ok: false, reason: 'dependency', retryable: true, message: `${message}; intent cleanup failed` }; }
    return { ok: false, reason, retryable: false, message };
  };
  if (mode === 'current' || mode === 'cancel') {
    try { deps.intents.clear(intentId); }
    catch { return { ok: false, reason: 'dependency', retryable: true, message: 'intent could not be dismissed' }; }
    return { ok: true, mode, created: false, returnTo: intent.returnTo };
  }
  let look: PublishedLookV1 | null; let release: DesignReleaseRecordV1 | null;
  try { [look, release] = await Promise.all([deps.getLook(intent.lookId), deps.getRelease(intent.designVersionId)]); }
  catch { return { ok: false, reason: 'dependency', retryable: true, message: 'authority load failed' }; }
  if (!look || look.status !== 'PUBLISHED' || look.visibility !== 'PUBLIC') return rejectFinal('look_unavailable', 'look is unavailable');
  let canRead: boolean;
  try { canRead = await deps.canReadLook(look); }
  catch { return { ok: false, reason: 'dependency', retryable: true, message: 'permission check failed' }; }
  if (!canRead) {
    try { deps.intents.clear(intentId); } catch { return { ok: false, reason: 'dependency', retryable: true, message: 'permission revoked; intent cleanup failed' }; }
    return { ok: false, reason: 'permission', retryable: false, message: 'permission revoked' };
  }
  if (look.designVersionId !== intent.designVersionId) return rejectFinal('version_mismatch', 'look now references a different version');
  if (!release || release.designVersion.designVersionId !== intent.designVersionId) return { ok: false, reason: 'release_unavailable', retryable: true, message: 'released source unavailable' };
  const verifiedEnvelope = parseDesignReleaseStoreV1({
    schemaVersion: 1,
    kind: 'STUDIO_DESIGN_RELEASE_STORE',
    records: [release],
  });
  if (!verifiedEnvelope.ok) return rejectFinal('invalid_release', 'release record or manifest is invalid');
  release = verifiedEnvelope.store.records[0];
  let editorDocSha256: string;
  try { editorDocSha256 = await deps.sha256(canonicalJsonV1(release.editorDocSnapshot)); }
  catch { return { ok: false, reason: 'dependency', retryable: true, message: 'release checksum validation failed' }; }
  if (editorDocSha256 !== release.designVersion.editorDocRef.sha256) {
    return rejectFinal('invalid_release', 'release snapshot checksum mismatch');
  }
  if (!sameVersionedIntentAssetsV2(intent.assetRevisionRefs, release.designVersion.assetRevisionRefs)) return rejectFinal('asset_mismatch', 'immutable asset set changed');
  for (const asset of intent.assetRevisionRefs) {
    try { if (!await deps.assetAvailable(asset)) return { ok: false, reason: 'asset_unavailable', retryable: true, message: `asset unavailable: ${asset.assetId}` }; }
    catch { return { ok: false, reason: 'dependency', retryable: true, message: 'asset validation failed' }; }
  }
  const source = parseEditorDocV7(release.editorDocSnapshot);
  if (!source.ok || source.doc.designId !== release.designVersion.designId || source.doc.revision !== release.designVersion.revision) return rejectFinal('invalid_release', 'release snapshot invalid');
  for (const finger of FINGER_CODES) {
    const geometry = resolveEditorGeometryV7(source.doc.nails[finger].geometryRef, finger);
    if (geometry.fidelity !== 'exact') {
      return rejectFinal('geometry_unavailable', `geometry unavailable for ${finger}: ${geometry.status === 'unresolved' ? geometry.reason : geometry.evidence}`);
    }
  }
  const materialized = materializeVersionedRemixV2(source.doc, intent, deps);
  if (!materialized.ok) return materialized.reason === 'id_collision'
    ? rejectFinal('id_collision', 'failed to create independent V7 document')
    : { ok: false, reason: 'dependency', retryable: true, message: 'failed to create independent V7 document' };
  let occurredAt: string;
  try { occurredAt = deps.now(); } catch { return { ok: false, reason: 'dependency', retryable: true, message: 'event time unavailable before create' }; }
  if (!Number.isFinite(Date.parse(occurredAt))) return { ok: false, reason: 'dependency', retryable: true, message: 'event time invalid before create' };
  let written: Awaited<ReturnType<VersionedImportDependenciesV2['createTarget']>>;
  try { written = await deps.createTarget({ intentId, doc: materialized.doc }); }
  catch { return { ok: false, reason: 'write_failed', retryable: true, message: 'target writer failed' }; }
  if (!written.ok) return { ok: false, reason: 'write_failed', retryable: true, message: written.message };
  const persisted = parseEditorDocV7(written.doc);
  const expectedSource = persisted.ok && persisted.doc.sourceRefs.some((ref) => ref.domain === 'community'
    && ref.sourceId === intent.lookId && ref.revision === intent.designVersionId);
  if (!persisted.ok || !expectedSource) return { ok: false, reason: 'write_failed', retryable: true, message: 'target writer returned an invalid document' };
  try { deps.intents.clear(intentId); }
  catch { return { ok: false, reason: 'dependency', retryable: true, message: 'target created; intent cleanup failed' }; }
  return { ok: true, mode: 'new', created: true, doc: structuredClone(persisted.doc), returnTo: intent.returnTo,
    event: { event: 'look_customize', eventId: intent.intentId, lookId: intent.lookId, designVersionId: intent.designVersionId, targetDesignId: persisted.doc.designId, occurredAt } };
}
