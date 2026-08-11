/**
 * Community V7.1 · Strict runtime parsers and validators (dependency-free).
 *
 * Every `parse*` function:
 *  - never throws, even for null / primitives / arrays / symbols / bigints /
 *    cyclic objects / deeply malformed input;
 *  - never mutates its input (successful parses return the input object as-is);
 *  - reports bounded issues (at most MAX_ISSUES) with stable code + path.
 *
 * Rejections include: unknown keys, malformed ids/timestamps/roles, duplicate
 * or empty roles, cross-identity profile mismatch, non-private NailProfile,
 * leaked forbidden private keys, and extra fields on the public projection.
 */

import {
  CREATOR_VERIFICATION_V1,
  IDENTITY_ROLE_IDS,
  SALON_MEMBER_ROLE_V1,
  SALON_MEMBERSHIP_STATUS_V1,
  VISIBILITY_V1,
  type ConsumerProfileV1,
  type CreatorProfileV1,
  type IdentityBundleV1,
  type IdentityV1,
  type NailProfileV1,
  type PublicCreatorProfileProjectionV1,
  type PublicTransitionPrerequisitesV1,
  type SalonMembershipV1,
  type VisibilityV1,
} from './model.ts';
import {
  CONSUMER_PROFILE_V1_ALLOWED_KEYS,
  CREATOR_PROFILE_V1_ALLOWED_KEYS,
  IDENTITY_BUNDLE_V1_ALLOWED_KEYS,
  IDENTITY_V1_ALLOWED_KEYS,
  MAX_ISSUES,
  NAIL_PROFILE_V1_ALLOWED_KEYS,
  PUBLIC_CREATOR_PROFILE_V1_ALLOWED_KEYS,
  PUBLIC_TRANSITION_PREREQUISITES_ALLOWED_KEYS,
  SALON_MEMBERSHIP_V1_ALLOWED_KEYS,
} from './contract.ts';
import { isForbiddenPrivateKey, scanForbiddenPrivateKeys } from './privacy.ts';

export type IdentityV1IssueCode =
  | 'not_an_object'
  | 'schema_version'
  | 'unknown_key'
  | 'missing_field'
  | 'invalid_type'
  | 'invalid_enum'
  | 'empty_string'
  | 'invalid_id'
  | 'invalid_timestamp'
  | 'timestamp_order'
  | 'empty_roles'
  | 'duplicate_role'
  | 'duplicate_membership'
  | 'empty_memberships'
  | 'profile_identity_mismatch'
  | 'profile_role_mismatch'
  | 'nail_profile_not_private'
  | 'forbidden_private_key'
  | 'public_projection_extra_field'
  | 'public_since_mismatch';

export interface IdentityV1Issue {
  code: IdentityV1IssueCode;
  path: string;
  message: string;
}

export type IdentityV1ParseResult<T> =
  | { ok: true; value: T }
  | { ok: false; reason: string; issues: IdentityV1Issue[] };

type UnknownRecord = Record<string, unknown>;

const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const ISO_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;

function record(value: unknown): UnknownRecord | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as UnknownRecord)
    : null;
}

function describe(value: unknown): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  const type = typeof value;
  if (type === 'object') return 'object';
  return type;
}

function addIssue(
  issues: IdentityV1Issue[],
  code: IdentityV1IssueCode,
  path: string,
  message: string,
): void {
  if (issues.length < MAX_ISSUES) issues.push({ code, path, message });
}

function failResult(
  issues: IdentityV1Issue[],
  code: IdentityV1IssueCode,
  path: string,
  message: string,
): IdentityV1ParseResult<never> {
  addIssue(issues, code, path, message);
  return { ok: false, reason: message, issues };
}

function checkSchemaVersion(raw: UnknownRecord, path: string, issues: IdentityV1Issue[]): void {
  const value = raw['schemaVersion'];
  if (value === undefined) {
    addIssue(issues, 'missing_field', `${path}.schemaVersion`, 'missing required field "schemaVersion"');
  } else if (value !== 1) {
    addIssue(issues, 'schema_version', `${path}.schemaVersion`, `expected schemaVersion 1, got ${String(value)}`);
  }
}

function checkKeys(
  raw: UnknownRecord,
  allowedKeys: readonly string[],
  path: string,
  issues: IdentityV1Issue[],
): void {
  for (const key of Object.keys(raw)) {
    if (!allowedKeys.includes(key)) {
      addIssue(issues, 'unknown_key', `${path}.${key}`, `unknown key "${key}" is not part of the contract`);
    }
  }
}

