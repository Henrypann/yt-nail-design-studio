/**
 * Community 领域类型（PRD §8）
 */

export type PublisherType = 'OFFICIAL' | 'VERIFIED_CREATOR';
export type PublisherVerification =
  | 'OFFICIAL'
  | 'NONE'
  | 'DEMO_VERIFIED_CREATOR'
  | 'VERIFIED_CREATOR';

export type ApplicationLevel =
  | 'INSPIRATION_ONLY'
  | 'APPROXIMATE'
  | 'STRUCTURED_EDITABLE'
  | 'REPRODUCIBLE';

export type VerificationLevel =
  | 'CONCEPT'
  | 'RENDER_VERIFIED'
  | 'SAMPLE_VERIFIED'
  | 'PRODUCTION_VERIFIED';

export type MediaKind = 'EDITORIAL' | 'CANONICAL_RENDER' | 'SAMPLE_PHOTO';

export interface CommunityPublisherV1 {
  publisherId: string;
  type: 'OFFICIAL' | 'CREATOR';
  handle: string;
  displayName: string;
  avatarUrl?: string;
  bio?: string;
  verification: PublisherVerification;
  /** Demo fixture only; stripped in production loads */
  demo?: boolean;
}

export interface CommunityContentAssetRef {
  templateId: string;
  renderTemplateId?: string;
  recipeId?: string;
  assetVersion: string;
  manifestUrl: string;
}

export interface CommunityContentV1 {
  schemaVersion: 1;
  contentId: string;
  contentType: 'LOOK_SET';
  title: string;
  titleEn?: string;
  publisherId: string;
  publisherType: PublisherType;
  curationStatus: 'NONE' | 'FEATURED_BY_OFFICIAL';
  cover: { url: string; kind: MediaKind };
  media: Array<{ id: string; url: string; kind: MediaKind }>;
  mainStyleId: string;
  subStyleIds: string[];
  season?: string;
  holiday?: string;
  occasionIds: string[];
  subjectIds: string[];
  moodIds: string[];
  effectIds: string[];
  primaryColorIds: string[];
  recommendedShapes: string[];
  supportedShapes: string[];
  notRecommendedShapes: Record<string, string>;
  supportedLengths: string[];
  applicationLevel: ApplicationLevel;
  verificationLevel: VerificationLevel;
  assetRef?: CommunityContentAssetRef;
  campaignTags: string[];
  status: 'DRAFT' | 'PUBLISHED' | 'DEPRECATED';
  publishedAt: string;
  /** Demo PUGC only */
  demo?: boolean;
}

export interface CommunityTaxonomyV1 {
  schemaVersion: 1;
  mainStyles: Array<{ id: string; label: string; labelEn: string }>;
  occasions: Array<{ id: string; label: string; labelEn: string }>;
  moods: Array<{ id: string; label: string; labelEn: string }>;
  effects: Array<{ id: string; label: string; labelEn: string }>;
  colors: Array<{ id: string; label: string; labelEn: string }>;
  seasons: Array<{ id: string; label: string; labelEn: string }>;
  subjects: Array<{ id: string; label: string; labelEn: string }>;
}

export interface CommunityContentIndexV1 {
  schemaVersion: 1;
  officialPgcTarget: number;
  officialMetadataReadyCount: number;
  officialGapCount: number;
  contents: CommunityContentV1[];
}

export interface CommunityProfile {
  profileId: string;
  identityId: string;
  handle: string;
  displayName: string;
  avatarUrl?: string;
  bio?: string;
  profileType: 'MEMBER' | 'CREATOR';
  creatorVerification: 'NONE' | 'DEMO_VERIFIED' | 'VERIFIED';
}
