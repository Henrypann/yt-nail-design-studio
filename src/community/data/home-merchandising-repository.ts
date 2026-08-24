import {
  parseCommunityHomeMerchandisingConfigV1,
  projectCommunityHomeMerchandisingV1,
  type CommunityHomeMerchandisingIssueV1,
  type CommunityHomeMerchandisingProjectionV1,
} from '../domain/home-merchandising-v1';
import { loadLookReadModels } from './look-repository';
import { loadCommunityAssetCapabilitiesV1 } from './asset-capability-repository';

export const COMMUNITY_HOME_MERCHANDISING_URL = '/community/home-merchandising-v1.json' as const;

export type CommunityHomeMerchandisingLoadResultV1 =
  | { ok: true; projection: CommunityHomeMerchandisingProjectionV1 }
  | { ok: false; issues: CommunityHomeMerchandisingIssueV1[] };

function failure(code: string, message: string): CommunityHomeMerchandisingLoadResultV1 {
  return { ok: false, issues: [{ code, path: '$', message }] };
}

export async function loadCommunityHomeMerchandisingV1(): Promise<CommunityHomeMerchandisingLoadResultV1> {
  try {
    const response = await fetch(COMMUNITY_HOME_MERCHANDISING_URL);
    if (!response.ok) return failure('fixture_fetch_failed', 'home merchandising fixture fetch failed');
    const parsed = parseCommunityHomeMerchandisingConfigV1(await response.json());
    if (!parsed.ok) return parsed;
    if (parsed.value.status !== 'PUBLISHED') {
      return {
        ok: true,
        projection: projectCommunityHomeMerchandisingV1({
          config: parsed.value,
          looks: [],
          capabilities: [],
        }),
      };
    }

    const [looks, capabilities] = await Promise.all([
      loadLookReadModels(),
      loadCommunityAssetCapabilitiesV1(),
    ]);
    if (!capabilities.ok) {
      return {
        ok: false,
        issues: capabilities.issues.map((issue) => ({
          code: `capability_${issue.code}`,
          path: issue.path,
          message: issue.message,
        })),
      };
    }
    const projection = projectCommunityHomeMerchandisingV1({
      config: parsed.value,
      looks,
      capabilities: capabilities.index.entries,
    });
    return projection.state === 'UNAVAILABLE'
      ? { ok: false, issues: projection.issues }
      : { ok: true, projection };
  } catch {
    return failure('fixture_unavailable', 'home merchandising fixture is unavailable');
  }
}
