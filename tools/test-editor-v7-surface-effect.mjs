import { strict as assert } from 'node:assert';
import { createFullEditorDocV7Fixture, createMinimalEditorDocV7Fixture } from '../src/studio/editor/fixtures/editor-doc-v7.mjs';
import { createEditorV7Store } from '../src/studio/editor/store-v7.ts';
import { addEditorV7Step, setEditorV7SurfaceEffect, setEditorV7SurfaceEffectMask } from '../src/studio/editor/v7/commands.ts';
import { PROCESS_STEP_TYPE_IDS_V7 } from '../src/studio/editor/v7/registry.ts';
import { createEditorDocV7Repository } from '../src/studio/editor/v7/repository.ts';
import { parseEditorDocV7 } from '../src/studio/editor/v7/schema.ts';
import {
  createDefaultSurfaceEffectPayloadV7,
  createSurfaceEffectMaskV7,
  createSurfaceEffectParticlesV7,
  normalizeSurfaceEffectDirectionV7,
  surfaceEffectMaskPathToCanvasV7,
} from '../src/studio/editor/v7/surface-effect.ts';

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

function runtime(doc, idFactory = (prefix) => `${prefix}.surface-test`) {
  const storage = new MemoryStorage({ [doc.designId]: doc });
  const timers = new FakeTimers();
  const store = createEditorV7Store({
    repository: createEditorDocV7Repository(storage, resolvers),
    now: () => '2026-08-11T08:00:00.000Z',
    idFactory,
    setTimeout: timers.setTimeout,
    clearTimeout: timers.clearTimeout,
    autosaveDelayMs: 20,
  });
  return { storage, timers, store };
}

// Defaults stay inside the frozen union; local effects never write background or finish.
{
  const expected = ['cat_eye', 'glitter', 'mirror', 'ink_bloom'];
  for (const effectType of expected) {
    const payload = createDefaultSurfaceEffectPayloadV7(effectType, `seed-${effectType}`);
    assert.equal(payload.effectType, effectType);
    assert.ok(['exact', 'approximate', 'unavailable'].includes(payload.previewFidelity));
  }
  assert.equal(createDefaultSurfaceEffectPayloadV7('cat_eye').previewFidelity, 'approximate');
  assert.equal(createDefaultSurfaceEffectPayloadV7('glitter').previewFidelity, 'exact');
  assert.equal(normalizeSurfaceEffectDirectionV7(-45), 315);
  assert.equal(normalizeSurfaceEffectDirectionV7(765), 45);
  console.log('[v7-surface-effect] frozen payload union and direction: PASS');
}

// Seed projection and mask compilation are deterministic display helpers only.
{
  const particles = createSurfaceEffectParticlesV7('stable', 0.62, 3);
  assert.deepEqual(createSurfaceEffectParticlesV7('stable', 0.62, 3), particles);
  assert.notDeepEqual(createSurfaceEffectParticlesV7('different', 0.62, 3), particles);
  assert.ok(particles.every((particle) => particle.u >= 0 && particle.u <= 1 && particle.v >= 0 && particle.v <= 1));
  for (const preset of ['full', 'tip', 'center', 'diagonal']) {
    const mask = createSurfaceEffectMaskV7(preset);
    assert.equal(mask.coordinateSpace, 'nail-local-v1');
    assert.ok(surfaceEffectMaskPathToCanvasV7(mask.pathData));
  }
  assert.equal(surfaceEffectMaskPathToCanvasV7('not-a-path'), null);
  console.log('[v7-surface-effect] deterministic particles and mask presets: PASS');
}

// Commands atomically target only an unlocked surface-effect step and preserve unique last finish.
{
  const doc = createFullEditorDocV7Fixture();
  const before = clone(doc);
  const effectStep = doc.nails.L1.steps.find((step) => step.kind === 'surface_effect' && step.effect.effectType === 'cat_eye');
  const payload = { ...createDefaultSurfaceEffectPayloadV7('ink_bloom', 'command-seed'), previewFidelity: 'unavailable' };
  const changed = setEditorV7SurfaceEffect(doc, 'L1', effectStep.id, payload);
  assert.equal(changed.ok, true, changed.message);
  assert.deepEqual(doc, before);
  assert.equal(changed.doc.nails.L1.steps[0].kind, 'background');
  assert.equal(changed.doc.nails.L1.steps.at(-1).kind, 'surface_finish');
  assert.equal(changed.doc.nails.L1.steps.filter((step) => step.kind === 'surface_finish').length, 1);
  assert.equal(changed.doc.nails.L1.steps.find((step) => step.id === effectStep.id).effect.previewFidelity, 'unavailable');
  const masked = setEditorV7SurfaceEffectMask(changed.doc, 'L1', effectStep.id, createSurfaceEffectMaskV7('diagonal'));
  assert.equal(masked.ok, true, masked.message);
  assert.equal(parseEditorDocV7(masked.doc).ok, true);
  const flat = doc.nails.L1.steps.find((step) => step.kind === 'flat_design');
  assert.equal(setEditorV7SurfaceEffect(doc, 'L1', flat.id, payload).reason, 'not_allowed');
  const locked = clone(doc);
  locked.nails.L1.steps.find((step) => step.id === effectStep.id).locked = true;
  assert.equal(setEditorV7SurfaceEffect(locked, 'L1', effectStep.id, payload).reason, 'locked');
  assert.equal(setEditorV7SurfaceEffectMask(doc, 'L1', 'missing', createSurfaceEffectMaskV7('full')).reason, 'not_found');
  console.log('[v7-surface-effect] command gates and finish invariant: PASS');
}

