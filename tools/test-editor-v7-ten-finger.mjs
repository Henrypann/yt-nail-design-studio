import { strict as assert } from 'node:assert';
import { FINGER_CODES } from '../src/lib/types.ts';
import {
  createFullEditorDocV7Fixture,
  createMinimalEditorDocV7Fixture,
} from '../src/studio/editor/fixtures/editor-doc-v7.mjs';
import { createEditorV7Store } from '../src/studio/editor/store-v7.ts';
import { createCustomerPreviewScenarioV7, deriveCustomerPreviewSetV7 } from '../src/studio/editor/v7/customer-preview.ts';
import { nailPathAnchorsV7 } from '../src/studio/editor/v7/flat-vector.ts';
import { createEditorDocV7Repository } from '../src/studio/editor/v7/repository.ts';
import { parseEditorDocV7 } from '../src/studio/editor/v7/schema.ts';
import {
  detachEditorV7NailScope,
  materializeEditorV7NailScope,
  oppositeEditorV7Finger,
  resolveEditorV7FingerScope,
} from '../src/studio/editor/v7/ten-finger-operations.ts';

const clone = (value) => structuredClone(value);
const RED = { colorSpace: 'srgb', r: 210, g: 22, b: 60, a: 1 };
const BLUE = { colorSpace: 'srgb', r: 20, g: 80, b: 220, a: 1 };

function idFactory(prefix = 'node') {
  let next = 0;
  return (kind) => `${kind}.${prefix}.${++next}`;
}

function allNodeIds(doc) {
  return FINGER_CODES.flatMap((finger) => doc.nails[finger].steps.flatMap((step) => [
    step.id,
    ...(step.kind === 'flat_design' ? step.elements.map((item) => item.id) : []),
    ...(step.kind === 'dimensional_decoration' ? step.decorations.map((item) => item.id) : []),
  ]));
}

function validMask() {
  return { coordinateSpace: 'nail-local-v1', pathData: 'M0.1 0.2 L0.9 0.2 L0.7 0.8 Z', fillRule: 'nonzero', inverted: false };
}

function mirrorFixture() {
  const doc = createFullEditorDocV7Fixture();
  const source = doc.nails.L1;
  source.steps[0].background = {
    mode: 'gradient', opacity: 1, directionDeg: 30,
    stops: [{ offset: 0, color: RED }, { offset: 1, color: BLUE }],
  };
  for (const step of source.steps) {
    if ('mask' in step) step.mask = validMask();
    if (step.kind === 'flat_design') {
      step.mask = validMask();
      for (const element of step.elements) {
        element.locked = false;
        if (element.kind === 'vector_shape') element.pathData = 'M0.2 0.2 L0.8 0.3 L0.7 0.8 Z';
        if (element.kind === 'region_mask') element.mask = validMask();
        if (element.kind === 'text') {
          element.transform.position = { u: 0.2, v: 0.4 };
          element.transform.rotationDeg = 35;
        }
      }
    }
    if (step.kind === 'surface_effect') {
      step.mask = validMask();
      if (step.effect.effectType === 'cat_eye') step.effect.directionDeg = 20;
    }
    if (step.kind === 'dimensional_decoration') {
      for (const decoration of step.decorations) {
        decoration.locked = false;
        if (decoration.kind === 'relief_2_5d') decoration.outline = validMask();
      }
    }
  }
  for (const step of doc.nails.R1.steps) step.locked = false;
  return doc;
}

