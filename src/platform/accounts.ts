/**
 * Mock 账号注册表 · 基础平台模块 1
 *
 * 记录「已完成注册（填过门店名）」的账号，用于登录时判断：
 * 首次登录 → 自动注册（跳 /register 补门店名）；已有账号 → 直进 Dashboard。
 * 不保存密码、不发送邮件（验证码固定 123456，见 auth-codes.ts）。
 */

import { readData, writeEnvelope, StorageKeys } from '@/lib/storage';

export interface MockAccount {
  email: string;
  storeName: string; // 2–30 字符
  userName: string;
  createdAt: string;
}

type AccountStore = Record<string, MockAccount>;

function readAccounts(): AccountStore {
  const data = readData<AccountStore>(StorageKeys.accounts);
  return data && typeof data === 'object' ? data : {};
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function findAccount(email: string): MockAccount | null {
  return readAccounts()[normalizeEmail(email)] ?? null;
}

/** 注册完成：登记账号（幂等，同 email 覆盖门店名） */
export function createAccount(input: { email: string; storeName: string }): MockAccount {
  const email = normalizeEmail(input.email);
  const existing = readAccounts()[email];
  const account: MockAccount = {
    email,
    storeName: input.storeName.trim(),
    userName: existing?.userName ?? email.split('@')[0] ?? '美甲师',
    createdAt: existing?.createdAt ?? new Date().toISOString(),
  };
  writeEnvelope(StorageKeys.accounts, { ...readAccounts(), [email]: account });
  return account;
}

export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(email: string): boolean {
  return EMAIL_PATTERN.test(email.trim());
}
