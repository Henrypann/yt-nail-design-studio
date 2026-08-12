import manifestValue from '../../../../assets/glb/manifest.v1.json' with { type: 'json' };
import { selectLod, validateAssetManifest, type Web3dAssetEntry } from '@/studio/preview/asset-manifest';
import type { AssetRefV7, DimensionalDecorationV7, PreviewFidelityV7, RegionMaskV7 } from './model';
import { parseNailPathDataV7 } from './flat-vector';

export type DimensionalDecorationArchetypeV7 = 'relief' | 'droplet' | 'gel_stack' | 'carving' | 'accessory' | 'crystal_flower' | 'lavender_pearl' | 'silver_studs' | 'ruby_microbeads';

export const DIMENSIONAL_DECORATION_LABELS_V7: Record<DimensionalDecorationArchetypeV7, string> = {
  relief: '浮雕花',
  droplet: '透明液滴',
  gel_stack: '堆胶曲线',
  carving: '雕花',
  accessory: '金属饰品',
  crystal_flower: '透明水晶花',
  lavender_pearl: '淡紫珍珠',
  silver_studs: '银色圆珠簇',
  ruby_microbeads: '酒红微珠',
};

export const DIMENSIONAL_FIDELITY_LABELS_V7: Record<PreviewFidelityV7, string> = {
  exact: '确定性 2.5D',
  approximate: '近似 2.5D',
  unavailable: 'Mesh 不可用 · 保留 2D',
};

const parsedManifest = validateAssetManifest(manifestValue);
const manifestAssets = parsedManifest.ok ? parsedManifest.manifest.assets : [];

function mask(pathData: string): RegionMaskV7 {
  return { coordinateSpace: 'nail-local-v1', pathData, fillRule: 'nonzero', inverted: false };
}

const RELIEF_OUTLINES: Record<'relief' | 'droplet' | 'gel_stack' | 'carving', RegionMaskV7> = {
  relief: mask('M0.5 0.27 C0.56 0.36 0.69 0.37 0.72 0.5 C0.62 0.51 0.58 0.63 0.5 0.72 C0.42 0.63 0.38 0.51 0.28 0.5 C0.31 0.37 0.44 0.36 0.5 0.27 Z'),
  droplet: mask('M0.5 0.3 C0.61 0.42 0.67 0.5 0.67 0.59 C0.67 0.7 0.6 0.77 0.5 0.77 C0.4 0.77 0.33 0.7 0.33 0.59 C0.33 0.5 0.39 0.42 0.5 0.3 Z'),
  gel_stack: mask('M0.24 0.63 C0.34 0.37 0.52 0.31 0.76 0.42 C0.63 0.49 0.53 0.59 0.45 0.73 C0.37 0.74 0.29 0.7 0.24 0.63 Z'),
  carving: mask('M0.5 0.26 L0.56 0.43 L0.74 0.43 L0.59 0.54 L0.65 0.72 L0.5 0.61 L0.35 0.72 L0.41 0.54 L0.26 0.43 L0.44 0.43 Z'),
};

