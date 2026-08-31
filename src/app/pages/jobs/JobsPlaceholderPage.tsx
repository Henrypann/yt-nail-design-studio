/**
 * 生产任务占位页（S-UI-PLACE）。
 *
 * 硬件耦合能力的 UI 占位：生产 Job 等待机器原型，不执行提交生产，
 * 不把制造包接入执行器，不宣称已通过物理验证。
 */

import { Button, EmptyState } from '@/design-system';
import { useLocale } from '@/lib/i18n';
import { useRequireAuth } from '@/platform/session';

export default function JobsPlaceholderPage() {
  const session = useRequireAuth();
  const { t } = useLocale();
  if (!session) return null;

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4" data-testid="studio-jobs-placeholder">
      <header>
        <h1 className="text-base font-semibold text-ink">{t('jobs.placeholderTitle')}</h1>
        <p className="mt-1 text-sm leading-5 text-body">{t('jobs.placeholderSubtitle')}</p>
      </header>
      <EmptyState
        title={t('jobs.waitingForPrototypes')}
        description={t('jobs.notPhysicallyValidated')}
        className="min-h-[240px] border border-hairline bg-surface"
        action={
          <Button
            variant="secondary"
            disabled
            data-testid="studio-jobs-submit-disabled"
            title={t('jobs.submitDisabled')}
          >
            {t('jobs.submitDisabled')}
          </Button>
        }
      />
    </div>
  );
}
