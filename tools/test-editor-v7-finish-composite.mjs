import { strict as assert } from 'node:assert';
import { createFullEditorDocV7Fixture, createMinimalEditorDocV7Fixture } from '../src/studio/editor/fixtures/editor-doc-v7.mjs';
import { createBlankEditorDocV7 } from '../src/studio/editor/v7/create.ts';
import { createEditorV7Store } from '../src/studio/editor/store-v7.ts';
import { setEditorV7SurfaceFinish } from '../src/studio/editor/v7/commands.ts';
import { createEditorDocV7Repository } from '../src/studio/editor/v7/repository.ts';
import { deriveFinishCompositeV7 } from '../src/studio/editor/v7/finish-composite.ts';
import { createSurfaceFinishDefinitionV7, surfaceFinishPreviewAppearanceV7 } from '../src/studio/editor/v7/finish.ts';

const clone = (value) => structuredClone(value);
const resolvers = { resolveGeometry: () => null, resolveFinishPreset: () => null };
class MemoryStorage {
  constructor(docs) { this.docs = clone(docs); }
  writes = 0;
  read = () => clone(this.docs);
  write = async (next) => { this.docs = clone(next); this.writes += 1; };
}
class FakeTimers {
  next = 1;
  tasks = new Map();
  setTimeout = (callback) => { const id = this.next++; this.tasks.set(id, callback); return id; };
  clearTimeout = (id) => this.tasks.delete(id);
}
function runtime(doc) {
  const storage = new MemoryStorage({ [doc.designId]: doc });
  const timers = new FakeTimers();
  const store = createEditorV7Store({
    repository: createEditorDocV7Repository(storage, resolvers),
    now: () => '2026-08-11T12:00:00.000Z',
    setTimeout: timers.setTimeout,
    clearTimeout: timers.clearTimeout,
    autosaveDelayMs: 20,
  });
  return { storage, timers, store };
}

// V7 finish options are canonical and never substitute the legacy pearl entry for frosted.
{
  for (const type of ['gloss', 'matte', 'frosted']) {
    const definition = createSurfaceFinishDefinitionV7(type);
    assert.equal(definition.finish.type, type);
    assert.equal(definition.finish.materialPresetRef.id, `preset.finish.${type}`);
    assert.equal(definition.materialRef.materialId, `material.finish.${type}`);
    assert.ok(!definition.finish.materialPresetRef.id.includes('pearl'));
    assert.ok(surfaceFinishPreviewAppearanceV7(type));
  }
  const created = createBlankEditorDocV7({ designId: 'design.finish.frosted', shape: 'almond', length: 'medium', finish: 'frosted', now: '2026-08-11T12:00:00.000Z' });
  assert.equal(created.ok, true, created.message);
  assert.equal(created.doc.nails.R4.steps.at(-1).finish.materialPresetRef.id, 'preset.finish.frosted');
  console.log('[v7-finish] canonical definitions and creation convention: PASS');
}

// Pure read model preserves canonical order, visible/skipped semantics and unavailable propagation.
{
  const doc = createFullEditorDocV7Fixture();
  const nail = doc.nails.L1;
  const original = clone(nail);
  const model = deriveFinishCompositeV7(nail, 'frosted');
  assert.deepEqual(nail, original);
  assert.equal(model.previewFinishType, 'frosted');
  assert.equal(model.layerCounts.background, 1);
  assert.ok(model.layerCounts.flat > 0);
  assert.ok(model.layerCounts.surface > 0);
  assert.ok(model.layerCounts.dimensional > 0);
  assert.equal(model.layerCounts.finish, 1);
  assert.deepEqual(model.activeStepIds, [nail.steps[0], ...nail.steps.slice(1, -1).filter((step) => step.visible && !step.skipped), nail.steps.at(-1)].map((step) => step.id));
  assert.ok(['approximate', 'unavailable'].includes(model.fidelity));
  assert.ok(model.warnings.some((warning) => warning.includes('2D 蒙版以近似方式参与组合')));
  const hidden = clone(nail);
  const surface = hidden.steps.find((step) => step.kind === 'surface_effect');
  const dimensional = hidden.steps.find((step) => step.kind === 'dimensional_decoration');
  hidden.steps.filter((step) => step.kind === 'surface_effect').forEach((step) => { step.visible = false; });
  dimensional.skipped = true;
  const hiddenModel = deriveFinishCompositeV7(hidden, null);
  assert.equal(hiddenModel.layerCounts.surface, 0);
  assert.equal(hiddenModel.layerCounts.dimensional, 0);
  assert.equal(hiddenModel.activeStepIds.includes(surface.id), false);
  assert.equal(hiddenModel.activeStepIds.includes(dimensional.id), false);
  const unavailable = clone(nail);
  unavailable.steps.find((step) => step.kind === 'surface_effect').effect.previewFidelity = 'unavailable';
  assert.equal(deriveFinishCompositeV7(unavailable, null).fidelity, 'unavailable');
  console.log('[v7-finish] pure canonical-order composite read model: PASS');
}

