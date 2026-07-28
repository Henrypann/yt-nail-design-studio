/**
 * 设计数据仓库（Wizard 产出侧）
 *
 * 设计主数据存储于 StorageKeys.designs（DesignSummary[] envelope），
 * 「我的设计」列表模块从同一键读取。Wizard 负责：创建草稿、防抖自动保存、
 * 手动保存、失败重试、[顾客已确认] 状态机流转后的落盘。
 */

import type { DesignSummary } from '@/lib/types';
import { readData, writeEnvelope, StorageKeys } from '@/lib/storage';

export function listDesigns(): DesignSummary[] {
  return readData<DesignSummary[]>(StorageKeys.designs) ?? [];
}

export function countDesignsByCustomer(customerId: string): number {
  return listDesigns().filter((d) => d.customerId === customerId).length;
}

export function findDesign(id: string): DesignSummary | null {
  return listDesigns().find((d) => d.id === id) ?? null;
}

/** upsert：按 id 替换或追加，刷新 updatedAt 由调用侧控制 */
export function upsertDesign(design: DesignSummary): void {
  const all = listDesigns();
  const idx = all.findIndex((d) => d.id === design.id);
  const next = idx >= 0 ? all.map((d) => (d.id === design.id ? design : d)) : [...all, design];
  writeEnvelope(StorageKeys.designs, next);
}

/** Mock 期保存动作：异步化以便注入失败/重试语义；真实写入为 localStorage */
export async function persistDesign(design: DesignSummary, opts: { simulateFailure?: boolean } = {}): Promise<void> {
  await new Promise((r) => window.setTimeout(r, 250));
  if (opts.simulateFailure) throw new Error('保存失败（MOCK）');
  upsertDesign(design);
}