// Scope resolution is deterministic, canonical, and never mutates the selection input.
{
  const selected = ['R3', 'L2', 'R3'];
  const before = clone(selected);
  assert.deepEqual(resolveEditorV7FingerScope({ kind: 'current', currentFinger: 'L3' }), {
    ok: true, targets: [{ finger: 'L3', projection: 'identity' }],
  });
  assert.deepEqual(resolveEditorV7FingerScope({ kind: 'selected', currentFinger: 'L1', selectedFingers: selected }), {
    ok: true,
    targets: [{ finger: 'L2', projection: 'identity' }, { finger: 'R3', projection: 'identity' }],
  });
  assert.deepEqual(resolveEditorV7FingerScope({ kind: 'mirror', currentFinger: 'L4' }), {
    ok: true,
    targets: [{ finger: 'L4', projection: 'identity' }, { finger: 'R4', projection: 'mirror-x' }],
  });
  assert.equal(resolveEditorV7FingerScope({ kind: 'all', currentFinger: 'R5' }).targets.length, 10);
  assert.deepEqual(resolveEditorV7FingerScope({ kind: 'selected', currentFinger: 'L1', selectedFingers: [] }), { ok: false, reason: 'empty_scope' });
  assert.deepEqual(resolveEditorV7FingerScope({ kind: 'selected', currentFinger: 'L1', selectedFingers: ['X1'] }), { ok: false, reason: 'invalid_scope' });
  assert.deepEqual(selected, before);
  for (let index = 1; index <= 5; index += 1) {
    assert.equal(oppositeEditorV7Finger(`L${index}`), `R${index}`);
    assert.equal(oppositeEditorV7Finger(`R${index}`), `L${index}`);
  }
  console.log('[v7-ten-finger] scope resolver and opposite mapping: PASS');
}

// Mirror copy preserves target geometry, creates independent IDs/objects, and mirrors every supported layout primitive.
{
  const doc = mirrorFixture();
  doc.nails.L1.steps[0].locked = true;
  const before = clone(doc);
  const targetGeometry = clone(doc.nails.R1.geometryRef);
  const result = materializeEditorV7NailScope(doc, {
    sourceFinger: 'L1',
    scope: { kind: 'mirror', currentFinger: 'L1' },
    mode: 'copy-detached',
  }, idFactory('mirror'));
  assert.equal(result.ok, true, result.message);
  assert.deepEqual(doc, before);
  assert.deepEqual(result.doc.nails.R1.geometryRef, targetGeometry);
  assert.equal(result.doc.nails.R1.finger, 'R1');
  assert.equal(result.doc.nails.R1.steps[0].background.directionDeg, 150);
  const sourceFlat = doc.nails.L1.steps.find((step) => step.kind === 'flat_design');
  const targetFlat = result.doc.nails.R1.steps.find((step) => step.kind === 'flat_design');
  assert.notStrictEqual(targetFlat, sourceFlat);
  assert.notStrictEqual(targetFlat.elements, sourceFlat.elements);
  assert.equal(targetFlat.elements.find((item) => item.kind === 'brush_stroke').points[0].u, 0.9);
  assert.equal(targetFlat.elements.find((item) => item.kind === 'eraser_mask').path[0].u, 0.8);
  const vector = targetFlat.elements.find((item) => item.kind === 'vector_shape');
  assert.deepEqual(nailPathAnchorsV7(vector.pathData)[0], { u: 0.8, v: 0.2 });
  const text = targetFlat.elements.find((item) => item.kind === 'text');
  assert.equal(text.text, 'V7');
  assert.equal(text.transform.position.u, 0.8);
  assert.equal(text.transform.rotationDeg, -35);
  const image = targetFlat.elements.find((item) => item.kind === 'image_2d');
  assert.equal(image.asset.assetId, 'asset.sticker-L1');
  const sourceImage = sourceFlat.elements.find((item) => item.kind === 'image_2d');
  assert.equal(image.transform.position.u, 1 - sourceImage.transform.position.u);
  assert.equal(image.transform.rotationDeg, sourceImage.transform.rotationDeg === 0 ? 0 : -sourceImage.transform.rotationDeg);
  const french = targetFlat.elements.find((item) => item.kind === 'french_edge');
  const sourceFrench = sourceFlat.elements.find((item) => item.kind === 'french_edge');
  assert.equal(french.widthRatio, sourceFrench.widthRatio);
  assert.equal(french.curvature, sourceFrench.curvature);
  assert.equal(french.transform.position.u, 1 - sourceFrench.transform.position.u);
  const effect = result.doc.nails.R1.steps.find((step) => step.kind === 'surface_effect' && step.effect.effectType === 'cat_eye');
  assert.equal(effect.effect.directionDeg, 160);
  const attachment = result.doc.nails.R1.steps
    .find((step) => step.kind === 'dimensional_decoration').decorations
    .find((item) => item.kind === 'attachment_3d');
  assert.equal(attachment.anchor.u, 0.35);
  assert.equal(attachment.asset.assetId, 'asset.charm-L1');
  assert.equal(attachment.transform.position.u, 0.35);
  assert.equal(attachment.transform.rotationDeg, 0);
  const glitter = result.doc.nails.R1.steps.find((step) => step.kind === 'surface_effect' && step.effect.effectType === 'glitter');
  const ink = result.doc.nails.R1.steps.find((step) => step.kind === 'surface_effect' && step.effect.effectType === 'ink_bloom');
  assert.equal(glitter.effect.seed, 'effect-glitter');
  assert.equal(ink.effect.seed, 'ink-bloom');
  assert.equal(new Set(allNodeIds(result.doc)).size, allNodeIds(result.doc).length);
  assert.equal(parseEditorDocV7(result.doc).ok, true);
  result.doc.nails.R1.steps[0].name = 'mutated target';
  assert.notEqual(doc.nails.L1.steps[0].name, 'mutated target');

  const mirroredBackSource = clone(result.doc);
  for (const step of mirroredBackSource.nails.L1.steps) {
    step.locked = false;
    if (step.kind === 'flat_design') step.elements.forEach((element) => { element.locked = false; });
    if (step.kind === 'dimensional_decoration') step.decorations.forEach((decoration) => { decoration.locked = false; });
  }
  const mirroredBack = materializeEditorV7NailScope(mirroredBackSource, {
    sourceFinger: 'R1',
    scope: { kind: 'mirror', currentFinger: 'R1' },
    mode: 'copy-detached',
  }, idFactory('mirror-back'));
  assert.equal(mirroredBack.ok, true, mirroredBack.message);
  assert.equal(mirroredBack.doc.nails.L1.steps[0].background.directionDeg, 30);
  const mirroredBackBrush = mirroredBack.doc.nails.L1.steps.find((step) => step.kind === 'flat_design').elements.find((item) => item.kind === 'brush_stroke');
  const sourceBrush = sourceFlat.elements.find((item) => item.kind === 'brush_stroke');
  assert.deepEqual(mirroredBackBrush.points, sourceBrush.points);
  console.log('[v7-ten-finger] complete layout mirror and independent canonical data: PASS');
}

