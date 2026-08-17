#!/usr/bin/env node
/**
 * test-community-v7-1-explore-search.mjs · COMM-V7.1-02
 * Explore & Search 纯契约行为测试。
 *
 * Covers:
 *  - URL canonical round-trip（serialize ⇄ parse）、确定性、固定 key 顺序；
 *  - 坏输入净化：未知 tab/sort/source/application/verification、q 长度上限、
 *    CSV 去重/trim/空项丢弃、单值 trim/空→null；
 *  - look 搜索全部字段：title / titleEn / publisher displayName+handle /
 *    taxonomy labels+IDs / campaignTags；大小写与空白容忍；
 *  - creator 搜索：displayName / handle / bio；production 隐藏 demo 创作者；
 *  - color 筛选（primaryColorIds）与其他维度组合；
 *  - 排序：New（publishedAt desc + lookId 稳定 tie-break）、Featured
 *    （editorial signal 优先）、Trending（时间窗口 + 最小独立样本 +
 *    确定性回退 + reason；asOf 注入，纯函数不读时钟）；
 *  - 稳定排序（同输入两次深相等）；
 *  - 不推断 Made/互动数据（读模型与排名输出均无 made/engagement 字段）；
 *  - 路由/卡片接线、entry-link 保留四个 Studio 上下文键、Community 无 Three.js、
 *    explore-search.ts 纯（无 Date.now / import.meta / fetch）。
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = process.cwd();
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

const {
  DEFAULT_EXPLORE_STATE,
  DEFAULT_TRENDING_CONFIG,
  EMPTY_EXPLORE_FILTERS,
  MAX_QUERY_LENGTH,
  filterLookReadModels,
  parseExploreState,
  exploreStateToSearchParams,
  serializeExploreState,
  rankLooks,
  resolveEffectiveSort,
  searchCreators,
  trendingCounts,
  compareNew,
  compareFeatured,
  hasEditorialSignal,
} = await import(
  pathToFileURL(path.join(root, 'src/community/domain/v7_1/explore-search.ts')).href
);
const { adaptLegacyContentToLook, buildLookReadModels } = await import(
  pathToFileURL(path.join(root, 'src/community/domain/v7_1/published-look-adapter.ts')).href
);
const { Routes } = await import(pathToFileURL(path.join(root, 'src/app/routes.ts')).href);
const { communityInternalHref } = await import(
  pathToFileURL(path.join(root, 'src/community/lib/entry-link.ts')).href
);

const index = JSON.parse(
  fs.readFileSync(path.join(root, 'public/community/content-index.json'), 'utf8'),
);
const publishers = JSON.parse(fs.readFileSync(path.join(root, 'public/community/publishers.json'), 'utf8'));
const taxonomy = JSON.parse(fs.readFileSync(path.join(root, 'public/community/taxonomy.json'), 'utf8'));

const devLooks = buildLookReadModels(index.contents, 'integration');
const prodLooks = buildLookReadModels(index.contents, 'production');
const byId = new Map(index.contents.map((c) => [c.contentId, c]));
const mercury = byId.get('cc_mercury_dew');
assert.ok(mercury, 'mercury fixture must exist');
const baseLook = adaptLegacyContentToLook(mercury);
assert.equal(baseLook.ok, true, 'mercury must adapt');
if (!baseLook.ok) throw new Error('unreachable');

/** Craft a synthetic look from the real mercury projection. */
function makeLook(overrides) {
  return { ...baseLook.look, ...overrides };
}

const defaultState = () =>
  JSON.parse(JSON.stringify({ ...DEFAULT_EXPLORE_STATE, filters: { ...EMPTY_EXPLORE_FILTERS } }));

