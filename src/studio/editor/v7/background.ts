/**
 * V7 background authoring contract (PR-V7-05 background-basic).
 *
 * Pure color/background utilities plus the three background commands.
 * Commands always target the current finger's existing background step
 * (steps[0]), never create a second background, never write legacy color
 * truth, reject invalid values atomically, and keep the canonical
 * background invariants enforced by `parseEditorDocV7`.
 *
 * Advanced modes (gradient / cat_eye / glitter) are deferred to V7-06;
 * when an explicit user action converts them to solid/translucent the new
 * color is the deterministic representative color of the old payload, so
 * undo can restore the original payload exactly.
 *
 * Translucent 2D preview is explicitly approximate: screen opacity is not
 * physical material transmittance.
 */

import { NAIL_SHAPE_IDS, type NailShape } from '@/generated/shape-types';
import { getSilhouette } from '@/studio/editor/lib/material';
import type { FingerCode } from '../../../lib/types';
import type { EditorV7CommandFailure, EditorV7CommandResult } from './commands';
import type {
  BackgroundPayloadV7,
  EditorDocV7,
  GeometryRefV7,
  ProcessStepV7,
  RgbaColorV7,
} from './model';
import { parseEditorDocV7 } from './schema';

export const EDITOR_V7_BACKGROUND_MODES = ['solid', 'translucent'] as const;
export type EditorV7BackgroundModeV7 = (typeof EDITOR_V7_BACKGROUND_MODES)[number];

export const EDITOR_V7_ADVANCED_BACKGROUND_MODES = ['gradient', 'cat_eye', 'glitter'] as const;
export type EditorV7AdvancedBackgroundModeV7 = (typeof EDITOR_V7_ADVANCED_BACKGROUND_MODES)[number];

export type EditorV7BackgroundModeAnyV7 = EditorV7BackgroundModeV7 | EditorV7AdvancedBackgroundModeV7;

const HEX_PATTERN = /^#?([0-9a-fA-F]{6})$/;
/** Mirrors shape-params.json length ids (the only length source of truth). */
const LENGTH_IDS = ['short', 'medium', 'long', 'extra-long'] as const;
type ProductLengthV7 = (typeof LENGTH_IDS)[number];
/** Migration/scan resolvers emit `geometry.<shape>.<length>.<finger>` asset ids. */
const PRODUCT_GEOMETRY_PATTERN = /^geometry\.([a-z][a-z0-9-]*)\.([a-z][a-z0-9-]*)\.([LR][1-5])$/;

function reject(reason: EditorV7CommandFailure, message: string): EditorV7CommandResult {
  return { ok: false, reason, message };
}

/* ── canonical sRGB RGBA ─────────────────────────────────────────────── */

export function canonicalRgbaColorV7(color: RgbaColorV7): RgbaColorV7 {
  const channel = (value: number) => Number.isFinite(value)
    ? Math.min(255, Math.max(0, Math.round(value)))
    : 0;
  return {
    colorSpace: 'srgb',
    r: channel(color.r),
    g: channel(color.g),
    b: channel(color.b),
    a: Number.isFinite(color.a) ? Math.min(1, Math.max(0, color.a)) : 1,
  };
}

export function isCanonicalRgbaColorV7(value: unknown): value is RgbaColorV7 {
  if (!value || typeof value !== 'object') return false;
  const color = value as Record<string, unknown>;
  return (
    color.colorSpace === 'srgb' &&
    typeof color.r === 'number' && Number.isInteger(color.r) && color.r >= 0 && color.r <= 255 &&
    typeof color.g === 'number' && Number.isInteger(color.g) && color.g >= 0 && color.g <= 255 &&
    typeof color.b === 'number' && Number.isInteger(color.b) && color.b >= 0 && color.b <= 255 &&
    typeof color.a === 'number' && Number.isFinite(color.a) && color.a >= 0 && color.a <= 1
  );
}

export function isRgbaEqualV7(a: RgbaColorV7, b: RgbaColorV7): boolean {
  return (
    a.colorSpace === b.colorSpace &&
    a.r === b.r &&
    a.g === b.g &&
    a.b === b.b &&
    a.a === b.a
  );
}

/** Six-digit hex (`#RRGGBB` or `RRGGBB`) → canonical sRGB RGBA with alpha 1. */
export function parseHexColorV7(input: string): RgbaColorV7 | null {
  const match = HEX_PATTERN.exec(input.trim());
  if (!match) return null;
  const hex = match[1];
  return {
    colorSpace: 'srgb',
    r: Number.parseInt(hex.slice(0, 2), 16),
    g: Number.parseInt(hex.slice(2, 4), 16),
    b: Number.parseInt(hex.slice(4, 6), 16),
    a: 1,
  };
}

