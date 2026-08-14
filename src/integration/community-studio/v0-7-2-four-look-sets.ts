/**
 * Official v0.7.2 four-Look integration authority.
 *
 * The public records reference immutable EditorDocV7 releases. Source snapshots
 * remain private to Studio integration code. Preview and mesh evidence is
 * simulated; no record claims manufacturing, material, fit or device proof.
 */
import type { CommunityContentV1 } from '@/community/domain/types';
import type { PublishedLookV1 } from '@/community/domain/v7_1/design-content-model';
import type { CanonicalPublishedLookReadModelV1 } from '@/community/domain/v7_1/published-look-read-model';
import { createBlankEditorDocV7 } from '@/studio/editor/v7/create';
import { dimensionalMeshAssetRefV7 } from '@/studio/editor/v7/dimensional-decoration';
import {
  FOUR_LOOK_SET_DEFINITIONS_V0_7_2,
  materializeFourLookSetV0_7_2,
  type FourLookSetDefinitionV0_7_2,
} from '@/studio/editor/v7/four-look-sets';
import type { EditorDocV7 } from '@/studio/editor/v7/model';
import { parseEditorDocV7 } from '@/studio/editor/v7/schema';
import {
  buildDesignReleaseManifestV1,
  type DesignReleaseRecordV1,
  type ReleasedAssetReferenceMappingV1,
} from '@/studio/versioning/design-release';

const CREATOR_PROFILE_ID = 'profile.nailstyle.official';
const PUBLISHER_ID = 'pub_nailstyle_official';
const RELEASED_BY_IDENTITY_ID = 'identity.nailstyle.official';

const EDITOR_DOC_SHA256: Record<string, string> = {
  'leopard-gilded-nude': '918bd37ce31c5752d85048e68692e1c9d8b1fc0559a5f1e262f0d73b7af09586',
  'crimson-reliquary': 'de6647728dfc1c72fe80afd4c61f5077614d701bb06cc72fe272a6a3790deb58',
  'ivory-lace-crystal': '7a5f3d422e45b835a9196668f61ca7ba63a3c5211cbc44debc5d7fa30f343562',
  'honey-petal-glass': 'b708d16c6a44a150dd6b4741df379797f5c14bf827373a080a5b42df3391c973',
};

const COVER_SHA256: Record<string, string> = {
  'leopard-gilded-nude': '842f50ee687a1bbc9ef2c5df21559a18d077629677574105e2fe482caf8cc92e',
  'crimson-reliquary': '3dd8ab248a5917b69387bf50d0eac866c27a5fdd1b6d5625092fade338f9c8d0',
  'ivory-lace-crystal': '9292a53fa9c364c55474e96acab7cad41abaf43688c36f6f3d7db8a909ccee81',
  'honey-petal-glass': 'c813689b8e825bfcdb323415621fb33e427d78f009a27eb62173ad81f95b8813',
};

const MESH_ASSET_IDS = [
  'look.leopard-gilded-nude.decoration.gilded-crystal-cluster',
  'look.crimson-reliquary.decoration.gold-cross-chain',
  'look.ivory-lace-crystal.decoration.teardrop-pearl-cluster',
  'look.ivory-lace-crystal.decoration.ivory-relief-flower',
  'look.ivory-lace-crystal.decoration.ivory-lace-applique',
  'look.honey-petal-glass.decoration.glass-flower-pearl',
] as const;

function assetMappings(): ReleasedAssetReferenceMappingV1[] {
  return MESH_ASSET_IDS.map((assetId) => {
    const asset = dimensionalMeshAssetRefV7(assetId);
    if (!asset) throw new Error(`missing four-look mesh registry entry: ${assetId}`);
    return {
      sourceAssetId: asset.assetId,
      sourceRevision: asset.revision,
      canonicalRef: { assetId: asset.assetId, revision: 1, sha256: asset.sha256, mimeType: asset.mimeType },
    };
  });
}

