/**
 * PR-04 self-test: EditorDocV6 store runtime, autosave, and repo-v6 persistence.
 * Runs without browser — pure Node assertions over the v6 contract.
 */

import { strict as assert } from 'node:assert';

/* ── 1. Autosave revision state ──────────────────────────── */

const autosaveMod = await import('../src/studio/editor/lib/autosave-v6.ts');
const {
  createRevisionState,
  bumpRevision,
  scheduleAutosave,
  flushAutosave,
  applySaveResult,
  AUTOSAVE_DEBOUNCE_MS,
} = autosaveMod;

{
  const state = createRevisionState();
  assert.equal(state.revision, 0);
  assert.equal(state.lastSavedRevision, 0);
  assert.equal(state.pendingRevision, null);

  const rev1 = bumpRevision(state);
  assert.equal(rev1, 1);
  assert.equal(state.revision, 1);
  assert.equal(state.pendingRevision, 1);

  const rev2 = bumpRevision(state);
  assert.equal(rev2, 2);
  assert.equal(state.pendingRevision, 2);

  const flushed = flushAutosave(state);
  assert.equal(flushed, 2);
  assert.equal(state.pendingRevision, null);

  const applied = applySaveResult(state, flushed);
  assert.equal(applied, true);
  assert.equal(state.lastSavedRevision, 2);

  // Stale save should be rejected
  const stale = applySaveResult(state, 1);
  assert.equal(stale, false);
  assert.equal(state.lastSavedRevision, 2);

  // Debounce constant
  assert.equal(AUTOSAVE_DEBOUNCE_MS, 2000);

  console.log('[test:autosave-v6] PASS');
}

/* ── 2. V6 model creation ────────────────────────────────── */

const modelMod = await import('../src/studio/editor/v6/model.ts');
const { createEmptyEditorDocV6, FINGER_CODES } = modelMod;

{
  const doc = createEmptyEditorDocV6({ designId: 'test-001' });
  assert.equal(doc.schemaVersion, 6);
  assert.equal(doc.designId, 'test-001');
  assert.equal(doc.title, '未命名设计');
  assert.equal(doc.defaultGeometry.shape, 'almond');
  assert.equal(doc.defaultGeometry.length, 'medium');
  assert.equal(doc.revision, 1);
  assert.ok(doc.createdAt);
  assert.ok(doc.updatedAt);

  // All 10 fingers present
  for (const finger of FINGER_CODES) {
    assert.ok(doc.nails[finger], `missing nail for ${finger}`);
    assert.equal(doc.nails[finger].finger, finger);
    assert.ok(doc.nails[finger].layers.length >= 1, `missing base layer for ${finger}`);
    assert.equal(doc.nails[finger].layers[0].typeId, 'builtin.base_surface');
  }

  // Recipe instances empty
  assert.deepEqual(doc.recipeInstances, {});
  assert.deepEqual(doc.communicationRefs, []);

  console.log('[test:v6-model] PASS');
}

/* ── 3. V6 schema validation ─────────────────────────────── */

const schemaMod = await import('../src/studio/editor/v6/schema.ts');
const { parseEditorDocV6, validateEditorDocV6 } = schemaMod;

{
  const doc = createEmptyEditorDocV6({ designId: 'schema-test' });
  assert.ok(validateEditorDocV6(doc), 'valid v6 doc should pass');

  const result = parseEditorDocV6(doc);
  assert.ok(result.ok);
  if (result.ok) {
    assert.equal(result.doc.designId, 'schema-test');
  }

  // Reject non-v6
  assert.ok(!validateEditorDocV6({ schemaVersion: 3 }));
  assert.ok(!validateEditorDocV6(null));
  assert.ok(!validateEditorDocV6({ schemaVersion: 6 })); // missing required fields

  console.log('[test:v6-schema] PASS');
}

/* ── 4. V6 migration from v1-v3 ──────────────────────────── */

const migrateMod = await import('../src/studio/editor/v6/migrate.ts');
const { migrateEditorDocV6 } = migrateMod;

