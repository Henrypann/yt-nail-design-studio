/**
 * Community V7.1 · GEN-V7.1-02 strict runtime parsers and validators
 * (dependency-free).
 *
 * Every `parse*` function:
 *  - never throws, even for null / primitives / arrays / symbols / bigints /
 *    cyclic objects / deeply malformed input;
 *  - never mutates its input (successful parses return the input object as-is);
 *  - reports bounded issues (at most MAX_ISSUES) with stable code + path.
 *
 * Rejections include: unknown keys, malformed ids/hashes/timestamps/positive
 * integers, duplicate asset refs/tags/palette entries, embedded EditorDoc
 * content, self parent version, remix source == target, dangling/inconsistent
 * internal refs (editorDocRef vs designId/revision, look refs colliding with
 * lookId), PUBLIC looks without copyright/source/moderation clearance,
 * PUBLISHED looks without publishedAt, DRAFT looks carrying publishedAt,
 * status/visibility conflicts, leaked forbidden private keys (GEN-01 privacy
 * scanner) and device/manufacturing fields.
 */

import {
  DESIGN_LOOK_STATUS_V1,
  PREVIEW_FIDELITY_V1,
  PREVIEW_KIND_V1,
  PREVIEW_MIME_V1,
  VISIBILITY_V1,
  type DesignLookStatusV1,
  type DesignVersionV1,
  type PublishedLookV1,
  type RemixRelationV1,
  type VisibilityV1,
} from './design-content-model.ts';
import {
  DESIGN_VERSION_V1_ALLOWED_KEYS,
  EDITOR_DOC_V7_REF_ALLOWED_KEYS,
  FORBIDDEN_DEVICE_MANUFACTURING_KEYS,
  IMMUTABLE_ASSET_REVISION_REF_ALLOWED_KEYS,
  MAX_ISSUES,
  PUBLISHED_LOOK_SUMMARY_ALLOWED_KEYS,
  PUBLISHED_LOOK_V1_ALLOWED_KEYS,
  PUBLISHED_PREVIEW_ASSET_REF_ALLOWED_KEYS,
  REMIX_RELATION_V1_ALLOWED_KEYS,
} from './design-content-contract.ts';
import { parsePublicTransitionPrerequisitesV1 } from './parse.ts';
import { scanForbiddenPrivateKeys } from './privacy.ts';

export type DesignContentIssueCode =
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
  | 'timestamp_order'
  | 'invalid_positive_int'
  | 'empty_asset_revisions'
  | 'duplicate_asset_ref'
  | 'empty_palette'
  | 'duplicate_palette'
  | 'empty_shape_ids'
  | 'duplicate_shape_id'
  | 'empty_length_ids'
  | 'duplicate_length_id'
  | 'duplicate_tag'
  | 'embedded_editor_doc'
  | 'parent_version_self'
  | 'remix_self_target'
  | 'editor_doc_ref_mismatch'
  | 'internal_ref_conflict'
  | 'publication_gate_missing'
  | 'published_at_mismatch'
  | 'status_visibility_conflict'
  | 'forbidden_private_key'
  | 'device_manufacturing_field';

export interface DesignContentIssue {
  code: DesignContentIssueCode;
  path: string;
  message: string;
}

export type DesignContentParseResult<T> =
  | { ok: true; value: T }
  | { ok: false; reason: string; issues: DesignContentIssue[] };

type UnknownRecord = Record<string, unknown>;

const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const ISO_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;
const SHA256_PATTERN = /^[0-9a-f]{64}$/;

/**
 * EditorDocV7 document-carrying keys that must never appear inside
 * `editorDocRef`: their presence means a document was embedded instead of
 * referenced. (designId / schemaVersion / revision are legitimate ref fields.)
 */
const EDITOR_DOC_EMBEDDED_KEYS: readonly string[] = [
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
  issues: DesignContentIssue[],
  code: DesignContentIssueCode,
  path: string,
  message: string,
): void {
  if (issues.length < MAX_ISSUES) issues.push({ code, path, message });
}

