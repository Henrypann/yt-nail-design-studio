import {
  parseImmutableAssetObjectRefV1,
  type ImmutableAssetObjectRefV1,
} from './asset-contract';
import { isServiceIdV1, isServiceTimestampV1 } from './service-contract';

/** Asset review and product eligibility are separate on purpose. */
export const GENERATED_ASSET_REVIEW_STATUSES_V1 = [
  'GENERATED_CANDIDATE',
  'REVIEWED_EDITORIAL',
  'REJECTED',
  'SUPERSEDED',
] as const;
export type GeneratedAssetReviewStatusV1 = (typeof GENERATED_ASSET_REVIEW_STATUSES_V1)[number];

export const ASSET_PRODUCT_ELIGIBILITIES_V1 = [
  'VERSIONED_READY',
  'LEGACY_APPROXIMATE',
  'INSPIRATION_ONLY',
  'ASSETS_INCOMPLETE',
  'UNAVAILABLE',
] as const;
export type AssetProductEligibilityV1 = (typeof ASSET_PRODUCT_ELIGIBILITIES_V1)[number];

export const GENERATED_ASSET_SURFACES_V1 = [
  'STUDIO_WIZARD_COVER',
  'COMMUNITY_EDITORIAL',
  'COMMUNITY_COVER',
  'TEMPLATE_THUMBNAIL',
  'VISUAL_REFERENCE',
  'TEXTURE_REFERENCE',
] as const;
export type GeneratedAssetSurfaceV1 = (typeof GENERATED_ASSET_SURFACES_V1)[number];

export const GENERATED_ASSET_METHODS_V1 = [
  'IMAGE_GENERATION',
  'DETERMINISTIC_SCRIPT',
  'IMPORTED_REFERENCE',
] as const;
export type GeneratedAssetMethodV1 = (typeof GENERATED_ASSET_METHODS_V1)[number];

export const GENERATED_ASSET_RIGHTS_STATUSES_V1 = [
  'PENDING',
  'DECLARED',
  'CLEARED',
  'REJECTED',
] as const;
export type GeneratedAssetRightsStatusV1 = (typeof GENERATED_ASSET_RIGHTS_STATUSES_V1)[number];

export interface GeneratedAssetCandidateV1 {
  schemaVersion: 1;
  candidateId: string;
  asset: ImmutableAssetObjectRefV1;
  intendedSurface: GeneratedAssetSurfaceV1;
  evidenceTier: 'CONCEPT' | 'SIMULATED';
  generation: {
    method: GeneratedAssetMethodV1;
    toolId: string;
    toolRevision?: string;
    promptRef?: string;
    specRef: string;
    createdAt: string;
  };
  provenance: {
    sourceRefs: string[];
    rightsStatus: GeneratedAssetRightsStatusV1;
    rightsEvidenceRefs: string[];
    containsCustomerData: false;
    containsBrandMarks: false;
  };
  quality: {
    reviewStatus: GeneratedAssetReviewStatusV1;
    expectedNailCount?: number;
    observedNailCount?: number;
    noTextLogoWatermark: boolean;
    evidenceRefs: string[];
  };
  promotion: {
    eligibility: AssetProductEligibilityV1;
    structuredAssetRefs: string[];
    preflightEvidenceRefs: string[];
    limitationCodes: string[];
    rollbackRef?: string;
  };
}
export type GeneratedAssetPromotionGateV1 =
  | { ok: true; eligibility: 'VERSIONED_READY' }
  | { ok: false; eligibility: Exclude<AssetProductEligibilityV1, 'VERSIONED_READY'>; reasons: string[] };

type UnknownRecord = Record<string, unknown>;

function record(value: unknown): UnknownRecord | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as UnknownRecord
    : null;
}

function exactKeys(value: UnknownRecord, allowed: readonly string[]): boolean {
  return Object.keys(value).every((key) => allowed.includes(key));
}

function uniqueIds(value: unknown): string[] | null {
  if (!Array.isArray(value) || !value.every(isServiceIdV1)) return null;
  const ids = value as string[];
  return new Set(ids).size === ids.length ? [...ids] : null;
}

function optionalPositiveInteger(value: unknown, max: number): value is number | undefined {
  return value === undefined || (Number.isInteger(value) && (value as number) >= 0 && (value as number) <= max);
}

