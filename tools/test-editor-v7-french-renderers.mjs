#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createBlankEditorDocV7 } from '../src/studio/editor/v7/create.ts';
import { adaptFrenchFlatStepV1, adaptFrenchFlatStepFromDocV1 } from '../src/studio/editor/v7/french-render-adapter-v1.ts';
import { compileFrenchPathV1, enumerateFrenchGoldenCasesV1 } from '../src/studio/editor/v7/french-compiler-v1.ts';
import { resolveExactFrenchGeometryInputV1 } from '../src/studio/editor/v7/french-geometry-input-v1.ts';
import { createDefaultFrenchRecipeParametersV1, FRENCH_RECIPE_ID_V1, FRENCH_RECIPE_REVISION_V1 } from '../src/studio/editor/v7/french-recipe-v1.ts';
import { PRODUCT_GEOMETRY_ASSET_SET_SHA256_V7 } from '../src/studio/editor/v7/geometry-registry.ts';
import { IDENTITY_TRANSFORM_V7 } from '../src/studio/editor/v7/flat-vector.ts';
import { parseEditorDocV7 } from '../src/studio/editor/v7/schema.ts';
import { createCustomerPreviewScenarioV7, deriveCustomerNailPreviewV7 } from '../src/studio/editor/v7/customer-preview.ts';
import { createSingleNailMaterialProjectionV1 } from '../src/studio/rendering/v0-7-2/material-projection.ts';
import { GOLDEN_PREVIEW_APPEARANCE_PROFILE_V1 } from '../src/studio/rendering/v0-7-2/fixtures.ts';

const CONSUMERS = ['editor-flat', 'finish-composite', 'customer-preview', 'pbr-material'];

const makeStep = (doc, finger, preset, id = `step.french.${finger}.${preset}`) => {
  const geometry = resolveExactFrenchGeometryInputV1(doc.nails[finger].geometryRef, finger, PRODUCT_GEOMETRY_ASSET_SET_SHA256_V7);
  assert.equal(geometry.ok, true);
  const compiled = compileFrenchPathV1(geometry.geometry, createDefaultFrenchRecipeParametersV1(preset));
  assert.equal(compiled.ok, true);
  const recipeId = `recipe.french.${finger}.${preset}`;
  doc.recipeInstances[recipeId] = { instanceId: recipeId, recipeId: FRENCH_RECIPE_ID_V1, recipeRevision: FRENCH_RECIPE_REVISION_V1, parameterValues: createDefaultFrenchRecipeParametersV1(preset) };
  const elements = [compiled.projection.fill, ...(compiled.projection.outline ? [compiled.projection.outline] : [])].map((item, index) => ({ ...item, id: `element.french.${finger}.${preset}.${index}` }));
  return { id, typeId: 'builtin.v7.flat_design', kind: 'flat_design', name: 'French', visible: true, locked: true, skipped: false, recipeInstanceId: recipeId, materialRefs: [], elements };
};

let matrixCount = 0;
for (const item of enumerateFrenchGoldenCasesV1()) {
  const source = createBlankEditorDocV7({ designId: `render.${item.id}`, shape: item.shape, length: item.length, now: '2026-08-24T00:00:00.000Z' });
  assert.equal(source.ok, true);
  const step = makeStep(source.doc, item.finger, item.preset);
  source.doc.nails[item.finger].steps.splice(1, 0, step);
  const before = JSON.stringify(source.doc);
  for (const consumer of CONSUMERS) {
    const result = adaptFrenchFlatStepFromDocV1(source.doc, item.finger, step, consumer);
    assert.equal(result.status, 'structured', `${consumer}/${item.id}`);
    assert.equal(result.consumer, consumer);
    assert.equal(result.step.elements[0].id, step.elements[0].id);
    assert.ok(result.cacheIdentity && result.bindingKey);
    matrixCount += 1;
  }
  assert.equal(JSON.stringify(source.doc), before, `${item.id} adapters are writer-zero`);
}
assert.equal(enumerateFrenchGoldenCasesV1().length, 60);
assert.equal(matrixCount, 240);
console.log('[french-renderers] 60 canonical × 4 named consumers = 240 structured adapter cases: PASS');

const wiring = [
  ['src/studio/editor/components/V7FlatDesignCanvas.tsx', 'editor-flat'],
  ['src/studio/editor/components/V7FinishCompositeCanvas.tsx', 'finish-composite'],
  ['src/studio/editor/components/CustomerNailPreviewV7.tsx', 'customer-preview'],
  ['src/studio/rendering/v0-7-2/material-projection.ts', 'pbr-material'],
];
for (const [path, consumer] of wiring) {
  const source = await readFile(new URL(`../${path}`, import.meta.url), 'utf8');
  assert.match(source, new RegExp(`adaptFrenchFlatStepV1\\(\\{ consumer: '${consumer}'`), `${path} must bind its named adapter consumer`);
}
console.log('[french-renderers] four production consumer wiring points: PASS');

