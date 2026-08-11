/**
 * Community 独立产品壳：无 Studio 侧栏，不读 Wizard/Editor Store。
 */

import { NavLink, Outlet, useNavigate, useSearchParams } from 'react-router-dom';
import { Compass, Home, Menu, Palette, X } from 'lucide-react';
import { useState } from 'react';
import { Button, cx } from '@/design-system';
import { LanguageToggle, useLocale } from '@/lib/i18n';
import { Routes } from '@/app/routes';
import { communityInternalHref, studioReturnPath } from '@/community/lib/entry-link';

export function CommunityLayout() {
  const { text } = useLocale();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [mobileOpen, setMobileOpen] = useState(false);
  const studioReturn = studioReturnPath(searchParams);

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
  ] as const;

  return (
    <div className="flex min-h-screen flex-col bg-[#F7F3EE]" data-debug-id="community.layout">
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
              {text('社区', 'Community')}
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
            <LanguageToggle />
            <Button
              size="sm"
              variant="ghost"
              data-testid="community-enter-dashboard"
              onClick={() => navigate(Routes.dashboard)}
            >
              <Home size={13} />
              {text('Dashboard', 'Dashboard')}
            </Button>
            <Button
              size="sm"
              variant="secondary"
              data-testid="community-enter-studio"
              onClick={() => navigate(studioReturn)}
            >
              <Palette size={13} />
              {text('进入 Studio', 'Enter Studio')}
            </Button>
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
          </nav>
        )}
      </header>
      <main className="mx-auto w-full max-w-[1200px] flex-1 px-4 py-6 sm:px-6">
        <Outlet />
      </main>
      <footer className="border-t border-gray-200/70 py-3 text-center text-[10px] text-gray-400">
        {text(
          '灵感参考 · 预览通过 ≠ 可制造 · 开放上传尚未启用',
          'Inspiration only · Preview ≠ manufacturable · Upload not enabled',
        )}
      </footer>
    </div>
  );
}
