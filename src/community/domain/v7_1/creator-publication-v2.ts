/**
 * Community v0.7.2 · COMM-v0.7.2-TAX-02 Creator Publication Store V2.
 *
 * V2 is a SEPARATE storage contract from the GEN-V7.1-04 V1 store
 * (`creator-publication.ts`):
 *
 * - schemaVersion 2, same `kind` (`CREATOR_PUBLICATION_STORE`), drafts are
 *   `CreatorPublicationDraftV2` (V1 fields plus a structured discovery
 *   authoring block), `looks` stays `PublishedLookV1[]` UNCHANGED, and a
 *   `discovery` map keyed by lookId carries the published
 *   `CommunityDiscoveryMetadataV1` + `CommunityCurationMetadataV1` envelope
 *   snapshot (TAX-01 contracts).
 * - `parseCreatorPublicationStoreV2` accepts valid V2 and PURE-UPCASTS valid
 *   V1 (`upcastCreatorPublicationStoreV1`). Upcast preserves every compatible
 *   draft/look value; existing V1 looks get NO invented discovery entry and
 *   therefore fail closed from public browse. Reads never write.
 * - Structural parsing is OFFLINE: tag ids are opaque non-empty strings here.
 *   Taxonomy resolution happens when projecting to read models, never while
 *   parsing storage.
 * - Draft V2 carries structured discovery-authoring state. Any change to
 *   styleIds / recommendedShapeIds / sceneIds / themeIds / techniqueIds /
 *   rights / makeability / source declarations increments contentRevision and
 *   thereby invalidates any prior PUBLIC review binding (reviews are bound to
 *   the exact revision).
 * - Publishing snapshots the discovery/curation envelope into the store.
 *   New creator PUBLIC content requires >=1 style, >=1 recommended shape,
 *   non-PENDING rights, a makeability classification and normal moderation
 *   clearance — the legacy French NEEDS_STYLE_REVIEW exception NEVER applies
 *   to creator content.
 *
 * This module is pure and Node-testable (no browser globals, no env access,
 * no clock). It imports the TAX-01 enums (pure) and the V1 store for the
 * upcast path.
 */

import type { PublishedLookV1, VisibilityV1 } from './design-content-model';
import { parsePublishedLookV1 } from './design-content-parse';
import {
  MAKEABILITY_CLASSIFICATIONS,
  MIGRATION_STATES,
  RIGHTS_STATUSES,
  ISO_TIMESTAMP_PATTERN,
  type MakeabilityClassification,
  type MigrationState,
  type RightsStatus,
} from '../taxonomy-v2/contract';
import type {
  CommunityCurationMetadataV1,
  CommunityDiscoveryMetadataV1,
  CommunityTaxonomyV2,
  SubjectRefV1,
} from '../taxonomy-v2/types';
import { resolveTagId } from '../taxonomy-v2/resolve';
import type { PublishPackageV1 } from '@/studio/publishing';
import { parsePublishPackageV1 } from '@/studio/publishing';
import {
  CREATOR_PUBLICATION_STORE_KIND,
  parseCreatorPublicationStoreV1,
  type CreatorPublicationResultV1,
  type CreatorPublicationSourceV1,
  type CreatorPublicationStageV1,
  type CreatorPublicationStoreV1,
} from './creator-publication';

export const CREATOR_PUBLICATION_SCHEMA_VERSION_V2 = 2 as const;
export { CREATOR_PUBLICATION_STORE_KIND };

export type CreatorPublicationResultV2<T> =
  | { ok: true; value: T }
  | { ok: false; code: 'invalid' | 'not_found' | 'public_locked' | 'public_gate_incomplete' | 'persist_failed' | 'conflict'; message: string };

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Structured discovery-authoring state carried by every V2 draft. Tag ids are
 * TAX-01 taxonomy ids (selected from the taxonomy-v2 fixture in the UI);
 * resolution is enforced at publish/projection time, not while parsing.
 */
export interface CreatorDiscoveryAuthoringV2 {
  styleIds: string[];
  recommendedShapeIds: string[];
  sceneIds: string[];
  themeIds: string[];
  techniqueIds: string[];
  lengthIds: string[];
  rights: RightsStatus;
  makeability: MakeabilityClassification;
}

