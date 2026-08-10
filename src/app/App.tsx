import { lazy, Suspense } from 'react';
import {
  createBrowserRouter,
  createRoutesFromElements,
  Outlet,
  Route,
  RouterProvider,
  useLocation,
} from 'react-router-dom';
import { ToastProvider } from '@/design-system';
import { LocaleProvider } from '@/lib/i18n';
import { AppLayout } from './layouts/AppLayout';
import { CommunityLayout } from './layouts/CommunityLayout';
import { Routes } from './routes';
import DashboardPage from './pages/DashboardPage';
import CustomerListPage from './pages/customers/CustomerListPage';
import CustomerNewPage from './pages/customers/CustomerNewPage';
import CustomerDetailPage from './pages/customers/CustomerDetailPage';
import DesignListPage from './pages/design/DesignListPage';
import WizardPage from './pages/design/WizardPage';
import TemplateGalleryPage from './pages/design/TemplateGalleryPage';
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
import CommunityOfficialPage from '@/community/pages/CommunityOfficialPage';
import CommunityCreatorsPage from '@/community/pages/CommunityCreatorsPage';
import CommunityContentPage from '@/community/pages/CommunityContentPage';
import CommunityProfilePage from '@/community/pages/CommunityProfilePage';

const DevDebugPanel = import.meta.env.DEV
  ? lazy(() => import('@/lib/debug-panel').then((module) => ({ default: module.DebugPanel })))
  : null;

function RouterChrome() {
  const location = useLocation();
  const internalFixture = location.pathname === '/internal/petal-veil-fixture';
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

const router = createBrowserRouter(createRoutesFromElements(
  <Route element={<RouterChrome />}>
    {/* 登录前 */}
    <Route path={Routes.login} element={<LoginPage />} />
    <Route path={Routes.register} element={<RegisterPage />} />
    {/* 手机端辅助配网：跨设备独立页，不带侧栏 */}
    <Route path={Routes.deviceBindMobilePath} element={<MobileBindPage />} />
    <Route path="/internal/petal-veil-fixture" element={<PetalVeilFixturePage />} />
    {/* Community 独立产品壳（无 Studio 侧栏） */}
    <Route element={<CommunityLayout />}>
      <Route path={Routes.community} element={<CommunityDiscoverPage />} />
      <Route path={Routes.communityOfficial} element={<CommunityOfficialPage />} />
      <Route path={Routes.communityCreators} element={<CommunityCreatorsPage />} />
      <Route path={Routes.communityContentPath} element={<CommunityContentPage />} />
      <Route path={Routes.communityProfilePath} element={<CommunityProfilePage />} />
    </Route>
    {/* Editor 使用独立沉浸式工作区；返回入口与安全离开由 EditorShell 负责。 */}
    <Route path={Routes.designCanvas} element={<EditorPage />} />
    <Route path={Routes.designCustomerPreview} element={<CustomerPreviewPageV7 />} />
    {/* 登录后（侧栏 + 顶栏布局） */}
    <Route element={<AppLayout />}>
      <Route path={Routes.dashboard} element={<DashboardPage />} />
      <Route path={Routes.customers} element={<CustomerListPage />} />
      <Route path={Routes.customerNew} element={<CustomerNewPage />} />
      <Route path={Routes.customerDetailPath} element={<CustomerDetailPage />} />
      <Route path={Routes.designs} element={<DesignListPage />} />
      <Route path={Routes.designNew} element={<WizardPage />} />
      <Route path={Routes.designTemplates} element={<TemplateGalleryPage />} />
      <Route path={Routes.designCommunity} element={<CommunityPage />} />
      <Route path={Routes.devices} element={<DeviceListPage />} />
      <Route path={Routes.deviceBind} element={<DeviceBindPage />} />
    </Route>
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
