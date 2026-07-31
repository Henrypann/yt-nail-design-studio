/**
 * 2D 设计画布（模块 4 · PRD §13.3）
 * - 画布形状 = 甲型轮廓（SVG clipPath，画不出边界）；
 * - 滚轮缩放 50%–400%（指针位置为缩放中心）；空格 + 拖拽平移；
 * - 画笔 / 橡皮 直接在轮廓内绘制（橡皮以 mask 作用于图案层）。
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Hand, Maximize2, MousePointer2 } from 'lucide-react';
import { cx } from '@/design-system';
import { useLocale } from '@/lib/i18n';
import {
  buildFrenchEdgePaths,
  resolveClassicControls,
  silhouetteMetrics,
  updateClassicControlsForHandle,
  type ClassicFrenchHandle,
} from '../lib/french-edge';
import { getSilhouette } from '../lib/material';
import { mergeMercuryParams } from '../lib/recipe-model';
import { createNailSurfaceMapper } from '../lib/surface-mapper';
import { nailContentSvg } from '../lib/render';
import {
  genId,
  createLayerMeta,
  resolveFingerData,
  type BrushElement,
  type ClassicFrenchControls,
  type EraserElement,
  type FrenchEdgeElement,
} from '../lib/model';
import { recordStroke } from '../lib/session-metrics';
import { useEditorStore } from '../store';

const PAD = 24; // viewBox 外扩（0.1mm 单位），避免描边被裁
/** 点距节流：小于此距离（0.1mm）不追加采样点 */
const MIN_POINT_DIST_SQ = 1.5 * 1.5;
interface FrenchDrag {
  id: string;
  handle: ClassicFrenchHandle;
  controls: ClassicFrenchControls;
}
interface MercuryDrag { index: 0 | 1 | 2; anchors: [{ u: number; v: number }, { u: number; v: number }, { u: number; v: number }]; }

