import { FINGER_CODES, type FingerCode } from '@/lib/types';
import type { AssetRefV7, DimensionalDecorationV7, EditorDocV7, ProcessStepV7, RegionMaskV7 } from './model';
import { parseHexColorV7 } from './background';
import { getBundledFlatAssetV7 } from './flat-content-assets';
import { PROCESS_STEP_TYPE_IDS_V7 } from './registry';
import { parseEditorDocV7 } from './schema';
import { dimensionalMeshAssetRefV7 } from './dimensional-decoration';

export const PETAL_PEARL_BLOOM_RECIPE_ID = 'petal-pearl-bloom';
export const PETAL_PEARL_BLOOM_RECIPE_REVISION = '1.0.0';
export const PETAL_PEARL_BLOOM_RECIPE_INSTANCE_ID = 'recipe.petal-pearl-bloom.signature';

const bundledPetalOutline = getBundledFlatAssetV7('bundled.sticker.petal-pearl-outline');
if (!bundledPetalOutline) throw new Error('missing bundled Petal Pearl outline');
export const PETAL_PEARL_BLOOM_FLAT_ASSET: AssetRefV7 = structuredClone(bundledPetalOutline.asset);

export const PETAL_PEARL_BLOOM_LOOK_COMPOSITION = {
  L1: 'pearl-studs-ruby', L2: 'crystal-flower', L3: 'petal-outline', L4: 'petal-tint', L5: 'pearl-minimal',
  R1: 'petal-tint', R2: 'pearl-minimal', R3: 'pearl-studs-ruby', R4: 'crystal-flower', R5: 'petal-outline',
} as const satisfies Record<FingerCode, string>;

const OUTLINE_FINGERS = new Set<FingerCode>(['L3', 'R5']);
const TINT_FINGERS = new Set<FingerCode>(['L4', 'R1']);
const FLOWER_FINGERS = new Set<FingerCode>(['L2', 'R4']);

function fullMask(): RegionMaskV7 {
  return { coordinateSpace: 'nail-local-v1', pathData: 'M0 0 L1 0 L1 1 L0 1 Z', fillRule: 'nonzero', inverted: false };
}

function attachment(finger: FingerCode, token: string, assetId: string, position: { u: number; v: number }, heightMm: number, materialId: string, scale = 1): DimensionalDecorationV7 {
  const asset = dimensionalMeshAssetRefV7(assetId);
  if (!asset) throw new Error(`missing simulated Petal Pearl asset ${assetId}`);
  return {
    id: `decoration.petal-pearl.${finger}.${token}`, kind: 'attachment_3d', visible: true, locked: false,
    transform: { position, scaleX: scale, scaleY: scale, rotationDeg: 0 }, heightMm,
    materialRef: { materialId, revision: '1' }, previewFidelity: 'approximate', asset, anchor: position,
  };
}

function decorationsFor(finger: FingerCode): DimensionalDecorationV7[] {
  if (FLOWER_FINGERS.has(finger)) return [
    attachment(finger, 'crystal-flower', 'petal-pearl-crystal-flower', { u: 0.5, v: 0.54 }, 1.04, 'material.petal-pearl.clear-crystal', 0.72),
    attachment(finger, 'lavender-pearl', 'petal-pearl-lavender-pearl', { u: 0.27, v: 0.26 }, 0.3, 'material.petal-pearl.lavender-pearl', 0.38),
    attachment(finger, 'ruby-microbeads', 'petal-pearl-ruby-microbeads', { u: 0.69, v: 0.76 }, 0.18, 'material.petal-pearl.ruby-glass', 0.42),
  ];
  if (finger === 'L1' || finger === 'R3') return [
    attachment(finger, 'lavender-pearl', 'petal-pearl-lavender-pearl', { u: 0.32, v: 0.28 }, 0.3, 'material.petal-pearl.lavender-pearl', 0.34),
    attachment(finger, 'silver-studs', 'petal-pearl-silver-stud-cluster', { u: 0.51, v: 0.52 }, 0.26, 'material.petal-pearl.polished-silver', 0.42),
    attachment(finger, 'ruby-microbeads', 'petal-pearl-ruby-microbeads', { u: 0.7, v: 0.75 }, 0.18, 'material.petal-pearl.ruby-glass', 0.38),
  ];
  if (finger === 'L5' || finger === 'R2') return [
    attachment(finger, 'lavender-pearl', 'petal-pearl-lavender-pearl', { u: finger === 'L5' ? 0.65 : 0.35, v: 0.36 }, 0.3, 'material.petal-pearl.lavender-pearl', 0.32),
  ];
  if (OUTLINE_FINGERS.has(finger)) return [
    attachment(finger, 'silver-studs', 'petal-pearl-silver-stud-cluster', { u: finger === 'L3' ? 0.7 : 0.3, v: 0.3 }, 0.26, 'material.petal-pearl.polished-silver', 0.3),
  ];
  if (TINT_FINGERS.has(finger)) return [
    attachment(finger, 'ruby-microbeads', 'petal-pearl-ruby-microbeads', { u: finger === 'L4' ? 0.7 : 0.3, v: 0.72 }, 0.18, 'material.petal-pearl.ruby-glass', 0.3),
  ];
  return [];
}

