/**
 * STEP 2 · Canvas-first 响应式工作区（Studio-PRD §12.4 · 三视图主视觉）
 *
 * Full/Compact：官方模板｜主视觉｜Inspector；Focus：官方模板进入 Drawer；
 * Tablet：官方模板与 Inspector 均进入互斥 Overlay，中央预览始终优先获得空间。
 * 三视图：整体搭配、十指平铺、单指细节；切换只改变 UI 瞬态，不改设计数据。
 * 导出/缩略图：隐藏挂载的整幅 plate 实例为唯一注册源（与当前视图无关，导出语义稳定）。
 * 顶栏 [修改]：预览区收缩为一行摘要条 → 甲型/长度重新选择 → [应用→重新生成]；
 * 底部 [进入 Editor]：openBridge(designId)（首次创建或继续同一 EditorDoc，见 @/studio/bridge）。
 */

import { Button, useToast, cx } from '@/design-system';
import { AlertTriangle, ArrowRight, CheckCircle2, ChevronDown, LibraryBig, Presentation, SlidersHorizontal } from 'lucide-react';
import { TenFingerPreview } from '@/studio/preview/TenFingerPreview';
import { TiledNailsPreview } from '@/studio/preview/TiledNailsPreview';
import { SingleNailView } from '@/studio/preview/SingleNailView';
import { loadShapeParams } from '@/studio/preview/material-library';
import { openBridge } from '@/studio/bridge';
import { inspectEditorDoc } from '@/studio/editor/lib/repo-v6';
import { isPetalVeilRecipe } from '@/studio/editor/lib/recipe-model';
import { inspectWizardEditorV7Compatibility } from '@/studio/editor/v7/create';
import {
  PetalVeilSinglePreview,
  PetalVeilTiledPreview,
} from '@/studio/petal-veil/PetalVeilPreview';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useWizardStore, type WizardViewMode } from './wizard-store';
import { ShapeLengthPicker } from './ShapeLengthPicker';
import { TemplateGallery } from './TemplateGallery';
import { ParamsPanel } from './ParamsPanel';
import { FingerDetailPanel } from './FingerDetailPanel';
import { PresentationMode } from './PresentationMode';
import { PetalVeilPresentationMode } from './PetalVeilPresentationMode';
import { WizardPanelOverlay } from './WizardPanelOverlay';

const VIEW_TABS: { key: WizardViewMode; label: string }[] = [
  { key: 'ensemble', label: '整体搭配 · Back 手背' },
  { key: 'tiled', label: '十指平铺' },
  { key: 'single', label: '单指细节' },
];

type WizardLayoutMode = 'full' | 'compact' | 'focus' | 'tablet';
type WizardOverlayPanel = 'library' | 'inspector' | 'preflight' | null;
type WizardInspectorTab = 'finger' | 'params';

function layoutModeForWidth(width: number): WizardLayoutMode {
  if (width >= 1280) return 'full';
  if (width >= 1040) return 'compact';
  if (width >= 720) return 'focus';
  return 'tablet';
}

