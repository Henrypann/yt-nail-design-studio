/**
 * Nail Twin Mock 数据 · 基础平台模块 1（PRD §5.1 / §5.4）
 *
 * 全部 Twin 数据为 MOCK，展示必须带 MOCK 标识。
 * 三态：👍 已扫描·有效 / ⚠️ 已扫描·低置信度 / — 未扫描。
 * 逐指数据由 customer.id 确定性派生（同一客户多次渲染结果一致），
 * 未同意 Nail Twin 或 twinStatus = NO_DATA 时不产出任何扫描数据。
 */

import type { Customer, FingerCode } from '@/lib/types';
import { FINGER_CODES } from '@/lib/types';

export type FingerTwinState = 'valid' | 'low' | 'none';

export interface FingerTwin {
  finger: FingerCode;
  state: FingerTwinState;
  /** Mock 扫描日期（ISO 日期串）；state = none 时为 null */
  scannedAt: string | null;
}

/** 简单确定性 hash（不依赖外部库） */
function hashCode(input: string): number {
  let h = 0;
  for (let i = 0; i < input.length; i++) {
    h = (Math.imul(h, 31) + input.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

export function getFingerTwin(customer: Customer): FingerTwin[] {
  const scannedDate = customer.createdAt.slice(0, 10); // Mock 扫描日期：取建档日

  if (!customer.twinConsent || customer.twinStatus === 'NO_DATA') {
    return FINGER_CODES.map((finger) => ({ finger, state: 'none', scannedAt: null }));
  }

  const seed = hashCode(customer.id);
  return FINGER_CODES.map((finger, i) => {
    if (customer.twinStatus === 'MOCK_VALID') {
      // 全部有效，但为贴近 PRD 示意保留个别未扫描指
      const state: FingerTwinState = (seed + i) % 7 === 0 ? 'none' : 'valid';
      return { finger, state, scannedAt: state === 'none' ? null : scannedDate };
    }
    // MOCK_LOW_CONFIDENCE：混合三态
    const roll = (seed + i * 13) % 5;
    const state: FingerTwinState = roll === 0 ? 'none' : roll === 1 ? 'low' : 'valid';
    return { finger, state, scannedAt: state === 'none' ? null : scannedDate };
  });
}

export interface TwinSummary {
  valid: number;
  low: number;
  none: number;
}

export function summarizeTwin(fingers: FingerTwin[]): TwinSummary {
  return {
    valid: fingers.filter((f) => f.state === 'valid').length,
    low: fingers.filter((f) => f.state === 'low').length,
    none: fingers.filter((f) => f.state === 'none').length,
  };
}

/** 列表页 Twin 列摘要文案，如「7 指 👍」/「全部 —」 */
export function twinListLabel(customer: Customer): string {
  const s = summarizeTwin(getFingerTwin(customer));
  if (s.none === 10) return '全部 —';
  if (s.low > 0) return `${s.valid} 指 👍 · ${s.low} 指 ⚠️`;
  return `${s.valid} 指 👍`;
}
