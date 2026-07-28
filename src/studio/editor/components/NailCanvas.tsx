/**
 * 2D 设计画布（模块 4 · PRD §13.3）
 * - 画布形状 = 甲型轮廓（SVG clipPath，画不出边界）；
 * - 滚轮缩放 50%–400%（指针位置为缩放中心）；空格 + 拖拽平移；
 * - 画笔 / 橡皮 直接在轮廓内绘制（橡皮以 mask 作用于图案层）。
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Hand } from 'lucide-react';
import { getSilhouette } from '../lib/material';
import { nailContentSvg } from '../lib/render';
import { genId, resolveFingerData, type BrushElement, type EraserElement } from '../lib/model';
import { recordStroke } from '../lib/session-metrics';
import { useEditorStore } from '../store';

const PAD = 24; // viewBox 外扩（0.1mm 单位），避免描边被裁
/** 点距节流：小于此距离（0.1mm）不追加采样点 */
const MIN_POINT_DIST_SQ = 1.5 * 1.5;

export function NailCanvas() {
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

  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [spaceDown, setSpaceDown] = useState(false);
  const [panning, setPanning] = useState(false);
  const panStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 });
  const [liveStroke, setLiveStroke] = useState<BrushElement | null>(null);
  const [liveEraser, setLiveEraser] = useState<EraserElement | null>(null);
  const drawing = useRef(false);

  const sil = doc ? getSilhouette(doc.shape, doc.length) : null;

  const viewBox = useMemo(() => {
    if (!sil) return '0 0 100 100';
    const [x, y, w, h] = sil.viewBox.split(/\s+/).map(Number);
    return `${x - PAD} ${y - PAD} ${w + PAD * 2} ${h + PAD * 2}`;
  }, [sil]);

  const fingerData = doc ? resolveFingerData(doc, currentFinger) : null;

  const content = useMemo(() => {
    if (!doc || !sil || !fingerData) return '';
    return nailContentSvg(
      {
        shape: doc.shape,
        length: doc.length,
        data: fingerData,
        uid: 'canvas',
        liveStroke,
        liveEraser,
      },
      sil,
    );
  }, [doc, sil, fingerData, liveStroke, liveEraser]);

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
    const p = toSvgPoint(e.clientX, e.clientY);
    if (!p) return;
    drawing.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    if (tool === 'brush') {
      setLiveStroke({
        id: genId('el_brush'),
        kind: 'brush',
        points: [p],
        color: brushColor,
        size: brushSize,
        opacity: brushOpacity,
      });
    } else {
      setLiveEraser({ id: genId('el_eraser'), kind: 'eraser', points: [p], size: eraserSize });
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
    >
      <div
        className="absolute left-0 top-0"
        style={{ transform: `translate(${panX}px, ${panY}px) scale(${zoom})`, transformOrigin: '0 0' }}
      >
        <svg
          ref={svgRef}
          viewBox={viewBox}
          width={320}
          height={Math.round(320 * (Number(viewBox.split(/\s+/)[3]) / Number(viewBox.split(/\s+/)[2])))}
          className="select-none rounded-card bg-white shadow-float"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endStroke}
          onPointerLeave={endStroke}
          dangerouslySetInnerHTML={{ __html: content }}
        />
      </div>

      {/* 画布状态条 */}
      <div className="pointer-events-none absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-3 rounded-panel border border-gray-200 bg-white/95 px-3 py-1.5 text-xs text-gray-500 shadow-float">
        <span className="tnum">{Math.round(zoom * 100)}%</span>
        <span className="flex items-center gap-1">
          <Hand size={12} />
          空格 + 拖拽平移 · 滚轮缩放
        </span>
        {readOnly && <span className="font-medium text-info">只读（已冻结）</span>}
      </div>
    </div>
  );
}
