/**
 * Studio V7.1 · STUDIO-V7.1-03 strict runtime parser for PublishPackageV1
 * (dependency-free).
 *
 * Every `parse*` function:
 *  - never throws, even for null / primitives / arrays / symbols / bigints /
 *    cyclic objects / deeply malformed input;
 *  - never mutates its input (successful parses return the input object);
 *  - reports bounded issues (at most MAX_ISSUES) with stable code + path.
 *
 * Rejections include: unknown keys at any depth, embedded EditorDoc content
 * (title/nails/recipeInstances/…), forbidden private keys (customer data,
 * raw nail geometry, credentials), device/manufacturing fields, malformed
 * ids/hashes/timestamps/positive integers, non-canonical palette/shape/length
 * lists, missing/misordered ten-finger details and geometry entries, output
 * source refs that disagree with the package refs, and package fidelity that
 * contradicts the outputs.
 */

import { MAX_ISSUES } from '@/community/domain/v7_1/contract';
import {
  scanForbiddenDeviceManufacturingKeys,
  type DesignContentIssue,
  type DesignContentIssueCode,
} from '@/community/domain/v7_1/design-content-parse';
import { scanForbiddenPrivateKeys } from '@/community/domain/v7_1/privacy';
import { FINGER_CODES, type FingerCode } from '@/lib/types';
import { RENDERER_EVIDENCE_UNAVAILABLE } from '@/studio/versioning/design-release';
import {
  PUBLISH_COLOR_SPACES_V1,
  PUBLISH_FIDELITIES_V1,
  PUBLISH_FALLBACK_REASONS_V1,
  PUBLISH_OUTPUT_KINDS_V1,
  PUBLISH_OUTPUT_MIME_V1,
  PUBLISH_PACKAGE_SCHEMA_VERSION,
  type GeometryResolutionV1,
  type PublishPackageV1,
} from './publish-package-model';

export type PublishPackageIssueCode =
  | 'not_an_object'
  | 'schema_version'
  | 'unknown_key'
  | 'missing_field'
  | 'invalid_type'
  | 'invalid_enum'
  | 'empty_string'
  | 'invalid_id'
  | 'invalid_hash'
  | 'invalid_timestamp'
  | 'invalid_positive_int'
  | 'embedded_editor_doc'
  | 'forbidden_private_key'
  | 'device_manufacturing_field'
  | 'invalid_color'
  | 'empty_palette'
  | 'duplicate_palette'
  | 'palette_not_sorted'
  | 'duplicate_entry'
  | 'list_not_sorted'
  | 'invalid_geometry_state'
  | 'detail_count'
  | 'finger_mismatch'
  | 'fidelity_mismatch'
  | 'source_mismatch'
  | 'duplicate_asset_ref'
  | 'ref_mismatch';

export interface PublishPackageIssue {
  /** Package codes plus the shared design-content scanner codes. */
  code: PublishPackageIssueCode | DesignContentIssueCode;
  path: string;
  message: string;
}

export type PublishPackageParseResult<T> =
  | { ok: true; value: T }
  | { ok: false; reason: string; issues: PublishPackageIssue[] };

type UnknownRecord = Record<string, unknown>;

const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const ISO_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;
const SHA256_PATTERN = /^[0-9a-f]{64}$/;
const COLOR_PATTERN = /^#[0-9a-f]{6}(?:[0-9a-f]{2})?$/;
const FINISH_TYPES = ['gloss', 'matte', 'frosted'] as const;

/**
 * EditorDocV7 document-carrying keys that must never appear in a publish
 * package: their presence means a document was embedded instead of referenced.
 */
const PUBLISH_EMBEDDED_EDITOR_DOC_KEYS: readonly string[] = [
  'editorDoc',
  'editorDocument',
  'editorDocSnapshot',
  'customerRef',
  'title',
  'nails',
  'recipeInstances',
  'compositionMeta',
  'sourceRefs',
  'communicationRefs',
  'outputIntent',
  'steps',
  'createdAt',
  'updatedAt',
];

const PACKAGE_REQUIRED_FIELDS: readonly string[] = [
  'schemaVersion',
  'packageId',
  'designVersionId',
  'designId',
  'version',
  'revision',
  'rendererRevision',
  'generatedAt',
  'fidelity',
  'cover',
  'details',
  'nailDescriptors',
  'palette',
  'shapeIds',
  'lengthIds',
  'geometry',
  'assetManifest',
];
const PACKAGE_ALLOWED_KEYS: readonly string[] = PACKAGE_REQUIRED_FIELDS;

const OUTPUT_REQUIRED_FIELDS: readonly string[] = [
  'kind',
  'assetId',
  'revision',
  'sha256',
  'mimeType',
  'width',
  'height',
  'colorSpace',
  'fidelity',
  'rendererId',
  'rendererRevision',
  'sourceDesignVersionId',
  'sourceVersion',
  'sourceRevision',
];
const OUTPUT_ALLOWED_KEYS: readonly string[] = [...OUTPUT_REQUIRED_FIELDS, 'finger', 'fallbackReason'];
const COVER_ALLOWED_KEYS: readonly string[] = OUTPUT_ALLOWED_KEYS.filter((key) => key !== 'finger');

const NAIL_DESCRIPTOR_REQUIRED_FIELDS: readonly string[] = ['finger', 'finishType', 'detailAssetId', 'fidelity'];
const NAIL_DESCRIPTOR_ALLOWED_KEYS: readonly string[] = NAIL_DESCRIPTOR_REQUIRED_FIELDS;

