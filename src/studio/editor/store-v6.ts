/**
 * EditorDocV6 runtime store (PR-04).
 * Single writable store backed by EditorDocV6 schema.
 * Undo/redo history, autosave with revision guard, reload recovery.
 */

import { create } from 'zustand';
import type { DesignStatus, FingerCode, NailLength, NailShape } from '@/lib/types';
import { FINGER_CODES } from '@/lib/types';
import { isReadOnly } from '@/lib/state-machine';
import type {
  EditorDocV6,
  EditorElementV6,
  EditorLayerV6,
  NailDesignV6,
  EditorDocOutputIntent,
} from './v6/model';
import type { OpticalEffect, TopFinish } from './lib/model';
import {
  applySaveResult,
  AUTOSAVE_DEBOUNCE_MS,
  bumpRevision,
  createRevisionState,
  type AutosaveRevisionState,
} from './lib/autosave-v6';
import {
  getDesign,
  getEditorDocV6Result,
  saveEditorDocV6ToLocalStorage,
  upsertDesign,
  duplicateEditorDocV6,
} from './lib/repo-v6';
import { genId } from './lib/model';

/* ── Types ──────────────────────────────────────────────── */

export type EditorTool = 'select' | 'brush' | 'eraser' | 'french' | 'attachment' | 'surface_color';
export type SaveState = 'saved' | 'dirty' | 'saving' | 'error';
export type BrushPreset = 'fine' | 'standard' | 'thick';
export type EditorViewMode = 'single' | 'overview';

export const BRUSH_PRESET_SIZES: Record<BrushPreset, number> = {
  fine: 5,
  standard: 12,
  thick: 25,
};

const HISTORY_LIMIT = 200;

/* ── State ──────────────────────────────────────────────── */

interface EditorV6State {
  /* Identity */
  designId: string | null;
  status: DesignStatus | null;
  doc: EditorDocV6 | null;
  readOnly: boolean;

  /* Navigation */
  currentFinger: FingerCode;
  selectedFingers: FingerCode[];
  activeLayerId: string | null;
  viewMode: EditorViewMode;

  /* Tools */
  tool: EditorTool;
  brushColor: string;
  brushSize: number;
  brushPreset: BrushPreset;
  brushOpacity: number;
  eraserSize: number;
  selectedElementId: string | null;
  symmetricDraw: boolean;

  /* View */
  zoom: number;
  panX: number;
  panY: number;

  /* History & Save */
  history: EditorDocV6[];
  future: EditorDocV6[];
  saveState: SaveState;
  autosave: AutosaveRevisionState;
  autosaveTimer: ReturnType<typeof setTimeout> | null;

  /* Lifecycle */
  load: (designId: string) => 'ok' | 'missing' | 'invalid' | 'unsupported' | 'save_error';
  unload: () => 'ok' | 'error';
  reloadFromStorage: () => boolean;

  /* Commit & History */
  commit: (mutate: (doc: EditorDocV6) => void) => void;
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;

  /* Navigation */
  setCurrentFinger: (finger: FingerCode) => void;
  toggleFingerSelection: (finger: FingerCode) => void;
  selectAllFingers: () => void;
  clearFingerSelection: () => void;
  setActiveLayerId: (layerId: string | null) => void;
  setViewMode: (mode: EditorViewMode) => void;

  /* Tools */
  setTool: (tool: EditorTool) => void;
  setBrushColor: (color: string) => void;
  setBrushSize: (size: number) => void;
  setBrushPreset: (preset: BrushPreset) => void;
  setBrushOpacity: (opacity: number) => void;
  setEraserSize: (size: number) => void;
  setSelectedElementId: (id: string | null) => void;
  setSymmetricDraw: (on: boolean) => void;

  /* View */
  setView: (view: Partial<{ zoom: number; panX: number; panY: number }>) => void;

