/**
 * Studio Wizard 状态中枢（Studio-PRD §十二 / DEV-PLAN §5）
 *
 * 流程：客户选择器 → STEP 1 门禁（甲型/长度）→ STEP 2 三栏画布。
 * 保存体系：应用模板 2s / 改底色 3s 防抖自动保存 + 手动保存 + 失败自动重试 3 次。
 * 确认闭环：[顾客已确认] → state-machine confirmDesign → 冻结只读（线下场景，
 * 无任何线上确认功能）。数据落 StorageKeys.designs（DesignSummary[]），
 * 供「我的设计」列表模块读取。
 */

import { create } from 'zustand';
import type {
  Confirmation,
  Customer,
  DesignStatus,
  DesignSummary,
  FingerCode,
  FingerOverride,
  FingerOverrides,
  Finish,
  NailLength,
  NailShape,
} from '@/lib/types';
import { confirmDesign } from '@/lib/state-machine';
import { createClientId, readData, StorageKeys } from '@/lib/storage';
import { isScenarioOn, useMockScenarios } from '@/lib/mock-panel';
import { loadSilhouette } from '@/studio/preview/nail-assets';
import { loadBackPlateV2 } from '@/studio/render';
import {
  isWizardShapeEnabled,
  loadPalette,
  loadShapeCapabilities,
  loadShapeParams,
  type TemplateEntry,
} from '@/studio/preview/material-library';
import { renderThumbnailDataUrl } from '@/studio/preview/export-png';
import { persistDesign } from './design-repository';
import {
  createMercuryInstance,
  createPetalVeilInstance,
  isPetalVeilRecipe,
  type RecipeInstanceV1,
} from '@/studio/editor/lib/recipe-model';
import { recipeDefinitionChecksum } from '@/studio/editor/lib/recipe-checksum';
import { PETAL_VEIL_P0_ENABLED } from '@/studio/petal-veil/feature';
import type { WizardDraftV1 } from './wizard-draft';

/* ── Toast 桥（页面挂载时注入，store 内不直接使用 hooks） ── */

interface WizardNotifier {
  success: (msg: string) => void;
  error: (msg: string) => void;
}
let notifier: WizardNotifier | null = null;
export function setWizardNotifier(n: WizardNotifier | null): void {
  notifier = n;
}

/* ── 类型 ── */

export type SaveState = 'saved' | 'dirty' | 'saving' | 'error';

/** 主视觉三视图：整体搭配（plate 相机裁剪）/ 十指平铺（默认）/ 单指细节 */
export type WizardViewMode = 'ensemble' | 'tiled' | 'single';

/** 指尖观察方向：up 指尖朝画布上方（默认）/ down 组合画布整体旋转 180° 指尖朝下（纯视图层） */
export type TipOrientation = 'up' | 'down';

/** 视图 tab 属 UI 瞬态分区（StudioStatePartitions.ui）：不写入设计文档，仅 sessionStorage 记忆 */
const VIEW_MODE_SESSION_KEY = 'ui.wizard-viewmode';
/** 指尖朝向同属 UI 瞬态：不写 DesignDoc / fingerOverrides，不触发自动保存 */
const TIP_ORIENTATION_SESSION_KEY = 'ui.wizard-tip-orientation';

function initialViewMode(): WizardViewMode {
  try {
    const v = window.sessionStorage.getItem(VIEW_MODE_SESSION_KEY);
    if (v === 'ensemble' || v === 'tiled' || v === 'single') return v;
  } catch {
    /* sessionStorage 不可用时用默认值 */
  }
  return 'tiled';
}

function initialTipOrientation(): TipOrientation {
  try {
    const v = window.sessionStorage.getItem(TIP_ORIENTATION_SESSION_KEY);
    if (v === 'up' || v === 'down') return v;
  } catch {
    /* sessionStorage 不可用时用默认值 */
  }
  return 'up';
}

