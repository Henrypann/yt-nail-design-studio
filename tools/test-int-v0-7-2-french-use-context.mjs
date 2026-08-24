#!/usr/bin/env node

import assert from 'node:assert/strict';
import {
  CANONICAL_USE_DEMO_DISCOVERY_V1,
  CANONICAL_USE_DEMO_EDITOR_DOC_V7,
  CANONICAL_USE_DEMO_PUBLISHED_LOOK_V1,
  CANONICAL_USE_DEMO_RELEASE_RECORD_V1,
} from '../src/integration/community-studio/canonical-use-demo.ts';
import {
  createFrenchUseContextPortV1,
  createFrenchUseContextV1,
  deriveFrenchUsePreflightV1,
  frenchUseContextMatchesTargetV1,
  parseFrenchUseContextV1,
} from '../src/integration/community-studio/french-use-context-v1.ts';
import {
  createVersionedStudioImportIntentV2,
  parseVersionedStudioImportIntentV2,
} from '../src/community/domain/v7_1/versioned-studio-intent.ts';

const now = Date.parse('2026-08-24T09:30:00.000Z');
const targetDoc = structuredClone(CANONICAL_USE_DEMO_EDITOR_DOC_V7);
targetDoc.designId = 'design.remix.french-use-context';
targetDoc.sourceRefs = [{
  domain: 'community',
  sourceId: CANONICAL_USE_DEMO_PUBLISHED_LOOK_V1.lookId,
  revision: CANONICAL_USE_DEMO_PUBLISHED_LOOK_V1.designVersionId,
}];
const targetBefore = JSON.stringify(targetDoc);

assert.deepEqual(deriveFrenchUsePreflightV1(null), { status: 'DISCOVERY_UNAVAILABLE' });
const notFrench = structuredClone(CANONICAL_USE_DEMO_DISCOVERY_V1);
notFrench.techniqueIds = [];
assert.deepEqual(deriveFrenchUsePreflightV1(notFrench), { status: 'NOT_FRENCH' });
assert.equal(deriveFrenchUsePreflightV1(CANONICAL_USE_DEMO_DISCOVERY_V1).status, 'FRENCH_DECLARED');

const canonical = createFrenchUseContextV1({
  contextId: 'french.use.intent.demo',
  route: 'CANONICAL_V2',
  sourceId: CANONICAL_USE_DEMO_PUBLISHED_LOOK_V1.lookId,
  sourceRevision: CANONICAL_USE_DEMO_PUBLISHED_LOOK_V1.designVersionId,
  discovery: CANONICAL_USE_DEMO_DISCOVERY_V1,
  targetDoc,
  nowMs: now,
});
assert.equal(canonical.ok, true);
assert.ok(canonical.ok && canonical.context);
if (!canonical.ok || !canonical.context) throw new Error('canonical context missing');
assert.equal(canonical.context.authoringStatus, 'AVAILABLE');
assert.equal(canonical.context.action, 'OFFER_OPEN_FRENCH_TOOL');
assert.deepEqual(canonical.context.claims, {
  presetInferred: false,
  makeabilityInferred: false,
  manufacturingValidated: false,
});
assert.equal(JSON.stringify(targetDoc), targetBefore, 'context derivation is EditorDoc writer-zero');
assert.equal(parseFrenchUseContextV1(canonical.context, canonical.context.contextId).ok, true);
assert.equal(parseFrenchUseContextV1({ ...canonical.context, preset: 'classic' }).ok, false, 'unknown keys fail closed');
assert.equal(parseFrenchUseContextV1({ ...canonical.context, claims: { ...canonical.context.claims, presetInferred: true } }).ok, false);
assert.equal(frenchUseContextMatchesTargetV1(canonical.context, targetDoc), true);

