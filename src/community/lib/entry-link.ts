/**
 * 产品域 → Community 入口链接（仅安全查询参数；不写 Wizard/Editor Store）。
 *
 * COMM-V7.1-02: 内部导航继续保留 Studio 入口上下文 `entry` / `return_to` /
 * `shape` / `length`。后两者也可作为 Explore/Search 筛选状态，但不能因此
 * 丢失 Wizard 传入的甲型/长度建议。其余搜索状态只属于当前页 URL。
 */

import { legacyStudioPathTarget, Routes } from '@/app/routes';

const COMMUNITY_CONTEXT_KEYS = ['entry', 'return_to', 'shape', 'length'] as const;

export type CommunityEntry =
  | 'product_switcher'
  | 'dashboard'
  | 'wizard'
  | 'editor'
  | 'template_gallery'
  | 'design_list'
  | 'design_list_empty';

export function communityHref(opts: {
  path?: string;
  entry: CommunityEntry;
  returnTo?: string;
  shape?: string;
  length?: string;
}): string {
  const path = opts.path ?? Routes.community;
  const params = new URLSearchParams();
  params.set('entry', opts.entry);
  // URLSearchParams 会自行编码；勿预先 encodeURIComponent，避免双重编码。
  params.set('return_to', opts.returnTo ?? Routes.designs);
  if (opts.shape) params.set('shape', opts.shape);
  if (opts.length) params.set('length', opts.length);
  return `${path}?${params.toString()}`;
}

/** Preserve only product-entry context while navigating inside Community. */
export function communityInternalHref(path: string, current: URLSearchParams): string {
  const params = new URLSearchParams();
  for (const key of COMMUNITY_CONTEXT_KEYS) {
    const value = current.get(key);
    if (value) params.set(key, value);
  }
  const query = params.toString();
  return query ? `${path}?${query}` : path;
}

/** Resolve a local Studio return path without accepting external or Community targets. */
export function studioReturnPath(
  params: URLSearchParams,
  fallback: string = Routes.studio,
): string {
  const candidate = params.get('return_to');
  if (!candidate || candidate.startsWith('//')) return fallback;
  if (candidate === Routes.studio || candidate.startsWith(`${Routes.studio}/`)) return candidate;
  if (candidate === '/design' || candidate.startsWith('/design/')) return legacyStudioPathTarget(candidate);
  return fallback;
}
