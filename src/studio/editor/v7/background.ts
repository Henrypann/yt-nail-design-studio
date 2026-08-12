/**
 * V7 background authoring contract (PR-V7-05 background-basic).
 *
 * Pure color/background utilities plus the three background commands.
 * Commands always target the current finger's existing background step
 * (steps[0]), never create a second background, never write legacy color
 * truth, reject invalid values atomically, and keep the canonical
 * background invariants enforced by `parseEditorDocV7`.
 *
 * Advanced modes (gradient / cat_eye / glitter) are authored by V7-06;
 * when an explicit user action converts them to solid/translucent the new
 * color is the deterministic representative color of the old payload, so
 * undo can restore the original payload exactly.
 *
 * Translucent 2D preview is explicitly approximate: screen opacity is not
 * physical material transmittance.
 */

import type { FingerCode } from '../../../lib/types';
import type { EditorV7CommandFailure, EditorV7CommandResult } from './commands';
import type {
  BackgroundPayloadV7,
  EditorDocV7,
  GradientStopV7,
  PreviewFidelityV7,
  ProcessStepV7,
  RgbaColorV7,
} from './model';
import { parseEditorDocV7 } from './schema';

export const EDITOR_V7_BACKGROUND_MODES = ['solid', 'translucent'] as const;
export type EditorV7BackgroundModeV7 = (typeof EDITOR_V7_BACKGROUND_MODES)[number];

export const EDITOR_V7_ADVANCED_BACKGROUND_MODES = ['gradient', 'cat_eye', 'glitter'] as const;
export type EditorV7AdvancedBackgroundModeV7 = (typeof EDITOR_V7_ADVANCED_BACKGROUND_MODES)[number];

export type EditorV7BackgroundModeAnyV7 = EditorV7BackgroundModeV7 | EditorV7AdvancedBackgroundModeV7;

export interface EditorV7CatEyeParametersV7 {
  color: RgbaColorV7;
  directionDeg: number;
  intensity: number;
  bandWidth: number;
}

export interface EditorV7GlitterParametersV7 {
  colors: RgbaColorV7[];
  density: number;
  particleSizeMm: number;
  seed: string;
}

export interface EditorV7PaletteThemeV7 {
  id: string;
  name: string;
  /** Stable material-library color ids. This provenance is UI-only in V7-06. */
  sourceColorIds: string[];
  colors: RgbaColorV7[];
}

const HEX_PATTERN = /^#?([0-9a-fA-F]{6})$/;

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

/** Canonical nail-local angle: 0° points left→right (+u); positive rotation is clockwise toward the root (+v), normalized to [0, 360). */
export function normalizeBackgroundDirectionV7(directionDeg: number): number {
  if (!Number.isFinite(directionDeg)) return 0;
  const normalized = directionDeg % 360;
  return normalized < 0 ? normalized + 360 : normalized;
}

function mixColorV7(a: RgbaColorV7, b: RgbaColorV7, t: number): RgbaColorV7 {
  const ratio = Math.min(1, Math.max(0, t));
  return canonicalRgbaColorV7({
    colorSpace: 'srgb',
    r: a.r + (b.r - a.r) * ratio,
    g: a.g + (b.g - a.g) * ratio,
    b: a.b + (b.b - a.b) * ratio,
    a: a.a + (b.a - a.a) * ratio,
  });
}

function lighterColorV7(color: RgbaColorV7): RgbaColorV7 {
  return mixColorV7(color, { colorSpace: 'srgb', r: 255, g: 255, b: 255, a: color.a }, 0.62);
}

export function normalizeGradientStopsV7(stops: readonly GradientStopV7[]): GradientStopV7[] | null {
  if (stops.length < 2 || stops.length > 8) return null;
  const normalized = stops.map((stop) => ({ offset: stop.offset, color: structuredClone(stop.color) }));
  if (normalized.some((stop) => !Number.isFinite(stop.offset) || stop.offset < 0 || stop.offset > 1 || !isCanonicalRgbaColorV7(stop.color))) return null;
  normalized.sort((a, b) => a.offset - b.offset);
  if (normalized.some((stop, index) => index > 0 && stop.offset <= normalized[index - 1].offset)) return null;
  return normalized;
}

