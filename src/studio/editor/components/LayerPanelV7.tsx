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
  SkipForward,
  Trash2,
  Unlock,
} from 'lucide-react';
import { Button, cx } from '@/design-system';
import type { ProcessStepV7 } from '../v7/model';
import {
  PROCESS_STEP_TYPE_IDS_V7,
  getProcessStepTypeDefinitionV7,
} from '../v7/registry';
import { generateEditorV7Id } from '../v7/id';
import { getProcessStepWorkspacePolicyV7 } from '../v7/workspace';
import { selectCurrentNailV7, useEditorV7Store } from '../store-v7';
import { V7StepToolGate } from './V7StepToolGate';
import { BackgroundPanelV7 } from './BackgroundPanelV7';
import { FlatVectorPanelV7 } from './FlatVectorPanelV7';

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

export function LayerPanelV7() {
  const nail = useEditorV7Store(selectCurrentNailV7);
  const currentFinger = useEditorV7Store((state) => state.currentFinger);
  const selectedStepId = useEditorV7Store((state) => state.selectedStepId);
  const readOnly = useEditorV7Store((state) => state.readOnly);
  const switching = useEditorV7Store((state) => state.switching);
  const selectStep = useEditorV7Store((state) => state.selectStep);
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
    addStep(currentFinger, step, nail.steps.length - 1);
  };

  return (
    <section className="flex min-h-0 flex-1 flex-col" aria-label={`${currentFinger} 制作步骤`} data-testid="v7-layer-panel">
      <div className="flex items-center justify-between gap-3 border-b border-gray-200 px-3 py-3">
        <div>
          <div className="flex items-center gap-2">
            <Layers3 size={15} className="text-primary" />
            <h2 className="text-xs font-semibold text-gray-800">制作步骤</h2>
          </div>
          <p className="mt-0.5 text-[10px] text-gray-500">按实际工艺顺序显示 · {currentFinger}</p>
        </div>
        <Button size="sm" variant="secondary" disabled={readOnly || switching} onClick={addFlatStep} title="在最终封层前添加空的平面设计步骤">
          <Plus size={13} /> 平面步骤
        </Button>
      </div>

      <ol className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3" aria-label="Canonical process steps">
        {nail.steps.map((step, index) => {
          const definition = getProcessStepTypeDefinitionV7(step.typeId);
          if (!definition) return null;
          const policy = getProcessStepWorkspacePolicyV7(nail.steps, index);
          if (!policy) return null;
          const selected = selectedStepId === step.id;
          const isCollapsed = collapsed.has(step.id);
          const canMutate = !readOnly && !switching && !step.locked;
          return (
            <li
              key={step.id}
              className={cx(
                'rounded-2xl border bg-white shadow-sm transition-colors',
                selected ? 'border-primary/45 ring-1 ring-primary/10' : 'border-gray-200',
                step.skipped && 'border-dashed bg-gray-50',
              )}
              data-step-kind={step.kind}
              data-step-position={index}
            >
              <div className="flex items-stretch gap-1 p-2">
                <button
                  type="button"
                  onClick={() => selectStep(step.id)}
                  aria-current={selected ? 'step' : undefined}
                  className="min-w-0 flex-1 rounded-xl px-2 py-1.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <span className="flex items-center gap-2">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gray-100 text-[10px] font-semibold text-gray-600">{index + 1}</span>
                    <span className="min-w-0">
                      <span className="block truncate text-xs font-semibold text-gray-800">{step.name || STEP_LABEL[step.kind]}</span>
                      <span className="block truncate text-[10px] text-gray-500">{STEP_LABEL[step.kind]} · {stepSummary(step)}</span>
                    </span>
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => toggleCollapsed(step.id)}
                  aria-expanded={!isCollapsed}
                  aria-label={`${isCollapsed ? '展开' : '折叠'} ${step.name || STEP_LABEL[step.kind]}`}
                  className={iconButtonClass()}
                >
                  {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                </button>
              </div>

              {!isCollapsed && (
                <div className="border-t border-gray-100 px-2 pb-2 pt-2">
                  <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-7 lg:grid-cols-4">
                    <button type="button" className={iconButtonClass(step.visible)} disabled={!canMutate || !policy.canHide} onClick={() => setStepFlag(currentFinger, step.id, 'visible', !step.visible)} aria-label={`${step.visible ? '隐藏' : '显示'} ${step.name}`} title={!policy.canHide ? '最终封层必须可见' : step.visible ? '隐藏步骤' : '显示步骤'}>{step.visible ? <Eye size={14} /> : <EyeOff size={14} />}</button>
                    <button type="button" className={iconButtonClass(step.locked)} disabled={readOnly || switching} onClick={() => setStepFlag(currentFinger, step.id, 'locked', !step.locked)} aria-label={`${step.locked ? '解锁' : '锁定'} ${step.name}`} title={step.locked ? '解锁步骤' : '锁定步骤'}>{step.locked ? <Lock size={14} /> : <Unlock size={14} />}</button>
                    <button type="button" className={iconButtonClass(step.skipped)} disabled={!canMutate || !policy.canSkip} onClick={() => setStepFlag(currentFinger, step.id, 'skipped', !step.skipped)} aria-label={`${step.skipped ? '取消跳过' : '跳过'} ${step.name}`} title={policy.canSkip ? '切换跳过状态' : '此步骤不可跳过'}><SkipForward size={14} /></button>
                    <button type="button" className={iconButtonClass()} disabled={!canMutate || !policy.canMoveUp} onClick={() => moveStep(currentFinger, step.id, index - 1)} aria-label={`上移 ${step.name}`} title="上移一步"><ChevronsUp size={14} /></button>
                    <button type="button" className={iconButtonClass()} disabled={!canMutate || !policy.canMoveDown} onClick={() => moveStep(currentFinger, step.id, index + 1)} aria-label={`下移 ${step.name}`} title="下移一步"><ChevronsDown size={14} /></button>
                    <button type="button" className={iconButtonClass()} disabled={!canMutate || !policy.canDuplicate} onClick={() => duplicateStep(currentFinger, step.id)} aria-label={`复制 ${step.name}`} title={policy.canDuplicate ? '复制步骤' : '此步骤不可复制'}><Copy size={14} /></button>
                    <button type="button" className={cx(iconButtonClass(), 'hover:border-error/30 hover:text-error')} disabled={!canMutate || !policy.canDelete} onClick={() => deleteStep(currentFinger, step.id)} aria-label={`删除 ${step.name}`} title={policy.canDelete ? '删除步骤' : '此步骤不可删除'}><Trash2 size={14} /></button>
                  </div>
                  {selected && (
                    step.kind === 'background'
                      ? <BackgroundPanelV7 />
                      : step.kind === 'flat_design'
                        ? <FlatVectorPanelV7 />
                      : <div className="mt-2"><V7StepToolGate tools={definition.allowedTools} /></div>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
