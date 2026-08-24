#!/usr/bin/env node
import assert from 'node:assert/strict';
import { createBlankEditorDocV7 } from '../src/studio/editor/v7/create.ts';
import { createEditorV7Store } from '../src/studio/editor/store-v7.ts';
import { convertLegacyFrenchEdgeToRecipeV1, inspectFrenchRecipeProjectionV1 } from '../src/studio/editor/v7/french-conversion-v1.ts';
import { createDefaultFrenchRecipeParametersV1, parseFrenchRecipeParametersV1, parseFrenchRecipeInstanceV1 } from '../src/studio/editor/v7/french-recipe-v1.ts';
import { resolveExactFrenchGeometryInputV1 } from '../src/studio/editor/v7/french-geometry-input-v1.ts';
import { PRODUCT_GEOMETRY_ASSET_SET_SHA256_V7 } from '../src/studio/editor/v7/geometry-registry.ts';
import { parseEditorDocV7 } from '../src/studio/editor/v7/schema.ts';
import { materializeIndependentEditorDocV7 } from '../src/studio/editor/v7/materialize.ts';
import { materializeVersionedRemixV2 } from '../src/studio/versioning/versioned-import.ts';
import { materializeEditorV7NailScope } from '../src/studio/editor/v7/ten-finger-operations.ts';
import { createHash } from 'node:crypto';
import { releaseSavedEditorDocV7 } from '../src/studio/versioning/design-release.ts';

const clone = (value) => structuredClone(value);
const params = createDefaultFrenchRecipeParametersV1('classic');
const blank = createBlankEditorDocV7({ designId: 'conversion-test', shape: 'almond', length: 'medium', now: '2026-08-24T00:00:00.000Z' });
assert.equal(blank.ok, true);
const sourceDoc = blank.doc;
const flat = {
  id: 'step.legacy-flat', typeId: 'builtin.v7.flat_design', kind: 'flat_design', name: 'Legacy flat', visible: true, locked: false, skipped: false,
  materialRefs: [], elements: [],
};
sourceDoc.nails.L1.steps.splice(1, 0, flat);
flat.elements.push({
  id: 'element.legacy-french', kind: 'french_edge', visible: true, locked: false, opacity: 1,
  transform: { position: { u: 0.5, v: 0.5 }, scaleX: 1, scaleY: 1, rotationDeg: 0 },
  widthRatio: 0.3, curvature: 0, color: { colorSpace: 'srgb', r: 255, g: 253, b: 249, a: 1 },
});
const parsedSource = parseEditorDocV7(sourceDoc);
assert.equal(parsedSource.ok, true);
const geometry = resolveExactFrenchGeometryInputV1(sourceDoc.nails.L1.geometryRef, 'L1', PRODUCT_GEOMETRY_ASSET_SET_SHA256_V7);
assert.equal(geometry.ok, true);

const before = clone(parsedSource.doc);
const result = convertLegacyFrenchEdgeToRecipeV1({
  doc: parsedSource.doc, finger: 'L1', sourceStepId: flat.id, sourceElementId: 'element.legacy-french', parameters: params,
  geometry: geometry.geometry, recipeInstanceId: 'recipe.converted.1', stepId: 'step.converted.1', fillElementId: 'element.converted.fill',
});
assert.equal(result.ok, true);
assert.deepEqual(parsedSource.doc, before, 'pure conversion does not mutate input');
assert.equal(result.doc.recipeInstances['recipe.converted.1'].recipeId, 'french-edge');
const sourceAfter = result.doc.nails.L1.steps.find((step) => step.id === flat.id);
assert.equal(sourceAfter.elements.find((item) => item.id === 'element.legacy-french').visible, false);
const managed = result.doc.nails.L1.steps.find((step) => step.id === 'step.converted.1');
assert.equal(managed.recipeInstanceId, 'recipe.converted.1');
assert.equal(managed.locked, true);
assert.equal(managed.elements.length, 1);
assert.equal(managed.elements[0].locked, true);
assert.equal(inspectFrenchRecipeProjectionV1(result.doc, 'L1', 'step.converted.1', geometry.geometry).ok, true);

const tampered = clone(result.doc);
tampered.nails.L1.steps.find((step) => step.id === 'step.converted.1').elements[0].pathData += ' ';
assert.equal(inspectFrenchRecipeProjectionV1(tampered, 'L1', 'step.converted.1', geometry.geometry).ok, false);

