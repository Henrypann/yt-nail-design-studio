/**
 * 同路径 mock 传输：真实 WebBluetooth / WebUSB 不可用时的 CI/demo 通道。
 * 只服务当前 kind，禁止改走另一条绑定路径。
 *
 * 不 import mock-panel（.tsx），以便 Node 单测直接加载。
 */

import { mapBindErrorV1, type BindErrorCodeV1 } from '../bind-error-codes';
import { IOT_SCENARIOS, IOT_TIMINGS, mockDiscoverDevice } from '../iot-mock';
import type { BindPath, DiscoveredDevice } from '../types';
import {
  detectBindTransportCapabilityV1,
  type BindTransportCapabilityV1,
  type BindTransportEnvV1,
  type BindTransportPortV1,
  type BindTransportResultV1,
} from './bind-transport-port';

export interface MockBindTransportDepsV1 {
  kind: BindPath;
  env?: BindTransportEnvV1;
  scenarioFlags?: Record<string, boolean>;
  sleep?: (ms: number) => Promise<void>;
}

const DEFAULT_ENV: BindTransportEnvV1 = {
  hasBluetooth: false,
  hasUsb: false,
  isSecureContext: false,
};

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function flagOn(flags: Record<string, boolean>, key: string): boolean {
  return flags[key] === true;
}

function fail(code: BindErrorCodeV1): BindTransportResultV1 {
  return { ok: false, code: mapBindErrorV1(code) };
}

export function createMockBindTransport(deps: MockBindTransportDepsV1): BindTransportPortV1 {
  const kind = deps.kind;
  const flags = deps.scenarioFlags ?? {};
  const sleep = deps.sleep ?? wait;

  const detectCapability = (env?: BindTransportEnvV1): BindTransportCapabilityV1 =>
    detectBindTransportCapabilityV1(kind, env ?? deps.env ?? DEFAULT_ENV);

  const port: BindTransportPortV1 = {
    kind,
    detectCapability,
    async discover(): Promise<BindTransportResultV1> {
      if (kind === 'usb' && flagOn(flags, IOT_SCENARIOS.usbDenied)) {
        await sleep(0);
        return fail('BIND_USB_DENIED');
      }
      if (kind === 'usb' && flagOn(flags, IOT_SCENARIOS.usbNotFound)) {
        await sleep(0);
        return fail('BIND_USB_NOT_FOUND');
      }
      if (flagOn(flags, IOT_SCENARIOS.discoverTimeout)) {
        await sleep(IOT_TIMINGS.discoveryTimeoutMs);
        return fail(kind === 'usb' ? 'BIND_USB_NOT_FOUND' : 'BIND_BT_DISCOVER_FAILED');
      }
      await sleep(IOT_TIMINGS.discoveryScanMs);
      return { ok: true, device: mockDiscoverDevice(kind) };
    },
    async pair(device: DiscoveredDevice): Promise<BindTransportResultV1> {
      if (kind === 'bluetooth' && flagOn(flags, IOT_SCENARIOS.btPairFailed)) {
        return fail('BIND_BT_PAIR_FAILED');
      }
      if (kind === 'usb' && flagOn(flags, IOT_SCENARIOS.usbDenied)) {
        return fail('BIND_USB_DENIED');
      }
      return { ok: true, device };
    },
    async wifiHandoff(
      device: DiscoveredDevice,
      wifi: { ssid: string; password: string },
    ): Promise<BindTransportResultV1> {
      if (!wifi.ssid.trim() || !wifi.password) {
        return fail(kind === 'bluetooth' ? 'BIND_BT_WIFI_HANDOFF_FAILED' : 'BIND_USB_NOT_FOUND');
      }
      if (flagOn(flags, IOT_SCENARIOS.wifiWrong)) {
        return fail('BIND_BT_WIFI_HANDOFF_FAILED');
      }
      return { ok: true, device };
    },
  };

  return port;
}
