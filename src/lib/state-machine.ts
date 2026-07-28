/**
 * 确认状态机（DEV-PLAN §6.2 · v1.1.0 线下场景简化版）
 *
 * draft（编辑中）→ confirmed（美甲师手动标记「顾客已确认」→ 冻结只读）
 * confirmed → submitted（提交生产，Sprint 2+）
 * confirmed → draft（顾客线下反悔，[退回草稿] 解冻，列表页操作）
 * confirmed → 新 draft 副本（基于已确认设计创建新版本，原确认记录保留）
 * 旁支：completed / exported / archived（沿用现有）
 *
 * 红线：不存在 pending_confirm / frozen；confirmation 仅 { confirmedAt, confirmedBy }。
 */

import type { Confirmation, DesignStatus, DesignSummary } from './types';

/** 允许的显式状态流转（createNewVersionFromConfirmed 为副本生成，不在此表内） */
const TRANSITIONS: Readonly<Record<DesignStatus, readonly DesignStatus[]>> = {
  draft: ['confirmed', 'exported', 'archived'],
  confirmed: ['draft', 'submitted', 'exported', 'archived'],
  submitted: ['completed', 'exported', 'archived'],
  completed: ['archived'],
  exported: ['archived'],
  archived: [],
};

export function canTransition(from: DesignStatus, to: DesignStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

/** 冻结只读：confirmed / submitted 不可再编辑 */
export function isReadOnly(status: DesignStatus): boolean {
  return status === 'confirmed' || status === 'submitted';
}

/** 编辑入口门禁：只读状态下禁止进入画布编辑 */
export function assertEditable(design: DesignSummary): void {
  if (isReadOnly(design.status)) {
    throw new StateMachineError(
      design.status,
      `设计当前为「${STATUS_LABEL[design.status]}」状态，已冻结只读。如需修改，请基于已确认设计创建新版本。`,
    );
  }
}

export class StateMachineError extends Error {
  readonly status: DesignStatus;
  constructor(status: DesignStatus, message: string) {
    super(message);
    this.name = 'StateMachineError';
    this.status = status;
  }
}

/**
 * 唯一确认动作：美甲师手动标记「顾客已确认」→ 冻结只读。
 * 前置：draft；交互：二次确认弹窗「顾客已在店内确认该方案？确认后设计将冻结，不可再编辑。」
 */
export function confirmDesign(design: DesignSummary, confirmedBy: string): DesignSummary {
  if (!canTransition(design.status, 'confirmed')) {
    throw new StateMachineError(
      design.status,
      `仅草稿可标记为顾客已确认（当前：${STATUS_LABEL[design.status]}）。`,
    );
  }
  const now = new Date().toISOString();
  const confirmation: Confirmation = { confirmedAt: now, confirmedBy };
  return { ...design, status: 'confirmed', confirmation, updatedAt: now };
}

/**
 * 顾客线下反悔 → [退回草稿] 解冻（列表页操作，留确认弹窗）。
 * 确认记录清空，回到可编辑状态。
 */
export function revertToDraft(design: DesignSummary): DesignSummary {
  if (!canTransition(design.status, 'draft')) {
    throw new StateMachineError(
      design.status,
      `仅已确认设计可退回草稿（当前：${STATUS_LABEL[design.status]}）。`,
    );
  }
  const { confirmation: _dropped, ...rest } = design;
  return { ...rest, status: 'draft', updatedAt: new Date().toISOString() };
}

/**
 * 基于已确认设计创建新版本：生成副本 draft，原确认记录保留。
 * 副本不继承 confirmation，version +1，parentId 指向原设计。
 */
export function createNewVersionFromConfirmed(
  design: DesignSummary,
  newId: string,
): DesignSummary {
  if (design.status !== 'confirmed') {
    throw new StateMachineError(
      design.status,
      `仅已确认设计可创建新版本（当前：${STATUS_LABEL[design.status]}）。`,
    );
  }
  const now = new Date().toISOString();
  return {
    ...design,
    id: newId,
    status: 'draft',
    confirmation: undefined,
    parentId: design.id,
    version: design.version + 1,
    createdAt: now,
    updatedAt: now,
  };
}

/** 提交生产（Sprint 2+ / 后端就绪后启用） */
export function submitDesign(design: DesignSummary): DesignSummary {
  if (!canTransition(design.status, 'submitted')) {
    throw new StateMachineError(
      design.status,
      `仅已确认设计可提交生产（当前：${STATUS_LABEL[design.status]}）。`,
    );
  }
  return { ...design, status: 'submitted', updatedAt: new Date().toISOString() };
}

/* ── 列表页徽章与筛选文案（draft 灰 / confirmed 蓝 / submitted 深蓝） ── */

export const STATUS_LABEL: Record<DesignStatus, string> = {
  draft: '草稿',
  confirmed: '已确认',
  submitted: '已提交',
  completed: '已完成',
  exported: '已导出',
  archived: '已归档',
};

export type StatusBadgeVariant = 'gray' | 'blue' | 'deepBlue';

export const STATUS_BADGE: Record<DesignStatus, StatusBadgeVariant> = {
  draft: 'gray',
  confirmed: 'blue',
  submitted: 'deepBlue',
  completed: 'gray',
  exported: 'gray',
  archived: 'gray',
};
