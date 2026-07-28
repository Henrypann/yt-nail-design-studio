export type {
  AffineMatrix,
  FingerRole,
  HandViewV2,
  NailLengthMm,
  NailSlotV2,
  NailSlotsV2File,
  PointPx,
} from './types';
export { FINGER_ROLE_BY_CODE, NAIL_LENGTH_MM } from './types';

export {
  affineFromLandmarks,
  applyAffine,
  buildTransform,
  dist,
  formatSvgMatrix,
  invertAffine,
  lengthScaleTowardTip,
  midpoint,
  rotationDegFromAxis,
  uvToStage,
} from './affine';

export {
  extendSlotToLengthMm,
  extendSlotToNailLength,
} from './length';

export { approximateContour, buildNailSlotV2 } from './buildSlot';
