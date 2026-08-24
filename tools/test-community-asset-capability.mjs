#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import {
  buildCommunityLookAssetCapabilityIndexV1,
  parseCommunityLookAssetCapabilityEvidenceV1,
  projectCommunityLookAssetCapabilityV1,
} from '../src/community/domain/asset-capability-v1.ts';
import { parseMigrationManifestV1 } from '../src/community/domain/taxonomy-v2/migration-manifest.ts';
import { parseCommunityTaxonomyV2 } from '../src/community/domain/taxonomy-v2/parse.ts';
import { CANONICAL_USE_DEMO_READ_MODEL_V1 } from '../src/integration/community-studio/canonical-use-demo.ts';
import { FOUR_LOOK_SET_READ_MODELS_V0_7_2 } from '../src/integration/community-studio/v0-7-2-four-look-sets.ts';

const root = process.cwd();
const readJson = (relative) => JSON.parse(fs.readFileSync(path.join(root, relative), 'utf8'));
const taxonomyResult = parseCommunityTaxonomyV2(readJson('public/community/taxonomy-v2.json'));
assert.equal(taxonomyResult.ok, true, 'taxonomy fixture must parse');
const manifestResult = parseMigrationManifestV1(
  readJson('public/community/migration-manifest-v1.json'),
  taxonomyResult.value,
);
assert.equal(manifestResult.ok, true, 'migration fixture must parse');
const manifest = manifestResult.value;
const evidence = readJson('public/community/asset-capability-evidence-v1.json');
const contentIndex = readJson('public/community/content-index.json');
const report = readJson('evidence/pr-community-v0-7-2-asset-03a/asset-capability-report-v1.json');
const sourceContentById = new Map(contentIndex.contents.map((record) => [record.contentId, record]));
const versionedAuthorities = [CANONICAL_USE_DEMO_READ_MODEL_V1, ...FOUR_LOOK_SET_READ_MODELS_V0_7_2];

const clone = (value) => structuredClone(value);
const expectFailure = (result, code) => {
  assert.equal(result.ok, false, `expected ${code} failure`);
  assert.ok(result.issues.some((issue) => issue.code === code), JSON.stringify(result.issues));
};

const inputSnapshot = JSON.stringify(evidence);
const built = buildCommunityLookAssetCapabilityIndexV1(evidence, manifest, versionedAuthorities);
assert.equal(built.ok, true, JSON.stringify(built.ok ? '' : built.issues));
assert.equal(JSON.stringify(evidence), inputSnapshot, 'projection must not mutate evidence');
assert.equal(built.value.entries.length, 24, 'all migration subjects require capability evidence');
assert.deepEqual(
  built.value.entries.map((entry) => entry.contentId),
  [...manifest.entries.map((entry) => entry.contentId)].sort((a, b) => a.localeCompare(b)),
  'index is byte-stably sorted by contentId',
);
assert.equal(
  JSON.stringify(buildCommunityLookAssetCapabilityIndexV1(evidence, manifest, versionedAuthorities)),
  JSON.stringify(built),
  'repeat projection is byte-stable',
);

const stateCounts = Object.fromEntries(
  ['VERSIONED_READY', 'LEGACY_APPROXIMATE', 'ASSETS_INCOMPLETE', 'UNAVAILABLE'].map((state) => [
    state,
    built.value.entries.filter((entry) => entry.capabilityState === state).length,
  ]),
);
assert.deepEqual(stateCounts, {
  VERSIONED_READY: 5,
  LEGACY_APPROXIMATE: 2,
  ASSETS_INCOMPLETE: 7,
  UNAVAILABLE: 10,
});
assert.deepEqual(report.coverage, { expected: 24, actual: 24, missing: 0, orphan: 0, duplicate: 0 });
for (const state of Object.keys(report.capabilityStates)) {
  assert.deepEqual(
    report.capabilityStates[state],
    built.value.entries
      .filter((entry) => entry.capabilityState === state)
      .map((entry) => entry.contentId)
      .sort((a, b) => a.localeCompare(b)),
    `machine-readable report must match ${state}`,
  );
}
assert.equal(report.gates.currentMakeableCount, built.value.entries.filter((entry) => entry.currentMakeable).length);
assert.equal(report.gates.manufacturingValidatedCount, built.value.entries.filter((entry) => entry.manufacturingValidated).length);
assert.equal(built.value.entries.filter((entry) => entry.capabilityState === 'INSPIRATION_ONLY').length, 0);
assert.equal(built.value.entries.filter((entry) => entry.currentMakeable).length, 0, '24/24 remain CONCEPT_ONLY');
assert.equal(built.value.entries.filter((entry) => entry.manufacturingValidated).length, 0, '24/24 have no manufacturing validation');

