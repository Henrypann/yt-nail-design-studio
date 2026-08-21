/**
 * Pure French legacy conversion preview.
 *
 * Distinguishes V7 simple french_edge (widthRatio/curvature/color) from rich
 * V3/V6 French (arc/v/double, three-point controls, outline, lineGap).
 * Never mutates the input, never writes EditorDoc, and never guesses preset,
 * overall style, makeability, or manufacturing capability.
 */

import type { PreviewFidelityV7, RgbaColorV7 } from './model.ts';
import {
  FRENCH_RECIPE_ID_V1,
  FRENCH_RECIPE_REVISION_V1,
} from './french-recipe-v1.ts';

export type FrenchLegacyFamilyV1 = 'v7_simple' | 'v3_v6_rich' | 'unknown';

export type FrenchLegacyDiagnosticCodeV1 =
  | 'not_french_edge'
  | 'incomplete_v7_simple'
  | 'invalid_v7_simple'
  | 'preset_not_inferred'
  | 'geometry_not_nail_local'
  | 'unsupported_double_variant'
  | 'unsupported_legacy_variant'
  | 'mixed_legacy_fields'
  | 'curvature_has_no_three_point_mapping'
  | 'stroke_width_units_unavailable';

export interface FrenchLegacyDiagnosticV1 {
  code: FrenchLegacyDiagnosticCodeV1;
  path: string;
  message: string;
}

export interface FrenchLegacySourceIdentityV1 {
  kind: 'french_edge';
  family: FrenchLegacyFamilyV1;
  recipeId: typeof FRENCH_RECIPE_ID_V1;
  recipeRevision: typeof FRENCH_RECIPE_REVISION_V1;
  sourceId?: string;
  path?: string;
  sourceVersion?: number;
  legacyVariant?: string;
}

export interface FrenchLegacyConversionPreviewV1 {
  family: FrenchLegacyFamilyV1;
  status: PreviewFidelityV7;
  sourceIdentity: FrenchLegacySourceIdentityV1;
  source: unknown;
  parameters: null;
  limitations: string[];
  diagnostics: FrenchLegacyDiagnosticV1[];
}

const RICH_FRENCH_KEYS = [
  'variant',
  'fillColor',
  'classicControls',
  'tipOffset',
  'smileDepth',
  'lineGap',
  'outlineEnabled',
  'strokeColor',
  'strokeWidth',
] as const;

const SIMPLE_FRENCH_KEYS = ['widthRatio', 'curvature', 'color'] as const;

type UnknownRecord = Record<string, unknown>;

function record(value: unknown): UnknownRecord | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as UnknownRecord)
    : null;
}

function hasOwn(raw: UnknownRecord, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(raw, key);
}

function cloneSource(value: unknown): unknown {
  return structuredClone(value);
}

export function hasRichLegacyFrenchFieldsV1(value: unknown): boolean {
  const raw = record(value);
  if (!raw) return false;
  return RICH_FRENCH_KEYS.some((key) => hasOwn(raw, key));
}

function hasSimpleFrenchFields(raw: UnknownRecord): boolean {
  return SIMPLE_FRENCH_KEYS.some((key) => hasOwn(raw, key));
}

function isHexColor(value: unknown): value is string {
  return typeof value === 'string' && /^#([0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(value);
}

function isRgbaColor(value: unknown): value is RgbaColorV7 {
  const raw = record(value);
  if (!raw) return false;
  return (
    raw.colorSpace === 'srgb' &&
    typeof raw.r === 'number' && Number.isInteger(raw.r) && raw.r >= 0 && raw.r <= 255 &&
    typeof raw.g === 'number' && Number.isInteger(raw.g) && raw.g >= 0 && raw.g <= 255 &&
    typeof raw.b === 'number' && Number.isInteger(raw.b) && raw.b >= 0 && raw.b <= 255 &&
    typeof raw.a === 'number' && Number.isFinite(raw.a) && raw.a >= 0 && raw.a <= 1
  );
}

function isSimpleFrenchColor(value: unknown): boolean {
  return isHexColor(value) || isRgbaColor(value);
}

