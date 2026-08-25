/**
 * `/studio/design/canvas` Studio Editor 页面（模块 4）
 *
 * 进入方式（PRD §13.1）：
 *  ① ?bridge=<designId>  —— Wizard 桥接：先完整展示不可逆警告（§15.3），确认后进入画布；
 *  ② ?blank=1            —— 空白新建：选甲型/长度 → 空白画布；
 *  ③ ?design=<designId>  —— 设计列表 [继续编辑] / 只读查看。
 */

import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import { Button, cx, EmptyState, Modal } from '@/design-system';
import { Routes } from '@/app/routes';
import { useLocale } from '@/lib/i18n';
import { BRIDGE_WARNING_LINES, BRIDGE_WARNING_TITLE } from '@/studio/bridge';
import {
  compatibilityLabel,
  compatibilityTitle,
  compatibilityToneClass,
  getShapeLengthCompatibility,
} from '@/studio/compatibility';
import { EditorShellV6 } from '@/studio/editor/components/EditorShellV6';
import { EditorShellV7 } from '@/studio/editor/components/EditorShellV7';
import { createBlankEditorDesignV6, getDesign, inspectEditorDoc } from '@/studio/editor/lib/repo-v6';
import { createBlankEditorDesignV7 } from '@/studio/editor/lib/repo-v7';
import { useEditorV6Store } from '@/studio/editor/store-v6';
import { editorV7Store } from '@/studio/editor/store-v7';
import { isEditorV7InternalEnabled, resolveEditorWriterRoute } from '@/studio/editor/v7/feature';
import {
  isEditorShapeEnabled,
  LENGTHS,
  lengthName,
  shapeName,
  TIER_ONE_EDITOR_SHAPES,
} from '@/studio/editor/lib/material';
import { FINGER_CODES, type FingerCode, type NailLength, type NailShape } from '@/lib/types';
import type { FrenchUseContextV1 } from '@/integration/community-studio/french-use-context-v1';
import { frenchUseContextMatchesTargetV1 } from '@/integration/community-studio/french-use-context-v1';
import { frenchUseContextPortV1 } from '@/integration/community-studio/french-use-context-local';

type PageState =
  | { kind: 'loading' }
  | { kind: 'bridge-warning'; designId: string }
  | { kind: 'blank-picker' }
  | { kind: 'ready'; writer: 'v6' | 'v7'; internalEnabled?: boolean; frenchUseContext?: FrenchUseContextV1 | null }
  | { kind: 'missing' }
  | { kind: 'save-error'; designId: string }
  | { kind: 'invalid'; unsupported?: boolean };

type EditorLoadResult = 'ok' | 'missing' | 'invalid' | 'unsupported' | 'save_error';

function editorPageStateForLoadResult(result: EditorLoadResult, designId: string): PageState {
  if (result === 'ok') return { kind: 'ready', writer: 'v6' };
  if (result === 'invalid') return { kind: 'invalid' };
  if (result === 'unsupported') return { kind: 'invalid', unsupported: true };
  if (result === 'save_error') return { kind: 'save-error', designId };
  return { kind: 'missing' };
}

