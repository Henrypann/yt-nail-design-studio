/**
 * Pure EditorDoc v1-v7 reader/migrator.
 *
 * This module never reads or writes storage. Legacy data that cannot be safely
 * represented in EditorDocV7 is retained in the result-side evidence envelope,
 * never embedded as an opaque canonical payload.
 */

import { FINGER_CODES, type FingerCode, type NailLength, type NailShape } from '../../../lib/types.ts';
import { migrateEditorDocV6 } from '../v6/migrate.ts';
import type {
  EditorDocRecipeInstanceV6,
  EditorDocV6,
  EditorElementV6,
  EditorLayerV6,
} from '../v6/model.ts';
import type {
  AssetRefV7,
  BackgroundPayloadV7,
  EditorDocV7,
  FlatDesignElementV7,
  GeometryRefV7,
  ProcessStepV7,
  RecipeInstanceV7,
  RecipeParameterValueV7,
  RgbaColorV7,
  SurfaceFinishTypeV7,
  VersionedRefV7,
} from './model.ts';
import { hasRichLegacyFrenchFieldsV1 } from './french-migration-v1.ts';
import { PROCESS_STEP_TYPE_IDS_V7 } from './registry.ts';
import { parseEditorDocV7 } from './schema.ts';

type UnknownRecord = Record<string, unknown>;

export type EditorDocV7MigrationDiagnosticCode =
  | 'legacy_bridge'
  | 'finish_defaulted'
  | 'finish_preset_unresolved'
  | 'legacy_optical_effect'
  | 'geometry_unresolved'
  | 'background_cardinality'
  | 'invalid_legacy_color'
  | 'unknown_layer_type'
  | 'unknown_element_kind'
  | 'legacy_french_rich'
  | 'coordinate_conversion_unavailable'
  | 'asset_unresolved'
  | 'recipe_preserved_with_warning'
  | 'recipe_resolver_rejected'
  | 'communication_asset_unresolved'
  | 'communication_timestamp_invalid'
  | 'v7_validation_failed'
  | 'storage_key_mismatch';

export interface EditorDocV7MigrationDiagnostic {
  code: EditorDocV7MigrationDiagnosticCode;
  path: string;
  severity: 'warning' | 'error';
  message: string;
  evidenceIndex?: number;
}

export interface EditorDocV7LegacyEvidence {
  kind: 'document' | 'layer' | 'element' | 'recipe' | 'communication';
  path: string;
  sourceId?: string;
  value: unknown;
}

export interface GeometryResolutionInputV7 {
  sourceVersion: number;
  designId: string;
  finger: FingerCode;
  shape: NailShape;
  length: NailLength;
}

export interface AssetResolutionInputV7 {
  sourceVersion: number;
  designId: string;
  finger?: FingerCode;
  category: 'flat_image' | 'attachment' | 'communication';
  path: string;
  sourceId: string;
  legacyValue: unknown;
}

export interface RecipeResolutionInputV7 {
  sourceVersion: number;
  designId: string;
  instance: EditorDocRecipeInstanceV6;
}

export interface FinishPresetResolutionInputV7 {
  sourceVersion: number;
  designId: string;
  finishType: SurfaceFinishTypeV7;
}

export interface RecipeResolutionV7 {
  recipeId: string;
  recipeRevision: string;
  parameterValues: Record<string, RecipeParameterValueV7>;
}

export interface EditorDocV7MigrationResolvers {
  resolveGeometry(input: GeometryResolutionInputV7): GeometryRefV7 | null;
  resolveFinishPreset(input: FinishPresetResolutionInputV7): VersionedRefV7 | null;
  resolveAsset?(input: AssetResolutionInputV7): AssetRefV7 | null;
  resolveRecipe?(input: RecipeResolutionInputV7): RecipeResolutionV7 | null;
}

interface PresentResultBase {
  sourceVersion: number | null;
  original: unknown;
  diagnostics: EditorDocV7MigrationDiagnostic[];
  legacyEvidence: EditorDocV7LegacyEvidence[];
}

