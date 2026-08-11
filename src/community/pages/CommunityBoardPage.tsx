/**
 * `/board/:boardId` · Nail Board owner 详情 / 管理（COMM-V7.1-03）。
 *
 * - 重命名、可见性切换（PUBLIC 需显式确认）、分享链接创建/复制/撤销、
 *   有序条目（可访问 Move up/down + Delete）。
 * - 条目视图状态诚实映射：available / look_unavailable（款式已删除或不可用）/
 *   version_unavailable（canonical 引用的设计版本不可用）。
 * - 每次变更都经 repository 校验 expected revision；失败只显示错误消息，
 *   不留下乐观 UI（repository 保证失败零写入，canonical 状态不变）。
 * - 本页只展示 owner 管理动作；匿名查看走 /board/share/:token。
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  FolderHeart,
  Link2,
  Loader2,
  Lock,
  Trash2,
  X,
} from 'lucide-react';
import { Button, Input, Modal, cx } from '@/design-system';
import { Routes } from '@/app/routes';
import { useLocale } from '@/lib/i18n';
import { loadLookReadModels } from '../data/look-repository';
import { LOCAL_DEMO_IDENTITY_ID, createBrowserBoardRepository } from '../data/board-repository';
import type { BoardShareLinkV1, NailBoardV1 } from '../domain/v7_1/nail-board';
import {
  resolveItemViewState,
  type BoardItemViewStateV1,
  type BoardItemV1,
  type NailBoardVisibilityV1,
} from '../domain/v7_1/nail-board';
import type { PublishedLookReadModelV1 } from '../domain/v7_1/published-look-read-model';
import { NailBoardVisibilityControl } from '../components/NailBoardVisibilityControl';

type LoadState = 'loading' | 'ready' | 'error';

function shareStatus(share: BoardShareLinkV1, now: string): 'active' | 'expired' | 'revoked' {
  if (share.revokedAt) return 'revoked';
  if (share.expiresAt && share.expiresAt <= now) return 'expired';
  return 'active';
}

export default function CommunityBoardPage() {
  const { boardId } = useParams<{ boardId: string }>();
  const navigate = useNavigate();
  const { text } = useLocale();
  const repository = useMemo(() => createBrowserBoardRepository(), []);
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [board, setBoard] = useState<NailBoardV1 | null>(null);
  const [shares, setShares] = useState<BoardShareLinkV1[]>([]);
  const [looksById, setLooksById] = useState<Map<string, PublishedLookReadModelV1>>(new Map());
  const [retry, setRetry] = useState(0);
  const [nowIso, setNowIso] = useState(() => new Date().toISOString());

  // rename
  const [renameDraft, setRenameDraft] = useState('');
  // actions
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyItem, setBusyItem] = useState<string | null>(null);
  const [revokingShare, setRevokingShare] = useState<string | null>(null);
  // share creation
  const [creatingShare, setCreatingShare] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [shareExpiry, setShareExpiry] = useState('');
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'manual'>('idle');
  // board delete confirm
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!boardId) return;
    let cancelled = false;
    setLoadState('loading');
    setActionError(null);
    void (async () => {
      try {
        const [detail, looks] = await Promise.all([repository.getBoard(boardId), loadLookReadModels()]);
        if (cancelled) return;
        setBoard(detail.board);
        setShares(detail.shares);
        setLooksById(new Map(looks.map((look) => [look.lookId, look])));
        setRenameDraft(detail.board?.title ?? '');
        setNowIso(new Date().toISOString());
        setLoadState(detail.corrupted ? 'error' : 'ready');
        if (detail.corrupted) {
          setActionError(text('本地存储已损坏：为避免覆盖，写入已停止。', 'Local storage is corrupted: writes are disabled to avoid overwriting it.'));
        }
      } catch {
        if (!cancelled) setLoadState('error');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [boardId, repository, retry, text]);

  /** Apply a repository command result: success updates state; failure shows the error and keeps the previous canonical state. */
  const applyResult = useCallback(
    <T,>(result: { ok: true; value: T } | { ok: false; code: string; message: string }, apply: (value: T) => void) => {
      if (!result.ok) {
        setActionError(result.message);
        if (result.code === 'revision_conflict') setRetry((k) => k + 1);
        return;
      }
      setActionError(null);
      apply(result.value);
    },
    [],
  );

  if (!boardId) return <Link to={Routes.communityBoards}>{text('返回 Boards', 'Back to boards')}</Link>;

  if (loadState === 'loading') {
    return (
      <div className="flex items-center gap-2 rounded-card border border-gray-200 bg-white p-6 text-sm text-gray-500">
        <Loader2 size={14} className="animate-spin" aria-hidden />
        {text('加载中…', 'Loading…')}
      </div>
    );
  }

  if (loadState === 'error' || board === null) {
    return (
      <div className="rounded-card border border-gray-200 bg-white p-6" data-testid="board-missing">
        <h1 className="text-lg font-semibold text-gray-900">{text('Board 不存在或已删除', 'Board missing or deleted')}</h1>
        <p className="mt-1 text-xs text-gray-500">{text('可能是无效深链或本地数据已被清除。', 'Invalid deep link, or local data was cleared.')}</p>
        {actionError && <p className="mt-2 text-xs text-amber-700">{actionError}</p>}
        <Button className="mt-4 min-h-11" variant="secondary" onClick={() => navigate(Routes.communityBoards)}>
          {text('返回 Boards', 'Back to boards')}
        </Button>
      </div>
    );
  }

  if (board.ownerIdentityId !== LOCAL_DEMO_IDENTITY_ID) {
    return (
      <div className="rounded-card border border-gray-200 bg-white p-6" data-testid="board-forbidden">
        <h1 className="text-lg font-semibold text-gray-900">{text('无权管理此 Board', 'No permission to manage this board')}</h1>
        <p className="mt-1 text-xs text-gray-500">
          {text(
            `仅 owner（${board.ownerIdentityId}）可管理；当前本地 Demo 身份为 ${LOCAL_DEMO_IDENTITY_ID}。`,
            `Only the owner (${board.ownerIdentityId}) can manage this board; the current local-demo identity is ${LOCAL_DEMO_IDENTITY_ID}.`,
          )}
        </p>
        <Button className="mt-4 min-h-11" variant="secondary" onClick={() => navigate(Routes.communityBoards)}>
          {text('返回 Boards', 'Back to boards')}
        </Button>
      </div>
    );
  }

  const rename = () => {
    applyResult(repository.renameBoard(board.boardId, renameDraft.trim(), board.revision), (value) => {
      setBoard(value.board);
    });
  };

  const changeVisibility = (visibility: NailBoardVisibilityV1, publicConfirmed: boolean) => {
    applyResult(repository.setVisibility(board.boardId, visibility, publicConfirmed, board.revision), (value) => {
      setBoard(value.board);
      const reload = repository.getBoard(board.boardId);
      setShares(reload.shares);
      if (value.revokedShareCount > 0) {
        setActionError(
          text(
            `已切换到仅自己可见，并自动撤销 ${value.revokedShareCount} 个分享链接。`,
            `Switched to PRIVATE; ${value.revokedShareCount} share link(s) were revoked.`,
          ),
        );
      }
    });
  };

  const createShare = async () => {
    setCreatingShare(true);
    setActionError(null);
    setCopyState('idle');
    try {
      const result = await repository.createShareLink(board.boardId, shareExpiry ? { expiresAt: new Date(shareExpiry).toISOString() } : undefined);
      if (!result.ok) {
        setActionError(result.message);
        return;
      }
      const url = `${window.location.origin}${Routes.communityBoardShare(result.value.token)}`;
      setShareUrl(url);
      setShares(repository.getBoard(board.boardId).shares);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : text('创建分享链接失败。', 'Failed to create share link.'));
    } finally {
      setCreatingShare(false);
    }
  };

  const copyShareUrl = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopyState('copied');
    } catch {
      setCopyState('manual');
    }
  };

  const revokeShare = (shareId: string) => {
    setRevokingShare(shareId);
    applyResult(repository.revokeShare(board.boardId, shareId), (value) => {
      setShares((current) => current.map((s) => (s.shareId === shareId ? value.share : s)));
      setShareUrl((current) => (current ? current : null));
    });
    setRevokingShare(null);
  };

  const moveItem = (item: BoardItemV1, direction: 'up' | 'down') => {
    const index = board.items.findIndex((candidate) => candidate.itemId === item.itemId);
    const toIndex = direction === 'up' ? index - 1 : index + 1;
    if (index === -1 || toIndex < 0 || toIndex >= board.items.length) return;
    setBusyItem(item.itemId);
    applyResult(repository.reorderItem(board.boardId, item.itemId, toIndex, board.revision), (value) => {
      if (value.changed) setBoard(value.board);
    });
    setBusyItem(null);
  };

  const deleteItem = (item: BoardItemV1) => {
    setBusyItem(item.itemId);
    applyResult(repository.deleteItem(board.boardId, item.itemId, board.revision), (value) => {
      setBoard(value.board);
    });
    setBusyItem(null);
  };

  const deleteBoard = () => {
    setDeleting(true);
    applyResult(repository.deleteBoard(board.boardId, board.revision), () => {
      navigate(Routes.communityBoards);
    });
    setDeleting(false);
    setConfirmDeleteOpen(false);
  };

  return (
    <div className="flex flex-col gap-4" data-testid="community-board-page" data-debug-id="community.board">
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          className="min-h-11 px-2"
          onClick={() => navigate(Routes.communityBoards)}
          aria-label={text('返回 Boards', 'Back to boards')}
        >
          <ArrowLeft size={16} aria-hidden />
        </Button>
        <h1 className="truncate text-lg font-semibold text-gray-900" data-testid="board-title">
          {board.title}
        </h1>
      </div>

      {actionError && (
        <p className="rounded-button border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800" role="status" data-testid="board-action-error">
          {actionError}
        </p>
      )}

      <section className="flex flex-col gap-3 rounded-card border border-gray-200 bg-white p-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="flex-1">
            <Input
              className="min-h-11"
              label={text('Board 名称', 'Board title')}
              value={renameDraft}
              maxLength={80}
              onChange={(event) => setRenameDraft(event.target.value)}
              data-testid="board-rename-input"
            />
          </div>
          <Button
            variant="secondary"
            className="min-h-11"
            disabled={renameDraft.trim().length === 0 || renameDraft.trim() === board.title}
            data-testid="board-rename-submit"
            onClick={rename}
          >
            {text('重命名', 'Rename')}
          </Button>
        </div>

        <NailBoardVisibilityControl
          visibility={board.visibility}
          onChange={changeVisibility}
        />
      </section>

      <section className="flex flex-col gap-3 rounded-card border border-gray-200 bg-white p-4" data-testid="board-share-section">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold text-gray-900">
          <Link2 size={14} aria-hidden />
          {text('分享链接', 'Share links')}
        </h2>
        {board.visibility === 'PRIVATE' ? (
          <p className="rounded-button border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-500" data-testid="board-share-private-note">
            {text(
              'PRIVATE Board 不可生成匿名分享链接；切换到 UNLISTED 或 PUBLIC 后可分享（只读）。',
              'PRIVATE boards are never anonymously shareable. Switch to UNLISTED or PUBLIC to share read-only.',
            )}
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <div className="flex-1">
                <Input
                  className="min-h-11"
                  type="date"
                  label={text('过期时间（可选）', 'Expiry (optional)')}
                  value={shareExpiry}
                  onChange={(event) => setShareExpiry(event.target.value)}
                  data-testid="board-share-expiry"
                />
              </div>
              <Button
                variant="secondary"
                className="min-h-11"
                disabled={creatingShare}
                data-testid="board-share-create"
                onClick={() => void createShare()}
              >
                {creatingShare ? <Loader2 size={14} className="animate-spin" aria-hidden /> : <Link2 size={14} aria-hidden />}
                {text('创建分享链接', 'Create share link')}
              </Button>
            </div>
            {shareUrl && (
              <div className="flex flex-col gap-1 rounded-button border border-emerald-200 bg-emerald-50 p-2" data-testid="board-share-url">
                <p className="text-[11px] text-emerald-800">
                  {text('链接仅显示一次（原始 token 不会存储）：', 'Shown once only (the raw token is never stored):')}
                </p>
                <div className="flex flex-col gap-1 sm:flex-row">
                  <input
                    readOnly
                    value={shareUrl}
                    aria-label={text('分享链接', 'Share link')}
                    className="h-11 min-w-0 flex-1 rounded-button border border-emerald-300 bg-white px-2 text-xs text-gray-800 focus:outline-none"
                  />
                  <Button variant="secondary" className="min-h-11" data-testid="board-share-copy" onClick={() => void copyShareUrl()}>
                    {copyState === 'copied' ? <Check size={14} aria-hidden /> : <Copy size={14} aria-hidden />}
                    {copyState === 'copied' ? text('已复制', 'Copied') : text('复制', 'Copy')}
                  </Button>
                </div>
                {copyState === 'manual' && (
                  <p className="text-[11px] text-amber-700">{text('复制失败：请手动选择并复制链接。', 'Copy failed: select the link and copy it manually.')}</p>
                )}
              </div>
            )}
            {shares.length > 0 && (
              <ul className="flex flex-col gap-1.5" data-testid="board-share-list">
                {shares.map((share) => {
                  const status = shareStatus(share, nowIso);
                  return (
                    <li key={share.shareId} className="flex items-center gap-2 rounded-button border border-gray-200 px-3 py-2 text-xs">
                      <span className="font-mono text-gray-500">{share.tokenHash.slice(0, 10)}…</span>
                      <span className="text-gray-400">{share.createdAt.slice(0, 10)}</span>
                      {share.expiresAt && <span className="text-gray-400">→ {share.expiresAt.slice(0, 10)}</span>}
                      <span
                        className={cx(
                          'rounded-full px-2 py-0.5 font-medium',
                          status === 'active' && 'bg-emerald-50 text-emerald-700',
                          status === 'expired' && 'bg-amber-50 text-amber-700',
                          status === 'revoked' && 'bg-gray-100 text-gray-500',
                        )}
                      >
                        {status === 'active' ? text('有效', 'Active') : status === 'expired' ? text('已过期', 'Expired') : text('已撤销', 'Revoked')}
                      </span>
                      {status === 'active' && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="ml-auto min-h-11"
                          disabled={revokingShare === share.shareId}
                          data-testid={`board-share-revoke-${share.shareId}`}
                          onClick={() => revokeShare(share.shareId)}
                        >
                          <X size={13} aria-hidden />
                          {text('撤销', 'Revoke')}
                        </Button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-2 rounded-card border border-gray-200 bg-white p-4" data-testid="board-items-section">
        <h2 className="text-sm font-semibold text-gray-900">
          {text('款式', 'Looks')}（{board.items.length}）
        </h2>
        {board.items.length === 0 ? (
          <div className="rounded-button border border-dashed border-gray-200 px-4 py-8 text-center" data-testid="board-items-empty">
            <FolderHeart size={20} className="mx-auto text-gray-300" aria-hidden />
            <p className="mt-1 text-sm text-gray-600">{text('还没有保存的款式', 'No saved looks yet')}</p>
            <Link
              to={Routes.community}
              className="mt-2 inline-flex h-11 items-center rounded-button border border-primary/30 bg-primary-soft px-3 text-xs font-medium text-primary hover:bg-primary/15"
            >
              {text('去 Discover 收藏', 'Collect looks in Discover')}
            </Link>
          </div>
        ) : (
          <ol className="flex flex-col gap-1.5" data-testid="board-items-list">
            {board.items.map((item, index) => (
              <BoardItemRow
                key={item.itemId}
                item={item}
                index={index}
                count={board.items.length}
                look={looksById.get(item.lookId) ?? null}
                busy={busyItem === item.itemId}
                onMove={(direction: 'up' | 'down') => moveItem(item, direction)}
                onDelete={() => deleteItem(item)}
              />
            ))}
          </ol>
        )}
      </section>

      <section className="rounded-card border border-red-200 bg-white p-4">
        <Button
          variant="danger"
          className="min-h-11"
          data-testid="board-delete"
          onClick={() => setConfirmDeleteOpen(true)}
        >
          <Trash2 size={14} aria-hidden />
          {text('删除此 Board', 'Delete this board')}
        </Button>
      </section>

      <Modal
        open={confirmDeleteOpen}
        onClose={() => setConfirmDeleteOpen(false)}
        title={text('删除 Board？', 'Delete this board?')}
        size="sm"
        footer={
          <>
            <Button variant="ghost" className="min-h-11" onClick={() => setConfirmDeleteOpen(false)}>
              {text('取消', 'Cancel')}
            </Button>
            <Button variant="danger" className="min-h-11" disabled={deleting} data-testid="board-delete-confirm" onClick={deleteBoard}>
              {text('确认删除', 'Delete')}
            </Button>
          </>
        }
      >
        <p className="text-sm text-gray-700">
          {text(
            `「${board.title}」及其所有分享链接将被删除。此操作不可撤销。`,
            `"${board.title}" and all of its share links will be deleted. This cannot be undone.`,
          )}
        </p>
      </Modal>
    </div>
  );
}

function BoardItemRow({
  item,
  index,
  count,
  look,
  busy,
  onMove,
  onDelete,
}: {
  item: BoardItemV1;
  index: number;
  count: number;
  look: PublishedLookReadModelV1 | null;
  busy: boolean;
  onMove: (direction: 'up' | 'down') => void;
  onDelete: () => void;
}) {
  const { text } = useLocale();
  const [coverFailed, setCoverFailed] = useState(false);
  const viewState: BoardItemViewStateV1 = resolveItemViewState(item, look);
  const title = look?.title ?? item.lookId;

  return (
    <li
      className="flex items-center gap-2 rounded-button border border-gray-200 bg-white px-3 py-2"
      data-testid="board-item-row"
      data-item-id={item.itemId}
      data-view-state={viewState.state}
    >
      <div className="h-12 w-12 shrink-0 overflow-hidden rounded-button border border-gray-100 bg-gray-50">
        {look && !coverFailed ? (
          <img src={look.cover.url} alt="" className="h-full w-full object-cover" loading="lazy" onError={() => setCoverFailed(true)} />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Lock size={14} aria-hidden className="text-gray-300" />
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-gray-900">{title}</p>
        <p className="mt-0.5 flex flex-wrap items-center gap-1 text-[10px] text-gray-500">
          {item.sourceKind === 'LEGACY_UNVERSIONED' ? (
            <span className="rounded-full bg-amber-50 px-1.5 py-0.5 text-amber-700">
              {text('未版本化灵感参考', 'Unversioned inspiration')}
            </span>
          ) : (
            <span className="rounded-full bg-primary-soft px-1.5 py-0.5 text-primary">
              v{item.designVersionId}
            </span>
          )}
          {viewState.state === 'look_unavailable' && (
            <span className="rounded-full bg-red-50 px-1.5 py-0.5 text-red-600" data-testid="board-item-look-unavailable">
              {text('款式已删除或不可用', 'Look deleted or unavailable')}
            </span>
          )}
          {viewState.state === 'version_unavailable' && (
            <span className="rounded-full bg-amber-50 px-1.5 py-0.5 text-amber-700" data-testid="board-item-version-unavailable">
              {text('设计版本不可用', 'Design version unavailable')}
            </span>
          )}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-1" role="group" aria-label={text('条目操作', 'Item actions')}>
        <button
          type="button"
          disabled={busy || index === 0}
          aria-label={text(`上移 ${title}`, `Move ${title} up`)}
          data-testid="board-item-move-up"
          className="inline-flex h-11 w-11 items-center justify-center rounded-button border border-gray-200 text-gray-600 hover:border-primary/40 hover:text-primary disabled:cursor-not-allowed disabled:text-gray-300"
          onClick={() => onMove('up')}
        >
          <ChevronUp size={15} aria-hidden />
        </button>
        <button
          type="button"
          disabled={busy || index === count - 1}
          aria-label={text(`下移 ${title}`, `Move ${title} down`)}
          data-testid="board-item-move-down"
          className="inline-flex h-11 w-11 items-center justify-center rounded-button border border-gray-200 text-gray-600 hover:border-primary/40 hover:text-primary disabled:cursor-not-allowed disabled:text-gray-300"
          onClick={() => onMove('down')}
        >
          <ChevronDown size={15} aria-hidden />
        </button>
        <button
          type="button"
          disabled={busy}
          aria-label={text(`从 Board 删除 ${title}`, `Remove ${title} from board`)}
          data-testid="board-item-delete"
          className="inline-flex h-11 w-11 items-center justify-center rounded-button border border-gray-200 text-gray-600 hover:border-red-300 hover:text-red-600 disabled:cursor-not-allowed disabled:text-gray-300"
          onClick={onDelete}
        >
          <Trash2 size={15} aria-hidden />
        </button>
      </div>
    </li>
  );
}
