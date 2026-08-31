/**
 * Studio 已确认 DesignVersion 列表（S-STUDIO）。
 *
 * 只展示 Community 显式确认写入的身份钉，并经既有版本化导入打开。
 * 不绑定设备、不提交 Job、不改几何/渲染合同。安静 chrome，DESIGN.md 象牙底。
 */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye } from 'lucide-react';
import { Button, Card, EmptyState, useToast } from '@/design-system';
import { useLocale } from '@/lib/i18n';
import { getLookReadModelById } from '@/community/data/look-repository';
import type { ConfirmedLookDesignVersionRefV1 } from '@/community/domain/v7_1/look-confirm';
import type { CanonicalPublishedLookReadModelV1 } from '@/community/domain/v7_1/published-look-read-model';
import {
  prepareConfirmedLookStudioOpenV1,
  readConfirmedLookDesignVersionsV1,
} from '@/integration/community-studio/look-confirm-runtime';
import { useRequireAuth } from '@/platform/session';

interface ConfirmedRowV1 {
  record: ConfirmedLookDesignVersionRefV1;
  look: CanonicalPublishedLookReadModelV1 | null;
}

export default function ConfirmedDesignVersionPage() {
  const session = useRequireAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const { t } = useLocale();
  const [rows, setRows] = useState<ConfirmedRowV1[] | null>(null);
  const [openingId, setOpeningId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const listed = readConfirmedLookDesignVersionsV1();
    if (!listed.ok) {
      setRows([]);
      return undefined;
    }
    void (async () => {
      const next: ConfirmedRowV1[] = [];
      for (const record of listed.records) {
        const look = await getLookReadModelById(record.lookId);
        next.push({
          record,
          look: look?.readModelKind === 'CANONICAL' ? look : null,
        });
      }
      if (!cancelled) setRows(next);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!session) return null;

  const openRecord = (row: ConfirmedRowV1) => {
    if (!row.look || openingId) return;
    setOpeningId(row.record.snapshotId);
    try {
      const prepared = prepareConfirmedLookStudioOpenV1(row.record, row.look);
      if (!prepared.ok) {
        toast.error(t('design.confirmedOpenFailed'));
        return;
      }
      navigate(prepared.href);
    } catch {
      toast.error(t('design.confirmedOpenFailed'));
    } finally {
      setOpeningId(null);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4" data-testid="studio-confirmed-looks">
      <header>
        <h1 className="text-base font-semibold text-ink">{t('design.confirmedLooks')}</h1>
        <p className="mt-1 text-sm leading-5 text-body">{t('design.confirmedLooksHint')}</p>
      </header>

      {rows === null ? (
        <p className="text-sm text-mute">{t('common.loading')}</p>
      ) : rows.length === 0 ? (
        <EmptyState
          title={t('design.confirmedLooksEmpty')}
          description={t('design.confirmedLooksEmptyHint')}
          className="min-h-[240px] border border-hairline bg-surface"
        />
      ) : (
        <ul className="space-y-2">
          {rows.map((row) => (
            <li key={row.record.snapshotId}>
              <Card padding="sm" className="flex flex-wrap items-center justify-between gap-3 border-hairline">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-ink">
                    {row.look?.title ?? t('community.lookTitleFallback')}
                  </p>
                  <p className="mt-0.5 font-mono text-nano text-mute">
                    {t('community.confirm.identityLine', {
                      designVersionId: row.record.designVersionId,
                      revision: row.record.revision,
                      sha: `${row.record.editorDocSha256.slice(0, 12)}…`,
                    })}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  data-testid="studio-open-confirmed-look"
                  disabled={!row.look || openingId === row.record.snapshotId}
                  onClick={() => openRecord(row)}
                >
                  <Eye size={12} />
                  {t('design.confirmedOpen')}
                </Button>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
