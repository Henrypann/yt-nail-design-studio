import { Fragment, useId, type ReactNode } from 'react';
import { cx } from '@/design-system';
import {
  createGlitterPreviewParticlesV7,
  representativeBackgroundColorV7,
  resolveBackgroundSilhouetteV7,
} from '../v7/background';
import {
  dimensionalDecorationFidelityV7,
  dimensionalDecorationPathToCanvasV7,
  dimensionalDecorationShadowOffsetV7,
} from '../v7/dimensional-decoration';
import { surfaceFinishPreviewAppearanceV7 } from '../v7/finish';
import type {
  BackgroundPayloadV7,
  DimensionalDecorationV7,
  FlatDesignElementV7,
  NailDesignV7,
  NailPointV7,
  ProcessStepV7,
  RegionMaskV7,
  RgbaColorV7,
  Transform2DV7,
} from '../v7/model';
import { parseNailPathDataV7, resolveFlatElementMaskScopeV7 } from '../v7/flat-vector';
import type { CustomerNailPreviewReadModelV7 } from '../v7/customer-preview';
import {
  createSurfaceEffectParticlesV7,
  normalizeSurfaceEffectDirectionV7,
  rgbaCssV7,
  surfaceEffectMaskPathToCanvasV7,
} from '../v7/surface-effect';
import { FlatContentArtworkV7 } from './FlatContentArtworkV7';

const CANVAS_WIDTH = 100;
const CANVAS_HEIGHT = 160;
const MM_TO_CANVAS_UNITS = 8;
type FlatStepV7 = Extract<ProcessStepV7, { kind: 'flat_design' }>;

const FIDELITY_LABEL = {
  exact: '已签收 2D 轮廓',
  approximate: '含近似预览',
  unavailable: '预览不可用',
} as const;

const FIDELITY_SHORT_LABEL = {
  exact: '已签收',
  approximate: '近似',
  unavailable: '注意',
} as const;

function rgba(color: RgbaColorV7, opacity = 1): string {
  return `rgb(${color.r} ${color.g} ${color.b} / ${Math.min(1, Math.max(0, color.a * opacity))})`;
}

function canvasPolyline(points: readonly NailPointV7[]): string {
  return points.map((point) => `${point.u * CANVAS_WIDTH},${point.v * CANVAS_HEIGHT}`).join(' ');
}

function canvasPath(pathData: string): string {
  const parsed = parseNailPathDataV7(pathData);
  if (!parsed) return '';
  return parsed.commands.map(({ command, values }) => {
    const scaled = values.map((value, index) => value * (index % 2 === 0 ? CANVAS_WIDTH : CANVAS_HEIGHT));
    return scaled.length > 0 ? `${command}${scaled.join(' ')}` : command;
  }).join(' ');
}

function silhouetteToCanvasTransform(viewBox: string): string {
  const values = viewBox.trim().split(/[\s,]+/).map(Number);
  if (values.length !== 4 || values.some((value) => !Number.isFinite(value)) || values[2] <= 0 || values[3] <= 0) return '';
  const [x, y, width, height] = values;
  return `scale(${CANVAS_WIDTH / width} ${CANVAS_HEIGHT / height}) translate(${-x} ${-y})`;
}

function transformedElement(element: { transform: Transform2DV7 }, child: ReactNode): ReactNode {
  const { position, scaleX, scaleY, rotationDeg } = element.transform;
  return (
    <g transform={`translate(${position.u * CANVAS_WIDTH} ${position.v * CANVAS_HEIGHT}) rotate(${rotationDeg}) scale(${scaleX} ${scaleY}) translate(${-CANVAS_WIDTH / 2} ${-CANVAS_HEIGHT / 2})`}>
      {child}
    </g>
  );
}

