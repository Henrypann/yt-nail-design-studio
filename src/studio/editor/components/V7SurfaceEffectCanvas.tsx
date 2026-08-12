import { EyeOff, Info, Sparkles } from 'lucide-react';
import { cx } from '@/design-system';
import { selectCurrentNailV7, selectCurrentStepV7, useEditorV7Store } from '../store-v7';
import {
  createGlitterPreviewParticlesV7,
  normalizeBackgroundDirectionV7,
  resolveBackgroundPreviewModelV7,
  resolveBackgroundSilhouetteV7,
  rgbaToHexV7,
} from '../v7/background';
import {
  SURFACE_EFFECT_FIDELITY_LABELS_V7,
  SURFACE_EFFECT_LABELS_V7,
  createSurfaceEffectParticlesV7,
  normalizeSurfaceEffectDirectionV7,
  rgbaCssV7,
  surfaceEffectMaskPathToCanvasV7,
} from '../v7/surface-effect';
import { combineGeometryPreviewFidelityV7 } from '../v7/geometry-registry';

const WIDTH = 100;
const HEIGHT = 160;

function silhouetteTransform(viewBox: string): string {
  const values = viewBox.trim().split(/[\s,]+/).map(Number);
  if (values.length !== 4 || values.some((value) => !Number.isFinite(value)) || values[2] <= 0 || values[3] <= 0) return '';
  return `scale(${WIDTH / values[2]} ${HEIGHT / values[3]}) translate(${-values[0]} ${-values[1]})`;
}