const GEOMETRY_COMMON_FIELDS: readonly string[] = ['finger', 'assetId', 'revision', 'status'];
const GEOMETRY_RESOLVED_ALLOWED_KEYS: readonly string[] = [...GEOMETRY_COMMON_FIELDS, 'shapeId', 'lengthId'];
const GEOMETRY_UNRESOLVED_ALLOWED_KEYS: readonly string[] = [...GEOMETRY_COMMON_FIELDS, 'reason'];

const MANIFEST_REQUIRED_FIELDS: readonly string[] = [
  'schemaVersion',
  'geometryRefs',
  'assetRevisionRefs',
  'materialRevisionRefs',
  'recipeRevisionRefs',
  'sourceRefs',
  'compositionMeta',
  'compositionProvenance',
  'rendererEvidence',
];
const MANIFEST_ALLOWED_KEYS: readonly string[] = MANIFEST_REQUIRED_FIELDS;

const GEOMETRY_REF_ALLOWED_KEYS: readonly string[] = ['finger', 'assetId', 'revision'];
const ASSET_REF_ALLOWED_KEYS: readonly string[] = ['assetId', 'revision', 'sha256', 'mimeType'];
const MATERIAL_REF_ALLOWED_KEYS: readonly string[] = ['materialId', 'revision'];
const RECIPE_REF_ALLOWED_KEYS: readonly string[] = ['recipeId', 'revision'];
const SOURCE_REF_ALLOWED_KEYS: readonly string[] = ['domain', 'sourceId', 'revision'];
const COMPOSITION_META_ALLOWED_KEYS: readonly string[] = ['compositionId', 'revision', 'source'];
const COMPOSITION_PROVENANCE_ALLOWED_KEYS: readonly string[] = ['finger', 'compositionId', 'revision', 'syncState'];

const SOURCE_DOMAINS = ['community', 'wizard', 'manual', 'legacy'] as const;
const SYNC_STATES = ['linked', 'detached'] as const;

function record(value: unknown): UnknownRecord | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as UnknownRecord)
    : null;
}

function describe(value: unknown): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  const type = typeof value;
  if (type === 'object') return 'object';
  return type;
}

function addIssue(
  issues: PublishPackageIssue[],
  code: PublishPackageIssueCode | DesignContentIssueCode,
  path: string,
  message: string,
): void {
  if (issues.length < MAX_ISSUES) issues.push({ code, path, message });
}

function failResult(
  issues: PublishPackageIssue[],
  code: PublishPackageIssueCode | DesignContentIssueCode,
  path: string,
  message: string,
): PublishPackageParseResult<never> {
  addIssue(issues, code, path, message);
  return { ok: false, reason: message, issues };
}

function checkSchemaVersion(
  raw: UnknownRecord,
  path: string,
  issues: PublishPackageIssue[],
  expected: number,
): void {
  const value = raw['schemaVersion'];
  if (value === undefined) {
    addIssue(issues, 'missing_field', `${path}.schemaVersion`, 'missing required field "schemaVersion"');
  } else if (value !== expected) {
    addIssue(issues, 'schema_version', `${path}.schemaVersion`, `expected schemaVersion ${expected}, got ${String(value)}`);
  }
}

function checkKeys(
  raw: UnknownRecord,
  allowedKeys: readonly string[],
  path: string,
  issues: PublishPackageIssue[],
): void {
  for (const key of Object.keys(raw)) {
    if (!allowedKeys.includes(key)) {
      addIssue(issues, 'unknown_key', `${path}.${key}`, `unknown key "${key}" is not part of the contract`);
    }
  }
}

function readString(
  raw: UnknownRecord,
  key: string,
  path: string,
  issues: PublishPackageIssue[],
  required: boolean,
): string | undefined {
  const value = raw[key];
  if (value === undefined) {
    if (required) addIssue(issues, 'missing_field', `${path}.${key}`, `missing required field "${key}"`);
    return undefined;
  }
  if (typeof value !== 'string') {
    addIssue(issues, 'invalid_type', `${path}.${key}`, `expected string, got ${describe(value)}`);
    return undefined;
  }
  if (required && value.length === 0) {
    addIssue(issues, 'empty_string', `${path}.${key}`, `field "${key}" must not be empty`);
  }
  return value;
}

function readOptionalString(
  raw: UnknownRecord,
  key: string,
  path: string,
  issues: PublishPackageIssue[],
): string | undefined {
  return readString(raw, key, path, issues, false);
}

function readId(
  raw: UnknownRecord,
  key: string,
  path: string,
  issues: PublishPackageIssue[],
  required: boolean,
): string | undefined {
  const value = readString(raw, key, path, issues, required);
  if (value !== undefined && !ID_PATTERN.test(value)) {
    addIssue(issues, 'invalid_id', `${path}.${key}`, `invalid id "${value}"`);
  }
  return value;
}

function readTimestamp(
  raw: UnknownRecord,
  key: string,
  path: string,
  issues: PublishPackageIssue[],
  required: boolean,
): string | undefined {
  const value = readString(raw, key, path, issues, required);
  if (value !== undefined && (!ISO_PATTERN.test(value) || Number.isNaN(Date.parse(value)))) {
    addIssue(issues, 'invalid_timestamp', `${path}.${key}`, `invalid ISO-8601 UTC timestamp "${value}"`);
  }
  return value;
}

