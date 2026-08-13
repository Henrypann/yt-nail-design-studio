export interface PreviewSurfaceMeshV1 {
  positions: number[];
  indices: number[];
  metrics: {
    widthMm: number;
    lengthMm: number;
    transverseCrownRiseMm: number;
    longitudinalArchRiseMm: number;
    visualThicknessMm: number;
  };
}

/**
 * Deterministic visual surface for the v0.7.2 single-nail PBR entrance.
 * It is a closed visual shell so side and underside views remain legible.
 * Its curvature and vertical thickness are rendering assumptions, not a
 * canonical fit/manufacturing surface or an exportable production shell.
 */
export function createSingleNailPreviewSurfaceV1(
  widthMm = 11,
  lengthMm = 19,
  longitudinalSegments = 36,
  transverseSegments = 24,
): PreviewSurfaceMeshV1 {
  const positions: number[] = [];
  const indices: number[] = [];
  const outer: number[] = [];
  const visualThicknessMm = 0.55;
  for (let row = 0; row <= longitudinalSegments; row += 1) {
    const v = row / longitudinalSegments;
    const y = 1 - v * lengthMm;
    // Broad cuticle seat, widest upper-mid body, then a controlled almond tip.
    const planform = (1 - v) * 0.82 + Math.sin(Math.PI * v) * 0.58;
    const halfWidth = Math.max(0.28, (widthMm / 2) * planform);
    const longitudinalArch = 0.25 + 1.15 * Math.pow(Math.sin(Math.PI * v), 1.15) + 0.22 * v;
    for (let column = 0; column <= transverseSegments; column += 1) {
      const u = column / transverseSegments;
      const normalizedX = u * 2 - 1;
      const x = normalizedX * halfWidth;
      const cCurve = 1.72 * Math.max(0, 1 - normalizedX * normalizedX);
      outer.push(x, y, longitudinalArch + cCurve);
    }
  }
  const stride = transverseSegments + 1;
  for (let row = 0; row < longitudinalSegments; row += 1) {
    for (let column = 0; column < transverseSegments; column += 1) {
      const a = row * stride + column;
      const b = a + 1;
      const c = a + stride;
      const d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }
  const vertexCount = outer.length / 3;
  positions.push(...outer);
  for (let index = 0; index < vertexCount; index += 1) {
    positions.push(outer[index * 3], outer[index * 3 + 1], outer[index * 3 + 2] - visualThicknessMm);
  }
  const outerTriangleCount = indices.length;
  for (let offset = 0; offset < outerTriangleCount; offset += 3) {
    indices.push(
      indices[offset] + vertexCount,
      indices[offset + 2] + vertexCount,
      indices[offset + 1] + vertexCount,
    );
  }
  const boundary: number[] = [];
  for (let column = 0; column <= transverseSegments; column += 1) boundary.push(column);
  for (let row = 1; row <= longitudinalSegments; row += 1) boundary.push(row * stride + transverseSegments);
  for (let column = transverseSegments - 1; column >= 0; column -= 1) boundary.push(longitudinalSegments * stride + column);
  for (let row = longitudinalSegments - 1; row > 0; row -= 1) boundary.push(row * stride);
  for (let index = 0; index < boundary.length; index += 1) {
    const current = boundary[index];
    const next = boundary[(index + 1) % boundary.length];
    indices.push(current, next, current + vertexCount, next, next + vertexCount, current + vertexCount);
  }
  return {
    positions, indices,
    metrics: { widthMm, lengthMm, transverseCrownRiseMm: 1.72, longitudinalArchRiseMm: 1.37, visualThicknessMm },
  };
}

export async function hashPreviewSurfaceMeshV1(mesh: PreviewSurfaceMeshV1): Promise<string> {
  const canonical = JSON.stringify({
    positions: mesh.positions.map((value) => Math.round(value * 100_000) / 100_000),
    indices: mesh.indices,
  });
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}
