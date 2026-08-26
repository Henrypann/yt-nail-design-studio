/**
 * `/board/share/:token` · 匿名只读分享页（COMM-V7.1-03）。
 *
 * - URL 只携带不可猜测的 token，绝不携带 owner/customer 身份。
 * - 匿名解析（resolveAccessByToken）：UNLISTED 需有效未过期未撤销 token；
 *   PUBLIC 链接可读但匿名永远不可编辑。
 * - 明确的失败状态：token 无效 / 已过期 / 已撤销 / Board 已转 PRIVATE /
 *   本地存储损坏。
 * - 复用 Community 壳，但绝不暴露 owner 编辑动作（无重命名/可见性/分享/删除）。
 * - legacy 条目显示「未版本化灵感参考」说明；不可用条目显示真实视图状态。
 */

import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { FolderHeart, Loader2, Lock, ShieldAlert, TimerOff, Unlink } from 'lucide-react';
import { Button } from '@/design-system';
import { Routes } from '@/app/routes';
import { useLocale } from '@/lib/i18n';
import { loadLookReadModels } from '../data/look-repository';
import { createBrowserBoardRepository } from '../data/board-repository';
import { resolveItemViewState, type NailBoardV1 } from '../domain/v7_1/nail-board';
import type { PublishedLookReadModelV1 } from '../domain/v7_1/published-look-read-model';

type SharePageState =
  | { kind: 'loading' }
  | { kind: 'viewer'; board: NailBoardV1 }
  | { kind: 'invalid' }
  | { kind: 'expired' }
  | { kind: 'revoked' }
  | { kind: 'private' }
  | { kind: 'error'; message: string };

