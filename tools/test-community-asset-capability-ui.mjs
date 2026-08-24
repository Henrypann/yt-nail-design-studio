#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import {
  getCommunityLookAssetCapabilityV1,
  loadCommunityAssetCapabilitiesV1,
} from '../src/community/data/asset-capability-repository.ts';

const root = process.cwd();
const readJson = (relative) => JSON.parse(fs.readFileSync(path.join(root, relative), 'utf8'));
const fixtures = {
  '/community/taxonomy-v2.json': readJson('public/community/taxonomy-v2.json'),
  '/community/migration-manifest-v1.json': readJson('public/community/migration-manifest-v1.json'),
  '/community/asset-capability-evidence-v1.json': readJson('public/community/asset-capability-evidence-v1.json'),
};

const originalFetch = globalThis.fetch;
function installFetch(overrides = {}) {
  globalThis.fetch = async (input) => {
    const url = typeof input === 'string' ? input : input.url;
    if (overrides[url] === 'NETWORK_ERROR') throw new Error('offline');
    if (overrides[url] === 'HTTP_500') return new Response('', { status: 500 });
    const value = url in overrides ? overrides[url] : fixtures[url];
    if (value === undefined) return new Response('', { status: 404 });
    return new Response(JSON.stringify(value), { status: 200, headers: { 'content-type': 'application/json' } });
  };
}

try {
  installFetch();
  const loaded = await loadCommunityAssetCapabilitiesV1();
  assert.equal(loaded.ok, true, JSON.stringify(loaded.ok ? '' : loaded.issues));
  assert.equal(loaded.index.entries.length, 24);
  assert.equal(loaded.index.entries.filter((entry) => entry.cta === 'USE_VERSIONED').length, 5);
  assert.equal(loaded.index.entries.filter((entry) => entry.cta === 'USE_LEGACY_APPROXIMATE').length, 2);
  assert.equal(loaded.index.entries.filter((entry) => entry.currentMakeable).length, 0);

  const legacy = await getCommunityLookAssetCapabilityV1('cc_mercury_dew');
  assert.equal(legacy.capabilityState, 'LEGACY_APPROXIMATE');
  assert.equal(legacy.cta, 'USE_LEGACY_APPROXIMATE');
  const incomplete = await getCommunityLookAssetCapabilityV1('cc_liquid_chrome_statement');
  assert.equal(incomplete.capabilityState, 'ASSETS_INCOMPLETE');
  assert.equal(incomplete.cta, 'VIEW_ONLY');
  const unavailable = await getCommunityLookAssetCapabilityV1('cc_petal_pearl_bloom');
  assert.equal(unavailable.capabilityState, 'UNAVAILABLE');
  assert.equal(unavailable.cta, 'UNAVAILABLE');
  assert.equal(await getCommunityLookAssetCapabilityV1('look.unknown'), null);

  const forged = structuredClone(fixtures['/community/asset-capability-evidence-v1.json']);
  forged.find((entry) => entry.contentId === 'look.v7-1.petal-veil').designVersionRef.editorDocSha256 = '1'.repeat(64);
  installFetch({ '/community/asset-capability-evidence-v1.json': forged });
  const forgedResult = await loadCommunityAssetCapabilitiesV1();
  assert.equal(forgedResult.ok, false);
  assert.ok(forgedResult.issues.some((issue) => issue.code === 'editor_doc_sha_mismatch'));

  installFetch({ '/community/asset-capability-evidence-v1.json': 'HTTP_500' });
  const httpFailure = await loadCommunityAssetCapabilitiesV1();
  assert.deepEqual(httpFailure, {
    ok: false,
    issues: [{ code: 'fixture_fetch_failed', path: '$', message: 'community asset capability fixture fetch failed' }],
  });
  installFetch({ '/community/taxonomy-v2.json': 'NETWORK_ERROR' });
  const networkFailure = await loadCommunityAssetCapabilitiesV1();
  assert.deepEqual(networkFailure, {
    ok: false,
    issues: [{ code: 'fixture_unavailable', path: '$', message: 'community asset capability fixture is unavailable' }],
  });

  const pageSource = fs.readFileSync(path.join(root, 'src/community/pages/CommunityLookPage.tsx'), 'utf8');
  assert.doesNotMatch(pageSource, /resolveStudioUseAvailabilityV1|canTryInStudio/,
    'detail CTA must no longer infer capability from legacy application/verification labels');
  assert.match(pageSource, /assetCapability\.cta === 'USE_VERSIONED'/);
  assert.match(pageSource, /assetCapability\.cta === 'USE_LEGACY_APPROXIMATE'/);
  assert.match(pageSource, /community-asset-capability-action-restricted/);

  const cardSource = fs.readFileSync(path.join(root, 'src/community/components/CommunityLookCard.tsx'), 'utf8');
  assert.match(cardSource, /assetCapability\.capabilityState/);
  assert.match(cardSource, /CommunityAssetCapabilityBadge/);
  assert.doesNotMatch(cardSource, /resolveStudioUseAvailabilityV1|applicationLevel/);
  const feedSource = fs.readFileSync(path.join(root, 'src/community/components/CommunityFeed.tsx'), 'utf8');
  assert.match(feedSource, /loadCommunityAssetCapabilitiesV1/);
  assert.match(feedSource, /assetCapability=\{assetCapabilities\.get\(look\.lookId\) \?\? null\}/);

  console.log('test-community-asset-capability-ui: PASS (strict browser loader + fail-closed card/detail CTA; no legacy capability inference)');
} finally {
  globalThis.fetch = originalFetch;
}
