import { useState } from 'react';
import { X, SlidersHorizontal } from 'lucide-react';
import { cx } from '@/design-system';
import { useLocale } from '@/lib/i18n';
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

  const activeAuxCount = AUX_GROUPS.reduce(
    (count, group) => count + (state[group.field].length > 0 ? 1 : 0),
    0,
  );

  const markers = state.markers;

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

      <div className="flex items-center justify-between gap-2">
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
        <span data-testid="community-runtime-result-count">{resultCount}</span>
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
