/**
 * Shared display contract for locale-neutral nail taxonomy IDs.
 *
 * Machine enums remain owned by their domain contracts. This module owns only
 * labels, aliases and deterministic display fallback for Community, Wizard and
 * Editor. A namespace is required because IDs such as `pearl` have different
 * meanings in the optical-effect and attachment domains.
 */

import type { Locale } from '@/lib/i18n';

export type NailTaxonomyNamespace =
  | 'shape'
  | 'geometry-length'
  | 'design-length'
  | 'base-coverage'
  | 'optical-effect'
  | 'top-finish'
  | 'wizard-finish'
  | 'layer'
  | 'attachment'
  | 'community-style'
  | 'community-occasion'
  | 'community-mood'
  | 'community-effect'
  | 'community-color'
  | 'community-season'
  | 'community-subject';

export interface LocalizedTaxonomyItem {
  id: string;
  label: string;
  labelEn?: string;
}

export interface NailTaxonomyLabelEntry {
  namespace: NailTaxonomyNamespace;
  id: string;
  en: string;
  zh: string;
  owner: 'shape-registry' | 'taxonomy-model' | 'layer-contract' | 'community-fixture' | 'asset-manifest';
  aliases?: readonly string[];
}

export interface NailTaxonomyAlias {
  namespace: NailTaxonomyNamespace;
  alias: string;
  canonicalId: string;
  deprecated: true;
}

const SHAPE_LABELS: readonly NailTaxonomyLabelEntry[] = [
  'almond', 'oval', 'square', 'round', 'coffin', 'squoval', 'stiletto',
  'soft-square', 'tapered-square', 'ballerina', 'lipstick', 'flare',
  'mountain-peak', 'edge', 'arrowhead',
].map((id) => ({
  namespace: 'shape',
  id,
  en: id.split('-').map((part) => `${part[0].toUpperCase()}${part.slice(1)}`).join(' '),
  // Product convention: US shape names stay English in both display locales.
  zh: id.split('-').map((part) => `${part[0].toUpperCase()}${part.slice(1)}`).join(' '),
  owner: 'shape-registry',
}));

export const NAIL_TAXONOMY_LABELS: readonly NailTaxonomyLabelEntry[] = [
  ...SHAPE_LABELS,
  { namespace: 'geometry-length', id: 'short', en: 'Short', zh: '短', owner: 'taxonomy-model' },
  { namespace: 'geometry-length', id: 'medium', en: 'Medium', zh: '中', owner: 'taxonomy-model' },
  { namespace: 'geometry-length', id: 'long', en: 'Long', zh: '长', owner: 'taxonomy-model' },
  { namespace: 'geometry-length', id: 'extra-long', en: 'XL', zh: '超长', owner: 'taxonomy-model', aliases: ['xlong', 'extra_long'] },
  { namespace: 'design-length', id: 'natural', en: 'Natural', zh: '本甲长度', owner: 'taxonomy-model' },
  { namespace: 'design-length', id: 'short-extension', en: 'Short extension', zh: '短延长', owner: 'taxonomy-model' },
  { namespace: 'design-length', id: 'medium', en: 'Medium', zh: '中长度', owner: 'taxonomy-model' },
  { namespace: 'design-length', id: 'long', en: 'Long', zh: '长', owner: 'taxonomy-model' },
  { namespace: 'base-coverage', id: 'opaque', en: 'Opaque', zh: '不透明', owner: 'taxonomy-model' },
  { namespace: 'base-coverage', id: 'translucent', en: 'Translucent', zh: '半透明', owner: 'taxonomy-model' },
  { namespace: 'optical-effect', id: 'none', en: 'None', zh: '无光学', owner: 'taxonomy-model' },
  { namespace: 'optical-effect', id: 'cat-eye', en: 'Cat-Eye', zh: '猫眼', owner: 'taxonomy-model', aliases: ['cat_eye', 'cateye'] },
  { namespace: 'optical-effect', id: 'aurora', en: 'Aura', zh: '极光', owner: 'taxonomy-model' },
  { namespace: 'optical-effect', id: 'silk', en: 'Velvet', zh: '丝绒', owner: 'taxonomy-model' },
  { namespace: 'optical-effect', id: 'pearl', en: 'Pearlescent', zh: '珠光', owner: 'taxonomy-model' },
  { namespace: 'top-finish', id: 'gloss', en: 'Glossy', zh: '亮面', owner: 'taxonomy-model' },
  { namespace: 'top-finish', id: 'matte', en: 'Matte', zh: '哑光', owner: 'taxonomy-model' },
  { namespace: 'wizard-finish', id: 'gloss', en: 'Glossy', zh: '亮面', owner: 'asset-manifest' },
  { namespace: 'wizard-finish', id: 'matte', en: 'Matte', zh: '哑光', owner: 'asset-manifest' },
  { namespace: 'wizard-finish', id: 'pearl', en: 'Pearlescent', zh: '珠光', owner: 'asset-manifest' },
  { namespace: 'layer', id: 'builtin.base_surface', en: 'Base', zh: '底色/表面', owner: 'layer-contract' },
  { namespace: 'layer', id: 'builtin.draw', en: 'Hand Paint', zh: '手绘', owner: 'layer-contract' },
  { namespace: 'layer', id: 'builtin.art_2d', en: 'Art 2D', zh: '二维素材', owner: 'layer-contract' },
  { namespace: 'layer', id: 'builtin.relief', en: 'Relief', zh: '立体结构', owner: 'layer-contract' },
  { namespace: 'layer', id: 'builtin.attachment', en: 'Charms & Accents', zh: '饰品', owner: 'layer-contract' },
  { namespace: 'layer', id: 'builtin.recipe', en: 'Recipe', zh: '配方层', owner: 'layer-contract' },
  { namespace: 'attachment', id: 'heart', en: 'Heart', zh: '爱心', owner: 'asset-manifest' },
  { namespace: 'attachment', id: 'pearl', en: 'Pearl', zh: '珍珠', owner: 'asset-manifest' },
  { namespace: 'attachment', id: 'bow', en: 'Bow', zh: '蝴蝶结', owner: 'asset-manifest' },
  { namespace: 'attachment', id: 'star', en: 'Star', zh: '星星', owner: 'asset-manifest' },
  // Community effects that overlap Studio use Studio-consistent terminology.
  { namespace: 'community-effect', id: 'pearl', en: 'Pearlescent', zh: '珠光', owner: 'community-fixture' },
  { namespace: 'community-effect', id: 'cat-eye', en: 'Cat-Eye', zh: '猫眼', owner: 'community-fixture', aliases: ['cat_eye', 'cateye'] },
  { namespace: 'community-effect', id: 'aurora', en: 'Aura', zh: '极光', owner: 'community-fixture' },
  { namespace: 'community-effect', id: 'matte', en: 'Matte', zh: '哑光', owner: 'community-fixture' },
  { namespace: 'community-effect', id: 'gloss', en: 'Glossy', zh: '亮面', owner: 'community-fixture' },
  { namespace: 'community-effect', id: 'chrome', en: 'Chrome', zh: '镜面/金属', owner: 'community-fixture' },
  { namespace: 'community-effect', id: 'relief', en: 'Relief', zh: '浮雕', owner: 'community-fixture' },
];

