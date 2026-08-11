/**
 * CommunityFilters · 结构化筛选面板（COMM-V7.1-02）。
 *
 * - Source / Style / Color 常驻快捷行（易达）；Shape / Length / Occasion /
 *   Effect / Mood / Application / Verification 收纳在可展开的筛选抽屉中。
 * - 全部维度 URL 真源（onChange → URL replace）；同维 OR、跨维 AND。
 * - 抽屉为无障碍 disclosure 面板（aria-expanded / aria-controls / 分组标题），
 *   内联展开以保证 390–1440 视口无横向溢出；touch 布局交互目标 >= 44px。
 * - 颜色筛选使用 primaryColorIds（filters.color）。
 */

import { useState } from 'react';
import { SlidersHorizontal, X } from 'lucide-react';
import { Button, cx } from '@/design-system';
import { useLocale, type Locale } from '@/lib/i18n';
import { communityTaxonomyLabel, taxonomyLabel, type NailTaxonomyNamespace } from '@/studio/shared/nail-taxonomy-labels';
import type { CommunityTaxonomyV1 } from '../domain/types';
import {
  advancedFilterCount,
  type CommunityFilterState,
  type SourceFilter,
} from '../domain/filters';

const SHAPE_OPTIONS = ['almond', 'oval', 'coffin', 'square', 'round', 'squoval', 'stiletto'];
const LENGTH_OPTIONS = ['short', 'medium', 'long', 'extra-long'];

interface Props {
  taxonomy: CommunityTaxonomyV1;
  filters: CommunityFilterState;
  onChange: (next: CommunityFilterState) => void;
  resultCount: number;
}

