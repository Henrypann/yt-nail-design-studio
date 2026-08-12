import { useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button, EmptyState } from '@/design-system';
import { Routes } from '@/app/routes';
import { CustomerPreviewShellV7 } from '@/studio/editor/components/CustomerPreviewShellV7';
import { readCustomerPreviewDocV7, type CustomerPreviewLoadResultV7 } from '@/studio/editor/v7/customer-preview-repository';
import { readCustomerPreviewSessionV7 } from '@/studio/editor/v7/customer-preview-session';
import { FINGER_CODES, type FingerCode } from '@/lib/types';

function loadPreview(designId: string | null): CustomerPreviewLoadResultV7 {
  if (!designId) return { status: 'missing', message: '预览链接缺少 design 参数' };
  const sessionDoc = readCustomerPreviewSessionV7(designId);
  if (sessionDoc) return { status: 'ready', doc: sessionDoc, warnings: [] };
  return readCustomerPreviewDocV7(designId);
}

export default function CustomerPreviewPageV7() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const designId = params.get('design');
  const requestedFinger = params.get('finger');
  const returnStepId = params.get('step');
  const initialFinger: FingerCode = FINGER_CODES.includes(requestedFinger as FingerCode)
    ? requestedFinger as FingerCode
    : 'L1';
  const result = useMemo(() => loadPreview(designId), [designId]);

  if (result.status === 'ready') return <CustomerPreviewShellV7 doc={result.doc} loadWarnings={result.warnings} initialFinger={initialFinger} returnStepId={returnStepId} />;

  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-[#f5f1ef] p-4">
      <EmptyState
        title={result.status === 'unsupported' ? '设计来自更高版本' : result.status === 'invalid' ? '设计无法安全预览' : '没有找到预览设计'}
        description={result.message}
        action={<Button size="sm" variant="secondary" onClick={() => navigate(Routes.designs)}>返回设计列表</Button>}
        className="min-h-[320px] w-full max-w-2xl bg-white"
      />
    </main>
  );
}
