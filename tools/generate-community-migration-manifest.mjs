#!/usr/bin/env node
/**
 * COMM-v0.7.2-TAX-02 · Deterministic migration manifest generator.
 *
 * Emits `public/community/migration-manifest-v1.json` from explicit,
 * audited per-entry data tables. The manifest is the single explicit
 * authority for discovery+curation metadata of every current
 * content-index record plus the canonical demo, the four v0.7.2 look sets
 * and the deterministic creator V1 fixture.
 *
 * Authoring rules applied here (never inferred at runtime by the app):
 * - Every entry names its source contentId and carries explicit discovery +
 *   curation metadata.
 * - A legacy record whose legacy style ids include ST-02 gets the French
 *   treatment: technique:french, empty styleIds, migration
 *   NEEDS_STYLE_REVIEW, publicStatus MANUAL_REVIEW (discoverable by
 *   technique, excluded from style channels by TAX-01 governance).
 * - Non-French legacy styles use only the explicit audited mappings in the
 *   tables below (legacy ST id -> taxonomy-v2 tag).
 * - rights: ORIGINAL only where firstParty provenance is asserted below;
 *   everything else PENDING.
 * - Every current record is CONCEPT_ONLY (no complete capability +
 *   immutable-asset + evidence chain) — current-makeable is never claimed.
 *
 * Deterministic: fixed timestamps, stable entry order, no clock, no network.
 * The emitted fixture must parse with the strict runtime parser
 * (parseMigrationManifestV1); drift is a generator failure.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  parseCommunityTaxonomyV2,
} from '../src/community/domain/taxonomy-v2/parse.ts';
import {
  parseMigrationManifestV1,
  discoverySubjectId,
} from '../src/community/domain/taxonomy-v2/migration-manifest.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const taxonomyPath = path.join(root, 'public/community/taxonomy-v2.json');
const outputPath = path.join(root, 'public/community/migration-manifest-v1.json');

const taxonomyResult = parseCommunityTaxonomyV2(JSON.parse(fs.readFileSync(taxonomyPath, 'utf8')));
if (!taxonomyResult.ok) {
  throw new Error(`taxonomy fixture invalid: ${JSON.stringify(taxonomyResult.issues).slice(0, 500)}`);
}

const MIGRATED_AT = '2026-08-17T00:00:00.000Z'; // TAX-02 migration release (deterministic)
const CURATED_BY = 'operator:community-team';

// ---------------------------------------------------------------------------
// Explicit audited mapping tables (legacy vocabulary -> taxonomy-v2 tags)
// ---------------------------------------------------------------------------

const SCENE_BY_OCCASION = {
  party: 'scene:party-nightlife',
  date: 'scene:date',
  daily: 'scene:daily',
  work: 'scene:work-commute',
  wedding: 'scene:bridal',
};
const SHAPE_BY_LEGACY = {
  almond: 'shape:almond',
  oval: 'shape:oval',
  coffin: 'shape:coffin-ballerina',
  stiletto: 'shape:stiletto',
};
const LENGTH_BY_LEGACY = {
  'extra-short': 'length:extra-short',
  short: 'length:short',
  medium: 'length:medium',
  long: 'length:long',
  'extra-long': 'length:extra-long',
  'ultra-long': 'length:ultra-long',
};
/** Legacy ST id -> audited overall style tag (ST-02 is deliberately absent). */
const STYLE_BY_LEGACY_STYLE_ID = {
  'ST-01': 'style:minimal-clean',
  'ST-03': 'style:soft-delicate',
  'ST-04': 'style:cute-pop',
  'ST-05': 'style:y2k',
  'ST-06': 'style:gothic-dark',
  'ST-07': 'style:futuristic',
  'ST-08': 'style:boho-natural',
  'ST-09': 'style:artistic-abstract',
  'ST-10': 'style:glamorous-sparkling',
};

// ---------------------------------------------------------------------------
// Explicit per-entry data tables
// ---------------------------------------------------------------------------

