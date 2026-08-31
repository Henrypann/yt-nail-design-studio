/**
 * 设备模块（模块 2 · MOCK IOT）领域类型
 * 依据：Studio-PRD §四 设备绑定；Device 基础类型复用 src/lib/types.ts。
 */

import type { Device, DeviceActivationStateV1, DeviceStatus, DeviceType } from '@/lib/types';

export type { Device, DeviceActivationStateV1, DeviceStatus, DeviceType };

/** 四条配网路径（PRD §4.2，全部标注 MOCK IOT） */
export type BindPath = 'bluetooth' | 'mobile' | 'usb' | 'lan';

/** 配网向导步骤（PRD §4.3 六步） */
export type BindStep = 1 | 2 | 3 | 4 | 5 | 6;

/** Step 2 发现到的设备（Mock 生成，未绑定） */
export interface DiscoveredDevice {
  deviceCode: string; // device_code，绑定凭据
  type: DeviceType;
  foundVia: BindPath;
}

/** 配网向导会话（localStorage 持久化，5 分钟 TTL 恢复进度；WiFi 密码永不写入） */
export interface BindSession {
  step: BindStep;
  path: BindPath | null;
  device: DiscoveredDevice | null;
  wifiSsid: string;
  /** 手机辅助路径当前发放的 Token（桌面端轮询其完成态） */
  mobileToken?: string;
  alias: string;
  updatedAt: number; // epoch ms，TTL 判断基准
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
