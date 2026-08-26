/**
 * `/design` 我的设计（模块 4）
 * 卡片列表 + 状态筛选 tabs（全部/草稿/固定版本已确认/已提交）+ 空状态插画。
 * 正式固定版本来自 Editor ApprovalEvent/Snapshot；历史 Wizard confirmation 只读。
 */

import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Copy, Eye, Pencil, Plus, Trash2 } from 'lucide-react';
import { Badge, Button, Card, EmptyState, Modal, Tabs, useToast } from '@/design-system';
import { useLocale } from '@/lib/i18n';
import { designNewFresh, Routes } from '@/app/routes';
import {
  STATUS_BADGE,
} from '@/lib/state-machine';
import type { DesignStatus, DesignSummary } from '@/lib/types';
import designsEmptyUrl from '../../../../assets/illustrations/designs-empty.svg?url';
import {
  customerName,
  duplicateEditorDocV6,
  getEditorDocV6Result,
  inspectEditorDoc,
  readDesigns,
  removeDesign,
  removeEditorDoc,
  upsertDesign,
} from '@/studio/editor/lib/repo-v6';
import { isEditorV7InternalEnabled } from '@/studio/editor/v7/feature';
import { openBridge } from '@/studio/bridge';
import { genId } from '@/studio/editor/lib/model';
import { readDesignApprovalProjection } from '@/studio/approval/design-approval-projection';

type TabKey = 'all' | 'draft' | 'confirmed' | 'submitted';
// Compatibility copy keys: 固定版本已确认 / 历史本地确认 remain catalog-backed through design.fixedApproved/design.historical.

const TABS: TabKey[] = ['all', 'draft', 'confirmed', 'submitted'];

