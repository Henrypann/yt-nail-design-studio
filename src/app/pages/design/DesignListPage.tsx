/**
 * `/design` 我的设计（模块 4）
 * 卡片列表 + 状态筛选 tabs（全部/草稿/固定版本已确认/已提交）+ 空状态插画。
 * 正式固定版本来自 Editor ApprovalEvent/Snapshot；历史 Wizard confirmation 只读。
 */

import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Copy, Eye, Pencil, Plus, Trash2 } from 'lucide-react';
import { Badge, Button, Card, EmptyState, Modal, Tabs, useToast } from '@/design-system';
import { designNewFresh, Routes } from '@/app/routes';
import {
  STATUS_BADGE,
  STATUS_LABEL,
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

const TABS: { key: TabKey; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'draft', label: '草稿' },
  { key: 'confirmed', label: '已确认' },
  { key: 'submitted', label: '已提交' },
];

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
    if (projection.status === 'CORRUPTED') toast.error('确认记录损坏，已阻断确认状态映射；独立 Editor 文档仍可打开。');
    if (d.status === 'confirmed' || d.confirmation) {
      navigate(`${Routes.designNew}?designId=${encodeURIComponent(d.id)}`);
      return;
    }
    if (projection.status === 'APPROVED') { toast.info('固定版本不可直接编辑；请从固定版本创建新修订。'); return; }
    const probe = inspectEditorDoc(d.id);
    if (probe.present && probe.schemaVersion === 7) {
      navigate(`${Routes.designCanvas}?design=${d.id}`);
      return;
    }
    if (probe.present && typeof probe.schemaVersion === 'number' && probe.schemaVersion > 7) {
      toast.error('设计来自更高版本，当前版本不会覆盖。');
      return;
    }
    const editorDoc = getEditorDocV6Result(d.id);
    if (editorDoc.status === 'ok') {
      navigate(`${Routes.designCanvas}?design=${d.id}`);
      return;
    }
    if (editorDoc.status === 'invalid' || editorDoc.status === 'unsupported') {
      toast.error(editorDoc.status === 'unsupported' ? '设计来自更高版本，当前版本不会覆盖。' : '设计数据无效，原始数据已保留。');
      return;
    }
    // Wizard 来源且尚未桥接：经 openBridge 完成数据转化（首进弹不可逆警告）
    const result = openBridge(d.id);
    if (!result.ok) toast.error('设计数据缺失，无法打开。');
  };

  const duplicateDesign = (d: DesignSummary) => {
    const probe = inspectEditorDoc(d.id);
    if (probe.present && probe.schemaVersion === 7) {
      toast.error('V7 复制将在十指事务 PR 中开放；原设计未改变。');
      return;
    }
    const newId = genId('design');
    const now = new Date().toISOString();
    const source = getEditorDocV6Result(d.id);
    if (source.status === 'invalid' || source.status === 'unsupported') {
      toast.error('原设计文档不可安全复制，未创建副本。');
      return;
    }
    if (source.status === 'ok' && duplicateEditorDocV6(d.id, newId) === null) {
      toast.error('画布复制失败，未创建副本。');
      return;
    }
    try {
      upsertDesign({
        ...d,
        id: newId,
        title: `${d.title ?? '未命名设计'} · 副本`,
        status: 'draft',
        confirmation: undefined,
        parentId: d.id,
        createdAt: now,
        updatedAt: now,
      });
      refresh();
      toast.success('已复制为新草稿');
    } catch {
      if (source.status === 'ok') {
        try { removeEditorDoc(newId); } catch { /* preserve the original failure */ }
      }
      toast.error('设计摘要写入失败，未保留副本。');
    }
  };

  const doDelete = () => {
    if (!deleteTarget) return;
    removeDesign(deleteTarget.id);
    setDeleteTarget(null);
    refresh();
    toast.success('设计已删除');
  };

  return (
    <div className="flex flex-col gap-4" data-debug-id="studio.design-list">
      <header className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-semibold text-gray-900">我的设计</h1>
            {editorV7Enabled && <Badge variant="info">V7 internal</Badge>}
          </div>
          <p className="mt-0.5 text-xs text-gray-500">
            固定版本确认由 Editor 顾客预览产生；快速建稿只负责客户上下文、模板和草稿。
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="secondary" onClick={() => navigate(`${Routes.designCanvas}?blank=1`)}>
            空白画布
          </Button>
          <Button size="sm" onClick={() => navigate(designNewFresh())}>
            <Plus size={14} />
            新建设计
          </Button>
        </div>
      </header>

      <Tabs
        items={TABS.map((t) => ({
          key: t.key,
            label:
              t.key === 'all'
              ? `全部（${designs.length}）`
              : t.key === 'confirmed'
                ? `${t.label}（${designs.filter((d) => readDesignApprovalProjection(d.id).status === 'APPROVED').length}）`
              : `${t.label}（${designs.filter((d) => d.status === t.key).length}）`,
        }))}
        activeKey={tab}
        onChange={(k) => setTab(k as TabKey)}
      />

      {filtered.length === 0 ? (
        <EmptyState
          illustration={<img src={designsEmptyUrl} alt="" className="h-28 w-auto" />}
          title={tab === 'all' ? '还没有设计。创建你的第一个美甲设计吧' : `没有「${TABS.find((t) => t.key === tab)?.label}」状态的设计`}
          description="从快速建稿官方模板快速出单，或打开 Editor 自由画布精细创作。"
          action={
            <Button size="sm" onClick={() => navigate(designNewFresh())}>
              <Plus size={14} />
              新建设计
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
                    <span className="text-nano text-gray-400">暂无缩略图 · 打开后保存生成</span>
                  )}
                </button>

                <div className="flex items-start justify-between gap-2 px-1">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-gray-800">
                      {d.title ?? '未命名设计'}
                      <span className="ml-1 text-nano font-normal text-gray-400 tnum">v{d.version}</span>
                    </p>
                    <p className="mt-0.5 truncate text-nano text-gray-500">
                      {customerName(d.customerId)} · {formatTime(d.updatedAt)}
                    </p>
                    {approval.status === 'HISTORICAL_LOCAL_CONFIRMATION' || d.confirmation ? (
                      <p className="mt-0.5 text-nano text-warning">历史本地确认 · 非固定版本</p>
                    ) : approval.status === 'CHANGE_REQUESTED' ? (
                      <p className="mt-0.5 text-nano text-warning">顾客请求修改{approval.note ? ` · ${approval.note}` : ''}</p>
                    ) : approval.status === 'CORRUPTED' ? (
                      <p className="mt-0.5 text-nano text-error">确认记录损坏 · 已阻断</p>
                    ) : null}
                  </div>
                  <Badge variant={formalApproved ? 'blue' : STATUS_BADGE[d.status]}>{formalApproved ? '固定版本已确认' : approval.status === 'CHANGE_REQUESTED' ? '顾客请求修改' : historicalConfirmation ? '历史本地确认' : STATUS_LABEL[d.status]}</Badge>
                </div>

                {/* 操作区（状态机驱动） */}
                <div className="flex flex-wrap gap-1 border-t border-gray-100 px-1 pt-2">
                  {d.status === 'draft' && !historicalConfirmation && (
                    <Button size="sm" variant="ghost" onClick={() => openDesign(d)}>
                      <Pencil size={12} />
                      继续编辑
                    </Button>
                  )}
                  {readOnly && !formalApproved && (
                    <Button size="sm" variant="ghost" onClick={() => openDesign(d)}>
                      <Eye size={12} />
                      查看历史草稿
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => duplicateDesign(d)}>
                    <Copy size={12} />
                    复制
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
        title="删除设计？"
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setDeleteTarget(null)}>
              取消
            </Button>
            <Button variant="danger" size="sm" onClick={doDelete}>
              确认删除
            </Button>
          </>
        }
      >
        <p className="text-sm text-gray-600">
          「{deleteTarget?.title ?? '未命名设计'}」及其画布数据将被删除，此操作不可恢复。
        </p>
      </Modal>
    </div>
  );
}