export interface CreatorPublicationDraftV2 {
  schemaVersion: 2;
  draftId: string;
  creatorProfileId: string;
  package: PublishPackageV1;
  title: string;
  tags: string[];
  visibility: VisibilityV1;
  sourceType: CreatorPublicationSourceV1;
  sourceAttribution?: string;
  copyrightDeclared: boolean;
  sourceDeclared: boolean;
  /** Increments when governance-reviewed content (incl. discovery) changes. */
  contentRevision: number;
  step: CreatorPublicationStageV1;
  discovery: CreatorDiscoveryAuthoringV2;
  createdAt: string;
  updatedAt: string;
}

/** Published envelope snapshot keyed by lookId (TAX-01 discovery + curation). */
export interface StoredDiscoveryEnvelopeV2 {
  discovery: CommunityDiscoveryMetadataV1;
  curation: CommunityCurationMetadataV1;
}

export interface CreatorPublicationStoreV2 {
  schemaVersion: 2;
  kind: typeof CREATOR_PUBLICATION_STORE_KIND;
  drafts: CreatorPublicationDraftV2[];
  /** Unchanged PublishedLookV1 contract documents. */
  looks: PublishedLookV1[];
  /** Discovery/curation snapshots for published looks; absent ⇒ fail closed. */
  discovery: Record<string, StoredDiscoveryEnvelopeV2>;
}

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

function clone<T>(value: T): T { return structuredClone(value); }

const ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const ISO = ISO_TIMESTAMP_PATTERN;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function stringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => nonEmptyString(item));
}

function hasDuplicates(values: readonly string[]): boolean {
  return new Set(values).size !== values.length;
}

function validTags(tags: unknown): tags is string[] {
  return Array.isArray(tags) && tags.length <= 12
    && tags.every((tag) => typeof tag === 'string' && tag.trim().length > 0 && tag.length <= 32)
    && new Set(tags).size === tags.length;
}

/** Empty (unset) discovery authoring for brand-new drafts. */
export function emptyDiscoveryAuthoringV2(): CreatorDiscoveryAuthoringV2 {
  return {
    styleIds: [],
    recommendedShapeIds: [],
    sceneIds: [],
    themeIds: [],
    techniqueIds: [],
    lengthIds: [],
    rights: 'PENDING',
    makeability: 'CONCEPT_ONLY',
  };
}

export function createEmptyCreatorPublicationStoreV2(): CreatorPublicationStoreV2 {
  return { schemaVersion: 2, kind: CREATOR_PUBLICATION_STORE_KIND, drafts: [], looks: [], discovery: {} };
}

// ---------------------------------------------------------------------------
// Offline structural parse of the stored discovery envelope (no taxonomy)
// ---------------------------------------------------------------------------

function discoverySubjectId(lookId: string): string {
  return `look:${lookId}`;
}

function parseSubjectRef(value: unknown, lookId: string): SubjectRefV1 | null {
  if (!isPlainObject(value) || value.kind !== 'PUBLISHED_LOOK' || !nonEmptyString(value.id)) return null;
  if (Object.keys(value).some((key) => !['kind', 'id'].includes(key))) return null;
  if (value.id !== discoverySubjectId(lookId)) return null;
  return { kind: 'PUBLISHED_LOOK', id: value.id };
}

function parseStringArray(value: unknown): string[] | null {
  if (!stringArray(value) || hasDuplicates(value)) return null;
  return [...value];
}

