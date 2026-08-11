import type { DesignVersionV1, ImmutableAssetRevisionRefV1, PublishedLookV1 } from './design-content-model';

export const VERSIONED_STUDIO_INTENT_TTL_MS = 30 * 60 * 1000;

export interface VersionedStudioImportIntentV2 {
  v: 2;
  intentId: string;
  source: 'COMMUNITY';
  lookId: string;
  designVersionId: string;
  sourceCreatorProfileId: string;
  assetRevisionRefs: ImmutableAssetRevisionRefV1[];
  lineage: {
    sourceLookId: string;
    sourceDesignVersionId: string;
    sourceCreatorProfileId: string;
  };
  createdAt: string;
  expiresAt: string;
  returnTo: string;
}

export interface VersionedIntentStorageV2 {
  read(): Record<string, unknown>;
  write(next: Record<string, unknown>): void;
}

export interface VersionedIntentPortV2 {
  peek(intentId: string): VersionedStudioImportIntentV2 | null;
  clear(intentId: string): void;
}

type UnknownRecord = Record<string, unknown>;
const ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const SHA = /^[0-9a-f]{64}$/;
const KEYS = ['v','intentId','source','lookId','designVersionId','sourceCreatorProfileId','assetRevisionRefs','lineage','createdAt','expiresAt','returnTo'] as const;

function record(value: unknown): UnknownRecord | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as UnknownRecord : null;
}

function exactKeys(value: UnknownRecord, keys: readonly string[]): boolean {
  return Object.keys(value).every((key) => keys.includes(key));
}

export function isVersionedReturnToAllowedV2(value: string): boolean {
  if (!value.startsWith('/') || value.startsWith('//') || value.includes('://')) return false;
  return value === '/community' || value.startsWith('/community/look/') || value.startsWith('/community/board/');
}

function parseAssets(value: unknown): ImmutableAssetRevisionRefV1[] | null {
  if (!Array.isArray(value)) return null;
  const result: ImmutableAssetRevisionRefV1[] = [];
  const seen = new Set<string>();
  for (const raw of value) {
    const item = record(raw);
    if (!item || !exactKeys(item, ['assetId','revision','sha256','mimeType'])
      || typeof item.assetId !== 'string' || !ID.test(item.assetId)
      || typeof item.revision !== 'number' || !Number.isInteger(item.revision) || item.revision < 1
      || typeof item.sha256 !== 'string' || !SHA.test(item.sha256)
      || (item.mimeType !== undefined && typeof item.mimeType !== 'string')) return null;
    const key = `${item.assetId}#${item.revision}`;
    if (seen.has(key)) return null;
    seen.add(key);
    result.push({ assetId: item.assetId, revision: item.revision, sha256: item.sha256, ...(typeof item.mimeType === 'string' ? { mimeType: item.mimeType } : {}) });
  }
  return result.sort((a,b) => `${a.assetId}#${a.revision}`.localeCompare(`${b.assetId}#${b.revision}`));
}

export function parseVersionedStudioImportIntentV2(value: unknown, expectedId?: string): { ok: true; intent: VersionedStudioImportIntentV2 } | { ok: false } {
  const raw = record(value);
  if (!raw || !exactKeys(raw, KEYS) || raw.v !== 2 || raw.source !== 'COMMUNITY') return { ok: false };
  for (const key of ['intentId','lookId','designVersionId','sourceCreatorProfileId'] as const) {
    if (typeof raw[key] !== 'string' || !ID.test(raw[key] as string)) return { ok: false };
  }
  if (expectedId !== undefined && raw.intentId !== expectedId) return { ok: false };
  if (typeof raw.createdAt !== 'string' || typeof raw.expiresAt !== 'string'
    || !Number.isFinite(Date.parse(raw.createdAt)) || !Number.isFinite(Date.parse(raw.expiresAt))
    || Date.parse(raw.expiresAt) <= Date.parse(raw.createdAt)) return { ok: false };
  if (typeof raw.returnTo !== 'string' || !isVersionedReturnToAllowedV2(raw.returnTo)) return { ok: false };
  const assets = parseAssets(raw.assetRevisionRefs);
  const lineage = record(raw.lineage);
  if (!assets || !lineage || !exactKeys(lineage, ['sourceLookId','sourceDesignVersionId','sourceCreatorProfileId'])
    || lineage.sourceLookId !== raw.lookId || lineage.sourceDesignVersionId !== raw.designVersionId
    || lineage.sourceCreatorProfileId !== raw.sourceCreatorProfileId) return { ok: false };
  return { ok: true, intent: structuredClone({ ...raw, assetRevisionRefs: assets }) as VersionedStudioImportIntentV2 };
}

