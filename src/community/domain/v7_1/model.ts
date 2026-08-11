/**
 * Community V7.1 · GEN-V7.1-01 Identity, Visibility, Privacy & Permission — model types.
 *
 * One identity may hold Consumer, Creator, Salon Membership and Operator roles.
 * Each profile contract is separately typed and versioned with its own
 * `schemaVersion: 1` (V7.1 is the architecture baseline, not the schema version).
 *
 * Nail Profile is private by default and must never become PUBLIC. Public
 * projections must never leak customer primary keys, raw nail geometry,
 * allergy/service notes, email, phone, or credentials.
 */

export const IDENTITY_ROLE_IDS = ['CONSUMER', 'CREATOR', 'SALON_MEMBER', 'OPERATOR'] as const;
export type IdentityRoleId = (typeof IDENTITY_ROLE_IDS)[number];

export const VISIBILITY_V1 = ['PRIVATE', 'UNLISTED', 'PUBLIC'] as const;
export type VisibilityV1 = (typeof VISIBILITY_V1)[number];

export const CREATOR_VERIFICATION_V1 = ['NONE', 'VERIFIED'] as const;
export type CreatorVerificationV1 = (typeof CREATOR_VERIFICATION_V1)[number];

export const SALON_MEMBER_ROLE_V1 = ['OWNER', 'NAIL_TECH', 'STAFF'] as const;
export type SalonMemberRoleV1 = (typeof SALON_MEMBER_ROLE_V1)[number];

export const SALON_MEMBERSHIP_STATUS_V1 = ['ACTIVE', 'INACTIVE', 'SUSPENDED'] as const;
export type SalonMembershipStatusV1 = (typeof SALON_MEMBERSHIP_STATUS_V1)[number];

export const ACTOR_PERMISSIONS_V1 = ['OWNER', 'OPERATOR', 'VIEWER'] as const;
export type ActorPermissionV1 = (typeof ACTOR_PERMISSIONS_V1)[number];

/** Identity: the account-level anchor that can hold multiple unique roles. */
export interface IdentityV1 {
  schemaVersion: 1;
  identityId: string;
  /** Unique role ids; at least one. An identity may hold all four. */
  roles: IdentityRoleId[];
  handle: string;
  displayName: string;
  avatarUrl?: string;
  createdAt: string;
  updatedAt: string;
}

/** Consumer profile. Private by design; never projected publicly. */
export interface ConsumerProfileV1 {
  schemaVersion: 1;
  profileType: 'CONSUMER';
  profileId: string;
  identityId: string;
  displayName: string;
  avatarUrl?: string;
  bio?: string;
  /** Private: customer primary key reference. Never projected publicly. */
  customerId?: string;
  /** Private contact fields. Never projected publicly. */
  email?: string;
  phone?: string;
  createdAt: string;
  updatedAt: string;
}

/** Creator profile. Publishes via the explicit PUBLIC projection only. */
export interface CreatorProfileV1 {
  schemaVersion: 1;
  profileType: 'CREATOR';
  profileId: string;
  identityId: string;
  handle: string;
  displayName: string;
  avatarUrl?: string;
  bio?: string;
  verification: CreatorVerificationV1;
  /** Default is PRIVATE; PUBLIC requires actor permission + declared prerequisites. */
  visibility: VisibilityV1;
  /** Required when visibility === PUBLIC. */
  publicSince?: string;
  /** Private contact fields; stripped by the public projection. */
  email?: string;
  phone?: string;
  createdAt: string;
  updatedAt: string;
}

/** Salon membership. Private; never projected publicly. */
export interface SalonMembershipV1 {
  schemaVersion: 1;
  profileType: 'SALON_MEMBER';
  membershipId: string;
  identityId: string;
  salonId: string;
  salonName?: string;
  memberRole: SalonMemberRoleV1;
  status: SalonMembershipStatusV1;
  memberSince: string;
  createdAt: string;
  updatedAt: string;
}

/** Nail Profile. Private by default and must stay PRIVATE. */
export interface NailProfileV1 {
  schemaVersion: 1;
  profileType: 'NAIL';
  nailProfileId: string;
  identityId: string;
  visibility: 'PRIVATE';
  /** References to Nail Twin snapshots — never raw nail geometry. */
  nailTwinSnapshotRefs?: string[];
  /** Private service/allergy notes. Never projected publicly. */
  allergyNotes?: string;
  serviceNotes?: string;
  createdAt: string;
  updatedAt: string;
}

/** Declared prerequisites for transitioning to PUBLIC. */
export interface PublicTransitionPrerequisitesV1 {
  copyrightDeclared: boolean;
  sourceDeclared: boolean;
  moderationCleared: boolean;
}

/**
 * Explicit public profile projection: the ONLY shape public consumers may see.
 * Contains public-safe fields only — no customer keys, geometry, notes,
 * contact fields, or credentials.
 */
export interface PublicCreatorProfileProjectionV1 {
  schemaVersion: 1;
  projectionType: 'CREATOR_PROFILE';
  identityId: string;
  profileId: string;
  handle: string;
  displayName: string;
  avatarUrl?: string;
  bio?: string;
  verification: CreatorVerificationV1;
  visibility: 'PUBLIC';
  publicSince: string;
}

/** Identity with its separately versioned profiles, all bound to one identity. */
export interface IdentityBundleV1 {
  schemaVersion: 1;
  identity: IdentityV1;
  consumerProfile?: ConsumerProfileV1;
  creatorProfile?: CreatorProfileV1;
  /** One account may work for more than one salon; memberships stay independent. */
  salonMemberships?: SalonMembershipV1[];
  nailProfile?: NailProfileV1;
}