/** Deterministic seed hash used only for the derived SVG particle preview. */
export function hashBackgroundSeedV7(seed: string): number {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export interface GlitterPreviewParticleV7 {
  u: number;
  v: number;
  size: number;
  colorIndex: number;
  opacity: number;
}

export function createGlitterPreviewParticlesV7(
  seed: string,
  density: number,
  colorCount: number,
): GlitterPreviewParticleV7[] {
  let state = hashBackgroundSeedV7(seed) || 0x9e3779b9;
  const random = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x1_0000_0000;
  };
  const count = Math.round(Math.min(1, Math.max(0, density)) * 120);
  return Array.from({ length: count }, () => ({
    u: random(),
    v: random(),
    size: 0.45 + random() * 1.25,
    colorIndex: Math.min(Math.max(1, colorCount) - 1, Math.floor(random() * Math.max(1, colorCount))),
    opacity: 0.38 + random() * 0.58,
  }));
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
  /** Retained for V7-05 API compatibility; V7-06 renders every advanced mode. */
  deferred: boolean;
  /** translucent and advanced modes are approximate in 2D */
  fidelity: PreviewFidelityV7;
  visible: boolean;
}

export function resolveBackgroundPreviewModelV7(
  background: BackgroundPayloadV7,
  visible: boolean,
): BackgroundPreviewModelV7 {
  const deferred = false;
  const color = representativeBackgroundColorV7(background);
  return {
    color,
    alpha: color.a * background.opacity,
    mode: background.mode,
    deferred,
    fidelity: background.mode === 'cat_eye' || background.mode === 'glitter'
      ? background.previewFidelity
      : background.mode === 'translucent' ? 'approximate' : 'exact',
    visible,
  };
}

/** Compose canonical color alpha, background opacity and an optional derived-view factor. */
export function composeBackgroundAlphaV7(color: RgbaColorV7, opacity: number, factor = 1): number {
  return Math.min(1, Math.max(0, color.a * opacity * factor));
}

/* Geometry is registry-derived in V7-15. Re-export the compatibility reader so
 * existing background/canvas imports keep one shared implementation. */
export {
  GENERIC_NAIL_SILHOUETTE_V7,
  matchProductSilhouetteRefV7,
  resolveBackgroundSilhouetteV7,
} from './geometry-registry';
export type { NailSilhouetteV7 } from './geometry-registry';

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
  if (!step.visible) return { found: false, result: reject('not_allowed', 'background step is hidden; restore visibility before editing') };
  return { found: true, step };
}

function validateBackgroundCommand(next: EditorDocV7): EditorV7CommandResult {
  const parsed = parseEditorDocV7(next);
  return parsed.ok
    ? { ok: true, doc: parsed.doc }
    : reject('invalid_document', parsed.issues.map((issue) => `${issue.path}: ${issue.message}`).join('; '));
}

function replaceBackgroundPayload(
  doc: EditorDocV7,
  finger: FingerCode,
  payload: BackgroundPayloadV7,
): EditorV7CommandResult {
  const located = requireBackgroundStep(doc, finger);
  if (!located.found) return located.result;
  if (JSON.stringify(located.step.background) === JSON.stringify(payload)) {
    return reject('not_allowed', 'background already uses these values');
  }
  const next = structuredClone(doc);
  const nextStep = structuredClone(located.step);
  nextStep.background = structuredClone(payload);
  next.nails[finger].steps[0] = nextStep;
  return validateBackgroundCommand(next);
}