/** Materialize the ten-finger Look as independent canonical V7 process steps. */
export function materializePetalPearlBloomV7(doc: EditorDocV7): EditorDocV7 | null {
  const next = structuredClone(doc);
  const base = parseHexColorV7('#F4DCE5');
  const bloomA = parseHexColorV7('#F04488');
  const bloomB = parseHexColorV7('#F7B0CA');
  if (!base || !bloomA || !bloomB) return null;
  base.a = 0.72;
  bloomA.a = 0.72;
  bloomB.a = 0.42;
  next.title = 'Petal Pearl Bloom';
  next.recipeInstances = {
    [PETAL_PEARL_BLOOM_RECIPE_INSTANCE_ID]: {
      instanceId: PETAL_PEARL_BLOOM_RECIPE_INSTANCE_ID,
      recipeId: PETAL_PEARL_BLOOM_RECIPE_ID,
      recipeRevision: PETAL_PEARL_BLOOM_RECIPE_REVISION,
      parameterValues: { renderer: 'svg-2.5d/petal-pearl-bloom-1', previewFidelity: 'simulated', manufacturingCommandAllowed: false },
    },
  };

  for (const finger of FINGER_CODES) {
    const nail = next.nails[finger];
    const existingFinish = nail.steps[nail.steps.length - 1];
    if (existingFinish.kind !== 'surface_finish') return null;
    const recipeInstanceId = PETAL_PEARL_BLOOM_RECIPE_INSTANCE_ID;
    const steps: ProcessStepV7[] = [{
      id: `step.petal-pearl.${finger}.background`, typeId: PROCESS_STEP_TYPE_IDS_V7.background, kind: 'background', name: '透明裸粉底色',
      visible: true, locked: false, skipped: false, recipeInstanceId, materialRefs: [{ materialId: 'material.petal-pearl.translucent-nude', revision: '1' }],
      background: { mode: 'translucent', opacity: 0.82, color: structuredClone(base), materialPresetRef: { id: 'preset.petal-pearl.translucent-nude', revision: '1' } },
    }];
    if (OUTLINE_FINGERS.has(finger)) steps.push({
      id: `step.petal-pearl.${finger}.outline`, typeId: PROCESS_STEP_TYPE_IDS_V7.flat_design, kind: 'flat_design', name: '花瓣线稿',
      visible: true, locked: false, skipped: false, recipeInstanceId, materialRefs: [], elements: [{
        id: `element.petal-pearl.${finger}.outline`, kind: 'image_2d', role: 'sticker', visible: true, locked: false, opacity: 0.94,
        transform: { position: { u: 0.5, v: 0.52 }, scaleX: 0.88, scaleY: 0.88, rotationDeg: finger === 'L3' ? -6 : 7 }, asset: structuredClone(PETAL_PEARL_BLOOM_FLAT_ASSET),
      }],
    });
    if (TINT_FINGERS.has(finger)) steps.push({
      id: `step.petal-pearl.${finger}.tint`, typeId: PROCESS_STEP_TYPE_IDS_V7.surface_effect, kind: 'surface_effect', name: '花瓣局部晕染',
      visible: true, locked: false, skipped: false, recipeInstanceId, materialRefs: [{ materialId: 'material.petal-pearl.petal-tint', revision: '1' }],
      effect: { effectType: 'ink_bloom', colors: [structuredClone(bloomA), structuredClone(bloomB)], spread: 0.54, seed: `petal-pearl-${finger}`, previewFidelity: 'approximate' }, mask: fullMask(),
    });
    const decorations = decorationsFor(finger);
    if (decorations.length) steps.push({
      id: `step.petal-pearl.${finger}.decorations`, typeId: PROCESS_STEP_TYPE_IDS_V7.dimensional_decoration, kind: 'dimensional_decoration', name: FLOWER_FINGERS.has(finger) ? '水晶花与珠饰' : '珍珠与珠饰',
      visible: true, locked: false, skipped: false, recipeInstanceId, materialRefs: [], decorations,
    });
    steps.push({
      ...existingFinish, id: `step.petal-pearl.${finger}.finish`, name: '透明亮面封层', recipeInstanceId,
      materialRefs: [{ materialId: 'material.finish.gloss', revision: '1' }], finish: { type: 'gloss', materialPresetRef: { id: 'preset.finish.gloss', revision: '1' } },
    });
    nail.steps = steps;
  }
  const parsed = parseEditorDocV7(next);
  return parsed.ok ? parsed.doc : null;
}
