#!/usr/bin/env node
/**
 * test-community-studio-flow.mjs · intent conflict / editor probe（PR-02）
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = process.cwd();
const mem = new Map();
globalThis.localStorage = {
  getItem: (k) => (mem.has(k) ? mem.get(k) : null),
  setItem: (k, v) => mem.set(k, String(v)),
  removeItem: (k) => mem.delete(k),
  clear: () => mem.clear(),
};
globalThis.window = globalThis;
globalThis.sessionStorage = {
  getItem: () => null,
  setItem: () => undefined,
  removeItem: () => undefined,
};

const { hasEditorDoc, inspectEditorDoc, readEditorDocs } = await import(
  pathToFileURL(path.join(root, 'src/studio/editor/lib/repo.ts')).href
);
const { writeEnvelope, StorageKeys } = await import(
  pathToFileURL(path.join(root, 'src/lib/storage.ts')).href
);
const { detectCommunityIntentConflictFromSnapshot } = await import(
  pathToFileURL(path.join(root, 'src/studio/wizard/community-intent-conflict.ts')).href
);

assert.equal(inspectEditorDoc('missing').present, false);
assert.equal(hasEditorDoc('missing'), false);

writeEnvelope(StorageKeys.editorDocs, {
  d_v3: { schemaVersion: 3, designId: 'd_v3' },
  d_future: { schemaVersion: 9, designId: 'd_future' },
  d_bad: 'not-an-object',
});

assert.deepEqual(inspectEditorDoc('d_v3'), {
  present: true,
  schemaVersion: 3,
  kind: 'supported',
});
assert.deepEqual(inspectEditorDoc('d_future'), {
  present: true,
  schemaVersion: 9,
  kind: 'unsupported',
});
assert.equal(inspectEditorDoc('d_bad').kind, 'invalid');
assert.equal(hasEditorDoc('d_v3'), true);
assert.equal(hasEditorDoc('d_future'), true);

// Probe must not mutate storage
const before = JSON.stringify(readEditorDocs());
inspectEditorDoc('d_v3');
inspectEditorDoc('d_future');
assert.equal(JSON.stringify(readEditorDocs()), before);

const clean = {
  status: 'draft',
  designId: 'd_clean',
  customer: null,
  appliedShape: null,
  templateId: null,
  step: 1,
  shape: null,
  length: null,
};
assert.equal(detectCommunityIntentConflictFromSnapshot(clean), 'none');

assert.equal(
  detectCommunityIntentConflictFromSnapshot({
    ...clean,
    appliedShape: 'almond',
    step: 2,
    designId: 'd_draft_only',
  }),
  'wizard_draft',
);

assert.equal(
  detectCommunityIntentConflictFromSnapshot({
    ...clean,
    status: 'confirmed',
    designId: 'd_frozen',
  }),
  'frozen',
);

assert.equal(
  detectCommunityIntentConflictFromSnapshot({
    ...clean,
    designId: 'd_v3',
  }),
  'editor_doc',
);

assert.equal(
  detectCommunityIntentConflictFromSnapshot({
    ...clean,
    designId: 'd_future',
  }),
  'editor_doc',
);

const wizardPage = fs.readFileSync(path.join(root, 'src/app/pages/design/WizardPage.tsx'), 'utf8');
assert.match(wizardPage, /communityIntent/);
assert.match(wizardPage, /applyCommunityImportIntent|detectCommunityIntentConflict/);
assert.match(wizardPage, /community-intent-cancel|community-intent-new|community-intent-current/);

const consume = fs.readFileSync(
  path.join(root, 'src/studio/wizard/consume-community-intent.ts'),
  'utf8',
);
assert.match(consume, /inspectEditorDoc|hasEditorDoc|detectCommunityIntentConflictFromSnapshot/);
assert.doesNotMatch(consume, /getEditorDoc\(/);

const conflictMod = fs.readFileSync(
  path.join(root, 'src/studio/wizard/community-intent-conflict.ts'),
  'utf8',
);
assert.match(conflictMod, /inspectEditorDoc|hasEditorDoc/);
assert.doesNotMatch(conflictMod, /getEditorDoc\(/);

console.log('[test:community-studio-flow] PASS');