function failResult(
  issues: DesignContentIssue[],
  code: DesignContentIssueCode,
  path: string,
  message: string,
): DesignContentParseResult<never> {
  addIssue(issues, code, path, message);
  return { ok: false, reason: message, issues };
}

function checkSchemaVersionValue(
  value: unknown,
  path: string,
  issues: DesignContentIssue[],
  expected: number,
): void {
  if (value === undefined) {
    addIssue(issues, 'missing_field', path, 'missing required field "schemaVersion"');
  } else if (value !== expected) {
    addIssue(issues, 'schema_version', path, `expected schemaVersion ${expected}, got ${String(value)}`);
  }
}

function checkSchemaVersion(raw: UnknownRecord, path: string, issues: DesignContentIssue[]): void {
  checkSchemaVersionValue(raw['schemaVersion'], `${path}.schemaVersion`, issues, 1);
}

function checkKeys(
  raw: UnknownRecord,
  allowedKeys: readonly string[],
  path: string,
  issues: DesignContentIssue[],
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
  issues: DesignContentIssue[],
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
  issues: DesignContentIssue[],
): string | undefined {
  return readString(raw, key, path, issues, false);
}

function readId(
  raw: UnknownRecord,
  key: string,
  path: string,
  issues: DesignContentIssue[],
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
  issues: DesignContentIssue[],
  required: boolean,
): string | undefined {
  const value = readString(raw, key, path, issues, required);
  if (value !== undefined && (!ISO_PATTERN.test(value) || Number.isNaN(Date.parse(value)))) {
    addIssue(issues, 'invalid_timestamp', `${path}.${key}`, `invalid ISO-8601 UTC timestamp "${value}"`);
  }
  return value;
}

function readEnum(
  raw: UnknownRecord,
  key: string,
  allowed: readonly string[],
  path: string,
  issues: DesignContentIssue[],
  required: boolean,
): string | undefined {
  const value = readString(raw, key, path, issues, required);
  if (value !== undefined && !allowed.includes(value)) {
    addIssue(issues, 'invalid_enum', `${path}.${key}`, `invalid value "${value}" for "${key}"`);
  }
  return value;
}

function readPositiveInt(
  raw: UnknownRecord,
  key: string,
  path: string,
  issues: DesignContentIssue[],
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
  issues: DesignContentIssue[],
  required: boolean,
): string | undefined {
  const value = readString(raw, key, path, issues, required);
  if (value !== undefined && !SHA256_PATTERN.test(value)) {
    addIssue(issues, 'invalid_hash', `${path}.${key}`, `invalid SHA-256 hex digest "${value}"`);
  }
  return value;
}

function readVisibility(
  raw: UnknownRecord,
  path: string,
  issues: DesignContentIssue[],
  required: boolean,
): VisibilityV1 | undefined {
  const value = readEnum(raw, 'visibility', VISIBILITY_V1, path, issues, required);
  return value as VisibilityV1 | undefined;
}

function readUniqueStringArray(
  raw: UnknownRecord,
  key: string,
  path: string,
  issues: DesignContentIssue[],
  required: boolean,
  duplicateCode:
    | 'duplicate_tag'
    | 'duplicate_palette'
    | 'duplicate_shape_id'
    | 'duplicate_length_id',
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
      addIssue(issues, duplicateCode, itemPath, `duplicate ${key} entry "${item}"`);
      continue;
    }
    seen.add(item);
  }
  return value as string[];
}

function readTags(raw: UnknownRecord, path: string, issues: DesignContentIssue[]): string[] | undefined {
  return readUniqueStringArray(raw, 'tags', path, issues, true, 'duplicate_tag');
}

function readPalette(raw: UnknownRecord, path: string, issues: DesignContentIssue[]): string[] | undefined {
  const value = readUniqueStringArray(raw, 'palette', path, issues, true, 'duplicate_palette');
  if (value !== undefined && value.length === 0) {
    addIssue(issues, 'empty_palette', `${path}.palette`, 'palette must list at least one color');
  }
  return value;
}

