import { Box, Layers3, ShieldCheck } from 'lucide-react';
import { selectCurrentStepV7, useEditorV7Store } from '../store-v7';
import { V7BackgroundCanvas } from './V7BackgroundCanvas';
import { V7FlatDesignCanvas } from './V7FlatDesignCanvas';
import { V7SurfaceEffectCanvas } from './V7SurfaceEffectCanvas';

export function EditorCanvasHostV7() {
  const selectedStep = useEditorV7Store(selectCurrentStepV7);
  const currentFinger = useEditorV7Store((state) => state.currentFinger);
  if (!selectedStep) {
    return (
      <div className="flex min-h-[420px] flex-col items-center justify-center rounded-[24px] border border-dashed border-gray-300 bg-white/80 px-6 py-10 text-center" data-testid="v7-canvas-empty">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-100 text-gray-500"><Layers3 size={24} /></span>
        <h2 className="mt-4 text-lg font-semibold text-gray-900">请选择工艺步骤</h2>
        <p className="mt-1 text-sm text-gray-600">从顶部阶段或右侧层级中选择已有步骤；工作区不会暗中创建新层。</p>
      </div>
    );
  }
  if (selectedStep.kind === 'background') return <V7BackgroundCanvas />;
  if (selectedStep.kind === 'flat_design') return <V7FlatDesignCanvas />;
  if (selectedStep.kind === 'surface_effect') return <V7SurfaceEffectCanvas />;

  const meta = selectedStep.kind === 'dimensional_decoration'
      ? { icon: Box, title: '立体装饰 2D/2.5D 预览', detail: `${selectedStep.decorations.length} 个装饰元素`, release: 'V7-13' }
      : { icon: ShieldCheck, title: '最终封层与组合预览', detail: selectedStep.finish.type, release: 'V7-14' };
  const Icon = meta.icon;

  return (
    <div className="flex min-h-[420px] flex-col items-center justify-center rounded-[24px] border border-dashed border-gray-300 bg-white/80 px-6 py-10 text-center" data-testid="v7-canvas-fallback" data-step-kind={selectedStep.kind}>
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-100 text-gray-500"><Icon size={24} /></span>
      <p className="mt-4 text-[10px] font-semibold uppercase tracking-[0.14em] text-primary">{currentFinger} · {selectedStep.kind}</p>
      <h2 className="mt-1 text-lg font-semibold text-gray-900">{meta.title}</h2>
      <p className="mt-1 text-sm text-gray-600">{meta.detail}</p>
      <div className="mt-5 flex max-w-md items-start gap-2 rounded-xl border border-info/20 bg-info-soft px-3 py-3 text-left text-xs leading-5 text-info">
        <Layers3 size={15} className="mt-0.5 shrink-0" />
        <p>当前步骤数据、顺序和 fidelity 已安全保留；对应编辑预览在 {meta.release} 开放。V7-08 不用背景画布冒充未实现能力。</p>
      </div>
    </div>
  );
}
