import type { UVPoint } from './recipe-model.ts';
import { sampleSilhouettePath } from './french-edge.ts';

export interface NailPoint { x: number; y: number; }
export interface SafePointResult { point: NailPoint; warning?: string; clamped: boolean; }
export interface NailSurfaceMapper { point(uv: UVPoint): NailPoint; safePoint(uv: UVPoint, clearanceMm: number, radiusMm?: number): SafePointResult; path(anchors: UVPoint[], clearanceMm: number): { points: NailPoint[]; warnings: string[] }; }
const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

export function createMapperFromSilhouette(pathD: string): NailSurfaceMapper | null {
  const points = sampleSilhouettePath(pathD);
  if (points.length < 4) return null;
  const xs = points.map((p) => p.x); const ys = points.map((p) => p.y);
  const minX = Math.min(...xs); const maxX = Math.max(...xs); const minY = Math.min(...ys); const maxY = Math.max(...ys);
  const height = Math.max(1, maxY - minY); const width = Math.max(1, maxX - minX);
  const boundaryAt = (v: number) => {
    const y = minY + clamp01(v) * height; const band = Math.max(3, height * 0.06);
    const near = points.filter((p) => Math.abs(p.y - y) <= band);
    return near.length < 2 ? { left: minX, right: maxX, y } : { left: Math.min(...near.map((p) => p.x)), right: Math.max(...near.map((p) => p.x)), y };
  };
  const point = (uv: UVPoint): NailPoint => { const b = boundaryAt(uv.v); return { x: b.left + clamp01(uv.u) * (b.right - b.left), y: b.y }; };
  const safePoint = (uv: UVPoint, clearanceMm: number, radiusMm = 0): SafePointResult => {
    const b = boundaryAt(uv.v); const margin = Math.max(0, clearanceMm + radiusMm); const available = Math.max(0, b.right - b.left);
    const ratio = available > 0 ? Math.min(0.48, margin / Math.max(available, width * 0.08)) : 0.48;
    const safeU = Math.min(1 - ratio, Math.max(ratio, clamp01(uv.u))); const result = point({ u: safeU, v: uv.v });
    const clamped = Math.abs(safeU - uv.u) > 0.0001 || uv.v < 0 || uv.v > 1;
    return clamped ? { point: result, clamped: true, warning: `UV 已吸附到 ${clearanceMm.toFixed(1)}mm 安全区` } : { point: result, clamped: false };
  };
  return { point, safePoint, path: (anchors, clearanceMm) => { const mapped = anchors.map((a) => safePoint(a, clearanceMm)); return { points: mapped.map((x) => x.point), warnings: mapped.flatMap((x) => x.warning ? [x.warning] : []) }; } };
}
