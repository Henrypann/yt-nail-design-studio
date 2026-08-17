/**
 * Community 静态 Look 仓储（COMM-V7.1-01 + COMM-v0.7.2-TAX-02）。
 *
 * 从当前 legacy 静态内容索引（/community/content-index.json）派生 canonical
 * PublishedLookReadModelV1，复用 demo 可见性过滤（visibleCommunityContents）。
 * 不新增后端 / 网络 API；与 content-repository 读取同一静态数据源。
 *
 * COMM-v0.7.2-TAX-02：taxonomy-v2 + migration-manifest-v1 + content-index
 * 三个 fixture 每次加载只严格解析一次（buildCommunityDiscoveryIndexV1）。
 * - 全局 fixture 失效 → 类型化 UNAVAILABLE 诊断，整体 fail closed（不返回
 *   部分合成元数据）。
 * - 单条记录 coverage 阻塞 → RECORD_BLOCKED 诊断并从公开浏览排除。
 * - rights-PENDING（PUBLIC_BLOCKED）记录 → 从公开浏览排除（治理闸门，非错误）。
 * - discovery/curation 一律来自 checked-in manifest，绝不由
 *   PublishedLookV1.tags / sourceContent / applicationLevel / verificationLevel
 *   推断；`sourceContent` 仅保留给既有 Studio intent 兼容。
 *
 * 注意：本模块是浏览器层（使用 Vite `import.meta.env.MODE`），纯适配逻辑在
 * src/community/domain/v7_1/published-look-adapter.ts 与
 * src/community/domain/taxonomy-v2/load.ts，可在 Node 中直接测试。
 */

import type { CommunityContentIndexV1 } from '../domain/types';
import { buildLookReadModels } from '../domain/v7_1/published-look-adapter';
import {
  withDiscoveryProjectionsV1,
  type PublishedLookReadModelV1,
} from '../domain/v7_1/published-look-read-model';
import {
  buildCommunityDiscoveryIndexV1,
  type CommunityDiscoveryIndexV1,
  type DiscoveryIndexBlockedEntryV1,
  type DiscoveryIndexIssueV1,
} from '../domain/taxonomy-v2/load';
import { CANONICAL_USE_DEMO_READ_MODEL_V1 } from '@/integration/community-studio/canonical-use-demo';
import { FOUR_LOOK_SET_READ_MODELS_V0_7_2 } from '@/integration/community-studio/v0-7-2-four-look-sets';
import {
  loadCreatorPublishedLookReadModelsV1,
  type CreatorLookLoadDiagnosticV1,
} from '@/integration/community-studio/backend-runtime';

const runtimeMode = import.meta.env?.MODE ?? 'integration';

export type { CreatorLookLoadDiagnosticV1 };

/**
 * Aggregation identity guard (COMM-v0.7.2-TAX-02): the first occurrence of
 * each lookId wins, in candidate priority order — canonical demo (only in
 * development/integration), four-look set, creator, legacy. Every later
 * occurrence is dropped and reported exactly once.
 */
type LookCandidateSource = 'canonical' | 'four-look' | 'creator' | 'legacy';

/**
 * Typed diagnostics surfaced through `loadLookReadModels`. All failure paths
 * are typed and non-sensitive (no paths, URLs or raw errors).
 */
export type CommunityLookLoadDiagnosticV1 =
  | { scope: 'discovery-index'; code: 'UNAVAILABLE'; issues: DiscoveryIndexIssueV1[] }
  | { scope: 'discovery-index'; code: 'RECORD_BLOCKED'; contentId: string; blockedCode: DiscoveryIndexBlockedEntryV1['code'] }
  | { scope: 'look-aggregation'; code: 'IDENTITY_COLLISION'; lookId: string; keptSource: LookCandidateSource; droppedSource: LookCandidateSource }
  | CreatorLookLoadDiagnosticV1;

function defaultCreatorDiagnostic(diagnostic: CommunityLookLoadDiagnosticV1): void {
  console.warn('[community.looks]', diagnostic.scope, diagnostic.code, 'lookId' in diagnostic ? diagnostic.lookId : '');
}

type DiscoveryFixtures =
  | { ok: true; index: CommunityDiscoveryIndexV1; blocked: DiscoveryIndexBlockedEntryV1[]; rawIndex: CommunityContentIndexV1 }
  | { ok: false; issues: DiscoveryIndexIssueV1[] };

/** Fetch + strict-parse the three discovery fixtures exactly once per load. */
async function loadDiscoveryFixtures(): Promise<DiscoveryFixtures> {
  const [taxonomyRes, manifestRes, indexRes] = await Promise.all([
    fetch('/community/taxonomy-v2.json'),
    fetch('/community/migration-manifest-v1.json'),
    fetch('/community/content-index.json'),
  ]);
  if (!taxonomyRes.ok || !manifestRes.ok || !indexRes.ok) {
    return {
      ok: false,
      issues: [{ code: 'fixture_fetch_failed', scope: 'content-index', path: '', message: 'community discovery fixture fetch failed' }],
    };
  }
  const [taxonomyRaw, manifestRaw, indexRaw] = await Promise.all([
    taxonomyRes.json(),
    manifestRes.json(),
    indexRes.json(),
  ]);
  const result = buildCommunityDiscoveryIndexV1({ taxonomyRaw, manifestRaw, contentIndexRaw: indexRaw });
  if (!result.ok) return { ok: false, issues: result.issues };
  // buildCommunityDiscoveryIndexV1 already strict-validated the structural
  // record shape (contentId/mainStyleId/subStyleIds/status/demo); the legacy
  // adapter re-validates every record strictly per record below.
  const rawIndex = indexRaw as CommunityContentIndexV1;
  return { ok: true, index: result.index, blocked: result.blocked, rawIndex };
}

