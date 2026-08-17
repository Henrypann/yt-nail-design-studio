import { X } from 'lucide-react';
import { cx } from '@/design-system';
import { useLocale } from '@/i18n';
import type {
  CommunityTaxonomyV2,
  DiscoveryCompatibilityMarkerV2,
  DiscoveryQueryStateV2,
} from '@/community/community.types';

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

export function CommunityDiscoveryRuntimeFilters({
  taxonomy,
  state,
  resultCount,
  onChange,
  onRemoveMarker,
}: CommunityDiscoveryRuntimeFiltersProps) {
  const { text } = useLocale();

  const canonicalTags = Object.values(taxonomy.dimensions).flatMap(
    (dimension) => dimension.tags,
  );

  const markerLabel = (marker: DiscoveryCompatibilityMarkerV2): string => {
    if (marker.canonicalValue === 'technique:french') {
      return text('技法：法式', 'Technique: French');
    }
    const tag = canonicalTags.find(
      (candidate) => candidate.canonicalValue === marker.canonicalValue,
    );
    return tag ? text(tag.labels['zh-CN'], tag.labels.en) : marker.canonicalValue;
  };

  const markers = state.compatibilityMarkers ?? [];

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
                'min-h-11 rounded-full border px-3 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                active
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border bg-background text-muted-foreground hover:bg-accent hover:text-accent-foreground',
              )}
            >
              {text(chip.zh, chip.en)}
            </button>
          );
        })}
      </div>

      <span data-testid="community-runtime-result-count">{resultCount}</span>

      {markers.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {markers.map((marker) => (
            <span
              key={marker.code}
              data-testid={`compatibility-marker-${marker.code}`}
              className="inline-flex items-center gap-1 rounded-full border border-border bg-background py-1 pl-3 pr-1"
            >
              <span className="text-xs">{markerLabel(marker)}</span>
              <button
                type="button"
                aria-label={text('移除条件', 'Remove condition')}
                onClick={() => onRemoveMarker(marker)}
                className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full text-muted-foreground hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
