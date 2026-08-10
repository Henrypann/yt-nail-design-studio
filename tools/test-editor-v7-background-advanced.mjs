import { strict as assert } from 'node:assert';
import { createFullEditorDocV7Fixture } from '../src/studio/editor/fixtures/editor-doc-v7.mjs';
import {
  addEditorV7GradientStop,
  applyEditorV7PaletteTheme,
  composeBackgroundAlphaV7,
  createGlitterPreviewParticlesV7,
  normalizeBackgroundDirectionV7,
  removeEditorV7GradientStop,
  resolveBackgroundPreviewModelV7,
  setEditorV7AdvancedBackgroundMode,
  setEditorV7BackgroundMode,
  setEditorV7CatEyeParameters,
  setEditorV7GlitterParameters,
  setEditorV7GradientDirection,
  setEditorV7GradientStops,
} from '../src/studio/editor/v7/background.ts';
import { createEditorDocV7Repository } from '../src/studio/editor/v7/repository.ts';
import { createEditorV7Store } from '../src/studio/editor/store-v7.ts';

const clone = (value) => structuredClone(value);
const rgba = (r, g, b, a = 1) => ({ colorSpace: 'srgb', r, g, b, a });
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
function runtime(doc, readOnly = false) {
  const storage = new MemoryStorage({ [doc.designId]: doc });
  const timers = new FakeTimers();
  const store = createEditorV7Store({
    repository: createEditorDocV7Repository(storage, resolvers),
    now: () => '2026-08-10T09:00:00.000Z',
    setTimeout: timers.setTimeout,
    clearTimeout: timers.clearTimeout,
    autosaveDelayMs: 20,
  });
  return { storage, timers, store, readOnly };
}

// Nail-local direction is canonical and any finite input normalizes to [0, 360).
{
  assert.equal(normalizeBackgroundDirectionV7(360), 0);
  assert.equal(normalizeBackgroundDirectionV7(-45), 315);
  assert.equal(normalizeBackgroundDirectionV7(765), 45);
  const doc = createFullEditorDocV7Fixture();
  const changed = setEditorV7GradientDirection(doc, 'L3', -90);
  assert.equal(changed.ok, true);
  assert.equal(changed.doc.nails.L3.steps[0].background.directionDeg, 270);
  assert.equal(setEditorV7GradientDirection(doc, 'L3', Number.NaN).reason, 'invalid_value');
  console.log('[v7-background-advanced] nail-local direction normalization: PASS');
}

// Gradient remains one background payload; stops are stable, strictly sorted and bounded 2..8.
{
  const doc = createFullEditorDocV7Fixture();
  const before = clone(doc);
  const stops = [
    { offset: 1, color: rgba(20, 30, 40) },
    { offset: 0, color: rgba(1, 2, 3) },
    { offset: 0.4, color: rgba(10, 20, 30) },
  ];
  const sorted = setEditorV7GradientStops(doc, 'L3', stops);
  assert.equal(sorted.ok, true);
  assert.deepEqual(sorted.doc.nails.L3.steps[0].background.stops.map((stop) => stop.offset), [0, 0.4, 1]);
  assert.deepEqual(doc, before);
  const added = addEditorV7GradientStop(sorted.doc, 'L3');
  assert.equal(added.ok, true);
  assert.deepEqual(added.doc.nails.L3.steps[0].background.stops.map((stop) => stop.offset), [0, 0.4, 0.7, 1]);
  assert.equal(setEditorV7GradientStops(doc, 'L3', [stops[0]]).reason, 'invalid_value');
  assert.equal(setEditorV7GradientStops(doc, 'L3', [{ ...stops[0], offset: 0.5 }, { ...stops[1], offset: 0.5 }]).reason, 'invalid_value');
  const removed = removeEditorV7GradientStop(added.doc, 'L3', 2);
  assert.equal(removed.ok, true);
  assert.deepEqual(removed.doc.nails.L3.steps[0].background.stops.map((stop) => stop.offset), [0, 0.4, 1]);
  let capped = sorted.doc;
  while (capped.nails.L3.steps[0].background.stops.length < 8) capped = addEditorV7GradientStop(capped, 'L3').doc;
  assert.equal(addEditorV7GradientStop(capped, 'L3').reason, 'not_allowed');
  assert.equal(added.doc.nails.L3.steps.filter((step) => step.kind === 'background').length, 1);
  console.log('[v7-background-advanced] gradient stop invariants and stable ordering: PASS');
}

