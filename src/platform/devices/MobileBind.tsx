/**
 * 手机辅助配网页（模块 2 · MOCK IOT）—— `/devices/bind/mobile/:token`
 * 独立于侧栏布局的移动端友好 Mock 页（PRD §1.4 / §4.2）。
 * 两态异常：Token 过期 / Token 重复使用（TTL 自然过期或 Mock 注入面板强制）。
 */

import { useState } from 'react';
import { CheckCircle2, Link2Off, Smartphone } from 'lucide-react';
import { Badge, Button, Card, Input, useToast } from '@/design-system';
import { isScenarioOn, useMockScenarios } from '@/lib/mock-panel';
import { useLocale } from '@/lib/i18n';
import { IOT_SCENARIOS } from './iot-mock';
import { consumeMobileToken, isMobileTokenExpired, readMobileToken } from './mobile-tokens';

type ViewState = 'form' | 'submitted' | 'expired' | 'used' | 'invalid';

export function MobileBind({ token }: { token: string }) {
  const toast = useToast();
  const { t } = useLocale();
  const flags = useMockScenarios((s) => s.flags);

  const [view, setView] = useState<ViewState>(() => {
    if (isScenarioOn(flags, IOT_SCENARIOS.tokenExpired)) return 'expired';
    if (isScenarioOn(flags, IOT_SCENARIOS.tokenReused)) return 'used';
    const record = readMobileToken(token);
    if (!record) return 'invalid';
    if (record.used) return 'used';
    if (isMobileTokenExpired(record)) return 'expired';
    return 'form';
  });
  const [ssid, setSsid] = useState('');
  const [password, setPassword] = useState('');
  const [inlineError, setInlineError] = useState('');

  const deviceCode = readMobileToken(token)?.deviceCode ?? '';

  const submit = () => {
    if (!ssid.trim()) {
      setInlineError(t('device.wifiName'));
      return;
    }
    if (!password) {
      setInlineError(t('device.wifiPassword'));
      return;
    }
    setInlineError('');
    consumeMobileToken(token, { ssid: ssid.trim(), password });
    setView('submitted');
    toast.success(t('device.submitted'));
  };

  return (
    <div className="flex min-h-screen flex-col items-center bg-gray-50 px-4 py-10" data-debug-id="app.devices.mobile-bind">
      {/* 品牌头（移动端极简） */}
      <header className="mb-6 flex flex-col items-center gap-1.5 text-center">
        <span className="flex items-center gap-1.5 text-sm font-bold text-primary">
          <Smartphone size={16} />
          {t('auth.studioTitle')}
        </span>
        <span className="text-xs text-gray-500">{t('device.mobileBindTitle')}</span>
        <Badge variant="warning" className="text-[10px]">MOCK IOT</Badge>
      </header>

      <Card padding="lg" className="w-full max-w-sm animate-fade-in">
        {view === 'form' && (
          <div className="flex flex-col gap-3">
            <div>
              <h1 className="text-sm font-semibold text-gray-900">{t('device.mobileWifiTitle')}</h1>
              <p className="mt-0.5 text-xs text-gray-500">
                {t('device.mobileDeviceNetwork', { deviceCode })}
              </p>
            </div>
            <Input
              label={t('device.wifiName')}
              value={ssid}
              onChange={(e) => setSsid(e.target.value)}
              placeholder={t('device.wifiNamePlaceholder')}
              autoComplete="off"
              className="h-11"
            />
            <Input
              label={t('device.wifiPassword')}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t('device.wifiPasswordPlaceholder')}
              helper={t('device.wifiHelper')}
              autoComplete="new-password"
              className="h-11"
            />
            {inlineError && <p className="text-xs text-error">{inlineError}</p>}
            <Button className="mt-1 h-11 w-full" onClick={submit}>
              {t('device.submitContinue')}
            </Button>
          </div>
        )}

        {view === 'submitted' && (
          <div className="flex flex-col items-center gap-2 py-6 text-center">
            <CheckCircle2 size={36} className="text-success" />
            <p className="text-sm font-semibold text-gray-900">{t('device.submitted')}</p>
            <p className="text-xs text-gray-500">{t('device.linkInvalidated')}</p>
          </div>
        )}

        {view === 'expired' && (
          <StateBlock text={t('device.linkExpired')} />
        )}
        {view === 'used' && <StateBlock text={t('device.linkUsed')} />}
        {view === 'invalid' && (
          <StateBlock text={t('device.linkInvalid')} />
        )}
      </Card>

      <p className="mt-6 max-w-xs text-center text-[11px] leading-relaxed text-gray-400">
        {t('device.mobileHandoffMock')}
      </p>
    </div>
  );
}

function StateBlock({ text }: { text: string }) {
  const { t } = useLocale();
  return (
    <div className="flex flex-col items-center gap-2 py-6 text-center">
      <Link2Off size={32} className="text-gray-300" />
      <p className="text-sm font-medium text-gray-900">{text}</p>
      <p className="text-xs text-gray-500">{t('device.mobileRestart')}</p>
    </div>
  );
}