function readString(
  raw: UnknownRecord,
  key: string,
  path: string,
  issues: IdentityV1Issue[],
  required: boolean,
): string | undefined {
  const value = raw[key];
  if (value === undefined) {
    if (required) addIssue(issues, 'missing_field', `${path}.${key}`, `missing required field "${key}"`);
    return undefined;
  }
  if (typeof value !== 'string') {
    addIssue(issues, 'invalid_type', `${path}.${key}`, `expected string, got ${describe(value)}`);
    return undefined;
  }
  if (required && value.length === 0) {
    addIssue(issues, 'empty_string', `${path}.${key}`, `field "${key}" must not be empty`);
  }
  return value;
}

function readOptionalString(
  raw: UnknownRecord,
  key: string,
  path: string,
  issues: IdentityV1Issue[],
): string | undefined {
  return readString(raw, key, path, issues, false);
}

function readId(
  raw: UnknownRecord,
  key: string,
  path: string,
  issues: IdentityV1Issue[],
  required: boolean,
): string | undefined {
  const value = readString(raw, key, path, issues, required);
  if (value !== undefined && !ID_PATTERN.test(value)) {
    addIssue(issues, 'invalid_id', `${path}.${key}`, `invalid id "${value}"`);
  }
  return value;
}

function readTimestamp(
  raw: UnknownRecord,
  key: string,
  path: string,
  issues: IdentityV1Issue[],
  required: boolean,
): string | undefined {
  const value = readString(raw, key, path, issues, required);
  if (
    value !== undefined &&
    (!ISO_PATTERN.test(value) || Number.isNaN(Date.parse(value)))
  ) {
    addIssue(issues, 'invalid_timestamp', `${path}.${key}`, `invalid ISO-8601 UTC timestamp "${value}"`);
  }
  return value;
}

function readEnum(
  raw: UnknownRecord,
  key: string,
  allowed: readonly string[],
  path: string,
  issues: IdentityV1Issue[],
  required: boolean,
): string | undefined {
  const value = readString(raw, key, path, issues, required);
  if (value !== undefined && !allowed.includes(value)) {
    addIssue(issues, 'invalid_enum', `${path}.${key}`, `invalid value "${value}" for "${key}"`);
  }
  return value;
}

function readBoolean(
  raw: UnknownRecord,
  key: string,
  path: string,
  issues: IdentityV1Issue[],
  required: boolean,
): boolean | undefined {
  const value = raw[key];
  if (value === undefined) {
    if (required) addIssue(issues, 'missing_field', `${path}.${key}`, `missing required field "${key}"`);
    return undefined;
  }
  if (typeof value !== 'boolean') {
    addIssue(issues, 'invalid_type', `${path}.${key}`, `expected boolean, got ${describe(value)}`);
    return undefined;
  }
  return value;
}

function readVisibility(
  raw: UnknownRecord,
  path: string,
  issues: IdentityV1Issue[],
  required: boolean,
): VisibilityV1 | undefined {
  const value = readEnum(raw, 'visibility', VISIBILITY_V1, path, issues, required);
  return value as VisibilityV1 | undefined;
}

function readRoles(raw: UnknownRecord, path: string, issues: IdentityV1Issue[]): void {
  const value = raw['roles'];
  if (value === undefined) {
    addIssue(issues, 'missing_field', `${path}.roles`, 'missing required field "roles"');
    return;
  }
  if (!Array.isArray(value)) {
    addIssue(issues, 'invalid_type', `${path}.roles`, `expected array of role ids, got ${describe(value)}`);
    return;
  }
  if (value.length === 0) {
    addIssue(issues, 'empty_roles', `${path}.roles`, 'identity must hold at least one role');
  }
  const seen = new Set<string>();
  for (let i = 0; i < value.length; i += 1) {
    const item = value[i];
    const itemPath = `${path}.roles[${i}]`;
    if (typeof item !== 'string') {
      addIssue(issues, 'invalid_type', itemPath, `expected string role id, got ${describe(item)}`);
      continue;
    }
    if (!IDENTITY_ROLE_IDS.includes(item as (typeof IDENTITY_ROLE_IDS)[number])) {
      addIssue(issues, 'invalid_enum', itemPath, `invalid role "${item}"`);
      continue;
    }
    if (seen.has(item)) {
      addIssue(issues, 'duplicate_role', itemPath, `duplicate role "${item}"`);
      continue;
    }
    seen.add(item);
  }
}

