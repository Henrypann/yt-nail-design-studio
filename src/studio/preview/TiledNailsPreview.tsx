/**
 * 视图 2 · 十指平铺（Wizard 默认视图）
 *
 * 去掉 hand plate，5×2 网格直出十指甲面：每格 ≥120px，
 * 同时看「十指协调性」和「每指图案质量」。复用 FingerNailContent
 * 裸内容模式（剪影坐标系直渲，不走 slots 投影——平铺本就不需要 plate 坐标）。
 * NailCellView 同时供视图 3 底部搭配条与顾客展示模式复用。
 * 单击 = 选中该指（同步右栏详情/参数）；双击 = 进入单指细节视图。
 */

import { useId, useMemo } from 'react';
import { RefreshCw } from 'lucide-react';
import { Button, Spinner, cx } from '@/design-system';
import { FINGER_CODES, type FingerCode, type FingerOverrides, type Finish, type NailLength, type NailShape } from '@/lib/types';
import { fingerDisplayRatio, fingerDisplayScale } from '@/studio/finger-display';
import type { DecorationAsset } from './nail-assets';
import { useNailDesignAssets } from './use-nail-design-assets';
import { FingerNailContent } from '@/studio/render';
import { FINGER_LABEL } from './TenFingerPreview';

/* ── 单格渲染器（平铺格 / 搭配条共用） ───────────────────── */

export interface NailCellViewProps {
  finger: FingerCode;
  silhouetteD: string;
  /** 剪影 viewBox（0.1mm 坐标系，如 "-60 -200 120 220"） */
  viewBox: string;
  baseColor: string;
  /** 封层质感（高光带/弧面强度） */
  finish?: Finish;
  patternMarkup: string | null;
  patternK: number;
  patternVisible: boolean;
  patternFadeMs: number;
  decoration?: DecorationAsset;
  failed: boolean;
  selected: boolean;
  /** 有逐指例外（换色/换装饰）时显示粉点 */
  hasOverride: boolean;
  /** 每 0.1mm 设计单位对应的渲染 px（描边宽度换算） */
  strokeScale: number;
  readOnly?: boolean;
  onClick?: (finger: FingerCode) => void;
  onDoubleClick?: (finger: FingerCode) => void;
  /** 格子尺寸：md = 平铺主视图（≥120px）；sm = 搭配条（≥48px） */
  size?: 'md' | 'sm';
}

export function NailCellView({
  finger,
  silhouetteD,
  viewBox,
  baseColor,
  finish = 'gloss',
  patternMarkup,
  patternK,
  patternVisible,
  patternFadeMs,
  decoration,
  failed,
  selected,
  hasOverride,
  strokeScale,
  readOnly = false,
  onClick,
  onDoubleClick,
  size = 'md',
}: NailCellViewProps) {
  const rawId = useId().replace(/[^a-zA-Z0-9]/g, '');
  const clipId = `cellclip-${rawId}-${finger}`;
  const displayScale = fingerDisplayScale(finger);
  const displayRatio = fingerDisplayRatio(finger);
  const baseWidth = size === 'md' ? 120 : 48;
  const viewBoxParts = viewBox.split(/\s+/).map(Number);
  const viewBoxWidth = viewBoxParts[2] || 120;
  const viewBoxHeight = viewBoxParts[3] || 220;
  const stageHeight = baseWidth * (viewBoxHeight / viewBoxWidth);
  return (
    <button
      type="button"
      disabled={readOnly && !onClick}
      onClick={() => onClick?.(finger)}
      onDoubleClick={() => onDoubleClick?.(finger)}
      title={FINGER_LABEL[finger]}
      data-finger-code={finger}
      data-finger-display-scale={displayScale}
      className={cx(
        'group relative flex flex-col items-center gap-1 rounded-card border bg-white transition-all duration-fast',
        size === 'md' ? 'min-w-[120px] p-2' : 'min-w-[48px] p-1',
        selected
          ? 'border-primary shadow-float'
          : 'border-gray-200 hover:border-gray-300 hover:shadow-float',
      )}
    >
      {failed && (
        <span className="absolute left-1 top-1 z-10 text-[12px] leading-none" title="该指渲染失败（MOCK）">
          ⚠️
        </span>
      )}
      {hasOverride && !failed && (
        <span
          className="absolute right-1.5 top-1.5 z-10 h-2 w-2 rounded-full"
          style={{ backgroundColor: '#C2497A' }}
          title="该指有单独定制"
        />
      )}
      <span
        className="flex shrink-0 items-center justify-center"
        style={{ width: `${baseWidth}px`, height: `${stageHeight}px` }}
        aria-hidden="true"
      >
        <svg
          viewBox={viewBox}
          className="h-auto select-none"
          style={{ width: `${baseWidth * displayRatio}px` }}
          data-finger-nail
        >
          <defs>
            <clipPath id={clipId} clipPathUnits="userSpaceOnUse">
              <path d={silhouetteD} />
            </clipPath>
          </defs>
          <FingerNailContent
            finger={finger}
            silhouetteD={silhouetteD}
            clipId={clipId}
            baseColor={baseColor}
            finish={finish}
            failed={failed}
            selected={selected}
            patternMarkup={patternMarkup}
            patternK={patternK}
            patternVisible={patternVisible}
            patternFadeMs={patternFadeMs}
            decoration={decoration}
            strokeScale={strokeScale}
            readOnly
            fingerLabel={FINGER_LABEL[finger]}
          />
        </svg>
      </span>
      <span className={cx('flex items-center gap-1 text-gray-500', size === 'md' ? 'text-[10px]' : 'text-[9px]')}>
        <span className="font-medium tnum">{finger}</span>
        {size === 'md' && <span>{FINGER_LABEL[finger]}</span>}
      </span>
    </button>
  );
}

