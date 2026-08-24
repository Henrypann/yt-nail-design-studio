/**
 * COMM-ASSET-04A · Community Home merchandising configuration.
 *
 * This contract keeps editorial merchandising separate from discovery facts,
 * recommendation signals and the Studio Official Starter Shelf. It is a
 * read-only Community projection and never writes Wizard or EditorDoc state.
 */

import type { CommunityLookAssetCapabilityReadModelV1 } from './asset-capability-v1';
import type { PublishedLookReadModelV1 } from './v7_1/published-look-read-model';

export const COMMUNITY_HOME_MERCHANDISING_CONTRACT_V1 = 'COMM-v0.7.2-ASSET-04A' as const;

export const COMMUNITY_HOME_MERCHANDISING_STATUSES_V1 = [
  'AWAITING_INPUT',
  'IN_REVIEW',
  'PUBLISHED',
] as const;
export type CommunityHomeMerchandisingStatusV1 =
  (typeof COMMUNITY_HOME_MERCHANDISING_STATUSES_V1)[number];

export interface CommunityHomeBilingualCopyV1 {
  zhCN: string;
  en: string;
}

export interface CommunityHomeBannerV1 {
  bannerId: string;
  imageUrl: string;
  href: string;
  title: CommunityHomeBilingualCopyV1;
  subtitle: CommunityHomeBilingualCopyV1;
}

export interface CommunityHomeEditorialSelectionV1 {
  lookId: string;
  rank: number;
  reason: CommunityHomeBilingualCopyV1;
}

export interface CommunityHomeCollectionV1 {
  collectionId: string;
  title: CommunityHomeBilingualCopyV1;
  summary: CommunityHomeBilingualCopyV1;
  lookIds: string[];
}

export interface CommunityHomeMerchandisingConfigV1 {
  schemaVersion: 1;
  contractRef: typeof COMMUNITY_HOME_MERCHANDISING_CONTRACT_V1;
  revision: number;
  status: CommunityHomeMerchandisingStatusV1;
  banner: CommunityHomeBannerV1 | null;
  editorialSelections: CommunityHomeEditorialSelectionV1[];
  collections: CommunityHomeCollectionV1[];
  owner: string | null;
  reviewedAt: string | null;
  evidenceRefs: string[];
}

export interface CommunityHomeMerchandisingIssueV1 {
  code: string;
  path: string;
  message: string;
}

export type CommunityHomeMerchandisingParseResultV1 =
  | { ok: true; value: CommunityHomeMerchandisingConfigV1 }
  | { ok: false; issues: CommunityHomeMerchandisingIssueV1[] };

export type CommunityHomeMerchandisingProjectionV1 =
  | {
      state: 'AWAITING_INPUT' | 'IN_REVIEW';
      config: CommunityHomeMerchandisingConfigV1;
    }
  | {
      state: 'READY';
      config: CommunityHomeMerchandisingConfigV1;
      editorialSelections: Array<{
        look: PublishedLookReadModelV1;
        capability: CommunityLookAssetCapabilityReadModelV1;
        rank: number;
        reason: CommunityHomeBilingualCopyV1;
      }>;
      collections: Array<{
        collection: CommunityHomeCollectionV1;
        looks: PublishedLookReadModelV1[];
      }>;
    }
  | { state: 'UNAVAILABLE'; issues: CommunityHomeMerchandisingIssueV1[] };

const ROOT_KEYS = [
  'schemaVersion',
  'contractRef',
  'revision',
  'status',
  'banner',
  'editorialSelections',
  'collections',
  'owner',
  'reviewedAt',
  'evidenceRefs',
] as const;
const COPY_KEYS = ['zhCN', 'en'] as const;
const BANNER_KEYS = ['bannerId', 'imageUrl', 'href', 'title', 'subtitle'] as const;
const SELECTION_KEYS = ['lookId', 'rank', 'reason'] as const;
const COLLECTION_KEYS = ['collectionId', 'title', 'summary', 'lookIds'] as const;
const ID = /^[a-z0-9][a-z0-9._:-]*$/;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function add(
  issues: CommunityHomeMerchandisingIssueV1[],
  code: string,
  path: string,
  message: string,
): void {
  if (issues.length < 100) issues.push({ code, path, message });
}

function exactKeys(
  value: Record<string, unknown>,
  allowed: readonly string[],
  path: string,
  issues: CommunityHomeMerchandisingIssueV1[],
): void {
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key)) add(issues, 'unknown_key', `${path}.${key}`, 'unknown key');
  }
  for (const key of allowed) {
    if (!(key in value)) add(issues, 'missing_key', `${path}.${key}`, 'required key is missing');
  }
}

