import { useEffect, useState } from 'react';
import { Info, Sparkles } from 'lucide-react';
import { cx, useToast } from '@/design-system';
import { selectCurrentStepV7, useEditorV7Store, type EditorV7ActionResult } from '../store-v7';
import type { RgbaColorV7, SurfaceEffectPayloadV7 } from '../v7/model';
import { parseHexColorV7, rgbaToHexV7 } from '../v7/background';
import {
  SURFACE_EFFECT_FIDELITY_LABELS_V7,
  SURFACE_EFFECT_LABELS_V7,
  SURFACE_EFFECT_TYPES_V7,
  createDefaultSurfaceEffectPayloadV7,
  createSurfaceEffectMaskV7,
  type SurfaceEffectMaskPresetV7,
} from '../v7/surface-effect';

const MASK_LABELS: Record<SurfaceEffectMaskPresetV7, string> = { full: '全甲', tip: '甲尖', center: '中央', diagonal: '斜切' };

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
  return <label className="block space-y-1"><span className="flex justify-between gap-2 text-[10px] font-semibold text-gray-600"><span>{label}</span><span className="tabular-nums text-gray-800">{Number(draft.toFixed(2))}{unit}</span></span><input type="range" min={min} max={max} step={step} value={draft} disabled={disabled} aria-label={label} onChange={(event) => setDraft(Number(event.target.value))} onPointerUp={commit} onKeyUp={commit} onBlur={commit} className="h-10 w-full accent-primary disabled:opacity-45" /></label>;
}

function CommitColor({ label, value, disabled, onCommit }: { label: string; value: RgbaColorV7; disabled: boolean; onCommit(value: RgbaColorV7): EditorV7ActionResult }) {
  const canonical = rgbaToHexV7(value);
  const [draft, setDraft] = useState(canonical);
  useEffect(() => setDraft(canonical), [canonical]);
  const commit = () => {
    if (draft === canonical) return;
    const parsed = parseHexColorV7(draft);
    if (!parsed || !onCommit(parsed).ok) setDraft(canonical);
  };
  return <label className="flex items-center justify-between gap-3 text-[10px] font-semibold text-gray-600"><span>{label}</span><input type="color" value={draft} disabled={disabled} aria-label={label} onChange={(event) => setDraft(event.target.value)} onBlur={commit} className="h-11 w-16 rounded-lg border border-gray-300 bg-white" /></label>;
}

