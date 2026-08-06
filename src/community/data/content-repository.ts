/**
 * Community 静态数据仓储。
 */

import type {
  CommunityContentIndexV1,
  CommunityContentV1,
  CommunityPublisherV1,
  CommunityTaxonomyV1,
} from '../domain/types';
import {
  visibleCommunityContents,
  visibleCommunityPublishers,
} from '../domain/visibility';

const runtimeMode = import.meta.env.MODE;

export async function loadTaxonomy(): Promise<CommunityTaxonomyV1> {
  const res = await fetch('/community/taxonomy.json');
  if (!res.ok) throw new Error('taxonomy load failed');
  return res.json() as Promise<CommunityTaxonomyV1>;
}

export async function loadPublishers(): Promise<CommunityPublisherV1[]> {
  const res = await fetch('/community/publishers.json');
  if (!res.ok) throw new Error('publishers load failed');
  const all = (await res.json()) as CommunityPublisherV1[];
  return visibleCommunityPublishers(all, runtimeMode);
}

export async function loadContentIndex(): Promise<CommunityContentIndexV1> {
  const res = await fetch('/community/content-index.json');
  if (!res.ok) throw new Error('content-index load failed');
  const index = (await res.json()) as CommunityContentIndexV1;
  return {
    ...index,
    contents: visibleCommunityContents(index.contents, runtimeMode),
  };
}

export async function loadPublishedContents(): Promise<CommunityContentV1[]> {
  const index = await loadContentIndex();
  return index.contents.filter((c) => c.status === 'PUBLISHED');
}

export async function getContentById(contentId: string): Promise<CommunityContentV1 | null> {
  const contents = await loadPublishedContents();
  return contents.find((c) => c.contentId === contentId) ?? null;
}

export async function getPublisherById(publisherId: string): Promise<CommunityPublisherV1 | null> {
  const pubs = await loadPublishers();
  return pubs.find((p) => p.publisherId === publisherId) ?? null;
}

export function officialPgcProgress(index: CommunityContentIndexV1): {
  ready: number;
  target: number;
  gap: number;
} {
  return {
    ready: index.officialMetadataReadyCount,
    target: index.officialPgcTarget,
    gap: index.officialGapCount,
  };
}
