/**
 * Community V7.1 · Deterministic golden VALID fixtures for DesignVersionV1,
 * PublishedLookV1 and RemixRelationV1. Each fixture satisfies its strict model
 * type and must parse with zero issues.
 *
 * Fixtures never share mutable object references across exports (every nested
 * object is a fresh literal), and lineage is expressed through stable ids:
 * `DESIGN_LINEAGE_FIXTURES` chains root version → child version (parent ref) →
 * published look (designVersion ref) → remix relation (exact source/target).
 */

import type {
  DesignVersionV1,
  PublishedLookV1,
  RemixRelationV1,
} from '../design-content-model.ts';

/** Known SHA-256 hex digests (sha256 of "test", "hello", "world", "abc"). */
const SHA_TEST = '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08';
const SHA_HELLO = '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824';
const SHA_WORLD = '486ea46224d1bb4fb680f34f7c9ad96a8f24ec88be73ea8e5a6c65260e9cb8a7';
const SHA_ABC = 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad';

const T1 = '2026-08-10T09:30:00.000Z';
const T2 = '2026-08-11T02:00:00.000Z';

/** Root of the design lineage: version 1 / revision 1, no parent. */
export const DESIGN_VERSION_V1_ROOT_FIXTURE = {
  schemaVersion: 1,
  designVersionId: 'dv_design_alpha_0001',
  designId: 'dsg_design_alpha',
  version: 1,
  revision: 1,
  editorDocRef: {
    designId: 'dsg_design_alpha',
    schemaVersion: 7,
    revision: 1,
    sha256: SHA_TEST,
  },
  releasedByIdentityId: 'idn_creator_salon_002',
  releasedAt: T1,
  assetRevisionRefs: [
    {
      assetId: 'ast_design_alpha_render_0001',
      revision: 1,
      sha256: SHA_WORLD,
      mimeType: 'image/png',
    },
  ],
} satisfies DesignVersionV1;

/** Child of the root: version 2 / revision 3, released with cover asset. */
export const DESIGN_VERSION_V1_CHILD_FIXTURE = {
  schemaVersion: 1,
  designVersionId: 'dv_design_alpha_0002',
  designId: 'dsg_design_alpha',
  version: 2,
  revision: 3,
  editorDocRef: {
    designId: 'dsg_design_alpha',
    schemaVersion: 7,
    revision: 3,
    sha256: SHA_HELLO,
  },
  releasedByIdentityId: 'idn_creator_salon_002',
  releasedAt: T2,
  assetRevisionRefs: [
    {
      assetId: 'ast_design_alpha_render_0002',
      revision: 1,
      sha256: SHA_WORLD,
      mimeType: 'image/png',
    },
    {
      assetId: 'ast_design_alpha_cover_0002',
      revision: 1,
      sha256: SHA_ABC,
      mimeType: 'image/webp',
    },
    {
      assetId: 'ast_design_alpha_detail_0001',
      revision: 1,
      sha256: SHA_HELLO,
      mimeType: 'image/png',
    },
  ],
  parentVersionId: 'dv_design_alpha_0001',
} satisfies DesignVersionV1;

