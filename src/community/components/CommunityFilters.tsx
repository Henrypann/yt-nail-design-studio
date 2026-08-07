import { useMemo, useState } from 'react';
import { Button, cx } from '@/design-system';
import { useLocale, type Locale } from '@/lib/i18n';
import { communityTaxonomyLabel, taxonomyLabel, type NailTaxonomyNamespace } from '@/studio/shared/nail-taxonomy-labels';
import type { CommunityTaxonomyV1 } from '../domain/types';
import {
  advancedFilterCount,
  type CommunityFilterState,
  type SourceFilter,
} from '../domain/filters';

interface Props {
  taxonomy: CommunityTaxonomyV1;
  filters: CommunityFilterState;
  onChange: (next: CommunityFilterState) => void;
  resultCount: number;
}

export function CommunityFilters({ taxonomy, filters, onChange, resultCount }: Props) {
  const { locale, text } = useLocale();
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const advCount = advancedFilterCount(filters);

  const setSource = (source: SourceFilter) => onChange({ ...filters, source });
  const setStyle = (style: string | null) => onChange({ ...filters, style });

  const toggleMulti = (key: 'occasion' | 'effect' | 'mood', id: string) => {
    const cur = filters[key];
    const next = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id];
    onChange({ ...filters, [key]: next });
  };

  const clearAdvanced = () =>
    onChange({
      ...filters,
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
      occasion: [],
      effect: [],
      mood: [],
      shape: null,
      length: null,
      application: null,
      verification: null,
    });

  const suggestions = useMemo(() => {
    if (resultCount > 0) return [] as string[];
    const tips: string[] = [];
    if (filters.style) tips.push(text('清除主风格', 'Clear style'));
    if (filters.occasion.length) tips.push(text('清除场景', 'Clear occasion'));
    if (filters.effect.length) tips.push(text('清除效果', 'Clear effect'));
    if (filters.shape) tips.push(text('清除甲型', 'Clear shape'));
    if (tips.length === 0) tips.push(text('重置全部筛选', 'Reset all filters'));
    return tips.slice(0, 3);
  }, [filters, resultCount, text]);

  return (
    <div className="space-y-3" data-testid="community-filters">
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
            onClick={() => setSource(id)}
            className={cx(
              'rounded-full border px-2.5 py-1 text-xs',
              filters.source === id
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-gray-200 bg-white text-gray-600',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => setStyle(null)}
          className={cx(
            'rounded-full border px-2.5 py-1 text-xs',
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
            onClick={() => setStyle(s.id)}
            className={cx(
              'rounded-full border px-2.5 py-1 text-xs',
              filters.style === s.id
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-gray-200 bg-white text-gray-600',
            )}
          >
            {communityTaxonomyLabel('community-style', s, locale)}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <Button size="sm" variant="secondary" onClick={() => setAdvancedOpen((v) => !v)}>
          {text('高级筛选', 'Advanced')}
          {advCount > 0 ? ` · ${advCount}` : ''}
        </Button>
        <span className="text-[11px] text-gray-500">
          {resultCount} {text('个结果', 'results')}
        </span>
        {(filters.style || filters.source !== 'all' || advCount > 0) && (
          <button type="button" className="text-[11px] text-primary hover:underline" onClick={clearAll}>
            {text('清除筛选', 'Clear filters')}
          </button>
        )}
      </div>

      {advancedOpen && (
        <div className="space-y-3 rounded-card border border-gray-200 bg-white p-3">
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
              {text('甲型', 'Shape')}
              <select
                className="ml-1 rounded border border-gray-200 px-1 py-0.5 text-xs"
                value={filters.shape ?? ''}
                onChange={(e) => onChange({ ...filters, shape: e.target.value || null })}
              >
                <option value="">{text('全部', 'All')}</option>
                {['almond', 'oval', 'coffin', 'square', 'round', 'squoval', 'stiletto'].map((s) => (
                  <option key={s} value={s}>
                    {taxonomyLabel('shape', s, locale)}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-[11px] text-gray-500">
              {text('应用能力', 'Application')}
              <select
                className="ml-1 rounded border border-gray-200 px-1 py-0.5 text-xs"
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
                className="ml-1 rounded border border-gray-200 px-1 py-0.5 text-xs"
                value={filters.verification ?? ''}
                onChange={(e) => onChange({ ...filters, verification: e.target.value || null })}
              >
                <option value="">{text('全部', 'All')}</option>
                <option value="CONCEPT">{text('概念效果', 'Concept')}</option>
                <option value="RENDER_VERIFIED">{text('已验证预览', 'Render verified')}</option>
              </select>
            </label>
          </div>
          <Button size="sm" variant="ghost" onClick={clearAdvanced}>
            {text('清除高级筛选', 'Clear advanced')}
          </Button>
        </div>
      )}

      {resultCount === 0 && (
        <div className="rounded-card border border-dashed border-gray-300 bg-white px-3 py-4 text-center" data-testid="community-no-results">
          <p className="text-sm text-gray-600">{text('没有符合条件的内容', 'No matching content')}</p>
          <div className="mt-2 flex flex-wrap justify-center gap-2">
            {suggestions.map((tip) => (
              <Button key={tip} size="sm" variant="secondary" onClick={clearAll}>
                {tip}
              </Button>
            ))}
          </div>
        </div>
      )}
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
            onClick={() => onToggle(item.id)}
            className={cx(
              'rounded-full border px-2 py-0.5 text-[10px]',
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