const contentIndexEntries = [
  {
    contentId: 'cc_mercury_dew', sourceClass: 'LEGACY_CONTENT_INDEX',
    legacyStyleIds: ['ST-01', 'ST-10'], occasions: ['party', 'date'],
    recommendedShapes: ['almond', 'oval'], lengths: ['short', 'medium', 'long'],
    firstParty: true, curated: true, campaignTags: ['recommended'],
    provenanceNote: 'official hero recipe; first-party fixture content',
  },
  {
    contentId: 'cc_petal_veil', sourceClass: 'LEGACY_CONTENT_INDEX',
    legacyStyleIds: ['ST-02'], occasions: ['wedding', 'date'],
    recommendedShapes: ['almond'], lengths: ['medium', 'long'],
    firstParty: true, curated: true, campaignTags: ['recommended'],
    provenanceNote: 'official hero recipe; first-party fixture content',
  },
  {
    contentId: 'cc_petal_pearl_bloom', sourceClass: 'LEGACY_CONTENT_INDEX',
    legacyStyleIds: ['ST-02', 'ST-10'], occasions: ['wedding', 'date'],
    recommendedShapes: ['oval', 'almond'], lengths: ['medium', 'long'],
    firstParty: true, curated: true, campaignTags: ['new', 'structured-v7', 'simulated-assets'],
    provenanceNote: 'official v0.7.2 look; first-party fixture content',
  },
  {
    contentId: 'cc_pearl_tide', sourceClass: 'LEGACY_CONTENT_INDEX',
    legacyStyleIds: ['ST-08'], occasions: ['daily'],
    recommendedShapes: ['oval'], lengths: ['short', 'medium'],
    firstParty: true, curated: true, campaignTags: [],
    provenanceNote: 'official hero recipe; first-party fixture content',
  },
  {
    contentId: 'cc_micro_coquette', sourceClass: 'LEGACY_CONTENT_INDEX',
    legacyStyleIds: ['ST-02', 'ST-04'], occasions: ['date'],
    recommendedShapes: ['almond'], lengths: ['medium'],
    firstParty: true, curated: true, campaignTags: [],
    provenanceNote: 'official hero recipe; first-party fixture content',
  },
  {
    contentId: 'cc_starfish_bloom', sourceClass: 'LEGACY_CONTENT_INDEX',
    legacyStyleIds: ['ST-08', 'ST-10'], occasions: ['wedding', 'party'],
    recommendedShapes: ['almond', 'oval'], lengths: ['short', 'medium'],
    firstParty: true, curated: true, campaignTags: ['new', 'editorial-concept'],
    provenanceNote: 'official v0.7.2 look; first-party fixture content',
  },
  {
    contentId: 'cc_sea_glass_chrome', sourceClass: 'LEGACY_CONTENT_INDEX',
    legacyStyleIds: ['ST-08', 'ST-01'], occasions: ['daily', 'work'],
    recommendedShapes: ['almond', 'oval'], lengths: ['short', 'medium'],
    firstParty: true, curated: true, campaignTags: ['new', 'editorial-concept'],
    provenanceNote: 'official v0.7.2 look; first-party fixture content',
  },
  {
    contentId: 'cc_sunset_aura_glaze', sourceClass: 'LEGACY_CONTENT_INDEX',
    legacyStyleIds: ['ST-09'], occasions: ['party', 'date'],
    recommendedShapes: ['almond', 'coffin'], lengths: ['medium', 'long'],
    firstParty: true, curated: true, campaignTags: ['new', 'editorial-concept'],
    provenanceNote: 'official v0.7.2 look; first-party fixture content',
  },
  {
    contentId: 'cc_liquid_chrome_statement', sourceClass: 'LEGACY_CONTENT_INDEX',
    legacyStyleIds: ['ST-05', 'ST-10'], occasions: ['party'],
    recommendedShapes: ['coffin', 'stiletto'], lengths: ['medium', 'long'],
    firstParty: true, curated: true, campaignTags: ['new', 'asset-pending'],
    provenanceNote: 'official v0.7.2 look; first-party fixture content',
  },
  {
    contentId: 'cc_butter_glaze_quiet', sourceClass: 'LEGACY_CONTENT_INDEX',
    legacyStyleIds: ['ST-01'], occasions: ['daily', 'work'],
    recommendedShapes: ['almond', 'oval'], lengths: ['short', 'medium'],
    firstParty: true, curated: true, campaignTags: ['new', 'inspiration-only'],
    provenanceNote: 'official v0.7.2 look; first-party fixture content',
  },
  {
    contentId: 'cc_pugc_luna_blush', sourceClass: 'LEGACY_CONTENT_INDEX',
    legacyStyleIds: ['ST-03'], occasions: ['date'],
    recommendedShapes: ['almond'], lengths: ['medium'],
    firstParty: false, curated: false, campaignTags: [],
    provenanceNote: 'demo creator fixture; no first-party provenance assertion',
  },
  {
    contentId: 'cc_pugc_luna_pearl', sourceClass: 'LEGACY_CONTENT_INDEX',
    legacyStyleIds: ['ST-04'], occasions: ['party'],
    recommendedShapes: ['almond'], lengths: ['medium'],
    firstParty: false, curated: false, campaignTags: [],
    provenanceNote: 'demo creator fixture; no first-party provenance assertion',
  },
  {
    contentId: 'cc_pugc_kai_circuit', sourceClass: 'LEGACY_CONTENT_INDEX',
    legacyStyleIds: ['ST-05'], occasions: ['party'],
    recommendedShapes: ['almond'], lengths: ['medium'],
    firstParty: false, curated: false, campaignTags: [],
    provenanceNote: 'demo creator fixture; no first-party provenance assertion',
  },
  {
    contentId: 'cc_pugc_kai_oxblood', sourceClass: 'LEGACY_CONTENT_INDEX',
    legacyStyleIds: ['ST-06'], occasions: ['party'],
    recommendedShapes: ['almond'], lengths: ['medium'],
    firstParty: false, curated: false, campaignTags: [],
    provenanceNote: 'demo creator fixture; no first-party provenance assertion',
  },
  {
    contentId: 'cc_pugc_kai_mirror', sourceClass: 'LEGACY_CONTENT_INDEX',
    legacyStyleIds: ['ST-07'], occasions: ['party'],
    recommendedShapes: ['almond'], lengths: ['medium'],
    firstParty: false, curated: false, campaignTags: [],
    provenanceNote: 'demo creator fixture; no first-party provenance assertion',
  },
  {
    contentId: 'cc_pugc_mio_gallery', sourceClass: 'LEGACY_CONTENT_INDEX',
    legacyStyleIds: ['ST-09'], occasions: ['daily'],
    recommendedShapes: ['almond'], lengths: ['medium'],
    firstParty: false, curated: false, campaignTags: [],
    provenanceNote: 'demo creator fixture; no first-party provenance assertion',
  },
  {
    contentId: 'cc_pugc_mio_jewel', sourceClass: 'LEGACY_CONTENT_INDEX',
    legacyStyleIds: ['ST-10'], occasions: ['party'],
    recommendedShapes: ['almond'], lengths: ['medium'],
    firstParty: false, curated: false, campaignTags: [],
    provenanceNote: 'demo creator fixture; no first-party provenance assertion',
  },
  {
    contentId: 'cc_draft_internal_gate', sourceClass: 'LEGACY_CONTENT_INDEX',
    legacyStyleIds: ['ST-01'], occasions: [],
    recommendedShapes: ['almond'], lengths: ['medium'],
    firstParty: true, rights: 'PENDING', curated: false, campaignTags: [],
    provenanceNote: 'internal draft gate; never public; rights PENDING (no clearance exists)',
  },
];

