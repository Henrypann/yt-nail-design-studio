/**
 * Editor 顶栏（模块 4 · PRD §13.2）
 * ← 返回 │ 👤 客户 │ 甲型·长度 │ 💾 保存状态 │ [保存] [导出 PNG] [十指平铺预览] [顾客已确认]
 */

import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  Compass,
  Download,
  HelpCircle,
  LayoutGrid,
  Presentation,
  Redo2,
  Save,
  Undo2,
  User,
} from 'lucide-react';
import { Button, Modal, cx, useToast } from '@/design-system';
import { Routes } from '@/app/routes';
import { communityProductHref } from '@/app/product-navigation';
import { communityHref } from '@/community/lib/entry-link';
import { CrossProductLink } from '@/app/CrossProductLink';
import { useLocale } from '@/lib/i18n';
import { confirmDesign } from '@/lib/state-machine';
import { readData, StorageKeys } from '@/lib/storage';
import { customerName, getDesign, upsertDesign } from '../lib/repo';
import { lengthName, shapeName } from '../lib/material';
import {
  composeNailSvg,
  composeTiledSvg,
  downloadDataUrl,
  svgToPngDataUrl,
} from '../lib/render';
import { resolveFingerData } from '../lib/model';
import { useEditorStore } from '../store';

const SAVE_LABEL = { saved: 'editor.extra.savedBadge', dirty: 'editor.extra.dirtyBadge', saving: 'editor.extra.savingBadge', error: 'editor.extra.saveFailedBadge' } as const;

