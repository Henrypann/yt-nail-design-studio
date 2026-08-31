#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import {
  parseCommunityHomeMerchandisingConfigV1,
  projectCommunityHomeMerchandisingV1,
} from '../src/community/domain/home-merchandising-v1.ts';
import { buildCommunityLookAssetCapabilityIndexV1 } from '../src/community/domain/asset-capability-v1.ts';
import { parseMigrationManifestV1 } from '../src/community/domain/taxonomy-v2/migration-manifest.ts';
import { parseCommunityTaxonomyV2 } from '../src/community/domain/taxonomy-v2/parse.ts';
import { CANONICAL_USE_DEMO_READ_MODEL_V1 } from '../src/integration/community-studio/canonical-use-demo.ts';
import { FOUR_LOOK_SET_READ_MODELS_V0_7_2 } from '../src/integration/community-studio/v0-7-2-four-look-sets.ts';
import { loadCommunityHomeMerchandisingV1 } from '../src/community/data/home-merchandising-repository.ts';

const root = process.cwd();
const readJson = (relative) => JSON.parse(fs.readFileSync(path.join(root, relative), 'utf8'));
const fixture = readJson('public/community/home-merchandising-v1.json');
const clone = (value) => structuredClone(value);
const expectFailure = (result, code) => {
  assert.equal(result.ok, false, `expected ${code}`);
  assert.ok(result.issues.some((issue) => issue.code === code), JSON.stringify(result.issues));
};

const parsed = parseCommunityHomeMerchandisingConfigV1(fixture);
assert.equal(parsed.ok, true, JSON.stringify(parsed.ok ? '' : parsed.issues));
assert.equal(parsed.value.status, 'AWAITING_INPUT');
assert.equal(JSON.stringify(fixture), JSON.stringify(parsed.value), 'strict parser preserves fixture bytes');
assert.deepEqual(projectCommunityHomeMerchandisingV1({ config: parsed.value, looks: [], capabilities: [] }), {
  state: 'AWAITING_INPUT',
  config: fixture,
});

const unknownKey = clone(fixture);
unknownKey.extra = true;
expectFailure(parseCommunityHomeMerchandisingConfigV1(unknownKey), 'unknown_key');
const unsafeBanner = clone(fixture);
unsafeBanner.status = 'IN_REVIEW';
unsafeBanner.owner = 'team:community';
unsafeBanner.banner = {
  bannerId: 'banner.bad', imageUrl: 'https://example.com/banner.png', href: '//example.com',
  title: { zhCN: '测试', en: 'Test' }, subtitle: { zhCN: '测试', en: 'Test' },
};
expectFailure(parseCommunityHomeMerchandisingConfigV1(unsafeBanner), 'unsafe_url');
const pollutedAwaiting = clone(fixture);
pollutedAwaiting.owner = 'team:community';
expectFailure(parseCommunityHomeMerchandisingConfigV1(pollutedAwaiting), 'awaiting_input_must_be_empty');
const badReview = clone(fixture);
badReview.status = 'IN_REVIEW';
expectFailure(parseCommunityHomeMerchandisingConfigV1(badReview), 'review_state_mismatch');

const published = {
  ...clone(fixture),
  revision: 2,
  status: 'PUBLISHED',
  owner: 'team:community',
  reviewedAt: '2026-08-24T04:00:00.000Z',
  evidenceRefs: ['review:marketing-owner-test-fixture'],
  editorialSelections: [{
    lookId: 'look.v7-1.petal-veil',
    rank: 1,
    reason: { zhCN: '测试用人工编辑理由', en: 'Test-only human editorial reason' },
  }],
  collections: [{
    collectionId: 'collection.test-only',
    title: { zhCN: '测试集合', en: 'Test collection' },
    summary: { zhCN: '仅用于合同测试', en: 'Contract test only' },
    lookIds: ['look.v7-1.petal-veil'],
  }],
};
const publishedParsed = parseCommunityHomeMerchandisingConfigV1(published);
assert.equal(publishedParsed.ok, true, JSON.stringify(publishedParsed.ok ? '' : publishedParsed.issues));
const noEvidence = clone(published);
noEvidence.evidenceRefs = [];
expectFailure(parseCommunityHomeMerchandisingConfigV1(noEvidence), 'publication_evidence_missing');
const duplicate = clone(published);
duplicate.editorialSelections.push(clone(duplicate.editorialSelections[0]));
duplicate.editorialSelections[1].rank = 2;
expectFailure(parseCommunityHomeMerchandisingConfigV1(duplicate), 'duplicate_look_id');