interface WizardState {
  /* 流程 */
  step: 1 | 2;
  pickerOpen: boolean;
  customer: Customer | null;
  /* 主视觉视图（UI 瞬态） */
  viewMode: WizardViewMode;
  /* 指尖观察方向（UI 瞬态：整体搭配视图与顾客展示共享，不写设计数据） */
  tipOrientation: TipOrientation;
  /* STEP 1 选择（编辑态复用） */
  shape: NailShape | null;
  length: NailLength | null;
  /* 风格推荐弹窗（v1.3.0：选完甲型 → 弹风格推荐 → 再进入画布） */
  styleId: string | null;
  styleName: string | null;
  stylePrompted: boolean;
  /* STEP 2 已应用（预览实际渲染值） */
  appliedShape: NailShape | null;
  appliedLength: NailLength | null;
  editingShapeLength: boolean;
  applying: boolean;
  /** 进入画布/重新生成失败的持久错误（toast 会消失，内联错误条常驻到重试成功） */
  applyError: string | null;
  /** 手动保存成功后的「转给客人看看？」引导气泡（UI 瞬态，不持久化） */
  presentNudge: boolean;
  /* 设计参数 */
  templateId: string | null;
  templateName: string | null;
  baseColor: string | null;
  finish: Finish;
  fingerOverrides: FingerOverrides;
  recipe?: RecipeInstanceV1;
  selectedFinger: FingerCode | null;
  /* 持久化 */
  designId: string;
  createdAt: string;
  version: number;
  status: DesignStatus;
  confirmation?: Confirmation;
  saveState: SaveState;

  /* actions */
  openPicker: () => void;
  closePicker: () => void;
  setCustomer: (c: Customer) => void;
  setViewMode: (v: WizardViewMode) => void;
  setTipOrientation: (o: TipOrientation) => void;
  setShape: (s: NailShape) => void;
  setLength: (l: NailLength) => void;
  setStyle: (id: string, name: string) => void;
  markStylePrompted: () => void;
  applyAndEnter: () => Promise<boolean>;
  startEditShapeLength: () => void;
  cancelEditShapeLength: () => void;
  applyShapeLengthEdit: () => Promise<boolean>;
  clearApplyError: () => void;
  setPresentNudge: (v: boolean) => void;
  applyTemplate: (t: TemplateEntry) => void;
  /** Community Intent「新建设计」：新 designId + 清空工作态，保持 draft */
  resetForNewDesign: () => void;
  /** 恢复版本化活动草稿；Customer 始终从主数据重新解析。 */
  restoreDraft: (draft: WizardDraftV1, customer: Customer | null) => void;
  setBaseColor: (hex: string) => void;
  setFinish: (f: Finish) => void;
  setFingerOverride: (fc: FingerCode, patch: FingerOverride) => void;
  clearFingerOverride: (fc: FingerCode) => void;
  setSelectedFinger: (fc: FingerCode | null) => void;
  saveNow: (opts?: { manual?: boolean }) => Promise<boolean>;
  retrySave: () => Promise<boolean>;
  markConfirmed: () => Promise<boolean>;
}

/* ── 防抖自动保存 ── */

let autosaveTimer: number | null = null;

function scheduleAutosave(save: () => void, delayMs: number): void {
  if (autosaveTimer !== null) window.clearTimeout(autosaveTimer);
  autosaveTimer = window.setTimeout(() => {
    autosaveTimer = null;
    save();
  }, delayMs);
}

function confirmedByFromSession(): string {
  const session = readData<{ userName?: string; email?: string }>(StorageKeys.session);
  return session?.userName ?? session?.email ?? '美甲师';
}

const initialDesignId = (): string => createClientId('d_');
const rendererVersionFor = (recipe?: RecipeInstanceV1): string =>
  isPetalVeilRecipe(recipe) ? 'three-pbr/petal-veil-1' : 'svg-2.5d/mercury-1';

