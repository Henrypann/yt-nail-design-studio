/**
 * 工作站绑定传输端口 V1。
 *
 * 可替换实现：WebBluetooth / WebUSB / 同路径 mock（CI/demo）。
 * 能力探测失败必须落到冻结 BindErrorCodeV1，禁止返回 UNMAPPED，
 * 禁止静默改走另一条路径（蓝牙失败不得改 USB，反之亦然）。
 */

import {
  mapBindErrorV1,
  type BindErrorCodeV1,
} from '../bind-error-codes';
import type { BindPath, DiscoveredDevice } from '../types';

export type BindTransportKindV1 = BindPath;

export type BindTransportCapabilityReasonV1 =
  | 'ok'
  | 'missing-api'
  | 'insecure-context';

export type BindTransportCapabilityV1 =
  | {
      kind: BindTransportKindV1;
      available: true;
      reason: 'ok';
    }
  | {
      kind: BindTransportKindV1;
      available: false;
      reason: Exclude<BindTransportCapabilityReasonV1, 'ok'>;
      /** 已定义冻结码，永不 UNMAPPED。 */
      unavailableCode: BindErrorCodeV1;
    };

export interface BindTransportEnvV1 {
  hasBluetooth: boolean;
  hasUsb: boolean;
  isSecureContext: boolean;
}

export interface BindTransportGlobalV1 {
  isSecureContext?: boolean;
  navigator?: {
    bluetooth?: unknown;
    usb?: unknown;
  };
}

export interface BindTransportBluetoothDeviceV1 {
  id: string;
  name?: string;
  gatt?: {
    connected: boolean;
    connect(): Promise<unknown>;
  };
}

export interface BindTransportBluetoothApiV1 {
  requestDevice(options: {
    acceptAllDevices?: boolean;
    optionalServices?: string[];
    filters?: Array<{ namePrefix?: string; services?: string[] }>;
  }): Promise<BindTransportBluetoothDeviceV1>;
}

export interface BindTransportUsbDeviceV1 {
  serialNumber?: string;
  productName?: string;
  vendorId: number;
  productId: number;
  opened: boolean;
  open(): Promise<void>;
}

export interface BindTransportUsbApiV1 {
  requestDevice(options: {
    filters: Array<{ vendorId?: number; classCode?: number }>;
  }): Promise<BindTransportUsbDeviceV1>;
}

export type BindTransportFailureV1 = {
  ok: false;
  code: BindErrorCodeV1;
};

export type BindTransportSuccessV1 = {
  ok: true;
  device: DiscoveredDevice;
};

export type BindTransportResultV1 = BindTransportSuccessV1 | BindTransportFailureV1;

export type BindTransportPhaseV1 = 'discover' | 'pair' | 'wifi-handoff';

export interface BindTransportPortV1 {
  readonly kind: BindTransportKindV1;
  detectCapability(env?: BindTransportEnvV1): BindTransportCapabilityV1;
  discover(): Promise<BindTransportResultV1>;
  pair(device: DiscoveredDevice): Promise<BindTransportResultV1>;
  wifiHandoff(
    device: DiscoveredDevice,
    wifi: { ssid: string; password: string },
  ): Promise<BindTransportResultV1>;
}

export function readBindTransportEnvV1(
  globalObj: BindTransportGlobalV1 = globalThis as BindTransportGlobalV1,
): BindTransportEnvV1 {
  const nav = globalObj.navigator;
  return {
    hasBluetooth: Boolean(nav && nav.bluetooth),
    hasUsb: Boolean(nav && nav.usb),
    isSecureContext: globalObj.isSecureContext === true,
  };
}

/**
 * 能力探测。失败码按 kind 冻结，互不串路。
 */
export function detectBindTransportCapabilityV1(
  kind: BindTransportKindV1,
  env: BindTransportEnvV1,
): BindTransportCapabilityV1 {
  if (kind === 'bluetooth') {
    if (!env.hasBluetooth) {
      return {
        kind,
        available: false,
        reason: 'missing-api',
        unavailableCode: mapBindErrorV1('BIND_BT_DISCOVER_FAILED'),
      };
    }
    if (!env.isSecureContext) {
      return {
        kind,
        available: false,
        reason: 'insecure-context',
        unavailableCode: mapBindErrorV1('BIND_BT_DISCOVER_FAILED'),
      };
    }
    return { kind, available: true, reason: 'ok' };
  }

  if (!env.hasUsb) {
    return {
      kind,
      available: false,
      reason: 'missing-api',
      unavailableCode: mapBindErrorV1('BIND_USB_NOT_FOUND'),
    };
  }
  if (!env.isSecureContext) {
    return {
      kind,
      available: false,
      reason: 'insecure-context',
      unavailableCode: mapBindErrorV1('BIND_USB_DENIED'),
    };
  }
  return { kind, available: true, reason: 'ok' };
}

function errorName(error: unknown): string {
  if (error && typeof error === 'object' && 'name' in error && typeof (error as { name: unknown }).name === 'string') {
    return (error as { name: string }).name;
  }
  return '';
}

/**
 * DOM / 传输异常 → 冻结码。未知输入走 mapBindErrorV1，永不 UNMAPPED。
 * bluetooth 相位失败不得落到 USB 码；usb 不得落到 BT 码。
 */
export function mapBindTransportExceptionV1(
  kind: BindTransportKindV1,
  phase: BindTransportPhaseV1,
  error: unknown,
): BindErrorCodeV1 {
  if (kind === 'bluetooth') {
    if (phase === 'pair') return mapBindErrorV1('BIND_BT_PAIR_FAILED');
    if (phase === 'wifi-handoff') return mapBindErrorV1('BIND_BT_WIFI_HANDOFF_FAILED');
    return mapBindErrorV1('BIND_BT_DISCOVER_FAILED');
  }

  const name = errorName(error);
  if (name === 'NotAllowedError' || name === 'SecurityError') {
    return mapBindErrorV1('BIND_USB_DENIED');
  }
  if (phase === 'pair' && (name === 'NotAllowedError' || name === 'SecurityError')) {
    return mapBindErrorV1('BIND_USB_DENIED');
  }
  return mapBindErrorV1('BIND_USB_NOT_FOUND');
}

export function bindTransportUnavailableResultV1(
  capability: BindTransportCapabilityV1,
): BindTransportFailureV1 {
  if (capability.available) {
    return {
      ok: false,
      code: mapBindErrorV1(
        capability.kind === 'bluetooth' ? 'BIND_BT_DISCOVER_FAILED' : 'BIND_USB_NOT_FOUND',
      ),
    };
  }
  return { ok: false, code: mapBindErrorV1(capability.unavailableCode) };
}
