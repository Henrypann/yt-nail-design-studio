#!/usr/bin/env node
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = process.cwd();
const fixtures = await import(pathToFileURL(path.join(root,'src/studio/editor/fixtures/editor-doc-v7.mjs')).href);
const releaseApi = await import(pathToFileURL(path.join(root,'src/studio/versioning/design-release.ts')).href);
const intentApi = await import(pathToFileURL(path.join(root,'src/community/domain/v7_1/versioned-studio-intent.ts')).href);
const importApi = await import(pathToFileURL(path.join(root,'src/studio/versioning/versioned-import.ts')).href);
const digest = async (value) => createHash('sha256').update(value).digest('hex');

async function releasedFull() {
  const doc = structuredClone(fixtures.EDITOR_DOC_V7_FULL_FIXTURE);
  let raw = null;
  const result = await releaseApi.releaseSavedEditorDocV7(
    { designId: doc.designId, expectedRevision: doc.revision, runtimeGuard: { saveState:'saved',savedRevision:doc.revision,pendingRevision:null } },
    { storage:{read:()=>raw,write:(value)=>{raw=value;}}, readPersistedEditorDoc:()=>structuredClone(doc), sha256:digest,
      nextId:()=> 'dv.import.source.1', now:()=> '2026-08-11T07:00:00.000Z', releasedByIdentityId:()=> 'idn.creator.source' },
  );
  assert.equal(result.ok,true); if(!result.ok) throw new Error(result.message);
  return result.record;
}

const release = await releasedFull();
const coverAsset = release.designVersion.assetRevisionRefs.find((asset) => asset.mimeType === 'image/png');
assert.ok(coverAsset);
const look = {
  schemaVersion:1, lookId:'look.versioned.import', designVersionId:release.designVersion.designVersionId,
  creatorProfileId:'profile.creator.source', title:'Versioned Look', tags:['versioned'], visibility:'PUBLIC',
  coverPreview:{...coverAsset,kind:'COVER',mimeType:'image/png',width:1024,height:1024,fidelity:'EXACT'},
  detailPreviews:[], summaries:{shapeIds:['almond'],lengthIds:['medium'],palette:['#eeeeee']},
  publicationGate:{copyrightDeclared:true,sourceDeclared:true,moderationCleared:true}, status:'PUBLISHED',
  publishedAt:'2026-08-11T07:01:00.000Z', createdAt:'2026-08-11T07:01:00.000Z',updatedAt:'2026-08-11T07:01:00.000Z',
};

function intentHarness(now=Date.parse('2026-08-11T07:02:00.000Z')) {
  let store = {}; let writes=0; let ids=0;
  const storage={read:()=>structuredClone(store),write:(next)=>{store=structuredClone(next);writes+=1;}};
  const created=intentApi.createVersionedStudioImportIntentV2({look,designVersion:release.designVersion},
    {storage,nextId:()=>`intent.versioned.${++ids}`,nowMs:()=>now});
  assert.equal(created.ok,true); if(!created.ok) throw new Error(created.reason);
  return {storage,created,port:intentApi.createVersionedIntentPortV2(storage,()=>now),get store(){return store;},get writes(){return writes;}};
}

// Strict contract and creation gates.
{
  const h=intentHarness(); const intent=h.created.intent;
  assert.equal(intentApi.parseVersionedStudioImportIntentV2(intent,intent.intentId).ok,true);
  assert.equal(intentApi.parseVersionedStudioImportIntentV2({...intent,editorDoc:{}},intent.intentId).ok,false,'unknown keys reject');
  assert.equal(intentApi.parseVersionedStudioImportIntentV2({...intent,returnTo:'https://evil.test'},intent.intentId).ok,false);
  assert.equal(intentApi.createVersionedStudioImportIntentV2({look:{...look,visibility:'PRIVATE'},designVersion:release.designVersion},{storage:h.storage,nextId:()=> 'x',nowMs:()=>Date.now()}).ok,false);
  assert.equal(intentApi.createVersionedStudioImportIntentV2({look:{...look,status:'DRAFT'},designVersion:release.designVersion},{storage:h.storage,nextId:()=> 'x',nowMs:()=>Date.now()}).ok,false);
  assert.equal(h.port.peek(intent.intentId)?.designVersionId,release.designVersion.designVersionId);
}

