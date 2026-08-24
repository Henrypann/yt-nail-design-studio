#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { buildCommunityLookAssetCapabilityIndexV1 } from '../src/community/domain/asset-capability-v1.ts';
import { resolveStudioUseAvailabilityV1 } from '../src/community/domain/studio-use-availability.ts';
import { parseMigrationManifestV1 } from '../src/community/domain/taxonomy-v2/migration-manifest.ts';
import { parseCommunityTaxonomyV2 } from '../src/community/domain/taxonomy-v2/parse.ts';
import { CANONICAL_USE_DEMO_READ_MODEL_V1 } from '../src/integration/community-studio/canonical-use-demo.ts';
import { FOUR_LOOK_SET_READ_MODELS_V0_7_2 } from '../src/integration/community-studio/v0-7-2-four-look-sets.ts';

const root = process.cwd();
const readJson = (relative) => JSON.parse(fs.readFileSync(path.join(root, relative), 'utf8'));
const taxonomy = parseCommunityTaxonomyV2(readJson('public/community/taxonomy-v2.json'));
assert.equal(taxonomy.ok, true, 'taxonomy fixture must parse');
const migration = parseMigrationManifestV1(
  readJson('public/community/migration-manifest-v1.json'),
  taxonomy.value,
);
assert.equal(migration.ok, true, 'migration fixture must parse');
const capabilities = buildCommunityLookAssetCapabilityIndexV1(
  readJson('public/community/asset-capability-evidence-v1.json'),
  migration.value,
  [CANONICAL_USE_DEMO_READ_MODEL_V1, ...FOUR_LOOK_SET_READ_MODELS_V0_7_2],
);
assert.equal(capabilities.ok, true, JSON.stringify(capabilities.ok ? '' : capabilities.issues));
const byId = new Map(capabilities.value.entries.map((entry) => [entry.contentId, entry]));

assert.deepEqual(resolveStudioUseAvailabilityV1(byId.get('cc_mercury_dew')), {
  enabled: true,
  state: 'LEGACY_APPROXIMATE',
});
assert.deepEqual(resolveStudioUseAvailabilityV1(byId.get('cc_liquid_chrome_statement')), {
  enabled: false,
  state: 'ASSETS_INCOMPLETE',
});
assert.deepEqual(resolveStudioUseAvailabilityV1(byId.get('cc_butter_glaze_quiet')), {
  enabled: false,
  state: 'ASSETS_INCOMPLETE',
});
assert.deepEqual(resolveStudioUseAvailabilityV1(byId.get('look.v7-1.petal-veil')), {
  enabled: true,
  state: 'VERSIONED_READY',
});
assert.deepEqual(resolveStudioUseAvailabilityV1(byId.get('cc_petal_pearl_bloom')), {
  enabled: false,
  state: 'UNAVAILABLE',
});
assert.deepEqual(resolveStudioUseAvailabilityV1(null), {
  enabled: false,
  state: 'UNAVAILABLE',
});

const availabilitySource = fs.readFileSync(
  path.join(root, 'src/community/domain/studio-use-availability.ts'),
  'utf8',
);
assert.doesNotMatch(
  availabilitySource,
  /PublishedLookReadModelV1|\.applicationLevel|\.verificationLevel|published-look-read-model/,
);
assert.match(availabilitySource, /CommunityLookAssetCapabilityReadModelV1/);

const card = fs.readFileSync(path.join(root, 'src/community/components/CommunityLookCard.tsx'), 'utf8');
assert.match(card, /look-card-use-disabled/);
assert.match(card, /assetCapability\.capabilityState/);
assert.doesNotMatch(card, /resolveStudioUseAvailabilityV1/);
const detail = fs.readFileSync(path.join(root, 'src/community/pages/CommunityLookPage.tsx'), 'utf8');
assert.match(detail, /community-use-disabled/);
assert.match(detail, /Studio 素材尚未补齐/);
assert.doesNotMatch(detail, /resolveStudioUseAvailabilityV1|canTryInStudio/);

console.log('[community-content-states] explicit versioned / legacy / incomplete / unavailable capability states: PASS');
