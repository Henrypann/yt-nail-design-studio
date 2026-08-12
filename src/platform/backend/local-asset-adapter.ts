import { readData, StorageKeys, writeEnvelope } from '@/lib/storage';
import {
  parseAssetUploadRecordV1,
  validateAssetUploadInputV1,
  type AssetUploadInputV1,
  type AssetUploadPortV1,
  type AssetUploadRecordV1,
} from './asset-contract';
import { BACKEND_PERMISSIONS_V1 } from './domain-ports';
import { requireServicePermissionV1, serviceErrorV1, type ServiceResultV1 } from './service-contract';

interface AssetRecordStoreV1 {
  schemaVersion: 1;
  records: AssetUploadRecordV1[];
}

export interface AssetBinaryStorageV1 {
  put(key: string, bytes: Uint8Array): Promise<void>;
  get(key: string): Promise<Uint8Array | null>;
  remove(key: string): Promise<void>;
}

function binaryKey(assetId: string, revision: number): string { return `${assetId}#${revision}`; }

function parseStore(value: unknown): AssetRecordStoreV1 | null {
  if (value === null) return { schemaVersion: 1, records: [] };
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  if (Object.keys(raw).some((key) => !['schemaVersion', 'records'].includes(key))
    || raw.schemaVersion !== 1 || !Array.isArray(raw.records)) return null;
  const records: AssetUploadRecordV1[] = [];
  const uploadIds = new Set<string>();
  const assets = new Set<string>();
  for (const value of raw.records) {
    const record = parseAssetUploadRecordV1(value);
    if (!record || uploadIds.has(record.uploadId) || assets.has(binaryKey(record.object.assetId, record.object.revision))) return null;
    uploadIds.add(record.uploadId);
    assets.add(binaryKey(record.object.assetId, record.object.revision));
    records.push(record);
  }
  return { schemaVersion: 1, records };
}

function sameUpload(existing: AssetUploadRecordV1, input: AssetUploadInputV1): boolean {
  return existing.ownerRef === input.ownerRef && existing.purpose === input.purpose
    && existing.object.assetId === input.assetId && existing.object.revision === 1
    && existing.object.sha256 === input.sha256 && existing.object.mimeType === input.mimeType
    && existing.object.byteLength === input.byteLength && existing.object.width === input.width
    && existing.object.height === input.height && existing.object.colorSpace === input.colorSpace
    && existing.object.alphaMode === input.alphaMode;
}

export function createInMemoryAssetBinaryStorageV1(): AssetBinaryStorageV1 {
  const values = new Map<string, Uint8Array>();
  return {
    async put(key, bytes) { values.set(key, Uint8Array.from(bytes)); },
    async get(key) { const value = values.get(key); return value ? Uint8Array.from(value) : null; },
    async remove(key) { values.delete(key); },
  };
}

export function createIndexedDbAssetBinaryStorageV1(): AssetBinaryStorageV1 {
  const open = (): Promise<IDBDatabase> => new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') { reject(new Error('indexeddb unavailable')); return; }
    const request = indexedDB.open('nextgen-beauty-assets-v1', 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains('bytes')) request.result.createObjectStore('bytes');
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('indexeddb open failed'));
  });
  const transaction = async <T>(mode: IDBTransactionMode, run: (store: IDBObjectStore, done: (value: T) => void, fail: (reason: unknown) => void) => void): Promise<T> => {
    const db = await open();
    return new Promise<T>((resolve, reject) => {
      const tx = db.transaction('bytes', mode);
      let result: T;
      let hasResult = false;
      run(tx.objectStore('bytes'), (value) => { result = value; hasResult = true; }, reject);
      tx.oncomplete = () => { db.close(); if (hasResult) resolve(result!); };
      tx.onerror = () => { db.close(); reject(tx.error ?? new Error('indexeddb transaction failed')); };
      tx.onabort = () => { db.close(); reject(tx.error ?? new Error('indexeddb transaction aborted')); };
    });
  };
  return {
    put: (key, bytes) => transaction<void>('readwrite', (store, done, fail) => {
      const request = store.put(Uint8Array.from(bytes), key);
      request.onsuccess = () => done(); request.onerror = () => fail(request.error);
    }),
    get: (key) => transaction<Uint8Array | null>('readonly', (store, done, fail) => {
      const request = store.get(key);
      request.onsuccess = () => {
        const result = request.result;
        done(result instanceof Uint8Array ? Uint8Array.from(result) : result instanceof ArrayBuffer ? new Uint8Array(result) : null);
      };
      request.onerror = () => fail(request.error);
    }),
    remove: (key) => transaction<void>('readwrite', (store, done, fail) => {
      const request = store.delete(key);
      request.onsuccess = () => done(); request.onerror = () => fail(request.error);
    }),
  };
}

