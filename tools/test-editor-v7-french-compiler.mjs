#!/usr/bin/env node
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  isClosedNailPathDataV7,
  isDrawableNailPathDataV7,
  parseNailPathDataV7,
} from '../src/studio/editor/v7/flat-vector.ts';
import {
  compileFrenchPathV1,
  enumerateFrenchGoldenBindingsV1,
  enumerateFrenchGoldenCasesV1,
  FRENCH_ANALYTIC_ROOT_TOLERANCE_V1,
  FRENCH_CONTOUR_FLATNESS_TOLERANCE_V1,
  FRENCH_CONTOUR_MAX_POINTS_V1,
  FRENCH_CONTOUR_MAX_SUBDIVISION_DEPTH_V1,
  FRENCH_EXACT_KEY_FIELDS_V1,
  FRENCH_EXACT_KEY_KIND_BINDING_V1,
  FRENCH_EXACT_KEY_KIND_CACHE_V1,
  FRENCH_PATH_COMPILER_REVISION_V1,
  FRENCH_WING_ON_CONTOUR_TOLERANCE_V1,
  frenchExactKeyPreimageV1,
  validateFrenchExactGeometryTrustBoundaryV1,
} from '../src/studio/editor/v7/french-compiler-v1.ts';
import {
  canonicalizeSilhouetteToNailLocalV1,
  FRENCH_GOLDEN_FINGER_V1,
  FRENCH_SIGNED_LENGTHS_V1,
  FRENCH_SIGNED_SHAPES_V1,
  isCanonicalSingleClosedNailPathV1,
  resolveExactFrenchGeometryInputV1,
  sha256Hex,
} from '../src/studio/editor/v7/french-geometry-input-v1.ts';
import {
  createDefaultFrenchRecipeParametersV1,
  FRENCH_RECIPE_ID_V1,
  FRENCH_RECIPE_PRESETS_V1,
  FRENCH_RECIPE_REVISION_V1,
} from '../src/studio/editor/v7/french-recipe-v1.ts';
import {
  PRODUCT_GEOMETRY_ASSET_SET_SHA256_V7,
  PRODUCT_GEOMETRY_REVISION_V7,
  resolveSignedProductGeometryRefV7,
} from '../src/studio/editor/v7/geometry-registry.ts';

/** Independent match bound: flattening tolerance plus 5-decimal serialization slack. Not a copy of the compiler sampler. */
const INDEPENDENT_MATCH_TOLERANCE = 5e-4;
const INDEPENDENT_CURVE_SAMPLES = 256;

function clone(value) {
  return structuredClone(value);
}

function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function cubicPoint(p0, p1, p2, p3, t) {
  const mt = 1 - t;
  return {
    u: mt * mt * mt * p0.u + 3 * mt * mt * t * p1.u + 3 * mt * t * t * p2.u + t * t * t * p3.u,
    v: mt * mt * mt * p0.v + 3 * mt * mt * t * p1.v + 3 * mt * t * t * p2.v + t * t * t * p3.v,
  };
}

function quadraticPoint(p0, p1, p2, t) {
  const mt = 1 - t;
  return {
    u: mt * mt * p0.u + 2 * mt * t * p1.u + t * t * p2.u,
    v: mt * mt * p0.v + 2 * mt * t * p1.v + t * t * p2.v,
  };
}

function linePoint(p0, p1, t) {
  return { u: lerp(p0.u, p1.u, t), v: lerp(p0.v, p1.v, t) };
}

function parseIndependentSegments(pathData) {
  const parsed = parseNailPathDataV7(pathData);
  assert.ok(parsed);
  const segments = [];
  let current = null;
  let start = null;
  let moves = 0;
  for (const { command, values } of parsed.commands) {
    if (command === 'M') {
      moves += 1;
      assert.equal(moves, 1, 'independent reference rejects a second subpath');
      current = { u: values[0], v: values[1] };
      start = current;
    } else if (command === 'L') {
      const next = { u: values[0], v: values[1] };
      segments.push({ kind: 'L', p0: current, p1: next });
      current = next;
    } else if (command === 'Q') {
      const control = { u: values[0], v: values[1] };
      const next = { u: values[2], v: values[3] };
      segments.push({ kind: 'Q', p0: current, p1: control, p2: next });
      current = next;
    } else if (command === 'C') {
      const c1 = { u: values[0], v: values[1] };
      const c2 = { u: values[2], v: values[3] };
      const next = { u: values[4], v: values[5] };
      segments.push({ kind: 'C', p0: current, p1: c1, p2: c2, p3: next });
      current = next;
    } else if (command === 'Z' && current && start && (current.u !== start.u || current.v !== start.v)) {
      segments.push({ kind: 'L', p0: current, p1: start });
    }
  }
  return segments;
}

