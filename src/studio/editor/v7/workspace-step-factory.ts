import { generateEditorV7Id, type EditorV7IdFactory } from './id';
import type { FingerCode } from '../../../lib/types';
import { addEditorV7Step, type EditorV7CommandResult } from './commands';
import type { EditorDocV7, ProcessStepV7 } from './model';
import { PROCESS_STEP_TYPE_IDS_V7 } from './registry';
import { createDefaultSurfaceEffectPayloadV7, createSurfaceEffectMaskV7 } from './surface-effect';

export type EditorWorkspacePersonalStepKindV7 =
  | 'flat_design'
  | 'surface_effect'
  | 'dimensional_decoration';

export const EDITOR_WORKSPACE_PERSONAL_STEP_META_V7 = {
  flat_design: {
    label: '平面设计',
    shortLabel: '平面',
    description: '画笔、文字、贴纸、形状与 2D 导入',
  },
  surface_effect: {
    label: '表面效果',
    shortLabel: '效果',
    description: '局部猫眼、闪粉、镜面与晕染',
  },
  dimensional_decoration: {
    label: '立体装饰',
    shortLabel: '立体',
    description: '浮雕、液滴、堆胶、雕花与饰品',
  },
} as const satisfies Record<EditorWorkspacePersonalStepKindV7, {
  label: string;
  shortLabel: string;
  description: string;
}>;

/**
 * One shared constructor for every explicit workspace entry point. It creates
 * a single canonical middle step and performs no store or persistence writes.
 */
export function createEditorWorkspacePersonalStepV7(
  kind: EditorWorkspacePersonalStepKindV7,
  idFactory: EditorV7IdFactory = generateEditorV7Id,
): ProcessStepV7 {
  const id = idFactory('step');
  if (kind === 'flat_design') {
    return {
      id,
      typeId: PROCESS_STEP_TYPE_IDS_V7.flat_design,
      kind,
      name: '平面设计',
      visible: true,
      locked: false,
      skipped: false,
      materialRefs: [],
      elements: [],
    };
  }
  if (kind === 'surface_effect') {
    return {
      id,
      typeId: PROCESS_STEP_TYPE_IDS_V7.surface_effect,
      kind,
      name: '局部表面效果',
      visible: true,
      locked: false,
      skipped: false,
      materialRefs: [],
      effect: createDefaultSurfaceEffectPayloadV7('cat_eye', `${id}-cat-eye`),
      mask: createSurfaceEffectMaskV7('center'),
    };
  }
  return {
    id,
    typeId: PROCESS_STEP_TYPE_IDS_V7.dimensional_decoration,
    kind,
    name: '立体装饰',
    visible: true,
    locked: false,
    skipped: false,
    materialRefs: [],
    decorations: [],
  };
}

/**
 * Idempotent onboarding command: a repeated confirm cannot create a second
 * step of the same kind. Explicit Layer-panel Add remains the repeatable path.
 */
export function addMissingEditorWorkspacePersonalStepV7(
  doc: EditorDocV7,
  finger: FingerCode,
  kind: EditorWorkspacePersonalStepKindV7,
  idFactory: EditorV7IdFactory = generateEditorV7Id,
): EditorV7CommandResult {
  const nail = doc.nails[finger];
  if (nail.steps.some((step) => step.kind === kind)) {
    return { ok: false, reason: 'not_allowed', message: `${kind} step already exists` };
  }
  return addEditorV7Step(
    doc,
    finger,
    createEditorWorkspacePersonalStepV7(kind, idFactory),
    nail.steps.length - 1,
  );
}
