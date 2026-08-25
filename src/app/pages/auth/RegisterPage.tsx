import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Button, Input, cx } from '@/design-system';
import { useToast } from '@/design-system';
import { Routes } from '@/app/routes';
import { createAccount } from '@/platform/accounts';
import { CodeVerification } from '@/platform/CodeVerification';
import { isLoggedIn, writeSession } from '@/platform/session';
import { useLocale } from '@/lib/i18n';

const STORE_NAME_MIN = 2;
const STORE_NAME_MAX = 30;

interface RegisterLocationState {
  email?: string;
  verified?: boolean;
}

/**
 * `/register` 注册页：两步（PRD §二）。
 * Step 1 验证邮箱（固定码 123456）→ Step 2 门店名称（2-30 字符）→ 完成进入 Dashboard。
 * 从 /login 首次登录流转而来时邮箱已验证，直接落到 Step 2。
 */
export default function RegisterPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const { t } = useLocale();
  const state = (location.state ?? {}) as RegisterLocationState;

  const [step, setStep] = useState<1 | 2>(state.verified && state.email ? 2 : 1);
  const [email, setEmail] = useState(state.email ?? '');
  const [storeName, setStoreName] = useState('');
  const [storeNameError, setStoreNameError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (isLoggedIn()) {
    return <Navigate to={Routes.studio} replace />;
  }

  const handleFinish = () => {
    const name = storeName.trim();
    if (name.length < STORE_NAME_MIN || name.length > STORE_NAME_MAX) {
      setStoreNameError(t('auth.storeNameLength', { min: STORE_NAME_MIN, max: STORE_NAME_MAX }));
      return;
    }
    setSubmitting(true);
    window.setTimeout(() => {
      const account = createAccount({ email, storeName: name });
      writeSession({
        storeName: account.storeName,
        userName: account.userName,
        email: account.email,
      });
      toast.success(t('auth.registrationSuccess'));
      navigate(Routes.studio, { replace: true });
    }, 400);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas p-6" data-debug-id="app.auth.register">
      <div className="w-full max-w-[400px]">
        <div className="rounded-card border border-gray-200 bg-white p-8 shadow-float animate-fade-in">
          <header className="mb-6">
            <h1 className="text-xl font-bold text-primary">{t('auth.registerTitle')}</h1>
            {/* 步骤指示 */}
            <div className="mt-3 flex items-center gap-2 text-xs">
              <span
                className={cx(
                  'flex h-5 w-5 items-center justify-center rounded-full tnum',
                  step === 1 ? 'bg-primary text-primary-foreground' : 'bg-success text-white',
                )}
              >
                1
              </span>
              <span className={step === 1 ? 'font-medium text-gray-800' : 'text-gray-400'}>
                {t('auth.verifyEmail')}
              </span>
              <span className="mx-1 h-px flex-1 bg-gray-200" />
              <span
                className={cx(
                  'flex h-5 w-5 items-center justify-center rounded-full tnum',
                  step === 2 ? 'bg-primary text-primary-foreground' : 'bg-gray-200 text-gray-500',
                )}
              >
                2
              </span>
              <span className={step === 2 ? 'font-medium text-gray-800' : 'text-gray-400'}>
                {t('auth.storeName')}
              </span>
            </div>
          </header>

          {step === 1 ? (
            <CodeVerification
              onVerified={(verifiedEmail) => {
                setEmail(verifiedEmail);
                setStep(2);
              }}
              verifyLabel={t('auth.next')}
            />
          ) : (
            <div className="flex flex-col gap-4 animate-fade-in">
              <Input label={t('auth.email')} value={email} disabled />
              <Input
                label={t('auth.storeName')}
                placeholder={t('auth.storeNamePlaceholder', { min: STORE_NAME_MIN, max: STORE_NAME_MAX })}
                value={storeName}
                maxLength={STORE_NAME_MAX + 10}
                error={storeNameError ?? undefined}
                helper={t('auth.storeNameHelper')}
                autoFocus
                onChange={(e) => {
                  setStoreName(e.target.value);
                  if (storeNameError) setStoreNameError(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleFinish();
                }}
              />
              <div className="flex gap-2">
                {!(state.verified && state.email) && (
                  <Button variant="ghost" onClick={() => setStep(1)} disabled={submitting}>
                    {t('auth.previous')}
                  </Button>
                )}
                <Button onClick={handleFinish} loading={submitting} className="flex-1">
                  {t('auth.completeRegistration')}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
