import type { PublishedLookV1, VisibilityV1 } from './design-content-model';
import { parsePublishedLookV1 } from './design-content-parse';
import type { PublishPackageV1 } from '@/studio/publishing';
import { parsePublishPackageV1 } from '@/studio/publishing';

export const CREATOR_PUBLICATION_STORE_KIND = 'CREATOR_PUBLICATION_STORE' as const;
export const CREATOR_PUBLICATION_SCHEMA_VERSION = 1 as const;
export type CreatorPublicationStageV1 = 1 | 2 | 3;
export type CreatorPublicationSourceV1 = 'ORIGINAL' | 'REMIX' | 'IMPORTED' | 'AI_ASSISTED';

export interface CreatorPublicationDraftV1 {
  schemaVersion: 1;
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
  /** Increments only when governance-reviewed publication content changes. */
  contentRevision: number;
  step: CreatorPublicationStageV1;
  createdAt: string;
  updatedAt: string;
}

export interface CreatorPublicationStoreV1 {
  schemaVersion: 1;
  kind: typeof CREATOR_PUBLICATION_STORE_KIND;
  drafts: CreatorPublicationDraftV1[];
  looks: PublishedLookV1[];
}

export type CreatorPublicationResultV1<T> =
  | { ok: true; value: T }
  | { ok: false; code: 'invalid' | 'not_found' | 'public_locked' | 'persist_failed' | 'conflict'; message: string };

const ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;

function clone<T>(value: T): T { return structuredClone(value); }
function validTags(tags: unknown): tags is string[] {
  return Array.isArray(tags) && tags.length <= 12
    && tags.every((tag) => typeof tag === 'string' && tag.trim().length > 0 && tag.length <= 32)
    && new Set(tags).size === tags.length;
}

export function createEmptyCreatorPublicationStoreV1(): CreatorPublicationStoreV1 {
  return { schemaVersion: 1, kind: CREATOR_PUBLICATION_STORE_KIND, drafts: [], looks: [] };
}

export function parseCreatorPublicationStoreV1(input: unknown): CreatorPublicationStoreV1 | null {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
  const raw = input as Record<string, unknown>;
  if (Object.keys(raw).some((key) => !['schemaVersion', 'kind', 'drafts', 'looks'].includes(key))
    || raw.schemaVersion !== 1 || raw.kind !== CREATOR_PUBLICATION_STORE_KIND
    || !Array.isArray(raw.drafts) || !Array.isArray(raw.looks)) return null;
  const drafts: CreatorPublicationDraftV1[] = [];
  const ids = new Set<string>();
  for (const item of raw.drafts) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
    const draft = item as unknown as CreatorPublicationDraftV1;
    const keys = Object.keys(item);
    if (keys.some((key) => !['schemaVersion','draftId','creatorProfileId','package','title','tags','visibility','sourceType','sourceAttribution','copyrightDeclared','sourceDeclared','contentRevision','step','createdAt','updatedAt'].includes(key))
      || draft.schemaVersion !== 1 || !ID.test(draft.draftId) || ids.has(draft.draftId)
      || !ID.test(draft.creatorProfileId) || !parsePublishPackageV1(draft.package).ok
      || typeof draft.title !== 'string' || draft.title.length > 80
      || !validTags(draft.tags) || !['PRIVATE','UNLISTED','PUBLIC'].includes(draft.visibility)
      || !['ORIGINAL','REMIX','IMPORTED','AI_ASSISTED'].includes(draft.sourceType)
      || (draft.sourceAttribution !== undefined && (typeof draft.sourceAttribution !== 'string' || draft.sourceAttribution.length > 280))
      || typeof draft.copyrightDeclared !== 'boolean' || typeof draft.sourceDeclared !== 'boolean'
      || !Number.isInteger(draft.contentRevision) || draft.contentRevision < 1
      || ![1,2,3].includes(draft.step) || !ISO.test(draft.createdAt) || !ISO.test(draft.updatedAt)) return null;
    ids.add(draft.draftId); drafts.push(clone(draft));
  }
  const looks: PublishedLookV1[] = [];
  for (const look of raw.looks) {
    const parsed = parsePublishedLookV1(look);
    if (!parsed.ok || ids.has(parsed.value.lookId)) return null;
    ids.add(parsed.value.lookId); looks.push(clone(parsed.value));
  }
  return { schemaVersion: 1, kind: CREATOR_PUBLICATION_STORE_KIND, drafts, looks };
}

function replaceDraft(store: CreatorPublicationStoreV1, draft: CreatorPublicationDraftV1): CreatorPublicationStoreV1 {
  return { ...clone(store), drafts: store.drafts.map((item) => item.draftId === draft.draftId ? clone(draft) : clone(item)) };
}

