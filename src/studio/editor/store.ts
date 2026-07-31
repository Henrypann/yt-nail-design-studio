/**
 * Editor 状态store（模块 4）：Zustand + 完整 Undo/Redo 历史栈（⌘Z / ⌘⇧Z）。
 * 文档持久化经 repo（localStorage envelope + 数据桥 ProjectV3 画布键）。
 */

import { create } from 'zustand';
import type { DesignStatus, FingerCode } from '@/lib/types';
import { isReadOnly } from '@/lib/state-machine';
import { isScenarioOn, useMockScenarios } from '@/lib/mock-panel';
import type { AttachmentElement, EditorDoc, FingerData, FrenchEdgeVariant, PatternElement, Transform } from './lib/model';
import {
  createLayerMeta,
  genId,
  IDENTITY_TRANSFORM,
  normalizeEditorLayerOrders,
  resolveFingerData,
} from './lib/model';
import { buildRecipePattern, type EditorRecipeId } from './lib/recipes';
import { getSilhouette } from './lib/material';
import {
  defaultClassicControls,
  defaultFrenchParams,
} from './lib/french-edge';
import {
  getDesign,
  getEditorDocResult,
  saveEditorDoc,
  upsertDesign,
  writeCanvasEnvelope,
} from './lib/repo';
import { composeNailSvg, svgToPngDataUrl } from './lib/render';
import {
  LEFT_FINGERS,
  mirrorFingerData,
  oppositeFinger,
  type MirrorMode,
} from './lib/mirror';
import { ensureSession, recordFrenchEdge, recordMirror, recordUndo } from './lib/session-metrics';

export type EditorTool = 'brush' | 'eraser';
export type SaveState = 'saved' | 'dirty' | 'saving' | 'error';
export type BrushPreset = 'fine' | 'standard' | 'thick';
export type EditorEditScope = 'single' | 'all';
export type { EditorRecipeId } from './lib/recipes';

/** 线宽（0.1mm 单位）：细 0.5mm / 标准 1.2mm / 粗 2.5mm */
export const BRUSH_PRESET_SIZES: Record<BrushPreset, number> = {
  fine: 5,
  standard: 12,
  thick: 25,
};

export interface ElementRef {
  layer: 'pattern' | 'attachment';
  id: string;
}

const HISTORY_LIMIT = 200;

interface EditorState {
  designId: string | null;
  status: DesignStatus | null;
  doc: EditorDoc | null;
  readOnly: boolean;

  currentFinger: FingerCode;
  /** 默认单甲编辑；只有显式切换 all 才修改共享十指基底。 */
  editScope: EditorEditScope;
  tool: EditorTool;
  brushColor: string;
  brushSize: number;
  brushPreset: BrushPreset;
  brushOpacity: number;
  eraserSize: number;

  zoom: number; // 0.5 – 4
  panX: number;
  panY: number;

  selection: ElementRef | null;

  history: EditorDoc[];
  future: EditorDoc[];
  saveState: SaveState;

  load: (designId: string) => 'ok' | 'missing' | 'invalid' | 'unsupported';
  unload: () => void;

  /** 提交一次可撤销修改（推入历史栈） */
  commit: (mutate: (doc: EditorDoc) => void) => void;
  undo: () => void;
  redo: () => void;

  setTool: (tool: EditorTool) => void;
  setBrush: (opts: Partial<{ color: string; size: number; opacity: number }>) => void;
  setBrushPreset: (preset: BrushPreset) => void;
  setEraserSize: (size: number) => void;

  mirrorToOpposite: (mode: MirrorMode) => void;
  mirrorLeftHandToRight: (mode: MirrorMode) => void;
  setView: (view: Partial<{ zoom: number; panX: number; panY: number }>) => void;
  setCurrentFinger: (finger: FingerCode) => void;
  setEditScope: (scope: EditorEditScope) => void;
  setSelection: (sel: ElementRef | null) => void;

