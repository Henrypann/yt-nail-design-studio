import { parseEditorDocV7 } from '@/studio/editor/v7/schema';
import {
  releaseSavedEditorDocV7,
  type DesignReleaseDependenciesV1,
} from '@/studio/versioning/design-release';
import { canonicalJsonV1 } from '@/studio/versioning/design-release';
import { buildPublishPackageV1, type PublishRendererV1, type PublishPackageOutputV1, type PublishPackageV1 } from '@/studio/publishing';
import type { AssetUploadPortV1 } from '@/platform/backend/asset-contract';
import { registerPublishPackageArtifactsV1, type PublishPackageAuthorityPortV1 } from '@/platform/backend/publish-authority';
import type { ClientApprovalPortV1 } from '@/platform/backend/domain-ports';
import { createClientShareV1 } from './client-approval';
import type { IdentityAccessPortV1, ServiceResultV1 } from '@/platform/backend/service-contract';
import { BACKEND_OPERATIONS_V1 } from '@/platform/backend/domain-ports';
import type { FixedPreviewAssetV1, FixedPreviewReadModelV1 } from '@/platform/backend/fixed-preview-contract';

export interface StudioApprovalApplicationServiceV1 {
  createFixedVersionShare(input: { designId: string; expectedRevision: number }): Promise<ServiceResultV1<{ rawToken: string; shareLinkId: string; designVersionId: string; preview: FixedPreviewReadModelV1 }>>;
}

export interface FixedApprovalReceiptV1 {
  schemaVersion: 1;
  records: Array<{ designId: string; revision: number; shareLinkId: string; designVersionId: string; rawToken: string; tokenHash: string; expiresAt: string; state: 'PENDING' | 'COMMITTED' }>;
}

function resultError(code: 'INVALID' | 'PRECONDITION_FAILED' | 'DATA_CORRUPTED' | 'UNAVAILABLE' | 'CONFLICT', reason: string, retryable = false): ServiceResultV1<never> {
  return { ok: false, error: { schemaVersion: 1, code, reason, retryable } };
}

function parseReceipts(value: unknown): FixedApprovalReceiptV1 | null {
  if (value === null || value === undefined) return { schemaVersion: 1, records: [] };
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  if (raw.schemaVersion !== 1 || !Array.isArray(raw.records)) return null;
  const records: FixedApprovalReceiptV1['records'] = [];
  for (const item of raw.records) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
    const r = item as Record<string, unknown>;
    const valid = typeof r.designId === 'string' && typeof r.revision === 'number' && Number.isInteger(r.revision) && r.revision > 0
      && typeof r.shareLinkId === 'string' && typeof r.designVersionId === 'string'
      && typeof r.rawToken === 'string' && r.rawToken.length >= 32
      && typeof r.tokenHash === 'string' && /^[0-9a-f]{64}$/.test(r.tokenHash)
      && typeof r.expiresAt === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(r.expiresAt)
      && (r.state === 'PENDING' || r.state === 'COMMITTED')
      && !records.some((x) => x.shareLinkId === r.shareLinkId || x.tokenHash === r.tokenHash || (x.designId === r.designId && x.revision === r.revision));
    if (!valid) return null;
    records.push(r as FixedApprovalReceiptV1['records'][number]);
  }
  return { schemaVersion: 1, records: structuredClone(records) };
}