// ---------------------------------------------------------------------------
// 1 · URL canonical round-trip + determinism + key order
// ---------------------------------------------------------------------------
{
  const canonical = {
    tab: 'creators',
    q: 'hello world',
    sort: 'new',
    filters: {
      source: 'official',
      style: 'ST-01',
      color: 'champagne',
      shape: 'almond',
      length: 'medium',
      occasion: ['party', 'date'],
      effect: ['chrome'],
      mood: [],
      application: 'STRUCTURED_EDITABLE',
      verification: 'RENDER_VERIFIED',
    },
  };
  const serialized = serializeExploreState(canonical);
  assert.equal(
    serialized,
    'tab=creators&q=hello+world&sort=new&source=official&style=ST-01&color=champagne&shape=almond&length=medium&occasion=party%2Cdate&effect=chrome&application=STRUCTURED_EDITABLE&verification=RENDER_VERIFIED',
    'canonical key order + encoding',
  );
  assert.deepEqual(parseExploreState(new URLSearchParams(serialized)), canonical, 'round-trip');
  assert.equal(serializeExploreState(canonical), serialized, 'serializer deterministic');

  // fixed point: parse(messy) → serialize → parse is identity
  const messy = new URLSearchParams(
    'q=%20%20mercury%20%20&sort=bogus&tab=weird&source=foo&application=MAGIC&occasion=a,,b,a,b&style=++&extra=1',
  );
  const parsedOnce = parseExploreState(messy);
  const parsedTwice = parseExploreState(new URLSearchParams(serializeExploreState(parsedOnce)));
  assert.deepEqual(parsedTwice, parsedOnce, 'canonical fixed point');

  // default state serializes to empty query
  assert.equal(serializeExploreState(defaultState()), '');
  assert.equal(exploreStateToSearchParams(defaultState()).toString(), '');
}

// ---------------------------------------------------------------------------
// 2 · Bad input sanitation
// ---------------------------------------------------------------------------
{
  const p = new URLSearchParams({
    tab: 'unknown',
    sort: 'magic',
    source: 'weird',
    application: 'MAGIC',
    verification: 'bogus',
    style: '   ',
    color: ' champagne ',
    length: ' medium ',
    q: 'x'.repeat(MAX_QUERY_LENGTH + 50),
    occasion: 'party,,date,party, ,date',
  });
  const state = parseExploreState(p);
  assert.equal(state.tab, 'looks', 'unknown tab → looks');
  assert.equal(state.sort, 'featured', 'unknown sort → featured');
  assert.equal(state.filters.source, 'all', 'unknown source → all');
  assert.equal(state.filters.application, null, 'unknown application → null');
  assert.equal(state.filters.verification, null, 'unknown verification → null');
  assert.equal(state.filters.style, null, 'blank style → null');
  assert.equal(state.filters.color, 'champagne', 'color trimmed');
  assert.equal(state.filters.length, 'medium', 'length trimmed');
  assert.equal(state.q.length, MAX_QUERY_LENGTH, 'q bounded to MAX_QUERY_LENGTH');
  assert.deepEqual(state.filters.occasion, ['party', 'date'], 'CSV dedupe + trim + drop empty');

  // enum values survive; whitespace around enums tolerated
  assert.equal(parseExploreState(new URLSearchParams({ tab: 'creators' })).tab, 'creators');
  assert.equal(parseExploreState(new URLSearchParams({ sort: 'trending' })).sort, 'trending');
  assert.equal(
    parseExploreState(new URLSearchParams({ application: ' APPROXIMATE ' })).filters.application,
    'APPROXIMATE',
  );
  assert.equal(
    parseExploreState(new URLSearchParams({ verification: 'RENDER_VERIFIED' })).filters
      .verification,
    'RENDER_VERIFIED',
  );
  assert.equal(parseExploreState(new URLSearchParams({ source: 'creators' })).filters.source, 'creators');
  assert.equal(parseExploreState(new URLSearchParams({ q: '  hi  ' })).q, 'hi', 'q trimmed');
}