{
  // Simulate a v3 document
  const v3Doc = {
    schemaVersion: 3,
    designId: 'migrate-v3',
    shape: 'almond',
    length: 'medium',
    baseColor: '#FF0000',
    pattern: [],
    attachments: [],
    relief: [],
    fingerLocks: {},
    masterFinger: 'R4',
    updatedAt: '2026-08-01T00:00:00.000Z',
  };

  const result = migrateEditorDocV6(v3Doc);
  assert.equal(result.status, 'ok');
  if (result.status === 'ok') {
    assert.equal(result.doc.schemaVersion, 6);
    assert.equal(result.doc.designId, 'migrate-v3');
    assert.equal(result.doc.defaultGeometry.shape, 'almond');
    assert.ok(result.migrated);
  }

  // Unsupported version
  const futureDoc = { schemaVersion: 99 };
  const futureResult = migrateEditorDocV6(futureDoc);
  assert.equal(futureResult.status, 'unsupported');

  console.log('[test:v6-migrate-runtime] PASS');
}

/* ── 5. Repository contract ──────────────────────────────── */

const repoContractMod = await import('../src/studio/editor/v6/repository-contract.ts');
const { saveEditorDocV6ToMap, getEditorDocV6Result, inspectEditorDocV6Raw } = repoContractMod;

{
  const map = {};
  const doc = createEmptyEditorDocV6({ designId: 'repo-test' });

  // Save
  const saveResult = saveEditorDocV6ToMap(map, doc);
  assert.equal(saveResult.status, 'ok');

  // Load
  const loadResult = getEditorDocV6Result(map, 'repo-test');
  assert.equal(loadResult.status, 'ok');
  if (loadResult.status === 'ok') {
    assert.equal(loadResult.doc.designId, 'repo-test');
    assert.equal(loadResult.doc.schemaVersion, 6);
  }

  // Missing
  const missing = getEditorDocV6Result(map, 'nonexistent');
  assert.equal(missing.status, 'missing');

  // Storage key mismatch: key exists but designId differs
  map['mismatch-key'] = { ...structuredClone(map['repo-test']), designId: 'different-id' };
  // (already saved above)
  const mismatch = getEditorDocV6Result(map, 'mismatch-key');
  assert.equal(mismatch.status, 'invalid');

  // Inspect
  const probe = inspectEditorDocV6Raw(map['repo-test']);
  assert.equal(probe.present, true);
  assert.equal(probe.schemaVersion, 6);
  assert.equal(probe.kind, 'supported');

  const futureProbe = inspectEditorDocV6Raw({ schemaVersion: 99 });
  assert.equal(futureProbe.present, true);
  assert.equal(futureProbe.kind, 'unsupported');

  const missingProbe = inspectEditorDocV6Raw(null);
  assert.equal(missingProbe.present, false);

  console.log('[test:repo-contract] PASS');
}

/* ── 6. Layer operations ─────────────────────────────────── */

{
  const doc = createEmptyEditorDocV6({ designId: 'layer-test' });
  const nail = doc.nails['R4'];
  const baseLayer = nail.layers[0];

  // Add a pattern layer
  nail.layers.push({
    id: 'layer_pattern_1',
    name: '手绘',
    typeId: 'builtin.draw',
    visible: true,
    locked: false,
    order: 1,
    elements: [],
  });

  // Add element to pattern layer
  nail.layers[1].elements.push({
    id: 'el_brush_1',
    domain: 'pattern',
    kind: 'brush',
    visible: true,
    locked: false,
    order: 0,
  });

  assert.equal(nail.layers.length, 2);
  assert.equal(nail.layers[1].elements.length, 1);
  assert.equal(nail.layers[1].elements[0].kind, 'brush');

  console.log('[test:layer-ops] PASS');
}

/* ── 7. Duplicate and version ────────────────────────────── */

{
  const map = {};
  const doc = createEmptyEditorDocV6({ designId: 'dup-source' });
  saveEditorDocV6ToMap(map, doc);

  // Simulate duplicate
  const sourceResult = getEditorDocV6Result(map, 'dup-source');
  assert.equal(sourceResult.status, 'ok');
  if (sourceResult.status === 'ok') {
    const newDoc = {
      ...structuredClone(sourceResult.doc),
      designId: 'dup-target',
      revision: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const dupResult = saveEditorDocV6ToMap(map, newDoc);
    assert.equal(dupResult.status, 'ok');

    const loadDup = getEditorDocV6Result(map, 'dup-target');
    assert.equal(loadDup.status, 'ok');
    if (loadDup.status === 'ok') {
      assert.equal(loadDup.doc.designId, 'dup-target');
      assert.equal(loadDup.doc.revision, 1);
    }
  }

  console.log('[test:duplicate] PASS');
}

/* ── Done ────────────────────────────────────────────────── */

console.log('\ntest-store-v6: all assertions passed');
