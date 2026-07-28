/**
 * 5×2 十指渲染器 · Back 手背 plate 视图（DEV-PLAN §4.4 / §5.11 / Studio-PRD §12.4）
 *
 * 唯一 plate 渲染路径（v1.4.1 起）：Back 手背 · NailSlot V2 —— 签收线稿 plate +
 * 界标仿射 matrix（back-v2.1.0），见 src/studio/render/BackPlatePreview。
 * 资产加载逻辑已抽取为 useNailDesignAssets（三视图共享），本组件只负责
 * plate 合成、相机窗口（cropToNails 纯 viewBox 裁剪，不动 slot 几何）与导出注册。
 * - 异常：单指失败 → 灰甲型 + ⚠️ 降级（其余 9 指正常）；全部失败 → 刷新重试
 *   触发源为 Mock 场景注入面板（render.failAll / render.failFinger / render.timeout）
 */

import { useEffect, useId, useMemo, useRef } from 'react';
import { RefreshCw } from 'lucide-react';
import { Button, Spinner, cx } from '@/design-system';
import type { FingerCode, FingerOverrides, Finish, NailLength, NailShape } from '@/lib/types';
import type { DecorationAsset } from './nail-assets';
import { registerPreviewSvg } from './export-png';
import { useNailDesignAssets } from './use-nail-design-assets';
import { BackPlatePreview, slotsForLength } from '@/studio/render';
import type { NailLengthMm, NailSlotV2 } from '@/studio/slots';

/** 十指中文标签（UI 展示用） */
export const FINGER_LABEL: Record<FingerCode, string> = {
  L1: '左·拇指', L2: '左·食指', L3: '左·中指', L4: '左·无名指', L5: '左·小指',
  R1: '右·拇指', R2: '右·食指', R3: '右·中指', R4: '右·无名指', R5: '右·小指',
};

/**
 * 指甲带相机窗口：全部 slot 界标包围盒 + 少量边距（纯 viewBox 操作）。
 * 编辑布局中栏宽度有限，裁剪掉手腕 / 水彩背景 / 双手间留白后，
 * 甲面从 11–14px 提升到约 22–27px；更大尺度的整体展示由顾客展示模式承担。
 */
export function nailsBandViewBox(slots: NailSlotV2[], plateW: number, plateH: number, pad = 40): string {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const s of slots) {
    for (const p of [s.rootLeft, s.rootRight, s.tipCenter, s.center]) {
      minX = Math.min(minX, p.x);
      maxX = Math.max(maxX, p.x);
      minY = Math.min(minY, p.y);
      maxY = Math.max(maxY, p.y);
    }
  }
  const x0 = Math.max(0, Math.floor(minX - pad));
  const y0 = Math.max(0, Math.floor(minY - pad));
  const x1 = Math.min(plateW, Math.ceil(maxX + pad));
  const y1 = Math.min(plateH, Math.ceil(maxY + pad));
  return `${x0} ${y0} ${x1 - x0} ${y1 - y0}`;
}

export interface TenFingerPreviewProps {
  shape: NailShape;
  length: NailLength;
  templateId: string | null;
  baseColor: string;
  /** 封层质感（gloss/matte/pearl，驱动高保真甲面效果层） */
  finish?: Finish;
  fingerOverrides?: FingerOverrides;
  selectedFinger?: FingerCode | null;
  onFingerClick?: (finger: FingerCode) => void;
  readOnly?: boolean;
  /** 相机窗口裁剪到指甲带（视图 1 · 整体搭配）；缺省整幅 plate（导出/缩略图用） */
  cropToNails?: boolean;
  /** 是否注册为导出 PNG / 缩略图的 svg 源（多实例同时挂载时只能有一个注册） */
  registerExport?: boolean;
  className?: string;
}

export function TenFingerPreview({
  shape,
  length,
  templateId,
  baseColor,
  finish = 'gloss',
  fingerOverrides,
  selectedFinger = null,
  onFingerClick,
  readOnly = false,
  cropToNails = false,
  registerExport = true,
  className,
}: TenFingerPreviewProps) {
  const rawId = useId().replace(/[^a-zA-Z0-9]/g, '');
  const svgRef = useRef<SVGSVGElement | null>(null);

  const assets = useNailDesignAssets(shape, length, templateId, { needPlate: true });
  const { status, retry, backV2, silhouette, patternMarkup, patternVisible, patternFadeMs, failedFingers, lengthMm, widthMm, patternK } = assets;

  /* ── 注册 svg 供导出 PNG / 缩略图（仅 registerExport 实例） ── */
  useEffect(() => {
    if (!registerExport) return;
    registerPreviewSvg(svgRef.current);
    return () => registerPreviewSvg(null);
  }, [status, registerExport]);

  const decorationById = useMemo(() => {
    const map = new Map<string, DecorationAsset>();
    assets.decorations.forEach((d) => map.set(d.id, d));
    return map;
  }, [assets.decorations]);

  const slots = useMemo(
    () => (backV2 ? slotsForLength(backV2, lengthMm as NailLengthMm) : []),
    [backV2, lengthMm],
  );

  const viewBox = useMemo(
    () => (cropToNails && backV2 ? nailsBandViewBox(slots, backV2.sourceWidth, backV2.sourceHeight) : undefined),
    [cropToNails, backV2, slots],
  );

  return (
    <div className={cx('relative overflow-hidden rounded-card border border-gray-200 bg-white', className)}>
      {/* 状态 7：全部失败 */}
      {status === 'error' && (
        <div className="flex aspect-[4/3] flex-col items-center justify-center gap-3">
          <p className="text-sm text-gray-700">预览加载失败。请刷新页面重试。</p>
          <Button size="sm" variant="secondary" onClick={retry}>
            <RefreshCw size={13} />
            刷新
          </Button>
        </div>
      )}

      {status !== 'error' && (
        <div className="relative">
          {status === 'loading' && (
            <div className="flex aspect-[4/3] flex-col items-center justify-center gap-3 bg-canvas">
              <Spinner size={28} className="text-primary" />
              <p className="text-xs text-gray-500">正在生成十指预览…</p>
            </div>
          )}

          {/* NailSlot V2 标定线稿渲染路径（Back 手背，唯一视图） */}
          {status === 'ready' && backV2 && silhouette && (
            <BackPlatePreview
              plate={backV2}
              slots={slots}
              viewBox={viewBox}
              silhouetteD={silhouette.d}
              widthMm={widthMm}
              lengthMm={lengthMm}
              baseColor={baseColor}
              finish={finish}
              fingerOverrides={fingerOverrides}
              patternMarkup={patternMarkup}
              patternK={patternK}
              patternVisible={patternVisible}
              patternFadeMs={patternFadeMs}
              decorationById={decorationById}
              failedFingers={failedFingers}
              selectedFinger={selectedFinger}
              onFingerClick={onFingerClick}
              readOnly={readOnly}
              rawId={rawId}
              svgRef={svgRef}
              fingerLabel={(fc) => FINGER_LABEL[fc]}
            />
          )}
        </div>
      )}
    </div>
  );
}