export default function CommunityBoardSharePage() {
  const { token } = useParams<{ token: string }>();
  const { t } = useLocale();
  const repository = useMemo(() => createBrowserBoardRepository(), []);
  const [state, setState] = useState<SharePageState>({ kind: 'loading' });
  const [looksById, setLooksById] = useState<Map<string, PublishedLookReadModelV1>>(new Map());
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    if (!token) {
      setState({ kind: 'invalid' });
      return;
    }
    let cancelled = false;
    setState({ kind: 'loading' });
    void (async () => {
      try {
        const [resolved, looks] = await Promise.all([
          repository.resolveAccessByToken(token),
          loadLookReadModels(),
        ]);
        if (cancelled) return;
        setLooksById(new Map(looks.map((look) => [look.lookId, look])));
        if (!resolved.ok) {
          if (resolved.code === 'token_invalid') setState({ kind: 'invalid' });
          else if (resolved.code === 'storage_corrupted') setState({ kind: 'error', message: resolved.message });
          else if (resolved.code === 'board_not_found') setState({ kind: 'invalid' });
          else setState({ kind: 'error', message: resolved.message });
          return;
        }
        const { board, access } = resolved.value;
        if (access.access === 'viewer') {
          setState({ kind: 'viewer', board });
        } else if (access.access === 'token_revoked') {
          setState({ kind: 'revoked' });
        } else if (access.access === 'token_expired') {
          setState({ kind: 'expired' });
        } else if (access.access === 'private_not_shareable') {
          setState({ kind: 'private' });
        } else {
          setState({ kind: 'invalid' });
        }
      } catch {
        if (!cancelled) setState({ kind: 'error', message: t('app.failedLoadRetry') });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, repository, retry, t]);

  if (state.kind === 'loading') {
    return (
      <div className="flex items-center gap-2 rounded-card border border-gray-200 bg-white p-6 text-sm text-gray-500">
        <Loader2 size={14} className="animate-spin" aria-hidden />
        {t('app.loading')}
      </div>
    );
  }

  if (state.kind === 'error') {
    return (
      <div className="flex flex-col items-center gap-3 rounded-card border border-gray-200 bg-white px-4 py-12 text-center" data-testid="share-error">
        <ShieldAlert size={22} aria-hidden className="text-amber-500" />
        <p className="text-sm text-gray-600">{state.message}</p>
        <Button size="sm" variant="secondary" className="min-h-11" onClick={() => setRetry((k) => k + 1)}>
          {t('app.retry')}
        </Button>
      </div>
    );
  }

  if (state.kind === 'invalid' || state.kind === 'expired' || state.kind === 'revoked' || state.kind === 'private') {
    const config = {
      invalid: {
        icon: <Unlink size={22} aria-hidden className="text-gray-400" />,
        title: t('app.invalidLink'),
        body: t('app.shareLinkDoesNotExistWasRemoved'),
        testid: 'share-invalid',
      },
      expired: {
        icon: <TimerOff size={22} aria-hidden className="text-amber-500" />,
        title: t('app.linkExpired'),
        body: t('app.shareLinkHasExpiredAskBoardOwnerShareAgain'),
        testid: 'share-expired',
      },
      revoked: {
        icon: <Lock size={22} aria-hidden className="text-gray-500" />,
        title: t('app.linkRevoked'),
        body: t('app.boardOwnerRevokedShareLink'),
        testid: 'share-revoked',
      },
      private: {
        icon: <Lock size={22} aria-hidden className="text-gray-500" />,
        title: t('app.boardNowPrivate'),
        body: t('app.boardSwitchedPrivateShareLinkNoLongerWorks'),
        testid: 'share-private',
      },
    } as const;
    const item = config[state.kind];
    return (
      <div className="flex flex-col items-center gap-3 rounded-card border border-gray-200 bg-white px-4 py-12 text-center" data-testid={item.testid}>
        {item.icon}
        <h1 className="text-base font-semibold text-gray-900">{item.title}</h1>
        <p className="max-w-sm text-xs text-gray-500">{item.body}</p>
        <Link
          to={Routes.community}
          className="inline-flex h-11 items-center rounded-button border border-primary/30 bg-primary-soft px-3 text-xs font-medium text-primary hover:bg-primary/15"
        >
          {t('app.backDiscover')}
        </Link>
      </div>
    );
  }

  const { board } = state;
  return (
    <div className="flex flex-col gap-4" data-testid="community-board-share-page" data-debug-id="community.board.share">
      <header>
        <h1 className="text-lg font-semibold text-gray-900" data-testid="share-board-title">
          {board.title}
        </h1>
        <p className="mt-0.5 text-xs text-gray-500" data-testid="share-readonly-disclosure">
          {t('app.readOnlySharedViewAnonymousVisitorsCannotEditBoard')}
        </p>
        <p className="mt-1 text-nano text-gray-400">
          {board.items.length} {t('app.items')}
          {board.visibility === 'PUBLIC' &&
            ` · ${t('app.publicBoardReadableByLink')}`}
        </p>
      </header>

      {board.items.length === 0 ? (
        <div className="rounded-card border border-dashed border-gray-200 bg-white px-4 py-10 text-center" data-testid="share-items-empty">
          <FolderHeart size={22} className="mx-auto text-gray-300" aria-hidden />
          <p className="mt-2 text-sm text-gray-600">{t('app.boardHasNoLooksYet')}</p>
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2" data-testid="share-items-list">
          {board.items.map((item) => {
            const look = looksById.get(item.lookId) ?? null;
            const viewState = resolveItemViewState(item, look);
            return (
              <li key={item.itemId} className="flex items-center gap-2 rounded-card border border-gray-200 bg-white px-3 py-2" data-view-state={viewState.state}>
                <div className="h-12 w-12 shrink-0 overflow-hidden rounded-button border border-gray-100 bg-gray-50">
                  {look ? (
                    <img src={look.cover.url} alt="" className="h-full w-full object-cover" loading="lazy" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <Lock size={14} aria-hidden className="text-gray-300" />
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-gray-900">{look?.title ?? item.lookId}</p>
                  <p className="mt-0.5 flex flex-wrap gap-1 text-nano text-gray-500">
                    {item.sourceKind === 'LEGACY_UNVERSIONED' && (
                      <span className="rounded-full bg-amber-50 px-1.5 py-0.5 text-amber-700" data-testid="share-item-legacy">
                        {t('app.unversionedInspiration')}
                      </span>
                    )}
                    {viewState.state === 'look_unavailable' && (
                      <span className="rounded-full bg-red-50 px-1.5 py-0.5 text-red-600">
                        {t('app.lookDeletedUnavailable')}
                      </span>
                    )}
                    {viewState.state === 'version_unavailable' && (
                      <span className="rounded-full bg-amber-50 px-1.5 py-0.5 text-amber-700">
                        {t('app.designVersionUnavailable')}
                      </span>
                    )}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
