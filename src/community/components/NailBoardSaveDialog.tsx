/**
 * NailBoardSaveDialog · COMM-V7.1-03
 *
 * Save-to-Board dialog owned by the Feed. The look is saved as an exact
 * reference (lookId + designVersionId), never a content copy:
 *  - canonical looks (readModelKind CANONICAL) save as CANONICAL_VERSIONED;
 *  - legacy static looks (LEGACY_PARTIAL) save as LEGACY_UNVERSIONED with an
 *    explicit "unversioned inspiration reference" caveat — never claimed
 *    version-stable.
 *
 * Honesty rules:
 *  - Success is only shown after the repository confirms persistence
 *    (`ok: true`). An idempotent no-op (already saved) is displayed as
 *    already-saved, never as a fresh fake success.
 *  - The dialog lists boards that already contain this look (dedupe key =
 *    sourceKind + lookId + exact designVersionId) so the user sees the real
 *    saved state.
 *  - Errors render inline with retry; no optimistic UI is left behind.
 *
 * No collaboration, collage, likes, Three.js or Editor/Wizard store imports.
 */

import { useEffect, useMemo, useState } from 'react';
import { Bookmark, Loader2, Plus } from 'lucide-react';
import { Button, Input, Modal, cx } from '@/design-system';
import { useLocale } from '@/lib/i18n';
import type { PublishedLookReadModelV1 } from '../domain/v7_1/published-look-read-model';
import type { NailBoardV1 } from '../domain/v7_1/nail-board';
import { createBrowserBoardRepository } from '../data/board-repository';

interface Props {
  look: PublishedLookReadModelV1 | null;
  open: boolean;
  onClose: () => void;
}

type LoadState = 'loading' | 'ready' | 'error';