function readEnum<T extends string>(
  raw: UnknownRecord,
  key: string,
  allowed: readonly T[],
  path: string,
  issues: PublishPackageIssue[],
  required: boolean,
): T | undefined {
  const value = readString(raw, key, path, issues, required);
  if (value !== undefined && !(allowed as readonly string[]).includes(value)) {
    addIssue(issues, 'invalid_enum', `${path}.${key}`, `invalid value "${value}" for "${key}"`);
    return undefined;
  }
  return value as T | undefined;
}

function readPositiveInt(
  raw: UnknownRecord,
  key: string,
  path: string,
  issues: PublishPackageIssue[],
  required: boolean,
): number | undefined {
  const value = raw[key];
  if (value === undefined) {
    if (required) addIssue(issues, 'missing_field', `${path}.${key}`, `missing required field "${key}"`);
    return undefined;
  }
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    addIssue(issues, 'invalid_type', `${path}.${key}`, `expected positive integer, got ${describe(value)}`);
    return undefined;
  }
  if (value < 1) {
    addIssue(issues, 'invalid_positive_int', `${path}.${key}`, `field "${key}" must be a positive integer, got ${value}`);
    return undefined;
  }
  return value;
}

function readSha256(
  raw: UnknownRecord,
  key: string,
  path: string,
  issues: PublishPackageIssue[],
  required: boolean,
): string | undefined {
  const value = readString(raw, key, path, issues, required);
  if (value !== undefined && !SHA256_PATTERN.test(value)) {
    addIssue(issues, 'invalid_hash', `${path}.${key}`, `invalid SHA-256 hex digest "${value}"`);
  }
  return value;
}

function readFinger(
  raw: UnknownRecord,
  key: string,
  path: string,
  issues: PublishPackageIssue[],
  required: boolean,
): FingerCode | undefined {
  const value = readString(raw, key, path, issues, required);
  if (value !== undefined && !(FINGER_CODES as readonly string[]).includes(value)) {
    addIssue(issues, 'invalid_enum', `${path}.${key}`, `invalid finger code "${value}"`);
    return undefined;
  }
  return value as FingerCode | undefined;
}

/**
 * Sorted unique string list (palette/shapeIds/lengthIds). Entries must be
 * non-empty, unique and strictly ascending (stable canonical order).
 */
function readSortedUniqueList(
  raw: UnknownRecord,
  key: string,
  path: string,
  issues: PublishPackageIssue[],
  required: boolean,
): string[] | undefined {
  const value = raw[key];
  if (value === undefined) {
    if (required) addIssue(issues, 'missing_field', `${path}.${key}`, `missing required field "${key}"`);
    return undefined;
  }
  if (!Array.isArray(value)) {
    addIssue(issues, 'invalid_type', `${path}.${key}`, `expected array of strings, got ${describe(value)}`);
    return undefined;
  }
  const seen = new Set<string>();
  let previous: string | undefined;
  for (let i = 0; i < value.length; i += 1) {
    const itemPath = `${path}.${key}[${i}]`;
    const item = value[i];
    if (typeof item !== 'string') {
      addIssue(issues, 'invalid_type', itemPath, `expected string, got ${describe(item)}`);
      continue;
    }
    if (item.length === 0) {
      addIssue(issues, 'empty_string', itemPath, `"${key}" entries must not be empty`);
      continue;
    }
    if (seen.has(item)) {
      addIssue(issues, 'duplicate_entry', itemPath, `duplicate ${key} entry "${item}"`);
      continue;
    }
    if (previous !== undefined && previous >= item) {
      addIssue(issues, 'list_not_sorted', itemPath, `"${key}" entries must be unique and sorted ascending ("${previous}" >= "${item}")`);
    }
    seen.add(item);
    previous = item;
  }
  return value as string[];
}

function readPalette(raw: UnknownRecord, path: string, issues: PublishPackageIssue[]): void {
  const value = readSortedUniqueList(raw, 'palette', path, issues, true);
  if (value === undefined) return;
  if (value.length === 0) {
    addIssue(issues, 'empty_palette', `${path}.palette`, 'palette must list at least one color');
    return;
  }
  value.forEach((color, index) => {
    if (!COLOR_PATTERN.test(color)) {
      addIssue(issues, 'invalid_color', `${path}.palette[${index}]`, `invalid normalized color "${color}"`);
    }
  });
}

function parseOutputObject(
  obj: UnknownRecord,
  itemPath: string,
  issues: PublishPackageIssue[],
  allowedKeys: readonly string[],
  expectedKind: 'COVER' | 'DETAIL',
): { assetId?: string; finger?: FingerCode; fidelity?: 'EXACT' | 'APPROXIMATE' } {
  checkKeys(obj, allowedKeys, itemPath, issues);
  const kind = readEnum(obj, 'kind', PUBLISH_OUTPUT_KINDS_V1, itemPath, issues, true);
  if (kind !== undefined && kind !== expectedKind) {
    addIssue(issues, 'invalid_enum', `${itemPath}.kind`, `expected kind "${expectedKind}", got "${kind}"`);
  }
  const assetId = readId(obj, 'assetId', itemPath, issues, true);
  readPositiveInt(obj, 'revision', itemPath, issues, true);
  readSha256(obj, 'sha256', itemPath, issues, true);
  readEnum(obj, 'mimeType', PUBLISH_OUTPUT_MIME_V1, itemPath, issues, true);
  readPositiveInt(obj, 'width', itemPath, issues, true);
  readPositiveInt(obj, 'height', itemPath, issues, true);
  readEnum(obj, 'colorSpace', PUBLISH_COLOR_SPACES_V1, itemPath, issues, true);
  const fidelity = readEnum(obj, 'fidelity', PUBLISH_FIDELITIES_V1, itemPath, issues, true);
  readEnum(obj, 'fallbackReason', PUBLISH_FALLBACK_REASONS_V1, itemPath, issues, false);
  readString(obj, 'rendererId', itemPath, issues, true);
  readString(obj, 'rendererRevision', itemPath, issues, true);
  readId(obj, 'sourceDesignVersionId', itemPath, issues, true);
  readPositiveInt(obj, 'sourceVersion', itemPath, issues, true);
  readPositiveInt(obj, 'sourceRevision', itemPath, issues, true);
  const finger = readFinger(obj, 'finger', itemPath, issues, false);
  return { assetId, finger, fidelity };
}

