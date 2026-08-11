import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Routes } from '@/app/routes';
import { useLocale } from '@/lib/i18n';
import { communityTaxonomyLabel } from '@/studio/shared/nail-taxonomy-labels';
import { communityInternalHref } from '../lib/entry-link';
import type { CommunityContentV1, CommunityPublisherV1, CommunityTaxonomyV1 } from '../domain/types';
import { PublisherBadge } from './PublisherBadge';
import { ApplicationBadge, VerificationBadge } from './CapabilityBadge';

interface Props {
  content: CommunityContentV1;
  publisher?: CommunityPublisherV1 | null;
  taxonomy: CommunityTaxonomyV1;
}

export function CommunityContentCard({ content, publisher, taxonomy }: Props) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { locale } = useLocale();
  const [coverFailed, setCoverFailed] = useState(false);
  const style = taxonomy.mainStyles.find((s) => s.id === content.mainStyleId);
  const topicId = content.effectIds[0] ?? content.moodIds[0];
  const effect = taxonomy.effects.find((e) => e.id === topicId);
  const mood = taxonomy.moods.find((m) => m.id === topicId);
  const topic = effect
    ? communityTaxonomyLabel('community-effect', effect, locale)
    : mood
      ? communityTaxonomyLabel('community-mood', mood, locale)
      : undefined;

  return (
    <button
      type="button"
      data-content-id={content.contentId}
      data-testid="community-content-card"
      onClick={() =>
        navigate(communityInternalHref(Routes.communityLook(content.contentId), searchParams))
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
              {communityTaxonomyLabel('community-style', style, locale)}
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
