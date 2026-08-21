/**
 * FRENCH-02 pure exact-geometry French path compiler.
 *
 * Consumes only exact geometry from the FRENCH-02 adapter plus canonical
 * FrenchRecipeParametersV1. It returns derived nail-local paths, an ID-free
 * vector projection, cache identity, and diagnostics. It does not read or write
 * EditorDoc, store, history, or IDs, and it never claims manufacturing validity.
 *
 * Geometric contract (software only, not physical or manufacturing exactness):
 * - `contourPathData` is the exact signed Bezier source.
 * - Smile-line wings are analytic intersections of that exact curve with the
 *   canonical wing v-lines, to a bounded unit-interval root tolerance.
 * - The derived tip cap is a deterministic adaptive flattening of the exact
 *   source, bounded by `FRENCH_CONTOUR_FLATNESS_TOLERANCE_V1`, with max depth
 *   and point-cap fail-closed overflow.
 */

import { FINGER_CODES, type FingerCode, type NailLength, type NailShape } from '../../../lib/types.ts';
import { parseHexColorV7 } from './background.ts';
import {
  IDENTITY_TRANSFORM_V7,
  isDrawableNailPathDataV7,
  parseNailPathDataV7,
  serializeNailPathDataV7,
  type ParsedNailPathV7,
} from './flat-vector.ts';
import {
  FRENCH_EXACT_GEOMETRY_KEYS_V1,
  FRENCH_GOLDEN_FINGER_V1,
  FRENCH_SIGNED_LENGTHS_V1,
  FRENCH_SIGNED_SHAPES_V1,
  FRENCH_VIEWBOX_KEYS_V1,
  isCanonicalSingleClosedNailPathV1,
  sha256Hex,
  type FrenchExactGeometryV1,
  type FrenchSignedLengthV1,
  type FrenchSignedShapeV1,
  type FrenchViewBoxV1,
} from './french-geometry-input-v1.ts';
import {
  FRENCH_RECIPE_ID_V1,
  FRENCH_RECIPE_PRESETS_V1,
  FRENCH_RECIPE_REVISION_V1,
  parseFrenchRecipeParametersV1,
  type FrenchRecipeDefaultPresetV1,
  type FrenchRecipeDiagnosticV1,
  type FrenchRecipeParametersV1,
} from './french-recipe-v1.ts';
import { PRODUCT_GEOMETRY_ASSET_SET_SHA256_V7 } from './geometry-registry.ts';
import type { NailPointV7, RgbaColorV7, Transform2DV7 } from './model.ts';

export const FRENCH_PATH_COMPILER_REVISION_V1 = 'french-path-v1';
export const FRENCH_PATH_COORDINATE_SPACE_V1 = 'nail-local-v1';

/** Max chord-to-curve deviation of the derived flattened cap, in nail-local units. */
export const FRENCH_CONTOUR_FLATNESS_TOLERANCE_V1 = 1e-4;
/** de Casteljau split budget per curve; overflow fails closed instead of emitting a coarse chord. */
export const FRENCH_CONTOUR_MAX_SUBDIVISION_DEPTH_V1 = 12;
/** Total flattened-contour vertex cap; overflow fails closed. */
export const FRENCH_CONTOUR_MAX_POINTS_V1 = 2048;
/** Wing insertion / on-contour check. Bounded by a few flattening tolerances plus float slack. */
export const FRENCH_WING_ON_CONTOUR_TOLERANCE_V1 = 4e-4;
/** Unit-interval polynomial root isolation for analytic Bezier × horizontal-line hits. */
export const FRENCH_ANALYTIC_ROOT_TOLERANCE_V1 = 1e-12;
/** canvasCenterU must equal (0 - viewBox.x) / viewBox.width within this named tight bound. */
export const FRENCH_CANVAS_CENTER_U_TOLERANCE_V1 = 1e-9;
/**
 * Generated smile-boundary samples must stay inside or on the exact contour.
 * Bound covers adaptive flattening (1e-4) plus 5-decimal serialization slack.
 */
export const FRENCH_BOUNDARY_CONTAINMENT_TOLERANCE_V1 = 5e-4;
/** Bounded samples per smile-boundary segment for the independent containment walk. */
export const FRENCH_BOUNDARY_CONTAINMENT_SAMPLES_V1 = 48;

export const FRENCH_EXACT_KEY_KIND_CACHE_V1 = 'french-path-cache-v1';
export const FRENCH_EXACT_KEY_KIND_BINDING_V1 = 'french-path-binding-v1';
export const FRENCH_EXACT_KEY_FIELDS_V1 = [
  'kind',
  'compilerRevision',
  'recipeId',
  'recipeRevision',
  'parameterSerialization',
  'assetId',
  'revision',
  'finger',
  'registryAssetSetSha256',
  'contourIdentity',
  'viewBox',
  'canvasCenterU',
] as const;

