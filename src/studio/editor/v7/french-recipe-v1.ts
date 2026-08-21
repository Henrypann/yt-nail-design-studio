/**
 * FrenchRecipeSpecV1 — structured French authoring contract.
 *
 * Persistence uses the existing RecipeInstanceV7 + ProcessStepV7.recipeInstanceId
 * extension point. Recipe parameters are the only authoring truth. This module
 * does not add EditorDocV7 fields, compile paths, or claim manufacturing validity.
 *
 * Smile-line anchors are canonical canvas/viewBox-local v coordinates:
 * `u = (x - viewBox.x) / viewBox.width`, `v = (y - viewBox.y) / viewBox.height`.
 * `v = 0` is the canvas tip edge; `v = 1` is the canvas root edge. These bounds
 * are product-canvas bounds, never contour-extrema renormalization.
 *
 * `FRENCH_RECIPE_PRESETS_V1` is the five default preset IDs for the 60 golden
 * matrix. Parser also accepts `preset='custom'`. Commands must set `custom`
 * after geometry edits. Compiler geometry is driven by `variant` and the three
 * anchors, never by the preset label. There is no persisted `tipWidth`; a future
 * UI control may atomically edit the anchors instead of storing a second truth.
 */

import type { RecipeInstanceV7, RecipeParameterValueV7 } from './model.ts';

export const FRENCH_RECIPE_ID_V1 = 'french-edge';
export const FRENCH_RECIPE_REVISION_V1 = '1.0.0';
export const FRENCH_RECIPE_DEFAULT_INSTANCE_ID_V1 = 'recipe.french-edge.v1';

export const FRENCH_RECIPE_PRESETS_V1 = ['classic', 'micro', 'soft', 'deep', 'pointed'] as const;
export const FRENCH_RECIPE_CUSTOM_PRESET_V1 = 'custom';
export const FRENCH_RECIPE_VARIANTS_V1 = ['smooth', 'pointed'] as const;
export const FRENCH_RECIPE_TRANSITION_MODES_V1 = ['crisp'] as const;

export type FrenchRecipeDefaultPresetV1 = (typeof FRENCH_RECIPE_PRESETS_V1)[number];
export type FrenchRecipePresetV1 = FrenchRecipeDefaultPresetV1 | typeof FRENCH_RECIPE_CUSTOM_PRESET_V1;
export type FrenchRecipeVariantV1 = (typeof FRENCH_RECIPE_VARIANTS_V1)[number];
export type FrenchRecipeTransitionModeV1 = (typeof FRENCH_RECIPE_TRANSITION_MODES_V1)[number];

/** Frozen exact-key set. Unknown or missing keys fail closed. */
export const FRENCH_RECIPE_PARAMETER_KEYS_V1 = [
  'preset',
  'variant',
  'leftWingV',
  'centerV',
  'rightWingV',
  'fillColor',
  'fillOpacity',
  'balanceLocked',
  'outlineEnabled',
  'outlineColor',
  'outlineWidthMm',
  'transitionMode',
] as const;

export type FrenchRecipeParameterKeyV1 = (typeof FRENCH_RECIPE_PARAMETER_KEYS_V1)[number];

export interface FrenchRecipeParametersV1 {
  /**
   * Default-matrix identity or `custom` after user geometry edits.
   * Compiler geometry ignores this label and uses variant + anchors.
   */
  preset: FrenchRecipePresetV1;
  variant: FrenchRecipeVariantV1;
  /** Canvas/viewBox-local v of the left wing. 0 = canvas tip edge, 1 = canvas root edge. */
  leftWingV: number;
  /** Canvas/viewBox-local v of the smile-line center. 0 = canvas tip edge, 1 = canvas root edge. */
  centerV: number;
  /** Canvas/viewBox-local v of the right wing. 0 = canvas tip edge, 1 = canvas root edge. */
  rightWingV: number;
  /** Canonical `#rrggbb`. Opacity is a separate scalar. */
  fillColor: string;
  fillOpacity: number;
  balanceLocked: boolean;
  outlineEnabled: boolean;
  outlineColor: string;
  /**
   * Outline width in millimetres for a future V7 `vector_shape.strokeWidthMm`.
   * Disabled outlines must be 0; enabled outlines must be at least 0.05.
   */
  outlineWidthMm: number;
  transitionMode: FrenchRecipeTransitionModeV1;
}

