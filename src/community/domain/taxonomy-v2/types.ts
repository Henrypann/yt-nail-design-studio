/**
 * Community v0.7.2 · COMM-v0.7.2-TAX-01 domain types.
 *
 * CommunityTaxonomyV2 is the strict browse/tag contract; the shipped fixture
 * `public/community/taxonomy-v2.json` is its canonical instance.
 * CommunityDiscoveryMetadataV1 (discovery facts) and CommunityCurationMetadataV1
 * (curation facts) are separate auditable contracts; curation never mixes into
 * discovery. None of these types describe EditorDoc / PublishedLookV1 /
 * DesignVersionV1 / Studio state, and no module here writes them.
 */

import type {
  MakeabilityClassification,
  MigrationState,
  RightsStatus,
  TagLifecycleV2,
  TaxonomyDimensionV2,
} from './contract.ts';

export interface BilingualLabelsV2 {
  'zh-CN': string;
  en: string;
}

/** One stable namespaced tag id shared by both locales. */
export interface TaxonomyTagV2 {
  id: string;
  labels: BilingualLabelsV2;
  lifecycle: TagLifecycleV2;
  /** Legacy names / ids. Resolution is deterministic; see resolve.ts. */
  aliases: string[];
  /** Required for DEPRECATED/MERGED; must target an ACTIVE same-dimension tag. */
  replacementId?: string;
}

export interface TagDimensionV2 {
  tags: TaxonomyTagV2[];
}

export interface BrowsePrimaryEntryV2 {
  id: string;
  /** Channels are definitions, not content tags. */
  kind: 'channel' | 'dimension';
  labels: BilingualLabelsV2;
  /** Required when kind === 'dimension'. */
  dimension?: TaxonomyDimensionV2;
  /** Required for the recommended channel entry. */
  defaultSubchannelId?: string;
}

export interface RecommendationChannelV2 {
  id: string;
  labels: BilingualLabelsV2;
  isDefault?: boolean;
  /** following requires a relationship provider (never fabricated). */
  requiresRelationshipProvider?: boolean;
}

export interface CommunityTaxonomyV2 {
  schemaVersion: 2;
  contractVersion: 'COMM-v0.7.2-TAX-01';
  defaultLocale: 'zh-CN';
  /** Short human-readable provenance note (not a runtime enum). */
  description?: string;
  browse: {
    primary: BrowsePrimaryEntryV2[];
    recommendationChannels: RecommendationChannelV2[];
  };
  /** Exactly the eight TAXONOMY_V2_DIMENSIONS keys. */
  dimensions: Record<TaxonomyDimensionV2, TagDimensionV2>;
  /** Retired legacy ids; see DEPRECATED_STYLE_IDS in contract.ts. */
  deprecatedIds: string[];
}

// ---------------------------------------------------------------------------
// Discovery metadata (COMM-v0.7.2-TAX-01, schemaVersion 1)
// ---------------------------------------------------------------------------

export interface SubjectRefV1 {
  kind: 'PUBLISHED_LOOK';
  id: string;
}

export interface DiscoveryMakeabilityV1 {
  classification: MakeabilityClassification;
  /** Versioned capability reference; required for current-makeable. */
  capabilityRef?: string;
  /** Immutable (content-addressed) asset refs. */
  assetRefs: string[];
  evidenceRefs: string[];
}

export interface DiscoveryRightsV1 {
  status: RightsStatus;
  evidenceRefs: string[];
}

export interface DiscoveryMigrationV1 {
  state: MigrationState;
  /** e.g. legacy style ids migrated for this subject. */
  legacyStyleIds: string[];
  migratedAt: string;
  note?: string;
}

/**
 * Discovery facts about one published look. Public eligibility is decided by
 * pure governance predicates (governance.ts), never by inference from
 * applicationLevel / verificationLevel of legacy content records.
 */
export interface CommunityDiscoveryMetadataV1 {
  schemaVersion: 1;
  contractRef: 'COMM-v0.7.2-TAX-01';
  subjectRef: SubjectRefV1;
  styleIds: string[];
  recommendedShapeIds: string[];
  sceneIds: string[];
  themeIds: string[];
  techniqueIds: string[];
  lengthIds: string[];
  makeability: DiscoveryMakeabilityV1;
  rights: DiscoveryRightsV1;
  migration: DiscoveryMigrationV1;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Curation metadata (separate from discovery; never merged into it)
// ---------------------------------------------------------------------------

export interface CommunityCurationMetadataV1 {
  schemaVersion: 1;
  contractRef: 'COMM-v0.7.2-TAX-01';
  subjectRef: SubjectRefV1;
  curated: boolean;
  curatedBy?: string;
  curatedAt?: string;
  campaignTags: string[];
  /** Recommendation channel ids this subject is featured in. */
  featuredChannels: string[];
  evidenceRefs: string[];
}
