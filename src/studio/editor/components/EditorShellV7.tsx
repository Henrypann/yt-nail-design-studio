import { useCallback, useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { useBlocker, useNavigate } from 'react-router-dom';
import { AlertCircle, ArrowLeft, Redo2, Save, ShieldAlert, Undo2, UserRound } from 'lucide-react';
import { Button, cx, useToast } from '@/design-system';
import { Routes } from '@/app/routes';
import { editorV7Store, selectCurrentNailV7, selectCurrentStepV7, useEditorV7Store } from '../store-v7';
import { EditorCanvasHostV7 } from './EditorCanvasHostV7';
import { EditorResourceDrawerV7 } from './EditorResourceDrawerV7';
import { EditorStageBarV7 } from './EditorStageBarV7';
import { EditorToolRailV7 } from './EditorToolRailV7';
import { EditorWorkspaceSidebarV7, type EditorWorkspacePanelTabV7 } from './EditorWorkspaceSidebarV7';
import { captureCustomerPreviewSessionV7 } from '../v7/customer-preview-session';
import { TenFingerBarV7 } from './TenFingerBarV7';

const SAVE_LABEL = {
  saved: '已保存',
  dirty: '有未保存更改',
  saving: '正在保存…',
  error: '保存失败，可重试',
} as const;

const FOCUSABLE_SELECTOR = 'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function EditorShellV7({ internalEnabled }: { internalEnabled: boolean }) {
  const navigate = useNavigate();
  const toast = useToast();
  const doc = useEditorV7Store((state) => state.doc);
  const readOnly = useEditorV7Store((state) => state.readOnly);
  const switching = useEditorV7Store((state) => state.switching);
  const currentNail = useEditorV7Store(selectCurrentNailV7);
  const selectedStep = useEditorV7Store(selectCurrentStepV7);
  const saveState = useEditorV7Store((state) => state.saveState);
  const saveError = useEditorV7Store((state) => state.saveError);
  const historyCount = useEditorV7Store((state) => state.history.length);
  const futureCount = useEditorV7Store((state) => state.future.length);
  const setTitle = useEditorV7Store((state) => state.setTitle);
  const undo = useEditorV7Store((state) => state.undo);
  const redo = useEditorV7Store((state) => state.redo);
  const save = useEditorV7Store((state) => state.save);
  const unload = useEditorV7Store((state) => state.unload);
  const [titleDraft, setTitleDraft] = useState(doc?.title ?? '');
  const [leaving, setLeaving] = useState(false);
  const [resourcesOpen, setResourcesOpen] = useState(false);
  const [workspacePanelOpen, setWorkspacePanelOpen] = useState(false);
  const [workspacePanelTab, setWorkspacePanelTab] = useState<EditorWorkspacePanelTabV7>('layers');
  const [wideWorkspace, setWideWorkspace] = useState(() => window.matchMedia('(min-width: 1280px)').matches);
  const [dockedTools, setDockedTools] = useState(() => window.matchMedia('(max-width: 1023px)').matches);
  const [mobileWorkspace, setMobileWorkspace] = useState(() => window.matchMedia('(max-width: 767px)').matches);
  const resourceDialogRef = useRef<HTMLDivElement>(null);
  const overlayTriggerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    setTitleDraft(doc?.title ?? '');
  }, [doc?.designId, doc?.title]);

  useEffect(() => {
    const wide = window.matchMedia('(min-width: 1280px)');
    const docked = window.matchMedia('(max-width: 1023px)');
    const mobile = window.matchMedia('(max-width: 767px)');
    const update = () => {
      setWideWorkspace(wide.matches);
      setDockedTools(docked.matches);
      setMobileWorkspace(mobile.matches);
      if (wide.matches) {
        setWorkspacePanelOpen(false);
        const trigger = overlayTriggerRef.current;
        overlayTriggerRef.current = null;
        queueMicrotask(() => trigger?.focus());
      }
    };
    update();
    wide.addEventListener('change', update);
    docked.addEventListener('change', update);
    mobile.addEventListener('change', update);
    return () => {
      wide.removeEventListener('change', update);
      docked.removeEventListener('change', update);
      mobile.removeEventListener('change', update);
    };
  }, []);

  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      const state = saveState;
      if (state === 'dirty' || state === 'error') event.preventDefault();
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [saveState]);

  const requestExit = useCallback(async (destination: string = Routes.designs) => {
    if (leaving || switching) return;
    setLeaving(true);
    const result = await unload();
    if (result === 'ok') {
      navigate(destination);
      return;
    }
    setLeaving(false);
    toast.error('设计尚未安全保存，已留在当前页面。请重试保存后再离开。');
  }, [leaving, navigate, switching, toast, unload]);

  const blocker = useBlocker(() => {
    const state = editorV7Store.getState();
    return state.revisionState.pendingRevision !== null || state.saveState === 'error';
  });

  useEffect(() => {
    if (blocker.state !== 'blocked' || leaving) return;
    setLeaving(true);
    void unload().then((result) => {
      if (result === 'ok') {
        blocker.proceed();
        return;
      }
      setLeaving(false);
      blocker.reset();
      toast.error('设计尚未安全保存，已留在当前页面。请重试保存后再离开。');
    });
  }, [blocker, leaving, toast, unload]);

  const rememberOverlayTrigger = () => {
    overlayTriggerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  };
  const restoreOverlayTrigger = () => {
    const trigger = overlayTriggerRef.current;
    overlayTriggerRef.current = null;
    queueMicrotask(() => trigger?.focus());
  };
  const openResources = () => {
    rememberOverlayTrigger();
    setWorkspacePanelOpen(false);
    setResourcesOpen(true);
  };
  const closeResources = () => {
    setResourcesOpen(false);
    restoreOverlayTrigger();
  };
  const toggleResources = () => {
    if (resourcesOpen) closeResources();
    else openResources();
  };
  const openWorkspacePanel = (tab: EditorWorkspacePanelTabV7) => {
    rememberOverlayTrigger();
    setResourcesOpen(false);
    setWorkspacePanelTab(tab);
    if (!wideWorkspace) setWorkspacePanelOpen(true);
  };
  const closeWorkspacePanel = () => {
    setWorkspacePanelOpen(false);
    restoreOverlayTrigger();
  };

  useEffect(() => {
    if (wideWorkspace || !resourcesOpen) return;
    resourceDialogRef.current?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR)?.focus();
  }, [resourcesOpen, wideWorkspace]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target;
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) return;
      if (event.key === 'Escape') {
        if (workspacePanelOpen) {
          event.preventDefault();
          closeWorkspacePanel();
        } else if (resourcesOpen) {
          event.preventDefault();
          closeResources();
        }
        return;
      }
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== 'z') return;
      event.preventDefault();
      if (event.shiftKey) redo();
      else undo();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [redo, resourcesOpen, undo, workspacePanelOpen]);

  if (!doc || !currentNail) return null;

  const commitTitle = () => {
    const next = titleDraft.trim();
    if (readOnly || switching || !next || next === doc.title) {
      setTitleDraft(doc.title);
      return;
    }
    const result = setTitle(next);
    if (!result.ok) {
      setTitleDraft(doc.title);
      toast.error(result.message);
    }
  };

  const saveNow = async () => {
    const result = await save();
    if (result === 'error') toast.error(saveError ?? 'V7 保存失败，请重试。');
  };

  const openCustomerPreview = () => {
    if (saveState !== 'saved' || switching) return;
    captureCustomerPreviewSessionV7(doc);
    navigate(`${Routes.designCustomerPreview}?design=${encodeURIComponent(doc.designId)}`);
  };

  const selectStageStep = (stepId: string) => {
    if (selectedStep?.id !== stepId) editorV7Store.getState().selectStep(stepId);
  };

  const trapResourceFocus = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Tab') return;
    const focusable = Array.from(resourceDialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR) ?? []);
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  };

  const layout = wideWorkspace ? 'wide' : dockedTools ? (mobileWorkspace ? 'mobile' : 'tablet') : 'compact';
  const communitySource = doc.sourceRefs.find((ref) => ref.domain === 'community');

  return (
    <section
      className="flex h-[100dvh] min-h-[560px] min-w-0 flex-col overflow-hidden bg-white"
      data-debug-id="studio.editor.shell-v7"
      data-editor-schema="7"
      data-internal-editor-v7={internalEnabled}
      data-layout={layout}
    >
      <header className="flex min-h-[52px] flex-col gap-1.5 border-b border-gray-200 px-2 py-1.5 sm:flex-row sm:flex-wrap sm:items-center sm:gap-2 sm:px-3">
        <div className="flex min-w-0 items-center gap-1.5 sm:contents">
          <Button size="sm" variant="ghost" data-testid={communitySource ? 'editor-return-source' : 'editor-return-designs'} className="min-h-11 min-w-11 shrink-0 sm:min-h-0 sm:min-w-0" disabled={leaving || switching || saveState === 'saving'} loading={leaving} onClick={() => void requestExit(communitySource ? Routes.communityLook(communitySource.sourceId) : Routes.designs)}>
            <ArrowLeft size={14} />
            <span className="sm:hidden">{communitySource ? '来源' : '列表'}</span>
            <span className="hidden sm:inline">{communitySource ? '返回来源 Look' : '设计列表'}</span>
          </Button>
          <span className="hidden rounded-full bg-gray-900 px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-white sm:inline-flex">Editor V7</span>
          {communitySource && (
            <span
              className="min-w-0 flex-1 truncate rounded-full border border-fuchsia-200 bg-fuchsia-50 px-2 py-1 text-[10px] font-medium text-fuchsia-800 sm:flex-none"
              data-testid="editor-remix-disclosure"
              title={`Remix · 来源版本 ${communitySource.revision}`}
            >
              Remix · 来源版本 {communitySource.revision}
            </span>
          )}
          <span
            className={cx('ml-auto shrink-0 text-[11px] sm:ml-0', saveState === 'error' ? 'text-error' : saveState === 'dirty' ? 'text-warning' : 'text-gray-500')}
            role="status"
          >
            {SAVE_LABEL[saveState]}
          </span>
        </div>
        <div className="flex min-w-0 items-center gap-1.5 sm:contents">
          <input
          value={titleDraft}
          disabled={readOnly || switching}
          aria-label="设计名称"
          onChange={(event) => setTitleDraft(event.target.value)}
          onBlur={commitTitle}
          onKeyDown={(event) => {
            if (event.key === 'Enter') event.currentTarget.blur();
            if (event.key === 'Escape') {
              setTitleDraft(doc.title);
              event.currentTarget.blur();
            }
          }}
            className="min-w-0 flex-1 rounded-lg border border-transparent bg-transparent px-2 py-1.5 text-sm font-semibold text-gray-900 hover:border-gray-200 focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 disabled:text-gray-600 sm:min-w-[140px]"
          />
          <Button size="sm" variant="ghost" className="min-h-11 min-w-11 shrink-0 sm:min-h-0 sm:min-w-0" disabled={readOnly || switching || historyCount === 0} onClick={() => undo()} title="撤销（⌘Z）" aria-label="撤销">
            <Undo2 size={14} />
          </Button>
          <Button size="sm" variant="ghost" className="min-h-11 min-w-11 shrink-0 sm:min-h-0 sm:min-w-0" disabled={readOnly || switching || futureCount === 0} onClick={() => redo()} title="重做（⇧⌘Z）" aria-label="重做">
            <Redo2 size={14} />
          </Button>
          <Button size="sm" className="min-h-11 min-w-11 shrink-0 sm:min-h-0 sm:min-w-0" variant={saveState === 'error' ? 'primary' : 'secondary'} disabled={readOnly || switching || saveState === 'saving'} loading={saveState === 'saving'} onClick={() => void saveNow()}>
            <Save size={14} /><span className="hidden sm:inline">{saveState === 'error' ? '重试保存' : '保存'}</span>
          </Button>
          <Button
            size="sm"
            className="min-h-11 min-w-11 shrink-0 sm:min-h-0 sm:min-w-0"
            variant="secondary"
            disabled={saveState !== 'saved' || switching}
            title={saveState === 'saved' ? '打开顾客只读预览' : '请等待设计安全保存后再预览'}
            aria-label="打开顾客只读预览"
            onClick={openCustomerPreview}
          >
            <UserRound size={14} /><span className="hidden sm:inline">顾客预览</span>
          </Button>
        </div>
      </header>

      {readOnly && (
        <div className="flex items-start gap-2 border-b border-info/20 bg-info-soft px-3 py-2 text-xs text-info" role="status">
          <ShieldAlert size={14} className="mt-0.5 shrink-0" />
          <span>{internalEnabled ? '当前 V7 设计处于只读状态；选择与折叠仍可使用。' : 'V7 内测开关未开启：已使用 V7 reader 安全打开，V6 writer 不会接触这份文档。'}</span>
        </div>
      )}

      {switching && (
        <div className="border-b border-info/20 bg-info-soft px-3 py-2 text-xs text-info" role="status">
          正在安全保存并切换设计，编辑操作已暂时停用。
        </div>
      )}

      {saveState === 'error' && (
        <div className="flex items-center justify-between gap-3 border-b border-error/20 bg-red-50 px-3 py-2 text-xs text-error" role="alert">
          <span className="flex min-w-0 items-center gap-2"><AlertCircle size={14} className="shrink-0" /><span className="truncate">{saveError ?? '保存失败，内存中的修改仍然保留。'}</span></span>
          <Button size="sm" variant="secondary" onClick={() => void saveNow()}>重试</Button>
        </div>
      )}

      <EditorStageBarV7 nail={currentNail} selectedStepId={selectedStep?.id ?? null} onSelectStep={selectStageStep} onOpenCustomerPreview={openCustomerPreview} customerPreviewEnabled={saveState === 'saved' && !switching} />

      <div className="relative flex min-h-0 min-w-0 flex-1 overflow-hidden">
        {!dockedTools && <EditorToolRailV7 orientation="vertical" resourcesOpen={resourcesOpen} onOpenResources={openResources} onToggleResources={toggleResources} onOpenPanel={openWorkspacePanel} />}

        {wideWorkspace && resourcesOpen && <aside className="h-full w-[232px] shrink-0 border-r border-gray-200" data-overlay-open="false"><EditorResourceDrawerV7 onClose={closeResources} /></aside>}

        <main className="flex min-h-0 min-w-0 flex-1 overflow-auto bg-[#f3f0ee] p-3 sm:p-4" data-testid="v7-canvas-region">
          <div className="mx-auto flex min-h-full w-full max-w-5xl items-center justify-center">
            <div className="w-full rounded-[28px] border border-white/80 bg-white/55 p-3 shadow-[0_24px_70px_rgba(77,53,67,0.08)] sm:p-5">
              <EditorCanvasHostV7 />
            </div>
          </div>
        </main>

        <EditorWorkspaceSidebarV7 compact={!wideWorkspace} open={workspacePanelOpen} tab={workspacePanelTab} onTabChange={setWorkspacePanelTab} onClose={closeWorkspacePanel} />

        {!wideWorkspace && resourcesOpen && <>
          <button type="button" className="absolute inset-0 z-30 bg-gray-950/20 backdrop-blur-[1px]" aria-label="关闭资源" onClick={closeResources} />
          <aside ref={resourceDialogRef} role="dialog" aria-modal="true" aria-label="资源与预设" onKeyDown={trapResourceFocus} className="absolute inset-x-0 bottom-0 z-40 max-h-[70dvh] min-h-[320px] overflow-hidden rounded-t-2xl border border-gray-200 bg-white shadow-modal md:inset-y-0 md:left-16 md:right-auto md:h-full md:max-h-none md:w-[280px] md:rounded-none" data-overlay-open="true">
            <EditorResourceDrawerV7 onClose={closeResources} />
          </aside>
        </>}
      </div>

      {dockedTools && <EditorToolRailV7 orientation="horizontal" resourcesOpen={resourcesOpen} onOpenResources={openResources} onToggleResources={toggleResources} onOpenPanel={openWorkspacePanel} />}

      <TenFingerBarV7 />
    </section>
  );
}
