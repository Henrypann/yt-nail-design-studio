/** PR-07 contract guards complementing the real store behavior suite. */

import { strict as assert } from 'node:assert';
import { readFile } from 'node:fs/promises';

const memory = new Map();
globalThis.localStorage = {
  getItem: (key) => memory.get(key) ?? null,
  setItem: (key, value) => memory.set(key, String(value)),
  removeItem: (key) => memory.delete(key),
  clear: () => memory.clear(),
};
let timerId = 0;
globalThis.setTimeout = () => ++timerId;
globalThis.clearTimeout = () => undefined;

/* ── 1. Store v6 layer operations ────────────────────────── */

const modelMod = await import('../src/studio/editor/v6/model.ts');
const { createEmptyEditorDocV6, FINGER_CODES } = modelMod;

{
  const doc = createEmptyEditorDocV6({ designId: 'pr07-test' });

  // Initial state: each finger has 1 base layer
  for (const finger of FINGER_CODES) {
    assert.equal(doc.nails[finger].layers.length, 1);
    assert.equal(doc.nails[finger].layers[0].typeId, 'builtin.base_surface');
  }

  // Simulate adding a draw layer to R4
  doc.nails['R4'].layers.push({
    id: 'layer_draw_r4',
    name: '手绘',
    typeId: 'builtin.draw',
    visible: true,
    locked: false,
    order: 1,
    elements: [],
  });
  assert.equal(doc.nails['R4'].layers.length, 2);

  // Simulate adding an element to the draw layer
  doc.nails['R4'].layers[1].elements.push({
    id: 'el_brush_1',
    domain: 'pattern',
    kind: 'brush',
    name: '笔画',
    visible: true,
    locked: false,
    order: 0,
    points: [
      { x: 0, y: 0 },
      { x: 10, y: 10 },
    ],
    color: '#C2497A',
    size: 12,
    opacity: 1,
  });
  assert.equal(doc.nails['R4'].layers[1].elements.length, 1);
  assert.equal(doc.nails['R4'].layers[1].elements[0].kind, 'brush');

  // Simulate cross-finger copy (R4 draw layer → L4)
  const srcLayer = doc.nails['R4'].layers[1];
  doc.nails['L4'].layers.push({
    ...structuredClone(srcLayer),
    id: 'layer_draw_l4',
    order: 1,
    elements: srcLayer.elements.map((el) => ({
      ...structuredClone(el),
      id: 'el_brush_1_l4',
      order: 0,
    })),
  });
  assert.equal(doc.nails['L4'].layers.length, 2);
  assert.equal(doc.nails['L4'].layers[1].elements[0].id, 'el_brush_1_l4');

  console.log('[test:v6-layer-ops] PASS');
}

/* ── 2. Layer panel must use a reactive store selector ───── */

{
  const source = await readFile(
    new URL('../src/studio/editor/components/LayerPanelV6.tsx', import.meta.url),
    'utf8',
  );
  assert.match(source, /useEditorV6Store\(selectCurrentNail\)/);
  assert.doesNotMatch(source, /selectCurrentNail\(useEditorV6Store\.getState\(\)\)/);
console.log('[test:layer-panel-v6-subscription] PASS');
}

/* ── 3. Real V6 interaction, history, permission and mirror ───── */

