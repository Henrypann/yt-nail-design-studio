#!/usr/bin/env node
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { FINGER_CODES } from '../src/lib/types.ts';
import {
  isClosedNailPathDataV7,
  isDrawableNailPathDataV7,
  parseNailPathDataV7,
} from '../src/studio/editor/v7/flat-vector.ts';
import {
  compileFrenchPathV1,
  enumerateFrenchGoldenBindingsV1,
  enumerateFrenchGoldenCasesV1,
  FRENCH_PATH_COMPILER_REVISION_V1,
} from '../src/studio/editor/v7/french-compiler-v1.ts';
import {
  canonicalizeSilhouetteToNailLocalV1,
  FRENCH_GOLDEN_FINGER_V1,
  FRENCH_SIGNED_LENGTHS_V1,
  FRENCH_SIGNED_SHAPES_V1,
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

function sampleContourPoints(pathData) {
  const parsed = parseNailPathDataV7(pathData);
  assert.ok(parsed);
  const points = [];
  let current = null;
  const sample = 24;
  const push = (point) => {
    const last = points[points.length - 1];
    if (!last || last.u !== point.u || last.v !== point.v) points.push(point);
  };
  const cubic = (p0, p1, p2, p3, t) => {
    const mt = 1 - t;
    return {
      u: mt * mt * mt * p0.u + 3 * mt * mt * t * p1.u + 3 * mt * t * t * p2.u + t * t * t * p3.u,
      v: mt * mt * mt * p0.v + 3 * mt * mt * t * p1.v + 3 * mt * t * t * p2.v + t * t * t * p3.v,
    };
  };
  const quadratic = (p0, p1, p2, t) => {
    const mt = 1 - t;
    return {
      u: mt * mt * p0.u + 2 * mt * t * p1.u + t * t * p2.u,
      v: mt * mt * p0.v + 2 * mt * t * p1.v + t * t * p2.v,
    };
  };
  for (const { command, values } of parsed.commands) {
    if (command === 'M') {
      current = { u: values[0], v: values[1] };
      push(current);
    } else if (command === 'L') {
      current = { u: values[0], v: values[1] };
      push(current);
    } else if (command === 'Q') {
      const control = { u: values[0], v: values[1] };
      const next = { u: values[2], v: values[3] };
      for (let step = 1; step <= sample; step += 1) push(quadratic(current, control, next, step / sample));
      current = next;
    } else if (command === 'C') {
      const c1 = { u: values[0], v: values[1] };
      const c2 = { u: values[2], v: values[3] };
      const next = { u: values[4], v: values[5] };
      for (let step = 1; step <= sample; step += 1) push(cubic(current, c1, c2, next, step / sample));
      current = next;
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
}
console.log('[french-compiler] identity constants: PASS');

{
  const hv = canonicalizeSilhouetteToNailLocalV1('0 0 100 100', 'M 10 10 H 90 V 90 H 10 Z');
  assert.equal(hv.ok, true, hv.ok ? '' : JSON.stringify(hv.diagnostics));
  assert.equal(hv.pathData.includes('H'), false);
  assert.equal(hv.pathData.includes('V'), false);
  assert.equal(isClosedNailPathDataV7(hv.pathData), true);
  assert.equal(isDrawableNailPathDataV7(hv.pathData, 'area'), true);
  assert.equal(hv.contourIdentity.length, 64);
  assert.equal(hv.canvasCenterU, 0);
}
console.log('[french-compiler] H/V convert to absolute L: PASS');

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
  const { geometry, compiled } = compileCase(item.shape, item.length, item.preset, item.finger);
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
  assert.equal(compiled.cacheIdentity.cacheKey.includes('latest'), false);
  assert.equal(compiled.cacheIdentity.cacheKey.includes(PRODUCT_GEOMETRY_ASSET_SET_SHA256_V7), true);
  assert.equal(compiled.cacheIdentity.cacheKey.includes(PRODUCT_GEOMETRY_ASSET_SET_SHA256_V7.slice(0, 7)) && compiled.cacheIdentity.cacheKey.includes(PRODUCT_GEOMETRY_ASSET_SET_SHA256_V7), true);
  assert.equal(compiled.cacheIdentity.cacheKey.includes(`${geometry.assetId}@${geometry.revision}`), true);
  assert.equal(compiled.cacheIdentity.finger, item.finger);
  assert.equal(geometry.shape, item.shape);
  assert.equal(geometry.length, item.length);
  assert.equal(geometry.assetId.includes(item.shape), true);
  assert.notEqual(geometry.shape, geometry.assetId, 'shape must come from registry, not raw assetId');

  const again = compileFrenchPathV1(geometry, createDefaultFrenchRecipeParametersV1(item.preset));
  assert.equal(again.ok, true);
  assert.equal(again.fillPathData, compiled.fillPathData);
  assert.equal(again.boundaryPathData, compiled.boundaryPathData);
  assert.equal(again.cacheIdentity.cacheKey, compiled.cacheIdentity.cacheKey);
  assert.equal(JSON.stringify(again.projection), JSON.stringify(compiled.projection));

  const contourPoints = sampleContourPoints(geometry.contourPathData);
  assert.ok(minDist(contourPoints, compiled.anchors.left) < 0.01, `${item.id} left wing must sit on contour`);
  assert.ok(minDist(contourPoints, compiled.anchors.right) < 0.01, `${item.id} right wing must sit on contour`);
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
