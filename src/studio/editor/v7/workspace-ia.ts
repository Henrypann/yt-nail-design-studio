import type { NailDesignV7, ProcessStepV7 } from './model';
import type { MessageKey, MessageParams } from '@/lib/i18n/types';
import { resolveBackgroundSilhouetteV7 } from './background';
import { resolveEditorGeometryV7 } from './geometry-registry';

export type EditorWorkspaceStageIdV7 =
  | 'geometry'
  | 'background'
  | 'personalize'
  | 'finish'
  | 'customer';

export type EditorWorkspaceStageStateV7 = 'configured' | 'attention' | 'empty' | 'unavailable';

export interface EditorWorkspaceStageV7 {
  id: EditorWorkspaceStageIdV7;
  labelKey: MessageKey;
  shortLabelKey: MessageKey;
  descriptionKey: MessageKey;
  descriptionParams?: MessageParams;
  state: EditorWorkspaceStageStateV7;
  active: boolean;
  count?: number;
  targetStepId: string | null;
  lanes?: EditorWorkspaceStepLaneV7[];
}

const PERSONAL_STEP_KINDS = [
  'flat_design',
  'surface_effect',
  'dimensional_decoration',
] as const satisfies readonly ProcessStepV7['kind'][];

export type EditorWorkspaceStepLaneIdV7 = 'flat' | 'effects' | 'decorations';
export type EditorWorkspaceStepLaneStateV7 = 'configured' | 'attention' | 'empty';

export interface EditorWorkspaceStepLaneV7 {
  id: EditorWorkspaceStepLaneIdV7;
  kind: (typeof PERSONAL_STEP_KINDS)[number];
  toolId: 'brush' | 'effects' | 'decorations';
  labelKey: MessageKey;
  state: EditorWorkspaceStepLaneStateV7;
  active: boolean;
  count: number;
  activeCount: number;
  targetStepId: string | null;
}

const LANE_META: ReadonlyArray<Pick<EditorWorkspaceStepLaneV7, 'id' | 'kind' | 'toolId' | 'labelKey'>> = [
  { id: 'flat', kind: 'flat_design', toolId: 'brush', labelKey: 'editorV7.workspace.lane.flat' },
  { id: 'effects', kind: 'surface_effect', toolId: 'effects', labelKey: 'editorV7.workspace.lane.effects' },
  { id: 'decorations', kind: 'dimensional_decoration', toolId: 'decorations', labelKey: 'editorV7.workspace.lane.decorations' },
];

function preferredStepForKindV7(
  nail: NailDesignV7,
  kind: ProcessStepV7['kind'],
  selectedStepId: string | null | undefined,
): ProcessStepV7 | null {
  const compatible = nail.steps.filter((step) => step.kind === kind);
  return compatible.find((step) => step.id === selectedStepId)
    ?? compatible.find((step) => step.visible && !step.skipped && !step.locked)
    ?? compatible.find((step) => step.visible && !step.skipped)
    ?? compatible[0]
    ?? null;
}

function preferredSelectableStepV7(
  nail: NailDesignV7,
  selectedStepId: string | null | undefined,
): ProcessStepV7 | null {
  const compatible = nail.steps.filter((step) => PERSONAL_STEP_KINDS.includes(step.kind as (typeof PERSONAL_STEP_KINDS)[number]));
  return compatible.find((step) => step.id === selectedStepId)
    ?? compatible.find((step) => step.visible && !step.skipped && !step.locked)
    ?? compatible.find((step) => step.visible && !step.skipped)
    ?? compatible[0]
    ?? null;
}

