import { Check, Info, RotateCcw, Scissors, ShieldCheck, Sparkles } from 'lucide-react';
import { Button, cx, useToast } from '@/design-system';
import { useLocale } from '@/lib/i18n';
import { selectCurrentGeometryExactV7, selectCurrentNailV7, selectCurrentStepV7, useEditorV7Store } from '../store-v7';
import {
  SURFACE_FINISH_DESCRIPTIONS_V7,
  SURFACE_FINISH_LABELS_V7,
  SURFACE_FINISH_OPTIONS_V7,
} from '../v7/finish';
import { createEditorWorkspacePersonalStepV7 } from '../v7/workspace-step-factory';

export function FinishCompositePanelV7() {
  const toast = useToast();
  const { t } = useLocale();
  const step = useEditorV7Store(selectCurrentStepV7);
  const nail = useEditorV7Store(selectCurrentNailV7);
  const geometryExact = useEditorV7Store(selectCurrentGeometryExactV7);
  const currentFinger = useEditorV7Store((state) => state.currentFinger);
  const previewFinishType = useEditorV7Store((state) => state.previewFinishType);
  const readOnly = useEditorV7Store((state) => state.readOnly);
  const switching = useEditorV7Store((state) => state.switching);
  const setPreviewFinishType = useEditorV7Store((state) => state.setPreviewFinishType);
  const setSurfaceFinish = useEditorV7Store((state) => state.setSurfaceFinish);
  const addStep = useEditorV7Store((state) => state.addStep);
  if (step?.kind !== 'surface_finish') return null;
  const canonical = step.finish.type;
  const preview = previewFinishType ?? canonical;
  const previewOnly = preview !== canonical;
  const canApply = previewOnly && !readOnly && !switching && !step.locked;
  const apply = () => {
    const result = setSurfaceFinish(currentFinger, step.id, preview);
    if (!result.ok) { toast.error(result.message); return; }
    toast.success(t('editorV7.finishPanel.appliedToast', { finish: SURFACE_FINISH_LABELS_V7[preview] }));
  };
  const addLocalMaskEffect = () => {
    if (!nail) return;
    const effectStep = createEditorWorkspacePersonalStepV7('surface_effect');
    const result = addStep(currentFinger, effectStep, nail.steps.length - 1);
    if (!result.ok) toast.error(result.message);
    else toast.success(t('editorV7.finishPanel.maskToast'));
  };

  return (
    <div className="mt-2 space-y-3 rounded-xl border border-primary/15 bg-primary-soft/30 p-3" data-testid="v7-finish-composite-panel">
      <div><div className="flex items-center gap-2"><ShieldCheck size={14} className="text-primary" /><p className="text-nano font-semibold uppercase tracking-[0.12em] text-gray-600">{t('editorV7.finishPanel.title')}</p></div><p className="mt-1 text-nano leading-4 text-gray-500">{t('editorV7.finishPanel.description')}</p></div>
      <div className="grid grid-cols-3 gap-1 rounded-xl bg-white p-1" role="group" aria-label={t('editorV7.finishPanel.aria')}>
        {SURFACE_FINISH_OPTIONS_V7.map((finishType) => <button key={finishType} type="button" aria-pressed={preview === finishType} onClick={() => setPreviewFinishType(finishType)} className={cx('min-h-11 rounded-lg px-2 text-nano font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary', preview === finishType ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-50')}><span className="block">{SURFACE_FINISH_LABELS_V7[finishType]}</span><span className={cx('mt-0.5 block text-nano', preview === finishType ? 'text-white/65' : 'text-gray-400')}>{SURFACE_FINISH_DESCRIPTIONS_V7[finishType]}</span></button>)}
      </div>
      <div className="rounded-xl border border-dashed border-gray-300 bg-white p-2.5 text-nano leading-4 text-gray-500">
        <button type="button" disabled={readOnly || switching || !geometryExact} onClick={addLocalMaskEffect} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-3 font-semibold text-gray-700 hover:border-primary/30 disabled:opacity-40"><Scissors size={14} />{t('editorV7.finishPanel.localMask')}</button>
        <p className="mt-2">{t('editorV7.finishPanel.localMaskHint')}</p>
      </div>
      <div className="rounded-xl border border-gray-200 bg-white p-3 text-nano leading-4 text-gray-600">
        <div className="flex items-center justify-between gap-2"><span>{t('editorV7.finishPanel.applied')}</span><span className="font-semibold text-gray-900">{SURFACE_FINISH_LABELS_V7[canonical]}</span></div>
        <div className="mt-1 flex items-center justify-between gap-2"><span>{t('editorV7.finishPanel.current')}</span><span className={cx('font-semibold', previewOnly ? 'text-violet-700' : 'text-success')}>{SURFACE_FINISH_LABELS_V7[preview]} · {previewOnly ? t('editorV7.finishPanel.notApplied') : t('editorV7.finishPanel.synced')}</span></div>
        <div className="mt-2 flex items-center gap-1.5 text-success"><Check size={12} />{t('editorV7.finishPanel.selectionHint')}</div>
      </div>
      <div className="grid grid-cols-[1fr_auto] gap-2">
        <Button className="min-h-11" disabled={!canApply} onClick={apply}><Sparkles size={14} />{t('editorV7.finishPanel.apply')}</Button>
        <button type="button" aria-label={t('editorV7.finishPanel.restore')} disabled={!previewOnly} onClick={() => setPreviewFinishType(null)} className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-500 disabled:opacity-35"><RotateCcw size={14} /></button>
      </div>
      {readOnly && <p className="text-nano text-gray-500">{t('editorV7.finishPanel.readOnly')}</p>}
      <p className="rounded-lg border border-info/20 bg-info-soft px-2.5 py-2 text-nano leading-4 text-info"><Info size={12} className="mr-1 inline" />{t('editorV7.finishPanel.disclaimer')}</p>
    </div>
  );
}