function readRequiredIdList(
  raw: UnknownRecord,
  key: 'shapeIds' | 'lengthIds',
  path: string,
  issues: DesignContentIssue[],
): void {
  const duplicateCode = key === 'shapeIds' ? 'duplicate_shape_id' : 'duplicate_length_id';
  const emptyCode = key === 'shapeIds' ? 'empty_shape_ids' : 'empty_length_ids';
  const value = readUniqueStringArray(raw, key, path, issues, true, duplicateCode);
  if (value !== undefined && value.length === 0) {
    addIssue(issues, emptyCode, `${path}.${key}`, `${key} must list at least one value`);
  }
}

function checkTimestampOrder(raw: UnknownRecord, path: string, issues: DesignContentIssue[]): void {
  const createdAt = readTimestamp(raw, 'createdAt', path, issues, true);
  const updatedAt = readTimestamp(raw, 'updatedAt', path, issues, true);
  if (createdAt !== undefined && updatedAt !== undefined && createdAt > updatedAt) {
    addIssue(
      issues,
      'timestamp_order',
      `${path}.createdAt`,
      `createdAt must not be after updatedAt (${createdAt} > ${updatedAt})`,
    );
  }
}

/** Deep, cycle-safe scan for device/manufacturing keys (see contract). */
export function isForbiddenDeviceManufacturingKey(key: string): boolean {
  return FORBIDDEN_DEVICE_MANUFACTURING_KEYS.includes(key.toLowerCase());
}

export function scanForbiddenDeviceManufacturingKeys(
  value: unknown,
  path: string,
  issues: DesignContentIssue[],
  seen?: WeakSet<object>,
): void {
  if (value === null || typeof value !== 'object') return;
  if (seen === undefined) seen = new WeakSet();
  if (seen.has(value)) return;
  seen.add(value);
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i += 1) {
      scanForbiddenDeviceManufacturingKeys(value[i], `${path}[${i}]`, issues, seen);
    }
    return;
  }
  const obj = value as Record<string, unknown>;
  for (const key of Object.keys(obj)) {
    const childPath = path === '$' ? `$.${key}` : `${path}.${key}`;
    if (isForbiddenDeviceManufacturingKey(key)) {
      addIssue(
        issues,
        'device_manufacturing_field',
        childPath,
        `key "${key}" is a device/manufacturing field and must never appear in design/look content contracts`,
      );
      continue;
    }
    scanForbiddenDeviceManufacturingKeys(obj[key], childPath, issues, seen);
  }
}

function finish<T>(raw: UnknownRecord, issues: DesignContentIssue[]): DesignContentParseResult<T> {
  if (issues.length > 0) {
    return {
      ok: false,
      reason: `design content contract validation failed with ${issues.length} issue(s)`,
      issues,
    };
  }
  return { ok: true, value: raw as T };
}

// ---------------------------------------------------------------------------
// DesignVersionV1
// ---------------------------------------------------------------------------

function parseEditorDocRef(raw: UnknownRecord, path: string, issues: DesignContentIssue[]): UnknownRecord | null {
  const value = raw['editorDocRef'];
  if (value === undefined) {
    addIssue(issues, 'missing_field', `${path}.editorDocRef`, 'missing required field "editorDocRef"');
    return null;
  }
  const obj = record(value);
  if (!obj) {
    addIssue(issues, 'invalid_type', `${path}.editorDocRef`, `expected editorDocRef object, got ${describe(value)}`);
    return null;
  }
  checkKeys(obj, EDITOR_DOC_V7_REF_ALLOWED_KEYS, `${path}.editorDocRef`, issues);
  for (const key of EDITOR_DOC_EMBEDDED_KEYS) {
    if (obj[key] !== undefined) {
      addIssue(
        issues,
        'embedded_editor_doc',
        `${path}.editorDocRef.${key}`,
        `key "${key}" embeds EditorDocV7 content; the contract only allows a designId/schemaVersion/revision/sha256 reference`,
      );
    }
  }
  readId(obj, 'designId', `${path}.editorDocRef`, issues, true);
  checkSchemaVersionValue(obj['schemaVersion'], `${path}.editorDocRef.schemaVersion`, issues, 7);
  readPositiveInt(obj, 'revision', `${path}.editorDocRef`, issues, true);
  readSha256(obj, 'sha256', `${path}.editorDocRef`, issues, true);
  return obj;
}