// The current broad RegionMask schema is not silently reinterpreted by the narrow mirror adapter.
{
  const doc = createFullEditorDocV7Fixture();
  const result = materializeEditorV7NailScope(doc, {
    sourceFinger: 'L1',
    scope: { kind: 'mirror', currentFinger: 'L1' },
    mode: 'copy-detached',
  }, idFactory('unsupported-mask'));
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'invalid_value');
  assert.match(result.message, /mask|outline|path/);
  console.log('[v7-ten-finger] unsupported broad mask fails with an explicit adapter diagnostic: PASS');
}

// Canonical direction reflection covers every quadrant and normalizes to [0, 360).
{
  const cases = [[0, 180], [45, 135], [90, 90], [180, 0], [270, 270], [359, 181]];
  for (const [input, expected] of cases) {
    const doc = createMinimalEditorDocV7Fixture();
    doc.nails.L1.steps[0].background = { mode: 'gradient', opacity: 1, directionDeg: input, stops: [{ offset: 0, color: RED }, { offset: 1, color: BLUE }] };
    const result = materializeEditorV7NailScope(doc, {
      sourceFinger: 'L1',
      scope: { kind: 'mirror', currentFinger: 'L1' },
      mode: 'copy-detached',
    }, idFactory(`angle-${input}`));
    assert.equal(result.ok, true, result.message);
    assert.equal(result.doc.nails.R1.steps[0].background.directionDeg, expected);
  }
  console.log('[v7-ten-finger] mirror direction boundary matrix: PASS');
}