function parseDiscoveryEntryV2(value: unknown, lookId: string): CommunityDiscoveryMetadataV1 | null {
  if (!isPlainObject(value)) return null;
  const allowed = [
    'schemaVersion', 'contractRef', 'subjectRef', 'styleIds', 'recommendedShapeIds',
    'sceneIds', 'themeIds', 'techniqueIds', 'lengthIds', 'makeability', 'rights',
    'migration', 'updatedAt',
  ];
  if (Object.keys(value).some((key) => !allowed.includes(key))) return null;
  if (value.schemaVersion !== 1 || value.contractRef !== 'COMM-v0.7.2-TAX-01') return null;
  const subjectRef = parseSubjectRef(value.subjectRef, lookId);
  if (!subjectRef) return null;
  const styleIds = parseStringArray(value.styleIds);
  const recommendedShapeIds = parseStringArray(value.recommendedShapeIds);
  const sceneIds = parseStringArray(value.sceneIds);
  const themeIds = parseStringArray(value.themeIds);
  const techniqueIds = parseStringArray(value.techniqueIds);
  const lengthIds = parseStringArray(value.lengthIds);
  if (!styleIds || !recommendedShapeIds || !sceneIds || !themeIds || !techniqueIds || !lengthIds) return null;
  if (!nonEmptyString(value.updatedAt) || !ISO.test(value.updatedAt)) return null;
  if (!isPlainObject(value.makeability)) return null;
  const makeability = value.makeability;
  if (Object.keys(makeability).some((key) => !['classification', 'capabilityRef', 'assetRefs', 'evidenceRefs'].includes(key))) return null;
  if (!MAKEABILITY_CLASSIFICATIONS.includes(makeability.classification as MakeabilityClassification)) return null;
  if (makeability.capabilityRef !== undefined && !nonEmptyString(makeability.capabilityRef)) return null;
  if (!stringArray(makeability.assetRefs) || hasDuplicates(makeability.assetRefs)) return null;
  if (!stringArray(makeability.evidenceRefs) || hasDuplicates(makeability.evidenceRefs)) return null;
  if (!isPlainObject(value.rights)) return null;
  const rights = value.rights;
  if (Object.keys(rights).some((key) => !['status', 'evidenceRefs'].includes(key))) return null;
  if (!RIGHTS_STATUSES.includes(rights.status as RightsStatus)) return null;
  if (!stringArray(rights.evidenceRefs) || hasDuplicates(rights.evidenceRefs)) return null;
  if (!isPlainObject(value.migration)) return null;
  const migration = value.migration;
  if (Object.keys(migration).some((key) => !['state', 'legacyStyleIds', 'migratedAt', 'note'].includes(key))) return null;
  if (!MIGRATION_STATES.includes(migration.state as MigrationState)) return null;
  if (!stringArray(migration.legacyStyleIds) || hasDuplicates(migration.legacyStyleIds)) return null;
  if (!nonEmptyString(migration.migratedAt) || !ISO.test(migration.migratedAt)) return null;
  if (migration.note !== undefined && typeof migration.note !== 'string') return null;
  return {
    schemaVersion: 1,
    contractRef: 'COMM-v0.7.2-TAX-01',
    subjectRef,
    styleIds,
    recommendedShapeIds,
    sceneIds,
    themeIds,
    techniqueIds,
    lengthIds,
    makeability: {
      classification: makeability.classification as MakeabilityClassification,
      ...(typeof makeability.capabilityRef === 'string' ? { capabilityRef: makeability.capabilityRef } : {}),
      assetRefs: [...makeability.assetRefs],
      evidenceRefs: [...makeability.evidenceRefs],
    },
    rights: { status: rights.status as RightsStatus, evidenceRefs: [...rights.evidenceRefs] },
    migration: {
      state: migration.state as MigrationState,
      legacyStyleIds: [...migration.legacyStyleIds],
      migratedAt: migration.migratedAt,
      ...(typeof migration.note === 'string' ? { note: migration.note } : {}),
    },
    updatedAt: value.updatedAt,
  };
}

