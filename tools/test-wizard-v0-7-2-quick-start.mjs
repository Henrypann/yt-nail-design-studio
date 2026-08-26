import fs from 'node:fs';

const read = (file) => fs.readFileSync(file, 'utf8');
const stepOne = read('src/studio/wizard/StepOne.tsx');
const stepTwo = read('src/studio/wizard/StepTwo.tsx');
const params = read('src/studio/wizard/ParamsPanel.tsx');
const gallery = read('src/studio/wizard/TemplateGallery.tsx');
const list = read('src/app/pages/design/DesignListPage.tsx');
const app = read('src/app/App.tsx');
const assert = (condition, message) => { if (!condition) throw new Error(message); };
assert(
  stepTwo.includes('...(s.templateAssetRef ? { templateAssetRef: s.templateAssetRef } : {})'),
  'Wizard Editor preflight must receive the exact saved templateAssetRef when present',
);
assert(
  !stepTwo.includes('templateAssetRef: getOfficialTemplatePatternAssetV7') &&
    stepTwo.includes('...(s.templateAssetRef ? { templateAssetRef: s.templateAssetRef } : {})'),
  'Wizard Editor preflight must not fabricate a template asset ref when the store has none',
);
assert(!stepOne.includes('StyleRecommendModal') && !stepOne.includes('applyValidatedStyleRecommendation'), 'recommendation modal remains active');
assert(!stepTwo.includes('markConfirmed') && !params.includes('markConfirmed'), 'Quick Start confirmation writer remains');
assert(!params.includes('decorationId') && params.includes('baseColor'), 'Quick Start decoration writer remains');
assert(gallery.includes("t('wizard.officialTemplates')") && !gallery.includes('tagFilter'), 'official template selector contract missing');
assert(app.includes('OfficialTemplatesRedirect') && read('src/app/routing/official-template-redirect.ts').includes('officialTemplatePanel'), 'legacy template redirect missing');
assert(list.includes('readDesignApprovalProjection') && list.includes("t('design.fixedApproved')") && list.includes("t('design.historical')"), 'approval projection missing');
assert(read('src/studio/approval/design-approval-projection.ts').includes('authority failed strict parse'), 'authority corruption is not visible');
const projection = read('src/studio/approval/design-approval-projection.ts');
assert(projection.includes('isServiceIdV1(key)') && projection.includes("['schemaVersion', 'value', 'ledger']"), 'atomic authority envelope is not strict');
assert(projection.includes("event.designVersionId !== share.designVersionId"), 'change request lineage is not checked');
assert(params.includes('setFingerOverride(s.selectedFinger!, { baseColor: undefined })'), 'color-only clear is missing');
const { buildOfficialTemplateRedirect } = await import('../src/app/routing/official-template-redirect.ts');
assert(buildOfficialTemplateRedirect('?fresh=1&versionedIntent=x&customerId=c', '#focus') === '/studio/design/new?customerId=c&officialTemplatePanel=1#focus', 'legacy template redirect policy mismatch');
globalThis.localStorage = (() => { const data = new Map(); return { getItem: (key) => data.get(key) ?? null, setItem: (key, value) => data.set(key, String(value)), removeItem: (key) => data.delete(key) }; })();
const { writeEnvelope, StorageKeys } = await import('../src/lib/storage.ts');
const { emptyClientApprovalStoreV1, parseClientApprovalStoreV1 } = await import('../src/studio/approval/client-approval.ts');
const { readDesignApprovalProjection, parseAuthority } = await import('../src/studio/approval/design-approval-projection.ts');
const { createVersionedJsonRepositoryV1 } = await import('../src/platform/backend/local-json-store.ts');
const empty = emptyClientApprovalStoreV1();
writeEnvelope(StorageKeys.backendApprovalRepository, { schemaVersion: 1, value: empty, ledger: { 'idem.atomic-test': { fingerprint: 'fp.v1.0000000000000000', resultEtag: 'etag.v1.0000000000000000' } } });
assert(parseAuthority(readDesignApprovalProjection ? (await import('../src/lib/storage.ts')).readData(StorageKeys.backendApprovalRepository) : null), 'atomic authority envelope rejected');
assert(readDesignApprovalProjection('missing-design').status === 'NONE', 'empty atomic authority did not project NONE');
writeEnvelope(StorageKeys.backendApprovalRepository, { schemaVersion: 1, value: empty, ledger: { 'idem.atomic-test': { fingerprint: 'bad', resultEtag: 'etag.v1.0000000000000000' } } });
assert(readDesignApprovalProjection('missing-design').status === 'CORRUPTED', 'corrupt authority fell through');
let atomicRaw = null;
const repository = createVersionedJsonRepositoryV1({ storage: { read: () => atomicRaw, write: (value) => { atomicRaw = value; } }, empty: emptyClientApprovalStoreV1, parse: parseClientApprovalStoreV1, invalidReason: 'test.corrupt' });
const firstRead = await repository.read();
assert(firstRead.ok, 'repository read failed');
if (firstRead.ok) {
  const replaced = await repository.replace({ value: empty, expectedEtag: firstRead.value.etag, idempotencyKey: 'idem.replace-test', correlationId: 'correlation.test', });
  assert(replaced.ok && atomicRaw?.schemaVersion === 1 && atomicRaw?.ledger, 'repository replace did not create atomic authority');
}

