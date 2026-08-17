#!/usr/bin/env node
/**
 * COMM-v0.7.2-TAX-02 · strict discovery-index load contract tests.
 *
 * Covers:
 *  - shipped taxonomy-v2 + migration-manifest-v1 + content-index strict-load
 *    and the resulting runtime discovery index;
 *  - all 18 content-index ids exactly once; no missing/orphan/blocked entries
 *    beyond the explicitly PUBLIC_BLOCKED records;
 *  - manifest source-class split (18 LEGACY_CONTENT_INDEX, 1 CANONICAL_DEMO,
 *    4 V0_7_2_LOOK_SET, 1 CREATOR_V1_FIXTURE);
 *  - entry legacyStyleIds === discovery.migration.legacyStyleIds for every
 *    entry; a mutated mismatch is rejected with `legacy_style_mismatch`;
 *  - ST-02 records: technique:french, empty styleIds, NEEDS_STYLE_REVIEW and
 *    never style-channel eligible;
 *  - rights-PENDING / PUBLIC_BLOCKED entries never surface publicly;
 *  - all 24 entries are CONCEPT_ONLY and fail closed on current-makeable;
 *  - canonical demo + four-look read-model envelope snapshots deep-equal their
 *    manifest entries;
 *  - strict loader unknown / missing / duplicate / content-mismatch paths fail
 *    closed with typed diagnostics (global issues vs per-record blocked).
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { buildCommunityDiscoveryIndexV1 } from '../src/community/domain/taxonomy-v2/load.ts';
import { parseMigrationManifestV1 } from '../src/community/domain/taxonomy-v2/migration-manifest.ts';
import { parseCommunityTaxonomyV2 } from '../src/community/domain/taxonomy-v2/parse.ts';
import {
  isCurrentMakeable,
  styleChannelEligible,
} from '../src/community/domain/taxonomy-v2/governance.ts';
import { buildLookReadModels } from '../src/community/domain/v7_1/published-look-adapter.ts';
import { withDiscoveryProjectionsV1 } from '../src/community/domain/v7_1/published-look-read-model.ts';
import { CANONICAL_USE_DEMO_READ_MODEL_V1 } from '../src/integration/community-studio/canonical-use-demo.ts';
import { FOUR_LOOK_SET_READ_MODELS_V0_7_2 } from '../src/integration/community-studio/v0-7-2-four-look-sets.ts';

const root = process.cwd();
const readFixture = (rel) => JSON.parse(fs.readFileSync(path.join(root, rel), 'utf8'));
const taxonomyRaw = readFixture('public/community/taxonomy-v2.json');
const manifestRaw = readFixture('public/community/migration-manifest-v1.json');
const contentIndexRaw = readFixture('public/community/content-index.json');

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

function loadResult(input) {
  return buildCommunityDiscoveryIndexV1({
    taxonomyRaw: input?.taxonomyRaw ?? taxonomyRaw,
    manifestRaw: input?.manifestRaw ?? manifestRaw,
    contentIndexRaw: input?.contentIndexRaw ?? contentIndexRaw,
  });
}

// ---------------------------------------------------------------------------
// 1 · Strict load + full manifest coverage
// ---------------------------------------------------------------------------

let load = null;
test('shipped taxonomy-v2 + migration-manifest-v1 + content-index strict-load successfully', () => {
  const taxonomy = parseCommunityTaxonomyV2(taxonomyRaw);
  assert.equal(taxonomy.ok, true, JSON.stringify(taxonomy.ok ? '' : taxonomy.issues).slice(0, 400));
  const parsedManifest = parseMigrationManifestV1(manifestRaw, taxonomy.value);
  assert.equal(parsedManifest.ok, true, JSON.stringify(parsedManifest.ok ? '' : parsedManifest.issues).slice(0, 400));
  load = loadResult();
  assert.equal(load.ok, true, JSON.stringify(load.ok ? '' : load.issues).slice(0, 400));
  if (!load.ok) throw new Error('unreachable');
  assert.equal(load.index.schemaVersion, 1);
  assert.equal(load.index.entries.length, 24);
  assert.deepEqual(load.blocked, [], 'no record is coverage-blocked');
});

test('all 18 content-index ids are present exactly once with no missing/orphan entries', () => {
  assert.ok(load, 'strict load must run first');
  if (!load.ok) throw new Error('unreachable');
  const contentIds = new Set(contentIndexRaw.contents.map((record) => record.contentId));
  assert.equal(contentIds.size, 18, 'fixture has 18 distinct content records');
  const legacyEntries = load.index.entries.filter((entry) => entry.sourceClass === 'LEGACY_CONTENT_INDEX');
  assert.equal(legacyEntries.length, 18);
  for (const record of contentIndexRaw.contents) {
    const entry = load.index.byContentId.get(record.contentId);
    assert.ok(entry, `content record "${record.contentId}" must have a manifest entry`);
    assert.equal(entry.sourceClass, 'LEGACY_CONTENT_INDEX', record.contentId);
    assert.equal(entry.subjectRef.id, `look:${record.contentId}`, record.contentId);
  }
  for (const entry of legacyEntries) {
    assert.ok(contentIds.has(entry.contentId), `manifest entry "${entry.contentId}" must not be an orphan`);
  }
  assert.equal(load.index.byContentId.size, 24, 'every manifest entry is indexed by content id');
});

test('manifest has exactly 24 source entries with the fixed class split', () => {
  const counts = {};
  for (const entry of manifestRaw.entries) {
    counts[entry.sourceClass] = (counts[entry.sourceClass] ?? 0) + 1;
  }
  assert.deepEqual(counts, {
    LEGACY_CONTENT_INDEX: 18,
    CANONICAL_DEMO: 1,
    V0_7_2_LOOK_SET: 4,
    CREATOR_V1_FIXTURE: 1,
  });
});

test('every entry legacyStyleIds equals discovery.migration.legacyStyleIds', () => {
  assert.ok(load, 'strict load must run first');
  if (!load.ok) throw new Error('unreachable');
  for (const entry of load.index.entries) {
    assert.deepEqual(
      [...entry.legacyStyleIds].sort(),
      [...entry.discovery.migration.legacyStyleIds].sort(),
      `${entry.contentId} entry legacyStyleIds must equal discovery.migration.legacyStyleIds`,
    );
  }
});

test('a mutated legacyStyleIds mismatch is rejected with legacy_style_mismatch', () => {
  const raw = structuredClone(manifestRaw);
  const mercury = raw.entries.find((entry) => entry.contentId === 'cc_mercury_dew');
  mercury.discovery.migration.legacyStyleIds = ['ST-01']; // entry still declares ST-01 + ST-10
  const parsed = parseMigrationManifestV1(raw, parseCommunityTaxonomyV2(taxonomyRaw).value);
  assert.equal(parsed.ok, false);
  assert.ok(parsed.issues.some((issue) => issue.code === 'legacy_style_mismatch'), 'typed legacy_style_mismatch issue');
  const result = loadResult({ manifestRaw: raw });
  assert.equal(result.ok, false, 'loader fails closed on manifest drift');
  if (!result.ok) {
    assert.ok(result.issues.some((issue) => issue.code === 'legacy_style_mismatch' && issue.scope === 'manifest'));
  }
});

// ---------------------------------------------------------------------------
// 2 · ST-02 french exception + public-status surface rules
// ---------------------------------------------------------------------------

test('ST-02 records carry technique:french, empty styleIds and NEEDS_STYLE_REVIEW with no style-channel eligibility', () => {
  assert.ok(load, 'strict load must run first');
  if (!load.ok) throw new Error('unreachable');
  const taxonomy = parseCommunityTaxonomyV2(taxonomyRaw).value;
  const st02 = load.index.entries.filter((entry) => entry.legacyStyleIds.includes('ST-02'));
  assert.equal(st02.length, 3, 'cc_petal_veil / cc_petal_pearl_bloom / cc_micro_coquette');
  for (const entry of st02) {
    assert.deepEqual(entry.discovery.styleIds, [], `${entry.contentId} must keep styleIds empty`);
    assert.ok(entry.discovery.techniqueIds.includes('technique:french'), `${entry.contentId} must resolve to technique:french`);
    assert.equal(entry.discovery.migration.state, 'NEEDS_STYLE_REVIEW', entry.contentId);
    assert.equal(entry.publicStatus, 'MANUAL_REVIEW', entry.contentId);
    assert.equal(styleChannelEligible(entry.discovery, taxonomy), false, `${entry.contentId} must never reach a style channel`);
  }
  const demo = load.index.byContentId.get(CANONICAL_USE_DEMO_READ_MODEL_V1.lookId);
  assert.ok(demo, 'canonical demo manifest entry must exist');
  assert.equal(styleChannelEligible(demo.discovery, taxonomy), false, 'french demo must never reach a style channel');
});

test('rights-PENDING entries are PUBLIC_BLOCKED and never surface; public blocked records stay excluded', () => {
  assert.ok(load, 'strict load must run first');
  if (!load.ok) throw new Error('unreachable');
  const taxonomy = parseCommunityTaxonomyV2(taxonomyRaw).value;
  for (const entry of load.index.entries) {
    const pending = entry.discovery.rights.status === 'PENDING';
    assert.equal(
      entry.publicStatus === 'PUBLIC_BLOCKED',
      pending,
      `${entry.contentId} rights PENDING must be PUBLIC_BLOCKED and vice versa`,
    );
  }
  const blocked = load.index.entries.filter((entry) => entry.sourceClass === 'LEGACY_CONTENT_INDEX'
    && entry.publicStatus === 'PUBLIC_BLOCKED');
  assert.equal(blocked.length, 8, '7 demo PUGC + 1 draft gate are the only blocked legacy records');
  for (const entry of blocked) {
    assert.equal(entry.discovery.rights.status, 'PENDING', entry.contentId);
  }
  // Public browse projection (mirror of look-repository filtering): every
  // viewable legacy record carries a non-PENDING rights record and none of
  // the PUBLIC_BLOCKED records surfaces.
  const viewable = buildLookReadModels(contentIndexRaw.contents, 'integration');
  const projected = [];
  for (const model of viewable) {
    const entry = load.index.byContentId.get(model.contentId);
    if (!entry || entry.publicStatus === 'PUBLIC_BLOCKED') continue;
    const withEnvelope = withDiscoveryProjectionsV1(model, {
      subjectRef: entry.subjectRef,
      discovery: entry.discovery,
      curation: entry.curation,
    });
    assert.notEqual(withEnvelope.discovery.rights.status, 'PENDING', model.contentId);
    projected.push(withEnvelope);
  }
  assert.equal(projected.length, 10, 'exactly the 10 non-blocked official records surface publicly');
});

test('all 24 entries are CONCEPT_ONLY and fail closed on current-makeable', () => {
  assert.ok(load, 'strict load must run first');
  if (!load.ok) throw new Error('unreachable');
  for (const entry of load.index.entries) {
    assert.equal(entry.discovery.makeability.classification, 'CONCEPT_ONLY', entry.contentId);
    assert.equal(isCurrentMakeable(entry.discovery), false, `${entry.contentId} must not claim current-makeable`);
  }
});

// ---------------------------------------------------------------------------
// 3 · Read-model envelope lockstep with the manifest
// ---------------------------------------------------------------------------

test('canonical demo and four-look read-model envelopes deep-equal their manifest entries', () => {
  assert.ok(load, 'strict load must run first');
  if (!load.ok) throw new Error('unreachable');
  const byId = new Map(load.index.entries.map((entry) => [entry.contentId, entry]));
  const demoEntry = byId.get(CANONICAL_USE_DEMO_READ_MODEL_V1.lookId);
  assert.ok(demoEntry, 'canonical demo manifest entry must exist');
  assert.deepEqual(CANONICAL_USE_DEMO_READ_MODEL_V1.discovery, demoEntry.discovery, 'demo discovery envelope');
  assert.deepEqual(CANONICAL_USE_DEMO_READ_MODEL_V1.curation, demoEntry.curation, 'demo curation envelope');
  assert.equal(FOUR_LOOK_SET_READ_MODELS_V0_7_2.length, 4);
  for (const model of FOUR_LOOK_SET_READ_MODELS_V0_7_2) {
    const entry = byId.get(model.lookId);
    assert.ok(entry, `${model.lookId} manifest entry must exist`);
    assert.deepEqual(model.discovery, entry.discovery, `${model.lookId} discovery envelope`);
    assert.deepEqual(model.curation, entry.curation, `${model.lookId} curation envelope`);
  }
});

// ---------------------------------------------------------------------------
// 4 · Strict loader fail-closed paths (typed diagnostics)
// ---------------------------------------------------------------------------

test('unknown taxonomy key fails closed with a typed taxonomy issue', () => {
  const raw = structuredClone(taxonomyRaw);
  raw.bogus = true;
  const result = loadResult({ taxonomyRaw: raw });
  assert.equal(result.ok, false, 'unknown taxonomy key must fail the whole load');
  if (!result.ok) {
    assert.ok(result.issues.some((issue) => issue.code === 'unknown_key' && issue.scope === 'taxonomy'));
  }
});

test('unknown manifest key fails closed with a typed manifest issue', () => {
  const raw = structuredClone(manifestRaw);
  raw.bogus = true;
  const result = loadResult({ manifestRaw: raw });
  assert.equal(result.ok, false, 'unknown manifest key must fail the whole load');
  if (!result.ok) {
    assert.ok(result.issues.some((issue) => issue.code === 'unknown_key' && issue.scope === 'manifest'));
  }
});

test('duplicate content id in the content index fails closed with duplicate_content_id', () => {
  const raw = structuredClone(contentIndexRaw);
  raw.contents.push(structuredClone(raw.contents[0]));
  const result = loadResult({ contentIndexRaw: raw });
  assert.equal(result.ok, false, 'duplicate content id must fail the whole load');
  if (!result.ok) {
    assert.ok(result.issues.some((issue) => issue.code === 'duplicate_content_id' && issue.scope === 'content-index'));
  }
});

test('duplicate manifest content id fails closed with a typed manifest issue', () => {
  const raw = structuredClone(manifestRaw);
  const mercury = structuredClone(raw.entries.find((entry) => entry.contentId === 'cc_mercury_dew'));
  mercury.subjectRef = { kind: 'PUBLISHED_LOOK', id: 'look:cc_mercury_dew' };
  raw.entries.push(mercury);
  const result = loadResult({ manifestRaw: raw });
  assert.equal(result.ok, false, 'duplicate manifest content id must fail the whole load');
  if (!result.ok) {
    assert.ok(result.issues.some((issue) => issue.code === 'duplicate_content_id' && issue.scope === 'manifest'));
  }
});

test('a content record missing its manifest entry is blocked per-record and excluded', () => {
  const raw = structuredClone(contentIndexRaw);
  raw.contents.push({
    schemaVersion: 1, contentId: 'cc_no_manifest', contentType: 'LOOK_SET', title: 'orphan record',
    publisherId: 'p', publisherType: 'OFFICIAL', curationStatus: 'NONE',
    cover: { url: '/x.png', kind: 'CANONICAL_RENDER' }, media: [],
    mainStyleId: 'ST-01', subStyleIds: [], occasionIds: [], subjectIds: [], moodIds: [],
    effectIds: [], primaryColorIds: [], recommendedShapes: [], supportedShapes: [],
    notRecommendedShapes: {}, supportedLengths: [], applicationLevel: 'INSPIRATION_ONLY',
    verificationLevel: 'CONCEPT', campaignTags: [], status: 'PUBLISHED', publishedAt: '2026-08-17T00:00:00.000Z',
  });
  const result = loadResult({ contentIndexRaw: raw });
  assert.equal(result.ok, true, 'per-record coverage failures keep the rest of the index loadable');
  if (!result.ok) throw new Error('unreachable');
  const blocked = result.blocked.find((entry) => entry.contentId === 'cc_no_manifest');
  assert.ok(blocked, 'missing record must be reported as blocked');
  assert.equal(blocked.code, 'missing_manifest_entry');
  assert.equal(result.index.byContentId.has('cc_no_manifest'), false, 'blocked record is excluded from the index');
  assert.equal(result.index.entries.length, 24, 'the other 24 manifest entries still load');
});

test('an orphan manifest entry (no content record) is blocked per-record', () => {
  const raw = structuredClone(contentIndexRaw);
  raw.contents = raw.contents.filter((record) => record.contentId !== 'cc_mercury_dew');
  const result = loadResult({ contentIndexRaw: raw });
  assert.equal(result.ok, true);
  if (!result.ok) throw new Error('unreachable');
  const blocked = result.blocked.find((entry) => entry.contentId === 'cc_mercury_dew');
  assert.ok(blocked, 'orphan manifest entry must be reported as blocked');
  assert.equal(blocked.code, 'orphan_manifest_entry');
  assert.equal(result.index.byContentId.has('cc_mercury_dew'), false);
});

test('a content-index record whose styles drift from its manifest entry is blocked with legacy_style_mismatch', () => {
  const raw = structuredClone(contentIndexRaw);
  const mercury = raw.contents.find((record) => record.contentId === 'cc_mercury_dew');
  mercury.mainStyleId = 'ST-09'; // manifest declares ST-01 + ST-10
  const result = loadResult({ contentIndexRaw: raw });
  assert.equal(result.ok, true, 'per-record coverage failures keep the rest of the index loadable');
  if (!result.ok) throw new Error('unreachable');
  const blocked = result.blocked.find((entry) => entry.contentId === 'cc_mercury_dew');
  assert.ok(blocked, 'style drift must be reported as blocked');
  assert.equal(blocked.code, 'legacy_style_mismatch');
  assert.equal(result.index.byContentId.has('cc_mercury_dew'), false, 'drifted record is excluded from the index');
});

test('a subject identity mismatch in the manifest fails closed with subject_ref_mismatch', () => {
  const raw = structuredClone(manifestRaw);
  raw.entries.find((entry) => entry.contentId === 'cc_mercury_dew').subjectRef.id = 'look:other';
  const result = loadResult({ manifestRaw: raw });
  assert.equal(result.ok, false, 'subject identity drift must fail the whole load');
  if (!result.ok) {
    assert.ok(result.issues.some((issue) => issue.code === 'subject_ref_mismatch'));
  }
});

test('rights-PENDING entry that is not PUBLIC_BLOCKED fails closed with rights_pending_not_blocked', () => {
  const raw = structuredClone(manifestRaw);
  raw.entries.find((entry) => entry.contentId === 'cc_pugc_luna_blush').publicStatus = 'MIGRATED';
  const result = loadResult({ manifestRaw: raw });
  assert.equal(result.ok, false, 'PENDING rights must never become public in the manifest');
  if (!result.ok) {
    assert.ok(result.issues.some((issue) => issue.code === 'rights_pending_not_blocked'));
  }
});

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

if (failed > 0) {
  console.error(`[test:community-discovery-migration] ${failed} FAILED, ${passed} passed`);
  for (const failure of failures) console.error(`\nFAIL: ${failure}`);
  process.exit(1);
}
console.log(`[test:community-discovery-migration] PASS (${passed} assertions)`);