function parseCurationEntryV2(value: unknown, lookId: string): CommunityCurationMetadataV1 | null {
  if (!isPlainObject(value)) return null;
  const allowed = ['schemaVersion', 'contractRef', 'subjectRef', 'curated', 'curatedBy', 'curatedAt', 'campaignTags', 'featuredChannels', 'evidenceRefs'];
  if (Object.keys(value).some((key) => !allowed.includes(key))) return null;
  if (value.schemaVersion !== 1 || value.contractRef !== 'COMM-v0.7.2-TAX-01') return null;
  const subjectRef = parseSubjectRef(value.subjectRef, lookId);
  if (!subjectRef) return null;
  if (typeof value.curated !== 'boolean') return null;
  if (value.curatedBy !== undefined && !nonEmptyString(value.curatedBy)) return null;
  if (value.curatedAt !== undefined && (!nonEmptyString(value.curatedAt) || !ISO.test(value.curatedAt))) return null;
  const campaignTags = parseStringArray(value.campaignTags);
  const featuredChannels = parseStringArray(value.featuredChannels);
  const evidenceRefs = parseStringArray(value.evidenceRefs);
  if (!campaignTags || !featuredChannels || !evidenceRefs) return null;
  return {
    schemaVersion: 1,
    contractRef: 'COMM-v0.7.2-TAX-01',
    subjectRef,
    curated: value.curated,
    ...(typeof value.curatedBy === 'string' ? { curatedBy: value.curatedBy } : {}),
    ...(typeof value.curatedAt === 'string' ? { curatedAt: value.curatedAt } : {}),
    campaignTags,
    featuredChannels,
    evidenceRefs,
  };
}

function parseStoredEnvelopeV2(value: unknown, lookId: string): StoredDiscoveryEnvelopeV2 | null {
  if (!isPlainObject(value)) return null;
  if (Object.keys(value).some((key) => !['discovery', 'curation'].includes(key))) return null;
  const discovery = parseDiscoveryEntryV2(value.discovery, lookId);
  const curation = parseCurationEntryV2(value.curation, lookId);
  if (!discovery || !curation) return null;
  return { discovery, curation };
}

function parseDiscoveryAuthoringV2(value: unknown): CreatorDiscoveryAuthoringV2 | null {
  if (!isPlainObject(value)) return null;
  const allowed = ['styleIds', 'recommendedShapeIds', 'sceneIds', 'themeIds', 'techniqueIds', 'lengthIds', 'rights', 'makeability'];
  if (Object.keys(value).some((key) => !allowed.includes(key))) return null;
  const styleIds = parseStringArray(value.styleIds);
  const recommendedShapeIds = parseStringArray(value.recommendedShapeIds);
  const sceneIds = parseStringArray(value.sceneIds);
  const themeIds = parseStringArray(value.themeIds);
  const techniqueIds = parseStringArray(value.techniqueIds);
  const lengthIds = parseStringArray(value.lengthIds);
  if (!styleIds || !recommendedShapeIds || !sceneIds || !themeIds || !techniqueIds || !lengthIds) return null;
  if (!RIGHTS_STATUSES.includes(value.rights as RightsStatus)) return null;
  if (!MAKEABILITY_CLASSIFICATIONS.includes(value.makeability as MakeabilityClassification)) return null;
  return {
    styleIds, recommendedShapeIds, sceneIds, themeIds, techniqueIds, lengthIds,
    rights: value.rights as RightsStatus,
    makeability: value.makeability as MakeabilityClassification,
  };
}

// ---------------------------------------------------------------------------
// Strict store parse (V2) + pure V1 upcast
// ---------------------------------------------------------------------------

