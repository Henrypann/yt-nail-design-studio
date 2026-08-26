/**
 * 视图 3 · 单指细节（展开形态）
 *
 * 当前选中指 ≥240px 大图：看猫眼亮带、法式线、附件、颜色。
 * 与右栏常驻单指详情是同一概念的两种形态（紧凑 / 展开）。
 * ←/→ 方向键循环切指，Esc 返回上一视图；底部十指搭配条点击直接跳指。
 */

import { useEffect, useMemo } from 'react';
import { ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';
import { Button, Spinner, cx } from '@/design-system';
import { FINGER_CODES, type FingerCode, type FingerOverrides, type Finish, type NailLength, type NailShape } from '@/lib/types';
import type { DecorationAsset } from './nail-assets';
import { useNailDesignAssets } from './use-nail-design-assets';
import { FingerNailContent } from '@/studio/render';
import { FINGER_LABEL } from './TenFingerPreview';
import { NailCellView } from './TiledNailsPreview';
import type { RecipeInstanceV1 } from '@/studio/editor/lib/recipe-model';
import { useLocale } from '@/lib/i18n';

export interface SingleNailViewProps {
  shape: NailShape;
  length: NailLength;
  templateId: string | null;
  baseColor: string;
  /** 封层质感（gloss/matte/pearl，驱动高保真甲面效果层） */
  finish?: Finish;
  recipe?: RecipeInstanceV1;
  fingerOverrides?: FingerOverrides;
  /** 当前焦点指（缺省 R4 主视觉指） */
  finger: FingerCode;
  onSelectFinger: (finger: FingerCode) => void;
  /** Esc / 返回按钮 → 回到上一视图 */
  onExit: () => void;
  readOnly?: boolean;
  className?: string;
}

export function SingleNailView({
  shape,
  length,
  templateId,
  baseColor,
  finish = 'gloss',
  recipe,
  fingerOverrides,
  finger,
  onSelectFinger,
  onExit,
  readOnly = false,
  className,
}: SingleNailViewProps) {
  const { t } = useLocale();
  const assets = useNailDesignAssets(shape, length, templateId);
  const { status, retry, silhouette, patternMarkup, patternVisible, patternFadeMs, failedFingers, patternK } = assets;

  const decorationById = useMemo(() => {
    const map = new Map<string, DecorationAsset>();
    assets.decorations.forEach((d) => map.set(d.id, d));
    return map;
  }, [assets.decorations]);

  /* ←/→ 循环切指；Esc 返回 */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const idx = FINGER_CODES.indexOf(finger);
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        onSelectFinger(FINGER_CODES[(idx + FINGER_CODES.length - 1) % FINGER_CODES.length]);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        onSelectFinger(FINGER_CODES[(idx + 1) % FINGER_CODES.length]);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onExit();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [finger, onSelectFinger, onExit]);

  const strokeScale = useMemo(() => {
    const w = Number(silhouette?.viewBox.split(/\s+/)[2] ?? 120);
    return 280 / w;
  }, [silhouette]);

  const step = (delta: number) => {
    const idx = FINGER_CODES.indexOf(finger);
    onSelectFinger(FINGER_CODES[(idx + FINGER_CODES.length + delta) % FINGER_CODES.length]);
  };

  if (status === 'error') {
    return (
      <div className={cx('flex flex-col items-center justify-center gap-3 rounded-card border border-gray-200 bg-white py-16', className)}>
        <p className="text-sm text-gray-700">{t('preview.loadFailed')}</p>
        <Button size="sm" variant="secondary" onClick={retry}>
          <RefreshCw size={13} />
          {t('preview.refresh')}
        </Button>
      </div>
    );
  }

  if (status !== 'ready' || !silhouette) {
    return (
      <div className={cx('flex flex-col items-center justify-center gap-3 rounded-card border border-gray-200 bg-canvas py-16', className)}>
        <Spinner size={28} className="text-primary" />
        <p className="text-xs text-gray-500">{t('preview.singleGenerating')}</p>
      </div>
    );
  }

  const override = fingerOverrides?.[finger];
  const failed = failedFingers.has(finger);
  const clipId = 'single-nail-clip';
  const color = override?.baseColor ?? baseColor;
  const decoration = override?.decorationId ? decorationById.get(override.decorationId) : undefined;

  return (
    <div
      className={cx('flex h-full min-h-0 flex-col rounded-card border border-gray-200 bg-white', className)}
      data-debug-id="studio.preview.single"
    >
      {/* 大图区 */}
      <div className="flex min-h-0 flex-1 items-center justify-center gap-6 overflow-y-auto p-4">
        <Button size="sm" variant="ghost" onClick={() => step(-1)} title={t('preview.previousFinger')}>
          <ChevronLeft size={18} />
        </Button>

        <div className="relative">
          {failed && (
            <span className="absolute -top-2 left-1/2 z-10 -translate-x-1/2 text-lg" title={t('preview.renderFailedMock')}>
              ⚠️
            </span>
          )}
          <svg viewBox={silhouette.viewBox} className="h-auto w-[280px] select-none">
            <defs>
              <clipPath id={clipId} clipPathUnits="userSpaceOnUse">
                <path d={silhouette.d} />
              </clipPath>
            </defs>
            <FingerNailContent
              finger={finger}
              shape={shape}
              length={length}
              silhouetteD={silhouette.d}
              clipId={clipId}
              baseColor={color}
              finish={finish}
              recipe={recipe}
              failed={failed}
              selected={false}
              patternMarkup={patternMarkup}
              patternK={patternK}
              patternVisible={patternVisible}
              patternFadeMs={patternFadeMs}
              decoration={decoration}
              strokeScale={strokeScale}
              readOnly
              fingerLabel={t(FINGER_LABEL[finger])}
            />
          </svg>
        </div>

        <Button size="sm" variant="ghost" onClick={() => step(1)} title={t('preview.nextFinger')}>
          <ChevronRight size={18} />
        </Button>
      </div>

      {/* 信息行 */}
      <div className="flex items-center justify-center gap-3 border-t border-gray-100 px-4 py-2 text-xs text-gray-600">
        <span className="font-medium text-gray-900">
          {finger} · {t(FINGER_LABEL[finger])}
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded-full border border-gray-200" style={{ backgroundColor: color }} />
          {color}
        </span>
        {decoration && <span>{t('preview.attachment', { name: decoration.name })}</span>}
        {override && (override.baseColor || override.decorationId) && (
          <span className="rounded-button px-1.5 py-0.5 text-nano" style={{ backgroundColor: 'var(--color-primary-soft)', color: 'var(--color-primary)' }}>
            {t('preview.customized')}
          </span>
        )}
        <span className="ml-auto text-nano text-gray-400">{t('preview.keyboardHint')}</span>
      </div>

      {/* 十指搭配条 */}
      <div className="flex justify-center gap-1.5 overflow-x-auto border-t border-gray-100 px-4 py-2.5">
        {FINGER_CODES.map((fc) => {
          const ov = fingerOverrides?.[fc];
          return (
            <NailCellView
              key={fc}
              finger={fc}
              shape={shape}
              length={length}
              silhouetteD={silhouette.d}
              viewBox={silhouette.viewBox}
              baseColor={ov?.baseColor ?? baseColor}
              finish={finish}
              recipe={recipe}
              patternMarkup={patternMarkup}
              patternK={patternK}
              patternVisible={patternVisible}
              patternFadeMs={patternFadeMs}
              decoration={ov?.decorationId ? decorationById.get(ov.decorationId) : undefined}
              failed={failedFingers.has(fc)}
              selected={fc === finger}
              hasOverride={!failedFingers.has(fc) && !!(ov?.baseColor || ov?.decorationId)}
              strokeScale={48 / Number(silhouette.viewBox.split(/\s+/)[2] ?? 120)}
              readOnly={readOnly}
              onClick={onSelectFinger}
              size="sm"
            />
          );
        })}
      </div>
    </div>
  );
}
