import type { FingerCode } from '../../../lib/types.ts';

export type EditorDocV7OutputIntent = 'design' | 'customer' | 'manufacturing';
export type ProcessStepKindV7 =
  | 'background'
  | 'flat_design'
  | 'surface_effect'
  | 'dimensional_decoration'
  | 'surface_finish';
export type PreviewFidelityV7 = 'exact' | 'approximate' | 'unavailable';
export type SurfaceFinishTypeV7 = 'gloss' | 'matte' | 'frosted';
export type SyncStateV7 = 'linked' | 'detached';

export interface RgbaColorV7 {
  colorSpace: 'srgb';
  r: number;
  g: number;
  b: number;
  a: number;
}

/** Nail-local coordinates: u 0→1 left-to-right; v 0→1 tip-to-root. */
export interface NailPointV7 {
  u: number;
  v: number;
}

export interface Transform2DV7 {
  position: NailPointV7;
  scaleX: number;
  scaleY: number;
  rotationDeg: number;
}

export interface VersionedRefV7 {
  id: string;
  revision: string;
}

export interface GeometryRefV7 {
  assetId: string;
  revision: string;
}

export type AssetKindV7 = 'raster' | 'vector' | 'mesh' | 'texture';
export interface AssetRefV7 {
  assetId: string;
  revision: string;
  kind: AssetKindV7;
  mimeType: string;
  sha256: string;
  widthPx?: number;
  heightPx?: number;
  colorSpace?: 'srgb' | 'display-p3';
  alphaMode?: 'straight' | 'premultiplied' | 'opaque';
}

export interface MaterialRefV7 {
  materialId: string;
  revision: string;
}

export type RecipeParameterValueV7 = string | number | boolean;
export interface RecipeInstanceV7 {
  instanceId: string;
  recipeId: string;
  recipeRevision: string;
  parameterValues: Record<string, RecipeParameterValueV7>;
}

export interface DesignSourceRefV1 {
  domain: 'community' | 'wizard' | 'manual' | 'legacy';
  sourceId: string;
  revision?: string;
}

export interface CommunicationRefV7 {
  communicationId: string;
  asset: AssetRefV7;
  caption?: string;
  createdAt: string;
}

export interface TenFingerCompositionRefV1 {
  compositionId: string;
  revision: string;
  source?: DesignSourceRefV1;
}

export interface CompositionProvenanceV1 {
  compositionId: string;
  revision: string;
  syncState: SyncStateV7;
}

export interface GradientStopV7 {
  offset: number;
  color: RgbaColorV7;
}

interface BackgroundBaseV7 {
  opacity: number;
}

export type BackgroundPayloadV7 =
  | (BackgroundBaseV7 & { mode: 'solid'; color: RgbaColorV7 })
  | (BackgroundBaseV7 & {
      mode: 'translucent';
      color: RgbaColorV7;
      materialPresetRef?: VersionedRefV7;
    })
  | (BackgroundBaseV7 & {
      mode: 'gradient';
      stops: GradientStopV7[];
      directionDeg: number;
    })
  | (BackgroundBaseV7 & {
      mode: 'cat_eye';
      color: RgbaColorV7;
      directionDeg: number;
      intensity: number;
      bandWidth: number;
      previewFidelity: PreviewFidelityV7;
    })
  | (BackgroundBaseV7 & {
      mode: 'glitter';
      colors: RgbaColorV7[];
      density: number;
      particleSizeMm: number;
      seed: string;
      previewFidelity: PreviewFidelityV7;
    });

export interface RegionMaskV7 {
  coordinateSpace: 'nail-local-v1';
  pathData: string;
  fillRule: 'nonzero' | 'evenodd';
  inverted: boolean;
}

interface EditorElementBaseV7 {
  id: string;
  visible: boolean;
  locked: boolean;
  opacity: number;
  transform: Transform2DV7;
}

