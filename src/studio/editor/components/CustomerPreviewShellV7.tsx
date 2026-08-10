import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Eye, Grid3X3, Info, RotateCcw, ShieldCheck, Sparkles, X } from 'lucide-react';
import { Button, cx } from '@/design-system';
import { Routes } from '@/app/routes';
import { FINGER_CODES, type FingerCode } from '@/lib/types';
import type { EditorDocV7, RgbaColorV7, SurfaceFinishTypeV7 } from '../v7/model';
import {
  createCustomerPreviewScenarioV7,
  deriveCustomerPreviewSetV7,
  setCustomerPreviewBackgroundV7,
  setCustomerPreviewFinishV7,
} from '../v7/customer-preview';
import { clearCustomerPreviewSessionV7 } from '../v7/customer-preview-session';
import { CustomerNailPreviewV7 } from './CustomerNailPreviewV7';

const COLOR_SCENARIOS: Array<{ id: string; name: string; color: RgbaColorV7 }> = [
  { id: 'rose', name: '柔雾玫瑰', color: { colorSpace: 'srgb', r: 210, g: 112, b: 142, a: 1 } },
  { id: 'milk', name: '奶油白', color: { colorSpace: 'srgb', r: 249, g: 241, b: 231, a: 1 } },
  { id: 'berry', name: '浆果红', color: { colorSpace: 'srgb', r: 161, g: 34, b: 74, a: 1 } },
  { id: 'caramel', name: '焦糖棕', color: { colorSpace: 'srgb', r: 157, g: 101, b: 77, a: 1 } },
];

const FINISH_LABEL: Record<SurfaceFinishTypeV7, string> = {
  gloss: '亮面',
  matte: '哑光',
  frosted: '磨砂',
};

