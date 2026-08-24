import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createOfficialStarterShelfReadModelV1 } from '../src/studio/assets/official-starter-shelf/read-model-v1.ts';
import { parseStarterAssetPreflightV1, preflightOfficialStarterAssetV1 } from '../src/studio/assets/official-starter-shelf/preflight-v1.ts';

const root = path.resolve(new URL('..', import.meta.url).pathname);
const index = JSON.parse(await fs.readFile(path.join(root, 'material-library/index.json'), 'utf8'));
const ledger = JSON.parse(await fs.readFile(path.join(root, 'material-library/asset-ops-governance-v1.json'), 'utf8'));
const shelf = createOfficialStarterShelfReadModelV1({ materialIndex: index, governanceLedger: ledger, petalVeilEnabled: true });
assert.ok(shelf);
const shapes = ['almond', 'oval', 'coffin', 'squoval', 'round', 'square', 'stiletto'];
const loadBytes = (assetPath) => fs.readFile(path.join(root, assetPath));
let exactCount = 0;
let unavailableCount = 0;

for (const entry of shelf.entries) {
  for (const shape of shapes) {
    const before = structuredClone(entry);
    const result = await preflightOfficialStarterAssetV1({ entry, shape, loadBytes });
    assert.ok(parseStarterAssetPreflightV1(result));
    assert.deepEqual(entry, before, 'preflight must not mutate shelf entry');
    if (result.technicalStatus === 'EXACT') {
      exactCount += 1;
      assert.equal(result.diagnostics.length, 0);
      assert.ok(result.assetRef);
    } else {
      unavailableCount += 1;
      assert.ok(result.diagnostics.length > 0);
      assert.equal(result.assetRef, null);
    }
    if (entry.assetId === 't_petal_pearl_bloom_simulated') assert.equal(result.technicalStatus, 'UNAVAILABLE');
    else assert.equal(result.technicalStatus, 'EXACT');
  }
}
assert.equal(exactCount, 63, 'registry fixture should resolve 9 candidates x 7 shapes');
assert.equal(unavailableCount, 7, 'Petal Pearl should be the only unavailable candidate across 7 shapes');

const petalVeil = shelf.entries.find((entry) => entry.assetId === 't_petal_veil_french');
const exact = await preflightOfficialStarterAssetV1({ entry: petalVeil, shape: 'almond', loadBytes });
assert.equal(exact.technicalStatus, 'EXACT');
assert.equal(exact.assetRef.kind, 'vector');
assert.equal(exact.assetRef.mimeType, 'image/svg+xml');
assert.equal(exact.assetRef.revision, 'template-v2');
assert.ok(parseStarterAssetPreflightV1(exact));
assert.equal(exact.usageScope, 'LOCAL_CONCEPT_DRAFT_ONLY');
assert.equal(exact.rightsStatus, 'PENDING');
assert.equal(exact.promotionStatus, 'BLOCKED');
assert.equal(exact.manufacturingValidated, false);

const wrongBytes = await preflightOfficialStarterAssetV1({ entry: petalVeil, shape: 'almond', loadBytes: async () => new Uint8Array([1, 2, 3]) });
assert.deepEqual(wrongBytes.diagnostics, ['ASSET_SHA256_MISMATCH']);
const throwingLoader = await preflightOfficialStarterAssetV1({ entry: petalVeil, shape: 'almond', loadBytes: async () => { throw new Error('loader down'); } });
assert.deepEqual(throwingLoader.diagnostics, ['ASSET_BYTES_UNAVAILABLE']);
const malformedLoader = await preflightOfficialStarterAssetV1({ entry: petalVeil, shape: 'almond', loadBytes: async () => 'not bytes' });
assert.deepEqual(malformedLoader.diagnostics, ['ASSET_BYTES_INVALID']);
const fractionalEntry = structuredClone(petalVeil);
fractionalEntry.sortOrder = 0.5;
assert.deepEqual((await preflightOfficialStarterAssetV1({ entry: fractionalEntry, shape: 'almond', loadBytes })).diagnostics, ['INVALID_PREFLIGHT_INPUT']);
const nanEntry = structuredClone(petalVeil);
nanEntry.sortOrder = Number.NaN;
assert.deepEqual((await preflightOfficialStarterAssetV1({ entry: nanEntry, shape: 'almond', loadBytes })).diagnostics, ['INVALID_PREFLIGHT_INPUT']);

