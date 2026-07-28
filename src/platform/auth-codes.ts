/**
 * Mock 验证码状态机 · 基础平台模块 1（PRD §2.1 / §3.2）
 *
 * 固定码 123456；不发送邮件、不保存密码。
 * 规则：有效期 5 分钟 / 重发冷却 60 秒 / 连续错误 3 次锁定 5 分钟。
 * 状态按 email 持久化到 StorageKeys.authCodes（刷新后冷却/锁定仍可复现）。
 * 异常注入：useMockScenarios 的 auth.sendFail / auth.codeExpired 由页面层读取后传入。
 */

import { readData, writeEnvelope, StorageKeys } from '@/lib/storage';

export const MOCK_CODE = '123456';
export const CODE_TTL_MS = 5 * 60 * 1000;
export const RESEND_COOLDOWN_MS = 60 * 1000;
export const MAX_ATTEMPTS = 3;
export const LOCK_DURATION_MS = 5 * 60 * 1000;

interface CodeState {
  sentAt: number;
  cooldownUntil: number;
  lockedUntil: number;
  attempts: number;
}

type CodeStore = Record<string, CodeState>;

function readStore(): CodeStore {
  const data = readData<CodeStore>(StorageKeys.authCodes);
  return data && typeof data === 'object' ? data : {};
}

function getState(email: string): CodeState | null {
  return readStore()[email] ?? null;
}

function putState(email: string, state: CodeState): void {
  writeEnvelope(StorageKeys.authCodes, { ...readStore(), [email]: state });
}

const EMPTY_STATE = (): CodeState => ({
  sentAt: 0,
  cooldownUntil: 0,
  lockedUntil: 0,
  attempts: 0,
});

export type RequestCodeResult =
  | { ok: true; cooldownUntil: number }
  | { ok: false; reason: 'locked'; lockedUntil: number }
  | { ok: false; reason: 'sendFail'; cooldownUntil: number };

/** 获取验证码：冷却/锁定检查；forceFail 由 Mock 面板 auth.sendFail 注入（失败同样进入 60s 冷却） */
export function requestCode(email: string, opts: { forceFail?: boolean } = {}): RequestCodeResult {
  const now = Date.now();
  const state = getState(email) ?? EMPTY_STATE();

  if (state.lockedUntil > now) {
    return { ok: false, reason: 'locked', lockedUntil: state.lockedUntil };
  }

  const next: CodeState = {
    ...state,
    cooldownUntil: now + RESEND_COOLDOWN_MS,
  };

  if (opts.forceFail) {
    // 发送失败：不发码，但按 PRD 进入 60s 冷却
    putState(email, next);
    return { ok: false, reason: 'sendFail', cooldownUntil: next.cooldownUntil };
  }

  next.sentAt = now;
  next.attempts = 0;
  putState(email, next);
  return { ok: true, cooldownUntil: next.cooldownUntil };
}

export type VerifyCodeResult =
  | { ok: true }
  | { ok: false; reason: 'locked'; lockedUntil: number }
  | { ok: false; reason: 'noCode' }
  | { ok: false; reason: 'expired' }
  | { ok: false; reason: 'wrong'; remaining: number }
  | { ok: false; reason: 'justLocked'; lockedUntil: number };

/** 校验验证码：forceExpired 由 Mock 面板 auth.codeExpired 注入 */
export function verifyCode(
  email: string,
  code: string,
  opts: { forceExpired?: boolean } = {},
): VerifyCodeResult {
  const now = Date.now();
  const state = getState(email);

  if (!state || state.sentAt === 0) return { ok: false, reason: 'noCode' };
  if (state.lockedUntil > now) {
    return { ok: false, reason: 'locked', lockedUntil: state.lockedUntil };
  }
  if (opts.forceExpired || now - state.sentAt > CODE_TTL_MS) {
    return { ok: false, reason: 'expired' };
  }

  if (code.trim() === MOCK_CODE) {
    // 成功后清除状态，避免残留计数
    putState(email, EMPTY_STATE());
    return { ok: true };
  }

  const attempts = state.attempts + 1;
  if (attempts >= MAX_ATTEMPTS) {
    const lockedUntil = now + LOCK_DURATION_MS;
    putState(email, { ...state, attempts: 0, lockedUntil });
    return { ok: false, reason: 'justLocked', lockedUntil };
  }
  putState(email, { ...state, attempts });
  return { ok: false, reason: 'wrong', remaining: MAX_ATTEMPTS - attempts };
}

/** 当前剩余冷却秒数（0 = 可重发） */
export function cooldownRemainingSec(email: string): number {
  const until = getState(email)?.cooldownUntil ?? 0;
  return Math.max(0, Math.ceil((until - Date.now()) / 1000));
}

/** 当前剩余锁定毫秒数（0 = 未锁定） */
export function lockRemainingMs(email: string): number {
  const until = getState(email)?.lockedUntil ?? 0;
  return Math.max(0, until - Date.now());
}