/** Canonical demo (look.v7-1.petal-veil) — French petal veil architecture demo. */
const canonicalDemoEntry = {
  contentId: 'look.v7-1.petal-veil', sourceClass: 'CANONICAL_DEMO',
  legacyStyleIds: [], french: true, occasions: ['daily'],
  recommendedShapes: ['almond'], lengths: ['medium'],
  firstParty: true, curated: true, campaignTags: ['canonical-v7-1'],
  provenanceNote: 'architecture-golden demo; first-party fixture content',
};

/** Four v0.7.2 look sets (explicit audited discovery; canonical releases). */
const fourLookSetEntries = [
  {
    contentId: 'look.v0-7-2.leopard-gilded-nude', sourceClass: 'V0_7_2_LOOK_SET',
    legacyStyleIds: [], styles: ['style:glamorous-sparkling'],
    scenes: ['scene:date', 'scene:party-nightlife'], themes: ['theme:animals-pets', 'theme:jewelry-gems'],
    recommendedShapes: ['almond'], lengths: ['medium'],
    firstParty: true, curated: true, campaignTags: ['structured-v7', 'simulated-assets'],
    provenanceNote: 'official v0.7.2 look set; first-party fixture content',
  },
  {
    contentId: 'look.v0-7-2.crimson-reliquary', sourceClass: 'V0_7_2_LOOK_SET',
    legacyStyleIds: [], styles: ['style:gothic-dark'],
    scenes: ['scene:formal-dinner'], themes: ['theme:myth-folklore'],
    recommendedShapes: ['almond'], lengths: ['medium'],
    firstParty: true, curated: true, campaignTags: ['structured-v7', 'simulated-assets'],
    provenanceNote: 'official v0.7.2 look set; first-party fixture content',
  },
  {
    contentId: 'look.v0-7-2.ivory-lace-crystal', sourceClass: 'V0_7_2_LOOK_SET',
    legacyStyleIds: [], styles: ['style:soft-delicate'],
    scenes: ['scene:bridal', 'scene:date'], themes: ['theme:floral-plants', 'theme:jewelry-gems'],
    recommendedShapes: ['almond'], lengths: ['medium'],
    firstParty: true, curated: true, campaignTags: ['structured-v7', 'simulated-assets'],
    provenanceNote: 'official v0.7.2 look set; first-party fixture content',
  },
  {
    contentId: 'look.v0-7-2.honey-petal-glass', sourceClass: 'V0_7_2_LOOK_SET',
    legacyStyleIds: [], styles: ['style:soft-delicate'],
    scenes: ['scene:date'], themes: ['theme:floral-plants'],
    recommendedShapes: ['almond'], lengths: ['medium'],
    firstParty: true, curated: true, campaignTags: ['structured-v7', 'simulated-assets'],
    provenanceNote: 'official v0.7.2 look set; first-party fixture content',
  },
];