const wrongRevision = structuredClone(petalVeil);
wrongRevision.renderTemplateId = 't_liquid_velvet_cat_eye';
const mappingMismatch = await preflightOfficialStarterAssetV1({ entry: wrongRevision, shape: 'almond', loadBytes });
assert.deepEqual(mappingMismatch.diagnostics, ['CANDIDATE_RENDER_MAPPING_MISMATCH']);
const forgedAssetId = await preflightOfficialStarterAssetV1({ entry: petalVeil, shape: 'almond', loadBytes, resolveRegistry: () => ({ assetId: 'asset.forged', revision: 'template-v2', sha256: exact.assetRef.sha256, kind: 'vector', mimeType: 'image/svg+xml' }) });
assert.deepEqual(forgedAssetId.diagnostics, ['REGISTRY_ASSET_IDENTITY_INVALID']);
const forgedRevision = await preflightOfficialStarterAssetV1({ entry: petalVeil, shape: 'almond', loadBytes, resolveRegistry: () => ({ assetId: 'asset.template-pattern.t_petal_veil_french.almond', revision: 'template-forged', sha256: exact.assetRef.sha256, kind: 'vector', mimeType: 'image/svg+xml' }) });
assert.deepEqual(forgedRevision.diagnostics, ['REGISTRY_ASSET_IDENTITY_INVALID']);
const forgedSha = await preflightOfficialStarterAssetV1({ entry: petalVeil, shape: 'almond', loadBytes, resolveRegistry: () => ({ assetId: 'asset.template-pattern.t_petal_veil_french.almond', revision: 'template-v2', sha256: '0'.repeat(64), kind: 'vector', mimeType: 'image/svg+xml' }) });
assert.deepEqual(forgedSha.diagnostics, ['REGISTRY_ASSET_IDENTITY_INVALID']);
const pathTraversal = structuredClone(petalVeil);
pathTraversal.renderTemplateId = '../escape';
assert.deepEqual((await preflightOfficialStarterAssetV1({ entry: pathTraversal, shape: 'almond', loadBytes })).diagnostics, ['CANDIDATE_SOURCE_ID_INVALID']);
const governanceUnlock = structuredClone(petalVeil);
governanceUnlock.rightsStatus = 'CLEARED';
assert.deepEqual((await preflightOfficialStarterAssetV1({ entry: governanceUnlock, shape: 'almond', loadBytes })).diagnostics, ['INVALID_PREFLIGHT_INPUT']);
const missingBlocker = structuredClone(petalVeil);
missingBlocker.blockingCodes = ['PROMOTION_NOT_AUTHORIZED'];
assert.deepEqual((await preflightOfficialStarterAssetV1({ entry: missingBlocker, shape: 'almond', loadBytes })).diagnostics, ['INVALID_PREFLIGHT_INPUT']);
const sourceDrift = structuredClone(petalVeil);
sourceDrift.assetId = 't_unknown';
assert.deepEqual((await preflightOfficialStarterAssetV1({ entry: sourceDrift, shape: 'almond', loadBytes })).diagnostics, ['CANDIDATE_SOURCE_ID_INVALID']);
const unsupportedShape = await preflightOfficialStarterAssetV1({ entry: petalVeil, shape: 'not-a-shape', loadBytes });
assert.deepEqual(unsupportedShape.diagnostics, ['INVALID_PREFLIGHT_INPUT']);
const fourLook = { ...petalVeil, assetId: 'look:leopard-gilded-nude' };
assert.deepEqual((await preflightOfficialStarterAssetV1({ entry: fourLook, shape: 'almond', loadBytes })).diagnostics, ['CANDIDATE_SOURCE_ID_INVALID']);
const extraKey = structuredClone(exact);
extraKey.extra = true;
assert.equal(parseStarterAssetPreflightV1(extraKey), null);
const exactWithDiagnostic = structuredClone(exact);
exactWithDiagnostic.diagnostics = ['unexpected'];
assert.equal(parseStarterAssetPreflightV1(exactWithDiagnostic), null);
const unavailableWithoutDiagnostic = { ...exact, technicalStatus: 'UNAVAILABLE', assetRef: null, diagnostics: [] };
assert.equal(parseStarterAssetPreflightV1(unavailableWithoutDiagnostic), null);
const unavailableWithAsset = { ...exact, technicalStatus: 'UNAVAILABLE', diagnostics: ['blocked'] };
assert.equal(parseStarterAssetPreflightV1(unavailableWithAsset), null);

console.log('test-studio-official-starter-preflight: PASS (10 candidates x 7 shapes, Web Crypto SHA, identity/revision/path/governance fail-closed)');
