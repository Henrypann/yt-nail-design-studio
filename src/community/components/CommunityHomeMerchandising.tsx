import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ImageOff, LibraryBig, Sparkles } from 'lucide-react';
import { Routes } from '@/app/routes';
import { useLocale } from '@/lib/i18n';
import {
  loadCommunityHomeMerchandisingV1,
  type CommunityHomeMerchandisingLoadResultV1,
} from '../data/home-merchandising-repository';

type State = { kind: 'loading' } | { kind: 'loaded'; result: CommunityHomeMerchandisingLoadResultV1 };

export function CommunityHomeMerchandising() {
  const { locale, t } = useLocale();
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [bannerFailed, setBannerFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void loadCommunityHomeMerchandisingV1().then((result) => {
      if (!cancelled) setState({ kind: 'loaded', result });
    });
    return () => { cancelled = true; };
  }, []);

  if (state.kind === 'loading') {
    return (
      <section
        className="rounded-card border border-gray-200 bg-white p-4"
        data-testid="community-home-merchandising-loading"
      >
        <p className="text-xs text-gray-500">{t('app.loadingHomeCuration')}</p>
      </section>
    );
  }

  if (!state.result.ok) {
    return (
      <section
        className="rounded-card border border-amber-200 bg-amber-50/70 p-4"
        data-testid="community-home-merchandising-unavailable"
        data-issue-codes={state.result.issues.map((issue) => issue.code).join(',')}
      >
        <h2 className="text-sm font-semibold text-amber-900">
          {t('app.homeCurationUnavailable')}
        </h2>
        <p className="mt-1 text-xs leading-relaxed text-amber-800">
          {t('app.merchandisingConfigurationFailedLoadValidateTrendingPersonalizedRecommendationsStudioOfficialTemplatesNeverSubstitutedFullDiscoveryFeedRemainsAvailableBelow')}
        </p>
      </section>
    );
  }

  const projection = state.result.projection;
  if (projection.state === 'AWAITING_INPUT' || projection.state === 'IN_REVIEW') {
    const reviewing = projection.state === 'IN_REVIEW';
    return (
      <section
        className="rounded-card border border-fuchsia-100 bg-gradient-to-br from-white to-fuchsia-50/40 p-4"
        data-testid={reviewing
          ? 'community-home-merchandising-in-review'
          : 'community-home-merchandising-awaiting-input'}
        data-merchandising-status={projection.state}
      >
        <div className="flex items-start gap-3">
          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-fuchsia-100 text-fuchsia-700">
            <Sparkles size={17} aria-hidden />
          </span>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-gray-900">
              {reviewing
                ? t('app.editorialCurationReview')
                : t('app.editorialCurationBeingPrepared')}
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-gray-600">
              {t('app.bannerFeaturedLooksCollectionsEditorialReasonsNotYetOwnerApprovedNoTrendingPersonalizedResultFabricatedUseFiveBrowseEntriesBelowExploreAllPublicContent')}
            </p>
          </div>
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <div className="rounded-panel border border-gray-200 bg-white/80 px-3 py-2">
            <p className="text-xs font-medium text-gray-800">{t('app.communityEditorial')}</p>
            <p className="mt-0.5 text-nano text-gray-500">{t('app.humanCuratedAwaitingOperatorInput')}</p>
          </div>
          <div className="rounded-panel border border-gray-200 bg-white/80 px-3 py-2">
            <p className="text-xs font-medium text-gray-800">{t('app.studioOfficialStarters')}</p>
            <p className="mt-0.5 text-nano text-gray-500">{t('app.separateProductSurfaceNeverCopiedHere')}</p>
          </div>
        </div>
      </section>
    );
  }

  if (projection.state !== 'READY') return null;
  const zh = locale === 'zh-CN';
  return (
    <section className="space-y-3" data-testid="community-home-merchandising-ready">
      {projection.config.banner ? (
        <Link
          to={projection.config.banner.href}
          className="group relative block min-h-44 overflow-hidden rounded-card border border-gray-200 bg-gray-900"
          data-testid="community-home-merchandising-banner"
        >
          {bannerFailed ? (
            <div
              className="absolute inset-0 flex items-center justify-center bg-gray-800 text-white/70"
              data-testid="community-home-merchandising-banner-fallback"
            >
              <ImageOff size={24} aria-hidden />
              <span className="ml-2 text-xs">{t('app.bannerImageUnavailable')}</span>
            </div>
          ) : (
            <img
              src={projection.config.banner.imageUrl}
              alt=""
              className="absolute inset-0 h-full w-full object-cover opacity-75"
              onError={() => setBannerFailed(true)}
            />
          )}
          <div className="relative flex min-h-44 flex-col justify-end bg-gradient-to-t from-black/75 to-transparent p-5 text-white">
            <h2 className="text-xl font-semibold">{zh ? projection.config.banner.title.zhCN : projection.config.banner.title.en}</h2>
            <p className="mt-1 max-w-xl text-sm text-white/85">{zh ? projection.config.banner.subtitle.zhCN : projection.config.banner.subtitle.en}</p>
          </div>
        </Link>
      ) : (
        <div className="flex items-center gap-2 rounded-panel border border-dashed border-gray-200 bg-white px-3 py-2 text-xs text-gray-500" data-testid="community-home-merchandising-no-banner">
          <ImageOff size={14} aria-hidden />
          {t('app.noBannerConfiguredEditionNoPlaceholderAdSubstituted')}
        </div>
      )}

      <div>
        <div className="mb-2 flex items-center gap-2">
          <Sparkles size={15} className="text-fuchsia-600" aria-hidden />
          <h2 className="text-sm font-semibold text-gray-900">{t('app.editorialPicks')}</h2>
          <span className="text-nano text-gray-500">{t('app.humanCuratedNotTrending')}</span>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {projection.editorialSelections.map(({ look, capability, reason }) => (
            <article key={look.lookId} className="overflow-hidden rounded-card border border-gray-200 bg-white">
              <img src={look.cover.url} alt="" className="aspect-[16/9] w-full object-cover" loading="lazy" />
              <div className="p-3">
                <p className="text-sm font-medium text-gray-900">{look.title}</p>
                <p className="mt-1 text-xs leading-relaxed text-gray-600">{zh ? reason.zhCN : reason.en}</p>
                <p className="mt-2 text-nano text-gray-500">{capability.capabilityState}</p>
                <Link to={Routes.communityLook(look.lookId)} className="mt-2 inline-flex min-h-11 items-center gap-1 text-xs font-medium text-primary">
                  {t('app.viewDetailsUseConditions')}
                  <ArrowRight size={13} aria-hidden />
                </Link>
              </div>
            </article>
          ))}
        </div>
      </div>

      {projection.collections.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2" data-testid="community-home-merchandising-collections">
          {projection.collections.map(({ collection, looks }) => (
            <section key={collection.collectionId} className="rounded-card border border-gray-200 bg-white p-4">
              <div className="flex items-center gap-2">
                <LibraryBig size={15} className="text-gray-500" aria-hidden />
                <h3 className="text-sm font-semibold text-gray-900">{zh ? collection.title.zhCN : collection.title.en}</h3>
              </div>
              <p className="mt-1 text-xs text-gray-600">{zh ? collection.summary.zhCN : collection.summary.en}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {looks.map((look) => (
                  <Link key={look.lookId} to={Routes.communityLook(look.lookId)} className="text-xs font-medium text-primary hover:underline">
                    {look.title}
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </section>
  );
}
