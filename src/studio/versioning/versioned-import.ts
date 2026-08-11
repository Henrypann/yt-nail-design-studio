import type { PublishedLookV1 } from '@/community/domain/v7_1/design-content-model';
import type { VersionedIntentPortV2, VersionedStudioImportIntentV2 } from '@/community/domain/v7_1/versioned-studio-intent';
import { sameVersionedIntentAssetsV2 } from '@/community/domain/v7_1/versioned-studio-intent';
import type { EditorDocV7, ProcessStepV7, RecipeInstanceV7 } from '@/studio/editor/v7/model';
import { parseEditorDocV7 } from '@/studio/editor/v7/schema';
import type { DesignReleaseRecordV1 } from './design-release';

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
  | { ok: false; reason: 'missing_or_expired'|'permission'|'look_unavailable'|'version_mismatch'|'release_unavailable'|'asset_mismatch'|'asset_unavailable'|'invalid_release'|'id_collision'|'write_failed'|'dependency'; retryable: boolean; message: string };

const ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;

function remapStep(step: ProcessStepV7, ids: Map<string,string>, next: () => string): ProcessStepV7 {
  const copy = structuredClone(step);
  copy.id = next(); ids.set(step.id, copy.id);
  if (copy.recipeInstanceId) copy.recipeInstanceId = ids.get(copy.recipeInstanceId) ?? copy.recipeInstanceId;
  if (copy.kind === 'flat_design') {
    copy.elements = copy.elements.map((element) => { const value = structuredClone(element); value.id = next(); ids.set(element.id, value.id); return value; });
  }
  if (copy.kind === 'dimensional_decoration') {
    copy.decorations = copy.decorations.map((decoration) => { const value = structuredClone(decoration); value.id = next(); ids.set(decoration.id, value.id); return value; });
  }
  return copy;
}

export function materializeVersionedRemixV2(
  source: EditorDocV7,
  intent: VersionedStudioImportIntentV2,
  deps: Pick<VersionedImportDependenciesV2,'nextId'|'now'>,
): { ok: true; doc: EditorDocV7 } | { ok: false; reason: 'id_collision'|'dependency' } {
  let now: string;
  try { now = deps.now(); }
  catch { return { ok: false, reason: 'dependency' }; }
  if (!Number.isFinite(Date.parse(now))) return { ok: false, reason: 'dependency' };
  const generated = new Set<string>();
  const fresh = (scope: 'design'|'node') => {
    const value = deps.nextId(scope);
    if (!ID.test(value) || generated.has(value)) throw new Error('id_collision');
    generated.add(value); return value;
  };
  try {
    const designId = fresh('design');
    const recipeIds = new Map<string,string>();
    const recipes: Record<string,RecipeInstanceV7> = {};
    for (const [key, recipe] of Object.entries(source.recipeInstances)) {
      const id = fresh('node'); recipeIds.set(key,id);
      recipes[id] = { ...structuredClone(recipe), instanceId: id };
    }
    const nodeIds = new Map(recipeIds);
    const nails = structuredClone(source.nails);
    for (const nail of Object.values(nails)) {
      nail.steps = nail.steps.map((step) => remapStep(step, nodeIds, () => fresh('node')));
      for (const step of nail.steps) if (step.recipeInstanceId) step.recipeInstanceId = recipeIds.get(step.recipeInstanceId) ?? step.recipeInstanceId;
      delete nail.compositionProvenance;
    }
    // Recipe refs were copied before steps; remap the original ids explicitly.
    for (const nail of Object.values(nails)) {
      for (const step of nail.steps) {
        const original = source.nails[nail.finger].steps.find((candidate) => nodeIds.get(candidate.id) === step.id);
        if (original?.recipeInstanceId) step.recipeInstanceId = recipeIds.get(original.recipeInstanceId);
      }
    }
    const candidate: EditorDocV7 = {
      schemaVersion: 7, designId, title: `${source.title} Remix`, nails,
      recipeInstances: recipes,
      sourceRefs: [{ domain: 'community', sourceId: intent.lookId, revision: intent.designVersionId }],
      communicationRefs: [], outputIntent: 'design', revision: 1, createdAt: now, updatedAt: now,
    };
    const parsed = parseEditorDocV7(candidate);
    return parsed.ok ? { ok: true, doc: parsed.doc } : { ok: false, reason: 'dependency' };
  } catch { return { ok: false, reason: 'id_collision' }; }
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
  if (!sameVersionedIntentAssetsV2(intent.assetRevisionRefs, release.designVersion.assetRevisionRefs)) return rejectFinal('asset_mismatch', 'immutable asset set changed');
  for (const asset of intent.assetRevisionRefs) {
    try { if (!await deps.assetAvailable(asset)) return { ok: false, reason: 'asset_unavailable', retryable: true, message: `asset unavailable: ${asset.assetId}` }; }
    catch { return { ok: false, reason: 'dependency', retryable: true, message: 'asset validation failed' }; }
  }
  const source = parseEditorDocV7(release.editorDocSnapshot);
  if (!source.ok || source.doc.designId !== release.designVersion.designId || source.doc.revision !== release.designVersion.revision) return rejectFinal('invalid_release', 'release snapshot invalid');
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
