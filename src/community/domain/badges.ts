/**
 * 信任徽章分层（PRD COMM-V2-08）
 */

import type {
  ApplicationLevel,
  CommunityContentV1,
  CommunityPublisherV1,
  VerificationLevel,
} from '../domain/types';

export function publisherBadgeLabel(pub: CommunityPublisherV1 | null | undefined): string {
  if (!pub) return '未知发布者';
  if (pub.verification === 'OFFICIAL' || pub.type === 'OFFICIAL') return '官方';
  if (pub.verification === 'DEMO_VERIFIED_CREATOR' || pub.demo) return '认证创作者 · Demo';
  if (pub.verification === 'VERIFIED_CREATOR') return '认证创作者';
  return pub.displayName;
}

export function applicationBadgeLabel(level: ApplicationLevel): string {
  switch (level) {
    case 'INSPIRATION_ONLY':
      return '灵感参考';
    case 'APPROXIMATE':
      return '近似应用';
    case 'STRUCTURED_EDITABLE':
      return '可编辑';
    case 'REPRODUCIBLE':
      return '可复现';
    default:
      return level;
  }
}

export function verificationBadgeLabel(level: VerificationLevel): string {
  switch (level) {
    case 'CONCEPT':
      return '概念效果';
    case 'RENDER_VERIFIED':
      return '已验证预览';
    case 'SAMPLE_VERIFIED':
      return '已打样';
    case 'PRODUCTION_VERIFIED':
      return '已验证制作';
    default:
      return level;
  }
}

export function cardBadgeSummary(
  content: CommunityContentV1,
  pub: CommunityPublisherV1 | null | undefined,
  styleLabel?: string,
): { publisher: string; style?: string; topic?: string; trust: string } {
  const topic = content.effectIds[0] ?? content.moodIds[0] ?? content.occasionIds[0];
  return {
    publisher: publisherBadgeLabel(pub),
    style: styleLabel,
    topic,
    trust: applicationBadgeLabel(content.applicationLevel),
  };
}
