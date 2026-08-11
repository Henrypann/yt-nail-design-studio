import type {
  DesignVersionV1,
  ImmutableAssetRevisionRefV1,
} from '@/community/domain/v7_1/design-content-model';
import { parseDesignVersionV1 } from '@/community/domain/v7_1/design-content-parse';
import { FINGER_CODES, type FingerCode } from '@/lib/types';
import type {
  AssetRefV7,
  DesignSourceRefV1,
  EditorDocV7,
  MaterialRefV7,
  TenFingerCompositionRefV1,
} from '@/studio/editor/v7/model';
import { parseEditorDocV7 } from '@/studio/editor/v7/schema';

export const DESIGN_RELEASE_STORE_SCHEMA_VERSION = 1 as const;
export const DESIGN_RELEASE_STORE_KIND = 'STUDIO_DESIGN_RELEASE_STORE' as const;
export const RENDERER_EVIDENCE_UNAVAILABLE = 'UNAVAILABLE_IN_EDITORDOC_V7' as const;

export interface ReleasedGeometryRefV1 {
  finger: FingerCode;
  assetId: string;
  revision: string;
}

export interface ReleasedMaterialRefV1 {
  materialId: string;
  revision: string;
}

export interface ReleasedRecipeRefV1 {
  recipeId: string;
  revision: string;
}

export interface ReleasedCompositionProvenanceV1 {
  finger: FingerCode;
  compositionId: string;
  revision: string;
  syncState: 'linked' | 'detached';
}

export interface DesignReleaseManifestV1 {
  schemaVersion: 1;
  geometryRefs: ReleasedGeometryRefV1[];
  assetRevisionRefs: ImmutableAssetRevisionRefV1[];
  materialRevisionRefs: ReleasedMaterialRefV1[];
  recipeRevisionRefs: ReleasedRecipeRefV1[];
  sourceRefs: DesignSourceRefV1[];
  compositionMeta?: TenFingerCompositionRefV1;
  compositionProvenance: ReleasedCompositionProvenanceV1[];
  rendererEvidence: typeof RENDERER_EVIDENCE_UNAVAILABLE;
}

/** Private Studio record. The public DesignVersion never embeds this snapshot. */
export interface DesignReleaseRecordV1 {
  schemaVersion: 1;
  designVersion: DesignVersionV1;
  manifest: DesignReleaseManifestV1;
  editorDocSnapshot: EditorDocV7;
}

export interface DesignReleaseStoreV1 {
  schemaVersion: 1;
  kind: typeof DESIGN_RELEASE_STORE_KIND;
  records: DesignReleaseRecordV1[];
}

export interface DesignReleaseRuntimeGuardV1 {
  saveState: 'saved' | 'dirty' | 'saving' | 'error';
  savedRevision: number;
  pendingRevision: number | null;
}

export interface DesignReleaseStorageV1 {
  read(): string | null;
  write(value: string): void | Promise<void>;
}

export interface DesignReleaseDependenciesV1 {
  storage: DesignReleaseStorageV1;
  readPersistedEditorDoc(designId: string): unknown;
  sha256(value: string): Promise<string>;
  nextId(): string;
  now(): string;
  releasedByIdentityId(): string | null;
  /** Test hook for a source race; production leaves it undefined. */
  beforeSourceRecheck?: () => void | Promise<void>;
}

export type DesignReleaseErrorCodeV1 =
  | 'not_saved'
  | 'revision_mismatch'
  | 'source_missing'
  | 'legacy_source_unsupported'
  | 'future_source_unsupported'
  | 'invalid_source'
  | 'unsupported_asset_revision'
  | 'conflicting_reference'
  | 'storage_corrupted'
  | 'stale_source'
  | 'stale_release_store'
  | 'identity_unavailable'
  | 'dependency_unavailable'
  | 'write_failed';

export type DesignReleaseResultV1 =
  | { ok: true; created: boolean; record: DesignReleaseRecordV1 }
  | { ok: false; code: DesignReleaseErrorCodeV1; message: string };

type UnknownRecord = Record<string, unknown>;

const SHA256 = /^[0-9a-f]{64}$/;
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;
const ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;

