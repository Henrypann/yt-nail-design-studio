/**
 * WebUSB 绑定传输。同页回退「用数据线绑定」。
 * 能力缺失 / 未找到设备 → BIND_USB_NOT_FOUND；权限拒绝 → BIND_USB_DENIED。
 * 绝不改走 WebBluetooth。
 *
 * 证据等级：prototype。真实 USB 描述符与固件未签收，不得标 physically-validated。
 */

import { mapBindErrorV1 } from '../bind-error-codes';
import type { DiscoveredDevice } from '../types';
import {
  bindTransportUnavailableResultV1,
  detectBindTransportCapabilityV1,
  mapBindTransportExceptionV1,
  readBindTransportEnvV1,
  type BindTransportCapabilityV1,
  type BindTransportEnvV1,
  type BindTransportPortV1,
  type BindTransportResultV1,
  type BindTransportUsbApiV1,
} from './bind-transport-port';

export interface WebUsbTransportDepsV1 {
  readEnv?: () => BindTransportEnvV1;
  getUsb?: () => BindTransportUsbApiV1 | null;
}

function defaultUsb(): BindTransportUsbApiV1 | null {
  const nav = (globalThis as { navigator?: { usb?: BindTransportUsbApiV1 } }).navigator;
  return nav?.usb ?? null;
}

function serialFromUsb(device: { serialNumber?: string; vendorId: number; productId: number }): string {
  const serial = device.serialNumber?.trim();
  if (serial && serial.length > 0) return serial.startsWith('SN-') ? serial : `SN-${serial}`;
  const compact = `${device.vendorId.toString(16)}${device.productId.toString(16)}`.toUpperCase().padStart(8, '0');
  return `SN-${compact}`;
}

function deviceCodeFromUsb(device: { vendorId: number; productId: number }): string {
  const compact = `${device.vendorId.toString(16)}${device.productId.toString(16)}`
    .replace(/[^a-fA-F0-9]/g, '')
    .slice(-6)
    .toUpperCase()
    .padStart(6, '0');
  return `NS-${compact}`;
}

export function createWebUsbTransport(deps: WebUsbTransportDepsV1 = {}): BindTransportPortV1 {
  const readEnv = deps.readEnv ?? readBindTransportEnvV1;
  const getUsb = deps.getUsb ?? defaultUsb;

  const detectCapability = (env?: BindTransportEnvV1): BindTransportCapabilityV1 =>
    detectBindTransportCapabilityV1('usb', env ?? readEnv());

  let lastRaw: Awaited<ReturnType<BindTransportUsbApiV1['requestDevice']>> | null = null;

  const port: BindTransportPortV1 = {
    kind: 'usb',
    detectCapability,
    async discover(): Promise<BindTransportResultV1> {
      const capability = detectCapability();
      if (!capability.available) return bindTransportUnavailableResultV1(capability);
      const usb = getUsb();
      if (!usb) {
        return { ok: false, code: mapBindErrorV1('BIND_USB_NOT_FOUND') };
      }
      try {
        const raw = await usb.requestDevice({ filters: [] });
        lastRaw = raw;
        const device: DiscoveredDevice = {
          deviceCode: deviceCodeFromUsb(raw),
          serialNumber: serialFromUsb(raw),
          type: 'printer_3d',
          foundVia: 'usb',
        };
        if (device.serialNumber === device.deviceCode) {
          device.serialNumber = `SN-${device.deviceCode.replace(/^NS-/, '')}`;
        }
        return { ok: true, device };
      } catch (error) {
        lastRaw = null;
        return { ok: false, code: mapBindTransportExceptionV1('usb', 'discover', error) };
      }
    },
    async pair(device: DiscoveredDevice): Promise<BindTransportResultV1> {
      const capability = detectCapability();
      if (!capability.available) {
        return bindTransportUnavailableResultV1(capability);
      }
      const raw = lastRaw;
      if (!raw) {
        return { ok: false, code: mapBindErrorV1('BIND_USB_NOT_FOUND') };
      }
      try {
        if (!raw.opened) {
          await raw.open();
        }
        return { ok: true, device };
      } catch (error) {
        return { ok: false, code: mapBindTransportExceptionV1('usb', 'pair', error) };
      }
    },
    async wifiHandoff(
      device: DiscoveredDevice,
      wifi: { ssid: string; password: string },
    ): Promise<BindTransportResultV1> {
      const capability = detectCapability();
      if (!capability.available) {
        return bindTransportUnavailableResultV1(capability);
      }
      if (!wifi.ssid.trim() || !wifi.password) {
        return { ok: false, code: mapBindErrorV1('BIND_USB_NOT_FOUND') };
      }
      // Prototype：USB 控制传输写 Wi-Fi 凭据未经固件签收。凭据不落盘。
      return { ok: true, device };
    },
  };

  return port;
}

export const webUsbTransport: BindTransportPortV1 = createWebUsbTransport();
