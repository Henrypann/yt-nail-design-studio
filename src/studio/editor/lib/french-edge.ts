/**
 * 法式甲尖参数化路径生成（0.1mm 剪影坐标系）。
 *
 * 甲尖在负 y。甲尖填色区域由「真实 silhouette 外轮廓 + 微笑线」共同围合：
 * - 外边缘始终交给项目唯一 silhouette clipPath；
 * - 内边缘的两侧翼点由真实轮廓水平求交得到；
 * - 经典弧中心明确朝甲尖（centerY < wingY），由三点控制值决定；
 * - smileDepth 仅保留给 V 形 / 双线的旧参数语义。
 */

import type { SilhouetteInfo } from './material.ts';
import type {
  ClassicFrenchControls,
  FrenchEdgeElement,
} from './model.ts';

// 经典法式的两侧翼点需要落到甲型已经展开的侧壁，避免形成尖端“小帽子”。
const TIP_OFFSET_RATIO = 0.34;
const SMILE_DEPTH_RATIO = 0.1;
const CLASSIC_CENTER_OFFSET_RATIO = 0.18;
const DEFAULT_STROKE_WIDTH = 4;
const DEFAULT_LINE_GAP = 8;
const CURVE_SAMPLE_STEPS = 24;

interface Point {
  x: number;
  y: number;
}

export interface SilhouetteMetrics {
  tipY: number;
  rootY: number;
  nailLength: number;
  maxHalfWidth: number;
  outline: Point[];
}

function parseViewBox(viewBox: string): [number, number, number, number] {
  const [x, y, w, h] = viewBox.split(/\s+/).map(Number);
  return [x, y, w, h];
}

function cubicPoint(p0: Point, p1: Point, p2: Point, p3: Point, t: number): Point {
  const mt = 1 - t;
  return {
    x:
      mt * mt * mt * p0.x +
      3 * mt * mt * t * p1.x +
      3 * mt * t * t * p2.x +
      t * t * t * p3.x,
    y:
      mt * mt * mt * p0.y +
      3 * mt * mt * t * p1.y +
      3 * mt * t * t * p2.y +
      t * t * t * p3.y,
  };
}

function quadraticPoint(p0: Point, p1: Point, p2: Point, t: number): Point {
  const mt = 1 - t;
  return {
    x: mt * mt * p0.x + 2 * mt * t * p1.x + t * t * p2.x,
    y: mt * mt * p0.y + 2 * mt * t * p1.y + t * t * p2.y,
  };
}

/**
 * 将当前资产使用的绝对 SVG path 指令采样为闭合折线。
 * 支持 M/L/H/V/C/Q/Z；不改变或复制 silhouette 参数。
 */
export function sampleSilhouettePath(pathD: string): Point[] {
  const tokens =
    pathD.match(/[MLHVQCZ]|-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/gi) ?? [];
  const points: Point[] = [];
  let i = 0;
  let command = '';
  let current: Point = { x: 0, y: 0 };
  let start: Point = { x: 0, y: 0 };

  const isCommand = (token: string) => /^[MLHVQCZ]$/i.test(token);
  const number = () => Number(tokens[i++]);
  const append = (point: Point) => {
    current = point;
    points.push(point);
  };

  while (i < tokens.length) {
    if (isCommand(tokens[i])) command = tokens[i++].toUpperCase();
    if (!command) break;

    if (command === 'M') {
      const point = { x: number(), y: number() };
      append(point);
      start = point;
      command = 'L';
    } else if (command === 'L') {
      append({ x: number(), y: number() });
    } else if (command === 'H') {
      append({ x: number(), y: current.y });
    } else if (command === 'V') {
      append({ x: current.x, y: number() });
    } else if (command === 'C') {
      const from = current;
      const c1 = { x: number(), y: number() };
      const c2 = { x: number(), y: number() };
      const to = { x: number(), y: number() };
      for (let step = 1; step <= CURVE_SAMPLE_STEPS; step += 1) {
        append(cubicPoint(from, c1, c2, to, step / CURVE_SAMPLE_STEPS));
      }
    } else if (command === 'Q') {
      const from = current;
      const control = { x: number(), y: number() };
      const to = { x: number(), y: number() };
      for (let step = 1; step <= CURVE_SAMPLE_STEPS; step += 1) {
        append(quadraticPoint(from, control, to, step / CURVE_SAMPLE_STEPS));
      }
    } else if (command === 'Z') {
      if (current.x !== start.x || current.y !== start.y) append({ ...start });
      command = '';
    } else {
      break;
    }
  }

  return points;
}

