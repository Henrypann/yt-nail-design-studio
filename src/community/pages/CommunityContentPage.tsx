/**
 * `/community/content/:contentId` · 可分享详情 + StudioImportIntent 发布（PR-02）。
 * 禁止 import Wizard / Editor Store。
 */

import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import { Badge, Button, Modal, useToast } from '@/design-system';
import { Routes } from '@/app/routes';
import { useLocale } from '@/lib/i18n';
import { communityTaxonomyLabel, taxonomyLabel } from '@/studio/shared/nail-taxonomy-labels';
import { getContentById, getPublisherById, loadTaxonomy } from '../data/content-repository';
import type {
  CommunityContentV1,
  CommunityPublisherV1,
  CommunityTaxonomyV1,
} from '../domain/types';
import {
  canTryInStudio,
  createStudioImportIntent,
} from '../domain/studio-import-intent';
import { PublisherBadge } from '../components/PublisherBadge';
import { ApplicationBadge, VerificationBadge } from '../components/CapabilityBadge';
import { communityInternalHref, studioReturnPath } from '../lib/entry-link';

export default function CommunityContentPage() {
  const { contentId } = useParams<{ contentId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const toast = useToast();
  const { locale, text } = useLocale();
  const [content, setContent] = useState<CommunityContentV1 | null | undefined>(undefined);
  const [publisher, setPublisher] = useState<CommunityPublisherV1 | null>(null);
  const [taxonomy, setTaxonomy] = useState<CommunityTaxonomyV1 | null>(null);
  const [coverFailed, setCoverFailed] = useState(false);
  const [approxOpen, setApproxOpen] = useState(false);

  useEffect(() => {
    if (!contentId) return;
    let cancelled = false;
    setCoverFailed(false);
    void (async () => {
      try {
        const [c, tax] = await Promise.all([getContentById(contentId), loadTaxonomy()]);
        if (cancelled) return;
        setContent(c);
        setTaxonomy(tax);
        if (c) {
          const pub = await getPublisherById(c.publisherId);
          if (!cancelled) setPublisher(pub);
        }
      } catch {
        if (!cancelled) setContent(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [contentId]);

  if (!contentId) return <Navigate to={Routes.communityOfficial} replace />;
  if (content === undefined) {
    return (
      <div className="rounded-card border border-gray-200 bg-white p-6 text-sm text-gray-500">
        加载中…
      </div>
    );
  }
  if (content === null) {
    return (
      <div className="rounded-card border border-gray-200 bg-white p-6" data-testid="community-content-missing">
        <h1 className="text-lg font-semibold text-gray-900">内容不存在或已下架</h1>
        <p className="mt-1 text-xs text-gray-500">可能是草稿、已下架或无效深链。</p>
        <Button className="mt-4" variant="secondary" onClick={() => navigate(Routes.community)}>
          返回 Discover
        </Button>
      </div>
    );
  }

  const style = taxonomy?.mainStyles.find((s) => s.id === content.mainStyleId);
  const tryable = canTryInStudio(content);

  const publishIntent = () => {
    const result = createStudioImportIntent({
      content,
      returnTo: Routes.communityContent(content.contentId),
      suggestedContext: {
        shape: content.recommendedShapes[0],
        length: content.supportedLengths[0],
      },
    });
    if (!result.ok) {
      if (result.reason === 'inspiration_only') {
        toast.info('该内容仅供灵感参考，不可直接试用到 Studio。');
      } else if (result.reason === 'missing_asset') {
        toast.error('无法创建试用意图：缺少可应用资产。');
      } else {
        toast.error('无法创建试用意图：内容未发布。');
      }
      return;
    }
    navigate(result.href);
  };

  const onTryClick = () => {
    if (!tryable) return;
    if (content.applicationLevel === 'APPROXIMATE') {
      setApproxOpen(true);
      return;
    }
    publishIntent();
  };

  return (
    <div className="mx-auto max-w-3xl space-y-4" data-testid="community-content-page">
      <div className="flex items-center gap-2">
        <Button size="sm" variant="ghost" onClick={() => navigate(-1)}>
          <ArrowLeft size={14} />
          返回
        </Button>
        <Link
          to={communityInternalHref(Routes.community, searchParams)}
          className="text-xs text-gray-500 hover:text-gray-800"
        >
          Discover
        </Link>
      </div>

      <article className="overflow-hidden rounded-card border border-gray-200 bg-white">
        <div className="aspect-[16/9] bg-gray-100">
          {coverFailed ? (
            <div
              className="flex h-full w-full items-center justify-center text-xs text-gray-400"
              data-testid="community-cover-fallback"
            >
              封面暂不可用
            </div>
          ) : (
            <img
              src={content.cover.url}
              alt=""
              className="h-full w-full object-cover"
              onError={() => setCoverFailed(true)}
            />
          )}
        </div>
        <div className="space-y-4 p-5">
          <div className="flex flex-wrap items-center gap-2">
            <PublisherBadge publisher={publisher} />
            {style && (
              <Badge variant="gray">
                {communityTaxonomyLabel('community-style', style, locale)}
              </Badge>
            )}
            <ApplicationBadge level={content.applicationLevel} />
            <VerificationBadge level={content.verificationLevel} />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-gray-900">{content.title}</h1>
            {content.titleEn && <p className="mt-1 text-sm text-gray-500">{content.titleEn}</p>}
          </div>

          {(content.recommendedShapes.length > 0 || content.supportedLengths.length > 0) && (
            <div className="rounded-panel border border-gray-200 px-3 py-2 text-xs text-gray-700">
              <p className="font-medium text-gray-800">推荐甲型与长度</p>
              {content.recommendedShapes.length > 0 && (
                <p className="mt-1">
                  {text('甲型：', 'Shape: ')}
                  {content.recommendedShapes.map((id) => taxonomyLabel('shape', id, locale)).join(' · ')}
                </p>
              )}
              {content.supportedLengths.length > 0 && (
                <p className="mt-0.5">
                  {text('长度：', 'Length: ')}
                  {content.supportedLengths.map((id) => taxonomyLabel('geometry-length', id, locale)).join(' · ')}
                </p>
              )}
            </div>
          )}

          <p className="text-[11px] leading-relaxed text-gray-500">
            预览通过 ≠ 可制造 ≠ 已下发生产。试用仅写入 Studio 导入意图，不会由 Community 直接改写 Wizard /
            Editor。
          </p>

          <div className="flex flex-wrap gap-2">
            {tryable ? (
              <Button onClick={onTryClick} data-testid="community-try-in-studio">
                在 Studio 中试用
              </Button>
            ) : content.applicationLevel === 'INSPIRATION_ONLY' ? (
              <p className="text-xs text-gray-500" data-testid="community-inspiration-only">
                灵感参考 · 不可直接试用到 Studio
              </p>
            ) : (
              <p className="text-xs text-gray-500" data-testid="community-missing-asset">
                缺少可应用资产，暂不可试用
              </p>
            )}
            <Button
              size="sm"
              variant="secondary"
              data-testid="community-open-studio"
              onClick={() => navigate(studioReturnPath(searchParams, Routes.designNew))}
            >
              进入 Studio
            </Button>
            {content.assetRef?.manifestUrl && (
              <a
                href={content.assetRef.manifestUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-9 items-center justify-center rounded-button border border-gray-200 bg-white px-3 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                <ExternalLink size={14} className="mr-1" />
                资产清单
              </a>
            )}
          </div>
        </div>
      </article>

      <Modal
        open={approxOpen}
        onClose={() => setApproxOpen(false)}
        title="近似应用说明"
        footer={
          <>
            <Button variant="ghost" onClick={() => setApproxOpen(false)}>
              取消
            </Button>
            <Button
              data-testid="community-approx-confirm"
              onClick={() => {
                setApproxOpen(false);
                publishIntent();
              }}
            >
              了解，继续试用
            </Button>
          </>
        }
      >
        <p className="text-sm text-gray-600">
          该内容为「近似应用」：进入 Studio 后会尽量贴近官方效果，但可能与高保真预览存在差异，且不代表生产验证通过。
        </p>
      </Modal>
    </div>
  );
}
