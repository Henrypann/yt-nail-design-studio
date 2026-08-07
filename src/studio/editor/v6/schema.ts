/**
 * Behavioral EditorDocV6 validator (PR-03).
 */

import { FINGER_CODES, type FingerCode } from '../../../lib/types.ts';
import { NAIL_SHAPE_IDS } from '../../../generated/shape-types.ts';
import type {
  EditorDocOutputIntent,
  EditorDocV6,
  EditorElementV6,
  EditorLayerV6,
  NailDesignV6,
} from './model.ts';

export type EditorDocV6ValidationResult =
  | { ok: true; doc: EditorDocV6 }
  | { ok: false; reason: string };

type UnknownRecord = Record<string, unknown>;

const LENGTHS = new Set(['short', 'medium', 'long', 'extra-long']);
const SHAPES = new Set<string>(NAIL_SHAPE_IDS);
const PRESETS = new Set(['natural', 'short-extension', 'medium', 'long']);
const OUTPUT_INTENTS = new Set<EditorDocOutputIntent>(['design', 'customer', 'manufacturing']);
const DOMAINS = new Set(['pattern', 'attachment', 'relief']);
const PATTERN_KINDS = new Set([
  'template_pattern',
  'brush',
  'eraser',
  'image',
  'gradient',
  'french_edge',
]);
const RELIEF_KINDS = new Set(['chrome_ribbon', 'clear_droplet', 'custom_relief']);
const FINGER_SET = new Set<string>(FINGER_CODES);

/** Forbidden dual-write keys that must not coexist with canonical v6 fields. */
const FORBIDDEN_TOP_LEVEL_KEYS = new Set([
  'shape',
  'length',
  'finish',
  'baseColor',
  'pattern',
  'attachments',
  'recipe',
  'relief',
  'fingerLocks',
  'masterFinger',
  'layerTypes',
]);

const ALLOWED_TOP_LEVEL_KEYS = new Set([
  'schemaVersion',
  'designId',
  'customerId',
  'title',
  'defaultGeometry',
  'lengthPreset',
  'appearance',
  'intent',
  'presentationMeta',
  'nails',
  'recipeInstances',
  'communicationRefs',
  'outputIntent',
  'revision',
  'createdAt',
  'updatedAt',
]);

function record(value: unknown): UnknownRecord | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as UnknownRecord)
    : null;
}

function isFingerCode(value: unknown): value is FingerCode {
  return typeof value === 'string' && FINGER_SET.has(value);
}

function validateAppearance(value: unknown): boolean {
  const raw = record(value);
  if (!raw) return false;
  if (raw.baseCoverage !== 'opaque' && raw.baseCoverage !== 'translucent') return false;
  if (
    raw.opticalEffect !== 'none' &&
    raw.opticalEffect !== 'cat-eye' &&
    raw.opticalEffect !== 'aurora' &&
    raw.opticalEffect !== 'silk' &&
    raw.opticalEffect !== 'pearl'
  ) {
    return false;
  }
  if (raw.topFinish !== 'gloss' && raw.topFinish !== 'matte') return false;
  return true;
}

function validateElement(value: unknown, index: number, ids: Set<string>): string | null {
  const raw = record(value);
  if (!raw) return `element[${index}] must be an object`;
  if (typeof raw.id !== 'string' || !raw.id) return `element[${index}] missing id`;
  if (ids.has(raw.id)) return `duplicate id: ${raw.id}`;
  ids.add(raw.id);
  const domain = String(raw.domain);
  if (!DOMAINS.has(domain)) return `element[${index}] invalid domain`;
  if (typeof raw.kind !== 'string' || !raw.kind) return `element[${index}] missing kind`;
  if (domain === 'pattern' && !PATTERN_KINDS.has(raw.kind)) {
    return `element[${index}] invalid pattern kind`;
  }
  if (domain === 'attachment' && raw.kind !== 'attachment') {
    return `element[${index}] invalid attachment kind`;
  }
  if (domain === 'relief' && !RELIEF_KINDS.has(raw.kind)) {
    return `element[${index}] invalid relief kind`;
  }
  if (typeof raw.visible !== 'boolean') return `element[${index}] visible must be boolean`;
  if (typeof raw.locked !== 'boolean') return `element[${index}] locked must be boolean`;
  if (raw.order !== index) return `element[${index}] order must match array index`;
  return null;
}