function importHarness() {
  const ih=intentHarness(); let writerCalls=0; let createdDoc=null; let id=0; let allow=true; let assetOk=true; let writerOk=true;
  const targetsByIntent=new Map();
  const deps={
    intents:ih.port,getLook:async()=>structuredClone(look),getRelease:async()=>structuredClone(release),canReadLook:async()=>allow,
    assetAvailable:async()=>assetOk,createTarget:async({intentId,doc})=>{writerCalls+=1;if(!writerOk)return{ok:false,message:'quota'};const prior=targetsByIntent.get(intentId);if(prior)return{ok:true,created:false,doc:structuredClone(prior)};createdDoc=structuredClone(doc);targetsByIntent.set(intentId,createdDoc);return{ok:true,created:true,doc:structuredClone(createdDoc)};},
    nextId:(scope)=>`${scope}.fresh.${++id}`,now:()=> '2026-08-11T07:03:00.000Z',
  };
  return {ih,deps,get writerCalls(){return writerCalls;},get createdDoc(){return createdDoc;},setAllow(v){allow=v;},setAsset(v){assetOk=v;},setWriter(v){writerOk=v;},get ids(){return id;}};
}

for (const mode of ['current','cancel']) {
  const h=importHarness(); const beforeIds=h.ids;
  const result=await importApi.consumeVersionedStudioImportV2(h.ih.created.intent.intentId,mode,h.deps);
  assert.equal(result.ok&&result.created===false,true,`${mode} keeps current`);
  assert.equal(h.writerCalls,0); assert.equal(h.ids,beforeIds); assert.equal(h.ih.port.peek(h.ih.created.intent.intentId),null);
}

// New creates one independent valid V7, strips private refs and returns event only after success.
{
  const h=importHarness(); const intentId=h.ih.created.intent.intentId;
  const sourceSnapshot=JSON.stringify(release.editorDocSnapshot);
  const result=await importApi.consumeVersionedStudioImportV2(intentId,'new',h.deps);
  assert.equal(result.ok&&result.created,true); if(!result.ok||!result.created) throw new Error(result.message);
  assert.equal(h.writerCalls,1); assert.equal(result.event.event,'look_customize'); assert.equal(result.event.targetDesignId,result.doc.designId);
  assert.equal(result.event.eventId,intentId,'event is idempotent by intent');
  assert.equal(result.doc.schemaVersion,7); assert.equal(result.doc.revision,1); assert.equal(result.doc.customerRef,undefined);
  assert.deepEqual(result.doc.communicationRefs,[]); assert.equal(result.doc.compositionMeta,undefined);
  assert.deepEqual(result.doc.sourceRefs,[{domain:'community',sourceId:look.lookId,revision:release.designVersion.designVersionId}]);
  assert.equal(h.ih.port.peek(intentId),null,'success clears exact intent');
  assert.equal(JSON.stringify(release.editorDocSnapshot),sourceSnapshot,'source immutable');
  assert.notStrictEqual(result.doc.nails,release.editorDocSnapshot.nails);
  const sourceIds=[]; const targetIds=[];
  for(const nail of Object.values(release.editorDocSnapshot.nails)){for(const step of nail.steps){sourceIds.push(step.id);if(step.kind==='flat_design')sourceIds.push(...step.elements.map(x=>x.id));if(step.kind==='dimensional_decoration')sourceIds.push(...step.decorations.map(x=>x.id));}}
  for(const nail of Object.values(result.doc.nails)){assert.equal(nail.compositionProvenance,undefined);for(const step of nail.steps){targetIds.push(step.id);if(step.kind==='flat_design')targetIds.push(...step.elements.map(x=>x.id));if(step.kind==='dimensional_decoration')targetIds.push(...step.decorations.map(x=>x.id));}}
  assert.equal(targetIds.some(id=>sourceIds.includes(id)),false,'all node IDs fresh'); assert.equal(new Set(targetIds).size,targetIds.length,'target IDs unique');
  assert.deepEqual(Object.values(result.doc.recipeInstances).map(x=>x.instanceId),Object.keys(result.doc.recipeInstances),'recipe keys remapped');
}