const taxonomy = parseCommunityTaxonomyV2(readJson('public/community/taxonomy-v2.json'));
assert.equal(taxonomy.ok, true);
const migration = parseMigrationManifestV1(readJson('public/community/migration-manifest-v1.json'), taxonomy.value);
assert.equal(migration.ok, true);
const capabilities = buildCommunityLookAssetCapabilityIndexV1(
  readJson('public/community/asset-capability-evidence-v1.json'),
  migration.value,
  [CANONICAL_USE_DEMO_READ_MODEL_V1, ...FOUR_LOOK_SET_READ_MODELS_V0_7_2],
);
assert.equal(capabilities.ok, true);
const ready = projectCommunityHomeMerchandisingV1({
  config: publishedParsed.value,
  looks: [CANONICAL_USE_DEMO_READ_MODEL_V1],
  capabilities: capabilities.value.entries,
});
assert.equal(ready.state, 'READY');
assert.equal(ready.editorialSelections[0].look.lookId, 'look.v7-1.petal-veil');
assert.equal(ready.editorialSelections[0].capability.capabilityState, 'VERSIONED_READY');
assert.equal(ready.collections[0].looks[0].lookId, 'look.v7-1.petal-veil');

const unknownLook = clone(publishedParsed.value);
unknownLook.editorialSelections[0].lookId = 'look.unknown';
unknownLook.collections[0].lookIds = ['look.unknown'];
const unavailable = projectCommunityHomeMerchandisingV1({
  config: unknownLook,
  looks: [CANONICAL_USE_DEMO_READ_MODEL_V1],
  capabilities: capabilities.value.entries,
});
assert.equal(unavailable.state, 'UNAVAILABLE');
assert.ok(unavailable.issues.some((issue) => issue.code === 'look_unavailable'));
assert.ok(unavailable.issues.some((issue) => issue.code === 'capability_unavailable'));

const originalFetch = globalThis.fetch;
try {
  globalThis.fetch = async () => new Response(JSON.stringify(fixture), { status: 200 });
  const loaded = await loadCommunityHomeMerchandisingV1();
  assert.equal(loaded.ok, true);
  assert.equal(loaded.projection.state, 'AWAITING_INPUT');
  globalThis.fetch = async () => new Response('', { status: 500 });
  assert.deepEqual(await loadCommunityHomeMerchandisingV1(), {
    ok: false,
    issues: [{ code: 'fixture_fetch_failed', path: '$', message: 'home merchandising fixture fetch failed' }],
  });
  globalThis.fetch = async () => { throw new Error('offline'); };
  assert.deepEqual(await loadCommunityHomeMerchandisingV1(), {
    ok: false,
    issues: [{ code: 'fixture_unavailable', path: '$', message: 'home merchandising fixture is unavailable' }],
  });
} finally {
  globalThis.fetch = originalFetch;
}

const page = fs.readFileSync(path.join(root, 'src/community/pages/CommunityDiscoverPage.tsx'), 'utf8');
const component = fs.readFileSync(path.join(root, 'src/community/components/CommunityHomeMerchandising.tsx'), 'utf8');
assert.match(page, /CommunityHomeMerchandising/);
assert.match(component, /app\.communityEditorial/);
assert.match(component, /app\.studioOfficialStarters/);
assert.match(component, /app\.humanCuratedNotTrending/);
assert.match(component, /community-home-merchandising-unavailable/);
assert.match(component, /community-home-merchandising-banner-fallback/);
assert.doesNotMatch(component, /editorV7Store|wizardStore|QuickStart|OfficialStarterShelf/);

console.log('test-community-home-merchandising: PASS (strict config, truthful empty/review/published states, governed look/capability refs, fail closed)');
