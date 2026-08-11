import type { MaterialRefV7, SurfaceFinishPayloadV7, SurfaceFinishTypeV7 } from './model';

export const SURFACE_FINISH_OPTIONS_V7 = ['gloss', 'matte', 'frosted'] as const satisfies readonly SurfaceFinishTypeV7[];

export const SURFACE_FINISH_LABELS_V7: Record<SurfaceFinishTypeV7, string> = {
  gloss: '亮面',
  matte: '哑光',
  frosted: '磨砂',
};

export const SURFACE_FINISH_DESCRIPTIONS_V7: Record<SurfaceFinishTypeV7, string> = {
  gloss: '高光反射模拟',
  matte: '低光泽漫反射模拟',
  frosted: '颗粒化柔光模拟',
};

export interface SurfaceFinishDefinitionV7 {
  finish: SurfaceFinishPayloadV7;
  materialRef: MaterialRefV7;
}

export function isSurfaceFinishTypeV7(value: unknown): value is SurfaceFinishTypeV7 {
  return typeof value === 'string' && SURFACE_FINISH_OPTIONS_V7.includes(value as SurfaceFinishTypeV7);
}

export function createSurfaceFinishDefinitionV7(type: SurfaceFinishTypeV7): SurfaceFinishDefinitionV7 {
  return {
    finish: { type, materialPresetRef: { id: `preset.finish.${type}`, revision: '1' } },
    materialRef: { materialId: `material.finish.${type}`, revision: '1' },
  };
}

export function surfaceFinishPreviewAppearanceV7(type: SurfaceFinishTypeV7) {
  if (type === 'gloss') return { sheenOpacity: 0.62, veilOpacity: 0.02, grainOpacity: 0 };
  if (type === 'matte') return { sheenOpacity: 0.04, veilOpacity: 0.18, grainOpacity: 0.02 };
  return { sheenOpacity: 0.12, veilOpacity: 0.3, grainOpacity: 0.16 };
}