/** RGB channels → `#rrggbb`. Alpha is intentionally not representable in hex. */
export function rgbaToHexV7(color: RgbaColorV7): string {
  const channel = (value: number) =>
    Math.min(255, Math.max(0, Math.round(value))).toString(16).padStart(2, '0');
  return `#${channel(color.r)}${channel(color.g)}${channel(color.b)}`;
}

export function isBackgroundModeV7(mode: string): mode is EditorV7BackgroundModeAnyV7 {
  return mode === 'solid' || mode === 'translucent' || mode === 'gradient' || mode === 'cat_eye' || mode === 'glitter';
}

export function isAdvancedBackgroundModeV7(mode: string): mode is EditorV7AdvancedBackgroundModeV7 {
  return mode === 'gradient' || mode === 'cat_eye' || mode === 'glitter';
}

/**
 * Deterministic representative color for any background payload:
 * gradient → first stop, cat_eye → color, glitter → first color,
 * solid/translucent → color.
 */
export function representativeBackgroundColorV7(background: BackgroundPayloadV7): RgbaColorV7 {
  switch (background.mode) {
    case 'solid':
    case 'translucent':
    case 'cat_eye':
      return background.color;
    case 'gradient':
      return background.stops[0].color;
    case 'glitter':
      return background.colors[0];
  }
}

/* ── preview model (no 3D, no manufacturability claim) ───────────────── */

export interface BackgroundPreviewModelV7 {
  /** canonical color for solid/translucent; deterministic representative for advanced */
  color: RgbaColorV7;
  /** composite alpha = canonical color.a × background.opacity */
  alpha: number;
  mode: EditorV7BackgroundModeAnyV7;
  /** true when gradient/cat_eye/glitter (deferred to V7-06) */
  deferred: boolean;
  /** translucent and advanced modes are approximate in 2D */
  fidelity: 'exact' | 'approximate';
  visible: boolean;
}

export function resolveBackgroundPreviewModelV7(
  background: BackgroundPayloadV7,
  visible: boolean,
): BackgroundPreviewModelV7 {
  const deferred = isAdvancedBackgroundModeV7(background.mode);
  const color = representativeBackgroundColorV7(background);
  return {
    color,
    alpha: color.a * background.opacity,
    mode: background.mode,
    deferred,
    fidelity: background.mode === 'translucent' || deferred ? 'approximate' : 'exact',
    visible,
  };
}

/* ── nail silhouette resolution (geometryRef-derived, fallback-safe) ─── */

export interface NailSilhouetteV7 {
  source: 'product' | 'generic';
  pathD: string;
  viewBox: string;
  label: string;
}

export function matchProductSilhouetteRefV7(
  geometryRef: GeometryRefV7,
): { shape: NailShape; length: ProductLengthV7; finger: string } | null {
  const match = PRODUCT_GEOMETRY_PATTERN.exec(geometryRef.assetId);
  if (!match) return null;
  const shape = match[1] as NailShape;
  const length = match[2] as ProductLengthV7;
  if (!(NAIL_SHAPE_IDS as readonly string[]).includes(shape)) return null;
  if (!(LENGTH_IDS as readonly string[]).includes(length)) return null;
  return { shape, length, finger: match[3] };
}

/** Nail-local generic fallback; explicitly labeled, never mistaken for product geometry. */
export const GENERIC_NAIL_SILHOUETTE_V7: NailSilhouetteV7 = {
  source: 'generic',
  pathD: 'M50 5 C74 5 87 20 88 48 L84 120 C82 144 69 155 50 155 C31 155 18 144 16 120 L12 48 C13 20 26 5 50 5 Z',
  viewBox: '0 0 100 160',
  label: '通用甲型轮廓（未关联产品几何）',
};

/**
 * Resolve the product silhouette only when the geometryRef assetId matches
 * the registered `geometry.<shape>.<length>.<finger>` pattern AND a signed
 * silhouette exists in the material library. Never mutates geometryRef.
 */
export function resolveBackgroundSilhouetteV7(geometryRef: GeometryRefV7): NailSilhouetteV7 {
  const product = matchProductSilhouetteRefV7(geometryRef);
  if (product) {
    const silhouette = getSilhouette(product.shape, product.length);
    if (silhouette) {
      return {
        source: 'product',
        pathD: silhouette.pathD,
        viewBox: silhouette.viewBox,
        label: `${product.shape} / ${product.length} 产品轮廓`,
      };
    }
  }
  return GENERIC_NAIL_SILHOUETTE_V7;
}