// Mirrored u is canonicalized to five decimals; the untouched v axis preserves source precision.
{
  const doc = mirrorFixture();
  const brush = doc.nails.L1.steps.find((step) => step.kind === 'flat_design').elements.find((item) => item.kind === 'brush_stroke');
  brush.points[0] = { u: 0.123456789, v: 0.234567891 };
  const result = materializeEditorV7NailScope(doc, {
    sourceFinger: 'L1', scope: { kind: 'mirror', currentFinger: 'L1' }, mode: 'copy-detached',
  }, idFactory('precision'));
  assert.equal(result.ok, true, result.message);
  const mirrored = result.doc.nails.R1.steps.find((step) => step.kind === 'flat_design').elements.find((item) => item.kind === 'brush_stroke');
  assert.deepEqual(mirrored.points[0], { u: 0.87654, v: 0.234567891 });
  console.log('[v7-ten-finger] mirror coordinate precision policy: PASS');
}

// Any target lock or ID collision rejects the whole batch without changing input.
{
  const doc = createMinimalEditorDocV7Fixture();
  const before = clone(doc);
  doc.nails.L2.steps[0].locked = true;
  const locked = materializeEditorV7NailScope(doc, {
    sourceFinger: 'L1',
    scope: { kind: 'selected', currentFinger: 'L1', selectedFingers: ['L2', 'L3'] },
    mode: 'copy-detached',
  }, idFactory('locked'));
  assert.equal(locked.reason, 'locked');
  doc.nails.L2.steps[0].locked = false;
  const existingId = doc.nails.L1.steps[0].id;
  const collision = materializeEditorV7NailScope(doc, {
    sourceFinger: 'L1',
    scope: { kind: 'selected', currentFinger: 'L1', selectedFingers: ['L2'] },
    mode: 'copy-detached',
  }, () => existingId);
  assert.equal(collision.reason, 'duplicate_id');
  assert.deepEqual({ ...doc, nails: { ...doc.nails, L2: before.nails.L2 } }, before);
  console.log('[v7-ten-finger] atomic lock and ID-collision gates: PASS');
}

class MemoryStorage {
  constructor(docs = {}) { this.docs = clone(docs); }
  writes = 0;
  read = () => clone(this.docs);
  write = async (next) => { this.docs = clone(next); this.writes += 1; };
}

class FakeTimers {
  next = 1;
  tasks = new Map();
  setTimeout = (callback, delay) => { const id = this.next++; this.tasks.set(id, { callback, delay, cleared: false }); return id; };
  clearTimeout = (id) => { const task = this.tasks.get(id); if (task) task.cleared = true; };
}

function runtime(doc, options = {}) {
  const storage = new MemoryStorage({ [doc.designId]: doc });
  const timers = new FakeTimers();
  const repository = createEditorDocV7Repository(storage, { resolveGeometry: () => null, resolveFinishPreset: () => null });
  const store = createEditorV7Store({
    repository,
    now: () => '2026-08-10T12:00:00.000Z',
    idFactory: options.idFactory ?? idFactory('store'),
    setTimeout: timers.setTimeout,
    clearTimeout: timers.clearTimeout,
    autosaveDelayMs: 25,
  });
  return { store, storage, timers };
}

