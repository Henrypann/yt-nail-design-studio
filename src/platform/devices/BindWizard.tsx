/**
 * 设备配网向导（模块 2 · prototype）—— 工作站两跳绑定：
 * Step1 搜索机器（蓝牙主按钮）/ 同页数据线（USB 次按钮）→ Step2 发现+配对
 * → Step3 输入 WiFi（密码不持久化；手机代填不是绑定路径）
 * → Step4 配网中 → Step5 命名 + hop1 本地绑定 → hop2 云注册 → Step6 完成。
 *
 * CLOUD_REGISTER_FAILED 只重试 hop2。LAN 不是绑定路径。
 * 冻结期：本页强制注入同路径 mock，即使浏览器具备 WebBluetooth / WebUSB
 * 也不创建真实适配器、不调用 requestDevice / connect / open。
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CheckCircle2,
  Copy,
  Loader2,
  Wifi,
} from 'lucide-react';
import { Button, Input, Modal, Spinner, useToast } from '@/design-system';
import './workstation-bind.css';
import { isScenarioOn, useMockScenarios } from '@/lib/mock-panel';
import { useLocale } from '@/lib/i18n';
import { Routes } from '@/app/routes';
import { getSession } from '@/platform/session';
import {
  bindErrorMessageKeyV1,
  mapBindErrorV1,
  mapWizardBindErrorV1,
  type BindErrorCodeV1,
  type BindSnMismatchDisplayV1,
  type WizardBindErrorAliasV1,
} from './bind-error-codes';
import {
  acquireBindLock,
  clearBindSession,
  loadBindSession,
  releaseBindLock,
  saveBindSession,
} from './bind-session';
import { createBoundDevice, useDevicesStore } from './device-store';
import {
  DEVICE_TYPE_LABEL,
  IOT_SCENARIOS,
  IOT_TIMINGS,
  mockMobileToken,
  randomProvisionMs,
} from './iot-mock';
import {
  isMobileTokenExpired,
  issueMobileToken,
  readMobileToken,
} from './mobile-tokens';
import type { BindTransportPortV1 } from './transport/bind-transport-port';
import { createMockBindTransport } from './transport/mock-bind-transport';
import { createTwoHopBindControllerV1 } from './two-hop-bind';
import type { BindPath, BindStep, DiscoveredDevice } from './types';

type ErrorKind = BindErrorCodeV1;

const STEP_LABEL_KEYS = ['device.choosePath', 'device.discovered', 'device.wifiPassword', 'device.provisioning', 'device.deviceAlias', 'device.bindSuccess'] as const;

const PATH_LABEL_KEY: Record<BindPath, 'device.bluetoothPath' | 'device.usbPath'> = {
  bluetooth: 'device.bluetoothPath',
  usb: 'device.usbPath',
};

export function BindWizard() {
  const navigate = useNavigate();
  const toast = useToast();
  const { t } = useLocale();
  const flags = useMockScenarios((s) => s.flags);
  const addDevice = useDevicesStore((s) => s.addDevice);
  const setActivationState = useDevicesStore((s) => s.setActivationState);
  const devices = useDevicesStore((s) => s.devices);
  const deviceCount = devices.length;

  const [restored] = useState(() => loadBindSession());
  const hopRef = useRef(
    createTwoHopBindControllerV1({
      hop1Completed: restored?.hop1Completed,
      localDeviceId: restored?.localDeviceId,
    }),
  );
  const [hop1Done, setHop1Done] = useState(() => restored?.hop1Completed === true);
  const [step, setStep] = useState<BindStep>(() => {
    if (!restored) return 1;
    if (restored.hop1Completed) return 5;
    return restored.step === 4 ? 3 : restored.step;
  });
  const [path, setPath] = useState<BindPath | null>(restored?.path ?? null);
  const [device, setDevice] = useState<DiscoveredDevice | null>(restored?.device ?? null);
  const [ssid, setSsid] = useState(restored?.wifiSsid ?? '');
  const [password, setPassword] = useState(''); // 红线：type=password，不持久化
  const [alias, setAlias] = useState(restored?.alias ?? '');
  const [mobileToken, setMobileToken] = useState(restored?.mobileToken ?? '');
  const [useMobileWifiHelper, setUseMobileWifiHelper] = useState(false);
  const [error, setError] = useState<ErrorKind | null>(null);
  const [errorAlias, setErrorAlias] = useState<WizardBindErrorAliasV1 | null>(null);
  const [snMismatch, setSnMismatch] = useState<BindSnMismatchDisplayV1 | null>(null);
  const [usingMock, setUsingMock] = useState(true);
  const [hop2Busy, setHop2Busy] = useState(false);

  const reportError = (alias: WizardBindErrorAliasV1) => {
    setError(mapWizardBindErrorV1(alias));
    setErrorAlias(alias);
  };
  const reportCode = (code: BindErrorCodeV1) => {
    setError(mapBindErrorV1(code));
    setErrorAlias(null);
  };
  const clearError = () => {
    setError(null);
    setErrorAlias(null);
    setSnMismatch(null);
  };
  const [progress, setProgress] = useState(0);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [provisionNonce, setProvisionNonce] = useState(0);
  const [inlineError, setInlineError] = useState('');

  const flagsRef = useRef(flags);
  flagsRef.current = flags;
  const transportRef = useRef<BindTransportPortV1 | null>(
    restored?.path ? createMockBindTransport({ kind: restored.path, scenarioFlags: flags }) : null,
  );
  const discoverGen = useRef(0);

  const injectMockTransport = (kind: BindPath) => {
    const port = createMockBindTransport({
      kind,
      scenarioFlags: flagsRef.current,
    });
    transportRef.current = port;
    setUsingMock(true);
    return port;
  };

  /* 刷新恢复提示（5 分钟 TTL 内） */
  useEffect(() => {
    if (restored) toast.info(t('device.resume'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* 会话持久化：步骤/路径/设备/SSID/别名/Token/hop1（密码永不写入） */
  useEffect(() => {
    if (step === 6) return;
    const hop = hopRef.current.state;
    saveBindSession({
      step,
      path,
      device,
      wifiSsid: ssid,
      mobileToken,
      alias,
      hop1Completed: hop.hop1Completed,
      localDeviceId: hop.localDeviceId ?? undefined,
    });
  }, [step, path, device, ssid, mobileToken, alias, error, hop1Done]);

  /* Step 3 · 可选手机 Wi-Fi 代填：发放 Token + 2s 轮询。不是绑定路径。 */
  useEffect(() => {
    if (step !== 3 || !useMobileWifiHelper || !device || error) return;
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
        reportError('tokenExpired');
      }
    }, 2000);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, useMobileWifiHelper, device, mobileToken, error]);

  /* Step 4 · 配网中：进度 0→100%；Mock 注入 WiFi 密码错误 / 入网超时 30s */
  useEffect(() => {
    if (step !== 4 || error) return;
    if (isScenarioOn(flagsRef.current, IOT_SCENARIOS.bindTimeout)) {
      const startedAt = Date.now();
      const timer = window.setInterval(() => {
        const elapsed = Date.now() - startedAt;
        setProgress(Math.min(92, Math.round((elapsed / IOT_TIMINGS.joinTimeoutMs) * 100)));
        if (elapsed >= IOT_TIMINGS.joinTimeoutMs) {
          window.clearInterval(timer);
          reportError('joinTimeout');
        }
      }, 200);
      return () => window.clearInterval(timer);
    }
    const duration = randomProvisionMs();
    const startedAt = Date.now();
    let cancelled = false;
    let failed = false;
    const timer = window.setInterval(() => {
      const elapsed = Date.now() - startedAt;
      const pct = Math.min(100, Math.round((elapsed / duration) * 100));
      setProgress(pct);
      if (isScenarioOn(flagsRef.current, IOT_SCENARIOS.wifiWrong) && pct >= 60) {
        failed = true;
        window.clearInterval(timer);
        setPassword('');
        setUseMobileWifiHelper(false);
        reportError('wifiWrong');
      }
    }, 100);

    const transport = transportRef.current;
    const currentDevice = device;
    const runHandoff = async () => {
      if (!transport || !currentDevice) return;
      const result = await transport.wifiHandoff(currentDevice, { ssid, password });
      if (cancelled) return;
      if (!result.ok) {
        failed = true;
        window.clearInterval(timer);
        reportCode(result.code);
      }
    };
    void runHandoff();

    const done = window.setTimeout(() => {
      if (cancelled || failed) return;
      window.clearInterval(timer);
      if (isScenarioOn(flagsRef.current, IOT_SCENARIOS.wifiWrong)) return;
      clearError();
      setProgress(100);
      setStep(5);
    }, duration);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
      window.clearTimeout(done);
    };
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
      if (
        isScenarioOn(flagsRef.current, IOT_SCENARIOS.concurrentBind) ||
        !acquireBindLock(device.deviceCode)
      ) {
        reportError('concurrent');
        toast.warning(t('device.concurrent'));
        return;
      }
      clearError();
      setProgress(0);
      setStep(4);
    },
    [device, toast, t],
  );
  const startProvisioningRef = useRef(startProvisioning);
  startProvisioningRef.current = startProvisioning;

  const runHop2Only = useCallback(async () => {
    const current = device;
    const localId = hopRef.current.state.localDeviceId;
    if (!current || !hopRef.current.state.hop1Completed || !localId) return;
    setHop2Busy(true);
    const storeId = getSession()?.email ?? '';
    const cloud = await hopRef.current.runHop2({
      serialNumber: current.serialNumber,
      storeId,
      fail: isScenarioOn(flagsRef.current, IOT_SCENARIOS.cloudRegisterFailed),
    });
    setHop2Busy(false);
    if (!cloud.ok) {
      reportCode('CLOUD_REGISTER_FAILED');
      return;
    }
    setActivationState(localId, 'activated');
    clearBindSession();
    releaseBindLock();
    clearError();
    setStep(6);
    toast.success(t('device.boundAlias', { alias: alias.trim() || current.deviceCode }));
  }, [alias, device, setActivationState, t, toast]);

  useEffect(() => {
    if (!restored?.hop1Completed) return;
    void runHop2Only();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Step 5 · hop1 本地绑定，成功后再 hop2。CLOUD_REGISTER_FAILED 只走 hop2。 */
  const finalizeBind = () => {
    if (!device) return;
    const storeId = getSession()?.email ?? '';
    const expectedSerialNumber = isScenarioOn(flags, IOT_SCENARIOS.snMismatch)
      ? 'SN-EXPECT-DEMO'
      : undefined;
    const existing = isScenarioOn(flags, IOT_SCENARIOS.alreadyBound)
      ? [
          {
            id: 'bound-other',
            serialNumber: device.serialNumber,
            storeId: '__other_store__',
            activationState: 'activated' as const,
          },
        ]
      : devices.map((item) => ({
          id: item.id,
          serialNumber: item.serialNumber,
          storeId: item.storeId,
          activationState: item.activationState,
        }));

    const hop1 = hopRef.current.runHop1({
      incoming: {
        serialNumber: device.serialNumber,
        storeId,
        deviceCode: device.deviceCode,
      },
      existingDevices: existing,
      expectedSerialNumber,
      persist: () => {
        const finalAlias =
          alias.trim() || `${DEVICE_TYPE_LABEL[device.type]}-${String(deviceCount + 1).padStart(2, '0')}`;
        const created = createBoundDevice({
          alias: finalAlias,
          type: device.type,
          deviceCode: device.deviceCode,
          serialNumber: device.serialNumber,
          storeId,
          activationState: 'not_activated',
          nailProfileRef: null,
        });
        addDevice(created);
        setAlias(finalAlias);
        return created.id;
      },
    });

    if (!hop1.ok) {
      if (hop1.snMismatch) setSnMismatch(hop1.snMismatch);
      reportCode(hop1.code);
      return;
    }

    if (hop1.sameStoreReuse) {
      toast.info(t('device.sameStoreAlreadyBound'));
    }

    setHop1Done(true);
    void runHop2Only();
  };

  /** 取消配网（二次确认后） */
  const confirmCancel = () => {
    discoverGen.current += 1;
    clearBindSession();
    releaseBindLock();
    setCancelOpen(false);
    navigate(Routes.devices);
  };

  const goBack = () => {
    discoverGen.current += 1;
    clearError();
    setInlineError('');
    if (hop1Done) return;
    if (step === 2) setStep(1);
    else if (step === 3) {
      setDevice(null);
      setUseMobileWifiHelper(false);
      setStep(2);
    } else if (step === 4) setStep(3);
    else if (step === 5) setStep(3);
  };

  const retryError = () => {
    if (error === 'CLOUD_REGISTER_FAILED') {
      clearError();
      void runHop2Only();
      return;
    }
    if (error === 'BIND_BT_WIFI_HANDOFF_FAILED' || errorAlias === 'wifiWrong') {
      clearError();
      setStep(3);
      return;
    }
    if (error === 'BIND_BT_DISCOVER_FAILED' || error === 'BIND_BT_PAIR_FAILED' || error === 'BIND_USB_NOT_FOUND' || error === 'BIND_USB_DENIED') {
      if (path) void startPath(path);
      return;
    }
    if (errorAlias === 'discoverTimeout') {
      if (path) void startPath(path);
      return;
    }
    if (errorAlias === 'joinTimeout') {
      clearError();
      setProgress(0);
      setProvisionNonce((n) => n + 1);
      return;
    }
    if (errorAlias === 'concurrent') {
      clearError();
      startProvisioning(ssid, password);
      return;
    }
    if (errorAlias === 'tokenExpired') {
      clearError();
      setMobileToken('');
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

  const startPath = async (next: BindPath) => {
    const gen = ++discoverGen.current;
    setPath(next);
    clearError();
    setDevice(null);
    setUseMobileWifiHelper(false);
    setStep(2);
    const port = injectMockTransport(next);
    const discovered = await port.discover();
    if (gen !== discoverGen.current) return;
    if (!discovered.ok) {
      reportCode(discovered.code);
      return;
    }
    const paired = await port.pair(discovered.device);
    if (gen !== discoverGen.current) return;
    if (!paired.ok) {
      setDevice(discovered.device);
      reportCode(paired.code);
      return;
    }
    setDevice(paired.device);
    setStep(3);
  };

  const errorCopy = () => {
    if (!error) return '';
    if (errorAlias === 'wifiWrong') return t('device.wifiWrong');
    if (errorAlias === 'joinTimeout') return t('device.joinTimeout');
    if (errorAlias === 'concurrent') return t('device.concurrent');
    if (errorAlias === 'tokenExpired') return t('device.linkExpired');
    if (error === 'BIND_SN_MISMATCH' && snMismatch) {
      return t('device.snMismatch', {
        expectedSerialNumber: snMismatch.expectedSerialNumber,
        actualSerialNumber: snMismatch.actualSerialNumber,
      });
    }
    return t(bindErrorMessageKeyV1(error));
  };

  const step2Failed =
    error === 'BIND_BT_DISCOVER_FAILED' ||
    error === 'BIND_BT_PAIR_FAILED' ||
    error === 'BIND_USB_NOT_FOUND' ||
    error === 'BIND_USB_DENIED';

  /* ── 渲染 ───────────────────────────────────────────── */

  return (
    <div
      className="ws-bind-root min-h-full flex-1"
      data-surface="workstation-bind"
      data-debug-id="app.devices.bind-wizard"
    >
      <div className="ws-bind-page">
      <header>
        <p className="ws-bind-kicker">MOCK IOT · prototype</p>
        <h1 className="ws-bind-title">{t('device.wizardTitle')}</h1>
        <p className="ws-bind-lede">{t('device.wizardSubtitle')}</p>
      </header>

      {step > 1 && (
        <div className="ws-bind-progress">
          <span className="ws-bind-progress-label">
            {t('device.stepProgress', { step, total: 6 })}
            {` · ${t(STEP_LABEL_KEYS[step - 1])}`}
          </span>
          <div className="ws-bind-progress-track">
            <div className="ws-bind-progress-value" style={{ width: `${(step / 6) * 100}%` }} />
          </div>
        </div>
      )}

      <section className="ws-bind-panel">
        {/* Step 1 · 搜索机器（主路径）+ 同页数据线文字链接；LAN 已移除；手机不是路径卡 */}
        {step === 1 && (
          <div className="animate-fade-in">
            <button type="button" className="ws-bind-primary" onClick={() => void startPath('bluetooth')}>
              {t('device.searchMachines')}
            </button>
            <button type="button" className="ws-bind-footnote" onClick={() => void startPath('usb')}>
              {t('device.bindWithCable')}
            </button>
            <p className="ws-bind-hint">{t('device.searchHint')}</p>
          </div>
        )}

        {/* Step 2 · 发现设备 */}
        {step === 2 && (
          <div className="ws-bind-center animate-fade-in">
            {step2Failed ? (
              <>
                <p className="ws-bind-copy">{errorCopy()}</p>
                <div className="ws-bind-actions">
                  <button type="button" className="ws-bind-primary" onClick={retryError}>{t('common.retry')}</button>
                  <button type="button" className="ws-bind-footnote" onClick={() => { clearError(); setStep(1); }}>
                    {t('device.tryAnother')}
                  </button>
                </div>
              </>
            ) : (
              <>
                <Spinner size={28} />
                <p className="ws-bind-copy">
                  {t('device.searching', { path: path ? t(PATH_LABEL_KEY[path]) : '' })}
                </p>
                <p className="ws-bind-muted">{t('device.discoveryHint')}</p>
                {usingMock && <p className="ws-bind-muted">{t('device.mockTransportHint')}</p>}
              </>
            )}
          </div>
        )}

        {/* Step 3 · 输入 WiFi（工作站键盘 / 可选手机代填，不是绑定路径） */}
        {step === 3 && device && (
          <div className="animate-fade-in">
            <DeviceChip device={device} usingMock={usingMock} />
            {useMobileWifiHelper ? (
              errorAlias === 'tokenExpired' ? (
                <div className="ws-bind-center">
                  <p className="ws-bind-copy">{t('device.linkExpired')}</p>
                  <button type="button" className="ws-bind-primary" onClick={retryError}>{t('common.retry')}</button>
                </div>
              ) : (
                <div className="ws-bind-center">
                  <p className="ws-bind-copy">{t('device.openMobile')}</p>
                  <p className="ws-bind-muted">{t('device.mobileWifiNotBindPath')}</p>
                  <div className="ws-bind-link-row">
                    <span className="min-w-0 flex-1 truncate text-left tnum">{mobileUrl}</span>
                    <button
                      type="button"
                      className="ws-bind-text-btn"
                      onClick={copyMobileUrl}
                      aria-label={t('app.copy')}
                    >
                      <Copy size={14} />
                    </button>
                  </div>
                  <a href={mobileUrl} target="_blank" rel="noreferrer">
                    {t('device.openWindow')}
                  </a>
                  <p className="ws-bind-muted flex items-center gap-1.5">
                    <Loader2 size={12} className="animate-spin-slow" />
                    {t('device.waitingMobile')}
                  </p>
                  <button type="button" className="ws-bind-footnote" onClick={() => setUseMobileWifiHelper(false)}>
                    {t('device.switchComputer')}
                  </button>
                </div>
              )
            ) : (
              <div className="ws-bind-field">
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
                {inlineError && <p className="ws-bind-error">{inlineError}</p>}
                <button type="button" className="ws-bind-primary" onClick={() => startProvisioning(ssid, password)}>
                  {t('device.startProvision')}
                </button>
                <button
                  type="button"
                  className="ws-bind-footnote"
                  onClick={() => setUseMobileWifiHelper(true)}
                >
                  {t('device.mobileWifiHelper')}
                </button>
                <p className="ws-bind-muted">{t('device.mobileWifiNotBindPath')}</p>
              </div>
            )}
            {errorAlias === 'concurrent' && (
              <p className="ws-bind-warn">{t('device.concurrent')}</p>
            )}
          </div>
        )}

        {/* Step 4 · 配网中 */}
        {step === 4 && (
          <div className="ws-bind-center animate-fade-in">
            {errorAlias === 'wifiWrong' ? (
              <>
                <p className="ws-bind-copy">{t('device.wifiWrong')}</p>
                <button type="button" className="ws-bind-primary" onClick={retryError}>{t('common.retry')}</button>
              </>
            ) : errorAlias === 'joinTimeout' ? (
              <>
                <p className="ws-bind-copy">{t('device.joinTimeout')}</p>
                <button type="button" className="ws-bind-primary" onClick={retryError}>{t('common.retry')}</button>
              </>
            ) : error ? (
              <>
                <p className="ws-bind-copy">{errorCopy()}</p>
                <button type="button" className="ws-bind-primary" onClick={retryError}>{t('common.retry')}</button>
              </>
            ) : (
              <>
                <div className="w-full">
                  <div className="ws-bind-meter">
                    <span style={{ width: `${progress}%` }} />
                  </div>
                  <p className="ws-bind-copy mt-2 tnum">{progress}%</p>
                </div>
                <p className="ws-bind-muted">{t('device.provisioning')}</p>
              </>
            )}
          </div>
        )}

        {/* Step 5 · 命名设备 / hop2 云注册 */}
        {step === 5 && device && (
          <div className="animate-fade-in">
            <DeviceChip device={device} usingMock={usingMock} />
            {error === 'BIND_SN_ALREADY_BOUND' ? (
              <div className="ws-bind-field">
                <p className="ws-bind-error">{t('device.alreadyBound')}</p>
                <button type="button" className="ws-bind-footnote" onClick={() => setCancelOpen(true)}>
                  {t('device.cancelBind')}
                </button>
              </div>
            ) : error === 'BIND_SN_MISMATCH' ? (
              <div className="ws-bind-field">
                <p className="ws-bind-error">{errorCopy()}</p>
                <button type="button" className="ws-bind-footnote" onClick={() => setCancelOpen(true)}>
                  {t('device.cancelBind')}
                </button>
              </div>
            ) : hop1Done || error === 'CLOUD_REGISTER_FAILED' ? (
              <div className="ws-bind-field">
                <p className="ws-bind-copy">
                  {error === 'CLOUD_REGISTER_FAILED' ? errorCopy() : t('device.hop2Registering')}
                </p>
                <button
                  type="button"
                  className="ws-bind-primary"
                  disabled={hop2Busy}
                  onClick={() => {
                    clearError();
                    void runHop2Only();
                  }}
                >
                  {hop2Busy ? t('device.hop2Registering') : t('device.retryCloudRegister')}
                </button>
              </div>
            ) : (
              <div className="ws-bind-field">
                <Input
                  label={t('device.deviceAlias')}
                  value={alias}
                  onChange={(e) => setAlias(e.target.value)}
                  placeholder={`${DEVICE_TYPE_LABEL[device.type]}-${String(deviceCount + 1).padStart(2, '0')}`}
                  helper={t('device.aliasHelper')}
                />
                <button type="button" className="ws-bind-primary" onClick={finalizeBind}>
                  {t('device.finishBind')}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Step 6 · 绑定完成 */}
        {step === 6 && device && (
          <div className="ws-bind-center animate-fade-in">
            <CheckCircle2 size={40} className="ws-bind-success-icon" />
            <p className="ws-bind-heading">{t('device.bindSuccess')}</p>
            <dl className="ws-bind-dl w-full text-left">
              <div>
                <dt>{t('device.deviceAlias')}</dt>
                <dd>{alias}</dd>
              </div>
              <div>
                <dt>{t('device.type')}</dt>
                <dd>{DEVICE_TYPE_LABEL[device.type]}</dd>
              </div>
              <div>
                <dt>{t('device.deviceCode')}</dt>
                <dd className="tnum">{device.deviceCode}</dd>
              </div>
              <div>
                <dt>{t('device.serialNumber')}</dt>
                <dd className="tnum">{device.serialNumber}</dd>
              </div>
              <div>
                <dt>{t('device.bindMethod')}</dt>
                <dd>{t(PATH_LABEL_KEY[device.foundVia])}</dd>
              </div>
            </dl>
            <div className="ws-bind-actions">
              <button type="button" className="ws-bind-primary" onClick={() => navigate(Routes.devices)}>
                {t('device.viewDevices')}
              </button>
              <button
                type="button"
                className="ws-bind-footnote"
                onClick={() => {
                  hopRef.current = createTwoHopBindControllerV1();
                  setHop1Done(false);
                  setStep(1);
                  setPath(null);
                  setDevice(null);
                  setSsid('');
                  setPassword('');
                  setAlias('');
                  setMobileToken('');
                  setUseMobileWifiHelper(false);
                  setUsingMock(true);
                  transportRef.current = null;
                  clearError();
                  setProgress(0);
                }}
              >
                {t('device.bindAnother')}
              </button>
            </div>
          </div>
        )}
      </section>

      {step < 6 && (
        <div className="ws-bind-footer">
          <div>
            {step > 1 && !hop1Done && (
              <button type="button" className="ws-bind-text-btn" onClick={goBack}>
                {t('device.backStep')}
              </button>
            )}
          </div>
          <button type="button" className="ws-bind-text-btn is-muted" onClick={() => setCancelOpen(true)}>
            {t('device.cancelBind')}
          </button>
        </div>
      )}
      </div>

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

function DeviceChip({ device, usingMock }: { device: DiscoveredDevice; usingMock: boolean }) {
  const { t } = useLocale();
  return (
    <div className="ws-bind-chip">
      <Wifi size={14} />
      <span>
        {t('device.discovered')} <span className="font-medium tnum">{device.deviceCode}</span>
        {' · '}
        {t('device.serialNumber')} <span className="font-medium tnum">{device.serialNumber}</span>
        （{DEVICE_TYPE_LABEL[device.type]}）
      </span>
      <span className="ws-bind-mock ml-auto">{usingMock ? 'MOCK IOT' : 'prototype'}</span>
    </div>
  );
}
