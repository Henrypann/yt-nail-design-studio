import type {
  AssetRefV7,
  FlatDesignElementV7,
  RgbaColorV7,
  VersionedRefV7,
} from './model';
import { isCanonicalRgbaColorV7 } from './background';
import { IDENTITY_TRANSFORM_V7 } from './flat-vector';
import { identifyOfficialTemplatePatternV7 } from './official-template-assets';

/**
 * V7-10 flat content assets: deterministic font registry, bundled sticker/stamp
 * registry, pure text/image element creators, dependency-injected import
 * preparation (PNG parser + SVG sanitizer) and the atomic relink helper.
 *
 * Asset DATA is never embedded in EditorDocV7: documents carry only AssetRefV7
 * metadata; the bytes live either under /editor-v7-assets (bundled) or in the
 * separate flat asset repository (imports).
 */

/* ── constants ─────────────────────────────────────────────────────────── */

export const FLAT_ASSET_MIME_PNG_V7 = 'image/png';
export const FLAT_ASSET_MIME_SVG_V7 = 'image/svg+xml';
/** Hard limit for a single prepared asset payload (2 MiB). */
export const FLAT_ASSET_MAX_BYTES_V7 = 2 * 1024 * 1024;
export const FLAT_ASSET_MIN_DIMENSION_V7 = 1;
export const FLAT_ASSET_MAX_DIMENSION_V7 = 4096;
/** Revision marker for every V7-10 flat content asset (bundled and imports). */
export const FLAT_ASSET_REVISION_V1_V7 = 'flat-assets-v1';
export const FLAT_FONT_REVISION_V1_V7 = 'flat-fonts-v1';
export const FLAT_TEXT_MAX_CODE_POINTS_V7 = 200;
export const FLAT_TEXT_FONT_SIZE_MIN_MM_V7 = 0.5;
export const FLAT_TEXT_FONT_SIZE_MAX_MM_V7 = 20;

const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const SHA256_PATTERN = /^[a-f0-9]{64}$/;

/* ── deterministic font registry ──────────────────────────────────────── */

/** Documented system-sans fallback used when a text fontRef is unregistered. */
export const FLAT_SYSTEM_SANS_FALLBACK_CSS_V7 =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'PingFang SC', 'Microsoft YaHei', sans-serif";

export interface FlatFontEntryV7 {
  id: string;
  revision: string;
  label: string;
  category: 'sans' | 'serif';
  /** Fixed CSS fallback stack; no font bytes are ever stored in the doc. */
  cssFamily: string;
}

export const FLAT_FONT_REGISTRY_V7: readonly FlatFontEntryV7[] = [
  {
    id: 'font.builtin.system-sans',
    revision: FLAT_FONT_REVISION_V1_V7,
    label: '系统无衬线',
    category: 'sans',
    cssFamily: FLAT_SYSTEM_SANS_FALLBACK_CSS_V7,
  },
  {
    id: 'font.builtin.system-serif',
    revision: FLAT_FONT_REVISION_V1_V7,
    label: '系统衬线',
    category: 'serif',
    cssFamily: "Georgia, 'Times New Roman', 'Songti SC', 'SimSun', serif",
  },
];

/** Deterministic resolver: exact id + revision → fixed CSS stack, else null. */
export function resolveFontCssFamilyV7(fontRef: VersionedRefV7): string | null {
  if (!fontRef || typeof fontRef.id !== 'string' || typeof fontRef.revision !== 'string') return null;
  const entry = FLAT_FONT_REGISTRY_V7.find(
    (candidate) => candidate.id === fontRef.id && candidate.revision === fontRef.revision,
  );
  return entry ? entry.cssFamily : null;
}

export function isRegisteredFontV7(fontRef: VersionedRefV7): boolean {
  return resolveFontCssFamilyV7(fontRef) !== null;
}

/* ── bundled sticker/stamp registry ───────────────────────────────────── */

export type FlatAssetRoleV7 = 'sticker' | 'import' | 'stamp';
export const FLAT_IMAGE_ROLES_V7: readonly FlatAssetRoleV7[] = ['sticker', 'import', 'stamp'];

export interface BundledFlatAssetV7 {
  /** Stable registry id, e.g. `bundled.sticker.sparkle`. */
  id: string;
  label: string;
  role: Exclude<FlatAssetRoleV7, 'import'>;
  /** Public URL under /editor-v7-assets. */
  sourceUrl: string;
  /** Stable AssetRefV7; sha256 matches the file bytes exactly. */
  asset: AssetRefV7;
}

