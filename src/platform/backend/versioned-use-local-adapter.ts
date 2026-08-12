/** LOCAL_PROTOTYPE adapters for versioned Community → Studio use. */
import {
  createVersionedIntentPortV2,
  type VersionedIntentStorageV2,
} from '@/community/domain/v7_1/versioned-studio-intent';
import { createClientId, readData, StorageKeys, writeEnvelope } from '@/lib/storage';
import { representativeBackgroundColorV7, rgbaToHexV7 } from '@/studio/editor/v7/background';
import { resolveEditorGeometryV7 } from '@/studio/editor/v7/geometry-registry';
import type { EditorDocV7 } from '@/studio/editor/v7/model';
import { createEditorDocV7InLocalStorage } from '@/studio/editor/v7/repository';
import { parseEditorDocV7 } from '@/studio/editor/v7/schema';
import { getDesign, removeEditorDoc, upsertDesign } from '@/studio/editor/lib/repo-v6';
import { canonicalJsonV1 } from '@/studio/versioning/design-release';
import type { LookCustomizeEventV1 } from '@/studio/versioning/versioned-import';
import { BACKEND_PERMISSIONS_V1 } from './domain-ports';
import {
  isServiceIdV1,
  isServiceTimestampV1,
  requireServicePermissionV1,
  serviceErrorV1,
} from './service-contract';
import type { VersionedUsePersistencePortV1 } from './versioned-use-contract';

const intentStorage: VersionedIntentStorageV2 = {
  read: () => readData<Record<string, unknown>>(StorageKeys.versionedStudioImportIntents) ?? {},
  write: (next) => { writeEnvelope(StorageKeys.versionedStudioImportIntents, next); },
};

/**
 * Browser-local, synchronous handoff used only inside a trusted click gesture.
 * This is not presented as a remote backend port; cross-origin handoff remains
 * disabled until a server broker exists.
 */
export const localTrustedGestureIntentHandoffV2 = {
  adapterKind: 'LOCAL_PROTOTYPE' as const,
  storage: intentStorage,
  nextIntentId: () => createClientId('intent.v2.'),
  nowMs: () => Date.now(),
};

export const localVersionedIntentPortV2 = createVersionedIntentPortV2(intentStorage, () => Date.now());

function ensureEditableSummary(doc: EditorDocV7): void {
  if (getDesign(doc.designId)) return;
  const nail = doc.nails.L1;
  const geometry = resolveEditorGeometryV7(nail.geometryRef, 'L1');
  if (geometry.status !== 'resolved' || geometry.fidelity !== 'exact') throw new Error('geometry unavailable');
  const background = nail.steps[0]; const finish = nail.steps[nail.steps.length - 1];
  if (background?.kind !== 'background' || finish?.kind !== 'surface_finish') throw new Error('canonical steps unavailable');
  upsertDesign({
    id: doc.designId, customerId: doc.customerRef ?? '', title: doc.title, shape: geometry.shape, length: geometry.length,
    baseColor: rgbaToHexV7(representativeBackgroundColorV7(background.background)),
    finish: finish.finish.type === 'frosted' ? 'matte' : finish.finish.type,
    status: 'draft', source: 'editor', version: 1, createdAt: doc.createdAt, updatedAt: doc.updatedAt,
  });
}

function parseCustomizeEvent(value: unknown): LookCustomizeEventV1 | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  const keys = ['event', 'eventId', 'lookId', 'designVersionId', 'targetDesignId', 'occurredAt'];
  if (Object.keys(raw).length !== keys.length || Object.keys(raw).some((key) => !keys.includes(key))
    || raw.event !== 'look_customize' || !isServiceIdV1(raw.eventId)
    || !isServiceIdV1(raw.lookId) || !isServiceIdV1(raw.designVersionId)
    || !isServiceIdV1(raw.targetDesignId) || !isServiceTimestampV1(raw.occurredAt)) return null;
  return structuredClone(value) as LookCustomizeEventV1;
}

function readEventRecord(): ReturnType<typeof serviceErrorV1> | { ok: true; value: Record<string, LookCustomizeEventV1> } {
  try {
    const raw = readData<unknown>(StorageKeys.lookCustomizeEvents);
    if (raw === null) return { ok: true, value: {} };
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return serviceErrorV1('DATA_CORRUPTED', 'versioned_use.events_corrupted');
    const parsed: Record<string, LookCustomizeEventV1> = {};
    for (const [key, value] of Object.entries(raw)) {
      const event = parseCustomizeEvent(value);
      if (!event || key !== event.eventId) return serviceErrorV1('DATA_CORRUPTED', 'versioned_use.events_corrupted');
      parsed[key] = event;
    }
    return { ok: true, value: parsed };
  } catch { return serviceErrorV1('UNAVAILABLE', 'versioned_use.events_read_failed', true); }
}