for (const item of built.value.entries) {
  assert.equal('applicationLevel' in item, false, 'legacy application label must not enter the capability contract');
  assert.equal('verificationLevel' in item, false, 'legacy verification label must not enter the capability contract');
  if (item.publicStatus === 'PUBLIC_BLOCKED' || item.rightsStatus === 'PENDING') {
    assert.equal(item.permissions.public, false, item.contentId);
    assert.equal(item.permissions.commercial, false, item.contentId);
    assert.equal(item.permissions.remix, false, item.contentId);
    assert.equal(item.cta, 'UNAVAILABLE', item.contentId);
  }
  if (item.technicalStatus === 'EXACT') {
    assert.ok(item.designVersionRef, item.contentId);
    assert.equal(item.coverRef.sha256, item.designVersionRef.previewSha256, item.contentId);
    assert.ok(item.diagnostics.includes('exact_identity_lineage_only'), item.contentId);
    assert.ok(item.diagnostics.includes('preview_is_approximate'), item.contentId);
  }
}

// Canonical demo + four v0.7.2 sets bind to real version/editor/preview evidence.
for (const look of versionedAuthorities) {
  const item = built.value.entries.find((entry) => entry.contentId === look.lookId);
  assert.ok(item, look.lookId);
  assert.equal(item.capabilityState, 'VERSIONED_READY', look.lookId);
  assert.equal(item.cta, 'USE_VERSIONED', look.lookId);
  assert.equal(item.designVersionRef.designVersionId, look.designVersionId, look.lookId);
  assert.equal(item.designVersionRef.editorDocSha256, look.evidence.immutableDesignVersion.editorDocRef.sha256, look.lookId);
  assert.equal(item.designVersionRef.previewSha256, look.evidence.previewEvidence.previewSha256, look.lookId);
  assert.equal(item.coverRef.url, look.cover.url, look.lookId);
  assert.deepEqual(item.recommendedShapeIds, look.discovery.recommendedShapeIds, look.lookId);
  assert.equal(look.evidence.previewEvidence.fidelity, 'APPROXIMATE', 'EXACT means identity lineage only');
  assert.equal(look.evidence.status.manufacturable, false, look.lookId);
}

// The only two legacy Use paths retain their explicit existing asset refs.
for (const id of ['cc_mercury_dew', 'cc_petal_veil']) {
  const item = built.value.entries.find((entry) => entry.contentId === id);
  const source = sourceContentById.get(id);
  assert.equal(item.capabilityState, 'LEGACY_APPROXIMATE', id);
  assert.equal(item.cta, 'USE_LEGACY_APPROXIMATE', id);
  assert.deepEqual(item.legacyAssetRef, {
    templateId: source.assetRef.templateId,
    assetVersion: source.assetRef.assetVersion,
    manifestUrl: source.assetRef.manifestUrl,
  });
  assert.equal(item.coverRef.url, source.cover.url);
  assert.equal(item.coverRef.sha256, null, 'legacy cover hash must not be invented');
}

// Every legacy cover and recommended-shape list stays tied to the source + migration authorities.
for (const source of contentIndex.contents) {
  const item = built.value.entries.find((entry) => entry.contentId === source.contentId);
  const migration = manifest.entries.find((entry) => entry.contentId === source.contentId);
  assert.equal(item.coverRef.url, source.cover.url, source.contentId);
  assert.deepEqual(item.recommendedShapeIds, migration.discovery.recommendedShapeIds, source.contentId);
}

// Strict record parser and state/ref coupling.
const valid = evidence.find((entry) => entry.contentId === 'look.v7-1.petal-veil');
assert.equal(parseCommunityLookAssetCapabilityEvidenceV1(valid).ok, true);
const unknownKey = clone(valid);
unknownKey.extra = true;
expectFailure(parseCommunityLookAssetCapabilityEvidenceV1(unknownKey), 'unknown_key');
const badSha = clone(valid);
badSha.designVersionRef.editorDocSha256 = '0'.repeat(63);
expectFailure(parseCommunityLookAssetCapabilityEvidenceV1(badSha), 'invalid_sha256');
const previewDrift = clone(valid);
previewDrift.coverRef.sha256 = '1'.repeat(64);
expectFailure(parseCommunityLookAssetCapabilityEvidenceV1(previewDrift), 'preview_sha_mismatch');
const manufacturingClaim = clone(valid);
manufacturingClaim.manufacturingValidated = true;
expectFailure(parseCommunityLookAssetCapabilityEvidenceV1(manufacturingClaim), 'manufacturing_claim');
const stateRefMismatch = clone(valid);
stateRefMismatch.intendedCapabilityState = 'LEGACY_APPROXIMATE';
expectFailure(parseCommunityLookAssetCapabilityEvidenceV1(stateRefMismatch), 'state_mismatch');
const pendingPromotion = clone(evidence.find((entry) => entry.contentId === 'cc_pugc_luna_blush'));
pendingPromotion.intendedCapabilityState = 'INSPIRATION_ONLY';
pendingPromotion.technicalStatus = 'APPROXIMATE';
expectFailure(parseCommunityLookAssetCapabilityEvidenceV1(pendingPromotion), 'state_mismatch');