export const NAIL_TAXONOMY_ALIASES: readonly NailTaxonomyAlias[] = NAIL_TAXONOMY_LABELS.flatMap(
  (entry) => (entry.aliases ?? []).map((alias) => ({
    namespace: entry.namespace,
    alias,
    canonicalId: entry.id,
    deprecated: true as const,
  })),
);

const canonicalByKey = new Map<string, NailTaxonomyLabelEntry>();
const aliasByKey = new Map<string, NailTaxonomyLabelEntry>();

function key(namespace: NailTaxonomyNamespace, id: string): string {
  return `${namespace}:${id}`;
}

for (const entry of NAIL_TAXONOMY_LABELS) {
  canonicalByKey.set(key(entry.namespace, entry.id), entry);
  for (const alias of entry.aliases ?? []) aliasByKey.set(key(entry.namespace, alias), entry);
}

export function validateTaxonomyLabelEntries(entries: readonly NailTaxonomyLabelEntry[]): string[] {
  const errors: string[] = [];
  const canonical = new Set<string>();
  const aliases = new Set<string>();
  for (const entry of entries) {
    const canonicalKey = key(entry.namespace, entry.id);
    if (canonical.has(canonicalKey)) errors.push(`duplicate id: ${canonicalKey}`);
    canonical.add(canonicalKey);
    for (const alias of entry.aliases ?? []) {
      const aliasKey = key(entry.namespace, alias);
      if (aliases.has(aliasKey)) errors.push(`duplicate alias: ${aliasKey}`);
      if (canonical.has(aliasKey)) errors.push(`alias conflicts with id: ${aliasKey}`);
      aliases.add(aliasKey);
    }
  }
  for (const alias of aliases) {
    if (canonical.has(alias)) errors.push(`alias conflicts with id: ${alias}`);
  }
  return [...new Set(errors)];
}

export function resolveTaxonomyEntry(
  namespace: NailTaxonomyNamespace,
  id: string,
): NailTaxonomyLabelEntry | undefined {
  return canonicalByKey.get(key(namespace, id)) ?? aliasByKey.get(key(namespace, id));
}

export function canonicalTaxonomyId(namespace: NailTaxonomyNamespace, id: string): string {
  return resolveTaxonomyEntry(namespace, id)?.id ?? id;
}

export function taxonomyLabel(
  namespace: NailTaxonomyNamespace,
  id: string,
  locale: Locale,
  fallback?: { zh?: string; en?: string },
): string {
  const entry = resolveTaxonomyEntry(namespace, id);
  if (entry) return locale === 'en' ? entry.en : entry.zh;
  const localized = locale === 'en'
    ? fallback?.en?.trim() || fallback?.zh?.trim()
    : fallback?.zh?.trim() || fallback?.en?.trim();
  if (localized) return localized;
  return locale === 'en' ? `Unknown (${id || 'missing'})` : `未知（${id || 'missing'}）`;
}

export function communityTaxonomyLabel(
  namespace: Extract<NailTaxonomyNamespace, `community-${string}`>,
  item: LocalizedTaxonomyItem | undefined,
  locale: Locale,
  unknownId = '',
): string {
  const id = item?.id ?? unknownId;
  return taxonomyLabel(namespace, id, locale, { zh: item?.label, en: item?.labelEn });
}
