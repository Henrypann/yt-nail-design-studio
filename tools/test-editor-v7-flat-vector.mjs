import { strict as assert } from 'node:assert';
import { readFile } from 'node:fs/promises';
import { createMinimalEditorDocV7Fixture } from '../src/studio/editor/fixtures/editor-doc-v7.mjs';
import { PROCESS_STEP_TYPE_IDS_V7 } from '../src/studio/editor/v7/registry.ts';
import {
  circlePathDataV7,
  createPointerFlatElementV7,
  createRegionMaskFlatElementV7,
  createVectorFlatElementV7,
  inverseTransformNailPointV7,
  isClosedNailPathDataV7,
  isDrawableNailPathDataV7,
  isValidNailPathDataV7,
  linePathDataV7,
  moveNailPathAnchorV7,
  nailPathAnchorsV7,
  parseNailPathDataV7,
  rectanglePathDataV7,
  replaceEditorV7FlatElement,
  resolveFlatElementMaskScopeV7,
  setEditorV7FlatElementOpacity,
  starPathDataV7,
  transformNailPointV7,
} from '../src/studio/editor/v7/flat-vector.ts';
import { addEditorV7Element, addEditorV7Step } from '../src/studio/editor/v7/commands.ts';
import { createEditorDocV7Repository } from '../src/studio/editor/v7/repository.ts';
import { createEditorV7Store } from '../src/studio/editor/store-v7.ts';

const clone = (value) => structuredClone(value);
const color = { colorSpace: 'srgb', r: 184, g: 36, b: 92, a: 1 };
const resolvers = { resolveGeometry: () => null, resolveFinishPreset: () => null };

class MemoryStorage {
  constructor(docs) { this.docs = clone(docs); }
  writes = 0;
  read = () => clone(this.docs);
  write = async (docs) => { this.docs = clone(docs); this.writes += 1; };
}

class FakeTimers {
  next = 1;
  tasks = new Map();
  setTimeout = (callback) => { const id = this.next++; this.tasks.set(id, callback); return id; };
  clearTimeout = (id) => { this.tasks.delete(id); };
}

function createFlatStep(id = 'step.L1.flat-v7-07') {
  return {
    id,
    typeId: PROCESS_STEP_TYPE_IDS_V7.flat_design,
    kind: 'flat_design',
    name: '平面设计',
    visible: true,
    locked: false,
    skipped: false,
    materialRefs: [],
    elements: [],
  };
}

function runtime(doc) {
  const storage = new MemoryStorage({ [doc.designId]: doc });
  const timers = new FakeTimers();
  const store = createEditorV7Store({
    repository: createEditorDocV7Repository(storage, resolvers),
    now: () => '2026-08-10T12:00:00.000Z',
    setTimeout: timers.setTimeout,
    clearTimeout: timers.clearTimeout,
    autosaveDelayMs: 25,
  });
  return { storage, store };
}

