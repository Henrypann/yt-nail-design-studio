/**
 * `/boards` · 图片优先的 Nail Board 灵感收藏首页（COMM-V7.1-03）。
 *
 * Board 仍只保存 Look 引用；本页按引用解析封面并生成拼图，不复制设计内容。
 * 新建入口收进轻量弹窗，Board 默认 PRIVATE，损坏存储继续 fail-closed。
 */

import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { FolderHeart, Globe2, Link2, Loader2, LockKeyhole, Plus, Sparkles } from 'lucide-react';
import { Button, Input, Modal, cx } from '@/design-system';
import { Routes } from '@/app/routes';
import {useLocale, type MessageKey} from '@/lib/i18n';
import type { NailBoardV1, NailBoardVisibilityV1 } from '../domain/v7_1/nail-board';
import type { PublishedLookReadModelV1 } from '../domain/v7_1/published-look-read-model';
import { LOCAL_DEMO_IDENTITY_ID, createBrowserBoardRepository } from '../data/board-repository';
import { loadLookReadModels } from '../data/look-repository';

type LoadState = 'loading' | 'ready' | 'error';

const VISIBILITY_LABEL: Record<NailBoardVisibilityV1, MessageKey> = {
  PRIVATE: 'community.visibility.private',
  UNLISTED: 'community.visibility.unlistedShort',
  PUBLIC: 'community.visibility.public',
};

function VisibilityIcon({ visibility }: { visibility: NailBoardVisibilityV1 }) {
  if (visibility === 'PUBLIC') return <Globe2 size={13} aria-hidden />;
  if (visibility === 'UNLISTED') return <Link2 size={13} aria-hidden />;
  return <LockKeyhole size={13} aria-hidden />;
}

function BoardCoverTile({ look }: { look: PublishedLookReadModelV1 | null }) {
  const [failed, setFailed] = useState(false);

  if (!look || failed) {
    return (
      <div className="flex h-full min-h-0 items-center justify-center bg-gradient-to-br from-[#f6e9ec] via-[#eee7f5] to-[#e2eef0]">
        <Sparkles size={18} className="text-white/90" aria-hidden />
      </div>
    );
  }

  return (
    <img
      src={look.cover.url}
      alt=""
      className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.025]"
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}

function BoardCoverMosaic({
  board,
  looksById,
  emptyLabel,
}: {
  board: NailBoardV1;
  looksById: ReadonlyMap<string, PublishedLookReadModelV1>;
  emptyLabel: string;
}) {
  const previews = board.items.slice(0, 4).map((item) => looksById.get(item.lookId) ?? null);

  if (previews.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center bg-gradient-to-br from-[#f8edef] via-[#f1ebf5] to-[#e8f0ef] text-[#8f7380]">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/75 shadow-sm">
          <FolderHeart size={22} aria-hidden />
        </span>
        <span className="mt-2 text-xs font-medium">{emptyLabel}</span>
      </div>
    );
  }

  const gridClass =
    previews.length === 1
      ? 'grid-cols-1'
      : previews.length === 2
        ? 'grid-cols-2'
        : previews.length === 3
          ? 'grid-cols-2 grid-rows-2'
          : 'grid-cols-2 grid-rows-2';

  return (
    <div className={cx('grid h-full gap-0.5 bg-white', gridClass)}>
      {previews.map((look, index) => (
        <div
          key={board.items[index]?.itemId ?? `${board.boardId}-${index}`}
          className={cx('min-h-0 overflow-hidden', previews.length === 3 && index === 0 && 'row-span-2')}
        >
          <BoardCoverTile look={look} />
        </div>
      ))}
    </div>
  );
}

