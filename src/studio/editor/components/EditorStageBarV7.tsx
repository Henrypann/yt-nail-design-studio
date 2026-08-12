import type { KeyboardEvent } from 'react';
import { Check, PaintBucket, Ruler, ShieldCheck, Sparkles, UserRoundCheck } from 'lucide-react';
import { cx } from '@/design-system';
import type { NailDesignV7 } from '../v7/model';
import { deriveEditorWorkspaceStagesV7, type EditorWorkspaceStepLaneV7 } from '../v7/workspace-ia';

const STAGE_ICON = {
  geometry: Ruler,
  background: PaintBucket,
  personalize: Sparkles,
  finish: ShieldCheck,
  customer: UserRoundCheck,
} as const;

export function EditorStageBarV7({
  nail,
  selectedStepId,
  onSelectStep,
  onOpenGeometry,
  onRequestPersonalization,
  onActivatePersonalLane,
  onOpenCustomerPreview,
  customerPreviewEnabled,
  customerPreviewReason,
  expandedContext,
}: {
  nail: NailDesignV7;
  selectedStepId: string | null;
  onSelectStep(stepId: string): void;
  onOpenGeometry(trigger: HTMLButtonElement): void;
  onRequestPersonalization(trigger: HTMLButtonElement): void;
  onActivatePersonalLane(lane: EditorWorkspaceStepLaneV7, trigger: HTMLButtonElement): void;
  onOpenCustomerPreview(trigger: HTMLButtonElement): void;
  customerPreviewEnabled: boolean;
  customerPreviewReason: string;
  expandedContext: 'geometry' | 'customer' | null;
}) {
  const stages = deriveEditorWorkspaceStagesV7(nail, selectedStepId);
  const moveStageFocus = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    const buttons = Array.from(event.currentTarget.closest('ol')?.querySelectorAll<HTMLButtonElement>('button') ?? []);
    const currentIndex = buttons.indexOf(event.currentTarget);
    if (currentIndex < 0 || buttons.length === 0) return;
    event.preventDefault();
    const nextIndex = event.key === 'Home'
      ? 0
      : event.key === 'End'
        ? buttons.length - 1
        : event.key === 'ArrowLeft'
          ? (currentIndex - 1 + buttons.length) % buttons.length
          : (currentIndex + 1) % buttons.length;
    buttons[nextIndex].focus();
    buttons[nextIndex].scrollIntoView({ block: 'nearest', inline: 'nearest' });
  };

  return (
    <nav className="min-w-0 overflow-hidden border-b border-gray-200 bg-white px-2 py-2 sm:px-3" aria-label="设计阶段" data-testid="v7-stage-bar">
      <ol className="flex w-full min-w-0 items-stretch gap-1 overflow-x-auto">
        {stages.map((stage, index) => {
          const Icon = STAGE_ICON[stage.id];
          const current = stage.active;
          const unavailable = stage.state === 'unavailable';
          const description = stage.id === 'customer' ? customerPreviewReason : stage.description;
          const explainableContext = stage.id === 'geometry' || stage.id === 'customer';
          const canNavigate = stage.targetStepId !== null && !unavailable;
          const canActivate = canNavigate || explainableContext || (stage.id === 'personalize' && stage.targetStepId === null);
          // Customer remains an actionable status/detail entry while preview is
          // unavailable. Marking it aria-disabled would make the explanation
          // unreachable to touch automation and assistive technology.
          const ariaDisabled = !canActivate;
          const customerNeedsAttention = stage.id === 'customer' && !customerPreviewEnabled;
          const activateStage = (trigger: HTMLButtonElement) => {
            if (stage.targetStepId) onSelectStep(stage.targetStepId);
            else if (stage.id === 'geometry') onOpenGeometry(trigger);
            else if (stage.id === 'personalize') onRequestPersonalization(trigger);
            else if (stage.id === 'customer') onOpenCustomerPreview(trigger);
          };
          const stageContent = <>
            <span className={cx('flex h-7 w-7 shrink-0 items-center justify-center rounded-lg', current ? 'bg-primary text-white' : 'bg-gray-100 text-gray-500')}>
              <Icon size={14} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1 text-nano font-semibold">
                <span>{index + 1}. {stage.shortLabel}</span>
                {stage.count !== undefined && stage.count > 0 && <span className="rounded-full bg-white/75 px-1.5 text-nano">{stage.count}</span>}
                {stage.state === 'configured' && <Check size={11} aria-label="已配置" />}
              </span>
              {!stage.lanes && <span className="mt-0.5 block max-w-[132px] text-nano leading-3 opacity-70 line-clamp-2">{description}</span>}
            </span>
          </>;
          return (
            <li key={stage.id} className="flex shrink-0 items-center">
              {stage.lanes ? (
                <div className={cx('min-w-[242px] rounded-xl border p-1 transition-colors', current ? 'border-primary bg-primary-soft text-primary' : 'border-gray-200 bg-white text-gray-600')} data-stage-card={stage.id}>
                  <button type="button" data-stage-id={stage.id} aria-current={current ? 'step' : undefined} aria-label={`${stage.label}：${description}`} title={stage.targetStepId ? `前往${stage.label}` : '打开开始设计引导'} onClick={(event) => activateStage(event.currentTarget)} onKeyDown={moveStageFocus} className="group flex min-h-10 w-full items-center gap-2 rounded-lg px-2 py-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                    {stageContent}
                  </button>
                  <div className="mt-1 grid grid-cols-3 gap-1" role="group" aria-label="个性化步骤与工具映射">
                    {stage.lanes.map((lane) => (
                      <button
                        key={lane.id}
                        type="button"
                        data-lane={lane.id}
                        data-lane-kind={lane.kind}
                        data-lane-tool={lane.toolId}
                        data-lane-state={lane.state}
                        data-lane-active={lane.active}
                        aria-pressed={lane.active}
                        aria-label={`${lane.label}：${lane.count > 0 ? `${lane.count} 个步骤` : '尚未添加'}；点击${lane.count > 0 ? '进入对应工具' : '查看添加提示'}`}
                        onClick={(event) => onActivatePersonalLane(lane, event.currentTarget)}
                        onKeyDown={moveStageFocus}
                        className={cx(
                          'min-h-11 rounded-lg px-1.5 text-nano font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                          lane.active
                            ? 'bg-primary text-white shadow-sm'
                            : lane.state === 'configured'
                              ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                              : lane.state === 'attention'
                                ? 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                                : 'border border-dashed border-gray-200 bg-gray-50 text-gray-500 hover:border-primary/30 hover:bg-primary-soft',
                        )}
                      >
                        {lane.label} <span className="tabular-nums">{lane.count}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  data-stage-id={stage.id}
                  data-stage-context-open={expandedContext === stage.id}
                  data-customer-preview-enabled={stage.id === 'customer' ? customerPreviewEnabled : undefined}
                  aria-controls={expandedContext === stage.id && explainableContext ? `editor-v7-stage-context-${stage.id}` : undefined}
                  aria-disabled={ariaDisabled}
                  aria-expanded={explainableContext ? expandedContext === stage.id : undefined}
                  aria-current={current ? 'step' : undefined}
                  aria-label={`${stage.label}：${description}`}
                  title={stage.id === 'customer' && !customerPreviewEnabled ? `查看不可用原因：${description}` : !canActivate ? description : stage.id === 'geometry' ? '查看当前甲型与轮廓来源' : `前往${stage.label}`}
                  onClick={(event) => activateStage(event.currentTarget)}
                  onKeyDown={moveStageFocus}
                  className={cx('group flex min-h-12 min-w-[142px] items-center gap-2 rounded-xl border px-3 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1', current ? 'border-primary bg-primary-soft text-primary' : customerNeedsAttention ? 'border-amber-200 bg-amber-50 text-amber-800 hover:border-amber-300 hover:bg-amber-100/70' : ariaDisabled ? 'cursor-not-allowed border-gray-100 bg-gray-50 text-gray-400' : 'border-transparent bg-white text-gray-600 hover:border-gray-200 hover:bg-gray-50')}
                >
                  {stageContent}
                </button>
              )}
              {index < stages.length - 1 && <span aria-hidden="true" className="mx-0.5 text-gray-300">›</span>}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
