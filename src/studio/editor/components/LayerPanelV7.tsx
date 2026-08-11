import { useState } from 'react';
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
  Plus,
  Sparkles,
  SkipForward,
  SlidersHorizontal,
  Trash2,
  Unlock,
} from 'lucide-react';
import { Button, cx } from '@/design-system';
import type { ProcessStepV7 } from '../v7/model';
import { PROCESS_STEP_TYPE_IDS_V7, getProcessStepTypeDefinitionV7 } from '../v7/registry';
import { generateEditorV7Id } from '../v7/id';
import { getProcessStepWorkspacePolicyV7 } from '../v7/workspace';
import { selectCurrentNailV7, selectCurrentStepV7, useEditorV7Store } from '../store-v7';
import { V7StepToolGate } from './V7StepToolGate';
import { BackgroundPanelV7 } from './BackgroundPanelV7';
import { FlatVectorPanelV7 } from './FlatVectorPanelV7';
import { FlatContentInspectorV7 } from './FlatContentInspectorV7';
import { flatElementLabelV7 } from '../v7/flat-content-assets';
import { createDefaultSurfaceEffectPayloadV7, createSurfaceEffectMaskV7 } from '../v7/surface-effect';
import { SurfaceEffectPanelV7 } from './SurfaceEffectPanelV7';

const STEP_LABEL: Record<ProcessStepV7['kind'], string> = {
  background: '背景层',
  flat_design: '平面设计层',
  surface_effect: '表面效果层',
  dimensional_decoration: '立体装饰层',
  surface_finish: '表面完成层',
};

function stepSummary(step: ProcessStepV7): string {
  if (step.kind === 'background') return step.background.mode;
  if (step.kind === 'flat_design') return `${step.elements.length} 个 2D 元素`;
  if (step.kind === 'surface_effect') return `${step.effect.effectType} · ${step.effect.previewFidelity}`;
  if (step.kind === 'dimensional_decoration') return `${step.decorations.length} 个立体元素`;
  return `${step.finish.type} · 最终封层`;
}

function iconButtonClass(active = false): string {
  return cx(
    'inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border text-gray-500 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-35',
    active ? 'border-primary/30 bg-primary-soft text-primary' : 'border-gray-200 bg-white hover:bg-gray-50',
  );
}

