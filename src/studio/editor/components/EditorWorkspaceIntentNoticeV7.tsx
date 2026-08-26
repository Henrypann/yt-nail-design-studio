import { useEffect, useRef } from 'react';
import { Eye, EyeOff, Layers3, Lock, ScanLine, X } from 'lucide-react';
import { Button, cx } from '@/design-system';
import { useLocale, type MessageKey } from '@/lib/i18n';
import type { EditorWorkspaceToolAvailabilityV7 } from '../v7/workspace-ia';
import { EDITOR_WORKSPACE_PERSONAL_STEP_META_V7 } from '../v7/workspace-step-factory';

const STATUS_KEYS = { switching: 'editorV7.intent.switching', read_only: 'editorV7.intent.readOnly', missing_step: 'editorV7.intent.missingStep', locked: 'editorV7.intent.locked', skipped: 'editorV7.intent.skipped', hidden: 'editorV7.intent.hidden', geometry_unavailable: 'editorV7.intent.geometryUnavailable', ready: 'editorV7.intent.ready' } as const;

const STATUS_ICON = {
  switching: Layers3,
  read_only: Eye,
  missing_step: Layers3,
  locked: Lock,
  skipped: EyeOff,
  hidden: EyeOff,
  geometry_unavailable: ScanLine,
  ready: Eye,
} as const;

const TOOL_LABEL: Record<EditorWorkspaceToolAvailabilityV7['id'], MessageKey> = { select: 'editorV7.tool.select', background: 'editorV7.tool.background', brush: 'editorV7.tool.brush', eraser: 'editorV7.tool.eraser', line: 'editorV7.tool.line', french: 'editorV7.tool.french', shape: 'editorV7.tool.shape', text: 'editorV7.tool.text', assets: 'editorV7.tool.assets', effects: 'editorV7.tool.effects', decorations: 'editorV7.tool.decorations', finish: 'editorV7.tool.finish' };

const STEP_LABEL: Record<EditorWorkspaceToolAvailabilityV7['requiredStepKind'], MessageKey> = {
  background: 'editorV7.layers.background', flat_design: 'editorV7.layers.flatDesign', surface_effect: 'editorV7.layers.surfaceEffect', dimensional_decoration: 'editorV7.layers.dimensional', surface_finish: 'editorV7.layers.finish',
};

function actionLabel(intent: EditorWorkspaceToolAvailabilityV7, t: ReturnType<typeof useLocale>['t']): string | null {
  if (intent.status === 'missing_step') {
    const meta = intent.requiredStepKind === 'flat_design'
      || intent.requiredStepKind === 'surface_effect'
      || intent.requiredStepKind === 'dimensional_decoration'
      ? EDITOR_WORKSPACE_PERSONAL_STEP_META_V7[intent.requiredStepKind]
      : null;
    return meta ? t('editorV7.intent.addAndContinue', { label: t(meta.labelKey) }) : null;
  }
  if (intent.status === 'locked') return t('editorV7.intent.unlockContinue');
  if (intent.status === 'skipped') return t('editorV7.intent.unskipContinue');
  if (intent.status === 'hidden') return t('editorV7.intent.restoreContinue');
  return null;
}

export function EditorWorkspaceIntentNoticeV7({
  intent,
  onResolve,
  onDismiss,
}: {
  intent: EditorWorkspaceToolAvailabilityV7;
  onResolve(): void;
  onDismiss(): void;
}) {
  const { t } = useLocale();
  const actionRef = useRef<HTMLButtonElement>(null);
  const dismissRef = useRef<HTMLButtonElement>(null);
  const action = actionLabel(intent, t);
  const Icon = STATUS_ICON[intent.status];
  useEffect(() => {
    (action ? actionRef.current : dismissRef.current)?.focus();
  }, [action, intent.id, intent.status]);

  return (
    <section
      role="status"
      aria-live="polite"
      data-testid="v7-tool-conflict"
      data-tool={intent.id}
      data-status={intent.status}
      className={cx(
        'flex flex-wrap items-center gap-3 border-b px-3 py-2.5 text-xs',
        intent.status === 'read_only' || intent.status === 'switching'
          ? 'border-info/20 bg-info-soft text-info'
          : 'border-amber-200 bg-amber-50 text-amber-950',
      )}
    >
      <span className="flex min-w-0 flex-1 items-start gap-2">
        <Icon size={15} className="mt-0.5 shrink-0" />
        <span><strong className="block font-semibold">{t(STATUS_KEYS[intent.status])}</strong><span className="mt-0.5 block leading-5">{intent.reason ?? t('editorV7.intent.unavailable')}</span></span>
      </span>
      <span className="flex flex-wrap gap-1 text-nano" aria-label={t('editorV7.intent.targets')}>
        <span className="rounded-full border border-current/15 bg-white/70 px-2 py-1">{t('editorV7.intent.toolPrefix', { label: t(TOOL_LABEL[intent.id]) })}</span>
        <span className="rounded-full border border-current/15 bg-white/70 px-2 py-1">{t('editorV7.intent.stepPrefix', { label: t(STEP_LABEL[intent.requiredStepKind]) })}</span>
        <span className="rounded-full border border-current/15 bg-white/70 px-2 py-1">{t('editorV7.intent.syncHighlight')}</span>
      </span>
      {action && <Button ref={actionRef} size="sm" className="min-h-11" onClick={onResolve}>{action}</Button>}
      <button ref={dismissRef} type="button" aria-label={t('editorV7.intent.close')} onClick={onDismiss} className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl hover:bg-white/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"><X size={15} /></button>
    </section>
  );
}
