import { useStore } from 'zustand';
import { createStore, type StoreApi } from 'zustand/vanilla';
import { FINGER_CODES, type FingerCode } from '@/lib/types';
import type {
  AssetRefV7,
  DimensionalDecorationV7,
  EditorDocV7,
  FlatDesignElementV7,
  GradientStopV7,
  ProcessStepV7,
  RegionMaskV7,
  RgbaColorV7,
  SurfaceEffectPayloadV7,
  SurfaceFinishTypeV7,
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
  replaceEditorV7DimensionalDecoration,
  setEditorV7StepFlag,
  setEditorV7SurfaceEffect,
  setEditorV7SurfaceEffectMask,
  setEditorV7SurfaceFinish,
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
  addEditorV7GradientStop,
  applyEditorV7PaletteTheme,
  removeEditorV7GradientStop,
  setEditorV7AdvancedBackgroundMode,
  setEditorV7BackgroundColor,
  setEditorV7BackgroundMode,
  setEditorV7BackgroundOpacity,
  setEditorV7CatEyeParameters,
  setEditorV7GlitterParameters,
  setEditorV7GradientDirection,
  setEditorV7GradientStops,
  type EditorV7AdvancedBackgroundModeV7,
  type EditorV7BackgroundModeV7,
  type EditorV7CatEyeParametersV7,
  type EditorV7GlitterParametersV7,
  type EditorV7PaletteThemeV7,
} from './v7/background';
import {
  type FlatVectorToolV7,
  replaceEditorV7FlatElement,
  setEditorV7FlatElementOpacity,
} from './v7/flat-vector';
import {
  addBundledFlatAssetCommand,
  addPreparedImportCommand,
  addTextFlatElementCommand,
  relinkImageAssetCommand,
  replaceTextFlatElementCommand,
} from './v7/flat-content-commands';
import {
  createFlatAssetRepositoryV7,
  createLocalFlatAssetStorageV7,
  type FlatAssetGetResultV7,
  type FlatAssetRepositoryV7,
} from './v7/flat-content-repository';
import type {
  FlatAssetPreparedV7,
  TextFlatElementInputV7,
} from './v7/flat-content-assets';
import {
  detachEditorV7NailScope,
  detachLinkedEditorV7NailAfterEdit,
  materializeEditorV7NailScope,
  type EditorV7FingerScope,
  type EditorV7FingerScopeKind,
} from './v7/ten-finger-operations';

export type EditorV7SaveState = 'saved' | 'dirty' | 'saving' | 'error';
export type EditorV7LoadResult = 'ok' | 'ok_with_warnings' | 'missing' | 'invalid' | 'unsupported' | 'save_error' | 'busy';
/** Explicit local UI mode for the resource drawer; never part of EditorDocV7. */
export type EditorResourceModeV7 = 'vector' | 'text' | 'assets';
export type EditorV7ActionResult =
  | { ok: true }
  | { ok: false; reason: string; message: string };

