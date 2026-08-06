#!/usr/bin/env node
/**
 * test-community-domain.mjs · filters / badges / published leakage（PR-01）
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = process.cwd();
const { filterContents, parseFiltersFromSearch, filtersToSearchParams, EMPTY_FILTERS } = await import(
  pathToFileURL(path.join(root, 'src/community/domain/filters.ts')).href
);
const {
  applicationBadgeLabel,
  verificationBadgeLabel,
  publisherBadgeLabel,
  cardBadgeSummary,
} = await import(pathToFileURL(path.join(root, 'src/community/domain/badges.ts')).href);
const {
  allowsCommunityDemoContent,
  visibleCommunityContents,
  visibleCommunityPublishers,
} = await import(pathToFileURL(path.join(root, 'src/community/domain/visibility.ts')).href);
const { communityInternalHref, studioReturnPath } = await import(
  pathToFileURL(path.join(root, 'src/community/lib/entry-link.ts')).href
);

const index = JSON.parse(fs.readFileSync(path.join(root, 'public/community/content-index.json'), 'utf8'));
const publishers = JSON.parse(fs.readFileSync(path.join(root, 'public/community/publishers.json'), 'utf8'));
const published = index.contents.filter((c) => c.status === 'PUBLISHED');
assert.ok(published.length > 0);
assert.ok(!published.some((c) => c.status !== 'PUBLISHED'));
assert.ok(index.contents.some((c) => c.status === 'DRAFT'));

/** Integration shows demo creators; public production hides them. */
assert.equal(allowsCommunityDemoContent('integration'), true);
assert.equal(allowsCommunityDemoContent('development'), true);
assert.equal(allowsCommunityDemoContent('production'), false);
assert.equal(
  visibleCommunityContents(index.contents, 'integration').filter(
    (c) => c.publisherType === 'VERIFIED_CREATOR',
  ).length,
  7,
);
assert.equal(
  visibleCommunityContents(index.contents, 'production').filter(
    (c) => c.publisherType === 'VERIFIED_CREATOR',
  ).length,
  0,
);
assert.equal(visibleCommunityPublishers(publishers, 'integration').length, 4);
assert.equal(visibleCommunityPublishers(publishers, 'production').length, 1);

/** Community internal navigation preserves the product return context. */
const entryContext = new URLSearchParams({
  entry: 'wizard',
  return_to: '/design/new?fresh=1',
  shape: 'almond',
  length: 'medium',
  style: 'ST-01',
});
const officialHref = communityInternalHref('/community/official', entryContext);
const officialUrl = new URL(officialHref, 'https://local.test');
assert.equal(officialUrl.pathname, '/community/official');
assert.equal(officialUrl.searchParams.get('entry'), 'wizard');
assert.equal(officialUrl.searchParams.get('return_to'), '/design/new?fresh=1');
assert.equal(officialUrl.searchParams.get('shape'), 'almond');
assert.equal(officialUrl.searchParams.get('length'), 'medium');
assert.equal(officialUrl.searchParams.has('style'), false);
assert.equal(studioReturnPath(officialUrl.searchParams), '/design/new?fresh=1');
assert.equal(studioReturnPath(new URLSearchParams({ return_to: '//evil.example' })), '/design');
assert.equal(studioReturnPath(new URLSearchParams({ return_to: '/community' })), '/design');

/** 多条件 filter：同维 OR、跨维 AND */
const multi = filterContents(published, {
  ...EMPTY_FILTERS,
  source: 'official',
  style: 'ST-01',
  occasion: ['party', 'date'],
  effect: ['chrome', 'cat-eye'],
});
assert.ok(multi.every((c) => c.publisherType === 'OFFICIAL'));
assert.ok(multi.every((c) => c.mainStyleId === 'ST-01'));
assert.ok(multi.every((c) => c.occasionIds.some((id) => id === 'party' || id === 'date')));
assert.ok(multi.every((c) => c.effectIds.some((id) => id === 'chrome' || id === 'cat-eye')));

const creatorsOnly = filterContents(published, { ...EMPTY_FILTERS, source: 'creators' });
assert.ok(creatorsOnly.every((c) => c.publisherType === 'VERIFIED_CREATOR'));
assert.ok(creatorsOnly.every((c) => c.applicationLevel === 'INSPIRATION_ONLY'));

const params = filtersToSearchParams({
  ...EMPTY_FILTERS,
  source: 'official',
  style: 'ST-02',
  occasion: ['work'],
  shape: 'almond',
  application: 'APPROXIMATE',
});
const roundTrip = parseFiltersFromSearch(params);
assert.equal(roundTrip.source, 'official');
assert.equal(roundTrip.style, 'ST-02');
assert.deepEqual(roundTrip.occasion, ['work']);
assert.equal(roundTrip.shape, 'almond');
assert.equal(roundTrip.application, 'APPROXIMATE');

/** badge 推导 */
assert.equal(applicationBadgeLabel('INSPIRATION_ONLY'), '灵感参考');
assert.equal(applicationBadgeLabel('APPROXIMATE'), '近似应用');
assert.equal(verificationBadgeLabel('RENDER_VERIFIED'), '已验证预览');
const official = publishers.find((p) => p.type === 'OFFICIAL');
assert.equal(publisherBadgeLabel(official), '官方');
assert.equal(publisherBadgeLabel(null), '未知发布者');
const sample = published.find((c) => c.publisherType === 'OFFICIAL');
const summary = cardBadgeSummary(sample, official, 'Elegant');
assert.equal(summary.publisher, '官方');
assert.equal(summary.style, 'Elegant');
assert.ok(summary.trust);

console.log(
  `[test:community-domain] PASS · published=${published.length} multiFilter=${multi.length} creators=${creatorsOnly.length}`,
);
