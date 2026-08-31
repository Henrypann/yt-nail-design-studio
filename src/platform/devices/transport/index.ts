/**
 * 选择绑定传输：真实 API 可用则走 WebBluetooth / WebUSB；
 * 不可用时仅允许同路径 mock（CI/demo），禁止静默改走另一 kind。
 */

import type { BindPath } from '../types';
import {
  detectBindTransportCapabilityV1,
  readBindTransportEnvV1,
  type BindTransportCapabilityV1,
  type BindTransportEnvV1,
  type BindTransportPortV1,
} from './bind-transport-port';
import { createMockBindTransport } from './mock-bind-transport';
import { createWebBluetoothTransport } from './web-bluetooth-transport';
import { createWebUsbTransport } from './web-usb-transport';

export interface SelectBindTransportOptionsV1 {
  env?: BindTransportEnvV1;
  /** 真实能力缺失时启用同路径 mock。默认 true（prototype / CI / demo）。 */
  allowMockWhenUnavailable?: boolean;
  scenarioFlags?: Record<string, boolean>;
}

export interface SelectedBindTransportV1 {
  port: BindTransportPortV1;
  usingMock: boolean;
  capability: BindTransportCapabilityV1;
}

export function selectBindTransportV1(
  kind: BindPath,
  options: SelectBindTransportOptionsV1 = {},
): SelectedBindTransportV1 {
  const env = options.env ?? readBindTransportEnvV1();
  const capability = detectBindTransportCapabilityV1(kind, env);
  const allowMock = options.allowMockWhenUnavailable !== false;

  if (capability.available) {
    const port =
      kind === 'bluetooth' ? createWebBluetoothTransport({ readEnv: () => env }) : createWebUsbTransport({ readEnv: () => env });
    return { port, usingMock: false, capability };
  }

  if (allowMock) {
    return {
      port: createMockBindTransport({
        kind,
        env,
        scenarioFlags: options.scenarioFlags,
      }),
      usingMock: true,
      capability,
    };
  }

  const port =
    kind === 'bluetooth' ? createWebBluetoothTransport({ readEnv: () => env }) : createWebUsbTransport({ readEnv: () => env });
  return { port, usingMock: false, capability };
}

export {
  detectBindTransportCapabilityV1,
  mapBindTransportExceptionV1,
  readBindTransportEnvV1,
  type BindTransportCapabilityV1,
  type BindTransportEnvV1,
  type BindTransportPortV1,
  type BindTransportResultV1,
} from './bind-transport-port';
export { createWebBluetoothTransport, webBluetoothTransport } from './web-bluetooth-transport';
export { createWebUsbTransport, webUsbTransport } from './web-usb-transport';
export { createMockBindTransport } from './mock-bind-transport';