/** Three parallel personalization lanes derived from canonical process steps. */
export function deriveEditorWorkspaceStepLanesV7(
  nail: NailDesignV7,
  selectedStepId: string | null,
): EditorWorkspaceStepLaneV7[] {
  const selectedStep = nail.steps.find((step) => step.id === selectedStepId) ?? null;
  return LANE_META.map((meta) => {
    const steps = nail.steps.filter((step) => step.kind === meta.kind);
    const activeCount = steps.filter((step) => step.visible && !step.skipped).length;
    return {
      ...meta,
      state: steps.length === 0 ? 'empty' : activeCount === steps.length ? 'configured' : 'attention',
      active: selectedStep?.kind === meta.kind,
      count: steps.length,
      activeCount,
      targetStepId: preferredStepForKindV7(nail, meta.kind, selectedStepId)?.id ?? null,
    };
  });
}

export function editorWorkspaceStageForStepV7(
  step: ProcessStepV7 | null | undefined,
): EditorWorkspaceStageIdV7 {
  if (!step) return 'geometry';
  if (step.kind === 'background') return 'background';
  if (step.kind === 'surface_finish') return 'finish';
  return 'personalize';
}

/**
 * Stage presentation is derived from the current nail and UI selection only.
 * It never persists completion state and never mutates EditorDocV7.
 */
export function deriveEditorWorkspaceStagesV7(
  nail: NailDesignV7,
  selectedStepId: string | null,
): EditorWorkspaceStageV7[] {
  const selectedStep = nail.steps.find((step) => step.id === selectedStepId) ?? null;
  const currentStage = editorWorkspaceStageForStepV7(selectedStep);
  const background = nail.steps.find((step) => step.kind === 'background') ?? null;
  const personalSteps = nail.steps.filter((step) => PERSONAL_STEP_KINDS.includes(step.kind as (typeof PERSONAL_STEP_KINDS)[number]));
  const finish = nail.steps.find((step) => step.kind === 'surface_finish') ?? null;
  const geometry = resolveBackgroundSilhouetteV7(nail.geometryRef, nail.finger);
  const lanes = deriveEditorWorkspaceStepLanesV7(nail, selectedStepId);
  const activePersonalSteps = personalSteps.filter((step) => step.visible && !step.skipped).length;
  const hiddenPersonalSteps = personalSteps.filter((step) => !step.visible).length;
  const skippedPersonalSteps = personalSteps.filter((step) => step.skipped).length;

  return [
    {
      id: 'geometry',
      labelKey: 'editorV7.workspace.stage.geometry',
      shortLabelKey: 'editorV7.workspace.stage.geometryShort',
      descriptionKey: geometry.fidelity === 'exact' ? 'editorV7.workspace.stage.geometryExact' : geometry.fidelity === 'approximate' ? 'editorV7.workspace.stage.geometryApproximate' : 'editorV7.workspace.stage.geometryUnavailable',
      state: geometry.fidelity === 'exact' ? 'configured' : 'attention',
      active: currentStage === 'geometry',
      targetStepId: null,
    },
    {
      id: 'background',
      labelKey: 'editorV7.workspace.stage.background',
      shortLabelKey: 'editorV7.workspace.stage.backgroundShort',
      descriptionKey: background ? 'editorV7.background.modeLabel' : 'editorV7.workspace.stage.backgroundMissing',
      state: background ? (background.visible ? 'configured' : 'attention') : 'unavailable',
      active: currentStage === 'background',
      targetStepId: background?.id ?? null,
    },
    {
      id: 'personalize',
      labelKey: 'editorV7.workspace.stage.personalize',
      shortLabelKey: 'editorV7.workspace.stage.personalizeShort',
      descriptionKey: personalSteps.length > 0 ? 'editorV7.workspace.stage.personalizeSummary' : 'editorV7.workspace.stage.personalizeEmpty',
      descriptionParams: personalSteps.length > 0 ? { total: personalSteps.length, active: activePersonalSteps, skipped: skippedPersonalSteps, hidden: hiddenPersonalSteps } : undefined,
      state: personalSteps.length === 0
        ? 'empty'
        : activePersonalSteps === personalSteps.length
          ? 'configured'
          : 'attention',
      active: currentStage === 'personalize',
      count: personalSteps.length,
      targetStepId: selectedStep && PERSONAL_STEP_KINDS.includes(selectedStep.kind as (typeof PERSONAL_STEP_KINDS)[number])
        ? selectedStep.id
        : personalSteps.find((step) => step.visible && !step.skipped)?.id ?? personalSteps[0]?.id ?? null,
      lanes,
    },
    {
      id: 'finish',
      labelKey: 'editorV7.workspace.stage.finish',
      shortLabelKey: 'editorV7.workspace.stage.finishShort',
      descriptionKey: finish ? 'editorV7.layers.appliedFinish' : 'editorV7.workspace.stage.finishMissing',
      state: finish ? 'configured' : 'unavailable',
      active: currentStage === 'finish',
      targetStepId: finish?.id ?? null,
    },
    {
      id: 'customer',
      labelKey: 'editorV7.workspace.stage.customer',
      shortLabelKey: 'editorV7.workspace.stage.customerShort',
      descriptionKey: 'editorV7.workspace.stage.customerPending',
      state: 'empty',
      active: false,
      targetStepId: null,
    },
  ];
}

