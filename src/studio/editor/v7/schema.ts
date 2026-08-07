import { FINGER_CODES, type FingerCode } from '../../../lib/types.ts';
import {
  PREVIEW_FIDELITIES_V7,
  PROCESS_STEP_KINDS_V7,
  SURFACE_FINISH_TYPES_V7,
  getProcessStepTypeDefinitionV7,
} from './registry.ts';
import type {
  AssetRefV7,
  BackgroundPayloadV7,
  CommunicationRefV7,
  DesignSourceRefV1,
  DimensionalDecorationV7,
  EditorDocV7,
  EditorDocV7OutputIntent,
  FlatDesignElementV7,
  GeometryRefV7,
  MaterialRefV7,
  NailDesignV7,
  NailPointV7,
  PreviewFidelityV7,
  ProcessStepV7,
  RecipeInstanceV7,
  RegionMaskV7,
  RgbaColorV7,
  SurfaceEffectPayloadV7,
  SurfaceFinishPayloadV7,
  TenFingerCompositionRefV1,
  Transform2DV7,
  VersionedRefV7,
} from './model.ts';

export type EditorDocV7IssueCode =
  | 'not_an_object'
  | 'schema_version'
  | 'unknown_key'
  | 'legacy_dual_write'
  | 'missing_field'
  | 'invalid_type'
  | 'invalid_enum'
  | 'out_of_range'
  | 'invalid_id'
  | 'duplicate_id'
  | 'invalid_timestamp'
  | 'timestamp_order'
  | 'finger_set'
  | 'finger_mismatch'
  | 'background_missing'
  | 'background_not_first'
  | 'background_duplicated'
  | 'background_skipped'
  | 'finish_missing'
  | 'finish_not_last'
  | 'finish_duplicated'
  | 'finish_not_visible'
  | 'finish_skipped'
  | 'step_kind_not_allowed'
  | 'type_registry_mismatch'
  | 'dangling_reference'
  | 'invalid_hash'
  | 'invalid_parameters';

export interface EditorDocV7Issue {
  code: EditorDocV7IssueCode;
  path: string;
  message: string;
}

export type EditorDocV7ParseResult =
  | { ok: true; doc: EditorDocV7 }
  | { ok: false; reason: string; issues: EditorDocV7Issue[] };

type UnknownRecord = Record<string, unknown>;
const MAX_ISSUES = 200;
const FINGER_SET = new Set<string>(FINGER_CODES);
const STEP_KINDS = new Set<string>(PROCESS_STEP_KINDS_V7);
const FIDELITIES = new Set<string>(PREVIEW_FIDELITIES_V7);
const FINISH_TYPES = new Set<string>(SURFACE_FINISH_TYPES_V7);
const OUTPUT_INTENTS = new Set<EditorDocV7OutputIntent>([
  'design',
  'customer',
  'manufacturing',
]);
const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const MIME_PATTERN = /^[a-z0-9.+-]+\/[a-z0-9.+-]+$/i;
const ISO_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;
const PARAMETER_KEY_PATTERN = /^[a-z][A-Za-z0-9_]{0,63}$/;
const LEGACY_TOP_LEVEL_KEYS = new Set([
  'customerId',
  'appearance',
  'defaultGeometry',
  'lengthPreset',
  'finish',
  'layers',
  'baseColor',
  'shape',
  'length',
]);

function record(value: unknown): UnknownRecord | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as UnknownRecord)
    : null;
}

function addIssue(
  issues: EditorDocV7Issue[],
  code: EditorDocV7IssueCode,
  path: string,
  message: string,
): void {
  if (issues.length < MAX_ISSUES) issues.push({ code, path, message });
}

function validateKeys(
  raw: UnknownRecord,
  allowed: readonly string[],
  path: string,
  issues: EditorDocV7Issue[],
  legacy?: ReadonlySet<string>,
): void {
  const allowedSet = new Set(allowed);
  for (const key of Object.keys(raw)) {
    if (legacy?.has(key)) {
      addIssue(issues, 'legacy_dual_write', `${path}.${key}`, `legacy field ${key} is forbidden`);
    } else if (!allowedSet.has(key)) {
      addIssue(issues, 'unknown_key', `${path}.${key}`, `unknown key ${key}`);
    }
  }
}

function validateId(value: unknown, path: string, issues: EditorDocV7Issue[]): value is string {
  if (typeof value !== 'string' || !ID_PATTERN.test(value)) {
    addIssue(issues, 'invalid_id', path, 'must be a non-empty stable ID');
    return false;
  }
  return true;
}

function validateString(
  value: unknown,
  path: string,
  issues: EditorDocV7Issue[],
  allowEmpty = false,
): value is string {
  if (typeof value !== 'string' || (!allowEmpty && value.length === 0)) {
    addIssue(issues, 'invalid_type', path, 'must be a string');
    return false;
  }
  return true;
}

function validateFinite(
  value: unknown,
  path: string,
  issues: EditorDocV7Issue[],
  min?: number,
  max?: number,
  maxExclusive = false,
): value is number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    addIssue(issues, 'invalid_type', path, 'must be a finite number');
    return false;
  }
  if ((min !== undefined && value < min) || (max !== undefined && (maxExclusive ? value >= max : value > max))) {
    addIssue(issues, 'out_of_range', path, 'number outside allowed range');
    return false;
  }
  return true;
}