interface LookCandidateV1 {
  source: LookCandidateSource;
  look: PublishedLookReadModelV1;
}

/**
 * COMM-v0.7.2-TAX-02 cross-source lookId collision guard. Candidates arrive
 * in priority order (canonical demo → four-look set → creator → legacy); the
 * first occurrence of each lookId is kept and every later occurrence is
 * dropped with exactly one typed IDENTITY_COLLISION diagnostic. Aggregation
 * identity guard only: the kept model is never reordered, overwritten or
 * re-projected, and discovery/governance/sourceContent stay untouched.
 */
function aggregateLookCandidates(
  candidates: readonly LookCandidateV1[],
  emitDiagnostic: (diagnostic: CommunityLookLoadDiagnosticV1) => void,
): PublishedLookReadModelV1[] {
  const keptSourceByLookId = new Map<string, LookCandidateSource>();
  const output: PublishedLookReadModelV1[] = [];
  for (const candidate of candidates) {
    const keptSource = keptSourceByLookId.get(candidate.look.lookId);
    if (keptSource !== undefined) {
      emitDiagnostic({
        scope: 'look-aggregation',
        code: 'IDENTITY_COLLISION',
        lookId: candidate.look.lookId,
        keptSource,
        droppedSource: candidate.source,
      });
      continue;
    }
    keptSourceByLookId.set(candidate.look.lookId, candidate.source);
    output.push(candidate.look);
  }
  return output;
}

export async function loadLookReadModels(input?: {
  loadCreator?: () => Promise<PublishedLookReadModelV1[]>;
  onDiagnostic?: (diagnostic: CommunityLookLoadDiagnosticV1) => void;
}): Promise<PublishedLookReadModelV1[]> {
  const emitDiagnostic = input?.onDiagnostic ?? defaultCreatorDiagnostic;
  const fixtures = await loadDiscoveryFixtures();
  if (!fixtures.ok) {
    // Global fixture failure fails closed: no partial synthesized metadata.
    emitDiagnostic({ scope: 'discovery-index', code: 'UNAVAILABLE', issues: fixtures.issues });
    return [];
  }
  const { index, blocked, rawIndex } = fixtures;
  const blockedById = new Map(blocked.map((entry) => [entry.contentId, entry]));
  for (const entry of blocked) {
    emitDiagnostic({ scope: 'discovery-index', code: 'RECORD_BLOCKED', contentId: entry.contentId, blockedCode: entry.code });
  }

  // Legacy slice: every viewable legacy record gets the exact manifest
  // envelope; PUBLIC_BLOCKED (rights PENDING / non-public) records are
  // excluded from public browse; coverage-blocked records are excluded too.
  const legacy: PublishedLookReadModelV1[] = [];
  for (const model of buildLookReadModels(rawIndex.contents, runtimeMode)) {
    const entry = index.byContentId.get(model.contentId);
    if (!entry || blockedById.has(model.contentId) || entry.publicStatus === 'PUBLIC_BLOCKED') continue;
    legacy.push(withDiscoveryProjectionsV1(model, {
      subjectRef: entry.subjectRef,
      discovery: entry.discovery,
      curation: entry.curation,
    }));
  }

  let creator: PublishedLookReadModelV1[] = [];
  try {
    creator = input?.loadCreator
      ? await input.loadCreator()
      : await loadCreatorPublishedLookReadModelsV1({ onDiagnostic: emitDiagnostic });
  } catch {
    emitDiagnostic({ scope: 'creator-look-slice', code: 'UNAVAILABLE' });
  }
  // Cross-source aggregation in priority order: canonical demo (only in
  // development/integration) → four-look set → creator → legacy. First
  // occurrence of each lookId wins; duplicates are dropped with a typed
  // IDENTITY_COLLISION diagnostic (aggregation identity guard only).
  const candidates: LookCandidateV1[] = [];
  if (runtimeMode === 'development' || runtimeMode === 'integration') {
    candidates.push({ source: 'canonical', look: CANONICAL_USE_DEMO_READ_MODEL_V1 });
  }
  for (const look of FOUR_LOOK_SET_READ_MODELS_V0_7_2) candidates.push({ source: 'four-look', look });
  for (const look of creator) candidates.push({ source: 'creator', look });
  for (const look of legacy) candidates.push({ source: 'legacy', look });
  return aggregateLookCandidates(candidates, emitDiagnostic);
}

export async function getLookReadModelById(
  lookId: string,
): Promise<PublishedLookReadModelV1 | null> {
  const looks = await loadLookReadModels();
  return looks.find((look) => look.lookId === lookId) ?? null;
}
