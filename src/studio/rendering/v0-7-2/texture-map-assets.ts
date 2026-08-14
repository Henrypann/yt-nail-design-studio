import type { NailDesignV7 } from '@/studio/editor/v7/model';
import type { FourLookSetIdV0_7_2 } from '@/studio/editor/v7/four-look-sets';

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

export const FOUR_LOOK_TEXTURE_ASSET_SETS_V1: Record<FourLookSetIdV0_7_2, RenderTextureAssetSetV1> = {
  'leopard-gilded-nude': {
    schemaVersion: RENDER_TEXTURE_ASSET_SCHEMA_V1,
    assetSetId: 'render.texture-set.leopard-gilded-nude.v1',
    revision: '1.0.0-simulated',
    status: 'SIMULATED_RENDER_ASSET_NOT_MATERIAL_VALIDATED',
    materialRef: { materialId: 'material.leopard-gilded-nude.background', revision: '1' },
    uvContract: 'nail-local-v1-tip-to-root',
    maps: {
      decal: { assetId: 'look.leopard-gilded-nude.map.decal', revision: '1', runtimeUrl: '/assets/hero-recipes/leopard-gilded-nude/maps/leopard-gilded-nude-decal.png', mimeType: 'image/png', widthPx: 384, heightPx: 640, sha256: '2c159c78de038c7d8f9c85af572dc67d5f8428fcaa4d3a0d1c726fafb0ad49dc', colorSpace: 'srgb', alphaMode: 'straight', channel: 'rgba' },
      normal: { assetId: 'look.leopard-gilded-nude.map.normal', revision: '1', runtimeUrl: '/assets/hero-recipes/leopard-gilded-nude/maps/leopard-gilded-nude-normal.png', mimeType: 'image/png', widthPx: 384, heightPx: 640, sha256: '9cf149709dfb65ec6bdc6025757548f25556ccb630820702ed3ddffa0bab384b', colorSpace: 'linear', alphaMode: 'opaque', channel: 'tangent-space-rgb', convention: 'OpenGL +Y' },
      roughness: { assetId: 'look.leopard-gilded-nude.map.roughness', revision: '1', runtimeUrl: '/assets/hero-recipes/leopard-gilded-nude/maps/leopard-gilded-nude-roughness.png', mimeType: 'image/png', widthPx: 384, heightPx: 640, sha256: 'c570a3dc44683ad8bd2d91de8413505d4ee57923e2a797e8eb25851437ec4b99', colorSpace: 'linear', alphaMode: 'opaque', channel: 'r' },
      height: { assetId: 'look.leopard-gilded-nude.map.height', revision: '1', runtimeUrl: '/assets/hero-recipes/leopard-gilded-nude/maps/leopard-gilded-nude-height.png', mimeType: 'image/png', widthPx: 384, heightPx: 640, sha256: 'c7c23fa5758563cc103342a2d1e9627f22ace61d19d029934e22da4ca5c6062e', colorSpace: 'linear', alphaMode: 'opaque', channel: 'r', heightScaleMm: 0.18 },
    },
    limitations: [
      'Procedural screen-space render assets for leopard-gilded-nude.',
      'No measured gel, optical, curing, adhesion, fit, strength, print, or manufacturing evidence.',
      'Height is consumed as visual bump, not mesh displacement or manufacturing height.',
    ],
  },
  'crimson-reliquary': {
    schemaVersion: RENDER_TEXTURE_ASSET_SCHEMA_V1,
    assetSetId: 'render.texture-set.crimson-reliquary.v1',
    revision: '1.0.0-simulated',
    status: 'SIMULATED_RENDER_ASSET_NOT_MATERIAL_VALIDATED',
    materialRef: { materialId: 'material.crimson-reliquary.background', revision: '1' },
    uvContract: 'nail-local-v1-tip-to-root',
    maps: {
      decal: { assetId: 'look.crimson-reliquary.map.decal', revision: '1', runtimeUrl: '/assets/hero-recipes/crimson-reliquary/maps/crimson-reliquary-decal.png', mimeType: 'image/png', widthPx: 384, heightPx: 640, sha256: '4983c8ae61bfc76ce9b66160afa07ec6cdf3dc7afb9e4f46f1e2808b36604ad7', colorSpace: 'srgb', alphaMode: 'straight', channel: 'rgba' },
      normal: { assetId: 'look.crimson-reliquary.map.normal', revision: '1', runtimeUrl: '/assets/hero-recipes/crimson-reliquary/maps/crimson-reliquary-normal.png', mimeType: 'image/png', widthPx: 384, heightPx: 640, sha256: 'bf3a206125d75faf1ba7cf332afb4997942c5250cdb2a5c31ac1544f60714be1', colorSpace: 'linear', alphaMode: 'opaque', channel: 'tangent-space-rgb', convention: 'OpenGL +Y' },
      roughness: { assetId: 'look.crimson-reliquary.map.roughness', revision: '1', runtimeUrl: '/assets/hero-recipes/crimson-reliquary/maps/crimson-reliquary-roughness.png', mimeType: 'image/png', widthPx: 384, heightPx: 640, sha256: '1f77c414a11408125051f3d19a46eff82a229d948feafa520c3acb32750f0eb6', colorSpace: 'linear', alphaMode: 'opaque', channel: 'r' },
      height: { assetId: 'look.crimson-reliquary.map.height', revision: '1', runtimeUrl: '/assets/hero-recipes/crimson-reliquary/maps/crimson-reliquary-height.png', mimeType: 'image/png', widthPx: 384, heightPx: 640, sha256: 'fc85039e7080909b58d084059288df3fb0d89778a0833f7a49ace735b3df6b49', colorSpace: 'linear', alphaMode: 'opaque', channel: 'r', heightScaleMm: 0.18 },
    },
    limitations: [
      'Procedural screen-space render assets for crimson-reliquary.',
      'No measured gel, optical, curing, adhesion, fit, strength, print, or manufacturing evidence.',
      'Height is consumed as visual bump, not mesh displacement or manufacturing height.',
    ],
  },
  'ivory-lace-crystal': {
    schemaVersion: RENDER_TEXTURE_ASSET_SCHEMA_V1,
    assetSetId: 'render.texture-set.ivory-lace-crystal.v1',
    revision: '1.0.0-simulated',
    status: 'SIMULATED_RENDER_ASSET_NOT_MATERIAL_VALIDATED',
    materialRef: { materialId: 'material.ivory-lace-crystal.background', revision: '1' },
    uvContract: 'nail-local-v1-tip-to-root',
    maps: {
      decal: { assetId: 'look.ivory-lace-crystal.map.decal', revision: '1', runtimeUrl: '/assets/hero-recipes/ivory-lace-crystal/maps/ivory-lace-crystal-decal.png', mimeType: 'image/png', widthPx: 384, heightPx: 640, sha256: '4f30cf673db62a9b69008bfc8b9a5685fafb25cfc763f03cdd58490f2825b946', colorSpace: 'srgb', alphaMode: 'straight', channel: 'rgba' },
      normal: { assetId: 'look.ivory-lace-crystal.map.normal', revision: '1', runtimeUrl: '/assets/hero-recipes/ivory-lace-crystal/maps/ivory-lace-crystal-normal.png', mimeType: 'image/png', widthPx: 384, heightPx: 640, sha256: '9857a7987bcc6687f93216b51e0fbe0c5dd223d55d407db6ba9d498072e0fb41', colorSpace: 'linear', alphaMode: 'opaque', channel: 'tangent-space-rgb', convention: 'OpenGL +Y' },
      roughness: { assetId: 'look.ivory-lace-crystal.map.roughness', revision: '1', runtimeUrl: '/assets/hero-recipes/ivory-lace-crystal/maps/ivory-lace-crystal-roughness.png', mimeType: 'image/png', widthPx: 384, heightPx: 640, sha256: 'bce4a58cd1d60b5088d1a696e2344c2d980ffdf3d537ed485778ec68770889a4', colorSpace: 'linear', alphaMode: 'opaque', channel: 'r' },
      height: { assetId: 'look.ivory-lace-crystal.map.height', revision: '1', runtimeUrl: '/assets/hero-recipes/ivory-lace-crystal/maps/ivory-lace-crystal-height.png', mimeType: 'image/png', widthPx: 384, heightPx: 640, sha256: 'd62c306f54b1cb3b2800776ee728470663af61b86e86f360ec5993f2cef6c9a5', colorSpace: 'linear', alphaMode: 'opaque', channel: 'r', heightScaleMm: 0.18 },
    },
    limitations: [
      'Procedural screen-space render assets for ivory-lace-crystal.',
      'No measured gel, optical, curing, adhesion, fit, strength, print, or manufacturing evidence.',
      'Height is consumed as visual bump, not mesh displacement or manufacturing height.',
    ],
  },
  'honey-petal-glass': {
    schemaVersion: RENDER_TEXTURE_ASSET_SCHEMA_V1,
    assetSetId: 'render.texture-set.honey-petal-glass.v1',
    revision: '1.0.0-simulated',
    status: 'SIMULATED_RENDER_ASSET_NOT_MATERIAL_VALIDATED',
    materialRef: { materialId: 'material.honey-petal-glass.background', revision: '1' },
    uvContract: 'nail-local-v1-tip-to-root',
    maps: {
      decal: { assetId: 'look.honey-petal-glass.map.decal', revision: '1', runtimeUrl: '/assets/hero-recipes/honey-petal-glass/maps/honey-petal-glass-decal.png', mimeType: 'image/png', widthPx: 384, heightPx: 640, sha256: '064fba280bb9042314cab33d831694cd1c69a73047d025b1bcd547f96657b450', colorSpace: 'srgb', alphaMode: 'straight', channel: 'rgba' },
      normal: { assetId: 'look.honey-petal-glass.map.normal', revision: '1', runtimeUrl: '/assets/hero-recipes/honey-petal-glass/maps/honey-petal-glass-normal.png', mimeType: 'image/png', widthPx: 384, heightPx: 640, sha256: 'ad500fc45f04c62929e9119d5233bc3f74b5f6695bac0ac0651ab62fcc2a0c7a', colorSpace: 'linear', alphaMode: 'opaque', channel: 'tangent-space-rgb', convention: 'OpenGL +Y' },
      roughness: { assetId: 'look.honey-petal-glass.map.roughness', revision: '1', runtimeUrl: '/assets/hero-recipes/honey-petal-glass/maps/honey-petal-glass-roughness.png', mimeType: 'image/png', widthPx: 384, heightPx: 640, sha256: 'b2667a3184ebe2525efca754183ab8ea5f49e1b380972fe383c061ba1cc30396', colorSpace: 'linear', alphaMode: 'opaque', channel: 'r' },
      height: { assetId: 'look.honey-petal-glass.map.height', revision: '1', runtimeUrl: '/assets/hero-recipes/honey-petal-glass/maps/honey-petal-glass-height.png', mimeType: 'image/png', widthPx: 384, heightPx: 640, sha256: '15222615f6be76b56165a41c0ccac697aac2f9c55a18298d668ffa72fe31c6a3', colorSpace: 'linear', alphaMode: 'opaque', channel: 'r', heightScaleMm: 0.18 },
    },
    limitations: [
      'Procedural screen-space render assets for honey-petal-glass.',
      'No measured gel, optical, curing, adhesion, fit, strength, print, or manufacturing evidence.',
      'Height is consumed as visual bump, not mesh displacement or manufacturing height.',
    ],
  },
};

const ALL_TEXTURE_SETS: RenderTextureAssetSetV1[] = [
  AURORA_ALMOND_TEXTURE_ASSET_SET_V1,
  FOUR_LOOK_TEXTURE_ASSET_SETS_V1['leopard-gilded-nude'],
  FOUR_LOOK_TEXTURE_ASSET_SETS_V1['crimson-reliquary'],
  FOUR_LOOK_TEXTURE_ASSET_SETS_V1['ivory-lace-crystal'],
  FOUR_LOOK_TEXTURE_ASSET_SETS_V1['honey-petal-glass'],
];

export function resolveRenderTextureAssetSetV1(nail: NailDesignV7): RenderTextureAssetSetV1 | null {
  for (const set of ALL_TEXTURE_SETS) {
    const required = set.materialRef;
    const found = nail.steps.some((step) => step.visible && !step.skipped && (
      step.materialRefs.some((ref) => ref.materialId === required.materialId && ref.revision === required.revision)
      || (step.recipeInstanceId && step.recipeInstanceId.includes(set.assetSetId.replace('render.texture-set.', '').replace('.v1', '')))
    ));
    if (found) return set;
  }
  return null;
}
