/**
 * 客户档案 repository · 基础平台模块 1（PRD §五）
 *
 * 持久化：StorageKeys.customers（envelope 载荷 Customer[]）。
 * 规则：姓名 2–60 必填；邮箱格式校验 + 同门店唯一（软删除后释放）；
 *       过敏/偏好备注 ≤500；隐私同意时间戳必选；软删除保留历史设计。
 * 消费方经 useCustomerStore（zustand）订阅；写操作后同步刷新。
 */

import { create } from 'zustand';
import { readData, writeEnvelope, StorageKeys } from '@/lib/storage';
import type { Customer } from '@/lib/types';
import { isValidEmail, normalizeEmail } from './accounts';

export const NAME_MIN = 2;
export const NAME_MAX = 60;
export const NOTES_MAX = 500;
export const PRIVACY_POLICY_VERSION = 'v1.0';

/* ── 校验 ─────────────────────────────────────────────── */

export function validateName(name: string): string | null {
  const len = name.trim().length;
  if (len === 0) return '此项为必填';
  if (len < NAME_MIN || len > NAME_MAX) return `姓名需为 ${NAME_MIN}–${NAME_MAX} 个字符`;
  return null;
}

export function validateEmailOptional(email: string): string | null {
  if (email.trim() === '') return null; // 邮箱选填
  if (!isValidEmail(email)) return '请输入有效的邮箱地址';
  return null;
}

export function validateNotes(notes: string): string | null {
  if (notes.length > NOTES_MAX) return `最多 ${NOTES_MAX} 个字符`;
  return null;
}

/* ── 读写 ─────────────────────────────────────────────── */

function readCustomers(): Customer[] {
  const data = readData<Customer[]>(StorageKeys.customers);
  return Array.isArray(data) ? data : [];
}

function persist(customers: Customer[]): void {
  writeEnvelope(StorageKeys.customers, customers);
}

