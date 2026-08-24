#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';

import { createOfficialStarterShelfReadModelV1 } from '../src/studio/assets/official-starter-shelf/read-model-v1.ts';
import { preflightOfficialStarterAssetV1 } from '../src/studio/assets/official-starter-shelf/preflight-v1.ts';

const root = process.cwd();
const readJson = async (relative) => JSON.parse(await fs.readFile(path.join(root, relative), 'utf8'));
const matrix = await readJson('evidence/pr-int-v0-7-2-asset-05a/asset-ops-combined-matrix-v1.json');
assert.deepEqual(Object.keys(matrix).sort(), [
  'architectureBaseline', 'claims', 'contractRef', 'domains', 'evidenceRefs', 'ownerGates', 'rollback', 'schemaVersion', 'status',
].sort());
assert.equal(matrix.schemaVersion, 1);
assert.equal(matrix.contractRef, 'INT-v0.7.2-ASSET-05A');
assert.equal(matrix.architectureBaseline, 'v0.7.2');
assert.equal(matrix.status, 'PARTIAL_READY_BRANCH');
assert.ok(matrix.ownerGates.every((gate) => ['UNKNOWN_INPUT_REQUIRED', 'NOT_VALIDATED'].includes(gate.state)));
assert.equal(new Set(matrix.ownerGates.map((gate) => gate.gateId)).size, matrix.ownerGates.length);
assert.ok(matrix.rollback.length >= 4);
assert.deepEqual(matrix.claims, {
  integratedIntoMain: false,
  remotePushed: false,
  deployed: false,
  manufacturingValidated: false,
  productionReady: false,
});
for (const reference of matrix.evidenceRefs) {
  assert.equal(path.isAbsolute(reference), false, `${reference}: evidence ref must be repository-relative`);
  assert.equal(reference.includes('..'), false, `${reference}: traversal is forbidden`);
  await fs.access(path.join(root, reference));
}

const inventory = await readJson('evidence/pr-asset-gen-02/asset-ops-inventory-v1-post-migration.json');
assert.deepEqual(matrix.domains.inventory, {
  templateCount: inventory.summary.templateCount,
  fourLookPackCount: inventory.summary.lookCount,
  formalTemplateMetadataGap: inventory.summary.formalTemplateMetadataGap,
  fourLookManufacturingValidated: !inventory.summary.fourLookSimulatedNonManufacturing,
});
assert.equal(inventory.templates.length, 21);
assert.equal(inventory.looks.length, 4);
assert.ok(inventory.looks.every((look) => look.fingerCount === 10 && look.manufacturingValidated === false));

const ledger = await readJson('material-library/asset-ops-governance-v1.json');
assert.deepEqual(matrix.domains.governance, {
  recordCount: ledger.records.length,
  rightsPendingCount: ledger.records.filter((record) => record.rightsStatus === 'PENDING').length,
  promotionBlockedCount: ledger.records.filter((record) => record.promotionStatus === 'BLOCKED').length,
  manifestPresentCount: ledger.records.filter((record) => record.completeness.manifest === 'PRESENT').length,
  binariesPresentCount: ledger.records.filter((record) => record.completeness.binaries === 'PRESENT').length,
});

const materialIndex = await readJson('material-library/index.json');
const shelf = createOfficialStarterShelfReadModelV1({
  materialIndex,
  governanceLedger: ledger,
  petalVeilEnabled: true,
});
assert.ok(shelf);
const shapes = ['almond', 'oval', 'coffin', 'squoval', 'round', 'square', 'stiletto'];
let exact = 0;
let unavailable = 0;
const loadBytes = (assetPath) => fs.readFile(path.join(root, assetPath));
for (const entry of shelf.entries) {
  for (const shape of shapes) {
    const result = await preflightOfficialStarterAssetV1({ entry, shape, loadBytes });
    if (result.technicalStatus === 'EXACT') exact += 1;
    else unavailable += 1;
    assert.equal(result.usageScope, 'LOCAL_CONCEPT_DRAFT_ONLY');
    assert.equal(result.rightsStatus, 'PENDING');
    assert.equal(result.promotionStatus, 'BLOCKED');
    assert.equal(result.manufacturingValidated, false);
  }
}
assert.deepEqual(matrix.domains.starterShelf, {
  candidateDatasetCount: shelf.summary.candidateDatasetCount,
  preflightCaseCount: shelf.entries.length * shapes.length,
  exactIdentityCount: exact,
  unavailableCount: unavailable,
  usageScope: 'LOCAL_CONCEPT_DRAFT_ONLY',
  rightsStatus: 'PENDING',
  promotionStatus: 'BLOCKED',
  manufacturingValidated: false,
});

const capability = await readJson('evidence/pr-community-v0-7-2-asset-03a/asset-capability-report-v1.json');
assert.deepEqual(matrix.domains.communityCapability, {
  subjectCount: capability.coverage.actual,
  versionedReadyCount: capability.capabilityStates.VERSIONED_READY.length,
  legacyApproximateCount: capability.capabilityStates.LEGACY_APPROXIMATE.length,
  assetsIncompleteCount: capability.capabilityStates.ASSETS_INCOMPLETE.length,
  unavailableCount: capability.capabilityStates.UNAVAILABLE.length,
  currentMakeableCount: capability.gates.currentMakeableCount,
  manufacturingValidatedCount: capability.gates.manufacturingValidatedCount,
  canonicalLegacyBrowserEvidence: true,
});
const capabilityWalkthrough = await readJson('evidence/pr-community-v0-7-2-asset-03b/walkthrough-report.json');
assert.equal(capabilityWalkthrough.viewports.length, 6);
assert.ok(capabilityWalkthrough.viewports.every((entry) => entry.noOverflow && entry.consoleErrors.length === 0 && entry.pageErrors.length === 0));
assert.deepEqual(capabilityWalkthrough.failure.visible, true);

const merchandising = await readJson('public/community/home-merchandising-v1.json');
const merchandisingWalkthrough = await readJson('evidence/pr-community-v0-7-2-asset-04a/walkthrough-report.json');
assert.deepEqual(matrix.domains.homeMerchandising, {
  status: merchandising.status,
  publishedBannerCount: merchandising.banner === null ? 0 : 1,
  publishedEditorialSelectionCount: merchandising.editorialSelections.length,
  publishedCollectionCount: merchandising.collections.length,
  governedFeedPreservedCount: 15,
  viewportsValidated: merchandisingWalkthrough.viewports.length,
});
assert.ok(merchandisingWalkthrough.viewports.every((entry) => entry.feedCount === 15 && entry.noOverflow));
assert.equal(merchandisingWalkthrough.failure.feedCount, 15);

const writerZeroSources = [
  'src/community/domain/asset-capability-v1.ts',
  'src/community/domain/home-merchandising-v1.ts',
  'src/community/data/home-merchandising-repository.ts',
  'src/community/components/CommunityHomeMerchandising.tsx',
];
for (const relative of writerZeroSources) {
  const source = await fs.readFile(path.join(root, relative), 'utf8');
  assert.doesNotMatch(source, /editorV7Store|wizardStore|localStorage\.setItem|sessionStorage\.setItem/);
}

console.log('test-asset-ops-combined-handoff: PASS (21+4 inventory, 25/25 governance, 63/7 shelf, 24 capability, 6+6 viewport evidence, owner Unknowns explicit)');
