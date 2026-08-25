import { useRef, useState, type ChangeEvent } from 'react';
import { ImagePlus, Type } from 'lucide-react';
import { cx, useToast } from '@/design-system';
import { useLocale } from '@/lib/i18n';
import { selectCurrentGeometryExactV7, selectCurrentStepV7, useEditorV7Store } from '../store-v7';
import {
  FLAT_BUNDLED_ASSET_REGISTRY_V7,
  FLAT_FONT_REGISTRY_V7,
  FLAT_TEXT_FONT_SIZE_MAX_MM_V7,
  FLAT_TEXT_FONT_SIZE_MIN_MM_V7,
  FLAT_TEXT_MAX_CODE_POINTS_V7,
  prepareFlatAssetImportV7,
  type FlatFontEntryV7,
} from '../v7/flat-content-assets';
import { parseHexColorV7 } from '../v7/background';

/**
 * V7-10 focused flat content resources: explicit `text` or `assets` local UI
 * mode inside the resource drawer. Draft typing never writes canonically;
 * each successful confirm is exactly one store command. Bundled sticker/stamp
 * placement and prepared imports always target the existing flat step — this
 * panel never auto-creates a flat design step.
 */

const TEXT_PALETTE = ['#b8245c', '#7c3aed', '#0f172a', '#ffffff', '#c2410c'];

function fontEntryByIdV7(fontId: string): FlatFontEntryV7 | undefined {
  return FLAT_FONT_REGISTRY_V7.find((entry) => entry.id === fontId);
}

