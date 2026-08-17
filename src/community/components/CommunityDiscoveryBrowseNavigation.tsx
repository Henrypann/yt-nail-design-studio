/**
 * CommunityDiscoveryBrowseNavigation · COMM-v0.7.2-TAX-04 首页主/次浏览导航。
 *
 * - 主行（primary）：语义按钮，严格按契约 PRIMARY_BROWSE_IDS 顺序渲染
 *   recommended / shape / style / scene / theme；标签全部来自 taxonomy
 *   （bilingual via useLocale），aria-pressed 表达选中，>=44px 目标，
 *   keyboard / pointer / touch 可用，无下拉。
 * - 次行（secondary）：当前主浏览下的可见选项，横向滚动
 *   （overflow-x-auto，flex 子项 shrink-0 不收缩），顺序即 taxonomy 顺序：
 *   recommended 用 recommendationChannels，但过滤 requiresRelationshipProvider
 *   频道（关系提供方不可用 → Following/关注新作 不出现）；dimension 浏览用
 *   其映射维度的 ACTIVE tags（不截断词表）。
 * - 会话记忆：仅在组件挂载的页面会话内用 ref 记住每个主浏览最后一次有效的
 *   topic。URL 仍是唯一当前状态真源 —— 记忆只决定下一次显式 onChange 的
 *   URL 状态；绝不读写 localStorage/sessionStorage，绝不在挂载时自动导航。
 *   URL 状态变化（Back / 分享链接）时同步记忆。
 * - 所有变更通过 onChange（Feed 的 applyState）→ push 浏览器历史。
 *
 * 纯导出 helper（collectBrowseSecondaryOptions / defaultBrowseTopic）与 React
 * 无关，供 Node 测试工具以 fixture 校验可见次行集合与顺序。
 */
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { cx } from '@/design-system';
import { useLocale } from '@/lib/i18n';
import {
  DEFAULT_RECOMMENDATION_CHANNEL,
  PRIMARY_BROWSE_DIMENSION,
  PRIMARY_BROWSE_IDS,
  type PrimaryBrowseId,
} from '../domain/taxonomy-v2/contract';
import type { CommunityTaxonomyV2 } from '../domain/taxonomy-v2/types';
import type { DiscoveryQueryStateV2 } from '../domain/taxonomy-v2/discovery-query';

/**
 * 一个主浏览的可见次行选项 id（保序）：
 * - recommended：recommendationChannels 中关系提供方可用（或本就不需要
 *   关系提供方）的频道；requiresRelationshipProvider 频道被过滤。
 * - dimension：其映射维度的 ACTIVE tags（全部保留，不截断）。
 */
export function collectBrowseSecondaryOptions(
  taxonomy: CommunityTaxonomyV2,
  browse: PrimaryBrowseId,
  relationshipProviderAvailable: boolean,
): string[] {
  if (browse === 'recommended') {
    return taxonomy.browse.recommendationChannels
      .filter(
        (channel) => !channel.requiresRelationshipProvider || relationshipProviderAvailable,
      )
      .map((channel) => channel.id);
  }
  const dimension = PRIMARY_BROWSE_DIMENSION[browse];
  if (!dimension) return [];
  return taxonomy.dimensions[dimension].tags
    .filter((tag) => tag.lifecycle === 'ACTIVE')
    .map((tag) => tag.id);
}

/**
 * 主浏览的默认 topic：recommended 用其 defaultSubchannelId（契约兜底
 * DEFAULT_RECOMMENDATION_CHANNEL），dimension 用其映射维度的第一个
 * ACTIVE tag。返回值保证是 collectBrowseSecondaryOptions 可见集合中的 id。
 */
export function defaultBrowseTopic(
  taxonomy: CommunityTaxonomyV2,
  browse: PrimaryBrowseId,
  relationshipProviderAvailable: boolean,
): string {
  const visible = collectBrowseSecondaryOptions(taxonomy, browse, relationshipProviderAvailable);
  if (browse === 'recommended') {
    const entry = taxonomy.browse.primary.find((candidate) => candidate.id === 'recommended');
    const fallback = entry?.defaultSubchannelId ?? DEFAULT_RECOMMENDATION_CHANNEL;
    return visible.includes(fallback) ? fallback : (visible[0] ?? DEFAULT_RECOMMENDATION_CHANNEL);
  }
  return visible[0] ?? '';
}

interface CommunityDiscoveryBrowseNavigationProps {
  taxonomy: CommunityTaxonomyV2;
  state: DiscoveryQueryStateV2;
  /** Feed 与 parse/execute 保持一致：关系提供方当前不可用（false）。 */
  relationshipProviderAvailable: boolean;
  onChange: (next: DiscoveryQueryStateV2) => void;
}