function renderElement(element: FlatDesignElementV7, instanceId: string): ReactNode {
  if (!element.visible || element.kind === 'eraser_mask' || element.kind === 'region_mask') return null;
  if (element.kind === 'brush_stroke') {
    return transformedElement(element, <polyline points={canvasPolyline(element.points)} fill="none" stroke={rgba(element.color, element.opacity)} strokeWidth={element.widthMm * MM_TO_CANVAS_UNITS} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />);
  }
  if (element.kind === 'vector_shape') {
    return transformedElement(element, <path d={canvasPath(element.pathData)} fill={element.fill ? rgba(element.fill, element.opacity) : 'none'} stroke={element.stroke ? rgba(element.stroke, element.opacity) : 'none'} strokeWidth={(element.strokeWidthMm ?? 0) * MM_TO_CANVAS_UNITS} vectorEffect="non-scaling-stroke" />);
  }
  if (element.kind === 'french_edge') {
    const edge = Math.min(0.95, Math.max(0, element.widthRatio));
    const control = Math.min(1, Math.max(0, edge + element.curvature * 0.18));
    return transformedElement(element, <path d={`M0 0 L${CANVAS_WIDTH} 0 L${CANVAS_WIDTH} ${edge * CANVAS_HEIGHT} Q${CANVAS_WIDTH / 2} ${control * CANVAS_HEIGHT} 0 ${edge * CANVAS_HEIGHT} Z`} fill={rgba(element.color, element.opacity)} />);
  }
  if (element.kind === 'text' || element.kind === 'image_2d') {
    return transformedElement(element, <FlatContentArtworkV7 element={element} instanceId={instanceId} />);
  }
  return null;
}

function MaskShape({ mask, tone }: { mask: RegionMaskV7; tone: string }) {
  return <path d={canvasPath(mask.pathData)} fill={tone} fillRule={mask.fillRule} />;
}

function gradientVector(directionDeg: number) {
  const radians = directionDeg * Math.PI / 180;
  const dx = Math.cos(radians) * 70;
  const dy = Math.sin(radians) * 100;
  return { x1: 50 - dx, y1: 80 - dy, x2: 50 + dx, y2: 80 + dy };
}

function BackgroundDefs({ background, rawId }: { background: BackgroundPayloadV7; rawId: string }) {
  if (background.mode === 'gradient') {
    const vector = gradientVector(background.directionDeg);
    return <linearGradient id={`${rawId}-background`} gradientUnits="userSpaceOnUse" {...vector}>{background.stops.map((stop) => <stop key={stop.offset} offset={stop.offset} stopColor={rgba(stop.color, background.opacity)} />)}</linearGradient>;
  }
  if (background.mode === 'cat_eye') {
    const vector = gradientVector(background.directionDeg);
    return <linearGradient id={`${rawId}-background`} gradientUnits="userSpaceOnUse" {...vector}><stop offset="0" stopColor={rgba(background.color, background.opacity * 0.55)} /><stop offset={Math.max(0.15, 0.5 - background.bandWidth)} stopColor={rgba(background.color, background.opacity * 0.7)} /><stop offset="0.5" stopColor={`rgb(255 255 255 / ${0.25 + background.intensity * 0.55})`} /><stop offset={Math.min(0.85, 0.5 + background.bandWidth)} stopColor={rgba(background.color, background.opacity * 0.7)} /><stop offset="1" stopColor={rgba(background.color, background.opacity * 0.55)} /></linearGradient>;
  }
  return null;
}

function BackgroundArtwork({ background, override, rawId }: { background: BackgroundPayloadV7; override: RgbaColorV7 | null; rawId: string }) {
  if (override) return <rect width="100" height="160" fill={rgba(override)} />;
  if (background.mode === 'gradient' || background.mode === 'cat_eye') return <rect width="100" height="160" fill={`url(#${rawId}-background)`} />;
  if (background.mode === 'glitter') {
    const base = representativeBackgroundColorV7(background);
    const particles = createGlitterPreviewParticlesV7(background.seed, background.density, background.colors.length);
    return <><rect width="100" height="160" fill={rgba(base, background.opacity)} />{particles.map((particle, index) => <circle key={`${index}-${particle.u}`} cx={particle.u * 100} cy={particle.v * 160} r={particle.size} fill={rgba(background.colors[particle.colorIndex], particle.opacity)} />)}</>;
  }
  return <rect width="100" height="160" fill={rgba(background.color, background.opacity)} />;
}

function FinishOverlay({ finishType, rawId }: { finishType: CustomerNailPreviewReadModelV7['finishType']; rawId: string }) {
  const appearance = surfaceFinishPreviewAppearanceV7(finishType);
  if (finishType === 'gloss') return <rect width="100" height="160" fill={`url(#${rawId}-gloss)`} opacity={appearance.sheenOpacity} />;
  if (finishType === 'matte') return <rect width="100" height="160" fill="rgb(255 248 246)" opacity={appearance.veilOpacity} />;
  return <><rect width="100" height="160" fill="rgb(255 248 246)" opacity={appearance.veilOpacity} /><rect width="100" height="160" fill={`url(#${rawId}-frosted)`} opacity={appearance.grainOpacity} /></>;
}

