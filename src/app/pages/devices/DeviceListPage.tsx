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

const STATUS_META: Record<DeviceStatus, { dot: string; label: string }> = {
  online: { dot: 'bg-success', label: '在线' },
  busy: { dot: 'bg-warning', label: '繁忙' },
  offline: { dot: 'bg-error', label: '离线' },
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
        toast.error('重连失败：设备无响应。请检查设备电源和网络。');
        return;
      }
      setStatus(device.id, 'online');
      toast.success(`「${device.alias}」已重新连接。`);
    }, IOT_TIMINGS.reconnectMs);
  };

  /** 解绑（二次确认；注入面板 device.unbindFail 触发失败） */
  const confirmUnbind = () => {
    if (!unbindTarget) return;
    setUnbinding(true);
    window.setTimeout(() => {
      setUnbinding(false);
      if (isScenarioOn(flags, IOT_SCENARIOS.unbindFail)) {
        toast.error('解绑失败：请重试。');
        return;
      }
      removeDevice(unbindTarget.id);
      setUnbindTarget(null);
      toast.success(`「${unbindTarget.alias}」已解绑。`);
    }, 800);
  };

  return (
    <div className="flex flex-col gap-4" data-debug-id="app.devices.list">
      <header className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <div>
            <h1 className="text-lg font-semibold text-gray-900">我的设备</h1>
            <p className="mt-0.5 text-xs text-gray-500">
              在线状态：🟢 在线 / 🟡 繁忙 / 🔴 离线
            </p>
          </div>
          <Badge variant="warning" className="ml-1">MOCK IOT</Badge>
        </div>
        <Button size="sm" onClick={() => navigate(Routes.deviceBind)}>
          <Plus size={14} />
          绑定新设备
        </Button>
      </header>

      {devices.length === 0 ? (
        <EmptyState
          illustration={
            <img src={devicesEmptyUrl} alt="" className="h-36 w-48 text-gray-300" />
          }
          title="还没有绑定设备。绑定设备后可以在这里查看在线状态"
          action={
            <Button size="sm" onClick={() => navigate(Routes.deviceBind)}>
              去绑定设备
            </Button>
          }
          className="min-h-[320px]"
        />
      ) : (
        <Card padding="none" className="overflow-hidden">
          {/* 表头 */}
          <div className="grid grid-cols-[1.4fr_1fr_0.8fr_1fr_auto] items-center gap-3 border-b border-gray-200 bg-gray-50 px-4 py-2 text-nano font-semibold uppercase tracking-wide text-gray-400">
            <span>设备别名</span>
            <span>类型</span>
            <span>在线状态</span>
            <span>绑定时间</span>
            <span className="text-right">操作</span>
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
                    <Badge variant="info" className="shrink-0 text-nano">不同步 MES</Badge>
                  )}
                </div>
                <span className="text-xs text-gray-600">{DEVICE_TYPE_LABEL[device.type]}</span>
                <span className="flex items-center gap-1.5 text-xs text-gray-700">
                  <span className={cx('h-2 w-2 rounded-full', meta.dot)} />
                  {meta.label}
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
                    重连
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setUnbindTarget(device)}>
                    <Unlink size={12} />
                    解绑
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
        title="解绑设备"
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setUnbindTarget(null)}>
              取消
            </Button>
            <Button variant="danger" size="sm" loading={unbinding} onClick={confirmUnbind}>
              确认解绑
            </Button>
          </>
        }
      >
        确定解绑「{unbindTarget?.alias}」吗？解绑后需要重新配网才能使用该设备。
      </Modal>

      {/* 底部快捷入口（空列表以外也可见） */}
      {devices.length > 0 && (
        <p className="text-xs text-gray-400">
          需要新增设备？<Link to={Routes.deviceBind} className="text-primary hover:underline">进入配网向导</Link>
        </p>
      )}
    </div>
  );
}
