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
  const readyAuthority = async (designVersionId: string) => {
    const authority = await readAuthoritativePackageByVersionV1({ identity: input.identity, authority: input.authority, designVersionId });
    if (!authority.ok) return authority;
    const readContext = await context(input.identity, BACKEND_OPERATIONS_V1.assetRead);
    if (!readContext.ok) return readContext;
    for (const asset of authority.value.assets) {
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
      value: {
        publication: publication.value.value,
        governance: governance.value.value,
        disclosure: input.publication.adapterKind,
      },
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

  const state = (publication: CreatorPublicationStoreV1, governance: GovernanceStoreV1, changed: boolean): ServiceResultV1<CreatorWorkspaceStateV1> => ({
    ok: true,
    value: { publication, governance, disclosure: input.publication.adapterKind },
    changed,
  });

  return {
    load,
    async createDraft(designVersionId) {
      const authority = await readyAuthority(designVersionId);
      if (!authority.ok) return authority;
      if (authority.value.status !== 'READY') return serviceErrorV1('PRECONDITION_FAILED', 'publication.package_not_ready');
      const current = await readBoth(); if (!current.ok) return current;
      const writeContext = await context(input.identity, BACKEND_OPERATIONS_V1.publicationWrite);
      if (!writeContext.ok) return writeContext;
      const draftId = input.nextId('draft.');
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
        ? { ok: true, value: { publication: saved.value.value, governance: current.value.governance.value.value, disclosure: input.publication.adapterKind, draftId }, changed: saved.changed }
        : saved;
    },
    async updateDraft(draftId, patch) {
      const current = await readBoth(); if (!current.ok) return current;
      const draft = current.value.publication.value.value.drafts.find((candidate) => candidate.draftId === draftId);
      if (!draft) return serviceErrorV1('NOT_FOUND', 'publication.draft_not_found');
      const writeContext = await context(input.identity, BACKEND_OPERATIONS_V1.publicationWrite);
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
      return saved.ok ? state(saved.value.value, current.value.governance.value.value, saved.changed) : saved;
    },
    async submitReview(draftId) {
      const current = await readBoth(); if (!current.ok) return current;
      const draft = current.value.publication.value.value.drafts.find((candidate) => candidate.draftId === draftId);
      if (!draft) return serviceErrorV1('NOT_FOUND', 'publication.draft_not_found');
      const writeContext = await context(input.identity, BACKEND_OPERATIONS_V1.governanceWrite);
      if (!writeContext.ok) return writeContext;
      const reviewed = submitPublicationReviewV1(current.value.governance.value.value, {
        reviewId: input.nextId('review.'),
        auditId: input.nextId('audit.'),
        draftId,
        creatorProfileId: draft.creatorProfileId,
        draftRevision: draft.contentRevision,
        now: writeContext.value.now,
      });
      if (!reviewed.ok) return failDomain(reviewed.code, 'governance', writeContext.value.correlationId);
      const saved = await input.governance.replace(writeContext.value, reviewed.value, current.value.governance.value.etag);
      return saved.ok ? state(current.value.publication.value.value, saved.value.value, saved.changed) : saved;
    },
    async publishDraft(draftId) {
      const current = await readBoth(); if (!current.ok) return current;
      const draft = current.value.publication.value.value.drafts.find((candidate) => candidate.draftId === draftId);
      if (!draft) return serviceErrorV1('NOT_FOUND', 'publication.draft_not_found');
      const writeContext = await context(input.identity, BACKEND_OPERATIONS_V1.publicationWrite);
      if (!writeContext.ok) return writeContext;
      const cleared = publicationReviewClearedV1(current.value.governance.value.value, draftId, draft.creatorProfileId, draft.contentRevision);
      const published = publishCreatorDraftV1({
        store: current.value.publication.value.value,
        draftId,
        lookId: input.nextId('look.'),
        now: writeContext.value.now,
        publicGovernanceCleared: cleared,
      });
      if (!published.ok) return failDomain(published.code, 'publication', writeContext.value.correlationId);
      const saved = await input.publication.replace(writeContext.value, published.value, current.value.publication.value.etag);
      return saved.ok ? state(saved.value.value, current.value.governance.value.value, saved.changed) : saved;
    },
    async setLookHidden(lookId, hidden) {
      const current = await readBoth(); if (!current.ok) return current;
      const writeContext = await context(input.identity, BACKEND_OPERATIONS_V1.publicationWrite);
      if (!writeContext.ok) return writeContext;
      const result = setCreatorLookHiddenV1(current.value.publication.value.value, lookId, hidden, writeContext.value.now);
      if (!result.ok) return failDomain(result.code, 'publication', writeContext.value.correlationId);
      const saved = await input.publication.replace(writeContext.value, result.value, current.value.publication.value.etag);
      return saved.ok ? state(saved.value.value, current.value.governance.value.value, saved.changed) : saved;
    },
    async createClientShare(designVersionId) {
      const current = await readBoth(); if (!current.ok) return current;
      const look = current.value.publication.value.value.looks.find((candidate) => candidate.designVersionId === designVersionId && candidate.status === 'PUBLISHED');
      if (!look) return serviceErrorV1('NOT_FOUND', 'approval.published_look_not_found');
      const authority = await readyAuthority(designVersionId);
      if (!authority.ok) return authority;
      const readContext = await context(input.identity, BACKEND_OPERATIONS_V1.approvalRead);
      if (!readContext.ok) return readContext;
      const approvals = await input.approvals.read(readContext.value); if (!approvals.ok) return approvals;
      const writeContext = await context(input.identity, BACKEND_OPERATIONS_V1.approvalWrite);
      if (!writeContext.ok) return writeContext;
      let rawToken: string; let tokenHash: string;
      try { rawToken = input.token.generate(); tokenHash = await input.token.sha256(rawToken); }
      catch { return serviceErrorV1('UNAVAILABLE', 'approval.token_unavailable', true, writeContext.value.correlationId); }
      const expiresAt = new Date(Date.parse(writeContext.value.now) + 7 * 24 * 60 * 60 * 1000).toISOString();
      const created = createClientShareV1({
        store: approvals.value.value,
        shareLinkId: input.nextId('share.'),
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
      const transitioned = transitionGovernanceCaseV1({
        store: current.value.value,
        caseId,
        to,
        auditId: input.nextId('audit.'),
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
      const result = decidePublicationReviewV1(current.value.value, {
        reviewId,
        auditId: input.nextId('audit.'),
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
    const share = store.shares.find((candidate) => candidate.tokenHash === tokenHash);
    if (!share) return serviceErrorV1('NOT_FOUND', 'approval.share_not_found');
    const authorityContext = await context(input.identity, BACKEND_OPERATIONS_V1.packageReferenceRead);
    if (!authorityContext.ok) return authorityContext;
    const authority = await input.authority.read(authorityContext.value);
    if (!authority.ok) return authority;
    const sameDesign = authority.value.value.records.filter((record) => record.package.designId === share.package.designId);
    const currentVersion = sameDesign.sort((a, b) => b.package.version - a.package.version)[0]?.package.designVersionId ?? share.designVersionId;
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
      const id = input.nextId('decision.');
      const result = decideClientShareV1({
        store: current.value.value,
        shareLinkId: resolved.value.share.shareLinkId,
        decision,
        ...(note?.trim() ? { note: note.trim() } : {}),
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
