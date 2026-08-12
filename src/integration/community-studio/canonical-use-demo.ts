/**
 * COMM-V7.1-04 architecture-golden demo authority.
 *
 * This is deliberately available only through the integration repository in
 * development/integration builds. It is a canonical PublishedLook backed by
 * an immutable DesignVersion and a private released EditorDocV7 snapshot. It
 * is not a sample, manufacturing proof, real creator publication or backend.
 */

import type { CommunityContentV1 } from '@/community/domain/types';
import type { PublishedLookV1 } from '@/community/domain/v7_1/design-content-model';
import type { CanonicalPublishedLookReadModelV1 } from '@/community/domain/v7_1/published-look-read-model';
import type { EditorDocV7, ProcessStepV7 } from '@/studio/editor/v7/model';
import { createBlankEditorDocV7 } from '@/studio/editor/v7/create';
import { PROCESS_STEP_TYPE_IDS_V7 } from '@/studio/editor/v7/registry';
import { parseEditorDocV7 } from '@/studio/editor/v7/schema';
import { buildDesignReleaseManifestV1, type DesignReleaseRecordV1 } from '@/studio/versioning/design-release';

export const CANONICAL_USE_DEMO_LOOK_ID = 'look.v7-1.petal-veil';
export const CANONICAL_USE_DEMO_VERSION_ID = 'dv.v7-1.petal-veil.1';
export const CANONICAL_USE_DEMO_DESIGN_ID = 'design.v7-1.petal-veil.source';
export const CANONICAL_USE_DEMO_EDITOR_SHA256 = '0bdbb6ab83b01f221bcea547db403116a4ea652a89a03ad6beee3ed52593f357';
const PREVIEW_SHA256 = 'bb43c1d444f4661410992a66cfc199f29eda66d7423d0d93672b1f59df58b342';
const CREATED_AT = '2026-08-11T06:00:00.000Z';

function buildSourceDoc(): EditorDocV7 {
  const created = createBlankEditorDocV7({
    designId: CANONICAL_USE_DEMO_DESIGN_ID,
    shape: 'almond',
    length: 'medium',
    title: 'Petal Veil · Canonical Demo',
    baseColor: '#F4DCE5',
    finish: 'gloss',
    now: CREATED_AT,
  });
  if (!created.ok) throw new Error(created.message);
  const candidate = structuredClone(created.doc);
  for (const nail of Object.values(candidate.nails)) {
    const flat: ProcessStepV7 = {
      id: `step.canonical.${nail.finger}.petal-veil`,
      typeId: PROCESS_STEP_TYPE_IDS_V7.flat_design,
      kind: 'flat_design',
      name: 'Petal Veil 图案层',
      visible: true,
      locked: false,
      skipped: false,
      materialRefs: [],
      elements: [{
        id: `element.canonical.${nail.finger}.petal-veil`,
        kind: 'vector_shape',
        visible: true,
        locked: false,
        opacity: 0.9,
        transform: { position: { u: 0.5, v: 0.5 }, scaleX: 1, scaleY: 1, rotationDeg: 0 },
        pathData: 'M0.5 0.18 C0.72 0.32 0.72 0.56 0.5 0.7 C0.28 0.56 0.28 0.32 0.5 0.18 Z',
        fill: { colorSpace: 'srgb', r: 255, g: 255, b: 255, a: 1 },
        stroke: { colorSpace: 'srgb', r: 229, g: 166, b: 191, a: 1 },
        strokeWidthMm: 0.18,
      }],
    };
    nail.steps.splice(nail.steps.length - 1, 0, flat);
  }
  candidate.sourceRefs = [{ domain: 'manual', sourceId: CANONICAL_USE_DEMO_DESIGN_ID }];
  const parsed = parseEditorDocV7(candidate);
  if (!parsed.ok) throw new Error(parsed.reason);
  return parsed.doc;
}

export const CANONICAL_USE_DEMO_EDITOR_DOC_V7 = buildSourceDoc();
const manifest = buildDesignReleaseManifestV1(CANONICAL_USE_DEMO_EDITOR_DOC_V7);
if (!manifest.ok) throw new Error(manifest.message);

export const CANONICAL_USE_DEMO_RELEASE_RECORD_V1: DesignReleaseRecordV1 = {
  schemaVersion: 1,
  designVersion: {
    schemaVersion: 1,
    designVersionId: CANONICAL_USE_DEMO_VERSION_ID,
    designId: CANONICAL_USE_DEMO_DESIGN_ID,
    version: 1,
    revision: CANONICAL_USE_DEMO_EDITOR_DOC_V7.revision,
    editorDocRef: {
      designId: CANONICAL_USE_DEMO_DESIGN_ID,
      schemaVersion: 7,
      revision: CANONICAL_USE_DEMO_EDITOR_DOC_V7.revision,
      sha256: CANONICAL_USE_DEMO_EDITOR_SHA256,
    },
    releasedByIdentityId: 'identity.nailstyle.official',
    releasedAt: CREATED_AT,
    assetRevisionRefs: structuredClone(manifest.manifest.assetRevisionRefs),
  },
  manifest: manifest.manifest,
  editorDocSnapshot: structuredClone(CANONICAL_USE_DEMO_EDITOR_DOC_V7),
};

