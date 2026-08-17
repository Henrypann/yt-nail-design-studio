#!/usr/bin/env node
/**
 * COMM-V7.1-05A/05B · Creator publication domain contract tests.
 *
 * 05A (V1 store): three-step PRIVATE/UNLISTED publish and creator states.
 *
 * 05B (COMM-v0.7.2-TAX-02 Store V2):
 *  - V1 -> V2 pure upcast and repeated parse stability; original input never
 *    mutated; corrupt V1/V2 rejected with no invented discovery;
 *  - orphan / subject-mismatch discovery envelopes rejected;
 *  - discovery changes bump contentRevision exactly once; unchanged discovery
 *    patches (and non-review metadata) do not;
 *  - PUBLIC with unresolved / empty discovery fails closed;
 *  - valid structured discovery plus governance clearance publishes an exact
 *    discovery/curation envelope snapshot;
 *  - an old V1 PUBLIC look without a discovery envelope fails closed from the
 *    creator public read-model projection (typed ENVELOPE_MISSING diagnostic);
 *  - stored V2 envelopes that are structurally valid but fail the read-time
 *    gate (PENDING rights; legacy NEEDS_STYLE_REVIEW migration state) are
 *    blocked with a typed PUBLIC_GATE_BLOCKED diagnostic.
 */

import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import {
  createCreatorPublicationDraftV1, createEmptyCreatorPublicationStoreV1,
  parseCreatorPublicationStoreV1, publishCreatorDraftV1, setCreatorLookHiddenV1,
  updateCreatorPublicationDraftV1,
} from '../src/community/domain/v7_1/creator-publication.ts';
import {
  buildCreatorDiscoveryEnvelopeV2,
  createCreatorPublicationDraftV2,
  createEmptyCreatorPublicationStoreV2,
  creatorDiscoveryResolutionReasonsV2,
  emptyDiscoveryAuthoringV2,
  parseCreatorPublicationStoreV2,
  publishCreatorDraftV2,
  upcastCreatorPublicationStoreV1,
  updateCreatorPublicationDraftV2,
} from '../src/community/domain/v7_1/creator-publication-v2.ts';
import { parseCommunityTaxonomyV2 } from '../src/community/domain/taxonomy-v2/parse.ts';
import { buildPublishPackageV1, createDeterministicPublishIdFactoryV1 } from '../src/studio/publishing/index.ts';
import { CANONICAL_USE_DEMO_RELEASE_RECORD_V1 } from '../src/integration/community-studio/canonical-use-demo.ts';

const hash = async (bytes) => createHash('sha256').update(bytes).digest('hex');
const render = { rendererId: 'test.2d', render: (request) => ({ ok: true, output: { bytes: new TextEncoder().encode(`${request.kind}:${request.finger ?? 'cover'}`), mimeType: 'image/png', width: request.width, height: request.height, colorSpace: 'srgb', fidelity: 'EXACT' } }) };
const pkgResult = await buildPublishPackageV1(CANONICAL_USE_DEMO_RELEASE_RECORD_V1, { rendererRevision:'test-v1', renderer3d:render, renderer2d:render, sha256:hash, nextAssetId:createDeterministicPublishIdFactoryV1(), resolveGeometry:()=>({status:'resolved',shapeId:'almond',lengthId:'medium'}) });
assert.equal(pkgResult.ok, true);
const pkg = pkgResult.package;
const now = '2026-08-12T12:00:00.000Z';

// ---------------------------------------------------------------------------
// 05A · V1 store: three-step PRIVATE/UNLISTED publish and creator states
// ---------------------------------------------------------------------------
let store = createEmptyCreatorPublicationStoreV1();
const created = createCreatorPublicationDraftV1({store,draftId:'draft.alpha',creatorProfileId:'profile.creator',package:pkg,now});
assert.equal(created.ok,true); store=created.value;
assert.ok(parseCreatorPublicationStoreV1(store),'an untitled new draft must be persistable before metadata entry');
assert.equal(store.drafts[0].visibility,'PRIVATE'); assert.equal(store.drafts[0].step,1);
const sourcePackage = structuredClone(pkg); store.drafts[0].package.palette.push('#ffffff'); assert.deepEqual(pkg,sourcePackage,'draft must not share package refs');
store.drafts[0].package = structuredClone(pkg);