export interface EditorV7RuntimeDependencies {
  repository: EditorDocV7Repository;
  flatAssets?: FlatAssetRepositoryV7;
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
  fingerScope: EditorV7FingerScopeKind;
  selectedFingers: FingerCode[];
  selectedStepId: string | null;
  selectedElementId: string | null;
  previewFinishType: SurfaceFinishTypeV7 | null;
  activeFlatTool: FlatVectorToolV7;
  resourceMode: EditorResourceModeV7;
  activeFlatColor: RgbaColorV7;
  activeFlatWidthMm: number;
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
  setFingerScope(scope: EditorV7FingerScopeKind): void;
  toggleSelectedFinger(finger: FingerCode): void;
  clearSelectedFingers(): void;
  copyFingerScope(): EditorV7ActionResult;
  syncFingerScope(): EditorV7ActionResult;
  detachFingerScope(): EditorV7ActionResult;
  selectStep(stepId: string | null): void;
  selectElement(elementId: string | null): void;
  setPreviewFinishType(finishType: SurfaceFinishTypeV7 | null): void;
  setActiveFlatTool(tool: FlatVectorToolV7): void;
  setResourceMode(mode: EditorResourceModeV7): void;
  setActiveFlatColor(color: RgbaColorV7): void;
  setActiveFlatWidthMm(widthMm: number): void;
  setTitle(title: string): EditorV7ActionResult;
  setBackgroundMode(finger: FingerCode, mode: EditorV7BackgroundModeV7): EditorV7ActionResult;
  setBackgroundColor(finger: FingerCode, color: RgbaColorV7): EditorV7ActionResult;
  setBackgroundOpacity(finger: FingerCode, opacity: number): EditorV7ActionResult;
  setAdvancedBackgroundMode(finger: FingerCode, mode: EditorV7AdvancedBackgroundModeV7): EditorV7ActionResult;
  setGradientStops(finger: FingerCode, stops: readonly GradientStopV7[]): EditorV7ActionResult;
  addGradientStop(finger: FingerCode, offset?: number): EditorV7ActionResult;
  removeGradientStop(finger: FingerCode, index: number): EditorV7ActionResult;
  setGradientDirection(finger: FingerCode, directionDeg: number): EditorV7ActionResult;
  setCatEyeParameters(finger: FingerCode, parameters: EditorV7CatEyeParametersV7): EditorV7ActionResult;
  setGlitterParameters(finger: FingerCode, parameters: EditorV7GlitterParametersV7): EditorV7ActionResult;
  applyBackgroundPaletteTheme(finger: FingerCode, theme: EditorV7PaletteThemeV7): EditorV7ActionResult;
  addStep(finger: FingerCode, step: ProcessStepV7, index: number): EditorV7ActionResult;
  deleteStep(finger: FingerCode, stepId: string): EditorV7ActionResult;
  moveStep(finger: FingerCode, stepId: string, targetIndex: number): EditorV7ActionResult;
  duplicateStep(finger: FingerCode, stepId: string): EditorV7ActionResult;
  setStepFlag(finger: FingerCode, stepId: string, flag: 'visible' | 'locked' | 'skipped', value: boolean): EditorV7ActionResult;
  setSurfaceEffect(finger: FingerCode, stepId: string, effect: SurfaceEffectPayloadV7): EditorV7ActionResult;
  setSurfaceEffectMask(finger: FingerCode, stepId: string, mask: RegionMaskV7): EditorV7ActionResult;
  setSurfaceFinish(finger: FingerCode, stepId: string, finishType: SurfaceFinishTypeV7): EditorV7ActionResult;
  addElement(finger: FingerCode, stepId: string, element: FlatDesignElementV7 | DimensionalDecorationV7): EditorV7ActionResult;
  removeElement(finger: FingerCode, stepId: string, elementId: string): EditorV7ActionResult;
  setElementFlag(finger: FingerCode, stepId: string, elementId: string, flag: 'visible' | 'locked', value: boolean): EditorV7ActionResult;
  setElementTransform(finger: FingerCode, stepId: string, elementId: string, transform: Transform2DV7): EditorV7ActionResult;
  replaceFlatElement(finger: FingerCode, stepId: string, elementId: string, replacement: FlatDesignElementV7): EditorV7ActionResult;
  replaceDimensionalDecoration(finger: FingerCode, stepId: string, elementId: string, replacement: DimensionalDecorationV7): EditorV7ActionResult;
  setFlatElementOpacity(finger: FingerCode, stepId: string, elementId: string, opacity: number): EditorV7ActionResult;
  createTextElement(finger: FingerCode, stepId: string, input: Omit<TextFlatElementInputV7, 'id'>): EditorV7ActionResult;
  replaceTextElement(finger: FingerCode, stepId: string, elementId: string, input: TextFlatElementInputV7): EditorV7ActionResult;
  addBundledImage(finger: FingerCode, stepId: string, bundleId: string): EditorV7ActionResult;
  applyPreparedImport(finger: FingerCode, stepId: string, prepared: FlatAssetPreparedV7): Promise<EditorV7ActionResult>;
  relinkImageAsset(finger: FingerCode, stepId: string, elementId: string, asset: AssetRefV7): Promise<EditorV7ActionResult>;
  /** Relink an imported image element from a freshly prepared file. */
  relinkPreparedImageAsset(finger: FingerCode, stepId: string, elementId: string, prepared: FlatAssetPreparedV7): Promise<EditorV7ActionResult>;
  /** Read-only import resolution; never touches doc/history/revision/autosave. */
  resolveFlatAsset(ref: AssetRefV7): Promise<FlatAssetGetResultV7>;
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
  const flatAssets = dependencies.flatAssets ?? createFlatAssetRepositoryV7(createLocalFlatAssetStorageV7());

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

    const commitFingerCommand = (
      finger: FingerCode,
      command: (doc: EditorDocV7) => EditorV7CommandResult,
    ): EditorV7ActionResult => commitCommand((doc) => {
      const result = command(doc);
      return result.ok
        ? { ...result, doc: detachLinkedEditorV7NailAfterEdit(result.doc, finger) }
        : result;
    });

