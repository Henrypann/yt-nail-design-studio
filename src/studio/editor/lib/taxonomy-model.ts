/**
 * Studio 领域枚举的唯一 TypeScript 契约。
 *
 * 这些枚举描述产品选择与推荐，不等于制造参数；长度预设与几何长度
 * 必须通过显式映射转换，禁止在 UI 中把两者当成同一个变量。
 */

export const STYLE_DIRECTION_IDS = ['classic', 'fashion', 'sweet', 'art'] as const;
export type StyleDirection = (typeof STYLE_DIRECTION_IDS)[number];

export const LOOK_PRESET_IDS = [
  'classic-french', 'nude-gradient', 'solid-color',
  'cat-eye', 'aurora-powder', 'metallic-line',
  'pearl-accent', 'jelly-color', 'tiny-floral',
  'sculpted-flower', 'watercolor-bloom', 'crystal-gravel',
] as const;
export type LookPresetId = (typeof LOOK_PRESET_IDS)[number];

export const DESIGN_LENGTH_PRESET_IDS = ['natural', 'short-extension', 'medium', 'long'] as const;
export type DesignLengthPreset = (typeof DESIGN_LENGTH_PRESET_IDS)[number];

export const COLOR_PRESET_IDS = ['milk-tea-nude', 'nude-pink', 'milky-white', 'gray-nude', 'jelly-pink'] as const;
export type ColorPresetId = (typeof COLOR_PRESET_IDS)[number];

export const SURFACE_PRESET_IDS = ['gloss', 'matte', 'cat-eye', 'aurora', 'silk'] as const;
export type SurfacePresetId = (typeof SURFACE_PRESET_IDS)[number];

export const OPTICAL_EFFECT_IDS = ['none', 'cat-eye', 'aurora', 'silk', 'pearl'] as const;
export type OpticalEffect = (typeof OPTICAL_EFFECT_IDS)[number];

export const TOP_FINISH_IDS = ['gloss', 'matte'] as const;
export type TopFinish = (typeof TOP_FINISH_IDS)[number];

export const DECORATION_IDS = ['pearl', 'rhinestone', 'metallic-line', 'caviar-bead', '3d-flower'] as const;
export type DecorationId = (typeof DECORATION_IDS)[number];

export const OCCASION_IDS = ['commute', 'date', 'wedding', 'party', 'vacation'] as const;
export type OccasionId = (typeof OCCASION_IDS)[number];

export const BASE_COVERAGE_IDS = ['opaque', 'translucent'] as const;
export type BaseCoverage = (typeof BASE_COVERAGE_IDS)[number];

export const RECIPE_GEOMETRY_LENGTH_IDS = ['short', 'medium', 'long', 'extra-long'] as const;

export function isOneOf<const T extends readonly string[]>(values: T, value: unknown): value is T[number] {
  return typeof value === 'string' && values.includes(value);
}