export function createStudioApprovalApplicationServiceV1(input: {
  identity: IdentityAccessPortV1;
  approvals: ClientApprovalPortV1;
  authority: PublishPackageAuthorityPortV1;
  assets: AssetUploadPortV1;
  release: DesignReleaseDependenciesV1;
  readPersistedEditorDoc(designId: string): unknown;
  renderer2d: PublishRendererV1;
  sha256Bytes(bytes: Uint8Array): Promise<string>;
  sha256Text(value: string): Promise<string>;
  nextId(scope: string): string;
  receipts: { read(): unknown | null; write(value: FixedApprovalReceiptV1): void };
  expiresInMs?: number;
}): StudioApprovalApplicationServiceV1 {
  const service: StudioApprovalApplicationServiceV1 = {
    async createFixedVersionShare({ designId, expectedRevision }) {
      if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(designId) || !Number.isSafeInteger(expectedRevision) || expectedRevision < 1) {
        return resultError('INVALID', 'approval.fixed_version_invalid_request');
      }
      const write = await input.identity.issueContext({ operation: BACKEND_OPERATIONS_V1.approvalWrite });
      if (!write.ok) return write;
      const source = input.readPersistedEditorDoc(designId);
      const parsed = parseEditorDocV7(source);
      if (!parsed.ok || parsed.doc.designId !== designId || parsed.doc.revision !== expectedRevision) {
        return resultError('PRECONDITION_FAILED', 'approval.fixed_version_revision_mismatch');
      }
      const parsedReceipts = parseReceipts(input.receipts.read());
      if (!parsedReceipts) return resultError('DATA_CORRUPTED', 'approval.fixed_version_receipt_corrupted');
      const existingReceipt = parsedReceipts.records.find((r) => r.designId === designId && r.revision === expectedRevision);
      if (existingReceipt) {
        const authority = await input.identity.issueContext({ operation: BACKEND_OPERATIONS_V1.packageReferenceRead });
        if (!authority.ok) return authority;
        const current = await input.authority.read(authority.value);
        if (!current.ok) return current;
        const record = current.value.value.records.find((candidate) => candidate.package.designVersionId === existingReceipt.designVersionId);
        if (!record) return resultError('DATA_CORRUPTED', 'approval.fixed_version_receipt_missing_package');
        const approvalContext = await input.identity.issueContext({ operation: BACKEND_OPERATIONS_V1.approvalRead });
        if (!approvalContext.ok) return approvalContext;
        const approvalStore = await input.approvals.read(approvalContext.value);
        if (!approvalStore.ok) return approvalStore;
        const existingShare = approvalStore.value.value.shares.find((share) => share.shareLinkId === existingReceipt.shareLinkId);
        if (existingShare && (existingShare.tokenHash !== existingReceipt.tokenHash || existingShare.designVersionId !== existingReceipt.designVersionId
          || existingShare.expiresAt !== existingReceipt.expiresAt || existingShare.status !== 'ACTIVE'
          || existingShare.editorDocSha256 !== record.editorDocSha256
          || canonicalJsonV1(existingShare.package) !== canonicalJsonV1(record.package))) {
          return resultError('DATA_CORRUPTED', 'approval.fixed_version_receipt_share_mismatch');
        }
        if ((existingShare && existingShare.expiresAt <= write.value.now) || existingReceipt.expiresAt <= write.value.now || await input.sha256Text(existingReceipt.rawToken) !== existingReceipt.tokenHash) {
          return resultError('PRECONDITION_FAILED', (existingShare?.expiresAt ?? existingReceipt.expiresAt) <= write.value.now ? 'approval.fixed_version_share_expired' : 'approval.fixed_version_receipt_token_mismatch');
        }
        const preview = await buildFixedPreviewReadModelV1(record, input.assets, input.identity);
        if (!preview.ok) return preview;
        if (!existingShare) {
          const recovered = createClientShareV1({ store: approvalStore.value.value, shareLinkId: existingReceipt.shareLinkId, tokenHash: existingReceipt.tokenHash, editorDocSha256: record.editorDocSha256, package: record.package, now: write.value.now, expiresAt: existingReceipt.expiresAt });
          if (!recovered.ok) return resultError('CONFLICT', 'approval.fixed_version_recovery_conflict');
          const savedRecovery = await input.approvals.replace(write.value, recovered.value, approvalStore.value.etag);
          if (!savedRecovery.ok) return savedRecovery;
          try { input.receipts.write({ schemaVersion: 1, records: parsedReceipts.records.map((item) => item.shareLinkId === existingReceipt.shareLinkId ? { ...item, state: 'COMMITTED' as const } : item) }); } catch { /* pending receipt remains recoverable */ }
        }
        return { ok: true, value: { rawToken: existingReceipt.rawToken, shareLinkId: existingReceipt.shareLinkId, designVersionId: existingReceipt.designVersionId, preview: preview.value }, changed: !existingShare };
      }
      const release = await releaseSavedEditorDocV7({
        designId, expectedRevision,
        runtimeGuard: { saveState: 'saved', savedRevision: expectedRevision, pendingRevision: null },
      }, input.release);
      if (!release.ok) return resultError('PRECONDITION_FAILED', `approval.release_${release.code}`);
      const packageResult = await buildPublishPackageV1(release.record, {
        rendererRevision: 'studio-fixed-preview-2d-v1', renderer3d: null, renderer2d: input.renderer2d,
        sha256: input.sha256Bytes, nextAssetId: (kind, finger, digest) => `fixed.${kind.toLowerCase()}.${finger ?? 'all'}.${digest.slice(0, 24)}`,
        resolveGeometry: ({ assetId, revision }) => ({ status: 'resolved', shapeId: assetId, lengthId: revision }),
      });
      if (!packageResult.ok) return resultError('UNAVAILABLE', `approval.package_${packageResult.code}`, true);
      const registered = await registerPublishPackageArtifactsV1({
        result: packageResult, identity: input.identity, assets: input.assets, authority: input.authority,
        editorDocSha256: release.record.designVersion.editorDocRef.sha256, copyrightDeclared: true, source: { sourceType: 'ORIGINAL' },
      });
      if (!registered.ok) return registered;
      const preview = await buildFixedPreviewReadModelV1(registered.value, input.assets, input.identity);
      if (!preview.ok) return preview;
      const receipts = parseReceipts(input.receipts.read());
      if (!receipts) return resultError('DATA_CORRUPTED', 'approval.fixed_version_receipt_corrupted');
      const token = `${input.nextId('share-token.')}${input.nextId('share-token.')}${input.nextId('share-token.')}`;
      const tokenHash = await input.sha256Text(token);
      const expiresAt = new Date(Date.parse(write.value.now) + (input.expiresInMs ?? 7 * 24 * 60 * 60 * 1000)).toISOString();
      const shareId = input.nextId('share.');
      const pendingReceipt: FixedApprovalReceiptV1 = { schemaVersion: 1, records: [...receipts.records, { designId, revision: expectedRevision, shareLinkId: shareId, designVersionId: release.record.designVersion.designVersionId, rawToken: token, tokenHash, expiresAt, state: 'PENDING' }] };
      try { input.receipts.write(pendingReceipt); } catch { return resultError('UNAVAILABLE', 'approval.fixed_version_receipt_write_failed', true); }
      const readApproval = await input.identity.issueContext({ operation: BACKEND_OPERATIONS_V1.approvalRead });
      if (!readApproval.ok) return readApproval;
      const current = await input.approvals.read(readApproval.value);
      if (!current.ok) return current;
      const created = createClientShareV1({ store: current.value.value, shareLinkId: shareId, tokenHash, editorDocSha256: release.record.designVersion.editorDocRef.sha256, package: registered.value.package, now: write.value.now, expiresAt });
      if (!created.ok) return resultError('CONFLICT', 'approval.fixed_version_share_conflict');
      const saved = await input.approvals.replace(write.value, created.value, current.value.etag);
      if (!saved.ok) return saved;
      try { input.receipts.write({ schemaVersion: 1, records: pendingReceipt.records.map((item) => item.shareLinkId === shareId ? { ...item, state: 'COMMITTED' as const } : item) }); } catch { /* pending receipt remains recoverable */ }
      return { ok: true, value: { rawToken: token, shareLinkId: shareId, designVersionId: release.record.designVersion.designVersionId, preview: preview.value }, changed: true };
    },
  };
  return service;
}

