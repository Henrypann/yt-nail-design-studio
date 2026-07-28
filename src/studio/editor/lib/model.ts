/**
 * Editor 文档模型（模块 4）
 *
 * 对应 PRD §15.1 桥接产物：base 层锁定（只能改色）、模板实例化为 pattern 层
 * template_pattern 元素、attachment 层预制组件 + heightMm（0.05–0.30mm 唯一高度通路）、
 * fingerLocks 空 = 十指同步、history 由 store 内存维护（初始空）。
 * 坐标空间与图案 SVG 一致：0.1mm 单位，原点 = 甲根中心，甲尖在负 y。
 */

import type { FingerCode, Finish, NailLength, NailShape } from '@/lib/types';

export interface Transform {
  x: number;
  y: number;
  scale: number;
  rotation: number;
}

export const IDENTITY_TRANSFORM: Transform = { x: 0, y: 0, scale: 1, rotation: 0 };

/* ── 图案层元素 ───────────────────────────────────────── */

export interface TemplatePatternElement {
  id: string;
  kind: 'template_pattern';
  templateId: string;
  name: string;
  transform: Transform;
  editable: true;
}

export interface BrushElement {
  id: string;
  kind: 'brush';
  points: { x: number; y: number }[];
  color: string;
  /** 线宽（0.1mm 单位） */
  size: number;
  opacity: number;
}

/** 橡皮擦笔画：作用于图案层的蒙版（模板/手绘/导入统一可被擦除） */
export interface EraserElement {
  id: string;
  kind: 'eraser';
  points: { x: number; y: number }[];
  size: number;
}

export interface ImageElement {
  id: string;
  kind: 'image';
  name: string;
  dataUrl: string;
  /** 原始像素尺寸（用于保持纵横比） */
  width: number;
  height: number;
  transform: Transform;
}

export type FrenchEdgeVariant = 'arc' | 'v' | 'double';

/** 经典法式三点控制（均为距甲尖的纵向距离；两侧 X 始终吸附真实甲缘） */
export interface ClassicFrenchControls {
  leftWingOffset: number;
  centerOffset: number;
  rightWingOffset: number;
}

/** 参数化法式边：甲尖填色区 + 微笑线/边线描边 */
export interface FrenchEdgeElement {
  id: string;
  kind: 'french_edge';
  variant: FrenchEdgeVariant;
  /** 甲尖区域填色；外边缘始终由当前甲型 silhouette 裁切 */
  fillColor: string;
  /** 可选微笑线/金属细边，经典法式默认关闭 */
  outlineEnabled: boolean;
  strokeColor: string;
  /** 线宽（0.1mm 单位） */
  strokeWidth: number;
  /** 微笑线两侧翼点距甲尖的距离（0.1mm，正数） */
  tipOffset: number;
  /** 微笑线中心相对两侧翼点向甲根深入的距离（0.1mm） */
  smileDepth: number;
  /** 仅经典弧使用：左翼、中心、右翼三个可拖拽控制点 */
  classicControls?: ClassicFrenchControls;
  /** double 变体两线间距（0.1mm） */
  lineGap?: number;
  /** 保留兼容旧文档；French UI 不开放自由变换，确保始终贴合甲尖 */
  transform: Transform;
}

export type PatternElement =
  | TemplatePatternElement
  | BrushElement
  | EraserElement
  | ImageElement
  | FrenchEdgeElement;

/* ── 附件层元素（禁透明度控制；heightMm 唯一立体高度通路） ── */

export const HEIGHT_MIN_MM = 0.05;
export const HEIGHT_MAX_MM = 0.3;

export interface AttachmentElement {
  id: string;
  kind: 'attachment';
  decorationId: string;
  name: string;
  transform: Transform;
  heightMm: number;
}

/* ── 逐指数据（解锁指的独立副本） ──────────────────────── */

export interface FingerData {
  baseColor: string;
  pattern: PatternElement[];
  attachments: AttachmentElement[];
}

/* ── Editor 文档 ─────────────────────────────────────── */

export interface EditorDoc {
  schemaVersion: 1;
  designId: string;
  customerId?: string;
  shape: NailShape;
  length: NailLength;
  finish: Finish;
  /** 底色层（锁定，只能改色） */
  baseColor: string;
  /** 图案层（共享基指数据） */
  pattern: PatternElement[];
  /** 附件层（共享基指数据） */
  attachments: AttachmentElement[];
  /** 逐指解锁：存在条目 = 该指独立编辑；空 = 十指同步 */
  fingerLocks: Partial<Record<FingerCode, FingerData>>;
  /** 主视觉指（同步基指，典型 R4 无名指） */
  masterFinger: FingerCode;
  updatedAt: string;
}

export function emptyFingerData(baseColor: string): FingerData {
  return { baseColor, pattern: [], attachments: [] };
}

/** 解析某指的显示数据：解锁指用独立副本，否则用共享基指数据 */
export function resolveFingerData(doc: EditorDoc, finger: FingerCode): FingerData {
  const locked = doc.fingerLocks[finger];
  if (locked) return locked;
  return { baseColor: doc.baseColor, pattern: doc.pattern, attachments: doc.attachments };
}

export function isFingerUnlocked(doc: EditorDoc, finger: FingerCode): boolean {
  return doc.fingerLocks[finger] !== undefined;
}

export function createBlankDoc(opts: {
  designId: string;
  customerId?: string;
  shape: NailShape;
  length: NailLength;
  baseColor?: string;
  finish?: Finish;
}): EditorDoc {
  return {
    schemaVersion: 1,
    designId: opts.designId,
    customerId: opts.customerId,
    shape: opts.shape,
    length: opts.length,
    finish: opts.finish ?? 'gloss',
    baseColor: opts.baseColor ?? '#FBF5F0',
    pattern: [],
    attachments: [],
    fingerLocks: {},
    masterFinger: 'R4',
    updatedAt: new Date().toISOString(),
  };
}

let idCounter = 0;
export function genId(prefix: string): string {
  idCounter += 1;
  return `${prefix}_${Date.now().toString(36)}_${idCounter.toString(36)}${Math.random()
    .toString(36)
    .slice(2, 6)}`;
}
