import { Link } from 'react-router-dom';
import { Button, EmptyState } from '@/design-system';
import { useLocale } from '@/lib/i18n';

/** `*` 404（PRD §6.3） */
export default function NotFoundPage() {
  const { t } = useLocale();
  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas p-6" data-debug-id="app.not-found">
      <div className="w-full max-w-[480px]">
        <EmptyState
          title={t('page.notFoundTitle')}
          description={t('page.notFoundDescription')}
          action={
            <Link to="/">
              <Button size="sm">{t('page.backHome')}</Button>
            </Link>
          }
          className="min-h-[280px]"
        />
      </div>
    </div>
  );
}
