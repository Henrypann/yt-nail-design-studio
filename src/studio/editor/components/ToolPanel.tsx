/**
 * 左侧工具栏（模块 4 · PRD §13.4）
 * 画笔 / 橡皮 / 导入 + 品牌色板（120色）+ 线宽三档 + 甲型长度。
 */

import { useRef, useState } from 'react';
import { Brush, Eraser, ImagePlus, Palette, Spline } from 'lucide-react';
import { cx, useToast } from '@/design-system';
import { useLocale } from '@/lib/i18n';
import { LENGTHS, loadRecentColors, PALETTE, SHAPES, lengthName, pushRecentColor, shapeName } from '../lib/material';
import { createLayerMeta, genId } from '../lib/model';
import { useEditorStore, type BrushPreset, type EditorTool } from '../store';
import { BrandPalettePopover } from './BrandPalettePopover';
import { FrenchEdgePopover } from './FrenchEdgePopover';

const TOOLS: { key: EditorTool; label: string; icon: typeof Brush; hotkey: string }[] = [
  { key: 'brush', label: '画笔', icon: Brush, hotkey: 'B' },
  { key: 'eraser', label: '橡皮', icon: Eraser, hotkey: 'E' },
];

const PRESETS: { key: BrushPreset; label: string }[] = [
  { key: 'fine', label: '细' },
  { key: 'standard', label: '标' },
  { key: 'thick', label: '粗' },
];

