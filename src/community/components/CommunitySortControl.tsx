/**
 * CommunitySortControl · Featured / Trending / New 排序（COMM-V7.1-02）。
 *
 * - 单选分组按钮（aria-pressed），点击即更新 URL sort。
 * - Trending 无/不足信号时展示显式回退说明（disclosure），绝不静默降级。
 */

import {useLocale, type MessageKey} from '@/lib/i18n';
import { cx } from '@/design-system';
import {
  EXPLORE_SORTS,
  type ExploreSort,
  type TrendingFallbackReason,
} from '../domain/v7_1/explore-search';

const SORT_LABELS: Record<ExploreSort, MessageKey> = {
  featured: 'community.sort.featured',
  trending: 'community.sort.trending',
  new: 'community.sort.new',
};

interface Props {
  sort: ExploreSort;
  onChange: (sort: ExploreSort) => void;
  trendingFallback?: { reason: TrendingFallbackReason; minDistinctSamples: number } | null;
}

export function CommunitySortControl({ sort, onChange, trendingFallback }: Props) {
  const { t } = useLocale();
  return (
    <div className="flex flex-col gap-1.5" data-testid="community-sort-control">
      <div
        role="group"
        aria-label={t('app.sort')}
        className="flex flex-wrap items-center gap-1.5"
      >
        {EXPLORE_SORTS.map((value) => {
          const active = sort === value;
          return (
            <button
              key={value}
              type="button"
              aria-pressed={active}
              data-testid={`sort-${value}`}
              onClick={() => onChange(value)}
              className={cx(
                'inline-flex h-11 items-center rounded-full border px-3 text-xs font-medium',
                'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
                active
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50',
              )}
            >
              {t(SORT_LABELS[value])}
            </button>
          );
        })}
      </div>
      {trendingFallback && (
        <p
          data-testid="trending-fallback-disclosure"
          className="max-w-2xl text-nano leading-relaxed text-amber-700"
        >
          {trendingFallback.reason === 'trending_no_signals'
            ? t('app.noTrendingSignalDataAvailableStaticFixturesCarryNoRealAnalyticsFellBackFeatured')
            : t('app.insufficientTrendingSignalsAtLeastTrendingfallbackMindistinctsamplesDistinctSamplesWindowRequiredFellBackFeatured', { trendingFallback_minDistinctSamples: trendingFallback.minDistinctSamples })}
        </p>
      )}
    </div>
  );
}