function validateBoolean(value: unknown, path: string, issues: EditorDocV7Issue[]): boolean {
  if (typeof value !== 'boolean') {
    addIssue(issues, 'invalid_type', path, 'must be boolean');
    return false;
  }
  return true;
}

function validateTimestamp(value: unknown, path: string, issues: EditorDocV7Issue[]): value is string {
  const canonical = typeof value === 'string' && !value.includes('.')
    ? value.replace('Z', '.000Z')
    : value;
  if (
    typeof value !== 'string' ||
    !ISO_PATTERN.test(value) ||
    !Number.isFinite(Date.parse(value)) ||
    new Date(value).toISOString() !== canonical
  ) {
    addIssue(issues, 'invalid_timestamp', path, 'must be UTC ISO-8601');
    return false;
  }
  return true;
}

function validateVersionedRef(
  value: unknown,
  path: string,
  issues: EditorDocV7Issue[],
): value is VersionedRefV7 {
  const raw = record(value);
  if (!raw) {
    addIssue(issues, 'not_an_object', path, 'must be an object');
    return false;
  }
  validateKeys(raw, ['id', 'revision'], path, issues);
  return validateId(raw.id, `${path}.id`, issues) && validateString(raw.revision, `${path}.revision`, issues);
}

function validateColor(value: unknown, path: string, issues: EditorDocV7Issue[]): value is RgbaColorV7 {
  const raw = record(value);
  if (!raw) {
    addIssue(issues, 'not_an_object', path, 'RGBA color must be an object');
    return false;
  }
  validateKeys(raw, ['colorSpace', 'r', 'g', 'b', 'a'], path, issues);
  if (raw.colorSpace !== 'srgb') addIssue(issues, 'invalid_enum', `${path}.colorSpace`, 'must be srgb');
  const rFinite = validateFinite(raw.r, `${path}.r`, issues, 0, 255);
  const gFinite = validateFinite(raw.g, `${path}.g`, issues, 0, 255);
  const bFinite = validateFinite(raw.b, `${path}.b`, issues, 0, 255);
  const r = rFinite && Number.isInteger(raw.r);
  const g = gFinite && Number.isInteger(raw.g);
  const b = bFinite && Number.isInteger(raw.b);
  if (rFinite && !r) addIssue(issues, 'out_of_range', `${path}.r`, 'must be an integer from 0 to 255');
  if (gFinite && !g) addIssue(issues, 'out_of_range', `${path}.g`, 'must be an integer from 0 to 255');
  if (bFinite && !b) addIssue(issues, 'out_of_range', `${path}.b`, 'must be an integer from 0 to 255');
  const a = validateFinite(raw.a, `${path}.a`, issues, 0, 1);
  return raw.colorSpace === 'srgb' && r && g && b && a;
}

function validatePoint(value: unknown, path: string, issues: EditorDocV7Issue[]): value is NailPointV7 {
  const raw = record(value);
  if (!raw) {
    addIssue(issues, 'not_an_object', path, 'point must be an object');
    return false;
  }
  validateKeys(raw, ['u', 'v'], path, issues);
  return (
    validateFinite(raw.u, `${path}.u`, issues, 0, 1) &&
    validateFinite(raw.v, `${path}.v`, issues, 0, 1)
  );
}

function validateTransform(
  value: unknown,
  path: string,
  issues: EditorDocV7Issue[],
): value is Transform2DV7 {
  const raw = record(value);
  if (!raw) {
    addIssue(issues, 'not_an_object', path, 'transform must be an object');
    return false;
  }
  validateKeys(raw, ['position', 'scaleX', 'scaleY', 'rotationDeg'], path, issues);
  return (
    validatePoint(raw.position, `${path}.position`, issues) &&
    validateFinite(raw.scaleX, `${path}.scaleX`, issues, Number.MIN_VALUE) &&
    validateFinite(raw.scaleY, `${path}.scaleY`, issues, Number.MIN_VALUE) &&
    validateFinite(raw.rotationDeg, `${path}.rotationDeg`, issues, -180, 180, true)
  );
}

function validateGeometryRef(
  value: unknown,
  path: string,
  issues: EditorDocV7Issue[],
): value is GeometryRefV7 {
  const raw = record(value);
  if (!raw) {
    addIssue(issues, 'not_an_object', path, 'geometryRef must be an object');
    return false;
  }
  validateKeys(raw, ['assetId', 'revision'], path, issues);
  return validateId(raw.assetId, `${path}.assetId`, issues) && validateString(raw.revision, `${path}.revision`, issues);
}