const publicAttempt = updateCreatorPublicationDraftV1({store,draftId:'draft.alpha',patch:{visibility:'PUBLIC'},now});
assert.equal(publicAttempt.ok,false); assert.equal(publicAttempt.code,'public_locked');
const publicAllowed = updateCreatorPublicationDraftV1({store,draftId:'draft.alpha',patch:{title:'Public Petal',visibility:'PUBLIC'},now,publicGovernanceCleared:true}); assert.equal(publicAllowed.ok,true); assert.equal(publicAllowed.value.drafts[0].visibility,'PUBLIC');
assert.equal(publicAllowed.value.drafts[0].contentRevision,2,'review-relevant metadata increments content revision exactly once');
let updated = updateCreatorPublicationDraftV1({store,draftId:'draft.alpha',patch:{title:'Private Petal',tags:['petal'],visibility:'UNLISTED',sourceType:'REMIX',sourceAttribution:'look.source#1',copyrightDeclared:true,sourceDeclared:true,step:3},now});
assert.equal(updated.ok,true); store=updated.value;
const published = publishCreatorDraftV1({store,draftId:'draft.alpha',lookId:'look.private-petal',now});
assert.equal(published.ok,true); store=published.value;
assert.equal(store.drafts.length,0); assert.equal(store.looks[0].visibility,'UNLISTED'); assert.equal(store.looks[0].status,'PUBLISHED'); assert.equal(store.looks[0].publicationGate.moderationCleared,false);
assert.ok(parseCreatorPublicationStoreV1(store));
const hidden=setCreatorLookHiddenV1(store,'look.private-petal',true,now); assert.equal(hidden.ok,true); assert.equal(hidden.value.looks[0].status,'HIDDEN');
const restored=setCreatorLookHiddenV1(hidden.value,'look.private-petal',false,now); assert.equal(restored.ok,true); assert.equal(restored.value.looks[0].status,'PUBLISHED');

const malformed=structuredClone(store); malformed.drafts=[]; malformed.looks[0].customerId='leak'; assert.equal(parseCreatorPublicationStoreV1(malformed),null);
console.log('[COMM-V7.1-05A] three-step PRIVATE/UNLISTED publish and creator states: PASS');

// ---------------------------------------------------------------------------
// 05B · COMM-v0.7.2-TAX-02 Store V2
// ---------------------------------------------------------------------------

// --- V1 -> V2 pure upcast, repeated parse stability, no mutation -----------
const v1Snapshot = JSON.stringify(store);
const upcast = upcastCreatorPublicationStoreV1(store);
assert.equal(upcast.schemaVersion, 2);
assert.equal(upcast.kind, 'CREATOR_PUBLICATION_STORE');
assert.deepEqual(upcast.looks, store.looks, 'upcast preserves every published look value');
assert.deepEqual(upcast.discovery, {}, 'upcast invents NO discovery envelope for V1 looks');
assert.deepEqual(upcast.drafts, [], 'upcast preserves drafts');
assert.equal(JSON.stringify(store), v1Snapshot, 'upcast must never mutate its V1 input');
assert.ok(parseCreatorPublicationStoreV1(store), 'V1 input stays a valid V1 store');

const parsedUpcast = parseCreatorPublicationStoreV2(store);
assert.ok(parsedUpcast, 'parseCreatorPublicationStoreV2 accepts valid V1 via pure upcast');
assert.deepEqual(parsedUpcast, upcast, 'parse-upcast equals explicit upcast');
const reparsedUpcast = parseCreatorPublicationStoreV2(parsedUpcast);
assert.ok(reparsedUpcast, 'repeated V2 parse stays stable');
assert.deepEqual(reparsedUpcast, parsedUpcast, 'repeated parse is idempotent');
assert.equal(JSON.stringify(store), v1Snapshot, 'parse/upcast must never mutate the V1 input');

