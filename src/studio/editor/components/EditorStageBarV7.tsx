import type { KeyboardEvent } from 'react';
import { Check, PaintBucket, Ruler, ShieldCheck, Sparkles, UserRoundCheck } from 'lucide-react';
import { cx } from '@/design-system';
import type { NailDesignV7 } from '../v7/model';
import { deriveEditorWorkspaceStagesV7 } from '../v7/workspace-ia';

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
  onRequestPersonalization,
  onOpenCustomerPreview,
  customerPreviewEnabled,
}: {
  nail: NailDesignV7;
  selectedStepId: string | null;
  onSelectStep(stepId: string): void;
  onRequestPersonalization(trigger: HTMLButtonElement): void;
  onOpenCustomerPreview(): void;
  customerPreviewEnabled: boolean;
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
          const canNavigate = (stage.targetStepId !== null || (stage.id === 'customer' && customerPreviewEnabled)) && !unavailable;
          const canActivate = canNavigate || (stage.id === 'personalize' && stage.targetStepId === null);
          return (
            <li key={stage.id} className="flex shrink-0 items-center">
              <button
                type="button"
                data-stage-id={stage.id}
                aria-disabled={!canActivate}
                aria-current={current ? 'step' : undefined}
                aria-label={`${stage.label}：${stage.description}`}
                title={!canActivate ? stage.description : stage.id === 'personalize' && !stage.targetStepId ? '打开开始设计引导' : `前往${stage.label}`}
                onClick={(event) => {
                  if (stage.targetStepId) onSelectStep(stage.targetStepId);
                  else if (stage.id === 'personalize') onRequestPersonalization(event.currentTarget);
                  else if (stage.id === 'customer') onOpenCustomerPreview();
                }}
                onKeyDown={moveStageFocus}
                className={cx(
                  'group flex min-h-12 items-center gap-2 rounded-xl border px-3 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1',
                  stage.lanes ? 'min-w-[210px]' : 'min-w-[142px]',
                  current
                    ? 'border-primary bg-primary-soft text-primary'
                    : !canActivate
                      ? 'cursor-not-allowed border-gray-100 bg-gray-50 text-gray-400'
                      : 'border-transparent bg-white text-gray-600 hover:border-gray-200 hover:bg-gray-50',
                )}
              >
                <span className={cx('flex h-7 w-7 shrink-0 items-center justify-center rounded-lg', current ? 'bg-primary text-white' : 'bg-gray-100 text-gray-500')}>
                  <Icon size={14} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1 text-[10px] font-semibold">
                    <span>{index + 1}. {stage.shortLabel}</span>
                    {stage.count !== undefined && stage.count > 0 && <span className="rounded-full bg-white/75 px-1.5 text-[9px]">{stage.count}</span>}
                    {stage.state === 'configured' && <Check size={11} aria-label="已配置" />}
                  </span>
                  {stage.lanes ? (
                    <span className="mt-1 flex items-center gap-1" aria-label="个性化步骤状态">
                      {stage.lanes.map((lane) => (
                        <span
                          key={lane.id}
                          data-lane={lane.id}
                          data-lane-state={lane.state}
                          data-lane-active={lane.active}
                          className={cx(
                            'rounded-full px-1.5 py-0.5 text-[9px] font-semibold sm:text-[10px]',
                            lane.active
                              ? 'bg-primary text-white'
                              : lane.state === 'configured'
                                ? 'bg-emerald-50 text-emerald-700'
                                : lane.state === 'attention'
                                  ? 'bg-amber-50 text-amber-700'
                                  : 'bg-gray-100 text-gray-400',
                          )}
                        >
                          {lane.label} {lane.count}
                        </span>
                      ))}
                    </span>
                  ) : (
                    <span className="mt-0.5 block max-w-[112px] truncate text-[9px] opacity-70">{stage.description}</span>
                  )}
                </span>
              </button>
              {index < stages.length - 1 && <span aria-hidden="true" className="mx-0.5 text-gray-300">›</span>}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
