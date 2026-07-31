/**
 * Editor 文档模型（模块 4）
 *
 * 对应 PRD §15.1 桥接产物：base 层锁定（只能改色）、模板实例化为 pattern 层
 * template_pattern 元素、attachment 层预制组件 + heightMm（0.05–0.30mm 唯一高度通路）、
 * fingerLocks 空 = 十指同步、history 由 store 内存维护（初始空）。
 * 坐标空间与图案 SVG 一致：0.1mm 单位，原点 = 甲根中心，甲尖在负 y。
 */

import type { FingerCode, Finish, NailLength, NailShape } from '../../../lib/types.ts';
import type { RecipeInstanceV1, ReliefElement } from './recipe-model.ts';

export interface Transform {
  x: number;
  y: number;
  scale: number;
  rotation: number;
}

export const IDENTITY_TRANSFORM: Transform = { x: 0, y: 0, scale: 1, rotation: 0 };

export type LengthPreset = 'natural' | 'short-extension' | 'medium' | 'long';
export type BaseCoverage = 'opaque' | 'translucent';
export type OpticalEffect = 'none' | 'cat-eye' | 'aurora' | 'silk' | 'pearl';
export type TopFinish = 'gloss' | 'matte';
export type StyleDirection = 'classic' | 'fashion' | 'sweet' | 'art';
export type Occasion = 'commute' | 'date' | 'wedding' | 'party' | 'vacation';

export interface SurfaceAppearance {
  baseCoverage: BaseCoverage;
  opticalEffect: OpticalEffect;
  topFinish: TopFinish;
}

export interface DesignIntent {
  styleDirection?: StyleDirection;
  lookPresetId?: string;
  occasion?: Occasion;
}

/** 制造语义分区内的通用图层元数据；跨分区排序始终禁止。 */
export interface LayerElementMeta {
  name: string;
  visible: boolean;
  locked: boolean;
  order: number;
  source?: 'manual' | 'recipe';
  recipeId?: string;
}

export function createLayerMeta(name: string, order: number): LayerElementMeta {
  return { name, visible: true, locked: false, order };
}

export const LENGTH_PRESET_BY_GEOMETRY: Record<NailLength, LengthPreset> = {
  short: 'natural',
  medium: 'short-extension',
  long: 'medium',
  'extra-long': 'long',
};

export const GEOMETRY_LENGTH_BY_PRESET: Record<LengthPreset, NailLength> = {
  natural: 'short',
  'short-extension': 'medium',
  medium: 'long',
  long: 'extra-long',
};

export function appearanceFromLegacyFinish(finish: Finish): SurfaceAppearance {
  if (finish === 'matte') {
    return { baseCoverage: 'opaque', opticalEffect: 'none', topFinish: 'matte' };
  }
  if (finish === 'pearl') {
    return { baseCoverage: 'opaque', opticalEffect: 'pearl', topFinish: 'gloss' };
  }
  return { baseCoverage: 'opaque', opticalEffect: 'none', topFinish: 'gloss' };
}

/* ── 图案层元素 ───────────────────────────────────────── */

export interface TemplatePatternElement extends LayerElementMeta {
  id: string;
  kind: 'template_pattern';
  templateId: string;
  transform: Transform;
  editable: true;
}

export interface BrushElement extends LayerElementMeta {
  id: string;
  kind: 'brush';
  points: { x: number; y: number }[];
  color: string;
  /** 线宽（0.1mm 单位） */
  size: number;
  opacity: number;
}

/** 橡皮擦笔画：作用于图案层的蒙版（模板/手绘/导入统一可被擦除） */
export interface EraserElement extends LayerElementMeta {
  id: string;
  kind: 'eraser';
  points: { x: number; y: number }[];
  size: number;
}

export interface ImageElement extends LayerElementMeta {
  id: string;
  kind: 'image';
  dataUrl: string;
  /** 原始像素尺寸（用于保持纵横比） */
  width: number;
  height: number;
  transform: Transform;
}

