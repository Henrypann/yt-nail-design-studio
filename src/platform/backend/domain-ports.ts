import {
  createEmptyCreatorPublicationStoreV1,
  parseCreatorPublicationStoreV1,
  type CreatorPublicationStoreV1,
} from '@/community/domain/v7_1/creator-publication';
import {
  emptyGovernanceStoreV1,
  parseGovernanceStoreV1,
  type GovernanceStoreV1,
} from '@/community/domain/v7_1/governance';
import {
  emptyClientApprovalStoreV1,
  parseClientApprovalStoreV1,
  type ClientApprovalStoreV1,
} from '@/studio/approval/client-approval';
import { createClientId, readData, StorageKeys, writeEnvelope } from '@/lib/storage';
import {
  createVersionedJsonRepositoryV1,
  type RepositorySnapshotV1,
  type VersionedJsonRepositoryV1,
} from './local-json-store';
import {
  isServiceIdV1,
  requireServicePermissionV1,
  serviceErrorV1,
  type IdentityAccessPortV1,
  type IdentityAccessRequestV1,
  type ServiceActorV1,
  type ServiceCommandContextV1,
  type ServiceResultV1,
} from './service-contract';

export const BACKEND_PERMISSIONS_V1 = {
  publicationRead: 'publication.read',
  publicationWrite: 'publication.write',
  governanceRead: 'governance.read',
  governanceWrite: 'governance.write',
  approvalRead: 'approval.read',
  approvalWrite: 'approval.write',
  assetRead: 'asset.read',
  assetWrite: 'asset.write',
} as const;

export const BACKEND_OPERATIONS_V1 = {
  publicationRead: 'publication.read',
  publicationWrite: 'publication.write',
  governanceRead: 'governance.read',
  governanceWrite: 'governance.write',
  approvalRead: 'approval.read',
  approvalWrite: 'approval.write',
  assetRead: 'asset.read',
  assetWrite: 'asset.write',
} as const;

interface DomainStorePortV1<T> {
  readonly adapterKind: 'LOCAL_PROTOTYPE' | 'REMOTE';
  read(context: ServiceCommandContextV1): Promise<ServiceResultV1<RepositorySnapshotV1<T>>>;
  replace(
    context: ServiceCommandContextV1,
    store: T,
    expectedEtag: string,
  ): Promise<ServiceResultV1<RepositorySnapshotV1<T>>>;
}

export type CreatorPublicationPortV1 = DomainStorePortV1<CreatorPublicationStoreV1>;
export type GovernancePortV1 = DomainStorePortV1<GovernanceStoreV1>;
export type ClientApprovalPortV1 = DomainStorePortV1<ClientApprovalStoreV1>;

function browserStorage(key: string) {
  return {
    read: () => readData<unknown>(key),
    write: (value: unknown) => { writeEnvelope(key, value); },
  };
}

function guardedPort<T>(
  repository: VersionedJsonRepositoryV1<T>,
  readPermission: string,
  writePermission: string,
): DomainStorePortV1<T> {
  return {
    adapterKind: repository.adapterKind,
    async read(context) {
      const allowed = requireServicePermissionV1(context, readPermission);
      if (!allowed.ok) return allowed;
      const result = await repository.read();
      return result.ok ? result : serviceErrorV1(result.error.code, result.error.reason, result.error.retryable, context.correlationId);
    },
    async replace(context, store, expectedEtag) {
      const allowed = requireServicePermissionV1(context, writePermission);
      if (!allowed.ok) return allowed;
      return repository.replace({
        value: store,
        expectedEtag,
        idempotencyKey: context.idempotencyKey,
        correlationId: context.correlationId,
      });
    },
  };
}

export function createLocalCreatorPublicationPortV1(): CreatorPublicationPortV1 {
  return guardedPort(createVersionedJsonRepositoryV1({
    storage: browserStorage(StorageKeys.creatorPublications),
    ledger: browserStorage(StorageKeys.backendPublicationLedger),
    empty: createEmptyCreatorPublicationStoreV1,
    parse: parseCreatorPublicationStoreV1,
    invalidReason: 'publication.store_corrupted',
  }), BACKEND_PERMISSIONS_V1.publicationRead, BACKEND_PERMISSIONS_V1.publicationWrite);
}

export function createLocalGovernancePortV1(): GovernancePortV1 {
  return guardedPort(createVersionedJsonRepositoryV1({
    storage: browserStorage(StorageKeys.governance),
    ledger: browserStorage(StorageKeys.backendGovernanceLedger),
    empty: emptyGovernanceStoreV1,
    parse: parseGovernanceStoreV1,
    invalidReason: 'governance.store_corrupted',
  }), BACKEND_PERMISSIONS_V1.governanceRead, BACKEND_PERMISSIONS_V1.governanceWrite);
}

export function createLocalClientApprovalPortV1(): ClientApprovalPortV1 {
  return guardedPort(createVersionedJsonRepositoryV1({
    storage: browserStorage(StorageKeys.clientApprovals),
    ledger: browserStorage(StorageKeys.backendApprovalLedger),
    empty: emptyClientApprovalStoreV1,
    parse: parseClientApprovalStoreV1,
    invalidReason: 'approval.store_corrupted',
  }), BACKEND_PERMISSIONS_V1.approvalRead, BACKEND_PERMISSIONS_V1.approvalWrite);
}

export function createLocalPrototypeIdentityAccessPortV1(input: {
  actorRef: string;
  permissions: readonly string[];
  disclosure?: ServiceActorV1['disclosure'];
  now?: () => string;
  nextId?: (prefix: string) => string;
}): IdentityAccessPortV1 {
  const allowedOperations = new Set<string>(Object.values(BACKEND_OPERATIONS_V1));
  const permissions = [...new Set(input.permissions)];
  const valid = isServiceIdV1(input.actorRef) && permissions.every(isServiceIdV1);
  const nextId = input.nextId ?? ((prefix: string) => createClientId(prefix));
  const now = input.now ?? (() => new Date().toISOString());
  return {
    adapterKind: 'LOCAL_PROTOTYPE',
    async issueContext(request: IdentityAccessRequestV1) {
      if (!valid || !allowedOperations.has(request.operation)
        || (request.idempotencyKey !== undefined && !isServiceIdV1(request.idempotencyKey))) {
        return serviceErrorV1('INVALID', 'identity.invalid_access_request');
      }
      const required = request.operation;
      if (!permissions.includes(required)) return serviceErrorV1('FORBIDDEN', 'identity.operation_denied');
      const context: ServiceCommandContextV1 = {
        actor: {
          actorRef: input.actorRef,
          permissions,
          disclosure: input.disclosure ?? 'LOCAL_PROTOTYPE',
        },
        idempotencyKey: request.idempotencyKey ?? nextId('idem.'),
        correlationId: nextId('correlation.'),
        now: now(),
      };
      return { ok: true, value: context, changed: false };
    },
  };
}
