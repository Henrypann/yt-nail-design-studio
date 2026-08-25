import { RotateCcw, Trash2 } from 'lucide-react';
import { Button, cx } from '@/design-system';
import { useLocale } from '@/lib/i18n';
import type { MessageKey } from '@/lib/i18n';
import { mergeMercuryParams, type RecipePresetId } from '../lib/recipe-model';
import { useEditorStore } from '../store';

const PRESETS: Array<{ id: RecipePresetId; label: string; note: MessageKey }> = [
  { id: 'subtle', label: 'Subtle', note: 'editor.extra.lightDroplet' },
  { id: 'signature', label: 'Signature', note: 'editor.extra.defaultBalance' },
  { id: 'statement', label: 'Statement', note: 'editor.extra.strongFocus' },
];

export function RecipeInspector() {
  const { t } = useLocale();
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
        <div><h3 className="text-xs font-semibold text-gray-900">{t('editorV7.recipe.title')}</h3><p className="text-nano text-gray-500">{t('editorV7.recipe.description')}</p></div>
        <button aria-label={t('editorV7.recipe.toggle')} disabled={readOnly} onClick={() => setEnabled(!enabled)} className={cx('h-5 w-9 rounded-full p-0.5 transition-colors', enabled ? 'bg-primary' : 'bg-gray-300')}><span className={cx('block h-4 w-4 rounded-full bg-white transition-transform', enabled ? 'translate-x-4' : '')} /></button>
      </header>
      <div className="mb-3 grid grid-cols-3 gap-1">
        {PRESETS.map((preset) => <button key={preset.id} disabled={readOnly} onClick={() => setPreset(preset.id)} className={cx('rounded-button border px-1 py-1 text-nano', doc.recipe?.presetId === preset.id ? 'border-primary bg-primary-soft text-primary' : 'border-gray-200 bg-white text-gray-600')}><span className="block font-medium">{preset.label}</span><span className="text-nano opacity-70">{t(preset.note)}</span></button>)}
      </div>
      <div className="flex flex-col gap-2 text-nano text-gray-600">
        <label className="flex items-center justify-between gap-2"><span>{t('editorV7.recipe.catEyeAngle')}</span><input disabled={readOnly || !enabled} type="range" min="-35" max="35" value={params.catEyeAngleDeg} onChange={(e) => update({ catEyeAngleDeg: Number(e.target.value) })} className="flex-1 accent-primary"/><span className="w-8 text-right tnum">{params.catEyeAngleDeg}{'°'}</span></label>
        <label className="flex items-center justify-between gap-2"><span>{t('editorV7.recipe.beamWidth')}</span><select disabled={readOnly || !enabled} value={params.beamWidth} onChange={(e) => update({ beamWidth: e.target.value as typeof params.beamWidth })} className="rounded-button border border-gray-200 bg-white px-1 py-1 text-nano"><option value="narrow">{t('editorV7.recipe.narrow')}</option><option value="standard">{t('editorV7.recipe.standard')}</option><option value="wide">{t('editorV7.recipe.wide')}</option></select></label>
        <label className="flex items-center justify-between gap-2"><span>{t('editorV7.recipe.ribbonMaterial')}</span><select disabled={readOnly || !enabled} value={params.ribbonMaterial} onChange={(e) => update({ ribbonMaterial: e.target.value as typeof params.ribbonMaterial })} className="rounded-button border border-gray-200 bg-white px-1 py-1 text-nano"><option value="champagne">{t('editorV7.recipe.champagne')}</option><option value="silver">{t('editorV7.recipe.silver')}</option></select></label>
        <label className="flex items-center justify-between gap-2"><span>{t('editorV7.recipe.ribbonWidth')}</span><select disabled={readOnly || !enabled} value={params.ribbonWidthMm} onChange={(e) => update({ ribbonWidthMm: Number(e.target.value) as typeof params.ribbonWidthMm })} className="rounded-button border border-gray-200 bg-white px-1 py-1 text-nano"><option value="0.35">{'0.35'}{'mm'}</option><option value="0.5">{'0.50'}{'mm'}</option><option value="0.7">{'0.70'}{'mm'}</option></select></label>
        <label className="flex items-center justify-between gap-2"><span>{t('editorV7.recipe.dropletDensity')}</span><select disabled={readOnly || !enabled} value={params.dropletDensity} onChange={(e) => update({ dropletDensity: e.target.value as typeof params.dropletDensity })} className="rounded-button border border-gray-200 bg-white px-1 py-1 text-nano"><option value="off">{t('editorV7.recipe.off')}</option><option value="subtle">{t('editorV7.recipe.subtle')}</option><option value="standard">{t('editorV7.recipe.standard')}</option></select></label>
      </div>
      <div className="mt-3 border-t border-[#D7B36A]/30 pt-2"><div className="mb-1 flex items-center justify-between text-nano text-gray-500"><span>{t('editorV7.recipe.droplets', { scope: editScope === 'single' ? currentFinger : 'ALL 10' })}</span><Button size="sm" variant="ghost" disabled={readOnly || !enabled || params.droplets.length >= 6} onClick={() => addDrop()} className="h-6 px-1.5">{t('editorV7.recipe.add')}</Button></div>{params.droplets.length === 0 ? <p className="text-nano text-gray-400">{t('editorV7.recipe.empty')}</p> : <div className="flex flex-wrap gap-1">{params.droplets.map((drop) => <button key={drop.id} disabled={readOnly || !enabled} onClick={() => removeDrop(drop.id)} title={t('editorV7.recipe.delete')} className="flex items-center gap-1 rounded-full border border-[#D7B36A]/50 bg-white px-2 py-1 text-nano text-gray-600"><span>{'●'}{drop.heightMm.toFixed(2)}{'mm'}</span><Trash2 size={10}/></button>)}</div>}</div>
      <Button size="sm" variant="ghost" disabled={readOnly} onClick={reset} className="mt-2 w-full justify-center text-nano"><RotateCcw size={11}/>{t('editorV7.recipe.reset')}</Button>
    </section>
  );
}
