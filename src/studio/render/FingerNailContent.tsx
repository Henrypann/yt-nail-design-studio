/**
 * 单指设计内容（0.1mm 剪影坐标系：原点甲根中心、甲尖负 y）
 *
 * 投影路径（v1.4.1 起唯一）：NailSlot V2 ——
 * matrix(slot.transform) · contentUvTransform（Back 签收线稿 plate）。
 * 组件本身只做「轮廓 + 底色 + 图案 + 附件 + 选中/点击/失败态」，
 * 不关心外层如何把设计单位投到屏幕。
 */

import type { FingerCode } from '@/lib/types';
import type { DecorationAsset } from '@/studio/preview/nail-assets';

export interface FingerNailContentProps {
  finger: FingerCode;
  /** 轮廓 path d（0.1mm 单位） */
  silhouetteD: string;
  /** 本指 clipPath id（外层 <defs> 已声明） */
  clipId: string;
  baseColor: string;
  failed: boolean;
  selected: boolean;
  patternMarkup: string | null;
  /** 图案/附件缩放：lengthMm / 18（图案按 medium 基准设计） */
  patternK: number;
  patternVisible: boolean;
  patternFadeMs: number;
  decoration?: DecorationAsset;
  /** 每 0.1mm 设计单位对应的屏幕 px（描边宽度换算） */
  strokeScale: number;
  readOnly?: boolean;
  onFingerClick?: (finger: FingerCode) => void;
  fingerLabel?: string;
}

export function FingerNailContent({
  finger,
  silhouetteD,
  clipId,
  baseColor,
  failed,
  selected,
  patternMarkup,
  patternK,
  patternVisible,
  patternFadeMs,
  decoration,
  strokeScale,
  readOnly = false,
  onFingerClick,
  fingerLabel,
}: FingerNailContentProps) {
  return (
    <>
      {/* 底色（改色即时像素级替换，无动画） */}
      <path d={silhouetteD} fill={failed ? '#D4D4D8' : baseColor} />
      {/* 图案（应用模板淡入淡出） */}
      {!failed && patternMarkup && (
        <g
          clipPath={`url(#${clipId})`}
          opacity={patternVisible ? 1 : 0}
          style={{ transition: `opacity ${patternFadeMs}ms ease-out` }}
        >
          <g transform={`scale(${patternK})`} dangerouslySetInnerHTML={{ __html: patternMarkup }} />
        </g>
      )}
      {/* 附件层（参数级逐指例外） */}
      {!failed && decoration && (
        <g
          transform={`translate(${decoration.defaults.x * patternK} ${decoration.defaults.y * patternK}) rotate(${decoration.defaults.rotation}) scale(${decoration.defaults.scale})`}
          dangerouslySetInnerHTML={{ __html: decoration.innerMarkup }}
        />
      )}
      {/* 轮廓线 */}
      <path
        d={silhouetteD}
        fill="none"
        stroke={failed ? '#A1A1AA' : 'rgba(60,40,50,0.35)'}
        strokeWidth={1.4 / strokeScale}
        strokeLinejoin="round"
      />
      {selected && (
        <path
          d={silhouetteD}
          fill="none"
          stroke="#C2497A"
          strokeWidth={2.6 / strokeScale}
          strokeLinejoin="round"
        />
      )}
      {/* 点击热区 */}
      {!readOnly && onFingerClick && (
        <path
          d={silhouetteD}
          fill="transparent"
          pointerEvents="all"
          style={{ cursor: 'pointer' }}
          onClick={() => onFingerClick(finger)}
        >
          {fingerLabel ? <title>{fingerLabel}</title> : null}
        </path>
      )}
    </>
  );
}