export function parseCreatorPublicationDraftV2(input: unknown): CreatorPublicationDraftV2 | null {
  if (!isPlainObject(input)) return null;
  const keys = ['schemaVersion', 'draftId', 'creatorProfileId', 'package', 'title', 'tags', 'visibility',
    'sourceType', 'sourceAttribution', 'copyrightDeclared', 'sourceDeclared', 'contentRevision', 'step',
    'discovery', 'createdAt', 'updatedAt'];
  if (Object.keys(input).some((key) => !keys.includes(key))) return null;
  const draft = input as unknown as CreatorPublicationDraftV2;
  if (draft.schemaVersion !== 2 || !ID.test(draft.draftId) || !ID.test(draft.creatorProfileId)
    || !parsePublishPackageV1(draft.package).ok
    || typeof draft.title !== 'string' || draft.title.length > 80
    || !validTags(draft.tags) || !['PRIVATE', 'UNLISTED', 'PUBLIC'].includes(draft.visibility)
    || !['ORIGINAL', 'REMIX', 'IMPORTED', 'AI_ASSISTED'].includes(draft.sourceType)
    || (draft.sourceAttribution !== undefined && (typeof draft.sourceAttribution !== 'string' || draft.sourceAttribution.length > 280))
    || typeof draft.copyrightDeclared !== 'boolean' || typeof draft.sourceDeclared !== 'boolean'
    || !Number.isInteger(draft.contentRevision) || draft.contentRevision < 1
    || ![1, 2, 3].includes(draft.step) || !ISO.test(draft.createdAt) || !ISO.test(draft.updatedAt)) return null;
  const discovery = parseDiscoveryAuthoringV2(draft.discovery);
  if (!discovery) return null;
  return {
    schemaVersion: 2, draftId: draft.draftId, creatorProfileId: draft.creatorProfileId,
    package: clone(draft.package), title: draft.title, tags: [...draft.tags], visibility: draft.visibility,
    sourceType: draft.sourceType,
    ...(typeof draft.sourceAttribution === 'string' ? { sourceAttribution: draft.sourceAttribution } : {}),
    copyrightDeclared: draft.copyrightDeclared, sourceDeclared: draft.sourceDeclared,
    contentRevision: draft.contentRevision, step: draft.step, discovery,
    createdAt: draft.createdAt, updatedAt: draft.updatedAt,
  };
}

/**
 * Strict V2 parse; valid V1 payloads are PURE-UPCAST (never written back).
 * Rejections: unknown keys, malformed drafts/looks, orphan or duplicate
 * discovery entries, subjectRef mismatches, malformed stored envelopes.
 */
export function parseCreatorPublicationStoreV2(input: unknown): CreatorPublicationStoreV2 | null {
  if (!isPlainObject(input)) return null;
  if (input.schemaVersion === 1) {
    const legacy = parseCreatorPublicationStoreV1(input);
    return legacy ? upcastCreatorPublicationStoreV1(legacy) : null;
  }
  if (input.schemaVersion !== 2) return null;
  if (Object.keys(input).some((key) => !['schemaVersion', 'kind', 'drafts', 'looks', 'discovery'].includes(key))
    || input.kind !== CREATOR_PUBLICATION_STORE_KIND
    || !Array.isArray(input.drafts) || !Array.isArray(input.looks)
    || !isPlainObject(input.discovery)) return null;
  const drafts: CreatorPublicationDraftV2[] = [];
  const ids = new Set<string>();
  for (const item of input.drafts) {
    const draft = parseCreatorPublicationDraftV2(item);
    if (!draft || ids.has(draft.draftId)) return null;
    ids.add(draft.draftId);
    drafts.push(draft);
  }
  const looks: PublishedLookV1[] = [];
  for (const look of input.looks) {
    const parsed = parsePublishedLookV1(look);
    if (!parsed.ok || ids.has(parsed.value.lookId)) return null;
    ids.add(parsed.value.lookId);
    looks.push(clone(parsed.value));
  }
  const discovery: Record<string, StoredDiscoveryEnvelopeV2> = {};
  const lookIds = new Set(looks.map((look) => look.lookId));
  for (const [lookId, envelope] of Object.entries(input.discovery)) {
    // Orphan discovery entry (no matching published look) is rejected.
    if (!lookIds.has(lookId)) return null;
    const parsed = parseStoredEnvelopeV2(envelope, lookId);
    if (!parsed) return null;
    discovery[lookId] = parsed;
  }
  return { schemaVersion: 2, kind: CREATOR_PUBLICATION_STORE_KIND, drafts, looks, discovery };
}

/**
 * Pure V1 → V2 upcast. Every compatible draft/look value is preserved.
 * Existing V1 looks receive NO invented discovery entry: they fail closed
 * from public browse until a real envelope exists.
 */
export function upcastCreatorPublicationStoreV1(store: CreatorPublicationStoreV1): CreatorPublicationStoreV2 {
  return {
    schemaVersion: 2,
    kind: CREATOR_PUBLICATION_STORE_KIND,
    drafts: store.drafts.map((draft) => ({
      ...clone(draft),
      schemaVersion: 2,
      discovery: emptyDiscoveryAuthoringV2(),
    })),
    looks: store.looks.map((look) => clone(look)),
    discovery: {},
  };
}

