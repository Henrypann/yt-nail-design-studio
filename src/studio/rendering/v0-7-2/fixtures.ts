import type { PreviewAppearanceProfileV1, RenderSceneSnapshotV1 } from './model';

export const GOLDEN_PREVIEW_APPEARANCE_PROFILE_V1: PreviewAppearanceProfileV1 = {
  schemaVersion: '1.0.0',
  profileId: 'appearance.single-nail.neutral-studio',
  revision: '1.0.0',
  sha256: '1'.repeat(64),
  purpose: 'single_nail_customer_preview',
  colorManagement: {
    workingSpace: 'linear-srgb', outputSpace: 'srgb', toneMapping: 'aces-filmic', exposure: 1,
  },
  environment: { environmentId: 'neutral-studio-v1', intensity: 1, background: 'warm-workspace' },
  finishes: {
    gloss: { baseRoughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.12, transmission: 0.08 },
    matte: { baseRoughness: 0.72, clearcoat: 0.05, clearcoatRoughness: 0.8, transmission: 0 },
    frosted: { baseRoughness: 0.52, clearcoat: 0.18, clearcoatRoughness: 0.55, transmission: 0.04 },
  },
  cameraPresets: [
    { id: 'surface', positionMm: [0, -5, 45], targetMm: [0, -8, 0], up: [0, 1, 0], verticalFovDeg: 32 },
    { id: 'oblique_left', positionMm: [-25, -14, 32], targetMm: [0, -8, 0], up: [0, 0, 1], verticalFovDeg: 32 },
    { id: 'oblique_right', positionMm: [25, -14, 32], targetMm: [0, -8, 0], up: [0, 0, 1], verticalFovDeg: 32 },
    { id: 'side_profile', positionMm: [38, -8, 5], targetMm: [0, -8, 0], up: [0, 0, 1], verticalFovDeg: 28 },
    { id: 'tip_grazing', positionMm: [0, -40, 12], targetMm: [0, -8, 0], up: [0, 0, 1], verticalFovDeg: 30 },
  ],
  evidence: {
    fidelity: 'approximate', manufacturingValidated: false,
    limitations: ['Simulated lighting and PBR appearance only.', 'No material, curing, fit, print, or manufacturing validation.'],
  },
};

export const GOLDEN_RENDER_SCENE_SNAPSHOT_V1: RenderSceneSnapshotV1 = {
  schemaVersion: '1.0.0',
  sceneId: 'scene.demo-design.R4.rev1',
  profileRef: { id: GOLDEN_PREVIEW_APPEARANCE_PROFILE_V1.profileId, revision: '1.0.0', sha256: '1'.repeat(64) },
  geometryRef: { snapshotId: 'geometry.demo.R4', revision: '1.0.0', geometryHash: '2'.repeat(64), fidelity: 'approximate' },
  designRef: { designId: 'demo-design', revision: 1, finger: 'R4' },
  presentation: 'single_nail_focus_simulated_3d', quality: 'interactive', finish: 'gloss',
  layerRefs: [
    { stepId: 'background-R4', kind: 'background', fidelity: 'exact' },
    { stepId: 'flat-R4', kind: 'flat_design', fidelity: 'approximate' },
    { stepId: 'finish-R4', kind: 'surface_finish', fidelity: 'approximate' },
  ],
  cameraPresetId: 'oblique_left',
  evidence: {
    fidelity: 'approximate', writerZero: true, manufacturingValidated: false,
    limitations: ['Single-nail customer communication preview only.', 'Ten-finger simulated composite remains on the existing SVG 2.5D path.'],
  },
};
