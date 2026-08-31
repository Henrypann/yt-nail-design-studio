/**
 * 工作站两跳绑定：hop1 本地落库 → hop2 云注册。
 *
 * CLOUD_REGISTER_FAILED 只重试 hop2，不得重跑 hop1（避免重复本地绑定）。
 * BIND_SN_MISMATCH 双显 expected / actual SN。
 * BIND_SN_ALREADY_BOUND：同店视为成功；异店拒绝且不提供强制绑定。
 *
 * 并发锁仍以 deviceCode 为键（bind-session）；SN 判重使用 serialNumber，二者不可冒充。
 */

import {
  bindSnMismatchDisplayV1,
  mapBindErrorV1,
  resolveSnAlreadyBound,
  type BindErrorCodeV1,
  type BindSnMismatchDisplayV1,
} from './bind-error-codes';
import { registerBoundDeviceCloudV1, type CloudRegisterResultV1 } from './cloud-register';
import type { Device } from './types';

export interface Hop1IncomingDeviceV1 {
  serialNumber: string;
  storeId: string;
  deviceCode: string;
}

export interface Hop1ExistingDeviceV1 {
  id: string;
  serialNumber: string;
  storeId: string;
  activationState: Device['activationState'];
}

export type Hop1LocalBindResultV1 =
  | {
      ok: true;
      skippedAdd: boolean;
      sameStoreReuse: boolean;
      deviceId: string | null;
    }
  | {
      ok: false;
      code: BindErrorCodeV1;
      snMismatch?: BindSnMismatchDisplayV1;
      forceBind?: false;
    };

export function resolveHop1LocalBindV1(input: {
  incoming: Hop1IncomingDeviceV1;
  existingDevices: readonly Hop1ExistingDeviceV1[];
  expectedSerialNumber?: string;
}): Hop1LocalBindResultV1 {
  const actual = input.incoming.serialNumber.trim();
  const expected = input.expectedSerialNumber?.trim() ?? '';
  if (expected.length > 0 && actual.length > 0 && expected !== actual) {
    return {
      ok: false,
      code: mapBindErrorV1('BIND_SN_MISMATCH'),
      snMismatch: bindSnMismatchDisplayV1({
        expectedSerialNumber: expected,
        actualSerialNumber: actual,
      }),
    };
  }

  if (actual.length > 0) {
    const bound = input.existingDevices.find((device) => device.serialNumber === actual);
    if (bound) {
      const resolution = resolveSnAlreadyBound({
        incomingStoreId: input.incoming.storeId,
        boundStoreId: bound.storeId,
      });
      if (resolution.outcome === 'success') {
        return {
          ok: true,
          skippedAdd: true,
          sameStoreReuse: true,
          deviceId: bound.id,
        };
      }
      return {
        ok: false,
        code: mapBindErrorV1('BIND_SN_ALREADY_BOUND'),
        forceBind: false,
      };
    }
  }

  return { ok: true, skippedAdd: false, sameStoreReuse: false, deviceId: null };
}

export interface TwoHopBindStateV1 {
  hop1Completed: boolean;
  hop1CallCount: number;
  hop2CallCount: number;
  localDeviceId: string | null;
}

export interface TwoHopBindControllerV1 {
  readonly state: TwoHopBindStateV1;
  restoreHop1(localDeviceId: string): void;
  runHop1(input: {
    incoming: Hop1IncomingDeviceV1;
    existingDevices: readonly Hop1ExistingDeviceV1[];
    expectedSerialNumber?: string;
    persist: () => string;
  }): Hop1LocalBindResultV1 & { hop1CallCount: number };
  runHop2(input: {
    serialNumber: string;
    storeId: string;
    fail?: boolean;
  }): Promise<CloudRegisterResultV1 & { retryHop: 2; hop2CallCount: number }>;
}

export function createTwoHopBindControllerV1(
  restored?: { hop1Completed?: boolean; localDeviceId?: string },
): TwoHopBindControllerV1 {
  const state: TwoHopBindStateV1 = {
    hop1Completed: restored?.hop1Completed === true,
    hop1CallCount: 0,
    hop2CallCount: 0,
    localDeviceId: restored?.localDeviceId ?? null,
  };

  if (state.hop1Completed && restored?.localDeviceId) {
    state.localDeviceId = restored.localDeviceId;
  }

  return {
    get state() {
      return { ...state };
    },
    restoreHop1(localDeviceId: string) {
      state.hop1Completed = true;
      state.localDeviceId = localDeviceId;
    },
    runHop1(input) {
      if (state.hop1Completed && state.localDeviceId) {
        return {
          ok: true,
          skippedAdd: true,
          sameStoreReuse: true,
          deviceId: state.localDeviceId,
          hop1CallCount: state.hop1CallCount,
        };
      }
      state.hop1CallCount += 1;
      const resolved = resolveHop1LocalBindV1(input);
      if (!resolved.ok) {
        return { ...resolved, hop1CallCount: state.hop1CallCount };
      }
      const deviceId = resolved.deviceId ?? input.persist();
      state.hop1Completed = true;
      state.localDeviceId = deviceId;
      return { ...resolved, deviceId, hop1CallCount: state.hop1CallCount };
    },
    async runHop2(input) {
      state.hop2CallCount += 1;
      const result = await registerBoundDeviceCloudV1(
        {
          deviceId: state.localDeviceId ?? '',
          serialNumber: input.serialNumber,
          storeId: input.storeId,
        },
        { fail: input.fail === true },
      );
      return { ...result, retryHop: 2 as const, hop2CallCount: state.hop2CallCount };
    },
  };
}