export const FRENCH_RECIPE_RANGES_V1 = Object.freeze({
  vMin: 0.02,
  vMax: 0.72,
  vSeparationMin: 0.01,
  opacityMin: 0,
  opacityMax: 1,
  outlineWidthMmMin: 0,
  outlineWidthMmMax: 2,
  outlineWidthMmEnabledMin: 0.05,
  numberDecimals: 6,
});

export type FrenchRecipeDiagnosticCodeV1 =
  | 'not_an_object'
  | 'unknown_key'
  | 'missing_key'
  | 'invalid_type'
  | 'invalid_enum'
  | 'non_finite'
  | 'out_of_range'
  | 'cross_field_invalid'
  | 'invalid_id'
  | 'recipe_identity_mismatch';

export interface FrenchRecipeDiagnosticV1 {
  code: FrenchRecipeDiagnosticCodeV1;
  path: string;
  message: string;
}

export type FrenchRecipeParametersParseResultV1 =
  | { ok: true; parameters: FrenchRecipeParametersV1; serialization: string }
  | { ok: false; diagnostics: FrenchRecipeDiagnosticV1[] };

export type FrenchRecipeInstanceParseResultV1 =
  | { ok: true; instance: RecipeInstanceV7; parameters: FrenchRecipeParametersV1; serialization: string }
  | { ok: false; diagnostics: FrenchRecipeDiagnosticV1[] };

const MAX_DIAGNOSTICS = 32;
const INSTANCE_KEYS = ['instanceId', 'recipeId', 'recipeRevision', 'parameterValues'] as const;
const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const HEX_PATTERN = /^#([0-9a-fA-F]{6})$/;
const DEFAULT_PRESET_SET = new Set<string>(FRENCH_RECIPE_PRESETS_V1);
const PRESET_SET = new Set<string>([...FRENCH_RECIPE_PRESETS_V1, FRENCH_RECIPE_CUSTOM_PRESET_V1]);
const VARIANT_SET = new Set<string>(FRENCH_RECIPE_VARIANTS_V1);
const TRANSITION_SET = new Set<string>(FRENCH_RECIPE_TRANSITION_MODES_V1);
const KEY_SET = new Set<string>(FRENCH_RECIPE_PARAMETER_KEYS_V1);

type UnknownRecord = Record<string, unknown>;

const PRESET_DEFAULTS_V1: Record<FrenchRecipeDefaultPresetV1, FrenchRecipeParametersV1> = {
  classic: {
    preset: 'classic',
    variant: 'smooth',
    leftWingV: 0.34,
    centerV: 0.18,
    rightWingV: 0.34,
    fillColor: '#fffdf9',
    fillOpacity: 1,
    balanceLocked: true,
    outlineEnabled: false,
    outlineColor: '#e8d8d0',
    outlineWidthMm: 0,
    transitionMode: 'crisp',
  },
  micro: {
    preset: 'micro',
    variant: 'smooth',
    leftWingV: 0.18,
    centerV: 0.1,
    rightWingV: 0.18,
    fillColor: '#fffdf9',
    fillOpacity: 1,
    balanceLocked: true,
    outlineEnabled: false,
    outlineColor: '#e8d8d0',
    outlineWidthMm: 0,
    transitionMode: 'crisp',
  },
  soft: {
    preset: 'soft',
    variant: 'smooth',
    leftWingV: 0.42,
    centerV: 0.24,
    rightWingV: 0.42,
    fillColor: '#fffdf9',
    fillOpacity: 1,
    balanceLocked: true,
    outlineEnabled: false,
    outlineColor: '#e8d8d0',
    outlineWidthMm: 0,
    transitionMode: 'crisp',
  },
  deep: {
    preset: 'deep',
    variant: 'smooth',
    leftWingV: 0.52,
    centerV: 0.3,
    rightWingV: 0.52,
    fillColor: '#fffdf9',
    fillOpacity: 1,
    balanceLocked: true,
    outlineEnabled: false,
    outlineColor: '#e8d8d0',
    outlineWidthMm: 0,
    transitionMode: 'crisp',
  },
  pointed: {
    preset: 'pointed',
    variant: 'pointed',
    leftWingV: 0.34,
    centerV: 0.48,
    rightWingV: 0.34,
    fillColor: '#fffdf9',
    fillOpacity: 1,
    balanceLocked: true,
    outlineEnabled: false,
    outlineColor: '#e8d8d0',
    outlineWidthMm: 0,
    transitionMode: 'crisp',
  },
};

