import type { AssetRefV7 } from './model';
import {
  FLAT_ASSET_MAX_BYTES_V7,
  FLAT_ASSET_MAX_DIMENSION_V7,
  FLAT_ASSET_MIME_PNG_V7,
  FLAT_ASSET_MIME_SVG_V7,
  FLAT_ASSET_MIN_DIMENSION_V7,
  createDefaultFlatAssetDigestV7,
  flatAssetSourcePayloadBytesV7,
  isValidFlatAssetRefV7,
  resolveBundledFlatAssetV7,
  validateFlatAssetSourceV7,
  type BundledFlatAssetV7,
  type FlatAssetDigestV7,
} from './flat-content-assets';

/**
 * V7-10 flat asset repository: a separate versioned localStorage envelope
 * (literal key `nail-studio:editor.v7.flat-assets`) that holds IMPORT asset
 * bytes only. It intentionally does not use src/lib/storage.ts, keeps
 * EditorDocV7 free of asset data, and resolves bundled assets from the
 * builtin registry first. Official template behavior stays untouched.
 */

export const FLAT_ASSETS_STORAGE_KEY_V7 = 'nail-studio:editor.v7.flat-assets';

const ENVELOPE_VERSION = 1;
/** Total payload budget across all entries (8 MiB). */
const FLAT_ASSET_TOTAL_LIMIT_BYTES_V7 = 8 * 1024 * 1024;

const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const SHA256_PATTERN = /^[a-f0-9]{64}$/;

export interface StoredFlatAssetV7 {
  assetId: string;
  revision: string;
  kind: 'raster' | 'vector';
  mimeType: string;
  sha256: string;
  widthPx: number;
  heightPx: number;
  colorSpace: 'srgb';
  alphaMode: 'straight' | 'opaque';
  /** PNG: data URL; SVG: validated source text. Never part of an EditorDoc. */
  source: string;
  createdAt: string;
}

export interface FlatAssetEnvelopeV7 {
  version: 1;
  assets: Record<string, StoredFlatAssetV7>;
}

export function flatAssetKeyV7(assetId: string, revision: string): string {
  return `${assetId}@${revision}`;
}

export interface FlatAssetStorageV7 {
  read(): string | null;
  write(value: string): void;
}

export function createLocalFlatAssetStorageV7(
  key: string = FLAT_ASSETS_STORAGE_KEY_V7,
): FlatAssetStorageV7 {
  return {
    read: () => globalThis.localStorage?.getItem(key) ?? null,
    write: (value) => {
      globalThis.localStorage.setItem(key, value);
    },
  };
}

/* ── strict envelope parse ────────────────────────────────────────────── */

type EnvelopeParseResultV7 =
  | { ok: true; envelope: FlatAssetEnvelopeV7 }
  | { ok: false; message: string };