/* ── background commands ────────────────────────────────────────────── */

function requireBackgroundStep(
  doc: EditorDocV7,
  finger: FingerCode,
):
  | { found: true; step: Extract<ProcessStepV7, { kind: 'background' }> }
  | { found: false; result: EditorV7CommandResult } {
  const step = doc.nails[finger].steps[0];
  if (!step || step.kind !== 'background') {
    return { found: false, result: reject('not_found', `background step missing for ${finger}`) };
  }
  if (step.locked) return { found: false, result: reject('locked', 'background step is locked') };
  return { found: true, step };
}

function validateBackgroundCommand(next: EditorDocV7): EditorV7CommandResult {
  const parsed = parseEditorDocV7(next);
  return parsed.ok
    ? { ok: true, doc: parsed.doc }
    : reject('invalid_document', parsed.issues.map((issue) => `${issue.path}: ${issue.message}`).join('; '));
}

/**
 * Switch the current finger's background to solid/translucent. When the
 * previous payload is gradient/cat_eye/glitter and no explicit color is
 * given, the deterministic representative color is used so undo restores
 * the old payload. Opacity and (for translucent) materialPresetRef carry over.
 */
export function setEditorV7BackgroundMode(
  doc: EditorDocV7,
  finger: FingerCode,
  mode: EditorV7BackgroundModeV7,
  color?: RgbaColorV7,
): EditorV7CommandResult {
  const located = requireBackgroundStep(doc, finger);
  if (!located.found) return located.result;
  if (mode !== 'solid' && mode !== 'translucent') {
    return reject('not_allowed', 'background mode must be solid or translucent');
  }
  if (color !== undefined && !isCanonicalRgbaColorV7(color)) {
    return reject('invalid_value', 'color must be canonical sRGB RGBA with integer channels 0-255 and alpha 0-1');
  }
  const current = located.step.background;
  if (current.mode === mode) return reject('not_allowed', 'background is already in requested mode');
  const nextColor = color ?? representativeBackgroundColorV7(current);
  const nextStep = structuredClone(located.step);
  nextStep.background = mode === 'translucent'
    ? {
        mode: 'translucent',
        opacity: current.opacity,
        color: structuredClone(nextColor),
        ...(current.mode === 'translucent' && current.materialPresetRef
          ? { materialPresetRef: structuredClone(current.materialPresetRef) }
          : {}),
      }
    : { mode: 'solid', opacity: current.opacity, color: structuredClone(nextColor) };
  const next = structuredClone(doc);
  next.nails[finger].steps[0] = nextStep;
  return validateBackgroundCommand(next);
}

/** Set the background color (solid/translucent only; alpha kept as given). */
export function setEditorV7BackgroundColor(
  doc: EditorDocV7,
  finger: FingerCode,
  color: RgbaColorV7,
): EditorV7CommandResult {
  const located = requireBackgroundStep(doc, finger);
  if (!located.found) return located.result;
  if (!isCanonicalRgbaColorV7(color)) {
    return reject('invalid_value', 'color must be canonical sRGB RGBA with integer channels 0-255 and alpha 0-1');
  }
  const current = located.step.background;
  if (current.mode !== 'solid' && current.mode !== 'translucent') {
    return reject('not_allowed', 'advanced background must be converted to solid/translucent before color editing');
  }
  if (isRgbaEqualV7(current.color, color)) {
    return reject('not_allowed', 'background already uses this color');
  }
  const next = structuredClone(doc);
  const nextStep = structuredClone(located.step);
  nextStep.background = { ...current, color: structuredClone(color) };
  next.nails[finger].steps[0] = nextStep;
  return validateBackgroundCommand(next);
}

/** Set the common background opacity (0..1), valid for every background mode. */
export function setEditorV7BackgroundOpacity(
  doc: EditorDocV7,
  finger: FingerCode,
  opacity: number,
): EditorV7CommandResult {
  const located = requireBackgroundStep(doc, finger);
  if (!located.found) return located.result;
  if (typeof opacity !== 'number' || !Number.isFinite(opacity) || opacity < 0 || opacity > 1) {
    return reject('invalid_value', 'opacity must be a finite number from 0 to 1');
  }
  if (located.step.background.opacity === opacity) {
    return reject('not_allowed', 'background opacity is already this value');
  }
  const next = structuredClone(doc);
  const nextStep = structuredClone(located.step);
  const nextBackground = structuredClone(nextStep.background);
  nextBackground.opacity = opacity;
  nextStep.background = nextBackground;
  next.nails[finger].steps[0] = nextStep;
  return validateBackgroundCommand(next);
}
