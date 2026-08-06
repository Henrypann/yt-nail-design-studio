/**
 * Studio 侧消费 Community StudioImportIntent（唯一 Store 通路 · PR-02）。
 * 使用 version-neutral editor probe，避免 getEditorDoc 迁移副作用。
 */

import { hasEditorDoc } from '@/studio/editor/lib/repo';
import { useWizardStore } from '@/studio/wizard/wizard-store';
import {
  clearStudioImportIntent,
  type StudioImportIntentV1,
} from '@/community/domain/studio-import-intent';
import { loadLibraryIndex, type TemplateEntry } from '@/studio/preview/material-library';
import type { NailLength, NailShape } from '@/lib/types';
import {
  detectCommunityIntentConflictFromSnapshot,
  type CommunityIntentConflictKind,
} from '@/studio/wizard/community-intent-conflict';

export type { CommunityIntentConflictKind };

const SHAPES = new Set<NailShape>(['almond', 'oval', 'coffin', 'squoval', 'square']);
const LENGTHS = new Set<NailLength>(['short', 'medium', 'long', 'extra-long']);

function asShape(value: string | undefined): NailShape | undefined {
  return value && SHAPES.has(value as NailShape) ? (value as NailShape) : undefined;
}

function asLength(value: string | undefined): NailLength | undefined {
  return value && LENGTHS.has(value as NailLength) ? (value as NailLength) : undefined;
}

/** 是否存在需显式选择的 Wizard 工作态（草稿 / 冻结 / 已有 Editor raw）。 */
export function detectCommunityIntentConflict(): CommunityIntentConflictKind {
  return detectCommunityIntentConflictFromSnapshot(useWizardStore.getState());
}

export async function resolveIntentTemplate(
  intent: StudioImportIntentV1,
): Promise<TemplateEntry | null> {
  const index = await loadLibraryIndex();
  return (
    index.templates.find(
      (t) => t.id === intent.assetRef.templateId || t.id === intent.assetRef.renderTemplateId,
    ) ?? null
  );
}

export type ApplyCommunityIntentResult =
  | { ok: true }
  | { ok: false; reason: 'frozen' | 'editor_doc' | 'template_missing' };

/**
 * 应用 Intent：current 不得覆盖 frozen / editor_doc；
 * new 先 resetForNewDesign 再 applyTemplate。
 */
export async function applyCommunityImportIntent(
  intent: StudioImportIntentV1,
  mode: 'current' | 'new',
): Promise<ApplyCommunityIntentResult> {
  const conflict = detectCommunityIntentConflict();
  if (mode === 'current') {
    if (conflict === 'frozen') return { ok: false, reason: 'frozen' };
    if (conflict === 'editor_doc') return { ok: false, reason: 'editor_doc' };
  }

  const template = await resolveIntentTemplate(intent);
  if (!template) {
    clearStudioImportIntent(intent.intentId);
    return { ok: false, reason: 'template_missing' };
  }

  if (mode === 'new') {
    useWizardStore.getState().resetForNewDesign();
  }

  const store = useWizardStore.getState();
  const shape = asShape(intent.suggestedContext?.shape);
  const length = asLength(intent.suggestedContext?.length);

  if (shape && length && store.status === 'draft' && !hasEditorDoc(store.designId)) {
    useWizardStore.setState({
      shape,
      length,
      appliedShape: shape,
      appliedLength: length,
      step: 2,
      pickerOpen: false,
    });
  } else if (store.status === 'draft' && !store.appliedShape && shape && length) {
    useWizardStore.setState({ shape, length, step: 1 });
  }

  useWizardStore.getState().applyTemplate(template);
  clearStudioImportIntent(intent.intentId);
  return { ok: true };
}

export function cancelCommunityImportIntent(intentId: string): void {
  clearStudioImportIntent(intentId);
}
