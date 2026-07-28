/**
 * 客户数据仓库（Wizard 消费侧）
 *
 * 客户主数据由「基础平台」模块维护，存储于 StorageKeys.customers（Customer[] envelope）。
 * Wizard 只读列表；[快速建档] 为 PRD §5.3 约定的内嵌创建（仅姓名 + 隐私勾选），
 * 追加写入同一键，字段与 Customer 模型一致。
 */

import type { Customer } from '@/lib/types';
import { readData, writeEnvelope, StorageKeys } from '@/lib/storage';

export function listCustomers(): Customer[] {
  return (readData<Customer[]>(StorageKeys.customers) ?? []).filter((c) => !c.deleted);
}

export function findCustomer(id: string): Customer | null {
  return listCustomers().find((c) => c.id === id) ?? null;
}

export interface QuickCreateInput {
  name: string;
  /** 隐私政策勾选时间戳（ISO），必选项由调用侧校验 */
  privacyConsentAt: string;
}

/** 快速建档：仅姓名 + 隐私同意；Twin 状态默认 NO_DATA（标 MOCK） */
export function quickCreateCustomer(input: QuickCreateInput): Customer {
  const now = new Date().toISOString();
  const customer: Customer = {
    id: `c_${crypto.randomUUID()}`,
    name: input.name.trim(),
    privacyConsentAt: input.privacyConsentAt,
    twinConsent: false,
    deleted: false,
    twinStatus: 'NO_DATA',
    createdAt: now,
    updatedAt: now,
  };
  const all = readData<Customer[]>(StorageKeys.customers) ?? [];
  writeEnvelope(StorageKeys.customers, [...all, customer]);
  return customer;
}
