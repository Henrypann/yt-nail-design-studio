/**
 * MOCK IOT 常量与 Mock 设备生成器（模块 2）
 * 计时参数对齐 Studio-PRD §4.3 / §4.5 / §八 超时策略。
 */

import type { BindPath, DeviceType, DiscoveredDevice } from './types';

/** 配网/异常计时（毫秒） */
export const IOT_TIMINGS = {
  /** 正常发现设备耗时（模拟扫描动画） */
  discoveryScanMs: 2600,
  /** 设备发现超时（PRD §4.5 / §八：15s） */
  discoveryTimeoutMs: 15_000,
  /** 配网进度 0→100% 时长（PRD §4.3：约 3-5 秒） */
  provisionMinMs: 3_000,
  provisionMaxMs: 5_000,
  /** 设备入网超时（PRD §4.5 / §八：30s） */
  joinTimeoutMs: 30_000,
  /** 配网向导会话恢复 TTL（PRD §4.5：5 分钟） */
  bindSessionTtlMs: 5 * 60_000,
  /** 手机辅助 Token 有效期（对齐验证码 5 分钟） */
  mobileTokenTtlMs: 5 * 60_000,
  /** 并发绑定锁 TTL（防死锁兜底） */
  bindLockTtlMs: 2 * 60_000,
  /** 重连操作模拟耗时 */
  reconnectMs: 1_500,
} as const;

/** Mock 场景 key（与 src/lib/mock-panel.tsx 的 MOCK_SCENARIOS 一一对应） */
export const IOT_SCENARIOS = {
  discoverTimeout: 'device.discoverTimeout',
  wifiWrong: 'device.wifiWrong',
  bindTimeout: 'device.bindTimeout',
  alreadyBound: 'device.alreadyBound',
  tokenExpired: 'device.tokenExpired',
  tokenReused: 'device.tokenReused',
  reconnectFail: 'device.reconnectFail',
  unbindFail: 'device.unbindFail',
  concurrentBind: 'device.concurrentBind',
  cloudRegisterFailed: 'device.cloudRegisterFailed',
  snMismatch: 'device.snMismatch',
  btPairFailed: 'device.btPairFailed',
  usbNotFound: 'device.usbNotFound',
  usbDenied: 'device.usbDenied',
} as const;

export const DEVICE_TYPE_LABEL: Record<DeviceType, string> = {
  scanner: '扫描仪',
  printer_3d: '3D 打印机',
  uv_printer: '喷绘机',
};

export const BIND_PATH_LABEL: Record<BindPath, string> = {
  bluetooth: '蓝牙配网',
  usb: 'USB 数据线配网',
};

const DEVICE_TYPES: readonly DeviceType[] = ['scanner', 'printer_3d', 'uv_printer'];

function randomHex(len: number): string {
  const chars = '0123456789ABCDEF';
  let out = '';
  for (let i = 0; i < len; i += 1) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

/** Mock 发现一台设备（真实传输不可用时的同路径 demo 通道） */
export function mockDiscoverDevice(path: BindPath): DiscoveredDevice {
  const type = DEVICE_TYPES[Math.floor(Math.random() * DEVICE_TYPES.length)];
  const codeSuffix = randomHex(6);
  const serialSuffix = randomHex(8);
  return {
    deviceCode: `NS-${codeSuffix}`,
    serialNumber: `SN-${serialSuffix}`,
    type,
    foundVia: path,
  };
}

/** Mock 手机辅助 Token */
export function mockMobileToken(): string {
  return `MT-${randomHex(8)}`;
}

export function randomProvisionMs(): number {
  const { provisionMinMs, provisionMaxMs } = IOT_TIMINGS;
  return provisionMinMs + Math.random() * (provisionMaxMs - provisionMinMs);
}