export function SurfaceEffectPanelV7() {
  const toast = useToast();
  const step = useEditorV7Store(selectCurrentStepV7);
  const currentFinger = useEditorV7Store((state) => state.currentFinger);
  const readOnly = useEditorV7Store((state) => state.readOnly);
  const switching = useEditorV7Store((state) => state.switching);
  const setEffect = useEditorV7Store((state) => state.setSurfaceEffect);
  const setMask = useEditorV7Store((state) => state.setSurfaceEffectMask);
  if (step?.kind !== 'surface_effect') return null;
  const effect = step.effect;
  const canEdit = step.visible && !step.skipped && !readOnly && !switching && !step.locked;
  const report = (result: EditorV7ActionResult) => { if (!result.ok) toast.error(result.message); return result; };
  const update = (next: SurfaceEffectPayloadV7) => report(setEffect(currentFinger, step.id, next));
  const switchType = (effectType: SurfaceEffectPayloadV7['effectType']) => {
    if (effectType !== effect.effectType) update(createDefaultSurfaceEffectPayloadV7(effectType, `${step.id}-${effectType}`));
  };
  const fidelityTone = effect.previewFidelity === 'exact' ? 'border-success/25 bg-success-soft text-success' : effect.previewFidelity === 'approximate' ? 'border-warning/25 bg-warning-soft text-warning' : 'border-gray-300 bg-gray-100 text-gray-600';

  return (
    <div className="mt-2 space-y-3 rounded-xl border border-primary/15 bg-primary-soft/30 p-3" data-testid="v7-surface-effect-panel">
      <div><div className="flex items-center gap-2"><Sparkles size={14} className="text-primary" /><p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-gray-600">局部表面效果</p></div><p className="mt-1 text-[10px] leading-4 text-gray-500">只修改 {currentFinger} 当前步骤；局部效果不会改写整甲背景。</p></div>
      <div className="grid grid-cols-2 gap-1 rounded-xl bg-white p-1" aria-label="表面效果类型">
        {SURFACE_EFFECT_TYPES_V7.map((effectType) => <button key={effectType} type="button" disabled={!canEdit || effect.effectType === effectType} aria-pressed={effect.effectType === effectType} onClick={() => switchType(effectType)} className={cx('min-h-11 rounded-lg px-2 text-[10px] font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed', effect.effectType === effectType ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-50 disabled:opacity-45')}>{SURFACE_EFFECT_LABELS_V7[effectType]}</button>)}
      </div>
      <div><p className="mb-1.5 text-[10px] font-semibold text-gray-600">作用区域</p><div className="grid grid-cols-4 gap-1">{(Object.keys(MASK_LABELS) as SurfaceEffectMaskPresetV7[]).map((preset) => <button key={preset} type="button" disabled={!canEdit} onClick={() => report(setMask(currentFinger, step.id, createSurfaceEffectMaskV7(preset)))} className="min-h-11 rounded-lg border border-gray-200 bg-white px-1 text-[10px] text-gray-600 hover:border-primary/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-45">{MASK_LABELS[preset]}</button>)}</div></div>
      {effect.effectType === 'cat_eye' && <div className="space-y-2"><CommitRange label="磁光方向" value={effect.directionDeg} min={0} max={359} step={1} unit="°" disabled={!canEdit} onCommit={(value) => update({ ...effect, directionDeg: value })} /><CommitRange label="磁光强度" value={effect.intensity} min={0} max={1} step={0.01} disabled={!canEdit} onCommit={(value) => update({ ...effect, intensity: value })} /><CommitRange label="光带宽度" value={effect.bandWidth} min={0.04} max={0.8} step={0.01} disabled={!canEdit} onCommit={(value) => update({ ...effect, bandWidth: value })} /></div>}
      {effect.effectType === 'glitter' && <div className="space-y-2"><CommitRange label="粒子密度" value={effect.density} min={0} max={1} step={0.01} disabled={!canEdit} onCommit={(value) => update({ ...effect, density: value })} /><CommitRange label="粒径" value={effect.particleSizeMm} min={0.02} max={1.2} step={0.01} unit="mm" disabled={!canEdit} onCommit={(value) => update({ ...effect, particleSizeMm: value })} /></div>}
      {effect.effectType === 'mirror' && <div className="space-y-2"><CommitColor label="镜面色调" value={effect.tint} disabled={!canEdit} onCommit={(value) => update({ ...effect, tint: value })} /><CommitRange label="反射强度" value={effect.reflectance} min={0} max={1} step={0.01} disabled={!canEdit} onCommit={(value) => update({ ...effect, reflectance: value })} /></div>}
      {effect.effectType === 'ink_bloom' && <div className="space-y-2"><div className="grid grid-cols-2 gap-2">{effect.colors.slice(0, 2).map((color, index) => <CommitColor key={index} label={`晕染色 ${index + 1}`} value={color} disabled={!canEdit} onCommit={(value) => update({ ...effect, colors: effect.colors.map((item, current) => current === index ? value : item) })} />)}</div><CommitRange label="扩散范围" value={effect.spread} min={0.05} max={1} step={0.01} disabled={!canEdit} onCommit={(value) => update({ ...effect, spread: value })} /></div>}
      <div className={cx('inline-flex rounded-full border px-2.5 py-1 text-[10px] font-semibold', fidelityTone)}>{SURFACE_EFFECT_FIDELITY_LABELS_V7[effect.previewFidelity]}</div>
      <p className="rounded-lg border border-info/20 bg-info-soft px-2.5 py-2 text-[10px] leading-4 text-info"><Info size={12} className="mr-1 inline" />2D adapter 为编辑预览；不代表最终 3D、材料性能或物理可制造性。</p>
    </div>
  );
}
