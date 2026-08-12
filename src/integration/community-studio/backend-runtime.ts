/** Browser composition root for GEN-V7.1-04. No page imports localStorage repositories. */
import { createClientId } from '@/lib/storage';
import type { CommunityContentV1 } from '@/community/domain/types';
import type { CanonicalPublishedLookReadModelV1 } from '@/community/domain/v7_1/published-look-read-model';
import {
  BACKEND_PERMISSIONS_V1,
  createClientApprovalApplicationServiceV1,
  createCreatorWorkspaceApplicationServiceV1,
  createGovernanceApplicationServiceV1,
  createIndexedDbAssetBinaryStorageV1,
  createLocalAssetUploadPortV1,
  createLocalClientApprovalPortV1,
  createLocalCreatorPublicationPortV1,
  createLocalGovernancePortV1,
  createLocalPrototypeIdentityAccessPortV1,
  createLocalPublishPackageAuthorityPortV1,
  readAuthoritativePackageByVersionV1,
  registerPublishPackageArtifactsV1,
  type PublishPackageAuthorityRecordV1,
  type ServiceResultV1,
} from '@/platform/backend';
import {
  buildPublishPackageV1,
  createDeterministicPublishIdFactoryV1,
  type PublishRenderRequestV1,
  type PublishRendererV1,
} from '@/studio/publishing';
import { CANONICAL_USE_DEMO_RELEASE_RECORD_V1 } from './canonical-use-demo';

async function sha256Bytes(bytes: Uint8Array): Promise<string> {
  if (!globalThis.crypto?.subtle) throw new Error('SHA-256 unavailable');
  const stable = Uint8Array.from(bytes);
  const digest = await globalThis.crypto.subtle.digest('SHA-256', stable.buffer);
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, '0')).join('');
}

async function sha256Text(value: string): Promise<string> {
  return sha256Bytes(new TextEncoder().encode(value));
}

function canvasPngRenderer(): PublishRendererV1 {
  return {
    rendererId: 'creator.local-canvas-2d',
    async render(request: PublishRenderRequestV1) {
      if (typeof document === 'undefined') return { ok: false, reason: 'canvas_unavailable' };
      const canvas = document.createElement('canvas');
      canvas.width = request.width; canvas.height = request.height;
      const context = canvas.getContext('2d');
      if (!context) return { ok: false, reason: 'canvas_context_unavailable' };
      const gradient = context.createLinearGradient(0, 0, request.width, request.height);
      gradient.addColorStop(0, request.palette[0] ?? '#f7a8c6');
      gradient.addColorStop(1, request.palette[request.palette.length - 1] ?? '#f04e7e');
      context.fillStyle = '#faf6ef'; context.fillRect(0, 0, request.width, request.height);
      const columns = request.kind === 'COVER' ? 5 : 1;
      const rows = request.kind === 'COVER' ? 2 : 1;
      const margin = request.width * 0.06;
      for (let index = 0; index < columns * rows; index += 1) {
        const column = index % columns; const row = Math.floor(index / columns);
        const width = (request.width - margin * (columns + 1)) / columns;
        const height = (request.height - margin * (rows + 1)) / rows;
        const x = margin + column * (width + margin); const y = margin + row * (height + margin);
        context.save(); context.translate(x + width / 2, y + height / 2);
        context.beginPath();
        context.moveTo(0, -height * 0.42);
        context.bezierCurveTo(width * 0.42, -height * 0.25, width * 0.45, height * 0.28, width * 0.32, height * 0.4);
        context.quadraticCurveTo(0, height * 0.48, -width * 0.32, height * 0.4);
        context.bezierCurveTo(-width * 0.45, height * 0.28, -width * 0.42, -height * 0.25, 0, -height * 0.42);
        context.closePath(); context.fillStyle = gradient; context.fill();
        context.strokeStyle = 'rgba(94,67,62,.45)'; context.lineWidth = Math.max(1, request.width / 512); context.stroke();
        context.restore();
      }
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
      if (!blob) return { ok: false, reason: 'canvas_encode_failed' };
      return {
        ok: true,
        output: {
          bytes: new Uint8Array(await blob.arrayBuffer()), mimeType: 'image/png',
          width: request.width, height: request.height, colorSpace: 'srgb', fidelity: 'APPROXIMATE',
        },
      };
    },
  };
}

