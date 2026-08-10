import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useBlocker, useNavigate } from 'react-router-dom';
import { AlertCircle, ArrowLeft, Redo2, Save, ShieldAlert, Undo2, Workflow } from 'lucide-react';
import { Button, cx, useToast } from '@/design-system';
import { Routes } from '@/app/routes';
import { FINGER_CODES } from '@/lib/types';
import { editorV7Store, selectCurrentNailV7, selectCurrentStepV7, useEditorV7Store } from '../store-v7';
import { LayerPanelV7 } from './LayerPanelV7';
import { V7BackgroundCanvas } from './V7BackgroundCanvas';
import { V7FlatDesignCanvas } from './V7FlatDesignCanvas';

const SAVE_LABEL = {
  saved: '已保存',
  dirty: '有未保存更改',
  saving: '正在保存…',
  error: '保存失败，可重试',
} as const;

const STEP_TONE = {
  background: 'bg-rose-100 text-rose-700',
  flat_design: 'bg-violet-100 text-violet-700',
  surface_effect: 'bg-sky-100 text-sky-700',
  dimensional_decoration: 'bg-amber-100 text-amber-800',
  surface_finish: 'bg-slate-200 text-slate-700',
} as const;

export function EditorShellV7({ internalEnabled }: { internalEnabled: boolean }) {
  const navigate = useNavigate();
  const toast = useToast();
  const doc = useEditorV7Store((state) => state.doc);
  const readOnly = useEditorV7Store((state) => state.readOnly);
  const switching = useEditorV7Store((state) => state.switching);
  const currentFinger = useEditorV7Store((state) => state.currentFinger);
  const currentNail = useEditorV7Store(selectCurrentNailV7);
  const selectedStep = useEditorV7Store(selectCurrentStepV7);
  const saveState = useEditorV7Store((state) => state.saveState);
  const saveError = useEditorV7Store((state) => state.saveError);
  const historyCount = useEditorV7Store((state) => state.history.length);
  const futureCount = useEditorV7Store((state) => state.future.length);
  const setTitle = useEditorV7Store((state) => state.setTitle);
  const setCurrentFinger = useEditorV7Store((state) => state.setCurrentFinger);
  const undo = useEditorV7Store((state) => state.undo);
  const redo = useEditorV7Store((state) => state.redo);
  const save = useEditorV7Store((state) => state.save);
  const unload = useEditorV7Store((state) => state.unload);
  const [titleDraft, setTitleDraft] = useState(doc?.title ?? '');
  const [leaving, setLeaving] = useState(false);
  const processScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => setTitleDraft(doc?.title ?? ''), [doc?.designId, doc?.title]);
  useEffect(() => processScrollRef.current?.scrollTo({ left: 0 }), [currentFinger]);

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

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target;
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) return;
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== 'z') return;
      event.preventDefault();
      if (event.shiftKey) redo();
      else undo();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [redo, undo]);

  const processSummary = useMemo(() => {
    if (!currentNail) return [];
    return currentNail.steps.filter((step) => step.visible && !step.skipped);
  }, [currentNail]);

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

  return (
    <section
      className="flex min-h-[calc(100vh-8rem)] min-w-0 flex-col overflow-hidden rounded-card border border-gray-200 bg-white lg:h-[calc(100vh-8.5rem)] lg:min-h-[640px]"
      data-debug-id="studio.editor.shell-v7"
      data-editor-schema="7"
      data-internal-editor-v7={internalEnabled}
    >
      <header className="flex flex-wrap items-center gap-2 border-b border-gray-200 px-2 py-2 sm:px-3">
        <Button size="sm" variant="ghost" disabled={leaving || switching || saveState === 'saving'} loading={leaving} onClick={() => void requestExit()}>
          <ArrowLeft size={14} /> 设计列表
        </Button>
        <span className="rounded-full bg-gray-900 px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-white">Editor V7</span>
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
          className="min-w-[140px] flex-1 rounded-lg border border-transparent bg-transparent px-2 py-1.5 text-sm font-semibold text-gray-900 hover:border-gray-200 focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 disabled:text-gray-600"
        />
        <span
          className={cx('text-[11px]', saveState === 'error' ? 'text-error' : saveState === 'dirty' ? 'text-warning' : 'text-gray-500')}
          role="status"
        >
          {SAVE_LABEL[saveState]}
        </span>
        <Button size="sm" variant="ghost" disabled={readOnly || switching || historyCount === 0} onClick={() => undo()} title="撤销（⌘Z）" aria-label="撤销">
          <Undo2 size={14} />
        </Button>
        <Button size="sm" variant="ghost" disabled={readOnly || switching || futureCount === 0} onClick={() => redo()} title="重做（⇧⌘Z）" aria-label="重做">
          <Redo2 size={14} />
        </Button>
        <Button size="sm" variant={saveState === 'error' ? 'primary' : 'secondary'} disabled={readOnly || switching || saveState === 'saving'} loading={saveState === 'saving'} onClick={() => void saveNow()}>
          <Save size={14} /> {saveState === 'error' ? '重试保存' : '保存'}
        </Button>
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

      <div className="flex min-h-0 min-w-0 flex-1 flex-col lg:h-0 lg:overflow-hidden lg:flex-row">
        <main className="flex min-h-[420px] min-w-0 flex-1 flex-col overflow-auto bg-[#f5f2f0] p-3 sm:p-5 lg:min-h-0">
          <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col justify-center">
            <div className="rounded-[28px] border border-white bg-white/65 p-4 shadow-[0_24px_70px_rgba(77,53,67,0.08)] sm:p-6">
              {selectedStep?.kind === 'flat_design' ? <V7FlatDesignCanvas /> : <V7BackgroundCanvas />}

              <div className="mt-5 border-t border-gray-200/80 pt-4">
                <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-gray-400"><Workflow size={13} />制作顺序</div>
                <div ref={processScrollRef} className="mt-2 flex gap-1.5 overflow-x-auto pb-1" aria-label="当前可见制作步骤预览">
                  {processSummary.map((step, index) => (
                    <div key={step.id} className="flex shrink-0 items-center gap-1.5">
                      <div className={cx('flex min-h-11 min-w-[92px] items-center gap-2 rounded-xl px-3 py-2', STEP_TONE[step.kind], selectedStep?.id === step.id && 'ring-2 ring-primary ring-offset-1')}>
                        <span className="text-[9px] opacity-65">{String(index + 1).padStart(2, '0')}</span>
                        <span className="max-w-[110px] truncate text-[10px] font-semibold">{step.name}</span>
                      </div>
                      {index < processSummary.length - 1 && <span aria-hidden="true" className="text-gray-300">→</span>}
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-3 flex items-start gap-2 rounded-xl border border-dashed border-gray-200 bg-gray-50 px-3 py-2.5 text-[10px] leading-4 text-gray-500">
                <Workflow size={14} className="mt-0.5 shrink-0 text-primary" />
                <p>当前已开放单指完整背景与平面矢量编辑：渐变、整甲猫眼、整甲闪粉、画笔、非破坏橡皮/遮罩、线条、图形、法式与锚点。贴纸、文字、导入、局部效果与 3D 仍未开放。</p>
              </div>
            </div>
          </div>
        </main>

        <aside className="flex min-h-0 w-full shrink-0 flex-col overflow-hidden border-t border-gray-200 bg-white lg:w-[300px] lg:border-l lg:border-t-0 xl:w-[320px]">
          <LayerPanelV7 />
        </aside>
      </div>

      <footer className="overflow-x-auto border-t border-gray-200 bg-white px-3 py-2" aria-label="选择手指">
        <div className="flex min-w-max items-center justify-center gap-1">
          {FINGER_CODES.map((finger) => (
            <button
              key={finger}
              type="button"
              aria-pressed={currentFinger === finger}
              onClick={() => setCurrentFinger(finger)}
              className={cx(
                'min-h-11 min-w-11 rounded-lg border px-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1',
                currentFinger === finger ? 'border-primary bg-primary-soft font-semibold text-primary' : 'border-gray-200 text-gray-600 hover:bg-gray-50',
              )}
            >
              {finger}
            </button>
          ))}
        </div>
      </footer>
    </section>
  );
}