export function silhouetteMetrics(sil: SilhouetteInfo): SilhouetteMetrics {
  const [, vy, vw, vh] = parseViewBox(sil.viewBox);
  const outline = sampleSilhouettePath(sil.pathD);
  const xs = outline.map((point) => point.x);
  const ys = outline.map((point) => point.y);
  const tipY = ys.length > 0 ? Math.min(...ys) : vy + 2;
  const rootY = ys.length > 0 ? Math.max(...ys) : vy + vh - 10;
  const maxHalfWidth =
    xs.length > 0 ? Math.max(...xs.map((x) => Math.abs(x))) : vw / 2;
  return { tipY, rootY, nailLength: rootY - tipY, maxHalfWidth, outline };
}

/** 求真实 silhouette 与水平线 y 的最左/最右交点。 */
export function outlineIntersectionsAtY(
  metrics: SilhouetteMetrics,
  y: number,
): { left: number; right: number } {
  const intersections: number[] = [];
  const points = metrics.outline;

  for (let i = 0; i < points.length - 1; i += 1) {
    const a = points[i];
    const b = points[i + 1];
    const minY = Math.min(a.y, b.y);
    const maxY = Math.max(a.y, b.y);
    if (y < minY || y > maxY) continue;

    if (Math.abs(a.y - b.y) < 1e-6) {
      if (Math.abs(y - a.y) < 1e-6) intersections.push(a.x, b.x);
      continue;
    }

    const t = (y - a.y) / (b.y - a.y);
    if (t >= 0 && t <= 1) intersections.push(a.x + (b.x - a.x) * t);
  }

  if (intersections.length < 2) {
    return { left: -metrics.maxHalfWidth, right: metrics.maxHalfWidth };
  }
  return { left: Math.min(...intersections), right: Math.max(...intersections) };
}

export function defaultFrenchParams(
  sil: SilhouetteInfo,
): Pick<
  FrenchEdgeElement,
  'tipOffset' | 'smileDepth' | 'strokeWidth' | 'lineGap'
> {
  const m = silhouetteMetrics(sil);
  return {
    tipOffset: Math.round(m.nailLength * TIP_OFFSET_RATIO),
    smileDepth: Math.round(m.nailLength * SMILE_DEPTH_RATIO),
    strokeWidth: DEFAULT_STROKE_WIDTH,
    lineGap: DEFAULT_LINE_GAP,
  };
}

function fmt(n: number): string {
  return n.toFixed(1);
}

export interface FrenchEdgePaths {
  fillD: string;
  strokePaths: string[];
  wingY: number;
  centerY: number;
  leftWingY: number;
  rightWingY: number;
  wingLeftX: number;
  wingRightX: number;
}

function clampedWingY(m: SilhouetteMetrics, tipOffset: number): number {
  return Math.min(
    m.rootY - 2,
    Math.max(m.tipY + 2, m.tipY + Math.max(2, tipOffset)),
  );
}

export function defaultClassicControls(
  sil: SilhouetteInfo,
): ClassicFrenchControls {
  const m = silhouetteMetrics(sil);
  const wingOffset = Math.round(m.nailLength * TIP_OFFSET_RATIO);
  return {
    leftWingOffset: wingOffset,
    centerOffset: Math.round(m.nailLength * CLASSIC_CENTER_OFFSET_RATIO),
    rightWingOffset: wingOffset,
  };
}

export function resolveClassicControls(
  sil: SilhouetteInfo,
  el: Pick<
    FrenchEdgeElement,
    'tipOffset' | 'smileDepth' | 'classicControls'
  >,
): ClassicFrenchControls {
  if (el.classicControls) return el.classicControls;
  const fallback = defaultClassicControls(sil);
  if (!Number.isFinite(el.tipOffset)) return fallback;
  const centerOffset = Math.max(
    2,
    el.tipOffset - (Number.isFinite(el.smileDepth) ? el.smileDepth : 0),
  );
  return {
    leftWingOffset: el.tipOffset,
    centerOffset,
    rightWingOffset: el.tipOffset,
  };
}

