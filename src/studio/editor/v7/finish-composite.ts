import { resolveBackgroundPreviewModelV7 } from './background';
import { dimensionalDecorationFidelityV7 } from './dimensional-decoration';
import { flatContentAssetStatusV7 } from './flat-content-assets';
import { surfaceFinishPreviewAppearanceV7 } from './finish';
import type { NailDesignV7, PreviewFidelityV7, SurfaceFinishTypeV7 } from './model';

export interface FinishCompositeReadModelV7 {
  finger: NailDesignV7['finger'];
  canonicalFinishType: SurfaceFinishTypeV7;
  previewFinishType: SurfaceFinishTypeV7;
  previewOnly: boolean;
  fidelity: PreviewFidelityV7;
  activeStepIds: string[];
  layerCounts: { background: number; flat: number; surface: number; dimensional: number; finish: number };
  finishAppearance: ReturnType<typeof surfaceFinishPreviewAppearanceV7>;
  warnings: string[];
}

function maxFidelity(left: PreviewFidelityV7, right: PreviewFidelityV7): PreviewFidelityV7 {
  const rank: Record<PreviewFidelityV7, number> = { exact: 0, approximate: 1, unavailable: 2 };
  return rank[left] >= rank[right] ? left : right;
}

export function deriveFinishCompositeV7(
  nail: NailDesignV7,
  previewFinishType?: SurfaceFinishTypeV7 | null,
): FinishCompositeReadModelV7 {
  const background = nail.steps[0];
  const finish = nail.steps[nail.steps.length - 1];
  if (background?.kind !== 'background' || finish?.kind !== 'surface_finish') throw new Error(`Invalid V7 finish composite contract for ${nail.finger}`);
  const middle = nail.steps.slice(1, -1).filter((step) => step.visible && !step.skipped);
  const flat = middle.filter((step) => step.kind === 'flat_design');
  const effects = middle.filter((step) => step.kind === 'surface_effect');
  const dimensional = middle.filter((step) => step.kind === 'dimensional_decoration');
  const flatElements = flat.flatMap((step) => step.kind === 'flat_design' ? step.elements.filter((element) => element.visible) : []);
  const decorations = dimensional.flatMap((step) => step.kind === 'dimensional_decoration' ? step.decorations.filter((item) => item.visible) : []);
  const warnings: string[] = [];
  let fidelity = maxFidelity(resolveBackgroundPreviewModelV7(background.background, background.visible).fidelity, 'approximate');
  for (const step of effects) fidelity = maxFidelity(fidelity, step.kind === 'surface_effect' ? step.effect.previewFidelity : 'unavailable');
  for (const decoration of decorations) fidelity = maxFidelity(fidelity, dimensionalDecorationFidelityV7(decoration));
  const invalidFlatAssets = flatElements.filter((element) => element.kind === 'image_2d' && flatContentAssetStatusV7(element.asset) === 'invalid').length;
  const flatMasks = flatElements.filter((element) => element.kind === 'eraser_mask' || element.kind === 'region_mask').length;
  if (invalidFlatAssets > 0) {
    fidelity = 'unavailable';
    warnings.push(`${invalidFlatAssets} 个 2D 素材引用不可用，组合预览保留占位`);
  }
  if (flatMasks > 0) warnings.push(`${flatMasks} 个 2D 蒙版以近似方式参与组合；原始结构化数据保持不变`);
  if (!background.visible) warnings.push('背景步骤已隐藏');
  if (effects.some((step) => step.kind === 'surface_effect' && step.effect.previewFidelity === 'unavailable')) warnings.push('部分表面效果当前不可表达，保留遮罩与数据');
  if (decorations.some((decoration) => dimensionalDecorationFidelityV7(decoration) === 'unavailable')) warnings.push('部分 mesh 不可用，保留 2D 装饰 fallback');
  const preview = previewFinishType ?? finish.finish.type;
  return {
    finger: nail.finger,
    canonicalFinishType: finish.finish.type,
    previewFinishType: preview,
    previewOnly: preview !== finish.finish.type,
    fidelity,
    activeStepIds: [background.id, ...middle.map((step) => step.id), finish.id],
    layerCounts: { background: 1, flat: flatElements.length, surface: effects.length, dimensional: decorations.length, finish: 1 },
    finishAppearance: surfaceFinishPreviewAppearanceV7(preview),
    warnings,
  };
}
