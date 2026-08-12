import type { ImmutableAssetRevisionRefV1 } from '@/community/domain/v7_1/design-content-model';
import { readData, StorageKeys, writeEnvelope } from '@/lib/storage';
import type { PublishPackageArtifactV1, PublishPackageV1 } from '@/studio/publishing';
import { parsePublishPackageV1 } from '@/studio/publishing';
import type { AssetUploadPortV1, AssetUploadRecordV1, ImmutableAssetObjectRefV1 } from './asset-contract';
import { parseImmutableAssetObjectRefV1 } from './asset-contract';
import {
  BACKEND_OPERATIONS_V1,
  BACKEND_PERMISSIONS_V1,
} from './domain-ports';
import { createVersionedJsonRepositoryV1, type VersionedJsonRepositoryV1 } from './local-json-store';
import {
  requireServicePermissionV1,
  serviceErrorV1,
  type IdentityAccessPortV1,
  type ServiceCommandContextV1,
  type ServiceResultV1,
} from './service-contract';

export interface PublishPackageAuthorityRecordV1 {
  schemaVersion: 1;
  package: PublishPackageV1;
  editorDocSha256: string;
  assets: ImmutableAssetObjectRefV1[];
  status: 'READY';
  createdAt: string;
}

interface PublishPackageAuthorityStoreV1 {
  schemaVersion: 1;
  records: PublishPackageAuthorityRecordV1[];
}

export interface PublishPackageAuthorityPortV1 {
  readonly adapterKind: 'LOCAL_PROTOTYPE' | 'REMOTE';
  read(context: ServiceCommandContextV1): Promise<ServiceResultV1<{ value: PublishPackageAuthorityStoreV1; etag: string }>>;
  replace(context: ServiceCommandContextV1, value: PublishPackageAuthorityStoreV1, expectedEtag: string): Promise<ServiceResultV1<{ value: PublishPackageAuthorityStoreV1; etag: string }>>;
}

export interface AssetRevisionAliasV1 {
  sourceAssetId: string;
  sourceRevision: string;
  canonicalAssetId: string;
  canonicalRevision: number;
}

export interface BundledAssetAliasV1 extends AssetRevisionAliasV1 {
  /** Signed registry data; bytes remain in the bundled asset pipeline. */
  canonicalRef: ImmutableAssetRevisionRefV1;
}

export interface AssetReferenceResolverV1 {
  resolve(ref: { assetId: string; revision: string | number; sha256?: string; mimeType?: string }): Promise<ServiceResultV1<ImmutableAssetRevisionRefV1>>;
}

function expectedOutputs(pkg: PublishPackageV1) { return [pkg.cover, ...pkg.details]; }

export function parsePublishPackageAuthorityRecordV1(value: unknown): PublishPackageAuthorityRecordV1 | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  if (Object.keys(raw).some((key) => !['schemaVersion', 'package', 'editorDocSha256', 'assets', 'status', 'createdAt'].includes(key))
    || raw.schemaVersion !== 1 || raw.status !== 'READY' || typeof raw.createdAt !== 'string'
    || typeof raw.editorDocSha256 !== 'string' || !/^[0-9a-f]{64}$/.test(raw.editorDocSha256)
    || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(raw.createdAt)
    || !Array.isArray(raw.assets)) return null;
  const parsedPackage = parsePublishPackageV1(raw.package);
  if (!parsedPackage.ok) return null;
  const assets = raw.assets.map(parseImmutableAssetObjectRefV1);
  if (assets.some((asset) => asset === null)) return null;
  const outputs = expectedOutputs(parsedPackage.value);
  if (assets.length !== outputs.length) return null;
  for (let index = 0; index < outputs.length; index += 1) {
    const output = outputs[index]; const asset = assets[index]!;
    if (!asset || asset.assetId !== output.assetId || asset.revision !== output.revision
      || asset.sha256 !== output.sha256 || asset.mimeType !== output.mimeType
      || asset.width !== output.width || asset.height !== output.height) return null;
  }
  return structuredClone(value) as PublishPackageAuthorityRecordV1;
}

function parseAuthorityStore(value: unknown): PublishPackageAuthorityStoreV1 | null {
  if (value === null) return { schemaVersion: 1, records: [] };
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  if (Object.keys(raw).some((key) => !['schemaVersion', 'records'].includes(key))
    || raw.schemaVersion !== 1 || !Array.isArray(raw.records)) return null;
  const records: PublishPackageAuthorityRecordV1[] = [];
  const packages = new Set<string>(); const versions = new Set<string>();
  for (const item of raw.records) {
    const record = parsePublishPackageAuthorityRecordV1(item);
    if (!record || packages.has(record.package.packageId) || versions.has(record.package.designVersionId)) return null;
    packages.add(record.package.packageId); versions.add(record.package.designVersionId); records.push(record);
  }
  return { schemaVersion: 1, records };
}

