/**
 * Community v0.7.2 · COMM-v0.7.2-TAX-03 Discovery query (URL state + execution).
 *
 * Checkpoint 1 implemented URL state parsing + canonical serialization +
 * compatibility markers. Checkpoint 2 (the tail of this file) adds
 * `executeDiscoveryQueryV2`, the pure governance-pass → filter → rank
 * pipeline (see the function doc for the full algorithm).
 *
 * Contract:
 * - `parseDiscoveryQueryV2` is total (never throws) and never mutates its
 *   inputs (URLSearchParams and taxonomy are read-only).
 * - The default state (tab=looks, q='', sort=featured, source=all,
 *   browse=recommended, topic=for-you, empty arrays/issues/markers)
 *   serializes to the empty string.
 * - Serialization emits only canonical new-format params, in fixed order:
 *   tab, q, sort, source, browse, topic, length, makeability, rights,
 *   technique. Defaults are absent; CSV arrays are canonical
 *   (sorted + deduped). Old/legacy keys are never emitted.
 * - New canonical topic/CSV items must be exact ACTIVE namespaced tag ids in
 *   the correct dimension; raw aliases, deprecated ids, unknown ids and
 *   wrong-dimension ids are incompatible, never silently replaced.
 * - Legacy keys (`style`, `shape`) are honored ONLY when their old key is
 *   present and the corresponding new representation is absent; they always
 *   produce a removable compatibility marker. Lossy legacy keys (`color`,
 *   `occasion`, `effect`, `mood`, `application`, `verification`) are always
 *   incompatible, regardless of how plausible their values look.
 * - Issues are bounded (MAX_DISCOVERY_QUERY_ISSUES) with the stable shape
 *   { key, rawValue, code }.
 *
 * This module is pure and Node-testable (no browser globals, no env access).
 */

import {
  DEFAULT_RECOMMENDATION_CHANNEL,
  FOLLOWING_CHANNEL_ID,
  MAKEABILITY_CLASSIFICATION_TAGS,
  PRIMARY_BROWSE_DIMENSION,
  RIGHTS_STATUS_TAGS,
  type TaxonomyDimensionV2,
} from './contract.ts';
import {
  curationPublicEligibility,
  isCurrentMakeable,
  publicationEligibility,
  styleChannelEligible,
} from './governance.ts';
import {
  dimensionOfTagId,
  isFrenchLegacyAlias,
  resolveFrenchTechnique,
  resolveTagId,
} from './resolve.ts';
import type { CommunityTaxonomyV2, TaxonomyTagV2 } from './types.ts';
import type { CommunityPublisherV1 } from '../types.ts';
import type { PublishedLookReadModelV1 } from '../v7_1/published-look-read-model.ts';
import {
  EMPTY_EXPLORE_FILTERS,
  rankLooks,
  type EffectiveSort,
  type RankedLook,
  type TrendingConfigV1,
  type TrendingSignalV1,
} from '../v7_1/explore-search.ts';

/** Bound for incompatible-issue reporting: parsers never grow unbounded lists. */
export const MAX_DISCOVERY_QUERY_ISSUES = 50;

/** Upper bound for the trimmed search text. */
export const MAX_DISCOVERY_QUERY_Q_LENGTH = 100;

export const DISCOVERY_TABS = ['looks', 'creators'] as const;
export type DiscoveryTabV2 = (typeof DISCOVERY_TABS)[number];

export const DISCOVERY_SORTS = ['featured', 'trending', 'new'] as const;
export type DiscoverySortV2 = (typeof DISCOVERY_SORTS)[number];

export const DISCOVERY_SOURCES = ['all', 'official', 'creators'] as const;
export type DiscoverySourceV2 = (typeof DISCOVERY_SOURCES)[number];

export const DISCOVERY_BROWSE = [
  'recommended',
  'shape',
  'style',
  'scene',
  'theme',
] as const;
export type DiscoveryBrowseV2 = (typeof DISCOVERY_BROWSE)[number];

/** URL param keys in canonical serialization order. */
export const DISCOVERY_QUERY_PARAM_ORDER = [
  'tab',
  'q',
  'sort',
  'source',
  'browse',
  'topic',
  'length',
  'makeability',
  'rights',
  'technique',
] as const;

/** CSV array params → the taxonomy dimension their items must live in. */
export const DISCOVERY_CSV_PARAM_DIMENSION: Record<string, TaxonomyDimensionV2> = {
  length: 'LENGTH',
  makeability: 'MAKEABILITY',
  rights: 'RIGHTS',
  technique: 'TECHNIQUE',
};

