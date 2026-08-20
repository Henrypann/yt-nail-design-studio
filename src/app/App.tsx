import { lazy, Suspense } from 'react';
import {
  createBrowserRouter,
  createRoutesFromElements,
  Navigate,
  Outlet,
  Route,
  RouterProvider,
  useLocation,
} from 'react-router-dom';
import { ToastProvider } from '@/design-system';
import { LocaleProvider } from '@/lib/i18n';
import { StudioLayout } from './layouts/StudioLayout';
import { CommunityLayout } from './layouts/CommunityLayout';
import { LegacyRoutes, legacyCommunityPathTarget, legacyStudioPathTarget, Routes } from './routes';
import DashboardPage from './pages/DashboardPage';
import StudioHomePage from './pages/StudioHomePage';
import CustomerListPage from './pages/customers/CustomerListPage';
import CustomerNewPage from './pages/customers/CustomerNewPage';
import CustomerDetailPage from './pages/customers/CustomerDetailPage';
import DesignListPage from './pages/design/DesignListPage';
import VersionedImportPage from './pages/design/VersionedImportPage';
import CommunityPage from './pages/design/CommunityPage';
import EditorPage from './pages/design/EditorPage';
import CustomerPreviewPageV7 from './pages/design/CustomerPreviewPageV7';
import DeviceListPage from './pages/devices/DeviceListPage';
import DeviceBindPage from './pages/devices/DeviceBindPage';
import MobileBindPage from './pages/devices/MobileBindPage';
import LoginPage from './pages/auth/LoginPage';
import RegisterPage from './pages/auth/RegisterPage';
import NotFoundPage from './pages/NotFoundPage';
import PetalVeilFixturePage from '@/studio/petal-veil/PetalVeilFixturePage';
import CommunityDiscoverPage from '@/community/pages/CommunityDiscoverPage';
import CommunitySearchPage from '@/community/pages/CommunitySearchPage';
import CommunityOfficialPage from '@/community/pages/CommunityOfficialPage';
import CommunityCreatorsPage from '@/community/pages/CommunityCreatorsPage';
import CreatorWorkspacePage from '@/community/pages/CreatorWorkspacePage';
import ClientSharePage from '@/community/pages/ClientSharePage';
import GovernanceWorkspacePage from '@/community/pages/GovernanceWorkspacePage';
import CommunityLookPage from '@/community/pages/CommunityLookPage';
import CommunityLegacyContentRedirect from '@/community/pages/CommunityLegacyContentRedirect';
import CommunityProfilePage from '@/community/pages/CommunityProfilePage';
import CommunityBoardsPage from '@/community/pages/CommunityBoardsPage';
import CommunityBoardPage from '@/community/pages/CommunityBoardPage';
import CommunityBoardSharePage from '@/community/pages/CommunityBoardSharePage';
import { HardwareRegistrationGate } from './guards/HardwareRegistrationGate';
import { buildOfficialTemplateRedirect } from './routing/official-template-redirect';

const DevDebugPanel = import.meta.env.DEV
  ? lazy(() => import('@/lib/debug-panel').then((module) => ({ default: module.DebugPanel })))
  : null;
const SurfaceBooleanDevPage = import.meta.env.DEV
  ? lazy(() => import('@/studio/geometry/v0-7-2/SurfaceBooleanDevPage'))
  : null;
const LazyWizardPage = lazy(() => import('./pages/design/WizardPage'));

function RouterChrome() {
  const location = useLocation();
  const internalFixture = location.pathname === '/internal/petal-veil-fixture'
    || location.pathname === '/internal/surface-boolean-v072';
  const immersiveEditor = location.pathname === Routes.designCanvas || location.pathname === Routes.designCustomerPreview;
  return (
    <>
      <Outlet />
      {DevDebugPanel && !internalFixture && !immersiveEditor && (
        <Suspense fallback={null}>
          <DevDebugPanel />
        </Suspense>
      )}
    </>
  );
}

function LegacyProductPathRedirect({ surface }: { surface: 'community' | 'studio' }) {
  const location = useLocation();
  const pathname = surface === 'community'
    ? legacyCommunityPathTarget(location.pathname)
    : legacyStudioPathTarget(location.pathname);
  return <Navigate replace to={`${pathname}${location.search}${location.hash}`} />;
}

/**
 * Keep the historical versioned-intent URL explainable without mounting the
 * Wizard. The redirect is evaluated by the route element before WizardPage is
 * rendered, so the Wizard store/draft recovery effects never run.
 */
function DesignNewRoute() {
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  if (params.has('versionedIntent')) {
    return <Navigate replace to={`${Routes.designImport}${location.search}${location.hash}`} />;
  }
  return <Suspense fallback={<div className="p-6 text-sm text-gray-500">正在打开快速建稿…</div>}><LazyWizardPage /></Suspense>;
}

function OfficialTemplatesRedirect() {
  const location = useLocation();
  return <Navigate replace to={buildOfficialTemplateRedirect(location.search, location.hash)} />;
}