function validateLayer(
  value: unknown,
  index: number,
  ids: Set<string>,
  recipeRefs: Set<string>,
): string | null {
  const raw = record(value);
  if (!raw) return `layer[${index}] must be an object`;
  if (typeof raw.id !== 'string' || !raw.id) return `layer[${index}] missing id`;
  if (ids.has(raw.id)) return `duplicate id: ${raw.id}`;
  ids.add(raw.id);
  if (typeof raw.name !== 'string') return `layer[${index}] missing name`;
  if (typeof raw.typeId !== 'string' || !raw.typeId) return `layer[${index}] missing typeId`;
  if (typeof raw.visible !== 'boolean') return `layer[${index}] visible must be boolean`;
  if (typeof raw.locked !== 'boolean') return `layer[${index}] locked must be boolean`;
  if (raw.order !== index) return `layer[${index}] order must match array index`;
  if (raw.recipeInstanceId !== undefined) {
    if (typeof raw.recipeInstanceId !== 'string' || !raw.recipeInstanceId) {
      return `layer[${index}] recipeInstanceId must be a non-empty string`;
    }
    recipeRefs.add(raw.recipeInstanceId);
  }
  if (!Array.isArray(raw.elements)) return `layer[${index}] elements must be an array`;
  for (let i = 0; i < raw.elements.length; i += 1) {
    const err = validateElement(raw.elements[i], i, ids);
    if (err) return err;
  }
  if (raw.surface != null) {
    const surface = record(raw.surface);
    if (!surface || typeof surface.baseColor !== 'string') {
      return `layer[${index}] surface.baseColor required when surface present`;
    }
    if ('appearance' in surface) {
      return `layer[${index}] surface.appearance is not a writable v6 field`;
    }
  }
  return null;
}

function validateNail(
  finger: FingerCode,
  value: unknown,
  ids: Set<string>,
  recipeRefs: Set<string>,
): string | null {
  const raw = record(value);
  if (!raw) return `nails.${finger} must be an object`;
  if (raw.finger !== finger) return `nails.${finger}.finger must equal ${finger}`;
  if (raw.geometryOverride !== undefined) {
    const override = record(raw.geometryOverride);
    if (!override) return `nails.${finger}.geometryOverride must be an object`;
    if (override.shape !== undefined && !SHAPES.has(String(override.shape))) {
      return `nails.${finger}.geometryOverride.shape invalid`;
    }
    if (override.length !== undefined && !LENGTHS.has(String(override.length))) {
      return `nails.${finger}.geometryOverride.length invalid`;
    }
  }
  if (!Array.isArray(raw.layers)) return `nails.${finger}.layers must be an array`;
  for (let i = 0; i < raw.layers.length; i += 1) {
    const err = validateLayer(raw.layers[i], i, ids, recipeRefs);
    if (err) return `nails.${finger}: ${err}`;
  }
  return null;
}

/** Returns true/false for fixture tests, or a structured result via parseEditorDocV6. */
export function validateEditorDocV6(value: unknown): boolean {
  return parseEditorDocV6(value).ok;
}

