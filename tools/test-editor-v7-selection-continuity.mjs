import { strict as assert } from 'node:assert';
import { createMinimalEditorDocV7Fixture } from '../src/studio/editor/fixtures/editor-doc-v7.mjs';
import { createEditorV7Store } from '../src/studio/editor/store-v7.ts';
import { createEditorDocV7Repository } from '../src/studio/editor/v7/repository.ts';
import { parseEditorDocV7 } from '../src/studio/editor/v7/schema.ts';
import { resolveSelectionContinuityV7 } from '../src/studio/editor/v7/workspace-ia.ts';

const clone = (value) => structuredClone(value);
const color = { colorSpace: 'srgb', r: 205, g: 54, b: 102, a: 1 };

function brush(id) {
  return {
    id,
    kind: 'brush_stroke',
    visible: true,
    locked: false,
    opacity: 1,
    transform: { position: { u: 0.5, v: 0.5 }, scaleX: 1, scaleY: 1, rotationDeg: 0 },
    points: [{ u: 0.2, v: 0.2 }, { u: 0.8, v: 0.8 }],
    color,
    widthMm: 0.4,
  };
}

function flat(finger, ordinal, flags = {}) {
  return {
    id: `step.${finger}.flat.${ordinal}`,
    typeId: 'builtin.v7.flat_design',
    kind: 'flat_design',
    name: `平面设计 ${ordinal}`,
    visible: flags.visible ?? true,
    locked: flags.locked ?? false,
    skipped: flags.skipped ?? false,
    materialRefs: [],
    elements: [brush(`element.${finger}.flat.${ordinal}.brush`)],
  };
}

function effect(finger, ordinal, flags = {}) {
  return {
    id: `step.${finger}.effect.${ordinal}`,
    typeId: 'builtin.v7.surface_effect',
    kind: 'surface_effect',
    name: `表面效果 ${ordinal}`,
    visible: flags.visible ?? true,
    locked: flags.locked ?? false,
    skipped: flags.skipped ?? false,
    materialRefs: [],
    effect: {
      effectType: 'mirror',
      tint: color,
      reflectance: 0.72,
      previewFidelity: 'approximate',
    },
    mask: {
      coordinateSpace: 'nail-local-v1',
      pathData: 'M0.1 0.1 L0.9 0.1 L0.9 0.9 Z',
      fillRule: 'nonzero',
      inverted: false,
    },
  };
}

function createContinuityDoc() {
  const doc = createMinimalEditorDocV7Fixture();
  doc.designId = 'design.v7.selection-continuity';
  const withCanonicalEnds = (finger, middle) => {
    const nail = doc.nails[finger];
    nail.steps = [nail.steps[0], ...middle, nail.steps.at(-1)];
  };
  withCanonicalEnds('R4', [flat('R4', 1), effect('R4', 1), flat('R4', 2), effect('R4', 2)]);
  withCanonicalEnds('R5', [effect('R5', 1), flat('R5', 1), effect('R5', 2, {
    visible: false,
    locked: true,
    skipped: true,
  }), flat('R5', 2)]);
  withCanonicalEnds('L2', [flat('L2', 1)]);
  const parsed = parseEditorDocV7(doc);
  assert.equal(parsed.ok, true, parsed.ok ? '' : parsed.reason);
  return parsed.doc;
}

class MemoryStorage {
  constructor(docs) {
    this.docs = clone(docs);
    this.writes = 0;
  }
  read = () => clone(this.docs);
  write = async (next) => {
    this.writes += 1;
    this.docs = clone(next);
  };
}

class FakeTimers {
  nextId = 1;
  tasks = new Map();
  setTimeout = (callback, delay) => {
    const id = this.nextId++;
    this.tasks.set(id, { callback, delay, cleared: false });
    return id;
  };
  clearTimeout = (id) => {
    const task = this.tasks.get(id);
    if (task) task.cleared = true;
  };
}

const resolvers = { resolveGeometry: () => null, resolveFinishPreset: () => null };

// The pure resolver maps exact kind+ordinal across interleaved steps and never
// substitutes a nearby sibling when the ordinal is missing.
{
  const doc = createContinuityDoc();
  const source = doc.nails.R4;
  const target = doc.nails.R5;
  const beforeSource = clone(source);
  const beforeTarget = clone(target);
  const sourceFlat2 = source.steps.find((step) => step.id === 'step.R4.flat.2');
  const sourceEffect2 = source.steps.find((step) => step.id === 'step.R4.effect.2');
  const targetEffect2 = target.steps.find((step) => step.id === 'step.R5.effect.2');

  assert.deepEqual(resolveSelectionContinuityV7(source, target, source.steps[0].id), {
    selectedStepId: target.steps[0].id,
    exact: true,
  });
  assert.deepEqual(resolveSelectionContinuityV7(source, target, source.steps.at(-1).id), {
    selectedStepId: target.steps.at(-1).id,
    exact: true,
  });
  assert.deepEqual(resolveSelectionContinuityV7(source, target, sourceFlat2.id), {
    selectedStepId: 'step.R5.flat.2',
    exact: true,
  });
  assert.deepEqual(resolveSelectionContinuityV7(source, target, sourceEffect2.id), {
    selectedStepId: targetEffect2.id,
    exact: true,
  });
  assert.deepEqual(
    { visible: targetEffect2.visible, locked: targetEffect2.locked, skipped: targetEffect2.skipped },
    { visible: false, locked: true, skipped: true },
  );
  assert.deepEqual(resolveSelectionContinuityV7(source, doc.nails.L2, sourceFlat2.id), {
    selectedStepId: doc.nails.L2.steps[0].id,
    exact: false,
  });
  assert.deepEqual(resolveSelectionContinuityV7(source, target, 'missing-step'), {
    selectedStepId: target.steps[0].id,
    exact: false,
  });
  assert.deepEqual(resolveSelectionContinuityV7(source, target, null), {
    selectedStepId: target.steps[0].id,
    exact: false,
  });
  assert.deepEqual(source, beforeSource);
  assert.deepEqual(target, beforeTarget);
  console.log('[v7-selection-continuity] pure exact ordinal mapping and safe fallback: PASS');
}

