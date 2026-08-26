import { useEffect, useState } from 'react';
import { Download, MonitorPlay } from 'lucide-react';
import { Badge, Button, useToast } from '@/design-system';
import { useLocale } from '@/lib/i18n';
import { downloadBlob, renderPreviewPng } from '@/studio/preview/export-png';
import { WEB_3D_MANIFEST_URL } from '@/studio/preview/asset-manifest';
import { rendererRequestFromV6Recipe, resolveRenderer, type RendererResolution } from '@/studio/preview/renderer-adapter';
import { useEditorV6Store } from '../store-v6';

type OutputStatus = RendererResolution | { kind: 'generic_2d'; statusLabel: 'Canonical 2D preview'; message: string };

export function V6OutputPanel() {
  const { t } = useLocale();
  const toast = useToast();
  const doc = useEditorV6Store((state) => state.doc);
  const readOnly = useEditorV6Store((state) => state.readOnly);
  const viewMode = useEditorV6Store((state) => state.viewMode);
  const setViewMode = useEditorV6Store((state) => state.setViewMode);
  const setOutputIntent = useEditorV6Store((state) => state.setOutputIntent);
  const [status, setStatus] = useState<OutputStatus>({
    kind: 'generic_2d',
    statusLabel: 'Canonical 2D preview',
    message: t('editor.extra.v6Source'),
  });
  const [exporting, setExporting] = useState(false);
  const recipe = doc ? Object.values(doc.recipeInstances)[0] : undefined;
  const recipeKey = `${doc?.designId ?? 'none'}:${recipe?.id ?? 'generic'}`;

  useEffect(() => {
    if (!recipe) {
      setStatus({ kind: 'generic_2d', statusLabel: 'Canonical 2D preview', message: t('editor.extra.v6No3d') });
      return;
    }
    const request = rendererRequestFromV6Recipe(recipe, 720);
    if (!request) {
      setStatus({ kind: 'generic_2d', statusLabel: 'Canonical 2D preview', message: t('editor.extra.v6RecipeUnavailable') });
      return;
    }
    let alive = true;
    void fetch(WEB_3D_MANIFEST_URL)
      .then((response) => response.ok ? response.json() : Promise.reject(new Error(`HTTP ${response.status}`)))
      .then((manifest) => resolveRenderer(manifest, request))
      .then((result) => { if (alive) setStatus(result); })
      .catch(() => { if (alive) setStatus({ kind: 'fallback_2d', rendererId: 'svg-2d/generic-nail-1', reason: 'invalid_manifest', statusLabel: '2D 预览降级', message: t('editor.extra.v6AssetsUnavailable') }); });
    return () => { alive = false; };
    // recipeKey is stable across ordinary canvas edits, avoiding repeated asset probes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recipeKey]);

  if (!doc) return null;

  const showCustomerPreview = () => {
    if (!readOnly && doc.outputIntent !== 'customer') setOutputIntent('customer');
    setViewMode('overview');
  };

  const exportPng = async () => {
    setExporting(true);
    try {
      if (viewMode !== 'overview') {
        showCustomerPreview();
        await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
      }
      const blob = await renderPreviewPng(2);
      downloadBlob(blob, `customer-preview-${doc.designId}.png`);
      toast.success(t('app.customerPreviewPngExported'));
    } catch {
      toast.error(t('app.previewExportFailedMakeSureCanvasLoaded'));
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-3 border-t border-gray-200 p-3" data-debug-id="studio.editor.output-v6">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-xs font-semibold text-gray-700">{t('app.customerOutput')}</h3>
        <Badge variant={status.kind === 'adapter_loaded' ? 'blue' : 'gray'}>{status.statusLabel}</Badge>
      </div>
      <p className="text-nano leading-4 text-gray-500">
        {'message' in status ? status.message : t('app.simulated3DAdapterLoadedOutputRemainsManufacturingUnverified')}
      </p>
      <p className="rounded bg-warning-soft px-2 py-1.5 text-nano leading-4 text-warning">
        {t('app.simulatedPreviewManufacturingUnverifiedNotProductionCommand')}
      </p>
      <label className="block text-nano text-gray-500">{t('app.outputIntent')}
        <select value={doc.outputIntent} disabled={readOnly} onChange={(event) => setOutputIntent(event.target.value as typeof doc.outputIntent)} className="mt-1 w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-xs disabled:bg-gray-100">
          <option value="design">{t('app.designEditing')}</option>
          <option value="customer">{t('customer.customerPresentation')}</option>
          <option value="manufacturing" disabled>{t('app.manufacturingUnverified')}</option>
        </select>
      </label>
      <div className="grid grid-cols-2 gap-2">
        <Button size="sm" variant="ghost" onClick={showCustomerPreview}><MonitorPlay size={13} /> {t('customer.preview')}</Button>
        <Button size="sm" variant="secondary" loading={exporting} onClick={() => void exportPng()}><Download size={13} /> {t('app.exportPng')}</Button>
      </div>
      {viewMode === 'overview' && <Button size="sm" variant="ghost" className="w-full" onClick={() => setViewMode('single')}>{t('app.backSingleNail')}</Button>}
    </div>
  );
}
