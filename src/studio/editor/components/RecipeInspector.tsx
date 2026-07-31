import { RotateCcw, Trash2 } from 'lucide-react';
import { Button, cx } from '@/design-system';
import { mergeMercuryParams, type RecipePresetId } from '../lib/recipe-model';
import { useEditorStore } from '../store';

const PRESETS: Array<{ id: RecipePresetId; label: string; note: string }> = [
  { id: 'subtle', label: 'Subtle', note: '轻量水滴' },
  { id: 'signature', label: 'Signature', note: '默认平衡' },
  { id: 'statement', label: 'Statement', note: '更强焦点' },
];

export function RecipeInspector() {
  const doc = useEditorStore((s) => s.doc);
  const currentFinger = useEditorStore((s) => s.currentFinger);
  const readOnly = useEditorStore((s) => s.readOnly);
  const editScope = useEditorStore((s) => s.editScope);
  const setPreset = useEditorStore((s) => s.setMercuryPreset);
  const update = useEditorStore((s) => s.updateMercuryParams);
  const setEnabled = useEditorStore((s) => s.setMercuryEnabled);
  const addDrop = useEditorStore((s) => s.addMercuryDroplet);
  const removeDrop = useEditorStore((s) => s.removeMercuryDroplet);
  const reset = useEditorStore((s) => s.resetMercury);
  if (!doc?.recipe || doc.recipe.recipeRef.id !== 'mercury-dew') return null;
  const params = mergeMercuryParams(doc.recipe, currentFinger);
  const enabled = doc.recipe.enabled !== false && doc.recipe.fingerOverrides[currentFinger]?.enabled !== false;
  return (
    <section className="rounded-panel border border-[#D7B36A]/40 bg-[#FFFCF5] p-3" data-testid="recipe-inspector">
      <header className="mb-2 flex items-center justify-between">
        <div><h3 className="text-xs font-semibold text-gray-900">Mercury Dew Recipe</h3><p className="text-[10px] text-gray-500">Appearance → Relief → Accent · 模拟效果</p></div>
        <button aria-label="切换 Mercury Recipe" disabled={readOnly} onClick={() => setEnabled(!enabled)} className={cx('h-5 w-9 rounded-full p-0.5 transition-colors', enabled ? 'bg-[#C2497A]' : 'bg-gray-300')}><span className={cx('block h-4 w-4 rounded-full bg-white transition-transform', enabled ? 'translate-x-4' : '')} /></button>
      </header>
      <div className="mb-3 grid grid-cols-3 gap-1">
        {PRESETS.map((preset) => <button key={preset.id} disabled={readOnly} onClick={() => setPreset(preset.id)} className={cx('rounded-button border px-1 py-1 text-[10px]', doc.recipe?.presetId === preset.id ? 'border-primary bg-primary-soft text-primary' : 'border-gray-200 bg-white text-gray-600')}><span className="block font-medium">{preset.label}</span><span className="text-[9px] opacity-70">{preset.note}</span></button>)}
      </div>
      <div className="flex flex-col gap-2 text-[11px] text-gray-600">
        <label className="flex items-center justify-between gap-2"><span>Cat-eye angle</span><input disabled={readOnly || !enabled} type="range" min="-35" max="35" value={params.catEyeAngleDeg} onChange={(e) => update({ catEyeAngleDeg: Number(e.target.value) })} className="flex-1 accent-[#C2497A]"/><span className="w-8 text-right tnum">{params.catEyeAngleDeg}°</span></label>
        <label className="flex items-center justify-between gap-2"><span>Beam width</span><select disabled={readOnly || !enabled} value={params.beamWidth} onChange={(e) => update({ beamWidth: e.target.value as typeof params.beamWidth })} className="rounded-button border border-gray-200 bg-white px-1 py-1 text-[10px]"><option value="narrow">Narrow</option><option value="standard">Standard</option><option value="wide">Wide</option></select></label>
        <label className="flex items-center justify-between gap-2"><span>Ribbon material</span><select disabled={readOnly || !enabled} value={params.ribbonMaterial} onChange={(e) => update({ ribbonMaterial: e.target.value as typeof params.ribbonMaterial })} className="rounded-button border border-gray-200 bg-white px-1 py-1 text-[10px]"><option value="champagne">Champagne</option><option value="silver">Silver</option></select></label>
        <label className="flex items-center justify-between gap-2"><span>Ribbon width</span><select disabled={readOnly || !enabled} value={params.ribbonWidthMm} onChange={(e) => update({ ribbonWidthMm: Number(e.target.value) as typeof params.ribbonWidthMm })} className="rounded-button border border-gray-200 bg-white px-1 py-1 text-[10px]"><option value="0.35">0.35mm</option><option value="0.5">0.50mm</option><option value="0.7">0.70mm</option></select></label>
        <label className="flex items-center justify-between gap-2"><span>Droplet density</span><select disabled={readOnly || !enabled} value={params.dropletDensity} onChange={(e) => update({ dropletDensity: e.target.value as typeof params.dropletDensity })} className="rounded-button border border-gray-200 bg-white px-1 py-1 text-[10px]"><option value="off">Off</option><option value="subtle">Subtle</option><option value="standard">Standard</option></select></label>
      </div>
      <div className="mt-3 border-t border-[#D7B36A]/30 pt-2"><div className="mb-1 flex items-center justify-between text-[10px] text-gray-500"><span>Droplets · {editScope === 'single' ? currentFinger : 'ALL 10'}</span><Button size="sm" variant="ghost" disabled={readOnly || !enabled || params.droplets.length >= 6} onClick={() => addDrop()} className="h-6 px-1.5">+ 添加</Button></div>{params.droplets.length === 0 ? <p className="text-[10px] text-gray-400">无水滴</p> : <div className="flex flex-wrap gap-1">{params.droplets.map((drop) => <button key={drop.id} disabled={readOnly || !enabled} onClick={() => removeDrop(drop.id)} title="点击删除水滴" className="flex items-center gap-1 rounded-full border border-[#D7B36A]/50 bg-white px-2 py-1 text-[10px] text-gray-600"><span>● {drop.heightMm.toFixed(2)}mm</span><Trash2 size={10}/></button>)}</div>}</div>
      <Button size="sm" variant="ghost" disabled={readOnly} onClick={reset} className="mt-2 w-full justify-center text-[10px]"><RotateCcw size={11}/> 重置当前预设</Button>
    </section>
  );
}