function classifyFamily(raw: UnknownRecord | null): FrenchLegacyFamilyV1 {
  if (!raw || raw.kind !== 'french_edge') return 'unknown';
  if (hasRichLegacyFrenchFieldsV1(raw)) return 'v3_v6_rich';
  if (
    typeof raw.widthRatio === 'number' &&
    typeof raw.curvature === 'number' &&
    isSimpleFrenchColor(raw.color)
  ) {
    return 'v7_simple';
  }
  return 'unknown';
}

function unique(items: string[]): string[] {
  return [...new Set(items)];
}

function previewBase(
  source: unknown,
  family: FrenchLegacyFamilyV1,
  status: PreviewFidelityV7,
  identity: Omit<FrenchLegacySourceIdentityV1, 'kind' | 'family' | 'recipeId' | 'recipeRevision'> & {
    sourceId?: string;
    path?: string;
    sourceVersion?: number;
    legacyVariant?: string;
  },
  limitations: string[],
  diagnostics: FrenchLegacyDiagnosticV1[],
): FrenchLegacyConversionPreviewV1 {
  return {
    family,
    status,
    sourceIdentity: {
      kind: 'french_edge',
      family,
      recipeId: FRENCH_RECIPE_ID_V1,
      recipeRevision: FRENCH_RECIPE_REVISION_V1,
      ...identity,
    },
    source,
    parameters: null,
    limitations: unique(limitations),
    diagnostics,
  };
}

function previewV7Simple(
  raw: UnknownRecord,
  source: unknown,
  identity: { sourceId?: string; path?: string; sourceVersion?: number },
): FrenchLegacyConversionPreviewV1 {
  const diagnostics: FrenchLegacyDiagnosticV1[] = [];
  const limitations = [
    'V7 french_edge remains a frozen read-only triple of widthRatio, curvature, and color.',
    'Preset is not inferred from widthRatio or curvature.',
    'Boundary variant is not inferred from the quadratic V7 approximation.',
    'Three-point nail-local offsets, balance, outline, and transitionMode are not represented.',
  ];

  const widthRatio = raw.widthRatio;
  const curvature = raw.curvature;
  const widthOk = typeof widthRatio === 'number' && Number.isFinite(widthRatio) && widthRatio >= 0 && widthRatio <= 1;
  const curvatureOk = typeof curvature === 'number' && Number.isFinite(curvature) && curvature >= -1 && curvature <= 1;
  const colorOk = isSimpleFrenchColor(raw.color);

  if (!widthOk || !curvatureOk || !colorOk) {
    diagnostics.push({
      code: 'invalid_v7_simple',
      path: identity.path ?? '$',
      message: 'V7 simple French fields are missing, non-finite, or outside the frozen range.',
    });
    return previewBase(source, 'v7_simple', 'unavailable', identity, [
      ...limitations,
      'Invalid V7 simple French cannot produce FrenchRecipeSpecV1 parameters.',
    ], diagnostics);
  }

  diagnostics.push({
    code: 'preset_not_inferred',
    path: identity.path ?? '$',
    message: 'V7 simple French has no preset identity; conversion stays approximate.',
  });
  diagnostics.push({
    code: 'curvature_has_no_three_point_mapping',
    path: identity.path ? `${identity.path}.curvature` : 'curvature',
    message: 'curvature is a quadratic bend parameter and has no lossless three-point offset mapping.',
  });
  return previewBase(source, 'v7_simple', 'approximate', identity, limitations, diagnostics);
}