// A multi-finger sync is one transaction; a later single-finger edit detaches only that nail.
{
  const doc = createMinimalEditorDocV7Fixture();
  doc.designId = 'design.v7.ten-finger-runtime';
  const { store, storage, timers } = runtime(doc);
  await store.getState().load(doc.designId);
  store.getState().setCurrentFinger('L1');
  store.getState().setFingerScope('selected');
  store.getState().toggleSelectedFinger('L1');
  store.getState().toggleSelectedFinger('L2');
  store.getState().toggleSelectedFinger('R2');
  const beforeRevision = store.getState().doc.revision;
  assert.equal(store.getState().syncFingerScope().ok, true);
  assert.equal(store.getState().doc.revision, beforeRevision + 1);
  assert.equal(store.getState().history.length, 1);
  assert.equal(store.getState().future.length, 0);
  assert.equal(timers.tasks.size, 1);
  assert.equal(storage.writes, 0);
  assert.equal(store.getState().doc.nails.L1.compositionProvenance.syncState, 'linked');
  assert.equal(store.getState().doc.nails.L2.compositionProvenance.syncState, 'linked');
  assert.equal(store.getState().doc.nails.R2.compositionProvenance.syncState, 'linked');
  assert.equal(store.getState().setBackgroundColor('L2', BLUE).ok, true);
  assert.equal(store.getState().doc.nails.L2.compositionProvenance.syncState, 'detached');
  assert.equal(store.getState().doc.nails.L1.compositionProvenance.syncState, 'linked');
  assert.equal(store.getState().doc.nails.R2.compositionProvenance.syncState, 'linked');
  assert.equal(store.getState().undo().ok, true);
  assert.equal(store.getState().doc.nails.L2.compositionProvenance.syncState, 'linked');
  assert.equal(store.getState().redo().ok, true);
  assert.equal(store.getState().doc.nails.L2.compositionProvenance.syncState, 'detached');
  assert.equal(await store.getState().save(), 'saved');
  assert.equal(storage.writes, 1);
  assert.equal(store.getState().reloadFromStorage(), 'ok');
  assert.equal(store.getState().doc.nails.L2.compositionProvenance.syncState, 'detached');
  console.log('[v7-ten-finger] one transaction, auto-detach, undo/redo, save/reload: PASS');
}

// All-finger sync produces ten independent nails; detach and customer preview remain pure readers.
{
  const doc = createMinimalEditorDocV7Fixture();
  doc.designId = 'design.v7.ten-finger-all';
  const before = clone(doc);
  const synced = materializeEditorV7NailScope(doc, {
    sourceFinger: 'L1',
    scope: { kind: 'all', currentFinger: 'L1' },
    mode: 'sync-linked',
  }, idFactory('all'));
  assert.equal(synced.ok, true, synced.message);
  assert.equal(synced.affectedFingers.length, 9);
  assert.equal(FINGER_CODES.every((finger) => synced.doc.nails[finger].compositionProvenance.syncState === 'linked'), true);
  assert.equal(new Set(allNodeIds(synced.doc)).size, allNodeIds(synced.doc).length);
  assert.notStrictEqual(synced.doc.nails.L2.steps, synced.doc.nails.R2.steps);
  assert.notStrictEqual(synced.doc.nails.L2.steps[0], synced.doc.nails.R2.steps[0]);
  assert.notStrictEqual(synced.doc.nails.L2.steps.at(-1).materialRefs, synced.doc.nails.R2.steps.at(-1).materialRefs);
  const previewInput = clone(synced.doc);
  const preview = deriveCustomerPreviewSetV7(synced.doc, createCustomerPreviewScenarioV7());
  assert.equal(preview.length, 10);
  assert.deepEqual(synced.doc, previewInput);
  const detached = detachEditorV7NailScope(synced.doc, { kind: 'selected', currentFinger: 'L1', selectedFingers: ['L3', 'R3'] });
  assert.equal(detached.ok, true);
  assert.equal(detached.doc.nails.L3.compositionProvenance.syncState, 'detached');
  assert.equal(detached.doc.nails.R3.compositionProvenance.syncState, 'detached');
  assert.equal(detached.doc.nails.L1.compositionProvenance.syncState, 'linked');
  assert.deepEqual(doc, before);
  console.log('[v7-ten-finger] all-finger independence, detach, and preview purity: PASS');
}

// External composition lineage remains provenance only and is preserved by explicit sync.
{
  const doc = createFullEditorDocV7Fixture();
  const meta = clone(doc.compositionMeta);
  const synced = materializeEditorV7NailScope(doc, {
    sourceFinger: 'L1', scope: { kind: 'all', currentFinger: 'L1' }, mode: 'sync-linked',
  }, idFactory('external-lineage'));
  assert.equal(synced.ok, true, synced.message);
  assert.deepEqual(synced.doc.compositionMeta, meta);
  assert.equal(FINGER_CODES.every((finger) => synced.doc.nails[finger].compositionProvenance.compositionId === meta.compositionId), true);
  console.log('[v7-ten-finger] external composition lineage preserved without content dual-write: PASS');
}

