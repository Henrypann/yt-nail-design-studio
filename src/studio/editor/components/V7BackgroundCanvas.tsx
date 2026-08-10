import { EyeOff, Info } from 'lucide-react';
import { cx } from '@/design-system';
import { selectCurrentNailV7, useEditorV7Store } from '../store-v7';
import {
  composeBackgroundAlphaV7,
  createGlitterPreviewParticlesV7,
  normalizeBackgroundDirectionV7,
  resolveBackgroundPreviewModelV7,
  resolveBackgroundSilhouetteV7,
  rgbaToHexV7,
} from '../v7/background';

const MODE_LABEL: Record<string, string> = { solid: '单色', translucent: '透色', gradient: '渐变', cat_eye: '猫眼', glitter: '闪粉' };

function viewBoxMetrics(viewBox: string) {
  const values = viewBox.trim().split(/\s+/).map(Number);
  if (values.length !== 4 || values.some((value) => !Number.isFinite(value))) return { x: 0, y: 0, width: 100, height: 160 };
  return { x: values[0], y: values[1], width: values[2], height: values[3] };
}

export function V7BackgroundCanvas() {
  const currentFinger = useEditorV7Store((state) => state.currentFinger);
  const nail = useEditorV7Store(selectCurrentNailV7);
  const backgroundStep = nail?.steps[0];
  if (!nail || backgroundStep?.kind !== 'background') return <div className="rounded-2xl border border-error/20 bg-red-50 p-4 text-xs text-error">背景合同缺失，预览已停止且文档不会被重置。</div>;

  const background = backgroundStep.background;
  const preview = resolveBackgroundPreviewModelV7(background, backgroundStep.visible);
  const silhouette = resolveBackgroundSilhouetteV7(nail.geometryRef);
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
        <svg viewBox={silhouette.viewBox} className="h-full max-h-[280px] w-full" role="img" aria-label={`${currentFinger} ${MODE_LABEL[preview.mode] ?? preview.mode}背景预览`} preserveAspectRatio="xMidYMid meet">
          <defs>
            <clipPath id={clipId}><path d={silhouette.pathD} /></clipPath>
            <pattern id={gridId} width="12" height="12" patternUnits="userSpaceOnUse"><rect width="12" height="12" fill="#f7f7f8" /><rect width="6" height="6" fill="#e5e7eb" /><rect x="6" y="6" width="6" height="6" fill="#e5e7eb" /></pattern>
            {background.mode === 'gradient' && (
              <linearGradient id={gradientId} x1="0%" y1="50%" x2="100%" y2="50%" gradientTransform={`rotate(${normalizeBackgroundDirectionV7(background.directionDeg)} 0.5 0.5)`}>
                {background.stops.map((stop, index) => <stop key={index} offset={`${stop.offset * 100}%`} stopColor={rgbaToHexV7(stop.color)} stopOpacity={stop.color.a} />)}
              </linearGradient>
            )}
            {background.mode === 'cat_eye' && (
              <linearGradient id={bandId} x1="0%" y1="50%" x2="100%" y2="50%" gradientTransform={`rotate(${normalizeBackgroundDirectionV7(background.directionDeg)} 0.5 0.5)`}>
                <stop offset="0%" stopColor="#000" stopOpacity="0" />
                <stop offset={`${Math.max(0, 50 - background.bandWidth * 50)}%`} stopColor="#fff" stopOpacity="0" />
                <stop offset="50%" stopColor="#fff" stopOpacity={0.18 + background.intensity * 0.72} />
                <stop offset={`${Math.min(100, 50 + background.bandWidth * 50)}%`} stopColor="#fff" stopOpacity="0" />
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
        {!preview.visible && <span className="absolute inset-x-4 bottom-4 flex items-center justify-center gap-1.5 rounded-full bg-gray-900/80 px-3 py-2 text-[10px] text-white"><EyeOff size={12} />背景已隐藏</span>}
      </div>

      <div className="min-w-0 space-y-3">
        <div><p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-gray-400">2D 背景编辑</p><h2 className="mt-1 text-lg font-semibold text-gray-900">{currentFinger} · {MODE_LABEL[preview.mode] ?? preview.mode}</h2><p className="mt-1 text-[11px] text-gray-600">{silhouette.label}</p><p className="mt-0.5 truncate font-mono text-[9px] text-gray-400" title={`${nail.geometryRef.assetId} @ ${nail.geometryRef.revision}`}>{nail.geometryRef.assetId}</p></div>
        <dl className="grid grid-cols-2 gap-2 text-[11px]">
          <div className="rounded-xl border border-gray-200 bg-white px-3 py-2"><dt className="text-gray-400">代表色</dt><dd className="mt-1 flex items-center gap-2 font-mono font-semibold text-gray-800"><span className="h-4 w-4 rounded-full border border-gray-300" style={{ backgroundColor: hex }} />{hex.toUpperCase()}</dd></div>
          <div className="rounded-xl border border-gray-200 bg-white px-3 py-2"><dt className="text-gray-400">背景透明度</dt><dd className="mt-1 font-semibold tabular-nums text-gray-800">{Math.round(background.opacity * 100)}%</dd></div>
        </dl>
        <div className={cx('flex items-start gap-2 rounded-xl border px-3 py-2.5 text-[10px] leading-4', preview.fidelity === 'exact' ? 'border-success/20 bg-success-soft text-success' : 'border-info/20 bg-info-soft text-info')}>
          <Info size={13} className="mt-0.5 shrink-0" />
          <span>{preview.fidelity === 'unavailable'
            ? `${MODE_LABEL[background.mode]} 当前标记为不可预览；保留文档参数并显示甲面边界，不伪造效果。`
            : preview.fidelity === 'exact' && (background.mode === 'cat_eye' || background.mode === 'glitter')
              ? `${MODE_LABEL[background.mode]} 当前由已签收的 2D adapter 精确派生；仍不代表真实材料或制造结果。`
            : background.mode === 'gradient'
            ? '渐变由 canonical 色标与 nail-local 方向直接派生。'
            : background.mode === 'cat_eye'
              ? '猫眼使用解析式确定性光带近似，不含随机采样，也不代表真实磁粉响应。'
              : background.mode === 'glitter'
                ? `闪粉按已保存 seed「${background.seed}」确定性投影；仅为 2D 近似。`
                : preview.fidelity === 'approximate'
                  ? '透色为 2D 近似效果，不代表真实材料透光率。'
                  : '单色背景由 EditorDocV7 的 canonical sRGB 与 opacity 直接派生。'}</span>
        </div>
        {silhouette.source === 'generic' && <p className="rounded-xl border border-dashed border-warning/30 bg-warning-soft px-3 py-2 text-[10px] leading-4 text-warning">{silhouette.label}；未修改原 geometryRef，关联正式轮廓后会自动替换预览边界。</p>}
      </div>
    </div>
  );
}