  /** 一键插入参数化法式边（当前指 pattern 层） */
  insertFrenchEdge: (opts: {
    variant: FrenchEdgeVariant;
    fillColor: string;
    outlineEnabled: boolean;
    strokeColor: string;
    strokeWidth: number;
  }) => 'ok' | 'no-silhouette' | 'readonly';
  applyRecipe: (recipe: EditorRecipeId) => 'ok' | 'no-silhouette' | 'readonly';

  /** 编辑当前手指的显示数据（解锁指改副本，否则改共享基指数据 → 十指同步） */
  editCurrentFingerData: (mutate: (data: {
    baseColor: string;
    pattern: PatternElement[];
    attachments: AttachmentElement[];
  }) => void) => void;

  unlockFinger: (finger: FingerCode) => void;
  lockFinger: (finger: FingerCode) => void;
  resetAllLocks: () => void;
  setMasterFinger: (finger: FingerCode) => void;

  save: () => Promise<'saved' | 'failed'>;
  markSaved: () => void;
}

function cloneDoc(doc: EditorDoc): EditorDoc {
  return structuredClone(doc);
}

function ensureSingleFingerData(draft: EditorDoc, finger: FingerCode): FingerData {
  const existing = draft.fingerLocks[finger];
  if (existing) return existing;
  const source = resolveFingerData(draft, finger);
  const created = structuredClone(source);
  draft.fingerLocks[finger] = created;
  return created;
}

