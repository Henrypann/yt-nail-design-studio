/**
 * localStorage envelope + 数据桥（DEV-PLAN §2.3-7 / §6.1）
 *
 * 机制（沿用原型，零改动）：
 * 1. 所有持久化数据包一层 StorageEnvelope（版本 + updatedAt + tabId）；
 * 2. 写入时同步写「画布键」（ProjectV3 工作副本）；
 * 3. 2s 轮询回写：后台把画布键的最新 envelope 回写到业务集合键；
 * 4. 跨标签 rehydrate：另一标签页通过 storage 事件 + 2s 轮询发现 updatedAt 更新，重读数据。
 */

import type { StorageEnvelope } from './types';

const PREFIX = 'nail-studio:';
const ENVELOPE_VERSION = 1;
export const POLL_INTERVAL_MS = 2000;

/**
 * 生成客户端临时 id，不假设页面处于 HTTPS 安全上下文。
 * Safari/Chromium 在公网 HTTP 下可能不提供 crypto.randomUUID()。
 */
export function createClientId(prefix = ''): string {
  const value =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  return `${prefix}${value}`;
}

/** 当前标签页 id（跨标签回环保护） */
export const TAB_ID: string = createClientId('tab-');

/** 业务键注册表（约定：全部 localStorage 键经由此处命名，禁止散落硬编码） */
export const StorageKeys = {
  session: 'session',
  customers: 'customers',
  devices: 'devices',
  designs: 'designs',
  /** 画布工作键（数据桥）：Editor/Wizard 高频写入先落这里 */
  canvas: 'canvas.project-v3',
  mockScenarios: 'mock.scenarios',
  /** 基础平台（模块 1）：Mock 账号注册表（email → 门店/用户名） */
  accounts: 'auth.accounts',
  /** 基础平台（模块 1）：Mock 验证码状态（冷却/有效期/错误次数/锁定） */
  authCodes: 'auth.codes',
  /** 设备模块（模块 2 · MOCK IOT）：配网向导会话（5 分钟 TTL 恢复进度） */
  deviceBindSession: 'device.bind-session',
  /** Editor 模块（模块 4）：每设计一份画布文档（EditorDoc），designId → 文档 */
  editorDocs: 'editor.docs',
  /** 设备模块（模块 2 · MOCK IOT）：并发绑定锁（同 deviceCode 跨标签互斥） */
  deviceBindLock: 'device.bind-lock',
  /** 设备模块（模块 2 · MOCK IOT）：手机辅助配网 Token 记录 */
  deviceMobileTokens: 'device.mobile-tokens',
  /** UI 瞬态偏好：侧栏收起状态（v1.5.1） */
  sidebarCollapsed: 'ui.sidebar-collapsed',
  /** Community → Studio Import Intent（PR-02）：仅 envelope，不写 Wizard/Editor */
  communityStudioImportIntent: 'community.studio-import-intent',
} as const;

export type StorageKey = (typeof StorageKeys)[keyof typeof StorageKeys];

function fullKey(key: string): string {
  return `${PREFIX}${key}`;
}

/** 写入 envelope（同一标签页写同一 key 会刷新 updatedAt） */
export function writeEnvelope<T>(key: string, data: T): StorageEnvelope<T> {
  const envelope: StorageEnvelope<T> = {
    v: ENVELOPE_VERSION,
    updatedAt: Date.now(),
    tabId: TAB_ID,
    data,
  };
  localStorage.setItem(fullKey(key), JSON.stringify(envelope));
  return envelope;
}

/** 读取 envelope；不存在或解析失败返回 null */
export function readEnvelope<T>(key: string): StorageEnvelope<T> | null {
  const raw = localStorage.getItem(fullKey(key));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as StorageEnvelope<T>;
    if (typeof parsed !== 'object' || parsed === null || typeof parsed.updatedAt !== 'number') {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

/** 读取 data 载荷的便捷方法 */
export function readData<T>(key: string): T | null {
  return readEnvelope<T>(key)?.data ?? null;
}

export function removeKey(key: string): void {
  localStorage.removeItem(fullKey(key));
}

export type RehydrateHandler<T> = (envelope: StorageEnvelope<T>) => void;

/**
 * 跨标签 rehydrate 数据桥：
 * - 监听 window 'storage' 事件（其他标签页写入时即时触发）；
 * - 兜底 2s 轮询（同窗口程序化写入不会触发 storage 事件）；
 * - 仅当 updatedAt 前进且来源 tabId ≠ 本标签页（或 forceLocal）时回调。
 *
 * @returns 取消订阅函数
 */
export function subscribeRehydrate<T>(
  key: string,
  onUpdate: RehydrateHandler<T>,
  opts: { intervalMs?: number; forceLocal?: boolean } = {},
): () => void {
  const intervalMs = opts.intervalMs ?? POLL_INTERVAL_MS;
  let lastSeen = readEnvelope<T>(key)?.updatedAt ?? 0;

  const check = () => {
    const env = readEnvelope<T>(key);
    if (!env || env.updatedAt <= lastSeen) return;
    if (!opts.forceLocal && env.tabId === TAB_ID) {
      lastSeen = env.updatedAt;
      return;
    }
    lastSeen = env.updatedAt;
    onUpdate(env);
  };

  const onStorage = (e: StorageEvent) => {
    if (e.key === fullKey(key)) check();
  };
  window.addEventListener('storage', onStorage);
  const timer = window.setInterval(check, intervalMs);

  return () => {
    window.removeEventListener('storage', onStorage);
    window.clearInterval(timer);
  };
}

/**
 * 画布键写入 → 业务集合回写的数据桥：
 * Editor/Wizard 高频修改只写画布键，本桥 2s 轮询把最新载荷回写到 sink。
 *
 * @returns 停止函数
 */
export function startCanvasBridge<T>(opts: {
  canvasKey?: string;
  /** 回写目标：拿到画布 envelope 的 data 后落业务存储 */
  sink: (data: T) => void;
  intervalMs?: number;
}): () => void {
  const canvasKey = opts.canvasKey ?? StorageKeys.canvas;
  let lastSynced = 0;
  const timer = window.setInterval(() => {
    const env = readEnvelope<T>(canvasKey);
    if (env && env.updatedAt > lastSynced) {
      lastSynced = env.updatedAt;
      opts.sink(env.data);
    }
  }, opts.intervalMs ?? POLL_INTERVAL_MS);
  return () => window.clearInterval(timer);
}
