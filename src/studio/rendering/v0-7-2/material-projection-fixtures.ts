import type {
  BackgroundPayloadV7,
  FlatDesignElementV7,
  PreviewFidelityV7,
  RegionMaskV7,
  SurfaceEffectPayloadV7,
  SurfaceFinishTypeV7,
} from '@/studio/editor/v7/model';

export interface MaterialProjectionAssetSetV1 {
  schemaVersion: 'material-projection-asset-set-v1';
  assetSetId: string;
  revision: string;
  label: string;
  evidence: 'simulated';
  background: BackgroundPayloadV7;
  flatElements: FlatDesignElementV7[];
  surfaceEffect: SurfaceEffectPayloadV7;
  surfaceMask: RegionMaskV7;
  finishType: SurfaceFinishTypeV7;
  expectedFidelity: PreviewFidelityV7;
  limitations: string[];
}

const color = (r: number, g: number, b: number, a = 1) => ({ colorSpace: 'srgb' as const, r, g, b, a });
const identity = () => ({ position: { u: 0.5, v: 0.5 }, scaleX: 1, scaleY: 1, rotationDeg: 0 });

/**
 * Structured demo inputs for RENDER-v0.7.2-01B.1. These are canonical layer
 * payloads, not baked screenshots, material measurements, or manufacturing
 * recipes. They make color/UV/mask regressions visually obvious.
 */
export const AURORA_ALMOND_MATERIAL_ASSET_SET_V1: MaterialProjectionAssetSetV1 = {
  schemaVersion: 'material-projection-asset-set-v1',
  assetSetId: 'render.v0.7.2.aurora-almond-materials',
  revision: '1',
  label: 'Aurora Almond · Material Projection Demo',
  evidence: 'simulated',
  background: {
    mode: 'gradient',
    opacity: 1,
    directionDeg: 18,
    stops: [
      { offset: 0, color: color(250, 83, 137) },
      { offset: 0.48, color: color(224, 78, 171) },
      { offset: 1, color: color(82, 33, 119) },
    ],
  },
  flatElements: [
    {
      id: 'element.aurora.brush',
      kind: 'brush_stroke',
      visible: true,
      locked: false,
      opacity: 0.95,
      transform: identity(),
      points: [{ u: 0.18, v: 0.74 }, { u: 0.34, v: 0.54 }, { u: 0.52, v: 0.68 }, { u: 0.76, v: 0.36 }],
      color: color(255, 246, 251),
      widthMm: 0.42,
    },
    {
      id: 'element.aurora.vector',
      kind: 'vector_shape',
      visible: true,
      locked: false,
      opacity: 0.88,
      transform: identity(),
      pathData: 'M0.34 0.2 L0.5 0.35 L0.66 0.2 L0.62 0.43 L0.78 0.58 L0.55 0.54 L0.5 0.78 L0.44 0.54 L0.22 0.58 L0.38 0.43 Z',
      fill: color(255, 205, 231, 0.78),
      stroke: color(255, 255, 255),
      strokeWidthMm: 0.12,
    },
    {
      id: 'element.aurora.french',
      kind: 'french_edge',
      visible: true,
      locked: false,
      opacity: 0.72,
      transform: identity(),
      widthRatio: 0.16,
      curvature: 0.42,
      color: color(255, 240, 248),
    },
  ],
  surfaceEffect: {
    effectType: 'ink_bloom',
    colors: [color(255, 185, 219, 0.8), color(141, 93, 216, 0.72)],
    spread: 0.56,
    seed: 'material-projection-aurora-v1',
    previewFidelity: 'approximate',
  },
  surfaceMask: {
    coordinateSpace: 'nail-local-v1',
    pathData: 'M0.18 0.28 L0.82 0.28 L0.76 0.82 L0.24 0.82 Z',
    fillRule: 'nonzero',
    inverted: false,
  },
  finishType: 'gloss',
  expectedFidelity: 'approximate',
  limitations: [
    'Colors and masks are simulated screen-space preview inputs.',
    'No measured gel, optical, curing, fit, strength, print, or manufacturing evidence.',
  ],
};
