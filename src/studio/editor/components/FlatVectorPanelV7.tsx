import { useEffect, useRef, useState } from 'react';
import {
  Circle,
  Eraser,
  Focus,
  Hand,
  Minus,
  MousePointer2,
  Paintbrush,
  RectangleHorizontal,
  Scissors,
  Star,
  Trash2,
  Waves,
} from 'lucide-react';
import { cx, useToast } from '@/design-system';
import { PALETTE } from '../lib/material';
import { selectCurrentStepV7, useEditorV7Store } from '../store-v7';
import { generateEditorV7Id } from '../v7/id';
import { flatElementLabelV7 } from '../v7/flat-content-assets';
import {
  createFrenchFlatElementV7,
  isValidNailPathDataV7,
  type FlatVectorToolV7,
} from '../v7/flat-vector';
import { parseHexColorV7, rgbaToHexV7 } from '../v7/background';

const TOOL_ITEMS: Array<{ tool: FlatVectorToolV7; label: string; icon: typeof MousePointer2 }> = [
  { tool: 'select', label: '选择/移动', icon: MousePointer2 },
  { tool: 'brush', label: '画笔', icon: Paintbrush },
  { tool: 'eraser', label: '橡皮遮罩', icon: Eraser },
  { tool: 'line', label: '线条', icon: Minus },
  { tool: 'rectangle', label: '矩形色块', icon: RectangleHorizontal },
  { tool: 'circle', label: '圆形色块', icon: Circle },
  { tool: 'star', label: '星形色块', icon: Star },
  { tool: 'french', label: '添加法式', icon: Waves },
  { tool: 'region_mask', label: '区域遮罩', icon: Scissors },
  { tool: 'anchor', label: '锚点编辑', icon: Focus },
];

export type FlatVectorPanelVariantV7 = 'full' | 'resources' | 'inspector';

