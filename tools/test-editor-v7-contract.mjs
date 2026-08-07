import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import {
  EDITOR_DOC_V7_FULL_FIXTURE,
  EDITOR_DOC_V7_MINIMAL_FIXTURE,
} from '../src/studio/editor/fixtures/editor-doc-v7.mjs';
import { EDITOR_DOC_V7_INVALID_FIXTURES } from '../src/studio/editor/fixtures/editor-doc-v7-invalid.mjs';
import {
  PROCESS_STEP_REGISTRY_V7,
  PROCESS_STEP_TYPE_IDS_V7,
} from '../src/studio/editor/v7/registry.ts';
import { parseEditorDocV7, validateEditorDocV7 } from '../src/studio/editor/v7/schema.ts';

const validFixtures = [EDITOR_DOC_V7_MINIMAL_FIXTURE, EDITOR_DOC_V7_FULL_FIXTURE];
for (const fixture of validFixtures) {
  const parsed = parseEditorDocV7(fixture);
  assert.equal(parsed.ok, true, parsed.ok ? '' : JSON.stringify(parsed.issues, null, 2));
  assert.deepEqual(parsed.doc, fixture, 'successful parse must preserve the canonical document');
  assert.equal(validateEditorDocV7(fixture), true);
}
assert.equal(EDITOR_DOC_V7_FULL_FIXTURE.nails.R5.steps[0].visible, false, 'background may be temporarily hidden');

for (const fixture of EDITOR_DOC_V7_INVALID_FIXTURES) {
  const parsed = parseEditorDocV7(fixture.value);
  assert.equal(parsed.ok, false, `${fixture.name} should be rejected`);
  assert.ok(parsed.issues.some((issue) => issue.code === fixture.expectedCode), `${fixture.name} should emit ${fixture.expectedCode}: ${JSON.stringify(parsed.issues)}`);
  assert.ok(parsed.issues.length <= 200, `${fixture.name} exceeded issue cap`);
}

const serialized = JSON.stringify(EDITOR_DOC_V7_FULL_FIXTURE);
for (const forbidden of ['"order"', '"customerId"', 'data:image', ';base64,']) {
  assert.equal(serialized.includes(forbidden), false, `fixture must not contain ${forbidden}`);
}

const background = PROCESS_STEP_REGISTRY_V7[PROCESS_STEP_TYPE_IDS_V7.background];
const finish = PROCESS_STEP_REGISTRY_V7[PROCESS_STEP_TYPE_IDS_V7.surface_finish];
assert.deepEqual(
  [background.cardinality, background.position, background.deletable, background.skippable, background.movable, background.duplicable],
  ['exactly_one', 'first', false, false, false, false],
);
assert.deepEqual(
  Object.values(PROCESS_STEP_REGISTRY_V7).map((entry) => ({
    kind: entry.kind,
    cardinality: entry.cardinality,
    position: entry.position,
    repeatable: entry.repeatable,
    deletable: entry.deletable,
    skippable: entry.skippable,
    movable: entry.movable,
    duplicable: entry.duplicable,
    supportsMask: entry.supportsMask,
    supportsMaterial: entry.supportsMaterial,
  })),
  [
    { kind: 'background', cardinality: 'exactly_one', position: 'first', repeatable: false, deletable: false, skippable: false, movable: false, duplicable: false, supportsMask: false, supportsMaterial: true },
    { kind: 'flat_design', cardinality: 'zero_or_more', position: 'middle', repeatable: true, deletable: true, skippable: true, movable: true, duplicable: true, supportsMask: true, supportsMaterial: false },
    { kind: 'surface_effect', cardinality: 'zero_or_more', position: 'middle', repeatable: true, deletable: true, skippable: true, movable: true, duplicable: true, supportsMask: true, supportsMaterial: true },
    { kind: 'dimensional_decoration', cardinality: 'zero_or_more', position: 'middle', repeatable: true, deletable: true, skippable: true, movable: true, duplicable: true, supportsMask: false, supportsMaterial: true },
    { kind: 'surface_finish', cardinality: 'exactly_one', position: 'last', repeatable: false, deletable: false, skippable: false, movable: false, duplicable: false, supportsMask: false, supportsMaterial: true },
  ],
);
assert.deepEqual(
  [finish.cardinality, finish.position, finish.deletable, finish.skippable, finish.movable, finish.duplicable],
  ['exactly_one', 'last', false, false, false, false],
);

const schemaPath = fileURLToPath(new URL('../src/studio/editor/v7/editor-doc-v7.schema.json', import.meta.url));
const jsonSchemaText = await readFile(schemaPath, 'utf8');
const jsonSchema = JSON.parse(jsonSchemaText);
assert.equal(jsonSchema.$schema, 'https://json-schema.org/draft/2020-12/schema');
assert.equal(jsonSchema.additionalProperties, false);
assert.deepEqual(jsonSchema.required, ['schemaVersion', 'designId', 'title', 'nails', 'recipeInstances', 'sourceRefs', 'communicationRefs', 'outputIntent', 'revision', 'createdAt', 'updatedAt']);
for (const forbidden of ['customerId', 'dataUrl', 'base64']) {
  assert.equal(jsonSchemaText.includes(forbidden), false, `JSON Schema must not expose ${forbidden}`);
}

const v6Like = { ...EDITOR_DOC_V7_MINIMAL_FIXTURE, schemaVersion: 6, customerId: 'legacy' };
const v6Result = parseEditorDocV7(v6Like);
assert.equal(v6Result.ok, false);
assert.ok(v6Result.issues.some((issue) => issue.code === 'schema_version'));
assert.ok(v6Result.issues.some((issue) => issue.code === 'legacy_dual_write'));

console.log(`EditorDocV7 contract: ${validFixtures.length} valid fixtures and ${EDITOR_DOC_V7_INVALID_FIXTURES.length} invalid fixtures passed`);