export function EditorTopBar(props: {
  onOpenTiled: () => void;
  onOpenPresentation: () => void;
  onOpenHelp: () => void;
  onFirstOutcome: () => void;
}) {
  const { onOpenTiled, onOpenPresentation, onOpenHelp, onFirstOutcome } = props;
  const navigate = useNavigate();
  const { locale, t } = useLocale();
  const toast = useToast();
  const doc = useEditorStore((s) => s.doc);
  const status = useEditorStore((s) => s.status);
  const readOnly = useEditorStore((s) => s.readOnly);
  const saveState = useEditorStore((s) => s.saveState);
  const save = useEditorStore((s) => s.save);
  const currentFinger = useEditorStore((s) => s.currentFinger);
  const historyCount = useEditorStore((s) => s.history.length);
  const futureCount = useEditorStore((s) => s.future.length);
  const undo = useEditorStore((s) => s.undo);
  const redo = useEditorStore((s) => s.redo);

  const [exportOpen, setExportOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) setExportOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  if (!doc) return null;

  const doSave = async () => {
    const result = await save();
    if (result === 'saved') {
      toast.success(t('editor.extra.savedToast'));
      onFirstOutcome();
    }
    else toast.error(t('editor.extra.saveRetryToast'));
  };

  const requestLeave = () => {
    if (saveState === 'dirty' || saveState === 'error') setLeaveOpen(true);
    else navigate(Routes.designs);
  };

  const exportPng = async (kind: 'single' | 'tiled') => {
    setExportOpen(false);
    setExporting(true);
    try {
      if (kind === 'single') {
        const svg = composeNailSvg(
          {
            shape: doc.shape,
            length: doc.length,
            data: resolveFingerData(doc, currentFinger),
            uid: `export-${currentFinger}`,
            appearance: doc.appearance,
            recipe: doc.recipe,
            finger: doc.masterFinger,
          },
          4,
        );
        if (!svg) throw new Error('compose failed');
        const png = await svgToPngDataUrl(svg, 480, 880);
        downloadDataUrl(png, `单甲_${currentFinger}_${doc.shape}.png`);
      } else {
        const svg = composeTiledSvg(doc, { view: 'back', markBadges: true });
        if (!svg) throw new Error('compose failed');
        const png = await svgToPngDataUrl(svg, 1500, 880);
        downloadDataUrl(png, `十指平铺_${doc.shape}.png`);
      }
      toast.success(t('editor.extra.exported'));
      onFirstOutcome();
    } catch {
      toast.error(t('editor.extra.exportFailed'));
    } finally {
      setExporting(false);
    }
  };

  const doConfirm = () => {
    const design = getDesign(doc.designId);
    if (!design) return;
    const session = readData<{ userName?: string }>(StorageKeys.session);
    try {
      const confirmed = confirmDesign(design, session?.userName ?? '美甲师');
      upsertDesign(confirmed);
      setConfirmOpen(false);
      toast.success(t('editor.extra.confirmedToast'));
      // 重新加载为只读态
      useEditorStore.getState().load(doc.designId);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('editor.extra.operationFailed'));
    }
  };

  return (
    <header
      className="flex h-12 shrink-0 items-center justify-between gap-2 border-b border-gray-200 bg-white px-3"
      data-debug-id="studio.editor.topbar"
    >
      <div className="flex min-w-0 items-center gap-3">
        <button
          onClick={requestLeave}
          className="flex items-center gap-1 rounded-button px-2 py-1 text-xs text-gray-500 transition-colors duration-fast hover:bg-gray-100 hover:text-gray-800"
        >
          <ArrowLeft size={14} />
          {t('app.back2')}
        </button>
        <CrossProductLink
          data-testid="editor-community-entry"
          title={t('editor.extra.enterCommunity')}
          aria-label={t('editor.extra.enterCommunity')}
          href={communityProductHref(communityHref({
            entry: 'editor',
            returnTo: `${Routes.designCanvas}?design=${doc.designId}`,
          }))}
          className="flex items-center gap-1 rounded-button px-2 py-1 text-xs text-gray-500 transition-colors duration-fast hover:bg-gray-100 hover:text-gray-800"
        >
          <Compass size={13} />
          {t('nav.community')}
        </CrossProductLink>
        <span className="hidden items-center gap-1 text-xs text-gray-600 xl:flex">
          <User size={13} className="text-gray-400" />
          {customerName(doc.customerId)}
        </span>
        <span className="rounded-button bg-gray-100 px-2 py-0.5 text-nano text-gray-600">
          {shapeName(doc.shape, locale)} · {lengthName(doc.length, locale)}
        </span>
        <span
          className={cx(
            'text-nano',
            saveState === 'error'
              ? 'font-medium text-error'
              : saveState === 'dirty'
                ? 'text-warning'
                : 'text-gray-400',
          )}
        >
          {t(SAVE_LABEL[saveState])}
          {saveState === 'error' && (
            <button onClick={doSave} className="ml-1 underline">
              {t('editor.extra.retrySave')}
            </button>
          )}
        </span>
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        <Button size="sm" variant="ghost" disabled={readOnly || historyCount === 0} onClick={undo} title={t('editor.extra.undo')}>
          <Undo2 size={13} />
        </Button>
        <Button size="sm" variant="ghost" disabled={readOnly || futureCount === 0} onClick={redo} title={t('editor.extra.redo')}>
          <Redo2 size={13} />
        </Button>
        <Button size="sm" variant="ghost" onClick={onOpenHelp} title={t('editor.extra.restartOnboarding')}>
          <HelpCircle size={13} />
        </Button>
        {status === 'draft' && !readOnly && (
          <Button size="sm" variant="secondary" onClick={() => setConfirmOpen(true)}>
            <CheckCircle2 size={13} />
            {t('app.customerApproved')}
          </Button>
        )}
        <div className="relative" ref={exportRef}>
          <Button
            size="sm"
            variant="secondary"
            loading={exporting}
            onClick={() => setExportOpen((v) => !v)}
          >
            <Download size={13} />
            {t('app.exportPng')}
            <ChevronDown size={12} />
          </Button>
          {exportOpen && (
            <div className="absolute right-0 top-9 z-30 w-40 rounded-panel border border-gray-200 bg-white p-1 shadow-modal animate-fade-in">
              <button
                onClick={() => exportPng('single')}
                className="w-full rounded-button px-2.5 py-1.5 text-left text-xs text-gray-700 hover:bg-gray-50"
              >
                {t('app.currentNailPng')}
              </button>
              <button
                onClick={() => exportPng('tiled')}
                className="w-full rounded-button px-2.5 py-1.5 text-left text-xs text-gray-700 hover:bg-gray-50"
              >
                {t('app.all10Png')}
              </button>
            </div>
          )}
        </div>
        <Button size="sm" variant="secondary" onClick={onOpenTiled}>
          <LayoutGrid size={13} />
          {t('app.all10Preview')}
        </Button>
        <Button size="sm" variant="secondary" onClick={onOpenPresentation}>
          <Presentation size={13} />
          {t('app.present')}
        </Button>
        {!readOnly && (
          <Button size="sm" onClick={doSave} loading={saveState === 'saving'}>
            <Save size={13} />
            {t('app.save')}
          </Button>
        )}
      </div>

      {/* 顾客已确认 · 二次确认弹窗（DEV-PLAN §6.2：线下场景唯一确认动作） */}
      <Modal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title={t('editor.extra.confirmTitle')}
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setConfirmOpen(false)}>
              {t('editor.extra.cancel')}
            </Button>
            <Button size="sm" onClick={doConfirm}>
              {t('editor.extra.confirm')}
            </Button>
          </>
        }
      >
        <p className="text-sm text-gray-600">
          {t('editor.extra.confirmDescription')}
        </p>
      </Modal>

      {/* 未保存离开拦截 */}
      <Modal
        open={leaveOpen}
        onClose={() => setLeaveOpen(false)}
        title={t('editor.extra.unsavedTitle')}
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setLeaveOpen(false)}>
              {t('editor.extra.continueEditing')}
            </Button>
            <Button variant="danger" size="sm" onClick={() => navigate(Routes.designs)}>
              {t('editor.extra.leaveWithoutSaving')}
            </Button>
            <Button
              size="sm"
              onClick={async () => {
                await doSave();
                navigate(Routes.designs);
              }}
            >
              {t('editor.extra.saveAndLeave')}
            </Button>
          </>
        }
      >
        <p className="text-sm text-gray-600">{t('editor.extra.unsavedDescription')}</p>
      </Modal>
    </header>
  );
}
