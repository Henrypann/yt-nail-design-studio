/**
 * STEP 2 · 三栏画布（Studio-PRD §12.4）
 *
 * 左：模板库（风格映射智能排序）｜ 中：5×2 十指预览（Back 单视图 · NailSlot V2）｜ 右：参数 + 操作
 * 顶栏 [修改]：预览区收缩为一行摘要条 → 甲型/长度重新选择 → [应用→重新生成]，
 * 模板与参数不丢失；取消完整恢复。
 * 底部 [打开自由画布]：先确保设计已保存 → openBridge(designId)（首次桥接做数据转化 +
 * 不可逆警告；已桥接则续进画布，见 @/studio/bridge）。已桥接后顶栏 [修改] 失效（WizardPage）。
 */

import { Button, useToast } from '@/design-system';
import { TenFingerPreview } from '@/studio/preview/TenFingerPreview';
import { loadShapeParams } from '@/studio/preview/material-library';
import { openBridge } from '@/studio/bridge';
import { getEditorDoc } from '@/studio/editor';
import { useEffect, useState } from 'react';
import { useWizardStore } from './wizard-store';
import { ShapeLengthPicker } from './ShapeLengthPicker';
import { TemplateGallery } from './TemplateGallery';
import { ParamsPanel } from './ParamsPanel';

export function StepTwo() {
  const toast = useToast();
  const s = useWizardStore();
  const readOnly = s.status !== 'draft';
  const [shapeNames, setShapeNames] = useState<{ shape: string; length: string; mm: number } | null>(null);
  const [bridging, setBridging] = useState(false);

  /* 已桥接判定：EditorDoc 存在即该设计已转入自由画布（PRD §15 不可逆） */
  const bridged = getEditorDoc(s.designId) !== undefined;

  useEffect(() => {
    if (!s.appliedShape || !s.appliedLength) return;
    loadShapeParams()
      .then((p) =>
        setShapeNames({
          shape: p.shapes[s.appliedShape!].name,
          length: p.lengths[s.appliedLength!].name,
          mm: p.lengths[s.appliedLength!].lengthMm,
        }),
      )
      .catch(() => undefined);
  }, [s.appliedShape, s.appliedLength]);

  if (!s.appliedShape || !s.appliedLength) return null;

  const handleReapply = async () => {
    const ok = await s.applyShapeLengthEdit();
    if (!ok) toast.error('预览生成失败，请重试。');
  };

  /** [打开自由画布]：等待进行中的自动保存 → 确保已保存 → openBridge（首次转化+警告 / 已桥接续进） */
  const handleOpenBridge = async () => {
    if (bridging || readOnly) return;
    setBridging(true);
    try {
      const st = useWizardStore.getState;
      // 自动保存可能正在飞行中（此时 saveNow 会被守卫直接拒绝），先等其落地（最多 8s）
      for (let i = 0; i < 80 && st().saveState === 'saving'; i += 1) {
        // eslint-disable-next-line no-await-in-loop
        await new Promise((r) => window.setTimeout(r, 100));
      }
      if (st().status !== 'draft') return; // 等待期间被确认冻结
      if (st().saveState !== 'saved') {
        const saved = await st().saveNow();
        if (!saved) {
          toast.error('保存失败，无法打开自由画布。请重试。');
          return;
        }
      }
      const result = openBridge(st().designId);
      if (!result.ok) toast.error('设计数据缺失，无法打开自由画布。');
    } finally {
      setBridging(false);
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div className="grid min-h-0 flex-1 grid-cols-[440px_minmax(0,1fr)_300px] gap-4">
        {/* 左：模板库（v1.5.1 加宽：风格标签 + 图文卡片可读性优先） */}
        <aside data-debug-id="studio.wizard.step2.template-gallery" className="min-h-0 rounded-card border border-gray-200 bg-white p-3">
          <TemplateGallery />
        </aside>

        {/* 中：十指预览（或 [修改] 编辑态） */}
        <section data-debug-id="studio.wizard.step2.preview" className="flex min-h-0 flex-col gap-3">
          {s.editingShapeLength ? (
            /* 顶栏 [修改]：预览区收缩为摘要条 + 重新选择 */
            <>
              <div className="flex items-center justify-between rounded-panel border border-gray-200 bg-white px-4 py-2 text-xs text-gray-600">
                <span>
                  当前方案：{shapeNames?.shape} · {shapeNames?.length}（{shapeNames?.mm}mm）
                  {s.templateName ? ` · 模板「${s.templateName}」` : ''}（模板与参数已保留）
                </span>
              </div>
              <div className="rounded-card border border-gray-200 bg-white p-4">
                <ShapeLengthPicker
                  shape={s.shape}
                  length={s.length}
                  onShapeChange={s.setShape}
                  onLengthChange={s.setLength}
                />
                <div className="mt-4 flex justify-end gap-2">
                  <Button variant="ghost" onClick={s.cancelEditShapeLength} disabled={s.applying}>
                    取消
                  </Button>
                  <Button
                    loading={s.applying}
                    disabled={!s.shape || !s.length}
                    onClick={handleReapply}
                  >
                    {s.applying ? '生成预览中…' : '应用 → 重新生成'}
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-gray-700">Back · 手背</span>
                <span className="text-[10px] text-gray-400">NailSlot V2 标定视图（back-v2.1.0）</span>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto">
                <TenFingerPreview
                  shape={s.appliedShape}
                  length={s.appliedLength}
                  templateId={s.templateId}
                  baseColor={s.baseColor ?? '#F5E0D3'}
                  fingerOverrides={s.fingerOverrides}
                  selectedFinger={s.selectedFinger}
                  onFingerClick={(fc) => s.setSelectedFinger(s.selectedFinger === fc ? null : fc)}
                  readOnly={readOnly}
                />
              </div>
            </>
          )}
        </section>

        {/* 右：参数 + 操作 */}
        <aside data-debug-id="studio.wizard.step2.params-panel" className="min-h-0 rounded-card border border-gray-200 bg-white p-3">
          <ParamsPanel />
        </aside>
      </div>

      {/* 底部：桥接入口（PRD §15：首次转化 + 不可逆警告；已桥接续进画布） */}
      <footer className="flex justify-center border-t border-gray-100 pt-3">
        <Button
          variant="ghost"
          disabled={readOnly}
          loading={bridging}
          title={
            readOnly
              ? '设计已冻结只读，不可进入自由画布编辑'
              : bridged
                ? '该设计已在自由画布中，点击继续编辑'
                : '转入自由画布精细编辑（转入后模板不可再切换）'
          }
          onClick={() => void handleOpenBridge()}
        >
          {bridged ? '返回自由画布' : '打开自由画布'}
        </Button>
      </footer>
    </div>
  );
}