const inspectorTamperCases = [
  ['fill', (doc) => { doc.nails.L1.steps.find((step) => step.id === 'step.converted.1').elements[0].fill.r = 0; }],
  ['opacity', (doc) => { doc.nails.L1.steps.find((step) => step.id === 'step.converted.1').elements[0].opacity = 0.5; }],
  ['transform', (doc) => { doc.nails.L1.steps.find((step) => step.id === 'step.converted.1').elements[0].transform.rotationDeg = 1; }],
  ['element locked', (doc) => { doc.nails.L1.steps.find((step) => step.id === 'step.converted.1').elements[0].locked = false; }],
  ['element visible', (doc) => { doc.nails.L1.steps.find((step) => step.id === 'step.converted.1').elements[0].visible = false; }],
  ['extra element', (doc) => { doc.nails.L1.steps.find((step) => step.id === 'step.converted.1').elements.push(clone(doc.nails.L1.steps.find((step) => step.id === 'step.converted.1').elements[0])); doc.nails.L1.steps.find((step) => step.id === 'step.converted.1').elements.at(-1).id = 'element.extra'; }],
  ['step locked', (doc) => { doc.nails.L1.steps.find((step) => step.id === 'step.converted.1').locked = false; }],
  ['step visible', (doc) => { doc.nails.L1.steps.find((step) => step.id === 'step.converted.1').visible = false; }],
  ['step skipped', (doc) => { doc.nails.L1.steps.find((step) => step.id === 'step.converted.1').skipped = true; }],
  ['dangling recipe', (doc) => { doc.nails.L1.steps.find((step) => step.id === 'step.converted.1').recipeInstanceId = 'recipe.missing'; }],
  ['wrong recipe id', (doc) => { doc.recipeInstances['recipe.converted.1'].recipeId = 'wrong'; }],
  ['wrong recipe revision', (doc) => { doc.recipeInstances['recipe.converted.1'].recipeRevision = '0.0.0'; }],
  ['bad parameter', (doc) => { doc.recipeInstances['recipe.converted.1'].parameterValues.leftWingV = 9; }],
  ['foreign geometry', (doc) => { doc.nails.L1.geometryRef = { assetId: 'geometry.oval.medium.L1', revision: geometry.geometry.revision }; }],
  ['foreign supplied geometry', (doc) => { /* supplied geometry is checked separately below */ }],
];
for (const [label, mutate] of inspectorTamperCases) {
  const bad = clone(result.doc); mutate(bad);
  const supplied = label === 'foreign supplied geometry' ? { ...geometry.geometry, finger: 'R1' } : geometry.geometry;
  assert.equal(inspectFrenchRecipeProjectionV1(bad, 'L1', 'step.converted.1', supplied).ok, false, `${label} must fail closed`);
}
// Explicit outline projection and geometry/source fail-closed matrix.
const outlined = parseFrenchRecipeParametersV1({ ...params, outlineEnabled: true, outlineWidthMm: 0.1 });
assert.equal(outlined.ok, true);
const outlineResult = convertLegacyFrenchEdgeToRecipeV1({
  doc: parsedSource.doc, finger: 'L1', sourceStepId: flat.id, sourceElementId: 'element.legacy-french', parameters: outlined.parameters,
  geometry: geometry.geometry, recipeInstanceId: 'recipe.converted.outline', stepId: 'step.converted.outline', fillElementId: 'element.converted.outline.fill', outlineElementId: 'element.converted.outline.stroke',
});
assert.equal(outlineResult.ok, true);
assert.equal(outlineResult.doc.nails.L1.steps.find((step) => step.id === 'step.converted.outline').elements.length, 2);
const outlineTamper = clone(outlineResult.doc);
const outlineElement = outlineTamper.nails.L1.steps.find((step) => step.id === 'step.converted.outline').elements[1];
outlineElement.stroke.r = 0;
assert.equal(inspectFrenchRecipeProjectionV1(outlineTamper, 'L1', 'step.converted.outline', geometry.geometry).ok, false);
const outlineWidthTamper = clone(outlineResult.doc);
outlineWidthTamper.nails.L1.steps.find((step) => step.id === 'step.converted.outline').elements[1].strokeWidthMm = 0.2;
assert.equal(inspectFrenchRecipeProjectionV1(outlineWidthTamper, 'L1', 'step.converted.outline', geometry.geometry).ok, false);
const outlineOrderTamper = clone(outlineResult.doc);
outlineOrderTamper.nails.L1.steps.find((step) => step.id === 'step.converted.outline').elements.reverse();
assert.equal(inspectFrenchRecipeProjectionV1(outlineOrderTamper, 'L1', 'step.converted.outline', geometry.geometry).ok, false);
for (const badGeometry of [
  { ...geometry.geometry, finger: 'R1' },
  { ...geometry.geometry, assetId: 'geometry.oval.medium.L1' },
  { ...geometry.geometry, revision: 'wrong-revision' },
]) {
  const untouched = clone(parsedSource.doc);
  assert.equal(convertLegacyFrenchEdgeToRecipeV1({
    doc: parsedSource.doc, finger: 'L1', sourceStepId: flat.id, sourceElementId: 'element.legacy-french', parameters: params,
    geometry: badGeometry, recipeInstanceId: 'recipe.bad', stepId: 'step.bad', fillElementId: 'element.bad',
  }).ok, false);
  assert.deepEqual(parsedSource.doc, untouched);
}
for (const mutate of [
  (doc) => { doc.nails.L1.steps.find((step) => step.id === flat.id).visible = false; },
  (doc) => { doc.nails.L1.steps.find((step) => step.id === flat.id).locked = true; },
  (doc) => { doc.nails.L1.steps.find((step) => step.id === flat.id).skipped = true; },
  (doc) => { doc.nails.L1.steps.find((step) => step.id === flat.id).elements[0].visible = false; },
  (doc) => { doc.nails.L1.steps.find((step) => step.id === flat.id).elements[0].locked = true; },
]) {
  const badDoc = clone(parsedSource.doc); mutate(badDoc);
  assert.equal(convertLegacyFrenchEdgeToRecipeV1({ doc: badDoc, finger: 'L1', sourceStepId: flat.id, sourceElementId: 'element.legacy-french', parameters: params, geometry: geometry.geometry, recipeInstanceId: 'recipe.flags', stepId: 'step.flags', fillElementId: 'element.flags' }).ok, false);
}
assert.equal(convertLegacyFrenchEdgeToRecipeV1({ doc: parsedSource.doc, finger: 'L1', sourceStepId: flat.id, sourceElementId: 'element.legacy-french', parameters: { ...params, unknown: true }, geometry: geometry.geometry, recipeInstanceId: 'recipe.params', stepId: 'step.params', fillElementId: 'element.params' }).ok, false);
assert.equal(convertLegacyFrenchEdgeToRecipeV1({ doc: parsedSource.doc, finger: 'L1', sourceStepId: flat.id, sourceElementId: 'element.legacy-french', parameters: outlined.parameters, geometry: geometry.geometry, recipeInstanceId: 'recipe.ids', stepId: 'step.ids', fillElementId: 'element.ids' }).ok, false);
for (const invalidParameters of [null, undefined, [], 'invalid']) {
  const untouched = clone(parsedSource.doc);
  assert.doesNotThrow(() => convertLegacyFrenchEdgeToRecipeV1({ doc: parsedSource.doc, finger: 'L1', sourceStepId: flat.id, sourceElementId: 'element.legacy-french', parameters: invalidParameters, geometry: geometry.geometry, recipeInstanceId: 'recipe.runtime', stepId: 'step.runtime', fillElementId: 'element.runtime' }));
  assert.equal(convertLegacyFrenchEdgeToRecipeV1({ doc: parsedSource.doc, finger: 'L1', sourceStepId: flat.id, sourceElementId: 'element.legacy-french', parameters: invalidParameters, geometry: geometry.geometry, recipeInstanceId: 'recipe.runtime', stepId: 'step.runtime', fillElementId: 'element.runtime' }).ok, false);
  assert.deepEqual(parsedSource.doc, untouched);
}
assert.equal(convertLegacyFrenchEdgeToRecipeV1({ doc: parsedSource.doc, finger: 'L1', sourceStepId: 'missing', sourceElementId: 'element.legacy-french', parameters: params, geometry: geometry.geometry, recipeInstanceId: 'recipe.missing-step', stepId: 'step.missing-step', fillElementId: 'element.missing-step' }).ok, false);
const collisionDoc = clone(parsedSource.doc);
collisionDoc.recipeInstances['recipe.existing'] = { instanceId: 'recipe.existing', recipeId: 'french-edge', recipeRevision: '1.0.0', parameterValues: params };
collisionDoc.recipeInstances['recipe.node-collision'] = { instanceId: 'recipe.node-collision', recipeId: 'french-edge', recipeRevision: '1.0.0', parameterValues: params };
collisionDoc.nails.L1.steps.find((step) => step.id === flat.id).elements.push({ id: 'recipe.node-collision', kind: 'french_edge', visible: true, locked: false, opacity: 1, transform: { position: { u: 0.5, v: 0.5 }, scaleX: 1, scaleY: 1, rotationDeg: 0 }, widthRatio: 0.2, curvature: 0, color: { colorSpace: 'srgb', r: 255, g: 253, b: 249, a: 1 } });
assert.equal(convertLegacyFrenchEdgeToRecipeV1({ doc: collisionDoc, finger: 'L1', sourceStepId: flat.id, sourceElementId: 'recipe.node-collision', parameters: params, geometry: geometry.geometry, recipeInstanceId: 'recipe.existing', stepId: 'step.collision', fillElementId: 'element.collision' }).ok, false);