function TextSectionV7() {
  const { t } = useLocale();
  const step = useEditorV7Store(selectCurrentStepV7);
  const currentFinger = useEditorV7Store((state) => state.currentFinger);
  const readOnly = useEditorV7Store((state) => state.readOnly);
  const switching = useEditorV7Store((state) => state.switching);
  const geometryExact = useEditorV7Store(selectCurrentGeometryExactV7);
  const createTextElement = useEditorV7Store((state) => state.createTextElement);
  const flatStep = step?.kind === 'flat_design' ? step : null;
  const canEdit = Boolean(flatStep && flatStep.visible && !flatStep.skipped && !flatStep.locked && !readOnly && !switching && geometryExact);

  const [textDraft, setTextDraft] = useState('');
  const [fontIdDraft, setFontIdDraft] = useState(FLAT_FONT_REGISTRY_V7[0].id);
  const [fontSizeDraft, setFontSizeDraft] = useState('2.5');
  const [colorHexDraft, setColorHexDraft] = useState(TEXT_PALETTE[0]);
  const [error, setError] = useState<string | null>(null);

  const commitText = () => {
    if (!flatStep || !canEdit) return;
    const text = textDraft.trim();
    const size = Number(fontSizeDraft);
    const color = parseHexColorV7(colorHexDraft);
    const font = fontEntryByIdV7(fontIdDraft);
    if (!text) { setError(t('editorV7.flatContent.textRequired')); return; }
    if ([...text].length > FLAT_TEXT_MAX_CODE_POINTS_V7) { setError(t('editorV7.flatContent.textTooLong', { count: FLAT_TEXT_MAX_CODE_POINTS_V7 })); return; }
    if (!Number.isFinite(size) || size < FLAT_TEXT_FONT_SIZE_MIN_MM_V7 || size > FLAT_TEXT_FONT_SIZE_MAX_MM_V7) {
      setError(t('editorV7.flatContent.fontSizeRange', { min: FLAT_TEXT_FONT_SIZE_MIN_MM_V7, max: FLAT_TEXT_FONT_SIZE_MAX_MM_V7 }));
      return;
    }
    if (!font) { setError(t('editorV7.flatContent.fontMissing')); return; }
    if (!color) { setError(t('editorV7.flatContent.colorInvalid')); return; }
    setError(null);
    const result = createTextElement(currentFinger, flatStep.id, {
      text,
      fontRef: { id: font.id, revision: font.revision },
      fontSizeMm: size,
      color,
    });
    if (result.ok) {
      setTextDraft('');
      setFontSizeDraft('2.5');
    } else {
      setError(result.message);
    }
  };

  return (
    <div className="space-y-3" data-testid="v7-flat-text-resources">
      <div>
        <p className="text-nano font-semibold uppercase tracking-[0.12em] text-primary">{t('editorV7.flatContent.textTitle')}</p>
        <p className="mt-1 text-nano leading-4 text-gray-500">{t('editorV7.flatContent.textDescription')}</p>
      </div>
      <label className="block text-nano font-semibold text-gray-600" htmlFor="flat-text-draft">{t('editorV7.flatContent.textContent')}</label>
      <textarea
        id="flat-text-draft"
        data-testid="flat-text-draft"
        value={textDraft}
        disabled={!canEdit}
        maxLength={FLAT_TEXT_MAX_CODE_POINTS_V7}
        rows={3}
        placeholder={t('editorV7.flatContent.textPlaceholder')}
        onChange={(event) => setTextDraft(event.target.value)}
        className="w-full resize-y rounded-lg border border-gray-300 px-2.5 py-2 text-xs leading-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-45"
      />
      <p className="-mt-2 text-right text-nano tabular-nums text-gray-400">{[...textDraft].length}/{FLAT_TEXT_MAX_CODE_POINTS_V7}</p>
      <label className="block text-nano font-semibold text-gray-600" htmlFor="flat-text-font">{t('editorV7.flatContent.font')}</label>
      <select
        id="flat-text-font"
        data-testid="flat-text-font"
        value={fontIdDraft}
        disabled={!canEdit}
        onChange={(event) => setFontIdDraft(event.target.value)}
        className="h-11 w-full rounded-lg border border-gray-300 bg-white px-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-45"
      >
        {FLAT_FONT_REGISTRY_V7.map((entry) => (
          <option key={entry.id} value={entry.id}>{entry.label} · {entry.category === 'sans' ? t('editorV7.flatContent.sans') : t('editorV7.flatContent.serif')}</option>
        ))}
      </select>
      <label className="block text-nano font-semibold text-gray-600" htmlFor="flat-text-size">{t('editorV7.flatContent.fontSizeMm')}</label>
      <input
        id="flat-text-size"
        data-testid="flat-text-size"
        type="number"
        min={FLAT_TEXT_FONT_SIZE_MIN_MM_V7}
        max={FLAT_TEXT_FONT_SIZE_MAX_MM_V7}
        step="0.1"
        value={fontSizeDraft}
        disabled={!canEdit}
        onChange={(event) => setFontSizeDraft(event.target.value)}
        className="h-11 w-full rounded-lg border border-gray-300 bg-white px-2.5 text-xs tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-45"
      />
      <div>
        <p className="text-nano font-semibold text-gray-600">{t('editorV7.flatContent.color')}</p>
        <div className="mt-1.5 flex items-center gap-2">
          <input
            type="color"
            data-testid="flat-text-color"
            value={colorHexDraft}
            disabled={!canEdit}
            aria-label={t('editorV7.flatContent.textColor')}
            onChange={(event) => setColorHexDraft(event.target.value)}
            className="h-11 w-11 rounded-lg border border-gray-300 bg-white p-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-45"
          />
          {TEXT_PALETTE.map((hex) => (
            <button
              key={hex}
              type="button"
              aria-label={t('editorV7.flatContent.textColorValue', { color: hex })}
              aria-pressed={colorHexDraft.toLowerCase() === hex}
              onClick={() => setColorHexDraft(hex)}
              className={cx('h-9 w-9 rounded-full border border-gray-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary', colorHexDraft.toLowerCase() === hex && 'ring-2 ring-primary ring-offset-1')}
              style={{ backgroundColor: hex }}
            />
          ))}
        </div>
      </div>
      <button
        type="button"
        data-testid="flat-text-commit"
        disabled={!canEdit || !textDraft.trim()}
        onClick={commitText}
        className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-primary bg-primary px-3 text-xs font-semibold text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Type size={14} />{t('editorV7.flatContent.addText')}
      </button>
      {error && <p className="rounded-lg border border-error/25 bg-red-50 px-2.5 py-2 text-nano leading-4 text-error" role="alert" data-testid="flat-text-error">{error}</p>}
    </div>
  );
}

