/** Wizard → EditorDocV6 single production bridge. */

import { Routes } from '@/app/routes';
import type { DesignSummary } from '@/lib/types';
import {
  getDesign,
  getEditorDocV6Result,
  saveEditorDocV6ToLocalStorage,
} from '@/studio/editor/lib/repo-v6';
import type { EditorDocV6MigrationResult, EditorDocV6SaveResult } from '@/studio/editor/lib/repo-v6';
import type { EditorDocV6 } from '@/studio/editor/v6/model';
import { parseEditorDocV6 } from '@/studio/editor/v6/schema';
import { wizardToEditorDocV6 } from './v6-bridge';

export const BRIDGE_WARNING_TITLE = '打开自由画布后：';
export const BRIDGE_WARNING_LINES: readonly string[] = [
  '你将无法再切换模板——当前模板会作为图案元素保留，但模板选择器将不再可用。',
  '你可以在 V6 画布中继续调整图层、底色、附件与配方参数；逐指定制会随设计一并带入。',
  '如不满意，可返回设计列表、复制一份原设计重新开始。',
] as const;

export type BridgeFailureReason =
  | 'design_not_found'
  | 'editor_doc_invalid'
  | 'editor_doc_unsupported'
  | 'conversion_invalid'
  | 'save_failed';

export type BridgeResult =
  | { ok: true; mode: 'created' | 'existing' }
  | { ok: false; reason: BridgeFailureReason };

export interface BridgeDeps {
  getDesign: (designId: string) => DesignSummary | undefined;
  getEditorDoc: (designId: string) => EditorDocV6MigrationResult;
  saveEditorDoc: (doc: EditorDocV6) => EditorDocV6SaveResult;
  navigate: (url: string) => void;
}

export function openBridgeWithDeps(designId: string, deps: BridgeDeps): BridgeResult {
  const design = deps.getDesign(designId);
  if (!design) return { ok: false, reason: 'design_not_found' };

  const existing = deps.getEditorDoc(designId);
  if (existing.status === 'ok') {
    // Includes pure migration of older supported documents. Never rebuild or
    // overwrite an existing Editor document from the Wizard summary.
    deps.navigate(`${Routes.designCanvas}?design=${encodeURIComponent(designId)}`);
    return { ok: true, mode: 'existing' };
  }
  if (existing.status === 'invalid') return { ok: false, reason: 'editor_doc_invalid' };
  if (existing.status === 'unsupported') return { ok: false, reason: 'editor_doc_unsupported' };

  const candidate = wizardToEditorDocV6(design);
  const parsed = parseEditorDocV6(candidate);
  if (!parsed.ok) return { ok: false, reason: 'conversion_invalid' };

  try {
    const saved = deps.saveEditorDoc(parsed.doc);
    if (saved.status !== 'ok') return { ok: false, reason: 'save_failed' };
  } catch {
    return { ok: false, reason: 'save_failed' };
  }

  deps.navigate(`${Routes.designCanvas}?bridge=${encodeURIComponent(designId)}`);
  return { ok: true, mode: 'created' };
}

/**
 * Synchronous persistence makes rapid repeated calls exactly-once: after the
 * first save, the next call observes the stored V6 doc and only navigates.
 */
export function openBridge(designId: string): BridgeResult {
  return openBridgeWithDeps(designId, {
    getDesign,
    getEditorDoc: getEditorDocV6Result,
    saveEditorDoc: saveEditorDocV6ToLocalStorage,
    navigate: (url) => window.location.assign(url),
  });
}

export { wizardToEditorDocV6 } from './v6-bridge';
