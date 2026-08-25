/**
 * CommunityCreatorCard · Search（Creators tab）创作者卡片（COMM-V7.1-02）。
 *
 * 链接到 canonical profile（Routes.communityProfile）；通过 PublisherBadge
 * 直观区分官方 / Demo 认证创作者。不展示任何互动/粉丝/作品计数（无真实数据）。
 */

import { Link, useSearchParams } from 'react-router-dom';
import { Routes } from '@/app/routes';
import { useLocale } from '@/lib/i18n';
import { communityInternalHref } from '../lib/entry-link';
import type { CommunityPublisherV1 } from '../domain/types';
import { PublisherBadge } from './PublisherBadge';

export function CommunityCreatorCard({ publisher }: { publisher: CommunityPublisherV1 }) {
  const [searchParams] = useSearchParams();
  const { t } = useLocale();
  const profileHref = communityInternalHref(
    Routes.communityProfile(publisher.handle),
    searchParams,
  );
  const initial = (publisher.displayName || publisher.handle || '?').trim().charAt(0).toUpperCase();

  return (
    <article
      data-testid="community-creator-card"
      data-publisher-id={publisher.publisherId}
      className="overflow-hidden rounded-card border border-gray-200 bg-white transition hover:border-primary/40 hover:shadow-sm"
    >
      <Link
        to={profileHref}
        className="flex h-full flex-col gap-2 p-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        <div className="flex items-center gap-3">
          <span
            aria-hidden
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-soft text-sm font-bold text-primary"
          >
            {initial}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-gray-900">{publisher.displayName}</p>
            <p className="truncate text-xs text-gray-500">@{publisher.handle}</p>
          </div>
          <span className="ml-auto shrink-0">
            <PublisherBadge publisher={publisher} />
          </span>
        </div>
        {publisher.bio && (
          <p className="line-clamp-2 text-xs leading-relaxed text-gray-600">{publisher.bio}</p>
        )}
        <span className="mt-auto pt-1 text-nano font-medium text-primary">
          {t('app.viewProfile')} →
        </span>
      </Link>
    </article>
  );
}