export function createLocalPublishPackageAuthorityPortV1(input?: {
  storage?: { read(): unknown | null; write(value: unknown): void };
}): PublishPackageAuthorityPortV1 {
  const storage = (key: string) => ({
    read: () => readData<unknown>(key),
    write: (value: unknown) => { writeEnvelope(key, value); },
  });
  const repository: VersionedJsonRepositoryV1<PublishPackageAuthorityStoreV1> = createVersionedJsonRepositoryV1({
    storage: input?.storage ?? storage(StorageKeys.backendPublishAuthority),
    empty: () => ({ schemaVersion: 1, records: [] }),
    parse: parseAuthorityStore,
    invalidReason: 'publish.authority_store_corrupted',
  });
  return {
    adapterKind: 'LOCAL_PROTOTYPE',
    async read(context) {
      const allowed = requireServicePermissionV1(context, BACKEND_PERMISSIONS_V1.publicationRead);
      return allowed.ok ? repository.read() : allowed;
    },
    async replace(context, value, expectedEtag) {
      const allowed = requireServicePermissionV1(context, BACKEND_PERMISSIONS_V1.publicationWrite);
      return allowed.ok ? repository.replace({ value, expectedEtag, idempotencyKey: context.idempotencyKey, correlationId: context.correlationId }) : allowed;
    },
  };
}

function sameOutput(left: PublishPackageArtifactV1['output'], right: PublishPackageArtifactV1['output']): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

export async function registerPublishPackageArtifactsV1(input: {
  result: { package: PublishPackageV1; artifacts: PublishPackageArtifactV1[] };
  identity: IdentityAccessPortV1;
  assets: AssetUploadPortV1;
  authority: PublishPackageAuthorityPortV1;
  copyrightDeclared: boolean;
  editorDocSha256: string;
  source: { sourceType: 'ORIGINAL' | 'REMIX' | 'IMPORTED' | 'AI_ASSISTED'; attribution?: string };
}): Promise<ServiceResultV1<PublishPackageAuthorityRecordV1>> {
  const parsedPackage = parsePublishPackageV1(input.result.package);
  if (!parsedPackage.ok) return serviceErrorV1('INVALID', 'publish.invalid_package');
  if (!/^[0-9a-f]{64}$/.test(input.editorDocSha256)) return serviceErrorV1('INVALID', 'publish.invalid_editor_doc_hash');
  const outputs = expectedOutputs(parsedPackage.value);
  if (input.result.artifacts.length !== outputs.length
    || input.result.artifacts.some((artifact, index) => !sameOutput(artifact.output, outputs[index]))) {
    return serviceErrorV1('INTEGRITY_MISMATCH', 'publish.artifact_descriptor_mismatch');
  }
  const assetContext = await input.identity.issueContext({
    operation: BACKEND_OPERATIONS_V1.assetWrite,
    idempotencyKey: `publish-assets.${parsedPackage.value.packageId}`,
  });
  if (!assetContext.ok) return assetContext;
  const uploaded = await input.assets.uploadBatch(assetContext.value, input.result.artifacts.map((artifact, index) => ({
    uploadId: `upload.${parsedPackage.value.packageId}.${index + 1}`,
    assetId: artifact.output.assetId,
    ownerRef: assetContext.value.actor.actorRef,
    purpose: 'PUBLISH_PREVIEW' as const,
    fileName: `${artifact.output.kind.toLowerCase()}-${artifact.output.finger ?? 'all'}.${artifact.output.mimeType.split('/')[1]}`,
    mimeType: artifact.output.mimeType,
    byteLength: artifact.bytes.byteLength,
    sha256: artifact.output.sha256,
    width: artifact.output.width,
    height: artifact.output.height,
    colorSpace: artifact.output.colorSpace,
    alphaMode: artifact.output.mimeType === 'image/jpeg' ? 'OPAQUE' as const : 'STRAIGHT' as const,
    source: input.source,
    copyrightDeclared: input.copyrightDeclared,
    moderationStatus: 'PENDING' as const,
    bytes: artifact.bytes,
  })));
  if (!uploaded.ok) return uploaded;
  if (uploaded.value.some((record) => record.status !== 'READY')) {
    return serviceErrorV1('PRECONDITION_FAILED', 'publish.assets_not_ready', false, assetContext.value.correlationId);
  }
  const readContext = await input.identity.issueContext({ operation: BACKEND_OPERATIONS_V1.publicationRead });
  if (!readContext.ok) return readContext;
  const current = await input.authority.read(readContext.value);
  if (!current.ok) return current;
  const existing = current.value.value.records.find((record) => record.package.packageId === parsedPackage.value.packageId
    || record.package.designVersionId === parsedPackage.value.designVersionId);
  if (existing) {
    return existing.package.packageId === parsedPackage.value.packageId
      ? { ok: true, value: existing, changed: false }
      : serviceErrorV1('CONFLICT', 'publish.design_version_package_conflict', false, readContext.value.correlationId);
  }
  const record: PublishPackageAuthorityRecordV1 = {
    schemaVersion: 1,
    package: structuredClone(parsedPackage.value),
    editorDocSha256: input.editorDocSha256,
    assets: uploaded.value.map((item: AssetUploadRecordV1) => structuredClone(item.object)),
    status: 'READY',
    createdAt: assetContext.value.now,
  };
  const parsedRecord = parsePublishPackageAuthorityRecordV1(record);
  if (!parsedRecord) return serviceErrorV1('INTERNAL', 'publish.authority_record_contract_failed');
  const writeContext = await input.identity.issueContext({
    operation: BACKEND_OPERATIONS_V1.publicationWrite,
    idempotencyKey: `publish-authority.${parsedPackage.value.packageId}`,
  });
  if (!writeContext.ok) return writeContext;
  const saved = await input.authority.replace(writeContext.value, {
    schemaVersion: 1,
    records: [...current.value.value.records, parsedRecord],
  }, current.value.etag);
  return saved.ok ? { ok: true, value: parsedRecord, changed: saved.changed } : saved;
}

