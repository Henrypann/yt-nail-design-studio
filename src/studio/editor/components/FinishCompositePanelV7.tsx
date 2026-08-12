import { Check, Info, RotateCcw, Scissors, ShieldCheck, Sparkles } from 'lucide-react';
import { Button, cx, useToast } from '@/design-system';
import { selectCurrentGeometryExactV7, selectCurrentNailV7, selectCurrentStepV7, useEditorV7Store } from '../store-v7';
import {
  SURFACE_FINISH_DESCRIPTIONS_V7,
  SURFACE_FINISH_LABELS_V7,
  SURFACE_FINISH_OPTIONS_V7,
} from '../v7/finish';
import { createEditorWorkspacePersonalStepV7 } from '../v7/workspace-step-factory';

export function FinishCompositePanelV7() {
  const toast = useToast();
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
    toast.success(`已将 ${SURFACE_FINISH_LABELS_V7[preview]} 应用为最终封层，可继续编辑。`);
  };
  const addLocalMaskEffect = () => {
    if (!nail) return;
    const effectStep = createEditorWorkspacePersonalStepV7('surface_effect');
    const result = addStep(currentFinger, effectStep, nail.steps.length - 1);
    if (!result.ok) toast.error(result.message);
    else toast.success('已新增局部遮罩效果层；左侧已切换到效果参数。');
  };

  return (
    <div className="mt-2 space-y-3 rounded-xl border border-primary/15 bg-primary-soft/30 p-3" data-testid="v7-finish-composite-panel">
      <div><div className="flex items-center gap-2"><ShieldCheck size={14} className="text-primary" /><p className="text-nano font-semibold uppercase tracking-[0.12em] text-gray-600">Finish & Composite Preview</p></div><p className="mt-1 text-nano leading-4 text-gray-500">先比较 finish，再显式应用；预览切换不写 EditorDoc。</p></div>
      <div className="grid grid-cols-3 gap-1 rounded-xl bg-white p-1" role="group" aria-label="封层模拟预览">
        {SURFACE_FINISH_OPTIONS_V7.map((finishType) => <button key={finishType} type="button" aria-pressed={preview === finishType} onClick={() => setPreviewFinishType(finishType)} className={cx('min-h-11 rounded-lg px-2 text-nano font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary', preview === finishType ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-50')}><span className="block">{SURFACE_FINISH_LABELS_V7[finishType]}</span><span className={cx('mt-0.5 block text-nano', preview === finishType ? 'text-white/65' : 'text-gray-400')}>{SURFACE_FINISH_DESCRIPTIONS_V7[finishType]}</span></button>)}
      </div>
      <div className="rounded-xl border border-dashed border-gray-300 bg-white p-2.5 text-nano leading-4 text-gray-500">
        <button type="button" disabled={readOnly || switching || !geometryExact} onClick={addLocalMaskEffect} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-3 font-semibold text-gray-700 hover:border-primary/30 disabled:opacity-40"><Scissors size={14} />局部遮罩（新建效果层）</button>
        <p className="mt-2">局部遮罩由可重复的表面效果层承接；最终封层保持唯一且覆盖整甲，避免同一 finish 出现局部与全局双真源。</p>
      </div>
      <div className="rounded-xl border border-gray-200 bg-white p-3 text-nano leading-4 text-gray-600">
        <div className="flex items-center justify-between gap-2"><span>已应用</span><span className="font-semibold text-gray-900">{SURFACE_FINISH_LABELS_V7[canonical]}</span></div>
        <div className="mt-1 flex items-center justify-between gap-2"><span>当前预览</span><span className={cx('font-semibold', previewOnly ? 'text-violet-700' : 'text-success')}>{SURFACE_FINISH_LABELS_V7[preview]} · {previewOnly ? '未应用' : '已同步'}</span></div>
        <div className="mt-2 flex items-center gap-1.5 text-success"><Check size={12} />选择 finish 不会锁定背景或其他步骤。</div>
      </div>
      <div className="grid grid-cols-[1fr_auto] gap-2">
        <Button className="min-h-11" disabled={!canApply} onClick={apply}><Sparkles size={14} />应用为最终封层</Button>
        <button type="button" aria-label="恢复已应用封层预览" disabled={!previewOnly} onClick={() => setPreviewFinishType(null)} className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-500 disabled:opacity-35"><RotateCcw size={14} /></button>
      </div>
      {readOnly && <p className="text-nano text-gray-500">只读模式仍可比较 finish，但不能应用到设计。</p>}
      <p className="rounded-lg border border-info/20 bg-info-soft px-2.5 py-2 text-nano leading-4 text-info"><Info size={12} className="mr-1 inline" />模拟 finish 不代表真实材料、固化状态或物理可制造性；应用后仍只是设计参数。</p>
    </div>
  );
}
