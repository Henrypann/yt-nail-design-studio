/**
 * `/look/:lookId` · Canonical 可分享详情（COMM-V7.1-01 + COMM-v0.7.2-TAX-04）。
 *
 * 消费 PublishedLookReadModelV1（当前来自 legacy 静态内容的 LEGACY_PARTIAL
 * 投影）并展示显式证据块：Legacy 兼容状态、已验证 vs 不可用、以及
 * 「预览通过 ≠ 可制造 ≠ 已下发生产」的精确区分。
 *
 * COMM-v0.7.2-TAX-04：
 * - 结构化发现区由共享 DiscoveryDetailSection 渲染，数据只来自
 *   `look.discovery` + strict taxonomy-v2；不再加载 legacy 词表，不再基于
 *   legacy 字段推断风格/甲型/长度标签。discovery 或 taxonomy-v2 不可用时
 *   可见失败（community-discovery-unavailable），绝不推断。
 * - 内容相关的「使用此版本定制 / 试用 / 近似应用」动作 fail closed：
 *   `actionPermissions(look.discovery)`。PERSONAL_USE_ONLY 不渲染这些
 *   动作与近似应用 modal 触发，改为可见的 `personal-use-only-action-restricted`
 *   提示；discovery 为 null 时同样不提供应用/二次创作动作。通用「进入 Studio」
 *   导航保持不变（它不应用/不 remix 本 Look）。
 * - Application / Verification 证据徽章保留为独立 legacy 证据，不是发现标签。
 * - 禁止 import Wizard / Editor Store。
 */

