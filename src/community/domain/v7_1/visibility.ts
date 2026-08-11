/**
 * Community V7.1 · Visibility, permission and share-link helpers.
 *
 * Visibility is exactly PRIVATE | UNLISTED | PUBLIC. The default is always
 * PRIVATE. Transitioning to PUBLIC requires an explicit OWNER actor plus all
 * three declared prerequisites (copyright, source, moderation). UNLISTED
 * share-link access grants a read-only view and never mutates visibility.
 *
 * All helpers are pure: they never mutate their inputs.
 */

import type { ActorPermissionV1, PublicTransitionPrerequisitesV1, VisibilityV1 } from './model.ts';

export type VisibilityTransitionDenialCode = 'actor_permission_denied' | 'prerequisites_missing';

export type VisibilityTransitionResult =
  | { allowed: true; note?: 'unchanged' }
  | { allowed: false; code: VisibilityTransitionDenialCode; message: string };

export type ShareLinkAccessResult =
  | { access: 'GRANTED'; visibility: VisibilityV1; readOnly: true }
  | { access: 'DENIED'; visibility: VisibilityV1 };

/** The default visibility for any new profile/content: always PRIVATE. */
export function defaultVisibility(): VisibilityV1 {
  return 'PRIVATE';
}

/** Only the OWNER actor may publish (transition to PUBLIC). */
export function hasPublishPermission(actor: ActorPermissionV1): boolean {
  return actor === 'OWNER';
}

export function publicTransitionPrerequisitesMet(
  prerequisites: PublicTransitionPrerequisitesV1 | undefined,
): prerequisites is PublicTransitionPrerequisitesV1 {
  return (
    prerequisites !== undefined &&
    prerequisites.copyrightDeclared === true &&
    prerequisites.sourceDeclared === true &&
    prerequisites.moderationCleared === true
  );
}

/** Explicit permission + declared copyright/source/moderation prerequisites. */
export function canTransitionToPublic(
  actor: ActorPermissionV1,
  prerequisites: PublicTransitionPrerequisitesV1 | undefined,
): boolean {
  return hasPublishPermission(actor) && publicTransitionPrerequisitesMet(prerequisites);
}

/**
 * Evaluate a visibility transition. Same → same is always allowed (idempotent,
 * e.g. repeated share-link access). Everything else:
 *  - to PUBLIC: OWNER actor + full prerequisites (PRIVATE→PUBLIC included);
 *  - to PRIVATE/UNLISTED: OWNER or OPERATOR actor.
 */
export function canTransitionVisibility(
  current: VisibilityV1,
  target: VisibilityV1,
  actor: ActorPermissionV1,
  prerequisites?: PublicTransitionPrerequisitesV1,
): VisibilityTransitionResult {
  if (current === target) return { allowed: true, note: 'unchanged' };
  if (target === 'PUBLIC') {
    if (!hasPublishPermission(actor)) {
      return {
        allowed: false,
        code: 'actor_permission_denied',
        message: `only the OWNER actor may publish; actor is ${actor}`,
      };
    }
    if (!publicTransitionPrerequisitesMet(prerequisites)) {
      return {
        allowed: false,
        code: 'prerequisites_missing',
        message: 'copyright, source and moderation prerequisites must all be declared before publishing',
      };
    }
    return { allowed: true };
  }
  if (actor === 'OWNER' || actor === 'OPERATOR') return { allowed: true };
  return {
    allowed: false,
    code: 'actor_permission_denied',
    message: `actor ${actor} may not change visibility away from ${current}`,
  };
}

/**
 * Share-link (UNLISTED) access. Grants a read-only view for UNLISTED and
 * PUBLIC; denies PRIVATE. Pure: the caller's visibility is never mutated,
 * and opening a share link never transitions UNLISTED → PUBLIC.
 */
export function shareLinkAccess(visibility: VisibilityV1): ShareLinkAccessResult {
  if (visibility === 'PRIVATE') return { access: 'DENIED', visibility };
  return { access: 'GRANTED', visibility, readOnly: true };
}

export function isPubliclyVisible(visibility: VisibilityV1): boolean {
  return visibility === 'PUBLIC';
}

export function isShareLinkVisible(visibility: VisibilityV1): boolean {
  return visibility === 'UNLISTED' || visibility === 'PUBLIC';
}