export default function CommunityBoardsPage() {
  const { t } = useLocale();
  const repository = useMemo(() => createBrowserBoardRepository(), []);
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [boards, setBoards] = useState<NailBoardV1[]>([]);
  const [looksById, setLooksById] = useState<Map<string, PublishedLookReadModelV1>>(new Map());
  const [storageCorrupted, setStorageCorrupted] = useState(false);
  const [retry, setRetry] = useState(0);
  const [createOpen, setCreateOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoadState('loading');
      try {
        const { boards: loaded, corrupted } = repository.listBoards();
        const looks = await loadLookReadModels().catch(() => []);
        if (cancelled) return;
        setBoards(loaded);
        setLooksById(new Map(looks.map((look) => [look.lookId, look])));
        setStorageCorrupted(corrupted);
        setLoadState('ready');
      } catch {
        if (!cancelled) setLoadState('error');
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [repository, retry]);

  const closeCreate = () => {
    if (creating) return;
    setCreateOpen(false);
    setCreateError(null);
  };

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
      setCreateOpen(false);
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : t('app.createFailedRetry'));
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="flex flex-col gap-6" data-testid="community-boards-page" data-debug-id="community.boards">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-1 text-nano font-semibold uppercase tracking-[0.18em] text-primary/80">
            {t('app.inspirationLibrary')}
          </p>
          <h1 className="text-2xl font-semibold tracking-tight text-gray-950 sm:text-3xl">
            {t('app.nailBoards')}
          </h1>
          <p className="mt-1 max-w-xl text-sm leading-6 text-gray-500">
            {t('app.collectNailLooksIntoVisualBoardsBeginEveryDesignInspiration')}
          </p>
        </div>
        <Button
          variant="primary"
          className="min-h-11 shrink-0 rounded-full px-5 shadow-sm"
          onClick={() => setCreateOpen(true)}
          data-testid="boards-create-open"
        >
          <Plus size={16} aria-hidden />
          {t('app.newBoard')}
        </Button>
      </header>

      {loadState === 'loading' && (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4" aria-label={t('app.loadingBoards2')}>
          {[0, 1, 2].map((item) => (
            <div key={item} className="overflow-hidden rounded-[20px] border border-gray-100 bg-white">
              <div className="aspect-[4/3] animate-pulse bg-gray-100" />
              <div className="space-y-2 p-4">
                <div className="h-4 w-2/3 animate-pulse rounded bg-gray-100" />
                <div className="h-3 w-1/3 animate-pulse rounded bg-gray-100" />
              </div>
            </div>
          ))}
          <span className="sr-only"><Loader2 size={14} className="animate-spin" aria-hidden /></span>
        </div>
      )}

      {loadState === 'error' && (
        <div className="flex flex-col items-start gap-3 rounded-card border border-gray-200 bg-white p-6">
          <p className="text-sm text-gray-600">{t('app.failedLoadBoards')}</p>
          <Button size="sm" variant="secondary" className="min-h-11" onClick={() => setRetry((key) => key + 1)}>
            {t('app.retry')}
          </Button>
        </div>
      )}

      {loadState === 'ready' && (
        <>
          {storageCorrupted && (
            <div className="rounded-button border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800" data-testid="boards-storage-corrupted">
              {t('app.localStorageCorruptedWritesDisabledAvoidOverwritingItClearBrowserLocalDataRetry')}
            </div>
          )}

          {boards.length === 0 ? (
            <div className="relative overflow-hidden rounded-[24px] border border-white/80 bg-gradient-to-br from-[#f7e9ec] via-[#f2edf6] to-[#e7f1ef] px-6 py-16 text-center shadow-sm" data-testid="boards-empty">
              <div className="pointer-events-none absolute -left-12 -top-20 h-48 w-48 rounded-full bg-white/50 blur-2xl" />
              <div className="pointer-events-none absolute -bottom-20 right-0 h-52 w-52 rounded-full bg-[#ddc7d1]/35 blur-3xl" />
              <FolderHeart size={28} className="relative mx-auto text-[#8f6879]" aria-hidden />
              <p className="relative mt-3 text-base font-semibold text-gray-900">{t('app.startFirstInspiration')}</p>
              <p className="relative mx-auto mt-1 max-w-md text-sm leading-6 text-gray-600">
                {t('app.saveLooksLoveDiscoverTheirImagesWillAppearHereAutomatically')}
              </p>
              <div className="relative mt-5 flex flex-wrap justify-center gap-2">
                <Link
                  to={Routes.community}
                  className="inline-flex min-h-11 items-center justify-center rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                >
                  {t('app.exploreLooks')}
                </Link>
                <Button variant="secondary" className="min-h-11 rounded-full px-5" onClick={() => setCreateOpen(true)}>
                  {t('app.createBoard')}
                </Button>
              </div>
            </div>
          ) : (
            <ul className="grid grid-cols-1 gap-x-5 gap-y-7 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4" data-testid="boards-list">
              {boards.map((board) => {
                const label = VISIBILITY_LABEL[board.visibility];
                return (
                  <li key={board.boardId} className="min-w-0">
                    <Link
                      to={Routes.communityBoardDetail(board.boardId)}
                      className="group block rounded-[22px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
                    >
                      <div className="relative aspect-[4/3] overflow-hidden rounded-[20px] bg-gray-100 shadow-[0_1px_2px_rgba(31,25,28,0.06),0_10px_28px_rgba(31,25,28,0.08)] ring-1 ring-black/5 transition duration-200 group-hover:-translate-y-0.5 group-hover:shadow-[0_14px_34px_rgba(31,25,28,0.14)]">
                        <BoardCoverMosaic
                          board={board}
                          looksById={looksById}
                          emptyLabel={t('app.readyInspiration')}
                        />
                        {board.items.length > 4 && (
                          <span className="absolute bottom-3 right-3 rounded-full bg-black/65 px-2.5 py-1 text-nano font-semibold text-white backdrop-blur-sm">
                            +{board.items.length - 4}
                          </span>
                        )}
                      </div>
                      <div className="flex items-start justify-between gap-3 px-1 pt-3">
                        <div className="min-w-0">
                          <h2 className="truncate text-h3 font-semibold text-gray-950">{board.title}</h2>
                          <p className="mt-0.5 text-xs text-gray-500">
                            {board.items.length} {t('community.inspirationCount')}
                          </p>
                        </div>
                        <span className="mt-0.5 flex shrink-0 items-center gap-1 rounded-full bg-white px-2 py-1 text-nano font-medium text-gray-500 ring-1 ring-gray-200">
                          <VisibilityIcon visibility={board.visibility} />
                          {t(label)}
                        </span>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}

          <details className="self-start text-nano text-gray-400" data-testid="boards-local-demo-disclosure">
            <summary className="min-h-11 cursor-pointer py-3 text-gray-400 hover:text-gray-600">
              {t('app.aboutDemoData')}
            </summary>
            <p className="max-w-xl pb-2 leading-5">
              {t('app.usingLocalDemoIdentityLocalDemoIdentityIdBoardsStoreLookReferencesOnlyLiveBrowser', { LOCAL_DEMO_IDENTITY_ID: LOCAL_DEMO_IDENTITY_ID })}
            </p>
          </details>
        </>
      )}

      <Modal open={createOpen} onClose={closeCreate} title={t('app.createNailBoard')} size="md">
        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            createBoard();
          }}
          data-testid="boards-create-form"
        >
          <div>
            <Input
              autoFocus
              className="min-h-11"
              label={t('app.boardName')}
              placeholder={t('app.eGWeddingInspiration')}
              value={title}
              maxLength={80}
              onChange={(event) => setTitle(event.target.value)}
              data-testid="boards-create-title"
            />
            <p className="mt-2 text-xs leading-5 text-gray-500" data-testid="boards-default-private-disclosure">
              {t('app.privateByDefaultCanChangeVisibilityInsideBoardLater')}
            </p>
          </div>
          {createError && (
            <p className="rounded-button border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700" role="status">
              {createError}
            </p>
          )}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="secondary" className="min-h-11" onClick={closeCreate} disabled={creating}>
              {t('app.cancel')}
            </Button>
            <Button
              type="submit"
              variant="primary"
              className="min-h-11"
              disabled={creating || title.trim().length === 0 || storageCorrupted}
              data-testid="boards-create-submit"
            >
              {creating ? <Loader2 size={14} className="animate-spin" aria-hidden /> : <Plus size={14} aria-hidden />}
              {t('app.createBoard2')}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