    const currentScope = (): EditorV7FingerScope => {
      const state = get();
      return {
        kind: state.fingerScope,
        currentFinger: state.currentFinger,
        selectedFingers: state.fingerScope === 'selected' ? state.selectedFingers : undefined,
      };
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
      fingerScope: 'current' as EditorV7FingerScopeKind,
      selectedFingers: [] as FingerCode[],
      selectedStepId: null,
      selectedElementId: null,
      previewFinishType: null,
      activeFlatTool: 'select' as FlatVectorToolV7,
      resourceMode: 'vector' as EditorResourceModeV7,
      activeFlatColor: { colorSpace: 'srgb' as const, r: 173, g: 34, b: 79, a: 1 },
      activeFlatWidthMm: 0.45,
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
          fingerScope: 'current',
          selectedFingers: [],
          selectedStepId: firstStep,
          selectedElementId: null,
          previewFinishType: null,
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
          previewFinishType: null,
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
      setFingerScope: (scope) => {
        if (scope !== 'current' && scope !== 'selected' && scope !== 'mirror' && scope !== 'all') return;
        const state = get();
        set({
          fingerScope: scope,
          selectedFingers: scope === 'selected' && state.selectedFingers.length === 0
            ? [state.currentFinger]
            : state.selectedFingers,
        });
      },
      toggleSelectedFinger: (finger) => {
        if (!FINGER_CODES.includes(finger)) return;
        const selected = new Set(get().selectedFingers);
        if (selected.has(finger)) selected.delete(finger);
        else selected.add(finger);
        set({ selectedFingers: FINGER_CODES.filter((candidate) => selected.has(candidate)) });
      },
      clearSelectedFingers: () => set({ selectedFingers: [] }),
      copyFingerScope: () => commitCommand((doc) => materializeEditorV7NailScope(doc, {
        sourceFinger: get().currentFinger,
        scope: currentScope(),
        mode: 'copy-detached',
      }, idFactory)),
      syncFingerScope: () => commitCommand((doc) => materializeEditorV7NailScope(doc, {
        sourceFinger: get().currentFinger,
        scope: currentScope(),
        mode: 'sync-linked',
      }, idFactory)),
      detachFingerScope: () => commitCommand((doc) => detachEditorV7NailScope(doc, currentScope())),
      selectStep: (stepId) => set({ selectedStepId: stepId, selectedElementId: null, activeFlatTool: 'select' }),
      selectElement: (elementId) => set({ selectedElementId: elementId }),
      setPreviewFinishType: (finishType) => {
        if (get().switching) return;
        if (finishType === null || finishType === 'gloss' || finishType === 'matte' || finishType === 'frosted') set({ previewFinishType: finishType });
      },
      setActiveFlatTool: (tool) => set({ activeFlatTool: tool }),
      setResourceMode: (mode) => {
        if (mode === 'vector' || mode === 'text' || mode === 'assets') set({ resourceMode: mode });
      },
      setActiveFlatColor: (color) => set({ activeFlatColor: clone(color) }),
      setActiveFlatWidthMm: (widthMm) => {
        if (Number.isFinite(widthMm) && widthMm >= 0.01 && widthMm <= 10) set({ activeFlatWidthMm: widthMm });
      },
      setTitle: (title) => commitCommand((doc) => ({ ok: true, doc: { ...doc, title } })),
      setBackgroundMode: (finger, mode) => commitFingerCommand(finger, (doc) => setEditorV7BackgroundMode(doc, finger, mode)),
      setBackgroundColor: (finger, color) => commitFingerCommand(finger, (doc) => setEditorV7BackgroundColor(doc, finger, color)),
      setBackgroundOpacity: (finger, opacity) => commitFingerCommand(finger, (doc) => setEditorV7BackgroundOpacity(doc, finger, opacity)),
      setAdvancedBackgroundMode: (finger, mode) => commitFingerCommand(finger, (doc) => setEditorV7AdvancedBackgroundMode(doc, finger, mode)),
      setGradientStops: (finger, stops) => commitFingerCommand(finger, (doc) => setEditorV7GradientStops(doc, finger, stops)),
      addGradientStop: (finger, offset) => commitFingerCommand(finger, (doc) => addEditorV7GradientStop(doc, finger, offset)),
      removeGradientStop: (finger, index) => commitFingerCommand(finger, (doc) => removeEditorV7GradientStop(doc, finger, index)),
      setGradientDirection: (finger, directionDeg) => commitFingerCommand(finger, (doc) => setEditorV7GradientDirection(doc, finger, directionDeg)),
      setCatEyeParameters: (finger, parameters) => commitFingerCommand(finger, (doc) => setEditorV7CatEyeParameters(doc, finger, parameters)),
      setGlitterParameters: (finger, parameters) => commitFingerCommand(finger, (doc) => setEditorV7GlitterParameters(doc, finger, parameters)),
      applyBackgroundPaletteTheme: (finger, theme) => commitFingerCommand(finger, (doc) => applyEditorV7PaletteTheme(doc, finger, theme)),
      addStep: (finger, step, index) => commitFingerCommand(finger, (doc) => addEditorV7Step(doc, finger, step, index)),
      deleteStep: (finger, stepId) => {
        const wasSelected = get().selectedStepId === stepId;
        const result = commitFingerCommand(finger, (doc) => deleteEditorV7Step(doc, finger, stepId));
        if (result.ok && wasSelected) {
          const nextStepId = get().doc?.nails[finger].steps[0]?.id ?? null;
          set({ selectedStepId: nextStepId, selectedElementId: null });
        }
        return result;
      },
      moveStep: (finger, stepId, targetIndex) => commitFingerCommand(finger, (doc) => moveEditorV7Step(doc, finger, stepId, targetIndex)),
      duplicateStep: (finger, stepId) => commitFingerCommand(finger, (doc) => duplicateEditorV7Step(doc, finger, stepId, idFactory)),
      setStepFlag: (finger, stepId, flag, value) => commitFingerCommand(finger, (doc) => setEditorV7StepFlag(doc, finger, stepId, flag, value)),
      setSurfaceEffect: (finger, stepId, effect) => commitFingerCommand(finger, (doc) => setEditorV7SurfaceEffect(doc, finger, stepId, effect)),
      setSurfaceEffectMask: (finger, stepId, mask) => commitFingerCommand(finger, (doc) => setEditorV7SurfaceEffectMask(doc, finger, stepId, mask)),
      setSurfaceFinish: (finger, stepId, finishType) => commitFingerCommand(finger, (doc) => setEditorV7SurfaceFinish(doc, finger, stepId, finishType)),
      addElement: (finger, stepId, element) => commitFingerCommand(finger, (doc) => addEditorV7Element(doc, finger, stepId, element)),
      removeElement: (finger, stepId, elementId) => {
        const wasSelected = get().selectedElementId === elementId;
        const result = commitFingerCommand(finger, (doc) => removeEditorV7Element(doc, finger, stepId, elementId));
        if (result.ok && wasSelected) set({ selectedElementId: null });
        return result;
      },
      setElementFlag: (finger, stepId, elementId, flag, value) => commitFingerCommand(finger, (doc) => setEditorV7ElementFlag(doc, finger, stepId, elementId, flag, value)),
      setElementTransform: (finger, stepId, elementId, transform) => commitFingerCommand(finger, (doc) => setEditorV7ElementTransform(doc, finger, stepId, elementId, transform)),
      replaceFlatElement: (finger, stepId, elementId, replacement) => commitFingerCommand(finger, (doc) => replaceEditorV7FlatElement(doc, finger, stepId, elementId, replacement)),
      replaceDimensionalDecoration: (finger, stepId, elementId, replacement) => commitFingerCommand(finger, (doc) => replaceEditorV7DimensionalDecoration(doc, finger, stepId, elementId, replacement)),
      setFlatElementOpacity: (finger, stepId, elementId, opacity) => commitFingerCommand(finger, (doc) => setEditorV7FlatElementOpacity(doc, finger, stepId, elementId, opacity)),
      createTextElement: (finger, stepId, input) => commitFingerCommand(finger, (doc) => addTextFlatElementCommand(doc, finger, stepId, { ...input, id: idFactory('element') })),
      replaceTextElement: (finger, stepId, elementId, input) => commitFingerCommand(finger, (doc) => replaceTextFlatElementCommand(doc, finger, stepId, elementId, input)),
      addBundledImage: (finger, stepId, bundleId) => commitFingerCommand(finger, (doc) => addBundledFlatAssetCommand(doc, finger, stepId, bundleId, idFactory('element'))),
      applyPreparedImport: async (finger, stepId, prepared) => {
        const state = get();
        if (!state.doc) return { ok: false, reason: 'missing_document', message: 'no V7 document loaded' };
        if (state.switching) return { ok: false, reason: 'busy', message: 'document switch is in progress' };
        if (state.readOnly) return { ok: false, reason: 'read_only', message: 'document is read-only' };
        if (!prepared || typeof prepared !== 'object' || !prepared.asset || typeof prepared.source !== 'string') {
          return { ok: false, reason: 'invalid_value', message: 'prepared import payload is not well formed' };
        }
        // Pre-validate the target step so common gate failures never orphan a
        // repository entry; the canonical commit still re-checks atomically.
        const step = state.doc.nails[finger]?.steps.find((candidate) => candidate.id === stepId);
        if (!step) return { ok: false, reason: 'not_found', message: 'step not found' };
        if (step.kind !== 'flat_design') {
          return { ok: false, reason: 'not_allowed', message: 'prepared import requires a flat design step' };
        }
        if (step.locked) return { ok: false, reason: 'locked', message: 'step is locked' };
        // Repository write happens BEFORE the canonical commit; a failed write
        // must never leave a document change behind.
        const put = await flatAssets.put(prepared.asset, prepared.source);
        if (!put.ok) return { ok: false, reason: put.reason, message: put.message };
        const result = commitFingerCommand(finger, (doc) => addPreparedImportCommand(doc, finger, stepId, idFactory('element'), prepared.asset));
        // Known limitation: if the canonical commit fails AFTER a successful
        // repository write, the orphan asset entry may remain in the flat
        // asset repository, but EditorDocV7 is guaranteed unchanged.
        return result;
      },
      relinkImageAsset: async (finger, stepId, elementId, asset) => {
        const state = get();
        if (!state.doc) return { ok: false, reason: 'missing_document', message: 'no V7 document loaded' };
        if (state.switching) return { ok: false, reason: 'busy', message: 'document switch is in progress' };
        if (state.readOnly) return { ok: false, reason: 'read_only', message: 'document is read-only' };
        const resolved = await flatAssets.get(asset);
        if (resolved.status === 'missing' || resolved.status === 'corrupt') {
          return { ok: false, reason: 'not_found', message: 'asset source is not available for relink' };
        }
        return commitFingerCommand(finger, (doc) => relinkImageAssetCommand(doc, finger, stepId, elementId, asset));
      },
      relinkPreparedImageAsset: async (finger, stepId, elementId, prepared) => {
        const state = get();
        if (!state.doc) return { ok: false, reason: 'missing_document', message: 'no V7 document loaded' };
        if (state.switching) return { ok: false, reason: 'busy', message: 'document switch is in progress' };
        if (state.readOnly) return { ok: false, reason: 'read_only', message: 'document is read-only' };
        if (!prepared || typeof prepared !== 'object' || !prepared.asset || typeof prepared.source !== 'string') {
          return { ok: false, reason: 'invalid_value', message: 'prepared relink payload is not well formed' };
        }
        // Precheck gates before touching the repository so common failures
        // never orphan a stored asset entry; the canonical commit re-checks.
        const step = state.doc.nails[finger]?.steps.find((candidate) => candidate.id === stepId);
        if (!step) return { ok: false, reason: 'not_found', message: 'step not found' };
        if (step.kind !== 'flat_design') return { ok: false, reason: 'not_allowed', message: 'relink requires a flat design step' };
        if (step.locked) return { ok: false, reason: 'locked', message: 'step is locked' };
        const element = step.elements.find((candidate) => candidate.id === elementId);
        if (!element) return { ok: false, reason: 'not_found', message: 'element not found' };
        if (element.kind !== 'image_2d') return { ok: false, reason: 'not_allowed', message: 'relink requires an image_2d element' };
        if (element.role !== 'import') {
          return { ok: false, reason: 'not_allowed', message: 'bundled sticker/stamp relink is not offered in this release' };
        }
        if (element.locked) return { ok: false, reason: 'locked', message: 'element is locked' };
        // Repository write happens BEFORE the canonical commit; a failed write
        // must never leave a document change behind.
        const put = await flatAssets.put(prepared.asset, prepared.source);
        if (!put.ok) return { ok: false, reason: put.reason, message: put.message };
        const result = commitFingerCommand(finger, (doc) => relinkImageAssetCommand(doc, finger, stepId, elementId, prepared.asset));
        // Known limitation: if the canonical commit fails AFTER a successful
        // repository write, the orphan asset entry may remain in the flat
        // asset repository, but EditorDocV7 is guaranteed unchanged.
        return result;
      },
      resolveFlatAsset: async (ref) => flatAssets.get(ref),
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