function parseAssetRevisionRefs(raw: UnknownRecord, path: string, issues: DesignContentIssue[]): void {
  const value = raw['assetRevisionRefs'];
  if (value === undefined) {
    addIssue(issues, 'missing_field', `${path}.assetRevisionRefs`, 'missing required field "assetRevisionRefs"');
    return;
  }
  if (!Array.isArray(value)) {
    addIssue(
      issues,
      'invalid_type',
      `${path}.assetRevisionRefs`,
      `expected array of immutable asset revision refs, got ${describe(value)}`,
    );
    return;
  }
  const seen = new Set<string>();
  for (let i = 0; i < value.length; i += 1) {
    const itemPath = `${path}.assetRevisionRefs[${i}]`;
    const item = record(value[i]);
    if (!item) {
      addIssue(issues, 'invalid_type', itemPath, `expected asset revision ref object, got ${describe(value[i])}`);
      continue;
    }
    checkKeys(item, IMMUTABLE_ASSET_REVISION_REF_ALLOWED_KEYS, itemPath, issues);
    const assetId = readId(item, 'assetId', itemPath, issues, true);
    const revision = readPositiveInt(item, 'revision', itemPath, issues, true);
    readSha256(item, 'sha256', itemPath, issues, true);
    readOptionalString(item, 'mimeType', itemPath, issues);
    if (typeof assetId === 'string' && typeof revision === 'number') {
      const refKey = `${assetId}#${revision}`;
      if (seen.has(refKey)) {
        addIssue(issues, 'duplicate_asset_ref', itemPath, `duplicate immutable asset revision "${refKey}"`);
      }
      seen.add(refKey);
    }
  }
}

export function parseDesignVersionV1(input: unknown): DesignContentParseResult<DesignVersionV1> {
  const issues: DesignContentIssue[] = [];
  const raw = record(input);
  if (!raw) return failResult(issues, 'not_an_object', '$', `expected an object, got ${describe(input)}`);
  checkSchemaVersion(raw, '$', issues);
  checkKeys(raw, DESIGN_VERSION_V1_ALLOWED_KEYS, '$', issues);
  for (const key of ['editorDoc', 'editorDocument', 'editorDocEmbedded']) {
    if (raw[key] !== undefined) {
      addIssue(
        issues,
        'embedded_editor_doc',
        `$.${key}`,
        `key "${key}" embeds the EditorDocV7 document; DesignVersionV1 only references it by designId + SHA-256`,
      );
    }
  }
  const designVersionId = readId(raw, 'designVersionId', '$', issues, true);
  const designId = readId(raw, 'designId', '$', issues, true);
  readPositiveInt(raw, 'version', '$', issues, true);
  const revision = readPositiveInt(raw, 'revision', '$', issues, true);
  const ref = parseEditorDocRef(raw, '$', issues);
  if (ref !== null) {
    if (typeof designId === 'string' && typeof ref['designId'] === 'string' && ref['designId'] !== designId) {
      addIssue(
        issues,
        'editor_doc_ref_mismatch',
        '$.editorDocRef.designId',
        `editorDocRef.designId "${ref['designId']}" does not match designId "${designId}"`,
      );
    }
    if (typeof revision === 'number' && typeof ref['revision'] === 'number' && ref['revision'] !== revision) {
      addIssue(
        issues,
        'editor_doc_ref_mismatch',
        '$.editorDocRef.revision',
        `editorDocRef.revision ${ref['revision']} does not match revision ${revision}`,
      );
    }
  }
  readId(raw, 'releasedByIdentityId', '$', issues, true);
  readTimestamp(raw, 'releasedAt', '$', issues, true);
  parseAssetRevisionRefs(raw, '$', issues);
  const parentVersionId = readId(raw, 'parentVersionId', '$', issues, false);
  if (typeof designVersionId === 'string' && typeof parentVersionId === 'string' && parentVersionId === designVersionId) {
    addIssue(
      issues,
      'parent_version_self',
      '$.parentVersionId',
      `parentVersionId must not reference the version itself (${designVersionId})`,
    );
  }
  scanForbiddenPrivateKeys(raw, '$', issues);
  scanForbiddenDeviceManufacturingKeys(raw, '$', issues);
  return finish<DesignVersionV1>(raw, issues);
}

