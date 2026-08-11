import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { ImagePlus, Type } from 'lucide-react';
import type { FingerCode } from '@/lib/types';
import { selectCurrentStepV7, useEditorV7Store } from '../store-v7';
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

function assetStatusLabel(status: string): string {
  switch (status) {
    case 'official': return '官方模板素材';
    case 'bundled': return '内置素材，可正常使用';
    case 'valid': return '本机素材，可正常使用';
    case 'checking': return '正在校验素材…';
    case 'missing': return '素材缺失，请重新关联';
    case 'corrupt': return '素材损坏，请重新关联';
    case 'storage_error': return '本机素材库暂时无法读取';
    default: return '素材引用无效';
  }
}

function TextInspector({ element, canEdit, stepId, finger }: {
  element: Extract<FlatDesignElementV7, { kind: 'text' }>;
  canEdit: boolean;
  stepId: string;
  finger: FingerCode;
}) {
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
      setMessage('文字、字体、字号或颜色无效。');
      return;
    }
    const result = replaceTextElement(finger, stepId, element.id, {
      id: element.id,
      text: text.trim(),
      fontRef: { id: font.id, revision: font.revision },
      fontSizeMm: parsedSize,
      color: parsedColor,
    });
    setMessage(result.ok ? '文字属性已应用。' : result.reason === 'not_allowed' ? '没有需要保存的变化。' : result.message);
  };

  return <div className="space-y-3" data-testid="v7-text-inspector">
    <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-primary"><Type size={13} />文字属性</p>
    <label className="block text-[10px] font-semibold text-gray-600">内容<textarea value={text} disabled={!canEdit} rows={3} onChange={(event) => setText(event.target.value)} className="mt-1 w-full resize-y rounded-lg border border-gray-300 px-2.5 py-2 text-xs leading-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-45" /></label>
    <label className="block text-[10px] font-semibold text-gray-600">字体<select value={fontId} disabled={!canEdit} onChange={(event) => setFontId(event.target.value)} className="mt-1 h-11 w-full rounded-lg border border-gray-300 bg-white px-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-45">{FLAT_FONT_REGISTRY_V7.map((font) => <option key={font.id} value={font.id}>{font.label}</option>)}</select></label>
    <div className="grid grid-cols-[1fr_52px] gap-2">
      <label className="block text-[10px] font-semibold text-gray-600">字号（mm）<input type="number" min={FLAT_TEXT_FONT_SIZE_MIN_MM_V7} max={FLAT_TEXT_FONT_SIZE_MAX_MM_V7} step="0.1" value={fontSize} disabled={!canEdit} onChange={(event) => setFontSize(event.target.value)} className="mt-1 h-11 w-full rounded-lg border border-gray-300 px-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-45" /></label>
      <label className="block text-[10px] font-semibold text-gray-600">颜色<input type="color" value={color} disabled={!canEdit} onChange={(event) => setColor(event.target.value)} className="mt-1 h-11 w-full rounded-lg border border-gray-300 bg-white p-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-45" /></label>
    </div>
    <button type="button" disabled={!canEdit} onClick={apply} className="min-h-11 w-full rounded-xl bg-primary px-3 text-xs font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 disabled:opacity-40">应用文字属性</button>
    {message && <p className="rounded-lg bg-gray-50 px-2.5 py-2 text-[10px] leading-4 text-gray-600" role="status">{message}</p>}
  </div>;
}

function ImageInspector({ element, canEdit, stepId, finger }: {
  element: Extract<FlatDesignElementV7, { kind: 'image_2d' }>;
  canEdit: boolean;
  stepId: string;
  finger: FingerCode;
}) {
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
        setMessage(result.ok ? '素材已重新关联，位置与透明度保持不变。' : result.message);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '重新关联失败。');
    } finally {
      setBusy(false);
      input.value = '';
    }
  };

  const summaryRows = [
    ['类型', element.role === 'sticker' ? '贴纸' : element.role === 'stamp' ? '印章' : '导入素材'],
    ['使用状态', assetStatusLabel(status)],
    ['画面尺寸', `${element.asset.widthPx ?? '?'} × ${element.asset.heightPx ?? '?'} px`],
  ];
  const technicalRows = [
    ['Asset', shortAssetIdV7(element.asset.assetId)],
    ['Revision', element.asset.revision],
    ['MIME', element.asset.mimeType],
    ['SHA-256', `${element.asset.sha256.slice(0, 12)}…`],
    ['颜色 / Alpha', `${element.asset.colorSpace ?? 'unknown'} / ${element.asset.alphaMode ?? 'unknown'}`],
  ];
  return <div className="space-y-3" data-testid="v7-image-inspector" data-asset-status={status}>
    <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-primary"><ImagePlus size={13} />素材属性</p>
    <dl className="grid grid-cols-[70px_1fr] gap-x-2 gap-y-1.5 rounded-xl border border-gray-200 bg-gray-50 p-2.5 text-[10px] leading-4">{summaryRows.map(([label, value]) => <div key={label} className="contents"><dt className="text-gray-400">{label}</dt><dd className="min-w-0 text-gray-700">{value}</dd></div>)}</dl>
    {element.role === 'import' && <label className="flex min-h-11 cursor-pointer items-center justify-center rounded-xl border border-gray-300 bg-white px-3 text-[10px] font-semibold text-gray-700 focus-within:outline-none focus-within:ring-2 focus-within:ring-primary">
      {busy ? '校验中…' : '重新关联 PNG / SVG'}
      <input ref={inputRef} type="file" accept="image/png,image/svg+xml" disabled={!canEdit || busy} onChange={(event) => void relink(event)} className="sr-only" data-testid="flat-relink-input" />
    </label>}
    {element.role !== 'import' && <p className="rounded-lg border border-dashed border-gray-200 px-2.5 py-2 text-[9px] leading-4 text-gray-500">内置贴纸与印章按版本 registry 解析，本版本不提供手动替换。</p>}
    <details className="rounded-lg border border-gray-200 bg-white px-2.5 py-2 text-[9px] text-gray-500">
      <summary className="cursor-pointer font-semibold text-gray-600">技术详情</summary>
      <dl className="mt-2 grid grid-cols-[62px_1fr] gap-x-2 gap-y-1.5 leading-4">{technicalRows.map(([label, value]) => <div key={label} className="contents"><dt className="text-gray-400">{label}</dt><dd className="min-w-0 break-all font-mono text-gray-700">{value}</dd></div>)}</dl>
    </details>
    {message && <p className="rounded-lg bg-gray-50 px-2.5 py-2 text-[10px] leading-4 text-gray-600" role="status">{message}</p>}
  </div>;
}

export function FlatContentInspectorV7() {
  const step = useEditorV7Store(selectCurrentStepV7);
  const selectedElementId = useEditorV7Store((state) => state.selectedElementId);
  const finger = useEditorV7Store((state) => state.currentFinger);
  const readOnly = useEditorV7Store((state) => state.readOnly);
  const switching = useEditorV7Store((state) => state.switching);
  if (step?.kind !== 'flat_design') return null;
  const element = step.elements.find((candidate) => candidate.id === selectedElementId);
  if (!element || (element.kind !== 'text' && element.kind !== 'image_2d')) return null;
  const canEdit = step.visible && !step.skipped && !readOnly && !switching && !step.locked && !element.locked;
  return <div className="mt-3 rounded-xl border border-primary/15 bg-white p-3">{element.kind === 'text'
    ? <TextInspector element={element} canEdit={canEdit} stepId={step.id} finger={finger} />
    : <ImageInspector element={element} canEdit={canEdit} stepId={step.id} finger={finger} />}</div>;
}