export function parseEditorDocV6(value: unknown): EditorDocV6ValidationResult {
  const raw = record(value);
  if (!raw) return { ok: false, reason: 'EditorDocV6 must be an object' };
  if (raw.schemaVersion !== 6) return { ok: false, reason: 'schemaVersion must be literal 6' };

  for (const key of Object.keys(raw)) {
    if (FORBIDDEN_TOP_LEVEL_KEYS.has(key)) {
      return {
        ok: false,
        reason: `forbidden legacy dual-write field: ${key}`,
      };
    }
    if (!ALLOWED_TOP_LEVEL_KEYS.has(key)) {
      return { ok: false, reason: `unknown top-level field: ${key}` };
    }
  }

  if (typeof raw.designId !== 'string' || !raw.designId) {
    return { ok: false, reason: 'designId required' };
  }
  if (raw.customerId !== undefined && typeof raw.customerId !== 'string') {
    return { ok: false, reason: 'customerId must be a string when present' };
  }
  if (typeof raw.title !== 'string') return { ok: false, reason: 'title required' };
  const geometry = record(raw.defaultGeometry);
  if (
    !geometry ||
    !SHAPES.has(String(geometry.shape)) ||
    !LENGTHS.has(String(geometry.length))
  ) {
    return { ok: false, reason: 'defaultGeometry.shape/length required' };
  }
  if (!PRESETS.has(String(raw.lengthPreset))) {
    return { ok: false, reason: 'lengthPreset invalid' };
  }
  if (!validateAppearance(raw.appearance)) {
    return { ok: false, reason: 'appearance invalid' };
  }
  const presentation = record(raw.presentationMeta);
  if (!presentation || !isFingerCode(presentation.masterFinger)) {
    return { ok: false, reason: 'presentationMeta.masterFinger required' };
  }
  if (!OUTPUT_INTENTS.has(raw.outputIntent as EditorDocOutputIntent)) {
    return { ok: false, reason: 'outputIntent invalid' };
  }
  if (typeof raw.revision !== 'number' || !Number.isInteger(raw.revision) || raw.revision < 1) {
    return { ok: false, reason: 'revision must be integer >= 1' };
  }
  if (typeof raw.createdAt !== 'string' || !Number.isFinite(Date.parse(raw.createdAt))) {
    return { ok: false, reason: 'createdAt invalid' };
  }
  if (typeof raw.updatedAt !== 'string' || !Number.isFinite(Date.parse(raw.updatedAt))) {
    return { ok: false, reason: 'updatedAt invalid' };
  }
  if (!Array.isArray(raw.communicationRefs)) {
    return { ok: false, reason: 'communicationRefs must be an array' };
  }
  const recipeInstances = record(raw.recipeInstances);
  if (!recipeInstances) return { ok: false, reason: 'recipeInstances required' };
  const nails = record(raw.nails);
  if (!nails) return { ok: false, reason: 'nails required' };

  const ids = new Set<string>();
  const recipeRefs = new Set<string>();
  const nailKeys = Object.keys(nails);
  if (nailKeys.length !== FINGER_CODES.length || nailKeys.some((key) => !FINGER_SET.has(key))) {
    return { ok: false, reason: 'nails must contain exactly the ten named fingers' };
  }
  for (const finger of FINGER_CODES) {
    if (!(finger in nails)) return { ok: false, reason: `missing finger ${finger}` };
    const err = validateNail(finger, nails[finger], ids, recipeRefs);
    if (err) return { ok: false, reason: err };
  }
  for (const [key, value] of Object.entries(recipeInstances)) {
    const inst = record(value);
    if (
      !inst ||
      inst.id !== key ||
      typeof inst.recipeId !== 'string' ||
      !inst.recipeId ||
      !record(inst.recipe)
    ) {
      return { ok: false, reason: `recipeInstances.${key} invalid` };
    }
    if (
      typeof inst.createdAt !== 'string' ||
      !Number.isFinite(Date.parse(inst.createdAt)) ||
      typeof inst.updatedAt !== 'string' ||
      !Number.isFinite(Date.parse(inst.updatedAt))
    ) {
      return { ok: false, reason: `recipeInstances.${key} timestamps required` };
    }
  }
  for (const recipeRef of recipeRefs) {
    if (!(recipeRef in recipeInstances)) {
      return { ok: false, reason: `dangling recipeInstanceId: ${recipeRef}` };
    }
  }
  const communicationIds = new Set<string>();
  for (const ref of raw.communicationRefs) {
    const item = record(ref);
    if (
      !item ||
      typeof item.id !== 'string' ||
      !item.id ||
      communicationIds.has(item.id) ||
      typeof item.dataUrl !== 'string' ||
      !item.dataUrl ||
      typeof item.uploadedAt !== 'string' ||
      !Number.isFinite(Date.parse(item.uploadedAt)) ||
      (item.caption !== undefined && typeof item.caption !== 'string')
    ) {
      return { ok: false, reason: 'communicationRefs entry invalid' };
    }
    communicationIds.add(item.id);
  }

  const doc: EditorDocV6 = {
    schemaVersion: 6,
    designId: raw.designId,
    title: raw.title,
    defaultGeometry: {
      shape: geometry.shape as EditorDocV6['defaultGeometry']['shape'],
      length: geometry.length as EditorDocV6['defaultGeometry']['length'],
    },
    lengthPreset: raw.lengthPreset as EditorDocV6['lengthPreset'],
    appearance: structuredClone(raw.appearance) as EditorDocV6['appearance'],
    presentationMeta: {
      masterFinger: presentation.masterFinger as EditorDocV6['presentationMeta']['masterFinger'],
    },
    nails: structuredClone(nails) as EditorDocV6['nails'],
    recipeInstances: structuredClone(recipeInstances) as EditorDocV6['recipeInstances'],
    communicationRefs: structuredClone(
      raw.communicationRefs,
    ) as EditorDocV6['communicationRefs'],
    outputIntent: raw.outputIntent as EditorDocOutputIntent,
    revision: raw.revision,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  };
  if (typeof raw.customerId === 'string') doc.customerId = raw.customerId;
  if (raw.intent != null) doc.intent = structuredClone(raw.intent) as EditorDocV6['intent'];

  return { ok: true, doc };
}

export function isEditorDocV6(value: unknown): value is EditorDocV6 {
  return validateEditorDocV6(value);
}

export type { EditorDocV6, EditorLayerV6, EditorElementV6, NailDesignV6 };
