/**
 * Community 独立产品壳：无 Studio 侧栏，不读 Wizard/Editor Store。
 */

import { Link, NavLink, Outlet, useSearchParams } from 'react-router-dom';
import { ArrowUpRight, Compass, LogIn, Menu, Palette, Sparkles, UserPlus, X } from 'lucide-react';
import { useState } from 'react';
import { cx } from '@/design-system';
import { LanguageToggle, useLocale } from '@/lib/i18n';
import { Routes } from '@/app/routes';
import { studioProductHref } from '@/app/product-navigation';
import { communityInternalHref, studioReturnPath } from '@/community/lib/entry-link';
import { CrossProductLink } from '@/app/CrossProductLink';

export function CommunityLayout() {
  const { text } = useLocale();
  const [searchParams] = useSearchParams();
  const [mobileOpen, setMobileOpen] = useState(false);
  const studioReturn = studioReturnPath(searchParams);
  const studioHref = studioProductHref(studioReturn);

  const navItems = [
    {
      to: communityInternalHref(Routes.community, searchParams),
      label: text('发现', 'Discover'),
      end: true,
    },
    {
      to: communityInternalHref(Routes.communitySearch, searchParams),
      label: text('搜索', 'Search'),
      end: true,
    },
    {
      to: communityInternalHref(Routes.communityOfficial, searchParams),
      label: text('官方', 'Official'),
      end: true,
    },
    {
      to: communityInternalHref(Routes.communityCreators, searchParams),
      label: text('认证创作者', 'Creators'),
      end: true,
    },
    {
      to: communityInternalHref(Routes.communityBoards, searchParams),
      label: text('Nail Board', 'Nail Board'),
      end: true,
    },
  ] as const;

  return (
    <div className="flex min-h-screen flex-col bg-canvas" data-debug-id="community.layout">
      <header className="sticky top-0 z-40 border-b border-gray-200/80 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-[1200px] items-center gap-3 px-4 sm:px-6">
          <button
            type="button"
            className="rounded-button p-2 text-gray-600 lg:hidden"
            aria-label={text('菜单', 'Menu')}
            onClick={() => setMobileOpen((v) => !v)}
          >
            {mobileOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
          <div className="flex min-w-0 items-center gap-2">
            <Compass size={16} className="shrink-0 text-primary" />
            <span className="truncate text-sm font-bold text-gray-900">
              Nail Lover Community
            </span>
          </div>
          <nav className="ml-4 hidden items-center gap-1 lg:flex" aria-label="Community">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cx(
                    'rounded-button px-2.5 py-1.5 text-xs transition-colors',
                    isActive
                      ? 'bg-primary-soft font-medium text-primary'
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900',
                  )
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <Link
              to={Routes.communityCreatorWorkspace}
              data-testid="community-creator-workspace-entry"
              className="hidden min-h-10 items-center gap-1.5 rounded-button border border-primary/20 bg-primary-soft px-3 text-xs font-semibold text-primary transition-colors hover:bg-primary/15 lg:inline-flex"
            >
              <Sparkles size={13} aria-hidden />
              {text('创作者工作台', 'Creator Studio')}
            </Link>
            <div className="hidden items-center gap-1 lg:flex" aria-label={text('账号', 'Account')}>
              <Link
                to={Routes.login}
                data-testid="community-login-entry"
                className="inline-flex min-h-10 items-center justify-center rounded-button px-3 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                {text('登录', 'Log in')}
              </Link>
              <Link
                to={Routes.register}
                data-testid="community-register-entry"
                className="inline-flex min-h-10 items-center justify-center rounded-button border border-gray-300 bg-white px-3 text-xs font-semibold text-gray-800 transition-colors hover:border-primary/40 hover:bg-primary-soft hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                {text('注册', 'Sign up')}
              </Link>
            </div>
            <LanguageToggle />
            <CrossProductLink
              href={studioHref}
              data-testid="community-enter-studio"
              className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-button bg-primary px-3 text-xs font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary-hover"
            >
              <Palette size={13} />
              {text('进入 Nail Design Studio', 'Open Nail Design Studio')}
              <ArrowUpRight size={13} />
            </CrossProductLink>
          </div>
        </div>
        {mobileOpen && (
          <nav className="border-t border-gray-100 px-4 py-2 lg:hidden" aria-label="Community mobile">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                onClick={() => setMobileOpen(false)}
                className={({ isActive }) =>
                  cx(
                    'flex min-h-11 items-center rounded-button px-3 py-2 text-sm',
                    isActive ? 'bg-primary-soft text-primary' : 'text-gray-700',
                  )
                }
              >
                {item.label}
              </NavLink>
            ))}
            <div className="mt-2 grid grid-cols-2 gap-2 border-t border-gray-100 pt-3">
              <Link
                to={Routes.communityCreatorWorkspace}
                data-testid="community-mobile-creator-workspace-entry"
                onClick={() => setMobileOpen(false)}
                className="col-span-2 inline-flex min-h-11 items-center justify-center gap-2 rounded-button border border-primary/20 bg-primary-soft px-3 text-sm font-semibold text-primary"
              >
                <Sparkles size={15} aria-hidden />
                {text('创作者工作台', 'Creator Studio')}
              </Link>
              <Link
                to={Routes.login}
                data-testid="community-mobile-login-entry"
                onClick={() => setMobileOpen(false)}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-button border border-gray-200 bg-white px-3 text-sm font-medium text-gray-700"
              >
                <LogIn size={15} aria-hidden />
                {text('登录', 'Log in')}
              </Link>
              <Link
                to={Routes.register}
                data-testid="community-mobile-register-entry"
                onClick={() => setMobileOpen(false)}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-button bg-primary px-3 text-sm font-semibold text-primary-foreground"
              >
                <UserPlus size={15} aria-hidden />
                {text('注册', 'Sign up')}
              </Link>
            </div>
          </nav>
        )}
      </header>
      <main className="mx-auto w-full max-w-[1200px] flex-1 px-4 py-6 sm:px-6">
        <Outlet />
      </main>
      <footer className="border-t border-gray-200/70 py-3 text-center text-nano text-gray-400">
        {text(
          '灵感参考 · 预览通过 ≠ 可制造 · 开放上传尚未启用',
          'Inspiration only · Preview ≠ manufacturable · Upload not enabled',
        )}
      </footer>
    </div>
  );
}