function parseCover(raw: UnknownRecord, path: string, issues: PublishPackageIssue[]): void {
  const value = raw['cover'];
  if (value === undefined) {
    addIssue(issues, 'missing_field', `${path}.cover`, 'missing required field "cover"');
    return;
  }
  const obj = record(value);
  if (!obj) {
    addIssue(issues, 'invalid_type', `${path}.cover`, `expected cover output object, got ${describe(value)}`);
    return;
  }
  parseOutputObject(obj, `${path}.cover`, issues, COVER_ALLOWED_KEYS, 'COVER');
}

function parseDetails(raw: UnknownRecord, path: string, issues: PublishPackageIssue[]): void {
  const value = raw['details'];
  if (value === undefined) {
    addIssue(issues, 'missing_field', `${path}.details`, 'missing required field "details"');
    return;
  }
  if (!Array.isArray(value)) {
    addIssue(issues, 'invalid_type', `${path}.details`, `expected array of DETAIL outputs, got ${describe(value)}`);
    return;
  }
  if (value.length !== FINGER_CODES.length) {
    addIssue(issues, 'detail_count', `${path}.details`, `expected ${FINGER_CODES.length} DETAIL outputs, got ${value.length}`);
  }
  const seen = new Set<string>();
  for (let i = 0; i < value.length; i += 1) {
    const itemPath = `${path}.details[${i}]`;
    const item = record(value[i]);
    if (!item) {
      addIssue(issues, 'invalid_type', itemPath, `expected DETAIL output object, got ${describe(value[i])}`);
      continue;
    }
    const parsed = parseOutputObject(item, itemPath, issues, OUTPUT_ALLOWED_KEYS, 'DETAIL');
    if (i < FINGER_CODES.length) {
      if (parsed.finger !== FINGER_CODES[i]) {
        addIssue(
          issues,
          'finger_mismatch',
          `${itemPath}.finger`,
          `DETAIL[${i}] must be finger "${FINGER_CODES[i]}", got "${parsed.finger ?? 'missing'}"`,
        );
      }
      if (parsed.finger !== undefined) {
        if (seen.has(parsed.finger)) addIssue(issues, 'duplicate_entry', `${itemPath}.finger`, `duplicate detail finger "${parsed.finger}"`);
        seen.add(parsed.finger);
      }
    }
  }
}

function parseNailDescriptors(raw: UnknownRecord, path: string, issues: PublishPackageIssue[]): void {
  const value = raw['nailDescriptors'];
  if (value === undefined) {
    addIssue(issues, 'missing_field', `${path}.nailDescriptors`, 'missing required field "nailDescriptors"');
    return;
  }
  if (!Array.isArray(value)) {
    addIssue(issues, 'invalid_type', `${path}.nailDescriptors`, `expected array of nail descriptors, got ${describe(value)}`);
    return;
  }
  if (value.length !== FINGER_CODES.length) {
    addIssue(issues, 'detail_count', `${path}.nailDescriptors`, `expected ${FINGER_CODES.length} nail descriptors, got ${value.length}`);
  }
  for (let i = 0; i < value.length; i += 1) {
    const itemPath = `${path}.nailDescriptors[${i}]`;
    const item = record(value[i]);
    if (!item) {
      addIssue(issues, 'invalid_type', itemPath, `expected nail descriptor object, got ${describe(value[i])}`);
      continue;
    }
    checkKeys(item, NAIL_DESCRIPTOR_ALLOWED_KEYS, itemPath, issues);
    const finger = readFinger(item, 'finger', itemPath, issues, true);
    readEnum(item, 'finishType', FINISH_TYPES, itemPath, issues, true);
    readId(item, 'detailAssetId', itemPath, issues, true);
    readEnum(item, 'fidelity', PUBLISH_FIDELITIES_V1, itemPath, issues, true);
    if (i < FINGER_CODES.length && finger !== undefined && finger !== FINGER_CODES[i]) {
      addIssue(issues, 'finger_mismatch', `${itemPath}.finger`, `nailDescriptors[${i}] must be finger "${FINGER_CODES[i]}", got "${finger}"`);
    }
  }
}