const creatorPermissions = Object.values(BACKEND_PERMISSIONS_V1);
const creatorIdentity = createLocalPrototypeIdentityAccessPortV1({
  actorRef: 'profile.local-demo.creator', permissions: creatorPermissions,
});
const operatorIdentity = createLocalPrototypeIdentityAccessPortV1({
  actorRef: 'operator.local-demo',
  permissions: [BACKEND_PERMISSIONS_V1.governanceRead, BACKEND_PERMISSIONS_V1.governanceWrite],
});
const anonymousIdentity = createLocalPrototypeIdentityAccessPortV1({
  actorRef: 'anonymous.client-share',
  permissions: [BACKEND_PERMISSIONS_V1.approvalRead, BACKEND_PERMISSIONS_V1.approvalWrite, BACKEND_PERMISSIONS_V1.packageReferenceRead],
  disclosure: 'ANONYMOUS_SHARE',
});

const publicationPort = createLocalCreatorPublicationPortV1();
const governancePort = createLocalGovernancePortV1();
const approvalPort = createLocalClientApprovalPortV1();
const assetPort = createLocalAssetUploadPortV1({ binary: createIndexedDbAssetBinaryStorageV1(), sha256: sha256Bytes });
const authorityPort = createLocalPublishPackageAuthorityPortV1();
const nextId = (scope: string) => createClientId(scope);
const previewUrls = new Map<string, string>();

export const creatorWorkspaceServiceV1 = createCreatorWorkspaceApplicationServiceV1({
  identity: creatorIdentity,
  publication: publicationPort,
  governance: governancePort,
  approvals: approvalPort,
  authority: authorityPort,
  assets: assetPort,
  nextId,
  token: {
    generate() {
      if (!globalThis.crypto?.getRandomValues) throw new Error('secure randomness unavailable');
      return [...globalThis.crypto.getRandomValues(new Uint8Array(24))].map((value) => value.toString(16).padStart(2, '0')).join('');
    },
    sha256: sha256Text,
  },
});

export const governanceServiceV1 = createGovernanceApplicationServiceV1({
  identity: operatorIdentity, governance: governancePort, nextId,
});

export const clientApprovalServiceV1 = createClientApprovalApplicationServiceV1({
  identity: anonymousIdentity, approvals: approvalPort, authority: authorityPort, nextId, sha256: sha256Text,
});

export async function ensureCanonicalDemoPublishAuthorityV1(): Promise<ServiceResultV1<PublishPackageAuthorityRecordV1>> {
  const designVersionId = CANONICAL_USE_DEMO_RELEASE_RECORD_V1.designVersion.designVersionId;
  const existing = await readAuthoritativePackageByVersionV1({ identity: creatorIdentity, authority: authorityPort, designVersionId });
  if (existing.ok) {
    const readContext = await creatorIdentity.issueContext({ operation: BACKEND_PERMISSIONS_V1.assetRead });
    if (!readContext.ok) return readContext;
    for (const asset of existing.value.assets) {
      const bytes = await assetPort.readBytes(readContext.value, asset.assetId, asset.revision);
      if (!bytes.ok) return bytes;
    }
    return existing;
  }
  if (existing.error.code !== 'NOT_FOUND') return existing;
  const renderer = canvasPngRenderer();
  const generated = await buildPublishPackageV1(CANONICAL_USE_DEMO_RELEASE_RECORD_V1, {
    rendererRevision: 'creator-local-canvas-v1', renderer3d: null, renderer2d: renderer,
    sha256: sha256Bytes, nextAssetId: createDeterministicPublishIdFactoryV1(),
    resolveGeometry: () => ({ status: 'resolved', shapeId: 'almond', lengthId: 'medium' }),
  });
  if (!generated.ok) return { ok: false, error: { schemaVersion: 1, code: 'UNAVAILABLE', retryable: true, reason: `publish.${generated.code}` } };
  return registerPublishPackageArtifactsV1({
    result: generated,
    identity: creatorIdentity,
    assets: assetPort,
    authority: authorityPort,
    editorDocSha256: CANONICAL_USE_DEMO_RELEASE_RECORD_V1.designVersion.editorDocRef.sha256,
    copyrightDeclared: true,
    source: { sourceType: 'ORIGINAL' },
  });
}

