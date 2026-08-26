import { EyeOff, Info } from 'lucide-react';
import { cx } from '@/design-system';
import { useLocale } from '@/lib/i18n';
import { selectCurrentNailV7, useEditorV7Store } from '../store-v7';
import {
  composeBackgroundAlphaV7,
  createGlitterPreviewParticlesV7,
  normalizeBackgroundDirectionV7,
  resolveBackgroundPreviewModelV7,
  resolveBackgroundSilhouetteV7,
  rgbaToHexV7,
} from '../v7/background';

const MODE_LABEL = { solid: 'editorV7.background.mode.solid', translucent: 'editorV7.background.mode.translucent', gradient: 'editorV7.background.mode.gradient', cat_eye: 'editorV7.background.mode.catEye', glitter: 'editorV7.background.mode.glitter' } as const;

function viewBoxMetrics(viewBox: string) {
  const values = viewBox.trim().split(/\s+/).map(Number);
  if (values.length !== 4 || values.some((value) => !Number.isFinite(value))) return { x: 0, y: 0, width: 100, height: 160 };
  return { x: values[0], y: values[1], width: values[2], height: values[3] };
}

export function V7BackgroundCanvas() {
  const { t } = useLocale();
  const currentFinger = useEditorV7Store((state) => state.currentFinger);
  const nail = useEditorV7Store(selectCurrentNailV7);
  const backgroundStep = nail?.steps[0];
  if (!nail || backgroundStep?.kind !== 'background') return <div className="rounded-2xl border border-error/20 bg-red-50 p-4 text-xs text-error">{t('editorV7.background.contractMissing')}</div>;

  const background = backgroundStep.background;
  const preview = resolveBackgroundPreviewModelV7(background, backgroundStep.visible);
  const silhouette = resolveBackgroundSilhouetteV7(nail.geometryRef, nail.finger);
  const clipId = `v7-background-clip-${currentFinger}`;
  const gridId = `v7-alpha-grid-${currentFinger}`;
  const gradientId = `v7-background-gradient-${currentFinger}`;
  const bandId = `v7-background-band-${currentFinger}`;
  const metrics = viewBoxMetrics(silhouette.viewBox);
  const glitterParticles = background.mode === 'glitter'
    ? createGlitterPreviewParticlesV7(background.seed, background.density, background.colors.length)
    : [];
  const hex = rgbaToHexV7(preview.color);

  const fill = () => {
    if (!preview.visible) return null;
    if ((background.mode === 'cat_eye' || background.mode === 'glitter') && preview.fidelity === 'unavailable') return null;
    if (background.mode === 'solid' || background.mode === 'translucent') {
      return <rect x={metrics.x} y={metrics.y} width={metrics.width} height={metrics.height} fill={hex} fillOpacity={preview.alpha} />;
    }
    if (background.mode === 'gradient') {
      return <rect x={metrics.x} y={metrics.y} width={metrics.width} height={metrics.height} fill={`url(#${gradientId})`} fillOpacity={background.opacity} />;
    }
    if (background.mode === 'cat_eye') {
      return <>
        <rect x={metrics.x} y={metrics.y} width={metrics.width} height={metrics.height} fill={rgbaToHexV7(background.color)} fillOpacity={composeBackgroundAlphaV7(background.color, background.opacity, 0.76)} />
        <rect x={metrics.x} y={metrics.y} width={metrics.width} height={metrics.height} fill={`url(#${bandId})`} fillOpacity={composeBackgroundAlphaV7(background.color, background.opacity)} />
      </>;
    }
    return <>
      <rect x={metrics.x} y={metrics.y} width={metrics.width} height={metrics.height} fill={rgbaToHexV7(background.colors[0])} fillOpacity={composeBackgroundAlphaV7(background.colors[0], background.opacity, 0.28)} />
      {glitterParticles.map((particle, index) => (
        <circle key={index} cx={metrics.x + particle.u * metrics.width} cy={metrics.y + particle.v * metrics.height}
          r={Math.max(0.45, background.particleSizeMm * 3.2) * particle.size}
          fill={rgbaToHexV7(background.colors[particle.colorIndex])} fillOpacity={composeBackgroundAlphaV7(background.colors[particle.colorIndex], background.opacity, particle.opacity)} />
      ))}
    </>;
  };

  return (
    <div className="grid min-w-0 gap-4 sm:grid-cols-[minmax(180px,0.8fr)_minmax(180px,1fr)] sm:items-center" data-testid="v7-background-canvas" data-background-mode={preview.mode} data-preview-fidelity={preview.fidelity} data-silhouette-source={silhouette.source}>
      <div className="relative mx-auto flex h-[300px] w-full max-w-[240px] items-center justify-center overflow-hidden rounded-[28px] border border-white bg-white/75 p-2 shadow-[0_18px_50px_rgba(77,53,67,0.12)] sm:p-3">
        <svg viewBox={silhouette.viewBox} className="h-full max-h-[280px] w-full" role="img" aria-label={`${currentFinger} ${t(MODE_LABEL[preview.mode as keyof typeof MODE_LABEL] ?? 'editorV7.background.mode.solid')} ${t('editor.extra.preview')}`} preserveAspectRatio="xMidYMid meet">
          <defs>
            <clipPath id={clipId}><path d={silhouette.pathD} /></clipPath>
            <pattern id={gridId} width="12" height="12" patternUnits="userSpaceOnUse"><rect width="12" height="12" fill="#f7f7f8" /><rect width="6" height="6" fill="#e5e7eb" /><rect x="6" y="6" width="6" height="6" fill="#e5e7eb" /></pattern>
            {background.mode === 'gradient' && (
              <linearGradient id={gradientId} x1="0%" y1="50%" x2="100%" y2="50%" gradientTransform={`rotate(${normalizeBackgroundDirectionV7(background.directionDeg)} 0.5 0.5)`}>
                {background.stops.map((stop, index) => <stop key={index} offset={`${stop.offset * 100}${t('editorV7.background.percent')}`} stopColor={rgbaToHexV7(stop.color)} stopOpacity={stop.color.a} />)}
              </linearGradient>
            )}
            {background.mode === 'cat_eye' && (
              <linearGradient id={bandId} x1="0%" y1="50%" x2="100%" y2="50%" gradientTransform={`rotate(${normalizeBackgroundDirectionV7(background.directionDeg)} 0.5 0.5)`}>
                <stop offset="0%" stopColor="#000" stopOpacity="0" />
                <stop offset={`${Math.max(0, 50 - background.bandWidth * 50)}${t('editorV7.background.percent')}`} stopColor="#fff" stopOpacity="0" />
                <stop offset="50%" stopColor="#fff" stopOpacity={0.18 + background.intensity * 0.72} />
                <stop offset={`${Math.min(100, 50 + background.bandWidth * 50)}${t('editorV7.background.percent')}`} stopColor="#fff" stopOpacity="0" />
                <stop offset="100%" stopColor="#000" stopOpacity="0" />
              </linearGradient>
            )}
          </defs>
          <g clipPath={`url(#${clipId})`}>
            <rect x={metrics.x} y={metrics.y} width={metrics.width} height={metrics.height} fill={`url(#${gridId})`} />
            {fill()}
          </g>
          <path d={silhouette.pathD} fill="none" stroke="#8d7c78" strokeWidth="1.4" vectorEffect="non-scaling-stroke" />
        </svg>
        {!preview.visible && <span className="absolute inset-x-4 bottom-4 flex items-center justify-center gap-1.5 rounded-full bg-gray-900/80 px-3 py-2 text-nano text-white"><EyeOff size={12} />{t('editorV7.background.hidden')}</span>}
      </div>

      <div className="min-w-0 space-y-3">
        <div><p className="text-nano font-semibold uppercase tracking-[0.14em] text-gray-400">{t('editorV7.background.editorTitle')}</p><h2 className="mt-1 text-lg font-semibold text-gray-900">{currentFinger} · {t(MODE_LABEL[preview.mode as keyof typeof MODE_LABEL] ?? 'editorV7.background.mode.solid')}</h2><p className="mt-1 text-nano text-gray-600">{silhouette.label}</p><p className="mt-0.5 truncate font-mono text-nano text-gray-400" title={`${nail.geometryRef.assetId} @ ${nail.geometryRef.revision}`}>{nail.geometryRef.assetId}</p></div>
        <dl className="grid grid-cols-2 gap-2 text-nano">
          <div className="rounded-xl border border-gray-200 bg-white px-3 py-2"><dt className="text-gray-400">{t('editorV7.background.representativeColor')}</dt><dd className="mt-1 flex items-center gap-2 font-mono font-semibold text-gray-800"><span className="h-4 w-4 rounded-full border border-gray-300" style={{ backgroundColor: hex }} />{hex.toUpperCase()}</dd></div>
          <div className="rounded-xl border border-gray-200 bg-white px-3 py-2"><dt className="text-gray-400">{t('editorV7.background.opacityLabel')}</dt><dd className="mt-1 font-semibold tabular-nums text-gray-800">{Math.round(background.opacity * 100)}{t('editorV7.background.percent')}</dd></div>
        </dl>
        <div className={cx('flex items-start gap-2 rounded-xl border px-3 py-2.5 text-nano leading-4', preview.fidelity === 'exact' ? 'border-success/20 bg-success-soft text-success' : 'border-info/20 bg-info-soft text-info')}>
          <Info size={13} className="mt-0.5 shrink-0" />
          <span>{preview.fidelity === 'unavailable'
            ? t('editorV7.background.unavailableNotice', { mode: t(MODE_LABEL[background.mode as keyof typeof MODE_LABEL] ?? 'editorV7.background.mode.solid') })
            : preview.fidelity === 'exact' && (background.mode === 'cat_eye' || background.mode === 'glitter')
              ? t('editorV7.background.exactCanvasNotice', { mode: t(MODE_LABEL[background.mode as keyof typeof MODE_LABEL] ?? 'editorV7.background.mode.solid') })
            : background.mode === 'gradient'
            ? t('editorV7.background.gradientCanvasNotice')
            : background.mode === 'cat_eye'
              ? t('editorV7.background.catEyeCanvasNotice')
              : background.mode === 'glitter'
                ? t('editorV7.background.glitterCanvasNotice', { seed: background.seed })
                : preview.fidelity === 'approximate'
                  ? t('editorV7.background.translucentCanvasNotice')
                  : t('editorV7.background.solidCanvasNotice')}</span>
        </div>
        {silhouette.source === 'generic' && <p className="rounded-xl border border-dashed border-warning/30 bg-warning-soft px-3 py-2 text-nano leading-4 text-warning">{t('editorV7.background.genericOutlineWarning', { label: t('editorV7.workspace.stage.geometryUnavailable') })}</p>}
      </div>
    </div>
  );
}