export async function buildFixedPreviewReadModelV1(record: { package: PublishPackageV1 }, assets: AssetUploadPortV1, identity: IdentityAccessPortV1): Promise<ServiceResultV1<FixedPreviewReadModelV1>> {
  const context = await identity.issueContext({ operation: BACKEND_OPERATIONS_V1.assetRead });
  if (!context.ok) return context;
  const outputs: PublishPackageOutputV1[] = [record.package.cover, ...record.package.details];
  if (record.package.cover.kind !== 'COVER' || record.package.cover.finger !== undefined
    || record.package.details.length !== 10 || new Set(record.package.details.map((item) => item.finger)).size !== 10
    || record.package.details.some((item) => item.kind !== 'DETAIL' || !item.finger)
    || record.package.details.some((item, index) => item.finger !== ['L1','L2','L3','L4','L5','R1','R2','R3','R4','R5'][index])) {
    return resultError('DATA_CORRUPTED', 'approval.fixed_preview_package_shape_invalid');
  }
  const items: FixedPreviewAssetV1[] = [];
  for (const output of outputs) {
    const metadata = await assets.get(context.value, output.assetId, output.revision);
    if (!metadata.ok) return resultError('DATA_CORRUPTED', 'approval.fixed_preview_asset_missing');
    if (metadata.value.object.sha256 !== output.sha256 || metadata.value.object.mimeType !== output.mimeType
      || metadata.value.object.revision !== output.revision || metadata.value.status !== 'READY') {
      return resultError('DATA_CORRUPTED', 'approval.fixed_preview_asset_identity_mismatch');
    }
    const bytes = await assets.readBytes(context.value, output.assetId, output.revision);
    if (!bytes.ok || await digestBytes(bytes.value) !== output.sha256) return resultError('DATA_CORRUPTED', 'approval.fixed_preview_asset_corrupt');
    const locator = `data:${output.mimeType};base64,${base64(bytes.value)}`;
    items.push({ kind: output.kind, ...(output.finger ? { finger: output.finger } : {}), assetId: output.assetId, revision: output.revision, sha256: output.sha256, mimeType: output.mimeType, fidelity: output.fidelity, locator });
  }
  return { ok: true, value: { schemaVersion: 1, fidelity: record.package.fidelity, cover: items[0], details: items.slice(1) }, changed: false };
}

function base64(bytes: Uint8Array): string {
  if (typeof btoa === 'function') {
    let value = '';
    for (let index = 0; index < bytes.length; index += 0x8000) value += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
    return btoa(value);
  }
  return '';
}

async function digestBytes(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes.slice().buffer);
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, '0')).join('');
}
