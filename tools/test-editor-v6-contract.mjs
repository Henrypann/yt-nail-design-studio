import { strict as assert } from 'node:assert';
import { access } from 'node:fs/promises';
import { editorDocV6Fixture } from '../src/studio/editor/fixtures/editor-doc-v6.mjs';
import {
  FINGER_CODES,
  legacyEditorDocFixtures,
} from '../src/studio/editor/fixtures/legacy/index.mjs';

const root = new URL('../', import.meta.url);

function clone(value) {
  return structuredClone(value);
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

function assertFixtureContract() {
  assert.deepEqual(legacyEditorDocFixtures.map((doc) => doc.schemaVersion), [1, 2, 3, 4, 5]);
  assert.equal(editorDocV6Fixture.schemaVersion, 6);
  assert.deepEqual(Object.keys(editorDocV6Fixture.nails), FINGER_CODES);
  assert.equal(editorDocV6Fixture.nails.L1.geometryOverride.shape, 'oval');
  assert.equal(editorDocV6Fixture.appearance.opticalEffect, 'pearl');
  assert.equal(editorDocV6Fixture.recipeInstances.recipe_instance_fixture.recipeId, 'recipe_fixture');
  assert.equal(editorDocV6Fixture.outputIntent, 'customer');
  assert.ok(editorDocV6Fixture.revision > 0);
  assert.ok(Date.parse(editorDocV6Fixture.createdAt));
  assert.ok(Date.parse(editorDocV6Fixture.updatedAt));

  for (const finger of FINGER_CODES) {
    const layers = editorDocV6Fixture.nails[finger].layers;
    assert.deepEqual(layers.map((layer) => layer.order), layers.map((_, index) => index));
    for (const layer of layers) {
      assert.equal(typeof layer.visible, 'boolean');
      assert.equal(typeof layer.locked, 'boolean');
      assert.ok(layer.id);
      for (const [index, element] of layer.elements.entries()) {
        assert.ok(element.id);
        assert.equal(element.order, index);
        assert.equal(typeof element.visible, 'boolean');
        assert.equal(typeof element.locked, 'boolean');
      }
    }
  }

  const ids = collectIds(editorDocV6Fixture);
  assert.equal(new Set(ids).size, ids.length, 'v6 fixture layer/element IDs must be globally unique');
  assert.equal(
    Object.values(editorDocV6Fixture.nails)
      .flatMap((nail) => nail.layers)
      .some((layer) => layer.surface?.appearance),
    false,
    'appearance has one writable source of truth',
  );
}

async function importFirst(relativePaths, capability) {
  for (const path of relativePaths) {
    const url = new URL(path, root);
    try {
      await access(url);
      // Use url.href directly — pathToFileURL(url.pathname) double-encodes spaces.
      return await import(url.href);
    } catch (error) {
      if (error?.code !== 'ENOENT' && error?.code !== 'ERR_MODULE_NOT_FOUND') throw error;
    }
  }
  throw new Error(
    `Missing EditorDocV6 dependency: ${capability}. Checked ${relativePaths.join(', ')}`,
  );
}

function validationSucceeded(result) {
  if (result === true) return true;
  if (result === false || result == null) return false;
  if (result.success === true || result.status === 'ok') return true;
  if (result.success === false || result.status === 'invalid' || result.status === 'unsupported') {
    return false;
  }
  return result.schemaVersion === 6 || result.doc?.schemaVersion === 6 || result.data?.schemaVersion === 6;
}

function callValidation(validate, value) {
  try {
    return validationSucceeded(validate(value));
  } catch {
    return false;
  }
}

assertFixtureContract();

const schemaModule = await importFirst(
  ['./src/studio/editor/v6/schema.ts', './src/studio/editor/v6/model.ts'],
  'a behavioral v6 validator',
);
const validate =
  schemaModule.parseEditorDocV6 ??
  schemaModule.validateEditorDocV6 ??
  schemaModule.safeParseEditorDocV6 ??
  schemaModule.isEditorDocV6;
assert.equal(typeof validate, 'function', 'v6 schema module must export a behavioral validator');
assert.equal(callValidation(validate, clone(editorDocV6Fixture)), true);
assert.equal(callValidation(validate, { ...clone(editorDocV6Fixture), schemaVersion: 5 }), false);
assert.equal(callValidation(validate, { ...clone(editorDocV6Fixture), nails: {} }), false);

{
  const invalidShape = clone(editorDocV6Fixture);
  invalidShape.defaultGeometry.shape = 'not-a-shape';
  assert.equal(callValidation(validate, invalidShape), false);

  const invalidOverride = clone(editorDocV6Fixture);
  invalidOverride.nails.L1.geometryOverride = { shape: 'not-a-shape', length: 'gigantic' };
  assert.equal(callValidation(validate, invalidOverride), false);

  const danglingRecipe = clone(editorDocV6Fixture);
  danglingRecipe.nails.L1.layers[1].recipeInstanceId = 'missing_recipe';
  assert.equal(callValidation(validate, danglingRecipe), false);

  const invalidCommunicationTime = clone(editorDocV6Fixture);
  invalidCommunicationTime.communicationRefs[0].uploadedAt = 'not-a-date';
  assert.equal(callValidation(validate, invalidCommunicationTime), false);

  const invalidElementKind = clone(editorDocV6Fixture);
  invalidElementKind.nails.L1.layers[1].elements[0].kind = 'mystery_blob';
  assert.equal(callValidation(validate, invalidElementKind), false);
}

const idModule = await importFirst(
  ['./src/studio/editor/v6/id.ts', './src/studio/editor/v6/model.ts'],
  'a collision-resistant ID generator',
);
const generateId =
  idModule.generateEditorId ??
  idModule.generateEditorDocId ??
  idModule.createCollisionResistantId ??
  idModule.genId;
assert.equal(typeof generateId, 'function', 'v6 ID module must export an ID generator');
const generated = Array.from({ length: 2_000 }, () => generateId('test'));
assert.equal(new Set(generated).size, generated.length, 'rapid repeated IDs must not collide');
assert.ok(generated.every((id) => typeof id === 'string' && id.startsWith('test')));

console.log('test-editor-v6-contract: fixture and product contract assertions passed');
