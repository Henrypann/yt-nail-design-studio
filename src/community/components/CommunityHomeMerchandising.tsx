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
  const { locale, text } = useLocale();
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
        <p className="text-xs text-gray-500">{text('首页精选配置加载中…', 'Loading home curation…')}</p>
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
          {text('首页精选暂不可用', 'Home curation is unavailable')}
        </h2>
        <p className="mt-1 text-xs leading-relaxed text-amber-800">
          {text(
            '运营配置加载或校验失败；不会以热门、个性化推荐或 Studio 官方模板自动代填。下方完整发现内容仍可浏览。',
            'The merchandising configuration failed to load or validate. Trending, personalized recommendations, and Studio Official templates are never substituted. The full discovery feed remains available below.',
          )}
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
                ? text('编辑精选正在审核', 'Editorial curation is in review')
                : text('编辑精选正在准备中', 'Editorial curation is being prepared')}
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-gray-600">
              {text(
                'Banner、精选 Look、集合与编辑理由尚未完成负责人签收。当前不会伪造热门或个性化结果；你仍可使用下方五入口浏览全部公开内容。',
                'Banner, featured Looks, collections and editorial reasons are not yet owner-approved. No trending or personalized result is fabricated; use the five browse entries below to explore all public content.',
              )}
            </p>
          </div>
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <div className="rounded-panel border border-gray-200 bg-white/80 px-3 py-2">
            <p className="text-xs font-medium text-gray-800">{text('Community 编辑精选', 'Community editorial')}</p>
            <p className="mt-0.5 text-nano text-gray-500">{text('人工编排 · 等待运营输入', 'Human-curated · awaiting operator input')}</p>
          </div>
          <div className="rounded-panel border border-gray-200 bg-white/80 px-3 py-2">
            <p className="text-xs font-medium text-gray-800">{text('Studio 官方起稿', 'Studio Official starters')}</p>
            <p className="mt-0.5 text-nano text-gray-500">{text('独立产品面 · 不在此处复制', 'Separate product surface · never copied here')}</p>
          </div>
        </div>
      </section>
    );
  }

  if (projection.state !== 'READY') return null;
  const zh = locale === 'zh';
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
              <span className="ml-2 text-xs">{text('Banner 图片暂不可用', 'Banner image unavailable')}</span>
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
          {text('本期未配置 Banner；不会使用占位广告代替。', 'No Banner is configured for this edition; no placeholder ad is substituted.')}
        </div>
      )}

      <div>
        <div className="mb-2 flex items-center gap-2">
          <Sparkles size={15} className="text-fuchsia-600" aria-hidden />
          <h2 className="text-sm font-semibold text-gray-900">{text('编辑精选', 'Editorial picks')}</h2>
          <span className="text-nano text-gray-500">{text('人工编排，不是热门榜', 'Human-curated, not trending')}</span>
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
                  {text('查看详情与使用条件', 'View details and use conditions')}
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