// --- corrupt V1 / V2 rejected; no invented discovery -----------------------
const corruptV1 = structuredClone(store); corruptV1.extra = true;
assert.equal(parseCreatorPublicationStoreV2(corruptV1), null, 'corrupt V1 store rejected');
const corruptV1Look = structuredClone(store); corruptV1Look.looks[0].customerId = 'leak';
assert.equal(parseCreatorPublicationStoreV2(corruptV1Look), null, 'corrupt V1 look rejected');

let v2Store = createEmptyCreatorPublicationStoreV2();
const v2Created = createCreatorPublicationDraftV2({ store: v2Store, draftId: 'draft.v2.alpha', creatorProfileId: 'profile.creator', package: pkg, now });
assert.equal(v2Created.ok, true); v2Store = v2Created.value;
assert.equal(v2Store.drafts[0].contentRevision, 1);
assert.deepEqual(v2Store.drafts[0].discovery, emptyDiscoveryAuthoringV2(), 'new V2 drafts start with unset discovery authoring');
const corruptV2 = structuredClone(v2Store);
corruptV2.drafts[0].discovery.styleIds = 'not-an-array';
assert.equal(parseCreatorPublicationStoreV2(corruptV2), null, 'corrupt V2 draft discovery rejected');
const corruptV2Unknown = structuredClone(v2Store);
corruptV2Unknown.drafts[0].discovery.bogus = 1;
assert.equal(parseCreatorPublicationStoreV2(corruptV2Unknown), null, 'unknown V2 draft discovery key rejected');

// A store with a published look but NO envelope entry parses with no invented
// discovery (the fail-closed projection path is exercised separately below).
const upcastNoEnvelope = parseCreatorPublicationStoreV2(store);
assert.ok(upcastNoEnvelope);
assert.deepEqual(upcastNoEnvelope.discovery, {}, 'published V1 look parses with no invented discovery entry');

// --- orphan / subject-mismatch envelopes rejected --------------------------
const withLook = createEmptyCreatorPublicationStoreV2();
const withLookDraft = createCreatorPublicationDraftV2({ store: withLook, draftId: 'draft.v2.envelope', creatorProfileId: 'profile.creator', package: pkg, now });
assert.equal(withLookDraft.ok, true);
let envelopeStore = updateCreatorPublicationDraftV2({
  store: withLookDraft.value, draftId: 'draft.v2.envelope',
  patch: { title: 'Envelope Look', visibility: 'PUBLIC', copyrightDeclared: true, sourceDeclared: true, step: 3 },
  now, publicGovernanceCleared: true,
});
assert.equal(envelopeStore.ok, true);
envelopeStore = updateCreatorPublicationDraftV2({
  store: envelopeStore.value, draftId: 'draft.v2.envelope',
  patch: {
    discovery: {
      styleIds: ['style:minimal-clean'], recommendedShapeIds: ['shape:almond'],
      sceneIds: [], themeIds: [], techniqueIds: [], lengthIds: ['length:medium'],
      rights: 'ORIGINAL', makeability: 'CONCEPT_ONLY',
    },
  },
  now,
});
assert.equal(envelopeStore.ok, true);
envelopeStore = publishCreatorDraftV2({ store: envelopeStore.value, draftId: 'draft.v2.envelope', lookId: 'look.v2.envelope', now, publicGovernanceCleared: true });
assert.equal(envelopeStore.ok, true);
assert.ok(envelopeStore.value.discovery['look.v2.envelope'], 'published look snapshots its envelope');
const orphanEnvelope = structuredClone(envelopeStore.value);
orphanEnvelope.discovery['look.orphan'] = structuredClone(envelopeStore.value.discovery['look.v2.envelope']);
assert.equal(parseCreatorPublicationStoreV2(orphanEnvelope), null, 'orphan discovery envelope rejected');
const subjectMismatch = structuredClone(envelopeStore.value);
subjectMismatch.discovery['look.v2.envelope'] = structuredClone(envelopeStore.value.discovery['look.v2.envelope']);
subjectMismatch.discovery['look.v2.envelope'].discovery.subjectRef.id = 'look:wrong';
assert.equal(parseCreatorPublicationStoreV2(subjectMismatch), null, 'subject-mismatch discovery envelope rejected');

