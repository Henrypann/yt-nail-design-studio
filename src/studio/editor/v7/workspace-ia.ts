import type { NailDesignV7, ProcessStepV7 } from './model';
import { resolveBackgroundSilhouetteV7 } from './background';

export type EditorWorkspaceStageIdV7 =
  | 'geometry'
  | 'background'
  | 'personalize'
  | 'finish'
  | 'customer';

export type EditorWorkspaceStageStateV7 = 'configured' | 'attention' | 'empty' | 'unavailable';

export interface EditorWorkspaceStageV7 {
  id: EditorWorkspaceStageIdV7;
  label: string;
  shortLabel: string;
  description: string;
  state: EditorWorkspaceStageStateV7;
  active: boolean;
  count?: number;
  targetStepId: string | null;
}

const PERSONAL_STEP_KINDS = new Set<ProcessStepV7['kind']>([
  'flat_design',
  'surface_effect',
  'dimensional_decoration',
]);

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
  const personalSteps = nail.steps.filter((step) => PERSONAL_STEP_KINDS.has(step.kind));
  const finish = nail.steps.find((step) => step.kind === 'surface_finish') ?? null;
  const geometry = resolveBackgroundSilhouetteV7(nail.geometryRef);
  const activePersonalSteps = personalSteps.filter((step) => step.visible && !step.skipped).length;
  const hiddenPersonalSteps = personalSteps.filter((step) => !step.visible).length;
  const skippedPersonalSteps = personalSteps.filter((step) => step.skipped).length;

  return [
    {
      id: 'geometry',
      label: '甲型与适配',
      shortLabel: '甲型',
      description: geometry.label,
      state: geometry.source === 'product' ? 'configured' : 'attention',
      active: currentStage === 'geometry',
      targetStepId: null,
    },
    {
      id: 'background',
      label: '基础背景',
      shortLabel: '背景',
      description: background?.kind === 'background' ? background.background.mode : '缺少背景',
      state: background ? (background.visible ? 'configured' : 'attention') : 'unavailable',
      active: currentStage === 'background',
      targetStepId: background?.id ?? null,
    },
    {
      id: 'personalize',
      label: '个性化设计',
      shortLabel: '设计',
      description: personalSteps.length > 0
        ? `${personalSteps.length} 个步骤 · ${activePersonalSteps} 启用 · ${skippedPersonalSteps} 跳过 · ${hiddenPersonalSteps} 隐藏`
        : '尚未添加设计步骤',
      state: personalSteps.length > 0 ? 'configured' : 'empty',
      active: currentStage === 'personalize',
      count: personalSteps.length,
      targetStepId: personalSteps[0]?.id ?? null,
    },
    {
      id: 'finish',
      label: '表面封层',
      shortLabel: '封层',
      description: finish?.kind === 'surface_finish' ? finish.finish.type : '缺少最终封层',
      state: finish ? 'configured' : 'unavailable',
      active: currentStage === 'finish',
      targetStepId: finish?.id ?? null,
    },
    {
      id: 'customer',
      label: '顾客确认',
      shortLabel: '确认',
      description: '只读预览已可用 · 确认待 V7-16',
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
  | 'shape'
  | 'text'
  | 'assets'
  | 'effects'
  | 'decorations';

export interface EditorWorkspaceToolAvailabilityV7 {
  id: EditorWorkspaceToolIdV7;
  enabled: boolean;
  targetStepId: string | null;
  reason?: string;
}

export function deriveEditorWorkspaceToolsV7(nail: NailDesignV7): EditorWorkspaceToolAvailabilityV7[] {
  const background = nail.steps.find((step) => step.kind === 'background') ?? null;
  const flat = nail.steps.find((step) => step.kind === 'flat_design') ?? null;
  const effect = nail.steps.find((step) => step.kind === 'surface_effect') ?? null;
  const decoration = nail.steps.find((step) => step.kind === 'dimensional_decoration') ?? null;
  const needsFlat = flat ? undefined : '请先在右侧层级中添加平面设计步骤';

  return [
    { id: 'select', enabled: Boolean(flat), targetStepId: flat?.id ?? null, reason: needsFlat },
    { id: 'background', enabled: Boolean(background), targetStepId: background?.id ?? null },
    { id: 'brush', enabled: Boolean(flat), targetStepId: flat?.id ?? null, reason: needsFlat },
    { id: 'eraser', enabled: Boolean(flat), targetStepId: flat?.id ?? null, reason: needsFlat },
    { id: 'shape', enabled: Boolean(flat), targetStepId: flat?.id ?? null, reason: needsFlat },
    { id: 'text', enabled: false, targetStepId: flat?.id ?? null, reason: '文字与素材在 V7-10 开放' },
    { id: 'assets', enabled: false, targetStepId: flat?.id ?? null, reason: '文字与素材在 V7-10 开放' },
    { id: 'effects', enabled: false, targetStepId: effect?.id ?? null, reason: '表面效果编辑在 V7-12 开放' },
    { id: 'decorations', enabled: false, targetStepId: decoration?.id ?? null, reason: '立体装饰编辑在 V7-13 开放' },
  ];
}