function copy(
  value: unknown,
  path: string,
  issues: CommunityHomeMerchandisingIssueV1[],
): CommunityHomeBilingualCopyV1 | null {
  if (!isObject(value)) {
    add(issues, 'invalid_copy', path, 'must be a bilingual copy object');
    return null;
  }
  exactKeys(value, COPY_KEYS, path, issues);
  for (const key of COPY_KEYS) {
    if (typeof value[key] !== 'string' || value[key].trim().length === 0) {
      add(issues, 'invalid_copy', `${path}.${key}`, 'copy must be a non-empty string');
    }
  }
  return issues.some((issue) => issue.path.startsWith(path))
    ? null
    : value as unknown as CommunityHomeBilingualCopyV1;
}

function safeRootRelative(value: unknown): value is string {
  return typeof value === 'string'
    && value.startsWith('/')
    && !value.startsWith('//')
    && !value.includes('\\');
}

function stringArray(
  value: unknown,
  path: string,
  issues: CommunityHomeMerchandisingIssueV1[],
): value is string[] {
  if (!Array.isArray(value) || !value.every((item) => typeof item === 'string' && item.trim().length > 0)) {
    add(issues, 'invalid_string_array', path, 'must be an array of non-empty strings');
    return false;
  }
  if (new Set(value).size !== value.length) add(issues, 'duplicate_value', path, 'values must be unique');
  return true;
}

export function parseCommunityHomeMerchandisingConfigV1(
  input: unknown,
): CommunityHomeMerchandisingParseResultV1 {
  const issues: CommunityHomeMerchandisingIssueV1[] = [];
  if (!isObject(input)) return { ok: false, issues: [{ code: 'invalid_root', path: '$', message: 'must be an object' }] };
  exactKeys(input, ROOT_KEYS, '$', issues);
  if (input.schemaVersion !== 1) add(issues, 'invalid_schema_version', '$.schemaVersion', 'must be 1');
  if (input.contractRef !== COMMUNITY_HOME_MERCHANDISING_CONTRACT_V1) {
    add(issues, 'invalid_contract_ref', '$.contractRef', 'unexpected contractRef');
  }
  if (!Number.isSafeInteger(input.revision) || Number(input.revision) < 1) {
    add(issues, 'invalid_revision', '$.revision', 'must be a positive safe integer');
  }
  if (!COMMUNITY_HOME_MERCHANDISING_STATUSES_V1.includes(input.status as CommunityHomeMerchandisingStatusV1)) {
    add(issues, 'invalid_status', '$.status', 'invalid status');
  }
  if (input.owner !== null && (typeof input.owner !== 'string' || !ID.test(input.owner))) {
    add(issues, 'invalid_owner', '$.owner', 'must be null or a stable owner id');
  }
  if (input.reviewedAt !== null && (
    typeof input.reviewedAt !== 'string'
    || Number.isNaN(Date.parse(input.reviewedAt))
    || new Date(input.reviewedAt).toISOString() !== input.reviewedAt
  )) {
    add(issues, 'invalid_reviewed_at', '$.reviewedAt', 'must be null or canonical ISO time');
  }
  stringArray(input.evidenceRefs, '$.evidenceRefs', issues);

  if (input.banner !== null) {
    if (!isObject(input.banner)) {
      add(issues, 'invalid_banner', '$.banner', 'must be an object or null');
    } else {
      exactKeys(input.banner, BANNER_KEYS, '$.banner', issues);
      if (typeof input.banner.bannerId !== 'string' || !ID.test(input.banner.bannerId)) {
        add(issues, 'invalid_banner_id', '$.banner.bannerId', 'invalid bannerId');
      }
      if (!safeRootRelative(input.banner.imageUrl)) {
        add(issues, 'unsafe_url', '$.banner.imageUrl', 'imageUrl must be root-relative');
      }
      if (!safeRootRelative(input.banner.href)) {
        add(issues, 'unsafe_url', '$.banner.href', 'href must be root-relative');
      }
      copy(input.banner.title, '$.banner.title', issues);
      copy(input.banner.subtitle, '$.banner.subtitle', issues);
    }
  }

  if (!Array.isArray(input.editorialSelections)) {
    add(issues, 'invalid_editorial_selections', '$.editorialSelections', 'must be an array');
  } else {
    const lookIds: string[] = [];
    const ranks: number[] = [];
    input.editorialSelections.forEach((selection, index) => {
      const path = `$.editorialSelections[${index}]`;
      if (!isObject(selection)) {
        add(issues, 'invalid_editorial_selection', path, 'must be an object');
        return;
      }
      exactKeys(selection, SELECTION_KEYS, path, issues);
      if (typeof selection.lookId !== 'string' || !ID.test(selection.lookId)) {
        add(issues, 'invalid_look_id', `${path}.lookId`, 'invalid lookId');
      } else lookIds.push(selection.lookId);
      if (!Number.isSafeInteger(selection.rank) || Number(selection.rank) < 1) {
        add(issues, 'invalid_rank', `${path}.rank`, 'rank must be a positive safe integer');
      } else ranks.push(Number(selection.rank));
      copy(selection.reason, `${path}.reason`, issues);
    });
    if (new Set(lookIds).size !== lookIds.length) add(issues, 'duplicate_look_id', '$.editorialSelections', 'lookIds must be unique');
    if (new Set(ranks).size !== ranks.length) add(issues, 'duplicate_rank', '$.editorialSelections', 'ranks must be unique');
  }

  if (!Array.isArray(input.collections)) {
    add(issues, 'invalid_collections', '$.collections', 'must be an array');
  } else {
    const collectionIds: string[] = [];
    input.collections.forEach((collection, index) => {
      const path = `$.collections[${index}]`;
      if (!isObject(collection)) {
        add(issues, 'invalid_collection', path, 'must be an object');
        return;
      }
      exactKeys(collection, COLLECTION_KEYS, path, issues);
      if (typeof collection.collectionId !== 'string' || !ID.test(collection.collectionId)) {
        add(issues, 'invalid_collection_id', `${path}.collectionId`, 'invalid collectionId');
      } else collectionIds.push(collection.collectionId);
      copy(collection.title, `${path}.title`, issues);
      copy(collection.summary, `${path}.summary`, issues);
      stringArray(collection.lookIds, `${path}.lookIds`, issues);
      if (Array.isArray(collection.lookIds) && collection.lookIds.length === 0) {
        add(issues, 'empty_collection', `${path}.lookIds`, 'a collection must contain at least one look');
      }
    });
    if (new Set(collectionIds).size !== collectionIds.length) {
      add(issues, 'duplicate_collection_id', '$.collections', 'collectionIds must be unique');
    }
  }

  const status = input.status as CommunityHomeMerchandisingStatusV1;
  const hasContent = input.banner !== null
    || (Array.isArray(input.editorialSelections) && input.editorialSelections.length > 0)
    || (Array.isArray(input.collections) && input.collections.length > 0);
  if (status === 'AWAITING_INPUT' && (
    hasContent || input.owner !== null || input.reviewedAt !== null || (Array.isArray(input.evidenceRefs) && input.evidenceRefs.length > 0)
  )) {
    add(issues, 'awaiting_input_must_be_empty', '$', 'AWAITING_INPUT cannot contain unreviewed merchandising claims');
  }
  if (status === 'IN_REVIEW' && (input.owner === null || input.reviewedAt !== null)) {
    add(issues, 'review_state_mismatch', '$', 'IN_REVIEW requires owner and no reviewedAt');
  }
  if (status === 'PUBLISHED') {
    if (input.owner === null || input.reviewedAt === null) {
      add(issues, 'publication_evidence_missing', '$', 'PUBLISHED requires owner and reviewedAt');
    }
    if (!Array.isArray(input.evidenceRefs) || input.evidenceRefs.length === 0) {
      add(issues, 'publication_evidence_missing', '$.evidenceRefs', 'PUBLISHED requires evidenceRefs');
    }
    if (!Array.isArray(input.editorialSelections) || input.editorialSelections.length === 0) {
      add(issues, 'editorial_selection_missing', '$.editorialSelections', 'PUBLISHED requires editorial selections');
    }
  }

  return issues.length > 0
    ? { ok: false, issues }
    : { ok: true, value: structuredClone(input) as unknown as CommunityHomeMerchandisingConfigV1 };
}

