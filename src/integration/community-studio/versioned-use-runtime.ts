/** Browser composition root for COMM-V7.1-04. Domain modules remain store-free. */

import { Routes } from '@/app/routes';
import type { PublishedLookV1 } from '@/community/domain/v7_1/design-content-model';
import {
  createVersionedIntentPortV2,
  createVersionedStudioImportIntentV2,
  type VersionedIntentStorageV2,
} from '@/community/domain/v7_1/versioned-studio-intent';
import { createClientId, readData, StorageKeys, writeEnvelope } from '@/lib/storage';
import { createEditorDocV7InLocalStorage } from '@/studio/editor/v7/repository';
import { parseEditorDocV7 } from '@/studio/editor/v7/schema';
import type { EditorDocV7 } from '@/studio/editor/v7/model';
import { representativeBackgroundColorV7, rgbaToHexV7 } from '@/studio/editor/v7/background';
import { resolveEditorGeometryV7 } from '@/studio/editor/v7/geometry-registry';
import { getDesign, removeEditorDoc, upsertDesign } from '@/studio/editor/lib/repo-v6';
import { createBrowserSha256V1 } from '@/studio/versioning/design-release';
import {
  consumeVersionedStudioImportV2,
  type LookCustomizeEventV1,
  type VersionedImportModeV2,
  type VersionedImportResultV2,
} from '@/studio/versioning/versioned-import';
import {
  CANONICAL_USE_DEMO_LOOK_ID,
  CANONICAL_USE_DEMO_PUBLISHED_LOOK_V1,
  CANONICAL_USE_DEMO_RELEASE_RECORD_V1,
} from './canonical-use-demo';

const intentStorage: VersionedIntentStorageV2 = {
  read: () => readData<Record<string, unknown>>(StorageKeys.versionedStudioImportIntents) ?? {},
  write: (next) => { writeEnvelope(StorageKeys.versionedStudioImportIntents, next); },
};

const nowMs = () => Date.now();
export const versionedIntentPortV2 = createVersionedIntentPortV2(intentStorage, nowMs);

export type CreateVersionedUseIntentResultV1 =
  | { ok: true; intentId: string; href: string }
  | { ok: false; reason: string };

export function createVersionedUseIntentForLookV1(look: PublishedLookV1): CreateVersionedUseIntentResultV1 {
  if (look.lookId !== CANONICAL_USE_DEMO_LOOK_ID
    || look.designVersionId !== CANONICAL_USE_DEMO_RELEASE_RECORD_V1.designVersion.designVersionId) {
    return { ok: false, reason: 'release_unavailable' };
  }
  const result = createVersionedStudioImportIntentV2(
    { look, designVersion: CANONICAL_USE_DEMO_RELEASE_RECORD_V1.designVersion, returnTo: Routes.communityLook(look.lookId) },
    { storage: intentStorage, nextId: () => createClientId('intent.v2.'), nowMs },
  );
  if (!result.ok) return result;
  const query = new URLSearchParams({ versionedIntent: result.intent.intentId });
  return { ok: true, intentId: result.intent.intentId, href: `${Routes.designNew}?${query.toString()}` };
}

function deterministicIds(intentId: string) {
  let node = 0;
  return (scope: 'design' | 'node') => scope === 'design'
    ? `design.remix.${intentId}`
    : `node.remix.${++node}.${intentId}`;
}

function readExistingTarget(designId: string) {
  const raw = readData<Record<string, unknown>>(StorageKeys.editorDocs)?.[designId];
  return parseEditorDocV7(raw);
}

function ensureEditableSummary(doc: EditorDocV7): void {
  if (getDesign(doc.designId)) return;
  const nail = doc.nails.L1;
  const geometry = resolveEditorGeometryV7(nail.geometryRef, 'L1');
  if (geometry.status !== 'resolved' || geometry.fidelity !== 'exact') {
    throw new Error('persisted remix has no signed-off L1 geometry');
  }
  const background = nail.steps[0];
  const finish = nail.steps[nail.steps.length - 1];
  if (background?.kind !== 'background' || finish?.kind !== 'surface_finish') {
    throw new Error('persisted remix has no canonical background/finish');
  }
  upsertDesign({
    id: doc.designId,
    customerId: doc.customerRef ?? '',
    title: doc.title,
    shape: geometry.shape,
    length: geometry.length,
    baseColor: rgbaToHexV7(representativeBackgroundColorV7(background.background)),
    // DesignSummary is a legacy list index and cannot represent `frosted`.
    // Map it to matte for list filtering only; EditorDocV7 remains canonical.
    finish: finish.finish.type === 'frosted' ? 'matte' : finish.finish.type,
    status: 'draft',
    source: 'editor',
    version: 1,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  });
}

