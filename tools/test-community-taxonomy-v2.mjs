#!/usr/bin/env node
/**
 * COMM-v0.7.2-TAX-01 · Taxonomy & Governance contract tests.
 *
 * Covers:
 *  - fixture/runtime drift (fixture must agree with contract constants);
 *  - strict parse rejections: unknown keys, duplicate ids/aliases,
 *    cross-dimension alias targets, alias self-references, invalid/cyclic
 *    replacements, reused/uncovered deprecated ids, invalid bilingual labels,
 *    browse order/count drift, channel-vs-tag collisions;
 *  - deterministic alias resolution (ST-02 / 法式 / French / french →
 *    technique:french, never an overall style);
 *  - discovery metadata parse + governance gates (public eligibility,
 *    fail-closed current-makeable, rights/action permissions, the narrow
 *    NEEDS_STYLE_REVIEW french exception);
 *  - curation metadata parse (separate contract; relationship-driven
 *    channels can never be statically featured).
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import {
  DEPRECATED_STYLE_IDS,
  PRIMARY_BROWSE_IDS,
  RECOMMENDATION_CHANNEL_IDS,
  REQUIRED_TAG_IDS,
  TAXONOMY_V2_DIMENSIONS,
} from '../src/community/domain/taxonomy-v2/contract.ts';
import {
  parseCommunityTaxonomyV2,
  parseCurationMetadataV1,
  parseDiscoveryMetadataV1,
} from '../src/community/domain/taxonomy-v2/parse.ts';
import {
  FRENCH_LEGACY_ALIASES,
  resolveFrenchTechnique,
  resolveTagId,
  resolveTags,
} from '../src/community/domain/taxonomy-v2/resolve.ts';
import {
  actionPermissions,
  curationPublicEligibility,
  isCurrentMakeable,
  legacyStyleReviewExceptionApplies,
  makeableChannelEligible,
  publicationEligibility,
  styleChannelEligible,
} from '../src/community/domain/taxonomy-v2/governance.ts';

const root = process.cwd();
const fixturePath = path.join(root, 'public/community/taxonomy-v2.json');
const rawFixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));

let passed = 0;
let failed = 0;
const failures = [];

function test(name, fn) {
  try {
    fn();
    passed += 1;
  } catch (error) {
    failed += 1;
    failures.push(`${name}\n    ${error.message}`);
  }
}

function issuesOf(result) {
  return result.ok ? [] : result.issues.map((issue) => issue.code);
}

function expectFail(result, expectedCode) {
  assert.equal(result.ok, false, `expected parse failure, got ok`);
  const codes = issuesOf(result);
  assert.ok(
    codes.includes(expectedCode),
    `expected issue code "${expectedCode}" among [${codes.join(', ')}]`,
  );
}

function cloneFixture() {
  return structuredClone(rawFixture);
}

function makeTaxonomy(mutator) {
  const fixture = cloneFixture();
  mutator(fixture);
  const parsed = parseCommunityTaxonomyV2(fixture);
  assert.equal(parsed.ok, true, `mutated fixture must stay valid: ${JSON.stringify(parsed.ok ? '' : parsed.issues).slice(0, 300)}`);
  return parsed.value;
}

// ---------------------------------------------------------------------------
// Fixture / runtime drift
// ---------------------------------------------------------------------------

test('fixture parses with the runtime parser and round-trips canonically', () => {
  const parsed = parseCommunityTaxonomyV2(rawFixture);
  assert.equal(parsed.ok, true, JSON.stringify(parsed.ok ? '' : parsed.issues).slice(0, 500));
  assert.deepEqual(JSON.parse(JSON.stringify(parsed.value)), rawFixture);
});

test('fixture matches the fixed primary browse order', () => {
  const ids = rawFixture.browse.primary.map((entry) => entry.id);
  assert.deepEqual(ids, [...PRIMARY_BROWSE_IDS]);
});

test('fixture matches the fixed recommendation channel set/order', () => {
  const ids = rawFixture.browse.recommendationChannels.map((channel) => channel.id);
  assert.deepEqual(ids, [...RECOMMENDATION_CHANNEL_IDS]);
  const defaults = rawFixture.browse.recommendationChannels.filter((c) => c.isDefault === true);
  assert.deepEqual(defaults.map((c) => c.id), ['for-you']);
  const following = rawFixture.browse.recommendationChannels.find((c) => c.id === 'following');
  assert.equal(following.requiresRelationshipProvider, true);
});

test('fixture matches the exact PRD vocabulary per dimension (no drift)', () => {
  let total = 0;
  for (const dimension of TAXONOMY_V2_DIMENSIONS) {
    const ids = rawFixture.dimensions[dimension].tags.map((tag) => tag.id);
    assert.deepEqual(ids, [...REQUIRED_TAG_IDS[dimension]], dimension);
    total += ids.length;
  }
  assert.equal(total, 89);
});

test('fixture deprecatedIds match the retired legacy style ids exactly', () => {
  assert.deepEqual(rawFixture.deprecatedIds, [...DEPRECATED_STYLE_IDS]);
});

test('recommendation channels never collide with tag ids (channels are definitions)', () => {
  const tagIds = new Set();
  for (const dimension of TAXONOMY_V2_DIMENSIONS) {
    for (const tag of rawFixture.dimensions[dimension].tags) tagIds.add(tag.id);
  }
  for (const channel of rawFixture.browse.recommendationChannels) {
    assert.equal(tagIds.has(channel.id), false, `channel "${channel.id}" must not be a tag`);
  }
});

test('every tag carries non-empty zh-CN and en labels', () => {
  for (const dimension of TAXONOMY_V2_DIMENSIONS) {
    for (const tag of rawFixture.dimensions[dimension].tags) {
      assert.ok(tag.labels['zh-CN'] && tag.labels['zh-CN'].trim().length > 0, `${tag.id} zh-CN`);
      assert.ok(tag.labels.en && tag.labels.en.trim().length > 0, `${tag.id} en`);
    }
  }
});

// ---------------------------------------------------------------------------
// Strict parse rejections (negative fixtures)
// ---------------------------------------------------------------------------

test('rejects unknown keys at the taxonomy root', () => {
  const fixture = cloneFixture();
  fixture.extraRootKey = true;
  expectFail(parseCommunityTaxonomyV2(fixture), 'unknown_key');
});

test('rejects duplicate tag ids across dimensions', () => {
  const fixture = cloneFixture();
  fixture.dimensions.STYLE.tags[1].id = 'style:minimal-clean';
  expectFail(parseCommunityTaxonomyV2(fixture), 'duplicate_tag_id');
});

test('rejects duplicate aliases', () => {
  const fixture = cloneFixture();
  fixture.dimensions.STYLE.tags[0].aliases.push('ST-02');
  expectFail(parseCommunityTaxonomyV2(fixture), 'duplicate_alias');
});

test('rejects cross-dimension alias targets', () => {
  const fixture = cloneFixture();
  fixture.dimensions.STYLE.tags[0].aliases.push('shape:almond');
  expectFail(parseCommunityTaxonomyV2(fixture), 'cross_dimension_alias_target');
});

test('rejects alias self-references (alias cycles)', () => {
  const fixture = cloneFixture();
  fixture.dimensions.STYLE.tags[0].aliases.push('style:minimal-clean');
  expectFail(parseCommunityTaxonomyV2(fixture), 'alias_self_reference');
});

test('rejects replacement to a tag in another dimension', () => {
  const fixture = cloneFixture();
  fixture.dimensions.TECHNIQUE.tags[0].lifecycle = 'MERGED';
  fixture.dimensions.TECHNIQUE.tags[0].replacementId = 'style:minimal-clean';
  expectFail(parseCommunityTaxonomyV2(fixture), 'replacement_cross_dimension');
});

test('rejects self-replacement', () => {
  const fixture = cloneFixture();
  fixture.dimensions.TECHNIQUE.tags[0].lifecycle = 'MERGED';
  fixture.dimensions.TECHNIQUE.tags[0].replacementId = 'technique:french';
  expectFail(parseCommunityTaxonomyV2(fixture), 'replacement_self');
});

test('rejects replacement to a non-ACTIVE tag', () => {
  const fixture = cloneFixture();
  fixture.dimensions.STYLE.tags[0].lifecycle = 'MERGED';
  fixture.dimensions.STYLE.tags[0].replacementId = 'style:gothic-dark';
  fixture.dimensions.STYLE.tags[11].lifecycle = 'MERGED';
  fixture.dimensions.STYLE.tags[11].replacementId = 'style:bold-ornate';
  expectFail(parseCommunityTaxonomyV2(fixture), 'replacement_target_not_active');
});

test('rejects replacement cycles', () => {
  const fixture = cloneFixture();
  fixture.dimensions.STYLE.tags[0].lifecycle = 'MERGED';
  fixture.dimensions.STYLE.tags[0].replacementId = 'style:classic-refined';
  fixture.dimensions.STYLE.tags[1].lifecycle = 'MERGED';
  fixture.dimensions.STYLE.tags[1].replacementId = 'style:minimal-clean';
  expectFail(parseCommunityTaxonomyV2(fixture), 'replacement_cycle');
});

test('rejects reused deprecated ids', () => {
  const fixture = cloneFixture();
  fixture.dimensions.STYLE.tags[0].id = 'ST-02';
  expectFail(parseCommunityTaxonomyV2(fixture), 'reused_deprecated_id');
});

test('rejects uncovered deprecated ids (missing migration alias)', () => {
  const fixture = cloneFixture();
  fixture.dimensions.TECHNIQUE.tags[0].aliases = ['法式', 'French', 'french', 'French Tip', '法式线'];
  expectFail(parseCommunityTaxonomyV2(fixture), 'uncovered_deprecated_id');
});

test('rejects invalid bilingual labels (missing locale / extra locale)', () => {
  const fixture = cloneFixture();
  fixture.dimensions.STYLE.tags[0].labels = { 'zh-CN': '极简清爽' };
  expectFail(parseCommunityTaxonomyV2(fixture), 'invalid_labels');
  const fixture2 = cloneFixture();
  fixture2.dimensions.STYLE.tags[0].labels = { 'zh-CN': '极简清爽', en: 'Minimal Clean', fr: 'Minimal' };
  expectFail(parseCommunityTaxonomyV2(fixture2), 'unknown_key');
});

test('rejects primary browse order drift', () => {
  const fixture = cloneFixture();
  const primary = fixture.browse.primary;
  [primary[1], primary[2]] = [primary[2], primary[1]];
  expectFail(parseCommunityTaxonomyV2(fixture), 'primary_browse_order');
});

test('rejects primary kind mismatch', () => {
  const fixture = cloneFixture();
  fixture.browse.primary[1].kind = 'channel';
  expectFail(parseCommunityTaxonomyV2(fixture), 'primary_kind_mismatch');
});

test('rejects recommendation channel order drift', () => {
  const fixture = cloneFixture();
  const channels = fixture.browse.recommendationChannels;
  channels.unshift(channels.pop());
  expectFail(parseCommunityTaxonomyV2(fixture), 'recommendation_channel_order');
});

test('rejects a missing default channel', () => {
  const fixture = cloneFixture();
  fixture.browse.recommendationChannels[0].isDefault = false;
  expectFail(parseCommunityTaxonomyV2(fixture), 'default_channel_mismatch');
});

test('rejects following without a relationship provider declaration', () => {
  const fixture = cloneFixture();
  fixture.browse.recommendationChannels[4].requiresRelationshipProvider = false;
  expectFail(parseCommunityTaxonomyV2(fixture), 'following_relationship_provider');
});

test('rejects channel ids that collide with tag ids', () => {
  const fixture = cloneFixture();
  fixture.browse.recommendationChannels[0].id = 'style:minimal-clean';
  expectFail(parseCommunityTaxonomyV2(fixture), 'channel_id_collides_with_tag');
});

// ---------------------------------------------------------------------------
// Deterministic resolution
// ---------------------------------------------------------------------------

test('legacy french aliases resolve deterministically to technique:french', () => {
  const taxonomy = parseCommunityTaxonomyV2(rawFixture).value;
  for (const alias of FRENCH_LEGACY_ALIASES) {
    const resolved = resolveTagId(taxonomy, alias);
    assert.ok(resolved, `alias "${alias}" must resolve`);
    assert.equal(resolved.id, 'technique:french', alias);
    assert.equal(resolved.dimension, 'TECHNIQUE', alias);
  }
  assert.equal(resolveFrenchTechnique(taxonomy)?.id, 'technique:french');
});

test('ST-02 resolution never invents an overall style', () => {
  const taxonomy = parseCommunityTaxonomyV2(rawFixture).value;
  const resolved = resolveTagId(taxonomy, 'ST-02');
  assert.equal(resolved.dimension, 'TECHNIQUE');
  assert.equal(resolved.id, 'technique:french');
});

test('all retired legacy style ids resolve deterministically', () => {
  const taxonomy = parseCommunityTaxonomyV2(rawFixture).value;
  for (const id of DEPRECATED_STYLE_IDS) {
    const resolved = resolveTagId(taxonomy, id);
    assert.ok(resolved, `${id} must resolve`);
    assert.equal(resolved.lifecycle, 'ACTIVE');
  }
  assert.equal(resolveTagId(taxonomy, 'ST-01').id, 'style:minimal-clean');
  assert.equal(resolveTagId(taxonomy, 'ST-09').id, 'style:artistic-abstract');
});

test('unknown ids and aliases do not resolve', () => {
  const taxonomy = parseCommunityTaxonomyV2(rawFixture).value;
  assert.equal(resolveTagId(taxonomy, 'style:nope'), null);
  assert.equal(resolveTagId(taxonomy, 'nope'), null);
  const result = resolveTags(taxonomy, ['style:y2k', 'shape:stiletto', 'style:nope']);
  assert.equal(result.resolved.size, 2);
  assert.deepEqual(result.issues, ['style:nope']);
});

test('replacement chains resolve through merged tags and their aliases', () => {
  const taxonomy = makeTaxonomy((fixture) => {
    fixture.dimensions.STYLE.tags[0].lifecycle = 'MERGED';
    fixture.dimensions.STYLE.tags[0].replacementId = 'style:classic-refined';
  });
  assert.equal(resolveTagId(taxonomy, 'style:minimal-clean').id, 'style:classic-refined');
  assert.equal(resolveTagId(taxonomy, 'ST-01').id, 'style:classic-refined');
  assert.equal(resolveTagId(taxonomy, '极简/轻奢').id, 'style:classic-refined');
});

// ---------------------------------------------------------------------------
// Discovery metadata: parse
// ---------------------------------------------------------------------------

const SHA_256 = 'a'.repeat(64);
const BASE_DISCOVERY = {
  schemaVersion: 1,
  contractRef: 'COMM-v0.7.2-TAX-01',
  subjectRef: { kind: 'PUBLISHED_LOOK', id: 'look:community-0001' },
  styleIds: ['style:minimal-clean'],
  recommendedShapeIds: ['shape:almond'],
  sceneIds: [],
  themeIds: ['theme:floral-plants'],
  techniqueIds: [],
  lengthIds: ['length:medium'],
  makeability: {
    classification: 'MACHINE_DIRECT',
    capabilityRef: 'capability://v0.7.2/uv-inkjet@v1.2.0',
    assetRefs: [`asset://v0.7.2/look-0001/template@sha256:${SHA_256}`],
    evidenceRefs: ['evidence://v0.7.2/look-0001/makeability@v1.0.0'],
  },
  rights: {
    status: 'ORIGINAL',
    evidenceRefs: ['evidence://v0.7.2/look-0001/rights@v1.0.0'],
  },
  migration: { state: 'NONE', legacyStyleIds: [], migratedAt: '2026-08-14T00:00:00.000Z' },
  updatedAt: '2026-08-14T00:00:00.000Z',
};

let parsedTaxonomy = null;
test('discovery metadata parses when fully valid', () => {
  parsedTaxonomy = parseCommunityTaxonomyV2(rawFixture).value;
  const result = parseDiscoveryMetadataV1(BASE_DISCOVERY, parsedTaxonomy);
  assert.equal(result.ok, true, JSON.stringify(result.ok ? '' : result.issues).slice(0, 400));
});

test('discovery metadata rejects unknown keys', () => {
  const record = structuredClone(BASE_DISCOVERY);
  record.bogus = 1;
  expectFail(parseDiscoveryMetadataV1(record, parsedTaxonomy), 'unknown_key');
});

test('discovery metadata rejects unresolved tag references', () => {
  const record = structuredClone(BASE_DISCOVERY);
  record.styleIds = ['style:nope'];
  expectFail(parseDiscoveryMetadataV1(record, parsedTaxonomy), 'unresolved_tag_reference');
});

test('discovery metadata rejects cross-dimension tag references', () => {
  const record = structuredClone(BASE_DISCOVERY);
  record.styleIds = ['shape:almond'];
  expectFail(parseDiscoveryMetadataV1(record, parsedTaxonomy), 'tag_dimension_mismatch');
});

test('discovery metadata rejects malformed capability refs', () => {
  const record = structuredClone(BASE_DISCOVERY);
  record.makeability.capabilityRef = 'capability://unversioned';
  expectFail(parseDiscoveryMetadataV1(record, parsedTaxonomy), 'invalid_capability_ref');
});

test('discovery metadata requires immutable (sha256) asset refs', () => {
  const record = structuredClone(BASE_DISCOVERY);
  record.makeability.assetRefs = ['asset://v0.7.2/look-0001/template@v1.0.0'];
  expectFail(parseDiscoveryMetadataV1(record, parsedTaxonomy), 'invalid_asset_ref');
});

test('discovery metadata rejects malformed evidence refs', () => {
  const record = structuredClone(BASE_DISCOVERY);
  record.makeability.evidenceRefs = ['https://example.com/evidence'];
  expectFail(parseDiscoveryMetadataV1(record, parsedTaxonomy), 'invalid_evidence_ref');
});

test('NEEDS_STYLE_REVIEW is narrowly typed: requires technique:french', () => {
  const record = structuredClone(BASE_DISCOVERY);
  record.styleIds = [];
  record.migration = { state: 'NEEDS_STYLE_REVIEW', legacyStyleIds: ['ST-02'], migratedAt: '2026-08-14T00:00:00.000Z' };
  expectFail(parseDiscoveryMetadataV1(record, parsedTaxonomy), 'needs_style_review_without_french');
  record.techniqueIds = ['technique:french'];
  const ok = parseDiscoveryMetadataV1(record, parsedTaxonomy);
  assert.equal(ok.ok, true, JSON.stringify(ok.ok ? '' : ok.issues).slice(0, 400));
});

test('LEGACY_STYLE_MIGRATED requires at least one overall style', () => {
  const record = structuredClone(BASE_DISCOVERY);
  record.styleIds = [];
  record.migration = { state: 'LEGACY_STYLE_MIGRATED', legacyStyleIds: ['ST-02'], migratedAt: '2026-08-14T00:00:00.000Z' };
  expectFail(parseDiscoveryMetadataV1(record, parsedTaxonomy), 'legacy_migrated_without_style');
});

// ---------------------------------------------------------------------------
// Governance: public eligibility
// ---------------------------------------------------------------------------

test('public eligibility requires style, shape, rights and makeability', () => {
  const record = structuredClone(BASE_DISCOVERY);
  assert.equal(publicationEligibility(record, parsedTaxonomy).eligible, true);

  const noStyle = structuredClone(record);
  noStyle.styleIds = [];
  assert.equal(publicationEligibility(noStyle, parsedTaxonomy).eligible, false);

  const noShape = structuredClone(record);
  noShape.recommendedShapeIds = [];
  assert.equal(publicationEligibility(noShape, parsedTaxonomy).eligible, false);

  const pending = structuredClone(record);
  pending.rights.status = 'PENDING';
  assert.equal(publicationEligibility(pending, parsedTaxonomy).eligible, false);
});

test('the french NEEDS_STYLE_REVIEW exception allows public without style but never a style channel', () => {
  const record = structuredClone(BASE_DISCOVERY);
  record.styleIds = [];
  record.techniqueIds = ['technique:french'];
  record.migration = { state: 'NEEDS_STYLE_REVIEW', legacyStyleIds: ['ST-02'], migratedAt: '2026-08-14T00:00:00.000Z' };
  assert.equal(legacyStyleReviewExceptionApplies(record, parsedTaxonomy), true);
  const result = publicationEligibility(record, parsedTaxonomy);
  assert.equal(result.eligible, true);
  assert.equal(result.legacyExceptionApplied, true);
  assert.equal(styleChannelEligible(record, parsedTaxonomy), false);

  const withStyle = structuredClone(record);
  withStyle.styleIds = ['style:classic-refined'];
  assert.equal(legacyStyleReviewExceptionApplies(withStyle, parsedTaxonomy), false);
  assert.equal(styleChannelEligible(withStyle, parsedTaxonomy), true);
});

test('PERSONAL_USE_ONLY is public but disallows commercial/remix actions', () => {
  const record = structuredClone(BASE_DISCOVERY);
  record.rights.status = 'PERSONAL_USE_ONLY';
  assert.equal(publicationEligibility(record, parsedTaxonomy).eligible, true);
  const permissions = actionPermissions(record);
  assert.equal(permissions.public, true);
  assert.equal(permissions.commercial, false);
  assert.equal(permissions.remix, false);

  const pending = structuredClone(record);
  pending.rights.status = 'PENDING';
  const pendingPermissions = actionPermissions(pending);
  assert.equal(pendingPermissions.public, false);
  assert.equal(pendingPermissions.commercial, false);
  assert.equal(pendingPermissions.remix, false);
});

// ---------------------------------------------------------------------------
// Governance: fail-closed current-makeable
// ---------------------------------------------------------------------------

test('current-makeable is fail-closed and never infers from application/verification levels', () => {
  const record = structuredClone(BASE_DISCOVERY);
  assert.equal(isCurrentMakeable(record), true);

  const concept = structuredClone(record);
  concept.makeability.classification = 'CONCEPT_ONLY';
  assert.equal(isCurrentMakeable(concept), false);

  const noCapability = structuredClone(record);
  delete noCapability.makeability.capabilityRef;
  assert.equal(isCurrentMakeable(noCapability), false);

  const noAssets = structuredClone(record);
  noAssets.makeability.assetRefs = [];
  assert.equal(isCurrentMakeable(noAssets), false);

  const noEvidence = structuredClone(record);
  noEvidence.makeability.evidenceRefs = [];
  assert.equal(isCurrentMakeable(noEvidence), false);

  const brokenRef = structuredClone(record);
  brokenRef.makeability.evidenceRefs = ['evidence://broken'];
  assert.equal(isCurrentMakeable(brokenRef), false);

  // Legacy fields claiming production readiness must never flip the verdict.
  const legacyInferenceAttempt = structuredClone(record);
  legacyInferenceAttempt.makeability = { classification: 'MACHINE_DIRECT' };
  legacyInferenceAttempt.applicationLevel = 'REPRODUCIBLE';
  legacyInferenceAttempt.verificationLevel = 'PRODUCTION_VERIFIED';
  assert.equal(isCurrentMakeable(legacyInferenceAttempt), false);
});

test('makeable channel requires both fail-closed makeability and public rights', () => {
  const record = structuredClone(BASE_DISCOVERY);
  assert.equal(makeableChannelEligible(record), true);
  const pending = structuredClone(record);
  pending.rights.status = 'PENDING';
  assert.equal(makeableChannelEligible(pending), false);
  const concept = structuredClone(record);
  concept.makeability.classification = 'CONCEPT_ONLY';
  assert.equal(makeableChannelEligible(concept), false);
});

// ---------------------------------------------------------------------------
// Curation metadata (separate contract)
// ---------------------------------------------------------------------------

const BASE_CURATION = {
  schemaVersion: 1,
  contractRef: 'COMM-v0.7.2-TAX-01',
  subjectRef: { kind: 'PUBLISHED_LOOK', id: 'look:community-0001' },
  curated: true,
  curatedBy: 'operator:community-team',
  curatedAt: '2026-08-14T00:00:00.000Z',
  campaignTags: ['spring-2026'],
  featuredChannels: ['editorial'],
  evidenceRefs: ['evidence://v0.7.2/look-0001/curation@v1.0.0'],
};

test('curation metadata parses when fully valid and stays separate from discovery', () => {
  const result = parseCurationMetadataV1(BASE_CURATION);
  assert.equal(result.ok, true, JSON.stringify(result.ok ? '' : result.issues).slice(0, 400));
  const curated = result.value;
  assert.equal(curated.curated, true);
  assert.equal('styleIds' in curated, false, 'curation must not carry discovery fields');
});

test('curation metadata rejects unknown channels and relationship-driven channels', () => {
  const unknown = structuredClone(BASE_CURATION);
  unknown.featuredChannels = ['nope'];
  expectFail(parseCurationMetadataV1(unknown), 'unknown_featured_channel');

  const following = structuredClone(BASE_CURATION);
  following.featuredChannels = ['following'];
  expectFail(parseCurationMetadataV1(following), 'featured_relationship_channel');
});

test('curated records must declare actor and timestamp', () => {
  const record = structuredClone(BASE_CURATION);
  delete record.curatedBy;
  expectFail(parseCurationMetadataV1(record), 'curation_missing_actor');
});

test('curation cannot make a PENDING-rights record public', () => {
  const record = structuredClone(BASE_DISCOVERY);
  record.rights.status = 'PENDING';
  const curation = structuredClone(BASE_CURATION);
  const result = curationPublicEligibility(record, curation, parsedTaxonomy);
  assert.equal(result.eligible, false);
});

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

if (failed > 0) {
  console.error(`[test:community-taxonomy-v2] ${failed} FAILED, ${passed} passed`);
  for (const failure of failures) console.error(`\nFAIL: ${failure}`);
  process.exit(1);
}
console.log(`[test:community-taxonomy-v2] PASS (${passed} assertions)`);
