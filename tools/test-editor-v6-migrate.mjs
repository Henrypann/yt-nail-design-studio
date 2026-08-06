import { strict as assert } from 'node:assert';
import { migrateEditorDocV6 } from '../src/studio/editor/v6/migrate.ts';
import { generateEditorId } from '../src/studio/editor/v6/id.ts';
import { validateEditorDocV6 } from '../src/studio/editor/v6/schema.ts';
import {
  getEditorDocV6Result,
  saveEditorDocV6ToMap,
} from '../src/studio/editor/v6/repository-contract.ts';
import { editorDocV6Fixture } from '../src/studio/editor/fixtures/editor-doc-v6.mjs';
import {
  FINGER_CODES,
  legacyEditorDocFixtures,
  editorDocV1Fixture,
  editorDocV2Fixture,
  editorDocV3Fixture,
  editorDocV4Fixture,
  editorDocV5Fixture,
} from '../src/studio/editor/fixtures/legacy/index.mjs';

function clone(value) {
  return structuredClone(value);
}

function freeze(value) {
  return Object.freeze(structuredClone(value));
}

function collectIds(doc) {
  const ids = [];
  for (const finger of FINGER_CODES) {
    for (const layer of doc.nails[finger].layers) {
      ids.push(layer.id);
      for (const element of layer.elements) ids.push(element.id);
    }
  }
  return ids;
}

function assertTenFingers(doc) {
  assert.deepEqual(Object.keys(doc.nails).sort(), [...FINGER_CODES].sort());
  for (const finger of FINGER_CODES) {
    assert.equal(doc.nails[finger].finger, finger);
    const layers = doc.nails[finger].layers;
    assert.deepEqual(
      layers.map((layer) => layer.order),
      layers.map((_, index) => index),
    );
  }
}

/* missing / invalid / unsupported */
assert.equal(migrateEditorDocV6(undefined).status, 'missing');
assert.equal(migrateEditorDocV6(null).status, 'missing');
assert.equal(migrateEditorDocV6('nope').status, 'invalid');
assert.deepEqual(migrateEditorDocV6({ schemaVersion: 9 }), {
  status: 'unsupported',
  version: 9,
});

/* every legacy version → v6 */
for (const fixture of legacyEditorDocFixtures) {
  const frozen = freeze(fixture);
  const before = JSON.stringify(frozen);
  const result = migrateEditorDocV6(frozen);
  assert.equal(JSON.stringify(frozen), before, `fixture v${fixture.schemaVersion} must stay frozen`);
  assert.equal(result.status, 'ok', `v${fixture.schemaVersion} should migrate`);
  assert.equal(result.migrated, true);
  assert.equal(result.doc.schemaVersion, 6);
  assert.equal(result.doc.designId, fixture.designId);
  assert.equal(result.doc.revision, 1);
  assert.equal(result.doc.createdAt, fixture.updatedAt);
  assert.equal(result.doc.outputIntent, 'design');
  assertTenFingers(result.doc);
  const ids = collectIds(result.doc);
  assert.equal(new Set(ids).size, ids.length, `v${fixture.schemaVersion} IDs unique`);
}

/* idempotence: v6 → v6 */
{
  const once = migrateEditorDocV6(clone(editorDocV6Fixture));
  assert.equal(once.status, 'ok');
  assert.equal(once.migrated, false);
  const twice = migrateEditorDocV6(clone(once.doc));
  assert.equal(twice.status, 'ok');
  assert.equal(twice.migrated, false);
  assert.deepEqual(twice.doc, once.doc);
}

/* v1 finish + lengthPreset defaults */
{
  const result = migrateEditorDocV6(clone(editorDocV1Fixture));
  assert.equal(result.status, 'ok');
  assert.deepEqual(result.doc.appearance, {
    baseCoverage: 'opaque',
    opticalEffect: 'pearl',
    topFinish: 'gloss',
  });
  assert.equal(result.doc.lengthPreset, 'short-extension');
  assert.equal(result.doc.title, '未命名设计');
}

/* v3 recipe + relief preservation */
{
  const result = migrateEditorDocV6(clone(editorDocV3Fixture));
  assert.equal(result.status, 'ok');
  const recipeId = `recipe_${editorDocV3Fixture.designId}`;
  assert.ok(result.doc.recipeInstances[recipeId]);
  assert.deepEqual(result.doc.recipeInstances[recipeId].recipe, editorDocV3Fixture.recipe);
  for (const finger of FINGER_CODES) {
    const reliefLayer = result.doc.nails[finger].layers.find((layer) => layer.typeId === 'builtin.relief');
    assert.ok(reliefLayer, `relief layer on ${finger}`);
    assert.equal(reliefLayer.elements[0].id, `relief_legacy_01__${finger}`);
    assert.equal(reliefLayer.elements[0].kind, 'custom_relief');
    assert.equal(reliefLayer.elements[0].heightMm, 0.1);
    assert.deepEqual(reliefLayer.elements[0].uv, { u: 0.5, v: 0.4 });
  }
}

/* v2 sparse finger override is preserved as independent finger content */
{
  const result = migrateEditorDocV6(clone(editorDocV2Fixture));
  assert.equal(result.status, 'ok');
  const l1Base = result.doc.nails.L1.layers.find((layer) => layer.typeId === 'builtin.base_surface');
  const l2Base = result.doc.nails.L2.layers.find((layer) => layer.typeId === 'builtin.base_surface');
  assert.equal(l1Base.surface.baseColor, '#CFA89B');
  assert.equal(l2Base.surface.baseColor, '#D8B7AA');
  assert.equal(result.doc.nails.L1.layers.find((layer) => layer.typeId === 'builtin.draw').elements[0].id, 'brush_legacy_l1__L1');
}