// ---------------------------------------------------------------------------
// 3 · Look search fields (title / titleEn / publisher / taxonomy labels+IDs / tags)
// ---------------------------------------------------------------------------
{
  const rankWithQ = (q, looks = devLooks) =>
    rankLooks({
      looks,
      publishers,
      taxonomy,
      state: { ...defaultState(), q },
      trendingSignals: [],
      asOf: '2026-08-05T00:00:00.000Z',
    }).items.map(({ look }) => look.lookId);

  const ids = rankWithQ('mercury');
  assert.ok(ids.includes('cc_mercury_dew'), 'title search');

  const titleEnLook = makeLook({ lookId: 'x-title-en', title: '测试标题', titleEn: 'Aurora Blush' });
  const titleEnIds = rankWithQ('aurora', [titleEnLook]);
  assert.deepEqual(titleEnIds, ['x-title-en'], 'titleEn search');

  const byPublisherName = rankWithQ('atelier');
  assert.ok(byPublisherName.includes('cc_pugc_luna_blush'), 'publisher displayName search');
  assert.ok(byPublisherName.includes('cc_pugc_luna_pearl'), 'publisher displayName search (2)');

  const byHandle = rankWithQ('kai.chrome');
  assert.ok(byHandle.includes('cc_pugc_kai_circuit'), 'publisher handle search');
  assert.ok(byHandle.includes('cc_pugc_kai_oxblood'), 'publisher handle search (2)');

  const byStyleLabel = rankWithQ('french');
  assert.ok(byStyleLabel.includes('cc_petal_veil'), 'taxonomy style label search');
  assert.ok(byStyleLabel.includes('cc_micro_coquette'), 'taxonomy style label search (2)');

  const byEffectId = rankWithQ('cat-eye');
  assert.ok(byEffectId.includes('cc_mercury_dew'), 'taxonomy ID search');

  const byTag = rankWithQ('recommended');
  assert.ok(byTag.includes('cc_mercury_dew'), 'campaignTags search');
  assert.ok(byTag.includes('cc_petal_veil'), 'campaignTags search (2)');

  const tolerant = rankWithQ('  MERCURY   DEW ');
  assert.ok(tolerant.includes('cc_mercury_dew'), 'case/whitespace tolerant');
  assert.ok(tolerant.every((id) => id !== 'cc_pugc_kai_circuit'), 'no false positives');

  assert.deepEqual(rankWithQ('zzzznope'), [], 'no match → empty');
}

// ---------------------------------------------------------------------------
// 4 · Creator search (displayName / handle / bio; demo visibility)
// ---------------------------------------------------------------------------
{
  const search = (q, mode = 'integration') =>
    searchCreators({ publishers, mode, q }).map((p) => p.handle);

  assert.deepEqual(search('luna'), ['luna.atelier'], 'creator displayName search');
  assert.deepEqual(search('kai.chrome'), ['kai.chrome'], 'creator handle search');
  assert.deepEqual(search('海洋'), ['mio.ocean'], 'creator bio search (zh)');
  assert.deepEqual(
    search(''),
    ['kai.chrome', 'luna.atelier', 'mio.ocean'],
    'empty q → Creator type only, deterministic order',
  );

  assert.deepEqual(search('', 'production'), [], 'production hides demo creators and excludes official publisher');
  assert.deepEqual(search('luna', 'production'), [], 'production creator search hides demo');
  assert.deepEqual(search('zzz'), [], 'no match');
  assert.deepEqual(search('luna'), search('luna'), 'creator search deterministic');
}

