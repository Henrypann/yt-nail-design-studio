/**
 * Community Intent 冲突探测（纯函数 · 无 Wizard store 依赖，便于 Node 门禁）。
 */

import { hasEditorDoc, inspectEditorDoc } from '@/studio/editor/lib/repo';

export type CommunityIntentConflictKind =
  | 'none'
  | 'wizard_draft'
  | 'frozen'
  | 'editor_doc';

export type CommunityIntentConflictSnapshot = {
  status: string;
  designId: string;
  customer: unknown;
  appliedShape: unknown;
  templateId: unknown;
  step: number;
  shape: unknown;
  length: unknown;
};

/** 根据 Wizard 快照 + version-neutral editor probe 判定冲突。 */
export function detectCommunityIntentConflictFromSnapshot(
  state: CommunityIntentConflictSnapshot,
): CommunityIntentConflictKind {
  if (state.status !== 'draft') return 'frozen';
  if (hasEditorDoc(state.designId)) return 'editor_doc';
  const probe = inspectEditorDoc(state.designId);
  if (probe.present) return 'editor_doc';

  const memoryBusy = Boolean(
    state.customer ||
      state.appliedShape ||
      state.templateId ||
      state.step === 2 ||
      state.shape ||
      state.length,
  );
  if (memoryBusy) return 'wizard_draft';
  return 'none';
}