export function createLocalVersionedUsePersistencePortV1(): VersionedUsePersistencePortV1 {
  return {
    adapterKind: 'LOCAL_PROTOTYPE',
    async createTarget(context, command) {
      const allowed = requireServicePermissionV1(context, BACKEND_PERMISSIONS_V1.versionedUseWrite);
      if (!allowed.ok) return allowed;
      if (!isServiceIdV1(command.intentId) || !isServiceIdV1(command.sourceLookId)
        || !isServiceIdV1(command.sourceDesignVersionId)) {
        return serviceErrorV1('INVALID', 'versioned_use.invalid_target_command', false, context.correlationId);
      }
      const parsed = parseEditorDocV7(command.doc);
      if (!parsed.ok) return serviceErrorV1('INVALID', 'versioned_use.invalid_editor_doc', false, context.correlationId);
      const lineage = parsed.doc.sourceRefs.some((ref) => ref.domain === 'community'
        && ref.sourceId === command.sourceLookId && ref.revision === command.sourceDesignVersionId);
      if (!lineage) return serviceErrorV1('PRECONDITION_FAILED', 'versioned_use.lineage_mismatch', false, context.correlationId);
      try {
        const existing = parseEditorDocV7(readData<Record<string, unknown>>(StorageKeys.editorDocs)?.[parsed.doc.designId]);
        if (existing.ok) {
          const matches = existing.doc.sourceRefs.some((ref) => ref.domain === 'community'
            && ref.sourceId === command.sourceLookId && ref.revision === command.sourceDesignVersionId);
          if (!matches) return serviceErrorV1('CONFLICT', 'versioned_use.target_collision', false, context.correlationId);
          if (canonicalJsonV1(existing.doc) !== canonicalJsonV1(parsed.doc)) {
            return serviceErrorV1('IDEMPOTENCY_CONFLICT', 'versioned_use.target_replay_mismatch', false, context.correlationId);
          }
          try { ensureEditableSummary(existing.doc); }
          catch { return serviceErrorV1('UNAVAILABLE', 'versioned_use.summary_recovery_failed', true, context.correlationId); }
          return { ok: true, value: { created: false, doc: existing.doc }, changed: false };
        }
        const created = createEditorDocV7InLocalStorage(parsed.doc);
        if (!created.ok) return serviceErrorV1('UNAVAILABLE', 'versioned_use.target_write_failed', true, context.correlationId);
        try { ensureEditableSummary(created.doc); }
        catch {
          try { removeEditorDoc(created.doc.designId); } catch { /* best-effort rollback */ }
          return serviceErrorV1('UNAVAILABLE', 'versioned_use.summary_write_failed', true, context.correlationId);
        }
        return { ok: true, value: { created: true, doc: created.doc }, changed: true };
      } catch { return serviceErrorV1('UNAVAILABLE', 'versioned_use.target_storage_failed', true, context.correlationId); }
    },
    async recordEvent(context, event) {
      const allowed = requireServicePermissionV1(context, BACKEND_PERMISSIONS_V1.versionedUseWrite);
      if (!allowed.ok) return allowed;
      const parsed = parseCustomizeEvent(event);
      if (!parsed) return serviceErrorV1('INVALID', 'versioned_use.invalid_event', false, context.correlationId);
      const current = readEventRecord(); if (!current.ok) return current;
      const previous = current.value[parsed.eventId];
      if (previous) {
        if (JSON.stringify(previous) !== JSON.stringify(parsed)) {
          return serviceErrorV1('CONFLICT', 'versioned_use.event_id_reused', false, context.correlationId);
        }
        return { ok: true, value: previous, changed: false };
      }
      try { writeEnvelope(StorageKeys.lookCustomizeEvents, { ...current.value, [parsed.eventId]: parsed }); }
      catch { return serviceErrorV1('UNAVAILABLE', 'versioned_use.event_write_failed', true, context.correlationId); }
      return { ok: true, value: parsed, changed: true };
    },
    async readEvents(context) {
      const allowed = requireServicePermissionV1(context, BACKEND_PERMISSIONS_V1.versionedUseRead);
      if (!allowed.ok) return allowed;
      const current = readEventRecord();
      return current.ok
        ? { ok: true, value: Object.values(current.value).map((event) => structuredClone(event)), changed: false }
        : current;
    },
  };
}