export function parseGeneratedAssetCandidateV1(value: unknown): GeneratedAssetCandidateV1 | null {
  const raw = record(value);
  if (!raw || !exactKeys(raw, [
    'schemaVersion', 'candidateId', 'asset', 'intendedSurface', 'evidenceTier',
    'generation', 'provenance', 'quality', 'promotion',
  ]) || raw.schemaVersion !== 1 || !isServiceIdV1(raw.candidateId)
    || !parseImmutableAssetObjectRefV1(raw.asset)
    || !GENERATED_ASSET_SURFACES_V1.includes(raw.intendedSurface as GeneratedAssetSurfaceV1)
    || !['CONCEPT', 'SIMULATED'].includes(raw.evidenceTier as string)) return null;

  const generation = record(raw.generation);
  if (!generation || !exactKeys(generation, [
    'method', 'toolId', 'toolRevision', 'promptRef', 'specRef', 'createdAt',
  ]) || !GENERATED_ASSET_METHODS_V1.includes(generation.method as GeneratedAssetMethodV1)
    || !isServiceIdV1(generation.toolId) || !isServiceIdV1(generation.specRef)
    || !isServiceTimestampV1(generation.createdAt)
    || (generation.toolRevision !== undefined && !isServiceIdV1(generation.toolRevision))
    || (generation.promptRef !== undefined && !isServiceIdV1(generation.promptRef))
    || (generation.method === 'IMAGE_GENERATION' && !isServiceIdV1(generation.promptRef))) return null;

  const provenance = record(raw.provenance);
  if (!provenance || !exactKeys(provenance, [
    'sourceRefs', 'rightsStatus', 'rightsEvidenceRefs', 'containsCustomerData', 'containsBrandMarks',
  ]) || !uniqueIds(provenance.sourceRefs) || !uniqueIds(provenance.rightsEvidenceRefs)
    || !GENERATED_ASSET_RIGHTS_STATUSES_V1.includes(provenance.rightsStatus as GeneratedAssetRightsStatusV1)
    || provenance.containsCustomerData !== false || provenance.containsBrandMarks !== false) return null;

  const quality = record(raw.quality);
  if (!quality || !exactKeys(quality, [
    'reviewStatus', 'expectedNailCount', 'observedNailCount', 'noTextLogoWatermark', 'evidenceRefs',
  ]) || !GENERATED_ASSET_REVIEW_STATUSES_V1.includes(quality.reviewStatus as GeneratedAssetReviewStatusV1)
    || !optionalPositiveInteger(quality.expectedNailCount, 20)
    || !optionalPositiveInteger(quality.observedNailCount, 20)
    || typeof quality.noTextLogoWatermark !== 'boolean' || !uniqueIds(quality.evidenceRefs)
    || ((quality.expectedNailCount === undefined) !== (quality.observedNailCount === undefined))) return null;

  const promotion = record(raw.promotion);
  if (!promotion || !exactKeys(promotion, [
    'eligibility', 'structuredAssetRefs', 'preflightEvidenceRefs', 'limitationCodes', 'rollbackRef',
  ]) || !ASSET_PRODUCT_ELIGIBILITIES_V1.includes(promotion.eligibility as AssetProductEligibilityV1)
    || !uniqueIds(promotion.structuredAssetRefs) || !uniqueIds(promotion.preflightEvidenceRefs)
    || !uniqueIds(promotion.limitationCodes)
    || (promotion.rollbackRef !== undefined && !isServiceIdV1(promotion.rollbackRef))) return null;

  const candidate = structuredClone(value) as GeneratedAssetCandidateV1;
  const gate = evaluateGeneratedAssetPromotionV1(candidate);
  if (candidate.promotion.eligibility === 'VERSIONED_READY' && !gate.ok) return null;
  return candidate;
}

/**
 * A generated raster can support a ready product, but can never be the sole
 * evidence for Editor readiness. Structured assets, preflight and rights are
 * all required independently.
 */
export function evaluateGeneratedAssetPromotionV1(candidate: GeneratedAssetCandidateV1): GeneratedAssetPromotionGateV1 {
  const reasons: string[] = [];
  if (candidate.provenance.rightsStatus !== 'CLEARED') reasons.push('rights_not_cleared');
  if (candidate.provenance.containsCustomerData) reasons.push('customer_data_forbidden');
  if (candidate.provenance.containsBrandMarks) reasons.push('brand_marks_forbidden');
  if (candidate.quality.reviewStatus !== 'REVIEWED_EDITORIAL') reasons.push('editorial_review_incomplete');
  if (!candidate.quality.noTextLogoWatermark) reasons.push('text_logo_watermark_present');
  if (candidate.quality.expectedNailCount !== undefined
    && candidate.quality.expectedNailCount !== candidate.quality.observedNailCount) reasons.push('nail_count_mismatch');
  if (candidate.promotion.structuredAssetRefs.length === 0) reasons.push('structured_assets_missing');
  if (candidate.promotion.preflightEvidenceRefs.length === 0) reasons.push('preflight_evidence_missing');

  if (reasons.length === 0) return { ok: true, eligibility: 'VERSIONED_READY' };
  const unavailable = candidate.provenance.rightsStatus === 'REJECTED'
    || candidate.quality.reviewStatus === 'REJECTED';
  return {
    ok: false,
    eligibility: unavailable ? 'UNAVAILABLE' : candidate.promotion.eligibility === 'LEGACY_APPROXIMATE'
      ? 'LEGACY_APPROXIMATE'
      : candidate.promotion.eligibility === 'INSPIRATION_ONLY'
        ? 'INSPIRATION_ONLY'
        : 'ASSETS_INCOMPLETE',
    reasons,
  };
}
