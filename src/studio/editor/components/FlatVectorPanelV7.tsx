import { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
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
import { Button, Modal, cx, useToast } from '@/design-system';
import { useLocale } from '@/lib/i18n';
import type { MessageKey } from '@/lib/i18n';
import { PALETTE } from '../lib/material';
import { selectCurrentGeometryExactV7, selectCurrentStepV7, useEditorV7Store } from '../store-v7';
import { flatElementLabelV7 } from '../v7/flat-content-assets';
import {
  isValidNailPathDataV7,
  type FlatVectorToolV7,
} from '../v7/flat-vector';
import { parseHexColorV7, rgbaToHexV7 } from '../v7/background';
import { FLAT_TOOL_PANEL_MAP_V7, type FlatToolPanelModeV7 } from '../v7/flat-tool-panel-map';
import {
  FRENCH_RECIPE_PRESETS_V1,
  createDefaultFrenchRecipeParametersV1,
  parseFrenchRecipeInstanceV1,
  parseFrenchRecipeParametersV1,
  serializeFrenchRecipeParametersV1,
  type FrenchRecipeDefaultPresetV1,
} from '../v7/french-recipe-v1';

const TOOL_ITEMS: Array<{ tool: FlatVectorToolV7; label: MessageKey; icon: typeof MousePointer2 }> = [
  { tool: 'select', label: 'editor.extra.selectMove', icon: MousePointer2 }, { tool: 'brush', label: 'editor.extra.brush', icon: Paintbrush }, { tool: 'eraser', label: 'editor.extra.eraserMask', icon: Eraser }, { tool: 'line', label: 'editor.extra.line', icon: Minus }, { tool: 'rectangle', label: 'editor.extra.rectangle', icon: RectangleHorizontal }, { tool: 'circle', label: 'editor.extra.circle', icon: Circle }, { tool: 'star', label: 'editor.extra.star', icon: Star }, { tool: 'french', label: 'editor.extra.addFrench', icon: Waves }, { tool: 'region_mask', label: 'editor.extra.regionMask', icon: Scissors }, { tool: 'anchor', label: 'editor.extra.anchorEdit', icon: Focus },
];

const FRENCH_PRESET_COPY_V1: Record<FrenchRecipeDefaultPresetV1, { label: MessageKey; description: MessageKey }> = {
  classic: { label: 'editor.extra.classic', description: 'editor.extra.classicDesc' }, micro: { label: 'editor.extra.microFrench', description: 'editor.extra.microFrenchDesc' }, soft: { label: 'editor.extra.softFrench', description: 'editor.extra.softFrenchDesc' }, deep: { label: 'editor.extra.deepFrench', description: 'editor.extra.deepFrenchDesc' }, pointed: { label: 'editor.extra.pointedFrench', description: 'editor.extra.pointedFrenchDesc' },
};

export type FlatVectorPanelVariantV7 = 'full' | 'resources' | 'inspector';

export function FlatVectorPanelV7({ variant = 'full', panelMode }: { variant?: FlatVectorPanelVariantV7; panelMode?: FlatToolPanelModeV7 }) {
  const { t } = useLocale();
  const toast = useToast();
  const step = useEditorV7Store(selectCurrentStepV7);
  const currentFinger = useEditorV7Store((state) => state.currentFinger);
  const fingerScope = useEditorV7Store((state) => state.fingerScope);
  const selectedFingers = useEditorV7Store((state) => state.selectedFingers);
  const selectedElementId = useEditorV7Store((state) => state.selectedElementId);
  const doc = useEditorV7Store((state) => state.doc);
  const activeTool = useEditorV7Store((state) => state.activeFlatTool);
  const color = useEditorV7Store((state) => state.activeFlatColor);
  const widthMm = useEditorV7Store((state) => state.activeFlatWidthMm);
  const readOnly = useEditorV7Store((state) => state.readOnly);
  const switching = useEditorV7Store((state) => state.switching);
  const geometryExact = useEditorV7Store(selectCurrentGeometryExactV7);
  const setActiveTool = useEditorV7Store((state) => state.setActiveFlatTool);
  const setColor = useEditorV7Store((state) => state.setActiveFlatColor);
  const setWidthMm = useEditorV7Store((state) => state.setActiveFlatWidthMm);
  const selectElement = useEditorV7Store((state) => state.selectElement);
  const createFrenchRecipe = useEditorV7Store((state) => state.createFrenchRecipe);
  const setFingerScope = useEditorV7Store((state) => state.setFingerScope);
  const toggleSelectedFinger = useEditorV7Store((state) => state.toggleSelectedFinger);
  const updateFrenchRecipe = useEditorV7Store((state) => state.updateFrenchRecipe);
  const deleteFrenchRecipe = useEditorV7Store((state) => state.deleteFrenchRecipe);
  const removeElement = useEditorV7Store((state) => state.removeElement);
  const replaceElement = useEditorV7Store((state) => state.replaceFlatElement);
  const setElementOpacity = useEditorV7Store((state) => state.setFlatElementOpacity);
  const confirmLegacyFrenchConversion = useEditorV7Store((state) => state.confirmLegacyFrenchConversion);
  const flatStep = step?.kind === 'flat_design' ? step : null;
  const selectedElement = flatStep?.elements.find((element) => element.id === selectedElementId) ?? null;
  const [opacityDraft, setOpacityDraft] = useState(selectedElement ? Math.round(selectedElement.opacity * 100) : 100);
  const [pathDraft, setPathDraft] = useState(selectedElement?.kind === 'vector_shape' ? selectedElement.pathData : selectedElement?.kind === 'region_mask' ? selectedElement.mask.pathData : '');
  const [frenchWidthDraft, setFrenchWidthDraft] = useState(selectedElement?.kind === 'french_edge' ? selectedElement.widthRatio : 0.22);
  const [frenchCurvatureDraft, setFrenchCurvatureDraft] = useState(selectedElement?.kind === 'french_edge' ? selectedElement.curvature : 0.35);
  const [conversionOpen, setConversionOpen] = useState(false);
  const [conversionPreset, setConversionPreset] = useState<FrenchRecipeDefaultPresetV1 | null>(null);
  const [conversionColor, setConversionColor] = useState('#fffdf9');
  const [frenchDraft, setFrenchDraft] = useState<ReturnType<typeof createDefaultFrenchRecipeParametersV1> | null>(null);
  const [createFrenchOpen, setCreateFrenchOpen] = useState(false);
  const [createPreset, setCreatePreset] = useState<FrenchRecipeDefaultPresetV1>('classic');
  const [createColor, setCreateColor] = useState('#fffdf9');
  const [createOpacity, setCreateOpacity] = useState(100);
  const [deleteFrenchOpen, setDeleteFrenchOpen] = useState(false);
  const lastOpacityCommit = useRef<number | null>(null);
  const lastFrenchWidthCommit = useRef<number | null>(null);
  const lastFrenchCurvatureCommit = useRef<number | null>(null);
  const lastManagedCommit = useRef<string | null>(null);
  const conversionTriggerRef = useRef<HTMLButtonElement>(null);
  const conversionFirstChoiceRef = useRef<HTMLButtonElement>(null);
  const createFrenchTriggerRef = useRef<HTMLButtonElement | null>(null);
  const createFrenchFirstChoiceRef = useRef<HTMLButtonElement>(null);
  const managedCandidate = selectedElement?.kind === 'vector_shape' && flatStep?.recipeInstanceId ? flatStep : null;
  const managedRecipe = managedCandidate?.recipeInstanceId ? doc?.recipeInstances[managedCandidate.recipeInstanceId] : null;
  const parsedManagedInstance = managedRecipe ? parseFrenchRecipeInstanceV1(managedRecipe) : null;
  const managedFrench = parsedManagedInstance?.ok ? managedCandidate : null;
  const parsedManaged = parsedManagedInstance?.ok ? parsedManagedInstance.parameters : null;
  const managedSerialization = parsedManaged ? serializeFrenchRecipeParametersV1(parsedManaged) : null;
  const canEdit = Boolean(flatStep && flatStep.visible && !flatStep.skipped && !readOnly && !switching && geometryExact && (!flatStep.locked || managedFrench));
  const canEditManaged = Boolean(managedFrench && parsedManaged && flatStep?.visible && !flatStep.skipped && !readOnly && !switching && geometryExact);

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
  useEffect(() => {
    setConversionOpen(false);
    setConversionPreset(null);
  }, [currentFinger, selectedElement?.id]);
  useEffect(() => {
    setFrenchDraft(parsedManaged ? structuredClone(parsedManaged) : null);
    lastManagedCommit.current = managedSerialization;
  }, [managedRecipe?.instanceId, managedSerialization]);
  useEffect(() => {
    if (!conversionOpen) return undefined;
    const frame = requestAnimationFrame(() => conversionFirstChoiceRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [conversionOpen]);
  useEffect(() => {
    if (!createFrenchOpen) return undefined;
    const timer = window.setTimeout(() => createFrenchFirstChoiceRef.current?.focus(), 0);
    return () => window.clearTimeout(timer);
  }, [createFrenchOpen]);

  const colorHex = rgbaToHexV7(color);
  const editablePath = selectedElement?.kind === 'vector_shape' || selectedElement?.kind === 'region_mask';
  const selectedLocked = selectedElement?.locked ?? false;
  const canEditSelected = canEdit && Boolean(selectedElement) && !selectedLocked;
  const showResources = variant === 'full' || variant === 'resources';
  const showElementList = variant === 'full';
  const showInspector = variant === 'full' || variant === 'inspector';
  const contextualPanel = panelMode ? FLAT_TOOL_PANEL_MAP_V7[panelMode] : null;
  const visibleToolItems = contextualPanel
    ? TOOL_ITEMS.filter((item) => contextualPanel.tools.includes(item.tool as never))
    : TOOL_ITEMS;
  const showDrawingStyle = showResources && (contextualPanel?.showDrawingStyle ?? true);

  const resultToast = (result: { ok: true } | { ok: false; message: string }) => {
    if (!result.ok) toast.error(result.message);
    return result.ok;
  };

  const closeCreateFrench = () => {
    setCreateFrenchOpen(false);
    queueMicrotask(() => createFrenchTriggerRef.current?.isConnected && createFrenchTriggerRef.current.focus());
  };

  const selectTool = (tool: FlatVectorToolV7, trigger?: HTMLButtonElement) => {
    if (tool === 'french') {
      if (!flatStep || !canEdit) return;
      createFrenchTriggerRef.current = trigger ?? null;
      setCreatePreset('classic');
      setCreateFrenchOpen(true);
      return;
    }
    setActiveTool(tool);
  };

  const commitCreateFrench = () => {
    if (fingerScope === 'selected' && selectedFingers.length === 0) { toast.error(t('editorV7.flat.selectedFingerRequired')); return; }
    const base = createDefaultFrenchRecipeParametersV1(createPreset);
    const result = createFrenchRecipe({ ...base, fillColor: createColor, fillOpacity: createOpacity / 100 });
    if (resultToast(result)) { closeCreateFrench(); setActiveTool('select'); }
  };

  const commitManagedFrench = (next: typeof frenchDraft): boolean => {
    if (!next || !managedFrench || !managedFrench.recipeInstanceId || !canEditManaged) return false;
    const parsed = parseFrenchRecipeParametersV1(next);
    if (!parsed.ok) {
      toast.error(parsed.diagnostics.map((item) => `${item.path}: ${item.message}`).join('; '));
      setFrenchDraft(parsedManaged ? structuredClone(parsedManaged) : null);
      lastManagedCommit.current = managedSerialization;
      return false;
    }
    if (parsed.serialization === managedSerialization || parsed.serialization === lastManagedCommit.current) return true;
    lastManagedCommit.current = parsed.serialization;
    const result = updateFrenchRecipe(managedFrench.id, parsed.parameters);
    if (resultToast(result)) return true;
    lastManagedCommit.current = managedSerialization;
    setFrenchDraft(parsedManaged ? structuredClone(parsedManaged) : null);
    return false;
  };

  const updateManagedGeometryDraft = (patch: Partial<NonNullable<typeof frenchDraft>>) => {
    if (!frenchDraft) return;
    const next = { ...frenchDraft, ...patch, preset: 'custom' as const };
    setFrenchDraft(next);
  };
  const updateManagedAppearanceDraft = (patch: Partial<NonNullable<typeof frenchDraft>>) => {
    if (frenchDraft) setFrenchDraft({ ...frenchDraft, ...patch });
  };
  const commitManagedDraft = () => commitManagedFrench(frenchDraft);
  const managedSeparation = 0.01;
  const managedWingMin = frenchDraft?.variant === 'smooth' ? (frenchDraft.centerV + managedSeparation) : 0.02;
  const managedWingMax = frenchDraft?.variant === 'pointed' ? (frenchDraft.centerV - managedSeparation) : 0.72;
  const clampManagedWing = (value: number) => Math.max(managedWingMin, Math.min(managedWingMax, value));
  const managedAnchorChange = (field: 'leftWingV' | 'centerV' | 'rightWingV', value: number) => {
    if (!frenchDraft) return;
    if (field === 'centerV') {
      const min = frenchDraft.variant === 'pointed' ? Math.max(frenchDraft.leftWingV, frenchDraft.rightWingV) + managedSeparation : 0.02;
      const max = frenchDraft.variant === 'smooth' ? Math.min(frenchDraft.leftWingV, frenchDraft.rightWingV) - managedSeparation : 0.72;
      updateManagedGeometryDraft({ centerV: Math.max(min, Math.min(max, value)) });
      return;
    }
    const bounded = clampManagedWing(value);
    if (frenchDraft.balanceLocked) updateManagedGeometryDraft({ leftWingV: bounded, rightWingV: bounded });
    else updateManagedGeometryDraft({ [field]: bounded } as Partial<NonNullable<typeof frenchDraft>>);
  };
  const managedTipWidth = frenchDraft ? (frenchDraft.leftWingV + frenchDraft.rightWingV) / 2 : 0.22;
  const managedTipWidthChange = (value: number) => {
    if (!frenchDraft) return;
    if (frenchDraft.balanceLocked) {
      const bounded = clampManagedWing(value);
      updateManagedGeometryDraft({ leftWingV: bounded, rightWingV: bounded });
      return;
    }
    const delta = value - managedTipWidth;
    updateManagedGeometryDraft({
      leftWingV: clampManagedWing(frenchDraft.leftWingV + delta),
      rightWingV: clampManagedWing(frenchDraft.rightWingV + delta),
    });
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
      toast.error(t('editorV7.flat.pathInvalid'));
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

  const closeConversion = () => {
    setConversionOpen(false);
    requestAnimationFrame(() => conversionTriggerRef.current?.focus());
  };

  const openConversion = () => {
    if (selectedElement?.kind !== 'french_edge') return;
    setConversionPreset(null);
    setConversionColor(rgbaToHexV7(selectedElement.color));
    setConversionOpen(true);
  };

  const commitLegacyFrenchConversion = () => {
    if (!flatStep || selectedElement?.kind !== 'french_edge' || !conversionPreset || !canEditSelected) return;
    const parameters = {
      ...createDefaultFrenchRecipeParametersV1(conversionPreset),
      fillColor: conversionColor,
      fillOpacity: selectedElement.opacity,
    };
    const result = confirmLegacyFrenchConversion(currentFinger, flatStep.id, selectedElement.id, parameters);
    if (!resultToast(result)) return;
    setConversionOpen(false);
    toast.success(t('editorV7.flat.converted', { preset: t(FRENCH_PRESET_COPY_V1[conversionPreset].label) }));
  };

  if (!flatStep) return null;

  return (
    <div className="mt-2 space-y-3 rounded-xl border border-violet-200 bg-violet-50/55 p-3" data-testid="v7-flat-vector-panel">
      {(variant === 'full' || contextualPanel) && <div>
        <p className="text-nano font-semibold uppercase tracking-[0.12em] text-violet-700">{contextualPanel?.label ?? t('editorV7.flat.vectorTools')}</p>
        <p className="mt-1 text-nano leading-4 text-gray-500">{contextualPanel?.description ?? t('editorV7.flat.vectorDescription', { finger: currentFinger })}</p>
      </div>}

      {showResources && <div className="grid grid-cols-2 gap-1.5" role="toolbar" aria-label={t('editorV7.flat.vectorTools')}>
        {visibleToolItems.map(({ tool, label, icon: Icon }) => (
          <button
            key={tool}
            type="button"
            disabled={!canEdit && tool !== 'select'}
            aria-pressed={activeTool === tool}
            onClick={(event) => selectTool(tool, event.currentTarget)}
            className={cx(
              'flex min-h-11 min-w-0 items-center gap-2 rounded-lg border px-2 text-left text-nano focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-40',
              activeTool === tool ? 'border-violet-500 bg-violet-600 text-white' : 'border-gray-200 bg-white text-gray-700 hover:border-violet-300',
            )}
          >
            <Icon size={14} className="shrink-0" />
            <span className="truncate">{label}</span>
          </button>
        ))}
      </div>}

      {showDrawingStyle && <fieldset disabled={!canEdit} className="space-y-2 disabled:opacity-45">
        <legend className="text-nano font-semibold text-gray-600">{t('editorV7.flat.drawingStyle')}</legend>
        <div className="grid grid-cols-5 gap-1.5">
          {PALETTE.slice(0, 5).map((item) => (
            <button
              key={item.id}
              type="button"
              title={item.name}
              aria-label={t('editorV7.flat.drawingColor', { color: item.name })}
              aria-pressed={item.hex.toLowerCase() === colorHex}
              onClick={() => { const next = parseHexColorV7(item.hex); if (next) setColor(next); }}
              className={cx('h-9 rounded-full border border-gray-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary', item.hex.toLowerCase() === colorHex && 'ring-2 ring-violet-500 ring-offset-1')}
              style={{ backgroundColor: item.hex }}
            />
          ))}
        </div>
        <div className="grid grid-cols-[44px_1fr] items-center gap-2">
          <input type="color" value={colorHex} aria-label={t('editorV7.flat.customColor')} onChange={(event) => { const next = parseHexColorV7(event.target.value); if (next) setColor(next); }} className="h-11 w-11 rounded-lg border border-gray-300 bg-white p-1" />
          <label className="grid grid-cols-[1fr_auto] items-center gap-2 text-nano text-gray-600">
            <input type="range" min="0.05" max="3" step="0.05" value={widthMm} aria-label={t('editorV7.flat.brushWidth')} onChange={(event) => setWidthMm(Number(event.target.value))} className="h-11 w-full accent-violet-600" />
            <span className="w-12 text-right tabular-nums">{widthMm.toFixed(2)} {t('common.mm')}</span>
          </label>
        </div>
        <output className="sr-only" data-flat-color={colorHex} data-flat-width-mm={widthMm} />
      </fieldset>}

      {showElementList && <div className="rounded-lg border border-gray-200 bg-white p-2">
        <div className="flex items-center justify-between gap-2">
          <p className="text-nano font-semibold text-gray-700">{t('editorV7.flat.elementCount', { count: flatStep.elements.length })}</p>
          <button type="button" disabled={!canEditSelected} onClick={() => selectedElement && resultToast(removeElement(currentFinger, flatStep.id, selectedElement.id))} className="inline-flex min-h-9 min-w-9 items-center justify-center rounded-lg text-gray-500 hover:bg-red-50 hover:text-error disabled:opacity-35" aria-label={t('editorV7.flat.deleteSelected')}><Trash2 size={14} /></button>
        </div>
        <div className="mt-1.5 max-h-36 space-y-1 overflow-y-auto" aria-label={t('editorV7.flat.elementList')}>
          {flatStep.elements.length === 0 && <p className="rounded-md border border-dashed border-gray-200 px-2 py-3 text-center text-nano text-gray-400">{t('editorV7.flat.emptyElements')}</p>}
          {flatStep.elements.map((element, index) => (
            <button key={element.id} type="button" onClick={() => { selectElement(element.id); setActiveTool('select'); }} className={cx('flex min-h-9 w-full items-center gap-2 rounded-md px-2 text-left text-nano', selectedElementId === element.id ? 'bg-violet-100 font-semibold text-violet-800' : 'text-gray-600 hover:bg-gray-50')}>
              <span className="w-5 tabular-nums text-gray-400">{index + 1}</span>
              <span className="min-w-0 flex-1 truncate">{flatElementLabelV7(element)}</span>
              {element.locked && <span className="text-nano text-gray-400">{t('editorV7.layers.lock')}</span>}
            </button>
          ))}
        </div>
      </div>}

      {showInspector && selectedElement && (
        <div className="space-y-2 rounded-lg border border-violet-200 bg-white p-2.5">
          <div className="flex items-center gap-2 text-nano font-semibold text-violet-800"><Hand size={13} />{t('editorV7.flat.selectedElement')}：{flatElementLabelV7(selectedElement)}</div>
          {!managedFrench && <label className="grid grid-cols-[auto_1fr_auto] items-center gap-2 text-nano text-gray-600">
            {t('editorV7.flat.opacity')}
            <input type="range" min="0" max="100" step="1" value={opacityDraft} disabled={!canEditSelected} onChange={(event) => setOpacityDraft(Number(event.target.value))} onPointerUp={commitOpacity} onKeyUp={commitOpacity} onBlur={commitOpacity} className="h-11 w-full accent-violet-600 disabled:opacity-40" />
            <span className="w-9 text-right tabular-nums">{opacityDraft}{t('common.percent')}</span>
          </label>}
          {managedFrench && frenchDraft && (
            <section className="space-y-2 rounded-lg border border-violet-200 bg-violet-50/60 p-2.5" data-testid="v7-managed-french-panel">
              <div className="flex items-center justify-between gap-2"><strong className="text-nano text-violet-900">{t('editorV7.flat.structuredFrench')}</strong><button type="button" disabled={!canEditManaged} className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg text-error hover:bg-red-50 disabled:opacity-40" aria-label={t('editorV7.flat.deleteStructuredFrench')} onClick={() => setDeleteFrenchOpen(true)}><Trash2 size={14} /></button></div>
              <div className="grid grid-cols-4 gap-1.5">{(['current', 'selected', 'mirror', 'all'] as const).map((scope) => <button key={scope} type="button" disabled={!canEditManaged} className={cx('min-h-11 rounded-lg border px-1 text-nano disabled:opacity-40', fingerScope === scope ? 'border-violet-500 bg-violet-100 font-semibold' : 'border-gray-200 bg-white')} onClick={() => setFingerScope(scope)} data-testid={`v7-managed-french-scope-${scope}`}>{t(`editorV7.flat.scope.${scope}` as never)}</button>)}</div>
              {fingerScope === 'selected' && <div className="grid grid-cols-5 gap-1">{(['L1','L2','L3','L4','L5','R1','R2','R3','R4','R5'] as const).map((finger) => <button key={finger} type="button" disabled={!canEditManaged} aria-pressed={selectedFingers.includes(finger)} onClick={() => toggleSelectedFinger(finger)} className={cx('min-h-11 rounded border text-nano disabled:opacity-40', selectedFingers.includes(finger) ? 'border-violet-500 bg-violet-100 font-semibold' : 'border-gray-200 bg-white')}>{finger}</button>)}</div>}
              <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
              {FRENCH_RECIPE_PRESETS_V1.map((preset) => <button key={preset} type="button" disabled={!canEditManaged} className={cx('min-h-11 rounded-lg border px-2 text-left text-nano disabled:opacity-40', frenchDraft.preset === preset ? 'border-violet-500 bg-white font-semibold text-violet-900' : 'border-gray-200 bg-white text-gray-600')} onClick={() => { const next = { ...frenchDraft, ...createDefaultFrenchRecipeParametersV1(preset), fillColor: frenchDraft.fillColor, fillOpacity: frenchDraft.fillOpacity, outlineColor: frenchDraft.outlineColor }; setFrenchDraft(next); if (commitManagedFrench(next)) toast.success(t('editorV7.flat.resetGeometry')); }} data-testid={`v7-managed-french-preset-${preset}`}>{t(FRENCH_PRESET_COPY_V1[preset].label)}</button>)}
              </div>
              <label className="flex min-h-11 items-center justify-between gap-2 rounded-lg border border-gray-200 bg-white px-2 text-nano text-gray-700">{t('editorV7.flat.fillColor')}<input type="color" disabled={!canEditManaged} value={frenchDraft.fillColor} onChange={(event) => updateManagedAppearanceDraft({ fillColor: event.target.value })} onBlur={commitManagedDraft} onKeyDown={(event) => { if (event.key === 'Enter') commitManagedDraft(); }} className="h-9 w-11 rounded border p-1 disabled:opacity-40" data-testid="v7-managed-french-color" /></label>
              <label className="grid min-h-11 grid-cols-[auto_1fr_auto] items-center gap-2 text-nano text-gray-600">{t('editorV7.flat.opacity')}<input type="range" min="0" max="1" step="0.01" disabled={!canEditManaged} value={frenchDraft.fillOpacity} onChange={(event) => updateManagedAppearanceDraft({ fillOpacity: Number(event.target.value) })} onPointerUp={commitManagedDraft} onBlur={commitManagedDraft} onKeyDown={(event) => { if (event.key === 'Enter') commitManagedDraft(); }} className="h-11 w-full accent-violet-600 disabled:opacity-40" data-testid="v7-managed-french-opacity" /><span>{Math.round(frenchDraft.fillOpacity * 100)}{t('common.percent')}</span></label>
              <label className="flex min-h-11 items-center gap-2 text-nano text-gray-700"><input type="checkbox" disabled={!canEditManaged} checked={frenchDraft.balanceLocked} onChange={(event) => { const locked = event.target.checked; const next = locked ? { ...frenchDraft, balanceLocked: true, rightWingV: frenchDraft.leftWingV, preset: 'custom' as const } : { ...frenchDraft, balanceLocked: false, preset: 'custom' as const }; setFrenchDraft(next); commitManagedFrench(next); }} className="h-5 w-5" />{t('editorV7.flat.lockBalance')}</label>
              <label className="grid min-h-11 grid-cols-[auto_1fr_auto] items-center gap-2 text-nano text-gray-600">{t('editorV7.flat.tipWidth')}<input type="range" min={managedWingMin} max={managedWingMax} step="0.01" disabled={!canEditManaged} value={managedTipWidth} onChange={(event) => managedTipWidthChange(Number(event.target.value))} onPointerUp={commitManagedDraft} onBlur={commitManagedDraft} onKeyDown={(event) => { if (event.key === 'Enter') commitManagedDraft(); }} className="h-11 w-full accent-violet-600 disabled:opacity-40" data-testid="v7-managed-french-tip-width" /><span>{managedTipWidth.toFixed(2)}</span></label>
              <label className="grid min-h-11 grid-cols-[auto_1fr_auto] items-center gap-2 text-nano text-gray-600">{t('editorV7.flat.leftWing')}<input type="range" min={managedWingMin} max={managedWingMax} step="0.01" disabled={!canEditManaged} value={frenchDraft.leftWingV} onChange={(event) => managedAnchorChange('leftWingV', Number(event.target.value))} onPointerUp={commitManagedDraft} onBlur={commitManagedDraft} onKeyDown={(event) => { if (event.key === 'Enter') commitManagedDraft(); }} className="h-11 w-full accent-violet-600 disabled:opacity-40" data-testid="v7-managed-french-left-wing" /><span>{frenchDraft.leftWingV.toFixed(2)}</span></label>
              <label className="grid min-h-11 grid-cols-[auto_1fr_auto] items-center gap-2 text-nano text-gray-600">{t('editorV7.flat.center')}<input type="range" min={frenchDraft.variant === 'pointed' ? Math.max(frenchDraft.leftWingV, frenchDraft.rightWingV) + managedSeparation : 0.02} max={frenchDraft.variant === 'smooth' ? Math.min(frenchDraft.leftWingV, frenchDraft.rightWingV) - managedSeparation : 0.72} step="0.01" disabled={!canEditManaged} value={frenchDraft.centerV} onChange={(event) => managedAnchorChange('centerV', Number(event.target.value))} onPointerUp={commitManagedDraft} onBlur={commitManagedDraft} onKeyDown={(event) => { if (event.key === 'Enter') commitManagedDraft(); }} className="h-11 w-full accent-violet-600 disabled:opacity-40" data-testid="v7-managed-french-center" /><span>{frenchDraft.centerV.toFixed(2)}</span></label>
              <label className="grid min-h-11 grid-cols-[auto_1fr_auto] items-center gap-2 text-nano text-gray-600">{t('editorV7.flat.rightWing')}<input type="range" min={managedWingMin} max={managedWingMax} step="0.01" disabled={!canEditManaged} value={frenchDraft.rightWingV} onChange={(event) => managedAnchorChange('rightWingV', Number(event.target.value))} onPointerUp={commitManagedDraft} onBlur={commitManagedDraft} onKeyDown={(event) => { if (event.key === 'Enter') commitManagedDraft(); }} className="h-11 w-full accent-violet-600 disabled:opacity-40" data-testid="v7-managed-french-right-wing" /><span>{frenchDraft.rightWingV.toFixed(2)}</span></label>
              <p className="text-nano leading-4 text-gray-500">{t('editorV7.flat.managedHint')}</p>
            </section>
          )}
          {selectedElement.kind === 'french_edge' && (
            <>
              <section className="space-y-2 rounded-lg border border-amber-200 bg-amber-50 p-2.5" role="status" data-testid="v7-legacy-french-conversion-notice">
                <div className="flex items-start gap-2">
                  <AlertTriangle size={15} className="mt-0.5 shrink-0 text-amber-700" />
                  <div className="min-w-0">
                    <p className="text-nano font-semibold text-amber-950">{t('editorV7.flat.legacyTitle')}</p>
                    <p className="mt-1 text-nano leading-4 text-amber-900">{t('editorV7.flat.legacyDescription')}</p>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-1 rounded-md bg-white/75 px-2 py-1.5 text-center text-nano text-amber-950" aria-label={t('editorV7.flat.legacyEvidence')}>
                  <span><strong className="block font-semibold">{t('editorV7.flat.width')}</strong>{Math.round(selectedElement.widthRatio * 100)}{t('common.percent')}</span>
                  <span><strong className="block font-semibold">{t('editorV7.flat.curvature')}</strong>{selectedElement.curvature.toFixed(2)}</span>
                  <span><strong className="block font-semibold">{t('editorV7.flat.color')}</strong><span className="font-mono">{rgbaToHexV7(selectedElement.color)}</span></span>
                </div>
                <button
                  ref={conversionTriggerRef}
                  type="button"
                  disabled={!canEditSelected}
                  aria-haspopup="dialog"
                  onClick={openConversion}
                  className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-amber-300 bg-white px-3 text-nano font-semibold text-amber-950 transition-colors hover:bg-amber-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 disabled:cursor-not-allowed disabled:opacity-45"
                  data-testid="v7-legacy-french-convert"
                >
                  {t('editorV7.flat.convert')} <ArrowRight size={14} />
                </button>
                {!geometryExact && <p className="text-nano leading-4 text-amber-900">{t('editorV7.flat.geometryGate')}</p>}
              </section>
              <label className="grid grid-cols-[auto_1fr_auto] items-center gap-2 text-nano text-gray-600">{t('editorV7.flat.width')}<input type="range" min="0" max="1" step="0.01" value={frenchWidthDraft} disabled={!canEditSelected} onChange={(event) => setFrenchWidthDraft(Number(event.target.value))} onPointerUp={() => commitFrench('widthRatio')} onKeyUp={() => commitFrench('widthRatio')} onBlur={() => commitFrench('widthRatio')} className="h-11 accent-violet-600" /><span>{Math.round(frenchWidthDraft * 100)}{t('common.percent')}</span></label>
              <label className="grid grid-cols-[auto_1fr_auto] items-center gap-2 text-nano text-gray-600">{t('editorV7.flat.curvature')}<input type="range" min="-1" max="1" step="0.05" value={frenchCurvatureDraft} disabled={!canEditSelected} onChange={(event) => setFrenchCurvatureDraft(Number(event.target.value))} onPointerUp={() => commitFrench('curvature')} onKeyUp={() => commitFrench('curvature')} onBlur={() => commitFrench('curvature')} className="h-11 accent-violet-600" /><span>{frenchCurvatureDraft.toFixed(2)}</span></label>
            </>
          )}
          {!managedFrench && editablePath && (
            <div>
              <label className="text-nano font-semibold text-gray-600" htmlFor="v7-path-data">{t('editorV7.flat.pathLabel')}</label>
              <textarea id="v7-path-data" value={pathDraft} disabled={!canEditSelected} onChange={(event) => setPathDraft(event.target.value)} onBlur={commitPath} rows={3} className="mt-1 w-full resize-y rounded-lg border border-gray-300 px-2 py-1.5 font-mono text-nano leading-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-45" />
              <p className="mt-1 text-nano leading-3.5 text-gray-500">{t('editorV7.flat.pathHint')}</p>
            </div>
          )}
        </div>
      )}

      {showInspector && <p className="rounded-lg border border-dashed border-gray-300 bg-white px-2.5 py-2 text-nano leading-3.5 text-gray-500">
        {t('editorV7.flat.inspectorHint')}
      </p>}

      {selectedElement?.kind === 'french_edge' && <Modal
        open={conversionOpen}
        onClose={closeConversion}
        title={t('editorV7.flat.convertTitle')}
        size="md"
        closeOnOverlay
        layer="workspace"
        footer={<>
          <Button type="button" variant="secondary" onClick={closeConversion} data-testid="v7-french-conversion-cancel">{t('editorV7.flat.keepLegacy')}</Button>
          <Button type="button" disabled={!conversionPreset || !canEditSelected} onClick={commitLegacyFrenchConversion} data-testid="v7-french-conversion-confirm">{t('editorV7.flat.confirmConvert')}</Button>
        </>}
      >
        <div className="space-y-4" data-testid="v7-legacy-french-dialog">
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs leading-5 text-amber-950">
            {t('editorV7.flat.convertDescription')}
          </div>
          <fieldset>
            <legend className="text-xs font-semibold text-gray-800">{t('editorV7.flat.selectPreset')}</legend>
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {FRENCH_RECIPE_PRESETS_V1.map((preset, index) => {
                const copy = FRENCH_PRESET_COPY_V1[preset];
                const selected = conversionPreset === preset;
                return <button
                  ref={index === 0 ? conversionFirstChoiceRef : undefined}
                  key={preset}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setConversionPreset(preset)}
                  className={cx(
                    'min-h-[56px] rounded-lg border px-2 py-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                    selected ? 'border-violet-500 bg-violet-50 text-violet-950' : 'border-gray-200 bg-white text-gray-700 hover:border-violet-300',
                  )}
                  data-testid={`v7-french-preset-${preset}`}
                >
                  <strong className="block text-xs">{t(copy.label)}</strong>
                  <span className="mt-0.5 block text-nano leading-4 text-gray-500">{t(copy.description)}</span>
                </button>;
              })}
            </div>
          </fieldset>
          <label className="flex min-h-11 items-center justify-between gap-3 rounded-lg border border-gray-200 px-3 py-2 text-xs text-gray-700">
            <span><strong className="block font-semibold text-gray-800">{t('editorV7.flat.confirmFill')}</strong><span className="mt-0.5 block text-nano text-gray-500">{t('editorV7.flat.oldColorHint')}</span></span>
            <span className="flex items-center gap-2"><span className="font-mono text-nano">{conversionColor}</span><input type="color" value={conversionColor} onChange={(event) => setConversionColor(event.target.value)} aria-label={t('editorV7.flat.fillColor')} className="h-10 w-11 rounded-lg border border-gray-300 bg-white p-1" data-testid="v7-french-conversion-color" /></span>
          </label>
          <p className="text-nano leading-4 text-gray-500">{t('editorV7.flat.fillHint', { opacity: Math.round(selectedElement.opacity * 100) })}</p>
        </div>
      </Modal>}
      <Modal open={createFrenchOpen} onClose={closeCreateFrench} title={t('editorV7.flat.createTitle')} size="md" closeOnOverlay layer="workspace" footer={<><Button type="button" variant="secondary" onClick={closeCreateFrench}>{t('editorV7.flat.cancel')}</Button><Button type="button" disabled={!canEdit || (fingerScope === 'selected' && selectedFingers.length === 0)} onClick={commitCreateFrench} data-testid="v7-managed-french-create-confirm">{t('editorV7.flat.confirmAdd')}</Button></>}>
        <div className="space-y-3" data-testid="v7-managed-french-create-dialog">
          <p className="rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-nano leading-4 text-violet-900">{t('editorV7.flat.createDescription')}</p>
          <fieldset><legend className="text-nano font-semibold text-gray-800">{t('editorV7.flat.presetRequired')}</legend><div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">{FRENCH_RECIPE_PRESETS_V1.map((preset, index) => <button ref={index === 0 ? createFrenchFirstChoiceRef : undefined} autoFocus={index === 0} key={preset} type="button" aria-pressed={createPreset === preset} onClick={() => setCreatePreset(preset)} className={cx('min-h-[56px] rounded-lg border px-2 text-left text-nano', createPreset === preset ? 'border-violet-500 bg-violet-50 font-semibold' : 'border-gray-200 bg-white')} data-testid={`v7-managed-french-create-preset-${preset}`}>{t(FRENCH_PRESET_COPY_V1[preset].label)}<span className="mt-0.5 block text-nano font-normal text-gray-500">{FRENCH_PRESET_COPY_V1[preset].description}</span></button>)}</div></fieldset>
          <fieldset><legend className="text-nano font-semibold text-gray-800">{t('editorV7.flat.scopeTitle')}</legend><div className="mt-2 grid grid-cols-4 gap-1.5">{(['current', 'selected', 'mirror', 'all'] as const).map((scope) => <button key={scope} type="button" className={cx('min-h-11 rounded-lg border px-2 text-nano', fingerScope === scope ? 'border-violet-500 bg-violet-100 font-semibold' : 'border-gray-200 bg-white')} onClick={() => setFingerScope(scope)} data-testid={`v7-managed-french-create-scope-${scope}`}>{t(`editorV7.flat.scope.${scope}` as never)}</button>)}</div>{fingerScope === 'selected' && <div className="mt-2 grid grid-cols-5 gap-1">{(['L1','L2','L3','L4','L5','R1','R2','R3','R4','R5'] as const).map((finger) => <button key={finger} type="button" aria-pressed={selectedFingers.includes(finger)} onClick={() => toggleSelectedFinger(finger)} className={cx('min-h-11 rounded border text-nano', selectedFingers.includes(finger) ? 'border-violet-500 bg-violet-100 font-semibold' : 'border-gray-200 bg-white')}>{finger}</button>)}</div>}</fieldset>
          <label className="flex min-h-11 items-center justify-between rounded-lg border border-gray-200 bg-white px-2 text-nano">{t('editorV7.flat.fillColor')}<input type="color" value={createColor} onChange={(event) => setCreateColor(event.target.value)} className="h-11 w-11 rounded border p-1" data-testid="v7-managed-french-create-color" /></label>
          <label className="grid min-h-11 grid-cols-[auto_1fr_auto] items-center gap-2 text-nano">{t('editorV7.flat.opacity')}<input type="range" min="0" max="100" step="1" value={createOpacity} onChange={(event) => setCreateOpacity(Number(event.target.value))} className="h-11 w-full accent-violet-600" data-testid="v7-managed-french-create-opacity" /><span>{createOpacity}{t('common.percent')}</span></label>
          {fingerScope === 'selected' && selectedFingers.length === 0 && <p role="alert" className="text-nano text-error">{t('editorV7.flat.selectedEmpty')}</p>}
          {!canEdit && <p role="alert" className="text-nano text-error">{t('editorV7.flat.createDisabled')}</p>}
          <p className="text-nano text-gray-500">{t('editorV7.flat.draftHint')}</p>
        </div>
      </Modal>
      <Modal open={deleteFrenchOpen} onClose={() => setDeleteFrenchOpen(false)} title={t('editorV7.flat.deleteTitle')} size="sm" layer="workspace" footer={<><Button type="button" variant="secondary" onClick={() => setDeleteFrenchOpen(false)}>{t('editorV7.flat.cancel')}</Button><Button type="button" variant="danger" disabled={!canEditManaged} onClick={() => { if (resultToast(deleteFrenchRecipe(managedFrench?.id ?? ''))) setDeleteFrenchOpen(false); }}>{t('editorV7.flat.confirmDelete')}</Button></>}>
        <p className="text-sm leading-5 text-gray-700">{t('editorV7.flat.deleteDescription')}</p>
      </Modal>
    </div>
  );
}