const router = createBrowserRouter(createRoutesFromElements(
  <Route element={<RouterChrome />}>
    {/* 登录前 */}
    <Route path={Routes.login} element={<LoginPage />} />
    <Route path={Routes.register} element={<RegisterPage />} />
    {/* 手机端辅助配网：跨设备独立页，不带侧栏 */}
    <Route path={Routes.deviceBindMobilePath} element={<MobileBindPage />} />
    <Route path="/internal/petal-veil-fixture" element={<PetalVeilFixturePage />} />
    {SurfaceBooleanDevPage && (
      <Route path="/internal/surface-boolean-v072" element={<Suspense fallback={null}><SurfaceBooleanDevPage /></Suspense>} />
    )}
    {/* Nail Lover Community：全局默认产品与首页，无 Studio 侧栏。 */}
    <Route element={<CommunityLayout />}>
      <Route path={Routes.community} element={<CommunityDiscoverPage />} />
      <Route path={Routes.communitySearch} element={<CommunitySearchPage />} />
      <Route path={Routes.communityOfficial} element={<CommunityOfficialPage />} />
      <Route path={Routes.communityCreators} element={<CommunityCreatorsPage />} />
      <Route path={Routes.communityCreatorWorkspace} element={<CreatorWorkspacePage />} />
      <Route path={Routes.communityClientSharePath} element={<ClientSharePage />} />
      <Route path={Routes.communityGovernance} element={<GovernanceWorkspacePage />} />
      <Route path={Routes.communityLookPath} element={<CommunityLookPage />} />
      {/* Nail Board（COMM-V7.1-03）：owner 管理 + token 只读分享（同一 Community 壳） */}
      <Route path={Routes.communityBoards} element={<CommunityBoardsPage />} />
      <Route path={Routes.communityBoardDetailPath} element={<CommunityBoardPage />} />
      <Route path={Routes.communityBoardSharePath} element={<CommunityBoardSharePage />} />
      {/* legacy 深链：replace 重定向到 canonical look 路由 */}
      <Route path={Routes.communityContentPath} element={<CommunityLegacyContentRedirect />} />
      <Route path={Routes.communityProfilePath} element={<CommunityProfilePage />} />
    </Route>
    {/* 历史 Community 深链保留，统一 replace 到无 /community 前缀的公共产品 URL。 */}
    <Route path={LegacyRoutes.communityContentPath} element={<CommunityLegacyContentRedirect />} />
    <Route path={LegacyRoutes.communityWildcard} element={<LegacyProductPathRedirect surface="community" />} />
    {/* Editor 使用独立沉浸式工作区；返回入口与安全离开由 EditorShell 负责。 */}
    <Route path={Routes.designCanvas} element={<EditorPage />} />
    <Route path={Routes.designCustomerPreview} element={<CustomerPreviewPageV7 />} />
    {/* Nail Design Studio 独立工具产品（侧栏 + 顶栏布局）。 */}
    <Route element={<StudioLayout />}>
      <Route path={Routes.studioHome} element={<StudioHomePage />} />
      <Route path={Routes.designs} element={<DesignListPage />} />
      <Route path={Routes.designNew} element={<DesignNewRoute />} />
      <Route path={Routes.designImport} element={<VersionedImportPage />} />
      <Route path={Routes.designTemplates} element={<OfficialTemplatesRedirect />} />
      <Route path={Routes.designCommunity} element={<CommunityPage />} />
      {/* 首次硬件注册始终可进入；客户/门店 Dashboard/设备列表由注册状态统一解锁。 */}
      <Route path={Routes.deviceBind} element={<DeviceBindPage />} />
      <Route element={<HardwareRegistrationGate />}>
        <Route path={Routes.dashboard} element={<DashboardPage />} />
        <Route path={Routes.customers} element={<CustomerListPage />} />
        <Route path={Routes.customerNew} element={<CustomerNewPage />} />
        <Route path={Routes.customerDetailPath} element={<CustomerDetailPage />} />
        <Route path={Routes.devices} element={<DeviceListPage />} />
      </Route>
    </Route>
    {/* 历史 Studio 深链：保留 query/hash，迁入 /studio namespace。 */}
    <Route path={LegacyRoutes.designCommunity} element={<Navigate replace to={Routes.communityOfficial} />} />
    <Route path={LegacyRoutes.designWildcard} element={<LegacyProductPathRedirect surface="studio" />} />
    <Route path={LegacyRoutes.customersWildcard} element={<LegacyProductPathRedirect surface="studio" />} />
    <Route path={LegacyRoutes.devicesWildcard} element={<LegacyProductPathRedirect surface="studio" />} />
    {/* 404 */}
    <Route path="*" element={<NotFoundPage />} />
  </Route>,
));

/** 应用根：路由（PRD §1.4 + Community 独立域）+ 全局 Toast + 调试面板（仅 DEV） */
export function App() {
  return (
    <LocaleProvider>
      <ToastProvider>
        <RouterProvider router={router} />
      </ToastProvider>
    </LocaleProvider>
  );
}
