#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { parseCommunityHomeMerchandisingConfigV1 } from '../src/community/domain/home-merchandising-v1.ts';

const root = process.cwd();
const readJson = (relative) => JSON.parse(fs.readFileSync(path.join(root, relative), 'utf8'));
const pack = readJson('evidence/pr-community-v0-7-2-asset-04b-input/owner-input-pack-v1.json');
const configInput = readJson('public/community/home-merchandising-v1.json');
const candidateIds = new Set(pack.candidates.map((candidate) => candidate.contentId));

function candidateIssues(config) {
  const refs = [
    ...config.editorialSelections.map((selection) => selection.lookId),
    ...config.collections.flatMap((collection) => collection.lookIds),
  ];
  return refs.filter((lookId) => !candidateIds.has(lookId));
}

const parsed = parseCommunityHomeMerchandisingConfigV1(configInput);
assert.equal(parsed.ok, true, parsed.ok ? undefined : JSON.stringify(parsed.issues));
assert.deepEqual(candidateIssues(parsed.value), [], 'owner config may only reference governed input-pack candidates');

if (parsed.value.status === 'AWAITING_INPUT') {
  assert.deepEqual(parsed.value, {
    schemaVersion: 1,
    contractRef: 'COMM-v0.7.2-ASSET-04A',
    revision: 1,
    status: 'AWAITING_INPUT',
    banner: null,
    editorialSelections: [],
    collections: [],
    owner: null,
    reviewedAt: null,
    evidenceRefs: [],
  });
}

const firstCandidate = pack.candidates[0].contentId;
const reviewFixture = {
  ...parsed.value,
  revision: parsed.value.revision + 1,
  status: 'IN_REVIEW',
  owner: 'community.owner',
  editorialSelections: [{
    lookId: firstCandidate,
    rank: 1,
    reason: { zhCN: '人工编辑理由', en: 'Human editorial rationale' },
  }],
};
const parsedReview = parseCommunityHomeMerchandisingConfigV1(reviewFixture);
assert.equal(parsedReview.ok, true, parsedReview.ok ? undefined : JSON.stringify(parsedReview.issues));
assert.deepEqual(candidateIssues(parsedReview.value), []);

const unknownFixture = structuredClone(parsedReview.value);
unknownFixture.editorialSelections[0].lookId = 'look.unknown-owner-injection';
assert.deepEqual(candidateIssues(unknownFixture), ['look.unknown-owner-injection']);

assert.equal(pack.selectionPolicy, 'UNRANKED_GOVERNED_PUBLIC_CANDIDATES');
assert.equal(pack.requiredOwnerInput.owner, null);
assert.deepEqual(pack.requiredOwnerInput.editorialSelections, []);
assert.ok(pack.candidates.every((candidate) => candidate.currentMakeable === false));
assert.ok(pack.candidates.every((candidate) => candidate.manufacturingValidated === false));

console.log(`test-community-home-owner-review: PASS (${parsed.value.status}; ${candidateIds.size} governed candidates; unknown refs fail closed; no publication inference)`);
