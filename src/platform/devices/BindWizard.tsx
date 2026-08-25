/**
 * 设备配网向导（模块 2 · MOCK IOT）—— Studio-PRD §4.3 六步：
 * Step1 选择路径 → Step2 发现设备（15s 超时模拟）→ Step3 输入 WiFi（密码不持久化）
 * → Step4 配网中（0→100% 约 3-5s）→ Step5 命名设备 → Step6 绑定完成。
 *
 * 异常场景全部由 Mock 注入面板驱动（PRD §4.5）：
 * 发现超时 / WiFi 密码错误 / 入网超时 30s / 已被其他门店绑定 /
 * Token 过期 / 并发绑定；页面刷新 5 分钟 TTL 内恢复进度，超时回到步骤 1。
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bluetooth,
  Check,
  CheckCircle2,
  Copy,
  Loader2,
  Radar,
  Smartphone,
  Usb,
  Wifi,
} from 'lucide-react';
import { Badge, Button, Card, Input, Modal, Spinner, cx, useToast } from '@/design-system';
import { isScenarioOn, useMockScenarios } from '@/lib/mock-panel';
import { useLocale } from '@/lib/i18n';
import { Routes } from '@/app/routes';
import {
  acquireBindLock,
  clearBindSession,
  loadBindSession,
  releaseBindLock,
  saveBindSession,
} from './bind-session';
import { createBoundDevice, useDevicesStore } from './device-store';
import {
  BIND_PATH_LABEL,
  DEVICE_TYPE_LABEL,
  IOT_SCENARIOS,
  IOT_TIMINGS,
  mockDiscoverDevice,
  mockMobileToken,
  randomProvisionMs,
} from './iot-mock';
import {
  isMobileTokenExpired,
  issueMobileToken,
  readMobileToken,
} from './mobile-tokens';
import type { BindPath, BindStep, DiscoveredDevice } from './types';

type ErrorKind =
  | 'discoverTimeout'
  | 'wifiWrong'
  | 'joinTimeout'
  | 'alreadyBound'
  | 'concurrent'
  | 'tokenExpired';

const STEP_LABEL_KEYS = ['device.choosePath', 'device.discovered', 'device.wifiPassword', 'device.provisioning', 'device.deviceAlias', 'device.bindSuccess'] as const;

const PATH_CARDS: { path: BindPath; icon: typeof Bluetooth; titleKey: 'device.bluetoothPath' | 'device.mobilePath' | 'device.usbPath' | 'device.lanPath'; descKey: 'device.bluetoothPathHint' | 'device.mobilePathHint' | 'device.usbPathHint' | 'device.lanPathHint' }[] = [
  { path: 'bluetooth', icon: Bluetooth, titleKey: 'device.bluetoothPath', descKey: 'device.bluetoothPathHint' },
  { path: 'mobile', icon: Smartphone, titleKey: 'device.mobilePath', descKey: 'device.mobilePathHint' },
  { path: 'usb', icon: Usb, titleKey: 'device.usbPath', descKey: 'device.usbPathHint' },
  { path: 'lan', icon: Radar, titleKey: 'device.lanPath', descKey: 'device.lanPathHint' },
];

export function BindWizard() {
  const navigate = useNavigate();
  const toast = useToast();
  const { t } = useLocale();
  const flags = useMockScenarios((s) => s.flags);
  const addDevice = useDevicesStore((s) => s.addDevice);
  const deviceCount = useDevicesStore((s) => s.devices.length);

  const [restored] = useState(() => loadBindSession());
  const [step, setStep] = useState<BindStep>(() => {
    if (!restored) return 1;
    return restored.step === 4 ? 3 : restored.step; // 配网中被刷新 → 回到输入 WiFi
  });
  const [path, setPath] = useState<BindPath | null>(restored?.path ?? null);
  const [device, setDevice] = useState<DiscoveredDevice | null>(restored?.device ?? null);
  const [ssid, setSsid] = useState(restored?.wifiSsid ?? '');
  const [password, setPassword] = useState(''); // 红线：type=password，不持久化
  const [alias, setAlias] = useState(restored?.alias ?? '');
  const [mobileToken, setMobileToken] = useState(restored?.mobileToken ?? '');
  const [useLocalWifi, setUseLocalWifi] = useState(false); // 手机路径改用电脑输入
  const [error, setError] = useState<ErrorKind | null>(null);
  const [progress, setProgress] = useState(0);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [provisionNonce, setProvisionNonce] = useState(0);
  const [inlineError, setInlineError] = useState('');

  const flagsRef = useRef(flags);
  flagsRef.current = flags;

  /* 刷新恢复提示（5 分钟 TTL 内） */
  useEffect(() => {
    if (restored) toast.info(t('device.resume'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* 会话持久化：步骤/路径/设备/SSID/别名/Token（密码永不写入） */
  useEffect(() => {
    if (step === 6) return; // 完成态由 finalize 清除会话
    saveBindSession({ step, path, device, wifiSsid: ssid, mobileToken, alias });
  }, [step, path, device, ssid, mobileToken, alias]);

  /* Step 2 · 发现设备：正常 ~2.6s；Mock 发现超时时 15s 后报错 */
  useEffect(() => {
    if (step !== 2 || !path || error === 'discoverTimeout') return;
    if (isScenarioOn(flagsRef.current, IOT_SCENARIOS.discoverTimeout)) {
      const t = window.setTimeout(
        () => setError('discoverTimeout'),
        IOT_TIMINGS.discoveryTimeoutMs,
      );
      return () => window.clearTimeout(t);
    }
    const t = window.setTimeout(() => {
      setDevice(mockDiscoverDevice(path));
      setStep(3);
    }, IOT_TIMINGS.discoveryScanMs);
    return () => window.clearTimeout(t);
  }, [step, path, error]);

  /* Step 3 · 手机辅助路径：发放 Token + 2s 轮询手机端提交 */
  useEffect(() => {
    if (step !== 3 || path !== 'mobile' || useLocalWifi || !device || error) return;
    const token = mobileToken || mockMobileToken();
    issueMobileToken(token, device.deviceCode);
    if (token !== mobileToken) setMobileToken(token);
    const timer = window.setInterval(() => {
      const record = readMobileToken(token);
      if (!record) return;
      if (record.used && record.wifi) {
        setSsid(record.wifi.ssid);
        setPassword(record.wifi.password);
        window.clearInterval(timer);
        startProvisioningRef.current(record.wifi.ssid, record.wifi.password);
        return;
      }
      if (
        isScenarioOn(flagsRef.current, IOT_SCENARIOS.tokenExpired) ||
        isMobileTokenExpired(record)
      ) {
        window.clearInterval(timer);
        setError('tokenExpired');
      }
    }, 2000);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, path, useLocalWifi, device, mobileToken, error]);

  /* Step 4 · 配网中：进度 0→100%（3-5s）；Mock 注入 WiFi 密码错误 / 入网超时 30s */
  useEffect(() => {
    if (step !== 4 || error) return;
    if (isScenarioOn(flagsRef.current, IOT_SCENARIOS.bindTimeout)) {
      // 入网超时（PRD：30s）：进度缓慢推进，倒计时结束后报错
      const startedAt = Date.now();
      const timer = window.setInterval(() => {
        const elapsed = Date.now() - startedAt;
        setProgress(Math.min(92, Math.round((elapsed / IOT_TIMINGS.joinTimeoutMs) * 100)));
        if (elapsed >= IOT_TIMINGS.joinTimeoutMs) {
          window.clearInterval(timer);
          setError('joinTimeout');
        }
      }, 200);
      return () => window.clearInterval(timer);
    }
    const duration = randomProvisionMs();
    const startedAt = Date.now();
    const timer = window.setInterval(() => {
      const elapsed = Date.now() - startedAt;
      const pct = Math.min(100, Math.round((elapsed / duration) * 100));
      setProgress(pct);
      if (isScenarioOn(flagsRef.current, IOT_SCENARIOS.wifiWrong) && pct >= 60) {
        window.clearInterval(timer);
        setPassword(''); // 密码错误 → 清空重输
        setUseLocalWifi(path === 'mobile' ? true : false);
        setError('wifiWrong');
        return;
      }
      if (pct >= 100) {
        window.clearInterval(timer);
        setError(null);
        setStep(5);
      }
    }, 100);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, error, provisionNonce]);

  /** 校验 + 获取并发绑定锁 → 进入 Step 4 */
  const startProvisioning = useCallback(
    (nextSsid: string, nextPassword: string) => {
      if (!device) return;
      if (!nextSsid.trim()) {
        setInlineError(t('device.wifiName'));
        return;
      }
      if (!nextPassword) {
        setInlineError(t('device.wifiPassword'));
        return;
      }
      setInlineError('');
      // 并发绑定：Mock 开关强制触发，或同 deviceCode 已被其他标签页锁定
      if (
        isScenarioOn(flagsRef.current, IOT_SCENARIOS.concurrentBind) ||
        !acquireBindLock(device.deviceCode)
      ) {
        setError('concurrent');
      toast.warning(t('device.concurrent'));
        return;
      }
      setError(null);
      setProgress(0);
      setStep(4);
    },
    [device, toast],
  );
  const startProvisioningRef = useRef(startProvisioning);
  startProvisioningRef.current = startProvisioning;

  /** Step 5 · 完成绑定 */
  const finalizeBind = () => {
    if (!device) return;
    if (isScenarioOn(flags, IOT_SCENARIOS.alreadyBound)) {
      setError('alreadyBound');
      return;
    }
    const finalAlias =
      alias.trim() || `${DEVICE_TYPE_LABEL[device.type]}-${String(deviceCount + 1).padStart(2, '0')}`;
    addDevice(createBoundDevice({ alias: finalAlias, type: device.type, deviceCode: device.deviceCode }));
    clearBindSession();
    releaseBindLock();
    setAlias(finalAlias);
    setError(null);
    setStep(6);
    toast.success(t('device.boundAlias', { alias: finalAlias }));
  };

  /** 取消配网（二次确认后） */
  const confirmCancel = () => {
    clearBindSession();
    releaseBindLock();
    setCancelOpen(false);
    navigate(Routes.devices);
  };

  const goBack = () => {
    setError(null);
    setInlineError('');
    if (step === 2) setStep(1);
    else if (step === 3) {
      setDevice(null);
      setStep(2);
    } else if (step === 4) setStep(3);
    else if (step === 5) setStep(3);
  };

  const retryError = () => {
    if (error === 'discoverTimeout') {
      setError(null);
      setStep(2); // effect 重新发现
      return;
    }
    if (error === 'wifiWrong') {
      setError(null);
      setStep(3);
      return;
    }
    if (error === 'joinTimeout') {
      setError(null);
      setProgress(0);
      setProvisionNonce((n) => n + 1); // 重启 Step 4
      return;
    }
    if (error === 'concurrent') {
      setError(null);
      startProvisioning(ssid, password);
      return;
    }
    if (error === 'tokenExpired') {
      setError(null);
      setMobileToken(''); // 重新生成链接
    }
  };

  const mobileUrl = mobileToken
    ? `${window.location.origin}${Routes.deviceBindMobile(mobileToken)}`
    : '';

  const copyMobileUrl = async () => {
    try {
      await navigator.clipboard.writeText(mobileUrl);
      toast.info(t('device.linkCopied'));
    } catch {
      toast.warning(t('toast.copyFailed'));
    }
  };

  /* ── 渲染 ───────────────────────────────────────────── */

  return (
    <div className="flex flex-col gap-4" data-debug-id="app.devices.bind-wizard">
      <header className="flex items-center gap-2">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">{t('device.wizardTitle')}</h1>
          <p className="mt-0.5 text-xs text-gray-500">
            {t('device.wizardSubtitle')}
          </p>
        </div>
        <Badge variant="warning" className="ml-1">MOCK IOT</Badge>
      </header>

      {/* 步骤条 */}
      <ol className="flex items-center gap-1">
        {STEP_LABEL_KEYS.map((key, i) => { const label = t(key);
          const n = (i + 1) as BindStep;
          const done = n < step;
          const current = n === step;
          return (
            <li key={label} className="flex min-w-0 flex-1 items-center gap-1">
              <span
                className={cx(
                  'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold',
                  'transition-colors duration-fast',
                  done && 'bg-primary text-primary-foreground',
                  current && 'border-2 border-primary bg-primary-soft text-primary',
                  !done && !current && 'bg-gray-100 text-gray-400',
                )}
              >
                {done ? <Check size={12} /> : n}
              </span>
              <span
                className={cx(
                  'truncate text-xs',
                  current ? 'font-medium text-gray-900' : 'text-gray-400',
                )}
              >
                {label}
              </span>
              {i < STEP_LABEL_KEYS.length - 1 && <span className="mx-1 h-px flex-1 bg-gray-200" />}
            </li>
          );
        })}
      </ol>

      <Card padding="lg" className="min-h-[320px]">
        {/* Step 1 · 选择路径 */}
        {step === 1 && (
          <div className="animate-fade-in">
            <h2 className="text-sm font-semibold text-gray-900">{t('device.choosePath')}</h2>
            <p className="mt-0.5 text-xs text-gray-500">{t('device.choosePathHint')}</p>
            <div className="mt-4 grid grid-cols-2 gap-3">
              {PATH_CARDS.map(({ path: p, icon: Icon, titleKey, descKey }) => (
                <button
                  key={p}
                  onClick={() => {
                    setPath(p);
                    setError(null);
                    setStep(2);
                  }}
                  className={cx(
                    'group flex flex-col items-start gap-2 rounded-card border border-gray-200 bg-white p-4 text-left',
                    'transition-all duration-fast hover:border-primary hover:shadow-float',
                  )}
                >
                  <span className="flex w-full items-center justify-between">
                    <Icon size={20} className="text-gray-500 transition-colors duration-fast group-hover:text-primary" />
                    <Badge variant="warning" className="text-[10px]">MOCK IOT</Badge>
                  </span>
                  <span className="text-sm font-medium text-gray-900">{t(titleKey)}</span>
                  <span className="text-xs text-gray-500">{t(descKey)}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 2 · 发现设备 */}
        {step === 2 && (
          <div className="flex animate-fade-in flex-col items-center gap-3 py-10 text-center">
            {error === 'discoverTimeout' ? (
              <>
                <p className="text-sm font-medium text-gray-900">
                  {t('device.discoverFailed')}
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <Button size="sm" onClick={retryError}>{t('common.retry')}</Button>
                  <Button size="sm" variant="secondary" onClick={() => { setError(null); setStep(1); }}>
                    {t('device.tryAnother')}
                  </Button>
                </div>
              </>
            ) : (
              <>
                <Spinner size={28} />
                <p className="text-sm font-medium text-gray-900">
                  {t('device.searching', { path: path ? BIND_PATH_LABEL[path] : '' })}
                </p>
                <p className="text-xs text-gray-500">{t('device.discoveryHint')}</p>
              </>
            )}
          </div>
        )}

        {/* Step 3 · 输入 WiFi（桌面输入 / 手机辅助） */}
        {step === 3 && device && (
          <div className="animate-fade-in">
            <DeviceChip device={device} />
            {path === 'mobile' && !useLocalWifi ? (
              error === 'tokenExpired' ? (
                <div className="mt-4 flex flex-col items-center gap-3 py-6 text-center">
                  <p className="text-sm font-medium text-gray-900">
                    {t('device.linkExpired')}
                  </p>
                  <Button size="sm" onClick={retryError}>{t('common.retry')}</Button>
                </div>
              ) : (
                <div className="mt-4 flex flex-col items-center gap-3 py-4 text-center">
                  <p className="text-sm font-medium text-gray-900">{t('device.openMobile')}</p>
                  <div className="flex w-full max-w-[440px] items-center gap-2 rounded-panel border border-gray-200 bg-gray-50 px-3 py-2">
                    <span className="min-w-0 flex-1 truncate text-left text-xs text-gray-600 tnum">
                      {mobileUrl}
                    </span>
                    <button
                      onClick={copyMobileUrl}
                      className="shrink-0 rounded-button p-1.5 text-gray-500 transition-colors duration-fast hover:bg-gray-200 hover:text-gray-800"
                      aria-label={t('app.copy')}
                    >
                      <Copy size={14} />
                    </button>
                  </div>
                  <a
                    href={mobileUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-primary hover:underline"
                  >
                    {t('device.openWindow')}
                  </a>
                  <p className="flex items-center gap-1.5 text-xs text-gray-500">
                    <Loader2 size={12} className="animate-spin-slow" />
                    {t('device.waitingMobile')}
                  </p>
                  <button
                    onClick={() => setUseLocalWifi(true)}
                    className="text-xs text-gray-500 underline-offset-2 transition-colors duration-fast hover:text-gray-800 hover:underline"
                  >
                    {t('device.switchComputer')}
                  </button>
                </div>
              )
            ) : (
              <div className="mt-4 flex max-w-[400px] flex-col gap-3">
                <Input
                  label={t('device.wifiName')}
                  value={ssid}
                  onChange={(e) => setSsid(e.target.value)}
                  placeholder={t('device.wifiNamePlaceholder')}
                  autoComplete="off"
                />
                <Input
                  label={t('device.wifiPassword')}
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t('device.wifiPasswordPlaceholder')}
                  helper={t('device.wifiHelper')}
                  autoComplete="new-password"
                />
                {inlineError && <p className="text-xs text-error">{inlineError}</p>}
                <div className="mt-1">
                  <Button onClick={() => startProvisioning(ssid, password)}>{t('device.startProvision')}</Button>
                </div>
              </div>
            )}
            {error === 'concurrent' && (
              <p className="mt-3 text-xs text-warning">
                {t('device.concurrent')}
              </p>
            )}
          </div>
        )}

        {/* Step 4 · 配网中 */}
        {step === 4 && (
          <div className="flex animate-fade-in flex-col items-center gap-4 py-10 text-center">
            {error === 'wifiWrong' ? (
              <>
                <p className="text-sm font-medium text-gray-900">{t('device.wifiWrong')}</p>
                <Button size="sm" onClick={retryError}>{t('common.retry')}</Button>
              </>
            ) : error === 'joinTimeout' ? (
              <>
                <p className="text-sm font-medium text-gray-900">
                  {t('device.joinTimeout')}
                </p>
                <Button size="sm" onClick={retryError}>{t('common.retry')}</Button>
              </>
            ) : (
              <>
                <div className="w-full max-w-[420px]">
                  <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
                    <div
                      className="h-full rounded-full bg-primary transition-[width] duration-fast ease-out"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <p className="mt-2 text-sm font-medium text-gray-900 tnum">{progress}%</p>
                </div>
                <p className="text-xs text-gray-500">
                  {t('device.provisioning')}
                </p>
              </>
            )}
          </div>
        )}

        {/* Step 5 · 命名设备 */}
        {step === 5 && device && (
          <div className="animate-fade-in">
            <DeviceChip device={device} />
            {error === 'alreadyBound' ? (
              <div className="mt-4 flex flex-col items-start gap-3 py-4">
                <p className="text-sm font-medium text-error">
                  {t('device.alreadyBound')}
                </p>
                <Button size="sm" variant="secondary" onClick={() => setCancelOpen(true)}>
                  {t('device.cancelBind')}
                </Button>
              </div>
            ) : (
              <div className="mt-4 flex max-w-[400px] flex-col gap-3">
                <Input
                  label={t('device.deviceAlias')}
                  value={alias}
                  onChange={(e) => setAlias(e.target.value)}
                  placeholder={`${DEVICE_TYPE_LABEL[device.type]}-${String(deviceCount + 1).padStart(2, '0')}`}
                  helper={t('device.aliasHelper')}
                />
                <div className="mt-1">
                  <Button onClick={finalizeBind}>{t('device.finishBind')}</Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step 6 · 绑定完成 */}
        {step === 6 && device && (
          <div className="flex animate-fade-in flex-col items-center gap-3 py-8 text-center">
            <CheckCircle2 size={40} className="text-success" />
            <p className="text-base font-semibold text-gray-900">{t('device.bindSuccess')}</p>
            <Card className="w-full max-w-[360px] text-left" padding="md">
              <dl className="flex flex-col gap-1.5 text-xs">
                <Row k={t('device.deviceAlias')} v={alias} /><Row k={t('device.type')} v={DEVICE_TYPE_LABEL[device.type]} /><Row k={t('device.deviceCode')} v={device.deviceCode} mono /><Row k={t('device.bindMethod')} v={BIND_PATH_LABEL[device.foundVia]} />
              </dl>
            </Card>
            <div className="mt-2 flex items-center gap-2">
              <Button onClick={() => navigate(Routes.devices)}>{t('device.viewDevices')}</Button>
              <Button
                variant="secondary"
                onClick={() => {
                  setStep(1);
                  setPath(null);
                  setDevice(null);
                  setSsid('');
                  setPassword('');
                  setAlias('');
                  setMobileToken('');
                  setUseLocalWifi(false);
                  setError(null);
                  setProgress(0);
                }}
              >
                {t('device.bindAnother')}
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* 底部操作：每步有上一步 / 取消（Step 6 已完成除外） */}
      {step < 6 && (
        <div className="flex items-center justify-between">
          <div>
            {step > 1 && (
              <Button variant="ghost" size="sm" onClick={goBack}>
                {t('device.backStep')}
              </Button>
            )}
          </div>
          <Button variant="ghost" size="sm" onClick={() => setCancelOpen(true)}>
                {t('device.cancelBind')}
          </Button>
        </div>
      )}

      {/* 取消二次确认 */}
      <Modal
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        title={t('device.cancelBind')}
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setCancelOpen(false)}>
              {t('device.continueBind')}
            </Button>
            <Button variant="danger" size="sm" onClick={confirmCancel}>
              {t('device.confirmCancel')}
            </Button>
          </>
        }
      >
        {t('device.cancelText')}
      </Modal>
    </div>
  );
}

/** 已发现设备摘要条 */
function DeviceChip({ device }: { device: DiscoveredDevice }) {
  const { t } = useLocale();
  return (
    <div className="flex items-center gap-2 rounded-panel border border-gray-200 bg-gray-50 px-3 py-2">
      <Wifi size={14} className="text-success" />
      <span className="text-xs text-gray-700">
        {t('device.discovered')} <span className="font-medium tnum">{device.deviceCode}</span>
        （{DEVICE_TYPE_LABEL[device.type]}）
      </span>
      <Badge variant="warning" className="ml-auto text-[10px]">MOCK IOT</Badge>
    </div>
  );
}

function Row({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-gray-500">{k}</dt>
      <dd className={cx('font-medium text-gray-900', mono && 'tnum')}>{v}</dd>
    </div>
  );
}