export const FRENCH_RECIPE_SPEC_V1 = Object.freeze({
  recipeId: FRENCH_RECIPE_ID_V1,
  recipeRevision: FRENCH_RECIPE_REVISION_V1,
  parameterKeys: FRENCH_RECIPE_PARAMETER_KEYS_V1,
  presets: FRENCH_RECIPE_PRESETS_V1,
  variants: FRENCH_RECIPE_VARIANTS_V1,
  transitionModes: FRENCH_RECIPE_TRANSITION_MODES_V1,
  ranges: FRENCH_RECIPE_RANGES_V1,
});

function record(value: unknown): UnknownRecord | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as UnknownRecord)
    : null;
}

function addDiagnostic(
  diagnostics: FrenchRecipeDiagnosticV1[],
  code: FrenchRecipeDiagnosticCodeV1,
  path: string,
  message: string,
): void {
  if (diagnostics.length < MAX_DIAGNOSTICS) diagnostics.push({ code, path, message });
}

function hasOwn(raw: UnknownRecord, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(raw, key);
}

function canonicalNumber(value: number): number {
  return Number(value.toFixed(FRENCH_RECIPE_RANGES_V1.numberDecimals));
}

function canonicalHex(value: string): string {
  return `#${value.slice(1).toLowerCase()}`;
}

function isDefaultPreset(value: unknown): value is FrenchRecipeDefaultPresetV1 {
  return typeof value === 'string' && DEFAULT_PRESET_SET.has(value);
}

export function isFrenchRecipeIdentityV1(
  recipeId: unknown,
  recipeRevision: unknown = FRENCH_RECIPE_REVISION_V1,
): boolean {
  return recipeId === FRENCH_RECIPE_ID_V1 && recipeRevision === FRENCH_RECIPE_REVISION_V1;
}

export function isFrenchRecipeInstanceV1(value: unknown): value is RecipeInstanceV7 {
  return parseFrenchRecipeInstanceV1(value).ok;
}

export function createDefaultFrenchRecipeParametersV1(
  preset: FrenchRecipeDefaultPresetV1,
): FrenchRecipeParametersV1 {
  return canonicalizeFrenchRecipeParametersV1(PRESET_DEFAULTS_V1[preset]);
}

function orderedParameters(parameters: FrenchRecipeParametersV1): FrenchRecipeParametersV1 {
  const ordered = {} as FrenchRecipeParametersV1;
  for (const key of FRENCH_RECIPE_PARAMETER_KEYS_V1) {
    ordered[key] = parameters[key] as never;
  }
  return ordered;
}

export function canonicalizeFrenchRecipeParametersV1(
  parameters: FrenchRecipeParametersV1,
): FrenchRecipeParametersV1 {
  return orderedParameters({
    preset: parameters.preset,
    variant: parameters.variant,
    leftWingV: canonicalNumber(parameters.leftWingV),
    centerV: canonicalNumber(parameters.centerV),
    rightWingV: canonicalNumber(parameters.rightWingV),
    fillColor: canonicalHex(parameters.fillColor),
    fillOpacity: canonicalNumber(parameters.fillOpacity),
    balanceLocked: parameters.balanceLocked,
    outlineEnabled: parameters.outlineEnabled,
    outlineColor: canonicalHex(parameters.outlineColor),
    outlineWidthMm: canonicalNumber(parameters.outlineWidthMm),
    transitionMode: parameters.transitionMode,
  });
}

function serializeCanonicalNumber(value: number): string {
  return canonicalNumber(value).toFixed(FRENCH_RECIPE_RANGES_V1.numberDecimals);
}

function serializeCanonicalValue(value: RecipeParameterValueV7): string {
  if (typeof value === 'number') return serializeCanonicalNumber(value);
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  return JSON.stringify(value);
}