export type EditorDocV7MigrationResult =
  | ({ status: 'migrated'; doc: EditorDocV7; migrated: boolean } & PresentResultBase)
  | ({ status: 'migrated_with_warnings'; doc: EditorDocV7; migrated: true } & PresentResultBase)
  | ({ status: 'invalid'; reason: string } & PresentResultBase)
  | ({ status: 'unsupported'; version: number; reason: string } & PresentResultBase)
  | { status: 'missing' };

interface MigrationContext {
  sourceVersion: number;
  designId: string;
  diagnostics: EditorDocV7MigrationDiagnostic[];
  legacyEvidence: EditorDocV7LegacyEvidence[];
}

const MAX_DIAGNOSTICS = 200;
const MAX_EVIDENCE = 200;
function record(value: unknown): UnknownRecord | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as UnknownRecord)
    : null;
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function fnv1a64(value: string, seed: bigint): string {
  let hash = seed;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= BigInt(value.charCodeAt(index));
    hash = BigInt.asUintN(64, hash * 0x100000001b3n);
  }
  return hash.toString(16).padStart(16, '0');
}

function stableHash(value: string): string {
  return `${fnv1a64(value, 0xcbf29ce484222325n)}${fnv1a64(`v7|${value}`, 0x84222325cbf29cen)}`;
}

function migrationId(...parts: Array<string | number>): string {
  const source = parts.join('|');
  const readable = parts
    .join('_')
    .replace(/[^A-Za-z0-9._:-]+/g, '_')
    .slice(0, 88);
  return `migv7.${readable}.${stableHash(source)}`;
}

function addDiagnostic(
  context: MigrationContext,
  diagnostic: Omit<EditorDocV7MigrationDiagnostic, 'evidenceIndex'>,
  evidence?: Omit<EditorDocV7LegacyEvidence, 'value'> & { value: unknown },
): void {
  if (context.diagnostics.length >= MAX_DIAGNOSTICS) {
    if (diagnostic.severity === 'error') {
      let replaced = false;
      for (let index = context.diagnostics.length - 1; index >= 0; index -= 1) {
        if (context.diagnostics[index].severity === 'warning') {
          context.diagnostics[index] = diagnostic;
          replaced = true;
          break;
        }
      }
      if (!replaced) context.diagnostics[context.diagnostics.length - 1] = diagnostic;
    }
    return;
  }
  let evidenceIndex: number | undefined;
  if (evidence && context.legacyEvidence.length < MAX_EVIDENCE) {
    evidenceIndex = context.legacyEvidence.length;
    context.legacyEvidence.push({ ...evidence, value: clone(evidence.value) });
  }
  context.diagnostics.push({ ...diagnostic, evidenceIndex });
}

function invalidResult(
  original: unknown,
  context: MigrationContext,
  reason: string,
): EditorDocV7MigrationResult {
  return {
    status: 'invalid',
    sourceVersion: context.sourceVersion,
    reason,
    original,
    diagnostics: context.diagnostics,
    legacyEvidence: context.legacyEvidence,
  };
}

function unsupportedResult(
  original: unknown,
  context: MigrationContext,
  reason: string,
): EditorDocV7MigrationResult {
  return {
    status: 'unsupported',
    sourceVersion: context.sourceVersion,
    version: context.sourceVersion,
    reason,
    original,
    diagnostics: context.diagnostics,
    legacyEvidence: context.legacyEvidence,
  };
}

function parseHexColor(value: unknown): RgbaColorV7 | null {
  if (typeof value !== 'string') return null;
  const match = /^#([a-f0-9]{6}|[a-f0-9]{8})$/i.exec(value);
  if (!match) return null;
  const hex = match[1];
  return {
    colorSpace: 'srgb',
    r: Number.parseInt(hex.slice(0, 2), 16),
    g: Number.parseInt(hex.slice(2, 4), 16),
    b: Number.parseInt(hex.slice(4, 6), 16),
    a: hex.length === 8 ? Number.parseInt(hex.slice(6, 8), 16) / 255 : 1,
  };
}

