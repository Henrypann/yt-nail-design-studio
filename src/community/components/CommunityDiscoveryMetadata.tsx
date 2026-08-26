/**
 * CommunityDiscoveryMetadata · COMM-v0.7.2-TAX-04 shared discovery UI.
 *
 * Three presentational pieces shared by CommunityLookCard and
 * CommunityLookPage. All labels come from strict taxonomy-v2 by exact
 * namespaced id (never legacy taxonomy, never PublishedLookV1.tags or
 * mainStyle/effect/mood inference):
 *
 * - DiscoveryCardTags: card tag pills (max CARD_TAG_PILL_MAX, current browse
 *   dimension first). RIGHTS / MAKEABILITY / LENGTH never appear as pills.
 * - RightsBadge: independent of the tag pills; label from the RIGHTS tag id
 *   derived via RIGHTS_STATUS_TAGS; carries a distinct data-rights-status and
 *   accessible text. It is a status badge, never an action.
 * - DiscoveryDetailSection: the full structured discovery section — every
 *   non-empty group in DISCOVERY_DETAIL_GROUP_ORDER with a bilingual group
 *   label and all tag ids, plus separate makeability and rights rows.
 *   Makeability shows the classification label only and never implies
 *   current-makeable unless the governance evidence gate passes.
 *
 * Fail-closed contract for consumers: when discovery is null or taxonomy-v2
 * is unavailable, the consumer renders a visible notice instead of inferring
 * legacy fields; this component never renders anything from legacy data.
 */

import { useLocale, type Locale } from '@/lib/i18n';
import { isCurrentMakeable } from '../domain/taxonomy-v2/governance';
import {
  CARD_TAG_PILL_MAX,
  cardTagIdsForDiscovery,
  discoveryDetailGroups,
  discoveryGroupLabel,
  makeabilityTagIdForDiscovery,
  resolveV2TagLabel,
  rightsTagIdForDiscovery,
  type DiscoveryBrowseV2,
} from '../domain/taxonomy-v2/presentation';
import type {
  CommunityDiscoveryMetadataV1,
  CommunityTaxonomyV2,
} from '../domain/taxonomy-v2/types';

interface CommunityDiscoveryMetadataProps {
  taxonomy: CommunityTaxonomyV2;
  discovery: CommunityDiscoveryMetadataV1;
  /** i18n locale; mapped to the taxonomy label locale inside the component. */
  locale: Locale;
}

/** Taxonomy label locale for the current i18n locale. */
function taxonomyLocale(locale: Locale): 'zh-CN' | 'en' {
  return locale === 'en-US' ? 'en' : 'zh-CN';
}

/**
 * Card tag pills: de-duplicated V2 ids from the pure helper, current browse
 * dimension first, maximum CARD_TAG_PILL_MAX, collision-free testids keyed by
 * the exact tag id. Returns null when the discovery record has no pill tags.
 */
export function DiscoveryCardTags({
  taxonomy,
  discovery,
  browse,
  locale,
}: CommunityDiscoveryMetadataProps & { browse: DiscoveryBrowseV2 }) {
  const labelLocale = taxonomyLocale(locale);
  // Defensive cap on top of the pure helper: pills never exceed the contract.
  const ids = cardTagIdsForDiscovery(discovery, browse).slice(
    0,
    CARD_TAG_PILL_MAX,
  );
  if (ids.length === 0) return null;
  return (
    <div
      className="flex flex-wrap gap-1"
      data-testid="community-discovery-card-tags"
    >
      {ids.map((id) => (
        <span
          key={id}
          data-testid={`community-discovery-tag-${id}`}
          data-tag-id={id}
          className="rounded-full bg-gray-100 px-2 py-0.5 text-nano text-gray-600"
        >
          {resolveV2TagLabel(taxonomy, id, labelLocale)}
        </span>
      ))}
    </div>
  );
}

