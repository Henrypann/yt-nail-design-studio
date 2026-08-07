import type { FingerCode } from '@/lib/types';
import { mirrorPoints, mirrorTransform, oppositeFinger } from '@/studio/editor/lib/mirror';
import type { Transform } from '@/studio/editor/lib/model';
import type { EditorElementV6 } from './model';
import { generateEditorId } from './id';

export const DEFAULT_ELEMENT_TRANSFORM: Transform = { x: 0, y: -82, scale: 1, rotation: 0 };

function finite(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

export function readElementTransform(element: EditorElementV6): Transform {
  const raw = element.transform;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ...DEFAULT_ELEMENT_TRANSFORM };
  const transform = raw as Record<string, unknown>;
  return {
    x: finite(transform.x, DEFAULT_ELEMENT_TRANSFORM.x),
    y: finite(transform.y, DEFAULT_ELEMENT_TRANSFORM.y),
    scale: Math.min(4, Math.max(0.15, finite(transform.scale, DEFAULT_ELEMENT_TRANSFORM.scale))),
    rotation: finite(transform.rotation, DEFAULT_ELEMENT_TRANSFORM.rotation),
  };
}

export function updateElementTransform(
  element: EditorElementV6,
  patch: Partial<Transform>,
): EditorElementV6 {
  const current = readElementTransform(element);
  return {
    ...element,
    transform: {
      x: finite(patch.x, current.x),
      y: finite(patch.y, current.y),
      scale: Math.min(4, Math.max(0.15, finite(patch.scale, current.scale))),
      rotation: finite(patch.rotation, current.rotation),
    },
  };
}

export function mirrorElementV6(element: EditorElementV6, targetFinger: FingerCode): EditorElementV6 {
  const next: EditorElementV6 = {
    ...structuredClone(element),
    id: generateEditorId(`el_mirror_${targetFinger}`),
  };
  if (Array.isArray(element.points)) {
    const points = element.points.filter((point): point is { x: number; y: number } => (
      Boolean(point) && typeof point === 'object'
      && typeof (point as { x?: unknown }).x === 'number'
      && typeof (point as { y?: unknown }).y === 'number'
    ));
    next.points = mirrorPoints(points);
  }
  // French geometry is regenerated from the target silhouette and stays upright.
  next.transform = element.kind === 'french_edge'
    ? readElementTransform(element)
    : mirrorTransform(readElementTransform(element), targetFinger);
  return next;
}

export function oppositeFingerForV6(finger: FingerCode): FingerCode {
  return oppositeFinger(finger);
}