export type FlatDesignElementV7 =
  | (EditorElementBaseV7 & {
      kind: 'brush_stroke';
      points: NailPointV7[];
      color: RgbaColorV7;
      widthMm: number;
    })
  | (EditorElementBaseV7 & {
      kind: 'eraser_mask';
      path: NailPointV7[];
      widthMm: number;
    })
  | (EditorElementBaseV7 & {
      kind: 'vector_shape';
      pathData: string;
      fill?: RgbaColorV7;
      stroke?: RgbaColorV7;
      strokeWidthMm?: number;
    })
  | (EditorElementBaseV7 & {
      kind: 'text';
      text: string;
      fontRef: VersionedRefV7;
      fontSizeMm: number;
      color: RgbaColorV7;
    })
  | (EditorElementBaseV7 & {
      kind: 'image_2d';
      role: 'sticker' | 'import' | 'stamp';
      asset: AssetRefV7;
    })
  | (EditorElementBaseV7 & {
      kind: 'french_edge';
      widthRatio: number;
      curvature: number;
      color: RgbaColorV7;
    })
  | (EditorElementBaseV7 & {
      kind: 'region_mask';
      mask: RegionMaskV7;
    });

export type SurfaceEffectPayloadV7 =
  | {
      effectType: 'cat_eye';
      directionDeg: number;
      intensity: number;
      bandWidth: number;
      previewFidelity: PreviewFidelityV7;
    }
  | {
      effectType: 'glitter';
      density: number;
      particleSizeMm: number;
      seed: string;
      previewFidelity: PreviewFidelityV7;
    }
  | {
      effectType: 'mirror';
      tint: RgbaColorV7;
      reflectance: number;
      previewFidelity: PreviewFidelityV7;
    }
  | {
      effectType: 'ink_bloom';
      colors: RgbaColorV7[];
      spread: number;
      seed: string;
      previewFidelity: PreviewFidelityV7;
    };

interface DimensionalDecorationBaseV7 {
  id: string;
  visible: boolean;
  locked: boolean;
  transform: Transform2DV7;
  heightMm: number;
  materialRef?: MaterialRefV7;
  previewFidelity: PreviewFidelityV7;
}

export type DimensionalDecorationV7 =
  | (DimensionalDecorationBaseV7 & {
      kind: 'relief_2_5d';
      outline: RegionMaskV7;
    })
  | (DimensionalDecorationBaseV7 & {
      kind: 'attachment_3d';
      asset: AssetRefV7;
      anchor: NailPointV7;
    });

export interface SurfaceFinishPayloadV7 {
  type: SurfaceFinishTypeV7;
  materialPresetRef: VersionedRefV7;
}

interface ProcessStepBaseV7 {
  id: string;
  typeId: string;
  name: string;
  visible: boolean;
  locked: boolean;
  skipped: boolean;
  recipeInstanceId?: string;
  materialRefs: MaterialRefV7[];
}

export type ProcessStepV7 =
  | (ProcessStepBaseV7 & { kind: 'background'; background: BackgroundPayloadV7 })
  | (ProcessStepBaseV7 & {
      kind: 'flat_design';
      elements: FlatDesignElementV7[];
      mask?: RegionMaskV7;
    })
  | (ProcessStepBaseV7 & {
      kind: 'surface_effect';
      effect: SurfaceEffectPayloadV7;
      mask: RegionMaskV7;
    })
  | (ProcessStepBaseV7 & {
      kind: 'dimensional_decoration';
      decorations: DimensionalDecorationV7[];
    })
  | (ProcessStepBaseV7 & {
      kind: 'surface_finish';
      finish: SurfaceFinishPayloadV7;
    });

export interface NailDesignV7 {
  finger: FingerCode;
  geometryRef: GeometryRefV7;
  steps: ProcessStepV7[];
  compositionProvenance?: CompositionProvenanceV1;
}

export interface EditorDocV7 {
  schemaVersion: 7;
  designId: string;
  customerRef?: string;
  title: string;
  nails: Record<FingerCode, NailDesignV7>;
  recipeInstances: Record<string, RecipeInstanceV7>;
  compositionMeta?: TenFingerCompositionRefV1;
  sourceRefs: DesignSourceRefV1[];
  communicationRefs: CommunicationRefV7[];
  outputIntent: EditorDocV7OutputIntent;
  revision: number;
  createdAt: string;
  updatedAt: string;
}
