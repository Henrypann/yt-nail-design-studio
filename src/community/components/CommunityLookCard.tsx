/**
 * CommunityLookCard · Explore/Search Look 卡片（COMM-V7.1-02，COMM-V7.1-03 启用 Save）。
 *
 * 语义约束：
 * - 卡片根节点是 `<article>`，内部有独立链接与按钮（不是「按钮套按钮」）。
 * - 标题/封面是 canonical 详情链接（Routes.communityLook），只保留产品上下文
 *   entry/return_to，不携带搜索/筛选状态。
 * - Use 同样是 canonical 详情链接：真实试用必须经过 Look 详情的 Studio 意图
 *   校验，卡片绝不直接写 Wizard/Editor store。
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
import { communityTaxonomyLabel } from '@/studio/shared/nail-taxonomy-labels';
import { communityInternalHref } from '../lib/entry-link';
import type { PublishedLookReadModelV1 } from '../domain/v7_1/published-look-read-model';
import type { CommunityPublisherV1, CommunityTaxonomyV1 } from '../domain/types';
import { resolveStudioUseAvailabilityV1 } from '../domain/studio-use-availability';
import { PublisherBadge } from './PublisherBadge';
import { ApplicationBadge, VerificationBadge } from './CapabilityBadge';

interface Props {
  look: PublishedLookReadModelV1;
  publisher?: CommunityPublisherV1 | null;
  taxonomy: CommunityTaxonomyV1;
  /** COMM-V7.1-03: 由 Feed 注入，打开 Save-to-Board 对话框。 */
  onSave?: (look: PublishedLookReadModelV1) => void;
}

export function CommunityLookCard({ look, publisher, taxonomy, onSave }: Props) {
  const [searchParams] = useSearchParams();
  const { locale, text } = useLocale();
  const [coverFailed, setCoverFailed] = useState(false);
  const detailHref = communityInternalHref(Routes.communityLook(look.lookId), searchParams);
  const style = taxonomy.mainStyles.find((s) => s.id === look.mainStyleId);
  const topicId = look.effectIds[0] ?? look.moodIds[0];
  const effect = taxonomy.effects.find((e) => e.id === topicId);
  const mood = taxonomy.moods.find((m) => m.id === topicId);
  const topic = effect
    ? communityTaxonomyLabel('community-effect', effect, locale)
    : mood
      ? communityTaxonomyLabel('community-mood', mood, locale)
      : undefined;
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
      <Link to={detailHref} className="block" aria-label={look.title} tabIndex={-1}>
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
          {style && (
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-nano text-gray-600">
              {communityTaxonomyLabel('community-style', style, locale)}
            </span>
          )}
          {topic && (
            <span className="rounded-full bg-gray-50 px-2 py-0.5 text-nano text-gray-500">
              {topic}
            </span>
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

        {/* 可见动作：Save / Use（仅资产依赖完整时可用）/ Made（无 RealResult 时不可用） */}
        <div
          role="group"
          aria-label={text('Look 操作', 'Look actions')}
          className="mt-1 flex flex-wrap items-center gap-1.5 border-t border-gray-100 pt-2"
        >
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
          {useAvailability.enabled ? (
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
          )}
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
