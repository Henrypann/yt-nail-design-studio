/**
 * CommunityFeed · Discover / Search / Official / Creators 共享 Explore 组件
 * （COMM-V7.1-02）。
 *
 * - 消费 `PublishedLookReadModelV1`（look-repository），不再为
 *   CommunityContentV1 追加发现字段；保留 taxonomy / publisher /
 *   loading / error / retry / empty / clear 状态。
 * - URL 为唯一真源：tab / q / sort / 全部筛选经 `parseExploreState` 解析、
 *   `exploreStateToSearchParams` 回写（replace），刷新/分享可恢复；只保留
 *   产品上下文 entry / return_to。
 * - Search 模式提供 Looks / Creators 可访问 tabs；Discover 保持 Looks 探索。
 * - Official / Creators 保持 lockedSource 行为；Trending 无/不足信号时由
 *   CommunitySortControl 显式披露回退（fallback 来自纯函数 resolveEffectiveSort）。
 * - 不加载 Three.js；卡片不伪造 Save 持久化与 Made 计数。
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button, Skeleton, cx } from '@/design-system';
import { useLocale } from '@/lib/i18n';
import {
  loadContentIndex,
  loadPublishers,
  loadTaxonomy,
  officialPgcProgress,
} from '../data/content-repository';
import { loadLookReadModels } from '../data/look-repository';
import type { CommunityPublisherV1, CommunityTaxonomyV1 } from '../domain/types';
import type { PublishedLookReadModelV1 } from '../domain/v7_1/published-look-read-model';
import {
  DEFAULT_EXPLORE_STATE,
  DEFAULT_TRENDING_CONFIG,
  EMPTY_EXPLORE_FILTERS,
  EMPTY_TRENDING_SIGNALS,
  EXPLORE_TABS,
  filterLookReadModels,
  parseExploreState,
  exploreStateToSearchParams,
  rankLooks,
  searchCreators,
  type ExploreSearchState,
  type ExploreSort,
  type ExploreTab,
} from '../domain/v7_1/explore-search';
import type { SourceFilter } from '../domain/filters';
import { CommunitySearchBar } from '../components/CommunitySearchBar';
import { CommunitySortControl } from '../components/CommunitySortControl';
import { CommunityFilters } from '../components/CommunityFilters';
import { CommunityLookCard } from '../components/CommunityLookCard';
import { CommunityCreatorCard } from '../components/CommunityCreatorCard';
import { NailBoardSaveDialog } from '../components/NailBoardSaveDialog';

type LoadState = 'loading' | 'ready' | 'error';
type ExploreMode = 'discover' | 'search';

export function CommunityFeed({
  mode = 'discover',
  title,
  subtitle,
  lockedSource,
  showOfficialProgress,
}: {
  mode?: ExploreMode;
  title: string;
  subtitle: string;
  lockedSource?: SourceFilter;
  showOfficialProgress?: boolean;
}) {
  const { text } = useLocale();
  const [searchParams, setSearchParams] = useSearchParams();
  const [state, setState] = useState<LoadState>('loading');
  const [lookModels, setLookModels] = useState<PublishedLookReadModelV1[]>([]);
  const [publishers, setPublishers] = useState<CommunityPublisherV1[]>([]);
  const [taxonomy, setTaxonomy] = useState<CommunityTaxonomyV1 | null>(null);
  const [progress, setProgress] = useState<{ ready: number; target: number; gap: number } | null>(null);
  const [retry, setRetry] = useState(0);
  const rankingAsOf = useRef(new Date().toISOString());
  /** COMM-V7.1-03: Feed 拥有 Save-to-Board 对话框；卡片只上报保存意图。 */
  const [saveLook, setSaveLook] = useState<PublishedLookReadModelV1 | null>(null);

  const exploreState = useMemo(() => {
    const parsed = parseExploreState(searchParams);
    if (lockedSource) parsed.filters.source = lockedSource;
    return parsed;
  }, [searchParams, lockedSource]);

  const applyState = useCallback(
    (next: ExploreSearchState) => {
      const effective = lockedSource
        ? { ...next, filters: { ...next.filters, source: lockedSource } }
        : next;
      const params = exploreStateToSearchParams(effective);
      // 只保留显式产品上下文 entry / return_to；筛选/搜索状态本身就是 URL 真源。
      for (const key of ['entry', 'return_to'] as const) {
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
        const [looks, pubs, tax, index] = await Promise.all([
          loadLookReadModels(),
          loadPublishers(),
          loadTaxonomy(),
          loadContentIndex(),
        ]);
        if (cancelled) return;
        setLookModels(looks);
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

  const filteredLooks = useMemo(
    () => filterLookReadModels(lookModels, exploreState.filters),
    [lookModels, exploreState.filters],
  );

  const ranked = useMemo(
    () =>
      rankLooks({
        looks: filteredLooks,
        publishers,
        taxonomy,
        state: exploreState,
        // 静态 fixture 无真实互动分析：诚实传入空信号集，由纯函数确定性回退。
        trendingSignals: EMPTY_TRENDING_SIGNALS,
        asOf: rankingAsOf.current,
      }),
    [filteredLooks, publishers, taxonomy, exploreState],
  );

  const creators = useMemo(
    () => searchCreators({ publishers, mode: import.meta.env.MODE, q: exploreState.q }),
    [publishers, exploreState.q],
  );

  const looksTab = exploreState.tab === 'looks';
  const showTabs = mode === 'search';
  const showLookSurfacing = showTabs ? looksTab : true;
  const trendingFallback =
    exploreState.sort === 'trending' && ranked.effectiveSort.applied !== 'trending'
      ? {
          reason: ranked.effectiveSort.fallbackReason ?? ('trending_no_signals' as const),
          minDistinctSamples: DEFAULT_TRENDING_CONFIG.minDistinctSamples,
        }
      : null;

  return (
    <div className="flex flex-col gap-4" data-testid="community-feed">
      <header>
        <h1 className="text-lg font-semibold text-gray-900">{title}</h1>
        <p className="mt-0.5 text-xs text-gray-500">{subtitle}</p>
        {showOfficialProgress && progress && (
          <p className="mt-1 text-nano text-gray-400" data-testid="official-pgc-progress">
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
          <p className="text-sm text-gray-500">{text('内容加载失败', 'Failed to load content')}</p>
          <Button className="min-h-11" size="sm" variant="secondary" onClick={() => setRetry((k) => k + 1)}>
            {text('重试', 'Retry')}
          </Button>
        </div>
      )}

      {state === 'ready' && taxonomy && (
        <>
          <CommunitySearchBar
            value={exploreState.q}
            onSubmit={(q) => applyState({ ...exploreState, q })}
          />

          {showTabs && (
            <ExploreTabs tab={exploreState.tab} onChange={(tab) => applyState({ ...exploreState, tab })} />
          )}

          {showLookSurfacing ? (
            <>
              <CommunitySortControl
                sort={exploreState.sort}
                onChange={(sort: ExploreSort) => applyState({ ...exploreState, sort })}
                trendingFallback={trendingFallback}
              />
              <CommunityFilters
                taxonomy={taxonomy}
                filters={exploreState.filters}
                onChange={(filters) => applyState({ ...exploreState, filters })}
                resultCount={ranked.items.length}
              />
              {ranked.items.length > 0 ? (
                <div
                  role={showTabs ? 'tabpanel' : undefined}
                  id={showTabs ? 'explore-tabpanel' : undefined}
                  aria-labelledby={showTabs ? 'explore-tab-looks' : undefined}
                  className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3"
                  data-testid="community-look-grid"
                >
                  {ranked.items.map(({ look }) => (
                    <CommunityLookCard
                      key={look.lookId}
                      look={look}
                      publisher={pubMap.get(look.publisherId)}
                      taxonomy={taxonomy}
                      onSave={(selected) => setSaveLook(selected)}
                    />
                  ))}
                </div>
              ) : (
                <div
                  className="rounded-card border border-dashed border-gray-200 bg-white px-4 py-10 text-center"
                  data-testid="community-feed-empty"
                >
                  <p className="text-sm font-medium text-gray-800">{text('没有匹配的已发布内容', 'No matching published looks')}</p>
                  <p className="mt-1 text-xs text-gray-500">
                    {text('草稿与未发布内容不会出现在 Explore。', 'Drafts and unpublished content never appear in Explore.')}
                  </p>
                  <Button
                    className="mt-4 min-h-11"
                    size="sm"
                    variant="secondary"
                    onClick={() =>
                      applyState({
                        ...DEFAULT_EXPLORE_STATE,
                        q: exploreState.q,
                        filters: { ...EMPTY_EXPLORE_FILTERS, source: lockedSource ?? 'all' },
                      })
                    }
                  >
                    {text('清除筛选', 'Clear filters')}
                  </Button>
                </div>
              )}
            </>
          ) : (
            <div
              role="tabpanel"
              id="explore-tabpanel"
              aria-labelledby="explore-tab-creators"
              className="flex flex-col gap-3"
            >
              {creators.length > 0 ? (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3" data-testid="community-creator-grid">
                  {creators.map((publisher) => (
                    <CommunityCreatorCard key={publisher.publisherId} publisher={publisher} />
                  ))}
                </div>
              ) : (
                <div
                  className="rounded-card border border-dashed border-gray-200 bg-white px-4 py-10 text-center"
                  data-testid="community-creators-empty"
                >
                  <p className="text-sm font-medium text-gray-800">{text('没有匹配的创作者', 'No matching creators')}</p>
                  <Button
                    className="mt-4 min-h-11"
                    size="sm"
                    variant="secondary"
                    onClick={() => applyState({ ...exploreState, q: '' })}
                  >
                    {text('清除搜索', 'Clear search')}
                  </Button>
                </div>
              )}
            </div>
          )}

          <p className="pt-2 text-center text-nano text-gray-400">
            {text(
              'Feed 不加载 Three.js · 预览通过 ≠ 可制造 · Made 需要已验证的 Real Result / 履约记录（当前不可用）· Demo 创作者仅 Integration 可见',
              'Feed does not load Three.js · Preview ≠ manufacturable · Made requires a verified Real Result / fulfillment record (unavailable) · Demo creators visible in Integration only',
            )}
          </p>
        </>
      )}

      {/* COMM-V7.1-03: Feed 拥有 Save-to-Board 对话框，卡片不直接持久化。 */}
      {saveLook && (
        <NailBoardSaveDialog
          key={saveLook.lookId}
          look={saveLook}
          open
          onClose={() => setSaveLook(null)}
        />
      )}
    </div>
  );
}

/** Looks / Creators 可访问 tabs（WAI-ARIA tabs 模式，方向键切换）。 */
function ExploreTabs({ tab, onChange }: { tab: ExploreTab; onChange: (tab: ExploreTab) => void }) {
  const { text } = useLocale();
  const refs = useRef<Partial<Record<ExploreTab, HTMLButtonElement | null>>>({});
  const onKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, current: ExploreTab) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    const next: ExploreTab = current === 'looks' ? 'creators' : 'looks';
    onChange(next);
    refs.current[next]?.focus();
  };
  return (
    <div
      role="tablist"
      aria-label={text('搜索范围', 'Search scope')}
      className="inline-flex items-center gap-1 rounded-card border border-gray-200 bg-white p-1"
      data-testid="community-explore-tabs"
    >
      {EXPLORE_TABS.map((value) => {
        const active = tab === value;
        return (
          <button
            key={value}
            ref={(el) => {
              refs.current[value] = el;
            }}
            type="button"
            role="tab"
            id={`explore-tab-${value}`}
            aria-selected={active}
            aria-controls="explore-tabpanel"
            tabIndex={active ? 0 : -1}
            data-testid={`explore-tab-${value}`}
            onClick={() => onChange(value)}
            onKeyDown={(event) => onKeyDown(event, value)}
            className={cx(
              'inline-flex h-11 items-center rounded-panel px-4 text-sm font-medium',
              'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
              active ? 'bg-primary-soft text-primary' : 'text-gray-600 hover:bg-gray-50',
            )}
          >
            {value === 'looks' ? text('款式', 'Looks') : text('创作者', 'Creators')}
          </button>
        );
      })}
    </div>
  );
}