// ---------------------------------------------------------------------------
// Draft / publish operations (V2)
// ---------------------------------------------------------------------------

export function createCreatorPublicationDraftV2(input: {
  store: CreatorPublicationStoreV2; draftId: string; creatorProfileId: string; package: PublishPackageV1; now: string;
}): CreatorPublicationResultV2<CreatorPublicationStoreV2> {
  if (!ID.test(input.draftId) || !ID.test(input.creatorProfileId) || !ISO.test(input.now) || !parsePublishPackageV1(input.package).ok) {
    return { ok: false, code: 'invalid', message: 'invalid publication draft input' };
  }
  if (input.store.drafts.some((item) => item.draftId === input.draftId) || input.store.looks.some((item) => item.lookId === input.draftId)) {
    return { ok: false, code: 'conflict', message: 'publication id already exists' };
  }
  const draft: CreatorPublicationDraftV2 = {
    schemaVersion: 2, draftId: input.draftId, creatorProfileId: input.creatorProfileId, package: clone(input.package),
    title: '', tags: [], visibility: 'PRIVATE', sourceType: 'ORIGINAL', copyrightDeclared: false,
    sourceDeclared: false, contentRevision: 1, step: 1, discovery: emptyDiscoveryAuthoringV2(),
    createdAt: input.now, updatedAt: input.now,
  };
  return { ok: true, value: { ...clone(input.store), drafts: [...input.store.drafts.map(clone), draft] } };
}

const REVIEW_KEYS = ['title', 'tags', 'sourceType', 'sourceAttribution', 'copyrightDeclared', 'sourceDeclared', 'discovery'] as const;

function replaceDraft(store: CreatorPublicationStoreV2, draft: CreatorPublicationDraftV2): CreatorPublicationStoreV2 {
  return { ...clone(store), drafts: store.drafts.map((item) => item.draftId === draft.draftId ? clone(draft) : clone(item)) };
}

export type CreatorPublicationDraftPatchV2 = Partial<Pick<CreatorPublicationDraftV2,
  'title' | 'tags' | 'visibility' | 'sourceType' | 'sourceAttribution' | 'copyrightDeclared'
  | 'sourceDeclared' | 'step' | 'discovery'>>;

export function updateCreatorPublicationDraftV2(input: {
  store: CreatorPublicationStoreV2; draftId: string; patch: CreatorPublicationDraftPatchV2; now: string; publicGovernanceCleared?: boolean;
}): CreatorPublicationResultV2<CreatorPublicationStoreV2> {
  const current = input.store.drafts.find((item) => item.draftId === input.draftId);
  if (!current) return { ok: false, code: 'not_found', message: 'publication draft not found' };
  if ((input.patch.visibility as VisibilityV1 | undefined) === 'PUBLIC' && !input.publicGovernanceCleared) return { ok: false, code: 'public_locked', message: 'PUBLIC publishing requires Governance' };
  const reviewContentChanged = REVIEW_KEYS.some((key) => Object.prototype.hasOwnProperty.call(input.patch, key)
    && JSON.stringify(input.patch[key]) !== JSON.stringify(current[key]));
  const candidate = {
    ...clone(current), ...clone(input.patch),
    contentRevision: current.contentRevision + (reviewContentChanged ? 1 : 0),
    updatedAt: input.now,
  };
  const probe = parseCreatorPublicationStoreV2({ ...clone(input.store), drafts: replaceDraft(input.store, candidate).drafts });
  return probe ? { ok: true, value: probe } : { ok: false, code: 'invalid', message: 'invalid publication metadata' };
}

/**
 * Pure resolution gate used by the application service right before a PUBLIC
 * commit: every authored tag must resolve in the taxonomy, and the public
 * minimums (>=1 resolved style, >=1 resolved shape, non-PENDING rights,
 * makeability classification) must hold. Never applied to the legacy French
 * NEEDS_STYLE_REVIEW exception — that exception does not exist for creator
 * content.
 */
