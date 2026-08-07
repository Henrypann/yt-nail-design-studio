/**
 * Shared feed loader for Discover / Official / Creators.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button, Skeleton } from '@/design-system';
import {
  loadContentIndex,
  loadPublishers,
  loadPublishedContents,
  loadTaxonomy,
  officialPgcProgress,
} from '../data/content-repository';
import type { CommunityContentV1, CommunityPublisherV1, CommunityTaxonomyV1 } from '../domain/types';
import {
  EMPTY_FILTERS,
  filterContents,
  filtersToSearchParams,
  parseFiltersFromSearch,
  type CommunityFilterState,
  type SourceFilter,
} from '../domain/filters';
import { CommunityFilters } from '../components/CommunityFilters';
import { CommunityContentCard } from '../components/CommunityContentCard';

type LoadState = 'loading' | 'ready' | 'error';

export function CommunityFeed({
  title,
  subtitle,
  lockedSource,
  showOfficialProgress,
}: {
  title: string;
  subtitle: string;
  lockedSource?: SourceFilter;
  showOfficialProgress?: boolean;
}) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [state, setState] = useState<LoadState>('loading');
  const [contents, setContents] = useState<CommunityContentV1[]>([]);
  const [publishers, setPublishers] = useState<CommunityPublisherV1[]>([]);
  const [taxonomy, setTaxonomy] = useState<CommunityTaxonomyV1 | null>(null);
  const [progress, setProgress] = useState<{ ready: number; target: number; gap: number } | null>(null);
  const [retry, setRetry] = useState(0);

  const filters = useMemo(() => {
    const parsed = parseFiltersFromSearch(searchParams);
    if (lockedSource) return { ...parsed, source: lockedSource };
    return parsed;
  }, [searchParams, lockedSource]);

  const setFilters = useCallback(
    (next: CommunityFilterState) => {
      const merged = lockedSource ? { ...next, source: lockedSource } : next;
      const params = filtersToSearchParams(merged);
      // preserve entry/return_to/shape from product switcher
      for (const key of ['entry', 'return_to', 'shape', 'length'] as const) {
        const v = searchParams.get(key);
        if (v) params.set(key, v);
      }
      setSearchParams(params, { replace: true });
    },
    [lockedSource, searchParams, setSearchParams],
  );

  useEffect(() => {
    let cancelled = false;
    setState('loading');
    (async () => {
      try {
        const [list, pubs, tax, index] = await Promise.all([
          loadPublishedContents(),
          loadPublishers(),
          loadTaxonomy(),
          loadContentIndex(),
        ]);
        if (cancelled) return;
        setContents(list);
        setPublishers(pubs);
        setTaxonomy(tax);
        setProgress(officialPgcProgress(index));
        setState('ready');
      } catch {
        if (!cancelled) setState('error');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [retry]);

  const pubMap = useMemo(() => new Map(publishers.map((p) => [p.publisherId, p])), [publishers]);
  const visible = useMemo(() => filterContents(contents, filters), [contents, filters]);

  return (
    <div className="flex flex-col gap-4" data-testid="community-feed">
      <header>
        <h1 className="text-lg font-semibold text-gray-900">{title}</h1>
        <p className="mt-0.5 text-xs text-gray-500">{subtitle}</p>
        {showOfficialProgress && progress && (
          <p className="mt-1 text-[11px] text-gray-400" data-testid="official-pgc-progress">
            官方 PGC Metadata Ready {progress.ready}/{progress.target}（缺口 {progress.gap} 仅校验可见，不展示假卡）
          </p>
        )}
      </header>

      {state === 'loading' && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="aspect-[4/3] w-full" />
          ))}
        </div>
      )}

      {state === 'error' && (
        <div className="flex flex-col items-center gap-3 py-12">
          <p className="text-sm text-gray-500">内容加载失败</p>
          <Button size="sm" variant="secondary" onClick={() => setRetry((k) => k + 1)}>
            重试
          </Button>
        </div>
      )}

      {state === 'ready' && taxonomy && (
        <>
          <CommunityFilters
            taxonomy={taxonomy}
            filters={filters}
            onChange={setFilters}
            resultCount={visible.length}
          />
          {visible.length > 0 ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {visible.map((c) => (
                <CommunityContentCard
                  key={c.contentId}
                  content={c}
                  publisher={pubMap.get(c.publisherId)}
                  taxonomy={taxonomy}
                />
              ))}
            </div>
          ) : (
            <div
              className="rounded-card border border-dashed border-gray-200 bg-white px-4 py-10 text-center"
              data-testid="community-feed-empty"
            >
              <p className="text-sm font-medium text-gray-800">没有匹配的已发布内容</p>
              <p className="mt-1 text-xs text-gray-500">草稿与未发布内容不会出现在 Discover。</p>
              <Button
                className="mt-4"
                size="sm"
                variant="secondary"
                onClick={() =>
                  setFilters({
                    ...EMPTY_FILTERS,
                    source: lockedSource ?? 'all',
                  })
                }
              >
                清除筛选
              </Button>
            </div>
          )}
          <p className="pt-2 text-center text-[10px] text-gray-400">
            Feed 不加载 Three.js · 预览通过 ≠ 可制造 · Demo 创作者仅 Integration 可见
          </p>
        </>
      )}
    </div>
  );
}
