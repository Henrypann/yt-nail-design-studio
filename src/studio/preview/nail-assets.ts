/**
 * NailSlot 动态资产加载（DEV-PLAN §4.4 / material-library README 消费约定）
 *
 * 数据一律 fetch 自 /material-library/* 与 /assets/*（vite 静态资产插件暴露），
 * 前端不硬编码模板清单、轮廓路径或坐标。模块级 Promise 缓存：
 * 一次生成后改色均不重新拉取（PRD §12.4）。
 *
 * v1.4.1：legacy 手部底图/anchor 定位（loadHandView · nailScale · PX_PER_MM ·
 * HAND_VIEWBOX）随 Palm 视图软删除一并退役；Back 定位见 src/studio/render/
 * （NailSlot V2 界标仿射）。本模块只保留轮廓/图案/附件加载。
 */

import type { NailLength, NailShape } from '@/lib/types';

/* ── 数据结构（与 assets / material-library JSON 对齐） ── */

export interface SilhouetteAsset {
  shape: NailShape;
  length: NailLength;
  viewBox: string;
  /** 轮廓 path d（0.1mm 单位，原点 = 甲根中心，甲尖负 y） */
  d: string;
}

export interface PatternAsset {
  templateId: string;
  shape: NailShape;
  /** 已剥离 clipPath、id 唯一化的 artwork 标记（含渐变 defs） */
  innerMarkup: string;
}

export interface DecorationDef {
  id: string;
  name: string;
  file: string;
  defaults: { x: number; y: number; scale: number; rotation: number; heightMm: number };
}

export interface DecorationAsset extends DecorationDef {
  innerMarkup: string;
}

/* ── 常量 ── */

/** 图案/附件 SVG 按 medium（18mm）基准设计，其他长度按此比例缩放 */
export const PATTERN_BASE_LENGTH_MM = 18;

/* ── fetch 缓存 ── */

const textCache = new Map<string, Promise<string>>();

function fetchText(url: string): Promise<string> {
  let p = textCache.get(url);
  if (!p) {
    p = fetch(url).then((res) => {
      if (!res.ok) throw new Error(`资产加载失败：${url}（HTTP ${res.status}）`);
      return res.text();
    });
    textCache.set(url, p);
    // 失败后允许重试时重新拉取
    p.catch(() => textCache.delete(url));
  }
  return p;
}

async function fetchJson<T>(url: string): Promise<T> {
  return JSON.parse(await fetchText(url)) as T;
}

/* ── SVG 标记处理 ── */

/** 提取 <svg> 内部标记 */
function extractSvgInner(svgText: string): string {
  const m = svgText.match(/<svg[^>]*>([\s\S]*)<\/svg>\s*$/);
  return m?.[1] ?? '';
}

/** 去除 clipPath 定义与其引用（渲染器用自己的轮廓 clip，避免 id 冲突） */
function stripNailClip(markup: string): string {
  return markup
    .replace(/<clipPath[\s\S]*?<\/clipPath>/g, '')
    .replace(/\s*clip-path="url\(#nail-clip[^"]*\)"/g, '');
}

/** id 唯一化：id="x" → id="x-uid"，同步改写 url(#x) / href="#x" 引用 */
function uniquifyIds(markup: string, uid: string): string {
  const ids = new Set<string>();
  for (const m of markup.matchAll(/id="([^"]+)"/g)) ids.add(m[1]);
  let out = markup;
  for (const id of ids) {
    out = out
      .split(`id="${id}"`).join(`id="${id}-${uid}"`)
      .split(`url(#${id})`).join(`url(#${id}-${uid})`)
      .split(`href="#${id}"`).join(`href="#${id}-${uid}"`);
  }
  return out;
}

let uidCounter = 0;
function nextUid(prefix: string): string {
  uidCounter += 1;
  return `${prefix}-${uidCounter}`;
}

/* ── 加载器 ── */

/** 长度 ID → 轮廓文件名（'-' → '_'，如 extra-long → extra_long） */
export function silhouetteFileName(shape: NailShape, length: NailLength): string {
  return `${shape}_${length.replace(/-/g, '_')}.svg`;
}

const silhouetteCache = new Map<string, Promise<SilhouetteAsset>>();

export function loadSilhouette(shape: NailShape, length: NailLength): Promise<SilhouetteAsset> {
  const key = `${shape}/${length}`;
  let p = silhouetteCache.get(key);
  if (!p) {
    p = (async () => {
      const text = await fetchText(`/material-library/shapes/silhouettes/${silhouetteFileName(shape, length)}`);
      const doc = new DOMParser().parseFromString(text, 'image/svg+xml');
      const root = doc.querySelector('svg');
      const outline = doc.querySelector('svg > path');
      const d = outline?.getAttribute('d') ?? doc.querySelector('clipPath path')?.getAttribute('d');
      if (!root || !d) throw new Error(`轮廓 SVG 解析失败：${key}`);
      return { shape, length, viewBox: root.getAttribute('viewBox') ?? '-60 -200 120 220', d };
    })();
    silhouetteCache.set(key, p);
    p.catch(() => silhouetteCache.delete(key));
  }
  return p;
}

const patternCache = new Map<string, Promise<PatternAsset>>();

export function loadPattern(templateId: string, shape: NailShape): Promise<PatternAsset> {
  const key = `${templateId}/${shape}`;
  let p = patternCache.get(key);
  if (!p) {
    p = (async () => {
      const text = await fetchText(`/material-library/templates/${templateId}/patterns/${shape}.svg`);
      const inner = uniquifyIds(stripNailClip(extractSvgInner(text)), nextUid('pt'));
      return { templateId, shape, innerMarkup: inner };
    })();
    patternCache.set(key, p);
    p.catch(() => patternCache.delete(key));
  }
  return p;
}

let decorationsCache: Promise<DecorationAsset[]> | null = null;

export function loadDecorations(): Promise<DecorationAsset[]> {
  if (!decorationsCache) {
    decorationsCache = (async () => {
      const manifest = await fetchJson<{ decorations: DecorationDef[] }>('/assets/decorations/manifest.json');
      return Promise.all(
        manifest.decorations.map(async (d) => ({
          ...d,
          innerMarkup: uniquifyIds(
            extractSvgInner(await fetchText(`/assets/decorations/${d.file}`)),
            nextUid('dc'),
          ),
        })),
      );
    })();
    decorationsCache.catch(() => {
      decorationsCache = null;
    });
  }
  return decorationsCache;
}