// ---------------------------------------------------------------------------
// PublishedLookV1
// ---------------------------------------------------------------------------

function parsePreviewRefObject(
  obj: UnknownRecord,
  itemPath: string,
  issues: DesignContentIssue[],
  expectedKind: (typeof PREVIEW_KIND_V1)[number],
): string | undefined {
  checkKeys(obj, PUBLISHED_PREVIEW_ASSET_REF_ALLOWED_KEYS, itemPath, issues);
  const assetId = readId(obj, 'assetId', itemPath, issues, true);
  readPositiveInt(obj, 'revision', itemPath, issues, true);
  readEnum(obj, 'kind', [expectedKind], itemPath, issues, true);
  readSha256(obj, 'sha256', itemPath, issues, true);
  readEnum(obj, 'mimeType', PREVIEW_MIME_V1, itemPath, issues, true);
  readPositiveInt(obj, 'width', itemPath, issues, true);
  readPositiveInt(obj, 'height', itemPath, issues, true);
  readEnum(obj, 'fidelity', PREVIEW_FIDELITY_V1, itemPath, issues, true);
  return assetId;
}

function parseCoverPreview(raw: UnknownRecord, path: string, issues: DesignContentIssue[]): string | undefined {
  const value = raw['coverPreview'];
  if (value === undefined) {
    addIssue(issues, 'missing_field', `${path}.coverPreview`, 'missing required field "coverPreview"');
    return undefined;
  }
  const obj = record(value);
  if (!obj) {
    addIssue(issues, 'invalid_type', `${path}.coverPreview`, `expected preview asset ref object, got ${describe(value)}`);
    return undefined;
  }
  return parsePreviewRefObject(obj, `${path}.coverPreview`, issues, 'COVER');
}

function parseDetailPreviews(raw: UnknownRecord, path: string, issues: DesignContentIssue[]): Set<string> {
  const seen = new Set<string>();
  const value = raw['detailPreviews'];
  if (value === undefined) {
    addIssue(issues, 'missing_field', `${path}.detailPreviews`, 'missing required field "detailPreviews"');
    return seen;
  }
  if (!Array.isArray(value)) {
    addIssue(issues, 'invalid_type', `${path}.detailPreviews`, `expected array of preview asset refs, got ${describe(value)}`);
    return seen;
  }
  for (let i = 0; i < value.length; i += 1) {
    const itemPath = `${path}.detailPreviews[${i}]`;
    const item = record(value[i]);
    if (!item) {
      addIssue(issues, 'invalid_type', itemPath, `expected preview asset ref object, got ${describe(value[i])}`);
      continue;
    }
    const assetId = parsePreviewRefObject(item, itemPath, issues, 'DETAIL');
    if (typeof assetId === 'string') {
      if (seen.has(assetId)) {
        addIssue(issues, 'duplicate_asset_ref', itemPath, `duplicate detail preview asset "${assetId}"`);
      }
      seen.add(assetId);
    }
  }
  return seen;
}

function parseSummaries(raw: UnknownRecord, path: string, issues: DesignContentIssue[]): void {
  const value = raw['summaries'];
  if (value === undefined) {
    addIssue(issues, 'missing_field', `${path}.summaries`, 'missing required field "summaries"');
    return;
  }
  const obj = record(value);
  if (!obj) {
    addIssue(issues, 'invalid_type', `${path}.summaries`, `expected summaries object, got ${describe(value)}`);
    return;
  }
  checkKeys(obj, PUBLISHED_LOOK_SUMMARY_ALLOWED_KEYS, `${path}.summaries`, issues);
  readRequiredIdList(obj, 'shapeIds', `${path}.summaries`, issues);
  readRequiredIdList(obj, 'lengthIds', `${path}.summaries`, issues);
  readPalette(obj, `${path}.summaries`, issues);
}

