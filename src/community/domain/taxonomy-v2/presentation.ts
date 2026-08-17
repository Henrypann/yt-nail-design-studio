/**
 * Community v0.7.2 · COMM-v0.7.2-TAX-04 discovery presentation (pure).
 *
 * Pure, Node-testable presentation derivations shared by the Explore/Search
 * card (CommunityLookCard) and the canonical detail page (CommunityLookPage).
 * No browser globals, no React, no legacy taxonomy: labels are resolved by
 * exact namespaced V2 tag ids only; rights and makeability status ids come
 * from the existing contract maps (RIGHTS_STATUS_TAGS /
 * MAKEABILITY_CLASSIFICATION_TAGS); discovery arrays are never combined with
 * PublishedLookV1.tags, mainStyleId, effectIds, moodIds, applicationLevel or
 * verificationLevel.
 *
 * Card tag pills:
 * - current browse dimension first (shape/style/scene/theme), then the fixed
 *   fallback order STYLE → TECHNIQUE → SHAPE → SCENE → THEME;
 * - browse 'recommended' has no extra dimension priority (plain fallback);
 * - de-duplicated by exact tag id, capped at CARD_TAG_PILL_MAX (6);
 * - rights / makeability / length are NEVER card tag pills.
 *
 * Full structured detail groups:
 * - ordered STYLE, TECHNIQUE, SHAPE, SCENE, THEME, LENGTH; only non-empty
 *   groups are returned, using the discovery arrays as-is (all ids);
 * - makeability and rights are separate status ids derived from the contract
 *   maps, never inferred from tag content.
 */

import {
  MAKEABILITY_CLASSIFICATION_TAGS,
  RIGHTS_STATUS_TAGS,
  TAXONOMY_V2_DIMENSIONS,
} from './contract.ts';
import type { DiscoveryBrowseV2 } from './discovery-query.ts';
import type {
  BilingualLabelsV2,
  CommunityDiscoveryMetadataV1,
  CommunityTaxonomyV2,
  TaxonomyTagV2,
} from './types.ts';

export type { DiscoveryBrowseV2 } from './discovery-query.ts';

/** Card tag pill cap (requirement: maximum 6). */
export const CARD_TAG_PILL_MAX = 6;

/**
 * Card pill fallback order. RIGHTS / MAKEABILITY / LENGTH are excluded by
 * contract: they are status dimensions, never card tag pills.
 */
export const CARD_TAG_DIMENSION_ORDER = [
  'STYLE',
  'TECHNIQUE',
  'SHAPE',
  'SCENE',
  'THEME',
] as const;
export type CardTagDimensionV2 = (typeof CARD_TAG_DIMENSION_ORDER)[number];

/** Full structured detail group order. */
export const DISCOVERY_DETAIL_GROUP_ORDER = [
  'STYLE',
  'TECHNIQUE',
  'SHAPE',
  'SCENE',
  'THEME',
  'LENGTH',
] as const;
export type DiscoveryDetailGroupDimensionV2 =
  (typeof DISCOVERY_DETAIL_GROUP_ORDER)[number];

/** Bilingual label selection locale (taxonomy label keys, not the i18n Locale). */
export type DiscoveryLocaleV2 = 'zh-CN' | 'en';

export interface DiscoveryDetailGroupV2 {
  dimension: DiscoveryDetailGroupDimensionV2;
  ids: string[];
}

/** Discovery array accessors for the card-pill dimensions. */
const CARD_DIMENSION_DISCOVERY_IDS: Record<
  CardTagDimensionV2,
  (discovery: CommunityDiscoveryMetadataV1) => readonly string[]
> = {
  STYLE: (discovery) => discovery.styleIds,
  TECHNIQUE: (discovery) => discovery.techniqueIds,
  SHAPE: (discovery) => discovery.recommendedShapeIds,
  SCENE: (discovery) => discovery.sceneIds,
  THEME: (discovery) => discovery.themeIds,
};

/** Discovery array accessors for the full detail groups (adds LENGTH). */
const DETAIL_DIMENSION_DISCOVERY_IDS: Record<
  DiscoveryDetailGroupDimensionV2,
  (discovery: CommunityDiscoveryMetadataV1) => readonly string[]
> = {
  ...CARD_DIMENSION_DISCOVERY_IDS,
  LENGTH: (discovery) => discovery.lengthIds,
};

/** Dimension browse entries → their tag dimension ('recommended' has none). */
const CARD_BROWSE_DIMENSION: Partial<
  Record<DiscoveryBrowseV2, CardTagDimensionV2>
> = {
  shape: 'SHAPE',
  style: 'STYLE',
  scene: 'SCENE',
  theme: 'THEME',
};

/**
 * Card tag pills: current browse dimension first (shape/style/scene/theme),
 * then the fixed fallback order style → technique → recommended shape →
 * scene → theme. browse 'recommended' has no extra dimension priority.
 * De-duplicated by exact tag id; capped at CARD_TAG_PILL_MAX. RIGHTS /
 * MAKEABILITY / LENGTH ids never appear.
 */