function readIdArray(
  raw: UnknownRecord,
  key: string,
  path: string,
  issues: IdentityV1Issue[],
  required: boolean,
): string[] | undefined {
  const value = raw[key];
  if (value === undefined) {
    if (required) addIssue(issues, 'missing_field', `${path}.${key}`, `missing required field "${key}"`);
    return undefined;
  }
  if (!Array.isArray(value)) {
    addIssue(issues, 'invalid_type', `${path}.${key}`, `expected array, got ${describe(value)}`);
    return undefined;
  }
  for (let i = 0; i < value.length; i += 1) {
    const item = value[i];
    const itemPath = `${path}.${key}[${i}]`;
    if (typeof item !== 'string') {
      addIssue(issues, 'invalid_type', itemPath, `expected string id, got ${describe(item)}`);
    } else if (!ID_PATTERN.test(item)) {
      addIssue(issues, 'invalid_id', itemPath, `invalid id "${item}"`);
    }
  }
  return value as string[];
}

function checkTimestampOrder(
  raw: UnknownRecord,
  path: string,
  issues: IdentityV1Issue[],
): void {
  const createdAt = readTimestamp(raw, 'createdAt', path, issues, true);
  const updatedAt = readTimestamp(raw, 'updatedAt', path, issues, true);
  if (createdAt !== undefined && updatedAt !== undefined && createdAt > updatedAt) {
    addIssue(
      issues,
      'timestamp_order',
      `${path}.createdAt`,
      `createdAt must not be after updatedAt (${createdAt} > ${updatedAt})`,
    );
  }
}

function parseIdentityCore(raw: UnknownRecord, path: string, issues: IdentityV1Issue[]): void {
  checkKeys(raw, IDENTITY_V1_ALLOWED_KEYS, path, issues);
  readId(raw, 'identityId', path, issues, true);
  readRoles(raw, path, issues);
  readString(raw, 'handle', path, issues, true);
  readString(raw, 'displayName', path, issues, true);
  readOptionalString(raw, 'avatarUrl', path, issues);
  checkTimestampOrder(raw, path, issues);
}

function parseConsumerProfileCore(raw: UnknownRecord, path: string, issues: IdentityV1Issue[]): void {
  checkKeys(raw, CONSUMER_PROFILE_V1_ALLOWED_KEYS, path, issues);
  checkSchemaVersion(raw, path, issues);
  readEnum(raw, 'profileType', ['CONSUMER'], path, issues, true);
  readId(raw, 'profileId', path, issues, true);
  readId(raw, 'identityId', path, issues, true);
  readString(raw, 'displayName', path, issues, true);
  readOptionalString(raw, 'avatarUrl', path, issues);
  readOptionalString(raw, 'bio', path, issues);
  readOptionalString(raw, 'customerId', path, issues);
  readOptionalString(raw, 'email', path, issues);
  readOptionalString(raw, 'phone', path, issues);
  checkTimestampOrder(raw, path, issues);
}

function parseCreatorProfileCore(raw: UnknownRecord, path: string, issues: IdentityV1Issue[]): void {
  checkKeys(raw, CREATOR_PROFILE_V1_ALLOWED_KEYS, path, issues);
  checkSchemaVersion(raw, path, issues);
  readEnum(raw, 'profileType', ['CREATOR'], path, issues, true);
  readId(raw, 'profileId', path, issues, true);
  readId(raw, 'identityId', path, issues, true);
  readString(raw, 'handle', path, issues, true);
  readString(raw, 'displayName', path, issues, true);
  readOptionalString(raw, 'avatarUrl', path, issues);
  readOptionalString(raw, 'bio', path, issues);
  readEnum(raw, 'verification', CREATOR_VERIFICATION_V1, path, issues, true);
  const visibility = readVisibility(raw, path, issues, true);
  readTimestamp(raw, 'publicSince', path, issues, false);
  if (visibility === 'PUBLIC' && raw['publicSince'] === undefined) {
    addIssue(
      issues,
      'missing_field',
      `${path}.publicSince`,
      'publicSince is required when visibility is PUBLIC',
    );
  }
  if (visibility !== undefined && visibility !== 'PUBLIC' && raw['publicSince'] !== undefined) {
    addIssue(
      issues,
      'public_since_mismatch',
      `${path}.publicSince`,
      'publicSince is only allowed when visibility is PUBLIC',
    );
  }
  readOptionalString(raw, 'email', path, issues);
  readOptionalString(raw, 'phone', path, issues);
  checkTimestampOrder(raw, path, issues);
}

