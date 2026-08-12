import type { ServiceCommandContextV1, ServiceResultV1 } from './service-contract';
import { isServiceIdV1, isServiceTimestampV1, serviceErrorV1 } from './service-contract';

export const ASSET_PURPOSES_V1 = ['PUBLISH_PREVIEW', 'EDITOR_IMPORT', 'REAL_RESULT'] as const;
export type AssetPurposeV1 = (typeof ASSET_PURPOSES_V1)[number];
export const ASSET_UPLOAD_STATUSES_V1 = ['READY', 'FAILED', 'REVOKED'] as const;
export type AssetUploadStatusV1 = (typeof ASSET_UPLOAD_STATUSES_V1)[number];
export const ASSET_MIME_TYPES_V1 = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'] as const;
export type AssetMimeTypeV1 = (typeof ASSET_MIME_TYPES_V1)[number];

export interface AssetSourceDisclosureV1 {
  sourceType: 'ORIGINAL' | 'REMIX' | 'IMPORTED' | 'AI_ASSISTED';
  attribution?: string;
}

export interface ImmutableAssetObjectRefV1 {
  assetId: string;
  revision: number;
  sha256: string;
  mimeType: AssetMimeTypeV1;
  byteLength: number;
  width: number;
  height: number;
  colorSpace: 'srgb' | 'display-p3';
  alphaMode: 'OPAQUE' | 'STRAIGHT' | 'PREMULTIPLIED';
}

export interface AssetUploadRecordV1 {
  schemaVersion: 1;
  uploadId: string;
  ownerRef: string;
  purpose: AssetPurposeV1;
  fileName: string;
  status: AssetUploadStatusV1;
  object: ImmutableAssetObjectRefV1;
  source: AssetSourceDisclosureV1;
  copyrightDeclared: boolean;
  moderationStatus: 'NOT_REQUIRED' | 'PENDING' | 'CLEARED' | 'REJECTED';
  createdAt: string;
  updatedAt: string;
}

export interface AssetUploadInputV1 {
  uploadId: string;
  /** Content-addressed id already referenced by the immutable package/output. */
  assetId: string;
  ownerRef: string;
  purpose: AssetPurposeV1;
  fileName: string;
  mimeType: AssetMimeTypeV1;
  byteLength: number;
  sha256: string;
  width: number;
  height: number;
  colorSpace: 'srgb' | 'display-p3';
  alphaMode: 'OPAQUE' | 'STRAIGHT' | 'PREMULTIPLIED';
  source: AssetSourceDisclosureV1;
  copyrightDeclared: boolean;
  moderationStatus: AssetUploadRecordV1['moderationStatus'];
  /** Non-serialized payload. Asset records and PublishPackage never embed it. */
  bytes: Uint8Array;
}

export interface AssetUploadPortV1 {
  readonly adapterKind: 'LOCAL_PROTOTYPE' | 'REMOTE';
  upload(context: ServiceCommandContextV1, input: AssetUploadInputV1): Promise<ServiceResultV1<AssetUploadRecordV1>>;
  get(context: ServiceCommandContextV1, assetId: string, revision: number): Promise<ServiceResultV1<AssetUploadRecordV1>>;
  readBytes(context: ServiceCommandContextV1, assetId: string, revision: number): Promise<ServiceResultV1<Uint8Array>>;
}

const SHA = /^[0-9a-f]{64}$/;
const MAX_BYTES = 50 * 1024 * 1024;

function exactKeys(raw: Record<string, unknown>, allowed: readonly string[]): boolean {
  return Object.keys(raw).every((key) => allowed.includes(key));
}

function validSource(value: unknown): value is AssetSourceDisclosureV1 {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const raw = value as Record<string, unknown>;
  return exactKeys(raw, ['sourceType', 'attribution'])
    && ['ORIGINAL', 'REMIX', 'IMPORTED', 'AI_ASSISTED'].includes(raw.sourceType as string)
    && (raw.attribution === undefined || (typeof raw.attribution === 'string' && raw.attribution.trim().length > 0 && raw.attribution.length <= 280));
}