export function createLocalAssetUploadPortV1(input: {
  binary: AssetBinaryStorageV1;
  sha256(bytes: Uint8Array): Promise<string>;
  readMetadata?: () => unknown | null;
  writeMetadata?: (store: AssetRecordStoreV1) => void;
}): AssetUploadPortV1 {
  const readMetadata = input.readMetadata ?? (() => readData<unknown>(StorageKeys.backendAssetRecords));
  const writeMetadata = input.writeMetadata ?? ((store: AssetRecordStoreV1) => { writeEnvelope(StorageKeys.backendAssetRecords, store); });
  const readStore = (correlationId?: string): ServiceResultV1<AssetRecordStoreV1> => {
    try {
      const store = parseStore(readMetadata());
      return store
        ? { ok: true, value: store, changed: false }
        : serviceErrorV1('DATA_CORRUPTED', 'asset.metadata_store_corrupted', false, correlationId);
    } catch { return serviceErrorV1('UNAVAILABLE', 'asset.metadata_read_failed', true, correlationId); }
  };
  return {
    adapterKind: 'LOCAL_PROTOTYPE',
    async upload(context, upload) {
      const allowed = requireServicePermissionV1(context, BACKEND_PERMISSIONS_V1.assetWrite);
      if (!allowed.ok) return allowed;
      if (context.actor.actorRef !== upload.ownerRef) {
        return serviceErrorV1('FORBIDDEN', 'asset.owner_mismatch', false, context.correlationId);
      }
      const store = readStore(context.correlationId);
      if (!store.ok) return store;
      const existingUpload = store.value.records.find((record) => record.uploadId === upload.uploadId);
      if (existingUpload) {
        return sameUpload(existingUpload, upload)
          ? { ok: true, value: existingUpload, changed: false }
          : serviceErrorV1('CONFLICT', 'asset.upload_id_reused', false, context.correlationId);
      }
      if (store.value.records.some((record) => record.object.assetId === upload.assetId && record.object.revision === 1)) {
        return serviceErrorV1('CONFLICT', 'asset.revision_exists', false, context.correlationId);
      }
      const validated = await validateAssetUploadInputV1(upload, input.sha256, context.correlationId);
      if (!validated.ok) return validated;
      const record: AssetUploadRecordV1 = {
        schemaVersion: 1,
        uploadId: upload.uploadId,
        ownerRef: upload.ownerRef,
        purpose: upload.purpose,
        fileName: upload.fileName,
        status: 'READY',
        object: {
          assetId: upload.assetId,
          revision: 1,
          sha256: upload.sha256,
          mimeType: upload.mimeType,
          byteLength: upload.byteLength,
          width: upload.width,
          height: upload.height,
          colorSpace: upload.colorSpace,
          alphaMode: upload.alphaMode,
        },
        source: structuredClone(upload.source),
        copyrightDeclared: upload.copyrightDeclared,
        moderationStatus: upload.moderationStatus,
        createdAt: context.now,
        updatedAt: context.now,
      };
      const parsed = parseAssetUploadRecordV1(record);
      if (!parsed) return serviceErrorV1('INVALID', 'asset.record_contract_failed', false, context.correlationId);
      const key = binaryKey(upload.assetId, 1);
      try {
        await input.binary.put(key, upload.bytes);
        writeMetadata({ schemaVersion: 1, records: [...store.value.records, parsed] });
      } catch {
        try { await input.binary.remove(key); } catch { /* preserve primary failure */ }
        return serviceErrorV1('UNAVAILABLE', 'asset.local_write_failed', true, context.correlationId);
      }
      return { ok: true, value: parsed, changed: true };
    },
    async get(context, assetId, revision) {
      const allowed = requireServicePermissionV1(context, BACKEND_PERMISSIONS_V1.assetRead);
      if (!allowed.ok) return allowed;
      const store = readStore(context.correlationId);
      if (!store.ok) return store;
      const record = store.value.records.find((candidate) => candidate.object.assetId === assetId && candidate.object.revision === revision);
      return record
        ? { ok: true, value: structuredClone(record), changed: false }
        : serviceErrorV1('NOT_FOUND', 'asset.not_found', false, context.correlationId);
    },
    async readBytes(context, assetId, revision) {
      const record = await this.get(context, assetId, revision);
      if (!record.ok) return record;
      try {
        const bytes = await input.binary.get(binaryKey(assetId, revision));
        if (!bytes) return serviceErrorV1('DATA_CORRUPTED', 'asset.bytes_missing', false, context.correlationId);
        const digest = await input.sha256(bytes);
        if (digest !== record.value.object.sha256 || bytes.byteLength !== record.value.object.byteLength) {
          return serviceErrorV1('INTEGRITY_MISMATCH', 'asset.bytes_integrity_failed', false, context.correlationId);
        }
        return { ok: true, value: bytes, changed: false };
      } catch { return serviceErrorV1('UNAVAILABLE', 'asset.local_read_failed', true, context.correlationId); }
    },
  };
}
