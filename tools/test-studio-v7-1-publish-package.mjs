import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

import { EDITOR_DOC_V7_FULL_FIXTURE } from '../src/studio/editor/fixtures/editor-doc-v7.mjs';
import {
  buildDesignReleaseManifestV1,
  canonicalJsonV1,
} from '../src/studio/versioning/design-release.ts';
import {
  buildPublishPackageV1,
  createDeterministicPublishIdFactoryV1,
  deriveStablePaletteV1,
  parsePublishPackageV1,
} from '../src/studio/publishing/index.ts';

const sha256 = async (bytes) => createHash('sha256').update(bytes).digest('hex');
const doc = structuredClone(EDITOR_DOC_V7_FULL_FIXTURE);
const manifestResult = buildDesignReleaseManifestV1(doc);
assert.equal(manifestResult.ok, true, 'full V7 fixture must produce a release manifest');
if (!manifestResult.ok) throw new Error(manifestResult.message);
const editorDocHash = await sha256(new TextEncoder().encode(canonicalJsonV1(doc)));
const record = {
  schemaVersion: 1,
  designVersion: {
    schemaVersion: 1,
    designVersionId: 'dv_publish_package_0001',
    designId: doc.designId,
    version: 1,
    revision: doc.revision,
    editorDocRef: {
      designId: doc.designId,
      schemaVersion: 7,
      revision: doc.revision,
      sha256: editorDocHash,
    },
    releasedByIdentityId: 'identity_creator_0001',
    releasedAt: '2026-08-11T08:00:00.000Z',
    assetRevisionRefs: structuredClone(manifestResult.manifest.assetRevisionRefs),
  },
  manifest: structuredClone(manifestResult.manifest),
  assetReferenceMappings: structuredClone(manifestResult.assetReferenceMappings),
  editorDocSnapshot: structuredClone(doc),
};

const bytesFor = (request, tag) => new TextEncoder().encode(
  `${tag}:${request.kind}:${request.finger ?? 'ten-finger'}:${request.designVersion.designVersionId}:${request.palette.join(',')}`,
);
const exactRenderer = {
  rendererId: 'renderer.publish.exact-v1',
  render: async (request) => ({
    ok: true,
    output: {
      bytes: bytesFor(request, 'exact'),
      mimeType: 'image/png',
      width: request.width,
      height: request.height,
      colorSpace: 'srgb',
      fidelity: 'EXACT',
    },
  }),
};
const fallbackRenderer = {
  rendererId: 'renderer.publish.svg-v1',
  render: async (request) => ({
    ok: true,
    output: {
      bytes: bytesFor(request, 'fallback'),
      mimeType: 'image/png',
      width: request.width,
      height: request.height,
      colorSpace: 'srgb',
      fidelity: 'EXACT',
    },
  }),
};
const baseDeps = {
  rendererRevision: 'publish-render-contract-v1',
  renderer3d: exactRenderer,
  renderer2d: fallbackRenderer,
  sha256,
  nextAssetId: createDeterministicPublishIdFactoryV1(),
  resolveGeometry: ({ assetId }) => assetId.endsWith('.L5')
    ? { status: 'unresolved', reason: 'registry_asset_missing' }
    : { status: 'resolved', shapeId: 'almond', lengthId: 'medium' },
};

const sourceBefore = canonicalJsonV1(record);
const exact = await buildPublishPackageV1(record, baseDeps);
assert.equal(exact.ok, true, 'exact renderer builds a publish package');
if (!exact.ok) throw new Error(exact.message);
assert.equal(exact.fallbackUsed, false);
assert.equal(exact.package.fidelity, 'EXACT');
assert.equal(exact.package.cover.kind, 'COVER');
assert.equal('finger' in exact.package.cover, false);
assert.equal(exact.package.details.length, 10);
assert.deepEqual(exact.package.details.map((item) => item.finger), ['L1','L2','L3','L4','L5','R1','R2','R3','R4','R5']);
assert.ok(exact.package.details.every((item) => item.kind === 'DETAIL' && item.fidelity === 'EXACT'));
assert.ok([exact.package.cover, ...exact.package.details].every((item) => (
  item.revision === 1
  && /^[0-9a-f]{64}$/.test(item.sha256)
  && item.mimeType === 'image/png'
  && item.width > 0
  && item.height > 0
  && item.colorSpace === 'srgb'
  && item.rendererRevision === baseDeps.rendererRevision
  && item.sourceDesignVersionId === record.designVersion.designVersionId
)));
assert.equal(exact.package.geometry.find((item) => item.finger === 'L5')?.status, 'unresolved');
assert.deepEqual(exact.package.shapeIds, ['almond']);
assert.deepEqual(exact.package.lengthIds, ['medium']);
assert.deepEqual(exact.package.palette, deriveStablePaletteV1(doc));
assert.deepEqual(exact.package.palette, [...new Set(exact.package.palette)].sort());
assert.equal(parsePublishPackageV1(exact.package).ok, true);
assert.equal(canonicalJsonV1(record), sourceBefore, 'generation must not mutate the release record');
for (const forbidden of ['editorDocSnapshot', 'customerRef', 'nails', 'recipeInstances', 'manufacturing', 'deviceTask']) {
  assert.equal(JSON.stringify(exact.package).includes(`\"${forbidden}\"`), false, `package must not expose ${forbidden}`);
}

