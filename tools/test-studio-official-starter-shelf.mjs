import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createOfficialStarterShelfReadModelV1, parseOfficialStarterShelfReadModelV1, STARTER_SHELF_CANDIDATE_IDS } from '../src/studio/assets/official-starter-shelf/read-model-v1.ts';
import { parseGovernanceLedgerV1 } from '../src/platform/backend/asset-ops-governance-v1.ts';

const root = path.resolve(new URL('..', import.meta.url).pathname);
const materialIndex = JSON.parse(fs.readFileSync(path.join(root, 'material-library/index.json'), 'utf8'));
const ledger = JSON.parse(fs.readFileSync(path.join(root, 'material-library/asset-ops-governance-v1.json'), 'utf8'));
assert.ok(parseGovernanceLedgerV1(ledger));
assert.deepEqual(STARTER_SHELF_CANDIDATE_IDS, ['t_french_white']);
for (const petalVeilEnabled of [false, true]) {
  const shelf = createOfficialStarterShelfReadModelV1({ materialIndex, governanceLedger: ledger, petalVeilEnabled });
  assert.ok(shelf);
  assert.ok(parseOfficialStarterShelfReadModelV1(shelf));
  assert.deepEqual(shelf.entries.map((entry) => entry.assetId), ['t_french_white']);
  assert.deepEqual(shelf.summary, { candidateDatasetCount: 1, visibleCount: 1 });
  assert.equal(shelf.entries[0].lifecycleStatus, 'REAL');
  assert.equal(shelf.entries[0].rightsStatus, 'PENDING');
  assert.equal(shelf.entries[0].promotionStatus, 'BLOCKED');
}
const malformed = JSON.parse(JSON.stringify(createOfficialStarterShelfReadModelV1({ materialIndex, governanceLedger: ledger })));
malformed.summary.candidateDatasetCount = 10;
assert.equal(parseOfficialStarterShelfReadModelV1(malformed), null);
console.log('test-studio-official-starter-shelf: PASS (single Classic French candidate, strict governance/read-model gates)');
