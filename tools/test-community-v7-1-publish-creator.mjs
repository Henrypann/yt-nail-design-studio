import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  createCreatorPublicationDraftV1, createEmptyCreatorPublicationStoreV1,
  parseCreatorPublicationStoreV1, publishCreatorDraftV1, setCreatorLookHiddenV1,
  updateCreatorPublicationDraftV1,
} from '../src/community/domain/v7_1/creator-publication.ts';
import { buildPublishPackageV1, createDeterministicPublishIdFactoryV1 } from '../src/studio/publishing/index.ts';
import { CANONICAL_USE_DEMO_RELEASE_RECORD_V1 } from '../src/integration/community-studio/canonical-use-demo.ts';

const hash = async (bytes) => createHash('sha256').update(bytes).digest('hex');
const render = { rendererId: 'test.2d', render: (request) => ({ ok: true, output: { bytes: new TextEncoder().encode(`${request.kind}:${request.finger ?? 'cover'}`), mimeType: 'image/png', width: request.width, height: request.height, colorSpace: 'srgb', fidelity: 'EXACT' } }) };
const pkgResult = await buildPublishPackageV1(CANONICAL_USE_DEMO_RELEASE_RECORD_V1, { rendererRevision:'test-v1', renderer3d:render, renderer2d:render, sha256:hash, nextAssetId:createDeterministicPublishIdFactoryV1(), resolveGeometry:()=>({status:'resolved',shapeId:'almond',lengthId:'medium'}) });
assert.equal(pkgResult.ok, true);
const pkg = pkgResult.package;
const now = '2026-08-12T12:00:00.000Z';

let store = createEmptyCreatorPublicationStoreV1();
const created = createCreatorPublicationDraftV1({store,draftId:'draft.alpha',creatorProfileId:'profile.creator',package:pkg,now});
assert.equal(created.ok,true); store=created.value;
assert.equal(store.drafts[0].visibility,'PRIVATE'); assert.equal(store.drafts[0].step,1);
const sourcePackage = structuredClone(pkg); store.drafts[0].package.palette.push('#ffffff'); assert.deepEqual(pkg,sourcePackage,'draft must not share package refs');
store.drafts[0].package = structuredClone(pkg);

const publicAttempt = updateCreatorPublicationDraftV1({store,draftId:'draft.alpha',patch:{visibility:'PUBLIC'},now});
assert.equal(publicAttempt.ok,false); assert.equal(publicAttempt.code,'public_locked');
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