export function parseImmutableAssetObjectRefV1(value: unknown): ImmutableAssetObjectRefV1 | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  if (!exactKeys(raw, ['assetId', 'revision', 'sha256', 'mimeType', 'byteLength', 'width', 'height', 'colorSpace', 'alphaMode'])
    || !isServiceIdV1(raw.assetId) || !Number.isInteger(raw.revision) || (raw.revision as number) < 1
    || typeof raw.sha256 !== 'string' || !SHA.test(raw.sha256)
    || !ASSET_MIME_TYPES_V1.includes(raw.mimeType as AssetMimeTypeV1)
    || !Number.isInteger(raw.byteLength) || (raw.byteLength as number) < 1 || (raw.byteLength as number) > MAX_BYTES
    || !Number.isInteger(raw.width) || (raw.width as number) < 1 || (raw.width as number) > 16_384
    || !Number.isInteger(raw.height) || (raw.height as number) < 1 || (raw.height as number) > 16_384
    || !['srgb', 'display-p3'].includes(raw.colorSpace as string)
    || !['OPAQUE', 'STRAIGHT', 'PREMULTIPLIED'].includes(raw.alphaMode as string)) return null;
  return structuredClone(value) as ImmutableAssetObjectRefV1;
}

export function parseAssetUploadRecordV1(value: unknown): AssetUploadRecordV1 | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  if (!exactKeys(raw, ['schemaVersion', 'uploadId', 'ownerRef', 'purpose', 'fileName', 'status', 'object', 'source', 'copyrightDeclared', 'moderationStatus', 'createdAt', 'updatedAt'])
    || raw.schemaVersion !== 1 || !isServiceIdV1(raw.uploadId) || !isServiceIdV1(raw.ownerRef)
    || !ASSET_PURPOSES_V1.includes(raw.purpose as AssetPurposeV1)
    || typeof raw.fileName !== 'string' || !raw.fileName.trim() || raw.fileName.length > 160
    || !ASSET_UPLOAD_STATUSES_V1.includes(raw.status as AssetUploadStatusV1)
    || !parseImmutableAssetObjectRefV1(raw.object) || !validSource(raw.source)
    || typeof raw.copyrightDeclared !== 'boolean'
    || !['NOT_REQUIRED', 'PENDING', 'CLEARED', 'REJECTED'].includes(raw.moderationStatus as string)
    || !isServiceTimestampV1(raw.createdAt) || !isServiceTimestampV1(raw.updatedAt)) return null;
  return structuredClone(value) as AssetUploadRecordV1;
}

function pngDimensions(bytes: Uint8Array): { width: number; height: number } | null {
  const sig = [137, 80, 78, 71, 13, 10, 26, 10];
  if (bytes.length < 24 || !sig.every((byte, index) => bytes[index] === byte)
    || String.fromCharCode(...bytes.slice(12, 16)) !== 'IHDR') return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return { width: view.getUint32(16), height: view.getUint32(20) };
}

function jpegDimensions(bytes: Uint8Array): { width: number; height: number } | null {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  let offset = 2;
  while (offset + 8 < bytes.length) {
    if (bytes[offset] !== 0xff) { offset += 1; continue; }
    const marker = bytes[offset + 1];
    if (marker === 0xd9 || marker === 0xda) break;
    const length = (bytes[offset + 2] << 8) | bytes[offset + 3];
    if (length < 2 || offset + length + 2 > bytes.length) return null;
    if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
      return { height: (bytes[offset + 5] << 8) | bytes[offset + 6], width: (bytes[offset + 7] << 8) | bytes[offset + 8] };
    }
    offset += length + 2;
  }
  return null;
}

function webpDimensions(bytes: Uint8Array): { width: number; height: number } | null {
  if (bytes.length < 30 || String.fromCharCode(...bytes.slice(0, 4)) !== 'RIFF'
    || String.fromCharCode(...bytes.slice(8, 12)) !== 'WEBP') return null;
  const kind = String.fromCharCode(...bytes.slice(12, 16));
  if (kind === 'VP8X') {
    const width = 1 + bytes[24] + (bytes[25] << 8) + (bytes[26] << 16);
    const height = 1 + bytes[27] + (bytes[28] << 8) + (bytes[29] << 16);
    return { width, height };
  }
  return null;
}

