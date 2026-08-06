/**
 * 产品域 → Community 入口链接（仅安全查询参数；不写 Wizard/Editor Store）。
 */

import { Routes } from '@/app/routes';

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
