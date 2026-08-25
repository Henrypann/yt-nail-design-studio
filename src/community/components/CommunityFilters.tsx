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
  const { locale, t } = useLocale();
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
            ['all', t('app.all')],
            ['official', t('app.official')],
            ['creators', t('app.creators')],
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
          {t('app.allStyles')}
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
          {t('app.allColors')}
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
          {t('app.filters')}
          {advCount > 0 ? ` · ${advCount}` : ''}
        </Button>
        <span className="text-nano text-gray-500">
          {resultCount} {t('app.results2')}
        </span>
        {hasActiveFilters && (
          <button
            type="button"
            className="min-h-11 rounded-button px-2 text-nano text-primary hover:underline"
            onClick={clearAll}
          >
            {t('app.clearFilters')}
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
              {t('app.structuredFilters')}
            </h3>
            <button
              type="button"
              aria-label={t('app.closeFilters')}
              onClick={() => setDrawerOpen(false)}
              className="min-h-11 min-w-11 rounded-button p-2 text-gray-500 hover:bg-gray-100"
            >
              <X size={15} aria-hidden />
            </button>
          </div>

          <FilterChips
            title={t('app.shape')}
            values={filters.shape ? [filters.shape] : []}
            options={SHAPE_OPTIONS}
            namespace="shape"
            locale={locale}
            onSelect={(id) => setSingle('shape', id === filters.shape ? null : id)}
            testIdPrefix="community-filter-shape"
          />
          <FilterChips
            title={t('app.length')}
            values={filters.length ? [filters.length] : []}
            options={LENGTH_OPTIONS}
            namespace="geometry-length"
            locale={locale}
            onSelect={(id) => setSingle('length', id === filters.length ? null : id)}
            testIdPrefix="community-filter-length"
          />
          <FilterGroup
            title={t('app.occasion')}
            items={taxonomy.occasions}
            namespace="community-occasion"
            locale={locale}
            selected={filters.occasion}
            onToggle={(id) => toggleMulti('occasion', id)}
          />
          <FilterGroup
            title={t('app.effect')}
            items={taxonomy.effects}
            namespace="community-effect"
            locale={locale}
            selected={filters.effect}
            onToggle={(id) => toggleMulti('effect', id)}
          />
          <FilterGroup
            title={t('app.mood')}
            items={taxonomy.moods}
            namespace="community-mood"
            locale={locale}
            selected={filters.mood}
            onToggle={(id) => toggleMulti('mood', id)}
          />
          <div className="flex flex-wrap gap-2">
            <label className="text-nano text-gray-500">
              {t('app.application')}
              <select
                className="ml-1 min-h-11 rounded border border-gray-200 px-1 text-xs"
                value={filters.application ?? ''}
                onChange={(e) => onChange({ ...filters, application: e.target.value || null })}
              >
                <option value="">{t('app.all')}</option>
                <option value="INSPIRATION_ONLY">{t('app.inspiration')}</option>
                <option value="APPROXIMATE">{t('app.approximate')}</option>
                <option value="STRUCTURED_EDITABLE">{t('app.editable')}</option>
                <option value="REPRODUCIBLE">{t('app.reproducible')}</option>
              </select>
            </label>
            <label className="text-nano text-gray-500">
              {t('app.verification')}
              <select
                className="ml-1 min-h-11 rounded border border-gray-200 px-1 text-xs"
                value={filters.verification ?? ''}
                onChange={(e) => onChange({ ...filters, verification: e.target.value || null })}
              >
                <option value="">{t('app.all')}</option>
                <option value="CONCEPT">{t('app.concept')}</option>
                <option value="RENDER_VERIFIED">{t('app.renderVerified')}</option>
              </select>
            </label>
          </div>
          <div className="flex flex-wrap items-center gap-2 border-t border-gray-100 pt-2">
            <Button className="min-h-11" size="sm" variant="ghost" onClick={clearAdvanced}>
              {t('app.clearAdvanced')}
            </Button>
            <Button className="min-h-11" size="sm" variant="ghost" onClick={clearAll}>
              {t('app.resetAll')}
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
      <p className="mb-1 text-nano font-medium text-gray-700">{title}</p>
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
                'min-h-11 rounded-full border px-2.5 py-1 text-nano',
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
      <p className="mb-1 text-nano font-medium text-gray-700">{title}</p>
      <div className="flex flex-wrap gap-1">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            aria-pressed={selected.includes(item.id)}
            onClick={() => onToggle(item.id)}
            className={cx(
              'min-h-11 rounded-full border px-2.5 py-1 text-nano',
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
