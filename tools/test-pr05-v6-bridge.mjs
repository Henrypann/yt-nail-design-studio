#!/usr/bin/env node
import assert from 'node:assert/strict';

const { openBridgeWithDeps, wizardToEditorDocV6 } = await import('../src/studio/bridge/index.ts');
const { parseEditorDocV6 } = await import('../src/studio/editor/v6/schema.ts');
const { getEditorDocV6Result, saveEditorDocV6ToMap } = await import(
  '../src/studio/editor/v6/repository-contract.ts'
);
const { createMercuryInstance } = await import('../src/studio/editor/lib/recipe-model.ts');
const { editorDocV3Fixture, editorDocV4Fixture, editorDocV5Fixture } = await import(
  '../src/studio/editor/fixtures/legacy/index.mjs'
);

const summary = {
  id: 'wizard-v6-1',
  customerId: 'customer-1',
  title: 'V6 Bridge',
  shape: 'almond',
  length: 'medium',
  templateId: 't_french_white',
  baseColor: '#f5e0d3',
  finish: 'matte',
  fingerOverrides: { R4: { baseColor: '#ffffff', decorationId: 'heart' } },
  recipe: createMercuryInstance('signature', '#f5e0d3'),
  status: 'draft',
  source: 'wizard',
  version: 1,
  createdAt: '2026-08-07T00:00:00.000Z',
  updatedAt: '2026-08-07T00:00:00.000Z',
};

const converted = wizardToEditorDocV6(summary);
const parsed = parseEditorDocV6(converted);
assert.equal(parsed.ok, true, parsed.reason);
assert.equal(converted.schemaVersion, 6);
assert.deepEqual(converted.defaultGeometry, { shape: 'almond', length: 'medium' });
assert.equal(converted.appearance.topFinish, 'matte');
assert.equal(converted.nails.R4.layers[0].surface.baseColor, '#ffffff');
assert.equal(converted.nails.L1.layers[0].surface.baseColor, '#f5e0d3');
assert.equal(converted.nails.R4.layers.some((layer) => layer.typeId === 'builtin.attachment'), true);
assert.equal(Object.keys(converted.recipeInstances).length, 1);

const allIds = [];
for (const nail of Object.values(converted.nails)) {
  for (const layer of nail.layers) {
    allIds.push(layer.id, ...layer.elements.map((element) => element.id));
  }
}
assert.equal(new Set(allIds).size, allIds.length, 'layer/element IDs must be globally unique');
assert.equal(
  Object.values(converted.nails).every((nail) =>
    nail.layers.some((layer) => layer.elements.some(
      (element) => element.kind === 'template_pattern' && element.templateId === summary.templateId,
    )),
  ),
  true,
  'template reference must be preserved on every finger',
);

function harness(initialDocs = {}) {
  const docs = structuredClone(initialDocs);
  const navigations = [];
  let saves = 0;
  return {
    docs,
    navigations,
    get saves() { return saves; },
    deps: {
      getDesign: (id) => id === summary.id ? summary : undefined,
      getEditorDoc: (id) => getEditorDocV6Result(docs, id),
      saveEditorDoc: (doc) => {
        saves += 1;
        return saveEditorDocV6ToMap(docs, doc);
      },
      navigate: (url) => navigations.push(url),
    },
  };
}

const exact = harness();
assert.deepEqual(openBridgeWithDeps(summary.id, exact.deps), { ok: true, mode: 'created' });
const storedAfterFirst = JSON.stringify(exact.docs[summary.id]);
assert.deepEqual(openBridgeWithDeps(summary.id, exact.deps), { ok: true, mode: 'existing' });
assert.equal(exact.saves, 1);
assert.equal(JSON.stringify(exact.docs[summary.id]), storedAfterFirst);
assert.deepEqual(exact.navigations, [
  '/design/canvas?bridge=wizard-v6-1',
  '/design/canvas?design=wizard-v6-1',
]);

const existing = harness({ [summary.id]: converted });
const existingBefore = JSON.stringify(existing.docs);
assert.equal(openBridgeWithDeps(summary.id, existing.deps).ok, true);
assert.equal(existing.saves, 0);
assert.equal(JSON.stringify(existing.docs), existingBefore);

// Supported legacy versions use the repository migration boundary and are
// never rebuilt from the Wizard summary.
for (const fixture of [editorDocV3Fixture, editorDocV4Fixture, editorDocV5Fixture]) {
  const legacyRaw = { ...structuredClone(fixture), designId: summary.id };
  const legacy = harness({ [summary.id]: legacyRaw });
  const before = JSON.stringify(legacy.docs);
  assert.deepEqual(openBridgeWithDeps(summary.id, legacy.deps), { ok: true, mode: 'existing' });
  assert.equal(legacy.saves, 0);
  assert.equal(JSON.stringify(legacy.docs), before);
  assert.deepEqual(legacy.navigations, ['/design/canvas?design=wizard-v6-1']);
}

for (const [raw, reason] of [
  [{ schemaVersion: 6, designId: summary.id }, 'editor_doc_invalid'],
  [{ schemaVersion: 99, designId: summary.id }, 'editor_doc_unsupported'],
]) {
  const blocked = harness({ [summary.id]: raw });
  const before = JSON.stringify(blocked.docs);
  assert.deepEqual(openBridgeWithDeps(summary.id, blocked.deps), { ok: false, reason });
  assert.equal(blocked.saves, 0);
  assert.deepEqual(blocked.navigations, []);
  assert.equal(JSON.stringify(blocked.docs), before);
}

const failed = harness();
failed.deps.saveEditorDoc = () => ({ status: 'rejected', reason: 'quota' });
assert.deepEqual(openBridgeWithDeps(summary.id, failed.deps), {
  ok: false,
  reason: 'save_failed',
});
assert.deepEqual(failed.navigations, []);

assert.deepEqual(openBridgeWithDeps('missing', harness().deps), {
  ok: false,
  reason: 'design_not_found',
});

console.log('test-pr05-v6-bridge: schema, exactly-once and protection gates PASS');
