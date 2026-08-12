import { forwardRef } from 'react';
import { Eye, Gem, Paintbrush, Sparkles } from 'lucide-react';
import { cx } from '@/design-system';
import type { NailDesignV7 } from '../v7/model';
import type { EditorWorkspaceToolIdV7 } from '../v7/workspace-ia';
import {
  EDITOR_WORKSPACE_PERSONAL_STEP_META_V7,
  type EditorWorkspacePersonalStepKindV7,
} from '../v7/workspace-step-factory';

const START_OPTIONS: ReadonlyArray<{
  kind: EditorWorkspacePersonalStepKindV7;
  toolId: EditorWorkspaceToolIdV7;
  icon: typeof Paintbrush;
  tone: string;
}> = [
  { kind: 'flat_design', toolId: 'brush', icon: Paintbrush, tone: 'border-violet-200 bg-violet-50/70 text-violet-800' },
  { kind: 'surface_effect', toolId: 'effects', icon: Sparkles, tone: 'border-fuchsia-200 bg-fuchsia-50/70 text-fuchsia-800' },
  { kind: 'dimensional_decoration', toolId: 'decorations', icon: Gem, tone: 'border-amber-200 bg-amber-50/70 text-amber-900' },
];

export const EditorGuidedStartV7 = forwardRef<HTMLButtonElement, {
  nail: NailDesignV7;
  onRequest(kind: EditorWorkspacePersonalStepKindV7, toolId: EditorWorkspaceToolIdV7, trigger: HTMLButtonElement): void;
  onPreviewFinish(): void;
}>(function EditorGuidedStartV7({ nail, onRequest, onPreviewFinish }, firstCardRef) {
  const hasPersonalStep = nail.steps.some((step) => (
    step.kind === 'flat_design' || step.kind === 'surface_effect' || step.kind === 'dimensional_decoration'
  ));
  if (hasPersonalStep) return null;

  return (
    <section className="mb-3 rounded-[20px] border border-primary/15 bg-white/92 p-3 shadow-sm sm:mb-4 sm:rounded-[24px] sm:p-4" aria-labelledby="v7-guided-start-title" data-testid="v7-guided-start">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold tracking-[0.12em] text-primary">空白画布 · 从零开始</p>
          <h2 id="v7-guided-start-title" className="mt-1 text-lg font-semibold text-gray-900">从第一种个性化内容开始</h2>
          <p className="mt-1 max-w-2xl text-xs leading-5 text-gray-600">每次确认只新增一个工艺步骤，并立即同步顶部阶段、左侧工具、画布与右侧层级。稍后仍可继续添加或交错排序。</p>
        </div>
        <button type="button" onClick={onPreviewFinish} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 text-xs font-semibold text-gray-600 hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
          <Eye size={14} />暂不添加，直接编辑封层
        </button>
      </div>
      <ol className="mt-3 grid grid-cols-3 gap-1.5 text-[9px] text-gray-500 sm:max-w-2xl sm:text-[10px]" aria-label="新手设计流程" data-testid="v7-guided-flow">
        <li className="rounded-xl bg-gray-50 px-2 py-2"><strong className="block text-gray-800">1 · 选择内容</strong>平面、效果或立体</li>
        <li className="rounded-xl bg-gray-50 px-2 py-2"><strong className="block text-gray-800">2 · 确认步骤</strong>只新增一个可撤销层级</li>
        <li className="rounded-xl bg-primary-soft px-2 py-2 text-primary"><strong className="block">3 · 自动就位</strong>阶段、工具与层级同步高亮</li>
      </ol>
      <div className="mt-3 flex snap-x snap-mandatory gap-2 overflow-x-auto pb-1 sm:mt-4 sm:grid sm:grid-cols-3 sm:overflow-visible sm:pb-0" data-testid="v7-guided-options">
        {START_OPTIONS.map((option, index) => {
          const meta = EDITOR_WORKSPACE_PERSONAL_STEP_META_V7[option.kind];
          const Icon = option.icon;
          return (
            <button
              key={option.kind}
              ref={index === 0 ? firstCardRef : undefined}
              type="button"
              data-start-kind={option.kind}
              data-target-tool={option.toolId}
              onClick={(event) => onRequest(option.kind, option.toolId, event.currentTarget)}
              className={cx('min-h-[96px] min-w-[220px] snap-start rounded-2xl border p-3 text-left transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 sm:min-h-[108px] sm:min-w-0', option.tone)}
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/80"><Icon size={17} /></span>
              <span className="mt-2 block text-sm font-semibold">{meta.label}</span>
              <span className="mt-0.5 block text-[10px] leading-4 opacity-80">{meta.description}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
});