const mismatchDiscovery = structuredClone(CANONICAL_USE_DEMO_DISCOVERY_V1);
mismatchDiscovery.recommendedShapeIds = ['shape:oval'];
const mismatch = createFrenchUseContextV1({
  contextId: 'french.use.intent.mismatch', route: 'CANONICAL_V2',
  sourceId: CANONICAL_USE_DEMO_PUBLISHED_LOOK_V1.lookId,
  sourceRevision: CANONICAL_USE_DEMO_PUBLISHED_LOOK_V1.designVersionId,
  discovery: mismatchDiscovery, targetDoc, nowMs: now,
});
assert.equal(mismatch.ok && mismatch.context?.authoringStatus, 'SOURCE_TARGET_MISMATCH');
assert.equal(mismatch.ok && mismatch.context?.action, 'SHOW_DIAGNOSTIC');

const unavailableTarget = structuredClone(targetDoc);
unavailableTarget.designId = 'design.french.use.unavailable';
unavailableTarget.nails.R1.geometryRef = { assetId: 'geometry.square.medium.R1', revision: 'geometry.unsigned' };
const unavailableBefore = JSON.stringify(unavailableTarget);
const unavailable = createFrenchUseContextV1({
  contextId: 'french.use.intent.square', route: 'LEGACY_V1', sourceId: 'legacy.french.source', sourceRevision: null,
  discovery: CANONICAL_USE_DEMO_DISCOVERY_V1, targetDoc: unavailableTarget, nowMs: now,
});
assert.equal(unavailable.ok && unavailable.context?.authoringStatus, 'UNAVAILABLE');
assert.equal(unavailable.ok && unavailable.context?.route, 'LEGACY_V1');
assert.equal(JSON.stringify(unavailableTarget), unavailableBefore, 'legacy preflight remains writer-zero');

const noContext = createFrenchUseContextV1({
  contextId: 'french.use.intent.not-french', route: 'CANONICAL_V2', sourceId: 'look.not-french', sourceRevision: 'dv.not-french.1',
  discovery: notFrench, targetDoc, nowMs: now,
});
assert.deepEqual(noContext, { ok: true, context: null });
assert.deepEqual(createFrenchUseContextV1({
  contextId: 'french.use.intent.no-discovery', route: 'CANONICAL_V2', sourceId: 'look.no-discovery', sourceRevision: 'dv.no-discovery.1',
  discovery: null, targetDoc, nowMs: now,
}), { ok: false, reason: 'discovery_unavailable' });

let stored = {};
let writes = 0;
const storage = { read: () => structuredClone(stored), write: (next) => { stored = structuredClone(next); writes += 1; } };
let clock = now;
const port = createFrenchUseContextPortV1(storage, () => clock);
assert.deepEqual(port.save(canonical.context), { ok: true });
assert.equal(port.peek(canonical.context.contextId)?.targetDesignId, targetDoc.designId);
clock = Date.parse(canonical.context.expiresAt) + 1;
assert.equal(port.peek(canonical.context.contextId), null);
assert.equal(canonical.context.contextId in stored, false, 'expired context clears only its own short-lived record');
assert.ok(writes >= 2);

let intentStore = {};
const intentResult = createVersionedStudioImportIntentV2({
  look: CANONICAL_USE_DEMO_PUBLISHED_LOOK_V1,
  designVersion: CANONICAL_USE_DEMO_RELEASE_RECORD_V1.designVersion,
}, {
  storage: { read: () => structuredClone(intentStore), write: (next) => { intentStore = structuredClone(next); } },
  nextId: () => 'intent.versioned.french-use-contract',
  nowMs: () => now,
});
assert.equal(intentResult.ok, true);
if (!intentResult.ok) throw new Error(intentResult.reason);
assert.equal(parseVersionedStudioImportIntentV2(intentResult.intent).ok, true);
assert.equal(parseVersionedStudioImportIntentV2({ ...intentResult.intent, frenchUseContext: canonical.context }).ok, false,
  'French use context never expands VersionedStudioImportIntentV2 exact keys');

console.log('[test:int-v0-7-2-french-use-context] PASS (canonical/legacy, mismatch/unavailable, TTL, writer-zero, V2 exact keys)');