// Basic→advanced conversion and cat-eye updates are explicit, analytic and whole-background only.
{
  const doc = createFullEditorDocV7Fixture();
  const localEffect = clone(doc.nails.L1.steps.find((step) => step.kind === 'surface_effect'));
  const converted = setEditorV7AdvancedBackgroundMode(doc, 'L1', 'cat_eye');
  assert.equal(converted.ok, true);
  const background = converted.doc.nails.L1.steps[0].background;
  assert.equal(background.mode, 'cat_eye');
  assert.equal(background.previewFidelity, 'approximate');
  const tuned = setEditorV7CatEyeParameters(converted.doc, 'L1', { color: rgba(80, 50, 100), directionDeg: 450, intensity: 0.82, bandWidth: 0.19 });
  assert.equal(tuned.ok, true);
  assert.equal(tuned.doc.nails.L1.steps[0].background.directionDeg, 90);
  assert.equal(setEditorV7AdvancedBackgroundMode(doc, 'L1', 'invalid-mode').reason, 'not_allowed');
  assert.deepEqual(tuned.doc.nails.L1.steps.find((step) => step.kind === 'surface_effect'), localEffect);
  assert.deepEqual(tuned.doc.nails.L2, doc.nails.L2);
  console.log('[v7-background-advanced] whole-nail cat-eye/local-effect boundary: PASS');
}

// Glitter particles are seed-deterministic across refresh and parameter validation is atomic.
{
  const first = createGlitterPreviewParticlesV7('stable-seed', 0.6, 3);
  assert.equal(createGlitterPreviewParticlesV7('stable-seed', 0, 3).length, 0);
  assert.deepEqual(createGlitterPreviewParticlesV7('stable-seed', 0.6, 3), first);
  assert.notDeepEqual(createGlitterPreviewParticlesV7('other-seed', 0.6, 3), first);
  const doc = createFullEditorDocV7Fixture();
  const converted = setEditorV7AdvancedBackgroundMode(doc, 'L1', 'glitter');
  assert.equal(converted.ok, true);
  const updated = setEditorV7GlitterParameters(converted.doc, 'L1', { colors: [rgba(2, 4, 6), rgba(220, 200, 180)], density: 0.73, particleSizeMm: 0.22, seed: 'saved-seed' });
  assert.equal(updated.ok, true);
  assert.equal(updated.doc.nails.L1.steps[0].background.previewFidelity, 'approximate');
  assert.equal(setEditorV7GlitterParameters(converted.doc, 'L1', { colors: [], density: 0.5, particleSizeMm: 0.1, seed: 'x' }).reason, 'invalid_value');
  console.log('[v7-background-advanced] deterministic glitter preview and fidelity: PASS');
}

// Existing unavailable fidelity is honored, and derived alpha composes RGBA × opacity.
{
  const doc = createFullEditorDocV7Fixture();
  const catEye = clone(doc.nails.L1.steps.find((step) => step.kind === 'surface_effect').effect);
  const payload = { mode: 'cat_eye', color: rgba(10, 20, 30, 0.5), opacity: 0.4, directionDeg: catEye.directionDeg, intensity: catEye.intensity, bandWidth: catEye.bandWidth, previewFidelity: 'unavailable' };
  assert.equal(resolveBackgroundPreviewModelV7(payload, true).fidelity, 'unavailable');
  assert.equal(resolveBackgroundPreviewModelV7({ ...payload, previewFidelity: 'exact' }, true).fidelity, 'exact');
  assert.equal(composeBackgroundAlphaV7(payload.color, payload.opacity, 0.5), 0.1);
  console.log('[v7-background-advanced] unavailable fidelity and composed alpha: PASS');
}

