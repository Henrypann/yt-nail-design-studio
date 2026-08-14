import type { NailDesignV7 } from '@/studio/editor/v7/model';

export const RENDER_TEXTURE_ASSET_SCHEMA_V1 = 'render-texture-asset-set-v1';

export interface RenderTextureMapRefV1 {
  assetId: string;
  revision: string;
  runtimeUrl: string;
  mimeType: 'image/png';
  widthPx: number;
  heightPx: number;
  sha256: string;
  colorSpace: 'srgb' | 'linear';
  alphaMode: 'straight' | 'opaque';
  channel: string;
  heightScaleMm?: number;
  convention?: string;
}

export interface RenderTextureAssetSetV1 {
  schemaVersion: typeof RENDER_TEXTURE_ASSET_SCHEMA_V1;
  assetSetId: string;
  revision: string;
  status: 'SIMULATED_RENDER_ASSET_NOT_MATERIAL_VALIDATED';
  materialRef: { materialId: string; revision: string };
  uvContract: 'nail-local-v1-tip-to-root';
  maps: {
    decal: RenderTextureMapRefV1;
    normal: RenderTextureMapRefV1;
    roughness: RenderTextureMapRefV1;
    height: RenderTextureMapRefV1;
  };
  limitations: string[];
}

const MAP_ROOT = '/render-v0-7-2/aurora-almond-v2';
export const AURORA_ALMOND_TEXTURE_ASSET_SET_V1: RenderTextureAssetSetV1 = {
  schemaVersion: RENDER_TEXTURE_ASSET_SCHEMA_V1,
  assetSetId: 'render.texture-set.aurora-almond-v2',
  revision: '1.0.0-simulated',
  status: 'SIMULATED_RENDER_ASSET_NOT_MATERIAL_VALIDATED',
  materialRef: { materialId: 'material.magnetic-gel', revision: '1' },
  uvContract: 'nail-local-v1-tip-to-root',
  maps: {
    decal: { assetId: 'render.texture.aurora-almond-v2.decal', revision: '1', runtimeUrl: `${MAP_ROOT}/aurora-petal-decal.png`, mimeType: 'image/png', widthPx: 256, heightPx: 410, sha256: '4f39198404c6cc86e4aa9c1339941b4a4afdf7c2f41c42a0cd9398798fe1529f', colorSpace: 'srgb', alphaMode: 'straight', channel: 'rgba' },
    normal: { assetId: 'render.texture.aurora-almond-v2.normal', revision: '1', runtimeUrl: `${MAP_ROOT}/aurora-petal-normal.png`, mimeType: 'image/png', widthPx: 256, heightPx: 410, sha256: 'b595d9294378e170a33e1b1ed43b23aba8ad3400afbd4e67110708628726c815', colorSpace: 'linear', alphaMode: 'opaque', channel: 'tangent-space-rgb', convention: 'OpenGL +Y' },
    roughness: { assetId: 'render.texture.aurora-almond-v2.roughness', revision: '1', runtimeUrl: `${MAP_ROOT}/aurora-petal-roughness.png`, mimeType: 'image/png', widthPx: 256, heightPx: 410, sha256: 'fd6403439872dd846e7df812437ed854b2aac02b72712aac3964fac485370808', colorSpace: 'linear', alphaMode: 'opaque', channel: 'r' },
    height: { assetId: 'render.texture.aurora-almond-v2.height', revision: '1', runtimeUrl: `${MAP_ROOT}/aurora-petal-height.png`, mimeType: 'image/png', widthPx: 256, heightPx: 410, sha256: '650c055aac48688a68896a3357c97ad91eed79d9b7f7a26a7abc3785aea4744a', colorSpace: 'linear', alphaMode: 'opaque', channel: 'r', heightScaleMm: 0.18 },
  },
  limitations: [
    'Procedural screen-space render assets only.',
    'No measured gel, optical, curing, adhesion, fit, strength, print, or manufacturing evidence.',
    'Height is consumed as visual bump, not mesh displacement or manufacturing height.',
  ],
};

const ALL_TEXTURE_SETS: RenderTextureAssetSetV1[] = [
  AURORA_ALMOND_TEXTURE_ASSET_SET_V1,
];

export function resolveRenderTextureAssetSetV1(nail: NailDesignV7): RenderTextureAssetSetV1 | null {
  for (const set of ALL_TEXTURE_SETS) {
    const required = set.materialRef;
    const found = nail.steps.some((step) => step.visible && !step.skipped
      && step.materialRefs.some((ref) => ref.materialId === required.materialId && ref.revision === required.revision));
    if (found) return set;
  }
  return null;
}
