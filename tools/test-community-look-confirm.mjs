#!/usr/bin/env node
/**
 * S-LOOK: Community 显式确认 Look → DesignVersion。
 * Evidence: prototype software. 不写 EditorDoc，不造 Feed，不宣称物理验证。
 */
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
const fourLook = await import('../src/integration/community-studio/v0-7-2-four-look-sets.ts');
const domain = await import('../src/community/domain/v7_1/look-confirm.ts');
const runtime = await import('../src/integration/community-studio/look-confirm-runtime.ts');
const { canonicalJsonV1 } = await import('../src/studio/versioning/design-release.ts');
const { readData, StorageKeys, writeEnvelope } = await import('../src/lib/storage.ts');

const checksum = createHash('sha256')
  .update(canonicalJsonV1(fixture.CANONICAL_USE_DEMO_EDITOR_DOC_V7))
  .digest('hex');
assert.equal(checksum, fixture.CANONICAL_USE_DEMO_EDITOR_SHA256);

function memoryStorage(seed = null) {
  let current = seed;
  return {
    read() { return current; },
    write(next) { current = structuredClone(next); },
    snapshot() { return current; },
  };
}

function confirmDeps(storage, snapshotId = 'snap.look.1') {
  return {
    storage,
    nextSnapshotId: () => snapshotId,
    now: () => '2026-08-31T12:00:00.000Z',
  };
}

const look = structuredClone(fixture.CANONICAL_USE_DEMO_PUBLISHED_LOOK_V1);
const designVersion = structuredClone(fixture.CANONICAL_USE_DEMO_RELEASE_RECORD_V1.designVersion);

localStorage.clear();
writeEnvelope(StorageKeys.editorDocs, { sentinel: 'editor-untouched' });
writeEnvelope(StorageKeys.wizardDraft, { sentinel: 'wizard-untouched' });
writeEnvelope(StorageKeys.versionedStudioImportIntents, { sentinel: 'intent-untouched' });

const storage = memoryStorage();
const first = domain.confirmLookAsDesignVersionV1({ look, designVersion }, confirmDeps(storage));
assert.equal(first.ok, true);
if (!first.ok) throw new Error(first.message);
assert.equal(first.created, true);
assert.equal(first.record.lookId, look.lookId);
assert.equal(first.record.designVersionId, designVersion.designVersionId);
assert.equal(first.record.revision, designVersion.revision);
assert.equal(first.record.editorDocSha256, designVersion.editorDocRef.sha256);
assert.equal(first.record.snapshotId, 'snap.look.1');
assert.equal(JSON.stringify(readData(StorageKeys.editorDocs)), JSON.stringify({ sentinel: 'editor-untouched' }));
assert.equal(JSON.stringify(readData(StorageKeys.wizardDraft)), JSON.stringify({ sentinel: 'wizard-untouched' }));
assert.equal(JSON.stringify(readData(StorageKeys.versionedStudioImportIntents)), JSON.stringify({ sentinel: 'intent-untouched' }));

const listed = domain.listConfirmedLookDesignVersionsV1(storage);
assert.equal(listed.ok, true);
if (!listed.ok) throw new Error(listed.message);
assert.equal(listed.records.length, 1);

const again = domain.confirmLookAsDesignVersionV1({ look, designVersion }, confirmDeps(storage, 'snap.look.2'));
assert.equal(again.ok && again.created === false, true);
if (!again.ok) throw new Error(again.message);
assert.equal(again.record.snapshotId, 'snap.look.1', 'reconfirm is idempotent by look + DesignVersion id');

const unpublished = structuredClone(look);
unpublished.status = 'DRAFT';
delete unpublished.publishedAt;
assert.equal(
  domain.confirmLookAsDesignVersionV1({ look: unpublished, designVersion }, confirmDeps(memoryStorage())).reason,
  'look_unavailable',
);