/** 结构化裸色渐变 Recipe；使用甲面坐标，不依赖位图。 */
export interface GradientElement extends LayerElementMeta {
  id: string;
  kind: 'gradient';
  rootColor: string;
  tipColor: string;
  rootOpacity: number;
  tipOpacity: number;
}

export type FrenchEdgeVariant = 'arc' | 'v' | 'double';

/** 经典法式三点控制（均为距甲尖的纵向距离；两侧 X 始终吸附真实甲缘） */
export interface ClassicFrenchControls {
  leftWingOffset: number;
  centerOffset: number;
  rightWingOffset: number;
}

/** 参数化法式边：甲尖填色区 + 微笑线/边线描边 */
export interface FrenchEdgeElement extends LayerElementMeta {
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
  /** V 形 / 双线的中心深度；经典弧改由 classicControls 三点决定。 */
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
  | GradientElement
  | FrenchEdgeElement;

/* ── 附件层元素（禁透明度控制；heightMm 唯一立体高度通路） ── */

export const HEIGHT_MIN_MM = 0.05;
export const HEIGHT_MAX_MM = 0.3;

export interface AttachmentElement extends LayerElementMeta {
  id: string;
  kind: 'attachment';
  decorationId: string;
  transform: Transform;
  heightMm: number;
}

/* ── 逐指数据（解锁指的独立副本） ──────────────────────── */

export interface FingerData {
  baseColor: string;
  pattern: PatternElement[];
  attachments: AttachmentElement[];
}

export function normalizeFingerLayerOrders(data: FingerData): void {
  data.pattern.forEach((element, index) => {
    element.order = index;
  });
  data.attachments.forEach((element, index) => {
    element.order = index;
  });
}

/* ── Editor 文档 ─────────────────────────────────────── */

export interface EditorDoc {
  schemaVersion: 3;
  designId: string;
  customerId?: string;
  shape: NailShape;
  /** 现有 SVG 几何资产键；不可替换为 natural 等产品枚举。 */
  length: NailLength;
  /** 扫描相对长度语义；无扫描时由 length 提供 14/18/22/26mm 回退。 */
  lengthPreset: LengthPreset;
  appearance: SurfaceAppearance;
  /** 推荐上下文，不参与渲染分层。 */
  intent?: DesignIntent;
  /** 底色层（锁定，只能改色） */
  baseColor: string;
  /** 图案层（共享基指数据） */
  pattern: PatternElement[];
  /** 附件层（共享基指数据） */
  attachments: AttachmentElement[];
  /** Recipe 真源；派生图层不重复持久化。 */
  recipe?: RecipeInstanceV1;
  /** 自定义 L2 浮雕，Recipe 之外的手工结构预留。 */
  relief: ReliefElement[];
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

export function normalizeEditorLayerOrders(doc: EditorDoc): void {
  normalizeFingerLayerOrders(doc);
  Object.values(doc.fingerLocks).forEach((data) => {
    if (data) normalizeFingerLayerOrders(data);
  });
}

export function createBlankDoc(opts: {
  designId: string;
  customerId?: string;
  shape: NailShape;
  length: NailLength;
  baseColor?: string;
  lengthPreset?: LengthPreset;
  appearance?: SurfaceAppearance;
  /** 仅供旧创建入口兼容；新入口优先传 appearance。 */
  finish?: Finish;
}): EditorDoc {
  return {
    schemaVersion: 3,
    designId: opts.designId,
    customerId: opts.customerId,
    shape: opts.shape,
    length: opts.length,
    lengthPreset: opts.lengthPreset ?? LENGTH_PRESET_BY_GEOMETRY[opts.length],
    appearance: opts.appearance ?? appearanceFromLegacyFinish(opts.finish ?? 'gloss'),
    baseColor: opts.baseColor ?? '#FBF5F0',
    pattern: [],
    attachments: [],
    relief: [],
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