const legacyNumericRecord = structuredClone(record);
delete legacyNumericRecord.assetReferenceMappings;
const legacyNumeric = await buildPublishPackageV1(legacyNumericRecord, baseDeps);
assert.equal(legacyNumeric.ok, true, 'legacy numeric-only release records remain readable without stored alias mappings');
if (legacyNumeric.ok) assert.deepEqual(legacyNumeric.package, exact.package, 'legacy numeric record rebuilds the same package');

const repeat = await buildPublishPackageV1(record, baseDeps);
assert.equal(repeat.ok, true);
if (repeat.ok) assert.deepEqual(repeat.package, exact.package, 'same source and dependencies are deterministic');
exact.package.palette.push('#010203');
const afterReturnedMutation = await buildPublishPackageV1(record, baseDeps);
assert.equal(afterReturnedMutation.ok, true);
if (afterReturnedMutation.ok && repeat.ok) assert.deepEqual(afterReturnedMutation.package, repeat.package, 'returned values do not share mutable state');

const fallback = await buildPublishPackageV1(record, { ...baseDeps, renderer3d: null });
assert.equal(fallback.ok, true, `missing 3D renderer degrades to 2D: ${JSON.stringify(fallback)}`);
if (!fallback.ok) throw new Error(fallback.message);
assert.equal(fallback.fallbackUsed, true);
assert.equal(fallback.package.fidelity, 'APPROXIMATE');
assert.ok([fallback.package.cover, ...fallback.package.details].every((item) => (
  item.fidelity === 'APPROXIMATE'
  && item.fallbackReason === 'PRIMARY_RENDERER_UNAVAILABLE'
  && item.rendererId === fallbackRenderer.rendererId
)));

const primaryFailure = await buildPublishPackageV1(record, {
  ...baseDeps,
  renderer3d: { rendererId: 'renderer.broken', render: () => { throw new Error('webgl_context_lost'); } },
});
assert.equal(primaryFailure.ok, true, 'primary failure is recoverable through 2D');
if (primaryFailure.ok) assert.equal(primaryFailure.package.cover.fallbackReason, 'PRIMARY_RENDERER_EXCEPTION');

const approximatePrimary = await buildPublishPackageV1(record, {
  ...baseDeps,
  renderer3d: {
    ...exactRenderer,
    rendererId: 'renderer.publish.approx-v1',
    render: async (request) => ({ ok: true, output: { ...(await exactRenderer.render(request)).output, fidelity: 'APPROXIMATE' } }),
  },
});
assert.equal(approximatePrimary.ok, true);
if (approximatePrimary.ok) {
  assert.equal(approximatePrimary.fallbackUsed, false);
  assert.equal(approximatePrimary.package.cover.fallbackReason, 'PRIMARY_RENDERER_APPROXIMATE');
}

const mutatingRenderer = {
  rendererId: 'renderer.mutating',
  render: async (request) => {
    request.designVersion.designId = 'mutated-by-renderer';
    request.doc.title = 'mutated-by-renderer';
    return exactRenderer.render(request);
  },
};
const immutableSourceBefore = canonicalJsonV1(record);
const mutationAttempt = await buildPublishPackageV1(record, { ...baseDeps, renderer3d: mutatingRenderer });
assert.equal(mutationAttempt.ok, true, 'renderer receives an isolated request clone');
assert.equal(canonicalJsonV1(record), immutableSourceBefore, 'renderer mutation must not reach the release record');

