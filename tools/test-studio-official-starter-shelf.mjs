import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  createOfficialStarterShelfReadModelV1,
  parseOfficialStarterShelfReadModelV1,
  STARTER_SHELF_CANDIDATE_IDS,
} from '../src/studio/assets/official-starter-shelf/read-model-v1.ts';
import { parseGovernanceLedgerV1 } from '../src/platform/backend/asset-ops-governance-v1.ts';

const root = path.resolve(new URL('..', import.meta.url).pathname);
const materialIndex = JSON.parse(fs.readFileSync(path.join(root, 'material-library/index.json'), 'utf8'));
const ledger = JSON.parse(fs.readFileSync(path.join(root, 'material-library/asset-ops-governance-v1.json'), 'utf8'));
assert.ok(parseGovernanceLedgerV1(ledger), 'fixture ledger must satisfy the single strict parser');

const disabled = createOfficialStarterShelfReadModelV1({ materialIndex, governanceLedger: ledger, petalVeilEnabled: false });
assert.ok(disabled);
assert.ok(parseOfficialStarterShelfReadModelV1(disabled));
assert.equal(disabled.summary.candidateDatasetCount, 10);
assert.equal(disabled.summary.visibleCount, 9);
assert.equal(disabled.entries.length, 9);
assert.ok(!disabled.entries.some((entry) => entry.assetId === 't_petal_veil_french'));
const expectedCandidateOrder = materialIndex.templates
  .filter((entry) => STARTER_SHELF_CANDIDATE_IDS.includes(entry.id))
  .sort((a, b) => a.sort_order - b.sort_order || a.id.localeCompare(b.id))
  .map((entry) => entry.id);
assert.deepEqual(disabled.entries.map((entry) => entry.assetId), expectedCandidateOrder.filter((id) => id !== 't_petal_veil_french'));
assert.ok(disabled.entries.every((entry) => entry.rightsStatus === 'PENDING' && entry.promotionStatus === 'BLOCKED'));
assert.ok(disabled.entries.every((entry) => ['UNVERIFIED', 'CONCEPT_ONLY'].includes(entry.capabilityStatus)));
assert.ok(disabled.entries.every((entry) => entry.candidateOnlyLabels.includes('CANDIDATE_ONLY')));

const enabled = createOfficialStarterShelfReadModelV1({ materialIndex, governanceLedger: ledger, petalVeilEnabled: true });
assert.ok(enabled);
assert.ok(parseOfficialStarterShelfReadModelV1(enabled));
assert.equal(enabled.summary.candidateDatasetCount, 10);
assert.equal(enabled.summary.visibleCount, 10);
assert.ok(enabled.entries.some((entry) => entry.assetId === 't_petal_veil_french'));
assert.deepEqual(enabled.entries.map((entry) => entry.assetId), expectedCandidateOrder);
assert.deepEqual(enabled.entries.map((entry) => entry.sortOrder), expectedCandidateOrder.map((_, index) => index));
assert.deepEqual(enabled, createOfficialStarterShelfReadModelV1({ materialIndex, governanceLedger: ledger, petalVeilEnabled: true }));
assert.ok(!enabled.entries.some((entry) => entry.assetId.startsWith('look:')));

