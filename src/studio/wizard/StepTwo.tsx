/**
 * STEP 2 · 三栏画布（Studio-PRD §12.4 · 三视图主视觉）
 *
 * 左：模板库（窄栏，风格映射智能排序）｜ 中：主视觉三视图 tab
 *   - 整体搭配：Back plate 相机裁剪（viewBox 纯视图操作，不动 slots V2 几何）
 *   - 十指平铺（默认）：5×2 网格每格 ≥120px
 *   - 单指细节：≥240px 大图 + 十指搭配条（右栏常驻详情为其紧凑形态）
 * 右：常驻单指详情（≥240px）+ 参数 + 操作
 * 导出/缩略图：隐藏挂载的整幅 plate 实例为唯一注册源（与当前视图无关，导出语义稳定）。
 * 顶栏 [修改]：预览区收缩为一行摘要条 → 甲型/长度重新选择 → [应用→重新生成]；
 * 底部 [打开自由画布]：openBridge(designId)（已桥接则续进画布，见 @/studio/bridge）。
 */

import { Button, useToast, cx } from '@/design-system';
import { Presentation } from 'lucide-react';
import { TenFingerPreview } from '@/studio/preview/TenFingerPreview';
import { TiledNailsPreview } from '@/studio/preview/TiledNailsPreview';
import { SingleNailView } from '@/studio/preview/SingleNailView';
import { loadShapeParams } from '@/studio/preview/material-library';
import { openBridge } from '@/studio/bridge';
import { getEditorDoc } from '@/studio/editor';
import { useEffect, useState } from 'react';
import { useWizardStore, type WizardViewMode } from './wizard-store';
import { ShapeLengthPicker } from './ShapeLengthPicker';
import { TemplateGallery } from './TemplateGallery';
import { ParamsPanel } from './ParamsPanel';
import { FingerDetailPanel } from './FingerDetailPanel';
import { PresentationMode } from './PresentationMode';

const VIEW_TABS: { key: WizardViewMode; label: string }[] = [
  { key: 'ensemble', label: '整体搭配 · Back 手背' },
  { key: 'tiled', label: '十指平铺' },
  { key: 'single', label: '单指细节' },
];

