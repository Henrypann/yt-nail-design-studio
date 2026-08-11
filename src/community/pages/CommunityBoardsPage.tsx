/**
 * `/boards` · Nail Board 列表 / 创建（COMM-V7.1-03）。
 *
 * - 新 Board 默认 PRIVATE（显式披露）。
 * - 列表展示标题、可见性、款式数量与更新时间。
 * - loading / empty / error+retry 状态齐全；损坏的本地存储 fail-closed，
 *   显示说明而不写入。
 * - 本仓库无真实后端：当前身份是披露的 local-demo identity（仅本浏览器）。
 */

import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { FolderHeart, Loader2, Plus } from 'lucide-react';
import { Button, Input, cx } from '@/design-system';
import { Routes } from '@/app/routes';
import { useLocale } from '@/lib/i18n';
import type { NailBoardV1, NailBoardVisibilityV1 } from '../domain/v7_1/nail-board';
import { LOCAL_DEMO_IDENTITY_ID, createBrowserBoardRepository } from '../data/board-repository';

type LoadState = 'loading' | 'ready' | 'error';

const VISIBILITY_LABEL: Record<NailBoardVisibilityV1, { zh: string; en: string; tone: string }> = {
  PRIVATE: { zh: '仅自己可见', en: 'Private', tone: 'bg-gray-100 text-gray-600' },
  UNLISTED: { zh: '不公开', en: 'Unlisted', tone: 'bg-amber-50 text-amber-700' },
  PUBLIC: { zh: '公开', en: 'Public', tone: 'bg-emerald-50 text-emerald-700' },
};

