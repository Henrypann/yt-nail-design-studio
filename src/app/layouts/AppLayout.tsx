import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Bell, Home, Users, Palette, Monitor, LogOut, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { useState } from 'react';
import { cx } from '@/design-system';
import { readData, removeKey, writeEnvelope, StorageKeys } from '@/lib/storage';

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
}
interface NavGroup {
  key: string;
  label: string;
  icon: typeof Home;
  items: NavItem[];
}

/** 侧栏结构（PRD §1.2）：首页 / 客户管理 / 设计工作台 / 设备管理，无门店设置组 */
const NAV_GROUPS: NavGroup[] = [
  {
    key: 'home',
    label: '首页',
    icon: Home,
    items: [{ to: '/', label: 'Dashboard', end: true }],
  },
  {
    key: 'customers',
    label: '客户管理',
    icon: Users,
    items: [
      { to: '/customers', label: '客户列表', end: true },
      { to: '/customers/new', label: '新建客户' },
    ],
  },
  {
    key: 'studio',
    label: '设计工作台',
    icon: Palette,
    items: [
      { to: '/design/new', label: '新建设计' },
      { to: '/design', label: '我的设计', end: true },
    ],
  },
  {
    key: 'devices',
    label: '设备管理',
    icon: Monitor,
    items: [
      { to: '/devices/bind', label: '设备绑定' },
      { to: '/devices', label: '我的设备', end: true },
    ],
  },
];

/** 登录后全局布局：侧栏 + 顶栏（门店名纯文本 / 通知 / 用户名 / 退出）
 *  v1.5.1：侧栏支持收起/展开（持久化 localStorage，收起后仅图标 + tooltip） */
export function AppLayout() {
  const navigate = useNavigate();
  const session = readData<SessionInfo>(StorageKeys.session) ?? {};
  const [collapsed, setCollapsed] = useState(
    () => readData<{ collapsed: boolean }>(StorageKeys.sidebarCollapsed)?.collapsed ?? false,
  );

  const toggleCollapsed = () => {
    const next = !collapsed;
    writeEnvelope(StorageKeys.sidebarCollapsed, { collapsed: next });
    setCollapsed(next);
  };

  const handleLogout = () => {
    removeKey(StorageKeys.session);
    navigate('/login', { replace: true });
  };

  return (
    <div className="flex min-h-screen">
      {/* 侧栏（展开 240px / 收起 56px） */}
      <aside
        data-debug-id="app.layout.sidebar"
        className={cx(
          'flex shrink-0 flex-col border-r border-gray-200 bg-white transition-[width] duration-normal ease-out',
          collapsed ? 'w-14' : 'w-60',
        )}
      >
        <div
          className={cx(
            'flex h-14 items-center border-b border-gray-200',
            collapsed ? 'justify-center px-2' : 'justify-between px-4',
          )}
        >
          {!collapsed && <span className="text-sm font-bold text-primary">智能美甲 Studio</span>}
          <button
            onClick={toggleCollapsed}
            title={collapsed ? '展开导航' : '收起导航'}
            aria-label={collapsed ? '展开导航' : '收起导航'}
            className="rounded-button p-1.5 text-gray-400 transition-colors duration-fast hover:bg-gray-100 hover:text-gray-700"
          >
            {collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
          </button>
        </div>
        <nav className={cx('flex-1 overflow-y-auto py-4', collapsed ? 'px-2' : 'px-3')}>
          {NAV_GROUPS.map((group) => (
            <div key={group.key} className="mb-4">
              {collapsed ? (
                <p className="mb-1 flex justify-center text-gray-300" title={group.label}>
                  <group.icon size={14} />
                </p>
              ) : (
                <p className="mb-1 flex items-center gap-1.5 px-2 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                  <group.icon size={12} />
                  {group.label}
                </p>
              )}
              {group.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  title={collapsed ? item.label : undefined}
                  className={({ isActive }) =>
                    cx(
                      'block rounded-button py-1.5 text-sm transition-colors duration-fast ease-out',
                      collapsed ? 'px-1 text-center text-[11px] leading-tight' : 'px-2.5',
                      isActive
                        ? 'bg-primary-soft font-medium text-primary'
                        : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900',
                    )
                  }
                >
                  {collapsed ? item.label.slice(0, 2) : item.label}
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
          className="flex h-14 items-center justify-between border-b border-gray-200 bg-white px-6"
        >
          <span className="text-sm font-medium text-gray-800">
            {session.storeName ?? '未命名门店'}
          </span>
          <div className="flex items-center gap-3">
            <button
              className="rounded-button p-2 text-gray-500 transition-colors duration-fast hover:bg-gray-100 hover:text-gray-800"
              aria-label="通知"
            >
              <Bell size={16} />
            </button>
            <span className="text-sm text-gray-700">{session.userName ?? '美甲师'}</span>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1 rounded-button px-2 py-1.5 text-xs text-gray-500 transition-colors duration-fast hover:bg-gray-100 hover:text-gray-800"
            >
              <LogOut size={13} />
              退出
            </button>
          </div>
        </header>
        <main className="min-w-0 flex-1 p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