// Strict canonical path grammar: absolute finite nail-local coordinates only.
{
  const paths = [
    'M0.1 0.2 L0.9 0.8',
    'M0.1 0.2 Q0.3 0.1 0.8 0.7',
    'M0.1 0.2 C0.2 0.1 0.7 0.9 0.8 0.7 Z',
    rectanglePathDataV7({ u: 0.2, v: 0.3 }, { u: 0.8, v: 0.7 }),
    circlePathDataV7({ u: 0.2, v: 0.2 }, { u: 0.8, v: 0.8 }),
    starPathDataV7({ u: 0.2, v: 0.2 }, { u: 0.8, v: 0.8 }),
  ];
  paths.forEach((path) => assert.ok(parseNailPathDataV7(path), path));
  ['m0 0 l1 1', 'M0 0 A1 1 0 0 0 1 1', 'M-0.1 0 L1 1', 'M0 0 L1.01 1', 'MNaN 0 L1 1', 'M0 0 L1 1 <script>', 'L0 0', 'M0 0 Z L1 1'].forEach((path) => assert.equal(isValidNailPathDataV7(path), false, path));
  assert.equal(isClosedNailPathDataV7('M0 0 L1 1'), false);
  assert.equal(isClosedNailPathDataV7('M0 0 L1 1 Z'), true);
  assert.equal(createVectorFlatElementV7({ id: 'element.invalid.fill', pathData: 'M0 0 L1 1', color, appearance: 'fill' }), null);
  assert.equal(createRegionMaskFlatElementV7('element.invalid.mask', 'M0 0 L1 1'), null);
  ['M0.5 0.5', 'M0.5 0.5 L0.5 0.5', 'M0.5 0.5 Z'].forEach((path) => assert.equal(isDrawableNailPathDataV7(path, 'stroke'), false, path));
  ['M0.2 0.2 L0.8 0.2 Z', 'M0.2 0.2 L0.5 0.5 L0.8 0.8 Z', 'M0.5 0.5 Z'].forEach((path) => assert.equal(isDrawableNailPathDataV7(path, 'area'), false, path));
  assert.equal(createVectorFlatElementV7({ id: 'element.zero.stroke', pathData: 'M0.5 0.5 L0.5 0.5', color, appearance: 'stroke' }), null);
  assert.equal(createRegionMaskFlatElementV7('element.zero.mask', 'M0.5 0.5 Z'), null);
  console.log('[v7-flat] strict path grammar and closed-path rules: PASS');
}

// Pointer paths materialize to typed canonical elements and anchors remain nail-local.
{
  const input = [{ u: -1, v: 0.1 }, { u: 0.4, v: 0.5 }, { u: 2, v: 0.9 }];
  const brush = createPointerFlatElementV7({ id: 'element.pointer.brush', tool: 'brush', points: input, color, widthMm: 0.5 });
  const eraser = createPointerFlatElementV7({ id: 'element.pointer.eraser', tool: 'eraser', points: input, color, widthMm: 0.8 });
  assert.equal(brush.kind, 'brush_stroke');
  assert.deepEqual(brush.points[0], { u: 0, v: 0.1 });
  assert.deepEqual(brush.points.at(-1), { u: 1, v: 0.9 });
  assert.equal(eraser.kind, 'eraser_mask');
  assert.equal(createPointerFlatElementV7({ id: 'element.short', tool: 'brush', points: [{ u: 0.2, v: 0.2 }], color, widthMm: 0.5 }), null);
  const line = linePathDataV7({ u: 0.1, v: 0.2 }, { u: 0.8, v: 0.9 });
  assert.deepEqual(nailPathAnchorsV7(line), [{ u: 0.1, v: 0.2 }, { u: 0.8, v: 0.9 }]);
  const moved = moveNailPathAnchorV7(line, 1, { u: 0.7, v: 0.6 });
  assert.deepEqual(nailPathAnchorsV7(moved), [{ u: 0.1, v: 0.2 }, { u: 0.7, v: 0.6 }]);
  const cubic = 'M0.1 0.2 C0.2 0.1 0.7 0.9 0.8 0.7';
  assert.deepEqual(nailPathAnchorsV7(cubic), [
    { u: 0.1, v: 0.2 },
    { u: 0.2, v: 0.1 },
    { u: 0.7, v: 0.9 },
    { u: 0.8, v: 0.7 },
  ]);
  assert.deepEqual(nailPathAnchorsV7(moveNailPathAnchorV7(cubic, 2, { u: 0.6, v: 0.4 }))[2], { u: 0.6, v: 0.4 });
  const transform = { position: { u: 0.64, v: 0.41 }, scaleX: 0.72, scaleY: 1.18, rotationDeg: 31 };
  const transformed = transformNailPointV7({ u: 0.23, v: 0.76 }, transform);
  const restored = inverseTransformNailPointV7(transformed, transform);
  assert.ok(Math.abs(restored.u - 0.23) < 1e-10);
  assert.ok(Math.abs(restored.v - 0.76) < 1e-10);
  console.log('[v7-flat] pointer materialization and anchor edit: PASS');
}

