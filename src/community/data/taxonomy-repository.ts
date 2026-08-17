/**
 * Community v0.7.2 · COMM-v0.7.2-TAX-02 strict taxonomy-v2 browser repository.
 *
 * Single focused repository for the shipped browse taxonomy fixture
 * (`public/community/taxonomy-v2.json`, served at `/community/taxonomy-v2.json`).
 * The fixture is parsed with the strict runtime parser
 * (parseCommunityTaxonomyV2) — never a raw JSON cast and never a fallback
 * vocabulary:
 *
 * - `ok: true` → the strict `CommunityTaxonomyV2` used by the creator
 *   publish wizard for structured discovery authoring (shared zh-CN/en label
 *   identity only; this repository never writes discovery facts).
 * - `ok: false` → typed issues; consumers surface a visible load error and
 *   disable structured authoring (fail closed, no partial vocabulary).
 *
 * Browser layer only (uses fetch). The strict parse itself is pure and lives
 * in src/community/domain/taxonomy-v2/parse.ts so it stays Node-testable.
 */
import { parseCommunityTaxonomyV2, type TaxonomyV2Issue } from '../domain/taxonomy-v2/parse';
import type { CommunityTaxonomyV2 } from '../domain/taxonomy-v2/types';

export const TAXONOMY_V2_URL = '/community/taxonomy-v2.json' as const;

export type TaxonomyRepositoryResultV2 =
  | { ok: true; taxonomy: CommunityTaxonomyV2 }
  | { ok: false; issues: TaxonomyV2Issue[] };

/**
 * Fetches and strict-parses the taxonomy-v2 fixture. Any fetch/network/parse
 * failure returns `ok: false` with bounded typed issues; consumers must keep
 * every structured authoring control disabled and surface the diagnostic.
 */
export async function loadCommunityTaxonomyV2(): Promise<TaxonomyRepositoryResultV2> {
  let response: Response;
  try {
    response = await fetch(TAXONOMY_V2_URL);
  } catch {
    return {
      ok: false,
      issues: [{ code: 'fetch_failed', path: TAXONOMY_V2_URL, message: 'taxonomy-v2 fixture fetch failed (network)' }],
    };
  }
  if (!response.ok) {
    return {
      ok: false,
      issues: [{ code: 'fetch_failed', path: TAXONOMY_V2_URL, message: `taxonomy-v2 fixture fetch failed (HTTP ${response.status})` }],
    };
  }
  let raw: unknown;
  try {
    raw = await response.json();
  } catch {
    return {
      ok: false,
      issues: [{ code: 'invalid_json', path: TAXONOMY_V2_URL, message: 'taxonomy-v2 fixture is not valid JSON' }],
    };
  }
  const parsed = parseCommunityTaxonomyV2(raw);
  if (!parsed.ok) return { ok: false, issues: parsed.issues };
  return { ok: true, taxonomy: parsed.value };
}
