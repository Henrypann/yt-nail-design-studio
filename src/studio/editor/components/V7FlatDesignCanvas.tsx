import { Fragment, useId, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { EyeOff, Info, Lock } from 'lucide-react';
import { useToast } from '@/design-system';
import { selectCurrentNailV7, selectCurrentStepV7, useEditorV7Store } from '../store-v7';
import { resolveBackgroundPreviewModelV7, resolveBackgroundSilhouetteV7 } from '../v7/background';
import { generateEditorV7Id } from '../v7/id';
import type { FlatDesignElementV7, NailPointV7, RegionMaskV7, Transform2DV7 } from '../v7/model';
import {
  circlePathDataV7,
  createPointerFlatElementV7,
  createRegionMaskFlatElementV7,
  createVectorFlatElementV7,
  inverseTransformNailPointV7,
  linePathDataV7,
  moveNailPathAnchorV7,
  nailPathAnchorsV7,
  parseNailPathDataV7,
  rectanglePathDataV7,
  resolveFlatElementMaskScopeV7,
  starPathDataV7,
  transformNailPointV7,
} from '../v7/flat-vector';
import { FlatContentArtworkV7, type FlatContentImportResolverV7 } from './FlatContentArtworkV7';
import { adaptFrenchFlatStepV1 } from '../v7/french-render-adapter-v1';

const CANVAS_WIDTH = 100;
const CANVAS_HEIGHT = 160;
// 160 SVG units represent the approximately 20 mm preview height. This is a
// display conversion only; canonical widths remain physical millimetres.
const MM_TO_CANVAS_UNITS = 8;
type DrawState =
  | { mode: 'draw'; pointerId: number; points: NailPointV7[] }
  | { mode: 'move'; pointerId: number; start: NailPointV7; element: FlatDesignElementV7; transform: Transform2DV7 }
  | { mode: 'anchor'; pointerId: number; anchorIndex: number; element: Extract<FlatDesignElementV7, { kind: 'vector_shape' }>; pathData: string }
  | null;

function rgba(color: { r: number; g: number; b: number; a: number }, opacity = 1): string {
  return `rgb(${color.r} ${color.g} ${color.b} / ${color.a * opacity})`;
}

function canvasPolyline(points: readonly NailPointV7[]): string {
  return points.map((point) => `${point.u * CANVAS_WIDTH},${point.v * CANVAS_HEIGHT}`).join(' ');
}

function canvasPath(pathData: string): string {
  const parsed = parseNailPathDataV7(pathData);
  if (!parsed) return '';
  return parsed.commands.map(({ command, values }) => {
    const scaled = values.map((value, index) => value * (index % 2 === 0 ? CANVAS_WIDTH : CANVAS_HEIGHT));
    return scaled.length > 0 ? `${command}${scaled.join(' ')}` : command;
  }).join(' ');
}

function silhouetteToCanvasTransform(viewBox: string): string {
  const values = viewBox.trim().split(/[\s,]+/).map(Number);
  if (values.length !== 4 || values.some((value) => !Number.isFinite(value)) || values[2] <= 0 || values[3] <= 0) return '';
  const [x, y, width, height] = values;
  return `scale(${CANVAS_WIDTH / width} ${CANVAS_HEIGHT / height}) translate(${-x} ${-y})`;
}

function transformedElement(element: FlatDesignElementV7, child: ReactNode): ReactNode {
  const { position, scaleX, scaleY, rotationDeg } = element.transform;
  return (
    <g transform={`translate(${position.u * CANVAS_WIDTH} ${position.v * CANVAS_HEIGHT}) rotate(${rotationDeg}) scale(${scaleX} ${scaleY}) translate(${-CANVAS_WIDTH / 2} ${-CANVAS_HEIGHT / 2})`}>
      {child}
    </g>
  );
}

function renderElement(element: FlatDesignElementV7, instanceId: string, resolveImported: FlatContentImportResolverV7): ReactNode {
  if (!element.visible || element.kind === 'eraser_mask' || element.kind === 'region_mask') return null;
  if (element.kind === 'brush_stroke') {
    return transformedElement(element, <polyline points={canvasPolyline(element.points)} fill="none" stroke={rgba(element.color, element.opacity)} strokeWidth={element.widthMm * MM_TO_CANVAS_UNITS} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />);
  }
  if (element.kind === 'vector_shape') {
    return transformedElement(element, <path d={canvasPath(element.pathData)} fill={element.fill ? rgba(element.fill, element.opacity) : 'none'} stroke={element.stroke ? rgba(element.stroke, element.opacity) : 'none'} strokeWidth={(element.strokeWidthMm ?? 0) * MM_TO_CANVAS_UNITS} vectorEffect="non-scaling-stroke" />);
  }
  if (element.kind === 'french_edge') {
    const edge = Math.min(0.95, Math.max(0, element.widthRatio));
    const control = Math.min(1, Math.max(0, edge + element.curvature * 0.18));
    return transformedElement(element, <path d={`M0 0 L${CANVAS_WIDTH} 0 L${CANVAS_WIDTH} ${edge * CANVAS_HEIGHT} Q${CANVAS_WIDTH / 2} ${control * CANVAS_HEIGHT} 0 ${edge * CANVAS_HEIGHT} Z`} fill={rgba(element.color, element.opacity)} />);
  }
  if (element.kind === 'text' || element.kind === 'image_2d') {
    return transformedElement(element, <FlatContentArtworkV7 element={element} instanceId={instanceId} resolveImported={resolveImported} />);
  }
  return null;
}

function MaskShape({ mask, tone }: { mask: RegionMaskV7; tone: string }) {
  return <path d={canvasPath(mask.pathData)} fill={tone} fillRule={mask.fillRule} />;
}

export function V7FlatDesignCanvas() {
  const toast = useToast();
  const rawId = useId().replace(/:/g, '');
  const svgRef = useRef<SVGSVGElement>(null);
  const nail = useEditorV7Store(selectCurrentNailV7);
  const step = useEditorV7Store(selectCurrentStepV7);
  const editorDoc = useEditorV7Store((state) => state.doc);
  const currentFinger = useEditorV7Store((state) => state.currentFinger);
  const selectedElementId = useEditorV7Store((state) => state.selectedElementId);
  const activeTool = useEditorV7Store((state) => state.activeFlatTool);
  const color = useEditorV7Store((state) => state.activeFlatColor);
  const widthMm = useEditorV7Store((state) => state.activeFlatWidthMm);
  const readOnly = useEditorV7Store((state) => state.readOnly);
  const switching = useEditorV7Store((state) => state.switching);
  const selectElement = useEditorV7Store((state) => state.selectElement);
  const addElement = useEditorV7Store((state) => state.addElement);
  const replaceElement = useEditorV7Store((state) => state.replaceFlatElement);
  const setTransform = useEditorV7Store((state) => state.setElementTransform);
  const resolveFlatAsset = useEditorV7Store((state) => state.resolveFlatAsset);
  const [gesture, setGesture] = useState<DrawState>(null);
  const [draftTransform, setDraftTransform] = useState<Transform2DV7 | null>(null);
  const flatStep = step?.kind === 'flat_design' ? step : null;
  const backgroundStep = nail?.steps[0];
  const background = backgroundStep?.kind === 'background' ? backgroundStep : null;
  const selectedElement = flatStep?.elements.find((element) => element.id === selectedElementId) ?? null;
  const silhouette = nail ? resolveBackgroundSilhouetteV7(nail.geometryRef, nail.finger) : null;
  const canEdit = Boolean(flatStep && flatStep.visible && !flatStep.skipped && !flatStep.locked && !readOnly && !switching && silhouette?.fidelity === 'exact');
  const backgroundPreview = background ? resolveBackgroundPreviewModelV7(background.background, background.visible) : null;
  const clipId = `${rawId}-geometry`;
  const stepMaskId = `${rawId}-step-mask`;
  const silhouetteTransform = silhouette ? silhouetteToCanvasTransform(silhouette.viewBox) : '';

  const pointFromEvent = (event: ReactPointerEvent<SVGSVGElement | SVGElement>): NailPointV7 => {
    const svg = svgRef.current;
    const matrix = svg?.getScreenCTM();
    if (!svg || !matrix) return { u: 0.5, v: 0.5 };
    const clientPoint = svg.createSVGPoint();
    clientPoint.x = event.clientX;
    clientPoint.y = event.clientY;
    const local = clientPoint.matrixTransform(matrix.inverse());
    return {
      u: Math.min(1, Math.max(0, local.x / CANVAS_WIDTH)),
      v: Math.min(1, Math.max(0, local.y / CANVAS_HEIGHT)),
    };
  };

  const draftPath = useMemo(() => {
    if (gesture?.mode !== 'draw' || gesture.points.length < 2) return null;
    const [start] = gesture.points;
    const end = gesture.points[gesture.points.length - 1];
    if (activeTool === 'line') return linePathDataV7(start, end);
    if (activeTool === 'rectangle' || activeTool === 'region_mask') return rectanglePathDataV7(start, end);
    if (activeTool === 'circle') return circlePathDataV7(start, end);
    if (activeTool === 'star') return starPathDataV7(start, end);
    return null;
  }, [activeTool, gesture]);

  if (!nail || !flatStep || !background || !silhouette || !backgroundPreview) return null;
  const frenchAdapter = adaptFrenchFlatStepV1({ consumer: 'editor-flat', finger: nail.finger, nail, step: flatStep, recipeInstances: editorDoc?.recipeInstances ?? {}, allNails: editorDoc?.nails });
  const renderFlatStep = frenchAdapter.status === 'structured' ? frenchAdapter.step : frenchAdapter.status === 'unavailable' ? { ...flatStep, elements: [] } : flatStep;

  const report = (result: { ok: true } | { ok: false; message: string }) => {
    if (!result.ok) toast.error(result.message);
    return result.ok;
  };

  const finishDraw = (points: NailPointV7[]) => {
    const id = generateEditorV7Id('element');
    let element: FlatDesignElementV7 | null = null;
    if (activeTool === 'brush' || activeTool === 'eraser') {
      element = createPointerFlatElementV7({ id, tool: activeTool, points, color, widthMm });
    } else if (draftPath) {
      element = activeTool === 'region_mask'
        ? createRegionMaskFlatElementV7(id, draftPath)
        : createVectorFlatElementV7({ id, pathData: draftPath, color, appearance: activeTool === 'line' ? 'stroke' : 'fill', strokeWidthMm: widthMm });
    }
    if (!element) {
      toast.error('绘制距离太短，未创建元素。');
      return;
    }
    if (report(addElement(currentFinger, flatStep.id, element))) selectElement(element.id);
  };

  const onPointerDown = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (!canEdit || activeTool === 'select' || activeTool === 'anchor' || activeTool === 'french') {
      if (activeTool === 'select') selectElement(null);
      return;
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    setGesture({ mode: 'draw', pointerId: event.pointerId, points: [pointFromEvent(event)] });
  };

  const onPointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    const point = pointFromEvent(event);
    if (gesture.mode === 'draw') {
      const nextPoints = activeTool === 'brush' || activeTool === 'eraser' ? [...gesture.points, point] : [gesture.points[0], point];
      setGesture({ ...gesture, points: nextPoints });
    } else if (gesture.mode === 'move') {
      const transform = {
        ...gesture.transform,
        position: {
          u: Math.min(1, Math.max(0, gesture.transform.position.u + point.u - gesture.start.u)),
          v: Math.min(1, Math.max(0, gesture.transform.position.v + point.v - gesture.start.v)),
        },
      };
      setDraftTransform(transform);
    } else {
      const localPoint = inverseTransformNailPointV7(point, gesture.element.transform);
      const pathData = moveNailPathAnchorV7(gesture.element.pathData, gesture.anchorIndex, localPoint);
      if (pathData) setGesture({ ...gesture, pathData });
    }
  };

  const onPointerUp = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    if (gesture.mode === 'draw') finishDraw(gesture.points);
    if (gesture.mode === 'move' && draftTransform && JSON.stringify(draftTransform) !== JSON.stringify(gesture.transform)) report(setTransform(currentFinger, flatStep.id, gesture.element.id, draftTransform));
    if (gesture.mode === 'anchor' && gesture.pathData !== gesture.element.pathData) report(replaceElement(currentFinger, flatStep.id, gesture.element.id, { ...gesture.element, pathData: gesture.pathData }));
    setGesture(null);
    setDraftTransform(null);
  };

  const beginElementPointer = (event: ReactPointerEvent<SVGGElement>, element: FlatDesignElementV7) => {
    if (activeTool !== 'select') return;
    event.stopPropagation();
    selectElement(element.id);
    if (!canEdit || element.locked) return;
    svgRef.current?.setPointerCapture(event.pointerId);
    setGesture({ mode: 'move', pointerId: event.pointerId, start: pointFromEvent(event), element, transform: structuredClone(element.transform) });
    setDraftTransform(structuredClone(element.transform));
  };

  const effectiveElement = (element: FlatDesignElementV7): FlatDesignElementV7 => element.id === selectedElementId && draftTransform ? { ...element, transform: draftTransform } : element;

  const renderWithOrderedMasks = (element: FlatDesignElementV7, index: number) => {
    let node = renderElement(effectiveElement(element), `${rawId}-${index}`, resolveFlatAsset);
    if (!node) return null;
    const scope = resolveFlatElementMaskScopeV7(renderFlatStep, index);
    const regionMasks = scope.regionMaskIds.map((id) => renderFlatStep.elements.find((item): item is Extract<FlatDesignElementV7, { kind: 'region_mask' }> => item.id === id && item.kind === 'region_mask')).filter((item): item is Extract<FlatDesignElementV7, { kind: 'region_mask' }> => Boolean(item));
    regionMasks.forEach((mask, maskIndex) => {
      node = <g key={`${mask.id}-wrap`} mask={`url(#${rawId}-region-${index}-${maskIndex})`}>{node}</g>;
    });
    if (scope.stepMask) node = <g mask={`url(#${stepMaskId})`}>{node}</g>;
    if (scope.eraserMaskIds.length > 0) node = <g mask={`url(#${rawId}-eraser-${index})`}>{node}</g>;
    return <g key={element.id} onPointerDown={(event) => beginElementPointer(event, element)} className={activeTool === 'select' ? 'cursor-move' : undefined}>{node}</g>;
  };

  const livePath = gesture?.mode === 'anchor' && selectedElement?.kind === 'vector_shape' ? gesture.pathData : selectedElement?.kind === 'vector_shape' ? selectedElement.pathData : null;
  const anchors = livePath ? nailPathAnchorsV7(livePath) : [];

  return (
    <div className="grid min-w-0 gap-4 sm:grid-cols-[minmax(180px,0.9fr)_minmax(190px,1fr)] sm:items-center" data-testid="v7-flat-design-canvas" data-flat-tool={activeTool} data-silhouette-source={silhouette.source} data-french-fidelity={frenchAdapter.status === 'structured' ? frenchAdapter.fidelity : frenchAdapter.status === 'unavailable' ? 'unavailable' : 'not-applicable'}>
      <div className="relative mx-auto aspect-[5/8] w-full max-w-[260px] overflow-hidden rounded-[32px] border border-white bg-white/80 p-3 shadow-[0_20px_60px_rgba(77,53,67,0.14)] touch-none">
        <svg ref={svgRef} viewBox="0 0 100 160" className="h-full w-full select-none touch-none" role="img" aria-label={`${currentFinger} 平面设计画布`} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={() => { setGesture(null); setDraftTransform(null); }}>
          <defs>
            <clipPath id={clipId} clipPathUnits="userSpaceOnUse"><path d={silhouette.pathD} transform={silhouetteTransform} /></clipPath>
            {flatStep.mask && <mask id={stepMaskId} maskUnits="userSpaceOnUse" maskContentUnits="userSpaceOnUse" x="0" y="0" width="100" height="160"><rect width="100" height="160" fill={flatStep.mask.inverted ? 'white' : 'black'} /><MaskShape mask={flatStep.mask} tone={flatStep.mask.inverted ? 'black' : 'white'} /></mask>}
            {renderFlatStep.elements.map((element, index) => {
              if (element.kind === 'eraser_mask' || element.kind === 'region_mask') return null;
              const scope = resolveFlatElementMaskScopeV7(renderFlatStep, index);
              const erasers = scope.eraserMaskIds.map((id) => renderFlatStep.elements.find((item): item is Extract<FlatDesignElementV7, { kind: 'eraser_mask' }> => item.id === id && item.kind === 'eraser_mask')).filter((item): item is Extract<FlatDesignElementV7, { kind: 'eraser_mask' }> => Boolean(item));
              const regions = scope.regionMaskIds.map((id) => renderFlatStep.elements.find((item): item is Extract<FlatDesignElementV7, { kind: 'region_mask' }> => item.id === id && item.kind === 'region_mask')).filter((item): item is Extract<FlatDesignElementV7, { kind: 'region_mask' }> => Boolean(item));
              return (
                <Fragment key={`${element.id}-masks`}>
                  {erasers.length > 0 && <mask id={`${rawId}-eraser-${index}`} maskUnits="userSpaceOnUse" maskContentUnits="userSpaceOnUse" x="0" y="0" width="100" height="160"><rect width="100" height="160" fill="white" />{erasers.map((eraser) => <g key={eraser.id}>{transformedElement(eraser, <polyline points={canvasPolyline(eraser.path)} fill="none" stroke="black" strokeOpacity={eraser.opacity} strokeWidth={eraser.widthMm * MM_TO_CANVAS_UNITS} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />)}</g>)}</mask>}
                  {regions.map((region, maskIndex) => <mask key={region.id} id={`${rawId}-region-${index}-${maskIndex}`} maskUnits="userSpaceOnUse" maskContentUnits="userSpaceOnUse" x="0" y="0" width="100" height="160"><rect width="100" height="160" fill="white" opacity={region.mask.inverted ? 1 : 1 - region.opacity} />{transformedElement(region, <path d={canvasPath(region.mask.pathData)} fill={region.mask.inverted ? 'black' : 'white'} fillOpacity={region.mask.inverted ? region.opacity : 1} fillRule={region.mask.fillRule} />)}</mask>)}
                </Fragment>
              );
            })}
          </defs>
          <g clipPath={`url(#${clipId})`}>
            <rect width="100" height="160" fill="#f5f5f6" />
            {backgroundPreview.visible && <rect width="100" height="160" fill={rgba(backgroundPreview.color, backgroundPreview.alpha)} />}
            {frenchAdapter.status === 'unavailable' && <g data-testid="v7-french-render-unavailable"><rect x="4" y="70" width="92" height="22" rx="4" fill="#fff5f5" stroke="#d46b6b" /><text x="50" y="83" textAnchor="middle" fontSize="4" fill="#9f2f2f">法式预览不可用</text></g>}
            {flatStep.visible && !flatStep.skipped && renderFlatStep.elements.map(renderWithOrderedMasks)}
            {gesture?.mode === 'draw' && (activeTool === 'brush' || activeTool === 'eraser') && <polyline points={canvasPolyline(gesture.points)} fill="none" stroke={activeTool === 'eraser' ? '#ef4444' : rgba(color)} strokeDasharray={activeTool === 'eraser' ? '6 4' : undefined} strokeWidth={widthMm * MM_TO_CANVAS_UNITS} strokeLinecap="round" vectorEffect="non-scaling-stroke" />}
            {draftPath && <path d={canvasPath(draftPath)} fill={activeTool === 'line' || activeTool === 'region_mask' ? 'none' : rgba(color, 0.65)} stroke={activeTool === 'region_mask' ? '#7c3aed' : rgba(color)} strokeDasharray={activeTool === 'region_mask' ? '6 4' : undefined} strokeWidth={widthMm * MM_TO_CANVAS_UNITS} vectorEffect="non-scaling-stroke" />}
          </g>
          <g transform={silhouetteTransform} pointerEvents="none"><path d={silhouette.pathD} fill="none" stroke="#6f625f" strokeWidth="1.2" vectorEffect="non-scaling-stroke" /></g>

          {activeTool === 'anchor' && selectedElement?.kind === 'vector_shape' && anchors.map((anchor, index) => {
            const displayPoint = transformNailPointV7(anchor, selectedElement.transform);
            return <circle key={`${index}-${anchor.u}-${anchor.v}`} cx={displayPoint.u * CANVAS_WIDTH} cy={displayPoint.v * CANVAS_HEIGHT} r="3.4" fill="white" stroke="#7c3aed" strokeWidth="1.4" className="cursor-crosshair" onPointerDown={(event) => { event.stopPropagation(); if (!canEdit || selectedElement.locked) return; svgRef.current?.setPointerCapture(event.pointerId); setGesture({ mode: 'anchor', pointerId: event.pointerId, anchorIndex: index, element: selectedElement, pathData: selectedElement.pathData }); }} />;
          })}
        </svg>
        {flatStep.locked && <span className="absolute inset-x-4 bottom-4 flex items-center justify-center gap-1.5 rounded-full bg-gray-900/85 px-3 py-2 text-nano text-white"><Lock size={12} />当前步骤已锁定</span>}
        {!flatStep.visible && <span className="absolute inset-x-4 bottom-4 flex items-center justify-center gap-1.5 rounded-full bg-gray-900/85 px-3 py-2 text-nano text-white"><EyeOff size={12} />当前步骤已隐藏</span>}
      </div>

      <div className="min-w-0 space-y-3">
        <div>
          <p className="text-nano font-semibold uppercase tracking-[0.14em] text-violet-500">2D SVG 矢量编辑</p>
          <h2 className="mt-1 text-lg font-semibold text-gray-900">{currentFinger} · {flatStep.name}</h2>
          <p className="mt-1 text-nano text-gray-500">{flatStep.elements.length} 个元素 · 工具：{activeTool}</p>
        </div>
        <div className="rounded-xl border border-violet-200 bg-violet-50 px-3 py-2.5 text-nano leading-4 text-violet-800">
          <Info size={13} className="mr-1.5 inline -translate-y-px" />
          所有 pointer 坐标先转换为 u/v 0–1 再写入 EditorDoc；SVG 仅是派生视图。
        </div>
        <dl className="grid grid-cols-2 gap-2 text-nano">
          <div className="rounded-xl border border-gray-200 bg-white px-3 py-2"><dt className="text-gray-400">Geometry clip</dt><dd className="mt-1 font-semibold text-gray-800">{silhouette.source === 'product' ? '已签收 2D 轮廓' : silhouette.source === 'generated' ? '生成轮廓（近似）' : '通用回退轮廓'}</dd></div>
          <div className="rounded-xl border border-gray-200 bg-white px-3 py-2"><dt className="text-gray-400">遮罩策略</dt><dd className="mt-1 font-semibold text-gray-800">非破坏 · 顺序生效</dd></div>
        </dl>
        <p className="rounded-xl border border-dashed border-gray-300 bg-white px-3 py-2 text-nano leading-4 text-gray-500">
          参数图形在创建时显式物化为 canonical pathData；V7 当前合同不保存矩形/圆/星形的额外参数字段。
        </p>
      </div>
    </div>
  );
}
