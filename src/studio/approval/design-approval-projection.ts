import { readData, StorageKeys } from '@/lib/storage';
import { parseClientApprovalStoreV1, type ClientApprovalStoreV1 } from './client-approval';
import { readClientApprovalStoreV1 } from './client-approval-repository';
import { isServiceIdV1 } from '@/platform/backend/service-contract';

export type DesignApprovalProjection =
  | { status: 'APPROVED'; designVersionId: string; snapshotId: string }
  | { status: 'CHANGE_REQUESTED'; designVersionId: string; note?: string }
  | { status: 'HISTORICAL_LOCAL_CONFIRMATION' }
  | { status: 'NONE' }
  | { status: 'CORRUPTED'; reason: string };

function project(store: ClientApprovalStoreV1, designId: string): DesignApprovalProjection {
  const shares = store.shares.filter((share) => share.package.designId === designId);
  const events = store.events.filter((event) => shares.some((share) => share.shareLinkId === event.shareLinkId));
  if (new Set(events.map((event) => event.shareLinkId)).size !== events.length) return { status: 'CORRUPTED', reason: 'duplicate share decision' };
  const event = events.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  if (!event) return { status: 'NONE' };
  if (event.decision === 'APPROVED') {
    const share = shares.find((item) => item.shareLinkId === event.shareLinkId);
    const snapshot = store.snapshots.find((item) => item.snapshotId === event.snapshotId);
    if (!share || !snapshot) return { status: 'CORRUPTED', reason: 'approved event has no matching snapshot/share' };
    const expectedAssets = [share.package.cover.assetId, ...share.package.details.map((item) => item.assetId)];
    const assetsMatch = snapshot.previewAssetIds.length === 11 && expectedAssets.every((asset, index) => snapshot.previewAssetIds[index] === asset);
    if (snapshot.designId !== designId || snapshot.designVersionId !== share.designVersionId || event.designVersionId !== share.designVersionId
      || snapshot.editorDocSha256 !== share.editorDocSha256 || snapshot.rendererRevision !== share.package.rendererRevision
      || !assetsMatch || snapshot.confirmedByIdentityRef !== event.actorRef || snapshot.confirmedAt !== event.createdAt) {
      return { status: 'CORRUPTED', reason: 'approval snapshot authority mismatch' };
    }
    return { status: 'APPROVED', designVersionId: event.designVersionId, snapshotId: snapshot.snapshotId };
  }
  const share = shares.find((item) => item.shareLinkId === event.shareLinkId);
  if (!share || event.designVersionId !== share.designVersionId) return { status: 'CORRUPTED', reason: 'change request authority mismatch' };
  return { status: 'CHANGE_REQUESTED', designVersionId: event.designVersionId, ...(event.note ? { note: event.note } : {}) };
}

export function parseAuthority(raw: unknown): ClientApprovalStoreV1 | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const envelope = raw as Record<string, unknown>;
  if (Object.keys(envelope).some((key) => !['schemaVersion', 'value', 'ledger'].includes(key)) || envelope.schemaVersion !== 1) return null;
  if (!envelope.ledger || typeof envelope.ledger !== 'object' || Array.isArray(envelope.ledger)) return null;
  for (const [key, entry] of Object.entries(envelope.ledger)) {
    if (!isServiceIdV1(key) || !entry || typeof entry !== 'object' || Array.isArray(entry)) return null;
    const item = entry as Record<string, unknown>;
    if (Object.keys(item).some((field) => !['fingerprint', 'resultEtag'].includes(field))
      || typeof item.fingerprint !== 'string' || !/^fp\.v1\.[0-9a-f]{16}$/.test(item.fingerprint)
      || typeof item.resultEtag !== 'string' || !/^etag\.v1\.[0-9a-f]{16}$/.test(item.resultEtag)) return null;
  }
  return parseClientApprovalStoreV1(envelope.value);
}

/** Authority-first, fail-closed read model. Legacy is consulted only if authority is absent. */
export function readDesignApprovalProjection(designId: string): DesignApprovalProjection {
  const authority = readData<unknown>(StorageKeys.backendApprovalRepository);
  if (authority !== null) {
    const parsed = parseAuthority(authority);
    return parsed ? project(parsed, designId) : { status: 'CORRUPTED', reason: 'approval authority failed strict parse' };
  }
  const legacy = readClientApprovalStoreV1();
  return legacy.corrupted ? { status: 'CORRUPTED', reason: 'approval legacy mirror failed strict parse' } : project(legacy.store, designId);
}