export default function CommunityBoardsPage() {
  const { text } = useLocale();
  const repository = useMemo(() => createBrowserBoardRepository(), []);
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [boards, setBoards] = useState<NailBoardV1[]>([]);
  const [storageCorrupted, setStorageCorrupted] = useState(false);
  const [retry, setRetry] = useState(0);
  const [title, setTitle] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoadState('loading');
    try {
      const { boards: loaded, corrupted } = repository.listBoards();
      if (cancelled) return;
      setBoards(loaded);
      setStorageCorrupted(corrupted);
      setLoadState('ready');
    } catch {
      if (!cancelled) setLoadState('error');
    }
    return () => {
      cancelled = true;
    };
  }, [repository, retry]);

  const createBoard = () => {
    const trimmed = title.trim();
    if (!trimmed) return;
    setCreating(true);
    setCreateError(null);
    try {
      const result = repository.createBoard(trimmed);
      if (!result.ok) {
        setCreateError(result.message);
        return;
      }
      setBoards((current) => [result.value.board, ...current]);
      setTitle('');
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : text('创建失败，请重试。', 'Create failed. Retry.'));
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="flex flex-col gap-4" data-testid="community-boards-page" data-debug-id="community.boards">
      <header>
        <h1 className="text-lg font-semibold text-gray-900">{text('我的 Nail Board', 'My Nail Boards')}</h1>
        <p className="mt-0.5 text-xs text-gray-500">
          {text(
            '款式参考集（只保存引用，不复制设计内容）。新 Board 默认仅自己可见。',
            'Reference collections (references only, never a content copy). New boards are PRIVATE by default.',
          )}
        </p>
        <p className="mt-1 text-[11px] text-gray-400" data-testid="boards-local-demo-disclosure">
          {text(
            `本地 Demo 身份：${LOCAL_DEMO_IDENTITY_ID}（无真实后端，数据仅存于本浏览器）`,
            `Local demo identity: ${LOCAL_DEMO_IDENTITY_ID} (no real backend; data lives in this browser only)`,
          )}
        </p>
      </header>

      {loadState === 'loading' && (
        <div className="flex items-center gap-2 rounded-card border border-gray-200 bg-white p-6 text-sm text-gray-500">
          <Loader2 size={14} className="animate-spin" aria-hidden />
          {text('加载中…', 'Loading…')}
        </div>
      )}

      {loadState === 'error' && (
        <div className="flex flex-col items-start gap-3 rounded-card border border-gray-200 bg-white p-6">
          <p className="text-sm text-gray-600">{text('Board 列表加载失败。', 'Failed to load boards.')}</p>
          <Button size="sm" variant="secondary" className="min-h-11" onClick={() => setRetry((k) => k + 1)}>
            {text('重试', 'Retry')}
          </Button>
        </div>
      )}

      {loadState === 'ready' && (
        <>
          <form
            className="flex flex-col gap-2 rounded-card border border-gray-200 bg-white p-4 sm:flex-row sm:items-end"
            onSubmit={(event) => {
              event.preventDefault();
              createBoard();
            }}
            data-testid="boards-create-form"
          >
            <div className="flex-1">
              <Input
                className="min-h-11"
                label={text('新建 Board', 'New board')}
                placeholder={text('输入名称，例如：婚礼灵感', 'Name, e.g. Wedding inspiration')}
                value={title}
                maxLength={80}
                onChange={(event) => setTitle(event.target.value)}
                data-testid="boards-create-title"
              />
              <p className="mt-1 text-[11px] text-gray-400" data-testid="boards-default-private-disclosure">
                {text('新 Board 默认「仅自己可见」（PRIVATE），之后可切换可见性。', 'New boards default to PRIVATE; visibility can be changed later.')}
              </p>
            </div>
            <Button
              type="submit"
              variant="primary"
              className="min-h-11"
              disabled={creating || title.trim().length === 0}
              data-testid="boards-create-submit"
            >
              {creating ? <Loader2 size={14} className="animate-spin" aria-hidden /> : <Plus size={14} aria-hidden />}
              {text('创建', 'Create')}
            </Button>
          </form>

          {createError && (
            <p className="rounded-button border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700" role="status">
              {createError}
            </p>
          )}

          {storageCorrupted && (
            <div className="rounded-button border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800" data-testid="boards-storage-corrupted">
              {text(
                '本地存储已损坏：为避免覆盖，写入已停止。请手动清除浏览器本地数据后重试。',
                'Local storage is corrupted: writes are disabled to avoid overwriting it. Clear browser local data and retry.',
              )}
            </div>
          )}

          {boards.length === 0 ? (
            <div className="rounded-card border border-dashed border-gray-200 bg-white px-4 py-10 text-center" data-testid="boards-empty">
              <FolderHeart size={22} className="mx-auto text-gray-300" aria-hidden />
              <p className="mt-2 text-sm font-medium text-gray-800">{text('还没有 Nail Board', 'No Nail Boards yet')}</p>
              <p className="mt-1 text-xs text-gray-500">
                {text('在 Discover / Search 中点击「保存」即可收藏款式。', 'Tap Save on any look in Discover / Search to collect it here.')}
              </p>
            </div>
          ) : (
            <ul className="flex flex-col gap-2" data-testid="boards-list">
              {boards.map((board) => {
                const label = VISIBILITY_LABEL[board.visibility];
                return (
                  <li key={board.boardId}>
                    <Link
                      to={Routes.communityBoardDetail(board.boardId)}
                      className="flex min-h-11 items-center gap-3 rounded-card border border-gray-200 bg-white px-4 py-3 transition hover:border-primary/40 hover:shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                    >
                      <FolderHeart size={16} aria-hidden className="shrink-0 text-primary" />
                      <span className="min-w-0 flex-1 truncate text-sm font-medium text-gray-900">{board.title}</span>
                      <span className={cx('shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium', label.tone)}>
                        {text(label.zh, label.en)}
                      </span>
                      <span className="shrink-0 text-[11px] text-gray-400">
                        {board.items.length} {text('款', 'items')}
                      </span>
                      <span className="hidden shrink-0 text-[11px] text-gray-400 sm:inline">{board.updatedAt.slice(0, 10)}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