{
  const { parseEditorDocV6 } = await import('../src/studio/editor/v6/schema.ts');
  const { readElementTransform } = await import('../src/studio/editor/v6/interaction.ts');
  const { useEditorV6Store } = await import('../src/studio/editor/store-v6.ts');
  const runtimeDoc = createEmptyEditorDocV6({ designId: 'pr07-runtime' });
  useEditorV6Store.setState({
    designId: runtimeDoc.designId,
    status: 'draft',
    doc: runtimeDoc,
    readOnly: false,
    currentFinger: 'R4',
    selectedFingers: ['R4'],
    activeLayerId: runtimeDoc.nails.R4.layers[0].id,
    selectedElementId: null,
    history: [],
    future: [],
    saveState: 'saved',
    autosave: { revision: 0, lastSavedRevision: 0, pendingRevision: null },
    autosaveTimer: null,
  });
  const store = useEditorV6Store.getState();
  store.addElementToLayerOnCurrent('builtin.art_2d', '2D Art', {
    id: 'runtime-element',
    domain: 'pattern',
    kind: 'template_pattern',
    name: 'Runtime element',
    visible: true,
    locked: false,
    order: 0,
    transform: { x: 12, y: -72, scale: 1, rotation: 24 },
  });
  let state = useEditorV6Store.getState();
  assert.equal(state.selectedElementId, 'runtime-element');
  assert.equal(state.history.length, 1);
  state.updateSelectedElementTransform({ x: 30, scale: 8 });
  state = useEditorV6Store.getState();
  let active = state.doc.nails.R4.layers.find((layer) => layer.id === state.activeLayerId);
  let element = active.elements.find((candidate) => candidate.id === 'runtime-element');
  assert.deepEqual(readElementTransform(element), { x: 30, y: -72, scale: 4, rotation: 24 });

  state.toggleSelectedElementLocked();
  const revisionBeforeBlockedMove = useEditorV6Store.getState().doc.revision;
  useEditorV6Store.getState().nudgeSelectedElement(10, 0);
  assert.equal(useEditorV6Store.getState().doc.revision, revisionBeforeBlockedMove);
  useEditorV6Store.getState().toggleSelectedElementLocked();
  useEditorV6Store.getState().nudgeSelectedElement(-5, 2);
  state = useEditorV6Store.getState();
  active = state.doc.nails.R4.layers.find((layer) => layer.id === state.activeLayerId);
  element = active.elements.find((candidate) => candidate.id === 'runtime-element');
  assert.equal(readElementTransform(element).x, 25);
  assert.equal(readElementTransform(element).y, -70);

  const mirroredFinger = state.mirrorActiveLayerToOpposite();
  assert.equal(mirroredFinger, 'L4');
  state = useEditorV6Store.getState();
  const mirroredLayer = state.doc.nails.L4.layers.at(-1);
  assert.equal(mirroredLayer.elements.length, 1);
  assert.notEqual(mirroredLayer.elements[0].id, element.id);
  assert.equal(readElementTransform(mirroredLayer.elements[0]).x, -25);
  assert.equal(readElementTransform(mirroredLayer.elements[0]).rotation, -24);
  assert.equal(parseEditorDocV6(state.doc).ok, true);

  const beforeReadOnly = JSON.stringify(state.doc);
  useEditorV6Store.setState({ readOnly: true });
  useEditorV6Store.getState().updateSelectedElementTransform({ rotation: 90 });
  assert.equal(JSON.stringify(useEditorV6Store.getState().doc), beforeReadOnly);
  console.log('[test:v6-interaction-runtime] PASS');
}

/* ── 4. Production shell contains V6 canvas/output and responsive gates ── */

{
  const shell = await readFile(new URL('../src/studio/editor/components/EditorShellV6.tsx', import.meta.url), 'utf8');
  const canvas = await readFile(new URL('../src/studio/editor/components/V6NailCanvas.tsx', import.meta.url), 'utf8');
  const output = await readFile(new URL('../src/studio/editor/components/V6OutputPanel.tsx', import.meta.url), 'utf8');
  assert.match(shell, /<V6NailCanvas \/>/);
  assert.match(shell, /<V6ElementInspector \/>/);
  assert.match(shell, /<V6OutputPanel \/>/);
  assert.match(shell, /lg:flex-row/);
  assert.match(shell, /max-h-52/);
  assert.match(canvas, /registerPreviewSvg/);
  assert.match(canvas, /data-canvas-mode="overview"/);
  assert.match(output, /resolveRenderer/);
  assert.match(output, /manufacturing unverified/);
  console.log('[test:v6-shell-output-responsive-contract] PASS');
}

/* ── Done ────────────────────────────────────────────────── */

console.log('\ntest-pr07-editor-v6-ux: all assertions passed');