export function cardTagIdsForDiscovery(
  discovery: CommunityDiscoveryMetadataV1,
  browse: DiscoveryBrowseV2,
): string[] {
  const dimensionFirst = CARD_BROWSE_DIMENSION[browse];
  const ordered: readonly CardTagDimensionV2[] = dimensionFirst
    ? [
        dimensionFirst,
        ...CARD_TAG_DIMENSION_ORDER.filter(
          (dimension) => dimension !== dimensionFirst,
        ),
      ]
    : CARD_TAG_DIMENSION_ORDER;
  const ids: string[] = [];
  const seen = new Set<string>();
  for (const dimension of ordered) {
    for (const id of CARD_DIMENSION_DISCOVERY_IDS[dimension](discovery)) {
      if (seen.has(id)) continue;
      seen.add(id);
      ids.push(id);
      if (ids.length >= CARD_TAG_PILL_MAX) return ids;
    }
  }
  return ids;
}

/**
 * Full structured detail groups in the required order STYLE, TECHNIQUE,
 * SHAPE, SCENE, THEME, LENGTH. Only non-empty groups are returned and every
 * id of a non-empty group is preserved.
 */
export function discoveryDetailGroups(
  discovery: CommunityDiscoveryMetadataV1,
): DiscoveryDetailGroupV2[] {
  const groups: DiscoveryDetailGroupV2[] = [];
  for (const dimension of DISCOVERY_DETAIL_GROUP_ORDER) {
    const ids = DETAIL_DIMENSION_DISCOVERY_IDS[dimension](discovery);
    if (ids.length === 0) continue;
    groups.push({ dimension, ids: [...ids] });
  }
  return groups;
}

/** Makeability status tag id from the existing classification contract map. */
export function makeabilityTagIdForDiscovery(
  discovery: CommunityDiscoveryMetadataV1,
): string | null {
  return (
    MAKEABILITY_CLASSIFICATION_TAGS[discovery.makeability.classification] ??
    null
  );
}

/** Rights status tag id from the existing status contract map. */
export function rightsTagIdForDiscovery(
  discovery: CommunityDiscoveryMetadataV1,
): string | null {
  return RIGHTS_STATUS_TAGS[discovery.rights.status] ?? null;
}

/**
 * Exact namespaced tag id lookup across all taxonomy dimensions. Never
 * resolves aliases, replacement chains or legacy ids; never invents tags.
 */
export function findV2TagById(
  taxonomy: CommunityTaxonomyV2,
  id: string,
): TaxonomyTagV2 | null {
  for (const dimension of TAXONOMY_V2_DIMENSIONS) {
    const tag = taxonomy.dimensions[dimension].tags.find(
      (candidate) => candidate.id === id,
    );
    if (tag) return tag;
  }
  return null;
}

/**
 * Bilingual label by exact namespaced V2 tag id. Falls back to the raw id
 * only when the taxonomy has no such tag (defensive; the strict manifest
 * guarantees every discovery id resolves).
 */
export function resolveV2TagLabel(
  taxonomy: CommunityTaxonomyV2,
  id: string,
  locale: DiscoveryLocaleV2,
): string {
  const tag = findV2TagById(taxonomy, id);
  if (!tag) return id;
  return tag.labels[locale] ?? tag.labels['zh-CN'];
}

/**
 * Bilingual group labels for the detail section. TECHNIQUE and LENGTH have
 * no browse primary entry, so their labels are fixed PRD vocabulary; the
 * other dimensions prefer the strict taxonomy browse entry labels.
 */
export const DISCOVERY_GROUP_LABELS: Record<
  DiscoveryDetailGroupDimensionV2,
  BilingualLabelsV2
> = {
  STYLE: { 'zh-CN': '风格', en: 'Style' },
  TECHNIQUE: { 'zh-CN': '技法', en: 'Technique' },
  SHAPE: { 'zh-CN': '推荐甲型', en: 'Recommended shape' },
  SCENE: { 'zh-CN': '场景', en: 'Scene' },
  THEME: { 'zh-CN': '主题', en: 'Theme' },
  LENGTH: { 'zh-CN': '长度', en: 'Length' },
};

/**
 * Bilingual group label: prefers the strict taxonomy browse entry labels for
 * the dimension, falls back to the fixed PRD vocabulary otherwise.
 */
export function discoveryGroupLabel(
  taxonomy: CommunityTaxonomyV2,
  dimension: DiscoveryDetailGroupDimensionV2,
  locale: DiscoveryLocaleV2,
): string {
  const entry = taxonomy.browse.primary.find(
    (candidate) => candidate.dimension === dimension,
  );
  const labels = entry?.labels ?? DISCOVERY_GROUP_LABELS[dimension];
  return labels[locale] ?? labels['zh-CN'];
}
