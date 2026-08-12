import {
  createCreatorPublicationDraftV1,
  publishCreatorDraftV1,
  setCreatorLookHiddenV1,
  updateCreatorPublicationDraftV1,
  type CreatorPublicationStoreV1,
} from '@/community/domain/v7_1/creator-publication';
import {
  decidePublicationReviewV1,
  publicationReviewClearedV1,
  submitPublicationReviewV1,
  transitionGovernanceCaseV1,
  type GovernanceCaseV1,
  type GovernanceStoreV1,
} from '@/community/domain/v7_1/governance';
import {
  createClientShareV1,
  decideClientShareV1,
  resolveClientShareV1,
  type ClientApprovalStoreV1,
  type ClientShareLinkV1,
} from '@/studio/approval/client-approval';
import type { ApprovalEventV1 } from '@/community/domain/v7_1/trust-contracts';
import { canonicalJsonV1 } from '@/studio/versioning/design-release';
import type { AssetUploadPortV1 } from './asset-contract';
import type {
  ClientApprovalPortV1,
  CreatorPublicationPortV1,
  GovernancePortV1,
} from './domain-ports';
import { BACKEND_OPERATIONS_V1 } from './domain-ports';
import {
  readAuthoritativePackageByVersionV1,
  type PublishPackageAuthorityPortV1,
} from './publish-authority';
import {
  mapDomainErrorCodeV1,
  serviceErrorV1,
  type IdentityAccessPortV1,
  type ServiceCommandContextV1,
  type ServiceResultV1,
} from './service-contract';

export type CreatorPublicationDraftPatchV1 = Parameters<typeof updateCreatorPublicationDraftV1>[0]['patch'];

export interface CreatorWorkspaceStateV1 {
  publication: CreatorPublicationStoreV1;
  governance: GovernanceStoreV1;
  disclosure: 'LOCAL_PROTOTYPE' | 'REMOTE';
}

export interface ClientShareViewV1 {
  share: ClientShareLinkV1;
  existingDecision: ApprovalEventV1 | null;
}

export interface CreatorWorkspaceApplicationServiceV1 {
  load(): Promise<ServiceResultV1<CreatorWorkspaceStateV1>>;
  createDraft(designVersionId: string): Promise<ServiceResultV1<CreatorWorkspaceStateV1 & { draftId: string }>>;
  updateDraft(draftId: string, patch: CreatorPublicationDraftPatchV1): Promise<ServiceResultV1<CreatorWorkspaceStateV1>>;
  submitReview(draftId: string): Promise<ServiceResultV1<CreatorWorkspaceStateV1>>;
  publishDraft(draftId: string): Promise<ServiceResultV1<CreatorWorkspaceStateV1>>;
  setLookHidden(lookId: string, hidden: boolean): Promise<ServiceResultV1<CreatorWorkspaceStateV1>>;
  createClientShare(designVersionId: string): Promise<ServiceResultV1<{ rawToken: string; expiresAt: string }>>;
}

export interface GovernanceApplicationServiceV1 {
  load(): Promise<ServiceResultV1<GovernanceStoreV1>>;
  transitionCase(caseId: string, to: GovernanceCaseV1['status']): Promise<ServiceResultV1<GovernanceStoreV1>>;
  decidePublicationReview(reviewId: string, status: 'CLEARED' | 'REJECTED'): Promise<ServiceResultV1<GovernanceStoreV1>>;
}

export interface ClientApprovalApplicationServiceV1 {
  loadByRawToken(rawToken: string): Promise<ServiceResultV1<ClientShareViewV1>>;
  decide(rawToken: string, decision: 'APPROVED' | 'CHANGE_REQUESTED', note?: string): Promise<ServiceResultV1<ClientShareViewV1>>;
}

function failDomain(code: string, scope: string, correlationId?: string): ServiceResultV1<never> {
  return serviceErrorV1(mapDomainErrorCodeV1(code), `${scope}.${code}`, code === 'persist_failed', correlationId);
}

async function context(identity: IdentityAccessPortV1, operation: string, idempotencyKey?: string) {
  return identity.issueContext({ operation, ...(idempotencyKey ? { idempotencyKey } : {}) });
}

function generatedId(
  nextId: (scope: string) => string,
  scope: string,
  correlationId?: string,
): ServiceResultV1<string> {
  try {
    return { ok: true, value: nextId(scope), changed: false };
  } catch {
    return serviceErrorV1('UNAVAILABLE', 'service.id_generation_unavailable', true, correlationId);
  }
}

