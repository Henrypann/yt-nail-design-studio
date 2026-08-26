import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Monitor, Plus, RefreshCw, Unlink } from 'lucide-react';
import { Badge, Button, Card, EmptyState, Modal, Spinner, cx, useToast } from '@/design-system';
import { isScenarioOn, useMockScenarios } from '@/lib/mock-panel';
import { Routes } from '@/app/routes';
import { useDevicesStore } from '@/platform/devices/device-store';
import { DEVICE_TYPE_LABEL, IOT_SCENARIOS, IOT_TIMINGS } from '@/platform/devices/iot-mock';
import type { Device, DeviceStatus } from '@/platform/devices/types';
import devicesEmptyUrl from '../../../../assets/illustrations/devices-empty.svg';
import { useLocale, type MessageKey } from '@/lib/i18n';

const STATUS_META: Record<DeviceStatus, { dot: string; labelKey: MessageKey }> = {
  online: { dot: 'bg-success', labelKey: 'device.online' }, busy: { dot: 'bg-warning', labelKey: 'device.busy' }, offline: { dot: 'bg-error', labelKey: 'device.offline' },
};

function formatBoundAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** `/devices` 我的设备：设备列表 + 三态在线状态 + [重连] [解绑]（MOCK IOT） */
export default function DeviceListPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const { t } = useLocale();
  const flags = useMockScenarios((s) => s.flags);
  const devices = useDevicesStore((s) => s.devices);
  const removeDevice = useDevicesStore((s) => s.removeDevice);
  const setStatus = useDevicesStore((s) => s.setStatus);

  const [reconnectingId, setReconnectingId] = useState<string | null>(null);
  const [unbindTarget, setUnbindTarget] = useState<Device | null>(null);
  const [unbinding, setUnbinding] = useState(false);

  /** 重连（Mock：1.5s；注入面板 device.reconnectFail 触发失败） */
  const reconnect = (device: Device) => {
    setReconnectingId(device.id);
    window.setTimeout(() => {
      setReconnectingId(null);
      if (isScenarioOn(flags, IOT_SCENARIOS.reconnectFail)) {
        toast.error(t('device.reconnectFailed'));
        return;
      }
      setStatus(device.id, 'online');
      toast.success(t('device.reconnected', { alias: device.alias }));
    }, IOT_TIMINGS.reconnectMs);
  };

  /** 解绑（二次确认；注入面板 device.unbindFail 触发失败） */
  const confirmUnbind = () => {
    if (!unbindTarget) return;
    setUnbinding(true);
    window.setTimeout(() => {
      setUnbinding(false);
      if (isScenarioOn(flags, IOT_SCENARIOS.unbindFail)) {
        toast.error(t('device.unbindFailed'));
        return;
      }
      removeDevice(unbindTarget.id);
      setUnbindTarget(null);
      toast.success(t('device.unbound', { alias: unbindTarget.alias }));
    }, 800);
  };

  return (
    <div className="flex flex-col gap-4" data-debug-id="app.devices.list">
      <header className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <div>
            <h1 className="text-lg font-semibold text-gray-900">{t('device.myDevices')}</h1>
            <p className="mt-0.5 text-xs text-gray-500">
              {t('device.statusLegend')}
            </p>
          </div>
          <Badge variant="warning" className="ml-1">MOCK IOT</Badge>
        </div>
        <Button size="sm" onClick={() => navigate(Routes.deviceBind)}>
          <Plus size={14} />
          {t('device.bindNew')}
        </Button>
      </header>

      {devices.length === 0 ? (
        <EmptyState
          illustration={
            <img src={devicesEmptyUrl} alt="" className="h-36 w-48 text-gray-300" />
          }
          title={t('device.empty')}
          action={
            <Button size="sm" onClick={() => navigate(Routes.deviceBind)}>
              {t('device.goBind')}
            </Button>
          }
          className="min-h-[320px]"
        />
      ) : (
        <Card padding="none" className="overflow-hidden">
          {/* 表头 */}
          <div className="grid grid-cols-[1.4fr_1fr_0.8fr_1fr_auto] items-center gap-3 border-b border-gray-200 bg-gray-50 px-4 py-2 text-nano font-semibold uppercase tracking-wide text-gray-400">
            <span>{t('device.alias')}</span><span>{t('device.type')}</span><span>{t('device.status')}</span><span>{t('device.boundAt')}</span><span className="text-right">{t('device.actions')}</span>
          </div>
          {devices.map((device) => {
            const meta = STATUS_META[device.status];
            const reconnecting = reconnectingId === device.id;
            return (
              <div
                key={device.id}
                className={cx(
                  'grid grid-cols-[1.4fr_1fr_0.8fr_1fr_auto] items-center gap-3 border-b border-gray-100 px-4 py-3',
                  'transition-colors duration-fast last:border-b-0 hover:bg-gray-50',
                )}
              >
                <div className="flex min-w-0 items-center gap-2">
                  <Monitor size={15} className="shrink-0 text-gray-400" />
                  <span className="truncate text-sm font-medium text-gray-900">{device.alias}</span>
                  {device.type === 'scanner' && (
                    <Badge variant="info" className="shrink-0 text-nano">{t('device.mesSync')}</Badge>
                  )}
                </div>
                <span className="text-xs text-gray-600">{DEVICE_TYPE_LABEL[device.type]}</span>
                <span className="flex items-center gap-1.5 text-xs text-gray-700">
                  <span className={cx('h-2 w-2 rounded-full', meta.dot)} />
                  {t(meta.labelKey)}
                </span>
                <span className="text-xs text-gray-500 tnum">{formatBoundAt(device.boundAt)}</span>
                <span className="flex items-center justify-end gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={reconnecting}
                    onClick={() => reconnect(device)}
                  >
                    {reconnecting ? <Spinner size={12} /> : <RefreshCw size={12} />}
                    {t('device.reconnect')}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setUnbindTarget(device)}>
                    <Unlink size={12} />
                    {t('device.unbind')}
                  </Button>
                </span>
              </div>
            );
          })}
        </Card>
      )}

      {/* 解绑二次确认 */}
      <Modal
        open={unbindTarget !== null}
        onClose={() => setUnbindTarget(null)}
        title={t('device.unbindTitle')}
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setUnbindTarget(null)}>
              {t('common.cancel')}
            </Button>
            <Button variant="danger" size="sm" loading={unbinding} onClick={confirmUnbind}>
              {t('device.confirmUnbind')}
            </Button>
          </>
        }
      >
        {t('device.confirmUnbindText', { alias: unbindTarget?.alias ?? '' })}
      </Modal>

      {/* 底部快捷入口（空列表以外也可见） */}
      {devices.length > 0 && (
        <p className="text-xs text-gray-400">
          {t('device.needNew')} <Link to={Routes.deviceBind} className="text-primary hover:underline">{t('device.openWizard')}</Link>
        </p>
      )}
    </div>
  );
}
