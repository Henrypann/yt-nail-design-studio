import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import {
  createAssetReferenceResolverV1,
  createClientApprovalApplicationServiceV1,
  createCreatorWorkspaceApplicationServiceV1,
  createLocalCreatorPublicationPortV1,
  createGovernanceApplicationServiceV1,
  createInMemoryAssetBinaryStorageV1,
  createLocalAssetUploadPortV1,
  createLocalPrototypeIdentityAccessPortV1,
  createLocalPublishPackageAuthorityPortV1,
  createLocalVersionedUsePersistencePortV1,
  createVersionedJsonRepositoryV1,
  parseAssetUploadRecordV1,
  parseServiceCommandContextV1,
  parseServiceErrorV1,
  registerPublishPackageArtifactsV1,
  localEtagV1,
  BACKEND_PERMISSIONS_V1,
} from '../src/platform/backend/index.ts';
import { StorageKeys, writeEnvelope } from '../src/lib/storage.ts';
import { createCreatorPublicationDraftV1 } from '../src/community/domain/v7_1/creator-publication.ts';
import { createEmptyCreatorPublicationStoreV2 } from '../src/community/domain/v7_1/creator-publication-v2.ts';
import { parseCommunityTaxonomyV2 } from '../src/community/domain/taxonomy-v2/parse.ts';
import { emptyGovernanceStoreV1 } from '../src/community/domain/v7_1/governance.ts';
import { emptyClientApprovalStoreV1 } from '../src/studio/approval/client-approval.ts';
import {
  buildPublishPackageV1,
  createDeterministicPublishIdFactoryV1,
} from '../src/studio/publishing/index.ts';
import { CANONICAL_USE_DEMO_RELEASE_RECORD_V1 } from '../src/integration/community-studio/canonical-use-demo.ts';

