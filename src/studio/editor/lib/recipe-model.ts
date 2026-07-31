import type { FingerCode, NailLength, NailShape } from '@/lib/types';
import type { BaseCoverage, DesignLengthPreset, OpticalEffect, TopFinish } from './taxonomy-model';

export type RecipePresetId = 'subtle' | 'signature' | 'statement';
export type RecipeComponentId = 'magnetic_beam' | 'chrome_ribbon' | 'clear_droplet';
export type RecipeComponentRole = 'appearance' | 'relief' | 'accent';
export type RecipeRoute = 'L1' | 'L2' | 'L3';
export type RecipeLifecycle = 'draft' | 'concept' | 'simulated' | 'approved' | 'deprecated';
export type UVPoint = { u: number; v: number };

export interface MercuryDewParams {
  baseColor: string;
  baseCoverage: BaseCoverage;
  opticalEffect: Extract<OpticalEffect, 'cat-eye'>;
  topFinish: Extract<TopFinish, 'gloss'>;
  catEyeAngleDeg: number;
  beamWidth: 'narrow' | 'standard' | 'wide';
  beamIntensity: 'soft' | 'standard' | 'strong';
  ribbonMaterial: 'silver' | 'champagne';
  ribbonWidthMm: 0.35 | 0.5 | 0.7;
  ribbonHeightMm: 0.12 | 0.18 | 0.24;
  ribbonAnchors: [UVPoint, UVPoint, UVPoint];
  dropletDensity: 'off' | 'subtle' | 'standard';
  dropletSizeMm: 0.8 | 1.2 | 1.8;
  droplets: Array<{ id: string; uv: UVPoint; radiusMm: number; heightMm: number }>;
}

export interface RecipeRef { id: string; version: string; }
export interface MercuryFingerOverride { enabled?: boolean; params?: Partial<MercuryDewParams>; }
export interface RecipeInstanceV1 {
  recipeRef: RecipeRef;
  presetId: RecipePresetId;
  params: MercuryDewParams;
  fingerOverrides: Partial<Record<FingerCode, MercuryFingerOverride>>;
  enabled?: boolean;
}

export interface RecipeDefinitionV1 {
  identity: { id: string; name: string; name_en: string };
  version: string;
  lifecycle: RecipeLifecycle;
  compatibility: { shapes: NailShape[]; lengthPresets: DesignLengthPreset[]; geometryLengths: NailLength[] };
  coordinateSpace: Record<string, string>;
  components: Array<{ id: RecipeComponentId; role: RecipeComponentRole; route: RecipeRoute }>;
  presets: Array<{ id: RecipePresetId; label: string; ribbon: boolean; droplets: number }>;
  composition: string[];
  constraints: { safe_clearance_mm: number; max_droplets: number; height_mm: { min: number; max: number }; manufacturing_command_allowed: false };
  outputPolicy: { renderer: string; label: string; manufacturing_command_allowed: false };
}

export interface ReliefElement {
  id: string;
  kind: 'chrome_ribbon' | 'clear_droplet' | 'custom_relief';
  name: string;
  visible: boolean;
  locked: boolean;
  order: number;
  uv: UVPoint;
  heightMm: number;
  radiusMm?: number;
  transform: { x: number; y: number; scale: number; rotation: number };
  source?: 'manual' | 'recipe';
  recipeId?: string;
}

export const MERCURY_DEFAULT_PARAMS: MercuryDewParams = {
  baseColor: '#D9B5AB',
  baseCoverage: 'opaque',
  opticalEffect: 'cat-eye',
  topFinish: 'gloss',
  catEyeAngleDeg: 8,
  beamWidth: 'standard',
  beamIntensity: 'standard',
  ribbonMaterial: 'champagne',
  ribbonWidthMm: 0.5,
  ribbonHeightMm: 0.18,
  ribbonAnchors: [{ u: 0.78, v: 0.78 }, { u: 0.68, v: 0.5 }, { u: 0.54, v: 0.2 }],
  dropletDensity: 'standard',
  dropletSizeMm: 1.2,
  droplets: [],
};

export function createMercuryInstance(presetId: RecipePresetId = 'signature', baseColor = MERCURY_DEFAULT_PARAMS.baseColor): RecipeInstanceV1 {
  const count = presetId === 'subtle' ? 2 : presetId === 'statement' ? 6 : 4;
  const droplets = Array.from({ length: count }, (_, i) => ({
    id: `mercury-drop-${i + 1}`,
    uv: { u: 0.31 + (i % 2) * 0.38, v: 0.34 + Math.floor(i / 2) * 0.1 },
    radiusMm: MERCURY_DEFAULT_PARAMS.dropletSizeMm,
    heightMm: 0.18,
  }));
  return { recipeRef: { id: 'mercury-dew', version: '1.0.0' }, presetId, params: { ...MERCURY_DEFAULT_PARAMS, baseColor, droplets }, fingerOverrides: {} };
}

export function mergeMercuryParams(instance: RecipeInstanceV1, finger?: FingerCode): MercuryDewParams {
  const override = finger ? instance.fingerOverrides[finger]?.params : undefined;
  return { ...instance.params, ...(override ?? {}) };
}

export function isMercuryEnabled(instance: RecipeInstanceV1, finger?: FingerCode): boolean {
  if (instance.enabled === false) return false;
  return finger ? instance.fingerOverrides[finger]?.enabled !== false : true;
}