/** Deterministic hash-input serialization. Same canonical parameters always yield the same string. */
export function serializeFrenchRecipeParametersV1(parameters: FrenchRecipeParametersV1): string {
  const canonical = canonicalizeFrenchRecipeParametersV1(parameters);
  return FRENCH_RECIPE_PARAMETER_KEYS_V1
    .map((key) => `${key}=${serializeCanonicalValue(canonical[key])}`)
    .join('|');
}

function parseEnum(
  raw: UnknownRecord,
  key: FrenchRecipeParameterKeyV1,
  allowed: ReadonlySet<string>,
  diagnostics: FrenchRecipeDiagnosticV1[],
): string | undefined {
  if (!hasOwn(raw, key)) {
    addDiagnostic(diagnostics, 'missing_key', key, `missing required key ${key}`);
    return undefined;
  }
  const value = raw[key];
  if (typeof value !== 'string') {
    addDiagnostic(diagnostics, 'invalid_type', key, `${key} must be a string enum`);
    return undefined;
  }
  if (!allowed.has(value)) {
    addDiagnostic(diagnostics, 'invalid_enum', key, `${key} is not a supported value`);
    return undefined;
  }
  return value;
}

function parseBoolean(
  raw: UnknownRecord,
  key: FrenchRecipeParameterKeyV1,
  diagnostics: FrenchRecipeDiagnosticV1[],
): boolean | undefined {
  if (!hasOwn(raw, key)) {
    addDiagnostic(diagnostics, 'missing_key', key, `missing required key ${key}`);
    return undefined;
  }
  const value = raw[key];
  if (typeof value !== 'boolean') {
    addDiagnostic(diagnostics, 'invalid_type', key, `${key} must be a boolean`);
    return undefined;
  }
  return value;
}

function parseBoundedNumber(
  raw: UnknownRecord,
  key: FrenchRecipeParameterKeyV1,
  min: number,
  max: number,
  diagnostics: FrenchRecipeDiagnosticV1[],
): number | undefined {
  if (!hasOwn(raw, key)) {
    addDiagnostic(diagnostics, 'missing_key', key, `missing required key ${key}`);
    return undefined;
  }
  const value = raw[key];
  if (typeof value !== 'number') {
    addDiagnostic(diagnostics, 'invalid_type', key, `${key} must be a number`);
    return undefined;
  }
  if (!Number.isFinite(value)) {
    addDiagnostic(diagnostics, 'non_finite', key, `${key} must be a finite number`);
    return undefined;
  }
  const canonical = canonicalNumber(value);
  if (canonical < min || canonical > max) {
    addDiagnostic(diagnostics, 'out_of_range', key, `${key} must be in [${min}, ${max}]`);
    return undefined;
  }
  return canonical;
}

function parseHexColor(
  raw: UnknownRecord,
  key: FrenchRecipeParameterKeyV1,
  diagnostics: FrenchRecipeDiagnosticV1[],
): string | undefined {
  if (!hasOwn(raw, key)) {
    addDiagnostic(diagnostics, 'missing_key', key, `missing required key ${key}`);
    return undefined;
  }
  const value = raw[key];
  if (typeof value !== 'string') {
    addDiagnostic(diagnostics, 'invalid_type', key, `${key} must be a #rrggbb string`);
    return undefined;
  }
  if (!HEX_PATTERN.test(value)) {
    addDiagnostic(diagnostics, 'invalid_enum', key, `${key} must be canonical hexadecimal #rrggbb`);
    return undefined;
  }
  return canonicalHex(value);
}