const hiddenManaged = clone(result.doc);
hiddenManaged.nails.L1.steps.find((step) => step.id === 'step.converted.1').visible = false;
assert.equal(inspectFrenchRecipeProjectionV1(hiddenManaged, 'L1', 'step.converted.1', geometry.geometry).ok, false);
const driftedDocGeometry = clone(result.doc);
driftedDocGeometry.nails.L1.geometryRef = { assetId: 'geometry.oval.medium.L1', revision: geometry.geometry.revision };
assert.equal(inspectFrenchRecipeProjectionV1(driftedDocGeometry, 'L1', 'step.converted.1', geometry.geometry).ok, false);

// Independent-copy and versioned-remix paths remap recipe IDs and preserve the managed projection.
const sourceBeforeMaterialize = clone(result.doc);
const generatedIds = (() => { let n = 0; return () => `node.copy.${++n}`; })();
const independent = materializeIndependentEditorDocV7(result.doc, { sourceRef: { domain: 'community', sourceId: 'look.copy', revision: 'v1' }, title: 'Copy', now: '2026-08-24T00:00:00.000Z' }, { nextId: (scope) => scope === 'design' ? 'design.copy.1' : generatedIds() });
assert.equal(independent.ok, true);
assert.deepEqual(result.doc, sourceBeforeMaterialize, 'materialization input remains byte-stable');
const copiedRecipeIds = Object.keys(independent.doc.recipeInstances);
assert.equal(copiedRecipeIds.length, 1);
const copiedManaged = independent.doc.nails.L1.steps.find((step) => step.kind === 'flat_design' && step.name === '法式（配方投影）');
assert.ok(copiedManaged);
assert.equal(copiedManaged.recipeInstanceId, copiedRecipeIds[0]);
assert.equal(copiedManaged.elements[0].kind, 'vector_shape');
assert.equal(copiedManaged.elements[0].pathData, result.doc.nails.L1.steps.find((step) => step.id === 'step.converted.1').elements[0].pathData);
assert.notEqual(copiedRecipeIds[0], 'recipe.converted.1');
assert.equal(parseEditorDocV7(independent.doc).ok, true);
assert.equal(parseFrenchRecipeInstanceV1(independent.doc.recipeInstances[copiedRecipeIds[0]]).ok, true);
assert.deepEqual(independent.doc.recipeInstances[copiedRecipeIds[0]].parameterValues, result.doc.recipeInstances['recipe.converted.1'].parameterValues);
assert.deepEqual(independent.doc.nails.L1.steps.find((step) => step.recipeInstanceId).elements.map((element) => element.pathData), result.doc.nails.L1.steps.find((step) => step.recipeInstanceId).elements.map((element) => element.pathData));
let remixNodeId = 0;
const remix = materializeVersionedRemixV2(result.doc, { v: 2, intentId: 'intent.copy', source: 'COMMUNITY', lookId: 'look.copy', designVersionId: 'version.copy', sourceCreatorProfileId: 'creator.copy', assetRevisionRefs: [], lineage: { sourceLookId: 'look.copy', sourceDesignVersionId: 'version.copy', sourceCreatorProfileId: 'creator.copy' }, createdAt: '2026-08-24T00:00:00.000Z', expiresAt: '2026-08-25T00:00:00.000Z', returnTo: '/community' }, { nextId: (scope) => scope === 'design' ? 'design.remix.1' : `node.remix.${++remixNodeId}` });
assert.equal(remix.ok, true);
assert.equal(Object.values(remix.doc.recipeInstances)[0].recipeId, 'french-edge');
assert.ok(remix.doc.nails.L1.steps.some((step) => step.recipeInstanceId && remix.doc.recipeInstances[step.recipeInstanceId]));
assert.equal(parseEditorDocV7(remix.doc).ok, true);
assert.notEqual(Object.keys(remix.doc.recipeInstances)[0], 'recipe.converted.1');
assert.deepEqual(Object.values(remix.doc.recipeInstances)[0].parameterValues, result.doc.recipeInstances['recipe.converted.1'].parameterValues);
assert.deepEqual(result.doc, sourceBeforeMaterialize, 'remix input remains byte-stable');
let scopeId = 0;
const scopeResult = materializeEditorV7NailScope(result.doc, { sourceFinger: 'L1', scope: { kind: 'selected', currentFinger: 'L1', selectedFingers: ['L2'] }, mode: 'copy-detached' }, (prefix) => `${prefix}.scope.${++scopeId}`);
assert.equal(scopeResult.ok, true);
for (const step of scopeResult.doc.nails.L2.steps) if (step.recipeInstanceId) assert.ok(scopeResult.doc.recipeInstances[step.recipeInstanceId], 'scope copy must not dangle recipe refs');
assert.deepEqual(result.doc, sourceBeforeMaterialize, 'scope input remains byte-stable');
let releaseRaw = null;
let releaseId = 0;
const releaseSource = clone(result.doc);
const released = await releaseSavedEditorDocV7({ designId: releaseSource.designId, expectedRevision: releaseSource.revision, runtimeGuard: { saveState: 'saved', savedRevision: releaseSource.revision, pendingRevision: null } }, {
  storage: { read: () => releaseRaw, write: (next) => { releaseRaw = next; } },
  readPersistedEditorDoc: () => clone(releaseSource),
  sha256: async (value) => createHash('sha256').update(value).digest('hex'),
  nextId: () => `release.version.${++releaseId}`,
  now: () => '2026-08-24T00:00:00.000Z',
  releasedByIdentityId: () => 'identity.release.test',
});
assert.equal(released.ok, true);
assert.deepEqual(releaseSource, result.doc, 'release does not mutate source');
assert.equal(released.record.editorDocSnapshot.recipeInstances['recipe.converted.1'].recipeRevision, '1.0.0');
assert.deepEqual(released.record.editorDocSnapshot.nails.L1.steps.find((step) => step.recipeInstanceId).elements, result.doc.nails.L1.steps.find((step) => step.recipeInstanceId).elements);
assert.deepEqual(released.record.manifest.recipeRevisionRefs, [{ recipeId: 'french-edge', revision: '1.0.0' }]);