/* ── 视图 2 · 十指平铺 ──────────────────────────────────── */

export interface TiledNailsPreviewProps {
  shape: NailShape;
  length: NailLength;
  templateId: string | null;
  baseColor: string;
  /** 封层质感（gloss/matte/pearl，驱动高保真甲面效果层） */
  finish?: Finish;
  fingerOverrides?: FingerOverrides;
  selectedFinger?: FingerCode | null;
  onFingerClick?: (finger: FingerCode) => void;
  /** 双击某指 → 进入单指细节视图 */
  onOpenSingle?: (finger: FingerCode) => void;
  readOnly?: boolean;
  className?: string;
}

export function TiledNailsPreview({
  shape,
  length,
  templateId,
  baseColor,
  finish = 'gloss',
  fingerOverrides,
  selectedFinger = null,
  onFingerClick,
  onOpenSingle,
  readOnly = false,
  className,
}: TiledNailsPreviewProps) {
  const assets = useNailDesignAssets(shape, length, templateId);
  const {
    status,
    retry,
    silhouette,
    patternMarkup,
    patternError,
    retryPattern,
    patternVisible,
    patternFadeMs,
    failedFingers,
    patternK,
  } = assets;

  const decorationById = useMemo(() => {
    const map = new Map<string, DecorationAsset>();
    assets.decorations.forEach((d) => map.set(d.id, d));
    return map;
  }, [assets.decorations]);

  /** 描边换算：格子 120px / 剪影 viewBox 宽（0.1mm 单位） */
  const strokeScale = useMemo(() => {
    const w = Number(silhouette?.viewBox.split(/\s+/)[2] ?? 120);
    return 120 / w;
  }, [silhouette]);

  if (status === 'error') {
    return (
      <div className={cx('flex flex-col items-center justify-center gap-3 rounded-card border border-gray-200 bg-white py-16', className)}>
        <p className="text-sm text-gray-700">预览加载失败。请刷新页面重试。</p>
        <Button size="sm" variant="secondary" onClick={retry}>
          <RefreshCw size={13} />
          刷新
        </Button>
      </div>
    );
  }

  if (status !== 'ready' || !silhouette) {
    return (
      <div className={cx('flex flex-col items-center justify-center gap-3 rounded-card border border-gray-200 bg-canvas py-16', className)}>
        <Spinner size={28} className="text-primary" />
        <p className="text-xs text-gray-500">正在生成十指平铺…</p>
      </div>
    );
  }

  return (
    <div className={cx('flex h-full flex-col items-center gap-3 overflow-y-auto rounded-card border border-gray-200 bg-white p-4', className)}>
      {patternError && (
        <div role="alert" className="flex w-full items-center justify-between rounded-button border border-error/20 bg-error-soft px-3 py-2 text-xs text-error">
          <span>{patternError}</span>
          <Button size="sm" variant="ghost" onClick={retryPattern}>
            重试图案
          </Button>
        </div>
      )}
      <div className="grid grid-cols-5 gap-3" data-debug-id="studio.wizard.step2.tiled-view">
        {FINGER_CODES.map((finger) => {
          const override = fingerOverrides?.[finger];
          return (
            <NailCellView
              key={finger}
              finger={finger}
              silhouetteD={silhouette.d}
              viewBox={silhouette.viewBox}
              baseColor={override?.baseColor ?? baseColor}
              finish={finish}
              patternMarkup={patternMarkup}
              patternK={patternK}
              patternVisible={patternVisible}
              patternFadeMs={patternFadeMs}
              decoration={override?.decorationId ? decorationById.get(override.decorationId) : undefined}
              failed={failedFingers.has(finger)}
              selected={selectedFinger === finger}
              hasOverride={!failedFingers.has(finger) && !!(override?.baseColor || override?.decorationId)}
              strokeScale={strokeScale}
              readOnly={readOnly}
              onClick={onFingerClick}
              onDoubleClick={onOpenSingle}
            />
          );
        })}
      </div>
    </div>
  );
}
