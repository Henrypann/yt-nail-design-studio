/**
 * Community V7.1 · COMM-V7.1-01 Published Look adapter (pure, dependency-free).
 *
 * `adaptLegacyContentToLook` projects a legacy static `CommunityContentV1`
 * record into a `LEGACY_PARTIAL` PublishedLookReadModelV1:
 *
 * - rejects draft / deprecated / non-published items as `not_viewable`;
 * - rejects malformed essentials (missing/empty id, title, publisher, cover,
 *   status, application/verification level, schemaVersion) as `malformed`;
 * - preserves publisher / title / taxonomy / application / verification /
 *   asset-ref fields exactly as the existing UI consumes them;
 * - declares missing immutable design version, preview revision/hash and
 *   public publication-gate evidence — it NEVER fabricates designVersionId,
 *   EditorDoc SHA-256, preview hashes or gate clearance;
 * - classifies preview fidelity honestly from the existing verification level:
 *   CONCEPT → APPROXIMATE (a concept image, not a verified render),
 *   RENDER_VERIFIED / SAMPLE_VERIFIED / PRODUCTION_VERIFIED → EXACT;
 * - is deterministic (no clock, no randomness, stable field order) and
 *   side-effect free (never mutates its input).
 *
 * `buildLookReadModels` applies the shared demo-visibility filter
 * (`visibleCommunityContents`) and keeps only viewable projections.
 */

import type { CommunityContentV1 } from '../types';
import { visibleCommunityContents } from '../visibility';
import type { PreviewFidelityV1 } from './design-content-model';
import type {
  LegacyPartialPublishedLookReadModelV1,
  PublishedLookReadModelV1,
} from './published-look-read-model';

export type LegacyLookAdapterResult =
  | { ok: true; look: LegacyPartialPublishedLookReadModelV1 }
  | { ok: false; reason: 'not_viewable' | 'malformed'; message: string };

const SCHEMA_VERSION = 1 as const;
const STATUSES = new Set(['DRAFT', 'PUBLISHED', 'DEPRECATED']);
const PUBLISHER_TYPES = new Set(['OFFICIAL', 'VERIFIED_CREATOR']);
const CURATION_STATUSES = new Set(['NONE', 'FEATURED_BY_OFFICIAL']);
const APPLICATION_LEVELS = new Set([
  'INSPIRATION_ONLY',
  'APPROXIMATE',
  'STRUCTURED_EDITABLE',
  'REPRODUCIBLE',
]);
const VERIFICATION_LEVELS = new Set([
  'CONCEPT',
  'RENDER_VERIFIED',
  'SAMPLE_VERIFIED',
  'PRODUCTION_VERIFIED',
]);
const MEDIA_KINDS = new Set(['EDITORIAL', 'CANONICAL_RENDER', 'SAMPLE_PHOTO']);

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function malformed(message: string): LegacyLookAdapterResult {
  return { ok: false, reason: 'malformed', message };
}

function notViewable(message: string): LegacyLookAdapterResult {
  return { ok: false, reason: 'not_viewable', message };
}

/** Honest preview-fidelity classification from the legacy verification level. */
export function previewFidelityFromVerification(
  verificationLevel: CommunityContentV1['verificationLevel'],
): PreviewFidelityV1 {
  return verificationLevel === 'CONCEPT' ? 'APPROXIMATE' : 'EXACT';
}

function copyStringArray(value: unknown, path: string): LegacyLookAdapterResult | string[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) {
    return malformed(`"${path}" must be an array of strings`);
  }
  const out: string[] = [];
  for (let i = 0; i < value.length; i += 1) {
    if (typeof value[i] !== 'string') {
      return malformed(`"${path}[${i}]" must be a string`);
    }
    out.push(value[i]);
  }
  return out;
}

/**
 * Deterministic projection of one legacy record. Pure: the input is never
 * mutated; nested values are copied into fresh objects.
 */
