/**
 * 绑定 / Job 传输冻结错误码合同 V1。
 *
 * 依据：Week 0/1 合入评估 `docs/week0-merge-eval.md` §2.2 / §3 PR1。
 * 这是独立的设备域码，不合并进 `SERVICE_ERROR_CODES_V1`。
 *
 * UNMAPPED 不是合法码：不进入 union，也不得作为 `mapBindErrorV1` 的返回值。
 * 未知输入落到已定义兜底码 `BIND_ERROR_FALLBACK_V1`。
 */

import type { MessageKey } from '@/lib/i18n/types';

export const BIND_ERROR_CODES_V1 = Object.freeze([
  'BIND_BT_DISCOVER_FAILED',
  'BIND_BT_PAIR_FAILED',
  'BIND_BT_WIFI_HANDOFF_FAILED',
  'BIND_USB_NOT_FOUND',
  'BIND_USB_DENIED',
  'BIND_SN_MISMATCH',
  'BIND_SN_ALREADY_BOUND',
  'CLOUD_REGISTER_FAILED',
  'JOB_FALLBACK_LAN',
  'JOB_TRANSPORT_OFFLINE',
  'DEVICE_NOT_ACTIVATED',
  'JOB_REJECT_EMPTY_PATCH',
] as const);

export type BindErrorCodeV1 = (typeof BIND_ERROR_CODES_V1)[number];

/** 未知输入的稳定兜底码。不是 UNMAPPED。 */
export const BIND_ERROR_FALLBACK_V1 = 'DEVICE_NOT_ACTIVATED' satisfies BindErrorCodeV1;

/**
 * BindWizard 旧私有 6 项 union 到冻结码的别名。
 * 向导渲染仍走既有 `device.*` 文案键；别名只用于映射，不是 API 边界码。
 */
export const WIZARD_BIND_ERROR_ALIASES_V1 = Object.freeze({
  discoverTimeout: 'BIND_BT_DISCOVER_FAILED',
  wifiWrong: 'BIND_BT_WIFI_HANDOFF_FAILED',
  joinTimeout: 'BIND_BT_WIFI_HANDOFF_FAILED',
  alreadyBound: 'BIND_SN_ALREADY_BOUND',
  concurrent: 'BIND_SN_ALREADY_BOUND',
  tokenExpired: 'BIND_BT_WIFI_HANDOFF_FAILED',
} as const);

export type WizardBindErrorAliasV1 = keyof typeof WIZARD_BIND_ERROR_ALIASES_V1;

/** 向导当前可达的冻结码子集（旧 6 项私有 ErrorKind 的落点）。 */
export type BindWizardErrorCodeV1 = (typeof WIZARD_BIND_ERROR_ALIASES_V1)[WizardBindErrorAliasV1];

export function mapWizardBindErrorV1(alias: WizardBindErrorAliasV1): BindWizardErrorCodeV1 {
  return WIZARD_BIND_ERROR_ALIASES_V1[alias];
}

const BIND_ERROR_CODE_SET_V1: ReadonlySet<string> = new Set(BIND_ERROR_CODES_V1);

/**
 * 编译期穷尽：union 每增一员，这里必须补 case，否则 `never` 失败。
 * 运行期对已知码原样返回。
 */
function identityBindErrorV1(code: BindErrorCodeV1): BindErrorCodeV1 {
  switch (code) {
    case 'BIND_BT_DISCOVER_FAILED':
    case 'BIND_BT_PAIR_FAILED':
    case 'BIND_BT_WIFI_HANDOFF_FAILED':
    case 'BIND_USB_NOT_FOUND':
    case 'BIND_USB_DENIED':
    case 'BIND_SN_MISMATCH':
    case 'BIND_SN_ALREADY_BOUND':
    case 'CLOUD_REGISTER_FAILED':
    case 'JOB_FALLBACK_LAN':
    case 'JOB_TRANSPORT_OFFLINE':
    case 'DEVICE_NOT_ACTIVATED':
    case 'JOB_REJECT_EMPTY_PATCH':
      return code;
    default: {
      const exhaustive: never = code;
      return exhaustive;
    }
  }
}

function isBindErrorCodeV1(value: string): value is BindErrorCodeV1 {
  return BIND_ERROR_CODE_SET_V1.has(value);
}