/* v4/v5 appearance canonical + communication refs + stepId */
{
  const v4 = migrateEditorDocV6(clone(editorDocV4Fixture));
  assert.equal(v4.status, 'ok');
  assert.deepEqual(v4.doc.appearance, editorDocV4Fixture.appearance);
  assert.equal(v4.doc.nails.L1.layers[0].surface?.appearance, undefined);
  assert.deepEqual(v4.doc.communicationRefs, []);
  const v4Draw = v4.doc.nails.L1.layers.find((layer) => layer.typeId === 'builtin.draw');
  assert.equal(v4Draw.elements[0].id, 'brush_cursor_l1');
  assert.deepEqual(v4Draw.elements[0].points, [{ x: 0, y: -8 }, { x: 2, y: -14 }]);

  const v5 = migrateEditorDocV6(clone(editorDocV5Fixture));
  assert.equal(v5.status, 'ok');
  assert.equal(v5.doc.nails.L1.layers[0].stepId, 'base_color');
  assert.equal(v5.doc.communicationRefs[0].dataUrl, 'data:image/png;base64,AA==');
}

/* every successful legacy migration must satisfy the complete v6 validator */
for (const fixture of legacyEditorDocFixtures) {
  const result = migrateEditorDocV6(clone(fixture));
  assert.equal(result.status, 'ok');
  assert.equal(validateEditorDocV6(result.doc), true);
}

/* unknown element → invalid */
{
  const bad = clone(editorDocV1Fixture);
  bad.pattern = [{ id: 'x', kind: 'mystery_blob' }];
  assert.equal(migrateEditorDocV6(bad).status, 'invalid');
}

/* ProjectV4 projection is not an EditorDoc adapter input */
{
  const projectV4 = {
    schemaVersion: 4,
    projectId: 'project_fixture',
    designId: 'design_fixture_project',
    shape: 'almond',
    length: 'medium',
    layers: [],
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
  assert.equal(migrateEditorDocV6(projectV4).status, 'invalid');
}

/* dual-write legacy fields rejected on save */
{
  const dual = {
    ...clone(editorDocV6Fixture),
    shape: 'almond',
    baseColor: '#fff',
  };
  const map = {};
  const result = saveEditorDocV6ToMap(map, dual);
  assert.equal(result.status, 'invalid');
  assert.equal(Object.keys(map).length, 0);
}

/* repository: no write on read + save rejects non-v6 */
{
  const map = {
    [editorDocV3Fixture.designId]: clone(editorDocV3Fixture),
    [editorDocV6Fixture.designId]: clone(editorDocV6Fixture),
  };
  const before = JSON.stringify(map);
  const loaded = getEditorDocV6Result(map, editorDocV3Fixture.designId);
  assert.equal(loaded.status, 'ok');
  assert.equal(JSON.stringify(map), before, 'read/migrate must not mutate storage map');

  const rejected = saveEditorDocV6ToMap(map, clone(editorDocV3Fixture));
  assert.equal(rejected.status, 'rejected');
  assert.equal(JSON.stringify(map), before, 'rejected save must not write');

  const saved = saveEditorDocV6ToMap(map, clone(editorDocV6Fixture));
  assert.equal(saved.status, 'ok');
  assert.equal(map[editorDocV6Fixture.designId].schemaVersion, 6);

  const mismatched = getEditorDocV6Result({ requested: clone(editorDocV6Fixture) }, 'requested');
  assert.equal(mismatched.status, 'invalid');
  assert.match(mismatched.reason, /key\/designId mismatch/);
}

/* collision-resistant generator smoke */
{
  const ids = Array.from({ length: 1000 }, () => generateEditorId('layer'));
  assert.equal(new Set(ids).size, ids.length);
}

/* live repository boundary: read/migrate and rejected save do not write localStorage */
{
  const memory = new Map();
  let writes = 0;
  globalThis.localStorage = {
    getItem: (key) => memory.get(key) ?? null,
    setItem: (key, value) => {
      writes += 1;
      memory.set(key, String(value));
    },
    removeItem: (key) => memory.delete(key),
  };
  const { StorageKeys, writeEnvelope } = await import('../src/lib/storage.ts');
  const { getEditorDocV6Result: getStoredEditorDocV6Result, saveEditorDocV6 } = await import(
    '../src/studio/editor/lib/repo.ts'
  );
  writeEnvelope(StorageKeys.editorDocs, {
    [editorDocV3Fixture.designId]: clone(editorDocV3Fixture),
  });
  const writesAfterSeed = writes;
  const loaded = getStoredEditorDocV6Result(editorDocV3Fixture.designId);
  assert.equal(loaded.status, 'ok');
  assert.equal(writes, writesAfterSeed, 'live repository read/migrate must not write storage');

  const rejected = saveEditorDocV6(clone(editorDocV3Fixture));
  assert.equal(rejected.status, 'rejected');
  assert.equal(writes, writesAfterSeed, 'rejected live save must not write storage');
}

console.log('test-editor-v6-migrate: migration and repository assertions passed');
