import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { ImagePlus, Type } from 'lucide-react';
import type { FingerCode } from '@/lib/types';
import { useLocale } from '@/lib/i18n';
import type { MessageKey } from '@/lib/i18n';
import { selectCurrentGeometryExactV7, selectCurrentStepV7, useEditorV7Store } from '../store-v7';
import { parseHexColorV7 } from '../v7/background';
import {
  FLAT_FONT_REGISTRY_V7,
  FLAT_TEXT_FONT_SIZE_MAX_MM_V7,
  FLAT_TEXT_FONT_SIZE_MIN_MM_V7,
  flatContentAssetStatusV7,
  prepareFlatAssetImportV7,
  shortAssetIdV7,
} from '../v7/flat-content-assets';
import type { FlatDesignElementV7, RgbaColorV7 } from '../v7/model';

function colorHex(color: RgbaColorV7): string {
  return `#${[color.r, color.g, color.b].map((value) => value.toString(16).padStart(2, '0')).join('')}`;
}

function assetStatusLabel(status: string): MessageKey {
  switch (status) {
    case 'official': return 'editor.extra.officialAsset'; case 'bundled': return 'editor.extra.bundledAsset'; case 'valid': return 'editor.extra.localAsset'; case 'checking': return 'editor.extra.validatingAsset'; case 'missing': return 'editor.extra.relinkMissing'; case 'corrupt': return 'editor.extra.relinkCorrupt'; case 'storage_error': return 'editor.extra.storageError'; default: return 'editor.extra.invalidAssetRef';
  }
}

function TextInspector({ element, canEdit, stepId, finger }: {
  element: Extract<FlatDesignElementV7, { kind: 'text' }>;
  canEdit: boolean;
  stepId: string;
  finger: FingerCode;
}) {
  const { t } = useLocale();
  const replaceTextElement = useEditorV7Store((state) => state.replaceTextElement);
  const [text, setText] = useState(element.text);
  const [fontId, setFontId] = useState(element.fontRef.id);
  const [fontSize, setFontSize] = useState(String(element.fontSizeMm));
  const [color, setColor] = useState(colorHex(element.color));
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setText(element.text);
    setFontId(element.fontRef.id);
    setFontSize(String(element.fontSizeMm));
    setColor(colorHex(element.color));
    setMessage(null);
  }, [element.id, element.text, element.fontRef.id, element.fontSizeMm, element.color.r, element.color.g, element.color.b]);

  const apply = () => {
    const font = FLAT_FONT_REGISTRY_V7.find((entry) => entry.id === fontId);
    const parsedColor = parseHexColorV7(color);
    const parsedSize = Number(fontSize);
    if (!font || !parsedColor || !text.trim() || !Number.isFinite(parsedSize)) {
      setMessage(t('editorV7.flatInspector.invalidText'));
      return;
    }
    const result = replaceTextElement(finger, stepId, element.id, {
      id: element.id,
      text: text.trim(),
      fontRef: { id: font.id, revision: font.revision },
      fontSizeMm: parsedSize,
      color: parsedColor,
    });
    setMessage(result.ok ? t('editorV7.flatInspector.textApplied') : result.reason === 'not_allowed' ? t('editorV7.flatInspector.noChanges') : result.message);
  };

  return <div className="space-y-3" data-testid="v7-text-inspector">
    <p className="flex items-center gap-2 text-nano font-semibold uppercase tracking-[0.12em] text-primary"><Type size={13} />{t('editorV7.flatInspector.textTitle')}</p>
    <label className="block text-nano font-semibold text-gray-600">{t('editorV7.flatInspector.content')}<textarea value={text} disabled={!canEdit} rows={3} onChange={(event) => setText(event.target.value)} className="mt-1 w-full resize-y rounded-lg border border-gray-300 px-2.5 py-2 text-xs leading-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-45" /></label>
    <label className="block text-nano font-semibold text-gray-600">{t('editorV7.flatInspector.font')}<select value={fontId} disabled={!canEdit} onChange={(event) => setFontId(event.target.value)} className="mt-1 h-11 w-full rounded-lg border border-gray-300 bg-white px-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-45">{FLAT_FONT_REGISTRY_V7.map((font) => <option key={font.id} value={font.id}>{font.label}</option>)}</select></label>
    <div className="grid grid-cols-[1fr_52px] gap-2">
      <label className="block text-nano font-semibold text-gray-600">{t('editorV7.flatInspector.fontSize')}<input type="number" min={FLAT_TEXT_FONT_SIZE_MIN_MM_V7} max={FLAT_TEXT_FONT_SIZE_MAX_MM_V7} step="0.1" value={fontSize} disabled={!canEdit} onChange={(event) => setFontSize(event.target.value)} className="mt-1 h-11 w-full rounded-lg border border-gray-300 px-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-45" /></label>
      <label className="block text-nano font-semibold text-gray-600">{t('editorV7.flatInspector.color')}<input type="color" value={color} disabled={!canEdit} onChange={(event) => setColor(event.target.value)} className="mt-1 h-11 w-full rounded-lg border border-gray-300 bg-white p-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-45" /></label>
    </div>
    <button type="button" disabled={!canEdit} onClick={apply} className="min-h-11 w-full rounded-xl bg-primary px-3 text-xs font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 disabled:opacity-40">{t('editorV7.flatInspector.applyText')}</button>
    {message && <p className="rounded-lg bg-gray-50 px-2.5 py-2 text-nano leading-4 text-gray-600" role="status">{message}</p>}
  </div>;
}