// ---------------------------------------------------------------------------
// 5 · Color filtering (primaryColorIds) + combination
// ---------------------------------------------------------------------------
{
  const byColor = (color, extra = {}) =>
    filterLookReadModels(devLooks, { ...EMPTY_EXPLORE_FILTERS, color, ...extra }).map(
      (l) => l.lookId,
    );
  assert.deepEqual(byColor('champagne').sort(), [
    'cc_micro_coquette',
    'cc_mercury_dew',
    'cc_starfish_bloom',
    'cc_pugc_luna_blush',
    'cc_pugc_luna_pearl',
  ].sort(), 'color=champagne → primaryColorIds match');
  assert.deepEqual(byColor('ocean').sort(), [
    'cc_pearl_tide',
    'cc_pugc_kai_mirror',
    'cc_sea_glass_chrome',
    'cc_starfish_bloom',
  ].sort());
  assert.deepEqual(byColor('hotpink'), [], 'unknown color → zero matches, no throw');
  assert.equal(byColor(null).length, devLooks.length, 'color null → no color constraint');
  assert.deepEqual(
    byColor('champagne', { source: 'official' }).sort(),
    ['cc_micro_coquette', 'cc_mercury_dew', 'cc_starfish_bloom'].sort(),
    'color + source combination',
  );
}

// ---------------------------------------------------------------------------
// 6 · Ranking: New / Featured / Trending (window, min samples, fallback)
// ---------------------------------------------------------------------------
{
  const a = makeLook({ lookId: 'z-look', publishedAt: '2026-08-01T00:00:00.000Z', curationStatus: 'NONE', campaignTags: [] });
  const b = makeLook({ lookId: 'a-look', publishedAt: '2026-08-01T00:00:00.000Z', curationStatus: 'NONE', campaignTags: [] });
  const c = makeLook({ lookId: 'm-look', publishedAt: '2026-08-03T00:00:00.000Z', curationStatus: 'FEATURED_BY_OFFICIAL', campaignTags: [] });
  const d = makeLook({ lookId: 't-look', publishedAt: '2026-08-02T00:00:00.000Z', curationStatus: 'NONE', campaignTags: ['recommended'] });
  const crafted = [a, b, c, d];
  const asOf = '2026-08-05T00:00:00.000Z';

  const idsFor = (result) => result.items.map(({ look }) => look.lookId);
  const rank = (sort, looks = crafted, signals = []) =>
    rankLooks({
      looks,
      publishers,
      taxonomy,
      state: { ...defaultState(), sort },
      trendingSignals: signals,
      asOf,
    });

  // New: publishedAt desc, stable lookId tie-breaker
  const newIds = idsFor(rank('new'));
  assert.deepEqual(newIds, ['m-look', 't-look', 'a-look', 'z-look'], 'new order + lookId tie-break');
  assert.equal(compareNew(a, b) > 0, true, 'z-look after a-look on tie');
  assert.equal(compareNew(c, d) < 0, true, 'later publishedAt first');

  // Featured: editorial signal first, then New; stable
  const featIds = idsFor(rank('featured'));
  assert.deepEqual(featIds, ['m-look', 't-look', 'a-look', 'z-look'], 'featured order');
  assert.equal(hasEditorialSignal(c), true, 'FEATURED_BY_OFFICIAL is editorial');
  assert.equal(hasEditorialSignal(d), true, 'recommended campaign tag is editorial');
  assert.equal(
    hasEditorialSignal(makeLook({ curationStatus: 'NONE', campaignTags: ['arbitrary-tag'] })),
    false,
    'arbitrary metadata tag is not an editorial signal',
  );
  assert.equal(hasEditorialSignal(a), false, 'plain look is not editorial');
  assert.equal(compareFeatured(a, c) > 0, true, 'editorial before non-editorial');

  // Trending window + min samples + fallback
  const inWindow = (lookId, sessionKey, day = 3) => ({
    lookId,
    occurredAt: `2026-08-0${day}T10:00:00.000Z`,
    sessionKey,
  });
  const stale = { lookId: 'a-look', occurredAt: '2026-07-01T10:00:00.000Z', sessionKey: 'u0' };

  const noSignals = resolveEffectiveSort('trending', [], asOf);
  assert.deepEqual(noSignals, {
    requested: 'trending',
    applied: 'featured',
    fallbackReason: 'trending_no_signals',
  });

  const belowMin = [
    inWindow('a-look', 'u1'),
    inWindow('a-look', 'u2'),
    inWindow('z-look', 'u1'),
  ];
  const insufficient = resolveEffectiveSort('trending', belowMin, asOf);
  assert.deepEqual(insufficient, {
    requested: 'trending',
    applied: 'featured',
    fallbackReason: 'trending_insufficient_samples',
  });

  const qualified = [
    inWindow('a-look', 'u1'),
    inWindow('a-look', 'u2'),
    inWindow('a-look', 'u3'),
    inWindow('z-look', 'u1'),
    inWindow('z-look', 'u2'),
    stale,
  ];
  assert.equal(
    resolveEffectiveSort('trending', qualified, asOf).applied,
    'trending',
    'qualified signals apply trending (stale ignored)',
  );
  const counts = trendingCounts(qualified, asOf, DEFAULT_TRENDING_CONFIG);
  assert.equal(counts.get('a-look').distinctSamples, 3, 'distinct session dedupe');
  assert.equal(counts.get('z-look').distinctSamples, 2);
  assert.equal(counts.has('zz-none'), false);

  const trendingIds = idsFor(rank('trending', crafted, qualified));
  assert.deepEqual(
    trendingIds,
    ['a-look', 'z-look', 'm-look', 't-look'],
    'trending: distinct-sample desc, then new order',
  );
  const ranked = rank('trending', crafted, qualified);
  assert.equal(ranked.items[0].trendingDistinctSamples, 3, 'trending sample count exposed');

  // asOf injection: same signals, earlier asOf → window excludes them → fallback
  const early = resolveEffectiveSort('trending', qualified, '2026-07-10T00:00:00.000Z');
  assert.equal(early.applied, 'featured', 'window bound respected (asOf injected)');
  assert.equal(early.fallbackReason, 'trending_no_signals', 'all signals stale → no signals');

  // fallback inside rankLooks: applied=featured with reason, still deterministic
  const fallbackRank = rank('trending', crafted, belowMin);
  assert.deepEqual(fallbackRank.effectiveSort, insufficient);
  assert.deepEqual(idsFor(fallbackRank), featIds, 'fallback order == featured order');

  const unknownOnly = [inWindow('deleted-look', 'u1'), inWindow('deleted-look', 'u2'), inWindow('deleted-look', 'u3')];
  assert.equal(
    rank('trending', crafted, unknownOnly).effectiveSort.fallbackReason,
    'trending_no_signals',
    'signals for unavailable looks cannot qualify the visible feed',
  );

  assert.equal(trendingCounts([{ lookId: '', occurredAt: 'bad', sessionKey: '' }], asOf).size, 0);
  assert.equal(
    trendingCounts(qualified, 'bad-as-of').size,
    0,
    'invalid clock input fails closed',
  );

  assert.equal(DEFAULT_TRENDING_CONFIG.windowMs, 7 * 24 * 60 * 60 * 1000, '7-day window default');
  assert.equal(DEFAULT_TRENDING_CONFIG.minDistinctSamples, 3, 'min distinct samples default');
}

