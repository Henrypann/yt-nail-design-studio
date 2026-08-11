/** Wizard → EditorDocV6 single production bridge. */

import { Routes } from '@/app/routes';
import type { DesignSummary } from '@/lib/types';
import {
  getDesign,
  getEditorDocV6Result,
  inspectEditorDoc,
  saveEditorDocV6ToLocalStorage,
} from '@/studio/editor/lib/repo-v6';
import type { EditorDocV6MigrationResult, EditorDocV6SaveResult } from '@/studio/editor/lib/repo-v6';
import type { EditorDocV6 } from '@/studio/editor/v6/model';
import { parseEditorDocV6 } from '@/studio/editor/v6/schema';
import type { EditorDocV7 } from '@/studio/editor/v7/model';
import { wizardDesignToEditorDocV7, type EditorDocV7CreationResult } from '@/studio/editor/v7/create';
import { createEditorDocV7InLocalStorage, type EditorDocV7CreateResult } from '@/studio/editor/v7/repository';
import { isEditorV7InternalEnabled } from '@/studio/editor/v7/feature';
import { wizardToEditorDocV6 } from './v6-bridge';

export const BRIDGE_WARNING_TITLE = '打开自由画布后：';
export const BRIDGE_WARNING_LINES: readonly string[] = [
  '你将无法再切换模板——当前模板会作为图案元素保留，但模板选择器将不再可用。',
  '你可以在 Editor 中继续调整图层与底色；新建文档统一使用 EditorDocV7。',
  '暂不能无损转换的内容会明确阻止进入，不会静默创建 V6 文档。',
  '如不满意，可返回设计列表、复制一份原设计重新开始。',
] as const;

export type BridgeFailureReason =
  | 'design_not_found'
  | 'editor_doc_invalid'
  | 'editor_doc_unsupported'
  | 'conversion_invalid'
  | 'v7_content_not_supported'
  | 'save_failed';

export type BridgeResult =
  | { ok: true; mode: 'created' | 'existing'; writer?: 'v6' | 'v7'; compatibilityWarning?: string }
  | { ok: false; reason: BridgeFailureReason; message?: string };

export interface BridgeDeps {
  getDesign: (designId: string) => DesignSummary | undefined;
  getEditorDoc: (designId: string) => EditorDocV6MigrationResult;
  saveEditorDoc: (doc: EditorDocV6) => EditorDocV6SaveResult;
  navigate: (url: string) => void;
}

export interface V7BridgeDeps {
  getDesign: (designId: string) => DesignSummary | undefined;
  inspectEditorDoc: (designId: string) => { present: boolean; schemaVersion?: number | null };
  convertDesign: (design: DesignSummary) => EditorDocV7CreationResult;
  createEditorDoc: (doc: EditorDocV7) => EditorDocV7CreateResult;
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

function existingVersionIsSafe(version: number | null | undefined): boolean {
  return typeof version === 'number' && Number.isInteger(version) && version >= 1 && version <= 7;
}

export function openBridgeV7WithDeps(designId: string, deps: V7BridgeDeps): BridgeResult {
  const design = deps.getDesign(designId);
  if (!design) return { ok: false, reason: 'design_not_found' };

  const existing = deps.inspectEditorDoc(designId);
  if (existing.present) {
    if (existingVersionIsSafe(existing.schemaVersion)) {
      deps.navigate(`${Routes.designCanvas}?design=${encodeURIComponent(designId)}`);
      return { ok: true, mode: 'existing', writer: existing.schemaVersion === 7 ? 'v7' : 'v6' };
    }
    if (typeof existing.schemaVersion === 'number' && existing.schemaVersion > 7) {
      return { ok: false, reason: 'editor_doc_unsupported' };
    }
    return { ok: false, reason: 'editor_doc_invalid' };
  }

  const converted = deps.convertDesign(design);
  if (!converted.ok) {
    return { ok: false, reason: 'v7_content_not_supported', message: converted.message };
  }
  const saved = deps.createEditorDoc(converted.doc);
  if (!saved.ok) {
    if (saved.reason === 'already_exists') {
      const raced = deps.inspectEditorDoc(designId);
      if (raced.present && existingVersionIsSafe(raced.schemaVersion)) {
        deps.navigate(`${Routes.designCanvas}?design=${encodeURIComponent(designId)}`);
        return { ok: true, mode: 'existing', writer: raced.schemaVersion === 7 ? 'v7' : 'v6' };
      }
    }
    return { ok: false, reason: 'save_failed' };
  }
  deps.navigate(`${Routes.designCanvas}?bridge=${encodeURIComponent(designId)}`);
  return { ok: true, mode: 'created' };
}

export function openBridgeForWriterWithDeps(
  designId: string,
  v7Enabled: boolean,
  v6Deps: BridgeDeps,
  v7Deps: V7BridgeDeps,
): BridgeResult {
  if (!v7Enabled) return openBridgeWithDeps(designId, v6Deps);
  const v7 = openBridgeV7WithDeps(designId, v7Deps);
  return v7.ok ? { ...v7, writer: v7.writer ?? 'v7' } : v7;
}

/**
 * Synchronous persistence makes rapid repeated calls exactly-once: after the
 * first save, the next call observes the stored V6 doc and only navigates.
 */
export function openBridge(designId: string): BridgeResult {
  const v6Deps: BridgeDeps = {
    getDesign,
    getEditorDoc: getEditorDocV6Result,
    saveEditorDoc: saveEditorDocV6ToLocalStorage,
    navigate: (url) => window.location.assign(url),
  };
  const v7Deps: V7BridgeDeps = {
    getDesign,
    inspectEditorDoc,
    convertDesign: wizardDesignToEditorDocV7,
    createEditorDoc: createEditorDocV7InLocalStorage,
    navigate: (url) => window.location.assign(url),
  };
  return openBridgeForWriterWithDeps(designId, isEditorV7InternalEnabled(), v6Deps, v7Deps);
}

export { wizardToEditorDocV6 } from './v6-bridge';