function parseGeometry(raw: UnknownRecord, path: string, issues: PublishPackageIssue[]): void {
  const value = raw['geometry'];
  if (value === undefined) {
    addIssue(issues, 'missing_field', `${path}.geometry`, 'missing required field "geometry"');
    return;
  }
  if (!Array.isArray(value)) {
    addIssue(issues, 'invalid_type', `${path}.geometry`, `expected array of geometry entries, got ${describe(value)}`);
    return;
  }
  if (value.length !== FINGER_CODES.length) {
    addIssue(issues, 'detail_count', `${path}.geometry`, `expected ${FINGER_CODES.length} geometry entries, got ${value.length}`);
  }
  for (let i = 0; i < value.length; i += 1) {
    const itemPath = `${path}.geometry[${i}]`;
    const item = record(value[i]);
    if (!item) {
      addIssue(issues, 'invalid_type', itemPath, `expected geometry entry object, got ${describe(value[i])}`);
      continue;
    }
    const finger = readFinger(item, 'finger', itemPath, issues, true);
    readId(item, 'assetId', itemPath, issues, true);
    readString(item, 'revision', itemPath, issues, true);
    const status = readEnum(item, 'status', ['resolved', 'unresolved'], itemPath, issues, true);
    if (status === 'resolved') {
      checkKeys(item, GEOMETRY_RESOLVED_ALLOWED_KEYS, itemPath, issues);
      readId(item, 'shapeId', itemPath, issues, true);
      readId(item, 'lengthId', itemPath, issues, true);
    } else if (status === 'unresolved') {
      checkKeys(item, GEOMETRY_UNRESOLVED_ALLOWED_KEYS, itemPath, issues);
      readString(item, 'reason', itemPath, issues, true);
    }
    if (i < FINGER_CODES.length && finger !== undefined && finger !== FINGER_CODES[i]) {
      addIssue(issues, 'finger_mismatch', `${itemPath}.finger`, `geometry[${i}] must be finger "${FINGER_CODES[i]}", got "${finger}"`);
    }
  }
}

function parseSourceRef(obj: UnknownRecord, path: string, issues: PublishPackageIssue[]): void {
  checkKeys(obj, SOURCE_REF_ALLOWED_KEYS, path, issues);
  readEnum(obj, 'domain', SOURCE_DOMAINS, path, issues, true);
  readId(obj, 'sourceId', path, issues, true);
  readOptionalString(obj, 'revision', path, issues);
}

function parseCompositionProvenance(raw: UnknownRecord, path: string, issues: PublishPackageIssue[]): void {
  const value = raw['compositionProvenance'];
  if (value === undefined) {
    addIssue(issues, 'missing_field', `${path}.compositionProvenance`, 'missing required field "compositionProvenance"');
    return;
  }
  if (!Array.isArray(value)) {
    addIssue(issues, 'invalid_type', `${path}.compositionProvenance`, `expected array of provenance entries, got ${describe(value)}`);
    return;
  }
  const seen = new Set<string>();
  for (let i = 0; i < value.length; i += 1) {
    const itemPath = `${path}.compositionProvenance[${i}]`;
    const item = record(value[i]);
    if (!item) {
      addIssue(issues, 'invalid_type', itemPath, `expected provenance entry object, got ${describe(value[i])}`);
      continue;
    }
    checkKeys(item, COMPOSITION_PROVENANCE_ALLOWED_KEYS, itemPath, issues);
    const finger = readFinger(item, 'finger', itemPath, issues, true);
    readId(item, 'compositionId', itemPath, issues, true);
    readString(item, 'revision', itemPath, issues, true);
    readEnum(item, 'syncState', SYNC_STATES, itemPath, issues, true);
    if (finger !== undefined) {
      if (seen.has(finger)) addIssue(issues, 'duplicate_entry', `${itemPath}.finger`, `duplicate provenance finger "${finger}"`);
      seen.add(finger);
    }
  }
}