export function createCreatorPublicationDraftV1(input: {
  store: CreatorPublicationStoreV1; draftId: string; creatorProfileId: string; package: PublishPackageV1; now: string;
}): CreatorPublicationResultV1<CreatorPublicationStoreV1> {
  if (!ID.test(input.draftId) || !ID.test(input.creatorProfileId) || !ISO.test(input.now) || !parsePublishPackageV1(input.package).ok) {
    return { ok: false, code: 'invalid', message: 'invalid publication draft input' };
  }
  if (input.store.drafts.some((item) => item.draftId === input.draftId) || input.store.looks.some((item) => item.lookId === input.draftId)) {
    return { ok: false, code: 'conflict', message: 'publication id already exists' };
  }
  const draft: CreatorPublicationDraftV1 = {
    schemaVersion: 1, draftId: input.draftId, creatorProfileId: input.creatorProfileId, package: clone(input.package),
    title: '', tags: [], visibility: 'PRIVATE', sourceType: 'ORIGINAL', copyrightDeclared: false,
    sourceDeclared: false, contentRevision: 1, step: 1, createdAt: input.now, updatedAt: input.now,
  };
  return { ok: true, value: { ...clone(input.store), drafts: [...input.store.drafts.map(clone), draft] } };
}

export function updateCreatorPublicationDraftV1(input: {
  store: CreatorPublicationStoreV1; draftId: string; patch: Partial<Pick<CreatorPublicationDraftV1, 'title'|'tags'|'visibility'|'sourceType'|'sourceAttribution'|'copyrightDeclared'|'sourceDeclared'|'step'>>; now: string; publicGovernanceCleared?: boolean;
}): CreatorPublicationResultV1<CreatorPublicationStoreV1> {
  const current = input.store.drafts.find((item) => item.draftId === input.draftId);
  if (!current) return { ok: false, code: 'not_found', message: 'publication draft not found' };
  if ((input.patch.visibility as VisibilityV1 | undefined) === 'PUBLIC' && !input.publicGovernanceCleared) return { ok: false, code: 'public_locked', message: 'PUBLIC publishing requires Governance' };
  const reviewKeys = ['title','tags','sourceType','sourceAttribution','copyrightDeclared','sourceDeclared'] as const;
  const reviewContentChanged = reviewKeys.some((key) => Object.prototype.hasOwnProperty.call(input.patch, key)
    && JSON.stringify(input.patch[key]) !== JSON.stringify(current[key]));
  const candidate = {
    ...clone(current), ...clone(input.patch),
    contentRevision: current.contentRevision + (reviewContentChanged ? 1 : 0),
    updatedAt: input.now,
  };
  const probe = parseCreatorPublicationStoreV1({ ...clone(input.store), drafts: replaceDraft(input.store, candidate).drafts });
  return probe ? { ok: true, value: probe } : { ok: false, code: 'invalid', message: 'invalid publication metadata' };
}

export function publishCreatorDraftV1(input: {
  store: CreatorPublicationStoreV1; draftId: string; lookId: string; now: string; publicGovernanceCleared?: boolean;
}): CreatorPublicationResultV1<CreatorPublicationStoreV1> {
  const draft = input.store.drafts.find((item) => item.draftId === input.draftId);
  if (!draft) return { ok: false, code: 'not_found', message: 'publication draft not found' };
  if (!ID.test(input.lookId) || !ISO.test(input.now) || !draft.title.trim() || !draft.copyrightDeclared || !draft.sourceDeclared) {
    return { ok: false, code: 'invalid', message: 'metadata and source declarations are required' };
  }
  if ((draft.visibility as VisibilityV1) === 'PUBLIC' && !input.publicGovernanceCleared) return { ok: false, code: 'public_locked', message: 'PUBLIC publishing requires explicit governance clearance' };
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
  return { ok: true, value: { ...clone(input.store), drafts: input.store.drafts.filter((item) => item.draftId !== draft.draftId).map(clone), looks: [...input.store.looks.map(clone), look] } };
}

export function setCreatorLookHiddenV1(store: CreatorPublicationStoreV1, lookId: string, hidden: boolean, now: string): CreatorPublicationResultV1<CreatorPublicationStoreV1> {
  const look = store.looks.find((item) => item.lookId === lookId);
  if (!look) return { ok: false, code: 'not_found', message: 'published look not found' };
  if (!hidden && look.status !== 'HIDDEN') return { ok: false, code: 'invalid', message: 'look is not hidden' };
  if (hidden && look.status !== 'PUBLISHED') return { ok: false, code: 'invalid', message: 'only published looks can be hidden' };
  const next = { ...clone(look), status: hidden ? 'HIDDEN' as const : 'PUBLISHED' as const, updatedAt: now };
  return { ok: true, value: { ...clone(store), looks: store.looks.map((item) => item.lookId === lookId ? next : clone(item)) } };
}
