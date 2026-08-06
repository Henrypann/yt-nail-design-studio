import { Badge, cx } from '@/design-system';
import { useLocale } from '@/lib/i18n';
import type { CommunityPublisherV1 } from '../domain/types';
import { publisherBadgeLabel } from '../domain/badges';

export function PublisherBadge({
  publisher,
  className,
}: {
  publisher: CommunityPublisherV1 | null | undefined;
  className?: string;
}) {
  const { text } = useLocale();
  const official = publisher?.type === 'OFFICIAL';
  const label = official
    ? text('官方', 'Official')
    : publisherBadgeLabel(publisher);
  return (
    <Badge variant={official ? 'blue' : 'warning'} className={cx(className)}>
      {label}
    </Badge>
  );
}