// --- discovery changes bump contentRevision; unchanged patches do not ------
const discoveryPatch = {
  styleIds: ['style:minimal-clean'],
  recommendedShapeIds: ['shape:almond'],
  sceneIds: [], themeIds: [], techniqueIds: [], lengthIds: ['length:medium'],
  rights: 'ORIGINAL',
  makeability: 'CONCEPT_ONLY',
};
let v2Updated = updateCreatorPublicationDraftV2({ store: v2Store, draftId: 'draft.v2.alpha', patch: { title: 'V2 Public Petal', visibility: 'UNLISTED', copyrightDeclared: true, sourceDeclared: true, step: 3 }, now });
assert.equal(v2Updated.ok, true); v2Store = v2Updated.value;
assert.equal(v2Store.drafts[0].contentRevision, 2, 'review metadata bumps contentRevision');
v2Updated = updateCreatorPublicationDraftV2({ store: v2Store, draftId: 'draft.v2.alpha', patch: { discovery: discoveryPatch }, now });
assert.equal(v2Updated.ok, true); v2Store = v2Updated.value;
assert.equal(v2Store.drafts[0].contentRevision, 3, 'a discovery change bumps contentRevision exactly once');
const unchangedDiscovery = updateCreatorPublicationDraftV2({ store: v2Store, draftId: 'draft.v2.alpha', patch: { discovery: structuredClone(discoveryPatch) }, now });
assert.equal(unchangedDiscovery.ok, true);
assert.equal(unchangedDiscovery.value.drafts[0].contentRevision, 3, 'an unchanged discovery patch does not bump contentRevision');
const stepOnly = updateCreatorPublicationDraftV2({ store: v2Store, draftId: 'draft.v2.alpha', patch: { step: 2 }, now });
assert.equal(stepOnly.ok, true);
assert.equal(stepOnly.value.drafts[0].contentRevision, 3, 'non-review metadata (step) does not bump contentRevision');

// --- PUBLIC with unresolved / empty discovery fails -------------------------
const taxonomy = parseCommunityTaxonomyV2(JSON.parse(fs.readFileSync(path.join(process.cwd(), 'public/community/taxonomy-v2.json'), 'utf8'))).value;
assert.deepEqual(creatorDiscoveryResolutionReasonsV2(discoveryPatch, taxonomy), [], 'fully structured discovery resolves');
const emptyReasons = creatorDiscoveryResolutionReasonsV2(emptyDiscoveryAuthoringV2(), taxonomy);
assert.ok(emptyReasons.some((reason) => reason.includes('overall style')), 'empty authoring reports missing style');
assert.ok(emptyReasons.some((reason) => reason.includes('recommended shape')), 'empty authoring reports missing shape');
assert.ok(emptyReasons.some((reason) => reason.includes('PENDING')), 'empty authoring reports PENDING rights');
const unresolvedReasons = creatorDiscoveryResolutionReasonsV2({ ...discoveryPatch, styleIds: ['style:nope'] }, taxonomy);
assert.ok(unresolvedReasons.some((reason) => reason.includes('unresolved taxonomy tags')), 'unresolved tags reported');
const pendingRightsReasons = creatorDiscoveryResolutionReasonsV2({ ...discoveryPatch, rights: 'PENDING' }, taxonomy);
assert.ok(pendingRightsReasons.some((reason) => reason.includes('PENDING')), 'PENDING rights reported');

let gateStore = createEmptyCreatorPublicationStoreV2();
let gateCreated = createCreatorPublicationDraftV2({ store: gateStore, draftId: 'draft.v2.gate', creatorProfileId: 'profile.creator', package: pkg, now });
assert.equal(gateCreated.ok, true); gateStore = gateCreated.value;
let gate = updateCreatorPublicationDraftV2({
  store: gateStore, draftId: 'draft.v2.gate',
  patch: { title: 'Gate Look', visibility: 'PUBLIC', copyrightDeclared: true, sourceDeclared: true, step: 3 },
  now, publicGovernanceCleared: true,
});
assert.equal(gate.ok, true); gateStore = gate.value;
const emptyGatePublish = publishCreatorDraftV2({ store: gateStore, draftId: 'draft.v2.gate', lookId: 'look.v2.gate', now, publicGovernanceCleared: true });
assert.equal(emptyGatePublish.ok, false);
assert.equal(emptyGatePublish.code, 'public_gate_incomplete');
assert.match(emptyGatePublish.message, /overall style/);