function normalizedPoint(value: unknown): { u: number; v: number } | null {
  const raw = record(value);
  if (!raw || typeof raw.u !== 'number' || typeof raw.v !== 'number') return null;
  if (!Number.isFinite(raw.u) || !Number.isFinite(raw.v)) return null;
  if (raw.u < 0 || raw.u > 1 || raw.v < 0 || raw.v > 1) return null;
  return { u: raw.u, v: raw.v };
}

function identityTransform() {
  return { position: { u: 0.5, v: 0.5 }, scaleX: 1, scaleY: 1, rotationDeg: 0 };
}

function scalarParameters(value: unknown): Record<string, RecipeParameterValueV7> | null {
  const raw = record(value);
  if (!raw) return null;
  const result: Record<string, RecipeParameterValueV7> = {};
  for (const [key, parameter] of Object.entries(raw)) {
    if (!/^[a-z][A-Za-z0-9_]{0,63}$/.test(key)) return null;
    if (
      typeof parameter !== 'string' &&
      typeof parameter !== 'boolean' &&
      !(typeof parameter === 'number' && Number.isFinite(parameter))
    ) {
      return null;
    }
    result[key] = parameter;
  }
  return result;
}

function validStableId(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(value);
}

function validVersionedRef(value: unknown): value is VersionedRefV7 {
  const raw = record(value);
  return Boolean(raw && validStableId(raw.id) && typeof raw.revision === 'string' && raw.revision.length > 0);
}

function validRecipeResolution(value: RecipeResolutionV7): boolean {
  return (
    validStableId(value.recipeId) &&
    typeof value.recipeRevision === 'string' &&
    value.recipeRevision.length > 0 &&
    scalarParameters(value.parameterValues) !== null
  );
}

function convertRecipe(
  instance: EditorDocRecipeInstanceV6,
  resolvers: EditorDocV7MigrationResolvers,
  context: MigrationContext,
  path: string,
): RecipeInstanceV7 {
  const resolved = resolvers.resolveRecipe?.({
    sourceVersion: context.sourceVersion,
    designId: context.designId,
    instance: clone(instance),
  });
  if (resolved && validRecipeResolution(resolved)) {
    return {
      instanceId: instance.id,
      recipeId: resolved.recipeId,
      recipeRevision: resolved.recipeRevision,
      parameterValues: clone(resolved.parameterValues),
    };
  }
  if (resolved) {
    addDiagnostic(context, {
      code: 'recipe_resolver_rejected',
      path,
      severity: 'warning',
      message: 'Recipe resolver returned an invalid V7 reference; the legacy identity fallback is retained.',
    });
  }

  const recipe = record(instance.recipe);
  const recipeRef = record(recipe?.recipeRef);
  const parameters = scalarParameters(recipe?.parameters);
  const refId = typeof recipeRef?.id === 'string' ? recipeRef.id : instance.recipeId;
  const refVersion = recipeRef?.version;
  const revision =
    typeof refVersion === 'string' || typeof refVersion === 'number'
      ? String(refVersion)
      : 'legacy:v6:unresolved';
  addDiagnostic(
    context,
    {
      code: 'recipe_preserved_with_warning',
      path,
      severity: 'warning',
      message: 'Legacy recipe identity was retained, but its opaque body was not copied into V7.',
    },
    { kind: 'recipe', path, sourceId: instance.id, value: instance },
  );
  return {
    instanceId: instance.id,
    recipeId: refId,
    recipeRevision: revision,
    parameterValues: parameters ?? {},
  };
}

function safeOpacity(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1
    ? value
    : 1;
}

