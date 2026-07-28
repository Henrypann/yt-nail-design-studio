/**
 * 领域类型 · FRONTEND_MOCK 证据级
 * 依据：DEV-PLAN §6.1 / §6.2（v1.1.0 线下确认状态机）、Studio-PRD §5.1。
 * 红线：DesignStatus 仅六值 —— 不存在 pending_confirm / frozen；
 *       confirmation 仅 { confirmedAt, confirmedBy } —— 无 channel / notes / sentAt。
 */

/* ── 基础枚举 ─────────────────────────────────────────── */

/** 十指编码：L1–L5 左手拇指→小指，R1–R5 右手拇指→小指 */
export type FingerCode =
  | 'L1' | 'L2' | 'L3' | 'L4' | 'L5'
  | 'R1' | 'R2' | 'R3' | 'R4' | 'R5';

export const FINGER_CODES: readonly FingerCode[] = [
  'L1', 'L2', 'L3', 'L4', 'L5',
  'R1', 'R2', 'R3', 'R4', 'R5',
] as const;

/** 产品甲型目录；由非几何能力注册表生成，轮廓参数仍只认 shape-params.json */
export type { NailShape } from '@/generated/shape-types';
import type { NailShape } from '@/generated/shape-types';

/** 四档长度 */
export type NailLength = 'short' | 'medium' | 'long' | 'extra-long';

/** 封层质感 */
export type Finish = 'gloss' | 'matte' | 'pearl';

/** Twin 三态 Mock 值（PRD §5.1，展示时标 MOCK） */
export type TwinStatus = 'MOCK_VALID' | 'MOCK_LOW_CONFIDENCE' | 'NO_DATA';

/* ── 设计状态机（§6.2 线下确认简化版） ─────────────────── */

export type DesignStatus =
  | 'draft' // 草稿，编辑中
  | 'confirmed' // 美甲师手动标记「顾客已确认」→ 冻结只读
  | 'submitted' // 提交生产（Sprint 2+ / 后端就绪后）
  | 'completed'
  | 'exported'
  | 'archived';

/** 线下确认记录：顾客在场口头确认，美甲师手动标记。无线上发送动作。 */
export interface Confirmation {
  confirmedAt: string; // ISO 时间戳
  confirmedBy: string; // 操作者（用户名/账号）
}

/** Wizard 参数级逐指例外（换装饰/换色），数据仅为参数覆盖，无图层概念 */
export interface FingerOverride {
  /** 指级底色覆盖 */
  baseColor?: string;
  /** 预制附件替换（爱心/珍珠/蝴蝶结…），null = 清除该指附件 */
  decorationId?: string | null;
}
export type FingerOverrides = Partial<Record<FingerCode, FingerOverride>>;

/* ── Customer ─────────────────────────────────────────── */

export interface Customer {
  id: string;
  name: string; // 2–60 字符
  email?: string; // 同门店内唯一
  allergyNotes?: string; // 过敏/安全备注，≤500 字符
  preferenceNotes?: string; // 偏好备注，≤500 字符
  /** 隐私政策同意时间戳（ISO），新建必选 */
  privacyConsentAt: string;
  /** Nail Twin 数据保存同意（可选） */
  twinConsent: boolean;
  /** 软删除标记；true 时从列表移除，历史设计保留 */
  deleted: boolean;
  twinStatus: TwinStatus;
  createdAt: string;
  updatedAt: string;
  /** 最近到店（Sprint 2 启用） */
  lastVisitAt?: string;
}

/* ── Device ───────────────────────────────────────────── */

export type DeviceType = 'scanner' | 'printer_3d' | 'uv_printer';
export type DeviceStatus = 'online' | 'offline' | 'busy';

export interface Device {
  id: string;
  alias: string; // 绑定时设置的名称
  type: DeviceType;
  status: DeviceStatus;
  deviceCode: string; // device_code 绑定
  boundAt: string;
  lastSeenAt?: string;
}

/* ── DesignSummary ────────────────────────────────────── */

export interface DesignSummary {
  id: string;
  customerId: string;
  title?: string;
  shape: NailShape;
  length: NailLength;
  templateId?: string; // Wizard 应用的模板（material-library/templates/index.json）
  baseColor: string; // hex
  finish: Finish;
  fingerOverrides?: FingerOverrides;
  status: DesignStatus;
  confirmation?: Confirmation;
  /** 来源：wizard 主路径 / editor 自由画布 */
  source: 'wizard' | 'editor';
  /** 版本链：基于已确认设计创建新版本时指向原设计 id */
  parentId?: string;
  version: number;
  thumbnailDataUrl?: string; // PNG 缩略图（原型期唯一导出形态）
  createdAt: string;
  updatedAt: string;
}

