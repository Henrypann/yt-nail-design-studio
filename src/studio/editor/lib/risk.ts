/**
 * P0 参数级风险筛查 · MOCK（模块 4）
 *
 * Pipeline 路由前置占位：附件参数级检查（数量 / heightMm 超 0.30mm / 边缘邻近）。
 * 红线：界面固定命名「P0 RISK SCREEN · MOCK」；
 * 禁止出现 "Manufacturing passed / Ready to manufacture / Production approved" 类文案。
 */

import type { FingerCode } from '@/lib/types';
import { FINGER_CODES } from '@/lib/types';
import { HEIGHT_MAX_MM, resolveFingerData, type EditorDoc } from './model';

export type RiskCode = 'attachment_count' | 'height_exceed' | 'edge_near';

export interface RiskIssue {
  finger: FingerCode;
  code: RiskCode;
  /** 「出了什么事 + 现在怎么办」 */
  message: string;
  suggestion: string;
}

export interface RiskReport {
  /** 固定界面名（红线） */
  title: 'P0 RISK SCREEN · MOCK';
  issues: RiskIssue[];
  checkedAt: string;
}

/** 附件数量软上限（每指）：超过提示可能影响喷绘与封层 */
const ATTACHMENT_COUNT_WARN = 4;
/** 边缘邻近阈值（0.1mm 单位）：|x| 过半宽 45 或距甲根 y > -12 视为邻近边缘 */
const EDGE_X_UNITS = 45;
const EDGE_ROOT_Y_UNITS = -12;

export function runRiskChecks(doc: EditorDoc, forceIssues = false): RiskReport {
  const issues: RiskIssue[] = [];

  if (forceIssues) {
    // Mock 场景注入：固定返回三类示例项，验证异常 UI
    issues.push(
      {
        finger: 'R4',
        code: 'attachment_count',
        message: 'R4 附件数量达到 5 个（Mock 注入）',
        suggestion: '建议每指附件不超过 4 个；可减少该指附件或合并为单一主视觉。',
      },
      {
        finger: 'L3',
        code: 'height_exceed',
        message: 'L3 存在高度 0.32mm 的附件，超出 0.30mm 参数域（Mock 注入）',
        suggestion: '将该附件 heightMm 调至 0.30mm 以内，或改选平面贴花方案。',
      },
      {
        finger: 'R1',
        code: 'edge_near',
        message: 'R1 附件贴近甲面边缘（Mock 注入）',
        suggestion: '将附件向甲面中心移动，避免边缘刮手与封层起翘。',
      },
    );
    return { title: 'P0 RISK SCREEN · MOCK', issues, checkedAt: new Date().toISOString() };
  }

  for (const finger of FINGER_CODES) {
    const data = resolveFingerData(doc, finger);
    const atts = data.attachments;

    if (atts.length > ATTACHMENT_COUNT_WARN) {
      issues.push({
        finger,
        code: 'attachment_count',
        message: `${finger} 附件数量为 ${atts.length} 个`,
        suggestion: `建议每指附件不超过 ${ATTACHMENT_COUNT_WARN} 个；可减少该指附件或合并为单一主视觉。`,
      });
    }
    for (const att of atts) {
      if (att.heightMm > HEIGHT_MAX_MM) {
        issues.push({
          finger,
          code: 'height_exceed',
          message: `${finger} 附件「${att.name}」高度 ${att.heightMm.toFixed(2)}mm，超出 ${HEIGHT_MAX_MM.toFixed(2)}mm 参数域`,
          suggestion: `将 heightMm 调至 ${HEIGHT_MAX_MM.toFixed(2)}mm 以内，或改选平面贴花方案。`,
        });
      }
      if (Math.abs(att.transform.x) > EDGE_X_UNITS || att.transform.y > EDGE_ROOT_Y_UNITS) {
        issues.push({
          finger,
          code: 'edge_near',
          message: `${finger} 附件「${att.name}」贴近甲面边缘`,
          suggestion: '将附件向甲面中心移动，避免边缘刮手与封层起翘。',
        });
      }
    }
  }

  return { title: 'P0 RISK SCREEN · MOCK', issues, checkedAt: new Date().toISOString() };
}