/** Explicitly materialize an advanced mode in the existing unique background step. */
export function setEditorV7AdvancedBackgroundMode(
  doc: EditorDocV7,
  finger: FingerCode,
  mode: EditorV7AdvancedBackgroundModeV7,
): EditorV7CommandResult {
  const located = requireBackgroundStep(doc, finger);
  if (!located.found) return located.result;
  if (!isAdvancedBackgroundModeV7(mode)) return reject('not_allowed', 'background mode must be gradient, cat-eye, or glitter');
  const current = located.step.background;
  if (current.mode === mode) return reject('not_allowed', 'background is already in requested mode');
  const color = structuredClone(representativeBackgroundColorV7(current));
  let next: BackgroundPayloadV7;
  if (mode === 'gradient') {
    next = {
      mode,
      opacity: current.opacity,
      directionDeg: 'directionDeg' in current ? normalizeBackgroundDirectionV7(current.directionDeg) : 0,
      stops: [{ offset: 0, color }, { offset: 1, color: lighterColorV7(color) }],
    };
  } else if (mode === 'cat_eye') {
    next = {
      mode,
      opacity: current.opacity,
      color,
      directionDeg: 'directionDeg' in current ? normalizeBackgroundDirectionV7(current.directionDeg) : 0,
      intensity: 0.7,
      bandWidth: 0.24,
      previewFidelity: 'approximate',
    };
  } else {
    next = {
      mode,
      opacity: current.opacity,
      colors: [color, lighterColorV7(color)],
      density: 0.5,
      particleSizeMm: 0.18,
      seed: `background-${finger}-glitter-v1`,
      previewFidelity: 'approximate',
    };
  }
  return replaceBackgroundPayload(doc, finger, next);
}

export function setEditorV7GradientStops(
  doc: EditorDocV7,
  finger: FingerCode,
  stops: readonly GradientStopV7[],
): EditorV7CommandResult {
  const located = requireBackgroundStep(doc, finger);
  if (!located.found) return located.result;
  if (located.step.background.mode !== 'gradient') return reject('not_allowed', 'background is not gradient');
  const normalized = normalizeGradientStopsV7(stops);
  if (!normalized) return reject('invalid_value', 'gradient requires 2-8 canonical, strictly ordered stops');
  return replaceBackgroundPayload(doc, finger, { ...located.step.background, stops: normalized });
}

export function addEditorV7GradientStop(
  doc: EditorDocV7,
  finger: FingerCode,
  offset?: number,
): EditorV7CommandResult {
  const located = requireBackgroundStep(doc, finger);
  if (!located.found) return located.result;
  const background = located.step.background;
  if (background.mode !== 'gradient') return reject('not_allowed', 'background is not gradient');
  if (background.stops.length >= 8) return reject('not_allowed', 'gradient already has 8 stops');
  let chosen = offset;
  if (chosen === undefined) {
    let gapIndex = 0;
    let gap = -1;
    for (let index = 0; index < background.stops.length - 1; index += 1) {
      const candidate = background.stops[index + 1].offset - background.stops[index].offset;
      if (candidate > gap) { gap = candidate; gapIndex = index; }
    }
    chosen = (background.stops[gapIndex].offset + background.stops[gapIndex + 1].offset) / 2;
  }
  if (!Number.isFinite(chosen) || chosen <= 0 || chosen >= 1 || background.stops.some((stop) => stop.offset === chosen)) {
    return reject('invalid_value', 'new gradient stop offset must be unique and between 0 and 1');
  }
  const rightIndex = background.stops.findIndex((stop) => stop.offset > chosen!);
  const left = background.stops[Math.max(0, rightIndex - 1)];
  const right = background.stops[rightIndex < 0 ? background.stops.length - 1 : rightIndex];
  const ratio = right.offset === left.offset ? 0 : (chosen - left.offset) / (right.offset - left.offset);
  return setEditorV7GradientStops(doc, finger, [...background.stops, { offset: chosen, color: mixColorV7(left.color, right.color, ratio) }]);
}

export function removeEditorV7GradientStop(doc: EditorDocV7, finger: FingerCode, index: number): EditorV7CommandResult {
  const located = requireBackgroundStep(doc, finger);
  if (!located.found) return located.result;
  const background = located.step.background;
  if (background.mode !== 'gradient') return reject('not_allowed', 'background is not gradient');
  if (!Number.isInteger(index) || index < 0 || index >= background.stops.length) return reject('invalid_value', 'gradient stop index is invalid');
  if (background.stops.length <= 2) return reject('not_allowed', 'gradient must keep at least 2 stops');
  return setEditorV7GradientStops(doc, finger, background.stops.filter((_, current) => current !== index));
}

