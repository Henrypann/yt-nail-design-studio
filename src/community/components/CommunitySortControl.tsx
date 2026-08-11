/**
 * CommunitySortControl · Featured / Trending / New 排序（COMM-V7.1-02）。
 *
 * - 单选分组按钮（aria-pressed），点击即更新 URL sort。
 * - Trending 无/不足信号时展示显式回退说明（disclosure），绝不静默降级。
 */

import { useLocale } from '@/lib/i18n';
import { cx } from '@/design-system';
import {
  EXPLORE_SORTS,
  type ExploreSort,
  type TrendingFallbackReason,
} from '../domain/v7_1/explore-search';

const SORT_LABELS: Record<ExploreSort, [string, string]> = {
  featured: ['精选', 'Featured'],
  trending: ['趋势', 'Trending'],
  new: ['最新', 'New'],
};

interface Props {
  sort: ExploreSort;
  onChange: (sort: ExploreSort) => void;
  trendingFallback?: { reason: TrendingFallbackReason; minDistinctSamples: number } | null;
}

export function CommunitySortControl({ sort, onChange, trendingFallback }: Props) {
  const { text } = useLocale();
  return (
    <div className="flex flex-col gap-1.5" data-testid="community-sort-control">
      <div
        role="group"
        aria-label={text('排序', 'Sort')}
        className="flex flex-wrap items-center gap-1.5"
      >
        {EXPLORE_SORTS.map((value) => {
          const [zh, en] = SORT_LABELS[value];
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
              {text(zh, en)}
            </button>
          );
        })}
      </div>
      {trendingFallback && (
        <p
          data-testid="trending-fallback-disclosure"
          className="max-w-2xl text-[11px] leading-relaxed text-amber-700"
        >
          {trendingFallback.reason === 'trending_no_signals'
            ? text(
                '当前没有 Trending 信号数据（静态 fixture 不含真实互动分析），已回退到精选排序。',
                'No trending signal data is available (static fixtures carry no real analytics); fell back to Featured.',
              )
            : text(
                `Trending 信号不足（窗口内至少需要 ${trendingFallback.minDistinctSamples} 个独立样本），已回退到精选排序。`,
                `Insufficient trending signals (at least ${trendingFallback.minDistinctSamples} distinct samples in-window are required); fell back to Featured.`,
              )}
        </p>
      )}
    </div>
  );
}
