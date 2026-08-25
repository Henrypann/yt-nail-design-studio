/**
 * CommunityFeed · Discover / Search / Official / Creators 共享 Explore 组件
 * （COMM-V7.1-02 + COMM-v0.7.2-TAX-03 + COMM-v0.7.2-TAX-04）。
 *
 * - TAX-04：搜索/tabs 之后、排序/运行时筛选之前集成
 *   `CommunityDiscoveryBrowseNavigation`（主/次浏览导航，仅 look 呈现）；
 *   其变更同样经 `applyState` push 历史，会话记忆不读写存储、不自动导航。
 *
 * - 消费 `PublishedLookReadModelV1`（look-repository），保留 publisher /
 *   loading / error / retry / empty / clear 状态；发现查询与卡片展示均使用
 *   TAX-03/TAX-04 的 strict taxonomy-v2（不再为卡片加载 legacy 词表）。
 * - URL 为唯一真源：tab / q / sort / source / browse / topic / length /
 *   makeability / rights / technique 经 `parseDiscoveryQueryV2` 解析、
 *   `serializeDiscoveryQueryV2` 回写；用户发起的筛选变更 push 进浏览器
 *   历史（Back 恢复上一个可分享结果，满足刷新/返回/分享契约），刷新/分享
 *   可恢复；只保留产品上下文 entry / return_to。
 * - 旧 legacy 条件只产生兼容标记（可逐条移除）或不兼容问题（可见 banner，
 *   逐 key 删除，绝不自动清除、绝不静默映射）。
 * - 结果由 `executeDiscoveryQueryV2` 纯管道产生（治理 → 过滤 → 排序）；
 *   `following` 无关系提供方，不提供 UI。
 * - Search 模式提供 Looks / Creators 可访问 tabs；Discover 保持 Looks 探索。
 * - Official / Creators 保持 lockedSource 行为；Trending 无/不足信号时由
 *   CommunitySortControl 显式披露回退（fallback 来自执行器的纯 effectiveSort）。
 * - 不加载 Three.js；卡片不伪造 Save 持久化与 Made 计数。
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { X } from 'lucide-react';
import { Button, Skeleton, cx } from '@/design-system';
import { useLocale } from '@/lib/i18n';
import {
  loadContentIndex,
  loadPublishers,
  officialPgcProgress,
} from '../data/content-repository';
import { loadLookReadModels } from '../data/look-repository';
import { loadCommunityAssetCapabilitiesV1 } from '../data/asset-capability-repository';
import { loadCommunityTaxonomyV2 } from '../data/taxonomy-repository';
import type { CommunityPublisherV1 } from '../domain/types';
import type { PublishedLookReadModelV1 } from '../domain/v7_1/published-look-read-model';
import type { CommunityLookAssetCapabilityReadModelV1 } from '../domain/asset-capability-v1';
import type { CommunityTaxonomyV2 } from '../domain/taxonomy-v2/types';
import {
  createDefaultDiscoveryQueryState,
  executeDiscoveryQueryV2,
  mergeDiscoveryQueryIncompatibleParams,
  parseDiscoveryQueryV2,
  removeDiscoveryQueryIncompatibleIssue,
  serializeDiscoveryQueryV2,
  type DiscoveryCompatibilityMarkerV2,
  type DiscoveryIncompatibleIssueV2,
  type DiscoveryQueryStateV2,
} from '../domain/taxonomy-v2/discovery-query';
import {
  DEFAULT_RECOMMENDATION_CHANNEL,
  RIGHTS_STATUS_TAGS,
} from '../domain/taxonomy-v2/contract';
import {
  DEFAULT_TRENDING_CONFIG,
  EMPTY_TRENDING_SIGNALS,
  EXPLORE_TABS,
  searchCreators,
  type ExploreSort,
  type ExploreTab,
} from '../domain/v7_1/explore-search';
import type { SourceFilter } from '../domain/filters';
import { CommunitySearchBar } from '../components/CommunitySearchBar';
import { CommunitySortControl } from '../components/CommunitySortControl';
import { CommunityDiscoveryBrowseNavigation } from '../components/CommunityDiscoveryBrowseNavigation';
import { CommunityDiscoveryRuntimeFilters } from '../components/CommunityDiscoveryRuntimeFilters';
import { CommunityLookCard } from '../components/CommunityLookCard';
import { CommunityCreatorCard } from '../components/CommunityCreatorCard';
import { NailBoardSaveDialog } from '../components/NailBoardSaveDialog';

type LoadState = 'loading' | 'ready' | 'error';
type ExploreMode = 'discover' | 'search';

/**
 * TAX-04: 显式空结果反馈分类（见 emptyFeedbackKind 的推导顺序）。
 * 每一种都是独立的稳定 testid，绝不混用通用空态文案。
 */
