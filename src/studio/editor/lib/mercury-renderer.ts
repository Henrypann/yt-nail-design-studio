import type { FingerCode, NailLength, NailShape } from '@/lib/types';
import { createNailSurfaceMapper } from './surface-mapper';
import type { MercuryDewParams, RecipeInstanceV1 } from './recipe-model';
import { mergeMercuryParams } from './recipe-model';

export interface FingerRenderModel {
  recipeRef: RecipeInstanceV1['recipeRef'];
  shape: NailShape;
  length: NailLength;
  finger: FingerCode;
  components: { magneticBeam: boolean; chromeRibbon: boolean; clearDroplets: number };
  warnings: string[];
  svg: string;
}

function beamWidth(width: MercuryDewParams['beamWidth']): number { return width === 'narrow' ? 0.16 : width === 'wide' ? 0.42 : 0.28; }
function beamOpacity(intensity: MercuryDewParams['beamIntensity']): number { return intensity === 'soft' ? 0.3 : intensity === 'strong' ? 0.72 : 0.5; }
function pathD(points: Array<{ x: number; y: number }>): string {
  if (points.length < 2) return '';
  const [first, ...rest] = points;
  return `M ${first.x.toFixed(2)} ${first.y.toFixed(2)} ` + rest.map((p) => `L ${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' ');
}

export function renderMagneticBeam(params: MercuryDewParams, shape: NailShape, length: NailLength, uid: string): string {
  const mapper = createNailSurfaceMapper(shape, length);
  if (!mapper) return '';
  const center = mapper.point({ u: 0.5, v: 0.5 });
  const left = mapper.point({ u: Math.max(0.04, 0.5 - beamWidth(params.beamWidth) / 2), v: 0.5 });
  const right = mapper.point({ u: Math.min(0.96, 0.5 + beamWidth(params.beamWidth) / 2), v: 0.5 });
  const width = Math.max(8, right.x - left.x);
  const angle = params.catEyeAngleDeg;
  return `<defs><linearGradient id="mercury-beam-${uid}" x1="0" y1="0" x2="1" y2="0" gradientTransform="rotate(${angle} ${center.x} ${center.y})"><stop offset="0" stop-color="#FFFFFF" stop-opacity="0"/><stop offset="0.42" stop-color="#FFF7E8" stop-opacity="${beamOpacity(params.beamIntensity)}"/><stop offset="0.5" stop-color="#FFFFFF" stop-opacity="0.92"/><stop offset="0.58" stop-color="#FFF7E8" stop-opacity="${beamOpacity(params.beamIntensity)}"/><stop offset="1" stop-color="#FFFFFF" stop-opacity="0"/></linearGradient></defs><rect x="${left.x - width}" y="-600" width="${width * 3}" height="900" fill="url(#mercury-beam-${uid})" opacity="0.9"/>`;
}

export function renderChromeRibbon(params: MercuryDewParams, shape: NailShape, length: NailLength, uid: string): { svg: string; warnings: string[] } {
  const mapper = createNailSurfaceMapper(shape, length);
  if (!mapper) return { svg: '', warnings: ['甲型轮廓缺失'] };
  const mapped = mapper.path(params.ribbonAnchors, 0.8);
  const d = pathD(mapped.points);
  const color = params.ribbonMaterial === 'silver' ? '#DCE6F0' : '#D8B16E';
  return { warnings: mapped.warnings, svg: `<defs><linearGradient id="mercury-ribbon-${uid}" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#FFFFFF"/><stop offset="0.45" stop-color="${color}"/><stop offset="0.7" stop-color="#FFF7D5"/><stop offset="1" stop-color="#8A5F35"/></linearGradient></defs><path d="${d}" fill="none" stroke="#4C3542" stroke-opacity="0.24" stroke-width="${params.ribbonWidthMm * 5 + 3}" stroke-linecap="round"/><path d="${d}" fill="none" stroke="url(#mercury-ribbon-${uid})" stroke-width="${params.ribbonWidthMm * 5}" stroke-linecap="round"/><path d="${d}" fill="none" stroke="#FFFFFF" stroke-opacity="0.7" stroke-width="1.2" stroke-linecap="round"/>` };
}

export function renderClearDroplet(params: MercuryDewParams, shape: NailShape, length: NailLength, uid: string): { svg: string; warnings: string[]; count: number } {
  const mapper = createNailSurfaceMapper(shape, length);
  if (!mapper || params.dropletDensity === 'off') return { svg: '', warnings: [], count: 0 };
  const warnings: string[] = [];
  const circles = params.droplets.slice(0, 6).map((drop, index) => {
    const safe = mapper.safePoint(drop.uv, 0.8, drop.radiusMm);
    if (safe.warning) warnings.push(safe.warning);
    const id = `${uid}-drop-${index}`;
    return `<defs><radialGradient id="${id}" cx="35%" cy="28%"><stop offset="0" stop-color="#FFFFFF" stop-opacity="0.9"/><stop offset="0.35" stop-color="#E9F4FF" stop-opacity="0.45"/><stop offset="0.82" stop-color="#7E9CB5" stop-opacity="0.28"/><stop offset="1" stop-color="#593F54" stop-opacity="0.42"/></radialGradient></defs><ellipse cx="${safe.point.x.toFixed(2)}" cy="${safe.point.y.toFixed(2)}" rx="${(drop.radiusMm * 2.6).toFixed(2)}" ry="${(drop.radiusMm * 1.8).toFixed(2)}" fill="url(#${id})" stroke="#FFFFFF" stroke-opacity="0.5" stroke-width="1"/><ellipse cx="${(safe.point.x - drop.radiusMm * 0.7).toFixed(2)}" cy="${(safe.point.y - drop.radiusMm * 0.6).toFixed(2)}" rx="${(drop.radiusMm * 0.35).toFixed(2)}" ry="${(drop.radiusMm * 0.2).toFixed(2)}" fill="#FFFFFF" fill-opacity="0.86"/>`;
  }).join('');
  return { svg: circles, warnings, count: Math.min(6, params.droplets.length) };
}

export function compileRecipeToFingerRenderModel(recipe: RecipeInstanceV1, context: { shape: NailShape; length: NailLength; finger: FingerCode }): FingerRenderModel {
  const params = mergeMercuryParams(recipe, context.finger);
  const beam = renderMagneticBeam(params, context.shape, context.length, `m-${context.finger}`);
  const ribbon = renderChromeRibbon(params, context.shape, context.length, `m-${context.finger}`);
  const drops = renderClearDroplet(params, context.shape, context.length, `m-${context.finger}`);
  return {
    recipeRef: recipe.recipeRef,
    shape: context.shape,
    length: context.length,
    finger: context.finger,
    components: { magneticBeam: true, chromeRibbon: Boolean(ribbon.svg), clearDroplets: drops.count },
    warnings: [...ribbon.warnings, ...drops.warnings],
    svg: `${beam}${ribbon.svg}${drops.svg}`,
  };
}
