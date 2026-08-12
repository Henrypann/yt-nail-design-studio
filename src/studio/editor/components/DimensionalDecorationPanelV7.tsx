import { useEffect, useState } from 'react';
import { Box, Info, Lock, Trash2, Unlock } from 'lucide-react';
import { cx, useToast } from '@/design-system';
import { generateEditorV7Id } from '../v7/id';
import type { DimensionalDecorationV7, Transform2DV7 } from '../v7/model';
import {
  DIMENSIONAL_DECORATION_LABELS_V7,
  DIMENSIONAL_FIDELITY_LABELS_V7,
  createDimensionalDecorationV7,
  dimensionalDecorationArchetypeV7,
  dimensionalDecorationFidelityV7,
  type DimensionalDecorationArchetypeV7,
} from '../v7/dimensional-decoration';
import { selectCurrentGeometryExactV7, selectCurrentStepV7, useEditorV7Store, type EditorV7ActionResult } from '../store-v7';

const ARCHETYPES: DimensionalDecorationArchetypeV7[] = ['relief', 'droplet', 'gel_stack', 'carving', 'accessory'];

function CommitRange({ label, value, min, max, step, unit = '', disabled, onCommit }: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
  disabled: boolean;
  onCommit(value: number): EditorV7ActionResult;
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  const commit = () => {
    const bounded = Math.min(max, Math.max(min, draft));
    if (bounded === value) return;
    const result = onCommit(bounded);
    if (!result.ok) setDraft(value);
  };
  return <label className="block space-y-1"><span className="flex justify-between gap-2 text-[10px] font-semibold text-gray-600"><span>{label}</span><span className="tabular-nums text-gray-800">{Number(draft.toFixed(2))}{unit}</span></span><input type="range" min={min} max={max} step={step} value={draft} disabled={disabled} aria-label={label} onChange={(event) => setDraft(Number(event.target.value))} onPointerUp={commit} onKeyUp={commit} onBlur={commit} className="h-11 w-full accent-primary disabled:opacity-45" /></label>;
}

