import type { FingerCode } from '@/lib/types';
import { localizedLabel, type LegacyLocale, type Locale } from '@/lib/i18n';
import type { NailDesignV7 } from './model';

export type FingerContentStateV7 = 'blank' | 'inactive' | 'designed';
type FingerLabelLocale = Locale | LegacyLocale;

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
  return fingerDisplayNameForLocaleV7(finger, 'zh-CN');
}

export function fingerDisplayNameForLocaleV7(finger: FingerCode, locale: FingerLabelLocale): string {
  const identity = EDITOR_FINGER_IDENTITY_V7[finger];
  return `${fingerHandLabelForLocaleV7(identity.hand, locale)}${fingerNameForLocaleV7(identity.name, locale)}`;
}

export function fingerHandLabelForLocaleV7(hand: FingerIdentityV7['hand'], locale: FingerLabelLocale): string {
  return localizedLabel(hand === 'left' ? '左手' : '右手', hand === 'left' ? 'Left hand' : 'Right hand', locale);
}

export function fingerNameForLocaleV7(name: FingerIdentityV7['name'], locale: FingerLabelLocale): string {
  const labels: Record<FingerIdentityV7['name'], [string, string]> = {
    拇指: ['拇指', 'Thumb'],
    食指: ['食指', 'Index finger'],
    中指: ['中指', 'Middle finger'],
    无名指: ['无名指', 'Ring finger'],
    小指: ['小指', 'Pinky'],
  };
  const [zh, en] = labels[name];
  return localizedLabel(zh, en, locale);
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

export function fingerContentStateLabelForLocaleV7(state: FingerContentStateV7, locale: FingerLabelLocale): string {
  const labels: Record<FingerContentStateV7, [string, string]> = {
    blank: ['空白', 'Blank'],
    inactive: ['内容已隐藏', 'Content hidden'],
    designed: ['有设计', 'Designed'],
  };
  const [zh, en] = labels[state];
  return localizedLabel(zh, en, locale);
}
