#!/usr/bin/env node
/**
 * test-community-tax-04-home-ui.mjs · COMM-v0.7.2-TAX-04
 * 首页主/次浏览导航 + 运行时筛选增强的结构契约测试。
 *
 * Covers:
 *  - strict taxonomy fixture 加载（parseCommunityTaxonomyV2）；
 *  - 主浏览精确顺序契约被消费：PRIMARY_BROWSE_IDS 顺序渲染、标签来自
 *    taxonomy、无第六个法式主入口；
 *  - recommendation 次行过滤 requiresRelationshipProvider（Following/
 *    关注新作 不出现），维度次行保留全部 ACTIVE tags（不截断词表）；
 *  - 次行横向滚动结构（overflow-x-auto + shrink-0）、>=44px 目标；
 *  - 会话记忆：useRef 内存、URL 状态同步、绝不读写 localStorage /
 *    sessionStorage、绝不挂载自动导航（useEffect 体内无 onChange）；
 *  - Feed 接线：新组件在搜索/tabs 之后、排序/运行时筛选之前，仅 look
 *    呈现，relationshipProviderAvailable=false；
 *  - 运行时筛选增强：已选条件 chips（collision-free testid）、兼容标记已
 *    代表的 canonical 辅助 id 不重复出 chip/计数、单条移除只移除该 id、
 *    一键 clear-all（incompatible 非空或可清除条件数为零时隐藏、保留
 *    tab/source）、非默认 source 计为活动条件但不启用 clear-all（仅 source
 *    非默认时 clear-all 是 no-op）、条件摘要与结果数、抽屉辅助清除保留；
 *  - 无 legacy CommunityFilters / filterLookReadModels。
 *
 * 静态/结构验证沿用仓库既定模式（.tsx 由源码断言，纯 .ts 由 Node 直接
 * 执行）；可见次行集合/顺序由 strict fixture 驱动断言。
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import {
  DEFAULT_RECOMMENDATION_CHANNEL,
  FOLLOWING_CHANNEL_ID,
  PRIMARY_BROWSE_DIMENSION,
  PRIMARY_BROWSE_IDS,
  REQUIRED_TAG_IDS,
} from '../src/community/domain/taxonomy-v2/contract.ts';
import { parseCommunityTaxonomyV2 } from '../src/community/domain/taxonomy-v2/parse.ts';
import { parseMigrationManifestV1 } from '../src/community/domain/taxonomy-v2/migration-manifest.ts';
import {
  CARD_TAG_DIMENSION_ORDER,
  CARD_TAG_PILL_MAX,
  DISCOVERY_DETAIL_GROUP_ORDER,
  cardTagIdsForDiscovery,
  discoveryDetailGroups,
  discoveryGroupLabel,
  findV2TagById,
  makeabilityTagIdForDiscovery,
  resolveV2TagLabel,
  rightsTagIdForDiscovery,
} from '../src/community/domain/taxonomy-v2/presentation.ts';
import { actionPermissions } from '../src/community/domain/taxonomy-v2/governance.ts';

const root = process.cwd();
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

const fixtureRaw = JSON.parse(read('public/community/taxonomy-v2.json'));
const strict = parseCommunityTaxonomyV2(fixtureRaw);
assert.equal(strict.ok, true, 'taxonomy-v2 fixture must strict-parse before the suite runs');
const taxonomy = strict.value;

const manifestRaw = JSON.parse(read('public/community/migration-manifest-v1.json'));
const manifestResult = parseMigrationManifestV1(manifestRaw, taxonomy);
assert.equal(
  manifestResult.ok,
  true,
  'migration-manifest-v1 fixture must strict-parse before the suite runs',
);
const manifestEntries = manifestResult.value.entries;

const nav = read('src/community/components/CommunityDiscoveryBrowseNavigation.tsx');
const filters = read('src/community/components/CommunityDiscoveryRuntimeFilters.tsx');
const feed = read('src/community/components/CommunityFeed.tsx');
const card = read('src/community/components/CommunityLookCard.tsx');
const metadata = read('src/community/components/CommunityDiscoveryMetadata.tsx');
const page = read('src/community/pages/CommunityLookPage.tsx');

let passed = 0;
let failed = 0;
const failures = [];

function test(name, fn) {
  try {
    fn();
    passed += 1;
  } catch (error) {
    failed += 1;
    failures.push(`${name}\n    ${error.message}`);
  }
}

/** Extract the balanced body of the first `name(...)` call in source. */
function callBody(source, name) {
  const start = source.indexOf(`${name}(`);
  assert.ok(start >= 0, `expected a ${name}( call in source`);
  const open = source.indexOf('(', start);
  let depth = 0;
  for (let i = open; i < source.length; i += 1) {
    if (source[i] === '(') depth += 1;
    else if (source[i] === ')') {
      depth -= 1;
      if (depth === 0) return source.slice(open + 1, i);
    }
  }
  throw new Error(`unbalanced ${name}( call in source`);
}

/**
 * Extract the balanced `{ ... }` body of `const name = (…): … => { … };`.
 * Bounded to the first `const name =` declaration, so a later `name(...)`
 * invocation elsewhere in the file cannot be confused with the definition.
 */