export type EditorWorkspaceToolIdV7 =
  | 'select'
  | 'background'
  | 'brush'
  | 'eraser'
  | 'line'
  | 'french'
  | 'shape'
  | 'text'
  | 'assets'
  | 'effects'
  | 'decorations'
  | 'finish';

export interface EditorWorkspaceToolAvailabilityV7 {
  id: EditorWorkspaceToolIdV7;
  enabled: boolean;
  status: EditorWorkspaceToolStatusV7;
  requiredStepKind: ProcessStepV7['kind'];
  targetStepId: string | null;
  reason?: string;
}

export type EditorWorkspaceToolStatusV7 =
  | 'ready'
  | 'switching'
  | 'read_only'
  | 'missing_step'
  | 'geometry_unavailable'
  | 'locked'
  | 'skipped'
  | 'hidden';

export interface EditorWorkspaceToolContextV7 {
  selectedStepId?: string | null;
  readOnly?: boolean;
  switching?: boolean;
}

const TOOL_STEP_KIND: Record<EditorWorkspaceToolIdV7, ProcessStepV7['kind']> = {
  select: 'flat_design',
  background: 'background',
  brush: 'flat_design',
  eraser: 'flat_design',
  line: 'flat_design',
  french: 'flat_design',
  shape: 'flat_design',
  text: 'flat_design',
  assets: 'flat_design',
  effects: 'surface_effect',
  decorations: 'dimensional_decoration',
  finish: 'surface_finish',
};

const MISSING_STEP_REASON: Partial<Record<ProcessStepV7['kind'], string>> = {
  flat_design: '需要先添加平面设计步骤；确认后才能使用此工具',
  surface_effect: '需要先添加表面效果步骤；确认后才能编辑局部效果',
  dimensional_decoration: '需要先添加立体装饰步骤；确认后才能添加立体内容',
};

function toolStatusForStepV7(
  step: ProcessStepV7 | null,
  context: EditorWorkspaceToolContextV7,
): { status: EditorWorkspaceToolStatusV7; reason?: string } {
  if (context.switching) return { status: 'switching', reason: '正在安全保存并切换设计，请稍后重试' };
  if (context.readOnly) return { status: 'read_only', reason: '当前设计为只读状态；可以查看，但不能修改步骤' };
  if (!step) return { status: 'missing_step' };
  if (step.locked) return { status: 'locked', reason: '对应步骤已锁定；请先在层级面板解锁' };
  if (step.skipped) return { status: 'skipped', reason: '对应步骤已跳过；请先取消跳过' };
  if (!step.visible) return { status: 'hidden', reason: '对应步骤已隐藏；请先恢复显示' };
  return { status: 'ready' };
}

/**
 * Resolve a tool intent against the selected compatible step first, then the
 * first active canonical step. This prevents repeated step kinds from silently
 * jumping back to their first occurrence.
 */
