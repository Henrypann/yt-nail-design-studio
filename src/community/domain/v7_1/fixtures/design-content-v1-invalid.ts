/**
 * Community V7.1 · Deterministic golden INVALID fixtures for DesignVersionV1,
 * PublishedLookV1 and RemixRelationV1.
 *
 * Each fixture must be rejected by its parser and must emit every code listed
 * in `expectedCodes` with a stable issue path. Parsers must never throw and
 * must never mutate the input (except cyclic/bigint fixtures, marked
 * snapshotSafe false).
 */

import {
  parseDesignVersionV1,
  parsePublishedLookV1,
  parseRemixRelationV1,
} from '../design-content-parse.ts';

export interface DesignContentV1InvalidFixture {
  name: string;
  value: unknown;
  expectedCodes: readonly string[];
  parse: (input: unknown) => { ok: boolean; issues?: Array<{ code: string; path: string; message: string }> };
  /** Cyclic/bigint inputs cannot be JSON-snapshotted; default true. */
  snapshotSafe?: boolean;
}

const T1 = '2026-08-10T09:30:00.000Z';
const T2 = '2026-08-11T02:00:00.000Z';

const SHA_TEST = '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08';
const SHA_WORLD = '486ea46224d1bb4fb680f34f7c9ad96a8f24ec88be73ea8e5a6c65260e9cb8a7';
const SHA_ABC = 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad';

function omitKeys(value: Record<string, unknown>, ...keys: string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(value)) {
    if (!keys.includes(key)) out[key] = value[key];
  }
  return out;
}

const GATE = { copyrightDeclared: true, sourceDeclared: true, moderationCleared: true };

const BASE_VERSION = {
  schemaVersion: 1,
  designVersionId: 'dv_invalid_0001',
  designId: 'dsg_invalid',
  version: 1,
  revision: 1,
  editorDocRef: {
    designId: 'dsg_invalid',
    schemaVersion: 7,
    revision: 1,
    sha256: SHA_TEST,
  },
  releasedByIdentityId: 'idn_creator_salon_002',
  releasedAt: T1,
  assetRevisionRefs: [
    {
      assetId: 'ast_invalid_render_0001',
      revision: 1,
      sha256: SHA_WORLD,
      mimeType: 'image/png',
    },
  ],
};

const BASE_LOOK_NO_PUBLISHED_AT = {
  schemaVersion: 1,
  lookId: 'lk_invalid_0001',
  designVersionId: 'dv_invalid_0001',
  creatorProfileId: 'cp_creator_004',
  title: 'Invalid Look',
  tags: ['matte'],
  visibility: 'PUBLIC',
  coverPreview: {
    assetId: 'ast_invalid_cover_0001',
    revision: 1,
    kind: 'COVER',
    sha256: SHA_ABC,
    mimeType: 'image/webp',
    width: 1024,
    height: 1024,
    fidelity: 'EXACT',
  },
  detailPreviews: [],
  summaries: { shapeIds: ['almond'], lengthIds: ['medium'], palette: ['COL_INV_01'] },
  publicationGate: GATE,
  status: 'PUBLISHED',
  createdAt: T1,
  updatedAt: T2,
};

const BASE_LOOK = { ...BASE_LOOK_NO_PUBLISHED_AT, publishedAt: T2 };

const BASE_REMIX = {
  schemaVersion: 1,
  relationId: 'rmx_invalid_0001',
  sourceLookId: 'lk_source_0001',
  sourceDesignVersionId: 'dv_source_0001',
  sourceCreatorProfileId: 'cp_creator_004',
  targetDesignVersionId: 'dv_target_0001',
  createdAt: T1,
};

const cyclicLook: Record<string, unknown> = { ...BASE_LOOK };
cyclicLook.self = cyclicLook;