const ten = createBlankEditorDocV7({ designId: 'render.ten', shape: 'almond', length: 'medium', now: '2026-08-24T00:00:00.000Z' });
assert.equal(ten.ok, true);
const tenDoc = structuredClone(ten.doc);
for (const finger of Object.keys(tenDoc.nails)) {
  const step = makeStep(tenDoc, finger, 'classic');
  tenDoc.nails[finger].steps.splice(1, 0, step);
  const result = adaptFrenchFlatStepFromDocV1(tenDoc, finger, step, 'customer-preview');
  assert.equal(result.status, 'structured', finger);
}
assert.equal(new Set(Object.values(tenDoc.recipeInstances).map((item) => item.instanceId)).size, 10);
assert.equal(parseEditorDocV7(tenDoc).ok, true);
console.log('[french-renderers] ten-finger identity/projection and EditorDoc parity: PASS');

const l1Step = tenDoc.nails.L1.steps.find((step) => step.recipeInstanceId);
const ordinaryStep = { id: 'step.ordinary', typeId: 'builtin.v7.flat_design', kind: 'flat_design', name: 'ordinary', visible: true, locked: false, skipped: false, materialRefs: [], elements: [] };
assert.equal(adaptFrenchFlatStepV1({ consumer: 'editor-flat', finger: 'L1', nail: tenDoc.nails.L1, step: ordinaryStep, recipeInstances: tenDoc.recipeInstances, allNails: tenDoc.nails }).status, 'passthrough');
const legacyStep = { ...ordinaryStep, id: 'step.legacy', elements: [{ id: 'element.legacy', kind: 'french_edge', visible: true, locked: false, opacity: 1, transform: structuredClone(IDENTITY_TRANSFORM_V7), widthRatio: 0.2, curvature: 0.3, color: { colorSpace: 'srgb', r: 255, g: 255, b: 255, a: 1 } }] };
assert.equal(adaptFrenchFlatStepV1({ consumer: 'editor-flat', finger: 'L1', nail: tenDoc.nails.L1, step: legacyStep, recipeInstances: tenDoc.recipeInstances, allNails: tenDoc.nails }).status, 'passthrough');

const malformed = structuredClone(tenDoc);
malformed.recipeInstances[l1Step.recipeInstanceId].recipeRevision = '9.9.9';
assert.equal(adaptFrenchFlatStepFromDocV1(malformed, 'L1', malformed.nails.L1.steps.find((step) => step.id === l1Step.id), 'editor-flat').status, 'unavailable');
const drifted = structuredClone(tenDoc);
drifted.nails.L1.steps.find((step) => step.id === l1Step.id).elements[0].pathData += ' ';
assert.equal(adaptFrenchFlatStepFromDocV1(drifted, 'L1', drifted.nails.L1.steps.find((step) => step.id === l1Step.id), 'editor-flat').status, 'unavailable');
const missing = structuredClone(tenDoc);
delete missing.recipeInstances[l1Step.recipeInstanceId];
assert.equal(adaptFrenchFlatStepFromDocV1(missing, 'L1', missing.nails.L1.steps.find((step) => step.id === l1Step.id), 'editor-flat').status, 'unavailable');
const mismatchedKey = structuredClone(tenDoc);
mismatchedKey.recipeInstances[l1Step.recipeInstanceId].instanceId = 'recipe.forged';
assert.equal(adaptFrenchFlatStepFromDocV1(mismatchedKey, 'L1', mismatchedKey.nails.L1.steps.find((step) => step.id === l1Step.id), 'editor-flat').status, 'unavailable');
const shared = structuredClone(tenDoc);
shared.nails.R1.steps.splice(1, 0, { ...structuredClone(shared.nails.L1.steps.find((step) => step.id === l1Step.id)), id: 'step.shared.R1' });
assert.equal(adaptFrenchFlatStepFromDocV1(shared, 'L1', shared.nails.L1.steps.find((step) => step.id === l1Step.id), 'editor-flat').status, 'unavailable');
assert.equal(adaptFrenchFlatStepV1({ consumer: 'editor-flat', finger: 'L1', nail: tenDoc.nails.L1, step: l1Step, recipeInstances: tenDoc.recipeInstances }).status, 'unavailable', 'structured render requires complete reference context');
const wrongRevision = structuredClone(tenDoc);
wrongRevision.nails.L1.geometryRef.revision = `${wrongRevision.nails.L1.geometryRef.revision}.drift`;
assert.equal(adaptFrenchFlatStepFromDocV1(wrongRevision, 'L1', wrongRevision.nails.L1.steps.find((step) => step.id === l1Step.id), 'editor-flat').status, 'unavailable');
console.log('[french-renderers] missing/malformed/key mismatch/shared/drift/geometry fail closed; ordinary+legacy passthrough: PASS');

const beforePreview = JSON.stringify(tenDoc);
const readModel = deriveCustomerNailPreviewV7(tenDoc.nails.L1, createCustomerPreviewScenarioV7());
const projections = GOLDEN_PREVIEW_APPEARANCE_PROFILE_V1.cameraPresets.map(() => createSingleNailMaterialProjectionV1(tenDoc.nails.L1, readModel, tenDoc.recipeInstances, tenDoc.nails));
assert.equal(projections.length, 5);
assert.ok(projections.every((projection) => projection.fidelity !== 'unavailable' && projection.projectedLayerKinds.includes('flat_design')));
assert.ok(projections.every((projection) => projection.projectionHash === projections[0].projectionHash));
assert.equal(JSON.stringify(tenDoc), beforePreview, 'five camera projection reads are writer-zero');
console.log('[french-renderers] five PBR camera projection reads are stable, simulated, and writer-zero: PASS');
