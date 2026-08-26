import { useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button, EmptyState } from '@/design-system';
import { Routes } from '@/app/routes';
import { CustomerPreviewShellV7 } from '@/studio/editor/components/CustomerPreviewShellV7';
import { readCustomerPreviewDocV7, type CustomerPreviewLoadResultV7 } from '@/studio/editor/v7/customer-preview-repository';
import { readCustomerPreviewSessionV7 } from '@/studio/editor/v7/customer-preview-session';
import { FINGER_CODES, type FingerCode } from '@/lib/types';
import { useLocale } from '@/lib/i18n';

function loadPreview(designId: string | null, missingMessage: string): CustomerPreviewLoadResultV7 {
  if (!designId) return { status: 'missing', message: missingMessage };
  const sessionDoc = readCustomerPreviewSessionV7(designId);
  if (sessionDoc) return { status: 'ready', doc: sessionDoc, warnings: [] };
  return readCustomerPreviewDocV7(designId);
}

export default function CustomerPreviewPageV7() {
  const { t } = useLocale();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const designId = params.get('design');
  const requestedFinger = params.get('finger');
  const returnStepId = params.get('step');
  const initialFinger: FingerCode = FINGER_CODES.includes(requestedFinger as FingerCode)
    ? requestedFinger as FingerCode
    : 'L1';
  const result = useMemo(() => loadPreview(designId, t('editorV7.preview.missingDesignParameter')), [designId, t]);

  if (result.status === 'ready') return <CustomerPreviewShellV7 doc={result.doc} loadWarnings={result.warnings} initialFinger={initialFinger} returnStepId={returnStepId} />;

  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-workspace p-4">
      <EmptyState
        title={result.status === 'unsupported' ? t('editorV7.preview.unsupportedDesign') : result.status === 'invalid' ? t('editorV7.preview.invalidDesign') : t('editorV7.preview.noDesign')}
        description={result.message}
        action={<Button size="sm" variant="secondary" onClick={() => navigate(Routes.designs)}>{t('editorV7.preview.backToDesignList')}</Button>}
        className="min-h-[320px] w-full max-w-2xl bg-white"
      />
    </main>
  );
}
