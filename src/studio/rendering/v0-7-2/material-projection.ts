import {
  createGlitterPreviewParticlesV7,
  representativeBackgroundColorV7,
} from '@/studio/editor/v7/background';
import { parseNailPathDataV7, resolveFlatElementMaskScopeV7 } from '@/studio/editor/v7/flat-vector';
import type {
  BackgroundPayloadV7,
  FlatDesignElementV7,
  NailDesignV7,
  PreviewFidelityV7,
  ProcessStepV7,
  RegionMaskV7,
  RgbaColorV7,
  Transform2DV7,
} from '@/studio/editor/v7/model';
import type { CustomerNailPreviewReadModelV7 } from '@/studio/editor/v7/customer-preview';
import {
  createSurfaceEffectParticlesV7,
  normalizeSurfaceEffectDirectionV7,
} from '@/studio/editor/v7/surface-effect';

export const MATERIAL_PROJECTION_SCHEMA_V1 = 'material-projection-v1';
export const MATERIAL_PROJECTION_WIDTH_V1 = 512;
export const MATERIAL_PROJECTION_HEIGHT_V1 = 819;

const SVG_WIDTH = 100;
const SVG_HEIGHT = 160;
const MM_TO_SVG = 8;

type FlatStepV7 = Extract<ProcessStepV7, { kind: 'flat_design' }>;
type SurfaceEffectStepV7 = Extract<ProcessStepV7, { kind: 'surface_effect' }>;

export interface SingleNailMaterialProjectionV1 {
  schemaVersion: typeof MATERIAL_PROJECTION_SCHEMA_V1;
  widthPx: number;
  heightPx: number;
  svg: string;
  projectionHash: string;
  backgroundMode: string;
  projectedLayerKinds: Array<'background' | 'flat_design' | 'surface_effect'>;
  omittedElementKinds: Array<'text' | 'image_2d'>;
  fidelity: PreviewFidelityV7;
  hasTransparency: boolean;
  warnings: string[];
}

function round(value: number): number {
  return Math.round(value * 100_000) / 100_000;
}

function rgba(color: RgbaColorV7, opacity = 1): string {
  return `rgba(${color.r},${color.g},${color.b},${round(Math.min(1, Math.max(0, color.a * opacity)))})`;
}

function maxFidelity(first: PreviewFidelityV7, second: PreviewFidelityV7): PreviewFidelityV7 {
  const rank: Record<PreviewFidelityV7, number> = { exact: 0, approximate: 1, unavailable: 2 };
  return rank[first] >= rank[second] ? first : second;
}

function hashStringV1(value: string): string {
  let first = 2166136261;
  let second = 0x9e3779b9;
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    first = Math.imul(first ^ code, 16777619);
    second = Math.imul(second ^ code, 2246822519);
  }
  return `${(first >>> 0).toString(16).padStart(8, '0')}${(second >>> 0).toString(16).padStart(8, '0')}`;
}

function pathToSvg(pathData: string): string | null {
  const parsed = parseNailPathDataV7(pathData);
  if (!parsed) return null;
  return parsed.commands.map(({ command, values }) => {
    const scaled = values.map((value, index) => round(value * (index % 2 === 0 ? SVG_WIDTH : SVG_HEIGHT)));
    return `${command}${scaled.length > 0 ? scaled.join(' ') : ''}`;
  }).join(' ');
}

function pointsToSvg(points: readonly { u: number; v: number }[]): string {
  return points.map((point) => `${round(point.u * SVG_WIDTH)},${round(point.v * SVG_HEIGHT)}`).join(' ');
}

function transformSvg(transform: Transform2DV7, artwork: string): string {
  return `<g transform="translate(${round(transform.position.u * SVG_WIDTH)} ${round(transform.position.v * SVG_HEIGHT)}) rotate(${round(transform.rotationDeg)}) scale(${round(transform.scaleX)} ${round(transform.scaleY)}) translate(-50 -80)">${artwork}</g>`;
}

function gradientVector(directionDeg: number) {
  const radians = directionDeg * Math.PI / 180;
  const dx = Math.cos(radians) * 70;
  const dy = Math.sin(radians) * 100;
  return { x1: round(50 - dx), y1: round(80 - dy), x2: round(50 + dx), y2: round(80 + dy) };
}

function regionMaskDefinition(mask: RegionMaskV7, id: string): string | null {
  const path = pathToSvg(mask.pathData);
  if (!path) return null;
  return `<mask id="${id}" maskUnits="userSpaceOnUse" x="0" y="0" width="100" height="160"><rect width="100" height="160" fill="${mask.inverted ? 'white' : 'black'}"/><path d="${path}" fill="${mask.inverted ? 'black' : 'white'}" fill-rule="${mask.fillRule}"/></mask>`;
}