export function V7SurfaceEffectCanvas() {
  const currentFinger = useEditorV7Store((state) => state.currentFinger);
  const nail = useEditorV7Store(selectCurrentNailV7);
  const selectedStep = useEditorV7Store(selectCurrentStepV7);
  const backgroundStep = nail?.steps[0];
  if (!nail || backgroundStep?.kind !== 'background' || selectedStep?.kind !== 'surface_effect') return null;

  const effect = selectedStep.effect;
  const silhouette = resolveBackgroundSilhouetteV7(nail.geometryRef, nail.finger);
  const previewFidelity = combineGeometryPreviewFidelityV7(silhouette.fidelity, effect.previewFidelity);
  const background = backgroundStep.background;
  const backgroundPreview = resolveBackgroundPreviewModelV7(background, backgroundStep.visible);
  const maskPath = surfaceEffectMaskPathToCanvasV7(selectedStep.mask.pathData);
  const rawId = `v7-effect-${currentFinger}-${selectedStep.id.replace(/[^A-Za-z0-9_-]/g, '-')}`;
  const clipId = `${rawId}-clip`;
  const maskId = `${rawId}-mask`;
  const backgroundGradientId = `${rawId}-background-gradient`;
  const backgroundBandId = `${rawId}-background-band`;
  const effectGradientId = `${rawId}-effect-gradient`;
  const effectBlurId = `${rawId}-effect-blur`;
  const backgroundParticles = background.mode === 'glitter'
    ? createGlitterPreviewParticlesV7(background.seed, background.density, background.colors.length)
    : [];
  const effectParticles = effect.effectType === 'glitter'
    ? createSurfaceEffectParticlesV7(effect.seed, effect.density, 3)
    : effect.effectType === 'ink_bloom'
      ? createSurfaceEffectParticlesV7(effect.seed, effect.spread, effect.colors.length)
      : [];

  const backgroundArtwork = () => {
    if (!backgroundPreview.visible) return null;
    if (background.mode === 'gradient') return <rect width={WIDTH} height={HEIGHT} fill={`url(#${backgroundGradientId})`} fillOpacity={background.opacity} />;
    if (background.mode === 'cat_eye') return <><rect width={WIDTH} height={HEIGHT} fill={rgbaToHexV7(background.color)} fillOpacity={background.opacity * background.color.a} /><rect width={WIDTH} height={HEIGHT} fill={`url(#${backgroundBandId})`} /></>;
    if (background.mode === 'glitter') return <><rect width={WIDTH} height={HEIGHT} fill={rgbaToHexV7(background.colors[0])} fillOpacity={background.opacity * 0.34} />{backgroundParticles.map((particle, index) => <circle key={index} cx={particle.u * WIDTH} cy={particle.v * HEIGHT} r={particle.size} fill={rgbaToHexV7(background.colors[particle.colorIndex % background.colors.length])} fillOpacity={particle.opacity * background.opacity} />)}</>;
    return <rect width={WIDTH} height={HEIGHT} fill={rgbaToHexV7(background.color)} fillOpacity={backgroundPreview.alpha} />;
  };

  const effectArtwork = () => {
    if (!selectedStep.visible || selectedStep.skipped || effect.previewFidelity === 'unavailable') return null;
    if (effect.effectType === 'cat_eye') return <rect x={-WIDTH * 0.3} width={WIDTH * 1.6} height={HEIGHT} fill={`url(#${effectGradientId})`} transform={`rotate(${normalizeSurfaceEffectDirectionV7(effect.directionDeg)} ${WIDTH / 2} ${HEIGHT / 2})`} opacity={effect.intensity} />;
    if (effect.effectType === 'mirror') return <rect width={WIDTH} height={HEIGHT} fill={`url(#${effectGradientId})`} opacity={effect.reflectance} />;
    if (effect.effectType === 'glitter') return effectParticles.map((particle, index) => <circle key={index} cx={particle.u * WIDTH} cy={particle.v * HEIGHT} r={particle.radius * (0.7 + effect.particleSizeMm * 3)} fill={index % 3 === 0 ? '#ffffff' : index % 3 === 1 ? '#e8d4ff' : '#ffd9eb'} fillOpacity={particle.opacity} />);
    return effectParticles.map((particle, index) => {
      const color = effect.colors[particle.colorIndex % effect.colors.length];
      return <circle key={index} cx={particle.u * WIDTH} cy={particle.v * HEIGHT} r={(7 + particle.radius * 7) * effect.spread} fill={rgbaCssV7(color, particle.opacity)} filter={`url(#${effectBlurId})`} />;
    });
  };

  const fidelityTone = previewFidelity === 'exact' ? 'border-success/25 bg-success-soft text-success' : previewFidelity === 'approximate' ? 'border-warning/25 bg-warning-soft text-warning' : 'border-gray-300 bg-gray-100 text-gray-600';

  return (
    <div className="grid min-w-0 gap-4 sm:grid-cols-[minmax(180px,0.9fr)_minmax(190px,1fr)] sm:items-center" data-testid="v7-surface-effect-canvas" data-effect-type={effect.effectType} data-preview-fidelity={previewFidelity}>
      <div className="relative mx-auto aspect-[5/8] w-full max-w-[260px] overflow-hidden rounded-[32px] border border-white bg-white/80 p-3 shadow-[0_20px_60px_rgba(77,53,67,0.14)]">
        <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="h-full w-full" role="img" aria-label={`${currentFinger} ${SURFACE_EFFECT_LABELS_V7[effect.effectType]} 2D 预览`}>
          <defs>
            <clipPath id={clipId}><path d={silhouette.pathD} transform={silhouetteTransform(silhouette.viewBox)} /></clipPath>
            <mask id={maskId} maskUnits="userSpaceOnUse" x="0" y="0" width={WIDTH} height={HEIGHT}><rect width={WIDTH} height={HEIGHT} fill={selectedStep.mask.inverted ? 'white' : 'black'} />{maskPath && <path d={maskPath} fill={selectedStep.mask.inverted ? 'black' : 'white'} fillRule={selectedStep.mask.fillRule} />}</mask>
            {background.mode === 'gradient' && <linearGradient id={backgroundGradientId} gradientTransform={`rotate(${normalizeBackgroundDirectionV7(background.directionDeg)} .5 .5)`}>{background.stops.map((stop, index) => <stop key={index} offset={stop.offset} stopColor={rgbaToHexV7(stop.color)} stopOpacity={stop.color.a} />)}</linearGradient>}
            {background.mode === 'cat_eye' && <linearGradient id={backgroundBandId} gradientTransform={`rotate(${normalizeBackgroundDirectionV7(background.directionDeg)} .5 .5)`}><stop stopColor="#fff" stopOpacity="0" /><stop offset={0.5 - background.bandWidth / 2} stopColor="#fff" stopOpacity="0" /><stop offset="0.5" stopColor="#fff" stopOpacity={background.intensity * 0.85} /><stop offset={0.5 + background.bandWidth / 2} stopColor="#fff" stopOpacity="0" /><stop offset="1" stopColor="#fff" stopOpacity="0" /></linearGradient>}
            {effect.effectType === 'cat_eye' && <linearGradient id={effectGradientId}><stop stopColor="#fff" stopOpacity="0" /><stop offset={0.5 - effect.bandWidth / 2} stopColor="#fff" stopOpacity="0.05" /><stop offset="0.5" stopColor="#fff" stopOpacity="0.95" /><stop offset={0.5 + effect.bandWidth / 2} stopColor="#fff" stopOpacity="0.05" /><stop offset="1" stopColor="#fff" stopOpacity="0" /></linearGradient>}
            {effect.effectType === 'mirror' && <linearGradient id={effectGradientId} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#1e2633" stopOpacity="0.48" /><stop offset="0.22" stopColor="#fff" stopOpacity="0.92" /><stop offset="0.48" stopColor={rgbaCssV7(effect.tint)} stopOpacity="0.78" /><stop offset="0.7" stopColor="#fff" stopOpacity="0.98" /><stop offset="1" stopColor="#3b4555" stopOpacity="0.5" /></linearGradient>}
            <filter id={effectBlurId}><feGaussianBlur stdDeviation="4.5" /></filter>
          </defs>
          <g clipPath={`url(#${clipId})`}>
            <rect width={WIDTH} height={HEIGHT} fill="#f5e8e5" />
            {backgroundArtwork()}
            <g mask={`url(#${maskId})`}>{effectArtwork()}</g>
            <path d={silhouette.pathD} transform={silhouetteTransform(silhouette.viewBox)} fill="none" stroke="rgb(255 255 255 / .68)" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
          </g>
          {effect.previewFidelity === 'unavailable' && maskPath && <g clipPath={`url(#${clipId})`}><path d={maskPath} fill="none" stroke="#936b78" strokeWidth="1.4" strokeDasharray="4 3" /></g>}
        </svg>
        {(!selectedStep.visible || selectedStep.skipped) && <div className="absolute inset-3 flex items-center justify-center rounded-[24px] bg-white/82 text-xs font-semibold text-gray-600 backdrop-blur-sm"><EyeOff size={15} className="mr-2" />{selectedStep.skipped ? '此效果已跳过' : '此效果已隐藏'}</div>}
      </div>

      <div className="min-w-0 rounded-3xl border border-gray-200 bg-white/90 p-4 shadow-sm">
        <div className="flex items-center gap-2"><Sparkles size={17} className="text-primary" /><p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">Surface Effect · 2D</p></div>
        <h2 className="mt-2 text-lg font-semibold text-gray-900">{SURFACE_EFFECT_LABELS_V7[effect.effectType]}</h2>
        <div className={cx('mt-3 inline-flex rounded-full border px-2.5 py-1 text-nano font-semibold', fidelityTone)}>{SURFACE_EFFECT_FIDELITY_LABELS_V7[previewFidelity]}</div>
        {silhouette.fidelity !== 'exact' && <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-nano leading-4 text-amber-900">甲型轮廓为{silhouette.fidelity === 'approximate' ? '生成近似' : '通用回退'}，整体预览已相应降级。</p>}
        <div className="mt-4 rounded-2xl border border-info/20 bg-info-soft p-3 text-xs leading-5 text-info"><Info size={14} className="mb-1" /><p>{effect.previewFidelity === 'unavailable' ? '当前 adapter 无法表达此效果，画布保留遮罩边界与数据。' : '这是由结构化参数派生的编辑态 2D 预览。'} 不代表最终 3D、材料性能或物理可制造性。</p></div>
      </div>
    </div>
  );
}