function parseSalonMembershipCore(raw: UnknownRecord, path: string, issues: IdentityV1Issue[]): void {
  checkKeys(raw, SALON_MEMBERSHIP_V1_ALLOWED_KEYS, path, issues);
  checkSchemaVersion(raw, path, issues);
  readEnum(raw, 'profileType', ['SALON_MEMBER'], path, issues, true);
  readId(raw, 'membershipId', path, issues, true);
  readId(raw, 'identityId', path, issues, true);
  readId(raw, 'salonId', path, issues, true);
  readOptionalString(raw, 'salonName', path, issues);
  readEnum(raw, 'memberRole', SALON_MEMBER_ROLE_V1, path, issues, true);
  readEnum(raw, 'status', SALON_MEMBERSHIP_STATUS_V1, path, issues, true);
  readTimestamp(raw, 'memberSince', path, issues, true);
  checkTimestampOrder(raw, path, issues);
}

function parseNailProfileCore(raw: UnknownRecord, path: string, issues: IdentityV1Issue[]): void {
  checkKeys(raw, NAIL_PROFILE_V1_ALLOWED_KEYS, path, issues);
  checkSchemaVersion(raw, path, issues);
  readEnum(raw, 'profileType', ['NAIL'], path, issues, true);
  readId(raw, 'nailProfileId', path, issues, true);
  readId(raw, 'identityId', path, issues, true);
  const visibility = readVisibility(raw, path, issues, true);
  if (visibility !== undefined && visibility !== 'PRIVATE') {
    addIssue(
      issues,
      'nail_profile_not_private',
      `${path}.visibility`,
      `Nail Profile must stay PRIVATE, got ${visibility}`,
    );
  }
  readIdArray(raw, 'nailTwinSnapshotRefs', path, issues, false);
  readOptionalString(raw, 'allergyNotes', path, issues);
  readOptionalString(raw, 'serviceNotes', path, issues);
  checkTimestampOrder(raw, path, issues);
}

function finish<T>(raw: UnknownRecord, issues: IdentityV1Issue[]): IdentityV1ParseResult<T> {
  if (issues.length > 0) {
    return {
      ok: false,
      reason: `identity contract validation failed with ${issues.length} issue(s)`,
      issues,
    };
  }
  return { ok: true, value: raw as T };
}

export function parseIdentityV1(input: unknown): IdentityV1ParseResult<IdentityV1> {
  const issues: IdentityV1Issue[] = [];
  const raw = record(input);
  if (!raw) return failResult(issues, 'not_an_object', '$', `expected an object, got ${describe(input)}`);
  checkSchemaVersion(raw, '$', issues);
  parseIdentityCore(raw, '$', issues);
  return finish<IdentityV1>(raw, issues);
}

export function parseConsumerProfileV1(input: unknown): IdentityV1ParseResult<ConsumerProfileV1> {
  const issues: IdentityV1Issue[] = [];
  const raw = record(input);
  if (!raw) return failResult(issues, 'not_an_object', '$', `expected an object, got ${describe(input)}`);
  parseConsumerProfileCore(raw, '$', issues);
  return finish<ConsumerProfileV1>(raw, issues);
}

export function parseCreatorProfileV1(input: unknown): IdentityV1ParseResult<CreatorProfileV1> {
  const issues: IdentityV1Issue[] = [];
  const raw = record(input);
  if (!raw) return failResult(issues, 'not_an_object', '$', `expected an object, got ${describe(input)}`);
  parseCreatorProfileCore(raw, '$', issues);
  return finish<CreatorProfileV1>(raw, issues);
}

export function parseSalonMembershipV1(input: unknown): IdentityV1ParseResult<SalonMembershipV1> {
  const issues: IdentityV1Issue[] = [];
  const raw = record(input);
  if (!raw) return failResult(issues, 'not_an_object', '$', `expected an object, got ${describe(input)}`);
  parseSalonMembershipCore(raw, '$', issues);
  return finish<SalonMembershipV1>(raw, issues);
}

