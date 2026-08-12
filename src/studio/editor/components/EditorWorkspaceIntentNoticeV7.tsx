import { useEffect, useRef } from 'react';
import { Eye, EyeOff, Layers3, Lock, ScanLine, X } from 'lucide-react';
import { Button, cx } from '@/design-system';
import type { EditorWorkspaceToolAvailabilityV7 } from '../v7/workspace-ia';
import { EDITOR_WORKSPACE_PERSONAL_STEP_META_V7 } from '../v7/workspace-step-factory';

const STATUS_LABEL = {
  switching: '正在切换设计',
  read_only: '当前设计只读',
  missing_step: '缺少对应工艺步骤',
  locked: '步骤已锁定',
  skipped: '步骤已跳过',
  hidden: '步骤已隐藏',
  geometry_unavailable: '甲型轮廓不可用于空间编辑',
  ready: '可以使用',
} as const;

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

const TOOL_LABEL = {
  select: '选择', background: '背景', brush: '画笔', eraser: '橡皮', shape: '图形', text: '文字', assets: '素材', effects: '效果', decorations: '立体',
} as const;

const STEP_LABEL = {
  background: '背景层', flat_design: '平面设计层', surface_effect: '表面效果层', dimensional_decoration: '立体装饰层', surface_finish: '表面完成层',
} as const;

function actionLabel(intent: EditorWorkspaceToolAvailabilityV7): string | null {
  if (intent.status === 'missing_step') {
    const meta = intent.requiredStepKind === 'flat_design'
      || intent.requiredStepKind === 'surface_effect'
      || intent.requiredStepKind === 'dimensional_decoration'
      ? EDITOR_WORKSPACE_PERSONAL_STEP_META_V7[intent.requiredStepKind]
      : null;
    return meta ? `添加${meta.label}并继续` : null;
  }
  if (intent.status === 'locked') return '解锁并继续';
  if (intent.status === 'skipped') return '取消跳过并继续';
  if (intent.status === 'hidden') return '恢复显示并继续';
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
  const actionRef = useRef<HTMLButtonElement>(null);
  const dismissRef = useRef<HTMLButtonElement>(null);
  const action = actionLabel(intent);
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
        <span><strong className="block font-semibold">{STATUS_LABEL[intent.status]}</strong><span className="mt-0.5 block leading-5">{intent.reason ?? '当前工具尚不可用。'}</span></span>
      </span>
      <span className="flex flex-wrap gap-1 text-[10px]" aria-label="工具与层级目标">
        <span className="rounded-full border border-current/15 bg-white/70 px-2 py-1">工具 · {TOOL_LABEL[intent.id]}</span>
        <span className="rounded-full border border-current/15 bg-white/70 px-2 py-1">步骤 · {STEP_LABEL[intent.requiredStepKind]}</span>
        <span className="rounded-full border border-current/15 bg-white/70 px-2 py-1">恢复后同步高亮</span>
      </span>
      {action && <Button ref={actionRef} size="sm" className="min-h-11" onClick={onResolve}>{action}</Button>}
      <button ref={dismissRef} type="button" aria-label="关闭工具提示" onClick={onDismiss} className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl hover:bg-white/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"><X size={15} /></button>
    </section>
  );
}
