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
import { readData, StorageKeys } from '@/lib/storage';
import { isScenarioOn, useMockScenarios } from '@/lib/mock-panel';
import { loadSilhouette } from '@/studio/preview/nail-assets';
import { loadBackPlateV2 } from '@/studio/render';
import { loadPalette, loadShapeParams, type TemplateEntry } from '@/studio/preview/material-library';
import { renderThumbnailDataUrl } from '@/studio/preview/export-png';
import { persistDesign } from './design-repository';

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

/** 视图 tab 属 UI 瞬态分区（StudioStatePartitions.ui）：不写入设计文档，仅 sessionStorage 记忆 */
const VIEW_MODE_SESSION_KEY = 'ui.wizard-viewmode';

function initialViewMode(): WizardViewMode {
  try {
    const v = window.sessionStorage.getItem(VIEW_MODE_SESSION_KEY);
    if (v === 'ensemble' || v === 'tiled' || v === 'single') return v;
  } catch {
    /* sessionStorage 不可用时用默认值 */
  }
  return 'tiled';
}

interface WizardState {
  /* 流程 */
  step: 1 | 2;
  pickerOpen: boolean;
  customer: Customer | null;
  /* 主视觉视图（UI 瞬态） */
  viewMode: WizardViewMode;
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
  /* 设计参数 */
  templateId: string | null;
  templateName: string | null;
  baseColor: string | null;
  finish: Finish;
  fingerOverrides: FingerOverrides;
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
  setShape: (s: NailShape) => void;
  setLength: (l: NailLength) => void;
  setStyle: (id: string, name: string) => void;
  markStylePrompted: () => void;
  applyAndEnter: () => Promise<boolean>;
  startEditShapeLength: () => void;
  cancelEditShapeLength: () => void;
  applyShapeLengthEdit: () => Promise<boolean>;
  applyTemplate: (t: TemplateEntry) => void;
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

const initialDesignId = (): string => `d_${crypto.randomUUID()}`;

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

  /** STEP 1 [应用→预览十指] / 顶栏 [应用→重新生成] 公共逻辑 */
  async function applyShapeLength(enterStep2: boolean): Promise<boolean> {
    const s = get();
    if (!s.shape || !s.length || s.applying) return false;
    set({ applying: true });
    try {
      if (isScenarioOn(useMockScenarios.getState().flags, 'render.failAll')) {
        throw new Error('预览生成失败（MOCK）');
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
        baseColor: s.baseColor ?? palette[0]?.hex ?? '#F5E0D3',
      });
      markDirty(2000);
      return true;
    } catch {
      set({ applying: false });
      return false;
    }
  }

  return {
    step: 1,
    pickerOpen: true,
    customer: null,
    viewMode: initialViewMode(),
    shape: null,
    length: null,
    styleId: null,
    styleName: null,
    stylePrompted: false,
    appliedShape: null,
    appliedLength: null,
    editingShapeLength: false,
    applying: false,
    templateId: null,
    templateName: null,
    baseColor: null,
    finish: 'gloss',
    fingerOverrides: {},
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
    setShape: (shape) => set({ shape }),
    setLength: (length) => set({ length }),
    setStyle: (styleId, styleName) => set({ styleId, styleName, stylePrompted: true }),
    markStylePrompted: () => set({ stylePrompted: true }),

    applyAndEnter: () => applyShapeLength(true),

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
      set({
        templateId: t.id,
        templateName: t.name,
        baseColor: t.default_base_color,
        finish: t.default_finish,
      });
      markDirty(2000); // 应用模板后 2s 防抖自动保存
    },

    setBaseColor: (hex) => {
      if (get().status !== 'draft') return;
      set({ baseColor: hex });
      markDirty(3000); // 改底色后 3s 防抖自动保存
    },

    setFinish: (finish) => {
      if (get().status !== 'draft') return;
      set({ finish });
      markDirty(2000);
    },

    setFingerOverride: (fc, patch) => {
      if (get().status !== 'draft') return;
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
      if (get().status !== 'draft') return;
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
        const simulateFailure = isScenarioOn(useMockScenarios.getState().flags, 'save.fail');
        await persistDesign(confirmed, { simulateFailure });
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
