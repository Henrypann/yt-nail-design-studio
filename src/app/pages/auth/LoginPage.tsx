import { Navigate, useNavigate } from 'react-router-dom';
import { useToast } from '@/design-system';
import { Routes } from '@/app/routes';
import { findAccount } from '@/platform/accounts';
import { CodeVerification } from '@/platform/CodeVerification';
import { isLoggedIn, writeSession } from '@/platform/session';
import { useLocale } from '@/lib/i18n';

/**
 * `/login` 登录页：Email + Mock 验证码（PRD §三）。
 * 首次登录 → 自动注册（跳 /register 补门店名）；已有账号 → 直进 Dashboard。
 * 已登录访问 /login → 自动跳 Dashboard。
 */
export default function LoginPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const { t } = useLocale();

  if (isLoggedIn()) {
    return <Navigate to={Routes.studio} replace />;
  }

  const handleVerified = (email: string) => {
    const account = findAccount(email);
    if (account) {
      writeSession({
        storeName: account.storeName,
        userName: account.userName,
        email: account.email,
      });
      toast.success(t('auth.welcomeBack', { storeName: account.storeName }));
      navigate(Routes.studio, { replace: true });
      return;
    }
    // 首次登录 → 自动注册：邮箱已验证，直接进入 Step 2
    toast.info(t('auth.firstLogin'));
    navigate(Routes.register, { state: { email, verified: true } });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas p-6" data-debug-id="app.auth.login">
      <div className="w-full max-w-[400px]">
        <div className="rounded-card border border-gray-200 bg-white p-8 shadow-float animate-fade-in">
          <header className="mb-6">
            <h1 className="text-xl font-bold text-primary">{t('auth.studioTitle')}</h1>
            <p className="mt-1 text-sm text-gray-500">{t('auth.studioDescription')}</p>
          </header>
          <CodeVerification onVerified={handleVerified} verifyLabel={t('auth.loginVerify')} />
          <p className="mt-4 text-center text-xs text-gray-400">
            {t('auth.firstLoginHint')}
          </p>
        </div>
      </div>
    </div>
  );
}
