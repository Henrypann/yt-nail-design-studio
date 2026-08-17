/**
 * CommunityLookCard · Explore/Search Look 卡片（COMM-V7.1-02，COMM-V7.1-03 启用 Save，
 * COMM-v0.7.2-TAX-04 改用 V2 发现呈现与权利门禁）。
 *
 * 语义约束：
 * - 卡片根节点是 `<article>`，内部有独立链接与按钮（不是「按钮套按钮」）。
 * - 标题/封面是 canonical 详情链接（Routes.communityLook），只保留产品上下文
 *   entry/return_to，不携带搜索/筛选状态。
 * - 标签 pill 只来自 strict taxonomy-v2 发现元数据（DiscoveryCardTags，max 6，
 *   当前 browse 维度优先）；不再读取 legacy 标签字段，不再使用 legacy 词表。
 * - Rights 徽章独立于标签 pill（RightsBadge，data-rights-status + 可访问文本）。
 * - Use/remix 动作 fail closed：`actionPermissions(look.discovery)`。
 *   PERSONAL_USE_ONLY 不渲染内容相关 Use/remix 动作，改为可见的非动作提示
 *   `personal-use-only-action-restricted`；discovery 为 null 时不提供 remix 动作。
 *   资产可用性（resolveStudioUseAvailabilityV1）语义保持不变。
 * - Use 是 canonical 详情链接：真实试用必须经过 Look 详情的 Studio 意图校验，
 *   卡片绝不直接写 Wizard/Editor store。
 * - Save 由父级（CommunityFeed）注入 `onSave`：卡片只上报保存意图，持久化由
 *   Feed 的 NailBoardSaveDialog 完成，卡片本身不做任何本地持久化、不伪造成功。
 *   未注入 `onSave` 时按钮保持禁用。
 * - Made 需要已验证的 RealResult / Fulfillment 制造记录；当前静态 fixture 无
 *   任何此类证据，卡片显示不可用（—），绝不推断或伪造计数。
 * - 不加载 Three.js。
 */

import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Bookmark, Hammer } from 'lucide-react';
import { Routes } from '@/app/routes';
import { useLocale } from '@/lib/i18n';
import { communityInternalHref } from '../lib/entry-link';
import type { PublishedLookReadModelV1 } from '../domain/v7_1/published-look-read-model';
import type { CommunityPublisherV1 } from '../domain/types';
import type { CommunityTaxonomyV2 } from '../domain/taxonomy-v2/types';
import type { DiscoveryBrowseV2 } from '../domain/taxonomy-v2/presentation';
import { actionPermissions } from '../domain/taxonomy-v2/governance';
import { resolveStudioUseAvailabilityV1 } from '../domain/studio-use-availability';
import { PublisherBadge } from './PublisherBadge';
import { ApplicationBadge, VerificationBadge } from './CapabilityBadge';
import { DiscoveryCardTags, RightsBadge } from './CommunityDiscoveryMetadata';

interface Props {
  look: PublishedLookReadModelV1;
  publisher?: CommunityPublisherV1 | null;
  /** COMM-v0.7.2-TAX-04: strict taxonomy-v2 discovery vocabulary. */
  taxonomyV2: CommunityTaxonomyV2;
  /** COMM-v0.7.2-TAX-04: current browse dimension (recommended has no priority). */
  browse: DiscoveryBrowseV2;
  /** COMM-V7.1-03: 由 Feed 注入，打开 Save-to-Board 对话框。 */
  onSave?: (look: PublishedLookReadModelV1) => void;
}

