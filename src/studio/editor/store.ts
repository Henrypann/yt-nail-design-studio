/**
 * Editor 状态store（模块 4）：Zustand + 完整 Undo/Redo 历史栈（⌘Z / ⌘⇧Z）。
 * 文档持久化经 repo（localStorage envelope + 数据桥 ProjectV3 画布键）。
 */

import { create } from 'zustand';
import type { DesignStatus, FingerCode } from '@/lib/types';
import { isReadOnly } from '@/lib/state-machine';
import { isScenarioOn, useMockScenarios } from '@/lib/mock-panel';
import type { AttachmentElement, EditorDoc, PatternElement, Transform } from './lib/model';
import { genId, resolveFingerData } from './lib/model';
import {
  getDesign,
  getEditorDoc,
  saveEditorDoc,
  upsertDesign,
  writeCanvasEnvelope,
} from './lib/repo';
import { composeNailSvg, svgToPngDataUrl } from './lib/render';

export type EditorTool = 'brush' | 'eraser';
export type SaveState = 'saved' | 'dirty' | 'saving' | 'error';

export interface ElementRef {
  layer: 'pattern' | 'attachment';
  id: string;
}

const HISTORY_LIMIT = 50;

interface EditorState {
  designId: string | null;
  status: DesignStatus | null;
  doc: EditorDoc | null;
  readOnly: boolean;

  currentFinger: FingerCode;
  tool: EditorTool;
  brushColor: string;
  brushSize: number;
  brushOpacity: number;
  eraserSize: number;

  zoom: number; // 0.5 – 4
  panX: number;
  panY: number;

  selection: ElementRef | null;

  history: EditorDoc[];
  future: EditorDoc[];
  saveState: SaveState;

  load: (designId: string) => 'ok' | 'missing';
  unload: () => void;

  /** 提交一次可撤销修改（推入历史栈） */
  commit: (mutate: (doc: EditorDoc) => void) => void;
  undo: () => void;
  redo: () => void;

  setTool: (tool: EditorTool) => void;
  setBrush: (opts: Partial<{ color: string; size: number; opacity: number }>) => void;
  setEraserSize: (size: number) => void;
  setView: (view: Partial<{ zoom: number; panX: number; panY: number }>) => void;
  setCurrentFinger: (finger: FingerCode) => void;
  setSelection: (sel: ElementRef | null) => void;

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

export const useEditorStore = create<EditorState>((set, get) => ({
  designId: null,
  status: null,
  doc: null,
  readOnly: false,

  currentFinger: 'R4',
  tool: 'brush',
  brushColor: '#C2497A',
  brushSize: 6,
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
    const doc = getEditorDoc(designId);
    if (!design || !doc) return 'missing';
    set({
      designId,
      status: design.status,
      doc: cloneDoc(doc),
      readOnly: isReadOnly(design.status),
      currentFinger: doc.masterFinger,
      tool: 'brush',
      zoom: 1,
      panX: 0,
      panY: 0,
      selection: null,
      history: [],
      future: [],
      saveState: 'saved',
    });
    return 'ok';
  },

  unload: () => {
    set({
      designId: null,
      status: null,
      doc: null,
      readOnly: false,
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
  setEraserSize: (size) => set({ eraserSize: size }),
  setView: (view) =>
    set((s) => ({
      zoom: Math.min(4, Math.max(0.5, view.zoom ?? s.zoom)),
      panX: view.panX ?? s.panX,
      panY: view.panY ?? s.panY,
    })),
  setCurrentFinger: (finger) => set({ currentFinger: finger, selection: null }),
  setSelection: (sel) => set({ selection: sel }),

  editCurrentFingerData: (mutate) => {
    const { doc, currentFinger } = get();
    if (!doc) return;
    get().commit((draft) => {
      const target = draft.fingerLocks[currentFinger];
      if (target) {
        mutate(target);
      } else {
        // 共享分支：经 get/set 视图回写 draft 的标量与数组替换（push 等原地修改亦可）
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
        upsertDesign({ ...design, updatedAt: doc.updatedAt });
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
      { shape: doc.shape, length: doc.length, data, uid: `thumb-${doc.designId}` },
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
