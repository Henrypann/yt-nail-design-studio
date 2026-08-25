/**
 * P0 风险筛查（模块 4 · Mock）
 * 红线：界面固定命名「P0 RISK SCREEN · MOCK」；
 * 禁止出现 Manufacturing passed / Ready to manufacture / Production approved 类文案。
 */

import { AlertTriangle, ShieldCheck } from 'lucide-react';
import { Badge, Button, Modal } from '@/design-system';
import { useLocale } from '@/lib/i18n';
import { isScenarioOn, useMockScenarios } from '@/lib/mock-panel';
import { runRiskChecks, type RiskReport } from '../lib/risk';
import { useEditorStore } from '../store';

export function RiskScreen(props: { open: boolean; onClose: () => void }) {
  const { open, onClose } = props;
  const { t } = useLocale();
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
          {t('editorV7.risk.close')}
        </Button>
      }
    >
      <div className="flex flex-col gap-3" data-debug-id="studio.editor.risk-screen">
        <p className="text-nano text-gray-400">
          {t('editorV7.risk.description')}
        </p>
        {report.issues.length === 0 ? (
          <div className="flex items-start gap-2 rounded-panel border border-success/20 bg-success-soft p-3">
            <ShieldCheck size={16} className="mt-0.5 shrink-0 text-success" />
            <div>
              <p className="text-sm font-medium text-success">{t('editorV7.risk.none')}</p>
              <p className="mt-0.5 text-xs text-gray-600">
                {t('editorV7.risk.noneDetail')}
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
                  <Badge variant="gray">{t(`editorV7.risk.${issue.code === 'attachment_count' ? 'attachmentCount' : issue.code === 'height_exceed' ? 'heightExceed' : 'edgeNear'}` as const)}</Badge>
                    {issue.message}
                  </p>
                  <p className="mt-1 text-xs text-gray-600">{t('editorV7.risk.suggestion', { suggestion: issue.suggestion })}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Modal>
  );
}
