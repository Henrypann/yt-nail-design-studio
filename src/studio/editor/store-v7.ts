import { useStore } from 'zustand';
import { createStore, type StoreApi } from 'zustand/vanilla';
import { FINGER_CODES, type FingerCode } from '@/lib/types';
import type {
  DimensionalDecorationV7,
  EditorDocV7,
  FlatDesignElementV7,
  ProcessStepV7,
  RgbaColorV7,
  Transform2DV7,
} from './v7/model';
import type { EditorDocV7MigrationDiagnostic, EditorDocV7MigrationResolvers } from './v7/migrate';
import {
  addEditorV7Element,
  addEditorV7Step,
  deleteEditorV7Step,
  duplicateEditorV7Step,
  moveEditorV7Step,
  removeEditorV7Element,
  setEditorV7ElementFlag,
  setEditorV7ElementTransform,
  setEditorV7StepFlag,
  type EditorV7CommandResult,
} from './v7/commands';
import {
  applyEditorV7SaveResult,
  createEditorV7RevisionState,
  EDITOR_V7_AUTOSAVE_DEBOUNCE_MS,
  markEditorV7RevisionPending,
  type EditorV7RevisionState,
} from './v7/autosave';
import { generateEditorV7Id, type EditorV7IdFactory } from './v7/id';
import {
  createEditorDocV7Repository,
  createLocalEditorDocV7Storage,
  type EditorDocV7Repository,
} from './v7/repository';
import { parseEditorDocV7 } from './v7/schema';
import {
  setEditorV7BackgroundColor,
  setEditorV7BackgroundMode,
  setEditorV7BackgroundOpacity,
  type EditorV7BackgroundModeV7,
} from './v7/background';

export type EditorV7SaveState = 'saved' | 'dirty' | 'saving' | 'error';
export type EditorV7LoadResult = 'ok' | 'ok_with_warnings' | 'missing' | 'invalid' | 'unsupported' | 'save_error' | 'busy';
export type EditorV7ActionResult =
  | { ok: true }
  | { ok: false; reason: string; message: string };

export interface EditorV7RuntimeDependencies {
  repository: EditorDocV7Repository;
  now?: () => string;
  idFactory?: EditorV7IdFactory;
  setTimeout?: typeof globalThis.setTimeout;
  clearTimeout?: typeof globalThis.clearTimeout;
  autosaveDelayMs?: number;
}

export interface EditorV7State {
  designId: string | null;
  doc: EditorDocV7 | null;
  sourceVersion: number | null;
  sourceToken: string | null;
  migrated: boolean;
  diagnostics: EditorDocV7MigrationDiagnostic[];
  readOnly: boolean;
  currentFinger: FingerCode;
  selectedStepId: string | null;
  selectedElementId: string | null;
  history: EditorDocV7[];
  future: EditorDocV7[];
  saveState: EditorV7SaveState;
  saveError: string | null;
  revisionState: EditorV7RevisionState;
  autosaveTimer: ReturnType<typeof setTimeout> | null;
  generation: number;
  switching: boolean;

  load(designId: string, options?: { readOnly?: boolean }): Promise<EditorV7LoadResult>;
  reloadFromStorage(): EditorV7LoadResult;
  unload(): Promise<'ok' | 'error'>;
  save(): Promise<'saved' | 'clean' | 'busy' | 'stale' | 'read_only' | 'error'>;
  retrySave(): Promise<'saved' | 'clean' | 'busy' | 'stale' | 'read_only' | 'error'>;
  undo(): EditorV7ActionResult;
  redo(): EditorV7ActionResult;
  setCurrentFinger(finger: FingerCode): void;
  selectStep(stepId: string | null): void;
  selectElement(elementId: string | null): void;
  setTitle(title: string): EditorV7ActionResult;
  setBackgroundMode(finger: FingerCode, mode: EditorV7BackgroundModeV7): EditorV7ActionResult;
  setBackgroundColor(finger: FingerCode, color: RgbaColorV7): EditorV7ActionResult;
  setBackgroundOpacity(finger: FingerCode, opacity: number): EditorV7ActionResult;
  addStep(finger: FingerCode, step: ProcessStepV7, index: number): EditorV7ActionResult;
  deleteStep(finger: FingerCode, stepId: string): EditorV7ActionResult;
  moveStep(finger: FingerCode, stepId: string, targetIndex: number): EditorV7ActionResult;
  duplicateStep(finger: FingerCode, stepId: string): EditorV7ActionResult;
  setStepFlag(finger: FingerCode, stepId: string, flag: 'visible' | 'locked' | 'skipped', value: boolean): EditorV7ActionResult;
  addElement(finger: FingerCode, stepId: string, element: FlatDesignElementV7 | DimensionalDecorationV7): EditorV7ActionResult;
  removeElement(finger: FingerCode, stepId: string, elementId: string): EditorV7ActionResult;
  setElementFlag(finger: FingerCode, stepId: string, elementId: string, flag: 'visible' | 'locked', value: boolean): EditorV7ActionResult;
  setElementTransform(finger: FingerCode, stepId: string, elementId: string, transform: Transform2DV7): EditorV7ActionResult;
}

