import { lazy, Suspense } from 'react';
import { BrowserRouter, Route, Routes as RouterRoutes } from 'react-router-dom';
import { ToastProvider } from '@/design-system';
import { LocaleProvider } from '@/lib/i18n';
import { AppLayout } from './layouts/AppLayout';
import { Routes } from './routes';
import DashboardPage from './pages/DashboardPage';
import CustomerListPage from './pages/customers/CustomerListPage';
import CustomerNewPage from './pages/customers/CustomerNewPage';
import CustomerDetailPage from './pages/customers/CustomerDetailPage';
import DesignListPage from './pages/design/DesignListPage';
import WizardPage from './pages/design/WizardPage';
import EditorPage from './pages/design/EditorPage';
import DeviceListPage from './pages/devices/DeviceListPage';
import DeviceBindPage from './pages/devices/DeviceBindPage';
import MobileBindPage from './pages/devices/MobileBindPage';
import LoginPage from './pages/auth/LoginPage';
import RegisterPage from './pages/auth/RegisterPage';
import NotFoundPage from './pages/NotFoundPage';

const DevDebugPanel = import.meta.env.DEV
  ? lazy(() => import('@/lib/debug-panel').then((module) => ({ default: module.DebugPanel })))
  : null;

/** 应用根：路由（PRD §1.4 全 13 条）+ 全局 Toast + 调试面板（仅 DEV，v1.5.1） */
export function App() {
  return (
    <LocaleProvider>
      <ToastProvider>
        <BrowserRouter>
        <RouterRoutes>
          {/* 登录前 */}
          <Route path={Routes.login} element={<LoginPage />} />
          <Route path={Routes.register} element={<RegisterPage />} />
          {/* 手机端辅助配网：跨设备独立页，不带侧栏 */}
          <Route path={Routes.deviceBindMobilePath} element={<MobileBindPage />} />
          {/* 登录后（侧栏 + 顶栏布局） */}
          <Route element={<AppLayout />}>
            <Route path={Routes.dashboard} element={<DashboardPage />} />
            <Route path={Routes.customers} element={<CustomerListPage />} />
            <Route path={Routes.customerNew} element={<CustomerNewPage />} />
            <Route path={Routes.customerDetailPath} element={<CustomerDetailPage />} />
            <Route path={Routes.designs} element={<DesignListPage />} />
            <Route path={Routes.designNew} element={<WizardPage />} />
            <Route path={Routes.designCanvas} element={<EditorPage />} />
            <Route path={Routes.devices} element={<DeviceListPage />} />
            <Route path={Routes.deviceBind} element={<DeviceBindPage />} />
          </Route>
          {/* 404 */}
          <Route path="*" element={<NotFoundPage />} />
        </RouterRoutes>
        {DevDebugPanel && (
          <Suspense fallback={null}>
            <DevDebugPanel />
          </Suspense>
        )}
        </BrowserRouter>
      </ToastProvider>
    </LocaleProvider>
  );
}