function parseManifestRefs(raw: UnknownRecord, path: string, issues: PublishPackageIssue[]): void {
  const geometryRefs = raw['geometryRefs'];
  if (geometryRefs === undefined) {
    addIssue(issues, 'missing_field', `${path}.geometryRefs`, 'missing required field "geometryRefs"');
  } else if (!Array.isArray(geometryRefs) || geometryRefs.length !== FINGER_CODES.length) {
    addIssue(issues, 'invalid_type', `${path}.geometryRefs`, `expected ${FINGER_CODES.length} geometry refs, got ${describe(geometryRefs)}`);
  } else {
    for (let i = 0; i < geometryRefs.length; i += 1) {
      const itemPath = `${path}.geometryRefs[${i}]`;
      const item = record(geometryRefs[i]);
      if (!item) {
        addIssue(issues, 'invalid_type', itemPath, `expected geometry ref object, got ${describe(geometryRefs[i])}`);
        continue;
      }
      checkKeys(item, GEOMETRY_REF_ALLOWED_KEYS, itemPath, issues);
      const finger = readFinger(item, 'finger', itemPath, issues, true);
      readId(item, 'assetId', itemPath, issues, true);
      readString(item, 'revision', itemPath, issues, true);
      if (finger !== undefined && finger !== FINGER_CODES[i]) {
        addIssue(issues, 'finger_mismatch', `${itemPath}.finger`, `geometryRefs[${i}] must be finger "${FINGER_CODES[i]}", got "${finger}"`);
      }
    }
  }

  const assetRevisionRefs = raw['assetRevisionRefs'];
  if (assetRevisionRefs === undefined) {
    addIssue(issues, 'missing_field', `${path}.assetRevisionRefs`, 'missing required field "assetRevisionRefs"');
  } else if (!Array.isArray(assetRevisionRefs)) {
    addIssue(issues, 'invalid_type', `${path}.assetRevisionRefs`, `expected array of asset refs, got ${describe(assetRevisionRefs)}`);
  } else {
    const seen = new Set<string>();
    for (let i = 0; i < assetRevisionRefs.length; i += 1) {
      const itemPath = `${path}.assetRevisionRefs[${i}]`;
      const item = record(assetRevisionRefs[i]);
      if (!item) {
        addIssue(issues, 'invalid_type', itemPath, `expected asset ref object, got ${describe(assetRevisionRefs[i])}`);
        continue;
      }
      checkKeys(item, ASSET_REF_ALLOWED_KEYS, itemPath, issues);
      const assetId = readId(item, 'assetId', itemPath, issues, true);
      const revision = readPositiveInt(item, 'revision', itemPath, issues, true);
      readSha256(item, 'sha256', itemPath, issues, true);
      readOptionalString(item, 'mimeType', itemPath, issues);
      if (typeof assetId === 'string' && typeof revision === 'number') {
        const refKey = `${assetId}#${revision}`;
        if (seen.has(refKey)) addIssue(issues, 'duplicate_asset_ref', itemPath, `duplicate immutable asset revision "${refKey}"`);
        seen.add(refKey);
      }
    }
  }

  for (const [key, allowed, idKey, label] of [
    ['materialRevisionRefs', MATERIAL_REF_ALLOWED_KEYS, 'materialId', 'material'],
    ['recipeRevisionRefs', RECIPE_REF_ALLOWED_KEYS, 'recipeId', 'recipe'],
  ] as const) {
    const list = raw[key];
    if (list === undefined) {
      addIssue(issues, 'missing_field', `${path}.${key}`, `missing required field "${key}"`);
      continue;
    }
    if (!Array.isArray(list)) {
      addIssue(issues, 'invalid_type', `${path}.${key}`, `expected array of ${label} refs, got ${describe(list)}`);
      continue;
    }
    const seen = new Set<string>();
    for (let i = 0; i < list.length; i += 1) {
      const itemPath = `${path}.${key}[${i}]`;
      const item = record(list[i]);
      if (!item) {
        addIssue(issues, 'invalid_type', itemPath, `expected ${label} ref object, got ${describe(list[i])}`);
        continue;
      }
      checkKeys(item, allowed, itemPath, issues);
      const id = readId(item, idKey, itemPath, issues, true);
      const revision = readString(item, 'revision', itemPath, issues, true);
      if (typeof id === 'string' && typeof revision === 'string') {
        const refKey = `${id}#${revision}`;
        if (seen.has(refKey)) addIssue(issues, 'duplicate_asset_ref', itemPath, `duplicate ${label} revision "${refKey}"`);
        seen.add(refKey);
      }
    }
  }

  const sourceRefs = raw['sourceRefs'];
  if (sourceRefs === undefined) {
    addIssue(issues, 'missing_field', `${path}.sourceRefs`, 'missing required field "sourceRefs"');
  } else if (!Array.isArray(sourceRefs)) {
    addIssue(issues, 'invalid_type', `${path}.sourceRefs`, `expected array of source refs, got ${describe(sourceRefs)}`);
  } else {
    for (let i = 0; i < sourceRefs.length; i += 1) {
      const itemPath = `${path}.sourceRefs[${i}]`;
      const item = record(sourceRefs[i]);
      if (!item) {
        addIssue(issues, 'invalid_type', itemPath, `expected source ref object, got ${describe(sourceRefs[i])}`);
        continue;
      }
      parseSourceRef(item, itemPath, issues);
    }
  }

  const compositionMeta = raw['compositionMeta'];
  if (compositionMeta !== undefined) {
    const obj = record(compositionMeta);
    if (!obj) {
      addIssue(issues, 'invalid_type', `${path}.compositionMeta`, `expected composition meta object, got ${describe(compositionMeta)}`);
    } else {
      checkKeys(obj, COMPOSITION_META_ALLOWED_KEYS, `${path}.compositionMeta`, issues);
      readId(obj, 'compositionId', `${path}.compositionMeta`, issues, true);
      readString(obj, 'revision', `${path}.compositionMeta`, issues, true);
      const source = obj['source'];
      if (source !== undefined) {
        const sourceObj = record(source);
        if (!sourceObj) {
          addIssue(issues, 'invalid_type', `${path}.compositionMeta.source`, `expected source ref object, got ${describe(source)}`);
        } else {
          parseSourceRef(sourceObj, `${path}.compositionMeta.source`, issues);
        }
      }
    }
  }

  parseCompositionProvenance(raw, path, issues);
  const rendererEvidence = raw['rendererEvidence'];
  if (rendererEvidence === undefined) {
    addIssue(issues, 'missing_field', `${path}.rendererEvidence`, 'missing required field "rendererEvidence"');
  } else if (rendererEvidence !== RENDERER_EVIDENCE_UNAVAILABLE) {
    addIssue(issues, 'invalid_enum', `${path}.rendererEvidence`, `expected "${RENDERER_EVIDENCE_UNAVAILABLE}", got ${describe(rendererEvidence)}`);
  }
}

function parseManifest(raw: UnknownRecord, path: string, issues: PublishPackageIssue[]): void {
  checkSchemaVersion(raw, path, issues, PUBLISH_PACKAGE_SCHEMA_VERSION);
  checkKeys(raw, MANIFEST_ALLOWED_KEYS, path, issues);
  parseManifestRefs(raw, path, issues);
}