function bundledEntry(
  id: string,
  label: string,
  role: Exclude<FlatAssetRoleV7, 'import'>,
  fileName: string,
  sha256: string,
): BundledFlatAssetV7 {
  return {
    id,
    label,
    role,
    sourceUrl: `/editor-v7-assets/${fileName}`,
    asset: {
      assetId: `asset.flat-content.${id}`,
      revision: FLAT_ASSET_REVISION_V1_V7,
      kind: 'vector',
      mimeType: FLAT_ASSET_MIME_SVG_V7,
      sha256,
      widthPx: 64,
      heightPx: 64,
      colorSpace: 'srgb',
      alphaMode: 'straight',
    },
  };
}

/** Trusted bundled SVG assets. sha256 values must match the public file bytes. */
export const FLAT_BUNDLED_ASSET_REGISTRY_V7: readonly BundledFlatAssetV7[] = [
  bundledEntry('bundled.sticker.sparkle', '闪亮星芒', 'sticker', 'sticker-sparkle.svg', '03105ed9d297544bf1a04a164b17857436d974ce4a2dca79fef6d3d86d0044ce'),
  bundledEntry('bundled.sticker.heart', '甜蜜爱心', 'sticker', 'sticker-heart.svg', '73a576e72d8ad6dd27fbfaa5225ceeb84992a59159167390457e2c51fcf51dcd'),
  bundledEntry('bundled.stamp.star', '星形印章', 'stamp', 'stamp-star.svg', '657d59b52e948cf83e0cd6f88f9deefac33b933fc57c9d675903086da7c50707'),
  bundledEntry('bundled.stamp.flower', '花瓣印章', 'stamp', 'stamp-flower.svg', 'd2e9d6629937c18e76fd259b206929d6c4d4e5d3f7edbb0ee0e5b426039493c2'),
];

export function getBundledFlatAssetV7(id: string): BundledFlatAssetV7 | undefined {
  return FLAT_BUNDLED_ASSET_REGISTRY_V7.find((entry) => entry.id === id);
}

/** Resolve an AssetRefV7 back to its bundled entry (assetId + revision + sha256). */
export function resolveBundledFlatAssetV7(ref: AssetRefV7): BundledFlatAssetV7 | null {
  const entry = FLAT_BUNDLED_ASSET_REGISTRY_V7.find(
    (candidate) => (
      candidate.asset.assetId === ref.assetId &&
      candidate.asset.revision === ref.revision &&
      candidate.asset.sha256 === ref.sha256
    ),
  );
  return entry ?? null;
}

/**
 * Role compatibility: bundled assets are usable under their declared role
 * only; imported assets are usable under the `import` role only.
 */
export function isFlatImageRoleCompatibleV7(role: FlatAssetRoleV7, asset: AssetRefV7): boolean {
  const bundled = resolveBundledFlatAssetV7(asset);
  if (bundled) return bundled.role === role;
  return role === 'import';
}

/* ── flat asset ref validation ────────────────────────────────────────── */

export function isValidFlatAssetRefV7(value: unknown): value is AssetRefV7 {
  if (!value || typeof value !== 'object') return false;
  const {
    assetId, revision, kind, mimeType, sha256, widthPx, heightPx, colorSpace, alphaMode,
  } = value as Record<string, unknown>;
  return (
    typeof assetId === 'string' && ID_PATTERN.test(assetId) &&
    typeof revision === 'string' && revision.length > 0 &&
    ((kind === 'raster' && mimeType === FLAT_ASSET_MIME_PNG_V7) ||
      (kind === 'vector' && mimeType === FLAT_ASSET_MIME_SVG_V7)) &&
    typeof sha256 === 'string' && SHA256_PATTERN.test(sha256) &&
    typeof widthPx === 'number' && Number.isInteger(widthPx) &&
    widthPx >= FLAT_ASSET_MIN_DIMENSION_V7 && widthPx <= FLAT_ASSET_MAX_DIMENSION_V7 &&
    typeof heightPx === 'number' && Number.isInteger(heightPx) &&
    heightPx >= FLAT_ASSET_MIN_DIMENSION_V7 && heightPx <= FLAT_ASSET_MAX_DIMENSION_V7 &&
    colorSpace === 'srgb' &&
    (alphaMode === 'straight' || alphaMode === 'opaque')
  );
}

/* ── pure element creators ────────────────────────────────────────────── */

export interface TextFlatElementInputV7 {
  id: string;
  text: string;
  fontRef: VersionedRefV7;
  fontSizeMm: number;
  color: RgbaColorV7;
}

