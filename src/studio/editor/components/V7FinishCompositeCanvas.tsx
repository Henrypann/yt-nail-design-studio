import { Fragment, type ReactNode } from 'react';
import { Box, Info, Layers3, Sparkles } from 'lucide-react';
import { cx } from '@/design-system';
import { selectCurrentNailV7, selectCurrentStepV7, useEditorV7Store } from '../store-v7';
import {
  createGlitterPreviewParticlesV7,
  normalizeBackgroundDirectionV7,
  resolveBackgroundSilhouetteV7,
  rgbaToHexV7,
} from '../v7/background';
import { dimensionalDecorationFidelityV7, dimensionalDecorationPathToCanvasV7, dimensionalDecorationShadowOffsetV7 } from '../v7/dimensional-decoration';
import { deriveFinishCompositeV7 } from '../v7/finish-composite';
import { SURFACE_FINISH_LABELS_V7 } from '../v7/finish';
import type { DimensionalDecorationV7, FlatDesignElementV7, ProcessStepV7, Transform2DV7 } from '../v7/model';
import { createSurfaceEffectParticlesV7, rgbaCssV7, surfaceEffectMaskPathToCanvasV7 } from '../v7/surface-effect';
import { combineGeometryPreviewFidelityV7 } from '../v7/geometry-registry';

const WIDTH = 100;
const HEIGHT = 160;

function silhouetteTransform(viewBox: string): string {
  const values = viewBox.trim().split(/[\s,]+/).map(Number);
  if (values.length !== 4 || values.some((value) => !Number.isFinite(value)) || values[2] <= 0 || values[3] <= 0) return '';
  return `scale(${WIDTH / values[2]} ${HEIGHT / values[3]}) translate(${-values[0]} ${-values[1]})`;
}

function transformNode(transform: Transform2DV7, node: ReactNode): ReactNode {
  return <g transform={`translate(${transform.position.u * WIDTH} ${transform.position.v * HEIGHT}) rotate(${transform.rotationDeg}) scale(${transform.scaleX} ${transform.scaleY}) translate(${-WIDTH / 2} ${-HEIGHT / 2})`}>{node}</g>;
}

function rgba(color: { r: number; g: number; b: number; a: number }, opacity = 1): string {
  return `rgb(${color.r} ${color.g} ${color.b} / ${color.a * opacity})`;
}

function renderFlatElement(element: FlatDesignElementV7): ReactNode {
  if (!element.visible || element.kind === 'eraser_mask' || element.kind === 'region_mask') return null;
  if (element.kind === 'brush_stroke') return transformNode(element.transform, <polyline points={element.points.map((point) => `${point.u * WIDTH},${point.v * HEIGHT}`).join(' ')} fill="none" stroke={rgba(element.color, element.opacity)} strokeWidth={Math.max(0.8, element.widthMm * 7)} strokeLinecap="round" strokeLinejoin="round" />);
  if (element.kind === 'vector_shape') return transformNode(element.transform, <path d={dimensionalDecorationPathToCanvasV7(element.pathData) ?? ''} fill={element.fill ? rgba(element.fill, element.opacity) : 'none'} stroke={element.stroke ? rgba(element.stroke, element.opacity) : 'none'} strokeWidth={Math.max(0.6, (element.strokeWidthMm ?? 0) * 7)} />);
  if (element.kind === 'french_edge') {
    const edge = Math.min(0.95, Math.max(0, element.widthRatio));
    return transformNode(element.transform, <path d={`M0 0 L${WIDTH} 0 L${WIDTH} ${edge * HEIGHT} Q${WIDTH / 2} ${(edge + element.curvature * 0.18) * HEIGHT} 0 ${edge * HEIGHT} Z`} fill={rgba(element.color, element.opacity)} />);
  }
  if (element.kind === 'text') return transformNode(element.transform, <text x="50" y="82" textAnchor="middle" dominantBaseline="middle" fontSize={Math.max(5, element.fontSizeMm * 6)} fill={rgba(element.color, element.opacity)}>{element.text.slice(0, 18)}</text>);
  if (element.kind === 'image_2d') return transformNode(element.transform, <g opacity={element.opacity}><rect x="32" y="58" width="36" height="44" rx="7" fill="#fff" fillOpacity="0.52" stroke="#b9879a" strokeDasharray="3 2" /><path d="M38 94 L48 81 L55 88 L62 74" fill="none" stroke="#b9879a" strokeWidth="2" /></g>);
  return null;
}

