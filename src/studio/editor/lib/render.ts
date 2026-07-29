/**
 * SVG 合成渲染 + PNG 导出（模块 4）
 *
 * 合成顺序与后端预览 Pipeline 同构（material-library/README §合成方式）：
 * 底色填充（clip 内）→ 图案叠加（模板/手绘/导入，橡皮以 mask 作用于整组）→ 附件。
 * 画布、平铺预览、缩略图、PNG 导出共用这一套合成函数。
 */

import type { FingerCode, NailShape } from '@/lib/types';
import { FINGER_CODES } from '@/lib/types';
import { fingerDisplayRatio, fingerDisplayScale } from '@/studio/finger-display';
import { getDecorationInner, getPatternArtwork, getSilhouette, type SilhouetteInfo } from './material';
import { buildFrenchEdgePaths } from './french-edge';
import type {
  AttachmentElement,
  EditorDoc,
  FingerData,
  PatternElement,
  SurfaceAppearance,
  Transform,
} from './model';
import { resolveFingerData } from './model';

/** 每个 nail 实例的 clip id 前缀，防止同页多实例冲突 */
function renameInternalIds(inner: string, uid: string): string {
  // 注：tsconfig lib 为 ES2020，String.replaceAll（ES2021）不可用，用 split/join 等价替换
  return inner
    .split('id="nail-clip"').join(`id="nail-clip-${uid}"`)
    .split('url(#nail-clip)').join(`url(#nail-clip-${uid})`);
}

function transformAttr(t: Transform): string {
  return `translate(${t.x} ${t.y}) rotate(${t.rotation}) scale(${t.scale})`;
}

function pointsAttr(points: { x: number; y: number }[]): string {
  return points.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
}

type BrushEl = Extract<PatternElement, { kind: 'brush' }>;
type EraserEl = Extract<PatternElement, { kind: 'eraser' }>;

function brushStroke(el: BrushEl): string {
  return `<polyline points="${pointsAttr(el.points)}" fill="none" stroke="${el.color}" stroke-width="${el.size}" stroke-linecap="round" stroke-linejoin="round" opacity="${el.opacity}"/>`;
}

function eraserStroke(el: EraserEl): string {
  return `<polyline points="${pointsAttr(el.points)}" fill="none" stroke="#000" stroke-width="${el.size}" stroke-linecap="round" stroke-linejoin="round"/>`;
}

function patternElementSvg(
  el: PatternElement,
  shape: NailShape,
  length: EditorDoc['length'],
  uid: string,
): string {
  switch (el.kind) {
    case 'template_pattern': {
      const art = getPatternArtwork(el.templateId, shape);
      if (!art) return '';
      return `<g transform="${transformAttr(el.transform)}">${renameInternalIds(art.inner, uid)}</g>`;
    }
    case 'french_edge': {
      const sil = getSilhouette(shape, length);
      if (!sil) return '';
      const { fillD, strokePaths } = buildFrenchEdgePaths(sil, el);
      const fill = `<path d="${fillD}" fill="${el.fillColor}"/>`;
      const strokes =
        (el.outlineEnabled ?? false) || el.variant === 'double'
          ? strokePaths
              .map(
                (d) =>
                  `<path d="${d}" fill="none" stroke="${el.strokeColor}" stroke-width="${el.strokeWidth}" stroke-linecap="butt" stroke-linejoin="round"/>`,
              )
              .join('')
          : '';
      return `<g transform="${transformAttr(el.transform)}">${fill}${strokes}</g>`;
    }
    case 'brush':
      return brushStroke(el);
    case 'image': {
      const w = 80;
      const h = el.height > 0 ? (80 * el.height) / el.width : 80;
      return `<g transform="${transformAttr(el.transform)}"><image href="${el.dataUrl}" x="${-w / 2}" y="${-h / 2}" width="${w}" height="${h}"/></g>`;
    }
    case 'gradient': {
      const gradientId = `recipe-gradient-${uid}-${el.id.replace(/[^a-zA-Z0-9_-]/g, '')}`;
      return `<defs><linearGradient id="${gradientId}" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="-200">
        <stop offset="0" stop-color="${el.rootColor}" stop-opacity="${el.rootOpacity}"/>
        <stop offset="1" stop-color="${el.tipColor}" stop-opacity="${el.tipOpacity}"/>
      </linearGradient></defs><rect x="-400" y="-600" width="800" height="900" fill="url(#${gradientId})"/>`;
    }
    case 'eraser':
      return ''; // 橡皮不直接渲染，进入 mask
  }
}