export interface ImageFlatElementInputV7 {
  id: string;
  role: FlatAssetRoleV7;
  asset: AssetRefV7;
}

function isValidElementIdV7(id: unknown): id is string {
  return typeof id === 'string' && ID_PATTERN.test(id);
}

export function createTextFlatElementV7(input: TextFlatElementInputV7): FlatDesignElementV7 | null {
  if (!isValidElementIdV7(input.id)) return null;
  if (typeof input.text !== 'string' || input.text.trim().length === 0) return null;
  if ([...input.text].length > FLAT_TEXT_MAX_CODE_POINTS_V7) return null;
  if (
    !Number.isFinite(input.fontSizeMm) ||
    input.fontSizeMm < FLAT_TEXT_FONT_SIZE_MIN_MM_V7 ||
    input.fontSizeMm > FLAT_TEXT_FONT_SIZE_MAX_MM_V7
  ) return null;
  if (!isRegisteredFontV7(input.fontRef)) return null;
  if (!isCanonicalRgbaColorV7(input.color)) return null;
  return {
    id: input.id,
    kind: 'text',
    visible: true,
    locked: false,
    opacity: 1,
    transform: structuredClone(IDENTITY_TRANSFORM_V7),
    text: input.text,
    fontRef: structuredClone(input.fontRef),
    fontSizeMm: input.fontSizeMm,
    color: structuredClone(input.color),
  };
}

export function createImageFlatElementV7(input: ImageFlatElementInputV7): FlatDesignElementV7 | null {
  if (!isValidElementIdV7(input.id)) return null;
  if (!FLAT_IMAGE_ROLES_V7.includes(input.role)) return null;
  if (!isValidFlatAssetRefV7(input.asset)) return null;
  if (!isFlatImageRoleCompatibleV7(input.role, input.asset)) return null;
  const defaultScale = input.role === 'import' ? 0.72 : input.role === 'sticker' ? 0.42 : 0.3;
  return {
    id: input.id,
    kind: 'image_2d',
    role: input.role,
    visible: true,
    locked: false,
    opacity: 1,
    transform: {
      ...structuredClone(IDENTITY_TRANSFORM_V7),
      scaleX: defaultScale,
      scaleY: defaultScale,
    },
    asset: structuredClone(input.asset),
  };
}

/**
 * Atomic relink: swap only `asset`, retaining id/role/transform/opacity/
 * visible/locked. Returns null when the replacement ref is not a valid flat
 * asset or is not role-compatible with the element.
 */
export function relinkImageFlatElementV7(
  element: Extract<FlatDesignElementV7, { kind: 'image_2d' }>,
  asset: AssetRefV7,
): Extract<FlatDesignElementV7, { kind: 'image_2d' }> | null {
  if (!isValidFlatAssetRefV7(asset)) return null;
  if (!isFlatImageRoleCompatibleV7(element.role, asset)) return null;
  return {
    id: element.id,
    kind: 'image_2d',
    role: element.role,
    visible: element.visible,
    locked: element.locked,
    opacity: element.opacity,
    transform: structuredClone(element.transform),
    asset: structuredClone(asset),
  };
}

/* ── import preparation ───────────────────────────────────────────────── */

export interface FlatAssetImportSourceV7 {
  name: string;
  type: string;
  size: number;
  arrayBuffer(): Promise<ArrayBuffer>;
}

export type FlatAssetDigestV7 = (bytes: Uint8Array) => Promise<string>;

export type FlatAssetPrepareFailureV7 =
  | 'unsupported_mime'
  | 'oversize'
  | 'empty_file'
  | 'png_signature'
  | 'png_header'
  | 'png_dimensions'
  | 'png_color_type'
  | 'svg_invalid'
  | 'svg_unsafe'
  | 'svg_dimensions'
  | 'hash_invalid';

export type FlatAssetPrepareResultV7 =
  | {
      ok: true;
      asset: AssetRefV7;
      /** PNG: `data:image/png;base64,…`; SVG: validated source text. */
      source: string;
      widthPx: number;
      heightPx: number;
      alphaMode: 'straight' | 'opaque';
    }
  | { ok: false; reason: FlatAssetPrepareFailureV7; message: string };

export interface FlatAssetPrepareOptionsV7 {
  digest?: FlatAssetDigestV7;
  maxBytes?: number;
}

/** Default lowercase SHA-256 via WebCrypto; inject `digest` to override. */
export const createDefaultFlatAssetDigestV7: FlatAssetDigestV7 = async (bytes) => {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) throw new Error('no SHA-256 digest implementation available');
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  const buffer = await subtle.digest('SHA-256', copy);
  return Array.from(new Uint8Array(buffer)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
};