/**
 * Singleton params: a second occurrence is incompatible. Includes the legacy
 * singletons (`style`, `shape`) and the lossy legacy params (duplicates of
 * those are reported on top of their own issues).
 */
const SINGLETON_PARAMS = [
  'tab',
  'q',
  'sort',
  'source',
  'browse',
  'topic',
  'style',
  'shape',
  'color',
  'occasion',
  'effect',
  'mood',
  'application',
  'verification',
] as const;

/**
 * Lossy legacy params: mapping them to v2 vocabulary would require guessing,
 * so their presence is always incompatible (even for familiar-looking
 * values). Never guessed, never silently dropped.
 */
export const LOSSY_LEGACY_PARAMS = [
  'color',
  'occasion',
  'effect',
  'mood',
  'application',
  'verification',
] as const;

/**
 * Known passthrough context keys, NOT discovery filters.
 *
 * `entry` and `return_to` are product-navigation bookkeeping that CommunityFeed
 * preserves and re-attaches verbatim around a discovery query (e.g. the Studio
 * "new design" flow). They carry no taxonomy meaning, so `parseDiscoveryQueryV2`
 * must tolerate them without recording incompatible issues, and
 * `serializeDiscoveryQueryV2` must still omit them (their raw values live on
 * the CommunityFeed envelope, not in the discovery filter state). Any OTHER
 * unknown key remains incompatible.
 */
export const DISCOVERY_PASSTHROUGH_PARAMS = ['entry', 'return_to'] as const;

/**
 * Bare legacy shape values → canonical SHAPE tag id. `coffin` intentionally
 * maps to `shape:coffin-ballerina` (the canonical v2 id).
 */
export const LEGACY_SHAPE_MAP: Record<string, string> = {
  almond: 'shape:almond',
  oval: 'shape:oval',
  round: 'shape:round',
  square: 'shape:square',
  squoval: 'shape:squoval',
  stiletto: 'shape:stiletto',
  coffin: 'shape:coffin-ballerina',
};

/**
 * Bare legacy length values → canonical LENGTH tag id. Namespaced length ids
 * are the new format and never carry a compatibility marker; only these bare
 * legacy values do.
 */
export const LEGACY_LENGTH_MAP: Record<string, string> = {
  short: 'length:short',
  medium: 'length:medium',
  long: 'length:long',
  'extra-long': 'length:extra-long',
};

export interface DiscoveryIncompatibleIssueV2 {
  key: string;
  rawValue: string;
  code: string;
}

export interface DiscoveryCompatibilityMarkerV2 {
  legacyKey: string;
  rawValue: string;
  canonicalKey: string;
  canonicalValue: string;
  code: string;
}

export interface DiscoveryQueryStateV2 {
  tab: DiscoveryTabV2;
  q: string;
  sort: DiscoverySortV2;
  source: DiscoverySourceV2;
  browse: DiscoveryBrowseV2;
  topic: string;
  lengthIds: string[];
  makeabilityIds: string[];
  rightsIds: string[];
  techniqueIds: string[];
  incompatible: DiscoveryIncompatibleIssueV2[];
  markers: DiscoveryCompatibilityMarkerV2[];
}

export interface DiscoveryQueryParseOptionsV2 {
  /** Whether the relationship provider (e.g. following feed) is available. */
  relationshipProviderAvailable: boolean;
}

export interface DiscoveryQueryParseResultV2 {
  /** false when at least one incompatible issue was recorded. */
  ok: boolean;
  /** Total, well-typed state; canonical parts are always populated. */
  state: DiscoveryQueryStateV2;
}

export function createDefaultDiscoveryQueryState(): DiscoveryQueryStateV2 {
  return {
    tab: 'looks',
    q: '',
    sort: 'featured',
    source: 'all',
    browse: 'recommended',
    topic: DEFAULT_RECOMMENDATION_CHANNEL,
    lengthIds: [],
    makeabilityIds: [],
    rightsIds: [],
    techniqueIds: [],
    incompatible: [],
    markers: [],
  };
}

export const DEFAULT_DISCOVERY_QUERY_STATE: Readonly<DiscoveryQueryStateV2> =
  Object.freeze(createDefaultDiscoveryQueryState());

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function recordIssue(
  issues: DiscoveryIncompatibleIssueV2[],
  key: string,
  rawValue: string,
  code: string,
): void {
  if (issues.length < MAX_DISCOVERY_QUERY_ISSUES) {
    issues.push({ key, rawValue, code });
  }
}

function canonicalIdSet(ids: readonly string[]): string[] {
  return [...new Set(ids)].sort();
}

function markerKey(marker: DiscoveryCompatibilityMarkerV2): string {
  return `${marker.legacyKey}\u0000${marker.rawValue}\u0000${marker.canonicalValue}`;
}