function renderSurfaceEffect(step: Extract<ProcessStepV7, { kind: 'surface_effect' }>, rawId: string): ReactNode {
  const maskPath = surfaceEffectMaskPathToCanvasV7(step.mask.pathData);
  if (!maskPath) return null;
  if (step.effect.previewFidelity === 'unavailable') return <path d={maskPath} fill="none" stroke="#8f6877" strokeWidth="1.2" strokeDasharray="4 3" />;
  const maskId = `${rawId}-mask`;
  const gradientId = `${rawId}-gradient`;
  const effect = step.effect;
  const particles = effect.effectType === 'glitter'
    ? createSurfaceEffectParticlesV7(effect.seed, effect.density, 3)
    : effect.effectType === 'ink_bloom'
      ? createSurfaceEffectParticlesV7(effect.seed, effect.spread, effect.colors.length)
      : [];
  const artwork = effect.effectType === 'cat_eye'
    ? <rect x="-20" width="140" height="160" fill={`url(#${gradientId})`} transform={`rotate(${normalizeSurfaceEffectDirectionV7(effect.directionDeg)} 50 80)`} opacity={effect.intensity} />
    : effect.effectType === 'mirror'
      ? <rect width="100" height="160" fill={`url(#${gradientId})`} opacity={effect.reflectance} />
      : effect.effectType === 'glitter'
        ? particles.map((particle, index) => <circle key={index} cx={particle.u * 100} cy={particle.v * 160} r={particle.radius} fill={index % 2 ? '#f4d9ff' : '#ffffff'} fillOpacity={particle.opacity} />)
        : particles.map((particle, index) => <circle key={index} cx={particle.u * 100} cy={particle.v * 160} r={5 + particle.radius * 4} fill={rgbaCssV7(effect.colors[particle.colorIndex % effect.colors.length], particle.opacity * 0.5)} />);
  return <Fragment><defs><mask id={maskId}><rect width="100" height="160" fill={step.mask.inverted ? 'white' : 'black'} /><path d={maskPath} fill={step.mask.inverted ? 'black' : 'white'} fillRule={step.mask.fillRule} /></mask>{effect.effectType === 'cat_eye' && <linearGradient id={gradientId}><stop stopColor="#fff" stopOpacity="0" /><stop offset=".5" stopColor="#fff" stopOpacity=".95" /><stop offset="1" stopColor="#fff" stopOpacity="0" /></linearGradient>}{effect.effectType === 'mirror' && <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#233" stopOpacity=".35" /><stop offset=".28" stopColor="#fff" /><stop offset=".55" stopColor={rgbaCssV7(effect.tint)} /><stop offset=".75" stopColor="#fff" /><stop offset="1" stopColor="#344" stopOpacity=".35" /></linearGradient>}</defs><g mask={`url(#${maskId})`}>{artwork}</g></Fragment>;
}

function renderDecoration(decoration: DimensionalDecorationV7): ReactNode {
  if (!decoration.visible) return null;
  const path = decoration.kind === 'relief_2_5d'
    ? dimensionalDecorationPathToCanvasV7(decoration.outline.pathData)
    : 'M28 75 C40 58 60 58 72 75 C61 78 58 91 50 103 C42 91 39 78 28 75 Z';
  if (!path) return null;
  const unavailable = dimensionalDecorationFidelityV7(decoration) === 'unavailable';
  const shadow = dimensionalDecorationShadowOffsetV7(decoration.heightMm);
  return transformedElement(decoration, <><path d={path} transform={`translate(${shadow} ${shadow})`} fill="#34232d" fillOpacity=".16" /><path d={path} fill={decoration.kind === 'attachment_3d' ? '#dbc79f' : '#e9bad0'} fillOpacity={unavailable ? 0.2 : 0.85} stroke="#fff" strokeWidth="1" strokeDasharray={unavailable ? '4 3' : undefined} /></>);
}

export function CustomerNailPreviewV7({
  nail,
  readModel,
  selected = false,
  size = 'overview',
  presentation = '2d',
}: {
  nail: NailDesignV7;
  readModel: CustomerNailPreviewReadModelV7;
  selected?: boolean;
  size?: 'overview' | 'focus';
  presentation?: '2d' | 'composite';
}) {
  const rawId = useId().replace(/:/g, '');
  const silhouette = resolveBackgroundSilhouetteV7(nail.geometryRef, nail.finger);
  const silhouetteTransform = silhouetteToCanvasTransform(silhouette.viewBox);
  const backgroundStep = nail.steps[0];
  if (backgroundStep.kind !== 'background') return null;
  const flatSteps = nail.steps.filter((step): step is FlatStepV7 => step.kind === 'flat_design' && step.visible && !step.skipped);
  const activeMiddle = nail.steps.slice(1, -1).filter((step) => step.visible && !step.skipped);
  const flatStepIndex = new Map(flatSteps.map((step, index) => [step.id, index]));

  const renderStepElements = (step: FlatStepV7, stepIndex: number) => {
    const stepMaskId = `${rawId}-step-${stepIndex}`;
    const renderWithOrderedMasks = (element: FlatDesignElementV7, index: number) => {
      let node = renderElement(element, `${rawId}-${stepIndex}-${index}`);
      if (!node) return null;
      const scope = resolveFlatElementMaskScopeV7(step, index);
      scope.regionMaskIds.forEach((id, maskIndex) => {
        node = <g key={`${id}-wrap`} mask={`url(#${rawId}-region-${stepIndex}-${index}-${maskIndex})`}>{node}</g>;
      });
      if (scope.stepMask) node = <g mask={`url(#${stepMaskId})`}>{node}</g>;
      if (scope.eraserMaskIds.length > 0) node = <g mask={`url(#${rawId}-eraser-${stepIndex}-${index})`}>{node}</g>;
      return <g key={element.id}>{node}</g>;
    };
    return step.elements.map(renderWithOrderedMasks);
  };

  return (
    <div className={cx('relative flex flex-col items-center', size === 'focus' ? 'gap-4' : 'gap-2')} data-testid="customer-nail-preview" data-finger={nail.finger} data-fidelity={readModel.fidelity} data-presentation={presentation}>
      <div className={cx('relative aspect-[5/8] w-full overflow-hidden rounded-[28px] border bg-white shadow-[0_18px_50px_rgba(77,53,67,0.12)]', selected ? 'border-primary ring-2 ring-primary/20' : 'border-white', presentation === 'composite' && 'shadow-[0_24px_60px_rgba(77,53,67,0.2)]', size === 'focus' ? 'max-w-[300px] p-3' : 'max-w-[150px] p-2')} style={presentation === 'composite' ? { transform: 'perspective(900px) rotateX(4deg) rotateY(-3deg)' } : undefined}>
        <svg viewBox="0 0 100 160" className="h-full w-full" role="img" aria-label={`${nail.finger} 顾客${presentation === 'composite' ? '模拟 3D 组合' : ' 2D'}预览`}>
          <defs>
            <clipPath id={`${rawId}-geometry`} clipPathUnits="userSpaceOnUse"><path d={silhouette.pathD} transform={silhouetteTransform} /></clipPath>
            <BackgroundDefs background={backgroundStep.background} rawId={rawId} />
            <linearGradient id={`${rawId}-gloss`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="white" stopOpacity="0.65" /><stop offset="0.28" stopColor="white" stopOpacity="0.08" /><stop offset="0.65" stopColor="white" stopOpacity="0" /></linearGradient>
            <pattern id={`${rawId}-frosted`} width="4" height="4" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r="0.55" fill="white" /><circle cx="3" cy="3" r="0.35" fill="#d9d4d2" /></pattern>
            {flatSteps.map((step, stepIndex) => <Fragment key={`${step.id}-defs`}>
              {step.mask && <mask id={`${rawId}-step-${stepIndex}`} maskUnits="userSpaceOnUse" maskContentUnits="userSpaceOnUse" x="0" y="0" width="100" height="160"><rect width="100" height="160" fill={step.mask.inverted ? 'white' : 'black'} /><MaskShape mask={step.mask} tone={step.mask.inverted ? 'black' : 'white'} /></mask>}
              {step.elements.map((element, index) => {
                if (element.kind === 'eraser_mask' || element.kind === 'region_mask') return null;
                const scope = resolveFlatElementMaskScopeV7(step, index);
                const erasers = scope.eraserMaskIds.map((id) => step.elements.find((item): item is Extract<FlatDesignElementV7, { kind: 'eraser_mask' }> => item.id === id && item.kind === 'eraser_mask')).filter((item): item is Extract<FlatDesignElementV7, { kind: 'eraser_mask' }> => Boolean(item));
                const regions = scope.regionMaskIds.map((id) => step.elements.find((item): item is Extract<FlatDesignElementV7, { kind: 'region_mask' }> => item.id === id && item.kind === 'region_mask')).filter((item): item is Extract<FlatDesignElementV7, { kind: 'region_mask' }> => Boolean(item));
                return <Fragment key={`${element.id}-masks`}>
                  {erasers.length > 0 && <mask id={`${rawId}-eraser-${stepIndex}-${index}`} maskUnits="userSpaceOnUse" maskContentUnits="userSpaceOnUse" x="0" y="0" width="100" height="160"><rect width="100" height="160" fill="white" />{erasers.map((eraser) => <g key={eraser.id}>{transformedElement(eraser, <polyline points={canvasPolyline(eraser.path)} fill="none" stroke="black" strokeOpacity={eraser.opacity} strokeWidth={eraser.widthMm * MM_TO_CANVAS_UNITS} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />)}</g>)}</mask>}
                  {regions.map((region, maskIndex) => <mask key={region.id} id={`${rawId}-region-${stepIndex}-${index}-${maskIndex}`} maskUnits="userSpaceOnUse" maskContentUnits="userSpaceOnUse" x="0" y="0" width="100" height="160"><rect width="100" height="160" fill="white" opacity={region.mask.inverted ? 1 : 1 - region.opacity} />{transformedElement(region, <path d={canvasPath(region.mask.pathData)} fill={region.mask.inverted ? 'black' : 'white'} fillOpacity={region.mask.inverted ? region.opacity : 1} fillRule={region.mask.fillRule} />)}</mask>)}
                </Fragment>;
              })}
            </Fragment>)}
          </defs>
          <g clipPath={`url(#${rawId}-geometry)`}>
            <rect width="100" height="160" fill="#f5f5f6" />
            {backgroundStep.visible && <BackgroundArtwork background={backgroundStep.background} override={readModel.backgroundColorOverride} rawId={rawId} />}
            {presentation === '2d'
              ? flatSteps.map((step, index) => <g key={step.id} data-preview-step-kind={step.kind} data-preview-step-order={index}>{renderStepElements(step, index)}</g>)
              : activeMiddle.map((step, index) => step.kind === 'flat_design'
                ? <g key={step.id} data-preview-step-kind={step.kind} data-preview-step-order={index}>{renderStepElements(step, flatStepIndex.get(step.id) ?? 0)}</g>
                : step.kind === 'surface_effect'
                  ? <g key={step.id} data-preview-step-kind={step.kind} data-preview-step-order={index}>{renderSurfaceEffect(step, `${rawId}-effect-${index}`)}</g>
                  : step.kind === 'dimensional_decoration'
                    ? <g key={step.id} data-preview-step-kind={step.kind} data-preview-step-order={index}>{step.decorations.map((decoration) => <Fragment key={decoration.id}>{renderDecoration(decoration)}</Fragment>)}</g>
                    : null)}
            <FinishOverlay finishType={readModel.finishType} rawId={rawId} />
          </g>
          <g transform={silhouetteTransform} pointerEvents="none"><path d={silhouette.pathD} fill="none" stroke="#6f625f" strokeWidth="1" vectorEffect="non-scaling-stroke" /></g>
        </svg>
        {(readModel.backgroundScenarioActive || readModel.finishScenarioActive) && <span className="absolute right-2 top-2 rounded-full bg-violet-600 px-2 py-1 text-[9px] font-semibold text-white">临时比较</span>}
      </div>
      <div className="flex items-center gap-1.5 text-center">
        <span className="text-xs font-semibold text-gray-900">{nail.finger}</span>
        <span title={FIDELITY_LABEL[readModel.fidelity]} className={cx('whitespace-nowrap rounded-full px-1.5 py-0.5 text-[9px]', readModel.fidelity === 'unavailable' ? 'bg-warning-soft text-warning' : readModel.fidelity === 'approximate' ? 'bg-violet-50 text-violet-700' : 'bg-success-soft text-success')}>
          {size === 'overview' ? <><span className="sm:hidden">{FIDELITY_SHORT_LABEL[readModel.fidelity]}</span><span className="hidden sm:inline">{FIDELITY_LABEL[readModel.fidelity]}</span></> : FIDELITY_LABEL[readModel.fidelity]}
        </span>
      </div>
    </div>
  );
}
