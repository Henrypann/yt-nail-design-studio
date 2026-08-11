/**
 * Community V7.1 · Deterministic golden INVALID fixtures.
 *
 * Each fixture must be rejected by its parser and must emit every code listed
 * in `expectedCodes` with a stable issue path. Parsers must never throw and
 * must never mutate the input (except cyclic fixtures, marked snapshotSafe false).
 */

import {
  parseConsumerProfileV1,
  parseCreatorProfileV1,
  parseIdentityBundleV1,
  parseIdentityV1,
  parseNailProfileV1,
  parsePublicCreatorProfileProjectionV1,
  parseSalonMembershipV1,
} from '../parse.ts';

export interface IdentityV1InvalidFixture {
  name: string;
  value: unknown;
  expectedCodes: readonly string[];
  parse: (input: unknown) => { ok: boolean; issues?: Array<{ code: string; path: string; message: string }> };
  /** Cyclic inputs cannot be JSON-snapshotted; default true. */
  snapshotSafe?: boolean;
}

const T1 = '2026-08-01T08:00:00.000Z';
const T2 = '2026-08-10T09:30:00.000Z';

const BASE_IDENTITY = {
  schemaVersion: 1,
  identityId: 'idn_invalid_001',
  roles: ['CONSUMER'],
  handle: 'inv',
  displayName: 'Invalid',
  createdAt: T1,
  updatedAt: T2,
};

const BASE_CONSUMER = {
  schemaVersion: 1,
  profileType: 'CONSUMER',
  profileId: 'cp_inv_001',
  identityId: 'idn_invalid_001',
  displayName: 'C',
  createdAt: T1,
  updatedAt: T2,
};

const BASE_CREATOR = {
  schemaVersion: 1,
  profileType: 'CREATOR',
  profileId: 'cp_inv_002',
  identityId: 'idn_invalid_001',
  handle: 'inv_creator',
  displayName: 'Creator',
  verification: 'NONE',
  visibility: 'PRIVATE',
  createdAt: T1,
  updatedAt: T2,
};

const BASE_NAIL = {
  schemaVersion: 1,
  profileType: 'NAIL',
  nailProfileId: 'np_inv_001',
  identityId: 'idn_invalid_001',
  visibility: 'PRIVATE',
  createdAt: T1,
  updatedAt: T2,
};

const BASE_PROJECTION = {
  schemaVersion: 1,
  projectionType: 'CREATOR_PROFILE',
  identityId: 'idn_invalid_001',
  profileId: 'cp_inv_002',
  handle: 'inv_creator',
  displayName: 'Creator',
  verification: 'NONE',
  visibility: 'PUBLIC',
  publicSince: '2026-08-10T09:30:00.000Z',
};

const cyclicProjection: Record<string, unknown> = { ...BASE_PROJECTION };
cyclicProjection.self = cyclicProjection;

