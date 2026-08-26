/**
 * material-library JSON 清单加载 + 甲型×风格映射（DEV-PLAN §5）
 *
 * 模板清单 / 色板 / 质感 / shape-params 一律 fetch 自 /material-library/*，
 * 禁止硬编码（§2.3-8）。模块级缓存，失败自动失效以便重试。
 */

import type { Finish, NailLength, NailShape } from '@/lib/types';
import { getOfficialTemplatePatternAssetV7 } from '@/studio/editor/v7/official-template-assets';

/* ── 数据模型（与 material-library/*.json 对齐） ── */

export interface StyleTag {
  id: string;
  name: string;
  name_en: string;
}

export interface ShapeCompatibility {
  highly_compatible: NailShape[];
  neutral: NailShape[];
  /** 不建议 → 人类可读原因（入库强制，不建议 ≠ 禁止，仍可应用） */
  not_recommended: Partial<Record<NailShape, string>>;
}

export interface TemplateEntry {
  id: string;
  name: string;
  name_en: string;
  /** SIMULATED 仅表示 Canonical Renderer 已由人类视觉签收，不代表可制造。 */
  asset_status?: 'REAL' | 'CONCEPT' | 'SIMULATED';
  render_template_id?: string;
  recipe_ref?: { id: string; version: string; preset_id: string };
  asset_spec_url?: string;
  capability_summary?: {
    supported: string[];
    pending: string[];
  };
  style_tags: string[];
  default_base_color: string;
  default_finish: Finish;
  shape_compatibility: ShapeCompatibility;
  thumbnail_url: string;
  manifest_url: string;
  sort_order: number;
  /** Explicit Quick Start placement. Community/editorial cards are not starters. */
  quick_start?: {
    enabled: boolean;
    placement: 'OFFICIAL_TEMPLATE';
    editor_ready: boolean;
    source: 'TEMPLATE_ASSET_REGISTRY';
  };
  /** Shape claims are explicit; Quick Start verifies each against V7 registry. */
  applies_to_shapes?: NailShape[];
}

export interface LibraryIndex {
  style_tags: StyleTag[];
  shape_ids: NailShape[];
  templates: TemplateEntry[];
}

export interface PaletteColor {
  id: string;
  name: string;
  name_en: string;
  hex: string;
  sort_order: number;
}

export interface FinishMeta {
  id: Finish;
  name: string;
  name_en: string;
  description: string;
}

export interface ShapeParams {
  shapes: Partial<Record<NailShape, { name: string; name_en: string }>>;
  lengths: Record<NailLength, { name: string; lengthMm: number; widthMm: number }>;
}

export type ShapeGeometryStatus = 'placeholder' | 'generated' | 'in_review' | 'signed_off';
export type ShapeFeatureStatus = 'disabled' | 'experimental' | 'enabled';
export type ShapeAssetStatus = 'missing' | 'in_progress' | 'complete';

export interface ShapeCapability {
  id: NailShape;
  label: string;
  label_en: string;
  tier: 1 | 2;
  order: number;
  family: string;
  aliases: string[];
  /** 指向 shape-params 的几何 ID；null 表示只有产品占位，不存在轮廓资产。 */
  geometry_id: NailShape | null;
  capabilities: {
    geometry: ShapeGeometryStatus;
    editor: ShapeFeatureStatus;
    templates: ShapeAssetStatus;
    styles: ShapeAssetStatus;
    wizard: ShapeFeatureStatus;
  };
}

export interface ShapeCapabilitiesRegistry {
  version: number;
  updated_at: string;
  comment: string;
  shapes: ShapeCapability[];
}

/* ── 加载（缓存 + 失败失效） ── */

function cachedJson<T>(cache: { p: Promise<T> | null }, url: string): Promise<T> {
  if (!cache.p) {
    cache.p = fetch(url).then((res) => {
      if (!res.ok) throw new Error(`清单加载失败：${url}（HTTP ${res.status}）`);
      return res.json() as Promise<T>;
    });
    cache.p.catch(() => {
      cache.p = null;
    });
  }
  return cache.p;
}

const indexCache: { p: Promise<LibraryIndex> | null } = { p: null };
const paletteCache: { p: Promise<{ colors: PaletteColor[] }> | null } = { p: null };
const finishesCache: { p: Promise<{ finishes: FinishMeta[] }> | null } = { p: null };
const shapeParamsCache: { p: Promise<ShapeParams> | null } = { p: null };
const shapeCapabilitiesCache: { p: Promise<ShapeCapabilitiesRegistry> | null } = { p: null };

export function loadLibraryIndex(): Promise<LibraryIndex> {
  return cachedJson(indexCache, '/material-library/index.json');
}

export async function loadPalette(): Promise<PaletteColor[]> {
  const data = await cachedJson<{ colors: PaletteColor[] }>(paletteCache, '/material-library/colors/palette.json');
  return data.colors;
}

