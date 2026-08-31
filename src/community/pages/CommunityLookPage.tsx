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
 * - Application / Verification 保留为独立 legacy 证据，不是能力真源；
 *   content-specific CTA 只消费严格 ASSET-03 capability read model。
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
import { loadCommunityAssetCapabilitiesV1 } from '../data/asset-capability-repository';
import { loadCommunityTaxonomyV2 } from '../data/taxonomy-repository';
import type { CommunityPublisherV1 } from '../domain/types';
import type { PublishedLookReadModelV1 } from '../domain/v7_1/published-look-read-model';
import type { CommunityTaxonomyV2 } from '../domain/taxonomy-v2/types';
import type { CommunityLookAssetCapabilityReadModelV1 } from '../domain/asset-capability-v1';
import { actionPermissions } from '../domain/taxonomy-v2/governance';
import { createStudioImportIntent } from '../domain/studio-import-intent';
import { PublisherBadge } from '../components/PublisherBadge';
import { ApplicationBadge, VerificationBadge } from '../components/CapabilityBadge';
import { DiscoveryDetailSection } from '../components/CommunityDiscoveryMetadata';
import { CommunityAssetCapabilitySection } from '../components/CommunityAssetCapability';
import { communityInternalHref, studioReturnPath } from '../lib/entry-link';
import { createVersionedUseIntentForLookV1 } from '@/integration/community-studio/versioned-use-runtime';
import {
  confirmCanonicalLookAsDesignVersionV1,
  readConfirmedLookDesignVersionsV1,
} from '@/integration/community-studio/look-confirm-runtime';
import type { ConfirmedLookDesignVersionRefV1 } from '@/community/domain/v7_1/look-confirm';

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
  const { locale, legacyLocale, t } = useLocale();
  const [look, setLook] = useState<PublishedLookReadModelV1 | null | undefined>(undefined);
  const [publisher, setPublisher] = useState<CommunityPublisherV1 | null>(null);
  const [taxonomyV2, setTaxonomyV2] = useState<CommunityTaxonomyV2 | null>(null);
  const [assetCapability, setAssetCapability] = useState<CommunityLookAssetCapabilityReadModelV1 | null | undefined>(undefined);
  const [assetCapabilityIssueCodes, setAssetCapabilityIssueCodes] = useState<string[]>([]);
  /** TAX-04: taxonomy-v2 加载/解析失败的可见诊断（fail closed，不推断）。 */
  const [taxonomyV2Error, setTaxonomyV2Error] = useState<string | null>(null);
  /** TAX-04: fetch/runtime 加载失败的独立可见状态，绝不伪装成「内容缺失」。 */
  const [loadFailed, setLoadFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  const [coverFailed, setCoverFailed] = useState(false);
  const [approxOpen, setApproxOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [confirmed, setConfirmed] = useState<ConfirmedLookDesignVersionRefV1 | null>(null);

  useEffect(() => {
    if (!lookId) return;
    let cancelled = false;
    setLoadFailed(false);
    setCoverFailed(false);
    setTaxonomyV2Error(null);
    setAssetCapability(undefined);
    setAssetCapabilityIssueCodes([]);
    void (async () => {
      try {
        const [lookModel, taxV2, capabilities] = await Promise.all([
          getLookReadModelById(lookId),
          loadCommunityTaxonomyV2(),
          loadCommunityAssetCapabilitiesV1(),
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
        if (capabilities.ok) {
          const capability = capabilities.index.entries.find((entry) => entry.contentId === lookId) ?? null;
          setAssetCapability(capability);
          if (!capability) setAssetCapabilityIssueCodes(['capability_record_missing']);
        } else {
          setAssetCapability(null);
          setAssetCapabilityIssueCodes(capabilities.issues.map((issue) => issue.code));
        }
        if (lookModel) {
          const pub = await getPublisherById(lookModel.publisherId);
          if (!cancelled) setPublisher(pub);
        }
        const listed = readConfirmedLookDesignVersionsV1();
        if (!cancelled) {
          setConfirmed(
            listed.ok
              ? listed.records.find((record) => record.lookId === lookId) ?? null
              : null,
          );
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
        <h1 className="text-lg font-semibold text-gray-900">{t('community.contentLoadFailed')}</h1>
        <p className="mt-1 text-xs text-gray-500">
          {t('community.contentLoadFailedHint')}
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
            {t('common.retry')}
          </Button>
          <Button variant="secondary" onClick={() => navigate(Routes.community)}>
            {t('community.returnDiscover')}
          </Button>
        </div>
      </div>
    );
  }
  if (look === undefined) {
    return (
      <div className="rounded-card border border-gray-200 bg-white p-6 text-sm text-gray-500">
        {t('common.loading')}
      </div>
    );
  }
  if (look === null) {
    return (
      <div className="rounded-card border border-gray-200 bg-white p-6" data-testid="community-look-missing">
        <h1 className="text-lg font-semibold text-gray-900">{t('community.contentNotFound')}</h1>
        <p className="mt-1 text-xs text-gray-500">{t('community.contentUnavailableHint')}</p>
        <Button className="mt-4" variant="secondary" onClick={() => navigate(Routes.community)}>
          {t('community.returnDiscover')}
        </Button>
      </div>
    );
  }

  const content = look.sourceContent;
  const discovery = look.discovery;
  // TAX-04: rights gate fail closed — PERSONAL_USE_ONLY 与缺失 discovery 都
  // 拒绝内容相关的应用/二次创作动作；通用 Studio 导航不受影响。
  const permissions = discovery ? actionPermissions(discovery) : null;
  const remixAllowed = permissions?.remix === true && assetCapability?.permissions.remix === true;
  const personalUseOnly = discovery?.rights.status === 'PERSONAL_USE_ONLY';
  const legacy = look.readModelKind === 'LEGACY_PARTIAL';
  const canonical = look.readModelKind === 'CANONICAL';
  const evidence = look.evidence;
  const localHandoffAvailable = canUseLocalStudioHandoff(window.location.origin);
  const crossOriginDisabledReason = localHandoffAvailable
    ? undefined
    : t('community.crossOriginImportUnavailable');
  const useUnavailableMessage = assetCapability?.capabilityState === 'ASSETS_INCOMPLETE'
    ? t('community.assetsIncomplete')
    : assetCapability?.capabilityState === 'INSPIRATION_ONLY'
      ? t('community.lookInspirationOnlyShort')
      : assetCapability?.capabilityState === 'UNAVAILABLE'
        ? t('community.contentUnavailableDiagnostics')
        : t('community.assetContractStopped');

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
        toast.info(t('community.inspirationOnlyNotice'));
      } else if (result.reason === 'missing_asset') {
        toast.error(t('community.missingApplicationAsset'));
      } else {
        toast.error(t('community.contentNotPublished'));
      }
      return { ok: false };
    }
    return { ok: true, href: studioProductHref(result.href) };
  };

  const onTryClick = () => {
    if (assetCapability?.cta !== 'USE_LEGACY_APPROXIMATE') return;
    setApproxOpen(true);
  };

  const prepareVersionedIntent = (): { ok: true; href: string } | { ok: false } => {
    if (!canonical) return { ok: false };
    const result = createVersionedUseIntentForLookV1(look.sourceLook);
    if (!result.ok) {
      toast.error(t('community.tryUnavailable'));
      return { ok: false };
    }
    return { ok: true, href: studioProductHref(result.href) };
  };

  const onConfirmLook = () => {
    if (!canonical || confirmBusy) return;
    setConfirmBusy(true);
    try {
      const result = confirmCanonicalLookAsDesignVersionV1(look);
      if (!result.ok) {
        toast.error(
          result.reason === 'legacy_missing_design_version'
            ? t('community.confirm.legacyBlocked')
            : t('community.confirm.unavailable'),
        );
        return;
      }
      setConfirmed(result.record);
      setConfirmOpen(false);
      toast.success(result.created ? t('community.confirm.success') : t('community.confirm.already'));
    } catch {
      toast.error(t('community.confirm.unavailable'));
    } finally {
      setConfirmBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-4" data-testid="community-look-page">
      <div className="flex items-center gap-2">
        <Button size="sm" variant="ghost" onClick={() => navigate(-1)}>
          <ArrowLeft size={14} />
          {t('common.back')}
        </Button>
        <Link
          to={communityInternalHref(Routes.community, searchParams)}
          className="text-xs text-gray-500 hover:text-gray-800"
        >
          {t('app.discover')}
        </Link>
      </div>

      <article className="overflow-hidden rounded-card border border-gray-200 bg-white">
        <div className="aspect-[16/9] bg-gray-100">
          {coverFailed ? (
            <div
              className="flex h-full w-full items-center justify-center text-xs text-gray-400"
              data-testid="community-cover-fallback"
            >
              {t('community.coverUnavailable')}
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
            {/* Verification 只说明预览校验，不是 capability / makeability。 */}
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
              {t('community.structuredTaxonomyLoading')}
            </div>
          ) : (
            <div
              className="rounded-panel border border-amber-200 bg-amber-50/60 px-3 py-2 text-xs text-amber-800"
              data-testid="community-discovery-unavailable"
            >
              {taxonomyV2Error !== null
                ? t('community.taxonomyLoadFailedNoLegacyInference', { reason: taxonomyV2Error })
                : t('community.discoveryMetadataMissingNoLegacyInference')}
            </div>
          )}

          <CommunityAssetCapabilitySection
            capability={assetCapability}
            issueCodes={assetCapabilityIssueCodes}
            locale={legacyLocale}
          />

          <p className="text-nano leading-relaxed text-gray-500">
            {t('community.previewNotManufacturingNote')}
          </p>
          {confirmed && (
            <div
              className="rounded-panel border border-hairline bg-surface-soft px-3 py-2 text-xs text-body"
              data-testid="community-confirm-look-identity"
            >
              <p className="font-medium text-ink">{t('community.confirm.identity')}</p>
              <p className="mt-1 font-mono text-nano text-mute">
                {t('community.confirm.identityLine', {
                  designVersionId: confirmed.designVersionId,
                  revision: confirmed.revision,
                  sha: `${confirmed.editorDocSha256.slice(0, 12)}…`,
                })}
              </p>
              <p className="mt-1 text-nano text-mute">{t('community.confirm.notEditorWrite')}</p>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            {assetCapability === undefined ? (
              <Button className="min-h-11" disabled variant="secondary" data-testid="community-asset-capability-action-loading">
                {t('community.assetCapabilityLoading')}
              </Button>
            ) : assetCapability === null ? (
              <div className="flex flex-col items-start gap-1" data-testid="community-asset-capability-action-restricted">
                <Button className="min-h-11" disabled variant="secondary">{t('common.use')}</Button>
                <p className="text-xs text-amber-700">{t('community.assetContractUnavailable')}</p>
              </div>
            ) : remixAllowed ? (
              canonical && assetCapability.cta === 'USE_VERSIONED' ? (
                <CrossProductAction
                  href={studioProductHref(Routes.designNew)}
                  prepareHref={prepareVersionedIntent}
                  disabledReason={crossOriginDisabledReason}
                  data-testid="community-use-versioned"
                  className="inline-flex min-h-11 items-center justify-center rounded-button bg-gradient-to-r from-fuchsia-600 to-rose-500 px-5 text-sm font-semibold text-white shadow-lg shadow-fuchsia-200 hover:from-fuchsia-700 hover:to-rose-600 aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
                >
                  {t('community.customizeVersionInStudio')}
                </CrossProductAction>
              ) : legacy && assetCapability.cta === 'USE_LEGACY_APPROXIMATE' ? (
                  <Button className="min-h-11" onClick={onTryClick} disabled={!localHandoffAvailable} title={crossOriginDisabledReason} data-testid="community-try-in-studio">
                    {t('community.tryLegacyApproximate')}
                  </Button>
              ) : (
                <div className="flex flex-col items-start gap-1">
                  <Button
                    className="min-h-11"
                    disabled
                    variant="secondary"
                    data-testid="community-use-disabled"
                    data-use-state={assetCapability.capabilityState}
                    title={useUnavailableMessage}
                  >
                    {t('common.use')}
                  </Button>
                  <p
                    className="text-xs text-gray-500"
                    data-testid={assetCapability.capabilityState === 'INSPIRATION_ONLY'
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
                  {t('community.personalUseOnly')}
                </Badge>
                <p className="text-xs text-amber-700">
                  {t('community.personalUseOnlyDescription')}
                </p>
              </div>
            ) : (
              <div
                className="flex flex-col items-start gap-1"
                data-testid="community-remix-unavailable"
              >
                <p className="text-xs text-gray-500">
                  {t('community.rightsMetadataMissing')}
                </p>
              </div>
            )}
            {canonical ? (
              <Button
                className="min-h-11"
                variant="secondary"
                disabled={confirmBusy}
                data-testid="community-confirm-look"
                onClick={() => setConfirmOpen(true)}
              >
                {confirmed ? t('community.confirm.already') : t('community.confirm.action')}
              </Button>
            ) : (
              <div className="flex flex-col items-start gap-1" data-testid="community-confirm-look-legacy">
                <Button className="min-h-11" disabled variant="secondary">
                  {t('community.confirm.action')}
                </Button>
                <p className="text-xs text-amber-700">{t('community.confirm.legacyBlocked')}</p>
              </div>
            )}
            <CrossProductLink
              href={studioProductHref(studioReturnPath(searchParams, Routes.designNew))}
              data-testid="community-open-studio"
              className="inline-flex h-9 items-center justify-center rounded-button border border-gray-200 bg-white px-3 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              {t('community.enterStudio')}
            </CrossProductLink>
            {look.assetRef?.manifestUrl && (
              <a
                href={look.assetRef.manifestUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-9 items-center justify-center rounded-button border border-gray-200 bg-white px-3 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                <ExternalLink size={14} className="mr-1" />
                {t('community.assetManifest')}
              </a>
            )}
            {crossOriginDisabledReason && remixAllowed && (assetCapability.cta === 'USE_VERSIONED' || assetCapability.cta === 'USE_LEGACY_APPROXIMATE') && (
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
          {t('app.evidenceCompatibility')}
        </h2>

        <div className="mt-2 flex flex-wrap items-center gap-2" data-testid="community-legacy-application-evidence">
          <span className="text-xs text-amber-800">{t('app.legacyApplicationLabelCompatibilityEvidenceOnly')}</span>
          <ApplicationBadge level={look.applicationLevel} />
        </div>

        <div className="mt-2 space-y-1.5">
          <EvidenceRow
            label={t('app.compatibilityStatus')}
            value={
              legacy
                ? t('app.legacyStaticContentPartialEvidenceNotFullPublishedlookv1')
                : t('community.canonicalPublishedLookEvidence')
            }
            tone={legacy ? 'missing' : 'ok'}
          />
          <EvidenceRow
            label={t('app.immutableDesignVersion')}
            value={
              evidence.immutableDesignVersion.present
                ? t('app.designversionv1Referenced')
                : t('app.unavailableNoDesignversionidEditordocSha256')
            }
            tone={evidence.immutableDesignVersion.present ? 'ok' : 'missing'}
          />
          <EvidenceRow
            label={t('app.previewRevisionHash')}
            value={
              evidence.previewEvidence.present
                ? t('app.immutablePreviewAssetReferenced')
                : t('app.unavailableNoPreviewRevisionSha256')
            }
            tone={evidence.previewEvidence.present ? 'ok' : 'missing'}
          />
          <EvidenceRow
            label={t('app.publicPublicationGate')}
            value={
              evidence.publicationGate.present
                ? t('app.verifiedCopyrightSourceModeration')
                : t('app.unverifiedNoCopyrightSourceModerationEvidence')
            }
            tone={evidence.publicationGate.present ? 'ok' : 'missing'}
          />
        </div>

        <div
          className="mt-3 rounded-panel border border-amber-200 bg-white/70 px-3 py-2 text-xs text-gray-700"
          data-testid="community-look-evidence-missing"
        >
          <p className="font-medium text-gray-800">
            {t('app.statusDistinctionThreeIndependentAxes')}
          </p>
          <div className="mt-1.5 space-y-1">
            <EvidenceRow
              label={t('app.previewVerified')}
              value={evidence.status.previewVerified ? t('app.yesRenderVerified') : t('app.noConcept')}
              tone={evidence.status.previewVerified ? 'ok' : 'missing'}
            />
            <EvidenceRow
              label={t('app.manufacturingEvidence')}
              value={evidence.status.manufacturable ? t('app.verified') : t('app.noEvidence')}
              tone={evidence.status.manufacturable ? 'ok' : 'missing'}
            />
            <EvidenceRow
              label={t('app.productionDispatched')}
              value={evidence.status.productionDispatched ? t('app.yes') : t('app.noEvidence')}
              tone={evidence.status.productionDispatched ? 'ok' : 'missing'}
            />
          </div>
        </div>

        <p className="mt-2 text-nano leading-relaxed text-amber-800" data-testid="community-look-source-caveat">
          {legacy
            ? t('app.sourceStaticFixtureDataNotLiveCommunityBackendDemoCreatorContentVisibleOnlyDevelopmentIntegrationPreviewVerifiedManufacturableProductionDispatchedRecordCarriesNoManufacturingDeviceEvidence')
            : t('app.sourceCanonicalPublishedlookv1Contract')}
        </p>
      </section>

      <Modal
        open={approxOpen}
        onClose={() => setApproxOpen(false)}
                title={t('community.approximateApplication')}
        footer={
          <>
            <Button variant="ghost" onClick={() => setApproxOpen(false)}>
              {t('common.cancel')}
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
              {t('community.understandContinueTrial')}
            </CrossProductAction>
          </>
        }
      >
        <p className="text-sm text-gray-600">
          {t('community.approximateApplicationDescription')}
        </p>
      </Modal>

      <Modal
        open={confirmOpen}
        testId="community-confirm-look-dialog"
        onClose={() => {
          if (!confirmBusy) setConfirmOpen(false);
        }}
        title={t('community.confirm.title')}
        footer={
          <>
            <Button variant="ghost" disabled={confirmBusy} onClick={() => setConfirmOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              loading={confirmBusy}
              data-testid="community-confirm-look-submit"
              onClick={onConfirmLook}
            >
              {t('community.confirm.action')}
            </Button>
          </>
        }
      >
        <p className="text-sm text-body">{t('community.confirm.description')}</p>
        <p className="mt-2 text-xs text-mute">{t('community.confirm.notEditorWrite')}</p>
      </Modal>
    </div>
  );
}
