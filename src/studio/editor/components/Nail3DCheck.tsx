/**
 * 3D 单甲检查（模块 4 · PRD §13.5 · 只读检查工具，红线：不可编辑）
 *
 * 实现选型：参数化半椭球壳 mesh + 自研轻量 Canvas 渲染（零新增依赖，替代 three.js）：
 * - 拖拽自由旋转（偏航/俯仰，Arcball 心智）；
 * - 线框 / 实体切换；[固定侧视机位] 一键检查浮雕高度与边缘刮手；
 * - 附件高度热力点为 MOCK 示意（绿 ≤0.15 / 黄 ≤0.25 / 红 >0.25mm）。
 * 原型期几何与热力图为 MOCK；视图上不提供任何编辑控件。
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Box, Grid3X3, RotateCcw, X } from 'lucide-react';
import { Button, cx } from '@/design-system';
import { resolveFingerData } from '../lib/model';
import { useEditorStore } from '../store';

type V3 = [number, number, number];

interface Mesh {
  vertices: V3[];
  quads: [number, number, number, number][];
}

/** 参数化半椭球壳：a 半宽 / b 长度 / c 拱高（相对单位），甲尖在 -y */
function buildShell(latSegs: number, lonSegs: number): Mesh {
  const vertices: V3[] = [];
  const quads: [number, number, number, number][] = [];
  for (let i = 0; i <= latSegs; i++) {
    const phi = (i / latSegs) * (Math.PI / 2); // 0 尖 → π/2 根
    for (let j = 0; j <= lonSegs; j++) {
      const theta = (j / lonSegs) * Math.PI; // 截面半弧
      const x = Math.cos(theta) * Math.sin(phi) * 0.55;
      const y = -Math.cos(phi) * 0.9 + 0.9; // 尖 0 → 根 1.8
      const z = Math.sin(theta) * Math.sin(phi) * 0.28;
      vertices.push([x, 1.8 - y, z]);
    }
  }
  const row = lonSegs + 1;
  for (let i = 0; i < latSegs; i++) {
    for (let j = 0; j < lonSegs; j++) {
      const a = i * row + j;
      quads.push([a, a + 1, a + 1 + row, a + row]);
    }
  }
  return { vertices, quads };
}

const MESH = buildShell(14, 18);

function heatColor(heightMm: number): string {
  if (heightMm <= 0.15) return '#34A853';
  if (heightMm <= 0.25) return '#E8A13A';
  return '#D64541';
}

