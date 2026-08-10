import { EyeOff, Info } from 'lucide-react';
import { cx } from '@/design-system';
import { selectCurrentNailV7, useEditorV7Store } from '../store-v7';
import {
  resolveBackgroundPreviewModelV7,
  resolveBackgroundSilhouetteV7,
  rgbaToHexV7,
} from '../v7/background';

const MODE_LABEL: Record<string, string> = {
  solid: '单色',
  translucent: '透色',
  gradient: '渐变',
  cat_eye: '猫眼',
  glitter: '闪粉',
};

export function V7BackgroundCanvas() {
  const currentFinger = useEditorV7Store((state) => state.currentFinger);
  const nail = useEditorV7Store(selectCurrentNailV7);
  const backgroundStep = nail?.steps[0];

  if (!nail || backgroundStep?.kind !== 'background') {
    return <div className="rounded-2xl border border-error/20 bg-red-50 p-4 text-xs text-error">背景合同缺失，预览已停止且文档不会被重置。</div>;
  }

  const preview = resolveBackgroundPreviewModelV7(backgroundStep.background, backgroundStep.visible);
  const silhouette = resolveBackgroundSilhouetteV7(nail.geometryRef);
  const clipId = `v7-background-clip-${currentFinger}`;
  const patternId = `v7-alpha-grid-${currentFinger}`;
  const rgb = `rgb(${preview.color.r} ${preview.color.g} ${preview.color.b})`;
  const hex = rgbaToHexV7(preview.color);

  return (
    <div className="grid min-w-0 gap-4 sm:grid-cols-[minmax(180px,0.8fr)_minmax(180px,1fr)] sm:items-center" data-testid="v7-background-canvas" data-background-mode={preview.mode} data-preview-fidelity={preview.fidelity} data-silhouette-source={silhouette.source}>
      <div className="relative mx-auto flex h-[280px] w-full max-w-[220px] items-center justify-center overflow-hidden rounded-[28px] border border-white bg-white/75 p-4 shadow-[0_18px_50px_rgba(77,53,67,0.12)]">
        <svg viewBox={silhouette.viewBox} className="h-full max-h-[248px] w-full" role="img" aria-label={`${currentFinger} ${MODE_LABEL[preview.mode] ?? preview.mode}背景预览`} preserveAspectRatio="xMidYMid meet">
          <defs>
            <clipPath id={clipId}><path d={silhouette.pathD} /></clipPath>
            <pattern id={patternId} width="12" height="12" patternUnits="userSpaceOnUse">
              <rect width="12" height="12" fill="#f7f7f8" />
              <rect width="6" height="6" fill="#e5e7eb" />
              <rect x="6" y="6" width="6" height="6" fill="#e5e7eb" />
            </pattern>
          </defs>
          <g clipPath={`url(#${clipId})`}>
            <rect x="-10000" y="-10000" width="20000" height="20000" fill={`url(#${patternId})`} />
            {preview.visible && <rect x="-10000" y="-10000" width="20000" height="20000" fill={rgb} fillOpacity={preview.alpha} />}
          </g>
          <path d={silhouette.pathD} fill="none" stroke="#8d7c78" strokeWidth="1.4" vectorEffect="non-scaling-stroke" />
        </svg>
        {!preview.visible && (
          <span className="absolute inset-x-4 bottom-4 flex items-center justify-center gap-1.5 rounded-full bg-gray-900/80 px-3 py-2 text-[10px] text-white"><EyeOff size={12} />背景已隐藏</span>
        )}
      </div>

      <div className="min-w-0 space-y-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-gray-400">2D 背景编辑</p>
          <h2 className="mt-1 text-lg font-semibold text-gray-900">{currentFinger} · {MODE_LABEL[preview.mode] ?? preview.mode}</h2>
          <p className="mt-1 break-all text-[11px] text-gray-500">{nail.geometryRef.assetId} @ {nail.geometryRef.revision}</p>
        </div>
        <dl className="grid grid-cols-2 gap-2 text-[11px]">
          <div className="rounded-xl border border-gray-200 bg-white px-3 py-2">
            <dt className="text-gray-400">Canonical RGB</dt>
            <dd className="mt-1 flex items-center gap-2 font-mono font-semibold text-gray-800"><span className="h-4 w-4 rounded-full border border-gray-300" style={{ backgroundColor: hex }} />{hex.toUpperCase()}</dd>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white px-3 py-2">
            <dt className="text-gray-400">组合透明度</dt>
            <dd className="mt-1 font-semibold tabular-nums text-gray-800">{Math.round(preview.alpha * 100)}%</dd>
          </div>
        </dl>
        <div className={cx('flex items-start gap-2 rounded-xl border px-3 py-2.5 text-[10px] leading-4', preview.fidelity === 'exact' ? 'border-success/20 bg-success-soft text-success' : 'border-info/20 bg-info-soft text-info')}>
          <Info size={13} className="mt-0.5 shrink-0" />
          <span>
            {preview.deferred
              ? `${MODE_LABEL[preview.mode]} 的完整 2D 表现属于 V7-06；当前只显示确定性代表色。`
              : preview.fidelity === 'approximate'
                ? '透色为 2D 近似效果，不代表真实材料透光率。'
                : '单色背景由 EditorDocV7 的 canonical sRGB 与 opacity 直接派生。'}
          </span>
        </div>
        {silhouette.source === 'generic' && (
          <p className="rounded-xl border border-dashed border-warning/30 bg-warning-soft px-3 py-2 text-[10px] leading-4 text-warning">
            {silhouette.label}；未修改原 geometryRef，关联正式轮廓后会自动替换预览边界。
          </p>
        )}
      </div>
    </div>
  );
}
