/**
 * Community v0.7.2 · COMM-v0.7.2-TAX-01 deterministic tag resolver.
 *
 * Resolution contract:
 * - a raw string that is an ACTIVE tag id resolves to that tag;
 * - a raw string that is a DEPRECATED/MERGED tag id (or one of their aliases)
 *   follows the replacement chain to its final ACTIVE tag;
 * - a raw string that is an alias resolves to its owner tag (then the
 *   replacement chain above);
 * - anything else is unresolvable (null).
 *
 * Resolution never reads labels, never invents tags, and is cycle-safe. In
 * particular, legacy french style ids (ST-02 / 法式 / French / french /
 * French Tip / 法式线) resolve deterministically to `technique:french` and
 * never produce an overall style tag.
 */

import type { TaxonomyDimensionV2 } from './contract.ts';
import {
  DIMENSION_TAG_PREFIX,
  TAXONOMY_V2_DIMENSIONS,
} from './contract.ts';
import type { BilingualLabelsV2, CommunityTaxonomyV2, TaxonomyTagV2 } from './types.ts';

/** Final resolution always lands on an ACTIVE tag. */
export interface ResolvedTagV2 {
  id: string;
  dimension: TaxonomyDimensionV2;
  lifecycle: 'ACTIVE';
  labels: BilingualLabelsV2;
  aliases: readonly string[];
}

export interface TagIndexV2 {
  byId: Map<string, TaxonomyTagV2>;
  byAlias: Map<string, TaxonomyTagV2>;
}

/** Namespace prefix → dimension (e.g. `style` → STYLE). */
export function dimensionOfTagId(id: string): TaxonomyDimensionV2 | null {
  const prefix = id.slice(0, id.indexOf(':'));
  if (prefix.length === 0 || prefix === id) return null;
  for (const dimension of TAXONOMY_V2_DIMENSIONS) {
    if (DIMENSION_TAG_PREFIX[dimension] === prefix) return dimension;
  }
  return null;
}

export function buildTagIndex(taxonomy: CommunityTaxonomyV2): TagIndexV2 {
  const byId = new Map<string, TaxonomyTagV2>();
  const byAlias = new Map<string, TaxonomyTagV2>();
  for (const dimension of TAXONOMY_V2_DIMENSIONS) {
    for (const tag of taxonomy.dimensions[dimension].tags) {
      byId.set(tag.id, tag);
      for (const alias of tag.aliases) {
        // First occurrence wins; duplicate aliases are rejected at parse time.
        if (!byAlias.has(alias)) byAlias.set(alias, tag);
      }
    }
  }
  return { byId, byAlias };
}

/**
 * Deterministic resolution of any tag id / alias / replacement chain.
 * Returns null for unresolvable or non-ACTIVE terminal targets; never throws.
 */
export function resolveTagId(
  taxonomy: CommunityTaxonomyV2,
  raw: string,
): ResolvedTagV2 | null {
  const index = buildTagIndex(taxonomy);
  const start = index.byId.get(raw) ?? index.byAlias.get(raw);
  if (!start) return null;

  const visited = new Set<string>();
  let current: TaxonomyTagV2 | undefined = start;
  while (current) {
    if (current.lifecycle === 'ACTIVE') {
      return {
        id: current.id,
        dimension: dimensionOfTagId(current.id) ?? 'STYLE',
        lifecycle: 'ACTIVE',
        labels: current.labels,
        aliases: current.aliases,
      };
    }
    if (visited.has(current.id)) return null; // replacement cycle
    visited.add(current.id);
    if (!current.replacementId) return null; // non-ACTIVE without replacement
    const next = index.byId.get(current.replacementId);
    if (!next) return null;
    current = next;
  }
  return null;
}

export interface ResolveTagsResultV2 {
  /** raw id → resolved ACTIVE tag (only successfully resolved entries). */
  resolved: Map<string, ResolvedTagV2>;
  /** Raw ids that did not resolve (in input order). */
  issues: string[];
}

export function resolveTags(
  taxonomy: CommunityTaxonomyV2,
  ids: readonly string[],
): ResolveTagsResultV2 {
  const resolved = new Map<string, ResolvedTagV2>();
  const issues: string[] = [];
  for (const id of ids) {
    const tag = resolveTagId(taxonomy, id);
    if (tag) resolved.set(id, tag);
    else issues.push(id);
  }
  return { resolved, issues };
}

/** Legacy french style aliases (PRD §3.3): all resolve to technique:french. */
export const FRENCH_LEGACY_ALIASES = [
  'ST-02',
  '法式',
  'French',
  'french',
  'French Tip',
  '法式线',
] as const;

export function isFrenchLegacyAlias(raw: string): boolean {
  return (FRENCH_LEGACY_ALIASES as readonly string[]).includes(raw);
}

/**
 * The french technique tag, resolved deterministically from any legacy french
 * alias. Returns null when the taxonomy has no french technique tag.
 */
export function resolveFrenchTechnique(
  taxonomy: CommunityTaxonomyV2,
): ResolvedTagV2 | null {
  return resolveTagId(taxonomy, 'technique:french');
}
