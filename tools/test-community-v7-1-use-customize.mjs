#!/usr/bin/env node
import assert from 'node:assert/strict';
import { createHash, webcrypto } from 'node:crypto';

class MemoryStorage {
  #items = new Map();
  getItem(key) { return this.#items.get(key) ?? null; }
  setItem(key, value) { this.#items.set(key, String(value)); }
  removeItem(key) { this.#items.delete(key); }
  clear() { this.#items.clear(); }
}

globalThis.localStorage = new MemoryStorage();
if (!globalThis.crypto) globalThis.crypto = webcrypto;

const fixture = await import('../src/integration/community-studio/canonical-use-demo.ts');
const runtime = await import('../src/integration/community-studio/versioned-use-runtime.ts');
const contentParse = await import('../src/community/domain/v7_1/design-content-parse.ts');
const { canonicalJsonV1 } = await import('../src/studio/versioning/design-release.ts');
const { readData, StorageKeys, writeEnvelope } = await import('../src/lib/storage.ts');
const { parseEditorDocV7 } = await import('../src/studio/editor/v7/schema.ts');

const checksum = createHash('sha256')
  .update(canonicalJsonV1(fixture.CANONICAL_USE_DEMO_EDITOR_DOC_V7))
  .digest('hex');
assert.equal(checksum, fixture.CANONICAL_USE_DEMO_EDITOR_SHA256, 'released snapshot checksum is exact');
assert.equal(contentParse.parsePublishedLookV1(fixture.CANONICAL_USE_DEMO_PUBLISHED_LOOK_V1).ok, true);
assert.equal(contentParse.parseDesignVersionV1(fixture.CANONICAL_USE_DEMO_RELEASE_RECORD_V1.designVersion).ok, true);
assert.equal(fixture.CANONICAL_USE_DEMO_READ_MODEL_V1.readModelKind, 'CANONICAL');
assert.equal(fixture.CANONICAL_USE_DEMO_RELEASE_RECORD_V1.designVersion.assetRevisionRefs.length, 0,
  'vector-only canonical demo honestly has an exact empty source-asset set');

function createIntent() {
  const created = runtime.createVersionedUseIntentForLookV1(fixture.CANONICAL_USE_DEMO_PUBLISHED_LOOK_V1);
  assert.equal(created.ok, true);
  if (!created.ok) throw new Error(created.reason);
  const intent = runtime.versionedIntentPortV2.peek(created.intentId);
  assert.ok(intent);
  assert.equal(intent.designVersionId, fixture.CANONICAL_USE_DEMO_VERSION_ID);
  assert.deepEqual(intent.assetRevisionRefs, fixture.CANONICAL_USE_DEMO_RELEASE_RECORD_V1.designVersion.assetRevisionRefs);
  return { created, intent };
}

async function readCustomizeEvents() {
  const result = await runtime.readLookCustomizeEventsV1();
  assert.equal(result.ok, true);
  if (!result.ok) throw new Error(result.error.reason);
  return result.value;
}

// A visible creator-like Look without a corresponding authoritative release
// must not create an intent, target document or analytics event.
localStorage.clear();
const unsupportedLook = structuredClone(fixture.CANONICAL_USE_DEMO_PUBLISHED_LOOK_V1);
unsupportedLook.lookId = 'look.public-without-release';
unsupportedLook.designVersionId = 'design-version.missing-authority';
const unsupported = runtime.createVersionedUseIntentForLookV1(unsupportedLook);
assert.deepEqual(unsupported, { ok: false, reason: 'release_unavailable' });
assert.equal(readData(StorageKeys.versionedStudioImportIntents), null, 'no handoff writer without release authority');
assert.equal(readData(StorageKeys.editorDocs), null, 'no target writer without release authority');
assert.equal((await readCustomizeEvents()).length, 0, 'no event writer without release authority');

// current/cancel preserve current Wizard/editor storage and do not emit success.
for (const mode of ['current', 'cancel']) {
  localStorage.clear();
  writeEnvelope(StorageKeys.wizardDraft, { sentinel: `${mode}-draft` });
  writeEnvelope(StorageKeys.editorDocs, { 'design.current': { schemaVersion: 6, sentinel: mode } });
  const beforeDraft = JSON.stringify(readData(StorageKeys.wizardDraft));
  const beforeDocs = JSON.stringify(readData(StorageKeys.editorDocs));
  const { created } = createIntent();
  const result = await runtime.consumeVersionedUseIntentV2(created.intentId, mode);
  assert.equal(result.ok && result.created === false, true);
  assert.equal(JSON.stringify(readData(StorageKeys.wizardDraft)), beforeDraft);
  assert.equal(JSON.stringify(readData(StorageKeys.editorDocs)), beforeDocs);
  assert.equal((await readCustomizeEvents()).length, 0);
  assert.equal(runtime.versionedIntentPortV2.peek(created.intentId), null);
}

// new creates one independent EditorDocV7, exact lineage and one success event.
localStorage.clear();
writeEnvelope(StorageKeys.wizardDraft, { sentinel: 'existing-draft' });
const draftBefore = JSON.stringify(readData(StorageKeys.wizardDraft));
const sourceBefore = JSON.stringify(fixture.CANONICAL_USE_DEMO_EDITOR_DOC_V7);
const { created, intent } = createIntent();
const createdResult = await runtime.consumeVersionedUseIntentV2(created.intentId, 'new');
assert.equal(createdResult.ok && createdResult.created, true);
if (!createdResult.ok || !createdResult.created) throw new Error(createdResult.message);
assert.equal(createdResult.doc.schemaVersion, 7);
assert.notEqual(createdResult.doc.designId, fixture.CANONICAL_USE_DEMO_DESIGN_ID);
assert.deepEqual(createdResult.doc.sourceRefs, [{
  domain: 'community', sourceId: fixture.CANONICAL_USE_DEMO_LOOK_ID,
  revision: fixture.CANONICAL_USE_DEMO_VERSION_ID,
}]);
assert.equal(JSON.stringify(readData(StorageKeys.wizardDraft)), draftBefore, 'Wizard draft untouched');
assert.equal(JSON.stringify(fixture.CANONICAL_USE_DEMO_EDITOR_DOC_V7), sourceBefore, 'source immutable');
assert.equal(parseEditorDocV7(readData(StorageKeys.editorDocs)[createdResult.doc.designId]).ok, true);
assert.equal(readData(StorageKeys.designs).find((summary) => summary.id === createdResult.doc.designId)?.status, 'draft');
assert.equal((await readCustomizeEvents()).length, 1);
assert.equal((await readCustomizeEvents())[0].targetDesignId, createdResult.doc.designId);
assert.equal(runtime.versionedIntentPortV2.peek(created.intentId), null);

const sourceIds = [];
const targetIds = [];
for (const nail of Object.values(fixture.CANONICAL_USE_DEMO_EDITOR_DOC_V7.nails)) {
  for (const step of nail.steps) {
    sourceIds.push(step.id);
    if (step.kind === 'flat_design') sourceIds.push(...step.elements.map((item) => item.id));
  }
}
for (const nail of Object.values(createdResult.doc.nails)) {
  for (const step of nail.steps) {
    targetIds.push(step.id);
    if (step.kind === 'flat_design') targetIds.push(...step.elements.map((item) => item.id));
  }
}
assert.equal(targetIds.some((id) => sourceIds.includes(id)), false);
assert.equal(new Set(targetIds).size, targetIds.length);

// Replaying the same exact intent is idempotent: same deterministic target,
// no second design and no duplicate event.
writeEnvelope(StorageKeys.versionedStudioImportIntents, { [intent.intentId]: intent });
const replay = await runtime.consumeVersionedUseIntentV2(intent.intentId, 'new');
assert.equal(replay.ok && replay.created, true);
if (!replay.ok || !replay.created) throw new Error(replay.message);
assert.equal(replay.doc.designId, createdResult.doc.designId);
assert.equal(Object.keys(readData(StorageKeys.editorDocs)).length, 1);
assert.equal((await readCustomizeEvents()).length, 1);

// Expiry removes only the exact intent.
localStorage.clear();
const expiring = createIntent();
const raw = readData(StorageKeys.versionedStudioImportIntents);
raw[expiring.intent.intentId].expiresAt = '2020-01-01T00:00:00.000Z';
writeEnvelope(StorageKeys.versionedStudioImportIntents, raw);
assert.equal(runtime.versionedIntentPortV2.peek(expiring.intent.intentId), null);

console.log('[test:community-v7-1-use-customize] PASS');
