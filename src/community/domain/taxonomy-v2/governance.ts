/**
 * Community v0.7.2 · COMM-v0.7.2-TAX-01 pure governance predicates.
 *
 * Product rules implemented here (2026-08-14 PRD §3.2/§3.5, §5.1):
 * - Public new/updated discovery metadata requires >=1 style and >=1
 *   recommended shape, a non-PENDING rights record, and a makeability
 *   classification. A narrowly typed legacy NEEDS_STYLE_REVIEW exception is
 *   allowed only for technique:french migration records and must never make
 *   them eligible for a style channel.
 * - Current-makeable is fail-closed: classification is not CONCEPT_ONLY and
 *   the capability ref, at least one immutable asset ref, and at least one
 *   evidence ref must all parse. applicationLevel / verificationLevel of
 *   legacy content records are NEVER consulted here.
 * - PENDING rights are never public. PERSONAL_USE_ONLY is public only when
 *   the normal publication gate passes, and always exposes that commercial /
 *   remix actions are disallowed.
 *
 * All predicates are pure: no IO, no clock, no registry access.
 */

import {
  isValidAssetRef,
  isValidCapabilityRef,
  isValidEvidenceRef,
} from './parse.ts';
import { resolveTagId } from './resolve.ts';
import type { RightsStatus } from './contract.ts';
import type {
  CommunityCurationMetadataV1,
  CommunityDiscoveryMetadataV1,
  CommunityTaxonomyV2,
} from './types.ts';

export interface EligibilityResultV1 {
  eligible: boolean;
  /** Human-readable reasons when not eligible. */
  reasons: string[];
  /** True when the narrow legacy NEEDS_STYLE_REVIEW exception was applied. */
  legacyExceptionApplied: boolean;
}

/**
 * The narrow legacy exception: the record is a technique:french migration
 * record with no overall style yet, explicitly marked NEEDS_STYLE_REVIEW.
 * Applies only when ALL of: state === NEEDS_STYLE_REVIEW, techniqueIds
 * resolves to technique:french, and styleIds is empty.
 */
export function legacyStyleReviewExceptionApplies(
  metadata: CommunityDiscoveryMetadataV1,
  taxonomy: CommunityTaxonomyV2,
): boolean {
  if (metadata.migration.state !== 'NEEDS_STYLE_REVIEW') return false;
  if (metadata.styleIds.length > 0) return false;
  return metadata.techniqueIds.some(
    (id) => resolveTagId(taxonomy, id)?.id === 'technique:french',
  );
}

/**
 * A record that went public through the french NEEDS_STYLE_REVIEW exception
 * must never appear in a style browse channel (it has no overall style).
 */
export function styleChannelEligible(
  metadata: CommunityDiscoveryMetadataV1,
  taxonomy: CommunityTaxonomyV2,
): boolean {
  return !legacyStyleReviewExceptionApplies(metadata, taxonomy);
}

/** PENDING rights are never public. */
export function isRightsPublic(status: RightsStatus): boolean {
  return status !== 'PENDING';
}

/**
 * Normal publication gate for public new/updated discovery metadata.
 * Fail-closed: any unmet requirement is reported.
 */
export function publicationEligibility(
  metadata: CommunityDiscoveryMetadataV1,
  taxonomy: CommunityTaxonomyV2,
): EligibilityResultV1 {
  const reasons: string[] = [];
  const exceptionApplied = legacyStyleReviewExceptionApplies(metadata, taxonomy);

  const styleResolved = metadata.styleIds.filter(
    (id) => resolveTagId(taxonomy, id)?.dimension === 'STYLE',
  ).length;
  if (!exceptionApplied && styleResolved === 0) {
    reasons.push('missing >=1 overall style tag');
  }

  const shapeResolved = metadata.recommendedShapeIds.filter(
    (id) => resolveTagId(taxonomy, id)?.dimension === 'SHAPE',
  ).length;
  if (shapeResolved === 0) {
    reasons.push('missing >=1 recommended shape tag');
  }

  if (!isRightsPublic(metadata.rights.status)) {
    reasons.push('rights status PENDING is never public');
  }

  if (!metadata.makeability || typeof metadata.makeability.classification !== 'string') {
    reasons.push('missing makeability classification');
  }

  return {
    eligible: reasons.length === 0,
    reasons,
    legacyExceptionApplied: exceptionApplied,
  };
}

/**
 * Fail-closed current-makeable classification. Never infers capability from
 * applicationLevel / verificationLevel (those fields are not part of this
 * contract and are never consulted).
 */
export function isCurrentMakeable(
  metadata: CommunityDiscoveryMetadataV1,
): boolean {
  const makeability = metadata.makeability;
  if (!makeability) return false;
  if (makeability.classification === 'CONCEPT_ONLY') return false;
  if (!makeability.capabilityRef || !isValidCapabilityRef(makeability.capabilityRef)) {
    return false;
  }
  if (
    makeability.assetRefs.length === 0 ||
    !makeability.assetRefs.every((ref) => isValidAssetRef(ref))
  ) {
    return false;
  }
  if (
    makeability.evidenceRefs.length === 0 ||
    !makeability.evidenceRefs.every((ref) => isValidEvidenceRef(ref))
  ) {
    return false;
  }
  return true;
}

/**
 * The makeable recommendation channel additionally requires the rights gate:
 * a makeable record with PENDING rights must not surface publicly.
 */
export function makeableChannelEligible(
  metadata: CommunityDiscoveryMetadataV1,
): boolean {
  return isRightsPublic(metadata.rights.status) && isCurrentMakeable(metadata);
}

export interface ActionPermissionsV1 {
  public: boolean;
  commercial: boolean;
  remix: boolean;
  attributionRequired: boolean;
}

/**
 * What actions a viewer may take on the record. PERSONAL_USE_ONLY passes the
 * normal publication gate (public: true) but must expose that commercial and
 * remix actions are disallowed. PENDING is never public and permits nothing.
 */
export function actionPermissions(
  metadata: CommunityDiscoveryMetadataV1,
): ActionPermissionsV1 {
  const status = metadata.rights.status;
  const publicVisible = isRightsPublic(status);
  const commercialAndRemix =
    status !== 'PENDING' && status !== 'PERSONAL_USE_ONLY';
  return {
    public: publicVisible,
    commercial: publicVisible && commercialAndRemix,
    remix: publicVisible && commercialAndRemix,
    attributionRequired: status === 'LICENSED' || status === 'REMIX_ALLOWED',
  };
}

/**
 * Curation never changes discovery facts: a curated record must still satisfy
 * the same public gate as any other public record (PENDING rights, missing
 * style/shape, or unmade-able-without-evidence records cannot be curated into
 * public channels).
 */
export function curationPublicEligibility(
  metadata: CommunityDiscoveryMetadataV1,
  curation: CommunityCurationMetadataV1,
  taxonomy: CommunityTaxonomyV2,
): EligibilityResultV1 {
  const base = publicationEligibility(metadata, taxonomy);
  if (!curation.curated) return base;
  if (metadata.rights.status === 'PENDING') {
    base.reasons.push('PENDING rights cannot be curated into public channels');
    base.eligible = false;
  }
  return base;
}
