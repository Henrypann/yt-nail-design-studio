/**
 * 顾客展示模式（全屏只读，适合直接把屏幕转向顾客）
 *
 * 布局：设计大图（整体搭配 · 整幅 plate 完整显示，继承 Wizard 指尖观察方向）
 *   + 当前重点单指（点击搭配条切换）
 *   + 十指搭配条
 *   + 甲型 / 长度 / 色号 / 质感 / 模板信息
 * 不出现任何编辑或确认控件；Esc 或右上角退出。
 * 渲染与编辑态三视图共享 useNailDesignAssets + FingerNailContent，所见即所得。
 */

import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { Badge, Spinner } from '@/design-system';
import { FINGER_CODES, type FingerCode, type FingerOverrides, type Finish, type NailLength, type NailShape } from '@/lib/types';
import { loadFinishes, loadShapeParams } from '@/studio/preview/material-library';
import type { DecorationAsset } from '@/studio/preview/nail-assets';
import { useNailDesignAssets } from '@/studio/preview/use-nail-design-assets';
import { TenFingerPreview, FINGER_LABEL } from '@/studio/preview/TenFingerPreview';
import { NailCellView } from '@/studio/preview/TiledNailsPreview';
import { FingerNailContent } from '@/studio/render';
import type { RecipeInstanceV1 } from '@/studio/editor/lib/recipe-model';

export interface PresentationModeProps {
  open: boolean;
  onClose: () => void;
  shape: NailShape;
  length: NailLength;
  templateId: string | null;
  templateName: string | null;
  baseColor: string;
  finish: Finish;
  recipe?: RecipeInstanceV1;
  fingerOverrides?: FingerOverrides;
  /** 初始重点指（进入时同步 Wizard 当前选中指，缺省 R4 主视觉指） */
  initialFinger?: FingerCode | null;
  /** 指尖观察方向（继承 Wizard 当前选择，展示模式内不再提供第二个开关） */
  tipOrientation?: 'up' | 'down';
}