function parseMetadata(raw: UnknownRecord, path: string, issues: DesignContentIssue[]): void {
  const value = raw['metadata'];
  if (value === undefined) return;
  const obj = record(value);
  if (!obj) {
    addIssue(issues, 'invalid_type', `${path}.metadata`, `expected metadata object with string values, got ${describe(value)}`);
    return;
  }
  for (const key of Object.keys(obj)) {
    if (typeof obj[key] !== 'string') {
      addIssue(
        issues,
        'invalid_type',
        `${path}.metadata.${key}`,
        `metadata value for "${key}" must be a string, got ${describe(obj[key])}`,
      );
    }
  }
}

/**
 * The publication gate IS the GEN-01 `PublicTransitionPrerequisitesV1`
 * contract: parsed with the GEN-01 parser and re-prefixed onto `$.publicationGate`.
 * Returns `{ valid, cleared }` — when the gate document itself is malformed the
 * forwarded issues carry the detail and `valid` is false (no double reporting).
 */
function parsePublicationGate(
  raw: UnknownRecord,
  path: string,
  issues: DesignContentIssue[],
): { valid: boolean; cleared: boolean } {
  const value = raw['publicationGate'];
  const gatePath = `${path}.publicationGate`;
  if (value === undefined) {
    addIssue(issues, 'missing_field', gatePath, 'missing required field "publicationGate"');
    return { valid: false, cleared: false };
  }
  const gateResult = parsePublicTransitionPrerequisitesV1(value);
  if (!gateResult.ok) {
    for (const issue of gateResult.issues) {
      const mappedPath = issue.path === '$' ? gatePath : `${gatePath}${issue.path.slice(1)}`;
      if (issues.length < MAX_ISSUES) {
        issues.push({
          code: issue.code as DesignContentIssueCode,
          path: mappedPath,
          message: issue.message,
        });
      }
    }
    return { valid: false, cleared: false };
  }
  const gateObj = record(value);
  return {
    valid: true,
    cleared:
      gateObj !== null &&
      gateObj['copyrightDeclared'] === true &&
      gateObj['sourceDeclared'] === true &&
      gateObj['moderationCleared'] === true,
  };
}

