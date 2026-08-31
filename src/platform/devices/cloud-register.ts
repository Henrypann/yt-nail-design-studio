/**
 * hop2 云注册原型。不是 Job / Artifact / 制造平面。
 * 失败只返回 CLOUD_REGISTER_FAILED，由两跳控制器决定只重试 hop2。
 *
 * 证据等级：prototype。无真实云端，不得标 physically-validated。
 */

import { mapBindErrorV1 } from './bind-error-codes';

export type CloudRegisterResultV1 =
  | { ok: true }
  | { ok: false; code: 'CLOUD_REGISTER_FAILED' };

export interface CloudRegisterInputV1 {
  deviceId: string;
  serialNumber: string;
  storeId: string;
}

export async function registerBoundDeviceCloudV1(
  input: CloudRegisterInputV1,
  options: { fail?: boolean } = {},
): Promise<CloudRegisterResultV1> {
  const mapped = mapBindErrorV1('CLOUD_REGISTER_FAILED');
  if (mapped !== 'CLOUD_REGISTER_FAILED') {
    return { ok: false, code: 'CLOUD_REGISTER_FAILED' };
  }
  if (!input.deviceId || !input.serialNumber || !input.storeId || options.fail) {
    return { ok: false, code: mapped };
  }
  return { ok: true };
}
