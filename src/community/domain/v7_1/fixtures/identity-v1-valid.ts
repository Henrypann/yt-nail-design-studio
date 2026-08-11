/**
 * Community V7.1 · Deterministic golden VALID fixtures for the identity,
 * visibility, privacy and permission contracts. Each fixture satisfies its
 * strict model type and must parse with zero issues.
 */

import type {
  ConsumerProfileV1,
  CreatorProfileV1,
  IdentityBundleV1,
  IdentityV1,
  NailProfileV1,
  PublicCreatorProfileProjectionV1,
  SalonMembershipV1,
} from '../model.ts';

export const IDENTITY_V1_MINIMAL_FIXTURE = {
  schemaVersion: 1,
  identityId: 'idn_consumer_001',
  roles: ['CONSUMER'],
  handle: 'nail_lyn',
  displayName: 'Lynn',
  createdAt: '2026-08-01T08:00:00.000Z',
  updatedAt: '2026-08-10T09:30:00.000Z',
} satisfies IdentityV1;

/** Identity holding all four unique roles (Consumer, Creator, Salon, Operator). */
export const IDENTITY_V1_FULL_FIXTURE = {
  schemaVersion: 1,
  identityId: 'idn_creator_salon_002',
  roles: ['CONSUMER', 'CREATOR', 'SALON_MEMBER', 'OPERATOR'],
  handle: 'mika_salon',
  displayName: 'Mika Studio',
  avatarUrl: 'https://cdn.example.test/avatars/mika.jpg',
  createdAt: '2026-06-01T08:00:00.000Z',
  updatedAt: '2026-08-11T02:00:00.000Z',
} satisfies IdentityV1;

/** Consumer profile carries private contact data that must never be projected. */
export const CONSUMER_PROFILE_V1_FIXTURE = {
  schemaVersion: 1,
  profileType: 'CONSUMER',
  profileId: 'cp_consumer_003',
  identityId: 'idn_creator_salon_002',
  displayName: 'Mika',
  avatarUrl: 'https://cdn.example.test/avatars/mika.jpg',
  bio: 'Nail art enthusiast',
  customerId: 'cus_9876',
  email: 'mika@example.test',
  phone: '+86-138-0000-0000',
  createdAt: '2026-06-01T08:00:00.000Z',
  updatedAt: '2026-08-11T02:00:00.000Z',
} satisfies ConsumerProfileV1;

/** Creator profile is PUBLIC with declared publicSince and private contact fields. */
export const CREATOR_PROFILE_V1_FIXTURE = {
  schemaVersion: 1,
  profileType: 'CREATOR',
  profileId: 'cp_creator_004',
  identityId: 'idn_creator_salon_002',
  handle: 'mika_salon',
  displayName: 'Mika Studio',
  avatarUrl: 'https://cdn.example.test/avatars/mika.jpg',
  bio: 'Custom press-on nail designer',
  verification: 'VERIFIED',
  visibility: 'PUBLIC',
  publicSince: '2026-08-11T02:00:00.000Z',
  email: 'business@example.test',
  phone: '+86-138-0000-0001',
  createdAt: '2026-06-01T08:00:00.000Z',
  updatedAt: '2026-08-11T02:00:00.000Z',
} satisfies CreatorProfileV1;

export const SALON_MEMBERSHIP_V1_FIXTURE = {
  schemaVersion: 1,
  profileType: 'SALON_MEMBER',
  membershipId: 'sm_member_005',
  identityId: 'idn_creator_salon_002',
  salonId: 'salon_042',
  salonName: 'Mika Nail Lab',
  memberRole: 'OWNER',
  status: 'ACTIVE',
  memberSince: '2026-06-01T08:00:00.000Z',
  createdAt: '2026-06-01T08:00:00.000Z',
  updatedAt: '2026-08-10T09:30:00.000Z',
} satisfies SalonMembershipV1;

/** Nail Profile: PRIVATE by default, references Nail Twin snapshots only. */
export const NAIL_PROFILE_V1_FIXTURE = {
  schemaVersion: 1,
  profileType: 'NAIL',
  nailProfileId: 'np_profile_006',
  identityId: 'idn_creator_salon_002',
  visibility: 'PRIVATE',
  nailTwinSnapshotRefs: ['nts_alpha_1', 'nts_alpha_2'],
  allergyNotes: '无',
  serviceNotes: 'customer prefers matte finish',
  createdAt: '2026-06-01T08:00:00.000Z',
  updatedAt: '2026-08-10T09:30:00.000Z',
} satisfies NailProfileV1;

/** Identity bundle: one identity + separately versioned profiles and memberships. */
export const IDENTITY_BUNDLE_V1_FIXTURE = {
  schemaVersion: 1,
  identity: IDENTITY_V1_FULL_FIXTURE,
  consumerProfile: CONSUMER_PROFILE_V1_FIXTURE,
  creatorProfile: CREATOR_PROFILE_V1_FIXTURE,
  salonMemberships: [SALON_MEMBERSHIP_V1_FIXTURE],
  nailProfile: NAIL_PROFILE_V1_FIXTURE,
} satisfies IdentityBundleV1;

/** The explicit public projection: only public-safe fields, no private data. */
export const PUBLIC_CREATOR_PROFILE_PROJECTION_FIXTURE = {
  schemaVersion: 1,
  projectionType: 'CREATOR_PROFILE',
  identityId: 'idn_creator_salon_002',
  profileId: 'cp_creator_004',
  handle: 'mika_salon',
  displayName: 'Mika Studio',
  avatarUrl: 'https://cdn.example.test/avatars/mika.jpg',
  bio: 'Custom press-on nail designer',
  verification: 'VERIFIED',
  visibility: 'PUBLIC',
  publicSince: '2026-08-11T02:00:00.000Z',
} satisfies PublicCreatorProfileProjectionV1;
