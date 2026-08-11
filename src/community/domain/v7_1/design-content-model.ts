/**
 * Community V7.1 · GEN-V7.1-02 DesignVersionV1, PublishedLookV1,
 * RemixRelationV1 — model types.
 *
 * EditorDocV7 is the mutable authoring truth. DesignVersionV1 is an immutable
 * released revision reference used by publishing, share, approval and lineage:
 * it references the EditorDoc by `designId` + SHA-256 and never embeds the
 * document. PublishedLookV1 references a DesignVersion plus derived previews
 * and metadata; it must never embed EditorDoc, customer/private NailProfile
 * data, manufacturing definitions, device parameters, or mutable store state.
 * RemixRelationV1 records exact source Look/DesignVersion and target
 * DesignVersion without live linkage.
 *
 * All contracts carry `schemaVersion: 1` (V7.1 is the architecture baseline,
 * not the schema version); the referenced EditorDoc schema stays 7. Visibility
 * is the GEN-01 contract: exactly PRIVATE | UNLISTED | PUBLIC, default PRIVATE.
 */

import type { PublicTransitionPrerequisitesV1, VisibilityV1 } from './model.ts';

export { VISIBILITY_V1 } from './model.ts';
export type { PublicTransitionPrerequisitesV1, VisibilityV1 } from './model.ts';

export const DESIGN_LOOK_STATUS_V1 = ['DRAFT', 'PUBLISHED', 'HIDDEN', 'REMOVED'] as const;
export type DesignLookStatusV1 = (typeof DESIGN_LOOK_STATUS_V1)[number];

export const PREVIEW_KIND_V1 = ['COVER', 'DETAIL'] as const;
export type PreviewKindV1 = (typeof PREVIEW_KIND_V1)[number];

export const PREVIEW_MIME_V1 = ['image/png', 'image/jpeg', 'image/webp'] as const;
export type PreviewMimeV1 = (typeof PREVIEW_MIME_V1)[number];

export const PREVIEW_FIDELITY_V1 = ['EXACT', 'APPROXIMATE'] as const;
export type PreviewFidelityV1 = (typeof PREVIEW_FIDELITY_V1)[number];

/**
 * Immutable reference to the EditorDocV7 a DesignVersion released. Only the
 * reference lives here — the document itself is never embedded, and its
 * mutable fields (title, nails, recipeInstances, outputIntent, timestamps …)
 * are rejected.
 */
export interface EditorDocV7RefV1 {
  designId: string;
  /** EditorDoc schema stays 7; V7.1 is the architecture baseline, not this. */
  schemaVersion: 7;
  /** Must equal DesignVersionV1.revision (the released EditorDoc revision). */
  revision: number;
  /** SHA-256 hex digest of the released EditorDoc payload. */
  sha256: string;
}

/** Immutable asset revision ref: content-addressed, never re-written in place. */
export interface ImmutableAssetRevisionRefV1 {
  assetId: string;
  revision: number;
  sha256: string;
  mimeType?: string;
}

/** Released revision reference of a design. Immutable once released. */
export interface DesignVersionV1 {
  schemaVersion: 1;
  designVersionId: string;
  designId: string;
  /** Positive release version number (1-based). */
  version: number;
  /** Positive EditorDoc revision this version released (1-based). */
  revision: number;
  editorDocRef: EditorDocV7RefV1;
  /** Creator profile that released this version. */
  releasedByIdentityId: string;
  releasedAt: string;
  /** Immutable asset revisions shipped with this version (renders, covers …). */
  assetRevisionRefs: ImmutableAssetRevisionRefV1[];
  /** Optional parent version ref; must never reference the version itself. */
  parentVersionId?: string;
}

/** Derived preview asset ref: a render of the design version, never the source. */
export interface PublishedPreviewAssetRefV1 {
  assetId: string;
  /** Immutable revision of the derived preview asset. */
  revision: number;
  kind: PreviewKindV1;
  sha256: string;
  mimeType: PreviewMimeV1;
  width: number;
  height: number;
  /** How faithfully the preview represents the released design. */
  fidelity: PreviewFidelityV1;
}

/** Shape / length / palette summaries used for discovery and filtering. */
export interface PublishedLookSummaryV1 {
  shapeIds: string[];
  lengthIds: string[];
  palette: string[];
}

/**
 * Published look: references a DesignVersion plus derived previews and
 * metadata. PUBLIC visibility requires declared copyright/source/moderation
 * clearance. A released PUBLISHED look requires publishedAt but may remain
 * PRIVATE by default; HIDDEN/REMOVED retain historical publication metadata.
 */
export interface PublishedLookV1 {
  schemaVersion: 1;
  lookId: string;
  designVersionId: string;
  creatorProfileId: string;
  title: string;
  /** Free-form metadata bag; values must be strings. Never private fields. */
  metadata?: Record<string, string>;
  tags: string[];
  visibility: VisibilityV1;
  coverPreview: PublishedPreviewAssetRefV1;
  detailPreviews: PublishedPreviewAssetRefV1[];
  summaries: PublishedLookSummaryV1;
  /** GEN-01 prerequisites contract: copyright/source/moderation clearance. */
  publicationGate: PublicTransitionPrerequisitesV1;
  status: DesignLookStatusV1;
  /** Required for PUBLISHED; forbidden only for DRAFT; retained after hide/remove. */
  publishedAt?: string;
  /** Optional reference to a RemixRelationV1 document (no live linkage). */
  remixRelationId?: string;
  createdAt: string;
  updatedAt: string;
}

/** Exact remix provenance: source Look/DesignVersion → target DesignVersion. */
export interface RemixRelationV1 {
  schemaVersion: 1;
  relationId: string;
  sourceLookId: string;
  sourceDesignVersionId: string;
  sourceCreatorProfileId: string;
  targetDesignVersionId: string;
  createdAt: string;
  license?: string;
  sourceAttribution?: string;
}