export function Nail3DCheck(props: { onClose: () => void }) {
  const { onClose } = props;
  const doc = useEditorStore((s) => s.doc);
  const currentFinger = useEditorStore((s) => s.currentFinger);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [wireframe, setWireframe] = useState(false);
  const rot = useRef({ yaw: 0.5, pitch: -0.35 });
  const drag = useRef<{ x: number; y: number } | null>(null);
  const [, forceDraw] = useState(0);

  const data = doc ? resolveFingerData(doc, currentFinger) : null;

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !data) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const W = canvas.width;
    const H = canvas.height;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#18181B';
    ctx.fillRect(0, 0, W, H);

    const { yaw, pitch } = rot.current;
    const cy = Math.cos(yaw);
    const sy = Math.sin(yaw);
    const cp = Math.cos(pitch);
    const sp = Math.sin(pitch);
    const scale = H * 0.32;
    const cxp = W / 2;
    const cyp = H / 2;

    const project = (v: V3): { x: number; y: number; z: number } => {
      // 偏航（绕 y）→ 俯仰（绕 x）
      const x1 = v[0] * cy + v[2] * sy;
      const z1 = -v[0] * sy + v[2] * cy;
      const y2 = (v[1] - 0.9) * cp - z1 * sp;
      const z2 = (v[1] - 0.9) * sp + z1 * cp;
      return { x: cxp + x1 * scale, y: cyp - y2 * scale, z: z2 };
    };

    const projected = MESH.vertices.map(project);

    if (wireframe) {
      ctx.strokeStyle = '#9F9FA9';
      ctx.lineWidth = 1;
      for (const [a, b, c, d] of MESH.quads) {
        ctx.beginPath();
        ctx.moveTo(projected[a].x, projected[a].y);
        ctx.lineTo(projected[b].x, projected[b].y);
        ctx.lineTo(projected[c].x, projected[c].y);
        ctx.lineTo(projected[d].x, projected[d].y);
        ctx.closePath();
        ctx.stroke();
      }
    } else {
      // 实体：画家算法 + 按法线 z 平面着色
      const faces = MESH.quads.map((q) => {
        const pts = q.map((i) => projected[i]);
        const zAvg = pts.reduce((s, p) => s + p.z, 0) / 4;
        const u = { x: pts[1].x - pts[0].x, y: pts[1].y - pts[0].y };
        const v = { x: pts[3].x - pts[0].x, y: pts[3].y - pts[0].y };
        const nz = u.x * v.y - u.y * v.x;
        return { pts, zAvg, nz };
      });
      faces.sort((f1, f2) => f1.zAvg - f2.zAvg);
      for (const f of faces) {
        const shade = Math.max(0, Math.min(1, 0.55 + f.nz / 9000));
        const base = [240, 78, 126]; // DESIGN v1.1 主色 #F04E7E
        ctx.fillStyle = `rgb(${base.map((c) => Math.round(c * shade + 40 * (1 - shade))).join(',')})`;
        ctx.beginPath();
        ctx.moveTo(f.pts[0].x, f.pts[0].y);
        for (let k = 1; k < 4; k++) ctx.lineTo(f.pts[k].x, f.pts[k].y);
        ctx.closePath();
        ctx.fill();
      }
    }

    // 附件高度热力点（MOCK）：transform.x/y（0.1mm 单位）映射到壳面
    for (const att of data.attachments) {
      const u = Math.max(-0.5, Math.min(0.5, att.transform.x / 110));
      const vPos = Math.max(0.05, Math.min(0.95, -att.transform.y / 200));
      const phi = vPos * (Math.PI / 2);
      const theta = (u + 0.5) * Math.PI;
      const lift = att.heightMm * 1.2; // 高度夸张化便于检查（MOCK）
      const p = project([
        Math.cos(theta) * Math.sin(phi) * (0.55 + lift * 0.1),
        1.8 - (-Math.cos(phi) * 0.9 + 0.9) - 0.9 + 0.9,
        Math.sin(theta) * Math.sin(phi) * (0.28 + lift * 0.1),
      ]);
      const onFront = p.z > -0.1;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 5 + att.heightMm * 14, 0, Math.PI * 2);
      ctx.fillStyle = heatColor(att.heightMm);
      ctx.globalAlpha = onFront ? 0.9 : 0.25;
      ctx.fill();
      ctx.globalAlpha = 1;
      if (onFront) {
        ctx.fillStyle = '#FAFAFA';
        ctx.font = '10px sans-serif';
        ctx.fillText(`${att.heightMm.toFixed(2)}mm`, p.x + 8, p.y + 3);
      }
    }

    // 图例
    ctx.fillStyle = '#A1A1AA';
    ctx.font = '11px sans-serif';
    ctx.fillText('高度热力（MOCK）', 14, H - 44);
    const legend: [string, string][] = [
      ['#34A853', '≤0.15mm'],
      ['#E8A13A', '≤0.25mm'],
      ['#D64541', '>0.25mm'],
    ];
    legend.forEach(([color, label], i) => {
      ctx.fillStyle = color;
      ctx.fillRect(14, H - 34 + i * 14, 8, 8);
      ctx.fillStyle = '#A1A1AA';
      ctx.fillText(label, 28, H - 27 + i * 14);
    });
  }, [data, wireframe]);

  useEffect(() => {
    draw();
  }, [draw]);

  const onPointerDown = (e: React.PointerEvent) => {
    drag.current = { x: e.clientX, y: e.clientY };
    (e.target as Element).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current) return;
    rot.current.yaw += (e.clientX - drag.current.x) * 0.008;
    rot.current.pitch = Math.max(
      -1.4,
      Math.min(1.4, rot.current.pitch + (e.clientY - drag.current.y) * 0.008),
    );
    drag.current = { x: e.clientX, y: e.clientY };
    forceDraw((n) => n + 1);
  };
  const onPointerUp = () => {
    drag.current = null;
  };

  if (!doc) return null;

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-gray-950 animate-fade-in">
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-white/10 px-5">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-semibold text-gray-100">3D 单甲检查 · {currentFinger}</h2>
          <span className="rounded-button border border-warning/40 bg-warning/15 px-2 py-0.5 text-nano font-medium text-warning">
            原型期几何与热力图为 MOCK · 只读
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-button border border-white/15 p-0.5">
            <button
              onClick={() => setWireframe(false)}
              className={cx(
                'flex items-center gap-1 rounded-button px-2.5 py-1 text-xs transition-colors duration-fast',
                !wireframe ? 'bg-white/15 text-white' : 'text-gray-400 hover:text-gray-200',
              )}
            >
              <Box size={12} />
              实体
            </button>
            <button
              onClick={() => setWireframe(true)}
              className={cx(
                'flex items-center gap-1 rounded-button px-2.5 py-1 text-xs transition-colors duration-fast',
                wireframe ? 'bg-white/15 text-white' : 'text-gray-400 hover:text-gray-200',
              )}
            >
              <Grid3X3 size={12} />
              线框
            </button>
          </div>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              rot.current = { yaw: Math.PI / 2, pitch: 0 };
              forceDraw((n) => n + 1);
            }}
          >
            <RotateCcw size={13} />
            固定侧视机位
          </Button>
          <Button size="sm" variant="secondary" onClick={onClose}>
            <X size={14} />
            返回设计
          </Button>
        </div>
      </header>

      <main className="flex flex-1 items-center justify-center">
        <canvas
          ref={canvasRef}
          width={760}
          height={560}
          className="cursor-grab touch-none rounded-card active:cursor-grabbing"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerUp}
        />
      </main>

      <footer className="flex h-10 shrink-0 items-center justify-center border-t border-white/10 text-nano text-gray-400">
        拖拽旋转检查浮雕高度与边缘刮手 · 3D 视图是检查工具，不可编辑 · 正式几何由算法组工艺映射引擎产出
      </footer>
    </div>
  );
}
