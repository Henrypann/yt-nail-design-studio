#!/usr/bin/env node
import assert from 'node:assert/strict';
import { createBlankEditorDocV7 } from '../src/studio/editor/v7/create.ts';
import { createFrenchRecipeCommand, updateFrenchRecipeCommand, deleteFrenchRecipeCommand } from '../src/studio/editor/v7/french-commands-v1.ts';
import { createDefaultFrenchRecipeParametersV1, parseFrenchRecipeParametersV1 } from '../src/studio/editor/v7/french-recipe-v1.ts';
import { inspectFrenchRecipeProjectionV1 } from '../src/studio/editor/v7/french-conversion-v1.ts';
import { FINGER_CODES } from '../src/lib/types.ts';
import { createEditorV7Store } from '../src/studio/editor/store-v7.ts';
import { createEditorDocV7Repository } from '../src/studio/editor/v7/repository.ts';

const blank = createBlankEditorDocV7({ designId: 'french-command-test', shape: 'almond', length: 'medium', now: '2026-08-24T00:00:00.000Z' });
assert.equal(blank.ok, true);
let seq = 0;
const ids = (kind) => `${kind}.french.test.${++seq}`;
const params = createDefaultFrenchRecipeParametersV1('classic');
const all = { kind: 'all', currentFinger: 'L1' };
const created = createFrenchRecipeCommand(blank.doc, all, params, ids);
assert.equal(created.ok, true, created.ok ? '' : created.message);
assert.equal(Object.values(created.doc.recipeInstances).length, 10, 'all creates one independent recipe per finger');
for (const finger of FINGER_CODES) {
  const steps = created.doc.nails[finger].steps.filter((step) => step.recipeInstanceId);
  assert.equal(steps.length, 1, `${finger} has one managed step`);
  assert.equal(steps[0].elements.length, 1);
  assert.equal(created.doc.recipeInstances[steps[0].recipeInstanceId].instanceId, steps[0].recipeInstanceId);
}
const before = JSON.stringify(created.doc);
const mirrorParams = { ...params, leftWingV: 0.27, rightWingV: 0.41, balanceLocked: false, preset: 'custom' };
const mirrored = createFrenchRecipeCommand(created.doc, { kind: 'mirror', currentFinger: 'L1' }, mirrorParams, ids);
assert.equal(mirrored.ok, true);
const left = Object.values(mirrored.doc.recipeInstances).find((r) => r.parameterValues.leftWingV === 0.27);
const right = Object.values(mirrored.doc.recipeInstances).find((r) => r.parameterValues.leftWingV === 0.41);
assert.ok(left && right, 'mirror swaps wings and recompiles both target geometries');
assert.equal(JSON.stringify(created.doc), before, 'pure command does not mutate input');
const sourceStep = mirrored.doc.nails.L1.steps.find((step) => step.recipeInstanceId);
const updated = updateFrenchRecipeCommand(mirrored.doc, { kind: 'current', currentFinger: 'R1' }, { ...params, preset: 'micro' }, 'L1', sourceStep.id, ids);
assert.equal(updated.ok, true);
const deleteSource = updated.doc.nails.L1.steps.find((step) => step.recipeInstanceId);
const deleted = deleteFrenchRecipeCommand(updated.doc, { kind: 'selected', currentFinger: 'L1', selectedFingers: ['L1'] }, 'L1', deleteSource.id);
assert.equal(deleted.ok, true);
assert.equal(deleted.doc.nails.L1.steps.filter((step) => step.recipeInstanceId).length, 1);
assert.equal(deleteFrenchRecipeCommand(deleted.doc, { kind: 'selected', currentFinger: 'L1', selectedFingers: [] }, 'L1', deleteSource.id).ok, false, 'empty selected scope is writer-zero');
const twoA = createFrenchRecipeCommand(blank.doc, { kind: 'current', currentFinger: 'L2' }, params, ids);
const twoB = createFrenchRecipeCommand(twoA.doc, { kind: 'current', currentFinger: 'L2' }, { ...params, preset: 'micro' }, ids);
assert.equal(twoB.ok, true);
const l2French = twoB.doc.nails.L2.steps.filter((step) => step.recipeInstanceId);
assert.equal(l2French.length, 2, 'same finger can own two French recipes');
const firstL2 = JSON.stringify(l2French[0]);
const secondUpdated = updateFrenchRecipeCommand(twoB.doc, { kind: 'current', currentFinger: 'L2' }, { ...params, preset: 'deep' }, 'L2', l2French[1].id, ids);
assert.equal(secondUpdated.ok, true);
assert.equal(JSON.stringify(secondUpdated.doc.nails.L2.steps.find((step) => step.id === l2French[0].id)), firstL2, 'sourceStepId updates only selected ordinal');
for (const preset of ['classic', 'micro', 'soft', 'deep', 'pointed']) {
  const one = createFrenchRecipeCommand(blank.doc, { kind: 'current', currentFinger: 'L3' }, createDefaultFrenchRecipeParametersV1(preset), ids);
  assert.equal(one.ok, true, `${preset} create`);
  const step = one.doc.nails.L3.steps.find((candidate) => candidate.recipeInstanceId);
  assert.equal(parseFrenchRecipeParametersV1(one.doc.recipeInstances[step.recipeInstanceId].parameterValues).ok, true, `${preset} strict recipe`);
  assert.equal(inspectFrenchRecipeProjectionV1(one.doc, 'L3', step.id).ok, true, `${preset} projection parity`);
}
const seed = createFrenchRecipeCommand(blank.doc, { kind: 'mirror', currentFinger: 'L1' }, params, ids);
const secondL1 = createFrenchRecipeCommand(seed.doc, { kind: 'current', currentFinger: 'L1' }, { ...params, preset: 'micro' }, ids);
const l1Ordinal1 = secondL1.doc.nails.L1.steps.filter((step) => step.recipeInstanceId)[1];
const mirrorUpdate = updateFrenchRecipeCommand(secondL1.doc, { kind: 'mirror', currentFinger: 'L1' }, { ...params, leftWingV: 0.27, rightWingV: 0.41, balanceLocked: false, preset: 'custom' }, 'L1', l1Ordinal1.id, ids);
assert.equal(mirrorUpdate.ok, true, 'missing mirror ordinal creates detached target');
const r1French = mirrorUpdate.doc.nails.R1.steps.filter((step) => step.recipeInstanceId);
assert.equal(r1French.length, 2);
const detachedRecipe = mirrorUpdate.doc.recipeInstances[r1French[1].recipeInstanceId];
assert.equal(detachedRecipe.parameterValues.leftWingV, 0.41, 'mirror detached target swaps left/right');
const malformed = structuredClone(seed.doc); const malformedRecipeId = malformed.nails.L1.steps.find((step) => step.recipeInstanceId).recipeInstanceId; malformed.recipeInstances[malformedRecipeId].recipeRevision = '9.9.9'; const malformedBefore = JSON.stringify(malformed);
assert.doesNotThrow(() => createFrenchRecipeCommand(malformed, { kind: 'current', currentFinger: 'R1' }, params, ids));
assert.equal(createFrenchRecipeCommand(malformed, { kind: 'current', currentFinger: 'R1' }, params, ids).ok, false);
assert.equal(JSON.stringify(malformed), malformedBefore, 'malformed revision is writer-zero');
const orphan = structuredClone(seed.doc); const orphanStepIndex = orphan.nails.L1.steps.findIndex((step) => step.recipeInstanceId); orphan.nails.L1.steps.splice(orphanStepIndex, 1); const orphanBefore = JSON.stringify(orphan);
assert.equal(createFrenchRecipeCommand(orphan, { kind: 'current', currentFinger: 'R1' }, params, ids).ok, false, 'orphan French recipe identity is rejected');
assert.equal(JSON.stringify(orphan), orphanBefore, 'orphan French recipe is writer-zero');
for (const [label, mutate, factory] of [
  ['duplicate', (doc) => { doc.nails.L1.steps[0].id = doc.nails.L1.steps[1].id; }, ids],
  ['invalid', (doc) => { doc.nails.L1.steps[0].id = ''; }, ids],
  ['factory throw', (doc) => {}, () => { throw new Error('factory'); }],
]) {
  const bad = structuredClone(blank.doc); mutate(bad); const beforeBad = JSON.stringify(bad);
  assert.doesNotThrow(() => createFrenchRecipeCommand(bad, { kind: 'current', currentFinger: 'L1' }, params, factory), label);
  assert.equal(createFrenchRecipeCommand(bad, { kind: 'current', currentFinger: 'L1' }, params, factory).ok, false, label);
  assert.equal(JSON.stringify(bad), beforeBad, `${label} input unchanged`);
}

