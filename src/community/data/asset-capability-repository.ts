/**
 * COMM-ASSET-03B browser loader for the 03A capability/lineage authority.
 *
 * All four sources are strict parsed on each detail load. Failure returns a
 * typed unavailable result; no legacy application/verification inference or
 * partial capability fallback is permitted.
 */

import {
  buildCommunityLookAssetCapabilityIndexV1,
  type CommunityAssetCapabilityIssueV1,
  type CommunityLookAssetCapabilityIndexV1,
  type CommunityLookAssetCapabilityReadModelV1,
} from '../domain/asset-capability-v1';
import { parseMigrationManifestV1 } from '../domain/taxonomy-v2/migration-manifest';
import { parseCommunityTaxonomyV2 } from '../domain/taxonomy-v2/parse';
import { CANONICAL_USE_DEMO_READ_MODEL_V1 } from '@/integration/community-studio/canonical-use-demo';
import { FOUR_LOOK_SET_READ_MODELS_V0_7_2 } from '@/integration/community-studio/v0-7-2-four-look-sets';

export const COMMUNITY_ASSET_CAPABILITY_EVIDENCE_URL = '/community/asset-capability-evidence-v1.json' as const;

export type CommunityAssetCapabilityLoadResultV1 =
  | { ok: true; index: CommunityLookAssetCapabilityIndexV1 }
  | { ok: false; issues: CommunityAssetCapabilityIssueV1[] };

const VERSIONED_AUTHORITIES = [
  CANONICAL_USE_DEMO_READ_MODEL_V1,
  ...FOUR_LOOK_SET_READ_MODELS_V0_7_2,
] as const;

function unavailable(code: string, message: string): CommunityAssetCapabilityLoadResultV1 {
  return { ok: false, issues: [{ code, path: '$', message }] };
}

export async function loadCommunityAssetCapabilitiesV1(): Promise<CommunityAssetCapabilityLoadResultV1> {
  try {
    const [taxonomyResponse, migrationResponse, evidenceResponse] = await Promise.all([
      fetch('/community/taxonomy-v2.json'),
      fetch('/community/migration-manifest-v1.json'),
      fetch(COMMUNITY_ASSET_CAPABILITY_EVIDENCE_URL),
    ]);
    if (!taxonomyResponse.ok || !migrationResponse.ok || !evidenceResponse.ok) {
      return unavailable('fixture_fetch_failed', 'community asset capability fixture fetch failed');
    }
    const [taxonomyRaw, migrationRaw, evidenceRaw] = await Promise.all([
      taxonomyResponse.json(),
      migrationResponse.json(),
      evidenceResponse.json(),
    ]);
    const taxonomy = parseCommunityTaxonomyV2(taxonomyRaw);
    if (!taxonomy.ok) {
      return {
        ok: false,
        issues: taxonomy.issues.map((issue) => ({
          code: `taxonomy_${issue.code}`,
          path: issue.path,
          message: issue.message,
        })),
      };
    }
    const migration = parseMigrationManifestV1(migrationRaw, taxonomy.value);
    if (!migration.ok) {
      return {
        ok: false,
        issues: migration.issues.map((issue) => ({
          code: `migration_${issue.code}`,
          path: issue.path,
          message: issue.message,
        })),
      };
    }
    if (!Array.isArray(evidenceRaw)) {
      return unavailable('evidence_not_an_array', 'community asset capability evidence must be an array');
    }
    const built = buildCommunityLookAssetCapabilityIndexV1(
      evidenceRaw,
      migration.value,
      VERSIONED_AUTHORITIES,
    );
    return built.ok ? { ok: true, index: built.value } : built;
  } catch {
    return unavailable('fixture_unavailable', 'community asset capability fixture is unavailable');
  }
}

export async function getCommunityLookAssetCapabilityV1(
  lookId: string,
): Promise<CommunityLookAssetCapabilityReadModelV1 | null> {
  const loaded = await loadCommunityAssetCapabilitiesV1();
  if (!loaded.ok) return null;
  return loaded.index.entries.find((entry) => entry.contentId === lookId) ?? null;
}