function attachmentSvg(el: AttachmentElement): string {
  const inner = getDecorationInner(el.decorationId);
  if (!inner) return '';
  return `<g transform="${transformAttr(el.transform)}">${inner}</g>`;
}

export interface NailRenderInput {
  shape: NailShape;
  length: EditorDoc['length'];
  data: FingerData;
  /** 实例唯一前缀（同一文档内多个 nail 同时渲染时区分 clip/mask id） */
  uid: string;
  /** 正在绘制中的草稿笔画/橡皮（画布实时预览） */
  liveStroke?: BrushEl | null;
  liveEraser?: EraserEl | null;
  appearance?: SurfaceAppearance;
}

function parseViewBox(viewBox: string): [number, number, number, number] {
  const [x, y, w, h] = viewBox.split(/\s+/).map(Number);
  return [x, y, w, h];
}

/** 单个指甲的 SVG 内容（不含外层 <svg>），可嵌入任意容器 */
export function nailContentSvg(input: NailRenderInput, sil: SilhouetteInfo): string {
  const uid = input.uid;
  const visiblePattern = input.data.pattern
    .filter((element) => element.visible)
    .slice()
    .sort((a, b) => a.order - b.order);
  const erasers = visiblePattern.filter((el): el is EraserEl => el.kind === 'eraser');
  const drawables = visiblePattern.filter((el) => el.kind !== 'eraser');

  const maskStrokes = erasers.map(eraserStroke).join('');
  const liveMask =
    input.liveEraser && input.liveEraser.points.length > 1 ? eraserStroke(input.liveEraser) : '';

  const patternSvg =
    drawables.map((el) => patternElementSvg(el, input.shape, input.length, uid)).join('') +
    (input.liveStroke && input.liveStroke.points.length > 1 ? brushStroke(input.liveStroke) : '');

  const attachments = input.data.attachments
    .filter((element) => element.visible)
    .slice()
    .sort((a, b) => a.order - b.order)
    .map(attachmentSvg)
    .join('');
  const appearance = input.appearance ?? {
    baseCoverage: 'opaque',
    opticalEffect: 'none',
    topFinish: 'gloss',
  };
  const baseOpacity = appearance.baseCoverage === 'translucent' ? 0.72 : 1;
  const glossOpacity = appearance.topFinish === 'matte' ? 0.03 : 0.34;
  const pearlOpacity = appearance.opticalEffect === 'pearl' ? 0.2 : 0;

  return `<defs>
    <clipPath id="clip-${uid}"><path d="${sil.pathD}"/></clipPath>
    <mask id="eraser-${uid}" maskUnits="userSpaceOnUse" x="-400" y="-600" width="800" height="900">
      <rect x="-400" y="-600" width="800" height="900" fill="#fff"/>
      ${maskStrokes}${liveMask}
    </mask>
    <linearGradient id="curve-${uid}" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#2D1720" stop-opacity="0.22"/>
      <stop offset="0.22" stop-color="#FFFFFF" stop-opacity="0.02"/>
      <stop offset="0.68" stop-color="#FFFFFF" stop-opacity="0.16"/>
      <stop offset="1" stop-color="#2D1720" stop-opacity="0.2"/>
    </linearGradient>
    <linearGradient id="gloss-${uid}" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#FFFFFF" stop-opacity="0"/>
      <stop offset="0.34" stop-color="#FFFFFF" stop-opacity="0"/>
      <stop offset="0.47" stop-color="#FFFFFF" stop-opacity="${glossOpacity}"/>
      <stop offset="0.58" stop-color="#FFFFFF" stop-opacity="0.04"/>
      <stop offset="1" stop-color="#FFFFFF" stop-opacity="0"/>
    </linearGradient>
    <linearGradient id="pearl-${uid}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#FDEBFF" stop-opacity="${pearlOpacity}"/>
      <stop offset="0.5" stop-color="#FFF7E7" stop-opacity="0"/>
      <stop offset="1" stop-color="#DDEBFF" stop-opacity="${pearlOpacity}"/>
    </linearGradient>
  </defs>
  <g clip-path="url(#clip-${uid})">
    <rect x="-400" y="-600" width="800" height="900" fill="${input.data.baseColor}" opacity="${baseOpacity}"/>
    <g mask="url(#eraser-${uid})">${patternSvg}</g>
    ${attachments}
    <path d="${sil.pathD}" fill="url(#curve-${uid})" opacity="0.48" pointer-events="none"/>
    <path d="${sil.pathD}" fill="url(#gloss-${uid})" pointer-events="none"/>
    <path d="${sil.pathD}" fill="url(#pearl-${uid})" pointer-events="none"/>
  </g>
  <path d="${sil.pathD}" fill="none" stroke="#8A8A92" stroke-width="2" stroke-linejoin="round"/>`;
}

