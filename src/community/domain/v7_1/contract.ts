/**
 * Community V7.1 · Runtime contract constants.
 *
 * These are the single source of truth the runtime parsers validate against.
 * The machine-readable artifact `identity-v1.schema.json` must agree with
 * these constants (required fields, allowed keys, `additionalProperties: false`)
 * — the test tool cross-checks both sides.
 */

/** Bound for issue reporting: parsers never grow unbounded lists. */
export const MAX_ISSUES = 200;

export const IDENTITY_V1_REQUIRED_FIELDS: readonly string[] = [
  'schemaVersion',
  'identityId',
  'roles',
  'handle',
  'displayName',
  'createdAt',
  'updatedAt',
];
export const IDENTITY_V1_ALLOWED_KEYS: readonly string[] = [...IDENTITY_V1_REQUIRED_FIELDS, 'avatarUrl'];

export const CONSUMER_PROFILE_V1_REQUIRED_FIELDS: readonly string[] = [
  'schemaVersion',
  'profileType',
  'profileId',
  'identityId',
  'displayName',
  'createdAt',
  'updatedAt',
];
export const CONSUMER_PROFILE_V1_ALLOWED_KEYS: readonly string[] = [
  ...CONSUMER_PROFILE_V1_REQUIRED_FIELDS,
  'avatarUrl',
  'bio',
  'customerId',
  'email',
  'phone',
];

export const CREATOR_PROFILE_V1_REQUIRED_FIELDS: readonly string[] = [
  'schemaVersion',
  'profileType',
  'profileId',
  'identityId',
  'handle',
  'displayName',
  'verification',
  'visibility',
  'createdAt',
  'updatedAt',
];
export const CREATOR_PROFILE_V1_ALLOWED_KEYS: readonly string[] = [
  ...CREATOR_PROFILE_V1_REQUIRED_FIELDS,
  'avatarUrl',
  'bio',
  'publicSince',
  'email',
  'phone',
];

export const SALON_MEMBERSHIP_V1_REQUIRED_FIELDS: readonly string[] = [
  'schemaVersion',
  'profileType',
  'membershipId',
  'identityId',
  'salonId',
  'memberRole',
  'status',
  'memberSince',
  'createdAt',
  'updatedAt',
];
export const SALON_MEMBERSHIP_V1_ALLOWED_KEYS: readonly string[] = [
  ...SALON_MEMBERSHIP_V1_REQUIRED_FIELDS,
  'salonName',
];

export const NAIL_PROFILE_V1_REQUIRED_FIELDS: readonly string[] = [
  'schemaVersion',
  'profileType',
  'nailProfileId',
  'identityId',
  'visibility',
  'createdAt',
  'updatedAt',
];
export const NAIL_PROFILE_V1_ALLOWED_KEYS: readonly string[] = [
  ...NAIL_PROFILE_V1_REQUIRED_FIELDS,
  'nailTwinSnapshotRefs',
  'allergyNotes',
  'serviceNotes',
];

export const PUBLIC_CREATOR_PROFILE_V1_REQUIRED_FIELDS: readonly string[] = [
  'schemaVersion',
  'projectionType',
  'identityId',
  'profileId',
  'handle',
  'displayName',
  'verification',
  'visibility',
  'publicSince',
];
export const PUBLIC_CREATOR_PROFILE_V1_ALLOWED_KEYS: readonly string[] = [
  ...PUBLIC_CREATOR_PROFILE_V1_REQUIRED_FIELDS,
  'avatarUrl',
  'bio',
];

export const IDENTITY_BUNDLE_V1_REQUIRED_FIELDS: readonly string[] = ['schemaVersion', 'identity'];
export const IDENTITY_BUNDLE_V1_ALLOWED_KEYS: readonly string[] = [
  ...IDENTITY_BUNDLE_V1_REQUIRED_FIELDS,
  'consumerProfile',
  'creatorProfile',
  'salonMemberships',
  'nailProfile',
];

export const PUBLIC_TRANSITION_PREREQUISITES_REQUIRED_FIELDS: readonly string[] = [
  'copyrightDeclared',
  'sourceDeclared',
  'moderationCleared',
];
export const PUBLIC_TRANSITION_PREREQUISITES_ALLOWED_KEYS: readonly string[] =
  PUBLIC_TRANSITION_PREREQUISITES_REQUIRED_FIELDS;

/**
 * Keys that must never appear in any public projection or public content,
 * matched case-insensitively at any nesting depth: customer primary keys,
 * raw nail geometry, allergy/service notes, contact fields, credentials.
 */
export const FORBIDDEN_PRIVATE_KEYS: readonly string[] = [
  'customerid',
  'email',
  'phone',
  'phonenumber',
  'mobile',
  'allergynotes',
  'allergies',
  'servicenotes',
  'customernotes',
  'customerphoto',
  'customerphotos',
  'rawcustomerphoto',
  'rawnailgeometry',
  'rawgeometry',
  'scandata',
  'nailtwinsnapshot',
  'nailtwinsnapshotrefs',
  'credential',
  'credentials',
  'password',
  'passphrase',
  'accesstoken',
  'refreshtoken',
  'apikey',
  'secret',
  'privatekey',
];