function recordMarker(
  markers: DiscoveryCompatibilityMarkerV2[],
  marker: DiscoveryCompatibilityMarkerV2,
): void {
  if (!markers.some((existing) => markerKey(existing) === markerKey(marker))) {
    markers.push(marker);
  }
}

/** Find a tag by exact id within one dimension. */
function findTag(
  taxonomy: CommunityTaxonomyV2,
  dimension: TaxonomyDimensionV2,
  id: string,
): TaxonomyTagV2 | undefined {
  return taxonomy.dimensions[dimension].tags.find((tag) => tag.id === id);
}

/** Assign canonical ids to the state field that backs a CSV param key. */
function assignCsvIds(
  state: DiscoveryQueryStateV2,
  key: string,
  ids: readonly string[],
): void {
  const canonical = canonicalIdSet(ids);
  switch (key) {
    case 'length':
      state.lengthIds = canonical;
      break;
    case 'makeability':
      state.makeabilityIds = canonical;
      break;
    case 'rights':
      state.rightsIds = canonical;
      break;
    case 'technique':
      state.techniqueIds = canonical;
      break;
    default:
      break; // unreachable: only known CSV keys are dispatched
  }
}

/** Every channel id the taxonomy defines for the recommended browse. */
function channelIdSet(taxonomy: CommunityTaxonomyV2): Set<string> {
  const ids = new Set<string>();
  for (const channel of taxonomy.browse.recommendationChannels) {
    ids.add(channel.id);
  }
  return ids;
}

// ---------------------------------------------------------------------------
// Parse
// ---------------------------------------------------------------------------