/**
 * Rights status badge. Independent from the tag pills: it derives its id from
 * the rights status contract map, carries data-rights-status and accessible
 * text, and never implies any action by itself.
 */
export function RightsBadge({
  taxonomy,
  discovery,
  locale,
}: CommunityDiscoveryMetadataProps) {
  const rightsId = rightsTagIdForDiscovery(discovery);
  const labelLocale = taxonomyLocale(locale);
  if (!rightsId) return null;
  const status = discovery.rights.status;
  const restricted = status === 'PERSONAL_USE_ONLY';
  const label = resolveV2TagLabel(taxonomy, rightsId, labelLocale);
  const accessible =
    labelLocale === 'en'
      ? restricted
        ? `Rights: ${label} — commercial/remix actions are disallowed`
        : `Rights: ${label}`
      : restricted
        ? `权利：${label}，不提供商业/二次创作`
        : `权利：${label}`;
  return (
    <span
      data-testid="community-rights-badge"
      data-rights-status={status}
      className={
        restricted
          ? 'inline-flex items-center rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-nano font-medium text-amber-700'
          : 'inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-nano text-gray-600'
      }
    >
      {label}
      <span className="sr-only">{accessible}</span>
    </span>
  );
}

/**
 * Full structured discovery detail section: all non-empty groups in the
 * required order with bilingual group labels and every tag id; separate
 * makeability and rights rows. Makeability never implies current-makeable
 * unless the governance evidence gate (isCurrentMakeable) says so.
 */
export function DiscoveryDetailSection({
  taxonomy,
  discovery,
  locale,
}: CommunityDiscoveryMetadataProps) {
  const labelLocale = taxonomyLocale(locale);
  const { t } = useLocale();
  const groups = discoveryDetailGroups(discovery);
  const makeabilityId = makeabilityTagIdForDiscovery(discovery);
  const rightsId = rightsTagIdForDiscovery(discovery);
  const currentMakeable = isCurrentMakeable(discovery);
  const sectionLabel = t('community.discovery.structuredTags');

  return (
    <section
      data-testid="community-discovery-detail"
      aria-label={sectionLabel}
      className="rounded-panel border border-gray-200 bg-white/70 px-3 py-2"
    >
      <h2 className="text-xs font-semibold text-gray-800">{sectionLabel}</h2>

      {groups.map((group) => (
        <div
          key={group.dimension}
          data-testid={`community-discovery-group-${group.dimension}`}
          className="mt-2"
        >
          <p className="text-xs font-medium text-gray-700">
            {discoveryGroupLabel(taxonomy, group.dimension, labelLocale)}
          </p>
          <ul className="mt-1 flex flex-wrap gap-1">
            {group.ids.map((id) => (
              <li key={id}>
                <span
                  data-testid={`community-discovery-group-${group.dimension}-tag-${id}`}
                  data-tag-id={id}
                  className="rounded-full bg-gray-100 px-2 py-0.5 text-nano text-gray-600"
                >
                  {resolveV2TagLabel(taxonomy, id, labelLocale)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ))}

      <div className="mt-2 flex flex-wrap items-center gap-1">
        {makeabilityId && (
          <span
            data-testid="community-makeability-badge"
            data-makeability-classification={discovery.makeability.classification}
            className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-nano text-gray-600"
          >
            {t('community.discovery.makeability')}：
            {resolveV2TagLabel(taxonomy, makeabilityId, labelLocale)}
            {currentMakeable && (
              <span
                data-testid="community-makeability-evidence-gated"
                className="ml-1 font-medium text-emerald-700"
              >
                · {t('community.discovery.currentMakeableEvidenceGated')}
              </span>
            )}
          </span>
        )}
        {rightsId && (
          <RightsBadge
            taxonomy={taxonomy}
            discovery={discovery}
            locale={locale}
          />
        )}
      </div>
    </section>
  );
}

/** File-name default: the full structured detail section. */
export default DiscoveryDetailSection;
