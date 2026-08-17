/**
 * Community v0.7.2 · COMM-v0.7.2-TAX-01 Taxonomy & Governance contract constants.
 *
 * Single source of truth the runtime parsers, resolvers and governance
 * predicates validate against, and that the shipped fixture
 * `public/community/taxonomy-v2.json` must agree with (fixture/runtime drift
 * is a test failure). The vocabulary below is the exact browse vocabulary
 * from the 2026-08-14 PRD (Community_标签与Studio_法式工具_PRD_2026-08-14,
 * status: planned).
 *
 * This module is pure and Node-testable (no browser globals, no env access).
 */

/** Bound for issue reporting: parsers never grow unbounded lists. */
export const MAX_ISSUES = 200;

export const TAXONOMY_V2_CONTRACT = 'COMM-v0.7.2-TAX-01' as const;
export const TAXONOMY_V2_SCHEMA_VERSION = 2 as const;
export const TAXONOMY_V2_DEFAULT_LOCALE = 'zh-CN' as const;

/** Tag dimensions. Bilingual labels (zh-CN + en) share one stable tag id. */
export const TAXONOMY_V2_DIMENSIONS = [
  'STYLE',
  'SHAPE',
  'SCENE',
  'THEME',
  'TECHNIQUE',
  'LENGTH',
  'MAKEABILITY',
  'RIGHTS',
] as const;
export type TaxonomyDimensionV2 = (typeof TAXONOMY_V2_DIMENSIONS)[number];

/** Lowercase namespaced id prefix per dimension (tag ids must match). */
export const DIMENSION_TAG_PREFIX: Record<TaxonomyDimensionV2, string> = {
  STYLE: 'style',
  SHAPE: 'shape',
  SCENE: 'scene',
  THEME: 'theme',
  TECHNIQUE: 'technique',
  LENGTH: 'length',
  MAKEABILITY: 'makeability',
  RIGHTS: 'rights',
};

export const TAXONOMY_V2_TAG_ID_PATTERN =
  /^[a-z][a-z0-9-]*:[a-z0-9][a-z0-9-]*$/;

export const TAG_LIFECYCLES = ['ACTIVE', 'DEPRECATED', 'MERGED'] as const;
export type TagLifecycleV2 = (typeof TAG_LIFECYCLES)[number];

// ---------------------------------------------------------------------------
// Browse contract (fixed primary order; channels are definitions, not tags)
// ---------------------------------------------------------------------------

export const PRIMARY_BROWSE_IDS = [
  'recommended',
  'shape',
  'style',
  'scene',
  'theme',
] as const;
export type PrimaryBrowseId = (typeof PRIMARY_BROWSE_IDS)[number];

/** kind=dimension primary entries map to a tag dimension. */
export const PRIMARY_BROWSE_DIMENSION: Partial<Record<PrimaryBrowseId, TaxonomyDimensionV2>> = {
  shape: 'SHAPE',
  style: 'STYLE',
  scene: 'SCENE',
  theme: 'THEME',
};

export const RECOMMENDATION_CHANNEL_IDS = [
  'for-you',
  'trending',
  'new',
  'editorial',
  'following',
  'makeable',
  'dimensional',
  'emerging-creator',
  'collections',
] as const;
export type RecommendationChannelId = (typeof RECOMMENDATION_CHANNEL_IDS)[number];

export const DEFAULT_RECOMMENDATION_CHANNEL = 'for-you' as const;

/** `following` is a relationship-driven channel: it needs a relationship provider. */
export const FOLLOWING_CHANNEL_ID = 'following' as const;

// ---------------------------------------------------------------------------
// Exact PRD vocabulary (deterministic order = array order; drift = failure)
// ---------------------------------------------------------------------------

export const REQUIRED_TAG_IDS: Record<TaxonomyDimensionV2, readonly string[]> = {
  STYLE: [
    'style:minimal-clean',
    'style:classic-refined',
    'style:quiet-luxury',
    'style:soft-delicate',
    'style:glamorous-sparkling',
    'style:bold-ornate',
    'style:fierce-sexy',
    'style:bow-ballerina',
    'style:preppy',
    'style:y2k',
    'style:retro-nostalgic',
    'style:gothic-dark',
    'style:punk-grunge',
    'style:alt-emo',
    'style:boho-natural',
    'style:western',
    'style:street',
    'style:cute-pop',
    'style:futuristic',
    'style:editorial-avant-garde',
    'style:artistic-abstract',
    'style:whimsical-pastoral',
  ],
  SHAPE: [
    'shape:almond',
    'shape:oval',
    'shape:round',
    'shape:square',
    'shape:squoval',
    'shape:tapered-square',
    'shape:coffin-ballerina',
    'shape:stiletto',
    'shape:special',
  ],
  SCENE: [
    'scene:daily',
    'scene:work-commute',
    'scene:date',
    'scene:bridal',
    'scene:wedding-guest',
    'scene:prom-homecoming',
    'scene:graduation',
    'scene:travel-vacation',
    'scene:party-nightlife',
    'scene:music-festival',
    'scene:concert-fandom',
    'scene:formal-dinner',
    'scene:content-shooting',
    'scene:birthday',
    'scene:festival-celebration',
    'scene:halloween',
    'scene:pride',
    'scene:gift-custom',
  ],
  THEME: [
    'theme:art-museum',
    'theme:floral-plants',
    'theme:butterfly-insects',
    'theme:animals-pets',
    'theme:ocean-coast',
    'theme:sky-clouds',
    'theme:stars-cosmos',
    'theme:nature-landscape',
    'theme:crystal-minerals',
    'theme:food-drinks',
    'theme:jewelry-gems',
    'theme:fashion-fabrics',
    'theme:geometry-architecture',
    'theme:film-games',
    'theme:music-pop-culture',
    'theme:zodiac-astrology',
    'theme:myth-folklore',
    'theme:fantasy-fairytale',
    'theme:city-travel',
    'theme:sports-teams',
    'theme:heritage-folk-art',
    'theme:festival-seasonal',
    'theme:brand-logos',
  ],
  TECHNIQUE: ['technique:french'],
  LENGTH: [
    'length:extra-short',
    'length:short',
    'length:medium',
    'length:long',
    'length:extra-long',
    'length:ultra-long',
  ],
  MAKEABILITY: [
    'makeability:machine-direct',
    'makeability:machine-hand-finish',
    'makeability:hand-made',
    'makeability:dimensional-module',
    'makeability:concept-only',
  ],
  RIGHTS: [
    'rights:original',
    'rights:licensed',
    'rights:remix-allowed',
    'rights:personal-use-only',
    'rights:pending',
  ],
};

