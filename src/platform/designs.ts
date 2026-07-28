/**
 * 设计数据只读访问 · 基础平台模块 1
 *
 * 客户详情「历史设计」与列表「常用甲型」只读消费 StorageKeys.designs
 * （envelope 载荷 DesignSummary[]，由设计模块写入）。
 * 防御式读取：数据缺失或结构不符时返回空数组，不阻断客户模块。
 */

import { readData, StorageKeys } from '@/lib/storage';
import type { DesignSummary, NailShape } from '@/lib/types';
import { NAIL_SHAPE_LABELS } from '@/generated/shape-types';

export function readAllDesigns(): DesignSummary[] {
  const data = readData<DesignSummary[]>(StorageKeys.designs);
  if (!Array.isArray(data)) return [];
  return data.filter(
    (d): d is DesignSummary => !!d && typeof d === 'object' && typeof d.id === 'string',
  );
}

/** 某客户的历史设计，按创建时间倒序 */
export function listCustomerDesigns(customerId: string): DesignSummary[] {
  return readAllDesigns()
    .filter((d) => d.customerId === customerId)
    .sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));
}

/** 常用甲型：该客户历史设计中出现次数最多的甲型；无设计返回 null */
export function favoriteShape(customerId: string): NailShape | null {
  const designs = listCustomerDesigns(customerId);
  if (designs.length === 0) return null;
  const counts = new Map<NailShape, number>();
  for (const d of designs) {
    if (!d.shape) continue;
    counts.set(d.shape, (counts.get(d.shape) ?? 0) + 1);
  }
  let best: NailShape | null = null;
  let bestCount = 0;
  for (const [shape, count] of counts) {
    if (count > bestCount) {
      best = shape;
      bestCount = count;
    }
  }
  return best;
}

/** 甲型展示名（展示层映射，素材数据仍以 material-library 为准） */
export const SHAPE_LABEL: Record<NailShape, string> = NAIL_SHAPE_LABELS;
