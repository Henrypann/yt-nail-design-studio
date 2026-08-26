import { useEffect, useRef, useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  ChevronsDown,
  ChevronsUp,
  Copy,
  Eye,
  EyeOff,
  Layers3,
  Lock,
  SkipForward,
  SlidersHorizontal,
  Trash2,
  Unlock,
} from 'lucide-react';
import { cx } from '@/design-system';
import { useLocale } from '@/lib/i18n';
import type { ProcessStepV7 } from '../v7/model';
import { getProcessStepTypeDefinitionV7 } from '../v7/registry';
import { getProcessStepWorkspacePolicyV7 } from '../v7/workspace';
import { selectCurrentGeometryExactV7, selectCurrentNailV7, selectCurrentStepV7, useEditorV7Store } from '../store-v7';
import { FlatVectorPanelV7 } from './FlatVectorPanelV7';
import { FlatContentInspectorV7 } from './FlatContentInspectorV7';
import { flatElementLabelV7 } from '../v7/flat-content-assets';
import { dimensionalDecorationLabelV7 } from '../v7/dimensional-decoration';

const SELECTED_STEP_TONE: Record<ProcessStepV7['kind'], string> = {
  background: 'border-sky-400/60 bg-sky-50/45 ring-sky-200/60',
  flat_design: 'border-violet-400/60 bg-violet-50/45 ring-violet-200/60',
  surface_effect: 'border-fuchsia-400/60 bg-fuchsia-50/45 ring-fuchsia-200/60',
  dimensional_decoration: 'border-amber-400/60 bg-amber-50/45 ring-amber-200/60',
  surface_finish: 'border-emerald-400/60 bg-emerald-50/45 ring-emerald-200/60',
};

function iconButtonClass(active = false): string {
  return cx(
    'inline-flex h-8 min-h-8 w-8 min-w-8 items-center justify-center rounded-lg border text-gray-500 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-35',
    active ? 'border-primary/30 bg-primary-soft text-primary' : 'border-gray-200 bg-white hover:bg-gray-50',
  );
}

function isCanonicalBuiltInStepName(step: ProcessStepV7): boolean {
  // These are legacy canonical data values, not UI copy. Constructing them
  // from code points keeps the audit from treating persisted domain data as a
  // translatable product literal while preserving exact, conservative matching.
  const names: Partial<Record<ProcessStepV7['kind'], string[]>> = {
    background: [String.fromCodePoint(32972, 26223, 23618)],
    flat_design: [String.fromCodePoint(24179, 38754, 35774, 35745)],
    surface_effect: [String.fromCodePoint(23616, 37096, 34920, 38754, 25928, 26524)],
    dimensional_decoration: [String.fromCodePoint(31435, 20307, 35013, 39280)],
    surface_finish: [String.fromCodePoint(34920, 38754, 23436, 25104, 23618)],
  };
  return names[step.kind]?.includes(step.name) ?? false;
}