function crossCheckOutputs(pkg: UnknownRecord, issues: PublishPackageIssue[]): void {
  const designVersionId = pkg['designVersionId'];
  const version = pkg['version'];
  const revision = pkg['revision'];
  const rendererRevision = pkg['rendererRevision'];
  const outputs: Array<{ path: string; value: unknown }> = [{ path: 'cover', value: pkg['cover'] }];
  const details = pkg['details'];
  if (Array.isArray(details)) {
    details.forEach((detail, index) => outputs.push({ path: `details[${index}]`, value: detail }));
  }
  let allExact = true;
  let sawFidelity = false;
  const assetIds = new Set<string>(typeof pkg['packageId'] === 'string' ? [pkg['packageId']] : []);
  for (const { path, value } of outputs) {
    const obj = record(value);
    if (!obj) continue;
    const sourceDesignVersionId = obj['sourceDesignVersionId'];
    if (designVersionId !== undefined && typeof sourceDesignVersionId === 'string' && sourceDesignVersionId !== designVersionId) {
      addIssue(issues, 'source_mismatch', `${path}.sourceDesignVersionId`, `output source design version "${sourceDesignVersionId}" does not match package "${designVersionId}"`);
    }
    if (typeof version === 'number' && typeof obj['sourceVersion'] === 'number' && obj['sourceVersion'] !== version) {
      addIssue(issues, 'source_mismatch', `${path}.sourceVersion`, `output source version ${obj['sourceVersion']} does not match package ${version}`);
    }
    if (typeof revision === 'number' && typeof obj['sourceRevision'] === 'number' && obj['sourceRevision'] !== revision) {
      addIssue(issues, 'source_mismatch', `${path}.sourceRevision`, `output source revision ${obj['sourceRevision']} does not match package ${revision}`);
    }
    if (rendererRevision !== undefined && typeof obj['rendererRevision'] === 'string' && obj['rendererRevision'] !== rendererRevision) {
      addIssue(issues, 'ref_mismatch', `${path}.rendererRevision`, `output renderer revision "${obj['rendererRevision']}" does not match package "${rendererRevision}"`);
    }
    if (obj['fidelity'] !== undefined) {
      sawFidelity = true;
      if (obj['fidelity'] !== 'EXACT') allExact = false;
    }
    if (typeof obj['assetId'] === 'string') {
      if (assetIds.has(obj['assetId'])) {
        addIssue(issues, 'duplicate_asset_ref', `${path}.assetId`, `duplicate derived output asset id "${obj['assetId']}"`);
      }
      assetIds.add(obj['assetId']);
    }
    if (obj['fallbackReason'] !== undefined && obj['fidelity'] === 'EXACT') {
      addIssue(issues, 'fidelity_mismatch', `${path}.fidelity`, 'an output with fallbackReason must be APPROXIMATE');
    }
    if (obj['fidelity'] === 'APPROXIMATE' && obj['fallbackReason'] === undefined) {
      addIssue(issues, 'missing_field', `${path}.fallbackReason`, 'APPROXIMATE output must carry a stable explanation code');
    }
    if (obj['kind'] === 'DETAIL' && obj['finger'] === undefined) {
      addIssue(issues, 'missing_field', `${path}.finger`, 'DETAIL outputs must carry a finger');
    }
  }
  if (sawFidelity && pkg['fidelity'] !== undefined) {
    const expected = allExact ? 'EXACT' : 'APPROXIMATE';
    if (pkg['fidelity'] !== expected) {
      addIssue(issues, 'fidelity_mismatch', 'fidelity', `package fidelity must be "${expected}" when every output is ${allExact ? 'EXACT' : 'not EXACT'}`);
    }
  }
}

function crossCheckGeometry(pkg: UnknownRecord, issues: PublishPackageIssue[]): void {
  const geometry = pkg['geometry'];
  const manifest = record(pkg['assetManifest']);
  const manifestGeometry = manifest?.['geometryRefs'];
  if (!Array.isArray(geometry) || !Array.isArray(manifestGeometry)) return;
  const resolvedShapes = new Set<string>();
  const resolvedLengths = new Set<string>();
  for (let index = 0; index < Math.min(geometry.length, manifestGeometry.length, FINGER_CODES.length); index += 1) {
    const entry = record(geometry[index]);
    const source = record(manifestGeometry[index]);
    if (!entry || !source) continue;
    if (entry['finger'] !== source['finger'] || entry['assetId'] !== source['assetId'] || entry['revision'] !== source['revision']) {
      addIssue(issues, 'ref_mismatch', `geometry[${index}]`, 'geometry summary must reference the matching immutable manifest geometry');
    }
    if (entry['status'] === 'resolved') {
      if (typeof entry['shapeId'] === 'string') resolvedShapes.add(entry['shapeId']);
      if (typeof entry['lengthId'] === 'string') resolvedLengths.add(entry['lengthId']);
    }
  }
  const expectedShapes = [...resolvedShapes].sort();
  const expectedLengths = [...resolvedLengths].sort();
  if (Array.isArray(pkg['shapeIds']) && JSON.stringify(pkg['shapeIds']) !== JSON.stringify(expectedShapes)) {
    addIssue(issues, 'ref_mismatch', 'shapeIds', 'shapeIds must equal the canonical resolved geometry summary');
  }
  if (Array.isArray(pkg['lengthIds']) && JSON.stringify(pkg['lengthIds']) !== JSON.stringify(expectedLengths)) {
    addIssue(issues, 'ref_mismatch', 'lengthIds', 'lengthIds must equal the canonical resolved geometry summary');
  }
}

