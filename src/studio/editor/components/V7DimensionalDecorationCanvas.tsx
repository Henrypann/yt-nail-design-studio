import { useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { Box, EyeOff, Info } from 'lucide-react';
import { cx, useToast } from '@/design-system';
import { selectCurrentNailV7, selectCurrentStepV7, useEditorV7Store } from '../store-v7';
import { resolveBackgroundSilhouetteV7 } from '../v7/background';
import type { BackgroundPayloadV7, DimensionalDecorationV7, NailPointV7 } from '../v7/model';
import {
  DIMENSIONAL_DECORATION_LABELS_V7,
  DIMENSIONAL_FIDELITY_LABELS_V7,
  dimensionalDecorationArchetypeV7,
  dimensionalDecorationFidelityV7,
  dimensionalDecorationPreviewPathV7,
  dimensionalDecorationShadowOffsetV7,
} from '../v7/dimensional-decoration';
import { combineGeometryPreviewFidelityV7 } from '../v7/geometry-registry';

const WIDTH = 100;
const HEIGHT = 160;

type DragState = { pointerId: number; start: NailPointV7; decoration: DimensionalDecorationV7 } | null;

function silhouetteTransform(viewBox: string): string {
  const values = viewBox.trim().split(/[\s,]+/).map(Number);
  if (values.length !== 4 || values.some((value) => !Number.isFinite(value)) || values[2] <= 0 || values[3] <= 0) return '';
  return `scale(${WIDTH / values[2]} ${HEIGHT / values[3]}) translate(${-values[0]} ${-values[1]})`;
}

function backgroundFill(background: BackgroundPayloadV7): string {
  const color = background.mode === 'gradient'
    ? background.stops[0]?.color
    : background.mode === 'glitter'
      ? background.colors[0]
      : background.color;
  return color ? `rgb(${color.r} ${color.g} ${color.b} / ${color.a * background.opacity})` : '#f6ebe7';
}

function transformDecoration(decoration: DimensionalDecorationV7, node: ReactNode): ReactNode {
  const { position, rotationDeg, scaleX, scaleY } = decoration.transform;
  return <g transform={`translate(${position.u * WIDTH} ${position.v * HEIGHT}) rotate(${rotationDeg}) scale(${scaleX} ${scaleY}) translate(${-WIDTH / 2} ${-HEIGHT / 2})`}>{node}</g>;
}

function decorationArtwork(decoration: DimensionalDecorationV7, selected: boolean): ReactNode {
  const fidelity = dimensionalDecorationFidelityV7(decoration);
  const shadow = dimensionalDecorationShadowOffsetV7(decoration.heightMm);
  const path = dimensionalDecorationPreviewPathV7(decoration);
  if (!path) return null;
  const archetype = dimensionalDecorationArchetypeV7(decoration);
  const fill = archetype === 'droplet' ? '#d9f2ff'
    : archetype === 'gel_stack' ? '#f8d9eb'
      : archetype === 'carving' ? '#ead4ee'
        : archetype === 'crystal_flower' ? '#fce4ef'
          : archetype === 'lavender_pearl' ? '#c9afea'
            : archetype === 'silver_studs' ? '#dfe5e9'
              : archetype === 'ruby_microbeads' ? '#a9003b'
                : archetype === 'accessory' ? '#d9c6a3' : '#f1b9ce';
  return transformDecoration(decoration, <>
    <path d={path} transform={`translate(${shadow} ${shadow})`} fill="#3d2634" fillOpacity={0.16} />
    <path d={path} fill={fill} fillOpacity={fidelity === 'unavailable' ? 0.18 : 0.88} stroke={selected ? '#d12f69' : '#ffffff'} strokeWidth={selected ? 2 : 1.1} strokeDasharray={fidelity === 'unavailable' ? '4 3' : undefined} vectorEffect="non-scaling-stroke" />
    {fidelity !== 'unavailable' && <path d={path} transform="translate(-1.5 -1.8)" fill="none" stroke="#ffffff" strokeOpacity={0.8} strokeWidth="1" vectorEffect="non-scaling-stroke" />}
  </>);
}

export function V7DimensionalDecorationCanvas() {
  const toast = useToast();
  const svgRef = useRef<SVGSVGElement>(null);
  const nail = useEditorV7Store(selectCurrentNailV7);
  const step = useEditorV7Store(selectCurrentStepV7);
  const currentFinger = useEditorV7Store((state) => state.currentFinger);
  const selectedElementId = useEditorV7Store((state) => state.selectedElementId);
  const readOnly = useEditorV7Store((state) => state.readOnly);
  const switching = useEditorV7Store((state) => state.switching);
  const selectElement = useEditorV7Store((state) => state.selectElement);
  const replaceDecoration = useEditorV7Store((state) => state.replaceDimensionalDecoration);
  const [drag, setDrag] = useState<DragState>(null);
  const [draft, setDraft] = useState<DimensionalDecorationV7 | null>(null);
  const decorationStep = step?.kind === 'dimensional_decoration' ? step : null;
  const backgroundStep = nail?.steps[0];
  const silhouette = nail ? resolveBackgroundSilhouetteV7(nail.geometryRef, nail.finger) : null;
  const canEdit = Boolean(decorationStep && decorationStep.visible && !decorationStep.skipped && !decorationStep.locked && !readOnly && !switching && silhouette?.fidelity === 'exact');
  const decorations = useMemo(() => decorationStep?.decorations.map((item) => item.id === draft?.id ? draft : item) ?? [], [decorationStep?.decorations, draft]);
  const aggregateFidelity = decorations.some((item) => dimensionalDecorationFidelityV7(item) === 'unavailable')
    ? 'unavailable'
    : decorations.some((item) => dimensionalDecorationFidelityV7(item) === 'approximate') ? 'approximate' : 'exact';

  if (!nail || !decorationStep || backgroundStep?.kind !== 'background' || !silhouette) return null;
  const previewFidelity = combineGeometryPreviewFidelityV7(silhouette.fidelity, aggregateFidelity);
  const clipId = `v7-decoration-${currentFinger}-${decorationStep.id.replace(/[^A-Za-z0-9_-]/g, '-')}`;

  const pointFromEvent = (event: ReactPointerEvent<SVGElement>): NailPointV7 => {
    const matrix = svgRef.current?.getScreenCTM();
    if (!matrix || !svgRef.current) return { u: 0.5, v: 0.5 };
    const point = svgRef.current.createSVGPoint();
    point.x = event.clientX;
    point.y = event.clientY;
    const local = point.matrixTransform(matrix.inverse());
    return { u: Math.min(1, Math.max(0, local.x / WIDTH)), v: Math.min(1, Math.max(0, local.y / HEIGHT)) };
  };
  const beginDrag = (event: ReactPointerEvent<SVGGElement>, decoration: DimensionalDecorationV7) => {
    event.stopPropagation();
    selectElement(decoration.id);
    if (!canEdit || decoration.locked) return;
    svgRef.current?.setPointerCapture(event.pointerId);
    setDrag({ pointerId: event.pointerId, start: pointFromEvent(event), decoration: structuredClone(decoration) });
    setDraft(structuredClone(decoration));
  };
  const moveDrag = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (!drag || drag.pointerId !== event.pointerId) return;
    const point = pointFromEvent(event);
    const position = {
      u: Math.min(1, Math.max(0, drag.decoration.transform.position.u + point.u - drag.start.u)),
      v: Math.min(1, Math.max(0, drag.decoration.transform.position.v + point.v - drag.start.v)),
    };
    setDraft({ ...drag.decoration, transform: { ...drag.decoration.transform, position }, ...(drag.decoration.kind === 'attachment_3d' ? { anchor: position } : {}) });
  };
  const finishDrag = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (draft && JSON.stringify(draft) !== JSON.stringify(drag.decoration)) {
      const result = replaceDecoration(currentFinger, decorationStep.id, drag.decoration.id, draft);
      if (!result.ok) toast.error(result.message);
    }
    setDrag(null);
    setDraft(null);
  };

  const tone = previewFidelity === 'exact' ? 'border-success/25 bg-success-soft text-success' : previewFidelity === 'approximate' ? 'border-warning/25 bg-warning-soft text-warning' : 'border-gray-300 bg-gray-100 text-gray-600';
  return (
    <div className="grid min-w-0 gap-4 sm:grid-cols-[minmax(180px,0.9fr)_minmax(190px,1fr)] sm:items-center" data-testid="v7-dimensional-decoration-canvas" data-preview-fidelity={previewFidelity} data-unavailable-count={decorations.filter((item) => dimensionalDecorationFidelityV7(item) === 'unavailable').length}>
      <div className="relative mx-auto aspect-[5/8] w-full max-w-[260px] overflow-hidden rounded-[32px] border border-white bg-white/80 p-3 shadow-[0_20px_60px_rgba(77,53,67,0.14)] touch-none">
        <svg ref={svgRef} viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="h-full w-full select-none touch-none" role="img" aria-label={`${currentFinger} 立体装饰 2.5D 编辑预览`} onPointerDown={() => selectElement(null)} onPointerMove={moveDrag} onPointerUp={finishDrag} onPointerCancel={() => { setDrag(null); setDraft(null); }}>
          <defs><clipPath id={clipId}><path d={silhouette.pathD} transform={silhouetteTransform(silhouette.viewBox)} /></clipPath></defs>
          <g clipPath={`url(#${clipId})`}>
            <rect width={WIDTH} height={HEIGHT} fill={backgroundFill(backgroundStep.background)} />
            {decorations.filter((item) => item.visible).map((decoration) => <g key={decoration.id} onPointerDown={(event) => beginDrag(event, decoration)} className={canEdit && !decoration.locked ? 'cursor-move' : undefined}>{decorationArtwork(decoration, decoration.id === selectedElementId)}</g>)}
            <path d={silhouette.pathD} transform={silhouetteTransform(silhouette.viewBox)} fill="none" stroke="rgb(255 255 255 / .72)" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
          </g>
        </svg>
        {(!decorationStep.visible || decorationStep.skipped) && <div className="absolute inset-3 flex items-center justify-center rounded-[24px] bg-white/82 text-xs font-semibold text-gray-600 backdrop-blur-sm"><EyeOff size={15} className="mr-2" />{decorationStep.skipped ? '此装饰步骤已跳过' : '此装饰步骤已隐藏'}</div>}
      </div>
      <div className="min-w-0 rounded-3xl border border-gray-200 bg-white/90 p-4 shadow-sm">
        <div className="flex items-center gap-2"><Box size={17} className="text-primary" /><p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">Dimensional · 2D/2.5D</p></div>
        <h2 className="mt-2 text-lg font-semibold text-gray-900">{decorations.length} 个立体装饰</h2>
        <div className={cx('mt-3 inline-flex rounded-full border px-2.5 py-1 text-nano font-semibold', tone)}>{DIMENSIONAL_FIDELITY_LABELS_V7[previewFidelity]}</div>
        {silhouette.fidelity !== 'exact' && <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-nano leading-4 text-amber-900">甲型轮廓为{silhouette.fidelity === 'approximate' ? '生成近似' : '通用回退'}，整体投影已相应降级。</p>}
        <div className="mt-4 space-y-1 text-xs text-gray-600">{decorations.slice(0, 4).map((item) => <p key={item.id}>{DIMENSIONAL_DECORATION_LABELS_V7[dimensionalDecorationArchetypeV7(item)]} · {item.heightMm.toFixed(2)} mm</p>)}</div>
        <div className="mt-4 rounded-2xl border border-info/20 bg-info-soft p-3 text-xs leading-5 text-info"><Info size={14} className="mb-1" />俯视阴影和高度仅为编辑态 2.5D 投影；Mesh 状态不代表物理结构、装配或可制造性。</div>
      </div>
    </div>
  );
}
