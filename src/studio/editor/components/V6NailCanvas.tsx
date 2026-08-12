import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { FINGER_CODES } from '@/lib/types';
import { registerPreviewSvg } from '@/studio/preview/export-png';
import { getSilhouette } from '../lib/material';
import { useEditorV6Store } from '../store-v6';
import { readElementTransform } from '../v6/interaction';
import type { EditorElementV6, EditorLayerV6 } from '../v6/model';

type CanvasPoint = { x: number; y: number };
type DragState = {
  elementId: string;
  origin: CanvasPoint;
  start: ReturnType<typeof readElementTransform>;
  dx: number;
  dy: number;
};

function pointInSvg(event: ReactPointerEvent<SVGGElement>): CanvasPoint | null {
  const svg = event.currentTarget.ownerSVGElement;
  const matrix = svg?.getScreenCTM()?.inverse();
  if (!matrix) return null;
  const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix);
  return { x: point.x, y: point.y };
}

function elementTransform(element: EditorElementV6, drag: DragState | null): ReturnType<typeof readElementTransform> {
  const transform = readElementTransform(element);
  if (!drag || drag.elementId !== element.id) return transform;
  return { ...transform, x: drag.start.x + drag.dx, y: drag.start.y + drag.dy };
}

function elementGraphic(element: EditorElementV6) {
  if (element.kind === 'brush' && Array.isArray(element.points)) {
    const points = element.points
      .filter((point): point is { x: number; y: number } => Boolean(point) && typeof point === 'object')
      .map((point) => `${point.x},${point.y}`)
      .join(' ');
    return <polyline points={points} fill="none" stroke={String(element.color ?? '#F04E7E')} strokeWidth={Number(element.size ?? 6)} strokeLinecap="round" opacity={Number(element.opacity ?? 1)} />;
  }
  if (element.kind === 'image' && typeof element.dataUrl === 'string') {
    return <image href={element.dataUrl} x={-30} y={-42} width={60} height={84} preserveAspectRatio="xMidYMid slice" />;
  }
  if (element.kind === 'attachment') {
    return <path d="M 0 -18 L 17 0 L 0 18 L -17 0 Z" fill="#f7d6de" stroke="#9b5f73" strokeWidth="2" />;
  }
  if (element.domain === 'relief') {
    return <ellipse cx="0" cy="0" rx="26" ry="12" fill="#e8d4bb" stroke="#9e8567" strokeWidth="2" />;
  }
  if (element.kind === 'french_edge') {
    return <path d="M -42 0 Q 0 -28 42 0" fill="none" stroke={String(element.strokeColor ?? '#ffffff')} strokeWidth={Number(element.strokeWidth ?? 8)} strokeLinecap="round" />;
  }
  return <rect x={-30} y={-42} width={60} height={84} rx={18} fill="#fff7fb" fillOpacity="0.72" stroke="#a85c79" strokeWidth="2" strokeDasharray="5 4" />;
}

function visibleLayers(layers: EditorLayerV6[]): EditorLayerV6[] {
  return layers.filter((layer) => layer.visible).slice().sort((a, b) => a.order - b.order);
}

function NailElements(props: {
  layers: EditorLayerV6[];
  selectedElementId: string | null;
  drag: DragState | null;
  interactive: boolean;
  readOnly: boolean;
  onPointerDown?: (event: ReactPointerEvent<SVGGElement>, layer: EditorLayerV6, element: EditorElementV6) => void;
  onPointerMove?: (event: ReactPointerEvent<SVGGElement>) => void;
  onPointerUp?: (event: ReactPointerEvent<SVGGElement>) => void;
}) {
  return visibleLayers(props.layers).flatMap((layer) => layer.elements
    .filter((element) => element.visible)
    .sort((a, b) => a.order - b.order)
    .map((element) => {
      const transform = elementTransform(element, props.drag);
      const selected = props.selectedElementId === element.id;
      return (
        <g
          key={element.id}
          data-element-id={element.id}
          transform={`translate(${transform.x} ${transform.y}) rotate(${transform.rotation}) scale(${transform.scale})`}
          className={props.interactive ? 'cursor-move' : undefined}
          onPointerDown={props.interactive ? (event) => props.onPointerDown?.(event, layer, element) : undefined}
          onClick={props.interactive ? (event) => {
            event.stopPropagation();
            useEditorV6Store.getState().selectElementOnCurrent(layer.id, element.id);
          } : undefined}
          onPointerMove={props.interactive ? props.onPointerMove : undefined}
          onPointerUp={props.interactive ? props.onPointerUp : undefined}
          onPointerCancel={props.interactive ? props.onPointerUp : undefined}
          aria-disabled={props.readOnly || layer.locked || element.locked}
          aria-label={`${String(element.name ?? element.kind)} canvas element`}
          role={props.interactive ? 'button' : undefined}
          tabIndex={props.interactive ? 0 : undefined}
        >
          {props.interactive && <rect data-element-hit-target="true" x={-36} y={-48} width={72} height={96} rx={8} fill="transparent" pointerEvents="all" />}
          {elementGraphic(element)}
          {selected && <rect x={-36} y={-48} width={72} height={96} rx={8} fill="none" stroke="#7a2748" strokeWidth="2" vectorEffect="non-scaling-stroke" strokeDasharray="4 3" />}
        </g>
      );
    }));
}

