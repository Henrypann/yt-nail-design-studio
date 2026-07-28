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

const STEP_LABELS = ['选择路径', '发现设备', '输入 WiFi', '配网中', '命名设备', '绑定完成'];

const PATH_CARDS: { path: BindPath; icon: typeof Bluetooth; title: string; desc: string }[] = [
  { path: 'bluetooth', icon: Bluetooth, title: '蓝牙配网', desc: '浏览器蓝牙直连，推荐近距离' },
  { path: 'mobile', icon: Smartphone, title: '手机辅助配网', desc: '手机扫码辅助输入 WiFi' },
  { path: 'usb', icon: Usb, title: 'USB 数据线配网', desc: 'USB 线连接电脑和设备' },
  { path: 'lan', icon: Radar, title: '局域网发现', desc: '自动扫描同局域网内设备' },
];

export function BindWizard() {
  const navigate = useNavigate();
  const toast = useToast();
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
    if (restored) toast.info('已恢复上次未完成的配网进度。');
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
        setInlineError('请输入 WiFi 名称（SSID）');
        return;
      }
      if (!nextPassword) {
        setInlineError('请输入 WiFi 密码');
        return;
      }
      setInlineError('');
      // 并发绑定：Mock 开关强制触发，或同 deviceCode 已被其他标签页锁定
      if (
        isScenarioOn(flagsRef.current, IOT_SCENARIOS.concurrentBind) ||
        !acquireBindLock(device.deviceCode)
      ) {
        setError('concurrent');
        toast.warning('设备正在被其他操作绑定中。');
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
    toast.success(`「${finalAlias}」绑定成功。`);
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
      toast.info('链接已复制，发送到手机打开即可。');
    } catch {
      toast.warning('复制失败，请手动选择链接复制。');
    }
  };

  /* ── 渲染 ───────────────────────────────────────────── */

  return (
    <div className="flex flex-col gap-4" data-debug-id="app.devices.bind-wizard">
      <header className="flex items-center gap-2">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">设备绑定</h1>
          <p className="mt-0.5 text-xs text-gray-500">
            蓝牙 / 手机辅助 / USB / 局域网发现，每次仅配网一台设备
          </p>
        </div>
        <Badge variant="warning" className="ml-1">MOCK IOT</Badge>
      </header>

      {/* 步骤条 */}
      <ol className="flex items-center gap-1">
        {STEP_LABELS.map((label, i) => {
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
              {i < STEP_LABELS.length - 1 && <span className="mx-1 h-px flex-1 bg-gray-200" />}
            </li>
          );
        })}
      </ol>

      <Card padding="lg" className="min-h-[320px]">
        {/* Step 1 · 选择路径 */}
        {step === 1 && (
          <div className="animate-fade-in">
            <h2 className="text-sm font-semibold text-gray-900">选择配网方式</h2>
            <p className="mt-0.5 text-xs text-gray-500">选择一种方式连接你的设备。</p>
            <div className="mt-4 grid grid-cols-2 gap-3">
              {PATH_CARDS.map(({ path: p, icon: Icon, title, desc }) => (
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
                  <span className="text-sm font-medium text-gray-900">{title}</span>
                  <span className="text-xs text-gray-500">{desc}</span>
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
                  未发现设备。请确认设备已通电并靠近。
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <Button size="sm" onClick={retryError}>重试</Button>
                  <Button size="sm" variant="secondary" onClick={() => { setError(null); setStep(1); }}>
                    换一种方式
                  </Button>
                </div>
              </>
            ) : (
              <>
                <Spinner size={28} />
                <p className="text-sm font-medium text-gray-900">
                  正在通过「{path ? BIND_PATH_LABEL[path] : ''}」搜索设备…
                </p>
                <p className="text-xs text-gray-500">请保持设备通电并处于配网模式（最长等待 15 秒）。</p>
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
                    链接已过期。请重新发起手机辅助配网。
                  </p>
                  <Button size="sm" onClick={retryError}>重新生成链接</Button>
                </div>
              ) : (
                <div className="mt-4 flex flex-col items-center gap-3 py-4 text-center">
                  <p className="text-sm font-medium text-gray-900">用手机打开以下链接输入 WiFi</p>
                  <div className="flex w-full max-w-[440px] items-center gap-2 rounded-panel border border-gray-200 bg-gray-50 px-3 py-2">
                    <span className="min-w-0 flex-1 truncate text-left text-xs text-gray-600 tnum">
                      {mobileUrl}
                    </span>
                    <button
                      onClick={copyMobileUrl}
                      className="shrink-0 rounded-button p-1.5 text-gray-500 transition-colors duration-fast hover:bg-gray-200 hover:text-gray-800"
                      aria-label="复制链接"
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
                    在新窗口打开（模拟手机）→
                  </a>
                  <p className="flex items-center gap-1.5 text-xs text-gray-500">
                    <Loader2 size={12} className="animate-spin-slow" />
                    等待手机提交 WiFi…（链接 5 分钟内有效）
                  </p>
                  <button
                    onClick={() => setUseLocalWifi(true)}
                    className="text-xs text-gray-500 underline-offset-2 transition-colors duration-fast hover:text-gray-800 hover:underline"
                  >
                    手机不方便？改用电脑输入 WiFi
                  </button>
                </div>
              )
            ) : (
              <div className="mt-4 flex max-w-[400px] flex-col gap-3">
                <Input
                  label="WiFi 名称（SSID）"
                  value={ssid}
                  onChange={(e) => setSsid(e.target.value)}
                  placeholder="例如：NailStudio-5G"
                  autoComplete="off"
                />
                <Input
                  label="WiFi 密码"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="请输入 WiFi 密码"
                  helper="密码仅用于本次配网，不会被保存。"
                  autoComplete="new-password"
                />
                {inlineError && <p className="text-xs text-error">{inlineError}</p>}
                <div className="mt-1">
                  <Button onClick={() => startProvisioning(ssid, password)}>开始配网</Button>
                </div>
              </div>
            )}
            {error === 'concurrent' && (
              <p className="mt-3 text-xs text-warning">
                设备正在被其他操作绑定中。请稍后再试，或关闭其他绑定页面。
              </p>
            )}
          </div>
        )}

        {/* Step 4 · 配网中 */}
        {step === 4 && (
          <div className="flex animate-fade-in flex-col items-center gap-4 py-10 text-center">
            {error === 'wifiWrong' ? (
              <>
                <p className="text-sm font-medium text-gray-900">WiFi 密码错误。请重新输入。</p>
                <Button size="sm" onClick={retryError}>重试</Button>
              </>
            ) : error === 'joinTimeout' ? (
              <>
                <p className="text-sm font-medium text-gray-900">
                  设备连接超时。请检查 WiFi 信号和路由器。
                </p>
                <Button size="sm" onClick={retryError}>重试</Button>
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
                  正在配网，请勿关闭设备电源或断开连接…
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
                  此设备已在其他门店绑定。如需转移请联系客服。
                </p>
                <Button size="sm" variant="secondary" onClick={() => setCancelOpen(true)}>
                  取消配网
                </Button>
              </div>
            ) : (
              <div className="mt-4 flex max-w-[400px] flex-col gap-3">
                <Input
                  label="设备别名"
                  value={alias}
                  onChange={(e) => setAlias(e.target.value)}
                  placeholder={`${DEVICE_TYPE_LABEL[device.type]}-${String(deviceCount + 1).padStart(2, '0')}`}
                  helper="给设备起一个好认的名字，例如「前台扫描仪」。"
                />
                <div className="mt-1">
                  <Button onClick={finalizeBind}>完成绑定</Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step 6 · 绑定完成 */}
        {step === 6 && device && (
          <div className="flex animate-fade-in flex-col items-center gap-3 py-8 text-center">
            <CheckCircle2 size={40} className="text-success" />
            <p className="text-base font-semibold text-gray-900">绑定成功</p>
            <Card className="w-full max-w-[360px] text-left" padding="md">
              <dl className="flex flex-col gap-1.5 text-xs">
                <Row k="设备别名" v={alias} />
                <Row k="设备类型" v={DEVICE_TYPE_LABEL[device.type]} />
                <Row k="设备代码" v={device.deviceCode} mono />
                <Row k="配网方式" v={BIND_PATH_LABEL[device.foundVia]} />
              </dl>
            </Card>
            <div className="mt-2 flex items-center gap-2">
              <Button onClick={() => navigate(Routes.devices)}>查看我的设备</Button>
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
                再绑定一台
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
                ← 上一步
              </Button>
            )}
          </div>
          <Button variant="ghost" size="sm" onClick={() => setCancelOpen(true)}>
            取消配网
          </Button>
        </div>
      )}

      {/* 取消二次确认 */}
      <Modal
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        title="取消配网"
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setCancelOpen(false)}>
              继续配网
            </Button>
            <Button variant="danger" size="sm" onClick={confirmCancel}>
              确认取消
            </Button>
          </>
        }
      >
        确定取消配网吗？已进行的进度不会保留。
      </Modal>
    </div>
  );
}

/** 已发现设备摘要条 */
function DeviceChip({ device }: { device: DiscoveredDevice }) {
  return (
    <div className="flex items-center gap-2 rounded-panel border border-gray-200 bg-gray-50 px-3 py-2">
      <Wifi size={14} className="text-success" />
      <span className="text-xs text-gray-700">
        已发现设备 <span className="font-medium tnum">{device.deviceCode}</span>
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
