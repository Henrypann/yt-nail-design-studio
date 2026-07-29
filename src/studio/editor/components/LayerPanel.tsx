/**
 * 右侧图层面板（模块 4 · PRD §14 三层制造语义）
 * 底色：只能选色（UV 喷绘 — 底色通道）；图案：可画/导入；附件：预制组件 + heightMm
 * （0.05–0.30mm，唯一立体高度通路，禁透明度控制）；封层：选质感。
 */

import { useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Copy,
  Eye,
  EyeOff,
  Lock,
  LockOpen,
  Plus,
  Trash2,
} from 'lucide-react';
import { Button, cx } from '@/design-system';
import { DECORATIONS, FINISHES, PALETTE } from '../lib/material';
import {
  HEIGHT_MAX_MM,
  HEIGHT_MIN_MM,
  createLayerMeta,
  genId,
  resolveFingerData,
  type AttachmentElement,
  type FrenchEdgeElement,
  type PatternElement,
  type Transform,
} from '../lib/model';
import { FRENCH_VARIANT_LABELS } from '../lib/french-edge';
import { useEditorStore } from '../store';

function patternElLabel(el: PatternElement): string {
  switch (el.kind) {
    case 'template_pattern':
      return `模板 · ${el.name}`;
    case 'brush':
      return `手绘笔画（${el.points.length} 点）`;
    case 'image':
      return `导入 · ${el.name}`;
    case 'gradient':
      return `渐变 · ${el.name}`;
    case 'eraser':
      return '橡皮擦除';
    case 'french_edge':
      return `法式 · ${FRENCH_VARIANT_LABELS[el.variant]}`;
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

function FrenchEdgeSliders(props: {
  value: FrenchEdgeElement;
  onPatch: (patch: Partial<FrenchEdgeElement>) => void;
}) {
  const { value, onPatch } = props;
  const [draft, setDraft] = useState<Partial<FrenchEdgeElement> | null>(null);
  const shown = { ...value, ...draft };
  const classicControls = shown.classicControls ?? {
    leftWingOffset: shown.tipOffset,
    centerOffset: Math.max(2, shown.tipOffset - shown.smileDepth),
    rightWingOffset: shown.tipOffset,
  };
  const commitDraft = () => {
    if (draft) onPatch(draft);
    setDraft(null);
  };
  const row = (
    label: string,
    key: 'strokeWidth' | 'tipOffset' | 'smileDepth' | 'lineGap',
    min: number,
    max: number,
    step: number,
  ) => (
    <label className="flex items-center gap-2 text-[11px] text-gray-500">
      <span className="w-12 shrink-0">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={shown[key] ?? 8}
        onChange={(e) =>
          setDraft((current) => ({
            ...(current ?? {}),
            [key]: Number(e.target.value),
          }))
        }
        onPointerUp={commitDraft}
        onBlur={commitDraft}
        className="flex-1 accent-[#C2497A]"
      />
      <span className="w-8 text-right tnum">{shown[key] ?? 8}</span>
    </label>
  );
  const classicRow = (
    label: string,
    key: 'leftWingOffset' | 'centerOffset' | 'rightWingOffset',
  ) => (
    <label className="flex items-center gap-2 text-[11px] text-gray-500">
      <span className="w-12 shrink-0">{label}</span>
      <input
        type="range"
        min={4}
        max={100}
        step={1}
        value={classicControls[key]}
        onChange={(e) => {
          const raw = Number(e.target.value);
          const next = { ...classicControls, [key]: raw };
          if (key === 'centerOffset') {
            next.centerOffset = Math.min(
              raw,
              Math.min(next.leftWingOffset, next.rightWingOffset) - 2,
            );
          } else if (next.centerOffset >= raw - 2) {
            next.centerOffset = Math.max(2, raw - 2);
          }
          setDraft((current) => ({
            ...(current ?? {}),
            classicControls: next,
          }));
        }}
        onPointerUp={commitDraft}
        onBlur={commitDraft}
        className="flex-1 accent-[#C2497A]"
      />
      <span className="w-8 text-right tnum">{classicControls[key]}</span>
    </label>
  );
  return (
    <div className="mt-1 flex flex-col gap-1 rounded-button bg-gray-50 p-2">
      <label className="flex items-center justify-between text-[11px] text-gray-500">
        <span>甲尖颜色</span>
        <input
          type="color"
          value={shown.fillColor}
          onChange={(e) => onPatch({ fillColor: e.target.value })}
          className="h-6 w-10 cursor-pointer"
        />
      </label>
      <label className="flex cursor-pointer items-center justify-between text-[11px] text-gray-500">
        <span>{value.variant === 'double' ? '双线边线' : '金属细边'}</span>
        <input
          type="checkbox"
          checked={(shown.outlineEnabled ?? false) || value.variant === 'double'}
          disabled={value.variant === 'double'}
          onChange={(e) => onPatch({ outlineEnabled: e.target.checked })}
          className="accent-[#C2497A]"
        />
      </label>
      {((shown.outlineEnabled ?? false) || value.variant === 'double') && (
        <>
          <label className="flex items-center justify-between text-[11px] text-gray-500">
            <span>边线颜色</span>
            <input
              type="color"
              value={shown.strokeColor}
              onChange={(e) => onPatch({ strokeColor: e.target.value })}
              className="h-6 w-10 cursor-pointer"
            />
          </label>
          {row('细边宽度', 'strokeWidth', 2, 10, 1)}
        </>
      )}
      {value.variant === 'arc' ? (
        <>
          {classicRow('左翼点', 'leftWingOffset')}
          {classicRow('中心点', 'centerOffset')}
          {classicRow('右翼点', 'rightWingOffset')}
          <p className="text-[10px] text-gray-400">
            也可直接拖拽画布上的三个控制点
          </p>
        </>
      ) : (
        <>
          {row('侧翼延伸', 'tipOffset', 15, 100, 1)}
          {row('微笑线深', 'smileDepth', 4, 50, 1)}
        </>
      )}
      {value.variant === 'double' && row('线间距', 'lineGap', 4, 24, 1)}
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
      if (el && !el.locked && 'transform' in el) el.transform = t;
    });
  };

  const updateFrenchEdge = (id: string, patch: Partial<FrenchEdgeElement>) => {
    editCurrentFingerData((d) => {
      const el = d.pattern.find((e) => e.id === id);
      if (el?.kind === 'french_edge' && !el.locked) Object.assign(el, patch);
    });
  };

  const patchElementMeta = (
    layer: 'pattern' | 'attachment',
    id: string,
    patch: Partial<{ name: string; visible: boolean; locked: boolean }>,
  ) => {
    editCurrentFingerData((d) => {
      const list = layer === 'pattern' ? d.pattern : d.attachments;
      const element = list.find((item) => item.id === id);
      if (element) Object.assign(element, patch);
    });
  };

  const moveElement = (layer: 'pattern' | 'attachment', id: string, delta: -1 | 1) => {
    editCurrentFingerData((d) => {
      if (layer === 'pattern') {
        const index = d.pattern.findIndex((item) => item.id === id);
        if (index < 0 || d.pattern[index]?.kind === 'eraser' || d.pattern[index]?.locked) return;
        const next = index + delta;
        if (next < 0 || next >= d.pattern.length || d.pattern[next]?.kind === 'eraser') return;
        [d.pattern[index], d.pattern[next]] = [d.pattern[next], d.pattern[index]];
        return;
      }
      const index = d.attachments.findIndex((item) => item.id === id);
      if (index < 0 || d.attachments[index]?.locked) return;
      const next = index + delta;
      if (next < 0 || next >= d.attachments.length) return;
      [d.attachments[index], d.attachments[next]] = [d.attachments[next], d.attachments[index]];
    });
  };

  const duplicateElement = (layer: 'pattern' | 'attachment', id: string) => {
    editCurrentFingerData((d) => {
      if (layer === 'pattern') {
        const index = d.pattern.findIndex((item) => item.id === id);
        if (index < 0 || d.pattern[index]?.kind === 'eraser' || d.pattern[index]?.locked) return;
        const copy = structuredClone(d.pattern[index]);
        copy.id = genId('el_pattern');
        copy.name = `${copy.name} · 副本`;
        d.pattern.splice(index + 1, 0, copy);
        setSelection({ layer, id: copy.id });
        return;
      }
      const index = d.attachments.findIndex((item) => item.id === id);
      if (index < 0 || d.attachments[index]?.locked) return;
      const copy = structuredClone(d.attachments[index]);
      copy.id = genId('el_att');
      copy.name = `${copy.name} · 副本`;
      d.attachments.splice(index + 1, 0, copy);
      setSelection({ layer, id: copy.id });
    });
  };

  return (
    <div className="flex flex-col gap-3" data-testid="layer-panel">
      {/* ① 底色层 */}
      <section className="rounded-panel border border-gray-200 bg-white p-3">
        <header className="mb-2 flex items-center justify-between">
          <h3 className="flex items-center gap-1.5 text-xs font-semibold text-gray-800">
            <span className="text-[10px] font-normal text-gray-400">①</span>
            底色
            <Lock size={11} className="text-gray-400" />
          </h3>
          <span className="text-[10px] text-gray-400">只能选色 · 不可手绘</span>
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

      {/* ② 图案层 */}
      <section className="rounded-panel border border-gray-200 bg-white p-3">
        <header className="mb-2 flex items-center justify-between">
          <h3 className="text-xs font-semibold text-gray-800">
            <span className="mr-1 text-[10px] font-normal text-gray-400">②</span>
            图案
          </h3>
          <span className="text-[10px] text-gray-400">模板 + 手绘 + 导入 · 可擦</span>
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
                      !el.visible && 'opacity-45',
                    )}
                  >
                    <button
                      className="flex-1 truncate text-left"
                      onClick={() =>
                        setSelection(selected ? null : { layer: 'pattern', id: el.id })
                      }
                    >
                      {el.name || patternElLabel(el)}
                    </button>
                    {!readOnly && (
                      <span className="ml-1 flex items-center gap-0.5">
                        <button
                          title={el.visible ? '隐藏' : '显示'}
                          onClick={() => patchElementMeta('pattern', el.id, { visible: !el.visible })}
                          className="text-gray-400 hover:text-gray-700"
                        >
                          {el.visible ? <Eye size={11} /> : <EyeOff size={11} />}
                        </button>
                        <button
                          title={el.locked ? '解锁' : '锁定'}
                          onClick={() => patchElementMeta('pattern', el.id, { locked: !el.locked })}
                          className="text-gray-400 hover:text-gray-700"
                        >
                          {el.locked ? <Lock size={11} /> : <LockOpen size={11} />}
                        </button>
                        {el.kind !== 'eraser' && (
                          <>
                            <button title={el.locked ? '请先解锁' : '上移'} disabled={el.locked} onClick={() => moveElement('pattern', el.id, -1)} className="text-gray-400 hover:text-gray-700 disabled:opacity-30">
                              <ArrowUp size={11} />
                            </button>
                            <button title={el.locked ? '请先解锁' : '下移'} disabled={el.locked} onClick={() => moveElement('pattern', el.id, 1)} className="text-gray-400 hover:text-gray-700 disabled:opacity-30">
                              <ArrowDown size={11} />
                            </button>
                            <button title={el.locked ? '请先解锁' : '复制'} disabled={el.locked} onClick={() => duplicateElement('pattern', el.id)} className="text-gray-400 hover:text-gray-700 disabled:opacity-30">
                              <Copy size={11} />
                            </button>
                          </>
                        )}
                        <button
                          title={el.locked ? '请先解锁' : '删除元素'}
                          disabled={el.locked}
                          onClick={() =>
                            editCurrentFingerData((d) => {
                              d.pattern = d.pattern.filter((e) => e.id !== el.id);
                            })
                          }
                          className="text-gray-400 hover:text-error disabled:cursor-not-allowed disabled:opacity-30"
                        >
                          <Trash2 size={11} />
                        </button>
                      </span>
                    )}
                  </div>
                  {selected && !readOnly && el.kind !== 'eraser' && (
                    <input
                      value={el.name}
                      aria-label="图层名称"
                      onChange={(event) => patchElementMeta('pattern', el.id, { name: event.target.value })}
                      className="mt-1 h-7 w-full rounded-button border border-gray-200 bg-white px-2 text-[11px] text-gray-700"
                    />
                  )}
                  {selected && (el.kind === 'template_pattern' || el.kind === 'image') && !readOnly && !el.locked && (
                    <TransformSliders
                      value={el.transform}
                      onCommit={(t) => updateElementTransform('pattern', el.id, t)}
                    />
                  )}
                  {selected && el.kind === 'french_edge' && !readOnly && !el.locked && (
                    <FrenchEdgeSliders
                      value={el}
                      onPatch={(patch) => updateFrenchEdge(el.id, patch)}
                    />
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* ③ 附件层 */}
      <section className="rounded-panel border border-gray-200 bg-white p-3">
        <header className="mb-2 flex items-center justify-between">
          <h3 className="text-xs font-semibold text-gray-800">
            <span className="mr-1 text-[10px] font-normal text-gray-400">③</span>
            附件
          </h3>
          <span className="text-[10px] text-gray-400">预制组件 · 高度 0.05–0.30mm</span>
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
                      !el.visible && 'opacity-45',
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
                      <span className="ml-1 flex items-center gap-0.5">
                        <button title={el.visible ? '隐藏' : '显示'} onClick={() => patchElementMeta('attachment', el.id, { visible: !el.visible })} className="text-gray-400 hover:text-gray-700">
                          {el.visible ? <Eye size={11} /> : <EyeOff size={11} />}
                        </button>
                        <button title={el.locked ? '解锁' : '锁定'} onClick={() => patchElementMeta('attachment', el.id, { locked: !el.locked })} className="text-gray-400 hover:text-gray-700">
                          {el.locked ? <Lock size={11} /> : <LockOpen size={11} />}
                        </button>
                        <button title={el.locked ? '请先解锁' : '上移'} disabled={el.locked} onClick={() => moveElement('attachment', el.id, -1)} className="text-gray-400 hover:text-gray-700 disabled:opacity-30">
                          <ArrowUp size={11} />
                        </button>
                        <button title={el.locked ? '请先解锁' : '下移'} disabled={el.locked} onClick={() => moveElement('attachment', el.id, 1)} className="text-gray-400 hover:text-gray-700 disabled:opacity-30">
                          <ArrowDown size={11} />
                        </button>
                        <button title={el.locked ? '请先解锁' : '复制'} disabled={el.locked} onClick={() => duplicateElement('attachment', el.id)} className="text-gray-400 hover:text-gray-700 disabled:opacity-30">
                          <Copy size={11} />
                        </button>
                        <button
                          title={el.locked ? '请先解锁' : '删除附件'}
                          disabled={el.locked}
                          onClick={() =>
                            editCurrentFingerData((d) => {
                              d.attachments = d.attachments.filter((e) => e.id !== el.id);
                            })
                          }
                          className="text-gray-400 hover:text-error disabled:cursor-not-allowed disabled:opacity-30"
                        >
                          <Trash2 size={11} />
                        </button>
                      </span>
                    )}
                  </div>
                  {selected && !readOnly && (
                    <input
                      value={el.name}
                      aria-label="附件名称"
                      onChange={(event) => patchElementMeta('attachment', el.id, { name: event.target.value })}
                      className="mt-1 h-7 w-full rounded-button border border-gray-200 bg-white px-2 text-[11px] text-gray-700"
                    />
                  )}
                  {selected && !readOnly && !el.locked && (
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
                      editCurrentFingerData((d) => {
                        const el: AttachmentElement = {
                          id: genId('el_att'),
                          kind: 'attachment',
                          ...createLayerMeta(dec.name, d.attachments.length),
                          decorationId: dec.id,
                          transform: { ...dec.defaults },
                          heightMm: Math.min(HEIGHT_MAX_MM, Math.max(HEIGHT_MIN_MM, dec.defaults.heightMm)),
                        };
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
      <section className="rounded-panel border border-dashed border-gray-200 bg-gray-50/50 p-3">
        <header className="mb-2 flex items-center justify-between">
          <h3 className="flex items-center gap-1.5 text-xs font-semibold text-gray-800">
            封层
            <Lock size={11} className="text-gray-400" />
          </h3>
          <span className="text-[10px] text-gray-400"> gloss / matte / pearl</span>
        </header>
        <div className="flex gap-1.5">
          {FINISHES.filter((f) => f.id !== 'pearl').map((f) => (
            <button
              key={f.id}
              disabled={readOnly}
              onClick={() =>
                commit((d) => {
                  d.appearance.topFinish = f.id === 'matte' ? 'matte' : 'gloss';
                  if (f.id === 'matte') d.appearance.opticalEffect = 'none';
                })
              }
              className={cx(
                'rounded-button border px-2.5 py-1 text-[11px] transition-colors duration-fast disabled:opacity-40',
                doc.appearance.topFinish === f.id
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