function arrowFnBody(source, name) {
  const decl = `const ${name} =`;
  const start = source.indexOf(decl);
  assert.ok(start >= 0, `expected a const ${name} = declaration in source`);
  const open = source.indexOf('{', start);
  assert.ok(open >= 0, `expected a { body for const ${name}`);
  let depth = 0;
  for (let i = open; i < source.length; i += 1) {
    if (source[i] === '{') depth += 1;
    else if (source[i] === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(open + 1, i);
    }
  }
  throw new Error(`unbalanced ${name} arrow body in source`);
}

/**
 * Strip /* block comments *\/ and // line comments so assertions target
 * executable code, not documentation prose. The `[^:]` guard on line
 * comments keeps `https://`-style string contents intact.
 */
function stripComments(source) {
  const withoutBlocks = source.replace(/\/\*[\s\S]*?\*\//g, '');
  return withoutBlocks.replace(/(^|[^:])\/\/[^\n]*/gm, '$1');
}

function countOccurrences(source, token) {
  return source.split(token).length - 1;
}

// ---------------------------------------------------------------------------
// 1 · Fixture / contract ground truth
// ---------------------------------------------------------------------------

test('strict taxonomy fixture parses (COMM-v0.7.2-TAX-01)', () => {
  assert.equal(strict.ok, true);
  assert.equal(taxonomy.contractVersion, 'COMM-v0.7.2-TAX-01');
});

test('primary browse order contract: exactly five entries, no sixth French entry', () => {
  assert.deepEqual(
    [...PRIMARY_BROWSE_IDS],
    ['recommended', 'shape', 'style', 'scene', 'theme'],
    'PRIMARY_BROWSE_IDS must be the exact PRD order',
  );
  const primaryIds = taxonomy.browse.primary.map((entry) => entry.id);
  assert.deepEqual(primaryIds, [...PRIMARY_BROWSE_IDS], 'fixture primary order must match the contract');
  assert.equal(primaryIds.length, 5, 'no extra primary entry');
  for (const entry of taxonomy.browse.primary) {
    assert.ok(!/french/.test(entry.id), `no French primary entry (got ${entry.id})`);
  }
});

test('recommended default subchannel is for-you and following requires a relationship provider', () => {
  const recommended = taxonomy.browse.primary.find((entry) => entry.id === 'recommended');
  assert.equal(recommended?.defaultSubchannelId, DEFAULT_RECOMMENDATION_CHANNEL);
  const following = taxonomy.browse.recommendationChannels.find(
    (channel) => channel.id === FOLLOWING_CHANNEL_ID,
  );
  assert.equal(following?.requiresRelationshipProvider, true);
});

// ---------------------------------------------------------------------------
// 2 · Visible secondary sets/order for all five primary entries (fixture-driven)
// ---------------------------------------------------------------------------

test('recommended secondary: channels in taxonomy order, Following excluded', () => {
  const visible = taxonomy.browse.recommendationChannels
    .filter((channel) => !channel.requiresRelationshipProvider)
    .map((channel) => channel.id);
  assert.deepEqual(
    visible,
    ['for-you', 'trending', 'new', 'editorial', 'makeable', 'dimensional', 'emerging-creator', 'collections'],
    'visible recommendation channels: taxonomy order, relationship-gated channels filtered',
  );
  assert.ok(!visible.includes(FOLLOWING_CHANNEL_ID), 'Following must never appear');
  for (const channel of taxonomy.browse.recommendationChannels) {
    if (channel.requiresRelationshipProvider) {
      assert.ok(!visible.includes(channel.id), `${channel.id} must be filtered out`);
    }
  }
  assert.equal(taxonomy.browse.recommendationChannels.length, 9, 'fixture defines all nine channels');
});

for (const browse of ['shape', 'style', 'scene', 'theme']) {
  test(`dimension secondary ${browse}: all ACTIVE tags retained in exact taxonomy order`, () => {
    const dimension = PRIMARY_BROWSE_DIMENSION[browse];
    assert.ok(dimension, `${browse} must map to a dimension`);
    const tags = taxonomy.dimensions[dimension].tags;
    const visible = tags.filter((tag) => tag.lifecycle === 'ACTIVE').map((tag) => tag.id);
    assert.deepEqual(
      visible,
      [...REQUIRED_TAG_IDS[dimension]],
      `${browse} visible set must equal the contract REQUIRED_TAG_IDS order`,
    );
    assert.equal(
      visible.length,
      tags.length,
      `${browse}: every fixture tag is ACTIVE — nothing truncated from the vocabulary`,
    );
  });
}

// ---------------------------------------------------------------------------
// 3 · CommunityDiscoveryBrowseNavigation structure
// ---------------------------------------------------------------------------

test('nav: consumes PRIMARY_BROWSE_IDS and renders taxonomy entries in that order', () => {
  assert.match(nav, /import\s*\{[\s\S]*PRIMARY_BROWSE_IDS/, 'imports the primary order contract');
  assert.match(nav, /PRIMARY_BROWSE_IDS\.map\(/, 'primary row iterates the contract order');
  assert.match(nav, /new Map\(taxonomy\.browse\.primary\.map/, 'entries come from the taxonomy');
  assert.match(nav, /entry\.labels/, 'labels come from the taxonomy entries (bilingual)');
  assert.match(nav, /aria-pressed=\{active\}/, 'semantic buttons with aria-pressed');
  assert.match(nav, /data-testid=\{`browse-primary-\$\{id\}`\}/, 'per-entry testid');
});

test('nav: recommendation secondary filters requiresRelationshipProvider; dimension uses ACTIVE tags', () => {
  assert.match(nav, /requiresRelationshipProvider/, 'relationship-gated channels filtered');
  assert.match(nav, /!channel\.requiresRelationshipProvider \|\| relationshipProviderAvailable/, 'filter predicate');
  assert.match(nav, /PRIMARY_BROWSE_DIMENSION/, 'dimension mapping consumed');
  assert.match(nav, /tag\.lifecycle === 'ACTIVE'/, 'only ACTIVE tags offered');
  assert.match(nav, /collectBrowseSecondaryOptions/, 'shared pure derivation helper');
});

test('nav: secondary row is horizontal scroll with non-shrinking children', () => {
  assert.match(nav, /overflow-x-auto/, 'scroll container');
  assert.match(nav, /shrink-0/, 'flex children never shrink');
  assert.match(nav, /flex w-max items-center gap-2/, 'natural-width flex row');
});

test('nav: >=44px targets on primary and secondary buttons', () => {
  assert.match(nav, /min-h-11 rounded-full border px-4 text-sm/, 'primary target');
  assert.match(nav, /shrink-0 min-h-11 rounded-full border px-3/, 'secondary target');
});

test('nav: session memory is a ref, kept in sync, never storage, never auto-navigates', () => {
  assert.match(nav, /useRef/, 'memory lives in a ref');
  assert.match(nav, /topicMemory/, 'memory named and used');
  assert.match(nav, /topicMemory\.current\[state\.browse\] = state\.topic/, 'URL state syncs memory');
  assert.match(nav, /topicMemory\.current\[browse\]/, 'memory seeds the next explicit selection');
  assert.doesNotMatch(stripComments(nav), /localStorage|sessionStorage/, 'no web storage access in executable code');
  const effectBody = callBody(nav, 'useEffect');
  assert.doesNotMatch(effectBody, /onChange|setSearchParams|applyState/, 'mount effect never navigates');
  assert.equal(
    countOccurrences(nav, 'onChange('),
    2,
    'onChange fires only from the two explicit handlers (selectPrimary / selectSecondary)',
  );
});

test('nav: no dropdown, no sixth French primary in render', () => {
  assert.doesNotMatch(nav, /<select|role="listbox"|Combobox/, 'no dropdown control');
  assert.doesNotMatch(nav, /french/i, 'no French primary entry');
});

// ---------------------------------------------------------------------------
// 4 · CommunityFeed wiring
// ---------------------------------------------------------------------------

test('feed: wires the new navigation after search/tabs and before sort/runtime filters', () => {
  const searchBar = feed.indexOf('<CommunitySearchBar');
  const navIndex = feed.indexOf('<CommunityDiscoveryBrowseNavigation');
  const sortIndex = feed.indexOf('<CommunitySortControl');
  const filtersIndex = feed.indexOf('<CommunityDiscoveryRuntimeFilters');
  assert.ok(searchBar >= 0 && navIndex >= 0 && sortIndex >= 0 && filtersIndex >= 0, 'all markers present');
  assert.ok(navIndex > searchBar, 'navigation renders after the search bar');
  assert.ok(navIndex < sortIndex, 'navigation renders before the sort control');
  assert.ok(navIndex < filtersIndex, 'navigation renders before the runtime filters');
  assert.match(feed, /relationshipProviderAvailable=\{false\}/, 'relationship provider stays unavailable');
  assert.match(feed, /onChange=\{applyState\}/, 'all navigation changes go through applyState');
  assert.doesNotMatch(feed, /<CommunityFilters/, 'no legacy filters panel');
  assert.doesNotMatch(feed, /filterLookReadModels/, 'no legacy V1 filter');
  assert.doesNotMatch(feed, /localStorage|sessionStorage/, 'feed keeps no storage access');
});

// ---------------------------------------------------------------------------
// 5 · CommunityDiscoveryRuntimeFilters enhancements
// ---------------------------------------------------------------------------

test('filters: visible removable selected-condition chips with collision-free testids', () => {
  assert.match(filters, /community-selected-conditions/, 'selected conditions row');
  assert.match(filters, /selected-condition-\$\{chip\.id\}/, 'chip testid is the unique tag id');
  assert.match(filters, /remove-condition-\$\{chip\.id\}/, 'remove testid is the unique tag id');
  assert.match(filters, /data-testid=\{`remove-condition-\$\{chip\.id\}`\}/, 'remove is a button');
  assert.match(filters, /min-h-11 min-w-11/, '>=44px remove target');
  assert.match(filters, /labels\['zh-CN'\]/, 'chips use V2 labels');
});

test('filters: single remove removes only that id', () => {
  assert.match(filters, /removeAuxId/, 'dedicated single-remove handler');
  assert.match(filters, /\.filter\(\(candidate\) => candidate !== id\)/, 'removes only the one id');
  assert.doesNotMatch(
    filters.slice(filters.indexOf('removeAuxId'), filters.indexOf('removeAuxId') + 260),
    /includes\(id\)/,
    'single remove never toggles on',
  );
});

test('filters: compatibility markers stay separate and removable', () => {
  assert.match(filters, /compatibility-marker-\$\{marker\.code\}/, 'marker chips kept');
  assert.match(filters, /onRemoveMarker\(marker\)/, 'marker removal unchanged');
});

test('filters: one-click clear-all resets discovery filters and preserves tab/source', () => {
  assert.match(filters, /community-runtime-clear-all/, 'clear-all control present');
  const clearAllBody = arrowFnBody(filters, 'clearAll');
  assert.match(clearAllBody, /\.\.\.state/, 'preserves tab and source (spread)');
  assert.match(clearAllBody, /q: ''/, 'clears q');
  assert.match(clearAllBody, /sort: 'featured'/, 'sort back to featured');
  assert.match(clearAllBody, /browse: 'recommended'/, 'browse back to recommended');
  assert.match(clearAllBody, /topic: DEFAULT_RECOMMENDATION_CHANNEL/, 'topic back to for-you');
  assert.match(clearAllBody, /lengthIds: \[\],/, 'clears length ids');
  assert.match(clearAllBody, /makeabilityIds: \[\],/, 'clears makeability ids');
  assert.match(clearAllBody, /rightsIds: \[\],/, 'clears rights ids');
  assert.match(clearAllBody, /techniqueIds: \[\],/, 'clears technique ids');
  assert.match(clearAllBody, /incompatible: \[\],/, 'clears incompatible issues');
  assert.match(clearAllBody, /markers: \[\],/, 'clears compatibility markers');
});

test('filters: global clear-all is offered only when compatible AND at least one clearable condition exists', () => {
  assert.match(
    filters,
    /canClearAll = state\.incompatible\.length === 0 && clearableConditionCount > 0/,
    'guard derives from incompatible state and the clearable condition count',
  );
  assert.match(filters, /\{canClearAll && \(/, 'clear-all renders only when the guard holds');
});

test('filters: source-only conditions count active in the summary but never enable clear-all', () => {
  assert.match(
    filters,
    /state\.source !== 'all' \? 1 : 0/,
    'non-default source counts once in the active summary',
  );
  assert.match(filters, /const clearableConditionCount =/, 'clearable count is derived separately');
  const clearableBody = filters.slice(
    filters.indexOf('const clearableConditionCount'),
    filters.indexOf('const markers = state.markers;'),
  );
  assert.doesNotMatch(
    clearableBody,
    /state\.source/,
    'clearable count excludes source because clear-all preserves it',
  );
  assert.match(
    clearableBody,
    /state\.browse !== 'recommended' \|\| state\.topic !== DEFAULT_RECOMMENDATION_CHANNEL \? 1 : 0/,
    'browse/topic counts as one clearable condition',
  );
  assert.match(clearableBody, /state\.q !== '' \? 1 : 0/, 'q counts as clearable');
  assert.match(clearableBody, /state\.sort !== 'featured' \? 1 : 0/, 'sort counts as clearable');
  assert.match(clearableBody, /state\.markers\.length/, 'markers count as clearable');
  assert.match(
    filters,
    /canClearAll = state\.incompatible\.length === 0 && clearableConditionCount > 0/,
    'source-only active state leaves clearableConditionCount at 0, hiding the no-op clear-all',
  );
});

test('filters: aux ids represented by compatibility markers are not duplicated as chips or counts', () => {
  assert.match(filters, /markerRepresentedAuxIds/, 'marker-represented aux id set is derived');
  assert.match(filters, /canonicalKey === 'length'/, 'length compatibility markers tracked');
  assert.match(filters, /canonicalKey === 'technique'/, 'technique compatibility markers tracked');
  assert.match(
    filters,
    /\.filter\(\(id\) => !markerRepresentedAuxIds\.has\(id\)\)/,
    'selected chips exclude marker-represented ids',
  );
  assert.match(
    filters,
    /state\.lengthIds\.filter\(\(id\) => !markerRepresentedAuxIds\.has\(id\)\)\.length/,
    'condition count excludes marker-represented length ids',
  );
  assert.match(
    filters,
    /state\.techniqueIds\.filter\(\(id\) => !markerRepresentedAuxIds\.has\(id\)\)\.length/,
    'condition count excludes marker-represented technique ids',
  );
  assert.match(filters, /state\.markers\.length/, 'markers still counted once via markers.length');
});

test('filters: non-default source counts as one active condition', () => {
  assert.match(
    filters,
    /state\.source !== 'all' \? 1 : 0/,
    'source counts once when it is not the default All',
  );
});

test('filters: result count and active condition summary shown; drawer aux-clear retained', () => {
  assert.match(filters, /community-runtime-result-count/, 'result count kept');
  assert.match(filters, /community-runtime-condition-summary/, 'active condition summary');
  assert.match(filters, /community-runtime-filter-clear/, 'drawer auxiliary clear remains');
});

test('filters: no effect-driven state changes (empty results never auto-widen)', () => {
  assert.doesNotMatch(filters, /useEffect|useMemo|useRef/, 'no effects/memos in the filters component');
  assert.equal(
    countOccurrences(filters, 'onChange('),
    5,
    'onChange fires only from the five explicit handlers (source chip, toggle, remove, clear-all, drawer clear)',
  );
  assert.doesNotMatch(filters, /localStorage|sessionStorage/, 'no storage access');
});

// ---------------------------------------------------------------------------
// 6 · TAX-04 presentation helpers (pure, controlled fixtures)
// ---------------------------------------------------------------------------

/**
 * Minimal well-typed discovery fixture. All fields the presentation helpers
 * touch are present; tests override only what they exercise.
 */
function discoveryFixture(overrides = {}) {
  return {
    schemaVersion: 1,
    contractRef: 'COMM-v0.7.2-TAX-01',
    subjectRef: { kind: 'PUBLISHED_LOOK', id: 'look:test' },
    styleIds: [],
    recommendedShapeIds: [],
    sceneIds: [],
    themeIds: [],
    techniqueIds: [],
    lengthIds: [],
    makeability: {
      classification: 'CONCEPT_ONLY',
      assetRefs: [],
      evidenceRefs: [],
    },
    rights: { status: 'ORIGINAL', evidenceRefs: [] },
    migration: {
      state: 'NONE',
      legacyStyleIds: [],
      migratedAt: '2026-08-17T00:00:00.000Z',
    },
    updatedAt: '2026-08-17T00:00:00.000Z',
    ...overrides,
  };
}

test('card pills: current browse dimension first, then the fixed fallback order', () => {
  const discovery = discoveryFixture({
    styleIds: ['style:minimal-clean', 'style:classic-refined'],
    techniqueIds: ['technique:french'],
    recommendedShapeIds: ['shape:almond', 'shape:oval'],
    sceneIds: ['scene:daily'],
    themeIds: ['theme:art-museum'],
  });
  // browse=style: STYLE first, then TECHNIQUE → SHAPE → SCENE → THEME.
  assert.deepEqual(
    cardTagIdsForDiscovery(discovery, 'style'),
    [
      'style:minimal-clean',
      'style:classic-refined',
      'technique:french',
      'shape:almond',
      'shape:oval',
      'scene:daily',
    ],
    'style browse: current dimension first, fixed fallback after',
  );
  // browse=shape: SHAPE first.
  assert.deepEqual(
    cardTagIdsForDiscovery(discovery, 'shape').slice(0, 2),
    ['shape:almond', 'shape:oval'],
    'shape browse: current dimension first',
  );
  assert.deepEqual(
    cardTagIdsForDiscovery(discovery, 'shape'),
    [
      'shape:almond',
      'shape:oval',
      'style:minimal-clean',
      'style:classic-refined',
      'technique:french',
      'scene:daily',
    ],
    'shape browse: full order',
  );
});

test('card pills: recommended browse has no extra dimension priority', () => {
  const discovery = discoveryFixture({
    styleIds: ['style:minimal-clean'],
    techniqueIds: ['technique:french'],
    recommendedShapeIds: ['shape:almond'],
    sceneIds: ['scene:daily'],
    themeIds: ['theme:art-museum'],
  });
  assert.deepEqual(
    cardTagIdsForDiscovery(discovery, 'recommended'),
    [
      'style:minimal-clean',
      'technique:french',
      'shape:almond',
      'scene:daily',
      'theme:art-museum',
    ],
    'recommended: plain fallback STYLE → TECHNIQUE → SHAPE → SCENE → THEME',
  );
  assert.deepEqual(
    [...CARD_TAG_DIMENSION_ORDER],
    ['STYLE', 'TECHNIQUE', 'SHAPE', 'SCENE', 'THEME'],
    'fallback order contract constant',
  );
});

test('card pills: de-duplicated by exact tag id (within and across arrays)', () => {
  const discovery = discoveryFixture({
    styleIds: ['style:minimal-clean', 'style:minimal-clean'],
    themeIds: ['style:minimal-clean'],
    techniqueIds: ['technique:french', 'technique:french'],
  });
  assert.deepEqual(
    cardTagIdsForDiscovery(discovery, 'recommended'),
    ['style:minimal-clean', 'technique:french'],
    'duplicate ids collapse to a single pill',
  );
});

test('card pills: capped at CARD_TAG_PILL_MAX (6)', () => {
  assert.equal(CARD_TAG_PILL_MAX, 6, 'card pill cap is exactly 6');
  const discovery = discoveryFixture({
    styleIds: ['style:a', 'style:b', 'style:c'],
    techniqueIds: ['technique:french'],
    recommendedShapeIds: ['shape:almond', 'shape:oval', 'shape:round'],
    sceneIds: ['scene:daily', 'scene:date', 'scene:bridal'],
    themeIds: ['theme:art-museum', 'theme:floral-plants'],
  });
  for (const browse of ['recommended', 'shape', 'style', 'scene', 'theme']) {
    const ids = cardTagIdsForDiscovery(discovery, browse);
    assert.ok(
      ids.length <= CARD_TAG_PILL_MAX,
      `${browse}: at most ${CARD_TAG_PILL_MAX} pills (got ${ids.length})`,
    );
  }
  // scene browse: scene ids first, then style up to the cap — theme excluded.
  const sceneIds = cardTagIdsForDiscovery(discovery, 'scene');
  assert.deepEqual(
    sceneIds,
    [
      'scene:daily',
      'scene:date',
      'scene:bridal',
      'style:a',
      'style:b',
      'style:c',
    ],
    'cap truncates after the first 6 in dimension order',
  );
  assert.ok(
    !sceneIds.some((id) => id.startsWith('theme:')),
    'ids beyond the cap never appear',
  );
});

test('card pills: rights/makeability/length ids never become pills', () => {
  const discovery = discoveryFixture({
    styleIds: ['style:minimal-clean'],
    lengthIds: ['length:short', 'length:long'],
    makeability: { classification: 'MACHINE_DIRECT', assetRefs: [], evidenceRefs: [] },
    rights: { status: 'PERSONAL_USE_ONLY', evidenceRefs: [] },
  });
  for (const browse of ['recommended', 'style', 'shape', 'scene', 'theme']) {
    const ids = cardTagIdsForDiscovery(discovery, browse);
    assert.ok(
      ids.every(
        (id) =>
          !id.startsWith('rights:') &&
          !id.startsWith('makeability:') &&
          !id.startsWith('length:'),
      ),
      `${browse}: no rights/makeability/length pill`,
    );
  }
});

test('detail groups: exact order STYLE→TECHNIQUE→SHAPE→SCENE→THEME→LENGTH, non-empty only', () => {
  assert.deepEqual(
    [...DISCOVERY_DETAIL_GROUP_ORDER],
    ['STYLE', 'TECHNIQUE', 'SHAPE', 'SCENE', 'THEME', 'LENGTH'],
    'detail group order contract',
  );
  const discovery = discoveryFixture({
    styleIds: ['style:minimal-clean'],
    techniqueIds: ['technique:french'],
    recommendedShapeIds: [],
    sceneIds: ['scene:daily'],
    themeIds: [],
    lengthIds: ['length:short'],
  });
  assert.deepEqual(
    discoveryDetailGroups(discovery),
    [
      { dimension: 'STYLE', ids: ['style:minimal-clean'] },
      { dimension: 'TECHNIQUE', ids: ['technique:french'] },
      { dimension: 'SCENE', ids: ['scene:daily'] },
      { dimension: 'LENGTH', ids: ['length:short'] },
    ],
    'empty groups skipped, remaining groups keep the required order',
  );
});

test('detail groups: all ids of a non-empty group are preserved', () => {
  const discovery = discoveryFixture({
    styleIds: ['style:minimal-clean', 'style:glamorous-sparkling'],
    recommendedShapeIds: ['shape:almond', 'shape:oval', 'shape:round'],
  });
  const groups = discoveryDetailGroups(discovery);
  assert.deepEqual(
    groups.find((group) => group.dimension === 'STYLE')?.ids,
    ['style:minimal-clean', 'style:glamorous-sparkling'],
  );
  assert.deepEqual(
    groups.find((group) => group.dimension === 'SHAPE')?.ids,
    ['shape:almond', 'shape:oval', 'shape:round'],
  );
  assert.equal(groups.length, 2, 'only the two non-empty groups');
});

test('status ids: makeability/rights derived from the existing contract maps', () => {
  const discovery = discoveryFixture({
    makeability: { classification: 'CONCEPT_ONLY', assetRefs: [], evidenceRefs: [] },
    rights: { status: 'ORIGINAL', evidenceRefs: [] },
  });
  assert.equal(
    makeabilityTagIdForDiscovery(discovery),
    'makeability:concept-only',
  );
  assert.equal(rightsTagIdForDiscovery(discovery), 'rights:original');
  assert.equal(
    rightsTagIdForDiscovery(
      discoveryFixture({ rights: { status: 'PERSONAL_USE_ONLY', evidenceRefs: [] } }),
    ),
    'rights:personal-use-only',
  );
  assert.equal(
    makeabilityTagIdForDiscovery(
      discoveryFixture({
        makeability: { classification: 'MACHINE_DIRECT', assetRefs: [], evidenceRefs: [] },
      }),
    ),
    'makeability:machine-direct',
  );
});

test('label resolution: exact namespaced V2 ids, bilingual, never legacy', () => {
  assert.equal(
    resolveV2TagLabel(taxonomy, 'style:minimal-clean', 'zh-CN'),
    '极简清爽',
  );
  assert.equal(
    resolveV2TagLabel(taxonomy, 'style:minimal-clean', 'en'),
    'Minimal Clean',
  );
  assert.equal(resolveV2TagLabel(taxonomy, 'technique:french', 'zh-CN'), '法式');
  assert.equal(resolveV2TagLabel(taxonomy, 'rights:personal-use-only', 'zh-CN'), '仅限个人使用');
  // Unknown ids fall back to the raw id; aliases/legacy ids never resolve.
  assert.equal(resolveV2TagLabel(taxonomy, 'style:does-not-exist', 'zh-CN'), 'style:does-not-exist');
  assert.equal(findV2TagById(taxonomy, 'ST-02'), null, 'legacy style id never resolves');
  // Group labels: taxonomy browse entries preferred, fixed vocabulary fallback.
  assert.equal(discoveryGroupLabel(taxonomy, 'STYLE', 'zh-CN'), '风格');
  assert.equal(discoveryGroupLabel(taxonomy, 'LENGTH', 'zh-CN'), '长度');
  assert.equal(discoveryGroupLabel(taxonomy, 'LENGTH', 'en'), 'Length');
});

test('actionPermissions: PERSONAL_USE_ONLY is public but denies remix; PENDING denies everything', () => {
  const personalOnly = actionPermissions(
    discoveryFixture({ rights: { status: 'PERSONAL_USE_ONLY', evidenceRefs: [] } }),
  );
  assert.equal(personalOnly.public, true);
  assert.equal(personalOnly.remix, false);
  assert.equal(personalOnly.commercial, false);
  const original = actionPermissions(discoveryFixture());
  assert.equal(original.remix, true);
  const pending = actionPermissions(
    discoveryFixture({ rights: { status: 'PENDING', evidenceRefs: [] } }),
  );
  assert.equal(pending.public, false);
  assert.equal(pending.remix, false);
});

// ---------------------------------------------------------------------------
// 7 · TAX-04 presentation helpers (real migrated looks from the manifest)
// ---------------------------------------------------------------------------

test('real migrated looks: every discovery record presents cleanly for all browses', () => {
  assert.ok(manifestEntries.length > 0, 'manifest has entries');
  const browses = ['recommended', 'shape', 'style', 'scene', 'theme'];
  for (const entry of manifestEntries) {
    const discovery = entry.discovery;
    for (const browse of browses) {
      const ids = cardTagIdsForDiscovery(discovery, browse);
      assert.ok(
        ids.length <= CARD_TAG_PILL_MAX,
        `${entry.contentId}@${browse}: <= ${CARD_TAG_PILL_MAX} card pills`,
      );
      for (const id of ids) {
        assert.ok(findV2TagById(taxonomy, id), `${entry.contentId}: pill ${id} resolves`);
        assert.ok(
          !id.startsWith('rights:') &&
            !id.startsWith('makeability:') &&
            !id.startsWith('length:'),
          `${entry.contentId}: pill ${id} is never a status/length id`,
        );
      }
    }
    const groups = discoveryDetailGroups(discovery);
    const seenDimensions = groups.map((group) => group.dimension);
    assert.deepEqual(
      seenDimensions,
      [...seenDimensions].sort(
        (a, b) =>
          DISCOVERY_DETAIL_GROUP_ORDER.indexOf(a) -
          DISCOVERY_DETAIL_GROUP_ORDER.indexOf(b),
      ),
      `${entry.contentId}: detail groups stay in the required order`,
    );
    for (const group of groups) {
      assert.ok(group.ids.length > 0, `${entry.contentId}:${group.dimension} non-empty`);
      for (const id of group.ids) {
        assert.ok(findV2TagById(taxonomy, id), `${entry.contentId}:${group.dimension} ${id} resolves`);
      }
    }
    assert.ok(
      makeabilityTagIdForDiscovery(discovery),
      `${entry.contentId}: makeability status id resolves`,
    );
    assert.ok(
      rightsTagIdForDiscovery(discovery),
      `${entry.contentId}: rights status id resolves`,
    );
  }
});

// ---------------------------------------------------------------------------
// 8 · TAX-04 static structure: card, shared metadata UI, feed, detail page
// ---------------------------------------------------------------------------

test('card: strict taxonomy-v2 props only, no legacy taxonomy or legacy tag reads', () => {
  assert.doesNotMatch(card, /CommunityTaxonomyV1/, 'no legacy V1 taxonomy type');
  assert.doesNotMatch(card, /communityTaxonomyLabel/, 'no legacy V1 label helper');
  assert.doesNotMatch(card, /mainStyleId/, 'card never reads legacy mainStyleId');
  assert.doesNotMatch(card, /effectIds/, 'card never reads legacy effectIds');
  assert.doesNotMatch(card, /moodIds/, 'card never reads legacy moodIds');
  assert.match(card, /taxonomyV2: CommunityTaxonomyV2/, 'card consumes strict taxonomy-v2');
  assert.match(card, /browse: DiscoveryBrowseV2/, 'card consumes the current browse');
  assert.match(card, /<DiscoveryCardTags/, 'V2 card tag pills shared component (max 6 helper)');
  assert.match(card, /<RightsBadge/, 'rights badge independent of tag pills');
  assert.match(card, /actionPermissions\(/, 'rights gate fail closed');
  assert.match(card, /personal-use-only-action-restricted/, 'PERSONAL_USE_ONLY non-action notice');
  assert.match(card, /remixAllowed/, 'remix gate derived from actionPermissions');
  assert.match(card, /look-card-save/, 'Save preserved');
  assert.match(card, /look-card-made/, 'Made evidence preserved');
  assert.match(card, /resolveStudioUseAvailabilityV1/, 'asset/use availability semantics kept');
  assert.match(card, /community-card-cover-fallback/, 'cover fallback kept');
  assert.match(card, /Routes\.communityLook\(look\.lookId\)/, 'canonical detail link kept');
});

test('shared metadata UI: pills max 6, collision-free testids, rights/makeability rows', () => {
  assert.match(metadata, /cardTagIdsForDiscovery/, 'uses the pure pill derivation');
  assert.match(metadata, /CARD_TAG_PILL_MAX/, 'caps pills at the contract max');
  assert.match(metadata, /community-discovery-tag-\$\{id\}/, 'collision-free tag testid (exact id)');
  assert.match(metadata, /data-tag-id=\{id\}/, 'tag id exposed on every pill');
  assert.match(metadata, /community-rights-badge/, 'rights badge testid');
  assert.match(metadata, /data-rights-status=\{status\}/, 'distinct rights status attribute');
  assert.match(metadata, /sr-only/, 'accessible rights text');
  assert.match(metadata, /community-discovery-detail/, 'full detail section testid');
  assert.match(metadata, /community-discovery-group-\$\{group\.dimension\}/, 'per-group testid');
  assert.match(metadata, /discoveryDetailGroups/, 'uses the full group derivation');
  assert.match(metadata, /community-makeability-badge/, 'makeability row separate');
  assert.match(metadata, /data-makeability-classification/, 'makeability classification exposed');
  assert.match(metadata, /isCurrentMakeable/, 'never implies current-makeable without the evidence gate');
  assert.match(metadata, /community-makeability-evidence-gated/, 'evidence-gated marker is explicit');
});

test('feed: no legacy taxonomy load/state, passes taxonomyV2 + current browse', () => {
  assert.doesNotMatch(feed, /loadTaxonomy/, 'no legacy taxonomy load for cards');
  assert.doesNotMatch(feed, /CommunityTaxonomyV1/, 'no legacy V1 taxonomy state');
  assert.match(feed, /loadCommunityTaxonomyV2/, 'strict taxonomy-v2 still loaded');
  assert.match(feed, /taxonomyV2=\{taxonomyV2\}/, 'V2 taxonomy passed to cards');
  assert.match(feed, /browse=\{queryState\.browse\}/, 'current browse passed to cards');
  assert.doesNotMatch(feed, /taxonomy=\{taxonomy\}/, 'no V1 taxonomy prop on cards');
  assert.match(feed, /loadContentIndex/, 'content index/progress kept');
  assert.match(feed, /officialPgcProgress/, 'official progress kept');
  assert.match(feed, /CommunityDiscoveryBrowseNavigation/, 'TAX-04 navigation kept');
  assert.match(feed, /CommunityDiscoveryRuntimeFilters/, 'TAX-03/TAX-04 filters kept');
});

test('detail page: loads V2, renders the full structure, rights gate hides content use', () => {
  assert.match(page, /loadCommunityTaxonomyV2/, 'detail loads strict taxonomy-v2');
  assert.doesNotMatch(page, /loadTaxonomy/, 'no legacy taxonomy load');
  assert.doesNotMatch(page, /CommunityTaxonomyV1/, 'no legacy V1 taxonomy type');
  assert.doesNotMatch(page, /communityTaxonomyLabel/, 'no legacy V1 style label');
  assert.doesNotMatch(page, /taxonomyLabel\(/, 'no legacy V1 shape/length presentation');
  assert.doesNotMatch(page, /mainStyleId/, 'no legacy mainStyleId presentation');
  assert.match(page, /DiscoveryDetailSection/, 'renders the shared full structured discovery section');
  assert.match(page, /community-discovery-unavailable/, 'fails visibly when discovery/taxonomy unavailable');
  assert.match(page, /community-discovery-loading/, 'explicit loading state');
  assert.match(page, /actionPermissions\(/, 'rights gate fail closed');
  assert.match(page, /personal-use-only-action-restricted/, 'PERSONAL_USE_ONLY content actions replaced by a visible notice');
  assert.match(page, /community-remix-unavailable/, 'null discovery: no remix action, visible notice');
  assert.match(page, /community-use-versioned/, 'versioned handoff preserved when rights permit');
  assert.match(page, /community-try-in-studio/, 'legacy handoff preserved when rights permit');
  assert.match(page, /community-approx-confirm/, 'approximate-use modal preserved when rights permit');
  assert.match(page, /community-open-studio/, 'generic Studio navigation remains');
  assert.match(page, /community-look-evidence/, 'evidence section preserved');
  assert.match(page, /ApplicationBadge/, 'application evidence badge remains separate');
  assert.match(page, /VerificationBadge/, 'verification evidence badge remains separate');
  assert.doesNotMatch(page, /localStorage/, 'no fake persistence');
});

// ---------------------------------------------------------------------------
// 9 · Package script
// ---------------------------------------------------------------------------

test('package script test:community-tax-04-home-ui registered with the import/register pattern', () => {
  const pkg = JSON.parse(read('package.json'));
  const script = pkg.scripts['test:community-tax-04-home-ui'];
  assert.ok(script, 'script must exist');
  assert.match(script, /--import \.\/tools\/lib\/register-node-vite\.mjs/, 'register hook');
  assert.match(script, /--experimental-strip-types/, 'strip-types flag');
  assert.match(script, /tools\/test-community-tax-04-home-ui\.mjs/, 'target tool');
});

// ---------------------------------------------------------------------------

console.log(
  `[test:community-tax-04-home-ui] PASS · ${passed} passed, ${failed} failed` +
    (failed > 0 ? `\n${failures.join('\n')}` : ''),
);
if (failed > 0) process.exit(1);
