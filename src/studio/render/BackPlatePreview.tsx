/**
 * Back 视图十指预览 · NailSlot V2 渲染路径（DEV-PLAN §5.11 Phase 2）
 *
 * 合成：签收线稿 plate（1200×900 PNG，内联 dataURL）+ 每指
 * matrix(slot.transform) · contentUvTransform(widthMm,lengthMm) · FingerNailContent。
 *
 * 与 legacy 路径的差异：定位完全来自已签收界标仿射（back-v2.1.0），
 * 不使用 anchor 归一化坐标 / nailScale / PX_PER_MM。
 * 长度切换：甲根固定，甲尖沿中轴伸缩（slotsForLength，契约 length_rule）。
 */

import type { RefObject } from 'react';
import type { FingerCode, FingerOverrides } from '@/lib/types';
import type { NailSlotV2 } from '@/studio/slots';
import { formatSvgMatrix, uvToStage } from '@/studio/slots';
import type { DecorationAsset } from '@/studio/preview/nail-assets';
import { FingerNailContent } from './FingerNailContent';
import { contentUvTransform, pxPerDesignUnit, type BackPlateV2 } from './slots-v2';

export interface BackPlatePreviewProps {
  plate: BackPlateV2;
  /** 已按当前长度调整（slotsForLength） */
  slots: NailSlotV2[];
  /** 自定义相机窗口（viewBox 裁剪，纯视图层，不影响 slot 几何）；缺省整幅 plate */
  viewBox?: string;
  silhouetteD: string;
  widthMm: number;
  lengthMm: number;
  baseColor: string;
  fingerOverrides?: FingerOverrides;
  patternMarkup: string | null;
  patternK: number;
  patternVisible: boolean;
  patternFadeMs: number;
  decorationById: Map<string, DecorationAsset>;
  failedFingers: Set<FingerCode>;
  selectedFinger?: FingerCode | null;
  onFingerClick?: (finger: FingerCode) => void;
  readOnly?: boolean;
  /** clip id 前缀（useId 清洗后） */
  rawId: string;
  svgRef: RefObject<SVGSVGElement>;
  fingerLabel: (fc: FingerCode) => string;
}

export function BackPlatePreview({
  plate,
  slots,
  viewBox,
  silhouetteD,
  widthMm,
  lengthMm,
  baseColor,
  fingerOverrides,
  patternMarkup,
  patternK,
  patternVisible,
  patternFadeMs,
  decorationById,
  failedFingers,
  selectedFinger = null,
  onFingerClick,
  readOnly = false,
  rawId,
  svgRef,
  fingerLabel,
}: BackPlatePreviewProps) {
  const uv = contentUvTransform(widthMm, lengthMm);
  return (
    <svg
      ref={svgRef}
      viewBox={viewBox ?? `0 0 ${plate.sourceWidth} ${plate.sourceHeight}`}
      className="block w-full select-none"
      role="img"
      aria-label="十指预览（手背视图 · NailSlot V2 标定线稿）"
      data-calibration={plate.calibrationVersion}
    >
      {/* 第一层：签收线稿 plate（dataURL 内联，保证离屏 PNG 导出一致） */}
      <image
        href={plate.plateDataUrl}
        x={0}
        y={0}
        width={plate.sourceWidth}
        height={plate.sourceHeight}
        preserveAspectRatio="none"
      />

      {/* 每指 clipPath（在各指局部 0.1mm 坐标系解析） */}
      <defs>
        {slots.map((slot) => (
          <clipPath key={slot.fingerCode} id={`nailclip-${rawId}-${slot.fingerCode}`} clipPathUnits="userSpaceOnUse">
            <path d={silhouetteD} />
          </clipPath>
        ))}
      </defs>

      {/* 第二~四层：轮廓 + 底色 + 图案（+ 附件），UV → stage 仿射投影 */}
      {slots.map((slot) => {
        const fc = slot.fingerCode;
        const override = fingerOverrides?.[fc];
        const color = override?.baseColor ?? baseColor;
        const deco = override?.decorationId ? decorationById.get(override.decorationId) : undefined;
        const failed = failedFingers.has(fc);
        const tipStage = uvToStage(0.5, 0, slot.transform);
        const rootRightStage = uvToStage(1, 1, slot.transform);
        return (
          <g key={fc}>
            <g transform={formatSvgMatrix(slot.transform)}>
              <g transform={uv}>
                <FingerNailContent
                  finger={fc}
                  silhouetteD={silhouetteD}
                  clipId={`nailclip-${rawId}-${fc}`}
                  baseColor={color}
                  failed={failed}
                  selected={selectedFinger === fc}
                  patternMarkup={patternMarkup}
                  patternK={patternK}
                  patternVisible={patternVisible}
                  patternFadeMs={patternFadeMs}
                  decoration={deco}
                  strokeScale={pxPerDesignUnit(slot, widthMm)}
                  readOnly={readOnly}
                  onFingerClick={onFingerClick}
                  fingerLabel={fingerLabel(fc)}
                />
              </g>
            </g>
            {/* 单指失败降级标记（甲尖上方） */}
            {failed && (
              <text x={tipStage.x} y={tipStage.y - 10} fontSize={22} textAnchor="middle" fill="#B42318">
                ⚠
              </text>
            )}
            {/* 逐指例外标记（甲根右侧小圆点） */}
            {!failed && override && (override.baseColor || override.decorationId) && (
              <circle cx={rootRightStage.x + 7} cy={rootRightStage.y - 3} r={4} fill="#C2497A" opacity={0.9} />
            )}
          </g>
        );
      })}
    </svg>
  );
}
