/**
 * 十指对称映射（0.1mm 剪影坐标系）
 *
 * L↔R 指位映射 + 图案层几何镜像（不依赖 GLB UV）。
 * 拇指 L1/R1 额外 rotation 180° 补偿。
 */

import type { FingerCode } from '@/lib/types';
import type {
  AttachmentElement,
  FingerData,
  PatternElement,
  Transform,
} from './model.ts';
import { genId } from './model.ts';

/** 对侧指位：L1↔R1 … L5↔R5 */
export function oppositeFinger(finger: FingerCode): FingerCode {
  const num = finger.slice(1);
  const hand = finger[0] === 'L' ? 'R' : 'L';
  return `${hand}${num}` as FingerCode;
}

/** 左手五指 */
export const LEFT_FINGERS: readonly FingerCode[] = ['L1', 'L2', 'L3', 'L4', 'L5'];

export type MirrorMode = 'pattern-only' | 'include-base';

function isThumb(finger: FingerCode): boolean {
  return finger.endsWith('1');
}

/** 变换镜像：x → -x，rotation → -rotation；拇指额外 +180° */
export function mirrorTransform(t: Transform, finger: FingerCode): Transform {
  let rotation = -t.rotation;
  if (isThumb(finger)) rotation += 180;
  return { x: -t.x, y: t.y, scale: t.scale, rotation };
}

export function mirrorPoints(points: { x: number; y: number }[]): { x: number; y: number }[] {
  return points.map((p) => ({ x: -p.x, y: p.y }));
}

export function mirrorPatternElement(el: PatternElement, targetFinger: FingerCode): PatternElement {
  const idPrefix =
    el.kind === 'brush'
      ? 'el_brush'
      : el.kind === 'eraser'
        ? 'el_eraser'
        : el.kind === 'image'
          ? 'el_img'
          : el.kind === 'french_edge'
            ? 'el_french'
            : 'el_tpl';

  switch (el.kind) {
    case 'brush':
    case 'eraser':
      return { ...el, id: genId(idPrefix), points: mirrorPoints(el.points) };
    case 'french_edge':
      // French 由当前甲型的真实 tip 轮廓重新生成；不得套用拇指 +180° 补偿。
      return {
        ...el,
        id: genId(idPrefix),
        classicControls: el.classicControls
          ? {
              leftWingOffset: el.classicControls.rightWingOffset,
              centerOffset: el.classicControls.centerOffset,
              rightWingOffset: el.classicControls.leftWingOffset,
            }
          : undefined,
        transform: { ...el.transform },
      };
    case 'template_pattern':
    case 'image':
      return {
        ...el,
        id: genId(idPrefix),
        transform: mirrorTransform(el.transform, targetFinger),
      };
  }
}

export function mirrorAttachment(el: AttachmentElement, targetFinger: FingerCode): AttachmentElement {
  return {
    ...el,
    id: genId('el_att'),
    transform: mirrorTransform(el.transform, targetFinger),
  };
}

/** 深拷贝并镜像单指 FingerData */
export function mirrorFingerData(
  source: FingerData,
  targetFinger: FingerCode,
  mode: MirrorMode,
  fallbackBaseColor: string,
): FingerData {
  return {
    baseColor: mode === 'include-base' ? source.baseColor : fallbackBaseColor,
    pattern: source.pattern.map((el) => mirrorPatternElement(el, targetFinger)),
    attachments: source.attachments.map((el) => mirrorAttachment(el, targetFinger)),
  };
}

export function cloneFingerData(data: FingerData): FingerData {
  return structuredClone(data);
}