function renderEffectStep(step: Extract<ProcessStepV7, { kind: 'surface_effect' }>, key: string): ReactNode {
  const effect = step.effect;
  const maskPath = surfaceEffectMaskPathToCanvasV7(step.mask.pathData);
  if (!maskPath) return null;
  if (effect.previewFidelity === 'unavailable') return <path d={maskPath} fill="none" stroke="#8f6877" strokeWidth="1.2" strokeDasharray="4 3" />;
  const maskId = `${key}-mask`;
  const gradientId = `${key}-gradient`;
  const particles = effect.effectType === 'glitter'
    ? createSurfaceEffectParticlesV7(effect.seed, effect.density, 3)
    : effect.effectType === 'ink_bloom'
      ? createSurfaceEffectParticlesV7(effect.seed, effect.spread, effect.colors.length)
      : [];
  let artwork: ReactNode;
  if (effect.effectType === 'cat_eye') artwork = <rect x="-20" width="140" height={HEIGHT} fill={`url(#${gradientId})`} transform={`rotate(${effect.directionDeg} 50 80)`} opacity={effect.intensity} />;
  else if (effect.effectType === 'mirror') artwork = <rect width={WIDTH} height={HEIGHT} fill={`url(#${gradientId})`} opacity={effect.reflectance} />;
  else if (effect.effectType === 'glitter') artwork = particles.map((particle, index) => <circle key={index} cx={particle.u * WIDTH} cy={particle.v * HEIGHT} r={particle.radius} fill={index % 2 ? '#f4d9ff' : '#ffffff'} fillOpacity={particle.opacity} />);
  else {
    const colors = effect.colors;
    artwork = particles.map((particle, index) => <circle key={index} cx={particle.u * WIDTH} cy={particle.v * HEIGHT} r={5 + particle.radius * 4} fill={rgbaCssV7(colors[particle.colorIndex % colors.length], particle.opacity * 0.5)} />);
  }
  return <Fragment><defs><mask id={maskId}><rect width={WIDTH} height={HEIGHT} fill={step.mask.inverted ? 'white' : 'black'} /><path d={maskPath} fill={step.mask.inverted ? 'black' : 'white'} fillRule={step.mask.fillRule} /></mask>{effect.effectType === 'cat_eye' && <linearGradient id={gradientId}><stop stopColor="#fff" stopOpacity="0" /><stop offset=".5" stopColor="#fff" stopOpacity=".95" /><stop offset="1" stopColor="#fff" stopOpacity="0" /></linearGradient>}{effect.effectType === 'mirror' && <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#233" stopOpacity=".35" /><stop offset=".28" stopColor="#fff" /><stop offset=".55" stopColor={rgbaCssV7(effect.tint)} /><stop offset=".75" stopColor="#fff" /><stop offset="1" stopColor="#344" stopOpacity=".35" /></linearGradient>}</defs><g mask={`url(#${maskId})`}>{artwork}</g></Fragment>;
}

function renderDecoration(decoration: DimensionalDecorationV7): ReactNode {
  if (!decoration.visible) return null;
  const path = decoration.kind === 'relief_2_5d'
    ? dimensionalDecorationPathToCanvasV7(decoration.outline.pathData)
    : 'M28 75 C40 58 60 58 72 75 C61 78 58 91 50 103 C42 91 39 78 28 75 Z';
  if (!path) return null;
  const unavailable = dimensionalDecorationFidelityV7(decoration) === 'unavailable';
  const shadow = dimensionalDecorationShadowOffsetV7(decoration.heightMm);
  return transformNode(decoration.transform, <><path d={path} transform={`translate(${shadow} ${shadow})`} fill="#34232d" fillOpacity=".16" /><path d={path} fill={decoration.kind === 'attachment_3d' ? '#dbc79f' : '#e9bad0'} fillOpacity={unavailable ? 0.2 : 0.85} stroke="#fff" strokeWidth="1" strokeDasharray={unavailable ? '4 3' : undefined} /></>);
}

export function V7FinishCompositeCanvas() {
  const nail = useEditorV7Store(selectCurrentNailV7);
  const step = useEditorV7Store(selectCurrentStepV7);
  const previewFinishType = useEditorV7Store((state) => state.previewFinishType);
  if (!nail || step?.kind !== 'surface_finish') return null;
  const silhouette = resolveBackgroundSilhouetteV7(nail.geometryRef, nail.finger);
  const model = deriveFinishCompositeV7(nail, previewFinishType);
  const background = nail.steps[0];
  if (background.kind !== 'background') return null;
  const rawId = `v7-finish-${nail.finger}-${step.id.replace(/[^A-Za-z0-9_-]/g, '-')}`;
  const clipId = `${rawId}-clip`;
  const backgroundGradientId = `${rawId}-background`;
  const catEyeId = `${rawId}-cat-eye`;
  const finishSheenId = `${rawId}-sheen`;
  const frostedPatternId = `${rawId}-frosted`;
  const particles = background.background.mode === 'glitter' ? createGlitterPreviewParticlesV7(background.background.seed, background.background.density, background.background.colors.length) : [];

  const backgroundArtwork = () => {
    const payload = background.background;
    if (!background.visible) return <rect width={WIDTH} height={HEIGHT} fill="#f6ebe7" />;
    if (payload.mode === 'gradient') return <rect width={WIDTH} height={HEIGHT} fill={`url(#${backgroundGradientId})`} fillOpacity={payload.opacity} />;
    if (payload.mode === 'cat_eye') return <><rect width={WIDTH} height={HEIGHT} fill={rgbaToHexV7(payload.color)} fillOpacity={payload.opacity * payload.color.a} /><rect width={WIDTH} height={HEIGHT} fill={`url(#${catEyeId})`} /></>;
    if (payload.mode === 'glitter') return <><rect width={WIDTH} height={HEIGHT} fill={rgbaToHexV7(payload.colors[0])} fillOpacity={payload.opacity * 0.34} />{particles.map((particle, index) => <circle key={index} cx={particle.u * WIDTH} cy={particle.v * HEIGHT} r={particle.size} fill={rgbaToHexV7(payload.colors[particle.colorIndex % payload.colors.length])} fillOpacity={particle.opacity * payload.opacity} />)}</>;
    return <rect width={WIDTH} height={HEIGHT} fill={rgbaToHexV7(payload.color)} fillOpacity={payload.opacity * payload.color.a} />;
  };
  const finishOverlay = model.previewFinishType === 'gloss'
    ? <rect width={WIDTH} height={HEIGHT} fill={`url(#${finishSheenId})`} opacity={model.finishAppearance.sheenOpacity} />
    : model.previewFinishType === 'matte'
      ? <rect width={WIDTH} height={HEIGHT} fill="#f8eee9" opacity={model.finishAppearance.veilOpacity} />
      : <><rect width={WIDTH} height={HEIGHT} fill="#f6efec" opacity={model.finishAppearance.veilOpacity} /><rect width={WIDTH} height={HEIGHT} fill={`url(#${frostedPatternId})`} opacity={model.finishAppearance.grainOpacity} /></>;
  const middleSteps = nail.steps.slice(1, -1).filter((candidate) => candidate.visible && !candidate.skipped);
  const previewFidelity = combineGeometryPreviewFidelityV7(silhouette.fidelity, model.fidelity);
  const fidelityTone = previewFidelity === 'exact' ? 'border-success/25 bg-success-soft text-success' : previewFidelity === 'approximate' ? 'border-warning/25 bg-warning-soft text-warning' : 'border-gray-300 bg-gray-100 text-gray-600';

  return (
    <div className="grid min-w-0 gap-4 sm:grid-cols-[minmax(190px,0.9fr)_minmax(210px,1fr)] sm:items-center" data-testid="v7-finish-composite-canvas" data-preview-finish={model.previewFinishType} data-canonical-finish={model.canonicalFinishType} data-preview-only={String(model.previewOnly)} data-preview-fidelity={previewFidelity} data-active-step-count={model.activeStepIds.length}>
      <div className="relative mx-auto aspect-[5/8] w-full max-w-[260px] rounded-[32px] border border-white bg-white/80 p-3 shadow-[0_26px_70px_rgba(77,53,67,0.2)]" style={{ transform: 'perspective(900px) rotateX(5deg) rotateY(-4deg)' }}>
        <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="h-full w-full overflow-visible" role="img" aria-label={`${nail.finger} ${SURFACE_FINISH_LABELS_V7[model.previewFinishType]}组合模拟预览`}>
          <defs>
            <clipPath id={clipId}><path d={silhouette.pathD} transform={silhouetteTransform(silhouette.viewBox)} /></clipPath>
            {background.background.mode === 'gradient' && <linearGradient id={backgroundGradientId} gradientTransform={`rotate(${normalizeBackgroundDirectionV7(background.background.directionDeg)} .5 .5)`}>{background.background.stops.map((stop, index) => <stop key={index} offset={stop.offset} stopColor={rgbaToHexV7(stop.color)} stopOpacity={stop.color.a} />)}</linearGradient>}
            {background.background.mode === 'cat_eye' && <linearGradient id={catEyeId} gradientTransform={`rotate(${normalizeBackgroundDirectionV7(background.background.directionDeg)} .5 .5)`}><stop stopColor="#fff" stopOpacity="0" /><stop offset=".5" stopColor="#fff" stopOpacity={background.background.intensity * 0.82} /><stop offset="1" stopColor="#fff" stopOpacity="0" /></linearGradient>}
            <linearGradient id={finishSheenId} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#fff" stopOpacity="0" /><stop offset=".38" stopColor="#fff" stopOpacity=".08" /><stop offset=".5" stopColor="#fff" /><stop offset=".62" stopColor="#fff" stopOpacity=".08" /><stop offset="1" stopColor="#fff" stopOpacity="0" /></linearGradient>
            <pattern id={frostedPatternId} width="7" height="7" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r=".7" fill="#fff" /><circle cx="5" cy="4" r=".5" fill="#a9919b" /></pattern>
          </defs>
          <g clipPath={`url(#${clipId})`}>
            {backgroundArtwork()}
            {middleSteps.map((candidate, stepIndex) => <g key={candidate.id} data-composite-step-kind={candidate.kind}>{candidate.kind === 'flat_design' ? candidate.elements.map((element) => <Fragment key={element.id}>{renderFlatElement(element)}</Fragment>) : candidate.kind === 'surface_effect' ? renderEffectStep(candidate, `${rawId}-${stepIndex}`) : candidate.kind === 'dimensional_decoration' ? candidate.decorations.map((decoration) => <Fragment key={decoration.id}>{renderDecoration(decoration)}</Fragment>) : null}</g>)}
            {finishOverlay}
            <path d={silhouette.pathD} transform={silhouetteTransform(silhouette.viewBox)} fill="none" stroke="rgb(255 255 255 / .74)" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
          </g>
        </svg>
      </div>
      <div className="min-w-0 rounded-3xl border border-gray-200 bg-white/92 p-4 shadow-sm">
        <div className="flex items-center gap-2"><Sparkles size={17} className="text-primary" /><p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">Simulated 3D · SVG 2.5D</p></div>
        <h2 className="mt-2 text-lg font-semibold text-gray-900">{SURFACE_FINISH_LABELS_V7[model.previewFinishType]}组合预览</h2>
        <div className="mt-3 flex flex-wrap gap-2"><span className={cx('inline-flex rounded-full border px-2.5 py-1 text-[10px] font-semibold', fidelityTone)}>{previewFidelity === 'unavailable' ? '部分不可表达 · 2D 保底' : '近似组合预览'}</span>{model.previewOnly && <span className="rounded-full bg-violet-100 px-2.5 py-1 text-[10px] font-semibold text-violet-700">仅预览 · 未应用</span>}</div>
        {silhouette.fidelity !== 'exact' && <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[10px] leading-4 text-amber-900">甲型轮廓为{silhouette.fidelity === 'approximate' ? '生成近似' : '通用回退'}，最终组合预览已相应降级。</p>}
        <div className="mt-4 grid grid-cols-5 gap-1 text-center text-[9px] text-gray-500"><span><Layers3 size={13} className="mx-auto mb-1" />背景<br />{model.layerCounts.background}</span><span>2D<br />{model.layerCounts.flat}</span><span><Sparkles size={13} className="mx-auto mb-1" />效果<br />{model.layerCounts.surface}</span><span><Box size={13} className="mx-auto mb-1" />立体<br />{model.layerCounts.dimensional}</span><span>封层<br />{model.layerCounts.finish}</span></div>
        {model.warnings.length > 0 && <div className="mt-4 space-y-1 text-[10px] leading-4 text-gray-500">{model.warnings.map((warning) => <p key={warning}>• {warning}</p>)}</div>}
        <div className="mt-4 rounded-2xl border border-info/20 bg-info-soft p-3 text-xs leading-5 text-info"><Info size={14} className="mb-1" />这是 WebGL-free 模拟组合预览，未证明真实 3D、材料外观、UV/LED 固化状态或物理可制造性。</div>
      </div>
    </div>
  );
}