function ImageInspector({ element, canEdit, stepId, finger }: {
  element: Extract<FlatDesignElementV7, { kind: 'image_2d' }>;
  canEdit: boolean;
  stepId: string;
  finger: FingerCode;
}) {
  const { t } = useLocale();
  const resolveFlatAsset = useEditorV7Store((state) => state.resolveFlatAsset);
  const relinkPreparedImageAsset = useEditorV7Store((state) => state.relinkPreparedImageAsset);
  const inputRef = useRef<HTMLInputElement>(null);
  const classification = flatContentAssetStatusV7(element.asset);
  const [status, setStatus] = useState(classification === 'import' ? 'checking' : classification);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setMessage(null);
    if (classification !== 'import') {
      setStatus(classification);
      return () => { cancelled = true; };
    }
    setStatus('checking');
    void resolveFlatAsset(element.asset).then((result) => {
      if (!cancelled) setStatus(result.status);
    }).catch(() => { if (!cancelled) setStatus('corrupt'); });
    return () => { cancelled = true; };
  }, [classification, element.asset.assetId, element.asset.revision, element.asset.sha256, resolveFlatAsset]);

  const relink = async (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file) return;
    setBusy(true);
    setMessage(null);
    try {
      const prepared = await prepareFlatAssetImportV7(file);
      if (!prepared.ok) setMessage(prepared.message);
      else {
        const result = await relinkPreparedImageAsset(finger, stepId, element.id, prepared);
        setMessage(result.ok ? t('editor.extra.relinked') : result.message);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t('editor.extra.relinkFailed'));
    } finally {
      setBusy(false);
      input.value = '';
    }
  };

  const summaryRows = [
    [t('editor.extra.type'), element.role === 'sticker' ? t('editor.extra.sticker') : element.role === 'stamp' ? t('editor.extra.stamp') : t('editor.extra.importedAsset')],
    [t('editor.extra.usageStatus'), t(assetStatusLabel(status))],
    [t('editor.extra.dimensions'), `${element.asset.widthPx ?? '?'} × ${element.asset.heightPx ?? '?'} px`],
  ];
  const technicalRows = [
    ['Asset', shortAssetIdV7(element.asset.assetId)],
    ['Revision', element.asset.revision],
    ['MIME', element.asset.mimeType],
    ['SHA-256', `${element.asset.sha256.slice(0, 12)}…`],
    [t('editor.extra.colorAlpha'), `${element.asset.colorSpace ?? 'unknown'} / ${element.asset.alphaMode ?? 'unknown'}`],
  ];
  return <div className="space-y-3" data-testid="v7-image-inspector" data-asset-status={status}>
    <p className="flex items-center gap-2 text-nano font-semibold uppercase tracking-[0.12em] text-primary"><ImagePlus size={13} />{t('editorV7.flatInspector.assetTitle')}</p>
    <dl className="grid grid-cols-[70px_1fr] gap-x-2 gap-y-1.5 rounded-xl border border-gray-200 bg-gray-50 p-2.5 text-nano leading-4">{summaryRows.map(([label, value]) => <div key={label} className="contents"><dt className="text-gray-400">{label}</dt><dd className="min-w-0 text-gray-700">{value}</dd></div>)}</dl>
    {element.role === 'import' && <label className="flex min-h-11 cursor-pointer items-center justify-center rounded-xl border border-gray-300 bg-white px-3 text-nano font-semibold text-gray-700 focus-within:outline-none focus-within:ring-2 focus-within:ring-primary">
      {busy ? t('editor.extra.checking') : t('editor.extra.relinkPngSvg')}
      <input ref={inputRef} type="file" accept="image/png,image/svg+xml" disabled={!canEdit || busy} onChange={(event) => void relink(event)} className="sr-only" data-testid="flat-relink-input" />
    </label>}
    {element.role !== 'import' && <p className="rounded-lg border border-dashed border-gray-200 px-2.5 py-2 text-nano leading-4 text-gray-500">{t('editorV7.flatInspector.bundledNotice')}</p>}
    <details className="rounded-lg border border-gray-200 bg-white px-2.5 py-2 text-nano text-gray-500">
      <summary className="cursor-pointer font-semibold text-gray-600">{t('editorV7.flatInspector.technicalDetails')}</summary>
      <dl className="mt-2 grid grid-cols-[62px_1fr] gap-x-2 gap-y-1.5 leading-4">{technicalRows.map(([label, value]) => <div key={label} className="contents"><dt className="text-gray-400">{label}</dt><dd className="min-w-0 break-all font-mono text-gray-700">{value}</dd></div>)}</dl>
    </details>
    {message && <p className="rounded-lg bg-gray-50 px-2.5 py-2 text-nano leading-4 text-gray-600" role="status">{message}</p>}
  </div>;
}

export function FlatContentInspectorV7() {
  const step = useEditorV7Store(selectCurrentStepV7);
  const selectedElementId = useEditorV7Store((state) => state.selectedElementId);
  const finger = useEditorV7Store((state) => state.currentFinger);
  const readOnly = useEditorV7Store((state) => state.readOnly);
  const switching = useEditorV7Store((state) => state.switching);
  const geometryExact = useEditorV7Store(selectCurrentGeometryExactV7);
  if (step?.kind !== 'flat_design') return null;
  const element = step.elements.find((candidate) => candidate.id === selectedElementId);
  if (!element || (element.kind !== 'text' && element.kind !== 'image_2d')) return null;
  const canEdit = step.visible && !step.skipped && !readOnly && !switching && !step.locked && !element.locked && geometryExact;
  return <div className="mt-3 rounded-xl border border-primary/15 bg-white p-3">{element.kind === 'text'
    ? <TextInspector element={element} canEdit={canEdit} stepId={step.id} finger={finger} />
    : <ImageInspector element={element} canEdit={canEdit} stepId={step.id} finger={finger} />}</div>;
}