  /* Layer CRUD */
  createLayerOnCurrent: (typeId: string, name?: string) => void;
  renameLayerOnCurrent: (layerId: string, name: string) => void;
  duplicateLayerOnCurrent: (layerId: string) => void;
  deleteLayerOnCurrent: (layerId: string) => void;
  reorderLayerOnCurrent: (layerId: string, direction: 'up' | 'down') => void;
  toggleLayerVisibleOnCurrent: (layerId: string) => void;
  toggleLayerLockedOnCurrent: (layerId: string) => void;
  batchCreateLayerOnSelected: (typeId: string, name?: string) => void;
  setBaseSurfaceColorOnCurrent: (color: string) => void;
  batchSetBaseSurfaceColor: (color: string) => void;

  /* Element CRUD */
  appendElementToCurrentLayer: (element: EditorElementV6) => void;
  updateElementOnCurrentLayer: (elementId: string, updater: (el: EditorElementV6) => EditorElementV6) => void;
  removeElementFromCurrentLayer: (elementId: string) => void;

  /* Cross-finger */
  copyLayerToFinger: (layerId: string, targetFinger: FingerCode) => void;

  /* Document settings */
  setTitle: (title: string) => void;
  setMasterFinger: (finger: FingerCode) => void;
  setGeometry: (shape: NailShape, length: NailLength) => void;
  setFingerGeometry: (finger: FingerCode, shape?: NailShape, length?: NailLength) => void;
  clearFingerGeometry: (finger: FingerCode) => void;
  setTopFinish: (finish: TopFinish) => void;
  setOpticalEffect: (effect: OpticalEffect) => void;
  setOutputIntent: (intent: EditorDocOutputIntent) => void;

  /* Communication refs */
  addCommunicationRef: (dataUrl: string, caption?: string) => void;
  removeCommunicationRef: (id: string) => void;
  updateCommunicationRefCaption: (id: string, caption: string) => void;

  /* Versioning */
  duplicate: (newDesignId: string) => string | null;
  createVersionFromConfirmed: () => string | null;

  /* Save */
  save: () => Promise<'saved' | 'error'>;
  markSaved: () => void;
}

/* ── Helpers ────────────────────────────────────────────── */

function cloneDoc(doc: EditorDocV6): EditorDocV6 {
  return structuredClone(doc);
}

function scheduleAutosaveFlush(get: () => EditorV6State, set: (partial: Partial<EditorV6State>) => void) {
  const state = get();
  if (state.autosaveTimer) clearTimeout(state.autosaveTimer);
  const capturedDesignId = state.designId;
  const timer = setTimeout(() => {
    const current = get();
    if (current.designId !== capturedDesignId) return;
    if (current.autosaveTimer === timer) set({ autosaveTimer: null });
    void current.save();
  }, AUTOSAVE_DEBOUNCE_MS);
  set({ autosaveTimer: timer });
}

function persistEditorDoc(
  doc: EditorDocV6,
  designId: string,
  autosave: AutosaveRevisionState,
): { status: 'ok'; doc: EditorDocV6; autosave: AutosaveRevisionState } | { status: 'error' } {
  const now = new Date().toISOString();
  const next: EditorDocV6 = { ...doc, updatedAt: now };
  const saveResult = saveEditorDocV6ToLocalStorage(next);
  if (saveResult.status !== 'ok') return { status: 'error' };

  const design = getDesign(designId);
  if (design) {
    const masterFinger = next.presentationMeta.masterFinger;
    const baseColor = next.nails[masterFinger].layers.find(
      (layer) => layer.typeId === 'builtin.base_surface',
    )?.surface?.baseColor ?? design.baseColor;
    upsertDesign({
      ...design,
      title: next.title,
      shape: next.defaultGeometry.shape,
      length: next.defaultGeometry.length,
      lengthPreset: next.lengthPreset,
      baseColor,
      finish: next.appearance.topFinish === 'matte' ? 'matte' : 'gloss',
      surface: next.appearance,
      updatedAt: now,
    });
  }

  const nextAutosave = { ...autosave };
  const flushRevision = autosave.pendingRevision ?? autosave.revision;
  applySaveResult(nextAutosave, flushRevision);
  if (nextAutosave.pendingRevision === flushRevision) {
    nextAutosave.pendingRevision = null;
  }
  return { status: 'ok', doc: next, autosave: nextAutosave };
}

