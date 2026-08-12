import type { FingerCode } from '@/lib/types';
import type { NailDesignV7 } from './model';

export type FingerContentStateV7 = 'blank' | 'inactive' | 'designed';

export interface FingerIdentityV7 {
  finger: FingerCode;
  hand: 'left' | 'right';
  handLabel: '左手' | '右手';
  name: '拇指' | '食指' | '中指' | '无名指' | '小指';
  previewWidth: number;
  previewHeight: number;
}

const NAMES = ['拇指', '食指', '中指', '无名指', '小指'] as const;
const PROPORTIONS = [
  { previewWidth: 0.98, previewHeight: 0.82 },
  { previewWidth: 0.78, previewHeight: 0.94 },
  { previewWidth: 0.82, previewHeight: 1 },
  { previewWidth: 0.76, previewHeight: 0.92 },
  { previewWidth: 0.64, previewHeight: 0.76 },
] as const;

function createIdentity(hand: 'left' | 'right', ordinal: number): FingerIdentityV7 {
  const handLabel = hand === 'left' ? '左手' : '右手';
  const finger = `${hand === 'left' ? 'L' : 'R'}${ordinal}` as FingerCode;
  return {
    finger,
    hand,
    handLabel,
    name: NAMES[ordinal - 1],
    ...PROPORTIONS[ordinal - 1],
  };
}

export const EDITOR_FINGER_ROWS_V7 = [
  { id: 'left', label: '左手', fingers: [1, 2, 3, 4, 5].map((ordinal) => createIdentity('left', ordinal)) },
  { id: 'right', label: '右手', fingers: [1, 2, 3, 4, 5].map((ordinal) => createIdentity('right', ordinal)) },
] as const;

export const EDITOR_FINGER_IDENTITY_V7 = Object.fromEntries(
  EDITOR_FINGER_ROWS_V7.flatMap((row) => row.fingers.map((identity) => [identity.finger, identity])),
) as Record<FingerCode, FingerIdentityV7>;

export function fingerDisplayNameV7(finger: FingerCode): string {
  const identity = EDITOR_FINGER_IDENTITY_V7[finger];
  return `${identity.handLabel}${identity.name}`;
}

export function deriveFingerContentStateV7(nail: NailDesignV7): FingerContentStateV7 {
  const middleSteps = nail.steps.slice(1, -1);
  if (middleSteps.length === 0) return 'blank';
  return middleSteps.some((step) => step.visible && !step.skipped) ? 'designed' : 'inactive';
}

export const FINGER_CONTENT_STATE_LABEL_V7: Record<FingerContentStateV7, string> = {
  blank: '空白',
  inactive: '内容已隐藏',
  designed: '有设计',
};
