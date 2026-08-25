import { lazy, Suspense, useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Eye, Grid3X3, Info, RotateCcw, ShieldCheck, Sparkles, X } from 'lucide-react';
import { Button, cx } from '@/design-system';
import { Routes } from '@/app/routes';
import type { FingerCode } from '@/lib/types';
import type { EditorDocV7, RgbaColorV7, SurfaceFinishTypeV7 } from '../v7/model';
import {
  createCustomerPreviewScenarioV7,
  deriveCustomerPreviewSetV7,
  setCustomerPreviewBackgroundV7,
  setCustomerPreviewFinishV7,
} from '../v7/customer-preview';
import { clearCustomerPreviewSessionV7 } from '../v7/customer-preview-session';
import { CustomerNailPreviewV7 } from './CustomerNailPreviewV7';
import { EDITOR_FINGER_IDENTITY_V7, fingerDisplayNameForLocaleV7, fingerHandLabelForLocaleV7, fingerNameForLocaleV7 } from '../v7/finger-identity';
import { FINGER_CODES } from '@/lib/types';
import { NailGrid } from '@/studio/preview/NailGrid';
import { studioApprovalApplicationServiceV1 } from '@/integration/community-studio/backend-runtime';
import { useLocale } from '@/lib/i18n';

const SingleNailPbrPreviewV072 = lazy(() => import('@/studio/rendering/v0-7-2/SingleNailPbrPreviewV072'));

const COLOR_SCENARIOS: Array<{ id: string; message: 'editorV7.preview.colorRose' | 'editorV7.preview.colorMilk' | 'editorV7.preview.colorBerry' | 'editorV7.preview.colorCaramel'; color: RgbaColorV7 }> = [
  { id: 'rose', message: 'editorV7.preview.colorRose', color: { colorSpace: 'srgb', r: 210, g: 112, b: 142, a: 1 } },
  { id: 'milk', message: 'editorV7.preview.colorMilk', color: { colorSpace: 'srgb', r: 249, g: 241, b: 231, a: 1 } },
  { id: 'berry', message: 'editorV7.preview.colorBerry', color: { colorSpace: 'srgb', r: 161, g: 34, b: 74, a: 1 } },
  { id: 'caramel', message: 'editorV7.preview.colorCaramel', color: { colorSpace: 'srgb', r: 157, g: 101, b: 77, a: 1 } },
];

const FINISH_LABEL: Record<SurfaceFinishTypeV7, 'editorV7.preview.finishGloss' | 'editorV7.preview.finishMatte' | 'editorV7.preview.finishFrosted'> = {
  gloss: 'editorV7.preview.finishGloss', matte: 'editorV7.preview.finishMatte', frosted: 'editorV7.preview.finishFrosted',
};

