/**
 * `/community/look/:lookId` · Canonical 可分享详情（COMM-V7.1-01）。
 *
 * 消费 PublishedLookReadModelV1（当前来自 legacy 静态内容的 LEGACY_PARTIAL
 * 投影）并展示显式证据块：Legacy 兼容状态、已验证 vs 不可用、以及
 * 「预览通过 ≠ 可制造 ≠ 已下发生产」的精确区分。
 * 禁止 import Wizard / Editor Store。
 */

import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import { Badge, Button, Modal, useToast } from '@/design-system';
import { Routes } from '@/app/routes';
import { useLocale } from '@/lib/i18n';
import { communityTaxonomyLabel, taxonomyLabel } from '@/studio/shared/nail-taxonomy-labels';
import { getPublisherById, loadTaxonomy } from '../data/content-repository';
import { getLookReadModelById } from '../data/look-repository';
import type { CommunityPublisherV1, CommunityTaxonomyV1 } from '../domain/types';
import type { PublishedLookReadModelV1 } from '../domain/v7_1/published-look-read-model';
import {
  canTryInStudio,
  createStudioImportIntent,
} from '../domain/studio-import-intent';
import { PublisherBadge } from '../components/PublisherBadge';
import { ApplicationBadge, VerificationBadge } from '../components/CapabilityBadge';
import { communityInternalHref, studioReturnPath } from '../lib/entry-link';

function EvidenceRow({ label, value, tone }: { label: string; value: string; tone: 'ok' | 'missing' }) {
  return (
    <div className="flex items-start justify-between gap-3 text-xs">
      <span className="text-gray-600">{label}</span>
      <span
        className={
          tone === 'ok'
            ? 'shrink-0 font-medium text-emerald-700'
            : 'shrink-0 font-medium text-amber-700'
        }
      >
        {value}
      </span>
    </div>
  );
}

