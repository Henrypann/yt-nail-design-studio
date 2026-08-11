import { useCallback, useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { useBlocker, useNavigate } from 'react-router-dom';
import { AlertCircle, ArrowLeft, Redo2, Save, ShieldAlert, Undo2, UserRound } from 'lucide-react';
import { Button, cx, useToast } from '@/design-system';
import { Routes } from '@/app/routes';
import { communityProductHref } from '@/app/product-navigation';
import { editorV7Store, selectCurrentNailV7, selectCurrentStepV7, useEditorV7Store } from '../store-v7';
import { EditorCanvasHostV7 } from './EditorCanvasHostV7';
import { EditorGuidedStartV7 } from './EditorGuidedStartV7';
import { EditorResourceDrawerV7 } from './EditorResourceDrawerV7';
import { EditorStageBarV7 } from './EditorStageBarV7';
import { EditorStageContextNoticeV7 } from './EditorStageContextNoticeV7';
import { EditorToolRailV7 } from './EditorToolRailV7';
import { EditorWorkspaceIntentNoticeV7 } from './EditorWorkspaceIntentNoticeV7';
import { EditorWorkspaceSidebarV7, type EditorWorkspacePanelTabV7 } from './EditorWorkspaceSidebarV7';
import { captureCustomerPreviewSessionV7 } from '../v7/customer-preview-session';
import { TenFingerBarV7 } from './TenFingerBarV7';
import {
  deriveEditorWorkspaceToolsV7,
  type EditorWorkspaceToolAvailabilityV7,
  type EditorWorkspaceToolIdV7,
} from '../v7/workspace-ia';
import type { EditorWorkspacePersonalStepKindV7 } from '../v7/workspace-step-factory';
import { matchProductSilhouetteRefV7, resolveBackgroundSilhouetteV7 } from '../v7/background';

const SAVE_LABEL = {
  saved: '已保存',
  dirty: '有未保存更改',
  saving: '正在保存…',
  error: '保存失败，可重试',
} as const;

const FOCUSABLE_SELECTOR = 'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

function customerPreviewAvailabilityV7(
  saveState: 'saved' | 'dirty' | 'saving' | 'error',
  switching: boolean,
): { enabled: boolean; description: string } {
  if (switching) return { enabled: false, description: '正在安全切换设计' };
  if (saveState === 'dirty') return { enabled: false, description: '请先保存当前更改' };
  if (saveState === 'saving') return { enabled: false, description: '正在保存，完成后可预览' };
  if (saveState === 'error') return { enabled: false, description: '保存失败，请重试后再预览' };
  return { enabled: true, description: '只读预览已可用 · 确认 Snapshot 待 V7-16' };
}

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
  const currentFinger = useEditorV7Store((state) => state.currentFinger);
  const setTitle = useEditorV7Store((state) => state.setTitle);
  const undo = useEditorV7Store((state) => state.undo);
  const redo = useEditorV7Store((state) => state.redo);
  const save = useEditorV7Store((state) => state.save);
  const unload = useEditorV7Store((state) => state.unload);
  const addMissingPersonalStep = useEditorV7Store((state) => state.addMissingPersonalStep);
  const setStepFlag = useEditorV7Store((state) => state.setStepFlag);
  const [titleDraft, setTitleDraft] = useState(doc?.title ?? '');
  const [leaving, setLeaving] = useState(false);
  const [resourcesOpen, setResourcesOpen] = useState(false);
  const [workspacePanelOpen, setWorkspacePanelOpen] = useState(false);
  const [workspacePanelTab, setWorkspacePanelTab] = useState<EditorWorkspacePanelTabV7>('layers');
  const [wideWorkspace, setWideWorkspace] = useState(() => window.matchMedia('(min-width: 1280px)').matches);
  const [dockedTools, setDockedTools] = useState(() => window.matchMedia('(max-width: 1023px)').matches);
  const [mobileWorkspace, setMobileWorkspace] = useState(() => window.matchMedia('(max-width: 767px)').matches);
  const [pendingToolIntent, setPendingToolIntent] = useState<EditorWorkspaceToolAvailabilityV7 | null>(null);
  const [stageContext, setStageContext] = useState<'geometry' | 'customer' | null>(null);
  const [dismissedGuides, setDismissedGuides] = useState<Set<string>>(() => new Set());
  const resourceDialogRef = useRef<HTMLDivElement>(null);
  const overlayTriggerRef = useRef<HTMLElement | null>(null);
  const toolIntentTriggerRef = useRef<HTMLElement | null>(null);
  const stageContextTriggerRef = useRef<HTMLButtonElement | null>(null);
  const guidedStartRef = useRef<HTMLButtonElement>(null);
  const guideFocusRequestedRef = useRef(false);
  const customerPreviewAvailability = customerPreviewAvailabilityV7(saveState, switching);

  useEffect(() => {
    setTitleDraft(doc?.title ?? '');
  }, [doc?.designId, doc?.title]);

  useEffect(() => {
    setPendingToolIntent(null);
    toolIntentTriggerRef.current = null;
    guideFocusRequestedRef.current = false;
  }, [currentFinger, doc?.designId]);

  useEffect(() => {
    setStageContext(null);
    stageContextTriggerRef.current = null;
  }, [doc?.designId]);

  useEffect(() => {
    if (!guideFocusRequestedRef.current) return;
    const key = `${doc?.designId ?? ''}:${currentFinger}`;
    if (dismissedGuides.has(key)) return;
    const frame = window.requestAnimationFrame(() => {
      if (!guidedStartRef.current) return;
      guidedStartRef.current.focus();
      guideFocusRequestedRef.current = false;
    });
    return () => window.cancelAnimationFrame(frame);
  }, [currentFinger, dismissedGuides, doc?.designId]);

  useEffect(() => {
    if (!pendingToolIntent || !currentNail) return;
    const refreshed = deriveEditorWorkspaceToolsV7(currentNail, {
      selectedStepId: selectedStep?.id ?? null,
      readOnly,
      switching,
    }).find((tool) => tool.id === pendingToolIntent.id) ?? null;
    if (!refreshed) {
      setPendingToolIntent(null);
      return;
    }
    if (refreshed.enabled) {
      const trigger = toolIntentTriggerRef.current;
      toolIntentTriggerRef.current = null;
      setPendingToolIntent(null);
      queueMicrotask(() => trigger?.isConnected && trigger.focus());
      return;
    }
    if (
      refreshed.status !== pendingToolIntent.status
      || refreshed.targetStepId !== pendingToolIntent.targetStepId
      || refreshed.requiredStepKind !== pendingToolIntent.requiredStepKind
      || refreshed.reason !== pendingToolIntent.reason
    ) setPendingToolIntent(refreshed);
  }, [currentNail, pendingToolIntent, readOnly, selectedStep?.id, switching]);

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
      if (destination === Routes.community || destination.startsWith('/look/')) {
        window.location.assign(communityProductHref(destination));
      } else {
        navigate(destination);
      }
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

  const rememberOverlayTrigger = (trigger?: HTMLElement | null) => {
    overlayTriggerRef.current = trigger
      ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null);
  };
  const restoreOverlayTrigger = () => {
    const trigger = overlayTriggerRef.current;
    overlayTriggerRef.current = null;
    queueMicrotask(() => {
      if (trigger?.isConnected) trigger.focus();
      else document.querySelector<HTMLElement>('[data-tool-status="ready"][aria-pressed="true"]')?.focus();
    });
  };
  const openResources = (trigger?: HTMLElement | null) => {
    rememberOverlayTrigger(trigger);
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
  const openWorkspacePanel = (tab: EditorWorkspacePanelTabV7, trigger?: HTMLElement | null) => {
    rememberOverlayTrigger(trigger);
    setResourcesOpen(false);
    setWorkspacePanelTab(tab);
    if (!wideWorkspace) setWorkspacePanelOpen(true);
  };
  const closeWorkspacePanel = () => {
    setWorkspacePanelOpen(false);
    restoreOverlayTrigger();
  };
  const closeStageContext = () => {
    const trigger = stageContextTriggerRef.current;
    stageContextTriggerRef.current = null;
    setStageContext(null);
    queueMicrotask(() => trigger?.isConnected && trigger.focus());
  };

  useEffect(() => {
    // A dirty/saving/error explanation must not remain on screen after a save
    // transition makes preview available. Close it and restore the Stage
    // trigger so title and body never contradict the current availability.
    if (stageContext === 'customer' && customerPreviewAvailability.enabled) closeStageContext();
  }, [customerPreviewAvailability.enabled, stageContext]);

  useEffect(() => {
    if (wideWorkspace || !resourcesOpen) return;
    resourceDialogRef.current?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR)?.focus();
  }, [resourcesOpen, wideWorkspace]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target;
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) return;
      if (event.key === 'Escape') {
        if (pendingToolIntent) {
          event.preventDefault();
          const trigger = toolIntentTriggerRef.current;
          toolIntentTriggerRef.current = null;
          setPendingToolIntent(null);
          queueMicrotask(() => trigger?.isConnected && trigger.focus());
        } else if (stageContext) {
          event.preventDefault();
          closeStageContext();
        } else if (workspacePanelOpen) {
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
  }, [pendingToolIntent, redo, resourcesOpen, stageContext, undo, workspacePanelOpen]);

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

  const openGeometryContext = (trigger: HTMLButtonElement) => {
    stageContextTriggerRef.current = trigger;
    setStageContext('geometry');
  };
  const openCustomerPreview = (trigger: HTMLButtonElement) => {
    if (!customerPreviewAvailability.enabled) {
      stageContextTriggerRef.current = trigger;
      setStageContext('customer');
      return;
    }
    setStageContext(null);
    stageContextTriggerRef.current = null;
    captureCustomerPreviewSessionV7(doc);
    navigate(`${Routes.designCustomerPreview}?design=${encodeURIComponent(doc.designId)}&finger=${encodeURIComponent(currentFinger)}`);
  };

  const selectStageStep = (stepId: string) => {
    if (stageContext) {
      stageContextTriggerRef.current = null;
      setStageContext(null);
    }
    if (selectedStep?.id !== stepId) editorV7Store.getState().selectStep(stepId);
  };

  const guideKey = `${doc.designId}:${currentFinger}`;
  const resolveWorkspaceTool = (toolId: EditorWorkspaceToolIdV7): EditorWorkspaceToolAvailabilityV7 | null => {
    const state = editorV7Store.getState();
    const nail = state.doc?.nails[state.currentFinger];
    if (!nail) return null;
    return deriveEditorWorkspaceToolsV7(nail, {
      selectedStepId: state.selectedStepId,
      readOnly: state.readOnly,
      switching: state.switching,
    }).find((tool) => tool.id === toolId) ?? null;
  };
  const focusToolDestination = (toolId: EditorWorkspaceToolIdV7) => {
    window.setTimeout(() => {
      const panelSelector = toolId === 'effects'
        ? '[data-testid="v7-surface-effect-panel"]'
        : toolId === 'decorations'
          ? '[data-testid="v7-dimensional-decoration-panel"]'
          : toolId === 'text'
            ? '[data-testid="v7-flat-text-resources"]'
            : toolId === 'assets'
              ? '[data-testid="v7-flat-asset-resources"]'
              : toolId === 'background'
                ? '[data-testid="v7-background-panel"]'
                : '[data-testid="v7-flat-vector-panel"]';
      const panel = document.querySelector<HTMLElement>(panelSelector);
      const destination = panel?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR)
        ?? Array.from(document.querySelectorAll<HTMLButtonElement>(`[data-tool-id="${toolId}"]`))
          .find((button) => button.getClientRects().length > 0);
      destination?.focus();
    }, 0);
  };
  const activateWorkspaceTool = (
    tool: EditorWorkspaceToolAvailabilityV7,
    trigger?: HTMLElement | null,
    focusDestination = false,
  ) => {
    const state = editorV7Store.getState();
    if (tool.targetStepId) state.selectStep(tool.targetStepId);
    if (tool.id === 'select') state.setActiveFlatTool('select');
    if (tool.id === 'brush') state.setActiveFlatTool('brush');
    if (tool.id === 'eraser') state.setActiveFlatTool('eraser');
    if (tool.id === 'shape') state.setActiveFlatTool('rectangle');
    if (tool.id === 'text') {
      state.setResourceMode('text');
      openResources(trigger);
    } else if (tool.id === 'assets') {
      state.setResourceMode('assets');
      openResources(trigger);
    } else if (tool.id === 'effects' || tool.id === 'decorations') {
      openWorkspacePanel('inspector', trigger);
    } else if (tool.id === 'background' || tool.id === 'brush' || tool.id === 'eraser' || tool.id === 'shape') {
      state.setResourceMode('vector');
      openResources(trigger);
    }
    if (focusDestination) focusToolDestination(tool.id);
  };
  const requestWorkspaceTool = (tool: EditorWorkspaceToolAvailabilityV7, trigger: HTMLButtonElement) => {
    const currentTool = resolveWorkspaceTool(tool.id) ?? tool;
    if (currentTool.enabled) {
      activateWorkspaceTool(currentTool, trigger);
      return;
    }
    toolIntentTriggerRef.current = trigger;
    setPendingToolIntent(currentTool);
  };
  const dismissWorkspaceIntent = () => {
    const trigger = toolIntentTriggerRef.current;
    toolIntentTriggerRef.current = null;
    setPendingToolIntent(null);
    queueMicrotask(() => trigger?.isConnected && trigger.focus());
  };
  const resolveWorkspaceIntent = () => {
    const intent = pendingToolIntent;
    if (!intent) return;
    let result;
    if (intent.status === 'missing_step') {
      if (
        intent.requiredStepKind !== 'flat_design'
        && intent.requiredStepKind !== 'surface_effect'
        && intent.requiredStepKind !== 'dimensional_decoration'
      ) return;
      result = addMissingPersonalStep(currentFinger, intent.requiredStepKind);
    } else if (intent.targetStepId && intent.status === 'locked') {
      result = setStepFlag(currentFinger, intent.targetStepId, 'locked', false);
    } else if (intent.targetStepId && intent.status === 'skipped') {
      result = setStepFlag(currentFinger, intent.targetStepId, 'skipped', false);
    } else if (intent.targetStepId && intent.status === 'hidden') {
      result = setStepFlag(currentFinger, intent.targetStepId, 'visible', true);
    } else {
      return;
    }
    const refreshed = resolveWorkspaceTool(intent.id);
    if (refreshed?.enabled) {
      const trigger = toolIntentTriggerRef.current;
      toolIntentTriggerRef.current = null;
      setPendingToolIntent(null);
      activateWorkspaceTool(refreshed, trigger, true);
      return;
    }
    if (refreshed) setPendingToolIntent(refreshed);
    if (!result.ok && !refreshed?.enabled) toast.error(result.message);
  };
  const requestGuidedStart = (
    _kind: EditorWorkspacePersonalStepKindV7,
    toolId: EditorWorkspaceToolIdV7,
    trigger: HTMLButtonElement,
  ) => {
    const tool = resolveWorkspaceTool(toolId);
    if (tool) requestWorkspaceTool(tool, trigger);
  };
  const showPersonalizationGuide = () => {
    if (guidedStartRef.current) {
      guidedStartRef.current.focus();
      return;
    }
    guideFocusRequestedRef.current = true;
    setDismissedGuides((current) => {
      if (!current.has(guideKey)) return current;
      const next = new Set(current);
      next.delete(guideKey);
      return next;
    });
  };
  const previewFinishWithoutPersonalization = () => {
    setDismissedGuides((current) => new Set(current).add(guideKey));
    const finish = currentNail.steps.find((step) => step.kind === 'surface_finish');
    if (finish) selectStageStep(finish.id);
    window.setTimeout(() => document.querySelector<HTMLButtonElement>('[data-stage-id="finish"]')?.focus(), 0);
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
  const showGuidedStart = !dismissedGuides.has(guideKey) && !currentNail.steps.some((step) => (
    step.kind === 'flat_design' || step.kind === 'surface_effect' || step.kind === 'dimensional_decoration'
  ));
  const geometrySilhouette = resolveBackgroundSilhouetteV7(currentNail.geometryRef);
  const productGeometry = matchProductSilhouetteRefV7(currentNail.geometryRef);

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
            onClick={(event) => openCustomerPreview(event.currentTarget)}
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

      <EditorStageBarV7
        nail={currentNail}
        selectedStepId={selectedStep?.id ?? null}
        onSelectStep={selectStageStep}
        onOpenGeometry={openGeometryContext}
        onRequestPersonalization={showPersonalizationGuide}
        onOpenCustomerPreview={openCustomerPreview}
        customerPreviewEnabled={customerPreviewAvailability.enabled}
        customerPreviewReason={customerPreviewAvailability.description}
        expandedContext={stageContext}
      />

      {stageContext === 'geometry' && (
        <EditorStageContextNoticeV7
          context="geometry"
          source={geometrySilhouette.source}
          title={`${currentFinger} · ${geometrySilhouette.label}`}
          description={geometrySilhouette.source === 'product'
            ? '当前设计按产品甲型轮廓裁剪预览。甲型与长度由 Wizard / DesignVersion 的 geometryRef 绑定，Editor 不在此重写。'
            : '当前未解析到正式产品几何，预览使用通用轮廓；原 geometryRef 保持不变，正式绑定留给 V7-15。'}
          details={[
            { label: '指位', value: currentFinger },
            ...(productGeometry ? [
              { label: '甲型 / 长度', value: `${productGeometry.shape} / ${productGeometry.length}` },
            ] : []),
            { label: '几何引用', value: `${currentNail.geometryRef.assetId} @ ${currentNail.geometryRef.revision}` },
          ]}
          disclaimer="这是结构化预览映射，不代表扫描、贴合、物理或制造验证。"
          onDismiss={closeStageContext}
        />
      )}

      {stageContext === 'customer' && (
        <EditorStageContextNoticeV7
          context="customer"
          title="顾客只读预览尚不可进入"
          description={customerPreviewAvailability.description}
          details={[
            { label: '当前设计', value: doc.designId },
            { label: '修订', value: String(doc.revision) },
            { label: '起始指位', value: currentFinger },
          ]}
          disclaimer="预览只读且不生成 ConfirmationSnapshot；保存成功后再次激活该阶段。"
          onDismiss={closeStageContext}
        />
      )}

      {pendingToolIntent && <EditorWorkspaceIntentNoticeV7 intent={pendingToolIntent} onResolve={resolveWorkspaceIntent} onDismiss={dismissWorkspaceIntent} />}

      <div className="relative flex min-h-0 min-w-0 flex-1 overflow-hidden">
        {!dockedTools && <EditorToolRailV7 orientation="vertical" resourcesOpen={resourcesOpen} onToggleResources={toggleResources} onOpenPanel={openWorkspacePanel} onActivateTool={requestWorkspaceTool} onBlockedTool={requestWorkspaceTool} />}

        {wideWorkspace && resourcesOpen && <aside className="h-full w-[232px] shrink-0 border-r border-gray-200" data-overlay-open="false"><EditorResourceDrawerV7 onClose={closeResources} /></aside>}

        <main className="flex min-h-0 min-w-0 flex-1 overflow-auto bg-[#f3f0ee] p-3 sm:p-4" data-testid="v7-canvas-region">
          <div className={cx('mx-auto flex min-h-full w-full max-w-5xl justify-center', showGuidedStart ? 'items-start' : 'items-center')}>
            <div className="w-full">
              {showGuidedStart && <EditorGuidedStartV7 ref={guidedStartRef} nail={currentNail} onRequest={requestGuidedStart} onPreviewFinish={previewFinishWithoutPersonalization} />}
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

      {dockedTools && <EditorToolRailV7 orientation="horizontal" resourcesOpen={resourcesOpen} onToggleResources={toggleResources} onOpenPanel={openWorkspacePanel} onActivateTool={requestWorkspaceTool} onBlockedTool={requestWorkspaceTool} />}

      <TenFingerBarV7 />
    </section>
  );
}