export type ClassicFrenchHandle = 'left' | 'center' | 'right';

/** 经典法式控制柄拖拽约束：中心始终在两侧翼点的甲尖侧。 */
export function updateClassicControlsForHandle(
  controls: ClassicFrenchControls,
  handle: ClassicFrenchHandle,
  rawOffset: number,
  maxOffset: number,
): ClassicFrenchControls {
  const offset = Math.min(maxOffset, Math.max(2, rawOffset));
  const next = { ...controls };
  if (handle === 'center') {
    next.centerOffset = Math.max(
      2,
      Math.min(
        offset,
        Math.min(next.leftWingOffset, next.rightWingOffset) - 2,
      ),
    );
  } else if (handle === 'left') {
    next.leftWingOffset = Math.max(offset, next.centerOffset + 2);
  } else {
    next.rightWingOffset = Math.max(offset, next.centerOffset + 2);
  }
  return next;
}

function buildArcPaths(
  m: SilhouetteMetrics,
  controls: ClassicFrenchControls,
): FrenchEdgePaths {
  const leftWingY = clampedWingY(m, controls.leftWingOffset);
  const rightWingY = clampedWingY(m, controls.rightWingOffset);
  const leftWings = outlineIntersectionsAtY(m, leftWingY);
  const rightWings = outlineIntersectionsAtY(m, rightWingY);
  const centerUpperLimit = Math.min(leftWingY, rightWingY) - 2;
  const centerY = Math.min(
    centerUpperLimit,
    Math.max(m.tipY + 2, m.tipY + Math.max(2, controls.centerOffset)),
  );
  const wingLeftX = leftWings.left;
  const wingRightX = rightWings.right;

  // 用户定义的经典法式：中心朝甲尖方向，即 centerY < 两侧 wingY。
  // 双三次 Bézier 保证中心切线水平，两侧分别贴合真实甲缘交点。
  const leftControl1 = {
    x: wingLeftX * 0.78,
    y: leftWingY + (centerY - leftWingY) * 0.16,
  };
  const leftControl2 = {
    x: wingLeftX * 0.42,
    y: centerY,
  };
  const rightControl1 = {
    x: wingRightX * 0.42,
    y: centerY,
  };
  const rightControl2 = {
    x: wingRightX * 0.78,
    y: rightWingY + (centerY - rightWingY) * 0.16,
  };
  const smileD =
    `M ${fmt(wingLeftX)} ${fmt(leftWingY)} ` +
    `C ${fmt(leftControl1.x)} ${fmt(leftControl1.y)} ` +
    `${fmt(leftControl2.x)} ${fmt(leftControl2.y)} 0 ${fmt(centerY)} ` +
    `C ${fmt(rightControl1.x)} ${fmt(rightControl1.y)} ` +
    `${fmt(rightControl2.x)} ${fmt(rightControl2.y)} ` +
    `${fmt(wingRightX)} ${fmt(rightWingY)}`;
  const capTopY = m.tipY - 4;
  const fillD =
    `${smileD} ` +
    `L ${fmt(m.maxHalfWidth + 4)} ${fmt(capTopY)} ` +
    `L ${fmt(-m.maxHalfWidth - 4)} ${fmt(capTopY)} Z`;

  return {
    fillD,
    strokePaths: [smileD],
    wingY: (leftWingY + rightWingY) / 2,
    centerY,
    leftWingY,
    rightWingY,
    wingLeftX,
    wingRightX,
  };
}

function buildVPaths(
  m: SilhouetteMetrics,
  tipOffset: number,
  smileDepth: number,
): FrenchEdgePaths {
  const wingY = clampedWingY(m, tipOffset);
  const wings = outlineIntersectionsAtY(m, wingY);
  const centerY = Math.min(m.rootY - 2, wingY + Math.max(0, smileDepth));
  const capTopY = m.tipY - 4;
  const fillD =
    `M ${fmt(wings.left)} ${fmt(wingY)} ` +
    `L 0 ${fmt(centerY)} L ${fmt(wings.right)} ${fmt(wingY)} ` +
    `L ${fmt(m.maxHalfWidth + 4)} ${fmt(capTopY)} ` +
    `L ${fmt(-m.maxHalfWidth - 4)} ${fmt(capTopY)} Z`;
  const strokeD =
    `M ${fmt(wings.left)} ${fmt(wingY)} ` +
    `L 0 ${fmt(centerY)} L ${fmt(wings.right)} ${fmt(wingY)}`;

  return {
    fillD,
    strokePaths: [strokeD],
    wingY,
    centerY,
    leftWingY: wingY,
    rightWingY: wingY,
    wingLeftX: wings.left,
    wingRightX: wings.right,
  };
}