function AssetsSectionV7() {
  const { t } = useLocale();
  const toast = useToast();
  const step = useEditorV7Store(selectCurrentStepV7);
  const currentFinger = useEditorV7Store((state) => state.currentFinger);
  const readOnly = useEditorV7Store((state) => state.readOnly);
  const switching = useEditorV7Store((state) => state.switching);
  const geometryExact = useEditorV7Store(selectCurrentGeometryExactV7);
  const addBundledImage = useEditorV7Store((state) => state.addBundledImage);
  const applyPreparedImport = useEditorV7Store((state) => state.applyPreparedImport);
  const flatStep = step?.kind === 'flat_design' ? step : null;
  const canEdit = Boolean(flatStep && flatStep.visible && !flatStep.skipped && !flatStep.locked && !readOnly && !switching && geometryExact);
  const importInputRef = useRef<HTMLInputElement>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);

  const stickers = FLAT_BUNDLED_ASSET_REGISTRY_V7.filter((entry) => entry.role === 'sticker');
  const stamps = FLAT_BUNDLED_ASSET_REGISTRY_V7.filter((entry) => entry.role === 'stamp');

  const placeBundle = (bundleId: string) => {
    if (!flatStep || !canEdit) return;
    const result = addBundledImage(currentFinger, flatStep.id, bundleId);
    if (!result.ok) toast.error(result.message);
  };

  const onImportFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const file = input.files?.[0];
    setImportError(null);
    if (!file) return;
    if (!flatStep || !canEdit) {
      setImportError(t('editorV7.flatContent.importUnavailable'));
      input.value = '';
      return;
    }
    setImporting(true);
    try {
      const prepared = await prepareFlatAssetImportV7(file);
      if (!prepared.ok) {
        setImportError(prepared.message);
        return;
      }
      const result = await applyPreparedImport(currentFinger, flatStep.id, prepared);
      if (!result.ok) setImportError(result.message);
    } catch (error) {
      setImportError(error instanceof Error ? error.message : t('editorV7.flatContent.importFailed'));
    } finally {
      setImporting(false);
      // Always clear so the same file can be re-imported after a correction.
      input.value = '';
    }
  };

  return (
    <div className="space-y-4" data-testid="v7-flat-asset-resources">
      <div>
        <p className="text-nano font-semibold uppercase tracking-[0.12em] text-primary">{t('editorV7.flatContent.assetsTitle')}</p>
        <p className="mt-1 text-nano leading-4 text-gray-500">{t('editorV7.flatContent.assetsDescription')}</p>
      </div>

      <div>
        <p className="text-nano font-semibold text-gray-600">{t('editorV7.flatContent.stickers')}</p>
        <div className="mt-1.5 grid grid-cols-2 gap-2" role="group" aria-label={t('editorV7.flatContent.stickerAssets')}>
          {stickers.map((entry) => (
            <button
              key={entry.id}
              type="button"
              disabled={!canEdit}
              title={entry.label}
              aria-label={t('editorV7.flatContent.addSticker', { label: entry.label })}
              data-bundle-id={entry.id}
              data-asset-role={entry.role}
              data-testid="flat-bundle-sticker"
              onClick={() => placeBundle(entry.id)}
              className="flex min-h-11 min-w-0 items-center gap-2 rounded-xl border border-gray-200 bg-white px-2 py-1.5 text-left text-nano text-gray-700 transition-colors hover:border-violet-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-40"
            >
              <img src={entry.sourceUrl} alt={t('editorV7.flatContent.assetPreview')} width={32} height={32} className="h-8 w-8 shrink-0 rounded-md bg-gray-50 object-contain" />
              <span className="truncate">{entry.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="text-nano font-semibold text-gray-600">{t('editorV7.flatContent.stamps')}</p>
        <div className="mt-1.5 grid grid-cols-2 gap-2" role="group" aria-label={t('editorV7.flatContent.stampAssets')}>
          {stamps.map((entry) => (
            <button
              key={entry.id}
              type="button"
              disabled={!canEdit}
              title={entry.label}
              aria-label={t('editorV7.flatContent.addStamp', { label: entry.label })}
              data-bundle-id={entry.id}
              data-asset-role={entry.role}
              data-testid="flat-bundle-stamp"
              onClick={() => placeBundle(entry.id)}
              className="flex min-h-11 min-w-0 items-center gap-2 rounded-xl border border-gray-200 bg-white px-2 py-1.5 text-left text-nano text-gray-700 transition-colors hover:border-violet-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-40"
            >
              <img src={entry.sourceUrl} alt={t('editorV7.flatContent.assetPreview')} width={32} height={32} className="h-8 w-8 shrink-0 rounded-md bg-gray-50 object-contain" />
              <span className="truncate">{entry.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-3">
        <p className="flex items-center gap-1.5 text-nano font-semibold text-gray-600"><ImagePlus size={13} />{t('editorV7.flatContent.importAssets')}</p>
        <p className="mt-1 text-nano leading-4 text-gray-500">{t('editorV7.flatContent.importDescription')}</p>
        <label className="mt-2 flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-gray-300 bg-white px-3 text-nano font-semibold text-gray-700 transition-colors hover:border-violet-300 focus-within:outline-none focus-within:ring-2 focus-within:ring-primary disabled:cursor-not-allowed disabled:opacity-40">
          {importing ? t('editorV7.flatContent.importing') : t('editorV7.flatContent.chooseFile')}
          <input
            ref={importInputRef}
            type="file"
            accept="image/png,image/svg+xml"
            data-testid="flat-import-input"
            disabled={!canEdit || importing}
            onChange={(event) => void onImportFile(event)}
            className="sr-only"
          />
        </label>
        {importError && <p className="mt-2 rounded-lg border border-error/25 bg-red-50 px-2.5 py-2 text-nano leading-4 text-error" role="alert" data-testid="flat-import-error">{importError}</p>}
      </div>
    </div>
  );
}

export function FlatContentResourcesV7({ mode }: { mode: 'text' | 'assets' }) {
  return (
    <div className="space-y-3" data-testid="v7-flat-content-resources" data-resource-mode={mode}>
      {mode === 'text' ? <TextSectionV7 /> : <AssetsSectionV7 />}
    </div>
  );
}