export const DESIGN_CONTENT_V1_INVALID_FIXTURES: readonly DesignContentV1InvalidFixture[] = [
  // ---- not an object -------------------------------------------------------
  { name: 'design version null', value: null, expectedCodes: ['not_an_object'], parse: parseDesignVersionV1 },
  { name: 'design version string', value: 'version', expectedCodes: ['not_an_object'], parse: parseDesignVersionV1 },
  { name: 'design version array', value: [], expectedCodes: ['not_an_object'], parse: parseDesignVersionV1 },
  { name: 'design version symbol', value: Symbol('dv'), expectedCodes: ['not_an_object'], parse: parseDesignVersionV1 },
  { name: 'design version bigint', value: 9n, expectedCodes: ['not_an_object'], parse: parseDesignVersionV1, snapshotSafe: false },
  { name: 'published look null', value: null, expectedCodes: ['not_an_object'], parse: parsePublishedLookV1 },
  { name: 'remix relation number', value: 42, expectedCodes: ['not_an_object'], parse: parseRemixRelationV1 },

  // ---- schema version ------------------------------------------------------
  {
    name: 'version wrong schemaVersion',
    value: { ...BASE_VERSION, schemaVersion: 2 },
    expectedCodes: ['schema_version'],
    parse: parseDesignVersionV1,
  },
  {
    name: 'look wrong schemaVersion',
    value: { ...BASE_LOOK, schemaVersion: 9 },
    expectedCodes: ['schema_version'],
    parse: parsePublishedLookV1,
  },
  {
    name: 'ref wrong editorDoc schemaVersion',
    value: { ...BASE_VERSION, editorDocRef: { ...BASE_VERSION.editorDocRef, schemaVersion: 8 } },
    expectedCodes: ['schema_version'],
    parse: parseDesignVersionV1,
  },
  {
    name: 'remix wrong schemaVersion',
    value: { ...BASE_REMIX, schemaVersion: 2 },
    expectedCodes: ['schema_version'],
    parse: parseRemixRelationV1,
  },

  // ---- unknown keys / embedded EditorDoc -----------------------------------
  {
    name: 'version unknown key',
    value: { ...BASE_VERSION, extraField: 1 },
    expectedCodes: ['unknown_key'],
    parse: parseDesignVersionV1,
  },
  {
    name: 'version embeds editorDoc at top level',
    value: { ...BASE_VERSION, editorDoc: { schemaVersion: 7, designId: 'dsg_invalid', nails: {} } },
    expectedCodes: ['embedded_editor_doc', 'unknown_key'],
    parse: parseDesignVersionV1,
  },
  {
    name: 'ref embeds nails and outputIntent',
    value: {
      ...BASE_VERSION,
      editorDocRef: { ...BASE_VERSION.editorDocRef, nails: {}, outputIntent: 'PRINT' },
    },
    expectedCodes: ['embedded_editor_doc', 'unknown_key'],
    parse: parseDesignVersionV1,
  },
  {
    name: 'ref embeds steps',
    value: { ...BASE_VERSION, editorDocRef: { ...BASE_VERSION.editorDocRef, steps: [] } },
    expectedCodes: ['embedded_editor_doc', 'unknown_key'],
    parse: parseDesignVersionV1,
  },

  // ---- malformed ids / hash / timestamps / versions -------------------------
  {
    name: 'version malformed designVersionId',
    value: { ...BASE_VERSION, designVersionId: 'bad id!' },
    expectedCodes: ['invalid_id'],
    parse: parseDesignVersionV1,
  },
  {
    name: 'version version 0',
    value: { ...BASE_VERSION, version: 0 },
    expectedCodes: ['invalid_positive_int'],
    parse: parseDesignVersionV1,
  },
  {
    name: 'version version -1',
    value: { ...BASE_VERSION, version: -1 },
    expectedCodes: ['invalid_positive_int'],
    parse: parseDesignVersionV1,
  },
  {
    name: 'version revision 1.5',
    value: { ...BASE_VERSION, revision: 1.5 },
    expectedCodes: ['invalid_type'],
    parse: parseDesignVersionV1,
  },
  {
    name: 'version revision as string',
    value: { ...BASE_VERSION, revision: '3' },
    expectedCodes: ['invalid_type'],
    parse: parseDesignVersionV1,
  },
  {
    name: 'version malformed releasedAt',
    value: { ...BASE_VERSION, releasedAt: '2026/08/11 02:00:00' },
    expectedCodes: ['invalid_timestamp'],
    parse: parseDesignVersionV1,
  },
  {
    name: 'version malformed sha256 (short)',
    value: { ...BASE_VERSION, editorDocRef: { ...BASE_VERSION.editorDocRef, sha256: 'abc' } },
    expectedCodes: ['invalid_hash'],
    parse: parseDesignVersionV1,
  },
  {
    name: 'version malformed sha256 (non-hex)',
    value: { ...BASE_VERSION, editorDocRef: { ...BASE_VERSION.editorDocRef, sha256: 'g'.repeat(64) } },
    expectedCodes: ['invalid_hash'],
    parse: parseDesignVersionV1,
  },
  {
    name: 'asset ref malformed sha256',
    value: {
      ...BASE_VERSION,
      assetRevisionRefs: [{ assetId: 'ast_invalid_render_0001', revision: 1, sha256: 'nope' }],
    },
    expectedCodes: ['invalid_hash'],
    parse: parseDesignVersionV1,
  },

  // ---- asset revisions -----------------------------------------------------
  {
    name: 'version duplicate asset revision',
    value: {
      ...BASE_VERSION,
      assetRevisionRefs: [
        { assetId: 'ast_invalid_render_0001', revision: 1, sha256: SHA_WORLD, mimeType: 'image/png' },
        { assetId: 'ast_invalid_render_0001', revision: 1, sha256: SHA_WORLD, mimeType: 'image/png' },
      ],
    },
    expectedCodes: ['duplicate_asset_ref'],
    parse: parseDesignVersionV1,
  },
  {
    name: 'version empty asset revisions',
    value: { ...BASE_VERSION, assetRevisionRefs: [] },
    expectedCodes: ['empty_asset_revisions'],
    parse: parseDesignVersionV1,
  },

  // ---- parent ref ----------------------------------------------------------
  {
    name: 'version self parent',
    value: { ...BASE_VERSION, parentVersionId: 'dv_invalid_0001' },
    expectedCodes: ['parent_version_self'],
    parse: parseDesignVersionV1,
  },

  // ---- dangling / inconsistent internal refs --------------------------------
  {
    name: 'version editorDocRef designId mismatch',
    value: { ...BASE_VERSION, editorDocRef: { ...BASE_VERSION.editorDocRef, designId: 'dsg_other' } },
    expectedCodes: ['editor_doc_ref_mismatch'],
    parse: parseDesignVersionV1,
  },
  {
    name: 'version editorDocRef revision mismatch',
    value: { ...BASE_VERSION, editorDocRef: { ...BASE_VERSION.editorDocRef, revision: 2 } },
    expectedCodes: ['editor_doc_ref_mismatch'],
    parse: parseDesignVersionV1,
  },

  // ---- published look: structure -------------------------------------------
  {
    name: 'look unknown key',
    value: { ...BASE_LOOK, extraField: 1 },
    expectedCodes: ['unknown_key'],
    parse: parsePublishedLookV1,
  },
  {
    name: 'look duplicate tags',
    value: { ...BASE_LOOK, tags: ['matte', 'matte'] },
    expectedCodes: ['duplicate_tag'],
    parse: parsePublishedLookV1,
  },
  {
    name: 'look empty tag entry',
    value: { ...BASE_LOOK, tags: ['matte', ''] },
    expectedCodes: ['empty_string'],
    parse: parsePublishedLookV1,
  },
  {
    name: 'look duplicate palette',
    value: { ...BASE_LOOK, summaries: { ...BASE_LOOK.summaries, palette: ['COL_INV_01', 'COL_INV_01'] } },
    expectedCodes: ['duplicate_palette'],
    parse: parsePublishedLookV1,
  },
  {
    name: 'look empty palette',
    value: { ...BASE_LOOK, summaries: { ...BASE_LOOK.summaries, palette: [] } },
    expectedCodes: ['empty_palette'],
    parse: parsePublishedLookV1,
  },
  {
    name: 'look empty shape ids',
    value: { ...BASE_LOOK, summaries: { ...BASE_LOOK.summaries, shapeIds: [] } },
    expectedCodes: ['empty_shape_ids'],
    parse: parsePublishedLookV1,
  },
  {
    name: 'look duplicate length id',
    value: { ...BASE_LOOK, summaries: { ...BASE_LOOK.summaries, lengthIds: ['medium', 'medium'] } },
    expectedCodes: ['duplicate_length_id'],
    parse: parsePublishedLookV1,
  },
  {
    name: 'look cover duplicates detail asset',
    value: { ...BASE_LOOK, detailPreviews: [{ ...BASE_LOOK.coverPreview, kind: 'DETAIL' }] },
    expectedCodes: ['duplicate_asset_ref'],
    parse: parsePublishedLookV1,
  },
  {
    name: 'look duplicate detail assets',
    value: {
      ...BASE_LOOK,
      detailPreviews: [
        { ...BASE_LOOK.coverPreview, assetId: 'ast_invalid_detail_0001', kind: 'DETAIL' },
        { ...BASE_LOOK.coverPreview, assetId: 'ast_invalid_detail_0001', kind: 'DETAIL' },
      ],
    },
    expectedCodes: ['duplicate_asset_ref'],
    parse: parsePublishedLookV1,
  },
  {
    name: 'look cover width 0',
    value: { ...BASE_LOOK, coverPreview: { ...BASE_LOOK.coverPreview, width: 0 } },
    expectedCodes: ['invalid_positive_int'],
    parse: parsePublishedLookV1,
  },
  {
    name: 'look cover revision 0',
    value: { ...BASE_LOOK, coverPreview: { ...BASE_LOOK.coverPreview, revision: 0 } },
    expectedCodes: ['invalid_positive_int'],
    parse: parsePublishedLookV1,
  },
  {
    name: 'look cover kind DETAIL',
    value: { ...BASE_LOOK, coverPreview: { ...BASE_LOOK.coverPreview, kind: 'DETAIL' } },
    expectedCodes: ['invalid_enum'],
    parse: parsePublishedLookV1,
  },
  {
    name: 'look preview fidelity invalid',
    value: { ...BASE_LOOK, coverPreview: { ...BASE_LOOK.coverPreview, fidelity: 'SIMULATED' } },
    expectedCodes: ['invalid_enum'],
    parse: parsePublishedLookV1,
  },
  {
    name: 'look preview mime invalid',
    value: { ...BASE_LOOK, coverPreview: { ...BASE_LOOK.coverPreview, mimeType: 'image/gif' } },
    expectedCodes: ['invalid_enum'],
    parse: parsePublishedLookV1,
  },
  {
    name: 'look metadata non-string value',
    value: { ...BASE_LOOK, metadata: { theme: 7 } },
    expectedCodes: ['invalid_type'],
    parse: parsePublishedLookV1,
  },
  {
    name: 'look designVersionId equals lookId',
    value: { ...BASE_LOOK, designVersionId: 'lk_invalid_0001' },
    expectedCodes: ['internal_ref_conflict'],
    parse: parsePublishedLookV1,
  },
  {
    name: 'look remixRelationId equals lookId',
    value: { ...BASE_LOOK, remixRelationId: 'lk_invalid_0001' },
    expectedCodes: ['internal_ref_conflict'],
    parse: parsePublishedLookV1,
  },
  {
    name: 'look malformed createdAt',
    value: { ...BASE_LOOK, createdAt: '2026/08/10 09:30:00' },
    expectedCodes: ['invalid_timestamp'],
    parse: parsePublishedLookV1,
  },
  {
    name: 'look timestamp order (createdAt after updatedAt)',
    value: { ...BASE_LOOK, createdAt: T2, updatedAt: T1 },
    expectedCodes: ['timestamp_order'],
    parse: parsePublishedLookV1,
  },
  {
    name: 'look invalid status enum',
    value: { ...BASE_LOOK, status: 'ARCHIVED' },
    expectedCodes: ['invalid_enum'],
    parse: parsePublishedLookV1,
  },
  {
    name: 'look invalid visibility enum',
    value: { ...BASE_LOOK, visibility: 'FRIENDS_ONLY' },
    expectedCodes: ['invalid_enum'],
    parse: parsePublishedLookV1,
  },

  // ---- publication gate / exposure -----------------------------------------
  {
    name: 'look PUBLIC without publishedAt',
    value: omitKeys(BASE_LOOK, 'publishedAt'),
    expectedCodes: ['missing_field'],
    parse: parsePublishedLookV1,
  },
  {
    name: 'look PUBLISHED (UNLISTED) without publishedAt',
    value: { ...omitKeys(BASE_LOOK, 'publishedAt'), visibility: 'UNLISTED' },
    expectedCodes: ['missing_field'],
    parse: parsePublishedLookV1,
  },
  {
    name: 'look gate clearance missing',
    value: { ...BASE_LOOK, publicationGate: { ...GATE, moderationCleared: false } },
    expectedCodes: ['publication_gate_missing'],
    parse: parsePublishedLookV1,
  },
  {
    name: 'look gate invalid boolean type',
    value: { ...BASE_LOOK, publicationGate: { ...GATE, sourceDeclared: 'yes' } },
    expectedCodes: ['invalid_type'],
    parse: parsePublishedLookV1,
  },
  {
    name: 'look gate unknown key',
    value: { ...BASE_LOOK, publicationGate: { ...GATE, extra: true } },
    expectedCodes: ['unknown_key'],
    parse: parsePublishedLookV1,
  },
  {
    name: 'look gate missing',
    value: omitKeys(BASE_LOOK, 'publicationGate'),
    expectedCodes: ['missing_field'],
    parse: parsePublishedLookV1,
  },
  {
    name: 'look PRIVATE DRAFT with publishedAt',
    value: { ...BASE_LOOK, visibility: 'PRIVATE', status: 'DRAFT' },
    expectedCodes: ['published_at_mismatch'],
    parse: parsePublishedLookV1,
  },
  {
    name: 'look UNLISTED DRAFT with publishedAt',
    value: { ...BASE_LOOK, visibility: 'UNLISTED', status: 'DRAFT' },
    expectedCodes: ['published_at_mismatch'],
    parse: parsePublishedLookV1,
  },
  {
    name: 'look PUBLIC with DRAFT status',
    value: { ...BASE_LOOK, status: 'DRAFT' },
    expectedCodes: ['status_visibility_conflict'],
    parse: parsePublishedLookV1,
  },
  // ---- forbidden private keys ----------------------------------------------
  {
    name: 'look metadata leaks email',
    value: { ...BASE_LOOK, metadata: { email: 'x@example.test' } },
    expectedCodes: ['forbidden_private_key'],
    parse: parsePublishedLookV1,
  },
  {
    name: 'look nested customerId',
    value: { ...BASE_LOOK, metadata: { ref: { customerId: 'cus_1' } } },
    expectedCodes: ['forbidden_private_key', 'invalid_type'],
    parse: parsePublishedLookV1,
  },
  {
    name: 'version leaks customerId',
    value: { ...BASE_VERSION, customerId: 'cus_9' },
    expectedCodes: ['forbidden_private_key', 'unknown_key'],
    parse: parseDesignVersionV1,
  },

  // ---- device / manufacturing fields ---------------------------------------
  {
    name: 'look deviceId field',
    value: { ...BASE_LOOK, deviceId: 'dev_001' },
    expectedCodes: ['device_manufacturing_field', 'unknown_key'],
    parse: parsePublishedLookV1,
  },
  {
    name: 'look nested manufacturingDefinition',
    value: { ...BASE_LOOK, metadata: { mfg: { manufacturingDefinition: 'md_1' } } },
    expectedCodes: ['device_manufacturing_field', 'invalid_type'],
    parse: parsePublishedLookV1,
  },
  {
    name: 'look nested deviceParameters',
    value: { ...BASE_LOOK, metadata: { job: { deviceParameters: { uvPower: 36 } } } },
    expectedCodes: ['device_manufacturing_field', 'invalid_type'],
    parse: parsePublishedLookV1,
  },
  {
    name: 'version waveform field',
    value: { ...BASE_VERSION, waveform: { type: 'UV' } },
    expectedCodes: ['device_manufacturing_field', 'unknown_key'],
    parse: parseDesignVersionV1,
  },

  // ---- remix relation ------------------------------------------------------
  {
    name: 'remix unknown key',
    value: { ...BASE_REMIX, extra: 1 },
    expectedCodes: ['unknown_key'],
    parse: parseRemixRelationV1,
  },
  {
    name: 'remix source equals target',
    value: { ...BASE_REMIX, targetDesignVersionId: 'dv_source_0001' },
    expectedCodes: ['remix_self_target'],
    parse: parseRemixRelationV1,
  },
  {
    name: 'remix malformed relationId',
    value: { ...BASE_REMIX, relationId: 'bad id' },
    expectedCodes: ['invalid_id'],
    parse: parseRemixRelationV1,
  },
  {
    name: 'remix malformed createdAt',
    value: { ...BASE_REMIX, createdAt: 'yesterday' },
    expectedCodes: ['invalid_timestamp'],
    parse: parseRemixRelationV1,
  },

  // ---- cyclic input: must not throw, must not hang --------------------------
  {
    name: 'look cyclic object',
    value: cyclicLook,
    expectedCodes: ['unknown_key'],
    parse: parsePublishedLookV1,
    snapshotSafe: false,
  },
];