function validateAssetRef(value: unknown, path: string, issues: EditorDocV7Issue[]): value is AssetRefV7 {
  const raw = record(value);
  if (!raw) {
    addIssue(issues, 'not_an_object', path, 'asset ref must be an object');
    return false;
  }
  validateKeys(raw, ['assetId', 'revision', 'kind', 'mimeType', 'sha256', 'widthPx', 'heightPx', 'colorSpace', 'alphaMode'], path, issues);
  let ok = validateId(raw.assetId, `${path}.assetId`, issues) && validateString(raw.revision, `${path}.revision`, issues);
  if (!['raster', 'vector', 'mesh', 'texture'].includes(String(raw.kind))) {
    addIssue(issues, 'invalid_enum', `${path}.kind`, 'invalid asset kind'); ok = false;
  }
  if (typeof raw.mimeType !== 'string' || !MIME_PATTERN.test(raw.mimeType)) {
    addIssue(issues, 'invalid_type', `${path}.mimeType`, 'invalid MIME type'); ok = false;
  }
  if (typeof raw.sha256 !== 'string' || !SHA256_PATTERN.test(raw.sha256)) {
    addIssue(issues, 'invalid_hash', `${path}.sha256`, 'must be lowercase SHA-256 hex'); ok = false;
  }
  for (const key of ['widthPx', 'heightPx'] as const) {
    if (raw[key] !== undefined && (!validateFinite(raw[key], `${path}.${key}`, issues, 1) || !Number.isInteger(raw[key]))) ok = false;
  }
  if (raw.colorSpace !== undefined && !['srgb', 'display-p3'].includes(String(raw.colorSpace))) {
    addIssue(issues, 'invalid_enum', `${path}.colorSpace`, 'invalid color space'); ok = false;
  }
  if (raw.alphaMode !== undefined && !['straight', 'premultiplied', 'opaque'].includes(String(raw.alphaMode))) {
    addIssue(issues, 'invalid_enum', `${path}.alphaMode`, 'invalid alpha mode'); ok = false;
  }
  return ok;
}

function validateMaterialRef(value: unknown, path: string, issues: EditorDocV7Issue[]): value is MaterialRefV7 {
  const raw = record(value);
  if (!raw) { addIssue(issues, 'not_an_object', path, 'material ref must be an object'); return false; }
  validateKeys(raw, ['materialId', 'revision'], path, issues);
  return validateId(raw.materialId, `${path}.materialId`, issues) && validateString(raw.revision, `${path}.revision`, issues);
}

function validateMask(value: unknown, path: string, issues: EditorDocV7Issue[]): value is RegionMaskV7 {
  const raw = record(value);
  if (!raw) { addIssue(issues, 'not_an_object', path, 'mask must be an object'); return false; }
  validateKeys(raw, ['coordinateSpace', 'pathData', 'fillRule', 'inverted'], path, issues);
  let ok = true;
  if (raw.coordinateSpace !== 'nail-local-v1') { addIssue(issues, 'invalid_enum', `${path}.coordinateSpace`, 'invalid coordinate space'); ok = false; }
  if (typeof raw.pathData !== 'string' || raw.pathData.length === 0 || raw.pathData.length > 100_000 || /[<>]/.test(raw.pathData)) {
    addIssue(issues, 'invalid_type', `${path}.pathData`, 'invalid path data'); ok = false;
  }
  if (raw.fillRule !== 'nonzero' && raw.fillRule !== 'evenodd') { addIssue(issues, 'invalid_enum', `${path}.fillRule`, 'invalid fill rule'); ok = false; }
  if (!validateBoolean(raw.inverted, `${path}.inverted`, issues)) ok = false;
  return ok;
}

function validateBackground(value: unknown, path: string, issues: EditorDocV7Issue[]): value is BackgroundPayloadV7 {
  const raw = record(value);
  if (!raw) { addIssue(issues, 'not_an_object', path, 'background must be an object'); return false; }
  const mode = raw.mode;
  const common = ['mode', 'opacity'];
  let allowed: string[];
  if (mode === 'solid') allowed = [...common, 'color'];
  else if (mode === 'translucent') allowed = [...common, 'color', 'materialPresetRef'];
  else if (mode === 'gradient') allowed = [...common, 'stops', 'directionDeg'];
  else if (mode === 'cat_eye') allowed = [...common, 'color', 'directionDeg', 'intensity', 'bandWidth', 'previewFidelity'];
  else if (mode === 'glitter') allowed = [...common, 'colors', 'density', 'particleSizeMm', 'seed', 'previewFidelity'];
  else { addIssue(issues, 'invalid_enum', `${path}.mode`, 'invalid background mode'); return false; }
  validateKeys(raw, allowed, path, issues);
  let ok = validateFinite(raw.opacity, `${path}.opacity`, issues, 0, 1);
  if (mode === 'solid' || mode === 'translucent' || mode === 'cat_eye') ok = validateColor(raw.color, `${path}.color`, issues) && ok;
  if (mode === 'translucent' && raw.materialPresetRef !== undefined) ok = validateVersionedRef(raw.materialPresetRef, `${path}.materialPresetRef`, issues) && ok;
  if (mode === 'gradient') {
    if (!Array.isArray(raw.stops) || raw.stops.length < 2 || raw.stops.length > 8) {
      addIssue(issues, 'out_of_range', `${path}.stops`, 'gradient requires 2 to 8 stops'); ok = false;
    } else {
      let previous = -1;
      raw.stops.forEach((stop, index) => {
        const stopRaw = record(stop);
        if (!stopRaw) { addIssue(issues, 'not_an_object', `${path}.stops[${index}]`, 'stop must be object'); ok = false; return; }
        validateKeys(stopRaw, ['offset', 'color'], `${path}.stops[${index}]`, issues);
        const validOffset = validateFinite(stopRaw.offset, `${path}.stops[${index}].offset`, issues, 0, 1);
        if (validOffset && (stopRaw.offset as number) <= previous) { addIssue(issues, 'out_of_range', `${path}.stops[${index}].offset`, 'stops must be strictly increasing'); ok = false; }
        if (validOffset) previous = stopRaw.offset as number;
        ok = validateColor(stopRaw.color, `${path}.stops[${index}].color`, issues) && validOffset && ok;
      });
    }
    ok = validateFinite(raw.directionDeg, `${path}.directionDeg`, issues, 0, 360, true) && ok;
  }
  if (mode === 'cat_eye') {
    ok = validateFinite(raw.directionDeg, `${path}.directionDeg`, issues, 0, 360, true) && validateFinite(raw.intensity, `${path}.intensity`, issues, 0, 1) && validateFinite(raw.bandWidth, `${path}.bandWidth`, issues, 0, 1) && validateFidelity(raw.previewFidelity, `${path}.previewFidelity`, issues) && ok;
  }
  if (mode === 'glitter') {
    if (!Array.isArray(raw.colors) || raw.colors.length === 0 || raw.colors.length > 8) { addIssue(issues, 'out_of_range', `${path}.colors`, 'glitter requires 1 to 8 colors'); ok = false; }
    else raw.colors.forEach((color, index) => { ok = validateColor(color, `${path}.colors[${index}]`, issues) && ok; });
    ok = validateFinite(raw.density, `${path}.density`, issues, 0, 1) && validateFinite(raw.particleSizeMm, `${path}.particleSizeMm`, issues, 0.01, 2) && validateString(raw.seed, `${path}.seed`, issues) && validateFidelity(raw.previewFidelity, `${path}.previewFidelity`, issues) && ok;
  }
  return ok;
}

