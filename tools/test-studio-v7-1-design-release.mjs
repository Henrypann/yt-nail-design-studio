#!/usr/bin/env node
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const root = process.cwd();
const fixtureModule = await import(pathToFileURL(path.join(root, 'src/studio/editor/fixtures/editor-doc-v7.mjs')).href);
const releaseModule = await import(pathToFileURL(path.join(root, 'src/studio/versioning/design-release.ts')).href);
const designContent = await import(pathToFileURL(path.join(root, 'src/community/domain/v7_1/design-content-parse.ts')).href);
const {
  EDITOR_DOC_V7_MINIMAL_FIXTURE,
  EDITOR_DOC_V7_FULL_FIXTURE,
} = fixtureModule;
const {
  DESIGN_RELEASE_STORE_KIND,
  buildDesignReleaseManifestV1,
  canonicalJsonV1,
  parseDesignReleaseStoreV1,
  readDesignReleaseByVersionIdV1,
  releaseSavedEditorDocV7,
} = releaseModule;

const digest = async (value) => createHash('sha256').update(value).digest('hex');
const guard = (revision) => ({ saveState: 'saved', savedRevision: revision, pendingRevision: null });

function harness(initialDocs = {}) {
  const docs = structuredClone(initialDocs);
  let stored = null;
  let writes = 0;
  let ids = 0;
  let failWrite = false;
  const deps = {
    storage: {
      read: () => stored,
      write: (value) => {
        if (failWrite) throw new Error('quota');
        stored = value;
        writes += 1;
      },
    },
    readPersistedEditorDoc: (designId) => structuredClone(docs[designId]),
    sha256: digest,
    nextId: () => `dv.release.${++ids}`,
    now: () => '2026-08-11T06:00:00.000Z',
    releasedByIdentityId: () => 'idn.creator.release',
  };
  return {
    deps, docs,
    get stored() { return stored; },
    set stored(value) { stored = value; },
    get writes() { return writes; },
    get ids() { return ids; },
    setFailWrite(value) { failWrite = value; },
  };
}

assert.equal(
  canonicalJsonV1({ b: 2, a: { d: 4, c: 3 }, list: [2, 1] }),
  canonicalJsonV1({ list: [2, 1], a: { c: 3, d: 4 }, b: 2 }),
  'object key insertion order does not affect canonical JSON',
);
assert.notEqual(canonicalJsonV1({ list: [2, 1] }), canonicalJsonV1({ list: [1, 2] }), 'array order remains canonical truth');

// Blank valid V7 releases without invented assets.
{
  const doc = structuredClone(EDITOR_DOC_V7_MINIMAL_FIXTURE);
  const h = harness({ [doc.designId]: doc });
  const result = await releaseSavedEditorDocV7({ designId: doc.designId, expectedRevision: doc.revision, runtimeGuard: guard(doc.revision) }, h.deps);
  assert.equal(result.ok, true, 'blank saved V7 releases');
  if (!result.ok) throw new Error(result.message);
  assert.equal(result.created, true);
  assert.equal(result.record.designVersion.assetRevisionRefs.length, 0, 'no fake asset injected');
  assert.equal(designContent.parseDesignVersionV1(result.record.designVersion).ok, true, 'public version parses');
  assert.equal(h.writes, 1, 'one release = one write');
  assert.equal(result.record.manifest.geometryRefs.length, 10);
  assert.deepEqual(result.record.manifest.geometryRefs.map((ref) => ref.finger), ['L1','L2','L3','L4','L5','R1','R2','R3','R4','R5']);
  const publicJson = JSON.stringify(result.record.designVersion);
  for (const forbidden of ['nails', 'customerRef', 'recipeInstances', 'manufacturing', 'deviceTask', 'saveState']) {
    assert.equal(publicJson.includes(forbidden), false, `public DesignVersion excludes ${forbidden}`);
  }

  const idsBefore = h.ids;
  const writesBefore = h.writes;
  const again = await releaseSavedEditorDocV7({ designId: doc.designId, expectedRevision: doc.revision, runtimeGuard: guard(doc.revision) }, h.deps);
  assert.equal(again.ok && again.created === false, true, 'same revision is idempotent');
  assert.equal(h.ids, idsBefore, 'idempotent release generates no ID');
  assert.equal(h.writes, writesBefore, 'idempotent release writes zero');
  if (again.ok) again.record.editorDocSnapshot.title = 'mutated return';
  const reread = await readDesignReleaseByVersionIdV1(result.record.designVersion.designVersionId, h.deps);
  assert.equal(reread.ok && reread.record?.editorDocSnapshot.title === doc.title, true, 'returns are deep clones');

  const nextDoc = structuredClone(doc);
  nextDoc.revision = 2;
  nextDoc.updatedAt = '2026-08-11T06:01:00.000Z';
  h.docs[doc.designId] = nextDoc;
  const second = await releaseSavedEditorDocV7({ designId: doc.designId, expectedRevision: 2, runtimeGuard: guard(2) }, h.deps);
  assert.equal(second.ok && second.created, true, 'later revision releases');
  if (!second.ok) throw new Error(second.message);
  assert.equal(second.record.designVersion.version, 2);
  assert.equal(second.record.designVersion.parentVersionId, result.record.designVersion.designVersionId);
}