export async function loadFinishes(): Promise<FinishMeta[]> {
  const data = await cachedJson<{ finishes: FinishMeta[] }>(finishesCache, '/material-library/finishes/finishes.json');
  return data.finishes;
}

export function loadShapeParams(): Promise<ShapeParams> {
  return cachedJson(shapeParamsCache, '/material-library/shapes/shape-params.json');
}

export function loadShapeCapabilities(): Promise<ShapeCapabilitiesRegistry> {
  return cachedJson(shapeCapabilitiesCache, '/material-library/shapes/shape-capabilities.json');
}

/** Wizard 门禁：注册可见不等于可编辑；四项资产/签收条件缺一不可。 */
export function isWizardShapeEnabled(shape: ShapeCapability): boolean {
  return (
    shape.capabilities.wizard === 'enabled' &&
    shape.capabilities.geometry === 'signed_off' &&
    shape.capabilities.templates === 'complete' &&
    shape.capabilities.styles === 'complete' &&
    shape.geometry_id !== null
  );
}

export function shapeAvailabilityLabel(shape: ShapeCapability): string {
  if (isWizardShapeEnabled(shape)) return '可用';
  if (shape.capabilities.geometry === 'placeholder') return '规划中';
  if (shape.capabilities.geometry !== 'signed_off') return '校准中';
  if (shape.capabilities.templates !== 'complete' || shape.capabilities.styles !== 'complete') {
    return '模板适配中';
  }
  return '即将推出';
}

/* ── 甲型 × 风格映射（§5.3 方向 A：纯前端排序规则） ── */

export type CompatTier = 'high' | 'neutral' | 'not';

export function compatTier(template: TemplateEntry, shape: NailShape): CompatTier {
  const c = template.shape_compatibility;
  if (c.highly_compatible.includes(shape)) return 'high';
  if (shape in c.not_recommended) return 'not';
  return 'neutral';
}

export function notRecommendedReason(template: TemplateEntry, shape: NailShape): string | null {
  return template.shape_compatibility.not_recommended[shape] ?? null;
}

/** Hero-recipe editorial cover, not a legacy generated template thumbnail. */
export function hasHighFidelityCover(template: TemplateEntry): boolean {
  return template.thumbnail_url.startsWith('assets/hero-recipes/');
}

/** Legacy helper for editorial Hero cards; Quick Start uses isQuickStartOfficialTemplate. */
export function isHighFidelityConceptGalleryTemplate(template: TemplateEntry): boolean {
  return (
    hasHighFidelityCover(template)
    && (template.asset_status === 'CONCEPT' || template.asset_status === 'SIMULATED')
  );
}

/**
 * Quick Start must be driven by an explicit starter declaration and the
 * immutable pattern registry, never by an editorial hero cover.
 */
export function isQuickStartOfficialTemplate(template: TemplateEntry, shape?: NailShape): boolean {
  if (template.asset_status !== 'REAL' || !template.quick_start
    || template.quick_start.enabled !== true
    || template.quick_start.placement !== 'OFFICIAL_TEMPLATE'
    || template.quick_start.editor_ready !== true
    || template.quick_start.source !== 'TEMPLATE_ASSET_REGISTRY') return false;
  const appliesToShapes = template.applies_to_shapes;
  const allShapes: readonly NailShape[] = ['almond', 'oval', 'coffin', 'squoval', 'round', 'square', 'stiletto'];
  if (!Array.isArray(appliesToShapes) || appliesToShapes.length === 0
    || new Set(appliesToShapes).size !== appliesToShapes.length
    || appliesToShapes.some((candidate) => !allShapes.includes(candidate)
      || getOfficialTemplatePatternAssetV7(template.id, candidate) === null)) return false;
  if (shape === undefined) return true;
  return allShapes.includes(shape) && appliesToShapes.includes(shape)
    && getOfficialTemplatePatternAssetV7(template.id, shape) !== null;
}

const TIER_ORDER: Record<CompatTier, number> = { high: 0, neutral: 1, not: 2 };

/** 按当前甲型三档排序：推荐 → 一般 → 不建议（档内按 sort_order 稳定排序） */
export function sortTemplatesForShape(templates: TemplateEntry[], shape: NailShape): TemplateEntry[] {
  return [...templates].sort((a, b) => {
    const tierDiff = TIER_ORDER[compatTier(a, shape)] - TIER_ORDER[compatTier(b, shape)];
    return tierDiff !== 0 ? tierDiff : a.sort_order - b.sort_order;
  });
}

/** §5.3 方向 B：卡片最佳甲型 badge 数据（★ 首选 / ✓ 其余推荐 / ⚠ 不建议） */
export function shapeBadges(template: TemplateEntry): {
  best: NailShape | null;
  good: NailShape[];
  bad: NailShape[];
} {
  const c = template.shape_compatibility;
  return {
    best: c.highly_compatible[0] ?? null,
    good: c.highly_compatible.slice(1),
    bad: Object.keys(c.not_recommended) as NailShape[],
  };
}