function validateFidelity(value: unknown, path: string, issues: EditorDocV7Issue[]): value is PreviewFidelityV7 {
  if (typeof value !== 'string' || !FIDELITIES.has(value)) { addIssue(issues, 'invalid_enum', path, 'invalid preview fidelity'); return false; }
  return true;
}

function validateElementBase(raw: UnknownRecord, path: string, issues: EditorDocV7Issue[], ids: Set<string>): boolean {
  let ok = validateId(raw.id, `${path}.id`, issues);
  if (typeof raw.id === 'string') {
    if (ids.has(raw.id)) { addIssue(issues, 'duplicate_id', `${path}.id`, `duplicate node ID ${raw.id}`); ok = false; }
    else ids.add(raw.id);
  }
  return validateBoolean(raw.visible, `${path}.visible`, issues) && validateBoolean(raw.locked, `${path}.locked`, issues) && validateFinite(raw.opacity, `${path}.opacity`, issues, 0, 1) && validateTransform(raw.transform, `${path}.transform`, issues) && ok;
}

function validateFlatElement(value: unknown, path: string, issues: EditorDocV7Issue[], ids: Set<string>): value is FlatDesignElementV7 {
  const raw = record(value);
  if (!raw) { addIssue(issues, 'not_an_object', path, 'element must be an object'); return false; }
  const common = ['id', 'kind', 'visible', 'locked', 'opacity', 'transform'];
  const kind = raw.kind;
  let allowed: string[];
  if (kind === 'brush_stroke') allowed = [...common, 'points', 'color', 'widthMm'];
  else if (kind === 'eraser_mask') allowed = [...common, 'path', 'widthMm'];
  else if (kind === 'vector_shape') allowed = [...common, 'pathData', 'fill', 'stroke', 'strokeWidthMm'];
  else if (kind === 'text') allowed = [...common, 'text', 'fontRef', 'fontSizeMm', 'color'];
  else if (kind === 'image_2d') allowed = [...common, 'role', 'asset'];
  else if (kind === 'french_edge') allowed = [...common, 'widthRatio', 'curvature', 'color'];
  else if (kind === 'region_mask') allowed = [...common, 'mask'];
  else { addIssue(issues, 'invalid_enum', `${path}.kind`, 'invalid flat element kind'); return false; }
  validateKeys(raw, allowed, path, issues);
  let ok = validateElementBase(raw, path, issues, ids);
  if (kind === 'brush_stroke' || kind === 'eraser_mask') {
    const points = kind === 'brush_stroke' ? raw.points : raw.path;
    if (!Array.isArray(points) || points.length < 2) { addIssue(issues, 'out_of_range', `${path}.${kind === 'brush_stroke' ? 'points' : 'path'}`, 'path needs at least two points'); ok = false; }
    else points.forEach((point, index) => { ok = validatePoint(point, `${path}.${kind === 'brush_stroke' ? 'points' : 'path'}[${index}]`, issues) && ok; });
    ok = validateFinite(raw.widthMm, `${path}.widthMm`, issues, 0.01, 10) && ok;
    if (kind === 'brush_stroke') ok = validateColor(raw.color, `${path}.color`, issues) && ok;
  } else if (kind === 'vector_shape') {
    if (typeof raw.pathData !== 'string' || raw.pathData.length === 0 || raw.pathData.length > 100_000 || /[<>]/.test(raw.pathData)) { addIssue(issues, 'invalid_type', `${path}.pathData`, 'invalid path data'); ok = false; }
    if (raw.fill !== undefined) ok = validateColor(raw.fill, `${path}.fill`, issues) && ok;
    if (raw.stroke !== undefined) ok = validateColor(raw.stroke, `${path}.stroke`, issues) && ok;
    if (raw.strokeWidthMm !== undefined) ok = validateFinite(raw.strokeWidthMm, `${path}.strokeWidthMm`, issues, 0, 10) && ok;
    if (raw.fill === undefined && raw.stroke === undefined) { addIssue(issues, 'missing_field', path, 'vector shape needs fill or stroke'); ok = false; }
  } else if (kind === 'text') {
    ok = validateString(raw.text, `${path}.text`, issues, true) && validateVersionedRef(raw.fontRef, `${path}.fontRef`, issues) && validateFinite(raw.fontSizeMm, `${path}.fontSizeMm`, issues, 0.1, 30) && validateColor(raw.color, `${path}.color`, issues) && ok;
  } else if (kind === 'image_2d') {
    if (!['sticker', 'import', 'stamp'].includes(String(raw.role))) { addIssue(issues, 'invalid_enum', `${path}.role`, 'invalid image role'); ok = false; }
    ok = validateAssetRef(raw.asset, `${path}.asset`, issues) && ok;
  } else if (kind === 'french_edge') {
    ok = validateFinite(raw.widthRatio, `${path}.widthRatio`, issues, 0, 1) && validateFinite(raw.curvature, `${path}.curvature`, issues, -1, 1) && validateColor(raw.color, `${path}.color`, issues) && ok;
  } else if (kind === 'region_mask') ok = validateMask(raw.mask, `${path}.mask`, issues) && ok;
  return ok;
}

