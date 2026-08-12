import { readData, StorageKeys, writeEnvelope } from '@/lib/storage';
import {
  createEmptyCreatorPublicationStoreV1, parseCreatorPublicationStoreV1,
  type CreatorPublicationResultV1, type CreatorPublicationStoreV1,
} from '../domain/v7_1/creator-publication';

export function readCreatorPublicationStoreV1(): { store: CreatorPublicationStoreV1; corrupted: boolean } {
  const raw = readData<unknown>(StorageKeys.creatorPublications);
  if (raw === null) return { store: createEmptyCreatorPublicationStoreV1(), corrupted: false };
  const parsed = parseCreatorPublicationStoreV1(raw);
  return parsed ? { store: parsed, corrupted: false } : { store: createEmptyCreatorPublicationStoreV1(), corrupted: true };
}

export function persistCreatorPublicationStoreV1(store: CreatorPublicationStoreV1): CreatorPublicationResultV1<CreatorPublicationStoreV1> {
  const parsed = parseCreatorPublicationStoreV1(store);
  if (!parsed) return { ok: false, code: 'invalid', message: 'publication store contract failed' };
  try { writeEnvelope(StorageKeys.creatorPublications, parsed); return { ok: true, value: parsed }; }
  catch { return { ok: false, code: 'persist_failed', message: 'publication storage unavailable' }; }
}