function sourceDoc(definition: FourLookSetDefinitionV0_7_2): EditorDocV7 {
  const created = createBlankEditorDocV7({
    designId: `design.v0-7-2.${definition.id}.source`, shape: 'almond', length: 'medium',
    title: definition.title, baseColor: definition.fingers.L1.background.color, finish: 'gloss', now: definition.publishedAt,
  });
  if (!created.ok) throw new Error(created.message);
  const materialized = materializeFourLookSetV0_7_2(created.doc, definition.id);
  if (!materialized) throw new Error(`failed to materialize ${definition.id}`);
  const parsed = parseEditorDocV7(materialized);
  if (!parsed.ok) throw new Error(parsed.reason);
  return parsed.doc;
}

function content(definition: FourLookSetDefinitionV0_7_2): CommunityContentV1 {
  const mainStyleId = definition.id === 'crimson-reliquary'
    ? 'ST-06'
    : definition.id === 'leopard-gilded-nude'
      ? 'ST-10'
      : 'ST-03';
  return {
    schemaVersion: 1, contentId: `look.v0-7-2.${definition.id}`, contentType: 'LOOK_SET',
    title: definition.titleZh, titleEn: definition.title, publisherId: PUBLISHER_ID, publisherType: 'OFFICIAL',
    curationStatus: 'FEATURED_BY_OFFICIAL',
    cover: { url: `/assets/hero-recipes/${definition.id}/look-cover-16x9-v1.png`, kind: 'EDITORIAL' },
    media: [{ id: `media.${definition.id}.cover`, url: `/assets/hero-recipes/${definition.id}/look-cover-16x9-v1.png`, kind: 'EDITORIAL' }],
    mainStyleId, subStyleIds: [], occasionIds: ['daily'], subjectIds: [], moodIds: ['elegant'],
    effectIds: ['gloss', 'relief'], primaryColorIds: ['nude'], recommendedShapes: ['almond'],
    supportedShapes: ['almond'], notRecommendedShapes: { stiletto: '立体装饰的侧壁安全区尚未验证' },
    supportedLengths: ['medium'], applicationLevel: 'STRUCTURED_EDITABLE', verificationLevel: 'RENDER_VERIFIED',
    assetRef: { templateId: `t_${definition.id.replace(/-/g, '_')}_simulated`, renderTemplateId: `t_${definition.id.replace(/-/g, '_')}_simulated`, recipeId: definition.id, assetVersion: '1.0.0-simulated', manifestUrl: `/assets/hero-recipes/${definition.id}/manifest.json` },
    campaignTags: ['v0.7.2', 'structured-v7', 'simulated-assets'], status: 'PUBLISHED', publishedAt: definition.publishedAt,
  };
}