function validateCrossField(
  parameters: FrenchRecipeParametersV1,
  diagnostics: FrenchRecipeDiagnosticV1[],
): void {
  const { vSeparationMin, outlineWidthMmEnabledMin } = FRENCH_RECIPE_RANGES_V1;
  if (parameters.balanceLocked && parameters.leftWingV !== parameters.rightWingV) {
    addDiagnostic(
      diagnostics,
      'cross_field_invalid',
      'leftWingV',
      'balanceLocked requires leftWingV and rightWingV to be equal',
    );
  }
  if (parameters.variant === 'smooth') {
    const wingMin = Math.min(parameters.leftWingV, parameters.rightWingV);
    if (!(parameters.centerV <= wingMin - vSeparationMin)) {
      addDiagnostic(
        diagnostics,
        'cross_field_invalid',
        'centerV',
        'smooth variant requires centerV closer to the canvas tip edge than both wings',
      );
    }
  } else if (!(parameters.centerV >= Math.max(parameters.leftWingV, parameters.rightWingV) + vSeparationMin)) {
    addDiagnostic(
      diagnostics,
      'cross_field_invalid',
      'centerV',
      'pointed variant requires centerV closer to the canvas root edge than both wings',
    );
  }
  if (!parameters.outlineEnabled && parameters.outlineWidthMm !== 0) {
    addDiagnostic(
      diagnostics,
      'cross_field_invalid',
      'outlineWidthMm',
      'outlineEnabled=false requires outlineWidthMm to be 0',
    );
  }
  if (parameters.outlineEnabled && parameters.outlineWidthMm < outlineWidthMmEnabledMin) {
    addDiagnostic(
      diagnostics,
      'cross_field_invalid',
      'outlineWidthMm',
      `outlineEnabled=true requires outlineWidthMm >= ${outlineWidthMmEnabledMin}`,
    );
  }
}

export function parseFrenchRecipeParametersV1(value: unknown): FrenchRecipeParametersParseResultV1 {
  const diagnostics: FrenchRecipeDiagnosticV1[] = [];
  const raw = record(value);
  if (!raw) {
    return {
      ok: false,
      diagnostics: [{ code: 'not_an_object', path: '$', message: 'French recipe parameters must be an object' }],
    };
  }

  for (const key of Object.keys(raw)) {
    if (!KEY_SET.has(key)) {
      addDiagnostic(diagnostics, 'unknown_key', key, `unknown key ${key}`);
    }
  }

  const preset = parseEnum(raw, 'preset', PRESET_SET, diagnostics);
  const variant = parseEnum(raw, 'variant', VARIANT_SET, diagnostics);
  const leftWingV = parseBoundedNumber(
    raw,
    'leftWingV',
    FRENCH_RECIPE_RANGES_V1.vMin,
    FRENCH_RECIPE_RANGES_V1.vMax,
    diagnostics,
  );
  const centerV = parseBoundedNumber(
    raw,
    'centerV',
    FRENCH_RECIPE_RANGES_V1.vMin,
    FRENCH_RECIPE_RANGES_V1.vMax,
    diagnostics,
  );
  const rightWingV = parseBoundedNumber(
    raw,
    'rightWingV',
    FRENCH_RECIPE_RANGES_V1.vMin,
    FRENCH_RECIPE_RANGES_V1.vMax,
    diagnostics,
  );
  const fillColor = parseHexColor(raw, 'fillColor', diagnostics);
  const fillOpacity = parseBoundedNumber(
    raw,
    'fillOpacity',
    FRENCH_RECIPE_RANGES_V1.opacityMin,
    FRENCH_RECIPE_RANGES_V1.opacityMax,
    diagnostics,
  );
  const balanceLocked = parseBoolean(raw, 'balanceLocked', diagnostics);
  const outlineEnabled = parseBoolean(raw, 'outlineEnabled', diagnostics);
  const outlineColor = parseHexColor(raw, 'outlineColor', diagnostics);
  const outlineWidthMm = parseBoundedNumber(
    raw,
    'outlineWidthMm',
    FRENCH_RECIPE_RANGES_V1.outlineWidthMmMin,
    FRENCH_RECIPE_RANGES_V1.outlineWidthMmMax,
    diagnostics,
  );
  const transitionMode = parseEnum(raw, 'transitionMode', TRANSITION_SET, diagnostics);

  if (
    preset === undefined ||
    variant === undefined ||
    leftWingV === undefined ||
    centerV === undefined ||
    rightWingV === undefined ||
    fillColor === undefined ||
    fillOpacity === undefined ||
    balanceLocked === undefined ||
    outlineEnabled === undefined ||
    outlineColor === undefined ||
    outlineWidthMm === undefined ||
    transitionMode === undefined
  ) {
    return { ok: false, diagnostics };
  }

  const parameters = canonicalizeFrenchRecipeParametersV1({
    preset: preset as FrenchRecipePresetV1,
    variant: variant as FrenchRecipeVariantV1,
    leftWingV,
    centerV,
    rightWingV,
    fillColor,
    fillOpacity,
    balanceLocked,
    outlineEnabled,
    outlineColor,
    outlineWidthMm,
    transitionMode: transitionMode as FrenchRecipeTransitionModeV1,
  });
  validateCrossField(parameters, diagnostics);
  if (diagnostics.length > 0) return { ok: false, diagnostics };
  return { ok: true, parameters, serialization: serializeFrenchRecipeParametersV1(parameters) };
}