export function createAssetReferenceResolverV1(input: {
  identity: IdentityAccessPortV1;
  assets: AssetUploadPortV1;
  aliases: readonly AssetRevisionAliasV1[];
  bundled?: readonly BundledAssetAliasV1[];
}): AssetReferenceResolverV1 {
  return {
    async resolve(ref) {
      const bundled = typeof ref.revision === 'string'
        ? input.bundled?.find((candidate) => candidate.sourceAssetId === ref.assetId && candidate.sourceRevision === ref.revision)
        : undefined;
      if (bundled) {
        if (bundled.canonicalRef.assetId !== bundled.canonicalAssetId
          || bundled.canonicalRef.revision !== bundled.canonicalRevision
          || (ref.sha256 && ref.sha256 !== bundled.canonicalRef.sha256)
          || (ref.mimeType && ref.mimeType !== bundled.canonicalRef.mimeType)) {
          return serviceErrorV1('INTEGRITY_MISMATCH', 'asset.bundled_reference_mismatch');
        }
        return { ok: true, value: structuredClone(bundled.canonicalRef), changed: false };
      }
      const alias = typeof ref.revision === 'number'
        ? { canonicalAssetId: ref.assetId, canonicalRevision: ref.revision }
        : input.aliases.find((candidate) => candidate.sourceAssetId === ref.assetId && candidate.sourceRevision === ref.revision);
      if (!alias) return serviceErrorV1('NOT_FOUND', 'asset.revision_alias_not_found');
      const context = await input.identity.issueContext({ operation: BACKEND_OPERATIONS_V1.assetRead });
      if (!context.ok) return context;
      const record = await input.assets.get(context.value, alias.canonicalAssetId, alias.canonicalRevision);
      if (!record.ok) return record;
      if (record.value.status !== 'READY' || (ref.sha256 && ref.sha256 !== record.value.object.sha256)
        || (ref.mimeType && ref.mimeType !== record.value.object.mimeType)) {
        return serviceErrorV1('INTEGRITY_MISMATCH', 'asset.reference_mismatch', false, context.value.correlationId);
      }
      return {
        ok: true,
        value: {
          assetId: record.value.object.assetId,
          revision: record.value.object.revision,
          sha256: record.value.object.sha256,
          mimeType: record.value.object.mimeType,
        },
        changed: false,
      };
    },
  };
}

export async function readAuthoritativePackageByVersionV1(input: {
  identity: IdentityAccessPortV1;
  authority: PublishPackageAuthorityPortV1;
  designVersionId: string;
}): Promise<ServiceResultV1<PublishPackageAuthorityRecordV1>> {
  const context = await input.identity.issueContext({ operation: BACKEND_OPERATIONS_V1.publicationRead });
  if (!context.ok) return context;
  const current = await input.authority.read(context.value);
  if (!current.ok) return current;
  const record = current.value.value.records.find((candidate) => candidate.package.designVersionId === input.designVersionId);
  return record
    ? { ok: true, value: structuredClone(record), changed: false }
    : serviceErrorV1('NOT_FOUND', 'publish.package_not_found', false, context.value.correlationId);
}
