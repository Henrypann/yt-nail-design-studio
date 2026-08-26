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
import { useLocale } from '@/lib/i18n';
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

function patternElLabel(el: PatternElement, t: ReturnType<typeof useLocale>['t']): string {
  switch (el.kind) {
    case 'template_pattern':
      return t('editorV7.layerPanel.templateLabel', { name: el.name });
    case 'brush':
      return t('editorV7.layerPanel.brushLabel', { count: el.points.length });
    case 'image':
      return t('editorV7.layerPanel.importLabel', { name: el.name });
    case 'gradient':
      return t('editorV7.layerPanel.gradientLabel', { name: el.name });
    case 'eraser':
      return t('editorV7.layerPanel.eraserLabel');
    case 'french_edge':
      return t('editorV7.layerPanel.frenchLabel', { variant: FRENCH_VARIANT_LABELS[el.variant] });
  }
}

function TransformSliders(props: {
  value: Transform;
  onCommit: (t: Transform) => void;
  t: ReturnType<typeof useLocale>['t'];
}) {
  const { value, onCommit, t } = props;
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
    <label className="flex items-center gap-2 text-nano text-gray-500">
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
        className="flex-1 accent-primary"
      />
      <span className="w-10 text-right tnum">{fmt(shown[key])}</span>
    </label>
  );
  return (
    <div className="mt-1 flex flex-col gap-1 rounded-button bg-gray-50 p-2">
      {row(t('editorV7.layerPanel.positionX'), 'x', -55, 55, 1, (v) => v.toFixed(0))}
      {row(t('editorV7.layerPanel.positionY'), 'y', -200, 20, 1, (v) => v.toFixed(0))}
      {row(t('editorV7.layerPanel.scale'), 'scale', 0.2, 3, 0.05, (v) => `${Math.round(v * 100)}%`)}
      {row(t('editorV7.layerPanel.rotation'), 'rotation', -180, 180, 1, (v) => `${v.toFixed(0)}°`)}
      {draft && <p className="text-nano text-gray-400">{t('editorV7.layerPanel.releaseToApply')}</p>}
    </div>
  );
}

function FrenchEdgeSliders(props: {
  value: FrenchEdgeElement;
  onPatch: (patch: Partial<FrenchEdgeElement>) => void;
  t: ReturnType<typeof useLocale>['t'];
}) {
  const { value, onPatch, t } = props;
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
    <label className="flex items-center gap-2 text-nano text-gray-500">
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
        className="flex-1 accent-primary"
      />
      <span className="w-8 text-right tnum">{shown[key] ?? 8}</span>
    </label>
  );
  const classicRow = (
    label: string,
    key: 'leftWingOffset' | 'centerOffset' | 'rightWingOffset',
  ) => (
    <label className="flex items-center gap-2 text-nano text-gray-500">
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
        className="flex-1 accent-primary"
      />
      <span className="w-8 text-right tnum">{classicControls[key]}</span>
    </label>
  );
  return (
    <div className="mt-1 flex flex-col gap-1 rounded-button bg-gray-50 p-2">
      <label className="flex items-center justify-between text-nano text-gray-500">
        <span>{t('editorV7.layerPanel.tipColor')}</span>
        <input
          type="color"
          value={shown.fillColor}
          onChange={(e) => onPatch({ fillColor: e.target.value })}
          className="h-6 w-10 cursor-pointer"
        />
      </label>
      <label className="flex cursor-pointer items-center justify-between text-nano text-gray-500">
        <span>{value.variant === 'double' ? t('editorV7.layerPanel.doubleLine') : t('editorV7.layerPanel.metallicLine')}</span>
        <input
          type="checkbox"
          checked={(shown.outlineEnabled ?? false) || value.variant === 'double'}
          disabled={value.variant === 'double'}
          onChange={(e) => onPatch({ outlineEnabled: e.target.checked })}
          className="accent-primary"
        />
      </label>
      {((shown.outlineEnabled ?? false) || value.variant === 'double') && (
        <>
          <label className="flex items-center justify-between text-nano text-gray-500">
            <span>{t('editorV7.layerPanel.outlineColor')}</span>
            <input
              type="color"
              value={shown.strokeColor}
              onChange={(e) => onPatch({ strokeColor: e.target.value })}
              className="h-6 w-10 cursor-pointer"
            />
          </label>
          {row(t('editorV7.layerPanel.strokeWidth'), 'strokeWidth', 2, 10, 1)}
        </>
      )}
      {value.variant === 'arc' ? (
        <>
          {classicRow(t('editorV7.layerPanel.leftWing'), 'leftWingOffset')}
          {classicRow(t('editorV7.layerPanel.center'), 'centerOffset')}
          {classicRow(t('editorV7.layerPanel.rightWing'), 'rightWingOffset')}
          <p className="text-nano text-gray-400">{t('editorV7.layerPanel.dragControlPoints')}</p>
        </>
      ) : (
        <>
          {row(t('editorV7.layerPanel.sideExtension'), 'tipOffset', 15, 100, 1)}
          {row(t('editorV7.layerPanel.smileDepth'), 'smileDepth', 4, 50, 1)}
        </>
      )}
      {value.variant === 'double' && row(t('editorV7.layerPanel.lineGap'), 'lineGap', 4, 24, 1)}
      {draft && <p className="text-nano text-gray-400">{t('editorV7.layerPanel.releaseToApply')}</p>}
    </div>
  );
}