function convertFlatElement(
  element: EditorElementV6,
  finger: FingerCode,
  layer: EditorLayerV6,
  elementIndex: number,
  resolvers: EditorDocV7MigrationResolvers,
  context: MigrationContext,
): FlatDesignElementV7 | null {
  const path = `$.nails.${finger}.layers.${layer.id}.elements[${elementIndex}]`;
  const sourceId = element.id;
  const common = {
    id: migrationId(context.designId, finger, layer.id, sourceId),
    visible: element.visible,
    locked: element.locked,
    opacity: safeOpacity(element.opacity),
    transform: identityTransform(),
  };

  if (element.kind === 'brush' || element.kind === 'eraser') {
    const rawPoints = Array.isArray(element.points) ? element.points : null;
    const points = rawPoints?.map(normalizedPoint) ?? null;
    const widthMm = element.widthMm;
    if (
      !points ||
      points.length < 2 ||
      points.some((point) => point === null) ||
      typeof widthMm !== 'number' ||
      !Number.isFinite(widthMm) ||
      widthMm <= 0
    ) {
      addDiagnostic(
        context,
        {
          code: 'coordinate_conversion_unavailable',
          path,
          severity: 'warning',
          message: 'Legacy drawing coordinates or width lack a signed conversion to nail-local V7 units.',
        },
        { kind: 'element', path, sourceId, value: element },
      );
      return null;
    }
    const normalized = points as Array<{ u: number; v: number }>;
    if (element.kind === 'eraser') {
      return { ...common, kind: 'eraser_mask', path: normalized, widthMm };
    }
    const color = parseHexColor(element.color);
    if (!color) {
      addDiagnostic(
        context,
        {
          code: 'invalid_legacy_color',
          path: `${path}.color`,
          severity: 'warning',
          message: 'Legacy brush color cannot be represented as canonical sRGB RGBA.',
        },
        { kind: 'element', path, sourceId, value: element },
      );
      return null;
    }
    return { ...common, kind: 'brush_stroke', points: normalized, color, widthMm };
  }

  if (element.kind === 'image' || element.kind === 'template_pattern') {
    const asset = resolvers.resolveAsset?.({
      sourceVersion: context.sourceVersion,
      designId: context.designId,
      finger,
      category: 'flat_image',
      path,
      sourceId,
      legacyValue: clone(element),
    });
    if (!asset) {
      addDiagnostic(
        context,
        {
          code: 'asset_unresolved',
          path,
          severity: 'warning',
          message: 'Legacy 2D content has no verified V7 asset reference and was not embedded.',
        },
        { kind: 'element', path, sourceId, value: element },
      );
      return null;
    }
    return {
      ...common,
      kind: 'image_2d',
      role: element.kind === 'template_pattern' ? 'stamp' : 'import',
      asset,
    };
  }

  if (element.kind === 'french_edge') {
    if (hasRichLegacyFrenchFieldsV1(element)) {
      addDiagnostic(
        context,
        {
          code: 'legacy_french_rich',
          path,
          severity: 'warning',
          message: 'Rich V3/V6 French payload cannot be flattened into V7 french_edge; retained as migration evidence.',
        },
        { kind: 'element', path, sourceId, value: element },
      );
      return null;
    }
    const color = parseHexColor(element.color);
    const widthRatio = element.widthRatio;
    const curvature = element.curvature;
    if (
      !color ||
      typeof widthRatio !== 'number' ||
      !Number.isFinite(widthRatio) ||
      widthRatio < 0 ||
      widthRatio > 1 ||
      typeof curvature !== 'number' ||
      !Number.isFinite(curvature) ||
      curvature < -1 ||
      curvature > 1
    ) {
      addDiagnostic(
        context,
        {
          code: 'unknown_element_kind',
          path,
          severity: 'warning',
          message: 'Legacy French payload is incomplete and was retained only as migration evidence.',
        },
        { kind: 'element', path, sourceId, value: element },
      );
      return null;
    }
    return { ...common, kind: 'french_edge', widthRatio, curvature, color };
  }

  addDiagnostic(
    context,
    {
      code: 'unknown_element_kind',
      path,
      severity: 'warning',
      message: `Legacy element kind ${element.kind} has no lossless V7 mapping.`,
    },
    { kind: 'element', path, sourceId, value: element },
  );
  return null;
}