export function CommunityDiscoveryBrowseNavigation({
  taxonomy,
  state,
  relationshipProviderAvailable,
  onChange,
}: CommunityDiscoveryBrowseNavigationProps) {
  const { text } = useLocale();

  /**
   * 会话记忆：primary browse id → 最后一次有效 topic（仅内存 ref，挂载期内
   * 有效）。URL 是唯一当前状态真源；记忆只在用户下一次显式点击时决定新的
   * URL 状态，绝不自动导航、绝不写存储。
   */
  const topicMemory = useRef<Partial<Record<string, string>>>({});

  const primaryById = useMemo(
    () => new Map(taxonomy.browse.primary.map((entry) => [entry.id, entry])),
    [taxonomy],
  );

  const visibleSecondary = useMemo(
    () => collectBrowseSecondaryOptions(taxonomy, state.browse, relationshipProviderAvailable),
    [taxonomy, state.browse, relationshipProviderAvailable],
  );

  /** 同步记忆：URL 状态变化（Back / 分享链接解析）时记录当前有效 topic。 */
  useEffect(() => {
    if (visibleSecondary.includes(state.topic)) {
      topicMemory.current[state.browse] = state.topic;
    }
  }, [visibleSecondary, state.browse, state.topic]);

  const secondaryLabel = useCallback(
    (id: string): { 'zh-CN': string; en: string } => {
      if (state.browse === 'recommended') {
        const channel = taxonomy.browse.recommendationChannels.find(
          (candidate) => candidate.id === id,
        );
        return channel ? channel.labels : { 'zh-CN': id, en: id };
      }
      const dimension = PRIMARY_BROWSE_DIMENSION[state.browse];
      const tag = dimension
        ? taxonomy.dimensions[dimension].tags.find((candidate) => candidate.id === id)
        : undefined;
      return tag ? tag.labels : { 'zh-CN': id, en: id };
    },
    [state.browse, taxonomy],
  );

  /** 点击主浏览：记忆中的有效 topic 优先，否则默认 topic；同主浏览不重复导航。 */
  const selectPrimary = useCallback(
    (browse: PrimaryBrowseId) => {
      if (browse === state.browse) return;
      const remembered = topicMemory.current[browse];
      const topic =
        remembered !== undefined && visibleSecondaryIncludes(remembered, taxonomy, browse, relationshipProviderAvailable)
          ? remembered
          : defaultBrowseTopic(taxonomy, browse, relationshipProviderAvailable);
      onChange({ ...state, browse, topic });
    },
    [onChange, relationshipProviderAvailable, state, taxonomy],
  );

  /** 点击次行 topic：显式选择当前主浏览下的一个选项。 */
  const selectSecondary = useCallback(
    (topic: string) => {
      onChange({ ...state, topic });
    },
    [onChange, state],
  );

  return (
    <div className="flex flex-col gap-3" data-testid="community-browse-navigation">
      <div
        role="group"
        aria-label={text('浏览', 'Browse')}
        className="flex flex-wrap items-center gap-2"
        data-testid="community-browse-primary"
      >
        {PRIMARY_BROWSE_IDS.map((id) => {
          const entry = primaryById.get(id);
          if (!entry) return null;
          const active = state.browse === id;
          return (
            <button
              key={id}
              type="button"
              aria-pressed={active}
              data-testid={`browse-primary-${id}`}
              onClick={() => selectPrimary(id)}
              className={cx(
                'min-h-11 rounded-full border px-4 text-sm font-medium transition-colors',
                'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
                active
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50',
              )}
            >
              {text(entry.labels['zh-CN'], entry.labels.en)}
            </button>
          );
        })}
      </div>

      {visibleSecondary.length > 0 && (
        <div
          role="group"
          aria-label={text('浏览细分', 'Browse topics')}
          className="overflow-x-auto pb-1"
          data-testid="community-browse-secondary"
        >
          <div className="flex w-max items-center gap-2">
            {visibleSecondary.map((id) => {
              const labels = secondaryLabel(id);
              const active = state.topic === id;
              return (
                <button
                  key={id}
                  type="button"
                  aria-pressed={active}
                  data-testid={`browse-topic-${id}`}
                  onClick={() => selectSecondary(id)}
                  className={cx(
                    'shrink-0 min-h-11 rounded-full border px-3 text-xs transition-colors',
                    'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
                    active
                      ? 'border-primary bg-primary-soft text-primary'
                      : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50',
                  )}
                >
                  {text(labels['zh-CN'], labels.en)}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/** 判断 remembered topic 对目标 browse 是否仍然有效（与可见集合一致）。 */
function visibleSecondaryIncludes(
  topic: string,
  taxonomy: CommunityTaxonomyV2,
  browse: PrimaryBrowseId,
  relationshipProviderAvailable: boolean,
): boolean {
  return collectBrowseSecondaryOptions(
    taxonomy,
    browse,
    relationshipProviderAvailable,
  ).includes(topic);
}