function newId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? `c_${crypto.randomUUID()}`
    : `c_${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/** 邮箱同门店唯一：仅统计未删除客户；excludeId 用于编辑自身时排除 */
export function isEmailTaken(email: string, excludeId?: string): boolean {
  const target = normalizeEmail(email);
  return readCustomers().some(
    (c) => !c.deleted && c.id !== excludeId && !!c.email && normalizeEmail(c.email) === target,
  );
}

/** 是否存在同名（未删除）客户 —— 用于「确认创建吗？」警告 */
export function hasDuplicateName(name: string, excludeId?: string): boolean {
  const target = name.trim();
  return readCustomers().some((c) => !c.deleted && c.id !== excludeId && c.name === target);
}

export interface CreateCustomerInput {
  name: string;
  email?: string;
  allergyNotes?: string;
  preferenceNotes?: string;
  /** 隐私政策同意（必选）：调用方必须在弹窗中取得勾选后才传入 true */
  privacyConsent: boolean;
  /** Nail Twin 数据保存同意（可选） */
  twinConsent: boolean;
}

export type CustomerResult =
  | { ok: true; customer: Customer }
  | { ok: false; field: 'name' | 'email' | 'allergyNotes' | 'preferenceNotes'; error: string };

export function createCustomer(input: CreateCustomerInput): CustomerResult {
  const nameErr = validateName(input.name);
  if (nameErr) return { ok: false, field: 'name', error: nameErr };
  const emailErr = validateEmailOptional(input.email ?? '');
  if (emailErr) return { ok: false, field: 'email', error: emailErr };
  if ((input.email ?? '').trim() !== '' && isEmailTaken(input.email!)) {
    return { ok: false, field: 'email', error: '该邮箱已属于本店其他客户' };
  }
  const allergyErr = validateNotes(input.allergyNotes ?? '');
  if (allergyErr) return { ok: false, field: 'allergyNotes', error: allergyErr };
  const prefErr = validateNotes(input.preferenceNotes ?? '');
  if (prefErr) return { ok: false, field: 'preferenceNotes', error: prefErr };

  const now = new Date().toISOString();
  const customer: Customer = {
    id: newId(),
    name: input.name.trim(),
    email: input.email?.trim() || undefined,
    allergyNotes: input.allergyNotes?.trim() || undefined,
    preferenceNotes: input.preferenceNotes?.trim() || undefined,
    privacyConsentAt: now,
    twinConsent: input.twinConsent,
    deleted: false,
    twinStatus: 'NO_DATA', // Sprint 1 默认未扫描
    createdAt: now,
    updatedAt: now,
  };
  persist([...readCustomers(), customer]);
  return { ok: true, customer };
}

export type UpdateCustomerPatch = Partial<
  Pick<Customer, 'name' | 'email' | 'allergyNotes' | 'preferenceNotes' | 'twinConsent' | 'twinStatus' | 'lastVisitAt'>
>;

export function updateCustomer(id: string, patch: UpdateCustomerPatch): CustomerResult {
  const customers = readCustomers();
  const current = customers.find((c) => c.id === id && !c.deleted);
  if (!current) return { ok: false, field: 'name', error: '客户不存在或已删除' };

  if (patch.name !== undefined) {
    const err = validateName(patch.name);
    if (err) return { ok: false, field: 'name', error: err };
  }
  if (patch.email !== undefined) {
    const err = validateEmailOptional(patch.email);
    if (err) return { ok: false, field: 'email', error: err };
    if (patch.email.trim() !== '' && isEmailTaken(patch.email, id)) {
      return { ok: false, field: 'email', error: '该邮箱已属于本店其他客户' };
    }
  }
  if (patch.allergyNotes !== undefined) {
    const err = validateNotes(patch.allergyNotes);
    if (err) return { ok: false, field: 'allergyNotes', error: err };
  }
  if (patch.preferenceNotes !== undefined) {
    const err = validateNotes(patch.preferenceNotes);
    if (err) return { ok: false, field: 'preferenceNotes', error: err };
  }

  const next = customers.map((c) =>
    c.id === id
      ? {
          ...c,
          ...patch,
          name: patch.name !== undefined ? patch.name.trim() : c.name,
          email: patch.email !== undefined ? patch.email.trim() || undefined : c.email,
          allergyNotes:
            patch.allergyNotes !== undefined ? patch.allergyNotes.trim() || undefined : c.allergyNotes,
          preferenceNotes:
            patch.preferenceNotes !== undefined
              ? patch.preferenceNotes.trim() || undefined
              : c.preferenceNotes,
          updatedAt: new Date().toISOString(),
        }
      : c,
  );
  persist(next);
  const updated = next.find((c) => c.id === id)!;
  return { ok: true, customer: updated };
}

/** 软删除：列表移除、历史设计保留、邮箱随之释放（唯一性统计忽略 deleted） */
export function softDeleteCustomer(id: string): void {
  persist(
    readCustomers().map((c) =>
      c.id === id ? { ...c, deleted: true, updatedAt: new Date().toISOString() } : c,
    ),
  );
}

/* ── 查询 ─────────────────────────────────────────────── */

/** 列表：未删除 + 最近到店倒序（无到店记录回退创建时间倒序） */
export function sortForList(customers: Customer[]): Customer[] {
  return [...customers].sort((a, b) => {
    const ta = a.lastVisitAt ?? a.createdAt;
    const tb = b.lastVisitAt ?? b.createdAt;
    return tb.localeCompare(ta);
  });
}

export function searchCustomers(customers: Customer[], query: string): Customer[] {
  const q = query.trim().toLowerCase();
  if (!q) return customers;
  return customers.filter(
    (c) => c.name.toLowerCase().includes(q) || (c.email ?? '').toLowerCase().includes(q),
  );
}

/* ── zustand store（页面订阅入口） ────────────────────── */

interface CustomerStoreState {
  customers: Customer[]; // 全量（含 deleted），页面自行过滤
  refresh: () => void;
}

export const useCustomerStore = create<CustomerStoreState>((set) => ({
  customers: readCustomers(),
  refresh: () => set({ customers: readCustomers() }),
}));

/** 写操作便捷封装：落库并刷新 store */
export function createCustomerAndSync(input: CreateCustomerInput): CustomerResult {
  const result = createCustomer(input);
  if (result.ok) useCustomerStore.getState().refresh();
  return result;
}

export function updateCustomerAndSync(id: string, patch: UpdateCustomerPatch): CustomerResult {
  const result = updateCustomer(id, patch);
  if (result.ok) useCustomerStore.getState().refresh();
  return result;
}

export function softDeleteCustomerAndSync(id: string): void {
  softDeleteCustomer(id);
  useCustomerStore.getState().refresh();
}