export function createCreatorWorkspaceApplicationServiceV1(input: {
  identity: IdentityAccessPortV1;
  publication: CreatorPublicationPortV1;
  governance: GovernancePortV1;
  approvals: ClientApprovalPortV1;
  authority: PublishPackageAuthorityPortV1;
  assets: AssetUploadPortV1;
  nextId(scope: string): string;
  token: { generate(): string; sha256(value: string): Promise<string> };
}): CreatorWorkspaceApplicationServiceV1 {
  const projectCreatorState = (
    publication: CreatorPublicationStoreV1,
    governance: GovernanceStoreV1,
    actorRef: string,
  ): CreatorWorkspaceStateV1 => {
    const drafts = publication.drafts.filter((draft) => draft.creatorProfileId === actorRef);
    const looks = publication.looks.filter((look) => look.creatorProfileId === actorRef);
    const reviews = governance.publicationReviews.filter((review) => review.creatorProfileId === actorRef);
    const ownedDraftIds = new Set([...drafts.map((draft) => draft.draftId), ...reviews.map((review) => review.draftId)]);
    return {
      publication: { ...publication, drafts: structuredClone(drafts), looks: structuredClone(looks) },
      governance: {
        schemaVersion: 1,
        cases: [],
        publicationReviews: structuredClone(reviews),
        audits: structuredClone(governance.audits.filter((audit) => (
          audit.subjectType === 'PUBLICATION_DRAFT' && ownedDraftIds.has(audit.subjectId)
        ))),
      },
      disclosure: input.publication.adapterKind,
    };
  };
  const readyAuthority = async (designVersionId: string, expectedOwnerRef: string) => {
    const authority = await readAuthoritativePackageByVersionV1({ identity: input.identity, authority: input.authority, designVersionId });
    if (!authority.ok) return authority;
    const readContext = await context(input.identity, BACKEND_OPERATIONS_V1.assetRead);
    if (!readContext.ok) return readContext;
    if (readContext.value.actor.actorRef !== expectedOwnerRef || authority.value.ownerRef !== expectedOwnerRef) {
      return serviceErrorV1('FORBIDDEN', 'publish.package_owner_mismatch', false, readContext.value.correlationId);
    }
    for (const asset of authority.value.assets) {
      const record = await input.assets.get(readContext.value, asset.assetId, asset.revision);
      if (!record.ok) return record;
      if (record.value.ownerRef !== expectedOwnerRef) {
        return serviceErrorV1('FORBIDDEN', 'publish.asset_owner_mismatch', false, readContext.value.correlationId);
      }
      const bytes = await input.assets.readBytes(readContext.value, asset.assetId, asset.revision);
      if (!bytes.ok) return bytes;
    }
    return authority;
  };
  const load = async (): Promise<ServiceResultV1<CreatorWorkspaceStateV1>> => {
    const pubContext = await context(input.identity, BACKEND_OPERATIONS_V1.publicationRead);
    if (!pubContext.ok) return pubContext;
    const governanceContext = await context(input.identity, BACKEND_OPERATIONS_V1.governanceRead);
    if (!governanceContext.ok) return governanceContext;
    const [publication, governance] = await Promise.all([
      input.publication.read(pubContext.value), input.governance.read(governanceContext.value),
    ]);
    if (!publication.ok) return publication;
    if (!governance.ok) return governance;
    return {
      ok: true,
      value: projectCreatorState(publication.value.value, governance.value.value, pubContext.value.actor.actorRef),
      changed: false,
    };
  };

  const readBoth = async () => {
    const pubContext = await context(input.identity, BACKEND_OPERATIONS_V1.publicationRead);
    if (!pubContext.ok) return pubContext;
    const govContext = await context(input.identity, BACKEND_OPERATIONS_V1.governanceRead);
    if (!govContext.ok) return govContext;
    const publication = await input.publication.read(pubContext.value);
    if (!publication.ok) return publication;
    const governance = await input.governance.read(govContext.value);
    if (!governance.ok) return governance;
    return { ok: true as const, value: { publication, governance }, changed: false };
  };

  const state = (publication: CreatorPublicationStoreV1, governance: GovernanceStoreV1, actorRef: string, changed: boolean): ServiceResultV1<CreatorWorkspaceStateV1> => ({
    ok: true,
    value: projectCreatorState(publication, governance, actorRef),
    changed,
  });
  const writeContextForDraft = async (draft: { creatorProfileId: string }, operation: string) => {
    const writeContext = await context(input.identity, operation);
    if (!writeContext.ok) return writeContext;
    return draft.creatorProfileId === writeContext.value.actor.actorRef
      ? writeContext
      : serviceErrorV1('FORBIDDEN', 'publication.draft_owner_mismatch', false, writeContext.value.correlationId);
  };

  return {
    load,
    async createDraft(designVersionId) {
      const writeContext = await context(input.identity, BACKEND_OPERATIONS_V1.publicationWrite);
      if (!writeContext.ok) return writeContext;
      const authority = await readyAuthority(designVersionId, writeContext.value.actor.actorRef);
      if (!authority.ok) return authority;
      if (authority.value.status !== 'READY') return serviceErrorV1('PRECONDITION_FAILED', 'publication.package_not_ready');
      const current = await readBoth(); if (!current.ok) return current;
      const draftIdResult = generatedId(input.nextId, 'draft.', writeContext.value.correlationId);
      if (!draftIdResult.ok) return draftIdResult;
      const draftId = draftIdResult.value;
      const created = createCreatorPublicationDraftV1({
        store: current.value.publication.value.value,
        draftId,
        creatorProfileId: writeContext.value.actor.actorRef,
        package: authority.value.package,
        now: writeContext.value.now,
      });
      if (!created.ok) return failDomain(created.code, 'publication', writeContext.value.correlationId);
      const saved = await input.publication.replace(writeContext.value, created.value, current.value.publication.value.etag);
      return saved.ok
        ? { ok: true, value: { ...projectCreatorState(saved.value.value, current.value.governance.value.value, writeContext.value.actor.actorRef), draftId }, changed: saved.changed }
        : saved;
    },
    async updateDraft(draftId, patch) {
      const current = await readBoth(); if (!current.ok) return current;
      const draft = current.value.publication.value.value.drafts.find((candidate) => candidate.draftId === draftId);
      if (!draft) return serviceErrorV1('NOT_FOUND', 'publication.draft_not_found');
      const writeContext = await writeContextForDraft(draft, BACKEND_OPERATIONS_V1.publicationWrite);
      if (!writeContext.ok) return writeContext;
      const updated = updateCreatorPublicationDraftV1({
        store: current.value.publication.value.value,
        draftId,
        patch,
        now: writeContext.value.now,
        publicGovernanceCleared: publicationReviewClearedV1(current.value.governance.value.value, draftId, draft.creatorProfileId, draft.contentRevision),
      });
      if (!updated.ok) return failDomain(updated.code, 'publication', writeContext.value.correlationId);
      const saved = await input.publication.replace(writeContext.value, updated.value, current.value.publication.value.etag);
      return saved.ok ? state(saved.value.value, current.value.governance.value.value, writeContext.value.actor.actorRef, saved.changed) : saved;
    },
    async submitReview(draftId) {
      const current = await readBoth(); if (!current.ok) return current;
      const draft = current.value.publication.value.value.drafts.find((candidate) => candidate.draftId === draftId);
      if (!draft) return serviceErrorV1('NOT_FOUND', 'publication.draft_not_found');
      const writeContext = await writeContextForDraft(draft, BACKEND_OPERATIONS_V1.governanceWrite);
      if (!writeContext.ok) return writeContext;
      if (current.value.governance.value.value.publicationReviews.some((review) => review.draftId === draftId
        && review.draftRevision === draft.contentRevision && review.status !== 'REJECTED')) {
        return serviceErrorV1('INVALID', 'governance.review_already_submitted', false, writeContext.value.correlationId);
      }
      const reviewId = generatedId(input.nextId, 'review.', writeContext.value.correlationId);
      if (!reviewId.ok) return reviewId;
      const auditId = generatedId(input.nextId, 'audit.', writeContext.value.correlationId);
      if (!auditId.ok) return auditId;
      const reviewed = submitPublicationReviewV1(current.value.governance.value.value, {
        reviewId: reviewId.value,
        auditId: auditId.value,
        draftId,
        creatorProfileId: draft.creatorProfileId,
        draftRevision: draft.contentRevision,
        now: writeContext.value.now,
      });
      if (!reviewed.ok) return failDomain(reviewed.code, 'governance', writeContext.value.correlationId);
      const saved = await input.governance.replace(writeContext.value, reviewed.value, current.value.governance.value.etag);
      return saved.ok ? state(current.value.publication.value.value, saved.value.value, writeContext.value.actor.actorRef, saved.changed) : saved;
    },
    async publishDraft(draftId) {
      const current = await readBoth(); if (!current.ok) return current;
      const draft = current.value.publication.value.value.drafts.find((candidate) => candidate.draftId === draftId);
      if (!draft) return serviceErrorV1('NOT_FOUND', 'publication.draft_not_found');
      const writeContext = await writeContextForDraft(draft, BACKEND_OPERATIONS_V1.publicationWrite);
      if (!writeContext.ok) return writeContext;
      const cleared = publicationReviewClearedV1(current.value.governance.value.value, draftId, draft.creatorProfileId, draft.contentRevision);
      if (!draft.title.trim() || !draft.copyrightDeclared || !draft.sourceDeclared) {
        return serviceErrorV1('INVALID', 'publication.metadata_required', false, writeContext.value.correlationId);
      }
      if (draft.visibility === 'PUBLIC' && !cleared) {
        return serviceErrorV1('PRECONDITION_FAILED', 'publication.public_governance_required', false, writeContext.value.correlationId);
      }
      const lookId = generatedId(input.nextId, 'look.', writeContext.value.correlationId);
      if (!lookId.ok) return lookId;
      const published = publishCreatorDraftV1({
        store: current.value.publication.value.value,
        draftId,
        lookId: lookId.value,
        now: writeContext.value.now,
        publicGovernanceCleared: cleared,
      });
      if (!published.ok) return failDomain(published.code, 'publication', writeContext.value.correlationId);
      const saved = await input.publication.replace(writeContext.value, published.value, current.value.publication.value.etag);
      return saved.ok ? state(saved.value.value, current.value.governance.value.value, writeContext.value.actor.actorRef, saved.changed) : saved;
    },
    async setLookHidden(lookId, hidden) {
      const current = await readBoth(); if (!current.ok) return current;
      const writeContext = await context(input.identity, BACKEND_OPERATIONS_V1.publicationWrite);
      if (!writeContext.ok) return writeContext;
      const look = current.value.publication.value.value.looks.find((candidate) => candidate.lookId === lookId);
      if (!look) return serviceErrorV1('NOT_FOUND', 'publication.look_not_found');
      if (look.creatorProfileId !== writeContext.value.actor.actorRef) {
        return serviceErrorV1('FORBIDDEN', 'publication.look_owner_mismatch', false, writeContext.value.correlationId);
      }
      const result = setCreatorLookHiddenV1(current.value.publication.value.value, lookId, hidden, writeContext.value.now);
      if (!result.ok) return failDomain(result.code, 'publication', writeContext.value.correlationId);
      const saved = await input.publication.replace(writeContext.value, result.value, current.value.publication.value.etag);
      return saved.ok ? state(saved.value.value, current.value.governance.value.value, writeContext.value.actor.actorRef, saved.changed) : saved;
    },
    async createClientShare(designVersionId) {
      const current = await readBoth(); if (!current.ok) return current;
      const ownerContext = await context(input.identity, BACKEND_OPERATIONS_V1.publicationWrite);
      if (!ownerContext.ok) return ownerContext;
      const look = current.value.publication.value.value.looks.find((candidate) => candidate.designVersionId === designVersionId
        && candidate.creatorProfileId === ownerContext.value.actor.actorRef && candidate.status === 'PUBLISHED');
      if (!look) return serviceErrorV1('NOT_FOUND', 'approval.published_look_not_found', false, ownerContext.value.correlationId);
      const authority = await readyAuthority(designVersionId, ownerContext.value.actor.actorRef);
      if (!authority.ok) return authority;
      const readContext = await context(input.identity, BACKEND_OPERATIONS_V1.approvalRead);
      if (!readContext.ok) return readContext;
      if (readContext.value.actor.actorRef !== ownerContext.value.actor.actorRef) {
        return serviceErrorV1('FORBIDDEN', 'approval.identity_changed', false, readContext.value.correlationId);
      }
      const approvals = await input.approvals.read(readContext.value); if (!approvals.ok) return approvals;
      const writeContext = await context(input.identity, BACKEND_OPERATIONS_V1.approvalWrite);
      if (!writeContext.ok) return writeContext;
      if (writeContext.value.actor.actorRef !== ownerContext.value.actor.actorRef) {
        return serviceErrorV1('FORBIDDEN', 'approval.identity_changed', false, writeContext.value.correlationId);
      }
      let rawToken: string; let tokenHash: string;
      try { rawToken = input.token.generate(); tokenHash = await input.token.sha256(rawToken); }
      catch { return serviceErrorV1('UNAVAILABLE', 'approval.token_unavailable', true, writeContext.value.correlationId); }
      const shareId = generatedId(input.nextId, 'share.', writeContext.value.correlationId);
      if (!shareId.ok) return shareId;
      const expiresAt = new Date(Date.parse(writeContext.value.now) + 7 * 24 * 60 * 60 * 1000).toISOString();
      const created = createClientShareV1({
        store: approvals.value.value,
        shareLinkId: shareId.value,
        tokenHash,
        editorDocSha256: authority.value.editorDocSha256,
        package: authority.value.package,
        now: writeContext.value.now,
        expiresAt,
      });
      if (!created.ok) return failDomain(created.code, 'approval', writeContext.value.correlationId);
      const saved = await input.approvals.replace(writeContext.value, created.value, approvals.value.etag);
      return saved.ok ? { ok: true, value: { rawToken, expiresAt }, changed: saved.changed } : saved;
    },
  };
}