export function deriveEditorWorkspaceToolsV7(
  nail: NailDesignV7,
  context: EditorWorkspaceToolContextV7 = {},
): EditorWorkspaceToolAvailabilityV7[] {
  const geometry = resolveEditorGeometryV7(nail.geometryRef, nail.finger);
  return (Object.keys(TOOL_STEP_KIND) as EditorWorkspaceToolIdV7[]).map((id) => {
    const kind = TOOL_STEP_KIND[id];
    const step = id === 'select'
      ? preferredSelectableStepV7(nail, context.selectedStepId)
      : preferredStepForKindV7(nail, kind, context.selectedStepId);
    let resolved = toolStatusForStepV7(step, context);
    if (resolved.status === 'ready' && id !== 'background' && id !== 'select' && geometry.fidelity !== 'exact') {
      resolved = {
        status: 'geometry_unavailable',
        reason: geometry.fidelity === 'approximate'
          ? '当前指位只有未签收的近似轮廓；空间编辑需绑定已签收 2D geometry'
          : '当前指位未解析到可用 geometry；空间编辑已停用，原引用保持不变',
      };
    }
    const reason = resolved.status === 'missing_step' ? MISSING_STEP_REASON[kind] : resolved.reason;
    return {
      id,
      enabled: resolved.status === 'ready',
      status: resolved.status,
      requiredStepKind: step?.kind ?? kind,
      targetStepId: step?.id ?? null,
      ...(reason ? { reason } : {}),
    };
  });
}

export interface EditorSelectionContinuityV7 {
  /** Step resolved in the target nail; null only when the target has no background. */
  selectedStepId: string | null;
  /** True when the source step mapped to the exact same kind+ordinal step in the target. */
  exact: boolean;
}

/**
 * Pure cross-finger selection resolver (EDITOR-V7-14.3).
 *
 * Maps the source nail's selected step to the exact same kind + ordinal step in
 * the target nail. Locked/skipped/hidden target steps are preserved as exact
 * matches — the resolver selects them, it never guesses an active sibling.
 * When the source selection is invalid or the target lacks that exact ordinal,
 * it falls back to the target background step and reports `exact: false`.
 * It never clamps to the first/last same-kind step and never mutates either
 * nail; the caller owns all selection writes.
 */
export function resolveSelectionContinuityV7(
  sourceNail: NailDesignV7,
  targetNail: NailDesignV7,
  selectedStepId: string | null,
): EditorSelectionContinuityV7 {
  const sourceStep = selectedStepId === null
    ? null
    : sourceNail.steps.find((step) => step.id === selectedStepId) ?? null;
  const targetBackground = targetNail.steps.find((step) => step.kind === 'background') ?? null;
  if (!sourceStep) {
    return { selectedStepId: targetBackground?.id ?? null, exact: false };
  }
  const ordinal = sourceNail.steps
    .filter((step) => step.kind === sourceStep.kind)
    .findIndex((step) => step.id === sourceStep.id);
  const sameKindInTarget = targetNail.steps.filter((step) => step.kind === sourceStep.kind);
  const targetStep = sameKindInTarget[ordinal] ?? null;
  if (!targetStep) {
    return { selectedStepId: targetBackground?.id ?? null, exact: false };
  }
  return { selectedStepId: targetStep.id, exact: true };
}

/** Repair UI selection after commands or history replacement; never writes the doc. */
export function repairEditorWorkspaceSelectionV7(
  nail: NailDesignV7,
  selectedStepId: string | null,
  selectedElementId: string | null,
): { selectedStepId: string | null; selectedElementId: string | null } {
  const selectedStep = nail.steps.find((step) => step.id === selectedStepId) ?? nail.steps[0] ?? null;
  if (!selectedStep) return { selectedStepId: null, selectedElementId: null };
  const elements = selectedStep.kind === 'flat_design'
    ? selectedStep.elements
    : selectedStep.kind === 'dimensional_decoration'
      ? selectedStep.decorations
      : [];
  return {
    selectedStepId: selectedStep.id,
    selectedElementId: elements.some((element) => element.id === selectedElementId) ? selectedElementId : null,
  };
}