// ---------------------------------------------------------------------------
// 7 · Stable ordering + no input mutation
// ---------------------------------------------------------------------------
{
  const state = { ...defaultState(), q: 'mercury', sort: 'new' };
  const looks = devLooks.slice(0, 5);
  const snapshot = JSON.stringify(looks);
  const first = rankLooks({
    looks,
    publishers,
    taxonomy,
    state,
    trendingSignals: [],
    asOf: '2026-08-05T00:00:00.000Z',
  });
  const second = rankLooks({
    looks,
    publishers,
    taxonomy,
    state,
    trendingSignals: [],
    asOf: '2026-08-05T00:00:00.000Z',
  });
  assert.deepEqual(second, first, 'same input → identical ranking');
  assert.equal(JSON.stringify(looks), snapshot, 'ranking never mutates input looks');
  const filterSnapshot = JSON.stringify(devLooks);
  filterLookReadModels(devLooks, { ...EMPTY_EXPLORE_FILTERS, color: 'ocean' });
  assert.equal(JSON.stringify(devLooks), filterSnapshot, 'filtering never mutates input');
}

// ---------------------------------------------------------------------------
// 8 · No Made / engagement inference anywhere
// ---------------------------------------------------------------------------
{
  const result = rankLooks({
    looks: devLooks,
    publishers,
    taxonomy,
    state: defaultState(),
    trendingSignals: [],
    asOf: '2026-08-05T00:00:00.000Z',
  });
  const serialized = JSON.stringify(result);
  for (const key of ['madeCount', 'made', 'engagement', 'likes', 'views', 'favorites', 'saved']) {
    assert.ok(!serialized.includes(`"${key}"`), `ranking output must not fabricate ${key}`);
  }
  const lookJson = JSON.stringify(devLooks);
  assert.ok(!lookJson.includes('"madeCount"'), 'read models must not fabricate madeCount');
  assert.ok(!lookJson.includes('"engagement"'), 'read models must not fabricate engagement');
}