export function createGovernanceApplicationServiceV1(input: {
  identity: IdentityAccessPortV1;
  governance: GovernancePortV1;
  nextId(scope: string): string;
}): GovernanceApplicationServiceV1 {
  const loadSnapshot = async () => {
    const readContext = await context(input.identity, BACKEND_OPERATIONS_V1.governanceRead);
    if (!readContext.ok) return readContext;
    return input.governance.read(readContext.value);
  };
  const save = async (value: GovernanceStoreV1, etag: string, writeContext: ServiceCommandContextV1) => {
    const result = await input.governance.replace(writeContext, value, etag);
    return result.ok ? { ok: true as const, value: result.value.value, changed: result.changed } : result;
  };
  return {
    async load() {
      const current = await loadSnapshot();
      return current.ok ? { ok: true, value: current.value.value, changed: false } : current;
    },
    async transitionCase(caseId, to) {
      const current = await loadSnapshot(); if (!current.ok) return current;
      const currentCase = current.value.value.cases.find((candidate) => candidate.caseId === caseId);
      if (!currentCase) return serviceErrorV1('NOT_FOUND', 'governance.case_not_found');
      const writeContext = await context(input.identity, BACKEND_OPERATIONS_V1.governanceWrite);
      if (!writeContext.ok) return writeContext;
      const allowedTransitions: Record<GovernanceCaseV1['status'], readonly GovernanceCaseV1['status'][]> = {
        REPORTED: ['UNDER_REVIEW'], UNDER_REVIEW: ['HIDDEN', 'REMOVED', 'RESTORED'],
        HIDDEN: ['UNDER_REVIEW', 'REMOVED', 'RESTORED'], REMOVED: ['RESTORED'],
        RESTORED: ['UNDER_REVIEW', 'HIDDEN', 'REMOVED'],
      };
      if (!allowedTransitions[currentCase.status].includes(to)) {
        return serviceErrorV1('PRECONDITION_FAILED', 'governance.transition_denied', false, writeContext.value.correlationId);
      }
      const auditId = generatedId(input.nextId, 'audit.', writeContext.value.correlationId);
      if (!auditId.ok) return auditId;
      const transitioned = transitionGovernanceCaseV1({
        store: current.value.value,
        caseId,
        to,
        auditId: auditId.value,
        actorRef: writeContext.value.actor.actorRef,
        reasonCode: currentCase.reasonCode,
        idempotencyKey: writeContext.value.idempotencyKey,
        expectedVersion: currentCase.objectVersion,
        now: writeContext.value.now,
      });
      return transitioned.ok
        ? save(transitioned.value, current.value.etag, writeContext.value)
        : failDomain(transitioned.code, 'governance', writeContext.value.correlationId);
    },
    async decidePublicationReview(reviewId, status) {
      const current = await loadSnapshot(); if (!current.ok) return current;
      const writeContext = await context(input.identity, BACKEND_OPERATIONS_V1.governanceWrite);
      if (!writeContext.ok) return writeContext;
      const review = current.value.value.publicationReviews.find((candidate) => candidate.reviewId === reviewId);
      if (!review) return serviceErrorV1('NOT_FOUND', 'governance.review_not_found', false, writeContext.value.correlationId);
      if (review.status !== 'PENDING') {
        return serviceErrorV1('PRECONDITION_FAILED', 'governance.review_already_decided', false, writeContext.value.correlationId);
      }
      const auditId = generatedId(input.nextId, 'audit.', writeContext.value.correlationId);
      if (!auditId.ok) return auditId;
      const result = decidePublicationReviewV1(current.value.value, {
        reviewId,
        auditId: auditId.value,
        status,
        reviewedBy: writeContext.value.actor.actorRef,
        reasonCode: status === 'CLEARED' ? 'policy-cleared' : 'policy-rejected',
        now: writeContext.value.now,
      });
      return result.ok ? save(result.value, current.value.etag, writeContext.value) : failDomain(result.code, 'governance', writeContext.value.correlationId);
    },
  };
}

