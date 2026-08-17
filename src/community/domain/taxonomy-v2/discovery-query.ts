/**
 * Community v0.7.2 · COMM-v0.7.2-TAX-03 Discovery query URL state (checkpoint 1).
 *
 * This checkpoint implements ONLY URL state parsing + canonical serialization
 * + compatibility markers. Query execution / filtering is a later checkpoint
 * and deliberately not implemented here.
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
  PRIMARY_BROWSE_DIMENSION,
  type TaxonomyDimensionV2,
} from './contract.ts';
import {
  dimensionOfTagId,
  isFrenchLegacyAlias,
  resolveFrenchTechnique,
  resolveTagId,
} from './resolve.ts';
import type { CommunityTaxonomyV2, TaxonomyTagV2 } from './types.ts';

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
