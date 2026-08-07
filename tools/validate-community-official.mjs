#!/usr/bin/env node
/**
 * validate-community-official.mjs · 官方 template adapter + Official 路由门禁（PR-01）
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = process.cwd();

const requiredFiles = [
  'src/app/layouts/CommunityLayout.tsx',
  'src/community/pages/CommunityOfficialPage.tsx',
  'src/community/data/official-template-adapter.ts',
  'src/community/data/content-repository.ts',
  'src/app/pages/design/CommunityPage.tsx',
  'public/community/content-index.json',
];

for (const rel of requiredFiles) {
  assert.ok(fs.existsSync(path.join(root, rel)), `missing ${rel}`);
}

const communityLayout = fs.readFileSync(path.join(root, 'src/app/layouts/CommunityLayout.tsx'), 'utf8');
assert.doesNotMatch(communityLayout, /useWizardStore|useEditorStore|useEditorV4Store/);
assert.match(communityLayout, /community-enter-studio|community-enter-dashboard/);

const officialPage = fs.readFileSync(path.join(root, 'src/community/pages/CommunityOfficialPage.tsx'), 'utf8');
assert.doesNotMatch(officialPage, /useWizardStore|useEditorStore|COMMUNITY_MOCK/);
assert.match(officialPage, /官方灵感库|CommunityFeed/);
assert.match(officialPage, /lockedSource=["']official["']/);

const feed = fs.readFileSync(path.join(root, 'src/community/components/CommunityFeed.tsx'), 'utf8');
assert.match(feed, /loadPublishedContents|content-repository/);
assert.doesNotMatch(feed, /useWizardStore/);

const legacyRedirect = fs.readFileSync(path.join(root, 'src/app/pages/design/CommunityPage.tsx'), 'utf8');
assert.match(legacyRedirect, /Navigate|communityOfficial/);
assert.doesNotMatch(legacyRedirect, /useWizardStore/);

const appTsx = fs.readFileSync(path.join(root, 'src/app/App.tsx'), 'utf8');
assert.match(appTsx, /CommunityLayout/);
assert.match(appTsx, /communityOfficial|Routes\.community/);

const adapterSrc = fs.readFileSync(
  path.join(root, 'src/community/data/official-template-adapter.ts'),
  'utf8',
);
assert.match(adapterSrc, /officialTemplateToContent/);
assert.match(adapterSrc, /publisherId:\s*['"]pub_nailstyle_official['"]/);
assert.match(adapterSrc, /status:\s*['"]PUBLISHED['"]/);
assert.doesNotMatch(adapterSrc, /studio\/wizard|studio\/editor/);

const index = JSON.parse(fs.readFileSync(path.join(root, 'material-library/index.json'), 'utf8'));
const officialCount = index.templates.filter(
  (t) =>
    (t.asset_status === 'CONCEPT' || t.asset_status === 'SIMULATED')
    && String(t.thumbnail_url).startsWith('assets/hero-recipes/'),
).length;
assert.ok(officialCount >= 2, `expected >= 2 official hero-recipe templates, got ${officialCount}`);

/** 运行时调用 adapter（通过 vite-compat hook） */
const { officialTemplateToContent } = await import(
  pathToFileURL(path.join(root, 'src/community/data/official-template-adapter.ts')).href
);
const sample = index.templates.find((t) => String(t.thumbnail_url).startsWith('assets/hero-recipes/'));
assert.ok(sample, 'sample official template');
const projected = officialTemplateToContent(sample, {
  contentId: 'cc_adapter_probe',
  mainStyleId: 'ST-01',
  coverUrl: `/${sample.thumbnail_url}`,
});
assert.equal(projected.publisherType, 'OFFICIAL');
assert.equal(projected.status, 'PUBLISHED');
assert.equal(projected.publisherId, 'pub_nailstyle_official');
assert.ok(projected.recommendedShapes.length >= 1);

console.log(`[test:community-official] PASS · ${officialCount} official templates, adapter ok`);