export function parseDiscoveryQueryV2(
  params: URLSearchParams,
  taxonomy: CommunityTaxonomyV2,
  options: DiscoveryQueryParseOptionsV2,
): DiscoveryQueryParseResultV2 {
  const state = createDefaultDiscoveryQueryState();
  const issues = state.incompatible;
  const markers = state.markers;
  const channels = channelIdSet(taxonomy);

  // --- 1. singleton duplicates (deterministic, canonical key order) ---------
  const poisoned = new Set<string>();
  for (const key of SINGLETON_PARAMS) {
    const values = params.getAll(key);
    if (values.length > 1) {
      recordIssue(issues, key, values[0], 'duplicate-param');
      poisoned.add(key);
    }
  }

  // --- 2. tab ----------------------------------------------------------------
  if (!poisoned.has('tab')) {
    const raw = params.get('tab');
    if (raw !== null && (DISCOVERY_TABS as readonly string[]).includes(raw)) {
      state.tab = raw as DiscoveryTabV2;
    } else if (raw !== null) {
      recordIssue(issues, 'tab', raw, 'invalid-tab');
    }
  }

  // --- 3. q (trimmed, bounded) ------------------------------------------------
  if (!poisoned.has('q')) {
    const raw = params.get('q');
    if (raw !== null) {
      const trimmed = raw.trim();
      if (trimmed.length > MAX_DISCOVERY_QUERY_Q_LENGTH) {
        recordIssue(issues, 'q', trimmed, 'q-too-long');
      } else {
        state.q = trimmed;
      }
    }
  }

  // --- 4. sort ---------------------------------------------------------------
  if (!poisoned.has('sort')) {
    const raw = params.get('sort');
    if (raw !== null && (DISCOVERY_SORTS as readonly string[]).includes(raw)) {
      state.sort = raw as DiscoverySortV2;
    } else if (raw !== null) {
      recordIssue(issues, 'sort', raw, 'invalid-sort');
    }
  }

  // --- 5. source -------------------------------------------------------------
  if (!poisoned.has('source')) {
    const raw = params.get('source');
    if (raw !== null && (DISCOVERY_SOURCES as readonly string[]).includes(raw)) {
      state.source = raw as DiscoverySourceV2;
    } else if (raw !== null) {
      recordIssue(issues, 'source', raw, 'invalid-source');
    }
  }

  // --- 6. browse ---------------------------------------------------------------
  if (!poisoned.has('browse')) {
    const raw = params.get('browse');
    if (raw !== null && (DISCOVERY_BROWSE as readonly string[]).includes(raw)) {
      state.browse = raw as DiscoveryBrowseV2;
    } else if (raw !== null) {
      recordIssue(issues, 'browse', raw, 'invalid-browse');
    }
  }

  // --- 7. topic -----------------------------------------------------------------
  const topicRaw = poisoned.has('topic') ? null : params.get('topic');
  const topicTrimmed = topicRaw === null ? null : topicRaw.trim();
  if (state.browse === 'recommended') {
    if (topicTrimmed === null || topicTrimmed === '') {
      // absent topic means for-you
      state.topic = DEFAULT_RECOMMENDATION_CHANNEL;
    } else if (!channels.has(topicTrimmed)) {
      recordIssue(issues, 'topic', topicTrimmed, 'topic-unknown-channel');
    } else if (
      topicTrimmed === FOLLOWING_CHANNEL_ID &&
      !options.relationshipProviderAvailable
    ) {
      recordIssue(issues, 'topic', topicTrimmed, 'following-unavailable');
    } else {
      state.topic = topicTrimmed;
    }
  } else {
    const dimension = PRIMARY_BROWSE_DIMENSION[state.browse];
    if (topicTrimmed === null || topicTrimmed === '') {
      recordIssue(issues, 'topic', '', 'topic-missing');
    } else if (dimension) {
      const tag = findTag(taxonomy, dimension, topicTrimmed);
      if (tag && tag.lifecycle === 'ACTIVE') {
        state.topic = topicTrimmed;
      } else if (tag) {
        // exists but not ACTIVE (deprecated/merged): never silently replaced
        recordIssue(issues, 'topic', topicTrimmed, 'topic-invalid-tag');
      } else if (dimensionOfTagId(topicTrimmed) === dimension) {
        // namespaced id in the right dimension that does not exist
        recordIssue(issues, 'topic', topicTrimmed, 'topic-invalid-tag');
      } else if (dimensionOfTagId(topicTrimmed) !== null) {
        // namespaced id in a different dimension
        recordIssue(issues, 'topic', topicTrimmed, 'topic-wrong-dimension');
      } else {
        // bare value / alias: topic only accepts exact namespaced ids
        recordIssue(issues, 'topic', topicTrimmed, 'topic-invalid-tag');
      }
    }
  }

  // --- 8. CSV arrays (length, makeability, rights, technique) -----------------
  for (const key of Object.keys(DISCOVERY_CSV_PARAM_DIMENSION)) {
    const dimension = DISCOVERY_CSV_PARAM_DIMENSION[key];
    const occurrences = params.getAll(key);
    if (occurrences.length === 0) continue;

    const canonical: string[] = [];
    const legacyMarkers: DiscoveryCompatibilityMarkerV2[] = [];
    let sawLegacy = false;
    let sawNew = false;
    let conflict = false;

    for (const value of occurrences) {
      for (const rawItem of value.split(',')) {
        const item = rawItem.trim();
        if (item === '') {
          recordIssue(issues, key, rawItem, 'empty-csv-item');
          continue;
        }
        const legacyCanonical = key === 'length' ? LEGACY_LENGTH_MAP[item] : undefined;
        if (legacyCanonical) {
          sawLegacy = true;
          canonical.push(legacyCanonical);
          legacyMarkers.push({
            legacyKey: key,
            rawValue: item,
            canonicalKey: key,
            canonicalValue: legacyCanonical,
            code: 'compat-length',
          });
        } else if (!item.includes(':')) {
          // bare value outside the legacy map (length) or any other dimension
          recordIssue(issues, key, item, `invalid-${key}-item`);
        } else {
          const tag = findTag(taxonomy, dimension, item);
          if (tag && tag.lifecycle === 'ACTIVE') {
            sawNew = true;
            canonical.push(item);
          } else {
            // unknown / deprecated / alias / wrong dimension: exact ids only
            recordIssue(issues, key, item, `invalid-${key}-item`);
          }
        }
      }
    }

    if (sawLegacy && sawNew) {
      // old+new representation of the same dimension in one param: conflict
      recordIssue(issues, key, legacyMarkers[0]?.rawValue ?? '', 'legacy-conflict');
      conflict = true;
    }
    if (!conflict) {
      assignCsvIds(state, key, canonical);
      for (const marker of legacyMarkers) recordMarker(markers, marker);
    }
  }

  // --- 9. legacy style ----------------------------------------------------------
  if (!poisoned.has('style') && params.has('style')) {
    const raw = params.get('style') ?? '';
    const trimmed = raw.trim();
    if (trimmed === '') {
      recordIssue(issues, 'style', raw, 'invalid-style-item');
    } else if (isFrenchLegacyAlias(trimmed)) {
      // style=ST-02 (and the other french aliases) → technique:french,
      // keeping the default recommended/for-you browse.
      if (params.has('technique')) {
        recordIssue(issues, 'style', trimmed, 'legacy-conflict');
      } else {
        const french = resolveFrenchTechnique(taxonomy);
        if (french) {
          state.techniqueIds = canonicalIdSet([...state.techniqueIds, french.id]);
          recordMarker(markers, {
            legacyKey: 'style',
            rawValue: trimmed,
            canonicalKey: 'technique',
            canonicalValue: french.id,
            code: 'compat-style-french',
          });
        } else {
          recordIssue(issues, 'style', trimmed, 'invalid-style-item');
        }
      }
    } else {
      const resolved = resolveTagId(taxonomy, trimmed);
      if (!resolved || resolved.dimension !== 'STYLE') {
        recordIssue(issues, 'style', trimmed, 'invalid-style-item');
      } else if (state.browse !== 'recommended' || state.topic !== DEFAULT_RECOMMENDATION_CHANNEL) {
        recordIssue(issues, 'style', trimmed, 'legacy-conflict');
      } else {
        state.browse = 'style';
        state.topic = resolved.id;
        recordMarker(markers, {
          legacyKey: 'style',
          rawValue: trimmed,
          canonicalKey: 'topic',
          canonicalValue: resolved.id,
          code: 'compat-style-alias',
        });
      }
    }
  }

  // --- 10. legacy shape -----------------------------------------------------------
  if (!poisoned.has('shape') && params.has('shape')) {
    const raw = params.get('shape') ?? '';
    const trimmed = raw.trim();
    const canonical = LEGACY_SHAPE_MAP[trimmed];
    if (!canonical) {
      recordIssue(issues, 'shape', trimmed, 'invalid-shape-item');
    } else if (state.browse !== 'recommended' || state.topic !== DEFAULT_RECOMMENDATION_CHANNEL) {
      recordIssue(issues, 'shape', trimmed, 'legacy-conflict');
    } else {
      state.browse = 'shape';
      state.topic = canonical;
      recordMarker(markers, {
        legacyKey: 'shape',
        rawValue: trimmed,
        canonicalKey: 'topic',
        canonicalValue: canonical,
        code: 'compat-shape',
      });
    }
  }

  // --- 11. lossy legacy params -------------------------------------------------------
  for (const key of LOSSY_LEGACY_PARAMS) {
    if (params.has(key)) {
      recordIssue(issues, key, params.get(key) ?? '', 'legacy-lossy');
    }
  }

  // --- 12. unknown keys (sorted for determinism) ---------------------------------------
  const knownKeys = new Set([
    ...DISCOVERY_QUERY_PARAM_ORDER,
    'style',
    'shape',
    ...LOSSY_LEGACY_PARAMS,
    ...DISCOVERY_PASSTHROUGH_PARAMS,
  ]);
  const unknownKeys = [...new Set(params.keys())]
    .filter((key) => !knownKeys.has(key))
    .sort();
  for (const key of unknownKeys) {
    recordIssue(issues, key, params.get(key) ?? '', 'unknown-key');
  }

  return { ok: issues.length === 0, state };
}