function isRecord(value: unknown): value is UnknownRecord {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function exactKeys(value: UnknownRecord, keys: readonly string[]): boolean {
  return Object.keys(value).every((key) => keys.includes(key));
}

export function canonicalJsonV1(value: unknown): string {
  const visit = (input: unknown): unknown => {
    if (Array.isArray(input)) return input.map(visit);
    if (isRecord(input)) {
      const result: UnknownRecord = {};
      for (const key of Object.keys(input).sort()) result[key] = visit(input[key]);
      return result;
    }
    return input;
  };
  return JSON.stringify(visit(value));
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function numericAssetRevision(revision: string): number | null {
  if (!/^[1-9]\d*$/.test(revision)) return null;
  const parsed = Number(revision);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

function assetLike(value: unknown): value is AssetRefV7 {
  if (!isRecord(value)) return false;
  return typeof value.assetId === 'string'
    && typeof value.revision === 'string'
    && typeof value.kind === 'string'
    && typeof value.mimeType === 'string'
    && typeof value.sha256 === 'string';
}

function materialLike(value: unknown): value is MaterialRefV7 {
  if (!isRecord(value)) return false;
  return typeof value.materialId === 'string'
    && typeof value.revision === 'string'
    && !('assetId' in value);
}

function collectDeep(
  value: unknown,
  assets: AssetRefV7[],
  materials: MaterialRefV7[],
  seen = new WeakSet<object>(),
): void {
  if (value === null || typeof value !== 'object') return;
  if (seen.has(value)) return;
  seen.add(value);
  if (assetLike(value)) assets.push(clone(value));
  if (materialLike(value)) materials.push(clone(value));
  if (Array.isArray(value)) {
    value.forEach((item) => collectDeep(item, assets, materials, seen));
  } else {
    Object.values(value).forEach((item) => collectDeep(item, assets, materials, seen));
  }
}

function dedupeByKey<T>(
  values: T[],
  keyOf: (value: T) => string,
): { ok: true; values: T[] } | { ok: false; key: string } {
  const byKey = new Map<string, string>();
  const result: T[] = [];
  for (const value of values) {
    const key = keyOf(value);
    const serialized = canonicalJsonV1(value);
    const previous = byKey.get(key);
    if (previous !== undefined && previous !== serialized) return { ok: false, key };
    if (previous === undefined) {
      byKey.set(key, serialized);
      result.push(value);
    }
  }
  result.sort((a, b) => keyOf(a).localeCompare(keyOf(b)));
  return { ok: true, values: result };
}

export function buildDesignReleaseManifestV1(
  doc: EditorDocV7,
): { ok: true; manifest: DesignReleaseManifestV1 } | { ok: false; code: 'unsupported_asset_revision' | 'conflicting_reference'; message: string } {
  const geometryRefs = FINGER_CODES.map((finger) => ({ finger, ...clone(doc.nails[finger].geometryRef) }));
  const assets: AssetRefV7[] = [];
  const materials: MaterialRefV7[] = [];
  collectDeep(doc, assets, materials);

  const immutableAssets: ImmutableAssetRevisionRefV1[] = [];
  for (const asset of assets) {
    const revision = numericAssetRevision(asset.revision);
    if (revision === null) {
      return {
        ok: false,
        code: 'unsupported_asset_revision',
        message: `asset ${asset.assetId} has non-canonical numeric revision ${asset.revision}`,
      };
    }
    immutableAssets.push({
      assetId: asset.assetId,
      revision,
      sha256: asset.sha256,
      mimeType: asset.mimeType,
    });
  }
  const assetResult = dedupeByKey(immutableAssets, (value) => `${value.assetId}#${value.revision}`);
  const materialResult = dedupeByKey(materials, (value) => `${value.materialId}#${value.revision}`);
  const recipeResult = dedupeByKey(
    Object.values(doc.recipeInstances).map((recipe) => ({ recipeId: recipe.recipeId, revision: recipe.recipeRevision })),
    (value) => `${value.recipeId}#${value.revision}`,
  );
  if (!assetResult.ok) return { ok: false, code: 'conflicting_reference', message: `conflicting immutable reference ${assetResult.key}` };
  if (!materialResult.ok) return { ok: false, code: 'conflicting_reference', message: `conflicting immutable reference ${materialResult.key}` };
  if (!recipeResult.ok) return { ok: false, code: 'conflicting_reference', message: `conflicting immutable reference ${recipeResult.key}` };
  const sourceResult = dedupeByKey(clone(doc.sourceRefs), (value) => `${value.domain}#${value.sourceId}#${value.revision ?? ''}`);
  if (!sourceResult.ok) return { ok: false, code: 'conflicting_reference', message: `conflicting immutable reference ${sourceResult.key}` };
  return {
    ok: true,
    manifest: {
      schemaVersion: 1,
      geometryRefs,
      assetRevisionRefs: assetResult.values,
      materialRevisionRefs: materialResult.values,
      recipeRevisionRefs: recipeResult.values,
      sourceRefs: sourceResult.values,
      compositionMeta: doc.compositionMeta ? clone(doc.compositionMeta) : undefined,
      compositionProvenance: FINGER_CODES.flatMap((finger) => {
        const provenance = doc.nails[finger].compositionProvenance;
        return provenance ? [{ finger, ...clone(provenance) }] : [];
      }),
      rendererEvidence: RENDERER_EVIDENCE_UNAVAILABLE,
    },
  };
}

function parseManifest(value: unknown): DesignReleaseManifestV1 | null {
  if (!isRecord(value) || !exactKeys(value, [
    'schemaVersion', 'geometryRefs', 'assetRevisionRefs', 'materialRevisionRefs',
    'recipeRevisionRefs', 'sourceRefs', 'compositionMeta', 'compositionProvenance', 'rendererEvidence',
  ])) return null;
  if (value.schemaVersion !== 1 || value.rendererEvidence !== RENDERER_EVIDENCE_UNAVAILABLE) return null;
  if (!Array.isArray(value.geometryRefs) || value.geometryRefs.length !== FINGER_CODES.length) return null;
  for (let index = 0; index < FINGER_CODES.length; index += 1) {
    const ref = value.geometryRefs[index];
    if (!isRecord(ref) || !exactKeys(ref, ['finger', 'assetId', 'revision'])
      || ref.finger !== FINGER_CODES[index] || typeof ref.assetId !== 'string' || typeof ref.revision !== 'string') return null;
  }
  if (!Array.isArray(value.assetRevisionRefs) || !Array.isArray(value.materialRevisionRefs)
    || !Array.isArray(value.recipeRevisionRefs) || !Array.isArray(value.sourceRefs)
    || !Array.isArray(value.compositionProvenance)) return null;
  const publicProbe: DesignVersionV1 = {
    schemaVersion: 1,
    designVersionId: 'probe', designId: 'probe', version: 1, revision: 1,
    editorDocRef: { designId: 'probe', schemaVersion: 7, revision: 1, sha256: 'a'.repeat(64) },
    releasedByIdentityId: 'probe', releasedAt: '2026-01-01T00:00:00.000Z',
    assetRevisionRefs: value.assetRevisionRefs as ImmutableAssetRevisionRefV1[],
  };
  if (!parseDesignVersionV1(publicProbe).ok) return null;
  return clone(value) as unknown as DesignReleaseManifestV1;
}

export function parseDesignReleaseStoreV1(value: unknown): { ok: true; store: DesignReleaseStoreV1 } | { ok: false; reason: string } {
  if (!isRecord(value) || !exactKeys(value, ['schemaVersion', 'kind', 'records'])
    || value.schemaVersion !== 1 || value.kind !== DESIGN_RELEASE_STORE_KIND || !Array.isArray(value.records)) {
    return { ok: false, reason: 'invalid release store envelope' };
  }
  const records: DesignReleaseRecordV1[] = [];
  const ids = new Set<string>();
  const releaseKeys = new Set<string>();
  for (const raw of value.records) {
    if (!isRecord(raw) || !exactKeys(raw, ['schemaVersion', 'designVersion', 'manifest', 'editorDocSnapshot']) || raw.schemaVersion !== 1) {
      return { ok: false, reason: 'invalid release record' };
    }
    const version = parseDesignVersionV1(raw.designVersion);
    const doc = parseEditorDocV7(raw.editorDocSnapshot);
    const manifest = parseManifest(raw.manifest);
    if (!version.ok || !doc.ok || !manifest) return { ok: false, reason: 'invalid release record payload' };
    if (version.value.designId !== doc.doc.designId || version.value.revision !== doc.doc.revision
      || canonicalJsonV1(version.value.assetRevisionRefs) !== canonicalJsonV1(manifest.assetRevisionRefs)) {
      return { ok: false, reason: 'release record reference mismatch' };
    }
    const derivedManifest = buildDesignReleaseManifestV1(doc.doc);
    if (!derivedManifest.ok || canonicalJsonV1(derivedManifest.manifest) !== canonicalJsonV1(manifest)) {
      return { ok: false, reason: 'release manifest does not match immutable snapshot' };
    }
    const id = version.value.designVersionId;
    const releaseKey = `${version.value.designId}#${version.value.revision}`;
    if (ids.has(id) || releaseKeys.has(releaseKey)) return { ok: false, reason: 'duplicate release record' };
    ids.add(id); releaseKeys.add(releaseKey);
    records.push({ schemaVersion: 1, designVersion: version.value, manifest, editorDocSnapshot: doc.doc });
  }
  return { ok: true, store: { schemaVersion: 1, kind: DESIGN_RELEASE_STORE_KIND, records } };
}

function sourceVersion(value: unknown): number | null {
  return isRecord(value) && typeof value.schemaVersion === 'number' ? value.schemaVersion : null;
}

function emptyStore(): DesignReleaseStoreV1 {
  return { schemaVersion: 1, kind: DESIGN_RELEASE_STORE_KIND, records: [] };
}

function readStore(storage: DesignReleaseStorageV1): { ok: true; raw: string | null; store: DesignReleaseStoreV1 } | { ok: false } {
  let raw: string | null;
  try { raw = storage.read(); } catch { return { ok: false }; }
  if (raw === null) return { ok: true, raw, store: emptyStore() };
  try {
    const parsed = parseDesignReleaseStoreV1(JSON.parse(raw));
    return parsed.ok ? { ok: true, raw, store: parsed.store } : { ok: false };
  } catch { return { ok: false }; }
}

function releaseError(code: DesignReleaseErrorCodeV1, message: string): DesignReleaseResultV1 {
  return { ok: false, code, message };
}

export async function releaseSavedEditorDocV7(
  input: { designId: string; expectedRevision: number; runtimeGuard: DesignReleaseRuntimeGuardV1 },
  dependencies: DesignReleaseDependenciesV1,
): Promise<DesignReleaseResultV1> {
  if (input.runtimeGuard.saveState !== 'saved' || input.runtimeGuard.pendingRevision !== null) {
    return releaseError('not_saved', 'release requires a saved document with no pending revision');
  }
  if (input.runtimeGuard.savedRevision !== input.expectedRevision) {
    return releaseError('revision_mismatch', 'runtime saved revision does not match expected revision');
  }
  const rawSource = dependencies.readPersistedEditorDoc(input.designId);
  if (rawSource === undefined || rawSource === null) return releaseError('source_missing', 'persisted source is missing');
  const version = sourceVersion(rawSource);
  if (version !== null && version >= 1 && version <= 6) return releaseError('legacy_source_unsupported', 'V1-V6 sources remain read-only and cannot be released');
  if (version !== null && version > 7) return releaseError('future_source_unsupported', 'future EditorDoc version is unsupported');
  const parsed = parseEditorDocV7(rawSource);
  if (!parsed.ok || parsed.doc.designId !== input.designId) return releaseError('invalid_source', parsed.ok ? 'source key/designId mismatch' : parsed.reason);
  if (parsed.doc.revision !== input.expectedRevision) return releaseError('revision_mismatch', 'persisted revision does not match expected revision');
  const manifest = buildDesignReleaseManifestV1(parsed.doc);
  if (!manifest.ok) return releaseError(manifest.code, manifest.message);

  let checksum: string;
  try { checksum = await dependencies.sha256(canonicalJsonV1(parsed.doc)); }
  catch { return releaseError('dependency_unavailable', 'SHA-256 unavailable'); }
  if (!SHA256.test(checksum)) return releaseError('dependency_unavailable', 'SHA-256 provider returned an invalid digest');
  const storeRead = readStore(dependencies.storage);
  if (!storeRead.ok) return releaseError('storage_corrupted', 'release storage is corrupted or unavailable');
  try {
    for (const storedRecord of storeRead.store.records) {
      const storedHash = await dependencies.sha256(canonicalJsonV1(storedRecord.editorDocSnapshot));
      if (storedHash !== storedRecord.designVersion.editorDocRef.sha256) {
        return releaseError('storage_corrupted', 'release snapshot checksum mismatch');
      }
    }
  } catch {
    return releaseError('dependency_unavailable', 'SHA-256 unavailable while validating release storage');
  }
  const existing = storeRead.store.records.find((record) => record.designVersion.designId === input.designId
    && record.designVersion.revision === input.expectedRevision);
  if (existing) {
    if (existing.designVersion.editorDocRef.sha256 !== checksum) return releaseError('stale_source', 'same released revision has different content');
    return { ok: true, created: false, record: clone(existing) };
  }
  const identity = dependencies.releasedByIdentityId();
  if (!identity || !ID.test(identity)) return releaseError('identity_unavailable', 'a valid releasing identity is required');
  const designRecords = storeRead.store.records
    .filter((record) => record.designVersion.designId === input.designId)
    .sort((a, b) => a.designVersion.version - b.designVersion.version);
  const latest = designRecords.length > 0 ? designRecords[designRecords.length - 1] : undefined;
  if (latest && latest.designVersion.revision >= input.expectedRevision) return releaseError('revision_mismatch', 'released revisions must increase');
  const releasedAt = dependencies.now();
  if (!ISO.test(releasedAt)) return releaseError('dependency_unavailable', 'clock returned an invalid timestamp');
  let designVersionId: string;
  try { designVersionId = dependencies.nextId(); }
  catch { return releaseError('dependency_unavailable', 'ID generation unavailable'); }
  if (!ID.test(designVersionId)) return releaseError('dependency_unavailable', 'ID provider returned an invalid id');
  if (storeRead.store.records.some((candidate) => candidate.designVersion.designVersionId === designVersionId)) {
    return releaseError('dependency_unavailable', 'ID provider returned a duplicate designVersionId');
  }
  const designVersion: DesignVersionV1 = {
    schemaVersion: 1,
    designVersionId,
    designId: parsed.doc.designId,
    version: (latest?.designVersion.version ?? 0) + 1,
    revision: parsed.doc.revision,
    editorDocRef: { designId: parsed.doc.designId, schemaVersion: 7, revision: parsed.doc.revision, sha256: checksum },
    releasedByIdentityId: identity,
    releasedAt,
    assetRevisionRefs: clone(manifest.manifest.assetRevisionRefs),
    ...(latest ? { parentVersionId: latest.designVersion.designVersionId } : {}),
  };
  if (!parseDesignVersionV1(designVersion).ok) return releaseError('invalid_source', 'generated DesignVersion failed its public contract');
  const record: DesignReleaseRecordV1 = {
    schemaVersion: 1,
    designVersion,
    manifest: manifest.manifest,
    editorDocSnapshot: clone(parsed.doc),
  };
  await dependencies.beforeSourceRecheck?.();
  const rechecked = parseEditorDocV7(dependencies.readPersistedEditorDoc(input.designId));
  try {
    if (!rechecked.ok || await dependencies.sha256(canonicalJsonV1(rechecked.doc)) !== checksum) {
      return releaseError('stale_source', 'persisted source changed during release');
    }
  } catch {
    return releaseError('dependency_unavailable', 'SHA-256 unavailable during source recheck');
  }
  try {
    if (dependencies.storage.read() !== storeRead.raw) {
      return releaseError('stale_release_store', 'release storage changed during release');
    }
  } catch {
    return releaseError('storage_corrupted', 'release storage became unavailable during release');
  }
  const next: DesignReleaseStoreV1 = { ...storeRead.store, records: [...storeRead.store.records.map(clone), record] };
  try { await dependencies.storage.write(JSON.stringify(next)); }
  catch (error) { return releaseError('write_failed', error instanceof Error ? error.message : 'release write failed'); }
  return { ok: true, created: true, record: clone(record) };
}

export async function readDesignReleaseByVersionIdV1(
  designVersionId: string,
  dependencies: Pick<DesignReleaseDependenciesV1, 'storage' | 'sha256'>,
): Promise<{ ok: true; record: DesignReleaseRecordV1 | null } | { ok: false; code: 'storage_corrupted' | 'stale_source' }> {
  const store = readStore(dependencies.storage);
  if (!store.ok) return { ok: false, code: 'storage_corrupted' };
  const record = store.store.records.find((candidate) => candidate.designVersion.designVersionId === designVersionId);
  if (!record) return { ok: true, record: null };
  const checksum = await dependencies.sha256(canonicalJsonV1(record.editorDocSnapshot));
  if (checksum !== record.designVersion.editorDocRef.sha256) return { ok: false, code: 'stale_source' };
  return { ok: true, record: clone(record) };
}

export function createBrowserSha256V1(): (value: string) => Promise<string> {
  return async (value) => {
    if (!globalThis.crypto?.subtle) throw new Error('Web Crypto unavailable');
    const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
    return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
  };
}
