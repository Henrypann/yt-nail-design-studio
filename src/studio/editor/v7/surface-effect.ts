import type {
  NailPointV7,
  PreviewFidelityV7,
  RegionMaskV7,
  RgbaColorV7,
  SurfaceEffectPayloadV7,
} from './model';
import { parseNailPathDataV7 } from './flat-vector';

export type SurfaceEffectTypeV7 = SurfaceEffectPayloadV7['effectType'];
export type SurfaceEffectMaskPresetV7 = 'full' | 'tip' | 'center' | 'diagonal';

export const SURFACE_EFFECT_TYPES_V7 = ['cat_eye', 'glitter', 'mirror', 'ink_bloom'] as const satisfies readonly SurfaceEffectTypeV7[];

export const SURFACE_EFFECT_LABELS_V7: Record<SurfaceEffectTypeV7, string> = {
  cat_eye: '局部猫眼',
  glitter: '局部闪粉',
  mirror: '局部镜面',
  ink_bloom: '局部晕染',
};

export const SURFACE_EFFECT_FIDELITY_LABELS_V7: Record<PreviewFidelityV7, string> = {
  exact: '确定性 2D',
  approximate: '近似 2D',
  unavailable: '2D 不可用',
};

const WHITE: RgbaColorV7 = { colorSpace: 'srgb', r: 246, g: 248, b: 255, a: 1 };
const BLOOM_PINK: RgbaColorV7 = { colorSpace: 'srgb', r: 229, g: 90, b: 141, a: 0.82 };
const BLOOM_BLUE: RgbaColorV7 = { colorSpace: 'srgb', r: 87, g: 151, b: 226, a: 0.78 };

export function createDefaultSurfaceEffectPayloadV7(
  effectType: SurfaceEffectTypeV7,
  seed = `surface-${effectType}`,
): SurfaceEffectPayloadV7 {
  if (effectType === 'cat_eye') {
    return { effectType, directionDeg: 28, intensity: 0.72, bandWidth: 0.24, previewFidelity: 'approximate' };
  }
  if (effectType === 'glitter') {
    return { effectType, density: 0.48, particleSizeMm: 0.16, seed, previewFidelity: 'exact' };
  }
  if (effectType === 'mirror') {
    return { effectType, tint: structuredClone(WHITE), reflectance: 0.82, previewFidelity: 'approximate' };
  }
  return {
    effectType,
    colors: [structuredClone(BLOOM_PINK), structuredClone(BLOOM_BLUE)],
    spread: 0.58,
    seed,
    previewFidelity: 'approximate',
  };
}

const MASK_PATHS: Record<SurfaceEffectMaskPresetV7, string> = {
  full: 'M0 0 L1 0 L1 1 L0 1 Z',
  tip: 'M0 0 L1 0 L1 0.4 Q0.5 0.28 0 0.4 Z',
  center: 'M0.2 0.18 Q0.5 0.04 0.8 0.18 L0.72 0.82 Q0.5 0.96 0.28 0.82 Z',
  diagonal: 'M0 0 L1 0 L0.3 1 L0 1 Z',
};

export function createSurfaceEffectMaskV7(
  preset: SurfaceEffectMaskPresetV7,
  inverted = false,
): RegionMaskV7 {
  return {
    coordinateSpace: 'nail-local-v1',
    pathData: MASK_PATHS[preset],
    fillRule: 'nonzero',
    inverted,
  };
}

export function rgbaCssV7(color: RgbaColorV7, opacity = 1): string {
  const alpha = Math.min(1, Math.max(0, color.a * opacity));
  return `rgb(${color.r} ${color.g} ${color.b} / ${alpha})`;
}

function hashSeed(seed: string): number {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function mulberry32(seed: number): () => number {
  let value = seed;
  return () => {
    value += 0x6d2b79f5;
    let result = value;
    result = Math.imul(result ^ (result >>> 15), result | 1);
    result ^= result + Math.imul(result ^ (result >>> 7), result | 61);
    return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
  };
}

export interface SurfaceEffectParticleV7 extends NailPointV7 {
  radius: number;
  opacity: number;
  colorIndex: number;
}

/** Deterministic edit-preview projection. Values are display-only, never manufacturing inputs. */
export function createSurfaceEffectParticlesV7(
  seed: string,
  density: number,
  colorCount: number,
): SurfaceEffectParticleV7[] {
  const random = mulberry32(hashSeed(seed));
  const count = Math.max(6, Math.min(72, Math.round(8 + density * 54)));
  return Array.from({ length: count }, () => ({
    u: random(),
    v: random(),
    radius: 0.5 + random() * 1.45,
    opacity: 0.34 + random() * 0.58,
    colorIndex: Math.floor(random() * Math.max(1, colorCount)),
  }));
}

export function normalizeSurfaceEffectDirectionV7(directionDeg: number): number {
  const normalized = directionDeg % 360;
  return normalized < 0 ? normalized + 360 : normalized;
}

export function surfaceEffectFidelityV7(effect: SurfaceEffectPayloadV7): PreviewFidelityV7 {
  return effect.previewFidelity;
}

export function surfaceEffectMaskPathToCanvasV7(
  pathData: string,
  width = 100,
  height = 160,
): string | null {
  const parsed = parseNailPathDataV7(pathData);
  if (!parsed) return null;
  return parsed.commands.map(({ command, values }) => {
    const scaled = values.map((value, index) => value * (index % 2 === 0 ? width : height));
    return `${command}${scaled.length > 0 ? scaled.join(' ') : ''}`;
  }).join(' ');
}
