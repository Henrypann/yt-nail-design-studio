import { parseGovernanceAuditV1, type GovernanceAuditV1 } from './trust-contracts';

export interface GovernanceCaseV1 {
  schemaVersion: 1;
  caseId: string;
  subjectType: 'PUBLISHED_LOOK' | 'CREATOR_PROFILE' | 'REAL_RESULT';
  subjectId: string;
  status: 'REPORTED' | 'UNDER_REVIEW' | 'HIDDEN' | 'REMOVED' | 'RESTORED';
  reporterRef: string;
  reasonCode: string;
  objectVersion: number;
  createdAt: string;
  updatedAt: string;
}

export interface PublicationReviewV1 {
  schemaVersion: 1;
  reviewId: string;
  draftId: string;
  creatorProfileId: string;
  /** Exact review-relevant CreatorPublicationDraft content revision. */
  draftRevision: number;
  status: 'PENDING' | 'CLEARED' | 'REJECTED';
  copyrightCleared: boolean;
  sourceCleared: boolean;
  moderationCleared: boolean;
  reviewedBy?: string;
  reasonCode?: string;
  createdAt: string;
  updatedAt: string;
}

export interface GovernanceStoreV1 {
  schemaVersion: 1;
  cases: GovernanceCaseV1[];
  audits: GovernanceAuditV1[];
  publicationReviews: PublicationReviewV1[];
}

export type GovernanceResultV1<T> =
  | { ok: true; value: T; created: boolean }
  | { ok: false; code: 'invalid' | 'not_found' | 'transition_denied' | 'conflict'; message: string };

const ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;
const clone = <T,>(value: T): T => structuredClone(value);

export const emptyGovernanceStoreV1 = (): GovernanceStoreV1 => ({ schemaVersion: 1, cases: [], audits: [], publicationReviews: [] });

export function parseGovernanceStoreV1(value: unknown): GovernanceStoreV1 | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  if (Object.keys(raw).some((key) => !['schemaVersion','cases','audits','publicationReviews'].includes(key))
    || raw.schemaVersion !== 1 || !Array.isArray(raw.cases) || !Array.isArray(raw.audits) || !Array.isArray(raw.publicationReviews)) return null;
  const ids = new Set<string>();
  for (const item of raw.cases) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
    const current = item as unknown as GovernanceCaseV1;
    if (Object.keys(item).some((key) => !['schemaVersion','caseId','subjectType','subjectId','status','reporterRef','reasonCode','objectVersion','createdAt','updatedAt'].includes(key))
      || current.schemaVersion !== 1 || ![current.caseId,current.subjectId,current.reporterRef,current.reasonCode].every((item) => typeof item === 'string' && ID.test(item))
      || ids.has(current.caseId) || !['PUBLISHED_LOOK','CREATOR_PROFILE','REAL_RESULT'].includes(current.subjectType)
      || !['REPORTED','UNDER_REVIEW','HIDDEN','REMOVED','RESTORED'].includes(current.status)
      || !Number.isInteger(current.objectVersion) || current.objectVersion < 1 || !ISO.test(current.createdAt) || !ISO.test(current.updatedAt)) return null;
    ids.add(current.caseId);
  }
  for (const item of raw.audits) {
    const parsed = parseGovernanceAuditV1(item);
    if (!parsed || ids.has(parsed.auditId)) return null;
    ids.add(parsed.auditId);
  }
  for (const item of raw.publicationReviews) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
    const current = item as unknown as PublicationReviewV1;
    if (Object.keys(item).some((key) => !['schemaVersion','reviewId','draftId','creatorProfileId','draftRevision','status','copyrightCleared','sourceCleared','moderationCleared','reviewedBy','reasonCode','createdAt','updatedAt'].includes(key))
      || current.schemaVersion !== 1 || ![current.reviewId,current.draftId,current.creatorProfileId].every((item) => ID.test(item))
      || ids.has(current.reviewId) || !Number.isInteger(current.draftRevision) || current.draftRevision < 1
      || !['PENDING','CLEARED','REJECTED'].includes(current.status) || typeof current.copyrightCleared !== 'boolean'
      || typeof current.sourceCleared !== 'boolean' || typeof current.moderationCleared !== 'boolean'
      || (current.reviewedBy !== undefined && !ID.test(current.reviewedBy)) || (current.reasonCode !== undefined && !ID.test(current.reasonCode))
      || !ISO.test(current.createdAt) || !ISO.test(current.updatedAt)
      || (current.status === 'CLEARED' && (!current.reviewedBy || !current.copyrightCleared || !current.sourceCleared || !current.moderationCleared))) return null;
    ids.add(current.reviewId);
  }
  return clone(value) as GovernanceStoreV1;
}