/** Deterministic creator V1 fixture (local demo creator petal-veil publication). */
const creatorV1FixtureEntry = {
  contentId: 'look.creator-fixture.petal-veil', sourceClass: 'CREATOR_V1_FIXTURE',
  legacyStyleIds: [], styles: ['style:soft-delicate'], techniques: ['technique:french'],
  scenes: ['scene:date'], recommendedShapes: ['almond'], lengths: ['medium'],
  firstParty: false, curated: false, campaignTags: [],
  provenanceNote: 'deterministic creator V1 store fixture; no first-party provenance assertion',
};

// ---------------------------------------------------------------------------
// Deterministic entry construction
// ---------------------------------------------------------------------------

function buildEntry(input) {
  const isFrench = input.french === true || input.legacyStyleIds.includes('ST-02');
  const styleIds = isFrench
    ? []
    : [...new Set(input.styles ?? input.legacyStyleIds.map((id) => STYLE_BY_LEGACY_STYLE_ID[id]).filter(Boolean))];
  const techniqueIds = isFrench ? ['technique:french'] : [...(input.techniques ?? [])];
  const sceneIds = [...new Set((input.scenes ?? []).map((id) => SCENE_BY_OCCASION[id] ?? id))];
  const recommendedShapeIds = [...new Set(input.recommendedShapes.map((id) => SHAPE_BY_LEGACY[id] ?? id))];
  const lengthIds = [...new Set(input.lengths.map((id) => LENGTH_BY_LEGACY[id] ?? id))];
  const rightsStatus = input.rights ?? (input.firstParty ? 'ORIGINAL' : 'PENDING');
  const publicStatus = rightsStatus === 'PENDING'
    ? 'PUBLIC_BLOCKED'
    : isFrench ? 'MANUAL_REVIEW' : 'MIGRATED';
  const migrationState = isFrench
    ? 'NEEDS_STYLE_REVIEW'
    : input.legacyStyleIds.length > 0 ? 'LEGACY_STYLE_MIGRATED' : 'NONE';
  const subjectRef = { kind: 'PUBLISHED_LOOK', id: discoverySubjectId(input.contentId) };

  const discovery = {
    schemaVersion: 1,
    contractRef: 'COMM-v0.7.2-TAX-01',
    subjectRef,
    styleIds,
    recommendedShapeIds,
    sceneIds,
    themeIds: [...(input.themes ?? [])],
    techniqueIds,
    lengthIds,
    makeability: {
      classification: 'CONCEPT_ONLY',
      assetRefs: [],
      evidenceRefs: [],
    },
    rights: { status: rightsStatus, evidenceRefs: [] },
    migration: {
      state: migrationState,
      legacyStyleIds: [...input.legacyStyleIds],
      migratedAt: MIGRATED_AT,
      ...(isFrench ? { note: 'French legacy record: discoverable by technique; style review required' } : {}),
    },
    updatedAt: MIGRATED_AT,
  };

  const curation = {
    schemaVersion: 1,
    contractRef: 'COMM-v0.7.2-TAX-01',
    subjectRef,
    curated: input.curated === true,
    ...(input.curated === true ? { curatedBy: CURATED_BY, curatedAt: MIGRATED_AT } : {}),
    campaignTags: [...input.campaignTags],
    featuredChannels: [],
    evidenceRefs: [],
  };

  return {
    contentId: input.contentId,
    subjectRef,
    sourceClass: input.sourceClass,
    provenance: { firstParty: input.firstParty === true, ...(input.provenanceNote ? { note: input.provenanceNote } : {}) },
    publicStatus,
    legacyStyleIds: [...input.legacyStyleIds],
    discovery,
    curation,
  };
}

