#!/usr/bin/env node
/**
 * test-community-v7-1-look-adapter.mjs · COMM-V7.1-01
 * Published Look adapter / canonical route / legacy redirect behavior tests.
 *
 * Covers:
 *  - pure adapter: PUBLISHED legacy → LEGACY_PARTIAL read model; draft /
 *    deprecated → not_viewable; malformed essentials → malformed;
 *    deterministic, side-effect-free output; NO fabricated designVersionId,
 *    EditorDoc SHA-256, preview revision/hash or publication-gate evidence;
 *  - honest preview-fidelity classification from verification level
 *    (CONCEPT → APPROXIMATE, RENDER_VERIFIED+ → EXACT) and honest
 *    previewVerified / manufacturable / productionDispatched status evidence;
 *  - field preservation (publisher / title / taxonomy / application /
 *    verification / asset refs);
 *  - repository core: buildLookReadModels applies demo-visibility filtering
 *    (production hides demo PUGC) and drops non-viewable records;
 *  - canonical routes: Routes.communityLook / communityLookPath; legacy
 *    Routes.communityContent kept deprecated for compatibility;
 *  - legacy redirect: legacyContentRedirectTarget preserves query params and
 *    replaces to the canonical look URL (pure behavior);
 *  - canonical links wired in card / profile / Studio intent fallback /
 *    Wizard fallbacks; required evidence labels present on the look page.
 *
 * Where pure behavior is impossible in Node (React components), the test
 * verifies the wiring at source level and says so explicitly.
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = process.cwd();

const {
  adaptLegacyContentToLook,
  buildLookReadModels,
  previewFidelityFromVerification,
} = await import(
  pathToFileURL(path.join(root, 'src/community/domain/v7_1/published-look-adapter.ts')).href
);
const { Routes, legacyContentRedirectTarget } = await import(
  pathToFileURL(path.join(root, 'src/app/routes.ts')).href
);

const index = JSON.parse(
  fs.readFileSync(path.join(root, 'public/community/content-index.json'), 'utf8'),
);
const byId = new Map(index.contents.map((c) => [c.contentId, c]));
const mercury = byId.get('cc_mercury_dew'); // PUBLISHED / STRUCTURED_EDITABLE / RENDER_VERIFIED
const pearl = byId.get('cc_pearl_tide'); // PUBLISHED / APPROXIMATE / CONCEPT
const pugc = byId.get('cc_pugc_luna_blush'); // PUBLISHED demo creator / INSPIRATION_ONLY
const draft = byId.get('cc_draft_internal_gate'); // DRAFT
assert.ok(mercury && pearl && pugc && draft, 'fixtures must exist');

// ---------------------------------------------------------------------------
// 1 · Pure adapter: viewable legacy → LEGACY_PARTIAL read model
// ---------------------------------------------------------------------------
const adapted = adaptLegacyContentToLook(mercury);
assert.equal(adapted.ok, true, 'published official content must adapt');
if (!adapted.ok) throw new Error('unreachable');
const look = adapted.look;
assert.equal(look.readModelKind, 'LEGACY_PARTIAL');
assert.equal(look.schemaVersion, 1);
assert.equal(look.lookId, mercury.contentId, 'legacy lookId = contentId for stable compatibility');
assert.equal(look.contentId, mercury.contentId);

// Field preservation: publisher / title / taxonomy / application / verification / asset refs.
assert.equal(look.title, mercury.title);
assert.equal(look.titleEn, mercury.titleEn);
assert.equal(look.publisherId, mercury.publisherId);
assert.equal(look.publisherType, mercury.publisherType);
assert.equal(look.curationStatus, mercury.curationStatus);
assert.equal(look.mainStyleId, mercury.mainStyleId);
assert.deepEqual(look.subStyleIds, mercury.subStyleIds);
assert.deepEqual(look.occasionIds, mercury.occasionIds);
assert.deepEqual(look.effectIds, mercury.effectIds);
assert.deepEqual(look.moodIds, mercury.moodIds);
assert.deepEqual(look.primaryColorIds, mercury.primaryColorIds);
assert.deepEqual(look.recommendedShapes, mercury.recommendedShapes);
assert.deepEqual(look.supportedShapes, mercury.supportedShapes);
assert.deepEqual(look.supportedLengths, mercury.supportedLengths);
assert.equal(look.applicationLevel, mercury.applicationLevel);
assert.equal(look.verificationLevel, mercury.verificationLevel);
assert.equal(look.cover.url, mercury.cover.url);
assert.deepEqual(look.media, mercury.media);
assert.equal(look.publishedAt, mercury.publishedAt);
assert.equal(look.demo, mercury.demo ?? undefined);
assert.deepEqual(look.campaignTags, mercury.campaignTags);
assert.equal(look.assetRef?.templateId, mercury.assetRef.templateId);
assert.equal(look.assetRef?.assetVersion, mercury.assetRef.assetVersion);
assert.equal(look.assetRef?.manifestUrl, mercury.assetRef.manifestUrl);
assert.deepEqual(look.sourceContent, mercury, 'sourceContent preserves the original record');

// ---------------------------------------------------------------------------
// 2 · No fabricated immutable design version / preview hash / gate evidence
// ---------------------------------------------------------------------------
assert.equal(look.designVersionId, undefined, 'legacy read model must not fabricate designVersionId');
assert.equal(look.publicationGateVerified, false);
assert.deepEqual(look.evidence.immutableDesignVersion, {
  present: false,
  reason: 'legacy_missing_design_version',
});
assert.deepEqual(look.evidence.publicationGate, {
  present: false,
  reason: 'legacy_missing_publication_gate_evidence',
});
assert.equal(look.evidence.previewEvidence.present, false);
assert.equal(look.evidence.previewEvidence.reason, 'legacy_missing_preview_hash');

const serialized = JSON.stringify(look);
assert.ok(!serialized.includes('"sha256"'), 'no fabricated sha256 key in read model');
assert.ok(!serialized.includes('"designVersionId"'), 'no designVersionId key in serialized read model');
assert.doesNotMatch(serialized, /[0-9a-f]{64}/, 'no fabricated 64-hex hash anywhere in read model');

// ---------------------------------------------------------------------------
// 3 · Honest preview fidelity + status evidence from verification level
// ---------------------------------------------------------------------------
assert.equal(previewFidelityFromVerification('CONCEPT'), 'APPROXIMATE');
assert.equal(previewFidelityFromVerification('RENDER_VERIFIED'), 'EXACT');
assert.equal(previewFidelityFromVerification('SAMPLE_VERIFIED'), 'EXACT');
assert.equal(previewFidelityFromVerification('PRODUCTION_VERIFIED'), 'EXACT');
assert.equal(look.evidence.previewEvidence.fidelity, 'EXACT');
assert.deepEqual(look.evidence.status, {
  sourceStatus: 'PUBLISHED',
  viewable: true,
  previewVerified: true,
  manufacturable: false, // RENDER_VERIFIED ≠ physical sample evidence
  productionDispatched: false, // never claimed for legacy static fixtures
});

const concept = adaptLegacyContentToLook(pearl);
assert.equal(concept.ok, true);
if (!concept.ok) throw new Error('unreachable');
assert.equal(concept.look.evidence.previewEvidence.fidelity, 'APPROXIMATE');
assert.equal(concept.look.evidence.status.previewVerified, false);
assert.equal(concept.look.evidence.status.manufacturable, false);

const sample = adaptLegacyContentToLook({ ...mercury, verificationLevel: 'SAMPLE_VERIFIED' });
assert.equal(sample.ok, true);
if (!sample.ok) throw new Error('unreachable');
assert.equal(sample.look.evidence.status.previewVerified, true);
assert.equal(
  sample.look.evidence.status.manufacturable,
  false,
  'sample label alone is not explicit manufacturing evidence',
);
assert.equal(sample.look.evidence.status.productionDispatched, false);

const production = adaptLegacyContentToLook({ ...mercury, verificationLevel: 'PRODUCTION_VERIFIED' });
assert.equal(production.ok, true);
if (!production.ok) throw new Error('unreachable');
assert.equal(
  production.look.evidence.status.manufacturable,
  false,
  'legacy production label still lacks immutable manufacturing/device evidence',
);
assert.equal(production.look.evidence.status.productionDispatched, false);

// ---------------------------------------------------------------------------
// 4 · Draft / deprecated / non-published → not_viewable
// ---------------------------------------------------------------------------
for (const [name, record, expectReason] of [
  ['draft', draft, 'not_viewable'],
  ['deprecated', { ...mercury, status: 'DEPRECATED' }, 'not_viewable'],
  ['draft official', { ...mercury, status: 'DRAFT' }, 'not_viewable'],
]) {
  const result = adaptLegacyContentToLook(record);
  assert.equal(result.ok, false, `${name} must be rejected`);
  if (result.ok) throw new Error('unreachable');
  assert.equal(result.reason, expectReason, `${name} rejection reason`);
}

// ---------------------------------------------------------------------------
// 5 · Malformed essentials → malformed (never throws)
// ---------------------------------------------------------------------------
const malformedCases = [
  ['non-object', 'nope'],
  ['null', null],
  ['wrong schemaVersion', { ...mercury, schemaVersion: 2 }],
  ['missing contentId', { ...mercury, contentId: '' }],
  ['missing title', { ...mercury, title: undefined }],
  ['missing publisherId', { ...mercury, publisherId: '' }],
  ['invalid publisherType', { ...mercury, publisherType: 'HACKER' }],
  ['invalid cover', { ...mercury, cover: { url: '' } }],
  ['invalid status', { ...mercury, status: 'UNKNOWN' }],
  ['invalid applicationLevel', { ...mercury, applicationLevel: 'MAGIC' }],
  ['invalid verificationLevel', { ...mercury, verificationLevel: 'MAGIC' }],
  ['missing mainStyleId', { ...mercury, mainStyleId: '' }],
  ['missing publishedAt', { ...mercury, publishedAt: undefined }],
  ['non-array taxonomy', { ...mercury, effectIds: 'cat-eye' }],
  ['malformed assetRef', { ...mercury, assetRef: { templateId: 42 } }],
  ['malformed optional asset ref', { ...mercury, assetRef: { ...mercury.assetRef, recipeId: 42 } }],
  ['malformed shape reasons', { ...mercury, notRecommendedShapes: { stiletto: 42 } }],
];
for (const [name, value] of malformedCases) {
  let result;
  assert.doesNotThrow(() => {
    result = adaptLegacyContentToLook(value);
  }, `${name} must never throw`);
  assert.equal(result.ok, false, `${name} must be rejected`);
  if (!result.ok) assert.equal(result.reason, 'malformed', `${name} reason`);
}

// ---------------------------------------------------------------------------
// 6 · Deterministic + side-effect-free output
// ---------------------------------------------------------------------------
const again = adaptLegacyContentToLook(mercury);
assert.equal(again.ok, true);
assert.deepEqual(again.ok ? again.look : null, look, 'same input → deep-equal output');

const clone = JSON.parse(JSON.stringify(mercury));
const snapshot = JSON.stringify(mercury);
const fromClone = adaptLegacyContentToLook(clone);
assert.equal(fromClone.ok, true);
assert.deepEqual(
  fromClone.ok ? fromClone.look : null,
  look,
  'JSON round-trip input → identical read model',
);
assert.equal(JSON.stringify(mercury), snapshot, 'input must not be mutated');
assert.equal(JSON.stringify(clone), snapshot, 'clone must not be mutated');

// ---------------------------------------------------------------------------
// 7 · Repository core: visibility filtering + viewability filtering
// ---------------------------------------------------------------------------
const prodLooks = buildLookReadModels(index.contents, 'production');
const prodIds = prodLooks.map((l) => l.lookId);
assert.ok(prodIds.includes('cc_mercury_dew'));
assert.ok(!prodIds.includes('cc_draft_internal_gate'), 'draft dropped');
assert.equal(
  prodLooks.some((l) => l.contentId.startsWith('cc_pugc_')),
  false,
  'demo PUGC hidden in production mode',
);
assert.equal(prodLooks.length, 4, 'official published PGC only in production');

const devLooks = buildLookReadModels(index.contents, 'integration');
const devIds = devLooks.map((l) => l.lookId);
assert.equal(devLooks.length, 11, 'integration mode shows official + demo PUGC');
assert.ok(devIds.includes('cc_pugc_luna_blush'), 'demo PUGC visible in integration');
assert.ok(!devIds.includes('cc_draft_internal_gate'), 'draft never viewable');
for (const lookModel of devLooks) {
  assert.equal(lookModel.lookId, lookModel.contentId, 'lookId = contentId mapping');
  assert.equal(lookModel.readModelKind, 'LEGACY_PARTIAL');
}
assert.deepEqual(
  buildLookReadModels(index.contents, 'production'),
  prodLooks,
  'repository core is deterministic',
);

// ---------------------------------------------------------------------------
// 8 · Canonical routes + legacy route kept deprecated
// ---------------------------------------------------------------------------
assert.equal(Routes.communityLook('cc_mercury_dew'), '/look/cc_mercury_dew');
assert.equal(Routes.communityLookPath, '/look/:lookId');
assert.equal(Routes.communityContent('cc_mercury_dew'), '/content/cc_mercury_dew');
assert.equal(Routes.communityContentPath, '/content/:contentId');
assert.equal(Routes.communityOfficial, '/official');

// ---------------------------------------------------------------------------
// 9 · Legacy redirect behavior: replace target + query preservation
// ---------------------------------------------------------------------------
assert.equal(
  legacyContentRedirectTarget('cc_mercury_dew', new URLSearchParams('entry=wizard&shape=almond&length=medium')),
  '/look/cc_mercury_dew?entry=wizard&shape=almond&length=medium',
  'query params preserved on redirect target',
);
assert.equal(
  legacyContentRedirectTarget('cc_mercury_dew', new URLSearchParams()),
  '/look/cc_mercury_dew',
  'no query → plain canonical target',
);
assert.equal(
  legacyContentRedirectTarget('cc_mercury_dew', new URLSearchParams('return_to=/design/new')),
  '/look/cc_mercury_dew?return_to=%2Fdesign%2Fnew',
  'URL-encoded query preserved verbatim',
);
assert.equal(legacyContentRedirectTarget(undefined, new URLSearchParams('a=1')), '/official');

// ---------------------------------------------------------------------------
// 10 · Studio import intent fallback uses the canonical look URL (behavior)
// ---------------------------------------------------------------------------
const mem = new Map();
globalThis.localStorage = {
  getItem: (k) => (mem.has(k) ? mem.get(k) : null),
  setItem: (k, v) => mem.set(k, String(v)),
  removeItem: (k) => mem.delete(k),
  clear: () => mem.clear(),
};
globalThis.window = globalThis;
globalThis.sessionStorage = {
  getItem: () => null,
  setItem: () => undefined,
  removeItem: () => undefined,
};
const { createStudioImportIntent } = await import(
  pathToFileURL(path.join(root, 'src/community/domain/studio-import-intent.ts')).href
);
mem.clear();
const intentResult = createStudioImportIntent({
  content: mercury,
  returnTo: 'https://evil.example/phish',
});
assert.equal(intentResult.ok, true);
if (!intentResult.ok) throw new Error('unreachable');
const storedIntent = JSON.parse(mem.get('nail-studio:community.studio-import-intent'));
const stored = storedIntent.data[intentResult.intentId];
assert.equal(
  stored.returnTo,
  '/look/cc_mercury_dew',
  'non-allowlisted returnTo falls back to the canonical look URL',
);

// ---------------------------------------------------------------------------
// 11 · Wiring checks (source-level where a DOM is required)
// ---------------------------------------------------------------------------
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

const redirect = read('src/community/pages/CommunityLegacyContentRedirect.tsx');
assert.match(redirect, /legacyContentRedirectTarget\(contentId, searchParams\)/);
assert.match(redirect, /useSearchParams/);
assert.match(redirect, /<Navigate[^>]*replace/);

const contentPage = read('src/community/pages/CommunityContentPage.tsx');
assert.match(contentPage, /CommunityLegacyContentRedirect/);
assert.doesNotMatch(contentPage, /useWizardStore|useEditorStore/);
// Legacy page no longer renders product UI: no data loading, no try-in-studio
// logic, no cover image handling (markers below are doc-comment references only).
assert.doesNotMatch(contentPage, /canTryInStudio|getContentById|onError=|community-cover-fallback/);

const lookPage = read('src/community/pages/CommunityLookPage.tsx');
assert.match(lookPage, /createStudioImportIntent/);
assert.match(lookPage, /community-try-in-studio/);
assert.match(lookPage, /community-cover-fallback/);
assert.match(lookPage, /onError/);
assert.match(lookPage, /community-look-evidence/);
assert.match(lookPage, /community-look-evidence-missing/);
assert.match(lookPage, /community-look-source-caveat/);
assert.match(lookPage, /预览通过 ≠ 可制造 ≠ 已下发生产/);
assert.match(lookPage, /无证据/);
assert.match(lookPage, /getLookReadModelById/);
assert.doesNotMatch(lookPage, /useWizardStore|useEditorStore/);

const app = read('src/app/App.tsx');
assert.match(app, /Routes\.communityLookPath[\s\S]*CommunityLookPage/);
assert.match(app, /Routes\.communityContentPath[\s\S]*CommunityLegacyContentRedirect/);

const card = read('src/community/components/CommunityLookCard.tsx');
assert.match(card, /Routes\.communityLook\(look\.lookId\)/);
assert.doesNotMatch(card, /Routes\.communityContent\(/);

const profile = read('src/community/pages/CommunityProfilePage.tsx');
assert.match(profile, /Routes\.communityLook\(c\.contentId\)/);
assert.doesNotMatch(profile, /Routes\.communityContent\(/);

const intent = read('src/community/domain/studio-import-intent.ts');
assert.match(intent, /Routes\.communityLook\(content\.contentId\)/);
assert.doesNotMatch(intent, /Routes\.communityContent\(/);

const wizard = read('src/app/pages/design/WizardPage.tsx');
assert.match(wizard, /Routes\.communityLook\(intent\.contentId\)/);
assert.match(wizard, /Routes\.communityLook\(ui\.contentId\)/);
assert.doesNotMatch(wizard, /Routes\.communityContent\(/);

// No product call-site may still link to the deprecated content route
// (only the route table definition itself may reference it).
const srcFiles = [];
(function walk(dir) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p);
    else if (/\.(ts|tsx)$/.test(ent.name) && !p.endsWith('routes.ts')) srcFiles.push(p);
  }
})(path.join(root, 'src'));
for (const file of srcFiles) {
  assert.doesNotMatch(
    fs.readFileSync(file, 'utf8'),
    /Routes\.communityContent\(/,
    `${file} must not call the deprecated content route`,
  );
}

console.log(
  `[test:community-v7-1-look-adapter] PASS · viewable=${index.contents.length - 1} malformed=${malformedCases.length} prodLooks=${prodLooks.length} devLooks=${devLooks.length}`,
);
