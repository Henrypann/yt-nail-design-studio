/**
 * `/design` 我的设计（模块 4）
 * 卡片列表 + 状态筛选 tabs（全部/草稿/已确认/已提交）+ 徽章（draft 灰 / confirmed 蓝 /
 * submitted 深蓝，lib STATUS_BADGE）+ 空状态插画 + 状态机操作：
 * [继续编辑]（draft 进 Editor）/ 只读查看 + [基于已确认创建新版本]（confirmed）/
 * [退回草稿]（confirmed→draft，二次确认）/ 复制 / 删除。
 */

import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Copy, Eye, Pencil, Plus, RotateCcw, Trash2 } from 'lucide-react';
import { Badge, Button, Card, EmptyState, Modal, Tabs, useToast } from '@/design-system';
import { designNewFresh, Routes } from '@/app/routes';
import {
  STATUS_BADGE,
  STATUS_LABEL,
  createNewVersionFromConfirmed,
  revertToDraft,
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
  const [revertTarget, setRevertTarget] = useState<DesignSummary | null>(null);
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
    return designs.filter((d) => d.status === (tab as DesignStatus));
  }, [designs, tab]);

  const refresh = () => setTick((t) => t + 1);

  const openDesign = (d: DesignSummary) => {
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

  const newVersion = (d: DesignSummary) => {
    const probe = inspectEditorDoc(d.id);
    if (probe.present && probe.schemaVersion === 7) {
      toast.error('V7 新版本将在确认快照 PR 中开放；原设计未改变。');
      return;
    }
    let newId: string | null = null;
    try {
      newId = genId('design');
      const copy = createNewVersionFromConfirmed(d, newId);
      if (duplicateEditorDocV6(d.id, newId) === null) {
        throw new Error('原画布不可读取，未创建新版本');
      }
      upsertDesign(copy);
      refresh();
      toast.success(`已基于 v${d.version} 创建新版本 v${copy.version}（草稿）`);
    } catch (err) {
      if (newId) {
        try { removeEditorDoc(newId); } catch { /* preserve the original failure */ }
      }
      toast.error(err instanceof Error ? err.message : '操作失败');
    }
  };

  const doRevert = () => {
    if (!revertTarget) return;
    try {
      upsertDesign(revertToDraft(revertTarget));
      setRevertTarget(null);
      refresh();
      toast.success('已退回草稿，可以继续编辑');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '操作失败');
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
            顾客确认为线下场景：软件内仅手动标记「顾客已确认」→ 冻结只读。
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
              : `${t.label}（${designs.filter((d) => d.status === t.key).length}）`,
        }))}
        activeKey={tab}
        onChange={(k) => setTab(k as TabKey)}
      />

      {filtered.length === 0 ? (
        <EmptyState
          illustration={<img src={designsEmptyUrl} alt="" className="h-28 w-auto" />}
          title={tab === 'all' ? '还没有设计。创建你的第一个美甲设计吧' : `没有「${TABS.find((t) => t.key === tab)?.label}」状态的设计`}
          description="从 Wizard 模板快速出单，或打开自由画布精细创作。"
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
            const readOnly = d.status === 'confirmed' || d.status === 'submitted';
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
                    {d.confirmation && (
                      <p className="mt-0.5 text-nano text-info">
                        {d.confirmation.confirmedBy} 标记于 {formatTime(d.confirmation.confirmedAt)}
                      </p>
                    )}
                  </div>
                  <Badge variant={STATUS_BADGE[d.status]}>{STATUS_LABEL[d.status]}</Badge>
                </div>

                {/* 操作区（状态机驱动） */}
                <div className="flex flex-wrap gap-1 border-t border-gray-100 px-1 pt-2">
                  {d.status === 'draft' && (
                    <Button size="sm" variant="ghost" onClick={() => openDesign(d)}>
                      <Pencil size={12} />
                      继续编辑
                    </Button>
                  )}
                  {readOnly && (
                    <Button size="sm" variant="ghost" onClick={() => openDesign(d)}>
                      <Eye size={12} />
                      查看
                    </Button>
                  )}
                  {d.status === 'confirmed' && (
                    <>
                      <Button size="sm" variant="ghost" onClick={() => newVersion(d)}>
                        <Copy size={12} />
                        基于此创建新版本
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setRevertTarget(d)}>
                        <RotateCcw size={12} />
                        退回草稿
                      </Button>
                    </>
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

      {/* 退回草稿 · 二次确认 */}
      <Modal
        open={revertTarget !== null}
        onClose={() => setRevertTarget(null)}
        title="退回草稿？"
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setRevertTarget(null)}>
              取消
            </Button>
            <Button variant="danger" size="sm" onClick={doRevert}>
              退回草稿
            </Button>
          </>
        }
      >
        <p className="text-sm text-gray-600">
          「{revertTarget?.title ?? '未命名设计'}」将解除冻结回到草稿状态，确认记录会被清除。
          适用于顾客线下反悔的场景。
        </p>
      </Modal>

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
