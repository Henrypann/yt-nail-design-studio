import type * as THREE from 'three';
import type { GeometryBrowserDeliveryV2 } from '@/studio/geometry/v0-7-2/registry-v2';
import { parseVerifiedPromotedGeometryV2 } from '@/studio/geometry/v0-7-2/promoted-geometry-parser';

/**
 * Loads only an already promoted browser GLB. Artifact SHA and structural
 * attributes are verified before a geometry is returned; there is no fallback
 * to the old procedural slab surface.
 */
export async function loadPromotedGeometryV2(
  delivery: GeometryBrowserDeliveryV2,
  signal?: AbortSignal,
): Promise<THREE.BufferGeometry> {
  const response = await fetch(delivery.runtimeUrl, { cache: 'no-store', signal });
  if (!response.ok) throw new Error('promoted_geometry_fetch_failed');
  const bytes = await response.arrayBuffer();
  return parseVerifiedPromotedGeometryV2(bytes, delivery);
}