function backgroundArtwork(
  background: BackgroundPayloadV7,
  override: RgbaColorV7 | null,
  defs: string[],
): string {
  if (override) return `<rect width="100" height="160" fill="${rgba(override)}"/>`;
  if (background.mode === 'gradient') {
    const vector = gradientVector(background.directionDeg);
    defs.push(`<linearGradient id="background-gradient" gradientUnits="userSpaceOnUse" x1="${vector.x1}" y1="${vector.y1}" x2="${vector.x2}" y2="${vector.y2}">${background.stops.map((stop) => `<stop offset="${round(stop.offset)}" stop-color="${rgba(stop.color, background.opacity)}"/>`).join('')}</linearGradient>`);
    return '<rect width="100" height="160" fill="url(#background-gradient)"/>';
  }
  if (background.mode === 'cat_eye') {
    const vector = gradientVector(background.directionDeg);
    const start = Math.max(0.15, 0.5 - background.bandWidth);
    const end = Math.min(0.85, 0.5 + background.bandWidth);
    defs.push(`<linearGradient id="background-cat-eye" gradientUnits="userSpaceOnUse" x1="${vector.x1}" y1="${vector.y1}" x2="${vector.x2}" y2="${vector.y2}"><stop offset="0" stop-color="${rgba(background.color, background.opacity * 0.55)}"/><stop offset="${round(start)}" stop-color="${rgba(background.color, background.opacity * 0.72)}"/><stop offset="0.5" stop-color="rgba(255,255,255,${round(0.25 + background.intensity * 0.55)})"/><stop offset="${round(end)}" stop-color="${rgba(background.color, background.opacity * 0.72)}"/><stop offset="1" stop-color="${rgba(background.color, background.opacity * 0.55)}"/></linearGradient>`);
    return '<rect width="100" height="160" fill="url(#background-cat-eye)"/>';
  }
  if (background.mode === 'glitter') {
    const base = representativeBackgroundColorV7(background);
    const particles = createGlitterPreviewParticlesV7(background.seed, background.density, background.colors.length);
    return `<rect width="100" height="160" fill="${rgba(base, background.opacity)}"/>${particles.map((particle) => `<circle cx="${round(particle.u * SVG_WIDTH)}" cy="${round(particle.v * SVG_HEIGHT)}" r="${round(particle.size)}" fill="${rgba(background.colors[particle.colorIndex], particle.opacity)}"/>`).join('')}`;
  }
  return `<rect width="100" height="160" fill="${rgba(background.color, background.opacity)}"/>`;
}

function renderFlatElement(element: FlatDesignElementV7): string | null {
  if (!element.visible || element.kind === 'eraser_mask' || element.kind === 'region_mask' || element.kind === 'text' || element.kind === 'image_2d') return null;
  if (element.kind === 'brush_stroke') {
    return transformSvg(element.transform, `<polyline points="${pointsToSvg(element.points)}" fill="none" stroke="${rgba(element.color, element.opacity)}" stroke-width="${round(element.widthMm * MM_TO_SVG)}" stroke-linecap="round" stroke-linejoin="round"/>`);
  }
  if (element.kind === 'vector_shape') {
    const path = pathToSvg(element.pathData);
    if (!path) return null;
    return transformSvg(element.transform, `<path d="${path}" fill="${element.fill ? rgba(element.fill, element.opacity) : 'none'}" stroke="${element.stroke ? rgba(element.stroke, element.opacity) : 'none'}" stroke-width="${round((element.strokeWidthMm ?? 0) * MM_TO_SVG)}"/>`);
  }
  const edge = Math.min(0.95, Math.max(0, element.widthRatio));
  const control = Math.min(1, Math.max(0, edge + element.curvature * 0.18));
  return transformSvg(element.transform, `<path d="M0 0 L100 0 L100 ${round(edge * SVG_HEIGHT)} Q50 ${round(control * SVG_HEIGHT)} 0 ${round(edge * SVG_HEIGHT)} Z" fill="${rgba(element.color, element.opacity)}"/>`);
}