/**
 * Retired legacy style ids (schemaVersion 1 `mainStyles`). They must never be
 * reintroduced as live tag ids; each must be covered by exactly one alias so
 * legacy links resolve deterministically (ST-02 → technique:french).
 */
export const DEPRECATED_STYLE_IDS = [
  'ST-01',
  'ST-02',
  'ST-03',
  'ST-04',
  'ST-05',
  'ST-06',
  'ST-07',
  'ST-08',
  'ST-09',
  'ST-10',
] as const;

// ---------------------------------------------------------------------------
// Discovery metadata enums (must stay aligned with the MAKEABILITY/RIGHTS tags)
// ---------------------------------------------------------------------------

export const MAKEABILITY_CLASSIFICATIONS = [
  'MACHINE_DIRECT',
  'MACHINE_HAND_FINISH',
  'HAND_MADE',
  'DIMENSIONAL_MODULE',
  'CONCEPT_ONLY',
] as const;
export type MakeabilityClassification =
  (typeof MAKEABILITY_CLASSIFICATIONS)[number];

export const RIGHTS_STATUSES = [
  'ORIGINAL',
  'LICENSED',
  'REMIX_ALLOWED',
  'PERSONAL_USE_ONLY',
  'PENDING',
] as const;
export type RightsStatus = (typeof RIGHTS_STATUSES)[number];

export const MIGRATION_STATES = [
  'NONE',
  'LEGACY_STYLE_MIGRATED',
  'NEEDS_STYLE_REVIEW',
  'MERGED',
] as const;
export type MigrationState = (typeof MIGRATION_STATES)[number];

/** classification ↔ makeability tag id alignment. */
export const MAKEABILITY_CLASSIFICATION_TAGS: Record<MakeabilityClassification, string> = {
  MACHINE_DIRECT: 'makeability:machine-direct',
  MACHINE_HAND_FINISH: 'makeability:machine-hand-finish',
  HAND_MADE: 'makeability:hand-made',
  DIMENSIONAL_MODULE: 'makeability:dimensional-module',
  CONCEPT_ONLY: 'makeability:concept-only',
};

/** rights status ↔ rights tag id alignment. */
export const RIGHTS_STATUS_TAGS: Record<RightsStatus, string> = {
  ORIGINAL: 'rights:original',
  LICENSED: 'rights:licensed',
  REMIX_ALLOWED: 'rights:remix-allowed',
  PERSONAL_USE_ONLY: 'rights:personal-use-only',
  PENDING: 'rights:pending',
};

// ---------------------------------------------------------------------------
// Strict reference formats (capability / immutable asset / evidence)
// ---------------------------------------------------------------------------

/**
 * capabilityRef must be versioned. Format-level resolution only in this PR;
 * registry-level resolution is a later runtime concern (see VALIDATION.md).
 */
export const CAPABILITY_REF_PATTERN =
  /^capability:\/\/[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?(?:\/[a-z0-9._-]+)+@v[0-9]+\.[0-9]+\.[0-9]+$/;

/** Immutable asset refs are content-addressed (sha256, exactly 64 hex). */
export const ASSET_REF_PATTERN =
  /^asset:\/\/[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?(?:\/[a-z0-9._-]+)+@sha256:[0-9a-f]{64}$/;

export const EVIDENCE_REF_PATTERN =
  /^evidence:\/\/[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?(?:\/[a-z0-9._-]+)+@v[0-9]+\.[0-9]+\.[0-9]+$/;

/** Subject refs, e.g. `look:<id>` for a PublishedLook. */
export const SUBJECT_REF_PATTERN = /^[a-z][a-z0-9-]*:[a-z0-9][a-z0-9._-]*$/;

export const ISO_TIMESTAMP_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;

export const CAMPAIGN_TAG_PATTERN = /^[a-z0-9][a-z0-9-]{0,63}$/;