function validateEffect(value: unknown, path: string, issues: EditorDocV7Issue[]): value is SurfaceEffectPayloadV7 {
  const raw = record(value);
  if (!raw) { addIssue(issues, 'not_an_object', path, 'effect must be an object'); return false; }
  const common = ['effectType', 'previewFidelity'];
  const type = raw.effectType;
  let allowed: string[];
  if (type === 'cat_eye') allowed = [...common, 'directionDeg', 'intensity', 'bandWidth'];
  else if (type === 'glitter') allowed = [...common, 'density', 'particleSizeMm', 'seed'];
  else if (type === 'mirror') allowed = [...common, 'tint', 'reflectance'];
  else if (type === 'ink_bloom') allowed = [...common, 'colors', 'spread', 'seed'];
  else { addIssue(issues, 'invalid_enum', `${path}.effectType`, 'invalid surface effect'); return false; }
  validateKeys(raw, allowed, path, issues);
  let ok = validateFidelity(raw.previewFidelity, `${path}.previewFidelity`, issues);
  if (type === 'cat_eye') ok = validateFinite(raw.directionDeg, `${path}.directionDeg`, issues, 0, 360, true) && validateFinite(raw.intensity, `${path}.intensity`, issues, 0, 1) && validateFinite(raw.bandWidth, `${path}.bandWidth`, issues, 0, 1) && ok;
  else if (type === 'glitter') ok = validateFinite(raw.density, `${path}.density`, issues, 0, 1) && validateFinite(raw.particleSizeMm, `${path}.particleSizeMm`, issues, 0.01, 2) && validateString(raw.seed, `${path}.seed`, issues) && ok;
  else if (type === 'mirror') ok = validateColor(raw.tint, `${path}.tint`, issues) && validateFinite(raw.reflectance, `${path}.reflectance`, issues, 0, 1) && ok;
  else {
    if (!Array.isArray(raw.colors) || raw.colors.length < 2 || raw.colors.length > 8) { addIssue(issues, 'out_of_range', `${path}.colors`, 'ink bloom needs 2 to 8 colors'); ok = false; }
    else raw.colors.forEach((color, index) => { ok = validateColor(color, `${path}.colors[${index}]`, issues) && ok; });
    ok = validateFinite(raw.spread, `${path}.spread`, issues, 0, 1) && validateString(raw.seed, `${path}.seed`, issues) && ok;
  }
  return ok;
}

function validateDecoration(value: unknown, path: string, issues: EditorDocV7Issue[], ids: Set<string>): value is DimensionalDecorationV7 {
  const raw = record(value);
  if (!raw) { addIssue(issues, 'not_an_object', path, 'decoration must be object'); return false; }
  const common = ['id', 'kind', 'visible', 'locked', 'transform', 'heightMm', 'materialRef', 'previewFidelity'];
  const allowed = raw.kind === 'relief_2_5d' ? [...common, 'outline'] : raw.kind === 'attachment_3d' ? [...common, 'asset', 'anchor'] : null;
  if (!allowed) { addIssue(issues, 'invalid_enum', `${path}.kind`, 'invalid decoration kind'); return false; }
  validateKeys(raw, allowed, path, issues);
  let ok = validateId(raw.id, `${path}.id`, issues);
  if (typeof raw.id === 'string') {
    if (ids.has(raw.id)) { addIssue(issues, 'duplicate_id', `${path}.id`, `duplicate node ID ${raw.id}`); ok = false; } else ids.add(raw.id);
  }
  ok = validateBoolean(raw.visible, `${path}.visible`, issues) && validateBoolean(raw.locked, `${path}.locked`, issues) && validateTransform(raw.transform, `${path}.transform`, issues) && validateFinite(raw.heightMm, `${path}.heightMm`, issues, 0.01, 10) && validateFidelity(raw.previewFidelity, `${path}.previewFidelity`, issues) && ok;
  if (raw.materialRef !== undefined) ok = validateMaterialRef(raw.materialRef, `${path}.materialRef`, issues) && ok;
  if (raw.kind === 'relief_2_5d') ok = validateMask(raw.outline, `${path}.outline`, issues) && ok;
  else ok = validateAssetRef(raw.asset, `${path}.asset`, issues) && validatePoint(raw.anchor, `${path}.anchor`, issues) && ok;
  return ok;
}

