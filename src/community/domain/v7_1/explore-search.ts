/**
 * Community V7.1 · COMM-V7.1-02 Explore & Search contract (pure, dependency-free).
 *
 * URL is the single source of truth for Explore/Search state on `/community`
 * (Discover) and `/community/search`:
 *
 *   tab     = looks | creators
 *   q       = free-text query (trimmed, bounded length)
 *   sort    = featured | trending | new
 *   filters = source, style, color, shape, length, occasion, effect, mood,
 *             application, verification   (same-dim OR, cross-dim AND)
 *
 * The parser sanitizes unknown enum values (tab/sort/source/application/
 * verification), bounds q, trims every value and deduplicates CSV arrays.
 * The serializer emits deterministic canonical params (fixed key order, only
 * non-default values).
 *
 * Ranking product rules (see AGENTS.md V7 Community domain):
 * - Featured is editorial curation: FEATURED_BY_OFFICIAL / campaign editorial
 *   signal first, then New order.
 * - New is publishedAt descending with a stable lookId tie-breaker.
 * - `TrendingSignalV1` carries lookId + occurredAt + a distinct sample/session
 *   key. Only signals inside a frozen/configurable time window count, and a
 *   look needs a documented minimum number of distinct samples. With no /
 *   insufficient signals, `resolveEffectiveSort` deterministically falls back
 *   to FEATURED and reports the reason. The ranker NEVER reads the clock:
 *   `asOf` is injected by the caller.
 * - Made counts / engagement / analytics are NEVER derived here. The static
 *   fixtures carry no verified RealResult / manufacturing records, so nothing
 *   in this module fabricates or infers them.
 *
 * This module is Node-testable (no browser globals, no environment access).
 */

import type { CommunityPublisherV1, CommunityTaxonomyV1 } from '../types';
import { visibleCommunityPublishers } from '../visibility';
import {
  matchesFilters,
  type CommunityFilterState,
  type SourceFilter,
} from '../filters';
import type { PublishedLookReadModelV1 } from './published-look-read-model';

// ---------------------------------------------------------------------------
// Explore URL contract
// ---------------------------------------------------------------------------

export const EXPLORE_TABS = ['looks', 'creators'] as const;
export type ExploreTab = (typeof EXPLORE_TABS)[number];

export const EXPLORE_SORTS = ['featured', 'trending', 'new'] as const;
export type ExploreSort = (typeof EXPLORE_SORTS)[number];

/** Hard bound on the shareable query string length. */
export const MAX_QUERY_LENGTH = 100;

export interface ExploreFilters {
  source: SourceFilter;
  style: string | null;
  /** primaryColorIds 匹配（COMM-V7.1-02）。 */
  color: string | null;
  shape: string | null;
  length: string | null;
  occasion: string[];
  effect: string[];
  mood: string[];
  application: string | null;
  verification: string | null;
}

export const EMPTY_EXPLORE_FILTERS: ExploreFilters = {
  source: 'all',
  style: null,
  color: null,
  shape: null,
  length: null,
  occasion: [],
  effect: [],
  mood: [],
  application: null,
  verification: null,
};

export interface ExploreSearchState {
  tab: ExploreTab;
  q: string;
  sort: ExploreSort;
  filters: ExploreFilters;
}

export const DEFAULT_EXPLORE_STATE: ExploreSearchState = {
  tab: 'looks',
  q: '',
  sort: 'featured',
  filters: EMPTY_EXPLORE_FILTERS,
};

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

/** Trim + dedupe a CSV param, dropping empty entries (first-occurrence order). */
function parseCsvDedupe(value: string | null): string[] {
  if (!value) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of value.split(',')) {
    const item = raw.trim();
    if (!item || seen.has(item)) continue;
    seen.add(item);
    out.push(item);
  }
  return out;
}

