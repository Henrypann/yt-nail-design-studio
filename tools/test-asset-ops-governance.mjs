import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  generateAssetOpsGovernance,
  parseGovernanceLedgerV1,
} from './generate-asset-ops-governance.mjs';

const root = path.resolve(new URL('..', import.meta.url).pathname);
const ledger = generateAssetOpsGovernance({ rootDir: root });
assert.ok(parseGovernanceLedgerV1(ledger));
assert.equal(ledger.records.length, 25);
assert.equal(ledger.summary.templateCount, 21);
assert.equal(ledger.summary.lookCount, 4);
assert.equal(ledger.summary.rightsPendingCount, 25);
assert.equal(ledger.summary.promotionBlockedCount, 25);
assert.ok(ledger.records.every((record) => record.rightsStatus === 'PENDING'));
assert.ok(ledger.records.every((record) => record.promotionStatus === 'BLOCKED'));
assert.ok(ledger.records.filter((record) => record.subjectType === 'LOOK_ASSET_PACK').every((record) => record.lifecycleStatus === 'SIMULATED'));
assert.ok(ledger.records.every((record) => record.completeness.binaries === 'PRESENT' && record.completeness.manifest === 'PRESENT'), 'ledger completeness matches real asset inventory');

const stableA = JSON.stringify(ledger);
const stableB = JSON.stringify(generateAssetOpsGovernance({ rootDir: root }));
assert.equal(stableA, stableB, 'governance ledger must be byte-stable');
const outsideOutput = spawnSync(process.execPath, ['tools/generate-asset-ops-governance.mjs', '--output', '../outside-governance.json'], {
  cwd: root, encoding: 'utf8',
});
assert.notEqual(outsideOutput.status, 0, 'CLI must reject output outside worktree');
assert.match(`${outsideOutput.stdout}\n${outsideOutput.stderr}`, /--output must be a worktree-relative path|escapes repository/);

assert.equal(parseGovernanceLedgerV1({ ...ledger, unknown: true }), null, 'unknown root key rejected');
const duplicateRecord = structuredClone(ledger);
duplicateRecord.records[1].recordId = duplicateRecord.records[0].recordId;
assert.equal(parseGovernanceLedgerV1(duplicateRecord), null, 'duplicate record ID rejected');
const unknownRecord = structuredClone(ledger);
const unknownTemplate = unknownRecord.records.find((record) => record.subjectType === 'MATERIAL_TEMPLATE');
unknownTemplate.subjectId = 'unknown-material-template';
unknownTemplate.recordId = 'template:unknown-material-template';
assert.equal(parseGovernanceLedgerV1(unknownRecord), null, 'unknown subject ID rejected');
const omittedRecord = structuredClone(ledger);
omittedRecord.records.pop();
assert.equal(parseGovernanceLedgerV1(omittedRecord), null, 'omitted subject ID rejected');
const rightsUnlocked = structuredClone(ledger);
rightsUnlocked.records[0].rightsStatus = 'CLEARED';
rightsUnlocked.records[0].promotionStatus = 'BLOCKED';
assert.equal(parseGovernanceLedgerV1(rightsUnlocked), null, 'rights without evidence rejected');
const capabilityUnlocked = structuredClone(ledger);
capabilityUnlocked.records[0].capabilityStatus = 'VERIFIED';
assert.equal(parseGovernanceLedgerV1(capabilityUnlocked), null, 'unknown capability upgrade rejected');
const promotionUnlocked = structuredClone(ledger);
promotionUnlocked.records[0].promotionStatus = 'READY';
assert.equal(parseGovernanceLedgerV1(promotionUnlocked), null, 'promotion unlock rejected');
const invalidCompleteness = structuredClone(ledger);
invalidCompleteness.records[0].completeness.binaries = 'MAYBE';
assert.equal(parseGovernanceLedgerV1(invalidCompleteness), null, 'invalid completeness enum rejected');

function copyTree(source, destination) { fs.cpSync(source, destination, { recursive: true }); }
function makeFixture() {
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'asset-ops-governance-'));
  copyTree(path.join(root, 'material-library'), path.join(fixture, 'material-library'));
  copyTree(path.join(root, 'assets'), path.join(fixture, 'assets'));
  return fixture;
}
function mutateIndex(mutator) {
  const fixture = makeFixture();
  try {
    const file = path.join(fixture, 'material-library/index.json');
    const value = JSON.parse(fs.readFileSync(file, 'utf8'));
    mutator(value);
    fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
    assert.throws(() => generateAssetOpsGovernance({ rootDir: fixture }), /fail-closed/);
  } finally { fs.rmSync(fixture, { recursive: true, force: true }); }
}
mutateIndex((index) => { index.templates[0].id = index.templates[1].id; });
mutateIndex((index) => { index.templates[0].asset_status = 'INVALID'; });
mutateIndex((index) => { index.templates[0].manifest_url = '../outside.json'; });
mutateIndex((index) => { index.templates[0].manifest_url = 'material-library/templates/t_french_white/manifest.json'; });

const missingLookFixture = makeFixture();
try {
  const file = path.join(missingLookFixture, 'assets/hero-recipes/v0-7-2-four-look-sets.json');
  const value = JSON.parse(fs.readFileSync(file, 'utf8'));
  value.entries.pop();
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
  assert.throws(() => generateAssetOpsGovernance({ rootDir: missingLookFixture }), /expected 4 Look packs/);
} finally { fs.rmSync(missingLookFixture, { recursive: true, force: true }); }

const manufacturingFixture = makeFixture();
try {
  const file = path.join(manufacturingFixture, 'assets/hero-recipes/leopard-gilded-nude/manifest.json');
  const value = JSON.parse(fs.readFileSync(file, 'utf8'));
  value.manufacturingValidated = true;
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
  assert.throws(() => generateAssetOpsGovernance({ rootDir: manufacturingFixture }), /manufacturingValidated=false/);
} finally { fs.rmSync(manufacturingFixture, { recursive: true, force: true }); }

console.log('test-asset-ops-governance: PASS (25/25 strict ledger, lifecycle/rights/capability/promotion gates, Look simulation boundary)');