export function StepTwo() {
  const toast = useToast();
  const s = useWizardStore();
  const readOnly = s.status !== 'draft';
  const [shapeNames, setShapeNames] = useState<{ shape: string; length: string; mm: number } | null>(null);
  const [bridging, setBridging] = useState(false);
  const [presentOpen, setPresentOpen] = useState(false);

  /* 已桥接判定：EditorDoc 存在即该设计已转入自由画布（PRD §15 不可逆） */
  const bridged = getEditorDoc(s.designId) !== undefined;

  useEffect(() => {
    if (!s.appliedShape || !s.appliedLength) return;
    loadShapeParams()
      .then((p) =>
        setShapeNames({
          shape: p.shapes[s.appliedShape!]?.name_en ?? s.appliedShape!,
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

  const previewProps = {
    shape: s.appliedShape,
    length: s.appliedLength,
    templateId: s.templateId,
    baseColor: s.baseColor ?? '#F5E0D3',
    finish: s.finish,
    fingerOverrides: s.fingerOverrides,
    readOnly,
  } as const;

  const detailPanel = (
    <FingerDetailPanel
      shape={s.appliedShape}
      length={s.appliedLength}
      templateId={s.templateId}
      baseColor={s.baseColor ?? '#F5E0D3'}
      finish={s.finish}
      fingerOverrides={s.fingerOverrides}
      selectedFinger={s.selectedFinger}
      onExpand={() => s.setViewMode('single')}
    />
  );

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div className="grid min-h-0 flex-1 grid-cols-[240px_minmax(0,1fr)_300px] gap-4">
        {/* 左：模板库（窄栏 · 风格标签 + 单列图文卡片） */}
        <aside data-debug-id="studio.wizard.step2.template-gallery" className="min-h-0 rounded-card border border-gray-200 bg-white p-3">
          <TemplateGallery />
        </aside>

        {/* 中：主视觉三视图（或 [修改] 编辑态） */}
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
              {/* 视图切换 tab（UI 瞬态，不写入设计文档） */}
              <div className="flex items-center justify-between">
                <div className="flex rounded-button border border-gray-200 bg-white p-0.5" role="tablist">
                  {VIEW_TABS.map((tab) => (
                    <button
                      key={tab.key}
                      role="tab"
                      aria-selected={s.viewMode === tab.key}
                      onClick={() => s.setViewMode(tab.key)}
                      className={cx(
                        'rounded-button px-2.5 py-1 text-xs transition-colors duration-fast',
                        s.viewMode === tab.key
                          ? 'bg-primary-soft font-medium text-primary'
                          : 'text-gray-500 hover:text-gray-800',
                      )}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-3">
                  {/* 指尖观察方向（UI 瞬态，整体搭配视图专用）：整幅组合画布 180° 旋转，不改设计数据 */}
                  {s.viewMode === 'ensemble' && (
                    <div
                      className="flex rounded-button border border-gray-200 bg-white p-0.5"
                      role="group"
                      aria-label="指尖观察方向"
                      data-testid="tip-orientation-toggle"
                    >
                      {(['up', 'down'] as const).map((o) => (
                        <button
                          key={o}
                          type="button"
                          aria-pressed={s.tipOrientation === o}
                          aria-label={o === 'up' ? '指尖朝上' : '指尖朝下'}
                          onClick={() => s.setTipOrientation(o)}
                          className={cx(
                            'rounded-button px-2.5 py-1 text-xs transition-colors duration-fast',
                            s.tipOrientation === o
                              ? 'bg-primary-soft font-medium text-primary'
                              : 'text-gray-500 hover:text-gray-800',
                          )}
                        >
                          {o === 'up' ? '指尖朝上' : '指尖朝下'}
                        </button>
                      ))}
                    </div>
                  )}
                  <span className="hidden text-[10px] text-gray-400 xl:inline">NailSlot V2 标定（back-v2.1.0）· 双击指甲看单指细节</span>
                  <Button size="sm" variant="secondary" onClick={() => setPresentOpen(true)} title="全屏只读展示，适合把屏幕转向顾客（Esc 退出）">
                    <Presentation size={13} />
                    顾客展示
                  </Button>
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto">
                {s.viewMode === 'ensemble' && (
                  <TenFingerPreview
                    {...previewProps}
                    registerExport={false}
                    tipOrientation={s.tipOrientation}
                    fitContainer
                    className="h-full"
                    selectedFinger={s.selectedFinger}
                    onFingerClick={(fc) => s.setSelectedFinger(s.selectedFinger === fc ? null : fc)}
                  />
                )}
                {s.viewMode === 'tiled' && (
                  <TiledNailsPreview
                    {...previewProps}
                    selectedFinger={s.selectedFinger}
                    onFingerClick={(fc) => s.setSelectedFinger(fc)}
                    onOpenSingle={(fc) => {
                      s.setSelectedFinger(fc);
                      s.setViewMode('single');
                    }}
                  />
                )}
                {s.viewMode === 'single' && (
                  <SingleNailView
                    {...previewProps}
                    finger={s.selectedFinger ?? 'R4'}
                    onSelectFinger={s.setSelectedFinger}
                    onExit={() => s.setViewMode('tiled')}
                  />
                )}
              </div>

              {/*
                导出/缩略图专用：整幅 plate 的隐藏挂载实例（唯一 registerExport 源）。
                与当前视图解耦——无论停在哪个视图，导出 PNG 与列表缩略图语义稳定。
              */}
              <div className="pointer-events-none h-0 overflow-hidden" aria-hidden="true">
                <TenFingerPreview {...previewProps} readOnly />
              </div>
            </>
          )}
        </section>

        {/* 右：常驻单指详情（≥240px）+ 参数 + 操作 */}
        <aside className="flex min-h-0 flex-col gap-3">
          {detailPanel}
          <div data-debug-id="studio.wizard.step2.params-panel" className="min-h-0 flex-1 rounded-card border border-gray-200 bg-white p-3">
            <ParamsPanel />
          </div>
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

      {/* 顾客展示模式（全屏只读 · Esc 退出 · 继承当前指尖方向） */}
      <PresentationMode
        open={presentOpen}
        onClose={() => setPresentOpen(false)}
        shape={s.appliedShape}
        length={s.appliedLength}
        templateId={s.templateId}
        templateName={s.templateName}
        baseColor={s.baseColor ?? '#F5E0D3'}
        finish={s.finish}
        fingerOverrides={s.fingerOverrides}
        status={s.status}
        initialFinger={s.selectedFinger}
        tipOrientation={s.tipOrientation}
      />
    </div>
  );
}