function parseEnvelopeV7(raw: string): EnvelopeParseResultV7 {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, message: 'flat asset envelope is not valid JSON' };
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { ok: false, message: 'flat asset envelope must be an object' };
  }
  const envelope = parsed as Record<string, unknown>;
  if (Object.keys(envelope).some((key) => key !== 'version' && key !== 'assets')) {
    return { ok: false, message: 'flat asset envelope contains unknown keys' };
  }
  if (envelope.version !== ENVELOPE_VERSION) {
    return { ok: false, message: `unsupported flat asset envelope version ${String(envelope.version)}` };
  }
  const rawAssets = envelope.assets;
  if (!rawAssets || typeof rawAssets !== 'object' || Array.isArray(rawAssets)) {
    return { ok: false, message: 'flat asset envelope assets must be an object' };
  }
  const assets: Record<string, StoredFlatAssetV7> = {};
  for (const [key, value] of Object.entries(rawAssets)) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return { ok: false, message: `flat asset entry ${key} must be an object` };
    }
    const entry = value as Record<string, unknown>;
    const allowedEntryKeys = new Set([
      'assetId', 'revision', 'kind', 'mimeType', 'sha256', 'widthPx', 'heightPx',
      'colorSpace', 'alphaMode', 'source', 'createdAt',
    ]);
    if (Object.keys(entry).some((entryKey) => !allowedEntryKeys.has(entryKey))) {
      return { ok: false, message: `flat asset entry ${key} contains unknown keys` };
    }
    const { assetId, revision, kind, mimeType, sha256, widthPx, heightPx, colorSpace, alphaMode, source, createdAt } = entry;
    const structurallyValid =
      typeof assetId === 'string' && ID_PATTERN.test(assetId) &&
      typeof revision === 'string' && revision.length > 0 &&
      key === flatAssetKeyV7(assetId, revision) &&
      ((kind === 'raster' && mimeType === FLAT_ASSET_MIME_PNG_V7) ||
        (kind === 'vector' && mimeType === FLAT_ASSET_MIME_SVG_V7)) &&
      typeof sha256 === 'string' && SHA256_PATTERN.test(sha256) &&
      typeof widthPx === 'number' && Number.isInteger(widthPx) &&
      widthPx >= FLAT_ASSET_MIN_DIMENSION_V7 && widthPx <= FLAT_ASSET_MAX_DIMENSION_V7 &&
      typeof heightPx === 'number' && Number.isInteger(heightPx) &&
      heightPx >= FLAT_ASSET_MIN_DIMENSION_V7 && heightPx <= FLAT_ASSET_MAX_DIMENSION_V7 &&
      colorSpace === 'srgb' &&
      (alphaMode === 'straight' || alphaMode === 'opaque') &&
      typeof source === 'string' && source.length > 0 &&
      typeof createdAt === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(createdAt) &&
      Number.isFinite(Date.parse(createdAt));
    if (!structurallyValid) {
      return { ok: false, message: `flat asset entry ${key} failed strict validation` };
    }
    const payloadBytes = flatAssetSourcePayloadBytesV7(mimeType, source);
    if (payloadBytes === null || payloadBytes > FLAT_ASSET_MAX_BYTES_V7) {
      return { ok: false, message: `flat asset entry ${key} source is invalid or exceeds 2 MiB` };
    }
    assets[key] = {
      assetId: String(assetId),
      revision: String(revision),
      kind: kind as StoredFlatAssetV7['kind'],
      mimeType: String(mimeType),
      sha256: String(sha256),
      widthPx: widthPx as number,
      heightPx: heightPx as number,
      colorSpace: 'srgb',
      alphaMode: alphaMode as StoredFlatAssetV7['alphaMode'],
      source: String(source),
      createdAt: String(createdAt),
    };
  }
  return { ok: true, envelope: { version: ENVELOPE_VERSION, assets } };
}

function readEnvelopeV7(storage: FlatAssetStorageV7): EnvelopeParseResultV7 {
  let raw: string | null;
  try {
    raw = storage.read();
  } catch (error) {
    return { ok: false, message: `flat asset storage read failed: ${errorMessageV7(error)}` };
  }
  if (raw === null || raw === '') {
    return { ok: true, envelope: { version: ENVELOPE_VERSION, assets: {} } };
  }
  return parseEnvelopeV7(raw);
}

function isQuotaErrorV7(error: unknown): boolean {
  const name = error instanceof Error ? error.name : String(error);
  const message = error instanceof Error ? error.message : String(error);
  return (
    name === 'QuotaExceededError' ||
    name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
    /quota|exceeded/i.test(message)
  );
}

function errorMessageV7(error: unknown): string {
  return error instanceof Error ? error.message : 'storage write failed';
}

/* ── result types ─────────────────────────────────────────────────────── */

export type FlatAssetPutResultV7 =
  | { ok: true }
  | { ok: false; reason: 'invalid_asset' | 'invalid_source' | 'too_large' | 'quota_exceeded' | 'corrupt_storage' | 'write_failed'; message: string };

export type FlatAssetGetResultV7 =
  | { status: 'bundled'; entry: BundledFlatAssetV7 }
  | { status: 'valid'; asset: AssetRefV7; source: string }
  | { status: 'missing' }
  | { status: 'corrupt'; message: string };

export type FlatAssetRemoveResultV7 =
  | { ok: true }
  | { ok: false; reason: 'missing' | 'corrupt_storage' | 'write_failed'; message?: string };