// ---------------------------------------------------------------------------
// 9 · Route / card wiring + entry-link contract + purity
// ---------------------------------------------------------------------------
{
  assert.equal(Routes.communitySearch, '/search', 'canonical search route');

  const app = read('src/app/App.tsx');
  assert.match(app, /Routes\.communitySearch[\s\S]*CommunitySearchPage/, 'search route wired');
  assert.match(
    app,
    /element=\{<CommunityLayout \/>\}[\s\S]*Routes\.communitySearch/,
    'search route nested inside community shell',
  );

  const layout = read('src/app/layouts/CommunityLayout.tsx');
  assert.match(layout, /Routes\.communitySearch/, 'nav entry uses canonical route');
  assert.match(layout, /text\('搜索', 'Search'\)/, 'nav label');

  const searchPage = read('src/community/pages/CommunitySearchPage.tsx');
  assert.match(searchPage, /mode="search"/, 'search page uses search mode');

  const feed = read('src/community/components/CommunityFeed.tsx');
  assert.match(feed, /loadLookReadModels/, 'feed consumes look read models');
  assert.match(feed, /parseDiscoveryQueryV2/, 'feed parses URL via discovery-query v2');
  assert.match(feed, /serializeDiscoveryQueryV2/, 'feed serializes URL via discovery-query v2');
  assert.match(feed, /executeDiscoveryQueryV2/, 'feed runs the v2 pure pipeline');
  assert.match(feed, /CommunityDiscoveryRuntimeFilters/, 'feed renders v2 runtime filters');
  assert.match(feed, /community-incompatible-filters/, 'feed surfaces incompatible conditions');
  assert.match(feed, /mergeDiscoveryQueryIncompatibleParams/, 'feed merges raw incompatible values via the pure preservation helper');
  assert.match(feed, /removeDiscoveryQueryIncompatibleIssue/, 'feed removes incompatible issues via the pure removal helper');
  assert.doesNotMatch(feed, /\.getAll\(/, 'no inline raw-value re-append loop in the feed');
  assert.doesNotMatch(feed, /\.append\(/, 'no inline append loop in the feed');
  assert.match(feed, /CommunityLookCard/, 'feed renders look cards');
  assert.match(feed, /CommunityCreatorCard/, 'feed renders creator cards');
  assert.match(feed, /community-feed-empty/, 'empty state kept');
  assert.doesNotMatch(feed, /filterLookReadModels/, 'feed never uses the legacy V1 filter');
  assert.doesNotMatch(feed, /<CommunityFilters/, 'feed never renders the legacy filters panel');
  assert.doesNotMatch(feed, /from ['"]three|EditorHqPreview/, 'no Three.js in feed');
  assert.doesNotMatch(feed, /localStorage|useToast/, 'no fake persistence/toast in feed');

  const card = read('src/community/components/CommunityLookCard.tsx');
  assert.match(card, /<article/, 'card root is an article, not a button');
  assert.match(card, /Routes\.communityLook\(look\.lookId\)/, 'canonical detail link');
  assert.doesNotMatch(card, /Routes\.communityContent\(/, 'no legacy content route');
  assert.match(card, /look-card-save/, 'Save action present');
  assert.match(card, /disabled=\{!onSave\}/, 'Save enabled when onSave injected (COMM-03)');
  assert.match(card, /onSave/, 'Save wired through parent-provided onSave');
  assert.doesNotMatch(card, /COMM-03/, 'Save no longer claims COMM-03 unavailability');
  assert.match(card, /look-card-use/, 'Use action present');
  assert.match(card, /look-card-use-disabled/, 'asset-incomplete Use action is disabled');
  assert.match(card, /resolveStudioUseAvailabilityV1/, 'Use state comes from the domain projection');
  assert.match(card, /look-card-made/, 'Made action present');
  assert.match(card, /Made.*—|—/, 'Made displays unavailable dash');
  assert.match(card, /community-card-cover-fallback/, 'cover fallback kept');
  assert.match(card, /line-clamp-2/, 'long-title clamping');
  assert.doesNotMatch(card, /localStorage|useToast|Date\.now/, 'card does not fake persistence');
  assert.doesNotMatch(card, /from ['"]three/, 'no Three.js in card');

  const creatorCard = read('src/community/components/CommunityCreatorCard.tsx');
  assert.match(creatorCard, /Routes\.communityProfile\(publisher\.handle\)/, 'creator → profile link');
  assert.match(creatorCard, /PublisherBadge/, 'official/demo visually distinguished');

  // entry-link: internal navigation preserves the four Studio entry-context keys
  const entryContext = new URLSearchParams({
    entry: 'wizard',
    return_to: '/studio/design/new?fresh=1',
    shape: 'almond',
    length: 'medium',
    style: 'ST-01',
    color: 'champagne',
    q: 'mercury',
    sort: 'new',
    tab: 'creators',
  });
  const officialUrl = new URL(communityInternalHref('/official', entryContext), 'https://local.test');
  assert.equal(officialUrl.searchParams.get('entry'), 'wizard');
  assert.equal(officialUrl.searchParams.get('return_to'), '/studio/design/new?fresh=1');
  assert.equal(officialUrl.searchParams.get('shape'), 'almond');
  assert.equal(officialUrl.searchParams.get('length'), 'medium');
  for (const dropped of ['style', 'color', 'q', 'sort', 'tab', 'source']) {
    assert.equal(officialUrl.searchParams.has(dropped), false, `internal nav must drop ${dropped}`);
  }

  // purity of the pure module
  const pure = read('src/community/domain/v7_1/explore-search.ts');
  assert.doesNotMatch(pure, /Date\.now/, 'pure ranker never reads the clock');
  assert.doesNotMatch(pure, /import\.meta|fetch\(/, 'pure module has no browser/env access');

  // no Three.js anywhere in the community module
  const walk = (dir) =>
    fs.readdirSync(dir, { withFileTypes: true }).flatMap((ent) => {
      const p = path.join(dir, ent.name);
      return ent.isDirectory() ? walk(p) : /\.[jt]sx?$/.test(ent.name) ? [p] : [];
    });
  for (const file of walk(path.join(root, 'src/community'))) {
    assert.doesNotMatch(fs.readFileSync(file, 'utf8'), /from ['"]three/, `${file} must not import three`);
  }

  // package script present
  const pkg = JSON.parse(read('package.json'));
  assert.ok(
    pkg.scripts['test:community-v7-1-explore-search']?.includes('test-community-v7-1-explore-search.mjs'),
    'package script registered',
  );
}

console.log(
  `[test:community-v7-1-explore-search] PASS · devLooks=${devLooks.length} prodLooks=${prodLooks.length}`,
);
