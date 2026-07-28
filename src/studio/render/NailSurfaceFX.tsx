/**
 * 二维高保真甲面效果层（纯 SVG 矢量，无位图贴图、无第二套轮廓）
 *
 * 全部基于 objectBoundingBox 渐变（渐变的 cx/cy/r 相对甲面外接盒定位，
 * 圆形渐变在 bbox 映射下自然形成纵向椭圆高光带），与具体甲型/长度几何无关：
 * - 本体层（底色之上、图案之下）：纵向弧面渐变（甲尖厚度暗边 → 中段提亮 →
 *   甘皮区域阴影）+ 侧缘弧面阴影（模拟甲面横弧）
 * - 封层层（图案/附件之上）：高光带，按 gloss / matte / pearl 三质感差异化
 *   gloss 锐利收窄；pearl 宽柔珠光（主+副双带）；matte 近乎无高光、弧面收敛
 */

import type { Finish } from '@/lib/types';

interface FinishFx {
  /** 主高光：中心位置与半径（bbox 比例）、不透明度 */
  hl: { cx: number; cy: number; r: number; opacity: number };
  /** 副高光（pearl 珠光层次） */
  hl2?: { cx: number; cy: number; r: number; opacity: number };
  /** 侧缘阴影强度系数 */
  edgeK: number;
  /** 纵向弧面渐变强度系数 */
  arcK: number;
}

const FINISH_FX: Record<Finish, FinishFx> = {
  gloss: {
    hl: { cx: 0.37, cy: 0.36, r: 0.3, opacity: 0.55 },
    edgeK: 1,
    arcK: 1,
  },
  pearl: {
    hl: { cx: 0.4, cy: 0.4, r: 0.48, opacity: 0.3 },
    hl2: { cx: 0.63, cy: 0.62, r: 0.4, opacity: 0.14 },
    edgeK: 0.8,
    arcK: 0.9,
  },
  matte: {
    hl: { cx: 0.42, cy: 0.4, r: 0.55, opacity: 0.08 },
    edgeK: 0.55,
    arcK: 0.7,
  },
};

/** 渐变 defs（每 svg 实例一份，fxId 已唯一化） */
export function NailSurfaceDefs({ fxId, finish }: { fxId: string; finish: Finish }) {
  const fx = FINISH_FX[finish];
  return (
    <defs>
      {/* 纵向弧面渐变：tip(y=0) 微暗 → 中段提亮 → root(y=1) 甘皮阴影 */}
      <linearGradient id={`${fxId}-arc`} x1={0} y1={0} x2={0} y2={1}>
        <stop offset="0" stopColor="#3C2832" stopOpacity={0.16 * fx.arcK} />
        <stop offset="0.12" stopColor="#3C2832" stopOpacity={0.05 * fx.arcK} />
        <stop offset="0.45" stopColor="#FFFFFF" stopOpacity={0.12 * fx.arcK} />
        <stop offset="0.78" stopColor="#3C2832" stopOpacity={0} />
        <stop offset="0.93" stopColor="#3C2832" stopOpacity={0.12 * fx.arcK} />
        <stop offset="1" stopColor="#3C2832" stopOpacity={0.2 * fx.arcK} />
      </linearGradient>
      {/* 侧缘弧面阴影：左右边缘向内收暗 */}
      <linearGradient id={`${fxId}-edge`} x1={0} y1={0} x2={1} y2={0}>
        <stop offset="0" stopColor="#3C2832" stopOpacity={0.18 * fx.edgeK} />
        <stop offset="0.18" stopColor="#3C2832" stopOpacity={0} />
        <stop offset="0.82" stopColor="#3C2832" stopOpacity={0} />
        <stop offset="1" stopColor="#3C2832" stopOpacity={0.18 * fx.edgeK} />
      </linearGradient>
      {/* 封层高光带（bbox 映射下呈纵向椭圆） */}
      <radialGradient id={`${fxId}-hl`} cx={fx.hl.cx} cy={fx.hl.cy} r={fx.hl.r}>
        <stop offset="0" stopColor="#FFFFFF" stopOpacity={fx.hl.opacity} />
        <stop offset="0.55" stopColor="#FFFFFF" stopOpacity={fx.hl.opacity * 0.4} />
        <stop offset="1" stopColor="#FFFFFF" stopOpacity={0} />
      </radialGradient>
      {fx.hl2 && (
        <radialGradient id={`${fxId}-hl2`} cx={fx.hl2.cx} cy={fx.hl2.cy} r={fx.hl2.r}>
          <stop offset="0" stopColor="#FFFFFF" stopOpacity={fx.hl2.opacity} />
          <stop offset="1" stopColor="#FFFFFF" stopOpacity={0} />
        </radialGradient>
      )}
    </defs>
  );
}

/** 本体阴影层：渲染在底色之上、图案之下（调用方包 clip group） */
export function NailSurfaceBody({ fxId, silhouetteD }: { fxId: string; silhouetteD: string }) {
  return (
    <>
      <path d={silhouetteD} fill={`url(#${fxId}-arc)`} />
      <path d={silhouetteD} fill={`url(#${fxId}-edge)`} />
    </>
  );
}

/** 封层高光：渲染在图案/附件之上（调用方包 clip group） */
export function NailTopcoatGloss({ fxId, finish, silhouetteD }: { fxId: string; finish: Finish; silhouetteD: string }) {
  const fx = FINISH_FX[finish];
  return (
    <>
      <path d={silhouetteD} fill={`url(#${fxId}-hl)`} />
      {fx.hl2 && <path d={silhouetteD} fill={`url(#${fxId}-hl2)`} />}
    </>
  );
}
