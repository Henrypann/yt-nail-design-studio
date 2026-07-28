/**
 * Affine projection for NailSlot V2 (no nailScale / PX_PER_MM).
 *
 * Local UV (canonical):
 *   rootLeft  (0, 1) · rootRight (1, 1) · tipCenter (0.5, 0)
 *   root center (0.5, 1)
 *
 * SVG matrix(a b c d e f):
 *   x' = a*x + c*y + e
 *   y' = b*x + d*y + f
 * Stored as [a, b, c, d, tx, ty] with tx=e, ty=f.
 */

import type { AffineMatrix, PointPx } from './types';

export function dist(a: PointPx, b: PointPx): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

export function midpoint(a: PointPx, b: PointPx): PointPx {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

/** Clockwise degrees from 12 o'clock (image up = −Y) along root→tip. */
export function rotationDegFromAxis(rootCenter: PointPx, tipCenter: PointPx): number {
  const dx = tipCenter.x - rootCenter.x;
  const dyUp = rootCenter.y - tipCenter.y; // image up
  return (Math.atan2(dx, dyUp) * 180) / Math.PI;
}

/**
 * Build SVG affine from three nail-bed landmarks.
 * Allows non-uniform scale (sx ≠ sy) + rotation + translation.
 */
export function affineFromLandmarks(
  rootLeft: PointPx,
  rootRight: PointPx,
  tipCenter: PointPx,
): AffineMatrix {
  // Local: RL(0,1), RR(1,1), tip(0.5,0)
  const a = rootRight.x - rootLeft.x;
  const c = rootLeft.x + 0.5 * a - tipCenter.x;
  const tx = rootLeft.x - c;

  const b = rootRight.y - rootLeft.y;
  const d = rootLeft.y + 0.5 * b - tipCenter.y;
  const ty = rootLeft.y - d;

  return [a, b, c, d, tx, ty];
}

/** Apply SVG affine to a local UV point. */
export function applyAffine(m: AffineMatrix, p: PointPx): PointPx {
  const [a, b, c, d, tx, ty] = m;
  return {
    x: a * p.x + c * p.y + tx,
    y: b * p.x + d * p.y + ty,
  };
}

/** Invert affine (for debugging / picking). Returns null if singular. */
export function invertAffine(m: AffineMatrix): AffineMatrix | null {
  const [a, b, c, d, tx, ty] = m;
  const det = a * d - b * c;
  if (Math.abs(det) < 1e-12) return null;
  const ia = d / det;
  const ib = -b / det;
  const ic = -c / det;
  const id = a / det;
  const itx = -(ia * tx + ic * ty);
  const ity = -(ib * tx + id * ty);
  return [ia, ib, ic, id, itx, ity];
}

export function formatSvgMatrix(m: AffineMatrix): string {
  const [a, b, c, d, tx, ty] = m;
  return `matrix(${a} ${b} ${c} ${d} ${tx} ${ty})`;
}

/** Alias matching tools/slot-calibrator/slot_math.ts */
export const buildTransform = affineFromLandmarks;

export function uvToStage(u: number, v: number, m: AffineMatrix): PointPx {
  return applyAffine(m, { x: u, y: v });
}

/**
 * Length rule on the matrix alone: root (v=1) fixed; scale tip-ward axis.
 * Equivalent to tools/slot-calibrator `lengthScaleTowardTip`.
 */
export function lengthScaleTowardTip(
  m: AffineMatrix,
  targetMm: number,
  baseMm = 18,
): AffineMatrix {
  const s = targetMm / baseMm;
  const [a, b, c, d, tx, ty] = m;
  return [a, b, s * c, s * d, tx + (1 - s) * c, ty + (1 - s) * d];
}