// Structured material palette is materialized into canonical stops, with no live source object retained.
{
  const doc = createFullEditorDocV7Fixture();
  const theme = { id: 'material.test', name: 'Test', sourceColorIds: ['c_a', 'c_b', 'c_c'], colors: [rgba(1, 2, 3), rgba(40, 50, 60), rgba(200, 210, 220)] };
  const applied = applyEditorV7PaletteTheme(doc, 'L1', theme);
  assert.equal(applied.ok, true);
  assert.equal(applied.doc.nails.L1.steps[0].background.mode, 'gradient');
  assert.deepEqual(applied.doc.nails.L1.steps[0].background.stops.map((stop) => stop.offset), [0, 0.5, 1]);
  assert.equal(JSON.stringify(applied.doc).includes('material.test'), false);
  assert.equal(JSON.stringify(applied.doc).includes('sourceColorIds'), false);
  console.log('[v7-background-advanced] palette materialization/no dual linkage: PASS');
}

// Store: every accepted action is one revision/history/autosave transaction; undo/save/reload and gates hold.
{
  const doc = createFullEditorDocV7Fixture();
  const { storage, timers, store } = runtime(doc);
  assert.equal(await store.getState().load(doc.designId), 'ok');
  const baseRevision = store.getState().doc.revision;
  assert.equal(store.getState().setAdvancedBackgroundMode('L1', 'gradient').ok, true);
  assert.equal(store.getState().doc.revision, baseRevision + 1);
  assert.equal(store.getState().history.length, 1);
  assert.equal(store.getState().setAdvancedBackgroundMode('L1', 'gradient').reason, 'not_allowed');
  assert.equal(store.getState().doc.revision, baseRevision + 1);
  assert.equal(store.getState().setGradientDirection('L1', 725).ok, true);
  assert.equal(store.getState().doc.revision, baseRevision + 2);
  assert.equal(store.getState().history.length, 2);
  const autosaveTask = [...timers.tasks.values()].at(-1);
  assert.equal(typeof autosaveTask, 'function');
  autosaveTask();
  for (let attempt = 0; attempt < 20 && store.getState().revisionState.pendingRevision !== null; attempt += 1) await new Promise((resolve) => setImmediate(resolve));
  assert.equal(storage.writes, 1);
  assert.equal(store.getState().revisionState.pendingRevision, null);
  assert.equal(store.getState().undo().ok, true);
  assert.equal(store.getState().doc.nails.L1.steps[0].background.directionDeg, 0);
  assert.equal(store.getState().undo().ok, true);
  assert.equal(store.getState().doc.nails.L1.steps[0].background.mode, 'solid');
  assert.equal(store.getState().redo().ok, true);
  assert.equal(store.getState().doc.nails.L1.steps[0].background.mode, 'gradient');
  assert.equal(await store.getState().save(), 'saved');
  assert.equal(store.getState().reloadFromStorage(), 'ok');
  assert.equal(store.getState().doc.nails.L1.steps[0].background.mode, 'gradient');

  store.setState({ readOnly: true });
  const revision = store.getState().doc.revision;
  assert.equal(store.getState().setAdvancedBackgroundMode('L1', 'glitter').reason, 'read_only');
  assert.equal(store.getState().doc.revision, revision);
  store.setState({ readOnly: false, switching: true });
  assert.equal(store.getState().setAdvancedBackgroundMode('L1', 'glitter').reason, 'busy');
  assert.equal(store.getState().doc.revision, revision);
  store.setState({ switching: false });
  const lockedDoc = clone(store.getState().doc);
  lockedDoc.nails.L1.steps[0].locked = true;
  store.setState({ doc: lockedDoc });
  assert.equal(store.getState().setAdvancedBackgroundMode('L1', 'glitter').reason, 'locked');
  assert.equal(store.getState().doc.revision, revision);
  console.log('[v7-background-advanced] store transaction, persistence and gates: PASS');
}

// Advanced→basic remains explicit and undoable through the same runtime history.
{
  const doc = createFullEditorDocV7Fixture();
  const { store } = runtime(doc);
  await store.getState().load(doc.designId);
  store.getState().setCurrentFinger('L3');
  const original = clone(store.getState().doc.nails.L3.steps[0].background);
  assert.equal(setEditorV7BackgroundMode(store.getState().doc, 'L3', 'solid').ok, true);
  assert.equal(store.getState().setBackgroundMode('L3', 'solid').ok, true);
  assert.equal(store.getState().undo().ok, true);
  assert.deepEqual(store.getState().doc.nails.L3.steps[0].background, original);
  console.log('[v7-background-advanced] reversible advanced/basic conversion: PASS');
}

console.log('[v7-background-advanced] all checks passed');