function evalIndependent(segment, t) {
  if (segment.kind === 'L') return linePoint(segment.p0, segment.p1, t);
  if (segment.kind === 'Q') return quadraticPoint(segment.p0, segment.p1, segment.p2, t);
  return cubicPoint(segment.p0, segment.p1, segment.p2, segment.p3, t);
}

/** Uniform sampling + bisection. Independent of the compiler's adaptive de Casteljau flattener. */
function independentUsAtV(segment, v) {
  const us = [];
  const push = (t) => {
    const hit = evalIndependent(segment, Math.min(1, Math.max(0, t)));
    if (Number.isFinite(hit.u)) us.push(hit.u);
  };
  let prevT = 0;
  let prevF = evalIndependent(segment, 0).v - v;
  if (Math.abs(prevF) <= 1e-12) push(0);
  for (let step = 1; step <= INDEPENDENT_CURVE_SAMPLES; step += 1) {
    const t = step / INDEPENDENT_CURVE_SAMPLES;
    const f = evalIndependent(segment, t).v - v;
    if (Math.abs(f) <= 1e-12) push(t);
    else if (prevF * f < 0) {
      let lo = prevT;
      let hi = t;
      let flo = prevF;
      for (let i = 0; i < 48; i += 1) {
        const mid = (lo + hi) / 2;
        const fm = evalIndependent(segment, mid).v - v;
        if (flo * fm <= 0) hi = mid;
        else {
          lo = mid;
          flo = fm;
        }
      }
      push((lo + hi) / 2);
    }
    prevT = t;
    prevF = f;
  }
  return us;
}

function independentWings(pathData, v) {
  const us = parseIndependentSegments(pathData).flatMap((segment) => independentUsAtV(segment, v));
  assert.ok(us.length >= 2, 'independent reference must find both sidewalls');
  return { leftU: Math.min(...us), rightU: Math.max(...us) };
}

/** Dense uniform polyline used only as an independent higher-precision contour oracle. */
function independentHighPrecisionPolyline(pathData) {
  const points = [];
  const push = (point) => {
    const last = points[points.length - 1];
    if (!last || last.u !== point.u || last.v !== point.v) points.push(point);
  };
  for (const segment of parseIndependentSegments(pathData)) {
    push(segment.p0);
    for (let step = 1; step <= INDEPENDENT_CURVE_SAMPLES; step += 1) {
      push(evalIndependent(segment, step / INDEPENDENT_CURVE_SAMPLES));
    }
  }
  return points;
}

function minDist(points, target) {
  let best = Number.POSITIVE_INFINITY;
  for (let i = 0; i < points.length - 1; i += 1) {
    const a = points[i];
    const b = points[i + 1];
    const dx = b.u - a.u;
    const dy = b.v - a.v;
    const len2 = dx * dx + dy * dy;
    const t = len2 === 0 ? 0 : Math.min(1, Math.max(0, ((target.u - a.u) * dx + (target.v - a.v) * dy) / len2));
    const q = { u: a.u + t * dx, v: a.v + t * dy };
    best = Math.min(best, Math.hypot(target.u - q.u, target.v - q.v));
  }
  return best;
}

function pathValues(pathData) {
  const parsed = parseNailPathDataV7(pathData);
  assert.ok(parsed, `path must parse: ${pathData.slice(0, 80)}`);
  return parsed.commands.flatMap((item) => item.values);
}

function fillCapPoints(fillPathData) {
  const parsed = parseNailPathDataV7(fillPathData);
  assert.ok(parsed);
  const smileEndsAt = parsed.commands.findIndex((item, index) => {
    if (index === 0) return false;
    if (parsed.commands.some((command) => command.command === 'C')) {
      return item.command === 'L';
    }
    return item.command === 'L' && parsed.commands.slice(0, index + 1).filter((command) => command.command === 'L').length > 2;
  });
  const capStart = smileEndsAt < 0 ? parsed.commands.length : smileEndsAt;
  const points = [];
  for (const { command, values } of parsed.commands.slice(capStart)) {
    if (command === 'L') points.push({ u: values[0], v: values[1] });
  }
  return points;
}

