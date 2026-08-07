/**
 * Community URL 筛选：同维 OR、跨维 AND；URL 为真源。
 */

import type { CommunityContentV1, PublisherType } from './types';

export type SourceFilter = 'all' | 'official' | 'creators';

export interface CommunityFilterState {
  source: SourceFilter;
  style: string | null;
  occasion: string[];
  effect: string[];
  mood: string[];
  shape: string | null;
  length: string | null;
  application: string | null;
  verification: string | null;
}

export const EMPTY_FILTERS: CommunityFilterState = {
  source: 'all',
  style: null,
  occasion: [],
  effect: [],
  mood: [],
  shape: null,
  length: null,
  application: null,
  verification: null,
};

function csv(value: string | null): string[] {
  if (!value) return [];
  return value.split(',').map((s) => s.trim()).filter(Boolean);
}

export function parseFiltersFromSearch(params: URLSearchParams): CommunityFilterState {
  const sourceRaw = params.get('source');
  const source: SourceFilter =
    sourceRaw === 'official' || sourceRaw === 'creators' ? sourceRaw : 'all';
  return {
    source,
    style: params.get('style'),
    occasion: csv(params.get('occasion')),
    effect: csv(params.get('effect')),
    mood: csv(params.get('mood')),
    shape: params.get('shape'),
    length: params.get('length'),
    application: params.get('application'),
    verification: params.get('verification'),
  };
}

export function filtersToSearchParams(filters: CommunityFilterState): URLSearchParams {
  const p = new URLSearchParams();
  if (filters.source !== 'all') p.set('source', filters.source);
  if (filters.style) p.set('style', filters.style);
  if (filters.occasion.length) p.set('occasion', filters.occasion.join(','));
  if (filters.effect.length) p.set('effect', filters.effect.join(','));
  if (filters.mood.length) p.set('mood', filters.mood.join(','));
  if (filters.shape) p.set('shape', filters.shape);
  if (filters.length) p.set('length', filters.length);
  if (filters.application) p.set('application', filters.application);
  if (filters.verification) p.set('verification', filters.verification);
  return p;
}

function matchAny(selected: string[], values: string[]): boolean {
  if (selected.length === 0) return true;
  return selected.some((s) => values.includes(s));
}

export function filterContents(
  contents: CommunityContentV1[],
  filters: CommunityFilterState,
): CommunityContentV1[] {
  return contents.filter((c) => {
    if (filters.source === 'official' && c.publisherType !== 'OFFICIAL') return false;
    if (filters.source === 'creators' && c.publisherType !== 'VERIFIED_CREATOR') return false;
    if (filters.style && c.mainStyleId !== filters.style) return false;
    if (!matchAny(filters.occasion, c.occasionIds)) return false;
    if (!matchAny(filters.effect, c.effectIds)) return false;
    if (!matchAny(filters.mood, c.moodIds)) return false;
    if (filters.shape) {
      const shapes = [...c.recommendedShapes, ...c.supportedShapes];
      if (!shapes.includes(filters.shape)) return false;
    }
    if (filters.length && !c.supportedLengths.includes(filters.length)) return false;
    if (filters.application && c.applicationLevel !== filters.application) return false;
    if (filters.verification && c.verificationLevel !== filters.verification) return false;
    return true;
  });
}

export function advancedFilterCount(filters: CommunityFilterState): number {
  let n = 0;
  if (filters.occasion.length) n += 1;
  if (filters.effect.length) n += 1;
  if (filters.mood.length) n += 1;
  if (filters.shape) n += 1;
  if (filters.length) n += 1;
  if (filters.application) n += 1;
  if (filters.verification) n += 1;
  return n;
}

export function sourceOf(publisherType: PublisherType): SourceFilter {
  return publisherType === 'OFFICIAL' ? 'official' : 'creators';
}