function isWizardBindErrorAliasV1(value: string): value is WizardBindErrorAliasV1 {
  return Object.prototype.hasOwnProperty.call(WIZARD_BIND_ERROR_ALIASES_V1, value);
}

/**
 * 任意输入 → 冻结码。未知输入落到 `BIND_ERROR_FALLBACK_V1`。
 * 签名上不可能返回 UNMAPPED。
 */
export function mapBindErrorV1(input: unknown): BindErrorCodeV1 {
  if (typeof input === 'string') {
    if (isBindErrorCodeV1(input)) return identityBindErrorV1(input);
    if (isWizardBindErrorAliasV1(input)) return WIZARD_BIND_ERROR_ALIASES_V1[input];
    return BIND_ERROR_FALLBACK_V1;
  }
  if (input && typeof input === 'object' && 'code' in input) {
    return mapBindErrorV1((input as { code: unknown }).code);
  }
  return BIND_ERROR_FALLBACK_V1;
}

export type SnAlreadyBoundResolutionV1 =
  | { outcome: 'success'; sameStore: true }
  | {
      outcome: 'reject';
      code: 'BIND_SN_ALREADY_BOUND';
      sameStore: false;
      /** 异店拒绝，合同禁止强制绑定出口。 */
      forceBind: false;
    };

/**
 * SN 已绑定的同店 / 异店二分。
 * 同店 → 成功（视为已绑定到本店）；异店 → 拒绝且不提供强制绑定。
 * 任一侧门店 id 为空时不当作同店。
 */
export function resolveSnAlreadyBound(input: {
  incomingStoreId: string;
  boundStoreId: string;
}): SnAlreadyBoundResolutionV1 {
  const incoming = input.incomingStoreId.trim();
  const bound = input.boundStoreId.trim();
  if (incoming.length > 0 && incoming === bound) {
    return { outcome: 'success', sameStore: true };
  }
  return {
    outcome: 'reject',
    code: 'BIND_SN_ALREADY_BOUND',
    sameStore: false,
    forceBind: false,
  };
}

/**
 * BIND_SN_MISMATCH 双显字段：期望 SN 与实际 SN 必须同时存在，才能给 UI / 日志对照。
 * deviceCode 不是 SN，不得填入这两个字段冒充。
 */
export interface BindSnMismatchDisplayV1 {
  expectedSerialNumber: string;
  actualSerialNumber: string;
}

export function bindSnMismatchDisplayV1(input: {
  expectedSerialNumber: string;
  actualSerialNumber: string;
}): BindSnMismatchDisplayV1 {
  return {
    expectedSerialNumber: input.expectedSerialNumber,
    actualSerialNumber: input.actualSerialNumber,
  };
}

/**
 * 冻结码 → `device.*` i18n 键。
 * 向导已有文案的 3 个码复用现有键；其余为 PR1 新增键。
 */
export function bindErrorMessageKeyV1(code: BindErrorCodeV1): MessageKey {
  switch (code) {
    case 'BIND_BT_DISCOVER_FAILED':
      return 'device.discoverFailed';
    case 'BIND_BT_PAIR_FAILED':
      return 'device.btPairFailed';
    case 'BIND_BT_WIFI_HANDOFF_FAILED':
      return 'device.wifiWrong';
    case 'BIND_USB_NOT_FOUND':
      return 'device.usbNotFound';
    case 'BIND_USB_DENIED':
      return 'device.usbDenied';
    case 'BIND_SN_MISMATCH':
      return 'device.snMismatch';
    case 'BIND_SN_ALREADY_BOUND':
      return 'device.alreadyBound';
    case 'CLOUD_REGISTER_FAILED':
      return 'device.cloudRegisterFailed';
    case 'JOB_FALLBACK_LAN':
      return 'device.jobFallbackLan';
    case 'JOB_TRANSPORT_OFFLINE':
      return 'device.jobTransportOffline';
    case 'DEVICE_NOT_ACTIVATED':
      return 'device.notActivated';
    case 'JOB_REJECT_EMPTY_PATCH':
      return 'device.jobRejectEmptyPatch';
    default: {
      const exhaustive: never = code;
      return exhaustive;
    }
  }
}