// ---------------------------------------------------------------------------
// Serialize
// ---------------------------------------------------------------------------

function setCsv(out: URLSearchParams, key: string, ids: readonly string[]): void {
  const canonical = canonicalIdSet(ids);
  if (canonical.length > 0) out.set(key, canonical.join(','));
}

/**
 * Canonical serialization of a discovery query state. Emits only new-format
 * params in fixed order (tab, q, sort, source, browse, topic, length,
 * makeability, rights, technique); defaults are absent; arrays are canonical
 * sorted/deduped. Never emits legacy/lossy keys. Deterministic → byte-stable.
 */
export function serializeDiscoveryQueryV2(state: DiscoveryQueryStateV2): string {
  const out = new URLSearchParams();
  if (state.tab !== 'looks') out.set('tab', state.tab);
  if (state.q !== '') out.set('q', state.q);
  if (state.sort !== 'featured') out.set('sort', state.sort);
  if (state.source !== 'all') out.set('source', state.source);
  if (state.browse !== 'recommended') out.set('browse', state.browse);
  if (state.topic !== DEFAULT_RECOMMENDATION_CHANNEL) out.set('topic', state.topic);
  setCsv(out, 'length', state.lengthIds);
  setCsv(out, 'makeability', state.makeabilityIds);
  setCsv(out, 'rights', state.rightsIds);
  setCsv(out, 'technique', state.techniqueIds);
  return out.toString();
}

// ---------------------------------------------------------------------------
// Execute (pure filter + rank pipeline)
// ---------------------------------------------------------------------------

export interface DiscoveryQueryExecutionInputV2 {
  /** All published look read models; the governance pass covers every one. */
  looks: readonly PublishedLookReadModelV1[];
  /** Publisher records supplying displayName/handle search fields. */
  publishers?: readonly CommunityPublisherV1[];
  taxonomy: CommunityTaxonomyV2;
  state: DiscoveryQueryStateV2;
  /** Whether the relationship provider (following feed) is available. */
  relationshipProviderAvailable: boolean;
  /** Injected trending signals; this module never reads the clock. */
  trendingSignals?: readonly TrendingSignalV1[];
  /** Injected clock for trending windows. */
  asOf: string;
  trendingConfig?: TrendingConfigV1;
}