function crossCheckDescriptors(pkg: UnknownRecord, issues: PublishPackageIssue[]): void {
  const details = pkg['details'];
  const descriptors = pkg['nailDescriptors'];
  if (!Array.isArray(details) || !Array.isArray(descriptors)) return;
  for (let i = 0; i < Math.min(details.length, descriptors.length, FINGER_CODES.length); i += 1) {
    const detail = record(details[i]);
    const descriptor = record(descriptors[i]);
    if (!detail || !descriptor) continue;
    if (descriptor['detailAssetId'] !== undefined && detail['assetId'] !== undefined && descriptor['detailAssetId'] !== detail['assetId']) {
      addIssue(issues, 'ref_mismatch', `nailDescriptors[${i}].detailAssetId`, `descriptor asset "${descriptor['detailAssetId']}" does not match details[${i}].assetId "${detail['assetId']}"`);
    }
    if (descriptor['fidelity'] !== undefined && detail['fidelity'] !== undefined && descriptor['fidelity'] !== detail['fidelity']) {
      addIssue(issues, 'fidelity_mismatch', `nailDescriptors[${i}].fidelity`, `descriptor fidelity "${descriptor['fidelity']}" does not match details[${i}].fidelity "${detail['fidelity']}"`);
    }
  }
}

/** Strict parser: unknown-key rejection, no EditorDoc/customer/manufacturing/device/runtime state. */
export function parsePublishPackageV1(input: unknown): PublishPackageParseResult<PublishPackageV1> {
  const issues: PublishPackageIssue[] = [];
  const raw = record(input);
  if (!raw) return failResult(issues, 'not_an_object', '$', `expected an object, got ${describe(input)}`);

  checkSchemaVersion(raw, '$', issues, PUBLISH_PACKAGE_SCHEMA_VERSION);
  checkKeys(raw, PACKAGE_ALLOWED_KEYS, '$', issues);
  for (const key of PUBLISH_EMBEDDED_EDITOR_DOC_KEYS) {
    if (raw[key] !== undefined) {
      addIssue(
        issues,
        'embedded_editor_doc',
        `$.${key}`,
        `key "${key}" embeds EditorDocV7 content; PublishPackageV1 only references the immutable DesignVersion by id and never copies the document`,
      );
    }
  }

  readId(raw, 'packageId', '$', issues, true);
  readId(raw, 'designVersionId', '$', issues, true);
  readId(raw, 'designId', '$', issues, true);
  readPositiveInt(raw, 'version', '$', issues, true);
  readPositiveInt(raw, 'revision', '$', issues, true);
  readString(raw, 'rendererRevision', '$', issues, true);
  readTimestamp(raw, 'generatedAt', '$', issues, true);
  readEnum(raw, 'fidelity', PUBLISH_FIDELITIES_V1, '$', issues, true);

  parseCover(raw, '$', issues);
  parseDetails(raw, '$', issues);
  parseNailDescriptors(raw, '$', issues);
  readPalette(raw, '$', issues);
  readSortedUniqueList(raw, 'shapeIds', '$', issues, true);
  readSortedUniqueList(raw, 'lengthIds', '$', issues, true);
  parseGeometry(raw, '$', issues);

  const manifest = raw['assetManifest'];
  if (manifest === undefined) {
    addIssue(issues, 'missing_field', '$.assetManifest', 'missing required field "assetManifest"');
  } else {
    const manifestObj = record(manifest);
    if (!manifestObj) {
      addIssue(issues, 'invalid_type', '$.assetManifest', `expected manifest object, got ${describe(manifest)}`);
    } else {
      parseManifest(manifestObj, '$.assetManifest', issues);
    }
  }

  crossCheckOutputs(raw, issues);
  crossCheckDescriptors(raw, issues);
  crossCheckGeometry(raw, issues);

  // Shared community scanners emit their own issue shape; merge bounded issues.
  const scanned: DesignContentIssue[] = [];
  scanForbiddenPrivateKeys(raw, '$', scanned);
  scanForbiddenDeviceManufacturingKeys(raw, '$', scanned);
  for (const issue of scanned) {
    addIssue(issues, issue.code, issue.path, issue.message);
  }

  if (issues.length > 0) {
    return {
      ok: false,
      reason: `publish package contract validation failed with ${issues.length} issue(s)`,
      issues,
    };
  }
  return { ok: true, value: raw as unknown as PublishPackageV1 };
}

// ---------------------------------------------------------------------------
// Type-level helpers reused by the generator
// ---------------------------------------------------------------------------

/** Validate a GeometryResolutionV1 produced by an injected registry. */
export function normalizeGeometryResolution(
  resolution: GeometryResolutionV1,
): { ok: true; status: 'resolved'; shapeId: string; lengthId: string }
  | { ok: true; status: 'unresolved'; reason: string }
  | { ok: false } {
  if (resolution === null || typeof resolution !== 'object') return { ok: false };
  if (resolution.status === 'resolved') {
    const { shapeId, lengthId } = resolution;
    if (typeof shapeId !== 'string' || shapeId.length === 0 || typeof lengthId !== 'string' || lengthId.length === 0) {
      return { ok: false };
    }
    return { ok: true, status: 'resolved', shapeId, lengthId };
  }
  if (resolution.status === 'unresolved') {
    if (typeof resolution.reason !== 'string' || resolution.reason.length === 0) return { ok: false };
    return { ok: true, status: 'unresolved', reason: resolution.reason };
  }
  return { ok: false };
}

/** Deep-clone helper shared with the generator. */
export function clonePublishPackageV1<T>(value: T): T {
  return structuredClone(value);
}