// A narrower resync never mutates linked members outside the explicit scope.
{
  const doc = createMinimalEditorDocV7Fixture();
  const all = materializeEditorV7NailScope(doc, {
    sourceFinger: 'L1', scope: { kind: 'all', currentFinger: 'L1' }, mode: 'sync-linked',
  }, idFactory('cohort-all'));
  assert.equal(all.ok, true);
  const before = clone(all.doc);
  const narrowed = materializeEditorV7NailScope(all.doc, {
    sourceFinger: 'L1',
    scope: { kind: 'selected', currentFinger: 'L1', selectedFingers: ['L1', 'L2'] },
    mode: 'sync-linked',
  }, idFactory('cohort-narrow'));
  assert.equal(narrowed.ok, false);
  assert.equal(narrowed.reason, 'not_allowed');
  assert.match(narrowed.message, /scope excludes linked fingers/);
  assert.deepEqual(all.doc, before);
  console.log('[v7-ten-finger] scope-external linked cohort is rejected without mutation: PASS');
}

// Store-level failed batches preserve revision/history/autosave and storage writes.
{
  const doc = createMinimalEditorDocV7Fixture();
  doc.designId = 'design.v7.ten-finger-failed-batch';
  doc.nails.L2.steps[0].locked = true;
  const { store, storage, timers } = runtime(doc);
  await store.getState().load(doc.designId);
  store.getState().setCurrentFinger('L1');
  store.getState().setFingerScope('selected');
  store.getState().toggleSelectedFinger('L1');
  store.getState().toggleSelectedFinger('L2');
  const before = {
    doc: clone(store.getState().doc),
    historyLength: store.getState().history.length,
    pendingRevision: store.getState().revisionState.pendingRevision,
  };
  assert.equal(store.getState().copyFingerScope().reason, 'locked');
  assert.deepEqual(store.getState().doc, before.doc);
  assert.equal(store.getState().history.length, before.historyLength);
  assert.equal(store.getState().revisionState.pendingRevision, before.pendingRevision);
  assert.equal(timers.tasks.size, 0);
  assert.equal(storage.writes, 0);
  console.log('[v7-ten-finger] failed store batch is side-effect free: PASS');
}

// Read-only keeps runtime scope selection available but rejects every document writer.
{
  const doc = createMinimalEditorDocV7Fixture();
  doc.designId = 'design.v7.ten-finger-readonly';
  const { store, storage } = runtime(doc);
  await store.getState().load(doc.designId, { readOnly: true });
  const before = clone(store.getState().doc);
  store.getState().setCurrentFinger('R1');
  store.getState().setFingerScope('all');
  assert.equal(store.getState().currentFinger, 'R1');
  assert.equal(store.getState().fingerScope, 'all');
  assert.equal(store.getState().copyFingerScope().reason, 'read_only');
  assert.equal(store.getState().syncFingerScope().reason, 'read_only');
  assert.equal(store.getState().detachFingerScope().reason, 'read_only');
  assert.deepEqual(store.getState().doc, before);
  assert.equal(storage.writes, 0);
  console.log('[v7-ten-finger] read-only scope UI and writer gates: PASS');
}

// Switching blocks the same scope writers before any ID generation or state change.
{
  const doc = createMinimalEditorDocV7Fixture();
  doc.designId = 'design.v7.ten-finger-switching';
  let generated = 0;
  const { store } = runtime(doc, { idFactory: (prefix) => { generated += 1; return `${prefix}.switching.${generated}`; } });
  await store.getState().load(doc.designId);
  store.getState().setCurrentFinger('L1');
  store.getState().setFingerScope('all');
  store.setState({ switching: true });
  const before = clone(store.getState().doc);
  assert.equal(store.getState().copyFingerScope().reason, 'busy');
  assert.equal(store.getState().syncFingerScope().reason, 'busy');
  assert.deepEqual(store.getState().doc, before);
  assert.equal(generated, 0);
  console.log('[v7-ten-finger] switching gate before canonical work: PASS');
}

console.log('[v7-ten-finger] all checks passed');