function svgDimensions(bytes: Uint8Array): { width: number; height: number } | null {
  if (bytes.length > 2 * 1024 * 1024) return null;
  let source: string;
  try { source = new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
  catch { return null; }
  if (!/^\s*(?:<\?xml[^>]*>\s*)?<svg\b/i.test(source)
    || /<script\b|\son[a-z]+\s*=|(?:href|src)\s*=\s*["'](?:https?:|data:|javascript:)/i.test(source)) return null;
  const root = source.match(/<svg\b[^>]*>/i)?.[0] ?? '';
  const width = Number(root.match(/\bwidth=["']([0-9]+(?:\.[0-9]+)?)(?:px)?["']/i)?.[1]);
  const height = Number(root.match(/\bheight=["']([0-9]+(?:\.[0-9]+)?)(?:px)?["']/i)?.[1]);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width < 1 || height < 1) return null;
  return { width: Math.round(width), height: Math.round(height) };
}

export function inspectAssetBytesV1(bytes: Uint8Array, mimeType: AssetMimeTypeV1): { width: number; height: number } | null {
  if (!(bytes instanceof Uint8Array) || bytes.byteLength < 1 || bytes.byteLength > MAX_BYTES) return null;
  if (mimeType === 'image/png') return pngDimensions(bytes);
  if (mimeType === 'image/jpeg') return jpegDimensions(bytes);
  if (mimeType === 'image/webp') return webpDimensions(bytes);
  return svgDimensions(bytes);
}

export async function validateAssetUploadInputV1(
  input: AssetUploadInputV1,
  sha256: (bytes: Uint8Array) => Promise<string>,
  correlationId?: string,
): Promise<ServiceResultV1<{ dimensions: { width: number; height: number } }>> {
  if (!isServiceIdV1(input.uploadId) || !isServiceIdV1(input.assetId) || !isServiceIdV1(input.ownerRef)
    || !ASSET_PURPOSES_V1.includes(input.purpose) || !input.fileName.trim() || input.fileName.length > 160
    || !ASSET_MIME_TYPES_V1.includes(input.mimeType) || !Number.isInteger(input.byteLength) || input.byteLength < 1
    || input.byteLength > MAX_BYTES || !(input.bytes instanceof Uint8Array)) {
    return serviceErrorV1(input.byteLength > MAX_BYTES ? 'PAYLOAD_TOO_LARGE' : 'INVALID', 'asset.invalid_metadata', false, correlationId);
  }
  if (input.bytes.byteLength !== input.byteLength) return serviceErrorV1('INTEGRITY_MISMATCH', 'asset.byte_length_mismatch', false, correlationId);
  if (!SHA.test(input.sha256) || !Number.isInteger(input.width) || !Number.isInteger(input.height)
    || !['srgb', 'display-p3'].includes(input.colorSpace) || !['OPAQUE', 'STRAIGHT', 'PREMULTIPLIED'].includes(input.alphaMode)
    || !validSource(input.source) || typeof input.copyrightDeclared !== 'boolean'
    || !['NOT_REQUIRED', 'PENDING', 'CLEARED', 'REJECTED'].includes(input.moderationStatus)) {
    return serviceErrorV1('INVALID', 'asset.invalid_metadata', false, correlationId);
  }
  const dimensions = inspectAssetBytesV1(input.bytes, input.mimeType);
  if (!dimensions) return serviceErrorV1('INTEGRITY_MISMATCH', 'asset.mime_signature_invalid', false, correlationId);
  if (dimensions.width !== input.width || dimensions.height !== input.height) {
    return serviceErrorV1('INTEGRITY_MISMATCH', 'asset.dimensions_mismatch', false, correlationId);
  }
  let digest: string;
  try { digest = await sha256(Uint8Array.from(input.bytes)); }
  catch { return serviceErrorV1('UNAVAILABLE', 'asset.sha256_unavailable', true, correlationId); }
  if (digest !== input.sha256) return serviceErrorV1('INTEGRITY_MISMATCH', 'asset.sha256_mismatch', false, correlationId);
  return { ok: true, value: { dimensions }, changed: false };
}

export function toImmutableAssetRevisionRefV1(asset: ImmutableAssetObjectRefV1) {
  const parsed = parseImmutableAssetObjectRefV1(asset);
  return parsed ? { assetId: parsed.assetId, revision: parsed.revision, sha256: parsed.sha256, mimeType: parsed.mimeType } : null;
}