export const useEditorStore = create<EditorState>((set, get) => ({
  designId: null,
  status: null,
  doc: null,
  readOnly: false,

  currentFinger: 'R4',
  editScope: 'single',
  tool: 'brush',
  brushColor: '#C2497A',
  brushSize: BRUSH_PRESET_SIZES.standard,
  brushPreset: 'standard',
  brushOpacity: 1,
  eraserSize: 18,

  zoom: 1,
  panX: 0,
  panY: 0,

  selection: null,
  history: [],
  future: [],
  saveState: 'saved',

  load: (designId) => {
    const design = getDesign(designId);
    if (!design) return 'missing';
    const result = getEditorDocResult(designId);
    if (result.status !== 'ok') return result.status;
    const doc = result.doc;
    set({
      designId,
      status: design.status,
      doc: cloneDoc(doc),
      readOnly: isReadOnly(design.status),
      currentFinger: doc.masterFinger,
      editScope: 'single',
      tool: 'brush',
      zoom: 1,
      panX: 0,
      panY: 0,
      selection: null,
      history: [],
      future: [],
      saveState: 'saved',
    });
    ensureSession();
    return 'ok';
  },

  unload: () => {
    set({
      designId: null,
      status: null,
      doc: null,
      readOnly: false,
      editScope: 'single',
      history: [],
      future: [],
      selection: null,
      saveState: 'saved',
    });
  },

  commit: (mutate) => {
    const { doc, readOnly } = get();
    if (!doc || readOnly) return;
    const next = cloneDoc(doc);
    mutate(next);
    normalizeEditorLayerOrders(next);
    next.updatedAt = new Date().toISOString();
    set((s) => ({
      doc: next,
      history: [...s.history.slice(-(HISTORY_LIMIT - 1)), doc],
      future: [],
      saveState: 'dirty',
    }));
  },

  undo: () => {
    const { doc, history, future, readOnly } = get();
    if (!doc || readOnly || history.length === 0) return;
    recordUndo();
    const prev = history[history.length - 1];
    set({
      doc: prev,
      history: history.slice(0, -1),
      future: [doc, ...future].slice(0, HISTORY_LIMIT),
      saveState: 'dirty',
      selection: null,
    });
  },

  redo: () => {
    const { doc, history, future, readOnly } = get();
    if (!doc || readOnly || future.length === 0) return;
    const [next, ...rest] = future;
    set({
      doc: next,
      history: [...history, doc].slice(-HISTORY_LIMIT),
      future: rest,
      saveState: 'dirty',
      selection: null,
    });
  },

  setTool: (tool) => set({ tool }),
  setBrush: (opts) =>
    set((s) => ({
      brushColor: opts.color ?? s.brushColor,
      brushSize: opts.size ?? s.brushSize,
      brushOpacity: opts.opacity ?? s.brushOpacity,
    })),
  setBrushPreset: (preset) =>
    set({
      brushPreset: preset,
      brushSize: BRUSH_PRESET_SIZES[preset],
    }),
  setEraserSize: (size) => set({ eraserSize: size }),

  mirrorToOpposite: (mode) => {
    const { doc, currentFinger, readOnly } = get();
    if (!doc || readOnly) return;
    const target = oppositeFinger(currentFinger);
    const sourceData = resolveFingerData(doc, currentFinger);
    get().commit((draft) => {
      const fallbackBase =
        draft.fingerLocks[target]?.baseColor ?? draft.baseColor;
      draft.fingerLocks[target] = mirrorFingerData(
        sourceData,
        target,
        mode,
        fallbackBase,
      );
    });
    recordMirror();
    set({ currentFinger: target, selection: null });
  },

  mirrorLeftHandToRight: (mode) => {
    const { doc, readOnly } = get();
    if (!doc || readOnly) return;
    get().commit((draft) => {
      for (const lf of LEFT_FINGERS) {
        const rf = oppositeFinger(lf);
        const sourceData = resolveFingerData(draft, lf);
        const fallbackBase =
          draft.fingerLocks[rf]?.baseColor ?? draft.baseColor;
        draft.fingerLocks[rf] = mirrorFingerData(
          sourceData,
          rf,
          mode,
          fallbackBase,
        );
      }
    });
    recordMirror();
  },
  setView: (view) =>
    set((s) => ({
      zoom: Math.min(4, Math.max(0.5, view.zoom ?? s.zoom)),
      panX: view.panX ?? s.panX,
      panY: view.panY ?? s.panY,
    })),
  setCurrentFinger: (finger) => set({ currentFinger: finger, selection: null }),
  setEditScope: (editScope) => set({ editScope, selection: null }),
  setSelection: (sel) => set({ selection: sel }),

  insertFrenchEdge: (opts) => {
    const { doc, readOnly } = get();
    if (!doc || readOnly) return 'readonly';
    const sil = getSilhouette(doc.shape, doc.length);
    if (!sil) return 'no-silhouette';
    const defaults = defaultFrenchParams(sil);
    const id = genId('el_french');
    get().editCurrentFingerData((d) => {
      d.pattern.push({
        id,
        kind: 'french_edge',
        ...createLayerMeta('经典法式', d.pattern.length),
        variant: opts.variant,
        fillColor: opts.fillColor,
        outlineEnabled: opts.outlineEnabled,
        strokeColor: opts.strokeColor,
        strokeWidth: opts.strokeWidth,
        tipOffset: defaults.tipOffset,
        smileDepth: defaults.smileDepth,
        classicControls:
          opts.variant === 'arc' ? defaultClassicControls(sil) : undefined,
        lineGap: defaults.lineGap,
        transform: { ...IDENTITY_TRANSFORM },
      });
    });
    recordFrenchEdge();
    set({ selection: { layer: 'pattern', id } });
    return 'ok';
  },

  applyRecipe: (recipe) => {
    const { doc, readOnly, currentFinger, editScope } = get();
    if (!doc || readOnly) return 'readonly';
    const sil = getSilhouette(doc.shape, doc.length);
    if (!sil) return 'no-silhouette';
    let selectedId: string | null = null;
    get().commit((draft) => {
      const data = editScope === 'single' ? ensureSingleFingerData(draft, currentFinger) : draft;
      data.pattern = data.pattern.filter((element) => element.source !== 'recipe');
      const recipeElements = buildRecipePattern(recipe, sil, data.pattern.length);
      data.pattern.push(...recipeElements);
      selectedId = recipeElements[0]?.id ?? null;
      draft.intent = {
        ...draft.intent,
        styleDirection: 'classic',
        lookPresetId:
          recipe === 'solid'
            ? 'solid-color'
            : recipe === 'french'
              ? 'classic-french'
              : 'nude-gradient',
      };
    });
    set({ selection: selectedId ? { layer: 'pattern', id: selectedId } : null });
    return 'ok';
  },

  editCurrentFingerData: (mutate) => {
    const { doc, currentFinger, editScope } = get();
    if (!doc) return;
    get().commit((draft) => {
      if (editScope === 'single') {
        mutate(ensureSingleFingerData(draft, currentFinger));
      } else {
        // 十指同步模式只改共享基底；已存在的逐指例外保持独立。
        const view = {
          get baseColor() {
            return draft.baseColor;
          },
          set baseColor(v: string) {
            draft.baseColor = v;
          },
          get pattern() {
            return draft.pattern;
          },
          set pattern(v) {
            draft.pattern = v;
          },
          get attachments() {
            return draft.attachments;
          },
          set attachments(v) {
            draft.attachments = v;
          },
        };
        mutate(view);
      }
    });
  },

  unlockFinger: (finger) => {
    get().commit((draft) => {
      if (draft.fingerLocks[finger]) return;
      draft.fingerLocks[finger] = {
        baseColor: draft.baseColor,
        pattern: structuredClone(draft.pattern),
        attachments: structuredClone(draft.attachments),
      };
    });
    set({ currentFinger: finger, selection: null });
  },

  lockFinger: (finger) => {
    get().commit((draft) => {
      delete draft.fingerLocks[finger];
    });
  },

  resetAllLocks: () => {
    get().commit((draft) => {
      draft.fingerLocks = {};
    });
  },

  setMasterFinger: (finger) => {
    get().commit((draft) => {
      draft.masterFinger = finger;
    });
    set({ currentFinger: finger });
  },

  save: async () => {
    const { doc, readOnly } = get();
    if (!doc || readOnly) return 'saved';
    const forceFail = isScenarioOn(useMockScenarios.getState().flags, 'save.fail');

    set({ saveState: 'saving' });
    const persist = () => {
      saveEditorDoc(doc);
      writeCanvasEnvelope(doc);
      const design = getDesign(doc.designId);
      if (design) {
        const legacyFinish =
          doc.appearance.topFinish === 'matte'
            ? 'matte'
            : doc.appearance.opticalEffect === 'pearl'
              ? 'pearl'
              : 'gloss';
        upsertDesign({
          ...design,
          shape: doc.shape,
          length: doc.length,
          lengthPreset: doc.lengthPreset,
          baseColor: doc.baseColor,
          finish: legacyFinish,
          surface: doc.appearance,
          updatedAt: doc.updatedAt,
        });
      }
    };

    // Mock 保存失败：自动重试 3 次后报错（真实路径同步落盘）
    let attempts = 0;
    while (attempts < 3) {
      attempts += 1;
      if (!forceFail) break;
      await new Promise((r) => setTimeout(r, 400));
    }
    if (forceFail) {
      set({ saveState: 'error' });
      return 'failed';
    }

    persist();
    set({ saveState: 'saved' });

    // 缩略图（异步，不阻塞保存）
    const data = resolveFingerData(doc, doc.masterFinger);
    const svg = composeNailSvg(
      {
        shape: doc.shape,
        length: doc.length,
        data,
        uid: `thumb-${doc.designId}`,
        appearance: doc.appearance,
        recipe: doc.recipe,
        finger: doc.masterFinger,
      },
      2,
    );
    if (svg) {
      try {
        const thumb = await svgToPngDataUrl(svg, 180, 300);
        const design = getDesign(doc.designId);
        if (design) upsertDesign({ ...design, thumbnailDataUrl: thumb });
      } catch {
        /* 缩略图失败不影响保存 */
      }
    }
    return 'saved';
  },

  markSaved: () => set({ saveState: 'saved' }),
}));

/* ── 便捷选择器 ───────────────────────────────────────── */

export function selectCurrentData(s: EditorState) {
  if (!s.doc) return null;
  return resolveFingerData(s.doc, s.currentFinger);
}

export function newElementId(kind: string): string {
  return genId(kind);
}

export type { AttachmentElement, PatternElement, Transform };