export function parseNailProfileV1(input: unknown): IdentityV1ParseResult<NailProfileV1> {
  const issues: IdentityV1Issue[] = [];
  const raw = record(input);
  if (!raw) return failResult(issues, 'not_an_object', '$', `expected an object, got ${describe(input)}`);
  parseNailProfileCore(raw, '$', issues);
  return finish<NailProfileV1>(raw, issues);
}

export function parsePublicCreatorProfileProjectionV1(
  input: unknown,
): IdentityV1ParseResult<PublicCreatorProfileProjectionV1> {
  const issues: IdentityV1Issue[] = [];
  const raw = record(input);
  if (!raw) return failResult(issues, 'not_an_object', '$', `expected an object, got ${describe(input)}`);
  scanForbiddenPrivateKeys(raw, '$', issues);
  checkSchemaVersion(raw, '$', issues);
  for (const key of Object.keys(raw)) {
    if (isForbiddenPrivateKey(key)) continue; // already reported by the privacy scan
    if (!PUBLIC_CREATOR_PROFILE_V1_ALLOWED_KEYS.includes(key)) {
      addIssue(
        issues,
        'public_projection_extra_field',
        `$.${key}`,
        `field "${key}" is not part of the public projection contract`,
      );
    }
  }
  readEnum(raw, 'projectionType', ['CREATOR_PROFILE'], '$', issues, true);
  readId(raw, 'identityId', '$', issues, true);
  readId(raw, 'profileId', '$', issues, true);
  readString(raw, 'handle', '$', issues, true);
  readString(raw, 'displayName', '$', issues, true);
  readOptionalString(raw, 'avatarUrl', '$', issues);
  readOptionalString(raw, 'bio', '$', issues);
  readEnum(raw, 'verification', CREATOR_VERIFICATION_V1, '$', issues, true);
  readEnum(raw, 'visibility', ['PUBLIC'], '$', issues, true);
  readTimestamp(raw, 'publicSince', '$', issues, true);
  return finish<PublicCreatorProfileProjectionV1>(raw, issues);
}

export function parsePublicTransitionPrerequisitesV1(
  input: unknown,
): IdentityV1ParseResult<PublicTransitionPrerequisitesV1> {
  const issues: IdentityV1Issue[] = [];
  const raw = record(input);
  if (!raw) return failResult(issues, 'not_an_object', '$', `expected an object, got ${describe(input)}`);
  checkKeys(raw, PUBLIC_TRANSITION_PREREQUISITES_ALLOWED_KEYS, '$', issues);
  readBoolean(raw, 'copyrightDeclared', '$', issues, true);
  readBoolean(raw, 'sourceDeclared', '$', issues, true);
  readBoolean(raw, 'moderationCleared', '$', issues, true);
  return finish<PublicTransitionPrerequisitesV1>(raw, issues);
}

const BUNDLE_PROFILE_SLOTS: ReadonlyArray<{
  key: 'consumerProfile' | 'creatorProfile' | 'nailProfile';
  requiredRole: 'CONSUMER' | 'CREATOR';
  parse: (raw: UnknownRecord, path: string, issues: IdentityV1Issue[]) => void;
}> = [
  { key: 'consumerProfile', requiredRole: 'CONSUMER', parse: parseConsumerProfileCore },
  { key: 'creatorProfile', requiredRole: 'CREATOR', parse: parseCreatorProfileCore },
  { key: 'nailProfile', requiredRole: 'CONSUMER', parse: parseNailProfileCore },
];

