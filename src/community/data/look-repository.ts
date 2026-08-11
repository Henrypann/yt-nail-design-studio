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

const runtimeMode = import.meta.env.MODE;

export async function loadLookReadModels(): Promise<PublishedLookReadModelV1[]> {
  const res = await fetch('/community/content-index.json');
  if (!res.ok) throw new Error('look index load failed');
  const index = (await res.json()) as CommunityContentIndexV1;
  return buildLookReadModels(index.contents, runtimeMode);
}

export async function getLookReadModelById(
  lookId: string,
): Promise<PublishedLookReadModelV1 | null> {
  const looks = await loadLookReadModels();
  return looks.find((look) => look.lookId === lookId) ?? null;
}