export function projectCommunityHomeMerchandisingV1(input: {
  config: CommunityHomeMerchandisingConfigV1;
  looks: readonly PublishedLookReadModelV1[];
  capabilities: readonly CommunityLookAssetCapabilityReadModelV1[];
}): CommunityHomeMerchandisingProjectionV1 {
  if (input.config.status !== 'PUBLISHED') {
    return { state: input.config.status, config: structuredClone(input.config) };
  }
  const issues: CommunityHomeMerchandisingIssueV1[] = [];
  const looksById = new Map(input.looks.map((look) => [look.lookId, look]));
  const capabilityById = new Map(input.capabilities.map((entry) => [entry.contentId, entry]));
  const referencedIds = new Set([
    ...input.config.editorialSelections.map((selection) => selection.lookId),
    ...input.config.collections.flatMap((collection) => collection.lookIds),
  ]);
  for (const lookId of referencedIds) {
    const look = looksById.get(lookId);
    const capability = capabilityById.get(lookId);
    if (!look) add(issues, 'look_unavailable', `look:${lookId}`, 'referenced look is not in the governed public read model');
    if (!capability) add(issues, 'capability_unavailable', `look:${lookId}`, 'asset capability is unavailable');
    else if (!capability.permissions.public) add(issues, 'rights_blocked', `look:${lookId}`, 'look is not public eligible');
  }
  if (issues.length > 0) return { state: 'UNAVAILABLE', issues };

  return {
    state: 'READY',
    config: structuredClone(input.config),
    editorialSelections: input.config.editorialSelections
      .map((selection) => ({
        look: looksById.get(selection.lookId)!,
        capability: capabilityById.get(selection.lookId)!,
        rank: selection.rank,
        reason: structuredClone(selection.reason),
      }))
      .sort((a, b) => a.rank - b.rank),
    collections: input.config.collections.map((collection) => ({
      collection: structuredClone(collection),
      looks: collection.lookIds.map((lookId) => looksById.get(lookId)!),
    })),
  };
}