export function adaptLegacyContentToLook(input: unknown): LegacyLookAdapterResult {
  if (!isPlainObject(input)) {
    return malformed('content must be a plain object');
  }
  if (input.schemaVersion !== SCHEMA_VERSION) {
    return malformed('legacy content schemaVersion must be 1');
  }
  if (!isNonEmptyString(input.contentId)) return malformed('missing contentId');
  if (!isNonEmptyString(input.title)) return malformed('missing title');
  if (!isNonEmptyString(input.publisherId)) return malformed('missing publisherId');
  if (typeof input.publisherType !== 'string' || !PUBLISHER_TYPES.has(input.publisherType)) {
    return malformed('invalid publisherType');
  }
  if (typeof input.curationStatus !== 'string' || !CURATION_STATUSES.has(input.curationStatus)) {
    return malformed('invalid curationStatus');
  }
  if (!isPlainObject(input.cover) || !isNonEmptyString(input.cover.url)) {
    return malformed('invalid cover');
  }
  if (
    input.cover.kind !== undefined &&
    (typeof input.cover.kind !== 'string' || !MEDIA_KINDS.has(input.cover.kind))
  ) {
    return malformed('invalid cover.kind');
  }
  if (typeof input.status !== 'string' || !STATUSES.has(input.status)) {
    return malformed('invalid status');
  }
  // Lifecycle visibility is decided before published-only field validation so
  // an ordinary draft without publishedAt remains "not_viewable", not malformed.
  if (input.status !== 'PUBLISHED') {
    return notViewable(`status "${String(input.status)}" is not viewable as a published look`);
  }
  if (
    typeof input.applicationLevel !== 'string' ||
    !APPLICATION_LEVELS.has(input.applicationLevel)
  ) {
    return malformed('invalid applicationLevel');
  }
  if (
    typeof input.verificationLevel !== 'string' ||
    !VERIFICATION_LEVELS.has(input.verificationLevel)
  ) {
    return malformed('invalid verificationLevel');
  }
  if (!isNonEmptyString(input.mainStyleId)) return malformed('missing mainStyleId');
  if (!isNonEmptyString(input.publishedAt)) return malformed('missing publishedAt');

  const mediaResult = (() => {
    if (input.media === undefined) return [];
    if (!Array.isArray(input.media)) return malformed('"media" must be an array');
    const out: Array<{ id: string; url: string; kind: string }> = [];
    for (let i = 0; i < input.media.length; i += 1) {
      const item = input.media[i];
      if (
        !isPlainObject(item) ||
        !isNonEmptyString(item.id) ||
        !isNonEmptyString(item.url) ||
        typeof item.kind !== 'string' ||
        !MEDIA_KINDS.has(item.kind)
      ) {
        return malformed(`"media[${i}]" is malformed`);
      }
      out.push({ id: item.id, url: item.url, kind: item.kind });
    }
    return out;
  })();
  if (!Array.isArray(mediaResult)) return mediaResult;

  let assetRef: CommunityContentV1['assetRef'];
  if (input.assetRef !== undefined) {
    if (!isPlainObject(input.assetRef)) return malformed('"assetRef" must be an object');
    if (!isNonEmptyString(input.assetRef.templateId)) return malformed('assetRef.templateId missing');
    if (!isNonEmptyString(input.assetRef.assetVersion)) {
      return malformed('assetRef.assetVersion missing');
    }
    if (!isNonEmptyString(input.assetRef.manifestUrl)) {
      return malformed('assetRef.manifestUrl missing');
    }
    if (
      input.assetRef.renderTemplateId !== undefined &&
      !isNonEmptyString(input.assetRef.renderTemplateId)
    ) {
      return malformed('assetRef.renderTemplateId invalid');
    }
    if (input.assetRef.recipeId !== undefined && !isNonEmptyString(input.assetRef.recipeId)) {
      return malformed('assetRef.recipeId invalid');
    }
    assetRef = {
      templateId: input.assetRef.templateId,
      renderTemplateId:
        typeof input.assetRef.renderTemplateId === 'string'
          ? input.assetRef.renderTemplateId
          : undefined,
      recipeId: typeof input.assetRef.recipeId === 'string' ? input.assetRef.recipeId : undefined,
      assetVersion: input.assetRef.assetVersion,
      manifestUrl: input.assetRef.manifestUrl,
    };
  }

  if (
    input.notRecommendedShapes !== undefined &&
    !isPlainObject(input.notRecommendedShapes)
  ) {
    return malformed('"notRecommendedShapes" must be an object');
  }
  if (
    isPlainObject(input.notRecommendedShapes) &&
    Object.values(input.notRecommendedShapes).some((value) => typeof value !== 'string')
  ) {
    return malformed('"notRecommendedShapes" values must be strings');
  }

  const taxonomyChecks: Array<[string, unknown]> = [
    ['subStyleIds', input.subStyleIds],
    ['occasionIds', input.occasionIds],
    ['subjectIds', input.subjectIds],
    ['moodIds', input.moodIds],
    ['effectIds', input.effectIds],
    ['primaryColorIds', input.primaryColorIds],
    ['recommendedShapes', input.recommendedShapes],
    ['supportedShapes', input.supportedShapes],
    ['supportedLengths', input.supportedLengths],
  ];
  const arrays: Record<string, string[]> = {};
  for (const [key, value] of taxonomyChecks) {
    const result = copyStringArray(value, key);
    if (!Array.isArray(result)) return result;
    arrays[key] = result;
  }
  const campaignTagsResult = copyStringArray(input.campaignTags, 'campaignTags');
  if (!Array.isArray(campaignTagsResult)) return campaignTagsResult;

  const verificationLevel = input.verificationLevel as CommunityContentV1['verificationLevel'];
  const fidelity = previewFidelityFromVerification(verificationLevel);
  const previewVerified = verificationLevel !== 'CONCEPT';

  const look: LegacyPartialPublishedLookReadModelV1 = {
    schemaVersion: 1,
    readModelKind: 'LEGACY_PARTIAL',
    lookId: input.contentId,
    contentId: input.contentId,
    title: input.title,
    titleEn: typeof input.titleEn === 'string' ? input.titleEn : undefined,
    publisherId: input.publisherId,
    publisherType: input.publisherType as CommunityContentV1['publisherType'],
    curationStatus: input.curationStatus as 'NONE' | 'FEATURED_BY_OFFICIAL',
    cover: {
      url: input.cover.url,
      kind: (input.cover.kind ?? 'EDITORIAL') as CommunityContentV1['cover']['kind'],
    },
    media: mediaResult as CommunityContentV1['media'],
    mainStyleId: input.mainStyleId,
    subStyleIds: arrays.subStyleIds,
    season: typeof input.season === 'string' ? input.season : undefined,
    occasionIds: arrays.occasionIds,
    subjectIds: arrays.subjectIds,
    moodIds: arrays.moodIds,
    effectIds: arrays.effectIds,
    primaryColorIds: arrays.primaryColorIds,
    recommendedShapes: arrays.recommendedShapes,
    supportedShapes: arrays.supportedShapes,
    notRecommendedShapes: isPlainObject(input.notRecommendedShapes)
      ? { ...(input.notRecommendedShapes as Record<string, string>) }
      : {},
    supportedLengths: arrays.supportedLengths,
    applicationLevel: input.applicationLevel as CommunityContentV1['applicationLevel'],
    verificationLevel,
    assetRef,
    campaignTags: campaignTagsResult,
    publishedAt: input.publishedAt,
    demo: typeof input.demo === 'boolean' ? input.demo : undefined,
    evidence: {
      immutableDesignVersion: { present: false, reason: 'legacy_missing_design_version' },
      previewEvidence: { present: false, reason: 'legacy_missing_preview_hash', fidelity },
      publicationGate: { present: false, reason: 'legacy_missing_publication_gate_evidence' },
      status: {
        sourceStatus: 'PUBLISHED',
        viewable: true,
        previewVerified,
        // Legacy verification labels are not a manufacturing contract. Even a
        // sample/production-labelled record has no immutable process/device
        // evidence in CommunityContentV1, so the adapter must not infer this.
        manufacturable: false,
        productionDispatched: false,
      },
    },
    designVersionId: undefined,
    publicationGateVerified: false,
    sourceContent: structuredClone(input) as unknown as CommunityContentV1,
  };
  return { ok: true, look };
}

/**
 * Project a legacy content index into viewable read models, applying the
 * shared demo-visibility filter. Deterministic: input order is preserved and
 * non-viewable records are dropped.
 */
export function buildLookReadModels(
  contents: CommunityContentV1[],
  mode: string,
): PublishedLookReadModelV1[] {
  const looks: PublishedLookReadModelV1[] = [];
  for (const content of visibleCommunityContents(contents, mode)) {
    const result = adaptLegacyContentToLook(content);
    if (result.ok) looks.push(result.look);
  }
  return looks;
}