export const useWizardStore = create<WizardState>((set, get) => {
  /** 由当前状态组装 DesignSummary（缩略图 best-effort，不阻断保存） */
  async function buildSummary(): Promise<DesignSummary | null> {
    const s = get();
    if (!s.customer || !s.appliedShape || !s.appliedLength || !s.baseColor) return null;
    const thumbnailDataUrl = s.step === 2 ? await renderThumbnailDataUrl() : undefined;
    return {
      id: s.designId,
      customerId: s.customer.id,
      title: s.templateName ?? '未命名设计',
      shape: s.appliedShape,
      length: s.appliedLength,
      templateId: s.templateId ?? undefined,
      baseColor: s.baseColor,
      finish: s.finish,
      fingerOverrides: Object.keys(s.fingerOverrides).length > 0 ? s.fingerOverrides : undefined,
      status: s.status,
      confirmation: s.confirmation,
      source: 'wizard',
      version: s.version,
      thumbnailDataUrl,
      recipe: s.recipe,
      outputPolicy: s.recipe
        ? {
            label: isPetalVeilRecipe(s.recipe)
              ? '高保真候选 · 待视觉签收 · 制造未验证'
              : '模拟效果 · 尚未完成生产验证',
            rendererVersion: rendererVersionFor(s.recipe),
          }
        : undefined,
      confirmationSnapshot: s.confirmation && s.recipe
        ? {
            recipeRef: s.recipe.recipeRef,
            definitionChecksum: recipeDefinitionChecksum(s.recipe.recipeRef.id),
            rendererVersion: rendererVersionFor(s.recipe),
          }
        : undefined,
      createdAt: s.createdAt,
      updatedAt: new Date().toISOString(),
    };
  }

  /** 保存（自动重试 3 次 → 失败 Toast + saveState=error，可由 [重试保存] 恢复） */
  async function performSave(opts: { manual?: boolean } = {}): Promise<boolean> {
    const s = get();
    if (s.saveState === 'saving') return false;
    const summary = await buildSummary();
    if (!summary) return false;
    set({ saveState: 'saving' });
    const simulateFailure = isScenarioOn(useMockScenarios.getState().flags, 'save.fail');
    const MAX_ATTEMPTS = 3;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
      try {
        await persistDesign(summary, { simulateFailure });
        set({ saveState: 'saved' });
        if (opts.manual) notifier?.success('已保存');
        return true;
      } catch {
        if (attempt < MAX_ATTEMPTS) {
          await new Promise((r) => window.setTimeout(r, 400));
        }
      }
    }
    set({ saveState: 'error' });
    notifier?.error('保存失败。修改已暂存本地。');
    return false;
  }

  function markDirty(delayMs: number): void {
    if (get().status !== 'draft') return; // 冻结只读
    set({ saveState: 'dirty' });
    scheduleAutosave(() => void performSave(), delayMs);
  }

  /** STEP 1 [下一步：选风格] / 顶栏 [应用→重新生成] 公共逻辑 */
  async function applyShapeLength(enterStep2: boolean): Promise<boolean> {
    const s = get();
    if (!s.shape || !s.length || s.applying) return false;
    set({ applying: true, applyError: null });
    try {
      if (isScenarioOn(useMockScenarios.getState().flags, 'render.failAll')) {
        throw new Error('预览生成失败（MOCK）');
      }
      // UI 灰卡不是安全边界：动作层再次检查能力注册表，禁止恢复数据/直接 action 绕过门禁。
      const registry = await loadShapeCapabilities();
      const capability = registry.shapes.find((item) => item.id === s.shape);
      if (!capability || !isWizardShapeEnabled(capability)) {
        throw new Error(`甲型 ${s.shape} 尚未通过 Wizard 能力门禁`);
      }
      // 预生成：轮廓 + V2 plate/slots + 参数源 + 色板（首次进入初始化默认底色）
      const [, , , palette] = await Promise.all([
        loadSilhouette(s.shape, s.length).then(() => undefined),
        loadBackPlateV2().then(() => undefined),
        loadShapeParams(),
        loadPalette(),
      ]);
      set({
        appliedShape: s.shape,
        appliedLength: s.length,
        step: enterStep2 ? 2 : s.step,
        editingShapeLength: false,
        applying: false,
        applyError: null,
        baseColor: s.baseColor ?? palette[0]?.hex ?? '#F5E0D3',
      });
      markDirty(2000);
      return true;
    } catch {
      set({ applying: false, applyError: '预览生成失败。甲型与长度选择已保留，请重试。' });
      return false;
    }
  }

  return {
    step: 1,
    pickerOpen: true,
    customer: null,
    viewMode: initialViewMode(),
    tipOrientation: initialTipOrientation(),
    shape: null,
    length: null,
    styleId: null,
    styleName: null,
    stylePrompted: false,
    appliedShape: null,
    appliedLength: null,
    editingShapeLength: false,
    applying: false,
    applyError: null,
    presentNudge: false,
    templateId: null,
    templateName: null,
    baseColor: null,
    finish: 'gloss',
    fingerOverrides: {},
    recipe: undefined,
    selectedFinger: null,
    designId: initialDesignId(),
    createdAt: new Date().toISOString(),
    version: 1,
    status: 'draft',
    saveState: 'saved',

    openPicker: () => set({ pickerOpen: true }),
    closePicker: () => set({ pickerOpen: false }),
    setCustomer: (customer) => set({ customer, pickerOpen: false }),
    setViewMode: (viewMode) => {
      try {
        window.sessionStorage.setItem(VIEW_MODE_SESSION_KEY, viewMode);
      } catch {
        /* 忽略持久化失败，视图切换本身仍生效 */
      }
      set({ viewMode });
    },
    /* 观察方向切换：纯 UI 瞬态——不 setDirty、不调度自动保存、不写任何设计数据 */
    setTipOrientation: (tipOrientation) => {
      try {
        window.sessionStorage.setItem(TIP_ORIENTATION_SESSION_KEY, tipOrientation);
      } catch {
        /* 忽略持久化失败，方向切换本身仍生效 */
      }
      set({ tipOrientation });
    },
    setShape: (shape) => set({ shape }),
    setLength: (length) => set({ length }),
    setStyle: (styleId, styleName) => set({ styleId, styleName, stylePrompted: true }),
    markStylePrompted: () => set({ stylePrompted: true }),

    applyAndEnter: () => applyShapeLength(true),
    clearApplyError: () => set({ applyError: null }),
    setPresentNudge: (presentNudge) => set({ presentNudge }),

    startEditShapeLength: () => {
      const s = get();
      set({ editingShapeLength: true, shape: s.appliedShape, length: s.appliedLength });
    },
    cancelEditShapeLength: () => {
      const s = get();
      // 完整恢复修改前状态（模板与参数本就不动）
      set({ editingShapeLength: false, shape: s.appliedShape, length: s.appliedLength });
    },
    applyShapeLengthEdit: () => applyShapeLength(false),

    applyTemplate: (t) => {
      if (get().status !== 'draft') return;
      const petalP0 = PETAL_VEIL_P0_ENABLED && t.id === 't_petal_veil_french';
      set({
        templateId: petalP0 ? t.id : (t.render_template_id ?? t.id),
        templateName: t.name,
        baseColor: petalP0 ? '#F2E4DA' : t.default_base_color,
        finish: petalP0 ? 'gloss' : t.default_finish,
        shape: petalP0 ? 'almond' : get().shape,
        length: petalP0 ? 'medium' : get().length,
        appliedShape: petalP0 ? 'almond' : get().appliedShape,
        appliedLength: petalP0 ? 'medium' : get().appliedLength,
        selectedFinger: petalP0 ? 'R4' : get().selectedFinger,
        fingerOverrides: petalP0 ? {} : get().fingerOverrides,
        viewMode: petalP0 ? 'tiled' : get().viewMode,
        recipe: petalP0
          ? createPetalVeilInstance()
          : t.name.includes('Mercury Dew') || t.id === 't_mercury_dew_concept'
            ? createMercuryInstance('signature', t.default_base_color)
            : undefined,
      });
      markDirty(2000); // 应用模板后 2s 防抖自动保存
    },

    resetForNewDesign: () => {
      if (autosaveTimer !== null) {
        window.clearTimeout(autosaveTimer);
        autosaveTimer = null;
      }
      set({
        step: 1,
        pickerOpen: true,
        customer: null,
        shape: null,
        length: null,
        styleId: null,
        styleName: null,
        stylePrompted: false,
        appliedShape: null,
        appliedLength: null,
        editingShapeLength: false,
        applying: false,
        applyError: null,
        presentNudge: false,
        templateId: null,
        templateName: null,
        baseColor: null,
        finish: 'gloss',
        fingerOverrides: {},
        recipe: undefined,
        selectedFinger: null,
        designId: initialDesignId(),
        createdAt: new Date().toISOString(),
        version: 1,
        status: 'draft',
        confirmation: undefined,
        saveState: 'saved',
      });
    },

    restoreDraft: (draft, customer) => {
      if (autosaveTimer !== null) {
        window.clearTimeout(autosaveTimer);
        autosaveTimer = null;
      }
      set({
        step: draft.step,
        pickerOpen: !customer,
        customer,
        shape: draft.shape,
        length: draft.length,
        styleId: draft.styleId,
        styleName: draft.styleName,
        stylePrompted: draft.stylePrompted,
        appliedShape: draft.appliedShape,
        appliedLength: draft.appliedLength,
        editingShapeLength: false,
        applying: false,
        applyError: null,
        presentNudge: false,
        templateId: draft.templateId,
        templateName: draft.templateName,
        baseColor: draft.baseColor,
        finish: draft.finish,
        fingerOverrides: structuredClone(draft.fingerOverrides),
        recipe: draft.recipe ? structuredClone(draft.recipe) : undefined,
        selectedFinger: null,
        designId: draft.designId,
        createdAt: draft.createdAt,
        version: draft.version,
        status: draft.status,
        confirmation: draft.confirmation ? structuredClone(draft.confirmation) : undefined,
        saveState: 'saved',
      });
    },

    setBaseColor: (hex) => {
      if (get().status !== 'draft' || isPetalVeilRecipe(get().recipe)) return;
      set({ baseColor: hex });
      markDirty(3000); // 改底色后 3s 防抖自动保存
    },

    setFinish: (finish) => {
      if (get().status !== 'draft' || isPetalVeilRecipe(get().recipe)) return;
      set({ finish });
      markDirty(2000);
    },

    setFingerOverride: (fc, patch) => {
      if (get().status !== 'draft' || isPetalVeilRecipe(get().recipe)) return;
      const prev = get().fingerOverrides;
      const merged: FingerOverride = { ...prev[fc], ...patch };
      const next: FingerOverrides = { ...prev, [fc]: merged };
      if (merged.baseColor === undefined && merged.decorationId === undefined) {
        delete next[fc];
      }
      set({ fingerOverrides: next });
      markDirty(2000);
    },

    clearFingerOverride: (fc) => {
      if (get().status !== 'draft' || isPetalVeilRecipe(get().recipe)) return;
      const next = { ...get().fingerOverrides };
      delete next[fc];
      set({ fingerOverrides: next });
      markDirty(2000);
    },

    setSelectedFinger: (fc) => set({ selectedFinger: fc }),

    saveNow: (opts) => performSave(opts),
    retrySave: () => performSave({ manual: true }),

    markConfirmed: async () => {
      const summary = await buildSummary();
      if (!summary) return false;
      try {
        const confirmed = confirmDesign(summary, confirmedByFromSession());
        const frozen = confirmed.recipe
          ? {
              recipeRef: confirmed.recipe.recipeRef,
              definitionChecksum: recipeDefinitionChecksum(confirmed.recipe.recipeRef.id),
              rendererVersion: rendererVersionFor(confirmed.recipe),
            }
          : undefined;
        const frozenDesign = frozen ? { ...confirmed, confirmationSnapshot: frozen } : confirmed;
        const simulateFailure = isScenarioOn(useMockScenarios.getState().flags, 'save.fail');
        await persistDesign(frozenDesign, { simulateFailure });
        set({ status: 'confirmed', confirmation: confirmed.confirmation, saveState: 'saved' });
        notifier?.success('已标记「顾客已确认」，设计已冻结。');
        return true;
      } catch (err) {
        notifier?.error(err instanceof Error ? err.message : '操作失败，请重试。');
        return false;
      }
    },
  };
});
