/**
 * PR-04 behavior tests for the real EditorDocV6 Zustand store and repository.
 * Uses an in-memory localStorage and deterministic timers; no source-text checks.
 */

import { strict as assert } from 'node:assert';

class MemoryLocalStorage {
  #data = new Map();
  failAllWrites = false;
  failWriteKeys = new Set();

  get length() { return this.#data.size; }
  key(index) { return [...this.#data.keys()][index] ?? null; }
  getItem(key) { return this.#data.get(String(key)) ?? null; }
  removeItem(key) { this.#data.delete(String(key)); }
  clear() { this.#data.clear(); }
  setItem(key, value) {
    const normalizedKey = String(key);
    if (this.failAllWrites || this.failWriteKeys.has(normalizedKey)) {
      throw new Error(`Injected localStorage write failure: ${normalizedKey}`);
    }
    this.#data.set(normalizedKey, String(value));
  }
}

class FakeTimers {
  #nextId = 1;
  #tasks = new Map();

  setTimeout = (callback, delay = 0) => {
    const id = this.#nextId++;
    this.#tasks.set(id, { callback, delay, cleared: false, invoked: false });
    return id;
  };

  clearTimeout = (id) => {
    const task = this.#tasks.get(id);
    if (task) task.cleared = true;
  };

  reset() {
    this.#tasks.clear();
  }

  latestId() {
    const ids = [...this.#tasks.keys()];
    return ids.at(-1) ?? null;
  }

  task(id) {
    return this.#tasks.get(id);
  }

  async invoke(id, { includeCleared = false } = {}) {
    const task = this.#tasks.get(id);
    assert.ok(task, `timer ${id} must exist`);
    if (task.cleared && !includeCleared) return false;
    task.invoked = true;
    task.callback();
    await Promise.resolve();
    return true;
  }
}

const storage = new MemoryLocalStorage();
const timers = new FakeTimers();
globalThis.localStorage = storage;
globalThis.setTimeout = timers.setTimeout;
globalThis.clearTimeout = timers.clearTimeout;

const { createEmptyEditorDocV6 } = await import('../src/studio/editor/v6/model.ts');
const {
  getDesign,
  getEditorDocV6Result,
  saveEditorDocV6ToLocalStorage,
  upsertDesign,
} = await import('../src/studio/editor/lib/repo-v6.ts');
const { AUTOSAVE_DEBOUNCE_MS } = await import('../src/studio/editor/lib/autosave-v6.ts');
const { useEditorV6Store } = await import('../src/studio/editor/store-v6.ts');

const EDITOR_DOCS_KEY = 'nail-studio:editor.docs';
const DESIGNS_KEY = 'nail-studio:designs';

function seedDesign(designId, opts = {}) {
  const doc = createEmptyEditorDocV6({
    designId,
    title: opts.title ?? `Design ${designId}`,
    baseColor: opts.baseColor ?? '#F4E9E3',
  });
  assert.equal(saveEditorDocV6ToLocalStorage(doc).status, 'ok');
  upsertDesign({
    id: designId,
    customerId: '',
    title: doc.title,
    shape: doc.defaultGeometry.shape,
    length: doc.defaultGeometry.length,
    baseColor: opts.baseColor ?? '#F4E9E3',
    finish: 'gloss',
    status: 'draft',
    source: 'editor',
    version: 1,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  });
  return doc;
}

function persistedDoc(designId) {
  const result = getEditorDocV6Result(designId);
  assert.equal(result.status, 'ok', `expected persisted V6 doc ${designId}`);
  return result.doc;
}

function resetRuntime() {
  const currentTimer = useEditorV6Store.getState().autosaveTimer;
  if (currentTimer) timers.clearTimeout(currentTimer);
  useEditorV6Store.setState({
    designId: null,
    status: null,
    doc: null,
    readOnly: false,
    history: [],
    future: [],
    saveState: 'saved',
    autosave: { revision: 0, lastSavedRevision: 0, pendingRevision: null },
    autosaveTimer: null,
  });
  storage.failAllWrites = false;
  storage.failWriteKeys.clear();
  storage.clear();
  timers.reset();
}

function addInvalidStoredDoc(designId) {
  const envelope = JSON.parse(storage.getItem(EDITOR_DOCS_KEY));
  envelope.data[designId] = { schemaVersion: 6, designId };
  storage.setItem(EDITOR_DOCS_KEY, JSON.stringify(envelope));
}

// Invalid target loads must not cancel the current dirty document's autosave.
{
  resetRuntime();
  seedDesign('load-source');
  assert.equal(useEditorV6Store.getState().load('load-source'), 'ok');
  useEditorV6Store.getState().setTitle('autosave survives invalid load');
  const sourceTimer = timers.latestId();
  assert.equal(timers.task(sourceTimer).delay, AUTOSAVE_DEBOUNCE_MS);
  addInvalidStoredDoc('invalid-target');

  assert.equal(useEditorV6Store.getState().load('invalid-target'), 'invalid');
  assert.equal(useEditorV6Store.getState().designId, 'load-source');
  assert.equal(useEditorV6Store.getState().autosaveTimer, sourceTimer);
  assert.equal(timers.task(sourceTimer).cleared, false);

  await timers.invoke(sourceTimer);
  assert.equal(persistedDoc('load-source').title, 'autosave survives invalid load');
  assert.equal(useEditorV6Store.getState().saveState, 'saved');
  console.log('[runtime] invalid load preserves current autosave: PASS');
}

// A valid design switch flushes current dirty state; a failed flush blocks navigation and is retryable.
{
  resetRuntime();
  seedDesign('switch-a');
  seedDesign('switch-b');
  assert.equal(useEditorV6Store.getState().load('switch-a'), 'ok');
  useEditorV6Store.getState().setTitle('switch A dirty');
  storage.failAllWrites = true;

  assert.equal(useEditorV6Store.getState().load('switch-b'), 'save_error');
  assert.equal(useEditorV6Store.getState().designId, 'switch-a');
  assert.equal(useEditorV6Store.getState().doc.title, 'switch A dirty');
  assert.equal(useEditorV6Store.getState().autosave.pendingRevision, 1);

  storage.failAllWrites = false;
  assert.equal(useEditorV6Store.getState().load('switch-b'), 'ok');
  assert.equal(persistedDoc('switch-a').title, 'switch A dirty');
  assert.equal(useEditorV6Store.getState().designId, 'switch-b');
  console.log('[runtime] valid load flushes and failed switch retries: PASS');
}

// A failed unload must retain the document and retry on the next unload call.
{
  resetRuntime();
  seedDesign('unload-retry');
  useEditorV6Store.getState().load('unload-retry');
  useEditorV6Store.getState().setTitle('must survive unload retry');
  storage.failAllWrites = true;

  assert.equal(useEditorV6Store.getState().unload(), 'error');
  assert.equal(useEditorV6Store.getState().saveState, 'error');
  assert.equal(useEditorV6Store.getState().designId, 'unload-retry');
  assert.equal(useEditorV6Store.getState().autosave.pendingRevision, 1);

  storage.failAllWrites = false;
  assert.equal(useEditorV6Store.getState().unload(), 'ok');
  assert.equal(persistedDoc('unload-retry').title, 'must survive unload retry');
  assert.equal(useEditorV6Store.getState().designId, null);
  console.log('[runtime] unload write failure remains retryable: PASS');
}

// If the document write succeeds but summary write fails, retry still retains and completes both records.
{
  resetRuntime();
  seedDesign('partial-write');
  useEditorV6Store.getState().load('partial-write');
  useEditorV6Store.getState().setTitle('doc persisted before summary');
  storage.failWriteKeys.add(DESIGNS_KEY);

  assert.equal(useEditorV6Store.getState().unload(), 'error');
  assert.equal(persistedDoc('partial-write').title, 'doc persisted before summary');
  assert.equal(getDesign('partial-write').title, 'Design partial-write');
  assert.equal(useEditorV6Store.getState().designId, 'partial-write');

  storage.failWriteKeys.delete(DESIGNS_KEY);
  assert.equal(useEditorV6Store.getState().unload(), 'ok');
  assert.equal(getDesign('partial-write').title, 'doc persisted before summary');
  console.log('[runtime] partial persistence failure remains retryable: PASS');
}

// Stale timer callbacks must never save or cancel the next design's timer.
{
  resetRuntime();
  seedDesign('timer-a');
  seedDesign('timer-b');
  useEditorV6Store.getState().load('timer-a');
  useEditorV6Store.getState().setTitle('timer A edit');
  const timerA = timers.latestId();
  assert.equal(useEditorV6Store.getState().load('timer-b'), 'ok');
  useEditorV6Store.getState().setTitle('timer B edit');
  const timerB = timers.latestId();
  assert.notEqual(timerA, timerB);

  await timers.invoke(timerA, { includeCleared: true });
  assert.equal(useEditorV6Store.getState().designId, 'timer-b');
  assert.equal(useEditorV6Store.getState().saveState, 'dirty');
  assert.equal(useEditorV6Store.getState().autosaveTimer, timerB);
  assert.notEqual(persistedDoc('timer-b').title, 'timer B edit');

  await timers.invoke(timerB);
  assert.equal(persistedDoc('timer-b').title, 'timer B edit');
  console.log('[runtime] stale timer designId guard: PASS');
}

// Invalid schema and rejected storage writes must report error, retain pending state, and never false-save.
{
  resetRuntime();
  seedDesign('save-errors');
  useEditorV6Store.getState().load('save-errors');
  useEditorV6Store.getState().setTitle('valid edit before corruption');
  const invalidDoc = structuredClone(useEditorV6Store.getState().doc);
  invalidDoc.defaultGeometry.shape = 'not-a-nail-shape';
  useEditorV6Store.setState({ doc: invalidDoc });

  assert.equal(await useEditorV6Store.getState().save(), 'error');
  assert.equal(useEditorV6Store.getState().saveState, 'error');
  assert.notEqual(persistedDoc('save-errors').title, 'valid edit before corruption');
  assert.equal(useEditorV6Store.getState().autosave.pendingRevision, 1);

  const repairedDoc = structuredClone(useEditorV6Store.getState().doc);
  repairedDoc.defaultGeometry.shape = 'almond';
  useEditorV6Store.setState({ doc: repairedDoc });
  storage.failAllWrites = true;
  assert.equal(await useEditorV6Store.getState().save(), 'error');
  assert.equal(useEditorV6Store.getState().saveState, 'error');
  storage.failAllWrites = false;
  assert.equal(await useEditorV6Store.getState().save(), 'saved');
  assert.equal(useEditorV6Store.getState().saveState, 'saved');
  assert.equal(persistedDoc('save-errors').title, 'valid edit before corruption');
  console.log('[runtime] invalid/rejected saves never report saved: PASS');
}

// Undo and redo are edits: every persisted document revision must remain monotonic.
{
  resetRuntime();
  seedDesign('revision-order');
  useEditorV6Store.getState().load('revision-order');
  useEditorV6Store.getState().setTitle('revision two');
  useEditorV6Store.getState().setTitle('revision three');
  assert.equal(await useEditorV6Store.getState().save(), 'saved');
  const afterEdit = persistedDoc('revision-order').revision;

  useEditorV6Store.getState().undo();
  assert.equal(await useEditorV6Store.getState().save(), 'saved');
  const afterUndo = persistedDoc('revision-order').revision;

  useEditorV6Store.getState().redo();
  assert.equal(await useEditorV6Store.getState().save(), 'saved');
  const afterRedo = persistedDoc('revision-order').revision;
  assert.deepEqual([afterEdit, afterUndo, afterRedo], [3, 4, 5]);
  console.log('[runtime] undo/redo persisted revisions are monotonic: PASS');
}

// Design summary baseColor follows presentationMeta.masterFinger, not hard-coded R4.
{
  resetRuntime();
  seedDesign('master-summary', { baseColor: '#111111' });
  useEditorV6Store.getState().load('master-summary');
  useEditorV6Store.getState().setCurrentFinger('R4');
  useEditorV6Store.getState().setBaseSurfaceColorOnCurrent('#AA0000');
  useEditorV6Store.getState().setCurrentFinger('L1');
  useEditorV6Store.getState().setBaseSurfaceColorOnCurrent('#00BB66');
  useEditorV6Store.getState().setMasterFinger('L1');
  assert.equal(await useEditorV6Store.getState().save(), 'saved');
  assert.equal(getDesign('master-summary').baseColor, '#00BB66');
  console.log('[runtime] masterFinger drives summary baseColor: PASS');
}

// Reload is an explicit discard: after a valid storage read it must cancel the dirty timer.
{
  resetRuntime();
  seedDesign('reload-discard');
  useEditorV6Store.getState().load('reload-discard');
  useEditorV6Store.getState().setTitle('discard this dirty title');
  const dirtyTimer = timers.latestId();

  assert.equal(useEditorV6Store.getState().reloadFromStorage(), true);
  assert.equal(useEditorV6Store.getState().saveState, 'saved');
  assert.equal(useEditorV6Store.getState().autosaveTimer, null);
  assert.equal(timers.task(dirtyTimer).cleared, true);
  assert.notEqual(useEditorV6Store.getState().doc.title, 'discard this dirty title');
  assert.equal(await timers.invoke(dirtyTimer), false);
  console.log('[runtime] reload clears discarded autosave timer: PASS');
}

console.log('\ntest-editor-v6-runtime: all assertions passed');