function parseInstanceId(value: unknown, path: string, diagnostics: FrenchRecipeDiagnosticV1[]): string | undefined {
  if (typeof value !== 'string' || !ID_PATTERN.test(value)) {
    addDiagnostic(diagnostics, 'invalid_id', path, 'instanceId must be a stable V7 id');
    return undefined;
  }
  return value;
}

export function parseFrenchRecipeInstanceV1(value: unknown): FrenchRecipeInstanceParseResultV1 {
  const diagnostics: FrenchRecipeDiagnosticV1[] = [];
  const raw = record(value);
  if (!raw) {
    return {
      ok: false,
      diagnostics: [{ code: 'not_an_object', path: '$', message: 'French recipe instance must be an object' }],
    };
  }

  for (const key of Object.keys(raw)) {
    if (!(INSTANCE_KEYS as readonly string[]).includes(key)) {
      addDiagnostic(diagnostics, 'unknown_key', key, `unknown instance key ${key}`);
    }
  }
  for (const key of INSTANCE_KEYS) {
    if (!hasOwn(raw, key)) addDiagnostic(diagnostics, 'missing_key', key, `missing required instance key ${key}`);
  }

  const instanceId = parseInstanceId(raw.instanceId, 'instanceId', diagnostics);
  if (raw.recipeId !== FRENCH_RECIPE_ID_V1 || raw.recipeRevision !== FRENCH_RECIPE_REVISION_V1) {
    addDiagnostic(
      diagnostics,
      'recipe_identity_mismatch',
      'recipeId',
      `recipe identity must be ${FRENCH_RECIPE_ID_V1}@${FRENCH_RECIPE_REVISION_V1}`,
    );
  }

  const parsedParameters = parseFrenchRecipeParametersV1(raw.parameterValues);
  if (!parsedParameters.ok) diagnostics.push(...parsedParameters.diagnostics.map((item) => ({
    ...item,
    path: item.path === '$' ? 'parameterValues' : `parameterValues.${item.path}`,
  })));

  if (diagnostics.length > 0 || !parsedParameters.ok || instanceId === undefined) {
    return { ok: false, diagnostics };
  }

  const instance: RecipeInstanceV7 = {
    instanceId,
    recipeId: FRENCH_RECIPE_ID_V1,
    recipeRevision: FRENCH_RECIPE_REVISION_V1,
    parameterValues: { ...parsedParameters.parameters },
  };
  return {
    ok: true,
    instance,
    parameters: parsedParameters.parameters,
    serialization: parsedParameters.serialization,
  };
}

export function createFrenchRecipeInstanceV1(
  instanceId: string,
  input: FrenchRecipeDefaultPresetV1 | FrenchRecipeParametersV1,
): FrenchRecipeInstanceParseResultV1 {
  const diagnostics: FrenchRecipeDiagnosticV1[] = [];
  if (!ID_PATTERN.test(instanceId)) {
    addDiagnostic(diagnostics, 'invalid_id', 'instanceId', 'instanceId must be a stable V7 id');
    return { ok: false, diagnostics };
  }
  const parsed = isDefaultPreset(input)
    ? parseFrenchRecipeParametersV1(createDefaultFrenchRecipeParametersV1(input))
    : parseFrenchRecipeParametersV1(input);
  if (!parsed.ok) return parsed;
  return parseFrenchRecipeInstanceV1({
    instanceId,
    recipeId: FRENCH_RECIPE_ID_V1,
    recipeRevision: FRENCH_RECIPE_REVISION_V1,
    parameterValues: parsed.parameters,
  });
}