function recordLookCustomizeEventV1(event: LookCustomizeEventV1): void {
  const current = readData<Record<string, LookCustomizeEventV1>>(StorageKeys.lookCustomizeEvents) ?? {};
  const previous = current[event.eventId];
  if (previous) {
    if (previous.lookId !== event.lookId || previous.designVersionId !== event.designVersionId
      || previous.targetDesignId !== event.targetDesignId) throw new Error('event id conflict');
    return;
  }
  writeEnvelope(StorageKeys.lookCustomizeEvents, { ...current, [event.eventId]: structuredClone(event) });
}

export function readLookCustomizeEventsV1(): LookCustomizeEventV1[] {
  return Object.values(readData<Record<string, LookCustomizeEventV1>>(StorageKeys.lookCustomizeEvents) ?? {})
    .map((event) => structuredClone(event));
}

export async function consumeVersionedUseIntentV2(
  intentId: string,
  mode: VersionedImportModeV2,
): Promise<VersionedImportResultV2> {
  const nextId = deterministicIds(intentId);
  const sha256 = createBrowserSha256V1();
  const result = await consumeVersionedStudioImportV2(intentId, mode, {
    intents: versionedIntentPortV2,
    getLook: async (lookId) => lookId === CANONICAL_USE_DEMO_LOOK_ID
      ? structuredClone(CANONICAL_USE_DEMO_PUBLISHED_LOOK_V1)
      : null,
    getRelease: async (versionId) => versionId === CANONICAL_USE_DEMO_RELEASE_RECORD_V1.designVersion.designVersionId
      ? structuredClone(CANONICAL_USE_DEMO_RELEASE_RECORD_V1)
      : null,
    sha256,
    canReadLook: async (look) => look.visibility === 'PUBLIC' && look.status === 'PUBLISHED',
    assetAvailable: async (asset) => CANONICAL_USE_DEMO_RELEASE_RECORD_V1.designVersion.assetRevisionRefs.some((candidate) => (
      candidate.assetId === asset.assetId && candidate.revision === asset.revision
      && candidate.sha256 === asset.sha256 && candidate.mimeType === asset.mimeType
    )),
    createTarget: async ({ intentId: exactIntentId, doc }) => {
      const existing = readExistingTarget(doc.designId);
      if (existing.ok) {
        const matches = existing.doc.sourceRefs.some((ref) => ref.domain === 'community'
          && ref.sourceId === CANONICAL_USE_DEMO_LOOK_ID
          && ref.revision === CANONICAL_USE_DEMO_RELEASE_RECORD_V1.designVersion.designVersionId);
        if (!matches) return { ok: false, message: `target collision for ${exactIntentId}` };
        try { ensureEditableSummary(existing.doc); }
        catch { return { ok: false, message: 'target summary recovery failed' }; }
        return { ok: true, created: false, doc: existing.doc };
      }
      const created = createEditorDocV7InLocalStorage(doc);
      if (!created.ok) return { ok: false, message: created.message };
      try { ensureEditableSummary(created.doc); }
      catch {
        try { removeEditorDoc(created.doc.designId); } catch { /* preserve original summary failure */ }
        return { ok: false, message: 'target summary write failed' };
      }
      return { ok: true, created: true, doc: created.doc };
    },
    nextId,
    now: () => new Date().toISOString(),
  });
  if (result.ok && result.mode === 'new') {
    try { recordLookCustomizeEventV1(result.event); }
    catch { /* COMM-08 will provide durable analytics delivery; creation remains authoritative. */ }
    if (typeof globalThis.dispatchEvent === 'function' && typeof globalThis.CustomEvent === 'function') {
      globalThis.dispatchEvent(new CustomEvent('community:look-customize', { detail: structuredClone(result.event) }));
    }
  }
  return result;
}
