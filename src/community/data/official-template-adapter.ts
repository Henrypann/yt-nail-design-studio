/**
 * 官方 TemplateEntry → CommunityContentV1 适配（校验/回退用）。
 * 正式 Feed 真源为 public/community/content-index.json。
 */

import type { TemplateEntry } from '@/studio/preview/material-library';
import type { CommunityContentV1, VerificationLevel } from '../domain/types';

function verificationFromTemplate(t: TemplateEntry): VerificationLevel {
  if (t.asset_status === 'SIMULATED') return 'RENDER_VERIFIED';
  return 'CONCEPT';
}

/** 将官方灵感模板投影为最小 CommunityContent（缺标签时仅作 adapter 回退）。 */
export function officialTemplateToContent(
  template: TemplateEntry,
  opts: { contentId: string; mainStyleId: string; coverUrl: string },
): CommunityContentV1 {
  return {
    schemaVersion: 1,
    contentId: opts.contentId,
    contentType: 'LOOK_SET',
    title: template.name,
    titleEn: template.name_en,
    publisherId: 'pub_nailstyle_official',
    publisherType: 'OFFICIAL',
    curationStatus: 'FEATURED_BY_OFFICIAL',
    cover: { url: opts.coverUrl, kind: 'EDITORIAL' },
    media: [{ id: `${opts.contentId}_cover`, url: opts.coverUrl, kind: 'EDITORIAL' }],
    mainStyleId: opts.mainStyleId,
    subStyleIds: [],
    occasionIds: [],
    subjectIds: [],
    moodIds: [],
    effectIds: [],
    primaryColorIds: [],
    recommendedShapes: template.shape_compatibility?.highly_compatible?.slice(0, 2) ?? ['almond'],
    supportedShapes: [
      ...(template.shape_compatibility?.highly_compatible ?? []),
      ...(template.shape_compatibility?.neutral ?? []),
    ],
    notRecommendedShapes: {},
    supportedLengths: ['medium'],
    applicationLevel: 'APPROXIMATE',
    verificationLevel: verificationFromTemplate(template),
    assetRef: {
      templateId: template.id,
      renderTemplateId: template.id,
      assetVersion: '1.0.0',
      manifestUrl: '',
    },
    campaignTags: template.style_tags?.includes('trending') ? ['recommended'] : [],
    status: 'PUBLISHED',
    publishedAt: new Date().toISOString(),
  };
}