// Repeatable insertion remains before finish and rejects duplicate IDs/invalid positions.
{
  const doc = createMinimalEditorDocV7Fixture();
  const step = {
    id: 'step.surface-effect.test',
    typeId: PROCESS_STEP_TYPE_IDS_V7.surface_effect,
    kind: 'surface_effect',
    name: '局部表面效果',
    visible: true,
    locked: false,
    skipped: false,
    materialRefs: [],
    effect: createDefaultSurfaceEffectPayloadV7('cat_eye', 'insert-seed'),
    mask: createSurfaceEffectMaskV7('center'),
  };
  const inserted = addEditorV7Step(doc, 'R4', step, doc.nails.R4.steps.length - 1);
  assert.equal(inserted.ok, true, inserted.message);
  assert.equal(inserted.doc.nails.R4.steps.at(-2).id, step.id);
  assert.equal(inserted.doc.nails.R4.steps.at(-1).kind, 'surface_finish');
  assert.equal(addEditorV7Step(inserted.doc, 'R4', step, inserted.doc.nails.R4.steps.length - 1).reason, 'duplicate_id');
  assert.equal(addEditorV7Step(doc, 'R4', step, doc.nails.R4.steps.length).reason, 'invalid_position');
  console.log('[v7-surface-effect] repeatable insertion before finish: PASS');
}

// Store actions are one transaction, detach linked provenance, autosave, undo/redo/reload, and respect gates.
{
  const doc = createFullEditorDocV7Fixture();
  const { storage, timers, store } = runtime(doc);
  assert.equal(await store.getState().load(doc.designId), 'ok');
  store.getState().setCurrentFinger('L1');
  const step = store.getState().doc.nails.L1.steps.find((candidate) => candidate.kind === 'surface_effect' && candidate.effect.effectType === 'cat_eye');
  const baseRevision = store.getState().doc.revision;
  const beforeBackground = clone(store.getState().doc.nails.L1.steps[0]);
  assert.equal(store.getState().setSurfaceEffect('L1', step.id, createDefaultSurfaceEffectPayloadV7('mirror')).ok, true);
  assert.equal(store.getState().doc.revision, baseRevision + 1);
  assert.equal(store.getState().history.length, 1);
  assert.equal(store.getState().doc.nails.L1.compositionProvenance.syncState, 'detached');
  assert.deepEqual(store.getState().doc.nails.L1.steps[0], beforeBackground);
  assert.equal(store.getState().setSurfaceEffectMask('L1', step.id, createSurfaceEffectMaskV7('tip')).ok, true);
  assert.equal(store.getState().doc.revision, baseRevision + 2);
  assert.equal(store.getState().history.length, 2);
  const autosave = [...timers.tasks.values()].at(-1);
  assert.equal(typeof autosave, 'function');
  autosave();
  for (let attempt = 0; attempt < 20 && store.getState().revisionState.pendingRevision !== null; attempt += 1) await new Promise((resolve) => setImmediate(resolve));
  assert.equal(storage.writes, 1);
  assert.equal(store.getState().undo().ok, true);
  assert.equal(store.getState().redo().ok, true);
  assert.equal(await store.getState().save(), 'saved');
  assert.equal(store.getState().reloadFromStorage(), 'ok');
  assert.equal(store.getState().doc.nails.L1.steps.find((candidate) => candidate.id === step.id).effect.effectType, 'mirror');
  store.setState({ readOnly: true });
  const frozenRevision = store.getState().doc.revision;
  assert.equal(store.getState().setSurfaceEffect('L1', step.id, createDefaultSurfaceEffectPayloadV7('glitter')).reason, 'read_only');
  assert.equal(store.getState().doc.revision, frozenRevision);
  store.setState({ readOnly: false, switching: true });
  assert.equal(store.getState().setSurfaceEffectMask('L1', step.id, createSurfaceEffectMaskV7('full')).reason, 'busy');
  assert.equal(store.getState().doc.revision, frozenRevision);
  console.log('[v7-surface-effect] store transaction, persistence, detach and gates: PASS');
}

console.log('[v7-surface-effect] all checks passed');