const ATTACHMENT_PREVIEW_OUTLINES: Record<'accessory' | 'crystal_flower' | 'lavender_pearl' | 'silver_studs' | 'ruby_microbeads', string> = {
  accessory: 'M0.28 0.47 C0.4 0.36 0.6 0.36 0.72 0.47 C0.62 0.5 0.58 0.58 0.5 0.66 C0.42 0.58 0.38 0.5 0.28 0.47 Z',
  crystal_flower: 'M0.5 0.5 C0.42 0.4 0.4 0.27 0.5 0.24 C0.59 0.28 0.59 0.4 0.5 0.5 C0.62 0.41 0.75 0.42 0.77 0.53 C0.69 0.61 0.59 0.56 0.5 0.5 C0.56 0.63 0.49 0.74 0.39 0.73 C0.32 0.64 0.39 0.55 0.5 0.5 C0.38 0.59 0.26 0.54 0.26 0.43 C0.34 0.36 0.43 0.42 0.5 0.5 Z',
  lavender_pearl: 'M0.5 0.35 C0.62 0.35 0.7 0.41 0.7 0.5 C0.7 0.59 0.62 0.65 0.5 0.65 C0.38 0.65 0.3 0.59 0.3 0.5 C0.3 0.41 0.38 0.35 0.5 0.35 Z',
  silver_studs: 'M0.5 0.39 C0.56 0.39 0.59 0.43 0.59 0.48 C0.59 0.53 0.56 0.57 0.5 0.57 C0.44 0.57 0.41 0.53 0.41 0.48 C0.41 0.43 0.44 0.39 0.5 0.39 Z M0.36 0.48 C0.41 0.48 0.44 0.51 0.44 0.56 C0.44 0.61 0.41 0.64 0.36 0.64 C0.31 0.64 0.28 0.61 0.28 0.56 C0.28 0.51 0.31 0.48 0.36 0.48 Z M0.64 0.48 C0.69 0.48 0.72 0.51 0.72 0.56 C0.72 0.61 0.69 0.64 0.64 0.64 C0.59 0.64 0.56 0.61 0.56 0.56 C0.56 0.51 0.59 0.48 0.64 0.48 Z',
  ruby_microbeads: 'M0.39 0.45 C0.43 0.45 0.46 0.48 0.46 0.52 C0.46 0.56 0.43 0.59 0.39 0.59 C0.35 0.59 0.32 0.56 0.32 0.52 C0.32 0.48 0.35 0.45 0.39 0.45 Z M0.56 0.51 C0.6 0.51 0.63 0.54 0.63 0.58 C0.63 0.62 0.6 0.65 0.56 0.65 C0.52 0.65 0.49 0.62 0.49 0.58 C0.49 0.54 0.52 0.51 0.56 0.51 Z M0.62 0.39 C0.655 0.39 0.68 0.415 0.68 0.45 C0.68 0.485 0.655 0.51 0.62 0.51 C0.585 0.51 0.56 0.485 0.56 0.45 C0.56 0.415 0.585 0.39 0.62 0.39 Z',
};

const RELIEF_MATERIALS: Record<'relief' | 'droplet' | 'gel_stack' | 'carving', string> = {
  relief: 'material.v7.relief-petal',
  droplet: 'material.mercury.clear-droplet',
  gel_stack: 'material.v7.clear-gel-stack',
  carving: 'material.v7.carved-gel',
};

type ReliefArchetypeV7 = keyof typeof RELIEF_OUTLINES;
type AttachmentArchetypeV7 = Exclude<DimensionalDecorationArchetypeV7, ReliefArchetypeV7>;

function isReliefArchetypeV7(archetype: DimensionalDecorationArchetypeV7): archetype is ReliefArchetypeV7 {
  return archetype in RELIEF_OUTLINES;
}

export function dimensionalMeshAssetV7(assetId: string): Web3dAssetEntry | null {
  return manifestAssets.find((asset) => asset.id === assetId) ?? null;
}

export function dimensionalMeshAssetRefV7(assetId: string): AssetRefV7 | null {
  const entry = dimensionalMeshAssetV7(assetId);
  const lod = entry ? selectLod(entry, Number.MAX_SAFE_INTEGER) : null;
  if (!entry || !lod || entry.evidence !== 'SIMULATED') return null;
  return {
    assetId: entry.id,
    revision: entry.revision,
    kind: 'mesh',
    mimeType: 'model/gltf-binary',
    sha256: lod.sha256,
  };
}

export function resolveDimensionalMeshFidelityV7(asset: AssetRefV7): PreviewFidelityV7 {
  const entry = dimensionalMeshAssetV7(asset.assetId);
  const lod = entry ? selectLod(entry, Number.MAX_SAFE_INTEGER) : null;
  if (!entry || !lod || entry.evidence !== 'SIMULATED') return 'unavailable';
  return entry.revision === asset.revision && lod.sha256 === asset.sha256 && asset.kind === 'mesh' && asset.mimeType === 'model/gltf-binary'
    ? 'approximate'
    : 'unavailable';
}