import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import { Badge, Button, Modal, useToast } from '@/design-system';
import { Routes } from '@/app/routes';
import { canUseLocalStudioHandoff, studioProductHref } from '@/app/product-navigation';
import { CrossProductAction, CrossProductLink } from '@/app/CrossProductLink';
import { useLocale } from '@/lib/i18n';
import { getPublisherById } from '../data/content-repository';
import { getLookReadModelById } from '../data/look-repository';
import { loadCommunityTaxonomyV2 } from '../data/taxonomy-repository';
import type { CommunityPublisherV1 } from '../domain/types';
import type { PublishedLookReadModelV1 } from '../domain/v7_1/published-look-read-model';
import type { CommunityTaxonomyV2 } from '../domain/taxonomy-v2/types';
import { actionPermissions } from '../domain/taxonomy-v2/governance';
import {
  canTryInStudio,
  createStudioImportIntent,
} from '../domain/studio-import-intent';
import { PublisherBadge } from '../components/PublisherBadge';
import { ApplicationBadge, VerificationBadge } from '../components/CapabilityBadge';
import { DiscoveryDetailSection } from '../components/CommunityDiscoveryMetadata';
import { communityInternalHref, studioReturnPath } from '../lib/entry-link';
import { createVersionedUseIntentForLookV1 } from '@/integration/community-studio/versioned-use-runtime';
import { resolveStudioUseAvailabilityV1 } from '../domain/studio-use-availability';

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
  const [taxonomyV2, setTaxonomyV2] = useState<CommunityTaxonomyV2 | null>(null);
  /** TAX-04: taxonomy-v2 加载/解析失败的可见诊断（fail closed，不推断）。 */
  const [taxonomyV2Error, setTaxonomyV2Error] = useState<string | null>(null);
  /** TAX-04: fetch/runtime 加载失败的独立可见状态，绝不伪装成「内容缺失」。 */
  const [loadFailed, setLoadFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  const [coverFailed, setCoverFailed] = useState(false);
  const [approxOpen, setApproxOpen] = useState(false);

  useEffect(() => {
    if (!lookId) return;
    let cancelled = false;
    setLoadFailed(false);
    setCoverFailed(false);
    setTaxonomyV2Error(null);
    void (async () => {
      try {
        const [lookModel, taxV2] = await Promise.all([
          getLookReadModelById(lookId),
          loadCommunityTaxonomyV2(),
        ]);
        if (cancelled) return;
        setLook(lookModel);
        if (taxV2.ok) {
          setTaxonomyV2(taxV2.taxonomy);
        } else {
          setTaxonomyV2Error(
            taxV2.issues.map((issue) => issue.code).join(','),
          );
        }
        if (lookModel) {
          const pub = await getPublisherById(lookModel.publisherId);
          if (!cancelled) setPublisher(pub);
        }
      } catch {
        // TAX-04: 网络/运行时错误 ≠ 内容不存在或已下架；独立错误状态 + 重试。
        if (!cancelled) setLoadFailed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [lookId, retry]);

  if (!lookId) return <Navigate to={Routes.communityOfficial} replace />;
  if (loadFailed) {
    return (
      <div
        className="rounded-card border border-gray-200 bg-white p-6"
        data-testid="community-look-load-failed"
      >
        <h1 className="text-lg font-semibold text-gray-900">内容加载失败</h1>
        <p className="mt-1 text-xs text-gray-500">
          网络或运行时错误导致无法加载该内容；这不代表内容不存在或已下架。
        </p>
        <div className="mt-4 flex gap-2">
          <Button
            variant="secondary"
            onClick={() => {
              setLoadFailed(false);
              setLook(undefined);
              setRetry((k) => k + 1);
            }}
          >
            重试
          </Button>
          <Button variant="secondary" onClick={() => navigate(Routes.community)}>
            返回 Discover
          </Button>
        </div>
      </div>
    );
  }
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
  const discovery = look.discovery;
  // TAX-04: rights gate fail closed — PERSONAL_USE_ONLY 与缺失 discovery 都
  // 拒绝内容相关的应用/二次创作动作；通用 Studio 导航不受影响。
  const permissions = discovery ? actionPermissions(discovery) : null;
  const remixAllowed = permissions?.remix === true;
  const personalUseOnly = discovery?.rights.status === 'PERSONAL_USE_ONLY';
  const tryable = canTryInStudio(content);
  const legacy = look.readModelKind === 'LEGACY_PARTIAL';
  const canonical = look.readModelKind === 'CANONICAL';
  const evidence = look.evidence;
  const useAvailability = resolveStudioUseAvailabilityV1(look);
  const localHandoffAvailable = canUseLocalStudioHandoff(window.location.origin);
  const crossOriginDisabledReason = localHandoffAvailable
    ? undefined
    : '跨域导入通道尚未配置；当前不会创建 Studio 导入意图。';
  const useUnavailableMessage = useAvailability.state === 'ASSETS_INCOMPLETE'
    ? 'Studio 素材尚未补齐，暂不可使用'
    : useAvailability.state === 'INSPIRATION_ONLY'
      ? '该 Look 仅供灵感参考，暂不可使用'
      : '该版本依赖暂不可用，请稍后再试';

  const prepareLegacyIntent = (): { ok: true; href: string } | { ok: false } => {
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
      return { ok: false };
    }
    return { ok: true, href: studioProductHref(result.href) };
  };

  const onTryClick = () => {
    if (!tryable || !useAvailability.enabled) return;
    if (look.applicationLevel === 'APPROXIMATE') {
      setApproxOpen(true);
      return;
    }
  };

  const prepareVersionedIntent = (): { ok: true; href: string } | { ok: false } => {
    if (!canonical) return { ok: false };
    const result = createVersionedUseIntentForLookV1(look.sourceLook);
    if (!result.ok) {
      toast.error('该版本暂不可用于 Studio，请刷新或返回 Explore 重试。');
      return { ok: false };
    }
    return { ok: true, href: studioProductHref(result.href) };
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
            {/* Application/Verification 是 legacy 证据徽章，不是发现/搜索标签。 */}
            <ApplicationBadge level={look.applicationLevel} />
            <VerificationBadge level={look.verificationLevel} />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-gray-900">{look.title}</h1>
            {look.titleEn && <p className="mt-1 text-sm text-gray-500">{look.titleEn}</p>}
          </div>

          {/* TAX-04: 结构化发现区。只消费 discovery + strict taxonomy-v2；
              不可用时可见失败，绝不基于 legacy 字段推断标签。 */}
          {taxonomyV2 && discovery ? (
            <DiscoveryDetailSection
              taxonomy={taxonomyV2}
              discovery={discovery}
              locale={locale}
            />
          ) : taxonomyV2 === null && taxonomyV2Error === null ? (
            <div
              className="rounded-panel border border-gray-200 px-3 py-2 text-xs text-gray-500"
              data-testid="community-discovery-loading"
            >
              结构化分类加载中…
            </div>
          ) : (
            <div
              className="rounded-panel border border-amber-200 bg-amber-50/60 px-3 py-2 text-xs text-amber-800"
              data-testid="community-discovery-unavailable"
            >
              {taxonomyV2Error !== null
                ? `结构化分类（taxonomy-v2）加载失败（${taxonomyV2Error}）；本页不基于 legacy 字段推断标签。`
                : '该内容缺少结构化发现元数据；不基于 legacy 字段推断标签。'}
            </div>
          )}

          <p className="text-nano leading-relaxed text-gray-500">
            预览通过 ≠ 可制造 ≠ 已下发生产。试用仅写入 Studio 导入意图，不会由 Community 直接改写 Wizard /
            Editor。
          </p>

          <div className="flex flex-wrap gap-2">
            {remixAllowed ? (
              canonical && useAvailability.enabled ? (
                <CrossProductAction
                  href={studioProductHref(Routes.designNew)}
                  prepareHref={prepareVersionedIntent}
                  disabledReason={crossOriginDisabledReason}
                  data-testid="community-use-versioned"
                  className="inline-flex min-h-11 items-center justify-center rounded-button bg-gradient-to-r from-fuchsia-600 to-rose-500 px-5 text-sm font-semibold text-white shadow-lg shadow-fuchsia-200 hover:from-fuchsia-700 hover:to-rose-600 aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
                >
                  使用此版本在 Studio 中定制
                </CrossProductAction>
              ) : tryable && useAvailability.enabled ? (
                look.applicationLevel === 'APPROXIMATE' ? (
                  <Button onClick={onTryClick} disabled={!localHandoffAvailable} title={crossOriginDisabledReason} data-testid="community-try-in-studio">
                    在 Studio 中试用（Legacy 近似）
                  </Button>
                ) : (
                  <CrossProductAction
                    href={studioProductHref(Routes.designNew)}
                    prepareHref={prepareLegacyIntent}
                    disabledReason={crossOriginDisabledReason}
                    data-testid="community-try-in-studio"
                    className="inline-flex min-h-11 items-center justify-center rounded-button bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary-hover aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
                  >
                    在 Studio 中试用
                  </CrossProductAction>
                )
              ) : (
                <div className="flex flex-col items-start gap-1">
                  <Button
                    disabled
                    variant="secondary"
                    data-testid="community-use-disabled"
                    data-use-state={useAvailability.state}
                    title={useUnavailableMessage}
                  >
                    使用
                  </Button>
                  <p
                    className="text-xs text-gray-500"
                    data-testid={look.applicationLevel === 'INSPIRATION_ONLY'
                      ? 'community-inspiration-only'
                      : 'community-missing-asset'}
                  >
                    {useUnavailableMessage}
                  </p>
                </div>
              )
            ) : personalUseOnly ? (
              <div
                className="flex flex-col items-start gap-1"
                data-testid="personal-use-only-action-restricted"
              >
                <Badge variant="warning" className="border-amber-300 bg-amber-50 text-amber-800">
                  仅限个人使用
                </Badge>
                <p className="text-xs text-amber-700">
                  该内容仅限个人使用：不提供「使用此版本在 Studio 中定制 / 试用 / 近似应用」等应用与二次创作动作。
                </p>
              </div>
            ) : (
              <div
                className="flex flex-col items-start gap-1"
                data-testid="community-remix-unavailable"
              >
                <p className="text-xs text-gray-500">
                  该内容缺少结构化权利元数据；不提供应用/二次创作动作（fail closed，不推断）。
                </p>
              </div>
            )}
            <CrossProductLink
              href={studioProductHref(studioReturnPath(searchParams, Routes.designNew))}
              data-testid="community-open-studio"
              className="inline-flex h-9 items-center justify-center rounded-button border border-gray-200 bg-white px-3 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              进入 Studio
            </CrossProductLink>
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
            {crossOriginDisabledReason && remixAllowed && useAvailability.enabled && (
              <p className="basis-full text-xs text-amber-700" data-testid="community-cross-origin-handoff-disabled">
                {crossOriginDisabledReason}
              </p>
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

        <p className="mt-2 text-nano leading-relaxed text-amber-800" data-testid="community-look-source-caveat">
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
            <CrossProductAction
              href={studioProductHref(Routes.designNew)}
              prepareHref={() => {
                const result = prepareLegacyIntent();
                if (result.ok) setApproxOpen(false);
                return result;
              }}
              data-testid="community-approx-confirm"
              className="inline-flex h-9 items-center justify-center rounded-button bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary-hover"
            >
              了解，继续试用
            </CrossProductAction>
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