export function createClientApprovalApplicationServiceV1(input: {
  identity: IdentityAccessPortV1;
  approvals: ClientApprovalPortV1;
  authority: PublishPackageAuthorityPortV1;
  assets: AssetUploadPortV1;
  nextId(scope: string): string;
  sha256(value: string): Promise<string>;
}): ClientApprovalApplicationServiceV1 {
  const loadStore = async () => {
    const readContext = await context(input.identity, BACKEND_OPERATIONS_V1.approvalRead);
    if (!readContext.ok) return readContext;
    return input.approvals.read(readContext.value);
  };
  const resolve = async (store: ClientApprovalStoreV1, rawToken: string, now: string) => {
    let tokenHash: string;
    try { tokenHash = await input.sha256(rawToken); }
    catch { return serviceErrorV1('UNAVAILABLE', 'approval.token_hash_unavailable', true); }
    const tokenMatches = store.shares.filter((candidate) => candidate.tokenHash === tokenHash);
    if (tokenMatches.length > 1) return serviceErrorV1('DATA_CORRUPTED', 'approval.duplicate_token_authority');
    const share = tokenMatches[0];
    if (!share) return serviceErrorV1('NOT_FOUND', 'approval.share_not_found');
    const shareEvents = store.events.filter((event) => event.shareLinkId === share.shareLinkId);
    if (shareEvents.length > 1) {
      return serviceErrorV1('DATA_CORRUPTED', 'approval.duplicate_share_decision');
    }
    const shareEvent = shareEvents[0];
    if (shareEvent) {
      if (shareEvent.designVersionId !== share.designVersionId) {
        return serviceErrorV1('DATA_CORRUPTED', 'approval.decision_version_mismatch');
      }
      if (shareEvent.decision === 'APPROVED') {
        const snapshots = store.snapshots.filter((snapshot) => snapshot.snapshotId === shareEvent.snapshotId);
        const snapshot = snapshots[0];
        const expectedPreviewAssetIds = [share.package.cover.assetId, ...share.package.details.map((detail) => detail.assetId)];
        if (snapshots.length !== 1 || !snapshot || snapshot.designVersionId !== share.designVersionId
          || snapshot.designId !== share.package.designId || snapshot.editorDocSha256 !== share.editorDocSha256
          || snapshot.rendererRevision !== share.package.rendererRevision
          || canonicalJsonV1(snapshot.previewAssetIds) !== canonicalJsonV1(expectedPreviewAssetIds)
          || snapshot.confirmedByIdentityRef !== shareEvent.actorRef
          || snapshot.confirmedAt !== shareEvent.createdAt) {
          return serviceErrorV1('DATA_CORRUPTED', 'approval.snapshot_authority_mismatch');
        }
      } else if (shareEvent.snapshotId !== undefined) {
        return serviceErrorV1('DATA_CORRUPTED', 'approval.change_request_snapshot_forbidden');
      }
    }
    const authorityContext = await context(input.identity, BACKEND_OPERATIONS_V1.packageReferenceRead);
    if (!authorityContext.ok) return authorityContext;
    const authority = await input.authority.read(authorityContext.value);
    if (!authority.ok) return authority;
    const shareAuthority = authority.value.value.records.find((record) => record.package.designVersionId === share.designVersionId);
    if (!shareAuthority) return serviceErrorV1('PRECONDITION_FAILED', 'approval.package_authority_missing');
    if (shareAuthority.editorDocSha256 !== share.editorDocSha256
      || canonicalJsonV1(shareAuthority.package) !== canonicalJsonV1(share.package)) {
      return serviceErrorV1('INTEGRITY_MISMATCH', 'approval.package_authority_mismatch');
    }
    const assetContext = await context(input.identity, BACKEND_OPERATIONS_V1.assetRead);
    if (!assetContext.ok) return assetContext;
    for (const asset of shareAuthority.assets) {
      const record = await input.assets.get(assetContext.value, asset.assetId, asset.revision);
      if (!record.ok) return record;
      if (record.value.ownerRef !== shareAuthority.ownerRef) {
        return serviceErrorV1('INTEGRITY_MISMATCH', 'approval.asset_owner_mismatch', false, assetContext.value.correlationId);
      }
      const bytes = await input.assets.readBytes(assetContext.value, asset.assetId, asset.revision);
      if (!bytes.ok) return bytes;
    }
    const sameDesign = authority.value.value.records.filter((record) => record.package.designId === share.package.designId
      && record.ownerRef === shareAuthority.ownerRef);
    const currentVersion = sameDesign.sort((a, b) => b.package.version - a.package.version)[0]?.package.designVersionId;
    if (!currentVersion) return serviceErrorV1('PRECONDITION_FAILED', 'approval.design_authority_missing');
    const result = resolveClientShareV1(store, tokenHash, now, currentVersion);
    return result.ok ? { ok: true as const, value: { share: result.value, tokenHash, currentVersionId: currentVersion }, changed: false } : failDomain(result.code, 'approval');
  };
  return {
    async loadByRawToken(rawToken) {
      const current = await loadStore(); if (!current.ok) return current;
      const readContext = await context(input.identity, BACKEND_OPERATIONS_V1.approvalRead);
      if (!readContext.ok) return readContext;
      const resolved = await resolve(current.value.value, rawToken, readContext.value.now);
      if (!resolved.ok) return resolved;
      const existingDecision = current.value.value.events.find((event) => event.shareLinkId === resolved.value.share.shareLinkId) ?? null;
      return { ok: true, value: { share: resolved.value.share, existingDecision }, changed: false };
    },
    async decide(rawToken, decision, note) {
      const current = await loadStore(); if (!current.ok) return current;
      const writeContext = await context(input.identity, BACKEND_OPERATIONS_V1.approvalWrite);
      if (!writeContext.ok) return writeContext;
      const resolved = await resolve(current.value.value, rawToken, writeContext.value.now);
      if (!resolved.ok) return resolved;
      const normalizedNote = note?.trim() || undefined;
      const priorDecision = current.value.value.events.find((event) => event.shareLinkId === resolved.value.share.shareLinkId);
      if (priorDecision) {
        if (priorDecision.decision !== decision || priorDecision.note !== normalizedNote) {
          return serviceErrorV1('CONFLICT', 'approval.decision_already_recorded', false, writeContext.value.correlationId);
        }
        return {
          ok: true,
          value: { share: resolved.value.share, existingDecision: structuredClone(priorDecision) },
          changed: false,
        };
      }
      const idResult = generatedId(input.nextId, 'decision.', writeContext.value.correlationId);
      if (!idResult.ok) return idResult;
      const id = idResult.value;
      const result = decideClientShareV1({
        store: current.value.value,
        shareLinkId: resolved.value.share.shareLinkId,
        decision,
        ...(normalizedNote ? { note: normalizedNote } : {}),
        actorRef: writeContext.value.actor.actorRef,
        idempotencyKey: writeContext.value.idempotencyKey,
        eventId: `event.${id}`,
        ...(decision === 'APPROVED' ? { snapshotId: `snapshot.${id}` } : {}),
        now: writeContext.value.now,
        currentVersionId: resolved.value.currentVersionId,
      });
      if (!result.ok) return failDomain(result.code, 'approval', writeContext.value.correlationId);
      const saved = await input.approvals.replace(writeContext.value, result.value, current.value.etag);
      if (!saved.ok) return saved;
      const existingDecision = saved.value.value.events.find((event) => event.idempotencyKey === writeContext.value.idempotencyKey) ?? null;
      return { ok: true, value: { share: resolved.value.share, existingDecision }, changed: saved.changed };
    },
  };
}
