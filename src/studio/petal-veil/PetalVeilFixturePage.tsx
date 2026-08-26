import { useState } from 'react';
import { createPetalVeilInstance } from '@/studio/editor/lib/recipe-model';
import { renderPreviewPng } from '@/studio/preview/export-png';
import {
  PetalVeilPresentationCanvas,
  PetalVeilSinglePreview,
  PetalVeilTiledPreview,
} from './PetalVeilPreview';
import { PETAL_VEIL_P0_ENABLED } from './feature';
import { useLocale } from '@/lib/i18n';

export default function PetalVeilFixturePage() {
  const { t } = useLocale();
  if (!PETAL_VEIL_P0_ENABLED) {
    return <main className="p-8 text-sm text-error">{t('petal.featureDisabled')}</main>;
  }
  const recipe = createPetalVeilInstance();
  const params = new URLSearchParams(window.location.search);
  const view = params.get('view') ?? 'tiled';
  const showExportCheck = params.get('controls') === '1';
  const [exportMeta, setExportMeta] = useState<string | null>(null);

  return (
    <main className="h-screen w-screen overflow-hidden bg-[#D8D0CA] p-6" data-testid="petal-fixture-page">
      <header className="mb-4 flex h-12 items-center justify-between">
        <div>
          <h1 className="text-lg font-medium text-gray-900">{t('petal.title')}</h1>
          <p className="text-xs text-gray-600">{t('petal.subtitle')}</p>
        </div>
        <div className="flex items-center gap-3 text-xs text-gray-600">
          <p>{t('petal.rendererStatus')}</p>
          {showExportCheck && (
            <button
              type="button"
              onClick={async () => {
                const blob = await renderPreviewPng(2);
                const bytes = new Uint8Array(await blob.arrayBuffer());
                const viewData = new DataView(bytes.buffer);
                const width = viewData.getUint32(16);
                const height = viewData.getUint32(20);
                setExportMeta(`PNG ${width}×${height} · ${blob.size} bytes`);
              }}
              className="rounded-button border border-gray-500 px-3 py-1"
            >
              {t('petal.checkPng')}
            </button>
          )}
          {exportMeta && <span data-testid="petal-export-meta">{exportMeta}</span>}
        </div>
      </header>
      <section className="h-[calc(100%-4rem)] min-h-0">
        {view === 'single' ? (
          <PetalVeilSinglePreview recipe={recipe} finger="R4" />
        ) : view === 'presentation' ? (
          <div className="grid h-full grid-cols-[minmax(0,1.7fr)_minmax(320px,0.7fr)] gap-5">
            <PetalVeilPresentationCanvas recipe={recipe} />
            <PetalVeilSinglePreview recipe={recipe} finger="R4" />
          </div>
        ) : (
          <PetalVeilTiledPreview recipe={recipe} registerExport showControls={false} />
        )}
      </section>
    </main>
  );
}