export function creatorDiscoveryResolutionReasonsV2(
  authoring: CreatorDiscoveryAuthoringV2,
  taxonomy: CommunityTaxonomyV2,
): string[] {
  const reasons: string[] = [];
  const resolvedStyles = authoring.styleIds.filter((id) => resolveTagId(taxonomy, id)?.dimension === 'STYLE').length;
  if (resolvedStyles === 0) reasons.push('missing >=1 resolved overall style tag');
  const resolvedShapes = authoring.recommendedShapeIds.filter((id) => resolveTagId(taxonomy, id)?.dimension === 'SHAPE').length;
  if (resolvedShapes === 0) reasons.push('missing >=1 resolved recommended shape tag');
  const unresolved = [...authoring.styleIds, ...authoring.recommendedShapeIds, ...authoring.sceneIds,
    ...authoring.themeIds, ...authoring.techniqueIds, ...authoring.lengthIds]
    .filter((id) => !resolveTagId(taxonomy, id));
  if (unresolved.length > 0) reasons.push(`unresolved taxonomy tags: ${[...new Set(unresolved)].join(', ')}`);
  if (authoring.rights === 'PENDING') reasons.push('rights status PENDING is never public');
  if (!MAKEABILITY_CLASSIFICATIONS.includes(authoring.makeability)) reasons.push('missing makeability classification');
  return reasons;
}

/**
 * Build the TAX-01 discovery/curation envelope snapshot for a draft. Exported
 * so the application service can validate the same envelope against the
 * taxonomy before the domain commit (resolve at projection time).
 */
export function buildCreatorDiscoveryEnvelopeV2(
  draft: CreatorPublicationDraftV2,
  lookId: string,
  now: string,
): StoredDiscoveryEnvelopeV2 {
  const subjectRef: SubjectRefV1 = { kind: 'PUBLISHED_LOOK', id: discoverySubjectId(lookId) };
  const discovery: CommunityDiscoveryMetadataV1 = {
    schemaVersion: 1,
    contractRef: 'COMM-v0.7.2-TAX-01',
    subjectRef,
    styleIds: [...draft.discovery.styleIds],
    recommendedShapeIds: [...draft.discovery.recommendedShapeIds],
    sceneIds: [...draft.discovery.sceneIds],
    themeIds: [...draft.discovery.themeIds],
    techniqueIds: [...draft.discovery.techniqueIds],
    lengthIds: [...draft.discovery.lengthIds],
    makeability: { classification: draft.discovery.makeability, assetRefs: [], evidenceRefs: [] },
    rights: { status: draft.discovery.rights, evidenceRefs: [] },
    migration: { state: 'NONE', legacyStyleIds: [], migratedAt: now },
    updatedAt: now,
  };
  const curation: CommunityCurationMetadataV1 = {
    schemaVersion: 1,
    contractRef: 'COMM-v0.7.2-TAX-01',
    subjectRef,
    curated: false,
    campaignTags: [],
    featuredChannels: [],
    evidenceRefs: [],
  };
  return { discovery, curation };
}

/**
 * Publish a V2 draft: snapshots the discovery/curation envelope into the
 * store. PUBLIC additionally requires the full structural gate (>=1 style,
 * >=1 recommended shape, non-PENDING rights, makeability classification) and
 * explicit moderation clearance. The legacy French NEEDS_STYLE_REVIEW
 * exception NEVER applies to creator content. Taxonomy resolution is enforced
 * by the caller (application service) before commit.
 */