/* ── ProjectV3（画布数据 envelope 载荷） ──────────────── */

/** 五层底层结构（不重构；对用户呈现三层制造语义） */
export type LayerType = 'base' | 'texture' | 'pattern' | 'decoration' | 'finish';

export interface LayerElement {
  id: string;
  type: string; // 'template_pattern' | 'brush' | 'text' | 'import' | 'attachment' ...
  transform: { x: number; y: number; scale: number; rotation: number };
  editable: boolean;
  /** 附件层立体高度，参数域 0.05–0.30mm（唯一高度通路） */
  heightMm?: number;
  payload?: Record<string, unknown>;
}

export interface ProjectLayer {
  type: LayerType;
  visible: boolean;
  locked: boolean;
  color?: string; // base 层底色
  elements: LayerElement[];
}

/** ProjectV3：画布工程数据（localStorage envelope 的 data 载荷，结构沿用原型，不改动） */
export interface ProjectV3 {
  schemaVersion: 3;
  projectId: string;
  designId?: string;
  customerId?: string; // 桥接提前填写
  appliedLookId?: string; // 桥接提前填写
  shape: NailShape;
  length: NailLength;
  layers: ProjectLayer[];
  /** Editor 逐指解锁（空 = 十指同步） */
  fingerLocks?: Partial<Record<FingerCode, boolean>>;
  updatedAt: string;
}

/* ── DesignSet 契约层（v1.4.0 · DEV-PLAN §5.11 / 备忘录 §11） ─────────────
 * 契约层类型：描述目标数据形态，当前仅用于文档对齐与新模块签名，
 * 未接入持久化（DesignSummary / ProjectV3 仍是真实存储结构）。
 */

/** Studio 四模式：浏览模板 → 设计 → 扫描预览 → 确认（单向流转，confirm 只读） */
export type StudioMode = 'browse' | 'design' | 'scan-preview' | 'confirm';

/** 配方引用：配方内容不落设计文档，只存 id + 版本（换版可追踪） */
export interface RecipeRef {
  id: string;
  version: string;
}

/** 几何选择：甲型 × 长度（制造语义的唯一几何入口） */
export interface DesignGeometry {
  shape: NailShape;
  length: NailLength;
}

/**
 * DesignSet：一套可保存的十指设计文档（document 态）。
 * - defaults：十指共享的默认层参数（底色/质感/模板）
 * - overrides：逐指差分覆写，只存与 defaults 不同的字段；
 *   「重置此指」= 删除该指覆写；masterFinger 只是编辑入口，不入文档
 */
export interface DesignSet {
  geometry: DesignGeometry;
  recipeRef?: RecipeRef;
  defaults: {
    baseColor: string;
    finish: Finish;
    templateId?: string;
  };
  overrides: FingerOverrides;
}

/** 状态分离（§11）：三类状态不得混存 */
export interface StudioStatePartitions {
  /** document：可保存、可版本化（DesignSet / ProjectV3） */
  document: unknown;
  /** scanContext：扫描几何上下文，只读、带版本，永不编辑 */
  scanContext: unknown;
  /** ui：瞬态（选中手指、弹窗、淡入淡出），不持久化 */
  ui: unknown;
  /** derived：RenderModel 等派生渲染态，由前三者计算，不持久化 */
  derived?: unknown;
}

/**
 * 双输出契约：
 * - PreviewRender：展示渲染（Plate + SlotMap + Geometry + Recipe），不保证物理厚度
 * - ManufacturingPackage：生产包（扫描几何 + FrozenSnapshot），Sprint 2+ 才生成
 */
export interface PreviewRender {
  kind: 'preview';
  plateId: string;
  slotCalibrationVersion: string;
  geometry: DesignGeometry;
  recipeRef?: RecipeRef;
}

export interface ManufacturingPackage {
  kind: 'manufacturing';
  scanContextVersion: string;
  frozenSnapshot: DesignSet;
}

/* ── localStorage Envelope ────────────────────────────── */

/** 存储信封：版本号 + 更新时间 + 写入标签页 id（数据桥跨标签 rehydrate 用） */
export interface StorageEnvelope<T> {
  v: number; // envelope 结构版本
  updatedAt: number; // epoch ms
  tabId: string; // 写入方标签页 id（防止自回环）
  data: T;
}
