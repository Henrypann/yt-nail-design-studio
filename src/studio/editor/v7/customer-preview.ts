import { FINGER_CODES, type FingerCode } from '@/lib/types';
import {
  isCanonicalRgbaColorV7,
  resolveBackgroundPreviewModelV7,
} from './background';
import type {
  EditorDocV7,
  NailDesignV7,
  PreviewFidelityV7,
  RgbaColorV7,
  SurfaceFinishTypeV7,
} from './model';
import { flatContentAssetStatusV7 } from './flat-content-assets';

export interface CustomerPreviewScenarioV7 {
  backgroundColors: Partial<Record<FingerCode, RgbaColorV7>>;
  finishType: SurfaceFinishTypeV7 | null;
}

export interface CustomerNailPreviewReadModelV7 {
  finger: FingerCode;
  backgroundColorOverride: RgbaColorV7 | null;
  backgroundMode: string;
  backgroundVisible: boolean;
  finishType: SurfaceFinishTypeV7;
  backgroundScenarioActive: boolean;
  finishScenarioActive: boolean;
  flatStepCount: number;
  flatElementCount: number;
  unsupportedFlatElementCount: number;
  deferredSurfaceEffectCount: number;
  deferredDecorationCount: number;
  fidelity: PreviewFidelityV7;
  warnings: string[];
}

export function createCustomerPreviewScenarioV7(): CustomerPreviewScenarioV7 {
  return { backgroundColors: {}, finishType: null };
}

export function setCustomerPreviewBackgroundV7(
  scenario: CustomerPreviewScenarioV7,
  finger: FingerCode,
  color: RgbaColorV7 | null,
): CustomerPreviewScenarioV7 {
  const next = structuredClone(scenario);
  if (color === null) delete next.backgroundColors[finger];
  else if (isCanonicalRgbaColorV7(color)) next.backgroundColors[finger] = structuredClone(color);
  return next;
}

export function setCustomerPreviewFinishV7(
  scenario: CustomerPreviewScenarioV7,
  finishType: SurfaceFinishTypeV7 | null,
): CustomerPreviewScenarioV7 {
  if (finishType !== null && !['gloss', 'matte', 'frosted'].includes(finishType)) return structuredClone(scenario);
  return { ...structuredClone(scenario), finishType };
}

function maxFidelity(a: PreviewFidelityV7, b: PreviewFidelityV7): PreviewFidelityV7 {
  const rank: Record<PreviewFidelityV7, number> = { exact: 0, approximate: 1, unavailable: 2 };
  return rank[a] >= rank[b] ? a : b;
}

export function deriveCustomerNailPreviewV7(
  nail: NailDesignV7,
  scenario: CustomerPreviewScenarioV7,
): CustomerNailPreviewReadModelV7 {
  const background = nail.steps[0];
  const finish = nail.steps[nail.steps.length - 1];
  if (background?.kind !== 'background' || finish?.kind !== 'surface_finish') {
    throw new Error(`Invalid V7 preview nail contract for ${nail.finger}`);
  }

  const backgroundOverride = scenario.backgroundColors[nail.finger] ?? null;
  const visibleMiddle = nail.steps.slice(1, -1).filter((step) => step.visible && !step.skipped);
  const flatSteps = visibleMiddle.filter((step) => step.kind === 'flat_design');
  const flatElements = flatSteps.flatMap((step) => step.kind === 'flat_design' ? step.elements.filter((element) => element.visible) : []);
  const unsupportedFlatElements = flatElements.filter((element) => (
    element.kind === 'image_2d' && flatContentAssetStatusV7(element.asset) === 'invalid'
  ));
  const runtimeImportedAssets = flatElements.filter((element) => (
    element.kind === 'image_2d' && flatContentAssetStatusV7(element.asset) === 'import'
  ));
  const surfaceEffects = visibleMiddle.filter((step) => step.kind === 'surface_effect');
  const decorations = visibleMiddle
    .filter((step) => step.kind === 'dimensional_decoration')
    .flatMap((step) => step.kind === 'dimensional_decoration' ? step.decorations.filter((decoration) => decoration.visible) : []);
  const backgroundPreview = resolveBackgroundPreviewModelV7(background.background, background.visible);
  const warnings: string[] = [];
  let fidelity: PreviewFidelityV7 = backgroundOverride ? 'exact' : backgroundPreview.fidelity;

  // Finish is represented as a deterministic 2D viewing aid until V7-14 final 3D.
  fidelity = maxFidelity(fidelity, 'approximate');
  if (!background.visible) warnings.push('背景步骤已隐藏');
  if (unsupportedFlatElements.length > 0) {
    warnings.push(`${unsupportedFlatElements.length} 个素材引用无效，预览中显示恢复占位`);
    fidelity = 'unavailable';
  }
  if (runtimeImportedAssets.length > 0) {
    warnings.push(`${runtimeImportedAssets.length} 个本机导入素材将在运行时校验；缺失时显示恢复占位`);
    fidelity = maxFidelity(fidelity, 'approximate');
  }
  if (surfaceEffects.length > 0) {
    warnings.push(`${surfaceEffects.length} 个表面效果仅保留数据，V7-12 提供 2D 预览`);
    fidelity = 'unavailable';
  }
  if (decorations.length > 0) {
    warnings.push(`${decorations.length} 个立体装饰仅保留数据，V7-13 提供 2D/2.5D 预览`);
    fidelity = 'unavailable';
  }

  return {
    finger: nail.finger,
    backgroundColorOverride: backgroundOverride ? structuredClone(backgroundOverride) : null,
    backgroundMode: backgroundOverride ? 'scenario-solid' : background.background.mode,
    backgroundVisible: background.visible,
    finishType: scenario.finishType ?? finish.finish.type,
    backgroundScenarioActive: backgroundOverride !== null,
    finishScenarioActive: scenario.finishType !== null,
    flatStepCount: flatSteps.length,
    flatElementCount: flatElements.length,
    unsupportedFlatElementCount: unsupportedFlatElements.length,
    deferredSurfaceEffectCount: surfaceEffects.length,
    deferredDecorationCount: decorations.length,
    fidelity,
    warnings,
  };
}

export function deriveCustomerPreviewSetV7(
  doc: EditorDocV7,
  scenario: CustomerPreviewScenarioV7,
): CustomerNailPreviewReadModelV7[] {
  return FINGER_CODES.map((finger) => deriveCustomerNailPreviewV7(doc.nails[finger], scenario));
}
