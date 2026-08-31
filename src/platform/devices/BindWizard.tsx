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
  mapWizardBindErrorV1,
  resolveSnAlreadyBound,
  type BindWizardErrorCodeV1,
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

/** 冻结码子集。旧 6 项私有名见 WizardBindErrorAliasV1，经 mapWizardBindErrorV1 映射到此。 */
type ErrorKind = BindWizardErrorCodeV1;

const STEP_LABEL_KEYS = ['device.choosePath', 'device.discovered', 'device.wifiPassword', 'device.provisioning', 'device.deviceAlias', 'device.bindSuccess'] as const;

const PATH_LABEL_KEY: Record<BindPath, 'device.bluetoothPath' | 'device.mobilePath' | 'device.usbPath' | 'device.lanPath'> = {
  bluetooth: 'device.bluetoothPath',
  mobile: 'device.mobilePath',
  usb: 'device.usbPath',
  lan: 'device.lanPath',
};

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
  const [errorAlias, setErrorAlias] = useState<WizardBindErrorAliasV1 | null>(null);

  const reportError = (alias: WizardBindErrorAliasV1) => {
    setError(mapWizardBindErrorV1(alias));
    setErrorAlias(alias);
  };
  const clearError = () => {
    setError(null);
    setErrorAlias(null);
  };
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
    if (step !== 2 || !path || errorAlias === 'discoverTimeout') return;
    if (isScenarioOn(flagsRef.current, IOT_SCENARIOS.discoverTimeout)) {
      const t = window.setTimeout(
        () => reportError('discoverTimeout'),
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
        reportError('tokenExpired');
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
          reportError('joinTimeout');
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
        reportError('wifiWrong');
        return;
      }
      if (pct >= 100) {
        window.clearInterval(timer);
        clearError();
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
        reportError('concurrent');
      toast.warning(t('device.concurrent'));
        return;
      }
      clearError();
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
      const resolution = resolveSnAlreadyBound({
        incomingStoreId: getSession()?.email ?? '',
        boundStoreId: '__other_store__',
      });
      if (resolution.outcome === 'reject') {
        reportError('alreadyBound');
        return;
      }
    }
    const finalAlias =
      alias.trim() || `${DEVICE_TYPE_LABEL[device.type]}-${String(deviceCount + 1).padStart(2, '0')}`;
    addDevice(
      createBoundDevice({
        alias: finalAlias,
        type: device.type,
        deviceCode: device.deviceCode,
        serialNumber: '',
        storeId: getSession()?.email ?? '',
        activationState: 'not_activated',
        nailProfileRef: null,
      }),
    );
    clearBindSession();
    releaseBindLock();
    setAlias(finalAlias);
    clearError();
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
    clearError();
    setInlineError('');
    if (step === 2) setStep(1);
    else if (step === 3) {
      setDevice(null);
      setStep(2);
    } else if (step === 4) setStep(3);
    else if (step === 5) setStep(3);
  };

  const retryError = () => {
    if (errorAlias === 'discoverTimeout') {
      clearError();
      setStep(2); // effect 重新发现
      return;
    }
    if (errorAlias === 'wifiWrong') {
      clearError();
      setStep(3);
      return;
    }
    if (errorAlias === 'joinTimeout') {
      clearError();
      setProgress(0);
      setProvisionNonce((n) => n + 1); // 重启 Step 4
      return;
    }
    if (errorAlias === 'concurrent') {
      clearError();
      startProvisioning(ssid, password);
      return;
    }
    if (errorAlias === 'tokenExpired') {
      clearError();
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

  const startPath = (next: BindPath) => {
    setPath(next);
    clearError();
    setStep(2);
  };

  /* ── 渲染 ───────────────────────────────────────────── */

  return (
    <div
      className="ws-bind-root min-h-full flex-1"
      data-surface="workstation-bind"
      data-debug-id="app.devices.bind-wizard"
    >
      <div className="ws-bind-page">
      <header>
        <p className="ws-bind-kicker">MOCK IOT</p>
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
        {/* Step 1 · 搜索机器（主路径）+ 数据线脚注；手机/局域网视觉降权 */}
        {step === 1 && (
          <div className="animate-fade-in">
            <button type="button" className="ws-bind-primary" onClick={() => startPath('bluetooth')}>
              {t('device.searchMachines')}
            </button>
            <button type="button" className="ws-bind-footnote" onClick={() => startPath('usb')}>
              {t('device.bindWithCable')}
            </button>
            <p className="ws-bind-hint">{t('device.searchHint')}</p>
            <p className="ws-bind-alt">
              <button type="button" className="ws-bind-alt-link" onClick={() => startPath('mobile')}>
                {t('device.mobileWifiHelper')}
              </button>
              <span aria-hidden="true">·</span>
              <button type="button" className="ws-bind-alt-link" onClick={() => startPath('lan')}>
                {t('device.lanJobFallback')}
              </button>
            </p>
          </div>
        )}

        {/* Step 2 · 发现设备 */}
        {step === 2 && (
          <div className="ws-bind-center animate-fade-in">
            {errorAlias === 'discoverTimeout' ? (
              <>
                <p className="ws-bind-copy">{t('device.discoverFailed')}</p>
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
              </>
            )}
          </div>
        )}

        {/* Step 3 · 输入 WiFi（桌面输入 / 手机辅助） */}
        {step === 3 && device && (
          <div className="animate-fade-in">
            <DeviceChip device={device} />
            {path === 'mobile' && !useLocalWifi ? (
              errorAlias === 'tokenExpired' ? (
                <div className="ws-bind-center">
                  <p className="ws-bind-copy">{t('device.linkExpired')}</p>
                  <button type="button" className="ws-bind-primary" onClick={retryError}>{t('common.retry')}</button>
                </div>
              ) : (
                <div className="ws-bind-center">
                  <p className="ws-bind-copy">{t('device.openMobile')}</p>
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
                  <button type="button" className="ws-bind-footnote" onClick={() => setUseLocalWifi(true)}>
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

        {/* Step 5 · 命名设备 */}
        {step === 5 && device && (
          <div className="animate-fade-in">
            <DeviceChip device={device} />
            {errorAlias === 'alreadyBound' ? (
              <div className="ws-bind-field">
                <p className="ws-bind-error">{t('device.alreadyBound')}</p>
                <button type="button" className="ws-bind-footnote" onClick={() => setCancelOpen(true)}>
                  {t('device.cancelBind')}
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
                  setStep(1);
                  setPath(null);
                  setDevice(null);
                  setSsid('');
                  setPassword('');
                  setAlias('');
                  setMobileToken('');
                  setUseLocalWifi(false);
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
            {step > 1 && (
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
    <div className="ws-bind-chip">
      <Wifi size={14} />
      <span>
        {t('device.discovered')} <span className="font-medium tnum">{device.deviceCode}</span>
        （{DEVICE_TYPE_LABEL[device.type]}）
      </span>
      <span className="ws-bind-mock ml-auto">MOCK IOT</span>
    </div>
  );
}