class MemoryStorage {
  constructor(doc) { this.docs = { [doc.designId]: structuredClone(doc) }; this.writes = 0; }
  read() { return structuredClone(this.docs); }
  write(value) { this.docs = structuredClone(value); this.writes += 1; }
}
const storeDoc = createBlankEditorDocV7({ designId: 'french-store-test', shape: 'almond', length: 'medium', now: '2026-08-24T00:00:00.000Z' }).doc;
const storage = new MemoryStorage(storeDoc);
const timers = { tasks: new Set(), setTimeout(fn) { this.tasks.add(fn); return fn; }, clearTimeout(fn) { this.tasks.delete(fn); } };
const store = createEditorV7Store({ repository: createEditorDocV7Repository(storage, { resolveGeometry: () => null, resolveFinishPreset: () => null }), now: () => '2026-08-24T00:00:01.000Z', idFactory: ids, setTimeout: timers.setTimeout.bind(timers), clearTimeout: timers.clearTimeout.bind(timers), autosaveDelayMs: 25 });
assert.equal(await store.getState().load(storeDoc.designId), 'ok');
store.getState().setCurrentFinger('L1');
const storeRevision = store.getState().doc.revision;
assert.equal(store.getState().createFrenchRecipe(params).ok, true);
assert.equal(store.getState().doc.revision, storeRevision + 1);
assert.equal(store.getState().history.length, 1);
assert.equal(store.getState().undo().ok, true);
assert.equal(store.getState().redo().ok, true);
assert.equal(store.getState().readOnly, false);
store.setState({ readOnly: true });
assert.equal(store.getState().createFrenchRecipe(params).ok, false);
assert.equal(await store.getState().save(), 'read_only');
store.setState({ readOnly: false });
assert.equal(await store.getState().save(), 'saved');
assert.equal(storage.writes, 1);
assert.equal(store.getState().reloadFromStorage(), 'ok');
assert.equal(Object.values(store.getState().doc.recipeInstances).length, 1);
const managedStoreStep = store.getState().doc.nails.L1.steps.find((step) => step.recipeInstanceId);
const managedStoreElement = managedStoreStep.elements[0];
assert.equal(store.getState().replaceFlatElement('L1', managedStoreStep.id, managedStoreElement.id, managedStoreElement).ok, false, 'generic locked projection edit rejected');
console.log('[french-commands] presets/current/selected/mirror/all/IDs/update/delete/writer-zero: PASS');
