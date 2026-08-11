/**
 * `/community/board/share/:token` · 匿名只读分享页（COMM-V7.1-03）。
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
  const { text } = useLocale();
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
        if (!cancelled) setState({ kind: 'error', message: text('加载失败，请重试。', 'Failed to load. Retry.') });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, repository, retry, text]);

  if (state.kind === 'loading') {
    return (
      <div className="flex items-center gap-2 rounded-card border border-gray-200 bg-white p-6 text-sm text-gray-500">
        <Loader2 size={14} className="animate-spin" aria-hidden />
        {text('加载中…', 'Loading…')}
      </div>
    );
  }

  if (state.kind === 'error') {
    return (
      <div className="flex flex-col items-center gap-3 rounded-card border border-gray-200 bg-white px-4 py-12 text-center" data-testid="share-error">
        <ShieldAlert size={22} aria-hidden className="text-amber-500" />
        <p className="text-sm text-gray-600">{state.message}</p>
        <Button size="sm" variant="secondary" className="min-h-11" onClick={() => setRetry((k) => k + 1)}>
          {text('重试', 'Retry')}
        </Button>
      </div>
    );
  }

  if (state.kind === 'invalid' || state.kind === 'expired' || state.kind === 'revoked' || state.kind === 'private') {
    const config = {
      invalid: {
        icon: <Unlink size={22} aria-hidden className="text-gray-400" />,
        title: text('链接无效', 'Invalid link'),
        body: text('此分享链接不存在或已被移除。', 'This share link does not exist or was removed.'),
        testid: 'share-invalid',
      },
      expired: {
        icon: <TimerOff size={22} aria-hidden className="text-amber-500" />,
        title: text('链接已过期', 'Link expired'),
        body: text('此分享链接已超过有效期，请联系 Board 所有者重新分享。', 'This share link has expired. Ask the board owner to share again.'),
        testid: 'share-expired',
      },
      revoked: {
        icon: <Lock size={22} aria-hidden className="text-gray-500" />,
        title: text('链接已撤销', 'Link revoked'),
        body: text('Board 所有者已撤销此分享链接。', 'The board owner revoked this share link.'),
        testid: 'share-revoked',
      },
      private: {
        icon: <Lock size={22} aria-hidden className="text-gray-500" />,
        title: text('Board 已设为仅自己可见', 'Board is now private'),
        body: text('此 Board 已切换为 PRIVATE，分享链接不再可用。', 'This board switched to PRIVATE; the share link no longer works.'),
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
          {text('返回 Discover', 'Back to Discover')}
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
          {text(
            '只读分享视图：匿名访问者不可编辑此 Board。',
            'Read-only shared view: anonymous visitors cannot edit this board.',
          )}
        </p>
        <p className="mt-1 text-[11px] text-gray-400">
          {board.items.length} {text('款', 'items')}
          {board.visibility === 'PUBLIC' &&
            ` · ${text('公开 Board（链接可读）', 'Public board (readable by link)')}`}
        </p>
      </header>

      {board.items.length === 0 ? (
        <div className="rounded-card border border-dashed border-gray-200 bg-white px-4 py-10 text-center" data-testid="share-items-empty">
          <FolderHeart size={22} className="mx-auto text-gray-300" aria-hidden />
          <p className="mt-2 text-sm text-gray-600">{text('此 Board 还没有款式。', 'This board has no looks yet.')}</p>
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
                  <p className="mt-0.5 flex flex-wrap gap-1 text-[10px] text-gray-500">
                    {item.sourceKind === 'LEGACY_UNVERSIONED' && (
                      <span className="rounded-full bg-amber-50 px-1.5 py-0.5 text-amber-700" data-testid="share-item-legacy">
                        {text('未版本化灵感参考', 'Unversioned inspiration')}
                      </span>
                    )}
                    {viewState.state === 'look_unavailable' && (
                      <span className="rounded-full bg-red-50 px-1.5 py-0.5 text-red-600">
                        {text('款式已删除或不可用', 'Look deleted or unavailable')}
                      </span>
                    )}
                    {viewState.state === 'version_unavailable' && (
                      <span className="rounded-full bg-amber-50 px-1.5 py-0.5 text-amber-700">
                        {text('设计版本不可用', 'Design version unavailable')}
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