export const CANONICAL_USE_DEMO_PUBLISHED_LOOK_V1: PublishedLookV1 = {
  schemaVersion: 1,
  lookId: CANONICAL_USE_DEMO_LOOK_ID,
  designVersionId: CANONICAL_USE_DEMO_VERSION_ID,
  creatorProfileId: 'profile.nailstyle.official',
  title: 'Petal Veil · 可编辑版本示范',
  metadata: { evidenceTier: 'architecture-golden', locale: 'zh-CN' },
  tags: ['法式', '花瓣', '可编辑'],
  visibility: 'PUBLIC',
  coverPreview: {
    assetId: 'preview.community.petal-veil.cover', revision: 1, kind: 'COVER',
    sha256: PREVIEW_SHA256, mimeType: 'image/png', width: 960, height: 720,
    fidelity: 'APPROXIMATE',
  },
  detailPreviews: [],
  summaries: { shapeIds: ['almond'], lengthIds: ['medium'], palette: ['#F4DCE5', '#FFFFFF'] },
  publicationGate: { copyrightDeclared: true, sourceDeclared: true, moderationCleared: true },
  status: 'PUBLISHED',
  publishedAt: '2026-08-11T06:10:00.000Z',
  createdAt: CREATED_AT,
  updatedAt: '2026-08-11T06:10:00.000Z',
};

const sourceContent: CommunityContentV1 = {
  schemaVersion: 1,
  contentId: CANONICAL_USE_DEMO_LOOK_ID,
  contentType: 'LOOK_SET',
  title: CANONICAL_USE_DEMO_PUBLISHED_LOOK_V1.title,
  titleEn: 'Petal Veil · Editable Version Demo',
  publisherId: 'pub_nailstyle_official',
  publisherType: 'OFFICIAL',
  curationStatus: 'FEATURED_BY_OFFICIAL',
  cover: { url: '/material-library/templates/t_petal_veil_french/thumbnails/default.png', kind: 'CANONICAL_RENDER' },
  media: [],
  mainStyleId: 'st02',
  subStyleIds: [],
  occasionIds: ['occas_daily'], subjectIds: ['subject_flower'], moodIds: ['mood_romantic'],
  effectIds: [], primaryColorIds: ['color_pink'],
  recommendedShapes: ['almond'], supportedShapes: ['almond'], notRecommendedShapes: {},
  supportedLengths: ['medium'], applicationLevel: 'STRUCTURED_EDITABLE',
  verificationLevel: 'RENDER_VERIFIED', campaignTags: ['canonical-v7-1'],
  status: 'PUBLISHED', publishedAt: '2026-08-11T06:10:00.000Z', demo: true,
};

export const CANONICAL_USE_DEMO_READ_MODEL_V1: CanonicalPublishedLookReadModelV1 = {
  schemaVersion: 1,
  readModelKind: 'CANONICAL',
  lookId: CANONICAL_USE_DEMO_LOOK_ID,
  contentId: CANONICAL_USE_DEMO_LOOK_ID,
  title: CANONICAL_USE_DEMO_PUBLISHED_LOOK_V1.title,
  titleEn: 'Petal Veil · Editable Version Demo',
  publisherId: sourceContent.publisherId,
  publisherType: sourceContent.publisherType,
  curationStatus: sourceContent.curationStatus,
  cover: structuredClone(sourceContent.cover),
  media: [], mainStyleId: sourceContent.mainStyleId, subStyleIds: [],
  occasionIds: [...sourceContent.occasionIds], subjectIds: [...sourceContent.subjectIds],
  moodIds: [...sourceContent.moodIds], effectIds: [], primaryColorIds: [...sourceContent.primaryColorIds],
  recommendedShapes: ['almond'], supportedShapes: ['almond'], notRecommendedShapes: {},
  supportedLengths: ['medium'], applicationLevel: 'STRUCTURED_EDITABLE',
  verificationLevel: 'RENDER_VERIFIED', campaignTags: ['canonical-v7-1'],
  publishedAt: CANONICAL_USE_DEMO_PUBLISHED_LOOK_V1.publishedAt!, demo: true,
  evidence: {
    immutableDesignVersion: { present: true, designVersionId: CANONICAL_USE_DEMO_VERSION_ID, editorDocRef: structuredClone(CANONICAL_USE_DEMO_RELEASE_RECORD_V1.designVersion.editorDocRef) },
    previewEvidence: { present: true, previewRevision: 1, previewSha256: PREVIEW_SHA256, fidelity: 'APPROXIMATE' },
    publicationGate: { present: true, copyrightDeclared: true, sourceDeclared: true, moderationCleared: true },
    status: { sourceStatus: 'PUBLISHED', viewable: true, previewVerified: true, manufacturable: false, productionDispatched: false },
  },
  designVersionId: CANONICAL_USE_DEMO_VERSION_ID,
  creatorProfileId: CANONICAL_USE_DEMO_PUBLISHED_LOOK_V1.creatorProfileId,
  visibility: 'PUBLIC', publicationGateVerified: true,
  sourceLook: structuredClone(CANONICAL_USE_DEMO_PUBLISHED_LOOK_V1),
  sourceContent,
};
