import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createFullEditorDocV7Fixture } from '../src/studio/editor/fixtures/editor-doc-v7.mjs';
import { createCustomerPreviewScenarioV7, deriveCustomerNailPreviewV7 } from '../src/studio/editor/v7/customer-preview.ts';
import {
  AURORA_ALMOND_MATERIAL_ASSET_SET_V1,
  createSingleNailMaterialProjectionV1,
  createSingleNailPreviewSurfaceV1,
} from '../src/studio/rendering/v0-7-2/index.ts';

const source = createFullEditorDocV7Fixture();
const frozenBefore = JSON.stringify(source);
assert.equal(AURORA_ALMOND_MATERIAL_ASSET_SET_V1.schemaVersion, 'material-projection-asset-set-v1');
assert.equal(AURORA_ALMOND_MATERIAL_ASSET_SET_V1.evidence, 'simulated');
assert.equal(AURORA_ALMOND_MATERIAL_ASSET_SET_V1.flatElements.length, 3);
assert.notStrictEqual(
  AURORA_ALMOND_MATERIAL_ASSET_SET_V1.flatElements[0].transform,
  AURORA_ALMOND_MATERIAL_ASSET_SET_V1.flatElements[1].transform,
  'mock elements must not share mutable transform objects',
);
assert.ok(AURORA_ALMOND_MATERIAL_ASSET_SET_V1.limitations.some((item) => item.includes('manufacturing')));

const translucentNail = source.nails.L2;
const translucentModel = deriveCustomerNailPreviewV7(translucentNail, createCustomerPreviewScenarioV7());
const translucentProjection = createSingleNailMaterialProjectionV1(translucentNail, translucentModel);
assert.equal(translucentProjection.backgroundMode, 'translucent');
assert.equal(translucentProjection.hasTransparency, true);
assert.match(translucentProjection.svg, /rgba\(244,147,177,0\.5904\)/);

const nail = structuredClone(source.nails.L1);
const background = nail.steps[0];
assert.equal(background.kind, 'background');
background.background = {
  mode: 'gradient',
  opacity: 1,
  directionDeg: 35,
  stops: [
    { offset: 0, color: { colorSpace: 'srgb', r: 240, g: 78, b: 126, a: 1 } },
    { offset: 1, color: { colorSpace: 'srgb', r: 88, g: 38, b: 112, a: 1 } },
  ],
};
const flat = nail.steps.find((step) => step.kind === 'flat_design');
assert.ok(flat && flat.kind === 'flat_design');
flat.mask = { coordinateSpace: 'nail-local-v1', pathData: 'M0.08 0.04 L0.92 0.04 L0.92 0.96 L0.08 0.96 Z', fillRule: 'nonzero', inverted: false };
flat.elements = flat.elements.filter((element) => element.kind !== 'text' && element.kind !== 'image_2d');
const region = flat.elements.find((element) => element.kind === 'region_mask');
if (region?.kind === 'region_mask') region.mask.pathData = 'M0.12 0.1 L0.88 0.1 L0.88 0.9 L0.12 0.9 Z';
nail.steps.filter((step) => step.kind === 'surface_effect').forEach((step) => {
  if (step.kind === 'surface_effect') step.mask.pathData = 'M0.12 0.12 L0.88 0.12 L0.82 0.88 L0.18 0.88 Z';
});
const model = deriveCustomerNailPreviewV7(nail, createCustomerPreviewScenarioV7());
const first = createSingleNailMaterialProjectionV1(nail, model);
const second = createSingleNailMaterialProjectionV1(nail, model);
assert.deepEqual(first, second, 'same canonical input must produce the same projection');
assert.deepEqual(first.projectedLayerKinds, ['background', 'flat_design', 'surface_effect']);
assert.deepEqual(first.omittedElementKinds, []);
assert.match(first.svg, /id="background-gradient"/);
assert.match(first.svg, /<polyline/);
assert.match(first.svg, /flat-0-step-mask|flat-\d+-step-mask/);
assert.match(first.svg, /effect-\d+-mask/);
assert.equal(first.projectionHash.length, 16);

const changed = structuredClone(nail);
const changedBackground = changed.steps[0];
assert.equal(changedBackground.kind, 'background');
if (changedBackground.background.mode === 'gradient') changedBackground.background.stops[0].color.r = 12;
const changedProjection = createSingleNailMaterialProjectionV1(
  changed,
  deriveCustomerNailPreviewV7(changed, createCustomerPreviewScenarioV7()),
);
assert.notEqual(changedProjection.projectionHash, first.projectionHash, 'canonical color change must change material identity');