// Full manifest freezes actual refs; no renderer evidence is fabricated.
{
  const doc = structuredClone(EDITOR_DOC_V7_FULL_FIXTURE);
  const manifest = buildDesignReleaseManifestV1(doc);
  assert.equal(manifest.ok, true, 'full manifest builds');
  if (!manifest.ok) throw new Error(manifest.message);
  assert.ok(manifest.manifest.assetRevisionRefs.some((ref) => ref.assetId === 'asset.consultation-preview'));
  assert.ok(manifest.manifest.materialRevisionRefs.length > 0);
  assert.deepEqual(manifest.manifest.recipeRevisionRefs, [{ recipeId: 'recipe.cat-eye', revision: '2' }]);
  assert.deepEqual(manifest.manifest.sourceRefs, doc.sourceRefs);
  assert.deepEqual(manifest.manifest.compositionMeta, doc.compositionMeta);
  assert.equal(manifest.manifest.compositionProvenance.length, 10, 'per-finger composition provenance frozen');
  assert.deepEqual(manifest.manifest.compositionProvenance.map((entry) => entry.finger), ['L1','L2','L3','L4','L5','R1','R2','R3','R4','R5']);
  assert.equal(manifest.manifest.rendererEvidence, 'UNAVAILABLE_IN_EDITORDOC_V7');

  const badRevision = structuredClone(doc);
  badRevision.communicationRefs[0].asset.revision = 'release-alpha';
  assert.equal(buildDesignReleaseManifestV1(badRevision).ok, false, 'nonnumeric hashed asset revision rejects');

  const conflict = structuredClone(doc);
  conflict.communicationRefs.push({
    ...structuredClone(conflict.communicationRefs[0]),
    communicationId: 'communication.conflict',
    asset: { ...structuredClone(conflict.communicationRefs[0].asset), sha256: 'f'.repeat(64) },
  });
  const conflictResult = buildDesignReleaseManifestV1(conflict);
  assert.equal(conflictResult.ok, false, 'conflicting same asset revision rejects');
  if (!conflictResult.ok) assert.equal(conflictResult.code, 'conflicting_reference');
}

// A concurrent release-store update is never overwritten.
{
  const doc = structuredClone(EDITOR_DOC_V7_MINIMAL_FIXTURE);
  const h = harness({ [doc.designId]: doc });
  h.deps.beforeSourceRecheck = () => {
    h.stored = JSON.stringify({ schemaVersion: 1, kind: DESIGN_RELEASE_STORE_KIND, records: [] });
  };
  const result = await releaseSavedEditorDocV7({ designId: doc.designId, expectedRevision: 1, runtimeGuard: guard(1) }, h.deps);
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.code, 'stale_release_store');
  assert.equal(h.writes, 0);
}

// Guards and source versions fail before IDs/writes.
for (const [name, runtimeGuard] of [
  ['dirty', { saveState: 'dirty', savedRevision: 1, pendingRevision: 2 }],
  ['saving', { saveState: 'saving', savedRevision: 1, pendingRevision: null }],
  ['error', { saveState: 'error', savedRevision: 1, pendingRevision: null }],
  ['mismatch', { saveState: 'saved', savedRevision: 9, pendingRevision: null }],
]) {
  const doc = structuredClone(EDITOR_DOC_V7_MINIMAL_FIXTURE);
  const h = harness({ [doc.designId]: doc });
  const result = await releaseSavedEditorDocV7({ designId: doc.designId, expectedRevision: 1, runtimeGuard }, h.deps);
  assert.equal(result.ok, false, `${name} guard rejects`);
  assert.equal(h.ids, 0); assert.equal(h.writes, 0);
}

for (const [schemaVersion, expected] of [[3, 'legacy_source_unsupported'], [8, 'future_source_unsupported']]) {
  const h = harness({ source: { schemaVersion, designId: 'source' } });
  const result = await releaseSavedEditorDocV7({ designId: 'source', expectedRevision: 1, runtimeGuard: guard(1) }, h.deps);
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.code, expected);
  assert.equal(h.writes, 0); assert.equal(h.ids, 0);
}

// Source race, storage corruption, checksum corruption and write failure are atomic.
{
  const doc = structuredClone(EDITOR_DOC_V7_MINIMAL_FIXTURE);
  const h = harness({ [doc.designId]: doc });
  h.deps.beforeSourceRecheck = () => { h.docs[doc.designId].title = 'raced'; };
  const race = await releaseSavedEditorDocV7({ designId: doc.designId, expectedRevision: 1, runtimeGuard: guard(1) }, h.deps);
  assert.equal(race.ok, false); if (!race.ok) assert.equal(race.code, 'stale_source');
  assert.equal(h.writes, 0);
}
{
  const doc = structuredClone(EDITOR_DOC_V7_MINIMAL_FIXTURE);
  const h = harness({ [doc.designId]: doc });
  h.stored = '{bad json';
  const corrupt = await releaseSavedEditorDocV7({ designId: doc.designId, expectedRevision: 1, runtimeGuard: guard(1) }, h.deps);
  assert.equal(corrupt.ok, false); if (!corrupt.ok) assert.equal(corrupt.code, 'storage_corrupted');
  assert.equal(h.stored, '{bad json'); assert.equal(h.writes, 0);
}
{
  const doc = structuredClone(EDITOR_DOC_V7_MINIMAL_FIXTURE);
  const h = harness({ [doc.designId]: doc });
  h.setFailWrite(true);
  const failed = await releaseSavedEditorDocV7({ designId: doc.designId, expectedRevision: 1, runtimeGuard: guard(1) }, h.deps);
  assert.equal(failed.ok, false); if (!failed.ok) assert.equal(failed.code, 'write_failed');
  assert.equal(h.stored, null); assert.equal(h.writes, 0);
}

assert.equal(parseDesignReleaseStoreV1({ schemaVersion: 1, kind: DESIGN_RELEASE_STORE_KIND, records: [], extra: true }).ok, false, 'unknown store key rejects');
console.log('[test:studio-v7-1-design-release] PASS');