export function CommunityFilters({ taxonomy, filters, onChange, resultCount }: Props) {
  const { locale, text } = useLocale();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const advCount = advancedFilterCount(filters);

  const setSource = (source: SourceFilter) => onChange({ ...filters, source });
  const setSingle = (key: 'style' | 'color' | 'shape' | 'length', id: string | null) =>
    onChange({ ...filters, [key]: id });

  const toggleMulti = (key: 'occasion' | 'effect' | 'mood', id: string) => {
    const cur = filters[key];
    const next = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id];
    onChange({ ...filters, [key]: next });
  };

  const clearAdvanced = () =>
    onChange({
      ...filters,
      color: null,
      occasion: [],
      effect: [],
      mood: [],
      shape: null,
      length: null,
      application: null,
      verification: null,
    });

  const clearAll = () =>
    onChange({
      source: 'all',
      style: null,
      color: null,
      occasion: [],
      effect: [],
      mood: [],
      shape: null,
      length: null,
      application: null,
      verification: null,
    });

  const hasActiveFilters =
    filters.style !== null || filters.source !== 'all' || advCount > 0;

  return (
    <div className="space-y-3" data-testid="community-filters">
      {/* Source：常驻 */}
      <div className="flex flex-wrap gap-1.5">
        {(
          [
            ['all', text('全部', 'All')],
            ['official', text('官方', 'Official')],
            ['creators', text('认证创作者', 'Creators')],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            data-filter-source={id}
            aria-pressed={filters.source === id}
            onClick={() => setSource(id)}
            className={cx(
              'min-h-11 rounded-full border px-3 py-1 text-xs',
              'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
              filters.source === id
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-gray-200 bg-white text-gray-600',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Style：常驻 */}
      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          aria-pressed={!filters.style}
          onClick={() => setSingle('style', null)}
          className={cx(
            'min-h-11 rounded-full border px-3 py-1 text-xs',
            'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
            !filters.style ? 'border-primary bg-primary-soft text-primary' : 'border-gray-200 bg-white text-gray-600',
          )}
        >
          {text('全部风格', 'All styles')}
        </button>
        {taxonomy.mainStyles.map((s) => (
          <button
            key={s.id}
            type="button"
            data-filter-style={s.id}
            aria-pressed={filters.style === s.id}
            onClick={() => setSingle('style', s.id)}
            className={cx(
              'min-h-11 rounded-full border px-3 py-1 text-xs',
              'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
              filters.style === s.id
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-gray-200 bg-white text-gray-600',
            )}
          >
            {communityTaxonomyLabel('community-style', s, locale)}
          </button>
        ))}
      </div>

      {/* Color：常驻（primaryColorIds） */}
      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          aria-pressed={!filters.color}
          onClick={() => setSingle('color', null)}
          className={cx(
            'min-h-11 rounded-full border px-3 py-1 text-xs',
            'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
            !filters.color ? 'border-primary bg-primary-soft text-primary' : 'border-gray-200 bg-white text-gray-600',
          )}
        >
          {text('全部颜色', 'All colors')}
        </button>
        {taxonomy.colors.map((c) => (
          <button
            key={c.id}
            type="button"
            data-filter-color={c.id}
            aria-pressed={filters.color === c.id}
            onClick={() => setSingle('color', c.id)}
            className={cx(
              'min-h-11 rounded-full border px-3 py-1 text-xs',
              'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
              filters.color === c.id
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-gray-200 bg-white text-gray-600',
            )}
          >
            {communityTaxonomyLabel('community-color', c, locale)}
          </button>
        ))}
      </div>

      {/* 工具栏 */}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          className="min-h-11"
          variant="secondary"
          data-testid="community-filter-toggle"
          aria-expanded={drawerOpen}
          aria-controls="community-filter-drawer"
          onClick={() => setDrawerOpen((v) => !v)}
        >
          <SlidersHorizontal size={13} aria-hidden />
          {text('筛选', 'Filters')}
          {advCount > 0 ? ` · ${advCount}` : ''}
        </Button>
        <span className="text-[11px] text-gray-500">
          {resultCount} {text('个结果', 'results')}
        </span>
        {hasActiveFilters && (
          <button
            type="button"
            className="min-h-11 rounded-button px-2 text-[11px] text-primary hover:underline"
            onClick={clearAll}
          >
            {text('清除筛选', 'Clear filters')}
          </button>
        )}
      </div>

      {/* 筛选抽屉（disclosure panel，内联展开） */}
      {drawerOpen && (
        <div
          id="community-filter-drawer"
          data-testid="community-filter-drawer"
          className="space-y-3 rounded-card border border-gray-200 bg-white p-3"
        >
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-medium text-gray-800">
              {text('结构化筛选', 'Structured filters')}
            </h3>
            <button
              type="button"
              aria-label={text('关闭筛选', 'Close filters')}
              onClick={() => setDrawerOpen(false)}
              className="min-h-11 min-w-11 rounded-button p-2 text-gray-500 hover:bg-gray-100"
            >
              <X size={15} aria-hidden />
            </button>
          </div>

          <FilterChips
            title={text('甲型', 'Shape')}
            values={filters.shape ? [filters.shape] : []}
            options={SHAPE_OPTIONS}
            namespace="shape"
            locale={locale}
            onSelect={(id) => setSingle('shape', id === filters.shape ? null : id)}
            testIdPrefix="community-filter-shape"
          />
          <FilterChips
            title={text('长度', 'Length')}
            values={filters.length ? [filters.length] : []}
            options={LENGTH_OPTIONS}
            namespace="geometry-length"
            locale={locale}
            onSelect={(id) => setSingle('length', id === filters.length ? null : id)}
            testIdPrefix="community-filter-length"
          />
          <FilterGroup
            title={text('场景', 'Occasion')}
            items={taxonomy.occasions}
            namespace="community-occasion"
            locale={locale}
            selected={filters.occasion}
            onToggle={(id) => toggleMulti('occasion', id)}
          />
          <FilterGroup
            title={text('效果', 'Effect')}
            items={taxonomy.effects}
            namespace="community-effect"
            locale={locale}
            selected={filters.effect}
            onToggle={(id) => toggleMulti('effect', id)}
          />
          <FilterGroup
            title={text('情绪', 'Mood')}
            items={taxonomy.moods}
            namespace="community-mood"
            locale={locale}
            selected={filters.mood}
            onToggle={(id) => toggleMulti('mood', id)}
          />
          <div className="flex flex-wrap gap-2">
            <label className="text-[11px] text-gray-500">
              {text('应用能力', 'Application')}
              <select
                className="ml-1 min-h-11 rounded border border-gray-200 px-1 text-xs"
                value={filters.application ?? ''}
                onChange={(e) => onChange({ ...filters, application: e.target.value || null })}
              >
                <option value="">{text('全部', 'All')}</option>
                <option value="INSPIRATION_ONLY">{text('灵感参考', 'Inspiration')}</option>
                <option value="APPROXIMATE">{text('近似应用', 'Approximate')}</option>
                <option value="STRUCTURED_EDITABLE">{text('可编辑', 'Editable')}</option>
                <option value="REPRODUCIBLE">{text('可复现', 'Reproducible')}</option>
              </select>
            </label>
            <label className="text-[11px] text-gray-500">
              {text('验证证据', 'Verification')}
              <select
                className="ml-1 min-h-11 rounded border border-gray-200 px-1 text-xs"
                value={filters.verification ?? ''}
                onChange={(e) => onChange({ ...filters, verification: e.target.value || null })}
              >
                <option value="">{text('全部', 'All')}</option>
                <option value="CONCEPT">{text('概念效果', 'Concept')}</option>
                <option value="RENDER_VERIFIED">{text('已验证预览', 'Render verified')}</option>
              </select>
            </label>
          </div>
          <div className="flex flex-wrap items-center gap-2 border-t border-gray-100 pt-2">
            <Button className="min-h-11" size="sm" variant="ghost" onClick={clearAdvanced}>
              {text('清除高级筛选', 'Clear advanced')}
            </Button>
            <Button className="min-h-11" size="sm" variant="ghost" onClick={clearAll}>
              {text('重置全部', 'Reset all')}
            </Button>
          </div>
        </div>
      )}

    </div>
  );
}

function FilterChips({
  title,
  values,
  options,
  namespace,
  locale,
  onSelect,
  testIdPrefix,
}: {
  title: string;
  values: string[];
  options: readonly string[];
  namespace: 'shape' | 'geometry-length';
  locale: Locale;
  onSelect: (id: string) => void;
  testIdPrefix: string;
}) {
  return (
    <div>
      <p className="mb-1 text-[11px] font-medium text-gray-700">{title}</p>
      <div className="flex flex-wrap gap-1">
        {options.map((id) => {
          const active = values.includes(id);
          return (
            <button
              key={id}
              type="button"
              data-testid={`${testIdPrefix}-${id}`}
              aria-pressed={active}
              onClick={() => onSelect(id)}
              className={cx(
                'min-h-11 rounded-full border px-2.5 py-1 text-[11px]',
                'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
                active
                  ? 'border-primary bg-primary-soft text-primary'
                  : 'border-gray-200 text-gray-600',
              )}
            >
              {taxonomyLabel(namespace, id, locale)}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function FilterGroup({
  title,
  items,
  namespace,
  selected,
  onToggle,
  locale,
}: {
  title: string;
  items: Array<{ id: string; label: string; labelEn?: string }>;
  namespace: Extract<NailTaxonomyNamespace, `community-${string}`>;
  selected: string[];
  onToggle: (id: string) => void;
  locale: Locale;
}) {
  return (
    <div>
      <p className="mb-1 text-[11px] font-medium text-gray-700">{title}</p>
      <div className="flex flex-wrap gap-1">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            aria-pressed={selected.includes(item.id)}
            onClick={() => onToggle(item.id)}
            className={cx(
              'min-h-11 rounded-full border px-2.5 py-1 text-[11px]',
              'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
              selected.includes(item.id)
                ? 'border-primary bg-primary-soft text-primary'
                : 'border-gray-200 text-gray-600',
            )}
          >
            {communityTaxonomyLabel(namespace, item, locale)}
          </button>
        ))}
      </div>
    </div>
  );
}