export const IDENTITY_V1_INVALID_FIXTURES: readonly IdentityV1InvalidFixture[] = [
  // ---- not an object -------------------------------------------------------
  { name: 'identity null', value: null, expectedCodes: ['not_an_object'], parse: parseIdentityV1 },
  { name: 'identity number', value: 42, expectedCodes: ['not_an_object'], parse: parseIdentityV1 },
  { name: 'identity string', value: 'identity', expectedCodes: ['not_an_object'], parse: parseIdentityV1 },
  { name: 'identity array', value: [], expectedCodes: ['not_an_object'], parse: parseIdentityV1 },
  { name: 'identity undefined', value: undefined, expectedCodes: ['not_an_object'], parse: parseIdentityV1 },
  { name: 'identity symbol', value: Symbol('idn'), expectedCodes: ['not_an_object'], parse: parseIdentityV1 },

  // ---- schema version ------------------------------------------------------
  {
    name: 'identity wrong schemaVersion',
    value: { ...BASE_IDENTITY, schemaVersion: 2 },
    expectedCodes: ['schema_version'],
    parse: parseIdentityV1,
  },
  {
    name: 'bundle wrong schemaVersion',
    value: { schemaVersion: 9, identity: BASE_IDENTITY },
    expectedCodes: ['schema_version'],
    parse: parseIdentityBundleV1,
  },

  // ---- unknown keys --------------------------------------------------------
  {
    name: 'identity unknown key',
    value: { ...BASE_IDENTITY, extraField: 1 },
    expectedCodes: ['unknown_key'],
    parse: parseIdentityV1,
  },

  // ---- malformed ids / timestamps -----------------------------------------
  {
    name: 'identity malformed id (space + bang)',
    value: { ...BASE_IDENTITY, identityId: 'bad id!' },
    expectedCodes: ['invalid_id'],
    parse: parseIdentityV1,
  },
  {
    name: 'identity empty id',
    value: { ...BASE_IDENTITY, identityId: '' },
    expectedCodes: ['invalid_id'],
    parse: parseIdentityV1,
  },
  {
    name: 'identity malformed timestamp',
    value: { ...BASE_IDENTITY, createdAt: '2026/08/01 08:00:00' },
    expectedCodes: ['invalid_timestamp'],
    parse: parseIdentityV1,
  },
  {
    name: 'identity impossible timestamp',
    value: { ...BASE_IDENTITY, createdAt: '2026-99-99T08:00:00.000Z' },
    expectedCodes: ['invalid_timestamp'],
    parse: parseIdentityV1,
  },
  {
    name: 'identity timestamp order (createdAt after updatedAt)',
    value: { ...BASE_IDENTITY, createdAt: T2, updatedAt: T1 },
    expectedCodes: ['timestamp_order'],
    parse: parseIdentityV1,
  },

  // ---- roles ---------------------------------------------------------------
  {
    name: 'identity duplicate roles',
    value: { ...BASE_IDENTITY, roles: ['CONSUMER', 'CONSUMER'] },
    expectedCodes: ['duplicate_role'],
    parse: parseIdentityV1,
  },
  {
    name: 'identity invalid role enum',
    value: { ...BASE_IDENTITY, roles: ['ADMIN'] },
    expectedCodes: ['invalid_enum'],
    parse: parseIdentityV1,
  },
  {
    name: 'identity empty roles',
    value: { ...BASE_IDENTITY, roles: [] },
    expectedCodes: ['empty_roles'],
    parse: parseIdentityV1,
  },
  {
    name: 'identity roles not an array',
    value: { ...BASE_IDENTITY, roles: 'CONSUMER' },
    expectedCodes: ['invalid_type'],
    parse: parseIdentityV1,
  },
  {
    name: 'identity roles with non-string item',
    value: { ...BASE_IDENTITY, roles: ['CONSUMER', 7] },
    expectedCodes: ['invalid_type'],
    parse: parseIdentityV1,
  },

  // ---- missing / blank fields ---------------------------------------------
  {
    name: 'identity missing roles',
    value: {
      schemaVersion: 1,
      identityId: 'idn_invalid_002',
      handle: 'h',
      displayName: 'd',
      createdAt: T1,
      updatedAt: T2,
    },
    expectedCodes: ['missing_field'],
    parse: parseIdentityV1,
  },
  {
    name: 'identity missing handle',
    value: {
      schemaVersion: 1,
      identityId: 'idn_invalid_002',
      roles: ['CONSUMER'],
      displayName: 'd',
      createdAt: T1,
      updatedAt: T2,
    },
    expectedCodes: ['missing_field'],
    parse: parseIdentityV1,
  },
  {
    name: 'identity blank handle',
    value: { ...BASE_IDENTITY, handle: '' },
    expectedCodes: ['empty_string'],
    parse: parseIdentityV1,
  },

  // ---- cross-identity mismatch ---------------------------------------------
  {
    name: 'bundle consumer profile belongs to another identity',
    value: { schemaVersion: 1, identity: BASE_IDENTITY, consumerProfile: { ...BASE_CONSUMER, identityId: 'idn_someone_else' } },
    expectedCodes: ['profile_identity_mismatch'],
    parse: parseIdentityBundleV1,
  },
  {
    name: 'bundle creator profile belongs to another identity',
    value: { schemaVersion: 1, identity: BASE_IDENTITY, creatorProfile: { ...BASE_CREATOR, identityId: 'idn_someone_else' } },
    expectedCodes: ['profile_identity_mismatch'],
    parse: parseIdentityBundleV1,
  },
  {
    name: 'bundle nested identity wrong schemaVersion',
    value: { schemaVersion: 1, identity: { ...BASE_IDENTITY, schemaVersion: 2 } },
    expectedCodes: ['schema_version'],
    parse: parseIdentityBundleV1,
  },
  {
    name: 'bundle creator profile without creator role',
    value: { schemaVersion: 1, identity: BASE_IDENTITY, creatorProfile: BASE_CREATOR },
    expectedCodes: ['profile_role_mismatch'],
    parse: parseIdentityBundleV1,
  },
  {
    name: 'bundle salon membership belongs to another identity',
    value: {
      schemaVersion: 1,
      identity: { ...BASE_IDENTITY, roles: ['CONSUMER', 'SALON_MEMBER'] },
      salonMemberships: [{
        schemaVersion: 1,
        profileType: 'SALON_MEMBER',
        membershipId: 'sm_inv_mismatch',
        identityId: 'idn_someone_else',
        salonId: 'salon_001',
        memberRole: 'NAIL_TECH',
        status: 'ACTIVE',
        memberSince: T1,
        createdAt: T1,
        updatedAt: T2,
      }],
    },
    expectedCodes: ['profile_identity_mismatch'],
    parse: parseIdentityBundleV1,
  },
  {
    name: 'bundle duplicate salon membership',
    value: {
      schemaVersion: 1,
      identity: { ...BASE_IDENTITY, roles: ['CONSUMER', 'SALON_MEMBER'] },
      salonMemberships: [
        {
          schemaVersion: 1,
          profileType: 'SALON_MEMBER',
          membershipId: 'sm_inv_duplicate',
          identityId: 'idn_invalid_001',
          salonId: 'salon_001',
          memberRole: 'NAIL_TECH',
          status: 'ACTIVE',
          memberSince: T1,
          createdAt: T1,
          updatedAt: T2,
        },
        {
          schemaVersion: 1,
          profileType: 'SALON_MEMBER',
          membershipId: 'sm_inv_duplicate',
          identityId: 'idn_invalid_001',
          salonId: 'salon_002',
          memberRole: 'STAFF',
          status: 'ACTIVE',
          memberSince: T1,
          createdAt: T1,
          updatedAt: T2,
        },
      ],
    },
    expectedCodes: ['duplicate_membership'],
    parse: parseIdentityBundleV1,
  },
  {
    name: 'bundle missing identity',
    value: { schemaVersion: 1, consumerProfile: BASE_CONSUMER },
    expectedCodes: ['missing_field'],
    parse: parseIdentityBundleV1,
  },

  // ---- non-private Nail Profile ---------------------------------------------
  {
    name: 'nail profile UNLISTED',
    value: { ...BASE_NAIL, visibility: 'UNLISTED' },
    expectedCodes: ['nail_profile_not_private'],
    parse: parseNailProfileV1,
  },
  {
    name: 'nail profile PUBLIC',
    value: { ...BASE_NAIL, visibility: 'PUBLIC' },
    expectedCodes: ['nail_profile_not_private'],
    parse: parseNailProfileV1,
  },
  {
    name: 'nail profile invalid visibility',
    value: { ...BASE_NAIL, visibility: 'FRIENDS_ONLY' },
    expectedCodes: ['invalid_enum'],
    parse: parseNailProfileV1,
  },

  // ---- creator publicSince consistency -------------------------------------
  {
    name: 'creator PUBLIC without publicSince',
    value: { ...BASE_CREATOR, visibility: 'PUBLIC' },
    expectedCodes: ['missing_field'],
    parse: parseCreatorProfileV1,
  },
  {
    name: 'creator PRIVATE with publicSince',
    value: { ...BASE_CREATOR, publicSince: '2026-08-10T09:30:00.000Z' },
    expectedCodes: ['public_since_mismatch'],
    parse: parseCreatorProfileV1,
  },

  // ---- profile enums ---------------------------------------------------------
  {
    name: 'consumer wrong profileType',
    value: { ...BASE_CONSUMER, profileType: 'CREATOR' },
    expectedCodes: ['invalid_enum'],
    parse: parseConsumerProfileV1,
  },
  {
    name: 'creator invalid verification',
    value: { ...BASE_CREATOR, verification: 'GOD' },
    expectedCodes: ['invalid_enum'],
    parse: parseCreatorProfileV1,
  },
  {
    name: 'salon membership invalid status',
    value: {
      schemaVersion: 1,
      profileType: 'SALON_MEMBER',
      membershipId: 'sm_inv_001',
      identityId: 'idn_invalid_001',
      salonId: 'salon_001',
      memberRole: 'NAIL_TECH',
      status: 'FIRED',
      memberSince: T1,
      createdAt: T1,
      updatedAt: T2,
    },
    expectedCodes: ['invalid_enum'],
    parse: parseSalonMembershipV1,
  },

  // ---- leaked forbidden private keys in public projection --------------------
  {
    name: 'projection leaks email',
    value: { ...BASE_PROJECTION, email: 'x@example.test' },
    expectedCodes: ['forbidden_private_key'],
    parse: parsePublicCreatorProfileProjectionV1,
  },
  {
    name: 'projection leaks customerId',
    value: { ...BASE_PROJECTION, customerId: 'cus_1' },
    expectedCodes: ['forbidden_private_key'],
    parse: parsePublicCreatorProfileProjectionV1,
  },
  {
    name: 'projection leaks nested raw nail geometry',
    value: { ...BASE_PROJECTION, extra: { rawNailGeometry: 'raw-mesh' } },
    expectedCodes: ['forbidden_private_key', 'public_projection_extra_field'],
    parse: parsePublicCreatorProfileProjectionV1,
  },
  {
    name: 'projection leaks allergy notes',
    value: { ...BASE_PROJECTION, allergyNotes: 'latex' },
    expectedCodes: ['forbidden_private_key'],
    parse: parsePublicCreatorProfileProjectionV1,
  },

  // ---- public projection extra fields ---------------------------------------
  {
    name: 'projection extra unknown field',
    value: { ...BASE_PROJECTION, sponsorBadge: 'gold' },
    expectedCodes: ['public_projection_extra_field'],
    parse: parsePublicCreatorProfileProjectionV1,
  },
  {
    name: 'projection missing publicSince',
    value: {
      schemaVersion: 1,
      projectionType: 'CREATOR_PROFILE',
      identityId: 'idn_invalid_001',
      profileId: 'cp_inv_002',
      handle: 'h',
      displayName: 'd',
      verification: 'NONE',
      visibility: 'PUBLIC',
    },
    expectedCodes: ['missing_field'],
    parse: parsePublicCreatorProfileProjectionV1,
  },
  {
    name: 'projection wrong projectionType',
    value: { ...BASE_PROJECTION, projectionType: 'BRAND' },
    expectedCodes: ['invalid_enum'],
    parse: parsePublicCreatorProfileProjectionV1,
  },
  {
    name: 'projection visibility not PUBLIC',
    value: { ...BASE_PROJECTION, visibility: 'UNLISTED' },
    expectedCodes: ['invalid_enum'],
    parse: parsePublicCreatorProfileProjectionV1,
  },

  // ---- cyclic input: must not throw, must not hang ----------------------------
  {
    name: 'projection cyclic object',
    value: cyclicProjection,
    expectedCodes: ['public_projection_extra_field'],
    parse: parsePublicCreatorProfileProjectionV1,
    snapshotSafe: false,
  },
];