export function parsePublishedLookV1(input: unknown): DesignContentParseResult<PublishedLookV1> {
  const issues: DesignContentIssue[] = [];
  const raw = record(input);
  if (!raw) return failResult(issues, 'not_an_object', '$', `expected an object, got ${describe(input)}`);
  checkSchemaVersion(raw, '$', issues);
  checkKeys(raw, PUBLISHED_LOOK_V1_ALLOWED_KEYS, '$', issues);
  const lookId = readId(raw, 'lookId', '$', issues, true);
  const designVersionId = readId(raw, 'designVersionId', '$', issues, true);
  readId(raw, 'creatorProfileId', '$', issues, true);
  if (typeof lookId === 'string' && typeof designVersionId === 'string' && designVersionId === lookId) {
    addIssue(
      issues,
      'internal_ref_conflict',
      '$.designVersionId',
      `designVersionId must not equal lookId (${lookId})`,
    );
  }
  readString(raw, 'title', '$', issues, true);
  parseMetadata(raw, '$', issues);
  readTags(raw, '$', issues);
  const visibility = readVisibility(raw, '$', issues, true);
  const coverAssetId = parseCoverPreview(raw, '$', issues);
  const detailAssets = parseDetailPreviews(raw, '$', issues);
  if (typeof coverAssetId === 'string' && detailAssets.has(coverAssetId)) {
    addIssue(
      issues,
      'duplicate_asset_ref',
      '$.coverPreview.assetId',
      `cover preview asset "${coverAssetId}" must not duplicate a detail preview asset`,
    );
  }
  parseSummaries(raw, '$', issues);
  const gate = parsePublicationGate(raw, '$', issues);
  const status = readEnum(raw, 'status', DESIGN_LOOK_STATUS_V1, '$', issues, true) as
    | DesignLookStatusV1
    | undefined;
  if (visibility === 'PUBLIC' && status === 'DRAFT') {
    addIssue(
      issues,
      'status_visibility_conflict',
      '$.status',
      'a DRAFT look cannot be PUBLIC',
    );
  }
  if (visibility === 'PUBLIC' && gate.valid && !gate.cleared) {
    addIssue(
      issues,
      'publication_gate_missing',
      '$.publicationGate',
      'copyright, source and moderation clearance must all be declared when the look is PUBLIC',
    );
  }
  readTimestamp(raw, 'publishedAt', '$', issues, false);
  if (status === 'PUBLISHED' && raw['publishedAt'] === undefined) {
    addIssue(
      issues,
      'missing_field',
      '$.publishedAt',
      'publishedAt is required when status is PUBLISHED',
    );
  }
  if (status === 'DRAFT' && raw['publishedAt'] !== undefined) {
    addIssue(
      issues,
      'published_at_mismatch',
      '$.publishedAt',
      'publishedAt is not allowed while status is DRAFT',
    );
  }
  const remixRelationId = readId(raw, 'remixRelationId', '$', issues, false);
  if (typeof lookId === 'string' && typeof remixRelationId === 'string' && remixRelationId === lookId) {
    addIssue(
      issues,
      'internal_ref_conflict',
      '$.remixRelationId',
      `remixRelationId must not equal lookId (${lookId})`,
    );
  }
  checkTimestampOrder(raw, '$', issues);
  scanForbiddenPrivateKeys(raw, '$', issues);
  scanForbiddenDeviceManufacturingKeys(raw, '$', issues);
  return finish<PublishedLookV1>(raw, issues);
}

// ---------------------------------------------------------------------------
// RemixRelationV1
// ---------------------------------------------------------------------------

export function parseRemixRelationV1(input: unknown): DesignContentParseResult<RemixRelationV1> {
  const issues: DesignContentIssue[] = [];
  const raw = record(input);
  if (!raw) return failResult(issues, 'not_an_object', '$', `expected an object, got ${describe(input)}`);
  checkSchemaVersion(raw, '$', issues);
  checkKeys(raw, REMIX_RELATION_V1_ALLOWED_KEYS, '$', issues);
  readId(raw, 'relationId', '$', issues, true);
  readId(raw, 'sourceLookId', '$', issues, true);
  const sourceDesignVersionId = readId(raw, 'sourceDesignVersionId', '$', issues, true);
  readId(raw, 'sourceCreatorProfileId', '$', issues, true);
  const targetDesignVersionId = readId(raw, 'targetDesignVersionId', '$', issues, true);
  if (
    typeof sourceDesignVersionId === 'string' &&
    typeof targetDesignVersionId === 'string' &&
    sourceDesignVersionId === targetDesignVersionId
  ) {
    addIssue(
      issues,
      'remix_self_target',
      '$.targetDesignVersionId',
      `targetDesignVersionId must differ from sourceDesignVersionId (${sourceDesignVersionId})`,
    );
  }
  readTimestamp(raw, 'createdAt', '$', issues, true);
  readOptionalString(raw, 'license', '$', issues);
  readOptionalString(raw, 'sourceAttribution', '$', issues);
  scanForbiddenPrivateKeys(raw, '$', issues);
  scanForbiddenDeviceManufacturingKeys(raw, '$', issues);
  return finish<RemixRelationV1>(raw, issues);
}

// ---------------------------------------------------------------------------
// Validators
// ---------------------------------------------------------------------------

export function validateDesignVersionV1(input: unknown): boolean {
  return parseDesignVersionV1(input).ok;
}

export function validatePublishedLookV1(input: unknown): boolean {
  return parsePublishedLookV1(input).ok;
}

export function validateRemixRelationV1(input: unknown): boolean {
  return parseRemixRelationV1(input).ok;
}
