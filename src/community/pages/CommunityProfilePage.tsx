/**
 * `/community/profile/:handle` · 发布者资料（fixture）。
 * 禁止 import Wizard / Editor Store。
 */

import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { Routes } from '@/app/routes';
import { loadPublishers, loadPublishedContents } from '../data/content-repository';
import type { CommunityContentV1, CommunityPublisherV1 } from '../domain/types';
import { PublisherBadge } from '../components/PublisherBadge';
import { communityInternalHref } from '../lib/entry-link';

export default function CommunityProfilePage() {
  const { handle } = useParams<{ handle: string }>();
  const [searchParams] = useSearchParams();
  const [publisher, setPublisher] = useState<CommunityPublisherV1 | null | undefined>(undefined);
  const [works, setWorks] = useState<CommunityContentV1[]>([]);

  useEffect(() => {
    if (!handle) return;
    let cancelled = false;
    void (async () => {
      try {
        const [pubs, contents] = await Promise.all([loadPublishers(), loadPublishedContents()]);
        if (cancelled) return;
        const pub = pubs.find((p) => p.handle === handle) ?? null;
        setPublisher(pub);
        setWorks(pub ? contents.filter((c) => c.publisherId === pub.publisherId) : []);
      } catch {
        if (!cancelled) setPublisher(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [handle]);

  if (publisher === undefined) {
    return (
      <div className="rounded-card border border-gray-200 bg-white p-6 text-sm text-gray-500">
        加载中…
      </div>
    );
  }

  if (publisher === null) {
    return (
      <div className="rounded-card border border-gray-200 bg-white p-6" data-testid="community-profile-missing">
        <h1 className="text-lg font-semibold text-gray-900">未找到发布者</h1>
        <Link
          to={communityInternalHref(Routes.communityCreators, searchParams)}
          className="mt-3 inline-block text-sm text-primary"
        >
          返回 Creators
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4" data-testid="community-profile-page">
      <div className="rounded-card border border-gray-200 bg-white p-5">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-lg font-semibold text-gray-900">@{publisher.handle}</h1>
          <PublisherBadge publisher={publisher} />
        </div>
        <p className="mt-1 text-sm text-gray-800">{publisher.displayName}</p>
        {publisher.bio && <p className="mt-2 text-xs text-gray-500">{publisher.bio}</p>}
      </div>
      <section>
        <h2 className="mb-2 text-sm font-medium text-gray-700">已发布内容（{works.length}）</h2>
        {works.length === 0 ? (
          <p className="text-xs text-gray-500">暂无已发布内容。</p>
        ) : (
          <ul className="space-y-2">
            {works.map((c) => (
              <li key={c.contentId}>
                <Link
                  to={communityInternalHref(Routes.communityContent(c.contentId), searchParams)}
                  className="block rounded-card border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 hover:border-primary/40"
                >
                  {c.title}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