function decodeUtf8V7(bytes: Uint8Array): string | null {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return null;
  }
}

function encodeBase64V7(bytes: Uint8Array): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength).toString('base64');
  }
  let binary = '';
  const chunk = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunk) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunk));
  }
  return btoa(binary);
}

function decodeBase64V7(value: string): Uint8Array | null {
  if (value.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(value)) return null;
  if (typeof Buffer !== 'undefined') {
    const buffer = Buffer.from(value, 'base64');
    return new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  }
  try {
    const binary = atob(value);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    return bytes;
  } catch {
    return null;
  }
}

/**
 * Decode the repository source payload for a flat asset:
 * PNG → base64-decoded bytes of the data URL; SVG → UTF-8 bytes of the text.
 * Returns null when the source does not match the declared MIME type.
 */
export function flatAssetSourcePayloadV7(mimeType: string, source: string): Uint8Array | null {
  if (mimeType === FLAT_ASSET_MIME_PNG_V7) {
    const match = /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/.exec(source);
    return match ? decodeBase64V7(match[1]) : null;
  }
  if (mimeType === FLAT_ASSET_MIME_SVG_V7) {
    return new TextEncoder().encode(source);
  }
  return null;
}

export function flatAssetSourcePayloadBytesV7(mimeType: string, source: string): number | null {
  const payload = flatAssetSourcePayloadV7(mimeType, source);
  return payload ? payload.byteLength : null;
}

/** Lowercase SHA-256 over the decoded payload bytes, or null when undecodable. */
export async function flatAssetSourceSha256V7(
  mimeType: string,
  source: string,
  digest?: FlatAssetDigestV7,
): Promise<string | null> {
  const payload = flatAssetSourcePayloadV7(mimeType, source);
  if (!payload) return null;
  const compute = digest ?? createDefaultFlatAssetDigestV7;
  try {
    return await compute(payload);
  } catch {
    return null;
  }
}

/* ── PNG parser (deterministic subset) ────────────────────────────────── */

type PngParseOutcomeV7 =
  | { ok: true; width: number; height: number; colorType: number; bitDepth: number; alphaMode: 'straight' | 'opaque' }
  | { ok: false; reason: 'png_signature' | 'png_header' | 'png_dimensions' | 'png_color_type'; message: string };

const PNG_SIGNATURE = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const PNG_CRC_TABLE_V7 = (() => {
  const table = new Uint32Array(256);
  for (let index = 0; index < 256; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) value = (value & 1) ? (0xedb88320 ^ (value >>> 1)) : (value >>> 1);
    table[index] = value >>> 0;
  }
  return table;
})();

