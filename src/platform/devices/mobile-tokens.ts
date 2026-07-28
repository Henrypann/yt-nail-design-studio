/**
 * 手机辅助配网 Token（模块 2 · MOCK IOT）
 * 记录存 StorageKeys.deviceMobileTokens（token → record）。
 * 两态异常：过期（TTL 或 Mock 面板 device.tokenExpired）、
 * 重复使用（record.used 或 Mock 面板 device.tokenReused）。
 * 桌面端经 2s 轮询读取 record.used + wifi 完成交接（与存储桥同机制）。
 */

import { readData, writeEnvelope, StorageKeys } from '@/lib/storage';
import { IOT_TIMINGS } from './iot-mock';
import type { MobileTokenRecord } from './types';

type TokenMap = Record<string, MobileTokenRecord>;

function readMap(): TokenMap {
  return readData<TokenMap>(StorageKeys.deviceMobileTokens) ?? {};
}

function writeMap(map: TokenMap): void {
  writeEnvelope(StorageKeys.deviceMobileTokens, map);
}

/** 桌面端 Step 3 发放 Token（重复进入复用未过期未使用的记录） */
export function issueMobileToken(token: string, deviceCode: string): MobileTokenRecord {
  const map = readMap();
  const existing = map[token];
  if (existing && !existing.used && Date.now() - existing.createdAt <= IOT_TIMINGS.mobileTokenTtlMs) {
    return existing;
  }
  const record: MobileTokenRecord = { token, deviceCode, createdAt: Date.now(), used: false };
  writeMap({ ...map, [token]: record });
  return record;
}

export function readMobileToken(token: string): MobileTokenRecord | null {
  return readMap()[token] ?? null;
}

/** 手机端提交 WiFi 成功：标记已用 + 暂存凭据（绑定完成后由桌面端清除） */
export function consumeMobileToken(token: string, wifi: { ssid: string; password: string }): void {
  const map = readMap();
  const record = map[token];
  if (!record) return;
  writeMap({ ...map, [token]: { ...record, used: true, wifi } });
}

export function isMobileTokenExpired(record: MobileTokenRecord): boolean {
  return Date.now() - record.createdAt > IOT_TIMINGS.mobileTokenTtlMs;
}
