import { strict as assert } from 'node:assert';
import { createFullEditorDocV7Fixture, createMinimalEditorDocV7Fixture } from '../src/studio/editor/fixtures/editor-doc-v7.mjs';
import { createEditorV7Store } from '../src/studio/editor/store-v7.ts';
import { addEditorV7Element, addEditorV7Step, replaceEditorV7DimensionalDecoration } from '../src/studio/editor/v7/commands.ts';
import { PROCESS_STEP_TYPE_IDS_V7 } from '../src/studio/editor/v7/registry.ts';
import { createEditorDocV7Repository } from '../src/studio/editor/v7/repository.ts';
import { parseEditorDocV7 } from '../src/studio/editor/v7/schema.ts';
import {
  createDimensionalDecorationV7,
  dimensionalDecorationArchetypeV7,
  dimensionalDecorationFidelityV7,
  dimensionalDecorationPathToCanvasV7,
  dimensionalDecorationShadowOffsetV7,
  dimensionalMeshAssetRefV7,
  resolveDimensionalMeshFidelityV7,
} from '../src/studio/editor/v7/dimensional-decoration.ts';

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
  let sequence = 0;
  const store = createEditorV7Store({
    repository: createEditorDocV7Repository(storage, resolvers),
    now: () => '2026-08-11T10:00:00.000Z',
    idFactory: (prefix) => `${prefix}.dimensional.${++sequence}`,
    setTimeout: timers.setTimeout,
    clearTimeout: timers.clearTimeout,
    autosaveDelayMs: 20,
  });
  return { storage, timers, store };
}

// Five product presets stay inside the frozen V7 union and use structured nail-local data.
{
  const archetypes = ['relief', 'droplet', 'gel_stack', 'carving', 'accessory'];
  for (const archetype of archetypes) {
    const decoration = createDimensionalDecorationV7(archetype, `element.${archetype}`);
    assert.ok(decoration, archetype);
    assert.equal(dimensionalDecorationArchetypeV7(decoration), archetype);
    assert.ok(['relief_2_5d', 'attachment_3d'].includes(decoration.kind));
    assert.ok(decoration.heightMm >= 0.01 && decoration.heightMm <= 10);
    if (decoration.kind === 'relief_2_5d') assert.ok(dimensionalDecorationPathToCanvasV7(decoration.outline.pathData));
  }
  assert.equal(dimensionalDecorationPathToCanvasV7('invalid'), null);
  assert.equal(dimensionalDecorationShadowOffsetV7(-1), 1);
  assert.equal(dimensionalDecorationShadowOffsetV7(99), 8);
  console.log('[v7-dimensional] five structured presets and deterministic projection: PASS');
}

// Mesh refs are derived from the checked GLB manifest; mismatches fail closed without erasing the ref.
{
  const ref = dimensionalMeshAssetRefV7('mercury-dew-ribbon');
  assert.ok(ref);
  assert.equal(ref.kind, 'mesh');
  assert.equal(ref.mimeType, 'model/gltf-binary');
  assert.match(ref.sha256, /^[a-f0-9]{64}$/);
  assert.equal(resolveDimensionalMeshFidelityV7(ref), 'approximate');
  const mismatch = { ...ref, sha256: '0'.repeat(64) };
  assert.equal(resolveDimensionalMeshFidelityV7(mismatch), 'unavailable');
  assert.equal(resolveDimensionalMeshFidelityV7({ ...ref, assetId: 'mesh.missing' }), 'unavailable');
  const accessory = createDimensionalDecorationV7('accessory', 'element.accessory');
  assert.equal(dimensionalDecorationFidelityV7({ ...accessory, asset: mismatch }), 'unavailable');
  assert.equal(dimensionalMeshAssetRefV7('starfish-bloom-starfish'), null);
  console.log('[v7-dimensional] manifest identity and missing/mismatched mesh fallback: PASS');
}