// Store path is one synchronous document transaction and creates no write on failure.
let writes = 0;
let scheduled = 0;
let stored = clone(parsedSource.doc);
const repository = {
  load: () => ({ status: 'ok', doc: clone(stored), sourceVersion: stored.revision, sourceToken: JSON.stringify(stored), diagnostics: [] }),
  save: async (_id, doc) => { writes += 1; stored = clone(doc); return { ok: true, doc: clone(doc) }; },
};
let id = 0;
const store = createEditorV7Store({ repository, idFactory: (prefix) => `${prefix}.store.${++id}`, setTimeout: () => { scheduled += 1; return scheduled; }, clearTimeout: () => undefined });
assert.equal(await store.getState().load(parsedSource.doc.designId), 'ok');
const stateBefore = store.getState();
const action = stateBefore.confirmLegacyFrenchConversion('L1', flat.id, 'element.legacy-french', params);
assert.equal(action.ok, true);
assert.equal(store.getState().doc.revision, parsedSource.doc.revision + 1);
assert.equal(store.getState().history.length, 1);
assert.equal(scheduled, 1);
assert.equal(writes, 0, 'conversion only schedules autosave; explicit save owns persistence');
const convertedSnapshot = clone(store.getState().doc);
const convertedIds = {
  recipe: Object.keys(convertedSnapshot.recipeInstances),
  step: convertedSnapshot.nails.L1.steps.find((step) => step.recipeInstanceId)?.id,
  elements: convertedSnapshot.nails.L1.steps.find((step) => step.recipeInstanceId)?.elements.map((element) => element.id),
};
const genericEdit = store.getState().replaceFlatElement('L1', convertedIds.step, convertedIds.elements[0], clone(convertedSnapshot.nails.L1.steps.find((step) => step.recipeInstanceId).elements[0]));
assert.equal(genericEdit.ok, false);
assert.equal(genericEdit.reason, 'locked');
assert.deepEqual(store.getState().doc, convertedSnapshot);
const legacyState = clone(store.getState().history[0]);
assert.equal(store.getState().undo().ok, true);
assert.equal(store.getState().doc.revision, convertedSnapshot.revision + 1);
assert.equal(store.getState().doc.nails.L1.steps.find((step) => step.id === flat.id).elements.find((element) => element.id === 'element.legacy-french').visible, true);
assert.equal(Object.keys(store.getState().doc.recipeInstances).length, 0);
assert.equal(scheduled, 2);
assert.equal(store.getState().redo().ok, true);
assert.equal(scheduled, 3);
assert.equal(store.getState().doc.nails.L1.steps.find((step) => step.recipeInstanceId)?.id, convertedIds.step);
assert.deepEqual(store.getState().doc.nails.L1.steps.find((step) => step.recipeInstanceId)?.elements.map((element) => element.id), convertedIds.elements);
assert.equal(await store.getState().save(), 'saved');
assert.equal(writes, 1);
assert.equal(store.getState().reloadFromStorage(), 'ok');
assert.equal(store.getState().history.length, 0);
assert.equal(store.getState().future.length, 0);
assert.equal(inspectFrenchRecipeProjectionV1(store.getState().doc, 'L1', convertedIds.step, geometry.geometry).ok, true);
assert.deepEqual(store.getState().doc.nails.L1.steps.find((step) => step.id === flat.id).elements.find((element) => element.id === 'element.legacy-french'), convertedSnapshot.nails.L1.steps.find((step) => step.id === flat.id).elements.find((element) => element.id === 'element.legacy-french'));

