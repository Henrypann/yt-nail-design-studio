import { strict as assert } from 'node:assert';
import { migrateEditorDoc } from './migrate.ts';

const legacy = {
  schemaVersion: 1,
  designId: 'legacy-1',
  customerId: 'customer-1',
  shape: 'almond',
  length: 'medium',
  finish: 'pearl',
  baseColor: '#F5E0D3',
  pattern: [
    {
      id: 'brush-1',
      kind: 'brush',
      points: [{ x: 0, y: -50 }],
      color: '#FFFFFF',
      size: 6,
      opacity: 1,
    },
  ],
  attachments: [],
  fingerLocks: {},
  masterFinger: 'R4',
  updatedAt: '2026-07-28T00:00:00.000Z',
};

const migrated = migrateEditorDoc(legacy);
assert.equal(migrated.status, 'ok');
if (migrated.status === 'ok') {
  assert.equal(migrated.migrated, true);
  assert.equal(migrated.doc.schemaVersion, 2);
  assert.equal(migrated.doc.length, 'medium');
  assert.equal(migrated.doc.lengthPreset, 'short-extension');
  assert.deepEqual(migrated.doc.appearance, {
    baseCoverage: 'opaque',
    opticalEffect: 'pearl',
    topFinish: 'gloss',
  });
  assert.equal(migrated.doc.pattern[0].name, '手绘笔画');
  assert.equal(migrated.doc.pattern[0].visible, true);
  assert.equal(migrated.doc.pattern[0].locked, false);
  assert.equal(migrated.doc.pattern[0].order, 0);
  assert.equal(migrated.doc.updatedAt, legacy.updatedAt);

  const second = migrateEditorDoc(migrated.doc);
  assert.equal(second.status, 'ok');
  if (second.status === 'ok') {
    assert.equal(second.migrated, false);
    assert.deepEqual(second.doc, migrated.doc);
  }
}

assert.deepEqual(
  ['short', 'medium', 'long', 'extra-long'].map((length) => {
    const result = migrateEditorDoc({ ...legacy, designId: length, length });
    return result.status === 'ok' ? result.doc.lengthPreset : result.status;
  }),
  ['natural', 'short-extension', 'medium', 'long'],
);

assert.deepEqual(migrateEditorDoc({ schemaVersion: 9 }), { status: 'unsupported', version: 9 });
assert.equal(migrateEditorDoc({ schemaVersion: 1 }).status, 'invalid');

console.log('migrate.selftest: all passed');
