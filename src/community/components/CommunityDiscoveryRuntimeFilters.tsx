/**
 * CommunityDiscoveryRuntimeFilters · COMM-v0.7.2-TAX-03/TAX-04 运行时筛选。
 *
 * TAX-03：
 * - Source chips 常驻；辅助维度（长度/可制作性/版权/技法）收纳在抽屉中。
 * - 旧 legacy 条件只产生兼容标记（可逐条移除）；不兼容条件可见且逐 key
 *   显式移除，绝不自动清除、绝不静默映射。
 *
 * TAX-04：
 * - 可见的已选条件 chips：canonical 辅助选择（V2 labels）与兼容标记分开
 *   但视觉一致；每个 chip 只移除该 id（collision-free testid，>=44px）。
 * - 兼容标记已代表的 canonical 辅助 id（length/technique）只以兼容标记 chip
 *   呈现：不重复出已选条件 chip，也不重复计入条件数；非默认 source 计为
 *   一个活动条件。
 * - 一键 clear-all：重置 browse/topic 为 recommended/for-you、清空 q、
 *   sort 回 featured、清空全部辅助 id、incompatible 与 markers；保留当前
 *   tab 与 source（lockedSource 仍由 Feed 执行）。state.incompatible
 *   非空或可清除条件数为零时绝不提供 clear-all（不静默清除不兼容原始
 *   URL key；仅 source 非默认时 clear-all 是 no-op，不渲染该按钮）。
 * - 展示结果数与活动条件摘要；空结果绝不自动放宽条件。
 */

import { useState } from 'react';
import { X, SlidersHorizontal } from 'lucide-react';
import { cx } from '@/design-system';
import { useLocale } from '@/lib/i18n';
import { DEFAULT_RECOMMENDATION_CHANNEL } from '../domain/taxonomy-v2/contract';
import type { CommunityTaxonomyV2 } from '../domain/taxonomy-v2/types';
import type { TaxonomyDimensionV2 } from '../domain/taxonomy-v2/contract';
import type {
  DiscoveryCompatibilityMarkerV2,
  DiscoveryQueryStateV2,
} from '../domain/taxonomy-v2/discovery-query';

interface CommunityDiscoveryRuntimeFiltersProps {
  taxonomy: CommunityTaxonomyV2;
  state: DiscoveryQueryStateV2;
  resultCount: number;
  onChange: (next: DiscoveryQueryStateV2) => void;
  onRemoveMarker: (marker: DiscoveryCompatibilityMarkerV2) => void;
}

const SOURCE_CHIPS = [
  { id: 'all', zh: '全部', en: 'All' },
  { id: 'official', zh: '官方', en: 'Official' },
  { id: 'creators', zh: '创作者', en: 'Creators' },
] as const;

type AuxKey = 'lengthIds' | 'makeabilityIds' | 'rightsIds' | 'techniqueIds';

interface AuxGroupConfig {
  dimension: TaxonomyDimensionV2;
  field: AuxKey;
  zh: string;
  en: string;
}

const AUX_GROUPS: AuxGroupConfig[] = [
  { dimension: 'LENGTH', field: 'lengthIds', zh: '长度', en: 'Length' },
  {
    dimension: 'MAKEABILITY',
    field: 'makeabilityIds',
    zh: '可制作性',
    en: 'Makeability',
  },
  { dimension: 'RIGHTS', field: 'rightsIds', zh: '版权', en: 'Rights' },
  { dimension: 'TECHNIQUE', field: 'techniqueIds', zh: '技法', en: 'Technique' },
];