function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(
    d.getMinutes(),
  ).padStart(2, '0')}`;
}

export default function DesignListPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const { t } = useLocale();
  const tabLabel = (key: TabKey) => t(`design.${key}` as 'design.all' | 'design.draft' | 'design.confirmed' | 'design.submitted');
  const statusLabel = (status: DesignStatus) => t(`design.${status}` as 'design.draft' | 'design.submitted' | 'design.confirmed');
  const [tab, setTab] = useState<TabKey>('all');
  const [tick, setTick] = useState(0); // 本地增删后刷新
  const [deleteTarget, setDeleteTarget] = useState<DesignSummary | null>(null);
  const editorV7Enabled = isEditorV7InternalEnabled();

  const designs = useMemo(() => {
    void tick;
    return readDesigns()
      .slice()
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }, [tick]);

  const filtered = useMemo(() => {
    if (tab === 'all') return designs;
    if (tab === 'confirmed') return designs.filter((d) => readDesignApprovalProjection(d.id).status === 'APPROVED');
    return designs.filter((d) => d.status === (tab as DesignStatus) && readDesignApprovalProjection(d.id).status !== 'APPROVED');
  }, [designs, tab]);

  const refresh = () => setTick((t) => t + 1);

  const openDesign = (d: DesignSummary) => {
    const projection = readDesignApprovalProjection(d.id);
    if (projection.status === 'CORRUPTED') toast.error(t('design.confirmCorrupted'));
    if (d.status === 'confirmed' || d.confirmation) {
      navigate(`${Routes.designNew}?designId=${encodeURIComponent(d.id)}`);
      return;
    }
    if (projection.status === 'APPROVED') { toast.info(t('design.fixedReadOnly')); return; }
    const probe = inspectEditorDoc(d.id);
    if (probe.present && probe.schemaVersion === 7) {
      navigate(`${Routes.designCanvas}?design=${d.id}`);
      return;
    }
    if (probe.present && typeof probe.schemaVersion === 'number' && probe.schemaVersion > 7) {
      toast.error(t('design.higherVersion'));
      return;
    }
    const editorDoc = getEditorDocV6Result(d.id);
    if (editorDoc.status === 'ok') {
      navigate(`${Routes.designCanvas}?design=${d.id}`);
      return;
    }
    if (editorDoc.status === 'invalid' || editorDoc.status === 'unsupported') {
      toast.error(editorDoc.status === 'unsupported' ? t('design.higherVersion') : t('design.invalidData'));
      return;
    }
    // Wizard 来源且尚未桥接：经 openBridge 完成数据转化（首进弹不可逆警告）
    const result = openBridge(d.id);
    if (!result.ok) toast.error(t('design.missing'));
  };

  const duplicateDesign = (d: DesignSummary) => {
    const probe = inspectEditorDoc(d.id);
    if (probe.present && probe.schemaVersion === 7) {
      toast.error(t('design.copyUnavailable'));
      return;
    }
    const newId = genId('design');
    const now = new Date().toISOString();
    const source = getEditorDocV6Result(d.id);
    if (source.status === 'invalid' || source.status === 'unsupported') {
      toast.error(t('design.copyInvalid'));
      return;
    }
    if (source.status === 'ok' && duplicateEditorDocV6(d.id, newId) === null) {
      toast.error(t('design.copyFailed'));
      return;
    }
    try {
      upsertDesign({
        ...d,
        id: newId,
        title: `${d.title ?? t('design.untitled')} · ${t('design.copy')}`,
        status: 'draft',
        confirmation: undefined,
        parentId: d.id,
        createdAt: now,
        updatedAt: now,
      });
      refresh();
      toast.success(t('design.copySuccess'));
    } catch {
      if (source.status === 'ok') {
        try { removeEditorDoc(newId); } catch { /* preserve the original failure */ }
      }
      toast.error(t('design.writeFailed'));
    }
  };

  const doDelete = () => {
    if (!deleteTarget) return;
    removeDesign(deleteTarget.id);
    setDeleteTarget(null);
    refresh();
    toast.success(t('design.deleted'));
  };

  return (
    <div className="flex flex-col gap-4" data-debug-id="studio.design-list">
      <header className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-semibold text-gray-900">{t('design.title')}</h1>
            {editorV7Enabled && <Badge variant="info">{t('design.v7Internal')}</Badge>}
          </div>
          <p className="mt-0.5 text-xs text-gray-500">
            {t('design.description')}
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="secondary" onClick={() => navigate(`${Routes.designCanvas}?blank=1`)}>
            {t('design.blankCanvas')}
          </Button>
          <Button size="sm" onClick={() => navigate(designNewFresh())}>
            <Plus size={14} />
            {t('design.new')}
          </Button>
        </div>
      </header>

      <Tabs
        items={TABS.map((tabKey) => ({
          key: tabKey,
            label:
              tabKey === 'all'
              ? `${tabLabel(tabKey)}（${designs.length}）`
              : tabKey === 'confirmed'
                ? `${tabLabel(tabKey)}（${designs.filter((d) => readDesignApprovalProjection(d.id).status === 'APPROVED').length}）`
              : `${tabLabel(tabKey)}（${designs.filter((d) => d.status === tabKey).length}）`,
        }))}
        activeKey={tab}
        onChange={(k) => setTab(k as TabKey)}
      />

      {filtered.length === 0 ? (
        <EmptyState
          illustration={<img src={designsEmptyUrl} alt="" className="h-28 w-auto" />}
          title={tab === 'all' ? t('design.emptyTitle') : t('design.emptyStatus', { status: tabLabel(tab) })}
          description={t('design.emptyDescription')}
          action={
            <Button size="sm" onClick={() => navigate(designNewFresh())}>
              <Plus size={14} />
              {t('design.new')}
            </Button>
          }
          className="min-h-[320px]"
        />
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3">
          {filtered.map((d) => {
            const approval = readDesignApprovalProjection(d.id);
            const formalApproved = approval.status === 'APPROVED';
            const historicalConfirmation = !formalApproved && (Boolean(d.confirmation) || d.status === 'confirmed');
            const readOnly = formalApproved || historicalConfirmation || d.status === 'submitted';
            return (
              <Card key={d.id} padding="sm" className="flex flex-col gap-2">
                {/* 缩略图 */}
                <button
                  onClick={() => openDesign(d)}
                  className="flex h-40 items-center justify-center overflow-hidden rounded-panel bg-gray-50 transition-colors duration-fast hover:bg-gray-100"
                >
                  {d.thumbnailDataUrl ? (
                    <img src={d.thumbnailDataUrl} alt="" className="h-full w-auto object-contain" />
                  ) : (
                    <span className="text-nano text-gray-400">{t('design.noThumbnail')}</span>
                  )}
                </button>

                <div className="flex items-start justify-between gap-2 px-1">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-gray-800">
                      {d.title ?? t('design.untitled')}
                      <span className="ml-1 text-nano font-normal text-gray-400 tnum">v{d.version}</span>
                    </p>
                    <p className="mt-0.5 truncate text-nano text-gray-500">
                      {customerName(d.customerId)} · {formatTime(d.updatedAt)}
                    </p>
                    {approval.status === 'HISTORICAL_LOCAL_CONFIRMATION' || d.confirmation ? (
                      <p className="mt-0.5 text-nano text-warning">{t('design.historical')}</p>
                    ) : approval.status === 'CHANGE_REQUESTED' ? (
                      <p className="mt-0.5 text-nano text-warning">{t('design.changeRequested')}{approval.note ? ` · ${approval.note}` : ''}</p>
                    ) : approval.status === 'CORRUPTED' ? (
                      <p className="mt-0.5 text-nano text-error">{t('design.corrupted')}</p>
                    ) : null}
                  </div>
                  <Badge variant={formalApproved ? 'blue' : STATUS_BADGE[d.status]}>{formalApproved ? t('design.fixedApproved') : approval.status === 'CHANGE_REQUESTED' ? t('design.changeRequested') : historicalConfirmation ? t('design.historical') : statusLabel(d.status)}</Badge>
                </div>

                {/* 操作区（状态机驱动） */}
                <div className="flex flex-wrap gap-1 border-t border-gray-100 px-1 pt-2">
                  {d.status === 'draft' && !historicalConfirmation && (
                    <Button size="sm" variant="ghost" onClick={() => openDesign(d)}>
                      <Pencil size={12} />
                      {t('design.continueEdit')}
                    </Button>
                  )}
                  {readOnly && !formalApproved && (
                    <Button size="sm" variant="ghost" onClick={() => openDesign(d)}>
                      <Eye size={12} />
                      {t('design.viewHistory')}
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => duplicateDesign(d)}>
                    <Copy size={12} />
                    {t('design.copy')}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setDeleteTarget(d)}>
                    <Trash2 size={12} className="text-error" />
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* 删除 · 二次确认 */}
      <Modal
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        title={t('design.deleteTitle')}
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setDeleteTarget(null)}>
              {t('design.cancel')}
            </Button>
            <Button variant="danger" size="sm" onClick={doDelete}>
              {t('design.confirmDelete')}
            </Button>
          </>
        }
      >
        <p className="text-sm text-gray-600">
          {t('design.deleteDescription', { title: deleteTarget?.title ?? t('design.untitled') })}
        </p>
      </Modal>
    </div>
  );
}
