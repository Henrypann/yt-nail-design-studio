/**
 * WebBluetooth 绑定传输。主路径「搜索机器」。
 * 能力缺失或 API 失败 → BIND_BT_* 冻结码；绝不改走 USB。
 *
 * 证据等级：prototype。GATT 特征与真实固件未签收，不得标 physically-validated。
 */

import { mapBindErrorV1 } from '../bind-error-codes';
import type { DiscoveredDevice } from '../types';
import {
  bindTransportUnavailableResultV1,
  detectBindTransportCapabilityV1,
  mapBindTransportExceptionV1,
  readBindTransportEnvV1,
  type BindTransportBluetoothApiV1,
  type BindTransportBluetoothDeviceV1,
  type BindTransportCapabilityV1,
  type BindTransportEnvV1,
  type BindTransportPortV1,
  type BindTransportResultV1,
} from './bind-transport-port';

/** 原型占位：真实设备 GATT UUID 未经合同签收。 */
const PROTOTYPE_OPTIONAL_SERVICE = 'battery_service';

export interface WebBluetoothTransportDepsV1 {
  readEnv?: () => BindTransportEnvV1;
  getBluetooth?: () => BindTransportBluetoothApiV1 | null;
}

function defaultBluetooth(): BindTransportBluetoothApiV1 | null {
  const nav = (globalThis as { navigator?: { bluetooth?: BindTransportBluetoothApiV1 } }).navigator;
  return nav?.bluetooth ?? null;
}

function serialFromBluetooth(device: { id: string; name?: string }): string {
  const name = device.name?.trim() ?? '';
  if (/^SN[-_]/i.test(name)) return name;
  const compact = device.id.replace(/[^a-zA-Z0-9]/g, '').slice(-8).toUpperCase() || 'BT000001';
  return `SN-${compact}`;
}

function deviceCodeFromBluetooth(device: { id: string }): string {
  const compact = device.id.replace(/[^a-zA-Z0-9]/g, '').slice(0, 6).toUpperCase() || '000000';
  return `NS-${compact}`;
}

export function createWebBluetoothTransport(
  deps: WebBluetoothTransportDepsV1 = {},
): BindTransportPortV1 {
  const readEnv = deps.readEnv ?? readBindTransportEnvV1;
  const getBluetooth = deps.getBluetooth ?? defaultBluetooth;

  const detectCapability = (env?: BindTransportEnvV1): BindTransportCapabilityV1 =>
    detectBindTransportCapabilityV1('bluetooth', env ?? readEnv());

  let lastRaw: BindTransportBluetoothDeviceV1 | null = null;

  const port: BindTransportPortV1 = {
    kind: 'bluetooth',
    detectCapability,
    async discover(): Promise<BindTransportResultV1> {
      const capability = detectCapability();
      if (!capability.available) return bindTransportUnavailableResultV1(capability);
      const bluetooth = getBluetooth();
      if (!bluetooth) {
        return { ok: false, code: mapBindErrorV1('BIND_BT_DISCOVER_FAILED') };
      }
      try {
        const raw = await bluetooth.requestDevice({
          acceptAllDevices: true,
          optionalServices: [PROTOTYPE_OPTIONAL_SERVICE],
        });
        lastRaw = raw;
        const device: DiscoveredDevice = {
          deviceCode: deviceCodeFromBluetooth(raw),
          serialNumber: serialFromBluetooth(raw),
          type: 'printer_3d',
          foundVia: 'bluetooth',
        };
        if (device.serialNumber === device.deviceCode) {
          device.serialNumber = `SN-${device.deviceCode.replace(/^NS-/, '')}`;
        }
        return { ok: true, device };
      } catch (error) {
        lastRaw = null;
        return { ok: false, code: mapBindTransportExceptionV1('bluetooth', 'discover', error) };
      }
    },
    async pair(device: DiscoveredDevice): Promise<BindTransportResultV1> {
      const capability = detectCapability();
      if (!capability.available) {
        return { ok: false, code: mapBindErrorV1('BIND_BT_PAIR_FAILED') };
      }
      const raw = lastRaw;
      if (!raw) {
        return { ok: false, code: mapBindErrorV1('BIND_BT_PAIR_FAILED') };
      }
      try {
        if (raw.gatt && !raw.gatt.connected) {
          await raw.gatt.connect();
        }
        return { ok: true, device };
      } catch (error) {
        return { ok: false, code: mapBindTransportExceptionV1('bluetooth', 'pair', error) };
      }
    },
    async wifiHandoff(
      device: DiscoveredDevice,
      wifi: { ssid: string; password: string },
    ): Promise<BindTransportResultV1> {
      const capability = detectCapability();
      if (!capability.available) {
        return { ok: false, code: mapBindErrorV1('BIND_BT_WIFI_HANDOFF_FAILED') };
      }
      if (!wifi.ssid.trim() || !wifi.password) {
        return { ok: false, code: mapBindErrorV1('BIND_BT_WIFI_HANDOFF_FAILED') };
      }
      // Prototype：无已签收的 GATT Wi-Fi 特征。凭据在此消费且不落盘，不宣称物理入网。
      return { ok: true, device };
    },
  };

  return port;
}

export const webBluetoothTransport: BindTransportPortV1 = createWebBluetoothTransport();