export function CommunityLookCard({
  look,
  publisher,
  taxonomyV2,
  browse,
  onSave,
}: Props) {
  const [searchParams] = useSearchParams();
  const { locale, text } = useLocale();
  const [coverFailed, setCoverFailed] = useState(false);
  const detailHref = communityInternalHref(
    Routes.communityLook(look.lookId),
    searchParams,
  );
  const discovery = look.discovery;
  // COMM-v0.7.2-TAX-04: rights gate fail closed. PERSONAL_USE_ONLY and missing
  // discovery metadata both deny the content-specific Use/remix action.
  const permissions = discovery ? actionPermissions(discovery) : null;
  const remixAllowed = permissions?.remix === true;
  const personalUseOnly = discovery?.rights.status === 'PERSONAL_USE_ONLY';
  const useAvailability = resolveStudioUseAvailabilityV1(look);
  const useUnavailableTitle = useAvailability.state === 'ASSETS_INCOMPLETE'
    ? text('Studio 素材尚未补齐，暂不可使用', 'Studio assets are incomplete; Use is unavailable')
    : useAvailability.state === 'INSPIRATION_ONLY'
      ? text('该 Look 仅供灵感参考', 'This Look is inspiration only')
      : text('该版本依赖暂不可用', 'This version dependency is unavailable');

  return (
    <article
      data-testid="community-look-card"
      data-look-id={look.lookId}
      className="flex flex-col overflow-hidden rounded-card border border-gray-200 bg-white transition hover:border-primary/40 hover:shadow-sm"
    >
      <Link
        to={detailHref}
        className="block"
        aria-label={look.title}
        tabIndex={-1}
      >
        <div className="aspect-[16/10] bg-gray-100">
          {coverFailed ? (
            <div
              className="flex h-full w-full items-center justify-center text-nano text-gray-400"
              data-testid="community-card-cover-fallback"
            >
              封面暂不可用
            </div>
          ) : (
            <img
              src={look.cover.url}
              alt=""
              className="h-full w-full object-cover"
              loading="lazy"
              onError={() => setCoverFailed(true)}
            />
          )}
        </div>
      </Link>

      <div className="flex flex-1 flex-col gap-1.5 p-3">
        <div className="flex flex-wrap gap-1">
          <PublisherBadge publisher={publisher} />
          {discovery && (
            <DiscoveryCardTags
              taxonomy={taxonomyV2}
              discovery={discovery}
              browse={browse}
              locale={locale}
            />
          )}
        </div>
        <h3 className="text-sm font-medium text-gray-900">
          <Link
            to={detailHref}
            className="line-clamp-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            {look.title}
          </Link>
        </h3>
        <div className="mt-auto flex flex-wrap gap-1 pt-1">
          <ApplicationBadge level={look.applicationLevel} />
          <VerificationBadge level={look.verificationLevel} />
        </div>

        {/* 可见动作：Save / Use（权利允许且资产依赖完整时可用）/ Made（无 RealResult 时不可用） */}
        <div
          role="group"
          aria-label={text('Look 操作', 'Look actions')}
          className="mt-1 flex flex-wrap items-center gap-1.5 border-t border-gray-100 pt-2"
        >
          {discovery && (
            <RightsBadge
              taxonomy={taxonomyV2}
              discovery={discovery}
              locale={locale}
            />
          )}
          <button
            type="button"
            disabled={!onSave}
            aria-disabled={!onSave}
            data-testid="look-card-save"
            title={text(
              onSave
                ? '保存到 Nail Board（引用款式，不复制设计内容）'
                : '保存到 Nail Board 需要注入 onSave（当前不可用）',
              onSave
                ? 'Save to Nail Boards (reference only, never a content copy)'
                : 'Save to Nail Boards needs an injected onSave (currently unavailable)',
            )}
            onClick={() => onSave?.(look)}
            className="inline-flex h-11 items-center gap-1 rounded-button border border-gray-200 bg-white px-2.5 text-xs font-medium text-gray-700 hover:border-primary/40 hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:border-gray-200 disabled:bg-gray-50 disabled:text-gray-400"
          >
            <Bookmark size={13} aria-hidden />
            {text('保存', 'Save')}
          </button>
          {remixAllowed ? (
            useAvailability.enabled ? (
              <Link
                to={detailHref}
                data-testid="look-card-use"
                data-use-state={useAvailability.state}
                className="inline-flex h-11 items-center rounded-button border border-primary/30 bg-primary-soft px-2.5 text-xs font-medium text-primary hover:bg-primary/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                {text('使用', 'Use')}
              </Link>
            ) : (
              <button
                type="button"
                disabled
                aria-disabled="true"
                title={useUnavailableTitle}
                data-testid="look-card-use-disabled"
                data-use-state={useAvailability.state}
                className="inline-flex h-11 cursor-not-allowed items-center rounded-button border border-gray-200 bg-gray-100 px-2.5 text-xs font-medium text-gray-400"
              >
                {text('使用', 'Use')}
              </button>
            )
          ) : personalUseOnly ? (
            <span
              data-testid="personal-use-only-action-restricted"
              className="inline-flex h-11 items-center rounded-button border border-amber-300 bg-amber-50 px-2.5 text-xs font-medium text-amber-700"
            >
              {text('仅限个人使用 · 不提供使用/二次创作', 'Personal use only · no Use/remix action')}
            </span>
          ) : null}
          <span
            data-testid="look-card-made"
            title={text(
              'Made 需要已验证的 RealResult / 履约记录，当前无证据（不可用）',
              'Made requires a verified RealResult / fulfillment record — no evidence available',
            )}
            className="inline-flex h-11 items-center gap-1 rounded-button border border-dashed border-gray-200 px-2.5 text-xs font-medium text-gray-400"
          >
            <Hammer size={13} aria-hidden />
            {text('已制作', 'Made')} —
          </span>
        </div>
        <p className="sr-only">
          {text(
            '保存将款式作为引用加入 Nail Board（legacy 款式为未版本化灵感参考）。Made 不可用：当前内容没有已验证的 RealResult / 履约记录。',
            'Save adds the look as a reference to a Nail Board (legacy looks are unversioned inspiration references). Made is unavailable: this content has no verified RealResult / fulfillment record.',
          )}
        </p>
      </div>
    </article>
  );
}