// Ordered mask semantics are non-destructive: later masks affect prior content only; step mask wins region scope.
{
  const brush = createPointerFlatElementV7({ id: 'element.order.brush', tool: 'brush', points: [{ u: 0.1, v: 0.2 }, { u: 0.8, v: 0.7 }], color, widthMm: 0.5 });
  const eraser = createPointerFlatElementV7({ id: 'element.order.eraser', tool: 'eraser', points: [{ u: 0.2, v: 0.2 }, { u: 0.3, v: 0.4 }], color, widthMm: 0.7 });
  const mask = createRegionMaskFlatElementV7('element.order.mask', rectanglePathDataV7({ u: 0.1, v: 0.1 }, { u: 0.9, v: 0.9 }));
  const after = createVectorFlatElementV7({ id: 'element.order.after', pathData: linePathDataV7({ u: 0, v: 0 }, { u: 1, v: 1 }), color, appearance: 'stroke' });
  const step = { ...createFlatStep('step.order'), elements: [brush, eraser, mask, after] };
  assert.deepEqual(resolveFlatElementMaskScopeV7(step, 0), { stepMask: false, eraserMaskIds: [eraser.id], regionMaskIds: [mask.id] });
  assert.deepEqual(resolveFlatElementMaskScopeV7(step, 3), { stepMask: false, eraserMaskIds: [], regionMaskIds: [] });
  const originalBrush = clone(brush);
  step.mask = clone(mask.mask);
  assert.deepEqual(resolveFlatElementMaskScopeV7(step, 0), { stepMask: true, eraserMaskIds: [eraser.id], regionMaskIds: [] });
  assert.deepEqual(brush, originalBrush);
  console.log('[v7-flat] ordered non-destructive eraser/region masks: PASS');
}

// Pure commands reject invalid paths/opacity and preserve the previous document atomically.
{
  const doc = createMinimalEditorDocV7Fixture();
  const inserted = addEditorV7Step(doc, 'L1', createFlatStep(), 1);
  assert.equal(inserted.ok, true);
  const brush = createPointerFlatElementV7({ id: 'element.command.brush', tool: 'brush', points: [{ u: 0.1, v: 0.2 }, { u: 0.9, v: 0.8 }], color, widthMm: 0.5 });
  const added = addEditorV7Element(inserted.doc, 'L1', 'step.L1.flat-v7-07', brush);
  assert.equal(added.ok, true);
  const before = clone(added.doc);
  assert.equal(setEditorV7FlatElementOpacity(added.doc, 'L1', 'step.L1.flat-v7-07', brush.id, 1.1).reason, 'invalid_value');
  const vector = createVectorFlatElementV7({ id: 'element.command.vector', pathData: linePathDataV7({ u: 0, v: 0 }, { u: 1, v: 1 }), color, appearance: 'stroke' });
  const vectorAdded = addEditorV7Element(added.doc, 'L1', 'step.L1.flat-v7-07', vector);
  assert.equal(vectorAdded.ok, true);
  assert.equal(replaceEditorV7FlatElement(vectorAdded.doc, 'L1', 'step.L1.flat-v7-07', vector.id, vector).reason, 'not_allowed');
  assert.equal(replaceEditorV7FlatElement(vectorAdded.doc, 'L1', 'step.L1.flat-v7-07', vector.id, { ...vector, pathData: 'M0 0 A1 1 0 0 0 1 1' }).reason, 'invalid_value');
  assert.deepEqual(added.doc, before);
  const locked = clone(added.doc);
  locked.nails.L1.steps[1].locked = true;
  assert.equal(setEditorV7FlatElementOpacity(locked, 'L1', 'step.L1.flat-v7-07', brush.id, 0.5).reason, 'locked');
  console.log('[v7-flat] atomic path/opacity/lock command gates: PASS');
}