export interface FlatAssetInspectEntryV7 {
  key: string;
  assetId: string;
  revision: string;
  mimeType: string;
  widthPx: number;
  heightPx: number;
  alphaMode: 'straight' | 'opaque';
  payloadBytes: number;
  status: 'valid' | 'corrupt';
}

export interface FlatAssetInspectResultV7 {
  ok: boolean;
  reason?: string;
  message?: string;
  entryCount: number;
  totalPayloadBytes: number;
  entries: FlatAssetInspectEntryV7[];
}

export interface FlatAssetRepositoryV7 {
  /** Import asset bytes only; bundled assets are never written here. */
  put(asset: AssetRefV7, source: string): Promise<FlatAssetPutResultV7>;
  /** Bundled registry resolves first, then the envelope. */
  get(ref: AssetRefV7): Promise<FlatAssetGetResultV7>;
  inspect(): FlatAssetInspectResultV7;
  remove(ref: AssetRefV7): FlatAssetRemoveResultV7;
}

export interface FlatAssetRepositoryOptionsV7 {
  digest?: FlatAssetDigestV7;
  now?: () => string;
}

export function createFlatAssetRepositoryV7(
  storage: FlatAssetStorageV7,
  options: FlatAssetRepositoryOptionsV7 = {},
): FlatAssetRepositoryV7 {
  const digest = options.digest ?? createDefaultFlatAssetDigestV7;
  const now = options.now ?? (() => new Date().toISOString());

  const serialize = (envelope: FlatAssetEnvelopeV7): string => (
    JSON.stringify({ version: ENVELOPE_VERSION, assets: envelope.assets })
  );

  const put = async (asset: AssetRefV7, source: string): Promise<FlatAssetPutResultV7> => {
    if (!isValidFlatAssetRefV7(asset)) {
      return { ok: false, reason: 'invalid_asset', message: 'asset reference metadata is not well formed' };
    }
    if (typeof source !== 'string' || source.length === 0) {
      return { ok: false, reason: 'invalid_source', message: 'asset source must be a non-empty string' };
    }
    const payloadBytes = flatAssetSourcePayloadBytesV7(asset.mimeType, source);
    if (payloadBytes === null) {
      return { ok: false, reason: 'invalid_source', message: 'source payload does not match the declared MIME type' };
    }
    if (payloadBytes > FLAT_ASSET_MAX_BYTES_V7) {
      return { ok: false, reason: 'too_large', message: `single asset payload exceeds ${FLAT_ASSET_MAX_BYTES_V7} bytes` };
    }
    const sourceValidation = await validateFlatAssetSourceV7(asset, source, digest);
    if (!sourceValidation.ok) {
      return { ok: false, reason: 'invalid_source', message: sourceValidation.message };
    }
    const parsed = readEnvelopeV7(storage);
    if (!parsed.ok) {
      return { ok: false, reason: 'corrupt_storage', message: parsed.message };
    }
    const key = flatAssetKeyV7(asset.assetId, asset.revision);
    const entries = parsed.envelope.assets;
    const currentTotal = Object.values(entries).reduce(
      (sum, entry) => sum + (flatAssetSourcePayloadBytesV7(entry.mimeType, entry.source) ?? 0),
      0,
    );
    const replacedBytes = flatAssetSourcePayloadBytesV7(
      entries[key]?.mimeType ?? asset.mimeType,
      entries[key]?.source ?? '',
    ) ?? 0;
    const nextTotal = currentTotal - replacedBytes + payloadBytes;
    if (nextTotal > FLAT_ASSET_TOTAL_LIMIT_BYTES_V7) {
      return { ok: false, reason: 'quota_exceeded', message: `flat asset repository total would exceed ${FLAT_ASSET_TOTAL_LIMIT_BYTES_V7} bytes` };
    }
    const next: Record<string, StoredFlatAssetV7> = { ...entries };
    next[key] = {
      assetId: asset.assetId,
      revision: asset.revision,
      kind: asset.mimeType === FLAT_ASSET_MIME_PNG_V7 ? 'raster' : 'vector',
      mimeType: asset.mimeType,
      sha256: asset.sha256,
      widthPx: asset.widthPx ?? 1,
      heightPx: asset.heightPx ?? 1,
      colorSpace: 'srgb',
      alphaMode: asset.alphaMode === 'opaque' ? 'opaque' : 'straight',
      source,
      createdAt: now(),
    };
    const serialized = serialize({ version: ENVELOPE_VERSION, assets: next });
    try {
      storage.write(serialized);
    } catch (error) {
      const reason = isQuotaErrorV7(error) ? 'quota_exceeded' : 'write_failed';
      return { ok: false, reason, message: errorMessageV7(error) };
    }
    return { ok: true };
  };

  const get = async (ref: AssetRefV7): Promise<FlatAssetGetResultV7> => {
    const bundled = resolveBundledFlatAssetV7(ref);
    if (bundled) return { status: 'bundled', entry: bundled };
    if (!isValidFlatAssetRefV7(ref)) return { status: 'missing' };
    const parsed = readEnvelopeV7(storage);
    if (!parsed.ok) return { status: 'corrupt', message: parsed.message };
    const entry = parsed.envelope.assets[flatAssetKeyV7(ref.assetId, ref.revision)];
    if (!entry) return { status: 'missing' };
    if (entry.assetId !== ref.assetId || entry.revision !== ref.revision || entry.sha256 !== ref.sha256) {
      return { status: 'corrupt', message: 'stored metadata does not match the requested reference' };
    }
    const sourceValidation = await validateFlatAssetSourceV7(ref, entry.source, digest);
    if (!sourceValidation.ok) {
      return { status: 'corrupt', message: sourceValidation.message };
    }
    return {
      status: 'valid',
      asset: {
        assetId: entry.assetId,
        revision: entry.revision,
        kind: entry.kind,
        mimeType: entry.mimeType,
        sha256: entry.sha256,
        widthPx: entry.widthPx,
        heightPx: entry.heightPx,
        colorSpace: 'srgb',
        alphaMode: entry.alphaMode,
      },
      source: entry.source,
    };
  };

  const inspect = (): FlatAssetInspectResultV7 => {
    const parsed = readEnvelopeV7(storage);
    if (!parsed.ok) {
      return { ok: false, reason: 'corrupt_storage', message: parsed.message, entryCount: 0, totalPayloadBytes: 0, entries: [] };
    }
    const entries: FlatAssetInspectEntryV7[] = Object.entries(parsed.envelope.assets).map(([key, entry]) => {
      const payloadBytes = flatAssetSourcePayloadBytesV7(entry.mimeType, entry.source) ?? 0;
      return {
        key,
        assetId: entry.assetId,
        revision: entry.revision,
        mimeType: entry.mimeType,
        widthPx: entry.widthPx,
        heightPx: entry.heightPx,
        alphaMode: entry.alphaMode,
        payloadBytes,
        status: payloadBytes > 0 ? 'valid' : 'corrupt',
      };
    });
    return {
      ok: true,
      entryCount: entries.length,
      totalPayloadBytes: entries.reduce((sum, entry) => sum + entry.payloadBytes, 0),
      entries,
    };
  };

  const remove = (ref: AssetRefV7): FlatAssetRemoveResultV7 => {
    if (!ref || typeof ref !== 'object') return { ok: false, reason: 'missing' };
    const { assetId, revision } = ref as unknown as Record<string, unknown>;
    if (typeof assetId !== 'string' || typeof revision !== 'string') return { ok: false, reason: 'missing' };
    const parsed = readEnvelopeV7(storage);
    if (!parsed.ok) return { ok: false, reason: 'corrupt_storage', message: parsed.message };
    const key = flatAssetKeyV7(assetId, revision);
    if (!parsed.envelope.assets[key]) return { ok: false, reason: 'missing' };
    const next: Record<string, StoredFlatAssetV7> = { ...parsed.envelope.assets };
    delete next[key];
    try {
      storage.write(serialize({ version: ENVELOPE_VERSION, assets: next }));
    } catch (error) {
      return { ok: false, reason: 'write_failed', message: errorMessageV7(error) };
    }
    return { ok: true };
  };

  return { put, get, inspect, remove };
}