function clone(value) { return structuredClone(value); }
function expectClosed(mutator, message) {
  const fixture = clone(ledger);
  mutator(fixture);
  assert.equal(createOfficialStarterShelfReadModelV1({ materialIndex, governanceLedger: fixture, petalVeilEnabled: true }), null, message);
}
expectClosed((value) => { value.records[0].rightsStatus = 'CLEARED'; }, 'rights cannot be unlocked');
expectClosed((value) => { value.records[0].promotionStatus = 'READY'; }, 'promotion cannot be unlocked');
expectClosed((value) => { value.records[0].lifecycleStatus = 'REAL'; }, 'lifecycle drift fails closed');
expectClosed((value) => { value.records.pop(); }, 'missing governed record fails closed');
expectClosed((value) => { value.records[1].recordId = value.records[0].recordId; }, 'duplicate governed record fails closed');
const unknownIndex = clone(materialIndex);
unknownIndex.templates.push({ ...unknownIndex.templates[0], id: 't_unknown' });
assert.equal(createOfficialStarterShelfReadModelV1({ materialIndex: unknownIndex, governanceLedger: ledger }), null, 'unknown index candidate does not broaden shelf');
const driftIndex = clone(materialIndex);
driftIndex.templates.find((entry) => entry.id === 't_petal_veil_french').asset_status = 'REAL';
assert.equal(createOfficialStarterShelfReadModelV1({ materialIndex: driftIndex, governanceLedger: ledger, petalVeilEnabled: true }), null, 'index lifecycle drift fails closed');
const sortDriftIndex = clone(materialIndex);
sortDriftIndex.templates.find((entry) => entry.id === 't_petal_veil_french').sort_order = 'later';
assert.equal(createOfficialStarterShelfReadModelV1({ materialIndex: sortDriftIndex, governanceLedger: ledger, petalVeilEnabled: true }), null, 'non-finite sort order fails closed');
const duplicateSortIndex = clone(materialIndex);
duplicateSortIndex.templates.find((entry) => entry.id === 't_petal_veil_french').sort_order = duplicateSortIndex.templates.find((entry) => entry.id === 't_butter_glaze_quiet_concept').sort_order;
const duplicateSortModel = createOfficialStarterShelfReadModelV1({ materialIndex: duplicateSortIndex, governanceLedger: ledger, petalVeilEnabled: true });
assert.ok(duplicateSortModel, 'equal sort orders use deterministic assetId tie-break');
assert.deepEqual(duplicateSortModel.entries.map((entry) => entry.assetId), [...duplicateSortModel.entries].sort((a, b) => a.sortOrder - b.sortOrder || a.assetId.localeCompare(b.assetId)).map((entry) => entry.assetId));
const missingPetalLabel = clone(enabled);
missingPetalLabel.entries.find((entry) => entry.assetId === 't_petal_veil_french').candidateOnlyLabels = ['CANDIDATE_ONLY', 'RIGHTS_PENDING'];
assert.equal(parseOfficialStarterShelfReadModelV1(missingPetalLabel), null, 'Petal Veil missing label fails closed');
const missingRightsBlocker = clone(enabled);
missingRightsBlocker.entries[0].blockingCodes = ['PROMOTION_NOT_AUTHORIZED'];
assert.equal(parseOfficialStarterShelfReadModelV1(missingRightsBlocker), null, 'missing rights blocker fails closed');
const fractionalSortOrder = clone(enabled);
fractionalSortOrder.entries[0].sortOrder = 0.5;
assert.equal(parseOfficialStarterShelfReadModelV1(fractionalSortOrder), null, 'fractional sort order fails closed');
const nanSortOrder = clone(enabled);
nanSortOrder.entries[0].sortOrder = Number.NaN;
assert.equal(parseOfficialStarterShelfReadModelV1(nanSortOrder), null, 'NaN sort order fails closed');
const disabledReplacement = clone(disabled);
disabledReplacement.entries[0].assetId = 't_petal_veil_french';
assert.equal(parseOfficialStarterShelfReadModelV1(disabledReplacement), null, 'disabled replacement/omission fails closed');
const disabledMissing = clone(disabled);
disabledMissing.entries.pop();
disabledMissing.summary.visibleCount = 8;
assert.equal(parseOfficialStarterShelfReadModelV1(disabledMissing), null, 'disabled omission fails closed');
const enabledOutOfOrder = clone(enabled);
[enabledOutOfOrder.entries[0], enabledOutOfOrder.entries[1]] = [enabledOutOfOrder.entries[1], enabledOutOfOrder.entries[0]];
assert.equal(parseOfficialStarterShelfReadModelV1(enabledOutOfOrder), null, 'enabled out-of-order entries fail closed');
const disabledOutOfOrder = clone(disabled);
[disabledOutOfOrder.entries[0], disabledOutOfOrder.entries[1]] = [disabledOutOfOrder.entries[1], disabledOutOfOrder.entries[0]];
assert.equal(parseOfficialStarterShelfReadModelV1(disabledOutOfOrder), null, 'disabled out-of-order entries fail closed');
const malformed = clone(enabled);
malformed.extra = true;
assert.equal(parseOfficialStarterShelfReadModelV1(malformed), null, 'unknown read model key rejected');

console.log('test-studio-official-starter-shelf: PASS (10 candidate dataset, 9/10 feature flag, strict governance/read-model gates)');