function convertDecorationLayer(
  layer: EditorLayerV6,
  finger: FingerCode,
  resolvers: EditorDocV7MigrationResolvers,
  context: MigrationContext,
): ProcessStepV7 {
  const decorations: Extract<ProcessStepV7, { kind: 'dimensional_decoration' }>['decorations'] = [];
  layer.elements.forEach((element, index) => {
    const path = `$.nails.${finger}.layers.${layer.id}.elements[${index}]`;
    const point = normalizedPoint(element.anchor ?? element.uv);
    const heightMm = element.heightMm;
    if (
      element.kind === 'attachment' &&
      point &&
      typeof heightMm === 'number' &&
      Number.isFinite(heightMm) &&
      heightMm > 0
    ) {
      const asset = resolvers.resolveAsset?.({
        sourceVersion: context.sourceVersion,
        designId: context.designId,
        finger,
        category: 'attachment',
        path,
        sourceId: element.id,
        legacyValue: clone(element),
      });
      if (asset) {
        decorations.push({
          id: migrationId(context.designId, finger, layer.id, element.id),
          kind: 'attachment_3d',
          visible: element.visible,
          locked: element.locked,
          transform: identityTransform(),
          heightMm,
          previewFidelity: 'approximate',
          asset,
          anchor: point,
        });
        return;
      }
      addDiagnostic(
        context,
        {
          code: 'asset_unresolved',
          path,
          severity: 'warning',
          message: 'Legacy attachment has no verified V7 mesh asset reference.',
        },
        { kind: 'element', path, sourceId: element.id, value: element },
      );
      return;
    }

    addDiagnostic(
      context,
      {
        code: 'unknown_element_kind',
        path,
        severity: 'warning',
        message: 'Legacy relief/attachment lacks a signed outline, anchor, height, or asset mapping.',
      },
      { kind: 'element', path, sourceId: element.id, value: element },
    );
  });
  return {
    id: migrationId(context.designId, finger, layer.id, 'decoration'),
    typeId: PROCESS_STEP_TYPE_IDS_V7.dimensional_decoration,
    kind: 'dimensional_decoration',
    name: layer.name,
    visible: layer.visible,
    locked: layer.locked,
    skipped: false,
    recipeInstanceId: layer.recipeInstanceId,
    materialRefs: [],
    decorations,
  };
}

function backgroundPayload(
  doc: EditorDocV6,
  color: RgbaColorV7,
  finger: FingerCode,
  context: MigrationContext,
): BackgroundPayloadV7 {
  if (doc.appearance.opticalEffect === 'cat-eye') {
    addDiagnostic(context, {
      code: 'legacy_optical_effect',
      path: `$.nails.${finger}.background`,
      severity: 'warning',
      message: 'Whole-nail cat-eye scope was retained, but legacy effect parameters were not available.',
    });
    return {
      mode: 'cat_eye',
      opacity: 1,
      color,
      directionDeg: 0,
      intensity: 0.5,
      bandWidth: 0.5,
      previewFidelity: 'approximate',
    };
  }
  if (doc.appearance.opticalEffect !== 'none') {
    addDiagnostic(context, {
      code: 'legacy_optical_effect',
      path: `$.nails.${finger}.background`,
      severity: 'warning',
      message: `Legacy whole-document optical effect ${doc.appearance.opticalEffect} has no exact V7 background mode.`,
    });
  }
  return doc.appearance.baseCoverage === 'translucent'
    ? { mode: 'translucent', opacity: 1, color }
    : { mode: 'solid', opacity: 1, color };
}

