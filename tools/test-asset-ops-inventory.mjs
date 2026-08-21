import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { generateAssetOpsInventory } from './generate-asset-ops-inventory.mjs';

const root = path.resolve(new URL('..', import.meta.url).pathname);
const report = generateAssetOpsInventory({ rootDir: root, strict: false });
assert.equal(report.summary.templateCount, 21);
assert.equal(report.summary.lookCount, 4);
assert.equal(report.summary.classifications.already_valid_legacy, 11);
assert.equal(report.summary.classifications.metadata_migration_required, 0);
assert.equal(report.summary.classifications.candidate_only, 7);
assert.equal(report.summary.classifications.already_valid_simulated_pack, 7, '3 templates + 4 four-look packs are simulated');
assert.equal(report.summary.classifications.missing_binary, 0);
assert.equal(report.summary.classifications.mapping_mismatch, 0);
assert.equal(report.summary.formalTemplateMetadataGap, false);
assert.equal(report.summary.fourLookSimulatedNonManufacturing, true);

const sunset = report.templates.find((template) => template.id === 't_sunset_aura_glaze_concept');
assert.ok(sunset);
assert.equal(sunset.classification, 'candidate_only');
assert.equal(sunset.manifestTemplateId, 't_nude_gradient');
assert.ok(!sunset.categories.includes('mapping_mismatch'));

const formal = report.templates.filter((template) => template.classification === 'already_valid_legacy');
assert.equal(formal.length, 11);
assert.ok(formal.every((template) => template.assetStatus === 'REAL'));
assert.ok(report.looks.every((look) => look.status === 'SIMULATED_LOOK_ASSET_PACK'));
assert.ok(report.looks.every((look) => look.manufacturingValidated === false));
assert.ok(report.looks.every((look) => look.fingerCount === 10));

const first = JSON.stringify(report);
const second = JSON.stringify(generateAssetOpsInventory({ rootDir: root }));
assert.equal(second, first, 'same inputs produce byte-stable JSON');

function copyTree(source, destination) {
  fs.cpSync(source, destination, { recursive: true });
}

function makeFixture() {
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'asset-ops-inventory-'));
  copyTree(path.join(root, 'material-library'), path.join(fixture, 'material-library'));
  copyTree(path.join(root, 'assets'), path.join(fixture, 'assets'));
  return fixture;
}

const tempRoot = makeFixture();
try {
  const brokenIndex = JSON.parse(fs.readFileSync(path.join(tempRoot, 'material-library/index.json'), 'utf8'));
  brokenIndex.templates[0].thumbnail_url = 'assets/does-not-exist.png';
  fs.writeFileSync(path.join(tempRoot, 'material-library/index.json'), `${JSON.stringify(brokenIndex, null, 2)}\n`);
  assert.throws(() => generateAssetOpsInventory({ rootDir: tempRoot }), /fail-closed:.*missing binary|fail-closed:.*does not exist/);
} finally {
  fs.rmSync(tempRoot, { recursive: true, force: true });
}

const mappingRoot = makeFixture();
try {
  const mappingIndex = JSON.parse(fs.readFileSync(path.join(mappingRoot, 'material-library/index.json'), 'utf8'));
  mappingIndex.templates[0].render_template_id = 't_unknown_render_target';
  fs.writeFileSync(path.join(mappingRoot, 'material-library/index.json'), `${JSON.stringify(mappingIndex, null, 2)}\n`);
  assert.throws(() => generateAssetOpsInventory({ rootDir: mappingRoot }), /fail-closed:.*unknown render_template_id/);
} finally {
  fs.rmSync(mappingRoot, { recursive: true, force: true });
}

function assertLookMutation(mutator, pattern) {
  const fixture = makeFixture();
  try {
    const manifestPath = path.join(fixture, 'assets/hero-recipes/leopard-gilded-nude/manifest.json');
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    mutator(manifest);
    fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
    assert.throws(() => generateAssetOpsInventory({ rootDir: fixture }), pattern);
  } finally {
    fs.rmSync(fixture, { recursive: true, force: true });
  }
}

assertLookMutation((manifest) => { manifest.assets.highFidelityCover.sha256 = '0'.repeat(64); }, /sha256 mismatch/);
assertLookMutation((manifest) => { manifest.assets.highFidelityCover.byteLength += 1; }, /byteLength mismatch/);
assertLookMutation((manifest) => { manifest.manufacturingValidated = true; }, /manufacturingValidated=false/);
assertLookMutation((manifest) => { manifest.assets.textureMaps.normal.path = 'maps/missing-normal.png'; }, /references missing binary/);

const metadataFixture = makeFixture();
try {
  const indexPath = path.join(metadataFixture, 'material-library/index.json');
  const index = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
  delete index.templates.find((template) => template.id === 't_nude_gradient').asset_status;
  fs.writeFileSync(indexPath, `${JSON.stringify(index, null, 2)}\n`);
  const migrated = generateAssetOpsInventory({ rootDir: metadataFixture, strict: false });
  const nude = migrated.templates.find((template) => template.id === 't_nude_gradient');
  assert.equal(nude.classification, 'metadata_migration_required');
  assert.equal(migrated.summary.classifications.metadata_migration_required, 1);
} finally {
  fs.rmSync(metadataFixture, { recursive: true, force: true });
}

const auditableMappingFixture = makeFixture();
try {
  const indexPath = path.join(auditableMappingFixture, 'material-library/index.json');
  const index = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
  const sunsetEntry = index.templates.find((template) => template.id === 't_sunset_aura_glaze_concept');
  sunsetEntry.manifest_url = 'material-library/templates/t_liquid_velvet_cat_eye/manifest.json';
  fs.writeFileSync(indexPath, `${JSON.stringify(index, null, 2)}\n`);
  const audited = generateAssetOpsInventory({ rootDir: auditableMappingFixture, strict: false });
  const auditedSunset = audited.templates.find((template) => template.id === 't_sunset_aura_glaze_concept');
  assert.equal(auditedSunset.classification, 'candidate_only');
  assert.ok(auditedSunset.categories.includes('mapping_mismatch'));
} finally {
  fs.rmSync(auditableMappingFixture, { recursive: true, force: true });
}

console.log('test-asset-ops-inventory: PASS (21 templates, 4 four-look packs, mapping/gap fail-closed, byte-stable)');
