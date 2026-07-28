/**
 * 手机辅助配网页（模块 2 · MOCK IOT）—— `/devices/bind/mobile/:token`
 * 独立于侧栏布局的移动端友好 Mock 页（PRD §1.4 / §4.2）。
 * 两态异常：Token 过期 / Token 重复使用（TTL 自然过期或 Mock 注入面板强制）。
 */

import { useState } from 'react';
import { CheckCircle2, Link2Off, Smartphone } from 'lucide-react';
import { Badge, Button, Card, Input, useToast } from '@/design-system';
import { isScenarioOn, useMockScenarios } from '@/lib/mock-panel';
import { IOT_SCENARIOS } from './iot-mock';
import { consumeMobileToken, isMobileTokenExpired, readMobileToken } from './mobile-tokens';

type ViewState = 'form' | 'submitted' | 'expired' | 'used' | 'invalid';

export function MobileBind({ token }: { token: string }) {
  const toast = useToast();
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
      setInlineError('请输入 WiFi 名称（SSID）');
      return;
    }
    if (!password) {
      setInlineError('请输入 WiFi 密码');
      return;
    }
    setInlineError('');
    consumeMobileToken(token, { ssid: ssid.trim(), password });
    setView('submitted');
    toast.success('已提交。请回到电脑继续配网。');
  };

  return (
    <div className="flex min-h-screen flex-col items-center bg-gray-50 px-4 py-10" data-debug-id="app.devices.mobile-bind">
      {/* 品牌头（移动端极简） */}
      <header className="mb-6 flex flex-col items-center gap-1.5 text-center">
        <span className="flex items-center gap-1.5 text-sm font-bold text-primary">
          <Smartphone size={16} />
          智能美甲 Studio
        </span>
        <span className="text-xs text-gray-500">手机辅助配网</span>
        <Badge variant="warning" className="text-[10px]">MOCK IOT</Badge>
      </header>

      <Card padding="lg" className="w-full max-w-sm animate-fade-in">
        {view === 'form' && (
          <div className="flex flex-col gap-3">
            <div>
              <h1 className="text-sm font-semibold text-gray-900">为设备输入 WiFi</h1>
              <p className="mt-0.5 text-xs text-gray-500">
                设备 <span className="font-medium tnum">{deviceCode}</span> 将使用该网络联网。
              </p>
            </div>
            <Input
              label="WiFi 名称（SSID）"
              value={ssid}
              onChange={(e) => setSsid(e.target.value)}
              placeholder="例如：NailStudio-5G"
              autoComplete="off"
              className="h-11"
            />
            <Input
              label="WiFi 密码"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="请输入 WiFi 密码"
              helper="密码仅用于本次配网，不会被保存。"
              autoComplete="new-password"
              className="h-11"
            />
            {inlineError && <p className="text-xs text-error">{inlineError}</p>}
            <Button className="mt-1 h-11 w-full" onClick={submit}>
              提交并继续配网
            </Button>
          </div>
        )}

        {view === 'submitted' && (
          <div className="flex flex-col items-center gap-2 py-6 text-center">
            <CheckCircle2 size={36} className="text-success" />
            <p className="text-sm font-semibold text-gray-900">WiFi 已提交</p>
            <p className="text-xs text-gray-500">此链接已失效。请回到电脑继续配网。</p>
          </div>
        )}

        {view === 'expired' && (
          <StateBlock text="链接已过期。请重新发起手机辅助配网。" />
        )}
        {view === 'used' && <StateBlock text="此链接已被使用。请重新发起。" />}
        {view === 'invalid' && (
          <StateBlock text="链接无效。请确认已在电脑上发起手机辅助配网，并使用最新链接。" />
        )}
      </Card>

      <p className="mt-6 max-w-xs text-center text-[11px] leading-relaxed text-gray-400">
        本页面为手机交接流程的 Mock 辅助页，不与真实设备通信。
      </p>
    </div>
  );
}

function StateBlock({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-center gap-2 py-6 text-center">
      <Link2Off size={32} className="text-gray-300" />
      <p className="text-sm font-medium text-gray-900">{text}</p>
      <p className="text-xs text-gray-500">请在电脑上重新选择「手机辅助配网」获取新链接。</p>
    </div>
  );
}
