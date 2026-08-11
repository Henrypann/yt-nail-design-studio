#!/usr/bin/env node
/**
 * validate-community-content.mjs · CommunityContent / Publisher 门禁（PR-01）
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const taxonomy = JSON.parse(fs.readFileSync(path.join(root, 'public/community/taxonomy.json'), 'utf8'));
const publishers = JSON.parse(fs.readFileSync(path.join(root, 'public/community/publishers.json'), 'utf8'));
const index = JSON.parse(fs.readFileSync(path.join(root, 'public/community/content-index.json'), 'utf8'));
const library = JSON.parse(fs.readFileSync(path.join(root, 'material-library/index.json'), 'utf8'));

const APPLICATION_LEVELS = new Set([
  'INSPIRATION_ONLY',
  'APPROXIMATE',
  'STRUCTURED_EDITABLE',
  'REPRODUCIBLE',
]);
const VERIFICATION_LEVELS = new Set([
  'CONCEPT',
  'RENDER_VERIFIED',
  'SAMPLE_VERIFIED',
  'PRODUCTION_VERIFIED',
]);

const styleIds = new Set(taxonomy.mainStyles.map((s) => s.id));
const tagSets = {
  occasionIds: new Set(taxonomy.occasions.map((x) => x.id)),
  moodIds: new Set(taxonomy.moods.map((x) => x.id)),
  effectIds: new Set(taxonomy.effects.map((x) => x.id)),
  primaryColorIds: new Set(taxonomy.colors.map((x) => x.id)),
  subjectIds: new Set(taxonomy.subjects.map((x) => x.id)),
};
const pubById = new Map(publishers.map((p) => [p.publisherId, p]));
const templateIds = new Set(library.templates.map((t) => t.id));

assert.equal(index.schemaVersion, 1);
assert.equal(index.officialPgcTarget, 20);
assert.equal(index.officialMetadataReadyCount, 4);
assert.equal(index.officialGapCount, 16);

const contentIds = index.contents.map((c) => c.contentId);
assert.equal(new Set(contentIds).size, contentIds.length, 'contentId unique');

const pubIds = publishers.map((p) => p.publisherId);
assert.equal(new Set(pubIds).size, pubIds.length, 'publisherId unique');

const published = index.contents.filter((c) => c.status === 'PUBLISHED');
const drafts = index.contents.filter((c) => c.status === 'DRAFT');
assert.ok(drafts.length >= 1, 'fixture must include at least one DRAFT for leakage gate');
assert.ok(
  !published.some((c) => c.contentId === 'cc_draft_internal_gate'),
  'draft must not appear in published set',
);

let officialPublished = 0;
let pugcPublished = 0;
const officialStyleCounts = new Map([...styleIds].map((styleId) => [styleId, 0]));
const creatorStyleCounts = new Map([...styleIds].map((styleId) => [styleId, 0]));

for (const c of index.contents) {
  assert.equal(c.schemaVersion, 1);
  assert.ok(styleIds.has(c.mainStyleId), `invalid taxonomy mainStyle ${c.mainStyleId}`);
  assert.ok(c.subStyleIds.length <= 2);
  for (const sid of c.subStyleIds) assert.ok(styleIds.has(sid), `invalid subStyle ${sid}`);
  for (const [field, set] of Object.entries(tagSets)) {
    for (const id of c[field] ?? []) assert.ok(set.has(id), `${c.contentId} invalid ${field} ${id}`);
  }
  const pub = pubById.get(c.publisherId);
  assert.ok(pub, `invalid publisher ref ${c.publisherId}`);
  assert.ok(APPLICATION_LEVELS.has(c.applicationLevel), `invalid applicationLevel ${c.applicationLevel}`);
  assert.ok(VERIFICATION_LEVELS.has(c.verificationLevel), `invalid verificationLevel ${c.verificationLevel}`);

  const coverRel = c.cover.url.startsWith('/') ? c.cover.url.slice(1) : c.cover.url;
  const coverCandidates = [
    path.join(root, 'public', coverRel),
    path.join(root, coverRel),
  ];
  assert.ok(
    coverCandidates.some((p) => fs.existsSync(p)),
    `missing cover image: ${c.cover.url}`,
  );

  if (c.status !== 'PUBLISHED') continue;

  if (c.publisherType === 'OFFICIAL') {
    assert.equal(pub.type, 'OFFICIAL');
    officialPublished += 1;
    officialStyleCounts.set(c.mainStyleId, (officialStyleCounts.get(c.mainStyleId) ?? 0) + 1);
  } else {
    assert.equal(pub.type, 'CREATOR');
    assert.notEqual(pub.verification, 'OFFICIAL');
    pugcPublished += 1;
    creatorStyleCounts.set(c.mainStyleId, (creatorStyleCounts.get(c.mainStyleId) ?? 0) + 1);
    assert.equal(c.applicationLevel, 'INSPIRATION_ONLY');
    assert.equal(c.demo, true);
    assert.match(c.cover.url, /^\/community\/creator-covers\/.+\.jpg$/);
  }
  if (c.applicationLevel === 'REPRODUCIBLE') {
    assert.ok(c.assetRef?.templateId && c.assetRef.assetVersion);
  }
  if (c.verificationLevel === 'SAMPLE_VERIFIED') {
    assert.ok(c.media.some((m) => m.kind === 'SAMPLE_PHOTO'));
  }
  if (c.verificationLevel === 'PRODUCTION_VERIFIED') {
    assert.fail('no production verified in stage-1 fixtures');
  }
  if (c.assetRef?.templateId) {
    assert.ok(templateIds.has(c.assetRef.templateId), `assetRef ${c.assetRef.templateId}`);
    const t = library.templates.find((x) => x.id === c.assetRef.templateId);
    if (t?.asset_status === 'SIMULATED') {
      assert.ok(
        c.verificationLevel === 'RENDER_VERIFIED' || c.verificationLevel === 'CONCEPT',
        `${c.contentId} simulated mapping`,
      );
    }
  }
}

assert.equal(officialPublished, 4, 'official published PGC count');
const creatorGapStyles = [...styleIds].filter((styleId) => officialStyleCounts.get(styleId) === 0);
assert.equal(pugcPublished, creatorGapStyles.length, 'creator concepts only fill official style gaps');
for (const styleId of styleIds) {
  const officialCount = officialStyleCounts.get(styleId) ?? 0;
  const creatorCount = creatorStyleCounts.get(styleId) ?? 0;
  if (officialCount > 0) {
    assert.equal(creatorCount, 0, `${styleId} must not duplicate an official style`);
  } else {
    assert.equal(creatorCount, 1, `${styleId} missing creator gap concept`);
  }
}
assert.ok(!JSON.stringify(index).includes('"style_tags"'));

/** Community 模块依赖边界：不得 import Wizard / Editor */
function walkCommunitySrc(dir) {
  const out = [];
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) out.push(...walkCommunitySrc(p));
    else if (/\.(ts|tsx|mjs|js)$/.test(ent.name)) out.push(p);
  }
  return out;
}

