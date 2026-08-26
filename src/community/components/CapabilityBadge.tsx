import { Badge } from '@/design-system';
import { useLocale } from '@/lib/i18n';
import type { ApplicationLevel, VerificationLevel } from '../domain/types';
import { applicationBadgeLabel, verificationBadgeLabel } from '../domain/badges';

export function ApplicationBadge({ level }: { level: ApplicationLevel }) {
  const { locale } = useLocale();
  return <Badge variant="gray">{applicationBadgeLabel(level, locale)}</Badge>;
}

export function VerificationBadge({ level }: { level: VerificationLevel }) {
  const { locale } = useLocale();
  const variant = level === 'RENDER_VERIFIED' ? 'success' : level === 'CONCEPT' ? 'gray' : 'warning';
  return <Badge variant={variant}>{verificationBadgeLabel(level, locale)}</Badge>;
}
