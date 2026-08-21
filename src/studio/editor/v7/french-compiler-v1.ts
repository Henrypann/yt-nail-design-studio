/**
 * FRENCH-02 pure exact-geometry French path compiler.
 *
 * Consumes only exact geometry from the FRENCH-02 adapter plus canonical
 * FrenchRecipeParametersV1. It returns derived nail-local paths, an ID-free
 * vector projection, cache identity, and diagnostics. It does not read or write
 * EditorDoc, store, history, or IDs, and it never claims manufacturing validity.
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
  FRENCH_GOLDEN_FINGER_V1,
  FRENCH_SIGNED_LENGTHS_V1,
  FRENCH_SIGNED_SHAPES_V1,
  type FrenchExactGeometryV1,
  type FrenchSignedLengthV1,
  type FrenchSignedShapeV1,
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
import type { NailPointV7, RgbaColorV7, Transform2DV7 } from './model.ts';

export const FRENCH_PATH_COMPILER_REVISION_V1 = 'french-path-v1';
export const FRENCH_PATH_COORDINATE_SPACE_V1 = 'nail-local-v1';

const SAMPLE_STEPS = 24;
const UNIT_EPS = 1e-12;
const ON_CONTOUR_EPS = 0.01;
const FULL_SHA256 = /^[0-9a-f]{64}$/;

export type FrenchPathDiagnosticCodeV1 =
  | 'parameters_invalid'
  | 'geometry_not_exact'
  | 'contour_invalid'
  | 'wing_off_contour'
  | 'non_drawable_boundary'
  | 'non_drawable_fill'
  | 'coordinates_out_of_range'
  | FrenchRecipeDiagnosticV1['code'];

export interface FrenchPathDiagnosticV1 {
  code: FrenchPathDiagnosticCodeV1;
  path: string;
  message: string;
}

export interface FrenchProjectedVectorShapeV1 {
  kind: 'vector_shape';
  visible: true;
  locked: false;
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

function unavailable(diagnostics: FrenchPathDiagnosticV1[]): Extract<FrenchPathCompileResultV1, { ok: false }> {
  return { ok: false, fidelity: 'unavailable', manufacturingValidated: false, diagnostics };
}

function diagnostic(code: FrenchPathDiagnosticCodeV1, path: string, message: string): FrenchPathDiagnosticV1 {
  return { code, path, message };
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

function cubicPoint(p0: NailPointV7, p1: NailPointV7, p2: NailPointV7, p3: NailPointV7, t: number): NailPointV7 | null {
  const mt = 1 - t;
  return point(
    mt * mt * mt * p0.u + 3 * mt * mt * t * p1.u + 3 * mt * t * t * p2.u + t * t * t * p3.u,
    mt * mt * mt * p0.v + 3 * mt * mt * t * p1.v + 3 * mt * t * t * p2.v + t * t * t * p3.v,
  );
}

function quadraticPoint(p0: NailPointV7, p1: NailPointV7, p2: NailPointV7, t: number): NailPointV7 | null {
  const mt = 1 - t;
  return point(
    mt * mt * p0.u + 2 * mt * t * p1.u + t * t * p2.u,
    mt * mt * p0.v + 2 * mt * t * p1.v + t * t * p2.v,
  );
}

function appendUnique(points: NailPointV7[], next: NailPointV7): void {
  const last = points[points.length - 1];
  if (!last || last.u !== next.u || last.v !== next.v) points.push(next);
}

function sampleContour(parsed: ParsedNailPathV7): NailPointV7[] | null {
  const points: NailPointV7[] = [];
  let current: NailPointV7 | null = null;
  let start: NailPointV7 | null = null;
  for (const { command, values } of parsed.commands) {
    if (command === 'M') {
      current = point(values[0], values[1]);
      if (!current) return null;
      start = current;
      appendUnique(points, current);
    } else if (command === 'L') {
      const next = point(values[0], values[1]);
      if (!current || !next) return null;
      appendUnique(points, next);
      current = next;
    } else if (command === 'Q') {
      const control = point(values[0], values[1]);
      const next = point(values[2], values[3]);
      if (!current || !control || !next) return null;
      for (let step = 1; step <= SAMPLE_STEPS; step += 1) {
        const sampled = quadraticPoint(current, control, next, step / SAMPLE_STEPS);
        if (!sampled) return null;
        appendUnique(points, sampled);
      }
      current = next;
    } else if (command === 'C') {
      const c1 = point(values[0], values[1]);
      const c2 = point(values[2], values[3]);
      const next = point(values[4], values[5]);
      if (!current || !c1 || !c2 || !next) return null;
      for (let step = 1; step <= SAMPLE_STEPS; step += 1) {
        const sampled = cubicPoint(current, c1, c2, next, step / SAMPLE_STEPS);
        if (!sampled) return null;
        appendUnique(points, sampled);
      }
      current = next;
    } else if (command === 'Z') {
      if (start) appendUnique(points, start);
    }
  }
  return points.length >= 3 ? points : null;
}

function intersectionsAtV(polyline: readonly NailPointV7[], v: number): number[] {
  const xs: number[] = [];
  for (let i = 0; i < polyline.length - 1; i += 1) {
    const a = polyline[i];
    const b = polyline[i + 1];
    const minV = Math.min(a.v, b.v);
    const maxV = Math.max(a.v, b.v);
    if (v < minV - UNIT_EPS || v > maxV + UNIT_EPS) continue;
    if (Math.abs(a.v - b.v) < UNIT_EPS) {
      if (Math.abs(v - a.v) < UNIT_EPS) xs.push(a.u, b.u);
      continue;
    }
    const t = (v - a.v) / (b.v - a.v);
    if (t >= -UNIT_EPS && t <= 1 + UNIT_EPS) xs.push(a.u + (b.u - a.u) * Math.min(1, Math.max(0, t)));
  }
  return xs.filter(Number.isFinite);
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
  if (bestIndex < 0 || bestDist > ON_CONTOUR_EPS) return false;
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
  return parseNailPathDataV7(serialized) ? serializeNailPathDataV7(parseNailPathDataV7(serialized)!) : null;
}

function colorWithOpacity(hex: string, opacity: number): RgbaColorV7 | null {
  const color = parseHexColorV7(hex);
  if (!color) return null;
  return { ...color, a: opacity };
}

function cacheIdentity(
  geometry: FrenchExactGeometryV1,
  serialization: string,
): FrenchPathCacheIdentityV1 | null {
  if (!FULL_SHA256.test(geometry.registryAssetSetSha256) || !FULL_SHA256.test(geometry.contourIdentity)) return null;
  if (geometry.revision === 'latest' || geometry.revision.includes('latest')) return null;
  const geometryRef = `${geometry.assetId}@${geometry.revision}`;
  const cacheKey = [
    `compiler=${FRENCH_PATH_COMPILER_REVISION_V1}`,
    `recipe=${FRENCH_RECIPE_ID_V1}@${FRENCH_RECIPE_REVISION_V1}`,
    `params=${serialization}`,
    `geometry=${geometryRef}`,
    `finger=${geometry.finger}`,
    `registrySha256=${geometry.registryAssetSetSha256}`,
    `contour=${geometry.contourIdentity}`,
  ].join('|');
  const bindingKey = [
    `finger=${geometry.finger}`,
    `geometry=${geometryRef}`,
    `compiler=${FRENCH_PATH_COMPILER_REVISION_V1}`,
    `recipe=${FRENCH_RECIPE_ID_V1}@${FRENCH_RECIPE_REVISION_V1}`,
    `params=${serialization}`,
  ].join('|');
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
 * smile-line; the closed fill path is never stroked.
 */