function renderFlatStep(
  step: FlatStepV7,
  stepIndex: number,
  defs: string[],
  warnings: Set<string>,
  omittedKinds: Set<'text' | 'image_2d'>,
): { artwork: string; approximate: boolean; unavailable: boolean } {
  let approximate = false;
  let unavailable = false;
  const stepMaskId = `flat-${stepIndex}-step-mask`;
  if (step.mask) {
    const definition = regionMaskDefinition(step.mask, stepMaskId);
    if (definition) defs.push(definition);
    else {
      unavailable = true;
      warnings.add(`平面步骤 ${stepIndex + 1} 的步骤遮罩无法投影`);
    }
  }
  const artwork = step.elements.map((element, elementIndex) => {
    if (element.kind === 'text' || element.kind === 'image_2d') {
      if (element.visible) {
        omittedKinds.add(element.kind);
        unavailable = true;
        warnings.add(element.kind === 'text' ? '文字尚未进入 PBR 材质投影' : '2D 素材尚未进入 PBR 材质投影');
      }
      return '';
    }
    let rendered = renderFlatElement(element);
    if (!rendered) return '';
    const scope = resolveFlatElementMaskScopeV7(step, elementIndex);
    if (scope.stepMask && step.mask && defs.some((entry) => entry.includes(`id="${stepMaskId}"`))) {
      rendered = `<g mask="url(#${stepMaskId})">${rendered}</g>`;
      approximate = true;
    }
    const erasers = scope.eraserMaskIds.map((id) => step.elements.find((item) => item.id === id && item.kind === 'eraser_mask')).filter((item): item is Extract<FlatDesignElementV7, { kind: 'eraser_mask' }> => Boolean(item));
    if (erasers.length > 0) {
      const id = `flat-${stepIndex}-element-${elementIndex}-eraser`;
      defs.push(`<mask id="${id}" maskUnits="userSpaceOnUse" x="0" y="0" width="100" height="160"><rect width="100" height="160" fill="white"/>${erasers.map((eraser) => transformSvg(eraser.transform, `<polyline points="${pointsToSvg(eraser.path)}" fill="none" stroke="black" stroke-opacity="${round(eraser.opacity)}" stroke-width="${round(eraser.widthMm * MM_TO_SVG)}" stroke-linecap="round" stroke-linejoin="round"/>`)).join('')}</mask>`);
      rendered = `<g mask="url(#${id})">${rendered}</g>`;
      approximate = true;
    }
    scope.regionMaskIds.forEach((idValue, maskIndex) => {
      const region = step.elements.find((item) => item.id === idValue && item.kind === 'region_mask');
      if (!region || region.kind !== 'region_mask') return;
      const path = pathToSvg(region.mask.pathData);
      if (!path) {
        unavailable = true;
        warnings.add(`平面步骤 ${stepIndex + 1} 的区域遮罩无法投影`);
        return;
      }
      const id = `flat-${stepIndex}-element-${elementIndex}-region-${maskIndex}`;
      defs.push(`<mask id="${id}" maskUnits="userSpaceOnUse" x="0" y="0" width="100" height="160"><rect width="100" height="160" fill="white" opacity="${region.mask.inverted ? 1 : round(1 - region.opacity)}"/>${transformSvg(region.transform, `<path d="${path}" fill="${region.mask.inverted ? 'black' : 'white'}" fill-opacity="${region.mask.inverted ? round(region.opacity) : 1}" fill-rule="${region.mask.fillRule}"/>`)}</mask>`);
      rendered = `<g mask="url(#${id})">${rendered}</g>`;
      approximate = true;
    });
    return rendered;
  }).join('');
  return { artwork, approximate, unavailable };
}