const now = '2026-08-12T12:00:00.000Z';
// COMM-v0.7.2-TAX-02: every creator service construction resolves discovery
// against the shipped taxonomy-v2 fixture through the strict runtime parser.
const fixtureUrl = (name) => new URL(`../public/community/${name}`, import.meta.url);
const contentIndexRaw = JSON.parse(await readFile(fixtureUrl('content-index.json'), 'utf8'));
const taxonomyRaw = JSON.parse(await readFile(fixtureUrl('taxonomy-v2.json'), 'utf8'));
const migrationManifestRaw = JSON.parse(await readFile(fixtureUrl('migration-manifest-v1.json'), 'utf8'));
const parsedTaxonomy = parseCommunityTaxonomyV2(taxonomyRaw);
assert.equal(parsedTaxonomy.ok, true, 'shipped taxonomy-v2 fixture must strict-parse for creator discovery');
const strictTaxonomyProvider = { load: async () => parsedTaxonomy.value };
// Structured discovery authoring that fully resolves against the taxonomy.
const VALID_DISCOVERY = {
  styleIds: ['style:minimal-clean'],
  recommendedShapeIds: ['shape:almond'],
  sceneIds: [], themeIds: [], techniqueIds: [], lengthIds: ['length:medium'],
  rights: 'ORIGINAL',
  makeability: 'CONCEPT_ONLY',
};
class MemoryStorage {
  #items = new Map();
  getItem(key) { return this.#items.get(key) ?? null; }
  setItem(key, value) { this.#items.set(key, String(value)); }
  removeItem(key) { this.#items.delete(key); }
  clear() { this.#items.clear(); }
}
globalThis.localStorage = new MemoryStorage();
let id = 0;
const identity = createLocalPrototypeIdentityAccessPortV1({
  actorRef: 'profile.local-demo.creator',
  permissions: Object.values(BACKEND_PERMISSIONS_V1),
  now: () => now,
  nextId: (prefix) => `${prefix}${++id}`,
});
const issued = await identity.issueContext({ operation: 'publication.read', idempotencyKey: 'idem.explicit' });
assert.equal(issued.ok, true);
assert.equal(issued.value.now, now, 'adapter, not UI, injects clock');
assert.ok(parseServiceCommandContextV1(issued.value));
assert.equal(parseServiceCommandContextV1({ ...issued.value, permission: 'forged' }), null);
const denied = await createLocalPrototypeIdentityAccessPortV1({ actorRef: 'viewer.1', permissions: ['publication.read'], now: () => now }).issueContext({ operation: 'publication.write' });
assert.equal(denied.error.code, 'FORBIDDEN');
assert.ok(parseServiceErrorV1(denied.error));
assert.equal(parseServiceErrorV1({ ...denied.error, secret: 'x' }), null);
for (const brokenIdentity of [
  createLocalPrototypeIdentityAccessPortV1({ actorRef: 'broken.clock', permissions: ['publication.read'], now: () => 'not-a-time' }),
  createLocalPrototypeIdentityAccessPortV1({ actorRef: 'broken.calendar', permissions: ['publication.read'], now: () => '2026-99-99T00:00:00.000Z' }),
  createLocalPrototypeIdentityAccessPortV1({ actorRef: 'broken.normalized-calendar', permissions: ['publication.read'], now: () => '2026-02-30T00:00:00.000Z' }),
  createLocalPrototypeIdentityAccessPortV1({ actorRef: 'broken.id', permissions: ['publication.read'], nextId: () => 'bad id with spaces' }),
  createLocalPrototypeIdentityAccessPortV1({ actorRef: 'broken.throw', permissions: ['publication.read'], now: () => { throw new Error('clock'); } }),
]) {
  const broken = await brokenIdentity.issueContext({ operation: 'publication.read' });
  assert.equal(broken.ok, false); assert.equal(broken.error.code, 'UNAVAILABLE');
}

// One storage value atomically commits document + idempotency ledger.
let authorityRaw = null; let legacyRaw = null; let atomicWrites = 0;
const repo = createVersionedJsonRepositoryV1({
  storage: { read: () => authorityRaw, write: (value) => { atomicWrites += 1; authorityRaw = structuredClone(value); } },
  legacy: { read: () => legacyRaw, write: (value) => { legacyRaw = structuredClone(value); } },
  empty: () => ({ schemaVersion: 1, count: 0 }),
  parse: (value) => value?.schemaVersion === 1 && Number.isInteger(value.count) ? structuredClone(value) : null,
  invalidReason: 'test.store_corrupted',
});
const empty = await repo.read(); assert.equal(empty.ok, true);
const command = { value: { schemaVersion: 1, count: 1 }, expectedEtag: empty.value.etag, idempotencyKey: 'idem.repo.1', correlationId: 'correlation.1' };
const saved = await repo.replace(command); assert.equal(saved.ok, true); assert.equal(atomicWrites, 1);
assert.equal(authorityRaw.value.count, 1); assert.ok(authorityRaw.ledger['idem.repo.1']); assert.equal(legacyRaw.count, 1);
const replay = await repo.replace(command); assert.equal(replay.ok, true); assert.equal(replay.changed, false); assert.equal(atomicWrites, 1);
const collision = await repo.replace({ ...command, value: { schemaVersion: 1, count: 2 } }); assert.equal(collision.error.code, 'CONFLICT');
const stale = await repo.replace({ ...command, idempotencyKey: 'idem.repo.2' }); assert.equal(stale.error.code, 'CONFLICT');

let failedAuthority = authorityRaw;
const failing = createVersionedJsonRepositoryV1({
  storage: { read: () => failedAuthority, write: () => { throw new Error('quota'); } },
  empty: () => ({ schemaVersion: 1, count: 0 }),
  parse: (value) => value?.schemaVersion === 1 && Number.isInteger(value.count) ? structuredClone(value) : null,
  invalidReason: 'test.store_corrupted',
});
const beforeFailure = structuredClone(failedAuthority);
const failed = await failing.replace({ value: { schemaVersion: 1, count: 2 }, expectedEtag: saved.value.etag, idempotencyKey: 'idem.repo.fail', correlationId: 'correlation.fail' });
assert.equal(failed.error.code, 'UNAVAILABLE'); assert.deepEqual(failedAuthority, beforeFailure, 'failed atomic write leaves authority unchanged');

const sha256 = async (bytes) => createHash('sha256').update(bytes).digest('hex');
const png = Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64'));
const pngSha = await sha256(png);
const binary = createInMemoryAssetBinaryStorageV1();
let assetMetadata = null;
const assets = createLocalAssetUploadPortV1({
  binary,
  sha256,
  readMetadata: () => assetMetadata,
  writeMetadata: (value) => { assetMetadata = structuredClone(value); },
});
const assetContext = await identity.issueContext({ operation: 'asset.write', idempotencyKey: 'idem.asset.1' });
const assetInput = {
  uploadId: 'upload.asset.1', assetId: 'asset.test.1', ownerRef: assetContext.value.actor.actorRef,
  purpose: 'PUBLISH_PREVIEW', fileName: 'preview.png', mimeType: 'image/png', byteLength: png.byteLength,
  sha256: pngSha, width: 1, height: 1, colorSpace: 'srgb', alphaMode: 'STRAIGHT',
  source: { sourceType: 'ORIGINAL' }, copyrightDeclared: true, moderationStatus: 'PENDING', bytes: png,
};
const uploaded = await assets.upload(assetContext.value, assetInput); assert.equal(uploaded.ok, true); assert.equal(uploaded.value.status, 'READY');
assert.ok(parseAssetUploadRecordV1(uploaded.value)); assert.equal('bytes' in uploaded.value, false);
const uploadReplay = await assets.upload(assetContext.value, assetInput); assert.equal(uploadReplay.ok, true); assert.equal(uploadReplay.changed, false);
const sameKeyDifferentCommand = await assets.upload(assetContext.value, { ...assetInput, uploadId: 'upload.asset.other', assetId: 'asset.test.other' });
assert.equal(sameKeyDifferentCommand.error.code, 'IDEMPOTENCY_CONFLICT');
assert.equal(assetMetadata.records.length, 1, 'context-key collision is writer-zero');
const governanceReplayContext = await identity.issueContext({ operation: 'asset.write', idempotencyKey: 'idem.asset.governance-drift' });
const governanceDrift = await assets.upload(governanceReplayContext.value, {
  ...assetInput, source: { sourceType: 'AI_ASSISTED' }, copyrightDeclared: false,
});
assert.equal(governanceDrift.error.code, 'IDEMPOTENCY_CONFLICT');
assert.equal(assetMetadata.records.length, 1, 'upload-id governance drift is writer-zero');
const failedAssetContext = await identity.issueContext({ operation: 'asset.write', idempotencyKey: 'idem.asset.failed' });
const badHash = await assets.upload(failedAssetContext.value, { ...assetInput, uploadId: 'upload.asset.bad', assetId: 'asset.test.bad', sha256: '0'.repeat(64) });
assert.equal(badHash.error.code, 'INTEGRITY_MISMATCH');
assert.equal(assetMetadata.idempotency['idem.asset.failed'], undefined, 'failed validation writes no idempotency result');
const validRetry = await assets.upload(failedAssetContext.value, { ...assetInput, uploadId: 'upload.asset.retry', assetId: 'asset.test.retry' });
assert.equal(validRetry.ok, true, 'same key may retry after writer-zero validation failure');

// Runtime PublishPackage result retains all 11 exact bytes out of the serialized package.
const renderer = { rendererId: 'test.real-png', render: () => ({ ok: true, output: { bytes: png, mimeType: 'image/png', width: 1, height: 1, colorSpace: 'srgb', fidelity: 'EXACT' } }) };
const packageResult = await buildPublishPackageV1(CANONICAL_USE_DEMO_RELEASE_RECORD_V1, {
  rendererRevision: 'test-real-png-v1', renderer3d: renderer, renderer2d: renderer,
  sha256, nextAssetId: createDeterministicPublishIdFactoryV1(),
  resolveGeometry: () => ({ status: 'resolved', shapeId: 'almond', lengthId: 'medium' }),
});
assert.equal(packageResult.ok, true); assert.equal(packageResult.artifacts.length, 11);
assert.ok(packageResult.artifacts.every((artifact) => artifact.bytes instanceof Uint8Array && artifact.bytes.byteLength === png.byteLength));
assert.equal(JSON.stringify(packageResult.package).includes('bytes'), false, 'serialized package never embeds bytes');

let packageAuthorityRaw = null; let packageAssetMetadata = null;
const packageBinary = createInMemoryAssetBinaryStorageV1();
const packageAssets = createLocalAssetUploadPortV1({
  binary: packageBinary, sha256,
  readMetadata: () => packageAssetMetadata,
  writeMetadata: (value) => { packageAssetMetadata = structuredClone(value); },
});
const authority = createLocalPublishPackageAuthorityPortV1({
  storage: { read: () => packageAuthorityRaw, write: (value) => { packageAuthorityRaw = structuredClone(value); } },
});
const tampered = structuredClone(packageResult.artifacts);
tampered[3].bytes[0] ^= 1;
const rejectedPackage = await registerPublishPackageArtifactsV1({
  result: { package: packageResult.package, artifacts: tampered }, identity, assets: packageAssets, authority,
  editorDocSha256: CANONICAL_USE_DEMO_RELEASE_RECORD_V1.designVersion.editorDocRef.sha256,
  copyrightDeclared: true, source: { sourceType: 'ORIGINAL' },
});
assert.equal(rejectedPackage.error.code, 'INTEGRITY_MISMATCH'); assert.equal(packageAuthorityRaw, null); assert.equal(packageAssetMetadata, null);
const registered = await registerPublishPackageArtifactsV1({
  result: packageResult, identity, assets: packageAssets, authority,
  editorDocSha256: CANONICAL_USE_DEMO_RELEASE_RECORD_V1.designVersion.editorDocRef.sha256,
  copyrightDeclared: true, source: { sourceType: 'ORIGINAL' },
});
assert.equal(registered.ok, true); assert.equal(registered.value.assets.length, 11); assert.equal(registered.value.status, 'READY');
assert.equal(registered.value.ownerRef, 'profile.local-demo.creator');
const registeredReplay = await registerPublishPackageArtifactsV1({
  result: packageResult, identity, assets: packageAssets, authority,
  editorDocSha256: CANONICAL_USE_DEMO_RELEASE_RECORD_V1.designVersion.editorDocRef.sha256,
  copyrightDeclared: true, source: { sourceType: 'ORIGINAL' },
});
assert.equal(registeredReplay.ok, true); assert.equal(registeredReplay.changed, false);
const beforeAuthorityConflict = structuredClone(packageAuthorityRaw);
const beforeAssetConflict = structuredClone(packageAssetMetadata);
const authorityConflict = await registerPublishPackageArtifactsV1({
  result: packageResult, identity, assets: packageAssets, authority,
  editorDocSha256: 'f'.repeat(64), copyrightDeclared: true, source: { sourceType: 'ORIGINAL' },
});
assert.equal(authorityConflict.error.code, 'IDEMPOTENCY_CONFLICT');
assert.deepEqual(packageAuthorityRaw, beforeAuthorityConflict); assert.deepEqual(packageAssetMetadata, beforeAssetConflict);
let rotatingContextCalls = 0;
const rotatingIdentity = {
  adapterKind: 'REMOTE',
  async issueContext(request) {
    rotatingContextCalls += 1;
    return (rotatingContextCalls === 1 ? identity : createLocalPrototypeIdentityAccessPortV1({
      actorRef: 'profile.rotated.creator', permissions: Object.values(BACKEND_PERMISSIONS_V1), now: () => now,
    })).issueContext(request);
  },
};
let rotatingAuthorityRaw = null; let rotatingAssetMetadata = null;
const rotatingRegistration = await registerPublishPackageArtifactsV1({
  result: packageResult, identity: rotatingIdentity,
  assets: createLocalAssetUploadPortV1({
    binary: createInMemoryAssetBinaryStorageV1(), sha256,
    readMetadata: () => rotatingAssetMetadata, writeMetadata: (value) => { rotatingAssetMetadata = structuredClone(value); },
  }),
  authority: createLocalPublishPackageAuthorityPortV1({
    storage: { read: () => rotatingAuthorityRaw, write: (value) => { rotatingAuthorityRaw = structuredClone(value); } },
  }),
  editorDocSha256: CANONICAL_USE_DEMO_RELEASE_RECORD_V1.designVersion.editorDocRef.sha256,
  copyrightDeclared: true, source: { sourceType: 'ORIGINAL' },
});
assert.equal(rotatingRegistration.error.reason, 'publish.identity_changed');
assert.equal(rotatingAssetMetadata, null); assert.equal(rotatingAuthorityRaw, null);

// Explicit bridge for the bundled non-numeric flat-assets-v1 revision.
const resolver = createAssetReferenceResolverV1({
  identity, assets: packageAssets, aliases: [],
  bundled: [{
    sourceAssetId: 'asset.flat-content.bundled.sticker.sparkle', sourceRevision: 'flat-assets-v1',
    canonicalAssetId: registered.value.assets[0].assetId, canonicalRevision: 1,
    canonicalRef: { assetId: registered.value.assets[0].assetId, revision: 1, sha256: registered.value.assets[0].sha256, mimeType: registered.value.assets[0].mimeType },
  }],
});
const resolved = await resolver.resolve({ assetId: 'asset.flat-content.bundled.sticker.sparkle', revision: 'flat-assets-v1' });
assert.equal(resolved.ok, true); assert.equal(resolved.value.revision, 1);
assert.equal((await resolver.resolve({ assetId: 'asset.unknown', revision: 'flat-assets-v1' })).error.code, 'NOT_FOUND');
const foreignResolver = createAssetReferenceResolverV1({
  identity: createLocalPrototypeIdentityAccessPortV1({
    actorRef: 'profile.foreign.resolver', permissions: ['asset.read'], now: () => now,
  }),
  assets: packageAssets,
  aliases: [{
    sourceAssetId: registered.value.assets[0].assetId, sourceRevision: 'alias-v1',
    canonicalAssetId: registered.value.assets[0].assetId, canonicalRevision: 1,
  }],
});
assert.equal((await foreignResolver.resolve({ assetId: registered.value.assets[0].assetId, revision: 'alias-v1' })).error.reason,
  'asset.reference_owner_mismatch');

// Versioned-use event persistence is async, permission-guarded and fail-closed.
const versionedUse = createLocalVersionedUsePersistencePortV1();
const versionedWriteContext = await identity.issueContext({ operation: 'versioned-use.write', idempotencyKey: 'idem.versioned.1' });
assert.equal(versionedWriteContext.ok, true);
const customizeEvent = {
  event: 'look_customize', eventId: 'intent.v2.test', lookId: 'look.test',
  designVersionId: 'design-version.test', targetDesignId: 'design.target', occurredAt: now,
};
const eventSaved = await versionedUse.recordEvent(versionedWriteContext.value, customizeEvent);
assert.equal(eventSaved.ok, true); assert.equal(eventSaved.changed, true);
const eventReplay = await versionedUse.recordEvent(versionedWriteContext.value, customizeEvent);
assert.equal(eventReplay.ok, true); assert.equal(eventReplay.changed, false);
const versionedReadContext = await identity.issueContext({ operation: 'versioned-use.read' });
const eventRead = await versionedUse.readEvents(versionedReadContext.value);
assert.equal(eventRead.ok, true); assert.equal(eventRead.value.length, 1);
const readOnlyIdentity = createLocalPrototypeIdentityAccessPortV1({
  actorRef: 'viewer.versioned', permissions: ['versioned-use.read'], now: () => now,
});
const readOnlyContext = await readOnlyIdentity.issueContext({ operation: 'versioned-use.read' });
const forbiddenEvent = await versionedUse.recordEvent(readOnlyContext.value, customizeEvent);
assert.equal(forbiddenEvent.error.code, 'FORBIDDEN');
writeEnvelope(StorageKeys.lookCustomizeEvents, { broken: { ...customizeEvent, unexpected: true } });
const corruptedEvents = await versionedUse.readEvents(versionedReadContext.value);
assert.equal(corruptedEvents.error.code, 'DATA_CORRUPTED');
localStorage.clear();

// COMM-v0.7.2-TAX-02: a corrupted legacy V1 publication payload fails closed
// (DATA_CORRUPTED), stays byte-unchanged, and never falls back to an empty
// store write on the authority key.
{
  const corruptLegacyPayload = {
    schemaVersion: 1, kind: 'CREATOR_PUBLICATION_STORE',
    drafts: 'not-an-array', looks: [],
  };
  writeEnvelope(StorageKeys.creatorPublications, corruptLegacyPayload);
  const authorityKey = `nail-studio:${StorageKeys.backendPublicationRepository}`;
  const legacyKey = `nail-studio:${StorageKeys.creatorPublications}`;
  const legacyRawBefore = localStorage.getItem(legacyKey);
  assert.ok(legacyRawBefore, 'corrupt legacy payload must be seeded');
  assert.equal(localStorage.getItem(authorityKey), null, 'authority key starts empty');
  const corruptPort = createLocalCreatorPublicationPortV1();
  const corruptReadContext = await identity.issueContext({ operation: 'publication.read' });
  const corruptRead = await corruptPort.read(corruptReadContext.value);
  assert.equal(corruptRead.ok, false);
  assert.equal(corruptRead.error.code, 'DATA_CORRUPTED');
  assert.equal(corruptRead.error.reason, 'publication.store_corrupted');
  assert.equal(localStorage.getItem(legacyKey), legacyRawBefore, 'corrupted legacy payload is byte-unchanged');
  assert.equal(localStorage.getItem(authorityKey), null, 'no empty authority store overwrites the corrupted payload');
  localStorage.clear();
}

// Application services own identity, time, ETag and domain commands; pages only consume them.
function memoryPort(initial) {
  let value = structuredClone(initial);
  return {
    adapterKind: 'LOCAL_PROTOTYPE',
    peek() { return structuredClone(value); },
    set(next) { value = structuredClone(next); },
    async read() { return { ok: true, value: { value: structuredClone(value), etag: localEtagV1(value) }, changed: false }; },
    async replace(_context, next, expectedEtag) {
      if (expectedEtag !== localEtagV1(value)) return { ok: false, error: { schemaVersion: 1, code: 'CONFLICT', retryable: false, reason: 'repository.etag_mismatch' } };
      const changed = localEtagV1(next) !== localEtagV1(value); value = structuredClone(next);
      return { ok: true, value: { value: structuredClone(value), etag: localEtagV1(value) }, changed };
    },
  };
}
const publicationMemory = memoryPort(createEmptyCreatorPublicationStoreV2());
const governanceMemory = memoryPort(emptyGovernanceStoreV1());
const approvalMemory = memoryPort(emptyClientApprovalStoreV1());
let authorityRecords = [structuredClone(registered.value)];
const authorityMemory = {
  adapterKind: 'LOCAL_PROTOTYPE',
  async read() { const value = { schemaVersion: 1, records: structuredClone(authorityRecords) }; return { ok: true, value: { value, etag: localEtagV1(value) }, changed: false }; },
  async replace() { throw new Error('not used'); },
};
let appId = 0; let domainIdCalls = 0; let applicationContextId = 0;
const appNextId = (scope) => { domainIdCalls += 1; return `${scope}${++appId}`; };
const app = createCreatorWorkspaceApplicationServiceV1({
  identity, publication: publicationMemory, governance: governanceMemory, approvals: approvalMemory,
  authority: authorityMemory, assets: packageAssets, nextId: appNextId,
  taxonomy: strictTaxonomyProvider,
  token: { generate: () => 'raw-client-token', sha256: async (value) => createHash('sha256').update(value).digest('hex') },
});
let workspace = await app.createDraft(packageResult.package.designVersionId); assert.equal(workspace.ok, true);
const draftId = workspace.value.draftId;
workspace = await app.updateDraft(draftId, { title: 'Backend Authority Look', tags: ['authority'], visibility: 'UNLISTED', copyrightDeclared: true, sourceDeclared: true, step: 3 });
assert.equal(workspace.ok, true);
// COMM-v0.7.2-TAX-02: the PUBLIC flow authors valid structured discovery
// (bumps contentRevision) BEFORE review is submitted and bound.
workspace = await app.updateDraft(draftId, { discovery: structuredClone(VALID_DISCOVERY) });
assert.equal(workspace.ok, true);
assert.equal(workspace.value.publication.drafts[0].contentRevision, 3, 'discovery authoring bumps contentRevision once');
workspace = await app.submitReview(draftId); assert.equal(workspace.ok, true);
const idsBeforeDuplicateReview = domainIdCalls;
assert.equal((await app.submitReview(draftId)).ok, false); assert.equal(domainIdCalls, idsBeforeDuplicateReview,
  'duplicate review preflight consumes no domain ids');
const pendingReview = workspace.value.governance.publicationReviews[0];
const operatorIdentity = createLocalPrototypeIdentityAccessPortV1({ actorRef: 'operator.1', permissions: ['governance.read', 'governance.write'], now: () => now, nextId: (prefix) => `${prefix}${++applicationContextId}` });
const governanceApp = createGovernanceApplicationServiceV1({ identity: operatorIdentity, governance: governanceMemory, nextId: appNextId });
const cleared = await governanceApp.decidePublicationReview(pendingReview.reviewId, 'CLEARED'); assert.equal(cleared.ok, true);
const idsBeforeDecidedReview = domainIdCalls;
assert.equal((await governanceApp.decidePublicationReview(pendingReview.reviewId, 'REJECTED')).ok, false);
assert.equal(domainIdCalls, idsBeforeDecidedReview, 'already-decided review consumes no audit id');
const governanceBeforeInvalidTransition = governanceMemory.peek();
governanceMemory.set({
  ...governanceBeforeInvalidTransition,
  cases: [{
    schemaVersion: 1, caseId: 'case.invalid-transition', subjectType: 'PUBLISHED_LOOK', subjectId: 'look.pending',
    status: 'REPORTED', reporterRef: 'profile.reporter', reasonCode: 'policy-report', objectVersion: 1,
    createdAt: now, updatedAt: now,
  }],
});
const idsBeforeInvalidTransition = domainIdCalls;
assert.equal((await governanceApp.transitionCase('case.invalid-transition', 'HIDDEN')).ok, false);
assert.equal(domainIdCalls, idsBeforeInvalidTransition, 'invalid governance transition consumes no audit id');
governanceMemory.set(governanceBeforeInvalidTransition);
workspace = await app.updateDraft(draftId, { visibility: 'PUBLIC' }); assert.equal(workspace.ok, true);
workspace = await app.publishDraft(draftId); assert.equal(workspace.ok, true); assert.equal(workspace.value.publication.looks[0].visibility, 'PUBLIC');
const publishedV2Look = workspace.value.publication.looks[0];
assert.ok(workspace.value.publication.discovery[publishedV2Look.lookId], 'PUBLIC publish snapshots an exact discovery envelope');

// COMM-v0.7.2-TAX-02: PUBLIC with unresolved discovery fails closed,
// consumes no domain ids and writes nothing.
const unresolvedDraft = await app.createDraft(packageResult.package.designVersionId);
assert.equal(unresolvedDraft.ok, true);
const unresolvedDraftId = unresolvedDraft.value.draftId;
let unresolvedWorkspace = await app.updateDraft(unresolvedDraftId, {
  title: 'Unresolved Discovery Look', visibility: 'UNLISTED', copyrightDeclared: true, sourceDeclared: true, step: 3,
  discovery: { ...structuredClone(VALID_DISCOVERY), styleIds: ['style:nope'] },
});
assert.equal(unresolvedWorkspace.ok, true);
unresolvedWorkspace = await app.submitReview(unresolvedDraftId); assert.equal(unresolvedWorkspace.ok, true);
const unresolvedReview = unresolvedWorkspace.value.governance.publicationReviews.find((review) => review.draftId === unresolvedDraftId);
assert.ok(unresolvedReview);
assert.equal((await governanceApp.decidePublicationReview(unresolvedReview.reviewId, 'CLEARED')).ok, true);
unresolvedWorkspace = await app.updateDraft(unresolvedDraftId, { visibility: 'PUBLIC' }); assert.equal(unresolvedWorkspace.ok, true);
const idsBeforeUnresolvedPublish = domainIdCalls;
const publicationBeforeUnresolvedPublish = publicationMemory.peek();
const unresolvedPublish = await app.publishDraft(unresolvedDraftId);
assert.equal(unresolvedPublish.ok, false);
assert.equal(unresolvedPublish.error.code, 'INVALID');
assert.equal(unresolvedPublish.error.reason, 'publication.discovery_unresolved');
assert.equal(domainIdCalls, idsBeforeUnresolvedPublish, 'unresolved discovery consumes no domain ids');
assert.deepEqual(publicationMemory.peek(), publicationBeforeUnresolvedPublish, 'unresolved discovery is writer-zero');

// Taxonomy source failure fails closed (UNAVAILABLE) before any PUBLIC commit.
const failingTaxonomyApp = createCreatorWorkspaceApplicationServiceV1({
  identity, publication: publicationMemory, governance: governanceMemory, approvals: approvalMemory,
  authority: authorityMemory, assets: packageAssets, nextId: appNextId,
  taxonomy: { load: async () => null },
  token: { generate: () => 'raw-failing-token', sha256: async (value) => createHash('sha256').update(value).digest('hex') },
});
const unavailableDraft = await failingTaxonomyApp.createDraft(packageResult.package.designVersionId);
assert.equal(unavailableDraft.ok, true);
const unavailableDraftId = unavailableDraft.value.draftId;
let unavailableWorkspace = await failingTaxonomyApp.updateDraft(unavailableDraftId, {
  title: 'Taxonomy Unavailable Look', visibility: 'UNLISTED', copyrightDeclared: true, sourceDeclared: true, step: 3,
  discovery: structuredClone(VALID_DISCOVERY),
});
assert.equal(unavailableWorkspace.ok, true);
unavailableWorkspace = await failingTaxonomyApp.submitReview(unavailableDraftId); assert.equal(unavailableWorkspace.ok, true);
const unavailableReview = unavailableWorkspace.value.governance.publicationReviews.find((review) => review.draftId === unavailableDraftId);
assert.ok(unavailableReview);
assert.equal((await governanceApp.decidePublicationReview(unavailableReview.reviewId, 'CLEARED')).ok, true);
unavailableWorkspace = await failingTaxonomyApp.updateDraft(unavailableDraftId, { visibility: 'PUBLIC' }); assert.equal(unavailableWorkspace.ok, true);
const idsBeforeUnavailablePublish = domainIdCalls;
const publicationBeforeUnavailablePublish = publicationMemory.peek();
const unavailablePublish = await failingTaxonomyApp.publishDraft(unavailableDraftId);
assert.equal(unavailablePublish.ok, false);
assert.equal(unavailablePublish.error.code, 'UNAVAILABLE');
assert.equal(unavailablePublish.error.reason, 'publication.taxonomy_unavailable');
assert.equal(domainIdCalls, idsBeforeUnavailablePublish, 'taxonomy failure consumes no domain ids');
assert.deepEqual(publicationMemory.peek(), publicationBeforeUnavailablePublish, 'taxonomy failure is writer-zero');
const otherIdentity = createLocalPrototypeIdentityAccessPortV1({
  actorRef: 'profile.other.creator', permissions: Object.values(BACKEND_PERMISSIONS_V1), now: () => now,
  nextId: (prefix) => `${prefix}other.${++applicationContextId}`,
});
const otherApp = createCreatorWorkspaceApplicationServiceV1({
  identity: otherIdentity, publication: publicationMemory, governance: governanceMemory, approvals: approvalMemory,
  authority: authorityMemory, assets: packageAssets, nextId: appNextId,
  taxonomy: strictTaxonomyProvider,
  token: { generate: () => 'raw-other-token', sha256: async (value) => createHash('sha256').update(value).digest('hex') },
});
const publicationBeforeCrossOwnerCreate = publicationMemory.peek();
const crossOwnerCreate = await otherApp.createDraft(packageResult.package.designVersionId);
assert.equal(crossOwnerCreate.error.code, 'FORBIDDEN'); assert.deepEqual(publicationMemory.peek(), publicationBeforeCrossOwnerCreate);
const seededOtherDraft = createCreatorPublicationDraftV1({
  store: publicationMemory.peek(), draftId: 'draft.other.seeded', creatorProfileId: 'profile.other.creator',
  package: packageResult.package, now,
});
assert.equal(seededOtherDraft.ok, true);
const seededPublication = seededOtherDraft.value;
seededPublication.looks.push({ ...structuredClone(seededPublication.looks[0]), lookId: 'look.other.seeded', creatorProfileId: 'profile.other.creator' });
publicationMemory.set(seededPublication);
const ownerProjection = await app.load(); assert.equal(ownerProjection.ok, true);
assert.equal(ownerProjection.value.publication.drafts.some((draft) => draft.creatorProfileId !== 'profile.local-demo.creator'), false);
assert.equal(ownerProjection.value.publication.looks.some((look) => look.creatorProfileId !== 'profile.local-demo.creator'), false);
const beforeOwnerAttacks = publicationMemory.peek();
assert.equal((await app.updateDraft('draft.other.seeded', { title: 'hijack' })).error.code, 'FORBIDDEN');
assert.equal((await app.submitReview('draft.other.seeded')).error.code, 'FORBIDDEN');
assert.equal((await app.publishDraft('draft.other.seeded')).error.code, 'FORBIDDEN');
assert.equal((await app.setLookHidden('look.other.seeded', true)).error.code, 'FORBIDDEN');
assert.deepEqual(publicationMemory.peek(), beforeOwnerAttacks, 'cross-owner mutations are writer-zero');
const shared = await app.createClientShare(packageResult.package.designVersionId); assert.equal(shared.ok, true);
assert.equal((await otherApp.createClientShare(packageResult.package.designVersionId)).error.code, 'FORBIDDEN');
let shareContextCalls = 0; let rotatingTokenCalls = 0;
const rotatingShareIdentity = {
  adapterKind: 'REMOTE',
  async issueContext(request) {
    shareContextCalls += 1;
    return (shareContextCalls < 7 ? identity : otherIdentity).issueContext(request);
  },
};
const approvalBeforeIdentityDrift = approvalMemory.peek();
const rotatingShareApp = createCreatorWorkspaceApplicationServiceV1({
  identity: rotatingShareIdentity, publication: publicationMemory, governance: governanceMemory, approvals: approvalMemory,
  authority: authorityMemory, assets: packageAssets, nextId: appNextId,
  taxonomy: strictTaxonomyProvider,
  token: { generate: () => { rotatingTokenCalls += 1; return 'raw-rotating-token'; }, sha256: async (value) => createHash('sha256').update(value).digest('hex') },
});
const rotatingShare = await rotatingShareApp.createClientShare(packageResult.package.designVersionId);
assert.equal(rotatingShare.error.reason, 'approval.identity_changed'); assert.equal(rotatingTokenCalls, 0);
assert.deepEqual(approvalMemory.peek(), approvalBeforeIdentityDrift, 'share identity drift is writer-zero');
const anonymousIdentity = createLocalPrototypeIdentityAccessPortV1({
  actorRef: 'anonymous.share', permissions: ['approval.read', 'approval.write', 'package-reference.read', 'asset.read'],
  disclosure: 'ANONYMOUS_SHARE', now: () => now, nextId: (prefix) => `${prefix}${++applicationContextId}`,
});
const clientApp = createClientApprovalApplicationServiceV1({
  identity: anonymousIdentity, approvals: approvalMemory, authority: authorityMemory, assets: packageAssets, nextId: appNextId,
  sha256: async (value) => createHash('sha256').update(value).digest('hex'),
});
const noAssetReadIdentity = createLocalPrototypeIdentityAccessPortV1({
  actorRef: 'anonymous.no-assets', permissions: ['approval.read', 'approval.write', 'package-reference.read'],
  disclosure: 'ANONYMOUS_SHARE', now: () => now,
});
const noAssetReadApp = createClientApprovalApplicationServiceV1({
  identity: noAssetReadIdentity, approvals: approvalMemory, authority: authorityMemory, assets: packageAssets,
  nextId: appNextId, sha256: async (value) => createHash('sha256').update(value).digest('hex'),
});
assert.equal((await noAssetReadApp.loadByRawToken(shared.value.rawToken)).error.code, 'FORBIDDEN');
const missingBytesApp = createClientApprovalApplicationServiceV1({
  identity: anonymousIdentity, approvals: approvalMemory, authority: authorityMemory,
  assets: { ...packageAssets, async readBytes() { return { ok: false, error: { schemaVersion: 1, code: 'DATA_CORRUPTED', retryable: false, reason: 'asset.bytes_missing' } }; } },
  nextId: appNextId, sha256: async (value) => createHash('sha256').update(value).digest('hex'),
});
assert.equal((await missingBytesApp.loadByRawToken(shared.value.rawToken)).error.code, 'DATA_CORRUPTED');
let clientView = await clientApp.loadByRawToken(shared.value.rawToken); assert.equal(clientView.ok, true);
clientView = await clientApp.decide(shared.value.rawToken, 'APPROVED', 'Looks good'); assert.equal(clientView.ok, true); assert.equal(clientView.value.existingDecision.decision, 'APPROVED');
const approvalSnapshot = approvalMemory.peek();
const tamperedApproval = structuredClone(approvalSnapshot);
tamperedApproval.snapshots[0].rendererRevision = 'renderer.tampered';
approvalMemory.set(tamperedApproval);
assert.equal((await clientApp.loadByRawToken(shared.value.rawToken)).error.code, 'DATA_CORRUPTED');
const changeRequestWithSnapshot = structuredClone(approvalSnapshot);
changeRequestWithSnapshot.events[0].decision = 'CHANGE_REQUESTED';
approvalMemory.set(changeRequestWithSnapshot);
assert.equal((await clientApp.loadByRawToken(shared.value.rawToken)).error.code, 'DATA_CORRUPTED');
approvalMemory.set(approvalSnapshot);
const approvalEventsAfterFirst = approvalMemory.peek().events.length;
const decisionIdsBeforeReplay = domainIdCalls;
const approvalReplay = await clientApp.decide(shared.value.rawToken, 'APPROVED', '  Looks good  ');
assert.equal(approvalReplay.ok, true); assert.equal(approvalReplay.changed, false);
assert.equal(domainIdCalls, decisionIdsBeforeReplay, 'semantic decision replay consumes no event id');
assert.equal(approvalMemory.peek().events.length, approvalEventsAfterFirst);
const conflictingDecision = await clientApp.decide(shared.value.rawToken, 'CHANGE_REQUESTED', 'Needs changes');
assert.equal(conflictingDecision.error.code, 'CONFLICT'); assert.equal(domainIdCalls, decisionIdsBeforeReplay);
const conflictingNote = await clientApp.decide(shared.value.rawToken, 'APPROVED', 'Different note');
assert.equal(conflictingNote.error.code, 'CONFLICT'); assert.equal(approvalMemory.peek().events.length, approvalEventsAfterFirst);
authorityRecords = [];
const missingAuthorityEvents = approvalMemory.peek().events.length;
const missingAuthority = await clientApp.loadByRawToken(shared.value.rawToken);
assert.equal(missingAuthority.error.code, 'PRECONDITION_FAILED'); assert.equal(approvalMemory.peek().events.length, missingAuthorityEvents);
authorityRecords = [structuredClone(registered.value)];
const newer = structuredClone(registered.value); newer.package.designVersionId = 'design-version.newer'; newer.package.version += 1;
authorityRecords = [...authorityRecords, newer];
const staleClient = await clientApp.loadByRawToken(shared.value.rawToken); assert.equal(staleClient.error.code, 'STALE', 'approval service compares against authority latest, not share version');

// Creator slice failure is isolated from legacy/official Explore and emits a
// non-sensitive diagnostic exactly once.
const originalFetch = globalThis.fetch;
// COMM-v0.7.2-TAX-02: the fetch stub serves all three discovery fixtures by
// URL so the strict loader (taxonomy-v2 + migration-manifest-v1 +
// content-index) runs the real load path.
globalThis.fetch = async (url) => {
  const target = String(url);
  if (target.endsWith('/community/taxonomy-v2.json')) return { ok: true, json: async () => structuredClone(taxonomyRaw) };
  if (target.endsWith('/community/migration-manifest-v1.json')) return { ok: true, json: async () => structuredClone(migrationManifestRaw) };
  return { ok: true, json: async () => structuredClone(contentIndexRaw) };
};
const { loadLookReadModels } = await import('../src/community/data/look-repository.ts');
const { creatorLookMatchesPackageAuthorityV1, isCreatorLookGovernanceVisibleV1 } = await import('../src/integration/community-studio/backend-runtime.ts');
const ownPublishedLook = publicationMemory.peek().looks.find((look) => look.creatorProfileId === 'profile.local-demo.creator');
assert.equal(creatorLookMatchesPackageAuthorityV1(ownPublishedLook, registered.value), true);
const driftedPublishedLook = structuredClone(ownPublishedLook); driftedPublishedLook.coverPreview.sha256 = 'f'.repeat(64);
assert.equal(creatorLookMatchesPackageAuthorityV1(driftedPublishedLook, registered.value), false);
assert.equal(isCreatorLookGovernanceVisibleV1(ownPublishedLook.lookId, [{
  schemaVersion: 1, caseId: 'case.hidden-look', subjectType: 'PUBLISHED_LOOK', subjectId: ownPublishedLook.lookId,
  status: 'HIDDEN', reporterRef: 'profile.reporter', reasonCode: 'policy-report', objectVersion: 1,
  createdAt: now, updatedAt: now,
}]), false);
const diagnostics = [];
const resilientLooks = await loadLookReadModels({
  loadCreator: async () => { throw new Error('private backend detail'); },
  onDiagnostic: (diagnostic) => diagnostics.push(diagnostic),
});
assert.ok(resilientLooks.some((look) => look.contentId === 'cc_mercury_dew'));
assert.deepEqual(diagnostics, [{ scope: 'creator-look-slice', code: 'UNAVAILABLE' }]);
globalThis.fetch = originalFetch;

const uiFiles = [
  'src/community/pages/CreatorWorkspacePage.tsx',
  'src/community/pages/GovernanceWorkspacePage.tsx',
  'src/community/pages/ClientSharePage.tsx',
  'src/integration/community-studio/versioned-use-runtime.ts',
];
for (const file of uiFiles) {
  const source = await readFile(new URL(`../${file}`, import.meta.url), 'utf8');
  assert.doesNotMatch(source, /(?:readData|writeEnvelope|localStorage|creator-publication-repository|governance-repository|client-approval-repository|editor\/v7\/repository|repo-v6)/, `${file} must consume application ports, not storage/repositories`);
}

console.log('[GEN-V7.1-04] service/error/identity/atomic repository/assets/artifacts/reference/application cutover: PASS');
