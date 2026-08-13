import type { FingerCode } from '@/lib/types';
import type { GeometryFidelityV1, GeometryVersionedRefV1 } from '@/studio/geometry/v0-7-2';

export const RENDER_CONTRACT_VERSION_V072 = '1.0.0' as const;
export type RenderEvidenceV1 = 'exact' | 'approximate' | 'unavailable';
export type RenderQualityV1 = 'interactive' | 'high_quality';
export type RenderFinishV1 = 'gloss' | 'matte' | 'frosted';

export interface RenderCameraPresetV1 {
  id: 'surface' | 'oblique_left' | 'oblique_right' | 'side_profile' | 'tip_grazing';
  positionMm: [number, number, number];
  targetMm: [number, number, number];
  up: [number, number, number];
  verticalFovDeg: number;
}

export interface PreviewAppearanceProfileV1 {
  schemaVersion: typeof RENDER_CONTRACT_VERSION_V072;
  profileId: string;
  revision: string;
  sha256: string;
  purpose: 'single_nail_customer_preview';
  colorManagement: {
    workingSpace: 'linear-srgb';
    outputSpace: 'srgb';
    toneMapping: 'aces-filmic';
    exposure: number;
  };
  environment: {
    environmentId: 'neutral-studio-v1';
    intensity: number;
    background: 'warm-workspace';
  };
  finishes: Record<RenderFinishV1, {
    baseRoughness: number;
    clearcoat: number;
    clearcoatRoughness: number;
    transmission: number;
  }>;
  cameraPresets: RenderCameraPresetV1[];
  evidence: {
    fidelity: 'approximate';
    manufacturingValidated: false;
    limitations: string[];
  };
}

export interface RenderSceneSnapshotV1 {
  schemaVersion: typeof RENDER_CONTRACT_VERSION_V072;
  sceneId: string;
  profileRef: GeometryVersionedRefV1;
  geometryRef: {
    snapshotId: string;
    revision: string;
    geometryHash: string;
    fidelity: GeometryFidelityV1;
  };
  designRef: { designId: string; revision: number; finger: FingerCode };
  presentation: 'single_nail_focus_simulated_3d';
  quality: RenderQualityV1;
  finish: RenderFinishV1;
  layerRefs: Array<{
    stepId: string;
    kind: 'background' | 'flat_design' | 'surface_effect' | 'dimensional_decoration' | 'surface_finish';
    fidelity: RenderEvidenceV1;
  }>;
  cameraPresetId: RenderCameraPresetV1['id'];
  evidence: {
    fidelity: RenderEvidenceV1;
    writerZero: true;
    manufacturingValidated: false;
    limitations: string[];
  };
}

export type ParseRenderContractResultV1<T> =
  | { ok: true; value: T }
  | { ok: false; issues: Array<{ path: string; code: 'invalid_contract' | 'unknown_key'; message: string }> };
