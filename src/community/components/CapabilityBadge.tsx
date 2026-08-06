import { Badge } from '@/design-system';
import type { ApplicationLevel, VerificationLevel } from '../domain/types';
import { applicationBadgeLabel, verificationBadgeLabel } from '../domain/badges';

export function ApplicationBadge({ level }: { level: ApplicationLevel }) {
  return <Badge variant="gray">{applicationBadgeLabel(level)}</Badge>;
}

export function VerificationBadge({ level }: { level: VerificationLevel }) {
  const variant = level === 'RENDER_VERIFIED' ? 'success' : level === 'CONCEPT' ? 'gray' : 'warning';
  return <Badge variant={variant}>{verificationBadgeLabel(level)}</Badge>;
}