export interface DiscoveryQueryExecutionResultV2 {
  /** 'incompatible' when any issue is present (carried or appended). */
  status: 'ok' | 'incompatible';
  items: RankedLook[];
  effectiveSort: EffectiveSort;
  /** Looks dropped by the governance pass (missing or ineligible discovery/curation). */
  governanceBlocked: number;
  /** Looks that passed the governance pass over all input looks. */
  governedCandidateCount: number;
  /** Governed + filtered candidates handed to the ranker (before ranking). */
  queryCandidateCount: number;
  /** Carried state issues plus any appended runtime issue (bounded, stable shape). */
  incompatible: DiscoveryIncompatibleIssueV2[];
}

/**
 * Channel-forced sort: the trending/new recommendation channels force their
 * own sort; every other browse/topic combination keeps the state sort.
 */
function resolveRequestedSort(state: DiscoveryQueryStateV2): DiscoverySortV2 {
  if (state.browse === 'recommended') {
    if (state.topic === 'trending') return 'trending';
    if (state.topic === 'new') return 'new';
  }
  return state.sort;
}

/**
 * Deterministic zero-result effective sort: requested is the forced-or-state
 * sort; trending always reports the no-signals fallback (no clock access).
 */
function zeroItemEffectiveSort(requested: DiscoverySortV2): EffectiveSort {
  if (requested === 'trending') {
    return { requested, applied: 'featured', fallbackReason: 'trending_no_signals' };
  }
  return { requested, applied: requested };
}

/** Governed candidates: non-null discovery+curation passing both eligibility gates. */
function governedCandidates(
  looks: readonly PublishedLookReadModelV1[],
  taxonomy: CommunityTaxonomyV2,
): { governed: PublishedLookReadModelV1[]; blocked: number } {
  const governed: PublishedLookReadModelV1[] = [];
  for (const look of looks) {
    const discovery = look.discovery;
    const curation = look.curation;
    if (!discovery || !curation) continue;
    if (!publicationEligibility(discovery, taxonomy).eligible) continue;
    if (!curationPublicEligibility(discovery, curation, taxonomy).eligible) continue;
    governed.push(look);
  }
  return { governed, blocked: looks.length - governed.length };
}

/** Source filter: OFFICIAL / VERIFIED_CREATOR publisher types only. */
function matchesSource(look: PublishedLookReadModelV1, source: DiscoverySourceV2): boolean {
  if (source === 'all') return true;
  return source === 'official'
    ? look.publisherType === 'OFFICIAL'
    : look.publisherType === 'VERIFIED_CREATOR';
}

/**
 * Primary browse matching: the recommended channel gate for browse=recommended,
 * exact-topic matching on the discovery projection for dimension browses.
 */
function matchesPrimaryBrowse(
  look: PublishedLookReadModelV1,
  state: DiscoveryQueryStateV2,
  taxonomy: CommunityTaxonomyV2,
  relationshipProviderAvailable: boolean,
): boolean {
  const discovery = look.discovery;
  if (!discovery) return false;
  if (state.browse === 'recommended') {
    return matchesRecommendationChannel(
      look,
      state.topic,
      relationshipProviderAvailable,
    );
  }
  switch (state.browse) {
    case 'shape':
      return discovery.recommendedShapeIds.includes(state.topic);
    case 'style':
      return (
        discovery.styleIds.includes(state.topic) &&
        styleChannelEligible(discovery, taxonomy)
      );
    case 'scene':
      return discovery.sceneIds.includes(state.topic);
    case 'theme':
      return discovery.themeIds.includes(state.topic);
  }
}

/** Recommendation channel gate (topic is an exact channel id on browse=recommended). */
function matchesRecommendationChannel(
  look: PublishedLookReadModelV1,
  topic: string,
  relationshipProviderAvailable: boolean,
): boolean {
  const discovery = look.discovery;
  const curation = look.curation;
  if (!discovery || !curation) return false;
  switch (topic) {
    case 'for-you':
    case 'trending':
    case 'new':
      // unfiltered channels: every governed look qualifies
      return true;
    case 'editorial':
      // curated or legacy-featured
      return curation.curated === true || look.curationStatus === 'FEATURED_BY_OFFICIAL';
    case 'makeable':
      return isCurrentMakeable(discovery);
    case 'dimensional':
      // dimensional-module classification or legacy-featured
      return (
        discovery.makeability.classification === 'DIMENSIONAL_MODULE' ||
        look.curationStatus === 'FEATURED_BY_OFFICIAL'
      );
    case 'emerging-creator':
      return curation.featuredChannels.includes('emerging-creator');
    case 'collections':
      return curation.featuredChannels.includes('collections');
    case FOLLOWING_CHANNEL_ID:
      return (
        relationshipProviderAvailable &&
        curation.featuredChannels.includes(FOLLOWING_CHANNEL_ID)
      );
    default:
      // Unknown channel id (defensive): behave like the default for-you channel.
      return true;
  }
}