export default function EditorPage() {
  const { locale, legacyLocale, t } = useLocale();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const loadV6 = useEditorV6Store((s) => s.load);
  const unloadV6 = useEditorV6Store((s) => s.unload);
  const v7Enabled = isEditorV7InternalEnabled();

  const [state, setState] = useState<PageState>({ kind: 'loading' });
  const [blankShape, setBlankShape] = useState<NailShape>('almond');
  const [blankLength, setBlankLength] = useState<NailLength>('medium');

  useEffect(() => {
    // Immersive workspace must not inherit the document scroll position from
    // Community/Wizard during SPA navigation, otherwise its header is clipped.
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, []);

  const loadPersistedDesign = async (designId: string): Promise<PageState> => {
    const probe = inspectEditorDoc(designId);
    const route = resolveEditorWriterRoute(probe, v7Enabled);
    if (route === 'v7-edit' || route === 'v7-readonly') {
      if (unloadV6() === 'error') return { kind: 'save-error', designId };
      const summary = getDesign(designId);
      const readOnly = route === 'v7-readonly' || summary?.status !== 'draft';
      const result = await editorV7Store.getState().load(designId, { readOnly });
      if (result === 'ok' || result === 'ok_with_warnings') {
        const requestedFinger = params.get('finger');
        const finger: FingerCode | null = FINGER_CODES.includes(requestedFinger as FingerCode)
          ? requestedFinger as FingerCode
          : null;
        if (finger) editorV7Store.getState().setCurrentFinger(finger);
        const requestedStep = params.get('step');
        const currentState = editorV7Store.getState();
        const currentNail = currentState.doc?.nails[currentState.currentFinger];
        if (requestedStep && currentNail?.steps.some((step) => step.id === requestedStep)) currentState.selectStep(requestedStep);
        const loadedDoc = editorV7Store.getState().doc;
        const frenchUseContextId = params.get('frenchUseContext');
        const candidate = frenchUseContextId ? frenchUseContextPortV1.peek(frenchUseContextId) : null;
        const frenchUseContext = candidate && loadedDoc && frenchUseContextMatchesTargetV1(candidate, loadedDoc)
          ? candidate
          : null;
        return { kind: 'ready', writer: 'v7', internalEnabled: v7Enabled, frenchUseContext };
      }
      if (result === 'missing') return { kind: 'missing' };
      if (result === 'save_error' || result === 'busy') return { kind: 'save-error', designId };
      return { kind: 'invalid', unsupported: result === 'unsupported' };
    }
    if (route === 'recovery') {
      const schemaVersion = probe.present ? probe.schemaVersion : null;
      return { kind: 'invalid', unsupported: (schemaVersion ?? 0) > 7 };
    }
    const unloadedV7 = await editorV7Store.getState().unload();
    if (unloadedV7 === 'error') return { kind: 'save-error', designId };
    return editorPageStateForLoadResult(loadV6(designId), designId);
  };

  useEffect(() => {
    const bridgeId = params.get('bridge');
    const designId = params.get('design');
    const blank = params.get('blank');

    if (bridgeId) {
      // 桥接：不可逆警告完整展示后才可进入（数据转化已在 openBridge 内完成）
      setState({ kind: 'bridge-warning', designId: bridgeId });
      return;
    }
    if (blank === '1') {
      setState({ kind: 'blank-picker' });
      return;
    }
    if (designId) {
      let cancelled = false;
      void loadPersistedDesign(designId).then((next) => {
        if (!cancelled) setState(next);
      });
      return () => { cancelled = true; };
    }
    setState({ kind: 'missing' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  useEffect(() => () => {
    unloadV6();
  }, [unloadV6]);

  const acknowledgeBridge = (designId: string) => {
    // The bridge has already persisted the exact document version. Route back
    // through the version-neutral loader instead of assuming the V6 writer.
    setState({ kind: 'loading' });
    setParams({ design: designId }, { replace: true });
  };

  const createBlank = async () => {
    try {
      if (v7Enabled) {
        const id = createBlankEditorDesignV7({ shape: blankShape, length: blankLength });
        const result = await editorV7Store.getState().load(id);
        if (result === 'ok' || result === 'ok_with_warnings') {
          setParams({ design: id }, { replace: true });
          setState({ kind: 'ready', writer: 'v7', internalEnabled: true });
        } else {
          setState(result === 'missing' ? { kind: 'missing' } : { kind: 'save-error', designId: id });
        }
        return;
      }
      const id = createBlankEditorDesignV6({ shape: blankShape, length: blankLength });
      const result = loadV6(id);
      if (result === 'ok') {
        setParams({ design: id }, { replace: true });
        setState({ kind: 'ready', writer: 'v6' });
      } else {
        setState(editorPageStateForLoadResult(result, id));
      }
    } catch {
      setState({ kind: 'save-error', designId: '' });
    }
  };

  if (state.kind === 'ready') {
    return state.writer === 'v7'
      ? <EditorShellV7 internalEnabled={state.internalEnabled ?? false} frenchUseContext={state.frenchUseContext ?? null} />
      : <EditorShellV6 />;
  }

  return (
    <div className="flex flex-col gap-4">
      <header>
        <h1 className="text-lg font-semibold text-gray-900">{t('editor.pageTitle')}</h1>
        <p className="mt-0.5 text-xs text-gray-500">{t('editor.pageDescription')}</p>
      </header>

      {(state.kind === 'missing' || state.kind === 'loading') && (
        <EmptyState
          title={state.kind === 'loading' ? t('editor.canvasLoading') : t('editor.designMissing')}
          description={
            state.kind === 'missing'
              ? t('editor.designMissingDescription')
              : undefined
          }
          action={
            state.kind === 'missing' ? (
              <div className="flex gap-2">
                <Button size="sm" variant="secondary" onClick={() => navigate(Routes.designs)}>
                  {t('design.backToList')}
                </Button>
                <Button size="sm" onClick={() => setState({ kind: 'blank-picker' })}>
                  {t('editor.blankCanvasCreate')}
                </Button>
              </div>
            ) : undefined
          }
          className="min-h-[320px]"
        />
      )}
      {state.kind === 'invalid' && (
        <EmptyState
          title={state.unsupported ? t('editor.higherVersion') : t('editor.dataUnreadable')}
          description={
            state.unsupported
              ? t('editor.higherVersionDescription')
              : t('editor.dataUnreadableDescription')
          }
          action={
            <Button size="sm" variant="secondary" onClick={() => navigate(Routes.designs)}>
              {t('design.backToList')}
            </Button>
          }
          className="min-h-[320px]"
        />
      )}
      {state.kind === 'save-error' && (
        <EmptyState
          title={t('editor.saveError')}
          description={t('editor.saveErrorDescription')}
          action={
            <div className="flex gap-2">
              <Button size="sm" variant="secondary" onClick={() => navigate(Routes.designs)}>
                {t('design.backToList')}
              </Button>
              {state.designId && (
                <Button
                  size="sm"
                  onClick={() => void loadPersistedDesign(state.designId).then(setState)}
                >
                  {t('editor.retryOpen')}
                </Button>
              )}
            </div>
          }
          className="min-h-[320px]"
        />
      )}

      {/* ① 桥接不可逆警告（PRD §15.3：完整展示后才可进入） */}
      <Modal
        open={state.kind === 'bridge-warning'}
        onClose={() => navigate(Routes.designs)}
        title={t('editor.openFreeCanvas')}
        closeOnOverlay={false}
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => navigate(Routes.designs)}>
              {t('editor.cancelBackToList')}
            </Button>
            <Button
              size="sm"
              onClick={() => state.kind === 'bridge-warning' && acknowledgeBridge(state.designId)}
            >
              {t('editor.acknowledgeOpenCanvas')}
            </Button>
          </>
        }
      >
        <div className="flex items-start gap-2">
          <AlertTriangle size={18} className="mt-0.5 shrink-0 text-warning" />
          <div>
            <p className="text-sm font-medium text-gray-800">{BRIDGE_WARNING_TITLE}</p>
            <ul className="mt-2 flex flex-col gap-1.5">
              {BRIDGE_WARNING_LINES.map((line) => (
                <li key={line} className="flex gap-1.5 text-sm text-gray-600">
                  <span className="text-gray-400">·</span>
                  {line}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Modal>

      {/* ② 空白新建：选甲型/长度 */}
      <Modal
        open={state.kind === 'blank-picker'}
        onClose={() => navigate(Routes.designs)}
        title={t('editor.blankCanvasCreate')}
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => navigate(Routes.designs)}>
              {t('common.cancel')}
            </Button>
            <Button size="sm" onClick={() => void createBlank()}>
              {t('editor.createBlankCanvas')}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <div>
            <p className="mb-1.5 text-xs font-medium text-gray-700">{t('shape.title')}</p>
            <div className="grid grid-cols-3 gap-1.5">
              {TIER_ONE_EDITOR_SHAPES.map((capability) => {
                const enabled = isEditorShapeEnabled(capability);
                const selected = blankShape === capability.id;
                const compatibility = getShapeLengthCompatibility(capability.id, blankLength);
                const hint = compatibilityTitle(compatibility, legacyLocale);
                const badge = compatibilityLabel(compatibility, legacyLocale);
                return (
                  <button
                    key={capability.id}
                    disabled={!enabled}
                    onClick={() => setBlankShape(capability.id)}
                    title={enabled ? hint || shapeName(capability.id, locale) : `${shapeName(capability.id, locale)} · Pending geometry sign-off`}
                    data-shape-id={capability.id}
                    data-editor-enabled={enabled}
                    data-compatibility={enabled ? compatibility.severity : undefined}
                    className={cx(
                      'rounded-button border px-2 py-1.5 text-xs',
                      selected
                        ? 'border-primary bg-primary-soft text-primary'
                        : 'border-gray-200 text-gray-600 hover:bg-gray-50',
                      enabled && compatibilityToneClass(compatibility, selected),
                      !enabled && 'cursor-not-allowed bg-gray-50 opacity-45',
                    )}
                  >
                    <span>{shapeName(capability.id, locale)}</span>
                    {enabled && !selected && badge && (
                      <span aria-hidden="true" className="ml-1 text-nano opacity-75">{badge}</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <p className="mb-1.5 text-xs font-medium text-gray-700">{t('length.title')}</p>
            <div className="grid grid-cols-4 gap-1.5">
              {LENGTHS.map((l) => {
                const selected = blankLength === l;
                const compatibility = getShapeLengthCompatibility(blankShape, l);
                const hint = compatibilityTitle(compatibility, legacyLocale);
                const badge = compatibilityLabel(compatibility, legacyLocale);
                return (
                  <button
                    key={l}
                    onClick={() => setBlankLength(l)}
                    title={hint || undefined}
                    data-compatibility={compatibility.severity}
                    className={cx(
                      'rounded-button border px-2 py-1.5 text-xs',
                      selected
                        ? 'border-primary bg-primary-soft text-primary'
                        : 'border-gray-200 text-gray-600 hover:bg-gray-50',
                      compatibilityToneClass(compatibility, selected),
                    )}
                  >
                    {lengthName(l, locale)}
                    {!selected && badge && <span aria-hidden="true" className="ml-1 text-nano opacity-75">{badge}</span>}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