function renderSurfaceEffect(
  step: SurfaceEffectStepV7,
  stepIndex: number,
  defs: string[],
  warnings: Set<string>,
): { artwork: string; fidelity: PreviewFidelityV7 } {
  const path = pathToSvg(step.mask.pathData);
  if (!path || step.effect.previewFidelity === 'unavailable') {
    warnings.add(`表面效果 ${stepIndex + 1} 无法进入材质投影`);
    return { artwork: '', fidelity: 'unavailable' };
  }
  const maskId = `effect-${stepIndex}-mask`;
  defs.push(`<mask id="${maskId}" maskUnits="userSpaceOnUse" x="0" y="0" width="100" height="160"><rect width="100" height="160" fill="${step.mask.inverted ? 'white' : 'black'}"/><path d="${path}" fill="${step.mask.inverted ? 'black' : 'white'}" fill-rule="${step.mask.fillRule}"/></mask>`);
  const effect = step.effect;
  let artwork = '';
  if (effect.effectType === 'cat_eye') {
    const gradientId = `effect-${stepIndex}-cat-eye`;
    defs.push(`<linearGradient id="${gradientId}"><stop stop-color="white" stop-opacity="0"/><stop offset="0.5" stop-color="white" stop-opacity="0.95"/><stop offset="1" stop-color="white" stop-opacity="0"/></linearGradient>`);
    artwork = `<rect x="-20" width="140" height="160" fill="url(#${gradientId})" transform="rotate(${round(normalizeSurfaceEffectDirectionV7(effect.directionDeg))} 50 80)" opacity="${round(effect.intensity)}"/>`;
  } else if (effect.effectType === 'mirror') {
    const gradientId = `effect-${stepIndex}-mirror`;
    defs.push(`<linearGradient id="${gradientId}" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#263238" stop-opacity="0.35"/><stop offset="0.28" stop-color="white"/><stop offset="0.55" stop-color="${rgba(effect.tint)}"/><stop offset="0.75" stop-color="white"/><stop offset="1" stop-color="#37474f" stop-opacity="0.35"/></linearGradient>`);
    artwork = `<rect width="100" height="160" fill="url(#${gradientId})" opacity="${round(effect.reflectance)}"/>`;
  } else {
    const particles = createSurfaceEffectParticlesV7(
      effect.seed,
      effect.effectType === 'glitter' ? effect.density : effect.spread,
      effect.effectType === 'glitter' ? 3 : effect.colors.length,
    );
    artwork = particles.map((particle, index) => {
      if (effect.effectType === 'glitter') {
        return `<circle cx="${round(particle.u * SVG_WIDTH)}" cy="${round(particle.v * SVG_HEIGHT)}" r="${round(particle.radius)}" fill="${index % 2 ? '#f4d9ff' : '#ffffff'}" fill-opacity="${round(particle.opacity)}"/>`;
      }
      return `<circle cx="${round(particle.u * SVG_WIDTH)}" cy="${round(particle.v * SVG_HEIGHT)}" r="${round(5 + particle.radius * 4)}" fill="${rgba(effect.colors[particle.colorIndex % effect.colors.length], particle.opacity * 0.5)}"/>`;
    }).join('');
  }
  return { artwork: `<g mask="url(#${maskId})">${artwork}</g>`, fidelity: effect.previewFidelity };
}

export function createSingleNailMaterialProjectionV1(
  nail: NailDesignV7,
  readModel: CustomerNailPreviewReadModelV7,
): SingleNailMaterialProjectionV1 {
  const backgroundStep = nail.steps[0];
  if (backgroundStep?.kind !== 'background') throw new Error(`Invalid V7 background contract for ${nail.finger}`);
  const defs: string[] = [];
  const warnings = new Set<string>();
  const omittedKinds = new Set<'text' | 'image_2d'>();
  const projectedLayerKinds = new Set<SingleNailMaterialProjectionV1['projectedLayerKinds'][number]>(['background']);
  const background = readModel.backgroundColorOverride ?? representativeBackgroundColorV7(backgroundStep.background);
  const backgroundAlpha = backgroundStep.visible
    ? (readModel.backgroundColorOverride ? readModel.backgroundColorOverride.a : background.a * backgroundStep.background.opacity)
    : 1;
  let fidelity: PreviewFidelityV7 = readModel.backgroundColorOverride ? 'exact' : readModel.fidelityByLayer.background;
  const body: string[] = [
    backgroundStep.visible
      ? backgroundArtwork(backgroundStep.background, readModel.backgroundColorOverride, defs)
      : '<rect width="100" height="160" fill="#f5f5f6"/>',
  ];

  nail.steps.slice(1, -1).forEach((step, index) => {
    if (!step.visible || step.skipped) return;
    if (step.kind === 'flat_design') {
      projectedLayerKinds.add('flat_design');
      const result = renderFlatStep(step, index, defs, warnings, omittedKinds);
      body.push(result.artwork);
      if (result.unavailable) fidelity = maxFidelity(fidelity, 'unavailable');
      else if (result.approximate) fidelity = maxFidelity(fidelity, 'approximate');
      return;
    }
    if (step.kind === 'surface_effect') {
      projectedLayerKinds.add('surface_effect');
      const result = renderSurfaceEffect(step, index, defs, warnings);
      body.push(result.artwork);
      fidelity = maxFidelity(fidelity, result.fidelity);
    }
  });

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${MATERIAL_PROJECTION_WIDTH_V1}" height="${MATERIAL_PROJECTION_HEIGHT_V1}" viewBox="0 0 100 160"><defs>${defs.join('')}</defs>${body.join('')}</svg>`;
  return {
    schemaVersion: MATERIAL_PROJECTION_SCHEMA_V1,
    widthPx: MATERIAL_PROJECTION_WIDTH_V1,
    heightPx: MATERIAL_PROJECTION_HEIGHT_V1,
    svg,
    projectionHash: hashStringV1(svg),
    backgroundMode: readModel.backgroundColorOverride ? 'scenario-solid' : backgroundStep.background.mode,
    projectedLayerKinds: [...projectedLayerKinds],
    omittedElementKinds: [...omittedKinds],
    fidelity,
    hasTransparency: backgroundAlpha < 0.999,
    warnings: [...warnings],
  };
}