const UNIT_EPS = 1e-12;
const FULL_SHA256 = /^[0-9a-f]{64}$/;
const SAFE_IDENTITY = /^[A-Za-z0-9][A-Za-z0-9._-]{0,255}$/;
const RESERVED_IDENTITY = /[\u0000-\u001f\u007f|@\\/:=#]/;
const FINGER_SET = new Set<string>(FINGER_CODES);
const SIGNED_SHAPE_SET = new Set<string>(FRENCH_SIGNED_SHAPES_V1);
const SIGNED_LENGTH_SET = new Set<string>(FRENCH_SIGNED_LENGTHS_V1);

export type FrenchPathDiagnosticCodeV1 =
  | 'parameters_invalid'
  | 'geometry_not_exact'
  | 'contour_invalid'
  | 'wing_off_contour'
  | 'center_off_contour'
  | 'boundary_outside_contour'
  | 'non_drawable_boundary'
  | 'non_drawable_fill'
  | 'coordinates_out_of_range'
  | 'identity_unsafe'
  | 'flatten_overflow'
  | FrenchRecipeDiagnosticV1['code'];

export interface FrenchPathDiagnosticV1 {
  code: FrenchPathDiagnosticCodeV1;
  path: string;
  message: string;
}

/**
 * Derived projection of recipe-managed French geometry. Payloads are locked
 * because recipe parameters are the only authoring truth. FRENCH-03 must
 * replace fill/outline atomically via French-specific commands; generic
 * vector editing is not authorized.
 */
export interface FrenchProjectedVectorShapeV1 {
  kind: 'vector_shape';
  visible: true;
  locked: true;
  opacity: number;
  transform: Transform2DV7;
  pathData: string;
  fill?: RgbaColorV7;
  stroke?: RgbaColorV7;
  strokeWidthMm?: number;
}

export interface FrenchVectorProjectionV1 {
  coordinateSpace: typeof FRENCH_PATH_COORDINATE_SPACE_V1;
  fill: FrenchProjectedVectorShapeV1;
  outline: FrenchProjectedVectorShapeV1 | null;
}

export interface FrenchPathCacheIdentityV1 {
  compilerRevision: typeof FRENCH_PATH_COMPILER_REVISION_V1;
  recipeId: string;
  recipeRevision: string;
  parameterSerialization: string;
  assetId: string;
  revision: string;
  finger: FingerCode;
  registryAssetSetSha256: string;
  contourIdentity: string;
  viewBox: FrenchViewBoxV1;
  canvasCenterU: number;
  cacheKey: string;
  bindingKey: string;
}

export interface FrenchPathAnchorsV1 {
  left: NailPointV7;
  center: NailPointV7;
  right: NailPointV7;
}

export type FrenchPathCompileResultV1 =
  | {
      ok: true;
      fidelity: 'exact';
      manufacturingValidated: false;
      boundaryPathData: string;
      fillPathData: string;
      projection: FrenchVectorProjectionV1;
      cacheIdentity: FrenchPathCacheIdentityV1;
      anchors: FrenchPathAnchorsV1;
      diagnostics: FrenchPathDiagnosticV1[];
    }
  | {
      ok: false;
      fidelity: 'unavailable';
      manufacturingValidated: false;
      diagnostics: FrenchPathDiagnosticV1[];
    };

export interface FrenchGoldenCaseV1 {
  id: string;
  shape: FrenchSignedShapeV1;
  length: FrenchSignedLengthV1;
  preset: FrenchRecipeDefaultPresetV1;
  finger: typeof FRENCH_GOLDEN_FINGER_V1;
}

export interface FrenchGoldenBindingV1 {
  id: string;
  shape: FrenchSignedShapeV1;
  length: FrenchSignedLengthV1;
  preset: FrenchRecipeDefaultPresetV1;
  finger: FingerCode;
}

interface ContourPoint {
  u: number;
  v: number;
}

type ExactSegment =
  | { kind: 'L'; p0: ContourPoint; p1: ContourPoint }
  | { kind: 'Q'; p0: ContourPoint; p1: ContourPoint; p2: ContourPoint }
  | { kind: 'C'; p0: ContourPoint; p1: ContourPoint; p2: ContourPoint; p3: ContourPoint };

interface FlattenBudget {
  overflow: boolean;
}

function unavailable(diagnostics: FrenchPathDiagnosticV1[]): Extract<FrenchPathCompileResultV1, { ok: false }> {
  return { ok: false, fidelity: 'unavailable', manufacturingValidated: false, diagnostics };
}

function diagnostic(code: FrenchPathDiagnosticCodeV1, path: string, message: string): FrenchPathDiagnosticV1 {
  return { code, path, message };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isSafeStableIdentity(value: unknown): value is string {
  if (typeof value !== 'string' || value.length === 0 || value.length > 256) return false;
  if (RESERVED_IDENTITY.test(value)) return false;
  if (!SAFE_IDENTITY.test(value)) return false;
  if (value.toLowerCase().includes('latest')) return false;
  return true;
}

function hasOwn(value: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function unknownOrMissingKeys(
  value: Record<string, unknown>,
  expected: readonly string[],
  pathPrefix: string,
): FrenchPathDiagnosticV1[] {
  const diagnostics: FrenchPathDiagnosticV1[] = [];
  const expectedSet = new Set(expected);
  for (const key of Object.keys(value)) {
    if (!expectedSet.has(key)) {
      const path = pathPrefix ? `${pathPrefix}.${key}` : key;
      diagnostics.push(diagnostic('geometry_not_exact', path, `unknown exact-geometry key ${key}`));
    }
  }
  for (const key of expected) {
    if (!hasOwn(value, key)) {
      const path = pathPrefix ? `${pathPrefix}.${key}` : key;
      diagnostics.push(diagnostic('geometry_not_exact', path, `missing exact-geometry key ${key}`));
    }
  }
  return diagnostics;
}

function isFinitePositiveViewBox(value: unknown): value is FrenchViewBoxV1 {
  if (!isRecord(value)) return false;
  const x = value.x;
  const y = value.y;
  const width = value.width;
  const height = value.height;
  return [x, y, width, height].every((item) => typeof item === 'number' && Number.isFinite(item))
    && (width as number) > 0
    && (height as number) > 0;
}

export function canonicalFrenchNumberKeyV1(value: number): string {
  return value.toFixed(12);
}

export function canonicalFrenchViewBoxKeyV1(viewBox: FrenchViewBoxV1): string {
  return [
    canonicalFrenchNumberKeyV1(viewBox.x),
    canonicalFrenchNumberKeyV1(viewBox.y),
    canonicalFrenchNumberKeyV1(viewBox.width),
    canonicalFrenchNumberKeyV1(viewBox.height),
  ].join(',');
}

export function expectedCanvasCenterUFromViewBoxV1(viewBox: FrenchViewBoxV1): number {
  return (0 - viewBox.x) / viewBox.width;
}

/**
 * Runtime trust boundary. A TypeScript `FrenchExactGeometryV1` object is not
 * evidence; forged exact objects must fail closed with visible diagnostics.
 */
export function validateFrenchExactGeometryTrustBoundaryV1(geometry: unknown): FrenchPathDiagnosticV1[] {
  if (!isRecord(geometry)) {
    return [diagnostic('geometry_not_exact', 'geometry', 'compiler accepts only a finite exact geometry object')];
  }
  const diagnostics: FrenchPathDiagnosticV1[] = [];
  const push = (code: FrenchPathDiagnosticCodeV1, path: string, message: string): void => {
    diagnostics.push(diagnostic(code, path, message));
  };
  diagnostics.push(...unknownOrMissingKeys(geometry, FRENCH_EXACT_GEOMETRY_KEYS_V1, ''));
  if (isRecord(geometry.viewBox)) {
    diagnostics.push(...unknownOrMissingKeys(geometry.viewBox, FRENCH_VIEWBOX_KEYS_V1, 'viewBox'));
  }

  if (geometry.fidelity !== 'exact' || geometry.evidence !== 'signed_off' || geometry.manufacturingValidated !== false) {
    push('geometry_not_exact', 'geometry', 'compiler accepts only exact signed_off geometry with manufacturingValidated=false');
  }
  if (geometry.coordinateSpace !== FRENCH_PATH_COORDINATE_SPACE_V1) {
    push('geometry_not_exact', 'coordinateSpace', 'exact geometry must use nail-local-v1');
  }
  if (!FINGER_SET.has(geometry.finger as string)) {
    push('geometry_not_exact', 'finger', 'finger must be a real V7 FINGER_CODE');
  }
  if (!SIGNED_SHAPE_SET.has(geometry.shape as string)) {
    push('geometry_not_exact', 'shape', 'shape must be one of the current signed French set from registry output');
  }
  if (!SIGNED_LENGTH_SET.has(geometry.length as string)) {
    push('geometry_not_exact', 'length', 'length must be one of the current signed French set from registry output');
  }
  if (geometry.registryAssetSetSha256 !== PRODUCT_GEOMETRY_ASSET_SET_SHA256_V7) {
    push(
      'geometry_not_exact',
      'registryAssetSetSha256',
      'registryAssetSetSha256 must equal the full PRODUCT_GEOMETRY_ASSET_SET_SHA256_V7 digest',
    );
  }
  if (!isSafeStableIdentity(geometry.assetId)) {
    push('identity_unsafe', 'assetId', 'assetId must be a stable non-empty identity without control chars, reserved separators, or latest');
  }
  if (!isSafeStableIdentity(geometry.revision)) {
    push('identity_unsafe', 'revision', 'revision must be a stable non-empty identity without control chars, reserved separators, or latest');
  }
  if (!isFinitePositiveViewBox(geometry.viewBox)) {
    push('geometry_not_exact', 'viewBox', 'viewBox must be four finite numbers with positive width and height');
  }
  if (typeof geometry.canvasCenterU !== 'number' || !Number.isFinite(geometry.canvasCenterU) || geometry.canvasCenterU < 0 || geometry.canvasCenterU > 1) {
    push('geometry_not_exact', 'canvasCenterU', 'canvasCenterU must be finite within [0, 1]');
  } else if (isFinitePositiveViewBox(geometry.viewBox)) {
    const expectedCenterU = expectedCanvasCenterUFromViewBoxV1(geometry.viewBox);
    if (!Number.isFinite(expectedCenterU) || expectedCenterU < 0 || expectedCenterU > 1) {
      push('geometry_not_exact', 'canvasCenterU', 'viewBox-derived canvasCenterU must stay inside finite [0, 1]');
    } else if (Math.abs(geometry.canvasCenterU - expectedCenterU) > FRENCH_CANVAS_CENTER_U_TOLERANCE_V1) {
      push(
        'geometry_not_exact',
        'canvasCenterU',
        `canvasCenterU must equal (0 - viewBox.x) / viewBox.width within ${FRENCH_CANVAS_CENTER_U_TOLERANCE_V1}`,
      );
    }
  }
  if (typeof geometry.contourPathData !== 'string') {
    push('contour_invalid', 'contourPathData', 'contourPathData must be a canonical single closed subpath');
  } else if (!isCanonicalSingleClosedNailPathV1(geometry.contourPathData)) {
    push('contour_invalid', 'contourPathData', 'contour must be a canonical single closed nail-local subpath');
  } else if (typeof geometry.contourIdentity !== 'string' || !FULL_SHA256.test(geometry.contourIdentity) || geometry.contourIdentity !== sha256Hex(geometry.contourPathData)) {
    push('geometry_not_exact', 'contourIdentity', 'contourIdentity must equal sha256Hex(contourPathData)');
  }

  return diagnostics;
}

function snapUnit(value: number): number | null {
  if (!Number.isFinite(value)) return null;
  if (value >= 0 && value <= 1) return value;
  if (value > -UNIT_EPS && value < 0) return 0;
  if (value > 1 && value < 1 + UNIT_EPS) return 1;
  return null;
}

function point(u: number, v: number): NailPointV7 | null {
  const nextU = snapUnit(u);
  const nextV = snapUnit(v);
  if (nextU === null || nextV === null) return null;
  return { u: nextU, v: nextV };
}

function appendUnique(points: NailPointV7[], next: NailPointV7): void {
  const last = points[points.length - 1];
  if (!last || last.u !== next.u || last.v !== next.v) points.push(next);
}

function mid(a: ContourPoint, b: ContourPoint): ContourPoint | null {
  return point((a.u + b.u) / 2, (a.v + b.v) / 2);
}

function hypot2(du: number, dv: number): number {
  return du * du + dv * dv;
}

function distanceToLine(pointOn: ContourPoint, a: ContourPoint, b: ContourPoint): number {
  const du = b.u - a.u;
  const dv = b.v - a.v;
  const len2 = hypot2(du, dv);
  if (len2 < UNIT_EPS * UNIT_EPS) return Math.hypot(pointOn.u - a.u, pointOn.v - a.v);
  return Math.abs((pointOn.u - a.u) * dv - (pointOn.v - a.v) * du) / Math.sqrt(len2);
}

function uniqueSorted(values: number[]): number[] {
  const sorted = [...values].filter(Number.isFinite).sort((left, right) => left - right);
  const unique: number[] = [];
  for (const value of sorted) {
    const last = unique[unique.length - 1];
    if (last === undefined || Math.abs(value - last) > UNIT_EPS) unique.push(value);
  }
  return unique;
}

function parseExactSegments(parsed: ParsedNailPathV7): ExactSegment[] | null {
  const segments: ExactSegment[] = [];
  let current: ContourPoint | null = null;
  let start: ContourPoint | null = null;
  let moves = 0;
  for (const { command, values } of parsed.commands) {
    if (command === 'M') {
      moves += 1;
      if (moves > 1) return null;
      current = point(values[0], values[1]);
      if (!current) return null;
      start = current;
    } else if (command === 'L') {
      const next = point(values[0], values[1]);
      if (!current || !next) return null;
      segments.push({ kind: 'L', p0: current, p1: next });
      current = next;
    } else if (command === 'Q') {
      const control = point(values[0], values[1]);
      const next = point(values[2], values[3]);
      if (!current || !control || !next) return null;
      segments.push({ kind: 'Q', p0: current, p1: control, p2: next });
      current = next;
    } else if (command === 'C') {
      const c1 = point(values[0], values[1]);
      const c2 = point(values[2], values[3]);
      const next = point(values[4], values[5]);
      if (!current || !c1 || !c2 || !next) return null;
      segments.push({ kind: 'C', p0: current, p1: c1, p2: c2, p3: next });
      current = next;
    } else if (command === 'Z') {
      if (!current || !start) return null;
      if (Math.hypot(current.u - start.u, current.v - start.v) > UNIT_EPS) {
        segments.push({ kind: 'L', p0: current, p1: start });
      }
    } else {
      return null;
    }
  }
  return segments.length > 0 ? segments : null;
}

function evalCubic(p0: ContourPoint, p1: ContourPoint, p2: ContourPoint, p3: ContourPoint, t: number): ContourPoint | null {
  const mt = 1 - t;
  return point(
    mt * mt * mt * p0.u + 3 * mt * mt * t * p1.u + 3 * mt * t * t * p2.u + t * t * t * p3.u,
    mt * mt * mt * p0.v + 3 * mt * mt * t * p1.v + 3 * mt * t * t * p2.v + t * t * t * p3.v,
  );
}

function evalQuadratic(p0: ContourPoint, p1: ContourPoint, p2: ContourPoint, t: number): ContourPoint | null {
  const mt = 1 - t;
  return point(
    mt * mt * p0.u + 2 * mt * t * p1.u + t * t * p2.u,
    mt * mt * p0.v + 2 * mt * t * p1.v + t * t * p2.v,
  );
}

function evalLine(p0: ContourPoint, p1: ContourPoint, t: number): ContourPoint | null {
  return point(p0.u + (p1.u - p0.u) * t, p0.v + (p1.v - p0.v) * t);
}

function evalPoly(coeffs: readonly number[], t: number): number {
  let value = 0;
  for (const coeff of coeffs) value = value * t + coeff;
  return value;
}

function quadraticRoots01(a: number, b: number, c: number): number[] {
  const roots: number[] = [];
  const push = (t: number): void => {
    if (Number.isFinite(t) && t >= -FRENCH_ANALYTIC_ROOT_TOLERANCE_V1 && t <= 1 + FRENCH_ANALYTIC_ROOT_TOLERANCE_V1) {
      roots.push(Math.min(1, Math.max(0, t)));
    }
  };
  if (Math.abs(a) < FRENCH_ANALYTIC_ROOT_TOLERANCE_V1) {
    if (Math.abs(b) >= FRENCH_ANALYTIC_ROOT_TOLERANCE_V1) push(-c / b);
    return uniqueSorted(roots);
  }
  const disc = b * b - 4 * a * c;
  if (disc < -FRENCH_ANALYTIC_ROOT_TOLERANCE_V1) return [];
  if (disc <= FRENCH_ANALYTIC_ROOT_TOLERANCE_V1) {
    push(-b / (2 * a));
    return uniqueSorted(roots);
  }
  const sqrtDisc = Math.sqrt(disc);
  const sign = b >= 0 ? 1 : -1;
  const q = -0.5 * (b + sign * sqrtDisc);
  if (Math.abs(q) >= FRENCH_ANALYTIC_ROOT_TOLERANCE_V1) push(q / a);
  if (Math.abs(q) >= FRENCH_ANALYTIC_ROOT_TOLERANCE_V1) push(c / q);
  else {
    push((-b + sqrtDisc) / (2 * a));
    push((-b - sqrtDisc) / (2 * a));
  }
  return uniqueSorted(roots);
}

function bisectRoot(coeffs: readonly number[], lo: number, hi: number): number {
  let a = lo;
  let b = hi;
  let fa = evalPoly(coeffs, a);
  for (let step = 0; step < 80; step += 1) {
    const midT = (a + b) / 2;
    const fm = evalPoly(coeffs, midT);
    if (fa === 0) return a;
    if (fa * fm <= 0) {
      b = midT;
    } else {
      a = midT;
      fa = fm;
    }
  }
  return (a + b) / 2;
}

function cubicRoots01(a: number, b: number, c: number, d: number): number[] {
  if (Math.abs(a) < FRENCH_ANALYTIC_ROOT_TOLERANCE_V1) return quadraticRoots01(b, c, d);
  const coeffs = [a, b, c, d];
  const f = (t: number): number => evalPoly(coeffs, t);
  const samples = uniqueSorted([0, 1, ...quadraticRoots01(3 * a, 2 * b, c)]);
  const roots: number[] = [];
  for (const sample of samples) {
    if (Math.abs(f(sample)) <= FRENCH_ANALYTIC_ROOT_TOLERANCE_V1 * 8) roots.push(sample);
  }
  for (let i = 0; i < samples.length - 1; i += 1) {
    const lo = samples[i];
    const hi = samples[i + 1];
    const flo = f(lo);
    const fhi = f(hi);
    if (Math.abs(flo) <= FRENCH_ANALYTIC_ROOT_TOLERANCE_V1 * 8) continue;
    if (flo * fhi < 0) roots.push(bisectRoot(coeffs, lo, hi));
  }
  return uniqueSorted(roots);
}

function analyticUsAtV(segment: ExactSegment, v: number): number[] {
  const us: number[] = [];
  const pushPoint = (hit: ContourPoint | null): void => {
    if (hit && Math.abs(hit.v - v) <= FRENCH_WING_ON_CONTOUR_TOLERANCE_V1) us.push(hit.u);
  };

  if (segment.kind === 'L') {
    const { p0, p1 } = segment;
    if (Math.abs(p0.v - v) <= UNIT_EPS && Math.abs(p1.v - v) <= UNIT_EPS) {
      us.push(p0.u, p1.u);
      return uniqueSorted(us);
    }
    const dv = p1.v - p0.v;
    if (Math.abs(dv) < UNIT_EPS) return [];
    const t = (v - p0.v) / dv;
    if (t >= -FRENCH_ANALYTIC_ROOT_TOLERANCE_V1 && t <= 1 + FRENCH_ANALYTIC_ROOT_TOLERANCE_V1) {
      pushPoint(evalLine(p0, p1, Math.min(1, Math.max(0, t))));
    }
    return uniqueSorted(us);
  }

  if (segment.kind === 'Q') {
    const { p0, p1, p2 } = segment;
    if ([p0, p1, p2].every((item) => Math.abs(item.v - v) <= UNIT_EPS)) {
      us.push(p0.u, p1.u, p2.u);
      return uniqueSorted(us);
    }
    const a = p0.v - 2 * p1.v + p2.v;
    const b = -2 * p0.v + 2 * p1.v;
    const c = p0.v - v;
    for (const t of quadraticRoots01(a, b, c)) pushPoint(evalQuadratic(p0, p1, p2, t));
    return uniqueSorted(us);
  }

  const { p0, p1, p2, p3 } = segment;
  if ([p0, p1, p2, p3].every((item) => Math.abs(item.v - v) <= UNIT_EPS)) {
    us.push(p0.u, p1.u, p2.u, p3.u);
    return uniqueSorted(us);
  }
  const a = -p0.v + 3 * p1.v - 3 * p2.v + p3.v;
  const b = 3 * p0.v - 6 * p1.v + 3 * p2.v;
  const c = -3 * p0.v + 3 * p1.v;
  const d = p0.v - v;
  for (const t of cubicRoots01(a, b, c, d)) pushPoint(evalCubic(p0, p1, p2, p3, t));
  return uniqueSorted(us);
}

function flattenLine(p1: ContourPoint, out: NailPointV7[], budget: FlattenBudget): void {
  if (budget.overflow) return;
  if (out.length >= FRENCH_CONTOUR_MAX_POINTS_V1) {
    budget.overflow = true;
    return;
  }
  const next = point(p1.u, p1.v);
  if (!next) {
    budget.overflow = true;
    return;
  }
  appendUnique(out, next);
}

function flattenQuadratic(
  p0: ContourPoint,
  p1: ContourPoint,
  p2: ContourPoint,
  depth: number,
  out: NailPointV7[],
  budget: FlattenBudget,
): void {
  if (budget.overflow) return;
  if (out.length >= FRENCH_CONTOUR_MAX_POINTS_V1) {
    budget.overflow = true;
    return;
  }
  if (depth > FRENCH_CONTOUR_MAX_SUBDIVISION_DEPTH_V1) {
    budget.overflow = true;
    return;
  }
  if (distanceToLine(p1, p0, p2) <= FRENCH_CONTOUR_FLATNESS_TOLERANCE_V1) {
    flattenLine(p2, out, budget);
    return;
  }
  const l1 = mid(p0, p1);
  const r1 = mid(p1, p2);
  if (!l1 || !r1) {
    budget.overflow = true;
    return;
  }
  const split = mid(l1, r1);
  if (!split) {
    budget.overflow = true;
    return;
  }
  flattenQuadratic(p0, l1, split, depth + 1, out, budget);
  flattenQuadratic(split, r1, p2, depth + 1, out, budget);
}

function flattenCubic(
  p0: ContourPoint,
  p1: ContourPoint,
  p2: ContourPoint,
  p3: ContourPoint,
  depth: number,
  out: NailPointV7[],
  budget: FlattenBudget,
): void {
  if (budget.overflow) return;
  if (out.length >= FRENCH_CONTOUR_MAX_POINTS_V1) {
    budget.overflow = true;
    return;
  }
  if (depth > FRENCH_CONTOUR_MAX_SUBDIVISION_DEPTH_V1) {
    budget.overflow = true;
    return;
  }
  if (
    Math.max(distanceToLine(p1, p0, p3), distanceToLine(p2, p0, p3)) <= FRENCH_CONTOUR_FLATNESS_TOLERANCE_V1
  ) {
    flattenLine(p3, out, budget);
    return;
  }
  const l1 = mid(p0, p1);
  const m = mid(p1, p2);
  const r2 = mid(p2, p3);
  if (!l1 || !m || !r2) {
    budget.overflow = true;
    return;
  }
  const l2 = mid(l1, m);
  const r1 = mid(m, r2);
  if (!l2 || !r1) {
    budget.overflow = true;
    return;
  }
  const split = mid(l2, r1);
  if (!split) {
    budget.overflow = true;
    return;
  }
  flattenCubic(p0, l1, l2, split, depth + 1, out, budget);
  flattenCubic(split, r1, r2, p3, depth + 1, out, budget);
}

function flattenExactContour(segments: readonly ExactSegment[]): NailPointV7[] | 'overflow' | null {
  const start = point(segments[0].p0.u, segments[0].p0.v);
  if (!start) return null;
  const out: NailPointV7[] = [start];
  const budget: FlattenBudget = { overflow: false };
  for (const segment of segments) {
    if (segment.kind === 'L') flattenLine(segment.p1, out, budget);
    else if (segment.kind === 'Q') flattenQuadratic(segment.p0, segment.p1, segment.p2, 0, out, budget);
    else flattenCubic(segment.p0, segment.p1, segment.p2, segment.p3, 0, out, budget);
    if (budget.overflow) return 'overflow';
  }
  const first = out[0];
  const last = out[out.length - 1];
  if (first && last && (first.u !== last.u || first.v !== last.v)) {
    if (out.length >= FRENCH_CONTOUR_MAX_POINTS_V1) return 'overflow';
    out.push({ ...first });
  }
  return out.length >= 3 ? out : null;
}

function isClosedPolyline(polyline: readonly NailPointV7[]): boolean {
  return polyline.length > 1
    && polyline[0].u === polyline[polyline.length - 1].u
    && polyline[0].v === polyline[polyline.length - 1].v;
}

function segmentCount(polyline: readonly NailPointV7[]): number {
  return isClosedPolyline(polyline) ? polyline.length - 1 : Math.max(0, polyline.length - 1);
}

function nearestIndex(polyline: readonly NailPointV7[], target: NailPointV7): number {
  let best = 0;
  let bestDist = Number.POSITIVE_INFINITY;
  const last = segmentCount(polyline);
  for (let i = 0; i < last; i += 1) {
    const dist = Math.hypot(polyline[i].u - target.u, polyline[i].v - target.v);
    if (dist < bestDist) {
      bestDist = dist;
      best = i;
    }
  }
  return best;
}

function insertOnContour(polyline: NailPointV7[], target: NailPointV7): boolean {
  const count = segmentCount(polyline);
  let bestIndex = -1;
  let bestDist = Number.POSITIVE_INFINITY;
  for (let i = 0; i < count; i += 1) {
    const a = polyline[i];
    const b = polyline[i + 1] ?? polyline[0];
    const dx = b.u - a.u;
    const dy = b.v - a.v;
    const len2 = dx * dx + dy * dy;
    const t = len2 < UNIT_EPS * UNIT_EPS
      ? 0
      : Math.min(1, Math.max(0, ((target.u - a.u) * dx + (target.v - a.v) * dy) / len2));
    const q = { u: a.u + t * dx, v: a.v + t * dy };
    const dist = Math.hypot(target.u - q.u, target.v - q.v);
    if (dist < bestDist) {
      bestDist = dist;
      bestIndex = i;
    }
  }
  if (bestIndex < 0 || bestDist > FRENCH_WING_ON_CONTOUR_TOLERANCE_V1) return false;
  const a = polyline[bestIndex];
  const b = polyline[bestIndex + 1] ?? polyline[0];
  if (Math.hypot(a.u - target.u, a.v - target.v) <= UNIT_EPS) return true;
  if (Math.hypot(b.u - target.u, b.v - target.v) <= UNIT_EPS) return true;
  polyline.splice(bestIndex + 1, 0, target);
  return true;
}

function walkPolyline(
  polyline: readonly NailPointV7[],
  from: number,
  to: number,
  direction: 1 | -1,
): NailPointV7[] {
  const count = segmentCount(polyline);
  const points: NailPointV7[] = [];
  let index = from;
  for (let step = 0; step <= count; step += 1) {
    points.push(polyline[index]);
    if (index === to && step > 0) break;
    index = (index + direction + count) % count;
  }
  return points;
}

function minV(points: readonly NailPointV7[]): number {
  return Math.min(...points.map((item) => item.v));
}

function evenOddContains(polyline: readonly NailPointV7[], p: ContourPoint): boolean {
  const count = segmentCount(polyline);
  let inside = false;
  for (let i = 0; i < count; i += 1) {
    const a = polyline[i];
    const b = polyline[i + 1] ?? polyline[0];
    if ((a.v > p.v) !== (b.v > p.v)) {
      const denom = b.v - a.v;
      if (Math.abs(denom) > UNIT_EPS) {
        const xIntersect = a.u + ((p.v - a.v) * (b.u - a.u)) / denom;
        if (p.u < xIntersect) inside = !inside;
      }
    }
  }
  return inside;
}

function minDistToPolyline(polyline: readonly NailPointV7[], target: ContourPoint): number {
  let best = Number.POSITIVE_INFINITY;
  const count = segmentCount(polyline);
  for (let i = 0; i < count; i += 1) {
    const a = polyline[i];
    const b = polyline[i + 1] ?? polyline[0];
    const dx = b.u - a.u;
    const dy = b.v - a.v;
    const len2 = dx * dx + dy * dy;
    const t = len2 < UNIT_EPS * UNIT_EPS
      ? 0
      : Math.min(1, Math.max(0, ((target.u - a.u) * dx + (target.v - a.v) * dy) / len2));
    best = Math.min(best, Math.hypot(target.u - (a.u + t * dx), target.v - (a.v + t * dy)));
  }
  return best;
}

function isInsideOrOnContour(
  polyline: readonly NailPointV7[],
  p: ContourPoint,
  tolerance: number,
): boolean {
  if (minDistToPolyline(polyline, p) <= tolerance) return true;
  return evenOddContains(polyline, p);
}

function evalCubicRaw(
  p0: ContourPoint,
  p1: ContourPoint,
  p2: ContourPoint,
  p3: ContourPoint,
  t: number,
): ContourPoint {
  const mt = 1 - t;
  return {
    u: mt * mt * mt * p0.u + 3 * mt * mt * t * p1.u + 3 * mt * t * t * p2.u + t * t * t * p3.u,
    v: mt * mt * mt * p0.v + 3 * mt * mt * t * p1.v + 3 * mt * t * t * p2.v + t * t * t * p3.v,
  };
}

function evalLineRaw(p0: ContourPoint, p1: ContourPoint, t: number): ContourPoint {
  return { u: p0.u + (p1.u - p0.u) * t, v: p0.v + (p1.v - p0.v) * t };
}

function sampleSmileBoundary(
  commands: ParsedNailPathV7['commands'],
  samplesPerSegment: number,
): ContourPoint[] | null {
  const points: ContourPoint[] = [];
  let current: ContourPoint | null = null;
  for (const { command, values } of commands) {
    if (command === 'M') {
      current = { u: values[0], v: values[1] };
      points.push(current);
    } else if (command === 'L') {
      if (!current) return null;
      const next = { u: values[0], v: values[1] };
      for (let step = 1; step <= samplesPerSegment; step += 1) {
        points.push(evalLineRaw(current, next, step / samplesPerSegment));
      }
      current = next;
    } else if (command === 'C') {
      if (!current) return null;
      const c1 = { u: values[0], v: values[1] };
      const c2 = { u: values[2], v: values[3] };
      const next = { u: values[4], v: values[5] };
      for (let step = 1; step <= samplesPerSegment; step += 1) {
        points.push(evalCubicRaw(current, c1, c2, next, step / samplesPerSegment));
      }
      current = next;
    } else {
      return null;
    }
  }
  return points.length > 0 ? points : null;
}

function serializeCommands(commands: ParsedNailPathV7['commands']): string | null {
  for (const { values } of commands) {
    for (const value of values) {
      if (snapUnit(value) === null) return null;
    }
  }
  const snapped: ParsedNailPathV7 = {
    commands: commands.map(({ command, values }) => ({
      command,
      values: values.map((value) => snapUnit(value) as number),
    })),
  };
  const serialized = serializeNailPathDataV7(snapped);
  const parsed = parseNailPathDataV7(serialized);
  return parsed ? serializeNailPathDataV7(parsed) : null;
}

function colorWithOpacity(hex: string, opacity: number): RgbaColorV7 | null {
  const color = parseHexColorV7(hex);
  if (!color) return null;
  return { ...color, a: opacity };
}

function lengthPrefixedExactKeyPayload(
  kind: typeof FRENCH_EXACT_KEY_KIND_CACHE_V1 | typeof FRENCH_EXACT_KEY_KIND_BINDING_V1,
  geometry: FrenchExactGeometryV1,
  serialization: string,
): string {
  const fields: Record<(typeof FRENCH_EXACT_KEY_FIELDS_V1)[number], string> = {
    kind,
    compilerRevision: FRENCH_PATH_COMPILER_REVISION_V1,
    recipeId: FRENCH_RECIPE_ID_V1,
    recipeRevision: FRENCH_RECIPE_REVISION_V1,
    parameterSerialization: serialization,
    assetId: geometry.assetId,
    revision: geometry.revision,
    finger: geometry.finger,
    registryAssetSetSha256: geometry.registryAssetSetSha256,
    contourIdentity: geometry.contourIdentity,
    viewBox: canonicalFrenchViewBoxKeyV1(geometry.viewBox),
    canvasCenterU: canonicalFrenchNumberKeyV1(geometry.canvasCenterU),
  };
  return FRENCH_EXACT_KEY_FIELDS_V1
    .map((key) => {
      const value = fields[key];
      return `${key.length}:${key}:${value.length}:${value}`;
    })
    .join('\n');
}

export function frenchExactKeyPreimageV1(
  kind: typeof FRENCH_EXACT_KEY_KIND_CACHE_V1 | typeof FRENCH_EXACT_KEY_KIND_BINDING_V1,
  geometry: Pick<
    FrenchExactGeometryV1,
    'assetId' | 'revision' | 'finger' | 'registryAssetSetSha256' | 'contourIdentity' | 'viewBox' | 'canvasCenterU'
  >,
  parameterSerialization: string,
): string {
  return lengthPrefixedExactKeyPayload(kind, geometry as FrenchExactGeometryV1, parameterSerialization);
}

function cacheIdentity(
  geometry: FrenchExactGeometryV1,
  serialization: string,
): FrenchPathCacheIdentityV1 {
  const cacheKey = sha256Hex(lengthPrefixedExactKeyPayload(FRENCH_EXACT_KEY_KIND_CACHE_V1, geometry, serialization));
  const bindingKey = sha256Hex(lengthPrefixedExactKeyPayload(FRENCH_EXACT_KEY_KIND_BINDING_V1, geometry, serialization));
  return {
    compilerRevision: FRENCH_PATH_COMPILER_REVISION_V1,
    recipeId: FRENCH_RECIPE_ID_V1,
    recipeRevision: FRENCH_RECIPE_REVISION_V1,
    parameterSerialization: serialization,
    assetId: geometry.assetId,
    revision: geometry.revision,
    finger: geometry.finger,
    registryAssetSetSha256: geometry.registryAssetSetSha256,
    contourIdentity: geometry.contourIdentity,
    viewBox: {
      x: geometry.viewBox.x,
      y: geometry.viewBox.y,
      width: geometry.viewBox.width,
      height: geometry.viewBox.height,
    },
    canvasCenterU: geometry.canvasCenterU,
    cacheKey,
    bindingKey,
  };
}

export function enumerateFrenchGoldenCasesV1(): readonly FrenchGoldenCaseV1[] {
  const cases: FrenchGoldenCaseV1[] = [];
  for (const shape of FRENCH_SIGNED_SHAPES_V1) {
    for (const length of FRENCH_SIGNED_LENGTHS_V1) {
      for (const preset of FRENCH_RECIPE_PRESETS_V1) {
        cases.push({
          id: frenchGoldenCaseIdV1(shape, length, preset),
          shape,
          length,
          preset,
          finger: FRENCH_GOLDEN_FINGER_V1,
        });
      }
    }
  }
  return cases;
}

export function enumerateFrenchGoldenBindingsV1(): readonly FrenchGoldenBindingV1[] {
  return enumerateFrenchGoldenCasesV1().flatMap((item) => FINGER_CODES.map((finger) => ({ ...item, finger })));
}

/**
 * Pure compiler. Inputs are not mutated. Outline is a separate stroke-only
 * smile-line; the closed fill path is never stroked. Derived fill/outline
 * payloads are locked recipe-managed projections. FRENCH-03 must replace them
 * atomically via French-specific commands; generic vector editing is not
 * authorized.
 *
 * This function is a runtime trust boundary: forged exact objects, unsafe
 * identities, SHA drift, viewBox/center incoherence, contour-incompatible
 * recipes, and non-canonical contours fail closed.
 */
export function compileFrenchPathV1(
  geometry: FrenchExactGeometryV1,
  parameters: FrenchRecipeParametersV1,
): FrenchPathCompileResultV1 {
  const trust = validateFrenchExactGeometryTrustBoundaryV1(geometry);
  if (trust.length > 0) return unavailable(trust);

  const parsedParameters = parseFrenchRecipeParametersV1(parameters);
  if (!parsedParameters.ok) {
    return unavailable(parsedParameters.diagnostics.map((item) => ({
      code: item.code,
      path: item.path === '$' ? 'parameters' : `parameters.${item.path}`,
      message: item.message,
    })));
  }
  const canonicalParameters = parsedParameters.parameters;
  const identity = cacheIdentity(geometry, parsedParameters.serialization);

  const parsedContour = parseNailPathDataV7(geometry.contourPathData);
  if (!parsedContour) {
    return unavailable([diagnostic('contour_invalid', 'contourPathData', 'exact geometry contour is not a closed drawable nail-local path')]);
  }
  const segments = parseExactSegments(parsedContour);
  if (!segments) {
    return unavailable([diagnostic('contour_invalid', 'contourPathData', 'exact geometry contour is not a single closed Bezier subpath')]);
  }

  const leftUs = uniqueSorted(segments.flatMap((segment) => analyticUsAtV(segment, canonicalParameters.leftWingV)));
  const rightUs = uniqueSorted(segments.flatMap((segment) => analyticUsAtV(segment, canonicalParameters.rightWingV)));
  if (leftUs.length < 2 || rightUs.length < 2) {
    return unavailable([diagnostic('wing_off_contour', 'leftWingV', 'smile-line wings must intersect the signed exact contour')]);
  }

  const left = point(Math.min(...leftUs), canonicalParameters.leftWingV);
  const right = point(Math.max(...rightUs), canonicalParameters.rightWingV);
  const center = point(geometry.canvasCenterU, canonicalParameters.centerV);
  if (!left || !right || !center) {
    return unavailable([diagnostic('coordinates_out_of_range', 'anchors', 'compiled anchors must stay inside finite [0, 1]')]);
  }

  const centerUs = uniqueSorted(segments.flatMap((segment) => analyticUsAtV(segment, canonicalParameters.centerV)));
  if (centerUs.length < 2) {
    return unavailable([
      diagnostic(
        'center_off_contour',
        'centerV',
        `center horizontal section at v=${canonicalParameters.centerV} must intersect the signed exact contour`,
      ),
    ]);
  }
  const sectionMinU = Math.min(...centerUs);
  const sectionMaxU = Math.max(...centerUs);
  if (geometry.canvasCenterU < sectionMinU - FRENCH_WING_ON_CONTOUR_TOLERANCE_V1
    || geometry.canvasCenterU > sectionMaxU + FRENCH_WING_ON_CONTOUR_TOLERANCE_V1) {
    return unavailable([
      diagnostic(
        'center_off_contour',
        'canvasCenterU',
        `canvasCenterU=${geometry.canvasCenterU} must lie inside the center horizontal section [${sectionMinU}, ${sectionMaxU}]`,
      ),
    ]);
  }

  const flattened = flattenExactContour(segments);
  if (flattened === 'overflow') {
    return unavailable([diagnostic('flatten_overflow', 'contourPathData', 'adaptive contour flattening exceeded max depth or point cap')]);
  }
  if (!flattened) {
    return unavailable([diagnostic('contour_invalid', 'contourPathData', 'exact geometry contour could not be flattened')]);
  }

  const working = flattened.map((item) => ({ ...item }));
  if (!insertOnContour(working, left) || !insertOnContour(working, right)) {
    return unavailable([diagnostic('wing_off_contour', 'anchors', 'analytic wings are not within flattening tolerance of the derived cap')]);
  }
  const leftIndex = nearestIndex(working, left);
  const rightIndex = nearestIndex(working, right);
  if (
    Math.hypot(working[leftIndex].u - left.u, working[leftIndex].v - left.v) > FRENCH_WING_ON_CONTOUR_TOLERANCE_V1
    || Math.hypot(working[rightIndex].u - right.u, working[rightIndex].v - right.v) > FRENCH_WING_ON_CONTOUR_TOLERANCE_V1
  ) {
    return unavailable([diagnostic('wing_off_contour', 'anchors', 'compiled wings are not on the derived flattened contour')]);
  }

  const forward = walkPolyline(working, leftIndex, rightIndex, 1);
  const backward = walkPolyline(working, leftIndex, rightIndex, -1);
  const tipWalk = minV(forward) <= minV(backward) ? forward : backward;
  const capFromRight = [...tipWalk].reverse();
  if (capFromRight.length < 2) {
    return unavailable([diagnostic('wing_off_contour', 'contour', 'tip contour between wings is not drawable')]);
  }

  const leftOffsetU = left.u - center.u;
  const rightOffsetU = right.u - center.u;
  const boundaryCommands: ParsedNailPathV7['commands'] = canonicalParameters.variant === 'pointed'
    ? [
        { command: 'M', values: [left.u, left.v] },
        { command: 'L', values: [center.u, center.v] },
        { command: 'L', values: [right.u, right.v] },
      ]
    : [
        { command: 'M', values: [left.u, left.v] },
        {
          command: 'C',
          values: [
            center.u + leftOffsetU * 0.78,
            left.v + (center.v - left.v) * 0.16,
            center.u + leftOffsetU * 0.42,
            center.v,
            center.u,
            center.v,
          ],
        },
        {
          command: 'C',
          values: [
            center.u + rightOffsetU * 0.42,
            center.v,
            center.u + rightOffsetU * 0.78,
            right.v + (center.v - right.v) * 0.16,
            right.u,
            right.v,
          ],
        },
      ];

  const sampledBoundary = sampleSmileBoundary(boundaryCommands, FRENCH_BOUNDARY_CONTAINMENT_SAMPLES_V1);
  if (!sampledBoundary) {
    return unavailable([diagnostic('non_drawable_boundary', 'boundaryPathData', 'smile-line boundary could not be sampled for containment')]);
  }
  for (const sample of sampledBoundary) {
    if (!Number.isFinite(sample.u) || !Number.isFinite(sample.v)) {
      return unavailable([diagnostic('coordinates_out_of_range', 'boundaryPathData', 'smile-line boundary samples must stay finite')]);
    }
    if (!isInsideOrOnContour(flattened, sample, FRENCH_BOUNDARY_CONTAINMENT_TOLERANCE_V1)) {
      return unavailable([
        diagnostic(
          'boundary_outside_contour',
          'boundaryPathData',
          `smile-line boundary exits the exact contour at u=${sample.u} v=${sample.v} (tolerance=${FRENCH_BOUNDARY_CONTAINMENT_TOLERANCE_V1})`,
        ),
      ]);
    }
  }

  const fillCommands: ParsedNailPathV7['commands'] = [
    ...boundaryCommands,
    ...capFromRight.slice(1).map((item) => ({ command: 'L' as const, values: [item.u, item.v] })),
    { command: 'Z', values: [] },
  ];

  const boundaryPathData = serializeCommands(boundaryCommands);
  const fillPathData = serializeCommands(fillCommands);
  if (!boundaryPathData || !isDrawableNailPathDataV7(boundaryPathData, 'stroke')) {
    return unavailable([diagnostic('non_drawable_boundary', 'boundaryPathData', 'smile-line boundary must be a drawable stroke-only path')]);
  }
  if (!fillPathData || !isDrawableNailPathDataV7(fillPathData, 'area')) {
    return unavailable([diagnostic('non_drawable_fill', 'fillPathData', 'French fill must be a closed drawable path')]);
  }
  if (parseNailPathDataV7(fillPathData)?.commands.some((item) => item.command !== 'Z' && item.values.some((value) => value < 0 || value > 1))) {
    return unavailable([diagnostic('coordinates_out_of_range', 'fillPathData', 'compiled paths must stay inside finite [0, 1]')]);
  }

  const fillColor = colorWithOpacity(canonicalParameters.fillColor, canonicalParameters.fillOpacity);
  const outlineColor = colorWithOpacity(canonicalParameters.outlineColor, 1);
  if (!fillColor || !outlineColor) {
    return unavailable([diagnostic('parameters_invalid', 'fillColor', 'French colors must be canonical #rrggbb')]);
  }

  const transform = structuredClone(IDENTITY_TRANSFORM_V7);
  const fill: FrenchProjectedVectorShapeV1 = {
    kind: 'vector_shape',
    visible: true,
    locked: true,
    opacity: 1,
    transform: structuredClone(transform),
    pathData: fillPathData,
    fill: fillColor,
  };
  const outline: FrenchProjectedVectorShapeV1 | null = canonicalParameters.outlineEnabled
    ? {
        kind: 'vector_shape',
        visible: true,
        locked: true,
        opacity: 1,
        transform: structuredClone(transform),
        pathData: boundaryPathData,
        stroke: outlineColor,
        strokeWidthMm: canonicalParameters.outlineWidthMm,
      }
    : null;

  return {
    ok: true,
    fidelity: 'exact',
    manufacturingValidated: false,
    boundaryPathData,
    fillPathData,
    projection: {
      coordinateSpace: FRENCH_PATH_COORDINATE_SPACE_V1,
      fill,
      outline,
    },
    cacheIdentity: identity,
    anchors: { left, center, right },
    diagnostics: [],
  };
}

export function frenchGoldenCaseIdV1(
  shape: NailShape,
  length: NailLength,
  preset: FrenchRecipeDefaultPresetV1,
): string {
  return `${shape}.${length}.${preset}`;
}
