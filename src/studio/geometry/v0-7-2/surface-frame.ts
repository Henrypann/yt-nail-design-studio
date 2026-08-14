import * as THREE from 'three';

export interface NailSurfaceFrameV1 {
  contract: 'nail-surface-frame-v1';
  source: 'uv_barycentric_outer_surface';
  uv: [number, number];
  triangleIndex: number;
  barycentric: [number, number, number];
  positionMm: [number, number, number];
  normal: [number, number, number];
  tangentU: [number, number, number];
  tangentV: [number, number, number];
}

function barycentric2d(
  point: THREE.Vector2,
  a: THREE.Vector2,
  b: THREE.Vector2,
  c: THREE.Vector2,
): THREE.Vector3 | null {
  const v0 = b.clone().sub(a);
  const v1 = c.clone().sub(a);
  const v2 = point.clone().sub(a);
  const denominator = v0.x * v1.y - v1.x * v0.y;
  if (!Number.isFinite(denominator) || Math.abs(denominator) < 1e-10) return null;
  const second = (v2.x * v1.y - v1.x * v2.y) / denominator;
  const third = (v0.x * v2.y - v2.x * v0.y) / denominator;
  return new THREE.Vector3(1 - second - third, second, third);
}

function interpolate3(
  attribute: THREE.BufferAttribute | THREE.InterleavedBufferAttribute,
  indices: [number, number, number],
  weights: THREE.Vector3,
): THREE.Vector3 {
  return new THREE.Vector3(
    attribute.getX(indices[0]) * weights.x + attribute.getX(indices[1]) * weights.y + attribute.getX(indices[2]) * weights.z,
    attribute.getY(indices[0]) * weights.x + attribute.getY(indices[1]) * weights.y + attribute.getY(indices[2]) * weights.z,
    attribute.getZ(indices[0]) * weights.x + attribute.getZ(indices[1]) * weights.y + attribute.getZ(indices[2]) * weights.z,
  );
}

function tangentFromUv(
  position: THREE.BufferAttribute | THREE.InterleavedBufferAttribute,
  uv: THREE.BufferAttribute | THREE.InterleavedBufferAttribute,
  indices: [number, number, number],
  normal: THREE.Vector3,
): { tangentU: THREE.Vector3; tangentV: THREE.Vector3 } | null {
  const positionAt = (index: number) => new THREE.Vector3(
    position.getX(index),
    position.getY(index),
    position.getZ(index),
  );
  const uvAt = (index: number) => new THREE.Vector2(uv.getX(index), uv.getY(index));
  const p0 = positionAt(indices[0]);
  const p1 = positionAt(indices[1]);
  const p2 = positionAt(indices[2]);
  const uv0 = uvAt(indices[0]);
  const uv1 = uvAt(indices[1]);
  const uv2 = uvAt(indices[2]);
  const edge1 = p1.sub(p0);
  const edge2 = p2.sub(p0);
  const du1 = uv1.x - uv0.x;
  const dv1 = uv1.y - uv0.y;
  const du2 = uv2.x - uv0.x;
  const dv2 = uv2.y - uv0.y;
  const determinant = du1 * dv2 - du2 * dv1;
  if (!Number.isFinite(determinant) || Math.abs(determinant) < 1e-10) return null;
  const tangentU = edge1.multiplyScalar(dv2).addScaledVector(edge2, -dv1).multiplyScalar(1 / determinant);
  tangentU.addScaledVector(normal, -tangentU.dot(normal));
  if (tangentU.lengthSq() < 1e-10) return null;
  tangentU.normalize();
  const tangentV = new THREE.Vector3().crossVectors(normal, tangentU).normalize();
  return { tangentU, tangentV };
}

/** Resolve the actual promoted outer triangle at a canonical nail-local UV. */
export function resolveNailSurfaceFrameV1(
  geometry: THREE.BufferGeometry,
  u: number,
  v: number,
): NailSurfaceFrameV1 | null {
  if (!Number.isFinite(u) || !Number.isFinite(v) || u < 0 || u > 1 || v < 0 || v > 1) return null;
  const position = geometry.getAttribute('position');
  const normalAttribute = geometry.getAttribute('normal');
  const uv = geometry.getAttribute('uv');
  if (!position || !normalAttribute || !uv) return null;
  const indices = geometry.index
    ? Array.from(geometry.index.array, Number)
    : Array.from({ length: position.count }, (_, index) => index);
  const target = new THREE.Vector2(u, v);
  let best: { frame: NailSurfaceFrameV1; score: number } | null = null;
  const epsilon = 1e-5;
  for (let offset = 0; offset < indices.length; offset += 3) {
    const triangle: [number, number, number] = [indices[offset], indices[offset + 1], indices[offset + 2]];
    const a = new THREE.Vector2(uv.getX(triangle[0]), uv.getY(triangle[0]));
    const b = new THREE.Vector2(uv.getX(triangle[1]), uv.getY(triangle[1]));
    const c = new THREE.Vector2(uv.getX(triangle[2]), uv.getY(triangle[2]));
    const weights = barycentric2d(target, a, b, c);
    if (!weights || weights.x < -epsilon || weights.y < -epsilon || weights.z < -epsilon) continue;
    const normal = interpolate3(normalAttribute, triangle, weights).normalize();
    if (!Number.isFinite(normal.lengthSq()) || normal.z <= 0.05) continue;
    const positionMm = interpolate3(position, triangle, weights);
    const tangent = tangentFromUv(position, uv, triangle, normal);
    if (!tangent) continue;
    const handedness = new THREE.Vector3().crossVectors(tangent.tangentU, tangent.tangentV).dot(normal);
    if (handedness < 0.999) continue;
    const frame: NailSurfaceFrameV1 = {
      contract: 'nail-surface-frame-v1',
      source: 'uv_barycentric_outer_surface',
      uv: [u, v],
      triangleIndex: offset / 3,
      barycentric: [weights.x, weights.y, weights.z],
      positionMm: positionMm.toArray() as [number, number, number],
      normal: normal.toArray() as [number, number, number],
      tangentU: tangent.tangentU.toArray() as [number, number, number],
      tangentV: tangent.tangentV.toArray() as [number, number, number],
    };
    const score = positionMm.z + normal.z * 0.01;
    if (!best || score > best.score) best = { frame, score };
  }
  return best?.frame ?? null;
}

export function surfaceFrameMatrixV1(frame: NailSurfaceFrameV1, embedDepthMm: number): THREE.Matrix4 {
  if (!Number.isFinite(embedDepthMm) || embedDepthMm < 0) throw new Error('embed depth must be non-negative');
  const tangentU = new THREE.Vector3(...frame.tangentU);
  const tangentV = new THREE.Vector3(...frame.tangentV);
  const normal = new THREE.Vector3(...frame.normal);
  const origin = new THREE.Vector3(...frame.positionMm).addScaledVector(normal, -embedDepthMm);
  const matrix = new THREE.Matrix4().makeBasis(tangentU, tangentV, normal);
  matrix.setPosition(origin);
  return matrix;
}