export function FlatVectorPanelV7({ variant = 'full' }: { variant?: FlatVectorPanelVariantV7 }) {
  const toast = useToast();
  const step = useEditorV7Store(selectCurrentStepV7);
  const currentFinger = useEditorV7Store((state) => state.currentFinger);
  const selectedElementId = useEditorV7Store((state) => state.selectedElementId);
  const activeTool = useEditorV7Store((state) => state.activeFlatTool);
  const color = useEditorV7Store((state) => state.activeFlatColor);
  const widthMm = useEditorV7Store((state) => state.activeFlatWidthMm);
  const readOnly = useEditorV7Store((state) => state.readOnly);
  const switching = useEditorV7Store((state) => state.switching);
  const setActiveTool = useEditorV7Store((state) => state.setActiveFlatTool);
  const setColor = useEditorV7Store((state) => state.setActiveFlatColor);
  const setWidthMm = useEditorV7Store((state) => state.setActiveFlatWidthMm);
  const selectElement = useEditorV7Store((state) => state.selectElement);
  const addElement = useEditorV7Store((state) => state.addElement);
  const removeElement = useEditorV7Store((state) => state.removeElement);
  const replaceElement = useEditorV7Store((state) => state.replaceFlatElement);
  const setElementOpacity = useEditorV7Store((state) => state.setFlatElementOpacity);
  const flatStep = step?.kind === 'flat_design' ? step : null;
  const selectedElement = flatStep?.elements.find((element) => element.id === selectedElementId) ?? null;
  const [opacityDraft, setOpacityDraft] = useState(selectedElement ? Math.round(selectedElement.opacity * 100) : 100);
  const [pathDraft, setPathDraft] = useState(selectedElement?.kind === 'vector_shape' ? selectedElement.pathData : selectedElement?.kind === 'region_mask' ? selectedElement.mask.pathData : '');
  const [frenchWidthDraft, setFrenchWidthDraft] = useState(selectedElement?.kind === 'french_edge' ? selectedElement.widthRatio : 0.22);
  const [frenchCurvatureDraft, setFrenchCurvatureDraft] = useState(selectedElement?.kind === 'french_edge' ? selectedElement.curvature : 0.35);
  const lastOpacityCommit = useRef<number | null>(null);
  const lastFrenchWidthCommit = useRef<number | null>(null);
  const lastFrenchCurvatureCommit = useRef<number | null>(null);
  const canEdit = Boolean(flatStep && flatStep.visible && !flatStep.skipped && !readOnly && !switching && !flatStep.locked);

  useEffect(() => {
    const next = selectedElement ? Math.round(selectedElement.opacity * 100) : 100;
    setOpacityDraft(next);
    lastOpacityCommit.current = next;
  }, [selectedElement?.id, selectedElement?.opacity]);
  useEffect(() => setPathDraft(selectedElement?.kind === 'vector_shape' ? selectedElement.pathData : selectedElement?.kind === 'region_mask' ? selectedElement.mask.pathData : ''), [selectedElement]);
  useEffect(() => {
    if (selectedElement?.kind !== 'french_edge') return;
    setFrenchWidthDraft(selectedElement.widthRatio);
    setFrenchCurvatureDraft(selectedElement.curvature);
    lastFrenchWidthCommit.current = selectedElement.widthRatio;
    lastFrenchCurvatureCommit.current = selectedElement.curvature;
  }, [selectedElement]);

  const colorHex = rgbaToHexV7(color);
  const editablePath = selectedElement?.kind === 'vector_shape' || selectedElement?.kind === 'region_mask';
  const selectedLocked = selectedElement?.locked ?? false;
  const canEditSelected = canEdit && Boolean(selectedElement) && !selectedLocked;
  const showResources = variant === 'full' || variant === 'resources';
  const showElementList = variant === 'full';
  const showInspector = variant === 'full' || variant === 'inspector';

  const resultToast = (result: { ok: true } | { ok: false; message: string }) => {
    if (!result.ok) toast.error(result.message);
    return result.ok;
  };

  const selectTool = (tool: FlatVectorToolV7) => {
    if (tool === 'french') {
      if (!flatStep || !canEdit) return;
      const element = createFrenchFlatElementV7(generateEditorV7Id('element'), color);
      if (resultToast(addElement(currentFinger, flatStep.id, element))) {
        setActiveTool('select');
        selectElement(element.id);
      }
      return;
    }
    setActiveTool(tool);
  };

  const commitOpacity = () => {
    if (!flatStep || !selectedElement || !canEditSelected) return;
    const bounded = Math.min(100, Math.max(0, Math.round(opacityDraft)));
    setOpacityDraft(bounded);
    if (bounded === Math.round(selectedElement.opacity * 100) || bounded === lastOpacityCommit.current) return;
    const result = setElementOpacity(currentFinger, flatStep.id, selectedElement.id, bounded / 100);
    if (resultToast(result)) lastOpacityCommit.current = bounded;
    else setOpacityDraft(Math.round(selectedElement.opacity * 100));
  };

  const commitPath = () => {
    if (!flatStep || !selectedElement || !editablePath || !canEditSelected) return;
    if (!isValidNailPathDataV7(pathDraft)) {
      toast.error('路径无效：仅允许 M/L/Q/C/Z，坐标必须是 0–1 的有限数。');
      setPathDraft(selectedElement.kind === 'vector_shape' ? selectedElement.pathData : selectedElement.mask.pathData);
      return;
    }
    const currentPath = selectedElement.kind === 'vector_shape' ? selectedElement.pathData : selectedElement.mask.pathData;
    if (pathDraft.trim() === currentPath) return;
    const replacement = selectedElement.kind === 'vector_shape'
      ? { ...selectedElement, pathData: pathDraft }
      : { ...selectedElement, mask: { ...selectedElement.mask, pathData: pathDraft } };
    if (!resultToast(replaceElement(currentFinger, flatStep.id, selectedElement.id, replacement))) setPathDraft(currentPath);
  };

  const commitFrench = (field: 'widthRatio' | 'curvature') => {
    if (!flatStep || selectedElement?.kind !== 'french_edge' || !canEditSelected) return;
    const value = field === 'widthRatio' ? frenchWidthDraft : frenchCurvatureDraft;
    const lastCommit = field === 'widthRatio' ? lastFrenchWidthCommit : lastFrenchCurvatureCommit;
    if (value === selectedElement[field] || value === lastCommit.current) return;
    const result = replaceElement(currentFinger, flatStep.id, selectedElement.id, { ...selectedElement, [field]: value });
    if (resultToast(result)) lastCommit.current = value;
    else if (field === 'widthRatio') setFrenchWidthDraft(selectedElement.widthRatio);
    else setFrenchCurvatureDraft(selectedElement.curvature);
  };

  if (!flatStep) return null;

  return (
    <div className="mt-2 space-y-3 rounded-xl border border-violet-200 bg-violet-50/55 p-3" data-testid="v7-flat-vector-panel">
      {variant === 'full' && <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-violet-700">平面矢量工具</p>
        <p className="mt-1 text-[10px] leading-4 text-gray-500">仅修改 {currentFinger} · 画布坐标固定为 nail-local 0–1。</p>
      </div>}

      {showResources && <div className="grid grid-cols-2 gap-1.5" role="toolbar" aria-label="平面设计工具">
        {TOOL_ITEMS.map(({ tool, label, icon: Icon }) => (
          <button
            key={tool}
            type="button"
            disabled={!canEdit && tool !== 'select'}
            aria-pressed={activeTool === tool}
            onClick={() => selectTool(tool)}
            className={cx(
              'flex min-h-11 min-w-0 items-center gap-2 rounded-lg border px-2 text-left text-[10px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-40',
              activeTool === tool ? 'border-violet-500 bg-violet-600 text-white' : 'border-gray-200 bg-white text-gray-700 hover:border-violet-300',
            )}
          >
            <Icon size={14} className="shrink-0" />
            <span className="truncate">{label}</span>
          </button>
        ))}
      </div>}

      {showResources && <fieldset disabled={!canEdit} className="space-y-2 disabled:opacity-45">
        <legend className="text-[10px] font-semibold text-gray-600">绘制样式</legend>
        <div className="grid grid-cols-5 gap-1.5">
          {PALETTE.slice(0, 5).map((item) => (
            <button
              key={item.id}
              type="button"
              title={item.name}
              aria-label={`绘制颜色 ${item.name}`}
              aria-pressed={item.hex.toLowerCase() === colorHex}
              onClick={() => { const next = parseHexColorV7(item.hex); if (next) setColor(next); }}
              className={cx('h-9 rounded-full border border-gray-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary', item.hex.toLowerCase() === colorHex && 'ring-2 ring-violet-500 ring-offset-1')}
              style={{ backgroundColor: item.hex }}
            />
          ))}
        </div>
        <div className="grid grid-cols-[44px_1fr] items-center gap-2">
          <input type="color" value={colorHex} aria-label="自定义绘制颜色" onChange={(event) => { const next = parseHexColorV7(event.target.value); if (next) setColor(next); }} className="h-11 w-11 rounded-lg border border-gray-300 bg-white p-1" />
          <label className="grid grid-cols-[1fr_auto] items-center gap-2 text-[10px] text-gray-600">
            <input type="range" min="0.05" max="3" step="0.05" value={widthMm} aria-label="画笔线宽" onChange={(event) => setWidthMm(Number(event.target.value))} className="h-11 w-full accent-violet-600" />
            <span className="w-12 text-right tabular-nums">{widthMm.toFixed(2)} mm</span>
          </label>
        </div>
        <output className="sr-only" data-flat-color={colorHex} data-flat-width-mm={widthMm} />
      </fieldset>}

      {showElementList && <div className="rounded-lg border border-gray-200 bg-white p-2">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[10px] font-semibold text-gray-700">元素 · {flatStep.elements.length}</p>
          <button type="button" disabled={!canEditSelected} onClick={() => selectedElement && resultToast(removeElement(currentFinger, flatStep.id, selectedElement.id))} className="inline-flex min-h-9 min-w-9 items-center justify-center rounded-lg text-gray-500 hover:bg-red-50 hover:text-error disabled:opacity-35" aria-label="删除所选元素"><Trash2 size={14} /></button>
        </div>
        <div className="mt-1.5 max-h-36 space-y-1 overflow-y-auto" aria-label="平面元素列表">
          {flatStep.elements.length === 0 && <p className="rounded-md border border-dashed border-gray-200 px-2 py-3 text-center text-[10px] text-gray-400">在甲面上绘制，元素将保存到当前步骤。</p>}
          {flatStep.elements.map((element, index) => (
            <button key={element.id} type="button" onClick={() => { selectElement(element.id); setActiveTool('select'); }} className={cx('flex min-h-9 w-full items-center gap-2 rounded-md px-2 text-left text-[10px]', selectedElementId === element.id ? 'bg-violet-100 font-semibold text-violet-800' : 'text-gray-600 hover:bg-gray-50')}>
              <span className="w-5 tabular-nums text-gray-400">{index + 1}</span>
              <span className="min-w-0 flex-1 truncate">{flatElementLabelV7(element)}</span>
              {element.locked && <span className="text-[9px] text-gray-400">锁定</span>}
            </button>
          ))}
        </div>
      </div>}

      {showInspector && selectedElement && (
        <div className="space-y-2 rounded-lg border border-violet-200 bg-white p-2.5">
          <div className="flex items-center gap-2 text-[10px] font-semibold text-violet-800"><Hand size={13} />所选：{flatElementLabelV7(selectedElement)}</div>
          <label className="grid grid-cols-[auto_1fr_auto] items-center gap-2 text-[10px] text-gray-600">
            透明度
            <input type="range" min="0" max="100" step="1" value={opacityDraft} disabled={!canEditSelected} onChange={(event) => setOpacityDraft(Number(event.target.value))} onPointerUp={commitOpacity} onKeyUp={commitOpacity} onBlur={commitOpacity} className="h-11 w-full accent-violet-600 disabled:opacity-40" />
            <span className="w-9 text-right tabular-nums">{opacityDraft}%</span>
          </label>
          {selectedElement.kind === 'french_edge' && (
            <>
              <label className="grid grid-cols-[auto_1fr_auto] items-center gap-2 text-[10px] text-gray-600">宽度<input type="range" min="0" max="1" step="0.01" value={frenchWidthDraft} disabled={!canEditSelected} onChange={(event) => setFrenchWidthDraft(Number(event.target.value))} onPointerUp={() => commitFrench('widthRatio')} onKeyUp={() => commitFrench('widthRatio')} onBlur={() => commitFrench('widthRatio')} className="h-11 accent-violet-600" /><span>{Math.round(frenchWidthDraft * 100)}%</span></label>
              <label className="grid grid-cols-[auto_1fr_auto] items-center gap-2 text-[10px] text-gray-600">弧度<input type="range" min="-1" max="1" step="0.05" value={frenchCurvatureDraft} disabled={!canEditSelected} onChange={(event) => setFrenchCurvatureDraft(Number(event.target.value))} onPointerUp={() => commitFrench('curvature')} onKeyUp={() => commitFrench('curvature')} onBlur={() => commitFrench('curvature')} className="h-11 accent-violet-600" /><span>{frenchCurvatureDraft.toFixed(2)}</span></label>
            </>
          )}
          {editablePath && (
            <div>
              <label className="text-[10px] font-semibold text-gray-600" htmlFor="v7-path-data">nail-local 路径 / 锚点</label>
              <textarea id="v7-path-data" value={pathDraft} disabled={!canEditSelected} onChange={(event) => setPathDraft(event.target.value)} onBlur={commitPath} rows={3} className="mt-1 w-full resize-y rounded-lg border border-gray-300 px-2 py-1.5 font-mono text-[10px] leading-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-45" />
              <p className="mt-1 text-[9px] leading-3.5 text-gray-500">允许 M/L/Q/C/Z；锚点坐标均为 0–1。非法输入不会覆盖上一版本。</p>
            </div>
          )}
        </div>
      )}

      {showInspector && <p className="rounded-lg border border-dashed border-gray-300 bg-white px-2.5 py-2 text-[9px] leading-3.5 text-gray-500">
        橡皮和区域遮罩按 elements 顺序仅作用于其前面的内容，不会改写原路径。文字与素材的专属属性在下方检查器中编辑。
      </p>}
    </div>
  );
}