function failureStore(doc = parsedSource.doc) {
  let failureWrites = 0;
  let failureScheduled = 0;
  const failureRepo = {
    load: () => ({ status: 'ok', doc: clone(doc), original: clone(doc), sourceVersion: doc.revision, sourceToken: JSON.stringify(doc), migrated: false, diagnostics: [] }),
    save: async () => { failureWrites += 1; return { ok: true, doc: clone(doc) }; },
  };
  let failureId = 0;
  const failureStore = createEditorV7Store({ repository: failureRepo, idFactory: (prefix) => `${prefix}.failure.${++failureId}`, setTimeout: () => { failureScheduled += 1; return failureScheduled; }, clearTimeout: () => undefined });
  return { failureStore, get writes() { return failureWrites; }, get scheduled() { return failureScheduled; } };
}
async function assertWriterZero(label, storeBundle, call) {
  assert.equal(await storeBundle.failureStore.getState().load(parsedSource.doc.designId), 'ok');
  const state = storeBundle.failureStore.getState();
  const before = { doc: clone(state.doc), history: clone(state.history), future: clone(state.future), revisionState: clone(state.revisionState), saveState: state.saveState };
  const result = await call(storeBundle.failureStore);
  assert.equal(result.ok, false, `${label} must fail`);
  const after = storeBundle.failureStore.getState();
  assert.deepEqual({ doc: after.doc, history: after.history, future: after.future, revisionState: after.revisionState, saveState: after.saveState }, before, `${label} must be writer-zero`);
  assert.equal(storeBundle.writes, 0, `${label} must not persist`);
  assert.equal(storeBundle.scheduled, 0, `${label} must not schedule autosave`);
}
await assertWriterZero('invalid source', failureStore(), (candidate) => candidate.getState().confirmLegacyFrenchConversion('L1', flat.id, 'missing', params));
const readonly = failureStore();
await assertWriterZero('read only', readonly, (candidate) => { candidate.setState({ readOnly: true }); return candidate.getState().confirmLegacyFrenchConversion('L1', flat.id, 'element.legacy-french', params); });
const busy = failureStore();
await assertWriterZero('busy', busy, (candidate) => { candidate.setState({ switching: true }); return candidate.getState().confirmLegacyFrenchConversion('L1', flat.id, 'element.legacy-french', params); });
const generatedDoc = clone(parsedSource.doc);
generatedDoc.nails.L1.geometryRef = { assetId: 'geometry.generated.unknown', revision: 'generated' };
await assertWriterZero('non-exact/generated geometry', failureStore(generatedDoc), (candidate) => candidate.getState().confirmLegacyFrenchConversion('L1', flat.id, 'element.legacy-french', params));
await assertWriterZero('bad parameters', failureStore(), (candidate) => candidate.getState().confirmLegacyFrenchConversion('L1', flat.id, 'element.legacy-french', { ...params, unknown: true }));
console.log('editor-v7-french-conversion: ok');
