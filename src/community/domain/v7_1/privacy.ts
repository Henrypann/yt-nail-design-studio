/**
 * Community V7.1 · Privacy helpers and the explicit public profile projection.
 *
 * `scanForbiddenPrivateKeys` is a deep, cycle-safe scan that reports any key
 * from FORBIDDEN_PRIVATE_KEYS (customer PKs, raw nail geometry, allergy/service
 * notes, contact fields, credentials) at any nesting depth. It never throws and
 * never mutates the input.
 *
 * `projectPublicCreatorProfile` is the ONLY sanctioned way to build the public
 * projection of a creator profile: it refuses private profiles and
 * cross-identity profiles, and emits a document that the strict projection
 * parser must accept.
 */

import { FORBIDDEN_PRIVATE_KEYS, MAX_ISSUES } from './contract.ts';
import type { CreatorProfileV1, IdentityV1, PublicCreatorProfileProjectionV1 } from './model.ts';

export interface PrivacyIssue {
  code: string;
  path: string;
  message: string;
}

export function isForbiddenPrivateKey(key: string): boolean {
  return FORBIDDEN_PRIVATE_KEYS.includes(key.toLowerCase());
}

/**
 * Deep-scan a value for forbidden private keys. Cycle-safe and bounded
 * (at most MAX_ISSUES issues). Never throws; never mutates `value`.
 */
export function scanForbiddenPrivateKeys(
  value: unknown,
  path: string,
  issues: PrivacyIssue[],
  seen?: WeakSet<object>,
): void {
  if (value === null || typeof value !== 'object') return;
  if (seen === undefined) seen = new WeakSet();
  if (seen.has(value)) return;
  seen.add(value);
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i += 1) {
      scanForbiddenPrivateKeys(value[i], `${path}[${i}]`, issues, seen);
    }
    return;
  }
  const record = value as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    const childPath = path === '$' ? `$.${key}` : `${path}.${key}`;
    if (isForbiddenPrivateKey(key)) {
      if (issues.length < MAX_ISSUES) {
        issues.push({
          code: 'forbidden_private_key',
          path: childPath,
          message: `key "${key}" is a forbidden private field and must never appear in public data`,
        });
      }
      continue;
    }
    scanForbiddenPrivateKeys(record[key], childPath, issues, seen);
  }
}

/**
 * Build the explicit public projection of a creator profile.
 * Returns null when the profile is not PUBLIC or does not belong to the
 * given identity. The result is guaranteed to contain only public-safe fields.
 */
export function projectPublicCreatorProfile(
  identity: IdentityV1,
  profile: CreatorProfileV1,
): PublicCreatorProfileProjectionV1 | null {
  if (identity.identityId !== profile.identityId) return null;
  if (profile.visibility !== 'PUBLIC') return null;
  return {
    schemaVersion: 1,
    projectionType: 'CREATOR_PROFILE',
    identityId: identity.identityId,
    profileId: profile.profileId,
    handle: profile.handle,
    displayName: profile.displayName,
    avatarUrl: profile.avatarUrl,
    bio: profile.bio,
    verification: profile.verification,
    visibility: 'PUBLIC',
    publicSince: profile.publicSince ?? profile.updatedAt,
  };
}
