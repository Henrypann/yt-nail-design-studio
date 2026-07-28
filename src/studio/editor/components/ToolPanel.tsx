/**
 * 左侧工具栏（模块 4 · PRD §13.4，MVP 收敛为 画笔 / 橡皮 / 导入 PNG 三工具）
 * 附：画笔参数（颜色/粗细/透明度）、橡皮粗细、甲型·长度切换（画布轮廓变换，图案按甲型自动适配）。
 */

import { useRef } from 'react';
import { Brush, Eraser, ImagePlus } from 'lucide-react';
import { cx, useToast } from '@/design-system';
import { LENGTHS, PALETTE, SHAPES, lengthName, shapeName } from '../lib/material';
import { genId } from '../lib/model';
import { useEditorStore, type EditorTool } from '../store';

const TOOLS: { key: EditorTool; label: string; icon: typeof Brush; hotkey: string }[] = [
  { key: 'brush', label: '画笔', icon: Brush, hotkey: 'B' },
  { key: 'eraser', label: '橡皮', icon: Eraser, hotkey: 'E' },
];

export function ToolPanel() {
  const tool = useEditorStore((s) => s.tool);
  const setTool = useEditorStore((s) => s.setTool);
  const brushColor = useEditorStore((s) => s.brushColor);
  const brushSize = useEditorStore((s) => s.brushSize);
  const brushOpacity = useEditorStore((s) => s.brushOpacity);
  const eraserSize = useEditorStore((s) => s.eraserSize);
  const setBrush = useEditorStore((s) => s.setBrush);
  const setEraserSize = useEditorStore((s) => s.setEraserSize);
  const doc = useEditorStore((s) => s.doc);
  const commit = useEditorStore((s) => s.commit);
  const editCurrentFingerData = useEditorStore((s) => s.editCurrentFingerData);
  const readOnly = useEditorStore((s) => s.readOnly);
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

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
            name: file.name,
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
    <div className="flex w-14 shrink-0 flex-col items-center gap-1 border-r border-gray-200 bg-white py-3">
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

      <div className="my-2 h-px w-8 bg-gray-200" />

      {/* 上下文参数区 */}
      {tool === 'brush' && !readOnly && (
        <div className="flex w-full flex-col items-center gap-2 px-1">
          <div className="grid grid-cols-2 gap-1">
            {PALETTE.map((c) => (
              <button
                key={c.id}
                title={c.name}
                onClick={() => setBrush({ color: c.hex })}
                className={cx(
                  'h-5 w-5 rounded-full border transition-transform duration-fast hover:scale-110',
                  brushColor === c.hex ? 'ring-2 ring-primary ring-offset-1' : 'border-gray-300',
                )}
                style={{ backgroundColor: c.hex }}
              />
            ))}
          </div>
          <input
            type="color"
            value={brushColor}
            onChange={(e) => setBrush({ color: e.target.value })}
            className="h-6 w-10 cursor-pointer"
            title="自定义颜色"
          />
          <label className="w-full text-center text-[10px] text-gray-400">
            粗细 {brushSize}
            <input
              type="range"
              min={2}
              max={20}
              value={brushSize}
              onChange={(e) => setBrush({ size: Number(e.target.value) })}
              className="w-full accent-[#C2497A]"
            />
          </label>
          <label className="w-full text-center text-[10px] text-gray-400">
            透明 {Math.round(brushOpacity * 100)}%
            <input
              type="range"
              min={10}
              max={100}
              value={Math.round(brushOpacity * 100)}
              onChange={(e) => setBrush({ opacity: Number(e.target.value) / 100 })}
              className="w-full accent-[#C2497A]"
            />
          </label>
        </div>
      )}
      {tool === 'eraser' && !readOnly && (
        <label className="w-full px-1 text-center text-[10px] text-gray-400">
          橡皮 {eraserSize}
          <input
            type="range"
            min={6}
            max={40}
            value={eraserSize}
            onChange={(e) => setEraserSize(Number(e.target.value))}
            className="w-full accent-[#C2497A]"
          />
        </label>
      )}

      <div className="my-2 h-px w-8 bg-gray-200" />

      {/* 甲型 / 长度（PRD §15.2：Editor 内可调，画布轮廓变换 + 图案自动适配） */}
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
            className="w-full rounded-button border border-gray-300 px-1 py-1 text-[10px] disabled:opacity-40"
            title={`甲型：${shapeName(doc.shape)}`}
          >
            {SHAPES.map((s) => (
              <option key={s} value={s}>
                {shapeName(s)}
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
            className="w-full rounded-button border border-gray-300 px-1 py-1 text-[10px] disabled:opacity-40"
            title="长度"
          >
            {LENGTHS.map((l) => (
              <option key={l} value={l}>
                {lengthName(l)}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}