// Build a real publish package and real approval events, then persist through
// the atomic repository envelope before projecting it.
const { EDITOR_DOC_V7_FULL_FIXTURE } = await import('../src/studio/editor/fixtures/editor-doc-v7.mjs');
const { buildDesignReleaseManifestV1, canonicalJsonV1 } = await import('../src/studio/versioning/design-release.ts');
const { buildPublishPackageV1, createDeterministicPublishIdFactoryV1 } = await import('../src/studio/publishing/index.ts');
const { createClientShareV1, decideClientShareV1 } = await import('../src/studio/approval/client-approval.ts');
const { readData } = await import('../src/lib/storage.ts');
const sha256 = async (bytes) => { const digest = await crypto.subtle.digest('SHA-256', bytes); return [...new Uint8Array(digest)].map((x) => x.toString(16).padStart(2, '0')).join(''); };
const doc = structuredClone(EDITOR_DOC_V7_FULL_FIXTURE);
const manifest = buildDesignReleaseManifestV1(doc); assert(manifest.ok, 'release fixture invalid');
const editorHash = await sha256(new TextEncoder().encode(canonicalJsonV1(doc)));
const record = { schemaVersion: 1, designVersion: { schemaVersion: 1, designVersionId: 'dv_projection_test', designId: doc.designId, version: 1, revision: doc.revision, editorDocRef: { designId: doc.designId, schemaVersion: 7, revision: doc.revision, sha256: editorHash }, releasedByIdentityId: 'identity_projection', releasedAt: '2026-08-11T08:00:00.000Z', assetRevisionRefs: structuredClone(manifest.manifest.assetRevisionRefs) }, manifest: structuredClone(manifest.manifest), assetReferenceMappings: structuredClone(manifest.assetReferenceMappings), editorDocSnapshot: structuredClone(doc) };
const bytesFor = (request) => new TextEncoder().encode(`projection:${request.kind}:${request.finger ?? 'ten'}:${request.designVersion.designVersionId}`);
const renderer = { rendererId: 'renderer.projection-v1', render: async (request) => ({ ok: true, output: { bytes: bytesFor(request), mimeType: 'image/png', width: request.width, height: request.height, colorSpace: 'srgb', fidelity: 'EXACT' } }) };
const packageResult = await buildPublishPackageV1(record, { rendererRevision: 'projection-render-v1', renderer3d: renderer, renderer2d: renderer, sha256, nextAssetId: createDeterministicPublishIdFactoryV1(), resolveGeometry: ({ assetId }) => assetId.endsWith('.L5') ? { status: 'unresolved', reason: 'missing' } : { status: 'resolved', shapeId: 'almond', lengthId: 'medium' } });
assert(packageResult.ok, 'publish package fixture invalid');
let baseStore = emptyClientApprovalStoreV1();
const share = createClientShareV1({ store: baseStore, shareLinkId: 'share_projection', tokenHash: 'a'.repeat(64), editorDocSha256: editorHash, package: packageResult.package, now: '2026-08-11T09:00:00.000Z', expiresAt: '2026-08-12T09:00:00.000Z' });
assert(share.ok, 'share fixture invalid'); baseStore = share.value;
const persistViaRepository = async (store, key) => {
  const current = await repository.read(); assert(current.ok, 'repository read before persist failed');
  const result = await repository.replace({ value: store, expectedEtag: current.value.etag, idempotencyKey: key, correlationId: `correlation.${key}`, });
  assert(result.ok, 'repository replace failed');
  writeEnvelope(StorageKeys.backendApprovalRepository, atomicRaw);
};
const approved = decideClientShareV1({ store: baseStore, shareLinkId: 'share_projection', decision: 'APPROVED', actorRef: 'client_projection', idempotencyKey: 'approval_projection', eventId: 'event_projection', snapshotId: 'snapshot_projection', now: '2026-08-11T10:00:00.000Z', currentVersionId: 'dv_projection_test' });
assert(approved.ok, 'approved fixture invalid');
await persistViaRepository(approved.value, 'idem.approved-projection');
assert(readDesignApprovalProjection(doc.designId).status === 'APPROVED', 'valid APPROVED projection failed');
const changed = decideClientShareV1({ store: baseStore, shareLinkId: 'share_projection', decision: 'CHANGE_REQUESTED', note: '请调整颜色', actorRef: 'client_projection', idempotencyKey: 'change_projection', eventId: 'event_change_projection', now: '2026-08-11T10:00:00.000Z', currentVersionId: 'dv_projection_test' });
assert(changed.ok, 'change fixture invalid'); await persistViaRepository(changed.value, 'idem.change-projection');
assert(readDesignApprovalProjection(doc.designId).status === 'CHANGE_REQUESTED', 'valid CHANGE_REQUESTED projection failed');
const duplicate = { ...approved.value, events: [...approved.value.events, { ...approved.value.events[0], approvalEventId: 'event_old_projection', designVersionId: 'dv_old_projection', idempotencyKey: 'approval_old_projection' }] };
await persistViaRepository(duplicate, 'idem.duplicate-projection');
assert(readDesignApprovalProjection(doc.designId).status === 'CORRUPTED', 'duplicate same-share event was not blocked');
const mismatched = { ...approved.value, snapshots: approved.value.snapshots.map((item) => ({ ...item, editorDocSha256: 'b'.repeat(64) })) };
await persistViaRepository(mismatched, 'idem.mismatch-projection');
assert(readDesignApprovalProjection(doc.designId).status === 'CORRUPTED', 'snapshot lineage mismatch was not blocked');
writeEnvelope(StorageKeys.clientApprovals, approved.value);
writeEnvelope(StorageKeys.backendApprovalRepository, { schemaVersion: 1, value: approved.value, ledger: { bad: { fingerprint: 'bad', resultEtag: 'bad' } } });
assert(readDesignApprovalProjection(doc.designId).status === 'CORRUPTED', 'malformed authority fell through to legacy');
console.log('[wizard-v0-7-2-quick-start] PASS');