const unsupportedModel = deriveCustomerNailPreviewV7(source.nails.L1, createCustomerPreviewScenarioV7());
const unsupported = createSingleNailMaterialProjectionV1(source.nails.L1, unsupportedModel);
assert.deepEqual(unsupported.omittedElementKinds.sort(), ['image_2d', 'text']);
assert.equal(unsupported.fidelity, 'unavailable');
assert.ok(unsupported.warnings.some((warning) => warning.includes('文字')));
assert.ok(unsupported.warnings.some((warning) => warning.includes('2D 素材')));
assert.equal(JSON.stringify(source), frozenBefore, 'projection must be writer-zero and preserve the source document');

const surface = createSingleNailPreviewSurfaceV1();
const vertexCount = surface.positions.length / 3;
assert.equal(surface.uvs.length, vertexCount * 2);
assert.ok(surface.uvs.every((value) => Number.isFinite(value) && value >= 0 && value <= 1));
const transverseStride = 25;
const outerVertexCount = 37 * transverseStride;
assert.deepEqual(surface.uvs.slice(0, 2), [0, 1], 'root-left must map to canonical u=0,v=1');
assert.ok(surface.uvs[(outerVertexCount - transverseStride) * 2 + 1] > 0,
  'tip arc shoulder must remain above the canonical tip center');
assert.equal(surface.uvs[(outerVertexCount - transverseStride + 12) * 2 + 1], 0,
  'tip center must map to canonical v=0');
assert.deepEqual(surface.uvs.slice(outerVertexCount * 2, outerVertexCount * 2 + 2), [0, 1], 'inner surface must share the same canonical UV');
const tipRowStart = outerVertexCount - transverseStride;
const tipLeft = surface.positions.slice(tipRowStart * 3, tipRowStart * 3 + 3);
const tipCenter = surface.positions.slice((tipRowStart + 12) * 3, (tipRowStart + 12) * 3 + 3);
const tipRight = surface.positions.slice((tipRowStart + 24) * 3, (tipRowStart + 24) * 3 + 3);
const tipQuarter = surface.positions.slice((tipRowStart + 18) * 3, (tipRowStart + 18) * 3 + 3);
assert.equal(roundForTest(tipRight[0] - tipLeft[0]), 2.34394, 'rounded tip arc must span multiple boundary vertices');
assert.equal(roundForTest(tipCenter[1]), -18, 'cap center remains the nominal free-edge extent');
assert.equal(roundForTest(tipLeft[1]), -17.45242, 'tip arc must continue the accepted cubic sidewall');
assert.equal(roundForTest(tipRight[1]), -17.45242);
assert.ok(surface.metrics.tipRadiusMm >= 1.1, 'almond tip must keep the accepted rounded-point radius');
assert.ok(surface.metrics.tipCapDepthMm >= 0.45, 'cap must carry enough curvature to avoid a needle apex');
assert.ok(surface.metrics.tipCrownRiseMm <= 0.8, 'terminal C-curve must relax instead of projecting a central spike');
assert.ok(tipQuarter[1] - tipCenter[1] > 0.13, 'cubic tip arc must curve across multiple terminal vertices');
assert.equal(surface.metrics.tipCapExponent, 2);
assert.ok(surface.metrics.tipTaperStartRatio >= 0.2 && surface.metrics.tipTaperStartRatio <= 0.23,
  'maximum width must align with the accepted medium Almond silhouette');

const runtime = await readFile(new URL('../src/studio/rendering/v0-7-2/SingleNailPbrPreviewV072.tsx', import.meta.url), 'utf8');
assert.match(runtime, /new THREE\.CanvasTexture/);
assert.match(runtime, /texture\.colorSpace = THREE\.SRGBColorSpace/);
assert.match(runtime, /texture\.flipY = false/);
assert.match(runtime, /geometry\.setAttribute\('uv'/);
assert.match(runtime, /map: texture/);
assert.match(runtime, /data-material-projection/);
assert.doesNotMatch(runtime, /localStorage|sessionStorage|editorV7Store|saveEditor|repository/);

console.log('test-render-v0-7-2-material-projection: PASS (canonical UV, sRGB CanvasTexture, deterministic background/flat/effect projection, alpha, writer-zero)');

function roundForTest(value) {
  return Math.round(value * 100_000) / 100_000;
}