function validateFinish(value: unknown, path: string, issues: EditorDocV7Issue[]): value is SurfaceFinishPayloadV7 {
  const raw = record(value);
  if (!raw) { addIssue(issues, 'not_an_object', path, 'finish must be object'); return false; }
  validateKeys(raw, ['type', 'materialPresetRef'], path, issues);
  let ok = true;
  if (typeof raw.type !== 'string' || !FINISH_TYPES.has(raw.type)) { addIssue(issues, 'invalid_enum', `${path}.type`, 'invalid finish type'); ok = false; }
  return validateVersionedRef(raw.materialPresetRef, `${path}.materialPresetRef`, issues) && ok;
}

function validateStep(
  value: unknown,
  path: string,
  issues: EditorDocV7Issue[],
  ids: Set<string>,
  recipeRefs: Set<string>,
): value is ProcessStepV7 {
  const raw = record(value);
  if (!raw) { addIssue(issues, 'not_an_object', path, 'step must be object'); return false; }
  const common = ['id', 'kind', 'typeId', 'name', 'visible', 'locked', 'skipped', 'recipeInstanceId', 'materialRefs'];
  const kind = raw.kind;
  const allowed = kind === 'background' ? [...common, 'background'] : kind === 'flat_design' ? [...common, 'elements', 'mask'] : kind === 'surface_effect' ? [...common, 'effect', 'mask'] : kind === 'dimensional_decoration' ? [...common, 'decorations'] : kind === 'surface_finish' ? [...common, 'finish'] : null;
  if (!allowed || typeof kind !== 'string' || !STEP_KINDS.has(kind)) { addIssue(issues, 'step_kind_not_allowed', `${path}.kind`, 'invalid step kind'); return false; }
  validateKeys(raw, allowed, path, issues);
  let ok = validateId(raw.id, `${path}.id`, issues);
  if (typeof raw.id === 'string') {
    if (ids.has(raw.id)) { addIssue(issues, 'duplicate_id', `${path}.id`, `duplicate node ID ${raw.id}`); ok = false; } else ids.add(raw.id);
  }
  ok = validateString(raw.typeId, `${path}.typeId`, issues) && validateString(raw.name, `${path}.name`, issues, true) && validateBoolean(raw.visible, `${path}.visible`, issues) && validateBoolean(raw.locked, `${path}.locked`, issues) && validateBoolean(raw.skipped, `${path}.skipped`, issues) && ok;
  const definition = typeof raw.typeId === 'string' ? getProcessStepTypeDefinitionV7(raw.typeId) : undefined;
  if (!definition || definition.kind !== kind) { addIssue(issues, 'type_registry_mismatch', `${path}.typeId`, 'typeId does not match step kind'); ok = false; }
  if (raw.recipeInstanceId !== undefined) {
    if (validateId(raw.recipeInstanceId, `${path}.recipeInstanceId`, issues)) recipeRefs.add(raw.recipeInstanceId); else ok = false;
  }
  if (!Array.isArray(raw.materialRefs)) { addIssue(issues, 'invalid_type', `${path}.materialRefs`, 'must be array'); ok = false; }
  else raw.materialRefs.forEach((ref, index) => { ok = validateMaterialRef(ref, `${path}.materialRefs[${index}]`, issues) && ok; });
  if (kind === 'background') ok = validateBackground(raw.background, `${path}.background`, issues) && ok;
  else if (kind === 'flat_design') {
    if (!Array.isArray(raw.elements)) { addIssue(issues, 'invalid_type', `${path}.elements`, 'must be array'); ok = false; }
    else raw.elements.forEach((element, index) => { ok = validateFlatElement(element, `${path}.elements[${index}]`, issues, ids) && ok; });
    if (raw.mask !== undefined) ok = validateMask(raw.mask, `${path}.mask`, issues) && ok;
  } else if (kind === 'surface_effect') ok = validateEffect(raw.effect, `${path}.effect`, issues) && validateMask(raw.mask, `${path}.mask`, issues) && ok;
  else if (kind === 'dimensional_decoration') {
    if (!Array.isArray(raw.decorations)) { addIssue(issues, 'invalid_type', `${path}.decorations`, 'must be array'); ok = false; }
    else raw.decorations.forEach((decoration, index) => { ok = validateDecoration(decoration, `${path}.decorations[${index}]`, issues, ids) && ok; });
  } else ok = validateFinish(raw.finish, `${path}.finish`, issues) && ok;
  return ok;
}

