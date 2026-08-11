import { Check, Info, RotateCcw, ShieldCheck, Sparkles } from 'lucide-react';
import { Button, cx, useToast } from '@/design-system';
import { selectCurrentStepV7, useEditorV7Store } from '../store-v7';
import {
  SURFACE_FINISH_DESCRIPTIONS_V7,
  SURFACE_FINISH_LABELS_V7,
  SURFACE_FINISH_OPTIONS_V7,
} from '../v7/finish';

export function FinishCompositePanelV7() {
  const toast = useToast();
  const step = useEditorV7Store(selectCurrentStepV7);
  const currentFinger = useEditorV7Store((state) => state.currentFinger);
  const previewFinishType = useEditorV7Store((state) => state.previewFinishType);
  const readOnly = useEditorV7Store((state) => state.readOnly);
  const switching = useEditorV7Store((state) => state.switching);
  const setPreviewFinishType = useEditorV7Store((state) => state.setPreviewFinishType);
  const setSurfaceFinish = useEditorV7Store((state) => state.setSurfaceFinish);
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

  return (
    <div className="mt-2 space-y-3 rounded-xl border border-primary/15 bg-primary-soft/30 p-3" data-testid="v7-finish-composite-panel">
      <div><div className="flex items-center gap-2"><ShieldCheck size={14} className="text-primary" /><p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-gray-600">Finish & Composite Preview</p></div><p className="mt-1 text-[10px] leading-4 text-gray-500">先比较 finish，再显式应用；预览切换不写 EditorDoc。</p></div>
      <div className="grid grid-cols-3 gap-1 rounded-xl bg-white p-1" role="group" aria-label="封层模拟预览">
        {SURFACE_FINISH_OPTIONS_V7.map((finishType) => <button key={finishType} type="button" aria-pressed={preview === finishType} onClick={() => setPreviewFinishType(finishType)} className={cx('min-h-11 rounded-lg px-2 text-[10px] font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary', preview === finishType ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-50')}><span className="block">{SURFACE_FINISH_LABELS_V7[finishType]}</span><span className={cx('mt-0.5 block text-[8px]', preview === finishType ? 'text-white/65' : 'text-gray-400')}>{SURFACE_FINISH_DESCRIPTIONS_V7[finishType]}</span></button>)}
      </div>
      <div className="rounded-xl border border-gray-200 bg-white p-3 text-[10px] leading-4 text-gray-600">
        <div className="flex items-center justify-between gap-2"><span>已应用</span><span className="font-semibold text-gray-900">{SURFACE_FINISH_LABELS_V7[canonical]}</span></div>
        <div className="mt-1 flex items-center justify-between gap-2"><span>当前预览</span><span className={cx('font-semibold', previewOnly ? 'text-violet-700' : 'text-success')}>{SURFACE_FINISH_LABELS_V7[preview]} · {previewOnly ? '未应用' : '已同步'}</span></div>
        <div className="mt-2 flex items-center gap-1.5 text-success"><Check size={12} />选择 finish 不会锁定背景或其他步骤。</div>
      </div>
      <div className="grid grid-cols-[1fr_auto] gap-2">
        <Button className="min-h-11" disabled={!canApply} onClick={apply}><Sparkles size={14} />应用为最终封层</Button>
        <button type="button" aria-label="恢复已应用封层预览" disabled={!previewOnly} onClick={() => setPreviewFinishType(null)} className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-500 disabled:opacity-35"><RotateCcw size={14} /></button>
      </div>
      {readOnly && <p className="text-[10px] text-gray-500">只读模式仍可比较 finish，但不能应用到设计。</p>}
      <p className="rounded-lg border border-info/20 bg-info-soft px-2.5 py-2 text-[10px] leading-4 text-info"><Info size={12} className="mr-1 inline" />模拟 finish 不代表真实材料、固化状态或物理可制造性；应用后仍只是设计参数。</p>
    </div>
  );
}
