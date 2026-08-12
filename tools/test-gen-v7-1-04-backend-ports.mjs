import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import {
  createAssetReferenceResolverV1,
  createClientApprovalApplicationServiceV1,
  createCreatorWorkspaceApplicationServiceV1,
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
import { createEmptyCreatorPublicationStoreV1 } from '../src/community/domain/v7_1/creator-publication.ts';
import { emptyGovernanceStoreV1 } from '../src/community/domain/v7_1/governance.ts';
import { emptyClientApprovalStoreV1 } from '../src/studio/approval/client-approval.ts';
import {
  buildPublishPackageV1,
  createDeterministicPublishIdFactoryV1,
} from '../src/studio/publishing/index.ts';
import { CANONICAL_USE_DEMO_RELEASE_RECORD_V1 } from '../src/integration/community-studio/canonical-use-demo.ts';

const now = '2026-08-12T12:00:00.000Z';
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
const badHash = await assets.upload(assetContext.value, { ...assetInput, uploadId: 'upload.asset.bad', assetId: 'asset.test.bad', sha256: '0'.repeat(64) });
assert.equal(badHash.error.code, 'INTEGRITY_MISMATCH');

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

// Application services own identity, time, ETag and domain commands; pages only consume them.
function memoryPort(initial) {
  let value = structuredClone(initial);
  return {
    adapterKind: 'LOCAL_PROTOTYPE',
    async read() { return { ok: true, value: { value: structuredClone(value), etag: localEtagV1(value) }, changed: false }; },
    async replace(_context, next, expectedEtag) {
      if (expectedEtag !== localEtagV1(value)) return { ok: false, error: { schemaVersion: 1, code: 'CONFLICT', retryable: false, reason: 'repository.etag_mismatch' } };
      const changed = localEtagV1(next) !== localEtagV1(value); value = structuredClone(next);
      return { ok: true, value: { value: structuredClone(value), etag: localEtagV1(value) }, changed };
    },
  };
}
const publicationMemory = memoryPort(createEmptyCreatorPublicationStoreV1());
const governanceMemory = memoryPort(emptyGovernanceStoreV1());
const approvalMemory = memoryPort(emptyClientApprovalStoreV1());
let authorityRecords = [structuredClone(registered.value)];
const authorityMemory = {
  adapterKind: 'LOCAL_PROTOTYPE',
  async read() { const value = { schemaVersion: 1, records: structuredClone(authorityRecords) }; return { ok: true, value: { value, etag: localEtagV1(value) }, changed: false }; },
  async replace() { throw new Error('not used'); },
};
let appId = 0;
const appNextId = (scope) => `${scope}${++appId}`;
const app = createCreatorWorkspaceApplicationServiceV1({
  identity, publication: publicationMemory, governance: governanceMemory, approvals: approvalMemory,
  authority: authorityMemory, assets: packageAssets, nextId: appNextId,
  token: { generate: () => 'raw-client-token', sha256: async (value) => createHash('sha256').update(value).digest('hex') },
});
let workspace = await app.createDraft(packageResult.package.designVersionId); assert.equal(workspace.ok, true);
const draftId = workspace.value.draftId;
workspace = await app.updateDraft(draftId, { title: 'Backend Authority Look', tags: ['authority'], visibility: 'UNLISTED', copyrightDeclared: true, sourceDeclared: true, step: 3 });
assert.equal(workspace.ok, true);
workspace = await app.submitReview(draftId); assert.equal(workspace.ok, true);
const pendingReview = workspace.value.governance.publicationReviews[0];
const operatorIdentity = createLocalPrototypeIdentityAccessPortV1({ actorRef: 'operator.1', permissions: ['governance.read', 'governance.write'], now: () => now, nextId: (prefix) => `${prefix}${++appId}` });
const governanceApp = createGovernanceApplicationServiceV1({ identity: operatorIdentity, governance: governanceMemory, nextId: appNextId });
const cleared = await governanceApp.decidePublicationReview(pendingReview.reviewId, 'CLEARED'); assert.equal(cleared.ok, true);
workspace = await app.updateDraft(draftId, { visibility: 'PUBLIC' }); assert.equal(workspace.ok, true);
workspace = await app.publishDraft(draftId); assert.equal(workspace.ok, true); assert.equal(workspace.value.publication.looks[0].visibility, 'PUBLIC');
const shared = await app.createClientShare(packageResult.package.designVersionId); assert.equal(shared.ok, true);
const anonymousIdentity = createLocalPrototypeIdentityAccessPortV1({
  actorRef: 'anonymous.share', permissions: ['approval.read', 'approval.write', 'package-reference.read'],
  disclosure: 'ANONYMOUS_SHARE', now: () => now, nextId: (prefix) => `${prefix}${++appId}`,
});
const clientApp = createClientApprovalApplicationServiceV1({
  identity: anonymousIdentity, approvals: approvalMemory, authority: authorityMemory, nextId: appNextId,
  sha256: async (value) => createHash('sha256').update(value).digest('hex'),
});
let clientView = await clientApp.loadByRawToken(shared.value.rawToken); assert.equal(clientView.ok, true);
clientView = await clientApp.decide(shared.value.rawToken, 'APPROVED', 'Looks good'); assert.equal(clientView.ok, true); assert.equal(clientView.value.existingDecision.decision, 'APPROVED');
const newer = structuredClone(registered.value); newer.package.designVersionId = 'design-version.newer'; newer.package.version += 1;
authorityRecords = [...authorityRecords, newer];
const staleClient = await clientApp.loadByRawToken(shared.value.rawToken); assert.equal(staleClient.error.code, 'STALE', 'approval service compares against authority latest, not share version');

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