const transitions: Record<GovernanceCaseV1['status'], GovernanceCaseV1['status'][]> = {
  REPORTED: ['UNDER_REVIEW'], UNDER_REVIEW: ['HIDDEN','REMOVED','RESTORED'], HIDDEN: ['UNDER_REVIEW','REMOVED','RESTORED'],
  REMOVED: ['RESTORED'], RESTORED: ['UNDER_REVIEW','HIDDEN','REMOVED'],
};

export function reportGovernanceCaseV1(input: { store: GovernanceStoreV1; caseId: string; auditId: string; subjectType: GovernanceCaseV1['subjectType']; subjectId: string; reporterRef: string; reasonCode: string; idempotencyKey: string; now: string }): GovernanceResultV1<GovernanceStoreV1> {
  if (input.store.audits.some((audit) => audit.idempotencyKey === input.idempotencyKey)) return { ok: true, value: clone(input.store), created: false };
  if (![input.caseId,input.auditId,input.subjectId,input.reporterRef,input.reasonCode,input.idempotencyKey].every((item) => ID.test(item)) || !ISO.test(input.now) || input.store.cases.some((item) => item.caseId === input.caseId)) return { ok: false, code: 'invalid', message: 'invalid governance report' };
  const current: GovernanceCaseV1 = { schemaVersion: 1, caseId: input.caseId, subjectType: input.subjectType, subjectId: input.subjectId, status: 'REPORTED', reporterRef: input.reporterRef, reasonCode: input.reasonCode, objectVersion: 1, createdAt: input.now, updatedAt: input.now };
  const audit: GovernanceAuditV1 = { schemaVersion: 1, auditId: input.auditId, subjectType: input.subjectType, subjectId: input.subjectId, action: 'REPORTED', actorRef: input.reporterRef, reasonCode: input.reasonCode, objectVersion: 1, idempotencyKey: input.idempotencyKey, createdAt: input.now };
  return { ok: true, value: { ...clone(input.store), cases: [...input.store.cases.map(clone), current], audits: [...input.store.audits.map(clone), audit] }, created: true };
}

export function transitionGovernanceCaseV1(input: { store: GovernanceStoreV1; caseId: string; to: GovernanceCaseV1['status']; auditId: string; actorRef: string; reasonCode: string; idempotencyKey: string; expectedVersion: number; now: string }): GovernanceResultV1<GovernanceStoreV1> {
  if (input.store.audits.some((audit) => audit.idempotencyKey === input.idempotencyKey)) return { ok: true, value: clone(input.store), created: false };
  const current = input.store.cases.find((item) => item.caseId === input.caseId);
  if (!current) return { ok: false, code: 'not_found', message: 'governance case not found' };
  if (current.objectVersion !== input.expectedVersion) return { ok: false, code: 'conflict', message: 'governance case changed' };
  if (!transitions[current.status].includes(input.to)) return { ok: false, code: 'transition_denied', message: 'invalid governance transition' };
  const next = { ...clone(current), status: input.to, objectVersion: current.objectVersion + 1, updatedAt: input.now };
  const audit: GovernanceAuditV1 = { schemaVersion: 1, auditId: input.auditId, subjectType: current.subjectType, subjectId: current.subjectId, action: input.to, actorRef: input.actorRef, reasonCode: input.reasonCode, objectVersion: next.objectVersion, idempotencyKey: input.idempotencyKey, createdAt: input.now };
  if (!parseGovernanceAuditV1(audit)) return { ok: false, code: 'invalid', message: 'audit contract failed' };
  return { ok: true, value: { ...clone(input.store), cases: input.store.cases.map((item) => item.caseId === current.caseId ? next : clone(item)), audits: [...input.store.audits.map(clone), audit] }, created: true };
}

