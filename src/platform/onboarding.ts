/**
 * Dashboard 引导卡片状态 · 基础平台模块 1（PRD §2.3）
 *
 * 三张引导卡：绑定第一台设备 / 添加第一位客户 / 创建第一个设计。
 * 完成判定从实际业务数据派生（不存独立标记），对应操作完成后卡片自动消失。
 * 设备与设计数据由相邻模块写入，此处防御式读取。
 */

import { readData, StorageKeys } from '@/lib/storage';
import type { Customer } from '@/lib/types';

export interface OnboardingState {
  hasDevice: boolean;
  hasCustomer: boolean;
  hasDesign: boolean;
}

function nonEmptyArray(key: string): boolean {
  const data = readData<unknown>(key);
  return Array.isArray(data) && data.length > 0;
}

export function readOnboarding(): OnboardingState {
  const customers = readData<Customer[]>(StorageKeys.customers);
  return {
    hasDevice: nonEmptyArray(StorageKeys.devices),
    hasCustomer: Array.isArray(customers) && customers.some((c) => c && !c.deleted),
    hasDesign: nonEmptyArray(StorageKeys.designs),
  };
}