const HISTORY_LIMIT = 200;

function clone<T>(value: T): T {
  return structuredClone(value);
}

function publicResult(result: EditorV7CommandResult): EditorV7ActionResult {
  return result.ok ? { ok: true } : { ok: false, reason: result.reason, message: result.message };
}

export function createEditorV7Store(dependencies: EditorV7RuntimeDependencies): StoreApi<EditorV7State> {
  const now = dependencies.now ?? (() => new Date().toISOString());
  const idFactory = dependencies.idFactory ?? generateEditorV7Id;
  const schedule = dependencies.setTimeout ?? globalThis.setTimeout.bind(globalThis);
  const cancel = dependencies.clearTimeout ?? globalThis.clearTimeout.bind(globalThis);
  const delay = dependencies.autosaveDelayMs ?? EDITOR_V7_AUTOSAVE_DEBOUNCE_MS;

  return createStore<EditorV7State>((set, get) => {
    const clearAutosave = () => {
      const timer = get().autosaveTimer;
      if (timer !== null) cancel(timer);
      set({ autosaveTimer: null });
    };

    const scheduleAutosave = () => {
      clearAutosave();
      const capturedGeneration = get().generation;
      const capturedDesignId = get().designId;
      const timer = schedule(() => {
        const current = get();
        if (
          current.generation !== capturedGeneration ||
          current.designId !== capturedDesignId ||
          current.autosaveTimer !== timer
        ) return;
        set({ autosaveTimer: null });
        void get().save();
      }, delay);
      set({ autosaveTimer: timer });
    };

    const commitCommand = (command: (doc: EditorDocV7) => EditorV7CommandResult): EditorV7ActionResult => {
      const state = get();
      if (!state.doc) return { ok: false, reason: 'missing_document', message: 'no V7 document loaded' };
      if (state.switching) return { ok: false, reason: 'busy', message: 'document switch is in progress' };
      if (state.readOnly) return { ok: false, reason: 'read_only', message: 'document is read-only' };
      const previous = clone(state.doc);
      const commandResult = command(clone(state.doc));
      if (!commandResult.ok) return publicResult(commandResult);
      const next = clone(commandResult.doc);
      next.revision = state.doc.revision + 1;
      next.updatedAt = now();
      const parsed = parseEditorDocV7(next);
      if (!parsed.ok) return { ok: false, reason: 'invalid_document', message: parsed.reason };
      set({
        doc: parsed.doc,
        history: [...state.history.slice(-(HISTORY_LIMIT - 1)), previous],
        future: [],
        saveState: 'dirty',
        saveError: null,
        revisionState: markEditorV7RevisionPending(state.revisionState, parsed.doc.revision),
        selectedStepId: commandResult.selectedStepId ?? state.selectedStepId,
        selectedElementId: commandResult.selectedElementId ?? state.selectedElementId,
      });
      scheduleAutosave();
      return { ok: true };
    };

    const reset = (generation: number) => ({
      designId: null,
      doc: null,
      sourceVersion: null,
      sourceToken: null,
      migrated: false,
      diagnostics: [],
      readOnly: false,
      currentFinger: 'R4' as FingerCode,
      selectedStepId: null,
      selectedElementId: null,
      history: [],
      future: [],
      saveState: 'saved' as EditorV7SaveState,
      saveError: null,
      revisionState: createEditorV7RevisionState(0),
      autosaveTimer: null,
      generation,
      switching: false,
    });

    return {
      ...reset(0),

      load: async (designId, options) => {
        if (get().designId === designId && get().doc) {
          if (options?.readOnly !== undefined) set({ readOnly: options.readOnly });
          return get().diagnostics.length > 0 ? 'ok_with_warnings' : 'ok';
        }
        const target = dependencies.repository.load(designId);
        if (target.status === 'missing') return 'missing';
        if (target.status === 'invalid') return 'invalid';
        if (target.status === 'unsupported') return 'unsupported';

        const current = get();
        const switchingDesign = Boolean(current.doc && current.designId !== designId);
        if (switchingDesign) set({ switching: true });
        if (switchingDesign && current.revisionState.pendingRevision !== null) {
          const saved = await current.save();
          if (saved !== 'saved' && saved !== 'clean') {
            set({ switching: false });
            return 'save_error';
          }
        }
        clearAutosave();
        const doc = clone(target.doc);
        const firstStep = doc.nails.R4.steps[0]?.id ?? null;
        set({
          designId,
          doc,
          sourceVersion: target.sourceVersion ?? 7,
          sourceToken: JSON.stringify(target.original),
          migrated: target.migrated,
          diagnostics: clone(target.diagnostics),
          readOnly: options?.readOnly ?? false,
          currentFinger: 'R4',
          selectedStepId: firstStep,
          selectedElementId: null,
          history: [],
          future: [],
          saveState: 'saved',
          saveError: null,
          revisionState: createEditorV7RevisionState(doc.revision),
          autosaveTimer: null,
          generation: get().generation + 1,
          switching: false,
        });
        return target.status === 'migrated_with_warnings' ? 'ok_with_warnings' : 'ok';
      },

      reloadFromStorage: () => {
        const state = get();
        if (!state.designId) return 'missing';
        if (state.saveState === 'saving' || state.switching) return 'busy';
        const result = dependencies.repository.load(state.designId);
        if (result.status === 'missing') return 'missing';
        if (result.status === 'invalid') return 'invalid';
        if (result.status === 'unsupported') return 'unsupported';
        clearAutosave();
        const doc = clone(result.doc);
        set({
          doc,
          sourceVersion: result.sourceVersion ?? 7,
          sourceToken: JSON.stringify(result.original),
          migrated: result.migrated,
          diagnostics: clone(result.diagnostics),
          history: [],
          future: [],
          saveState: 'saved',
          saveError: null,
          revisionState: createEditorV7RevisionState(doc.revision),
          generation: state.generation + 1,
        });
        return result.status === 'migrated_with_warnings' ? 'ok_with_warnings' : 'ok';
      },

      unload: async () => {
        const state = get();
        if (state.switching) return 'error';
        set({ switching: true });
        clearAutosave();
        if (state.revisionState.pendingRevision !== null) {
          const saved = await get().save();
          if (saved !== 'saved' && saved !== 'clean') {
            set({ switching: false });
            return 'error';
          }
        }
        set(reset(get().generation + 1));
        return 'ok';
      },

      save: async () => {
        const state = get();
        if (!state.doc || !state.designId || state.sourceVersion === null || state.sourceToken === null) return 'error';
        if (state.readOnly) return 'read_only';
        if (state.saveState === 'saving') return 'busy';
        if (state.revisionState.pendingRevision === null) return 'clean';
        clearAutosave();
        const capturedGeneration = state.generation;
        const capturedDesignId = state.designId;
        const capturedRevision = state.doc.revision;
        const capturedDoc = clone(state.doc);
        set({ saveState: 'saving', saveError: null });
        const result = await dependencies.repository.save(capturedDesignId, capturedDoc, {
          sourceVersion: state.sourceVersion,
          userEdited: true,
          expectedStoredRevision: state.sourceVersion === 7 ? state.revisionState.savedRevision : null,
          expectedSourceToken: state.sourceToken,
        });
        const current = get();
        if (current.generation !== capturedGeneration || current.designId !== capturedDesignId) return 'stale';
        if (!result.ok) {
          set({ saveState: 'error', saveError: result.message });
          return 'error';
        }
        const revisionState = applyEditorV7SaveResult(current.revisionState, capturedRevision);
        set({
          revisionState,
          sourceVersion: 7,
          sourceToken: JSON.stringify(result.doc),
          migrated: false,
          saveState: revisionState.pendingRevision === null ? 'saved' : 'dirty',
          saveError: null,
        });
        if (revisionState.pendingRevision !== null) scheduleAutosave();
        return 'saved';
      },

      retrySave: () => get().save(),

      undo: () => {
        const state = get();
        if (!state.doc) return { ok: false, reason: 'missing_document', message: 'no V7 document loaded' };
        if (state.switching) return { ok: false, reason: 'busy', message: 'document switch is in progress' };
        if (state.readOnly) return { ok: false, reason: 'read_only', message: 'document is read-only' };
        if (state.history.length === 0) return { ok: false, reason: 'not_allowed', message: 'nothing to undo' };
        const restored = clone(state.history[state.history.length - 1]);
        restored.revision = state.doc.revision + 1;
        restored.updatedAt = now();
        set({
          doc: restored,
          history: state.history.slice(0, -1),
          future: [clone(state.doc), ...state.future].slice(0, HISTORY_LIMIT),
          saveState: 'dirty',
          saveError: null,
          revisionState: markEditorV7RevisionPending(state.revisionState, restored.revision),
          selectedElementId: null,
        });
        scheduleAutosave();
        return { ok: true };
      },

      redo: () => {
        const state = get();
        if (!state.doc) return { ok: false, reason: 'missing_document', message: 'no V7 document loaded' };
        if (state.switching) return { ok: false, reason: 'busy', message: 'document switch is in progress' };
        if (state.readOnly) return { ok: false, reason: 'read_only', message: 'document is read-only' };
        if (state.future.length === 0) return { ok: false, reason: 'not_allowed', message: 'nothing to redo' };
        const restored = clone(state.future[0]);
        restored.revision = state.doc.revision + 1;
        restored.updatedAt = now();
        set({
          doc: restored,
          history: [...state.history, clone(state.doc)].slice(-HISTORY_LIMIT),
          future: state.future.slice(1),
          saveState: 'dirty',
          saveError: null,
          revisionState: markEditorV7RevisionPending(state.revisionState, restored.revision),
          selectedElementId: null,
        });
        scheduleAutosave();
        return { ok: true };
      },

      setCurrentFinger: (finger) => {
        if (!FINGER_CODES.includes(finger)) return;
        const first = get().doc?.nails[finger].steps[0]?.id ?? null;
        set({ currentFinger: finger, selectedStepId: first, selectedElementId: null });
      },
      selectStep: (stepId) => set({ selectedStepId: stepId, selectedElementId: null }),
      selectElement: (elementId) => set({ selectedElementId: elementId }),
      setTitle: (title) => commitCommand((doc) => ({ ok: true, doc: { ...doc, title } })),
      setBackgroundMode: (finger, mode) => commitCommand((doc) => setEditorV7BackgroundMode(doc, finger, mode)),
      setBackgroundColor: (finger, color) => commitCommand((doc) => setEditorV7BackgroundColor(doc, finger, color)),
      setBackgroundOpacity: (finger, opacity) => commitCommand((doc) => setEditorV7BackgroundOpacity(doc, finger, opacity)),
      addStep: (finger, step, index) => commitCommand((doc) => addEditorV7Step(doc, finger, step, index)),
      deleteStep: (finger, stepId) => {
        const wasSelected = get().selectedStepId === stepId;
        const result = commitCommand((doc) => deleteEditorV7Step(doc, finger, stepId));
        if (result.ok && wasSelected) {
          const nextStepId = get().doc?.nails[finger].steps[0]?.id ?? null;
          set({ selectedStepId: nextStepId, selectedElementId: null });
        }
        return result;
      },
      moveStep: (finger, stepId, targetIndex) => commitCommand((doc) => moveEditorV7Step(doc, finger, stepId, targetIndex)),
      duplicateStep: (finger, stepId) => commitCommand((doc) => duplicateEditorV7Step(doc, finger, stepId, idFactory)),
      setStepFlag: (finger, stepId, flag, value) => commitCommand((doc) => setEditorV7StepFlag(doc, finger, stepId, flag, value)),
      addElement: (finger, stepId, element) => commitCommand((doc) => addEditorV7Element(doc, finger, stepId, element)),
      removeElement: (finger, stepId, elementId) => commitCommand((doc) => removeEditorV7Element(doc, finger, stepId, elementId)),
      setElementFlag: (finger, stepId, elementId, flag, value) => commitCommand((doc) => setEditorV7ElementFlag(doc, finger, stepId, elementId, flag, value)),
      setElementTransform: (finger, stepId, elementId, transform) => commitCommand((doc) => setEditorV7ElementTransform(doc, finger, stepId, elementId, transform)),
    };
  });
}

const identityOnlyResolvers: EditorDocV7MigrationResolvers = {
  resolveGeometry: () => null,
  resolveFinishPreset: () => null,
};

export const editorV7Store = createEditorV7Store({
  repository: createEditorDocV7Repository(createLocalEditorDocV7Storage(), identityOnlyResolvers),
});

export function useEditorV7Store<T>(selector: (state: EditorV7State) => T): T {
  return useStore(editorV7Store, selector);
}

export function selectCurrentNailV7(state: EditorV7State) {
  return state.doc?.nails[state.currentFinger] ?? null;
}

export function selectCurrentStepV7(state: EditorV7State) {
  const nail = selectCurrentNailV7(state);
  return nail?.steps.find((step) => step.id === state.selectedStepId) ?? null;
}
