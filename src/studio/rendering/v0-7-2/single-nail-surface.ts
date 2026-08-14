export interface PreviewSurfaceMeshV1 {
  positions: number[];
  /** Canonical nail-local UV: u left→right, v tip→root. */
  uvs: number[];
  indices: number[];
  metrics: {
    widthMm: number;
    lengthMm: number;
    transverseCrownRiseMm: number;
    longitudinalArchRiseMm: number;
    visualThicknessMm: number;
    tipRadiusMm: number;
    tipCapDepthMm: number;
    tipCrownRiseMm: number;
    tipCapExponent: number;
    tipTaperStartRatio: number;
    tipCapBlendStartRatio: number;
  };
}

function smootherStep(value: number): number {
  const t = Math.min(1, Math.max(0, value));
  return t * t * t * (t * (t * 6 - 15) + 10);
}

function cubicBezier(a: number, b: number, c: number, d: number, t: number): number {
  const inverse = 1 - t;
  return inverse ** 3 * a
    + 3 * inverse ** 2 * t * b
    + 3 * inverse * t ** 2 * c
    + t ** 3 * d;
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
  const uvs: number[] = [];
  const indices: number[] = [];
  const outer: number[] = [];
  const visualThicknessMm = 0.55;
  // These planform values are derived from the accepted medium Almond 2D
  // silhouette. They are rendering inputs only; the 3D curvature remains
  // simulated and is not an STL/manufacturing surface.
  const tipRadiusMm = 1.15;
  const tipCurveJoinT = 0.85;
  const bodyCurveEndT = 0.84;
  const tipCurveJoinY = cubicBezier(-3.06, -9.335, -18, -18, tipCurveJoinT);
  const tipCapDepthMm = tipCurveJoinY + 18;
  const tipCrownRiseMm = 0.72;
  const tipCapExponent = 2;
  const tipTaperStartRatio = 0.214;
  const tipCapBlendStartRatio = tipCurveJoinT;
  const rootHalfWidth = widthMm * 0.435;
  const maximumHalfWidth = widthMm / 2;
  const widthScale = widthMm / 11;
  const shoulderEndRow = Math.max(2, Math.round(longitudinalSegments * tipTaperStartRatio));
  const bodyLastRow = longitudinalSegments - 1;
  for (let row = 0; row <= longitudinalSegments; row += 1) {
    const isTipBoundary = row === longitudinalSegments;
    let halfWidth = maximumHalfWidth;
    let centerY = 1;
    if (!isTipBoundary && row <= shoulderEndRow) {
      const shoulder = smootherStep(row / shoulderEndRow);
      halfWidth = rootHalfWidth + (maximumHalfWidth - rootHalfWidth) * shoulder;
      centerY = 1 + (-3.06 - 1) * shoulder;
    } else if (!isTipBoundary) {
      const curveT = ((row - shoulderEndRow) / (bodyLastRow - shoulderEndRow)) * bodyCurveEndT;
      halfWidth = -cubicBezier(-5.5, -5.5, -2.577, 0, curveT) * widthScale;
      centerY = cubicBezier(-3.06, -9.335, -18, -18, curveT);
    }
    for (let column = 0; column <= transverseSegments; column += 1) {
      const u = column / transverseSegments;
      let x: number;
      let y: number;
      let normalizedX: number;
      if (isTipBoundary) {
        // The final boundary samples both sides of the accepted cubic tip
        // region. It is an arc of many vertices, not a row collapsed to one
        // pole and not a separate cap joined by a concave neck.
        if (u <= 0.5) {
          const curveT = tipCurveJoinT + (u / 0.5) * (1 - tipCurveJoinT);
          x = cubicBezier(-5.5, -5.5, -2.577, 0, curveT) * widthScale;
          y = cubicBezier(-3.06, -9.335, -18, -18, curveT);
        } else {
          const curveT = ((u - 0.5) / 0.5) * (1 - tipCurveJoinT);
          x = cubicBezier(0, 2.577, 5.5, 5.5, curveT) * widthScale;
          y = cubicBezier(-18, -18, -9.335, -3.06, curveT);
        }
        normalizedX = x / (1.171972125 * widthScale);
      } else {
        normalizedX = u * 2 - 1;
        x = normalizedX * halfWidth;
        y = centerY;
      }
      const profileV = Math.min(1, Math.max(0, (1 - y) / lengthMm));
      const longitudinalArch = 0.25 + 1.15 * Math.pow(Math.sin(Math.PI * profileV), 1.15) + 0.22 * profileV;
      const crownRelax = smootherStep((profileV - 0.82) / 0.18);
      const crownRise = 1.72 + (tipCrownRiseMm - 1.72) * crownRelax;
      const cCurve = crownRise * Math.max(0, 1 - normalizedX * normalizedX);
      outer.push(x, y, longitudinalArch + cCurve);
      uvs.push(u, 1 - profileV);
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
  uvs.push(...uvs);
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
    positions, uvs, indices,
    metrics: {
      widthMm,
      lengthMm,
      transverseCrownRiseMm: 1.72,
      longitudinalArchRiseMm: 1.37,
      visualThicknessMm,
      tipRadiusMm,
      tipCapDepthMm,
      tipCrownRiseMm,
      tipCapExponent,
      tipTaperStartRatio,
      tipCapBlendStartRatio,
    },
  };
}

export async function hashPreviewSurfaceMeshV1(mesh: PreviewSurfaceMeshV1): Promise<string> {
  const canonical = JSON.stringify({
    positions: mesh.positions.map((value) => Math.round(value * 100_000) / 100_000),
    uvs: mesh.uvs.map((value) => Math.round(value * 100_000) / 100_000),
    indices: mesh.indices,
  });
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}
