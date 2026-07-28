/**
 * 右侧图层面板（模块 4 · PRD §14 三层制造语义）
 * 底色：只能选色（UV 喷绘 — 底色通道）；图案：可画/导入；附件：预制组件 + heightMm
 * （0.05–0.30mm，唯一立体高度通路，禁透明度控制）；封层：选质感。
 */

import { useState } from 'react';
import { Lock, Plus, Trash2 } from 'lucide-react';
import { Button, cx } from '@/design-system';
import { DECORATIONS, FINISHES, PALETTE } from '../lib/material';
import {
  HEIGHT_MAX_MM,
  HEIGHT_MIN_MM,
  genId,
  resolveFingerData,
  type AttachmentElement,
  type PatternElement,
  type Transform,
} from '../lib/model';
import { useEditorStore } from '../store';

function patternElLabel(el: PatternElement): string {
  switch (el.kind) {
    case 'template_pattern':
      return `模板 · ${el.name}`;
    case 'brush':
      return `手绘笔画（${el.points.length} 点）`;
    case 'image':
      return `导入 · ${el.name}`;
    case 'eraser':
      return '橡皮擦除';
  }
}

function TransformSliders(props: {
  value: Transform;
  onCommit: (t: Transform) => void;
}) {
  const { value, onCommit } = props;
  const [draft, setDraft] = useState<Transform | null>(null);
  const shown = draft ?? value;
  const row = (
    label: string,
    key: keyof Transform,
    min: number,
    max: number,
    step: number,
    fmt: (v: number) => string,
  ) => (
    <label className="flex items-center gap-2 text-[11px] text-gray-500">
      <span className="w-10 shrink-0">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={shown[key]}
        onChange={(e) => setDraft({ ...shown, [key]: Number(e.target.value) })}
        onPointerUp={() => {
          if (draft) onCommit(draft);
          setDraft(null);
        }}
        className="flex-1 accent-[#C2497A]"
      />
      <span className="w-10 text-right tnum">{fmt(shown[key])}</span>
    </label>
  );
  return (
    <div className="mt-1 flex flex-col gap-1 rounded-button bg-gray-50 p-2">
      {row('位置X', 'x', -55, 55, 1, (v) => v.toFixed(0))}
      {row('位置Y', 'y', -200, 20, 1, (v) => v.toFixed(0))}
      {row('缩放', 'scale', 0.2, 3, 0.05, (v) => `${Math.round(v * 100)}%`)}
      {row('旋转', 'rotation', -180, 180, 1, (v) => `${v.toFixed(0)}°`)}
      {draft && <p className="text-[10px] text-gray-400">松开鼠标应用</p>}
    </div>
  );
}