function buildAuthority(definition: FourLookSetDefinitionV0_7_2) {
  const doc = sourceDoc(definition);
  const manifest = buildDesignReleaseManifestV1(doc, assetMappings());
  if (!manifest.ok) throw new Error(manifest.message);
  const lookId = `look.v0-7-2.${definition.id}`;
  const versionId = `dv.v0-7-2.${definition.id}.1`;
  const release: DesignReleaseRecordV1 = {
    schemaVersion: 1,
    designVersion: {
      schemaVersion: 1, designVersionId: versionId, designId: doc.designId, version: 1, revision: doc.revision,
      editorDocRef: { designId: doc.designId, schemaVersion: 7, revision: doc.revision, sha256: EDITOR_DOC_SHA256[definition.id] },
      releasedByIdentityId: RELEASED_BY_IDENTITY_ID, releasedAt: definition.publishedAt,
      assetRevisionRefs: structuredClone(manifest.manifest.assetRevisionRefs),
    },
    manifest: manifest.manifest, assetReferenceMappings: manifest.assetReferenceMappings, editorDocSnapshot: structuredClone(doc),
  };
  const publishedLook: PublishedLookV1 = {
    schemaVersion: 1, lookId, designVersionId: versionId, creatorProfileId: CREATOR_PROFILE_ID,
    title: definition.titleZh, metadata: { architectureBaseline: 'v0.7.2', evidenceTier: 'simulated', locale: 'zh-CN' },
    tags: [...definition.tags], visibility: 'PUBLIC',
    coverPreview: { assetId: `look.${definition.id}.cover`, revision: 1, kind: 'COVER', sha256: COVER_SHA256[definition.id], mimeType: 'image/png', width: 1672, height: 941, fidelity: 'APPROXIMATE' },
    detailPreviews: [], summaries: { shapeIds: ['almond'], lengthIds: ['medium'], palette: [...definition.palette] },
    publicationGate: { copyrightDeclared: true, sourceDeclared: true, moderationCleared: true },
    status: 'PUBLISHED', publishedAt: definition.publishedAt, createdAt: definition.publishedAt, updatedAt: definition.publishedAt,
  };
  const sourceContent = content(definition);
  const readModel: CanonicalPublishedLookReadModelV1 = {
    schemaVersion: 1, readModelKind: 'CANONICAL', lookId, contentId: lookId,
    title: definition.titleZh, titleEn: definition.title, publisherId: PUBLISHER_ID, publisherType: 'OFFICIAL',
    curationStatus: 'FEATURED_BY_OFFICIAL', cover: structuredClone(sourceContent.cover), media: structuredClone(sourceContent.media),
    mainStyleId: sourceContent.mainStyleId, subStyleIds: [], occasionIds: [...sourceContent.occasionIds], subjectIds: [], moodIds: [...sourceContent.moodIds],
    effectIds: [...sourceContent.effectIds], primaryColorIds: [...sourceContent.primaryColorIds], recommendedShapes: ['almond'], supportedShapes: ['almond'],
    notRecommendedShapes: structuredClone(sourceContent.notRecommendedShapes), supportedLengths: ['medium'], applicationLevel: 'STRUCTURED_EDITABLE',
    verificationLevel: 'RENDER_VERIFIED', assetRef: structuredClone(sourceContent.assetRef), campaignTags: [...sourceContent.campaignTags], publishedAt: definition.publishedAt,
    evidence: {
      immutableDesignVersion: { present: true, designVersionId: versionId, editorDocRef: structuredClone(release.designVersion.editorDocRef) },
      previewEvidence: { present: true, previewRevision: 1, previewSha256: COVER_SHA256[definition.id], fidelity: 'APPROXIMATE' },
      publicationGate: { present: true, copyrightDeclared: true, sourceDeclared: true, moderationCleared: true },
      status: { sourceStatus: 'PUBLISHED', viewable: true, previewVerified: true, manufacturable: false, productionDispatched: false },
    },
    designVersionId: versionId, creatorProfileId: CREATOR_PROFILE_ID, visibility: 'PUBLIC', publicationGateVerified: true,
    sourceLook: structuredClone(publishedLook), sourceContent,
  };
  return { definition, doc, release, publishedLook, readModel };
}

export const FOUR_LOOK_SET_AUTHORITIES_V0_7_2 = FOUR_LOOK_SET_DEFINITIONS_V0_7_2.map(buildAuthority);
export const FOUR_LOOK_SET_READ_MODELS_V0_7_2 = FOUR_LOOK_SET_AUTHORITIES_V0_7_2.map((authority) => authority.readModel);

export function getFourLookSetAuthorityByLookIdV0_7_2(lookId: string) {
  return FOUR_LOOK_SET_AUTHORITIES_V0_7_2.find((authority) => authority.publishedLook.lookId === lookId) ?? null;
}

export function getFourLookSetAuthorityByVersionIdV0_7_2(versionId: string) {
  return FOUR_LOOK_SET_AUTHORITIES_V0_7_2.find((authority) => authority.release.designVersion.designVersionId === versionId) ?? null;
}
