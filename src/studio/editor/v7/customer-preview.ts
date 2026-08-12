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
import { dimensionalDecorationFidelityV7 } from './dimensional-decoration';
import { flatContentAssetStatusV7 } from './flat-content-assets';
import { resolveEditorGeometryV7 } from './geometry-registry';
import { surfaceEffectFidelityV7 } from './surface-effect';

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
  activeSurfaceEffectCount: number;
  activeDecorationCount: number;
  fidelityByLayer: {
    geometry: PreviewFidelityV7;
    background: PreviewFidelityV7;
    flat: PreviewFidelityV7;
    surfaceEffect: PreviewFidelityV7;
    dimensionalDecoration: PreviewFidelityV7;
    finish: PreviewFidelityV7;
  };
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

function aggregateFidelity(values: readonly PreviewFidelityV7[], fallback: PreviewFidelityV7 = 'exact'): PreviewFidelityV7 {
  return values.reduce(maxFidelity, fallback);
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
  const geometry = resolveEditorGeometryV7(nail.geometryRef, nail.finger);
  const warnings: string[] = [];
  const flatMaskCount = flatSteps.reduce((count, step) => count
    + (step.mask ? 1 : 0)
    + step.elements.filter((element) => element.kind === 'eraser_mask' || element.kind === 'region_mask').length, 0);
  let flatFidelity: PreviewFidelityV7 = runtimeImportedAssets.length > 0 || flatMaskCount > 0 ? 'approximate' : 'exact';
  if (unsupportedFlatElements.length > 0) flatFidelity = 'unavailable';
  const surfaceEffectFidelity = aggregateFidelity(surfaceEffects.map((step) => (
    step.kind === 'surface_effect' ? surfaceEffectFidelityV7(step.effect) : 'unavailable'
  )));
  const decorationFidelity = aggregateFidelity(decorations.map(dimensionalDecorationFidelityV7));
  const fidelityByLayer: CustomerNailPreviewReadModelV7['fidelityByLayer'] = {
    geometry: geometry.fidelity,
    background: backgroundOverride ? 'exact' : backgroundPreview.fidelity,
    flat: flatFidelity,
    surfaceEffect: surfaceEffectFidelity,
    dimensionalDecoration: decorationFidelity,
    // The finish is a deterministic SVG viewing aid, not measured material appearance.
    finish: 'approximate',
  };
  let fidelity = Object.values(fidelityByLayer).reduce(maxFidelity, 'exact');

  if (geometry.fidelity === 'approximate') warnings.push('甲型使用尚未签收的生成轮廓，整体预览降级为近似');
  if (geometry.fidelity === 'unavailable') warnings.push('甲型轮廓不可用，整体预览使用通用边界且不可视为设计定稿');

  if (!background.visible) warnings.push('背景步骤已隐藏');
  if (unsupportedFlatElements.length > 0) {
    warnings.push(`${unsupportedFlatElements.length} 个素材引用无效，预览中显示恢复占位`);
    fidelity = 'unavailable';
  }
  if (runtimeImportedAssets.length > 0) {
    warnings.push(`${runtimeImportedAssets.length} 个本机导入素材将在运行时校验；缺失时显示恢复占位`);
  }
  if (flatMaskCount > 0) {
    warnings.push(`${flatMaskCount} 个平面遮罩以确定性 SVG 近似参与预览`);
  }
  const unavailableSurfaceEffects = surfaceEffects.filter((step) => (
    step.kind === 'surface_effect' && surfaceEffectFidelityV7(step.effect) === 'unavailable'
  )).length;
  if (unavailableSurfaceEffects > 0) {
    warnings.push(`${unavailableSurfaceEffects} 个表面效果不可表达，组合视图显示遮罩边界 fallback`);
  }
  const unavailableDecorations = decorations.filter((decoration) => dimensionalDecorationFidelityV7(decoration) === 'unavailable').length;
  if (unavailableDecorations > 0) {
    warnings.push(`${unavailableDecorations} 个立体装饰 Mesh 不可用，组合视图保留 2D fallback`);
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
    activeSurfaceEffectCount: surfaceEffects.length,
    activeDecorationCount: decorations.length,
    fidelityByLayer,
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