export function publishCreatorDraftV2(input: {
  store: CreatorPublicationStoreV2; draftId: string; lookId: string; now: string; publicGovernanceCleared?: boolean;
}): CreatorPublicationResultV2<CreatorPublicationStoreV2> {
  const draft = input.store.drafts.find((item) => item.draftId === input.draftId);
  if (!draft) return { ok: false, code: 'not_found', message: 'publication draft not found' };
  if (!ID.test(input.lookId) || !ISO.test(input.now) || !draft.title.trim() || !draft.copyrightDeclared || !draft.sourceDeclared) {
    return { ok: false, code: 'invalid', message: 'metadata and source declarations are required' };
  }
  if ((draft.visibility as VisibilityV1) === 'PUBLIC' && !input.publicGovernanceCleared) return { ok: false, code: 'public_locked', message: 'PUBLIC publishing requires explicit governance clearance' };
  if ((draft.visibility as VisibilityV1) === 'PUBLIC') {
    const discovery = draft.discovery;
    const reasons: string[] = [];
    if (discovery.styleIds.length === 0) reasons.push('missing >=1 overall style tag');
    if (discovery.recommendedShapeIds.length === 0) reasons.push('missing >=1 recommended shape tag');
    if (discovery.rights === 'PENDING') reasons.push('rights status PENDING is never public');
    if (!MAKEABILITY_CLASSIFICATIONS.includes(discovery.makeability)) reasons.push('missing makeability classification');
    if (reasons.length > 0) {
      return { ok: false, code: 'public_gate_incomplete', message: `PUBLIC discovery gate incomplete: ${reasons.join('; ')}` };
    }
  }
  const details = draft.package.details.map((item) => ({
    assetId: item.assetId, revision: item.revision, kind: 'DETAIL' as const, sha256: item.sha256,
    mimeType: item.mimeType, width: item.width, height: item.height, fidelity: item.fidelity,
  }));
  const look: PublishedLookV1 = {
    schemaVersion: 1, lookId: input.lookId, designVersionId: draft.package.designVersionId,
    creatorProfileId: draft.creatorProfileId, title: draft.title.trim(), tags: [...draft.tags], visibility: draft.visibility,
    metadata: { sourceType: draft.sourceType, ...(draft.sourceAttribution ? { sourceAttribution: draft.sourceAttribution } : {}) },
    coverPreview: { assetId: draft.package.cover.assetId, revision: draft.package.cover.revision, kind: 'COVER', sha256: draft.package.cover.sha256, mimeType: draft.package.cover.mimeType, width: draft.package.cover.width, height: draft.package.cover.height, fidelity: draft.package.cover.fidelity },
    detailPreviews: details, summaries: { shapeIds: [...draft.package.shapeIds], lengthIds: [...draft.package.lengthIds], palette: [...draft.package.palette] },
    publicationGate: { copyrightDeclared: draft.copyrightDeclared, sourceDeclared: draft.sourceDeclared, moderationCleared: input.publicGovernanceCleared === true },
    status: 'PUBLISHED', publishedAt: input.now, createdAt: draft.createdAt, updatedAt: input.now,
  };
  if (!parsePublishedLookV1(look).ok) return { ok: false, code: 'invalid', message: 'published look contract failed' };
  const envelope = buildCreatorDiscoveryEnvelopeV2(draft, input.lookId, input.now);
  return {
    ok: true,
    value: {
      ...clone(input.store),
      drafts: input.store.drafts.filter((item) => item.draftId !== draft.draftId).map(clone),
      looks: [...input.store.looks.map(clone), look],
      discovery: { ...input.store.discovery, [input.lookId]: envelope },
    },
  };
}

export function setCreatorLookHiddenV2(store: CreatorPublicationStoreV2, lookId: string, hidden: boolean, now: string): CreatorPublicationResultV2<CreatorPublicationStoreV2> {
  const look = store.looks.find((item) => item.lookId === lookId);
  if (!look) return { ok: false, code: 'not_found', message: 'published look not found' };
  if (!hidden && look.status !== 'HIDDEN') return { ok: false, code: 'invalid', message: 'look is not hidden' };
  if (hidden && look.status !== 'PUBLISHED') return { ok: false, code: 'invalid', message: 'only published looks can be hidden' };
  const next = { ...clone(look), status: hidden ? 'HIDDEN' as const : 'PUBLISHED' as const, updatedAt: now };
  return { ok: true, value: { ...clone(store), looks: store.looks.map((item) => item.lookId === lookId ? next : clone(item)) } };
}

// Re-export the V1 result type alias for callers that only need the union.
export type { CreatorPublicationResultV1 };