const entries = [
  ...contentIndexEntries.map(buildEntry),
  buildEntry(canonicalDemoEntry),
  ...fourLookSetEntries.map(buildEntry),
  buildEntry(creatorV1FixtureEntry),
];

const manifest = {
  schemaVersion: 1,
  contractRef: 'COMM-v0.7.2-TAX-02',
  description: 'COMM-v0.7.2-TAX-02 explicit discovery+curation migration for every current community content record, the canonical demo, the four v0.7.2 look sets and the creator V1 fixture.',
  entries,
};

// Self-validate with the strict runtime parser before emitting.
const parsed = parseMigrationManifestV1(manifest, taxonomyResult.value);
if (!parsed.ok) {
  throw new Error(`generated manifest failed strict parse: ${JSON.stringify(parsed.issues).slice(0, 2000)}`);
}

fs.writeFileSync(outputPath, `${JSON.stringify(manifest, null, 2)}\n`);
const byClass = {};
for (const entry of entries) byClass[entry.sourceClass] = (byClass[entry.sourceClass] ?? 0) + 1;
const byStatus = {};
for (const entry of entries) byStatus[entry.publicStatus] = (byStatus[entry.publicStatus] ?? 0) + 1;
console.log(`[generate:community-migration-manifest] wrote ${outputPath}`);
console.log(`  entries=${entries.length} byClass=${JSON.stringify(byClass)} byStatus=${JSON.stringify(byStatus)}`);
