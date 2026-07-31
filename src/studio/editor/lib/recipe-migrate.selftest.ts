import { strict as assert } from 'node:assert';
import { migrateEditorDoc } from './migrate.ts';
import { createMercuryInstance } from './recipe-model.ts';

const legacy = { schemaVersion: 2, designId: 'migrate', shape: 'almond', length: 'medium', baseColor: '#fff', pattern: [], attachments: [], fingerLocks: {}, masterFinger: 'R4', updatedAt: new Date().toISOString() };
const result = migrateEditorDoc(legacy);
assert.equal(result.status, 'ok');
if (result.status === 'ok') {
  assert.equal(result.doc.schemaVersion, 3);
  assert.deepEqual(result.doc.relief, []);
  const v3 = migrateEditorDoc({ ...result.doc, recipe: createMercuryInstance('subtle') });
  assert.equal(v3.status, 'ok');
  if (v3.status === 'ok') assert.equal(v3.doc.recipe?.presetId, 'subtle');
}
console.log('recipe-migrate.selftest: all passed');
