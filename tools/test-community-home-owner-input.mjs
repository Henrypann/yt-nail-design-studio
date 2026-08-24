#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const pack = JSON.parse(fs.readFileSync(path.join(root, 'evidence/pr-community-v0-7-2-asset-04b-input/owner-input-pack-v1.json'), 'utf8'));
assert.deepEqual(Object.keys(pack), [
  'schemaVersion', 'contractRef', 'status', 'generatedFrom', 'selectionPolicy', 'candidates', 'requiredOwnerInput', 'prohibitions',
]);
assert.equal(pack.schemaVersion, 1);
assert.equal(pack.contractRef, 'COMM-v0.7.2-ASSET-04B-INPUT');
assert.equal(pack.status, 'AWAITING_OWNER_SELECTION');
assert.equal(pack.selectionPolicy, 'UNRANKED_GOVERNED_PUBLIC_CANDIDATES');
assert.equal(pack.candidates.length, 15);
assert.deepEqual(pack.candidates.map((candidate) => candidate.contentId), [...pack.candidates.map((candidate) => candidate.contentId)].sort((a, b) => a.localeCompare(b)));
assert.equal(new Set(pack.candidates.map((candidate) => candidate.contentId)).size, 15);
assert.ok(pack.candidates.every((candidate) => candidate.rightsStatus !== 'PENDING'));
assert.ok(pack.candidates.every((candidate) => candidate.currentMakeable === false && candidate.manufacturingValidated === false));
assert.equal(pack.candidates.filter((candidate) => candidate.capabilityState === 'VERSIONED_READY').length, 5);
assert.equal(pack.candidates.filter((candidate) => candidate.capabilityState === 'LEGACY_APPROXIMATE').length, 2);
assert.equal(pack.candidates.filter((candidate) => candidate.capabilityState === 'ASSETS_INCOMPLETE').length, 7);
assert.equal(pack.candidates.filter((candidate) => candidate.capabilityState === 'UNAVAILABLE').length, 1);
assert.deepEqual(pack.requiredOwnerInput, {
  banner: null,
  editorialSelections: [],
  collections: [],
  owner: null,
  reviewedAt: null,
  evidenceRefs: [],
});
assert.deepEqual(pack.prohibitions, [
  'NO_AUTOMATIC_RANKING',
  'NO_TRENDING_OR_PERSONALIZATION_CLAIM',
  'NO_STARTER_SHELF_COPY',
  'NO_MAKEABILITY_OR_MANUFACTURING_UPGRADE',
]);
const serialized = JSON.stringify(pack);
assert.doesNotMatch(serialized, /score|recommendedRank|trendScore|personalizationScore/);

console.log('test-community-home-owner-input: PASS (15 governed public candidates, stable ID order, no ranking/recommendation/manufacturing inference)');
