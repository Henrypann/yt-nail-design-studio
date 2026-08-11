#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = process.cwd();
const { adaptLegacyContentToLook } = await import(
  pathToFileURL(path.join(root, 'src/community/domain/v7_1/published-look-adapter.ts')).href
);
const { resolveStudioUseAvailabilityV1 } = await import(
  pathToFileURL(path.join(root, 'src/community/domain/studio-use-availability.ts')).href
);
const { CANONICAL_USE_DEMO_READ_MODEL_V1 } = await import(
  pathToFileURL(path.join(root, 'src/integration/community-studio/canonical-use-demo.ts')).href
);

const index = JSON.parse(fs.readFileSync(path.join(root, 'public/community/content-index.json'), 'utf8'));
const byId = new Map(index.contents.map((content) => [content.contentId, content]));
const adapt = (id) => {
  const result = adaptLegacyContentToLook(byId.get(id));
  assert.equal(result.ok, true, `${id} must adapt`);
  return result.look;
};

assert.deepEqual(resolveStudioUseAvailabilityV1(adapt('cc_mercury_dew')), {
  enabled: true,
  state: 'LEGACY_READY',
});
assert.deepEqual(resolveStudioUseAvailabilityV1(adapt('cc_liquid_chrome_statement')), {
  enabled: false,
  state: 'ASSETS_INCOMPLETE',
});
assert.deepEqual(resolveStudioUseAvailabilityV1(adapt('cc_butter_glaze_quiet')), {
  enabled: false,
  state: 'INSPIRATION_ONLY',
});
assert.deepEqual(resolveStudioUseAvailabilityV1(CANONICAL_USE_DEMO_READ_MODEL_V1), {
  enabled: true,
  state: 'VERSIONED_READY',
});

const approximateReady = structuredClone(adapt('cc_pearl_tide'));
approximateReady.assetRef = structuredClone(adapt('cc_mercury_dew').assetRef);
assert.deepEqual(resolveStudioUseAvailabilityV1(approximateReady), {
  enabled: true,
  state: 'LEGACY_APPROXIMATE',
});

const unavailableVersion = structuredClone(CANONICAL_USE_DEMO_READ_MODEL_V1);
unavailableVersion.sourceLook.status = 'HIDDEN';
assert.deepEqual(resolveStudioUseAvailabilityV1(unavailableVersion), {
  enabled: false,
  state: 'VERSION_UNAVAILABLE',
});

const card = fs.readFileSync(path.join(root, 'src/community/components/CommunityLookCard.tsx'), 'utf8');
assert.match(card, /look-card-use-disabled/);
assert.match(card, /disabled[\s\S]*data-use-state/);
const detail = fs.readFileSync(path.join(root, 'src/community/pages/CommunityLookPage.tsx'), 'utf8');
assert.match(detail, /community-use-disabled/);
assert.match(detail, /Studio 素材尚未补齐/);

console.log('[community-content-states] ready / approximate / incomplete / inspiration / version-unavailable: PASS');