export function NailBoardSaveDialog({ look, open, onClose }: Props) {
  const { text } = useLocale();
  const repository = useMemo(() => createBrowserBoardRepository(), []);
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [boards, setBoards] = useState<NailBoardV1[]>([]);
  const [savedBoardIds, setSavedBoardIds] = useState<Set<string>>(new Set());
  const [retry, setRetry] = useState(0);
  const [selectedBoardId, setSelectedBoardId] = useState<string | null>(null);
  const [creatingNew, setCreatingNew] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ kind: 'saved' | 'error'; message: string } | null>(null);

  useEffect(() => {
    if (!open || !look) return;
    let cancelled = false;
    setLoadState('loading');
    setNotice(null);
    setSelectedBoardId(null);
    setCreatingNew(false);
    setNewTitle('');
    void (async () => {
      try {
        const reference = saveReferenceFor(look);
        const [all, saved] = await Promise.all([
          repository.listBoards(),
          repository.findSavedBoards(reference),
        ]);
        if (cancelled) return;
        setBoards(all.boards);
        setSavedBoardIds(new Set(saved.boards.map((entry) => entry.board.boardId)));
        setLoadState(all.corrupted ? 'error' : 'ready');
        if (all.corrupted) {
          setNotice({
            kind: 'error',
            message: text('本地存储损坏，已停止写入，请先清除本地数据后重试。', 'Local storage is corrupted; writes are disabled. Clear local data and retry.'),
          });
        }
      } catch {
        if (!cancelled) setLoadState('error');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, look, repository, retry, text]);

  if (!open || !look) return null;

  const reference = saveReferenceFor(look);
  const legacyCaveat = look.readModelKind === 'LEGACY_PARTIAL';
  const targets = boards.filter((board) => !savedBoardIds.has(board.boardId));
  const canSave =
    loadState === 'ready' &&
    !saving &&
    ((!creatingNew && selectedBoardId !== null) || (creatingNew && newTitle.trim().length > 0));

  const runSave = async () => {
    if (!canSave || !look) return;
    setSaving(true);
    setNotice(null);
    try {
      let boardId: string;
      if (creatingNew) {
        const created = repository.createBoard(newTitle.trim());
        if (!created.ok) {
          setNotice({ kind: 'error', message: created.message });
          return;
        }
        boardId = created.value.board.boardId;
        setBoards((current) => [created.value.board, ...current]);
      } else {
        boardId = selectedBoardId as string;
      }
      // Fresh boards start at revision 1; existing targets use their loaded revision.
      const existing = boards.find((candidate) => candidate.boardId === boardId);
      const expectedRevision = existing ? existing.revision : 1;
      const saved = await repository.saveItem({
        boardId,
        lookId: reference.lookId,
        sourceKind: reference.sourceKind,
        designVersionId: reference.designVersionId,
        expectedRevision,
      });
      if (!saved.ok) {
        setNotice({ kind: 'error', message: saved.message });
        if (saved.code === 'revision_conflict') setRetry((k) => k + 1);
        return;
      }
      setSavedBoardIds((current) => new Set(current).add(boardId));
      setSelectedBoardId(null);
      setCreatingNew(false);
      setNewTitle('');
      setNotice({
        kind: 'saved',
        message: saved.value.changed
          ? text('已保存到该 Board。', 'Saved to the board.')
          : text('该款式此前已在此 Board 中（未重复保存）。', 'This look was already on that board (nothing duplicated).'),
      });
    } catch (error) {
      setNotice({
        kind: 'error',
        message: error instanceof Error ? error.message : text('保存失败，请重试。', 'Save failed. Retry.'),
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={text('保存到 Nail Board', 'Save to Nail Board')}
      size="md"
      footer={
        <>
          <Button variant="ghost" className="min-h-11" onClick={onClose}>
            {text('完成', 'Done')}
          </Button>
          <Button
            variant="primary"
            className="min-h-11"
            disabled={!canSave}
            data-testid="nail-board-save-confirm"
            onClick={() => void runSave()}
          >
            {saving ? <Loader2 size={14} className="animate-spin" aria-hidden /> : <Bookmark size={14} aria-hidden />}
            {text('保存', 'Save')}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3" data-testid="nail-board-save-dialog">
        <div className="rounded-card border border-gray-200 bg-gray-50 px-3 py-2">
          <p className="text-sm font-medium text-gray-900">{look.title}</p>
          <p className="mt-0.5 text-nano text-gray-500">
            {reference.sourceKind === 'CANONICAL_VERSIONED'
              ? text('版本化引用（designVersionId 精确匹配）', 'Versioned reference (exact designVersionId)')
              : text('未版本化灵感参考（legacy）', 'Unversioned inspiration reference (legacy)')}
          </p>
        </div>

        {legacyCaveat && (
          <p
            className="rounded-button border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800"
            data-testid="nail-board-legacy-caveat"
          >
            {text(
              '此款式来自 legacy 静态内容，没有 DesignVersionId：只能作为“未版本化灵感参考”保存，不能声称版本稳定或可制造。',
              'This look comes from legacy static content with no DesignVersionId: it can only be saved as an unversioned inspiration reference, never claimed version-stable or manufacturable.',
            )}
          </p>
        )}

        {loadState === 'loading' && (
          <p className="flex items-center gap-2 py-4 text-sm text-gray-500">
            <Loader2 size={14} className="animate-spin" aria-hidden />
            {text('加载 Board…', 'Loading boards…')}
          </p>
        )}

        {loadState === 'error' && (
          <div className="flex flex-col items-start gap-2 py-2">
            <p className="text-sm text-gray-600">{text('Board 列表加载失败。', 'Failed to load boards.')}</p>
            <Button size="sm" variant="secondary" className="min-h-11" onClick={() => setRetry((k) => k + 1)}>
              {text('重试', 'Retry')}
            </Button>
          </div>
        )}

        {loadState === 'ready' && savedBoardIds.size > 0 && (
          <div className="flex flex-wrap gap-1.5" data-testid="nail-board-already-saved">
            {boards
              .filter((board) => savedBoardIds.has(board.boardId))
              .map((board) => (
                <span
                  key={board.boardId}
                  className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700"
                >
                  <Bookmark size={11} aria-hidden />
                  {text('已保存到', 'Saved in')}「{board.title}」
                </span>
              ))}
          </div>
        )}

        {loadState === 'ready' && (
          <fieldset className="flex flex-col gap-2">
            <legend className="text-xs font-medium text-gray-700">{text('保存到', 'Save to')}</legend>
            {targets.length === 0 && !creatingNew && (
              <p className="text-xs text-gray-500" data-testid="nail-board-all-saved">
                {text('所有 Board 都已包含此款式；可以新建一个。', 'Every board already contains this look; you can create a new one.')}
              </p>
            )}
            {targets.map((board) => (
              <label
                key={board.boardId}
                className={cx(
                  'flex min-h-11 cursor-pointer items-center gap-2 rounded-button border px-3 py-2 text-sm',
                  selectedBoardId === board.boardId
                    ? 'border-primary/50 bg-primary-soft'
                    : 'border-gray-200 bg-white hover:border-gray-300',
                )}
              >
                <input
                  type="radio"
                  name="nail-board-target"
                  value={board.boardId}
                  checked={selectedBoardId === board.boardId}
                  onChange={() => {
                    setSelectedBoardId(board.boardId);
                    setCreatingNew(false);
                  }}
                  className="h-4 w-4 accent-primary"
                />
                <span className="min-w-0 flex-1 truncate text-gray-900">{board.title}</span>
                <span className="shrink-0 text-nano text-gray-400">
                  {board.items.length} {text('款', 'items')}
                </span>
              </label>
            ))}
            <label
              className={cx(
                'flex min-h-11 cursor-pointer items-center gap-2 rounded-button border px-3 py-2 text-sm',
                creatingNew ? 'border-primary/50 bg-primary-soft' : 'border-gray-200 bg-white hover:border-gray-300',
              )}
            >
              <input
                type="radio"
                name="nail-board-target"
                checked={creatingNew}
                onChange={() => {
                  setCreatingNew(true);
                  setSelectedBoardId(null);
                }}
                className="h-4 w-4 accent-primary"
              />
              <Plus size={14} aria-hidden className="shrink-0 text-gray-500" />
              <span className="text-gray-900">{text('新建 Board（默认仅自己可见）', 'New board (PRIVATE by default)')}</span>
            </label>
            {creatingNew && (
              <div className="pl-6">
                <Input
                  className="min-h-11"
                  value={newTitle}
                  onChange={(event) => setNewTitle(event.target.value)}
                  label={text('Board 名称', 'Board title')}
                  placeholder={text('例如：婚礼灵感', 'e.g. Wedding inspiration')}
                  maxLength={80}
                  data-testid="nail-board-new-title"
                />
              </div>
            )}
          </fieldset>
        )}

        {notice && (
          <p
            className={cx(
              'rounded-button px-3 py-2 text-xs',
              notice.kind === 'saved' ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-700',
            )}
            role="status"
            data-testid={notice.kind === 'saved' ? 'nail-board-save-saved' : 'nail-board-save-error'}
          >
            {notice.message}
          </p>
        )}
      </div>
    </Modal>
  );
}

/** Map a look read model to the exact board reference (never a content copy). */
function saveReferenceFor(look: PublishedLookReadModelV1): {
  lookId: string;
  sourceKind: 'CANONICAL_VERSIONED' | 'LEGACY_UNVERSIONED';
  designVersionId: string | null;
} {
  if (look.readModelKind === 'CANONICAL') {
    return {
      lookId: look.lookId,
      sourceKind: 'CANONICAL_VERSIONED',
      designVersionId: look.designVersionId,
    };
  }
  return {
    lookId: look.lookId,
    sourceKind: 'LEGACY_UNVERSIONED',
    designVersionId: null,
  };
}
