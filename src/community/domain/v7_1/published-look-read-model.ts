/**
 * Community V7.1 · COMM-V7.1-01 PublishedLookReadModelV1 — typed read model.
 *
 * A read model is the UI-facing projection of a published look on the canonical
 * detail route `/look/:lookId`. It is a DISCRIMINATED projection:
 *
 * - `CANONICAL`       — backed by a real PublishedLookV1 contract document
 *                       (immutable DesignVersionV1 ref + EditorDoc SHA-256 +
 *                       preview revision/hash + verified publication gate).
 * - `LEGACY_PARTIAL`  — adapted from the current static CommunityContentV1
 *                       fixtures, which predate DesignVersionV1. Such records
 *                       keep the original content consumed by the existing UI
 *                       plus an explicit evidence block declaring what is
 *                       missing. They are NEVER claimed to be a fully valid
 *                       PublishedLookV1: no designVersionId, EditorDoc hash,
 *                       preview revision/hash or publication-gate evidence is
 *                       fabricated.
 *
 * The read model never embeds an EditorDoc, customer/private NailProfile data,
 * manufacturing definitions, device parameters or mutable store state, and it
 * never mutates its source. `lookId === contentId` for legacy records keeps
 * deep links stable while the canonical route takes over.
 */

import type {
  ApplicationLevel,
  CommunityContentAssetRef,
  CommunityContentV1,
  MediaKind,
  PublisherType,
  VerificationLevel,
} from '../types';
import type { EditorDocV7RefV1, PreviewFidelityV1, PublishedLookV1 } from './design-content-model';
import type { VisibilityV1 } from './model';
import type {
  CommunityCurationMetadataV1,
  CommunityDiscoveryMetadataV1,
} from '../taxonomy-v2/types';
import type { MigrationManifestEntryV1 } from '../taxonomy-v2/migration-manifest';

export type PublishedLookReadModelKind = 'CANONICAL' | 'LEGACY_PARTIAL';

/**
 * Immutable DesignVersion evidence. Legacy fixtures carry no DesignVersionV1 /
 * EditorDoc SHA-256 reference; that absence is declared, never invented.
 */
export type DesignVersionEvidenceV1 =
  | { present: true; designVersionId: string; editorDocRef: EditorDocV7RefV1 }
  | { present: false; reason: 'legacy_missing_design_version' };

/**
 * Derived preview evidence. Legacy fixtures have no immutable preview revision
 * or content hash; `fidelity` is still classified honestly from the existing
 * verification level (CONCEPT → APPROXIMATE, RENDER_VERIFIED+ → EXACT).
 */
export type PreviewEvidenceV1 =
  | {
      present: true;
      previewRevision: number;
      previewSha256: string;
      fidelity: PreviewFidelityV1;
    }
  | { present: false; reason: 'legacy_missing_preview_hash'; fidelity: PreviewFidelityV1 };

/**
 * Public publication-gate evidence (GEN-01 prerequisites contract). A legacy
 * record may look "published" in the old static index but carries no verified
 * copyright/source/moderation clearance — that is declared as unverified.
 */
export type PublicationGateEvidenceV1 =
  | {
      present: true;
      copyrightDeclared: true;
      sourceDeclared: true;
      moderationCleared: true;
    }
  | { present: false; reason: 'legacy_missing_publication_gate_evidence' };

/**
 * Honest status evidence. The three axes are independent on purpose:
 * preview verified ≠ manufacturable ≠ production dispatched.
 * `productionDispatched` is always false for legacy records: the static
 * fixtures carry no device/work-order evidence, and nothing here may claim it.
 */
export interface LookStatusEvidenceV1 {
  sourceStatus: 'DRAFT' | 'PUBLISHED' | 'DEPRECATED';
  /** True only when the record is a PUBLISHED legacy item (drafts are rejected). */
  viewable: boolean;
  /** verificationLevel at least RENDER_VERIFIED. */
  previewVerified: boolean;
  /** Explicit manufacturing evidence. Legacy content never supplies this proof. */
  manufacturable: boolean;
  /** Production dispatch evidence. Always false for legacy static fixtures. */
  productionDispatched: boolean;
}

export interface PublishedLookEvidenceV1 {
  immutableDesignVersion: DesignVersionEvidenceV1;
  previewEvidence: PreviewEvidenceV1;
  publicationGate: PublicationGateEvidenceV1;
  status: LookStatusEvidenceV1;
}