export async function loadCreatorPublishedLookReadModelsV1(): Promise<CanonicalPublishedLookReadModelV1[]> {
  const workspace = await creatorWorkspaceServiceV1.load();
  if (!workspace.ok) throw new Error(workspace.error.reason);
  const publicLooks = workspace.value.publication.looks.filter((look) => look.status === 'PUBLISHED' && look.visibility === 'PUBLIC');
  const output: CanonicalPublishedLookReadModelV1[] = [];
  for (const look of publicLooks) {
    const authority = await readAuthoritativePackageByVersionV1({ identity: creatorIdentity, authority: authorityPort, designVersionId: look.designVersionId });
    if (!authority.ok) continue;
    const readContext = await creatorIdentity.issueContext({ operation: BACKEND_PERMISSIONS_V1.assetRead });
    if (!readContext.ok) continue;
    const coverBytes = await assetPort.readBytes(readContext.value, authority.value.package.cover.assetId, authority.value.package.cover.revision);
    if (!coverBytes.ok) continue;
    const coverKey = `${authority.value.package.cover.assetId}#${authority.value.package.cover.revision}`;
    let coverUrl = previewUrls.get(coverKey);
    if (!coverUrl) {
      coverUrl = URL.createObjectURL(new Blob([Uint8Array.from(coverBytes.value)], { type: authority.value.package.cover.mimeType }));
      previewUrls.set(coverKey, coverUrl);
    }
    const sourceContent: CommunityContentV1 = {
      schemaVersion: 1, contentId: look.lookId, contentType: 'LOOK_SET', title: look.title,
      publisherId: look.creatorProfileId, publisherType: 'VERIFIED_CREATOR', curationStatus: 'NONE',
      cover: { url: coverUrl, kind: 'CANONICAL_RENDER' }, media: [], mainStyleId: 'st02', subStyleIds: [],
      occasionIds: [], subjectIds: [], moodIds: [], effectIds: [], primaryColorIds: [],
      recommendedShapes: [...look.summaries.shapeIds], supportedShapes: [...look.summaries.shapeIds], notRecommendedShapes: {},
      supportedLengths: [...look.summaries.lengthIds], applicationLevel: 'STRUCTURED_EDITABLE', verificationLevel: 'RENDER_VERIFIED',
      campaignTags: ['creator-public'], status: 'PUBLISHED', publishedAt: look.publishedAt ?? look.updatedAt,
    };
    output.push({
      schemaVersion: 1, readModelKind: 'CANONICAL', lookId: look.lookId, contentId: look.lookId,
      title: look.title, publisherId: look.creatorProfileId, publisherType: 'VERIFIED_CREATOR', curationStatus: 'NONE',
      cover: structuredClone(sourceContent.cover), media: [], mainStyleId: sourceContent.mainStyleId, subStyleIds: [],
      occasionIds: [], subjectIds: [], moodIds: [], effectIds: [], primaryColorIds: [],
      recommendedShapes: [...look.summaries.shapeIds], supportedShapes: [...look.summaries.shapeIds], notRecommendedShapes: {},
      supportedLengths: [...look.summaries.lengthIds], applicationLevel: 'STRUCTURED_EDITABLE', verificationLevel: 'RENDER_VERIFIED',
      campaignTags: ['creator-public'], publishedAt: look.publishedAt ?? look.updatedAt,
      evidence: {
        immutableDesignVersion: { present: true, designVersionId: look.designVersionId, editorDocRef: { designId: authority.value.package.designId, schemaVersion: 7, revision: authority.value.package.revision, sha256: authority.value.editorDocSha256 } },
        previewEvidence: { present: true, previewRevision: look.coverPreview.revision, previewSha256: look.coverPreview.sha256, fidelity: look.coverPreview.fidelity },
        publicationGate: { present: true, copyrightDeclared: true, sourceDeclared: true, moderationCleared: true },
        status: { sourceStatus: 'PUBLISHED', viewable: true, previewVerified: true, manufacturable: false, productionDispatched: false },
      },
      designVersionId: look.designVersionId, creatorProfileId: look.creatorProfileId, visibility: 'PUBLIC',
      publicationGateVerified: true, sourceLook: structuredClone(look), sourceContent,
    });
  }
  return output;
}