const changedRenderer = {
  ...exactRenderer,
  rendererId: 'renderer.publish.exact-v2',
  render: async (request) => ({ ...(await exactRenderer.render(request)), output: { ...(await exactRenderer.render(request)).output, bytes: bytesFor(request, 'changed') } }),
};
const changedIdentity = await buildPublishPackageV1(record, { ...baseDeps, rendererRevision: 'publish-render-contract-v2', renderer3d: changedRenderer });
assert.equal(changedIdentity.ok, true);
if (changedIdentity.ok && repeat.ok) {
  assert.notEqual(changedIdentity.package.packageId, repeat.package.packageId, 'package identity binds renderer contract and content');
  assert.notEqual(changedIdentity.package.cover.assetId, repeat.package.cover.assetId, 'derived asset identity binds bytes');
  assert.notEqual(changedIdentity.package.cover.sha256, repeat.package.cover.sha256);
}
const revisionOnlyIdentity = await buildPublishPackageV1(record, { ...baseDeps, rendererRevision: 'publish-render-contract-v2' });
assert.equal(revisionOnlyIdentity.ok, true);
if (revisionOnlyIdentity.ok && repeat.ok) {
  assert.equal(revisionOnlyIdentity.package.cover.sha256, repeat.package.cover.sha256, 'renderer bytes are unchanged in this case');
  assert.notEqual(revisionOnlyIdentity.package.cover.assetId, repeat.package.cover.assetId, 'asset identity also binds renderer revision');
  assert.notEqual(revisionOnlyIdentity.package.packageId, repeat.package.packageId);
}

const fallbackFailure = await buildPublishPackageV1(record, {
  ...baseDeps,
  renderer3d: null,
  renderer2d: { rendererId: 'renderer.broken-2d', render: () => ({ ok: false, reason: 'svg_failed' }) },
});
assert.equal(fallbackFailure.ok, false);
if (!fallbackFailure.ok) assert.equal(fallbackFailure.code, 'renderer_failed');

const hashFailure = await buildPublishPackageV1(record, { ...baseDeps, sha256: async () => { throw new Error('hash down'); } });
assert.equal(hashFailure.ok, false);
if (!hashFailure.ok) assert.equal(hashFailure.code, 'dependency_unavailable');

const mismatchedHash = structuredClone(record);
mismatchedHash.designVersion.editorDocRef.sha256 = 'f'.repeat(64);
const badHashResult = await buildPublishPackageV1(mismatchedHash, baseDeps);
assert.equal(badHashResult.ok, false);
if (!badHashResult.ok) assert.equal(badHashResult.code, 'invalid_release_record');

const mismatchedAssets = structuredClone(record);
mismatchedAssets.designVersion.assetRevisionRefs = [];
const badAssetsResult = await buildPublishPackageV1(mismatchedAssets, baseDeps);
assert.equal(badAssetsResult.ok, false);
if (!badAssetsResult.ok) assert.equal(badAssetsResult.code, 'invalid_release_record');

const valid = repeat.ok ? repeat.package : afterReturnedMutation.package;
const invalidCases = [
  { name: 'unknown key', mutate: (value) => { value.extra = true; } },
  { name: 'embedded document', mutate: (value) => { value.nails = {}; } },
  { name: 'device field', mutate: (value) => { value.deviceTask = {}; } },
  { name: 'finger order', mutate: (value) => { [value.details[0], value.details[1]] = [value.details[1], value.details[0]]; } },
  { name: 'fidelity mismatch', mutate: (value) => { value.fidelity = 'APPROXIMATE'; } },
  { name: 'malformed hash', mutate: (value) => { value.cover.sha256 = 'nope'; } },
  { name: 'unsorted palette', mutate: (value) => { value.palette = ['#ffffff', '#000000']; } },
  { name: 'duplicate output id', mutate: (value) => { value.details[0].assetId = value.cover.assetId; } },
  { name: 'package and output id collision', mutate: (value) => { value.cover.assetId = value.packageId; } },
  { name: 'exact fallback', mutate: (value) => { value.cover.fallbackReason = 'fake'; } },
  { name: 'missing approximation reason', mutate: (value) => { value.cover.fidelity = 'APPROXIMATE'; value.fidelity = 'APPROXIMATE'; delete value.cover.fallbackReason; } },
  { name: 'geometry ref drift', mutate: (value) => { value.geometry[0].assetId = 'geometry.other'; } },
  { name: 'geometry summary drift', mutate: (value) => { value.shapeIds = ['coffin']; } },
];
for (const testCase of invalidCases) {
  const value = structuredClone(valid);
  testCase.mutate(value);
  assert.equal(parsePublishPackageV1(value).ok, false, `${testCase.name} must reject`);
}

console.log('[test:studio-v7-1-publish-package] PASS');