// Finger switches only change runtime selection. Same-finger activation is a
// no-op; cross-finger activation clears nested element selection and never
// touches canonical data, revision/history/autosave or storage.
{
  const doc = createContinuityDoc();
  const storage = new MemoryStorage({ [doc.designId]: doc });
  const timers = new FakeTimers();
  const repository = createEditorDocV7Repository(storage, resolvers);
  const store = createEditorV7Store({
    repository,
    now: () => '2026-08-11T10:00:00.000Z',
    setTimeout: timers.setTimeout,
    clearTimeout: timers.clearTimeout,
    autosaveDelayMs: 25,
  });
  assert.equal(await store.getState().load(doc.designId), 'ok');
  store.getState().selectStep('step.R4.flat.2');
  store.getState().selectElement('element.R4.flat.2.brush');

  const invariant = {
    doc: clone(store.getState().doc),
    sourceToken: store.getState().sourceToken,
    history: clone(store.getState().history),
    future: clone(store.getState().future),
    saveState: store.getState().saveState,
    revisionState: clone(store.getState().revisionState),
    autosaveTimer: store.getState().autosaveTimer,
    generation: store.getState().generation,
    timerCount: timers.tasks.size,
    writes: storage.writes,
  };

  assert.deepEqual(store.getState().setCurrentFinger('R4'), {
    finger: 'R4',
    stepId: 'step.R4.flat.2',
    exact: true,
  });
  assert.equal(store.getState().selectedElementId, 'element.R4.flat.2.brush');

  assert.deepEqual(store.getState().setCurrentFinger('R5'), {
    finger: 'R5',
    stepId: 'step.R5.flat.2',
    exact: true,
  });
  assert.equal(store.getState().selectedElementId, null);
  assert.equal(store.getState().selectedStepId, 'step.R5.flat.2');

  store.getState().setCurrentFinger('R4');
  store.getState().selectStep('step.R4.flat.2');
  assert.deepEqual(store.getState().setCurrentFinger('L2'), {
    finger: 'L2',
    stepId: doc.nails.L2.steps[0].id,
    exact: false,
  });
  assert.equal(store.getState().selectedStepId, doc.nails.L2.steps[0].id);

  const after = store.getState();
  assert.deepEqual(after.doc, invariant.doc);
  assert.equal(after.sourceToken, invariant.sourceToken);
  assert.deepEqual(after.history, invariant.history);
  assert.deepEqual(after.future, invariant.future);
  assert.equal(after.saveState, invariant.saveState);
  assert.deepEqual(after.revisionState, invariant.revisionState);
  assert.equal(after.autosaveTimer, invariant.autosaveTimer);
  assert.equal(after.generation, invariant.generation);
  assert.equal(timers.tasks.size, invariant.timerCount);
  assert.equal(storage.writes, invariant.writes);
  console.log('[v7-selection-continuity] store switch is writer-zero and clears nested selection: PASS');

  // A storage reload repairs a now-dangling step/element selection without a
  // canonical write or a phantom history entry.
  store.getState().setCurrentFinger('R4');
  store.getState().selectStep('step.R4.flat.2');
  store.getState().selectElement('element.R4.flat.2.brush');
  const replacement = clone(doc);
  replacement.nails.R4.steps = [replacement.nails.R4.steps[0], replacement.nails.R4.steps.at(-1)];
  replacement.revision += 1;
  replacement.updatedAt = '2026-08-11T10:01:00.000Z';
  assert.equal(parseEditorDocV7(replacement).ok, true);
  storage.docs[doc.designId] = replacement;
  assert.equal(store.getState().reloadFromStorage(), 'ok');
  assert.equal(store.getState().currentFinger, 'R4');
  assert.equal(store.getState().selectedStepId, replacement.nails.R4.steps[0].id);
  assert.equal(store.getState().selectedElementId, null);
  assert.equal(store.getState().history.length, 0);
  assert.equal(store.getState().future.length, 0);
  assert.equal(store.getState().saveState, 'saved');
  assert.equal(store.getState().autosaveTimer, null);
  assert.equal(storage.writes, invariant.writes);
  console.log('[v7-selection-continuity] reload repairs dangling runtime selection without writes: PASS');
}

console.log('[v7-selection-continuity] all checks passed');
