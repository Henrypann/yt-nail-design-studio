import { Layers3 } from 'lucide-react';
import { selectCurrentStepV7, useEditorV7Store } from '../store-v7';
import { V7BackgroundCanvas } from './V7BackgroundCanvas';
import { V7FlatDesignCanvas } from './V7FlatDesignCanvas';
import { V7SurfaceEffectCanvas } from './V7SurfaceEffectCanvas';
import { V7DimensionalDecorationCanvas } from './V7DimensionalDecorationCanvas';
import { V7FinishCompositeCanvas } from './V7FinishCompositeCanvas';

export function EditorCanvasHostV7() {
  const selectedStep = useEditorV7Store(selectCurrentStepV7);
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
  if (selectedStep.kind === 'dimensional_decoration') return <V7DimensionalDecorationCanvas />;
  return <V7FinishCompositeCanvas />;
}