/** 独立单甲 SVG 文档字符串（导出 PNG / 缩略图用） */
export function composeNailSvg(input: NailRenderInput, pixelPerUnit = 4): string | null {
  const sil = getSilhouette(input.shape, input.length);
  if (!sil) return null;
  const [, , w, h] = parseViewBox(sil.viewBox);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${sil.viewBox}" width="${Math.round(
    w * pixelPerUnit,
  )}" height="${Math.round(h * pixelPerUnit)}">${nailContentSvg(input, sil)}</svg>`;
}

/* ── 十指平铺（简版：5×2 网格；Palm 反向仅作用显示层 xPalm = 1 - xModel） ── */

export interface TiledRenderOpts {
  view: 'back' | 'palm';
  /** 降级指（Mock 单指失败）：显示灰甲型 + ⚠️，其余 9 指正常 */
  degradedFinger?: FingerCode | null;
  markBadges?: boolean;
}

export function composeTiledSvg(doc: EditorDoc, opts: TiledRenderOpts): string | null {
  const sil = getSilhouette(doc.shape, doc.length);
  if (!sil) return null;
  const [vx, vy, vw, vh] = parseViewBox(sil.viewBox);
  const cellW = 150;
  const cellH = 220;
  const maxScale = (cellH - 52) / vh;
  const width = cellW * 5;
  const height = cellH * 2;

  const cells = FINGER_CODES.map((finger, i) => {
    const col = i % 5;
    const row = Math.floor(i / 5);
    const cx = col * cellW + cellW / 2;
    const cy = row * cellH + cellH / 2 - 6;
    const displayScale = fingerDisplayScale(finger);
    const scale = maxScale * fingerDisplayRatio(finger);
    const mirror = opts.view === 'palm' ? 'scale(-1 1) ' : '';
    const locked = doc.fingerLocks[finger] !== undefined;
    const isMaster = doc.masterFinger === finger;
    const labelY = cy + (vh * maxScale) / 2 + 18;

    if (opts.degradedFinger === finger) {
      return `<g data-finger="${finger}" data-display-scale="${displayScale}" transform="translate(${cx} ${cy}) scale(${scale})">
          <path d="${sil.pathD}" transform="translate(${-(vx + vw / 2)} ${-(vy + vh / 2)})" fill="#E4E4E7" stroke="#A1A1AA" stroke-width="2"/>
        </g>
        <text x="${cx}" y="${cy}" text-anchor="middle" font-size="18">⚠️</text>
        <text x="${cx}" y="${labelY}" text-anchor="middle" font-size="12" fill="#71717A" font-family="sans-serif">${finger} · 渲染失败</text>`;
    }

    const data = resolveFingerData(doc, finger);
    const content = nailContentSvg(
      { shape: doc.shape, length: doc.length, data, uid: `t-${finger}`, appearance: doc.appearance },
      sil,
    );
    const badge = opts.markBadges
      ? `<text x="${cx}" y="${labelY}" text-anchor="middle" font-size="12" fill="#52525B" font-family="sans-serif">${finger}${isMaster ? ' 💗' : ''}${locked ? ' 🔓' : ''}</text>`
      : '';
    return `<g data-finger="${finger}" data-display-scale="${displayScale}" transform="translate(${cx} ${cy})">
        <g transform="${mirror}scale(${scale}) translate(${-(vx + vw / 2)} ${-(vy + vh / 2)})">${content}</g>
      </g>${badge}`;
  }).join('');

  const rowLabel = (row: number, text: string) =>
    opts.markBadges
      ? `<text x="12" y="${row * cellH + 20}" font-size="12" fill="#A1A1AA" font-family="sans-serif">${text}</text>`
      : '';

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width * 2}" height="${height * 2}">
    <rect width="${width}" height="${height}" fill="#FAFAFA"/>
    ${rowLabel(0, opts.view === 'palm' ? '右手（Palm · 显示层镜像）' : '左手')}
    ${rowLabel(1, opts.view === 'palm' ? '左手（Palm · 显示层镜像）' : '右手')}
    ${cells}
  </svg>`;
}

/* ── PNG 导出（原型期唯一导出形态） ────────────────────── */

export function svgToPngDataUrl(svg: string, width: number, height: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        URL.revokeObjectURL(url);
        reject(new Error('Canvas 2D 上下文不可用'));
        return;
      }
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('SVG 栅格化失败'));
    };
    img.src = url;
  });
}

export function downloadDataUrl(dataUrl: string, filename: string): void {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}
