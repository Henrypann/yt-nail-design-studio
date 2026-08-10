import type { ProcessStepV7 } from './model';
import { getProcessStepTypeDefinitionV7 } from './registry';

export interface ProcessStepWorkspacePolicyV7 {
  canMoveUp: boolean;
  canMoveDown: boolean;
  canDelete: boolean;
  canDuplicate: boolean;
  canSkip: boolean;
  canHide: boolean;
}

export function getProcessStepWorkspacePolicyV7(
  steps: readonly ProcessStepV7[],
  index: number,
): ProcessStepWorkspacePolicyV7 | null {
  const step = steps[index];
  if (!step) return null;
  const definition = getProcessStepTypeDefinitionV7(step.typeId);
  if (!definition || definition.kind !== step.kind) return null;
  return {
    canMoveUp: definition.movable && index > 1,
    canMoveDown: definition.movable && index < steps.length - 2,
    canDelete: definition.deletable,
    canDuplicate: definition.duplicable,
    canSkip: definition.skippable,
    canHide: step.kind !== 'surface_finish',
  };
}

export function hasCanonicalProcessStepOrderV7(steps: readonly ProcessStepV7[]): boolean {
  return steps.length >= 2 &&
    steps[0].kind === 'background' &&
    steps[steps.length - 1].kind === 'surface_finish' &&
    steps.slice(1, -1).every((step) =>
      step.kind === 'flat_design' ||
      step.kind === 'surface_effect' ||
      step.kind === 'dimensional_decoration',
    );
}
