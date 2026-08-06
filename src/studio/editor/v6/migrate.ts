/**
 * Pure EditorDoc v1–v6 → EditorDocV6 migration (PR-03).
 * No storage writes.
 */

import type { NailShape } from '../../../lib/types.ts';
import {
  FINGER_CODES,
  type FingerCode,
  type Finish,
  type NailLength,
} from '../../../lib/types.ts';
import {
  LENGTH_PRESET_BY_GEOMETRY,
  appearanceFromLegacyFinish,
  type DesignIntent,
  type LengthPreset,
  type SurfaceAppearance,
} from '../lib/model.ts';
import { migrateDeterministicId } from './id.ts';
import type {
  CommunicationRefV6,
  EditorDocRecipeInstanceV6,
  EditorDocV6,
  EditorElementV6,
  EditorLayerV6,
  NailDesignV6,
} from './model.ts';
import { parseEditorDocV6 } from './schema.ts';

export type EditorDocV6MigrationResult =
  | { status: 'ok'; doc: EditorDocV6; migrated: boolean }
  | { status: 'missing' }
  | { status: 'invalid'; reason: string }
  | { status: 'unsupported'; version: number };

type UnknownRecord = Record<string, unknown>;

const PATTERN_KINDS = new Set([
  'template_pattern',
  'brush',
  'eraser',
  'image',
  'gradient',
  'french_edge',
]);
const LENGTHS = new Set<NailLength>(['short', 'medium', 'long', 'extra-long']);
const PRESETS = new Set<LengthPreset>(['natural', 'short-extension', 'medium', 'long']);

function record(value: unknown): UnknownRecord | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as UnknownRecord)
    : null;
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function normalizeAppearance(value: unknown, fallbackFinish: Finish = 'gloss'): SurfaceAppearance {
  const raw = record(value);
  if (!raw) return appearanceFromLegacyFinish(fallbackFinish);
  const baseCoverage = raw.baseCoverage === 'translucent' ? 'translucent' : 'opaque';
  const opticalEffect =
    raw.opticalEffect === 'cat-eye' ||
    raw.opticalEffect === 'aurora' ||
    raw.opticalEffect === 'silk' ||
    raw.opticalEffect === 'pearl'
      ? raw.opticalEffect
      : 'none';
  const topFinish = raw.topFinish === 'matte' ? 'matte' : 'gloss';
  return { baseCoverage, opticalEffect, topFinish };
}

function defaultPatternName(kind: string, raw: UnknownRecord): string {
  if (typeof raw.name === 'string' && raw.name.trim()) return raw.name;
  switch (kind) {
    case 'template_pattern':
      return '模板图案';
    case 'brush':
      return '手绘笔画';
    case 'eraser':
      return '擦除蒙版';
    case 'image':
      return '导入图片';
    case 'gradient':
      return '裸色渐变';
    case 'french_edge':
      return '经典法式';
    default:
      return '图案元素';
  }
}

function toFlatElement(
  domain: EditorElementV6['domain'],
  rawElement: UnknownRecord,
  order: number,
): { ok: true; element: EditorElementV6 } | { ok: false; error: string } {
  if (typeof rawElement.id !== 'string' || !rawElement.id) {
    return { ok: false, error: 'element missing id' };
  }
  const kind = String(rawElement.kind ?? '');
  if (domain === 'pattern' && !PATTERN_KINDS.has(kind)) {
    return { ok: false, error: `unknown pattern kind: ${kind || '(empty)'}` };
  }
  if (domain === 'attachment' && kind !== 'attachment') {
    return { ok: false, error: 'attachment element kind must be attachment' };
  }
  if (domain === 'relief' && kind !== 'relief') {
    return { ok: false, error: 'relief element kind must be relief' };
  }
  const { domain: _ignoredDomain, order: _ignoredOrder, ...rest } = rawElement;
  return {
    ok: true,
    element: {
      ...rest,
      id: rawElement.id,
      domain,
      kind,
      name:
        domain === 'pattern'
          ? defaultPatternName(kind, rawElement)
          : typeof rawElement.name === 'string' && rawElement.name.trim()
            ? rawElement.name
            : domain === 'attachment'
              ? '附件'
              : '浮雕',
      visible: rawElement.visible !== false,
      locked: rawElement.locked === true,
      order,
    } as EditorElementV6,
  };
}