// Permission/asset/authority failures happen before IDs/writer; permission clears, retryable failures retain.
{
  const h=importHarness(); h.setAllow(false); const before=h.ids;
  const r=await importApi.consumeVersionedStudioImportV2(h.ih.created.intent.intentId,'new',h.deps);
  assert.equal(r.ok,false); if(!r.ok)assert.equal(r.reason,'permission'); assert.equal(h.ids,before);assert.equal(h.writerCalls,0);assert.equal(h.ih.port.peek(h.ih.created.intent.intentId),null);
}
{
  const h=importHarness(); h.setAsset(false); const before=h.ids;
  const r=await importApi.consumeVersionedStudioImportV2(h.ih.created.intent.intentId,'new',h.deps);
  assert.equal(r.ok,false);if(!r.ok)assert.equal(r.reason,'asset_unavailable');assert.equal(h.ids,before);assert.equal(h.writerCalls,0);assert.ok(h.ih.port.peek(h.ih.created.intent.intentId));
}
{
  const h=importHarness(); h.setWriter(false);
  const r=await importApi.consumeVersionedStudioImportV2(h.ih.created.intent.intentId,'new',h.deps);
  assert.equal(r.ok,false);if(!r.ok)assert.equal(r.reason,'write_failed');assert.equal(h.writerCalls,1);assert.ok(h.ih.port.peek(h.ih.created.intent.intentId),'writer failure retains intent');
}
{
  const h=importHarness(); h.deps.nextId=()=> 'duplicate';
  const r=await importApi.consumeVersionedStudioImportV2(h.ih.created.intent.intentId,'new',h.deps);
  assert.equal(r.ok,false);if(!r.ok)assert.equal(r.reason,'id_collision');assert.equal(h.writerCalls,0);
}

// Dependency failures are reported, never thrown, and do not write a target.
{
  const h=importHarness(); h.deps.canReadLook=async()=>{throw new Error('offline')};
  const r=await importApi.consumeVersionedStudioImportV2(h.ih.created.intent.intentId,'new',h.deps);
  assert.equal(r.ok,false);if(!r.ok)assert.equal(r.reason,'dependency');assert.equal(h.writerCalls,0);
}
{
  const h=importHarness(); h.deps.createTarget=async()=>{throw new Error('quota')};
  const r=await importApi.consumeVersionedStudioImportV2(h.ih.created.intent.intentId,'new',h.deps);
  assert.equal(r.ok,false);if(!r.ok)assert.equal(r.reason,'write_failed');assert.ok(h.ih.port.peek(h.ih.created.intent.intentId));
}
{
  const h=importHarness(); h.deps.now=()=>{throw new Error('clock')};
  const r=await importApi.consumeVersionedStudioImportV2(h.ih.created.intent.intentId,'new',h.deps);
  assert.equal(r.ok,false);if(!r.ok)assert.equal(r.reason,'dependency');assert.equal(h.writerCalls,0);
}

// If exact-intent cleanup fails after creation, retry resolves through the
// idempotent target port and returns the original persisted design.
{
  const h=importHarness(); const intent=h.ih.created.intent; let present=true; let clearCalls=0;
  h.deps.intents={peek:()=>present?structuredClone(intent):null,clear:()=>{clearCalls+=1;if(clearCalls===1)throw new Error('storage');present=false;}};
  const first=await importApi.consumeVersionedStudioImportV2(intent.intentId,'new',h.deps);
  assert.equal(first.ok,false);if(!first.ok)assert.equal(first.reason,'dependency');
  const createdId=h.createdDoc?.designId;assert.ok(createdId);
  const second=await importApi.consumeVersionedStudioImportV2(intent.intentId,'new',h.deps);
  assert.equal(second.ok&&second.created,true);if(!second.ok||!second.created)throw new Error(second.message);
  assert.equal(second.doc.designId,createdId);assert.equal(h.writerCalls,2);assert.equal(present,false);
}

// Expiry clears exact intent.
{
  const h=intentHarness(); const id=h.created.intent.intentId;
  const expiredPort=intentApi.createVersionedIntentPortV2(h.storage,()=>Date.parse(h.created.intent.expiresAt)+1);
  assert.equal(expiredPort.peek(id),null); assert.equal(id in h.store,false);
}

console.log('[test:studio-v7-1-versioned-import] PASS');
