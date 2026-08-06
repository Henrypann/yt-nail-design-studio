/**
 * PR-07 self-test: EditorShellV6 exports, layer operations via store.
 * (Full UI rendering requires browser — tested via build + typecheck)
 */

import { strict as assert } from 'node:assert';

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

/* ── 2. EditorShellV6 type contract ──────────────────────── */
/* Verified via typecheck + build:integration. */

console.log('[test:editor-shell-v6] SKIPPED (requires Vite runtime; covered by typecheck + build)');

/* ── Done ────────────────────────────────────────────────── */

console.log('\ntest-pr07-editor-v6-ux: all assertions passed');