function buildDoublePaths(
  m: SilhouetteMetrics,
  tipOffset: number,
  smileDepth: number,
  lineGap: number,
): FrenchEdgePaths {
  const wingY = clampedWingY(m, tipOffset);
  const wings = outlineIntersectionsAtY(m, wingY);
  const centerY = Math.min(m.rootY - 2, wingY + Math.max(0, smileDepth));
  const outerStroke =
    `M ${fmt(wings.left)} ${fmt(wingY)} ` +
    `C ${fmt(wings.left * 0.78)} ${fmt(wingY + smileDepth * 0.16)} ` +
    `${fmt(wings.left * 0.42)} ${fmt(centerY)} 0 ${fmt(centerY)} ` +
    `C ${fmt(wings.right * 0.42)} ${fmt(centerY)} ` +
    `${fmt(wings.right * 0.78)} ${fmt(wingY + smileDepth * 0.16)} ` +
    `${fmt(wings.right)} ${fmt(wingY)}`;
  const capTopY = m.tipY - 4;
  const outer: FrenchEdgePaths = {
    fillD:
      `${outerStroke} L ${fmt(m.maxHalfWidth + 4)} ${fmt(capTopY)} ` +
      `L ${fmt(-m.maxHalfWidth - 4)} ${fmt(capTopY)} Z`,
    strokePaths: [outerStroke],
    wingY,
    centerY,
    leftWingY: wingY,
    rightWingY: wingY,
    wingLeftX: wings.left,
    wingRightX: wings.right,
  };
  const innerWingY = clampedWingY(m, tipOffset + Math.max(2, lineGap));
  const innerWings = outlineIntersectionsAtY(m, innerWingY);
  const innerDepth = Math.min(
    Math.max(0, smileDepth),
    Math.max(0, m.rootY - innerWingY - 2),
  );
  const innerCenterY = innerWingY + innerDepth;
  const innerStroke =
    `M ${fmt(innerWings.left)} ${fmt(innerWingY)} ` +
    `C ${fmt(innerWings.left * 0.78)} ${fmt(innerWingY + innerDepth * 0.16)} ` +
    `${fmt(innerWings.left * 0.42)} ${fmt(innerCenterY)} 0 ${fmt(innerCenterY)} ` +
    `C ${fmt(innerWings.right * 0.42)} ${fmt(innerCenterY)} ` +
    `${fmt(innerWings.right * 0.78)} ${fmt(innerWingY + innerDepth * 0.16)} ` +
    `${fmt(innerWings.right)} ${fmt(innerWingY)}`;

  return { ...outer, strokePaths: [...outer.strokePaths, innerStroke] };
}

export function buildFrenchEdgePaths(
  sil: SilhouetteInfo,
  el: Pick<
    FrenchEdgeElement,
    'variant' | 'tipOffset' | 'smileDepth' | 'lineGap' | 'classicControls'
  >,
): FrenchEdgePaths {
  const m = silhouetteMetrics(sil);
  const defaults = defaultFrenchParams(sil);
  const gap = el.lineGap ?? DEFAULT_LINE_GAP;
  // 兼容功能上线前已写入 localStorage、尚无 smileDepth 的法式元素。
  const tipOffset = Number.isFinite(el.tipOffset)
    ? el.tipOffset
    : defaults.tipOffset;
  const smileDepth = Number.isFinite(el.smileDepth)
    ? el.smileDepth
    : defaults.smileDepth;

  switch (el.variant) {
    case 'arc':
      return buildArcPaths(m, resolveClassicControls(sil, el));
    case 'v':
      return buildVPaths(m, tipOffset, smileDepth);
    case 'double':
      return buildDoublePaths(m, tipOffset, smileDepth, gap);
  }
}

export const FRENCH_VARIANT_LABELS: Record<FrenchEdgeElement['variant'], string> = {
  arc: '经典弧',
  v: 'V形',
  double: '双线',
};
