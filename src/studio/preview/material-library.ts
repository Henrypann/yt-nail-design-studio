/**
 * material-library JSON 清单加载 + 甲型×风格映射（DEV-PLAN §5）
 *
 * 模板清单 / 色板 / 质感 / shape-params 一律 fetch 自 /material-library/*，
 * 禁止硬编码（§2.3-8）。模块级缓存，失败自动失效以便重试。
 */

import type { Finish, NailLength, NailShape } from '@/lib/types';

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
  style_tags: string[];
  default_base_color: string;
  default_finish: Finish;
  shape_compatibility: ShapeCompatibility;
  thumbnail_url: string;
  manifest_url: string;
  sort_order: number;
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
  shapes: Record<NailShape, { name: string; name_en: string }>;
  lengths: Record<NailLength, { name: string; lengthMm: number; widthMm: number }>;
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