const mismatched = structuredClone(look);
mismatched.designVersionId = 'dv.other.1';
assert.equal(
  domain.confirmLookAsDesignVersionV1({ look: mismatched, designVersion }, confirmDeps(memoryStorage())).reason,
  'version_mismatch',
);

const noVersionLook = structuredClone(look);
noVersionLook.designVersionId = '';
assert.equal(
  domain.confirmLookAsDesignVersionV1({ look: noVersionLook, designVersion }, confirmDeps(memoryStorage())).ok,
  false,
);

const embedded = domain.parseConfirmedLookDesignVersionRefV1({
  schemaVersion: 1,
  snapshotId: 'snap.1',
  lookId: look.lookId,
  designVersionId: designVersion.designVersionId,
  designId: designVersion.designId,
  version: 1,
  revision: 1,
  editorDocSha256: designVersion.editorDocRef.sha256,
  confirmedAt: '2026-08-31T12:00:00.000Z',
  editorDoc: { schemaVersion: 7 },
});
assert.equal(embedded, null, 'confirm record must never embed EditorDoc');

const extraKey = domain.parseLookConfirmStoreV1({
  schemaVersion: 1,
  kind: domain.LOOK_CONFIRM_STORE_KIND,
  records: [],
  feed: [],
});
assert.equal(extraKey, null, 'confirm store rejects unknown keys / Feed payloads');

const corrupted = memoryStorage({ schemaVersion: 1, kind: 'WRONG', records: [] });
const blocked = domain.confirmLookAsDesignVersionV1({ look, designVersion }, confirmDeps(corrupted));
assert.equal(blocked.ok, false);
assert.equal(blocked.reason, 'corrupted_store');
assert.deepEqual(corrupted.snapshot(), { schemaVersion: 1, kind: 'WRONG', records: [] });

localStorage.clear();
const runtimeFirst = runtime.confirmCanonicalLookAsDesignVersionV1(
  fixture.CANONICAL_USE_DEMO_READ_MODEL_V1,
  { snapshotId: 'snap.runtime.1', now: '2026-08-31T12:30:00.000Z' },
);
assert.equal(runtimeFirst.ok, true);
if (!runtimeFirst.ok) throw new Error(runtimeFirst.message);
assert.equal(runtimeFirst.created, true);
assert.equal(runtimeFirst.record.designVersionId, fixture.CANONICAL_USE_DEMO_VERSION_ID);
assert.equal(runtimeFirst.record.revision, fixture.CANONICAL_USE_DEMO_RELEASE_RECORD_V1.designVersion.revision);
assert.equal(runtimeFirst.record.editorDocSha256, fixture.CANONICAL_USE_DEMO_EDITOR_SHA256);
assert.equal(readData(StorageKeys.editorDocs), null, 'runtime confirm must not create EditorDoc');
assert.equal(readData(StorageKeys.versionedStudioImportIntents), null, 'runtime confirm must not write import intents');

const fourLookModel = fourLook.FOUR_LOOK_SET_READ_MODELS_V0_7_2[0];
assert.equal(fourLookModel.readModelKind, 'CANONICAL');
const fourLookConfirm = runtime.confirmCanonicalLookAsDesignVersionV1(fourLookModel, {
  snapshotId: 'snap.four.1',
  now: '2026-08-31T12:31:00.000Z',
});
assert.equal(fourLookConfirm.ok, true);
if (!fourLookConfirm.ok) throw new Error(fourLookConfirm.message);
assert.equal(fourLookConfirm.record.lookId, fourLookModel.lookId);
assert.equal(fourLookConfirm.record.designVersionId, fourLookModel.designVersionId);

const listedRuntime = runtime.readConfirmedLookDesignVersionsV1();
assert.equal(listedRuntime.ok, true);
if (!listedRuntime.ok) throw new Error(listedRuntime.message);
assert.equal(listedRuntime.records.length, 2);

console.log('[S-LOOK] Community confirm Look → DesignVersion: PASS');
