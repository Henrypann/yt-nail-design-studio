/**
 * 设备列表 Store（模块 2 · MOCK IOT）
 * 持久化：StorageKeys.devices envelope（与平台存储桥同一机制）。
 * 后端就绪后替换为设备域 6 端点的 repository 实现，UI 零改动。
 */

import { create } from 'zustand';
import { readData, writeEnvelope, StorageKeys } from '@/lib/storage';
import type { Device, DeviceStatus } from './types';

interface DevicesState {
  devices: Device[];
  /** 绑定完成：追加设备（初始在线） */
  addDevice: (device: Device) => void;
  /** 解绑成功：移除设备 */
  removeDevice: (id: string) => void;
  /** 更新在线状态（重连成功等） */
  setStatus: (id: string, status: DeviceStatus) => void;
}

function persist(devices: Device[]): void {
  writeEnvelope(StorageKeys.devices, devices);
}

export const useDevicesStore = create<DevicesState>((set, get) => ({
  devices: readData<Device[]>(StorageKeys.devices) ?? [],
  addDevice: (device) => {
    const devices = [...get().devices, device];
    persist(devices);
    set({ devices });
  },
  removeDevice: (id) => {
    const devices = get().devices.filter((d) => d.id !== id);
    persist(devices);
    set({ devices });
  },
  setStatus: (id, status) => {
    const devices = get().devices.map((d) =>
      d.id === id
        ? { ...d, status, lastSeenAt: status === 'online' ? new Date().toISOString() : d.lastSeenAt }
        : d,
    );
    persist(devices);
    set({ devices });
  },
}));

export function createBoundDevice(input: Omit<Device, 'id' | 'status' | 'boundAt'>): Device {
  return {
    ...input,
    id:
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `dev-${Date.now()}`,
    status: 'online',
    boundAt: new Date().toISOString(),
  };
}