// Command mutates only the unique last unlocked finish and keeps material identity synchronized.
{
  const doc = createMinimalEditorDocV7Fixture();
  const finish = doc.nails.R4.steps.at(-1);
  const before = clone(doc);
  const changed = setEditorV7SurfaceFinish(doc, 'R4', finish.id, 'matte');
  assert.equal(changed.ok, true, changed.message);
  assert.deepEqual(doc, before);
  assert.equal(changed.doc.nails.R4.steps.at(-1).finish.type, 'matte');
  assert.equal(changed.doc.nails.R4.steps.at(-1).finish.materialPresetRef.id, 'preset.finish.matte');
  assert.equal(changed.doc.nails.R4.steps.at(-1).materialRefs[0].materialId, 'material.finish.matte');
  assert.equal(changed.doc.nails.R4.steps.filter((step) => step.kind === 'surface_finish').length, 1);
  assert.equal(setEditorV7SurfaceFinish(doc, 'R4', doc.nails.R4.steps[0].id, 'matte').reason, 'not_allowed');
  assert.equal(setEditorV7SurfaceFinish(doc, 'R4', finish.id, 'pearl').reason, 'invalid_value');
  const locked = clone(doc);
  locked.nails.R4.steps.at(-1).locked = true;
  assert.equal(setEditorV7SurfaceFinish(locked, 'R4', finish.id, 'matte').reason, 'locked');
  console.log('[v7-finish] atomic finish command and invariant gates: PASS');
}

// Preview is zero-write even read-only; apply is one transaction and never locks later editing.
{
  const doc = createMinimalEditorDocV7Fixture();
  const { storage, timers, store } = runtime(doc);
  assert.equal(await store.getState().load(doc.designId), 'ok');
  store.getState().setCurrentFinger('R4');
  const baseline = clone(store.getState().doc);
  const baselineHistory = store.getState().history.length;
  const baselinePending = store.getState().revisionState.pendingRevision;
  const baselineTimers = timers.tasks.size;
  store.getState().setPreviewFinishType('matte');
  assert.deepEqual(store.getState().doc, baseline);
  assert.equal(store.getState().history.length, baselineHistory);
  assert.equal(store.getState().revisionState.pendingRevision, baselinePending);
  assert.equal(timers.tasks.size, baselineTimers);
  store.setState({ readOnly: true });
  store.getState().setPreviewFinishType('frosted');
  assert.equal(store.getState().previewFinishType, 'frosted');
  assert.deepEqual(store.getState().doc, baseline);
  const finish = store.getState().doc.nails.R4.steps.at(-1);
  assert.equal(store.getState().setSurfaceFinish('R4', finish.id, 'matte').reason, 'read_only');
  store.setState({ readOnly: false, switching: true });
  store.getState().setPreviewFinishType('gloss');
  assert.equal(store.getState().previewFinishType, 'frosted');
  store.setState({ switching: false });
  store.getState().setPreviewFinishType('matte');
  assert.equal(store.getState().setSurfaceFinish('R4', finish.id, 'matte').ok, true);
  assert.equal(store.getState().doc.revision, baseline.revision + 1);
  assert.equal(store.getState().history.length, baselineHistory + 1);
  assert.equal(store.getState().doc.nails.R4.steps.at(-1).finish.type, 'matte');
  assert.equal(store.getState().readOnly, false);
  const color = { colorSpace: 'srgb', r: 122, g: 88, b: 144, a: 1 };
  assert.equal(store.getState().setBackgroundColor('R4', color).ok, true);
  assert.equal(store.getState().doc.revision, baseline.revision + 2);
  assert.equal(store.getState().doc.nails.R4.steps.at(-1).finish.type, 'matte');
  const autosave = [...timers.tasks.values()].at(-1);
  autosave();
  for (let attempt = 0; attempt < 20 && store.getState().revisionState.pendingRevision !== null; attempt += 1) await new Promise((resolve) => setImmediate(resolve));
  assert.equal(storage.writes, 1);
  assert.equal(store.getState().undo().ok, true);
  assert.equal(store.getState().redo().ok, true);
  assert.equal(await store.getState().save(), 'saved');
  assert.equal(store.getState().reloadFromStorage(), 'ok');
  assert.equal(store.getState().doc.nails.R4.steps.at(-1).finish.type, 'matte');
  console.log('[v7-finish] preview zero-write, apply transaction and continued editing: PASS');
}

console.log('[v7-finish] all checks passed');