// --- valid structured discovery + governance publishes an exact envelope ---
gate = updateCreatorPublicationDraftV2({ store: gateStore, draftId: 'draft.v2.gate', patch: { discovery: discoveryPatch }, now });
assert.equal(gate.ok, true); gateStore = gate.value;
const exactEnvelope = buildCreatorDiscoveryEnvelopeV2(gateStore.drafts[0], 'look.v2.gate', now);
const gatePublished = publishCreatorDraftV2({ store: gateStore, draftId: 'draft.v2.gate', lookId: 'look.v2.gate', now, publicGovernanceCleared: true });
assert.equal(gatePublished.ok, true); gateStore = gatePublished.value;
const gateLook = gateStore.looks.find((look) => look.lookId === 'look.v2.gate');
assert.equal(gateLook.visibility, 'PUBLIC');
assert.equal(gateLook.status, 'PUBLISHED');
assert.equal(gateLook.publicationGate.moderationCleared, true);
assert.equal(gateStore.drafts.length, 0, 'publishing removes the draft');
assert.deepEqual(gateStore.discovery['look.v2.gate'].discovery, exactEnvelope.discovery, 'published discovery envelope is exact');
assert.deepEqual(gateStore.discovery['look.v2.gate'].curation, exactEnvelope.curation, 'published curation envelope is exact');
assert.ok(parseCreatorPublicationStoreV2(gateStore), 'published V2 store round-trips the strict parser');
assert.equal(parseCreatorPublicationStoreV2(gateStore).discovery['look.v2.gate'].discovery.subjectRef.id, 'look:look.v2.gate');

