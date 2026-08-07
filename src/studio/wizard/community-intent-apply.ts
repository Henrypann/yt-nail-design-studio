/**
 * Community Intent 应用编排（可注入依赖 · 便于 Node 行为测试，无 Wizard store 硬耦合）。
 */

import type { CommunityContentV1 } from '@/community/domain/types';
import {
  clearStudioImportIntent,
  peekStudioImportIntentRaw,
  validateStudioImportIntent,
  type StudioImportIntentV1,
} from '@/community/domain/studio-import-intent';
import type { NailLength, NailShape } from '@/lib/types';
import type { TemplateEntry } from '@/studio/preview/material-library';
import {
  detectCommunityIntentConflictFromSnapshot,
  type CommunityIntentConflictKind,
  type CommunityIntentConflictSnapshot,
} from '@/studio/wizard/community-intent-conflict';

const SHAPES = new Set<NailShape>(['almond', 'oval', 'coffin', 'squoval', 'square']);
const LENGTHS = new Set<NailLength>(['short', 'medium', 'long', 'extra-long']);

function asShape(value: string | undefined): NailShape | undefined {
  return value && SHAPES.has(value as NailShape) ? (value as NailShape) : undefined;
}

function asLength(value: string | undefined): NailLength | undefined {
  return value && LENGTHS.has(value as NailLength) ? (value as NailLength) : undefined;
}

export type WizardIntentApplyApi = {
  getSnapshot: () => CommunityIntentConflictSnapshot & {
    appliedShape: NailShape | null;
  };
  hasEditorDoc: (designId: string) => boolean;
  resetForNewDesign: () => void;
  setShapeLengthDraft: (input: {
    shape: NailShape;
    length: NailLength;
    enterStep2: boolean;
  }) => void;
  applyTemplate: (template: TemplateEntry) => void;
};

export type CommunityIntentConsumeDeps = {
  getContentById: (contentId: string) => Promise<CommunityContentV1 | null>;
  loadLibraryIndex: () => Promise<{ templates: TemplateEntry[] }>;
  wizard: WizardIntentApplyApi;
};

export type ConsumeCommunityIntentResult =
  | { ok: true; intent: StudioImportIntentV1; mode: 'current' | 'new' }
  | {
      ok: false;
      reason:
        | 'validation'
        | 'frozen'
        | 'editor_doc'
        | 'template_missing'
        | 'load_failed';
      validationReason?: string;
      intent?: StudioImportIntentV1 | null;
      /** 校验失败清除前的导航提示（可能已无完整合法 Intent）。 */
      recovery?: { contentId?: string; returnTo?: string } | null;
    };

async function resolveTemplate(
  intent: StudioImportIntentV1,
  loadLibraryIndex: CommunityIntentConsumeDeps['loadLibraryIndex'],
): Promise<TemplateEntry | null> {
  const index = await loadLibraryIndex();
  return (
    index.templates.find(
      (t) => t.id === intent.assetRef.templateId || t.id === intent.assetRef.renderTemplateId,
    ) ?? null
  );
}

/**
 * 消费前最终校验 + 应用。所有异步失败路径不得写入 Wizard。
 * 校验失败会清除 Intent；load_failed 保留 Intent 供重试。
 */
export async function consumeCommunityImportIntent(
  intentId: string,
  mode: 'current' | 'new',
  deps: CommunityIntentConsumeDeps,
): Promise<ConsumeCommunityIntentResult> {
  const preliminary = peekStudioImportIntentRaw(intentId);
  const recovery = preliminary
    ? { contentId: preliminary.contentId, returnTo: preliminary.returnTo }
    : null;

  try {
    const content = preliminary?.contentId
      ? await deps.getContentById(preliminary.contentId)
      : null;

    const validated = validateStudioImportIntent(intentId, content);
    if (!validated.ok) {
      return {
        ok: false,
        reason: 'validation',
        validationReason: validated.reason,
        intent: null,
        recovery,
      };
    }

    const intent = validated.intent;
    const conflict = detectCommunityIntentConflictFromSnapshot(deps.wizard.getSnapshot());
    if (mode === 'current') {
      if (conflict === 'frozen') {
        return { ok: false, reason: 'frozen', intent };
      }
      if (conflict === 'editor_doc') {
        return { ok: false, reason: 'editor_doc', intent };
      }
    }

    let template: TemplateEntry | null;
    try {
      template = await resolveTemplate(intent, deps.loadLibraryIndex);
    } catch {
      return { ok: false, reason: 'load_failed', intent, recovery };
    }

    if (!template) {
      clearStudioImportIntent(intent.intentId);
      return { ok: false, reason: 'template_missing', intent, recovery };
    }

    // ── 自此之后才允许同步改 Wizard ──
    if (mode === 'new') {
      deps.wizard.resetForNewDesign();
    }

    const snap = deps.wizard.getSnapshot();
    const shape = asShape(intent.suggestedContext?.shape);
    const length = asLength(intent.suggestedContext?.length);

    if (
      shape &&
      length &&
      snap.status === 'draft' &&
      !deps.wizard.hasEditorDoc(snap.designId)
    ) {
      deps.wizard.setShapeLengthDraft({ shape, length, enterStep2: true });
    } else if (snap.status === 'draft' && !snap.appliedShape && shape && length) {
      deps.wizard.setShapeLengthDraft({ shape, length, enterStep2: false });
    }

    deps.wizard.applyTemplate(template);
    clearStudioImportIntent(intent.intentId);
    return { ok: true, intent, mode };
  } catch {
    return {
      ok: false,
      reason: 'load_failed',
      intent: preliminary,
      recovery,
    };
  }
}

export type { CommunityIntentConflictKind };