function unwrapCursorElement(
  value: unknown,
  order: number,
): { ok: true; element: EditorElementV6 } | { ok: false; error: string } {
  const raw = record(value);
  if (!raw) return { ok: false, error: 'element must be object' };

  // Cursor nested shape: { domain, element }
  const nested = record(raw.element);
  if (nested && (raw.domain === 'pattern' || raw.domain === 'attachment' || raw.domain === 'relief')) {
    return toFlatElement(raw.domain, nested, order);
  }

  // Flat v6-like / fixture shape
  if (raw.domain === 'pattern' || raw.domain === 'attachment' || raw.domain === 'relief') {
    return toFlatElement(raw.domain, raw, order);
  }

  // Legacy pattern/attachment/relief without domain
  if (typeof raw.kind === 'string') {
    if (PATTERN_KINDS.has(raw.kind)) return toFlatElement('pattern', raw, order);
    if (raw.kind === 'attachment') return toFlatElement('attachment', raw, order);
    if (raw.kind === 'relief') return toFlatElement('relief', raw, order);
    return { ok: false, error: `unknown element kind: ${raw.kind}` };
  }
  return { ok: false, error: 'unrecognized element shape' };
}

function normalizeLayerOrders(layers: EditorLayerV6[]): void {
  layers.forEach((layer, index) => {
    layer.order = index;
    layer.elements.forEach((el, elIndex) => {
      el.order = elIndex;
    });
  });
}

function collectIds(doc: EditorDocV6): string[] {
  const ids: string[] = [];
  for (const finger of FINGER_CODES) {
    for (const layer of doc.nails[finger].layers) {
      ids.push(layer.id);
      for (const el of layer.elements) ids.push(el.id);
    }
  }
  return ids;
}

function assertUniqueIds(doc: EditorDocV6): EditorDocV6MigrationResult | null {
  const ids = collectIds(doc);
  if (new Set(ids).size !== ids.length) {
    return { status: 'invalid', reason: 'duplicate layer/element ids after migration' };
  }
  return null;
}

function mapLegacyFingerData(
  shared: UnknownRecord,
  lock: UnknownRecord | null,
): { baseColor: string; pattern: unknown[]; attachments: unknown[] } | { error: string } {
  const source = lock ?? shared;
  if (typeof source.baseColor !== 'string') return { error: 'baseColor required' };
  return {
    baseColor: source.baseColor,
    pattern: Array.isArray(source.pattern) ? source.pattern : [],
    attachments: Array.isArray(source.attachments) ? source.attachments : [],
  };
}

function partitionPatterns(patterns: EditorElementV6[]): {
  draw: EditorElementV6[];
  art2d: EditorElementV6[];
} {
  const draw: EditorElementV6[] = [];
  const art2d: EditorElementV6[] = [];
  for (const el of patterns) {
    if (el.kind === 'brush' || el.kind === 'eraser') draw.push(el);
    else art2d.push(el);
  }
  return { draw, art2d };
}

function makeLayer(
  id: string,
  name: string,
  typeId: string,
  order: number,
  elements: EditorElementV6[],
  extras?: Pick<EditorLayerV6, 'surface' | 'recipeInstanceId' | 'stepId'>,
): EditorLayerV6 {
  return {
    id,
    name,
    typeId,
    visible: true,
    locked: false,
    order,
    elements,
    ...extras,
  };
}

