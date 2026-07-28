/**
 * Wizard → Editor 桥接（模块 4 · PRD §15）
 *
 * 数据转化（§15.1）：
 *   模板实例化为 pattern 层 template_pattern 元素（可移动/缩放/删除/叠加手绘）、
 *   base 层锁定（只能改色）、attachment 层空、history 空；
 *   Wizard 逐指定制（fingerOverrides）映射为 Editor 逐指解锁（fingerLocks 独立副本），
 *   底色覆盖与附件替换均不丢失。
 * 不可逆警告（§15.3）：文案完整展示后才可进入 Editor，且与 Editor 真实能力一致。
 *
 * 对 Wizard 模块的接口约定：
 *   import { openBridge } from '@/studio/bridge';
 *   openBridge(designId)  → 完成数据转化并跳转到 /design/canvas?bridge=<designId>，
 *   Editor 页先展示不可逆警告弹窗，确认后进入画布。
 *   （Wizard STEP 2 底部 [打开自由画布] 按钮点击时调用即可。）
 */

import { Routes } from '@/app/routes';
import type { DesignSummary, FingerCode } from '@/lib/types';
import { getDesign, getEditorDoc, saveEditorDoc } from '@/studio/editor/lib/repo';
import { DECORATIONS, templateById } from '@/studio/editor/lib/material';
import { genId, type AttachmentElement, type EditorDoc, type FingerData, type PatternElement } from '@/studio/editor/lib/model';

/** §15.3 不可逆警告文案（完整展示后才可进入；内容须与 Editor 真实能力一致） */
export const BRIDGE_WARNING_TITLE = '打开自由画布后：';
export const BRIDGE_WARNING_LINES: readonly string[] = [
  '你将无法再切换模板——当前模板会作为图案元素保留，但模板选择器将不再可用。',
  '你可以自由移动/缩放/擦除图案、手绘涂抹、导入图片、添加附件；逐指定制会随设计一并带入。',
  '如不满意，可返回设计列表、复制一份原设计重新开始。',
] as const;

/** §15.1 Wizard 数据 → Editor 初始状态 */
export function wizardToEditorDoc(design: DesignSummary): EditorDoc {
  const template = design.templateId ? templateById(design.templateId) : undefined;
  const sharedPattern: PatternElement[] = template
    ? [
        {
          id: `el_tpl_${template.id}_${Date.now().toString(36)}`,
          kind: 'template_pattern',
          templateId: template.id,
          name: template.name,
          transform: { x: 0, y: 0, scale: 1, rotation: 0 },
          editable: true,
        },
      ]
    : [];

  /*
   * 逐指定制桥接（修复：此前 fingerOverrides 在桥接时整体丢失）。
   * Wizard 参数级例外 → Editor 逐指解锁（fingerLocks 独立副本）：
   * - baseColor 覆盖 → FingerData.baseColor
   * - decorationId → attachment 元素（manifest defaults 提供位置/高度，
   *   heightMm 走 0.05–0.30mm 唯一高度通路）
   * - 图案层深拷贝共享图案，解锁指的后续擦除/编辑不影响其余九指
   */
  const fingerLocks: Partial<Record<FingerCode, FingerData>> = {};
  for (const [fc, override] of Object.entries(design.fingerOverrides ?? {})) {
    if (!override) continue;
    const deco = override.decorationId
      ? DECORATIONS.find((d) => d.id === override.decorationId)
      : undefined;
    const attachments: AttachmentElement[] = deco
      ? [
          {
            id: genId('el_att'),
            kind: 'attachment',
            decorationId: deco.id,
            name: deco.name,
            transform: {
              x: deco.defaults.x,
              y: deco.defaults.y,
              scale: deco.defaults.scale,
              rotation: deco.defaults.rotation,
            },
            heightMm: deco.defaults.heightMm,
          },
        ]
      : [];
    fingerLocks[fc as FingerCode] = {
      baseColor: override.baseColor ?? design.baseColor,
      pattern: structuredClone(sharedPattern),
      attachments,
    };
  }

  return {
    schemaVersion: 1,
    designId: design.id,
    customerId: design.customerId,
    shape: design.shape,
    length: design.length,
    finish: design.finish,
    // base 层锁定（只能改色）：EditorDoc 中 baseColor 独立于元素列表，UI 仅暴露选色
    baseColor: design.baseColor,
    pattern: sharedPattern,
    attachments: [],
    fingerLocks,
    masterFinger: 'R4',
    updatedAt: new Date().toISOString(),
    // history：空历史栈（Editor store load 时初始化）
  };
}

export interface BridgeResult {
  ok: boolean;
  reason?: 'design_not_found' | 'read_only';
}

/**
 * Wizard [打开自由画布] 入口（最小接口，Wizard 模块直接调用）。
 * 完成数据转化 → 持久化 EditorDoc → 跳转 Editor（带 bridge 参数触发不可逆警告弹窗）。
 *
 * 幂等：若该设计已桥接过（EditorDoc 已存在），跳过数据转化直接续进画布
 * （?design= 直达，不再弹不可逆警告），避免 Wizard 数据覆盖 Editor 内的修改。
 */
export function openBridge(designId: string): BridgeResult {
  const design = getDesign(designId);
  if (!design) return { ok: false, reason: 'design_not_found' };

  const existing = getEditorDoc(designId);
  if (existing) {
    // 已桥接：续进画布（保留 Editor 内的全部修改）
    window.location.assign(`${Routes.designCanvas}?design=${encodeURIComponent(designId)}`);
    return { ok: true };
  }

  const doc = wizardToEditorDoc(design);
  saveEditorDoc(doc);

  const url = `${Routes.designCanvas}?bridge=${encodeURIComponent(designId)}`;
  // 独立函数内无 Router 上下文：用 location 跳转（数据已落 localStorage，刷新式跳转无状态损失）
  window.location.assign(url);
  return { ok: true };
}
