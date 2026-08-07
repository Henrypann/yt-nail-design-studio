import type { Customer, NailLength, NailShape } from '@/lib/types';

export interface WizardSummaryPrerequisites {
  customer: Customer | null;
  appliedShape: NailShape | null;
  appliedLength: NailLength | null;
  baseColor: string | null;
}

export interface ReadyWizardSummaryPrerequisites extends WizardSummaryPrerequisites {
  appliedShape: NailShape;
  appliedLength: NailLength;
  baseColor: string;
}

/** Customer assignment is optional until the design is confirmed. */
export function canBuildWizardSummary(
  state: WizardSummaryPrerequisites,
): state is ReadyWizardSummaryPrerequisites {
  return Boolean(state.appliedShape && state.appliedLength && state.baseColor);
}

/** DesignSummary uses an empty ID for the existing unassigned-design state. */
export function wizardSummaryCustomerId(customer: Customer | null): string {
  return customer?.id ?? '';
}

export function missingWizardSummaryFields(state: WizardSummaryPrerequisites): string[] {
  const missing: string[] = [];
  if (!state.appliedShape) missing.push('甲型');
  if (!state.appliedLength) missing.push('长度');
  if (!state.baseColor) missing.push('底色');
  return missing;
}