function single(value: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function enumOf<T extends string>(
  value: string | null,
  allowed: readonly T[],
): T | null {
  if (!value) return null;
  const trimmed = value.trim();
  return (allowed as readonly string[]).includes(trimmed) ? (trimmed as T) : null;
}

/** Parse + sanitize arbitrary URL params into a valid explore state. */
export function parseExploreState(params: URLSearchParams): ExploreSearchState {
  const q = (params.get('q') ?? '').trim().slice(0, MAX_QUERY_LENGTH);
  return {
    tab: params.get('tab') === 'creators' ? 'creators' : 'looks',
    q,
    sort: enumOf(params.get('sort'), EXPLORE_SORTS) ?? 'featured',
    filters: {
      source: enumOf(params.get('source'), ['all', 'official', 'creators']) ?? 'all',
      style: single(params.get('style')),
      color: single(params.get('color')),
      shape: single(params.get('shape')),
      length: single(params.get('length')),
      occasion: parseCsvDedupe(params.get('occasion')),
      effect: parseCsvDedupe(params.get('effect')),
      mood: parseCsvDedupe(params.get('mood')),
      application: enumOf(params.get('application'), [...APPLICATION_LEVELS]),
      verification: enumOf(params.get('verification'), [...VERIFICATION_LEVELS]),
    },
  };
}

/**
 * Deterministic canonical serializer: fixed key order, only non-default
 * values, CSV arrays joined with ','. Round-trips with `parseExploreState`.
 */
export function exploreStateToSearchParams(state: ExploreSearchState): URLSearchParams {
  const params = new URLSearchParams();
  if (state.tab !== 'looks') params.set('tab', state.tab);
  if (state.q) params.set('q', state.q);
  if (state.sort !== 'featured') params.set('sort', state.sort);
  const f = state.filters;
  if (f.source !== 'all') params.set('source', f.source);
  if (f.style) params.set('style', f.style);
  if (f.color) params.set('color', f.color);
  if (f.shape) params.set('shape', f.shape);
  if (f.length) params.set('length', f.length);
  if (f.occasion.length) params.set('occasion', f.occasion.join(','));
  if (f.effect.length) params.set('effect', f.effect.join(','));
  if (f.mood.length) params.set('mood', f.mood.join(','));
  if (f.application) params.set('application', f.application);
  if (f.verification) params.set('verification', f.verification);
  return params;
}

/** Canonical query string for a state (shareable, deterministic). */
export function serializeExploreState(state: ExploreSearchState): string {
  return exploreStateToSearchParams(state).toString();
}

// ---------------------------------------------------------------------------
// Filtering read models
// ---------------------------------------------------------------------------

/** Explore filters → existing CommunityFilterState (superset compatible). */
export function exploreFiltersToCommunityFilters(f: ExploreFilters): CommunityFilterState {
  return { ...f };
}

/**
 * Filter look read models with the same semantics as `filterContents`
 * (same-dim OR, cross-dim AND) by projecting each look onto its preserved
 * legacy source record. The read model itself is never mutated.
 */
export function filterLookReadModels(
  looks: readonly PublishedLookReadModelV1[],
  filters: ExploreFilters,
): PublishedLookReadModelV1[] {
  const community = exploreFiltersToCommunityFilters(filters);
  return looks.filter((look) => matchesFilters(look.sourceContent, community));
}

// ---------------------------------------------------------------------------
// Query matching
// ---------------------------------------------------------------------------

function normalize(value: string): string {
  return value.toLowerCase().replace(/\s+/g, ' ').trim();
}

function queryTokens(query: string): string[] {
  const q = normalize(query);
  return q ? q.split(' ') : [];
}

/** Every query token must appear in at least one searchable field (AND). */
function matchesQuery(searchable: readonly string[], query: string): boolean {
  const toks = queryTokens(query);
  if (toks.length === 0) return true;
  return toks.every((tok) => searchable.some((field) => field.includes(tok)));
}

interface LookSearchContext {
  publisher?: CommunityPublisherV1;
  taxonomy?: CommunityTaxonomyV1 | null;
}

function taxonomyFields(
  ids: readonly string[],
  items: Array<{ id: string; label: string; labelEn?: string }> | undefined,
  out: string[],
): void {
  for (const id of ids) {
    out.push(id);
    const item = items?.find((x) => x.id === id);
    if (item) {
      if (item.label) out.push(item.label);
      if (item.labelEn) out.push(item.labelEn);
    }
  }
}

/** Normalized searchable fields for one look (title/titleEn, publisher, taxonomy labels+IDs, tags). */
export function lookSearchFields(
  look: PublishedLookReadModelV1,
  ctx: LookSearchContext = {},
): string[] {
  const raw: string[] = [look.title];
  if (look.titleEn) raw.push(look.titleEn);
  if (ctx.publisher) {
    raw.push(ctx.publisher.displayName, ctx.publisher.handle);
  }
  raw.push(look.mainStyleId, ...look.subStyleIds);
  taxonomyFields([look.mainStyleId, ...look.subStyleIds], ctx.taxonomy?.mainStyles, raw);
  taxonomyFields(look.occasionIds, ctx.taxonomy?.occasions, raw);
  taxonomyFields(look.subjectIds, ctx.taxonomy?.subjects, raw);
  taxonomyFields(look.moodIds, ctx.taxonomy?.moods, raw);
  taxonomyFields(look.effectIds, ctx.taxonomy?.effects, raw);
  taxonomyFields(look.primaryColorIds, ctx.taxonomy?.colors, raw);
  raw.push(...look.recommendedShapes, ...look.supportedShapes, ...look.supportedLengths);
  raw.push(...look.campaignTags);
  return raw.map(normalize).filter(Boolean);
}

// ---------------------------------------------------------------------------
// Ranking
// ---------------------------------------------------------------------------

const NO_TRENDING_SIGNALS: readonly TrendingSignalV1[] = [];

/** Editorial curation signal: officially curated or campaign-tagged. */
export function hasEditorialSignal(look: PublishedLookReadModelV1): boolean {
  return (
    look.curationStatus === 'FEATURED_BY_OFFICIAL' ||
    look.campaignTags.includes('recommended')
  );
}

function parseTime(value: string): number {
  const ms = Date.parse(value);
  return Number.isNaN(ms) ? 0 : ms;
}

/** New order: publishedAt descending, stable lookId ascending tie-breaker. */
export function compareNew(a: PublishedLookReadModelV1, b: PublishedLookReadModelV1): number {
  const ta = parseTime(a.publishedAt);
  const tb = parseTime(b.publishedAt);
  if (ta !== tb) return tb - ta;
  return a.lookId < b.lookId ? -1 : a.lookId > b.lookId ? 1 : 0;
}

/** Featured order: editorial signal first, then New order (stable). */
export function compareFeatured(a: PublishedLookReadModelV1, b: PublishedLookReadModelV1): number {
  const ea = hasEditorialSignal(a) ? 0 : 1;
  const eb = hasEditorialSignal(b) ? 0 : 1;
  if (ea !== eb) return ea - eb;
  return compareNew(a, b);
}

// ---------------------------------------------------------------------------
// Trending (bounded window + minimum distinct samples; deterministic fallback)
// ---------------------------------------------------------------------------

export interface TrendingSignalV1 {
  lookId: string;
  /** ISO-8601 timestamp of the sample. */
  occurredAt: string;
  /** Distinct sample/session key — one per real user session. */
  sessionKey: string;
}

export interface TrendingConfigV1 {
  /** Only signals with occurredAt in [asOf - windowMs, asOf] count. */
  windowMs: number;
  /** Documented minimum distinct samples (per look) for trending qualification. */
  minDistinctSamples: number;
}

export const DEFAULT_TRENDING_CONFIG: TrendingConfigV1 = {
  windowMs: 7 * 24 * 60 * 60 * 1000, // 7 days
  minDistinctSamples: 3,
};

/** Honest empty signal set — the static fixtures carry no real analytics. */
export const EMPTY_TRENDING_SIGNALS: readonly TrendingSignalV1[] = NO_TRENDING_SIGNALS;

export interface TrendingCount {
  lookId: string;
  distinctSamples: number;
  lastOccurredAt: string;
}

/** Distinct-sample counts per look, restricted to the frozen time window. */
export function trendingCounts(
  signals: readonly TrendingSignalV1[],
  asOf: string,
  config: TrendingConfigV1 = DEFAULT_TRENDING_CONFIG,
): Map<string, TrendingCount> {
  const asOfMs = Date.parse(asOf);
  if (
    !Number.isFinite(asOfMs) ||
    !Number.isFinite(config.windowMs) ||
    config.windowMs <= 0 ||
    !Number.isInteger(config.minDistinctSamples) ||
    config.minDistinctSamples <= 0
  ) {
    return new Map();
  }
  const windowStart = asOfMs - config.windowMs;
  const sessionsByLook = new Map<string, Set<string>>();
  const lastAt = new Map<string, string>();
  const lastAtMs = new Map<string, number>();
  for (const signal of signals) {
    if (!signal.lookId.trim() || !signal.sessionKey.trim()) continue;
    const occurredMs = Date.parse(signal.occurredAt);
    if (!Number.isFinite(occurredMs)) continue;
    if (occurredMs < windowStart || occurredMs > asOfMs) continue;
    let sessions = sessionsByLook.get(signal.lookId);
    if (!sessions) {
      sessions = new Set();
      sessionsByLook.set(signal.lookId, sessions);
    }
    sessions.add(signal.sessionKey);
    const prevMs = lastAtMs.get(signal.lookId);
    if (prevMs === undefined || occurredMs > prevMs) {
      lastAtMs.set(signal.lookId, occurredMs);
      lastAt.set(signal.lookId, signal.occurredAt);
    }
  }
  const out = new Map<string, TrendingCount>();
  for (const [lookId, sessions] of sessionsByLook) {
    out.set(lookId, {
      lookId,
      distinctSamples: sessions.size,
      lastOccurredAt: lastAt.get(lookId) ?? '',
    });
  }
  return out;
}

export type TrendingFallbackReason = 'trending_no_signals' | 'trending_insufficient_samples';

export interface EffectiveSort {
  requested: ExploreSort;
  applied: ExploreSort;
  fallbackReason?: TrendingFallbackReason;
}

/**
 * Deterministically resolve the effective sort. Trending applies only when at
 * least one look has >= minDistinctSamples distinct in-window samples;
 * otherwise it falls back to FEATURED with an explicit reason. `asOf` is
 * injected — this function never reads the clock.
 */
export function resolveEffectiveSort(
  requested: ExploreSort,
  signals: readonly TrendingSignalV1[],
  asOf: string,
  config: TrendingConfigV1 = DEFAULT_TRENDING_CONFIG,
): EffectiveSort {
  if (requested !== 'trending') return { requested, applied: requested };
  const counts = trendingCounts(signals, asOf, config);
  if (counts.size === 0) {
    return { requested, applied: 'featured', fallbackReason: 'trending_no_signals' };
  }
  const qualified = [...counts.values()].some(
    (c) => c.distinctSamples >= config.minDistinctSamples,
  );
  if (!qualified) {
    return { requested, applied: 'featured', fallbackReason: 'trending_insufficient_samples' };
  }
  return { requested, applied: 'trending' };
}

export interface RankedLook {
  look: PublishedLookReadModelV1;
  /** Present only when the look has in-window trending samples. */
  trendingDistinctSamples?: number;
}

export interface RankLooksResult {
  items: RankedLook[];
  effectiveSort: EffectiveSort;
}

export interface RankLooksInput {
  /** Pre-filtered looks (apply `filterLookReadModels` first). */
  looks: readonly PublishedLookReadModelV1[];
  publishers?: readonly CommunityPublisherV1[];
  taxonomy?: CommunityTaxonomyV1 | null;
  state: ExploreSearchState;
  /** Empty for the current static fixtures; injected for trending. */
  trendingSignals?: readonly TrendingSignalV1[];
  /** Injected clock — never read inside the ranker. */
  asOf: string;
  trendingConfig?: TrendingConfigV1;
}

/** Query + ordering. Filters are applied by the caller via `filterLookReadModels`. */
export function rankLooks(input: RankLooksInput): RankLooksResult {
  const {
    looks,
    publishers,
    taxonomy,
    state,
    trendingSignals = EMPTY_TRENDING_SIGNALS,
    asOf,
    trendingConfig,
  } = input;
  const pubById = new Map((publishers ?? []).map((p) => [p.publisherId, p]));
  const queryMatched = state.q
    ? looks.filter((look) =>
        matchesQuery(
          lookSearchFields(look, { publisher: pubById.get(look.publisherId), taxonomy }),
          state.q,
        ),
      )
    : [...looks];
  const visibleLookIds = new Set(looks.map((look) => look.lookId));
  const visibleSignals = trendingSignals.filter((signal) => visibleLookIds.has(signal.lookId));
  const effectiveSort = resolveEffectiveSort(state.sort, visibleSignals, asOf, trendingConfig);
  const counts =
    state.sort === 'trending' ? trendingCounts(visibleSignals, asOf, trendingConfig) : undefined;
  const sorted = [...queryMatched].sort((a, b) => {
    if (effectiveSort.applied === 'new') return compareNew(a, b);
    if (effectiveSort.applied === 'featured') return compareFeatured(a, b);
    const ca = counts?.get(a.lookId)?.distinctSamples ?? 0;
    const cb = counts?.get(b.lookId)?.distinctSamples ?? 0;
    if (ca !== cb) return cb - ca;
    return compareNew(a, b);
  });
  return {
    items: sorted.map((look) => {
      const count = counts?.get(look.lookId);
      return count
        ? { look, trendingDistinctSamples: count.distinctSamples }
        : { look };
    }),
    effectiveSort,
  };
}

// ---------------------------------------------------------------------------
// Creator search (displayName / handle / bio; demo visibility respected)
// ---------------------------------------------------------------------------

const CREATOR_VERIFICATION_RANK: Record<CommunityPublisherV1['verification'], number> = {
  OFFICIAL: 0,
  VERIFIED_CREATOR: 1,
  DEMO_VERIFIED_CREATOR: 2,
  NONE: 3,
};

/**
 * Deterministic creator search over displayName / handle / bio. Demo creators
 * are hidden outside explicit QA modes (production demo visibility contract).
 * Order: verification tier, then displayName, then handle — stable.
 */
export function searchCreators(input: {
  publishers: readonly CommunityPublisherV1[];
  mode: string;
  q: string;
}): CommunityPublisherV1[] {
  const visible = visibleCommunityPublishers([...input.publishers], input.mode).filter(
    (publisher) => publisher.type === 'CREATOR',
  );
  const q = input.q.trim();
  const matched = q
    ? visible.filter((p) =>
        matchesQuery(
          [p.displayName, p.handle, p.bio ?? ''].map(normalize).filter(Boolean),
          q,
        ),
      )
    : [...visible];
  return matched.sort((a, b) => {
    const ra = CREATOR_VERIFICATION_RANK[a.verification] ?? 3;
    const rb = CREATOR_VERIFICATION_RANK[b.verification] ?? 3;
    if (ra !== rb) return ra - rb;
    const byName = a.displayName.localeCompare(b.displayName);
    if (byName !== 0) return byName;
    return a.handle.localeCompare(b.handle);
  });
}
