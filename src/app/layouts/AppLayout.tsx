import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Bell, Compass, Home, Users, Palette, Monitor, LogOut, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { useEffect, useState } from 'react';
import { cx } from '@/design-system';
import { readData, removeKey, writeEnvelope, StorageKeys } from '@/lib/storage';
import { LanguageToggle, useLocale } from '@/lib/i18n';
import { designNewFresh, Routes } from '@/app/routes';
import { communityProductHref } from '@/app/product-navigation';
import { communityHref } from '@/community/lib/entry-link';
import { useDevicesStore } from '@/platform/devices/device-store';
import { CrossProductLink } from '@/app/CrossProductLink';

/** 会话信息（Mock）：注册/登录模块写入 session envelope，此处只读 */
interface SessionInfo {
  storeName?: string;
  userName?: string;
  email?: string;
}

interface NavItem {
  to: string;
  label: string;
  end?: boolean;
  productBoundary?: boolean;
}
interface NavGroup {
  key: string;
  label: string;
  icon: typeof Home;
  items: NavItem[];
}

/** 侧栏结构（PRD §1.2）：门店 SaaS / Studio / Community 三域全局互通，无门店设置组 */
/** 登录后全局布局：侧栏 + 顶栏（门店名纯文本 / 通知 / 用户名 / 退出）
 *  v1.5.1：侧栏支持收起/展开（持久化 localStorage，收起后仅图标 + tooltip） */