function sameAssets(left: ImmutableAssetRevisionRefV1[], right: ImmutableAssetRevisionRefV1[]): boolean {
  const normalize = (values: ImmutableAssetRevisionRefV1[]) => [...values]
    .map(({ assetId, revision, sha256, mimeType }) => ({ assetId, revision, sha256, mimeType: mimeType ?? null }))
    .sort((a,b) => `${a.assetId}#${a.revision}`.localeCompare(`${b.assetId}#${b.revision}`));
  const a = normalize(left);
  const b = normalize(right);
  return a.length === b.length && a.every((value, index) => {
    const other = b[index];
    return value.assetId === other.assetId && value.revision === other.revision
      && value.sha256 === other.sha256 && value.mimeType === other.mimeType;
  });
}

export function createVersionedStudioImportIntentV2(
  input: { look: PublishedLookV1; designVersion: DesignVersionV1; returnTo?: string },
  deps: { storage: VersionedIntentStorageV2; nextId(): string; nowMs(): number },
): { ok: true; intent: VersionedStudioImportIntentV2 } | { ok: false; reason: 'not_public'|'not_published'|'version_mismatch'|'asset_mismatch'|'invalid_return'|'dependency' } {
  const { look, designVersion } = input;
  if (look.visibility !== 'PUBLIC') return { ok: false, reason: 'not_public' };
  if (look.status !== 'PUBLISHED') return { ok: false, reason: 'not_published' };
  if (look.designVersionId !== designVersion.designVersionId || designVersion.designId !== designVersion.editorDocRef.designId) return { ok: false, reason: 'version_mismatch' };
  // Preview assets are derived publication outputs and need not be embedded in
  // the released EditorDoc manifest. The intent freezes the DesignVersion's
  // canonical source assets; preview integrity remains part of PublishedLook.
  const returnTo = input.returnTo ?? `/community/look/${look.lookId}`;
  if (!isVersionedReturnToAllowedV2(returnTo)) return { ok: false, reason: 'invalid_return' };
  let intentId: string;
  try { intentId = deps.nextId(); } catch { return { ok: false, reason: 'dependency' }; }
  if (!ID.test(intentId)) return { ok: false, reason: 'dependency' };
  const now = deps.nowMs();
  if (!Number.isFinite(now)) return { ok: false, reason: 'dependency' };
  const intent: VersionedStudioImportIntentV2 = {
    v: 2, intentId, source: 'COMMUNITY', lookId: look.lookId,
    designVersionId: designVersion.designVersionId,
    sourceCreatorProfileId: look.creatorProfileId,
    assetRevisionRefs: structuredClone(designVersion.assetRevisionRefs).sort((a,b) => `${a.assetId}#${a.revision}`.localeCompare(`${b.assetId}#${b.revision}`)),
    lineage: { sourceLookId: look.lookId, sourceDesignVersionId: designVersion.designVersionId, sourceCreatorProfileId: look.creatorProfileId },
    createdAt: new Date(now).toISOString(), expiresAt: new Date(now + VERSIONED_STUDIO_INTENT_TTL_MS).toISOString(), returnTo,
  };
  let current: Record<string, unknown>;
  try { current = deps.storage.read(); } catch { return { ok: false, reason: 'dependency' }; }
  const next: Record<string, VersionedStudioImportIntentV2> = {};
  for (const [key, value] of Object.entries(current)) {
    const parsed = parseVersionedStudioImportIntentV2(value, key);
    if (!parsed.ok) return { ok: false, reason: 'dependency' };
    next[key] = parsed.intent;
  }
  next[intentId] = intent;
  try { deps.storage.write(next); } catch { return { ok: false, reason: 'dependency' }; }
  return { ok: true, intent: structuredClone(intent) };
}

export function createVersionedIntentPortV2(storage: VersionedIntentStorageV2, nowMs: () => number): VersionedIntentPortV2 {
  const clear = (intentId: string) => {
    const current = storage.read();
    if (!(intentId in current)) return;
    const next: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(current)) {
      if (key === intentId) continue;
      next[key] = structuredClone(value);
    }
    storage.write(next);
  };
  return {
    peek(intentId) {
      const raw = storage.read()[intentId];
      if (raw === undefined) return null;
      const parsed = parseVersionedStudioImportIntentV2(raw, intentId);
      if (!parsed.ok) { clear(intentId); return null; }
      if (Date.parse(parsed.intent.expiresAt) <= nowMs()) { clear(intentId); return null; }
      return parsed.intent;
    },
    clear,
  };
}

export { sameAssets as sameVersionedIntentAssetsV2 };