export function setEditorV7GradientDirection(doc: EditorDocV7, finger: FingerCode, directionDeg: number): EditorV7CommandResult {
  const located = requireBackgroundStep(doc, finger);
  if (!located.found) return located.result;
  if (!Number.isFinite(directionDeg)) return reject('invalid_value', 'gradient direction must be finite');
  const background = located.step.background;
  if (background.mode !== 'gradient') return reject('not_allowed', 'background is not gradient');
  return replaceBackgroundPayload(doc, finger, { ...background, directionDeg: normalizeBackgroundDirectionV7(directionDeg) });
}

export function setEditorV7CatEyeParameters(
  doc: EditorDocV7,
  finger: FingerCode,
  parameters: EditorV7CatEyeParametersV7,
): EditorV7CommandResult {
  const located = requireBackgroundStep(doc, finger);
  if (!located.found) return located.result;
  const background = located.step.background;
  if (background.mode !== 'cat_eye') return reject('not_allowed', 'background is not cat-eye');
  if (!isCanonicalRgbaColorV7(parameters.color) || !Number.isFinite(parameters.directionDeg) ||
    !Number.isFinite(parameters.intensity) || parameters.intensity < 0 || parameters.intensity > 1 ||
    !Number.isFinite(parameters.bandWidth) || parameters.bandWidth < 0 || parameters.bandWidth > 1) {
    return reject('invalid_value', 'cat-eye parameters are invalid');
  }
  const previewFidelity: PreviewFidelityV7 = 'approximate';
  return replaceBackgroundPayload(doc, finger, {
    ...background,
    color: structuredClone(parameters.color),
    directionDeg: normalizeBackgroundDirectionV7(parameters.directionDeg),
    intensity: parameters.intensity,
    bandWidth: parameters.bandWidth,
    previewFidelity,
  });
}

export function setEditorV7GlitterParameters(
  doc: EditorDocV7,
  finger: FingerCode,
  parameters: EditorV7GlitterParametersV7,
): EditorV7CommandResult {
  const located = requireBackgroundStep(doc, finger);
  if (!located.found) return located.result;
  const background = located.step.background;
  if (background.mode !== 'glitter') return reject('not_allowed', 'background is not glitter');
  if (parameters.colors.length < 1 || parameters.colors.length > 8 || parameters.colors.some((color) => !isCanonicalRgbaColorV7(color)) ||
    !Number.isFinite(parameters.density) || parameters.density < 0 || parameters.density > 1 ||
    !Number.isFinite(parameters.particleSizeMm) || parameters.particleSizeMm < 0.01 || parameters.particleSizeMm > 2 ||
    !parameters.seed.trim()) {
    return reject('invalid_value', 'glitter parameters are invalid');
  }
  return replaceBackgroundPayload(doc, finger, {
    ...background,
    colors: structuredClone(parameters.colors),
    density: parameters.density,
    particleSizeMm: parameters.particleSizeMm,
    seed: parameters.seed.trim(),
    previewFidelity: 'approximate',
  });
}

/** Materialize a chosen palette theme into the current payload; no live linkage is retained. */
export function applyEditorV7PaletteTheme(
  doc: EditorDocV7,
  finger: FingerCode,
  theme: EditorV7PaletteThemeV7,
): EditorV7CommandResult {
  if (!theme.id || theme.colors.length < 2 || theme.colors.length > 8 || theme.colors.some((color) => !isCanonicalRgbaColorV7(color))) {
    return reject('invalid_value', 'palette theme must contain 2-8 canonical colors');
  }
  const located = requireBackgroundStep(doc, finger);
  if (!located.found) return located.result;
  const opacity = located.step.background.opacity;
  const stops = theme.colors.map((color, index) => ({
    offset: index / (theme.colors.length - 1),
    color: structuredClone(color),
  }));
  return replaceBackgroundPayload(doc, finger, { mode: 'gradient', opacity, directionDeg: 0, stops });
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