// Store: one gesture result is one revision/history/autosave; save/reload/undo/redo and single-finger gates hold.
{
  const doc = createMinimalEditorDocV7Fixture();
  const { storage, store } = runtime(doc);
  assert.equal(await store.getState().load(doc.designId), 'ok');
  assert.equal(store.getState().addStep('L1', createFlatStep(), 1).ok, true);
  const afterStepRevision = store.getState().doc.revision;
  const l2Before = clone(store.getState().doc.nails.L2);
  const brush = createPointerFlatElementV7({ id: 'element.store.brush', tool: 'brush', points: [{ u: 0.1, v: 0.2 }, { u: 0.4, v: 0.5 }, { u: 0.9, v: 0.8 }], color, widthMm: 0.45 });
  assert.equal(store.getState().addElement('L1', 'step.L1.flat-v7-07', brush).ok, true);
  assert.equal(store.getState().doc.revision, afterStepRevision + 1);
  assert.deepEqual(store.getState().doc.nails.L2, l2Before);
  assert.equal(store.getState().setFlatElementOpacity('L1', 'step.L1.flat-v7-07', brush.id, 0.42).ok, true);
  const disposable = createVectorFlatElementV7({ id: 'element.store.disposable', pathData: linePathDataV7({ u: 0.2, v: 0.2 }, { u: 0.8, v: 0.8 }), color, appearance: 'stroke' });
  assert.equal(store.getState().addElement('L1', 'step.L1.flat-v7-07', disposable).ok, true);
  store.getState().selectElement(disposable.id);
  assert.equal(store.getState().removeElement('L1', 'step.L1.flat-v7-07', disposable.id).ok, true);
  assert.equal(store.getState().selectedElementId, null);
  assert.equal(store.getState().undo().ok, true);
  assert.equal(store.getState().doc.nails.L1.steps[1].elements.some((element) => element.id === disposable.id), true);
  assert.equal(store.getState().redo().ok, true);
  assert.equal(store.getState().doc.nails.L1.steps[1].elements.some((element) => element.id === disposable.id), false);
  assert.equal(store.getState().doc.nails.L1.steps[1].elements[0].opacity, 0.42);
  assert.equal(await store.getState().save(), 'saved');
  assert.equal(storage.writes, 1);

  const reloaded = createEditorV7Store({ repository: createEditorDocV7Repository(storage, resolvers) });
  assert.equal(await reloaded.getState().load(doc.designId), 'ok');
  assert.equal(reloaded.getState().doc.nails.L1.steps[1].elements[0].points.length, 3);
  assert.equal(reloaded.getState().doc.nails.L1.steps[1].elements[0].opacity, 0.42);
  reloaded.setState({ switching: true });
  assert.equal(reloaded.getState().setFlatElementOpacity('L1', 'step.L1.flat-v7-07', brush.id, 0.2).reason, 'busy');
  reloaded.setState({ switching: false });
  assert.equal(await reloaded.getState().load(doc.designId, { readOnly: true }), 'ok');
  assert.equal(reloaded.getState().setFlatElementOpacity('L1', 'step.L1.flat-v7-07', brush.id, 0.2).reason, 'read_only');
  console.log('[v7-flat] store revision/history/save/reload/single-finger/gates: PASS');
}

// The actual UI converts pointer client coordinates before persistence and clips every derived layer to geometry.
{
  const canvasSource = await readFile(new URL('../src/studio/editor/components/V7FlatDesignCanvas.tsx', import.meta.url), 'utf8');
  assert.match(canvasSource, /getScreenCTM\(\)/);
  assert.match(canvasSource, /matrixTransform\(matrix\.inverse\(\)\)/);
  assert.match(canvasSource, /clipPath={`url\(#\$\{clipId\}\)`}/);
  assert.match(canvasSource, /setPointerCapture/);
  assert.match(canvasSource, /createPointerFlatElementV7/);
  assert.match(canvasSource, /widthMm \* MM_TO_CANVAS_UNITS/);
  assert.match(canvasSource, /if \(activeTool !== 'select'\) return;/);
  assert.match(canvasSource, /strokeOpacity={eraser\.opacity}/);
  assert.match(canvasSource, /opacity={region\.mask\.inverted \? 1 : 1 - region\.opacity}/);
  assert.match(canvasSource, /fillOpacity={region\.mask\.inverted \? region\.opacity : 1}/);
  assert.doesNotMatch(canvasSource, /screenX|screenY|offsetX|offsetY/);
  console.log('[v7-flat] real pointer conversion and geometry clip wiring: PASS');
}

console.log('[v7-flat] all behavior checks passed');
