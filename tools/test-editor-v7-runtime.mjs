import { strict as assert } from 'node:assert';
import {
  createFullEditorDocV7Fixture,
  createMinimalEditorDocV7Fixture,
} from '../src/studio/editor/fixtures/editor-doc-v7.mjs';
import { createEditorDocV6MigrationFixture } from '../src/studio/editor/fixtures/editor-doc-v7-migration.mjs';
import { createEditorDocV7Repository } from '../src/studio/editor/v7/repository.ts';
import { createEditorV7Store } from '../src/studio/editor/store-v7.ts';

const resolvers = { resolveGeometry: () => null, resolveFinishPreset: () => null };
const migrationResolvers = {
  resolveGeometry: ({ shape, length, finger }) => ({
    assetId: `geometry.${shape}.${length}.${finger}`,
    revision: 'registry-1',
  }),
  resolveFinishPreset: ({ finishType }) => ({
    id: `preset.finish.${finishType}`,
    revision: 'registry-1',
  }),
};
const clone = (value) => structuredClone(value);
const saveContext = (raw, sourceVersion = 7, userEdited = true) => ({
  sourceVersion,
  userEdited,
  expectedStoredRevision: sourceVersion === 7 ? raw.revision : null,
  expectedSourceToken: JSON.stringify(raw),
});