/** PUBLIC / PUBLISHED look referencing the child version, gate cleared. */
export const PUBLISHED_LOOK_V1_FIXTURE = {
  schemaVersion: 1,
  lookId: 'lk_design_alpha_0001',
  designVersionId: 'dv_design_alpha_0002',
  creatorProfileId: 'cp_creator_004',
  title: 'Aurora Almond',
  metadata: { theme: 'aurora' },
  tags: ['chromatic', 'matte'],
  visibility: 'PUBLIC',
  coverPreview: {
    assetId: 'ast_design_alpha_cover_0002',
    revision: 1,
    kind: 'COVER',
    sha256: SHA_ABC,
    mimeType: 'image/webp',
    width: 1024,
    height: 1024,
    fidelity: 'EXACT',
  },
  detailPreviews: [
    {
      assetId: 'ast_design_alpha_detail_0001',
      revision: 1,
      kind: 'DETAIL',
      sha256: SHA_HELLO,
      mimeType: 'image/png',
      width: 512,
      height: 512,
      fidelity: 'APPROXIMATE',
    },
  ],
  summaries: {
    shapeIds: ['almond', 'oval'],
    lengthIds: ['medium'],
    palette: ['COL_AURORA_01', 'COL_AURORA_02'],
  },
  publicationGate: {
    copyrightDeclared: true,
    sourceDeclared: true,
    moderationCleared: true,
  },
  status: 'PUBLISHED',
  publishedAt: T2,
  remixRelationId: 'rmx_alpha_0001',
  createdAt: T1,
  updatedAt: T2,
} satisfies PublishedLookV1;

/** PRIVATE / DRAFT look: gate not cleared, no publishedAt, no remix ref. */
export const PUBLISHED_LOOK_V1_DRAFT_PRIVATE_FIXTURE = {
  schemaVersion: 1,
  lookId: 'lk_design_alpha_0002',
  designVersionId: 'dv_design_alpha_0001',
  creatorProfileId: 'cp_creator_004',
  title: 'Aurora Almond (draft)',
  tags: [],
  visibility: 'PRIVATE',
  coverPreview: {
    assetId: 'ast_design_alpha_render_0001',
    revision: 1,
    kind: 'COVER',
    sha256: SHA_WORLD,
    mimeType: 'image/png',
    width: 800,
    height: 800,
    fidelity: 'EXACT',
  },
  detailPreviews: [],
  summaries: {
    shapeIds: ['almond'],
    lengthIds: ['medium'],
    palette: ['COL_AURORA_01'],
  },
  publicationGate: {
    copyrightDeclared: false,
    sourceDeclared: false,
    moderationCleared: false,
  },
  status: 'DRAFT',
  createdAt: T1,
  updatedAt: T1,
} satisfies PublishedLookV1;

/** Released to the creator library while remaining PRIVATE by default. */
export const PUBLISHED_LOOK_V1_PUBLISHED_PRIVATE_FIXTURE = {
  ...structuredClone(PUBLISHED_LOOK_V1_DRAFT_PRIVATE_FIXTURE),
  lookId: 'lk_design_alpha_private_published',
  status: 'PUBLISHED',
  publishedAt: T2,
  updatedAt: T2,
} satisfies PublishedLookV1;

/** Moderation state retains the original publication timestamp and visibility. */
export const PUBLISHED_LOOK_V1_HIDDEN_FIXTURE = {
  ...structuredClone(PUBLISHED_LOOK_V1_FIXTURE),
  lookId: 'lk_design_alpha_hidden',
  status: 'HIDDEN',
} satisfies PublishedLookV1;

/** Remix: source look beta (external) + root version → target child version. */
export const REMIX_RELATION_V1_FIXTURE = {
  schemaVersion: 1,
  relationId: 'rmx_alpha_0001',
  sourceLookId: 'lk_design_beta_0001',
  sourceDesignVersionId: 'dv_design_alpha_0001',
  sourceCreatorProfileId: 'cp_creator_004',
  targetDesignVersionId: 'dv_design_alpha_0002',
  createdAt: T2,
  license: 'CC-BY-4.0',
  sourceAttribution: 'remixed from lk_design_beta_0001 by cp_creator_004',
} satisfies RemixRelationV1;

/** Full lineage: root → child (parent) → look (designVersion) → remix. */
export const DESIGN_LINEAGE_FIXTURES = {
  rootVersion: DESIGN_VERSION_V1_ROOT_FIXTURE,
  childVersion: DESIGN_VERSION_V1_CHILD_FIXTURE,
  look: PUBLISHED_LOOK_V1_FIXTURE,
  remixRelation: REMIX_RELATION_V1_FIXTURE,
} as const;
