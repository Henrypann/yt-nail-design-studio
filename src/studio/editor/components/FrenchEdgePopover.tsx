/**
 * 法式边一键模板浮层（经典弧 / V形 / 双线 + 甲尖填色）
 */

import { useState } from 'react';
import { X } from 'lucide-react';
import { Button, cx, useToast } from '@/design-system';
import { FRENCH_VARIANT_LABELS } from '../lib/french-edge';
import type { FrenchEdgeVariant } from '../lib/model';
import { useEditorStore } from '../store';

const VARIANTS: FrenchEdgeVariant[] = ['arc', 'v', 'double'];

const PREVIEW_PATHS: Record<FrenchEdgeVariant, { fill: string; stroke: string }> = {
  arc: {
    fill: 'M 2 18 C 7 17 11 8 20 8 C 29 8 33 17 38 18 V 2 H 2 Z',
    stroke: 'M 2 18 C 7 17 11 8 20 8 C 29 8 33 17 38 18',
  },
  v: {
    fill: 'M 2 2 H 38 L 32 14 L 20 22 L 8 14 Z',
    stroke: 'M 8 14 L 20 22 L 32 14',
  },
  double: {
    fill: 'M 2 10 C 7 11 11 18 20 18 C 29 18 33 11 38 10 V 2 H 2 Z',
    stroke:
      'M 2 10 C 7 11 11 18 20 18 C 29 18 33 11 38 10 M 2 15 C 7 16 11 23 20 23 C 29 23 33 16 38 15',
  },
};

export function FrenchEdgePopover(props: { onClose: () => void }) {
  const { onClose } = props;
  const insertFrenchEdge = useEditorStore((s) => s.insertFrenchEdge);
  const toast = useToast();

  const [variant, setVariant] = useState<FrenchEdgeVariant>('arc');
  const [fillColor, setFillColor] = useState('#FFFFFF');
  const [outlineEnabled, setOutlineEnabled] = useState(false);
  const [strokeColor, setStrokeColor] = useState('#B8896B');
  const [strokeWidth, setStrokeWidth] = useState(4);

  const onAdd = () => {
    const result = insertFrenchEdge({
      variant,
      fillColor,
      outlineEnabled: outlineEnabled || variant === 'double',
      strokeColor,
      strokeWidth,
    });
    if (result === 'ok') {
      toast.success(`已添加法式 · ${FRENCH_VARIANT_LABELS[variant]}`);
      onClose();
      return;
    }
    if (result === 'no-silhouette') {
      toast.error('当前甲型轮廓不可用，无法生成法式边');
      return;
    }
    toast.warning('只读模式，无法编辑');
  };

  return (
    <div
      className="absolute left-[calc(100%+8px)] top-0 z-50 flex w-56 flex-col rounded-panel border border-gray-200 bg-white shadow-modal animate-fade-in"
      data-testid="french-edge-popover"
    >
      <header className="flex items-center justify-between border-b border-gray-100 px-2 py-1.5">
        <span className="text-nano font-semibold text-gray-800">法式边模板</span>
        <button
          type="button"
          onClick={onClose}
          className="rounded-button p-0.5 text-gray-400 hover:bg-gray-100"
          aria-label="关闭法式边"
        >
          <X size={14} />
        </button>
      </header>

      <div className="grid grid-cols-3 gap-1 p-2">
        {VARIANTS.map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => {
              setVariant(v);
              if (v === 'double') setOutlineEnabled(true);
            }}
            className={cx(
              'flex flex-col items-center gap-1 rounded-button border p-1.5 transition-colors duration-fast',
              variant === v
                ? 'border-primary bg-primary-soft text-primary'
                : 'border-gray-200 text-gray-600 hover:bg-gray-50',
            )}
          >
            <svg viewBox="0 0 40 24" className="h-6 w-10">
              <path d={PREVIEW_PATHS[v].fill} fill="currentColor" opacity={0.25} />
              <path
                d={PREVIEW_PATHS[v].stroke}
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
            <span className="text-nano">{FRENCH_VARIANT_LABELS[v]}</span>
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-2 border-t border-gray-100 px-2 py-2">
        <label className="flex items-center justify-between text-nano text-gray-500">
          <span>甲尖颜色</span>
          <input
            type="color"
            value={fillColor}
            onChange={(e) => setFillColor(e.target.value)}
            className="h-6 w-10 cursor-pointer"
          />
        </label>
        <label className="flex cursor-pointer items-center justify-between text-nano text-gray-500">
          <span>{variant === 'double' ? '双线边线（必选）' : '添加金属细边'}</span>
          <input
            type="checkbox"
            checked={outlineEnabled || variant === 'double'}
            disabled={variant === 'double'}
            onChange={(e) => setOutlineEnabled(e.target.checked)}
            className="accent-primary"
          />
        </label>
        {(outlineEnabled || variant === 'double') && (
          <>
            <label className="flex items-center justify-between text-nano text-gray-500">
              <span>边线颜色</span>
              <input
                type="color"
                value={strokeColor}
                onChange={(e) => setStrokeColor(e.target.value)}
                className="h-6 w-10 cursor-pointer"
              />
            </label>
            <label className="text-nano text-gray-400">
              细边宽度 {strokeWidth}
              <input
                type="range"
                min={2}
                max={10}
                value={strokeWidth}
                onChange={(e) => setStrokeWidth(Number(e.target.value))}
                className="w-full accent-primary"
              />
            </label>
          </>
        )}
        <p className="text-nano leading-4 text-gray-400">
          甲尖色块会自动贴合当前甲型外轮廓，添加后可微调微笑线深度。
        </p>
      </div>

      <div className="border-t border-gray-100 p-2">
        <Button size="sm" variant="primary" className="w-full" onClick={onAdd}>
          一键添加
        </Button>
      </div>
    </div>
  );
}