type FeedEmptyFeedbackKind = 'invalid-link' | 'rights-restricted' | 'access-denied' | 'empty';

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
  const { t } = useLocale();
  const [searchParams, setSearchParams] = useSearchParams();
  const [state, setState] = useState<LoadState>('loading');
  const [lookModels, setLookModels] = useState<PublishedLookReadModelV1[]>([]);
  const [assetCapabilities, setAssetCapabilities] = useState<Map<string, CommunityLookAssetCapabilityReadModelV1>>(new Map());
  const [publishers, setPublishers] = useState<CommunityPublisherV1[]>([]);
  const [taxonomyV2, setTaxonomyV2] = useState<CommunityTaxonomyV2 | null>(null);
  const [progress, setProgress] = useState<{ ready: number; target: number; gap: number } | null>(null);
  const [retry, setRetry] = useState(0);
  const rankingAsOf = useRef(new Date().toISOString());
  /** COMM-V7.1-03: Feed 拥有 Save-to-Board 对话框；卡片只上报保存意图。 */
  const [saveLook, setSaveLook] = useState<PublishedLookReadModelV1 | null>(null);

  /**
   * TAX-03: URL 为唯一真源。V2 taxonomy 就绪前仅用默认 state 保证渲染安全；
   * 就绪后由 `parseDiscoveryQueryV2` 解析（total，绝不抛错），lockedSource
   * 不可变覆盖 source，incompatible / markers 原样保留。
   */
  const queryState = useMemo<DiscoveryQueryStateV2>(() => {
    if (!taxonomyV2) return createDefaultDiscoveryQueryState();
    const parsed = parseDiscoveryQueryV2(searchParams, taxonomyV2, {
      relationshipProviderAvailable: false,
    });
    return lockedSource ? { ...parsed.state, source: lockedSource } : parsed.state;
  }, [searchParams, taxonomyV2, lockedSource]);

  const applyState = useCallback(
    (next: DiscoveryQueryStateV2) => {
      const effective = lockedSource ? { ...next, source: lockedSource } : next;
      // TAX-03: 不兼容条件原样保留（含重复值）；显式移除是唯一清除路径。
      // 合并 helper 先删掉 canonical 中同 key 的序列化结果，再按原始顺序
      // 追加当前 URL 的全部原始值，避免重复累积（byte-stable）。
      const params = mergeDiscoveryQueryIncompatibleParams(
        new URLSearchParams(serializeDiscoveryQueryV2(effective)),
        searchParams,
        effective.incompatible,
      );
      // 只保留显式产品上下文 entry / return_to；筛选/搜索状态本身就是 URL 真源。
      for (const key of ['entry', 'return_to'] as const) {
        const v = searchParams.get(key);
        if (v) params.set(key, v);
      }
      // TAX-03: 用户发起的变更使用 push（默认 replace:false），浏览器 Back
      // 可恢复上一个可分享结果；URL 仍是唯一真源，不做初始自动 canonical 导航。
      setSearchParams(params);
    },
    [lockedSource, searchParams, setSearchParams],
  );

  /**
   * TAX-03: 移除兼容标记（按 identity 或 code+rawValue），并同步清除其
   * 在 canonical state 中的条件；随后 applyState 重写 URL，旧 legacy key
   * 随之消失，条件真正移除。
   */
  const removeMarker = useCallback(
    (marker: DiscoveryCompatibilityMarkerV2) => {
      const next: DiscoveryQueryStateV2 = {
        ...queryState,
        markers: queryState.markers.filter(
          (m) => !(m === marker || (m.code === marker.code && m.rawValue === marker.rawValue)),
        ),
      };
      if (marker.canonicalKey === 'technique') {
        next.techniqueIds = next.techniqueIds.filter((id) => id !== marker.canonicalValue);
      } else if (marker.canonicalKey === 'length') {
        next.lengthIds = next.lengthIds.filter((id) => id !== marker.canonicalValue);
      } else if (marker.canonicalKey === 'topic') {
        next.browse = 'recommended';
        next.topic = DEFAULT_RECOMMENDATION_CHANNEL;
      }
      applyState(next);
    },
    [applyState, queryState],
  );

  /**
   * TAX-03: 显式移除不兼容问题。CSV key 只移除对应 item（保留其余兄弟项
   * 与其它 key），单值 key 整键删除（fail-closed）；其余上下文全部保留。
   */
  const removeIncompatibleIssue = useCallback(
    (issue: DiscoveryIncompatibleIssueV2) => {
      // TAX-03: 显式移除同样 push，浏览器 Back 恢复移除前的原始链接/状态。
      setSearchParams(removeDiscoveryQueryIncompatibleIssue(searchParams, issue));
    },
    [searchParams, setSearchParams],
  );

  /** TAX-03: 推荐频道 trending/new 强制排序；手动改排序时先回到 for-you。 */
  const handleSortChange = useCallback(
    (sort: ExploreSort) => {
      if (
        queryState.browse === 'recommended' &&
        (queryState.topic === 'trending' || queryState.topic === 'new')
      ) {
        applyState({ ...queryState, topic: DEFAULT_RECOMMENDATION_CHANNEL, sort });
      } else {
        applyState({ ...queryState, sort });
      }
    },
    [applyState, queryState],
  );

  /**
   * TAX-04: 通用重置 → 默认兼容状态。保留 locked source 与当前 tab；同时清空
   * q，让「搜索词导致的结果为空」在重置后恢复默认结果。默认 state 的
   * incompatible/markers 为空，绝不保留任何不兼容条件 —— TAX-03 的逐条显式
   * 移除仍是唯一清除路径。仅供 rights-restricted 与 empty 反馈使用；
   * invalid-link / access-denied 分支不渲染此动作。
   */
  const resetToDefault = useCallback(() => {
    applyState({
      ...createDefaultDiscoveryQueryState(),
      tab: queryState.tab,
      q: '',
      source: lockedSource ?? 'all',
    });
  }, [applyState, lockedSource, queryState.tab]);

  useEffect(() => {
    let cancelled = false;
    setState('loading');
    (async () => {
      try {
        const [looks, pubs, index, taxV2, capabilities] = await Promise.all([
          loadLookReadModels(),
          loadPublishers(),
          loadContentIndex(),
          loadCommunityTaxonomyV2(),
          loadCommunityAssetCapabilitiesV1(),
        ]);
        if (cancelled) return;
        if (!taxV2.ok) {
          // TAX-03: V2 taxonomy 加载/解析失败 → 可见失败（fail closed）。
          throw new Error(
            `community taxonomy-v2 unavailable: ${taxV2.issues.map((issue) => issue.code).join(',')}`,
          );
        }
        setLookModels(looks);
        setAssetCapabilities(new Map(
          capabilities.ok
            ? capabilities.index.entries.map((entry) => [entry.contentId, entry] as const)
            : [],
        ));
        setPublishers(pubs);
        setTaxonomyV2(taxV2.taxonomy);
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

  /** TAX-03: 治理 → 过滤 → 排序 纯管道；V2 taxonomy 就绪前返回 null 仅作渲染保护。 */
  const queryResult = useMemo(() => {
    if (!taxonomyV2) return null;
    return executeDiscoveryQueryV2({
      looks: lookModels,
      publishers,
      taxonomy: taxonomyV2,
      state: queryState,
      relationshipProviderAvailable: false,
      // 静态 fixture 无真实互动分析：诚实传入空信号集，由纯函数确定性回退。
      trendingSignals: EMPTY_TRENDING_SIGNALS,
      asOf: rankingAsOf.current,
    });
  }, [lookModels, publishers, taxonomyV2, queryState]);

  /**
   * TAX-04: 显式空反馈分类（仅当 queryResult 存在且 items 为空时有效）。
   * 顺序即优先级：
   * - invalid-link：存在不兼容条件 → 只有逐条显式移除可解决，绝不提供通用清除；
   * - rights-restricted：兼容状态但显式请求了永不公开的 PENDING 版权 → 提供
   *   兼容的通用重置（回到默认兼容状态，绝不保留不兼容条件）；
   * - access-denied：兼容状态但治理门禁拦截了全部候选（无公开可访问内容）→
   *   不提供通用重置，绝不自动放宽；
   * - empty：普通零匹配 → 提供通用重置。
   */
  const emptyFeedbackKind = useMemo<FeedEmptyFeedbackKind | null>(() => {
    if (!queryResult || queryResult.items.length > 0) return null;
    if (queryResult.incompatible.length > 0) return 'invalid-link';
    if (queryState.rightsIds.includes(RIGHTS_STATUS_TAGS.PENDING)) {
      return 'rights-restricted';
    }
    if (queryResult.governedCandidateCount === 0 && queryResult.governanceBlocked > 0) {
      return 'access-denied';
    }
    return 'empty';
  }, [queryResult, queryState.rightsIds]);

  const creators = useMemo(
    () => searchCreators({ publishers, mode: import.meta.env.MODE, q: queryState.q }),
    [publishers, queryState.q],
  );

  const looksTab = queryState.tab === 'looks';
  const showTabs = mode === 'search';
  const showLookSurfacing = showTabs ? looksTab : true;
  const trendingFallback =
    queryResult &&
    queryResult.effectiveSort.requested === 'trending' &&
    queryResult.effectiveSort.applied !== 'trending'
      ? {
          reason: queryResult.effectiveSort.fallbackReason ?? ('trending_no_signals' as const),
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
            {t('community.pgcMetadataReady', { ready: progress.ready, target: progress.target, gap: progress.gap })}
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
        <div
          className="flex flex-col items-center gap-3 py-12"
          data-testid="community-feed-feedback-load-failed"
        >
          <p className="text-sm text-gray-500">{t('app.failedLoadContent')}</p>
          <Button className="min-h-11" size="sm" variant="secondary" onClick={() => setRetry((k) => k + 1)}>
            {t('app.retry')}
          </Button>
        </div>
      )}

      {state === 'ready' && taxonomyV2 && queryResult && (
        <>
          <CommunitySearchBar
            value={queryState.q}
            onSubmit={(q) => applyState({ ...queryState, q })}
          />

          {showTabs && (
            <ExploreTabs tab={queryState.tab} onChange={(tab) => applyState({ ...queryState, tab })} />
          )}

          {showLookSurfacing ? (
            <>
              <CommunityDiscoveryBrowseNavigation
                taxonomy={taxonomyV2}
                state={queryState}
                relationshipProviderAvailable={false}
                onChange={applyState}
              />
              <CommunitySortControl
                sort={queryResult.effectiveSort.requested}
                onChange={handleSortChange}
                trendingFallback={trendingFallback}
              />
              <CommunityDiscoveryRuntimeFilters
                taxonomy={taxonomyV2}
                state={queryState}
                resultCount={queryResult.items.length}
                onChange={applyState}
                onRemoveMarker={removeMarker}
              />
              {queryResult.incompatible.length > 0 && (
                <div
                  data-testid="community-incompatible-filters"
                  className="rounded-card border border-amber-200 bg-amber-50 px-4 py-3"
                >
                  <p className="text-xs font-medium text-amber-800">
                    {t('app.linkContainsConditionsCannotBeAppliedWithoutWideningCurrentFiltersNeverAutoCleared')}
                  </p>
                  <ul className="mt-2 space-y-2">
                    {queryResult.incompatible.map((issue, index) => (
                      <li
                        key={`${issue.key}-${issue.code}-${index}`}
                        className="flex items-center justify-between gap-3"
                      >
                        <span className="min-w-0 text-xs text-amber-800">
                          <code className="rounded bg-amber-100 px-1 py-0.5 font-mono">{issue.key}</code>
                          <span className="mx-1.5 text-gray-500">=</span>
                          <span className="break-all">{issue.rawValue || '""'}</span>
                          <span className="ml-1.5 text-amber-600">· {issue.code}</span>
                        </span>
                        <button
                          type="button"
                          data-testid={`remove-incompatible-${issue.key}`}
                          aria-label={t('app.removeIncompatibleCondition')}
                          onClick={() => removeIncompatibleIssue(issue)}
                          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-gray-500 transition-colors hover:bg-amber-100 hover:text-gray-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                        >
                          <X className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {queryResult.items.length > 0 ? (
                <div
                  role={showTabs ? 'tabpanel' : undefined}
                  id={showTabs ? 'explore-tabpanel' : undefined}
                  aria-labelledby={showTabs ? 'explore-tab-looks' : undefined}
                  className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3"
                  data-testid="community-look-grid"
                >
                  {queryResult.items.map(({ look }) => (
                    <CommunityLookCard
                      key={look.lookId}
                      look={look}
                      publisher={pubMap.get(look.publisherId)}
                      taxonomyV2={taxonomyV2}
                      browse={queryState.browse}
                      assetCapability={assetCapabilities.get(look.lookId) ?? null}
                      onSave={(selected) => setSaveLook(selected)}
                    />
                  ))}
                </div>
              ) : (
                <div
                  className="rounded-card border border-dashed border-gray-200 bg-white px-4 py-10 text-center"
                  data-testid="community-feed-empty"
                >
                  {emptyFeedbackKind === 'invalid-link' ? (
                    <div
                      className="mx-auto max-w-md"
                      data-testid="community-feed-feedback-invalid-link"
                    >
                      <p className="text-sm font-medium text-gray-800">
                        {t('app.linkContainsConditionsCannotBeAppliedSoNothingShown')}
                      </p>
                      <p className="mt-1 text-xs text-gray-500">
                        {t('app.incompatibleConditionsListedAboveOnlyExplicitlyRemovingThemCanRevealResultsNeverAutoClearedWidened')}
                      </p>
                    </div>
                  ) : emptyFeedbackKind === 'rights-restricted' ? (
                    <div
                      className="mx-auto max-w-md"
                      data-testid="community-feed-feedback-rights-restricted"
                    >
                      <p className="text-sm font-medium text-gray-800">
                        {t('app.selectedRightsStatusNeverAppearsPublicContent')}
                      </p>
                      <p className="mt-1 text-xs text-gray-500">
                        {t('app.pendingCopyrightContentNeverEntersPublicHomeSearchRecommendationsClearFilterSeePublishedLooks')}
                      </p>
                      <Button className="mt-4 min-h-11" size="sm" variant="secondary" onClick={resetToDefault}>
                        {t('app.clearFilters')}
                      </Button>
                    </div>
                  ) : emptyFeedbackKind === 'access-denied' ? (
                    <div
                      className="mx-auto max-w-md"
                      data-testid="community-feed-feedback-access-denied"
                    >
                      <p className="text-sm font-medium text-gray-800">
                        {t('app.noPubliclyAccessibleContentAvailable')}
                      </p>
                      <p className="mt-1 text-xs text-gray-500">
                        {t('app.everyCandidateFailedPublicPublicationPermissionGateFilterScopeNeverWidenedAutomatically')}
                      </p>
                    </div>
                  ) : (
                    <div className="mx-auto max-w-md" data-testid="community-feed-feedback-empty">
                      <p className="text-sm font-medium text-gray-800">{t('app.noMatchingPublishedLooks')}</p>
                      <p className="mt-1 text-xs text-gray-500">
                        {t('app.draftsUnpublishedContentNeverAppearExplore')}
                      </p>
                      <Button className="mt-4 min-h-11" size="sm" variant="secondary" onClick={resetToDefault}>
                        {t('app.clearFilters')}
                      </Button>
                    </div>
                  )}
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
                  <p className="text-sm font-medium text-gray-800">{t('app.noMatchingCreators')}</p>
                  <Button
                    className="mt-4 min-h-11"
                    size="sm"
                    variant="secondary"
                    onClick={() => applyState({ ...queryState, q: '' })}
                  >
                    {t('app.clearSearch')}
                  </Button>
                </div>
              )}
            </div>
          )}

          <p className="pt-2 text-center text-nano text-gray-400">
            {t('app.feedDoesNotLoadThreeJsPreviewManufacturableMadeRequiresVerifiedRealResultFulfillmentRecordUnavailableDemoCreatorsVisibleIntegrationOnly')}
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
  const { t } = useLocale();
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
      aria-label={t('app.searchScope')}
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
            {value === 'looks' ? t('app.looks') : t('app.creators2')}
          </button>
        );
      })}
    </div>
  );
}
