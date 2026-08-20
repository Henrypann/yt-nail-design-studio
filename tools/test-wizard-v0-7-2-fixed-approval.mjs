import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const serviceSource = await readFile(new URL('../src/studio/approval/studio-approval-application-service.ts', import.meta.url), 'utf8');
const page = await readFile(new URL('../src/community/pages/ClientSharePage.tsx', import.meta.url), 'utf8');
const preview = await readFile(new URL('../src/studio/editor/components/CustomerPreviewShellV7.tsx', import.meta.url), 'utf8');
assert.match(serviceSource, /createFixedVersionShare\(input: \{ designId: string; expectedRevision: number \}\)/);
assert.match(serviceSource, /details\.length !== 10/);
assert.match(serviceSource, /fixed_version_receipt_corrupted/);
assert.match(serviceSource, /approval\.fixed_preview_asset_corrupt/);
assert.match(serviceSource, /data:\$\{output\.mimeType\};base64/);
assert.match(serviceSource, /releaseSavedEditorDocV7/);
assert.match(serviceSource, /buildPublishPackageV1/);
assert.match(serviceSource, /registerPublishPackageArtifactsV1/);
assert.match(page, /preview\.cover\.locator/);
assert.match(page, /preview\.details\.map/);
assert.doesNotMatch(page, /rounded-\[50%_50%_38%_38%\]/);
assert.match(preview, /studioApprovalApplicationServiceV1\.createFixedVersionShare/);
console.log('wizard fixed approval contract checks passed');