export function DimensionalDecorationPanelV7() {
  const toast = useToast();
  const step = useEditorV7Store(selectCurrentStepV7);
  const currentFinger = useEditorV7Store((state) => state.currentFinger);
  const selectedElementId = useEditorV7Store((state) => state.selectedElementId);
  const readOnly = useEditorV7Store((state) => state.readOnly);
  const switching = useEditorV7Store((state) => state.switching);
  const geometryExact = useEditorV7Store(selectCurrentGeometryExactV7);
  const addElement = useEditorV7Store((state) => state.addElement);
  const removeElement = useEditorV7Store((state) => state.removeElement);
  const setElementFlag = useEditorV7Store((state) => state.setElementFlag);
  const replaceDecoration = useEditorV7Store((state) => state.replaceDimensionalDecoration);
  if (step?.kind !== 'dimensional_decoration') return null;
  const selected = step.decorations.find((item) => item.id === selectedElementId) ?? null;
  const canMutateStep = step.visible && !step.skipped && !readOnly && !switching && !step.locked && geometryExact;
  const canEditSelected = Boolean(canMutateStep && selected && !selected.locked);
  const report = (result: EditorV7ActionResult) => { if (!result.ok) toast.error(result.message); return result; };
  const addPreset = (archetype: DimensionalDecorationArchetypeV7) => {
    const decoration = createDimensionalDecorationV7(archetype, generateEditorV7Id('element'));
    if (!decoration) { toast.error('3D asset registry 当前不可用，未创建饰品。'); return; }
    report(addElement(currentFinger, step.id, decoration));
  };
  const replace = (next: DimensionalDecorationV7) => report(replaceDecoration(currentFinger, step.id, next.id, next));
  const setTransform = (patch: Partial<Transform2DV7>) => {
    if (!selected) return { ok: false, reason: 'not_found', message: 'decoration not selected' } as EditorV7ActionResult;
    const transform = { ...selected.transform, ...patch };
    return replace({ ...selected, transform, ...(selected.kind === 'attachment_3d' && patch.position ? { anchor: patch.position } : {}) });
  };
  const fidelity = selected ? dimensionalDecorationFidelityV7(selected) : null;
  const fidelityTone = fidelity === 'exact' ? 'border-success/25 bg-success-soft text-success' : fidelity === 'approximate' ? 'border-warning/25 bg-warning-soft text-warning' : 'border-gray-300 bg-gray-100 text-gray-600';

  return (
    <div className="mt-2 space-y-3 rounded-xl border border-primary/15 bg-primary-soft/30 p-3" data-testid="v7-dimensional-decoration-panel">
      <div><div className="flex items-center gap-2"><Box size={14} className="text-primary" /><p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-gray-600">立体装饰 · 2D/2.5D</p></div><p className="mt-1 text-[10px] leading-4 text-gray-500">高度与锚点写入 {currentFinger} canonical step；投影只由参数派生。</p></div>
      <div className="grid grid-cols-2 gap-1 rounded-xl bg-white p-1" aria-label="立体装饰预设">
        {ARCHETYPES.map((archetype) => <button key={archetype} type="button" disabled={!canMutateStep} onClick={() => addPreset(archetype)} className="min-h-11 rounded-lg px-2 text-[10px] font-medium text-gray-600 hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-45">+ {DIMENSIONAL_DECORATION_LABELS_V7[archetype]}</button>)}
      </div>
      {!selected && <p className="rounded-lg border border-dashed border-gray-300 bg-white px-3 py-4 text-center text-[10px] text-gray-500">添加或选择一个装饰后编辑高度、锚点和投影。</p>}
      {selected && <div className="space-y-3 rounded-xl border border-gray-200 bg-white p-3">
        <div className="flex items-center justify-between gap-2"><div><p className="text-xs font-semibold text-gray-800">{DIMENSIONAL_DECORATION_LABELS_V7[dimensionalDecorationArchetypeV7(selected)]}</p><p className="mt-0.5 max-w-[180px] truncate text-[9px] text-gray-400">{selected.kind === 'attachment_3d' ? selected.asset.assetId : selected.materialRef?.materialId}</p></div><div className="flex gap-1"><button type="button" aria-label={selected.locked ? '解锁装饰' : '锁定装饰'} disabled={!canMutateStep} onClick={() => report(setElementFlag(currentFinger, step.id, selected.id, 'locked', !selected.locked))} className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-gray-200">{selected.locked ? <Lock size={14} /> : <Unlock size={14} />}</button><button type="button" aria-label="删除装饰" disabled={!canEditSelected} onClick={() => report(removeElement(currentFinger, step.id, selected.id))} className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-gray-200 text-error disabled:opacity-35"><Trash2 size={14} /></button></div></div>
        <CommitRange label="高度" value={selected.heightMm} min={0.05} max={10} step={0.01} unit=" mm" disabled={!canEditSelected} onCommit={(heightMm) => replace({ ...selected, heightMm })} />
        <CommitRange label="锚点 X" value={selected.transform.position.u} min={0} max={1} step={0.01} disabled={!canEditSelected} onCommit={(u) => setTransform({ position: { ...selected.transform.position, u } })} />
        <CommitRange label="锚点 Y" value={selected.transform.position.v} min={0} max={1} step={0.01} disabled={!canEditSelected} onCommit={(v) => setTransform({ position: { ...selected.transform.position, v } })} />
        <CommitRange label="缩放" value={selected.transform.scaleX} min={0.25} max={2} step={0.01} disabled={!canEditSelected} onCommit={(scale) => setTransform({ scaleX: scale, scaleY: scale })} />
        <CommitRange label="旋转" value={selected.transform.rotationDeg} min={-180} max={180} step={1} unit="°" disabled={!canEditSelected} onCommit={(rotationDeg) => setTransform({ rotationDeg })} />
        {fidelity && <div className={cx('inline-flex rounded-full border px-2.5 py-1 text-[10px] font-semibold', fidelityTone)}>{DIMENSIONAL_FIDELITY_LABELS_V7[fidelity]}</div>}
      </div>}
      <p className="rounded-lg border border-info/20 bg-info-soft px-2.5 py-2 text-[10px] leading-4 text-info"><Info size={12} className="mr-1 inline" />2.5D 阴影与模拟 mesh 只用于编辑预览；不代表材料、装配或物理可制造性。</p>
    </div>
  );
}