// --- old V1 PUBLIC look without discovery fails closed from public browse --
// --- stored V2 envelope read-gate cases (PENDING rights / NEEDS_STYLE_REVIEW)
{
  const v1Public = createEmptyCreatorPublicationStoreV1();
  const v1Draft = createCreatorPublicationDraftV1({ store: v1Public, draftId: 'draft.v1.public', creatorProfileId: 'profile.local-demo.creator', package: pkg, now });
  assert.equal(v1Draft.ok, true);
  const v1WithMetadata = updateCreatorPublicationDraftV1({
    store: v1Draft.value, draftId: 'draft.v1.public',
    patch: { title: 'Legacy Public Look', visibility: 'PUBLIC', copyrightDeclared: true, sourceDeclared: true, step: 3 },
    now, publicGovernanceCleared: true,
  });
  assert.equal(v1WithMetadata.ok, true);
  const v1Published = publishCreatorDraftV1({ store: v1WithMetadata.value, draftId: 'draft.v1.public', lookId: 'look.v1.public', now, publicGovernanceCleared: true });
  assert.equal(v1Published.ok, true);
  assert.equal(v1Published.value.looks[0].visibility, 'PUBLIC');
  assert.equal(v1Published.value.looks[0].status, 'PUBLISHED');

  const mem = new Map();
  globalThis.localStorage = {
    getItem: (key) => (mem.has(key) ? mem.get(key) : null),
    setItem: (key, value) => mem.set(key, String(value)),
    removeItem: (key) => mem.delete(key),
    clear: () => mem.clear(),
  };
  // The strict read gate loads the taxonomy over fetch('/community/taxonomy-v2.json').
  // Node has no origin for that relative URL, so without a stub the gate fails
  // closed as TAXONOMY_UNAVAILABLE and never exercises the envelope paths.
  // Stub fetch with the already-loaded real taxonomy; throw for anything else.
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    if (String(url).endsWith('/community/taxonomy-v2.json')) {
      return { ok: true, json: async () => taxonomy };
    }
    throw new Error(`unexpected fetch outside the taxonomy fixture: ${url}`);
  };
  try {
    const { StorageKeys, writeEnvelope } = await import('../src/lib/storage.ts');
    const { loadCreatorPublishedLookReadModelsV1 } = await import('../src/integration/community-studio/backend-runtime.ts');
    const loadWithDiagnostics = async () => {
      const diagnostics = [];
      const models = await loadCreatorPublishedLookReadModelsV1({ onDiagnostic: (diagnostic) => diagnostics.push(diagnostic) });
      return { diagnostics, models };
    };

    writeEnvelope(StorageKeys.creatorPublications, v1Published.value);
    const v1Browse = await loadWithDiagnostics();
    assert.equal(v1Browse.models.some((look) => look.lookId === 'look.v1.public'), false, 'V1 PUBLIC look without discovery never surfaces');
    assert.deepEqual(v1Browse.diagnostics, [{ scope: 'creator-look-slice', code: 'ENVELOPE_MISSING', lookId: 'look.v1.public' }]);

    // (a) Stored V2 envelope with PENDING rights: structurally valid store,
    // blocked at the read-time governance gate before any projection.
    const pendingGate = structuredClone(gateStore);
    const pendingGateLook = pendingGate.looks.find((look) => look.lookId === 'look.v2.gate');
    assert.ok(pendingGateLook, 'gate store must contain exactly look.v2.gate');
    pendingGateLook.creatorProfileId = 'profile.local-demo.creator';
    pendingGate.discovery['look.v2.gate'].discovery.rights.status = 'PENDING';
    assert.ok(parseCreatorPublicationStoreV2(pendingGate), 'PENDING-rights V2 store stays structurally valid');
    writeEnvelope(StorageKeys.creatorPublications, pendingGate);
    const pendingBrowse = await loadWithDiagnostics();
    assert.equal(pendingBrowse.diagnostics.length, 1, 'PENDING rights yields exactly one diagnostic');
    assert.equal(pendingBrowse.diagnostics[0].lookId, 'look.v2.gate');
    assert.equal(pendingBrowse.diagnostics[0].code, 'PUBLIC_GATE_BLOCKED');
    const pendingReasons = (pendingBrowse.diagnostics[0].reasons ?? []).join(' ').toLowerCase();
    assert.ok(pendingReasons.includes('pending') || pendingReasons.includes('rights'), `PENDING-rights reasons must mention PENDING/rights, got: "${pendingReasons}"`);

    // (b) Stored V2 envelope in the legacy French NEEDS_STYLE_REVIEW migration
    // state (no overall style): creator content may never use that exception,
    // so the read gate blocks with a legacy-exception reason.
    const reviewGate = structuredClone(gateStore);
    const reviewGateLook = reviewGate.looks.find((look) => look.lookId === 'look.v2.gate');
    assert.ok(reviewGateLook, 'gate store must contain exactly look.v2.gate');
    reviewGateLook.creatorProfileId = 'profile.local-demo.creator';
    const reviewDiscovery = reviewGate.discovery['look.v2.gate'].discovery;
    reviewDiscovery.styleIds = [];
    reviewDiscovery.techniqueIds = ['technique:french'];
    reviewDiscovery.migration.state = 'NEEDS_STYLE_REVIEW';
    reviewDiscovery.migration.legacyStyleIds = ['ST-02'];
    assert.ok(parseCreatorPublicationStoreV2(reviewGate), 'NEEDS_STYLE_REVIEW V2 store stays structurally valid');
    writeEnvelope(StorageKeys.creatorPublications, reviewGate);
    const reviewBrowse = await loadWithDiagnostics();
    assert.equal(reviewBrowse.diagnostics.length, 1, 'NEEDS_STYLE_REVIEW yields exactly one diagnostic');
    assert.equal(reviewBrowse.diagnostics[0].lookId, 'look.v2.gate');
    assert.equal(reviewBrowse.diagnostics[0].code, 'PUBLIC_GATE_BLOCKED');
    const reviewReasons = (reviewBrowse.diagnostics[0].reasons ?? []).join(' ').toLowerCase();
    assert.ok(reviewReasons.includes('needs_style_review') || reviewReasons.includes('legacy'), `NEEDS_STYLE_REVIEW reasons must mention NEEDS_STYLE_REVIEW/legacy, got: "${reviewReasons}"`);
  } finally {
    globalThis.fetch = originalFetch;
  }
  console.log('[COMM-V7.1-05B] store v2 upcast/parse/revision/discovery gate/envelope/fail-closed projection: PASS');
}