function validateNail(
  finger: FingerCode,
  value: unknown,
  path: string,
  issues: EditorDocV7Issue[],
  ids: Set<string>,
  recipeRefs: Set<string>,
  compositionMeta: TenFingerCompositionRefV1 | undefined,
): value is NailDesignV7 {
  const raw = record(value);
  if (!raw) { addIssue(issues, 'not_an_object', path, 'nail must be object'); return false; }
  validateKeys(raw, ['finger', 'geometryRef', 'steps', 'compositionProvenance'], path, issues, new Set(['layers', 'geometryOverride']));
  let ok = true;
  if (raw.finger !== finger) { addIssue(issues, 'finger_mismatch', `${path}.finger`, `must equal ${finger}`); ok = false; }
  ok = validateGeometryRef(raw.geometryRef, `${path}.geometryRef`, issues) && ok;
  if (!Array.isArray(raw.steps)) { addIssue(issues, 'invalid_type', `${path}.steps`, 'steps must be array'); return false; }
  const kinds = raw.steps.map((step) => record(step)?.kind);
  const backgrounds = kinds.filter((kind) => kind === 'background').length;
  const finishes = kinds.filter((kind) => kind === 'surface_finish').length;
  if (backgrounds === 0) addIssue(issues, 'background_missing', `${path}.steps`, 'background required');
  if (backgrounds > 1) addIssue(issues, 'background_duplicated', `${path}.steps`, 'background must be unique');
  if (kinds[0] !== 'background') addIssue(issues, 'background_not_first', `${path}.steps[0]`, 'background must be first');
  if (finishes === 0) addIssue(issues, 'finish_missing', `${path}.steps`, 'surface finish required');
  if (finishes > 1) addIssue(issues, 'finish_duplicated', `${path}.steps`, 'surface finish must be unique');
  if (kinds[kinds.length - 1] !== 'surface_finish') addIssue(issues, 'finish_not_last', `${path}.steps`, 'surface finish must be last');
  raw.steps.forEach((step, index) => { ok = validateStep(step, `${path}.steps[${index}]`, issues, ids, recipeRefs) && ok; });
  const background = record(raw.steps[0]);
  if (background?.kind === 'background' && background.skipped !== false) addIssue(issues, 'background_skipped', `${path}.steps[0].skipped`, 'background cannot be skipped');
  const finish = record(raw.steps[raw.steps.length - 1]);
  if (finish?.kind === 'surface_finish') {
    if (finish.skipped !== false) addIssue(issues, 'finish_skipped', `${path}.steps[${raw.steps.length - 1}].skipped`, 'finish cannot be skipped');
    if (finish.visible !== true) addIssue(issues, 'finish_not_visible', `${path}.steps[${raw.steps.length - 1}].visible`, 'finish must be visible');
  }
  if (raw.compositionProvenance !== undefined) {
    const provenance = record(raw.compositionProvenance);
    if (!provenance) { addIssue(issues, 'not_an_object', `${path}.compositionProvenance`, 'must be object'); ok = false; }
    else {
      validateKeys(provenance, ['compositionId', 'revision', 'syncState'], `${path}.compositionProvenance`, issues);
      const valid = validateId(provenance.compositionId, `${path}.compositionProvenance.compositionId`, issues) && validateString(provenance.revision, `${path}.compositionProvenance.revision`, issues);
      if (provenance.syncState !== 'linked' && provenance.syncState !== 'detached') { addIssue(issues, 'invalid_enum', `${path}.compositionProvenance.syncState`, 'invalid sync state'); ok = false; }
      if (valid && (!compositionMeta || compositionMeta.compositionId !== provenance.compositionId || compositionMeta.revision !== provenance.revision)) {
        addIssue(issues, 'dangling_reference', `${path}.compositionProvenance`, 'composition provenance must match compositionMeta'); ok = false;
      }
    }
  }
  return ok && backgrounds === 1 && finishes === 1 && kinds[0] === 'background' && kinds[kinds.length - 1] === 'surface_finish';
}

function validateComposition(value: unknown, path: string, issues: EditorDocV7Issue[]): value is TenFingerCompositionRefV1 {
  const raw = record(value);
  if (!raw) { addIssue(issues, 'not_an_object', path, 'composition ref must be object'); return false; }
  validateKeys(raw, ['compositionId', 'revision', 'source'], path, issues);
  let ok = validateId(raw.compositionId, `${path}.compositionId`, issues) && validateString(raw.revision, `${path}.revision`, issues);
  if (raw.source !== undefined) ok = validateSource(raw.source, `${path}.source`, issues) && ok;
  return ok;
}

function validateSource(value: unknown, path: string, issues: EditorDocV7Issue[]): value is DesignSourceRefV1 {
  const raw = record(value);
  if (!raw) { addIssue(issues, 'not_an_object', path, 'source ref must be object'); return false; }
  validateKeys(raw, ['domain', 'sourceId', 'revision'], path, issues);
  let ok = true;
  if (!['community', 'wizard', 'manual', 'legacy'].includes(String(raw.domain))) { addIssue(issues, 'invalid_enum', `${path}.domain`, 'invalid source domain'); ok = false; }
  ok = validateId(raw.sourceId, `${path}.sourceId`, issues) && ok;
  if (raw.revision !== undefined) ok = validateString(raw.revision, `${path}.revision`, issues) && ok;
  return ok;
}

function validateRecipe(value: unknown, key: string, path: string, issues: EditorDocV7Issue[]): value is RecipeInstanceV7 {
  const raw = record(value);
  if (!raw) { addIssue(issues, 'not_an_object', path, 'recipe instance must be object'); return false; }
  validateKeys(raw, ['instanceId', 'recipeId', 'recipeRevision', 'parameterValues'], path, issues);
  let ok = validateId(raw.instanceId, `${path}.instanceId`, issues) && validateId(raw.recipeId, `${path}.recipeId`, issues) && validateString(raw.recipeRevision, `${path}.recipeRevision`, issues);
  if (raw.instanceId !== key) { addIssue(issues, 'dangling_reference', `${path}.instanceId`, 'record key must match instanceId'); ok = false; }
  const params = record(raw.parameterValues);
  if (!params) { addIssue(issues, 'invalid_parameters', `${path}.parameterValues`, 'must be scalar parameter map'); return false; }
  for (const [paramKey, paramValue] of Object.entries(params)) {
    if (!PARAMETER_KEY_PATTERN.test(paramKey) || !['string', 'number', 'boolean'].includes(typeof paramValue) || (typeof paramValue === 'number' && !Number.isFinite(paramValue))) {
      addIssue(issues, 'invalid_parameters', `${path}.parameterValues.${paramKey}`, 'invalid parameter key or scalar value'); ok = false;
    }
  }
  return ok;
}