export function LayerPanel() {
  const { t } = useLocale();
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
    <div className="flex flex-col gap-3" data-testid="layer-panel" data-debug-id="studio.editor.layers">
      {doc.recipe?.recipeRef.id === 'mercury-dew' && (
        <section className="rounded-panel border border-[#D7B36A]/40 bg-[#FFFCF5] p-3" data-testid="recipe-layer-group">
          <header className="mb-2 flex items-center justify-between"><h3 className="text-xs font-semibold text-gray-800">{t('editorV7.layerPanel.recipeTitle')}</h3><span className="text-nano text-gray-400">{t('editorV7.layerPanel.virtualLayers')}</span></header>
          <div className="flex flex-col gap-1 text-nano text-gray-600"><span>{t('editorV7.layerPanel.recipeJellyBase')}</span><span>{t('editorV7.layerPanel.recipeCatEye')}</span><span>{t('editorV7.layerPanel.recipeChromeRelief')}</span><span>{t('editorV7.layerPanel.recipeDroplets')}</span></div>
          <p className="mt-2 text-nano leading-relaxed text-gray-400">{t('editorV7.layerPanel.recipeDescription')}</p>
        </section>
      )}
      {/* ① 底色层 */}
      <section className="rounded-panel border border-gray-200 bg-white p-3">
        <header className="mb-2 flex items-center justify-between">
          <h3 className="flex items-center gap-1.5 text-xs font-semibold text-gray-800">
            <span className="text-nano font-normal text-gray-400">{t('editorV7.layerPanel.baseOrdinal')}</span>
            {t('editorV7.layerPanel.baseTitle')}
            <Lock size={11} className="text-gray-400" />
          </h3>
          <span className="text-nano text-gray-400">{t('editorV7.layerPanel.baseHint')}</span>
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
            title={t('editorV7.layerPanel.customColor')}
          />
        </div>
      </section>

      {/* ② 图案层 */}
      <section className="rounded-panel border border-gray-200 bg-white p-3">
        <header className="mb-2 flex items-center justify-between">
          <h3 className="text-xs font-semibold text-gray-800">
            <span className="mr-1 text-nano font-normal text-gray-400">{t('editorV7.layerPanel.patternOrdinal')}</span>
            {t('editorV7.layerPanel.patternTitle')}
          </h3>
          <span className="text-nano text-gray-400">{t('editorV7.layerPanel.patternHint')}</span>
        </header>
        {data.pattern.length === 0 ? (
          <p className="text-nano text-gray-400">{t('editorV7.layerPanel.patternEmpty')}</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {data.pattern.map((el) => {
              const selected = selection?.layer === 'pattern' && selection.id === el.id;
              return (
                <li key={el.id}>
                  <div
                    className={cx(
                      'flex items-center justify-between rounded-button px-2 py-1 text-nano',
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
                      {el.name || patternElLabel(el, t)}
                    </button>
                    {!readOnly && (
                      <span className="ml-1 flex items-center gap-0.5">
                        <button
                          title={el.visible ? t('editorV7.layerPanel.hide') : t('editorV7.layerPanel.show')}
                          onClick={() => patchElementMeta('pattern', el.id, { visible: !el.visible })}
                          className="text-gray-400 hover:text-gray-700"
                        >
                          {el.visible ? <Eye size={11} /> : <EyeOff size={11} />}
                        </button>
                        <button
                          title={el.locked ? t('editorV7.layerPanel.unlock') : t('editorV7.layerPanel.lock')}
                          onClick={() => patchElementMeta('pattern', el.id, { locked: !el.locked })}
                          className="text-gray-400 hover:text-gray-700"
                        >
                          {el.locked ? <Lock size={11} /> : <LockOpen size={11} />}
                        </button>
                        {el.kind !== 'eraser' && (
                          <>
                            <button title={el.locked ? t('editorV7.layerPanel.unlockFirst') : t('editorV7.layerPanel.moveUp')} disabled={el.locked} onClick={() => moveElement('pattern', el.id, -1)} className="text-gray-400 hover:text-gray-700 disabled:opacity-30">
                              <ArrowUp size={11} />
                            </button>
                            <button title={el.locked ? t('editorV7.layerPanel.unlockFirst') : t('editorV7.layerPanel.moveDown')} disabled={el.locked} onClick={() => moveElement('pattern', el.id, 1)} className="text-gray-400 hover:text-gray-700 disabled:opacity-30">
                              <ArrowDown size={11} />
                            </button>
                            <button title={el.locked ? t('editorV7.layerPanel.unlockFirst') : t('editorV7.layerPanel.copy')} disabled={el.locked} onClick={() => duplicateElement('pattern', el.id)} className="text-gray-400 hover:text-gray-700 disabled:opacity-30">
                              <Copy size={11} />
                            </button>
                          </>
                        )}
                        <button
                          title={el.locked ? t('editorV7.layerPanel.unlockFirst') : t('editorV7.layerPanel.deleteElement')}
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
                      aria-label={t('editorV7.layerPanel.layerName')}
                      onChange={(event) => patchElementMeta('pattern', el.id, { name: event.target.value })}
                      className="mt-1 h-7 w-full rounded-button border border-gray-200 bg-white px-2 text-nano text-gray-700"
                    />
                  )}
                  {selected && (el.kind === 'template_pattern' || el.kind === 'image') && !readOnly && !el.locked && (
                    <TransformSliders
                      value={el.transform}
                      onCommit={(transform) => updateElementTransform('pattern', el.id, transform)}
                      t={t}
                    />
                  )}
                  {selected && el.kind === 'french_edge' && !readOnly && !el.locked && (
                    <FrenchEdgeSliders
                      value={el}
                      onPatch={(patch) => updateFrenchEdge(el.id, patch)}
                      t={t}
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
            <span className="mr-1 text-nano font-normal text-gray-400">{t('editorV7.layerPanel.attachmentOrdinal')}</span>
            {t('editorV7.layerPanel.attachmentTitle')}
          </h3>
          <span className="text-nano text-gray-400">{t('editorV7.layerPanel.attachmentHint')}</span>
        </header>
        {data.attachments.length === 0 ? (
          <p className="mb-1 text-nano text-gray-400">{t('editorV7.layerPanel.attachmentEmpty')}</p>
        ) : (
          <ul className="mb-1 flex flex-col gap-1">
            {data.attachments.map((el) => {
              const selected = selection?.layer === 'attachment' && selection.id === el.id;
              return (
                <li key={el.id}>
                  <div
                    className={cx(
                      'flex items-center justify-between rounded-button px-2 py-1 text-nano',
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
                      {t('editorV7.layerPanel.attachmentSummary', { name: el.name, height: el.heightMm.toFixed(2) })}
                    </button>
                    {!readOnly && (
                      <span className="ml-1 flex items-center gap-0.5">
                        <button title={el.visible ? t('editorV7.layerPanel.hide') : t('editorV7.layerPanel.show')} onClick={() => patchElementMeta('attachment', el.id, { visible: !el.visible })} className="text-gray-400 hover:text-gray-700">
                          {el.visible ? <Eye size={11} /> : <EyeOff size={11} />}
                        </button>
                        <button title={el.locked ? t('editorV7.layerPanel.unlock') : t('editorV7.layerPanel.lock')} onClick={() => patchElementMeta('attachment', el.id, { locked: !el.locked })} className="text-gray-400 hover:text-gray-700">
                          {el.locked ? <Lock size={11} /> : <LockOpen size={11} />}
                        </button>
                        <button title={el.locked ? t('editorV7.layerPanel.unlockFirst') : t('editorV7.layerPanel.moveUp')} disabled={el.locked} onClick={() => moveElement('attachment', el.id, -1)} className="text-gray-400 hover:text-gray-700 disabled:opacity-30">
                          <ArrowUp size={11} />
                        </button>
                        <button title={el.locked ? t('editorV7.layerPanel.unlockFirst') : t('editorV7.layerPanel.moveDown')} disabled={el.locked} onClick={() => moveElement('attachment', el.id, 1)} className="text-gray-400 hover:text-gray-700 disabled:opacity-30">
                          <ArrowDown size={11} />
                        </button>
                        <button title={el.locked ? t('editorV7.layerPanel.unlockFirst') : t('editorV7.layerPanel.copy')} disabled={el.locked} onClick={() => duplicateElement('attachment', el.id)} className="text-gray-400 hover:text-gray-700 disabled:opacity-30">
                          <Copy size={11} />
                        </button>
                        <button
                          title={el.locked ? t('editorV7.layerPanel.unlockFirst') : t('editorV7.layerPanel.deleteAttachment')}
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
                      aria-label={t('editorV7.layerPanel.attachmentName')}
                      onChange={(event) => patchElementMeta('attachment', el.id, { name: event.target.value })}
                      className="mt-1 h-7 w-full rounded-button border border-gray-200 bg-white px-2 text-nano text-gray-700"
                    />
                  )}
                  {selected && !readOnly && !el.locked && (
                    <div className="mt-1 flex flex-col gap-1 rounded-button bg-gray-50 p-2">
                      <label className="flex items-center gap-2 text-nano text-gray-500">
                        <span className="w-10 shrink-0">{t('editorV7.layerPanel.height')}</span>
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
                          className="flex-1 accent-primary"
                        />
                        <span className="w-12 text-right tnum">{t('editorV7.layerPanel.heightValue', { height: el.heightMm.toFixed(2) })}</span>
                      </label>
                      <TransformSliders
                        value={el.transform}
                        onCommit={(transform) => updateElementTransform('attachment', el.id, transform)}
                        t={t}
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
              {t('editorV7.layerPanel.addAttachment')}
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
                    className="rounded-button px-2 py-1.5 text-nano text-gray-700 transition-colors duration-fast hover:bg-primary-soft hover:text-primary"
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
            {t('editorV7.layerPanel.finishTitle')}
            <Lock size={11} className="text-gray-400" />
          </h3>
          <span className="text-nano text-gray-400">{t('editorV7.layerPanel.finishHint')}</span>
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
                'rounded-button border px-2.5 py-1 text-nano transition-colors duration-fast disabled:opacity-40',
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