function independentExactKeyPreimage(kind, geometry, serialization) {
  const fields = {
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
  };
  return FRENCH_EXACT_KEY_FIELDS_V1
    .map((key) => `${key.length}:${key}:${String(fields[key]).length}:${fields[key]}`)
    .join('\n');
}

function compileCase(shape, length, preset, finger) {
  const ref = resolveSignedProductGeometryRefV7(shape, length, finger);
  assert.ok(ref, `${shape}/${length}/${finger} must resolve as signed product geometry`);
  const geometry = resolveExactFrenchGeometryInputV1(ref, finger, PRODUCT_GEOMETRY_ASSET_SET_SHA256_V7);
  assert.equal(geometry.ok, true, geometry.ok ? '' : JSON.stringify(geometry.diagnostics));
  const parameters = createDefaultFrenchRecipeParametersV1(preset);
  const frozenGeometry = deepFreeze(clone(geometry.geometry));
  const frozenParameters = deepFreeze(clone(parameters));
  const beforeGeometry = JSON.stringify(frozenGeometry);
  const beforeParameters = JSON.stringify(frozenParameters);
  const compiled = compileFrenchPathV1(frozenGeometry, frozenParameters);
  assert.equal(JSON.stringify(frozenGeometry), beforeGeometry, 'compiler must not mutate geometry');
  assert.equal(JSON.stringify(frozenParameters), beforeParameters, 'compiler must not mutate parameters');
  return { ref, geometry: geometry.geometry, parameters, compiled };
}

function forgeGeometry(base, overrides) {
  return { ...clone(base), ...overrides };
}

function assertRejected(compiled, path, code) {
  assert.equal(compiled.ok, false, `expected fail-closed at ${path}, got ${JSON.stringify(compiled)}`);
  assert.equal(compiled.fidelity, 'unavailable');
  assert.equal(compiled.manufacturingValidated, false);
  assert.ok(
    compiled.diagnostics.some((item) => item.path === path && (code === undefined || item.code === code)),
    `expected diagnostic path=${path} code=${code ?? '*'} got ${JSON.stringify(compiled.diagnostics)}`,
  );
}