function ProcessTreeV7() {
  const nail = useEditorV7Store(selectCurrentNailV7);
  const currentFinger = useEditorV7Store((state) => state.currentFinger);
  const selectedStepId = useEditorV7Store((state) => state.selectedStepId);
  const selectedElementId = useEditorV7Store((state) => state.selectedElementId);
  const readOnly = useEditorV7Store((state) => state.readOnly);
  const switching = useEditorV7Store((state) => state.switching);
  const selectStep = useEditorV7Store((state) => state.selectStep);
  const selectElement = useEditorV7Store((state) => state.selectElement);
  const setActiveFlatTool = useEditorV7Store((state) => state.setActiveFlatTool);
  const addStep = useEditorV7Store((state) => state.addStep);
  const deleteStep = useEditorV7Store((state) => state.deleteStep);
  const moveStep = useEditorV7Store((state) => state.moveStep);
  const duplicateStep = useEditorV7Store((state) => state.duplicateStep);
  const setStepFlag = useEditorV7Store((state) => state.setStepFlag);
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  if (!nail) return null;

  const toggleCollapsed = (stepId: string) => {
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(stepId)) next.delete(stepId);
      else next.add(stepId);
      return next;
    });
  };

  const addFlatStep = () => {
    const step: ProcessStepV7 = {
      id: generateEditorV7Id('step'),
      typeId: PROCESS_STEP_TYPE_IDS_V7.flat_design,
      kind: 'flat_design',
      name: '平面设计',
      visible: true,
      locked: false,
      skipped: false,
      materialRefs: [],
      elements: [],
    };
    const result = addStep(currentFinger, step, nail.steps.length - 1);
    if (result.ok) selectStep(step.id);
  };

  const addSurfaceEffectStep = () => {
    const stepId = generateEditorV7Id('step');
    const step: ProcessStepV7 = {
      id: stepId,
      typeId: PROCESS_STEP_TYPE_IDS_V7.surface_effect,
      kind: 'surface_effect',
      name: '局部表面效果',
      visible: true,
      locked: false,
      skipped: false,
      materialRefs: [],
      effect: createDefaultSurfaceEffectPayloadV7('cat_eye', `${stepId}-cat-eye`),
      mask: createSurfaceEffectMaskV7('center'),
    };
    const result = addStep(currentFinger, step, nail.steps.length - 1);
    if (result.ok) selectStep(step.id);
  };

  return (
    <section className="flex min-h-0 flex-1 flex-col" aria-label={`${currentFinger} 制作步骤`} data-testid="v7-layer-panel">
      <div className="flex items-center justify-between gap-3 border-b border-gray-200 px-3 py-3">
        <div>
          <div className="flex items-center gap-2"><Layers3 size={15} className="text-primary" /><h2 className="text-xs font-semibold text-gray-800">层级与步骤</h2></div>
          <p className="mt-0.5 text-[10px] text-gray-500">完整 canonical 顺序 · {currentFinger}</p>
        </div>
        <div className="flex flex-wrap justify-end gap-1"><Button size="sm" variant="secondary" className="min-h-11" disabled={readOnly || switching} onClick={addFlatStep} title="在最终封层前添加平面设计步骤"><Plus size={13} /> 平面</Button><Button size="sm" variant="secondary" className="min-h-11" disabled={readOnly || switching} onClick={addSurfaceEffectStep} title="在最终封层前添加局部表面效果"><Sparkles size={13} /> 效果</Button></div>
      </div>

      <ol className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3" aria-label="Canonical process steps">
        {nail.steps.map((step, index) => {
          const definition = getProcessStepTypeDefinitionV7(step.typeId);
          const policy = getProcessStepWorkspacePolicyV7(nail.steps, index);
          if (!definition || !policy) return null;
          const selected = selectedStepId === step.id;
          const isCollapsed = collapsed.has(step.id);
          const canMutate = !readOnly && !switching && !step.locked;
          return (
            <li key={step.id} className={cx('rounded-2xl border bg-white shadow-sm transition-colors', selected ? 'border-primary/45 ring-1 ring-primary/10' : 'border-gray-200', step.skipped && 'border-dashed bg-gray-50')} data-step-kind={step.kind} data-step-position={index}>
              <div className="flex items-stretch gap-1 p-2">
                <button type="button" onClick={() => selectedStepId !== step.id && selectStep(step.id)} aria-current={selected ? 'step' : undefined} className="min-w-0 flex-1 rounded-xl px-2 py-1.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                  <span className="flex items-center gap-2">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gray-100 text-[10px] font-semibold text-gray-600">{index + 1}</span>
                    <span className="min-w-0"><span className="block truncate text-xs font-semibold text-gray-800">{step.name || STEP_LABEL[step.kind]}</span><span className="block truncate text-[10px] text-gray-500">{STEP_LABEL[step.kind]} · {stepSummary(step)}</span></span>
                  </span>
                </button>
                <button type="button" onClick={() => toggleCollapsed(step.id)} aria-expanded={!isCollapsed} aria-label={`${isCollapsed ? '展开' : '折叠'} ${step.name || STEP_LABEL[step.kind]}`} className={iconButtonClass()}>{isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}</button>
              </div>

              {!isCollapsed && <div className="border-t border-gray-100 px-2 pb-2 pt-2">
                <div className="grid grid-cols-4 gap-1.5">
                  <button type="button" className={iconButtonClass(step.visible)} disabled={!canMutate || !policy.canHide} onClick={() => setStepFlag(currentFinger, step.id, 'visible', !step.visible)} aria-label={`${step.visible ? '隐藏' : '显示'} ${step.name}`} title={!policy.canHide ? '最终封层必须可见' : step.visible ? '隐藏步骤' : '显示步骤'}>{step.visible ? <Eye size={14} /> : <EyeOff size={14} />}</button>
                  <button type="button" className={iconButtonClass(step.locked)} disabled={readOnly || switching} onClick={() => setStepFlag(currentFinger, step.id, 'locked', !step.locked)} aria-label={`${step.locked ? '解锁' : '锁定'} ${step.name}`} title={step.locked ? '解锁步骤' : '锁定步骤'}>{step.locked ? <Lock size={14} /> : <Unlock size={14} />}</button>
                  <button type="button" className={iconButtonClass(step.skipped)} disabled={!canMutate || !policy.canSkip} onClick={() => setStepFlag(currentFinger, step.id, 'skipped', !step.skipped)} aria-label={`${step.skipped ? '取消跳过' : '跳过'} ${step.name}`} title={policy.canSkip ? '切换跳过状态' : '此步骤不可跳过'}><SkipForward size={14} /></button>
                  <button type="button" className={iconButtonClass()} disabled={!canMutate || !policy.canMoveUp} onClick={() => moveStep(currentFinger, step.id, index - 1)} aria-label={`上移 ${step.name}`} title="上移一步"><ChevronsUp size={14} /></button>
                  <button type="button" className={iconButtonClass()} disabled={!canMutate || !policy.canMoveDown} onClick={() => moveStep(currentFinger, step.id, index + 1)} aria-label={`下移 ${step.name}`} title="下移一步"><ChevronsDown size={14} /></button>
                  <button type="button" className={iconButtonClass()} disabled={!canMutate || !policy.canDuplicate} onClick={() => duplicateStep(currentFinger, step.id)} aria-label={`复制 ${step.name}`} title={policy.canDuplicate ? '复制步骤' : '此步骤不可复制'}><Copy size={14} /></button>
                  <button type="button" className={cx(iconButtonClass(), 'hover:border-error/30 hover:text-error')} disabled={!canMutate || !policy.canDelete} onClick={() => deleteStep(currentFinger, step.id)} aria-label={`删除 ${step.name}`} title={policy.canDelete ? '删除步骤' : '此步骤不可删除'}><Trash2 size={14} /></button>
                </div>

                {selected && step.kind === 'flat_design' && <div className="mt-2 rounded-xl border border-violet-100 bg-violet-50/45 p-2" aria-label="平面元素树">
                  <p className="mb-1.5 text-[10px] font-semibold text-violet-700">元素 · {step.elements.length}</p>
                  <div className="max-h-40 space-y-1 overflow-y-auto" aria-label="平面元素列表">
                    {step.elements.length === 0 && <p className="rounded-lg border border-dashed border-violet-200 px-2 py-3 text-center text-[10px] text-gray-400">从左侧工具开始绘制。</p>}
                    {step.elements.map((element, elementIndex) => <button key={element.id} type="button" aria-current={selectedElementId === element.id ? 'true' : undefined} onClick={() => { selectElement(element.id); setActiveFlatTool('select'); }} className={cx('flex min-h-9 w-full items-center gap-2 rounded-lg px-2 text-left text-[10px]', selectedElementId === element.id ? 'bg-violet-100 font-semibold text-violet-800' : 'text-gray-600 hover:bg-white')}><span className="w-5 tabular-nums text-gray-400">{elementIndex + 1}</span><span className="min-w-0 flex-1 truncate">{flatElementLabelV7(element)}</span>{element.locked && <Lock size={10} className="text-gray-400" />}</button>)}
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
  const selectedStep = useEditorV7Store(selectCurrentStepV7);
  const currentFinger = useEditorV7Store((state) => state.currentFinger);
  if (!selectedStep) return null;
  const definition = getProcessStepTypeDefinitionV7(selectedStep.typeId);

  return (
    <section className="flex min-h-0 flex-1 flex-col" aria-label={`${currentFinger} 属性检查器`} data-testid="v7-inspector-panel">
      <div className="border-b border-gray-200 px-3 py-3">
        <div className="flex items-center gap-2"><SlidersHorizontal size={15} className="text-primary" /><h2 className="text-xs font-semibold text-gray-800">属性</h2></div>
        <p className="mt-0.5 truncate text-[10px] text-gray-500">{selectedStep.name} · {STEP_LABEL[selectedStep.kind]}</p>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {selectedStep.kind === 'background'
          ? <BackgroundPanelV7 />
          : selectedStep.kind === 'flat_design'
            ? <><FlatVectorPanelV7 variant="inspector" /><FlatContentInspectorV7 /></>
            : selectedStep.kind === 'surface_effect'
              ? <SurfaceEffectPanelV7 />
            : definition
              ? <V7StepToolGate tools={definition.allowedTools} />
              : <p className="text-xs text-gray-500">当前步骤没有可用属性。</p>}
      </div>
    </section>
  );
}

export function LayerPanelV7({ mode = 'tree' }: { mode?: 'tree' | 'inspector' }) {
  return mode === 'tree' ? <ProcessTreeV7 /> : <InspectorV7 />;
}
