/**
 * 设备模块（模块 2 · 工作站绑定）领域类型
 * 依据：Studio-PRD §四；Week 0 评估 PR2 将绑定路径收敛为 2 条。
 * Device 基础类型复用 src/lib/types.ts。
 */

import type { Device, DeviceActivationStateV1, DeviceStatus, DeviceType } from '@/lib/types';

export type { Device, DeviceActivationStateV1, DeviceStatus, DeviceType };

/**
 * 工作站绑定路径（PR2：4→2）。
 * - bluetooth：主路径「搜索机器」= WebBluetooth
 * - usb：同页回退「用数据线绑定」= WebUSB
 *
 * `lan` 不是绑定路径（属于未来 Job 传输回退 JOB_FALLBACK_LAN）。
 * 手机 Wi-Fi 代填不是 BindPath，见 BindWifiHelperMode。
 */
export type BindPath = 'bluetooth' | 'usb';

/** 配网向导步骤（PRD §4.3 六步） */
export type BindStep = 1 | 2 | 3 | 4 | 5 | 6;

/**
 * Step 3 可选的 Wi-Fi 凭据输入方式。
 * 不是绑定路径：不得发现设备、不得做 SN 校验、不得 cloud-register、不得下发 Job。
 */
export type BindWifiHelperMode = 'workstation' | 'mobile';

/** Step 2 发现到的设备（未写入 Device store） */
export interface DiscoveredDevice {
  deviceCode: string; // device_code，绑定凭据；并发锁以此为键
  /**
   * 出厂序列号。与 deviceCode 是两个标识。
   * hop1 SN 判重 / BIND_SN_MISMATCH 双显使用此字段，不得用 deviceCode 冒充。
   */
  serialNumber: string;
  type: DeviceType;
  foundVia: BindPath;
}

/** 配网向导会话（localStorage 持久化，5 分钟 TTL 恢复进度；WiFi 密码永不写入） */
export interface BindSession {
  step: BindStep;
  path: BindPath | null;
  device: DiscoveredDevice | null;
  wifiSsid: string;
  /** 手机 Wi-Fi 代填当前发放的 Token（桌面端轮询其完成态） */
  mobileToken?: string;
  alias: string;
  updatedAt: number; // epoch ms，TTL 判断基准
  /**
   * hop1 已写入本地 Device store 后为 true。
   * CLOUD_REGISTER_FAILED 只重试 hop2，恢复会话时不得重跑 hop1。
   */
  hop1Completed?: boolean;
  /** hop1 落库后的本地 Device.id，hop2 只更新这一条。 */
  localDeviceId?: string;
}

/** 手机辅助配网 Token 记录（PRD §4.5：过期 / 重复使用 两态） */
export interface MobileTokenRecord {
  token: string;
  deviceCode: string;
  createdAt: number; // epoch ms
  used: boolean;
  /** 手机端提交成功的 WiFi 凭据（密码仅此一处短暂停留，绑定完成后清除） */
  wifi?: { ssid: string; password: string };
}

/** 并发绑定锁（同 deviceCode 跨标签互斥） */
export interface BindLock {
  deviceCode: string;
  tabId: string;
  acquiredAt: number; // epoch ms
}

export function isBindPath(value: unknown): value is BindPath {
  return value === 'bluetooth' || value === 'usb';
}