function validateCommunication(value: unknown, path: string, issues: EditorDocV7Issue[]): value is CommunicationRefV7 {
  const raw = record(value);
  if (!raw) { addIssue(issues, 'not_an_object', path, 'communication ref must be object'); return false; }
  validateKeys(raw, ['communicationId', 'asset', 'caption', 'createdAt'], path, issues, new Set(['dataUrl', 'uri']));
  let ok = validateId(raw.communicationId, `${path}.communicationId`, issues) && validateAssetRef(raw.asset, `${path}.asset`, issues) && validateTimestamp(raw.createdAt, `${path}.createdAt`, issues);
  if (raw.caption !== undefined) ok = validateString(raw.caption, `${path}.caption`, issues, true) && ok;
  return ok;
}

export function parseEditorDocV7(value: unknown): EditorDocV7ParseResult {
  const issues: EditorDocV7Issue[] = [];
  const raw = record(value);
  if (!raw) return { ok: false, reason: 'EditorDocV7 must be an object', issues: [{ code: 'not_an_object', path: '$', message: 'EditorDocV7 must be an object' }] };
  validateKeys(raw, ['schemaVersion', 'designId', 'customerRef', 'title', 'nails', 'recipeInstances', 'compositionMeta', 'sourceRefs', 'communicationRefs', 'outputIntent', 'revision', 'createdAt', 'updatedAt'], '$', issues, LEGACY_TOP_LEVEL_KEYS);
  if (raw.schemaVersion !== 7) addIssue(issues, 'schema_version', '$.schemaVersion', 'schemaVersion must be literal 7');
  validateId(raw.designId, '$.designId', issues);
  if (raw.customerRef !== undefined) validateId(raw.customerRef, '$.customerRef', issues);
  validateString(raw.title, '$.title', issues, true);
  if (!OUTPUT_INTENTS.has(raw.outputIntent as EditorDocV7OutputIntent)) addIssue(issues, 'invalid_enum', '$.outputIntent', 'invalid output intent');
  if (typeof raw.revision !== 'number' || !Number.isInteger(raw.revision) || raw.revision < 1) addIssue(issues, 'out_of_range', '$.revision', 'revision must be integer >= 1');
  const createdOk = validateTimestamp(raw.createdAt, '$.createdAt', issues);
  const updatedOk = validateTimestamp(raw.updatedAt, '$.updatedAt', issues);
  if (createdOk && updatedOk && Date.parse(raw.updatedAt as string) < Date.parse(raw.createdAt as string)) addIssue(issues, 'timestamp_order', '$.updatedAt', 'updatedAt cannot precede createdAt');
  let compositionMeta: TenFingerCompositionRefV1 | undefined;
  if (raw.compositionMeta !== undefined && validateComposition(raw.compositionMeta, '$.compositionMeta', issues)) compositionMeta = raw.compositionMeta as TenFingerCompositionRefV1;
  if (!Array.isArray(raw.sourceRefs)) addIssue(issues, 'invalid_type', '$.sourceRefs', 'must be array');
  else raw.sourceRefs.forEach((source, index) => validateSource(source, `$.sourceRefs[${index}]`, issues));
  const communicationIds = new Set<string>();
  if (!Array.isArray(raw.communicationRefs)) addIssue(issues, 'invalid_type', '$.communicationRefs', 'must be array');
  else raw.communicationRefs.forEach((communication, index) => {
    validateCommunication(communication, `$.communicationRefs[${index}]`, issues);
    const id = record(communication)?.communicationId;
    if (typeof id === 'string') { if (communicationIds.has(id)) addIssue(issues, 'duplicate_id', `$.communicationRefs[${index}].communicationId`, 'duplicate communication ID'); else communicationIds.add(id); }
  });
  const recipes = record(raw.recipeInstances);
  if (!recipes) addIssue(issues, 'not_an_object', '$.recipeInstances', 'must be object');
  else Object.entries(recipes).forEach(([key, recipe]) => validateRecipe(recipe, key, `$.recipeInstances.${key}`, issues));
  const nails = record(raw.nails);
  const ids = new Set<string>();
  const recipeRefs = new Set<string>();
  if (!nails) addIssue(issues, 'not_an_object', '$.nails', 'must be object');
  else {
    const keys = Object.keys(nails);
    if (keys.length !== FINGER_CODES.length || keys.some((key) => !FINGER_SET.has(key))) addIssue(issues, 'finger_set', '$.nails', 'nails must contain exactly L1-L5 and R1-R5');
    for (const finger of FINGER_CODES) {
      if (!(finger in nails)) addIssue(issues, 'finger_set', `$.nails.${finger}`, `missing finger ${finger}`);
      else validateNail(finger, nails[finger], `$.nails.${finger}`, issues, ids, recipeRefs, compositionMeta);
    }
  }
  for (const recipeRef of recipeRefs) if (!recipes || !(recipeRef in recipes)) addIssue(issues, 'dangling_reference', '$.recipeInstances', `missing recipe instance ${recipeRef}`);
  if (issues.length > 0) return { ok: false, reason: issues[0].message, issues };
  return { ok: true, doc: structuredClone(value) as EditorDocV7 };
}

export function validateEditorDocV7(value: unknown): boolean {
  return parseEditorDocV7(value).ok;
}

export function isEditorDocV7(value: unknown): value is EditorDocV7 {
  return validateEditorDocV7(value);
}