function normalizeLayerOrders(layers: EditorLayerV6[]): void {
  layers.forEach((layer, i) => {
    layer.order = i;
    layer.elements.forEach((el, j) => { el.order = j; });
  });
}

/* ── Store ──────────────────────────────────────────────── */

export const useEditorV6Store = create<EditorV6State>((set, get) => ({
  /* Identity */
  designId: null,
  status: null,
  doc: null,
  readOnly: false,

  /* Navigation */
  currentFinger: 'R4',
  selectedFingers: ['R4'],
  activeLayerId: null,
  viewMode: 'single',

  /* Tools */
  tool: 'select',
  brushColor: '#C9A227',
  brushSize: BRUSH_PRESET_SIZES.standard,
  brushPreset: 'standard',
  brushOpacity: 1,
  eraserSize: 18,
  selectedElementId: null,
  symmetricDraw: false,

  /* View */
  zoom: 1,
  panX: 0,
  panY: 0,

  /* History & Save */
  history: [],
  future: [],
  saveState: 'saved',
  autosave: createRevisionState(),
  autosaveTimer: null,

  /* ── Lifecycle ──────────────────────────────────────── */

  load: (designId) => {
    const result = getEditorDocV6Result(designId);
    if (result.status === 'missing') return 'missing';
    if (result.status === 'unsupported') return 'unsupported';
    if (result.status === 'invalid') return 'invalid';

    // Do not abandon a dirty document just because navigation loads another one.
    // The target is validated first so failed target loads leave the current timer intact.
    if (get().doc && get().unload() === 'error') return 'save_error';

    const design = getDesign(designId);
    const status = design?.status ?? 'draft';
    const doc = cloneDoc(result.doc);
    const finger = doc.presentationMeta.masterFinger;
    const activeLayerId = doc.nails[finger].layers[0]?.id ?? null;

    set({
      designId,
      doc,
      status,
      readOnly: isReadOnly(status),
      currentFinger: finger,
      selectedFingers: [finger],
      activeLayerId,
      viewMode: 'single',
      saveState: 'saved',
      tool: 'select',
      zoom: 1,
      panX: 0,
      panY: 0,
      history: [],
      future: [],
      autosave: createRevisionState(),
      autosaveTimer: null,
    });
    return 'ok';
  },

  unload: () => {
    const { autosaveTimer, saveState, doc, designId, autosave } = get();
    if (autosaveTimer) clearTimeout(autosaveTimer);
    set({ autosaveTimer: null });

    const hasUnsavedRevision = autosave.pendingRevision !== null;
    if ((hasUnsavedRevision || saveState === 'dirty' || saveState === 'error') && doc && designId) {
      try {
        const result = persistEditorDoc(doc, designId, autosave);
        if (result.status === 'error') {
          set({ saveState: 'error' });
          return 'error';
        }
      } catch {
        set({ saveState: 'error' });
        return 'error';
      }
    }

    set({
      designId: null,
      doc: null,
      status: null,
      readOnly: false,
      currentFinger: 'R4',
      selectedFingers: [],
      activeLayerId: null,
      viewMode: 'single',
      saveState: 'saved',
      tool: 'select',
      zoom: 1,
      panX: 0,
      panY: 0,
      history: [],
      future: [],
      selectedElementId: null,
      autosave: createRevisionState(),
      autosaveTimer: null,
    });
    return 'ok';
  },

  reloadFromStorage: () => {
    const { designId, autosaveTimer } = get();
    if (!designId) return false;
    const result = getEditorDocV6Result(designId);
    if (result.status !== 'ok') return false;
    if (autosaveTimer) clearTimeout(autosaveTimer);
    const doc = cloneDoc(result.doc);
    set({
      doc,
      history: [],
      future: [],
      saveState: 'saved',
      autosave: createRevisionState(),
      autosaveTimer: null,
    });
    return true;
  },

  /* ── Commit & History ───────────────────────────────── */

  commit: (mutate) => {
    const { doc, readOnly, autosave } = get();
    if (!doc || readOnly) return;
    const prev = cloneDoc(doc);
    const next = cloneDoc(doc);
    mutate(next);
    next.revision += 1;
    next.updatedAt = new Date().toISOString();
    bumpRevision(autosave);
    set((s) => ({
      doc: next,
      history: [...s.history.slice(-(HISTORY_LIMIT - 1)), prev],
      future: [],
      saveState: 'dirty',
    }));
    scheduleAutosaveFlush(get, set);
  },

  undo: () => {
    const { doc, history, future, readOnly, autosave } = get();
    if (!doc || readOnly || history.length === 0) return;
    const prev = cloneDoc(history[history.length - 1]);
    prev.revision = doc.revision + 1;
    prev.updatedAt = new Date().toISOString();
    bumpRevision(autosave);
    set({
      doc: prev,
      history: history.slice(0, -1),
      future: [doc, ...future].slice(0, HISTORY_LIMIT),
      saveState: 'dirty',
      selectedElementId: null,
    });
    scheduleAutosaveFlush(get, set);
  },

  redo: () => {
    const { doc, history, future, readOnly, autosave } = get();
    if (!doc || readOnly || future.length === 0) return;
    const [futureDoc, ...rest] = future;
    const next = cloneDoc(futureDoc);
    next.revision = doc.revision + 1;
    next.updatedAt = new Date().toISOString();
    bumpRevision(autosave);
    set({
      doc: next,
      history: [...history, doc].slice(-HISTORY_LIMIT),
      future: rest,
      saveState: 'dirty',
      selectedElementId: null,
    });
    scheduleAutosaveFlush(get, set);
  },

  canUndo: () => get().history.length > 0,
  canRedo: () => get().future.length > 0,

  /* ── Navigation ─────────────────────────────────────── */

  setCurrentFinger: (finger) => {
    const { doc } = get();
    const activeLayerId = doc ? doc.nails[finger].layers[0]?.id ?? null : null;
    set({ currentFinger: finger, activeLayerId, selectedElementId: null });
  },

  toggleFingerSelection: (finger) => {
    set((s) => {
      const sel = s.selectedFingers;
      if (sel.includes(finger)) {
        const next = sel.filter((f) => f !== finger);
        return { selectedFingers: next.length > 0 ? next : [finger] };
      }
      return { selectedFingers: [...sel, finger] };
    });
  },

  selectAllFingers: () => set({ selectedFingers: [...FINGER_CODES] }),
  clearFingerSelection: () => set({ selectedFingers: [get().currentFinger] }),

  setActiveLayerId: (layerId) => set({ activeLayerId: layerId, selectedElementId: null }),
  setViewMode: (mode) => set({ viewMode: mode }),

  /* ── Tools ──────────────────────────────────────────── */

  setTool: (tool) => set({ tool }),
  setBrushColor: (color) => set({ brushColor: color }),
  setBrushSize: (size) => set({ brushSize: size }),
  setBrushPreset: (preset) => set({ brushPreset: preset, brushSize: BRUSH_PRESET_SIZES[preset] }),
  setBrushOpacity: (opacity) => set({ brushOpacity: opacity }),
  setEraserSize: (size) => set({ eraserSize: size }),
  setSelectedElementId: (id) => set({ selectedElementId: id }),
  setSymmetricDraw: (on) => set({ symmetricDraw: on }),

  /* ── View ───────────────────────────────────────────── */

  setView: (view) =>
    set((s) => ({
      zoom: Math.min(4, Math.max(0.5, view.zoom ?? s.zoom)),
      panX: view.panX ?? s.panX,
      panY: view.panY ?? s.panY,
    })),

  /* ── Layer CRUD ─────────────────────────────────────── */

  createLayerOnCurrent: (typeId, name) => {
    const { doc, currentFinger, readOnly } = get();
    if (!doc || readOnly) return;
    get().commit((draft) => {
      const nail = draft.nails[currentFinger];
      const layerId = genId('layer');
      const order = nail.layers.length;
      const layerName = name ?? typeId.split('.').pop() ?? '新图层';
      nail.layers.push({
        id: layerId,
        name: layerName,
        typeId,
        visible: true,
        locked: false,
        order,
        elements: [],
      });
      normalizeLayerOrders(nail.layers);
    });
    const newLayer = get().doc?.nails[currentFinger].layers;
    if (newLayer && newLayer.length > 0) {
      set({ activeLayerId: newLayer[newLayer.length - 1].id });
    }
  },

  renameLayerOnCurrent: (layerId, name) => {
    const { currentFinger, readOnly } = get();
    if (readOnly) return;
    get().commit((draft) => {
      const layer = draft.nails[currentFinger].layers.find((l) => l.id === layerId);
      if (layer) layer.name = name;
    });
  },

  duplicateLayerOnCurrent: (layerId) => {
    const { doc, currentFinger, readOnly } = get();
    if (!doc || readOnly) return;
    get().commit((draft) => {
      const nail = draft.nails[currentFinger];
      const src = nail.layers.find((l) => l.id === layerId);
      if (!src) return;
      const dup: EditorLayerV6 = {
        ...structuredClone(src),
        id: genId('layer'),
        name: `${src.name} (副本)`,
        order: nail.layers.length,
        elements: src.elements.map((el, i) => ({
          ...structuredClone(el),
          id: genId('el'),
          order: i,
        })),
      };
      nail.layers.push(dup);
      normalizeLayerOrders(nail.layers);
    });
  },

  deleteLayerOnCurrent: (layerId) => {
    const { doc, currentFinger, readOnly, activeLayerId } = get();
    if (!doc || readOnly) return;
    get().commit((draft) => {
      const nail = draft.nails[currentFinger];
      nail.layers = nail.layers.filter((l) => l.id !== layerId);
      normalizeLayerOrders(nail.layers);
    });
    if (activeLayerId === layerId) {
      const layers = get().doc?.nails[currentFinger].layers ?? [];
      set({ activeLayerId: layers[0]?.id ?? null, selectedElementId: null });
    }
  },

  reorderLayerOnCurrent: (layerId, direction) => {
    const { currentFinger, readOnly } = get();
    if (readOnly) return;
    get().commit((draft) => {
      const layers = draft.nails[currentFinger].layers;
      const idx = layers.findIndex((l) => l.id === layerId);
      if (idx < 0) return;
      const target = direction === 'up' ? idx + 1 : idx - 1;
      if (target < 0 || target >= layers.length) return;
      [layers[idx], layers[target]] = [layers[target], layers[idx]];
      normalizeLayerOrders(layers);
    });
  },

  toggleLayerVisibleOnCurrent: (layerId) => {
    const { currentFinger, readOnly } = get();
    if (readOnly) return;
    get().commit((draft) => {
      const layer = draft.nails[currentFinger].layers.find((l) => l.id === layerId);
      if (layer) layer.visible = !layer.visible;
    });
  },

  toggleLayerLockedOnCurrent: (layerId) => {
    const { currentFinger, readOnly } = get();
    if (readOnly) return;
    get().commit((draft) => {
      const layer = draft.nails[currentFinger].layers.find((l) => l.id === layerId);
      if (layer) layer.locked = !layer.locked;
    });
  },

  batchCreateLayerOnSelected: (typeId, name) => {
    const { doc, selectedFingers, readOnly } = get();
    if (!doc || readOnly) return;
    get().commit((draft) => {
      for (const finger of selectedFingers) {
        const nail = draft.nails[finger];
        const layerId = genId('layer');
        const layerName = name ?? typeId.split('.').pop() ?? '新图层';
        nail.layers.push({
          id: layerId,
          name: layerName,
          typeId,
          visible: true,
          locked: false,
          order: nail.layers.length,
          elements: [],
        });
        normalizeLayerOrders(nail.layers);
      }
    });
  },

  setBaseSurfaceColorOnCurrent: (color) => {
    const { currentFinger, readOnly } = get();
    if (readOnly) return;
    get().commit((draft) => {
      const baseLayer = draft.nails[currentFinger].layers.find(
        (l) => l.typeId === 'builtin.base_surface',
      );
      if (baseLayer) {
        if (!baseLayer.surface) baseLayer.surface = { baseColor: color };
        else baseLayer.surface.baseColor = color;
      }
    });
  },

  batchSetBaseSurfaceColor: (color) => {
    const { selectedFingers, readOnly } = get();
    if (readOnly) return;
    get().commit((draft) => {
      for (const finger of selectedFingers) {
        const baseLayer = draft.nails[finger].layers.find(
          (l) => l.typeId === 'builtin.base_surface',
        );
        if (baseLayer) {
          if (!baseLayer.surface) baseLayer.surface = { baseColor: color };
          else baseLayer.surface.baseColor = color;
        }
      }
    });
  },

  /* ── Element CRUD ───────────────────────────────────── */

  appendElementToCurrentLayer: (element) => {
    const { currentFinger, activeLayerId, readOnly } = get();
    if (readOnly) return;
    get().commit((draft) => {
      const layer = draft.nails[currentFinger].layers.find((l) => l.id === activeLayerId);
      if (!layer || layer.locked) return;
      element.order = layer.elements.length;
      layer.elements.push(structuredClone(element));
    });
  },

  updateElementOnCurrentLayer: (elementId, updater) => {
    const { currentFinger, activeLayerId, readOnly } = get();
    if (readOnly) return;
    get().commit((draft) => {
      const layer = draft.nails[currentFinger].layers.find((l) => l.id === activeLayerId);
      if (!layer) return;
      const idx = layer.elements.findIndex((el) => el.id === elementId);
      if (idx < 0) return;
      layer.elements[idx] = updater(structuredClone(layer.elements[idx]));
    });
  },

  removeElementFromCurrentLayer: (elementId) => {
    const { currentFinger, activeLayerId, readOnly } = get();
    if (readOnly) return;
    get().commit((draft) => {
      const layer = draft.nails[currentFinger].layers.find((l) => l.id === activeLayerId);
      if (!layer) return;
      layer.elements = layer.elements.filter((el) => el.id !== elementId);
      layer.elements.forEach((el, i) => { el.order = i; });
    });
  },

  /* ── Cross-finger ───────────────────────────────────── */

  copyLayerToFinger: (layerId, targetFinger) => {
    const { doc, currentFinger, readOnly } = get();
    if (!doc || readOnly) return;
    get().commit((draft) => {
      const srcLayer = draft.nails[currentFinger].layers.find((l) => l.id === layerId);
      if (!srcLayer) return;
      const targetNail = draft.nails[targetFinger];
      const dup: EditorLayerV6 = {
        ...structuredClone(srcLayer),
        id: genId('layer'),
        order: targetNail.layers.length,
        elements: srcLayer.elements.map((el, i) => ({
          ...structuredClone(el),
          id: genId('el'),
          order: i,
        })),
      };
      targetNail.layers.push(dup);
      normalizeLayerOrders(targetNail.layers);
    });
  },

  /* ── Document settings ──────────────────────────────── */

  setTitle: (title) => {
    const { readOnly } = get();
    if (readOnly) return;
    get().commit((draft) => { draft.title = title; });
  },

  setMasterFinger: (finger) => {
    const { readOnly } = get();
    if (readOnly) return;
    get().commit((draft) => { draft.presentationMeta.masterFinger = finger; });
    set({ currentFinger: finger });
  },

  setGeometry: (shape, length) => {
    const { readOnly } = get();
    if (readOnly) return;
    get().commit((draft) => {
      draft.defaultGeometry = { shape, length };
    });
  },

  setFingerGeometry: (finger, shape, length) => {
    const { readOnly } = get();
    if (readOnly) return;
    get().commit((draft) => {
      const nail = draft.nails[finger];
      if (!nail.geometryOverride) nail.geometryOverride = {};
      if (shape !== undefined) nail.geometryOverride.shape = shape;
      if (length !== undefined) nail.geometryOverride.length = length;
    });
  },

  clearFingerGeometry: (finger) => {
    const { readOnly } = get();
    if (readOnly) return;
    get().commit((draft) => {
      delete draft.nails[finger].geometryOverride;
    });
  },

  setTopFinish: (finish) => {
    const { readOnly } = get();
    if (readOnly) return;
    get().commit((draft) => { draft.appearance.topFinish = finish; });
  },

  setOpticalEffect: (effect) => {
    const { readOnly } = get();
    if (readOnly) return;
    get().commit((draft) => { draft.appearance.opticalEffect = effect; });
  },

  setOutputIntent: (intent) => {
    const { readOnly } = get();
    if (readOnly) return;
    get().commit((draft) => { draft.outputIntent = intent; });
  },

  /* ── Communication refs ─────────────────────────────── */

  addCommunicationRef: (dataUrl, caption) => {
    const { readOnly } = get();
    if (readOnly) return;
    get().commit((draft) => {
      draft.communicationRefs.push({
        id: genId('comm'),
        dataUrl,
        caption,
        uploadedAt: new Date().toISOString(),
      });
    });
  },

  removeCommunicationRef: (id) => {
    const { readOnly } = get();
    if (readOnly) return;
    get().commit((draft) => {
      draft.communicationRefs = draft.communicationRefs.filter((r) => r.id !== id);
    });
  },

  updateCommunicationRefCaption: (id, caption) => {
    const { readOnly } = get();
    if (readOnly) return;
    get().commit((draft) => {
      const ref = draft.communicationRefs.find((r) => r.id === id);
      if (ref) ref.caption = caption;
    });
  },

  /* ── Versioning ─────────────────────────────────────── */

  duplicate: (newDesignId) => {
    const { designId } = get();
    if (!designId) return null;
    return duplicateEditorDocV6(designId, newDesignId);
  },

  createVersionFromConfirmed: () => {
    const { doc, designId } = get();
    if (!doc || !designId) return null;
    const newId = genId('design');
    const newDoc: EditorDocV6 = {
      ...cloneDoc(doc),
      designId: newId,
      revision: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const result = saveEditorDocV6ToLocalStorage(newDoc);
    if (result.status !== 'ok') return null;
    const design = getDesign(designId);
    if (design) {
      upsertDesign({
        ...design,
        id: newId,
        title: `${design.title} (新版本)`,
        status: 'draft',
        version: (design.version ?? 1) + 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }
    return newId;
  },

  /* ── Save ───────────────────────────────────────────── */

  save: async () => {
    const { doc, designId, readOnly, autosave, autosaveTimer } = get();
    if (!doc || !designId) return 'error';
    if (readOnly) return 'error';

    if (autosaveTimer) clearTimeout(autosaveTimer);
    set({ saveState: 'saving', autosaveTimer: null });

    try {
      const result = persistEditorDoc(doc, designId, autosave);
      if (result.status === 'error') {
        set({ saveState: 'error' });
        return 'error';
      }
      set({ doc: result.doc, saveState: 'saved', autosave: result.autosave });
      return 'saved';
    } catch {
      set({ saveState: 'error' });
      return 'error';
    }
  },

  markSaved: () => set({ saveState: 'saved' }),
}));

/* ── Selectors ──────────────────────────────────────────── */

export function selectCurrentNail(s: EditorV6State): NailDesignV6 | null {
  if (!s.doc) return null;
  return s.doc.nails[s.currentFinger] ?? null;
}

export function selectActiveLayer(s: EditorV6State): EditorLayerV6 | null {
  if (!s.doc || !s.activeLayerId) return null;
  return s.doc.nails[s.currentFinger].layers.find((l) => l.id === s.activeLayerId) ?? null;
}

export function selectCurrentElements(s: EditorV6State): EditorElementV6[] {
  const layer = selectActiveLayer(s);
  return layer?.elements ?? [];
}
