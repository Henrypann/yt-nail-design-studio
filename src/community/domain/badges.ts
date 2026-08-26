/**
 * 信任徽章分层（PRD COMM-V2-08）
 */

import type {
  ApplicationLevel,
  CommunityContentV1,
  CommunityPublisherV1,
  VerificationLevel,
} from '../domain/types';
import { localizedLabel } from '@/lib/i18n/localize';
import type { LegacyLocale, Locale } from '@/lib/i18n/types';

type LabelLocale = Locale | LegacyLocale;

export function publisherBadgeLabel(pub: CommunityPublisherV1 | null | undefined, locale: LabelLocale = 'zh-CN'): string {
  if (!pub) return localizedLabel('未知发布者', 'Unknown publisher', locale);
  if (pub.verification === 'OFFICIAL' || pub.type === 'OFFICIAL') return localizedLabel('官方', 'Official', locale);
  if (pub.verification === 'DEMO_VERIFIED_CREATOR' || pub.demo) return localizedLabel('认证创作者 · Demo', 'Verified creator · Demo', locale);
  if (pub.verification === 'VERIFIED_CREATOR') return localizedLabel('认证创作者', 'Verified creator', locale);
  return pub.displayName;
}

export function applicationBadgeLabel(level: ApplicationLevel, locale: LabelLocale = 'zh-CN'): string {
  switch (level) {
    case 'INSPIRATION_ONLY':
      return localizedLabel('灵感参考', 'Inspiration only', locale);
    case 'APPROXIMATE':
      return localizedLabel('近似应用', 'Approximate application', locale);
    case 'STRUCTURED_EDITABLE':
      return localizedLabel('可编辑', 'Structured editable', locale);
    case 'REPRODUCIBLE':
      return localizedLabel('可复现', 'Reproducible', locale);
    default:
      return level;
  }
}

export function verificationBadgeLabel(level: VerificationLevel, locale: LabelLocale = 'zh-CN'): string {
  switch (level) {
    case 'CONCEPT':
      return localizedLabel('概念效果', 'Concept', locale);
    case 'RENDER_VERIFIED':
      return localizedLabel('已验证预览', 'Render verified', locale);
    case 'SAMPLE_VERIFIED':
      return localizedLabel('已打样', 'Sample verified', locale);
    case 'PRODUCTION_VERIFIED':
      return localizedLabel('已验证制作', 'Production verified', locale);
    default:
      return level;
  }
}

export function cardBadgeSummary(
  content: CommunityContentV1,
  pub: CommunityPublisherV1 | null | undefined,
  styleLabel?: string,
  locale: LabelLocale = 'zh-CN',
): { publisher: string; style?: string; topic?: string; trust: string } {
  const topic = content.effectIds[0] ?? content.moodIds[0] ?? content.occasionIds[0];
  return {
    publisher: publisherBadgeLabel(pub, locale),
    style: styleLabel,
    topic,
    trust: applicationBadgeLabel(content.applicationLevel, locale),
  };
}