export function compileFrenchPathV1(
  geometry: FrenchExactGeometryV1,
  parameters: FrenchRecipeParametersV1,
): FrenchPathCompileResultV1 {
  if (
    geometry.fidelity !== 'exact'
    || geometry.evidence !== 'signed_off'
    || geometry.manufacturingValidated !== false
    || geometry.coordinateSpace !== FRENCH_PATH_COORDINATE_SPACE_V1
  ) {
    return unavailable([diagnostic('geometry_not_exact', 'geometry', 'compiler accepts only exact signed_off geometry')]);
  }

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
  if (!identity) {
    return unavailable([diagnostic('geometry_not_exact', 'cacheIdentity', 'cache identity requires full SHA values and forbids latest/truncated digests')]);
  }

  const parsedContour = parseNailPathDataV7(geometry.contourPathData);
  if (!parsedContour || !isDrawableNailPathDataV7(geometry.contourPathData, 'area')) {
    return unavailable([diagnostic('contour_invalid', 'contourPathData', 'exact geometry contour is not a closed drawable nail-local path')]);
  }
  const polyline = sampleContour(parsedContour);
  if (!polyline) {
    return unavailable([diagnostic('contour_invalid', 'contourPathData', 'exact geometry contour could not be sampled')]);
  }

  const leftUs = intersectionsAtV(polyline, canonicalParameters.leftWingV);
  const rightUs = intersectionsAtV(polyline, canonicalParameters.rightWingV);
  if (leftUs.length < 2 || rightUs.length < 2) {
    return unavailable([diagnostic('wing_off_contour', 'leftWingV', 'smile-line wings must intersect the signed contour')]);
  }

  const left = point(Math.min(...leftUs), canonicalParameters.leftWingV);
  const right = point(Math.max(...rightUs), canonicalParameters.rightWingV);
  const center = point(geometry.canvasCenterU, canonicalParameters.centerV);
  if (!left || !right || !center) {
    return unavailable([diagnostic('coordinates_out_of_range', 'anchors', 'compiled anchors must stay inside finite [0, 1]')]);
  }

  const working = polyline.map((item) => ({ ...item }));
  if (!insertOnContour(working, left) || !insertOnContour(working, right)) {
    return unavailable([diagnostic('wing_off_contour', 'anchors', 'compiled wings are not on the signed contour')]);
  }
  const leftIndex = nearestIndex(working, left);
  const rightIndex = nearestIndex(working, right);
  if (
    Math.hypot(working[leftIndex].u - left.u, working[leftIndex].v - left.v) > ON_CONTOUR_EPS
    || Math.hypot(working[rightIndex].u - right.u, working[rightIndex].v - right.v) > ON_CONTOUR_EPS
  ) {
    return unavailable([diagnostic('wing_off_contour', 'anchors', 'compiled wings are not on the signed contour')]);
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
    locked: false,
    opacity: 1,
    transform: structuredClone(transform),
    pathData: fillPathData,
    fill: fillColor,
  };
  const outline: FrenchProjectedVectorShapeV1 | null = canonicalParameters.outlineEnabled
    ? {
        kind: 'vector_shape',
        visible: true,
        locked: false,
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
