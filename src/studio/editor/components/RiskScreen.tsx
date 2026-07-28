/**
 * P0 风险筛查（模块 4 · Mock）
 * 红线：界面固定命名「P0 RISK SCREEN · MOCK」；
 * 禁止出现 Manufacturing passed / Ready to manufacture / Production approved 类文案。
 */

import { AlertTriangle, ShieldCheck } from 'lucide-react';
import { Badge, Button, Modal } from '@/design-system';
import { isScenarioOn, useMockScenarios } from '@/lib/mock-panel';
import { runRiskChecks, type RiskReport } from '../lib/risk';
import { useEditorStore } from '../store';

const CODE_LABEL = {
  attachment_count: '附件数量',
  height_exceed: '高度超限',
  edge_near: '边缘邻近',
} as const;

export function RiskScreen(props: { open: boolean; onClose: () => void }) {
  const { open, onClose } = props;
  const doc = useEditorStore((s) => s.doc);
  const flags = useMockScenarios((s) => s.flags);

  if (!doc) return null;
  const report: RiskReport = runRiskChecks(doc, isScenarioOn(flags, 'risk.forceIssues'));

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={report.title}
      size="lg"
      footer={
        <Button size="sm" variant="secondary" onClick={onClose}>
          关闭
        </Button>
      }
    >
      <div className="flex flex-col gap-3">
        <p className="text-[11px] text-gray-400">
          附件参数级检查（数量 / 高度 / 边缘邻近）· 原型期规则为 Mock，接入真实 Pipeline 后入口位置不变。
        </p>
        {report.issues.length === 0 ? (
          <div className="flex items-start gap-2 rounded-panel border border-success/20 bg-success-soft p-3">
            <ShieldCheck size={16} className="mt-0.5 shrink-0 text-success" />
            <div>
              <p className="text-sm font-medium text-success">未发现参数级风险</p>
              <p className="mt-0.5 text-xs text-gray-600">
                当前十指附件数量、高度（0.05–0.30mm）与边缘距离均在建议范围内（Mock 检查）。
              </p>
            </div>
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {report.issues.map((issue, i) => (
              <li
                key={`${issue.finger}-${issue.code}-${i}`}
                className="flex items-start gap-2 rounded-panel border border-warning/30 bg-warning-soft p-3"
              >
                <AlertTriangle size={16} className="mt-0.5 shrink-0 text-warning" />
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-1.5 text-sm font-medium text-gray-800">
                    <Badge variant="warning" className="tnum">{issue.finger}</Badge>
                    <Badge variant="gray">{CODE_LABEL[issue.code]}</Badge>
                    {issue.message}
                  </p>
                  <p className="mt-1 text-xs text-gray-600">建议：{issue.suggestion}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Modal>
  );
}