export function CustomerPreviewShellV7({
  doc,
  loadWarnings,
  initialFinger = 'L1',
  returnStepId = null,
}: {
  doc: EditorDocV7;
  loadWarnings: string[];
  initialFinger?: FingerCode;
  returnStepId?: string | null;
}) {
  const { t, locale } = useLocale();
  const navigate = useNavigate();
  const [mode, setMode] = useState<'set' | 'single'>('set');
  const [presentation, setPresentation] = useState<'2d' | 'composite'>('2d');
  const [selectedFinger, setSelectedFinger] = useState<FingerCode>(initialFinger);
  const [scenario, setScenario] = useState(createCustomerPreviewScenarioV7);
  const [compactPreview, setCompactPreview] = useState(() => window.matchMedia('(max-width: 1023px)').matches);
  const [scenarioPanelOpen, setScenarioPanelOpen] = useState(() => !window.matchMedia('(max-width: 1023px)').matches);
  const [shareBusy, setShareBusy] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [shareError, setShareError] = useState<string | null>(null);
  const scenarioPanelRef = useRef<HTMLElement>(null);
  const scenarioToggleRef = useRef<HTMLButtonElement>(null);
  const scenarioTriggerRef = useRef<HTMLElement | null>(null);
  const readModels = useMemo(() => deriveCustomerPreviewSetV7(doc, scenario), [doc, scenario]);
  const selectedModel = readModels.find((model) => model.finger === selectedFinger) ?? readModels[0];
  const selectedNail = doc.nails[selectedFinger];
  const scenarioCount = Object.keys(scenario.backgroundColors).length + (scenario.finishType ? 1 : 0);
  const confirmationReady = scenarioCount === 0 && readModels.every((model) => model.fidelity !== 'unavailable');
  const createFixedShare = async () => {
    if (!confirmationReady || shareBusy) return;
    setShareBusy(true); setShareError(null);
    try {
      const result = await studioApprovalApplicationServiceV1.createFixedVersionShare({ designId: doc.designId, expectedRevision: doc.revision });
      if (!result.ok) {
        setShareError(result.error.reason);
        return;
      }
      const url = new URL(Routes.communityClientShare(result.value.rawToken), window.location.origin).toString();
      setShareUrl(url);
    } catch {
      setShareError('approval.fixed_version_unavailable');
    } finally {
      setShareBusy(false);
    }
  };

  const resetScenario = () => setScenario(createCustomerPreviewScenarioV7());

  useEffect(() => {
    setSelectedFinger(initialFinger);
    setMode('set');
    setPresentation('2d');
    setScenario(createCustomerPreviewScenarioV7());
  }, [doc.designId, initialFinger]);

  useEffect(() => {
    const query = window.matchMedia('(max-width: 1023px)');
    const update = () => {
      setCompactPreview(query.matches);
      setScenarioPanelOpen(!query.matches);
      const trigger = scenarioTriggerRef.current;
      scenarioTriggerRef.current = null;
      queueMicrotask(() => trigger?.focus());
    };
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  const openScenarioPanel = () => {
    scenarioTriggerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setScenarioPanelOpen(true);
  };

  const closeScenarioPanel = () => {
    setScenarioPanelOpen(false);
    const trigger = scenarioTriggerRef.current ?? scenarioToggleRef.current;
    scenarioTriggerRef.current = null;
    queueMicrotask(() => trigger?.focus());
  };

  useEffect(() => {
    if (!compactPreview || !scenarioPanelOpen) return;
    scenarioPanelRef.current?.querySelector<HTMLElement>('button:not([disabled])')?.focus();
  }, [compactPreview, scenarioPanelOpen]);

  useEffect(() => {
    if (!scenarioPanelOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      closeScenarioPanel();
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [scenarioPanelOpen]);

  const trapScenarioFocus = (event: ReactKeyboardEvent<HTMLElement>) => {
    if (!compactPreview || event.key !== 'Tab') return;
    const focusable = Array.from(scenarioPanelRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]), [tabindex]:not([tabindex="-1"])') ?? []);
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  };

  const returnToEditor = () => {
    clearCustomerPreviewSessionV7(doc.designId);
    const stepQuery = returnStepId ? `&step=${encodeURIComponent(returnStepId)}` : '';
    navigate(`${Routes.designCanvas}?design=${encodeURIComponent(doc.designId)}&finger=${encodeURIComponent(selectedFinger)}${stepQuery}`);
  };

  const focusFinger = (finger: FingerCode) => {
    setSelectedFinger(finger);
    setMode('single');
  };

  return (
    <section className="flex h-[100dvh] min-h-[560px] min-w-0 flex-col overflow-hidden bg-workspace" data-testid="customer-preview-v7" data-preview-mode={mode} data-preview-presentation={presentation} data-preview-runtime={mode === 'single' && presentation === 'composite' ? 'v0.7.2-single-nail-pbr' : 'v7-svg-composite'} data-selected-finger={selectedFinger} data-editor-schema="7" data-preview-readonly="true" data-customer-confirmation-ready={String(confirmationReady)}>
      <header className="flex min-h-[58px] flex-wrap items-center gap-2 border-b border-white/80 bg-white/95 px-3 py-2 backdrop-blur sm:px-5">
        <Button size="sm" variant="ghost" className="min-h-11" onClick={returnToEditor}><ArrowLeft size={15} />{t('editorV7.preview.backToDesign')}</Button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-gray-900">{doc.title}</p>
          <p className="text-nano text-gray-500">{t('editorV7.preview.readOnlyRevision', { revision: doc.revision })}</p>
        </div>
        <span className="rounded-full border border-success/20 bg-success-soft px-2.5 py-1 text-nano font-semibold text-success"><ShieldCheck size={12} className="mr-1 inline" />{t('editorV7.preview.designUnchanged')}</span>
        {scenarioCount > 0 && <span className="rounded-full bg-violet-100 px-2.5 py-1 text-nano font-semibold text-violet-700">{t('editorV7.preview.temporaryComparisons', { count: scenarioCount })}</span>}
        <Button size="sm" variant="secondary" className="min-h-11" disabled={!confirmationReady || shareBusy} loading={shareBusy} onClick={() => void createFixedShare()} title={t('editorV7.preview.createFixedShareTitle')}><CheckCircle2 size={14} />{confirmationReady ? t('editorV7.preview.createFixedShare') : t('editorV7.preview.checkBeforeConfirm')}</Button>
      </header>

      <div className="flex items-center justify-between gap-2 border-b border-white/80 bg-white/80 px-3 py-2 sm:px-5">
        <div className="flex rounded-xl border border-gray-200 bg-white p-1" role="group" aria-label={t('editorV7.preview.mode')}>
          <button type="button" aria-pressed={mode === 'set'} onClick={() => setMode('set')} className={cx('min-h-11 rounded-lg px-3 text-xs font-medium', mode === 'set' ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-50')}><Grid3X3 size={14} className="mr-1.5 inline" />{t('editorV7.preview.setOverview')}</button>
          <button type="button" aria-pressed={mode === 'single'} onClick={() => setMode('single')} className={cx('min-h-11 rounded-lg px-3 text-xs font-medium', mode === 'single' ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-50')}><Eye size={14} className="mr-1.5 inline" />{t('editorV7.preview.singleFocus')}</button>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-1.5 text-nano text-gray-500"><div className="flex rounded-xl border border-gray-200 bg-white p-1" role="group" aria-label={t('editorV7.preview.evidence')}><button type="button" aria-pressed={presentation === '2d'} onClick={() => setPresentation('2d')} className={cx('min-h-11 rounded-lg px-3 font-medium', presentation === '2d' ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-50')}>{t('editorV7.preview.structured2d')}</button><button type="button" aria-pressed={presentation === 'composite'} onClick={() => setPresentation('composite')} className={cx('min-h-11 rounded-lg px-3 font-medium', presentation === 'composite' ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-50')}>{t('editorV7.preview.simulated3d')}</button></div><button ref={scenarioToggleRef} type="button" data-testid="customer-scenario-toggle" onClick={scenarioPanelOpen ? closeScenarioPanel : openScenarioPanel} aria-expanded={scenarioPanelOpen} className="min-h-11 rounded-xl border border-violet-200 bg-violet-50 px-3 font-medium text-violet-700"><Sparkles size={13} className="mr-1 inline" />{scenarioPanelOpen ? t('editorV7.preview.collapseComparison') : t('editorV7.preview.compareScenarios')}{scenarioCount > 0 ? ` · ${scenarioCount}` : ''}</button><button type="button" onClick={resetScenario} disabled={scenarioCount === 0} className="min-h-11 rounded-xl border border-gray-200 bg-white px-3 font-medium text-gray-600 disabled:opacity-35"><RotateCcw size={13} className="mr-1 inline" />{t('editorV7.preview.resetComparison')}</button><span className={cx('rounded-full border px-2 py-1 font-semibold', presentation === '2d' ? 'border-success/20 bg-success-soft text-success' : 'border-warning/25 bg-warning-soft text-warning')}>{presentation === '2d' ? t('editorV7.preview.structured2d') : mode === 'single' ? 'PBR · simulated' : 'SVG 2.5D · simulated'}</span></div>
      </div>

      {(shareUrl || shareError) && (
        <div className="border-b border-white/80 bg-white/90 px-3 py-2 sm:px-5" aria-live="polite" aria-atomic="true">
          {shareUrl && <p className="break-all rounded-xl border border-success/20 bg-success-soft px-3 py-2 text-nano text-success" role="status">{t('editorV7.preview.linkCreated', { url: shareUrl })}</p>}
          {shareError && <p className="rounded-xl border border-danger/20 bg-danger-soft px-3 py-2 text-nano text-danger" role="alert">{t('editorV7.preview.createFailed', { reason: shareError })}</p>}
        </div>
      )}

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden lg:flex-row">
        <main className="min-h-0 min-w-0 flex-1 overflow-auto p-3 sm:p-5" aria-label={t('editorV7.preview.canvas')}>
          {loadWarnings.length > 0 && <div className="mb-3 rounded-xl border border-warning/20 bg-warning-soft px-3 py-2 text-xs text-warning" role="status">{t('editorV7.preview.compatibilityWarning', { warnings: loadWarnings.join('；') })}</div>}
          {mode === 'single' && (
            <nav className="sticky top-0 z-20 mx-auto mb-3 flex w-fit max-w-full gap-1 overflow-x-auto rounded-2xl border border-white bg-white/90 p-1.5 shadow-sm backdrop-blur" aria-label={t('editorV7.preview.singleFingerSwitcher')} data-testid="customer-single-finger-switcher">
              {FINGER_CODES.map((finger) => {
                const identity = EDITOR_FINGER_IDENTITY_V7[finger];
                return (
                  <button
                    key={finger}
                    type="button"
                    data-finger={finger}
                    aria-label={t('editorV7.preview.focusFingerLabel', { fingerName: fingerDisplayNameForLocaleV7(finger, locale), finger })}
                    aria-pressed={selectedFinger === finger}
                    onClick={() => setSelectedFinger(finger)}
                    className={cx('min-h-11 min-w-11 shrink-0 rounded-xl px-2 text-nano font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary', selectedFinger === finger ? 'bg-gray-900 text-white' : 'bg-surface-soft text-body hover:bg-primary-soft hover:text-primary')}
                  >
                    <span className="block font-mono">{finger}</span>
                    <span className="block whitespace-nowrap text-[inherit] font-normal opacity-80">{fingerNameForLocaleV7(identity.name, locale)}</span>
                  </button>
                );
              })}
            </nav>
          )}
          {mode === 'set' ? (
            <div className="mx-auto flex min-h-full max-w-7xl flex-col justify-center gap-4">
              <div className="text-center"><p className="text-nano font-semibold uppercase tracking-[0.16em] text-primary">{t('editorV7.preview.customerSet')}</p><h1 className="mt-1 text-xl font-semibold text-gray-900">{t('editorV7.preview.tenFingerPlan')}</h1><p className="mt-1 text-xs text-gray-500">{t('editorV7.preview.setHint')}</p></div>
              <div className="rounded-[28px] border border-white bg-white/60 p-3 shadow-[0_24px_70px_rgba(77,53,67,0.08)] sm:p-5" data-testid="customer-ten-finger-map" data-layout="responsive-five-by-two">
                <NailGrid fingers={FINGER_CODES} density="preview" ariaLabel={t('editorV7.preview.tenFinger')} renderFinger={(finger) => {
                  const identity = EDITOR_FINGER_IDENTITY_V7[finger];
                  const model = readModels.find((item) => item.finger === finger) ?? readModels[0];
                  return (
                    <button type="button" aria-label={t('editorV7.preview.focusFingerLabel', { fingerName: fingerDisplayNameForLocaleV7(finger, locale), finger })} aria-current={finger === selectedFinger ? 'true' : undefined} onClick={() => focusFinger(finger)} className="flex min-h-11 min-w-0 flex-col items-center justify-end rounded-2xl px-0.5 py-1.5 transition hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" data-finger={finger} data-finger-name={identity.name}>
                      <span className="mb-1 text-nano font-semibold text-body">{fingerHandLabelForLocaleV7(identity.hand, locale)}{fingerNameForLocaleV7(identity.name, locale)}</span>
                      <div className="w-full" style={{ width: `${identity.previewWidth * 100}%` }}>
                        <CustomerNailPreviewV7 nail={doc.nails[finger]} recipeInstances={doc.recipeInstances} allNails={doc.nails} readModel={model} selected={finger === selectedFinger} presentation={presentation} visualProportion={{ width: identity.previewWidth, height: identity.previewHeight }} />
                      </div>
                    </button>
                  );
                }} />
              </div>
              <div className="mx-auto flex max-w-2xl items-start gap-2 rounded-xl border border-info/20 bg-info-soft px-3 py-2 text-nano leading-4 text-info"><Info size={13} className="mt-0.5 shrink-0" /><p>{presentation === '2d' ? t('editorV7.preview.structured2dDescription') : t('editorV7.preview.simulated3dDescription')} {t('editorV7.preview.evidenceBoundary')}</p></div>
            </div>
          ) : (
            <div className="mx-auto grid min-h-full max-w-5xl items-center gap-5 lg:grid-cols-[minmax(280px,0.9fr)_minmax(300px,1.1fr)]">
              {presentation === 'composite' ? (
                <Suspense fallback={<div className="flex min-h-[420px] items-center justify-center rounded-[28px] border border-white bg-white/70 text-xs text-gray-500" role="status">{t('editorV7.preview.loadingSingleFinger3d')}</div>}>
                  <SingleNailPbrPreviewV072
                    nail={selectedNail}
                    readModel={selectedModel}
                    recipeInstances={doc.recipeInstances}
                    allNails={doc.nails}
                    fallback={<CustomerNailPreviewV7 nail={selectedNail} recipeInstances={doc.recipeInstances} allNails={doc.nails} readModel={selectedModel} selected size="focus" presentation="composite" />}
                  />
                </Suspense>
              ) : <CustomerNailPreviewV7 nail={selectedNail} recipeInstances={doc.recipeInstances} allNails={doc.nails} readModel={selectedModel} selected size="focus" presentation="2d" />}
              <div className="rounded-[24px] border border-white bg-white/75 p-4 shadow-[0_18px_55px_rgba(77,53,67,0.08)] sm:p-5" aria-live="polite" aria-atomic="true">
                <p className="text-nano font-semibold uppercase tracking-[0.14em] text-primary">{fingerDisplayNameForLocaleV7(selectedFinger, locale)} · {selectedFinger} · {t('editorV7.preview.readOnlyDetail')}</p>
                <h1 className="mt-1 text-xl font-semibold text-gray-900">{t('editorV7.preview.communicationView')}</h1>
                <dl className="mt-4 grid grid-cols-2 gap-2 text-nano"><div className="rounded-xl border border-gray-200 bg-white px-3 py-2"><dt className="text-gray-400">{t('editorV7.preview.background')}</dt><dd className="mt-1 font-semibold text-gray-800">{selectedModel.backgroundMode}</dd></div><div className="rounded-xl border border-gray-200 bg-white px-3 py-2"><dt className="text-gray-400">{t('editorV7.preview.finishComparison')}</dt><dd className="mt-1 font-semibold text-gray-800">{t(FINISH_LABEL[selectedModel.finishType])}</dd></div><div className="rounded-xl border border-gray-200 bg-white px-3 py-2"><dt className="text-gray-400">{t('editorV7.preview.flatEffectDimensional')}</dt><dd className="mt-1 font-semibold text-gray-800">{selectedModel.flatElementCount} / {selectedModel.activeSurfaceEffectCount} / {selectedModel.activeDecorationCount}</dd></div><div className="rounded-xl border border-gray-200 bg-white px-3 py-2"><dt className="text-gray-400">{t('editorV7.preview.previewLevel')}</dt><dd className="mt-1 font-semibold text-gray-800">{selectedModel.fidelity}</dd></div></dl>
                {presentation === 'composite' && <p className="mt-3 rounded-xl border border-violet-200 bg-violet-50 px-3 py-2 text-nano leading-4 text-violet-700">{t('editorV7.preview.v072PbrNotice')}</p>}
                <p className={cx('mt-3 rounded-xl border px-3 py-2 text-nano leading-4', confirmationReady ? 'border-success/20 bg-success-soft text-success' : 'border-warning/20 bg-warning-soft text-warning')}>{confirmationReady ? t('editorV7.preview.fixedRevisionNotice') : scenarioCount > 0 ? t('editorV7.preview.scenarioResetNotice') : t('editorV7.preview.unavailableNotice')}</p>
                {selectedModel.warnings.length > 0 && <ul className="mt-3 space-y-1 rounded-xl border border-warning/20 bg-warning-soft px-3 py-2 text-nano leading-4 text-warning">{selectedModel.warnings.map((warning) => <li key={warning}>· {warning}</li>)}</ul>}
              </div>
            </div>
          )}
        </main>

        {compactPreview && scenarioPanelOpen && <button type="button" className="fixed inset-0 z-30 bg-gray-950/25 backdrop-blur-[1px]" aria-label={t('editorV7.preview.closeScenario')} onClick={closeScenarioPanel} />}
        <aside
          ref={scenarioPanelRef}
          role={compactPreview && scenarioPanelOpen ? 'dialog' : undefined}
          aria-modal={compactPreview && scenarioPanelOpen ? true : undefined}
          onKeyDown={trapScenarioFocus}
          className={cx('fixed inset-x-0 bottom-0 z-40 max-h-[70dvh] shrink-0 overflow-y-auto rounded-t-2xl border-t border-gray-200 bg-white p-3 shadow-modal lg:static lg:z-auto lg:max-h-none lg:w-[320px] lg:rounded-none lg:border-l lg:border-t-0 lg:p-4 lg:shadow-none', !scenarioPanelOpen && 'hidden')}
          aria-label={t('editorV7.preview.scenarioPanel')}
        >
          <div className="flex items-start justify-between gap-2"><div><p className="text-nano font-semibold uppercase tracking-[0.14em] text-violet-600">{t('editorV7.preview.scenarioTemp')}</p><h2 className="mt-1 text-sm font-semibold text-gray-900">{t('editorV7.preview.scenarioTitle')}</h2><p className="mt-1 text-nano leading-4 text-gray-500">{t('editorV7.preview.scenarioInMemory')}</p></div><div className="flex gap-1"><button type="button" onClick={resetScenario} disabled={scenarioCount === 0} className="min-h-11 min-w-11 rounded-xl border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-35" aria-label={t('editorV7.preview.resetAllScenarios')}><RotateCcw size={14} className="mx-auto" /></button><button type="button" onClick={closeScenarioPanel} className="min-h-11 min-w-11 rounded-xl border border-gray-200 text-gray-500 hover:bg-gray-50" aria-label={t('editorV7.preview.closeComparison')}><X size={15} className="mx-auto" /></button></div></div>

          <div className="mt-4"><div className="flex items-center justify-between"><p className="text-xs font-semibold text-gray-800">{t('editorV7.preview.backgroundTest', { finger: selectedFinger })}</p><button type="button" className="min-h-11 px-2 text-nano text-primary disabled:text-gray-300" disabled={!scenario.backgroundColors[selectedFinger]} onClick={() => setScenario((current) => setCustomerPreviewBackgroundV7(current, selectedFinger, null))}>{t('editorV7.preview.restoreDesignColor')}</button></div><div className="mt-2 grid grid-cols-4 gap-2">{COLOR_SCENARIOS.map((choice) => <button key={choice.id} type="button" aria-label={t('editorV7.preview.tryColor', { name: t(choice.message) })} aria-pressed={scenario.backgroundColors[selectedFinger]?.r === choice.color.r && scenario.backgroundColors[selectedFinger]?.g === choice.color.g && scenario.backgroundColors[selectedFinger]?.b === choice.color.b} onClick={() => setScenario((current) => setCustomerPreviewBackgroundV7(current, selectedFinger, choice.color))} className="group min-h-14 rounded-xl border border-gray-200 p-1.5 text-center hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"><span className="mx-auto block h-7 w-7 rounded-full border border-black/10" style={{ background: `rgb(${choice.color.r} ${choice.color.g} ${choice.color.b})` }} /><span className="mt-1 block truncate text-nano text-gray-500">{t(choice.message)}</span></button>)}</div></div>

          <div className="mt-5"><div className="flex items-center justify-between"><p className="text-xs font-semibold text-gray-800">{t('editorV7.preview.finishCompare')}</p>{scenario.finishType && <span className="text-nano font-semibold text-violet-600">{t('editorV7.preview.temporary')}</span>}</div><div className="mt-2 grid grid-cols-3 gap-2">{(['gloss', 'matte', 'frosted'] as const).map((finishType) => { const canonicalFinish = selectedNail.steps[selectedNail.steps.length - 1]; const isCanonical = canonicalFinish?.kind === 'surface_finish' && canonicalFinish.finish.type === finishType; return <button key={finishType} type="button" aria-pressed={selectedModel.finishType === finishType} onClick={() => setScenario((current) => setCustomerPreviewFinishV7(current, isCanonical ? null : finishType))} className={cx('min-h-11 rounded-xl border px-2 text-nano font-medium', selectedModel.finishType === finishType ? 'border-primary bg-primary-soft text-primary' : 'border-gray-200 text-gray-600 hover:bg-gray-50')}>{t(FINISH_LABEL[finishType])}{isCanonical ? ` · ${t('editorV7.preview.designValue')}` : ''}</button>; })}</div><p className="mt-2 rounded-xl border border-dashed border-gray-300 px-3 py-2 text-nano leading-4 text-gray-500"><Sparkles size={11} className="mr-1 inline" />{t('editorV7.preview.finishScenarioNotice')}</p></div>

          <div className="mt-5 border-t border-gray-200 pt-4"><p className="text-nano leading-4 text-gray-500">{t('editorV7.preview.scenarioDiscard')}</p></div>
        </aside>
      </div>
    </section>
  );
}
