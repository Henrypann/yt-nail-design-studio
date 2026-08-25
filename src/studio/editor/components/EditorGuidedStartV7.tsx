import { forwardRef } from 'react';
import { Eye, Gem, Paintbrush, Sparkles } from 'lucide-react';
import { cx } from '@/design-system';
import { useLocale } from '@/lib/i18n';
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
  const { t } = useLocale();
  const hasPersonalStep = nail.steps.some((step) => (
    step.kind === 'flat_design' || step.kind === 'surface_effect' || step.kind === 'dimensional_decoration'
  ));
  if (hasPersonalStep) return null;

  return (
    <section className="mb-3 rounded-[20px] border border-primary/15 bg-white/92 p-3 shadow-sm sm:mb-4 sm:rounded-[24px] sm:p-4" aria-labelledby="v7-guided-start-title" data-testid="v7-guided-start">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-nano font-semibold tracking-[0.12em] text-primary">{t('editorV7.guided.blankCanvas')}</p>
          <h2 id="v7-guided-start-title" className="mt-1 text-lg font-semibold text-gray-900">{t('editorV7.guided.firstPersonalization')}</h2>
          <p className="mt-1 max-w-2xl text-xs leading-5 text-gray-600">{t('editorV7.guided.stepHint')}</p>
        </div>
        <button type="button" onClick={onPreviewFinish} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 text-xs font-semibold text-gray-600 hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
          <Eye size={14} />{t('editorV7.guided.skipToFinish')}
        </button>
      </div>
      <ol className="mt-3 grid grid-cols-3 gap-1.5 text-nano text-gray-500 sm:max-w-2xl sm:text-nano" aria-label={t('editorV7.guided.flow')} data-testid="v7-guided-flow">
        <li className="rounded-xl bg-gray-50 px-2 py-2"><strong className="block text-gray-800">{t('editorV7.guided.chooseContent')}</strong>{t('editorV7.guided.chooseContentDetail')}</li>
        <li className="rounded-xl bg-gray-50 px-2 py-2"><strong className="block text-gray-800">{t('editorV7.guided.confirmStep')}</strong>{t('editorV7.guided.confirmStepDetail')}</li>
        <li className="rounded-xl bg-primary-soft px-2 py-2 text-primary"><strong className="block">{t('editorV7.guided.autoPlace')}</strong>{t('editorV7.guided.autoPlaceDetail')}</li>
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
              <span className="mt-2 block text-sm font-semibold">{t(meta.labelKey)}</span>
              <span className="mt-0.5 block text-nano leading-4 opacity-80">{t(meta.descriptionKey)}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
});
