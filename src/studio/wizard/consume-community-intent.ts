/**
 * Studio 侧消费 Community StudioImportIntent（唯一 Store 通路 · PR-02）。
 * 使用 version-neutral editor probe，避免 getEditorDoc 迁移副作用。
 */

import { hasEditorDoc } from '@/studio/editor/lib/repo-v6';
import { useWizardStore } from '@/studio/wizard/wizard-store';
import { getContentById } from '@/community/data/content-repository';
import { clearStudioImportIntent } from '@/community/domain/studio-import-intent';
import { loadLibraryIndex } from '@/studio/preview/material-library';
import {
  consumeCommunityImportIntent as consumeWithDeps,
  type CommunityIntentConsumeDeps,
  type ConsumeCommunityIntentResult,
} from '@/studio/wizard/community-intent-apply';
import {
  detectCommunityIntentConflictFromSnapshot,
  type CommunityIntentConflictKind,
} from '@/studio/wizard/community-intent-conflict';

export type { CommunityIntentConflictKind, ConsumeCommunityIntentResult };

/** 是否存在需显式选择的 Wizard 工作态（草稿 / 冻结 / 已有 Editor raw）。 */
export function detectCommunityIntentConflict(): CommunityIntentConflictKind {
  return detectCommunityIntentConflictFromSnapshot(useWizardStore.getState());
}

function liveWizardApi(): CommunityIntentConsumeDeps['wizard'] {
  return {
    getSnapshot: () => useWizardStore.getState(),
    hasEditorDoc,
    resetForNewDesign: () => useWizardStore.getState().resetForNewDesign(),
    setShapeLengthDraft: ({ shape, length, enterStep2 }) => {
      if (enterStep2) {
        useWizardStore.setState({
          shape,
          length,
          appliedShape: shape,
          appliedLength: length,
          step: 2,
          pickerOpen: false,
        });
      } else {
        useWizardStore.setState({ shape, length, step: 1 });
      }
    },
    applyTemplate: (template) => useWizardStore.getState().applyTemplate(template),
  };
}

export function createLiveConsumeDeps(
  overrides?: Partial<CommunityIntentConsumeDeps>,
): CommunityIntentConsumeDeps {
  return {
    getContentById: overrides?.getContentById ?? getContentById,
    loadLibraryIndex: overrides?.loadLibraryIndex ?? loadLibraryIndex,
    wizard: overrides?.wizard ?? liveWizardApi(),
  };
}

/**
 * 应用前最终校验 + 写入 Wizard。
 * UI 与 clean 自动路径共用，避免行为漂移。
 */
export async function consumeCommunityImportIntent(
  intentId: string,
  mode: 'current' | 'new',
  deps?: Partial<CommunityIntentConsumeDeps>,
): Promise<ConsumeCommunityIntentResult> {
  return consumeWithDeps(intentId, mode, createLiveConsumeDeps(deps));
}

/** @deprecated 使用 consumeCommunityImportIntent；保留薄封装兼容旧调用。 */
export async function applyCommunityImportIntent(
  intent: { intentId: string },
  mode: 'current' | 'new',
  deps?: Partial<CommunityIntentConsumeDeps>,
): Promise<ConsumeCommunityIntentResult> {
  return consumeCommunityImportIntent(intent.intentId, mode, deps);
}

export function cancelCommunityImportIntent(intentId: string): void {
  clearStudioImportIntent(intentId);
}