function pngCrc32V7(bytes: Uint8Array, start: number, end: number): number {
  let crc = 0xffffffff;
  for (let index = start; index < end; index += 1) crc = PNG_CRC_TABLE_V7[(crc ^ bytes[index]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function parsePngV7(bytes: Uint8Array): PngParseOutcomeV7 {
  if (bytes.length < PNG_SIGNATURE.length) {
    return { ok: false, reason: 'png_signature', message: 'file is too short to be a PNG' };
  }
  for (let index = 0; index < PNG_SIGNATURE.length; index += 1) {
    if (bytes[index] !== PNG_SIGNATURE[index]) {
      return { ok: false, reason: 'png_signature', message: 'PNG signature mismatch' };
    }
  }
  const readU32 = (offset: number): number => (
    (bytes[offset] << 24) | (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3]
  ) >>> 0;
  if (bytes.length < 8 + 12 + 13) {
    return { ok: false, reason: 'png_header', message: 'PNG is truncated before IHDR' };
  }
  const firstChunkLength = readU32(8);
  const firstChunkType = String.fromCharCode(bytes[12], bytes[13], bytes[14], bytes[15]);
  if (firstChunkLength !== 13 || firstChunkType !== 'IHDR') {
    return { ok: false, reason: 'png_header', message: 'first chunk must be a 13-byte IHDR' };
  }
  const width = readU32(16);
  const height = readU32(20);
  const bitDepth = bytes[24];
  const colorType = bytes[25];
  const compression = bytes[26];
  const filter = bytes[27];
  const interlace = bytes[28];
  if (width < FLAT_ASSET_MIN_DIMENSION_V7 || width > FLAT_ASSET_MAX_DIMENSION_V7 ||
      height < FLAT_ASSET_MIN_DIMENSION_V7 || height > FLAT_ASSET_MAX_DIMENSION_V7) {
    return { ok: false, reason: 'png_dimensions', message: `PNG dimensions ${width}x${height} are outside 1..4096` };
  }
  if (bitDepth !== 8 || compression !== 0 || filter !== 0 || interlace !== 0) {
    return { ok: false, reason: 'png_header', message: 'only 8-bit, compression 0, filter 0, non-interlaced PNG is supported' };
  }
  if (colorType === 0 || colorType === 2) {
    if (!hasValidPngChunkStreamV7(bytes, readU32)) return { ok: false, reason: 'png_header', message: 'PNG chunk stream, CRC, IDAT or IEND is invalid' };
    return { ok: true, width, height, colorType, bitDepth, alphaMode: 'opaque' };
  }
  if (colorType === 4 || colorType === 6) {
    if (!hasValidPngChunkStreamV7(bytes, readU32)) return { ok: false, reason: 'png_header', message: 'PNG chunk stream, CRC, IDAT or IEND is invalid' };
    return { ok: true, width, height, colorType, bitDepth, alphaMode: 'straight' };
  }
  return { ok: false, reason: 'png_color_type', message: `unsupported PNG color type ${colorType} (indexed/palette PNG is not accepted)` };
}

function hasValidPngChunkStreamV7(bytes: Uint8Array, readU32: (offset: number) => number): boolean {
  let offset = PNG_SIGNATURE.length;
  let sawIdat = false;
  let sawIend = false;
  while (offset < bytes.length) {
    if (offset + 12 > bytes.length) return false;
    const length = readU32(offset);
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;
    const crcOffset = dataEnd;
    if (dataEnd < dataStart || crcOffset + 4 > bytes.length) return false;
    const type = String.fromCharCode(bytes[offset + 4], bytes[offset + 5], bytes[offset + 6], bytes[offset + 7]);
    if (!/^[A-Za-z]{4}$/.test(type)) return false;
    const storedCrc = readU32(crcOffset);
    if (pngCrc32V7(bytes, offset + 4, dataEnd) !== storedCrc) return false;
    if (type === 'IHDR' && offset !== PNG_SIGNATURE.length) return false;
    if (type === 'IDAT') sawIdat = true;
    if (type === 'IEND') {
      if (length !== 0 || !sawIdat) return false;
      sawIend = true;
      offset = crcOffset + 4;
      break;
    }
    if (type !== 'IHDR' && type !== 'IDAT' && type !== 'PLTE' && type[0] === type[0].toUpperCase()) return false;
    offset = crcOffset + 4;
  }
  return sawIend && offset === bytes.length;
}

/* ── SVG decoder / sanitizer (deterministic subset) ───────────────────── */

const SVG_OPEN = /<svg[\s>]/i;
const SVG_CLOSE = /<\/svg\s*>/i;
const SVG_FORBIDDEN_DECLARATION = /<!/i;
const SVG_FORBIDDEN_PROCESSING = /<\?/i;
const SVG_FORBIDDEN_SCRIPT = /<\s*script/i;
const SVG_FORBIDDEN_FOREIGN = /foreignobject/i;
const SVG_FORBIDDEN_EVENT = /\son[a-z]+\s*=/i;
const SVG_FORBIDDEN_URI_SCHEME = /(?:javascript|vbscript)\s*:/i;
const SVG_FORBIDDEN_REF = /\s(?:href|xlink:href|src)\s*=\s*["']\s*(?:https?:|data:|file:|javascript:|vbscript:|\/\/)/i;
const SVG_FORBIDDEN_URL = /\burl\(\s*(?:https?:|data:|file:|javascript:|vbscript:|\/\/)/i;
const SVG_ANY_REF_ATTRIBUTE = /\s(?:href|xlink:href|src)\s*=/i;
const SVG_STYLE_ATTRIBUTE = /\sstyle\s*=/i;
const SVG_ALLOWED_TAGS = new Set([
  'svg', 'g', 'path', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon',
  'defs', 'lineargradient', 'radialgradient', 'stop', 'clippath', 'mask', 'text', 'tspan',
]);
const SVG_LENGTH = /^(\d+(?:\.\d+)?)(?:px)?$/;
const SVG_VIEWBOX = /^\s*(-?\d+(?:\.\d+)?)[\s,]+(-?\d+(?:\.\d+)?)[\s,]+(-?\d+(?:\.\d+)?)[\s,]+(-?\d+(?:\.\d+)?)\s*$/;

function svgRootTagV7(source: string): string | null {
  const match = /<svg\b[^>]*>/i.exec(source);
  return match ? match[0] : null;
}

function svgAttributeV7(tag: string, name: string): string | null {
  const match = new RegExp(`(?:^|[\\s])${name}\\s*=\\s*["']([^"']*)["']`, 'i').exec(tag);
  return match ? match[1] : null;
}

type SvgValidationOutcomeV7 =
  | { ok: true; widthPx: number; heightPx: number }
  | { ok: false; reason: 'svg_invalid' | 'svg_unsafe' | 'svg_dimensions'; message: string };

/**
 * Sanitizer gate: only plain SVG geometry without scripts, event handlers,
 * foreign content, XML declarations/entities or external references is
 * accepted. The validated source text is stored verbatim (hash-consistent);
 * the gate itself is the sanitization.
 */
export function validateSvgSourceV7(source: string): SvgValidationOutcomeV7 {
  if (typeof source !== 'string' || source.length === 0) {
    return { ok: false, reason: 'svg_invalid', message: 'SVG source is empty' };
  }
  const trimmed = source.trim();
  if (!SVG_OPEN.test(source) || !SVG_CLOSE.test(source) || !/^<svg[\s>]/i.test(trimmed) || !/<\/svg\s*>$/i.test(trimmed)) {
    return { ok: false, reason: 'svg_invalid', message: 'source must contain a complete <svg> root element' };
  }
  if (SVG_FORBIDDEN_DECLARATION.test(source) || SVG_FORBIDDEN_PROCESSING.test(source)) {
    return { ok: false, reason: 'svg_unsafe', message: 'XML declarations/entities/doctype are rejected' };
  }
  if (SVG_FORBIDDEN_SCRIPT.test(source)) {
    return { ok: false, reason: 'svg_unsafe', message: '<script> is rejected' };
  }
  if (SVG_FORBIDDEN_FOREIGN.test(source)) {
    return { ok: false, reason: 'svg_unsafe', message: 'foreignObject is rejected' };
  }
  if (SVG_FORBIDDEN_EVENT.test(source)) {
    return { ok: false, reason: 'svg_unsafe', message: 'on* event handler attributes are rejected' };
  }
  if (SVG_FORBIDDEN_URI_SCHEME.test(source)) {
    return { ok: false, reason: 'svg_unsafe', message: 'javascript:/vbscript: URIs are rejected' };
  }
  if (SVG_FORBIDDEN_REF.test(source) || SVG_FORBIDDEN_URL.test(source)) {
    return { ok: false, reason: 'svg_unsafe', message: 'external href/src/url references are rejected' };
  }
  if (SVG_ANY_REF_ATTRIBUTE.test(source) || SVG_STYLE_ATTRIBUTE.test(source) || /<\s*style\b/i.test(source)) {
    return { ok: false, reason: 'svg_unsafe', message: 'href/src and CSS style content are rejected in imported SVG' };
  }
  for (const match of source.matchAll(/<\/?\s*([A-Za-z][A-Za-z0-9:-]*)\b/g)) {
    const tagName = match[1].toLowerCase();
    if (!SVG_ALLOWED_TAGS.has(tagName)) {
      return { ok: false, reason: 'svg_unsafe', message: `SVG tag <${tagName}> is not in the safe geometry subset` };
    }
  }
  if ((source.match(/<svg[\s>]/gi)?.length ?? 0) !== 1 || (source.match(/<\/svg\s*>/gi)?.length ?? 0) !== 1) {
    return { ok: false, reason: 'svg_invalid', message: 'SVG must contain exactly one root element' };
  }
  for (const match of source.matchAll(/url\(\s*([^)]*)\)/gi)) {
    if (!/^#[A-Za-z_][\w:.-]*$/.test(match[1].trim())) {
      return { ok: false, reason: 'svg_unsafe', message: 'only local fragment url(#id) paint references are allowed' };
    }
  }
  const rootTag = svgRootTagV7(source);
  if (!rootTag) return { ok: false, reason: 'svg_invalid', message: 'cannot locate the <svg> root tag' };
  let width = parseLengthV7(svgAttributeV7(rootTag, 'width'));
  let height = parseLengthV7(svgAttributeV7(rootTag, 'height'));
  if (width === null || height === null) {
    const viewBox = svgAttributeV7(rootTag, 'viewBox');
    const parsed = viewBox !== null ? SVG_VIEWBOX.exec(viewBox) : null;
    if (!parsed) {
      return { ok: false, reason: 'svg_dimensions', message: 'SVG needs width/height or a 4-value viewBox' };
    }
    const viewBoxWidth = Number(parsed[3]);
    const viewBoxHeight = Number(parsed[4]);
    if (viewBoxWidth <= 0 || viewBoxHeight <= 0) {
      return { ok: false, reason: 'svg_dimensions', message: 'viewBox width/height must be positive' };
    }
    if (width === null) width = viewBoxWidth;
    if (height === null) height = viewBoxHeight;
  }
  if (
    !Number.isFinite(width) || width < 1 || width > FLAT_ASSET_MAX_DIMENSION_V7 ||
    !Number.isFinite(height) || height < 1 || height > FLAT_ASSET_MAX_DIMENSION_V7
  ) {
    return { ok: false, reason: 'svg_dimensions', message: `SVG dimensions ${width}x${height} are outside 1..4096` };
  }
  return {
    ok: true,
    widthPx: Math.round(width),
    heightPx: Math.round(height),
  };
}

function parseLengthV7(value: string | null): number | null {
  if (value === null) return null;
  const match = SVG_LENGTH.exec(value.trim());
  if (!match) return null;
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : null;
}

/* ── prepare entry point ──────────────────────────────────────────────── */

export async function prepareFlatAssetImportV7(
  input: FlatAssetImportSourceV7,
  options: FlatAssetPrepareOptionsV7 = {},
): Promise<FlatAssetPrepareResultV7> {
  const maxBytes = options.maxBytes ?? FLAT_ASSET_MAX_BYTES_V7;
  if (typeof input?.arrayBuffer !== 'function') {
    return { ok: false, reason: 'empty_file', message: 'import source has no arrayBuffer()' };
  }
  if (typeof input.type !== 'string' || (input.type !== FLAT_ASSET_MIME_PNG_V7 && input.type !== FLAT_ASSET_MIME_SVG_V7)) {
    return { ok: false, reason: 'unsupported_mime', message: `MIME type ${String(input.type)} is not supported` };
  }
  if (Number.isFinite(input.size) && input.size > maxBytes) {
    return { ok: false, reason: 'oversize', message: `file exceeds the ${maxBytes} byte limit` };
  }
  let bytes: Uint8Array;
  try {
    const buffer = await input.arrayBuffer();
    bytes = new Uint8Array(buffer);
  } catch {
    return { ok: false, reason: 'empty_file', message: 'could not read the file bytes' };
  }
  if (bytes.byteLength === 0) return { ok: false, reason: 'empty_file', message: 'file is empty' };
  if (bytes.byteLength > maxBytes) {
    return { ok: false, reason: 'oversize', message: `file is ${bytes.byteLength} bytes, above the ${maxBytes} byte limit` };
  }

  let kind: AssetRefV7['kind'];
  let source: string;
  let widthPx: number;
  let heightPx: number;
  let alphaMode: 'straight' | 'opaque';

  if (input.type === FLAT_ASSET_MIME_PNG_V7) {
    const parsed = parsePngV7(bytes);
    if (!parsed.ok) return { ok: false, reason: parsed.reason, message: parsed.message };
    kind = 'raster';
    source = `data:image/png;base64,${encodeBase64V7(bytes)}`;
    widthPx = parsed.width;
    heightPx = parsed.height;
    alphaMode = parsed.alphaMode;
  } else {
    const decoded = decodeUtf8V7(bytes);
    if (decoded === null) return { ok: false, reason: 'svg_invalid', message: 'SVG must be valid UTF-8 text' };
    const validated = validateSvgSourceV7(decoded);
    if (!validated.ok) return { ok: false, reason: validated.reason, message: validated.message };
    kind = 'vector';
    source = decoded;
    widthPx = validated.widthPx;
    heightPx = validated.heightPx;
    alphaMode = 'straight';
  }

  const digest = options.digest ?? createDefaultFlatAssetDigestV7;
  // Hash the exact payload that the repository persists and revalidates. For
  // SVG this deliberately canonicalizes a UTF-8 BOM away during decode, so a
  // valid imported file cannot become corrupt merely because the stored text
  // is later encoded again.
  const persistedPayload = flatAssetSourcePayloadV7(input.type, source);
  if (!persistedPayload) {
    return { ok: false, reason: 'hash_invalid', message: 'prepared source payload could not be encoded' };
  }
  let sha256: string;
  try {
    sha256 = await digest(persistedPayload);
  } catch (error) {
    return { ok: false, reason: 'hash_invalid', message: error instanceof Error ? error.message : 'digest failed' };
  }
  if (!SHA256_PATTERN.test(sha256)) {
    return { ok: false, reason: 'hash_invalid', message: 'digest must produce lowercase SHA-256 hex' };
  }

  const asset: AssetRefV7 = {
    assetId: `asset.flat-content.${sha256.slice(0, 32)}`,
    revision: FLAT_ASSET_REVISION_V1_V7,
    kind,
    mimeType: input.type,
    sha256,
    widthPx,
    heightPx,
    colorSpace: 'srgb',
    alphaMode,
  };
  return { ok: true, asset, source, widthPx, heightPx, alphaMode };
}

export type FlatAssetSourceValidationV7 =
  | { ok: true }
  | { ok: false; message: string };

/**
 * Revalidates a separately stored import source against its canonical ref.
 * Repositories use this at both write and read boundaries so a hand-crafted
 * payload cannot bypass the prepare step and later become a broken document
 * dependency.
 */
export async function validateFlatAssetSourceV7(
  asset: AssetRefV7,
  source: string,
  digest: FlatAssetDigestV7 = createDefaultFlatAssetDigestV7,
): Promise<FlatAssetSourceValidationV7> {
  if (!isValidFlatAssetRefV7(asset) || resolveBundledFlatAssetV7(asset)) {
    return { ok: false, message: 'source repository accepts imported flat assets only' };
  }
  if (asset.revision !== FLAT_ASSET_REVISION_V1_V7 || asset.assetId !== `asset.flat-content.${asset.sha256.slice(0, 32)}`) {
    return { ok: false, message: 'imported asset identity does not match its checksum and revision' };
  }
  const payload = flatAssetSourcePayloadV7(asset.mimeType, source);
  if (!payload || payload.byteLength === 0 || payload.byteLength > FLAT_ASSET_MAX_BYTES_V7) {
    return { ok: false, message: 'source payload is missing, malformed or exceeds 2 MiB' };
  }
  if (asset.mimeType === FLAT_ASSET_MIME_PNG_V7) {
    const parsed = parsePngV7(payload);
    if (!parsed.ok || parsed.width !== asset.widthPx || parsed.height !== asset.heightPx || parsed.alphaMode !== asset.alphaMode) {
      return { ok: false, message: 'PNG source metadata does not match the canonical asset reference' };
    }
  } else {
    const decoded = decodeUtf8V7(payload);
    const parsed = decoded === null ? null : validateSvgSourceV7(decoded);
    if (!parsed?.ok || decoded !== source || parsed.widthPx !== asset.widthPx || parsed.heightPx !== asset.heightPx) {
      return { ok: false, message: 'SVG source metadata does not match the canonical asset reference' };
    }
  }
  let sourceHash: string;
  try {
    sourceHash = await digest(payload);
  } catch {
    return { ok: false, message: 'source checksum could not be computed' };
  }
  return sourceHash === asset.sha256
    ? { ok: true }
    : { ok: false, message: 'source payload does not match the declared SHA-256 checksum' };
}

export type FlatAssetPreparedV7 = Extract<FlatAssetPrepareResultV7, { ok: true }>;

/* ── display helpers (derived views only, never canonical) ───────────── */

/** Shortened asset id for recovery placeholders and read-only metadata. */
export function shortAssetIdV7(assetId: string): string {
  if (typeof assetId !== 'string' || assetId.length <= 16) return typeof assetId === 'string' ? assetId : 'unknown';
  return `${assetId.slice(0, 12)}…${assetId.slice(-4)}`;
}

/** Deterministic element label used by layer trees and inspectors. */
export function flatElementLabelV7(element: FlatDesignElementV7): string {
  switch (element.kind) {
    case 'brush_stroke': return '画笔线条';
    case 'eraser_mask': return '橡皮遮罩';
    case 'vector_shape': return '矢量图形';
    case 'text': return '文字';
    case 'image_2d': {
      if (element.role === 'sticker') return '贴纸';
      if (element.role === 'import') return '导入素材';
      return '印章';
    }
    case 'french_edge': return '法式甲缘';
    case 'region_mask': return '区域遮罩';
  }
}

export type FlatContentAssetStatusV7 = 'official' | 'bundled' | 'import' | 'invalid';

/**
 * Synchronous classification used by renderers and inspectors:
 * official template (checksum) > bundled registry > valid flat import ref.
 * Everything else is unresolvable and must render the recovery placeholder.
 */
export function flatContentAssetStatusV7(asset: AssetRefV7): FlatContentAssetStatusV7 {
  if (identifyOfficialTemplatePatternV7(asset)) return 'official';
  if (resolveBundledFlatAssetV7(asset)) return 'bundled';
  return isValidFlatAssetRefV7(asset) ? 'import' : 'invalid';
}
