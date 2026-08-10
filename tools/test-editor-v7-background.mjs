import { strict as assert } from 'node:assert';
import { createFullEditorDocV7Fixture } from '../src/studio/editor/fixtures/editor-doc-v7.mjs';
import {
  canonicalRgbaColorV7,
  parseHexColorV7,
  representativeBackgroundColorV7,
  resolveBackgroundPreviewModelV7,
  resolveBackgroundSilhouetteV7,
  rgbaToHexV7,
  setEditorV7BackgroundColor,
  setEditorV7BackgroundMode,
  setEditorV7BackgroundOpacity,
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
  clearTimeout = (id) => { this.tasks.delete(id); };
}

function createRuntime(doc) {
  const storage = new MemoryStorage({ [doc.designId]: doc });
  const timers = new FakeTimers();
  const store = createEditorV7Store({
    repository: createEditorDocV7Repository(storage, resolvers),
    now: () => '2026-08-10T08:00:00.000Z',
    setTimeout: timers.setTimeout,
    clearTimeout: timers.clearTimeout,
    autosaveDelayMs: 25,
  });
  return { storage, timers, store };
}

// Canonical color input is deterministic and keeps alpha separate from hex.
{
  assert.deepEqual(parseHexColorV7('#C94C65'), rgba(201, 76, 101));
  assert.deepEqual(parseHexColorV7('c94c65'), rgba(201, 76, 101));
  assert.equal(parseHexColorV7('#abc'), null);
  assert.equal(parseHexColorV7('#GG0000'), null);
  assert.equal(rgbaToHexV7(rgba(201, 76, 101, 0.25)), '#c94c65');
  assert.deepEqual(canonicalRgbaColorV7(rgba(300.2, -8, 12.6, 1.4)), rgba(255, 0, 13, 1));
  console.log('[v7-background] canonical color helpers: PASS');
}

// Preview derives alpha from canonical RGBA × common opacity and never claims translucency exact.
{
  const model = resolveBackgroundPreviewModelV7({ mode: 'translucent', color: rgba(40, 80, 120, 0.5), opacity: 0.4 }, true);
  assert.equal(model.alpha, 0.2);
  assert.equal(model.fidelity, 'approximate');
  assert.equal(model.deferred, false);
  assert.equal(resolveBackgroundPreviewModelV7({ mode: 'solid', color: rgba(1, 2, 3), opacity: 1 }, false).visible, false);
  console.log('[v7-background] derived preview fidelity and alpha: PASS');
}

// Product geometry is used only for a recognized asset reference; fixture refs fall back without mutation.
{
  const productRef = { assetId: 'geometry.almond.medium.L1', revision: 'registry-1' };
  const productBefore = clone(productRef);
  assert.equal(resolveBackgroundSilhouetteV7(productRef).source, 'product');
  assert.deepEqual(productRef, productBefore);
  assert.equal(resolveBackgroundSilhouetteV7({ assetId: 'geometry.L1', revision: 'scan-4' }).source, 'generic');
  console.log('[v7-background] geometry-derived silhouette fallback policy: PASS');
}

// Pure commands are atomic, single-finger, lock-aware, and reject invalid values.
{
  const doc = createFullEditorDocV7Fixture();
  const before = clone(doc);
  const nextColor = rgba(18, 52, 86);
  const colored = setEditorV7BackgroundColor(doc, 'L1', nextColor);
  assert.equal(colored.ok, true);
  assert.deepEqual(doc, before);
  assert.deepEqual(colored.doc.nails.L1.steps[0].background.color, nextColor);
  assert.deepEqual(colored.doc.nails.L2, before.nails.L2);
  assert.equal(setEditorV7BackgroundOpacity(doc, 'L1', -0.01).reason, 'invalid_value');
  assert.equal(setEditorV7BackgroundOpacity(doc, 'L1', Number.NaN).reason, 'invalid_value');
  assert.equal(setEditorV7BackgroundMode(doc, 'L1', 'solid').reason, 'not_allowed');

  const locked = clone(doc);
  locked.nails.L1.steps[0].locked = true;
  assert.equal(setEditorV7BackgroundColor(locked, 'L1', nextColor).reason, 'locked');
  console.log('[v7-background] atomic single-finger commands and rejection: PASS');
}

// Explicit advanced conversion uses a deterministic representative and remains undoable at store level.
{
  const doc = createFullEditorDocV7Fixture();
  const gradient = doc.nails.L3.steps[0].background;
  assert.equal(gradient.mode, 'gradient');
  const representative = clone(representativeBackgroundColorV7(gradient));
  const converted = setEditorV7BackgroundMode(doc, 'L3', 'translucent');
  assert.equal(converted.ok, true);
  assert.equal(converted.doc.nails.L3.steps[0].background.mode, 'translucent');
  assert.deepEqual(converted.doc.nails.L3.steps[0].background.color, representative);
  assert.equal(converted.doc.nails.L3.steps[0].background.opacity, gradient.opacity);
  assert.equal(setEditorV7BackgroundColor(doc, 'L3', rgba(0, 0, 0)).reason, 'not_allowed');
  console.log('[v7-background] explicit advanced representative conversion: PASS');
}

// Store actions use one revision/history entry, support undo/redo, save/reload, and read-only gates.
{
  const doc = createFullEditorDocV7Fixture();
  const originalL2 = clone(doc.nails.L2);
  const { storage, store } = createRuntime(doc);
  assert.equal(await store.getState().load(doc.designId), 'ok');
  const baseRevision = store.getState().doc.revision;
  store.setState({ switching: true });
  assert.equal(store.getState().setBackgroundOpacity('L1', 0.2).reason, 'busy');
  assert.equal(store.getState().doc.revision, baseRevision);
  store.setState({ switching: false });
  const color = rgba(11, 22, 33);
  assert.equal(store.getState().setBackgroundColor('L1', color).ok, true);
  assert.equal(store.getState().doc.revision, baseRevision + 1);
  assert.equal(store.getState().history.length, 1);
  assert.deepEqual(store.getState().doc.nails.L2, originalL2);
  assert.equal(store.getState().setBackgroundOpacity('L1', 0.45).ok, true);
  assert.equal(store.getState().doc.revision, baseRevision + 2);
  assert.equal(store.getState().history.length, 2);
  assert.equal(store.getState().undo().ok, true);
  assert.equal(store.getState().doc.nails.L1.steps[0].background.opacity, 1);
  assert.equal(store.getState().redo().ok, true);
  assert.equal(store.getState().doc.nails.L1.steps[0].background.opacity, 0.45);
  assert.equal(await store.getState().save(), 'saved');
  assert.equal(storage.writes, 1);
  assert.deepEqual(storage.docs[doc.designId].nails.L1.steps[0].background.color, color);

  const reloaded = createEditorV7Store({ repository: createEditorDocV7Repository(storage, resolvers) });
  assert.equal(await reloaded.getState().load(doc.designId), 'ok');
  assert.equal(reloaded.getState().doc.nails.L1.steps[0].background.opacity, 0.45);
  assert.deepEqual(reloaded.getState().doc.nails.L1.steps[0].background.color, color);
  await reloaded.getState().load(doc.designId, { readOnly: true });
  assert.equal(reloaded.getState().setBackgroundOpacity('L1', 0.2).reason, 'read_only');
  assert.equal(await reloaded.getState().unload(), 'ok');
  console.log('[v7-background] store revision/history/save/reload/read-only: PASS');
}

console.log('[v7-background] all behavior checks passed');