// Behaviour harness: real release/package/authority/asset/approval contracts,
// with only browser persistence and renderer replaced by deterministic fakes.
const root = process.cwd();
const fixture = await import(pathToFileURL(path.join(root, 'src/studio/editor/fixtures/editor-doc-v7.mjs')).href);
const studioApproval = await import(pathToFileURL(path.join(root, 'src/studio/approval/studio-approval-application-service.ts')).href);
const approvalDomain = await import(pathToFileURL(path.join(root, 'src/studio/approval/client-approval.ts')).href);
const backend = await import(pathToFileURL(path.join(root, 'src/platform/backend/index.ts')).href);
const { EDITOR_DOC_V7_MINIMAL_FIXTURE, EDITOR_DOC_V7_FULL_FIXTURE } = fixture;
const { createStudioApprovalApplicationServiceV1, buildFixedPreviewReadModelV1 } = studioApproval;
const runtime = await import(pathToFileURL(path.join(root, 'src/integration/community-studio/backend-runtime.ts')).href);
const { createLocalPrototypeIdentityAccessPortV1, createLocalAssetUploadPortV1, createInMemoryAssetBinaryStorageV1, createLocalPublishPackageAuthorityPortV1, createClientApprovalApplicationServiceV1, BACKEND_PERMISSIONS_V1 } = backend;
const png = Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64'));
const sha = async (bytes) => createHash('sha256').update(bytes).digest('hex');
const textSha = async (value) => sha(new TextEncoder().encode(value));
let authorityRaw = null; let approvalRaw = { schemaVersion: 1, shares: [], snapshots: [], events: [] }; let releaseRaw = null; let receiptRaw = null; let id = 0; let approvalWrites = 0; let failApprovalReplace = false; let failReceiptWrite = false;
const docs = { 'design.approval': { ...structuredClone(EDITOR_DOC_V7_MINIMAL_FIXTURE), designId: 'design.approval' } };
const identity = createLocalPrototypeIdentityAccessPortV1({ actorRef: 'operator.local-demo', permissions: Object.values(BACKEND_PERMISSIONS_V1) });
let assetMetadata = null;
const assetPort = createLocalAssetUploadPortV1({ binary: createInMemoryAssetBinaryStorageV1(), sha256: sha, readMetadata: () => assetMetadata, writeMetadata: (value) => { assetMetadata = value; } });
const approvalPort = { adapterKind: 'LOCAL_PROTOTYPE', async read() { return { ok: true, value: { value: structuredClone(approvalRaw), etag: `etag.${JSON.stringify(approvalRaw).length}` }, changed: false }; }, async replace(_ctx, value) { approvalWrites += 1; if (failApprovalReplace) return { ok: false, error: { schemaVersion: 1, code: 'UNAVAILABLE', retryable: true, reason: 'test.approval_replace_failed' } }; approvalRaw = structuredClone(value); return { ok: true, value: { value: structuredClone(value), etag: `etag.${JSON.stringify(value).length}` }, changed: true }; } };
const authorityPort = createLocalPublishPackageAuthorityPortV1({ storage: { read: () => authorityRaw, write: (value) => { authorityRaw = value; } } });
const testRenderer = { rendererId: 'test.fixed-2d', render: async () => ({ ok: true, output: { bytes: png, mimeType: 'image/png', width: 1, height: 1, colorSpace: 'srgb', fidelity: 'APPROXIMATE' } }) };
const service = createStudioApprovalApplicationServiceV1({
  identity, approvals: approvalPort, authority: authorityPort, assets: assetPort,
  readPersistedEditorDoc: (designId) => docs[designId],
  release: { storage: { read: () => releaseRaw, write: (value) => { releaseRaw = value; } }, readPersistedEditorDoc: (designId) => docs[designId], sha256: textSha, nextId: () => `release.${++id}`, now: () => '2026-08-20T00:00:00.000Z', releasedByIdentityId: () => 'operator.local-demo' },
  renderer2d: testRenderer, sha256Bytes: sha, sha256Text: textSha, nextId: (scope) => `${scope}${++id}`, receipts: { read: () => receiptRaw, write: (value) => { if (failReceiptWrite) throw new Error('test.receipt_write_failed'); receiptRaw = structuredClone(value); } },
});
const before = JSON.stringify(docs['design.approval']);
const created = await service.createFixedVersionShare({ designId: 'design.approval', expectedRevision: 1 });
assert.equal(created.ok, true, created.ok ? '' : created.error.reason);
assert.equal(created.value.preview.details.length, 10);
assert.equal(approvalRaw.shares.length, 1);
receiptRaw = null; approvalRaw.shares = []; failReceiptWrite = true;
const receiptWriteFailed = await service.createFixedVersionShare({ designId: 'design.approval', expectedRevision: 1 });
assert.equal(receiptWriteFailed.ok, false); assert.equal(receiptWriteFailed.error.reason, 'approval.fixed_version_receipt_write_failed');
assert.equal(approvalRaw.shares.length, 0, 'receipt failure happens before approval replace');
failReceiptWrite = false;
const receiptWriteRecovered = await service.createFixedVersionShare({ designId: 'design.approval', expectedRevision: 1 });
assert.equal(receiptWriteRecovered.ok, true);
assert.equal(approvalRaw.shares.length, 1);
assert.equal(approvalRaw.events.length, 0);
assert.equal(JSON.stringify(docs['design.approval']), before);
const retried = await service.createFixedVersionShare({ designId: 'design.approval', expectedRevision: 1 });
assert.equal(retried.ok, true, retried.ok ? '' : retried.error.reason);
assert.equal(retried.value.rawToken, receiptWriteRecovered.value.rawToken);
assert.equal(approvalRaw.shares.length, 1);
receiptRaw.records.push(structuredClone(receiptRaw.records[0]));
const duplicateReceiptRetry = await service.createFixedVersionShare({ designId: 'design.approval', expectedRevision: 1 });
assert.equal(duplicateReceiptRetry.ok, false); assert.equal(duplicateReceiptRetry.error.code, 'DATA_CORRUPTED');
receiptRaw.records.pop();
const validReceipt = structuredClone(receiptRaw);
const brokenReceipt = structuredClone(receiptRaw); brokenReceipt.records[0].tokenHash = 'f'.repeat(64); receiptRaw = brokenReceipt;
const corruptRetry = await service.createFixedVersionShare({ designId: 'design.approval', expectedRevision: 1 });
assert.equal(corruptRetry.ok, false); assert.equal(corruptRetry.error.code, 'DATA_CORRUPTED');
receiptRaw = validReceipt;
console.log('wizard fixed approval behaviour checks passed');

const gradients = [];
const fakeContext = {
  fillStyle: '', strokeStyle: '', lineWidth: 0,
  createLinearGradient() { const gradient = { stops: [], addColorStop(position, color) { this.stops.push({ position, color }); } }; gradients.push(gradient); return gradient; },
  fillRect() {}, save() {}, restore() {}, translate() {}, beginPath() {}, moveTo() {}, bezierCurveTo() {}, quadraticCurveTo() {}, closePath() {}, stroke() {}, arc() {}, fill() {},
};
globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => fakeContext, toBlob: (done) => done(new Blob([png], { type: 'image/png' })) }) };
const renderer = runtime.createCanvasPngRendererV1();
const renderResult = await renderer.render({ kind: 'COVER', width: 100, height: 100, doc: EDITOR_DOC_V7_FULL_FIXTURE, designVersion: {}, palette: ['#111111', '#222222'] });
assert.equal(renderResult.ok, true);
assert.equal(gradients.length, 10, 'cover renders ten source fingers');
assert.notEqual(gradients[0].stops[0].color, gradients[1].stops[0].color, 'cover uses distinct L1/L2 source backgrounds');
gradients.length = 0;
await renderer.render({ kind: 'DETAIL', finger: 'R5', width: 100, height: 100, nail: EDITOR_DOC_V7_FULL_FIXTURE.nails.R5, doc: EDITOR_DOC_V7_FULL_FIXTURE, designVersion: {}, palette: ['#111111', '#222222'] });
assert.equal(gradients.length, 1, 'detail renders only requested finger');
console.log('wizard fixed approval renderer behaviour checks passed');

