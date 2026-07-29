/**
 * 多指视图的非几何展示比例。
 *
 * 仅用于十指平铺、搭配条和导出排版；不得用于甲型 SVG、NailSlot、
 * 法式控制点、制造尺寸或单甲编辑坐标。
 */

import type { FingerCode } from '../lib/types.ts';
import { FINGER_ROLE_BY_CODE, type FingerRole } from './slots/types.ts';

export const FINGER_DISPLAY_SCALE = {
  thumb: 1.15,
  index: 0.95,
  middle: 1,
  ring: 0.94,
  pinky: 0.82,
} as const satisfies Record<FingerRole, number>;

export const MAX_FINGER_DISPLAY_SCALE = FINGER_DISPLAY_SCALE.thumb;

/** 原始角色比例，适合写入调试属性和导出 SVG。 */
export function fingerDisplayScale(finger: FingerCode): number {
  return FINGER_DISPLAY_SCALE[FINGER_ROLE_BY_CODE[finger]];
}

/**
 * 固定最大包络内的归一化比例：Thumb = 1，其余相对缩小。
 * 这样卡片和网格尺寸不变，避免 1280px 工作区横向溢出。
 */
export function fingerDisplayRatio(finger: FingerCode): number {
  return fingerDisplayScale(finger) / MAX_FINGER_DISPLAY_SCALE;
}