export function parseIdentityBundleV1(input: unknown): IdentityV1ParseResult<IdentityBundleV1> {
  const issues: IdentityV1Issue[] = [];
  const raw = record(input);
  if (!raw) return failResult(issues, 'not_an_object', '$', `expected an object, got ${describe(input)}`);
  checkSchemaVersion(raw, '$', issues);
  checkKeys(raw, IDENTITY_BUNDLE_V1_ALLOWED_KEYS, '$', issues);

  const identityValue = raw['identity'];
  if (identityValue === undefined) {
    addIssue(issues, 'missing_field', '$.identity', 'missing required field "identity"');
  } else {
    const identityObj = record(identityValue);
    if (!identityObj) {
      addIssue(issues, 'invalid_type', '$.identity', `expected identity object, got ${describe(identityValue)}`);
    } else {
      checkSchemaVersion(identityObj, '$.identity', issues);
      parseIdentityCore(identityObj, '$.identity', issues);
    }
  }
  const identityObj = record(identityValue);
  const identityId = identityObj ? identityObj['identityId'] : undefined;
  const identityRoles = identityObj && Array.isArray(identityObj['roles'])
    ? identityObj['roles']
    : [];

  for (const slot of BUNDLE_PROFILE_SLOTS) {
    const value = raw[slot.key];
    if (value === undefined) continue;
    const obj = record(value);
    if (!obj) {
      addIssue(issues, 'invalid_type', `$.${slot.key}`, `expected object for "${slot.key}", got ${describe(value)}`);
      continue;
    }
    slot.parse(obj, `$.${slot.key}`, issues);
    const profileIdentityId = obj['identityId'];
    if (typeof identityId === 'string' && typeof profileIdentityId === 'string' && profileIdentityId !== identityId) {
      addIssue(
        issues,
        'profile_identity_mismatch',
        `$.${slot.key}.identityId`,
        `profile "${slot.key}" belongs to identity "${profileIdentityId}", expected "${identityId}"`,
      );
    }
    if (!identityRoles.includes(slot.requiredRole)) {
      addIssue(
        issues,
        'profile_role_mismatch',
        `$.${slot.key}`,
        `profile "${slot.key}" requires identity role "${slot.requiredRole}"`,
      );
    }
  }

  const membershipsValue = raw['salonMemberships'];
  if (membershipsValue !== undefined) {
    if (!Array.isArray(membershipsValue)) {
      addIssue(
        issues,
        'invalid_type',
        '$.salonMemberships',
        `expected array for "salonMemberships", got ${describe(membershipsValue)}`,
      );
    } else {
      if (membershipsValue.length === 0) {
        addIssue(issues, 'empty_memberships', '$.salonMemberships', 'salonMemberships must not be empty when present');
      }
      const membershipIds = new Set<string>();
      for (let index = 0; index < membershipsValue.length; index += 1) {
        const membershipPath = `$.salonMemberships[${index}]`;
        const membership = record(membershipsValue[index]);
        if (!membership) {
          addIssue(
            issues,
            'invalid_type',
            membershipPath,
            `expected membership object, got ${describe(membershipsValue[index])}`,
          );
          continue;
        }
        parseSalonMembershipCore(membership, membershipPath, issues);
        const membershipIdentityId = membership['identityId'];
        if (
          typeof identityId === 'string' &&
          typeof membershipIdentityId === 'string' &&
          membershipIdentityId !== identityId
        ) {
          addIssue(
            issues,
            'profile_identity_mismatch',
            `${membershipPath}.identityId`,
            `membership belongs to identity "${membershipIdentityId}", expected "${identityId}"`,
          );
        }
        const membershipId = membership['membershipId'];
        if (typeof membershipId === 'string') {
          if (membershipIds.has(membershipId)) {
            addIssue(
              issues,
              'duplicate_membership',
              `${membershipPath}.membershipId`,
              `duplicate membershipId "${membershipId}"`,
            );
          }
          membershipIds.add(membershipId);
        }
      }
      if (!identityRoles.includes('SALON_MEMBER')) {
        addIssue(
          issues,
          'profile_role_mismatch',
          '$.salonMemberships',
          'salonMemberships require identity role "SALON_MEMBER"',
        );
      }
    }
  }
  return finish<IdentityBundleV1>(raw, issues);
}

export function validateIdentityV1(input: unknown): boolean {
  return parseIdentityV1(input).ok;
}

export function validateConsumerProfileV1(input: unknown): boolean {
  return parseConsumerProfileV1(input).ok;
}

export function validateCreatorProfileV1(input: unknown): boolean {
  return parseCreatorProfileV1(input).ok;
}

export function validateSalonMembershipV1(input: unknown): boolean {
  return parseSalonMembershipV1(input).ok;
}

export function validateNailProfileV1(input: unknown): boolean {
  return parseNailProfileV1(input).ok;
}

export function validatePublicCreatorProfileProjectionV1(input: unknown): boolean {
  return parsePublicCreatorProfileProjectionV1(input).ok;
}

export function validateIdentityBundleV1(input: unknown): boolean {
  return parseIdentityBundleV1(input).ok;
}

export function validatePublicTransitionPrerequisitesV1(input: unknown): boolean {
  return parsePublicTransitionPrerequisitesV1(input).ok;
}
