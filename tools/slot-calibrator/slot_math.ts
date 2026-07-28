/**
 * NailSlot V2 affine math (no React, no PX_PER_MM / nailScale).
 *
 * Local UV: rootCenter=(0.5,1), tipCenter=(0.5,0)
 * SVG matrix(a b c d tx ty): x = a*u + c*v + tx; y = b*u + d*v + ty
 *
 * Agent 3 consumption:
 *   1. Load slots.back.v2.json
 *   2. For each finger, take slot.transform
 *   3. Map nail local design UV (or 0.1mm silhouette normalized into UV) via uvToStage
 *   4. Apply ONE stage transform for responsive canvas; never rescale slots individually
 *   5. Length changes: keep root (v=1) fixed; extend toward tip with lengthScaleTowardTip
 */

export type Point = { x: number; y: number };
export type Mat2D = [number, number, number, number, number, number]; // a b c d tx ty

export const LOCAL_UV = {
  rootCenter: { u: 0.5, v: 1 },
  tipCenter: { u: 0.5, v: 0 },
} as const;

/** Reference visible lengths used when authoring the plate (px along root→tip). */
export const BASE_LENGTH_MM = 18;

export function uvToStage(u: number, v: number, m: Mat2D): Point {
  const [a, b, c, d, tx, ty] = m;
  return { x: a * u + c * v + tx, y: b * u + d * v + ty };
}

export function stageToUv(p: Point, m: Mat2D): { u: number; v: number } {
  const [a, b, c, d, tx, ty] = m;
  const x = p.x - tx;
  const y = p.y - ty;
  const det = a * d - b * c;
  if (Math.abs(det) < 1e-9) throw new Error("singular NailSlot transform");
  return {
    u: (d * x - c * y) / det,
    v: (-b * x + a * y) / det,
  };
}

/** Build affine from rootLeft, rootRight, tipCenter (asset px). */
export function buildTransform(
  rootLeft: Point,
  rootRight: Point,
  tipCenter: Point,
): Mat2D {
  const rootC = {
    x: (rootLeft.x + rootRight.x) / 2,
    y: (rootLeft.y + rootRight.y) / 2,
  };
  const U = { x: rootRight.x - rootLeft.x, y: rootRight.y - rootLeft.y };
  const V = { x: rootC.x - tipCenter.x, y: rootC.y - tipCenter.y };
  const T = { x: tipCenter.x - 0.5 * U.x, y: tipCenter.y - 0.5 * U.y };
  return [U.x, U.y, V.x, V.y, T.x, T.y];
}

export function rotationDegFromRootTip(rootCenter: Point, tipCenter: Point): number {
  const ax = tipCenter.x - rootCenter.x;
  const ay = tipCenter.y - rootCenter.y;
  // 0° = pointing image-up (-y)
  return (Math.atan2(ax, -ay) * 180) / Math.PI;
}

/**
 * Length rule: root (v=1) fixed. Scale the tip-ward axis so visible length
 * matches targetMm relative to baseMm (default 18mm medium).
 * Returns a new matrix; rootLeft/rootRight world positions stay put.
 */
export function lengthScaleTowardTip(
  m: Mat2D,
  targetMm: number,
  baseMm: number = BASE_LENGTH_MM,
): Mat2D {
  const s = targetMm / baseMm;
  const [a, b, c, d, tx, ty] = m;
  // Keep v=1 fixed: p(u,1) unchanged ⇒ T' + U'*u + V' = T + U*u + V
  // Choose U'=U, V'=s*V, T'= T + V - s*V = T + (1-s)V
  const V = { x: c, y: d };
  return [
    a,
    b,
    s * c,
    s * d,
    tx + (1 - s) * V.x,
    ty + (1 - s) * V.y,
  ];
}

/** SVG transform attribute helper */
export function matrixAttr(m: Mat2D): string {
  const [a, b, c, d, tx, ty] = m;
  return `matrix(${a} ${b} ${c} ${d} ${tx} ${ty})`;
}