function intersects(a: readonly string[], b: readonly string[]): boolean {
  return a.some((id) => b.includes(id));
}

/**
 * Auxiliary filters: OR within each dimension, AND across dimensions. The
 * makeability/rights filters match the look's canonical derived tag ids
 * (classification/status → tag id maps), never free-form arrays.
 */
function matchesAuxFilters(
  look: PublishedLookReadModelV1,
  state: DiscoveryQueryStateV2,
): boolean {
  const discovery = look.discovery;
  if (!discovery) return false;
  if (state.lengthIds.length > 0 && !intersects(discovery.lengthIds, state.lengthIds)) {
    return false;
  }
  if (state.techniqueIds.length > 0 && !intersects(discovery.techniqueIds, state.techniqueIds)) {
    return false;
  }
  if (state.makeabilityIds.length > 0) {
    const derived = MAKEABILITY_CLASSIFICATION_TAGS[discovery.makeability.classification];
    if (!state.makeabilityIds.includes(derived)) return false;
  }
  if (state.rightsIds.length > 0) {
    const derived = RIGHTS_STATUS_TAGS[discovery.rights.status];
    if (!state.rightsIds.includes(derived)) return false;
  }
  return true;
}

function normalizeSearchText(value: string): string {
  return value.toLowerCase().replace(/\s+/g, ' ').trim();
}

function searchTokens(query: string): string[] {
  const normalized = normalizeSearchText(query);
  return normalized ? normalized.split(' ') : [];
}

/** AND across query tokens, OR across searchable fields. */
function matchesAllTokens(searchable: readonly string[], tokens: readonly string[]): boolean {
  if (tokens.length === 0) return true;
  return tokens.every((token) => searchable.some((field) => field.includes(token)));
}

/** Push an exact tag id plus its bilingual labels (exact ids only, never aliases). */
function addTagSearchFields(
  taxonomy: CommunityTaxonomyV2,
  dimension: TaxonomyDimensionV2,
  ids: readonly string[],
  out: string[],
): void {
  for (const id of ids) {
    out.push(id);
    const tag = findTag(taxonomy, dimension, id);
    if (tag) out.push(tag.labels['zh-CN'], tag.labels.en);
  }
}

/**
 * Searchable fields for q matching: title/titleEn, publisher
 * displayName+handle, discovery tag ids (including the derived makeability /
 * rights tag ids) and the taxonomy-v2 labels of those exact ids. Legacy
 * discovery fields and sourceContent are NEVER consulted.
 */
function lookSearchFieldsV2(
  look: PublishedLookReadModelV1,
  publisher: CommunityPublisherV1 | undefined,
  taxonomy: CommunityTaxonomyV2,
): string[] {
  const raw: string[] = [look.title];
  if (look.titleEn) raw.push(look.titleEn);
  if (publisher) raw.push(publisher.displayName, publisher.handle);
  const discovery = look.discovery;
  if (discovery) {
    addTagSearchFields(taxonomy, 'STYLE', discovery.styleIds, raw);
    addTagSearchFields(taxonomy, 'SHAPE', discovery.recommendedShapeIds, raw);
    addTagSearchFields(taxonomy, 'SCENE', discovery.sceneIds, raw);
    addTagSearchFields(taxonomy, 'THEME', discovery.themeIds, raw);
    addTagSearchFields(taxonomy, 'TECHNIQUE', discovery.techniqueIds, raw);
    addTagSearchFields(taxonomy, 'LENGTH', discovery.lengthIds, raw);
    addTagSearchFields(
      taxonomy,
      'MAKEABILITY',
      [MAKEABILITY_CLASSIFICATION_TAGS[discovery.makeability.classification]],
      raw,
    );
    addTagSearchFields(
      taxonomy,
      'RIGHTS',
      [RIGHTS_STATUS_TAGS[discovery.rights.status]],
      raw,
    );
  }
  return raw.map(normalizeSearchText).filter((value) => value !== '');
}

