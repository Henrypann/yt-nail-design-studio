import type { NailLength, NailShape } from '@/lib/types';
import { getSilhouette } from './material';
import { createMapperFromSilhouette, type NailSurfaceMapper } from './surface-mapper-core';
export type { NailSurfaceMapper, NailPoint, SafePointResult } from './surface-mapper-core';

export function createNailSurfaceMapper(shape: NailShape, length: NailLength): NailSurfaceMapper | null {
  const silhouette = getSilhouette(shape, length);
  return silhouette ? createMapperFromSilhouette(silhouette.pathD) : null;
}