export function V6NailCanvas() {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const doc = useEditorV6Store((state) => state.doc);
  const currentFinger = useEditorV6Store((state) => state.currentFinger);
  const selectedElementId = useEditorV6Store((state) => state.selectedElementId);
  const viewMode = useEditorV6Store((state) => state.viewMode);
  const readOnly = useEditorV6Store((state) => state.readOnly);
  const selectElement = useEditorV6Store((state) => state.selectElementOnCurrent);
  const updateTransform = useEditorV6Store((state) => state.updateSelectedElementTransform);
  const [drag, setDrag] = useState<DragState | null>(null);

  useEffect(() => {
    registerPreviewSvg(svgRef.current);
    return () => registerPreviewSvg(null);
  }, [doc?.designId, viewMode]);

  const current = useMemo(() => {
    if (!doc) return null;
    const nail = doc.nails[currentFinger];
    const shape = nail.geometryOverride?.shape ?? doc.defaultGeometry.shape;
    const length = nail.geometryOverride?.length ?? doc.defaultGeometry.length;
    const silhouette = getSilhouette(shape, length);
    const baseColor = nail.layers.find((layer) => layer.typeId === 'builtin.base_surface')?.surface?.baseColor ?? '#FBF5F0';
    return { nail, silhouette, baseColor };
  }, [currentFinger, doc]);

  if (!doc || !current?.silhouette) return null;

  const onPointerDown = (event: ReactPointerEvent<SVGGElement>, layer: EditorLayerV6, element: EditorElementV6) => {
    event.stopPropagation();
    selectElement(layer.id, element.id);
    if (readOnly || layer.locked || element.locked) return;
    const point = pointInSvg(event);
    if (!point) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    setDrag({ elementId: element.id, origin: point, start: readElementTransform(element), dx: 0, dy: 0 });
  };

  const onPointerMove = (event: ReactPointerEvent<SVGGElement>) => {
    if (!drag) return;
    const point = pointInSvg(event);
    if (!point) return;
    setDrag((currentDrag) => currentDrag ? {
      ...currentDrag,
      dx: point.x - currentDrag.origin.x,
      dy: point.y - currentDrag.origin.y,
    } : null);
  };

  const onPointerUp = (event: ReactPointerEvent<SVGGElement>) => {
    if (!drag) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    updateTransform({ x: drag.start.x + drag.dx, y: drag.start.y + drag.dy });
    setDrag(null);
  };

  if (viewMode === 'overview') {
    return (
      <svg ref={svgRef} viewBox="0 0 800 420" className="h-full w-full" role="img" aria-label="Ten-finger customer preview" data-canvas-mode="overview">
        <rect width="800" height="420" rx="24" fill="#fbf8f6" />
        {FINGER_CODES.map((finger, index) => {
          const nail = doc.nails[finger];
          const shape = nail.geometryOverride?.shape ?? doc.defaultGeometry.shape;
          const length = nail.geometryOverride?.length ?? doc.defaultGeometry.length;
          const silhouette = getSilhouette(shape, length);
          if (!silhouette) return null;
          const baseColor = nail.layers.find((layer) => layer.typeId === 'builtin.base_surface')?.surface?.baseColor ?? '#FBF5F0';
          const x = 78 + (index % 5) * 160;
          const y = index < 5 ? 198 : 395;
          return (
            <g key={finger} transform={`translate(${x} ${y}) scale(0.72)`}>
              <path d={silhouette.pathD} fill={baseColor} stroke="#9f8b83" strokeWidth="2" />
              <g clipPath={`url(#overview-clip-${finger})`}>
                <defs><clipPath id={`overview-clip-${finger}`}><path d={silhouette.pathD} /></clipPath></defs>
                <NailElements layers={nail.layers} selectedElementId={null} drag={null} interactive={false} readOnly />
              </g>
              <text x="0" y="27" textAnchor="middle" fontSize="15" fill="#6b5b55">{finger}</text>
            </g>
          );
        })}
        <text x="28" y="34" fontSize="18" fontWeight="600" fill="#392e2a">{doc.title}</text>
        <text x="28" y="58" fontSize="12" fill="#7c6d67">Customer preview · simulated 2D · manufacturing unverified</text>
      </svg>
    );
  }

  const clipId = `v6-nail-clip-${currentFinger}`;
  return (
    <svg
      ref={svgRef}
      viewBox={current.silhouette.viewBox}
      className="h-full w-full touch-none select-none"
      role="application"
      aria-label="V6 direct manipulation canvas"
      data-canvas-mode="single"
      onPointerDown={(event) => {
        const target = event.target as SVGElement;
        if (event.target === event.currentTarget || target.dataset.canvasBackground === 'true') {
          useEditorV6Store.getState().setSelectedElementId(null);
        }
      }}
    >
      <defs><clipPath id={clipId}><path d={current.silhouette.pathD} /></clipPath></defs>
      <path data-canvas-background="true" d={current.silhouette.pathD} fill={current.baseColor} stroke="#9f8b83" strokeWidth="1.4" />
      <g clipPath={`url(#${clipId})`}>
        <NailElements
          layers={current.nail.layers}
          selectedElementId={selectedElementId}
          drag={drag}
          interactive
          readOnly={readOnly}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
        />
      </g>
    </svg>
  );
}