function previewRich(
  raw: UnknownRecord,
  source: unknown,
  identity: { sourceId?: string; path?: string; sourceVersion?: number },
): FrenchLegacyConversionPreviewV1 {
  const diagnostics: FrenchLegacyDiagnosticV1[] = [];
  const legacyVariant = typeof raw.variant === 'string' ? raw.variant : undefined;
  const mixed = hasSimpleFrenchFields(raw);
  const limitations = [
    'Rich V3/V6 French stores tipOffset, smileDepth, classicControls, and lineGap in 0.1mm silhouette units.',
    'Those distances cannot be converted to nail-local recipe offsets without the original silhouette metrics.',
    'Preset, overall style, makeability, and manufacturing capability are not inferred.',
  ];

  if (mixed) {
    diagnostics.push({
      code: 'mixed_legacy_fields',
      path: identity.path ?? '$',
      message: 'Payload mixes V7 simple fields with rich V3/V6 French fields; rich evidence is preserved and not flattened.',
    });
    limitations.push('Mixed simple and rich fields are not flattened into V7 french_edge.');
  }

  diagnostics.push({
    code: 'geometry_not_nail_local',
    path: identity.path ?? '$',
    message: 'Rich French geometry is not nail-local and is retained as conversion evidence only.',
  });
  diagnostics.push({
    code: 'preset_not_inferred',
    path: identity.path ?? '$',
    message: 'Rich French preset is not guessed from offsets or variant.',
  });

  if (typeof raw.strokeWidth === 'number' || raw.outlineEnabled === true) {
    diagnostics.push({
      code: 'stroke_width_units_unavailable',
      path: identity.path ? `${identity.path}.strokeWidth` : 'strokeWidth',
      message: 'Legacy outline width is in 0.1mm units and has no lossless nail-local outlineWidth mapping.',
    });
    limitations.push('Legacy outline width stays unavailable until a geometry-backed conversion exists.');
  }

  if (hasOwn(raw, 'lineGap') && legacyVariant !== 'double') {
    limitations.push('lineGap on non-double rich French is unused source evidence and is not mapped.');
  }

  if (legacyVariant === 'double') {
    diagnostics.push({
      code: 'unsupported_double_variant',
      path: identity.path ? `${identity.path}.variant` : 'variant',
      message: 'Double-line French is not a FrenchRecipeSpecV1 variant and cannot be converted.',
    });
    return previewBase(
      source,
      'v3_v6_rich',
      'unavailable',
      { ...identity, legacyVariant },
      [
        ...limitations,
        'variant=double / lineGap has no lossless mapping in FrenchRecipeSpecV1 (smooth|pointed only).',
      ],
      diagnostics,
    );
  }

  if (legacyVariant !== undefined && legacyVariant !== 'arc' && legacyVariant !== 'v') {
    diagnostics.push({
      code: 'unsupported_legacy_variant',
      path: identity.path ? `${identity.path}.variant` : 'variant',
      message: `Legacy French variant ${legacyVariant} is not a supported conversion source.`,
    });
    return previewBase(
      source,
      'v3_v6_rich',
      'unavailable',
      { ...identity, legacyVariant },
      [...limitations, `Legacy variant ${legacyVariant} cannot be mapped to smooth or pointed.`],
      diagnostics,
    );
  }

  if (legacyVariant === 'arc') {
    limitations.push('arc is structurally related to variant=smooth, but 0.1mm three-point controls are not recipe parameters.');
  } else if (legacyVariant === 'v') {
    limitations.push('v is structurally related to variant=pointed, but 0.1mm smileDepth/tipOffset are not recipe parameters.');
  }

  return previewBase(
    source,
    'v3_v6_rich',
    'approximate',
    { ...identity, legacyVariant },
    limitations,
    diagnostics,
  );
}

export function previewFrenchLegacyConversionV1(
  value: unknown,
  identity: { sourceId?: string; path?: string; sourceVersion?: number } = {},
): FrenchLegacyConversionPreviewV1 {
  const source = cloneSource(value);
  const raw = record(value);
  const sourceId = identity.sourceId ?? (typeof raw?.id === 'string' ? raw.id : undefined);
  const resolvedIdentity = { ...identity, sourceId };
  const family = classifyFamily(raw);

  if (family === 'v7_simple' && raw) return previewV7Simple(raw, source, resolvedIdentity);
  if (family === 'v3_v6_rich' && raw) return previewRich(raw, source, resolvedIdentity);

  const diagnostics: FrenchLegacyDiagnosticV1[] = [];
  if (!raw || raw.kind !== 'french_edge') {
    diagnostics.push({
      code: 'not_french_edge',
      path: identity.path ?? '$',
      message: 'Source is not a french_edge payload.',
    });
  } else {
    diagnostics.push({
      code: 'incomplete_v7_simple',
      path: identity.path ?? '$',
      message: 'french_edge is missing a complete V7 simple or rich V3/V6 payload.',
    });
  }
  return previewBase(
    source,
    'unknown',
    'unavailable',
    resolvedIdentity,
    [
      'Unsupported or incomplete French payload is preserved as source evidence.',
      'No recipe parameters are authored from unavailable conversion.',
    ],
    diagnostics,
  );
}