export function AppLayout() {
  const { text } = useLocale();
  const navigate = useNavigate();
  const session = readData<SessionInfo>(StorageKeys.session) ?? {};
  const hasRegisteredHardware = useDevicesStore((state) => state.devices.length > 0);
  const [collapsed, setCollapsed] = useState(
    () => readData<{ collapsed: boolean }>(StorageKeys.sidebarCollapsed)?.collapsed ?? false,
  );
  const [compactViewport, setCompactViewport] = useState(
    () => window.matchMedia('(max-width: 767px)').matches,
  );

  useEffect(() => {
    const query = window.matchMedia('(max-width: 767px)');
    const update = () => setCompactViewport(query.matches);
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  const sidebarCollapsed = collapsed || compactViewport;

  const toggleCollapsed = () => {
    const next = !collapsed;
    writeEnvelope(StorageKeys.sidebarCollapsed, { collapsed: next });
    setCollapsed(next);
  };

  const handleLogout = () => {
    removeKey(StorageKeys.session);
    navigate('/login', { replace: true });
  };
  const communityTo = communityProductHref(communityHref({
    entry: 'product_switcher',
    returnTo: Routes.studio,
  }));
  const navGroups: NavGroup[] = [
    {
      key: 'studio',
      label: 'Studio',
      icon: Palette,
      items: [
        { to: Routes.studio, label: 'Studio Home', end: true },
        { to: designNewFresh(), label: text('新建设计', 'New design') },
        { to: Routes.designs, label: text('我的设计', 'My designs'), end: true },
      ],
    },
    {
      key: 'community',
      label: 'Community',
      icon: Compass,
      items: [
        { to: communityTo, label: 'Nail Lover Community', productBoundary: true },
      ],
    },
    ...(hasRegisteredHardware ? [
      {
        key: 'customers',
        label: text('客户管理', 'Customers'),
        icon: Users,
        items: [
          { to: Routes.dashboard, label: 'Dashboard' },
          { to: Routes.customers, label: text('客户列表', 'Customer list'), end: true },
          { to: Routes.customerNew, label: text('新建客户', 'New customer') },
        ],
      },
    ] satisfies NavGroup[] : []),
    {
      key: 'devices',
      label: text('设备管理', 'Devices'),
      icon: Monitor,
      items: [
        { to: Routes.deviceBind, label: text('设备绑定', 'Bind device') },
        ...(hasRegisteredHardware
          ? [{ to: Routes.devices, label: text('我的设备', 'My devices'), end: true }]
          : []),
      ],
    },
  ];

  return (
    <div className="flex min-h-screen">
      {/* 侧栏（展开 240px / 收起 56px） */}
      <aside
        data-debug-id="app.layout.sidebar"
        className={cx(
          'flex shrink-0 flex-col border-r border-gray-200 bg-white transition-[width] duration-normal ease-out',
          sidebarCollapsed ? 'w-14' : 'w-60',
        )}
      >
        <div
          className={cx(
            'flex h-14 items-center border-b border-gray-200',
            sidebarCollapsed ? 'justify-center px-2' : 'justify-between px-4',
          )}
        >
          {!sidebarCollapsed && <span className="text-sm font-bold text-primary">Nail Design Studio</span>}
          {!compactViewport && (
            <button
              onClick={toggleCollapsed}
              title={collapsed ? '展开导航' : '收起导航'}
              aria-label={collapsed ? '展开导航' : '收起导航'}
              className="rounded-button p-1.5 text-gray-400 transition-colors duration-fast hover:bg-gray-100 hover:text-gray-700"
            >
              {collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
            </button>
          )}
        </div>
        <nav className={cx('flex-1 overflow-y-auto py-4', sidebarCollapsed ? 'px-2' : 'px-3')}>
          {navGroups.map((group) => (
            <div key={group.key} className="mb-4" data-testid={`nav-group-${group.key}`}>
              {sidebarCollapsed ? (
                <p className="mb-1 flex justify-center text-gray-300" title={group.label}>
                  <group.icon size={14} />
                </p>
              ) : (
                <p className="mb-1 flex items-center gap-1.5 px-2 text-nano font-semibold uppercase tracking-wide text-gray-400">
                  <group.icon size={12} />
                  {group.label}
                </p>
              )}
              {group.items.map((item) => item.productBoundary ? (
                <CrossProductLink
                  key={item.to}
                  href={item.to}
                  title={sidebarCollapsed ? item.label : undefined}
                  data-testid="nav-community"
                  className={cx(
                    'block rounded-button py-1.5 text-sm text-gray-600 transition-colors duration-fast ease-out hover:bg-gray-100 hover:text-gray-900',
                    sidebarCollapsed ? 'px-1 text-center text-nano leading-tight' : 'px-2.5',
                  )}
                >
                  {sidebarCollapsed ? item.label.slice(0, 2) : item.label}
                </CrossProductLink>
              ) : (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  title={sidebarCollapsed ? item.label : undefined}
                  className={({ isActive }) =>
                    cx(
                      'block rounded-button py-1.5 text-sm transition-colors duration-fast ease-out',
                      sidebarCollapsed ? 'px-1 text-center text-nano leading-tight' : 'px-2.5',
                      isActive
                        ? 'bg-primary-soft font-medium text-primary'
                        : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900',
                    )
                  }
                >
                  {sidebarCollapsed ? item.label.slice(0, 2) : item.label}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
      </aside>

      {/* 主区 */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* 顶栏（PRD §1.3）：门店名纯文本，无跳转 */}
        <header
          data-debug-id="app.layout.topbar"
          className="flex h-14 items-center justify-between gap-2 border-b border-gray-200 bg-white px-3 sm:px-6"
        >
          <span className="min-w-0 truncate text-sm font-medium text-gray-800">
            {session.storeName ?? '未命名门店'}
          </span>
          <div className="flex shrink-0 items-center gap-1 sm:gap-3">
            <LanguageToggle />
            <button
              className="rounded-button p-2 text-gray-500 transition-colors duration-fast hover:bg-gray-100 hover:text-gray-800"
              aria-label={text('通知', 'Notifications')}
            >
              <Bell size={16} />
            </button>
            <span className="hidden text-sm text-gray-700 lg:inline">
              {session.userName ?? text('美甲师', 'Nail artist')}
            </span>
            <button
              onClick={handleLogout}
              aria-label={text('退出', 'Sign out')}
              className="flex items-center gap-1 rounded-button px-2 py-1.5 text-xs text-gray-500 transition-colors duration-fast hover:bg-gray-100 hover:text-gray-800"
            >
              <LogOut size={13} />
              <span className="hidden sm:inline">{text('退出', 'Sign out')}</span>
            </button>
          </div>
        </header>
        <main className="min-w-0 flex-1 p-3 sm:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
