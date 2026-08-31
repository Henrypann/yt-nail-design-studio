/**
 * StorageKeys.devices envelope 版本与身份字段迁移。
 *
 * v1 载荷：Device[]（无 serialNumber / storeId / activationState / nailProfileRef）。
 * v2 载荷：同一数组，每条补齐身份字段。键名仍是 StorageKeys.devices，旧记录不得丢失。
 */

import type { Device, DeviceActivationStateV1, DeviceStatus, DeviceType } from '@/lib/types';
import { DEVICE_ACTIVATION_STATES_V1 } from '@/lib/types';

export const DEVICES_ENVELOPE_VERSION = 2;

const DEVICE_TYPES: readonly DeviceType[] = ['scanner', 'printer_3d', 'uv_printer'];
const DEVICE_STATUSES: readonly DeviceStatus[] = ['online', 'offline', 'busy'];

function isDeviceType(value: unknown): value is DeviceType {
  return typeof value === 'string' && (DEVICE_TYPES as readonly string[]).includes(value);
}

function isDeviceStatus(value: unknown): value is DeviceStatus {
  return typeof value === 'string' && (DEVICE_STATUSES as readonly string[]).includes(value);
}

function isActivationState(value: unknown): value is DeviceActivationStateV1 {
  return typeof value === 'string' && (DEVICE_ACTIVATION_STATES_V1 as readonly string[]).includes(value);
}

function asOptionalIso(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function asNailProfileRef(value: unknown): string | null {
  if (typeof value === 'string') return value;
  return null;
}

function hasV2IdentityFields(raw: unknown): boolean {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return false;
  const rec = raw as Record<string, unknown>;
  return (
    typeof rec.serialNumber === 'string' &&
    typeof rec.storeId === 'string' &&
    isActivationState(rec.activationState) &&
    (rec.nailProfileRef === undefined || rec.nailProfileRef === null || typeof rec.nailProfileRef === 'string')
  );
}

/** 单条设备记录：v1 缺字段补默认值；v2 原样规范化。无法识别则返回 null。 */
export function migrateDeviceRecordV1(raw: unknown): Device | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const rec = raw as Record<string, unknown>;
  if (typeof rec.id !== 'string' || rec.id.length === 0) return null;
  if (typeof rec.alias !== 'string') return null;
  if (!isDeviceType(rec.type)) return null;
  if (!isDeviceStatus(rec.status)) return null;
  if (typeof rec.deviceCode !== 'string' || rec.deviceCode.length === 0) return null;
  if (typeof rec.boundAt !== 'string') return null;

  const device: Device = {
    id: rec.id,
    alias: rec.alias,
    type: rec.type,
    status: rec.status,
    deviceCode: rec.deviceCode,
    serialNumber: typeof rec.serialNumber === 'string' ? rec.serialNumber : '',
    storeId: typeof rec.storeId === 'string' ? rec.storeId : '',
    activationState: isActivationState(rec.activationState) ? rec.activationState : 'not_activated',
    nailProfileRef: asNailProfileRef(rec.nailProfileRef),
    boundAt: rec.boundAt,
  };
  const lastSeenAt = asOptionalIso(rec.lastSeenAt);
  if (lastSeenAt !== undefined) device.lastSeenAt = lastSeenAt;
  return device;
}

export interface DevicesEnvelopeMigrationV1 {
  devices: Device[];
  version: number;
  changed: boolean;
}

function migrateDeviceList(data: unknown): Device[] {
  if (!Array.isArray(data)) return [];
  const devices: Device[] = [];
  for (const item of data) {
    const migrated = migrateDeviceRecordV1(item);
    if (migrated) devices.push(migrated);
  }
  return devices;
}

function readEnvelopeParts(raw: unknown): { version: number; data: unknown } | null {
  if (raw == null) return null;
  if (Array.isArray(raw)) return { version: 1, data: raw };
  if (typeof raw === 'object' && 'data' in raw) {
    const env = raw as { v?: unknown; data?: unknown };
    return {
      version: typeof env.v === 'number' ? env.v : 1,
      data: env.data,
    };
  }
  return { version: 1, data: raw };
}

/**
 * 读取任意历史 envelope / 裸数组，产出 v2 Device[]。
 * 幂等：对已是 v2 且身份字段齐全的输入，changed=false，二次迁移深度相等。
 */
export function migrateDevicesEnvelope(raw: unknown): DevicesEnvelopeMigrationV1 {
  const parts = readEnvelopeParts(raw);
  if (!parts) {
    return { devices: [], version: DEVICES_ENVELOPE_VERSION, changed: false };
  }

  const devices = migrateDeviceList(parts.data);
  const sourceList = Array.isArray(parts.data) ? parts.data : [];
  const alreadyCanonical =
    parts.version >= DEVICES_ENVELOPE_VERSION &&
    sourceList.length === devices.length &&
    sourceList.every(hasV2IdentityFields);

  return {
    devices,
    version: DEVICES_ENVELOPE_VERSION,
    changed: !alreadyCanonical,
  };
}
