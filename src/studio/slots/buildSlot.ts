/**
 * Build a complete NailSlotV2 from landmarks (+ optional contour).
 */

import {
  affineFromLandmarks,
  dist,
  midpoint,
  rotationDegFromAxis,
} from './affine';
import {
  FINGER_ROLE_BY_CODE,
  type HandViewV2,
  type NailSlotV2,
  type PointPx,
} from './types';
import type { FingerCode } from '@/lib/types';

/** Simple oval-ish contour from three landmarks (fallback when no traced path). */
export function approximateContour(
  rootLeft: PointPx,
  rootRight: PointPx,
  tipCenter: PointPx,
  segments = 28,
): PointPx[] {
  const root = midpoint(rootLeft, rootRight);
  const width = dist(rootLeft, rootRight);
  const ax = tipCenter.x - root.x;
  const ay = tipCenter.y - root.y;
  const al = Math.hypot(ax, ay) || 1;
  const ux = ax / al;
  const uy = ay / al;
  const px = uy; // perpendicular
  const py = -ux;

  const pts: PointPx[] = [];
  // Parametric: t 0→2π, v 0 tip … 1 root; ellipse in local frame
  for (let i = 0; i < segments; i++) {
    const theta = (i / segments) * Math.PI * 2;
    // u in [-0.5,0.5], v in [0,1] with v=0 at tip
    const localU = 0.5 * Math.cos(theta);
    const localV = 0.5 + 0.5 * Math.sin(theta); // 0 tip-ish when sin=-1 → v=0
    const along = (1 - localV) * al;
    const lat = localU * width;
    pts.push({
      x: root.x + along * ux + lat * px,
      y: root.y + along * uy + lat * py,
    });
  }
  return pts;
}

export function buildNailSlotV2(input: {
  fingerCode: FingerCode;
  view?: HandViewV2;
  rootLeft: PointPx;
  rootRight: PointPx;
  tipCenter: PointPx;
  contourPolyline?: PointPx[];
}): NailSlotV2 {
  const view = input.view ?? 'back';
  let { rootLeft, rootRight, tipCenter } = input;
  if (rootLeft.x > rootRight.x) {
    const tmp = rootLeft;
    rootLeft = rootRight;
    rootRight = tmp;
  }
  const center = midpoint(rootLeft, rootRight);
  const nailBedWidthPx = dist(rootLeft, rootRight);
  const visibleLengthPx = dist(center, tipCenter);
  const rotationDeg = rotationDegFromAxis(center, tipCenter);
  const transform = affineFromLandmarks(rootLeft, rootRight, tipCenter);
  const contourPolyline =
    input.contourPolyline && input.contourPolyline.length >= 3
      ? input.contourPolyline
      : approximateContour(rootLeft, rootRight, tipCenter);

  return {
    id: `${view}-${input.fingerCode}`,
    fingerCode: input.fingerCode,
    fingerRole: FINGER_ROLE_BY_CODE[input.fingerCode],
    view,
    rootLeft,
    rootRight,
    tipCenter,
    center,
    rotationDeg,
    nailBedWidthPx,
    visibleLengthPx,
    transform,
    contourPolyline,
  };
}