export function StepTwo() {
  const toast = useToast();
  const s = useWizardStore();
  const readOnly = s.status !== 'draft';
  const [shapeNames, setShapeNames] = useState<{ shape: string; length: string; mm: number } | null>(null);
  const [bridging, setBridging] = useState(false);
  const [presentOpen, setPresentOpen] = useState(false);
  const [layoutMode, setLayoutMode] = useState<WizardLayoutMode>('full');
  const [overlayPanel, setOverlayPanel] = useState<WizardOverlayPanel>(null);
  const [inspectorTab, setInspectorTab] = useState<WizardInspectorTab>('finger');
  const shellRef = useRef<HTMLDivElement>(null);
  const location = useLocation();
  const overlayTriggerRef = useRef<HTMLButtonElement | null>(null);
  const petalP0 = isPetalVeilRecipe(s.recipe);
  const viewTabs = petalP0 ? VIEW_TABS.filter((tab) => tab.key !== 'ensemble') : VIEW_TABS;

  /* 已桥接判定：EditorDoc 存在即该设计已转入自由画布（PRD §15 不可逆） */
  const bridged = inspectEditorDoc(s.designId).present;

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

  useEffect(() => {
    if (petalP0 && s.viewMode === 'ensemble') s.setViewMode('tiled');
  }, [petalP0, s.setViewMode, s.viewMode]);

  useEffect(() => {
    if (s.selectedFinger) setInspectorTab('finger');
  }, [s.selectedFinger]);

  useLayoutEffect(() => {
    const shell = shellRef.current;
    if (!shell) return;
    const update = () => setLayoutMode(layoutModeForWidth(shell.getBoundingClientRect().width));
    update();
    const observer = new ResizeObserver(update);
    observer.observe(shell);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if ((layoutMode === 'full' || layoutMode === 'compact') && (overlayPanel === 'library' || overlayPanel === 'inspector')) setOverlayPanel(null);
    if (layoutMode === 'focus' && overlayPanel === 'inspector') setOverlayPanel(null);
  }, [layoutMode, overlayPanel]);

  useEffect(() => {
    if (new URLSearchParams(location.search).get('officialTemplatePanel') !== '1') return;
    if (layoutMode === 'full' || layoutMode === 'compact') return;
    overlayTriggerRef.current = document.querySelector<HTMLButtonElement>('[data-testid="wizard-template-trigger"]');
    setOverlayPanel('library');
  }, [location.search, layoutMode]);

  if (!s.appliedShape || !s.appliedLength) return null;

  const editorCompatibility = inspectWizardEditorV7Compatibility({
    shape: s.appliedShape,
    length: s.appliedLength,
    ...(s.templateId ? { templateId: s.templateId } : {}),
    ...(s.templateAssetRef ? { templateAssetRef: s.templateAssetRef } : {}),
    finish: s.finish,
    recipe: s.recipe,
    fingerOverrides: s.fingerOverrides,
  });

  const handleReapply = async () => {
    await s.applyShapeLengthEdit(); // 失败由持久内联错误条呈现（applyError）
  };

  const openOverlay = (panel: Exclude<WizardOverlayPanel, null>, trigger: HTMLButtonElement) => {
    overlayTriggerRef.current = trigger;
    setOverlayPanel(panel);
  };

  const closeOverlay = () => {
    setOverlayPanel(null);
    const trigger = overlayTriggerRef.current;
    overlayTriggerRef.current = null;
    queueMicrotask(() => trigger?.isConnected && trigger.focus());
  };

  /** [进入 Editor]：等待自动保存 → openBridge（首次创建 / 已存在则继续） */
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
          toast.error('保存失败，无法进入 Editor。请重试。');
          return;
        }
      }
      const result = openBridge(st().designId);
      if (!result.ok) {
        const message = result.reason === 'editor_doc_unsupported'
          ? '画布来自更高版本，当前版本不会覆盖。'
          : result.reason === 'editor_doc_invalid'
            ? '画布数据无效，原始数据已保留。'
            : result.reason === 'save_failed'
              ? '画布保存失败，未进行跳转。'
              : result.reason === 'v7_content_not_supported'
                ? `该设计暂不能无损转换到 V7：${result.message ?? '请更换受支持的模板或效果。'}`
              : '设计数据缺失，无法打开自由画布。';
        toast.error(message);
      }
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
    recipe: s.recipe,
    fingerOverrides: s.fingerOverrides,
    readOnly,
  } as const;

  const detailPanel = petalP0 ? (
    <div className="rounded-card border border-gray-200 bg-white p-4">
      <p className="text-sm font-medium text-gray-900">R4 · Signature 重音指</p>
      <p className="mt-1 text-xs leading-relaxed text-gray-500">
        五瓣低浮雕花 · 0.18mm · UV 0.62 / 0.56。其余九指固定为奶雾微法式。
      </p>
      <p className="mt-3 text-nano text-warning">Canonical Fixture 待人工视觉签收 · 制造未验证</p>
    </div>
  ) : (
    <FingerDetailPanel
      shape={s.appliedShape}
      length={s.appliedLength}
      templateId={s.templateId}
      baseColor={s.baseColor ?? '#F5E0D3'}
      finish={s.finish}
      recipe={s.recipe}
      fingerOverrides={s.fingerOverrides}
      selectedFinger={s.selectedFinger}
      onExpand={() => s.setViewMode('single')}
    />
  );

  const libraryDocked = layoutMode === 'full' || layoutMode === 'compact';
  const inspectorDocked = layoutMode !== 'tablet';
  const gridTemplate = layoutMode === 'full'
    ? (petalP0 ? '180px minmax(0,1fr) 260px' : '280px minmax(0,1fr) 300px')
    : layoutMode === 'compact'
      ? '220px minmax(0,1fr) 220px'
      : layoutMode === 'focus'
        ? 'minmax(0,1fr) 220px'
        : 'minmax(0,1fr)';

  const inspectorContent = (
    <div className="flex h-full min-h-0 flex-col">
      {(layoutMode === 'compact' || layoutMode === 'focus' || layoutMode === 'tablet') && (
        <div className="mb-2 flex shrink-0 rounded-xl border border-hairline bg-surface-soft p-1" role="tablist" aria-label="参数与单指详情">
          <button type="button" role="tab" aria-selected={inspectorTab === 'finger'} onClick={() => setInspectorTab('finger')} className={cx('min-h-11 flex-1 rounded-lg px-2 text-xs font-semibold', inspectorTab === 'finger' ? 'bg-white text-primary shadow-sm' : 'text-mute')}>单指详情</button>
          <button type="button" role="tab" aria-selected={inspectorTab === 'params'} onClick={() => setInspectorTab('params')} className={cx('min-h-11 flex-1 rounded-lg px-2 text-xs font-semibold', inspectorTab === 'params' ? 'bg-white text-primary shadow-sm' : 'text-mute')}>参数</button>
        </div>
      )}
      <div className={cx('min-h-0', layoutMode === 'full' ? 'flex flex-1 flex-col gap-3' : 'flex-1 overflow-y-auto')}>
        {(layoutMode === 'full' || inspectorTab === 'finger') && detailPanel}
        {(layoutMode === 'full' || inspectorTab === 'params') && (
          <div data-debug-id="studio.wizard.step2.params-panel" className={cx('min-h-0 rounded-card border border-hairline bg-surface p-3', layoutMode === 'full' && 'flex-1')}>
            <ParamsPanel />
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div ref={shellRef} className="flex min-h-0 flex-col gap-3 lg:h-full" data-testid="wizard-canvas-first" data-layout={layoutMode}>
      <div className="grid min-h-0 flex-1 gap-3" style={{ gridTemplateColumns: gridTemplate }}>
        {/* 左：官方模板（窄栏 · 按甲型适配度排序的单列卡片） */}
        {libraryDocked && <aside data-testid="wizard-template-library" data-debug-id="studio.wizard.step2.template-gallery" className="min-h-0 overflow-hidden rounded-card border border-hairline bg-surface p-3">
          <TemplateGallery />
        </aside>}

        {/* 中：主视觉三视图（或 [修改] 编辑态） */}
        <section data-debug-id="studio.wizard.step2.preview" className="flex min-h-0 min-w-0 flex-col gap-3">
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
                <div className="mt-4 flex flex-col items-end gap-2">
                  {s.applyError && (
                    <div
                      role="alert"
                      className="flex w-full items-center justify-between rounded-panel border border-error/20 bg-error-soft px-3 py-2 text-xs text-error"
                      data-debug-id="studio.wizard.step2.apply-error"
                    >
                      <span>{s.applyError}</span>
                      <button
                        onClick={() => void handleReapply()}
                        className="rounded-button border border-error/30 bg-white px-2 py-1 transition-colors duration-fast hover:bg-error-soft"
                      >
                        重试
                      </button>
                    </div>
                  )}
                  <div className="flex justify-end gap-2">
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
              </div>
            </>
          ) : (
            <>
              {/* 视图切换 tab（UI 瞬态，不写入设计文档） */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                {!libraryDocked && (
                  <Button data-testid="wizard-template-trigger" size="sm" variant="secondary" className="min-h-11" aria-haspopup="dialog" onClick={(event) => openOverlay('library', event.currentTarget)}>
                    <LibraryBig size={14} />官方模板
                  </Button>
                )}
                <div className="flex rounded-button border border-gray-200 bg-white p-0.5" role="tablist">
                  {viewTabs.map((tab) => (
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
                <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                  {!inspectorDocked && (
                    <Button data-testid="wizard-inspector-trigger" size="sm" variant="secondary" className="min-h-11" aria-haspopup="dialog" onClick={(event) => openOverlay('inspector', event.currentTarget)}>
                      <SlidersHorizontal size={14} />{s.selectedFinger ?? '单指'} 详情/参数
                    </Button>
                  )}
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
                  <span className="hidden text-nano text-gray-400 xl:inline">
                    {petalP0 ? 'Canonical Three.js PBR · 双击 R4 看单指细节' : 'NailSlot V2 标定（back-v2.1.0）· 双击指甲看单指细节'}
                  </span>
                  <span className="relative">
                    <Button size="sm" variant="secondary" onClick={() => setPresentOpen(true)} title="全屏只读展示，适合把屏幕转向顾客（Esc 退出）">
                      <Presentation size={13} />
                      顾客展示
                    </Button>
                  </span>
                </div>
              </div>

              <div className="min-h-[24rem] flex-1 overflow-y-auto lg:min-h-0">
                {s.viewMode === 'ensemble' && (
                  <div className="h-full" data-debug-id="studio.preview.ensemble">
                    <TenFingerPreview
                      {...previewProps}
                      registerExport={false}
                      tipOrientation={s.tipOrientation}
                      fitContainer
                      className="h-full"
                      selectedFinger={s.selectedFinger}
                      onFingerClick={(fc) => s.setSelectedFinger(s.selectedFinger === fc ? null : fc)}
                    />
                  </div>
                )}
                {s.viewMode === 'tiled' && (
                  petalP0 && s.recipe ? (
                    <PetalVeilTiledPreview
                      recipe={s.recipe}
                      selectedFinger={s.selectedFinger}
                      onFingerClick={(fc) => s.setSelectedFinger(fc)}
                      onOpenSingle={(fc) => {
                        s.setSelectedFinger(fc);
                        s.setViewMode('single');
                      }}
                    />
                  ) : (
                    <TiledNailsPreview
                      {...previewProps}
                      selectedFinger={s.selectedFinger}
                      onFingerClick={(fc) => s.setSelectedFinger(fc)}
                      onOpenSingle={(fc) => {
                        s.setSelectedFinger(fc);
                        s.setViewMode('single');
                      }}
                    />
                  )
                )}
                {s.viewMode === 'single' && (
                  petalP0 && s.recipe ? (
                    <PetalVeilSinglePreview
                      recipe={s.recipe}
                      finger={s.selectedFinger ?? 'R4'}
                      registerExport
                      onExit={() => s.setViewMode('tiled')}
                    />
                  ) : (
                    <SingleNailView
                      {...previewProps}
                      finger={s.selectedFinger ?? 'R4'}
                      onSelectFinger={s.setSelectedFinger}
                      onExit={() => s.setViewMode('tiled')}
                    />
                  )
                )}
              </div>

              {/*
                导出/缩略图专用：整幅 plate 的隐藏挂载实例（唯一 registerExport 源）。
                与当前视图解耦——无论停在哪个视图，导出 PNG 与列表缩略图语义稳定。
              */}
              {!petalP0 && (
                <div className="pointer-events-none h-0 overflow-hidden" aria-hidden="true">
                  <TenFingerPreview {...previewProps} readOnly />
                </div>
              )}
            </>
          )}
        </section>

        {/* 右：Full 双区；Compact/Focus 切换式 Inspector；Tablet 进入 Sheet */}
        {inspectorDocked && <aside data-testid="wizard-inspector" data-debug-id="studio.wizard.step2.inspector" className="min-h-0 min-w-0 overflow-hidden">{inspectorContent}</aside>}
      </div>

      {/* 底部：资产预检摘要 + Editor 入口合并，避免长期挤压 Canvas */}
      {!petalP0 && <footer
        className="order-last sticky bottom-0 z-20 grid shrink-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-2xl border border-primary/20 bg-surface px-3 py-1 shadow-float lg:static lg:z-auto xl:grid-cols-[minmax(220px,0.8fr)_minmax(240px,1fr)_auto]"
        data-debug-id="studio.wizard.bridge"
        data-testid="wizard-editor-handoff"
      >
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          <span className={cx('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', editorCompatibility.ok ? 'bg-success-soft text-success' : 'bg-warning-soft text-warning')}>
            {editorCompatibility.ok ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
          </span>
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold text-ink">{editorCompatibility.ok ? `Editor V7 资产预检通过 · ${editorCompatibility.items.length}/${editorCompatibility.items.length}` : '暂不能进入 Editor V7'}</p>
            <button type="button" data-testid="wizard-editor-v7-preflight-toggle" className="inline-flex min-h-11 min-w-11 items-center gap-1 text-nano font-medium text-primary hover:text-primary-hover" aria-haspopup="dialog" aria-expanded={overlayPanel === 'preflight'} onClick={(event) => openOverlay('preflight', event.currentTarget)}>
              查看兼容详情 <ChevronDown size={12} />
            </button>
          </div>
        </div>
        <div className="hidden min-w-0 flex-1 xl:block">
          <p className="text-xs font-semibold text-ink">进入专业 Editor 继续精修</p>
          <p className="truncate text-nano text-mute">保留当前甲型与十指方案，进入 V7 图层、画布与预览工作区。</p>
        </div>
        <Button
          size="md"
          disabled={readOnly || (!bridged && !editorCompatibility.ok)}
          loading={bridging}
          className="min-h-11 shrink-0 px-4 text-sm"
          title={
            readOnly
              ? '设计已冻结只读，不可进入自由画布编辑'
              : !bridged && !editorCompatibility.ok
                ? editorCompatibility.message
              : bridged
                ? '该设计已有 Editor 文档，点击继续编辑'
                : '首次创建 Editor 文档（创建后模板不可再切换）'
          }
          onClick={() => void handleOpenBridge()}
        >
          进入 Editor
          <ArrowRight size={17} />
        </Button>
      </footer>}

      <WizardPanelOverlay open={overlayPanel === 'library'} title="官方模板" side="left" onClose={closeOverlay}>
        <div className="h-[calc(100dvh-80px)] min-h-0"><TemplateGallery /></div>
      </WizardPanelOverlay>
      <WizardPanelOverlay open={overlayPanel === 'inspector'} title="参数与单指详情" side="bottom" onClose={closeOverlay}>
        <div className="min-h-[320px]">{inspectorContent}</div>
      </WizardPanelOverlay>
      <WizardPanelOverlay open={overlayPanel === 'preflight'} title="Editor V7 资产兼容详情" side="bottom" onClose={closeOverlay}>
        <div className="space-y-3" data-testid="wizard-editor-v7-preflight">
          <p className="text-xs leading-5 text-body">{editorCompatibility.ok ? editorCompatibility.warning : editorCompatibility.message}</p>
          <dl className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
            {editorCompatibility.items.map((item) => (
              <div key={item.id} className="rounded-xl border border-hairline bg-surface-soft px-3 py-2" data-fidelity={item.fidelity}>
                <dt className="text-nano text-mute">{item.label}</dt>
                <dd className="mt-0.5 text-nano font-semibold text-body">{item.value}</dd>
                <p className={cx('mt-1 text-nano', item.fidelity === 'unavailable' ? 'text-warning' : item.fidelity === 'approximate' ? 'text-violet-600' : 'text-success')}>{item.fidelity === 'exact' ? '可编辑' : item.fidelity === 'approximate' ? '模拟/近似' : '不可用'}</p>
              </div>
            ))}
          </dl>
        </div>
      </WizardPanelOverlay>

      {/* 顾客展示模式（全屏只读 · Esc 退出 · 继承当前指尖方向） */}
      {petalP0 && s.recipe ? (
        <PetalVeilPresentationMode
          open={presentOpen}
          onClose={() => setPresentOpen(false)}
          recipe={s.recipe}
        />
      ) : (
        <PresentationMode
          open={presentOpen}
          onClose={() => setPresentOpen(false)}
          shape={s.appliedShape}
          length={s.appliedLength}
          templateId={s.templateId}
          templateName={s.templateName}
          baseColor={s.baseColor ?? '#F5E0D3'}
          finish={s.finish}
          recipe={s.recipe}
          fingerOverrides={s.fingerOverrides}
          initialFinger={s.selectedFinger}
          tipOrientation={s.tipOrientation}
        />
      )}
    </div>
  );
}