export function hasPublicGovernanceClearanceV1(store: GovernanceStoreV1, subjectId: string): boolean {
  const cases = store.cases.filter((item) => item.subjectId === subjectId);
  return cases.length === 0 || cases.every((item) => item.status === 'RESTORED');
}

export function submitPublicationReviewV1(store: GovernanceStoreV1, input: { reviewId: string; auditId: string; draftId: string; creatorProfileId: string; draftRevision: number; now: string }): GovernanceResultV1<GovernanceStoreV1> {
  if (![input.reviewId,input.auditId,input.draftId,input.creatorProfileId].every((item) => ID.test(item)) || !Number.isInteger(input.draftRevision) || input.draftRevision < 1 || !ISO.test(input.now)
    || store.publicationReviews.some((item) => item.draftId === input.draftId && item.draftRevision === input.draftRevision && item.status !== 'REJECTED')) return { ok: false, code: 'invalid', message: 'invalid publication review' };
  const review: PublicationReviewV1 = { schemaVersion: 1, reviewId: input.reviewId, draftId: input.draftId, creatorProfileId: input.creatorProfileId, draftRevision: input.draftRevision, status: 'PENDING', copyrightCleared: false, sourceCleared: false, moderationCleared: false, createdAt: input.now, updatedAt: input.now };
  const audit: GovernanceAuditV1 = { schemaVersion: 1, auditId: input.auditId, subjectType: 'PUBLICATION_DRAFT', subjectId: input.draftId, action: 'PUBLICATION_SUBMITTED', actorRef: input.creatorProfileId, reasonCode: 'public-review', objectVersion: input.draftRevision, idempotencyKey: `publication-submit.${input.reviewId}`, createdAt: input.now };
  if (!parseGovernanceAuditV1(audit)) return { ok: false, code: 'invalid', message: 'publication audit failed' };
  return { ok: true, value: { ...clone(store), publicationReviews: [...store.publicationReviews.map(clone), review], audits: [...store.audits.map(clone), audit] }, created: true };
}

export function decidePublicationReviewV1(store: GovernanceStoreV1, input: { reviewId: string; auditId: string; status: 'CLEARED' | 'REJECTED'; reviewedBy: string; reasonCode: string; now: string }): GovernanceResultV1<GovernanceStoreV1> {
  const review = store.publicationReviews.find((item) => item.reviewId === input.reviewId);
  if (!review) return { ok: false, code: 'not_found', message: 'review not found' };
  if (review.status !== 'PENDING') return { ok: false, code: 'transition_denied', message: 'review already decided' };
  const cleared = input.status === 'CLEARED';
  const next = { ...clone(review), status: input.status, copyrightCleared: cleared, sourceCleared: cleared, moderationCleared: cleared, reviewedBy: input.reviewedBy, reasonCode: input.reasonCode, updatedAt: input.now };
  const audit: GovernanceAuditV1 = { schemaVersion: 1, auditId: input.auditId, subjectType: 'PUBLICATION_DRAFT', subjectId: review.draftId, action: cleared ? 'PUBLICATION_CLEARED' : 'PUBLICATION_REJECTED', actorRef: input.reviewedBy, reasonCode: input.reasonCode, objectVersion: review.draftRevision, idempotencyKey: `publication-decision.${review.reviewId}`, createdAt: input.now };
  if (!parseGovernanceAuditV1(audit)) return { ok: false, code: 'invalid', message: 'publication audit failed' };
  return { ok: true, value: { ...clone(store), publicationReviews: store.publicationReviews.map((item) => item.reviewId === review.reviewId ? next : clone(item)), audits: [...store.audits.map(clone), audit] }, created: true };
}

export function publicationReviewClearedV1(store: GovernanceStoreV1, draftId: string, creatorProfileId: string, draftRevision: number): boolean {
  return store.publicationReviews.some((item) => item.draftId === draftId && item.creatorProfileId === creatorProfileId && item.draftRevision === draftRevision
    && item.status === 'CLEARED' && item.copyrightCleared && item.sourceCleared && item.moderationCleared);
}