/** Shared display/metadata surface of both read-model variants. */
export interface PublishedLookReadModelV1Base {
  schemaVersion: 1;
  readModelKind: PublishedLookReadModelKind;
  /** Canonical detail id — `/look/:lookId`. Legacy: contentId doubles as lookId. */
  lookId: string;
  /** Original legacy content id (stable compatibility key). */
  contentId: string;
  title: string;
  titleEn?: string;
  publisherId: string;
  publisherType: PublisherType;
  curationStatus: 'NONE' | 'FEATURED_BY_OFFICIAL';
  cover: { url: string; kind: MediaKind };
  media: Array<{ id: string; url: string; kind: MediaKind }>;
  mainStyleId: string;
  subStyleIds: string[];
  season?: string;
  occasionIds: string[];
  subjectIds: string[];
  moodIds: string[];
  effectIds: string[];
  primaryColorIds: string[];
  recommendedShapes: string[];
  supportedShapes: string[];
  notRecommendedShapes: Record<string, string>;
  supportedLengths: string[];
  applicationLevel: ApplicationLevel;
  verificationLevel: VerificationLevel;
  assetRef?: CommunityContentAssetRef;
  campaignTags: string[];
  publishedAt: string;
  /** Demo fixture only; stripped in production loads. */
  demo?: boolean;
  evidence: PublishedLookEvidenceV1;
  /**
   * COMM-v0.7.2-TAX-02 required discovery projection. Loaded strictly from the
   * checked-in migration manifest (static content) or the creator V2 store
   * (creator content) — NEVER synthesized at runtime from PublishedLookV1.tags,
   * publisherType, applicationLevel or verificationLevel. `null` means the
   * subject has no explicit discovery record; the strict load path fails
   * closed with a typed diagnostic instead of inventing one.
   */
  discovery: CommunityDiscoveryMetadataV1 | null;
  /**
   * COMM-v0.7.2-TAX-02 required curation projection. Curation is a separate
   * auditable contract and never mixes into discovery facts. Same strict
   * loading guarantees as `discovery`.
   */
  curation: CommunityCurationMetadataV1 | null;
  /**
   * The original legacy record consumed by the existing UI helpers
   * (canTryInStudio / createStudioImportIntent). It is preserved verbatim —
   * never upgraded into a fake PublishedLookV1. After TAX-02 this field is
   * used ONLY for legacy Studio import compatibility; discovery filtering
   * must read `discovery`/`curation` instead.
   */
  sourceContent: CommunityContentV1;
}

/**
 * Canonical published discovery envelope (COMM-v0.7.2-TAX-02): pairs one
 * PublishedLookV1 or legacy content identity (subjectRef) with its
 * CommunityDiscoveryMetadataV1 and its separate CommunityCurationMetadataV1.
 * Built deterministically from a migration manifest entry.
 */
export interface PublishedDiscoveryEnvelopeV1 {
  subjectRef: { kind: 'PUBLISHED_LOOK'; id: string };
  discovery: CommunityDiscoveryMetadataV1;
  curation: CommunityCurationMetadataV1;
}

/** Build the canonical discovery envelope from a validated manifest entry. */
export function publishedDiscoveryEnvelopeV1(
  entry: MigrationManifestEntryV1,
): PublishedDiscoveryEnvelopeV1 {
  return {
    subjectRef: { kind: 'PUBLISHED_LOOK', id: entry.subjectRef.id },
    discovery: structuredClone(entry.discovery),
    curation: structuredClone(entry.curation),
  };
}

/** Pure copy of a read model with the discovery/curation projections attached. */
export function withDiscoveryProjectionsV1<T extends PublishedLookReadModelV1>(
  look: T,
  envelope: PublishedDiscoveryEnvelopeV1,
): T {
  return {
    ...structuredClone(look),
    discovery: structuredClone(envelope.discovery),
    curation: structuredClone(envelope.curation),
  } as T;
}

/** Backed by a real PublishedLookV1 contract document. */
export interface CanonicalPublishedLookReadModelV1 extends PublishedLookReadModelV1Base {
  readModelKind: 'CANONICAL';
  designVersionId: string;
  creatorProfileId: string;
  visibility: VisibilityV1;
  publicationGateVerified: true;
  /** Exact canonical authority used by versioned Studio intents. */
  sourceLook: PublishedLookV1;
}

/**
 * Adapted from legacy CommunityContentV1 static fixtures. `designVersionId` is
 * typed `undefined` so the union forces consumers to narrow: a legacy record
 * can never be treated as a fully valid PublishedLookV1.
 */
export interface LegacyPartialPublishedLookReadModelV1 extends PublishedLookReadModelV1Base {
  readModelKind: 'LEGACY_PARTIAL';
  /** Never fabricated: legacy fixtures carry no immutable DesignVersion reference. */
  designVersionId: undefined;
  publicationGateVerified: false;
}

export type PublishedLookReadModelV1 =
  | CanonicalPublishedLookReadModelV1
  | LegacyPartialPublishedLookReadModelV1;

/** Narrowing helper for UI code. */
export function isLegacyPartialLook(
  look: PublishedLookReadModelV1,
): look is LegacyPartialPublishedLookReadModelV1 {
  return look.readModelKind === 'LEGACY_PARTIAL';
}
