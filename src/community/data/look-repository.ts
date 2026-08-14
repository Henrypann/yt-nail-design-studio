/**
 * Community 静态 Look 仓储（COMM-V7.1-01）。
 *
 * 从当前 legacy 静态内容索引（/community/content-index.json）派生 canonical
 * PublishedLookReadModelV1，复用 demo 可见性过滤（visibleCommunityContents）。
 * 不新增后端 / 网络 API；与 content-repository 读取同一静态数据源。
 *
 * 注意：本模块是浏览器层（使用 Vite `import.meta.env.MODE`），纯适配逻辑在
 * src/community/domain/v7_1/published-look-adapter.ts，可在 Node 中直接测试。
 */

import type { CommunityContentIndexV1 } from '../domain/types';
import { buildLookReadModels } from '../domain/v7_1/published-look-adapter';
import type { PublishedLookReadModelV1 } from '../domain/v7_1/published-look-read-model';
import { CANONICAL_USE_DEMO_READ_MODEL_V1 } from '@/integration/community-studio/canonical-use-demo';
import { FOUR_LOOK_SET_READ_MODELS_V0_7_2 } from '@/integration/community-studio/v0-7-2-four-look-sets';
import { loadCreatorPublishedLookReadModelsV1 } from '@/integration/community-studio/backend-runtime';

const runtimeMode = import.meta.env?.MODE ?? 'integration';

export type CreatorLookLoadDiagnosticV1 = {
  scope: 'creator-look-slice';
  code: 'UNAVAILABLE';
};

function defaultCreatorDiagnostic(diagnostic: CreatorLookLoadDiagnosticV1): void {
  console.warn('[community.looks]', diagnostic.scope, diagnostic.code);
}

export async function loadLookReadModels(input?: {
  loadCreator?: () => Promise<PublishedLookReadModelV1[]>;
  onDiagnostic?: (diagnostic: CreatorLookLoadDiagnosticV1) => void;
}): Promise<PublishedLookReadModelV1[]> {
  const res = await fetch('/community/content-index.json');
  if (!res.ok) throw new Error('look index load failed');
  const index = (await res.json()) as CommunityContentIndexV1;
  const legacy = buildLookReadModels(index.contents, runtimeMode);
  let creator: PublishedLookReadModelV1[] = [];
  try { creator = await (input?.loadCreator ?? loadCreatorPublishedLookReadModelsV1)(); }
  catch { (input?.onDiagnostic ?? defaultCreatorDiagnostic)({ scope: 'creator-look-slice', code: 'UNAVAILABLE' }); }
  return runtimeMode === 'development' || runtimeMode === 'integration'
    ? [CANONICAL_USE_DEMO_READ_MODEL_V1, ...FOUR_LOOK_SET_READ_MODELS_V0_7_2, ...creator, ...legacy]
    : [...FOUR_LOOK_SET_READ_MODELS_V0_7_2, ...creator, ...legacy];
}

export async function getLookReadModelById(
  lookId: string,
): Promise<PublishedLookReadModelV1 | null> {
  const looks = await loadLookReadModels();
  return looks.find((look) => look.lookId === lookId) ?? null;
}