const wrongRevision = await service.createFixedVersionShare({ designId: 'design.approval', expectedRevision: 2 });
assert.equal(wrongRevision.ok, false); assert.equal(wrongRevision.error.code, 'PRECONDITION_FAILED');
const authorityContext = await identity.issueContext({ operation: BACKEND_PERMISSIONS_V1.packageReferenceRead });
const authoritySnapshot = await authorityPort.read(authorityContext.value);
const authorityRecord = authoritySnapshot.value.value.records[0];
const clientService = createClientApprovalApplicationServiceV1({
  identity, approvals: approvalPort, authority: authorityPort, assets: assetPort, nextId: (scope) => `${scope}${++id}`, sha256: textSha,
  readPreview: async (share) => {
    const context = await identity.issueContext({ operation: BACKEND_PERMISSIONS_V1.packageReferenceRead });
    const snapshot = await authorityPort.read(context.value);
    const record = snapshot.value.value.records.find((candidate) => candidate.package.designVersionId === share.designVersionId);
    return record ? buildFixedPreviewReadModelV1(record, assetPort, identity) : { ok: false, error: { schemaVersion: 1, code: 'DATA_CORRUPTED', retryable: false, reason: 'test.authority_missing' } };
  },
});
const writesBeforeChange = approvalWrites;
const change = await clientService.decide(receiptWriteRecovered.value.rawToken, 'CHANGE_REQUESTED', '调整长度');
assert.equal(change.ok, true, change.ok ? '' : change.error.reason);
assert.equal(approvalWrites, writesBeforeChange + 1, 'change writes exactly one approval event');
assert.equal(approvalRaw.events.length, 1);
assert.equal(approvalRaw.events[0].decision, 'CHANGE_REQUESTED');
assert.equal(approvalRaw.snapshots.length, 0, 'change request never creates snapshot');
const approveStore = { schemaVersion: 1, shares: [structuredClone(approvalRaw.shares[0])], snapshots: [], events: [] };
const approvedDomain = approvalDomain.decideClientShareV1({ store: approveStore, shareLinkId: approveStore.shares[0].shareLinkId, decision: 'APPROVED', actorRef: 'anonymous.client-share', idempotencyKey: 'approve.matrix.1', eventId: 'event.approve.matrix.1', snapshotId: 'snapshot.approve.matrix.1', now: '2026-08-20T00:05:00.000Z', currentVersionId: approveStore.shares[0].designVersionId });
assert.equal(approvedDomain.ok, true);
assert.equal(approvedDomain.value.snapshots.length, 1, 'approve creates snapshot');
const shareForGate = approveStore.shares[0];
assert.equal(approvalDomain.resolveClientShareV1(approveStore, shareForGate.tokenHash, '2999-01-01T00:00:00.000Z').code, 'expired');
const revokedStore = approvalDomain.revokeClientShareV1(approveStore, shareForGate.shareLinkId, '2026-08-20T00:06:00.000Z');
assert.equal(revokedStore.ok, true);
assert.equal(approvalDomain.resolveClientShareV1(revokedStore.value, shareForGate.tokenHash, '2026-08-20T00:06:01.000Z').code, 'revoked');
assert.equal(approvalDomain.resolveClientShareV1(approveStore, '0'.repeat(64), '2026-08-20T00:00:00.000Z').code, 'not_found');
const malformedPackage = structuredClone(authorityRecord);
malformedPackage.package.details.reverse();
const reordered = await buildFixedPreviewReadModelV1(malformedPackage, assetPort, identity);
assert.equal(reordered.ok, false); assert.equal(reordered.error.code, 'DATA_CORRUPTED');
const duplicatePackage = structuredClone(authorityRecord);
duplicatePackage.package.details[1].finger = duplicatePackage.package.details[0].finger;
const duplicate = await buildFixedPreviewReadModelV1(duplicatePackage, assetPort, identity);
assert.equal(duplicate.ok, false); assert.equal(duplicate.error.code, 'DATA_CORRUPTED');
const nonDetailPackage = structuredClone(authorityRecord);
nonDetailPackage.package.details[0].kind = 'COVER';
const nonDetail = await buildFixedPreviewReadModelV1(nonDetailPackage, assetPort, identity);
assert.equal(nonDetail.ok, false); assert.equal(nonDetail.error.code, 'DATA_CORRUPTED');
const missingAssetMetadata = structuredClone(assetMetadata);
const validAssetMetadata = structuredClone(assetMetadata);
const tamperedAssetMetadata = structuredClone(assetMetadata);
tamperedAssetMetadata.records[0].object.sha256 = '0'.repeat(64); assetMetadata = tamperedAssetMetadata;
const tampered = await service.createFixedVersionShare({ designId: 'design.approval', expectedRevision: 1 });
assert.equal(tampered.ok, false); assert.equal(tampered.error.reason, 'approval.fixed_preview_asset_identity_mismatch');
assetMetadata = missingAssetMetadata;
missingAssetMetadata.records.pop(); assetMetadata = missingAssetMetadata;
const missing = await service.createFixedVersionShare({ designId: 'design.approval', expectedRevision: 1 });
assert.equal(missing.ok, false); assert.equal(missing.error.code, 'DATA_CORRUPTED'); assert.equal(missing.error.reason, 'approval.fixed_preview_asset_missing');
assert.equal(approvalWrites, writesBeforeChange + 1, 'preview failure occurs before approval write');
assetMetadata = validAssetMetadata;
const recoveryShare = structuredClone(approvalRaw.shares[0]);
approvalRaw.shares = [];
failApprovalReplace = true;
const recoveryFailed = await service.createFixedVersionShare({ designId: 'design.approval', expectedRevision: 1 });
assert.equal(recoveryFailed.ok, false); assert.equal(recoveryFailed.error.reason, 'test.approval_replace_failed');
assert.equal(approvalRaw.shares.length, 0);
failApprovalReplace = false;
const recoverySucceeded = await service.createFixedVersionShare({ designId: 'design.approval', expectedRevision: 1 });
assert.equal(recoverySucceeded.ok, true);
assert.equal(recoverySucceeded.value.rawToken, receiptWriteRecovered.value.rawToken);
assert.equal(recoverySucceeded.value.shareLinkId, recoveryShare.shareLinkId);
assert.equal(recoverySucceeded.changed, true);
assert.equal(approvalRaw.shares.length, 1);
// Client decision gate: use a fresh no-event store and corrupt only readBytes
// in the preview read model. The resolver still sees healthy metadata, so the
// failure must come from the pre-write preview gate rather than resolve().
const freshShareStore = { schemaVersion: 1, shares: [structuredClone(approvalRaw.shares[0])], snapshots: [], events: [] };
let freshWrites = 0;
const freshApprovalPort = {
  adapterKind: 'LOCAL_PROTOTYPE',
  async read() { return { ok: true, value: { value: structuredClone(freshShareStore), etag: `fresh.${freshWrites}` }, changed: false }; },
  async replace(_ctx, value) { freshWrites += 1; freshShareStore.shares = structuredClone(value.shares); freshShareStore.snapshots = structuredClone(value.snapshots); freshShareStore.events = structuredClone(value.events); return { ok: true, value: { value: structuredClone(freshShareStore), etag: `fresh.${freshWrites}` }, changed: true }; },
};
const tamperedReadBytesPort = { ...assetPort, async readBytes(context, assetId, revision) { const result = await assetPort.readBytes(context, assetId, revision); if (!result.ok) return result; const bytes = Uint8Array.from(result.value); bytes[bytes.length - 1] ^= 0xff; return { ok: true, value: bytes, changed: false }; } };
const freshClientService = createClientApprovalApplicationServiceV1({
  identity, approvals: freshApprovalPort, authority: authorityPort, assets: assetPort, nextId: (scope) => `${scope}${++id}`, sha256: textSha,
  readPreview: () => buildFixedPreviewReadModelV1(authorityRecord, tamperedReadBytesPort, identity),
});
const freshDecision = await freshClientService.decide(receiptWriteRecovered.value.rawToken, 'APPROVED');
assert.equal(freshDecision.ok, false); assert.equal(freshDecision.error.reason, 'approval.fixed_preview_asset_corrupt');
assert.equal(freshWrites, 0, 'tampered preview blocks client approval before replace');
console.log('wizard fixed approval matrix checks passed');
