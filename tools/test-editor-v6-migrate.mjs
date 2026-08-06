import { strict as assert } from 'node:assert';
import { migrateEditorDocV6 } from '../src/studio/editor/v6/migrate.ts';
import { generateEditorId } from '../src/studio/editor/v6/id.ts';
import {
  getEditorDocV6Result,
  saveEditorDocV6ToMap,
} from '../src/studio/editor/v6/repository-contract.ts';
import { editorDocV6Fixture } from '../src/studio/editor/fixtures/editor-doc-v6.mjs';
import {
  FINGER_CODES,
  legacyEditorDocFixtures,
  editorDocV1Fixture,
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
    assert.equal(reliefLayer.elements[0].heightMm, 0.1);
  }
}

/* v4/v5 appearance canonical + communication refs + stepId */
{
  const v4 = migrateEditorDocV6(clone(editorDocV4Fixture));
  assert.equal(v4.status, 'ok');
  assert.deepEqual(v4.doc.appearance, editorDocV4Fixture.appearance);
  assert.equal(v4.doc.nails.L1.layers[0].surface?.appearance, undefined);
  assert.equal(v4.doc.communicationRefs[0].dataUrl, 'data:image/png;base64,AA==');

  const v5 = migrateEditorDocV6(clone(editorDocV5Fixture));
  assert.equal(v5.status, 'ok');
  assert.equal(v5.doc.nails.L1.layers[0].stepId, 'base_color');
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
    a: clone(editorDocV3Fixture),
    b: clone(editorDocV6Fixture),
  };
  const before = JSON.stringify(map);
  const loaded = getEditorDocV6Result(map, 'a');
  assert.equal(loaded.status, 'ok');
  assert.equal(JSON.stringify(map), before, 'read/migrate must not mutate storage map');

  const rejected = saveEditorDocV6ToMap(map, clone(editorDocV3Fixture));
  assert.equal(rejected.status, 'rejected');
  assert.equal(JSON.stringify(map), before, 'rejected save must not write');

  const saved = saveEditorDocV6ToMap(map, clone(editorDocV6Fixture));
  assert.equal(saved.status, 'ok');
  assert.equal(map[editorDocV6Fixture.designId].schemaVersion, 6);
}

/* collision-resistant generator smoke */
{
  const ids = Array.from({ length: 1000 }, () => generateEditorId('layer'));
  assert.equal(new Set(ids).size, ids.length);
}

console.log('test-editor-v6-migrate: migration and repository assertions passed');
