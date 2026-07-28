/**
 * Length switching for NailSlot V2.
 * Root (cuticle) stays fixed; tip extends/retracts along root→tip axis only.
 * Does NOT use nailScale / PX_PER_MM.
 */

import { affineFromLandmarks, dist, midpoint } from './affine';
import type { NailLengthMm, NailSlotV2, PointPx } from './types';
import { NAIL_LENGTH_MM } from './types';

export { NAIL_LENGTH_MM };

function scaleFromRoot(root: PointPx, tip: PointPx, factor: number): PointPx {
  return {
    x: root.x + (tip.x - root.x) * factor,
    y: root.y + (tip.y - root.y) * factor,
  };
}

/**
 * Extend/retract a calibrated slot to a target manufacturing length (mm).
 * `referenceLengthMm` is the mm value represented by the illustrated plate nail
 * (default 18 = medium). Width landmarks stay put; only tip moves.
 */
export function extendSlotToLengthMm(
  slot: NailSlotV2,
  targetMm: NailLengthMm,
  referenceLengthMm: NailLengthMm = 18,
): NailSlotV2 {
  const factor = targetMm / referenceLengthMm;
  const rootCenter = midpoint(slot.rootLeft, slot.rootRight);
  const newTip = scaleFromRoot(rootCenter, slot.tipCenter, factor);
  const visibleLengthPx = dist(rootCenter, newTip);
  const transform = affineFromLandmarks(slot.rootLeft, slot.rootRight, newTip);

  const stretchPt = (p: PointPx): PointPx => {
    const ax = slot.tipCenter.x - rootCenter.x;
    const ay = slot.tipCenter.y - rootCenter.y;
    const al = Math.hypot(ax, ay) || 1;
    const ux = ax / al;
    const uy = ay / al;
    const along = (p.x - rootCenter.x) * ux + (p.y - rootCenter.y) * uy;
    if (along <= 0) return { ...p };
    const newAlong = along * factor;
    const lateralX = p.x - rootCenter.x - along * ux;
    const lateralY = p.y - rootCenter.y - along * uy;
    return {
      x: rootCenter.x + newAlong * ux + lateralX,
      y: rootCenter.y + newAlong * uy + lateralY,
    };
  };

  const contourPolyline = (slot.contourPolyline ?? []).map(stretchPt);

  return {
    ...slot,
    tipCenter: newTip,
    visibleLengthPx,
    transform,
    contourPolyline,
    center: midpoint(slot.rootLeft, slot.rootRight),
  };
}

/** Convenience: map Studio NailLength id → mm then extend. */
export function extendSlotToNailLength(
  slot: NailSlotV2,
  lengthId: keyof typeof NAIL_LENGTH_MM,
  referenceLengthMm: NailLengthMm = 18,
): NailSlotV2 {
  return extendSlotToLengthMm(slot, NAIL_LENGTH_MM[lengthId], referenceLengthMm);
}