export function NailCanvas() {
  const { text } = useLocale();
  const doc = useEditorStore((s) => s.doc);
  const currentFinger = useEditorStore((s) => s.currentFinger);
  const readOnly = useEditorStore((s) => s.readOnly);
  const tool = useEditorStore((s) => s.tool);
  const brushColor = useEditorStore((s) => s.brushColor);
  const brushSize = useEditorStore((s) => s.brushSize);
  const brushOpacity = useEditorStore((s) => s.brushOpacity);
  const eraserSize = useEditorStore((s) => s.eraserSize);
  const zoom = useEditorStore((s) => s.zoom);
  const panX = useEditorStore((s) => s.panX);
  const panY = useEditorStore((s) => s.panY);
  const setView = useEditorStore((s) => s.setView);
  const editCurrentFingerData = useEditorStore((s) => s.editCurrentFingerData);
  const selection = useEditorStore((s) => s.selection);
  const setSelection = useEditorStore((s) => s.setSelection);

  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [spaceDown, setSpaceDown] = useState(false);
  const [panning, setPanning] = useState(false);
  const panStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 });
  const [liveStroke, setLiveStroke] = useState<BrushElement | null>(null);
  const [liveEraser, setLiveEraser] = useState<EraserElement | null>(null);
  const [liveFrenchDrag, setLiveFrenchDrag] = useState<FrenchDrag | null>(null);
  const liveFrenchDragRef = useRef<FrenchDrag | null>(null);
  const [liveMercuryDrag, setLiveMercuryDrag] = useState<MercuryDrag | null>(null);
  const liveMercuryDragRef = useRef<MercuryDrag | null>(null);
  const drawing = useRef(false);

  const sil = doc ? getSilhouette(doc.shape, doc.length) : null;

  const viewBox = useMemo(() => {
    if (!sil) return '0 0 100 100';
    const [x, y, w, h] = sil.viewBox.split(/\s+/).map(Number);
    return `${x - PAD} ${y - PAD} ${w + PAD * 2} ${h + PAD * 2}`;
  }, [sil]);
  const canvasHeight = useMemo(
    () => Math.round(320 * (Number(viewBox.split(/\s+/)[3]) / Number(viewBox.split(/\s+/)[2]))),
    [viewBox],
  );

  const fitCanvas = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const nextZoom = Math.max(
      0.5,
      Math.min(1.35, (rect.width - 64) / 320, (rect.height - 80) / canvasHeight),
    );
    setView({
      zoom: nextZoom,
      panX: (rect.width - 320 * nextZoom) / 2,
      panY: Math.max(24, (rect.height - canvasHeight * nextZoom) / 2),
    });
  }, [canvasHeight, setView]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(fitCanvas);
    return () => window.cancelAnimationFrame(frame);
  }, [doc?.shape, doc?.length, fitCanvas]);

  const fingerData = doc ? resolveFingerData(doc, currentFinger) : null;
  const classicFrench = useMemo(
    () =>
      fingerData?.pattern.find(
        (candidate): candidate is FrenchEdgeElement =>
          candidate.kind === 'french_edge' &&
          candidate.variant === 'arc' &&
          candidate.visible,
      ) ?? null,
    [fingerData],
  );
  const selectedClassic = useMemo(() => {
    if (!fingerData || selection?.layer !== 'pattern') return null;
    const element = fingerData.pattern.find(
      (candidate): candidate is FrenchEdgeElement =>
        candidate.id === selection.id &&
        candidate.kind === 'french_edge' &&
        candidate.variant === 'arc' &&
        !candidate.locked,
    );
    return element ?? null;
  }, [fingerData, selection]);

  const content = useMemo(() => {
    if (!doc || !sil || !fingerData) return '';
    const displayData =
      liveFrenchDrag && liveFrenchDrag.id === selectedClassic?.id
        ? {
            ...fingerData,
            pattern: fingerData.pattern.map((element) =>
              element.id === liveFrenchDrag.id &&
              element.kind === 'french_edge'
                ? { ...element, classicControls: liveFrenchDrag.controls }
                : element,
            ),
          }
        : fingerData;
    const recipeForRender = doc.recipe && liveMercuryDrag
      ? { ...doc.recipe, params: { ...mergeMercuryParams(doc.recipe, currentFinger), ribbonAnchors: liveMercuryDrag.anchors } }
      : doc.recipe;
    const nailSvg = nailContentSvg(
      {
        shape: doc.shape,
        length: doc.length,
        data: displayData,
        uid: 'canvas',
        liveStroke,
        liveEraser,
        appearance: doc.appearance,
        recipe: recipeForRender,
        finger: currentFinger,
      },
      sil,
    );
    const mercuryHandles = recipeForRender && !readOnly
      ? (() => {
          const mapper = createNailSurfaceMapper(doc.shape, doc.length);
          const anchors = mergeMercuryParams(recipeForRender, currentFinger).ribbonAnchors;
          if (!mapper) return '';
          return `<g data-testid="mercury-ribbon-handles">${anchors.map((uv, index) => { const p = mapper.point(uv); return `<g data-mercury-handle="${index}" style="cursor:move"><circle cx="${p.x}" cy="${p.y}" r="11" fill="transparent"/><circle cx="${p.x}" cy="${p.y}" r="4.5" fill="#D7A94F" stroke="#FFFFFF" stroke-width="2" pointer-events="none"/></g>`; }).join('')}</g>`;
        })()
      : '';
    if (!selectedClassic || readOnly) return `${nailSvg}${mercuryHandles}`;

    const controls =
      liveFrenchDrag?.id === selectedClassic.id
        ? liveFrenchDrag.controls
        : resolveClassicControls(sil, selectedClassic);
    const paths = buildFrenchEdgePaths(sil, {
      ...selectedClassic,
      classicControls: controls,
    });
    const handles = [
      { key: 'left', x: paths.wingLeftX, y: paths.leftWingY },
      { key: 'center', x: 0, y: paths.centerY },
      { key: 'right', x: paths.wingRightX, y: paths.rightWingY },
    ] as const;
    const handleSvg = handles
      .map(
        ({ key, x, y }) =>
          `<g data-french-handle="${key}" style="cursor:ns-resize">` +
          `<circle cx="${x}" cy="${y}" r="10" fill="transparent"/>` +
          `<circle cx="${x}" cy="${y}" r="4.5" fill="#C2497A" stroke="#FFFFFF" stroke-width="2" pointer-events="none"/>` +
          `</g>`,
      )
      .join('');
    return `${nailSvg}${mercuryHandles}<g data-testid="classic-french-handles">${handleSvg}</g>`;
  }, [
    doc,
    sil,
    fingerData,
    liveStroke,
    liveEraser,
    liveFrenchDrag,
    selectedClassic,
    readOnly,
    liveMercuryDrag,
    currentFinger,
  ]);

  /* ── 空格平移 ───────────────────────────────────────── */
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !(e.target instanceof HTMLInputElement) && !(e.target instanceof HTMLTextAreaElement)) {
        e.preventDefault();
        setSpaceDown(true);
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === 'Space') setSpaceDown(false);
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, []);

  /* ── 滚轮缩放（50%–400%，指针为中心；非 passive 才能 preventDefault） ── */
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const state = useEditorStore.getState();
      const rect = el.getBoundingClientRect();
      const px = e.clientX - rect.left;
      const py = e.clientY - rect.top;
      const factor = Math.exp(-e.deltaY * 0.0012);
      const nextZoom = Math.min(4, Math.max(0.5, state.zoom * factor));
      const k = nextZoom / state.zoom;
      state.setView({
        zoom: nextZoom,
        panX: px - (px - state.panX) * k,
        panY: py - (py - state.panY) * k,
      });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  /** 屏幕坐标 → 甲面 SVG 坐标（getScreenCTM 含 CSS transform 与 viewBox 映射） */
  const toSvgPoint = useCallback((clientX: number, clientY: number) => {
    const svg = svgRef.current;
    if (!svg) return null;
    const ctm = svg.getScreenCTM();
    if (!ctm) return null;
    const pt = new DOMPoint(clientX, clientY).matrixTransform(ctm.inverse());
    return { x: pt.x, y: pt.y };
  }, []);

  const onPointerDown = (e: React.PointerEvent) => {
    if (spaceDown) {
      setPanning(true);
      panStart.current = { x: e.clientX, y: e.clientY, panX, panY };
      e.currentTarget.setPointerCapture(e.pointerId);
      return;
    }
    if (readOnly || drawing.current) return;
    const handleNode = (e.target as Element).closest?.(
      '[data-french-handle]',
    ) as SVGElement | null;
    const handle = handleNode?.dataset.frenchHandle as
      | ClassicFrenchHandle
      | undefined;
    if (handle && selectedClassic && sil) {
      const drag: FrenchDrag = {
        id: selectedClassic.id,
        handle,
        controls: resolveClassicControls(sil, selectedClassic),
      };
      liveFrenchDragRef.current = drag;
      setLiveFrenchDrag(drag);
      e.currentTarget.setPointerCapture(e.pointerId);
      e.preventDefault();
      return;
    }
    const mercuryNode = (e.target as Element).closest?.('[data-mercury-handle]') as SVGElement | null;
    const mercuryIndex = mercuryNode?.dataset.mercuryHandle;
    if (mercuryIndex !== undefined && doc?.recipe) {
      const anchors = [...mergeMercuryParams(doc.recipe, currentFinger).ribbonAnchors] as MercuryDrag['anchors'];
      const drag: MercuryDrag = { index: Number(mercuryIndex) as 0 | 1 | 2, anchors };
      liveMercuryDragRef.current = drag;
      setLiveMercuryDrag(drag);
      e.currentTarget.setPointerCapture(e.pointerId);
      e.preventDefault();
      return;
    }
    const p = toSvgPoint(e.clientX, e.clientY);
    if (!p) return;
    drawing.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    if (tool === 'brush') {
      setLiveStroke({
        id: genId('el_brush'),
        kind: 'brush',
        ...createLayerMeta('手绘笔画', fingerData?.pattern.length ?? 0),
        points: [p],
        color: brushColor,
        size: brushSize,
        opacity: brushOpacity,
      });
    } else {
      setLiveEraser({
        id: genId('el_eraser'),
        kind: 'eraser',
        ...createLayerMeta('擦除蒙版', fingerData?.pattern.length ?? 0),
        points: [p],
        size: eraserSize,
      });
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (panning) {
      setView({
        panX: panStart.current.panX + (e.clientX - panStart.current.x),
        panY: panStart.current.panY + (e.clientY - panStart.current.y),
      });
      return;
    }
    const frenchDrag = liveFrenchDragRef.current;
    if (frenchDrag && sil) {
      const p = toSvgPoint(e.clientX, e.clientY);
      if (!p) return;
      const metrics = silhouetteMetrics(sil);
      const nextControls = updateClassicControlsForHandle(
        frenchDrag.controls,
        frenchDrag.handle,
        p.y - metrics.tipY,
        metrics.nailLength - 2,
      );
      const nextDrag = { ...frenchDrag, controls: nextControls };
      liveFrenchDragRef.current = nextDrag;
      setLiveFrenchDrag(nextDrag);
      return;
    }
    const mercuryDrag = liveMercuryDragRef.current;
    if (mercuryDrag && sil && doc?.recipe) {
      const p = toSvgPoint(e.clientX, e.clientY);
      if (!p) return;
      const [vx, vy, vw, vh] = sil.viewBox.split(/\s+/).map(Number);
      const nextAnchors = [...mercuryDrag.anchors] as MercuryDrag['anchors'];
      nextAnchors[mercuryDrag.index] = { u: Math.min(1, Math.max(0, (p.x - vx) / vw)), v: Math.min(1, Math.max(0, (p.y - vy) / vh)) };
      const next = { ...mercuryDrag, anchors: nextAnchors };
      liveMercuryDragRef.current = next;
      setLiveMercuryDrag(next);
      return;
    }
    if (!drawing.current) return;
    const p = toSvgPoint(e.clientX, e.clientY);
    if (!p) return;
    const appendIfFar = (
      prev: { x: number; y: number }[],
      next: { x: number; y: number },
    ): { x: number; y: number }[] => {
      const last = prev[prev.length - 1];
      if (!last) return [next];
      const dx = next.x - last.x;
      const dy = next.y - last.y;
      if (dx * dx + dy * dy < MIN_POINT_DIST_SQ) return prev;
      return [...prev, next];
    };
    if (tool === 'brush') {
      setLiveStroke((s) =>
        s ? { ...s, points: appendIfFar(s.points, p) } : s,
      );
    } else {
      setLiveEraser((s) =>
        s ? { ...s, points: appendIfFar(s.points, p) } : s,
      );
    }
  };

  const endStroke = () => {
    if (panning) {
      setPanning(false);
      return;
    }
    const frenchDrag = liveFrenchDragRef.current;
    if (frenchDrag) {
      liveFrenchDragRef.current = null;
      setLiveFrenchDrag(null);
      editCurrentFingerData((data) => {
        const element = data.pattern.find(
          (candidate): candidate is FrenchEdgeElement =>
            candidate.id === frenchDrag.id &&
            candidate.kind === 'french_edge' &&
            candidate.variant === 'arc',
        );
        if (element) element.classicControls = frenchDrag.controls;
      });
      return;
    }
    const mercuryDrag = liveMercuryDragRef.current;
    if (mercuryDrag) {
      liveMercuryDragRef.current = null;
      setLiveMercuryDrag(null);
      useEditorStore.getState().updateMercuryRibbonAnchor(mercuryDrag.index, mercuryDrag.anchors[mercuryDrag.index]);
      return;
    }
    if (!drawing.current) return;
    drawing.current = false;
    const stroke = liveStroke;
    const eraser = liveEraser;
    setLiveStroke(null);
    setLiveEraser(null);
    if (stroke && stroke.points.length > 1) {
      editCurrentFingerData((d) => {
        d.pattern.push(stroke);
      });
      recordStroke();
    } else if (eraser && eraser.points.length > 1) {
      editCurrentFingerData((d) => {
        d.pattern.push(eraser);
      });
    }
  };

  if (!doc || !sil) return null;

  const cursor = spaceDown ? (panning ? 'grabbing' : 'grab') : readOnly ? 'default' : 'crosshair';

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full overflow-hidden bg-canvas"
      style={{ cursor }}
      data-testid="nail-canvas"
      data-debug-id="studio.editor.canvas"
    >
      <div
        className="absolute left-0 top-0"
        style={{ transform: `translate(${panX}px, ${panY}px) scale(${zoom})`, transformOrigin: '0 0' }}
      >
        <svg
          ref={svgRef}
          viewBox={viewBox}
          width={320}
          height={canvasHeight}
          className="select-none rounded-card bg-white shadow-float"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endStroke}
          onPointerLeave={endStroke}
          dangerouslySetInnerHTML={{ __html: content }}
        />
      </div>

      {classicFrench && !readOnly && (
        <button
          type="button"
          onClick={() => setSelection({ layer: 'pattern', id: classicFrench.id })}
          className={cx(
            'absolute left-3 top-3 flex items-center gap-1.5 rounded-button border px-3 py-2 text-xs shadow-float',
            selectedClassic
              ? 'border-primary bg-primary text-white'
              : 'border-primary/30 bg-white text-primary hover:bg-primary-soft',
          )}
          data-testid="edit-french-curve"
        >
          <MousePointer2 size={13} />
          {selectedClassic ? text('正在编辑法式曲线', 'Editing French curve') : text('编辑法式曲线', 'Edit French curve')}
        </button>
      )}
      {selectedClassic && (
        <div className="pointer-events-none absolute left-1/2 top-3 -translate-x-1/2 rounded-panel border border-primary/20 bg-white/95 px-3 py-2 text-center text-[11px] text-gray-600 shadow-float">
          {text('拖动甲面上的左翼、中心、右翼三个粉色控制点', 'Drag the left, center and right pink handles on the nail')}
        </div>
      )}

      <button
        type="button"
        onClick={fitCanvas}
        className="absolute right-3 top-3 flex items-center gap-1 rounded-button border border-gray-200 bg-white/95 px-2 py-1.5 text-[11px] text-gray-600 shadow-float hover:text-primary"
        title="适合画布"
      >
        <Maximize2 size={12} />
        {text('适合画布', 'Fit')}
      </button>

      {/* 画布状态条 */}
      <div className="pointer-events-none absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-3 rounded-panel border border-gray-200 bg-white/95 px-3 py-1.5 text-xs text-gray-500 shadow-float">
        <span className="tnum">{Math.round(zoom * 100)}%</span>
        <span className="flex items-center gap-1">
          <Hand size={12} />
          {text('空格 + 拖拽平移 · 滚轮缩放', 'Space + drag to pan · Wheel to zoom')}
        </span>
        {readOnly && <span className="font-medium text-info">只读（已冻结）</span>}
      </div>
    </div>
  );
}