// Exact coverage: duplicate, missing and orphan evidence all fail closed.
expectFailure(buildCommunityLookAssetCapabilityIndexV1([...evidence, clone(evidence[0])], manifest, versionedAuthorities), 'duplicate_content_id');
expectFailure(buildCommunityLookAssetCapabilityIndexV1(evidence.slice(1), manifest, versionedAuthorities), 'missing_evidence');
const orphan = clone(evidence[0]);
orphan.contentId = 'cc_orphan';
orphan.subjectId = 'look:cc_orphan';
expectFailure(buildCommunityLookAssetCapabilityIndexV1([...evidence, orphan], manifest, versionedAuthorities), 'unknown_evidence');

expectFailure(
  buildCommunityLookAssetCapabilityIndexV1(evidence, manifest, versionedAuthorities.slice(1)),
  'missing_versioned_authority',
);
const authorityShaDrift = clone(evidence);
authorityShaDrift.find((entry) => entry.contentId === 'look.v7-1.petal-veil').designVersionRef.editorDocSha256 = '1'.repeat(64);
expectFailure(
  buildCommunityLookAssetCapabilityIndexV1(authorityShaDrift, manifest, versionedAuthorities),
  'editor_doc_sha_mismatch',
);

// Cross-authority parity cannot be bypassed.
for (const [field, code, id, mutate] of [
  ['sourceClass', 'source_class_mismatch', 'look.v7-1.petal-veil', (item) => { item.sourceClass = 'V0_7_2_LOOK_SET'; }],
  ['publicStatus', 'public_status_mismatch', 'cc_mercury_dew', (item) => { item.publicStatus = 'MANUAL_REVIEW'; }],
  ['rightsStatus', 'rights_status_mismatch', 'cc_mercury_dew', (item) => { item.rightsStatus = 'LICENSED'; }],
  ['makeabilityClassification', 'makeability_mismatch', 'cc_mercury_dew', (item) => { item.makeabilityClassification = 'HAND_MADE'; }],
  ['recommendedShapeIds', 'shape_ids_mismatch', 'cc_mercury_dew', (item) => { item.recommendedShapeIds = ['shape:oval']; }],
]) {
  const mutated = clone(evidence);
  const item = mutated.find((entry) => entry.contentId === id);
  mutate(item);
  const result = buildCommunityLookAssetCapabilityIndexV1(mutated, manifest, versionedAuthorities);
  expectFailure(result, code);
  assert.ok(field);
}

// PERSONAL_USE_ONLY stays public but cannot expose commercial/remix actions.
const personalMigration = clone(manifest.entries.find((entry) => entry.contentId === 'cc_mercury_dew'));
personalMigration.discovery.rights.status = 'PERSONAL_USE_ONLY';
const personalEvidence = clone(evidence.find((entry) => entry.contentId === 'cc_mercury_dew'));
personalEvidence.rightsStatus = 'PERSONAL_USE_ONLY';
const parsedPersonal = parseCommunityLookAssetCapabilityEvidenceV1(personalEvidence);
assert.equal(parsedPersonal.ok, true);
const personal = projectCommunityLookAssetCapabilityV1(parsedPersonal.value, personalMigration);
assert.equal(personal.ok, true);
assert.equal(personal.value.permissions.public, true);
assert.equal(personal.value.permissions.commercial, false);
assert.equal(personal.value.permissions.remix, false);
assert.equal(personal.value.cta, 'VIEW_ONLY', 'personal-only rights must not expose an adaptation action');

console.log('test-community-asset-capability: PASS (24/24 exact coverage; 5 versioned, 2 legacy, 7 incomplete, 10 unavailable; rights/makeability/version-SHA fail closed)');
