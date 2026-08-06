/**
 * US Nail Element Taxonomy (PR-08).
 * Stable machine IDs with centralized English labels.
 * All routes remain locale-switchable; stored data is locale-neutral.
 */

export interface NailTaxonomyElement {
  /** Stable machine ID (never changes). */
  id: string;
  /** English display label (default locale). */
  label_en: string;
  /** Chinese display label. */
  label_zh: string;
  /** Category grouping. */
  category: 'shape' | 'length' | 'finish' | 'coverage' | 'optical' | 'layer' | 'element';
  /** Legacy aliases (for migration). */
  aliases?: string[];
}

/**
 * Canonical nail element taxonomy.
 * IDs are stable and must not be renamed without an explicit migration.
 */
export const NAIL_TAXONOMY: readonly NailTaxonomyElement[] = [
  /* ── Shapes ── */
  { id: 'almond', label_en: 'Almond', label_zh: '杏仁形', category: 'shape' },
  { id: 'oval', label_en: 'Oval', label_zh: '椭圆形', category: 'shape' },
  { id: 'coffin', label_en: 'Coffin', label_zh: '棺材形', category: 'shape' },
  { id: 'squoval', label_en: 'Squoval', label_zh: '方圆', category: 'shape' },
  { id: 'square', label_en: 'Square', label_zh: '方形', category: 'shape' },

  /* ── Lengths ── */
  { id: 'short', label_en: 'Short', label_zh: '短', category: 'length' },
  { id: 'medium', label_en: 'Medium', label_zh: '中', category: 'length' },
  { id: 'long', label_en: 'Long', label_zh: '长', category: 'length' },
  { id: 'extra-long', label_en: 'Extra Long', label_zh: '超长', category: 'length', aliases: ['xlong'] },

  /* ── Finishes ── */
  { id: 'gloss', label_en: 'Gloss', label_zh: '亮面', category: 'finish' },
  { id: 'matte', label_en: 'Matte', label_zh: '哑光', category: 'finish' },

  /* ── Base Coverage ── */
  { id: 'opaque', label_en: 'Opaque', label_zh: '不透明', category: 'coverage' },
  { id: 'translucent', label_en: 'Translucent', label_zh: '半透明', category: 'coverage' },

  /* ── Optical Effects ── */
  { id: 'none', label_en: 'None', label_zh: '无', category: 'optical' },
  { id: 'cat-eye', label_en: 'Cat Eye', label_zh: '猫眼', category: 'optical', aliases: ['cat_eye', 'cateye'] },
  { id: 'aurora', label_en: 'Aurora', label_zh: '极光', category: 'optical' },
  { id: 'silk', label_en: 'Silk', label_zh: '丝绸', category: 'optical' },
  { id: 'pearl', label_en: 'Pearl', label_zh: '珍珠', category: 'optical' },

  /* ── Layer Types ── */
  { id: 'builtin.base_surface', label_en: 'Base Surface', label_zh: '底色/表面', category: 'layer' },
  { id: 'builtin.draw', label_en: 'Draw', label_zh: '手绘', category: 'layer' },
  { id: 'builtin.art_2d', label_en: '2D Art', label_zh: '二维素材', category: 'layer' },
  { id: 'builtin.attachment', label_en: 'Attachment', label_zh: '附件', category: 'layer' },
  { id: 'builtin.relief', label_en: 'Relief', label_zh: '立体结构', category: 'layer' },
  { id: 'builtin.recipe', label_en: 'Recipe', label_zh: '配方层', category: 'layer' },

  /* ── Element Domains ── */
  { id: 'pattern', label_en: 'Pattern', label_zh: '图案', category: 'element' },
  { id: 'attachment', label_en: 'Attachment', label_zh: '附件', category: 'element' },
  { id: 'relief', label_en: 'Relief', label_zh: '浮雕', category: 'element' },
];

/* ── Lookup functions ──────────────────────────────────── */

const byId = new Map(NAIL_TAXONOMY.map((e) => [e.id, e]));
const aliasMap = new Map<string, NailTaxonomyElement>();
for (const el of NAIL_TAXONOMY) {
  if (el.aliases) {
    for (const alias of el.aliases) {
      aliasMap.set(alias, el);
    }
  }
}

/** Resolve a taxonomy element by ID or alias. Returns undefined if not found. */
export function resolveTaxonomyElement(id: string): NailTaxonomyElement | undefined {
  return byId.get(id) ?? aliasMap.get(id);
}

/** Get the display label for a taxonomy ID in the specified locale. */
export function getTaxonomyLabel(id: string, locale: 'en' | 'zh' = 'zh'): string {
  const el = resolveTaxonomyElement(id);
  if (!el) return id;
  return locale === 'en' ? el.label_en : el.label_zh;
}

/** Resolve a legacy ID to its canonical form. Returns the input if already canonical. */
export function migrateLegacyId(legacyId: string): string {
  const el = aliasMap.get(legacyId);
  return el ? el.id : legacyId;
}

/** Check if an ID is a valid taxonomy element. */
export function isValidTaxonomyId(id: string): boolean {
  return byId.has(id) || aliasMap.has(id);
}
