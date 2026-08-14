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
import type { ProcessStepV7 } from '../v7/model';
import { getProcessStepTypeDefinitionV7 } from '../v7/registry';
import { getProcessStepWorkspacePolicyV7 } from '../v7/workspace';
import { selectCurrentGeometryExactV7, selectCurrentNailV7, selectCurrentStepV7, useEditorV7Store } from '../store-v7';
import { FlatVectorPanelV7 } from './FlatVectorPanelV7';
import { FlatContentInspectorV7 } from './FlatContentInspectorV7';
import { flatElementLabelV7 } from '../v7/flat-content-assets';
import { dimensionalDecorationLabelV7 } from '../v7/dimensional-decoration';

const STEP_LABEL: Record<ProcessStepV7['kind'], string> = {
  background: '背景层',
  flat_design: '平面设计层',
  surface_effect: '表面效果层',
  dimensional_decoration: '立体装饰层',
  surface_finish: '表面完成层',
};

const SELECTED_STEP_TONE: Record<ProcessStepV7['kind'], string> = {
  background: 'border-sky-400/60 bg-sky-50/45 ring-sky-200/60',
  flat_design: 'border-violet-400/60 bg-violet-50/45 ring-violet-200/60',
  surface_effect: 'border-fuchsia-400/60 bg-fuchsia-50/45 ring-fuchsia-200/60',
  dimensional_decoration: 'border-amber-400/60 bg-amber-50/45 ring-amber-200/60',
  surface_finish: 'border-emerald-400/60 bg-emerald-50/45 ring-emerald-200/60',
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
    'inline-flex h-8 min-h-8 w-8 min-w-8 items-center justify-center rounded-lg border text-gray-500 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-35',
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

  return (
    <section className="flex min-h-0 flex-1 flex-col" aria-label={`${currentFinger} 制作步骤`} data-testid="v7-layer-panel">
      <div className="flex items-center justify-between gap-3 border-b border-gray-200 px-3 py-2.5">
        <div>
          <div className="flex items-center gap-2"><Layers3 size={15} className="text-primary" /><h2 className="text-xs font-semibold text-gray-800">层级与步骤</h2></div>
          <p className="mt-0.5 text-nano text-gray-500">完整 canonical 顺序 · {currentFinger}</p>
        </div>
        <p className="max-w-[145px] text-right text-nano leading-3.5 text-gray-400">新增内容请从左侧对应工具开始</p>
      </div>

      {!geometryExact && <p className="border-b border-amber-200 bg-amber-50 px-3 py-2 text-nano leading-4 text-amber-900" role="status">当前指位只有近似或不可用轮廓；可查看、整理和删除现有内容，但新增或复制空间步骤需先绑定已签收 2D 甲型轮廓。</p>}

      <ol className="min-h-0 flex-1 space-y-1.5 overflow-y-auto p-2" aria-label="Canonical process steps">
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
                    <span className="min-w-0"><span className="block truncate text-xs font-semibold text-gray-800">{step.name || STEP_LABEL[step.kind]}</span><span className="block truncate text-nano text-gray-500">{STEP_LABEL[step.kind]} · {stepSummary(step)}</span></span>
                  </span>
                </button>
                <button type="button" onClick={() => toggleCollapsed(step.id)} aria-expanded={!isCollapsed} aria-label={`${isCollapsed ? '展开' : '折叠'} ${step.name || STEP_LABEL[step.kind]}`} className={iconButtonClass()}>{isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}</button>
              </div>

              {selected && !isCollapsed && <div className="border-t border-gray-100 px-2 pb-2 pt-1.5">
                <div className="flex flex-wrap gap-1" aria-label="当前步骤操作">
                  <button type="button" className={iconButtonClass(step.visible)} disabled={!canMutate || !policy.canHide} onClick={() => setStepFlag(currentFinger, step.id, 'visible', !step.visible)} aria-label={`${step.visible ? '隐藏' : '显示'} ${step.name}`} title={!policy.canHide ? '最终封层必须可见' : step.visible ? '隐藏步骤' : '显示步骤'}>{step.visible ? <Eye size={14} /> : <EyeOff size={14} />}</button>
                  <button type="button" className={iconButtonClass(step.locked)} disabled={readOnly || switching} onClick={() => setStepFlag(currentFinger, step.id, 'locked', !step.locked)} aria-label={`${step.locked ? '解锁' : '锁定'} ${step.name}`} title={step.locked ? '解锁步骤' : '锁定步骤'}>{step.locked ? <Lock size={14} /> : <Unlock size={14} />}</button>
                  <button type="button" className={iconButtonClass(step.skipped)} disabled={!canMutate || !policy.canSkip} onClick={() => setStepFlag(currentFinger, step.id, 'skipped', !step.skipped)} aria-label={`${step.skipped ? '取消跳过' : '跳过'} ${step.name}`} title={policy.canSkip ? '切换跳过状态' : '此步骤不可跳过'}><SkipForward size={14} /></button>
                  <button type="button" className={iconButtonClass()} disabled={!canMutate || !policy.canMoveUp} onClick={() => moveStep(currentFinger, step.id, index - 1)} aria-label={`上移 ${step.name}`} title="上移一步"><ChevronsUp size={14} /></button>
                  <button type="button" className={iconButtonClass()} disabled={!canMutate || !policy.canMoveDown} onClick={() => moveStep(currentFinger, step.id, index + 1)} aria-label={`下移 ${step.name}`} title="下移一步"><ChevronsDown size={14} /></button>
                  <button type="button" className={iconButtonClass()} disabled={!canMutate || !policy.canDuplicate || !geometryExact} onClick={() => duplicateStep(currentFinger, step.id)} aria-label={`复制 ${step.name}`} title={!geometryExact ? '需要先绑定已签收 2D 甲型轮廓' : policy.canDuplicate ? '复制步骤' : '此步骤不可复制'}><Copy size={14} /></button>
                  <button type="button" className={cx(iconButtonClass(), 'hover:border-error/30 hover:text-error')} disabled={!canMutate || !policy.canDelete} onClick={() => deleteStep(currentFinger, step.id)} aria-label={`删除 ${step.name}`} title={policy.canDelete ? '删除步骤' : '此步骤不可删除'}><Trash2 size={14} /></button>
                </div>

                {selected && step.kind === 'flat_design' && <div className="mt-2 rounded-xl border border-violet-100 bg-violet-50/45 p-2" aria-label="平面元素树">
                  <p className="mb-1.5 text-nano font-semibold text-violet-700">元素 · {step.elements.length}</p>
                  <div className="max-h-40 space-y-1 overflow-y-auto" aria-label="平面元素列表">
                    {step.elements.length === 0 && <p className="rounded-lg border border-dashed border-violet-200 px-2 py-3 text-center text-nano text-gray-400">从左侧工具开始绘制。</p>}
                    {step.elements.map((element, elementIndex) => <button key={element.id} type="button" aria-current={selectedElementId === element.id ? 'true' : undefined} onClick={() => { selectElement(element.id); setActiveFlatTool('select'); }} className={cx('flex min-h-8 w-full items-center gap-2 rounded-lg px-2 text-left text-nano', selectedElementId === element.id ? 'bg-violet-100 font-semibold text-violet-800' : 'text-gray-600 hover:bg-white')}><span className="w-5 tabular-nums text-gray-400">{elementIndex + 1}</span><span className="min-w-0 flex-1 truncate">{flatElementLabelV7(element)}</span>{element.locked && <Lock size={10} className="text-gray-400" />}</button>)}
                  </div>
                </div>}
                {selected && step.kind === 'dimensional_decoration' && <div className="mt-2 rounded-xl border border-amber-100 bg-amber-50/45 p-2" aria-label="立体装饰树">
                  <p className="mb-1.5 text-nano font-semibold text-amber-700">装饰 · {step.decorations.length}</p>
                  <div className="max-h-40 space-y-1 overflow-y-auto" aria-label="立体装饰列表">
                    {step.decorations.length === 0 && <p className="rounded-lg border border-dashed border-amber-200 px-2 py-2 text-center text-nano text-gray-400">从左侧立体工具添加素材。</p>}
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
  const selectedStep = useEditorV7Store(selectCurrentStepV7);
  const currentFinger = useEditorV7Store((state) => state.currentFinger);
  const geometryExact = useEditorV7Store(selectCurrentGeometryExactV7);
  if (!selectedStep) return null;
  const selectedElementId = useEditorV7Store((state) => state.selectedElementId);
  const selectedDecoration = selectedStep.kind === 'dimensional_decoration'
    ? selectedStep.decorations.find((item) => item.id === selectedElementId) ?? null
    : null;

  const summaryRows: Array<{ label: string; value: string }> = selectedStep.kind === 'background'
    ? [
        { label: '背景模式', value: selectedStep.background.mode },
        { label: '编辑位置', value: '左侧背景工具与参数' },
      ]
    : selectedStep.kind === 'surface_effect'
      ? [
          { label: '效果类型', value: selectedStep.effect.effectType },
          { label: '预览等级', value: selectedStep.effect.previewFidelity },
          { label: '编辑位置', value: '左侧效果工具与参数' },
        ]
      : selectedStep.kind === 'dimensional_decoration'
        ? [
            { label: '装饰数量', value: String(selectedStep.decorations.length) },
            { label: '当前对象', value: selectedDecoration ? dimensionalDecorationLabelV7(selectedDecoration) : '尚未选择' },
            { label: '编辑位置', value: '左侧立体素材与参数' },
          ]
        : selectedStep.kind === 'surface_finish'
          ? [
              { label: '已应用封层', value: selectedStep.finish.type },
              { label: '编辑位置', value: '左侧封层工具与参数' },
            ]
          : [];

  return (
    <section className="flex min-h-0 flex-1 flex-col" aria-label={`${currentFinger} 属性检查器`} data-testid="v7-inspector-panel">
      <div className="border-b border-gray-200 px-3 py-2.5">
        <div className="flex items-center gap-2"><SlidersHorizontal size={15} className="text-primary" /><h2 className="text-xs font-semibold text-gray-800">属性</h2></div>
        <p className="mt-0.5 truncate text-nano text-gray-500">{selectedStep.name} · {STEP_LABEL[selectedStep.kind]}</p>
      </div>
      {!geometryExact && selectedStep.kind !== 'background' && selectedStep.kind !== 'surface_finish' && <p className="border-b border-amber-200 bg-amber-50 px-3 py-2 text-nano leading-4 text-amber-900" role="status" data-testid="v7-inspector-geometry-gate">当前甲型不能安全进行空间编辑。图案、局部效果和立体装饰属性已停用；背景和封层仍可调整。</p>}
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {selectedStep.kind === 'flat_design'
            ? <><FlatVectorPanelV7 variant="inspector" /><FlatContentInspectorV7 /></>
            : <div className="space-y-3" data-testid="v7-inspector-summary">
                <dl className="overflow-hidden rounded-xl border border-gray-200 bg-white text-nano">
                  {summaryRows.map((row) => <div key={row.label} className="grid grid-cols-[88px_minmax(0,1fr)] gap-2 border-b border-gray-100 px-3 py-2.5 last:border-b-0"><dt className="text-gray-400">{row.label}</dt><dd className="truncate font-semibold text-gray-800">{row.value}</dd></div>)}
                </dl>
                <p className="rounded-xl border border-primary/15 bg-primary-soft/40 px-3 py-2.5 text-nano leading-4 text-gray-600">右侧只负责层级选择与当前对象摘要。素材选择、效果类型和高频参数统一在左侧，避免同一参数出现两套入口。</p>
              </div>}
      </div>
    </section>
  );
}

export function LayerPanelV7({ mode = 'tree' }: { mode?: 'tree' | 'inspector' }) {
  return mode === 'tree' ? <ProcessTreeV7 /> : <InspectorV7 />;
}