const communityFiles = walkCommunitySrc(path.join(root, 'src/community'));
assert.ok(communityFiles.length > 0);
for (const file of communityFiles) {
  const src = fs.readFileSync(file, 'utf8');
  assert.doesNotMatch(src, /studio\/wizard|studio\/editor|useWizardStore|useEditorStore|useEditorV4Store/);
}

const intentSrc = fs.readFileSync(
  path.join(root, 'src/community/domain/studio-import-intent.ts'),
  'utf8',
);
assert.match(intentSrc, /StudioImportIntentV1/);
assert.match(intentSrc, /createStudioImportIntent|validateStudioImportIntent/);
assert.doesNotMatch(intentSrc, /useWizardStore|useEditorStore|studio\/wizard|studio\/editor/);

const contentPage = fs.readFileSync(
  path.join(root, 'src/community/pages/CommunityLookPage.tsx'),
  'utf8',
);
assert.match(contentPage, /createStudioImportIntent/);
assert.match(contentPage, /community-try-in-studio|community-inspiration-only|community-missing-asset/);
assert.match(contentPage, /community-cover-fallback|onError/);
assert.doesNotMatch(contentPage, /useWizardStore|useEditorStore/);

const card = fs.readFileSync(
  path.join(root, 'src/community/components/CommunityContentCard.tsx'),
  'utf8',
);
assert.match(card, /community-card-cover-fallback|onError/);

const feed = fs.readFileSync(path.join(root, 'src/community/components/CommunityFeed.tsx'), 'utf8');
assert.match(feed, /loadPublishedContents/);
assert.match(feed, /community-feed-empty|没有匹配的已发布内容/);
assert.doesNotMatch(feed, /from ['"]three|EditorHqPreview/);

console.log(
  `[test:community-content] PASS · publishedOfficial=${officialPublished} pugc=${pugcPublished} drafts=${drafts.length}`,
);
