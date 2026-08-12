/**
 * 素材消费层（模块 4 · Editor）
 *
 * 纪律：模板 / 甲型轮廓 / 色板 / 质感 / 附件组件一律从 material-library（与 assets/decorations）
 * 的 JSON 清单与 SVG 文件读取，禁止硬编码清单（DEV-PLAN §2.3-8、material-library/README）。
 * 通过 import.meta.glob 以 raw 文本打包进构建产物，dev 与 build 行为一致。
 */

import type { Finish, NailLength, NailShape } from '@/lib/types';
import type { Locale } from '@/lib/i18n';
import { taxonomyLabel } from '@/studio/shared/nail-taxonomy-labels';
import type {
  BaseCoverage,
  ColorPresetId,
  LookPresetId,
  OpticalEffect,
  StyleDirection,
  SurfacePresetId,
  TopFinish,
} from './taxonomy-model';

/* ── raw 资产装载 ─────────────────────────────────────── */

const silhouetteRaw = import.meta.glob('../../../../material-library/shapes/silhouettes/*.svg', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

const patternRaw = import.meta.glob('../../../../material-library/templates/*/patterns/*.svg', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

const decorationRaw = import.meta.glob('../../../../assets/decorations/*.svg', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

const jsonRaw = import.meta.glob('../../../../material-library/**/*.json', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

const decorationManifestRaw = import.meta.glob('../../../../assets/decorations/manifest.json', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

function pickJson<T>(files: Record<string, string>, suffix: string): T | null {
  for (const [path, raw] of Object.entries(files)) {
    if (path.endsWith(suffix)) {
      try {
        return JSON.parse(raw) as T;
      } catch {
        return null;
      }
    }
  }
  return null;
}

/* ── 清单类型（消费侧最小字段集） ──────────────────────── */

export interface TemplateIndexEntry {
  id: string;
  name: string;
  name_en: string;
  style_tags: string[];
  default_base_color: string;
  default_finish: Finish;
  sort_order: number;
}

interface TemplatesIndexFile {
  templates: TemplateIndexEntry[];
}

export interface PaletteColor {
  id: string;
  name: string;
  hex: string;
  sort_order?: number;
}

export interface BrandPaletteColor extends PaletteColor {
  brand: 'OPI' | 'CND' | 'Essie';
}

interface BrandPaletteFile {
  colors: BrandPaletteColor[];
}

let brandPaletteCache: BrandPaletteColor[] | null = null;

/** 画笔品牌色板（120 色）异步懒加载 */
export async function loadBrandPalette(): Promise<BrandPaletteColor[]> {
  if (brandPaletteCache) return brandPaletteCache;
  const mod = await import('../../../../material-library/colors/brand-palette.json');
  const file = (mod.default ?? mod) as BrandPaletteFile;
  brandPaletteCache = (file.colors ?? [])
    .slice()
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  return brandPaletteCache;
}

export const RECENT_COLORS_KEY = 'editor.brush.recentColors';
export const RECENT_COLORS_MAX = 8;

export function loadRecentColors(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_COLORS_KEY);
    if (raw) return JSON.parse(raw) as string[];
  } catch {
    /* ignore */
  }
  return [];
}

export function pushRecentColor(hex: string): void {
  const list = loadRecentColors().filter((c) => c.toLowerCase() !== hex.toLowerCase());
  list.unshift(hex);
  try {
    localStorage.setItem(RECENT_COLORS_KEY, JSON.stringify(list.slice(0, RECENT_COLORS_MAX)));
  } catch {
    /* ignore */
  }
}

export interface FinishMeta {
  id: Finish;
  name: string;
}

export interface DecorationDef {
  id: string;
  name: string;
  file: string;
  defaults: { x: number; y: number; scale: number; rotation: number; heightMm: number };
}

interface ShapeParamsFile {
  version?: number;
  shapes: Record<string, { name: string; name_en?: string }>;
  lengths?: Record<string, { name?: string; lengthMm?: number }>;
}

export interface EditorShapeCapability {
  id: NailShape;
  label_en: string;
  tier: 1 | 2;
  order: number;
  geometry_id?: NailShape | null;
  capabilities: {
    geometry: 'placeholder' | 'generated' | 'in_review' | 'signed_off';
    editor: 'disabled' | 'experimental' | 'enabled';
  };
}

interface ShapeCapabilitiesFile {
  version?: number;
  shapes: EditorShapeCapability[];
}

export interface TaxonomyColorPreset {
  id: ColorPresetId;
  name: string;
  hex: string;
  base_coverage: BaseCoverage;
}

export interface TaxonomySurfacePreset {
  id: SurfacePresetId;
  name: string;
  appearance: {
    optical_effect: OpticalEffect;
    top_finish: TopFinish;
  };
}

export interface TaxonomyLookPreset {
  id: LookPresetId;
  name: string;
  direction: StyleDirection;
  recipe: string;
  surface: string;
  color_preset?: string;
  preview_only?: boolean;
}

interface NailDesignTaxonomy {
  look_presets: TaxonomyLookPreset[];
  color_presets: TaxonomyColorPreset[];
  surface_presets: TaxonomySurfacePreset[];
}

/* ── 清单导出（运行时读取，非硬编码） ──────────────────── */

const templatesIndex = pickJson<TemplatesIndexFile>(jsonRaw, '/index.json');
export const TEMPLATES: readonly TemplateIndexEntry[] = templatesIndex?.templates ?? [];

export const PALETTE: readonly PaletteColor[] = (
  pickJson<{ colors: PaletteColor[] }>(jsonRaw, '/colors/palette.json')?.colors ?? []
)
  .slice()
  .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

export const FINISHES: readonly FinishMeta[] =
  pickJson<{ finishes: FinishMeta[] }>(jsonRaw, '/finishes/finishes.json')?.finishes ?? [];

const decorationManifest =
  pickJson<{ decorations: DecorationDef[] }>(decorationManifestRaw, 'manifest.json');
export const DECORATIONS: readonly DecorationDef[] = decorationManifest?.decorations ?? [];

const shapeParams = pickJson<ShapeParamsFile>(jsonRaw, '/shapes/shape-params.json');
const shapeCapabilities = pickJson<ShapeCapabilitiesFile>(jsonRaw, '/shapes/shape-capabilities.json');
const taxonomy = pickJson<NailDesignTaxonomy>(jsonRaw, '/taxonomy/nail-design-taxonomy.json');
export const LOOK_PRESETS: readonly TaxonomyLookPreset[] = taxonomy?.look_presets ?? [];
export const COLOR_PRESETS: readonly TaxonomyColorPreset[] = taxonomy?.color_presets ?? [];
export const SURFACE_PRESETS: readonly TaxonomySurfacePreset[] = taxonomy?.surface_presets ?? [];

/** Geometry registry metadata. Shape parameters remain the sole geometry source. */
export const SHAPE_PARAMS_VERSION = Number.isInteger(shapeParams?.version)
  ? shapeParams!.version as number
  : 0;
export const SHAPE_CAPABILITIES_VERSION = Number.isInteger(shapeCapabilities?.version)
  ? shapeCapabilities!.version as number
  : 0;
export const EDITOR_SHAPE_CAPABILITIES: readonly EditorShapeCapability[] =
  shapeCapabilities?.shapes ?? [];

export function editorShapeCapability(shape: NailShape): EditorShapeCapability | null {
  return EDITOR_SHAPE_CAPABILITIES.find((entry) => entry.id === shape) ?? null;
}

export function shapeName(shape: NailShape, locale: Locale = 'en'): string {
  const fallback = shapeParams?.shapes?.[shape];
  return taxonomyLabel('shape', shape, locale, { zh: fallback?.name, en: fallback?.name_en });
}

export function isEditorShapeEnabled(shape: EditorShapeCapability): boolean {
  return shape.capabilities.geometry === 'signed_off' && shape.capabilities.editor === 'enabled';
}

export const TIER_ONE_EDITOR_SHAPES: readonly EditorShapeCapability[] = (
  EDITOR_SHAPE_CAPABILITIES
)
  .filter((shape) => shape.tier === 1)
  .sort((a, b) => {
    const readiness = Number(isEditorShapeEnabled(b)) - Number(isEditorShapeEnabled(a));
    return readiness !== 0 ? readiness : a.order - b.order;
  });

export function lengthName(length: NailLength, locale: Locale = 'zh'): string {
  return taxonomyLabel('geometry-length', length, locale);
}

/** 紧凑型 Editor 控件只暴露能力注册表中已签收、已启用的甲型。 */
export const SHAPES: readonly NailShape[] = TIER_ONE_EDITOR_SHAPES
  .filter(isEditorShapeEnabled)
  .map((shape) => shape.id);
export const LENGTHS: readonly NailLength[] = ['short', 'medium', 'long', 'extra-long'];

export function templateById(id: string): TemplateIndexEntry | undefined {
  return TEMPLATES.find((t) => t.id === id);
}

/* ── SVG 解析与取用 ───────────────────────────────────── */

function fileKey(path: string): string {
  return path.split('/').pop() ?? path;
}

/** 轮廓文件名：extra-long → extra_long（README 约定） */
function silhouetteFileName(shape: NailShape, length: NailLength): string {
  return `${shape}_${length.replace('-', '_')}.svg`;
}

export interface SilhouetteInfo {
  viewBox: string;
  /** 轮廓 path 的 d（甲型边界，clip 与描边共用） */
  pathD: string;
}

/** 读取甲型轮廓（shape-params 唯一参数源的生成产物）；缺失返回 null → 调用方降级 */
export function getSilhouette(shape: NailShape, length: NailLength): SilhouetteInfo | null {
  const name = silhouetteFileName(shape, length);
  for (const [path, raw] of Object.entries(silhouetteRaw)) {
    if (fileKey(path) === name) {
      const viewBox = raw.match(/viewBox="([^"]+)"/)?.[1];
      const pathD = raw.match(/<path d="([^"]+)"/)?.[1];
      if (viewBox && pathD) return { viewBox, pathD };
      return null;
    }
  }
  return null;
}

export interface PatternArtwork {
  /** 去掉外层 <svg> 的内部片段（含自身 defs + clip 组），可直接内嵌 */
  inner: string;
  /** 原模板坐标系；嵌入 V7 nail-local 画布时不得猜测。 */
  viewBox: string;
}

/** 读取某模板在某甲型上的图案 SVG 内部片段；clip id 由调用方改名防冲突 */
export function getPatternArtwork(templateId: string, shape: NailShape): PatternArtwork | null {
  const name = `${shape}.svg`;
  for (const [path, raw] of Object.entries(patternRaw)) {
    if (path.includes(`/templates/${templateId}/patterns/`) && fileKey(path) === name) {
      const viewBox = raw.match(/viewBox="([^"]+)"/)?.[1];
      if (!viewBox) return null;
      const inner = raw.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');
      return { inner, viewBox };
    }
  }
  return null;
}

/** 读取附件组件 SVG 内部片段（组件原点 = 组件中心） */
export function getDecorationInner(decorationId: string): string | null {
  for (const [path, raw] of Object.entries(decorationRaw)) {
    if (fileKey(path) === `${decorationId}.svg`) {
      return raw.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');
    }
  }
  return null;
}