function migrateLegacySharedDoc(raw: UnknownRecord, version: 1 | 2 | 3): EditorDocV6MigrationResult {
  if (
    typeof raw.designId !== 'string' ||
    typeof raw.shape !== 'string' ||
    typeof raw.length !== 'string' ||
    !LENGTHS.has(raw.length as NailLength) ||
    typeof raw.baseColor !== 'string' ||
    typeof raw.updatedAt !== 'string'
  ) {
    return { status: 'invalid', reason: 'legacy EditorDoc missing required fields' };
  }

  const length = raw.length as NailLength;
  const legacyFinish: Finish =
    raw.finish === 'matte' || raw.finish === 'pearl' || raw.finish === 'gloss'
      ? raw.finish
      : 'gloss';
  const appearance =
    version === 1 ? appearanceFromLegacyFinish(legacyFinish) : normalizeAppearance(raw.appearance, legacyFinish);
  const lengthPreset: LengthPreset =
    PRESETS.has(raw.lengthPreset as LengthPreset)
      ? (raw.lengthPreset as LengthPreset)
      : LENGTH_PRESET_BY_GEOMETRY[length];
  const masterFinger =
    typeof raw.masterFinger === 'string' && FINGER_CODES.includes(raw.masterFinger as FingerCode)
      ? (raw.masterFinger as FingerCode)
      : 'R4';

  const shared = {
    baseColor: raw.baseColor,
    pattern: Array.isArray(raw.pattern) ? raw.pattern : [],
    attachments: Array.isArray(raw.attachments) ? raw.attachments : [],
  };
  const locks = record(raw.fingerLocks) ?? {};

  let recipeInstanceId: string | undefined;
  const recipeInstances: Record<string, EditorDocRecipeInstanceV6> = {};
  if (version === 3 && raw.recipe != null) {
    recipeInstanceId = `recipe_${raw.designId}`;
    recipeInstances[recipeInstanceId] = {
      id: recipeInstanceId,
      recipeId:
        record(record(raw.recipe)?.recipeRef)?.id &&
        typeof record(record(raw.recipe)?.recipeRef)?.id === 'string'
          ? String(record(record(raw.recipe)?.recipeRef)?.id)
          : recipeInstanceId,
      recipe: clone(raw.recipe),
      createdAt: raw.updatedAt,
      updatedAt: raw.updatedAt,
    };
  }

  const reliefSource = version === 3 && Array.isArray(raw.relief) ? raw.relief : [];
  const nails = {} as Record<FingerCode, NailDesignV6>;

  for (const finger of FINGER_CODES) {
    const lockRaw = record(locks[finger]);
    const fingerData = mapLegacyFingerData(shared, lockRaw);
    if ('error' in fingerData) {
      return { status: 'invalid', reason: `finger ${finger}: ${fingerData.error}` };
    }

    const patterns: EditorElementV6[] = [];
    for (let i = 0; i < fingerData.pattern.length; i += 1) {
      const mapped = unwrapCursorElement(fingerData.pattern[i], patterns.length);
      if (!mapped.ok) return { status: 'invalid', reason: mapped.error };
      patterns.push({ ...mapped.element, id: `${mapped.element.id}__${finger}` });
    }
    const attachments: EditorElementV6[] = [];
    for (let i = 0; i < fingerData.attachments.length; i += 1) {
      const mapped = unwrapCursorElement(fingerData.attachments[i], attachments.length);
      if (!mapped.ok) return { status: 'invalid', reason: mapped.error };
      attachments.push({ ...mapped.element, id: `${mapped.element.id}__${finger}` });
    }

    const { draw, art2d } = partitionPatterns(patterns);
    const layers: EditorLayerV6[] = [];
    let order = 0;
    layers.push(
      makeLayer(
        migrateDeterministicId([raw.designId, finger, 'base']),
        '底色/表面',
        'builtin.base_surface',
        order++,
        [],
        { surface: { baseColor: fingerData.baseColor } },
      ),
    );
    if (draw.length > 0) {
      layers.push(
        makeLayer(
          migrateDeterministicId([raw.designId, finger, 'draw']),
          '手绘',
          'builtin.draw',
          order++,
          draw.map((el, index) => ({ ...el, order: index })),
        ),
      );
    }
    if (art2d.length > 0) {
      layers.push(
        makeLayer(
          migrateDeterministicId([raw.designId, finger, 'art_2d']),
          '二维素材',
          'builtin.art_2d',
          order++,
          art2d.map((el, index) => ({ ...el, order: index })),
        ),
      );
    }
    if (reliefSource.length > 0) {
      const reliefElements: EditorElementV6[] = [];
      for (let i = 0; i < reliefSource.length; i += 1) {
        const mapped = unwrapCursorElement(reliefSource[i], i);
        if (!mapped.ok) return { status: 'invalid', reason: mapped.error };
        const sourceId = mapped.element.id;
        reliefElements.push({
          ...mapped.element,
          id: `${sourceId}__${finger}`,
          order: i,
        });
      }
      layers.push(
        makeLayer(
          migrateDeterministicId([raw.designId, finger, 'relief']),
          '立体结构',
          'builtin.relief',
          order++,
          reliefElements,
        ),
      );
    }
    if (attachments.length > 0) {
      layers.push(
        makeLayer(
          migrateDeterministicId([raw.designId, finger, 'attachment']),
          '附件',
          'builtin.attachment',
          order++,
          attachments.map((el, index) => ({ ...el, order: index })),
        ),
      );
    }
    if (recipeInstanceId) {
      layers.push(
        makeLayer(
          migrateDeterministicId([raw.designId, finger, 'recipe']),
          '配方层',
          'builtin.recipe',
          order++,
          [],
          { recipeInstanceId },
        ),
      );
    }
    normalizeLayerOrders(layers);
    nails[finger] = { finger, layers };
  }

  const intent = record(raw.intent) as DesignIntent | null;

  const doc: EditorDocV6 = {
    schemaVersion: 6,
    designId: raw.designId,
    customerId: typeof raw.customerId === 'string' ? raw.customerId : undefined,
    title: typeof raw.title === 'string' ? raw.title : '未命名设计',
    defaultGeometry: { shape: raw.shape as EditorDocV6['defaultGeometry']['shape'], length },
    lengthPreset,
    appearance,
    intent: intent ?? undefined,
    presentationMeta: { masterFinger },
    nails,
    recipeInstances,
    communicationRefs: [],
    outputIntent: 'design',
    revision: 1,
    createdAt: raw.updatedAt,
    updatedAt: raw.updatedAt,
  };

  const dup = assertUniqueIds(doc);
  if (dup) return dup;
  return { status: 'ok', doc, migrated: true };
}

