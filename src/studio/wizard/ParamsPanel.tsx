/** Quick Start 的受限参数：底色、封层与逐指底色强调。正式装饰编辑属于 Editor。 */
import { useEffect, useState } from 'react';
import { Download, RotateCcw } from 'lucide-react';
import { Button, useToast, cx } from '@/design-system';
import { isScenarioOn, useMockScenarios } from '@/lib/mock-panel';
import { useLocale } from '@/lib/i18n';
import { isReadOnly } from '@/lib/state-machine';
import { taxonomyLabel } from '@/studio/shared/nail-taxonomy-labels';
import { loadFinishes, loadPalette, type FinishMeta, type PaletteColor } from '@/studio/preview/material-library';
import { downloadBlob, hasPreview, renderPreviewPng } from '@/studio/preview/export-png';
import { useWizardStore } from './wizard-store';

export function ParamsPanel() {
  const toast = useToast(); const { locale } = useLocale(); const s = useWizardStore();
  const mockFlags = useMockScenarios((s2) => s2.flags); const readOnly = isReadOnly(s.status);
  const [palette, setPalette] = useState<PaletteColor[]>([]); const [finishes, setFinishes] = useState<FinishMeta[]>([]); const [exporting, setExporting] = useState(false);
  useEffect(() => { loadPalette().then(setPalette).catch(() => toast.error('色板加载失败。')); loadFinishes().then(setFinishes).catch(() => toast.error('封层选项加载失败。')); }, [toast]);
  const handleExport = async () => { if (exporting) return; if (!hasPreview()) { toast.warning('预览尚未就绪，请稍候再导出。'); return; } setExporting(true); try { if (isScenarioOn(mockFlags, 'export.fail')) throw new Error('mock'); downloadBlob(await renderPreviewPng(2), `nail-preview-${s.designId}-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}.png`); toast.success('预览 PNG 已导出。'); } catch { toast.error('导出失败，请重试。'); } finally { setExporting(false); } };
  const fingerOverride = s.selectedFinger ? s.fingerOverrides[s.selectedFinger] : undefined;
  return <div className="flex h-full min-h-0 flex-col gap-4 overflow-y-auto pr-1">
    {s.recipe?.recipeRef.id === 'mercury-dew' && <div className="rounded-panel border border-warning/30 bg-warning-soft px-3 py-2 text-nano text-warning">模拟效果 · 尚未完成生产验证</div>}
    {readOnly && <div className="rounded-panel border border-info/30 bg-info-soft px-3 py-2 text-xs text-info">设计已冻结只读；固定版本确认请在 Editor 顾客预览完成。</div>}
    <section><p className="mb-2 text-xs font-medium text-gray-700">底色</p><div className="grid grid-cols-4 gap-2">{palette.map((c) => <button key={c.id} disabled={readOnly} onClick={() => s.setBaseColor(c.hex)} title={`${taxonomyLabel('community-color', c.id, locale, { zh: c.name, en: c.name_en })} ${c.hex}`} className={cx('flex min-h-11 flex-col items-center gap-1 rounded-button p-1', s.baseColor === c.hex ? 'ring-2 ring-primary ring-offset-1' : 'hover:bg-gray-50', readOnly && 'cursor-not-allowed opacity-60')}><span className="h-7 w-7 rounded-full border border-gray-200" style={{ backgroundColor: c.hex }} /><span className="text-nano text-gray-500">{taxonomyLabel('community-color', c.id, locale, { zh: c.name, en: c.name_en })}</span></button>)}</div></section>
    <section><p className="mb-2 text-xs font-medium text-gray-700">封层</p><select value={s.finish} disabled={readOnly} onChange={(e) => s.setFinish(e.target.value as typeof s.finish)} className="h-11 w-full rounded-button border border-gray-300 bg-white px-3 text-sm focus:border-primary focus:outline-none disabled:bg-gray-50">{finishes.map((f) => <option key={f.id} value={f.id}>{taxonomyLabel('wizard-finish', f.id, locale, { zh: f.name, en: f.name_en })}</option>)}</select><p className="mt-1 text-nano text-gray-400">仅记录快速建稿参数，进入 Editor 后可继续精修。</p></section>
    <section className="rounded-panel border border-gray-200 p-3"><div className="flex items-center justify-between"><p className="text-xs font-medium text-gray-900">逐指底色强调</p>{s.selectedFinger && <button className="min-h-11 px-2 text-nano text-gray-400" onClick={() => s.setSelectedFinger(null)}>完成</button>}</div>{s.selectedFinger ? <><p className="mt-2 text-nano text-gray-500">仅为当前指写入 baseColor，不写入装饰或附件。</p><div className="mt-2 grid grid-cols-[repeat(auto-fit,minmax(44px,1fr))] gap-1">{palette.map((c) => <button key={c.id} disabled={readOnly} aria-label={`${s.selectedFinger} 底色 ${c.name}`} onClick={() => s.setFingerOverride(s.selectedFinger!, { baseColor: c.hex })} title={c.name} className={cx('h-11 min-w-11 rounded-full border', fingerOverride?.baseColor === c.hex ? 'border-primary ring-2 ring-primary ring-offset-1' : 'border-gray-200')} style={{ backgroundColor: c.hex }} />)}</div>{fingerOverride?.baseColor && <Button size="sm" variant="ghost" disabled={readOnly} onClick={() => s.setFingerOverride(s.selectedFinger!, { baseColor: undefined })} className="mt-3"><RotateCcw size={12} />清除该指底色</Button>}</> : <p className="mt-2 text-xs leading-relaxed text-gray-400">点击预览中的指甲，可为该指单独换底色。</p>}</section>
    <section className="mt-auto border-t border-gray-100 pt-3"><Button variant="secondary" loading={exporting} onClick={handleExport}><Download size={14} />导出预览 PNG</Button></section>
  </div>;
}