export function CustomerPreviewShellV7({ doc, loadWarnings }: { doc: EditorDocV7; loadWarnings: string[] }) {
  const navigate = useNavigate();
  const [mode, setMode] = useState<'set' | 'single'>('set');
  const [selectedFinger, setSelectedFinger] = useState<FingerCode>('L1');
  const [scenario, setScenario] = useState(createCustomerPreviewScenarioV7);
  const [compactPreview, setCompactPreview] = useState(() => window.matchMedia('(max-width: 1023px)').matches);
  const [scenarioPanelOpen, setScenarioPanelOpen] = useState(() => !window.matchMedia('(max-width: 1023px)').matches);
  const scenarioPanelRef = useRef<HTMLElement>(null);
  const scenarioTriggerRef = useRef<HTMLElement | null>(null);
  const readModels = useMemo(() => deriveCustomerPreviewSetV7(doc, scenario), [doc, scenario]);
  const selectedModel = readModels.find((model) => model.finger === selectedFinger) ?? readModels[0];
  const selectedNail = doc.nails[selectedFinger];
  const scenarioCount = Object.keys(scenario.backgroundColors).length + (scenario.finishType ? 1 : 0);

  useEffect(() => {
    const query = window.matchMedia('(max-width: 1023px)');
    const update = () => {
      setCompactPreview(query.matches);
      setScenarioPanelOpen(!query.matches);
      const trigger = scenarioTriggerRef.current;
      scenarioTriggerRef.current = null;
      queueMicrotask(() => trigger?.focus());
    };
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  const openScenarioPanel = () => {
    scenarioTriggerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setScenarioPanelOpen(true);
  };

  const closeScenarioPanel = () => {
    setScenarioPanelOpen(false);
    const trigger = scenarioTriggerRef.current;
    scenarioTriggerRef.current = null;
    queueMicrotask(() => trigger?.focus());
  };

  useEffect(() => {
    if (!compactPreview || !scenarioPanelOpen) return;
    scenarioPanelRef.current?.querySelector<HTMLElement>('button:not([disabled])')?.focus();
  }, [compactPreview, scenarioPanelOpen]);

  useEffect(() => {
    if (!scenarioPanelOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      closeScenarioPanel();
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [scenarioPanelOpen]);

  const trapScenarioFocus = (event: ReactKeyboardEvent<HTMLElement>) => {
    if (!compactPreview || event.key !== 'Tab') return;
    const focusable = Array.from(scenarioPanelRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]), [tabindex]:not([tabindex="-1"])') ?? []);
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  };

  const returnToEditor = () => {
    clearCustomerPreviewSessionV7(doc.designId);
    navigate(`${Routes.designCanvas}?design=${encodeURIComponent(doc.designId)}`);
  };

  const focusFinger = (finger: FingerCode) => {
    setSelectedFinger(finger);
    setMode('single');
  };

  return (
    <section className="flex h-[100dvh] min-h-[560px] min-w-0 flex-col overflow-hidden bg-[#f5f1ef]" data-testid="customer-preview-v7" data-preview-mode={mode} data-editor-schema="7" data-preview-readonly="true">
      <header className="flex min-h-[58px] flex-wrap items-center gap-2 border-b border-white/80 bg-white/95 px-3 py-2 backdrop-blur sm:px-5">
        <Button size="sm" variant="ghost" className="min-h-11 sm:min-h-0" onClick={returnToEditor}><ArrowLeft size={15} />返回设计</Button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-gray-900">{doc.title}</p>
          <p className="text-[10px] text-gray-500">顾客只读预览 · Revision {doc.revision}</p>
        </div>
        <span className="rounded-full border border-success/20 bg-success-soft px-2.5 py-1 text-[10px] font-semibold text-success"><ShieldCheck size={12} className="mr-1 inline" />不修改设计</span>
        {scenarioCount > 0 && <span className="rounded-full bg-violet-100 px-2.5 py-1 text-[10px] font-semibold text-violet-700">{scenarioCount} 项临时比较</span>}
        <Button size="sm" variant="secondary" disabled title="顾客确认 Snapshot 在 V7-16 开放"><CheckCircle2 size={14} />顾客确认</Button>
      </header>

      <div className="flex items-center justify-between gap-2 border-b border-white/80 bg-white/80 px-3 py-2 sm:px-5">
        <div className="flex rounded-xl border border-gray-200 bg-white p-1" role="group" aria-label="预览方式">
          <button type="button" aria-pressed={mode === 'set'} onClick={() => setMode('set')} className={cx('min-h-11 rounded-lg px-3 text-xs font-medium', mode === 'set' ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-50')}><Grid3X3 size={14} className="mr-1.5 inline" />十指总览</button>
          <button type="button" aria-pressed={mode === 'single'} onClick={() => setMode('single')} className={cx('min-h-11 rounded-lg px-3 text-xs font-medium', mode === 'single' ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-50')}><Eye size={14} className="mr-1.5 inline" />单指聚焦</button>
        </div>
        <div className="flex items-center gap-1.5 text-[10px] text-gray-500"><button type="button" onClick={scenarioPanelOpen ? closeScenarioPanel : openScenarioPanel} aria-expanded={scenarioPanelOpen} className="min-h-11 rounded-xl border border-violet-200 bg-violet-50 px-3 font-medium text-violet-700"><Sparkles size={13} className="mr-1 inline" />{scenarioPanelOpen ? '收起比较' : '方案比较'}{scenarioCount > 0 ? ` · ${scenarioCount}` : ''}</button><span className="rounded-full bg-white px-2 py-1 font-semibold text-gray-800">2D</span><span className="rounded-full border border-dashed border-gray-300 px-2 py-1" title="最终组合 3D 在 V7-14 开放">3D · 后续</span></div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden lg:flex-row">
        <main className="min-h-0 min-w-0 flex-1 overflow-auto p-3 sm:p-5" aria-label="顾客预览画布">
          {loadWarnings.length > 0 && <div className="mb-3 rounded-xl border border-warning/20 bg-warning-soft px-3 py-2 text-xs text-warning" role="status">旧设计已按兼容 reader 打开：{loadWarnings.join('；')}</div>}
          {mode === 'set' ? (
            <div className="mx-auto flex min-h-full max-w-7xl flex-col justify-center gap-4">
              <div className="text-center"><p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-primary">Customer set preview</p><h1 className="mt-1 text-xl font-semibold text-gray-900">十指整体方案</h1><p className="mt-1 text-xs text-gray-500">点击任意指甲查看细节；当前仅呈现已支持的 2D 内容。</p></div>
              <div className="grid grid-cols-5 gap-2 rounded-[28px] border border-white bg-white/60 p-3 shadow-[0_24px_70px_rgba(77,53,67,0.08)] sm:gap-3 sm:p-5 lg:grid-cols-10">
                {FINGER_CODES.map((finger) => {
                  const model = readModels.find((item) => item.finger === finger) ?? readModels[0];
                  return <button key={finger} type="button" aria-label={`聚焦 ${finger}`} onClick={() => focusFinger(finger)} className="min-w-0 rounded-2xl p-1.5 transition hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"><CustomerNailPreviewV7 nail={doc.nails[finger]} readModel={model} selected={finger === selectedFinger} /></button>;
                })}
              </div>
              <div className="mx-auto flex max-w-2xl items-start gap-2 rounded-xl border border-info/20 bg-info-soft px-3 py-2 text-[10px] leading-4 text-info"><Info size={13} className="mt-0.5 shrink-0" /><p>2D 预览用于方案沟通，不等于最终 3D、可制造性证明或设备生产输出。缺失能力会保留设计数据并明确标注。</p></div>
            </div>
          ) : (
            <div className="mx-auto grid min-h-full max-w-5xl items-center gap-5 lg:grid-cols-[minmax(280px,0.9fr)_minmax(300px,1.1fr)]">
              <CustomerNailPreviewV7 nail={selectedNail} readModel={selectedModel} selected size="focus" />
              <div className="rounded-[24px] border border-white bg-white/75 p-4 shadow-[0_18px_55px_rgba(77,53,67,0.08)] sm:p-5" aria-live="polite" aria-atomic="true">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-primary">{selectedFinger} · Read-only detail</p>
                <h1 className="mt-1 text-xl font-semibold text-gray-900">顾客沟通视图</h1>
                <dl className="mt-4 grid grid-cols-2 gap-2 text-[11px]"><div className="rounded-xl border border-gray-200 bg-white px-3 py-2"><dt className="text-gray-400">背景</dt><dd className="mt-1 font-semibold text-gray-800">{selectedModel.backgroundMode}</dd></div><div className="rounded-xl border border-gray-200 bg-white px-3 py-2"><dt className="text-gray-400">封层比较</dt><dd className="mt-1 font-semibold text-gray-800">{FINISH_LABEL[selectedModel.finishType]}</dd></div><div className="rounded-xl border border-gray-200 bg-white px-3 py-2"><dt className="text-gray-400">平面元素</dt><dd className="mt-1 font-semibold text-gray-800">{selectedModel.flatElementCount}</dd></div><div className="rounded-xl border border-gray-200 bg-white px-3 py-2"><dt className="text-gray-400">预览等级</dt><dd className="mt-1 font-semibold text-gray-800">{selectedModel.fidelity}</dd></div></dl>
                {selectedModel.warnings.length > 0 && <ul className="mt-3 space-y-1 rounded-xl border border-warning/20 bg-warning-soft px-3 py-2 text-[10px] leading-4 text-warning">{selectedModel.warnings.map((warning) => <li key={warning}>· {warning}</li>)}</ul>}
              </div>
            </div>
          )}
        </main>

        {compactPreview && scenarioPanelOpen && <button type="button" className="fixed inset-0 z-30 bg-gray-950/25 backdrop-blur-[1px]" aria-label="关闭临时方案" onClick={closeScenarioPanel} />}
        <aside
          ref={scenarioPanelRef}
          role={compactPreview && scenarioPanelOpen ? 'dialog' : undefined}
          aria-modal={compactPreview && scenarioPanelOpen ? true : undefined}
          onKeyDown={trapScenarioFocus}
          className={cx('fixed inset-x-0 bottom-0 z-40 max-h-[70dvh] shrink-0 overflow-y-auto rounded-t-2xl border-t border-gray-200 bg-white p-3 shadow-modal lg:static lg:z-auto lg:max-h-none lg:w-[320px] lg:rounded-none lg:border-l lg:border-t-0 lg:p-4 lg:shadow-none', !scenarioPanelOpen && 'hidden')}
          aria-label="临时方案比较"
        >
          <div className="flex items-start justify-between gap-2"><div><p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-violet-600">Temporary scenario</p><h2 className="mt-1 text-sm font-semibold text-gray-900">临时方案比较</h2><p className="mt-1 text-[10px] leading-4 text-gray-500">只存在当前内存，不写入 EditorDoc。</p></div><div className="flex gap-1"><button type="button" onClick={() => setScenario(createCustomerPreviewScenarioV7())} disabled={scenarioCount === 0} className="min-h-11 min-w-11 rounded-xl border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-35" aria-label="重置全部临时方案"><RotateCcw size={14} className="mx-auto" /></button><button type="button" onClick={closeScenarioPanel} className="min-h-11 min-w-11 rounded-xl border border-gray-200 text-gray-500 hover:bg-gray-50" aria-label="关闭方案比较"><X size={15} className="mx-auto" /></button></div></div>

          <div className="mt-4"><div className="flex items-center justify-between"><p className="text-xs font-semibold text-gray-800">{selectedFinger} 背景试色</p><button type="button" className="min-h-11 px-2 text-[10px] text-primary disabled:text-gray-300" disabled={!scenario.backgroundColors[selectedFinger]} onClick={() => setScenario((current) => setCustomerPreviewBackgroundV7(current, selectedFinger, null))}>恢复设计色</button></div><div className="mt-2 grid grid-cols-4 gap-2">{COLOR_SCENARIOS.map((choice) => <button key={choice.id} type="button" aria-label={`临时试色 ${choice.name}`} aria-pressed={scenario.backgroundColors[selectedFinger]?.r === choice.color.r && scenario.backgroundColors[selectedFinger]?.g === choice.color.g && scenario.backgroundColors[selectedFinger]?.b === choice.color.b} onClick={() => setScenario((current) => setCustomerPreviewBackgroundV7(current, selectedFinger, choice.color))} className="group min-h-14 rounded-xl border border-gray-200 p-1.5 text-center hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"><span className="mx-auto block h-7 w-7 rounded-full border border-black/10" style={{ background: `rgb(${choice.color.r} ${choice.color.g} ${choice.color.b})` }} /><span className="mt-1 block truncate text-[8px] text-gray-500">{choice.name}</span></button>)}</div></div>

          <div className="mt-5"><div className="flex items-center justify-between"><p className="text-xs font-semibold text-gray-800">封层效果比较</p>{scenario.finishType && <span className="text-[9px] font-semibold text-violet-600">临时</span>}</div><div className="mt-2 grid grid-cols-3 gap-2">{(['gloss', 'matte', 'frosted'] as const).map((finishType) => <button key={finishType} type="button" aria-pressed={selectedModel.finishType === finishType} onClick={() => setScenario((current) => setCustomerPreviewFinishV7(current, finishType))} className={cx('min-h-11 rounded-xl border px-2 text-[10px] font-medium', selectedModel.finishType === finishType ? 'border-primary bg-primary-soft text-primary' : 'border-gray-200 text-gray-600 hover:bg-gray-50')}>{FINISH_LABEL[finishType]}</button>)}</div><p className="mt-2 rounded-xl border border-dashed border-gray-300 px-3 py-2 text-[9px] leading-4 text-gray-500"><Sparkles size={11} className="mr-1 inline" />当前为确定性 2D 近似；最终组合 3D 与“应用为设计封层”在 V7-14。</p></div>

          <div className="mt-5 border-t border-gray-200 pt-4"><p className="text-[10px] leading-4 text-gray-500">退出预览或点击重置即丢弃临时方案。V7-09 不创建 ConfirmationSnapshot，不覆盖设计 revision。</p></div>
        </aside>
      </div>
    </section>
  );
}
