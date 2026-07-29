/**
 * 顾客展示模式（全屏只读，适合直接把屏幕转向顾客）
 *
 * 布局：设计大图（整体搭配 · 整幅 plate 完整显示，继承 Wizard 指尖观察方向）
 *   + 当前重点单指（点击搭配条切换）
 *   + 十指搭配条
 *   + 甲型 / 长度 / 色号 / 质感 / 模板信息
 * 已确认设计显示冻结标识；不出现任何编辑控件；Esc 或右上角退出。
 * 渲染与编辑态三视图共享 useNailDesignAssets + FingerNailContent，所见即所得。
 */

import { useEffect, useMemo, useState } from 'react';
import { Check, X } from 'lucide-react';
import { Badge, Spinner } from '@/design-system';
import { FINGER_CODES, type DesignStatus, type FingerCode, type FingerOverrides, type Finish, type NailLength, type NailShape } from '@/lib/types';
import { loadFinishes, loadShapeParams } from '@/studio/preview/material-library';
import type { DecorationAsset } from '@/studio/preview/nail-assets';
import { useNailDesignAssets } from '@/studio/preview/use-nail-design-assets';
import { TenFingerPreview, FINGER_LABEL } from '@/studio/preview/TenFingerPreview';
import { NailCellView } from '@/studio/preview/TiledNailsPreview';
import { FingerNailContent } from '@/studio/render';

export interface PresentationModeProps {
  open: boolean;
  onClose: () => void;
  shape: NailShape;
  length: NailLength;
  templateId: string | null;
  templateName: string | null;
  baseColor: string;
  finish: Finish;
  fingerOverrides?: FingerOverrides;
  status: DesignStatus;
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
  fingerOverrides,
  status,
  initialFinger,
  tipOrientation = 'up',
}: PresentationModeProps) {
  const assets = useNailDesignAssets(shape, length, templateId);
  const { status: loadStatus, silhouette, patternMarkup, patternVisible, patternFadeMs, failedFingers, patternK } = assets;

  const [focusFinger, setFocusFinger] = useState<FingerCode>(initialFinger ?? 'R4');
  const [shapeLabel, setShapeLabel] = useState('');
  const [finishLabel, setFinishLabel] = useState('');

  /* 打开时同步当前选中指 */
  useEffect(() => {
    if (open) setFocusFinger(initialFinger ?? 'R4');
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
  const confirmed = status !== 'draft';

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col animate-fade-in"
      style={{ backgroundColor: '#F7F3EE' }}
      data-debug-id="studio.presentation"
      role="dialog"
      aria-label="顾客展示模式"
    >
      {/* 顶栏：仅标题与退出，无编辑控件 */}
      <header className="flex shrink-0 items-center gap-3 px-8 py-4">
        <p className="text-sm font-medium text-gray-900">{templateName ?? '未命名设计'}</p>
        {confirmed && (
          <Badge variant="blue">
            <Check size={11} className="mr-0.5" />
            顾客已确认 · 设计已冻结
          </Badge>
        )}
        <div className="ml-auto flex items-center gap-3">
          <span className="text-[11px] text-gray-400">Esc 退出</span>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-gray-300 bg-white text-gray-500 transition-colors duration-fast hover:text-gray-900"
            title="退出展示模式（Esc）"
          >
            <X size={15} />
          </button>
        </div>
      </header>

      {/* 主区：设计大图 + 重点单指 */}
      <main className="flex min-h-0 flex-1 items-stretch gap-8 px-8 pb-4">
        {/* 整体搭配大图（整幅 plate 完整显示，继承 Wizard 指尖方向） */}
        <div className="flex min-w-0 flex-1 items-center justify-center">
          {loadStatus === 'ready' ? (
            <TenFingerPreview
              shape={shape}
              length={length}
              templateId={templateId}
              baseColor={baseColor}
              finish={finish}
              fingerOverrides={fingerOverrides}
              registerExport={false}
              tipOrientation={tipOrientation}
              fitContainer
              selectedFinger={focusFinger}
              onFingerClick={setFocusFinger}
              readOnly={false}
              className="h-full max-h-full w-full border-none bg-transparent"
            />
          ) : (
            <Spinner size={32} className="text-primary" />
          )}
        </div>

        {/* 当前重点单指 */}
        <div className="flex w-[300px] shrink-0 flex-col items-center justify-center gap-4 rounded-card border border-gray-200 bg-white p-6">
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
      <footer className="flex shrink-0 items-center justify-between gap-6 border-t border-gray-200/70 px-8 py-4">
        <div className="flex items-center gap-4 text-xs text-gray-600">
          <span>{shapeLabel}</span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-3.5 w-3.5 rounded-full border border-gray-300" style={{ backgroundColor: baseColor }} />
            {baseColor}
          </span>
          <span>质感：{finishLabel}</span>
        </div>

        {/* 十指搭配条（点击切换重点指，只读展示） */}
        {loadStatus === 'ready' && silhouette && (
          <div className="flex gap-1.5">
            {FINGER_CODES.map((fc) => {
              const ov = fingerOverrides?.[fc];
              return (
                <NailCellView
                  key={fc}
                  finger={fc}
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
    </div>
  );
}