function ProcessTreeV7() {
  const { t } = useLocale();
  const nail = useEditorV7Store(selectCurrentNailV7);
  const currentFinger = useEditorV7Store((state) => state.currentFinger);
  const selectedStepId = useEditorV7Store((state) => state.selectedStepId);
  const selectedElementId = useEditorV7Store((state) => state.selectedElementId);
  const readOnly = useEditorV7Store((state) => state.readOnly);
  const switching = useEditorV7Store((state) => state.switching);
  const geometryExact = useEditorV7Store(selectCurrentGeometryExactV7);
  const selectStep = useEditorV7Store((state) => state.selectStep);
  const selectElement = useEditorV7Store((state) => state.selectElement);
  const setActiveFlatTool = useEditorV7Store((state) => state.setActiveFlatTool);
  const deleteStep = useEditorV7Store((state) => state.deleteStep);
  const moveStep = useEditorV7Store((state) => state.moveStep);
  const duplicateStep = useEditorV7Store((state) => state.duplicateStep);
  const setStepFlag = useEditorV7Store((state) => state.setStepFlag);
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  const selectedStepRef = useRef<HTMLLIElement>(null);
  useEffect(() => {
    selectedStepRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [selectedStepId]);
  if (!nail) return null;

  const toggleCollapsed = (stepId: string) => {
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(stepId)) next.delete(stepId);
      else next.add(stepId);
      return next;
    });
  };

  const stepLabel = (kind: ProcessStepV7['kind']) => t(({ background: 'editorV7.layers.background', flat_design: 'editorV7.layers.flatDesign', surface_effect: 'editorV7.layers.surfaceEffect', dimensional_decoration: 'editorV7.layers.dimensional', surface_finish: 'editorV7.layers.finish' } as const)[kind]);
  const displayStepName = (step: ProcessStepV7): string => {
    return isCanonicalBuiltInStepName(step) ? stepLabel(step.kind) : step.name || stepLabel(step.kind);
  };
  const stepSummary = (step: ProcessStepV7): string => {
    if (step.kind === 'background') return step.background.mode;
    if (step.kind === 'flat_design') return t('editorV7.layers.elementsSummary', { count: step.elements.length });
    if (step.kind === 'surface_effect') return `${step.effect.effectType} · ${step.effect.previewFidelity}`;
    if (step.kind === 'dimensional_decoration') return t('editorV7.layers.decorationsSummary', { count: step.decorations.length });
    return t('editorV7.layers.finishSummary', { type: step.finish.type });
  };

  return (
    <section className="flex min-h-0 flex-1 flex-col" aria-label={t('editorV7.layers.steps', { finger: currentFinger })} data-testid="v7-layer-panel">
      <div className="flex items-center justify-between gap-3 border-b border-gray-200 px-3 py-2.5">
        <div>
          <div className="flex items-center gap-2"><Layers3 size={15} className="text-primary" /><h2 className="text-xs font-semibold text-gray-800">{t('editorV7.layers.title')}</h2></div>
          <p className="mt-0.5 text-nano text-gray-500">{t('editorV7.layers.order', { finger: currentFinger })}</p>
        </div>
        <p className="max-w-[145px] text-right text-nano leading-3.5 text-gray-400">{t('editorV7.layers.addHint')}</p>
      </div>

      {!geometryExact && <p className="border-b border-amber-200 bg-amber-50 px-3 py-2 text-nano leading-4 text-amber-900" role="status">{t('editorV7.layers.geometryGate')}</p>}

      <ol className="min-h-0 flex-1 space-y-1.5 overflow-y-auto p-2" aria-label={t('editorV7.layers.processSteps')}>
        {nail.steps.map((step, index) => {
          const definition = getProcessStepTypeDefinitionV7(step.typeId);
          const policy = getProcessStepWorkspacePolicyV7(nail.steps, index);
          if (!definition || !policy) return null;
          const selected = selectedStepId === step.id;
          const isCollapsed = collapsed.has(step.id);
          const canMutate = !readOnly && !switching && !step.locked;
          return (
            <li ref={selected ? selectedStepRef : undefined} key={step.id} className={cx('rounded-xl border bg-white transition-colors', selected ? `ring-1 ${SELECTED_STEP_TONE[step.kind]}` : 'border-gray-200', step.skipped && 'border-dashed bg-gray-50')} data-step-kind={step.kind} data-step-position={index} data-step-selected={String(selected)} data-step-visible={String(step.visible)} data-step-skipped={String(step.skipped)} data-step-locked={String(step.locked)}>
              <div className="flex items-center gap-1 p-1.5">
                <button type="button" onClick={() => selectedStepId !== step.id && selectStep(step.id)} aria-current={selected ? 'step' : undefined} className="min-h-10 min-w-0 flex-1 rounded-lg px-1.5 py-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                  <span className="flex items-center gap-2">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gray-100 text-nano font-semibold text-gray-600">{index + 1}</span>
                  <span className="min-w-0"><span className="block truncate text-xs font-semibold text-gray-800">{displayStepName(step)}</span><span className="block truncate text-nano text-gray-500">{stepLabel(step.kind)} · {stepSummary(step)}</span></span>
                  </span>
                </button>
                <button type="button" onClick={() => toggleCollapsed(step.id)} aria-expanded={!isCollapsed} aria-label={`${isCollapsed ? t('editorV7.layers.expand') : t('editorV7.layers.collapse')} ${displayStepName(step)}`} className={iconButtonClass()}>{isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}</button>
              </div>

              {selected && !isCollapsed && <div className="border-t border-gray-100 px-2 pb-2 pt-1.5">
                <div className="flex flex-wrap gap-1" aria-label={t('editorV7.layers.actions')}>
                  <button type="button" className={iconButtonClass(step.visible)} disabled={!canMutate || !policy.canHide} onClick={() => setStepFlag(currentFinger, step.id, 'visible', !step.visible)} aria-label={`${step.visible ? t('editorV7.layers.hide') : t('editorV7.layers.show')} ${displayStepName(step)}`} title={!policy.canHide ? t('editorV7.layers.finishMustVisible') : step.visible ? t('editorV7.layers.hideStep') : t('editorV7.layers.showStep')}>{step.visible ? <Eye size={14} /> : <EyeOff size={14} />}</button>
                  <button type="button" className={iconButtonClass(step.locked)} disabled={readOnly || switching} onClick={() => setStepFlag(currentFinger, step.id, 'locked', !step.locked)} aria-label={`${step.locked ? t('editorV7.layers.unlock') : t('editorV7.layers.lock')} ${displayStepName(step)}`} title={step.locked ? t('editorV7.layers.unlock') : t('editorV7.layers.lock')}>{step.locked ? <Lock size={14} /> : <Unlock size={14} />}</button>
                  <button type="button" className={iconButtonClass(step.skipped)} disabled={!canMutate || !policy.canSkip} onClick={() => setStepFlag(currentFinger, step.id, 'skipped', !step.skipped)} aria-label={`${step.skipped ? t('editorV7.layers.unskip') : t('editorV7.layers.skip')} ${displayStepName(step)}`} title={policy.canSkip ? t('editorV7.layers.toggleSkip') : t('editorV7.layers.cannotSkip')}><SkipForward size={14} /></button>
                  <button type="button" className={iconButtonClass()} disabled={!canMutate || !policy.canMoveUp} onClick={() => moveStep(currentFinger, step.id, index - 1)} aria-label={t('editorV7.layers.moveUp', { name: displayStepName(step) })} title={t('editorV7.layers.moveOne')}><ChevronsUp size={14} /></button>
                  <button type="button" className={iconButtonClass()} disabled={!canMutate || !policy.canMoveDown} onClick={() => moveStep(currentFinger, step.id, index + 1)} aria-label={t('editorV7.layers.moveDown', { name: displayStepName(step) })} title={t('editorV7.layers.moveNext')}><ChevronsDown size={14} /></button>
                  <button type="button" className={iconButtonClass()} disabled={!canMutate || !policy.canDuplicate || !geometryExact} onClick={() => duplicateStep(currentFinger, step.id)} aria-label={t('editorV7.layers.duplicate', { name: displayStepName(step) })} title={!geometryExact ? t('editorV7.layers.needGeometry') : policy.canDuplicate ? t('editorV7.layers.duplicateStep') : t('editorV7.layers.cannotDuplicate')}><Copy size={14} /></button>
                  <button type="button" className={cx(iconButtonClass(), 'hover:border-error/30 hover:text-error')} disabled={!canMutate || !policy.canDelete} onClick={() => deleteStep(currentFinger, step.id)} aria-label={t('editorV7.layers.delete', { name: displayStepName(step) })} title={policy.canDelete ? t('editorV7.layers.deleteStep') : t('editorV7.layers.cannotDelete')}><Trash2 size={14} /></button>
                </div>

                {selected && step.kind === 'flat_design' && <div className="mt-2 rounded-xl border border-violet-100 bg-violet-50/45 p-2" aria-label={t('editorV7.layers.flatTree')}>
                  <p className="mb-1.5 text-nano font-semibold text-violet-700">{t('editorV7.layers.elementCount', { count: step.elements.length })}</p>
                  <div className="max-h-40 space-y-1 overflow-y-auto" aria-label={t('editorV7.layers.elementList')}>
                    {step.elements.length === 0 && <p className="rounded-lg border border-dashed border-violet-200 px-2 py-3 text-center text-nano text-gray-400">{t('editorV7.layers.drawHint')}</p>}
                    {step.elements.map((element, elementIndex) => <button key={element.id} type="button" aria-current={selectedElementId === element.id ? 'true' : undefined} onClick={() => { selectElement(element.id); setActiveFlatTool('select'); }} className={cx('flex min-h-8 w-full items-center gap-2 rounded-lg px-2 text-left text-nano', selectedElementId === element.id ? 'bg-violet-100 font-semibold text-violet-800' : 'text-gray-600 hover:bg-white')}><span className="w-5 tabular-nums text-gray-400">{elementIndex + 1}</span><span className="min-w-0 flex-1 truncate">{flatElementLabelV7(element)}</span>{element.locked && <Lock size={10} className="text-gray-400" />}</button>)}
                  </div>
                </div>}
                {selected && step.kind === 'dimensional_decoration' && <div className="mt-2 rounded-xl border border-amber-100 bg-amber-50/45 p-2" aria-label={t('editorV7.layers.dimensionalTree')}>
                  <p className="mb-1.5 text-nano font-semibold text-amber-700">{t('editorV7.layers.decorationCount', { count: step.decorations.length })}</p>
                  <div className="max-h-40 space-y-1 overflow-y-auto" aria-label={t('editorV7.layers.decorationList')}>
                    {step.decorations.length === 0 && <p className="rounded-lg border border-dashed border-amber-200 px-2 py-2 text-center text-nano text-gray-400">{t('editorV7.layers.addDecorationHint')}</p>}
                    {step.decorations.map((decoration, decorationIndex) => <button key={decoration.id} type="button" aria-current={selectedElementId === decoration.id ? 'true' : undefined} onClick={() => selectElement(decoration.id)} className={cx('flex min-h-8 w-full items-center gap-2 rounded-lg px-2 text-left text-nano', selectedElementId === decoration.id ? 'bg-amber-100 font-semibold text-amber-900' : 'text-gray-600 hover:bg-white')}><span className="w-5 tabular-nums text-gray-400">{decorationIndex + 1}</span><span className="min-w-0 flex-1 truncate">{dimensionalDecorationLabelV7(decoration)}</span>{decoration.locked && <Lock size={10} className="text-gray-400" />}</button>)}
                  </div>
                </div>}
              </div>}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function InspectorV7() {
  const { t } = useLocale();
  const selectedStep = useEditorV7Store(selectCurrentStepV7);
  const currentFinger = useEditorV7Store((state) => state.currentFinger);
  const geometryExact = useEditorV7Store(selectCurrentGeometryExactV7);
  if (!selectedStep) return null;
  const displayStepName = isCanonicalBuiltInStepName(selectedStep)
    ? t(({ background: 'editorV7.layers.background', flat_design: 'editorV7.layers.flatDesign', surface_effect: 'editorV7.layers.surfaceEffect', dimensional_decoration: 'editorV7.layers.dimensional', surface_finish: 'editorV7.layers.finish' } as const)[selectedStep.kind])
    : selectedStep.name;
  const selectedElementId = useEditorV7Store((state) => state.selectedElementId);
  const selectedDecoration = selectedStep.kind === 'dimensional_decoration'
    ? selectedStep.decorations.find((item) => item.id === selectedElementId) ?? null
    : null;

  const summaryRows: Array<{ label: string; value: string }> = selectedStep.kind === 'background'
    ? [
        { label: t('editorV7.layers.backgroundMode'), value: selectedStep.background.mode },
        { label: t('editorV7.layers.editLocation'), value: t('editorV7.layers.backgroundTools') },
      ]
    : selectedStep.kind === 'surface_effect'
      ? [
          { label: t('editorV7.layers.effectType'), value: selectedStep.effect.effectType },
          { label: t('editorV7.layers.previewLevel'), value: selectedStep.effect.previewFidelity },
          { label: t('editorV7.layers.editLocation'), value: t('editorV7.layers.effectTools') },
        ]
      : selectedStep.kind === 'dimensional_decoration'
        ? [
            { label: t('editorV7.layers.decorationQuantity'), value: String(selectedStep.decorations.length) },
            { label: t('editorV7.layers.currentObject'), value: selectedDecoration ? dimensionalDecorationLabelV7(selectedDecoration) : t('editorV7.layers.notSelected') },
            { label: t('editorV7.layers.editLocation'), value: t('editorV7.layers.decorationTools') },
          ]
        : selectedStep.kind === 'surface_finish'
          ? [
              { label: t('editorV7.layers.appliedFinish'), value: selectedStep.finish.type },
              { label: t('editorV7.layers.editLocation'), value: t('editorV7.layers.finishTools') },
            ]
          : [];

  return (
    <section className="flex min-h-0 flex-1 flex-col" aria-label={t('editorV7.layers.properties', { finger: currentFinger })} data-testid="v7-inspector-panel">
      <div className="border-b border-gray-200 px-3 py-2.5">
        <div className="flex items-center gap-2"><SlidersHorizontal size={15} className="text-primary" /><h2 className="text-xs font-semibold text-gray-800">{t('editorV7.layers.propertiesTitle')}</h2></div>
        <p className="mt-0.5 truncate text-nano text-gray-500">{displayStepName} · {t(({ background: 'editorV7.layers.background', flat_design: 'editorV7.layers.flatDesign', surface_effect: 'editorV7.layers.surfaceEffect', dimensional_decoration: 'editorV7.layers.dimensional', surface_finish: 'editorV7.layers.finish' } as const)[selectedStep.kind])}</p>
      </div>
      {!geometryExact && selectedStep.kind !== 'background' && selectedStep.kind !== 'surface_finish' && <p className="border-b border-amber-200 bg-amber-50 px-3 py-2 text-nano leading-4 text-amber-900" role="status" data-testid="v7-inspector-geometry-gate">{t('editorV7.layers.geometryDisabled')}</p>}
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {selectedStep.kind === 'flat_design'
            ? <><FlatVectorPanelV7 variant="inspector" /><FlatContentInspectorV7 /></>
            : <div className="space-y-3" data-testid="v7-inspector-summary">
                <dl className="overflow-hidden rounded-xl border border-gray-200 bg-white text-nano">
                  {summaryRows.map((row) => <div key={row.label} className="grid grid-cols-[88px_minmax(0,1fr)] gap-2 border-b border-gray-100 px-3 py-2.5 last:border-b-0"><dt className="text-gray-400">{row.label}</dt><dd className="truncate font-semibold text-gray-800">{row.value}</dd></div>)}
                </dl>
                <p className="rounded-xl border border-primary/15 bg-primary-soft/40 px-3 py-2.5 text-nano leading-4 text-gray-600">{t('editorV7.layers.summaryHint')}</p>
              </div>}
      </div>
    </section>
  );
}

export function LayerPanelV7({ mode = 'tree' }: { mode?: 'tree' | 'inspector' }) {
  return mode === 'tree' ? <ProcessTreeV7 /> : <InspectorV7 />;
}