// Narrow command replacement preserves IDs, locks, immutability and the canonical finish.
{
  const doc = createMinimalEditorDocV7Fixture();
  const step = { id: 'step.dimensional', typeId: PROCESS_STEP_TYPE_IDS_V7.dimensional_decoration, kind: 'dimensional_decoration', name: '立体装饰', visible: true, locked: false, skipped: false, materialRefs: [], decorations: [] };
  const withStep = addEditorV7Step(doc, 'R4', step, doc.nails.R4.steps.length - 1);
  assert.equal(withStep.ok, true, withStep.message);
  const decoration = createDimensionalDecorationV7('droplet', 'element.droplet');
  const added = addEditorV7Element(withStep.doc, 'R4', step.id, decoration);
  assert.equal(added.ok, true, added.message);
  const before = clone(added.doc);
  const changed = replaceEditorV7DimensionalDecoration(added.doc, 'R4', step.id, decoration.id, { ...decoration, heightMm: 0.44, transform: { ...decoration.transform, position: { u: 0.33, v: 0.61 } } });
  assert.equal(changed.ok, true, changed.message);
  assert.deepEqual(added.doc, before);
  assert.equal(changed.doc.nails.R4.steps.at(-1).kind, 'surface_finish');
  assert.equal(changed.doc.nails.R4.steps.filter((item) => item.kind === 'surface_finish').length, 1);
  assert.equal(parseEditorDocV7(changed.doc).ok, true);
  assert.equal(replaceEditorV7DimensionalDecoration(added.doc, 'R4', step.id, decoration.id, { ...decoration, id: 'element.changed' }).reason, 'invalid_value');
  const locked = clone(added.doc);
  locked.nails.R4.steps.find((item) => item.id === step.id).decorations[0].locked = true;
  assert.equal(replaceEditorV7DimensionalDecoration(locked, 'R4', step.id, decoration.id, decoration).reason, 'locked');
  const backgroundId = doc.nails.R4.steps[0].id;
  assert.equal(replaceEditorV7DimensionalDecoration(doc, 'R4', backgroundId, decoration.id, decoration).reason, 'not_allowed');
  console.log('[v7-dimensional] replacement command and finish invariant: PASS');
}

// Store mutation is one transaction, detaches one linked finger, persists and respects runtime gates.
{
  const doc = createFullEditorDocV7Fixture();
  const { storage, timers, store } = runtime(doc);
  assert.equal(await store.getState().load(doc.designId), 'ok');
  store.getState().setCurrentFinger('L1');
  const step = store.getState().doc.nails.L1.steps.find((item) => item.kind === 'dimensional_decoration');
  const decoration = step.decorations[0];
  const revision = store.getState().doc.revision;
  const replacement = { ...decoration, heightMm: Math.min(10, decoration.heightMm + 0.05) };
  assert.equal(store.getState().replaceDimensionalDecoration('L1', step.id, decoration.id, replacement).ok, true);
  assert.equal(store.getState().doc.revision, revision + 1);
  assert.equal(store.getState().history.length, 1);
  assert.equal(store.getState().doc.nails.L1.compositionProvenance.syncState, 'detached');
  assert.equal(store.getState().doc.nails.L1.steps.at(-1).kind, 'surface_finish');
  const autosave = [...timers.tasks.values()].at(-1);
  assert.equal(typeof autosave, 'function');
  autosave();
  for (let attempt = 0; attempt < 20 && store.getState().revisionState.pendingRevision !== null; attempt += 1) await new Promise((resolve) => setImmediate(resolve));
  assert.equal(storage.writes, 1);
  assert.equal(store.getState().undo().ok, true);
  assert.equal(store.getState().redo().ok, true);
  assert.equal(await store.getState().save(), 'saved');
  assert.equal(store.getState().reloadFromStorage(), 'ok');
  assert.equal(store.getState().doc.nails.L1.steps.find((item) => item.id === step.id).decorations[0].heightMm, replacement.heightMm);
  store.setState({ readOnly: true });
  const frozenRevision = store.getState().doc.revision;
  assert.equal(store.getState().replaceDimensionalDecoration('L1', step.id, decoration.id, decoration).reason, 'read_only');
  store.setState({ readOnly: false, switching: true });
  assert.equal(store.getState().replaceDimensionalDecoration('L1', step.id, decoration.id, decoration).reason, 'busy');
  assert.equal(store.getState().doc.revision, frozenRevision);
  console.log('[v7-dimensional] store transaction, persistence, detach and gates: PASS');
}

console.log('[v7-dimensional] all checks passed');
