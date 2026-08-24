import assert from 'node:assert/strict';
import {
  evaluateGeneratedAssetPromotionV1,
  parseGeneratedAssetCandidateV1,
} from '../src/platform/backend/asset-ops-contract.ts';

const ready = {
  schemaVersion: 1,
  candidateId: 'candidate.mercury-dew.cover.1',
  asset: {
    assetId: 'asset.mercury-dew.cover', revision: 1, sha256: 'a'.repeat(64),
    mimeType: 'image/png', byteLength: 4096, width: 1280, height: 720,
    colorSpace: 'srgb', alphaMode: 'OPAQUE',
  },
  intendedSurface: 'STUDIO_WIZARD_COVER',
  evidenceTier: 'CONCEPT',
  generation: {
    method: 'IMAGE_GENERATION', toolId: 'openai.imagegen', toolRevision: '2026-08-21',
    promptRef: 'prompt.mercury-dew.cover.v1', specRef: 'spec.mercury-dew.v1',
    createdAt: '2026-08-21T08:00:00.000Z',
  },
  provenance: {
    sourceRefs: ['source.recipe.mercury-dew'], rightsStatus: 'CLEARED',
    rightsEvidenceRefs: ['evidence.rights.mercury-dew'],
    containsCustomerData: false, containsBrandMarks: false,
  },
  quality: {
    reviewStatus: 'REVIEWED_EDITORIAL', expectedNailCount: 10, observedNailCount: 10,
    noTextLogoWatermark: true, evidenceRefs: ['evidence.qa.mercury-dew.cover'],
  },
  promotion: {
    eligibility: 'VERSIONED_READY', structuredAssetRefs: ['asset.pattern.mercury-dew.v1'],
    preflightEvidenceRefs: ['evidence.preflight.mercury-dew.v1'], limitationCodes: ['concept.cover.not.renderer'],
    rollbackRef: 'asset.mercury-dew.cover.previous',
  },
};

const parsed = parseGeneratedAssetCandidateV1(ready);
assert.ok(parsed);
assert.deepEqual(evaluateGeneratedAssetPromotionV1(parsed), { ok: true, eligibility: 'VERSIONED_READY' });
assert.deepEqual(ready, parsed);

assert.equal(parseGeneratedAssetCandidateV1({ ...ready, unknown: true }), null);
assert.equal(parseGeneratedAssetCandidateV1({ ...ready, asset: { ...ready.asset, sha256: 'bad' } }), null);
assert.equal(parseGeneratedAssetCandidateV1({ ...ready, generation: { ...ready.generation, promptRef: undefined } }), null);
assert.equal(parseGeneratedAssetCandidateV1({ ...ready, provenance: { ...ready.provenance, containsCustomerData: true } }), null);
assert.equal(parseGeneratedAssetCandidateV1({
  ...ready,
  provenance: { ...ready.provenance, containsBrandMarks: true },
}), null);
assert.equal(parseGeneratedAssetCandidateV1({
  ...ready,
  provenance: {
    ...ready.provenance,
    rightsEvidenceRefs: ['evidence.rights.mercury-dew', 'evidence.rights.mercury-dew'],
  },
}), null);
assert.equal(parseGeneratedAssetCandidateV1({
  ...ready,
  quality: { ...ready.quality, unknown: true },
}), null);
assert.equal(parseGeneratedAssetCandidateV1({
  ...ready,
  quality: { ...ready.quality, observedNailCount: 11 },
}), null, 'VERSIONED_READY must fail closed when visible nail count does not match');

const deterministic = structuredClone(ready);
deterministic.generation = {
  method: 'DETERMINISTIC_SCRIPT', toolId: 'nextgen.asset-generator',
  toolRevision: 'rev.1', specRef: 'spec.mercury-dew.v1',
  createdAt: '2026-08-21T08:00:00.000Z',
};
assert.ok(parseGeneratedAssetCandidateV1(deterministic), 'deterministic generation does not require a prompt');

const incomplete = structuredClone(ready);
incomplete.promotion = {
  eligibility: 'ASSETS_INCOMPLETE', structuredAssetRefs: [],
  preflightEvidenceRefs: [], limitationCodes: ['structured.assets.missing'],
};
incomplete.provenance.rightsStatus = 'PENDING';
incomplete.quality.reviewStatus = 'GENERATED_CANDIDATE';
const incompleteParsed = parseGeneratedAssetCandidateV1(incomplete);
assert.ok(incompleteParsed);
assert.deepEqual(evaluateGeneratedAssetPromotionV1(incompleteParsed), {
  ok: false,
  eligibility: 'ASSETS_INCOMPLETE',
  reasons: ['rights_not_cleared', 'editorial_review_incomplete', 'structured_assets_missing', 'preflight_evidence_missing'],
});

const rejected = structuredClone(incomplete);
rejected.provenance.rightsStatus = 'REJECTED';
rejected.quality.reviewStatus = 'REJECTED';
const rejectedParsed = parseGeneratedAssetCandidateV1(rejected);
assert.ok(rejectedParsed);
assert.equal(evaluateGeneratedAssetPromotionV1(rejectedParsed).eligibility, 'UNAVAILABLE');

console.log('asset ops contract: PASS');