function prepareLegacyCandidate(
  raw: UnknownRecord,
  version: number,
  context: MigrationContext,
): unknown {
  if (version === 1) {
    if (raw.finish !== 'gloss' && raw.finish !== 'matte') {
      addDiagnostic(context, {
        code: 'finish_defaulted',
        path: '$.finish',
        severity: 'warning',
        message: 'Legacy finish was not gloss/matte; V7 uses gloss and records this diagnostic.',
      });
    }
    return raw;
  }
  const appearance = record(raw.appearance);
  const topFinish = appearance?.topFinish;
  if (topFinish === 'gloss' || topFinish === 'matte') return raw;
  addDiagnostic(context, {
    code: 'finish_defaulted',
    path: '$.appearance.topFinish',
    severity: 'warning',
    message: 'Missing or unknown legacy top finish defaults to gloss for V7 migration.',
  });
  if (version !== 6 || !appearance) return raw;
  const candidate = clone(raw);
  const candidateAppearance = record(candidate.appearance);
  if (candidateAppearance) candidateAppearance.topFinish = 'gloss';
  return candidate;
}

function migrateV6ToV7(
  doc: EditorDocV6,
  original: unknown,
  resolvers: EditorDocV7MigrationResolvers,
  context: MigrationContext,
): EditorDocV7MigrationResult {
  const geometryRefs = {} as Record<FingerCode, GeometryRefV7>;
  for (const finger of FINGER_CODES) {
    const override = doc.nails[finger].geometryOverride;
    const shape = override?.shape ?? doc.defaultGeometry.shape;
    const length = override?.length ?? doc.defaultGeometry.length;
    const resolved = resolvers.resolveGeometry({
      sourceVersion: context.sourceVersion,
      designId: doc.designId,
      finger,
      shape,
      length,
    });
    if (!resolved || !validStableId(resolved.assetId) || typeof resolved.revision !== 'string' || resolved.revision.length === 0) {
      addDiagnostic(context, {
        code: 'geometry_unresolved',
        path: `$.nails.${finger}.geometryRef`,
        severity: 'error',
        message: `No signed geometry asset exists for ${shape}/${length}/${finger}.`,
      });
    } else {
      geometryRefs[finger] = clone(resolved);
    }
  }
  if (context.diagnostics.some((item) => item.code === 'geometry_unresolved')) {
    return unsupportedResult(original, context, 'one or more nail geometry assets are unresolved');
  }

  const finishType = doc.appearance.topFinish === 'matte' ? 'matte' : 'gloss';
  const finishPresetRef = resolvers.resolveFinishPreset({
    sourceVersion: context.sourceVersion,
    designId: doc.designId,
    finishType,
  });
  if (!finishPresetRef || !validVersionedRef(finishPresetRef)) {
    addDiagnostic(context, {
      code: 'finish_preset_unresolved',
      path: '$.appearance.topFinish',
      severity: 'error',
      message: `No signed V7 material preset exists for ${finishType}.`,
    });
    return unsupportedResult(original, context, 'surface finish material preset is unresolved');
  }

  const recipeInstances: Record<string, RecipeInstanceV7> = {};
  for (const [key, instance] of Object.entries(doc.recipeInstances)) {
    recipeInstances[key] = convertRecipe(
      instance,
      resolvers,
      context,
      `$.recipeInstances.${key}`,
    );
  }

  const nails = {} as EditorDocV7['nails'];
  for (const finger of FINGER_CODES) {
    const sourceNail = doc.nails[finger];
    const baseLayers = sourceNail.layers.filter((layer) => layer.typeId === 'builtin.base_surface');
    if (baseLayers.length !== 1) {
      addDiagnostic(context, {
        code: 'background_cardinality',
        path: `$.nails.${finger}.layers`,
        severity: 'error',
        message: 'V6 source must contain exactly one base_surface layer per finger.',
      });
      return invalidResult(original, context, `background cardinality invalid for ${finger}`);
    }
    const baseLayer = baseLayers[0];
    const color = parseHexColor(baseLayer.surface?.baseColor);
    if (!color) {
      addDiagnostic(context, {
        code: 'invalid_legacy_color',
        path: `$.nails.${finger}.layers.${baseLayer.id}.surface.baseColor`,
        severity: 'error',
        message: 'Legacy background color is not canonical hexadecimal sRGB.',
      });
      return invalidResult(original, context, `background color invalid for ${finger}`);
    }

    const steps: ProcessStepV7[] = [{
      id: migrationId(doc.designId, finger, baseLayer.id, 'background'),
      typeId: PROCESS_STEP_TYPE_IDS_V7.background,
      kind: 'background',
      name: baseLayer.name,
      visible: baseLayer.visible,
      locked: baseLayer.locked,
      skipped: false,
      recipeInstanceId: baseLayer.recipeInstanceId,
      materialRefs: [],
      background: backgroundPayload(doc, color, finger, context),
    }];

    for (const layer of sourceNail.layers) {
      if (layer === baseLayer) continue;
      if (
        layer.typeId === 'builtin.draw' ||
        layer.typeId === 'builtin.art_2d' ||
        layer.typeId === 'builtin.recipe'
      ) {
        const elements = layer.elements
          .map((element, index) => convertFlatElement(element, finger, layer, index, resolvers, context))
          .filter((element): element is FlatDesignElementV7 => element !== null);
        steps.push({
          id: migrationId(doc.designId, finger, layer.id, 'flat'),
          typeId: PROCESS_STEP_TYPE_IDS_V7.flat_design,
          kind: 'flat_design',
          name: layer.name,
          visible: layer.visible,
          locked: layer.locked,
          skipped: false,
          recipeInstanceId: layer.recipeInstanceId,
          materialRefs: [],
          elements,
        });
        continue;
      }
      if (layer.typeId === 'builtin.relief' || layer.typeId === 'builtin.attachment') {
        steps.push(convertDecorationLayer(layer, finger, resolvers, context));
        continue;
      }
      const layerPath = `$.nails.${finger}.layers.${layer.id}`;
      addDiagnostic(
        context,
        {
          code: 'unknown_layer_type',
          path: layerPath,
          severity: 'warning',
          message: `Legacy layer type ${layer.typeId} has no canonical V7 step mapping.`,
        },
        { kind: 'layer', path: layerPath, sourceId: layer.id, value: layer },
      );
      steps.push({
        id: migrationId(doc.designId, finger, layer.id, 'preserved'),
        typeId: PROCESS_STEP_TYPE_IDS_V7.flat_design,
        kind: 'flat_design',
        name: layer.name,
        visible: layer.visible,
        locked: layer.locked,
        skipped: false,
        recipeInstanceId: layer.recipeInstanceId,
        materialRefs: [],
        elements: [],
      });
    }

    steps.push({
      id: migrationId(doc.designId, finger, 'surface_finish'),
      typeId: PROCESS_STEP_TYPE_IDS_V7.surface_finish,
      kind: 'surface_finish',
      name: 'Surface finish',
      visible: true,
      locked: false,
      skipped: false,
      materialRefs: [],
      finish: {
        type: finishType,
        materialPresetRef: clone(finishPresetRef),
      },
    });
    nails[finger] = { finger, geometryRef: geometryRefs[finger], steps };
  }

  const communicationRefs: EditorDocV7['communicationRefs'] = [];
  doc.communicationRefs.forEach((communication, index) => {
    const path = `$.communicationRefs[${index}]`;
    if (!Number.isFinite(Date.parse(communication.uploadedAt))) {
      addDiagnostic(
        context,
        {
          code: 'communication_timestamp_invalid',
          path: `${path}.uploadedAt`,
          severity: 'warning',
          message: 'Legacy communication timestamp is invalid; the record remains only as migration evidence.',
        },
        { kind: 'communication', path, sourceId: communication.id, value: communication },
      );
      return;
    }
    const asset = resolvers.resolveAsset?.({
      sourceVersion: context.sourceVersion,
      designId: doc.designId,
      category: 'communication',
      path,
      sourceId: communication.id,
      legacyValue: clone(communication),
    });
    if (!asset) {
      addDiagnostic(
        context,
        {
          code: 'communication_asset_unresolved',
          path,
          severity: 'warning',
          message: 'Legacy inline communication data was not embedded in V7; evidence remains in the migration result.',
        },
        { kind: 'communication', path, sourceId: communication.id, value: communication },
      );
      return;
    }
    communicationRefs.push({
      communicationId: communication.id,
      asset,
      caption: communication.caption,
      createdAt: communication.uploadedAt,
    });
  });

  const candidate: EditorDocV7 = {
    schemaVersion: 7,
    designId: doc.designId,
    customerRef: doc.customerId,
    title: doc.title,
    nails,
    recipeInstances,
    sourceRefs: [{
      domain: 'legacy',
      sourceId: doc.designId,
      revision: `schema-${context.sourceVersion}`,
    }],
    communicationRefs,
    outputIntent: doc.outputIntent,
    revision: doc.revision,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
  const parsed = parseEditorDocV7(candidate);
  if (!parsed.ok) {
    addDiagnostic(
      context,
      {
        code: 'v7_validation_failed',
        path: parsed.issues[0]?.path ?? '$',
        severity: 'error',
        message: parsed.reason,
      },
      { kind: 'document', path: '$', sourceId: doc.designId, value: candidate },
    );
    return invalidResult(original, context, `migrated V7 validation failed: ${parsed.reason}`);
  }
  const hasWarnings = context.diagnostics.some((item) => item.severity === 'warning');
  return {
    status: hasWarnings ? 'migrated_with_warnings' : 'migrated',
    migrated: true,
    sourceVersion: context.sourceVersion,
    doc: parsed.doc,
    original,
    diagnostics: context.diagnostics,
    legacyEvidence: context.legacyEvidence,
  };
}

/** Pure migration. It never writes storage and never mutates the supplied value. */
export function migrateEditorDocV7(
  raw: unknown,
  resolvers: EditorDocV7MigrationResolvers,
): EditorDocV7MigrationResult {
  if (raw == null) return { status: 'missing' };
  const original = clone(raw);
  const source = record(raw);
  if (!source) {
    const context: MigrationContext = {
      sourceVersion: 0,
      designId: 'unknown',
      diagnostics: [],
      legacyEvidence: [],
    };
    return invalidResult(original, context, 'Editor document must be an object');
  }
  const version = source.schemaVersion;
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) {
    const context: MigrationContext = {
      sourceVersion: typeof version === 'number' && Number.isFinite(version) ? version : 0,
      designId: typeof source.designId === 'string' ? source.designId : 'unknown',
      diagnostics: [],
      legacyEvidence: [],
    };
    return invalidResult(original, context, 'schemaVersion must be an integer >= 1');
  }
  const context: MigrationContext = {
    sourceVersion: version,
    designId: typeof source.designId === 'string' ? source.designId : 'unknown',
    diagnostics: [],
    legacyEvidence: [],
  };
  if (version > 7) return unsupportedResult(original, context, `future EditorDoc schema ${version}`);
  if (version === 7) {
    const parsed = parseEditorDocV7(raw);
    if (!parsed.ok) return invalidResult(original, context, parsed.reason);
    return {
      status: 'migrated',
      migrated: false,
      sourceVersion: 7,
      doc: parsed.doc,
      original,
      diagnostics: [],
      legacyEvidence: [],
    };
  }

  if (version < 6) {
    addDiagnostic(context, {
      code: 'legacy_bridge',
      path: '$.schemaVersion',
      severity: 'warning',
      message: `EditorDocV${version} was normalized through the existing V6 pure migrator before V7 conversion.`,
    });
  }
  const candidate = prepareLegacyCandidate(source, version, context);
  const v6 = migrateEditorDocV6(candidate);
  if (v6.status === 'unsupported') {
    return unsupportedResult(original, context, `V6 bridge cannot read schema ${v6.version}`);
  }
  if (v6.status === 'invalid') return invalidResult(original, context, v6.reason);
  if (v6.status === 'missing') return invalidResult(original, context, 'legacy bridge returned missing');
  context.designId = v6.doc.designId;
  return migrateV6ToV7(v6.doc, original, resolvers, context);
}