export function CommunityDiscoveryRuntimeFilters({
  taxonomy,
  state,
  resultCount,
  onChange,
  onRemoveMarker,
}: CommunityDiscoveryRuntimeFiltersProps) {
  const { text } = useLocale();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const canonicalTags = Object.values(taxonomy.dimensions).flatMap(
    (dimension) => dimension.tags,
  );

  const markerLabel = (marker: DiscoveryCompatibilityMarkerV2): string => {
    if (marker.canonicalValue === 'technique:french') {
      return text('技法：法式', 'Technique: French');
    }
    const tag = canonicalTags.find(
      (candidate) => candidate.id === marker.canonicalValue,
    );
    return tag ? text(tag.labels['zh-CN'], tag.labels.en) : marker.canonicalValue;
  };

  const toggleAuxId = (group: AuxGroupConfig, id: string): void => {
    const current = state[group.field];
    const next = current.includes(id)
      ? current.filter((candidate) => candidate !== id)
      : [...current, id];
    onChange({ ...state, [group.field]: next });
  };

  /** TAX-04: 已选条件 chip 的移除按钮只移除该 id（绝不 toggle 添加）。 */
  const removeAuxId = (group: AuxGroupConfig, id: string): void => {
    onChange({
      ...state,
      [group.field]: state[group.field].filter((candidate) => candidate !== id),
    });
  };

  /**
   * TAX-04: 一键 clear-all。重置 browse/topic 为 recommended/for-you、清空 q、
   * sort 回 featured、清空全部辅助 id、incompatible 与 markers；保留 tab 与
   * source（lockedSource 由 Feed 的 applyState 强制）。incompatible 非空或
   * 可清除条件数为零（仅 source 非默认）时该控件不渲染（绝不静默清除不兼容
   * 原始 URL key，也不提供 no-op 按钮）。
   */
  const clearAll = (): void => {
    onChange({
      ...state,
      q: '',
      sort: 'featured',
      browse: 'recommended',
      topic: DEFAULT_RECOMMENDATION_CHANNEL,
      lengthIds: [],
      makeabilityIds: [],
      rightsIds: [],
      techniqueIds: [],
      incompatible: [],
      markers: [],
    });
  };

  /**
   * TAX-04: 兼容标记已代表的 canonical 辅助 id（length/technique）。这些 id
   * 只以兼容标记 chip 呈现：不重复出现在已选条件 chips 中，也不重复计入
   * 条件数。topic 类标记（compat-style-alias/compat-shape）不在此列。
   */
  const markerRepresentedAuxIds = new Set(
    state.markers
      .filter(
        (marker) =>
          marker.canonicalKey === 'length' || marker.canonicalKey === 'technique',
      )
      .map((marker) => marker.canonicalValue),
  );

  /** TAX-04: 已选 canonical 辅助条件 chips（V2 labels，保 AUX_GROUPS 顺序）。 */
  const selectedAuxChips = AUX_GROUPS.flatMap((group) =>
    state[group.field]
      .filter((id) => !markerRepresentedAuxIds.has(id))
      .map((id) => {
        const tag = canonicalTags.find((candidate) => candidate.id === id);
        return {
          id,
          group,
          zh: tag?.labels['zh-CN'] ?? id,
          en: tag?.labels.en ?? id,
        };
      }),
  );

  const activeAuxCount = AUX_GROUPS.reduce(
    (count, group) => count + (state[group.field].length > 0 ? 1 : 0),
    0,
  );

  /**
   * TAX-04: 活动条件摘要（source / 浏览 topic / q / sort / 辅助 id 数 / 标记数）。
   * source 计入摘要（可见反馈），但 clear-all 保留 source，故不计入可清除数。
   */
  const activeConditionCount =
    (state.source !== 'all' ? 1 : 0) +
    (state.browse !== 'recommended' || state.topic !== DEFAULT_RECOMMENDATION_CHANNEL ? 1 : 0) +
    (state.q !== '' ? 1 : 0) +
    (state.sort !== 'featured' ? 1 : 0) +
    state.lengthIds.filter((id) => !markerRepresentedAuxIds.has(id)).length +
    state.makeabilityIds.length +
    state.rightsIds.length +
    state.techniqueIds.filter((id) => !markerRepresentedAuxIds.has(id)).length +
    state.markers.length;

  /**
   * TAX-04: 可被 clear-all 清除的条件数（浏览 topic / q / sort / 非兼容标记
   * 代表的辅助 id / 标记数）。source 被 clear-all 保留（lockedSource 由 Feed
   * 执行），因此仅 source 非默认时 clear-all 是 no-op，不启用该按钮。
   */
  const clearableConditionCount =
    (state.browse !== 'recommended' || state.topic !== DEFAULT_RECOMMENDATION_CHANNEL ? 1 : 0) +
    (state.q !== '' ? 1 : 0) +
    (state.sort !== 'featured' ? 1 : 0) +
    state.lengthIds.filter((id) => !markerRepresentedAuxIds.has(id)).length +
    state.makeabilityIds.length +
    state.rightsIds.length +
    state.techniqueIds.filter((id) => !markerRepresentedAuxIds.has(id)).length +
    state.markers.length;

  const markers = state.markers;
  const canClearAll = state.incompatible.length === 0 && clearableConditionCount > 0;

  return (
    <div className="space-y-3" data-testid="community-discovery-runtime-filters">
      <div className="flex flex-wrap gap-2">
        {SOURCE_CHIPS.map((chip) => {
          const active = state.source === chip.id;
          return (
            <button
              key={chip.id}
              type="button"
              aria-pressed={active}
              onClick={() => onChange({ ...state, source: chip.id })}
              className={cx(
                'min-h-11 rounded-full border px-3 text-xs transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
                active
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-gray-200 bg-white text-gray-600',
              )}
            >
              {text(chip.zh, chip.en)}
            </button>
          );
        })}
      </div>

      {selectedAuxChips.length > 0 && (
        <div
          className="flex flex-wrap gap-2"
          data-testid="community-selected-conditions"
        >
          {selectedAuxChips.map((chip) => (
            <span
              key={chip.id}
              data-testid={`selected-condition-${chip.id}`}
              className="inline-flex items-center gap-1 rounded-full border border-primary-soft bg-primary-soft/40 py-1 pl-3 pr-1"
            >
              <span className="text-xs font-medium text-primary">
                {text(chip.zh, chip.en)}
              </span>
              <button
                type="button"
                aria-label={text('移除条件', 'Remove condition')}
                data-testid={`remove-condition-${chip.id}`}
                onClick={() => removeAuxId(chip.group, chip.id)}
                className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100 hover:text-gray-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </span>
          ))}
        </div>
      )}

      {markers.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {markers.map((marker) => (
            <span
              key={`${marker.code}\u0000${marker.rawValue}\u0000${marker.canonicalValue}`}
              data-testid={`compatibility-marker-${marker.code}`}
              className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-white py-1 pl-3 pr-1"
            >
              <span className="text-xs">{markerLabel(marker)}</span>
              <button
                type="button"
                aria-label={text('移除条件', 'Remove condition')}
                onClick={() => onRemoveMarker(marker)}
                className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            data-testid="community-runtime-filter-toggle"
            aria-expanded={drawerOpen}
            aria-controls="community-runtime-filter-panel"
            onClick={() => setDrawerOpen((open) => !open)}
            className={cx(
              'inline-flex min-h-11 items-center gap-2 rounded-full border px-3 text-xs transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
              drawerOpen
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-gray-200 bg-white text-gray-600',
            )}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
            {text('筛选', 'Filters')}
            {activeAuxCount > 0 && (
              <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary-soft px-1 text-[10px] font-medium text-primary">
                {activeAuxCount}
              </span>
            )}
          </button>
          {canClearAll && (
            <button
              type="button"
              data-testid="community-runtime-clear-all"
              onClick={clearAll}
              className="inline-flex min-h-11 items-center rounded-full border border-gray-200 bg-white px-3 text-xs text-gray-600 transition-colors hover:border-gray-300 hover:bg-gray-50 hover:text-gray-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              {text('清除全部条件', 'Clear all conditions')}
            </button>
          )}
        </div>
        <p className="flex items-center gap-1.5 text-xs text-gray-500">
          <span data-testid="community-runtime-condition-summary">
            {text(
              `${activeConditionCount} 个筛选条件`,
              `${activeConditionCount} active condition${activeConditionCount === 1 ? '' : 's'}`,
            )}
          </span>
          <span aria-hidden="true">·</span>
          <span>
            <span data-testid="community-runtime-result-count">{resultCount}</span>
            {text(' 个结果', ' results')}
          </span>
        </p>
      </div>

      {drawerOpen && (
        <div
          id="community-runtime-filter-panel"
          className="rounded-card space-y-3 border border-gray-200 bg-white p-3"
        >
          {AUX_GROUPS.map((group) => (
            <div key={group.dimension} className="space-y-2">
              <h3 className="text-xs font-medium text-gray-700">
                {text(group.zh, group.en)}
              </h3>
              <div className="flex flex-wrap gap-2">
                {taxonomy.dimensions[group.dimension].tags.map((tag) => {
                  const active = state[group.field].includes(tag.id);
                  return (
                    <button
                      key={tag.id}
                      type="button"
                      data-testid={`runtime-filter-${tag.id}`}
                      aria-pressed={active}
                      onClick={() => toggleAuxId(group, tag.id)}
                      className={cx(
                        'min-h-11 rounded-full border px-3 text-xs transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
                        active
                          ? 'border-primary bg-primary-soft text-primary'
                          : 'border-gray-200 bg-white text-gray-600',
                      )}
                    >
                      {text(tag.labels['zh-CN'], tag.labels.en)}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
          <div className="pt-1">
            <button
              type="button"
              data-testid="community-runtime-filter-clear"
              onClick={() =>
                onChange({
                  ...state,
                  lengthIds: [],
                  makeabilityIds: [],
                  rightsIds: [],
                  techniqueIds: [],
                })
              }
              className="inline-flex min-h-11 items-center justify-center rounded-full px-3 text-xs text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              {text('清除筛选', 'Clear filters')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
