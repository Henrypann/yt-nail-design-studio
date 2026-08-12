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
  const { text } = useLocale();
  const toast = useToast();
  const doc = useEditorV6Store((state) => state.doc);
  const readOnly = useEditorV6Store((state) => state.readOnly);
  const viewMode = useEditorV6Store((state) => state.viewMode);
  const setViewMode = useEditorV6Store((state) => state.setViewMode);
  const setOutputIntent = useEditorV6Store((state) => state.setOutputIntent);
  const [status, setStatus] = useState<OutputStatus>({
    kind: 'generic_2d',
    statusLabel: 'Canonical 2D preview',
    message: '当前文档使用可操作的 V6 2D 真源预览。',
  });
  const [exporting, setExporting] = useState(false);
  const recipe = doc ? Object.values(doc.recipeInstances)[0] : undefined;
  const recipeKey = `${doc?.designId ?? 'none'}:${recipe?.id ?? 'generic'}`;

  useEffect(() => {
    if (!recipe) {
      setStatus({ kind: 'generic_2d', statusLabel: 'Canonical 2D preview', message: '无配方 3D 资产请求；使用 V6 2D 真源预览。' });
      return;
    }
    const request = rendererRequestFromV6Recipe(recipe, 720);
    if (!request) {
      setStatus({ kind: 'generic_2d', statusLabel: 'Canonical 2D preview', message: '配方引用不具备可解析的 3D 请求，保留 2D 预览。' });
      return;
    }
    let alive = true;
    void fetch(WEB_3D_MANIFEST_URL)
      .then((response) => response.ok ? response.json() : Promise.reject(new Error(`HTTP ${response.status}`)))
      .then((manifest) => resolveRenderer(manifest, request))
      .then((result) => { if (alive) setStatus(result); })
      .catch(() => { if (alive) setStatus({ kind: 'fallback_2d', rendererId: 'svg-2d/generic-nail-1', reason: 'invalid_manifest', statusLabel: '2D 预览降级', message: '3D 清单不可用，已保留可操作 2D 预览。' }); });
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
      toast.success(text('顾客预览 PNG 已导出。', 'Customer preview PNG exported.'));
    } catch {
      toast.error(text('预览导出失败，请确认画布已加载。', 'Preview export failed; make sure the canvas is loaded.'));
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-3 border-t border-gray-200 p-3" data-debug-id="studio.editor.output-v6">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-xs font-semibold text-gray-700">{text('顾客输出', 'Customer output')}</h3>
        <Badge variant={status.kind === 'adapter_loaded' ? 'blue' : 'gray'}>{status.statusLabel}</Badge>
      </div>
      <p className="text-nano leading-4 text-gray-500">
        {'message' in status ? status.message : text('模拟 3D 适配器已加载；输出仍标记为未制造验证。', 'Simulated 3D adapter loaded; output remains manufacturing-unverified.')}
      </p>
      <p className="rounded bg-warning-soft px-2 py-1.5 text-nano leading-4 text-warning">
        {text('模拟预览 · 尚未完成制造验证，不可作为生产指令。', 'Simulated preview · manufacturing unverified; not a production command.')}
      </p>
      <label className="block text-nano text-gray-500">{text('输出意图', 'Output intent')}
        <select value={doc.outputIntent} disabled={readOnly} onChange={(event) => setOutputIntent(event.target.value as typeof doc.outputIntent)} className="mt-1 w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-xs disabled:bg-gray-100">
          <option value="design">{text('设计编辑', 'Design editing')}</option>
          <option value="customer">{text('顾客展示', 'Customer presentation')}</option>
          <option value="manufacturing" disabled>{text('制造（未验证）', 'Manufacturing (unverified)')}</option>
        </select>
      </label>
      <div className="grid grid-cols-2 gap-2">
        <Button size="sm" variant="ghost" onClick={showCustomerPreview}><MonitorPlay size={13} /> {text('十指预览', 'Preview')}</Button>
        <Button size="sm" variant="secondary" loading={exporting} onClick={() => void exportPng()}><Download size={13} /> PNG</Button>
      </div>
      {viewMode === 'overview' && <Button size="sm" variant="ghost" className="w-full" onClick={() => setViewMode('single')}>{text('返回单指编辑', 'Back to single nail')}</Button>}
    </div>
  );
}
