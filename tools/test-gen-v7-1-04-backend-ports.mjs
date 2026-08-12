import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  createAssetReferenceResolverV1,
  createInMemoryAssetBinaryStorageV1,
  createLocalAssetUploadPortV1,
  createLocalPrototypeIdentityAccessPortV1,
  createLocalPublishPackageAuthorityPortV1,
  createVersionedJsonRepositoryV1,
  parseAssetUploadRecordV1,
  parseServiceCommandContextV1,
  parseServiceErrorV1,
  registerPublishPackageArtifactsV1,
  BACKEND_PERMISSIONS_V1,
} from '../src/platform/backend/index.ts';
import {
  buildPublishPackageV1,
  createDeterministicPublishIdFactoryV1,
} from '../src/studio/publishing/index.ts';
import { CANONICAL_USE_DEMO_RELEASE_RECORD_V1 } from '../src/integration/community-studio/canonical-use-demo.ts';

const now = '2026-08-12T12:00:00.000Z';
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

console.log('[GEN-V7.1-04] service/error/identity/atomic etag/idempotency/assets/artifacts/reference authority: PASS');