export function PresentationMode({
  open,
  onClose,
  shape,
  length,
  templateId,
  templateName,
  baseColor,
  finish,
  recipe,
  fingerOverrides,
  initialFinger,
  tipOrientation = 'up',
}: PresentationModeProps) {
  const assets = useNailDesignAssets(shape, length, templateId);
  const { status: loadStatus, silhouette, patternMarkup, patternVisible, patternFadeMs, failedFingers, patternK } = assets;

  const [focusFinger, setFocusFinger] = useState<FingerCode>(initialFinger ?? 'R4');
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const [shapeLabel, setShapeLabel] = useState('');
  const [finishLabel, setFinishLabel] = useState('');

  /* 打开时同步当前选中指并把焦点移入只读展示层。 */
  useEffect(() => {
    if (!open) return;
    const underlay = document.querySelector<HTMLElement>('[data-testid="wizard-canvas-first"]');
    underlay?.setAttribute('inert', '');
    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setFocusFinger(initialFinger ?? 'R4');
    queueMicrotask(() => closeButtonRef.current?.focus());
    return () => {
      underlay?.removeAttribute('inert');
      previousFocusRef.current?.focus();
    };
  }, [open, initialFinger]);

  /* Esc 退出 */
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const trapFocus = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Tab') return;
    const focusable = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])') ?? []);
    if (!focusable.length) return;
    const first = focusable[0]; const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  };

  /* 甲型/长度/质感中文名 */
  useEffect(() => {
    if (!open) return;
    loadShapeParams()
      .then((p) => setShapeLabel(`${p.shapes[shape]?.name_en ?? shape} · ${p.lengths[length].name}（${p.lengths[length].lengthMm}mm）`))
      .catch(() => undefined);
    loadFinishes()
      .then((fs) => setFinishLabel(fs.find((f) => f.id === finish)?.name ?? finish))
      .catch(() => undefined);
  }, [open, shape, length, finish]);

  const decorationById = useMemo(() => {
    const map = new Map<string, DecorationAsset>();
    assets.decorations.forEach((d) => map.set(d.id, d));
    return map;
  }, [assets.decorations]);

  if (!open) return null;

  const override = fingerOverrides?.[focusFinger];
  const focusColor = override?.baseColor ?? baseColor;
  const focusDecoration = override?.decorationId ? decorationById.get(override.decorationId) : undefined;

  return createPortal(
    <div
      ref={dialogRef}
      className="fixed inset-0 z-50 flex flex-col bg-canvas animate-fade-in"
      data-debug-id="studio.presentation"
      role="dialog"
      aria-modal="true"
      aria-label="顾客展示模式"
      onKeyDown={trapFocus}
    >
      {/* 顶栏：标题与退出，无编辑或确认控件。 */}
      <header className="flex shrink-0 flex-col items-stretch gap-3 px-4 py-4 sm:px-8 lg:flex-row lg:items-center">
        <p className="text-sm font-medium text-gray-900">{templateName ?? '未命名设计'}</p>
        {recipe?.recipeRef.id === 'mercury-dew' && <Badge variant="warning">模拟效果 · 尚未完成生产验证</Badge>}
        <div className="ml-auto flex min-w-0 flex-wrap items-center gap-3 overflow-x-auto">
          <span className="text-nano text-gray-400">Esc 退出</span>
          <button
            ref={closeButtonRef}
            onClick={onClose}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-gray-300 bg-white text-gray-500 transition-colors duration-fast hover:text-gray-900"
            title="退出展示模式（Esc）"
          >
            <X size={15} />
          </button>
        </div>
      </header>

      {/* 主区：设计大图 + 重点单指 */}
      <main className="flex min-h-0 flex-1 flex-col items-stretch gap-4 overflow-y-auto px-4 pb-4 sm:px-8 lg:flex-row lg:gap-8">
        {/* 整体搭配大图（整幅 plate 完整显示，继承 Wizard 指尖方向） */}
        <div className="flex min-w-0 flex-1 items-center justify-center overflow-x-auto">
          {loadStatus === 'ready' ? (
            <TenFingerPreview
              shape={shape}
              length={length}
              templateId={templateId}
              baseColor={baseColor}
              finish={finish}
              recipe={recipe}
              fingerOverrides={fingerOverrides}
              registerExport={false}
              tipOrientation={tipOrientation}
              fitContainer
              selectedFinger={focusFinger}
              onFingerClick={setFocusFinger}
              readOnly
              className="h-full max-h-full w-full border-none bg-transparent"
            />
          ) : (
            <Spinner size={32} className="text-primary" />
          )}
        </div>

        {/* 当前重点单指 */}
        <div className="flex w-full shrink-0 flex-col items-center justify-center gap-4 rounded-card border border-gray-200 bg-white p-4 sm:p-6 lg:w-[300px]">
          {loadStatus === 'ready' && silhouette ? (
            <>
              <svg viewBox={silhouette.viewBox} className="h-auto w-[240px] select-none">
                <defs>
                  <clipPath id="present-focus-clip" clipPathUnits="userSpaceOnUse">
                    <path d={silhouette.d} />
                  </clipPath>
                </defs>
                <FingerNailContent
                  finger={focusFinger}
                  silhouetteD={silhouette.d}
                  clipId="present-focus-clip"
                  baseColor={focusColor}
                  finish={finish}
                  recipe={recipe}
                  shape={shape}
                  length={length}
                  failed={failedFingers.has(focusFinger)}
                  selected={false}
                  patternMarkup={patternMarkup}
                  patternK={patternK}
                  patternVisible={patternVisible}
                  patternFadeMs={patternFadeMs}
                  decoration={focusDecoration}
                  strokeScale={240 / Number(silhouette.viewBox.split(/\s+/)[2] ?? 120)}
                  readOnly
                  fingerLabel={FINGER_LABEL[focusFinger]}
                />
              </svg>
              <div className="flex flex-col items-center gap-1 text-center">
                <p className="text-sm font-medium text-gray-900">{FINGER_LABEL[focusFinger]}</p>
                {focusDecoration && <p className="text-xs text-gray-500">附件：{focusDecoration.name}</p>}
              </div>
            </>
          ) : (
            <Spinner size={24} className="text-primary" />
          )}
        </div>
      </main>

      {/* 底栏：信息 + 十指搭配条 */}
      <footer className="flex min-w-0 shrink-0 flex-col items-stretch gap-3 border-t border-gray-200/70 px-4 py-4 sm:px-8 lg:flex-row lg:items-center lg:justify-between lg:gap-6">
        <div className="flex min-w-0 flex-wrap items-center gap-3 text-xs text-gray-600 sm:gap-4">
          <span>{shapeLabel}</span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-3.5 w-3.5 rounded-full border border-gray-300" style={{ backgroundColor: baseColor }} />
            {baseColor}
          </span>
          <span>质感：{finishLabel}</span>
        </div>

        {/* 十指搭配条（点击切换重点指，只读展示） */}
        {loadStatus === 'ready' && silhouette && (
          <div className="flex min-w-0 gap-1.5 overflow-x-auto pb-1">
            {FINGER_CODES.map((fc) => {
              const ov = fingerOverrides?.[fc];
              return (
                <NailCellView
                  key={fc}
                  finger={fc}
                  shape={shape}
                  length={length}
                  silhouetteD={silhouette.d}
                  viewBox={silhouette.viewBox}
                  baseColor={ov?.baseColor ?? baseColor}
                  finish={finish}
                  patternMarkup={patternMarkup}
                  patternK={patternK}
                  patternVisible={patternVisible}
                  patternFadeMs={patternFadeMs}
                  decoration={ov?.decorationId ? decorationById.get(ov.decorationId) : undefined}
                  failed={failedFingers.has(fc)}
                  selected={fc === focusFinger}
                  hasOverride={!failedFingers.has(fc) && !!(ov?.baseColor || ov?.decorationId)}
                  strokeScale={48 / Number(silhouette.viewBox.split(/\s+/)[2] ?? 120)}
                  onClick={setFocusFinger}
                  size="sm"
                />
              );
            })}
          </div>
        )}
      </footer>
    </div>,
    document.body,
  );
}