export function ToolPanel() {
  const { locale, text } = useLocale();
  const tool = useEditorStore((s) => s.tool);
  const setTool = useEditorStore((s) => s.setTool);
  const brushColor = useEditorStore((s) => s.brushColor);
  const brushSize = useEditorStore((s) => s.brushSize);
  const brushPreset = useEditorStore((s) => s.brushPreset);
  const brushOpacity = useEditorStore((s) => s.brushOpacity);
  const eraserSize = useEditorStore((s) => s.eraserSize);
  const setBrush = useEditorStore((s) => s.setBrush);
  const setBrushPreset = useEditorStore((s) => s.setBrushPreset);
  const setEraserSize = useEditorStore((s) => s.setEraserSize);
  const doc = useEditorStore((s) => s.doc);
  const commit = useEditorStore((s) => s.commit);
  const editCurrentFingerData = useEditorStore((s) => s.editCurrentFingerData);
  const readOnly = useEditorStore((s) => s.readOnly);
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [frenchOpen, setFrenchOpen] = useState(false);
  const recentColors = loadRecentColors();

  const onImportFile = (file: File) => {
    if (!file.type.includes('png') && !file.type.includes('jpeg') && !file.type.includes('svg')) {
      toast.warning('仅支持导入 PNG / JPG / SVG 图片');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result);
      const img = new Image();
      img.onload = () => {
        editCurrentFingerData((d) => {
          d.pattern.push({
            id: genId('el_img'),
            kind: 'image',
            ...createLayerMeta(file.name, d.pattern.length),
            dataUrl,
            width: img.naturalWidth,
            height: img.naturalHeight,
            transform: { x: 0, y: -90, scale: 1, rotation: 0 },
          });
        });
        toast.success('图片已导入到图案层');
      };
      img.onerror = () => toast.error('图片解析失败，请换一张重试');
      img.src = dataUrl;
    };
    reader.onerror = () => toast.error('图片读取失败，请重试');
    reader.readAsDataURL(file);
  };

  return (
    <div className="relative flex w-14 shrink-0 flex-col items-center gap-1 border-r border-gray-200 bg-white py-3">
      {TOOLS.map((t) => (
        <button
          key={t.key}
          disabled={readOnly}
          onClick={() => setTool(t.key)}
          title={`${t.label}（${t.hotkey}）`}
          className={cx(
            'flex h-10 w-10 items-center justify-center rounded-button transition-colors duration-fast',
            tool === t.key ? 'bg-primary-soft text-primary' : 'text-gray-500 hover:bg-gray-100',
            readOnly && 'cursor-not-allowed opacity-40',
          )}
        >
          <t.icon size={18} />
        </button>
      ))}
      <button
        disabled={readOnly}
        onClick={() => fileRef.current?.click()}
        title="导入 PNG / JPG / SVG 到图案层"
        className={cx(
          'flex h-10 w-10 items-center justify-center rounded-button text-gray-500 transition-colors duration-fast hover:bg-gray-100',
          readOnly && 'cursor-not-allowed opacity-40',
        )}
      >
        <ImagePlus size={18} />
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/svg+xml"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onImportFile(f);
          e.target.value = '';
        }}
      />

      <div className="relative">
        <button
          disabled={readOnly}
          onClick={() => {
            setFrenchOpen((v) => !v);
            setPaletteOpen(false);
          }}
          title="法式边一键模板"
          className={cx(
            'flex h-10 w-10 items-center justify-center rounded-button transition-colors duration-fast',
            frenchOpen ? 'bg-primary-soft text-primary' : 'text-gray-500 hover:bg-gray-100',
            readOnly && 'cursor-not-allowed opacity-40',
          )}
        >
          <Spline size={18} />
        </button>
        {frenchOpen && !readOnly && (
          <FrenchEdgePopover
            onClose={() => setFrenchOpen(false)}
          />
        )}
      </div>

      <div className="my-2 h-px w-8 bg-gray-200" />

      {tool === 'brush' && !readOnly && (
        <div className="flex w-full flex-col items-center gap-2 px-1">
          {/* 线宽三档 */}
          <div className="flex w-full gap-0.5">
            {PRESETS.map((p) => (
              <button
                key={p.key}
                type="button"
                title={`${p.label}线`}
                onClick={() => setBrushPreset(p.key)}
                className={cx(
                  'flex-1 rounded-button py-0.5 text-nano font-medium',
                  brushPreset === p.key
                    ? 'bg-primary-soft text-primary'
                    : 'bg-gray-100 text-gray-500 hover:bg-gray-200',
                )}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* 快捷 8 色 + 最近 */}
          <div className="grid grid-cols-2 gap-1">
            {(recentColors.length > 0
              ? recentColors.slice(0, 4)
              : PALETTE.slice(0, 4).map((c) => c.hex)
            ).map((hex, i) => (
              <button
                key={`recent-${i}-${hex}`}
                type="button"
                title={hex}
                onClick={() => {
                  setBrush({ color: hex });
                  pushRecentColor(hex);
                }}
                className={cx(
                  'h-5 w-5 rounded-full border transition-transform duration-fast hover:scale-110',
                  brushColor.toLowerCase() === hex.toLowerCase()
                    ? 'ring-2 ring-primary ring-offset-1'
                    : 'border-gray-300',
                )}
                style={{ backgroundColor: hex }}
              />
            ))}
          </div>

          <div className="relative w-full">
            <button
              type="button"
              onClick={() => {
                setPaletteOpen((v) => !v);
                setFrenchOpen(false);
              }}
              title="打开 120 色品牌色板"
              className={cx(
                'flex w-full items-center justify-center gap-1 rounded-button border py-1 text-nano',
                paletteOpen
                  ? 'border-primary bg-primary-soft text-primary'
                  : 'border-gray-200 text-gray-600 hover:bg-gray-50',
              )}
            >
              <Palette size={11} />
              120色
            </button>
            {paletteOpen && <BrandPalettePopover onClose={() => setPaletteOpen(false)} />}
          </div>

          <input
            type="color"
            value={brushColor}
            onChange={(e) => {
              const hex = e.target.value;
              setBrush({ color: hex });
              pushRecentColor(hex);
            }}
            className="h-6 w-10 cursor-pointer"
            title="自定义颜色"
          />
          <label className="w-full text-center text-nano text-gray-400">
            粗细 {brushSize}
            <input
              type="range"
              min={2}
              max={30}
              value={brushSize}
              onChange={(e) => setBrush({ size: Number(e.target.value) })}
              className="w-full accent-primary"
            />
          </label>
          <label className="w-full text-center text-nano text-gray-400">
            透明 {Math.round(brushOpacity * 100)}%
            <input
              type="range"
              min={10}
              max={100}
              value={Math.round(brushOpacity * 100)}
              onChange={(e) => setBrush({ opacity: Number(e.target.value) / 100 })}
              className="w-full accent-primary"
            />
          </label>
        </div>
      )}
      {tool === 'eraser' && !readOnly && (
        <label className="w-full px-1 text-center text-nano text-gray-400">
          橡皮 {eraserSize}
          <input
            type="range"
            min={6}
            max={40}
            value={eraserSize}
            onChange={(e) => setEraserSize(Number(e.target.value))}
            className="w-full accent-primary"
          />
        </label>
      )}

      <div className="my-2 h-px w-8 bg-gray-200" />

      {doc && (
        <div className="flex w-full flex-col items-center gap-1.5 px-1">
          <select
            value={doc.shape}
            disabled={readOnly}
            onChange={(e) =>
              commit((d) => {
                d.shape = e.target.value as typeof d.shape;
              })
            }
            className="w-full rounded-button border border-gray-300 px-1 py-1 text-nano disabled:opacity-40"
            title={`${text('甲型', 'Shape')}：${shapeName(doc.shape, locale)}`}
          >
            {SHAPES.map((s) => (
              <option key={s} value={s}>
                {shapeName(s, locale)}
              </option>
            ))}
          </select>
          <select
            value={doc.length}
            disabled={readOnly}
            onChange={(e) =>
              commit((d) => {
                d.length = e.target.value as typeof d.length;
              })
            }
            className="w-full rounded-button border border-gray-300 px-1 py-1 text-nano disabled:opacity-40"
            title={text('长度', 'Length')}
          >
            {LENGTHS.map((l) => (
              <option key={l} value={l}>
                {lengthName(l, locale)}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}