class MemoryStorage {
  constructor(docs = {}) { this.docs = clone(docs); }
  fail = false;
  writes = 0;
  read = () => clone(this.docs);
  write = async (next) => {
    if (this.fail) throw new Error('injected write failure');
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
  latest() { return [...this.tasks.keys()].at(-1); }
  async invoke(id, includeCleared = false) {
    const task = this.tasks.get(id);
    assert.ok(task, `timer ${id} exists`);
    if (task.cleared && !includeCleared) return;
    task.callback();
    await Promise.resolve();
    await Promise.resolve();
  }
}

function docWithId(id, full = false) {
  const doc = full ? createFullEditorDocV7Fixture() : createMinimalEditorDocV7Fixture();
  doc.designId = id;
  return doc;
}

function runtime(docs, overrides = {}) {
  const storage = new MemoryStorage(docs);
  const timers = new FakeTimers();
  let id = 0;
  const repository = createEditorDocV7Repository(storage, resolvers);
  const store = createEditorV7Store({
    repository,
    now: () => '2026-08-08T00:00:00.000Z',
    idFactory: (prefix) => `${prefix}.runtime.${++id}`,
    setTimeout: timers.setTimeout,
    clearTimeout: timers.clearTimeout,
    autosaveDelayMs: 25,
    ...overrides,
  });
  return { storage, timers, repository, store };
}

// A legacy document is migrated only in memory; only a user edit plus save replaces the source.
{
  const legacy = createEditorDocV6MigrationFixture();
  const storage = new MemoryStorage({ [legacy.designId]: legacy });
  const repository = createEditorDocV7Repository(storage, migrationResolvers);
  const { store } = runtime({}, { repository });
  assert.equal(await store.getState().load(legacy.designId), 'ok');
  assert.equal(store.getState().doc.schemaVersion, 7);
  assert.equal(storage.docs[legacy.designId].schemaVersion, 6);
  assert.equal(storage.writes, 0);
  store.getState().setTitle('Explicit V7 edit');
  assert.equal(await store.getState().save(), 'saved');
  assert.equal(storage.docs[legacy.designId].schemaVersion, 7);
  assert.equal(storage.docs[legacy.designId].title, 'Explicit V7 edit');
  console.log('[v7-runtime] pure legacy load and explicit V7 replacement: PASS');
}

// Identity load is read-only with respect to storage; invalid/future/missing never replace state.
{
  const valid = docWithId('design.runtime.load');
  const invalid = { schemaVersion: 7, designId: 'design.runtime.invalid' };
  const future = { schemaVersion: 8, designId: 'design.runtime.future' };
  const { storage, store } = runtime({ [valid.designId]: valid, [invalid.designId]: invalid, [future.designId]: future });
  assert.equal(await store.getState().load(valid.designId), 'ok');
  assert.equal(storage.writes, 0);
  assert.equal(await store.getState().load('missing'), 'missing');
  assert.equal(await store.getState().load(invalid.designId), 'invalid');
  assert.equal(await store.getState().load(future.designId), 'unsupported');
  assert.equal(store.getState().designId, valid.designId);
  assert.equal(storage.writes, 0);
  console.log('[v7-runtime] load matrix and pure read: PASS');
}

// One command means one revision, one history entry, and one autosave intent; failed commands are atomic.
{
  const doc = docWithId('design.runtime.atomic', true);
  const { store, timers } = runtime({ [doc.designId]: doc });
  await store.getState().load(doc.designId);
  const before = clone(store.getState().doc);
  assert.equal(store.getState().setTitle('Runtime title').ok, true);
  assert.equal(store.getState().doc.revision, before.revision + 1);
  assert.equal(store.getState().history.length, 1);
  assert.equal(store.getState().revisionState.pendingRevision, before.revision + 1);
  assert.equal(timers.tasks.get(timers.latest()).delay, 25);
  const after = clone(store.getState().doc);
  const background = after.nails.L1.steps[0];
  const rejected = store.getState().deleteStep('L1', background.id);
  assert.deepEqual(rejected, { ok: false, reason: 'not_allowed', message: 'step cannot be deleted' });
  assert.deepEqual(store.getState().doc, after);
  assert.equal(store.getState().history.length, 1);
  console.log('[v7-runtime] atomic command/revision/history: PASS');
}

// Background/finish gates and middle-step arbitrary interleaving are enforced in the store layer.
{
  const doc = docWithId('design.runtime.steps', true);
  const { store } = runtime({ [doc.designId]: doc });
  await store.getState().load(doc.designId);
  const steps = store.getState().doc.nails.L1.steps;
  const background = steps[0];
  const finish = steps.at(-1);
  const flat = steps.find((step) => step.kind === 'flat_design');
  const effect = steps.find((step) => step.kind === 'surface_effect');
  assert.equal(store.getState().setStepFlag('L1', background.id, 'skipped', true).ok, false);
  assert.equal(store.getState().duplicateStep('L1', finish.id).ok, false);
  assert.equal(store.getState().setStepFlag('L1', finish.id, 'visible', false).ok, false);
  assert.equal(store.getState().moveStep('L1', finish.id, 1).ok, false);
  const oldIndex = store.getState().doc.nails.L1.steps.findIndex((step) => step.id === effect.id);
  assert.equal(store.getState().moveStep('L1', effect.id, 1).ok, true);
  assert.equal(store.getState().doc.nails.L1.steps[1].id, effect.id);
  assert.equal(store.getState().doc.nails.L1.steps[0].kind, 'background');
  assert.equal(store.getState().doc.nails.L1.steps.at(-1).kind, 'surface_finish');
  assert.notEqual(oldIndex, 1);
  assert.equal(store.getState().setStepFlag('L1', flat.id, 'skipped', true).ok, true);
  const skipped = store.getState().doc.nails.L1.steps.find((step) => step.id === flat.id);
  assert.equal(skipped.skipped, true);
  assert.equal(skipped.visible, true);
  assert.equal(store.getState().setStepFlag('L1', flat.id, 'visible', false).ok, true);
  const hidden = store.getState().doc.nails.L1.steps.find((step) => step.id === flat.id);
  assert.equal(hidden.skipped, true);
  assert.equal(hidden.visible, false);
  console.log('[v7-runtime] canonical step invariants and independent flags: PASS');
}

// Duplicate IDs, locked steps/elements, and incompatible element kinds are rejected.
{
  const doc = docWithId('design.runtime.elements', true);
  const { store } = runtime({ [doc.designId]: doc });
  await store.getState().load(doc.designId);
  const flat = store.getState().doc.nails.L1.steps.find((step) => step.kind === 'flat_design');
  const element = flat.elements.find((item) => !item.locked);
  const decorationStep = store.getState().doc.nails.L1.steps.find((step) => step.kind === 'dimensional_decoration');
  const incompatible = clone(decorationStep.decorations[0]);
  incompatible.id = 'element.runtime.incompatible';
  assert.equal(store.getState().addElement('L1', flat.id, incompatible).reason, 'not_allowed');
  const nestedDuplicate = clone(flat);
  nestedDuplicate.id = 'step.runtime.nested-duplicate';
  assert.equal(store.getState().addStep('R1', nestedDuplicate, 1).reason, 'duplicate_id');
  assert.equal(store.getState().addElement('L1', flat.id, clone(element)).reason, 'duplicate_id');
  assert.equal(store.getState().setElementFlag('L1', flat.id, element.id, 'locked', true).ok, true);
  assert.equal(store.getState().removeElement('L1', flat.id, element.id).reason, 'locked');
  assert.equal(store.getState().setElementFlag('L1', flat.id, element.id, 'locked', false).ok, true);
  assert.equal(store.getState().removeElement('L1', flat.id, element.id).ok, true);
  assert.equal(store.getState().setStepFlag('L1', flat.id, 'locked', true).ok, true);
  assert.equal(store.getState().deleteStep('L1', flat.id).reason, 'locked');
  console.log('[v7-runtime] ID and lock gates: PASS');
}

// An edit made while a save is in flight is automatically scheduled again after completion.
{
  const doc = docWithId('design.runtime.followup');
  const storage = new MemoryStorage({ [doc.designId]: doc });
  let resolveFirst;
  let first = true;
  storage.write = async (next) => {
    if (first) {
      first = false;
      await new Promise((resolve) => { resolveFirst = resolve; });
    }
    storage.docs = clone(next);
    storage.writes += 1;
  };
  const repository = createEditorDocV7Repository(storage, resolvers);
  const { store, timers } = runtime({}, { repository });
  await store.getState().load(doc.designId);
  store.getState().setTitle('revision two');
  const firstSave = store.getState().save();
  store.getState().setTitle('revision three');
  const busyTimer = timers.latest();
  await timers.invoke(busyTimer);
  assert.equal(store.getState().saveState, 'saving');
  resolveFirst();
  assert.equal(await firstSave, 'saved');
  const followupTimer = timers.latest();
  assert.notEqual(followupTimer, busyTimer);
  await timers.invoke(followupTimer);
  for (let index = 0; index < 8; index += 1) await Promise.resolve();
  assert.equal(storage.docs[doc.designId].title, 'revision three');
  assert.equal(store.getState().saveState, 'saved');
  console.log('[v7-runtime] in-flight edit follow-up autosave: PASS');
}

// Read-only blocks document commands, history, and writes while local selection remains available.
{
  const doc = docWithId('design.runtime.readonly');
  const { store, storage } = runtime({ [doc.designId]: doc });
  await store.getState().load(doc.designId, { readOnly: true });
  const before = clone(store.getState().doc);
  assert.equal(store.getState().setTitle('blocked').reason, 'read_only');
  assert.equal(store.getState().undo().reason, 'read_only');
  store.getState().setCurrentFinger('L2');
  assert.equal(store.getState().currentFinger, 'L2');
  assert.equal(await store.getState().save(), 'read_only');
  assert.deepEqual(store.getState().doc, before);
  assert.equal(storage.writes, 0);
  console.log('[v7-runtime] read-only permission boundary: PASS');
}

// Undo/redo use monotonically increasing revisions and a new edit clears redo.
{
  const doc = docWithId('design.runtime.history');
  const { store } = runtime({ [doc.designId]: doc });
  await store.getState().load(doc.designId);
  const base = store.getState().doc.revision;
  store.getState().setTitle('one');
  store.getState().setTitle('two');
  assert.equal(store.getState().undo().ok, true);
  assert.equal(store.getState().doc.title, 'one');
  assert.equal(store.getState().doc.revision, base + 3);
  assert.equal(store.getState().redo().ok, true);
  assert.equal(store.getState().doc.title, 'two');
  assert.equal(store.getState().doc.revision, base + 4);
  store.getState().undo();
  store.getState().setTitle('branch');
  assert.equal(store.getState().future.length, 0);
  console.log('[v7-runtime] monotonic undo/redo and branch clearing: PASS');
}

// First-step creation, history replacement, and deletion always retain a valid selection.
{
  const doc = docWithId('design.runtime.selection-repair');
  const source = createFullEditorDocV7Fixture();
  const flat = clone(source.nails.L1.steps.find((step) => step.kind === 'flat_design'));
  const { store } = runtime({ [doc.designId]: doc });
  await store.getState().load(doc.designId);
  store.getState().setCurrentFinger('L1');
  const initialBackgroundId = store.getState().doc.nails.L1.steps[0].id;
  const finishIndex = store.getState().doc.nails.L1.steps.length - 1;
  assert.equal(store.getState().addStep('L1', flat, finishIndex).ok, true);
  assert.equal(store.getState().selectedStepId, flat.id);
  assert.equal(store.getState().undo().ok, true);
  assert.equal(store.getState().selectedStepId, initialBackgroundId);
  assert.equal(store.getState().selectedElementId, null);
  assert.equal(store.getState().redo().ok, true);
  assert.ok(store.getState().doc.nails.L1.steps.some((step) => step.id === store.getState().selectedStepId));

  const full = docWithId('design.runtime.selection-delete', true);
  const second = runtime({ [full.designId]: full });
  await second.store.getState().load(full.designId);
  second.store.getState().setCurrentFinger('L1');
  const beforeSteps = second.store.getState().doc.nails.L1.steps;
  const selectedIndex = beforeSteps.findIndex((step) => step.kind === 'surface_effect');
  const selected = beforeSteps[selectedIndex];
  const expectedAdjacentId = beforeSteps[selectedIndex + 1].id;
  second.store.getState().selectStep(selected.id);
  assert.equal(second.store.getState().deleteStep('L1', selected.id).ok, true);
  assert.equal(second.store.getState().selectedStepId, expectedAdjacentId);
  assert.equal(second.store.getState().selectedElementId, null);

  const crossFinger = docWithId('design.runtime.selection-cross-finger', true);
  const third = runtime({ [crossFinger.designId]: crossFinger });
  await third.store.getState().load(crossFinger.designId);
  third.store.getState().setCurrentFinger('L1');
  const currentFinish = third.store.getState().doc.nails.L1.steps.at(-1);
  third.store.getState().selectStep(currentFinish.id);
  const remoteSource = createFullEditorDocV7Fixture();
  const remoteFlat = clone(remoteSource.nails.L1.steps.find((step) => step.kind === 'flat_design'));
  remoteFlat.id = 'step.L2.cross-finger-added';
  for (const [index, element] of remoteFlat.elements.entries()) element.id = `element.L2.cross-finger-added.${index}`;
  const remoteFinishIndex = third.store.getState().doc.nails.L2.steps.length - 1;
  assert.equal(third.store.getState().addStep('L2', remoteFlat, remoteFinishIndex).ok, true);
  assert.equal(third.store.getState().currentFinger, 'L1');
  assert.equal(third.store.getState().selectedStepId, currentFinish.id);
  const remoteElement = clone(remoteFlat.elements[0]);
  remoteElement.id = 'element.L2.cross-finger-extra';
  const existingRemoteFlat = third.store.getState().doc.nails.L2.steps.find((step) => step.kind === 'flat_design');
  assert.equal(third.store.getState().addElement('L2', existingRemoteFlat.id, remoteElement).ok, true);
  assert.equal(third.store.getState().selectedStepId, currentFinish.id);
  assert.equal(third.store.getState().duplicateStep('L2', existingRemoteFlat.id).ok, true);
  assert.equal(third.store.getState().selectedStepId, currentFinish.id);
  console.log('[v7-runtime] first-step undo/redo and adjacent delete selection repair: PASS');
}

// Failed save retains dirty state; explicit retry persists the exact revision.
{
  const doc = docWithId('design.runtime.retry');
  const { store, storage } = runtime({ [doc.designId]: doc });
  await store.getState().load(doc.designId);
  store.getState().setTitle('retry me');
  storage.fail = true;
  assert.equal(await store.getState().save(), 'error');
  assert.equal(store.getState().saveState, 'error');
  assert.notEqual(store.getState().revisionState.pendingRevision, null);
  storage.fail = false;
  assert.equal(await store.getState().retrySave(), 'saved');
  assert.equal(store.getState().saveState, 'saved');
  assert.equal(storage.docs[doc.designId].title, 'retry me');
  console.log('[v7-runtime] save failure and retry: PASS');
}

// Switching designs flushes A, clears its timer, and a forced stale callback cannot write B.
{
  const a = docWithId('design.runtime.a');
  const b = docWithId('design.runtime.b');
  const { store, storage, timers } = runtime({ [a.designId]: a, [b.designId]: b });
  await store.getState().load(a.designId);
  store.getState().setTitle('A saved before switch');
  const timerA = timers.latest();
  assert.equal(await store.getState().load(b.designId), 'ok');
  assert.equal(storage.docs[a.designId].title, 'A saved before switch');
  const writesAfterSwitch = storage.writes;
  await timers.invoke(timerA, true);
  assert.equal(storage.writes, writesAfterSwitch);
  assert.equal(storage.docs[b.designId].title, b.title);
  console.log('[v7-runtime] cross-design timer guard: PASS');
}

// A document switch is an exclusive transition: edits cannot appear after the flushed revision.
{
  const a = docWithId('design.runtime.switch-a', true);
  const b = docWithId('design.runtime.switch-b');
  const storage = new MemoryStorage({ [a.designId]: a, [b.designId]: b });
  let resolveWrite;
  storage.write = (next) => new Promise((resolve) => {
    resolveWrite = () => { storage.docs = clone(next); storage.writes += 1; resolve(); };
  });
  const repository = createEditorDocV7Repository(storage, resolvers);
  const { store } = runtime({}, { repository });
  await store.getState().load(a.designId);
  store.getState().setTitle('saved before exclusive switch');
  const selectedFlat = store.getState().doc.nails.L1.steps.find((step) => step.kind === 'flat_design');
  store.getState().selectStep(selectedFlat.id);
  assert.equal(store.getState().deleteStep('L1', selectedFlat.id).ok, true);
  assert.notEqual(store.getState().selectedStepId, selectedFlat.id);
  const switching = store.getState().load(b.designId);
  assert.equal(store.getState().switching, true);
  assert.equal(store.getState().setTitle('must be rejected').reason, 'busy');
  assert.equal(store.getState().undo().reason, 'busy');
  for (let index = 0; index < 8 && !resolveWrite; index += 1) await Promise.resolve();
  assert.equal(typeof resolveWrite, 'function');
  resolveWrite();
  assert.equal(await switching, 'ok');
  assert.equal(store.getState().designId, b.designId);
  assert.equal(store.getState().switching, false);
  assert.equal(storage.docs[a.designId].title, 'saved before exclusive switch');
  console.log('[v7-runtime] exclusive async switch and selection repair: PASS');
}

// Reload is blocked while a save is in flight, preventing memory/storage divergence.
{
  const doc = docWithId('design.runtime.stale');
  const storage = new MemoryStorage({ [doc.designId]: doc });
  let resolveWrite;
  storage.write = (next) => new Promise((resolve) => {
    resolveWrite = () => { storage.docs = clone(next); storage.writes += 1; resolve(); };
  });
  const repository = createEditorDocV7Repository(storage, resolvers);
  const { store } = runtime({}, { repository });
  await store.getState().load(doc.designId);
  store.getState().setTitle('in flight');
  const saving = store.getState().save();
  assert.equal(store.getState().saveState, 'saving');
  assert.equal(await store.getState().save(), 'busy');
  const generation = store.getState().generation;
  assert.equal(store.getState().reloadFromStorage(), 'busy');
  assert.equal(store.getState().generation, generation);
  assert.equal(store.getState().doc.title, 'in flight');
  resolveWrite();
  assert.equal(await saving, 'saved');
  assert.equal(store.getState().doc.title, 'in flight');
  assert.equal(storage.docs[doc.designId].title, 'in flight');
  assert.equal(store.getState().saveState, 'saved');
  console.log('[v7-runtime] in-flight reload guard: PASS');
}

// Repository rejects key mismatch, invalid docs, legacy implicit replacement, and stale revisions.
{
  const doc = docWithId('design.runtime.repo');
  doc.revision = 4;
  const storage = new MemoryStorage({ [doc.designId]: doc, legacy: { schemaVersion: 6, designId: 'legacy' } });
  const repository = createEditorDocV7Repository(storage, resolvers);
  assert.equal((await repository.save('wrong', doc, saveContext(doc))).reason, 'storage_key_mismatch');
  const invalid = clone(doc); invalid.nails.L1.steps.pop();
  assert.equal((await repository.save(doc.designId, invalid, saveContext(doc))).reason, 'invalid_document');
  const legacyTarget = clone(doc); legacyTarget.designId = 'legacy';
  assert.equal((await repository.save('legacy', legacyTarget, saveContext(storage.docs.legacy, 6, false))).reason, 'source_not_editable');
  const stale = clone(doc); stale.revision = 3;
  assert.equal((await repository.save(doc.designId, stale, saveContext(doc))).reason, 'stale_revision');
  const sameRevisionDifferentContent = clone(doc); sameRevisionDifferentContent.title = 'conflicting content';
  assert.equal((await repository.save(doc.designId, sameRevisionDifferentContent, saveContext(doc))).reason, 'stale_revision');
  const futureStorage = new MemoryStorage({ future: { schemaVersion: 8, designId: 'future' } });
  const futureRepository = createEditorDocV7Repository(futureStorage, migrationResolvers);
  const forgedLegacyContext = clone(doc); forgedLegacyContext.designId = 'future';
  assert.equal((await futureRepository.save('future', forgedLegacyContext, saveContext(futureStorage.docs.future, 6, true))).reason, 'source_not_editable');
  assert.equal(storage.writes, 0);
  console.log('[v7-runtime] repository writer guards: PASS');
}

// Repository serialization preserves concurrent saves to different designs and CAS rejects stale branches.
{
  const a = docWithId('design.runtime.concurrent-a');
  const b = docWithId('design.runtime.concurrent-b');
  const storage = new MemoryStorage({ [a.designId]: a, [b.designId]: b });
  const pending = [];
  storage.write = (next) => new Promise((resolve) => {
    pending.push(() => { storage.docs = clone(next); storage.writes += 1; resolve(); });
  });
  const repository = createEditorDocV7Repository(storage, resolvers);
  const nextA = clone(a); nextA.title = 'A2'; nextA.revision += 1;
  const nextB = clone(b); nextB.title = 'B2'; nextB.revision += 1;
  const saveA = repository.save(a.designId, nextA, saveContext(a));
  const saveB = repository.save(b.designId, nextB, saveContext(b));
  await Promise.resolve();
  assert.equal(pending.length, 1);
  pending.shift()();
  assert.equal((await saveA).ok, true);
  await Promise.resolve();
  assert.equal(pending.length, 1);
  pending.shift()();
  assert.equal((await saveB).ok, true);
  assert.equal(storage.docs[a.designId].title, 'A2');
  assert.equal(storage.docs[b.designId].title, 'B2');

  const branchBase = clone(storage.docs[a.designId]);
  const accepted = clone(branchBase); accepted.title = 'accepted'; accepted.revision += 1;
  storage.write = async (next) => { storage.docs = clone(next); storage.writes += 1; };
  assert.equal((await repository.save(a.designId, accepted, saveContext(branchBase))).ok, true);
  const staleHighRevision = clone(branchBase); staleHighRevision.title = 'stale branch'; staleHighRevision.revision += 2;
  assert.equal((await repository.save(a.designId, staleHighRevision, saveContext(branchBase))).reason, 'stale_revision');
  assert.equal(storage.docs[a.designId].title, 'accepted');
  console.log('[v7-runtime] serialized map writes and source CAS: PASS');
}

console.log('[v7-runtime] all behavior checks passed');
