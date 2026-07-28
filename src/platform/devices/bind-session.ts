/**
 * 配网向导会话 + 并发绑定锁（模块 2 · MOCK IOT）
 * - 会话：StorageKeys.deviceBindSession，5 分钟 TTL（PRD §4.5 页面刷新中断恢复）；
 *   WiFi 密码为 type=password 且永不写入会话（PRD §4.3）。
 * - 锁：StorageKeys.deviceBindLock，同 deviceCode 跨标签互斥（并发绑定场景的真实机制，
 *   Mock 面板 device.concurrentBind 开关可强制触发同一报错）。
 */

import { readData, readEnvelope, removeKey, writeEnvelope, StorageKeys, TAB_ID } from '@/lib/storage';
import { IOT_TIMINGS } from './iot-mock';
import type { BindLock, BindSession } from './types';

/* ── 会话 ─────────────────────────────────────────────── */

export function saveBindSession(session: Omit<BindSession, 'updatedAt'>): void {
  writeEnvelope<BindSession>(StorageKeys.deviceBindSession, { ...session, updatedAt: Date.now() });
}

/** 读取有效会话；不存在或超过 5 分钟 TTL 返回 null（超时回到步骤 1） */
export function loadBindSession(): BindSession | null {
  const env = readEnvelope<BindSession>(StorageKeys.deviceBindSession);
  if (!env) return null;
  if (Date.now() - env.updatedAt > IOT_TIMINGS.bindSessionTtlMs) {
    removeKey(StorageKeys.deviceBindSession);
    return null;
  }
  return env.data;
}

export function clearBindSession(): void {
  removeKey(StorageKeys.deviceBindSession);
}

/* ── 并发绑定锁 ───────────────────────────────────────── */

function readLock(): BindLock | null {
  const lock = readData<BindLock>(StorageKeys.deviceBindLock);
  if (!lock) return null;
  if (Date.now() - lock.acquiredAt > IOT_TIMINGS.bindLockTtlMs) {
    removeKey(StorageKeys.deviceBindLock); // 死锁兜底：过期自动释放
    return null;
  }
  return lock;
}

/**
 * 尝试获取绑定锁。返回 true = 本标签页持有锁；
 * false = 同一 deviceCode 正被其他操作（其他标签页）绑定中。
 */
export function acquireBindLock(deviceCode: string): boolean {
  const existing = readLock();
  if (existing && existing.tabId !== TAB_ID && existing.deviceCode === deviceCode) return false;
  writeEnvelope<BindLock>(StorageKeys.deviceBindLock, {
    deviceCode,
    tabId: TAB_ID,
    acquiredAt: Date.now(),
  });
  return true;
}

export function releaseBindLock(): void {
  const existing = readData<BindLock>(StorageKeys.deviceBindLock);
  if (!existing || existing.tabId === TAB_ID) removeKey(StorageKeys.deviceBindLock);
}