export function createDimensionalDecorationV7(
  archetype: DimensionalDecorationArchetypeV7,
  id: string,
): DimensionalDecorationV7 | null {
  const transform = { position: { u: 0.5, v: 0.5 }, scaleX: 1, scaleY: 1, rotationDeg: 0 };
  const attachmentPresets: Record<AttachmentArchetypeV7, { assetId: string; heightMm: number; materialId: string }> = {
    accessory: { assetId: 'mercury-dew-ribbon', heightMm: 0.18, materialId: 'material.mercury.ribbon.silver' },
    crystal_flower: { assetId: 'petal-pearl-crystal-flower', heightMm: 1.04, materialId: 'material.petal-pearl.clear-crystal' },
    lavender_pearl: { assetId: 'petal-pearl-lavender-pearl', heightMm: 0.3, materialId: 'material.petal-pearl.lavender-pearl' },
    silver_studs: { assetId: 'petal-pearl-silver-stud-cluster', heightMm: 0.26, materialId: 'material.petal-pearl.polished-silver' },
    ruby_microbeads: { assetId: 'petal-pearl-ruby-microbeads', heightMm: 0.18, materialId: 'material.petal-pearl.ruby-glass' },
  };
  if (!isReliefArchetypeV7(archetype)) {
    const attachmentPreset = attachmentPresets[archetype];
    const asset = dimensionalMeshAssetRefV7(attachmentPreset.assetId);
    if (!asset) return null;
    return {
      id,
      kind: 'attachment_3d',
      visible: true,
      locked: false,
      transform,
      heightMm: attachmentPreset.heightMm,
      materialRef: { materialId: attachmentPreset.materialId, revision: '1' },
      previewFidelity: 'approximate',
      asset,
      anchor: { u: 0.5, v: 0.5 },
    };
  }
  return {
    id,
    kind: 'relief_2_5d',
    visible: true,
    locked: false,
    transform,
    heightMm: archetype === 'droplet' ? 0.22 : archetype === 'gel_stack' ? 0.26 : 0.18,
    materialRef: { materialId: RELIEF_MATERIALS[archetype], revision: '1' },
    previewFidelity: 'approximate',
    outline: structuredClone(RELIEF_OUTLINES[archetype]),
  };
}

export function dimensionalDecorationArchetypeV7(decoration: DimensionalDecorationV7): DimensionalDecorationArchetypeV7 {
  if (decoration.kind === 'attachment_3d') {
    if (decoration.asset.assetId === 'petal-pearl-crystal-flower') return 'crystal_flower';
    if (decoration.asset.assetId === 'petal-pearl-lavender-pearl') return 'lavender_pearl';
    if (decoration.asset.assetId === 'petal-pearl-silver-stud-cluster') return 'silver_studs';
    if (decoration.asset.assetId === 'petal-pearl-ruby-microbeads') return 'ruby_microbeads';
    return 'accessory';
  }
  const materialId = decoration.materialRef?.materialId ?? '';
  if (materialId.includes('droplet')) return 'droplet';
  if (materialId.includes('ribbon')) return 'accessory';
  if (materialId.includes('stack')) return 'gel_stack';
  if (materialId.includes('carved')) return 'carving';
  return 'relief';
}

export function dimensionalDecorationFidelityV7(decoration: DimensionalDecorationV7): PreviewFidelityV7 {
  if (decoration.previewFidelity === 'unavailable') return 'unavailable';
  if (decoration.kind === 'attachment_3d') return resolveDimensionalMeshFidelityV7(decoration.asset);
  return decoration.previewFidelity;
}

export function dimensionalDecorationPathToCanvasV7(pathData: string, width = 100, height = 160): string | null {
  const parsed = parseNailPathDataV7(pathData);
  if (!parsed) return null;
  return parsed.commands.map(({ command, values }) => `${command}${values.map((value, index) => value * (index % 2 === 0 ? width : height)).join(' ')}`).join(' ');
}

/** Deterministic SVG 2.5D silhouette; it is an editor fallback, not the GLB or a manufacturing mesh. */
export function dimensionalDecorationPreviewPathV7(decoration: DimensionalDecorationV7, width = 100, height = 160): string | null {
  const pathData = decoration.kind === 'relief_2_5d'
    ? decoration.outline.pathData
    : ATTACHMENT_PREVIEW_OUTLINES[dimensionalDecorationArchetypeV7(decoration) as keyof typeof ATTACHMENT_PREVIEW_OUTLINES];
  return pathData ? dimensionalDecorationPathToCanvasV7(pathData, width, height) : null;
}

export function dimensionalDecorationShadowOffsetV7(heightMm: number): number {
  return Math.min(8, Math.max(1, heightMm * 18));
}