{
  assert.equal(sha256Hex(''), 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  assert.equal(sha256Hex('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  assert.equal(FRENCH_PATH_COMPILER_REVISION_V1, 'french-path-v1');
  assert.equal(FRENCH_PATH_COMPILER_REVISION_V1.includes('latest'), false);
  assert.deepEqual([...FRENCH_SIGNED_SHAPES_V1], ['almond', 'oval', 'coffin']);
  assert.deepEqual([...FRENCH_SIGNED_LENGTHS_V1], ['short', 'medium', 'long', 'extra-long']);
  assert.deepEqual([...FRENCH_RECIPE_PRESETS_V1], ['classic', 'micro', 'soft', 'deep', 'pointed']);
  assert.equal(FRENCH_GOLDEN_FINGER_V1, 'L1');
  assert.equal(PRODUCT_GEOMETRY_ASSET_SET_SHA256_V7.length, 64);
  assert.match(PRODUCT_GEOMETRY_ASSET_SET_SHA256_V7, /^[0-9a-f]{64}$/);
  assert.equal(PRODUCT_GEOMETRY_REVISION_V7.includes('latest'), false);
  assert.equal(FRENCH_CONTOUR_FLATNESS_TOLERANCE_V1, 1e-4);
  assert.equal(FRENCH_CONTOUR_MAX_SUBDIVISION_DEPTH_V1, 12);
  assert.equal(FRENCH_CONTOUR_MAX_POINTS_V1, 2048);
  assert.equal(FRENCH_WING_ON_CONTOUR_TOLERANCE_V1, 4e-4);
  assert.equal(FRENCH_ANALYTIC_ROOT_TOLERANCE_V1, 1e-12);
  assert.ok(FRENCH_WING_ON_CONTOUR_TOLERANCE_V1 >= FRENCH_CONTOUR_FLATNESS_TOLERANCE_V1);
}
console.log('[french-compiler] identity constants: PASS');

{
  const hv = canonicalizeSilhouetteToNailLocalV1('0 0 100 100', 'M 10 10 H 90 V 90 H 10 Z');
  assert.equal(hv.ok, true, hv.ok ? '' : JSON.stringify(hv.diagnostics));
  assert.equal(hv.pathData.includes('H'), false);
  assert.equal(hv.pathData.includes('V'), false);
  assert.equal(isClosedNailPathDataV7(hv.pathData), true);
  assert.equal(isDrawableNailPathDataV7(hv.pathData, 'area'), true);
  assert.equal(isCanonicalSingleClosedNailPathV1(hv.pathData), true);
  assert.equal(hv.contourIdentity.length, 64);
  assert.equal(hv.canvasCenterU, 0);
}
console.log('[french-compiler] H/V convert to absolute L: PASS');

{
  const secondMove = canonicalizeSilhouetteToNailLocalV1('0 0 100 100', 'M 10 10 L 90 10 M 20 20 L 80 80 L 80 90 L 20 90 Z');
  assert.equal(secondMove.ok, false);
  assert.equal(secondMove.reason, 'malformed_path');
  assert.match(secondMove.diagnostics[0].message, /second M|single closed subpath/);

  const twoClosed = canonicalizeSilhouetteToNailLocalV1(
    '0 0 100 100',
    'M 10 10 L 90 10 L 90 90 L 10 90 Z M 20 20 L 80 20 L 80 80 L 20 80 Z',
  );
  assert.equal(twoClosed.ok, false);
  assert.ok(twoClosed.reason === 'malformed_path' || twoClosed.reason === 'open_path');

  const implicitLine = canonicalizeSilhouetteToNailLocalV1('0 0 100 100', 'M 10 10 90 10 L 90 90 L 10 90 Z');
  assert.equal(implicitLine.ok, true, implicitLine.ok ? '' : JSON.stringify(implicitLine.diagnostics));
  assert.equal(isCanonicalSingleClosedNailPathV1(implicitLine.pathData), true);
}
console.log('[french-compiler] reject second M / multiple subpaths: PASS');

{
  const goldens = enumerateFrenchGoldenCasesV1();
  const bindings = enumerateFrenchGoldenBindingsV1();
  assert.equal(goldens.length, 60);
  assert.equal(bindings.length, 600);
  assert.equal(goldens.every((item) => item.finger === 'L1'), true);
  assert.equal(new Set(goldens.map((item) => item.id)).size, 60);
  assert.equal(bindings.filter((item) => item.shape === 'almond' && item.length === 'medium' && item.preset === 'classic').length, 10);
}
console.log('[french-compiler] 60/600 enumeration: PASS');

const goldenResults = [];
const bindingKeys = new Set();
const cacheKeys = new Set();
const pathByContour = new Map();

for (const item of enumerateFrenchGoldenCasesV1()) {
  const { geometry, compiled, parameters } = compileCase(item.shape, item.length, item.preset, item.finger);
  assert.equal(compiled.ok, true, compiled.ok ? '' : JSON.stringify(compiled.diagnostics));
  assert.equal(compiled.fidelity, 'exact');
  assert.equal(compiled.manufacturingValidated, false);
  assert.equal(compiled.projection.fill.kind, 'vector_shape');
  assert.equal('id' in compiled.projection.fill, false);
  assert.equal(compiled.projection.fill.stroke, undefined);
  assert.equal(typeof compiled.projection.fill.fill, 'object');
  assert.equal(isClosedNailPathDataV7(compiled.fillPathData), true);
  assert.equal(isDrawableNailPathDataV7(compiled.fillPathData, 'area'), true);
  assert.equal(isDrawableNailPathDataV7(compiled.boundaryPathData, 'stroke'), true);
  assert.equal(isClosedNailPathDataV7(compiled.boundaryPathData), false);
  assert.equal(compiled.projection.fill.pathData, compiled.fillPathData);
  assert.equal(compiled.projection.outline, null);
  assert.equal(pathValues(compiled.fillPathData).every((value) => Number.isFinite(value) && value >= 0 && value <= 1), true);
  assert.equal(pathValues(compiled.boundaryPathData).every((value) => Number.isFinite(value) && value >= 0 && value <= 1), true);
  assert.equal(compiled.cacheIdentity.compilerRevision, 'french-path-v1');
  assert.equal(compiled.cacheIdentity.recipeId, FRENCH_RECIPE_ID_V1);
  assert.equal(compiled.cacheIdentity.recipeRevision, FRENCH_RECIPE_REVISION_V1);
  assert.equal(compiled.cacheIdentity.registryAssetSetSha256, PRODUCT_GEOMETRY_ASSET_SET_SHA256_V7);
  assert.equal(compiled.cacheIdentity.registryAssetSetSha256.length, 64);
  assert.equal(compiled.cacheIdentity.contourIdentity.length, 64);
  assert.equal(compiled.cacheIdentity.contourIdentity, sha256Hex(geometry.contourPathData));
  assert.equal(compiled.cacheIdentity.assetId, geometry.assetId);
  assert.equal(compiled.cacheIdentity.revision, geometry.revision);
  assert.equal(compiled.cacheIdentity.finger, item.finger);
  assert.match(compiled.cacheIdentity.cacheKey, /^[0-9a-f]{64}$/);
  assert.match(compiled.cacheIdentity.bindingKey, /^[0-9a-f]{64}$/);
  assert.notEqual(compiled.cacheIdentity.cacheKey, compiled.cacheIdentity.bindingKey);
  assert.equal(compiled.cacheIdentity.cacheKey.includes('|'), false);
  assert.equal(compiled.cacheIdentity.cacheKey.includes('latest'), false);
  assert.equal(compiled.cacheIdentity.cacheKey.includes(geometry.assetId), false);
  assert.equal(geometry.shape, item.shape);
  assert.equal(geometry.length, item.length);
  assert.notEqual(geometry.shape, geometry.assetId, 'shape must come from registry, not raw assetId');

  const cachePreimage = independentExactKeyPreimage(FRENCH_EXACT_KEY_KIND_CACHE_V1, geometry, compiled.cacheIdentity.parameterSerialization);
  const bindingPreimage = independentExactKeyPreimage(FRENCH_EXACT_KEY_KIND_BINDING_V1, geometry, compiled.cacheIdentity.parameterSerialization);
  assert.equal(cachePreimage, frenchExactKeyPreimageV1(FRENCH_EXACT_KEY_KIND_CACHE_V1, geometry, compiled.cacheIdentity.parameterSerialization));
  assert.equal(bindingPreimage, frenchExactKeyPreimageV1(FRENCH_EXACT_KEY_KIND_BINDING_V1, geometry, compiled.cacheIdentity.parameterSerialization));
  assert.equal(sha256Hex(cachePreimage), compiled.cacheIdentity.cacheKey);
  assert.equal(sha256Hex(bindingPreimage), compiled.cacheIdentity.bindingKey);
  assert.match(cachePreimage, new RegExp(PRODUCT_GEOMETRY_ASSET_SET_SHA256_V7));
  assert.match(cachePreimage, new RegExp(geometry.contourIdentity));
  assert.match(cachePreimage, new RegExp(`finger:${geometry.finger.length}:${geometry.finger}`));
  assert.match(bindingPreimage, new RegExp(PRODUCT_GEOMETRY_ASSET_SET_SHA256_V7));
  assert.match(bindingPreimage, new RegExp(geometry.contourIdentity));

  const again = compileFrenchPathV1(geometry, createDefaultFrenchRecipeParametersV1(item.preset));
  assert.equal(again.ok, true);
  assert.equal(again.fillPathData, compiled.fillPathData);
  assert.equal(again.boundaryPathData, compiled.boundaryPathData);
  assert.equal(again.cacheIdentity.cacheKey, compiled.cacheIdentity.cacheKey);
  assert.equal(JSON.stringify(again.projection), JSON.stringify(compiled.projection));

  const independentContour = independentHighPrecisionPolyline(geometry.contourPathData);
  const leftWings = independentWings(geometry.contourPathData, parameters.leftWingV);
  const rightWings = independentWings(geometry.contourPathData, parameters.rightWingV);
  assert.ok(
    Math.abs(compiled.anchors.left.u - leftWings.leftU) <= INDEPENDENT_MATCH_TOLERANCE,
    `${item.id} left wing ${compiled.anchors.left.u} must match independent ${leftWings.leftU}`,
  );
  assert.ok(
    Math.abs(compiled.anchors.right.u - rightWings.rightU) <= INDEPENDENT_MATCH_TOLERANCE,
    `${item.id} right wing ${compiled.anchors.right.u} must match independent ${rightWings.rightU}`,
  );
  assert.ok(minDist(independentContour, compiled.anchors.left) <= INDEPENDENT_MATCH_TOLERANCE, `${item.id} left wing must sit on exact contour`);
  assert.ok(minDist(independentContour, compiled.anchors.right) <= INDEPENDENT_MATCH_TOLERANCE, `${item.id} right wing must sit on exact contour`);
  for (const capPoint of fillCapPoints(compiled.fillPathData)) {
    assert.ok(
      minDist(independentContour, capPoint) <= INDEPENDENT_MATCH_TOLERANCE,
      `${item.id} derived cap point ${capPoint.u},${capPoint.v} must stay within flattening tolerance of the exact source`,
    );
  }
  if (item.preset === 'pointed') {
    assert.ok(compiled.anchors.center.v > compiled.anchors.left.v && compiled.anchors.center.v > compiled.anchors.right.v, `${item.id} pointed center toward canvas root`);
  } else {
    assert.ok(compiled.anchors.center.v < compiled.anchors.left.v && compiled.anchors.center.v < compiled.anchors.right.v, `${item.id} smooth center toward canvas tip`);
  }
  goldenResults.push({ item, compiled, geometry });
}
assert.equal(goldenResults.length, 60);
console.log('[french-compiler] 60 golden exact compiles: PASS');

for (const item of enumerateFrenchGoldenBindingsV1()) {
  const { geometry, compiled } = compileCase(item.shape, item.length, item.preset, item.finger);
  assert.equal(compiled.ok, true, compiled.ok ? '' : JSON.stringify(compiled.diagnostics));
  assert.equal(compiled.fidelity, 'exact');
  assert.equal(compiled.manufacturingValidated, false);
  assert.equal(compiled.cacheIdentity.finger, item.finger);
  assert.equal(compiled.cacheIdentity.assetId, geometry.assetId);
  assert.equal(compiled.cacheIdentity.revision, geometry.revision);
  assert.equal(bindingKeys.has(compiled.cacheIdentity.bindingKey), false, `duplicate binding ${compiled.cacheIdentity.bindingKey}`);
  assert.equal(cacheKeys.has(compiled.cacheIdentity.cacheKey), false, `duplicate cache ${compiled.cacheIdentity.cacheKey}`);
  bindingKeys.add(compiled.cacheIdentity.bindingKey);
  cacheKeys.add(compiled.cacheIdentity.cacheKey);
  const pathKey = `${item.shape}|${item.length}|${item.preset}|${compiled.fillPathData}|${compiled.boundaryPathData}`;
  const previous = pathByContour.get(pathKey);
  if (previous) {
    assert.notEqual(previous.finger, item.finger);
    assert.notEqual(previous.cacheKey, compiled.cacheIdentity.cacheKey);
    assert.notEqual(previous.bindingKey, compiled.cacheIdentity.bindingKey);
  } else {
    pathByContour.set(pathKey, {
      finger: item.finger,
      cacheKey: compiled.cacheIdentity.cacheKey,
      bindingKey: compiled.cacheIdentity.bindingKey,
    });
  }
}
assert.equal(bindingKeys.size, 600);
assert.equal(cacheKeys.size, 600);
console.log('[french-compiler] 600 exact bindings with unique keys: PASS');

{
  const first = compileCase('almond', 'medium', 'classic', 'L1');
  const bytesA = JSON.stringify(first.compiled);
  const bytesB = JSON.stringify(compileCase('almond', 'medium', 'classic', 'L1').compiled);
  assert.equal(bytesA, bytesB);
  assert.equal(createHash('sha256').update(bytesA).digest('hex'), createHash('sha256').update(bytesB).digest('hex'));
  const outlined = createDefaultFrenchRecipeParametersV1('classic');
  outlined.outlineEnabled = true;
  outlined.outlineWidthMm = 0.12;
  const outlinedCompile = compileFrenchPathV1(first.geometry, outlined);
  assert.equal(outlinedCompile.ok, true, outlinedCompile.ok ? '' : JSON.stringify(outlinedCompile.diagnostics));
  assert.equal(outlinedCompile.projection.outline === null, false);
  assert.equal(outlinedCompile.projection.outline.stroke === undefined, false);
  assert.equal(outlinedCompile.projection.outline.fill, undefined);
  assert.equal(outlinedCompile.projection.outline.pathData, outlinedCompile.boundaryPathData);
  assert.equal(outlinedCompile.projection.fill.stroke, undefined);
  assert.equal('id' in outlinedCompile.projection.outline, false);
}
console.log('[french-compiler] deterministic bytes and separate outline stroke: PASS');

{
  const exact = resolveSignedProductGeometryRefV7('almond', 'medium', 'L1');
  assert.ok(exact);
  const wrongFinger = resolveExactFrenchGeometryInputV1(exact, 'R1', PRODUCT_GEOMETRY_ASSET_SET_SHA256_V7);
  assert.equal(wrongFinger.ok, false);
  assert.equal(wrongFinger.fidelity, 'unavailable');
  assert.equal(wrongFinger.reason, 'wrong_finger');
  assert.equal(wrongFinger.manufacturingValidated, false);

  const driftedRevision = `${exact.revision.slice(0, -1)}${exact.revision.at(-1) === 'a' ? 'b' : 'a'}`;
  assert.equal(driftedRevision.length, exact.revision.length);
  assert.notEqual(driftedRevision, exact.revision);
  const revisionDrift = resolveExactFrenchGeometryInputV1({ ...exact, revision: driftedRevision }, 'L1', PRODUCT_GEOMETRY_ASSET_SET_SHA256_V7);
  assert.equal(revisionDrift.ok, false);
  assert.equal(revisionDrift.reason, 'revision_drift');

  const truncatedSha = PRODUCT_GEOMETRY_ASSET_SET_SHA256_V7.slice(0, 16);
  const truncated = resolveExactFrenchGeometryInputV1(exact, 'L1', truncatedSha);
  assert.equal(truncated.ok, false);
  assert.equal(truncated.reason, 'wrong_sha');
  const flippedSha = `${PRODUCT_GEOMETRY_ASSET_SET_SHA256_V7.slice(0, -1)}${PRODUCT_GEOMETRY_ASSET_SET_SHA256_V7.at(-1) === 'a' ? 'b' : 'a'}`;
  const wrongSha = resolveExactFrenchGeometryInputV1(exact, 'L1', flippedSha);
  assert.equal(wrongSha.ok, false);
  assert.equal(wrongSha.reason, 'wrong_sha');

  const unknown = resolveExactFrenchGeometryInputV1({ assetId: 'geometry.unknown.medium.L1', revision: PRODUCT_GEOMETRY_REVISION_V7 }, 'L1', PRODUCT_GEOMETRY_ASSET_SET_SHA256_V7);
  assert.equal(unknown.ok, false);
  assert.equal(unknown.reason, 'unknown_asset');

  assert.equal(resolveSignedProductGeometryRefV7('square', 'medium', 'L1'), null);
  const generated = resolveExactFrenchGeometryInputV1({
    assetId: 'geometry.square.medium.L1',
    revision: PRODUCT_GEOMETRY_REVISION_V7,
  }, 'L1', PRODUCT_GEOMETRY_ASSET_SET_SHA256_V7);
  assert.equal(generated.ok, false);
  assert.equal(generated.reason, 'generated');
}
console.log('[french-compiler] wrong finger/revision/SHA/unknown/generated fail closed: PASS');

{
  const relative = canonicalizeSilhouetteToNailLocalV1('0 0 100 100', 'M 10 10 l 80 0 L 90 90 L 10 90 Z');
  assert.equal(relative.ok, false);
  assert.equal(relative.reason, 'relative_path');
  const arc = canonicalizeSilhouetteToNailLocalV1('0 0 100 100', 'M 10 10 A 40 40 0 0 1 90 10 L 90 90 L 10 90 Z');
  assert.equal(arc.ok, false);
  assert.equal(arc.reason, 'unsupported_command');
  const openPath = canonicalizeSilhouetteToNailLocalV1('0 0 100 100', 'M 10 10 L 90 10 L 90 90');
  assert.equal(openPath.ok, false);
  assert.equal(openPath.reason, 'open_path');
  const malformed = canonicalizeSilhouetteToNailLocalV1('0 0 100 100', 'M 10');
  assert.equal(malformed.ok, false);
  assert.equal(malformed.reason, 'malformed_path');
  const inferred = resolveExactFrenchGeometryInputV1({
    assetId: 'geometry.almond.medium.L1',
    revision: PRODUCT_GEOMETRY_REVISION_V7,
  }, 'L1', PRODUCT_GEOMETRY_ASSET_SET_SHA256_V7);
  assert.equal(inferred.ok, true);
  assert.equal(inferred.geometry.shape, 'almond');
  assert.equal(inferred.geometry.length, 'medium');
  assert.equal(inferred.geometry.finger, 'L1');
}
console.log('[french-compiler] malformed/relative path and registry shape/length: PASS');

{
  const { geometry, parameters } = compileCase('almond', 'medium', 'classic', 'L1');
  const flipHex = (digest) => `${digest.slice(0, -1)}${digest.at(-1) === 'a' ? 'b' : 'a'}`;

  assertRejected(compileFrenchPathV1(forgeGeometry(geometry, { finger: 'LX' }), parameters), 'finger', 'geometry_not_exact');
  assertRejected(compileFrenchPathV1(forgeGeometry(geometry, { finger: 'l1' }), parameters), 'finger', 'geometry_not_exact');
  assertRejected(compileFrenchPathV1(forgeGeometry(geometry, { shape: 'square' }), parameters), 'shape', 'geometry_not_exact');
  assertRejected(compileFrenchPathV1(forgeGeometry(geometry, { length: 'extra_long' }), parameters), 'length', 'geometry_not_exact');
  assertRejected(
    compileFrenchPathV1(forgeGeometry(geometry, { registryAssetSetSha256: flipHex(PRODUCT_GEOMETRY_ASSET_SET_SHA256_V7) }), parameters),
    'registryAssetSetSha256',
    'geometry_not_exact',
  );
  assertRejected(
    compileFrenchPathV1(forgeGeometry(geometry, { contourIdentity: flipHex(geometry.contourIdentity) }), parameters),
    'contourIdentity',
    'geometry_not_exact',
  );
  assertRejected(
    compileFrenchPathV1(forgeGeometry(geometry, { viewBox: { x: 0, y: 0, width: 0, height: 1 } }), parameters),
    'viewBox',
    'geometry_not_exact',
  );
  assertRejected(
    compileFrenchPathV1(forgeGeometry(geometry, { viewBox: { x: Number.NaN, y: 0, width: 1, height: 1 } }), parameters),
    'viewBox',
    'geometry_not_exact',
  );
  assertRejected(compileFrenchPathV1(forgeGeometry(geometry, { canvasCenterU: 1.5 }), parameters), 'canvasCenterU', 'geometry_not_exact');
  assertRejected(compileFrenchPathV1(forgeGeometry(geometry, { canvasCenterU: Number.POSITIVE_INFINITY }), parameters), 'canvasCenterU', 'geometry_not_exact');

  const twoMoves = 'M0.1 0.1 L0.9 0.1 M0.2 0.2 L0.8 0.2 L0.8 0.8 L0.2 0.8 Z';
  assert.equal(isCanonicalSingleClosedNailPathV1(twoMoves), false);
  assertRejected(
    compileFrenchPathV1(forgeGeometry(geometry, { contourPathData: twoMoves, contourIdentity: sha256Hex(twoMoves) }), parameters),
    'contourPathData',
    'contour_invalid',
  );

  const noncanonical = `${geometry.contourPathData} `;
  assert.notEqual(noncanonical, geometry.contourPathData);
  assertRejected(
    compileFrenchPathV1(forgeGeometry(geometry, { contourPathData: noncanonical, contourIdentity: sha256Hex(noncanonical) }), parameters),
    'contourPathData',
    'contour_invalid',
  );

  assertRejected(
    compileFrenchPathV1(forgeGeometry(geometry, { assetId: `${geometry.assetId}|finger=R1` }), parameters),
    'assetId',
    'identity_unsafe',
  );
  assertRejected(
    compileFrenchPathV1(forgeGeometry(geometry, { assetId: `${geometry.assetId}@injected` }), parameters),
    'assetId',
    'identity_unsafe',
  );
  assertRejected(
    compileFrenchPathV1(forgeGeometry(geometry, { revision: 'latest' }), parameters),
    'revision',
    'identity_unsafe',
  );
  assertRejected(
    compileFrenchPathV1(forgeGeometry(geometry, { revision: `${geometry.revision}|latest` }), parameters),
    'revision',
    'identity_unsafe',
  );
  assertRejected(
    compileFrenchPathV1(forgeGeometry(geometry, { revision: `${geometry.revision}-latest-build` }), parameters),
    'revision',
    'identity_unsafe',
  );
  assertRejected(
    compileFrenchPathV1(forgeGeometry(geometry, { assetId: `${geometry.assetId}\nR1` }), parameters),
    'assetId',
    'identity_unsafe',
  );

  const trust = validateFrenchExactGeometryTrustBoundaryV1(forgeGeometry(geometry, { fidelity: 'exact', evidence: 'signed_off', manufacturingValidated: false, finger: 'nope' }));
  assert.ok(trust.some((item) => item.path === 'finger'));

  const l1 = compileCase('almond', 'medium', 'classic', 'L1');
  const r1 = compileCase('almond', 'medium', 'classic', 'R1');
  assert.notEqual(l1.compiled.cacheIdentity.cacheKey, r1.compiled.cacheIdentity.cacheKey);
  assert.notEqual(l1.compiled.cacheIdentity.bindingKey, r1.compiled.cacheIdentity.bindingKey);
}
console.log('[french-compiler] forged exact objects and identity injection fail closed: PASS');