export default function CommunityLookPage() {
  const { lookId } = useParams<{ lookId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const toast = useToast();
  const { locale, text } = useLocale();
  const [look, setLook] = useState<PublishedLookReadModelV1 | null | undefined>(undefined);
  const [publisher, setPublisher] = useState<CommunityPublisherV1 | null>(null);
  const [taxonomy, setTaxonomy] = useState<CommunityTaxonomyV1 | null>(null);
  const [coverFailed, setCoverFailed] = useState(false);
  const [approxOpen, setApproxOpen] = useState(false);

  useEffect(() => {
    if (!lookId) return;
    let cancelled = false;
    setCoverFailed(false);
    void (async () => {
      try {
        const [lookModel, tax] = await Promise.all([getLookReadModelById(lookId), loadTaxonomy()]);
        if (cancelled) return;
        setLook(lookModel);
        setTaxonomy(tax);
        if (lookModel) {
          const pub = await getPublisherById(lookModel.publisherId);
          if (!cancelled) setPublisher(pub);
        }
      } catch {
        if (!cancelled) setLook(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [lookId]);

  if (!lookId) return <Navigate to={Routes.communityOfficial} replace />;
  if (look === undefined) {
    return (
      <div className="rounded-card border border-gray-200 bg-white p-6 text-sm text-gray-500">
        加载中…
      </div>
    );
  }
  if (look === null) {
    return (
      <div className="rounded-card border border-gray-200 bg-white p-6" data-testid="community-look-missing">
        <h1 className="text-lg font-semibold text-gray-900">内容不存在或已下架</h1>
        <p className="mt-1 text-xs text-gray-500">可能是草稿、已下架或无效深链。</p>
        <Button className="mt-4" variant="secondary" onClick={() => navigate(Routes.community)}>
          返回 Discover
        </Button>
      </div>
    );
  }

  const content = look.sourceContent;
  const style = taxonomy?.mainStyles.find((s) => s.id === look.mainStyleId);
  const tryable = canTryInStudio(content);
  const legacy = look.readModelKind === 'LEGACY_PARTIAL';
  const evidence = look.evidence;

  const publishIntent = () => {
    const result = createStudioImportIntent({
      content,
      returnTo: Routes.communityLook(look.lookId),
      suggestedContext: {
        shape: look.recommendedShapes[0],
        length: look.supportedLengths[0],
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
    if (look.applicationLevel === 'APPROXIMATE') {
      setApproxOpen(true);
      return;
    }
    publishIntent();
  };

  return (
    <div className="mx-auto max-w-3xl space-y-4" data-testid="community-look-page">
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
              src={look.cover.url}
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
            <ApplicationBadge level={look.applicationLevel} />
            <VerificationBadge level={look.verificationLevel} />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-gray-900">{look.title}</h1>
            {look.titleEn && <p className="mt-1 text-sm text-gray-500">{look.titleEn}</p>}
          </div>

          {(look.recommendedShapes.length > 0 || look.supportedLengths.length > 0) && (
            <div className="rounded-panel border border-gray-200 px-3 py-2 text-xs text-gray-700">
              <p className="font-medium text-gray-800">推荐甲型与长度</p>
              {look.recommendedShapes.length > 0 && (
                <p className="mt-1">
                  {text('甲型：', 'Shape: ')}
                  {look.recommendedShapes.map((id) => taxonomyLabel('shape', id, locale)).join(' · ')}
                </p>
              )}
              {look.supportedLengths.length > 0 && (
                <p className="mt-0.5">
                  {text('长度：', 'Length: ')}
                  {look.supportedLengths.map((id) => taxonomyLabel('geometry-length', id, locale)).join(' · ')}
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
            ) : look.applicationLevel === 'INSPIRATION_ONLY' ? (
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
            {look.assetRef?.manifestUrl && (
              <a
                href={look.assetRef.manifestUrl}
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

      {/* COMM-V7.1-01 显式证据块：Legacy 兼容状态 / 已验证 vs 不可用 / 三态区分 */}
      <section
        className="rounded-card border border-amber-200 bg-amber-50/60 p-4"
        data-testid="community-look-evidence"
      >
        <h2 className="text-sm font-semibold text-amber-900">
          {text('证据与兼容性', 'Evidence & compatibility')}
        </h2>

        <div className="mt-2 space-y-1.5">
          <EvidenceRow
            label={text('兼容状态', 'Compatibility status')}
            value={
              legacy
                ? text('Legacy 静态内容 · 部分证据（非完整 PublishedLookV1）', 'Legacy static content · partial evidence (not a full PublishedLookV1)')
                : 'Canonical PublishedLookV1 · 完整证据'
            }
            tone={legacy ? 'missing' : 'ok'}
          />
          <EvidenceRow
            label={text('不可变设计版本', 'Immutable design version')}
            value={
              evidence.immutableDesignVersion.present
                ? text('已引用 DesignVersionV1', 'DesignVersionV1 referenced')
                : text('缺失（无 designVersionId / EditorDoc SHA-256）', 'Unavailable (no designVersionId / EditorDoc SHA-256)')
            }
            tone={evidence.immutableDesignVersion.present ? 'ok' : 'missing'}
          />
          <EvidenceRow
            label={text('预览 revision / hash', 'Preview revision / hash')}
            value={
              evidence.previewEvidence.present
                ? text('已引用不可变预览资产', 'Immutable preview asset referenced')
                : text('缺失（无 preview revision / sha256）', 'Unavailable (no preview revision / sha256)')
            }
            tone={evidence.previewEvidence.present ? 'ok' : 'missing'}
          />
          <EvidenceRow
            label={text('公开出版门禁', 'Public publication gate')}
            value={
              evidence.publicationGate.present
                ? text('已通过（copyright/source/moderation）', 'Verified (copyright/source/moderation)')
                : text('未验证（无版权/来源/审核证据）', 'Unverified (no copyright/source/moderation evidence)')
            }
            tone={evidence.publicationGate.present ? 'ok' : 'missing'}
          />
        </div>

        <div
          className="mt-3 rounded-panel border border-amber-200 bg-white/70 px-3 py-2 text-xs text-gray-700"
          data-testid="community-look-evidence-missing"
        >
          <p className="font-medium text-gray-800">
            {text('状态区分（三者相互独立）', 'Status distinction (three independent axes)')}
          </p>
          <div className="mt-1.5 space-y-1">
            <EvidenceRow
              label={text('预览已验证', 'Preview verified')}
              value={evidence.status.previewVerified ? text('是（渲染已校验）', 'Yes (render verified)') : text('否（CONCEPT）', 'No (CONCEPT)')}
              tone={evidence.status.previewVerified ? 'ok' : 'missing'}
            />
            <EvidenceRow
              label={text('可制造性证据', 'Manufacturing evidence')}
              value={evidence.status.manufacturable ? text('已验证', 'Verified') : text('无证据', 'No evidence')}
              tone={evidence.status.manufacturable ? 'ok' : 'missing'}
            />
            <EvidenceRow
              label={text('已下发生产', 'Production dispatched')}
              value={evidence.status.productionDispatched ? text('是', 'Yes') : text('无证据', 'No evidence')}
              tone={evidence.status.productionDispatched ? 'ok' : 'missing'}
            />
          </div>
        </div>

        <p className="mt-2 text-[11px] leading-relaxed text-amber-800" data-testid="community-look-source-caveat">
          {legacy
            ? text(
                '来源：静态 fixture 数据，非实时社区后端；Demo 创作者内容仅开发/集成环境可见。预览通过 ≠ 可制造 ≠ 已下发生产，本记录不含制造/设备证据。',
                'Source: static fixture data, not a live community backend; demo creator content is visible only in development/integration. Preview verified ≠ manufacturable ≠ production dispatched; this record carries no manufacturing/device evidence.',
              )
            : text('来源：canonical PublishedLookV1 合同。', 'Source: canonical PublishedLookV1 contract.')}
        </p>
      </section>

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