/**
 * COMM-v0.7.2-TAX-03 pure discovery query execution. Pipeline:
 *
 * 1. Governance over ALL input looks: non-null discovery+curation and both
 *    publicationEligibility / curationPublicEligibility eligible. Counts are
 *    preserved on every path.
 * 2. Incompatible state (or following requested without a relationship
 *    provider) yields zero items with the governance counts intact and a
 *    deterministic effective sort. A bounded following-unavailable issue is
 *    appended only when missing.
 * 3. Source filter (OFFICIAL / VERIFIED_CREATOR publisher types).
 * 4. Primary browse matching: recommended channel gate, or exact-topic match
 *    on recommendedShapeIds / styleIds (+styleChannelEligible) / sceneIds /
 *    themeIds.
 * 5. Auxiliary filters: OR within length/technique/makeability/rights, AND
 *    across them; makeability/rights match canonical derived tag ids.
 * 6. q: every token must match title/titleEn, publisher displayName+handle,
 *    discovery tag ids (incl. derived makeability/rights) or the taxonomy-v2
 *    labels of those exact ids. Legacy discovery fields / sourceContent are
 *    never read.
 * 7. Recommended channels: for-you/trending/new all; trending/new force their
 *    sort; editorial curated-or-featured; makeable isCurrentMakeable;
 *    dimensional DIMENSIONAL_MODULE-or-featured; emerging-creator/collections/
 *    following explicit featuredChannels membership (following also requires
 *    the relationship provider).
 * 8. Ranking via rankLooks with q='' (matching already happened in step 6) and
 *    empty explore filters; signals/asOf/config are injected. queryCandidateCount
 *    is captured before ranking.
 *
 * Total, pure, non-mutating: no IO, no clock, no `any`.
 */
export function executeDiscoveryQueryV2(
  input: DiscoveryQueryExecutionInputV2,
): DiscoveryQueryExecutionResultV2 {
  const {
    looks,
    publishers = [],
    taxonomy,
    state,
    relationshipProviderAvailable,
    trendingSignals,
    asOf,
    trendingConfig,
  } = input;

  // 1. governance over all looks
  const { governed, blocked } = governedCandidates(looks, taxonomy);

  // 2. incompatible / following-unavailable zero-result path
  const incompatible = [...state.incompatible];
  const followingUnavailable =
    state.browse === 'recommended' &&
    state.topic === FOLLOWING_CHANNEL_ID &&
    !relationshipProviderAvailable;
  if (
    followingUnavailable &&
    !incompatible.some(
      (issue) => issue.key === 'topic' && issue.code === 'following-unavailable',
    )
  ) {
    if (incompatible.length < MAX_DISCOVERY_QUERY_ISSUES) {
      incompatible.push({
        key: 'topic',
        rawValue: FOLLOWING_CHANNEL_ID,
        code: 'following-unavailable',
      });
    }
  }
  if (incompatible.length > 0) {
    return {
      status: 'incompatible',
      items: [],
      effectiveSort: zeroItemEffectiveSort(resolveRequestedSort(state)),
      governanceBlocked: blocked,
      governedCandidateCount: governed.length,
      queryCandidateCount: 0,
      incompatible,
    };
  }

  // 3-7. filter governed candidates (source → primary → aux → q)
  const pubById = new Map(
    publishers.map((publisher) => [publisher.publisherId, publisher]),
  );
  const tokens = searchTokens(state.q);
  const candidates: PublishedLookReadModelV1[] = [];
  for (const look of governed) {
    const discovery = look.discovery;
    if (!discovery) continue;
    if (!matchesSource(look, state.source)) continue;
    if (!matchesPrimaryBrowse(look, state, taxonomy, relationshipProviderAvailable)) continue;
    if (!matchesAuxFilters(look, state)) continue;
    if (tokens.length > 0) {
      const fields = lookSearchFieldsV2(look, pubById.get(look.publisherId), taxonomy);
      if (!matchesAllTokens(fields, tokens)) continue;
    }
    candidates.push(look);
  }
  const queryCandidateCount = candidates.length;

  // 8. rank (q matching already applied; keep rankLooks' internal q empty)
  const ranked = rankLooks({
    looks: candidates,
    publishers,
    taxonomy: null,
    state: {
      tab: 'looks',
      q: '',
      sort: resolveRequestedSort(state),
      filters: { ...EMPTY_EXPLORE_FILTERS },
    },
    trendingSignals,
    asOf,
    trendingConfig,
  });

  return {
    status: 'ok',
    items: ranked.items,
    effectiveSort: ranked.effectiveSort,
    governanceBlocked: blocked,
    governedCandidateCount: governed.length,
    queryCandidateCount,
    incompatible,
  };
}
