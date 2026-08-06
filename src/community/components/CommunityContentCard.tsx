import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Routes } from '@/app/routes';
import { useLocale } from '@/lib/i18n';
import { communityInternalHref } from '../lib/entry-link';
import type { CommunityContentV1, CommunityPublisherV1, CommunityTaxonomyV1 } from '../domain/types';
import { PublisherBadge } from './PublisherBadge';
import { ApplicationBadge, VerificationBadge } from './CapabilityBadge';

interface Props {
  content: CommunityContentV1;
  publisher?: CommunityPublisherV1 | null;
  taxonomy: CommunityTaxonomyV1;
}

function pickLabel(item: { label: string; labelEn?: string } | undefined, locale: 'zh' | 'en') {
  if (!item) return undefined;
  return locale === 'en' ? item.labelEn ?? item.label : item.label;
}

export function CommunityContentCard({ content, publisher, taxonomy }: Props) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { locale } = useLocale();
  const [coverFailed, setCoverFailed] = useState(false);
  const style = taxonomy.mainStyles.find((s) => s.id === content.mainStyleId);
  const topicId = content.effectIds[0] ?? content.moodIds[0];
  const topic =
    pickLabel(
      taxonomy.effects.find((e) => e.id === topicId),
      locale,
    ) ??
    pickLabel(
      taxonomy.moods.find((m) => m.id === topicId),
      locale,
    );

  return (
    <button
      type="button"
      data-content-id={content.contentId}
      data-testid="community-content-card"
      onClick={() =>
        navigate(communityInternalHref(Routes.communityContent(content.contentId), searchParams))
      }
      className="flex flex-col overflow-hidden rounded-card border border-gray-200 bg-white text-left transition hover:border-primary/40 hover:shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
    >
      <div className="aspect-[16/10] bg-gray-100">
        {coverFailed ? (
          <div
            className="flex h-full w-full items-center justify-center text-[11px] text-gray-400"
            data-testid="community-card-cover-fallback"
          >
            封面暂不可用
          </div>
        ) : (
          <img
            src={content.cover.url}
            alt=""
            className="h-full w-full object-cover"
            loading="lazy"
            onError={() => setCoverFailed(true)}
          />
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1.5 p-3">
        <div className="flex flex-wrap gap-1">
          <PublisherBadge publisher={publisher} />
          {style && (
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] text-gray-600">
              {pickLabel(style, locale)}
            </span>
          )}
          {topic && (
            <span className="rounded-full bg-gray-50 px-2 py-0.5 text-[10px] text-gray-500">{topic}</span>
          )}
        </div>
        <p className="line-clamp-2 text-sm font-medium text-gray-900">{content.title}</p>
        <div className="mt-auto flex flex-wrap gap-1 pt-1">
          <ApplicationBadge level={content.applicationLevel} />
          <VerificationBadge level={content.verificationLevel} />
        </div>
      </div>
    </button>
  );
}