export function LayerPanel() {
  const doc = useEditorStore((s) => s.doc);
  const currentFinger = useEditorStore((s) => s.currentFinger);
  const readOnly = useEditorStore((s) => s.readOnly);
  const selection = useEditorStore((s) => s.selection);
  const setSelection = useEditorStore((s) => s.setSelection);
  const editCurrentFingerData = useEditorStore((s) => s.editCurrentFingerData);
  const commit = useEditorStore((s) => s.commit);
  const [pickerOpen, setPickerOpen] = useState(false);

  if (!doc) return null;
  const data = resolveFingerData(doc, currentFinger);

  const updateElementTransform = (layer: 'pattern' | 'attachment', id: string, t: Transform) => {
    editCurrentFingerData((d) => {
      const list = layer === 'pattern' ? d.pattern : d.attachments;
      const el = list.find((e) => e.id === id);
      if (el && 'transform' in el) el.transform = t;
    });
  };

  return (
    <div className="flex flex-col gap-3">
      {/* 底色层（锁定：只能选色/换质感，不能画） */}
      <section className="rounded-panel border border-gray-200 bg-white p-3">
        <header className="mb-2 flex items-center justify-between">
          <h3 className="flex items-center gap-1.5 text-xs font-semibold text-gray-800">
            底色
            <Lock size={11} className="text-gray-400" />
          </h3>
          <span className="text-[10px] text-gray-400">UV 喷绘 · 底色通道 · 只能选色</span>
        </header>
        <div className="flex flex-wrap items-center gap-1.5">
          {PALETTE.map((c) => (
            <button
              key={c.id}
              title={c.name}
              disabled={readOnly}
              onClick={() =>
                editCurrentFingerData((d) => {
                  d.baseColor = c.hex;
                })
              }
              className={cx(
                'h-6 w-6 rounded-full border transition-transform duration-fast hover:scale-110 disabled:opacity-40',
                data.baseColor === c.hex ? 'ring-2 ring-primary ring-offset-1' : 'border-gray-300',
              )}
              style={{ backgroundColor: c.hex }}
            />
          ))}
          <input
            type="color"
            value={data.baseColor}
            disabled={readOnly}
            onChange={(e) =>
              editCurrentFingerData((d) => {
                d.baseColor = e.target.value;
              })
            }
            className="h-6 w-8 cursor-pointer disabled:opacity-40"
            title="自定义底色"
          />
        </div>
      </section>

      {/* 图案层 */}
      <section className="rounded-panel border border-gray-200 bg-white p-3">
        <header className="mb-2 flex items-center justify-between">
          <h3 className="text-xs font-semibold text-gray-800">图案</h3>
          <span className="text-[10px] text-gray-400">UV 喷绘 · 图案通道 · 可手绘/导入</span>
        </header>
        {data.pattern.length === 0 ? (
          <p className="text-[11px] text-gray-400">空图层 — 用画笔绘制或导入图片</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {data.pattern.map((el) => {
              const selected = selection?.layer === 'pattern' && selection.id === el.id;
              return (
                <li key={el.id}>
                  <div
                    className={cx(
                      'flex items-center justify-between rounded-button px-2 py-1 text-[11px]',
                      selected ? 'bg-primary-soft text-primary' : 'text-gray-600 hover:bg-gray-50',
                    )}
                  >
                    <button
                      className="flex-1 truncate text-left"
                      onClick={() =>
                        setSelection(selected ? null : { layer: 'pattern', id: el.id })
                      }
                    >
                      {patternElLabel(el)}
                    </button>
                    {!readOnly && (
                      <button
                        title="删除元素"
                        onClick={() =>
                          editCurrentFingerData((d) => {
                            d.pattern = d.pattern.filter((e) => e.id !== el.id);
                          })
                        }
                        className="ml-1 text-gray-400 hover:text-error"
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                  {selected && (el.kind === 'template_pattern' || el.kind === 'image') && !readOnly && (
                    <TransformSliders
                      value={el.transform}
                      onCommit={(t) => updateElementTransform('pattern', el.id, t)}
                    />
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* 附件层（禁透明度控制；heightMm 唯一立体高度通路） */}
      <section className="rounded-panel border border-gray-200 bg-white p-3">
        <header className="mb-2 flex items-center justify-between">
          <h3 className="text-xs font-semibold text-gray-800">附件</h3>
          <span className="text-[10px] text-gray-400">Pipeline 路由 · 不提供透明度控制</span>
        </header>
        {data.attachments.length === 0 ? (
          <p className="mb-1 text-[11px] text-gray-400">空图层 — 拖入预制组件</p>
        ) : (
          <ul className="mb-1 flex flex-col gap-1">
            {data.attachments.map((el) => {
              const selected = selection?.layer === 'attachment' && selection.id === el.id;
              return (
                <li key={el.id}>
                  <div
                    className={cx(
                      'flex items-center justify-between rounded-button px-2 py-1 text-[11px]',
                      selected ? 'bg-primary-soft text-primary' : 'text-gray-600 hover:bg-gray-50',
                    )}
                  >
                    <button
                      className="flex-1 truncate text-left"
                      onClick={() =>
                        setSelection(selected ? null : { layer: 'attachment', id: el.id })
                      }
                    >
                      {el.name} · {el.heightMm.toFixed(2)}mm
                    </button>
                    {!readOnly && (
                      <button
                        title="删除附件"
                        onClick={() =>
                          editCurrentFingerData((d) => {
                            d.attachments = d.attachments.filter((e) => e.id !== el.id);
                          })
                        }
                        className="ml-1 text-gray-400 hover:text-error"
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                  {selected && !readOnly && (
                    <div className="mt-1 flex flex-col gap-1 rounded-button bg-gray-50 p-2">
                      <label className="flex items-center gap-2 text-[11px] text-gray-500">
                        <span className="w-10 shrink-0">高度</span>
                        <input
                          type="range"
                          min={HEIGHT_MIN_MM * 100}
                          max={HEIGHT_MAX_MM * 100}
                          step={1}
                          value={Math.round(el.heightMm * 100)}
                          onChange={(e) =>
                            editCurrentFingerData((d) => {
                              const t = d.attachments.find((a) => a.id === el.id);
                              if (t) t.heightMm = Number(e.target.value) / 100;
                            })
                          }
                          className="flex-1 accent-[#C2497A]"
                        />
                        <span className="w-12 text-right tnum">{el.heightMm.toFixed(2)}mm</span>
                      </label>
                      <TransformSliders
                        value={el.transform}
                        onCommit={(t) => updateElementTransform('attachment', el.id, t)}
                      />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        {!readOnly && (
          <div className="relative">
            <Button size="sm" variant="secondary" onClick={() => setPickerOpen((v) => !v)}>
              <Plus size={13} />
              添加附件
            </Button>
            {pickerOpen && (
              <div className="absolute left-0 top-9 z-20 grid w-44 grid-cols-2 gap-1 rounded-panel border border-gray-200 bg-white p-2 shadow-modal animate-fade-in">
                {DECORATIONS.map((dec) => (
                  <button
                    key={dec.id}
                    onClick={() => {
                      const el: AttachmentElement = {
                        id: genId('el_att'),
                        kind: 'attachment',
                        decorationId: dec.id,
                        name: dec.name,
                        transform: { ...dec.defaults },
                        heightMm: Math.min(HEIGHT_MAX_MM, Math.max(HEIGHT_MIN_MM, dec.defaults.heightMm)),
                      };
                      editCurrentFingerData((d) => {
                        d.attachments.push(el);
                      });
                      setPickerOpen(false);
                    }}
                    className="rounded-button px-2 py-1.5 text-[11px] text-gray-700 transition-colors duration-fast hover:bg-primary-soft hover:text-primary"
                  >
                    {dec.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </section>

      {/* 封层（选质感，不可画） */}
      <section className="rounded-panel border border-gray-200 bg-white p-3">
        <header className="mb-2 flex items-center justify-between">
          <h3 className="flex items-center gap-1.5 text-xs font-semibold text-gray-800">
            封层
            <Lock size={11} className="text-gray-400" />
          </h3>
          <span className="text-[10px] text-gray-400">封层工艺 · 选质感</span>
        </header>
        <div className="flex gap-1.5">
          {FINISHES.map((f) => (
            <button
              key={f.id}
              disabled={readOnly}
              onClick={() =>
                commit((d) => {
                  d.finish = f.id;
                })
              }
              className={cx(
                'rounded-button border px-2.5 py-1 text-[11px] transition-colors duration-fast disabled:opacity-40',
                doc.finish === f.id
                  ? 'border-primary bg-primary-soft text-primary'
                  : 'border-gray-200 text-gray-600 hover:bg-gray-50',
              )}
            >
              {f.name}
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