function migrateObservedLayered(raw: UnknownRecord, _version: 4 | 5): EditorDocV6MigrationResult {
  if (
    typeof raw.designId !== 'string' ||
    typeof raw.title !== 'string' ||
    typeof raw.updatedAt !== 'string'
  ) {
    return { status: 'invalid', reason: 'observed layered EditorDoc missing identity fields' };
  }
  const geometry = record(raw.defaultGeometry);
  if (!geometry || typeof geometry.shape !== 'string' || !LENGTHS.has(geometry.length as NailLength)) {
    return { status: 'invalid', reason: 'defaultGeometry invalid' };
  }
  if (!PRESETS.has(raw.lengthPreset as LengthPreset)) {
    return { status: 'invalid', reason: 'lengthPreset invalid' };
  }
  const nailsRaw = record(raw.nails);
  if (!nailsRaw) return { status: 'invalid', reason: 'nails required' };

  const appearance = normalizeAppearance(raw.appearance);
  const presentation = record(raw.presentationMeta);
  const masterFinger =
    presentation && FINGER_CODES.includes(presentation.masterFinger as FingerCode)
      ? (presentation.masterFinger as FingerCode)
      : 'R4';

  const nails = {} as Record<FingerCode, NailDesignV6>;
  for (const finger of FINGER_CODES) {
    const nailRaw = record(nailsRaw[finger]);
    if (!nailRaw || !Array.isArray(nailRaw.layers)) {
      return { status: 'invalid', reason: `missing nail stack for ${finger}` };
    }
    const layers: EditorLayerV6[] = [];
    for (let i = 0; i < nailRaw.layers.length; i += 1) {
      const layerRaw = record(nailRaw.layers[i]);
      if (!layerRaw || typeof layerRaw.id !== 'string' || typeof layerRaw.typeId !== 'string') {
        return { status: 'invalid', reason: `invalid layer on ${finger}` };
      }
      const elements: EditorElementV6[] = [];
      const elementList = Array.isArray(layerRaw.elements) ? layerRaw.elements : [];
      for (let j = 0; j < elementList.length; j += 1) {
        const mapped = unwrapCursorElement(elementList[j], j);
        if (!mapped.ok) return { status: 'invalid', reason: mapped.error };
        elements.push(mapped.element);
      }
      const surfaceRaw = record(layerRaw.surface);
      const surface =
        surfaceRaw && typeof surfaceRaw.baseColor === 'string'
          ? { baseColor: surfaceRaw.baseColor }
          : undefined;
      // Document appearance wins; ignore conflicting surface.appearance.
      layers.push({
        id: layerRaw.id,
        name: typeof layerRaw.name === 'string' ? layerRaw.name : layerRaw.typeId,
        typeId: layerRaw.typeId,
        visible: layerRaw.visible !== false,
        locked: layerRaw.locked === true,
        order: i,
        recipeInstanceId:
          typeof layerRaw.recipeInstanceId === 'string' ? layerRaw.recipeInstanceId : undefined,
        surface,
        stepId: typeof layerRaw.stepId === 'string' ? layerRaw.stepId : undefined,
        elements,
      });
    }
    normalizeLayerOrders(layers);
    const overrideRaw = record(nailRaw.geometryOverride);
    let geometryOverride: NailDesignV6['geometryOverride'];
    if (overrideRaw) {
      const shape =
        typeof overrideRaw.shape === 'string' ? (overrideRaw.shape as NailShape) : undefined;
      const length = LENGTHS.has(overrideRaw.length as NailLength)
        ? (overrideRaw.length as NailLength)
        : undefined;
      if (shape || length) {
        geometryOverride = { shape, length };
      }
    }
    nails[finger] = { finger, geometryOverride, layers };
  }

  const recipeInstances: Record<string, EditorDocRecipeInstanceV6> = {};
  const recipesRaw = record(raw.recipeInstances) ?? {};
  for (const [key, value] of Object.entries(recipesRaw)) {
    const inst = record(value);
    if (!inst || typeof inst.id !== 'string') {
      return { status: 'invalid', reason: `recipeInstances.${key} invalid` };
    }
    const recipeBody = inst.recipe ?? inst.instance ?? null;
    recipeInstances[key] = {
      id: inst.id,
      recipeId: typeof inst.recipeId === 'string' ? inst.recipeId : inst.id,
      recipe: clone(recipeBody),
      createdAt: typeof inst.createdAt === 'string' ? inst.createdAt : raw.updatedAt,
      updatedAt: typeof inst.updatedAt === 'string' ? inst.updatedAt : raw.updatedAt,
    };
  }

  const communicationRefs: CommunicationRefV6[] = [];
  if (Array.isArray(raw.communicationRefs)) {
    for (const item of raw.communicationRefs) {
      const ref = record(item);
      if (!ref || typeof ref.id !== 'string' || typeof ref.dataUrl !== 'string') {
        return { status: 'invalid', reason: 'communicationRefs entry invalid' };
      }
      communicationRefs.push({
        id: ref.id,
        dataUrl: ref.dataUrl,
        caption: typeof ref.caption === 'string' ? ref.caption : undefined,
        uploadedAt: typeof ref.uploadedAt === 'string' ? ref.uploadedAt : raw.updatedAt,
      });
    }
  }

  const intent = record(raw.intent) as DesignIntent | null;
  const doc: EditorDocV6 = {
    schemaVersion: 6,
    designId: raw.designId,
    customerId: typeof raw.customerId === 'string' ? raw.customerId : undefined,
    title: raw.title,
    defaultGeometry: {
      shape: geometry.shape as EditorDocV6['defaultGeometry']['shape'],
      length: geometry.length as NailLength,
    },
    lengthPreset: raw.lengthPreset as LengthPreset,
    appearance,
    intent: intent ?? undefined,
    presentationMeta: { masterFinger },
    nails,
    recipeInstances,
    communicationRefs,
    outputIntent: 'design',
    revision: 1,
    createdAt: raw.updatedAt,
    updatedAt: raw.updatedAt,
  };

  const dup = assertUniqueIds(doc);
  if (dup) return dup;
  return { status: 'ok', doc, migrated: true };
}

function migrateV6(raw: UnknownRecord): EditorDocV6MigrationResult {
  const parsed = parseEditorDocV6(raw);
  if (!parsed.ok) return { status: 'invalid', reason: parsed.reason };
  return { status: 'ok', doc: parsed.doc, migrated: false };
}

/** Pure migrate: missing / invalid / unsupported / ok(v6). Never writes storage. */
export function migrateEditorDocV6(raw: unknown): EditorDocV6MigrationResult {
  if (raw == null) return { status: 'missing' };
  const obj = record(raw);
  if (!obj) return { status: 'invalid', reason: 'Editor document must be an object' };

  const version = obj.schemaVersion;
  if (typeof version !== 'number' || !Number.isInteger(version)) {
    return { status: 'invalid', reason: 'schemaVersion must be an integer' };
  }
  if (version > 6) return { status: 'unsupported', version };
  if (version < 1) return { status: 'invalid', reason: 'schemaVersion out of range' };

  if (version === 1 || version === 2 || version === 3) {
    return migrateLegacySharedDoc(obj, version);
  }
  if (version === 4 || version === 5) {
    return migrateObservedLayered(obj, version);
  }
  return migrateV6(obj);
}
